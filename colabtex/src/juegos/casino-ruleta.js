/* La ruleta (#casino/ruleta): europea, un solo cero. Las fichas se ponen
   en el paño (números, colores, par/impar, mitades, docenas y columnas) y
   «Girar» escribe la ronda con todas juntas: `b` = {casilla: monedas}.

   El número sale de la hora en que el servidor recibe la apuesta
   (casino-motor.js), así que está decidido en cuanto se apuesta; la rueda
   solo lo cuenta. Por eso el premio se esconde del saldo (`api.oculta`)
   hasta que la bola cae: si no, el saldo cantaba el número antes que la
   rueda. La bola no «busca» la casilla al final: lo que dura en la pista
   se calcula para que, frenando parejo, caiga y rebote justo en ella (ver
   «la rueda», abajo). */
import { RULETA, RUEDA, ROJOS, casillaRuleta, resuelveRuleta, APUESTA_MIN, formatoPago } from "./casino-motor.js";
import { formatoMonedas } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";
import { lee, guarda, espera, errorDe, teclas } from "./casino-comun.js";

const FICHAS = [1, 5, 10, 25, 100];
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
    try { api.alcanza(t); } catch (e) { ponMsg(errorDe(e), "mal"); suena("pierde"); return; }
    const b = Object.assign({}, fichas);
    girando = true; ponMsg(""); limpiaRes(); pinta();
    // la bola sale ya; el número llega con la hora del servidor
    rueda.arranca(); suena("giro");
    let k, at;
    try { ({ k, at } = await api.apostar("r", t, { b })); }
    catch (e) { girando = false; rueda.aborta(); ponMsg(errorDe(e), "mal"); suena("pierde"); pinta(); return; }
    api.oculta(k);
    ultimas = b; guarda("jg.casino.ruleta.ultimas", JSON.stringify(b));
    const res = resuelveRuleta(uid, k, { j: "r", p: t, at, b });
    await rueda.lanza(res.n);
    if (!vivo) return;
    // el número en grande, las casillas que ganan y las fichas
    const ganan = new Set(res.ganan), col = colorDe(res.n), r = $("[data-res]");
    r.className = "jg-cs-rl-res " + col; r.hidden = false;
    r.innerHTML = `<b>${res.n}</b><small>${res.n === 0 ? "Cero" : (col === "rojo" ? "Rojo" : "Negro") + " · " + (res.n % 2 ? "Impar" : "Par")}</small>`;
    const cn = pano.querySelector(`[data-b="n${res.n}"]`);
    if (cn) cn.classList.add("sale");
    for (const x of ganan) { const c = pano.querySelector(`[data-b="${x}"]`); if (c) c.classList.add("gana"); }
    pintaFichas(ganan);
    api.cobrado(k, res.pago);
    pintaHist(true);
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

  /* ---------- el historial: los números que salieron (de la economía) ----------
     Mientras la bola rueda no se toca: la tirada nueva puede llegar en la
     lectura antes de que la bola caiga, y cantaba el número (y llevaba la
     bola a su casilla) antes de girar. Al caer se pinta a la fuerza. */
  function pintaHist(forzar) {
    const e = api.economia(), el = $("[data-hist]");
    if (!e || (girando && !forzar)) return;
    const l = api.mias().filter(r => r.j === "r").slice(0, 16);
    const sig = l.map(r => r.k).join();
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    el.innerHTML = l.map(r => `<span class="${colorDe(r.n)}">${r.n}</span>`).join("");
    if (l[0] && rueda) rueda.reposa(l[0].n);
  }
  function pintaFeed() { api.pintaFeed($("[data-feed]"), 6); }

  /* ---------- la rueda ----------
     Rueda y bola son funciones del reloj, no de lo que avanzó cada cuadro:
     con la página trabada (un cuadro cada medio segundo) la rueda avanzaba
     a pasos de 50 ms como mucho mientras la bola, contada con el reloj,
     llegaba sola a su casilla. La rueda gira en sentido horario (`giroEn`:
     el impulso del crupier se apaga solo) y la bola al revés por la pista.
     Sale en cuanto se toca «Girar» (`arranca`); cuando el servidor da el
     número (`lanza`) se calcula cuánto más rueda por la pista para que, al
     frenar, caer y rebotar, quede justo en esa casilla. En la pista nunca
     cambia de sentido ni salta: lo único que se elige es cuánto dura. */
  const rueda = (() => {
    const W_REPOSO = 0.3, W_IMPULSO = 1.8, TAU = 3000;   // rad/s, rad/s, ms
    const W_BOLA = 15, W_CAE = 3.2, PISTA_MIN = 2600, CAIDA = 1500;
    const DOS_PI = 2 * Math.PI, modulo = (x, m) => ((x % m) + m) % m;
    let W = 0, H = 0, dpr = 1, raf = 0, prev = performance.now(), R = 100, cx = 0, cy = 0;
    let bola = null, brillo = null, plato = null, capas = null, chispas = [];
    /* La rueda: ángulo `g0` en `t0`, más el giro de reposo y lo que queda
       del impulso. */
    let g0 = 0, t0 = performance.now(), imp = 0;
    const giroEn = t => g0 + W_REPOSO * (t - t0) / 1000 + imp * TAU / 1000 * (1 - Math.exp(-(t - t0) / TAU));
    const velGiro = t => W_REPOSO + imp * Math.exp(-(t - t0) / TAU);
    function mide() {
      const r = lienzo.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(280, r.width), h = Math.max(240, r.height);
      if (w === W && h === H && d === dpr) return;
      W = w; H = h; dpr = d;
      lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
      R = Math.min(W * 0.46, H * 0.46); cx = W / 2; cy = H / 2 + 6;
      plato = null; capas = null;
    }
    const obs = typeof ResizeObserver === "function" ? new ResizeObserver(mide) : null;
    if (obs) obs.observe(lienzo); else window.addEventListener("resize", mide);
    mide();
    /* Lo que gira (casillas, cono y torreta) se dibuja una vez por tamaño. */
    function dibujaPlato() {
      const t = Math.ceil(R * 2 * dpr), c = document.createElement("canvas");
      c.width = c.height = t;
      const x = c.getContext("2d");
      x.setTransform(dpr, 0, 0, dpr, R * dpr, R * dpr);
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
    /* Lo que no se mueve, también una vez por tamaño: debajo del plato el
       paño, el aro con su sombra (un shadowBlur grande, lo más caro del
       cuadro), la pista y los rombos; encima, el brillo del barniz.
       Pintarlo en cada cuadro trababa la página aunque nadie jugara. */
    function dibujaCapas() {
      const lienzoDe = () => { const c = document.createElement("canvas"); c.width = lienzo.width; c.height = lienzo.height; const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x]; };
      const [fondo, x] = lienzoDe();
      const pa = x.createRadialGradient(cx, cy, R * 0.3, cx, cy, Math.max(W, H) * 0.75);
      pa.addColorStop(0, "#14704a"); pa.addColorStop(1, "#04281a");
      x.fillStyle = pa; x.fillRect(0, 0, W, H);
      x.save(); x.shadowColor = "#000c"; x.shadowBlur = R * 0.18; x.shadowOffsetY = R * 0.05;
      x.beginPath(); x.arc(cx, cy, R, 0, 6.29); x.fillStyle = "#2a1406"; x.fill(); x.restore();
      const aro = x.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.2, cx, cy, R);
      aro.addColorStop(0, "#9c5a24"); aro.addColorStop(0.8, "#5a2e0e"); aro.addColorStop(1, "#2a1406");
      x.beginPath(); x.arc(cx, cy, R, 0, 6.29); x.fillStyle = aro; x.fill();
      const pista = x.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 0.95);
      pista.addColorStop(0, "#3a2a20"); pista.addColorStop(0.6, "#1b120d"); pista.addColorStop(1, "#4a3426");
      x.beginPath(); x.arc(cx, cy, R * 0.95, 0, 6.29); x.fillStyle = pista; x.fill();
      x.strokeStyle = "#e9c46a88"; x.lineWidth = 1.5; x.stroke();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + Math.PI / 8, px = cx + Math.cos(a) * R * 0.86, py = cy + Math.sin(a) * R * 0.86, s = R * 0.03;
        x.save(); x.translate(px, py); x.rotate(a);
        x.beginPath(); x.moveTo(-s * 1.6, 0); x.lineTo(0, -s); x.lineTo(s * 1.6, 0); x.lineTo(0, s); x.closePath();
        x.fillStyle = "#e9c46a"; x.fill(); x.restore();
      }
      const [barniz, y] = lienzoDe();
      const luz = y.createRadialGradient(cx - R * 0.35, cy - R * 0.45, 0, cx - R * 0.35, cy - R * 0.45, R * 1.1);
      luz.addColorStop(0, "#ffffff22"); luz.addColorStop(0.4, "#ffffff08"); luz.addColorStop(1, "#ffffff00");
      y.beginPath(); y.arc(cx, cy, R, 0, 6.29); y.fillStyle = luz; y.fill();
      return { fondo, barniz };
    }
    // el centro de la casilla i, en el marco de la rueda (el mismo de dibujaPlato)
    const casilla = i => (i + 0.5) * SEG - Math.PI / 2;
    /* Dónde está la bola a la hora t: {ang, r} (r en fracciones de R). */
    function posicion(t) {
      if (!bola) return null;
      if (bola.modo === "reposo") return { ang: giroEn(t) + casilla(bola.idx), r: 0.62 };
      if (bola.modo === "sale") return { ang: bola.th0 - W_BOLA * (t - bola.t0) / 1000, r: 0.9 };
      // "frena": por la pista hasta `tp`, y después cae
      const T = t - bola.t0;
      if (T < bola.tp) {
        const s = T / bola.tp;
        return { ang: bola.th0 - recorrido(bola.tp, s), r: 0.9 - 0.035 * s * s };
      }
      const q = Math.min(1, (T - bola.tp) / CAIDA), d = CAIDA / 1000, x = q * d;
      const b = Math.min(1, q / 0.8), suave = b * b * (3 - 2 * b);
      const phi = bola.phi1 + bola.v1 * x - bola.v1 * x * x / (2 * d) + 0.1 * Math.sin(b * Math.PI * 7) * (1 - b) * (1 - b);
      return { ang: giroEn(t) + phi, r: 0.865 + (0.62 - 0.865) * suave + 0.07 * Math.abs(Math.sin(b * Math.PI * 3.5)) * Math.pow(1 - b, 1.4), rebote: Math.floor(b * 3.5), b };
    }
    /* Lo que la bola recorre en la pista (rad, hacia atrás) hasta la
       fracción s de un tramo de `tp` ms: frena de W_BOLA a W_CAE. */
    const recorrido = (tp, s) => tp / 1000 * (W_CAE * s + (W_BOLA - W_CAE) * (1 - Math.pow(1 - s, 3)) / 3);
    function arranca() {
      const t = performance.now(), p = posicion(t);
      g0 = modulo(giroEn(t), DOS_PI); t0 = t; imp = W_IMPULSO - W_REPOSO;
      bola = { modo: "sale", t0: t, th0: p ? p.ang : -Math.PI / 2 };
      brillo = null;
    }
    /* Que caiga en el número n. Desde la pista, a la hora t: dura `tp` en
       la pista y CAIDA en caer, y al final del todo su ángulo en la rueda
       es `phi1 + v1·CAIDA/2` (frena parejo hasta quedar quieta en ella).
       Ese final baja con tp, así que se busca el primer tp que lo deja en
       la casilla. Sin número (null), cae donde la lleve el tramo más corto. */
    function lanza(n) {
      if (!bola || bola.modo !== "sale") arranca();
      const t = performance.now(), th0 = posicion(t).ang, d = CAIDA / 1000;
      const plan = tp => { const v1 = -W_CAE - velGiro(t + tp), phi1 = th0 - recorrido(tp, 1) - giroEn(t + tp); return { tp, v1, phi1, fin: phi1 + v1 * d / 2 }; };
      const f0 = plan(PISTA_MIN).fin;
      const idx = n == null ? Math.floor(modulo(f0 + Math.PI / 2, DOS_PI) / SEG) % 37 : Math.max(0, RUEDA.indexOf(n));
      const meta = f0 - modulo(f0 - casilla(idx), DOS_PI);
      let a = PISTA_MIN, b = PISTA_MIN + 1000;
      while (plan(b).fin > meta) b += 1000;
      for (let i = 0; i < 48; i++) { const m = (a + b) / 2; if (plan(m).fin > meta) a = m; else b = m; }
      const p = plan(b);
      return new Promise(fin => { bola = { modo: "frena", t0: t, th0, tp: p.tp, v1: p.v1, phi1: p.phi1, idx, fin, rebote: -1 }; });
    }
    /* Antes del primer giro, la bola espera en el último número que salió.
       Después queda donde cayó: la lectura que trae esa tirada puede
       llegar más tarde y traer la anterior como última. */
    function reposa(n) { if (!bola || bola.inicial) bola = { modo: "reposo", idx: Math.max(0, RUEDA.indexOf(n)), inicial: true }; }
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
      // la bola terminó de caer: queda en su casilla y avisa
      if (bola && bola.modo === "frena") {
        const p = posicion(ahora);
        if (p.b !== undefined && p.rebote !== bola.rebote && p.b > 0 && p.b < 1) { bola.rebote = p.rebote; suena("bola", 1 - p.b); }
        if (ahora - bola.t0 >= bola.tp + CAIDA) {
          const f = bola.fin;
          bola = { modo: "reposo", idx: bola.idx };
          brillo = { idx: bola.idx, t0: ahora };
          suena("bola", 0.1);
          setTimeout(f, 450);
        }
      }
      const giro = giroEn(ahora);
      if (!capas) capas = dibujaCapas();
      if (!plato) plato = dibujaPlato();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(capas.fondo, 0, 0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // lo que gira
      g.save(); g.translate(cx, cy); g.rotate(giro); g.drawImage(plato, -R, -R, R * 2, R * 2); g.restore();
      if (brillo) {
        const a0 = giro + brillo.idx * SEG - Math.PI / 2, k = 0.55 + 0.45 * Math.sin((ahora - brillo.t0) / 160);
        g.beginPath(); g.arc(cx, cy, R * 0.8, a0, a0 + SEG); g.arc(cx, cy, R * 0.57, a0 + SEG, a0, true); g.closePath();
        g.fillStyle = `rgba(255,236,150,${0.4 * k})`; g.fill();
        g.strokeStyle = `rgba(255,226,122,${0.8 * k})`; g.lineWidth = 2; g.stroke();
      }
      // la bola
      const p = posicion(ahora);
      if (p) {
        const bx = cx + Math.cos(p.ang) * p.r * R, by = cy + Math.sin(p.ang) * p.r * R, br = Math.max(4, R * 0.036);
        g.beginPath(); g.ellipse(bx + br * 0.4, by + br * 0.6, br, br * 0.7, 0, 0, 6.29); g.fillStyle = "#0007"; g.fill();
        const gb = g.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br);
        gb.addColorStop(0, "#ffffff"); gb.addColorStop(0.6, "#e6e6ee"); gb.addColorStop(1, "#8d8d9c");
        g.beginPath(); g.arc(bx, by, br, 0, 6.29); g.fillStyle = gb; g.fill();
      }
      // el brillo del barniz
      // (solo el cuadrado de la rueda: fuera de ella el barniz es transparente)
      const bx0 = Math.max(0, Math.floor((cx - R) * dpr)), by0 = Math.max(0, Math.floor((cy - R) * dpr)), bl = Math.min(Math.ceil(2 * R * dpr), lienzo.width - bx0, lienzo.height - by0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(capas.barniz, bx0, by0, bl, bl, bx0, by0, bl, bl);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    reposa(0);
    raf = requestAnimationFrame(cuadro);
    return {
      arranca, lanza, reposa, fiesta,
      /* La apuesta no se escribió: la bola frena y cae, sin número. */
      aborta() { if (bola && bola.modo === "sale") lanza(null); },
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
