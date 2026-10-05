/* Las repeticiones del riel del salón (rieles.js): una partida del club
   rehecha a partir de su prueba antitrampas, con el mismo motor que la
   jugó (docs/antitrampas.md). Lo que se ve es exactamente lo que pasó.

   `crearRepro(juego, prueba)` devuelve un reproductor con
     dur          lo que dura la partida, en ms de juego;
     aspecto      alto / ancho de su escena, para repartir el riel;
     en(ms)       deja el estado en ese instante (hacia atrás, rehace desde
                  el principio: los motores no saben deshacer);
     pinta(ctx, w, h, reloj)  dibuja la escena centrada en una caja de
                  w × h (lo de fuera queda transparente); `reloj`, en
                  segundos, mueve lo que en el juego se mueve solo;
     marcador()   {puntos, tiempo, extra}.
   El avance replica, paso por paso, el bucle del verificador de cada juego
   (solo/verifica/<juego>.js): si el verificador acepta la prueba, esto la
   reproduce hasta el mismo final.

   **Cada escena se dibuja como el juego.** Los colores, las formas y el
   marcador salen del dibujo de cada juego (tetris/game.js y style.css,
   snake/game.js, sortem/game.js, minas/style.css), simplificados lo justo
   para caber en el riel: el pozo con sus cajas de guardada y siguientes,
   el tablero verde de Snake con su barra de puntos, la escena neón de
   sortEm con su «Time:» y la cuadrícula, y el jardín del buscaminas.
   Si un juego cambia de piel, esto se queda atrás: hay que mirarlo junto.
   Sin DOM: `en` y `marcador` corren en Node (tests/rieles.test.cjs). */
import TM from "../../../juegos/club/tetris/motor.js";
import Snake from "../../../juegos/club/snake/motor.js";
import Sortem from "../../../juegos/club/sortem/motor.js";
import Mina from "../../../juegos/club/minas/engine.js";

