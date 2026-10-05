/* El motor de BBTAN: todo lo que decide la partida —filas, bolas, choques,
   bonos, puntaje, cuándo baja el tablero y cuándo se pierde— y nada que se
   dibuje. game.js lo usa para jugar y el verificador antitrampas
   (colabtex/src/juegos/solo/verifica/bbtan.js) para rehacer una partida
   desde su prueba: la semilla y el ángulo de cada tiro. Es el mismo archivo
   en los dos lados, así que no pueden divergir.

   Tres decisiones lo hacen repetible, también entre navegadores y Node:

   - **El tiempo de la física es fijo** (`TICK`, 1/60 s de juego). La
     velocidad ×1…×4 y los cuadros por segundo solo cambian cuántos ticks
     corren por cuadro, no lo que pasa en cada uno: antes el paso era el `dt`
     del cuadro y la misma jugada daba otro rebote en otra pantalla.
   - **Solo + − × ÷ y √**, que IEEE redondea igual en todas partes. Nada de
     `Math.sin/cos/hypot/atan2`, que cada motor de JS aproxima a su modo en
     el último bit: el seno y el coseno son una serie propia (`sincos`) y las
     distancias, `Math.sqrt(x*x + y*y)`.
   - **El ángulo es un entero** (diezmilésimas de radián, `ANG`), y el azar
     sale de mulberry32 con semilla (`rng`): la fila de cada ronda y la
     dispersión de cada tiro tienen su propio chorro, derivado de la semilla
     y la ronda, así que la partida guardada no necesita llevar el estado
     del generador. */
