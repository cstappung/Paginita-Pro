// El sitio de paginita-pro.cl en esta PC, servido COMO GitHub Pages, con el juego adentro (bitácora §54).
//
// Resumen: para medir el juego en las mismas condiciones que tendrá en la página real, no en el servidor cómodo de
// pruebas. Levanta dos servidores, los dos solo en esta PC (127.0.0.1):
//
//   1. "Pages" (puerto 8150): los archivos del sitio (una copia del repo en terceros/Paginita-Pro) tal como los da
//      GitHub Pages: solo archivos, comprimidos con gzip, "Cache-Control: max-age=600" (el navegador los reusa 10
//      minutos), ETag, y SIN las cabeceras COOP/COEP. Sin ellas la página no queda "aislada" (crossOriginIsolated es
//      false): no hay SharedArrayBuffer ni hilos de WebAssembly. El juego no los usa (un solo hilo + JSPI), igual que
//      BT3. Nuestra página va en /juegos/mkw/ (web/navegador), donde irá en el sitio.
//   2. "Worker" (puerto 8151): lo privado (el juego compilado .js/.wasm, el manifiesto y los archivos del disco y de
//      Retro Rewind) desde OTRO origen, con CORS y la latencia de R2 (50 ms por pedido; cambiar con --latencia), como
//      el Worker de amigos que sirve el disco de BT3. Es web/navegador/servidor.mjs con MKW_CORS y MKW_LATENCIA.
//
// Dentro de Juegos: http://127.0.0.1:8150/juegos.html?mkw=1 abre la página de Juegos de verdad (Firebase, mando.js,
// volumen.js, i18n.js corriendo en su propio hilo principal) y le pone encima el marco del juego a pantalla completa,
// igual que crearBt3Solo (colabtex/src/juegos/bt3.js): un <iframe class="jg-bt3-solo"> con allow="fullscreen;
// gamepad" y la clase html.jg-bt3solo. Eso lo agrega SOLO este servidor de pruebas (no está en el repo del sitio).
// La página sola: http://127.0.0.1:8150/juegos/mkw/index.html?privado=http://127.0.0.1:8151
//
// Uso:  node herramientas/sitio-local.mjs [--latencia 50]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PUERTO = Number(opcion('--puerto', 8150));
const PUERTO_WORKER = PUERTO + 1;
const LATENCIA = Number(opcion('--latencia', 50));
const SITIO = path.join(raiz, 'terceros/Paginita-Pro');
const PAGES = `http://127.0.0.1:${PUERTO}`, WORKER = `http://127.0.0.1:${PUERTO_WORKER}`;
if (!fs.existsSync(path.join(SITIO, 'juegos.html'))) {
  console.error('falta la copia del sitio: git clone https://github.com/cstappung/Paginita-Pro terceros/Paginita-Pro');
  process.exit(1);
}

// dirección → carpeta (la primera que calce): el juego en /juegos/mkw/, el resto es el sitio
const CARPETAS = [
  ['/juegos/mkw/banco/', path.join(raiz, 'banco')],
  ['/juegos/mkw/', path.join(raiz, 'web/navegador')],
  ['/', SITIO],
];
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};
// GitHub Pages comprime lo que es texto (y el .wasm); las imágenes y el audio ya vienen comprimidos
const COMPRIMIBLE = /^(text\/|application\/(javascript|json|wasm)|image\/svg)/;

