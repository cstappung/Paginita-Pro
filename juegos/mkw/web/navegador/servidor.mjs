// Servidor local para jugar/probar Mario Kart Wii + Retro Rewind en el navegador: http://127.0.0.1:8140/
//
// Resumen: el juego compilado (build/web/navegador/mkw.wasm) y los archivos del disco son privados (son de
// Nintendo y de Retro Rewind): NO van al banco ni a internet. Este servidor solo escucha en la propia PC
// (127.0.0.1, ninguna otra máquina puede entrar) y entrega:
//   /                      la página del juego (web/navegador/index.html y mkw.mjs)
//   /banco/...             el estilo y las ayudas comunes del banco (para que la página se vea igual)
//   /build/mkw.js|.wasm    el juego compilado para el navegador
//   /manifiesto.json       la lista de TODOS los archivos (ruta y tamaño) que el juego verá en su disco
//   /mkw/disco/...         el disco extraído           (extraido/disco)
//   /mkw/sd/RetroRewind6/  los archivos de Retro Rewind (terceros/RetroRewind/RetroRewind6)
//   /mkw/sd/riivolution/   la partida guardada de RR    (terceros/RetroRewind/riivolution)
//   /wc/runtime/assets/    archivos base del runtime    (terceros/Wiicompiled/runtime/assets)
// Las rutas /mkw/... y /wc/... son las mismas que el juego usa adentro de su sistema de archivos de mentira,
// así la página traduce "archivo que el juego pide" → "dirección que se descarga" sin tablas.
//
// "Range": el navegador puede pedir solo un pedazo de un archivo (cabecera `Range: bytes=INICIO-FIN`), como
// leer una sola página de un libro sin traer el libro entero. El juego lee así los archivos grandes del disco.
//
// Uso:  node web/navegador/servidor.mjs        (o con otro puerto: node web/navegador/servidor.mjs 8141)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { armarDiminutos } from '../../herramientas/diminutos.mjs';   // §93: el paquete de los diminutos

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUERTO = Number(process.argv[2]) || 8140;
const LATENCIA = Number(process.env.MKW_LATENCIA) || 0;   // ms extra por pedido a /mkw/ (simular la red del sitio)
// MKW_CORS=http://127.0.0.1:8150: este servidor hace de "Worker de amigos" para una página de OTRO origen (el sitio
// local de herramientas/sitio-local.mjs), como será en paginita-pro.cl: la página en GitHub Pages y lo privado (juego
// y disco) en el Worker. Solo ese origen puede leer las respuestas (CORS: el permiso que da un servidor para que una
// página de otro sitio lea lo que responde); sin la variable, nadie de afuera. La latencia cuenta entonces para todo
// lo privado (/build/, /manifiesto.json, /mkw/, /wc/), no solo para el disco.
const CORS = process.env.MKW_CORS || '';
const PRIVADO = /^\/(build|mkw|wc)\/|^\/manifiesto\.json$/;

// prefijo de la dirección → carpeta real en el PC
const CARPETAS = [
  ['/mkw/disco/', path.join(raiz, 'extraido/disco')],
  ['/mkw/sd/RetroRewind6/', path.join(raiz, 'terceros/RetroRewind/RetroRewind6')],
  ['/mkw/sd/riivolution/', path.join(raiz, 'terceros/RetroRewind/riivolution')],
  ['/wc/runtime/assets/', path.join(raiz, 'terceros/Wiicompiled/runtime/assets')],
  ['/build/', path.join(raiz, process.env.MKW_BUILD || 'build/web/navegador')],   // MKW_BUILD: otro build (p. ej. build/web-sin-simd/navegador)
  ['/banco/', path.join(raiz, 'banco')],
  ['/web/', path.join(raiz, 'web')],
  ['/', path.join(raiz, 'web/navegador')],
];
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  // las imágenes sacadas del juego para elegir pista y copa (build/…/imagenes: fotos, planos, íconos)
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