const redondo = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};
const circulo = (ctx, x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
const relleno = (ctx, x, y, w, h, r, color) => { ctx.fillStyle = color; redondo(ctx, x, y, w, h, r); ctx.fill(); };
const texto = (ctx, t, x, y, fuente, color, alinea = "left", base = "alphabetic") => {
  ctx.font = fuente; ctx.fillStyle = color; ctx.textAlign = alinea; ctx.textBaseline = base; ctx.fillText(t, x, y);
};
const mmss = ms => { const s = Math.floor(Math.max(0, ms) / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };

/* ---------- Tetris (Maratón) ----------
   Pasos fijos de TM.PASO ms, las jugadas al empezar su paso: lo mismo que
   `TM.rehace`. La escena es la del club: el pozo con su marco y su halo
   cian, a la izquierda «Guardada» y los números, a la derecha
   «Siguientes». */
const LETRA_TETRIS = { I: "izq", D: "der", G: "gira", A: "contragira", C: "caer", H: "guarda" };
const TT = { caja: "#111829", caja2: "#161f35", borde: "#273248", apagado: "#8fa0bb", tinta: "#e9edf5" };
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
  /* En celdas del pozo: 10 de pozo + 0,6 de marco, y a cada lado una
     columna de 4,4 con 0,5 de hueco. */
  const ANCHO = 10.6 + 2 * 4.9, ALTO = 20.6;
  function caja(ctx, x, y, w, h, c) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, TT.caja2); g.addColorStop(1, TT.caja);
    relleno(ctx, x, y, w, h, c * 0.7, g);
    ctx.strokeStyle = TT.borde; ctx.lineWidth = 1; redondo(ctx, x + 0.5, y + 0.5, w - 1, h - 1, c * 0.7); ctx.stroke();
  }
  function pinta(ctx, w, h) {
    const c = Math.max(3, Math.floor(Math.min(w / ANCHO, h / ALTO)));
    const x0 = Math.round((w - ANCHO * c) / 2), y0 = Math.round((h - ALTO * c) / 2);
    const lado = 4.4 * c, px = x0 + 4.9 * c, filas = TM.H - TM.OCULTAS;
    // El marco del pozo: degradado azul y el halo cian del club.
    ctx.save();
    ctx.shadowColor = "#2fd3e840"; ctx.shadowBlur = c * 1.2;
    const gm = ctx.createLinearGradient(0, y0, 0, y0 + ALTO * c);
    gm.addColorStop(0, "#1d2942"); gm.addColorStop(1, "#0e1526");
    relleno(ctx, px, y0, 10.6 * c, ALTO * c, c * 0.8, gm);
    ctx.restore();
    ctx.save();
    redondo(ctx, px + 0.3 * c, y0 + 0.3 * c, 10 * c, filas * c, c * 0.45); ctx.clip();
    TM.pintaPozo(ctx, s, { celda: c, x: px + 0.3 * c, y: y0 + 0.3 * c });
    ctx.restore();
    const etiqueta = `600 ${Math.round(c * 0.55)}px system-ui, sans-serif`, rotulos = c >= 11;
    // Izquierda: la pieza guardada y los números.
    const xl = x0, xr = px + 11.1 * c;
    caja(ctx, xl, y0, lado, 5.6 * c, c);
    if (rotulos) texto(ctx, "GUARDADA", xl + lado / 2, y0 + 1.25 * c, etiqueta, TT.apagado, "center");
    if (s.guardada) TM.pintaPieza(ctx, s.guardada, xl + lado / 2, y0 + 3.4 * c, Math.max(2, Math.round(c * 0.75)), s.puedeGuardar ? 1 : 0.35);
    caja(ctx, xl, y0 + 6.2 * c, lado, 9.4 * c, c);
    [["PUNTOS", s.puntos], ["LÍNEAS", s.lineas], ["NIVEL", s.nivel]].forEach(([n, v], j) => {
      const y = y0 + (7.6 + j * 2.75) * c;
      if (rotulos) texto(ctx, n, xl + 0.55 * c, y, etiqueta, TT.apagado);
      texto(ctx, String(v), xl + 0.55 * c, y + 1.45 * c, `700 ${Math.max(7, Math.round(c * 1.05))}px ui-monospace, "IBM Plex Mono", monospace`, TT.tinta);
    });
    // Derecha: las siguientes.
    caja(ctx, xr, y0, lado, 14.2 * c, c);
    if (rotulos) texto(ctx, "SIGUIENTES", xr + lado / 2, y0 + 1.25 * c, etiqueta, TT.apagado, "center");
    s.cola.slice(0, 4).forEach((t, j) => TM.pintaPieza(ctx, t, xr + lado / 2, y0 + (3.2 + j * 3) * c, Math.max(2, Math.round(c * (j ? 0.62 : 0.75)))));
  }
  return {
    dur: p.n * TM.PASO, aspecto: ALTO / ANCHO, en, pinta,
    get fin() { return fin; },
    marcador: () => ({ puntos: s.puntos, tiempo: s.tiempo, extra: `${s.lineas} línea${s.lineas === 1 ? "" : "s"} · nivel ${s.nivel}` })
  };
}

/* ---------- Snake (clásico) ----------
   Un tic cada `interval()` segundos de juego, y antes de cada tic, los
   giros que entraron en él: el bucle del verificador. Se dibuja como
   snake/game.js: el cuerpo es un trazo redondeado con degradado lima, la
   fruta un melocotón con su hoja, y entre tic y tic la serpiente se
   desliza (se interpola con la posición del tic anterior). Arriba, la
   barra clara de los puntos. */
