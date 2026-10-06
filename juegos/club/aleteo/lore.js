/* El lore de ALETEO: un pajarito que vuelve al nido. Lo que encuentra al
   final del cielo no es un nido.

   Todo sale de un solo número, `corrupcion(puntos)`, que sube sin escalones
   de 0 a 5 a medida que se pasan tubos: cada umbral de `UMBRALES` abre un
   fundido de `FUNDIDO` tubos y el siguiente empieza donde termina el
   anterior. Seis cielos: mañana (0), tarde (15), ocaso (35), noche (60),
   jaula (90) y vacío (130). Nada se anuncia: los colores, los textos, la
   música y lo que hay en el paisaje se van corriendo de a poco, y el juego
   (motor.js) no lee nada de esto. Es puro, sin DOM, y corre en Node. */
(function (root) {
  'use strict';
  const UMBRALES = [15, 35, 60, 90, 130];
  const FUNDIDO = 15;
  const NOMBRES = ['mañana', 'tarde', 'ocaso', 'noche', 'jaula', 'vacío'];
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;

  // `p` puede traer fracción (el avance hacia el próximo tubo), así el
  // cielo se corre también entre un tubo y otro.
  function corrupcion(p) {
    let c = 0;
    for (const t of UMBRALES) c += clamp01((p - t + 1) / FUNDIDO);
    return c;
  }
  const etapa = c => Math.max(0, Math.min(5, Math.round(c)));
  // 0 hasta `a`, 1 desde `b`, suave en medio.
  function lento(c, a, b) { const x = clamp01((c - a) / (b - a)); return x * x * (3 - 2 * x); }

  const K = ['cieloA', 'cieloB', 'sol', 'nube', 'lejos', 'cerca', 'tubo', 'tuboLuz', 'tuboSombra', 'borde',
    'suelo', 'sueloTop', 'pajaro', 'ala', 'vientre', 'pico', 'ojo', 'tinta', 'fondo', 'panel', 'acento'];
  const P = (...v) => Object.fromEntries(K.map((k, i) => [k, v[i]]));
  const PALETAS = [
    //      cieloA     cieloB     sol        nube       lejos      cerca      tubo       tuboLuz    tuboSombra borde      suelo      sueloTop   pajaro     ala        vientre    pico       ojo        tinta      fondo      panel      acento
    P('#3fb6f5', '#c4efff', '#ffe46b', '#ffffff', '#9ddcb0', '#5cbf6a', '#6fd04b', '#c2f58a', '#3a8e2b', '#24451a', '#ead79a', '#86cf3c', '#ffd23f', '#ffae12', '#fff4c2', '#ff7a1a', '#1a1a1a', '#173052', '#e6f6ff', '#ffffff', '#ff7a1a'),
    P('#ff8f57', '#ffe2a6', '#ffb347', '#ffe3c8', '#d09a73', '#9d6d4f', '#8cb84a', '#dbe684', '#587a29', '#3a361b', '#dcb97b', '#b5a046', '#ffc43c', '#f08900', '#ffe4ab', '#ff641a', '#1a1a1a', '#4d2817', '#fff0dd', '#fffaf2', '#ff6a3d'),
    P('#4b2163', '#f06c69', '#ff5a3c', '#b25d7c', '#3b2246', '#25152c', '#7b6b3a', '#b4934c', '#4b3b1f', '#1c120d', '#7c5c4b', '#5b4b3a', '#e5a63a', '#b5671b', '#efc68e', '#cf4f1a', '#120808', '#f7dbe3', '#26172e', '#331f3d', '#ff5a3c'),
    P('#050920', '#1b244f', '#e9e6cf', '#262e5c', '#10163a', '#0a0e22', '#3d4a6b', '#6d7ea5', '#222a45', '#04060e', '#262838', '#1c1e2e', '#b49c5e', '#7d5d2f', '#c6b68e', '#9e4a22', '#0b0b0b', '#c9d1ff', '#090c1c', '#121834', '#8fa0ff'),
    P('#180206', '#4c0a13', '#ff2b2b', '#380a10', '#1f0408', '#110204', '#5c5b60', '#a2a1a8', '#2a2a2f', '#050505', '#291313', '#3a1919', '#8c7b6b', '#5b4b3b', '#a39383', '#6b311f', '#ff2424', '#ffb3b3', '#110308', '#1d060c', '#ff2a2a'),
    P('#000000', '#121212', '#f2f2f2', '#181818', '#0a0a0a', '#050505', '#1d1d1d', '#3c3c3c', '#0d0d0d', '#000000', '#0b0b0b', '#121212', '#dadada', '#9e9e9e', '#f0f0f0', '#8a8a8a', '#000000', '#d4d4d4', '#000000', '#0b0b0b', '#ffffff'),
  ];

  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const aHex = v => '#' + v.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
  function mezclaHex(a, b, f) { const A = hex(a), B = hex(b); return aHex(A.map((x, i) => x + (B[i] - x) * f)); }
  // La paleta del cielo `c`: la mezcla de los dos cielos entre los que está.
  function paleta(c) {
    c = Math.max(0, Math.min(5, c));
    const i = Math.min(4, Math.floor(c)), f = c - i, a = PALETAS[i], b = PALETAS[i + 1], out = {};
    for (const k of K) out[k] = f <= 0 ? a[k] : f >= 1 ? b[k] : mezclaHex(a[k], b[k], f);
    return out;
  }

  /* Lo que el pájaro piensa (una línea bajo el marcador, que cambia cada
     diez tubos) y lo que se lee al chocar. Una columna por cielo; se elige
     por el cielo más cercano, así el tono se da vuelta a mitad del fundido. */
  const PIENSA = [
    ['El nido queda al otro lado de los tubos.', 'La bandada vuela conmigo.', 'Huele a pasto mojado.', '¡Qué buen día para volver!'],
    ['La bandada se adelantó.', 'El sol se está cansando.', '¿El nido era por aquí?', 'Ya no oigo a los demás.'],
    ['Hay pájaros en los cables. No vuelan.', 'Me están mirando.', 'Los tubos tienen óxido.', 'Nadie me espera.'],
    ['La luna no parpadea.', '¿Por qué sigo volando?', 'Algo me sigue con la mirada.', 'Ya no hay otros pájaros.'],
    ['Los tubos tienen barrotes.', 'Siempre fueron barrotes.', 'Alguien dejó la puerta abierta para que volviera.', 'Se me caen las plumas.'],
    ['Ya casi estoy en casa.', 'Aquí no hay cielo.', 'No recuerdo haber salido.', 'Quédate.'],
  ];
  const CHOQUE = [
    ['¡Casi! El nido sigue ahí.', 'Sacúdete las plumas y otra vez.', 'La bandada te espera. ¡Vuela!'],
    ['La bandada no volvió por ti.', 'Se hace tarde para llegar.', 'El sol se fue sin despedirse.'],
    ['Desde los cables, nadie se movió.', 'Te vieron caer. Nadie bajó.', 'El óxido se queda con lo que toca.'],
    ['La luna te vio caer.', 'Nadie oyó el golpe.', 'Ya no se oyen otros pájaros. Nunca se oyeron.'],
    ['La puerta se cierra sola.', 'Los barrotes no se terminan.', 'Siempre volviste aquí.'],
    ['Ya estás en casa.', 'Nunca saliste.', 'Bienvenido de vuelta.'],
  ];
  // Escoge sin Math.random: el mismo vuelo dice siempre lo mismo.
  const elige = (lista, n) => lista[((n % lista.length) + lista.length) % lista.length];
  const pensamiento = (c, puntos) => elige(PIENSA[etapa(c)], Math.floor(puntos / 10));
  const choque = (c, n) => elige(CHOQUE[etapa(c)], n);

  /* Rótulos que cambian letra a letra entre `a` y `b` mientras la
     corrupción recorre [desde, hasta]: un orden fijo de posiciones por
     rótulo, y la fracción dice cuántas ya cambiaron. */
  const ETIQUETAS = {
    logo: ['ALETEO', 'ENCIERRO', 3.4, 5],
    mejor: ['MEJOR', 'CONDENA', 3, 4.6],
    medalla: ['MEDALLA', 'GRILLETE', 3.6, 5],
    vuelos: ['VUELOS', 'INTENTOS', 2.6, 4.2],
    lema: ['Vuela de vuelta al nido', 'Vuela de vuelta a la jaula', 3.8, 5],
  };
  function hashTexto(t) {
    let h = 0x811C9DC5;
    for (const ch of String(t)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mutaLetras(a, b, f) {
    const n = Math.max(a.length, b.length), A = a.padEnd(n), B = b.padEnd(n);
    if (f <= 0) return a; if (f >= 1) return b;
    const orden = [...Array(n).keys()].sort((x, y) => hashTexto(a + x) - hashTexto(a + y));
    const k = Math.round(f * n), out = A.split('');
    for (let i = 0; i < k; i++) out[orden[i]] = B[orden[i]];
    return out.join('').replace(/\s+$/, '');
  }
  function etiqueta(clave, c) {
    const [a, b, d, h] = ETIQUETAS[clave];
    return mutaLetras(a, b, clamp01((c - d) / (h - d)));
  }
  // Desde la noche, algunas letras se ensucian; siempre las mismas para el
  // mismo texto, para que no titile.
  const SUCIAS = '†#¿Ø░▒';
  function corrompe(texto, c) {
    const p = Math.max(0, (c - 3.2) * 0.05);
    if (!p) return texto;
    return [...texto].map((ch, i) => (ch !== ' ' && (hashTexto(texto + i) % 1000) / 1000 < p ? SUCIAS[hashTexto(ch + i) % SUCIAS.length] : ch)).join('');
  }

  const api = { UMBRALES, FUNDIDO, NOMBRES, corrupcion, etapa, lento, PALETAS, paleta, mezclaHex, PIENSA, CHOQUE,
    pensamiento, choque, ETIQUETAS, mutaLetras, etiqueta, corrompe, hashTexto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AleteoLore = api;
})(globalThis);