// Recorre una carpeta y devuelve [[ruta relativa con "/", tamaño], ...]. Las carpetas vacías van con tamaño -1
// (el juego también las busca: p. ej. RetroRewind6/MyStuff).
function lista(carpeta, base = carpeta, salida = [], huella = null) {
  const entradas = fs.readdirSync(carpeta, { withFileTypes: true });
  if (entradas.length === 0 && carpeta !== base) salida.push([path.relative(base, carpeta).split(path.sep).join('/'), -1]);
  for (const e of entradas) {
    const p = path.join(carpeta, e.name);
    if (e.isDirectory()) lista(p, base, salida, huella);
    else if (e.isFile()) {
      const st = fs.statSync(p), ruta = path.relative(base, p).split(path.sep).join('/');
      salida.push([ruta, st.size]);
      if (huella) huella.update(`${ruta}|${st.size}|${st.mtimeMs};`);   // la fecha también: mismo tamaño, otro contenido
    }
  }
  return salida;
}

// El manifiesto: qué archivos verá el juego y de qué tamaño (se arma una vez, al arrancar el servidor)
// y su VERSIÓN: una huella (SHA-1) de rutas, tamaños y fechas. Si cambia cualquier archivo (otro disco, otra versión
// de Retro Rewind), cambia la versión y la página tira su caché vieja (disco.mjs). Va en la cabecera X-Mkw-Version
// del manifiesto. En el sitio la dará el script que sube los archivos a R2.
const manifiesto = {};
const huella = crypto.createHash('sha1');
for (const [prefijo, carpeta] of CARPETAS.slice(0, 4)) { huella.update(prefijo); manifiesto[prefijo] = lista(carpeta, carpeta, [], huella); }
const manifiestoJson = JSON.stringify(manifiesto);
const VERSION = huella.digest('hex').slice(0, 16);
console.log('versión de los archivos: ' + VERSION);

// El PROGRAMA (mkw.js + mkw.wasm, ~130 MB) va como en BT3: con la dirección "versionada" (?v=huella) y guardable para
// siempre en la caché HTTP del navegador (Cache-Control: immutable). Así la 2.ª visita no lo baja de nuevo, y Chrome
// además guarda el código de máquina ya compilado del .wasm (su "caché de código", que solo funciona si la respuesta
// es guardable): no lo vuelve a compilar. La huella cambia con cada compilación (tamaño y fecha de los dos archivos),
// y viaja en la cabecera X-Mkw-Build del manifiesto. Sin ?v= (o con una huella vieja) va sin caché, como antes.
// En el sitio, el Worker hace lo mismo con los objetos de R2 (bitácora §54).
const carpetaBuild = CARPETAS.find(([p]) => p === '/build/')[1];
const huellaBuild = () => {
  const h = crypto.createHash('sha1');
  for (const f of ['mkw.js', 'mkw.wasm']) { try { const st = fs.statSync(path.join(carpetaBuild, f)); h.update(`${f}|${st.size}|${st.mtimeMs};`); } catch {} }
  return h.digest('hex').slice(0, 16);
};
// Comprimido: el .wasm se guarda y se entrega YA comprimido (mkw.wasm.br, hecho por herramientas/comprimir-build.mjs):
// pesa ~4 veces menos (ningún archivo de más de 100 MB, y se baja más rápido); el navegador lo descomprime solo
// mientras lo compila (Content-Encoding: br). Si no existe (o es más viejo que el .wasm), va sin comprimir.
const comprimido = (archivo, aceptadas) => {
  for (const [ext, nombre] of [['.br', 'br'], ['.gz', 'gzip']]) {
    if (!aceptadas.split(',').some(x => x.split(';')[0].trim() === nombre)) continue;   // "gzip, deflate, br, zstd"
    try { if (fs.statSync(archivo + ext).mtimeMs >= fs.statSync(archivo).mtimeMs) return [archivo + ext, nombre]; } catch {}
  }
  return null;
};
console.log(Object.entries(manifiesto).map(([p, l]) => `${p}: ${l.length} archivos`).join('\n'));

