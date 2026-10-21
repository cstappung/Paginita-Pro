/* Blackjack (#casino/blackjack). Mazo infinito, el crupier pide con 17
   blando, el blackjack paga 3 a 2; doblar con dos cartas cualesquiera,
   separar una vez (sin doblar después) y los ases separados reciben una
   sola carta.

   Cada decisión es una marca `a/<i>` = {t, at} y cada carta sale de la
   hora de la decisión que la pide (casino-motor.js). **El crupier no tiene
   carta tapada guardada**: la de la mesa es un dorso sin nada detrás, y su
   segunda carta sale de la hora de tu última decisión. Una carta sacada de
   la hora de la apuesta se habría podido calcular antes de decidir. Si
   resulta tener blackjack, solo pierdes la apuesta original: lo doblado o
   separado se devuelve, que es lo mismo que pasaría si hubiera mirado.

   Las cartas son DOM: vuelan desde el zapato con la API de animaciones y
   se dan vuelta con una transición 3D. `sincroniza` compara lo que hay en
   la mesa con lo que dice el motor y anima solo lo nuevo, en orden y una
   cosa a la vez (una cola de promesas), así retomar una mano o recibir
   varias cartas juntas se ve igual que jugarlas. */
import { BLACKJACK, APUESTA_MIN, resuelveBlackjack, totalBJ, formatoPago } from "./casino-motor.js";
import { formatoMonedas } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";
import { espera, errorDe, htmlApuesta, ligaApuesta, teclas, naipe, ponCara } from "./casino-comun.js";

const valor = c => Math.min(10, (c % 13) + 1);
const RES = { blackjack: "¡Blackjack!", gana: "Ganas", empate: "Empate", pierde: "Pierdes", pasa: "Te pasaste" };

const textoTotal = (cs, abierta = true) => { const { t, blando } = totalBJ(cs); return blando && t < 21 && abierta && cs.length > 0 ? `${t - 10} / ${t}` : String(t); };

