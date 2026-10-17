// Comprime el programa del juego para entregarlo YA comprimido (bitácora §54).
//
// Resumen: mkw.wasm pesa ~130 MB; comprimido con brotli queda en una fracción. Se guarda al lado (mkw.wasm.br y
// mkw.wasm.gz, igual con mkw.js) y el servidor (web/navegador/servidor.mjs; en el sitio, el Worker con los objetos de
// R2) entrega el comprimido con "Content-Encoding: br": el navegador lo descomprime solo, mientras lo compila
// (instantiateStreaming), sin que la página haga nada. Ventajas: se baja ~4 veces menos, y ningún archivo guardado
// pasa de 100 MB. Se comprime UNA vez por compilación (brotli al máximo tarda; un servidor que comprime al vuelo usa
// niveles bajos y comprime peor).
//
// Igual que el .wasm, lo comprimido es del juego: queda en build/ (fuera de git) y va a R2, nunca a GitHub.
//
// Uso:  node herramientas/comprimir-build.mjs [carpeta]      (por omisión build/web/navegador)
//       --calidad N   calidad de brotli (0-11; por omisión 11)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const carpeta = path.resolve(raiz, args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) || 'build/web/navegador');
const CALIDAD = Number(opcion('--calidad', 11));

for (const nombre of ['mkw.js', 'mkw.wasm']) {
  const archivo = path.join(carpeta, nombre);
  if (!fs.existsSync(archivo)) { console.log(`falta ${archivo}`); continue; }
  const datos = fs.readFileSync(archivo);
  const MB = n => (n / 1048576).toFixed(1) + ' MB';
  let t = Date.now();
  // brotli: ventana grande (16 MB, lgwin 24) para encontrar repeticiones lejanas en un archivo tan grande
  const br = zlib.brotliCompressSync(datos, { params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: CALIDAD,
    [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: datos.length,
    [zlib.constants.BROTLI_PARAM_MODE]: nombre.endsWith('.js') ? zlib.constants.BROTLI_MODE_TEXT : zlib.constants.BROTLI_MODE_GENERIC,
  } });
  const sBr = (Date.now() - t) / 1000;
  t = Date.now();
  const gz = zlib.gzipSync(datos, { level: 9 });   // para navegadores sin brotli (todos los de hoy lo tienen)
  const sGz = (Date.now() - t) / 1000;
  fs.writeFileSync(archivo + '.br', br);
  fs.writeFileSync(archivo + '.gz', gz);
  console.log(`${nombre}: ${MB(datos.length)} → brotli ${MB(br.length)} (${sBr.toFixed(0)} s), gzip ${MB(gz.length)} (${sGz.toFixed(0)} s)`);
}