let paqueteDiminutos = null;
http.createServer((pedido, respuesta) => {
  const url = decodeURIComponent(pedido.url.split('?')[0]);
  if (CORS) {
    respuesta.setHeader('Access-Control-Allow-Origin', CORS);
    respuesta.setHeader('Vary', 'Origin');
    respuesta.setHeader('Timing-Allow-Origin', CORS);   // que la página pueda ver los tiempos y tamaños (medir-sitio)
    respuesta.setHeader('Access-Control-Expose-Headers', 'X-Mkw-Version, X-Mkw-Build, Content-Range, Content-Length');
    if (pedido.method === 'OPTIONS') {           // la "pregunta previa" del navegador antes de un pedido con Range
      respuesta.writeHead(204, { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Max-Age': '600' });
      return respuesta.end();
    }
  }
  if (url === '/manifiesto.json') {
    return setTimeout(() => {
      respuesta.writeHead(200, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store', 'X-Mkw-Version': VERSION,
                                 'X-Mkw-Build': huellaBuild() });
      respuesta.end(manifiestoJson);
    }, CORS ? LATENCIA : 0);
  }
  // §93 (E2): el paquete de los archivos diminutos (herramientas/diminutos.mjs), armado aquí desde los mismos archivos
  // que se sirven (nunca queda viejo); ?paquete=0 en la página = sin él
  if (url === '/build/diminutos.bin') {
    paqueteDiminutos ??= armarDiminutos(CARPETAS.slice(0, 4));
    return setTimeout(() => {
      respuesta.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': paqueteDiminutos.length });
      respuesta.end(paqueteDiminutos);
    }, LATENCIA);
  }
  const par = CARPETAS.find(([prefijo]) => url.startsWith(prefijo));
  let archivo = path.normalize(path.join(par[1], url.slice(par[0].length)));
  if (!archivo.startsWith(par[1])) { respuesta.writeHead(403); return respuesta.end('fuera de la carpeta'); }  // nada de "../"
  if (url.endsWith('/')) archivo = path.join(archivo, 'index.html');
  // MKW_LATENCIA=50: cada pedido de los archivos del juego (/mkw/) tarda 50 ms más en empezar, como la red hasta R2
  // en el sitio (aquí, en la misma PC, tarda ~1 ms). Sirve para medir lo que espera el juego de verdad (bitácora §52).
  const demora = (CORS ? PRIVADO.test(url) : url.startsWith('/mkw/')) ? LATENCIA : 0;
  setTimeout(() => fs.stat(archivo, (error, info) => {
    if (error || !info.isFile()) { respuesta.writeHead(404); return respuesta.end('no existe: ' + url); }
    const cabeceras = {
      'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      // Nada en la caché HTTP del navegador: la página y el juego, siempre lo último; los archivos del disco ya los
      // guarda la página en su propia caché (disco.mjs), así no quedan guardados dos veces (igual que el Worker de BT3)
      'Cache-Control': 'no-store',
    };
    // el programa con su huella vigente: guardable para siempre (ver huellaBuild)
    const programa = /^\/build\/mkw\.(js|wasm)$/.test(url);
    const v = new URLSearchParams(pedido.url.split('?')[1] || '').get('v');
    if (programa && v && v === huellaBuild()) cabeceras['Cache-Control'] = 'public, max-age=31536000, immutable';
    const yaComprimido = programa && !pedido.headers.range ? comprimido(archivo, pedido.headers['accept-encoding'] || '') : null;
    if (yaComprimido) {
      const [otro, codificacion] = yaComprimido, largo = fs.statSync(otro).size;
      respuesta.writeHead(200, { ...cabeceras, 'Content-Encoding': codificacion, 'Content-Length': largo, 'Vary': 'Accept-Encoding' + (CORS ? ', Origin' : '') });
      return pedido.method === 'HEAD' ? respuesta.end() : fs.createReadStream(otro).pipe(respuesta);
    }
    const rango = /^bytes=(\d+)-(\d*)$/.exec(pedido.headers.range || '');
    if (rango) {                                    // solo un pedazo: 206 "contenido parcial"
      const inicio = Number(rango[1]);
      const fin = rango[2] ? Math.min(Number(rango[2]), info.size - 1) : info.size - 1;
      if (inicio >= info.size) {
        respuesta.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
        return respuesta.end();
      }
      respuesta.writeHead(206, { ...cabeceras, 'Content-Range': `bytes ${inicio}-${fin}/${info.size}`, 'Content-Length': fin - inicio + 1 });
      fs.createReadStream(archivo, { start: inicio, end: fin }).pipe(respuesta);
    } else {                                        // el archivo entero
      respuesta.writeHead(200, { ...cabeceras, 'Content-Length': info.size });
      fs.createReadStream(archivo).pipe(respuesta);
    }
  }), demora);
}).listen(PUERTO, '127.0.0.1', () => console.log(`juego en http://127.0.0.1:${PUERTO}/  (solo esta PC)`));
