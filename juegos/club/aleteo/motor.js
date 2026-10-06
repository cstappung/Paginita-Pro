/* El motor de ALETEO: todo lo que decide un vuelo —la gravedad, el aleteo,
   dónde está cada hueco entre los tubos, cuándo se pasa uno y cuándo se
   choca— y nada que se dibuje. juego.js lo usa para jugar y el verificador
   antitrampas (colabtex/src/juegos/solo/verifica/aleteo.js) para rehacer el
   vuelo desde su prueba: la semilla, la cuenta y el tick de cada aleteo.

   Como el de BBTAN, es repetible en cualquier navegador y en Node:
   - **El tiempo es fijo** (`TICK`, 1/60 s). La pantalla puede ir a 30, 60 o
     144 cuadros: solo cambia cuántos ticks corren por cuadro, nunca lo que
     pasa en cada uno.
   - **Solo + − × ÷**, que IEEE redondea igual en todas partes; el azar es
     mulberry32 con semilla, un chorro por tubo (`mezcla(base, k)`), y la
     cuenta entra en la semilla: una prueba copiada de otra persona no rehace
     el mismo cielo.
   - **La oscuridad no toca el juego.** El lore (lore.js) lee el puntaje y
     cambia colores, textos y música; aquí no hay nada de eso. El tubo 200
     es tan ancho como el 20. */
