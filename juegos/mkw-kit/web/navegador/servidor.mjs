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

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUERTO = Number(process.argv[2]) || 8140;
const LATENCIA = Number(process.env.MKW_LATENCIA) || 0;   // ms extra por pedido a /mkw/ (simular la red del sitio)

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
console.log(Object.entries(manifiesto).map(([p, l]) => `${p}: ${l.length} archivos`).join('\n'));

http.createServer((pedido, respuesta) => {
  const url = decodeURIComponent(pedido.url.split('?')[0]);
  if (url === '/manifiesto.json') {
    respuesta.writeHead(200, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store', 'X-Mkw-Version': VERSION });
    return respuesta.end(manifiestoJson);
  }
  const par = CARPETAS.find(([prefijo]) => url.startsWith(prefijo));
  let archivo = path.normalize(path.join(par[1], url.slice(par[0].length)));
  if (!archivo.startsWith(par[1])) { respuesta.writeHead(403); return respuesta.end('fuera de la carpeta'); }  // nada de "../"
  if (url.endsWith('/')) archivo = path.join(archivo, 'index.html');
  // MKW_LATENCIA=50: cada pedido de los archivos del juego (/mkw/) tarda 50 ms más en empezar, como la red hasta R2
  // en el sitio (aquí, en la misma PC, tarda ~1 ms). Sirve para medir lo que espera el juego de verdad (bitácora §52).
  const demora = url.startsWith('/mkw/') ? LATENCIA : 0;
  setTimeout(() => fs.stat(archivo, (error, info) => {
    if (error || !info.isFile()) { respuesta.writeHead(404); return respuesta.end('no existe: ' + url); }
    const cabeceras = {
      'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      // Nada en la caché HTTP del navegador: la página y el juego, siempre lo último; los archivos del disco ya los
      // guarda la página en su propia caché (disco.mjs), así no quedan guardados dos veces (igual que el Worker de BT3)
      'Cache-Control': 'no-store',
    };
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
