// Los Mii de la Wii: leer, editar y volver a escribir un Mii y la base de Mii (RFL_DB.dat) — bitácora §55.
//
// Resumen: cada Mii son 74 bytes (0x4A) con todos sus rasgos apretados en campos de pocos bits (el formato es
// público: wiibrew.org/wiki/Mii_data). La Wii guarda hasta 100 Mii en la memoria interna, en
// /shared2/menu/FaceLib/RFL_DB.dat. Mario Kart Wii lee esa base para dejarte elegir el Mii de tu licencia. Este
// módulo:
//   1. desarma un Mii (74 bytes) en un objeto con nombres claros ({ nombre, esChica, pelo: {tipo, color}, ojos… }) y
//      lo vuelve a armar (para el editor de "Mi Mii");
//   2. lee y escribe la base completa (RFL_DB.dat), con su suma de control al final (CRC-16/XMODEM, la misma que la
//      Wii usa para los Mii: si no cuadra, la Wii trata la base como dañada);
//   3. dibuja una vista previa APROXIMADA en SVG (formas nuestras, no el dibujo de Nintendo: alcanza para ver el color
//      de piel, el pelo, los lentes… mientras se edita).
//
// Los campos van "del bit más alto al más bajo": p. ej. los 2 primeros bytes de un Mii (16 bits) son
//   [inválido:1][esChica:1][mes:4][día:5][colorFavorito:4][favorito:1]
// Para leerlos se usa un "lector de bits" que va tomando de a N bits desde la izquierda (como leer un número binario
// dígito a dígito); para escribirlos, el mismo camino al revés. Así el formato se describe UNA vez (en CAMPOS) y sirve
// para leer y para escribir.

const TAM_MII = 0x4A;                       // 74 bytes
export const TAM_RFLDB = 0x1F1E0;           // tamaño de RFL_DB.dat
const POS_CRC_DB = 0x1F1DE;                 // CRC-16 de los primeros 0x1F1DE bytes, guardado ahí (big-endian)
export const MAX_MII = 100;
export const RUTA_RFLDB = '/datos/WiiCompiled/NAND/shared2/menu/FaceLib/RFL_DB.dat';
export const COLORES_FAVORITOS = ['rojo', 'naranja', 'amarillo', 'verde claro', 'verde', 'azul', 'celeste', 'rosado', 'morado', 'café', 'blanco', 'negro'];
export const COLORES_HEX = ['#d21e14', '#ff6e19', '#ffd820', '#78d220', '#007830', '#0a48b4', '#3caade', '#f55a7d', '#7328ad', '#483818', '#e0e0e0', '#181814'];

// El formato, de arriba abajo: [byte donde empieza el grupo, tamaño del grupo en bytes, [campo, bits]…].
// Los campos que se llaman '_' son bits sin uso conocido: se conservan tal cual vinieron (para no romper nada).
const GRUPOS = [
  [0x00, 2, [['invalido', 1], ['esChica', 1], ['mes', 4], ['dia', 5], ['colorFavorito', 4], ['favorito', 1]]],
  [0x20, 2, [['cara.forma', 3], ['cara.piel', 3], ['cara.rasgo', 4], ['_a', 3], ['noMezclar', 1], ['_b', 1], ['descargado', 1]]],
  [0x22, 2, [['pelo.tipo', 7], ['pelo.color', 3], ['pelo.invertido', 1], ['_c', 5]]],
  [0x24, 4, [['cejas.tipo', 5], ['_d', 1], ['cejas.giro', 4], ['_e', 6], ['cejas.color', 3], ['cejas.tam', 4], ['cejas.alto', 5], ['cejas.sep', 4]]],
  [0x28, 4, [['ojos.tipo', 6], ['_f', 2], ['ojos.giro', 3], ['ojos.alto', 5], ['ojos.color', 3], ['_g', 1], ['ojos.tam', 3], ['ojos.sep', 4], ['_h', 5]]],
  [0x2C, 2, [['nariz.tipo', 4], ['nariz.tam', 4], ['nariz.alto', 5], ['_i', 3]]],
  [0x2E, 2, [['boca.tipo', 5], ['boca.color', 2], ['boca.tam', 4], ['boca.alto', 5]]],
  [0x30, 2, [['lentes.tipo', 4], ['lentes.color', 3], ['_j', 1], ['lentes.tam', 3], ['lentes.alto', 5]]],
  [0x32, 2, [['barba.bigote', 2], ['barba.tipo', 2], ['barba.color', 3], ['barba.tam', 4], ['barba.alto', 5]]],
  [0x34, 2, [['lunar.si', 1], ['lunar.tam', 4], ['lunar.alto', 5], ['lunar.x', 5], ['_k', 1]]],
];

