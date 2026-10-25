// Un repetidor TURN de mentira para este PC (§103): hace lo que hace el TURN de Cloudflare Realtime, para probar el modo
// «🛰 Todo por Cloudflare» sin salir a internet. Solo para pruebas: nunca se publica ni corre en el sitio.
//
// Resumen: TURN (RFC 5766/8656) es un repetidor de paquetes. Cada navegador le pide una «asignación» (Allocate): el
// repetidor abre un puerto UDP propio para él (su dirección «relay») y desde ahí reenvía lo que el navegador le manda
// (Send o ChannelData) a la dirección del otro, y lo que llega a ese puerto se lo devuelve al navegador (Data o
// ChannelData). Como un repetidor de radio en un cerro: los dos hablan con el cerro, no entre ellos. Para pedir una
// asignación hace falta la clave (usuario + contraseña: la firma HMAC-SHA1 de cada mensaje, MESSAGE-INTEGRITY), igual
// que con las credenciales que entrega el Worker en /turn. Solo UDP e IPv4 (lo que usa Chrome con turn:…?transport=udp).
//
// Uso:  import { crearTurn } from './turn-local.mjs';
//       const t = await crearTurn();            // en 127.0.0.1, puerto libre; t.iceServers() = lo mismo que da /turn
//       t.cuenta  →  { asignaciones, reenviados, bytes }      t.cerrar()
//       node herramientas/turn-local.mjs [puerto]           (suelto, para mirarlo a mano; Ctrl+C para cerrar)
import dgram from 'node:dgram';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const COOKIE = 0x2112A442;                       // el «número mágico» de STUN: todo mensaje lo lleva en los bytes 4-7
// los métodos (qué se pide) y las clases (pedido, aviso, éxito, error)
const M = { BINDING: 1, ALLOCATE: 3, REFRESH: 4, SEND: 6, DATA: 7, PERMISO: 8, CANAL: 9 };
const C = { PEDIDO: 0, AVISO: 1, EXITO: 2, ERROR: 3 };
// los atributos que se usan (cada uno: tipo de 2 bytes, largo de 2 bytes, valor rellenado a múltiplo de 4)
const A = { USUARIO: 0x0006, FIRMA: 0x0008, ERROR: 0x0009, CANAL: 0x000C, VIDA: 0x000D, PAR: 0x0012, DATOS: 0x0013,
  REINO: 0x0014, NONCE: 0x0015, RELEVO: 0x0016, YO: 0x0020, HUELLA: 0x8028 };

// el tipo de mensaje mezcla los bits del método y de la clase (así lo define STUN)
const tipoDe = (m, c) => ((m & 0xF80) << 2) | ((m & 0x70) << 1) | (m & 0xF) | ((c & 2) << 7) | ((c & 1) << 4);
const metodoDe = t => ((t & 0x3E00) >> 2) | ((t & 0xE0) >> 1) | (t & 0xF);
const claseDe = t => ((t >> 7) & 2) | ((t >> 4) & 1);

// un mensaje STUN/TURN recibido → { met, cla, id, atr: Map(tipo → { v, o }) } (o = dónde empieza el atributo); null si no es
function leer(b) {
  if (b.length < 20 || (b[0] & 0xC0) !== 0 || b.readUInt32BE(4) !== COOKIE) return null;
  const t = b.readUInt16BE(0), largo = b.readUInt16BE(2);
  if (20 + largo > b.length) return null;
  const atr = new Map();
  for (let o = 20; o + 4 <= 20 + largo;) {
    const k = b.readUInt16BE(o), n = b.readUInt16BE(o + 2);
    if (!atr.has(k)) atr.set(k, { v: b.subarray(o + 4, o + 4 + n), o });
    if (k === A.PAR) (atr.get('pares') || atr.set('pares', []).get('pares')).push(b.subarray(o + 4, o + 4 + n));
    o += 4 + ((n + 3) & ~3);
  }
  return { met: metodoDe(t), cla: claseDe(t), id: Buffer.from(b.subarray(8, 20)), atr, b };
}

// las direcciones van «XOR» con el número mágico (para que ningún router las reescriba creyendo que son suyas)
function dirDe(v) {
  if (!v || v.length < 8 || v[1] !== 1) return null;                         // (familia 1 = IPv4)
  const ip = [0, 1, 2, 3].map(i => v[4 + i] ^ ((COOKIE >>> (24 - 8 * i)) & 0xFF)).join('.');
  return { ip, puerto: v.readUInt16BE(2) ^ (COOKIE >>> 16) };
}
function bytesDe({ ip, puerto }) {
  const b = Buffer.alloc(8);
  b[1] = 1; b.writeUInt16BE(puerto ^ (COOKIE >>> 16), 2);
  ip.split('.').forEach((x, i) => { b[4 + i] = Number(x) ^ ((COOKIE >>> (24 - 8 * i)) & 0xFF); });
  return b;
}
const atributo = (k, v) => {
  const h = Buffer.alloc(4); h.writeUInt16BE(k); h.writeUInt16BE(v.length, 2);
  return Buffer.concat([h, v, Buffer.alloc((4 - v.length % 4) % 4)]);
};
const vida = s => { const b = Buffer.alloc(4); b.writeUInt32BE(s); return b; };
const errorDe = (codigo, texto) => Buffer.concat([Buffer.from([0, 0, Math.floor(codigo / 100), codigo % 100]), Buffer.from(texto)]);

