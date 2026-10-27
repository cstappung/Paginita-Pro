// Las letras del juego en la página (bitácora §78): abre una fuente de la Wii (.brfnt) y escribe con sus glifos.
//
// Resumen: el contador de los que faltan (dnf.mjs) tiene que verse como la cuenta «3, 2, 1» de la salida. Esa cuenta
// la dibuja el juego con letras de su archivo de fuentes (UI/Font.szs de Retro Rewind, el que el juego carga en lugar
// de Scene/UI/Font.szs), que el navegador ya bajó para el juego. Este módulo lo abre en la página: nada del juego se
// copia a git ni se sube aparte; se lee del mismo disco y en el momento.
//   Font.szs = un U8 (carpeta empaquetada) comprimido con Yaz0 → adentro, varios .brfnt. Un BRFNT trae:
//     FINF  datos de la fuente (alto de línea, ascenso…)
//     TGLP  las hojas de glifos: imágenes grandes con todos los glifos en celdas iguales (celdaW × celdaH), en un
//           formato de textura de la Wii (estas son IA4: 4 bits de intensidad y 4 de opacidad por píxel)
//     CWDH  el ancho de cada glifo (espacio a la izquierda, ancho dibujado, avance)
//     CMAP  qué glifo es cada letra (por tramos, por tabla o por pares)
//   Las letras de la cuenta son «de contorno»: la intensidad dice si el píxel es relleno (1) o borde (0) y la opacidad
//   dice si hay letra. El juego las colorea mezclando dos colores del material («negro» para el borde, «blanco» para
//   el relleno) y multiplicando por el degradado de la caja de texto (arriba → abajo). Aquí se hace igual, píxel por
//   píxel: color = mezcla(borde, relleno, intensidad) × degradado; opacidad = la del glifo.
//   Como un tablero de LEDs bicolor: cada píxel de la hoja dice «rojo, verde o apagado» y el color real lo pone la
//   fuente de poder de cada color (la paleta), no la hoja.
// Los formatos son públicos (wiki.tockdom.com: Yaz0, U8, BRFNT, texturas de la GameCube/Wii). Yaz0 y U8 son los
// mismos de herramientas/szs.mjs (que es para Node y no se puede cargar en la página).
//
// Uso:  const archivos = abrirSzs(bytes);  const f = abrirBrfnt(archivos.get('/kart_kanji_font.brfnt'));
//       f.tiene('7') · pintar(f, '30', paleta, documento) → <canvas> del tamaño natural de las letras

