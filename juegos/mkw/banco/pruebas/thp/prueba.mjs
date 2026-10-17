// Prueba del decodificador THP nativo con cuadros FALSOS (nada del juego): lo común a Node y a la página.
//
// Resumen: este archivo trae su propio codificador JPEG de línea base (el estándar T.81 con las tablas de ejemplo
// de su anexo K), que arma cuadros "estilo THP" (4:2:0, sin el relleno 0xFF00) a partir de imágenes sintéticas:
// degradados, círculos, bordes filosos y ruido. Como el codificador sabe exactamente qué números guardó, se puede
// calcular la imagen que DEBE salir con la IDCT exacta (la fórmula directa, en doble precisión) y compararla con lo
// que devuelve el decodificador nativo (thp.wasm), que usa la IDCT rápida en float.
// También prueba la forma de las texturas (baldosas de 8×4 de la GPU de la Wii), datos cortados, datos basura,
// formatos que no soporta, y cuánto tarda un cuadro del tamaño del video de elegir copa (672×736).

// ---------------------------------------------------------------------------------------------------------------
// Tablas del anexo K de T.81 (ejemplos públicos del estándar)
// ---------------------------------------------------------------------------------------------------------------
const ZIGZAG = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6,
  7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60,
  61, 54, 47, 55, 62, 63];
const Q_LUMA = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17,
  22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121,
  120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
const Q_CROMA = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66,
  99, 99, 99, 99, 99, 99, ...Array(32).fill(99)];
