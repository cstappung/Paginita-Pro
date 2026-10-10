/* Mascotas — el motor, compartido.
   Lo usan tres sitios: la página de Juegos (esbuild lo mete en el paquete:
   las monedas, el mercado, el perfil y el salón), el juego del iframe
   (su paquete lo importa para los genes) y las pruebas de Node. Por eso es
   UMD, sin dependencias y no toca el DOM, como el de PRODROP.

   Un regalo **no se tira, se deriva**: lo que trae es una función pura de
   `(uid, clave, at)`, donde `at` es la hora del servidor en el instante en
   que se escribió la compra (la regla exige `at === now`). Quien lo compra
   no puede elegir ese milisegundo, así que no puede elegir lo que sale, y
   cualquiera puede rehacer el regalo de cualquiera. Lo mismo los colores de
   una mascota: salen de su adopción, así que viajan con ella cuando cambia
   de dueño.

   Lo que decide valor (legendario, qué objeto, qué colores) sale de enteros;
   los genes del plumaje son números continuos que solo pintan. */
(function (raiz, fabrica) {
  const M = fabrica();
  if (typeof module === "object" && module.exports) module.exports = M;
  else raiz.MascotasMotor = M;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- lo que puede traer un regalo ----------
     **Solo se agrega al final**: el objeto que sale es un índice dentro de
     su clase, así que insertar o reordenar cambiaría lo que ya salió en
     todos los regalos abiertos. Los ids son los del catálogo del juego
     (colabtex/src/mascotas/data/*.ts); un test comprueba que coinciden. */
  const POOL = [
    ["hat", "beanie", 0], ["hat", "top", 0], ["hat", "crown", 0], ["hat", "cowboy", 0], ["hat", "party", 0],
    ["hat", "arcane", 1], ["hat", "phoenix", 1], ["hat", "halo", 1], ["hat", "storm", 1], ["hat", "bloom", 1],
    ["boots", "rain", 0], ["boots", "cowboy", 0], ["boots", "snow", 0], ["boots", "trek", 0], ["boots", "star", 0],
    ["boots", "rocket", 1], ["boots", "crystal", 1], ["boots", "lava", 1], ["boots", "rainbow", 1], ["boots", "thunder", 1],
    ["outfit", "sweater", 0], ["outfit", "dress", 0], ["outfit", "cape", 0], ["outfit", "apron", 0], ["outfit", "tux", 0],
    ["outfit", "royal", 1], ["outfit", "galaxy", 1], ["outfit", "knight", 1], ["outfit", "sakura", 1], ["outfit", "fairy", 1],
    ["shoes", "sneakers", 0], ["shoes", "loafers", 0], ["shoes", "ballet", 0], ["shoes", "sandals", 0], ["shoes", "heels", 0],
    ["shoes", "winged", 1], ["shoes", "comet", 1], ["shoes", "skates", 1], ["shoes", "dragon", 1], ["shoes", "disco", 1],
    ["decor", "rug", 0], ["decor", "bed", 0], ["decor", "lamp", 0], ["decor", "mushroom", 0], ["decor", "chair", 0],
    ["decor", "table", 0], ["decor", "sunflower", 0], ["decor", "hay", 0], ["decor", "bowl", 0], ["decor", "ball", 0],
    ["decor", "duck", 0], ["decor", "blocks", 0], ["decor", "house", 0],
    ["dance", "salsa", 0], ["dance", "spin", 0], ["dance", "robot", 0], ["dance", "disco", 0], ["dance", "conga", 0],
    ["dance", "cueca", 0], ["dance", "moonwalk", 1], ["dance", "cosmic", 1]
  ].map(([kind, id, leg], n) => ({ n, kind, id, leg: !!leg }));
  const COMUNES = POOL.filter(p => !p.leg), LEGENDARIOS = POOL.filter(p => p.leg);

  /* Lo que trae toda cuenta desde el principio: no se compra, no se escribe
     en ningún lado y no se puede vender (no tiene clave de copia). */
  const INICIALES = [["hat", "beanie"], ["boots", "rain"], ["outfit", "sweater"], ["shoes", "sneakers"],
    ...POOL.filter(p => p.kind === "dance" && !p.leg).map(p => ["dance", p.id])]
    .map(([kind, id]) => ({ uid: "start-" + kind + "-" + id, kind, id, tint: 0 }));
  const BAILES_INICIALES = INICIALES.filter(i => i.kind === "dance").map(i => i.id);

  /* ---------- precios (los mismos que pide la regla) ---------- */
  const PRECIO = {
    regalo: 500,
    pocion: 1000,
    comida: 20,          // por ración: un puñado, una acción de alimentar
    adopcion: 1000,      // la primera de cada cuenta es gratis
    fondos: { sunset: 10, night: 15, beach: 20, snow: 25 }
  };
  const MAX_MASCOTAS = 6, MAX_RACIONES = 50;
  const ESPECIES = ["chicken", "cat"];
  /* 6 % de legendarios, en diez milésimas. */
  const LEGENDARIO = 600;

  /* Lo que cuesta una compra de `mascotas/c` según su `k` (null: no existe). */
  function precioCompra(k, n) {
    if (k === "comida") return Number.isInteger(n) && n >= 1 && n <= MAX_RACIONES ? PRECIO.comida * n : null;
    if (k === "pocion") return PRECIO.pocion;
    if (k === "adios") return 0;
    const f = /^fondo-([a-z]+)$/.exec(String(k || ""));
    return f && PRECIO.fondos[f[1]] ? PRECIO.fondos[f[1]] : null;
  }

  /* ---------- el azar, en enteros (igual que ProdropMotor) ---------- */
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
  /* xoshiro128** sembrado con cuatro palabras del resumen. */
  function generador(semilla) {
    let [a, b, c, d] = semilla;
    if (!(a | b | c | d)) a = 1;
    const u32 = () => {
      const r = Math.imul(((Math.imul(b, 5) << 7) | (Math.imul(b, 5) >>> 25)), 9) >>> 0;
      const t = b << 9;
      c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
      return r;
    };
    const entero = n => Math.floor(u32() * n / 4294967296);
    /* Un número en [0, 1), para lo que solo pinta (los genes). */
    const real = () => u32() / 4294967296;
    return { u32, entero, real };
  }

  /* ---------- el regalo ----------
     Primero si es legendario (600 de 10 000), después un objeto de esa
     clase, uniforme, y los colores: una semilla de 1 a 2^31 − 1 (0 son los
     colores originales, que nunca salen de un regalo). Los bailes no
     tienen colores. */
  const memoRegalo = new Map();
  function regalo(uid, clave, at) {
    const k = uid + "|" + clave + "|" + at;
    if (memoRegalo.has(k)) return memoRegalo.get(k);
    const r = generador(sha256("mascota-regalo:" + k).slice(0, 4));
    const leg = r.entero(10000) < LEGENDARIO;
    const de = leg ? LEGENDARIOS : COMUNES;
    const p = de[r.entero(de.length)];
    const tint = p.kind === "dance" ? 0 : 1 + (r.u32() % 2147483646);
    const res = Object.freeze({ n: p.n, kind: p.kind, id: p.id, leg: p.leg, tint });
    if (memoRegalo.size > 4000) memoRegalo.clear();
    memoRegalo.set(k, res);
    return res;
  }

  /* La semilla de los genes de una mascota: de su adopción, no de su dueño
     de ahora. El juego la convierte en plumaje o pelaje (game/look.ts). */
  const semillaGenes = (uid, clave, at) => sha256("mascota-genes:" + uid + "|" + clave + "|" + at).slice(0, 4);

  return {
    POOL, COMUNES, LEGENDARIOS, INICIALES, BAILES_INICIALES, PRECIO, MAX_MASCOTAS, MAX_RACIONES, ESPECIES, LEGENDARIO,
    precioCompra, sha256, generador, regalo, semillaGenes
  };
});
