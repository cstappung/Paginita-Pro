/* HaxBall — la física, pura. UMD en `HaxballMotor`: la usa el marco y la
   prueban los tests en Node.

   Todo va en píxeles de cancha y en «ticks» de 1/60 s: las velocidades son
   píxeles por tick y el amortiguamiento se aplica una vez por tick. El campo
   es un rectángulo centrado en el origen (±W, ±H) con un arco en cada lado
   (|y| < G) que se mete D píxeles hacia afuera; los postes son discos fijos
   en (±W, ±G). Los jugadores no tienen paredes en la línea: pueden salir de
   la cancha hasta el borde (±LIM_X, ±LIM_Y), como en el original; la pelota
   sí rebota en las líneas.

   El saque: el equipo que lo tiene puede entrar al círculo central; el otro
   se queda afuera (CIRCULO + RJ) y cada uno en su mitad hasta que alguien
   toque la pelota. */
(function (raiz, fabrica) {
  const M = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else raiz.HaxballMotor = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const C = {
    W: 370, H: 170, G: 64, D: 30, RP: 8, LIM_X: 420, LIM_Y: 210,
    RJ: 15, RB: 10, ACC: 0.1, ACC_PATEA: 0.07, AMORT_J: 0.96, AMORT_B: 0.99,
    IM_J: 0.5, IM_B: 1, PATADA: 5, ALCANCE: 4, REB: 0.5, REB_PARED: 0.5, CIRCULO: 70,
  };
  const EQUIPOS = ['rojo', 'azul'];
  const lado = e => e === 'rojo' ? -1 : 1;          // la mitad donde defiende cada uno
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function disco(x, y, r, im) { return { x, y, vx: 0, vy: 0, r, im }; }

  // Mundo: pelota, jugadores (uid → {disco, equipo}), postes, saque.
  function crea() {
    return { b: disco(0, 0, C.RB, C.IM_B), J: new Map(), saque: 'rojo', ult: '', gol: null, toques: 0 };
  }
  function postes() {
    const p = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) p.push({ x: sx * C.W, y: sy * C.G, r: C.RP, im: 0, vx: 0, vy: 0 });
    return p;
  }
  const POSTES = postes();

  // Coloca cada equipo en su mitad, en orden de asiento. Quien saca va más
  // cerca del centro.
  function alinea(m, saque) {
    m.saque = saque || null;
    m.gol = null;
    m.ult = '';
    m.b.x = m.b.y = m.b.vx = m.b.vy = 0;
    for (const e of EQUIPOS) {
      const lista = [...m.J.entries()].filter(([, j]) => j.e === e);
      lista.forEach(([, j], i) => {
        const p = puesto(e, i, lista.length, saque === e);
        j.d.x = p.x; j.d.y = p.y; j.d.vx = j.d.vy = 0;
      });
    }
  }
  function puesto(e, i, n, saca) {
    const s = lado(e);
    if (i === 0) return { x: s * (saca ? C.RB + C.RJ + 4 : C.CIRCULO + C.RJ + 10), y: 0 };
    const k = i - 1, filas = Math.max(1, n - 1);
    const y = filas === 1 ? 0 : -C.H * 0.6 + (1.2 * C.H) * k / (filas - 1);
    return { x: s * (C.W * (k % 2 ? 0.75 : 0.45)), y: n === 2 ? 0 : y };
  }

  function choque(a, b, rebote) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), suma = a.r + b.r;
    if (d >= suma || d === 0) return false;
    const sm = a.im + b.im;
    if (sm === 0) return false;
    const nx = dx / d, ny = dy / d, solape = suma - d;
    a.x -= nx * solape * a.im / sm; a.y -= ny * solape * a.im / sm;
    b.x += nx * solape * b.im / sm; b.y += ny * solape * b.im / sm;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) {
      const j = -(1 + rebote) * rv / sm;
      a.vx -= nx * j * a.im; a.vy -= ny * j * a.im;
      b.vx += nx * j * b.im; b.vy += ny * j * b.im;
    }
    return true;
  }

  // La pelota contra las líneas y la red. Devuelve true si rebotó.
  function paredBola(b) {
    let rebota = false;
    const R = C.RB, ax = Math.abs(b.x);
    if (ax <= C.W) {
      if (b.y > C.H - R) { b.y = C.H - R; if (b.vy > 0) { b.vy = -b.vy * C.REB_PARED; rebota = true; } }
      if (b.y < -C.H + R) { b.y = -C.H + R; if (b.vy < 0) { b.vy = -b.vy * C.REB_PARED; rebota = true; } }
    }
    if (Math.abs(b.y) >= C.G) {
      // Fuera del arco: la línea de fondo es pared.
      if (b.x > C.W - R && b.x < C.W + R) { b.x = C.W - R; if (b.vx > 0) { b.vx = -b.vx * C.REB_PARED; rebota = true; } }
      if (b.x < -C.W + R && b.x > -C.W - R) { b.x = -C.W + R; if (b.vx < 0) { b.vx = -b.vx * C.REB_PARED; rebota = true; } }
    }
    if (Math.abs(b.x) > C.W) {
      // Dentro de la red.
      const s = Math.sign(b.x);
      if (b.y > C.G - R) { b.y = C.G - R; if (b.vy > 0) { b.vy = -b.vy * C.REB_PARED; rebota = true; } }
      if (b.y < -C.G + R) { b.y = -C.G + R; if (b.vy < 0) { b.vy = -b.vy * C.REB_PARED; rebota = true; } }
      if (Math.abs(b.x) > C.W + C.D - R) { b.x = s * (C.W + C.D - R); if (b.vx * s > 0) { b.vx = -b.vx * C.REB_PARED; rebota = true; } }
    }
    return rebota;
  }

  function limitaJugador(j, m) {
    j.x = clamp(j.x, -C.LIM_X, C.LIM_X);
    j.y = clamp(j.y, -C.LIM_Y, C.LIM_Y);
  }

  // Mientras hay saque, nadie cruza a la otra mitad y el que no saca no
  // pisa el círculo.
  function reglaSaque(m, j, e) {
    if (!m.saque) return;
    const s = lado(e);
    if (s < 0 && j.x > -j.r) { j.x = -j.r; if (j.vx > 0) j.vx = 0; }
    if (s > 0 && j.x < j.r) { j.x = j.r; if (j.vx < 0) j.vx = 0; }
    if (e !== m.saque) {
      const d = Math.hypot(j.x, j.y), min = C.CIRCULO + j.r;
      if (d < min) {
        const nx = d ? j.x / d : s, ny = d ? j.y / d : 0;
        j.x = nx * min; j.y = ny * min;
      }
    }
  }

  // Patada: si el disco está a ALCANCE de la pelota.
  function alcance(j, b, extra) {
    return Math.hypot(b.x - j.x, b.y - j.y) - j.r - b.r < C.ALCANCE + (extra || 0);
  }
  function patea(j, b) {
    const dx = b.x - j.x, dy = b.y - j.y, d = Math.hypot(dx, dy) || 1;
    b.vx += dx / d * C.PATADA * b.im;
    b.vy += dy / d * C.PATADA * b.im;
  }

  /* Un tick. `entradas`: uid → {x, y, k} (dirección, |·| ≤ 1, y si patea).
     `fijos`: uid → true para discos que no se integran aquí (los remotos:
     su posición la manda su dueño) y que la pelota trata como de masa
     infinita. Devuelve los sucesos del tick: {patadas: [uid], rebote, gol}. */
  function paso(m, entradas, fijos) {
    const ev = { patadas: [], rebote: false, gol: null, toque: false };
    entradas = entradas || {}; fijos = fijos || {};
    const b = m.b;
    for (const [u, j] of m.J) {
      const d = j.d, en = entradas[u];
      if (fijos[u]) { d.x += d.vx; d.y += d.vy; continue; }
      let ix = 0, iy = 0, k = false;
      if (en) {
        ix = +en.x || 0; iy = +en.y || 0; k = !!en.k;
        const l = Math.hypot(ix, iy);
        if (l > 1) { ix /= l; iy /= l; }
      }
      const a = k ? C.ACC_PATEA : C.ACC;
      d.vx = (d.vx + ix * a) * C.AMORT_J;
      d.vy = (d.vy + iy * a) * C.AMORT_J;
      d.x += d.vx; d.y += d.vy;
      j.k = k;
      if (k && !j.pateado) {
        if (alcance(d, b, 0)) { patea(d, b); j.pateado = true; m.ult = u; ev.patadas.push(u); ev.toque = true; }
      }
      if (!k) j.pateado = false;
    }
    b.vx *= C.AMORT_B; b.vy *= C.AMORT_B;
    b.x += b.vx; b.y += b.vy;
    // Choques: jugadores entre sí, contra la pelota y contra los postes.
    const lista = [...m.J.entries()];
    for (let i = 0; i < lista.length; i++) {
      const [ua, ja] = lista[i];
      const da = fijos[ua] ? Object.assign({}, ja.d, { im: 0 }) : ja.d;
      for (let k = i + 1; k < lista.length; k++) {
        const [ub, jb] = lista[k];
        if (fijos[ua] && fijos[ub]) continue;
        const db = fijos[ub] ? Object.assign({}, jb.d, { im: 0 }) : jb.d;
        choque(da, db, C.REB);
        if (da !== ja.d) Object.assign(ja.d, { x: ja.d.x, y: ja.d.y });
      }
      const djb = fijos[ua] ? { x: ja.d.x, y: ja.d.y, vx: ja.d.vx, vy: ja.d.vy, r: ja.d.r, im: 0 } : ja.d;
      if (choque(djb, b, C.REB)) { m.ult = ua; ev.toque = true; }
      if (!fijos[ua]) for (const p of POSTES) choque(p, ja.d, C.REB);
    }
    for (const p of POSTES) if (choque(p, b, C.REB)) ev.rebote = true;
    if (paredBola(b)) ev.rebote = true;
    for (const [u, j] of m.J) {
      if (fijos[u]) continue;
      limitaJugador(j.d, m);
      reglaSaque(m, j.d, j.e);
    }
    if (ev.toque && m.saque) m.saque = null;
    if (!m.gol && Math.abs(b.x) > C.W && Math.abs(b.y) < C.G) {
      const e = b.x > 0 ? 'rojo' : 'azul';
      const quien = m.ult && m.J.get(m.ult);
      m.gol = { e, por: quien && quien.e === e ? m.ult : '' };
      ev.gol = m.gol;
    }
    return ev;
  }

  // ---------- bots ----------
  /* Dos papeles: el delantero se pone detrás de la pelota, en la línea hacia
     el arco rival, y empuja; el defensor espera entre su arco y la pelota y
     sale cuando la pelota se le acerca. `nivel` 0–2 escala la intensidad
     del movimiento (un bot lento acelera menos, no piensa peor). */
  function bot(m, u, papel, nivel) {
    const j = m.J.get(u);
    if (!j) return { x: 0, y: 0, k: false };
    const d = j.d, b = m.b, s = lado(j.e);
    const fuerza = [0.7, 0.85, 1][clamp(nivel | 0, 0, 2)];
    const arcoRival = { x: -s * C.W, y: 0 };
    let tx, ty, k = false;
    const db = Math.hypot(b.x - d.x, b.y - d.y);
    if (papel === 'def' && Math.hypot(b.x - s * C.W, b.y) > 210 && db > 80) {
      const t = 0.3;
      tx = s * C.W + (b.x - s * C.W) * t; ty = b.y * t;
    } else {
      const ax = arcoRival.x - b.x, ay = arcoRival.y - b.y, al = Math.hypot(ax, ay) || 1;
      const ux = ax / al, uy = ay / al;
      tx = b.x - ux * (C.RB + C.RJ + 2); ty = b.y - uy * (C.RB + C.RJ + 2);
      // Detrás de la pelota: ¿la pelota está entre el bot y el arco rival?
      const vx = b.x - d.x, vy = b.y - d.y, vl = Math.hypot(vx, vy) || 1;
      const alineado = (vx * ux + vy * uy) / vl;
      if (alineado < 0.3) {
        // Rodea: apunta a un punto más atrás y al costado.
        const lat = (d.y > b.y ? 1 : -1);
        tx = b.x - ux * 40 + uy * 0; ty = b.y - uy * 40 + lat * 28;
      } else {
        tx = b.x; ty = b.y;
        if (db - C.RJ - C.RB < C.ALCANCE + 1 && alineado > 0.75 && !j.pateado) k = true;
      }
    }
    // En el saque, el que no saca espera.
    if (m.saque && m.saque !== j.e) { tx = s * (C.CIRCULO + C.RJ + 20); ty = clamp(b.y, -40, 40); }
    let x = tx - d.x, y = ty - d.y;
    const l = Math.hypot(x, y);
    if (l < 3) { x = -d.vx; y = -d.vy; } else { x /= l; y /= l; }
    return { x: x * fuerza, y: y * fuerza, k };
  }

  function agrega(m, u, e) {
    m.J.set(u, { d: disco(lado(e) * C.W / 2, 0, C.RJ, C.IM_J), e, k: false, pateado: false });
  }

  return { C, EQUIPOS, lado, crea, agrega, alinea, paso, bot, choque, paredBola, alcance, POSTES };
});