const HUFF = {
  dcLuma: { bits: [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], vals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  dcCroma: { bits: [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], vals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  acLuma: { bits: [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d], vals: [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14,
    0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09,
    0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a,
    0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65,
    0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88,
    0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9,
    0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca,
    0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea,
    0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa] },
  acCroma: { bits: [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77], vals: [
    0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32,
    0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16,
    0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39,
    0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64,
    0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86,
    0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
    0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8,
    0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9,
    0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa] },
};

// Códigos canónicos de una tabla (como los arma el decodificador): símbolo → [código, largo]
function codigos(t) {
  const m = new Map();
  let codigo = 0, k = 0;
  for (let largo = 1; largo <= 16; largo++) {
    for (let i = 0; i < t.bits[largo - 1]; i++) m.set(t.vals[k++], [codigo++, largo]);
    codigo <<= 1;
  }
  return m;
}

// Tabla de cuantización con "calidad" 1..100 (la fórmula de escala de libjpeg/IJG), en orden natural
const escalarQ = (base, calidad) => {
  const e = calidad < 50 ? 5000 / calidad : 200 - 2 * calidad;
  return base.map(v => Math.min(255, Math.max(1, Math.floor((v * e + 50) / 100))));
};

// Matriz de la DCT de 8 puntos: M[k][n] = ½·C(k)·cos((2n+1)kπ/16), C(0) = 1/√2. F = M·b·Mᵀ y b = Mᵀ·F·M.
const M = [...Array(8)].map((_, k) => [...Array(8)].map((_, n) =>
  0.5 * (k ? 1 : Math.SQRT1_2) * Math.cos((2 * n + 1) * k * Math.PI / 16)));
const dct = b => {         // b y el resultado: 64 números, orden natural (fila × 8 + columna)
  const t = new Float64Array(64), F = new Float64Array(64);
  for (let k = 0; k < 8; k++) for (let x = 0; x < 8; x++) { let s = 0; for (let y = 0; y < 8; y++) s += M[k][y] * b[y * 8 + x]; t[k * 8 + x] = s; }
  for (let k = 0; k < 8; k++) for (let l = 0; l < 8; l++) { let s = 0; for (let x = 0; x < 8; x++) s += t[k * 8 + x] * M[l][x]; F[k * 8 + l] = s; }
  return F;
};
const idct = F => {
  const t = new Float64Array(64), b = new Float64Array(64);
  for (let y = 0; y < 8; y++) for (let l = 0; l < 8; l++) { let s = 0; for (let k = 0; k < 8; k++) s += M[k][y] * F[k * 8 + l]; t[y * 8 + l] = s; }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { let s = 0; for (let l = 0; l < 8; l++) s += t[y * 8 + l] * M[l][x]; b[y * 8 + x] = s; }
  return b;
};

// ---------------------------------------------------------------------------------------------------------------
// Codificador de cuadros "estilo THP". Entrada: tres planos lineales (Y ancho×alto; U y V a la mitad).
// Devuelve los bytes y la imagen que DEBE salir (IDCT exacta de lo que se guardó, redondeada).
// ---------------------------------------------------------------------------------------------------------------
export function codificarTHP(ancho, alto, planos, calidad = 90) {
  const qs = [escalarQ(Q_LUMA, calidad), escalarQ(Q_CROMA, calidad)];
  const tablas = [[codigos(HUFF.dcLuma), codigos(HUFF.acLuma)], [codigos(HUFF.dcCroma), codigos(HUFF.acCroma)]];
  const esperado = [new Uint8Array(ancho * alto), new Uint8Array(ancho * alto / 4), new Uint8Array(ancho * alto / 4)];
  const bytes = [];
  let acumulado = 0, nbits = 0;
  const escribir = (codigo, largo) => {          // bits al flujo, el más alto primero; SIN relleno 0xFF00 (THP)
    for (let i = largo - 1; i >= 0; i--) {
      acumulado = (acumulado << 1) | ((codigo >> i) & 1);
      if (++nbits === 8) { bytes.push(acumulado); acumulado = 0; nbits = 0; }
    }
  };
  const categoria = v => { let a = Math.abs(v), n = 0; while (a) { n++; a >>= 1; } return n; };
  const valorBits = (v, n) => v >= 0 ? v : v + (1 << n) - 1;
  const pred = [0, 0, 0];
  const bloque = (comp, plano, anchoPlano, bx, by) => {
    const b = new Float64Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) b[y * 8 + x] = plano[(by * 8 + y) * anchoPlano + bx * 8 + x] - 128;
    const F = dct(b), q = qs[comp ? 1 : 0], [tdc, tac] = tablas[comp ? 1 : 0];
    const cq = F.map((v, i) => Math.round(v / q[i]));          // cuantizar
    // DC: diferencia con el anterior
    const dif = cq[0] - pred[comp]; pred[comp] = cq[0];
    const n = categoria(dif); escribir(...tdc.get(n)); if (n) escribir(valorBits(dif, n), n);
    // AC en zigzag
    let ceros = 0;
    for (let k = 1; k < 64; k++) {
      const v = cq[ZIGZAG[k]];
      if (v === 0) { ceros++; continue; }
      while (ceros > 15) { escribir(...tac.get(0xF0)); ceros -= 16; }
      const s = categoria(v); escribir(...tac.get(ceros * 16 + s)); escribir(valorBits(v, s), s); ceros = 0;
    }
    if (ceros) escribir(...tac.get(0x00));
    // Lo que debe salir: IDCT exacta de lo guardado, +128, redondeado al más cercano, recortado a 0..255
    const r = idct(cq.map((v, i) => v * q[i]));
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
      esperado[comp][(by * 8 + y) * anchoPlano + bx * 8 + x] = Math.min(255, Math.max(0, Math.floor(r[y * 8 + x] + 128 + 0.5)));
  };
  for (let my = 0; my < alto / 16; my++) for (let mx = 0; mx < ancho / 16; mx++) {
    for (let i = 0; i < 4; i++) bloque(0, planos[0], ancho, 2 * mx + (i & 1), 2 * my + (i >> 1));
    bloque(1, planos[1], ancho / 2, mx, my);
    bloque(2, planos[2], ancho / 2, mx, my);
  }
  if (nbits) escribir(0xFF, 8 - nbits);            // completar el último byte con unos (como manda T.81)
  // Cabecera: SOI, 2 DQT, SOF0, 4 DHT, SOS (como los THP del juego), datos, EOI
  const seg = (marca, contenido) => [0xFF, marca, (contenido.length + 2) >> 8, (contenido.length + 2) & 255, ...contenido];
  const cab = [0xFF, 0xD8,
    ...seg(0xDB, [0x00, ...ZIGZAG.map(n => qs[0][n])]), ...seg(0xDB, [0x01, ...ZIGZAG.map(n => qs[1][n])]),
    ...seg(0xC0, [8, alto >> 8, alto & 255, ancho >> 8, ancho & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]),
    ...seg(0xC4, [0x00, ...HUFF.dcLuma.bits, ...HUFF.dcLuma.vals]), ...seg(0xC4, [0x10, ...HUFF.acLuma.bits, ...HUFF.acLuma.vals]),
    ...seg(0xC4, [0x01, ...HUFF.dcCroma.bits, ...HUFF.dcCroma.vals]), ...seg(0xC4, [0x11, ...HUFF.acCroma.bits, ...HUFF.acCroma.vals]),
    ...seg(0xDA, [3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0])];
  const todo = new Uint8Array(cab.length + bytes.length + 2);
  todo.set(cab); todo.set(bytes, cab.length); todo.set([0xFF, 0xD9], cab.length + bytes.length);
  return { bytes: todo, inicioDatos: cab.length, esperado };
}

// De textura I8 (baldosas de 8×4) a imagen lineal
export function desembaldosar(textura, ancho, alto) {
  const lineal = new Uint8Array(ancho * alto), porFila = ancho / 8;
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++)
    lineal[y * ancho + x] = textura[((y >> 2) * porFila + (x >> 3)) * 32 + (y & 3) * 8 + (x & 7)];
  return lineal;
}

