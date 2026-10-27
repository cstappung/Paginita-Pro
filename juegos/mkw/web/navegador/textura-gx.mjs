// Texturas de la Wii (formato GX) ↔ píxeles RGBA para un <canvas> — bitácora §86.
//
// Resumen: la Wii no guarda las imágenes fila por fila como un PNG, sino en BALDOSAS: bloques de 4×4 u 8×4 u 8×8
// píxeles, uno detrás de otro (de izquierda a derecha y de arriba abajo), y dentro de cada baldosa los píxeles en orden.
// Cada formato empaqueta el color distinto (formatos públicos, wiki.tockdom.com/wiki/Image_Formats):
//   0 I4     8×8, 4 bits de gris            1 I8     8×4, 8 bits de gris
//   2 IA4    8×4, 4 bits opacidad + 4 gris  3 IA8    4×4, 8 bits opacidad + 8 gris
//   4 RGB565 4×4, 16 bits de color          5 RGB5A3 4×4, 16 bits: con el bit alto en 1 = RGB 5:5:5 opaco;
//                                                   en 0 = opacidad de 3 bits + RGB 4:4:4
//   6 RGBA8  4×4, 32 bits en dos mitades de 32 bytes: primero los pares opacidad-rojo, después verde-azul
//  14 CMPR   8×8, cuatro sub-baldosas DXT1 de 4×4 (dos colores y 2 bits por píxel)
// Como leer un tablero de luces conectado en matriz: hay que saber el orden de barrido para poner cada luz en su lugar.
// decodificar() pasa de la Wii a RGBA; codificar() hace lo contrario (lo usa el banco para armar texturas falsas con
// la forma de las del juego). Es nuestro (la misma idea que herramientas/szs.mjs, que es para Node).

const BALDOSA = { 0: [8, 8], 1: [8, 4], 2: [8, 4], 3: [4, 4], 4: [4, 4], 5: [4, 4], 6: [4, 4], 14: [8, 8] };
export const NOMBRES_FORMATO = { 0: 'I4', 1: 'I8', 2: 'IA4', 3: 'IA8', 4: 'RGB565', 5: 'RGB5A3', 6: 'RGBA8', 14: 'CMPR' };

// Cuántos bytes ocupa una textura (baldosas enteras: una imagen de 100 de ancho usa 25 baldosas de 4)
export function tamTextura(ancho, alto, formato) {
  const b = BALDOSA[formato];
  if (!b) return 0;
  return Math.ceil(ancho / b[0]) * Math.ceil(alto / b[1]) * (formato === 6 ? 64 : 32);
}

const ESC = (x, bits) => Math.round(x * 255 / ((1 << bits) - 1));     // p. ej. 5 bits (0..31) → 0..255
const rgb565 = c => [ESC(c >> 11 & 31, 5), ESC(c >> 5 & 63, 6), ESC(c & 31, 5), 255];
const rgb5a3 = c => (c & 0x8000 ? [ESC(c >> 10 & 31, 5), ESC(c >> 5 & 31, 5), ESC(c & 31, 5), 255]
                                : [ESC(c >> 8 & 15, 4), ESC(c >> 4 & 15, 4), ESC(c & 15, 4), ESC(c >> 12 & 7, 3)]);

