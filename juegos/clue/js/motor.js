/* Clue: el motor, compartido.
   Lo usan tres sitios, como el de Tetris Club: el juego suelto de este
   directorio (práctica contra bots, sin compilar), la sala multijugador
   de Juegos (esbuild lo mete en el paquete a través de `motor.js` de
   colabtex) y las pruebas de Node. Por eso es UMD y no toca el DOM.

   El tablero es el edificio del video: el segundo piso (lockers, el
   rellano de emergencia y el pasillo del mirador) y el primero (el hall
   azul del menú, el acceso con las máquinas, la sala de trofeos, la
   cocineta, el laboratorio de robótica y la bodega), con el patio al
   centro, que es donde está el sobre. La escalera y el montacargas son
   los dos pasadizos.

   Tres piezas:
   - **Los datos y el tablero** (`SOSPECHOSOS`, `ARMAS`, `LUGARES`,
     `celda`, `alcance`): puros, sin azar.
   - **El reductor** (`reducir`): el registro de jugadas es el estado,
     como en toda la sala. Sabe de quién es el turno, dónde está cada
     ficha, quién refutó qué sugerencia (no con qué carta) y quién ganó.
     Nunca exponencia: corre en cada repintado.
   - **El póquer mental** (`llaves`, `mezcla`, `revuelve`, `quita`,
     `abre`, los sobres y `auditar`): el mismo SRA del Presidente, sobre
     el mismo primo. Solo lo llama la pantalla de cada jugador. */
