/* Pool 8 — la pantalla.
 *
 * El motor (`motor.js`) decide qué pasa con cada tiro; esta pantalla solo
 * lo apunta, lo envía y lo vuelve a ver. Cuatro decisiones:
 *
 * - **Se repite el tiro con la misma simulación del motor.** La partida
 *   guarda el golpe (dirección, fuerza, efecto), no las posiciones. Para
 *   animarlo se parte de `ultima.antes` y se llama a `plPaso` a 600 pasos
 *   por segundo reales, que es exactamente lo que hizo `reducir`, así que
 *   lo que se ve coincide bola por bola con lo que ya se contó. Al acabar
 *   se «encaja» con `est.mesa`: si algo difiriera, manda el estado.
 * - **El dibujo se rehace solo cuando algo se mueve** (`pide()`): sin tiro
 *   en curso ni apuntado, la pantalla no gasta ni un cuadro.
 * - **La orientación de las bolas es solo visual.** Se integra con la
 *   velocidad angular que simula el motor, para que se vea rodar la raya y
 *   girar el número, pero no entra en ninguna regla.
 * - **La línea guía es una opción de la sala** (`guia`): con ella se ve la
 *   bola fantasma, hacia dónde saldrá la bola objetivo y hacia dónde la
 *   blanca. Sin ella solo está el taco. La ayuda es de puntería, no de
 *   reglas: avisa en rojo si el primer contacto sería ilegal.
 */
import {
  PL, PL_BOLSILLOS, PL_FALTAS, plClona, plGolpe, plPaso, plColocaOk, plGrupo
} from "./motor.js";
import { suena } from "./sonido.js";
import {
  MARCO, MUNDO, dibujaMesa, dibujaTaco, pintaBola, sombraBola, oriInicial, rota, colorBola
} from "./pool-vista.js";
import { crearMenuPool } from "./pool-menu.js";
import { TACOS } from "./tacos.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const TACO_MAX = 190;          // cuánto se echa atrás el taco con la fuerza al máximo (mm)
const T_ATRAS = 0.28, T_ADELANTE = 0.12;   // segundos de la animación del taco
const NOMBRE_GRUPO = { s: "Lisas", r: "Rayadas" };

