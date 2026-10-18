/* La ruleta (#casino/ruleta): europea, un solo cero. Las fichas se ponen
   en el paño (números, colores, par/impar, mitades, docenas y columnas) y
   «Girar» escribe la ronda con todas juntas: `b` = {casilla: monedas}.

   El número sale de la hora en que el servidor recibe la apuesta
   (casino-motor.js), así que está decidido en cuanto se apuesta; la rueda
   solo lo cuenta. Por eso el premio se esconde del saldo (`api.oculta`)
   hasta que la bola cae: si no, el saldo cantaba el número antes que la
   rueda. La bola no «busca» la casilla al final: su ángulo relativo a la
   rueda frena con una curva suave que termina justo en la casilla, y en
   la caída rebota entre los rombos. */
import { RULETA, RUEDA, ROJOS, casillaRuleta, resuelveRuleta, APUESTA_MIN, formatoPago } from "./casino-motor.js";
import { formatoMonedas } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";
import { lee, guarda, espera, errorDe, teclas } from "./casino-comun.js";

const FICHAS = [1, 5, 10, 25, 100];
const VUELTA = 5200;   // ms que rueda la bola
const SEG = 2 * Math.PI / 37;
const colorDe = n => (n === 0 ? "verde" : ROJOS.has(n) ? "rojo" : "negro");
const NOMBRES = { rojo: "Rojo", negro: "Negro", par: "Par", impar: "Impar", baja: "1 a 18", alta: "19 a 36", d1: "1ª docena", d2: "2ª docena", d3: "3ª docena", c1: "Columna 1", c2: "Columna 2", c3: "Columna 3" };
const nombreApuesta = b => NOMBRES[b] || "Pleno al " + b.slice(1);

/* Cada casilla lleva su lugar en las dos orientaciones del paño: a lo
   ancho (--hr/--hc) y, en pantallas angostas, a lo alto (--vr/--vc), con
   el cero arriba y las apuestas de fuera a la izquierda. */
const lugar = (hr, hc, vr, vc) => `style="--hr:${hr};--hc:${hc};--vr:${vr};--vc:${vc}"`;
function panoHtml() {
  let h = `<button type="button" class="jg-cs-rl-c verde cero" data-b="n0" ${lugar("1/4", "1", "1", "3/6")}>0<i data-f></i></button>`;
  for (let f = 0; f < 3; f++)
    for (let c = 0; c < 12; c++) {
      const n = 3 * c + 3 - f;
      h += `<button type="button" class="jg-cs-rl-c ${colorDe(n)}" data-b="n${n}" data-n="${n}" ${lugar(f + 1, c + 2, c + 2, 5 - f)}><span>${n}</span><i data-f></i></button>`;
    }
  for (let f = 0; f < 3; f++) h += `<button type="button" class="jg-cs-rl-c fuera col" data-b="c${3 - f}" ${lugar(f + 1, 14, 14, 5 - f)}>2:1<i data-f></i></button>`;
  ["1ª 12", "2ª 12", "3ª 12"].forEach((t, i) => { h += `<button type="button" class="jg-cs-rl-c fuera" data-b="d${i + 1}" ${lugar(4, `${2 + i * 4}/span 4`, `${2 + i * 4}/span 4`, 2)}>${t}<i data-f></i></button>`; });
  [["baja", "1–18"], ["par", "Par"], ["rojo", `<b class="rombo rojo"></b>`], ["negro", `<b class="rombo negro"></b>`], ["impar", "Impar"], ["alta", "19–36"]]
    .forEach(([b, t], i) => { h += `<button type="button" class="jg-cs-rl-c fuera" data-b="${b}" ${lugar(5, `${2 + i * 2}/span 2`, `${2 + i * 2}/span 2`, 1)}>${t}<i data-f></i></button>`; });
  return h;
}
const fichaHtml = (v, extra = "") => `<span class="jg-cs-rl-ficha v${FICHAS.filter(x => x <= v).pop() || 1} ${extra}">${formatoMonedas(v)}</span>`;