(function (raiz, fabrica) {
  const M = fabrica();
  if (typeof module === "object" && module.exports) module.exports = M;
  else raiz.ClueMotor = M;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ============================================================
     Los datos. Una carta es un número: 0-5 sospechosos, 6-14 armas,
     15-23 lugares.

     Los sospechosos son **seis puestos** con color fijo (la ficha del
     tablero), y quién ocupa cada uno lo elige cada partida: al empezar,
     cada jugador escoge su personaje del elenco (`{t:"elige", r}`) y el
     asiento i juega con el puesto i; los puestos que sobran se llenan
     al azar, con la semilla, con los que nadie eligió. El elenco de la
     sala (fotos y nombres de verdad) no vive en este repositorio, que
     es público: la sala lo lee de Firebase tras iniciar sesión y se lo
     pasa a la pantalla. `SOSPECHOSOS` es el de reserva, inventado, que
     se usa en la práctica suelta o si la base no tiene elenco. Para el
     motor un personaje es solo un `id`; el nombre y la foto son de la
     pantalla.
     ============================================================ */
  const COLORES = ["#c0392b", "#e8a900", "#d9d4c7", "#3c8d40", "#2f5bd3", "#8e44ad"];
  const NOMBRE_COLOR = ["rojo", "amarillo", "blanco", "verde", "azul", "morado"];
  const SOSPECHOSOS = [
    { id: "carmin", n: "Profesora Carmín", c: "Carmín", d: "Dicta Robótica y nunca devuelve las llaves del laboratorio." },
    { id: "ambar", n: "Ayudante Ámbar", c: "Ámbar", d: "Corrige las pruebas en la cocineta, siempre con un café." },
    { id: "nieves", n: "Auxiliar Nieves", c: "Nieves", d: "Conoce cada rincón: pasa la enceradora de noche." },
    { id: "oliva", n: "Doctorando Oliva", c: "Oliva", d: "Lleva cuatro años en el mismo capítulo de la tesis." },
    { id: "anil", n: "Decano Añil", c: "Añil", d: "Aparece en el hall azul cada vez que hay cámaras." },
    { id: "malva", n: "Guardia Malva", c: "Malva", d: "Tiene la llave del montacargas y de todo lo demás." }
  ];
  const idValido = r => typeof r === "string" && /^[a-z0-9-]{1,24}$/.test(r);
  /* Las armas son de Electricidad: nueve, una por sala al empezar, como
     en el Cluedo de 2008. `art` es el artículo para escribir «con la
     Carta de Smith»; `c`, el nombre corto; `i`, el emoji de reserva. El
     dibujo y la animación de cada una viven en `armas.js`. */
  const ARMAS = [
    { id: "smith", n: "Carta de Smith", c: "Smith", art: "la", i: "🎯" },
    { id: "fourier", n: "Transformada de Fourier", c: "Fourier", art: "la", i: "〰️" },
    { id: "resistencia", n: "Resistencia", c: "Resistencia", art: "la", i: "🟫" },
    { id: "capacitor", n: "Capacitor", c: "Capacitor", art: "el", i: "🔋" },
    { id: "inductor", n: "Inductor", c: "Inductor", art: "el", i: "🌀" },
    { id: "transistor", n: "Transistor", c: "Transistor", art: "el", i: "🔌" },
    { id: "fuente", n: "Fuente de poder", c: "Fuente", art: "la", i: "⚡" },
    { id: "opamp", n: "Amplificador operacional", c: "Op-amp", art: "el", i: "🔺" },
    { id: "led", n: "Diodo LED", c: "LED", art: "el", i: "💡" }
  ];
  const LUGARES = [
    { n: "Pasillo de lockers", c: "Lockers", piso: 2, img: "lockers" },
    { n: "Rellano de emergencia", c: "Rellano", piso: 2, img: "rellano" },
    { n: "Pasillo del mirador", c: "Mirador", piso: 2, img: "mirador" },
    { n: "Hall azul", c: "Hall", piso: 1, img: "hall" },
    { n: "Acceso y máquinas", c: "Máquinas", piso: 1, img: "maquinas" },
    { n: "Sala de trofeos", c: "Trofeos", piso: 1, img: "living" },
    { n: "Cocineta", c: "Cocineta", piso: 1, img: "cocineta" },
    { n: "Laboratorio de robótica", c: "Laboratorio", piso: 1, img: "laboratorio" },
    { n: "Bodega", c: "Bodega", piso: 1, img: "bodega" }
  ];
  const NS = COLORES.length, NA = ARMAS.length, NL = LUGARES.length;
  const NC = NS + NA + NL;                       // 24 cartas
  const cartaS = i => i, cartaA = i => NS + i, cartaL = i => NS + NA + i;
  const tipoCarta = c => c < NS ? "s" : c < NS + NA ? "a" : "l";
  /* `nombres`: el nombre de cada puesto (lo sabe la pantalla, que
     tiene el elenco); sin él, el color del puesto. */
  function nombreCarta(c, nombres) {
    if (!Number.isInteger(c) || c < 0 || c >= NC) return "?";
    if (c < NS) return (nombres && nombres[c]) || "Sospechoso " + NOMBRE_COLOR[c];
    if (c < NS + NA) return ARMAS[c - NS].n;
    return LUGARES[c - NS - NA].n;
  }

  /* ============================================================
     El tablero: 24 × 25 casillas. Las salas son rectángulos; lo demás
     es pasillo salvo los huecos (`#`). Una posición es un número:
     `y*ANCHO + x` para una casilla de pasillo y `SALA + l` para
     quien está dentro de la sala `l`.
     ============================================================ */
  const ANCHO = 24, ALTO = 25, SALA = 1000;
  const RECT = [                                   // [x0, y0, x1, y1] inclusivos
    [0, 0, 5, 5],      // 0 lockers        (2º piso, arriba a la izquierda)
    [9, 0, 14, 3],     // 1 rellano        (2º piso, arriba al centro)
    [18, 0, 23, 5],    // 2 mirador        (2º piso, arriba a la derecha)
    [0, 19, 5, 24],    // 3 hall azul      (abajo a la izquierda: ahí baja la escalera)
    [0, 13, 4, 16],    // 4 máquinas
    [8, 19, 15, 24],   // 5 sala de trofeos
    [18, 8, 23, 14],   // 6 cocineta
    [0, 7, 5, 10],     // 7 laboratorio
    [18, 19, 23, 24]   // 8 bodega         (abajo a la derecha: ahí llega el montacargas)
  ];
  const PATIO = [9, 8, 14, 15];                    // el centro: el sobre, no se entra
  /* Rincones que no son pasillo: muros, maceteros, el hueco del ascensor. */
  const HUECOS = [
    [6, 0, 6, 0], [17, 0, 17, 0], [15, 0, 15, 0], [8, 0, 8, 0],
    [0, 6, 0, 6], [23, 6, 23, 7], [0, 11, 0, 11], [23, 15, 23, 15],
    [0, 17, 0, 18], [7, 24, 7, 24], [16, 24, 16, 24], [5, 13, 5, 13],
    [5, 16, 5, 16], [17, 12, 17, 12]
  ];
  /* Puertas: la casilla de pasillo que queda delante de cada una. */
  const PUERTAS = [
    { l: 0, x: 6, y: 3 }, { l: 0, x: 3, y: 6 },
    { l: 1, x: 8, y: 2 }, { l: 1, x: 12, y: 4 }, { l: 1, x: 15, y: 2 },
    { l: 2, x: 17, y: 3 }, { l: 2, x: 20, y: 6 },
    { l: 3, x: 3, y: 18 }, { l: 3, x: 6, y: 21 },
    { l: 4, x: 2, y: 12 }, { l: 4, x: 5, y: 15 },
    { l: 5, x: 10, y: 18 }, { l: 5, x: 13, y: 18 }, { l: 5, x: 16, y: 21 },
    { l: 6, x: 17, y: 10 }, { l: 6, x: 20, y: 7 }, { l: 6, x: 21, y: 15 },
    { l: 7, x: 6, y: 8 }, { l: 7, x: 3, y: 11 },
    { l: 8, x: 17, y: 20 }, { l: 8, x: 20, y: 18 }
  ];
  /* Los pasadizos: de sala a sala sin tirar los dados. */
  const PASADIZOS = [
    { a: 2, b: 3, n: "Escalera" },     // del mirador baja al hall azul, como en el video
    { a: 0, b: 8, n: "Montacargas" }   // junto a los lockers, llega a la bodega
  ];
  /* Dónde empieza cada sospechoso: casillas de pasillo en el borde. */
  const SALIDAS = [[16, 0], [7, 0], [23, 16], [17, 24], [6, 24], [0, 12]];

  const PASILLO = 99, HUECO = -1, CENTRO = -2;
  const pos = (x, y) => y * ANCHO + x;
  const xy = p => [p % ANCHO, Math.floor(p / ANCHO)];
  const enSala = p => p >= SALA;
  const salaDe = p => p >= SALA ? p - SALA : -1;

  const CELDA = (() => {
    const c = new Array(ANCHO * ALTO).fill(PASILLO);
    const pinta = ([x0, y0, x1, y1], v) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c[pos(x, y)] = v;
    };
    RECT.forEach((r, l) => pinta(r, l));
    pinta(PATIO, CENTRO);
    HUECOS.forEach(r => pinta(r, HUECO));
    return c;
  })();
  const celda = (x, y) => x < 0 || y < 0 || x >= ANCHO || y >= ALTO ? HUECO : CELDA[pos(x, y)];
  const esPasillo = p => CELDA[p] === PASILLO;
  /* Por sala, sus casillas de puerta; por casilla, a qué sala abre. */
  const PUERTAS_DE = LUGARES.map((_, l) => PUERTAS.filter(d => d.l === l).map(d => pos(d.x, d.y)));
  const ABRE_A = new Map();
  for (const d of PUERTAS) {
    const p = pos(d.x, d.y);
    if (!ABRE_A.has(p)) ABRE_A.set(p, []);
    ABRE_A.get(p).push(d.l);
  }
  function pasadizoDe(l) {
    for (const q of PASADIZOS) {
      if (q.a === l) return { a: q.b, n: q.n };
      if (q.b === l) return { a: q.a, n: q.n };
    }
    return null;
  }
  const vecinos = p => {
    const [x, y] = xy(p), v = [];
    if (x > 0) v.push(p - 1);
    if (x < ANCHO - 1) v.push(p + 1);
    if (y > 0) v.push(p - ANCHO);
    if (y < ALTO - 1) v.push(p + ANCHO);
    return v;
  };

  /* Adónde puede llegar la ficha `f` con `pasos` (como mucho): cada
     casilla de pasillo a su distancia y cada sala a la que se entra por
     una puerta. Las fichas en el pasillo tapan su casilla; entrar en
     una sala acaba el movimiento, y no se puede volver a la sala de la
     que se sale en el mismo turno. `padre` da el camino, para animarlo. */
  function alcance(fichas, f, pasos) {
    const desde = fichas[f];
    const ocupadas = new Set();
    fichas.forEach((p, i) => { if (i !== f && !enSala(p)) ocupadas.add(p); });
    const dist = new Map(), padre = new Map(), salas = new Map();
    const cola = [];
    const salaInicial = salaDe(desde);
    if (enSala(desde)) {
      for (const p of PUERTAS_DE[salaInicial]) {
        if (ocupadas.has(p) || dist.has(p)) continue;
        dist.set(p, 1); padre.set(p, desde); cola.push(p);
      }
    } else {
      dist.set(desde, 0); cola.push(desde);
    }
    for (let i = 0; i < cola.length; i++) {
      const p = cola[i], d = dist.get(p);
      for (const l of ABRE_A.get(p) || []) {
        if (l !== salaInicial && d + 1 <= pasos && !salas.has(l)) salas.set(l, { d: d + 1, por: p });
      }
      if (d >= pasos) continue;
      for (const q of vecinos(p)) {
        if (!esPasillo(q) || ocupadas.has(q) || dist.has(q)) continue;
        dist.set(q, d + 1); padre.set(q, p); cola.push(q);
      }
    }
    dist.delete(desde);
    return { casillas: dist, salas, padre, desde };
  }
  /* El camino de `a` a una casilla o a una sala, casilla por casilla. */
  function camino(al, destino) {
    const r = [];
    let p = destino;
    if (enSala(destino)) {
      const s = al.salas.get(salaDe(destino));
      if (!s) return [];
      r.push(destino);
      p = s.por;
    }
    while (p !== undefined && p !== al.desde) {
      r.push(p);
      if (enSala(p)) break;
      p = al.padre.get(p);
    }
    return r.reverse();
  }
  function destinoValido(fichas, f, pasos, a) {
    if (!Number.isInteger(a)) return false;
    const al = alcance(fichas, f, pasos);
    return enSala(a) ? al.salas.has(salaDe(a)) : al.casillas.has(a);
  }

  /* ============================================================
     Azar sin servidor: mulberry32 para lo que sale de la semilla
     pública (dónde empieza cada arma) y SHA-256 para los dados, que
     dependen de lo que ha pasado en la mesa desde el turno anterior.
     ============================================================ */
  function rng(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function baraja(n, r) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* SHA-256 a mano, síncrono: el reductor lo necesita y `crypto.subtle`
     es asíncrono. Es el mismo de `motor.js` de colabtex, y da lo mismo
     que `crypto.subtle`, así que sirve también para la promesa de la
     ficha (`hmazo`). */
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
  const shaMemo = new Map();
  function sha256hex(texto) {
    const s = String(texto);
    const ya = shaMemo.get(s);
    if (ya) return ya;
    const b = new TextEncoder().encode(s);
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
        const s0 = ror(a, 7) ^ ror(a, 18) ^ (a >>> 3);
        const s1 = ror(c, 17) ^ ror(c, 19) ^ (c >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [A, B, C, D, E, F, G, H] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = ror(E, 6) ^ ror(E, 11) ^ ror(E, 25);
        const ch = (E & F) ^ (~E & G);
        const t1 = (H + S1 + ch + SHA_K[i] + w[i]) | 0;
        const S0 = ror(A, 2) ^ ror(A, 13) ^ ror(A, 22);
        const may = (A & B) ^ (A & C) ^ (B & C);
        const t2 = (S0 + may) | 0;
        H = G; G = F; F = E; E = (D + t1) | 0;
        D = C; C = B; B = A; A = (t1 + t2) | 0;
      }
      h[0] = (h[0] + A) | 0; h[1] = (h[1] + B) | 0; h[2] = (h[2] + C) | 0; h[3] = (h[3] + D) | 0;
      h[4] = (h[4] + E) | 0; h[5] = (h[5] + F) | 0; h[6] = (h[6] + G) | 0; h[7] = (h[7] + H) | 0;
    }
    const out = h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
    if (shaMemo.size > 20000) shaMemo.clear();
    shaMemo.set(s, out);
    return out;
  }
  /* La promesa de la ficha, igual que `compromiso` de colabtex. */
  const compromiso = (sem, sal) => sha256hex(JSON.stringify(sem) + "|" + sal);

  /* Los dados de un turno: dos, del 1 al 6, de la semilla de la sala,
     el número de turno y la huella de todo lo jugado hasta entonces
     (`huella`). Salen igual en todas las pantallas y se enseñan al
     empezar el turno; lo que nadie puede es saber los de dentro de
     tres turnos, porque dependen de jugadas que aún no existen. */
  function dados(semilla, turno, huella) {
    const h = sha256hex("clue-d:" + (semilla >>> 0) + ":" + turno + ":" + huella);
    return [1 + parseInt(h.slice(0, 8), 16) % 6, 1 + parseInt(h.slice(8, 16), 16) % 6];
  }
  /* Lo que entra en la huella: lo pequeño y decisivo de cada jugada,
     no los mazos cifrados enteros. */
  const resumen = j => [j.t, j.uid, j.a, j.v, j.s, j.l, j.ok, typeof j.x === "string" ? j.x.slice(0, 48) : j.x].join(",");

  /* ============================================================
     El reductor.

     `reducir(jugadas, jugadores, op)`:
     - `jugadas`: el registro en orden, `[{k, t, uid, ...}]`.
     - `jugadores`: en orden de asiento, `[{uid, nombre, hmazo?}]`. El
       asiento `i` juega con el sospechoso `i`.
     - `op`: `{semilla, cripto, elenco}`. Primero cada uno elige su
       personaje; después, con `cripto` (la sala en línea) se reparte con
       el póquer mental, y sin él (la práctica) la mesa local ya repartió
       y se empieza jugando. `elenco` son los ids entre los que se
       rellenan los puestos libres; sin él quedan en "".

     Las jugadas (`t` cabe en los 16 caracteres que dejan las reglas):
       elegir    {t:"elige", r}  {t:"suelta"}
       reparto   {t:"mezcla", c, pk}  {t:"revuelve", c}  {t:"quita", c}
       turno     {t:"mueve", a, v:"dado"|"pasadizo"}  {t:"sugiere", s, a}
                 {t:"acusa", s, a, l}  {t:"pasa"}
       refutar   {t:"muestra", x}  {t:"paso"}
       acusación {t:"abre", c}  {t:"veredicto", ok}
       siempre   {t:"abandona"}  {t:"s", sem, sal}
     Una jugada que no toca, o que no vale, no existe: se ignora.
     ============================================================ */
  const NUEVE = NL;
  const SOBRE = [0, NS, NS + NA];                 // posiciones del sobre en el mazo entero
  const RESTO = Array.from({ length: NC }, (_, i) => i).filter(i => !SOBRE.includes(i));
  const LARGO_VALOR = 64;                          // cada número cifrado, en base64url

  function reducir(jugadas, jugadores, op) {
    op = op || {};
    const semilla = (op.semilla >>> 0) || 0, cripto = !!op.cripto;
    const elenco = Array.isArray(op.elenco) ? op.elenco.filter(idValido) : [];
    const js = (jugadores || []).slice(0, NS).map((j, i) => ({ uid: j.uid, nombre: j.nombre || "Jugador", ficha: i, hmazo: j.hmazo || "" }));
    const n = js.length;
    const ids = js.map(j => j.uid);
    const asiento = new Map(ids.map((u, i) => [u, i]));
    const fichas = SALIDAS.map(([x, y]) => pos(x, y));
    const armas = baraja(NUEVE, rng(semilla ^ 0x5bd1e995)).slice(0, NA);   // arma i → sala
    const fuera = {}, eliminados = {}, llamado = {}, semillas = {};
    const hist = [], sugerencias = [], acusaciones = [];
    /* `mesa`: quienes reciben cartas, fijado al acabar de elegir. */
    const cr = { mesa: [], pk: {}, etapa: "mezcla", orden: 0, mezcla: "", revuelta: "", quitada: "", abre: "", hechos: [] };
    const eleccion = {};
    let fase = "elige";
    let turno = "", nTurno = 0, paso = "inicio", entro = false, sugirio = false;
    let tirada = null, huella = "0", sug = null, acu = null;
    let ganador = null, motivo = "", solucion = null, aceptadas = 0;

    const activo = u => asiento.has(u) && !fuera[u];
    const enJuego = u => activo(u) && !eliminados[u];
    /* El siguiente en sentarse después de `u` que cumpla `f`. */
    function siguiente(u, f) {
      const i0 = asiento.has(u) ? asiento.get(u) : -1;
      for (let d = 1; d <= n; d++) {
        const v = ids[(i0 + d + n) % n];
        if (f(v)) return v;
      }
      return "";
    }
    function empiezaTurno(u) {
      turno = u; nTurno++; paso = "inicio"; entro = false; sugirio = false; sug = null;
      tirada = u ? dados(semilla, nTurno, huella) : null;
    }
    function acabaTurno() {
      delete llamado[turno];
      acu = null;
      if (cierra()) return;
      empiezaTurno(siguiente(turno, enJuego));
    }
    /* ¿Se acabó? Quien acierta gana (lo decide `veredicto`); si solo
       queda uno sin haber acusado mal, gana él; si no queda nadie, no
       gana nadie. */
    function cierra() {
      if (ganador !== null) return true;
      const vivos = ids.filter(enJuego);
      const presentes = ids.filter(activo);
      if (presentes.length <= 1 && n > 1) {
        ganador = presentes[0] || ""; motivo = "abandono"; return true;
      }
      if (vivos.length === 1 && n > 1) { ganador = vivos[0]; motivo = "ultimo"; return true; }
      if (vivos.length === 0) { ganador = ""; motivo = "nadie"; return true; }
      return false;
    }
    /* El reparto va en orden de asiento: mezcla (las NC), revuelve y
       quita (las NC - 3 que no van al sobre). Quien debe la siguiente es el asiento `cr.orden`. */
    const etapas = ["mezcla", "revuelve", "quita"];
    const debeReparto = () => cr.mesa[cr.orden] || "";
    const largoOk = (c, k) => typeof c === "string" && c.length === k * LARGO_VALOR && /^[A-Za-z0-9_-]+$/.test(c);

    function refutadorTras(u) {
      /* Refutan todos los que siguen sentados, también los eliminados:
         sus cartas siguen en la mesa. */
      return siguiente(u, v => activo(v) && v !== sug.uid);
    }
    function avanzaRefuta(desde) {
      const v = refutadorTras(desde);
      if (!v || v === sug.uid || sug.pasaron.includes(v)) {
        sug.espera = "";
        hist.push({ e: "nadie", uid: sug.uid });
        paso = "tras";
      } else sug.espera = v;
    }
    function empiezaAbre() {
      /* Los demás, en orden, quitan su candado de las tres cartas del
         sobre; el último candado lo quita quien acusa, en su pantalla. */
      acu.faltan = [];
      let v = acu.uid;
      for (let i = 0; i < n; i++) {
        v = siguiente(v, x => activo(x) && x !== acu.uid);
        if (!v || acu.faltan.includes(v)) break;
        acu.faltan.push(v);
      }
      paso = acu.faltan.length ? "abre" : "veredicto";
    }

    /* Todos eligieron: a repartir (o a jugar, en la práctica). */
    function eligieron() {
      if (!ids.filter(activo).every(v => eleccion[v])) return;
      cr.mesa = ids.filter(activo);
      fase = cripto ? "reparto" : "jugando";
      if (fase === "jugando") { hist.push({ e: "reparto" }); empiezaTurno(ids.find(enJuego) || ""); }
    }

    for (const j of jugadas || []) {
      if (!j || typeof j !== "object") continue;
      const u = j.uid;
      if (j.t === "s") {
        if (asiento.has(u) && Number.isFinite(Number(j.sem)) && typeof j.sal === "string") {
          const f = js[asiento.get(u)];
          if (!f.hmazo || compromiso(Number(j.sem), j.sal) === f.hmazo) semillas[u] = { sem: Number(j.sem), sal: j.sal };
        }
        continue;
      }
      if (ganador !== null) continue;
      if (j.t === "abandona") {
        if (!activo(u)) continue;
        fuera[u] = true;
        hist.push({ e: "sale", uid: u });
        /* En línea, las cartas de quien se va sin revelar su semilla
           quedan cerradas para siempre, y con ellas el sobre. */
        if (cripto && fase !== "elige" && !semillas[u] && ids.filter(activo).length > 1) {
          ganador = ""; motivo = "anulada"; continue;
        }
        if (cierra()) continue;
        if (fase === "elige") { eligieron(); continue; }
        if (fase !== "jugando") continue;
        if (sug && sug.espera === u) avanzaRefuta(u);
        if (acu && acu.faltan) {
          acu.faltan = acu.faltan.filter(v => v !== u);
          if (paso === "abre" && !acu.faltan.length) paso = "veredicto";
        }
        if (turno === u) acabaTurno();
        continue;
      }
      /* Solo lo aceptado entra en la huella de los dados: una jugada
         inválida no existe, y si contara bastaría escribir basura para
         volver a tirar los dados de los turnos siguientes. */
      const vale = () => { aceptadas++; huella = sha256hex(huella + "|" + resumen(j)); };

      /* Mientras quede alguien eligiendo, se puede cambiar de personaje
         (otro `elige` con uno libre) o soltarlo (`suelta`). La partida
         arranca cuando todos tienen uno: desde ahí ya no se cambia. */
      if (fase === "elige") {
        if (!activo(u)) continue;
        if (j.t === "suelta") {
          if (!eleccion[u]) continue;
          delete eleccion[u];
          vale();
          continue;
        }
        if (j.t !== "elige" || !idValido(j.r) || eleccion[u] === j.r || Object.values(eleccion).includes(j.r)) continue;
        eleccion[u] = j.r;
        vale();
        eligieron();
        continue;
      }
      if (fase === "reparto") {
        if (u !== debeReparto() || j.t !== cr.etapa) continue;
        if (cr.etapa === "mezcla") {
          if (!largoOk(j.c, NC) || typeof j.pk !== "string" || j.pk.length !== LARGO_VALOR) continue;
          cr.mezcla = j.c; cr.pk[u] = j.pk;
        } else if (cr.etapa === "revuelve") {
          if (!largoOk(j.c, RESTO.length)) continue;
          cr.revuelta = j.c;
        } else {
          if (!largoOk(j.c, RESTO.length)) continue;
          cr.quitada = j.c;
        }
        cr.hechos.push({ t: j.t, uid: u, k: j.k });
        vale();
        cr.orden++;
        if (cr.orden >= cr.mesa.length) {
          cr.orden = 0;
          const e = etapas.indexOf(cr.etapa) + 1;
          if (e < etapas.length) {
            cr.etapa = etapas[e];
            if (cr.etapa === "revuelve") cr.revuelta = RESTO.map(i => cr.mezcla.substr(i * LARGO_VALOR, LARGO_VALOR)).join("");
            if (cr.etapa === "quita") cr.quitada = cr.revuelta;
          } else {
            cr.etapa = "listo";
            fase = "jugando";
            hist.push({ e: "reparto" });
            empiezaTurno(ids.find(enJuego) || "");
          }
        }
        continue;
      }
      if (fase !== "jugando") continue;
      if (!turno) empiezaTurno(ids.find(enJuego) || "");

      /* --- refutar --- */
      if (paso === "refuta") {
        if (u !== sug.espera) continue;
        if (j.t === "paso") {
          vale();
          sug.pasaron.push(u);
          hist.push({ e: "paso", uid: u });
          avanzaRefuta(u);
        } else if (j.t === "muestra" && (typeof j.x === "string" ? j.x.length <= 400 : Number.isInteger(j.x))) {
          vale();
          sug.mostro = u; sug.x = j.x; sug.kx = j.k; sug.espera = "";
          hist.push({ e: "muestra", uid: u, para: sug.uid });
          paso = "tras";
        }
        continue;
      }
      /* --- abrir el sobre --- */
      if (paso === "abre") {
        if (j.t !== "abre" || u !== acu.faltan[0] || !largoOk(j.c, 3)) continue;
        vale();
        cr.abre = j.c;
        acu.faltan.shift();
        acu.abiertos.push(u);
        if (!acu.faltan.length) paso = "veredicto";
        continue;
      }
      if (paso === "veredicto") {
        if (j.t !== "veredicto" || u !== acu.uid) continue;
        vale();
        acu.ok = !!j.ok;
        acusaciones.push({ uid: u, s: acu.s, a: acu.a, l: acu.l, ok: acu.ok, k: j.k });
        hist.push({ e: "veredicto", uid: u, ok: acu.ok, s: acu.s, a: acu.a, l: acu.l });
        if (acu.ok) {
          ganador = u; motivo = "acierto"; solucion = [acu.s, acu.a, acu.l];
          continue;
        }
        eliminados[u] = true;
        acabaTurno();
        continue;
      }
      /* --- el turno --- */
      if (u !== turno) continue;
      const f = asiento.get(u);
      if (j.t === "mueve" && paso === "inicio") {
        const donde = fichas[f];
        if (j.v === "pasadizo") {
          const q = enSala(donde) ? pasadizoDe(salaDe(donde)) : null;
          if (!q || j.a !== SALA + q.a) continue;
        } else if (!tirada || !destinoValido(fichas, f, tirada[0] + tirada[1], j.a)) continue;
        vale();
        fichas[f] = j.a;
        entro = enSala(j.a);
        paso = "accion";
        hist.push({ e: "mueve", uid: u, a: j.a, v: j.v === "pasadizo" ? "pasadizo" : "dado", dados: j.v === "pasadizo" ? null : tirada });
        continue;
      }
      if (j.t === "sugiere" && !sugirio && (paso === "accion" || paso === "inicio")) {
        const l = salaDe(fichas[f]);
        const puede = l >= 0 && (paso === "accion" ? entro : !!llamado[u]);
        const s = j.s, a = j.a;
        if (!puede || !Number.isInteger(s) || s < 0 || s >= NS || !Number.isInteger(a) || a < 0 || a >= NA) continue;
        /* El sospechoso nombrado y el arma vienen a la sala. Si ese
           sospechoso es de alguien, en su próximo turno puede sugerir
           ahí mismo sin moverse. */
        vale();
        fichas[s] = SALA + l;
        armas[a] = l;
        const citado = ids[s];
        if (citado && citado !== u && activo(citado)) llamado[citado] = true;
        sugirio = true;
        sug = { uid: u, s, a, l, k: j.k, pasaron: [], mostro: "", x: null, espera: "" };
        sugerencias.push(sug);
        hist.push({ e: "sugiere", uid: u, s, a, l });
        paso = "refuta";
        avanzaRefuta(u);
        continue;
      }
      if (j.t === "acusa" && paso !== "refuta") {
        const { s, a, l } = j;
        if (![s, a, l].every(Number.isInteger) || s < 0 || s >= NS || a < 0 || a >= NA || l < 0 || l >= NL) continue;
        vale();
        acu = { uid: u, s, a, l, k: j.k, faltan: [], abiertos: [], ok: null };
        hist.push({ e: "acusa", uid: u, s, a, l });
        if (cripto) { cr.abre = SOBRE.map(i => cr.mezcla.substr(i * LARGO_VALOR, LARGO_VALOR)).join(""); empiezaAbre(); }
        else paso = "veredicto";
        continue;
      }
      if (j.t === "pasa" && paso !== "refuta") {
        vale();
        hist.push({ e: "pasa", uid: u });
        acabaTurno();
        continue;
      }
    }

    if (ganador === null && fase === "jugando" && !turno) empiezaTurno(ids.find(enJuego) || "");
    const fin = ganador !== null;
    /* Quién ocupa cada puesto: el asiento i, lo que eligió; el resto,
       del elenco sin repetir, en un orden que sale de la semilla. */
    const personajes = COLORES.map((_, i) => (ids[i] && eleccion[ids[i]]) || "");
    const libres = elenco.filter(r => !personajes.includes(r));
    const orden = baraja(libres.length, rng(semilla ^ 0x2545f491)).map(i => libres[i]);
    for (let i = 0; i < NS; i++) if (!personajes[i] && orden.length) personajes[i] = orden.shift();
    /* A quién espera la mesa: lo que enciende «Tu turno». */
    let debe = [];
    if (!fin) {
      if (fase === "elige") debe = ids.filter(v => activo(v) && !eleccion[v]);
      else if (fase === "reparto") debe = [debeReparto()];
      else if (paso === "refuta" && sug && sug.espera) debe = [sug.espera];
      else if (paso === "abre" && acu) debe = [acu.faltan[0]];
      else if (paso === "veredicto" && acu) debe = [acu.uid];
      else if (turno) debe = [turno];
    }
    const pozo = fichas[asiento.has(turno) ? asiento.get(turno) : 0];
    return {
      fase: fin ? "fin" : fase,
      jugadores: js, turno: fin ? "" : turno, nTurno, paso, debe: debe.filter(Boolean),
      dados: fin ? null : tirada, entro, sugirio,
      puedeSugerir: !fin && fase === "jugando" && !sugirio && turno !== "" && salaDe(pozo) >= 0 &&
        ((paso === "accion" && entro) || (paso === "inicio" && !!llamado[turno])),
      eleccion, personajes,
      fichas, armas, fuera, eliminados, llamado,
      sug, acu, sugerencias, acusaciones, hist: hist.slice(-80),
      cr, semillas,
      ganador, motivo, solucion, aceptadas,
      puntos: fin && ganador ? { [ganador]: 1 } : {}
    };
  }

  /* De 0 a 1, para la música: cuánto se ha estrechado el caso. */
  function progreso(est) {
    if (!est || est.fase !== "jugando") return 0;
    const n = Math.max(1, est.jugadores.length);
    return Math.min(1, (est.sugerencias.length / (4 * n)) * 0.7 + (Object.keys(est.eliminados).length / n) * 0.3);
  }

  /* ============================================================
     El póquer mental (SRA), como el del Presidente y sobre su mismo
     primo seguro de 384 bits. Cada carta es H(id)² mod p, del subgrupo
     de residuos cuadráticos; cifrar es elevar a un exponente secreto, y
     elevar conmuta.

     1. `mezcla` (en orden de asiento): cada uno cifra las NC con su
        exponente k1 y baraja *dentro* de cada categoría. La primera de
        cada una (posiciones 0, 6 y 15) es el sobre.
     2. `revuelve` (en orden): las NC - 3 restantes se cifran con k2 y se
        barajan todas juntas, para que nadie sepa de qué tipo es la
        mano de nadie.
     3. `quita` (en orden): cada uno quita k1·k2 de las cartas que no
        son suyas (la j es del asiento j mod n). A cada una le queda
        solo el candado de su dueño, que la abre en su pantalla.
     4. Para refutar, la carta viaja en un **sobre** de Diffie-Hellman
        entre los dos (`muestra.x`): nadie más la ve.
     5. Para acusar, los demás quitan en orden su k1 de las tres del
        sobre (`abre`); el último candado lo quita quien acusa.
     Al acabar, todos revelan su semilla (`{t:"s"}`) y `auditar` rehace
     cada paso: quién mezcló de verdad, quién dijo «no tengo» teniendo,
     quién enseñó una carta que no era suya, y qué había en el sobre.
     ============================================================ */
  const P = BigInt("0xb6bf55230ee6009266d1e75101cad38d71e5a1bd4d71c91b1099365a0ccc4f0b2f62fabbe3241387cc00f1742c8be47f");
  const Q = (P - 1n) / 2n;
  function potMod(b, e, m) {
    let r = 1n; b %= m;
    while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; }
    return r;
  }
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const B64I = (() => { const m = {}; for (let i = 0; i < 64; i++) m[B64[i]] = i; return m; })();
  function cod(x) {
    const h = x.toString(16).padStart(96, "0");
    let s = "";
    for (let i = 0; i < 96; i += 3) { const v = parseInt(h.substr(i, 3), 16); s += B64[v >> 6] + B64[v & 63]; }
    return s;
  }
  function num(s, o) {
    let h = "";
    for (let i = o; i < o + 64; i += 2) {
      const a = B64I[s[i]], b = B64I[s[i + 1]];
      if (a === undefined || b === undefined) return 0n;
      h += ((a << 6) | b).toString(16).padStart(3, "0");
    }
    const x = BigInt("0x" + h);
    return x > 1n && x < P ? x : 0n;
  }
  function trozos(v, k) {
    if (typeof v !== "string" || v.length !== 64 * k) return null;
    const x = [];
    for (let j = 0; j < k; j++) { const y = num(v, j * 64); if (!y) return null; x.push(y); }
    return x;
  }
  const TABLA = (() => {
    const c = [], id = new Map();
    for (let i = 0; i < NC; i++) {
      const h = BigInt("0x" + sha256hex("clue-c:" + i));
      const v = cod(h * h % P);
      c.push(v); id.set(v, i);
    }
    return { texto: c.join(""), id };
  })();
  const mazoInicial = () => TABLA.texto;
  const cartaDeValor = x => { const i = TABLA.id.get(cod(x)); return i === undefined ? -1 : i; };

  /* Todo lo que sale de la semilla privada de un jugador en esta sala:
     los dos exponentes con sus inversos, las permutaciones y la
     privada de Diffie-Hellman. */
  const llMemo = new Map();
  function llaves(sem, sal) {
    const c = sem + ":" + sal;
    if (llMemo.has(c)) return llMemo.get(c);
    const exp = e => BigInt("0x" + sha256hex("clue-" + e + ":" + c)) % (Q - 1n) + 1n;
    const perm = (e, k) => {
      const a = Array.from({ length: k }, (_, i) => i);
      for (let i = k - 1; i > 0; i--) {
        const j = parseInt(sha256hex("clue-p" + e + ":" + c + ":" + i).slice(0, 8), 16) % (i + 1);
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    };
    const k1 = exp("k1"), k2 = exp("k2"), dh = exp("dh");
    const v = {
      k1, k2, k1i: potMod(k1, Q - 2n, Q), k2i: potMod(k2, Q - 2n, Q),
      ps: perm("s", NS), pa: perm("a", NA), pl: perm("l", NL), pr: perm("r", RESTO.length),
      dh, pk: cod(potMod(4n, dh, P))
    };
    v.ki = v.k1i * v.k2i % Q;
    if (llMemo.size > 200) llMemo.clear();
    llMemo.set(c, v);
    return v;
  }
  const pkDe = (sem, sal) => llaves(sem, sal).pk;

  function mezcla(prev, ll) {
    const x = trozos(prev, NC);
    if (!x) return null;
    const y = x.map(v => potMod(v, ll.k1, P));
    const out = new Array(NC);
    const bloques = [[0, ll.ps], [NS, ll.pa], [NS + NA, ll.pl]];
    for (const [o, p] of bloques) p.forEach((de, i) => { out[o + i] = y[o + de]; });
    return out.map(cod).join("");
  }
  function revuelve(prev, ll) {
    const x = trozos(prev, RESTO.length);
    if (!x) return null;
    const y = x.map(v => potMod(v, ll.k2, P));
    return ll.pr.map(de => cod(y[de])).join("");
  }
  /* `mias`: las posiciones del resto (0 a NC - 4) que son de quien quita. */
  function quita(prev, ll, mias) {
    const x = trozos(prev, RESTO.length);
    if (!x) return null;
    const m = new Set(mias);
    return x.map((v, j) => cod(m.has(j) ? v : potMod(v, ll.ki, P))).join("");
  }
  function abre(prev, ll) {
    const x = trozos(prev, 3);
    if (!x) return null;
    return x.map(v => cod(potMod(v, ll.k1i, P))).join("");
  }
  /* Las cartas propias: lo que queda en mis posiciones tras la última
     quita, sin mi candado. -1 si algo no cuadra (alguien hizo trampa). */
  function mano(quitada, ll, mias) {
    const x = trozos(quitada, RESTO.length);
    if (!x) return mias.map(() => -1);
    return mias.map(j => cartaDeValor(potMod(x[j], ll.ki, P)));
  }
  function sobreAbierto(abierto, ll) {
    const x = trozos(abierto, 3);
    if (!x) return [-1, -1, -1];
    return x.map(v => cartaDeValor(potMod(v, ll.k1i, P)));
  }
  const posicionesDe = (i, n) => RESTO.map((_, j) => j).filter(j => j % n === i);

  /* Diffie-Hellman sobre el mismo primo (generador 4, del subgrupo).
     Un sobre es texto XOR un flujo de SHA-256 de la clave compartida y
     su `id` (la clave de la sugerencia), como los del UNO. */
  function compartida(ll, pkOtro) {
    const y = typeof pkOtro === "string" && pkOtro.length === 64 ? num(pkOtro, 0) : 0n;
    return y ? sha256hex("clue-k:" + cod(potMod(y, ll.dh, P))) : null;
  }
  function flujo(clave, id, largo) {
    const b = [];
    for (let i = 0; b.length < largo; i++) {
      const h = sha256hex(clave + ":" + id + ":" + i);
      for (let j = 0; j < 64 && b.length < largo; j += 2) b.push(parseInt(h.substr(j, 2), 16));
    }
    return b;
  }
  function cierraSobre(clave, id, carta) {
    const t = "clue:" + carta;
    const f = flujo(clave, id, t.length);
    let s = "";
    for (let i = 0; i < t.length; i++) s += ((t.charCodeAt(i) & 0xff) ^ f[i]).toString(16).padStart(2, "0");
    return s;
  }
  function abreSobre(clave, id, hex) {
    if (!clave || typeof hex !== "string" || hex.length % 2 || !/^[0-9a-f]+$/.test(hex)) return -1;
    const f = flujo(clave, id, hex.length / 2);
    let t = "";
    for (let i = 0; i < hex.length / 2; i++) t += String.fromCharCode(parseInt(hex.substr(i * 2, 2), 16) ^ f[i]);
    const m = /^clue:(\d{1,2})$/.exec(t);
    const c = m ? Number(m[1]) : -1;
    return c >= 0 && c < NC ? c : -1;
  }

  /* ============================================================
     La auditoría: con las semillas de todos, rehacer la partida entera
     y señalar a quien mintió. Devuelve `{problemas:[{uid, que, k}],
     sobre:[s,a,l]|null, manos:{uid:[cartas]}}`. Solo se puede auditar a
     quien reveló su semilla; los demás salen como `que:"oculta"`.
     ============================================================ */
  function auditar(jugadas, jugadores, op) {
    const est = reducir(jugadas, jugadores, op);
    const js = est.jugadores, mesa = est.cr.mesa, n = mesa.length;
    const problemas = [];
    const ll = {};
    for (const j of js) {
      const s = est.semillas[j.uid];
      if (s) ll[j.uid] = llaves(s.sem, s.sal);
      else problemas.push({ uid: j.uid, que: "oculta" });
    }
    const todas = mesa.length > 0 && mesa.every(u => ll[u]);
    /* Cada paso del reparto, rehecho por quien lo firmó. */
    let mz = mazoInicial(), rv = "", qt = "";
    const pasos = (jugadas || []).filter(j => ["mezcla", "revuelve", "quita"].includes(j.t) && est.cr.hechos.some(h => h.k === j.k));
    for (const j of pasos) {
      const l = ll[j.uid];
      const i = mesa.indexOf(j.uid);
      if (j.t === "mezcla") {
        if (l && (mezcla(mz, l) !== j.c || l.pk !== j.pk)) problemas.push({ uid: j.uid, que: "mezcla", k: j.k });
        mz = j.c;
      } else if (j.t === "revuelve") {
        if (!rv) rv = RESTO.map(p => mz.substr(p * 64, 64)).join("");
        if (l && revuelve(rv, l) !== j.c) problemas.push({ uid: j.uid, que: "revuelve", k: j.k });
        rv = j.c;
      } else {
        if (!qt) qt = rv;
        if (l && quita(qt, l, posicionesDe(i, n)) !== j.c) problemas.push({ uid: j.uid, que: "quita", k: j.k });
        qt = j.c;
      }
    }
    const manos = {};
    if (qt) mesa.forEach((u, i) => { if (ll[u]) manos[u] = mano(qt, ll[u], posicionesDe(i, n)); });
    /* El sobre: las tres primeras de cada categoría tras la última mezcla,
       sin ningún candado. */
    let sobre = null;
    if (todas && mz !== mazoInicial()) {
      const x = trozos(SOBRE.map(p => mz.substr(p * 64, 64)).join(""), 3);
      if (x) {
        const e = mesa.reduce((a, u) => a * ll[u].k1i % Q, 1n);
        sobre = x.map(v => cartaDeValor(potMod(v, e, P)));
      }
    }
    /* Cada respuesta a una sugerencia. */
    const tieneMano = u => manos[u] || null;
    for (const s of est.sugerencias) {
      const pedidas = [cartaS(s.s), cartaA(s.a), cartaL(s.l)];
      for (const u of s.pasaron) {
        const m = tieneMano(u);
        if (m && m.some(c => pedidas.includes(c))) problemas.push({ uid: u, que: "paso", k: s.k });
      }
      if (s.mostro && ll[s.mostro] && typeof s.x === "string") {
        const pkPara = est.cr.pk[s.uid];
        const c = abreSobre(compartida(ll[s.mostro], pkPara), s.k, s.x);
        const m = tieneMano(s.mostro);
        if (c < 0 || !pedidas.includes(c) || (m && !m.includes(c))) problemas.push({ uid: s.mostro, que: "muestra", k: s.k });
      }
    }
    /* Cada veredicto, contra el sobre de verdad. */
    if (sobre) {
      for (const a of est.acusaciones) {
        const bien = sobre[0] === cartaS(a.s) && sobre[1] === cartaA(a.a) && sobre[2] === cartaL(a.l);
        if (bien !== a.ok) problemas.push({ uid: a.uid, que: "veredicto", k: a.k });
      }
    }
    return { problemas, sobre, manos };
  }

  return {
    COLORES, NOMBRE_COLOR, SOSPECHOSOS, idValido, ARMAS, LUGARES, NS, NA, NL, NC, cartaS, cartaA, cartaL, tipoCarta, nombreCarta,
    ANCHO, ALTO, SALA, RECT, PATIO, HUECOS, PUERTAS, PASADIZOS, SALIDAS, PUERTAS_DE,
    PASILLO, HUECO, CENTRO, pos, xy, enSala, salaDe, celda, esPasillo, pasadizoDe, vecinos,
    alcance, camino, destinoValido,
    rng, baraja, sha256hex, compromiso, dados,
    reducir, progreso,
    SOBRE, RESTO, P, Q, potMod, cod, num, trozos, mazoInicial, cartaDeValor,
    llaves, pkDe, mezcla, revuelve, quita, abre, mano, sobreAbierto, posicionesDe,
    compartida, cierraSobre, abreSobre, auditar
  };
});
