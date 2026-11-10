// El árbitro de la sala de Mario Kart en un servidor (bitácora §236): un programa de Node que hace de AUTORIDAD de la
// carrera sincronizada (el «árbitro» de §191) para cada sala que se le conecta.
//
// Resumen: cada página de la sala abre un WebSocket (wss://…) con este programa. El programa corre, por cada sala, el
// MISMO lockstep.mjs que corren las páginas, como un participante más sin kart (el mando 12, SERVIDOR): recibe los
// botones de todos, escribe en cada cuadro la «hoja» con los botones de todos (los que le llegaron a tiempo; los que no,
// inventados como siempre) y la reparte. Como un tablero de control central: cada estación manda su lectura al tablero,
// y el tablero reparte a todas la misma planilla de ese instante. Si el servidor se calla, el lockstep de las páginas
// hace lo de siempre con una autoridad que se cae: la pausa a los 150 ms (o la corta al segundo si su WebSocket se
// cerró) y el papel pasa al «suplente», una PC de la sala que ya venía recibiendo los botones de todos.
//
// Lo que entiende (por el WebSocket):
//   - la dirección: wss://<dominio>/?sala=<id>&uid=<quién>&clave=<clave>   (la clave = la de arbitro.json; vacía = sin clave)
//   - texto (JSON): {t:'hola', humanos:[{uid, mando}]} al conectar → contesta {t:'listo', v:1};
//                   {t:'carrera', n, fuera:[mandos], humanos:[…]} = la sala empieza la carrera n con el servidor de árbitro;
//                   {t:'saltar', m, k} = el mando m se salta la carrera k (recargó);
//                   {t:'ping'} → {t:'pong'} comprueba que la aplicación responde aunque nadie esté corriendo.
//   - binario: los paquetes del lockstep (empiezan con 0xA7), en los dos sentidos.
//   - GET / (http o https) = «ok» y cuántas salas hay (para ver desde el navegador que está vivo).
//
// Uso:  node servidor.mjs                       (escucha en 127.0.0.1:8443, sin TLS: detrás de Caddy, que pone el TLS)
//       MKW_ARBITRO_PUERTO=8443 MKW_ARBITRO_HOST=0.0.0.0 MKW_ARBITRO_CLAVE=… node servidor.mjs
//       MKW_ARBITRO_CERT=/ruta/fullchain.pem MKW_ARBITRO_LLAVE=/ruta/privkey.pem node servidor.mjs   (TLS propio)
//       MKW_ARBITRO_PRUEBAS=1 = abre /__control (solo pruebas: callar o tumbar una sala, contar)
// Desde otro programa (el banco): import { crearServidorArbitro } from './servidor.mjs'; const s = await crearServidorArbitro({ puerto: 0 });
//
// Sin dependencias: el WebSocket (RFC 6455) va escrito aquí, así en la máquina de Oracle basta con Node. lockstep.mjs se
// busca al lado de este archivo (como se copia a la VM) o en web/navegador/ (en esta carpeta del proyecto).
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const rutaLockstep = [path.join(aqui, 'lockstep.mjs'), path.join(aqui, '..', '..', 'web', 'navegador', 'lockstep.mjs')].find(f => fs.existsSync(f));
if (!rutaLockstep) throw new Error('falta lockstep.mjs (cópialo al lado de servidor.mjs)');
const { crearLockstep, SERVIDOR, MARCA } = await import(pathToFileURL(rutaLockstep).href);

export const UID_SERVIDOR = 'servidor';       // el «uid» del servidor en la lista del lockstep (igual en todas las páginas)
const NEUTRO = [0, 0, 0, 0, 0, 0, 0];
const MAX_SALAS = 64, MAX_POR_SALA = 12, MAX_MENSAJE = 64 * 1024;
const SALA_VACIA_MS = 60000;                  // una sala sin nadie conectado se cierra al minuto
const LATIDO_WS_MS = 5000, SIN_PONG_MS = 15000;
const GUID_WS = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';   // el número fijo del protocolo WebSocket (RFC 6455)

