// El paquete de los archivos diminutos del disco (bitácora §93, E2).
//
// Resumen: el juego lee unos 600 archivos de ≤ 8 KB (los fantasmas del Contrarreloj, íconos, bancos de sonido y voces
// de Retro Rewind…). La página los traía uno por uno en segundo plano: ~600 pedidos al Worker, y en la primera visita
// la fila tardaba ~22 s en vaciarse (lo que no alcanzó a llegar, el juego lo esperaba de a uno al largar la carrera).
// Aquí se juntan TODOS en un solo archivo, `diminutos.bin`: la página lo baja de una vez (~1,5 MB, un solo pedido) y
// cada archivo queda listo en la memoria. Como una regleta: en vez de 600 enchufes a la pared, uno solo.
//
// Formato (todo en little-endian, el orden de bytes de un PC):
//   bytes 0-3   "MKWD"
//   bytes 4-7   u32 formato (1)
//   bytes 8-11  u32 largo del índice en bytes (n)
//   bytes 12…   el índice: JSON {"archivos": [[ruta, tamaño], …]} (la ruta es la que ve el juego: "/mkw/disco/files/…")
//   después     el contenido de cada archivo, pegado uno tras otro, en el orden del índice
//
// Es contenido del juego y de Retro Rewind: nunca a git; solo a R2 detrás del Worker (subir-r2.mjs lo arma y lo sube
// junto al programa). El servidor de pruebas y el Worker local lo arman al arrancar desde los mismos archivos que sirven,
// así nunca queda viejo.
//
// Uso:  import { armarDiminutos } from './diminutos.mjs';
//       const bytes = armarDiminutos([['/mkw/disco/', 'C:/…/extraido/disco'], …]);   // Buffer
//       node herramientas/diminutos.mjs [salida.bin]   → arma el de esta PC y dice cuántos y cuánto pesa
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOPE_DIMINUTO = 8192;           // el mismo tope que usa la página (mkw.mjs: «diminutos ≤ 8 KB»)
export const MAGIA = 'MKWD';

// todos los archivos de una carpeta (recursivo): [[ruta relativa con "/", ruta en el PC, tamaño]]
function recorrer(carpeta, base = carpeta, salida = []) {
  for (const e of fs.readdirSync(carpeta, { withFileTypes: true })) {
    const p = path.join(carpeta, e.name);
    if (e.isDirectory()) recorrer(p, base, salida);
    else if (e.isFile()) salida.push([path.relative(base, p).split(path.sep).join('/'), p, fs.statSync(p).size]);
  }
  return salida;
}

// carpetas = [[prefijo que ve el juego, carpeta del PC], …] → Buffer con el paquete
export function armarDiminutos(carpetas, tope = TOPE_DIMINUTO) {
  const lista = [];
  for (const [prefijo, carpeta] of carpetas) {
    if (!fs.existsSync(carpeta)) continue;
    for (const [ruta, archivo, tam] of recorrer(carpeta)) if (tam > 0 && tam <= tope) lista.push([prefijo + ruta, archivo, tam]);
  }
  lista.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));   // siempre el mismo orden: el mismo paquete
  const indice = Buffer.from(JSON.stringify({ archivos: lista.map(([ruta, , tam]) => [ruta, tam]) }));
  const cabeza = Buffer.alloc(12);
  cabeza.write(MAGIA, 0, 'latin1');
  cabeza.writeUInt32LE(1, 4);
  cabeza.writeUInt32LE(indice.length, 8);
  return Buffer.concat([cabeza, indice, ...lista.map(([, archivo]) => fs.readFileSync(archivo))]);
}

// las carpetas de esta PC (las mismas de servidor.mjs y subir-r2.mjs)
export function carpetasLocales(raiz) {
  return [
    ['/mkw/disco/', path.join(raiz, 'extraido/disco')],
    ['/mkw/sd/RetroRewind6/', path.join(raiz, 'terceros/RetroRewind/RetroRewind6')],
    ['/mkw/sd/riivolution/', path.join(raiz, 'terceros/RetroRewind/riivolution')],
    ['/wc/runtime/assets/', path.join(raiz, 'terceros/Wiicompiled/runtime/assets')],
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const t0 = Date.now(), b = armarDiminutos(carpetasLocales(raiz));
  const n = JSON.parse(b.subarray(12, 12 + b.readUInt32LE(8))).archivos.length;
  console.log(`${n} archivos diminutos, ${(b.length / 1048576).toFixed(2)} MB, en ${Date.now() - t0} ms`);
  if (process.argv[2]) { fs.writeFileSync(process.argv[2], b); console.log('escrito en ' + process.argv[2]); }
}