// Qué muestra el editor de cada rasgo: [campo, etiqueta, mínimo, máximo]. Los rangos son los del editor de la Wii.
export const RASGOS = {
  Datos: [['altura', 'Altura', 0, 127], ['peso', 'Complexión', 0, 127], ['colorFavorito', 'Color favorito', 0, 11]],
  Cara: [['cara.forma', 'Forma', 0, 7], ['cara.piel', 'Piel', 0, 5], ['cara.rasgo', 'Rasgo', 0, 11]],
  Pelo: [['pelo.tipo', 'Peinado', 0, 71], ['pelo.color', 'Color', 0, 7], ['pelo.invertido', 'Invertir raya', 0, 1]],
  Cejas: [['cejas.tipo', 'Forma', 0, 23], ['cejas.color', 'Color', 0, 7], ['cejas.tam', 'Tamaño', 0, 8], ['cejas.alto', 'Altura', 3, 18], ['cejas.giro', 'Giro', 0, 11], ['cejas.sep', 'Separación', 0, 12]],
  Ojos: [['ojos.tipo', 'Forma', 0, 47], ['ojos.color', 'Color', 0, 5], ['ojos.tam', 'Tamaño', 0, 7], ['ojos.alto', 'Altura', 0, 18], ['ojos.giro', 'Giro', 0, 7], ['ojos.sep', 'Separación', 0, 12]],
  Nariz: [['nariz.tipo', 'Forma', 0, 11], ['nariz.tam', 'Tamaño', 0, 8], ['nariz.alto', 'Altura', 0, 18]],
  Boca: [['boca.tipo', 'Forma', 0, 23], ['boca.color', 'Color', 0, 2], ['boca.tam', 'Tamaño', 0, 8], ['boca.alto', 'Altura', 0, 18]],
  Lentes: [['lentes.tipo', 'Forma', 0, 8], ['lentes.color', 'Color', 0, 5], ['lentes.tam', 'Tamaño', 0, 7], ['lentes.alto', 'Altura', 0, 20]],
  Barba: [['barba.bigote', 'Bigote', 0, 3], ['barba.tipo', 'Barba', 0, 3], ['barba.color', 'Color', 0, 7], ['barba.tam', 'Tamaño', 0, 8], ['barba.alto', 'Altura', 0, 16]],
  Lunar: [['lunar.si', 'Lunar', 0, 1], ['lunar.tam', 'Tamaño', 0, 8], ['lunar.alto', 'Altura', 0, 30], ['lunar.x', 'Posición', 0, 16]],
};

// leer/escribir 'pelo.tipo' en un objeto anidado
const obtener = (o, ruta) => ruta.split('.').reduce((x, k) => x && x[k], o);
function poner(o, ruta, v) { const k = ruta.split('.'); let x = o; for (const p of k.slice(0, -1)) x = x[p] ??= {}; x[k.at(-1)] = v; }

function leerTexto(b, i, n) { let s = ''; for (let k = 0; k < n; k++) { const c = (b[i + 2 * k] << 8) | b[i + 2 * k + 1]; if (!c) break; s += String.fromCharCode(c); } return s; }
function escribirTexto(b, i, n, s) { for (let k = 0; k < n; k++) { const c = k < s.length ? s.charCodeAt(k) : 0; b[i + 2 * k] = c >> 8; b[i + 2 * k + 1] = c & 0xFF; } }

