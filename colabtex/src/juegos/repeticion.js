/* Las repeticiones del riel del salón (rieles.js): una partida del club
   rehecha a partir de su prueba antitrampas, con el mismo motor que la
   jugó (docs/antitrampas.md). Lo que se ve es exactamente lo que pasó.

   `crearRepro(juego, prueba)` devuelve un reproductor con
     dur          lo que dura la partida, en ms de juego;
     en(ms)       deja el estado en ese instante (hacia atrás, rehace desde
                  el principio: los motores no saben deshacer);
     pinta(ctx, w, h)  dibuja el tablero en una caja de w × h;
     marcador()   {puntos, tiempo, extra} para el pie de la tarjeta.
   El avance replica, paso por paso, el bucle del verificador de cada juego
   (solo/verifica/<juego>.js): si el verificador acepta la prueba, esto la
   reproduce hasta el mismo final. Sin DOM: `en` y `marcador` corren en
   Node (tests/rieles.test.cjs), y `pinta` solo pide un contexto 2D. */
import TM from "../../../juegos/club/tetris/motor.js";
import Snake from "../../../juegos/club/snake/motor.js";
import Sortem from "../../../juegos/club/sortem/motor.js";
import Mina from "../../../juegos/club/minas/engine.js";

const redondo = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

/* ---------- Tetris (Maratón) ----------
   Pasos fijos de TM.PASO ms, las jugadas al empezar su paso: lo mismo que
   `TM.rehace`. */
const LETRA_TETRIS = { I: "izq", D: "der", G: "gira", A: "contragira", C: "caer", H: "guarda" };
function reproTetris(p) {
  const jugadas = TM.leeJugadas(p.e, p.n);
  if (!jugadas) throw new Error("jugadas ilegibles");
  let s, k, i, blando, fin;
  const reset = () => { s = TM.crear({ semilla: TM.semillaDe(p.u, p.a), nivel: 1 }); k = 0; i = 0; blando = false; fin = false; };
  reset();
  function en(ms) {
    const meta = Math.min(p.n, Math.floor(ms / TM.PASO));
    if (meta < k) reset();
    while (k < meta && !fin) {
      for (; i < jugadas.length && jugadas[i][0] === k; i++) {
        const l = jugadas[i][1];
        if (l === "B" || l === "S") { blando = l === "B"; continue; }
        if (!s.fin) TM.accion(s, LETRA_TETRIS[l]);
      }
      s.blando = blando;
      TM.avanza(s, TM.PASO);
      s.eventos.length = 0;
      k++;
      if (TM.terminada(s, p.m)) fin = true;
    }
  }
  function pinta(ctx, w, h) {
    const filas = TM.H - TM.OCULTAS;
    // El pozo al centro; a los lados, la reserva y las tres siguientes.
    const c = Math.max(3, Math.floor(Math.min((h - 4) / filas, (w - 8) / (TM.W + 7))));
    const pw = TM.W * c, ph = filas * c, x0 = Math.round((w - pw) / 2), y0 = Math.round((h - ph) / 2);
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, w, h);
    TM.pintaPozo(ctx, s, { celda: c, x: x0, y: y0, fondo: "#111827" });
    ctx.strokeStyle = "#ffffff26";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, pw + 1, ph + 1);
    const m = Math.max(2, Math.round(c * 0.55)), lado = x0 / 2;
    if (s.guardada) TM.pintaPieza(ctx, s.guardada, lado, y0 + 2.2 * c, m, s.puedeGuardar ? 1 : 0.4);
    for (let j = 0; j < 3 && j < s.cola.length; j++) TM.pintaPieza(ctx, s.cola[j], x0 + pw + lado, y0 + (2.2 + j * 3) * c, m, j ? 0.7 : 1);
  }
  return {
    dur: p.n * TM.PASO, en, pinta,
    get fin() { return fin; },
    marcador: () => ({ puntos: s.puntos, tiempo: s.tiempo, extra: `${s.lineas} línea${s.lineas === 1 ? "" : "s"} · nivel ${s.nivel}` })
  };
}

