// El "WFC virtual": un servidor de Wi‑Fi de Nintendo chiquito, escrito en JS, dentro de la sala — bitácora §58 (F1).
//
// Resumen: Mario Kart Wii, antes de jugar en línea, habla con unos servidores (antes los de Nintendo/GameSpy; hoy
// Retro WFC): le pregunta si el servicio anda, inicia sesión, busca salas y presenta a los jugadores entre sí. La
// CARRERA no pasa por ahí: va directo entre las consolas. Este archivo hace de esos servidores, pero solo para la
// gente de la sala, sobre la red de juguete de red.mjs (en la pestaña de quien abre la sala, IP 10.77.0.1).
// Se escribe desde el protocolo documentado públicamente (wiki.tockdom.com, mkwiiki.org), sin copiar código de
// otros servidores.
//
// Servicios (todos en la misma IP; el puerto dice cuál es):
//   - NAS (HTTP, puertos 80 y 443 en texto plano): inicio de sesión de la consola (POST /ac). Responde con un
//     "token" y un "challenge" que luego se usan en GPCM.
//   - available (UDP 27900, el primer paquete): "¿el juego tiene servicio?" → sí.
//   - GPCM (TCP 29900): la sesión del jugador (perfil, amigos, estado). Mensajes de texto \clave\valor\…\final\
//   - lo demás (GPSP 29901, QR2 27900, NATNEG 27901, lista de salas 28910, SAKE/estadísticas por HTTP): por ahora
//     solo se anota lo que llega (registro), para construirlo mirando lo que el juego pide de verdad.
//
// Uso:  const wfc = crearWfc({ pila, registro: t => console.log(t) });   (pila = crearPila({ ip: '10.77.0.1', … }))

import { servidorSalas } from './wfc-salas.mjs';
import { PUERTO_VR, valido, respuestaRatings, extraerVrbr } from './vr.mjs';
import { ipTexto } from './red.mjs';

const texto = new TextDecoder('latin1'), bytes = s => Uint8Array.from(s, c => c.charCodeAt(0) & 255);
const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join(' ');

