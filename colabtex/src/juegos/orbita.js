/* Órbita — la pantalla.
 *
 * Un lienzo con el campo de gravedad, y nada que decidir aquí: el reductor
 * (`redOrbita` en motor.js) ya simuló cada lanzamiento, y esta pantalla lo
 * *vuelve a correr* con la misma `orTurno` desde `ultima.antes`, cuadro a
 * cuadro, para contarlo. Lo que se anima, por tanto, no puede ser distinto
 * de lo que se decidió.
 *
 * - **Apuntar es señalar.** Desde tu base, hacia donde apuntas: la
 *   distancia es la fuerza. Los dos deslizadores (ángulo y potencia) dicen
 *   lo mismo con precisión, y con teclado. La trayectoria prevista se ve
 *   solo el primer tramo (`PREVIA`): ver entero dónde acaba sería jugar
 *   al billar con el taco marcado. Las estrellas que esa previa toca se
 *   encienden.
 * - **Lo que ya orbita enseña su camino del próximo turno**, en puntos
 *   tenues: es lo que deja apuntar a un satélite ajeno para derribarlo.
 * - Como en la reacción en cadena, `ocupado()` cubre la animación y
 *   `ctx.listo()` avisa al acabar, para que el cartel final no tape el
 *   último lanzamiento; una pestaña oculta guarda la jugada en `pendiente`
 *   y la cuenta al volver. `gen` anula una animación que otra más nueva
 *   dejó vieja.
 */
import { escapeHtml as esc } from "../util.js";
import { suena } from "./sonido.js";
import { orTurno, OR_VMAX, OR_PASOS, OR_W, OR_H, OR_CAPTURA, rng } from "./motor.js";

const PALETA = ["#a78bfa", "#fbbf24", "#34d399", "#f472b6"];
const PLANETAS = [["#7dd3fc", "#1e3a8a"], ["#fca5a5", "#7f1d1d"], ["#86efac", "#14532d"], ["#fcd34d", "#78350f"], ["#c4b5fd", "#3b0764"]];
const PREVIA = 150;          // pasos de trayectoria que se enseñan al apuntar
const POR_CUADRO = 4;        // pasos de simulación por cuadro al contar un turno
const FUERZA = 6;            // unidades de campo por unidad de velocidad al señalar