// bytes de la Wii (desde p) → Uint8ClampedArray RGBA de ancho × alto (lo que pide un ImageData)
export function decodificar(b, ancho, alto, formato, p = 0) {
  const b0 = BALDOSA[formato];
  if (!b0) throw new Error('formato de textura no soportado: ' + formato);
  const out = new Uint8ClampedArray(ancho * alto * 4);
  const pon = (x, y, c) => { if (x < ancho && y < alto) out.set(c, (y * ancho + x) * 4); };
  const u16 = q => b[q] << 8 | b[q + 1];                                 // big-endian, como la Wii
  const [bw, bh] = b0;
  for (let by = 0; by < alto; by += bh) for (let bx = 0; bx < ancho; bx += bw) {
    if (formato === 0) {                                                 // I4
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) { const c = b[p++]; const a = ESC(c >> 4, 4), z = ESC(c & 15, 4); pon(bx + x, by + y, [a, a, a, 255]); pon(bx + x + 1, by + y, [z, z, z, 255]); }
    } else if (formato === 1) {                                          // I8
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { const c = b[p++]; pon(bx + x, by + y, [c, c, c, 255]); }
    } else if (formato === 2) {                                          // IA4
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { const c = b[p++]; const i = ESC(c & 15, 4); pon(bx + x, by + y, [i, i, i, ESC(c >> 4, 4)]); }
    } else if (formato === 3) {                                          // IA8
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const a = b[p++], i = b[p++]; pon(bx + x, by + y, [i, i, i, a]); }
    } else if (formato === 4) {                                          // RGB565
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { pon(bx + x, by + y, rgb565(u16(p))); p += 2; }
    } else if (formato === 5) {                                          // RGB5A3
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { pon(bx + x, by + y, rgb5a3(u16(p))); p += 2; }
    } else if (formato === 6) {                                          // RGBA8: AR… y después GB…
      for (let i = 0; i < 16; i++) pon(bx + (i & 3), by + (i >> 2), [b[p + 2 * i + 1], b[p + 32 + 2 * i], b[p + 32 + 2 * i + 1], b[p + 2 * i]]);
      p += 64;
    } else {                                                             // CMPR
      for (let s = 0; s < 4; s++) {
        const c0 = u16(p), c1 = u16(p + 2), pal = [rgb565(c0), rgb565(c1)];
        if (c0 > c1) pal.push(pal[0].map((v, i) => i < 3 ? Math.round((2 * v + pal[1][i]) / 3) : 255), pal[0].map((v, i) => i < 3 ? Math.round((v + 2 * pal[1][i]) / 3) : 255));
        else pal.push(pal[0].map((v, i) => i < 3 ? (v + pal[1][i]) >> 1 : 255), [0, 0, 0, 0]);
        const sx = bx + (s & 1) * 4, sy = by + (s >> 1) * 4;
        for (let y = 0; y < 4; y++) { const fila = b[p + 4 + y]; for (let x = 0; x < 4; x++) pon(sx + x, sy + y, pal[(fila >> (6 - 2 * x)) & 3]); }
        p += 8;
      }
    }
  }
  return out;
}

// RGBA → bytes de la Wii (para el banco: I8, IA8, RGB565, RGB5A3 y RGBA8; redondea como lo haría una conversión)
export function codificar(rgba, ancho, alto, formato) {
  const b0 = BALDOSA[formato];
  if (!b0 || ![1, 3, 4, 5, 6].includes(formato)) throw new Error('el banco no codifica el formato ' + formato);
  const out = new Uint8Array(tamTextura(ancho, alto, formato));
  const px = (x, y) => (x < ancho && y < alto ? [...rgba.subarray((y * ancho + x) * 4, (y * ancho + x) * 4 + 4)] : [0, 0, 0, 0]);
  const red = (v, bits) => Math.round(v * ((1 << bits) - 1) / 255);
  const gris = ([r, g, bl]) => Math.round(0.299 * r + 0.587 * g + 0.114 * bl);
  let p = 0;
  const [bw, bh] = b0;
  for (let by = 0; by < alto; by += bh) for (let bx = 0; bx < ancho; bx += bw) {
    if (formato === 6) {
      for (let i = 0; i < 16; i++) { const [r, g, bl, a] = px(bx + (i & 3), by + (i >> 2)); out[p + 2 * i] = a; out[p + 2 * i + 1] = r; out[p + 32 + 2 * i] = g; out[p + 32 + 2 * i + 1] = bl; }
      p += 64;
      continue;
    }
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const c = px(bx + x, by + y);
      if (formato === 1) out[p++] = gris(c);
      else if (formato === 3) { out[p++] = c[3]; out[p++] = gris(c); }
      else {
        const v = formato === 4 ? red(c[0], 5) << 11 | red(c[1], 6) << 5 | red(c[2], 5)
          : c[3] >= 224 ? 0x8000 | red(c[0], 5) << 10 | red(c[1], 5) << 5 | red(c[2], 5)
          : red(c[3], 3) << 12 | red(c[0], 4) << 8 | red(c[1], 4) << 4 | red(c[2], 4);
        out[p++] = v >> 8; out[p++] = v & 0xFF;
      }
    }
  }
  return out;
}
