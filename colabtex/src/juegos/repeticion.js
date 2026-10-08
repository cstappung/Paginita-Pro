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
import Dosmil from "../../../juegos/club/dosmil/motor.js";
import Aleteo from "../../../juegos/club/aleteo/motor.js";
import AleteoLore from "../../../juegos/club/aleteo/lore.js";
import Bbtan from "../../../juegos/club/bbtan/motor.js";

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
/* El número y el nombre de cada modo (snake/game.js: MODES) y los poderes del arcade. */
const SN_MODO = { classic: "01 / CLÁSICO", arcade: "02 / ARCADE", portals: "03 / PORTALES", reloj: "04 / CONTRARRELOJ", espejo: "05 / ESPEJO", laberinto: "06 / LABERINTO", zen: "07 / ZEN" };
const SN_PODER = { shield: ["◇", "#80dbef"], slow: ["◷", "#b6a0fa"], double: ["×2", "#f5cd72"] };
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
    const estado = m.state !== "playing" ? "FIN" : p.m === "reloj" ? `${Math.ceil(Math.max(0, m.timeLeft))} S` : m.mirrored ? "ESPEJO" : "EN JUEGO";
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
    if (c >= 9) texto(ctx, (SN_MODO[p.m] || "01 / CLÁSICO") + " · " + p.t.toUpperCase(), c * 0.9, c * 0.9, `500 ${Math.max(6, Math.round(c * 0.42))}px "IBM Plex Sans", sans-serif`, "#7d917e", "left", "middle");
    for (const o of m.obstacles) {
      relleno(ctx, (o.x + 0.13) * c, (o.y + 0.13) * c, c * 0.74, c * 0.74, c * 0.16, "#63745a");
      relleno(ctx, (o.x + 0.24) * c, (o.y + 0.24) * c, c * 0.52, c * 0.11, c * 0.04, "#829375");
    }
    // Los portales (anillos que giran) y el poder del arcade, como en el juego.
    (m.portals || []).forEach((q, i) => {
      const color = i ? "#80d7c4" : "#b1a1f4";
      ctx.save(); ctx.translate((q.x + 0.5) * c, (q.y + 0.5) * c); ctx.rotate(reloj * (i ? 1 : -1));
      ctx.shadowColor = color; ctx.shadowBlur = c * 0.55; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, c * 0.08);
      ctx.beginPath(); ctx.ellipse(0, 0, c * 0.43, c * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
    if (m.pickup && SN_PODER[m.pickup.type]) {
      const [icono, color] = SN_PODER[m.pickup.type], x = (m.pickup.x + 0.5) * c, y = (m.pickup.y + 0.5) * c;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.shadowColor = color; ctx.shadowBlur = c * 0.4;
      relleno(ctx, -c * 0.31, -c * 0.31, c * 0.62, c * 0.62, c * 0.12, color); ctx.restore();
      if (c >= 7) texto(ctx, icono, x, y + 1, `bold ${Math.round(c * 0.4)}px Arial`, "#1e3028", "center", "middle");
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

/* ---------- 2048 (puntos) ----------
   Cada jugada en su instante (la suma de los Δms de la prueba), como
   `DosmilMotor.rehace`. Se dibuja como dosmil/estilo.css: el panel arena
   con sus casillas, las fichas en sus colores (de la 128 a la 2048 con su
   brillo dorado) y, arriba, la barra de puntos y ficha más alta. Cada
   jugada se ve deslizarse (los `movs` del motor) y la ficha nueva y las
   fusiones crecen un poco al llegar. En unidades del tablero: 100 de lado,
   casillas de 21,25 cada 24,25 desde 3, como el `cqw` del juego. */
const DM_FICHA = ["#cdc1b4", "#eee4da", "#ede0c8", "#f2b179", "#f59563", "#f67c5f", "#f65e3b", "#edcf72", "#edcc61", "#edc850",
  "#edc53f", "#edc22e", "#b784d6", "#9b5fc2", "#7a3fae", "#3c6fd1", "#2450a8", "#1d2f63"];
const DM = { panel: "#bbada0", dato: "#a39383", rotulo: "#eee4da", oscuro: "#776e65", claro: "#f9f6f2", cartel: '"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif' };
const DM_DESLIZ = 110, DM_CRECE = 170, DM_BARRA = 18, DM_HUECO = 4;
function reproDosmil(p) {
  const jugadas = Dosmil.decodifica(p.f);
  if (!jugadas || !jugadas.length || typeof p.u !== "string" || !Number.isSafeInteger(p.s)) throw new Error("prueba ilegible");
  const instantes = [];
  let total = 0;
  for (const j of jugadas) { total += j[2]; instantes.push(total); }
  let E, k, ultima, ahora = 0;
  const reset = () => { E = Dosmil.nueva(p.s, p.u); k = 0; ultima = null; };
  reset();
  function en(ms) {
    if (k > 0 && instantes[k - 1] > ms) reset();
    while (k < jugadas.length && instantes[k] <= ms) {
      const r = Dosmil.mueve(E, jugadas[k][0]);
      if (!r) throw new Error("jugada que no mueve");
      ultima = { r, at: instantes[k] };
      k++;
    }
    ahora = ms;
  }
  const casilla = i => ({ x: 3 + (i % 4) * 24.25, y: 3 + Math.floor(i / 4) * 24.25 });
  function ficha(ctx, u, x0, y0, x, y, e, escala) {
    const t = 21.25 * escala, cx = x0 + (x + 10.625) * u, cy = y0 + (y + 10.625) * u;
    ctx.save();
    if (e >= 7 && e <= 11) { ctx.shadowColor = "#f3d77488"; ctx.shadowBlur = (2 + (e - 7) * 0.6) * u; }
    relleno(ctx, cx - t * u / 2, cy - t * u / 2, t * u, t * u, 1.4 * u, DM_FICHA[Math.min(e, DM_FICHA.length - 1)]);
    ctx.restore();
    const v = String(2 ** e), tam = (v.length <= 2 ? 9.5 : v.length === 3 ? 8 : v.length === 4 ? 6.4 : 5) * escala;
    texto(ctx, v, cx, cy + 0.4 * u, `400 ${Math.max(5, tam * u)}px ${DM.cartel}`, e <= 2 ? DM.oscuro : DM.claro, "center", "middle");
  }
  function pinta(ctx, w, h) {
    const alto = 100 + DM_BARRA + DM_HUECO, u = Math.min(w / 100, h / alto);
    const x0 = (w - 100 * u) / 2, y0 = (h - alto * u) / 2, yb = y0 + (DM_BARRA + DM_HUECO) * u;
    // La barra: puntos y ficha más alta, en las cajitas del marcador.
    relleno(ctx, x0, y0, 100 * u, DM_BARRA * u, 3 * u, DM.panel);
    [["PUNTOS", E.puntos.toLocaleString("es-CL")], ["FICHA", String(Dosmil.valor(E.max))]].forEach(([n, v], j) => {
      const bx = x0 + (2 + j * 49) * u;
      relleno(ctx, bx, y0 + 2 * u, 47 * u, (DM_BARRA - 4) * u, 2 * u, DM.dato);
      if (u >= 1.6) texto(ctx, n, bx + 23.5 * u, y0 + 6 * u, `800 ${3.2 * u}px system-ui, sans-serif`, DM.rotulo, "center", "middle");
      texto(ctx, v, bx + 23.5 * u, y0 + (u >= 1.6 ? 11.6 : 9) * u, `400 ${Math.max(7, 6.4 * u)}px ${DM.cartel}`, "#fff", "center", "middle");
    });
    // El tablero y sus casillas vacías.
    relleno(ctx, x0, yb, 100 * u, 100 * u, 3 * u, DM.panel);
    for (let i = 0; i < 16; i++) { const c = casilla(i); relleno(ctx, x0 + c.x * u, yb + c.y * u, 21.25 * u, 21.25 * u, 1.4 * u, DM_FICHA[0]); }
    const dt = ultima ? ahora - ultima.at : Infinity;
    if (dt < DM_DESLIZ) {
      // A medio deslizar: cada ficha va de su casilla de antes a la de ahora.
      const f = dt / DM_DESLIZ, a = 1 - (1 - f) * (1 - f);
      for (const [desde, hasta, e] of ultima.r.movs) {
        const c0 = casilla(desde), c1 = casilla(hasta);
        ficha(ctx, u, x0, yb, c0.x + (c1.x - c0.x) * a, c0.y + (c1.y - c0.y) * a, e, 1);
      }
      return;
    }
    const crece = dt - DM_DESLIZ < DM_CRECE ? (dt - DM_DESLIZ) / DM_CRECE : 1;
    for (let i = 0; i < 16; i++) {
      const e = E.t[i];
      if (!e) continue;
      let escala = 1;
      if (crece < 1 && ultima) {
        if (ultima.r.nueva && ultima.r.nueva.i === i) escala = 0.3 + 0.7 * crece;
        else if (ultima.r.fusiones.includes(i)) escala = 1 + 0.12 * Math.sin(crece * Math.PI);
      }
      const c = casilla(i);
      ficha(ctx, u, x0, yb, c.x, c.y, e, escala);
    }
  }
  return {
    dur: total, aspecto: (100 + DM_BARRA + DM_HUECO) / 100, en, pinta,
    get fin() { return k === jugadas.length; },
    marcador: () => ({ puntos: E.puntos, tiempo: Math.min(ahora, total), extra: `ficha ${Dosmil.valor(E.max)} · ${E.jugadas} jugadas` })
  };
}

/* ---------- ALETEO ----------
   Un tick cada 1/60 s y, antes de cada uno, el aleteo que cayó en él: el
   bucle de `AleteoMotor.rehace`. Entre tick y tick, el pájaro y los tubos
   se deslizan (la fracción del tick siguiente). Se dibuja como
   aleteo/juego.js, simplificado: el cielo, las nubes, los tubos con su
   labio, el suelo rayado, el pájaro con su ala en tres posiciones y el
   número grande arriba; los colores salen de `AleteoLore.paleta` con los
   tubos pasados, así que el cielo se va oscureciendo como en el juego. */
const AL_NUBES = [{ x: 30, y: 120, s: 1 }, { x: 210, y: 70, s: 0.8 }, { x: 330, y: 170, s: 1.15 }, { x: 470, y: 105, s: 0.9 }];
function reproAleteo(p) {
  const aleteos = Aleteo.decodifica(p.f), n = p.n;
  if (!aleteos || !aleteos.length || aleteos[0][0] !== 0 || !Number.isSafeInteger(n) || n < 1 || n > 2e6 || typeof p.u !== "string") throw new Error("prueba ilegible");
  const dur = Aleteo.msDe(n);
  let E, i, antesY, frac = 0;
  const reset = () => { E = Aleteo.nueva(p.s, p.u); i = 0; antesY = E.y; };
  reset();
  function en(ms) {
    const meta = ms >= dur ? n : Math.min(n, Math.floor(ms * 0.06));
    if (meta < E.t) reset();
    while (E.t < meta && !E.muerto) {
      let a = false;
      while (i < aleteos.length && aleteos[i][0] === E.t) { a = true; i++; }
      antesY = E.y;
      Aleteo.paso(E, a);
    }
    frac = E.muerto ? 1 : Math.min(1, Math.max(0, ms * 0.06 - E.t + 1));
  }
  const { W, H, SUELO, TW, PX, VEL } = Aleteo;
  function tubo(ctx, pal, x, tb) {
    if (x > W + 10 || x + TW < -10) return;
    const arriba = tb.c - tb.g / 2, abajo = tb.c + tb.g / 2;
    for (const [y0, y1, labio] of [[-20, arriba, arriba], [abajo, SUELO, abajo]]) {
      const g = ctx.createLinearGradient(x, 0, x + TW, 0);
      g.addColorStop(0, pal.tuboSombra); g.addColorStop(0.22, pal.tubo); g.addColorStop(0.38, pal.tuboLuz); g.addColorStop(0.55, pal.tubo); g.addColorStop(1, pal.tuboSombra);
      ctx.fillStyle = g; ctx.fillRect(x + 3, y0, TW - 6, y1 - y0);
      ctx.strokeStyle = pal.borde; ctx.lineWidth = 3; ctx.strokeRect(x + 3, y0, TW - 6, y1 - y0);
      const ly = labio === arriba ? labio - 26 : labio;
      ctx.fillStyle = g; ctx.fillRect(x - 4, ly, TW + 8, 26); ctx.strokeRect(x - 4, ly, TW + 8, 26);
    }
  }
  function pajaro(ctx, pal, y, rot, fase) {
    ctx.save(); ctx.translate(PX, y); ctx.rotate(rot);
    ctx.lineWidth = 2.2; ctx.strokeStyle = pal.borde === "#000000" ? "#3a3a3a" : "#1b130b";
    const elipse = (x, y, rx, ry, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, r, 0, Math.PI * 2); ctx.fill(); };
    ctx.fillStyle = pal.ala; ctx.beginPath(); ctx.moveTo(-13, -2); ctx.lineTo(-22, -7); ctx.lineTo(-21, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    elipse(0, 0, 15, 12, 0, pal.pajaro); ctx.stroke();
    elipse(3, 5, 9, 5.5, 0.1, pal.vientre);
    elipse(-4, [-7, 0, 6][fase], 8, 5, [-0.6, 0, 0.55][fase], pal.ala); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(7, -5, 5.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    circulo(ctx, 8.6, -5, 2.4, pal.ojo);
    ctx.fillStyle = pal.pico;
    ctx.beginPath(); ctx.moveTo(10, -1); ctx.lineTo(21, 1); ctx.lineTo(10, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 3.5); ctx.lineTo(18, 5); ctx.lineTo(10, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function pinta(ctx, w, h, reloj) {
    const k = Math.min(w / W, h / H), t = E.t - 1 + frac;
    const prox = Aleteo.proximo(E), avance = prox ? Math.max(0, Math.min(0.99, 1 - (prox.x + TW / 2 - PX) / Aleteo.SEP)) : 0;
    const pal = AleteoLore.paleta(AleteoLore.corrupcion(E.puntos + avance));
    ctx.save();
    ctx.translate((w - W * k) / 2, (h - H * k) / 2); ctx.scale(k, k);
    redondo(ctx, 0, 0, W, H, 14); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, SUELO);
    g.addColorStop(0, pal.cieloA); g.addColorStop(1, pal.cieloB);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, SUELO);
    const s = VEL * Math.max(0, t), vuelta = W + 260;
    ctx.fillStyle = pal.nube; ctx.globalAlpha = 0.85;
    for (const nb of AL_NUBES) {
      const x = ((nb.x - s * 0.12) % vuelta + vuelta) % vuelta - 130, y = nb.y, q = nb.s;
      ctx.beginPath();
      ctx.arc(x, y, 18 * q, 0, 6.29); ctx.arc(x + 22 * q, y - 10 * q, 22 * q, 0, 6.29);
      ctx.arc(x + 48 * q, y - 2 * q, 17 * q, 0, 6.29); ctx.arc(x + 26 * q, y + 6 * q, 18 * q, 0, 6.29);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const tb of E.tubos) tubo(ctx, pal, Aleteo.X0 + tb.k * Aleteo.SEP - VEL * t, tb);
    // El suelo, rayado y corriendo con el mundo.
    ctx.fillStyle = pal.suelo; ctx.fillRect(0, SUELO, W, H - SUELO);
    ctx.fillStyle = pal.sueloTop; ctx.fillRect(0, SUELO, W, 16);
    ctx.save(); ctx.beginPath(); ctx.rect(0, SUELO, W, 16); ctx.clip();
    ctx.fillStyle = "rgba(0,0,0,.14)";
    for (let x = -24 - s % 24; x < W + 24; x += 24) { ctx.beginPath(); ctx.moveTo(x, SUELO + 16); ctx.lineTo(x + 12, SUELO); ctx.lineTo(x + 24, SUELO); ctx.lineTo(x + 12, SUELO + 16); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = pal.borde; ctx.fillRect(0, SUELO - 2, W, 3); ctx.fillRect(0, SUELO + 16, W, 2);
    // El pájaro: cabecea según su velocidad, como en el juego.
    const y = E.muerto ? E.y : antesY + (E.y - antesY) * frac, vy = E.vy;
    const rot = E.muerto ? 1.2 : vy < 0 ? -0.42 : Math.max(-0.42, Math.min(1.45, -0.42 + (vy - 1) * 0.2));
    const fase = E.muerto ? 1 : Math.floor(((reloj || 0) * (vy < 0 ? 26 : 12)) % 3);
    pajaro(ctx, pal, y, rot, fase);
    // Los tubos pasados, grandes y con borde, arriba al centro.
    ctx.font = '400 54px "Lilita One", system-ui, sans-serif'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.lineWidth = 9; ctx.strokeStyle = "#1b2a3d";
    ctx.strokeText(String(E.puntos), W / 2, 74); ctx.fillStyle = "#ffffff"; ctx.fillText(String(E.puntos), W / 2, 74);
    ctx.restore();
  }
  return {
    dur, aspecto: H / W, en, pinta,
    get fin() { return E.muerto; },
    marcador: () => ({ puntos: E.puntos, tiempo: Aleteo.msDe(E.t), extra: `${E.aleteos} aleteo${E.aleteos === 1 ? "" : "s"}` })
  };
}

/* ---------- BBTAN (rondas) ----------
   Cada tiro con el mismo motor que `verifica/bbtan.js` (`juegaTiro` paso
   por paso: lanzar, los ticks, recoger a mano si lo hizo, bajar). Tres
   tiempos por ronda:
   - **apuntar**: la línea de puntos hacia el ángulo que eligió. Es lo
     único que no va a la velocidad real: lo que pensó cada tiro (hasta
     minutos) se acorta a `BB_APUNTA_MAX`, o una partida de cien rondas
     sería casi toda un tablero quieto;
   - **el tiro**, a la velocidad sola del juego (`shotPace`: ×1 los
     primeros 5 s y después sube hasta ×4). Si entre ese tiro y el
     siguiente pasó menos (apuró con el botón de velocidad), se reparte
     parejo en el tiempo que de verdad duró;
   - **la bajada** del tablero, `BB_BAJA` ms.
   Para ir hacia atrás (y saltar al final) se guarda una foto del tablero
   antes de cada tiro: rehacer cuatrocientas rondas de física en cada
   vuelta del bucle trabaría el salón. Se dibuja como bbtan/game.js en su
   cielo de siempre: el fondo de puntos, los bloques con su marco de
   píxeles, su vida y su barra, los bonos en sus colores y las bolas. */
const BB = { lima: "#c4f568", morado: "#b7a1f7", naranja: "#ffa675", cian: "#77d9d2", fondo: "#141719", puntos: "#2a2e2f", suelo: "#4b5142", bola: "#f6ffe9", texto: "#a9b699" };
const BB_APUNTA_MAX = 1500, BB_APUNTA_MIN = 350, BB_BAJA = 400;
const bbColor = b => b.reinforced || b.max >= 24 ? BB.naranja : b.max >= 14 ? BB.morado : b.max >= 8 ? BB.cian : BB.lima;
const bbItem = p => p.kind === "ball" ? BB.lima : p.kind === "laser-h" ? BB.morado : p.kind === "laser-v" ? BB.cian : BB.naranja;
/* Los ticks que corrieron `s` segundos después de lanzar, a la velocidad
   sola del juego (la integral de `shotPace`), y su inversa. */
const bbTicksEn = s => 60 * (s <= 5 ? s : s <= 14.375 ? 5 + (s - 5) + 0.16 * (s - 5) ** 2 : 28.4375 + 4 * (s - 14.375));
function bbSegundos(k) {
  const x = k / 60;
  if (x <= 5) return x;
  if (x <= 28.4375) return 5 + (-1 + Math.sqrt(1 + 0.64 * (x - 5))) / 0.32;
  return 14.375 + (x - 28.4375) / 4;
}
function reproBbtan(p) {
  const tiros = p && typeof p.u === "string" && Number.isInteger(p.s) ? Bbtan.decodifica(p.t) : null;
  if (!tiros || !tiros.length) throw new Error("prueba ilegible");
  const foto = E => ({ round: E.round, count: E.count, score: E.score, launchX: E.launchX, idSeq: E.idSeq,
    blocks: E.blocks.map(b => Object.assign({}, b)), pickups: E.pickups.map(q => ({ x: q.x, y: q.y, kind: q.kind, alive: q.alive })) });
  const revela = f => {
    const E = Bbtan.nueva(p.s, p.u);
    Object.assign(E, { round: f.round, count: f.count, score: f.score, launchX: f.launchX, idSeq: f.idSeq,
      blocks: f.blocks.map(b => Object.assign({}, b)), pickups: f.pickups.map(q => Object.assign({}, q)) });
    E._celdas = null;
    return E;
  };
  // Primera pasada: la foto antes de cada tiro, cuántos ticks duró y el horario de la repetición.
  const plan = [];
  let E = Bbtan.nueva(p.s, p.u), reloj = 0;
  for (let i = 0; i < tiros.length; i++) {
    const f = foto(E), ticks = Bbtan.juegaTiro(E, tiros[i]);
    if (typeof ticks !== "number") throw new Error(ticks);
    const natural = bbSegundos(ticks) * 1000;
    const hueco = i + 1 < tiros.length ? tiros[i + 1][1] - tiros[i][1] - BB_BAJA : Infinity;
    const fisica = hueco > 0 && natural > hueco ? hueco : natural;
    const pensado = i ? tiros[i][1] - tiros[i - 1][1] - plan[i - 1].fisica - BB_BAJA : tiros[0][1];
    const apunta = Math.max(BB_APUNTA_MIN, Math.min(BB_APUNTA_MAX, pensado));
    plan.push({ f, tiro: tiros[i], ticks, fisica, natural: fisica === natural, apunta, inicio: reloj });
    reloj += apunta + fisica + BB_BAJA;
  }
  const dur = reloj;
  let ci = -1, ultimoMs = -1, fase = "apunta", baja = 0, ahora = 0, fantasma = null, tirado = false;
  E = null;
  function avanza(pl, k) {
    const t = pl.tiro;
    while (E.state === "shoot") {
      if (t.length > 2 && E.ticks >= t[2]) { Bbtan.recoge(E, true); break; }
      if (E.ticks >= k) break;
      Bbtan.tick(E);
    }
  }
  function en(ms) {
    ms = Math.max(0, Math.min(dur, ms));
    let i = plan.length - 1;
    while (i > 0 && plan[i].inicio > ms) i--;
    if (i !== ci || ms < ultimoMs) { E = revela(plan[i].f); ci = i; fantasma = null; tirado = false; }
    ultimoMs = ahora = ms;
    const pl = plan[i], e = ms - pl.inicio;
    if (e < pl.apunta) { fase = "apunta"; baja = 0; return; }
    if (!tirado) { Bbtan.dispara(E, pl.tiro[0], pl.tiro[1], null, ""); tirado = true; }
    const ef = e - pl.apunta;
    if (ef < pl.fisica) {
      fase = "tiro";
      avanza(pl, Math.min(pl.ticks, Math.floor(pl.natural ? bbTicksEn(ef / 1000) : ef / pl.fisica * pl.ticks)));
      return;
    }
    avanza(pl, pl.ticks);
    fase = "baja";
    baja = ms >= dur ? 1 : Math.min(1, (ef - pl.fisica) / BB_BAJA);
    if (baja >= 1 && i === plan.length - 1) { if (E.state === "descend") Bbtan.baja(E); fase = "fin"; }
  }
  const { W, FLOOR, R } = Bbtan, ALTO = 580;
  function pixelBall(ctx, x, y, r) { x = Math.round(x); y = Math.round(y); ctx.fillRect(x - r + 2, y - r, r * 2 - 4, r * 2); ctx.fillRect(x - r, y - r + 2, r * 2, r * 2 - 4); }
  function marco(ctx, x, y, w, h, color) {
    x = Math.round(x); y = Math.round(y); ctx.fillStyle = color;
    ctx.fillRect(x + 4, y + 1, w - 8, 2); ctx.fillRect(x + 4, y + h - 3, w - 8, 2); ctx.fillRect(x + 1, y + 4, 2, h - 8); ctx.fillRect(x + w - 3, y + 4, 2, h - 8);
    ctx.fillRect(x + 2, y + 2, 2, 2); ctx.fillRect(x + w - 4, y + 2, 2, 2); ctx.fillRect(x + 2, y + h - 4, 2, 2); ctx.fillRect(x + w - 4, y + h - 4, 2, 2);
  }
  // La línea de puntos del tiro que viene, como `drawAim` del juego.
  function mira() {
    if (fantasma) return fantasma;
    const pl = plan[ci], [dx, dy] = Bbtan.direccion(pl.tiro[0]);
    const g = { x: E.launchX, y: FLOOR - 1, vx: dx * Bbtan.VEL, vy: dy * Bbtan.VEL }, pts = [];
    let golpes = 0;
    for (let k = 0; k < 145; k++) {
      const llego = Bbtan.stepBall(E, g, 0.008, () => golpes++, null);
      if (k % 3 === 0) pts.push({ x: g.x, y: g.y });
      if (llego || golpes >= 2) break;
    }
    return (fantasma = pts);
  }
  function pinta(ctx, w, h) {
    const k = Math.min(w / W, h / ALTO);
    ctx.save();
    ctx.translate((w - W * k) / 2, (h - ALTO * k) / 2); ctx.scale(k, k);
    relleno(ctx, 0, 0, W, ALTO, 14, BB.fondo);
    ctx.fillStyle = BB.puntos;
    for (let y = 14; y < FLOOR; y += 19) for (let x = 15; x < W; x += 19) ctx.fillRect(x, y, 1.5, 1.5);
    ctx.strokeStyle = BB.suelo; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(12, FLOOR + 7); ctx.lineTo(W - 12, FLOOR + 7); ctx.stroke(); ctx.setLineDash([]);
    const dy = fase === "baja" ? Bbtan.ROW * (1 - (1 - baja) * (1 - baja)) : 0;
    if (fase === "apunta") {
      const pts = mira(), vis = Math.min(1, (ahora - plan[ci].inicio) / 300);
      ctx.fillStyle = BB.lima;
      pts.forEach((q, j) => { ctx.globalAlpha = ((1 - j / pts.length) * 0.5 + 0.08) * vis; ctx.fillRect(Math.round(q.x) - 1.5, Math.round(q.y) - 1.5, 4, 4); });
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const b of E.blocks) {
      if (b.hp <= 0) continue;
      const color = bbColor(b), y = b.y + dy;
      ctx.fillStyle = color + "22"; ctx.fillRect(b.x + 3, y + 3, b.w - 6, b.h - 6);
      marco(ctx, b.x, y, b.w, b.h, color);
      ctx.fillStyle = color + "55"; ctx.fillRect(b.x + 5, y + b.h - 8, Math.round((b.w - 10) * (b.hp / b.max)), 2);
      ctx.font = `700 ${b.hp > 99 ? 17 : 21}px ui-monospace, "IBM Plex Mono", monospace`;
      ctx.fillStyle = color; ctx.fillText(String(b.hp), b.x + b.w / 2, y + b.h / 2);
    }
    for (const q of E.pickups) {
      if (!q.alive) continue;
      const color = bbItem(q), y = q.y + dy;
      ctx.lineWidth = 1.5; ctx.fillStyle = color + "18"; ctx.beginPath(); ctx.arc(q.x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = color; ctx.stroke();
      ctx.fillStyle = color; ctx.font = `700 ${q.kind === "ball" ? 16 : 17}px ui-monospace, monospace`;
      ctx.fillText(q.kind === "ball" ? "+" : q.kind === "laser-h" ? "↔" : q.kind === "laser-v" ? "↕" : "⁂", q.x, y + 1);
    }
    ctx.fillStyle = BB.bola;
    for (const b of E.balls) pixelBall(ctx, b.x, b.y, R);
    // El lanzador: donde salen las bolas (y adonde volverá la primera).
    if (E.state === "aim" || (E.state === "shoot" && E.queue > 0)) { ctx.fillStyle = BB.lima; pixelBall(ctx, E.launchX, FLOOR - R, R + 1); }
    if (E.nextX !== null && E.state !== "aim") { ctx.fillStyle = BB.lima; pixelBall(ctx, E.nextX, FLOOR - R, R + 1); }
    // Arriba: la ronda y las bolas, como el marcador del juego.
    ctx.font = '700 22px ui-monospace, "IBM Plex Mono", monospace'; ctx.textBaseline = "middle";
    ctx.textAlign = "left"; ctx.fillStyle = BB.lima; ctx.fillText(`RONDA ${E.round}`, 16, 30);
    ctx.textAlign = "right"; ctx.fillStyle = BB.texto; ctx.fillText(`×${E.count}`, W - 16, 30);
    ctx.restore();
  }
  return {
    dur, aspecto: ALTO / W, en, pinta,
    get fin() { return fase === "fin"; },
    marcador: () => ({ puntos: E ? E.round : 1, tiempo: ahora, extra: E ? `${E.count} bola${E.count === 1 ? "" : "s"} · ${E.score.toLocaleString("es-CL")} pts` : "" })
  };
}

const FABRICAS = { tetris: reproTetris, snake: reproSnake, sortem: reproSortem, minas: reproMinas, dosmil: reproDosmil, aleteo: reproAleteo, bbtan: reproBbtan };

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