// Yaz0 → bytes (cada byte de control dice, bit a bit, si viene un byte tal cual o una copia de algo ya escrito)
export function yaz0(b) {
  if (b[0] !== 0x59 || b[1] !== 0x61 || b[2] !== 0x7A || b[3] !== 0x30) return b;   // 'Yaz0'; si no, no está comprimido
  const tam = (b[4] << 24 | b[5] << 16 | b[6] << 8 | b[7]) >>> 0;
  const out = new Uint8Array(tam);
  let i = 16, o = 0;
  while (o < tam) {
    const control = b[i++];
    for (let bit = 7; bit >= 0 && o < tam; bit--) {
      if (control & (1 << bit)) { out[o++] = b[i++]; continue; }
      const b1 = b[i++], b2 = b[i++];
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
  const raiz = v.getUint32(4), total = v.getUint32(raiz + 8), nombres = raiz + total * 12;
  const nombre = off => { let s = '', p = nombres + off; while (b[p]) s += String.fromCharCode(b[p++]); return s; };
  const archivos = new Map(), pila = [[total, '']];
  for (let n = 1; n < total; n++) {
    while (pila.length > 1 && n >= pila[pila.length - 1][0]) pila.pop();
    const p = raiz + n * 12, ruta = pila[pila.length - 1][1] + '/' + nombre(v.getUint32(p) & 0xFFFFFF);
    if (b[p] === 1) pila.push([v.getUint32(p + 8), ruta]);
    else archivos.set(ruta.replace(/^\/\./, ''), b.subarray(v.getUint32(p + 4), v.getUint32(p + 4) + v.getUint32(p + 8)));
  }
  return archivos;
}
export const abrirSzs = bytes => u8(yaz0(bytes));

// BRFNT → la fuente: sus medidas, qué glifo es cada letra y la máscara (intensidad + opacidad) de cada glifo
export function abrirBrfnt(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = o => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (tag(0) !== 'RFNT') throw new Error('no es un BRFNT');
  let tglp = null, finf = null;
  const anchos = [], mapas = [];
  for (let o = v.getUint16(12); o < b.length - 8;) {
    const t = tag(o), n = v.getUint32(o + 4);
    if (t === 'FINF') finf = { alto: b[o + 0x1C], ancho: b[o + 0x1D], ascenso: b[o + 0x1E] };
    if (t === 'TGLP') tglp = { celdaW: b[o + 8], celdaH: b[o + 9], base: b[o + 10], hojaTam: v.getUint32(o + 12),
      formato: v.getUint16(o + 18), porFila: v.getUint16(o + 20), hojaW: v.getUint16(o + 24), hojaH: v.getUint16(o + 26),
      porCol: v.getUint16(o + 22), hojas: v.getUint16(o + 16), datos: v.getUint32(o + 28) };
    if (t === 'CWDH') {                                  // [espacio a la izquierda (con signo), ancho dibujado, avance]
      const i0 = v.getUint16(o + 8), i1 = v.getUint16(o + 10);
      for (let i = i0; i <= i1; i++) { const q = o + 16 + (i - i0) * 3; anchos[i] = { izq: v.getInt8(q), ancho: b[q + 1], avance: b[q + 2] }; }
    }
    if (t === 'CMAP') mapas.push({ ini: v.getUint16(o + 8), fin: v.getUint16(o + 10), metodo: v.getUint16(o + 12), o });
    if (n <= 0) break;
    o += n;
  }
  if (!tglp || ![0, 1, 2, 3].includes(tglp.formato)) throw new Error('hoja de glifos que no se sabe leer');
  const indice = c => {                                  // código de la letra → número de glifo (−1 = no está)
    for (const m of mapas) {
      if (c < m.ini || c > m.fin) continue;
      if (m.metodo === 0) return v.getUint16(m.o + 20) + (c - m.ini);                       // un tramo seguido
      if (m.metodo === 1) { const g = v.getUint16(m.o + 20 + (c - m.ini) * 2); if (g !== 0xFFFF) return g; }   // tabla
      if (m.metodo === 2) { const k = v.getUint16(m.o + 20); for (let i = 0; i < k; i++) if (v.getUint16(m.o + 22 + i * 4) === c) return v.getUint16(m.o + 24 + i * 4); }
    }
    return -1;
  };
  // La máscara de un glifo: su celda de la hoja, píxel por píxel (las celdas van con 1 px de separación).
  // Texturas de la Wii en baldosas: I4 8×8, I8 8×4, IA4 8×4, IA8 4×4 píxeles (formatos 0, 1, 2, 3).
  const [bw, bh] = { 0: [8, 8], 1: [8, 4], 2: [8, 4], 3: [4, 4] }[tglp.formato];
  const bytesPx = { 0: 0.5, 1: 1, 2: 1, 3: 2 }[tglp.formato];
  const baldosasFila = Math.ceil(tglp.hojaW / bw);
  const porHoja = tglp.porFila * tglp.porCol;            // glifos por hoja (filas × columnas de celdas)
  function pixel(hoja, x, y) {                           // → [intensidad 0..1, opacidad 0..1]
    const tx = Math.floor(x / bw), ty = Math.floor(y / bh), dentro = (y % bh) * bw + (x % bw);
    const p = tglp.datos + hoja * tglp.hojaTam + (ty * baldosasFila + tx) * bw * bh * bytesPx;
    switch (tglp.formato) {
      case 0: { const c = b[p + (dentro >> 1)]; const i = (dentro & 1 ? c & 15 : c >> 4) / 15; return [i, i]; }   // I4: gris = opacidad
      case 1: { const i = b[p + dentro] / 255; return [i, i]; }
      case 2: { const c = b[p + dentro]; return [(c & 15) / 15, (c >> 4) / 15]; }                // IA4: opacidad arriba, intensidad abajo
      default: return [b[p + dentro * 2 + 1] / 255, b[p + dentro * 2] / 255];                    // IA8
    }
  }
  const mascaras = new Map();
  function mascara(g) {
    if (mascaras.has(g)) return mascaras.get(g);
    const hoja = Math.floor(g / porHoja), k = g % porHoja;
    const x0 = (k % tglp.porFila) * (tglp.celdaW + 1), y0 = Math.floor(k / tglp.porFila) * (tglp.celdaH + 1);
    const w = tglp.celdaW, h = tglp.celdaH, i = new Float32Array(w * h), a = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [pi, pa] = pixel(hoja, x0 + x, y0 + y); i[y * w + x] = pi; a[y * w + x] = pa; }
    const m = { w, h, i, a };
    mascaras.set(g, m);
    return m;
  }
  const glifo = ch => {
    const g = indice(ch.codePointAt(0));
    if (g < 0 || g >= tglp.hojas * porHoja) return null;
    return { g, ...(anchos[g] || { izq: 0, ancho: tglp.celdaW, avance: tglp.celdaW }) };
  };
  return { celdaW: tglp.celdaW, celdaH: tglp.celdaH, base: tglp.base, alto: finf?.alto ?? tglp.celdaH,
           glifo, mascara, tiene: texto => [...texto].every(ch => ch === ' ' || glifo(ch)) };
}

// Las filas que de verdad tienen letra (para que dos fuentes distintas queden del mismo alto en pantalla)
export function filasConTinta(f, texto) {
  let y0 = Infinity, y1 = -1;
  for (const ch of texto) {
    const gl = f.glifo(ch); if (!gl) continue;
    const m = f.mascara(gl.g);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.a[y * m.w + x] > 0.2) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
  }
  return y1 < 0 ? null : { y0, y1 };
}