export function crearPool(ctx) {
  const { uid, jugar, terminar } = ctx;
  const mirando = !!ctx.mirando;

  let host = null, muerto = false;
  let p = null, est = null;
  let enviando = false;
  let movsVistos = -1;
  const firmas = {};

  /* — dibujo — */
  let cv = null, g2 = null, capaMesa = null, escala = 1, dpr = 1;
  let spr = [], sucio = [], Q = [], sombra = null, SP = 0;
  let marco = 0, observador = null;
  let menu = null, offTacos = null;

  /* — apuntado — */
  const ap = { ang: 0, f: 0.5, a: 0, b: 0, colocada: null, c: -1, mouse: null };

  /* — repetición del tiro — */
  let anim = null;          // {m, ev, fase, t0, tiro, restoSim, drops[]}
  let vis = null;           // la mesa que se pinta (clon) mientras hay repetición
  const caidas = [];        // bolas cayendo: {id, p, t0, x, y}
  let ultimoTurno = "";     // para reiniciar el apuntado al cambiar el turno
  let cuadro = 0;

  /* ---------- montaje ---------- */
  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-pool">
        <div class="jg-pl-barra" id="plBarra"></div>
        <div class="jg-pl-hud" id="plHud"></div>
        <div class="jg-pl-estado" id="plEstado"></div>
        <div class="jg-pl-mesa" id="plMesa"><canvas id="plCv"></canvas></div>
        <div class="jg-pl-ctl" id="plCtl">
          <div class="jg-pl-caja jg-pl-efecto-caja">
            <canvas id="plEfecto" width="120" height="120" title="Punto de golpe en la blanca"></canvas>
            <span class="jg-pl-et">Efecto</span>
          </div>
          <div class="jg-pl-caja jg-pl-fuerza-caja">
            <div class="jg-pl-fuerza-v"><b id="plFuerzaN">50</b>%</div>
            <input type="range" id="plFuerza" min="2" max="100" value="50" aria-label="Fuerza del golpe">
            <span class="jg-pl-et">Fuerza</span>
          </div>
          <div class="jg-pl-caja jg-pl-fino">
            <div class="jg-pl-fila">
              <button type="button" class="jg-btn jg-pl-b" data-fino="-0.02" title="Girar mucho a la izquierda">«</button>
              <button type="button" class="jg-btn jg-pl-b" data-fino="-0.002" title="Girar un poco a la izquierda">‹</button>
              <button type="button" class="jg-btn jg-pl-b" data-fino="0.002" title="Girar un poco a la derecha">›</button>
              <button type="button" class="jg-btn jg-pl-b" data-fino="0.02" title="Girar mucho a la derecha">»</button>
            </div>
            <span class="jg-pl-et">Puntería fina</span>
          </div>
          <div class="jg-pl-caja jg-pl-acciones">
            <button type="button" class="jg-btn jg-pl-mover" id="plMover" hidden>Mover la blanca</button>
            <button type="button" class="jg-btn jg-btn-prim jg-pl-golpe" id="plGolpe">Golpear</button>
          </div>
        </div>
        <div class="jg-pl-pie" id="plPie"></div>
      </div>`;
    menu = crearMenuPool(ctx, host.querySelector(".jg-pool"));
    host.querySelector("#plBarra").innerHTML = menu.barra();
    host.querySelector("#plBarra").addEventListener("click", e => {
      const b = e.target.closest("[data-menu]");
      if (b) menu.abre(b.getAttribute("data-menu"));
    });
    if (ctx.tacos && ctx.tacos.alCambiar) offTacos = ctx.tacos.alCambiar(() => { menu.refresca(); pide(); });
    cv = host.querySelector("#plCv");
    g2 = cv.getContext("2d");
    cv.style.touchAction = "none";
    cv.addEventListener("pointerdown", alPuntero);
    cv.addEventListener("pointermove", alPuntero);
    cv.addEventListener("pointerleave", () => { ap.mouse = null; pide(); });
    host.querySelector("#plFuerza").addEventListener("input", e => { ap.f = Number(e.target.value) / 100; pintaFuerza(); pide(); });
    host.querySelector("#plGolpe").addEventListener("click", golpea);
    host.querySelector("#plMover").addEventListener("click", () => { ap.colocada = null; pide(); pinta(); });
    host.querySelectorAll("[data-fino]").forEach(b => {
      const paso = Number(b.getAttribute("data-fino"));
      let t = null;
      const parar = () => { if (t) { clearInterval(t); t = null; } };
      b.addEventListener("pointerdown", e => {
        e.preventDefault(); gira(paso); parar();
        t = setInterval(() => gira(paso), 70);
      });
      for (const n of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(n, parar);
    });
    const ef = host.querySelector("#plEfecto");
    const mueveEfecto = e => {
      if (!puedeApuntar()) return;
      if (e.type === "pointermove" && !(e.buttons & 1)) return;
      const r = ef.getBoundingClientRect();
      let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      x /= 0.86; y /= 0.86;                     // el disco útil ocupa el 86 % del lienzo
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      ap.a = Math.round(x * 100) / 100; ap.b = Math.round(y * 100) / 100;
      pintaEfecto(); pide();
    };
    ef.addEventListener("pointerdown", mueveEfecto);
    ef.addEventListener("pointermove", mueveEfecto);
    ef.addEventListener("dblclick", () => { ap.a = 0; ap.b = 0; pintaEfecto(); pide(); });
    document.addEventListener("keydown", alTecla);
    document.addEventListener("visibilitychange", alVolver);
    if (typeof ResizeObserver !== "undefined") {
      observador = new ResizeObserver(() => ajusta());
      observador.observe(host.querySelector("#plMesa"));
    }
    ajusta();
    pintaEfecto(); pintaFuerza();
  }

  function destruir() {
    muerto = true;
    document.removeEventListener("keydown", alTecla);
    document.removeEventListener("visibilitychange", alVolver);
    if (observador) observador.disconnect();
    if (offTacos) offTacos();
    if (menu) menu.destruir();
    if (host) host.innerHTML = "";
    host = null; cv = null; g2 = null; anim = null;
  }

  /* ---------- tamaño y capas ---------- */
  function ajusta() {
    if (!host || !cv) return;
    const caja = host.querySelector("#plMesa");
    const ancho = Math.max(280, Math.min(1180, caja.clientWidth || 800));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    escala = (ancho * dpr) / MUNDO.w;
    cv.width = Math.round(MUNDO.w * escala);
    cv.height = Math.round(MUNDO.h * escala);
    cv.style.width = ancho + "px";
    cv.style.height = Math.round(ancho * MUNDO.h / MUNDO.w) + "px";
    capaMesa = document.createElement("canvas");
    capaMesa.width = cv.width; capaMesa.height = cv.height;
    dibujaMesa(capaMesa, escala);
    SP = Math.ceil(2 * PL.R * escala) + 4;
    SP += SP % 2;
    spr = []; sucio = [];
    for (let i = 0; i < 16; i++) {
      const c = document.createElement("canvas");
      c.width = c.height = SP;
      spr.push(c); sucio.push(true);
      if (!Q[i]) Q[i] = oriInicial(i);
    }
    sombra = sombraBola(Math.ceil(SP * 1.5));
    pide();
  }

  /* mm de la mesa → píxeles del lienzo */
  const PX = x => (MARCO + x) * escala;
  const PY = y => (MARCO + PL.W - y) * escala;

  /* ---------- bucle ---------- */
  let pendiente = false;
  function pide() {
    if (pendiente || muerto || !cv) return;
    pendiente = true;
    requestAnimationFrame(t => { pendiente = false; if (!muerto) bucle(t); });
  }

  let tAnt = 0;
  function bucle(t) {
    const dt = tAnt ? Math.min(0.05, (t - tAnt) / 1000) : 0.016;
    tAnt = t;
    let sigue = false;
    if (anim) sigue = avanza(dt);
    if (caidas.length) sigue = true;
    dibuja();
    if (sigue || anim || (puedeApuntar() && animado(estiloDe(uid)))) { pide(); } else tAnt = 0;
  }

  /* ---------- la repetición del tiro ---------- */
  function iniciaRepeticion(u) {
    const m = plClona(u.antes);
    const tiro = u.tiro;
    vis = m;
    // el golpe se aplica al terminar la fase del taco (ver `avanza`)
    anim = { m, tiro, u, fase: "taco", t0: null, acum: 0, listo: false, vozChoque: 0, vozBanda: 0 };
    const delante = u.uid === uid && !mirando;
    anim.atras = delante ? 0 : T_ATRAS;     // lo mío ya estaba echado atrás: solo el golpe
    ap.ang = Math.atan2(tiro.dy, tiro.dx);
    pide();
  }

  function avanza(dt) {
    const a = anim;
    if (a.fase === "taco") {
      a.t0 = (a.t0 || 0) + dt;
      if (a.t0 >= a.atras + T_ADELANTE) {
        a.fase = "sim";
        suena("plTaco", a.tiro.f);
        plGolpe(a.m, a.tiro);
        a.aviso = (k, i, j, v) => alEvento(a, k, i, j, v);
      }
      return true;
    }
    // fase de simulación: pasos a tiempo real
    a.acum += dt * PL.DT ** -1;
    let n = Math.floor(a.acum); a.acum -= n;
    n = Math.min(n, 400);
    let vivo = true, hechos = 0;
    while (n-- > 0 && vivo) { vivo = plPaso(a.m, a.aviso); hechos++; }
    // la orientación avanza con la velocidad angular de cada bola
    const tt = hechos * PL.DT;
    if (tt > 0) for (const q of a.m.b) {
      if (!q.en) continue;
      if (q.wx || q.wy || q.wz) { Q[q.id] = rota(Q[q.id], q.wx, q.wy, q.wz, tt); sucio[q.id] = true; }
    }
    a.pasos = (a.pasos || 0) + hechos;
    if (!vivo || a.pasos >= PL.MAX_PASOS) { terminaRepeticion(); return false; }
    return true;
  }

  function alEvento(a, k, i, j, v) {
    if (k === "bola") {
      const vol = Math.min(1, v / 3500);
      if (vol > 0.02 && a.vozChoque <= 0) { suena("plChoque", vol); a.vozChoque = 2; }
      else a.vozChoque--;
    } else if (k === "banda") {
      const vol = Math.min(1, j / 3000);
      if (vol > 0.05 && a.vozBanda <= 0) { suena("plBanda", vol); a.vozBanda = 60; }
      else a.vozBanda--;
    } else if (k === "tronera") {
      const q = a.m.b[i];
      caidas.push({ id: i, p: j, t0: performance.now() / 1000, x: q.x, y: q.y });
      suena("plTronera");
    }
  }

  function terminaRepeticion() {
    anim = null; vis = null;
    // se encaja con el estado real
    if (est) for (let i = 0; i < 16; i++) sucio[i] = true;
    pide();
    pinta();
    if (ctx.listo) ctx.listo();
  }
  const ocupado = () => !!anim || caidas.length > 0;

  /* ---------- dibujo ---------- */
  function actualizaSprite(id) {
    if (!sucio[id]) return;
    pintaBola(spr[id], id, Q[id], SP);
    sucio[id] = false;
  }

  function mesaActual() { return vis || (est && est.mesa) || null; }

  function posBlanca() {
    const m = mesaActual();
    if (!m) return null;
    const c = m.b[0];
    if (!vis && est && est.mano && ap.colocada) return { x: ap.colocada.x, y: ap.colocada.y, en: true };
    return c.en ? { x: c.x, y: c.y, en: true } : null;
  }

  function dibuja() {
    if (!g2 || !capaMesa) return;
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.clearRect(0, 0, cv.width, cv.height);
    g2.drawImage(capaMesa, 0, 0);
    const m = mesaActual();
    if (!m) return;
    const R = PL.R;
    const mio = puedeApuntar();

    // zona de la cabecera si se coloca tras la rotura
    if (mio && est.mano && !ap.colocada) marcaZonaMano();

    // sombras
    const sw = sombra.width;
    for (const q of m.b) {
      if (!q.en) continue;
      if (q.id === 0 && !vis && est.mano) continue;
      g2.drawImage(sombra, PX(q.x + 5) - sw / 2, PY(q.y - 8) - sw / 2);
    }
    if (!vis && est.mano && ap.colocada) g2.drawImage(sombra, PX(ap.colocada.x + 5) - sw / 2, PY(ap.colocada.y - 8) - sw / 2);

    // bolas
    for (const q of m.b) {
      if (!q.en) continue;
      let x = q.x, y = q.y;
      if (q.id === 0 && !vis && est.mano) {
        if (!ap.colocada) continue;
        x = ap.colocada.x; y = ap.colocada.y;
      }
      actualizaSprite(q.id);
      g2.drawImage(spr[q.id], Math.round(PX(x) - SP / 2), Math.round(PY(y) - SP / 2));
    }
    // la blanca fantasma al colocar
    if (mio && est.mano && !ap.colocada && ap.mouse) {
      const ok = plColocaOk(m, ap.mouse.x, ap.mouse.y, est.mano);
      g2.globalAlpha = ok ? 0.65 : 0.35;
      actualizaSprite(0);
      g2.drawImage(spr[0], Math.round(PX(ap.mouse.x) - SP / 2), Math.round(PY(ap.mouse.y) - SP / 2));
      g2.globalAlpha = 1;
      if (!ok) {
        g2.strokeStyle = "rgba(255,70,70,.9)"; g2.lineWidth = 2.5 * dpr;
        g2.beginPath(); g2.arc(PX(ap.mouse.x), PY(ap.mouse.y), R * escala + 3, 0, 6.2832); g2.stroke();
      }
    }

    // bolas cayendo a la tronera
    const ahora = performance.now() / 1000;
    for (let i = caidas.length - 1; i >= 0; i--) {
      const c = caidas[i], k = (ahora - c.t0) / 0.32;
      if (k >= 1) { caidas.splice(i, 1); continue; }
      const bo = PL_BOLSILLOS[c.p];
      const x = c.x + (bo.x - c.x) * k, y = c.y + (bo.y - c.y) * k;
      const sc = 1 - 0.55 * k;
      actualizaSprite(c.id);
      g2.globalAlpha = 1 - k * k;
      g2.drawImage(spr[c.id], PX(x) - (SP * sc) / 2, PY(y) - (SP * sc) / 2, SP * sc, SP * sc);
      g2.globalAlpha = 1;
    }
    if (caidas.length) pide();

    // 8 cantada
    if (mio && est.despejado) marcaTroneras();

    // guía y taco
    const bl = posBlanca();
    if (mio && bl && (!est.mano || ap.colocada)) {
      if (guiaActiva()) dibujaGuia(bl);
      dibujaTacoApuntando(bl);
      dibujaPuntoEfecto(bl);
    } else if (anim && anim.fase === "taco") {
      const q = anim.m.b[0];
      const t = anim.t0 || 0;
      let pull;
      if (t < anim.atras) pull = (t / anim.atras) * anim.tiro.f * TACO_MAX;
      else pull = (1 - (t - anim.atras) / T_ADELANTE) * anim.tiro.f * TACO_MAX;
      ponTaco(q.x, q.y, anim.tiro.dx, anim.tiro.dy, Math.max(0, pull), 1, anim.u.uid);
    }
  }

  function marcaZonaMano() {
    const { L, W } = PL;
    g2.save();
    g2.fillStyle = "rgba(255,255,255,.07)";
    const x1 = est.mano === "cabecera" ? L / 4 : L;
    g2.fillRect(PX(0), PY(W), PX(x1) - PX(0), PY(0) - PY(W));
    if (est.mano === "cabecera") {
      g2.strokeStyle = "rgba(255,255,255,.55)"; g2.lineWidth = 2 * dpr; g2.setLineDash([8 * dpr, 6 * dpr]);
      g2.beginPath(); g2.moveTo(PX(x1), PY(0)); g2.lineTo(PX(x1), PY(W)); g2.stroke();
    }
    g2.restore();
  }

  function marcaTroneras() {
    g2.save();
    PL_BOLSILLOS.forEach((b, i) => {
      const sel = ap.c === i;
      g2.lineWidth = (sel ? 4 : 2.2) * dpr;
      g2.strokeStyle = sel ? "#ffd84a" : "rgba(255,255,255,.55)";
      g2.fillStyle = sel ? "rgba(255,216,74,.25)" : "rgba(255,255,255,.08)";
      g2.beginPath(); g2.arc(PX(b.x), PY(b.y), 62 * escala, 0, 6.2832); g2.fill(); g2.stroke();
      if (sel) {
        g2.fillStyle = "#ffd84a"; g2.font = "bold " + 34 * escala + "px Arial"; g2.textAlign = "center"; g2.textBaseline = "middle";
        g2.fillText("8", PX(b.x), PY(b.y));
      }
    });
    g2.restore();
  }

  /* El taco, con la punta a `pull` mm por detrás del borde de la blanca. */
  const estiloDe = u => TACOS[(ctx.tacoDe && ctx.tacoDe(u)) || "escuela"] || TACOS.escuela;
  const animado = e => !!(e.brillo || ["olas", "aurora", "galaxia"].includes(e.veta));
  function ponTaco(x, y, dx, dy, pull, alfa, quien) {
    g2.save();
    g2.setTransform(escala, 0, 0, -escala, MARCO * escala, (MARCO + PL.W) * escala);
    const hueco = PL.R + 14 + pull;
    dibujaTaco(g2, x - dx * hueco, y - dy * hueco, Math.atan2(dy, dx), alfa, estiloDe(quien), performance.now() / 1000);
    g2.restore();
  }

  function dibujaTacoApuntando(bl) {
    const dx = Math.cos(ap.ang), dy = Math.sin(ap.ang);
    ponTaco(bl.x, bl.y, dx, dy, ap.f * TACO_MAX * 0.9 + 6, 1, uid);
  }

  function dibujaPuntoEfecto(bl) {
    if (!ap.a && !ap.b) return;
    g2.save();
    g2.fillStyle = "rgba(220,50,50,.95)"; g2.strokeStyle = "rgba(255,255,255,.9)"; g2.lineWidth = 1.2 * dpr;
    g2.beginPath();
    g2.arc(PX(bl.x + ap.a * PL.R * 0.78), PY(bl.y + ap.b * PL.R * 0.78), 4.2 * dpr, 0, 6.2832);
    g2.fill(); g2.stroke();
    g2.restore();
  }

  /* ---------- línea guía ---------- */
  const guiaActiva = () => !p || Number(p.guia) !== 0;

  function legalPrimero(id) {
    if (est.despejado) return id === 8;
    if (est.abierta) return id !== 8;
    const mia = est.grupos[est.equipo];
    return plGrupo(id) === mia;
  }

  function dibujaGuia(bl) {
    const m = mesaActual(), R = PL.R, { L, W } = PL;
    const dx = Math.cos(ap.ang), dy = Math.sin(ap.ang);
    // primera bola
    let tB = Infinity, bola = null;
    for (const q of m.b) {
      if (q.id === 0 || !q.en) continue;
      const ex = q.x - bl.x, ey = q.y - bl.y;
      const proj = ex * dx + ey * dy;
      if (proj <= 0) continue;
      const perp2 = ex * ex + ey * ey - proj * proj;
      const r2 = 4 * R * R;
      if (perp2 >= r2) continue;
      const t = proj - Math.sqrt(r2 - perp2);
      if (t < tB) { tB = t; bola = q; }
    }
    // primera banda (centro de la blanca contra el borde útil)
    let tW = Infinity, nx = 0, ny = 0;
    if (dx > 1e-9) { const t = (L - R - bl.x) / dx; if (t < tW) { tW = t; nx = -1; ny = 0; } }
    if (dx < -1e-9) { const t = (R - bl.x) / dx; if (t < tW) { tW = t; nx = 1; ny = 0; } }
    if (dy > 1e-9) { const t = (W - R - bl.y) / dy; if (t < tW) { tW = t; nx = 0; ny = -1; } }
    if (dy < -1e-9) { const t = (R - bl.y) / dy; if (t < tW) { tW = t; nx = 0; ny = 1; } }

    g2.save();
    g2.setTransform(escala, 0, 0, -escala, MARCO * escala, (MARCO + PL.W) * escala);
    g2.lineCap = "round";
    const lw = 4;
    const trazo = (x0, y0, x1, y1, col, ancho, dash) => {
      g2.strokeStyle = col; g2.lineWidth = ancho; g2.setLineDash(dash || []);
      g2.beginPath(); g2.moveTo(x0, y0); g2.lineTo(x1, y1); g2.stroke();
    };
    if (bola && tB < tW) {
      const gx = bl.x + dx * tB, gy = bl.y + dy * tB;
      const ok = legalPrimero(bola.id);
      const col = ok ? "rgba(255,255,255,.85)" : "rgba(255,90,90,.9)";
      trazo(bl.x + dx * R, bl.y + dy * R, gx, gy, col, lw, [26, 18]);
      g2.strokeStyle = col; g2.lineWidth = 3; g2.setLineDash([]);
      g2.beginPath(); g2.arc(gx, gy, R, 0, 6.2832); g2.stroke();
      // hacia dónde sale la bola objetivo y la blanca
      let ox = bola.x - gx, oy = bola.y - gy; const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
      trazo(bola.x + ox * R, bola.y + oy * R, bola.x + ox * 520, bola.y + oy * 520, ok ? "rgba(255,230,120,.9)" : "rgba(255,120,120,.8)", lw);
      const dot = dx * ox + dy * oy;
      let cx2 = dx - dot * ox, cy2 = dy - dot * oy; const cl = Math.hypot(cx2, cy2);
      if (cl > 0.03) {
        cx2 /= cl; cy2 /= cl;
        const largo = 120 + 330 * cl;
        trazo(gx + cx2 * R, gy + cy2 * R, gx + cx2 * largo, gy + cy2 * largo, "rgba(255,255,255,.55)", 3, [14, 12]);
      }
    } else if (isFinite(tW)) {
      const gx = bl.x + dx * tW, gy = bl.y + dy * tW;
      trazo(bl.x + dx * R, bl.y + dy * R, gx, gy, "rgba(255,255,255,.8)", lw, [26, 18]);
      const rx = dx - 2 * (dx * nx + dy * ny) * nx, ry = dy - 2 * (dx * nx + dy * ny) * ny;
      trazo(gx, gy, gx + rx * 420, gy + ry * 420, "rgba(255,255,255,.4)", 3, [12, 12]);
      g2.strokeStyle = "rgba(255,255,255,.7)"; g2.lineWidth = 3; g2.setLineDash([]);
      g2.beginPath(); g2.arc(gx, gy, R, 0, 6.2832); g2.stroke();
    }
    g2.restore();
  }

  /* ---------- entrada ---------- */
  function puedeApuntar() {
    return !!est && !mirando && est.fase === "jugando" && est.turno === uid && !anim && !enviando && caidas.length === 0;
  }

  function aMesa(e) {
    const r = cv.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * MUNDO.w - MARCO;
    const my = PL.W + MARCO - ((e.clientY - r.top) / r.height) * MUNDO.h;
    return { x: mx, y: my };
  }

  function alPuntero(e) {
    if (!puedeApuntar()) return;
    const pt = aMesa(e);
    const abajo = e.type === "pointerdown";
    const arrastra = !!(e.buttons & 1) || e.pointerType === "mouse";
    if (est.mano && !ap.colocada) {
      ap.mouse = pt;
      if (abajo) {
        if (plColocaOk(est.mesa, pt.x, pt.y, est.mano)) {
          ap.colocada = { x: pt.x, y: pt.y };
          apuntaAlMejor();
          pinta();
        } else suena("clic");
      }
      pide();
      return;
    }
    if (est.despejado && abajo) {
      for (let i = 0; i < 6; i++) {
        const b = PL_BOLSILLOS[i];
        if (Math.hypot(b.x - pt.x, b.y - pt.y) < 110) { ap.c = i; pinta(); pide(); return; }
      }
    }
    if (!arrastra && !abajo) return;
    if (e.pointerType !== "mouse" && !abajo && !(e.buttons & 1)) return;
    const bl = posBlanca();
    if (!bl) return;
    const dx = pt.x - bl.x, dy = pt.y - bl.y;
    if (Math.hypot(dx, dy) < PL.R * 1.2) return;
    ap.ang = Math.atan2(dy, dx);
    if (abajo && cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (x) { /* nada */ } }
    pide();
  }

  function gira(paso) {
    if (!puedeApuntar()) return;
    ap.ang += paso; pide();
  }

  function alTecla(e) {
    const t = e.target;
    if (t && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type !== "range"))) return;
    if (!puedeApuntar()) return;
    const fino = e.shiftKey ? 0.0005 : 0.003;
    let usado = true;
    if (e.key === "ArrowLeft") ap.ang += fino;
    else if (e.key === "ArrowRight") ap.ang -= fino;
    else if (e.key === "ArrowUp") ap.f = Math.min(1, ap.f + 0.02);
    else if (e.key === "ArrowDown") ap.f = Math.max(0.02, ap.f - 0.02);
    else if (e.key === " " || e.key === "Enter") golpea();
    else usado = false;
    if (usado) { e.preventDefault(); pintaFuerza(); pide(); }
  }

  /* Al empezar el turno se apunta hacia las bolas propias, para no
     arrancar mirando a la pared. */
  function apuntaAlMejor() {
    const bl = posBlanca();
    if (!bl || !est) return;
    const g = est.grupos[est.equipo];
    let sx = 0, sy = 0, n = 0;
    for (const q of est.mesa.b) {
      if (!q.en || q.id === 0) continue;
      const bueno = est.despejado ? q.id === 8 : est.abierta ? q.id !== 8 : plGrupo(q.id) === g;
      if (bueno) { sx += q.x; sy += q.y; n++; }
    }
    if (n) ap.ang = Math.atan2(sy / n - bl.y, sx / n - bl.x);
  }

  async function golpea() {
    if (!puedeApuntar()) return;
    if (est.mano && !ap.colocada) { suena("clic"); return; }
    if (est.despejado && ap.c < 0) { suena("clic"); pinta(); return; }
    const num = v => Math.round(v * 1e5) / 1e5;
    const tiro = { t: "tiro", uid, dx: num(Math.cos(ap.ang)), dy: num(Math.sin(ap.ang)), f: num(ap.f), a: num(ap.a), b: num(ap.b) };
    if (est.mano && ap.colocada) { tiro.px = Math.round(ap.colocada.x * 10) / 10; tiro.py = Math.round(ap.colocada.y * 10) / 10; }
    if (est.despejado) tiro.c = ap.c;
    enviando = true;
    try { await jugar(tiro); }
    finally { if (!muerto) { enviando = false; pinta(); pide(); } }
  }

  /* ---------- paneles ---------- */
  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
  }

  const jugadorDe = u => (est && est.jugadores && est.jugadores.find(x => x.uid === u)) || null;
  const nombreDe = u => { const j = jugadorDe(u); return j ? j.nombre : "alguien"; };

  function miniBola(id, fuera) {
    const ray = id > 8, c = colorBola(id);
    const n = id <= 8 ? id : id - 8;
    return `<i class="jg-pl-mb${ray ? " ray" : ""}${fuera ? " fuera" : ""}" style="--c:${c}"><b>${n}</b></i>`;
  }

  function pintaHud() {
    const eq = est.equipos, en = {};
    for (const q of est.mesa.b) en[q.id] = q.en;
    const caja = (clave, uids) => {
      const g = est.grupos[clave];
      const turno = est.fase === "jugando" && est.equipo === clave;
      let bolas = "";
      if (g) {
        const ids = g === "s" ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
        bolas = ids.map(i => miniBola(i, !en[i])).join("") + miniBola(8, !en[8]);
      }
      const gl = g ? NOMBRE_GRUPO[g] : est.abierta ? "Mesa abierta" : "";
      const nombres = uids.map(u => {
        const j = jugadorDe(u);
        const tu = u === uid ? " (tú)" : "";
        const fuera = est.fuera && est.fuera[u] ? " fuera" : "";
        const toca = est.turno === u ? " toca" : "";
        return `<span class="jg-pl-nom${fuera}${toca}" style="--c:${esc((j && j.color) || "#888")}" translate="no">${esc(j ? j.nombre : "?")}${tu}</span>`;
      }).join("");
      return `<div class="jg-pl-equipo${turno ? " turno" : ""}">
        <div class="jg-pl-nombres">${nombres}</div>
        <div class="jg-pl-grupo">${esc(gl)}</div>
        <div class="jg-pl-bolas">${bolas}</div>
      </div>`;
    };
    set("plHud",
      [est.equipo, est.fase, JSON.stringify(est.grupos), est.abierta, est.turno, est.mesa.b.map(q => q.en ? 1 : 0).join(""), JSON.stringify(est.fuera)].join("|"),
      caja("a", eq.a) + `<div class="jg-pl-vs">vs</div>` + caja("b", eq.b));
  }

  function resumenUltima() {
    const u = est.ultima;
    if (!u) return "";
    const yo = u.uid === uid, quien = yo ? "" : nombreDe(u.uid) + " ";
    const caidas = u.emb.filter(e => e.id !== 0).map(e => "la " + e.id);
    let s = caidas.length
      ? `${yo ? "Embolsaste" : quien + "embolsó"} ${caidas.join(", ")}.`
      : `${yo ? "No embolsaste" : quien + "no embolsó"} ninguna.`;
    if (u.falta) s += ` Falta: ${PL_FALTAS[u.falta] || u.falta}.`;
    else if (u.emb.some(e => e.id === 0)) s += " Falta: metió la blanca.";
    return s;
  }

  function pinta() {
    if (!host || !est) return;
    pintaHud();

    let estado;
    if (est.fase === "espera") estado = "Esperando a los jugadores…";
    else if (est.fase === "fin") {
      const gana = est.ganador === uid || (typeof est.ganador === "string" && est.ganador.startsWith("eq:") && est.equipos[est.ganador.slice(3)].indexOf(uid) >= 0);
      const motivos = {
        ocho: "metió la 8 como estaba cantado",
        "ocho-pronto": "la 8 cayó antes de tiempo",
        "ocho-mal": "la 8 cayó en otra tronera",
        "ocho-falta": "la 8 cayó con falta",
        abandono: "el otro bando abandonó"
      };
      estado = (mirando ? "Fin de la partida" : gana ? "🏆 Ganas la partida" : "Pierdes la partida") + (motivos[est.motivo] ? ": " + motivos[est.motivo] + "." : ".");
    } else if (est.turno === uid) {
      if (est.mano) estado = est.mano === "cabecera"
        ? "Tienes la blanca en mano: colócala detrás de la línea de cabecera."
        : "Tienes la blanca en mano: colócala donde quieras.";
      else if (est.despejado) estado = ap.c < 0 ? "Va la 8: toca la tronera donde la vas a meter." : "Apunta a la 8 y golpea.";
      else estado = "Es tu turno: apunta, elige fuerza y efecto, y golpea.";
    } else estado = `Juega ${nombreDe(est.turno)}…`;
    set("plEstado", estado + "|" + est.turno + "|" + ap.c, `<span>${esc(estado)}</span>`);

    const mio = est.fase === "jugando" && est.turno === uid && !mirando;
    const ctl = host.querySelector("#plCtl");
    ctl.classList.toggle("off", !mio || !!anim);
    ctl.classList.toggle("mirando", mirando);
    const mover = host.querySelector("#plMover");
    mover.hidden = !(mio && est.mano && ap.colocada);
    const gol = host.querySelector("#plGolpe");
    gol.disabled = !mio || !!anim || enviando || (est.mano && !ap.colocada) || (est.despejado && ap.c < 0);

    const resumen = resumenUltima();
    set("plPie", resumen + "|" + (est.ultima ? est.movs : 0), resumen ? `<span class="jg-nota">${esc(resumen)}</span>` : `<span class="jg-nota">Rotura: gana el turno quien tire; con 4 bolas a banda o una embolsada es legal.</span>`);
  }

  function pintaFuerza() {
    if (!host) return;
    const r = host.querySelector("#plFuerza"), n = host.querySelector("#plFuerzaN");
    if (!r) return;
    r.value = Math.round(ap.f * 100);
    n.textContent = Math.round(ap.f * 100);
    r.style.setProperty("--v", Math.round(ap.f * 100) + "%");
  }

  function pintaEfecto() {
    if (!host) return;
    const c = host.querySelector("#plEfecto");
    if (!c) return;
    const g = c.getContext("2d"), S = c.width, r = S / 2;
    g.clearRect(0, 0, S, S);
    const gr = g.createRadialGradient(r * 0.7, r * 0.6, r * 0.1, r, r, r * 0.9);
    gr.addColorStop(0, "#fffef6"); gr.addColorStop(1, "#bdb8a4");
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r * 0.86, 0, 6.2832); g.fill();
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2; g.stroke();
    g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(r, r * 0.14); g.lineTo(r, S - r * 0.14); g.moveTo(r * 0.14, r); g.lineTo(S - r * 0.14, r); g.stroke();
    g.beginPath(); g.arc(r, r, r * 0.86 * 0.55, 0, 6.2832); g.stroke();
    g.fillStyle = "rgba(0,0,0,.45)"; g.font = "bold 11px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("arriba", r, r * 0.26); g.fillText("abajo", r, S - r * 0.26);
    const x = r + ap.a * r * 0.86, y = r - ap.b * r * 0.86;
    g.fillStyle = "#d32f2f"; g.strokeStyle = "#fff"; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 8, 0, 6.2832); g.fill(); g.stroke();
  }

  /* ---------- actualizar ---------- */
  function alVolver() {
    if (document.hidden || !est) return;
    pide();
  }

  function actualizar(partida, estado) {
    const antes = est;
    p = partida; est = estado;
    if (!host) return;

    // ¿hay un tiro nuevo para ver?
    if (movsVistos >= 0 && est.movs > movsVistos && est.ultima && !document.hidden) {
      if (anim) { anim = null; vis = null; }
      iniciaRepeticion(est.ultima);
    } else if (est.movs !== movsVistos) {
      anim = null; vis = null;
    }
    movsVistos = est.movs;

    // el apuntado vuelve a empezar cuando cambia el turno
    const clave = est.turno + "#" + est.movs;
    if (clave !== ultimoTurno) {
      ultimoTurno = clave;
      ap.colocada = null; ap.c = -1; ap.a = 0; ap.b = 0; ap.f = 0.5;
      pintaEfecto(); pintaFuerza();
      if (est.turno === uid && !mirando) apuntaAlMejor();
    }
    void antes;
    pinta();
    pide();

    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir, ocupado };
}