(function (root) {
  'use strict';
  const W = 420, FLOOR = 540, SIZE = 60, COLS = 7, TOP = 60, ROW = 60, FILAS = 8, R = 6;
  const VEL = 620, TICK = 1 / 60, CADENCIA = .065;
  // 35 s de juego por tiro como mucho, como antes: después se recogen solas.
  const TOPE = 2100;
  // Ángulo en diezmilésimas de radián, entre −π+0,15 y −0,15 (hacia arriba).
  const ANG = 1e4, ANG_MIN = -29915, ANG_MAX = -1500, ANG_INICIAL = -18308, ANG_PASO = 350;
  const grid = { width: W, columns: COLS, size: SIZE, top: TOP };
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

  /* Seno y coseno con solo sumas, productos y divisiones: reducción a
     [−π/4, π/4] y la serie de Taylor hasta el término 15 (error < 1e-16 en
     ese tramo). Devuelve [cos, sin]. */
  const MEDIO_PI = 1.5707963267948966;
  function sincos(x) {
    const k = Math.round(x / MEDIO_PI), r = x - k * MEDIO_PI, r2 = r * r;
    const s = r * (1 - r2 / 6 * (1 - r2 / 20 * (1 - r2 / 42 * (1 - r2 / 72 * (1 - r2 / 110 * (1 - r2 / 156 * (1 - r2 / 210)))))));
    const c = 1 - r2 / 2 * (1 - r2 / 12 * (1 - r2 / 30 * (1 - r2 / 56 * (1 - r2 / 90 * (1 - r2 / 132 * (1 - r2 / 182))))));
    const q = ((k % 4) + 4) % 4;
    return q === 0 ? [c, s] : q === 1 ? [-s, c] : q === 2 ? [-c, -s] : [s, -c];
  }
  const direccion = ang => sincos(ang / ANG);

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

  /* Una fila nueva arriba: entre 3 y 5 bloques con la vida de la ronda (uno
     de cada cinco, reforzado, ×1,5), una bola extra y, en rondas pares, un
     bono. */
  function creaFila(E) {
    const random = rng(mezcla(E.base, 2 * E.round + 1)), round = E.round, y = TOP;
    const columns = Array.from({ length: COLS }, (_, i) => i);
    for (let i = columns.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [columns[i], columns[j]] = [columns[j], columns[i]];
    }
    const total = 3 + Math.floor(random() * 3);
    for (const col of columns.slice(0, total)) {
      const reinforced = round > 1 && random() < .2;
      const hp = reinforced ? Math.ceil(round * 1.5) : round;
      E.blocks.push({ x: col * SIZE, y, w: SIZE, h: SIZE, hp, max: hp, reinforced, flash: 0, id: E.idSeq++ });
    }
    const pickup = (col, kind) => ({ x: col * SIZE + SIZE / 2, y: y + SIZE / 2, kind, alive: true });
    E.pickups.push(pickup(columns[total], 'ball'));
    if (round % 2 === 0) E.pickups.push(pickup(columns[total + 1], ['laser-h', 'laser-v', 'scatter'][(round / 2 - 1) % 3]));
    E._celdas = null;
  }

  /* La partida nueva. `u` es la cuenta: entra en la semilla, así que la
     prueba de una persona no rehace la misma partida en otra cuenta. */
  function nueva(semilla, u) {
    semilla = semilla >>> 0;
    const E = { semilla, u: String(u || ''), base: mezcla(semilla, hashTexto(u || '')), round: 1, count: 1, score: 0,
      launchX: W / 2, blocks: [], pickups: [], balls: [], idSeq: 0, state: 'aim', tiros: [], gestos: [],
      queue: 0, returned: 0, gained: 0, combo: 0, mult: 1, nextX: null, ticks: 0, launchTimer: 0, vx: 0, vy: 0, ang: ANG_INICIAL };
    creaFila(E);
    return E;
  }

  /* Los bloques no se mueven durante un tiro y siempre están en la
     cuadrícula (x = col·60, y = 60 + fila·60), así que cada bola mira solo
     las celdas que tiene cerca en vez de todo el tablero. Ese orden (por
     fila y columna) es parte de la física. */
  function indice(E) {
    if (E._celdas) return E._celdas;
    const c = new Array(COLS * FILAS).fill(null);
    for (const b of E.blocks) {
      const col = (b.x / SIZE) | 0, fila = ((b.y - TOP) / ROW) | 0;
      if (b.hp > 0 && col >= 0 && col < COLS && fila >= 0 && fila < FILAS) c[fila * COLS + col] = b;
    }
    return (E._celdas = c);
  }

  function hitRect(ball, rect) {
    const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.h);
    let nx = ball.x - closestX, ny = ball.y - closestY;
    const distance = Math.sqrt(nx * nx + ny * ny);
    if (distance >= R) return false;
    let depth;
    if (distance > 0.00001) { nx /= distance; ny /= distance; depth = R - distance; }
    else {
      // El centro quedó dentro: sale por la cara más cercana.
      const caras = [[ball.x - rect.x, -1, 0], [rect.x + rect.w - ball.x, 1, 0], [ball.y - rect.y, 0, -1], [rect.y + rect.h - ball.y, 0, 1]];
      let m = caras[0];
      for (const f of caras) if (f[0] < m[0]) m = f;
      nx = m[1]; ny = m[2]; depth = R + m[0];
    }
    ball.x += nx * (depth + 0.01); ball.y += ny * (depth + 0.01);
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot >= 0) return false;
    ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
    return true;
  }
  function contain(ball) {
    if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); }
  }
  function choques(celdas, ball, onHit) {
    const c0 = Math.max(0, Math.floor((ball.x - 2 * R) / SIZE)), c1 = Math.min(COLS - 1, Math.floor((ball.x + 2 * R) / SIZE));
    const f0 = Math.max(0, Math.floor((ball.y - 2 * R - TOP) / ROW)), f1 = Math.min(FILAS - 1, Math.floor((ball.y + 2 * R - TOP) / ROW));
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) {
      const b = celdas[f * COLS + c];
      if (b && b.hp > 0 && hitRect(ball, b)) onHit(b);
    }
  }
  /* Una bola avanza `dt` segundos de juego en pasos de menos de 0,7 radios.
     Devuelve true si tocó el suelo. La mira la usa con una bola fantasma y
     callbacks que no tocan nada. */
  function stepBall(E, ball, dt, onHit, onMove) {
    const v = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const steps = Math.max(1, Math.ceil(v * dt / (R * .7)));
    const delta = dt / steps, celdas = indice(E);
    for (let i = 0; i < steps; i++) {
      ball.x += ball.vx * delta; ball.y += ball.vy * delta;
      contain(ball);
      choques(celdas, ball, onHit);
      // Una corrección de esquina no puede sacar la bola por una pared.
      contain(ball);
      if (onMove) onMove(ball);
      if (ball.y >= FLOOR && ball.vy > 0) { ball.y = FLOOR; return true; }
      // Que un rebote de esquina no deje una bola yendo y viniendo en horizontal.
      if (Math.abs(ball.vy) < 55) {
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        ball.vy = (ball.vy < 0 ? -1 : 1) * 55;
        ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - 55 * 55));
      }
    }
    return false;
  }

  function damage(E, block, amount) {
    if (block.hp <= 0) return;
    const antes = E.mult, hits = Math.min(block.hp, amount);
    block.hp -= hits; E.score += hits * 10 * E.mult;
    let muere = false, sube = false;
    if (block.hp <= 0) {
      E.score += 50 * E.mult; E.combo++; muere = true;
      const next = Math.min(5, 1 + Math.floor(E.combo / 5));
      if (next > E.mult) { E.mult = next; sube = true; }
    }
    if (E.ev && E.ev.dano) E.ev.dano(block, muere, antes, sube);
  }
  function enterPickup(ball, pickup) {
    // El contacto se lleva por bola y se rearma solo al salir. Lejos en x o
    // en y ya está fuera, sin raíz: es lo que más se pregunta por tick.
    const dx = ball.x - pickup.x, dy = ball.y - pickup.y, reach = R + 11, lejos = reach + 2;
    if (dx > lejos || dx < -lejos || dy > lejos || dy < -lejos) { if (ball.contactos) ball.contactos.delete(pickup); return false; }
    ball.contactos || (ball.contactos = new Set());
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > lejos) ball.contactos.delete(pickup);
    if (!pickup.alive || distance > reach || ball.contactos.has(pickup)) return false;
    ball.contactos.add(pickup);
    if (pickup.kind === 'ball') pickup.alive = false;
    return true;
  }
  function collect(E, ball) {
    const ps = E.pickups;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!enterPickup(ball, p)) continue;
      if (p.kind === 'ball') E.gained++;
      else if (p.kind === 'scatter') {
        p.used = true;
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const [c, s] = sincos(-3.141592653589793 + .3 + E.rnd() * (3.141592653589793 - .6));
        ball.vx = c * speed; ball.vy = s * speed;
      } else if (p.kind === 'laser-h' || p.kind === 'laser-v') {
        p.used = true;
        const horizontal = p.kind === 'laser-h';
        E.blocks.filter(b => b.hp > 0 && (horizontal ? p.y >= b.y && p.y < b.y + b.h : p.x >= b.x && p.x < b.x + b.w)).forEach(b => damage(E, b, 4));
      }
      if (E.ev && E.ev.item) E.ev.item(ball, p);
    }
  }

  /* Lanzar. `ms` es el instante (tiempo jugado, sin pausas) y va a la
     prueba; `ev` son los avisos para dibujar y sonar (dano, item, lanza).
     `gesto` es cómo se apuntó y se lanzó (lo arma game.js y lo mira el
     verificador para separar personas de scripts); el motor solo lo lleva. */
  function dispara(E, ang, ms, ev, gesto) {
    if (E.state !== 'aim' || !Number.isInteger(ang) || ang < ANG_MIN || ang > ANG_MAX) return false;
    const [c, s] = direccion(ang);
    E.ang = ang; E.vx = c * VEL; E.vy = s * VEL;
    E.state = 'shoot'; E.queue = E.count; E.launchTimer = 0; E.returned = 0; E.gained = 0; E.combo = 0; E.mult = 1;
    E.nextX = null; E.ticks = 0; E.balls = [];
    E.rnd = rng(mezcla(E.base, 2 * E.round + 2)); E.ev = ev || null;
    E._choca = b => damage(E, b, 1); E._mueve = b => collect(E, b);
    E.tiros.push([ang, Math.max(0, Math.round(+ms || 0))]);
    E.gestos.push(/^[a-z][0-9a-z.]{0,30}$/.test(gesto || '') ? gesto : '');
    return true;
  }
  /* Un tick del tiro: salen las bolas que tocan, todas avanzan, y si ya no
     queda ninguna el tiro termina. */
  function tick(E) {
    if (E.state !== 'shoot') return;
    E.launchTimer -= TICK;
    while (E.queue > 0 && E.launchTimer <= 0) {
      E.balls.push({ x: E.launchX, y: FLOOR - 1, vx: E.vx, vy: E.vy });
      E.queue--; E.launchTimer += CADENCIA;
      if (E.ev && E.ev.lanza) E.ev.lanza();
    }
    for (let i = E.balls.length - 1; i >= 0; i--) {
      const b = E.balls[i];
      if (E.ev && E.ev.antes) E.ev.antes(b);
      if (stepBall(E, b, TICK, E._choca, E._mueve)) {
        if (E.nextX === null) E.nextX = b.x;
        E.returned++; E.balls.splice(i, 1);
      }
    }
    E.ticks++;
    if (E.queue === 0 && E.balls.length === 0) termina(E);
    else if (E.ticks >= TOPE) recoge(E, false);
  }
  /* Recoger las bolas a mano (`manual`, queda en la prueba con su tick) o
     solas al pasar el tope. */
  function recoge(E, manual) {
    if (E.state !== 'shoot') return false;
    if (manual) E.tiros[E.tiros.length - 1][2] = E.ticks;
    if (E.nextX === null) E.nextX = E.balls.length ? E.balls[0].x : E.launchX;
    E.balls = []; E.queue = 0; E.returned = E.count;
    termina(E);
    return true;
  }
  function termina(E) {
    E.launchX = E.nextX === null ? E.launchX : clamp(E.nextX, 26, W - 26);
    E.count += E.gained; E.gained = 0;
    E.blocks = E.blocks.filter(b => b.hp > 0);
    // Los bonos usados caducan al cambiar de ronda, y lo que llegó abajo se va.
    E.pickups = E.pickups.filter(p => p.alive && !(p.kind !== 'ball' && p.used)).filter(p => p.y + ROW < FLOOR - 15);
    E.blocks.forEach(b => b.startY = b.y); E.pickups.forEach(p => p.startY = p.y);
    E.balls = []; E.state = 'descend'; E.rnd = null; E._celdas = null;
  }
  /* El tablero baja una fila (la animación la hace game.js entre medio,
     sobre `y`; esto deja cada cosa donde tiene que terminar). Devuelve el
     estado: 'over' si un bloque llegó al suelo, 'aim' si sigue. */
  function baja(E) {
    if (E.state !== 'descend') return E.state;
    for (const b of E.blocks) b.y = b.startY + ROW;
    for (const p of E.pickups) p.y = p.startY + ROW;
    E._celdas = null;
    if (E.blocks.some(b => b.hp > 0 && b.y + b.h >= FLOOR - 12)) { E.state = 'over'; return 'over'; }
    E.round++; creaFila(E); E.state = 'aim';
    return 'aim';
  }

  /* La prueba: cada tiro es «ángulo.Δms[.tick de recoger]» en base 36 (el
     ángulo sin signo), separados por comas. Unos diez caracteres por ronda.
     Un tiro a medias (o bajando) no entra: todavía no decidió nada. `h` va
     al lado, un gesto por tiro (cómo se apuntó: lo arma game.js y lo lee el
     verificador). */
  function codifica(tiros) {
    let prev = 0;
    return tiros.map(t => {
      const s = (-t[0]).toString(36) + '.' + (t[1] - prev).toString(36) + (t.length > 2 ? '.' + t[2].toString(36) : '');
      prev = t[1]; return s;
    }).join(',');
  }
  function decodifica(texto) {
    if (typeof texto !== 'string') return null;
    if (!texto) return [];
    let prev = 0;
    const out = [];
    for (const parte of texto.split(',')) {
      const c = parte.split('.');
      if (c.length < 2 || c.length > 3 || !c.every(x => /^-?[0-9a-z]{1,9}$/.test(x))) return null;
      const n = c.map(x => parseInt(x, 36));
      prev += n[1];
      out.push(c.length === 3 ? [-n[0], prev, n[2]] : [-n[0], prev]);
    }
    return out;
  }
  function tirosHechos(E) { return E.state === 'shoot' || E.state === 'descend' ? E.tiros.slice(0, -1) : E.tiros; }
  function prueba(E) { const t = tirosHechos(E); return { v: 1, s: E.semilla, u: E.u, t: codifica(t), h: E.gestos.slice(0, t.length).join(',') }; }

  /* Un tiro de la prueba, entero y sin dibujar: lanzar, correr los ticks
     (hasta el de recoger, si lo hubo) y bajar. Devuelve los ticks que duró
     o el motivo por el que no puede ser. */
  function juegaTiro(E, t, gesto) {
    if (E.state !== 'aim') return 'Hay tiros después del final de la partida.';
    if (!dispara(E, t[0], t[1], null, gesto)) return 'Un tiro tiene un ángulo imposible.';
    if (t.length > 2) {
      if (!Number.isInteger(t[2]) || t[2] < 0 || t[2] >= TOPE) return 'Un tiro se recogió en un instante imposible.';
      while (E.state === 'shoot' && E.ticks < t[2]) tick(E);
      if (E.state !== 'shoot') return 'Un tiro se recogió cuando ya no quedaban bolas.';
      recoge(E, true);
    } else while (E.state === 'shoot') tick(E);
    const ticks = E.ticks;
    baja(E);
    return ticks;
  }

  /* La partida a medias, para guardarla al empezar cada ronda (y al lanzar:
     ver game.js). Solo se exporta en 'aim'. */
  function exporta(E) {
    return { s: E.semilla, u: E.u, round: E.round, count: E.count, score: E.score, launchX: E.launchX, idSeq: E.idSeq,
      blocks: E.blocks.map(b => [b.x, b.y, b.hp, b.max, b.reinforced ? 1 : 0, b.id]),
      pickups: E.pickups.map(p => [p.x, p.y, p.kind]), t: codifica(E.tiros), h: E.gestos.join(',') };
  }
  const KINDS = ['ball', 'laser-h', 'laser-v', 'scatter'];
  const num = v => typeof v === 'number' && Number.isFinite(v);
  /* `laxo`: una partida que ya no se va a reportar (venía de una versión
     sin prueba); se carga aunque sus tiros no lleguen a su ronda. */
  function importa(d, laxo) {
    if (!d || !Number.isInteger(d.s) || d.s < 0 || d.s > 4294967295 || typeof d.u !== 'string' || !Number.isInteger(d.round) || d.round < 1
      || !Number.isInteger(d.count) || d.count < 1 || !num(d.score) || !num(d.launchX) || !Number.isInteger(d.idSeq)
      || !Array.isArray(d.blocks) || !Array.isArray(d.pickups)) return null;
    const tiros = laxo ? [] : decodifica(d.t);
    if (!tiros || (!laxo && tiros.length !== d.round - 1)) return null;
    const gestos = laxo || !tiros.length ? [] : typeof d.h === 'string' ? d.h.split(',') : [];
    if (gestos.length !== tiros.length) return null;
    const E = nueva(d.s, d.u);
    Object.assign(E, { round: d.round, count: d.count, score: d.score, launchX: clamp(d.launchX, 26, W - 26), idSeq: d.idSeq, tiros, gestos, blocks: [], pickups: [] });
    for (const b of d.blocks) {
      if (!Array.isArray(b) || !b.slice(0, 4).every(Number.isInteger) || b[0] % SIZE || (b[1] - TOP) % ROW) return null;
      E.blocks.push({ x: b[0], y: b[1], w: SIZE, h: SIZE, hp: b[2], max: b[3], reinforced: !!b[4], flash: 0, id: b[5] | 0 });
    }
    for (const p of d.pickups) {
      if (!Array.isArray(p) || !num(p[0]) || !num(p[1]) || !KINDS.includes(p[2])) return null;
      E.pickups.push({ x: p[0], y: p[1], kind: p[2], alive: true });
    }
    E._celdas = null;
    return E;
  }

  // Lo que antes vivía en rules.js y no decide nada de la partida.
  function shotPace(seconds, manualFast = false) {
    const automatic = Math.min(4, 1 + Math.max(0, seconds - 5) * .32);
    return Math.max(manualFast ? 3 : 1, automatic);
  }
  // El tope de shotPace: ni el botón de velocidad ni la aceleración sola
  // pasan de ×4. El verificador lo usa para saber cuánto dura un tiro.
  const PACE_MAX = 4;
  function aimVisibility(round) { return Math.max(.08, 1 - .92 * Math.max(0, round - 100) / 150); }
  function hasClearedBoard(blocks, alreadyCelebrated = false) {
    return !alreadyCelebrated && blocks.length > 0 && blocks.every(block => block.hp <= 0);
  }

  const api = { W, FLOOR, SIZE, COLS, TOP, ROW, R, VEL, TICK, CADENCIA, TOPE, ANG, ANG_MIN, ANG_MAX, ANG_INICIAL, ANG_PASO, PACE_MAX,
    grid, ballRadius: R, clamp, sincos, direccion, rng, mezcla, hashTexto, nueva, indice, stepBall, dispara, tick, recoge, baja,
    codifica, decodifica, tirosHechos, prueba, juegaTiro, exporta, importa, shotPace, aimVisibility, hasClearedBoard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BBTANMotor = api;
})(globalThis);