export function crearOrbita(ctx) {
  const { uid, jugar, terminar } = ctx;
  let host, cv, g, est = null, p = null, muerto = false, raf = 0;
  let cw = 0, ch = 0, k = 1, dpr = 1, fondo = null, fondoClave = "";
  let vistos = -1, pendiente = -1, gen = 0, anim = null, enviando = false;
  let apunta = null, arrastra = false, previa = null, futuros = null, futClave = "";
  let efectos = [], sacude = 0, firma = "";
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => mide()) : null;

  function montar(el) {
    host = el;
    host.innerHTML = '<section class="jg-orb">' +
      '<div class="jg-orb-hud"><div class="jg-orb-fase" aria-live="polite"></div><div class="jg-orb-ronda"></div></div>' +
      '<div class="jg-orb-marcador"></div>' +
      '<div class="jg-orb-lienzo"><canvas aria-label="Campo de gravedad de Órbita"></canvas><div class="jg-orb-aviso"></div></div>' +
      '<div class="jg-orb-mando">' +
      '<label>Ángulo <input type="range" class="jg-orb-ang" min="-180" max="180" step="1" value="0"><b class="jg-orb-angv">0°</b></label>' +
      '<label>Potencia <input type="range" class="jg-orb-pot" min="5" max="100" step="1" value="45"><b class="jg-orb-potv">45 %</b></label>' +
      '<button type="button" class="jg-orb-lanza">🚀 Lanzar</button></div>' +
      '<p class="jg-orb-error" role="alert"></p></section>';
    cv = host.querySelector("canvas");
    g = cv.getContext("2d");
    cv.addEventListener("pointerdown", abajo);
    cv.addEventListener("pointermove", mueve);
    cv.addEventListener("pointerup", arriba);
    cv.addEventListener("pointercancel", arriba);
    host.querySelector(".jg-orb-ang").addEventListener("input", desdeMando);
    host.querySelector(".jg-orb-pot").addEventListener("input", desdeMando);
    host.querySelector(".jg-orb-lanza").addEventListener("click", lanzar);
    document.addEventListener("visibilitychange", alVolver);
    if (ro) ro.observe(host.querySelector(".jg-orb-lienzo"));
    else window.addEventListener("resize", mide);
    mide();
    raf = requestAnimationFrame(cuadro);
  }

  function alVolver() {
    if (document.hidden || !est) return;
    if (pendiente >= 0 && pendiente === est.movs && est.ultima) cuenta(est.ultima);
    pendiente = -1;
    pinta();
  }

  function destruir() {
    muerto = true; gen++;
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", alVolver);
    if (ro) ro.disconnect(); else window.removeEventListener("resize", mide);
    if (host) host.innerHTML = "";
    host = null;
  }

  /* ---------- medidas ---------- */
  function mide() {
    if (!host || !cv) return;
    const caja = host.querySelector(".jg-orb-lienzo");
    const w = Math.max(280, caja.clientWidth);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = w; ch = Math.round(w * OR_H / OR_W); k = w / OR_W;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    cv.style.height = ch + "px";
    fondoClave = "";
  }
  const X = x => x * k, Y = y => y * k;
  const aCampo = ev => {
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / k, y: (ev.clientY - r.top) / k };
  };

  /* ---------- quién es quién ---------- */
  const asiento = u => est ? est.jugadores.findIndex(j => j.uid === u) : -1;
  const color = u => PALETA[Math.max(0, asiento(u)) % PALETA.length];
  const nombre = u => { const j = est && est.jugadores.find(x => x.uid === u); return u === uid ? "Tú" : (j ? j.nombre : "—"); };
  const ocupado = () => !!anim || pendiente >= 0;
  const miTurno = () => est && est.fase === "jugando" && est.turno === uid && !ocupado() && !enviando;

  /* ---------- apuntar ---------- */
  function fijaApunte(vx, vy) {
    const m = Math.hypot(vx, vy);
    if (m > OR_VMAX) { vx *= OR_VMAX / m; vy *= OR_VMAX / m; }
    apunta = { vx, vy };
    previa = null;
    sincMando();
  }
  function sincMando() {
    if (!host || !apunta) return;
    const ang = Math.round(Math.atan2(apunta.vy, apunta.vx) * 180 / Math.PI);
    const pot = Math.round(Math.hypot(apunta.vx, apunta.vy) / OR_VMAX * 100);
    const a = host.querySelector(".jg-orb-ang"), q = host.querySelector(".jg-orb-pot");
    if (document.activeElement !== a) a.value = ang;
    if (document.activeElement !== q) q.value = pot;
    host.querySelector(".jg-orb-angv").textContent = ang + "°";
    host.querySelector(".jg-orb-potv").textContent = pot + " %";
  }
  function desdeMando() {
    const ang = Number(host.querySelector(".jg-orb-ang").value) * Math.PI / 180;
    const pot = Number(host.querySelector(".jg-orb-pot").value) / 100 * OR_VMAX;
    fijaApunte(Math.cos(ang) * pot, Math.sin(ang) * pot);
  }
  function miBase() { const i = asiento(uid); return i >= 0 && est.bases[i]; }
  function abajo(ev) {
    if (!miTurno()) return;
    const b = miBase(); if (!b) return;
    arrastra = true;
    cv.setPointerCapture(ev.pointerId);
    const c = aCampo(ev);
    fijaApunte((c.x - b.x) / FUERZA, (c.y - b.y) / FUERZA);
  }
  function mueve(ev) {
    if (!arrastra || !miTurno()) return;
    const b = miBase(), c = aCampo(ev);
    fijaApunte((c.x - b.x) / FUERZA, (c.y - b.y) / FUERZA);
  }
  function arriba() { arrastra = false; }

  /* La previa es la sonda sola por el campo: sin los satélites, que
     pueden derribarla, y cortada en `PREVIA` pasos. */
  function calculaPrevia() {
    const b = miBase();
    if (!b || !apunta) return null;
    const puntos = [];
    const res = orTurno(est.mundo, [{ id: -1, u: uid, x: b.x, y: b.y, vx: apunta.vx, vy: apunta.vy, vida: 1, vivo: true, nueva: true }], est.estrellas,
      (i, objs) => { if (i < PREVIA && objs[0].vivo) puntos.push(objs[0].x, objs[0].y); });
    const toca = new Set(res.eventos.filter(e => e.k === "estrella" && e.p < PREVIA).map(e => e.s));
    return { puntos, toca };
  }

  /* El camino del próximo turno de lo que ya orbita (sin sonda nueva). */
  function calculaFuturos() {
    const clave = est.movs + ":" + est.objetos.length;
    if (futClave === clave) return futuros;
    futClave = clave;
    const rastro = {};
    orTurno(est.mundo, est.objetos.map(o => ({ ...o, vivo: true })), [], (i, objs) => {
      if (i % 5) return;
      for (const o of objs) if (o.vivo) (rastro[o.id] || (rastro[o.id] = [])).push(o.x, o.y);
    });
    futuros = rastro;
    return futuros;
  }

  async function lanzar() {
    if (!miTurno() || !apunta) return;
    enviando = true;
    host.querySelector(".jg-orb-error").textContent = "";
    pinta();
    try {
      const ok = await jugar({ t: "lanza", uid, vx: Math.round(apunta.vx * 100), vy: Math.round(apunta.vy * 100) });
      if (ok === false && !muerto) host.querySelector(".jg-orb-error").textContent = "No se pudo lanzar. Inténtalo de nuevo.";
    } catch (e) {
      if (!muerto) host.querySelector(".jg-orb-error").textContent = "No se pudo lanzar. Inténtalo de nuevo.";
    } finally { enviando = false; if (!muerto) pinta(); }
  }

  /* ---------- contar un turno ---------- */
  function cuenta(u) {
    const mi = ++gen;
    const cuadros = [];
    const inicio = [...u.antes.objetos.map(o => ({ ...o, vivo: true })), { ...u.lanza, vivo: true }];
    orTurno(est.mundo, inicio, u.antes.estrellas, (i, objs) => {
      cuadros.push(objs.map(o => o.vivo ? [o.id, o.u, o.x, o.y] : null).filter(Boolean));
    });
    const porPaso = {};
    for (const e of u.eventos) (porPaso[e.p] || (porPaso[e.p] = [])).push(e);
    anim = { gen: mi, u, cuadros, porPaso, i: 0, rastros: {}, fuera: new Set(), apagadas: false,
      nuevas: est.estrellas.filter(s => !u.antes.estrellas.some(a => a.id === s.id)).map(s => s.id) };
    apunta = null; previa = null;
    suena("lanza");
    const b = est.bases[asiento(u.uid)];
    if (b) for (let n = 0; n < 14; n++) chispa(b.x, b.y, color(u.uid), 1.4);
    pinta();
  }

  function avanzaAnim() {
    const a = anim;
    if (!a || a.gen !== gen) { anim = null; return; }
    for (let s = 0; s < POR_CUADRO && a.i < a.cuadros.length; s++, a.i++) {
      for (const [id, , x, y] of a.cuadros[a.i]) {
        const r = a.rastros[id] || (a.rastros[id] = []);
        r.push(x, y); if (r.length > 90) r.splice(0, 2);
      }
      for (const e of a.porPaso[a.i] || []) suceso(e);
    }
    if (a.i >= a.cuadros.length) {
      for (const e of a.porPaso[OR_PASOS] || []) suceso(e);
      anim = null;
      for (const s of est.estrellas) if (a.nuevas.includes(s.id)) anillo(s.x, s.y, "#fff8", 5);
      pinta();
      if (ctx.listo) ctx.listo();
    }
  }

  function suceso(e) {
    const a = anim;
    if (e.k === "estrella") {
      a.fuera.add("s" + e.s);
      suena("capta", e.v);
      texto(e.x, e.y, "+" + e.v, color(e.u), e.v >= 5 ? 1.6 : 1);
      for (let n = 0; n < 6 + e.v * 3; n++) chispa(e.x, e.y, e.v >= 5 ? "#f0abfc" : "#fde68a", 1);
    } else if (e.k === "choque") {
      suena("revienta");
      sacude = 10;
      for (let n = 0; n < 40; n++) chispa(e.x, e.y, n % 2 ? color(e.us[0]) : color(e.us[1]), 2.2);
      anillo(e.x, e.y, "#fff", 9);
      if (e.quien) texto(e.x, e.y - 3, "¡Derribo! +" + e.v, color(e.quien), 1.3);
    } else if (e.k === "cae") {
      suena("golpe");
      sacude = Math.max(sacude, 5);
      for (let n = 0; n < 22; n++) chispa(e.x, e.y, "#fb923c", 1.5);
      anillo(e.x, e.y, "#fdba74", 6);
    } else if (e.k === "pierde") {
      texto(Math.max(4, Math.min(OR_W - 4, e.x)), Math.max(4, Math.min(OR_H - 4, e.y)), "perdida", "#94a3b8", 0.8);
    } else if (e.k === "apaga") {
      anillo(e.x, e.y, color(e.u) + "aa", 4);
    }
    if (e.id !== undefined && e.k !== "estrella") a.fuera.add("o" + e.id);
    if (e.ids) e.ids.forEach(id => a.fuera.add("o" + id));
  }

  /* ---------- efectos ---------- */
  function chispa(x, y, c, f) {
    const ang = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * f;
    efectos.push({ t: "c", x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, v: 1, c });
  }
  function texto(x, y, s, c, f) { efectos.push({ t: "t", x, y, s, c, v: 1, f }); }
  function anillo(x, y, c, r) { efectos.push({ t: "a", x, y, c, r, v: 1 }); }

  /* ---------- dibujo ---------- */
  function pintaFondo() {
    const clave = cw + "x" + ch + ":" + (p && p.semilla);
    if (fondoClave === clave && fondo) return;
    fondoClave = clave;
    fondo = document.createElement("canvas");
    fondo.width = cv.width; fondo.height = cv.height;
    const f = fondo.getContext("2d");
    f.scale(dpr, dpr);
    const bg = f.createLinearGradient(0, 0, cw, ch);
    bg.addColorStop(0, "#0b0820"); bg.addColorStop(1, "#110b2a");
    f.fillStyle = bg; f.fillRect(0, 0, cw, ch);
    const r = rng(((p && p.semilla) || 7) ^ 0x51A9);
    for (let n = 0; n < 3; n++) {
      const x = r() * cw, y = r() * ch, rad = (0.25 + r() * 0.3) * cw;
      const ng = f.createRadialGradient(x, y, 0, x, y, rad);
      ng.addColorStop(0, ["#7c3aed22", "#0ea5e91c", "#db277718"][n]); ng.addColorStop(1, "#0000");
      f.fillStyle = ng; f.fillRect(0, 0, cw, ch);
    }
    for (let n = 0; n < 260; n++) {
      const x = r() * cw, y = r() * ch, s = r();
      f.fillStyle = "rgba(255,255,255," + (0.15 + s * 0.6).toFixed(2) + ")";
      f.fillRect(x, y, s > 0.93 ? 2 : 1, s > 0.93 ? 2 : 1);
    }
    /* Pozos de gravedad: anillos tenues alrededor de cada astro. */
    for (const c of est.cuerpos) {
      for (let m = 2; m <= 5; m++) {
        f.strokeStyle = "rgba(167,139,250," + (0.13 - m * 0.02).toFixed(2) + ")";
        f.setLineDash([2, 5]); f.lineWidth = 1;
        f.beginPath(); f.arc(X(c.x), Y(c.y), X(c.r * m * (c.sol ? 1.2 : 1.5)), 0, Math.PI * 2); f.stroke();
      }
    }
    f.setLineDash([]);
  }

  function astro(c, t) {
    const x = X(c.x), y = Y(c.y), r = X(c.r);
    if (c.sol) {
      const pul = 1 + Math.sin(t / 600) * 0.06;
      const halo = g.createRadialGradient(x, y, r * 0.5, x, y, r * 3.2 * pul);
      halo.addColorStop(0, "#fde68acc"); halo.addColorStop(0.35, "#f59e0b44"); halo.addColorStop(1, "#f59e0b00");
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 3.2 * pul, 0, Math.PI * 2); g.fill();
      const nuc = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      nuc.addColorStop(0, "#fffbe8"); nuc.addColorStop(0.5, "#fcd34d"); nuc.addColorStop(1, "#ea580c");
      g.fillStyle = nuc; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      return;
    }
    const [cl, os] = PLANETAS[(c.tono || 0) % PLANETAS.length];
    const halo = g.createRadialGradient(x, y, r, x, y, r * 1.9);
    halo.addColorStop(0, cl + "40"); halo.addColorStop(1, cl + "00");
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 1.9, 0, Math.PI * 2); g.fill();
    const cuerpo = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    cuerpo.addColorStop(0, cl); cuerpo.addColorStop(1, os);
    g.fillStyle = cuerpo; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    if ((c.tono || 0) % 2 === 0) {
      g.strokeStyle = cl + "88"; g.lineWidth = Math.max(1, r * 0.15);
      g.beginPath(); g.ellipse(x, y, r * 1.7, r * 0.45, -0.35, 0, Math.PI * 2); g.stroke();
    }
  }

  function estrella(s, t, encendida) {
    const x = X(s.x), y = Y(s.y);
    const base = [0, 1.2, 1.55, 1.9, 0, 2.5][s.v] * k * 0.9;
    const tw = 1 + Math.sin(t / 300 + s.id * 1.7) * (s.v >= 5 ? 0.25 : 0.1);
    const r = base * tw;
    const col = s.v >= 5 ? "#f0abfc" : s.v === 3 ? "#fcd34d" : s.v === 2 ? "#67e8f9" : "#e2e8f0";
    const halo = g.createRadialGradient(x, y, 0, x, y, r * 3);
    halo.addColorStop(0, col + (encendida ? "aa" : "55")); halo.addColorStop(1, col + "00");
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = col;
    g.beginPath();
    for (let n = 0; n < 8; n++) {
      const ang = n * Math.PI / 4 + (s.v >= 5 ? t / 1500 : 0), rr = n % 2 ? r * 0.35 : r;
      g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    g.closePath(); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, r * 0.28, 0, Math.PI * 2); g.fill();
    if (encendida) {
      g.strokeStyle = "#fff"; g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y, X(OR_CAPTURA), 0, Math.PI * 2); g.stroke();
    }
    if (s.v > 1) {
      /* El valor va en una chapa al lado: dentro del destello no se leía. */
      const fs = Math.max(10, k * 1.7), bx = x + base * 1.05, by = y - base * 1.05, br = fs * 0.62;
      g.fillStyle = col; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#0b0820"; g.font = "800 " + fs + "px system-ui,sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(s.v), bx, by + 0.5);
    }
  }

  function base(b, i, t) {
    const u = est.jugadores[i] && est.jugadores[i].uid;
    if (!u || (est.fuera && est.fuera[u])) return;
    const x = X(b.x), y = Y(b.y), c = color(u), activa = est.fase === "jugando" && est.turno === u && !anim;
    const r = X(2.6) * (activa ? 1 + Math.sin(t / 250) * 0.12 : 1);
    if (activa) {
      g.strokeStyle = c; g.globalAlpha = 0.4; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r * 2.2, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    g.fillStyle = "#0b0820"; g.strokeStyle = c; g.lineWidth = 2.5;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = c; g.font = "700 " + Math.max(9, k * 2.2) + "px system-ui,sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText((nombre(u)[0] || "?").toUpperCase(), x, y + 0.5);
  }

  function satelite(x, y, u, vida, nuevo) {
    const c = color(u);
    const halo = g.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), X(2.4));
    halo.addColorStop(0, c + "cc"); halo.addColorStop(1, c + "00");
    g.fillStyle = halo; g.beginPath(); g.arc(X(x), Y(y), X(2.4), 0, Math.PI * 2); g.fill();
    g.fillStyle = nuevo ? "#fff" : c;
    g.beginPath(); g.arc(X(x), Y(y), Math.max(2.5, X(0.9)), 0, Math.PI * 2); g.fill();
    if (vida) {
      g.strokeStyle = c; g.lineWidth = 1.5;
      const tot = 2 * Math.max(2, est.jugadores.filter(j => !est.fuera[j.uid]).length);
      g.beginPath(); g.arc(X(x), Y(y), X(1.7), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, vida / tot)); g.stroke();
    }
  }

  function linea(pts, c, alfa, guion, ancho) {
    if (!pts || pts.length < 4) return;
    g.strokeStyle = c; g.globalAlpha = alfa; g.lineWidth = ancho || 1.5;
    g.setLineDash(guion || []);
    g.beginPath(); g.moveTo(X(pts[0]), Y(pts[1]));
    for (let i = 2; i < pts.length; i += 2) g.lineTo(X(pts[i]), Y(pts[i + 1]));
    g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  }

  function cuadro(t) {
    if (muerto) return;
    raf = requestAnimationFrame(cuadro);
    if (!est || !est.mundo || !cw) return;
    if (anim) avanzaAnim();
    pintaFondo();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    let dx = 0, dy = 0;
    if (sacude > 0.2) { dx = (Math.random() - 0.5) * sacude; dy = (Math.random() - 0.5) * sacude; sacude *= 0.86; }
    g.clearRect(0, 0, cw, ch);
    g.drawImage(fondo, dx, dy, cw, ch);
    g.save(); g.translate(dx, dy);

    for (const c of est.cuerpos) astro(c, t);
    est.bases.forEach((b, i) => base(b, i, t));

    if (anim) {
      const a = anim;
      for (const s of a.u.antes.estrellas) if (!a.fuera.has("s" + s.id)) estrella(s, t, false);
      for (const id in a.rastros) {
        const cuad = a.cuadros[Math.min(a.i, a.cuadros.length) - 1] || [];
        const o = cuad.find(q => String(q[0]) === id);
        const u = o ? o[1] : (a.u.antes.objetos.find(q => String(q.id) === id) || a.u.lanza).u;
        linea(a.rastros[id], color(u), o ? 0.75 : 0.25, null, String(id) === String(a.u.lanza.id) ? 2.5 : 1.5);
      }
      const cuad = a.cuadros[Math.min(a.i, a.cuadros.length) - 1] || [];
      for (const [id, u, x, y] of cuad) satelite(x, y, u, 0, id === a.u.lanza.id);
    } else {
      const tocadas = previa ? previa.toca : null;
      for (const s of est.estrellas) estrella(s, t, !!(tocadas && tocadas.has(s.id)));
      const fut = est.fase === "jugando" ? calculaFuturos() : {};
      for (const o of est.objetos) linea(fut[o.id], color(o.u), 0.35, [2, 4], 1.2);
      for (const o of est.objetos) satelite(o.x, o.y, o.u, o.vida, false);
      if (apunta && miTurno()) {
        if (!previa) previa = calculaPrevia();
        const b = miBase();
        if (previa && b) {
          linea([b.x, b.y].concat(previa.puntos), "#ffffff", 0.9, [5, 5], 2);
          const n = previa.puntos.length;
          if (n >= 2) {
            g.fillStyle = "#fff";
            g.beginPath(); g.arc(X(previa.puntos[n - 2]), Y(previa.puntos[n - 1]), 3, 0, Math.PI * 2); g.fill();
          }
          g.strokeStyle = color(uid); g.lineWidth = 3;
          g.beginPath(); g.moveTo(X(b.x), Y(b.y)); g.lineTo(X(b.x + apunta.vx * 2.2), Y(b.y + apunta.vy * 2.2)); g.stroke();
        }
      }
    }

    /* efectos */
    efectos = efectos.filter(e => e.v > 0);
    for (const e of efectos) {
      if (e.t === "c") {
        e.x += e.vx * 0.5; e.y += e.vy * 0.5; e.vx *= 0.94; e.vy *= 0.94; e.v -= 0.025;
        g.globalAlpha = Math.max(0, e.v); g.fillStyle = e.c;
        g.fillRect(X(e.x) - 1.5, Y(e.y) - 1.5, 3, 3);
      } else if (e.t === "t") {
        e.y -= 0.12; e.v -= 0.012;
        g.globalAlpha = Math.max(0, Math.min(1, e.v * 1.6)); g.fillStyle = e.c;
        g.font = "800 " + Math.round(Math.max(12, k * 3.2) * e.f) + "px system-ui,sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.strokeStyle = "#0b0820"; g.lineWidth = 3; g.strokeText(e.s, X(e.x), Y(e.y)); g.fillText(e.s, X(e.x), Y(e.y));
      } else {
        e.v -= 0.03;
        g.globalAlpha = Math.max(0, e.v); g.strokeStyle = e.c; g.lineWidth = 2;
        g.beginPath(); g.arc(X(e.x), Y(e.y), X(e.r * (1.6 - e.v)), 0, Math.PI * 2); g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.restore();
  }

  /* ---------- lo que no es lienzo ---------- */
  function pinta() {
    if (!host || !est) return;
    const turnoDe = est.turno;
    let fase;
    if (est.fase === "espera") fase = "Esperando jugadores…";
    else if (anim || pendiente >= 0) fase = (anim ? nombre(anim.u.uid) : "") + (anim && anim.u.uid === uid ? " lanzas…" : " lanza…");
    else if (est.fase === "fin") fase = est.ganador === "" ? "Empate en el firmamento" : est.ganador === uid ? "¡Ganaste la órbita!" : "Gana " + nombre(est.ganador);
    else if (turnoDe === uid) fase = enviando ? "Lanzando…" : "Tu turno · apunta desde tu base y lanza";
    else fase = "Turno de " + nombre(turnoDe);
    host.querySelector(".jg-orb-fase").textContent = fase;
    host.querySelector(".jg-orb-ronda").textContent = est.fase === "espera" ? "" : "Ronda " + Math.min(est.ronda, est.rondas) + " de " + est.rondas;

    const cuentaSat = u => est.objetos.filter(o => o.u === u).length;
    const f = JSON.stringify([est.puntos, est.turno, est.fase, est.jugadores.map(j => j.uid + j.nombre), est.objetos.length, est.lanzados, est.fuera, !!anim]);
    if (f !== firma) {
      firma = f;
      host.querySelector(".jg-orb-marcador").innerHTML = est.jugadores.map((j, i) => {
        const fuera = est.fuera[j.uid];
        const sube = est.ultima && !anim && (est.ultima.ganado || {})[j.uid];
        return '<span class="jg-orb-chip' + (est.turno === j.uid && !anim ? " activo" : "") + (fuera ? " fuera" : "") + (sube ? " jg-m-sube" : "") +
          '" style="--c:' + PALETA[i % PALETA.length] + '"><i></i><span class="n">' + esc(nombre(j.uid)) + '</span><b>' + (est.puntos[j.uid] || 0) +
          '</b><small title="Satélites en órbita">🛰 ' + cuentaSat(j.uid) + ' · ' + (est.lanzados[j.uid] || 0) + '/' + est.rondas + '</small></span>';
      }).join("");
    }
    const puede = miTurno();
    const mando = host.querySelector(".jg-orb-mando");
    mando.classList.toggle("off", !puede);
    for (const el of mando.querySelectorAll("input,button")) el.disabled = !puede;
    host.querySelector(".jg-orb-lanza").disabled = !puede || !apunta;
    host.querySelector(".jg-orb-aviso").textContent = puede && !apunta ? "Toca el campo para apuntar desde tu base" : "";
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    if (!host) return;
    const nuevo = vistos >= 0 && est.movs > vistos && est.ultima;
    const solo = nuevo && est.movs === vistos + 1;
    vistos = est.movs;
    if (nuevo) { apunta = null; previa = null; }
    if (solo && document.hidden) pendiente = est.movs;
    else if (solo) cuenta(est.ultima);
    else if (nuevo && anim) { gen++; anim = null; }
    if (est.fase === "jugando" && est.turno === uid && !apunta && !ocupado()) {
      const b = miBase();
      if (b) fijaApunte((80 - b.x) / FUERZA * 0.5, b.y < 50 ? 2.2 : -2.2);
    }
    pinta();
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at) && est.jugadores.some(j => j.uid === uid)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir, ocupado };
}
