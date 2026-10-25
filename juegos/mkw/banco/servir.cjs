// Servidor local del banco de pruebas: http://localhost:8130/  (Ctrl+C para cerrar)
//
// Resumen: sirve la carpeta banco/ como archivos estáticos, sin dependencias (solo Node). Manda las cabeceras
// COOP/COEP para que la página quede "aislada" (crossOriginIsolated) y pueda usar SharedArrayBuffer, que necesitan
// los hilos de WebAssembly si alguna prueba los usa. Y el tipo correcto para .wasm, que el navegador exige para
// compilarlo mientras baja (streaming).
//
// Uso:  node banco/servir.cjs            (o: node banco/servir.cjs 8131 para otro puerto)
const http = require('http');                 // el servidor web de Node
const fs = require('fs');                     // leer archivos
const path = require('path');                 // armar rutas sin errores de barras

const RAIZ = __dirname;                       // lo que se sirve: la carpeta banco/
const WEB = path.join(__dirname, '..', 'web'); // y web/ (código de la página, sin nada del juego) en /web/
const SITIO_AUDIO = path.join(__dirname, '..', 'terceros', 'Paginita-Pro', 'juegos', 'audio');   // §100: en /sitio/audio/
const PUERTO = Number(process.argv[2]) || 8130;
const TIPOS = {                               // extensión → tipo de contenido
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.bin': 'application/octet-stream', '.md': 'text/plain; charset=utf-8',
};

// §103: /turn = lo que contesta el Worker de amigos con las credenciales de Cloudflare Realtime, pero de un repetidor TURN
// de mentira de este PC (herramientas/turn-local.mjs, se prende con el primer pedido); /turn?cuenta=1 = cuánto reenvió
let turn = null;
const pideTurn = () => turn || (turn = import('../herramientas/turn-local.mjs').then(m => m.crearTurn()));

http.createServer((pedido, respuesta) => {
  // la ruta pedida, sin "?v=..." y decodificada ("%20" → espacio)
  let ruta = decodeURIComponent(pedido.url.split('?')[0]);
  if (ruta === '/turn') {
    pideTurn().then(t => {
      respuesta.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Cross-Origin-Resource-Policy': 'same-origin' });
      respuesta.end(JSON.stringify(pedido.url.includes('cuenta=1') ? t.cuenta : { iceServers: t.iceServers() }));
    }, e => { respuesta.writeHead(500); respuesta.end(String(e?.message || e)); });
    return;
  }
  if (ruta.endsWith('/')) ruta += 'index.html';                 // una carpeta → su index.html
  // /web/... = nuestro código de la página del juego (web/: sin nada del juego), para probar sus piezas sueltas
  // §100: /sitio/audio/... = la carpeta de audio y mandos del sitio (terceros/Paginita-Pro/juegos/audio: código del dueño,
  // sin nada del juego), para probar los mandos de Mario Kart con el mando.js de verdad (banco mando-sitio)
  const sitio = ruta.startsWith('/sitio/audio/');
  const base = sitio ? SITIO_AUDIO : ruta.startsWith('/web/') ? WEB : RAIZ;
  const archivo = path.normalize(path.join(base, sitio ? ruta.slice(12) : ruta.startsWith('/web/') ? ruta.slice(4) : ruta));
  if (!archivo.startsWith(base)) { respuesta.writeHead(403); return respuesta.end('fuera del banco'); }   // nada de "../"
  fs.readFile(archivo, (error, datos) => {
    if (error) { respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return respuesta.end('no existe: ' + ruta); }
    respuesta.writeHead(200, {
      'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',              // estas dos dejan la página "aislada"…
      'Cross-Origin-Embedder-Policy': 'require-corp',           // …para poder usar SharedArrayBuffer
      'Cache-Control': 'no-store',                              // en el banco, siempre lo último
    });
    respuesta.end(datos);
  });
}).listen(PUERTO, () => console.log(`banco en http://localhost:${PUERTO}/`));
