/* El motor puro de Snake Club: la serpiente, las frutas, los poderes, los
   portales y los muros, sin DOM ni dibujo. Lo comparten el juego (game.js,
   que lo carga como script plano: `globalThis.SnakeMotor`) y el verificador
   antitrampas (colabtex/src/juegos/solo/verifica/snake.js, que lo importa
   con esbuild): así la partida que se rehace para comprobar un récord es,
   por construcción, la misma que se jugó.

   Dos cosas lo hacen repetible:
   - Todo el azar que decide la partida (dónde sale cada fruta, qué poder,
     los bloques del laberinto) sale de una semilla (mulberry32). Las
     chispas y demás adornos siguen con Math.random en game.js.
   - El tiempo avanza por tics, no por fotogramas: cada tic suma su propio
     intervalo a `gameTime`, y los vencimientos (poderes, la fruta dorada,
     el contrarreloj) se miran en el tic. Antes se miraban por fotograma con
     el dt real; la diferencia no se nota jugando (un tic dura 55–290 ms) y
     es lo que permite rehacer la partida con solo saber en qué tic entró
     cada giro.

   Lo que el dibujo necesita saber de un tic (comió, cruzó un portal, se le
   gastó el escudo…) se deja en `ev`, que game.js vacía después de cada uno. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SnakeMotor = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SIZES = { chico: { cols: 16, rows: 12 }, mediano: { cols: 22, rows: 17 }, grande: { cols: 28, rows: 22 }, gigante: { cols: 40, rows: 30 } };
  const SPEED_MULT = { chill: 1, normal: 2, fast: 3 };
  const BASE = { chill: .175, normal: .125, fast: .087 };
  const MODOS = ['classic', 'arcade', 'portals', 'reloj', 'espejo', 'laberinto', 'zen'];
  const DIRS = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
  const ESPEJO = { left: 'right', right: 'left', up: 'down', down: 'up' };
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
  const copy = p => ({ x: p.x, y: p.y });

  function azar(semilla) {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function nuevaSemilla() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (_) { return Math.floor(Math.random() * 4294967296) >>> 0; }
  }

  /* Una partida nueva. `mode`, `size` y `speed` son los del juego; la
     semilla, un uint32. */
  function crear({ mode = 'classic', size = 'grande', speed = 'normal', semilla = 0 } = {}) {
    const COLS = SIZES[size].cols, ROWS = SIZES[size].rows, random = azar(semilla);
    const m = {
      mode, size, speed, semilla, COLS, ROWS, state: 'playing', win: false, ticks: 0, ev: [],
      snake: [], direction: DIRS.right, queue: [], score: 0, eaten: 0, fruit: null, bonus: null, pickup: null,
      obstacles: [], portals: [], timeLeft: 40, mirrored: false, level: 1, activePower: null,
      combo: 0, lastEat: -100, gameTime: 0
    };
    const emite = (k, d = {}) => m.ev.push(Object.assign({ k }, d));

    /* Una casilla libre al azar. Recorre el tablero en el mismo orden que
       siempre (filas, luego columnas) y elige con la semilla; lo ocupado
       va en un Set para que rehacer una partida larga en el gigante no
       cueste millones de comparaciones. */
    function freeCell(extra = []) {
      const ocupado = new Set();
      for (const o of [...m.snake, ...m.obstacles, ...m.portals, ...extra, m.fruit, m.bonus, m.pickup]) if (o) ocupado.add(o.x + ',' + o.y);
      const free = [];
      for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (!ocupado.has(x + ',' + y)) free.push({ x, y });
      // The outer ring becomes available when the inner board fills up.
      if (!free.length) for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!ocupado.has(x + ',' + y)) free.push({ x, y });
      return free.length ? free[Math.floor(random() * free.length)] : null;
    }
    /* Los muros del laberinto: el nivel n suma los patrones 1..n (dos barras,
       una columna con paso, esquinas en L, un marco con puertas) y, pasado el
       cuarto, bloques sueltos. Nunca caen sobre la serpiente ni en las tres
       casillas que tiene delante: un muro que aparece bajo la cabeza sería una
       muerte que nadie pudo evitar. */
    function mazeWalls(n) {
      const w = [], add = (x, y) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) w.push({ x, y }); };
      const mx = Math.floor(COLS * .25), my = Math.floor(ROWS / 3), cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
      if (n >= 1) for (let x = mx; x < COLS - mx; x++) { add(x, my); add(x, ROWS - 1 - my); }
      if (n >= 2) for (let y = 2; y < ROWS - 2; y++) if (Math.abs(y - cy) > 1 && y !== my && y !== ROWS - 1 - my) add(cx, y);
      if (n >= 3) { const l = Math.max(2, Math.floor(COLS / 8)); for (let i = 0; i < l; i++) for (const [sx, sy] of [[2, 2], [COLS - 3, 2], [2, ROWS - 3], [COLS - 3, ROWS - 3]]) { add(sx + (sx < cx ? i : -i), sy); add(sx, sy + (sy < cy ? i : -i)); } }
      if (n >= 4) { for (let x = 0; x < COLS; x++) if (Math.abs(x - cx) > 1) { add(x, 0); add(x, ROWS - 1); } for (let y = 0; y < ROWS; y++) if (Math.abs(y - cy) > 1) { add(0, y); add(COLS - 1, y); } }
      const seen = new Set(), out = [], head = m.snake[0], dir = m.direction;
      const ahead = head ? [1, 2, 3].map(k => ({ x: (head.x + dir.x * k + COLS) % COLS, y: (head.y + dir.y * k + ROWS) % ROWS })) : [];
      for (const p of w) { const k = p.x + ',' + p.y; if (seen.has(k) || m.snake.some(s => same(s, p)) || ahead.some(a => same(a, p))) continue; seen.add(k); out.push(p); }
      for (let i = 0; i < (n - 4) * 3 && n > 4; i++) { const p = freeCell([...out, ...ahead]); if (p) out.push(p); }
      return out;
    }
    function movePortals() {
      const a = freeCell(); if (!a) return;
      let b = null;
      for (let i = 0; i < 30; i++) { const p = freeCell([a]); if (p && Math.abs(p.x - a.x) + Math.abs(p.y - a.y) > (COLS + ROWS) / 3) { b = p; break; } b = b || p; }
      if (b) m.portals = [a, b];
    }
    /* Un giro pedido por el jugador. Devuelve si entró en la cola (a lo más
       dos por tic, nunca media vuelta). En espejo se invierte aquí, así que
       la prueba guarda la tecla tal como se pulsó. */
    function enqueue(name) {
      if (m.state !== 'playing' || m.queue.length >= 2) return false;
      if (m.mirrored) name = ESPEJO[name];
      const next = DIRS[name], last = m.queue.length ? m.queue[m.queue.length - 1] : m.direction;
      if (!next || same(next, last) || (next.x === -last.x && next.y === -last.y)) return false;
      m.queue.push(next); return true;
    }
    function interval() {
      const acceleration = mode === 'zen' ? 0 : Math.min(m.eaten * .0015, .038);
      return Math.max(.055, BASE[speed] - acceleration) * (m.activePower && m.activePower.type === 'slow' ? 1.65 : 1);
    }
    function addPoints(amount) {
      const total = amount * (m.activePower && m.activePower.type === 'double' ? 2 : 1) * SPEED_MULT[speed];
      m.score += total; emite('puntos', { n: total });
    }
    function finish(win = false) {
      if (m.state !== 'playing') return;
      m.state = 'over'; m.win = win; emite('fin', { win });
    }
    function consumeShield() { m.activePower = null; emite('escudo', { p: copy(m.snake[0]) }); }
    function spawnArcadeExtras() {
      if (m.eaten % 3 === 0 && !m.pickup) {
        const p = freeCell();
        if (p) m.pickup = { ...p, type: ['shield', 'slow', 'double'][Math.floor(random() * 3)], expires: m.gameTime + 14 };
      }
      if (m.eaten % 4 === 0 && !m.bonus) { const p = freeCell(); if (p) m.bonus = { ...p, expires: m.gameTime + 9 }; }
      if (m.eaten % 6 === 0 && m.obstacles.length < 24) {
        const candidates = [];
        for (let n = 0; n < 40; n++) {
          const p = freeCell(candidates);
          if (p && Math.abs(p.x - m.snake[0].x) + Math.abs(p.y - m.snake[0].y) > 6) { candidates.push(p); break; }
        }
        if (candidates.length) { m.obstacles.push(...candidates); emite('obstaculo', { p: candidates[0] }); }
      }
    }
    /* Un paso de la serpiente (sin tocar el reloj: eso es `tick`). */
    function step() {
      if (m.state !== 'playing') return;
      if (m.queue.length) m.direction = m.queue.shift();
      const direction = m.direction;
      let head = { x: m.snake[0].x + direction.x, y: m.snake[0].y + direction.y };
      const outside = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
      const shield = m.activePower && m.activePower.type === 'shield';
      if (outside) {
        if (mode === 'zen' || mode === 'portals' || mode === 'laberinto' || shield) {
          head.x = (head.x + COLS) % COLS; head.y = (head.y + ROWS) % ROWS;
          if (shield && mode === 'arcade') consumeShield();
        } else { finish(); return; }
      }
      if (mode === 'portals') {
        const portalIndex = m.portals.findIndex(p => same(p, head));
        if (portalIndex !== -1) { const de = head; head = copy(m.portals[1 - portalIndex]); emite('portal', { de, a: copy(head) }); }
      }
      const eatsFruit = same(head, m.fruit), eatsBonus = same(head, m.bonus), grows = eatsFruit || eatsBonus;
      const body = grows ? m.snake : m.snake.slice(0, -1);
      const bodyHit = body.some(p => same(p, head)), obstacleHit = m.obstacles.some(p => same(p, head));
      if (mode !== 'zen' && (bodyHit || obstacleHit)) {
        if (m.activePower && m.activePower.type === 'shield') {
          consumeShield();
          if (bodyHit) m.snake = m.snake.slice(0, Math.max(1, m.snake.findIndex(p => same(p, head))));
          if (obstacleHit) m.obstacles = m.obstacles.filter(p => !same(p, head));
        } else { finish(); return; }
      }
      m.snake.unshift(head);
      if (!grows) m.snake.pop();
      // Keep Zen bounded for indefinitely long sessions, without ending the run.
      if (mode === 'zen' && m.snake.length > 130) m.snake.pop();
      if (eatsFruit) {
        m.eaten++; m.combo = m.gameTime - m.lastEat < 4 ? Math.min(m.combo + 1, 5) : 1; m.lastEat = m.gameTime;
        addPoints(mode === 'arcade' ? 10 + (m.combo - 1) * 2 : mode === 'espejo' && m.mirrored ? 15 : 10);
        if (mode === 'reloj') m.timeLeft = Math.min(60, m.timeLeft + 2.5);
        emite('come', { p: copy(head), combo: m.combo });
        m.fruit = null; m.fruit = freeCell();
        if (!m.fruit) { finish(true); return; }
        if (mode === 'reloj' && m.eaten % 5 === 0 && !m.bonus) { const p = freeCell(); if (p) m.bonus = { ...p, expires: m.gameTime + 8 }; }
        if (mode === 'portals' && m.eaten % 4 === 0) { emite('portales', { antes: m.portals.map(copy) }); movePortals(); }
        if (mode === 'espejo' && m.eaten % 5 === 0) { m.mirrored = !m.mirrored; m.queue = []; emite('espejo', { on: m.mirrored }); }
        if (mode === 'laberinto' && m.eaten % 6 === 0) {
          m.level++; m.obstacles = mazeWalls(m.level); addPoints(25 * m.level); emite('nivel', { n: m.level });
          if (m.obstacles.some(o => same(o, m.fruit))) m.fruit = freeCell();
        }
        if (mode === 'arcade') spawnArcadeExtras();
      }
      if (eatsBonus && mode === 'reloj') { addPoints(30); m.timeLeft = Math.min(60, m.timeLeft + 6); m.bonus = null; emite('dorada', { p: copy(head), reloj: true }); }
      else if (eatsBonus) { addPoints(50); m.bonus = null; emite('dorada', { p: copy(head) }); }
      if (same(head, m.pickup)) {
        m.activePower = { type: m.pickup.type, expires: m.gameTime + 10 }; m.pickup = null;
        emite('poder', { p: copy(head), type: m.activePower.type });
      }
    }
    /* Un tic: el reloj avanza el intervalo de este tic, vence lo que toque
       y la serpiente da su paso. El contrarreloj se acaba en el tic en que
       llega a cero. */
    function tick() {
      if (m.state !== 'playing') return;
      const dt = interval();
      m.ticks++; m.gameTime += dt;
      if (m.activePower && m.gameTime >= m.activePower.expires) m.activePower = null;
      if (m.bonus && m.gameTime >= m.bonus.expires) m.bonus = null;
      if (m.pickup && m.gameTime >= m.pickup.expires) m.pickup = null;
      if (mode === 'reloj') { m.timeLeft -= dt; if (m.timeLeft <= 0) { m.timeLeft = 0; finish(); return; } }
      step();
    }

    const my = Math.floor(ROWS / 2);
    m.snake = Array.from({ length: 5 }, (_, i) => ({ x: 6 - i, y: my }));
    const px = Math.floor(COLS * .22), py = Math.floor(ROWS * .23);
    m.portals = mode === 'portals' ? [{ x: px, y: py }, { x: COLS - 1 - px, y: ROWS - 1 - py }] : [];
    m.fruit = { x: COLS - 6, y: my };
    if (mode === 'laberinto') { m.obstacles = mazeWalls(1); if (m.obstacles.some(o => same(o, m.fruit))) m.fruit = freeCell(); }
    return Object.assign(m, { enqueue, interval, tick, step, freeCell, finish });
  }

  /* Los giros de la prueba, en texto: por cada giro, los tics desde el
     anterior en base 36 (minúsculas), la tecla en mayúscula (U, D, L, R;
     en minúscula chocarían con los dígitos de la base 36) y, detrás, cómo
     llegó: nada si fue el teclado, T si fue un toque (botón o deslizar),
     M si fue un mando (tecla sintética de mando.js con un mando conectado)
     y X si fue un evento sintético sin mando (isTrusted falso: un script).
     «0R3UT» es derecha con el teclado en el tic 0 y arriba con el dedo en
     el 3. */
  const LETRA = { up: 'U', down: 'D', left: 'L', right: 'R' }, NOMBRE = { U: 'up', D: 'down', L: 'left', R: 'right' };
  function codificaGiro(desde, tic, nombre, marcas = '') { return (tic - desde).toString(36) + LETRA[nombre] + marcas; }
  function leeGiros(texto) {
    if (typeof texto !== 'string' || !/^([0-9a-z]{1,6}[UDLR][TMX]{0,2})*$/.test(texto)) return null;
    const out = []; let tic = 0;
    for (const [, n, l, marcas] of texto.matchAll(/([0-9a-z]+)([UDLR])([TMX]*)/g)) { tic += parseInt(n, 36); out.push({ tic, nombre: NOMBRE[l], marcas }); }
    return out;
  }
  return { SIZES, SPEED_MULT, MODOS, DIRS, crear, azar, nuevaSemilla, codificaGiro, leeGiros, same, copy };
});
