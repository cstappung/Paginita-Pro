// Leer los archivos empaquetados de la Wii: Yaz0 (comprimido), U8 (carpeta empaquetada) y TPL (texturas) — bitácora §56.
//
// Resumen: los menús de Mario Kart Wii y de Retro Rewind vienen en archivos .szs = un "U8" (como un .zip sin
// comprimir: un árbol de carpetas y archivos dentro de un solo archivo) comprimido con Yaz0 (un LZ77 de Nintendo: cada
// byte de control dice, bit a bit, si lo que sigue es un byte literal o una "copia" de algo ya escrito). Adentro, las
// imágenes son TPL (texturas de la GameCube/Wii, en baldosas de 4×4 o 8×4 píxeles, en formatos como CMPR = DXT1,
// RGB5A3, I8, IA8…). Todos los formatos son públicos (wiki.tockdom.com: Yaz0, U8, TPL).
//
// Este módulo solo lee: sirve a herramientas/sacar-imagenes.mjs para sacar los íconos de copas que muestra el juego.
// Lo que sale es imagen del juego: va a build/ (nunca a git) y de ahí a R2 detrás del Worker, como el .wasm.
//
// Uso como programa:  node herramientas/szs.mjs <archivo.szs> [filtro]   (lista lo que hay adentro)

import { readFileSync } from 'node:fs';

// Yaz0 → bytes
export function yaz0(b) {
  if (String.fromCharCode(...b.subarray(0, 4)) !== 'Yaz0') return b;          // no está comprimido
  const tam = (b[4] << 24 | b[5] << 16 | b[6] << 8 | b[7]) >>> 0;
  const out = new Uint8Array(tam);
  let i = 16, o = 0;
  while (o < tam) {
    const control = b[i++];
    for (let bit = 7; bit >= 0 && o < tam; bit--) {
      if (control & (1 << bit)) { out[o++] = b[i++]; continue; }            // 1 = un byte tal cual
      const b1 = b[i++], b2 = b[i++];                                        // 0 = copiar de atrás
      const dist = ((b1 & 0x0F) << 8 | b2) + 1;
      let n = b1 >> 4;
      n = n === 0 ? b[i++] + 0x12 : n + 2;
      for (let k = 0; k < n; k++, o++) out[o] = out[o - dist];
    }
  }
  return out;
}

// U8 → Map(ruta → bytes)
export function u8(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (v.getUint32(0) !== 0x55AA382D) throw new Error('no es un U8');
  const raiz = v.getUint32(4);
  const total = v.getUint32(raiz + 8);                                       // el nodo raíz dice cuántos hay
  const nombres = raiz + total * 12;
  const nombre = off => { let s = '', p = nombres + off; while (b[p]) s += String.fromCharCode(b[p++]); return s; };
  const archivos = new Map();
  const pila = [[total, '']];                                                // [hasta qué nodo llega la carpeta, su ruta]
  for (let n = 1; n < total; n++) {
    while (pila.length > 1 && n >= pila[pila.length - 1][0]) pila.pop();
    const p = raiz + n * 12;
    const esCarpeta = b[p] === 1, nom = nombre(v.getUint32(p) & 0xFFFFFF);
    const ruta = pila[pila.length - 1][1] + '/' + nom;
    if (esCarpeta) pila.push([v.getUint32(p + 8), ruta]);
    else archivos.set(ruta, b.subarray(v.getUint32(p + 4), v.getUint32(p + 4) + v.getUint32(p + 8)));
  }
  return archivos;
}

// TPL → [{ ancho, alto, rgba }]  (formatos: I4, I8, IA4, IA8, RGB565, RGB5A3, RGBA8, CMPR)
export function tpl(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (v.getUint32(0) !== 0x0020AF30) throw new Error('no es un TPL');
  const n = v.getUint32(4), tabla = v.getUint32(8), imagenes = [];
  for (let k = 0; k < n; k++) {
    const h = v.getUint32(tabla + k * 8);
    const alto = v.getUint16(h), ancho = v.getUint16(h + 2), formato = v.getUint32(h + 4), datos = v.getUint32(h + 8);
    imagenes.push({ ancho, alto, formato, rgba: decodificar(b, datos, ancho, alto, formato) });
  }
  return imagenes;
}