// arma un mensaje: los atributos, la firma (si hay clave) y la huella (CRC32) al final
function armar(met, cla, id, atrs, clave = null) {
  let cuerpo = Buffer.concat(atrs.map(([k, v]) => atributo(k, v)));
  const cab = Buffer.alloc(20);
  cab.writeUInt16BE(tipoDe(met, cla)); cab.writeUInt32BE(COOKIE, 4); id.copy(cab, 8);
  if (clave) {
    cab.writeUInt16BE(cuerpo.length + 24, 2);                                // (el largo ya cuenta la firma)
    const firma = crypto.createHmac('sha1', clave).update(Buffer.concat([cab, cuerpo])).digest();
    cuerpo = Buffer.concat([cuerpo, atributo(A.FIRMA, firma)]);
  }
  cab.writeUInt16BE(cuerpo.length + 8, 2);
  const huella = Buffer.alloc(4);
  huella.writeUInt32BE((zlib.crc32(Buffer.concat([cab, cuerpo])) ^ 0x5354554E) >>> 0);
  return Buffer.concat([cab, cuerpo, atributo(A.HUELLA, huella)]);
}

// ¿la firma del pedido es la de esta clave? (se calcula sobre el mensaje hasta la firma, con el largo hasta ella)
function firmaBuena(m, clave) {
  const f = m.atr.get(A.FIRMA);
  if (!f) return false;
  const copia = Buffer.from(m.b.subarray(0, f.o));
  copia.writeUInt16BE(f.o + 24 - 20, 2);
  return crypto.timingSafeEqual(crypto.createHmac('sha1', clave).update(copia).digest(), Buffer.from(f.v));
}