export function montarBlackjack(h, api) {
  const { uid, suena } = api;
  const raiz = document.createElement("div");
  raiz.className = "jg-cs-juego jg-cs-bj";
  raiz.innerHTML = `
    <div class="jg-cs-escena jg-cs-bj-mesa">
      <div class="jg-cs-bj-zapato" data-zapato aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="jg-cs-bj-zona crupier">
        <div class="jg-cs-bj-cartas" data-crupier></div>
        <span class="jg-cs-bj-total" data-tc hidden></span>
      </div>
      <div class="jg-cs-bj-leyenda" aria-hidden="true">
        <svg viewBox="0 0 400 70"><path id="csBjArco" d="M20 10 Q200 80 380 10" fill="none"/><text><textPath href="#csBjArco" startOffset="50%" text-anchor="middle">BLACKJACK PAGA 3 A 2</textPath></text></svg>
        <small>El crupier pide con 17 blando</small>
      </div>
      <div class="jg-cs-bj-manos" data-manos></div>
      <div class="jg-cs-bj-cartel" data-cartel hidden></div>
    </div>
    <div class="jg-cs-panel">
      <div class="jg-cs-fila" data-apuesta>
        <label class="jg-cs-lbl">Apuesta <small>(${APUESTA_MIN}–${formatoMonedas(BLACKJACK.max)})</small></label>
        ${htmlApuesta()}
      </div>
      <div class="jg-cs-acciones" data-acciones>
        <button type="button" class="jg-cs-boton" data-repartir></button>
        <button type="button" class="jg-cs-boton salta" data-t="p" hidden>Pedir <small>P</small></button>
        <button type="button" class="jg-cs-boton retira" data-t="q" hidden>Plantarse <small>M</small></button>
        <button type="button" class="jg-cs-boton jg-cs-bj-dobla" data-t="d" hidden>Doblar <small>D</small></button>
        <button type="button" class="jg-cs-boton jg-cs-bj-separa" data-t="s" hidden>Separar <small>S</small></button>
      </div>
      <p class="jg-cs-msg" data-msg role="status"></p>
    </div>
    <aside class="jg-cs-caja jg-cs-lado"><h3>Grandes premios</h3><div data-feed></div></aside>
    <details class="jg-cs-reglas"><summary>Cómo funciona</summary>
      <p>Suma más que el crupier sin pasarte de 21. Las figuras valen 10 y el as 1 u 11. Dos cartas que suman 21 son blackjack y pagan 3 a 2. Ganar paga 1 a 1 y el empate devuelve la apuesta.</p>
      <p><b>Pedir</b> te da otra carta; <b>Plantarse</b> se queda con lo que tienes. <b>Doblar</b> (con tus dos primeras cartas) duplica la apuesta a cambio de una sola carta más. <b>Separar</b> (con dos cartas del mismo valor) parte la mano en dos, cada una con su apuesta; se separa una vez, no se dobla después y cada as separado recibe una sola carta. El crupier pide hasta 17 y también con 17 blando (con un as que vale 11).</p>
      <p>El crupier no mira su segunda carta: la saca cuando terminas. Si tiene blackjack, solo pierdes la apuesta original y se te devuelve lo doblado o separado. Cada carta sale de la hora exacta en que el servidor recibe tu decisión: no está decidida antes. Con la estrategia básica la casa gana menos del 1 %; jugando a ojo, bastante más.</p>
    </details>`;
  h.appendChild(raiz);
  const $ = s => raiz.querySelector(s);
  const msg = $("[data-msg]"), bRepartir = $("[data-repartir]"), cajaC = $("[data-crupier]"), cajaM = $("[data-manos]"), zapato = $("[data-zapato]"), cartel = $("[data-cartel]");
  const ponMsg = (t, tipo = "") => { msg.textContent = t || ""; msg.className = "jg-cs-msg " + tipo; };
  let activa = null, res = null, ocupado = false, vivo = true, retomada = false;
  const ap = ligaApuesta($("[data-apuesta]"), { api, clave: "jg.casino.blackjack.p", def: 50, tope: () => BLACKJACK.max, bloqueado: () => !!activa, cambio: () => pinta() });

  /* ---------- la mesa ---------- */
  let vista = { crupier: [], manos: [] };   // lo que está pintado: cartas (o null = dorso)
  let cola = Promise.resolve();
  const encola = f => (cola = cola.then(() => (vivo ? f() : null)).catch(e => console.warn("[casino] blackjack", e)));
  function vuela(el, voltea) {
    const a = zapato.getBoundingClientRect(), b = el.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    if (voltea) { el.classList.add("tapada"); setTimeout(() => el.classList.remove("tapada"), 170); }
    el.animate([{ transform: `translate(${dx}px,${dy}px) rotate(-24deg) scale(.85)`, opacity: 0.6 }, { transform: "none", opacity: 1 }], { duration: 430, easing: "cubic-bezier(.18,.8,.24,1)" });
    suena("reparte");
  }
  function manoEl(i) {
    const el = document.createElement("div");
    el.className = "jg-cs-bj-mano"; el.dataset.h = i;
    el.innerHTML = `<div class="jg-cs-bj-cartas"></div><div class="jg-cs-bj-pie"><span class="jg-cs-bj-total"></span><span class="jg-cs-bj-ap"></span></div><span class="jg-cs-bj-res"></span>`;
    return el;
  }
  function pintaManos(r, final) {
    cajaM.querySelectorAll(".jg-cs-bj-mano").forEach((el, i) => {
      const m = r.manos[i], n = vista.manos[i] ? vista.manos[i].length : 0;
      if (!m) return;
      const vistas = m.cartas.slice(0, n), t = totalBJ(vistas).t;
      el.classList.toggle("activa", !final && r.estado === "juega" && r.mano === i && r.manos.length > 1);
      el.querySelector(".jg-cs-bj-total").textContent = n ? textoTotal(vistas) : "";
      el.querySelector(".jg-cs-bj-total").classList.toggle("pasa", t > 21);
      el.querySelector(".jg-cs-bj-ap").innerHTML = `<i class="jg-cs-bj-ficha"></i>${m.doblada ? `<i class="jg-cs-bj-ficha dos"></i>` : ""}${formatoMonedas(m.apuesta)}`;
      const rr = el.querySelector(".jg-cs-bj-res"), txt = final && m.res ? m.res : n === m.cartas.length && t > 21 ? "pasa" : "";
      if (rr.dataset.v !== txt) { rr.dataset.v = txt; rr.className = "jg-cs-bj-res " + txt; rr.textContent = txt ? RES[txt] : ""; }
    });
  }
  function pintaCrupier(r) {
    const cs = vista.crupier.filter(c => c != null), tc = $("[data-tc]");
    tc.hidden = !cs.length;
    const t = totalBJ(cs).t;
    tc.textContent = cs.length ? textoTotal(cs, false) : "";
    tc.classList.toggle("pasa", t > 21);
    void r;
  }
  /* Pone en la mesa lo que dice `r`, animando solo lo que falta. */
  async function sincroniza(r, rapido = false) {
    const pausa = ms => (rapido ? null : espera(ms));
    // separar: la mano se parte en dos con su primera carta cada una
    if (vista.manos.length && r.manos.length !== vista.manos.length) {
      const viejas = [...cajaM.querySelectorAll(".jg-cs-naipe")].map(el => el.getBoundingClientRect());
      cajaM.innerHTML = "";
      vista.manos = r.manos.map((m, i) => { const el = manoEl(i); cajaM.appendChild(el); el.querySelector(".jg-cs-bj-cartas").appendChild(naipe(m.cartas[0])); return [m.cartas[0]]; });
      [...cajaM.querySelectorAll(".jg-cs-naipe")].forEach((el, i) => {
        const a = viejas[i], b = el.getBoundingClientRect();
        if (a && !rapido) el.animate([{ transform: `translate(${a.left - b.left}px,${a.top - b.top}px)` }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
      });
      suena("carta");
      pintaManos(r, false);
      await pausa(420);
    }
    if (!vista.manos.length) {
      cajaM.innerHTML = "";
      r.manos.forEach((m, i) => cajaM.appendChild(manoEl(i)));
      vista.manos = r.manos.map(() => []);
    }
    const ponMano = async (i, j) => {
      const c = r.manos[i].cartas[j], el = naipe(c);
      cajaM.querySelectorAll(".jg-cs-bj-cartas")[i].appendChild(el);
      vista.manos[i].push(c);
      if (!rapido) vuela(el, true);
      pintaManos(r, false);
      await pausa(360);
    };
    const ponCrupier = async (c, j) => {
      const el = naipe(c, c == null);
      cajaC.appendChild(el); vista.crupier[j] = c;
      if (!rapido) vuela(el, c != null);
      pintaCrupier(r);
      await pausa(360);
    };
    // el reparto: tu carta, la del crupier, tu carta, el dorso
    if (!vista.crupier.length) {
      if (!vista.manos[0].length) await ponMano(0, 0);
      await ponCrupier(r.crupier[0], 0);
      if (vista.manos[0].length < 2) await ponMano(0, 1);
      await ponCrupier(null, 1);
    }
    for (let i = 0; i < r.manos.length; i++)
      for (let j = vista.manos[i].length; j < r.manos[i].cartas.length; j++) await ponMano(i, j);
    pintaManos(r, false);
    if (r.estado === "juega") return;
    // el crupier destapa y pide
    await pausa(380);
    const dorso = cajaC.children[1];
    if (dorso && vista.crupier[1] == null) {
      ponCara(dorso, r.crupier[1]); vista.crupier[1] = r.crupier[1];
      dorso.classList.remove("tapada"); if (!rapido) suena("carta");
      pintaCrupier(r);
      await pausa(650);
    }
    for (let j = 2; j < r.crupier.length; j++) { await ponCrupier(r.crupier[j], j); await pausa(300); }
    pintaManos(r, true);
  }

  /* ---------- los botones ---------- */
  function puede(t) {
    if (!activa || !res || res.estado !== "juega" || ocupado) return false;
    const m = res.manos[res.mano];
    if (t === "d") return m.cartas.length === 2 && !m.separada;
    if (t === "s") return res.manos.length === 1 && m.cartas.length === 2 && valor(m.cartas[0]) === valor(m.cartas[1]);
    return true;
  }
  function pinta() {
    const jugando = !!(activa && res && res.estado === "juega");
    ap.bloquea(!!activa);
    bRepartir.hidden = jugando;
    bRepartir.disabled = !!activa;
    bRepartir.innerHTML = activa ? "Repartiendo…" : `${vista.crupier.length ? "Otra mano" : "Repartir"} · <b>${formatoMonedas(ap.valor())}</b> ${MONEDA}`;
    for (const b of raiz.querySelectorAll("[data-t]")) {
      b.hidden = !jugando;
      b.disabled = !puede(b.dataset.t) || ocupado;
    }
    if (jugando) {
      const p = activa.r.p;
      $("[data-t=d]").innerHTML = `Doblar <small>D · +${formatoMonedas(p)}</small>`;
      $("[data-t=s]").innerHTML = `Separar <small>S · +${formatoMonedas(p)}</small>`;
      $("[data-t=s]").hidden = !puede("s") && !ocupado;
    }
  }

  async function repartir() {
    if (activa) return;
    const p = ap.valor();
    activa = { k: null, r: null }; ponMsg(""); cartel.hidden = true; pinta();
    let k, at;
    try { ({ k, at } = await api.apostar("b", p)); }
    catch (e) { activa = null; ponMsg(errorDe(e), "mal"); suena("pierde"); pinta(); return; }
    api.oculta(k);
    activa = { k, r: { j: "b", p, at, a: {} } };
    // la mesa anterior se va
    for (const el of raiz.querySelectorAll(".jg-cs-bj-mesa .jg-cs-naipe")) el.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-30px) rotate(8deg)" }], { duration: 260, fill: "forwards" });
    await espera(raiz.querySelector(".jg-cs-bj-mesa .jg-cs-naipe") ? 280 : 0);
    vista = { crupier: [], manos: [] }; cajaC.innerHTML = ""; cajaM.innerHTML = ""; $("[data-tc]").hidden = true;
    suena("ficha");
    res = resuelveBlackjack(uid, k, activa.r);
    ocupado = true; pinta();
    await encola(() => sincroniza(res));
    ocupado = false;
    termina();
  }
  async function accion(t) {
    if (!puede(t)) return;
    const ro = activa, p = ro.r.p;
    if (t === "d" || t === "s") { try { api.alcanza(p); } catch (e) { ponMsg(e.message, "mal"); suena("clic"); return; } }
    ocupado = true; ponMsg(""); pinta();
    if (t === "q") suena("clic"); else if (t !== "p") suena("ficha");
    const i = Object.keys(ro.r.a).length;
    try {
      const at = await api.marca(ro.k, "a/" + i, { t });
      ro.r.a[i] = { t, at };
      if (t === "d" || t === "s") api.cargo(ro.k, at, p);
    } catch (e) { ocupado = false; ponMsg(errorDe(e, "jugar"), "mal"); pinta(); return; }
    res = resuelveBlackjack(uid, ro.k, ro.r);
    await encola(() => sincroniza(res));
    ocupado = false;
    termina();
  }
  /* Si la mano terminó: el cartel, el premio y el sonido. */
  function termina() {
    if (!activa || !res) return;
    if (res.estado === "juega") { pinta(); return; }
    const ro = activa;
    api.cobrado(ro.k, res.pago);
    const neto = Math.round((res.pago - res.apostado) * 100) / 100;
    const bj = res.manos.some(m => m.res === "blackjack");
    cartel.className = "jg-cs-bj-cartel " + (neto > 0 ? "gana" : neto < 0 ? "pierde" : "empate");
    cartel.innerHTML = neto > 0 ? `<b>${bj ? "¡Blackjack!" : "¡Ganas!"}</b><span>+${formatoPago(neto)} ${MONEDA}</span>`
      : neto < 0 ? `<b>${res.manos.every(m => m.res === "pasa") ? "Te pasaste" : "Gana la casa"}</b><span>−${formatoPago(-neto)} ${MONEDA}</span>`
        : `<b>Empate</b><span>Recuperas ${formatoPago(res.pago)} ${MONEDA}</span>`;
    cartel.hidden = false;
    if (neto > 0) suena("cobra", bj ? 4 : res.pago >= 1000 ? 4 : 2); else if (neto < 0) suena("pierde"); else suena("empate");
    if (res.crupier.length === 2 && totalBJ(res.crupier).t === 21 && res.manos.length === 1) ponMsg("El crupier tenía blackjack." + (res.apostado > ro.r.p ? " Se te devolvió lo doblado." : ""), "info");
    activa = null;
    pinta(); pintaFeed();
  }
  bRepartir.onclick = () => repartir();
  $("[data-acciones]").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (b) accion(b.dataset.t); });
  const suelta = teclas(e => {
    const t = { KeyP: "p", KeyH: "p", KeyM: "q", KeyD: "d", KeyS: "s" }[e.code];
    if (t && activa) { e.preventDefault(); accion(t); }
    else if ((e.code === "Enter" || e.code === "Space") && !activa) { e.preventDefault(); repartir(); }
  });
  function pintaFeed() { api.pintaFeed($("[data-feed]"), 6); }
  pinta();

  return {
    /* Al llegar los datos: los premios y, una vez, retomar una mano que
       quedó a medias. */
    datos() {
      pintaFeed();
      if (retomada || activa) return;
      const e = api.economia(), rs = api.rondas();
      if (!e) return;
      retomada = true;
      const r = Object.values(e.rondas).filter(x => x.u === uid && x.j === "b" && x.estado === "juega" && x.valida).sort((a, b) => b.at - a.at)[0];
      if (!r || !rs[r.k]) return;
      const x = rs[r.k];
      activa = { k: r.k, r: { j: "b", p: x.p, at: x.at, a: Object.assign({}, x.a || {}) } };
      res = resuelveBlackjack(uid, r.k, activa.r);
      vista = { crupier: [], manos: [] };
      sincroniza(res, true).then(() => { ponMsg("Retomaste la mano que dejaste a medias.", "info"); pinta(); });
    },
    destruir() { vivo = false; suelta(); raiz.remove(); }
  };
}