(function (root) {
  'use strict';
  const W = 360, H = 640, SUELO = 560, PX = 100, R = 11;
  const TICK = 1 / 60, G = 0.42, ALETEO = -7.6, VMAX = 10.5, TECHO = -30;
  const TW = 64, VEL = 2.6, SEP = 210, X0 = W + 140;
  const Y0 = 262;
  // El hueco se cierra despacio de 168 a 132 px y ahí se queda.
  const HUECO_INI = 168, HUECO_MIN = 132, HUECO_PASO = 0.3;
  // Cuánto puede saltar el centro de un hueco al siguiente: subir cuesta
  // aletear, bajar solo dejarse caer, así que se permite más hacia abajo.
  const SUBE_MAX = 150, BAJA_MAX = 190, MARGEN_ARRIBA = 70, MARGEN_ABAJO = 60;

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
  const clamp = (n, a, b) => n < a ? a : n > b ? b : n;
  const hueco = k => Math.max(HUECO_MIN, HUECO_INI - k * HUECO_PASO);

  function nueva(semilla, u) {
    const E = { semilla: semilla >>> 0, u: String(u || ''), t: 0, y: Y0, vy: 0, puntos: 0, muerto: false,
      tubos: [], sig: 0, centro: 300, aleteos: 0 };
    E.base = mezcla(E.semilla, hashTexto(E.u));
    rellena(E);
    return E;
  }

  // El tubo k: su hueco sale de su propio chorro y del centro del anterior.
  function creaTubo(E) {
    const k = E.sig++, g = hueco(k), r = rng(mezcla(E.base, k + 1));
    const lo = MARGEN_ARRIBA + g / 2, hi = SUELO - MARGEN_ABAJO - g / 2;
    const desde = Math.max(lo, E.centro - SUBE_MAX), hasta = Math.min(hi, E.centro + BAJA_MAX);
    const c = Math.round(desde + r() * (hasta - desde));
    E.centro = c;
    E.tubos.push({ k, c, g, x: X0 + k * SEP - VEL * E.t, pasado: false });
  }
  function rellena(E) {
    while (!E.tubos.length || E.tubos[E.tubos.length - 1].x < W + SEP) creaTubo(E);
  }

  function choca(cx, cy, x1, y1, x2, y2) {
    const nx = clamp(cx, x1, x2), ny = clamp(cy, y1, y2), dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < R * R;
  }

  /* Un tick. `aletea` es si en este tick se aleteó. Devuelve lo que pasó
     (`punto`, `muerte`, `golpe`: 'tubo' o 'suelo') para que la pantalla lo
     cuente; el estado es la única verdad. */
  function paso(E, aletea) {
    if (E.muerto) return null;
    const ev = { punto: false, muerte: false, golpe: '' };
    if (aletea) { E.vy = ALETEO; E.aleteos++; } else E.vy = Math.min(VMAX, E.vy + G);
    E.y += E.vy;
    if (E.y < TECHO) { E.y = TECHO; E.vy = 0; }
    E.t++;
    for (const tb of E.tubos) {
      tb.x = X0 + tb.k * SEP - VEL * E.t;
      if (!tb.pasado && tb.x + TW / 2 < PX) { tb.pasado = true; E.puntos++; ev.punto = true; }
    }
    while (E.tubos.length && E.tubos[0].x + TW < -20) E.tubos.shift();
    rellena(E);
    for (const tb of E.tubos) {
      if (tb.x > PX + R || tb.x + TW < PX - R) continue;
      const arriba = tb.c - tb.g / 2, abajo = tb.c + tb.g / 2;
      if (choca(PX, E.y, tb.x, -1000, tb.x + TW, arriba) || choca(PX, E.y, tb.x, abajo, tb.x + TW, SUELO)) {
        E.muerto = true; ev.muerte = true; ev.golpe = 'tubo'; return ev;
      }
    }
    if (E.y + R >= SUELO) { E.y = SUELO - R; E.muerto = true; ev.muerte = true; ev.golpe = 'suelo'; }
    return ev;
  }

  // El tubo que viene (el primero que el pájaro no ha pasado).
  const proximo = E => E.tubos.find(t => !t.pasado) || null;

  /* La prueba de un vuelo: `{v: 1, s, u, f, n, r}`. `f` son los aleteos,
     «<origen><Δtick en base 36>» separados por comas (el primero es el del
     tick 0, que arranca el vuelo); el origen es r (ratón o lápiz), t (dedo),
     k (teclado), m (mando) o x (un evento sintético sin mando). `n` es el
     tick en que el pájaro chocó y `r`, los ms de reloj que duró. */
  function codifica(aleteos) {
    let prev = 0;
    return aleteos.map(([t, o]) => { const s = o + (t - prev).toString(36); prev = t; return s; }).join(',');
  }
  function decodifica(f) {
    if (typeof f !== 'string' || f.length > 400000) return null;
    if (!f) return [];
    const out = []; let t = 0;
    for (const p of f.split(',')) {
      const m = /^([rtkmx])([0-9a-z]{1,6})$/.exec(p);
      if (!m) return null;
      t += parseInt(m[2], 36);
      out.push([t, m[1]]);
    }
    return out;
  }

  /* Rehace un vuelo con este mismo motor: aletea en los ticks dichos y
     tiene que chocar exactamente en el tick `n`, ni antes ni después. */
  function rehace(semilla, u, aleteos, n) {
    if (!aleteos || !aleteos.length || aleteos[0][0] !== 0) return { error: 'El vuelo no arranca con un aleteo.' };
    if (!Number.isSafeInteger(n) || n < 1 || n > 2e6) return { error: 'El tick del choque no es válido.' };
    const E = nueva(semilla, u);
    let i = 0;
    while (!E.muerto) {
      if (E.t >= n) return { error: 'El vuelo rehecho no choca donde dice la prueba.' };
      let a = false;
      while (i < aleteos.length && aleteos[i][0] === E.t) { a = true; i++; }
      if (i < aleteos.length && aleteos[i][0] < E.t) return { error: 'Dos aleteos en el mismo tick o fuera de orden.' };
      paso(E, a);
    }
    if (E.t !== n) return { error: `El vuelo rehecho choca en el tick ${E.t}, no en el ${n}.` };
    if (i !== aleteos.length) return { error: 'La prueba trae aleteos después del choque.' };
    return { puntos: E.puntos, E };
  }

  // Lo menos que se tarda en pasar `p` tubos: el centro del tubo p−1 tiene
  // que cruzar al pájaro, y los tubos avanzan siempre a la misma velocidad.
  const ticksMinimos = p => p < 1 ? 0 : Math.floor((X0 + (p - 1) * SEP + TW / 2 - PX) / VEL);
  const msDe = n => Math.round(n * 1000 / 60);

  // Medallas, como el original: bronce, plata, oro y platino.
  const MEDALLAS = [[100, 'platino'], [50, 'oro'], [25, 'plata'], [10, 'bronce']];
  const medalla = p => (MEDALLAS.find(([n]) => p >= n) || [0, ''])[1];

  // El progreso guardado: el mejor vuelo y lo más hondo que se llegó.
  function mezclaProgreso(a, b) {
    const n = x => (Number.isFinite(+x) && +x > 0 ? Math.floor(+x) : 0);
    a = a && typeof a === 'object' ? a : {}; b = b && typeof b === 'object' ? b : {};
    return { v: 1, mejor: Math.max(n(a.mejor), n(b.mejor)), hondo: Math.max(n(a.hondo), n(b.hondo)), vuelos: Math.max(n(a.vuelos), n(b.vuelos)) };
  }

  const api = { W, H, SUELO, PX, R, TICK, G, ALETEO, VMAX, TECHO, TW, VEL, SEP, X0, Y0, HUECO_INI, HUECO_MIN,
    rng, mezcla, hashTexto, clamp, hueco, nueva, paso, proximo, codifica, decodifica, rehace, ticksMinimos, msDe,
    MEDALLAS, medalla, mezclaProgreso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AleteoMotor = api;
})(globalThis);