export async function crearTurn({ ip = '127.0.0.1', puerto = 0, usuario = 'banco', clave = 'banco-' + crypto.randomBytes(6).toString('hex'),
  reino = 'banco.local', registro = () => {} } = {}) {
  const llave = crypto.createHash('md5').update(`${usuario}:${reino}:${clave}`).digest();   // la de cada firma
  const nonce = Buffer.from(crypto.randomBytes(8).toString('hex'));
  const cuenta = { asignaciones: 0, reenviados: 0, bytes: 0, pedidos: 0 };
  const asignaciones = new Map();                // «ip:puerto» del navegador → su asignación
  const servidor = dgram.createSocket('udp4');
  const clave5 = r => `${r.address}:${r.port}`;

  // lo que llega al puerto de una asignación (del otro): al navegador, por su canal si lo tiene, si no como «Data»
  function alPuertoDe(x, datos, r) {
    if (!x.permisos.has(r.address)) return;
    const canal = x.canalDe.get(clave5(r));
    let b;
    if (canal) { b = Buffer.alloc(4 + datos.length); b.writeUInt16BE(canal); b.writeUInt16BE(datos.length, 2); datos.copy(b, 4); }
    else b = armar(M.DATA, C.AVISO, crypto.randomBytes(12), [[A.PAR, bytesDe({ ip: r.address, puerto: r.port })], [A.DATOS, datos]]);
    cuenta.reenviados++; cuenta.bytes += datos.length;
    servidor.send(b, x.cliente.port, x.cliente.address);
  }
  const hacia = (x, dir, datos) => {
    if (!dir || !x.permisos.has(dir.ip)) return;
    cuenta.reenviados++; cuenta.bytes += datos.length;
    x.socket.send(datos, dir.puerto, dir.ip);
  };

  async function asignar(r) {
    const socket = dgram.createSocket('udp4');
    await new Promise((listo, mal) => { socket.once('error', mal); socket.bind(0, ip, listo); });
    const x = { cliente: r, socket, permisos: new Set(), canales: new Map(), canalDe: new Map(), vence: Date.now() + 600e3 };
    socket.on('message', (d, rr) => alPuertoDe(x, d, rr));
    asignaciones.set(clave5(r), x); cuenta.asignaciones++;
    registro(`[turn] asignación para ${clave5(r)} en ${ip}:${socket.address().port}`);
    return x;
  }
  function soltar(k) { const x = asignaciones.get(k); if (!x) return; asignaciones.delete(k); try { x.socket.close(); } catch {} }

  servidor.on('message', async (b, r) => {
    // ChannelData (los dos primeros bits 01): número de canal, largo y los datos, hacia el par de ese canal
    if (b.length >= 4 && (b[0] & 0xC0) === 0x40) {
      const x = asignaciones.get(clave5(r)), canal = b.readUInt16BE(0), n = b.readUInt16BE(2);
      if (x && x.canales.has(canal) && 4 + n <= b.length) hacia(x, x.canales.get(canal), b.subarray(4, 4 + n));
      return;
    }
    const m = leer(b);
    if (!m) return;
    cuenta.pedidos++;
    const x = asignaciones.get(clave5(r));
    const responde = (cla, atrs, firmar = true) => servidor.send(armar(m.met, cla, m.id, atrs, firmar ? llave : null), r.port, r.address);
    // el aviso «Send»: los datos al par (sin firma: los avisos no la llevan)
    if (m.cla === C.AVISO) { if (m.met === M.SEND && x) hacia(x, dirDe(m.atr.get(A.PAR)?.v), m.atr.get(A.DATOS)?.v || Buffer.alloc(0)); return; }
    if (m.cla !== C.PEDIDO) return;
    // «¿cuál es mi dirección?» (Binding): sin clave, como un STUN cualquiera
    if (m.met === M.BINDING) return responde(C.EXITO, [[A.YO, bytesDe({ ip: r.address, puerto: r.port })]], false);
    // el resto pide la clave: el primer pedido va sin ella y se contesta 401 con el reino y el nonce para firmarla
    const quien = m.atr.get(A.USUARIO)?.v.toString();
    if (!m.atr.has(A.FIRMA) || quien !== usuario || !firmaBuena(m, llave)) {
      return responde(C.ERROR, [[A.ERROR, errorDe(401, 'Unauthorized')], [A.REINO, Buffer.from(reino)], [A.NONCE, nonce]], false);
    }
    if (m.met === M.ALLOCATE) {
      const y = x || await asignar(r);
      return responde(C.EXITO, [[A.RELEVO, bytesDe({ ip, puerto: y.socket.address().port })], [A.YO, bytesDe({ ip: r.address, puerto: r.port })], [A.VIDA, vida(600)]]);
    }
    if (!x) return responde(C.ERROR, [[A.ERROR, errorDe(437, 'Allocation Mismatch')]]);
    if (m.met === M.REFRESH) {
      const s = m.atr.get(A.VIDA)?.v.readUInt32BE(0) ?? 600;
      if (s === 0) soltar(clave5(r)); else x.vence = Date.now() + s * 1000;
      return responde(C.EXITO, [[A.VIDA, vida(s === 0 ? 0 : Math.min(s, 3600))]]);
    }
    if (m.met === M.PERMISO) {
      for (const v of m.atr.get('pares') || []) { const d = dirDe(v); if (d) x.permisos.add(d.ip); }
      return responde(C.EXITO, []);
    }
    if (m.met === M.CANAL) {
      const canal = m.atr.get(A.CANAL)?.v.readUInt16BE(0), d = dirDe(m.atr.get(A.PAR)?.v);
      if (!canal || !d) return responde(C.ERROR, [[A.ERROR, errorDe(400, 'Bad Request')]]);
      x.canales.set(canal, d); x.canalDe.set(`${d.ip}:${d.puerto}`, canal); x.permisos.add(d.ip);
      return responde(C.EXITO, []);
    }
    responde(C.ERROR, [[A.ERROR, errorDe(400, 'Bad Request')]]);
  });
  await new Promise((listo, mal) => { servidor.once('error', mal); servidor.bind(puerto, ip, listo); });
  const p = servidor.address().port;
  // las asignaciones vencidas se sueltan solas (como en el de verdad)
  const limpia = setInterval(() => { const t = Date.now(); for (const [k, x] of asignaciones) if (x.vence < t) soltar(k); }, 30e3);
  limpia.unref?.();
  return {
    ip, puerto: p, cuenta,
    // lo mismo que contesta el Worker en /turn con las credenciales de Cloudflare
    iceServers: () => [{ urls: [`turn:${ip}:${p}?transport=udp`], username: usuario, credential: clave }],
    cerrar() { clearInterval(limpia); for (const k of [...asignaciones.keys()]) soltar(k); try { servidor.close(); } catch {} },
  };
}

// suelto: node herramientas/turn-local.mjs [puerto]
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t = await crearTurn({ puerto: Number(process.argv[2]) || 3478, registro: console.log });
  console.log(`TURN de prueba en ${t.ip}:${t.puerto}`, JSON.stringify(t.iceServers()));
  setInterval(() => console.log(JSON.stringify(t.cuenta)), 10e3);
}
