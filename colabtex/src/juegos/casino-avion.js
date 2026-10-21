/* El Avión (#casino/avion): un avión despega y el multiplicador sube con
   él hasta que se estrella. Quien se retira antes cobra su apuesta por el
   multiplicador de ese instante.

   El choque no está escrito en ningún sitio: mientras vuela, esta pantalla
   avisa al servidor cada `AVISO` ms (`t/<i>` = la hora del servidor) y el
   motor decide con esa hora si el tramo que acaba de pasar se sobrevivió
   (casino-motor.js). Retirarse es otra marca igual (`c`). Así que lo que se
   ve va un poco por detrás del reloj (`RETRASO`): cuando el aviso trae un
   choque, casi siempre llega antes de que la curva lo alcance y el avión
   revienta justo en su punto, en vez de saltar hacia atrás. */
import { AVION, multAvion, horaAvion, resuelveAvion, pagoDe, formatoPago } from "./casino-motor.js";
import { formatoMonedas } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";
import { salidaFx, silenciado } from "./sonido.js";

const RETRASO = 280;
const lee = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } };
const guarda = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
const espera = ms => new Promise(r => setTimeout(r, ms));
const baja2 = x => Math.floor(x * 100 + 1e-9) / 100;
const coma = (x, n = 2) => x.toLocaleString("es-CL", { minimumFractionDigits: n, maximumFractionDigits: n });

