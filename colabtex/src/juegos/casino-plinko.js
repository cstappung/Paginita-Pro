/* Plinko (#casino/plinko). La bola cae entre filas de clavos (8, 12 o 16)
   y en cada fila rebota a la izquierda o a la derecha; la casilla en que
   termina paga su multiplicador. Tres tablas de riesgo: más riesgo, el
   centro paga menos y los bordes mucho más (casino-motor.js).

   El camino entero sale de la hora de la apuesta, así que la bola solo
   cuenta lo que ya está decidido: su premio se esconde del saldo
   (`api.oculta`) hasta que cae. Cada bola es una ronda y pueden ir varias
   a la vez (hasta EN_VUELO); mientras haya alguna cayendo no se cambia el
   tablero, que es el que dice dónde está cada clavo.

   Todo es un lienzo: la fila i tiene i + 3 clavos separados `s`, y tras
   rebotar en ella con R derechas acumuladas la bola está en
   centro + (R − (i + 1)/2)·s. Entre clavo y clavo hace un saltito
   parabólico; el clavo que toca se ilumina y suena más agudo cuanto más
   abajo. */
import { PLINKO, APUESTA_MIN, resuelvePlinko, formatoPago } from "./casino-motor.js";
import { formatoMonedas } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";
import { lee, guarda, errorDe, htmlApuesta, ligaApuesta, teclas } from "./casino-comun.js";

