/* Tetris Club — el motor, compartido.
   Lo usan tres sitios: el juego en solitario (este directorio, sin
   compilar), la sala multijugador de Juegos (esbuild lo mete en el
   paquete) y las pruebas de Node. Por eso es UMD y no toca el DOM salvo
   en `pinta*`, que reciben un contexto de canvas ya hecho.

   Todo es determinista a partir de la semilla: la bolsa de siete da la
   misma secuencia de piezas a todos los de una sala, y `avanza(s, dt)`
   hace caer, fijar y limpiar sin mirar el reloj — el tiempo lo pone
   quien llama. Eso es lo que deja probarlo sin navegador. */
(function (raiz, fabrica) {
  const M = fabrica();
  if (typeof module === "object" && module.exports) module.exports = M;
  else raiz.TetrisMotor = M;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const W = 10, H = 22, OCULTAS = 2;
  const PIEZAS = "IJLOSTZ";
  const COLOR = { I: "#2fd3e8", J: "#3b6cf6", L: "#f59a23", O: "#f5d432", S: "#46d160", T: "#b04ee8", Z: "#f0455a", G: "#6b7280" };
  const FORMA = {
    I: [4, [[0, 1], [1, 1], [2, 1], [3, 1]]],
    J: [3, [[0, 0], [0, 1], [1, 1], [2, 1]]],
    L: [3, [[2, 0], [0, 1], [1, 1], [2, 1]]],
    O: [2, [[0, 0], [1, 0], [0, 1], [1, 1]]],
    S: [3, [[1, 0], [2, 0], [0, 1], [1, 1]]],
    T: [3, [[1, 0], [0, 1], [1, 1], [2, 1]]],
    Z: [3, [[0, 0], [1, 0], [1, 1], [2, 1]]]
  };
  /* Las cuatro orientaciones, giradas dentro de su caja (SRS). */
  const CELDAS = {};
  for (const p of PIEZAS) {
    const [n, base] = FORMA[p];
    const rs = [base];
    for (let r = 1; r < 4; r++) rs.push(rs[r - 1].map(([x, y]) => [n - 1 - y, x]));
    CELDAS[p] = rs;
  }
  /* Patadas SRS, con la y hacia arriba como en la guía; se invierte al usarlas. */
  const K_JLSTZ = {
    "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
  };
  const K_I = {
    "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
  };
  const PUNTOS = [0, 100, 300, 500, 800], PUNTOS_TS = [400, 800, 1200, 1600];
  const ATAQUE = [0, 0, 1, 2, 4], ATAQUE_TS = [0, 2, 4, 6];
  const COMBO = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];
  const BLOQUEO_MS = 500, MAX_RESETS = 15;

  function rng(semilla) {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* La bolsa de siete: cada tanda de siete piezas trae una de cada. */
  function bolsa(semilla) {
    const r = rng(semilla);
    let b = [];
    return () => {
      if (!b.length) {
        b = PIEZAS.split("");
        for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      }
      return b.shift();
    };
  }
  /* Segundos por fila, la fórmula de la guía; a partir del 20 ya es caer. */
  const gravedad = nivel => 1000 * Math.pow(0.8 - (Math.min(20, nivel) - 1) * 0.007, Math.min(20, nivel) - 1);

  function crear(op = {}) {
    const semilla = (op.semilla >>> 0) || 1;
    const s = {
      pozo: new Array(W * H).fill(""), sig: bolsa(semilla), cola: [], guardada: "", puedeGuardar: true,
      p: null, lineas: 0, puntos: 0, nivel: op.nivel || 1, nivelBase: op.nivel || 1, combo: -1, b2b: false,
      fin: false, acum: 0, suelo: 0, resets: 0, blando: false, giro: false, tiempo: 0,
      entrante: [], salida: 0, recibidas: 0, eventos: [], piezas: 0, rb: rng(semilla ^ 0x9e3779b9),
      subeCada: op.subeCada || 0
    };
    for (let i = 0; i < 5; i++) s.cola.push(s.sig());
    nace(s);
    return s;
  }
  const celdas = p => CELDAS[p.t][p.r].map(([x, y]) => [p.x + x, p.y + y]);
  function cabe(s, p) {
    for (const [x, y] of celdas(p)) {
      if (x < 0 || x >= W || y >= H) return false;
      if (y >= 0 && s.pozo[y * W + x]) return false;
    }
    return true;
  }
  function nace(s, t) {
    t = t || s.cola.shift();
    if (s.cola.length < 5) s.cola.push(s.sig());
    const p = { t, r: 0, x: t === "O" ? 4 : 3, y: 0 };
    s.p = p; s.acum = 0; s.suelo = 0; s.resets = 0; s.giro = false;
    if (!cabe(s, p)) { s.fin = true; s.eventos.push({ e: "fin" }); return; }
    const abajo = { ...p, y: 1 };
    if (cabe(s, abajo)) s.p = abajo;
  }
  const enSuelo = s => !cabe(s, { ...s.p, y: s.p.y + 1 });
  const toca = s => { if (enSuelo(s) && s.resets < MAX_RESETS) { s.suelo = 0; s.resets++; } };
  function mover(s, dx) {
    if (s.fin) return false;
    const q = { ...s.p, x: s.p.x + dx };
    if (!cabe(s, q)) return false;
    s.p = q; s.giro = false; toca(s);
    return true;
  }
  function rotar(s, dir) {
    if (s.fin || s.p.t === "O") return false;
    const r2 = (s.p.r + (dir > 0 ? 1 : 3)) % 4;
    const tabla = (s.p.t === "I" ? K_I : K_JLSTZ)[s.p.r + ">" + r2];
    for (const [kx, ky] of tabla) {
      const q = { ...s.p, r: r2, x: s.p.x + kx, y: s.p.y - ky };
      if (cabe(s, q)) { s.p = q; s.giro = true; toca(s); s.eventos.push({ e: "gira" }); return true; }
    }
    return false;
  }
  function fantasma(s) {
    const q = { ...s.p };
    while (cabe(s, { ...q, y: q.y + 1 })) q.y++;
    return q;
  }
  function caer(s) {
    if (s.fin) return;
    const q = fantasma(s);
    s.puntos += 2 * (q.y - s.p.y);
    s.p = q;
    fija(s);
  }
  function guardar(s) {
    if (s.fin || !s.puedeGuardar) return false;
    const t = s.p.t;
    const antes = s.guardada;
    s.guardada = t; s.puedeGuardar = false;
    nace(s, antes || undefined);
    s.eventos.push({ e: "guarda" });
    return true;
  }
  /* Tres de las cuatro esquinas de la caja de la T ocupadas tras un giro. */
  function esTspin(s) {
    const p = s.p;
    if (p.t !== "T" || !s.giro) return false;
    let n = 0;
    for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
      const x = p.x + dx, y = p.y + dy;
      if (x < 0 || x >= W || y >= H || (y >= 0 && s.pozo[y * W + x])) n++;
    }
    return n >= 3;
  }
  function fija(s) {
    const ts = esTspin(s);
    let arriba = true;
    for (const [x, y] of celdas(s.p)) { if (y >= 0) s.pozo[y * W + x] = s.p.t; if (y >= OCULTAS) arriba = false; }
    s.piezas++;
    s.p = null;
    const llenas = [];
    for (let y = 0; y < H; y++) { let ok = true; for (let x = 0; x < W; x++) if (!s.pozo[y * W + x]) { ok = false; break; } if (ok) llenas.push(y); }
    const n = llenas.length;
    for (const y of llenas) { s.pozo.splice(y * W, W); s.pozo.unshift(...new Array(W).fill("")); }
    const nivel = s.nivel;
    let pts = 0, atq = 0;
    if (n || ts) {
      const dificil = n === 4 || (ts && n > 0);
      pts = (ts ? PUNTOS_TS[n] : PUNTOS[n]) * nivel;
      atq = ts ? ATAQUE_TS[n] : ATAQUE[n];
      if (n && dificil && s.b2b) { pts = Math.floor(pts * 1.5); atq += 1; }
      if (n) s.b2b = dificil;
    }
    if (n) {
      s.combo++;
      pts += 50 * s.combo * nivel;
      atq += COMBO[Math.min(COMBO.length - 1, s.combo)];
    } else s.combo = -1;
    const limpio = n > 0 && s.pozo.every(c => !c);
    if (limpio) { pts += 3000 * nivel; atq += 10; }
    s.puntos += pts;
    s.lineas += n;
    subeNivel(s);
    /* Lo que ataco primero tapa lo que me llega; lo que sobra sale. */
    while (atq > 0 && s.entrante.length) {
      const k = Math.min(atq, s.entrante[0]);
      atq -= k; s.entrante[0] -= k;
      if (!s.entrante[0]) s.entrante.shift();
    }
    if (atq > 0) s.salida += atq;
    s.eventos.push({ e: "fija", n, ts, pc: limpio, pts, atq, combo: s.combo, b2b: s.b2b && n > 0 });
    if (!n && s.entrante.length) sube(s);
    s.puedeGuardar = true;
    if (arriba) { s.fin = true; s.eventos.push({ e: "fin" }); return; }
    nace(s);
  }
  /* Hasta ocho filas de basura por pieza fijada; el resto espera. */
  function sube(s) {
    let tope = 8;
    while (tope > 0 && s.entrante.length) {
      const k = Math.min(tope, s.entrante[0]);
      tope -= k; s.entrante[0] -= k;
      if (!s.entrante[0]) s.entrante.shift();
      const hueco = Math.floor(s.rb() * W);
      for (let i = 0; i < k; i++) {
        s.pozo.splice(0, W);
        const fila = new Array(W).fill("G"); fila[hueco] = "";
        s.pozo.push(...fila);
      }
      s.eventos.push({ e: "basura", n: k });
    }
    if (s.p && !cabe(s, s.p)) {
      while (s.p.y > -2 && !cabe(s, s.p)) s.p.y--;
      if (!cabe(s, s.p)) { s.fin = true; s.eventos.push({ e: "fin" }); }
    }
  }
  function recibe(s, n) { if (n > 0 && !s.fin) { s.entrante.push(n); s.recibidas += n; } }
  const pendiente = s => s.entrante.reduce((a, b) => a + b, 0);
  function subeNivel(s) {
    const porLineas = s.nivelBase + Math.floor(s.lineas / 10);
    const porTiempo = s.subeCada ? s.nivelBase + Math.floor(s.tiempo / s.subeCada) : 0;
    const n = Math.min(20, Math.max(porLineas, porTiempo));
    if (n > s.nivel) { s.nivel = n; s.eventos.push({ e: "nivel", n }); }
  }
  /* El paso del tiempo: gravedad, blando y el retraso de fijar. */
  function avanza(s, dt) {
    if (s.fin) return;
    s.tiempo += dt;
    if (s.subeCada) subeNivel(s);
    const g = gravedad(s.nivel);
    const paso = s.blando ? Math.min(g, 40) : g;
    s.acum += dt;
    while (s.acum >= paso && !s.fin) {
      s.acum -= paso;
      if (!enSuelo(s)) { s.p = { ...s.p, y: s.p.y + 1 }; s.giro = false; if (s.blando) s.puntos += 1; }
      else { s.acum = 0; break; }
    }
    if (!s.fin && enSuelo(s)) {
      s.suelo += dt;
      if (s.suelo >= BLOQUEO_MS || s.resets >= MAX_RESETS && s.suelo >= 60) fija(s);
    } else s.suelo = 0;
  }
  /* El pozo visible en 200 letras, con la pieza en juego dentro: lo que
     viaja a las miniaturas de los rivales. */
  function resumen(s) {
    const v = s.pozo.slice(OCULTAS * W);
    if (s.p && !s.fin) for (const [x, y] of celdas(s.p)) if (y >= OCULTAS) v[(y - OCULTAS) * W + x] = s.p.t;
    return v.map(c => c || ".").join("");
  }

  /* ---------- dibujo (canvas) ---------- */
  function bloque(ctx, x, y, t, c, alfa) {
    const col = COLOR[t] || "#888";
    ctx.globalAlpha = alfa == null ? 1 : alfa;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, c, c);
    if (c >= 8) {
      const b = Math.max(1, Math.round(c * 0.14));
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x, y, c, b); ctx.fillRect(x, y, b, c);
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(x, y + c - b, c, b); ctx.fillRect(x + c - b, y, b, c);
    }
    ctx.globalAlpha = 1;
  }
  function pintaPozo(ctx, s, o = {}) {
    const c = o.celda || 24, x0 = o.x || 0, y0 = o.y || 0;
    ctx.fillStyle = o.fondo || "#0b0f1a";
    ctx.fillRect(x0, y0, W * c, (H - OCULTAS) * c);
    ctx.strokeStyle = o.rejilla || "rgba(255,255,255,.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < W; i++) { ctx.moveTo(x0 + i * c + 0.5, y0); ctx.lineTo(x0 + i * c + 0.5, y0 + (H - OCULTAS) * c); }
    for (let j = 1; j < H - OCULTAS; j++) { ctx.moveTo(x0, y0 + j * c + 0.5); ctx.lineTo(x0 + W * c, y0 + j * c + 0.5); }
    ctx.stroke();
    for (let y = OCULTAS; y < H; y++) for (let x = 0; x < W; x++) {
      const t = s.pozo[y * W + x];
      if (t) bloque(ctx, x0 + x * c, y0 + (y - OCULTAS) * c, t, c, s.fin ? 0.45 : 1);
    }
    if (s.fin || !s.p) return;
    if (o.fantasma !== false) {
      const f = fantasma(s);
      ctx.strokeStyle = COLOR[f.t]; ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
      for (const [x, y] of celdas(f)) if (y >= OCULTAS) ctx.strokeRect(x0 + x * c + 2, y0 + (y - OCULTAS) * c + 2, c - 4, c - 4);
      ctx.globalAlpha = 1;
    }
    const brillo = 1 - Math.min(1, s.suelo / BLOQUEO_MS) * 0.35;
    for (const [x, y] of celdas(s.p)) if (y >= OCULTAS) bloque(ctx, x0 + x * c, y0 + (y - OCULTAS) * c, s.p.t, c, brillo);
  }
  /* Una pieza suelta centrada en una caja (cola y reserva). */
  function pintaPieza(ctx, t, cx, cy, c, alfa) {
    if (!t) return;
    const cs = CELDAS[t][0];
    const xs = cs.map(p => p[0]), ys = cs.map(p => p[1]);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * c, h = (Math.max(...ys) - Math.min(...ys) + 1) * c;
    for (const [x, y] of cs) bloque(ctx, cx - w / 2 + (x - Math.min(...xs)) * c, cy - h / 2 + (y - Math.min(...ys)) * c, t, c, alfa);
  }
  /* La miniatura de un rival a partir de su `resumen`. */
  function pintaResumen(ctx, txt, o = {}) {
    const c = o.celda || 8, x0 = o.x || 0, y0 = o.y || 0;
    ctx.fillStyle = o.fondo || "#0b0f1a";
    ctx.fillRect(x0, y0, W * c, (H - OCULTAS) * c);
    for (let i = 0; i < (txt || "").length && i < W * (H - OCULTAS); i++) {
      const t = txt[i];
      if (t !== ".") bloque(ctx, x0 + (i % W) * c, y0 + Math.floor(i / W) * c, t, c, o.muerto ? 0.4 : 1);
    }
  }

  /* ---------- mando: teclado con DAS/ARR ----------
     `acciones` recibe "izq", "der", "gira", "contragira", "caer",
     "guarda" y "pausa"; el blando se lee de `mando.blando`. */
  function crearMando(acciones, op = {}) {
    const DAS = op.das || 150, ARR = op.arr || 45;
    const m = { blando: false, lado: 0, t: 0, repite: false };
    const mapa = {
      ArrowLeft: "izq", ArrowRight: "der", ArrowUp: "gira", KeyX: "gira", KeyZ: "contragira", ControlLeft: "contragira",
      Space: "caer", KeyC: "guarda", ShiftLeft: "guarda", ShiftRight: "guarda", ArrowDown: "blando", KeyP: "pausa", Escape: "pausa",
      KeyA: "izq", KeyD: "der", KeyW: "gira", KeyS: "blando", KeyQ: "contragira", KeyE: "gira"
    };
    m.baja = e => {
      const a = mapa[e.code];
      if (!a) return false;
      e.preventDefault();
      if (a === "blando") { m.blando = true; return true; }
      if (e.repeat) return true;
      if (a === "izq" || a === "der") { m.lado = a === "izq" ? -1 : 1; m.t = 0; m.repite = false; acciones(a); return true; }
      acciones(a);
      return true;
    };
    m.sube = e => {
      const a = mapa[e.code];
      if (a === "blando") m.blando = false;
      if ((a === "izq" && m.lado < 0) || (a === "der" && m.lado > 0)) m.lado = 0;
    };
    m.paso = dt => {
      if (!m.lado) return;
      m.t += dt;
      const lim = m.repite ? ARR : DAS;
      while (m.t >= lim) { m.t -= m.repite ? ARR : DAS; m.repite = true; acciones(m.lado < 0 ? "izq" : "der"); if (ARR <= 0) break; }
    };
    m.suelta = () => { m.blando = false; m.lado = 0; };
    return m;
  }
  /* Aplica una acción del mando a una partida. */
  function accion(s, a) {
    if (a === "izq") return mover(s, -1);
    if (a === "der") return mover(s, 1);
    if (a === "gira") return rotar(s, 1);
    if (a === "contragira") return rotar(s, -1);
    if (a === "caer") { caer(s); return true; }
    if (a === "guarda") return guardar(s);
    return false;
  }

  return {
    W, H, OCULTAS, PIEZAS, COLOR, rng, bolsa, gravedad, crear, cabe, mover, rotar, fantasma, caer, guardar,
    avanza, recibe, pendiente, resumen, accion, pintaPozo, pintaPieza, pintaResumen, crearMando, celdas
  };
});