// 74 bytes → objeto
export function desarmarMii(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < TAM_MII) throw new Error('un Mii tiene 74 bytes');
  const m = {};
  for (const [pos, tam, campos] of GRUPOS) {
    let valor = 0n;                                      // BigInt para que 32 bits no pierdan el signo
    for (let k = 0; k < tam; k++) valor = (valor << 8n) | BigInt(b[pos + k]);
    let quedan = tam * 8;
    for (const [nombre, bits] of campos) {                // del bit más alto al más bajo
      quedan -= bits;
      poner(m, nombre, Number((valor >> BigInt(quedan)) & ((1n << BigInt(bits)) - 1n)));
    }
  }
  m.nombre = leerTexto(b, 0x02, 10);
  m.altura = b[0x16]; m.peso = b[0x17];
  m.id = [...b.subarray(0x18, 0x1C)];                    // 4 bytes: identifica al Mii (la licencia lo busca por esto)
  m.consola = [...b.subarray(0x1C, 0x20)];               // 4 bytes: la consola que lo creó
  m.creador = leerTexto(b, 0x36, 10);
  return m;
}

// objeto → 74 bytes
export function armarMii(m) {
  const b = new Uint8Array(TAM_MII);
  for (const [pos, tam, campos] of GRUPOS) {
    let valor = 0n, usados = 0;
    for (const [nombre, bits] of campos) {
      const max = (1 << bits) - 1;
      const v = Math.max(0, Math.min(max, Math.round(Number(obtener(m, nombre)) || 0)));
      valor = (valor << BigInt(bits)) | BigInt(v); usados += bits;
    }
    for (let k = tam - 1; k >= 0; k--) { b[pos + k] = Number(valor & 0xFFn); valor >>= 8n; }
  }
  escribirTexto(b, 0x02, 10, (m.nombre || 'Mii').slice(0, 10));
  b[0x16] = Math.max(0, Math.min(127, m.altura | 0)); b[0x17] = Math.max(0, Math.min(127, m.peso | 0));
  b.set((m.id || [0x80, 0, 0, 0]).slice(0, 4), 0x18);
  b.set((m.consola || [0, 0, 0, 0]).slice(0, 4), 0x1C);
  escribirTexto(b, 0x36, 10, (m.creador || '').slice(0, 10));
  return b;
}