export function montarRuleta(h, api) {
  const { uid, suena } = api;
  let valorFicha = FICHAS.includes(+lee("jg.casino.ruleta.ficha", 5)) ? +lee("jg.casino.ruleta.ficha", 5) : 5;
  let fichas = {}, pila = [], ultimas = null, girando = false, vivo = true;
  try { const u = JSON.parse(lee("jg.casino.ruleta.ultimas", "null")); if (u && typeof u === "object") ultimas = u; } catch (e) {}
  const raiz = document.createElement("div");
  raiz.className = "jg-cs-juego jg-cs-rl";
  raiz.innerHTML = `
    <div class="jg-cs-escena">
      <canvas aria-label="La rueda de la ruleta"></canvas>
      <div class="jg-cs-hist jg-cs-rl-hist" data-hist></div>
      <div class="jg-cs-rl-res" data-res hidden></div>
    </div>
    <div class="jg-cs-panel">
      <div class="jg-cs-rl-mesa"><div class="jg-cs-rl-pano" data-pano>${panoHtml()}</div></div>
      <div class="jg-cs-fila jg-cs-rl-fila">
        <div class="jg-cs-rl-fichas" data-fichas>${FICHAS.map(v => `<button type="button" data-v="${v}" title="Ficha de ${v}">${fichaHtml(v)}</button>`).join("")}</div>
        <div class="jg-cs-chips">
          <button type="button" data-acc="deshacer" title="Quitar la última ficha (Retroceso)">↶ Deshacer</button>
          <button type="button" data-acc="borrar">Borrar</button>
          <button type="button" data-acc="doblar">2×</button>
          <button type="button" data-acc="repetir" title="Las fichas de la tirada anterior (R)">↻ Repetir</button>
        </div>
      </div>
      <div class="jg-cs-acciones"><button type="button" class="jg-cs-boton" data-girar></button></div>
      <p class="jg-cs-msg" data-msg role="status"></p>
    </div>
    <aside class="jg-cs-caja jg-cs-lado"><h3>Grandes premios</h3><div data-feed></div></aside>
    <details class="jg-cs-reglas"><summary>Cómo funciona</summary>
      <p>Elige el valor de la ficha y tócala en el paño; cada toque suma una ficha (clic derecho la quita). Puedes repartir entre todas las casillas que quieras: el total de la tirada va de ${APUESTA_MIN} a ${formatoMonedas(RULETA.max)} monedas. «Girar» lanza la bola.</p>
      <p>Pagos (lo que recibes por cada moneda apostada, incluida ella): pleno a un número ×36; docena o columna ×3; rojo, negro, par, impar, 1–18 o 19–36 ×2. El 0 es verde: no es par ni impar, ni rojo ni negro, así que se lleva todas las apuestas de fuera.</p>
      <p>Ese cero es la ventaja de la casa: cualquier apuesta devuelve en promedio 36 de cada 37 monedas (97,3 %). El número lo sortea la hora exacta en que el servidor recibe tu apuesta: nadie puede elegirlo ni verlo antes.</p>
    </details>`;
  h.appendChild(raiz);
  const $ = s => raiz.querySelector(s);
  const lienzo = $("canvas"), g = lienzo.getContext("2d"), pano = $("[data-pano]"), bGirar = $("[data-girar]"), msg = $("[data-msg]");
  const ponMsg = (t, tipo = "") => { msg.textContent = t || ""; msg.className = "jg-cs-msg " + tipo; };
  const total = (f = fichas) => Object.values(f).reduce((a, b) => a + b, 0);

  /* ---------- el paño ---------- */
  function pintaFichas(ganan) {
    for (const c of pano.querySelectorAll("[data-b]")) {
      const v = fichas[c.dataset.b] || 0, f = c.querySelector("[data-f]");
      const sig = v + (ganan ? (ganan.has(c.dataset.b) ? "g" : "p") : "");
      if (f.dataset.sig === sig) continue;
      f.dataset.sig = sig;
      f.innerHTML = v ? fichaHtml(v, ganan ? (ganan.has(c.dataset.b) ? "gana" : "pierde") : "") : "";
    }
  }
  function pinta() {
    const t = total();
    for (const b of raiz.querySelectorAll("[data-v]")) b.classList.toggle("on", +b.dataset.v === valorFicha);
    for (const el of raiz.querySelectorAll("[data-acc], [data-v], [data-b]")) el.disabled = girando;
    if (!girando) {
      $("[data-acc=deshacer]").disabled = !pila.length;
      $("[data-acc=borrar]").disabled = !t;
      $("[data-acc=doblar]").disabled = !t || t * 2 > RULETA.max;
      $("[data-acc=repetir]").disabled = !ultimas || !total(ultimas);
    }
    pano.classList.toggle("bloqueado", girando);
    bGirar.disabled = girando || t < APUESTA_MIN;
    bGirar.innerHTML = girando ? "La bola rueda…" : t ? `Girar · <b>${formatoMonedas(t)}</b> ${MONEDA}${t < APUESTA_MIN ? ` <small>mínimo ${APUESTA_MIN}</small>` : ""}` : `Pon tus fichas <small>de ${APUESTA_MIN} a ${formatoMonedas(RULETA.max)} por tirada</small>`;
    pintaFichas(null);
  }
  function pon(b, v) {
    if (girando) return;
    const t = total(), c = api.cuenta();
    if (t + v > RULETA.max) { ponMsg(`Una tirada lleva como mucho ${formatoMonedas(RULETA.max)} monedas.`, "mal"); suena("clic"); return; }
    if (c && t + v > c.saldo) { ponMsg(`No te alcanza: tienes ${formatoMonedas(c.saldo)} monedas.`, "mal"); suena("clic"); return; }
    fichas[b] = (fichas[b] || 0) + v; pila.push([b, v]);
    ponMsg(""); suena("pone"); limpiaRes(); pinta();
    const f = pano.querySelector(`[data-b="${b}"] .jg-cs-rl-ficha`);
    if (f) f.animate([{ transform: "translateY(-18px) scale(1.25)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(.2,.9,.3,1.3)" });
  }
  function quita(b) {
    if (girando || !fichas[b]) return;
    const i = pila.map(x => x[0]).lastIndexOf(b), v = i >= 0 ? pila[i][1] : fichas[b];
    if (i >= 0) pila.splice(i, 1);
    fichas[b] -= v; if (fichas[b] <= 0) delete fichas[b];
    suena("clic"); pinta();
  }
  function limpiaRes() {
    $("[data-res]").hidden = true;
    for (const c of pano.querySelectorAll(".gana, .sale")) c.classList.remove("gana", "sale");
  }
  pano.addEventListener("click", e => { const c = e.target.closest("[data-b]"); if (c) pon(c.dataset.b, valorFicha); });
  pano.addEventListener("contextmenu", e => { const c = e.target.closest("[data-b]"); if (c) { e.preventDefault(); quita(c.dataset.b); } });
  /* Al pasar sobre una apuesta se iluminan los números que cubre. */
  pano.addEventListener("pointerover", e => {
    const c = e.target.closest("[data-b]"), x = c && casillaRuleta(c.dataset.b);
    for (const n of pano.querySelectorAll("[data-n]")) n.classList.toggle("cubre", !!x && x.gana(+n.dataset.n));
  });
  pano.addEventListener("pointerleave", () => { for (const n of pano.querySelectorAll(".cubre")) n.classList.remove("cubre"); });
  $("[data-fichas]").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; valorFicha = +b.dataset.v; guarda("jg.casino.ruleta.ficha", valorFicha); suena("ficha"); pinta(); };
  function accion(a) {
    if (girando) return;
    if (a === "deshacer" && pila.length) { const [b, v] = pila.pop(); fichas[b] -= v; if (fichas[b] <= 0) delete fichas[b]; suena("clic"); }
    else if (a === "borrar") { fichas = {}; pila = []; suena("clic"); }
    else if (a === "doblar" && total() && total() * 2 <= RULETA.max) { for (const b of Object.keys(fichas)) { pila.push([b, fichas[b]]); fichas[b] *= 2; } suena("pone"); }
    else if (a === "repetir" && ultimas) {
      const t = total(ultimas), c = api.cuenta();
      if (c && t > c.saldo) { ponMsg(`No te alcanza para repetir: son ${formatoMonedas(t)} monedas.`, "mal"); return; }
      fichas = Object.assign({}, ultimas); pila = Object.entries(fichas); suena("pone");
    }
    ponMsg(""); limpiaRes(); pinta();
  }
  raiz.querySelector(".jg-cs-rl-fila .jg-cs-chips").onclick = e => { const b = e.target.closest("[data-acc]"); if (b) accion(b.dataset.acc); };

  /* ---------- tirar ---------- */
  async function girar() {
    const t = total();
    if (girando || t < APUESTA_MIN || t > RULETA.max) return;
    const b = Object.assign({}, fichas);
    girando = true; ponMsg(""); limpiaRes(); pinta();
    let k, at;
    try { ({ k, at } = await api.apostar("r", t, { b })); }
    catch (e) { girando = false; ponMsg(errorDe(e), "mal"); suena("pierde"); pinta(); return; }
    api.oculta(k);
    ultimas = b; guarda("jg.casino.ruleta.ultimas", JSON.stringify(b));
    const res = resuelveRuleta(uid, k, { j: "r", p: t, at, b });
    enVuelo = k;
    suena("giro");
    await rueda.lanza(res.n);
    if (!vivo) return;
    enVuelo = null;
    // el número en grande, las casillas que ganan y las fichas
    const ganan = new Set(res.ganan), col = colorDe(res.n), r = $("[data-res]");
    r.className = "jg-cs-rl-res " + col; r.hidden = false;
    r.innerHTML = `<b>${res.n}</b><small>${res.n === 0 ? "Cero" : (col === "rojo" ? "Rojo" : "Negro") + " · " + (res.n % 2 ? "Impar" : "Par")}</small>`;
    const cn = pano.querySelector(`[data-b="n${res.n}"]`);
    if (cn) cn.classList.add("sale");
    for (const x of ganan) { const c = pano.querySelector(`[data-b="${x}"]`); if (c) c.classList.add("gana"); }
    pintaFichas(ganan);
    api.cobrado(k, res.pago);
    pintaHist();
    if (res.pago > 0) {
      const neto = res.pago - t;
      ponMsg(`${res.ganan.map(nombreApuesta).join(", ")}: cobras ${formatoPago(res.pago)} monedas${neto > 0 ? ` (+${formatoPago(neto)})` : neto < 0 ? ` (recuperas parte: ${formatoPago(neto)})` : ""}.`, neto >= 0 ? "info" : "");
      suena("cobra", res.pago >= t * 10 ? 5 : res.pago >= t * 2.5 ? 3 : 1);
      rueda.fiesta(res.pago);
    } else { ponMsg(`Salió el ${res.n}. Esta vez no.`); suena("pierde"); }
    await espera(1800);
    if (!vivo) return;
    fichas = {}; pila = [];
    girando = false; pinta(); pintaFeed();
  }
  bGirar.onclick = () => girar();

  /* ---------- el historial: los números que salieron (de la economía) ---------- */
  let enVuelo = null;
  function pintaHist() {
    const e = api.economia(), el = $("[data-hist]");
    if (!e) return;
    const l = Object.values(e.rondas).filter(r => r.u === uid && r.j === "r" && r.k !== enVuelo).sort((a, b) => b.at - a.at).slice(0, 16);
    const sig = l.map(r => r.k).join();
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    el.innerHTML = l.map(r => `<span class="${colorDe(r.n)}">${r.n}</span>`).join("");
    if (l[0] && rueda) rueda.reposa(l[0].n);
  }
  function pintaFeed() { $("[data-feed]").innerHTML = api.feedHtml(6); }

  /* ---------- la rueda ---------- */
  const rueda = (() => {
    let W = 0, H = 0, dpr = 1, raf = 0, prev = performance.now(), R = 100, cx = 0, cy = 0;
    let giro = 0, vel = 0.35, bola = null, brillo = null, plato = null, chispas = [];
    function mide() {
      const r = lienzo.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(280, r.width); H = Math.max(240, r.height);
      lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
      R = Math.min(W * 0.46, H * 0.46); cx = W / 2; cy = H / 2 + 6;
      plato = null;
    }
    const obs = typeof ResizeObserver === "function" ? new ResizeObserver(mide) : null;
    if (obs) obs.observe(lienzo); else window.addEventListener("resize", mide);
    mide();
    /* Lo que gira (casillas, cono y torreta) se dibuja una vez por tamaño. */
    function dibujaPlato() {
      const t = Math.ceil(R * 2 * dpr), c = document.createElement("canvas");
      c.width = c.height = t;
      const x = c.getContext("2d");
      x.setTransform(dpr, 0, 0, dpr, R, R);
      const r1 = R * 0.79, r2 = R * 0.665, r3 = R * 0.575;
      for (let i = 0; i < 37; i++) {
        const n = RUEDA[i], a0 = i * SEG - Math.PI / 2, a1 = a0 + SEG, col = n === 0 ? "#139a4f" : ROJOS.has(n) ? "#c8102e" : "#15131c";
        x.beginPath(); x.arc(0, 0, r1, a0, a1); x.arc(0, 0, r2, a1, a0, true); x.closePath(); x.fillStyle = col; x.fill();
        x.beginPath(); x.arc(0, 0, r2, a0, a1); x.arc(0, 0, r3, a1, a0, true); x.closePath();
        const gb = x.createRadialGradient(0, 0, r3, 0, 0, r2); gb.addColorStop(0, "#00000088"); gb.addColorStop(1, col);
        x.fillStyle = col; x.fill(); x.fillStyle = gb; x.fill();
        x.save(); x.rotate(a0 + SEG / 2 + Math.PI / 2);
        x.fillStyle = "#fff"; x.font = `700 ${Math.max(8, R * 0.07)}px system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
        x.fillText(String(n), 0, -(r1 + r2) / 2); x.restore();
      }
      // los trastes dorados entre casillas
      x.strokeStyle = "#e9c46a"; x.lineWidth = Math.max(1, R * 0.008);
      for (let i = 0; i < 37; i++) { const a = i * SEG - Math.PI / 2; x.beginPath(); x.moveTo(Math.cos(a) * r3, Math.sin(a) * r3); x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); x.stroke(); }
      x.beginPath(); x.arc(0, 0, r1, 0, 6.29); x.stroke(); x.beginPath(); x.arc(0, 0, r2, 0, 6.29); x.stroke();
      // el cono de madera
      const cono = x.createRadialGradient(-r3 * 0.25, -r3 * 0.3, r3 * 0.05, 0, 0, r3);
      cono.addColorStop(0, "#d79a52"); cono.addColorStop(0.55, "#8a4f1f"); cono.addColorStop(1, "#3d200a");
      x.beginPath(); x.arc(0, 0, r3, 0, 6.29); x.fillStyle = cono; x.fill();
      x.strokeStyle = "#f3d38a"; x.lineWidth = R * 0.012; x.stroke();
      // la torreta: cuatro brazos y el pomo
      const oro = x.createLinearGradient(-r3, -r3, r3, r3); oro.addColorStop(0, "#fff1c1"); oro.addColorStop(0.5, "#d4a63c"); oro.addColorStop(1, "#7a5312");
      x.strokeStyle = oro; x.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        x.lineWidth = R * 0.05; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * r3 * 0.62, Math.sin(a) * r3 * 0.62); x.stroke();
        x.fillStyle = oro; x.beginPath(); x.arc(Math.cos(a) * r3 * 0.66, Math.sin(a) * r3 * 0.66, R * 0.04, 0, 6.29); x.fill();
      }
      x.beginPath(); x.arc(0, 0, R * 0.09, 0, 6.29); x.fillStyle = oro; x.fill();
      x.beginPath(); x.arc(-R * 0.025, -R * 0.03, R * 0.03, 0, 6.29); x.fillStyle = "#fffbe6cc"; x.fill();
      return c;
    }
    const pocketAng = i => (i + 0.5) * SEG;   // relativo a la rueda, desde arriba
    function lanza(n) {
      return new Promise(fin => {
        const idx = RUEDA.indexOf(n), ang0 = bola ? bola.ang : -Math.PI / 2;
        const phi0 = ang0 - giro;
        let d = ((pocketAng(idx) - phi0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - 2 * Math.PI;
        bola = { modo: "gira", t0: performance.now(), phi0, phiT: phi0 + d - 2 * Math.PI * 6, idx, fin, rebote: 0, ang: ang0, r: R * 0.9 };
        vel = 2.6;
        brillo = null;
      });
    }
    function reposa(n) { if (!bola || bola.modo !== "gira") { bola = { modo: "reposo", idx: RUEDA.indexOf(n), ang: 0, r: 0 }; brillo = null; } }
    function fiesta(pago) {
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * 6.29, v = 90 + Math.random() * 260;
        chispas.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, t: 0, vida: 1 + Math.random() * 0.8, r: 2.5 + Math.random() * 3, c: ["#ffd54a", "#f5b819", "#fff2a8"][i % 3] });
      }
      chispas.push({ texto: "+" + formatoPago(pago), x: cx, y: cy - R * 0.2, t: 0, vida: 2 });
    }
    function cuadro() {
      if (!vivo) return;
      raf = requestAnimationFrame(cuadro);
      const ahora = performance.now(), dt = Math.min(0.05, (ahora - prev) / 1000); prev = ahora;
      vel = 0.32 + (vel - 0.32) * Math.exp(-dt / 2.4);
      giro += vel * dt;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // el paño
      const pa = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, Math.max(W, H) * 0.75);
      pa.addColorStop(0, "#14704a"); pa.addColorStop(1, "#04281a");
      g.fillStyle = pa; g.fillRect(0, 0, W, H);
      // sombra y aro de madera
      g.save(); g.shadowColor = "#000c"; g.shadowBlur = R * 0.18; g.shadowOffsetY = R * 0.05;
      g.beginPath(); g.arc(cx, cy, R, 0, 6.29); g.fillStyle = "#2a1406"; g.fill(); g.restore();
      const aro = g.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.2, cx, cy, R);
      aro.addColorStop(0, "#9c5a24"); aro.addColorStop(0.8, "#5a2e0e"); aro.addColorStop(1, "#2a1406");
      g.beginPath(); g.arc(cx, cy, R, 0, 6.29); g.fillStyle = aro; g.fill();
      // la pista de la bola
      const pista = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 0.95);
      pista.addColorStop(0, "#3a2a20"); pista.addColorStop(0.6, "#1b120d"); pista.addColorStop(1, "#4a3426");
      g.beginPath(); g.arc(cx, cy, R * 0.95, 0, 6.29); g.fillStyle = pista; g.fill();
      g.strokeStyle = "#e9c46a88"; g.lineWidth = 1.5; g.stroke();
      // lo que gira
      if (!plato) plato = dibujaPlato();
      g.save(); g.translate(cx, cy); g.rotate(giro); g.drawImage(plato, -R, -R, R * 2, R * 2); g.restore();
      // los rombos de la pista
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + Math.PI / 8, x = cx + Math.cos(a) * R * 0.86, y = cy + Math.sin(a) * R * 0.86, s = R * 0.03;
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.moveTo(-s * 1.6, 0); g.lineTo(0, -s); g.lineTo(s * 1.6, 0); g.lineTo(0, s); g.closePath();
        g.fillStyle = "#e9c46a"; g.fill(); g.restore();
      }
      // la bola
      if (bola) {
        let ang, r;
        if (bola.modo === "gira") {
          const u = Math.min(1, (ahora - bola.t0) / VUELTA);
          const phi = bola.phi0 + (bola.phiT - bola.phi0) * (1 - Math.pow(1 - u, 2.6));
          ang = giro + phi;
          const rT = R * 0.9, rP = R * 0.62, s = Math.max(0, Math.min(1, (u - 0.6) / 0.32));
          const base = rT + (rP - rT) * (s * s * (3 - 2 * s));
          const rebote = R * 0.07 * Math.abs(Math.sin(s * Math.PI * 3.5)) * Math.pow(1 - s, 1.4);
          r = base + rebote;
          const tramo = Math.floor(s * 3.5);
          if (s > 0 && s < 1 && tramo !== bola.rebote) { bola.rebote = tramo; suena("bola", 1 - s); }
          if (u >= 1) {
            const f = bola.fin;
            bola = { modo: "reposo", idx: bola.idx, ang, r: rP };
            brillo = { idx: bola.idx, t0: ahora };
            suena("bola", 0.1);
            setTimeout(f, 450);
          } else { bola.ang = ang; bola.r = r; }
        }
        if (bola.modo === "reposo") { ang = giro + pocketAng(bola.idx) - Math.PI / 2; r = R * 0.62; bola.ang = ang + Math.PI / 2; }
        else ang -= Math.PI / 2;
        if (brillo) {
          const a0 = giro + brillo.idx * SEG - Math.PI / 2, k = 0.55 + 0.45 * Math.sin((ahora - brillo.t0) / 160);
          g.save(); g.beginPath(); g.arc(cx, cy, R * 0.8, a0, a0 + SEG); g.arc(cx, cy, R * 0.57, a0 + SEG, a0, true); g.closePath();
          g.fillStyle = `rgba(255,236,150,${0.35 * k})`; g.shadowColor = "#ffe27a"; g.shadowBlur = 20; g.fill(); g.restore();
        }
        const bx = cx + Math.cos(ang) * r, by = cy + Math.sin(ang) * r, br = Math.max(4, R * 0.036);
        g.beginPath(); g.ellipse(bx + br * 0.4, by + br * 0.6, br, br * 0.7, 0, 0, 6.29); g.fillStyle = "#0007"; g.fill();
        const gb = g.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br);
        gb.addColorStop(0, "#ffffff"); gb.addColorStop(0.6, "#e6e6ee"); gb.addColorStop(1, "#8d8d9c");
        g.beginPath(); g.arc(bx, by, br, 0, 6.29); g.fillStyle = gb; g.fill();
      }
      // el brillo del barniz
      const luz = g.createRadialGradient(cx - R * 0.35, cy - R * 0.45, 0, cx - R * 0.35, cy - R * 0.45, R * 1.1);
      luz.addColorStop(0, "#ffffff22"); luz.addColorStop(0.4, "#ffffff08"); luz.addColorStop(1, "#ffffff00");
      g.beginPath(); g.arc(cx, cy, R, 0, 6.29); g.fillStyle = luz; g.fill();
      // monedas
      chispas = chispas.filter(p => (p.t += dt) < p.vida);
      for (const p of chispas) {
        g.globalAlpha = Math.min(1, 2 * (1 - p.t / p.vida));
        if (p.texto) { g.font = "900 34px system-ui, sans-serif"; g.textAlign = "center"; g.fillStyle = "#ffd54a"; g.shadowColor = "#000a"; g.shadowBlur = 10; g.fillText(p.texto, p.x, p.y - p.t * 40); g.shadowBlur = 0; continue; }
        p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        g.save(); g.translate(p.x, p.y); g.scale(Math.cos(p.t * 12), 1); g.beginPath(); g.arc(0, 0, p.r, 0, 6.29); g.fillStyle = p.c; g.fill(); g.restore();
      }
      g.globalAlpha = 1;
    }
    raf = requestAnimationFrame(cuadro);
    return {
      lanza, reposa, fiesta,
      destruir() { cancelAnimationFrame(raf); if (obs) obs.disconnect(); else window.removeEventListener("resize", mide); }
    };
  })();

  const suelta = teclas(e => {
    if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); girar(); }
    else if (e.code === "Backspace") { e.preventDefault(); accion("deshacer"); }
    else if (e.code === "KeyR") accion("repetir");
  });
  pinta();

  return {
    datos() { pintaFeed(); pintaHist(); if (!girando) pinta(); },
    destruir() { vivo = false; rueda.destruir(); suelta(); raiz.remove(); }
  };
}
