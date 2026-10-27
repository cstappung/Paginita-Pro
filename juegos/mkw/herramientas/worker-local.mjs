// El Worker de amigos DE VERDAD (el mismo archivo que publica el dueño), corriendo en esta PC — bitácora §65.
//
// Resumen: para ensayar la publicación sin publicar nada. Carga juegos/bt3/fuente/disco/worker.js del sitio (con las
// rutas /mkw/ de Mario Kart) y lo atiende con un servidor de Node en 127.0.0.1 (solo esta PC). Lo que en Cloudflare
// pone la plataforma, aquí lo pone este archivo:
//   - el bucket R2 de Mario Kart (`MKW`, §105): los archivos locales, con las MISMAS llaves que subirá subir-r2.mjs
//     (mkw/manifiesto.json, mkw/version.json, mkw/build/…, mkw/mkw/disco/…, mkw/mkw/sd/…, mkw/wc/runtime/assets/…);
//     el manifiesto y las versiones se arman al arrancar, como en servidor.mjs. Un rango que pasa del final se
//     rechaza (como el caso más estricto de R2), así se ensaya también el camino de "medir y recortar" del Worker;
//   - las claves de Google: un par de claves generado al arrancar (el Worker las pide a googleapis: se le contesta con
//     la nuestra), y `/__token-prueba` firma un token de Firebase de mentira para `amigo-local` (el único de AMIGOS).
//     Esa dirección existe SOLO en este arnés, no en el Worker;
//   - la red: --latencia ms antes de cada respuesta (la ida y vuelta hasta R2, ~50 ms).
// Con --emulador (el jugar.bat: herramientas/experiencia.mjs, bitácora §69) la página usa los emuladores de Firebase,
// cuyas cuentas de mentira traen tokens SIN firma (alg "none"): este arnés los vuelve a firmar con la clave de mentira,
// con los mismos datos (uid, correo verificado, vencimiento), y el Worker de verdad hace su revisión de siempre: firma,
// proyecto, vencimiento y que el correo esté en AMIGOS (--amigos a@x,b@y). Solo tokens del proyecto del sitio; el
// Worker publicado no cambia (en Cloudflare un token sin firma se rechaza).
// Así el ensayo usa el código que se publica, con su revisión de token y lista, sus cabeceras, Range y brotli.
//
// Uso:  node herramientas/worker-local.mjs [--puerto 8151] [--origen http://127.0.0.1:8150] [--latencia 50]
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { armarDiminutos } from './diminutos.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PUERTO = Number(opcion('--puerto', 8151));
const ORIGEN = opcion('--origen', 'http://127.0.0.1:8150');
const LATENCIA = Number(opcion('--latencia', 50));
const BUILD = path.join(raiz, process.env.MKW_BUILD || 'build/web/navegador');
const AMIGO = 'amigo-local';
const AMIGOS = opcion('--amigos', AMIGO);                     // correos o uids con acceso, separados por comas
const EMULADOR = args.includes('--emulador');

// llave de R2 → carpeta local (las mismas rutas que servidor.mjs, con "mkw/" delante)
const CARPETAS = [
  ['mkw/mkw/disco/', path.join(raiz, 'extraido/disco')],
  ['mkw/mkw/sd/RetroRewind6/', path.join(raiz, 'terceros/RetroRewind/RetroRewind6')],
  ['mkw/mkw/sd/riivolution/', path.join(raiz, 'terceros/RetroRewind/riivolution')],
  ['mkw/wc/runtime/assets/', path.join(raiz, 'terceros/Wiicompiled/runtime/assets')],
  ['mkw/build/', BUILD],
];