// Un Mii nuevo con los valores del editor de la Wii (rasgos en el medio). El id: bit alto en 1 (Mii "normal") y los
// 29 bits de abajo = cuántos períodos de 4 segundos pasaron desde el 1/1/2006 (así lo arma la Wii; sirve para que dos
// Mii no tengan el mismo id). La consola: 4 bytes al azar (en una Wii de verdad son de la consola).
export function miiNuevo({ nombre = 'Mii', esChica = 0, ahora = Date.now(), azar = Math.random } = {}) {
  const ticks = Math.max(0, Math.floor((ahora - Date.UTC(2006, 0, 1)) / 4000)) & 0x1FFFFFFF;
  const id = [0x80 | (ticks >>> 24), (ticks >>> 16) & 0xFF, (ticks >>> 8) & 0xFF, ticks & 0xFF];
  const consola = [0, 0, 0, 0].map(() => Math.floor(azar() * 256));
  return {
    invalido: 0, esChica, mes: 0, dia: 0, colorFavorito: 0, favorito: 0, nombre, altura: 64, peso: 64, id, consola, creador: '',
    cara: { forma: 0, piel: 0, rasgo: 0 }, noMezclar: 0, descargado: 0,
    pelo: { tipo: esChica ? 12 : 33, color: 1, invertido: 0 },
    cejas: { tipo: 6, giro: 6, color: 1, tam: 4, alto: 10, sep: 2 },
    ojos: { tipo: 2, giro: 4, alto: 12, color: 0, tam: 4, sep: 2 },
    nariz: { tipo: 1, tam: 4, alto: 9 }, boca: { tipo: 23, color: 0, tam: 4, alto: 13 },
    lentes: { tipo: 0, color: 0, tam: 4, alto: 10 }, barba: { bigote: 0, tipo: 0, color: 0, tam: 4, alto: 10 },
    lunar: { si: 0, tam: 4, alto: 20, x: 2 },
    _a: 0, _b: 0, _c: 0, _d: 0, _e: 0, _f: 0, _g: 0, _h: 0, _i: 0, _j: 0, _k: 0,
  };
}
// Caras de partida, como los Mii «invitado» del juego: la persona elige una y solo le pone nombre y color. Son NUESTRAS
// (combinaciones de rasgos elegidas a mano, no los datos de Nintendo): 6 de chico y 6 de chica.
export const PRESETS = [
  { esChica: 0, cara: { forma: 0, piel: 0 }, pelo: { tipo: 33, color: 1 }, ojos: { tipo: 2, color: 0 }, boca: { tipo: 23 } },
  { esChica: 0, cara: { forma: 3, piel: 1 }, pelo: { tipo: 1, color: 0 }, ojos: { tipo: 4, color: 2 }, cejas: { tipo: 3 }, barba: { bigote: 1, color: 0 } },
  { esChica: 0, cara: { forma: 2, piel: 2 }, pelo: { tipo: 15, color: 3 }, ojos: { tipo: 8, color: 1 }, lentes: { tipo: 1, color: 0 } },
  { esChica: 0, cara: { forma: 5, piel: 4 }, pelo: { tipo: 24, color: 0 }, ojos: { tipo: 12, color: 0 }, boca: { tipo: 6 } },
  { esChica: 0, cara: { forma: 1, piel: 0 }, pelo: { tipo: 40, color: 7 }, ojos: { tipo: 18, color: 4 }, cejas: { tipo: 10 } },
  { esChica: 0, cara: { forma: 6, piel: 5 }, pelo: { tipo: 30, color: 0 }, ojos: { tipo: 6, color: 0 }, barba: { tipo: 2, color: 0 } },
  { esChica: 1, cara: { forma: 0, piel: 0 }, pelo: { tipo: 12, color: 2 }, ojos: { tipo: 22, color: 0 }, boca: { tipo: 9, color: 1 } },
  { esChica: 1, cara: { forma: 3, piel: 1 }, pelo: { tipo: 50, color: 7 }, ojos: { tipo: 26, color: 4 }, boca: { tipo: 12, color: 2 } },
  { esChica: 1, cara: { forma: 1, piel: 3 }, pelo: { tipo: 55, color: 0 }, ojos: { tipo: 30, color: 1 }, lentes: { tipo: 3, color: 2 } },
  { esChica: 1, cara: { forma: 2, piel: 2 }, pelo: { tipo: 62, color: 3 }, ojos: { tipo: 14, color: 2 }, boca: { tipo: 15, color: 1 } },
  { esChica: 1, cara: { forma: 4, piel: 4 }, pelo: { tipo: 48, color: 0 }, ojos: { tipo: 36, color: 0 }, boca: { tipo: 2, color: 1 } },
  { esChica: 1, cara: { forma: 0, piel: 5 }, pelo: { tipo: 66, color: 1 }, ojos: { tipo: 40, color: 5 }, lunar: { si: 1 } },
];
// mezcla un preset (o algo parcial) sobre un Mii nuevo
function mezclar(base, extra) {
  for (const [k, v] of Object.entries(extra)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) mezclar(base[k] ??= {}, v); else base[k] = v;
  }
  return base;
}
export function miiDesdePreset(i, { nombre = 'Mii', colorFavorito = 0, ahora = Date.now() } = {}) {
  const p = PRESETS[i] || PRESETS[0];
  return mezclar(miiNuevo({ nombre, esChica: p.esChica, ahora }), { ...structuredClone(p), colorFavorito });
}
// Uno al azar dentro de los rangos del editor (con sentido: casi nunca lentes, sin barba si es chica)
export function miiAlAzar({ nombre = 'Mii', azar = Math.random, ahora = Date.now() } = {}) {
  const esChica = azar() < 0.5 ? 1 : 0;
  const m = miiNuevo({ nombre, esChica, ahora });
  for (const [pestana, campos] of Object.entries(RASGOS)) {
    if (pestana === 'Datos') continue;
    for (const [campo, , min, max] of campos) {
      if (campo.endsWith('.alto') || campo.endsWith('.sep') || campo.endsWith('.giro') || campo.endsWith('.tam') || campo.endsWith('.x')) continue;   // posiciones: las del medio
      poner(m, campo, min + Math.floor(azar() * (max - min + 1)));
    }
  }
  if (azar() < 0.75) m.lentes.tipo = 0;
  if (esChica || azar() < 0.6) { m.barba.bigote = 0; m.barba.tipo = 0; }
  if (azar() < 0.85) m.lunar.si = 0;
  m.cejas.color = m.pelo.color; m.barba.color = m.pelo.color;
  m.colorFavorito = Math.floor(azar() * 12);
  return m;
}