const LIMA = ["#c1f45a", "#77b83e"];
function reproSnake(p) {
  const giros = Snake.leeGiros(p.g);
  if (!giros || !Snake.SIZES[p.t] || !Snake.SPEED_MULT[p.r]) throw new Error("prueba ilegible");
  let m, j, antes, vista = 0;
  const reset = () => { m = Snake.crear({ mode: p.m, size: p.t, speed: p.r, semilla: p.s }); j = 0; antes = m.snake.map(Snake.copy); };
  const vivo = () => m.state === "playing" && m.ticks < p.n;
  function tic() {
    while (j < giros.length && giros[j].tic === m.ticks) { m.enqueue(giros[j].nombre); j++; }
    if (!vivo()) return false;
    antes = m.snake.map(Snake.copy);
    m.tick();
    m.ev.length = 0;
    return true;
  }
  reset();
  while (tic());
  const dur = Math.round(m.gameTime * 1000);
  reset();
  function en(ms) {
    if (ms < m.gameTime * 1000 - 0.5) reset();
    while (vivo() && (m.gameTime + m.interval()) * 1000 <= ms + 0.5) tic();
    if (ms >= dur) while (tic());
    vista = ms;
  }
  const { cols: COLS, rows: ROWS } = Snake.SIZES[p.t];
  const BARRA = 2.6;   // la barra de puntos, en celdas
  function fruta(ctx, q, c, reloj, dorada) {
    const x = (q.x + 0.5) * c, y = (q.y + 0.5) * c, pulso = 1 + Math.sin(reloj * 3 + q.x) * 0.05;
    ctx.save(); ctx.translate(x, y); ctx.scale(pulso, pulso);
    ctx.shadowColor = dorada ? "#f7d776" : "#ed997a"; ctx.shadowBlur = c * (dorada ? 0.6 : 0.28);
    relleno(ctx, -c * 0.29, -c * 0.24, c * 0.58, c * 0.53, c * 0.2, dorada ? "#f5ce6f" : "#ee987b");
    ctx.shadowBlur = 0;
    ctx.save(); ctx.rotate(-0.55); relleno(ctx, c * 0.01, -c * 0.42, c * 0.25, c * 0.1, c * 0.05, dorada ? "#fff1b6" : "#a8c47b"); ctx.restore();
    relleno(ctx, -c * 0.18, -c * 0.13, c * 0.07, c * 0.17, c * 0.035, "#ffffff60");
    ctx.restore();
  }
  function serpiente(ctx, puntos, rumbo, c, alfa) {
    if (!puntos.length) return;
    ctx.save(); ctx.globalAlpha = alfa;
    const g = ctx.createLinearGradient(0, ROWS * c, COLS * c, 0);
    g.addColorStop(0, LIMA[1]); g.addColorStop(1, LIMA[0]);
    ctx.strokeStyle = g; ctx.lineWidth = c * 0.71; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.shadowColor = LIMA[0] + "35"; ctx.shadowBlur = c * 0.5;
    ctx.beginPath();
    for (let i = puntos.length - 1; i >= 0; i--) {
      const q = puntos[i], sig = puntos[i + 1];
      if (!sig || Math.abs(sig.x - q.x) + Math.abs(sig.y - q.y) > 1.8) ctx.moveTo((q.x + 0.5) * c, (q.y + 0.5) * c);
      else ctx.lineTo((q.x + 0.5) * c, (q.y + 0.5) * c);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    for (let i = 0; i < puntos.length; i++) {
      const sig = puntos[i + 1];
      if (i === 0 || i === puntos.length - 1 || (sig && Math.abs(puntos[i].x - sig.x) + Math.abs(puntos[i].y - sig.y) > 1.8)) circulo(ctx, (puntos[i].x + 0.5) * c, (puntos[i].y + 0.5) * c, c * 0.35, g);
    }
    const cab = puntos[0], hx = (cab.x + 0.5) * c, hy = (cab.y + 0.5) * c;
    circulo(ctx, hx, hy, c * 0.385, LIMA[0]);
    const qx = -rumbo.y, qy = rumbo.x;
    for (const lado of [-1, 1]) {
      const ex = hx + rumbo.x * c * 0.13 + qx * c * 0.19 * lado, ey = hy + rumbo.y * c * 0.13 + qy * c * 0.19 * lado;
      circulo(ctx, ex, ey, c * 0.115, "#f9ffe9"); circulo(ctx, ex + rumbo.x * c * 0.04, ey + rumbo.y * c * 0.04, c * 0.057, "#203022");
    }
    ctx.restore();
  }
  function pinta(ctx, w, h, reloj = 0) {
    const c = Math.max(2, Math.min(w / COLS, h / (ROWS + BARRA)));
    const bw = COLS * c, bh = ROWS * c, barra = BARRA * c;
    const x0 = Math.round((w - bw) / 2), y0 = Math.round((h - bh - barra) / 2), r = Math.max(4, c * 0.9);
    // La barra de puntos, clara como la del juego.
    relleno(ctx, x0, y0, bw, barra + r, r, "#fafaf4");
    const chico = `700 ${Math.max(6, Math.round(c * 0.5))}px "IBM Plex Sans", sans-serif`;
    texto(ctx, "PUNTOS", x0 + c * 0.9, y0 + barra * 0.34, chico, "#747c6b", "left", "middle");
    texto(ctx, String(m.score).padStart(3, "0"), x0 + c * 0.9, y0 + barra * 0.72, `500 ${Math.max(9, Math.round(c * 1.15))}px "IBM Plex Sans", sans-serif`, "#1f2a1c", "left", "middle");
    const estado = m.state === "playing" ? "EN JUEGO" : "FIN";
    texto(ctx, estado, x0 + bw - c * 0.9, y0 + barra / 2, chico, "#2a3326", "right", "middle");
    circulo(ctx, x0 + bw - c * 1.5 - ctx.measureText(estado).width, y0 + barra / 2, Math.max(1.5, c * 0.13), m.state === "playing" ? "#7ca73e" : "#cf7459");
    // El tablero.
    ctx.save();
    ctx.translate(x0, y0 + barra);
    redondo(ctx, 0, 0, bw, bh, [0, 0, r, r]); ctx.clip();
    ctx.fillStyle = "#17271e"; ctx.fillRect(0, 0, bw, bh);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if ((x + y) % 2 === 0) { ctx.fillStyle = "#ffffff02"; ctx.fillRect(x * c, y * c, c, c); }
      circulo(ctx, (x + 0.5) * c, (y + 0.5) * c, Math.max(0.4, c * 0.05), "#7b967922");
    }
    const vi = ctx.createRadialGradient(bw / 2, bh / 2, bw * 0.1, bw / 2, bh / 2, bw * 0.65);
    vi.addColorStop(0, "#00000000"); vi.addColorStop(1, "#07160c45"); ctx.fillStyle = vi; ctx.fillRect(0, 0, bw, bh);
    if (c >= 9) texto(ctx, "01 / CLÁSICO · " + p.t.toUpperCase(), c * 0.9, c * 0.9, `500 ${Math.max(6, Math.round(c * 0.42))}px "IBM Plex Sans", sans-serif`, "#7d917e", "left", "middle");
    for (const o of m.obstacles) {
      relleno(ctx, (o.x + 0.13) * c, (o.y + 0.13) * c, c * 0.74, c * 0.74, c * 0.16, "#63745a");
      relleno(ctx, (o.x + 0.24) * c, (o.y + 0.24) * c, c * 0.52, c * 0.11, c * 0.04, "#829375");
    }
    if (m.fruit) fruta(ctx, m.fruit, c, reloj, false);
    if (m.bonus) fruta(ctx, m.bonus, c, reloj, true);
    // Entre tic y tic, el cuerpo se desliza desde donde estaba.
    const alfa = m.state === "playing" ? Math.max(0, Math.min(1, (vista - m.gameTime * 1000) / (m.interval() * 1000))) : 1;
    const puntos = m.snake.map((q, i) => {
      const a = antes[Math.min(i, antes.length - 1)] || q;
      if (m.state !== "playing" || Math.abs(a.x - q.x) + Math.abs(a.y - q.y) > 1.8) return q;
      return { x: a.x + (q.x - a.x) * alfa, y: a.y + (q.y - a.y) * alfa };
    });
    serpiente(ctx, puntos, m.direction, c, m.state === "playing" ? 1 : 0.6);
    ctx.restore();
  }
  return {
    dur, aspecto: (ROWS + BARRA) / COLS, en, pinta,
    get fin() { return m.state !== "playing"; },
    marcador: () => ({ puntos: m.score, tiempo: m.gameTime * 1000, extra: `${m.eaten} fruta${m.eaten === 1 ? "" : "s"} · largo ${m.snake.length}` })
  };
}