/* ---------- Snake (clásico) ----------
   Un tic cada `interval()` segundos de juego, y antes de cada tic, los
   giros que entraron en él: el bucle del verificador. */
function reproSnake(p) {
  const giros = Snake.leeGiros(p.g);
  if (!giros || !Snake.SIZES[p.t] || !Snake.SPEED_MULT[p.r]) throw new Error("prueba ilegible");
  let m, j;
  const reset = () => { m = Snake.crear({ mode: p.m, size: p.t, speed: p.r, semilla: p.s }); j = 0; };
  const vivo = () => m.state === "playing" && m.ticks < p.n;
  function tic() {
    while (j < giros.length && giros[j].tic === m.ticks) { m.enqueue(giros[j].nombre); j++; }
    if (!vivo()) return false;
    m.tick();
    m.ev.length = 0;
    return true;
  }
  // La duración sale de rehacerla una vez entera (es barato).
  reset();
  while (tic());
  const dur = Math.round(m.gameTime * 1000);
  reset();
  function en(ms) {
    if (ms < m.gameTime * 1000 - 0.5) reset();
    while (vivo() && (m.gameTime + m.interval()) * 1000 <= ms + 0.5) tic();
    if (ms >= dur) while (tic());
  }
  function pinta(ctx, w, h) {
    const { COLS, ROWS } = m;
    const c = Math.max(2, Math.floor(Math.min(w / COLS, h / ROWS)));
    const bw = COLS * c, bh = ROWS * c, x0 = Math.round((w - bw) / 2), y0 = Math.round((h - bh) / 2);
    ctx.fillStyle = "#0f1c15";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#17271e";
    ctx.fillRect(x0, y0, bw, bh);
    ctx.fillStyle = "#ffffff07";
    for (let y = 0; y < ROWS; y++) for (let x = (y & 1); x < COLS; x += 2) ctx.fillRect(x0 + x * c, y0 + y * c, c, c);
    const celda = (q, color, r = 0.3, pad = 1) => { ctx.fillStyle = color; redondo(ctx, x0 + q.x * c + pad, y0 + q.y * c + pad, c - 2 * pad, c - 2 * pad, c * r); ctx.fill(); };
    for (const o of m.obstacles) celda(o, "#5b6b62", 0.15);
    for (const q of m.portals) { ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = Math.max(1, c / 6); ctx.beginPath(); ctx.arc(x0 + (q.x + 0.5) * c, y0 + (q.y + 0.5) * c, c * 0.38, 0, 7); ctx.stroke(); }
    if (m.fruit) { ctx.fillStyle = "#f0577a"; ctx.beginPath(); ctx.arc(x0 + (m.fruit.x + 0.5) * c, y0 + (m.fruit.y + 0.5) * c, c * 0.38, 0, 7); ctx.fill(); }
    if (m.bonus) { ctx.fillStyle = "#f5c542"; ctx.beginPath(); ctx.arc(x0 + (m.bonus.x + 0.5) * c, y0 + (m.bonus.y + 0.5) * c, c * 0.42, 0, 7); ctx.fill(); }
    if (m.pickup) celda(m.pickup, "#5eead4", 0.5, Math.max(1, c * 0.2));
    const n = m.snake.length, muerto = m.state !== "playing";
    for (let i = n - 1; i >= 0; i--) {
      const f = n > 1 ? i / (n - 1) : 0;
      const l = 62 - f * 18;
      celda(m.snake[i], muerto ? `hsl(12 45% ${l - 8}%)` : `hsl(140 55% ${l}%)`, i ? 0.32 : 0.42, i ? 1 : 0.5);
    }
    // Los ojos de la cabeza, mirando hacia donde va.
    const cab = m.snake[0];
    if (cab && c >= 6) {
      const d = m.direction, cx = x0 + (cab.x + 0.5) * c, cy = y0 + (cab.y + 0.5) * c;
      ctx.fillStyle = "#0f1c15";
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + d.x * c * 0.18 - d.y * s * c * 0.18, cy + d.y * c * 0.18 + d.x * s * c * 0.18, Math.max(1, c * 0.09), 0, 7); ctx.fill(); }
    }
  }
  return {
    dur, en, pinta,
    get fin() { return m.state !== "playing"; },
    marcador: () => ({ puntos: m.score, tiempo: m.gameTime * 1000, extra: `${m.eaten} fruta${m.eaten === 1 ? "" : "s"} · largo ${m.snake.length}` })
  };
}

