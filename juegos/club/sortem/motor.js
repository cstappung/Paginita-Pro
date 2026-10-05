/* sortEm — the pure engine: the deal, the three actions and the win check.
   No Phaser, no DOM: game.js plays through it and the anti-cheat verifier
   (colabtex/src/juegos/solo/verifica/sortem.js) replays a game's proof
   through the very same functions, so the two can never disagree about
   what a sequence of key presses does. UMD: `SortemMotor` in the page,
   `module.exports` in Node.

   The board is a row of blocks; each block is a run of consecutive numbers
   ([3], [4,5,6]…). There is a cursor (`sel`) and a «grabbed» flag:
     L / R   without a grab move the cursor; with a grab they swap the block
             with its neighbour (and the cursor follows it);
     A       grabs, or drops. Dropping merges the block with its neighbours
             when they continue each other, and the game is won when the
             numbers, read left to right, are in order. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.SortemMotor = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODOS = [10, 20];

  /* The deal comes from a 32-bit seed, not from Math.random: the proof of
     a game carries the seed and the verifier deals the same board. The
     player's browser picks the seed (crypto), which is fine: whatever the
     seed, that board still has to be sorted by hand. */
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Shuffle 1..n until no two neighbours differ by one (so nothing starts
     half-merged), at most 1000 tries — the original generator, now seeded. */
  function reparto(n, semilla) {
    const rnd = mulberry32(semilla >>> 0);
    let numeros, valido = false, intentos = 0;
    while (!valido && intentos < 1000) {
      intentos++;
      numeros = Array.from({ length: n }, (_, i) => i + 1);
      for (let i = numeros.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [numeros[i], numeros[j]] = [numeros[j], numeros[i]];
      }
      valido = true;
      for (let i = 0; i < numeros.length - 1; i++) {
        if (Math.abs(numeros[i] - numeros[i + 1]) === 1) { valido = false; break; }
      }
    }
    return numeros;
  }

  function nuevo(n, semilla) {
    return { n, semilla: semilla >>> 0, bloques: reparto(n, semilla).map(x => [x]), sel: 0, agarrado: false, ganado: false };
  }

  function ordenado(bloques) {
    const todos = bloques.flat();
    for (let i = 1; i < todos.length; i++) if (todos[i] < todos[i - 1]) return false;
    return true;
  }

  /* Merge the dropped block with whatever continues it, repeatedly. The
     cursor arithmetic is the original's, kept verbatim. */
  function fusiona(e, d) {
    const b = e.bloques;
    let cambio = true;
    while (cambio) {
      cambio = false;
      if (d > 0) {
        const a = b[d - 1], c = b[d];
        if (a[a.length - 1] + 1 === c[0]) {
          b[d - 1] = [...a, ...c];
          b.splice(d, 1);
          d--;
          if (e.sel >= d) e.sel--;
          cambio = true;
          continue;
        }
      }
      if (d < b.length - 1) {
        const a = b[d], c = b[d + 1];
        if (a[a.length - 1] + 1 === c[0]) {
          b[d] = [...a, ...c];
          b.splice(d + 1, 1);
          if (e.sel > d) e.sel--;
          cambio = true;
          continue;
        }
      }
    }
  }

  /* One key press: 'L', 'R' or 'A'. Returns what happened, for the screen
     to animate ({tipo, de, cambio, fusiones, gano}), or null once the game
     is already won (nothing moves after the last drop). */
  function aplica(e, accion) {
    if (e.ganado) return null;
    const de = e.sel, b = e.bloques;
    if (!e.agarrado) {
      if (accion === 'A') { e.agarrado = true; return { tipo: 'agarra', de, cambio: true, fusiones: 0, gano: false }; }
      const paso = accion === 'L' ? -1 : accion === 'R' ? 1 : 0;
      const a = de + paso;
      const cambio = paso !== 0 && a >= 0 && a < b.length;
      if (cambio) e.sel = a;
      return { tipo: 'sel', de, cambio, fusiones: 0, gano: false };
    }
    if (accion === 'A') {
      e.agarrado = false;
      const antes = b.length;
      fusiona(e, de);
      e.ganado = ordenado(e.bloques);
      return { tipo: 'suelta', de, cambio: true, fusiones: antes - e.bloques.length, gano: e.ganado };
    }
    const paso = accion === 'L' ? -1 : accion === 'R' ? 1 : 0;
    const a = de + paso;
    if (paso === 0 || a < 0 || a >= b.length) return { tipo: 'mueve', de, cambio: false, fusiones: 0, gano: false };
    [b[de], b[a]] = [b[a], b[de]];
    e.sel = a;
    return { tipo: 'mueve', de, cambio: true, fusiones: 0, gano: false };
  }

  /* Replays a whole action string from the seed. `ganaEn` is the index of
     the action that won (or -1) and `despues` how many actions came after
     it — a real game has none, the board stops taking input there. */
  function repite(n, semilla, acciones) {
    const e = nuevo(n, semilla);
    let ganaEn = -1, despues = 0;
    for (let i = 0; i < acciones.length; i++) {
      if (e.ganado) { despues++; continue; }
      const r = aplica(e, acciones[i]);
      if (r && r.gano) ganaEn = i;
    }
    return { estado: e, ganaEn, despues };
  }

  /* The time a game is worth, in ms. `t` is the instant of the winning drop
     measured from the key events (performance.now timebase: monotonic, and
     unaffected by frame rate or a throttled tab); `w` is the same span by
     the wall clock (Date.now). They agree to a frame or two. When the wall
     clock saw clearly more (a laptop that slept mid-game — performance.now
     stops there on some systems — or a performance.now slowed down from the
     console), the longer one counts: nobody gets a shorter time than what
     really went by. The margin absorbs frame delays and small NTP slews. */
  const MARGEN_RELOJ = ms => 1500 + Math.floor(ms * 0.03);
  function tiempoDe(t, w) {
    t = Math.max(1, Math.round(t));
    return Number.isFinite(w) && w > t + MARGEN_RELOJ(t) ? Math.round(w) : t;
  }

  return { MODOS, mulberry32, reparto, nuevo, ordenado, aplica, repite, MARGEN_RELOJ, tiempoDe };
});