// Escribe `texto` con la fuente `f` en un <canvas> (o en `lienzo`, que se reusa) del tamaño natural de los glifos.
// paleta: { borde: [r,g,b], relleno: [r,g,b], arriba: [r,g,b], abajo: [r,g,b] } (el degradado de la caja de texto).
// recorte: { y0, y1 } = las filas a dejar (filasConTinta), con 2 px de margen; sin él, la celda entera.
export function pintar(f, texto, paleta, documento = globalThis.document, lienzo = null, recorte = null) {
  const letras = [...texto].map(ch => ch === ' ' ? { espacio: true, avance: Math.round(f.celdaW * 0.35) } : f.glifo(ch)).filter(Boolean);
  // dónde cae cada glifo: la pluma avanza `avance`; el dibujo empieza en pluma + izq (puede ser negativo) y mide `ancho`
  let pluma = 0, x0 = Infinity, x1 = -Infinity;
  for (const l of letras) {
    if (!l.espacio) { x0 = Math.min(x0, pluma + l.izq); x1 = Math.max(x1, pluma + l.izq + l.ancho); }
    pluma += l.avance;
  }
  if (x1 < x0) { x0 = 0; x1 = 1; }
  const y0 = recorte ? Math.max(0, recorte.y0 - 2) : 0, y1 = recorte ? Math.min(f.celdaH - 1, recorte.y1 + 2) : f.celdaH - 1;
  const c = lienzo || documento.createElement('canvas');
  c.width = x1 - x0 + 2; c.height = y1 - y0 + 1;           // (+1 px a cada lado: el borde suavizado no se corta)
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height), d = img.data;
  const { borde, relleno, arriba, abajo } = paleta;
  pluma = 0;
  for (const l of letras) {
    if (l.espacio) { pluma += l.avance; continue; }
    const m = f.mascara(l.g);
    for (let y = y0; y <= y1; y++) {
      const t = m.h > 1 ? y / (m.h - 1) : 0;             // el degradado va de arriba a abajo de la celda
      const dr = arriba[0] + (abajo[0] - arriba[0]) * t, dg = arriba[1] + (abajo[1] - arriba[1]) * t, db = arriba[2] + (abajo[2] - arriba[2]) * t;
      for (let x = 0; x < Math.min(m.w, l.ancho + 1); x++) {
        const a1 = m.a[y * m.w + x]; if (!a1) continue;
        const X = pluma + l.izq + x - x0 + 1; if (X < 0 || X >= c.width) continue;
        const it = m.i[y * m.w + x], q = ((y - y0) * c.width + X) * 4;
        const r = (borde[0] + (relleno[0] - borde[0]) * it) * dr / 255, g = (borde[1] + (relleno[1] - borde[1]) * it) * dg / 255,
              bl = (borde[2] + (relleno[2] - borde[2]) * it) * db / 255;
        // dos glifos que se tocan: el de la derecha va «por encima» (mezcla de opacidades, como pintar con acuarela)
        const a0 = d[q + 3] / 255, ao = a1 + a0 * (1 - a1);
        d[q] = (r * a1 + d[q] * a0 * (1 - a1)) / ao; d[q + 1] = (g * a1 + d[q + 1] * a0 * (1 - a1)) / ao; d[q + 2] = (bl * a1 + d[q + 2] * a0 * (1 - a1)) / ao;
        d[q + 3] = ao * 255;
      }
    }
    pluma += l.avance;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