// Imagen sintética con todo lo difícil: degradados (bloques casi lisos), círculos y franjas (bordes), ruido (todas
// las frecuencias) y zonas saturadas en 0 y 255 (el recorte). Generador de azar con semilla: siempre la misma.
export function imagenSintetica(ancho, alto, semilla = 1) {
  let s = semilla >>> 0;
  const azar = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const Y = new Uint8Array(ancho * alto), U = new Uint8Array(ancho * alto / 4), V = new Uint8Array(ancho * alto / 4);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    let v = 255 * x / ancho;                                                    // degradado
    if (Math.hypot(x - ancho * 0.3, y - alto * 0.4) < alto * 0.2) v = 230;      // círculo claro
    if (Math.hypot(x - ancho * 0.7, y - alto * 0.6) < alto * 0.15) v = 20;      // círculo oscuro
    if (y > alto * 0.8) v = ((x >> 2) & 1) ? 255 : 0;                           // franjas finas (frecuencia alta)
    if (y < alto * 0.1 && x > ancho / 2) v += (azar() - 0.5) * 120;             // ruido
    Y[y * ancho + x] = Math.max(0, Math.min(255, Math.round(v)));
  }
  for (let y = 0; y < alto / 2; y++) for (let x = 0; x < ancho / 2; x++) {
    U[y * ancho / 2 + x] = Math.round(128 + 100 * Math.sin(x / 9) * Math.cos(y / 13));
    V[y * ancho / 2 + x] = Math.round(128 + 90 * Math.cos((x + y) / 17));
  }
  return [Y, U, V];
}

