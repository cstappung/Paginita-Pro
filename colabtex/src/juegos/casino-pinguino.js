/* Pingüinito (#casino/pinguino): un pingüino salta de témpano en témpano.
   Cada salto que aguanta sube el multiplicador; plantarse cobra la apuesta
   por él; si el hielo se rompe, se pierde. Llegar al último témpano cobra
   solo.

   Cada salto es una marca `s/<i>` con la hora del servidor, y esa hora
   decide si el témpano aguanta (casino-motor.js): nada está decidido antes
   de saltar. El salto se anima en cuanto se aprieta el botón y el pingüino
   tambalea en el aire si la respuesta tarda, para que la red no se note. */
import { PINGUINO, multPinguino, resuelvePinguino, APUESTA_MIN, pagoDe, formatoPago } from "./casino-motor.js";
import { formatoMonedas } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";

const lee = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } };
const guarda = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
const SALTO = 0.5;   // s que dura el vuelo de un témpano al siguiente

export function montarPinguino(h, api) {
  const { uid, suena, formatoMult } = api;
  let dif = Math.max(0, Math.min(PINGUINO.length - 1, Math.round(+lee("jg.casino.pinguino.d", 1)) || 0));
  const raiz = document.createElement("div");
  raiz.className = "jg-cs-juego jg-cs-pg";
  raiz.innerHTML = `
    <div class="jg-cs-escena">
      <canvas aria-label="El pingüino sobre el hielo"></canvas>
      <div class="jg-cs-hud" data-hud></div>
    </div>
    <div class="jg-cs-panel">
      <div class="jg-cs-fila">
        <label class="jg-cs-lbl">Dificultad</label>
        <div class="jg-cs-difs" data-difs>${PINGUINO.map((x, i) => `<button type="button" data-d="${i}">
          <b>${x.nombre}</b><small>se rompe 1 de cada ${Math.round(1 / x.cae)}</small><em>hasta ${formatoMult(multPinguino(i, x.n))}</em></button>`).join("")}</div>
      </div>
      <div class="jg-cs-fila">
        <label class="jg-cs-lbl">Apuesta <small data-tope></small></label>
        <div class="jg-cs-monto">
          <button type="button" data-paso="-1" aria-label="Menos">−</button>
          <span>${MONEDA}<input type="number" inputmode="numeric" min="${APUESTA_MIN}" step="1" data-p></span>
          <button type="button" data-paso="1" aria-label="Más">+</button>
        </div>
        <div class="jg-cs-chips">
          <button type="button" data-x="min">Mín</button><button type="button" data-x="0.5">½</button>
          <button type="button" data-x="2">2×</button><button type="button" data-x="max">Máx</button>
        </div>
      </div>
      <div class="jg-cs-acciones">
        <button type="button" class="jg-cs-boton" data-jugar></button>
        <button type="button" class="jg-cs-boton salta" data-saltar hidden></button>
        <button type="button" class="jg-cs-boton retira" data-plantar hidden></button>
      </div>
      <p class="jg-cs-msg" data-msg role="status"></p>
    </div>
    <aside class="jg-cs-caja jg-cs-lado"><h3>Grandes premios</h3><div data-feed></div></aside>
    <details class="jg-cs-reglas"><summary>Cómo funciona</summary>
      <p>Elige la dificultad y apuesta. Con cada «Saltar», el pingüino salta al témpano siguiente: si aguanta, el multiplicador sube; si se rompe, el pingüino cae al agua y pierdes la apuesta. «Plantarse» cobra la apuesta por el multiplicador del témpano donde estás. Llegar al último cobra solo.</p>
      <p>${PINGUINO.map(x => `${x.nombre}: se rompe 1 de cada ${Math.round(1 / x.cae)}, ${x.n} témpanos, apuesta de ${APUESTA_MIN} a ${formatoMonedas(x.max)}`).join(". ")}.</p>
      <p>El multiplicador de cada témpano es justo menos un 3 %: plantarse donde sea devuelve en promedio 97 de cada 100 monedas. Ningún témpano está decidido antes de saltar: lo sortea la hora exacta en que el servidor recibe el salto.</p>
    </details>`;
  h.appendChild(raiz);
  const $ = s => raiz.querySelector(s);
  const lienzo = $("canvas"), g = lienzo.getContext("2d");
  const inP = $("[data-p]"), bJugar = $("[data-jugar]"), bSaltar = $("[data-saltar]"), bPlantar = $("[data-plantar]"), msg = $("[data-msg]");
  inP.value = String(Math.round(+lee("jg.casino.pinguino.p", 50)) || 50);

  let activa = null, ultimo = null, vivo = true, retomada = false;
  const tope = () => PINGUINO[activa ? activa.r.d : dif].max;
  const apuesta = () => Math.max(APUESTA_MIN, Math.min(tope(), Math.round(+inP.value) || APUESTA_MIN));
  function ponMsg(t, tipo = "") { msg.textContent = t || ""; msg.className = "jg-cs-msg " + tipo; }

  function pinta() {
    const ro = activa, D = PINGUINO[ro ? ro.r.d : dif];
    for (const b of raiz.querySelectorAll("[data-d]")) { b.classList.toggle("on", +b.dataset.d === (ro ? ro.r.d : dif)); b.disabled = !!ro; }
    for (const el of raiz.querySelectorAll(".jg-cs-panel input, .jg-cs-panel [data-x], .jg-cs-panel [data-paso]")) el.disabled = !!ro;
    $("[data-tope]").textContent = `(${APUESTA_MIN}–${formatoMonedas(D.max)})`;
    const jugando = !!(ro && !ro.fin);
    bJugar.hidden = jugando; bSaltar.hidden = !jugando; bPlantar.hidden = !jugando;
    if (!jugando) { bJugar.disabled = !!ro; bJugar.innerHTML = `${ultimo ? "Jugar otra vez" : "Jugar"} · <b>${formatoMonedas(apuesta())}</b> ${MONEDA}`; }
    else {
      const sig = multPinguino(ro.r.d, ro.n + 1);
      bSaltar.disabled = !!ro.pend;
      bSaltar.innerHTML = `Saltar <small>→ ${formatoMult(sig)}</small>`;
      bPlantar.disabled = !!ro.pend || ro.n === 0;
      bPlantar.innerHTML = ro.n === 0 ? "Plantarse" : `Plantarse <b>${formatoPago(pagoDe(ro.r.p, multPinguino(ro.r.d, ro.n)))}</b> ${MONEDA}`;
    }
    const hud = $("[data-hud]");
    hud.innerHTML = ro ? `<span>${D.nombre}</span><span>Apuesta <b>${formatoMonedas(ro.r.p)}</b></span><span>Témpano <b>${ro.n}/${D.n}</b></span>` : "";
  }

  /* ---------- la ronda ---------- */
  async function jugar() {
    const p = apuesta();
    inP.value = String(p); guarda("jg.casino.pinguino.p", p); guarda("jg.casino.pinguino.d", dif);
    bJugar.disabled = true; ponMsg("");
    try {
      const { k, at } = await api.apostar("p", p, dif);
      suena("ficha");
      activa = { k, r: { j: "p", p, d: dif, at, s: {} }, n: 0 };
      ultimo = null;
      escena.coloca(0, dif);
    } catch (e) {
      ponMsg(e && e.message && !/PERMISSION/i.test(e.message) ? e.message : "No se pudo apostar. Si recién se estrenó el casino, faltan las reglas de la base.", "mal");
      suena("pierde");
      bJugar.disabled = false;
    }
    pinta();
  }
  async function saltar() {
    const ro = activa;
    if (!ro || ro.fin || ro.pend) return;
    ro.pend = true; pinta();
    escena.salta(ro.n);
    suena("salta");
    try {
      const i = Object.keys(ro.r.s).length;
      ro.r.s[i] = await api.marca(ro.k, "s/" + i);
      const res = resuelvePinguino(uid, ro.k, ro.r);
      if (res.estado === "perdida") { ro.fin = { tipo: "cae" }; escena.aterriza(false); }
      else {
        ro.n = res.n; escena.aterriza(true);
        if (res.estado === "cobrada") { ro.fin = { tipo: "cobro", mult: res.mult, pago: res.pago }; api.cobrado(ro.k, res.pago); setTimeout(() => escena.celebra(res.pago), 350); }
      }
    } catch (e) {
      console.warn("[casino] salto", e);
      escena.vuelve();
      ponMsg("No se pudo saltar. Inténtalo otra vez.", "mal");
    }
    ro.pend = false;
    if (ro.fin) setTimeout(() => cierra(ro), ro.fin.tipo === "cae" ? 1900 : 2200);
    pinta();
  }
  async function plantarse() {
    const ro = activa;
    if (!ro || ro.fin || ro.pend || ro.n === 0) return;
    ro.pend = true; pinta();
    try {
      ro.r.c = await api.marca(ro.k, "c");
      const res = resuelvePinguino(uid, ro.k, ro.r);
      ro.fin = { tipo: "cobro", mult: res.mult, pago: res.pago };
      api.cobrado(ro.k, res.pago);
      escena.celebra(res.pago);
      setTimeout(() => cierra(ro), 2000);
    } catch (e) {
      console.warn("[casino] plantarse", e);
      ponMsg("No se pudo cobrar. Inténtalo otra vez.", "mal");
    }
    ro.pend = false; pinta();
  }
  function cierra(ro) {
    if (activa !== ro) return;
    activa = null; ultimo = ro;
    pinta(); pintaFeed();
  }
  function pintaFeed() { $("[data-feed]").innerHTML = api.feedHtml(6); }

  /* ---------- la escena ---------- */
  const escena = (() => {
    let W = 0, H = 0, dpr = 1, cam = 0, raf = 0, prev = performance.now();
    let d = dif, n = 0, mov = null, rompe = null, fiesta = null, parts = [], flotan = [], anillos = [], burbujas = [], aplasta = 0;
    const lejos = Array.from({ length: 9 }, (_, i) => ({ x: i * 0.31 + Math.random() * 0.1, h: 0.4 + Math.random() * 0.6, w: 0.18 + Math.random() * 0.14 }));
    const copos = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.05, r: 0.6 + Math.random() * 1.6, f: Math.random() * 6.3 }));
    function mide() {
      const r = lienzo.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(280, r.width); H = Math.max(240, r.height);
      lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    }
    const obs = typeof ResizeObserver === "function" ? new ResizeObserver(mide) : null;
    if (obs) obs.observe(lienzo); else window.addEventListener("resize", mide);
    mide();
    const paso = () => Math.max(96, Math.min(150, W / 4.3));
    const agua = () => H * 0.64;
    const esc = () => paso() / 130;
    const tx = i => i * paso();
    const tamTempano = i => (i === 0 ? 1.6 : (1.1 - 0.35 * PINGUINO[d].cae) * (1 - 0.012 * i));
    const bob = (i, t) => Math.sin(t * 1.7 + i * 1.3) * 2.2;

    function pingu(x, y, s, { sq = 0, ang = 0, aletas = 0, ojos = 1, feliz = false, alfa = 1 } = {}) {
      g.save(); g.translate(x, y); g.rotate(ang); g.scale(s * (1 + sq * 0.25), s * (1 - sq * 0.25)); g.globalAlpha = alfa;
      // sombra en el hielo la pinta quien llama
      g.fillStyle = "#ff9f1c";
      g.beginPath(); g.ellipse(-8, 0, 7, 3.2, 0, 0, 6.29); g.fill();
      g.beginPath(); g.ellipse(8, 0, 7, 3.2, 0, 0, 6.29); g.fill();
      g.fillStyle = "#1b1d2b";
      g.beginPath(); g.ellipse(0, -26, 17, 25, 0, 0, 6.29); g.fill();
      // aletas
      for (const lado of [-1, 1]) {
        g.save(); g.translate(lado * 15, -30); g.rotate(lado * (0.25 + aletas * 1.1));
        g.beginPath(); g.ellipse(0, 10, 4.5, 13, 0, 0, 6.29); g.fill(); g.restore();
      }
      g.fillStyle = "#fbfdff";
      g.beginPath(); g.ellipse(0, -20, 11.5, 18, 0, 0, 6.29); g.fill();
      g.fillStyle = "#1b1d2b"; g.beginPath(); g.ellipse(0, -44, 14, 12, 0, 0, 6.29); g.fill();
      // cara
      g.fillStyle = "#fff";
      g.beginPath(); g.ellipse(-5.5, -45, 4.2, 4.6 * ojos, 0, 0, 6.29); g.fill();
      g.beginPath(); g.ellipse(5.5, -45, 4.2, 4.6 * ojos, 0, 0, 6.29); g.fill();
      g.fillStyle = "#111";
      if (feliz) { g.lineWidth = 1.8; g.strokeStyle = "#111"; for (const ox of [-5.5, 5.5]) { g.beginPath(); g.arc(ox, -43.5, 2.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }
      else { g.beginPath(); g.arc(-4.6, -44.6, 2 * ojos, 0, 6.29); g.fill(); g.beginPath(); g.arc(6.4, -44.6, 2 * ojos, 0, 6.29); g.fill(); }
      g.fillStyle = "#ff9f1c"; g.beginPath(); g.moveTo(-4.5, -40); g.lineTo(4.5, -40); g.lineTo(0, -34.5); g.closePath(); g.fill();
      g.fillStyle = "#ff7aa255"; g.beginPath(); g.arc(-9, -38, 2.6, 0, 6.29); g.arc(9, -38, 2.6, 0, 6.29); g.fill();
      g.restore();
    }
    function tempano(i, x, y, t, sobre) {
      const s = esc() * tamTempano(i), rx = 46 * s, ry = 11 * s, alto = 9 * s;
      if (i === 0) {
        // la orilla: un iceberg con nieve
        g.fillStyle = "#cfe9fb";
        g.beginPath(); g.moveTo(x - 110 * s * 0.7, y + alto); g.lineTo(x - 70 * s, y - 50 * s); g.lineTo(x - 30 * s, y - 32 * s); g.lineTo(x - 6 * s, y - 64 * s); g.lineTo(x + 26 * s, y - 20 * s); g.lineTo(x + rx, y); g.lineTo(x + rx, y + alto); g.closePath(); g.fill();
        g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(x - 70 * s, y - 50 * s); g.lineTo(x - 52 * s, y - 40 * s); g.lineTo(x - 30 * s, y - 32 * s); g.lineTo(x - 6 * s, y - 64 * s); g.lineTo(x + 12 * s, y - 38 * s); g.lineTo(x - 30 * s, y - 26 * s); g.closePath(); g.fill();
      }
      // reflejo en el agua
      g.fillStyle = "#ffffff14"; g.beginPath(); g.ellipse(x, y + alto + 6 * s, rx * 1.05, ry * 0.7, 0, 0, 6.29); g.fill();
      g.fillStyle = "#7fb8e0"; g.beginPath(); g.ellipse(x, y + alto, rx, ry, 0, 0, 6.29); g.fill();
      g.fillRect(x - rx, y, rx * 2, alto);
      const sup = g.createLinearGradient(0, y - ry, 0, y + ry);
      sup.addColorStop(0, "#ffffff"); sup.addColorStop(1, sobre ? "#fff4cf" : "#d8efff");
      g.fillStyle = sup; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.29); g.fill();
      g.strokeStyle = sobre ? "#ffcf5a" : "#bfe3fb"; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = "#ffffffaa"; g.beginPath(); g.ellipse(x - rx * 0.35, y - ry * 0.3, rx * 0.25, ry * 0.25, -0.2, 0, 6.29); g.fill();
    }
    function etiqueta(x, y, txt, modo, t) {
      g.font = "800 13px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      const w = g.measureText(txt).width + 16, alto = 22, pul = modo === "sig" ? 1 + 0.06 * Math.sin(t * 6) : 1;
      g.save(); g.translate(x, y); g.scale(pul, pul);
      g.fillStyle = modo === "sig" ? "#ffcf3f" : modo === "pasado" ? "#ffffff55" : modo === "meta" ? "#ff5c8a" : "#0b3a6bcc";
      if (modo === "sig") { g.shadowColor = "#ffcf3f"; g.shadowBlur = 14; }
      g.beginPath(); g.roundRect(-w / 2, -alto / 2, w, alto, 11); g.fill(); g.shadowBlur = 0;
      g.fillStyle = modo === "sig" ? "#3b2500" : "#fff"; g.fillText(txt, 0, 1);
      g.restore();
    }
    function fondo(t, dt) {
      const cielo = g.createLinearGradient(0, 0, 0, agua());
      cielo.addColorStop(0, "#1a3a7a"); cielo.addColorStop(0.55, "#5aa3e0"); cielo.addColorStop(1, "#cfeeff");
      g.fillStyle = cielo; g.fillRect(0, 0, W, agua() + 2);
      // la aurora
      for (let k = 0; k < 3; k++) {
        g.globalAlpha = 0.16; g.strokeStyle = ["#7dffcf", "#9b8cff", "#5cf2ff"][k]; g.lineWidth = 18 - k * 4;
        g.beginPath();
        for (let x = -20; x <= W + 20; x += 20) { const y = H * (0.12 + k * 0.05) + Math.sin(x / 90 + t * 0.5 + k) * 14; x === -20 ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.stroke();
      }
      g.globalAlpha = 1;
      // icebergs lejanos (paralaje)
      g.fillStyle = "#e9f6ff";
      for (const b of lejos) {
        const ancho = b.w * W, x = ((b.x * W * 1.4 - cam * 0.25) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2, base = agua();
        g.globalAlpha = 0.75;
        g.beginPath(); g.moveTo(x, base); g.lineTo(x + ancho * 0.3, base - b.h * 60); g.lineTo(x + ancho * 0.5, base - b.h * 44); g.lineTo(x + ancho * 0.7, base - b.h * 70); g.lineTo(x + ancho, base); g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      // el mar
      const mar = g.createLinearGradient(0, agua(), 0, H);
      mar.addColorStop(0, "#2a7cc2"); mar.addColorStop(1, "#0a2f5c");
      g.fillStyle = mar; g.fillRect(0, agua(), W, H - agua());
      g.strokeStyle = "#ffffff26"; g.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        const y = agua() + 14 + k * (H - agua()) / 5;
        g.beginPath();
        for (let x = 0; x <= W; x += 12) { const yy = y + Math.sin((x + cam * (0.6 + k * 0.1)) / 30 + t * 1.6 + k) * 2.4; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
        g.stroke();
      }
      // copos
      g.fillStyle = "#ffffff";
      for (const c of copos) {
        c.y += c.v * dt; if (c.y > 1) c.y -= 1;
        g.globalAlpha = 0.6; g.beginPath(); g.arc(((c.x * W + Math.sin(t + c.f) * 8 - cam * 0.1) % W + W) % W, c.y * H, c.r, 0, 6.29); g.fill();
      }
      g.globalAlpha = 1;
    }
    function nieve(x, y, k, col = ["#ffffff", "#d8efff"]) {
      for (let i = 0; i < k; i++) { const a = -Math.PI * Math.random(), v = 40 + Math.random() * 120; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.5 + Math.random() * 0.4, r: 1.5 + Math.random() * 2.5, c: col[i % col.length], g: 340 }); }
    }
    function cuadro() {
      if (!vivo) return;
      raf = requestAnimationFrame(cuadro);
      const ahoraP = performance.now(), dt = Math.min(0.05, (ahoraP - prev) / 1000); prev = ahoraP;
      const t = ahoraP / 1000, s = esc(), D = PINGUINO[d];
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // dónde está el pingüino (en el mundo)
      let px = tx(n), py = 0, ang = 0, aletas = 0, sq = aplasta, alfa = 1, enAgua = false;
      aplasta = Math.max(0, aplasta - dt * 5);
      if (mov) {
        const u = Math.min(1, (t - mov.t0) / SALTO);
        px = tx(mov.desde) + (tx(mov.desde + 1) - tx(mov.desde)) * u;
        py = -4 * 78 * s * u * (1 - u);
        aletas = Math.sin(u * Math.PI);
        sq = u < 0.12 ? 0.6 * (1 - u / 0.12) : -0.35 * Math.sin(u * Math.PI);
        if (u >= 1) {
          if (mov.ok === null) { ang = Math.sin(t * 18) * 0.18; aletas = 0.6 + 0.4 * Math.sin(t * 22); }   // tambalea mientras llega la respuesta
          else if (mov.ok) { n = mov.desde + 1; mov = null; aplasta = 0.8; suena("aterriza", n); nieve(tx(n) - cam + W * 0, agua(), 14); }
          else if (!rompe) { rompe = { i: mov.desde + 1, t0: t }; suena("cruje"); }
        }
      }
      if (rompe) {
        const e = t - rompe.t0;
        px = tx(rompe.i);
        if (e < 0.3) { ang = Math.sin(t * 40) * 0.1; aletas = 1; }
        else {
          const c = e - 0.3; py = 160 * c * c * 1.8; aletas = 1; ang = 0.4 * Math.min(1, c * 2);
          if (py > 8 * s && !rompe.agua) { rompe.agua = true; suena("chapuzon"); anillos.push({ x: tx(rompe.i), t: 0 }); nieve(tx(rompe.i) - cam, agua(), 26, ["#bfe6ff", "#ffffff", "#7cc4f5"]); }
          if (rompe.agua) { enAgua = true; alfa = Math.max(0, 1 - c * 0.9); if (Math.random() < 0.3) burbujas.push({ x: tx(rompe.i) + (Math.random() - 0.5) * 30 * s, y: agua() + 30 * s, t: 0, r: 2 + Math.random() * 3 }); }
        }
      }
      // la cámara sigue al pingüino
      const obj = px - W * 0.3;
      cam += (obj - cam) * Math.min(1, dt * 4);
      fondo(t, dt);
      // anillos en el agua
      anillos = anillos.filter(a => (a.t += dt) < 1.6);
      for (const a of anillos) { g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - a.t / 1.6)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(a.x - cam, agua() + 6 * s, 20 + a.t * 70, 5 + a.t * 16, 0, 0, 6.29); g.stroke(); }
      // los témpanos
      for (let i = 0; i <= D.n; i++) {
        const x = tx(i) - cam;
        if (x < -120 || x > W + 120) continue;
        let y = agua() + bob(i, t);
        if (rompe && rompe.i === i) {
          const e = t - rompe.t0;
          if (e > 0.25) {
            // se parte en dos y se hunde
            const c = e - 0.25, sep = Math.min(30, c * 60) * s, hunde = c * c * 60 * s;
            g.save(); g.beginPath(); g.rect(0, 0, W, agua() + 16 * s); g.clip();
            g.globalAlpha = Math.max(0, 1 - c * 0.7);
            g.save(); g.translate(x - sep, y + hunde); g.rotate(-0.25 * Math.min(1, c)); g.beginPath(); g.rect(-80 * s, -40 * s, 80 * s, 80 * s); g.clip(); tempano(i, 0, 0, t, false); g.restore();
            g.save(); g.translate(x + sep, y + hunde * 1.2); g.rotate(0.3 * Math.min(1, c)); g.beginPath(); g.rect(0, -40 * s, 80 * s, 80 * s); g.clip(); tempano(i, 0, 0, t, false); g.restore();
            g.restore();
            continue;
          }
          tempano(i, x, y, t, false);
          // las grietas
          g.strokeStyle = "#2a5b85"; g.lineWidth = 1.8; g.beginPath();
          g.moveTo(x - 4 * s, y - 9 * s); g.lineTo(x + 3 * s, y - 2 * s); g.lineTo(x - 2 * s, y + 3 * s); g.lineTo(x + 5 * s, y + 9 * s);
          g.moveTo(x + 3 * s, y - 2 * s); g.lineTo(x + 18 * s, y - 4 * s); g.moveTo(x - 2 * s, y + 3 * s); g.lineTo(x - 20 * s, y + 5 * s); g.stroke();
          continue;
        }
        const pisado = i <= n && i > 0;
        tempano(i, x, y, t, pisado);
        if (i === D.n) {
          // la meta: una bandera
          g.strokeStyle = "#5b4636"; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 22 * s, y); g.lineTo(x + 22 * s, y - 62 * s); g.stroke();
          g.fillStyle = "#ff3d6e"; g.beginPath(); g.moveTo(x + 22 * s, y - 62 * s); g.quadraticCurveTo(x + 38 * s, y - 56 * s + Math.sin(t * 5) * 3, x + 52 * s, y - 54 * s); g.lineTo(x + 22 * s, y - 44 * s); g.closePath(); g.fill();
        }
        if (i > 0) {
          const modo = i === D.n && i > n ? (i === n + 1 && activa && !activa.fin ? "sig" : "meta") : i <= n ? "pasado" : i === n + 1 && activa && !activa.fin ? "sig" : "";
          etiqueta(x, y - 72 * s, formatoMult(multPinguino(d, i)), modo, t);
        }
      }
      // el pingüino
      const sx = px - cam, sy = agua() + bob(rompe ? rompe.i : n, t) + py;
      if (!enAgua) { g.fillStyle = "#00000022"; g.beginPath(); g.ellipse(sx, agua() + bob(n, t), 16 * s * (1 - Math.min(0.6, -py / (150 * s))), 4 * s, 0, 0, 6.29); g.fill(); }
      if (fiesta) {
        const e = t - fiesta.t0, salto = Math.abs(Math.sin(e * 7)) * 22 * s * Math.max(0, 1 - e / 2.2);
        g.save(); if (enAgua) { g.beginPath(); g.rect(0, 0, W, agua() + 2); g.clip(); }
        pingu(sx, sy - salto, s, { aletas: 0.6 + 0.4 * Math.sin(e * 14), feliz: true });
        g.restore();
      } else {
        const parpadea = (t % 3.4) < 0.12 ? 0.15 : 1;
        g.save(); if (enAgua) { g.beginPath(); g.rect(0, 0, W, agua() + 4 * s); g.clip(); }
        pingu(sx, sy, s, { sq, ang, aletas, ojos: rompe ? 1.25 : parpadea, alfa });
        g.restore();
      }
      // partículas, burbujas y el «+X»
      parts = parts.filter(p => (p.t += dt) < p.vida);
      for (const p of parts) {
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = 1 - p.t / p.vida; g.fillStyle = p.c;
        if (p.moneda) { g.save(); g.translate(p.x, p.y); g.scale(Math.cos(p.t * 12), 1); g.beginPath(); g.arc(0, 0, p.r, 0, 6.29); g.fill(); g.strokeStyle = "#9a6a08"; g.lineWidth = 1; g.stroke(); g.restore(); }
        else { g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.29); g.fill(); }
      }
      burbujas = burbujas.filter(b => (b.t += dt) < 1.2);
      for (const b of burbujas) { g.globalAlpha = 0.7 * (1 - b.t / 1.2); g.strokeStyle = "#e6f7ff"; g.lineWidth = 1.2; g.beginPath(); g.arc(b.x - cam + Math.sin(b.t * 9) * 3, b.y - b.t * 40, b.r, 0, 6.29); g.stroke(); }
      g.globalAlpha = 1;
      flotan = flotan.filter(f => (f.t += dt) < 2);
      for (const f of flotan) {
        g.globalAlpha = Math.min(1, 2 * (2 - f.t)); g.font = "800 28px system-ui, sans-serif"; g.textAlign = "center";
        g.fillStyle = "#ffd54a"; g.shadowColor = "#0008"; g.shadowBlur = 8; g.fillText(f.txt, f.x - cam, f.y - f.t * 50); g.shadowBlur = 0;
      }
      g.globalAlpha = 1;
      // el multiplicador de ahora, arriba
      const ro = activa || ultimo;
      if (ro) {
        const m = ro.fin && ro.fin.tipo === "cobro" ? ro.fin.mult : multPinguino(d, n);
        const caido = ro.fin && ro.fin.tipo === "cae" && rompe && t - rompe.t0 > 0.4;
        g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 ${Math.min(52, W / 9)}px system-ui, sans-serif`;
        g.fillStyle = caido ? "#ff4d6d" : ro.fin && ro.fin.tipo === "cobro" ? "#33e07a" : "#ffffff"; g.shadowColor = "#06204a"; g.shadowBlur = 14;
        g.fillText(caido ? "¡AL AGUA!" : formatoMult(m), W / 2, H * 0.12); g.shadowBlur = 0;
      } else {
        g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 ${Math.min(34, W / 13)}px system-ui, sans-serif`;
        g.fillStyle = "#ffffff"; g.shadowColor = "#06204a"; g.shadowBlur = 12; g.fillText("Elige dificultad y apuesta", W / 2, H * 0.12); g.shadowBlur = 0;
      }
    }
    raf = requestAnimationFrame(cuadro);
    return {
      coloca(nn, dd) { d = dd; n = nn; mov = null; rompe = null; fiesta = null; anillos = []; burbujas = []; },
      dificultad(dd) { if (!activa) { d = dd; n = 0; rompe = null; fiesta = null; } },
      salta(desde) { mov = { desde, t0: performance.now() / 1000, ok: null }; aplasta = 0; },
      aterriza(ok) { if (mov) mov.ok = ok; },
      vuelve() { mov = null; },
      celebra(pago) {
        fiesta = { t0: performance.now() / 1000 };
        const x = tx(n) - cam, y = agua() - 70 * esc();
        flotan.push({ x: tx(n), y, t: 0, txt: "+" + formatoPago(pago) + " 🪙" });
        for (let i = 0; i < 40; i++) { const a = -Math.PI * (0.1 + 0.8 * Math.random()), v = 120 + Math.random() * 220; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 1 + Math.random() * 0.8, r: 3 + Math.random() * 3, c: ["#ffd54a", "#f5b819", "#fff2a8"][i % 3], g: 420, moneda: true }); }
        suena("cobra", pago >= 2000 ? 5 : pago >= 500 ? 4 : 2);
      },
      destruir() { cancelAnimationFrame(raf); if (obs) obs.disconnect(); else window.removeEventListener("resize", mide); }
    };
  })();

  /* ---------- los controles ---------- */
  bJugar.onclick = () => { if (!activa) jugar(); };
  bSaltar.onclick = () => saltar();
  bPlantar.onclick = () => plantarse();
  raiz.querySelector("[data-difs]").onclick = e => {
    const b = e.target.closest("[data-d]");
    if (!b || activa) return;
    dif = +b.dataset.d; guarda("jg.casino.pinguino.d", dif); ultimo = null;
    escena.dificultad(dif); inP.value = String(apuesta()); suena("clic"); pinta();
  };
  raiz.querySelector(".jg-cs-panel").addEventListener("click", e => {
    const b = e.target.closest("button[data-x], button[data-paso]");
    if (!b || activa) return;
    let p = apuesta();
    if (b.dataset.paso) p += (+b.dataset.paso) * (p >= 200 ? 50 : p >= 50 ? 10 : 5);
    else if (b.dataset.x === "min") p = APUESTA_MIN;
    else if (b.dataset.x === "max") { const c = api.cuenta(); p = c ? Math.min(tope(), Math.max(APUESTA_MIN, c.saldo)) : tope(); }
    else p = Math.round(p * +b.dataset.x);
    inP.value = String(Math.max(APUESTA_MIN, Math.min(tope(), p)));
    suena("clic"); pinta();
  });
  inP.oninput = () => pinta();
  inP.onchange = () => { inP.value = String(apuesta()); pinta(); };
  const tecla = e => {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "")) return;
    if (e.code === "Space" || e.code === "ArrowRight") { e.preventDefault(); if (activa && !activa.fin) saltar(); else if (!activa) jugar(); }
    else if (e.code === "Enter" && activa && !activa.fin) { e.preventDefault(); plantarse(); }
  };
  document.addEventListener("keydown", tecla);
  inP.value = String(apuesta());
  escena.coloca(0, dif);
  pinta();

  return {
    /* Al llegar los datos: los premios y, una vez, retomar una partida que
       quedó abierta (sin caer ni plantarse): sigue donde estaba. */
    datos() {
      pintaFeed();
      if (retomada || activa) return;
      const e = api.economia(), rs = api.rondas();
      if (!e) return;
      retomada = true;
      const r = Object.values(e.rondas).filter(x => x.u === uid && x.j === "p" && x.estado === "juega" && x.valida).sort((a, b) => b.at - a.at)[0];
      if (!r || !rs[r.k]) return;
      const x = rs[r.k];
      activa = { k: r.k, r: { j: "p", p: x.p, d: x.d, at: x.at, s: Object.assign({}, x.s || {}) }, n: r.n };
      dif = x.d;
      escena.coloca(r.n, x.d);
      ponMsg(`Retomaste tu partida: vas en el témpano ${r.n}.`, "info");
      pinta();
    },
    destruir() {
      vivo = false; escena.destruir();
      document.removeEventListener("keydown", tecla);
      raiz.remove();
    }
  };
}