// ---- el WebSocket, lo mínimo: el saludo HTTP y los marcos ----
// Un marco: 1 byte (FIN + tipo), 1 byte (máscara + largo), el largo extendido (16 o 64 bits), la máscara (4 bytes, solo
// de la página al servidor) y los datos. Tipos: 1 texto, 2 binario, 8 cerrar, 9 ping, 10 pong, 0 continuación.
function marco(tipo, datos) {
  const n = datos.length;
  const cab = n < 126 ? Buffer.from([0x80 | tipo, n]) : n < 65536 ? Buffer.from([0x80 | tipo, 126, n >> 8, n & 255])
    : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | tipo; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([cab, datos]);
}
function aceptarWs(pedido, enchufe, sobrante, alMensaje, alCerrar) {
  const llave = pedido.headers['sec-websocket-key'];
  if (typeof llave !== 'string' || Buffer.from(llave, 'base64').length !== 16 ||
      pedido.headers['sec-websocket-version'] !== '13' || String(pedido.headers.upgrade || '').toLowerCase() !== 'websocket') {
    enchufe.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return null;
  }
  const acepta = crypto.createHash('sha1').update(llave + GUID_WS).digest('base64');
  enchufe.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acepta}\r\n\r\n`);
  enchufe.setNoDelay(true);                   // sin juntar paquetes chicos (Nagle): cada cuadro sale enseguida
  let resto = Buffer.alloc(0), partes = [], largoPartes = 0, tipoPartes = 0, cerrado = false, ultimoPong = Date.now();
  const ws = {
    abierto: () => !cerrado,
    enviar(datos) {
      if (cerrado) return;
      if (enchufe.writableLength > 4 * MAX_MENSAJE) return ws.tumbar();
      const bin = typeof datos !== 'string';
      enchufe.write(marco(bin ? 2 : 1, bin ? Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength) : Buffer.from(datos)));
    },
    cerrar(codigo = 1000) { if (cerrado) return; const b = Buffer.alloc(2); b.writeUInt16BE(codigo); try { enchufe.write(marco(8, b)); } catch {} terminar(); },
    tumbar() { terminar(); enchufe.destroy(); },
  };
  const terminar = () => { if (cerrado) return; cerrado = true; clearInterval(latido); try { enchufe.end(); } catch {} alCerrar(); };
  const latido = setInterval(() => {
    if (Date.now() - ultimoPong > SIN_PONG_MS) return ws.tumbar();
    try { enchufe.write(marco(9, Buffer.alloc(0))); } catch {}
  }, LATIDO_WS_MS);
  function recibir(trozo) {
    if (cerrado) return;
    resto = resto.length ? Buffer.concat([resto, trozo]) : trozo;
    for (;;) {
      if (resto.length < 2) return;
      const fin = resto[0] & 0x80, tipo = resto[0] & 15, conMascara = resto[1] & 0x80;
      let n = resto[1] & 127, o = 2;
      if (n === 126) { if (resto.length < 4) return; n = resto.readUInt16BE(2); o = 4; }
      else if (n === 127) { if (resto.length < 10) return; const g = resto.readBigUInt64BE(2); if (g > BigInt(MAX_MENSAJE)) return ws.cerrar(1009); n = Number(g); o = 10; }
      if (n > MAX_MENSAJE) return ws.cerrar(1009);
      if (!conMascara || resto[0] & 0x70 || (tipo >= 8 && (!fin || n > 125))) return ws.cerrar(1002);
      if (resto.length < o + 4 + n) return;
      const mascara = resto.subarray(o, o + 4), datos = Buffer.from(resto.subarray(o + 4, o + 4 + n));
      for (let i = 0; i < n; i++) datos[i] ^= mascara[i & 3];
      resto = resto.subarray(o + 4 + n);
      if (tipo === 8) return ws.cerrar();
      if (tipo === 9) { try { enchufe.write(marco(10, datos)); } catch {} continue; }
      if (tipo === 10) { ultimoPong = Date.now(); continue; }
      ultimoPong = Date.now();                      // (cualquier mensaje también dice que está)
      if ((tipo === 0 && !tipoPartes) || ((tipo === 1 || tipo === 2) && tipoPartes) || tipo > 2) return ws.cerrar(1002);
      if (tipo) tipoPartes = tipo;
      largoPartes += datos.length;
      if (largoPartes > MAX_MENSAJE || partes.length >= 1024) return ws.cerrar(1009);
      partes.push(datos);
      if (!fin) continue;
      const todo = partes.length === 1 ? partes[0] : Buffer.concat(partes, largoPartes), esTexto = tipoPartes === 1;
      partes = []; largoPartes = 0; tipoPartes = 0;
      try { alMensaje(esTexto ? todo.toString('utf8') : new Uint8Array(todo.buffer, todo.byteOffset, todo.byteLength)); }
      catch (e) { console.error('[arbitro] mensaje:', e?.message || e); }
    }
  }
  enchufe.on('data', recibir);
  if (sobrante.length) queueMicrotask(() => recibir(sobrante));
  enchufe.on('close', terminar); enchufe.on('error', terminar);
  return ws;
}

// ---- una sala: su lockstep (el servidor como autoridad) y el bucle de cuadros ----
function crearSalaArbitro(id, { registro, ahora }) {
  const clientes = new Map();                 // uid → ws
  let humanos = null, ls = null, cuadro = 0, reiniciar = false, corriendo = false, callada = false, vaciaDesde = ahora();
  let carreraMayor = 0, botonesHasta = -1;
  let yaVisto = false;                        // §250: alguna página ya dijo «¡YA!» en esta carrera (fin de la cuenta)
  const anotar = t => registro(`[${id}] ${t}`);
  const listaValida = hs => Array.isArray(hs) && hs.length >= 1 && hs.length <= MAX_POR_SALA &&
    hs.every(h => h && typeof h.uid === 'string' && h.uid.length <= 64 && h.uid !== UID_SERVIDOR && Number.isInteger(h.mando) && h.mando >= 0 && h.mando < SERVIDOR) &&
    new Set(hs.map(h => h.uid)).size === hs.length && new Set(hs.map(h => h.mando)).size === hs.length;
  function armar(hs) {
    // (el servidor PRIMERO en la lista, igual que en las páginas: así el orden es el mismo en todas aunque alguien se
    // sume después —§110, agregar pone al final—, y el servidor decide los cortes de quien se va mientras vive)
    humanos = [{ uid: UID_SERVIDOR, mando: SERVIDOR }, ...hs.map(h => ({ uid: h.uid, mando: h.mando }))];
    ls = crearLockstep({ yo: UID_SERVIDOR, humanos, local: () => NEUTRO, arbitro: true, retraso: 1, adaptar: false,
      // los mismos márgenes que la página en la sala (mkw.mjs): 2 s de corte, 15 s en la largada
      esperaCorte: 2000, esperaLargada: 15000,
      // §250, la largada pareja: el servidor no lee la memoria del juego, así que no sabe cuándo es el «¡YA!»: se lo
      // avisa la primera página que llega a él ({t:'ya'}). Hasta ese aviso (y como mucho los primeros 600 cuadros) no
      // inventa los botones de nadie: espera a que lleguen los de todos, con el margen de la largada de arriba
      enCuenta: () => !yaVisto, largadaPareja: process.env.MKW_ARBITRO_LARGADA_PAREJA !== '0',   // (=0: como antes, solo pruebas)
      enviar: (uid, b) => { if (!callada) clientes.get(uid)?.enviar(b); },
      // una página «se fue» si su WebSocket se cerró (además de no oírse hace 1 s: eso lo mira el lockstep)
      ido: uid => !clientes.get(uid)?.abierto(),
      // lo que puede el servidor: mucho margen por cuadro, buena subida, no es un teléfono
      capacidad: () => ({ margen: 14, subida: 50000, telefono: false }),
      registro: t => anotar(t) });
    anotar(`sala nueva con ${hs.length} pilotos: ${hs.map(h => h.uid).join(', ')}`);
  }
  // El reloj del servidor sigue los botones que llegan. Si se adelantara por su cuenta a un juego que todavía carga
  // o corre a menos de 60, inventaría sus botones aunque la red funcione. El piloto más avanzado marca el paso.
  async function correr() {
    if (corriendo) return; corriendo = true;
    try {
      while (ls) {
        if (reiniciar) { reiniciar = false; cuadro = 0; }
        if (callada || cuadro + 2 > botonesHasta) break;
        await ls.pad(cuadro++);
        if (cuadro % 8 === 0) await dormir(0);
      }
    } finally {
      corriendo = false;
    }
  }
  return {
    id, clientes,
    conectar(uid, ws) { const viejo = clientes.get(uid); if (viejo && viejo !== ws) viejo.cerrar(4000); clientes.set(uid, ws); vaciaDesde = null; },
    desconectar(uid, ws) { if (clientes.get(uid) === ws) clientes.delete(uid); if (!clientes.size) vaciaDesde = ahora(); },
    texto(uid, m) {
      if (m.t === 'hola') {
        if (!listaValida(m.humanos) || !m.humanos.some(h => h.uid === uid)) return { t: 'error', motivo: 'lista de pilotos inválida' };
        if (!ls) armar(m.humanos); else for (const h of m.humanos) ls.agregar(h);   // (los que llegaron después: §110)
        return { t: 'listo', v: 1, sala: id };
      }
      if (!ls) return null;
      if (m.t === 'ping') return callada ? null : { t: 'pong' };
      if (m.t === 'carrera' && Number.isInteger(m.n) && m.n >= 1 && m.n <= 32) {
        if (!listaValida(m.humanos) || !m.humanos.some(h => h.uid === uid)) return null;
        for (const h of m.humanos) ls.agregar(h);
        if (m.n <= carreraMayor) return null;       // (la mandan todas las páginas: vale la primera)
        carreraMayor = m.n;
        botonesHasta = -1;
        yaVisto = false;
        const fuera = Array.isArray(m.fuera) ? m.fuera.filter(x => Number.isInteger(x) && x >= 0 && x < SERVIDOR) : [];
        ls.fijarCarrera(m.n, fuera, SERVIDOR);
        reiniciar = true;
        anotar(`carrera ${m.n}: soy el árbitro${fuera.length ? `; fuera ${fuera.join(', ')}` : ''}`);
        return null;
      }
      // §250: «en esta carrera ya largamos» (la página lo vio en la memoria del juego: la etapa de la carrera pasó a 2)
      if (m.t === 'ya' && m.n === carreraMayor) { if (!yaVisto) anotar(`carrera ${m.n}: ¡YA! en el cuadro ${m.c} (lo dijo ${uid})`); yaVisto = true; return null; }
      if (m.t === 'saltar' && Number.isInteger(m.m) && Number.isInteger(m.k)) ls.saltar(m.m, m.k);
      return null;
    },
    binario(uid, b) {
      if (!ls || callada || b[0] !== MARCA || b.length < 8 || b[3] > SERVIDOR) return;
      ls.alBinario(uid, b);
      // Tipo 15: el dueño manda su ventana de botones. Los pings y reenvíos no adelantan el reloj.
      if (b[1] !== 15 || b[2] !== (carreraMayor & 255) || !carreraMayor || b.length < 16 ||
          !humanos.some(h => h.uid === uid && h.mando === b[3])) return;
      const inicio = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(4);
      const fin = inicio + b[8] - 1;
      if (fin > (reiniciar ? 120 : cuadro + 120)) return;
      botonesHasta = Math.max(botonesHasta, fin);
      correr().catch(e => anotar(e.stack || String(e)));
    },
    vacia: () => vaciaDesde !== null && ahora() - vaciaDesde > SALA_VACIA_MS,
    cerrar() { const l = ls; ls = null; l?.detener(); for (const ws of clientes.values()) ws.cerrar(1001); },
    // (solo pruebas) callar = deja de contestar y de mandar, con los WebSocket abiertos (como una máquina colgada);
    // tumbar = corta todos los WebSocket de golpe (como si se apagara)
    callar(si = true) { callada = si; anotar(si ? 'me callo (prueba)' : 'vuelvo a hablar (prueba)'); },
    tumbar() { for (const ws of [...clientes.values()]) ws.tumbar(); },
    estado: () => ({ id, clientes: [...clientes.keys()], cuadro, callada, carrera: carreraMayor, lockstep: ls ? ls.estado() : null }),
  };
}
const dormir = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

export async function crearServidorArbitro({ puerto = Number(process.env.MKW_ARBITRO_PUERTO) || 8443, host = process.env.MKW_ARBITRO_HOST || '127.0.0.1',
  clave = process.env.MKW_ARBITRO_CLAVE || '', cert = process.env.MKW_ARBITRO_CERT, llave = process.env.MKW_ARBITRO_LLAVE,
  pruebas = process.env.MKW_ARBITRO_PRUEBAS === '1', registro = t => console.log(new Date().toISOString().slice(11, 23), t), ahora = () => performance.now() } = {}) {
  const salas = new Map();
  const quitarVacias = setInterval(() => { for (const [id, s] of salas) if (s.vacia()) { s.cerrar(); salas.delete(id); registro(`[${id}] sala cerrada (sin nadie)`); } }, 10000);
  const atender = (pedido, respuesta) => {
    const url = new URL('http://local/' + pedido.url.replace(/^\/+/, ''));
    if (pruebas && url.pathname === '/__control') {
      // solo pruebas: ?sala=id&que=callar|hablar|tumbar|estado
      const s = salas.get(url.searchParams.get('sala') || ''), que = url.searchParams.get('que');
      if (s && que === 'callar') s.callar(true); else if (s && que === 'hablar') s.callar(false); else if (s && que === 'tumbar') s.tumbar();
      respuesta.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
      return respuesta.end(JSON.stringify(s ? s.estado() : { salas: [...salas.keys()] }));
    }
    respuesta.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
    respuesta.end(`ok: árbitro de Mario Kart, ${salas.size} sala${salas.size === 1 ? '' : 's'}\n`);
  };
  const servidor = cert && llave ? https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(llave) }, atender) : http.createServer(atender);
  servidor.on('upgrade', (pedido, enchufe, sobrante) => {
    const url = new URL('http://local/' + pedido.url.replace(/^\/+/, ''));
    const id = url.searchParams.get('sala') || '', uid = url.searchParams.get('uid') || '';
    const mala = !id || id.length > 80 || !uid || uid.length > 64 || uid === UID_SERVIDOR ? 'falta la sala o el piloto'
      : clave && url.searchParams.get('clave') !== clave ? 'clave equivocada'
      : !salas.has(id) && salas.size >= MAX_SALAS ? 'demasiadas salas' : null;
    if (mala) { registro(`[conexión rechazada] ${mala}`); enchufe.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    let sala = salas.get(id);
    if (!sala) { sala = crearSalaArbitro(id, { registro, ahora }); salas.set(id, sala); }
    if (!sala.clientes.has(uid) && sala.clientes.size >= MAX_POR_SALA) { enchufe.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    let saludo = false;
    const ws = aceptarWs(pedido, enchufe, sobrante, m => {
      if (typeof m === 'string') {
        let j = null; try { j = JSON.parse(m); } catch {}
        const r = j && typeof j === 'object' && (saludo || j.t === 'hola') ? sala.texto(uid, j) : null;
        if (r?.t === 'listo') saludo = true;
        if (r) ws.enviar(JSON.stringify(r));
      } else if (saludo) sala.binario(uid, m);
    }, () => { sala.desconectar(uid, ws); registro(`[${id}] se desconectó ${uid}`); });
    if (!ws) return;
    sala.conectar(uid, ws);
    registro(`[${id}] se conectó ${uid}`);
  });
  await new Promise((listo, falla) => { servidor.once('error', falla); servidor.listen(puerto, host, listo); });
  const p = servidor.address().port;
  registro(`árbitro de Mario Kart en ${cert ? 'wss' : 'ws'}://${host}:${p}/${clave ? ' (con clave)' : ''}${pruebas ? ' — modo pruebas (/__control)' : ''}`);
  return { puerto: p, salas, sala: id => salas.get(id),
    cerrar: () => new Promise(r => { clearInterval(quitarVacias); for (const s of salas.values()) s.cerrar(); salas.clear(); servidor.close(() => r()); servidor.closeAllConnections?.(); }) };
}

// corrido directo (node servidor.mjs): arranca y queda escuchando (systemd lo vuelve a levantar si se cae)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await crearServidorArbitro();
  const salir = () => s.cerrar().then(() => process.exit(0));
  process.on('SIGINT', salir); process.on('SIGTERM', salir);
}