/* ---------- sortEm ----------
   Cada tecla en su instante (la suma de los `t`), aplicada con el motor
   puro; las autorrepeticiones (minúsculas) cuentan igual que en el
   verificador. */
function reproSortem(p) {
  const acciones = String(p.a || "").toUpperCase(), L = acciones.length;
  if (!/^[LRA]+$/.test(acciones) || !Array.isArray(p.t) || p.t.length !== L || !Sortem.MODOS.includes(p.n)) throw new Error("prueba ilegible");
  const inst = [];
  let acc = 0;
  for (const x of p.t) inst.push(acc += Math.max(0, Number(x) || 0));
  const dur = acc;
  let e, i, ahora;
  const reset = () => { e = Sortem.nuevo(p.n, p.s); i = 0; ahora = 0; };
  reset();
  function en(ms) {
    if (ms < ahora) reset();
    while (i < L && inst[i] <= ms) { Sortem.aplica(e, acciones[i]); i++; }
    ahora = ms;
  }
  function pinta(ctx, w, h) {
    ctx.fillStyle = "#14112a";
    ctx.fillRect(0, 0, w, h);
    const n = e.n, bloques = e.bloques;
    /* Los números fluyen de izquierda a derecha y entre bloques queda un
       hueco; en dos filas si en una saldrían diminutos. Se colocan de a
       uno y se salta de fila al no caber el siguiente. */
    const HUECO = 0.35, flujo = n + (bloques.length - 1) * HUECO;
    const filas = n > 10 && w / flujo < Math.min(26, h * 0.3) ? 2 : 1;
    const limite = Math.ceil(flujo / filas) + 0.5;
    const t = Math.max(6, Math.min((w - 12) / limite, (h - 16) / (filas * 1.5)));
    const sitios = [];
    let fx = 0, fila = 0;
    bloques.forEach((b, bi) => {
      if (fx > 0) fx += HUECO;
      for (const v of b) {
        if (fx + 1 > limite && fila < filas - 1) { fila++; fx = 0; }
        sitios.push({ v, bi, fila, fx });
        fx += 1;
      }
    });
    const anchoDe = f => Math.max(...sitios.filter(q => q.fila === f).map(q => q.fx + 1));
    const y0 = (h - filas * t * 1.5 + t * 0.5) / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(7, Math.round(t * 0.5))}px 'IBM Plex Mono', monospace`;
    const anchos = Array.from({ length: filas }, (_, f) => anchoDe(f));
    for (const q of sitios) {
      const sel = q.bi === e.sel, alza = sel && e.agarrado ? -t * 0.28 : 0;
      const x = (w - anchos[q.fila] * t) / 2 + q.fx * t, y = y0 + q.fila * t * 1.5 + alza;
      const tono = 250 - (q.v - 1) / Math.max(1, n - 1) * 230;
      ctx.fillStyle = e.ganado ? "#22c55e" : `hsl(${tono} 70% ${sel ? 62 : 52}%)`;
      redondo(ctx, x + 1, y, t - 2, t, t * 0.22);
      ctx.fill();
      if (sel && !e.ganado) { ctx.strokeStyle = e.agarrado ? "#fde047" : "#ffffffcc"; ctx.lineWidth = Math.max(1, t * 0.08); ctx.stroke(); }
      ctx.fillStyle = "#0b0a17";
      ctx.fillText(String(q.v), x + t / 2, y + t / 2 + 0.5);
    }
  }
  return {
    dur, en, pinta,
    get fin() { return e.ganado; },
    marcador: () => ({ puntos: p.n, tiempo: Math.min(ahora, dur), extra: `${e.bloques.length} bloque${e.bloques.length === 1 ? "" : "s"}` })
  };
}

/* ---------- Mina Club (medio) ----------
   Cada jugada en el instante del reloj del marcador (la suma de los
   msJuego); las pausas (código −1) no ocupan tiempo. */
const COLOR_N = ["", "#3b6fd8", "#2f8a45", "#d6453d", "#6a3fb5", "#a3502a", "#1f8a8a", "#253c30", "#7b7b7b"];
function reproMinas(p) {
  const e = p.e, CAMPOS = 6;
  if (!Array.isArray(e) || !e.length || e.length % CAMPOS || !Mina.LEVELS[p.n]) throw new Error("prueba ilegible");
  const inst = [];
  let acc = 0;
  for (let k = 0; k < e.length; k += CAMPOS) inst.push(acc += Math.max(0, Number(e[k + 1]) || 0));
  const dur = acc;
  let g, i, ahora, ultima;
  const reset = () => { g = new Mina.Game(p.n, Mina.azar(p.s)); i = 0; ahora = 0; ultima = -1; };
  reset();
  function en(ms) {
    if (ms < ahora) reset();
    while (i < inst.length && inst[i] <= ms) {
      const c = e[i * CAMPOS];
      if (c >= 0) { const celda = c >> 1; if (c & 1) g.flag(celda); else g.open(celda); ultima = celda; }
      i++;
    }
    ahora = ms;
  }
  function pinta(ctx, w, h) {
    const { cols, rows } = g;
    const c = Math.max(3, Math.floor(Math.min(w / cols, h / rows)));
    const bw = cols * c, bh = rows * c, x0 = Math.round((w - bw) / 2), y0 = Math.round((h - bh) / 2);
    ctx.fillStyle = "#1d2b22";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(6, Math.round(c * 0.66))}px 'IBM Plex Sans', sans-serif`;
    const gano = g.state === "won";
    for (let k = 0; k < g.cells.length; k++) {
      const q = g.cells[k], x = x0 + (k % cols) * c, y = y0 + Math.floor(k / cols) * c;
      if (q.open) {
        ctx.fillStyle = ((k % cols) + Math.floor(k / cols)) & 1 ? "#eef1e6" : "#f7f8f2";
        ctx.fillRect(x, y, c, c);
        if (q.mine) { ctx.fillStyle = "#d6453d"; ctx.beginPath(); ctx.arc(x + c / 2, y + c / 2, c * 0.3, 0, 7); ctx.fill(); }
        else if (q.count && c >= 7) { ctx.fillStyle = COLOR_N[q.count]; ctx.fillText(String(q.count), x + c / 2, y + c / 2 + 0.5); }
      } else {
        ctx.fillStyle = ((k % cols) + Math.floor(k / cols)) & 1 ? "#4f8457" : "#43734b";
        ctx.fillRect(x, y, c, c);
        if (q.flag || (gano && q.mine)) {
          ctx.fillStyle = "#d8ef8c";
          ctx.beginPath(); ctx.moveTo(x + c * 0.36, y + c * 0.2); ctx.lineTo(x + c * 0.78, y + c * 0.38); ctx.lineTo(x + c * 0.36, y + c * 0.56); ctx.closePath(); ctx.fill();
          ctx.fillRect(x + c * 0.3, y + c * 0.2, Math.max(1, c * 0.08), c * 0.6);
        }
      }
    }
    if (ultima >= 0 && !gano) {
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = Math.max(1, c * 0.12);
      ctx.strokeRect(x0 + (ultima % cols) * c + 1, y0 + Math.floor(ultima / cols) * c + 1, c - 2, c - 2);
    }
  }
  return {
    dur, en, pinta,
    get fin() { return g.state === "won" || g.state === "lost"; },
    marcador: () => ({ puntos: 1, tiempo: Math.min(ahora, dur), extra: `${Math.round(g.progress * 100)} % despejado · ${g.flags} 🚩` })
  };
}

const FABRICAS = { tetris: reproTetris, snake: reproSnake, sortem: reproSortem, minas: reproMinas };

/* null si la prueba no se puede reproducir (y entonces no se muestra). */
export function crearRepro(juego, prueba) {
  const f = FABRICAS[juego];
  if (!f || !prueba || typeof prueba !== "object") return null;
  try {
    const r = f(prueba);
    return r.dur > 0 ? r : null;
  } catch (e) {
    return null;
  }
}