const EN_VUELO = 8;
const textoMult = m => (m >= 100 ? String(Math.round(m)) : m >= 10 ? String(Math.round(m * 10) / 10).replace(".", ",") : String(m).replace(".", ","));
/* El color de una casilla: amarillo en el centro, rojo en los bordes. */
function colorCasilla(i, n) {
  const t = Math.abs(i - n / 2) / (n / 2), a = [255, 216, 77], b = [255, 45, 85];
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * Math.pow(t, 0.8))).join(",")})`;
}
const nivel = m => (m >= 10 ? 4 : m >= 3 ? 3 : m >= 1.5 ? 2 : m >= 1 ? 1 : 0);

export function montarPlinko(h, api) {
  const { uid, suena } = api;
  let d = Math.max(0, Math.min(2, Math.round(+lee("jg.casino.plinko.d", 0)) || 0));
  let n = PLINKO.filas.includes(+lee("jg.casino.plinko.n", 12)) ? +lee("jg.casino.plinko.n", 12) : 12;
  let vivo = true, pendientes = 0, hist = null;
  const bolas = [];
  const raiz = document.createElement("div");
  raiz.className = "jg-cs-juego jg-cs-pl";
  raiz.innerHTML = `
    <div class="jg-cs-escena">
      <canvas aria-label="El tablero de plinko"></canvas>
      <div class="jg-cs-pl-hist" data-hist aria-label="Tus últimas bolas"></div>
    </div>
    <div class="jg-cs-panel">
      <div class="jg-cs-fila">
        <span class="jg-cs-lbl">Riesgo</span>
        <div class="jg-cs-seg" data-riesgos>${PLINKO.riesgos.map((r, i) => `<button type="button" data-d="${i}">${r.nombre}</button>`).join("")}</div>
      </div>
      <div class="jg-cs-fila">
        <span class="jg-cs-lbl">Filas</span>
        <div class="jg-cs-seg" data-filas>${PLINKO.filas.map(f => `<button type="button" data-n="${f}">${f}</button>`).join("")}</div>
      </div>
      <div class="jg-cs-fila" data-apuesta>
        <label class="jg-cs-lbl">Apuesta <small data-rango></small></label>
        ${htmlApuesta()}
      </div>
      <div class="jg-cs-acciones"><button type="button" class="jg-cs-boton" data-soltar></button></div>
      <p class="jg-cs-msg" data-msg role="status"></p>
    </div>
    <aside class="jg-cs-caja jg-cs-lado"><h3>Grandes premios</h3><div data-feed></div></aside>
    <details class="jg-cs-reglas"><summary>Cómo funciona</summary>
      <p>Cada bola es una apuesta. Cae entre los clavos y en cada fila rebota a un lado o al otro, mitad y mitad; la casilla en que termina multiplica lo apostado. Por eso las del centro salen mucho más que las de los bordes: con 16 filas, la del borde sale una vez cada 65 536.</p>
      <p>El <b>riesgo</b> cambia la tabla: en bajo casi todo devuelve algo; en alto el centro paga poco y los bordes hasta ×${textoMult(Math.max(...PLINKO.tablas[16][2]))}. La apuesta máxima baja con el riesgo (${PLINKO.riesgos.map(r => `${r.nombre.toLowerCase()} ${formatoMonedas(r.max)}`).join(", ")}). Puedes soltar hasta ${EN_VUELO} bolas a la vez.</p>
      <p>En todas las tablas la esperanza queda en torno a 97 de cada 100 monedas. El camino lo decide la hora exacta en que el servidor recibe la apuesta: nadie lo elige ni lo ve antes.</p>
    </details>`;
  h.appendChild(raiz);
  const $ = s => raiz.querySelector(s);
  const lienzo = $("canvas"), g = lienzo.getContext("2d"), msg = $("[data-msg]"), bSoltar = $("[data-soltar]");
  const ponMsg = (t, tipo = "") => { msg.textContent = t || ""; msg.className = "jg-cs-msg " + tipo; };
  const ap = ligaApuesta($("[data-apuesta]"), { api, clave: "jg.casino.plinko.p", def: 20, tope: () => PLINKO.riesgos[d].max, cambio: () => pinta() });
  const cayendo = () => bolas.length + pendientes;

  function pinta() {
    const ocupado = cayendo() > 0;
    for (const b of raiz.querySelectorAll("[data-d]")) { b.classList.toggle("on", +b.dataset.d === d); b.disabled = ocupado; }
    for (const b of raiz.querySelectorAll("[data-n]")) { b.classList.toggle("on", +b.dataset.n === n); b.disabled = ocupado; }
    $("[data-rango]").textContent = `(${APUESTA_MIN}–${formatoMonedas(PLINKO.riesgos[d].max)})`;
    bSoltar.disabled = cayendo() >= EN_VUELO;
    bSoltar.innerHTML = `Soltar bola · <b>${formatoMonedas(ap.valor())}</b> ${MONEDA} <small>Espacio</small>`;
  }
  $("[data-riesgos]").onclick = e => {
    const b = e.target.closest("[data-d]");
    if (!b || cayendo()) return;
    d = +b.dataset.d; guarda("jg.casino.plinko.d", d); ap.pon(ap.valor()); suena("clic"); tablero.cambia();
  };
  $("[data-filas]").onclick = e => {
    const b = e.target.closest("[data-n]");
    if (!b || cayendo()) return;
    n = +b.dataset.n; guarda("jg.casino.plinko.n", n); suena("clic"); pinta(); tablero.cambia();
  };

  async function soltar() {
    if (cayendo() >= EN_VUELO) return;
    const p = ap.valor(), dd = d, nn = n;
    pendientes++; ponMsg(""); pinta();
    let k, at;
    try { ({ k, at } = await api.apostar("l", p, { d: dd, n: nn })); }
    catch (e) { pendientes--; ponMsg(errorDe(e), "mal"); suena("pierde"); pinta(); return; }
    pendientes--;
    if (!vivo) return;
    api.oculta(k);
    const res = resuelvePlinko(uid, k, { j: "l", p, d: dd, n: nn, at });
    suena("ficha");
    tablero.suelta({ k, p, res });
    pinta();
  }
  /* La bola llegó: el premio, el historial y el sonido. */
  function cae(b) {
    const { res, p, k } = b;
    api.cobrado(k, res.pago);
    suena("cae", nivel(res.mult));
    if (res.pago > p) suena("cobra", res.mult >= 10 ? 4 : res.mult >= 3 ? 2 : 1);
    hist = [{ k, mult: res.mult, casilla: res.casilla, n: b.n }].concat(hist || []).slice(0, 14);
    pintaHist(true);
    if (res.mult >= 10) ponMsg(`¡×${textoMult(res.mult)}! Cobras ${formatoPago(res.pago)} monedas.`, "info");
    pinta(); pintaFeed();
  }
  bSoltar.onclick = () => soltar();

  /* ---------- el historial: las últimas bolas ---------- */
  function pintaHist(nueva) {
    if (!hist) {
      const e = api.economia();
      if (!e) return;
      hist = Object.values(e.rondas).filter(r => r.u === uid && r.j === "l" && r.valida).sort((a, b) => b.at - a.at).slice(0, 14)
        .map(r => ({ k: r.k, mult: r.mult, casilla: r.casilla, n: r.n }));
    }
    const el = $("[data-hist]");
    el.innerHTML = hist.map((x, i) => `<span class="${i === 0 && nueva ? "nueva" : ""}" style="--c:${colorCasilla(x.casilla, x.n)}">${textoMult(x.mult)}</span>`).join("");
  }
  function pintaFeed() { api.pintaFeed($("[data-feed]"), 6); }

  /* ---------- el tablero ---------- */
  const tablero = (() => {
    let W = 0, H = 0, dpr = 1, raf = 0, prev = performance.now();
    let s = 30, v = 26, cx = 0, top = 0, rp = 3, rb = 6;
    let destellos = new Map(), golpes = [], textos = [], chispas = [];
    function mide() {
      const r = lienzo.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(260, r.width); H = Math.max(260, r.height);
      lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
      geometria();
    }
    function geometria() {
      s = Math.min((W - 24) / (n + 2), (H - 40) / ((n + 1) * 0.86 + 1.6));
      v = s * 0.86; cx = W / 2;
      rp = Math.max(2, s * 0.09); rb = Math.max(3.5, s * 0.21);
      // centrado en vertical: la boca, las filas y las casillas
      const alto = v * 1.5 + (n - 1) * v + v * 0.95 + Math.min(s * 0.78, 30);
      top = Math.max(v * 1.5 + 6, (H - alto) / 2 + v * 1.5);
    }
    const obs = typeof ResizeObserver === "function" ? new ResizeObserver(mide) : null;
    if (obs) obs.observe(lienzo); else window.addEventListener("resize", mide);
    mide();
    const yFila = i => top + i * v;
    const yCasilla = () => yFila(n - 1) + v * 0.95;
    const xEn = (R, i) => cx + (R - i / 2) * s;   // antes de la fila i, con R derechas
    function cambia() { geometria(); golpes = []; destellos = new Map(); }

    /* Los puntos de contacto: encima del clavo de cada fila y la casilla. */
    function suelta(b) {
      const cam = b.res.camino, pts = [];
      let R = 0;
      for (let i = 0; i < cam.length; i++) { pts.push({ x: xEn(R, i), y: yFila(i) - rp - rb, i, j: R + 1 }); R += cam[i]; }
      pts.push({ x: xEn(R, cam.length), y: yCasilla(), fin: true });
      const T = n <= 8 ? 0.2 : n <= 12 ? 0.16 : 0.13;
      bolas.push(Object.assign(b, { pts, seg: -1, u: 0, T, n, x: cx + (Math.random() - 0.5) * s * 0.06, y: top - v * 1.1, estela: [] }));
    }
    function avanza(b, dt) {
      b.u += dt / (b.seg < 0 ? 0.22 : b.T);
      while (b.u >= 1) {
        b.u -= 1; b.seg++;
        const p = b.pts[b.seg];
        if (!p) return true;
        if (p.fin) { aterriza(b); return true; }
        destellos.set(p.i + "," + p.j, performance.now());
        suena("clavo", Math.round(p.i * 16 / n));
      }
      const a = b.seg < 0 ? { x: b.x0 == null ? (b.x0 = b.x) : b.x0, y: top - v * 1.1 } : b.pts[b.seg], z = b.pts[b.seg + 1], u = b.u;
      if (b.seg < 0) { b.x = a.x + (z.x - a.x) * u; b.y = a.y + (z.y - a.y) * u * u; }
      else {
        const salto = z.fin ? v * 0.15 : v * 0.32;
        b.x = a.x + (z.x - a.x) * (1 - Math.pow(1 - u, 1.4));
        b.y = a.y + (z.y - a.y) * u * u - salto * Math.sin(Math.PI * u) * (1 - u * 0.4);
      }
      b.estela.push([b.x, b.y]); if (b.estela.length > 7) b.estela.shift();
      return false;
    }
    function aterriza(b) {
      const c = b.res.casilla, x = cx + (c - n / 2) * s, ahora = performance.now();
      golpes.push({ c, t0: ahora });
      textos.push({ t: "×" + textoMult(b.res.mult), x, y: yCasilla() - s * 0.6, t0: ahora, c: colorCasilla(c, n), grande: b.res.mult >= 3 });
      if (b.res.pago > b.p) {
        const k = Math.min(40, 8 + Math.round(b.res.mult * 3));
        for (let i = 0; i < k; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, w = 80 + Math.random() * 200;
          chispas.push({ x, y: yCasilla(), vx: Math.cos(a) * w, vy: Math.sin(a) * w, t: 0, vida: 0.7 + Math.random() * 0.6, r: 1.5 + Math.random() * 2.5, c: ["#ffd54a", "#fff2a8", colorCasilla(c, n)][i % 3] });
        }
      }
      cae(b);
    }
    function cuadro() {
      if (!vivo) return;
      raf = requestAnimationFrame(cuadro);
      const ahora = performance.now(), dt = Math.min(0.05, (ahora - prev) / 1000); prev = ahora;
      for (let i = bolas.length - 1; i >= 0; i--) if (avanza(bolas[i], dt)) { bolas.splice(i, 1); pinta(); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fondo = g.createLinearGradient(0, 0, 0, H);
      fondo.addColorStop(0, "#0e1838"); fondo.addColorStop(1, "#1d0f36");
      g.fillStyle = fondo; g.fillRect(0, 0, W, H);
      const halo = g.createRadialGradient(cx, top, 0, cx, top, H * 0.9);
      halo.addColorStop(0, "#6d5cff22"); halo.addColorStop(1, "#6d5cff00");
      g.fillStyle = halo; g.fillRect(0, 0, W, H);
      // la boca por donde entra la bola
      g.fillStyle = "#ffffff14"; g.beginPath(); g.roundRect ? g.roundRect(cx - s * 0.6, top - v * 1.5, s * 1.2, v * 0.55, s * 0.2) : g.rect(cx - s * 0.6, top - v * 1.5, s * 1.2, v * 0.55); g.fill();
      // los clavos
      for (let i = 0; i < n; i++)
        for (let j = 0; j < i + 3; j++) {
          const x = cx + (j - (i + 2) / 2) * s, y = yFila(i), t0 = destellos.get(i + "," + j), k = t0 ? Math.max(0, 1 - (ahora - t0) / 380) : 0;
          if (k > 0) {
            g.beginPath(); g.arc(x, y, rp * (2 + 3 * k), 0, 6.29); g.fillStyle = `rgba(255,120,190,${0.35 * k})`; g.fill();
          }
          g.beginPath(); g.arc(x, y, rp * (1 + 0.5 * k), 0, 6.29);
          g.fillStyle = k > 0 ? `rgb(255,${Math.round(230 - 90 * k)},${Math.round(255 - 40 * k)})` : "#d9d6f5"; g.fill();
        }
      // las casillas
      const tabla = PLINKO.tablas[n][d], yc = yCasilla(), hc = Math.min(s * 0.78, 30), wc = s * 0.9;
      g.textAlign = "center"; g.textBaseline = "middle";
      for (let c = 0; c <= n; c++) {
        const x = cx + (c - n / 2) * s, gp = golpes.filter(o => o.c === c).pop(), k = gp ? Math.max(0, 1 - (ahora - gp.t0) / 420) : 0;
        const dy = k > 0 ? Math.sin((1 - k) * Math.PI) * hc * 0.35 : 0, col = colorCasilla(c, n);
        g.save();
        if (k > 0) { g.shadowColor = col; g.shadowBlur = 18 * k; }
        g.fillStyle = col; g.beginPath();
        if (g.roundRect) g.roundRect(x - wc / 2, yc + dy, wc, hc, Math.min(6, wc * 0.2)); else g.rect(x - wc / 2, yc + dy, wc, hc);
        g.fill(); g.restore();
        g.fillStyle = "#00000030"; g.fillRect(x - wc / 2, yc + dy + hc - 3, wc, 3);
        const tx = textoMult(tabla[c]);
        g.font = `900 ${Math.max(7, Math.min(13, wc / Math.max(2.4, tx.length * 0.62)))}px system-ui, sans-serif`;
        g.fillStyle = "#2a0a12"; g.fillText(tx, x, yc + dy + hc / 2 + 0.5);
      }
      golpes = golpes.filter(o => ahora - o.t0 < 500);
      // las bolas, con su estela
      for (const b of bolas) {
        b.estela.forEach(([x, y], i) => { g.beginPath(); g.arc(x, y, rb * (0.3 + 0.08 * i), 0, 6.29); g.fillStyle = `rgba(255,79,139,${0.05 + 0.03 * i})`; g.fill(); });
        const gb = g.createRadialGradient(b.x - rb * 0.35, b.y - rb * 0.4, rb * 0.1, b.x, b.y, rb);
        gb.addColorStop(0, "#ffd0e2"); gb.addColorStop(0.45, "#ff4f8b"); gb.addColorStop(1, "#b0124c");
        g.save(); g.shadowColor = "#ff4f8b"; g.shadowBlur = rb * 1.6;
        g.beginPath(); g.arc(b.x, b.y, rb, 0, 6.29); g.fillStyle = gb; g.fill(); g.restore();
      }
      // chispas y multiplicadores que suben
      chispas = chispas.filter(p => (p.t += dt) < p.vida);
      for (const p of chispas) {
        p.vy += 380 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = Math.min(1, 2 * (1 - p.t / p.vida));
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.29); g.fillStyle = p.c; g.fill();
      }
      textos = textos.filter(o => ahora - o.t0 < 1100);
      for (const o of textos) {
        const u = (ahora - o.t0) / 1100;
        g.globalAlpha = Math.min(1, 3 * (1 - u));
        g.font = `900 ${o.grande ? 22 : 15}px system-ui, sans-serif`;
        g.fillStyle = o.c; g.shadowColor = "#000b"; g.shadowBlur = 6;
        g.fillText(o.t, o.x, o.y - u * s * 1.6);
        g.shadowBlur = 0;
      }
      g.globalAlpha = 1;
    }
    raf = requestAnimationFrame(cuadro);
    return {
      suelta, cambia,
      destruir() { cancelAnimationFrame(raf); if (obs) obs.disconnect(); else window.removeEventListener("resize", mide); }
    };
  })();

  const suelta = teclas(e => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); soltar(); } });
  pinta();

  return {
    datos() { pintaFeed(); if (!hist) pintaHist(false); },
    destruir() { vivo = false; tablero.destruir(); suelta(); raiz.remove(); }
  };
}