// ---- el manifiesto y las versiones (como servidor.mjs) ----
function lista(carpeta, base = carpeta, salida = [], huella = null) {
  const entradas = fs.readdirSync(carpeta, { withFileTypes: true });
  if (entradas.length === 0 && carpeta !== base) salida.push([path.relative(base, carpeta).split(path.sep).join('/'), -1]);
  for (const e of entradas) {
    const p = path.join(carpeta, e.name);
    if (e.isDirectory()) lista(p, base, salida, huella);
    else if (e.isFile()) {
      const st = fs.statSync(p), ruta = path.relative(base, p).split(path.sep).join('/');
      salida.push([ruta, st.size]);
      if (huella) huella.update(`${ruta}|${st.size}|${st.mtimeMs};`);
    }
  }
  return salida;
}
const manifiesto = {}, huella = crypto.createHash('sha1');
for (const [llave, carpeta] of CARPETAS.slice(0, 4)) {
  const prefijo = llave.slice(3);                                   // "mkw/mkw/disco/" → "/mkw/disco/" (lo que ve el juego)
  huella.update('/' + prefijo.replace(/^\//, ''));
  manifiesto['/' + prefijo.replace(/^\//, '')] = lista(carpeta, carpeta, [], huella);
}
const huellaBuild = crypto.createHash('sha1');
for (const f of ['mkw.js', 'mkw.wasm']) { try { const st = fs.statSync(path.join(BUILD, f)); huellaBuild.update(`${f}|${st.size}|${st.mtimeMs};`); } catch {} }
const VERSION = { version: huella.digest('hex').slice(0, 16), build: huellaBuild.digest('hex').slice(0, 16) };
const generados = new Map([['mkw/manifiesto.json', Buffer.from(JSON.stringify(manifiesto))], ['mkw/version.json', Buffer.from(JSON.stringify(VERSION))],
  // §93 (E2): el paquete de los diminutos, como lo sube subir-r2.mjs (armado aquí desde los mismos archivos)
  ['mkw/build/diminutos.bin', armarDiminutos(CARPETAS.slice(0, 4).map(([llave, carpeta]) => ['/' + llave.slice(4), carpeta]))]]);

// ---- el bucket falso ----
function archivoDe(llave) {
  const par = CARPETAS.find(([p]) => llave.startsWith(p));
  if (!par) return null;
  const f = path.normalize(path.join(par[1], llave.slice(par[0].length)));
  if (!f.startsWith(par[1])) return null;
  // el .br solo "está subido" si es del mismo programa (no más viejo que el .wasm), como en servidor.mjs
  if (f.endsWith('.br')) { try { if (fs.statSync(f).mtimeMs < fs.statSync(f.slice(0, -3)).mtimeMs) return null; } catch { return null; } }
  return f;
}
const R2 = {
  operaciones: 0,
  async head(llave) {
    R2.operaciones++;
    if (generados.has(llave)) return { size: generados.get(llave).length };
    const f = archivoDe(llave);
    try { const st = f && await fsp.stat(f); return st && st.isFile() ? { size: st.size } : null; } catch { return null; }
  },
  async get(llave, o = {}) {
    R2.operaciones++;
    let datos = generados.get(llave), tam;
    const f = datos ? null : archivoDe(llave);
    if (!datos) { try { const st = f && await fsp.stat(f); if (!st || !st.isFile()) return null; tam = st.size; } catch { return null; } }
    else tam = datos.length;
    let inicio = 0, largo = tam;
    if (o.range) {
      inicio = o.range.offset || 0; largo = o.range.length ?? tam - inicio;
      if (inicio >= tam || inicio + largo > tam) throw new Error('rango fuera del objeto');
    }
    if (datos) return { body: datos.subarray(inicio, inicio + largo), size: tam };
    const h = await fsp.open(f, 'r');
    try { const b = Buffer.alloc(largo); await h.read(b, 0, largo, inicio); return { body: b, size: tam }; } finally { await h.close(); }
  },
  async put() { throw new Error('este bucket es de solo lectura'); },
};

// ---- las claves de Google (de mentira) y el token de prueba ----
const { webcrypto } = crypto;
const par = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await webcrypto.subtle.exportKey('jwk', par.publicKey), kid: 'local', alg: 'RS256', use: 'sig' };
const fetchReal = globalThis.fetch;
globalThis.fetch = async (u, o) => String(u).startsWith('https://www.googleapis.com/service_accounts/')
  ? new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'max-age=3600' } }) : fetchReal(u, o);
const b64u = b => Buffer.from(b).toString('base64url');
async function tokenDePrueba(uid) {
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64u(JSON.stringify({ alg: 'RS256', kid: 'local', typ: 'JWT' }));
  const cue = b64u(JSON.stringify({ aud: 'mi-pagina-pro', iss: 'https://securetoken.google.com/mi-pagina-pro', sub: uid, iat: ahora - 5, exp: ahora + 3600 }));
  const firma = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, new TextEncoder().encode(cab + '.' + cue));
  return cab + '.' + cue + '.' + b64u(firma);
}

// Un token de los emuladores de Firebase (sin firma) → el mismo, firmado con la clave de mentira (solo con --emulador)
async function firmarDelEmulador(autorizacion) {
  const m = /^Bearer (.+)$/.exec(autorizacion || '');
  if (!m) return autorizacion;
  const [c, p] = m[1].split('.');
  try {
    const cab = JSON.parse(Buffer.from(c, 'base64url')), datos = JSON.parse(Buffer.from(p, 'base64url'));
    if (cab.alg !== 'none' || datos.aud !== 'mi-pagina-pro' || datos.iss !== 'https://securetoken.google.com/mi-pagina-pro') return autorizacion;
    const cab2 = b64u(JSON.stringify({ alg: 'RS256', kid: 'local', typ: 'JWT' }));
    const cue2 = b64u(JSON.stringify({ ...datos, sub: datos.sub || datos.user_id }));
    const firma = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, new TextEncoder().encode(cab2 + '.' + cue2));
    return 'Bearer ' + cab2 + '.' + cue2 + '.' + b64u(firma);
  } catch { return autorizacion; }
}