const ESC = (x, bits) => Math.round(x * 255 / ((1 << bits) - 1));
function rgb565(c) { return [ESC(c >> 11 & 31, 5), ESC(c >> 5 & 63, 6), ESC(c & 31, 5), 255]; }
function rgb5a3(c) {
  return c & 0x8000 ? [ESC(c >> 10 & 31, 5), ESC(c >> 5 & 31, 5), ESC(c & 31, 5), 255]
                    : [ESC(c >> 8 & 15, 4), ESC(c >> 4 & 15, 4), ESC(c & 15, 4), ESC(c >> 12 & 7, 3)];
}
export function decodificar(b, p, ancho, alto, formato) {
  const out = new Uint8ClampedArray(ancho * alto * 4);
  const pon = (x, y, c) => { if (x < ancho && y < alto) out.set(c, (y * ancho + x) * 4); };
  const u16 = q => b[q] << 8 | b[q + 1];
  // tamaño de la baldosa de cada formato (ancho × alto en píxeles)
  const [bw, bh] = { 0: [8, 8], 1: [8, 4], 2: [8, 4], 3: [4, 4], 4: [4, 4], 5: [4, 4], 6: [4, 4], 14: [8, 8] }[formato] || [4, 4];
  for (let by = 0; by < alto; by += bh) for (let bx = 0; bx < ancho; bx += bw) {
    if (formato === 0) {                                         // I4: 4 bits de gris
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) { const c = b[p++]; const a = ESC(c >> 4, 4), z = ESC(c & 15, 4); pon(bx + x, by + y, [a, a, a, 255]); pon(bx + x + 1, by + y, [z, z, z, 255]); }
    } else if (formato === 1) {                                  // I8
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { const c = b[p++]; pon(bx + x, by + y, [c, c, c, 255]); }
    } else if (formato === 2) {                                  // IA4
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { const c = b[p++]; const i = ESC(c & 15, 4); pon(bx + x, by + y, [i, i, i, ESC(c >> 4, 4)]); }
    } else if (formato === 3) {                                  // IA8
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const a = b[p++], i = b[p++]; pon(bx + x, by + y, [i, i, i, a]); }
    } else if (formato === 4) {                                  // RGB565
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { pon(bx + x, by + y, rgb565(u16(p))); p += 2; }
    } else if (formato === 5) {                                  // RGB5A3
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { pon(bx + x, by + y, rgb5a3(u16(p))); p += 2; }
    } else if (formato === 6) {                                  // RGBA8: AR y GB en dos mitades de 32 bytes
      for (let i = 0; i < 16; i++) { const x = i % 4, y = i >> 2; pon(bx + x, by + y, [b[p + 2 * i + 1], b[p + 32 + 2 * i], b[p + 32 + 2 * i + 1], b[p + 2 * i]]); }
      p += 64;
    } else if (formato === 14) {                                 // CMPR: 4 sub-baldosas DXT1 de 4×4
      for (let s = 0; s < 4; s++) {
        const c0 = u16(p), c1 = u16(p + 2), pal = [rgb565(c0), rgb565(c1)];
        if (c0 > c1) { pal.push(pal[0].map((v, i) => i < 3 ? Math.round((2 * v + pal[1][i]) / 3) : 255), pal[0].map((v, i) => i < 3 ? Math.round((v + 2 * pal[1][i]) / 3) : 255)); }
        else { pal.push(pal[0].map((v, i) => i < 3 ? (v + pal[1][i]) >> 1 : 255), [0, 0, 0, 0]); }
        const sx = bx + (s & 1) * 4, sy = by + (s >> 1) * 4;
        for (let y = 0; y < 4; y++) { const fila = b[p + 4 + y]; for (let x = 0; x < 4; x++) pon(sx + x, sy + y, pal[(fila >> (6 - 2 * x)) & 3]); }
        p += 8;
      }
    } else throw new Error('formato TPL no soportado: ' + formato);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('szs.mjs') && process.argv[2]) {
  const archivos = u8(yaz0(new Uint8Array(readFileSync(process.argv[2]))));
  const filtro = new RegExp(process.argv[3] || '.', 'i');
  for (const [ruta, d] of archivos) if (filtro.test(ruta)) console.log(String(d.length).padStart(8), ruta);
}
