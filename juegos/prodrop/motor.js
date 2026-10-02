/* PRODROP — el motor, compartido.
   Lo usan tres sitios: el abridor (este directorio, sin compilar), la
   página de Juegos (esbuild lo mete en el paquete: el vestíbulo, el perfil
   y las monedas) y las pruebas de Node. Por eso es UMD y no toca el DOM.

   Un sobre **no se tira, se deriva**: su contenido es una función pura de
   `(uid, clave, at)`, donde `at` es la hora del servidor en el instante en
   que se escribió la compra (la regla exige `at === now`). Quien compra no
   puede elegir ese milisegundo, así que no puede elegir lo que trae; y como
   todo lo demás es público, cualquiera puede rehacer el sobre de cualquiera
   y comprobar que esa legendaria salió de verdad de ahí. Lo mismo la nota
   oculta de cada carta: estaba decidida desde que se compró el sobre, y
   graduar solo la descubre.

   Todo el azar sale de SHA-256 y de enteros: los pesos están en enteros
   (diez milésimas) para que dos navegadores no redondeen distinto el
   último bit de un 17,4. */
(function (raiz, fabrica) {
  const M = fabrica();
  if (typeof module === "object" && module.exports) module.exports = M;
  else raiz.ProdropMotor = M;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- el catálogo ---------- */
  // [id de archivo, nombre visible, tema shiny]
  const PEOPLE = [
    ["angel-abusleme", "Angel Abusleme", "esmeralda"],
    ["christian-oberli", "Christian Oberli", "sakura"],
    ["claudia-prieto", "Claudia Prieto", "fuego_carmesi"],
    ["cristian-garces", "Cristian Garces", "hielo_cristal"],
    ["cristian-tejos", "Cristian Tejos", "tormenta_electrica"],
    ["david-watts", "David Watts", "dorado_solar"],
    ["felipe-nunez", "Felipe Nuñez", "platino_magenta"],
    ["felix-rojasv2", "Felix Rojas", "sombra_obsidiana"],
    ["javier-pereda-torres", "Javier Pereda Torres", "galaxia"],
    ["marilyn-cruces", "Marilyn Cruces", "oceano_abisal"],
    ["mario-gac", "Mario Gac", "perla_opalo"],
    ["miguel-gutierrez", "Miguel Gutierrez", "neon_cyber"],
    ["pablo-irarrazaval", "Pablo Irarrazaval", "neon_cyber"],
    ["rene-botnar", "Rene Botnar", "fuego_carmesi"],
    ["rodrigo-cadiz", "Rodrigo Cadiz", "oceano_abisal"],
    ["rolando-dunner", "Rolando Dunner", "sakura"],
    ["tito-arevalo", "Tito Arevalo", "perla_opalo"]
  ];
  const SHINY = {
    esmeralda: ["Esmeralda", "#3dffa0"], sakura: ["Sakura", "#ff9bd2"], fuego_carmesi: ["Fuego Carmesí", "#ff5a2e"],
    hielo_cristal: ["Hielo Cristal", "#9be9ff"], tormenta_electrica: ["Tormenta Eléctrica", "#ffe74a"],
    dorado_solar: ["Dorado Solar", "#ffc23a"], platino_magenta: ["Platino Magenta", "#ff5ae0"],
    sombra_obsidiana: ["Sombra Obsidiana", "#a678ff"], galaxia: ["Galaxia", "#8f8bff"],
    oceano_abisal: ["Océano Abisal", "#38d0ff"], perla_opalo: ["Perla Ópalo", "#ffeacc"], neon_cyber: ["Neón Cyber", "#4dff72"]
  };
  /* Probabilidad por carta en diez milésimas (suman 10 000). */
  const TIERS = [
    { key: "common", label: "Común", sym: "●", color: "#dfe3ee", w: 8000 },
    { key: "rare", label: "Rara", sym: "◆", color: "#5cc8ff", w: 1740 },
    { key: "epic", label: "Épica", sym: "★", color: "#c26bff", w: 240 },
    { key: "legend", label: "Legendaria", sym: "★★", color: "#ffcc3d", w: 20 }
  ];
  /* Las variantes: el orden fija el N.º de cada carta, y la clave
     (`<persona>-<variante>`) no se cambia nunca. Los ataques de las
     comunes y las raras son cosa del abridor, no del motor. */
  const VARIANTS = [
    { key: "original", tier: 0, label: "Original" },
    { key: "dibujo", tier: 0, label: "Dibujo" },
    { key: "anime", tier: 0, label: "Anime Titán" },
    { key: "calvo", tier: 1, label: "Calvo" },
    { key: "simpson", tier: 1, label: "Springfield" },
    { key: "gta", tier: 2, label: "Los Santos" },
    { key: "cyberpunk", tier: 2, label: "Cyberpunk" },
    { key: "casino", tier: 2, label: "High Roller" },
    { key: "shiny", tier: 3, label: "Shiny" }
  ];
  const FOLDER = ["comunes", "raras", "epicas", "legendarias"];
  const CARDS = [];
  VARIANTS.forEach(v => PEOPLE.forEach(([id, name, sh]) => {
    CARDS.push({
      n: CARDS.length, uid: id + "-" + v.key, person: id, num: CARDS.length + 1, name, vkey: v.key, vlabel: v.label,
      tier: v.tier, shiny: SHINY[sh], img: "cards/" + FOLDER[v.tier] + "/" + id + "-" + v.key + ".webp"
    });
  }));
  const TOTAL = CARDS.length;
  const POR_TIER = TIERS.map((_, t) => CARDS.filter(c => c.tier === t));
  const subtitulo = c => c.tier === 3 ? "Shiny " + c.shiny[0] : c.vlabel;
  const acento = c => c.tier === 3 ? c.shiny[1] : c.tier === 2 ? "#d49bff" : TIERS[c.tier].color;

  /* ---------- la nota oculta ----------
     Campana angosta en 7, en milésimas (suman 1000): del 1 al 3 suman 2 %,
     y el 10 GEM MINT sale el 8 %. */
  const GRADE_W = [2, 5, 13, 40, 100, 170, 260, 220, 110, 80];
  const GRADE_WORD = ["", "POOR", "GOOD", "VERY GOOD", "VG-EX", "EXCELLENT", "EX-MT", "NEAR MINT", "NM-MT", "MINT", "GEM MINT"];
  const colorNota = g => g >= 10 ? "#ffd23d" : g >= 9 ? "#dfe7ff" : g >= 7 ? "#5cc8ff" : g >= 5 ? "#8fe36f" : g >= 3 ? "#ff9a3d" : "#ff4d5e";

  /* ---------- precios ----------
     El sobre cuesta 50 los primeros días y 80 después. La regla de
     `cartas/s` compara con el mismo instante, así que el precio que se
     cobra es el de la hora del servidor, no el del reloj de cada uno. */
  const PRECIO = { promo: 50, normal: 80, gradua: 100, promoHasta: 1791169200000 };   // hasta el 4-10-2026 inclusive (5-10 00:00 Chile)
  const precioSobre = ms => (ms < PRECIO.promoHasta ? PRECIO.promo : PRECIO.normal);

  /* El god pack: 2 % de los sobres. Trae cinco épicas o mejores, y como
     mucho una legendaria. */
  const DIOS = 200;   // de 10 000

  /* ---------- SHA-256 ---------- */
  const SHA_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const SHA_H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  /* Devuelve las ocho palabras de 32 bits del resumen. */
  function sha256(texto) {
    const b = new TextEncoder().encode(String(texto));
    const largo = ((b.length + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(largo);
    m.set(b);
    m[b.length] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(largo - 8, Math.floor(b.length / 0x20000000));
    dv.setUint32(largo - 4, (b.length * 8) >>> 0);
    const h = SHA_H.slice(), w = new Int32Array(64);
    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < largo; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], c = w[i - 2];
        w[i] = (w[i - 16] + (ror(a, 7) ^ ror(a, 18) ^ (a >>> 3)) + w[i - 7] + (ror(c, 17) ^ ror(c, 19) ^ (c >>> 10))) | 0;
      }
      let [A, B, C, D, E, F, G, H] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (H + (ror(E, 6) ^ ror(E, 11) ^ ror(E, 25)) + ((E & F) ^ (~E & G)) + SHA_K[i] + w[i]) | 0;
        const t2 = ((ror(A, 2) ^ ror(A, 13) ^ ror(A, 22)) + ((A & B) ^ (A & C) ^ (B & C))) | 0;
        H = G; G = F; F = E; E = (D + t1) | 0; D = C; C = B; B = A; A = (t1 + t2) | 0;
      }
      h[0] = (h[0] + A) | 0; h[1] = (h[1] + B) | 0; h[2] = (h[2] + C) | 0; h[3] = (h[3] + D) | 0;
      h[4] = (h[4] + E) | 0; h[5] = (h[5] + F) | 0; h[6] = (h[6] + G) | 0; h[7] = (h[7] + H) | 0;
    }
    return h.map(x => x >>> 0);
  }
  /* Un generador a partir del resumen: xoshiro128** sembrado con cuatro
     de sus palabras. Solo enteros: el mismo resultado en todas partes. */
  function generador(semilla) {
    let [a, b, c, d] = semilla;
    if (!(a | b | c | d)) a = 1;
    const u32 = () => {
      const r = Math.imul(((Math.imul(b, 5) << 7) | (Math.imul(b, 5) >>> 25)), 9) >>> 0;
      const t = b << 9;
      c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
      return r;
    };
    // Entero en [0, n): n < 2^21, así que el producto cabe exacto en un double.
    const entero = n => Math.floor(u32() * n / 4294967296);
    return { u32, entero };
  }
  function pesado(r, pesos) {
    let x = r.entero(pesos.reduce((s, p) => s + p, 0));
    for (let i = 0; i < pesos.length; i++) { x -= pesos[i]; if (x < 0) return i; }
    return pesos.length - 1;
  }

  /* ---------- el sobre ----------
     Cinco cartas distintas, de la peor a la mejor. La quinta (antes de
     ordenar) es Rara o mejor. En un god pack las cinco son épicas o
     legendarias, y tras la primera legendaria el resto sale épica. */
  const memo = new Map();
  function sobre(uid, clave, at) {
    const k = uid + "|" + clave + "|" + at;
    if (memo.has(k)) return memo.get(k);
    const h = sha256("prodrop:" + k), r = generador(h.slice(0, 4));
    const dios = r.entero(10000) < DIOS;
    const usadas = new Set(), cartas = [];
    let leyenda = false;
    for (let i = 0; i < 5; i++) {
      let t;
      if (dios) t = leyenda ? 2 : 2 + pesado(r, [TIERS[2].w, TIERS[3].w]);
      else t = i === 4 ? 1 + pesado(r, TIERS.slice(1).map(x => x.w)) : pesado(r, TIERS.map(x => x.w));
      if (t === 3) leyenda = true;
      const libres = POR_TIER[t].filter(c => !usadas.has(c.n));
      const c = libres[r.entero(libres.length)];
      usadas.add(c.n);
      cartas.push({ id: c.n, g: 1 + pesado(r, GRADE_W), w: (r.u32() & 0x7fffffff) | 1 });
    }
    cartas.sort((a, b) => CARDS[a.id].tier - CARDS[b.id].tier);   // estable: lo mejor al final
    const res = { dios, cartas };
    memo.set(k, res);
    if (memo.size > 20000) memo.delete(memo.keys().next().value);
    return res;
  }

  /* ---------- probabilidades ----------
     Lo que se espera de cada rareza por sobre, contando la quinta carta y
     el god pack. Para cosas raras el número esperado por sobre es casi la
     probabilidad de que un sobre traiga una, que es lo que se dice. */
  function esperadoPorSobre() {
    const T = TIERS.map(t => t.w), tot = 10000, alta = T[1] + T[2] + T[3];
    const normal = T.map((w, t) => 4 * w / tot + (t ? w / alta : 0));
    const pLeg = 1 - Math.pow(T[2] / (T[2] + T[3]), 5);
    const dios = [0, 0, 5 - pLeg, pLeg];
    const pd = DIOS / 10000;
    return normal.map((x, t) => (1 - pd) * x + pd * dios[t]);
  }
  const ESPERADO = esperadoPorSobre();
  const notaOMas = g => GRADE_W.slice(Math.max(1, g) - 1).reduce((s, w) => s + w, 0) / 1000;
  /* «Una carta así de buena»: de esta rareza o mejor y con esta nota o
     más. `exacta` es la misma carta (persona y variante) con esa nota. */
  function probabilidad(id, g) {
    const c = CARDS[id], pg = notaOMas(g);
    let porSobre = 0;
    for (let t = c.tier; t < TIERS.length; t++) porSobre += ESPERADO[t];
    porSobre *= pg;
    const exacta = ESPERADO[c.tier] / POR_TIER[c.tier].length * pg;
    return { porCarta: porSobre / 5, porSobre, exacta, nota: pg };
  }
  const pDios = DIOS / 10000;

  /* ---------- re-roll ----------
     Diez cartas de una misma rareza se cambian por una de la rareza
     siguiente, como el contrato de intercambio del CS2. Como el sobre, el
     resultado no se tira: es una función pura de `(uid, clave, at)` y de
     lo que entró, y `at` es la hora del servidor (la regla de `cartas/r`
     exige `at === now`), así que nadie elige lo que sale y cualquiera puede
     rehacerlo.

     La carta nueva es una cualquiera de la rareza siguiente, todas con la
     misma probabilidad. Su nota (oculta, como la de un sobre: se descubre
     al graduarla) sale de las notas de las diez que entraron: una campana
     centrada en su promedio **más un punto** (`REROLL.bono`), con σ = 1,3.
     Diez notas de 5 4 6 4 9 8 8 5 3 2 promedian 5,4, así que el centro es
     6,4: sale 6 o 7 el 57 % de las veces, 5 el 17 %, 8 el 14 %, 4 el 6 %,
     9 el 4 %. Con diez entradas, el promedio en décimas es la suma de las
     notas, y la campana va en una tabla de enteros (`PESO_REROLL`, la
     distancia al centro en décimas): `Math.exp` no da el mismo último bit
     en todos los navegadores, y dos navegadores no pueden ver notas
     distintas de la misma carta. */
  const REROLL = { n: 10, bono: 1, sigma: 1.3 };
  const PESO_REROLL = [1000000,997046,988235,973724,953766,928705,898967,865048,827498,786907,743893,699081,653093,606531,559965,513924,468886,425271,383437,343679,306226,271245,238842,209069,181928,157377,135335,115694,98320,83062,69758,58239,48336,39879,32709,26669,21616,17417,13951,11109,8794,6920,5413,4209,3254,2501,1911,1451,1095,822,613,455,335,246,179,130,93,67,48,34,24,17,12,8,5,4,3,2,1,1,1];
  /* El peso de cada nota 1…10 (índice 0…9), en enteros. */
  function pesosReroll(notas) {
    const suma = notas.reduce((t, g) => t + (g | 0), 0);
    const centro = Math.round(suma * 10 / Math.max(1, notas.length)) + REROLL.bono * 10;   // en décimas
    const pesos = [];
    for (let g = 1; g <= 10; g++) pesos.push(PESO_REROLL[Math.abs(10 * g - centro)] || 0);
    if (!pesos.some(Boolean)) pesos[centro >= 55 ? 9 : 0] = 1;   // centro fuera de la tabla: lo más cercano
    return pesos;
  }
  /* Lo mismo como probabilidades (para enseñarlo), y el promedio esperado. */
  function distribucionReroll(notas) {
    const p = pesosReroll(notas), t = p.reduce((a, b) => a + b, 0);
    const prob = p.map(x => x / t);
    return { prob, media: prob.reduce((m, x, i) => m + x * (i + 1), 0), centro: notas.reduce((a, b) => a + b, 0) / notas.length + REROLL.bono };
  }
  /* La carta que sale: {id, g, w}. `tier` es la rareza de las diez que
     entraron (0 a 2) y `notas` sus notas ocultas, en el orden escrito. */
  /* El salto: casi siempre sube una rareza, a veces dos y muy rara vez
     tres (de común a legendaria), en diez milésimas: 92 % / 7,5 % / 0,5 %.
     Lo que no cabe por encima de legendaria se queda en legendaria, así
     que de una rara sale épica el 92 % y legendaria el 8 %, y de una épica
     siempre legendaria. Sale de su propio resumen, para que la carta y la
     nota sigan saliendo del mismo generador de siempre, y solo cuenta
     desde `SALTOS_DESDE`: un re-roll escrito antes vuelve a dar
     exactamente la carta que dio. */
  const SALTO_W = [9200, 750, 50];
  const SALTOS_DESDE = 1790960400000;
  function saltoReroll(k, at) {
    if (at < SALTOS_DESDE) return 1;
    return 1 + pesado(generador(sha256("prodrop-salto:" + k).slice(0, 4)), SALTO_W);
  }
  /* La probabilidad de cada rareza de salida para una rareza de entrada. */
  function probSalida(tier) {
    const p = [0, 0, 0, 0], t = SALTO_W.reduce((a, b) => a + b, 0);
    SALTO_W.forEach((w, i) => { p[Math.min(3, tier + 1 + i)] += w / t; });
    return p;
  }
  const memoR = new Map();
  function reroll(uid, clave, at, tier, notas) {
    const k = uid + "|" + clave + "|" + at + "|" + tier + "|" + notas.join(",");
    if (memoR.has(k)) return memoR.get(k);
    const r = generador(sha256("prodrop-reroll:" + k).slice(0, 4));
    const posibles = POR_TIER[Math.min(3, tier + saltoReroll(k, at))];
    const c = posibles[r.entero(posibles.length)];
    const res = { id: c.n, g: 1 + pesado(r, pesosReroll(notas)), w: (r.u32() & 0x7fffffff) | 1 };
    memoR.set(k, res);
    return res;
  }

  /* ---------- lo de una cuenta ----------
     `s` = {clave: {at, p}} (los sobres), `g` = {clave: {i: {at, p}}} (lo
     graduado). Devuelve las copias, de la más vieja a la más nueva. */
  function coleccion(uid, s, g) {
    const out = [];
    const sobres = Object.entries(s || {}).filter(([, x]) => x && Number.isFinite(x.at))
      .sort((a, b) => a[1].at - b[1].at || (a[0] < b[0] ? -1 : 1));
    for (const [k, x] of sobres) {
      const so = sobre(uid, k, x.at), gk = (g && g[k]) || {};
      so.cartas.forEach((c, i) => out.push({ k, i, at: x.at, id: c.id, g: c.g, w: c.w, gr: !!gk[i], dios: so.dios }));
    }
    return out;
  }
  const gasto = (s, g) => {
    let t = 0;
    for (const x of Object.values(s || {})) t += (x && +x.p) || 0;
    for (const porK of Object.values(g || {})) for (const x of Object.values(porK || {})) t += (x && +x.p) || 0;
    return t;
  };

  return {
    PEOPLE, SHINY, TIERS, VARIANTS, FOLDER, CARDS, TOTAL, POR_TIER, GRADE_W, GRADE_WORD, PRECIO, DIOS, ESPERADO,
    subtitulo, acento, colorNota, precioSobre, sha256, generador, sobre, probabilidad, notaOMas, pDios, coleccion, gasto,
    REROLL, PESO_REROLL, pesosReroll, distribucionReroll, reroll, SALTO_W, SALTOS_DESDE, probSalida
  };
});
