/* Video póker (#casino/poker): Jacks or Better, tabla 9/5 con la escalera
   real a 800. Cinco cartas, tocas las que quieres guardar y «Cambiar»
   reemplaza las demás una sola vez.

   La mano inicial sale de la hora de la apuesta; el cambio es una marca
   `x` = {m, at} escrita una vez (m: los bits de las cartas guardadas) y
   las cartas nuevas salen de la hora de esa marca (casino-motor.js), así
   que no hay reemplazo que mirar antes de decidir. Entre el cambio y la
   vuelta de las cartas el premio se esconde del saldo (`api.oculta`).

   La máquina es DOM: la tabla de pagos con la fila de tu apuesta, los
   cinco naipes (los de blackjack, casino-comun.js) que se dan vuelta con
   la misma transición 3D, y el cartel de lo que hiciste. */
import { POKER, APUESTA_MIN, resuelvePoker, formatoPago } from "./casino-motor.js";
import { formatoMonedas } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";
import { espera, errorDe, htmlApuesta, ligaApuesta, teclas, naipe, ponCara } from "./casino-comun.js";

export function montarPoker(h, api) {
  const { uid, suena } = api;
  const raiz = document.createElement("div");
  raiz.className = "jg-cs-juego jg-cs-vp";
  raiz.innerHTML = `
    <div class="jg-cs-escena jg-cs-vp-maquina">
      <div class="jg-cs-vp-marquesina" aria-hidden="true"><b>JACKS</b><i>or</i><b>BETTER</b></div>
      <table class="jg-cs-vp-tabla" data-tabla><tbody>${POKER.tabla.map(([, n, m], i) =>
        `<tr data-j="${i}"><th>${n}</th><td class="m">×${m}</td><td class="v" data-v></td></tr>`).join("")}</tbody></table>
      <div class="jg-cs-vp-cartas" data-cartas>${[0, 1, 2, 3, 4].map(i =>
        `<button type="button" class="jg-cs-vp-slot" data-i="${i}" aria-label="Carta ${i + 1}"><span class="jg-cs-vp-ret">RETENER</span><kbd>${i + 1}</kbd></button>`).join("")}</div>
      <div class="jg-cs-vp-cartel" data-cartel hidden></div>
    </div>
    <div class="jg-cs-panel">
      <div class="jg-cs-fila" data-apuesta>
        <label class="jg-cs-lbl">Apuesta <small>(${APUESTA_MIN}–${formatoMonedas(POKER.max)})</small></label>
        ${htmlApuesta()}
      </div>
      <div class="jg-cs-acciones"><button type="button" class="jg-cs-boton" data-accion></button></div>
      <p class="jg-cs-msg" data-msg role="status"></p>
    </div>
    <aside class="jg-cs-caja jg-cs-lado"><h3>Grandes premios</h3><div data-feed></div></aside>
    <details class="jg-cs-reglas"><summary>Cómo funciona</summary>
      <p>Apuesta y recibes cinco cartas. Toca las que quieres <b>retener</b> (o pulsa 1–5) y «Cambiar» reemplaza las demás, una sola vez. Lo que quede se paga según la tabla: cada multiplicador es lo que recibes por moneda apostada, incluida ella. Una pareja de jotas, reinas, reyes o ases recupera la apuesta; una pareja más baja no paga.</p>
      <p>Las cartas nuevas salen de la hora exacta en que el servidor recibe tu cambio, barajadas otra vez entre las 47 que quedan: no hay forma de saberlas antes. Jugando lo mejor posible la máquina devuelve 97,3 de cada 100 monedas; reteniendo a ojo, menos.</p>
    </details>`;
  h.appendChild(raiz);
  const $ = s => raiz.querySelector(s);
  const msg = $("[data-msg]"), bAccion = $("[data-accion]"), cartel = $("[data-cartel]"), tabla = $("[data-tabla]");
  const slots = [...raiz.querySelectorAll(".jg-cs-vp-slot")];
  const ponMsg = (t, tipo = "") => { msg.textContent = t || ""; msg.className = "jg-cs-msg " + tipo; };
  /* estado: "libre" (apostar), "reparte", "elige" (retener), "cambia". */
  let estado = "libre", activa = null, res = null, guarda = 0, vivo = true, retomada = false;
  const ap = ligaApuesta($("[data-apuesta]"), { api, clave: "jg.casino.poker.p", def: 20, tope: () => POKER.max, bloqueado: () => estado !== "libre", cambio: () => pinta() });

  // los naipes: boca abajo hasta la primera mano
  const naipes = slots.map(s => { const el = naipe(null, true); s.prepend(el); return el; });

  function pintaTabla(gana = -1, tiene = -1) {
    const p = activa ? activa.r.p : ap.valor();
    for (const tr of tabla.rows) {
      const j = +tr.dataset.j;
      tr.querySelector("[data-v]").textContent = formatoMonedas(p * POKER.tabla[j][2]);
      tr.classList.toggle("gana", j === gana);
      tr.classList.toggle("tiene", j === tiene && gana < 0);
    }
  }
  function pinta() {
    ap.bloquea(estado !== "libre");
    bAccion.disabled = estado === "reparte" || estado === "cambia";
    bAccion.className = "jg-cs-boton" + (estado === "elige" ? " retira" : "");
    bAccion.innerHTML = estado === "elige" ? `Cambiar ${5 - popcount(guarda) ? `${5 - popcount(guarda)} carta${5 - popcount(guarda) === 1 ? "" : "s"}` : "nada"} <small>Espacio</small>`
      : estado === "libre" ? `Repartir · <b>${formatoMonedas(ap.valor())}</b> ${MONEDA} <small>Espacio</small>`
        : estado === "reparte" ? "Repartiendo…" : "Cambiando…";
    slots.forEach((s, i) => {
      const g = !!((guarda >> i) & 1);
      s.classList.toggle("guarda", g && estado !== "libre");
      s.disabled = estado !== "elige";
    });
    raiz.classList.toggle("eligiendo", estado === "elige");
    if (estado === "libre" && !res) pintaTabla();
  }
  const popcount = m => [0, 1, 2, 3, 4].reduce((a, i) => a + ((m >> i) & 1), 0);

  /* Da vuelta las cartas `idx` hacia la cara `cs[i]`, una tras otra. */
  async function voltea(idx, cs, tapar = true) {
    if (tapar) {
      for (const i of idx) naipes[i].classList.add("tapada");
      await espera(idx.length ? 260 : 0);
    }
    for (const i of idx) {
      if (!vivo) return;
      ponCara(naipes[i], cs[i]);
      naipes[i].classList.remove("tapada");
      naipes[i].animate([{ transform: "translateY(-14px)" }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.9,.3,1.3)" });
      suena("reparte");
      await espera(110);
    }
    await espera(220);
  }

  async function repartir() {
    if (estado !== "libre") return;
    const p = ap.valor();
    estado = "reparte"; guarda = 0; res = null; cartel.hidden = true; ponMsg(""); pinta();
    let k, at;
    try { ({ k, at } = await api.apostar("v", p)); }
    catch (e) { estado = "libre"; ponMsg(errorDe(e), "mal"); suena("pierde"); pinta(); return; }
    activa = { k, r: { j: "v", p, at } };
    suena("ficha");
    pintaTabla();
    res = resuelvePoker(uid, k, activa.r);
    for (const el of naipes) el.classList.remove("gana", "apaga");
    await voltea([0, 1, 2, 3, 4], res.mano);
    if (!vivo) return;
    elige();
  }
  /* La mano inicial está en la mesa: se ve lo que ya tienes. */
  function elige() {
    estado = "elige";
    pintaTabla(-1, res.jugada);
    ponMsg(res.jugada >= 0 ? `Tienes ${POKER.tabla[res.jugada][1].toLowerCase()}. Retén las cartas que quieras y cambia el resto.` : "Toca las cartas que quieres retener (o 1–5) y cambia el resto.", "info");
    pinta();
  }
  function alterna(i) {
    if (estado !== "elige") return;
    guarda ^= 1 << i;
    suena((guarda >> i) & 1 ? "pone" : "clic");
    pinta();
  }
  async function cambiar() {
    if (estado !== "elige") return;
    const ro = activa, m = guarda;
    estado = "cambia"; ponMsg(""); pinta();
    let at;
    try { at = await api.marca(ro.k, "x", { m }); }
    catch (e) { estado = "elige"; ponMsg(errorDe(e, "cambiar"), "mal"); pinta(); return; }
    api.oculta(ro.k);
    ro.r.x = { m, at };
    res = resuelvePoker(uid, ro.k, ro.r);
    await voltea([0, 1, 2, 3, 4].filter(i => !((m >> i) & 1)), res.mano);
    if (!vivo) return;
    termina();
  }
  function termina() {
    const ro = activa;
    api.cobrado(ro.k, res.pago);
    pintaTabla(res.jugada);
    const gana = res.pago > 0;
    // las cartas que hacen la jugada brillan; las que sobran se apagan
    const cuenta = {};
    for (const c of res.mano) cuenta[c % 13] = (cuenta[c % 13] || 0) + 1;
    const todas = [0, 1, 3, 4, 5].includes(res.jugada);   // las que usan las cinco
    naipes.forEach((el, i) => {
      const c = res.mano[i], parte = gana && (todas || cuenta[c % 13] >= 2);
      el.classList.toggle("gana", parte);
      el.classList.toggle("apaga", !parte);
    });
    cartel.className = "jg-cs-vp-cartel " + (gana ? "gana" : "pierde") + (res.jugada >= 0 && res.jugada <= 2 ? " grande" : "");
    cartel.innerHTML = gana ? `<b>${POKER.tabla[res.jugada][1]}</b><span>+${formatoPago(res.pago)} ${MONEDA}</span>` : `<b>Sin premio</b>`;
    cartel.hidden = false;
    if (gana) {
      const neto = res.pago - ro.r.p;
      ponMsg(neto > 0 ? `${POKER.tabla[res.jugada][1]}: cobras ${formatoPago(res.pago)} monedas (+${formatoPago(neto)}).` : "Jotas o más: recuperas tu apuesta.", "info");
      suena("cobra", res.mult >= 25 ? 5 : res.mult >= 5 ? 4 : res.mult >= 2 ? 2 : 1);
    } else { ponMsg("Esta vez no hubo jugada."); suena("pierde"); }
    estado = "libre"; activa = null;
    pinta(); pintaFeed();
  }

  bAccion.onclick = () => (estado === "elige" ? cambiar() : repartir());
  $("[data-cartas]").addEventListener("click", e => { const s = e.target.closest("[data-i]"); if (s) alterna(+s.dataset.i); });
  const suelta = teclas(e => {
    const n = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
    if (n) { e.preventDefault(); alterna(+n[1] - 1); }
    else if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); if (estado === "elige") cambiar(); else repartir(); }
  });
  function pintaFeed() { api.pintaFeed($("[data-feed]"), 6); }
  pinta();

  return {
    /* Al llegar los datos: los premios y, una vez, retomar una mano que
       quedó sin cambiar. */
    datos() {
      pintaFeed();
      if (retomada || estado !== "libre") return;
      const e = api.economia(), rs = api.rondas();
      if (!e) return;
      retomada = true;
      const r = Object.values(e.rondas).filter(x => x.u === uid && x.j === "v" && x.estado === "juega" && x.valida).sort((a, b) => b.at - a.at)[0];
      if (!r || !rs[r.k]) return;
      const x = rs[r.k];
      activa = { k: r.k, r: { j: "v", p: x.p, at: x.at } };
      res = resuelvePoker(uid, r.k, activa.r);
      guarda = 0;
      estado = "reparte"; pinta();
      voltea([0, 1, 2, 3, 4], res.mano, false).then(() => { if (!vivo) return; elige(); ponMsg("Retomaste la mano que dejaste sin cambiar.", "info"); });
    },
    destruir() { vivo = false; suelta(); raiz.remove(); }
  };
}