// Lo que se agrega a juegos.html con ?mkw=1: el marco del juego, como crearBt3Solo
const MARCO = `<script>
(() => {
  const q = new URLSearchParams(location.search);
  if (!q.has('mkw')) return;
  // La ruta de BT3 solo (#solo/bt3): la app apaga el vestíbulo y pone html.jg-bt3solo (#pantalla a pantalla completa);
  // sin sesión de amigo, crearBt3Solo deja «Este juego es privado» en #pantalla (sin sesión, la puerta que pide una
  // cuenta). Ahí se pone nuestro marco, con html.jg-bt3solo: el mismo
  // estado que tendrá crearMkwSolo (nada de la página de Juegos dibujándose debajo).
  if (location.hash !== '#solo/bt3') history.replaceState(null, '', location.pathname + location.search + '#solo/bt3');
  const pon = () => {
    const h = document.getElementById('pantalla');
    // espera a que la app haya pintado esa ruta: el marco de BT3 o, sin sesión, la puerta «Este juego necesita una cuenta»
    if (!h || !h.children.length) return setTimeout(pon, 100);
    document.documentElement.classList.add('jg-bt3solo');
    const f = document.createElement('iframe');
    f.className = 'jg-bt3-solo'; f.title = 'Mario Kart Wii'; f.allow = 'fullscreen; gamepad'; f.setAttribute('allowfullscreen', '');
    f.src = 'juegos/mkw/index.html?privado=${WORKER}' + (q.get('mkw') || '').replace(/^1/, '');
    h.replaceChildren(f); f.focus(); window.mkwMarco = f;
  };
  addEventListener('load', () => setTimeout(pon, 1000));
})();
</script>`;

const comprimidos = new Map();          // archivo|fecha → gzip (no se recomprime en cada pedido)
http.createServer((pedido, respuesta) => {
  const url = decodeURIComponent(pedido.url.split('?')[0]);
  const par = CARPETAS.find(([p]) => url.startsWith(p));
  let archivo = path.normalize(path.join(par[1], url.slice(par[0].length)));
  if (!archivo.startsWith(par[1])) { respuesta.writeHead(403); return respuesta.end(); }
  if (url.endsWith('/')) archivo = path.join(archivo, 'index.html');
  fs.stat(archivo, (error, info) => {
    if (error || !info.isFile()) { respuesta.writeHead(404, { 'Content-Type': 'text/plain' }); return respuesta.end('404'); }
    const tipo = TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream';
    const etiqueta = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const cabeceras = {
      'Content-Type': tipo,
      'Cache-Control': 'max-age=600',          // como GitHub Pages: 10 minutos
      'ETag': etiqueta,
      'Last-Modified': info.mtime.toUTCString(),
      'Access-Control-Allow-Origin': '*',      // GitHub Pages también lo manda
      // y NADA de Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy
    };
    if (pedido.headers['if-none-match'] === etiqueta) { respuesta.writeHead(304, cabeceras); return respuesta.end(); }
    let cuerpo = fs.readFileSync(archivo);
    if (url === '/juegos.html') cuerpo = Buffer.from(String(cuerpo).replace('</body>', MARCO + '</body>'));
    if (COMPRIMIBLE.test(tipo) && /\bgzip\b/.test(pedido.headers['accept-encoding'] || '')) {
      const k = archivo + '|' + info.mtimeMs;
      if (!comprimidos.has(k)) comprimidos.set(k, zlib.gzipSync(cuerpo, { level: 6 }));
      cuerpo = comprimidos.get(k);
      cabeceras['Content-Encoding'] = 'gzip';
      cabeceras['Vary'] = 'Accept-Encoding';
    }
    cabeceras['Content-Length'] = cuerpo.length;
    respuesta.writeHead(200, cabeceras);
    respuesta.end(pedido.method === 'HEAD' ? undefined : cuerpo);
  });
}).listen(PUERTO, '127.0.0.1', () => {
  console.log(`sitio (como GitHub Pages) en ${PAGES}/juegos.html?mkw=1  (Juegos con el marco del juego)`);
  console.log(`la página sola: ${PAGES}/juegos/mkw/index.html?privado=${WORKER}`);
});

// El "Worker": lo privado, desde otro origen, con la latencia de R2
const worker = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO_WORKER)], {
  env: { ...process.env, MKW_CORS: PAGES, MKW_LATENCIA: String(LATENCIA) }, stdio: ['ignore', 'pipe', 'inherit'],
});
worker.stdout.on('data', d => process.stdout.write(String(d).replace(/^juego en .*$/m, `worker (lo privado, ${LATENCIA} ms por pedido) en ${WORKER}`)));
const cerrar = () => { worker.kill(); process.exit(0); };
process.on('SIGINT', cerrar); process.on('SIGTERM', cerrar);