// Una copia con otro id (para "duplicar": dos Mii con el mismo id confunden a la Wii)
export function duplicarMii(m, ahora = Date.now()) {
  const c = structuredClone(m);
  c.id = miiNuevo({ ahora }).id;
  c.nombre = (m.nombre || 'Mii').slice(0, 8) + ' 2';
  return c;
}
export const mismoId = (a, b) => a.id.every((x, i) => x === b.id[i]);
export const idTexto = m => m.id.map(x => x.toString(16).padStart(2, '0')).join('');

// ---- La base de Mii (RFL_DB.dat) ----
// CRC-16/XMODEM: polinomio 0x1021, empieza en 0, sin reflejar (bit a bit; la base son 127 KB: 1 ms)
export function crc16(b, desde = 0, hasta = b.length) {
  let c = 0;
  for (let i = desde; i < hasta; i++) {
    c ^= b[i] << 8;
    for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
  }
  return c;
}

// Lee la base: { valida, problema, mii: [{casilla, mii}], crcBien }. Una casilla vacía son 74 ceros.
export function leerBase(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const r = { valida: false, problema: '', mii: [], crcBien: false };
  if (b.length < 4 || String.fromCharCode(...b.subarray(0, 4)) !== 'RNOD') { r.problema = 'no es una base de Mii de la Wii (no empieza con «RNOD»)'; return r; }
  if (b.length !== TAM_RFLDB) { r.problema = `tiene ${b.length} bytes y una base de Mii tiene ${TAM_RFLDB}`; return r; }
  r.crcBien = ((b[POS_CRC_DB] << 8) | b[POS_CRC_DB + 1]) === crc16(b, 0, POS_CRC_DB);
  for (let n = 0; n < MAX_MII; n++) {
    const p = 4 + n * TAM_MII, trozo = b.subarray(p, p + TAM_MII);
    if (trozo.every(x => x === 0)) continue;
    r.mii.push({ casilla: n, mii: desarmarMii(trozo) });
  }
  if (!r.crcBien) { r.problema = 'la base está dañada (su suma de control no cuadra)'; return r; }
  r.valida = true;
  return r;
}

// Arma la base con una lista de Mii. Si se pasa `original`, se respeta todo lo demás que tenía (el desfile de Mii
// "RNHD" y lo que venga después): solo se reescriben las 100 casillas y la suma de control.
export function armarBase(listaMii, original = null) {
  if (listaMii.length > MAX_MII) throw new Error('la base de Mii lleva hasta 100 Mii');
  const b = original && original.length === TAM_RFLDB ? new Uint8Array(original) : new Uint8Array(TAM_RFLDB);
  b.set([0x52, 0x4E, 0x4F, 0x44], 0);                        // "RNOD"
  b.fill(0, 4, 4 + MAX_MII * TAM_MII);
  listaMii.forEach((m, n) => b.set(armarMii(m), 4 + n * TAM_MII));
  if (!original) b.set([0x52, 0x4E, 0x48, 0x44], 0x1D00);   // "RNHD": cabecera del desfile, vacío
  const c = crc16(b, 0, POS_CRC_DB);
  b[POS_CRC_DB] = c >> 8; b[POS_CRC_DB + 1] = c & 0xFF;
  return b;
}