// ---- el Worker ----
const archivoWorker = path.join(raiz, 'terceros/Paginita-Pro/juegos/bt3/fuente/disco/worker.js');
const W = (await import(pathToFileURL(archivoWorker).href)).default;
// §105: Mario Kart en su propio bucket (el enlace MKW); el de BT3 (DISCO), vacío: aquí no se sirve la ISO
const env = { AMIGOS, ORIGENES: ORIGEN, MKW: R2, DISCO: { get: async () => null, head: async () => null, put: async () => {} } };
// cada pedido atendido (para medir cuántas llamadas gasta una visita: el plan gratis de Workers da 100.000 al día):
// [ms desde el arranque, método, ruta sin la consulta, bytes pedidos por Range ('' si es el archivo entero), estado]
const contador = { pedidos: 0, preguntas: 0, porEstado: {}, lista: [] };
const t0Contador = Date.now();
const PASAN = ['origin', 'authorization', 'range', 'accept-encoding', 'access-control-request-method', 'access-control-request-headers', 'content-type'];

http.createServer(async (pedido, respuesta) => {
  try {
    if (pedido.url.startsWith('/__token-prueba')) {                // solo en este arnés
      const uid = new URL(pedido.url, 'http://x').searchParams.get('uid') || AMIGO;
      respuesta.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ORIGEN, 'Cache-Control': 'no-store' });
      return respuesta.end(JSON.stringify({ token: await tokenDePrueba(uid) }));
    }
    if (pedido.url.split('?')[0] === '/__cuenta') {                              // cuántos pedidos atendió (para medir)
      respuesta.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ORIGEN });
      const { lista, ...resto } = contador;
      return respuesta.end(JSON.stringify({ ...resto, r2: R2.operaciones, ...(new URL(pedido.url, 'http://x').searchParams.has('lista') ? { lista } : {}) }));
    }
    const cab = {};
    for (const k of PASAN) if (pedido.headers[k]) cab[k] = pedido.headers[k];
    if (EMULADOR && cab.authorization) cab.authorization = await firmarDelEmulador(cab.authorization);
    // (§104: el POST del lote trae su cuerpo)
    const cuerpo = pedido.method === 'POST' || pedido.method === 'PUT' ? await new Promise(listo => { const t = []; pedido.on('data', d => t.push(d)); pedido.on('end', () => listo(Buffer.concat(t))); }) : undefined;
    const req = new Request(`http://127.0.0.1:${PUERTO}${pedido.url}`, { method: pedido.method, headers: cab, body: cuerpo });
    await new Promise(r => setTimeout(r, LATENCIA));
    const r = await W.fetch(req, env, { waitUntil() {} });
    contador.pedidos++; if (pedido.method === 'OPTIONS') contador.preguntas++;
    contador.porEstado[r.status] = (contador.porEstado[r.status] || 0) + 1;
    const rg = /^bytes=(\d+)-(\d+)$/.exec(cab.range || '');
    if (contador.lista.length < 50000) contador.lista.push([Date.now() - t0Contador, pedido.method, pedido.url.split('?')[0], rg ? rg[2] - rg[1] + 1 : '', r.status]);
    const salida = {};
    r.headers.forEach((v, k) => { salida[k] = v; });
    respuesta.writeHead(r.status, salida);
    if (r.body && pedido.method !== 'HEAD') for await (const trozo of r.body) respuesta.write(trozo);
    respuesta.end();
  } catch (e) {
    console.error('[worker-local]', e);
    if (!respuesta.headersSent) respuesta.writeHead(500);
    respuesta.end(String(e));
  }
}).listen(PUERTO, '127.0.0.1', () => {
  console.log(`worker (el de verdad: ${path.relative(raiz, archivoWorker)}, ${LATENCIA} ms por pedido) en http://127.0.0.1:${PUERTO}/mkw  (amigos: ${AMIGOS}${EMULADOR ? '; con los tokens de los emuladores de Firebase' : ''}; origen permitido ${ORIGEN})`);
  console.log(`versión de los archivos ${VERSION.version}, programa ${VERSION.build}; ${Object.values(manifiesto).reduce((a, l) => a + l.length, 0)} archivos`);
});
