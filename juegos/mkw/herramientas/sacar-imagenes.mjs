// Saca del juego las imágenes que muestra la página al elegir: íconos de copas (y la hoja de muestra) — bitácora §56.
//
// Resumen: los íconos de las copas de Retro Rewind están en RetroRewind6/Assets/UIAssets.szs (button/timg/icon_NNN.tpl,
// 128×128 en CMPR). Este programa los abre con herramientas/szs.mjs (Yaz0 → U8 → TPL), los pasa a PNG y los deja en
// build/web/navegador/imagenes/copas/NNN.png. Son imágenes del juego (de Retro Rewind): build/ nunca va a git; se suben
// a R2 con el .wasm y el Worker las da solo a los amigos, como el disco.
// Las fotos de las pistas las saca herramientas/fotos-pistas.mjs (con el juego andando).
//
// Uso:  node herramientas/sacar-imagenes.mjs [--hoja]     (--hoja: además, una hoja con todos para mirarlos)
// También deja copas64/NNN.png (a la mitad, 64×64): esas van en el paquete de la página (empaquetar-imagenes.mjs).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yaz0, u8, tpl } from './szs.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RR = path.join(raiz, 'terceros/RetroRewind/RetroRewind6');
const salida = path.join(raiz, 'build/web/navegador/imagenes/copas');
mkdirSync(salida, { recursive: true });

// PNG mínimo: firma + IHDR + IDAT (filas con filtro 0, comprimidas con zlib) + IEND, cada trozo con su CRC-32
const tablaCrc = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = tablaCrc[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function trozo(tipo, datos) {
  const t = Buffer.from(tipo), largo = Buffer.alloc(4), suma = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length); suma.writeUInt32BE(crc(Buffer.concat([t, datos])));
  return Buffer.concat([largo, t, datos, suma]);
}
export function png(ancho, alto, rgba) {
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(ancho, 0); ih.writeUInt32BE(alto, 4); ih[8] = 8; ih[9] = 6;          // 8 bits, RGBA
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * ancho * 4, ancho * 4).copy(filas, y * (ancho * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', ih), trozo('IDAT', deflateSync(filas)), trozo('IEND', Buffer.alloc(0))]);
}

// Achicar a la mitad (cada píxel nuevo = promedio de 2×2, pesado por la transparencia para que el borde no se ensucie)
export function mitad(im) {
  const w = im.ancho >> 1, h = im.alto >> 1, out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const s = ((2 * y + dy) * im.ancho + 2 * x + dx) * 4, al = im.rgba[s + 3];
      r += im.rgba[s] * al; g += im.rgba[s + 1] * al; b += im.rgba[s + 2] * al; a += al;
    }
    const d = (y * w + x) * 4;
    if (a) { out[d] = r / a; out[d + 1] = g / a; out[d + 2] = b / a; }
    out[d + 3] = a / 4;
  }
  return { ancho: w, alto: h, rgba: out };
}

if (process.argv[1] && process.argv[1].endsWith('sacar-imagenes.mjs')) {
const salida64 = path.join(salida, '..', 'copas64');
mkdirSync(salida64, { recursive: true });
const archivos = u8(yaz0(new Uint8Array(readFileSync(path.join(RR, 'Assets/UIAssets.szs')))));
const iconos = [...archivos.keys()].filter(r => /\/timg\/icon_\d+\.tpl$/.test(r)).sort();
const imagenes = [];
for (const ruta of iconos) {
  const n = ruta.match(/icon_(\d+)/)[1];
  const [im] = tpl(archivos.get(ruta));
  writeFileSync(path.join(salida, `${n}.png`), png(im.ancho, im.alto, im.rgba));
  const chico = mitad(im);                                   // la de 64 px es la que usa la página (pesa ~¼)
  writeFileSync(path.join(salida64, `${n}.png`), png(chico.ancho, chico.alto, chico.rgba));
  imagenes.push([n, im]);
}
console.log(`${imagenes.length} íconos de copa en ${path.relative(raiz, salida)}`);

if (process.argv.includes('--hoja')) {
  // todos en una grilla de 16 columnas de 64 px (a la mitad), para mirarlos de una vez
  const col = 16, t = 64, filas = Math.ceil(imagenes.length / col);
  const W = col * t, H = filas * t, hoja = new Uint8ClampedArray(W * H * 4);
  imagenes.forEach(([, im], i) => {
    const ox = (i % col) * t, oy = Math.floor(i / col) * t;
    for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) {
      const s = ((y * 2) * im.ancho + x * 2) * 4, d = ((oy + y) * W + ox + x) * 4;
      const a = im.rgba[s + 3] / 255;
      for (let c = 0; c < 3; c++) hoja[d + c] = im.rgba[s + c] * a + 40 * (1 - a);
      hoja[d + 3] = 255;
    }
  });
  writeFileSync(path.join(salida, '..', 'hoja-copas.png'), png(W, H, hoja));
  console.log('hoja: build/web/navegador/imagenes/hoja-copas.png');
}
}