// ---------------------------------------------------------------------------------------------------------------
// La prueba
// ---------------------------------------------------------------------------------------------------------------
export async function correTHP(crea, ok, nota) {
  const W = await crea({ print: () => {}, printErr: () => {} });
  const RES = ['bien', 'no soportado', 'corrupto', 'falta entrada'];
  // Decodificar con el wasm: copia los bytes (+8 de margen, el decodificador lee de a 8) y devuelve las texturas
  const decodificar = (bytes, redondeo = 0.5, tam = bytes.length) => {
    const pDatos = W._malloc(bytes.length + 8), pDim = W._malloc(8);
    W.HEAPU8.set(bytes, pDatos); W.HEAPU8.fill(0, pDatos + bytes.length, pDatos + bytes.length + 8);
    const rc = W._thp_cabecera(pDatos, tam, pDim, pDim + 4);
    const ancho = W.HEAP32[pDim >> 2], alto = W.HEAP32[(pDim >> 2) + 1];
    W._free(pDim);
    if (rc !== 0) { W._free(pDatos); return { cabecera: rc, ancho, alto }; }
    const pY = W._malloc(ancho * alto), pU = W._malloc(ancho * alto / 4), pV = W._malloc(ancho * alto / 4);
    const rd = W._thp_decodificar(pDatos, tam, pY, pU, pV, redondeo);
    return { cabecera: rc, ancho, alto, resultado: rd, Y: W.HEAPU8.slice(pY, pY + ancho * alto),
             U: W.HEAPU8.slice(pU, pU + ancho * alto / 4), V: W.HEAPU8.slice(pV, pV + ancho * alto / 4), pDatos, pY, pU, pV };
  };
  const liberar = r => { for (const p of [r.pDatos, r.pY, r.pU, r.pV]) if (p) W._free(p); };
  const comparar = (a, b) => {
    let iguales = 0, max = 0;
    for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (!d) iguales++; if (d > max) max = d; }
    return { exactos: 100 * iguales / a.length, max };
  };

  // 1-3. Los tamaños de los videos del juego (el de elegir copa y los de cada copa) y uno de un solo MCU
  for (const [ancho, alto, cual] of [[672, 736, 'elegir copa'], [400, 576, 'cada copa'], [16, 16, 'un solo MCU']]) {
    const planos = imagenSintetica(ancho, alto, ancho);
    const c = codificarTHP(ancho, alto, planos);
    const r = decodificar(c.bytes);
    const datos = c.bytes.subarray(c.inicioDatos, c.bytes.length - 2);
    let ffSinCero = 0;
    for (let i = 0; i + 1 < datos.length; i++) if (datos[i] === 0xFF && datos[i + 1] !== 0) ffSinCero++;
    const cmp = [comparar(desembaldosar(r.Y, ancho, alto), c.esperado[0]),
                 comparar(desembaldosar(r.U, ancho / 2, alto / 2), c.esperado[1]),
                 comparar(desembaldosar(r.V, ancho / 2, alto / 2), c.esperado[2])];
    const peor = Math.max(...cmp.map(x => x.max)), exactos = Math.min(...cmp.map(x => x.exactos));
    ok(`${ancho}×${alto} (${cual}): igual a la IDCT exacta (±1 como mucho, ≥ 99 % idénticos)`,
       r.cabecera === 0 && r.resultado === 0 && r.ancho === ancho && r.alto === alto && peor <= 1 && exactos >= 99,
       `${RES[r.resultado ?? r.cabecera]}; Y/U/V idénticos ${cmp.map(x => x.exactos.toFixed(2) + ' %').join(' / ')}, ` +
       `diferencia máxima ${peor}; ${c.bytes.length} bytes, ${ffSinCero} bytes 0xFF sin relleno en los datos`);
    liberar(r);
  }

  // 4. Las baldosas: un píxel blanco en (x, y) tiene que caer en ((y/4)·(ancho/8) + x/8)·32 + (y%4)·8 + x%8
  {
    const ancho = 32, alto = 32, Y = new Uint8Array(ancho * alto).fill(16);
    for (let y = 8; y < 16; y++) for (let x = 16; x < 24; x++) Y[y * ancho + x] = 235;   // un bloque claro en (2, 1)
    const c = codificarTHP(ancho, alto, [Y, new Uint8Array(256).fill(128), new Uint8Array(256).fill(128)], 100);
    const r = decodificar(c.bytes);
    const enBaldosa = (x, y) => r.Y[((y >> 2) * (ancho / 8) + (x >> 3)) * 32 + (y & 3) * 8 + (x & 7)];
    const bien = enBaldosa(16, 8) > 200 && enBaldosa(23, 15) > 200 && enBaldosa(15, 8) < 50 && enBaldosa(16, 16) < 50
      && r.Y[(2 * 4 + 2) * 32] > 200 && r.Y[(2 * 4 + 2) * 32 - 1] < 50;
    ok('texturas I8 en baldosas de 8×4 (lo que espera la GPU de la Wii)', bien,
       `bloque claro en baldosas ${(2 * 4 + 2)} y ${(3 * 4 + 2)}; byte ${(2 * 4 + 2) * 32} = ${r.Y[(2 * 4 + 2) * 32]}`);
    liberar(r);
  }

  // 5. Datos cortados por la mitad: debe pedir más ("falta entrada"), sin colgarse ni leer fuera
  {
    const c = codificarTHP(64, 64, imagenSintetica(64, 64, 5));
    const r = decodificar(c.bytes, 0.5, c.inicioDatos + 40);
    ok('datos cortados → "falta entrada"', r.resultado === 3, RES[r.resultado ?? r.cabecera]);
    liberar(r);
  }

  // 6. Basura en vez de datos: corrupto o falta entrada, nunca un cuelgue
  {
    const c = codificarTHP(64, 64, imagenSintetica(64, 64, 6));
    for (let i = c.inicioDatos; i < c.bytes.length; i++) c.bytes[i] = 0xFF;   // 0xFF..: códigos que no existen
    const r = decodificar(c.bytes);
    ok('datos basura → "corrupto" (sin colgarse)', r.resultado === 2 || r.resultado === 3, RES[r.resultado ?? r.cabecera]);
    liberar(r);
  }

  // 7. Un JPEG 4:4:4 (color a resolución completa): válido, pero no es THP → "no soportado" (el juego usa el traducido)
  {
    const c = codificarTHP(32, 32, imagenSintetica(32, 32, 7));
    const i = c.bytes.findIndex((b, k) => b === 0xFF && c.bytes[k + 1] === 0xC0);
    c.bytes[i + 4 + 7] = 0x11;            // Y 1×1 en vez de 2×2
    const r = decodificar(c.bytes);
    ok('JPEG 4:4:4 → "no soportado"', r.cabecera === 1, RES[r.cabecera]);
  }

  // 8. Cuánto tarda un cuadro de 672×736 (el video de elegir copa; el juego lo decodifica 60 veces por segundo)
  {
    const c = codificarTHP(672, 736, imagenSintetica(672, 736, 9), 92);
    decodificar(c.bytes);                                             // calentar
    const tiempos = [];
    for (let i = 0; i < 15; i++) { const t = performance.now(); liberar(decodificar(c.bytes)); tiempos.push(performance.now() - t); }
    tiempos.sort((a, b) => a - b);
    const ms = tiempos[7];
    ok('un cuadro de 672×736 en menos de 6 ms', ms < 6,
       `mediana ${ms.toFixed(2)} ms (con copiar entrada y salida), ${(c.bytes.length / 1024).toFixed(0)} KB comprimidos`);
  }
  nota('codificador y referencia: este archivo (T.81 anexo K, IDCT exacta en doble precisión); decodificador: web/thp/thp_decodificador.cpp');
}