export function montarAvion(h, api) {
  const { uid, suena, formatoMult } = api;
  const raiz = document.createElement("div");
  raiz.className = "jg-cs-juego jg-cs-av";
  raiz.innerHTML = `
    <div class="jg-cs-escena">
      <canvas aria-label="El avión en vuelo"></canvas>
      <div class="jg-cs-hist" data-hist aria-label="Tus últimas rondas"></div>
    </div>
    <div class="jg-cs-panel">
      <div class="jg-cs-fila">
        <label class="jg-cs-lbl">Apuesta</label>
        <div class="jg-cs-monto">
          <button type="button" data-paso="-1" aria-label="Menos">−</button>
          <span>${MONEDA}<input type="number" inputmode="numeric" min="${AVION.min}" max="${AVION.max}" step="1" data-p></span>
          <button type="button" data-paso="1" aria-label="Más">+</button>
        </div>
        <div class="jg-cs-chips">
          <button type="button" data-x="min">Mín</button><button type="button" data-x="0.5">½</button>
          <button type="button" data-x="2">2×</button><button type="button" data-x="max">Máx</button>
        </div>
      </div>
      <div class="jg-cs-fila">
        <label class="jg-cs-lbl jg-cs-auto"><input type="checkbox" data-auto> Retiro automático en</label>
        <div class="jg-cs-monto chico"><span>×<input type="number" inputmode="decimal" min="1.01" max="${AVION.TOPE}" step="0.01" data-meta></span></div>
      </div>
      <button type="button" class="jg-cs-boton" data-accion></button>
      <p class="jg-cs-msg" data-msg role="status"></p>
    </div>
    <aside class="jg-cs-caja jg-cs-lado"><h3>Grandes premios</h3><div data-feed></div></aside>
    <details class="jg-cs-reglas"><summary>Cómo funciona</summary>
      <p>Apuesta entre ${AVION.min} y ${AVION.max} monedas. El avión despega y el multiplicador sube: ×2 a los 6 segundos, ×10 a los 21. Retírate cuando quieras y cobras tu apuesta por el multiplicador de ese momento. Si se estrella antes, la pierdes. En ×${AVION.TOPE} se va del cielo: lo que no se retiró, se pierde.</p>
      <p>A veces se estrella al despegar (3 de cada 100 vuelos). Fuera de eso, la probabilidad de llegar a ×<i>m</i> es 0,97 / <i>m</i>: llegar a ×2 pasa 48,5 veces de cada 100, a ×10 casi 10. Da igual cuándo te retires: en promedio el juego devuelve 97 de cada 100 monedas. No hay sistema que gane a la larga.</p>
      <p>Nadie decide el choque de antemano, tampoco esta página: mientras vuela, se avisa al servidor varias veces por segundo y cada aviso sortea, con la hora exacta en que llegó, si el avión aguantó hasta ahí.</p>
    </details>`;
  h.appendChild(raiz);
  const $ = s => raiz.querySelector(s);
  const lienzo = $("canvas"), g = lienzo.getContext("2d");
  const inP = $("[data-p]"), inMeta = $("[data-meta]"), chkAuto = $("[data-auto]"), boton = $("[data-accion]"), msg = $("[data-msg]");
  inP.value = String(Math.max(AVION.min, Math.min(AVION.max, Math.round(+lee("jg.casino.avion.p", 50)) || 50)));
  inMeta.value = coma(Math.max(1.01, +lee("jg.casino.avion.meta", 2) || 2)).replace(",", ".");
  chkAuto.checked = lee("jg.casino.avion.auto", "0") === "1";

  /* ---------- la ronda ---------- */
  let activa = null, vivo = true, retomada = false, ultimo = null;
  const apuesta = () => Math.max(AVION.min, Math.min(AVION.max, Math.round(+inP.value) || AVION.min));
  const meta = () => { const m = +String(inMeta.value).replace(",", "."); return Number.isFinite(m) && m >= 1.01 ? Math.min(m, AVION.TOPE) : null; };
  function ponMsg(t, tipo = "") { msg.textContent = t || ""; msg.className = "jg-cs-msg " + tipo; }

  function evalua(ro) {
    if (ro.fin) return;
    const res = resuelveAvion(uid, ro.k, ro.r, api.ahora());
    if (res.estado === "perdida") {
      const C = res.choque || AVION.TOPE;
      ro.fin = { tipo: "choque", C, ms: horaAvion(ro.r.at, C) };
    } else if (res.estado === "cobrada") {
      ro.fin = { tipo: "cobro", mult: res.mult, pago: res.pago, ms: res.fin };
      api.cobrado(ro.k, res.pago);
    }
  }
  async function avisos(ro) {
    let i = Object.keys(ro.r.t).length;
    const despegue = ro.r.at + AVION.ESPERA;
    while (vivo && activa === ro && api.ahora() < despegue - 60) await espera(Math.min(200, despegue - api.ahora()));
    while (vivo && activa === ro && !ro.fin && !ro.retirando && i < 1000) {
      const t0 = performance.now();
      try {
        const ms = await api.marca(ro.k, "t/" + i);
        ro.r.t[i] = ms;
        evalua(ro);
      } catch (e) {
        /* Un aviso que ya existe (otra pestaña, una ronda retomada) o un
           corte de red: se sigue con el siguiente. */
        console.warn("[casino] aviso", e);
        await espera(400);
      }
      i++;
      await espera(Math.max(0, AVION.AVISO - (performance.now() - t0)));
    }
  }
  async function apostar() {
    const p = apuesta();
    inP.value = String(p); guarda("jg.casino.avion.p", p);
    const m = meta(); if (m) guarda("jg.casino.avion.meta", m);
    boton.disabled = true; ponMsg("");
    try {
      const { k, at } = await api.apostar("a", p);
      suena("ficha");
      empieza({ k, r: { j: "a", p, at, t: {} } });
    } catch (e) {
      ponMsg(e && e.message && !/PERMISSION/i.test(e.message) ? e.message : "No se pudo apostar. Si recién se estrenó el casino, faltan las reglas de la base.", "mal");
      suena("pierde");
    }
    boton.disabled = false; pintaBoton();
  }
  function empieza(ro) {
    ro.meta = chkAuto.checked ? meta() : null;
    ro.inicio = performance.now();
    activa = ro; ultimo = null;
    evalua(ro);   // el choque al despegar se sabe ya
    avisos(ro);
    escena.reinicia();
    pintaBoton();
  }
  async function retirar() {
    const ro = activa;
    if (!ro || ro.fin || ro.retirando) return;
    ro.retirando = true; pintaBoton();
    try {
      ro.r.c = await api.marca(ro.k, "c");
      evalua(ro);
    } catch (e) {
      console.warn("[casino] retiro", e);
      ro.retirando = false;
      ponMsg("No se pudo retirar. Inténtalo otra vez.", "mal");
      avisos(ro);
    }
    pintaBoton();
  }
  /* Termina lo que se ve: el resultado queda pintado hasta la próxima. */
  function cierra(ro) {
    if (activa !== ro) return;
    activa = null;
    ultimo = ro;
    pintaBoton(); pintaHist();
  }

  function pintaBoton() {
    const ro = activa;
    boton.classList.remove("retira", "espera");
    for (const el of raiz.querySelectorAll(".jg-cs-panel input, .jg-cs-panel [data-x], .jg-cs-panel [data-paso]")) el.disabled = !!ro;
    if (!ro) { boton.disabled = false; boton.innerHTML = `Apostar <b>${formatoMonedas(apuesta())}</b> ${MONEDA}`; return; }
    if (ro.fin && ro.fin.tipo === "cobro") { boton.disabled = true; boton.classList.add("espera"); boton.innerHTML = `Cobraste <b>${formatoPago(ro.fin.pago)}</b> ${MONEDA}`; return; }
    if (ro.fin && ro.fin.tipo === "choque" && vista(ro).choco) { boton.disabled = true; boton.classList.add("espera"); boton.innerHTML = "Se estrelló…"; return; }
    if (ro.retirando) { boton.disabled = true; boton.classList.add("retira"); boton.innerHTML = "Retirando…"; return; }
    const antes = api.ahora() < ro.r.at + AVION.ESPERA;
    boton.disabled = false; boton.classList.add("retira");
    boton.innerHTML = antes ? `Retirarse <small>(devuelve ${formatoMonedas(ro.r.p)})</small>` : `Retirarse <b data-vale>${formatoPago(pagoDe(ro.r.p, baja2(vista(ro).m)))}</b> ${MONEDA}`;
  }
  function pintaHist() {
    const e = api.economia();
    if (!e) return;
    const l = Object.values(e.rondas).filter(r => r.u === uid && r.j === "a" && r.estado !== "vuela").sort((a, b) => b.at - a.at).slice(0, 16);
    const el = $("[data-hist]"), h = l.map(r => r.estado === "cobrada"
      ? `<span class="ok" title="Te retiraste: +${formatoPago(r.pago - r.p)}">${formatoMult(r.mult)}</span>`
      : `<span class="${r.choque >= 2 ? "medio" : "mal"}" title="Se estrelló">${r.choque ? formatoMult(r.choque) : "—"}</span>`).join("");
    // solo si cambió: rehacerlo reinicia la animación de entrada de cada una
    if (el.dataset.sig !== h) { el.dataset.sig = h; el.innerHTML = h; }
    api.pintaFeed($("[data-feed]"), 6);
  }

  /* Lo que se ve de una ronda en este instante (con el retraso). */
  function vista(ro) {
    const tv = api.ahora() - RETRASO;
    if (ro.fin && ro.fin.tipo === "choque" && tv >= ro.fin.ms) return { m: ro.fin.C, t: ro.fin.ms - ro.r.at - AVION.ESPERA, choco: true };
    /* Después de cobrar, la curva se queda donde te bajaste: lo que habría
       hecho el avión después no está decidido. */
    if (ro.fin && ro.fin.tipo === "cobro" && tv >= ro.fin.ms) return { m: ro.fin.mult, t: Math.max(0, ro.fin.ms - ro.r.at - AVION.ESPERA) };
    const m = multAvion(ro.r.at, tv);
    return { m, t: Math.max(0, tv - ro.r.at - AVION.ESPERA), antes: tv < ro.r.at + AVION.ESPERA, falta: ro.r.at + AVION.ESPERA - tv };
  }

  /* ---------- el motor del avión (sonido continuo) ---------- */
  let zumbido = null;
  function zumba(on, m = 1) {
    if (on && !zumbido && !silenciado()) {
      const s = salidaFx();
      if (!s) return;
      const a = s.ctx, o1 = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), v = a.createGain();
      o1.type = "sawtooth"; o2.type = "square"; o2.detune.value = 9;
      f.type = "lowpass"; f.frequency.value = 380; f.Q.value = 3;
      v.gain.value = 0.0001; v.gain.setTargetAtTime(0.035, a.currentTime, 0.3);
      o1.connect(f); o2.connect(f); f.connect(v); v.connect(s.destino);
      o1.start(); o2.start();
      zumbido = { a, o1, o2, f, v };
    }
    if (!on && zumbido) {
      const z = zumbido; zumbido = null;
      z.v.gain.setTargetAtTime(0.0001, z.a.currentTime, 0.08);
      setTimeout(() => { try { z.o1.stop(); z.o2.stop(); z.v.disconnect(); } catch (e) {} }, 400);
      return;
    }
    if (zumbido) {
      const t = zumbido.a.currentTime, base = 52 + 30 * Math.log(m);
      zumbido.o1.frequency.setTargetAtTime(base, t, 0.1);
      zumbido.o2.frequency.setTargetAtTime(base * 1.5, t, 0.1);
      zumbido.f.frequency.setTargetAtTime(380 + 160 * Math.log(m), t, 0.1);
    }
  }

  /* ---------- la escena ---------- */
  const escena = (() => {
    let W = 0, H = 0, dpr = 1, escT = 8, escM = 2, sacude = 0, prev = performance.now(), nube = 0;
    let parts = [], flotan = [], fase = "", hitos = 0, salida = 0, raf = 0;
    const estrellas = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.8, r: Math.random() * 1.3 + 0.3, f: Math.random() * 6.28 }));
    const nubes = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: 0.12 + Math.random() * 0.6, s: 0.6 + Math.random() * 0.9, v: 0.3 + Math.random() * 0.7, k: i }));
    function mide() {
      const r = lienzo.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(280, r.width); H = Math.max(240, r.height);
      lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    }
    const obs = typeof ResizeObserver === "function" ? new ResizeObserver(mide) : null;
    if (obs) obs.observe(lienzo); else window.addEventListener("resize", mide);
    mide();
    const M0 = { l: 50, r: 22, t: 26, b: 34 };
    const X = t => M0.l + (t / escT) * (W - M0.l - M0.r);
    const Y = m => H - M0.b - ((m - 1) / (escM - 1)) * (H - M0.t - M0.b);
    function chispas(x, y, n, colores, fuerza = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 260) * fuerza;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, vida: 0.7 + Math.random() * 0.9, t: 0, r: 1.5 + Math.random() * 3.5, c: colores[i % colores.length], g: 260 });
      }
    }
    function avion(x, y, ang, esc, alfa = 1) {
      g.save(); g.translate(x, y); g.rotate(ang); g.scale(esc, esc); g.globalAlpha = alfa;
      // sombra suave
      g.shadowColor = "#ff3d6e88"; g.shadowBlur = 18;
      g.fillStyle = "#e8304a";
      g.beginPath(); g.moveTo(-26, -5); g.quadraticCurveTo(-10, -9, 16, -6); g.quadraticCurveTo(27, -4, 29, 0); g.quadraticCurveTo(27, 4, 16, 6); g.quadraticCurveTo(-10, 9, -26, 5); g.closePath(); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#b81d34";
      g.beginPath(); g.moveTo(-2, -5); g.lineTo(-15, -25); g.lineTo(-6, -25); g.lineTo(11, -5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-2, 5); g.lineTo(-13, 20); g.lineTo(-6, 20); g.lineTo(10, 5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-24, -4); g.lineTo(-33, -16); g.lineTo(-26, -16); g.lineTo(-18, -4); g.closePath(); g.fill();
      g.fillStyle = "#ffffff55"; g.fillRect(-20, -2.4, 30, 1.6);
      g.fillStyle = "#9fe3ff"; g.beginPath(); g.moveTo(8, -4.5); g.quadraticCurveTo(17, -4.5, 20, 0); g.lineTo(8, 0); g.closePath(); g.fill();
      const hel = (performance.now() / 30) % 2;
      g.fillStyle = "#ffffffaa"; g.beginPath(); g.ellipse(30, 0, 2, 13 * Math.abs(1 - hel), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffd36b"; g.beginPath(); g.arc(30, 0, 2.2, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    function fondo(dt, m, vuela) {
      const cielo = g.createLinearGradient(0, 0, 0, H);
      const k = Math.min(1, Math.log(m) / Math.log(50));
      cielo.addColorStop(0, `rgb(${10 + 6 * k},${12 - 4 * k},${44 + 20 * k})`);
      cielo.addColorStop(0.65, `rgb(${52 + 40 * k},${28 + 6 * k},${96 + 30 * k})`);
      cielo.addColorStop(1, `rgb(${128 + 60 * k},${44 + 10 * k},${100 - 10 * k})`);
      g.fillStyle = cielo; g.fillRect(0, 0, W, H);
      const t = performance.now() / 1000;
      for (const s of estrellas) {
        g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + s.f));
        g.fillStyle = "#fff"; g.beginPath(); g.arc(s.x * W, s.y * H, s.r, 0, 6.29); g.fill();
      }
      g.globalAlpha = 1;
      // nubes en paralaje: más rápidas cuanto más alto el multiplicador
      nube += dt * (vuela ? 0.04 + 0.02 * Math.log(m) : 0.008);
      for (const c of nubes) {
        const x = ((c.x - nube * c.v) % 1.3 + 1.3) % 1.3 - 0.15, y = c.y * H, s = c.s * Math.min(W, 700) / 700;
        g.globalAlpha = 0.07 + 0.06 * c.v;
        g.fillStyle = "#e9dcff";
        for (const [dx, dy, r] of [[0, 0, 26], [24, -10, 22], [48, 0, 24], [22, 8, 22], [-20, 6, 16], [68, 8, 15]]) { g.beginPath(); g.arc(x * W + dx * s, y + dy * s, r * s, 0, 6.29); g.fill(); }
      }
      g.globalAlpha = 1;
    }
    function ejes() {
      g.strokeStyle = "#ffffff1c"; g.lineWidth = 1; g.fillStyle = "#ffffff88"; g.font = "600 11px system-ui, sans-serif";
      const pasoM = escM <= 2 ? 0.25 : escM <= 4 ? 0.5 : escM <= 10 ? 1 : escM <= 25 ? 5 : escM <= 60 ? 10 : 20;
      g.textAlign = "right"; g.textBaseline = "middle";
      for (let m = 1; m <= escM + 1e-9; m += pasoM) {
        const y = Y(m); g.beginPath(); g.moveTo(M0.l, y); g.lineTo(W - M0.r, y); g.stroke();
        g.fillText("×" + (Number.isInteger(m) ? m : coma(m, (m * 2) % 1 ? 2 : 1)), M0.l - 7, y);
      }
      const pasoT = escT <= 10 ? 2 : escT <= 24 ? 4 : 10;
      g.textAlign = "center"; g.textBaseline = "top";
      for (let s = 0; s <= escT + 1e-9; s += pasoT) { const x = X(s); g.fillText(s + " s", x, H - M0.b + 8); }
      g.strokeStyle = "#ffffff40"; g.beginPath(); g.moveTo(M0.l, M0.t - 8); g.lineTo(M0.l, H - M0.b); g.lineTo(W - M0.r + 6, H - M0.b); g.stroke();
    }
    function curva(tFin) {
      const pts = [];
      const n = 70;
      for (let i = 0; i <= n; i++) { const s = tFin * i / n; pts.push([X(s), Y(Math.exp(AVION.K * s))]); }
      const relleno = g.createLinearGradient(0, Y(escM), 0, H - M0.b);
      relleno.addColorStop(0, "#ff3d6e55"); relleno.addColorStop(1, "#ff3d6e05");
      g.beginPath(); g.moveTo(pts[0][0], H - M0.b);
      for (const [x, y] of pts) g.lineTo(x, y);
      g.lineTo(pts[n][0], H - M0.b); g.closePath(); g.fillStyle = relleno; g.fill();
      const trazo = g.createLinearGradient(M0.l, 0, pts[n][0], 0);
      trazo.addColorStop(0, "#ff9f43"); trazo.addColorStop(1, "#ff3d6e");
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.lineWidth = 4; g.lineCap = "round"; g.strokeStyle = trazo; g.shadowColor = "#ff3d6e"; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0;
      const [x1, y1] = pts[n - 1], [x2, y2] = pts[n];
      return { x: x2, y: y2, ang: Math.atan2(y2 - y1, x2 - x1) };
    }
    function texto(txt, sub, color, y = 0.36, tam = 1) {
      const t = Math.min(W / 6.5, 74) * tam;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `800 ${t}px system-ui, sans-serif`;
      g.shadowColor = color; g.shadowBlur = 26; g.fillStyle = color; g.fillText(txt, W / 2 + 16, H * y);
      g.shadowBlur = 0; g.fillStyle = "#fff"; g.globalAlpha = 0.92; g.fillText(txt, W / 2 + 16, H * y); g.globalAlpha = 1;
      if (sub) { g.font = `700 ${Math.max(12, t * 0.24)}px system-ui, sans-serif`; g.fillStyle = "#ffffffcc"; g.fillText(sub, W / 2 + 16, H * y + t * 0.62); }
    }
    function cuadro() {
      if (!vivo) return;
      raf = requestAnimationFrame(cuadro);
      const ahoraP = performance.now(), dt = Math.min(0.05, (ahoraP - prev) / 1000); prev = ahoraP;
      const ro = activa || ultimo;
      const v = ro ? vista(ro) : { m: 1, t: 0, antes: true };
      const vuela = !!(activa && !v.antes && !v.choco);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (sacude > 0) { sacude = Math.max(0, sacude - dt * 2.2); g.translate((Math.random() - 0.5) * 14 * sacude, (Math.random() - 0.5) * 14 * sacude); }
      fondo(dt, v.m, vuela);
      // la escala se estira con el vuelo, sin saltos
      const objT = Math.max(8, v.t / 1000 * 1.22), objM = Math.max(2, 1 + (v.m - 1) * 1.3);
      escT += (objT - escT) * Math.min(1, dt * 4); escM += (objM - escM) * Math.min(1, dt * 4);
      ejes();
      let punta = { x: X(0), y: Y(1), ang: 0 };
      if (ro && (v.t > 0 || v.choco)) punta = curva(v.t / 1000);
      /* Lo que pasó desde el último cuadro: hitos, choque, cobro. */
      if (activa) {
        const fin = activa.fin;
        if (fase === "" && !v.antes) { fase = "vuelo"; suena("despega"); zumba(true); }
        if (vuela) {
          zumba(true, v.m);
          const h2 = v.m >= 10 ? 3 : v.m >= 5 ? 2 : v.m >= 2 ? 1 : 0;
          if (h2 > hitos) { hitos = h2; suena("hito", h2); chispas(punta.x, punta.y, 14, ["#ffd36b", "#fff"], 0.5); }
          // la estela
          if (Math.random() < 0.8) parts.push({ x: punta.x - Math.cos(punta.ang) * 26, y: punta.y - Math.sin(punta.ang) * 26, vx: -40 - Math.random() * 30, vy: 10 + Math.random() * 20, vida: 0.6, t: 0, r: 2 + Math.random() * 3, c: "#ffd6e0", g: -10, humo: true });
          /* El retiro automático mira el reloj del servidor, no lo que se ve. */
          if (activa.meta && !activa.retirando && !fin && multAvion(activa.r.at, api.ahora()) >= activa.meta) retirar();
          const vale = boton.querySelector("[data-vale]");
          if (vale) vale.textContent = formatoPago(pagoDe(activa.r.p, baja2(v.m)));
        }
        if (fin && fin.tipo === "choque" && v.choco && fase !== "choque") {
          fase = "choque"; zumba(false); suena("explota"); sacude = 1; pintaBoton();
          chispas(punta.x, punta.y, 70, ["#ffcf3f", "#ff7b2e", "#ff3d3d", "#ffffff", "#555"], 1.1);
          const ro2 = activa; setTimeout(() => cierra(ro2), 1700);
        }
        if (fin && fin.tipo === "cobro" && fase !== "cobro") {
          fase = "cobro"; salida = 0;
          suena("cobra", fin.mult >= 10 ? 5 : fin.mult >= 5 ? 4 : fin.mult >= 2 ? 3 : 1);
          flotan.push({ x: punta.x, y: punta.y, t: 0, txt: "+" + formatoPago(fin.pago) });
          chispas(punta.x, punta.y, 36, ["#ffd54a", "#f5b819", "#fff6c2"], 0.8);
          const ro2 = activa; setTimeout(() => { zumba(false); cierra(ro2); }, 1900);
        }
        if (v.antes && !fin) {
          // la cuenta atrás del despegue
          const k = Math.max(0, Math.min(1, v.falta / AVION.ESPERA));
          g.fillStyle = "#ffffff22"; g.fillRect(W / 2 - 90 + 16, H * 0.5, 180, 6);
          g.fillStyle = "#ff3d6e"; g.fillRect(W / 2 - 90 + 16, H * 0.5, 180 * k, 6);
        }
      }
      // el avión
      const bob = Math.sin(performance.now() / 260) * (vuela ? 2 : 1);
      if (!(v.choco)) {
        if (fase === "cobro" && ro && ro.fin && ro.fin.tipo === "cobro") {
          salida += dt;
          const a = punta.ang - 0.25 * salida;
          avion(punta.x + salida * salida * 520 * Math.cos(a), punta.y + bob - salida * salida * 360, a, 1, Math.max(0, 1 - salida * 0.7));
        } else avion(punta.x + (ro ? 0 : 6), punta.y - 9 + bob, ro && !v.antes ? punta.ang : -0.05, 1);
      }
      // partículas
      parts = parts.filter(p => (p.t += dt) < p.vida);
      for (const p of parts) {
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const k = 1 - p.t / p.vida;
        g.globalAlpha = p.humo ? k * 0.35 : k;
        g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r * (p.humo ? 1 + p.t * 3 : k + 0.3), 0, 6.29); g.fill();
      }
      g.globalAlpha = 1;
      // el número grande
      if (!ro) texto("×1,00", "Haz tu apuesta", "#ff3d6e");
      else if (v.choco) texto(formatoMult(v.m), "SE ESTRELLÓ", "#ff2d4d");
      else if (ro.fin && ro.fin.tipo === "cobro" && fase === "cobro") texto(formatoMult(ro.fin.mult), "TE RETIRASTE A TIEMPO", "#33e07a");
      else if (v.antes && activa) texto("×1,00", "Despega en " + coma(Math.max(0, v.falta) / 1000, 1) + " s", "#ff9f43");
      else if (!activa && ultimo && ultimo.fin && ultimo.fin.tipo === "cobro") texto(formatoMult(ultimo.fin.mult), "Cobraste " + formatoPago(ultimo.fin.pago), "#33e07a");
      else texto(formatoMult(v.m), activa && activa.meta ? "retiro automático en " + formatoMult(activa.meta) : "", v.m >= 10 ? "#ff5cf0" : v.m >= 2 ? "#ffcf3f" : "#ff3d6e");
      // el «+X» que sube
      flotan = flotan.filter(f => (f.t += dt) < 1.8);
      for (const f of flotan) {
        g.globalAlpha = Math.min(1, 2 * (1.8 - f.t)); g.font = "800 26px system-ui, sans-serif"; g.textAlign = "center";
        g.fillStyle = "#ffd54a"; g.shadowColor = "#000"; g.shadowBlur = 8; g.fillText(f.txt + " 🪙", f.x - 20, f.y - 30 - f.t * 60); g.shadowBlur = 0;
      }
      g.globalAlpha = 1;
      if (activa && !activa.fin && !activa.retirando && v.antes !== (boton.dataset.antes === "1")) { boton.dataset.antes = v.antes ? "1" : "0"; pintaBoton(); }
    }
    raf = requestAnimationFrame(cuadro);
    return {
      reinicia() { fase = ""; hitos = 0; salida = 0; parts = []; flotan = []; },
      destruir() { cancelAnimationFrame(raf); if (obs) obs.disconnect(); else window.removeEventListener("resize", mide); }
    };
  })();

  /* ---------- los controles ---------- */
  boton.onclick = () => { if (!activa) apostar(); else retirar(); };
  raiz.querySelector(".jg-cs-panel").addEventListener("click", e => {
    const b = e.target.closest("button[data-x], button[data-paso]");
    if (!b || activa) return;
    let p = apuesta();
    if (b.dataset.paso) p += (+b.dataset.paso) * (p >= 200 ? 50 : p >= 50 ? 10 : 5);
    else if (b.dataset.x === "min") p = AVION.min;
    else if (b.dataset.x === "max") { const c = api.cuenta(); p = c ? Math.min(AVION.max, Math.max(AVION.min, c.saldo)) : AVION.max; }
    else p = Math.round(p * +b.dataset.x);
    inP.value = String(Math.max(AVION.min, Math.min(AVION.max, p)));
    suena("clic"); pintaBoton();
  });
  inP.oninput = () => pintaBoton();
  inP.onchange = () => { inP.value = String(apuesta()); pintaBoton(); };
  chkAuto.onchange = () => guarda("jg.casino.avion.auto", chkAuto.checked ? "1" : "0");
  inMeta.onchange = () => { const m = meta(); inMeta.value = (m || 2).toFixed(2); };
  const tecla = e => {
    if (e.code !== "Space" || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "")) return;
    e.preventDefault(); boton.click();
  };
  document.addEventListener("keydown", tecla);
  pintaBoton();

  return {
    /* Al llegar los datos: la historia y, una vez, retomar un vuelo que
       quedó en el aire (se recargó la página a medio vuelo). */
    datos() {
      pintaHist();
      if (retomada || activa) return;
      retomada = true;
      const e = api.economia(), rs = api.rondas();
      if (!e) { retomada = false; return; }
      // la economía resuelve sin reloj (todo vuelo viejo ya cayó): aquí se
      // vuelve a resolver con la hora de ahora
      const r = Object.values(e.rondas).filter(x => x.u === uid && x.j === "a" && x.valida && rs[x.k] &&
        resuelveAvion(uid, x.k, rs[x.k], api.ahora()).estado === "vuela").sort((a, b) => b.at - a.at)[0];
      if (!r || api.ahora() > horaAvion(r.at, AVION.TOPE) - 1500 || !rs[r.k]) return;
      const x = rs[r.k];
      empieza({ k: r.k, r: { j: "a", p: x.p, at: x.at, t: Object.assign({}, x.t || {}) } });
      ponMsg("Retomaste el vuelo que dejaste en el aire.", "info");
    },
    sonido() { if (silenciado()) zumba(false); else if (activa && !activa.fin && api.ahora() - RETRASO > activa.r.at + AVION.ESPERA) zumba(true); },
    destruir() {
      vivo = false; zumba(false); escena.destruir();
      document.removeEventListener("keydown", tecla);
      raiz.remove();
    }
  };
}