/* ---------- sortEm ----------
   Cada tecla en su instante (la suma de los `t`), aplicada con el motor
   puro; las autorrepeticiones (minúsculas) cuentan igual que en el
   verificador. La escena es la de sortem/game.js en su sistema de 800 de
   ancho: fondo morado, «Time:» en cian con borde rosa, los bloques
   (oscuros, el elegido morado, el agarrado rosa, los fundidos con borde
   verde) y la cuadrícula en perspectiva que cambia de color. */
const SE = { fondo: "#1a0a2e", rosa: "#ff006e", morado: "#8338ec", cian: "#00f5ff", amarillo: "#fbbf24", verde: "#10b981", oscuro: "#2d1b4e" };
const SE_MEDIDA = { 10: { w: 72, s: 14, f: 48 }, 20: { w: 40, s: 6, f: 28 } };
/* Lo que se ve de la escena de 800 × 600: el «Time:», los bloques y el
   arranque del suelo; el resto es aire que en el riel solo achicaría los
   números. */
const SE_X0 = 30, SE_ANCHO = 740, SE_Y0 = 32, SE_ALTO = 478;
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
  function cuadricula(ctx, reloj) {
    const t = reloj * 20, fase = (reloj / 2) % 1;
    ctx.strokeStyle = fase < 0.33 ? SE.rosa : fase < 0.66 ? SE.cian : SE.morado;
    // Líneas de barrido arriba.
    ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
    for (let k = 0; k < 15; k++) { const y = k * 8 + (t % 8); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }
    // Rombos que flotan.
    ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      const x = 50 + k * 110, y = 30 + Math.sin(t / 20 + k * 2) * 20, rot = (t / 30 + k) % (Math.PI * 2), r = 15 + k * 4;
      ctx.beginPath();
      for (let q = 0; q < 4; q++) { const a = rot + q * Math.PI / 2, fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r; if (q) ctx.lineTo(fx, fy); else ctx.moveTo(fx, fy); }
      ctx.closePath(); ctx.stroke();
    }
    // El suelo en perspectiva.
    const gy = 420;
    for (let k = 0; k < 10; k++) {
      const off = (t + k * 20) % 200, y = gy + off, esc = 1 - off / 400;
      if (esc <= 0.1) continue;
      const ola = Math.sin(t / 10 + k) * 15 * esc;
      ctx.globalAlpha = 0.2 + esc * 0.4; ctx.lineWidth = 1 + esc * 3;
      ctx.beginPath(); ctx.moveTo(400 - 450 * esc + ola, y); ctx.lineTo(400 + 450 * esc + ola, y); ctx.stroke();
    }
    ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
    for (let k = -10; k <= 10; k++) {
      const brillo = Math.sin(t / 15 + k) * 10;
      ctx.beginPath(); ctx.moveTo(400 + k * 50 + brillo, gy); ctx.lineTo(400 + k * 20, gy + 200); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function pinta(ctx, w, h, reloj = 0) {
    const esc = Math.min(w / SE_ANCHO, h / SE_ALTO), ew = SE_ANCHO * esc, eh = SE_ALTO * esc;
    ctx.save();
    ctx.translate((w - ew) / 2, (h - eh) / 2);
    redondo(ctx, 0, 0, ew, eh, 8); ctx.clip();
    ctx.scale(esc, esc);
    ctx.translate(-SE_X0, -SE_Y0);
    ctx.fillStyle = SE.fondo; ctx.fillRect(SE_X0, SE_Y0, SE_ANCHO, SE_ALTO);
    cuadricula(ctx, reloj);
    // El cronómetro, como en el juego.
    const rotulo = `Time: ${(Math.min(ahora, dur) / 1000).toFixed(1)}s`;
    ctx.font = "bold 56px 'Courier New', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.lineWidth = 6; ctx.strokeStyle = SE.rosa; ctx.strokeText(rotulo, 400, 80);
    ctx.fillStyle = e.ganado ? SE.amarillo : SE.cian; ctx.fillText(rotulo, 400, 80);
    // Los bloques.
    const { w: bw, s: sp, f } = SE_MEDIDA[p.n];
    let x = (800 - (p.n * bw + (p.n - 1) * sp)) / 2;
    const y = 300, alto = 80;
    ctx.font = `bold ${f}px 'Courier New', monospace`;
    e.bloques.forEach((b, k) => {
      const sel = k === e.sel && !e.ganado, agarra = sel && e.agarrado;
      const ancho = bw * b.length + sp * (b.length - 1);
      ctx.fillStyle = SE.morado + "66"; ctx.fillRect(x + 3, y + 3, ancho, alto);
      ctx.fillStyle = agarra ? SE.rosa : sel ? SE.morado : SE.oscuro; ctx.fillRect(x, y, ancho, alto);
      ctx.fillStyle = SE.cian + "33"; ctx.fillRect(x + 2, y + 2, ancho - 4, 4);
      ctx.lineWidth = sel ? 4 : 3; ctx.strokeStyle = agarra ? SE.cian : sel ? SE.rosa : SE.morado; ctx.strokeRect(x, y, ancho, alto);
      if (agarra) { ctx.globalAlpha = Math.sin(reloj * 6.7) * 0.3 + 0.5; ctx.lineWidth = 6; ctx.strokeStyle = SE.cian; ctx.strokeRect(x - 3, y - 3, ancho + 6, alto + 6); ctx.globalAlpha = 1; }
      if (b.length > 1) { ctx.globalAlpha = 0.7; ctx.lineWidth = 3; ctx.strokeStyle = SE.verde; ctx.strokeRect(x + 4, y + 4, ancho - 8, alto - 8); ctx.globalAlpha = 1; }
      b.forEach((v, q) => {
        const tx = x + bw / 2 + q * (bw + sp), ty = y + 40;
        ctx.lineWidth = 2; ctx.strokeStyle = SE.rosa; ctx.strokeText(String(v), tx, ty);
        ctx.fillStyle = SE.cian; ctx.fillText(String(v), tx, ty);
      });
      x += ancho + sp;
    });
    ctx.restore();
  }
  return {
    dur, aspecto: SE_ALTO / SE_ANCHO, en, pinta,
    get fin() { return e.ganado; },
    marcador: () => ({ puntos: p.n, tiempo: Math.min(ahora, dur), extra: `${e.bloques.length} bloque${e.bloques.length === 1 ? "" : "s"}` })
  };
}