// ---- Vista previa aproximada (SVG nuestro, sin arte de Nintendo) ----
const PIEL = ['#ffd8ba', '#ffb876', '#de8442', '#ffaa8c', '#ad5129', '#632c18'];
const PELO = ['#1e1a18', '#382018', '#552614', '#7a4a1e', '#787878', '#4a3a1e', '#a8681e', '#e0b450'];
const OJOS = ['#000000', '#6c7070', '#663c2c', '#605c00', '#4060a8', '#387058'];
const LABIOS = ['#d85a3e', '#f0242c', '#f08878'];
const LENTES = ['#202020', '#6a4020', '#a03020', '#203a80', '#c08020', '#808070'];
export function vistaPrevia(m, tam = 160) {
  const g = n => Number(obtener(m, n)) || 0;
  const piel = PIEL[g('cara.piel')] || PIEL[0], pelo = PELO[g('pelo.color')] || PELO[0];
  const ancho = 34 + (g('peso') - 64) / 8, alto = 42 + (g('altura') - 64) / 10;      // la cara: más ancha o más alta
  const forma = g('cara.forma'), radioMenton = [0.9, 0.6, 0.35, 0.75, 0.5, 1, 0.45, 0.25][forma] || 0.6;
  const ojoY = 46 + (g('ojos.alto') - 12) * 1.1, ojoSep = 9 + g('ojos.sep') * 1.2, ojoR = 2.2 + g('ojos.tam') * 0.45;
  const cejaY = ojoY - 8 - (g('cejas.alto') - 10) * 0.6 + 6, cejaSep = ojoSep + (g('cejas.sep') - 2) * 0.8, cejaL = 4 + g('cejas.tam');
  const giro = (g('cejas.giro') - 6) * 4, ojoGiro = (g('ojos.giro') - 4) * 5;
  const narizY = 58 + (g('nariz.alto') - 9) * 1.1, narizT = 2 + g('nariz.tam') * 0.5;
  const bocaY = 70 + (g('boca.alto') - 13) * 1.1, bocaA = 5 + g('boca.tam') * 1.2;
  const pelado = g('pelo.tipo') === 30 || g('pelo.tipo') === 57;                      // las dos calvas, más o menos
  const flequillo = g('pelo.tipo') % 3, inv = g('pelo.invertido') ? -1 : 1;
  const largo = g('esChica') || g('pelo.tipo') >= 48;
  const partes = [];
  partes.push(`<rect width="120" height="120" rx="18" fill="${COLORES_HEX[g('colorFavorito')] || COLORES_HEX[0]}" opacity=".18"/>`);
  if (!pelado && largo) partes.push(`<path d="M${60 - ancho - 4} 48 Q60 ${8} ${60 + ancho + 4} 48 L${60 + ancho + 2} ${96} L${60 - ancho - 2} ${96} Z" fill="${pelo}"/>`);
  partes.push(`<ellipse cx="${60 - ancho + 1}" cy="${ojoY + 6}" rx="5" ry="7" fill="${piel}"/><ellipse cx="${60 + ancho - 1}" cy="${ojoY + 6}" rx="5" ry="7" fill="${piel}"/>`);
  const mentonY = 60 + alto;
  partes.push(`<path d="M${60 - ancho} 44 Q${60 - ancho} ${mentonY - alto * radioMenton * 0.5} ${60 - ancho * radioMenton} ${mentonY - 4} Q60 ${mentonY + 4} ${60 + ancho * radioMenton} ${mentonY - 4} Q${60 + ancho} ${mentonY - alto * radioMenton * 0.5} ${60 + ancho} 44 Q60 ${10} ${60 - ancho} 44 Z" fill="${piel}"/>`);
  if (!pelado) {
    const fy = 36 + flequillo * 4;
    partes.push(`<path d="M${60 - ancho - 3} ${46} Q${60 - ancho} ${12} 60 ${12} Q${60 + ancho} ${12} ${60 + ancho + 3} ${46} Q${60 + inv * 10} ${fy - 6} ${60 - inv * ancho * 0.6} ${fy} Q${60 - ancho} ${fy + 2} ${60 - ancho - 3} ${46} Z" fill="${pelo}"/>`);
  }
  for (const s of [-1, 1]) {
    const x = 60 + s * ojoSep;
    partes.push(`<line x1="${x - cejaL / 2}" y1="${cejaY}" x2="${x + cejaL / 2}" y2="${cejaY}" stroke="${PELO[g('cejas.color')] || pelo}" stroke-width="2.2" stroke-linecap="round" transform="rotate(${s * giro} ${x} ${cejaY})"/>`);
    partes.push(`<ellipse cx="${x}" cy="${ojoY}" rx="${ojoR * 1.25}" ry="${ojoR}" fill="#fff" stroke="#3a2a20" stroke-width=".8" transform="rotate(${s * ojoGiro} ${x} ${ojoY})"/><circle cx="${x}" cy="${ojoY}" r="${ojoR * 0.65}" fill="${OJOS[g('ojos.color')] || '#000'}"/>`);
  }
  partes.push(`<path d="M60 ${narizY - narizT * 2} L${60 - narizT} ${narizY} L${60 + narizT} ${narizY}" fill="none" stroke="#00000044" stroke-width="1.4" stroke-linejoin="round"/>`);
  partes.push(`<path d="M${60 - bocaA} ${bocaY} Q60 ${bocaY + 5} ${60 + bocaA} ${bocaY}" fill="${LABIOS[g('boca.color')] || LABIOS[0]}" stroke="#7a2a1a" stroke-width="1"/>`);
  if (g('barba.bigote')) partes.push(`<path d="M${60 - 4 - g('barba.tam')} ${bocaY - 3} Q60 ${bocaY - 8} ${60 + 4 + g('barba.tam')} ${bocaY - 3} Q60 ${bocaY - 4} ${60 - 4 - g('barba.tam')} ${bocaY - 3} Z" fill="${PELO[g('barba.color')]}"/>`);
  if (g('barba.tipo')) partes.push(`<path d="M${60 - ancho * 0.8} ${bocaY - 4} Q60 ${mentonY + 10 + g('barba.tipo') * 2} ${60 + ancho * 0.8} ${bocaY - 4} Q60 ${bocaY + 10} ${60 - ancho * 0.8} ${bocaY - 4} Z" fill="${PELO[g('barba.color')]}" opacity=".9"/>`);
  if (g('lunar.si')) partes.push(`<circle cx="${60 - ancho + 4 + g('lunar.x') * 3.5}" cy="${30 + g('lunar.alto') * 1.5}" r="${0.8 + g('lunar.tam') * 0.25}" fill="#2a1a10"/>`);
  if (g('lentes.tipo')) {
    const ly = ojoY + (g('lentes.alto') - 10) * 0.8, lr = 6 + g('lentes.tam') * 0.8, col = LENTES[g('lentes.color')] || LENTES[0];
    const sol = g('lentes.tipo') >= 6;
    partes.push(`<g fill="${sol ? col : 'none'}" fill-opacity=".75" stroke="${col}" stroke-width="1.6"><rect x="${60 - ojoSep - lr}" y="${ly - lr * 0.7}" width="${lr * 2}" height="${lr * 1.4}" rx="${g('lentes.tipo') % 2 ? lr : 3}"/><rect x="${60 + ojoSep - lr}" y="${ly - lr * 0.7}" width="${lr * 2}" height="${lr * 1.4}" rx="${g('lentes.tipo') % 2 ? lr : 3}"/><line x1="${60 - ojoSep + lr}" y1="${ly}" x2="${60 + ojoSep - lr}" y2="${ly}"/></g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${tam}" height="${tam}" role="img" aria-label="Vista previa aproximada del Mii">${partes.join('')}</svg>`;
}