// ---- MD5 (lo usa GPCM para la "prueba" de la contraseña). Algoritmo público (RFC 1321) ----
export function md5(entrada) {
  const m = typeof entrada === 'string' ? bytes(entrada) : entrada;
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const R = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const n = ((m.length + 8 >> 6) + 1) * 64, b = new Uint8Array(n);
  b.set(m); b[m.length] = 0x80;
  const bits = m.length * 8; for (let i = 0; i < 8; i++) b[n - 8 + i] = i < 4 ? (bits >>> (8 * i)) & 255 : Math.floor(bits / 2 ** (8 * i)) & 255;
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const v = new DataView(b.buffer);
  for (let o = 0; o < n; o += 64) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + v.getUint32(o + g * 4, true)) >>> 0;
      A = D; D = C; C = B;
      const s = R[(i >> 4) * 4 + (i & 3)];
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  return [a0, b0, c0, d0].map(x => [0, 8, 16, 24].map(s => ((x >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
}

// ---- NAS: el formulario de la Wii usa base64 con '*' en vez de '=' (y '.' '-' en vez de '+' '/') ----
const b64Wii = {
  de: s => { try { return atob(s.replace(/\*/g, '=').replace(/\./g, '+').replace(/-/g, '/')); } catch { return ''; } },
  a: s => btoa(s).replace(/=/g, '*').replace(/\+/g, '.').replace(/\//g, '-'),
};
const azar = (n, abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), x => abc[x % abc.length]).join('');
const fechaWii = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

// GameSpy: \clave\valor\clave\valor\…\final\  ↔ objeto. Una "orden" es la primera clave (\login\, \status\…)
export function leerGs(t) {
  const partes = t.split('\\'); const o = {}; let orden = null;
  for (let i = 1; i + 1 < partes.length; i += 2) { if (orden === null) orden = partes[i]; o[partes[i]] = partes[i + 1]; }
  return { orden, datos: o };
}
export const escribirGs = pares => pares.map(([k, v]) => `\\${k}\\${v ?? ''}`).join('') + '\\final\\';

export function crearWfc({ pila, registro = () => {}, nombreDe = () => 'Jugador', alVr = null }) {
  const log = (s, ...a) => registro(`[wfc:${s}] ${a.join(' ')}`);
  const sesiones = new Map();          // token NAS → { challenge, userid, gsbrcd, perfil }
  const perfiles = new Map();          // profileid → { nick, estado, ip }
  // el número de perfil (y el apodo) de cada consola SIEMPRE el mismo: salen de una cuenta fija (MD5) sobre su
  // identificador (userid + gsbrcd, que la consola manda al NAS). La consola guarda en su partida el perfil de la
  // primera vez; si al volver a entrar le diéramos otro, corta con el error 60000. Así da igual qué pestaña sea el
  // servidor o cuándo se juegue, sin guardar nada (como una resistencia de valor fijo: misma entrada, misma salida)
  const perfilPara = (userid, gsbrcd) => 100000000 + parseInt(md5(`${userid}/${gsbrcd}`).slice(0, 8), 16) % 900000000;
  const apodoPara = perfil => md5(`apodo/${perfil}`).replace(/[^a-z]/g, '').padEnd(14, 'x').slice(0, 14);
  const qr2 = new Map();               // QR2: "ip:puerto" → { sesion, reto, registrada, datos: {clave: valor} }
  // VR y BR (vr.mjs, §59): la página de cada jugador presenta el VR de su cuenta (de Firebase) con un paquetito UDP al
  // puerto PUERTO_VR; queda anotado por IP. Cuando su consola entra por GPCM, el perfil hereda el VR de su IP, y
  // cuando el juego pregunta /api/mkw_rr_ratings?pid=… se contesta con ese
  const vrPorIp = new Map();           // ip (número) → { vr, br }
  pila.udp(PUERTO_VR, (d, ip, puerto, responder) => {
    try {
      const r = JSON.parse(texto.decode(d));
      if (valido(r.vr) && valido(r.br)) {
        vrPorIp.set(ip >>> 0, { vr: r.vr, br: r.br });
        for (const p of perfiles.values()) if (p.ip === ip >>> 0 && !p.vrbr) p.vrbr = { vr: r.vr, br: r.br };
        log('vr', `${ipTexto(ip)} presenta VR ${r.vr} / BR ${r.br}`);
      }
    } catch {}
    responder(bytes('ok'));
  });
  const vrDe = perfil => { const p = perfiles.get(+perfil); return p ? p.vrbr || vrPorIp.get(p.ip) || null : null; };

  // ---- HTTP (NAS y lo demás) ----
  function servidorHttp(puerto) {
    pila.servidorTcp(puerto, con => {
      let buf = '';
      con.alRecibir(b => {
        buf += texto.decode(b);
        const fin = buf.indexOf('\r\n\r\n'); if (fin < 0) return;
        const cab = buf.slice(0, fin), largo = +(/content-length:\s*(\d+)/i.exec(cab)?.[1] || 0);
        if (buf.length < fin + 4 + largo) return;
        const cuerpo = buf.slice(fin + 4, fin + 4 + largo); buf = buf.slice(fin + 4 + largo);
        const [linea, ...lineas] = cab.split('\r\n'), [metodo, ruta] = linea.split(' ');
        const cabeceras = Object.fromEntries(lineas.map(l => { const k = l.indexOf(':'); return [l.slice(0, k).trim().toLowerCase(), l.slice(k + 1).trim()]; }));
        const host = cabeceras.host || '';
        const r = http({ metodo, ruta, host, cuerpo, puerto, cabeceras });
        con.enviar(bytes(`HTTP/1.1 ${r.estado || '200 OK'}\r\nContent-Type: ${r.tipo || 'text/plain'}\r\nContent-Length: ${r.cuerpo.length}\r\n` +
          `Server: Nintendo Wii (http)\r\nNODE: wifiappe1\r\nConnection: close\r\n\r\n${r.cuerpo}`));
      });
    });
  }
  function http({ metodo, ruta, host, cuerpo, puerto, cabeceras }) {
    if (/(^|\.)sake\.gs\./.test(host) && ruta.includes('StorageServer')) return sake(cabeceras.soapaction || '', cuerpo);
    // las API propias de Retro Rewind (en rwfc.net): cuántos hay en línea y el multiplicador de VR
    if (ruta.startsWith('/api/wfc/mkw_stats')) {
      const n = qr2.size;
      return { tipo: 'application/json', cuerpo: JSON.stringify({ global: { OnlinePlayerCount: n, GroupCount: 0, ActivePlayerCount: 0 }, by_region: {} }) };
    }
    if (ruta.startsWith('/api/multiplier')) return { tipo: 'application/json', cuerpo: JSON.stringify({ multiplier: 1, enabled: false }) };
    if (ruta.startsWith('/api/mkw_rr_ratings')) {
      // el juego pregunta el VR guardado de un perfil (el suyo, al entrar): {"found":1,"vr":VR,"br":BR}
      const pid = /[?&]pid=(\d+)/.exec(ruta)?.[1], r = respuestaRatings(vrDe(pid));
      log('vr', `el juego pregunta el VR del perfil ${pid}: ${r.found ? r.vr + ' / ' + r.br : 'no hay (usa el de su archivo)'}`);
      return { tipo: 'application/json', cuerpo: JSON.stringify(r) };
    }
    if (metodo === 'POST' && ruta.startsWith('/ac')) { if (globalThis.mkwWfcCrudo) log('http-crudo', JSON.stringify({ ruta, host, cuerpo: cuerpo.slice(0, 600) })); return nas(cuerpo); }
    if (metodo === 'POST' && ruta.startsWith('/pr')) return { cuerpo: formulario({ prwords: '0'.repeat(16), returncd: '000', datetime: fechaWii() }) };
    log('http', `${metodo} ${host}${ruta} (puerto ${puerto}) ${cuerpo.length} bytes — sin manejar`);
    return { estado: '404 Not Found', cuerpo: '' };
  }
  const formulario = o => Object.entries(o).map(([k, v]) => `${k}=${b64Wii.a(String(v))}`).join('&') + '\r\n';
  function nas(cuerpo) {
    const f = Object.fromEntries(cuerpo.trim().split('&').map(p => { const [k, v = ''] = p.split('='); return [k, b64Wii.de(decodeURIComponent(v))]; }));
    log('nas', `action=${f.action} gamecd=${f.gamecd} userid=${f.userid} gsbrcd=${f.gsbrcd}`);
    const accion = (f.action || '').toLowerCase();
    if (accion === 'acctcreate') return { cuerpo: formulario({ retry: 0, returncd: '002', userid: f.userid || String(Date.now() % 1e13), datetime: fechaWii() }) };
    if (accion === 'login') {
      const token = 'NDS' + azar(93), challenge = azar(8);
      sesiones.set(token, { challenge, userid: f.userid, gsbrcd: f.gsbrcd, nombre: f.ingamesn ? f.ingamesn : '' });
      return { cuerpo: formulario({ challenge, locator: 'gamespy.com', retry: 0, returncd: '001', token, datetime: fechaWii() }) };
    }
    if (accion === 'svcloc') return { cuerpo: formulario({ retry: 0, returncd: '007', statusdata: 'Y', svchost: 'n/a', servicetoken: azar(32), datetime: fechaWii() }) };
    log('nas', `acción desconocida ${f.action}`);
    return { cuerpo: formulario({ retry: 0, returncd: '109', datetime: fechaWii() }) };
  }
  // ---- SAKE: el "almacén" de GameSpy (SOAP sobre HTTP). Mario Kart Wii guarda ahí su FriendInfo (el Mii y los
  // datos que ven tus amigos) y busca fantasmas. Respuestas en XML; los valores van como intValue / uintValue /
  // binaryDataValue (base64). Solo FriendInfo guarda de verdad (en memoria, por perfil); lo demás da vacío.
  const almacen = new Map();           // profileid → { recordid, info (base64) }
  const etiqueta = (xml, n) => (new RegExp(`<(?:\\w+:)?${n}>([\\s\\S]*?)</(?:\\w+:)?${n}>`).exec(xml) || [])[1] ?? '';
  const perfilDeTicket = () => [...perfiles.keys()].pop() || 0;     // un solo jugador por pestaña: el último que entró
  function sake(accion, xml) {
    const nombre = accion.replace(/"/g, '').split('/').pop();
    const tabla = etiqueta(xml, 'tableid'), campos = [...etiqueta(xml, 'fields').matchAll(/<(?:\w+:)?string>([^<]*)</g)].map(m => m[1]);
    const valor = (t, v) => `<RecordValue><${t}><value>${v}</value></${t}></RecordValue>`;
    const fila = (pid, r) => '<ArrayOfRecordValue>' + campos.map(c => c === 'ownerid' ? valor('uintValue', pid) : c === 'recordid' ? valor('intValue', r.recordid)
      : c === 'info' ? valor('binaryDataValue', r.info) : '<RecordValue/>').join('') + '</ArrayOfRecordValue>';
    let resultado = 'Success', valores = '';
    if (nombre === 'GetMyRecords') {
      const pid = perfilDeTicket(), r = tabla === 'FriendInfo' && almacen.get(pid);
      if (r) valores = fila(pid, r);
    } else if (nombre === 'SearchForRecords') {
      const dueno = +(/ownerid\s*=\s*(\d+)/.exec(etiqueta(xml, 'filter'))?.[1] || 0), r = tabla === 'FriendInfo' && almacen.get(dueno);
      if (r) valores = fila(dueno, r);
    } else if (nombre === 'UpdateRecord' || nombre === 'CreateRecord') {
      const pid = perfilDeTicket(), info = etiqueta(etiqueta(xml, 'values'), 'binaryDataValue').replace(/<\/?(?:\w+:)?value>/g, '').trim();
      if (tabla === 'FriendInfo' && info) { const r = almacen.get(pid) || { recordid: almacen.size + 1 }; r.info = info; almacen.set(pid, r); }
    } else { log('sake', `acción ${nombre} (tabla ${tabla}) — sin manejar`); resultado = 'Error'; }
    log('sake', `${nombre} ${tabla} [${campos}] → ${resultado}${valores ? ' (1 registro)' : ''}`);
    const extra = nombre === 'CreateRecord' ? `<recordid>${almacen.get(perfilDeTicket())?.recordid || 1}</recordid>` : `<values>${valores}</values>`;
    return { tipo: 'text/xml', cuerpo: '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body>' +
      `<${nombre}Response xmlns="http://gamespy.net/sake"><${nombre}Result>${resultado}</${nombre}Result>${nombre === 'UpdateRecord' ? '' : extra}</${nombre}Response></soap:Body></soap:Envelope>` };
  }
  servidorHttp(80); servidorHttp(443);

  // ---- UDP 27900: "available" y QR2 (salas) ----
  // QR2 ("query and reporting"): cada consola en línea manda un "latido" (heartbeat) con sus datos (IP local,
  // puerto, si es anfitrión de una sala, su VR…). El servidor le contesta un reto (challenge) la primera vez; la
  // consola lo responde y queda "registrada"; después manda latidos y "sigo aquí" (keepalive). Con esto el
  // servidor sabe quién está en línea y en qué sala: es lo que después lista para buscar partidas.
  // Paquetes: [tipo][sesión: 4 bytes][datos]. Respuestas: FE FD [tipo][sesión][datos].
  const cabeceraQr2 = (tipo, sesion) => Uint8Array.of(0xfe, 0xfd, tipo, sesion >>> 24, (sesion >>> 16) & 255, (sesion >>> 8) & 255, sesion & 255);
  const unir = (...partes) => { const n = partes.reduce((t, p) => t + p.length, 0), r = new Uint8Array(n); let o = 0; for (const p of partes) { r.set(p, o); o += p.length; } return r; };
  const udpQr2 = pila.udp(27900, (d, ip, puerto, responder) => {
    if (d.length < 5) return;
    const sesion = ((d[1] << 24) | (d[2] << 16) | (d[3] << 8) | d[4]) >>> 0, clave = `${ip >>> 0}:${puerto}`;
    const tipo = d[0];
    if (tipo === 0x09) { log('available', texto.decode(d.subarray(5)).replace(/\0.*$/s, '')); responder(cabeceraQr2(0x09, 0)); return; }
    if (tipo === 0x03) {                                     // latido: claves y valores separados por \0
      const partes = texto.decode(d.subarray(5)).split('\0'), datos = {};
      for (let i = 0; i + 1 < partes.length; i += 2) if (partes[i] && partes[i][0] !== '+') datos[partes[i]] = partes[i + 1];
      if (datos.statechanged === '2') { qr2.delete(clave); log('qr2', `${clave} se fue`); return; }
      const ses = qr2.get(clave) || { sesion, registrada: false, datos: {} };
      ses.sesion = sesion; Object.assign(ses.datos, datos, { publicip: String(ip >>> 0), publicport: String(puerto) });
      qr2.set(clave, ses);
      if (!ses.registrada) {
        // el reto: 6 letras al azar + "00" + la IP y el puerto vistos, en hexadecimal (como Retro WFC)
        const ipHex = [ip >>> 24, (ip >>> 16) & 255, (ip >>> 8) & 255, ip & 255].map(x => x.toString(16).toUpperCase().padStart(2, '0')).join('');
        ses.reto = ses.reto || azar(6) + '00' + ipHex + puerto.toString(16).toUpperCase().padStart(4, '0');
        responder(unir(cabeceraQr2(0x01, sesion), bytes(ses.reto), Uint8Array.of(0)));
      }
      log('qr2', `latido de ${clave}: ${Object.entries(datos).map(([k, v]) => `${k}=${v}`).join(' ').slice(0, 300)}`);
      return;
    }
    const ses = qr2.get(clave);
    if (tipo === 0x01) {                                     // la respuesta al reto: registrada
      if (ses?.reto) { ses.registrada = true; responder(cabeceraQr2(0x0a, sesion)); log('qr2', `${clave} registrada`); }
      return;
    }
    if (tipo === 0x08) { responder(cabeceraQr2(0x08, 0)); return; }   // keepalive
    if (tipo === 0x07) return;                               // "recibí tu mensaje"
    log('qr2', `tipo 0x${tipo.toString(16)} de ${clave} — ${hex(d.subarray(0, 48))}`);
  });
  // ---- NATNEG (UDP 27901): antes de jugar, dos consolas que se quieren conectar "negocian" cómo verse a través de
  // sus routers (NAT). Aquí no hay routers: la red de juguete las une directo. Así que el servidor solo junta a las
  // dos por su "cookie" (un número que comparten) y le dice a cada una la dirección de juego de la otra (CONNECT).
  // Paquete: FD FC 1E 66 6A B2 [versión][tipo][cookie: 4 bytes][datos]. Tipos: 0 INIT → 1 INIT_ACK; 5 CONNECT
  // (servidor → consola: IP, puerto, 0x42, 0) → 6 CONNECT_ACK; 0x0A ADDRESS_CHECK → 0x0B ADDRESS_REPLY;
  // 0x0D REPORT → 0x0E REPORT_ACK; 0x0F PREINIT → 0x10 PREINIT_ACK.
  const negociaciones = new Map();     // cookie → { [índice 0|1]: { ip, puerto } , avisado }
  const MAGIA = [0xfd, 0xfc, 0x1e, 0x66, 0x6a, 0xb2];
  const udpNatneg = pila.udp(27901, (d, ip, puerto, responder) => {
    if (d.length < 12 || MAGIA.some((m, i) => d[i] !== m)) return;
    const version = d[6], tipo = d[7], cookie = ((d[8] << 24) | (d[9] << 16) | (d[10] << 8) | d[11]) >>> 0;
    const cab = t => [...MAGIA, version, t, d[8], d[9], d[10], d[11]];
    if (tipo === 0x00) {                                     // INIT: [tipo de puerto][índice][usa puerto de juego][IP local 4][puerto local 2]
      const tipoPuerto = d[12], indice = d[13], puertoLocal = (d[19] << 8) | d[20];
      responder(Uint8Array.from([...cab(0x01), tipoPuerto, indice, 0xff, 0xff, 0x6d, 0x16, 0xb5, 0x7d, 0xea]));
      const n = negociaciones.get(cookie) || { lados: {}, avisado: false };
      // la dirección de juego: la del INIT que sale del puerto del juego (tipo 0), o la IP + el puerto local que dice
      if (tipoPuerto === 0 || !n.lados[indice]) n.lados[indice] = { ip: ip >>> 0, puerto: tipoPuerto === 0 ? puerto : (puertoLocal || puerto) };
      negociaciones.set(cookie, n);
      log('natneg', `INIT cookie ${cookie} lado ${indice} tipo ${tipoPuerto} desde ${ip >>> 0}:${puerto}`);
      if (n.lados[0] && n.lados[1] && !n.avisado) {
        n.avisado = true;
        // un instante después (que ambos terminen sus INIT), a cada uno la dirección del otro
        setTimeout(() => {
          for (const i of [0, 1]) {
            const yo = n.lados[i], otro = n.lados[1 - i];
            const ip4 = [otro.ip >>> 24, (otro.ip >>> 16) & 255, (otro.ip >>> 8) & 255, otro.ip & 255];
            udpNatneg.enviar(Uint8Array.from([...cab(0x05), ...ip4, (otro.puerto >> 8) & 255, otro.puerto & 255, 0x42, 0x00]), yo.ip, yo.puerto);
          }
          log('natneg', `CONNECT cookie ${cookie}: ${n.lados[0].ip}:${n.lados[0].puerto} ↔ ${n.lados[1].ip}:${n.lados[1].puerto}`);
        }, 50);
      }
    } else if (tipo === 0x0a) {                              // ADDRESS_CHECK: "¿cómo me ves?"
      responder(Uint8Array.from([...cab(0x0b), ...d.subarray(12, 15), ip >>> 24, (ip >>> 16) & 255, (ip >>> 8) & 255, ip & 255, (puerto >> 8) & 255, puerto & 255]));
    } else if (tipo === 0x0d) {                              // REPORT: cómo le fue
      responder(Uint8Array.from([...cab(0x0e), ...d.subarray(12, 21)]));
      log('natneg', `REPORT cookie ${cookie}: ${hex(d.subarray(12, 21))}`);
      negociaciones.delete(cookie);
    } else if (tipo === 0x0f) {                              // PREINIT (versión 4)
      responder(Uint8Array.from([...cab(0x10), d[12] ?? 0, 0x02, 0, 0, 0, 0]));
    } else if (tipo === 0x06) { /* CONNECT_ACK */ }
    else log('natneg', `tipo 0x${tipo.toString(16)} cookie ${cookie} (${d.length} bytes) — sin manejar`);
  });

  // ---- GPCM: la sesión del jugador ----
  pila.servidorTcp(29900, con => {
    const reto = azar(10, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    let perfil = 0, buf = '';
    con.enviar(escribirGs([['lc', 1], ['challenge', reto], ['id', 1]]));
    con.alRecibir(b => {
      buf += texto.decode(b);
      let i;
      while ((i = buf.indexOf('\\final\\')) >= 0) {
        const msg = buf.slice(0, i + 7); buf = buf.slice(i + 7);
        const { orden, datos } = leerGs(msg);
        if (globalThis.mkwWfcCrudo) log('gpcm-crudo', JSON.stringify(msg.slice(0, 900)));
        if (orden === 'login') {
          const s = sesiones.get(datos.authtoken);
          if (!s) { log('gpcm', 'login con token desconocido'); con.enviar(escribirGs([['error', ''], ['err', 266], ['fatal', ''], ['errmsg', 'There was an error validating the pre-authentication.'], ['id', 1]])); continue; }
          // la "respuesta" del cliente y la "prueba" del servidor: MD5 de la contraseña (el challenge del NAS),
          // el usuario (el token) y los dos retos, en orden distinto (así cada lado prueba que sabe la contraseña)
          const pw = md5(s.challenge), esp = ' '.repeat(48);
          const esperada = md5(pw + esp + datos.authtoken + datos.challenge + reto + pw);
          if (esperada !== datos.response) log('gpcm', `respuesta distinta (esperaba ${esperada}, llegó ${datos.response})`);
          const prueba = md5(pw + esp + datos.authtoken + reto + datos.challenge + pw);
          perfil = s.perfil || (s.perfil = perfilPara(s.userid, s.gsbrcd));
          const viejo = perfiles.get(perfil);
          if (viejo?.con && viejo.con !== con) viejo.con.cerrar?.();   // la misma consola entra de nuevo: fuera la conexión vieja
          perfiles.set(perfil, { ...(viejo || {}), nick: apodoPara(perfil), estado: '', con, userid: s.userid || perfil, ip: con.par.ip >>> 0 });
          log('gpcm', `login perfil ${perfil} (gamename ${datos.gamename}, partnerid ${datos.partnerid})`);
          con.enviar(escribirGs([['lc', 2], ['sesskey', Math.floor(Math.random() * 1e8)], ['proof', prueba], ['userid', s.userid || perfil],
            ['profileid', perfil], ['uniquenick', perfiles.get(perfil).nick], ['lt', azar(22) + '__'], ['id', datos.id || 1]]));
          // como los servidores de GameSpy: enseguida, la lista de amigos y la de bloqueados (vacías por ahora)
          con.enviar(escribirGs([['bdy', 0], ['list', '']]));
          con.enviar(escribirGs([['blk', 0], ['list', '']]));
        } else if (orden === 'wl:report') {
          // informes de Retro Rewind (como los de Retro WFC): su usuario (Mii), la pista y cc elegidos y, al terminar
          // cada carrera, su VR y BR (\wl:mkw_vrbr\vr=N|br=N). Sin respuesta
          const vb = extraerVrbr(msg);
          if (vb && perfiles.has(perfil)) {
            perfiles.get(perfil).vrbr = vb;
            log('vr', `el perfil ${perfil} informa VR ${vb.vr} / BR ${vb.br}`);
            alVr?.({ perfil, ip: perfiles.get(perfil).ip, ...vb });
          } else if (globalThis.mkwWfcCrudo) log('gpcm', `informe: ${msg.slice(0, 120)}`);
        } else if (orden === 'ka') {
          con.enviar(escribirGs([['ka', '']]));
        } else if (orden === 'status') {
          if (perfiles.has(perfil)) perfiles.get(perfil).estado = datos.statstring || '';
        } else if (orden === 'getprofile') {
          // el perfil (\pi\): el juego lee el suyo para comprobar que quedaron guardados su firstname (el código de
          // amigo de la Wii) y su lastname (su código de juego) que mandó con updatepro. De otro, se tapa lo privado
          const pid = +datos.profileid, p = perfiles.get(pid) || {}, propio = pid === perfil;
          const tapado = '000000000' + String(p.lastname || '0000').slice(9, 13).padEnd(4, '0') + '0000000';
          con.enviar(escribirGs([['pi', ''], ['profileid', datos.profileid], ['nick', propio ? p.nick || '' : tapado],
            ['userid', propio ? p.userid || pid : 0], ['email', propio ? '' : tapado + '@nds'], ['sig', azar(32, '0123456789abcdef')],
            ['uniquenick', propio ? p.nick || '' : tapado], ['firstname', p.firstname || ''], ['lastname', propio ? p.lastname || '' : tapado],
            ['pid', 11], ['lon', '0.000000'], ['lat', '0.000000'], ['loc', ''], ['id', datos.id || 2]]));
        } else if (orden === 'updatepro') {
          // el juego guarda datos de su perfil (su código de amigo de la Wii, su código de juego): sin respuesta
          if (perfiles.has(perfil)) Object.assign(perfiles.get(perfil), datos);
        } else if (orden === 'logout') {
          perfiles.delete(perfil); con.cerrar();
        } else log('gpcm', `orden ${orden} — sin manejar: ${msg.slice(0, 200)}`);
      }
    });
    con.alCerrar(() => { perfiles.delete(perfil); });
  });
  // GPSP (búsquedas de perfiles): "¿cuáles de estos perfiles existen?" (otherslist) → la lista de los que conozco
  pila.servidorTcp(29901, con => {
    let buf = '';
    con.alRecibir(b => {
      buf += texto.decode(b);
      let i;
      while ((i = buf.indexOf('\\final\\')) >= 0) {
        const msg = buf.slice(0, i + 7); buf = buf.slice(i + 7);
        const { orden, datos } = leerGs(msg);
        if (orden === 'otherslist') {
          const pedidos = (datos.opids || '').split('|').map(Number).filter(p => perfiles.has(p));
          const pares = [['otherslist', '']];
          for (const p of pedidos) pares.push(['o', p], ['uniquenick', perfiles.get(p).nick]);
          pares.push(['oldone', '']);
          con.enviar(escribirGs(pares));
        } else log('gpsp', `orden ${orden} — sin manejar: ${msg.slice(0, 200)}`);
      }
    });
  });
  // la lista de salas (wfc-salas.mjs). Un mensaje de una consola para otra se entrega por QR2 como "mensaje de
  // cliente": FE FD 06 [sesión][número de mensaje: 4 bytes][mensaje]; la consola contesta 0x07 (recibido)
  let numeroMensaje = 1;
  servidorSalas({ pila, qr2, registro, enviarMensaje: (clave, mensaje) => {
    const ses = qr2.get(clave); if (!ses) return;
    const [ip, puerto] = clave.split(':').map(Number);
    udpQr2.enviar(unir(cabeceraQr2(0x06, ses.sesion), Uint8Array.of(0, 0, 0, numeroMensaje++ & 255), mensaje), ip >>> 0, puerto);
  } });
  return { perfiles, sesiones, qr2, almacen };
}