/* ---------- Mina Club (medio) ----------
   Cada jugada en el instante del reloj del marcador (la suma de los
   msJuego); las pausas (código −1) no ocupan tiempo. Se dibuja como el
   jardín de minas/style.css: casillas verdes en damero, las abiertas
   color arena, los números en sus colores, la bandera naranja y el marco
   verde con su sombra; arriba, la barra de banderas y tiempo. */
const MN = {
  verde: "#a9cc76", verde2: "#a0c46c", arena: "#e8e5cd", arena2: "#e1dfc5", marco: "#789a54", sombra: "#648449",
  bandera: "#db795c", num: ["", "#477ca7", "#55894e", "#cf7459", "#8c73b8", "#b9983f", "#478f92", "#a95b8b", "#526052"]
};
/* Los iconos del juego (los <symbol> de minas/index.html), en 24 × 24. */
function bandera(ctx, x, y, t, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(t / 24, t / 24);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = "round";
  ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(6, 21); ctx.lineTo(6, 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7, 3); ctx.lineTo(20, 3); ctx.lineTo(16, 8); ctx.lineTo(20, 13); ctx.lineTo(7, 13); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(3, 21); ctx.lineTo(10, 21); ctx.stroke();
  ctx.restore();
}
function cronometro(ctx, x, y, t, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(t / 24, t / 24);
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(12, 13, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12, 8); ctx.lineTo(12, 13); ctx.lineTo(15, 15); ctx.moveTo(9, 2); ctx.lineTo(15, 2); ctx.stroke();
  ctx.restore();
}
function reproMinas(p) {
  const e = p.e, CAMPOS = 6;
  if (!Array.isArray(e) || !e.length || e.length % CAMPOS || !Mina.LEVELS[p.n]) throw new Error("prueba ilegible");
  const inst = [];
  let acc = 0;
  for (let k = 0; k < e.length; k += CAMPOS) inst.push(acc += Math.max(0, Number(e[k + 1]) || 0));
  const dur = acc;
  let g, i, ahora;
  const reset = () => { g = new Mina.Game(p.n, Mina.azar(p.s)); i = 0; ahora = 0; };
  reset();
  function en(ms) {
    if (ms < ahora) reset();
    while (i < inst.length && inst[i] <= ms) {
      const c = e[i * CAMPOS];
      if (c >= 0) { const celda = c >> 1; if (c & 1) g.flag(celda); else g.open(celda); }
      i++;
    }
    ahora = ms;
  }
  const { cols, rows } = Mina.LEVELS[p.n];
  const BARRA = 2.4, MARCO = 0.3, HUECO = 0.4, SOMBRA = 0.3;
  function pinta(ctx, w, h) {
    const c = Math.max(3, Math.floor(Math.min(w / (cols + 2 * MARCO), h / (rows + 2 * MARCO + BARRA + HUECO + SOMBRA))));
    const fw = (cols + 2 * MARCO) * c, fh = (rows + 2 * MARCO) * c, barra = BARRA * c;
    const x0 = Math.round((w - fw) / 2), y0 = Math.round((h - fh - barra - (HUECO + SOMBRA) * c) / 2);
    // La barra de banderas y tiempo.
    const rb = Math.max(4, c * 0.6);
    relleno(ctx, x0, y0, fw, barra, rb, "#fbfcf6");
    ctx.strokeStyle = "#e0e5d9"; ctx.lineWidth = 1; redondo(ctx, x0 + 0.5, y0 + 0.5, fw - 1, barra - 1, rb); ctx.stroke();
    const ic = c * 1.1, my = y0 + barra / 2, num = `500 ${Math.max(9, Math.round(c * 1.05))}px "IBM Plex Sans", sans-serif`;
    bandera(ctx, x0 + c * 0.7, my - ic / 2, ic, "#e19b60");
    texto(ctx, String(g.state === "won" ? 0 : g.mines - g.flags), x0 + c * 2, my + 0.5, num, "#253c30", "left", "middle");
    cronometro(ctx, x0 + c * 5, my - ic / 2, ic, "#92a28a");
    texto(ctx, mmss(Math.min(ahora, dur)), x0 + c * 6.3, my + 0.5, num, "#253c30", "left", "middle");
    // El tablero, con su marco verde y la sombra de abajo.
    const ty = y0 + barra + HUECO * c, r = Math.max(3, c * 0.45);
    relleno(ctx, x0, ty + SOMBRA * c, fw, fh, r, MN.sombra);
    relleno(ctx, x0, ty, fw, fh, r, MN.marco);
    const bx = x0 + MARCO * c, by = ty + MARCO * c;
    ctx.save();
    redondo(ctx, bx, by, cols * c, rows * c, Math.max(2, r * 0.5)); ctx.clip();
    const fuente = `650 ${Math.max(6, Math.round(c * 0.62))}px "IBM Plex Sans", sans-serif`;
    const gano = g.state === "won";
    for (let k = 0; k < g.cells.length; k++) {
      const q = g.cells[k], cx = k % cols, cy = Math.floor(k / cols), x = bx + cx * c, y = by + cy * c, impar = (cx + cy) % 2;
      if (q.open && q.mine) {
        ctx.fillStyle = k === g.exploded ? "#e68b70" : "#f4b58d"; ctx.fillRect(x, y, c, c);
        circulo(ctx, x + c / 2, y + c / 2, c * 0.22, k === g.exploded ? "#fff2d7" : "#7e443c");
      } else if (q.open) {
        ctx.fillStyle = impar ? MN.arena2 : MN.arena; ctx.fillRect(x, y, c, c);
        if (q.count && c >= 6) texto(ctx, String(q.count), x + c / 2, y + c / 2 + 0.5, fuente, MN.num[q.count], "center", "middle");
      } else {
        ctx.fillStyle = impar ? MN.verde2 : MN.verde; ctx.fillRect(x, y, c, c);
        ctx.fillStyle = "#72944716"; ctx.fillRect(x, y + c - Math.max(1, c * 0.08), c, Math.max(1, c * 0.08));
        if (q.flag || (gano && q.mine)) bandera(ctx, x + c * 0.245, y + c * 0.245, c * 0.51, MN.bandera);
      }
    }
    ctx.restore();
  }
  return {
    dur, aspecto: (rows + 2 * MARCO + BARRA + HUECO + SOMBRA) / (cols + 2 * MARCO), en, pinta,
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
