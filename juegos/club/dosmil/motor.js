/* El motor del 2048: el tablero, las jugadas, dónde aparece cada ficha
   nueva y los puntos, y nada que se dibuje. juego.js lo usa para jugar y el
   verificador antitrampas (colabtex/src/juegos/solo/verifica/dosmil.js)
   para rehacer la partida desde su prueba: la semilla, la cuenta y cada
   jugada con su dirección.

   - **El tablero son exponentes**: 0 vacío, 1 es el 2, 2 el 4… 11 el 2048.
     Así una casilla es un entero chico y comparar dos fichas es comparar
     números.
   - **El azar no es del navegador.** La ficha k-ésima que aparece (las dos
     del principio incluidas) sale de su propio chorro mulberry32
     (`mezcla(base, k + 1)`), y la cuenta entra en la base: una prueba
     copiada de otra persona no rehace el mismo tablero. Un 2 nueve veces de
     cada diez, un 4 la décima, como el original.
   - **Una jugada que no mueve nada no existe**: no hace aparecer ficha, no
     cuenta en la prueba y `rehace` la rechaza. */
(function (root) {
  'use strict';
  const N = 4, CASILLAS = N * N, GANA = 11;
  // Direcciones: 0 arriba, 1 derecha, 2 abajo, 3 izquierda.
  const NOMBRES = ['arriba', 'derecha', 'abajo', 'izquierda'];

  function rng(a) {
    a >>>= 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mezcla(s, n) {
    let h = Math.imul((s ^ Math.imul(n | 0, 0x9E3779B1)) >>> 0, 0x85EBCA6B);
    h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
    return h >>> 0;
  }
  function hashTexto(t) {
    let h = 0x811C9DC5;
    for (const ch of String(t)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  const valor = e => e ? 2 ** e : 0;

  /* La ficha que aparece: una casilla vacía al azar y un 2 o un 4.
     Devuelve {i, e} o null si no queda sitio. */
  function aparece(E) {
    const libres = [];
    for (let i = 0; i < CASILLAS; i++) if (!E.t[i]) libres.push(i);
    if (!libres.length) return null;
    const r = rng(mezcla(E.base, ++E.k));
    const i = libres[Math.floor(r() * libres.length)], e = r() < 0.9 ? 1 : 2;
    E.t[i] = e;
    if (e > E.max) E.max = e;
    return { i, e };
  }

  function nueva(semilla, u) {
    const E = { semilla: semilla >>> 0, u: String(u || ''), t: new Array(CASILLAS).fill(0), k: 0, puntos: 0, jugadas: 0, max: 0, gano: false };
    E.base = mezcla(E.semilla, hashTexto(E.u));
    E.inicio = [aparece(E), aparece(E)];
    return E;
  }

  // Las cuatro casillas de una línea, en el orden en que se empujan.
  function linea(dir, j) {
    const out = [];
    for (let p = 0; p < N; p++) {
      if (dir === 0) out.push(p * N + j);
      else if (dir === 2) out.push((N - 1 - p) * N + j);
      else if (dir === 3) out.push(j * N + p);
      else out.push(j * N + (N - 1 - p));
    }
    return out;
  }

  /* Una jugada. Devuelve null si no mueve nada; si mueve, {movs, fusiones,
     suma, nueva}: `movs` es [desde, hasta, e] por ficha (para animar),
     `fusiones` las casillas donde se juntaron dos, y `nueva` la ficha que
     apareció. Cada ficha se junta una sola vez por jugada, como en el
     original: [2,2,2,2] da [4,4], no [8]. */
  function mueve(E, dir) {
    if (!(dir >= 0 && dir <= 3)) return null;
    const movs = [], fusiones = [];
    let suma = 0, cambio = false;
    for (let j = 0; j < N; j++) {
      const L = linea(dir, j);
      let destino = 0, ultimo = -1; // ultimo: índice en L de la ficha que aún puede juntarse
      const antes = L.map(i => E.t[i]);
      const despues = [0, 0, 0, 0];
      for (let p = 0; p < N; p++) {
        const e = antes[p];
        if (!e) continue;
        if (ultimo >= 0 && despues[ultimo] === e) {
          despues[ultimo] = e + 1; suma += valor(e + 1);
          fusiones.push(L[ultimo]);
          movs.push([L[p], L[ultimo], e]);
          ultimo = -1;
        } else {
          despues[destino] = e;
          movs.push([L[p], L[destino], e]);
          ultimo = destino; destino++;
        }
      }
      for (let p = 0; p < N; p++) if (despues[p] !== antes[p]) cambio = true;
      if (cambio) for (let p = 0; p < N; p++) E.t[L[p]] = despues[p];
    }
    if (!cambio) return null;
    // `cambio` se queda en true en cuanto una línea cambia, así que las
    // líneas siguientes también se escriben: hay que escribirlas siempre.
    for (const f of fusiones) if (E.t[f] > E.max) E.max = E.t[f];
    E.puntos += suma; E.jugadas++;
    if (E.max >= GANA) E.gano = true;
    const nv = aparece(E);
    return { movs, fusiones, suma, nueva: nv };
  }

  // ¿Queda alguna jugada? Una casilla vacía o dos iguales vecinas.
  function puedeMover(E) {
    for (let i = 0; i < CASILLAS; i++) {
      if (!E.t[i]) return true;
      if (i % N < N - 1 && E.t[i] === E.t[i + 1]) return true;
      if (i + N < CASILLAS && E.t[i] === E.t[i + N]) return true;
    }
    return false;
  }

  /* La prueba de una partida: `{v: 1, s, u, f, a, w, fin}`. `f` son las
     jugadas, «<origen><dirección><Δms en base 36>» separadas por comas: el
     origen es r (ratón), t (dedo), k (teclado), m (mando) o x (un evento
     sintético sin mando); Δ son los ms jugados desde la anterior (sin
     pausas), con tope `DELTA_MAX`, así la prueba no crece si alguien deja
     la partida abierta. `a` y `w` son lo jugado con performance.now y con
     Date.now; `fin` si la partida terminó sin jugadas posibles. */
  const DELTA_MAX = 30000;
  function codifica(jugadas) {
    return jugadas.map(([d, o, ms]) => o + d + Math.max(0, Math.min(DELTA_MAX, Math.round(ms))).toString(36)).join(',');
  }
  function decodifica(f) {
    if (typeof f !== 'string' || f.length > 400000) return null;
    if (!f) return [];
    const out = [];
    for (const p of f.split(',')) {
      const m = /^([rtkmx])([0-3])([0-9a-z]{1,4})$/.exec(p);
      if (!m) return null;
      const ms = parseInt(m[3], 36);
      if (ms > DELTA_MAX) return null;
      out.push([+m[2], m[1], ms]);
    }
    return out;
  }

  /* Rehace una partida con este mismo motor. Cada jugada tiene que mover
     algo; devuelve los puntos, la ficha más alta, en qué ms se llegó a
     ella por primera vez (`tFicha`), el tiempo total y si quedan jugadas. */
  function rehace(semilla, u, jugadas) {
    if (!Array.isArray(jugadas)) return { error: 'La partida no se puede leer.' };
    const E = nueva(semilla, u);
    let ms = 0, tFicha = 0, max = E.max;
    for (let n = 0; n < jugadas.length; n++) {
      const [d, , dt] = jugadas[n];
      ms += dt;
      if (!mueve(E, d)) return { error: `La jugada ${n + 1} (${NOMBRES[d] || d}) no mueve nada en el tablero rehecho.` };
      if (E.max > max) { max = E.max; tFicha = ms; }
    }
    return { puntos: E.puntos, max: E.max, ficha: valor(E.max), tFicha: tFicha || ms, ms, vivo: puedeMover(E), E };
  }

  /* Lo menos que se tarda en jugadas: cada una suma 2 o 4 al tablero y se
     empieza con 4 u 8, así que la ficha T pide al menos (T − 8) / 4. */
  const jugadasMinimas = T => Math.max(0, Math.ceil((T - 8) / 4));

  // El progreso guardado: el mejor puntaje, la mejor ficha (y en cuánto) y las partidas.
  function mezclaProgreso(a, b) {
    const n = x => (Number.isFinite(+x) && +x > 0 ? Math.floor(+x) : 0);
    a = a && typeof a === 'object' ? a : {}; b = b && typeof b === 'object' ? b : {};
    const fa = n(a.ficha), fb = n(b.ficha);
    let ficha = fa, fichaT = n(a.fichaT);
    if (fb > fa || (fb === fa && fb && n(b.fichaT) && (!fichaT || n(b.fichaT) < fichaT))) { ficha = fb; fichaT = n(b.fichaT); }
    return { v: 1, mejor: Math.max(n(a.mejor), n(b.mejor)), ficha, fichaT, partidas: Math.max(n(a.partidas), n(b.partidas)) };
  }

  const api = { N, CASILLAS, GANA, NOMBRES, DELTA_MAX, rng, mezcla, hashTexto, valor, nueva, aparece, linea, mueve, puedeMover,
    codifica, decodifica, rehace, jugadasMinimas, mezclaProgreso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DosmilMotor = api;
})(globalThis);
