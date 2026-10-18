/* El Casino — la pestaña #casino: el menú, el saldo, el sonido y lo que
   comparten sus juegos (#casino/avion, #casino/pinguino). El azar y los
   pagos son de casino-motor.js; el saldo, de monedas.js, que cobra cada
   apuesta y suma cada premio igual que cualquier otro gasto.

   El saldo que se ve aquí va un paso por delante de la economía: las
   lecturas del casino llegan juntadas cada segundo (fb-juegos.js), así que
   lo apostado y lo cobrado en esta pestaña se descuenta y se suma a mano
   hasta que la lectura lo trae. Si no, dos apuestas seguidas verían el
   mismo saldo, la segunda podría no alcanzar y una apuesta sin fondos deja
   la cuenta parada (monedas.js). */
import { monedasDe, economia, formatoMonedas } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";
import { suena, silenciado, silenciar, volumenEfectos, configurarEfectos, ambientar } from "./sonido.js";
import { AVION, PINGUINO, RETORNO, APUESTA_MIN, formatoPago } from "./casino-motor.js";
import { montarAvion } from "./casino-avion.js";
import { montarPinguino } from "./casino-pinguino.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const formatoMult = m => "×" + (Math.floor(m * 100 + 1e-9) / 100).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const JUEGOS = {
  avion: { nombre: "El Avión", montar: montarAvion },
  pinguino: { nombre: "Pingüinito", montar: montarPinguino }
};

/* El dibujo de cada ficha del menú: SVG con su animación en CSS. */
const ARTE_AVION = `<svg viewBox="0 0 320 170" aria-hidden="true" class="jg-cs-arte">
  <defs><linearGradient id="csCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0f33"/><stop offset=".7" stop-color="#3b1d63"/><stop offset="1" stop-color="#8a2c6a"/></linearGradient>
  <linearGradient id="csEstela" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff3d6e" stop-opacity=".05"/><stop offset="1" stop-color="#ff3d6e" stop-opacity=".55"/></linearGradient></defs>
  <rect width="320" height="170" fill="url(#csCielo)"/>
  <g fill="#fff" class="jg-cs-estrellas"><circle cx="40" cy="22" r="1.2"/><circle cx="96" cy="44" r=".9"/><circle cx="150" cy="18" r="1.4"/><circle cx="214" cy="36" r="1"/><circle cx="276" cy="16" r="1.3"/><circle cx="300" cy="58" r=".8"/><circle cx="20" cy="70" r=".8"/></g>
  <path d="M0 168 C 120 166, 200 140, 268 46 L 268 170 L 0 170 Z" fill="url(#csEstela)"/>
  <path d="M0 168 C 120 166, 200 140, 268 46" fill="none" stroke="#ff5c7c" stroke-width="4" stroke-linecap="round"/>
  <g class="jg-cs-avioncito" transform="translate(268 46) rotate(-38)">
    <path d="M-26 -5 Q-10 -9 16 -6 Q26 -4 28 0 Q26 4 16 6 Q-10 9 -26 5 Z" fill="#e8304a"/>
    <path d="M-2 -5 L-14 -24 L-6 -24 L10 -5 Z M-2 5 L-14 22 L-6 22 L10 5 Z" fill="#b81d34"/>
    <path d="M-24 -4 L-32 -15 L-26 -15 L-18 -4 Z" fill="#b81d34"/>
    <path d="M8 -4 Q16 -4 19 0 L8 0 Z" fill="#9fe3ff"/>
    <ellipse cx="29" cy="0" rx="2" ry="12" fill="#fff" opacity=".55" class="jg-cs-helice"/>
  </g>
  <text x="22" y="56" class="jg-cs-arte-mult">×2,48</text>
</svg>`;
const ARTE_PINGUINO = `<svg viewBox="0 0 320 170" aria-hidden="true" class="jg-cs-arte">
  <defs><linearGradient id="csHielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset=".55" stop-color="#d9f2ff"/><stop offset=".56" stop-color="#1f6fb2"/><stop offset="1" stop-color="#0b3a6b"/></linearGradient></defs>
  <rect width="320" height="170" fill="url(#csHielo)"/>
  <path d="M0 94 L30 70 L52 84 L84 56 L120 94 Z M200 94 L238 62 L262 80 L292 60 L320 80 L320 94 Z" fill="#f4fbff" opacity=".9"/>
  <g class="jg-cs-olas" fill="none" stroke="#7cc4f5" stroke-width="2" opacity=".6"><path d="M0 120 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/><path d="M-20 146 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/></g>
  <g fill="#eef9ff" stroke="#bfe6ff" stroke-width="2">
    <ellipse cx="54" cy="128" rx="34" ry="9"/><ellipse cx="140" cy="128" rx="28" ry="8"/><ellipse cx="216" cy="128" rx="26" ry="7.5"/><ellipse cx="288" cy="128" rx="24" ry="7"/>
  </g>
  <g font-weight="800" font-size="12" text-anchor="middle" fill="#0b3a6b"><text x="140" y="112">×1,21</text><text x="216" y="112">×1,51</text><text x="288" y="112">×1,89</text></g>
  <g class="jg-cs-pingu" transform="translate(54 104)">
    <ellipse cx="0" cy="2" rx="13" ry="17" fill="#1b1d2b"/><ellipse cx="0" cy="6" rx="8.5" ry="12" fill="#fff"/>
    <circle cx="-4" cy="-7" r="2.4" fill="#fff"/><circle cx="4" cy="-7" r="2.4" fill="#fff"/><circle cx="-3.6" cy="-6.8" r="1.2" fill="#111"/><circle cx="4.4" cy="-6.8" r="1.2" fill="#111"/>
    <path d="M-3 -3 L3 -3 L0 1 Z" fill="#ff9f1c"/><path d="M-9 18 l-5 3 h8 Z M9 18 l5 3 h-8 Z" fill="#ff9f1c"/>
  </g>
</svg>`;

export function crearCasino({ uid, fb, datos, ahora, nombreDe, ir }) {
  let raiz = null, cuerpo = null, off = null, d = null, juego = null, actual = null;
  /* Lo de esta pestaña que la lectura aún no trae: apuestas (k → p) y
     premios (k → pago). */
  const apuestas = new Map(), premios = new Map();
  const mias = () => ((d && d.casino) || {})[uid] || {};
  function cuenta() {
    if (!d || !d.completo) return null;
    const m = monedasDe(uid, d), r = mias();
    let s = m.saldo;
    for (const [k, p] of apuestas) { if (r[k]) apuestas.delete(k); else s -= p; }
    for (const [k, p] of premios) { const x = economia(d).rondas[uid + "~" + k]; if (x && x.estado === "cobrada") premios.delete(k); else s += p; }
    return { saldo: s, parada: m.parada, falta: m.falta, casino: m.casino };
  }
  function pintaSaldo() {
    const c = cuenta(), el = raiz && raiz.querySelector("[data-cs-saldo]");
    if (el) el.textContent = c ? formatoMonedas(c.saldo) : "…";
  }
  /* Lo que cada juego usa: la cuenta, apostar y marcar, el reloj del
     servidor y el sonido. Una apuesta comprueba el saldo antes de escribir:
     la regla no lo sabe y la economía la anularía parando la cuenta. */
  const api = {
    uid, ahora, suena, nombreDe, formatoMult,
    cuenta,
    async apostar(j, p, dif) {
      const c = cuenta();
      if (!c) throw new Error("Todavía se están contando tus monedas.");
      if (c.parada) throw new Error(`Tu cuenta está parada: le faltan ${formatoMonedas(c.falta)} monedas por un gasto sin fondos.`);
      if (c.saldo < p) throw new Error(`No te alcanza: tienes ${formatoMonedas(c.saldo)} monedas.`);
      const r = await fb.apuestaCasino(uid, j, p, dif);
      apuestas.set(r.k, p); pintaSaldo();
      return r;
    },
    marca: (k, ruta) => fb.marcaCasino(uid, k, ruta),
    leeRonda: k => fb.leeRondaCasino(uid, k),
    cobrado(k, pago) { if (pago > 0) { premios.set(k, pago); pintaSaldo(); } },
    rondas: () => mias(),
    economia: () => (d ? economia(d) : null)
  };

  function cabecera() {
    return `<header class="jg-cs-cab">
      <button class="jg-cs-volver" type="button" data-cs-volver hidden>← <span>Casino</span></button>
      <div class="jg-cs-marca"><i>♠</i><b>CASINO</b><small>PRO</small></div>
      <div class="jg-cs-der">
        <span class="jg-cs-saldo" title="Tu saldo">${MONEDA} <b data-cs-saldo translate="no">…</b></span>
        <span class="jg-cs-son">
          <button type="button" data-cs-mudo title="Silenciar efectos"></button>
          <input type="range" min="0" max="100" step="1" data-cs-vol aria-label="Volumen de los efectos">
        </span>
      </div>
    </header>`;
  }
  function pintaSonido() {
    const b = raiz.querySelector("[data-cs-mudo]"), v = raiz.querySelector("[data-cs-vol]");
    b.textContent = silenciado() ? "🔇" : volumenEfectos() < 0.4 ? "🔉" : "🔊";
    b.classList.toggle("off", silenciado());
    v.value = String(Math.round(volumenEfectos() * 100));
  }

  function menu() {
    const c = cuenta(), z = c ? c.casino : null;
    const neto = z ? z.pagado - z.apostado : 0;
    cuerpo.innerHTML = `
      <div class="jg-cs-menu">
        <div class="jg-cs-intro">
          <h2>Apuesta tus monedas</h2>
          <p>Gana o pierde lo que ganaste jugando. Todo es justo y comprobable: el azar de cada ronda sale de la hora del servidor, que nadie elige. Y la casa gana: en promedio devuelve ${Math.round(RETORNO * 100)} de cada 100 monedas apostadas.</p>
        </div>
        <div class="jg-cs-fichas">
          <button class="jg-cs-ficha av" type="button" data-cs-juego="avion">
            ${ARTE_AVION}
            <span class="jg-cs-ficha-t"><b>El Avión</b><small>El multiplicador sube mientras vuela. Retírate antes de que se estrelle.</small>
            <em>Apuesta ${APUESTA_MIN}–${AVION.max} · hasta ×${AVION.TOPE}</em></span>
          </button>
          <button class="jg-cs-ficha pg" type="button" data-cs-juego="pinguino">
            ${ARTE_PINGUINO}
            <span class="jg-cs-ficha-t"><b>Pingüinito</b><small>Salta de baldosa en baldosa. Cada salto multiplica, hasta que el hielo se rompe.</small>
            <em>Apuesta ${APUESTA_MIN}–${PINGUINO[0].max} · hasta ×${Math.floor(RETORNO / Math.pow(1 - PINGUINO[3].cae, PINGUINO[3].n))}</em></span>
          </button>
        </div>
        <div class="jg-cs-bajo">
          <section class="jg-cs-caja">
            <h3>Tus números</h3>
            ${z && z.rondas ? `<dl class="jg-cs-num">
              <div><dt>Rondas</dt><dd>${formatoMonedas(z.rondas)}</dd></div>
              <div><dt>Apostado</dt><dd>${formatoMonedas(z.apostado)}</dd></div>
              <div><dt>Cobrado</dt><dd>${formatoPago(z.pagado)}</dd></div>
              <div class="${neto >= 0 ? "bien" : "mal"}"><dt>Balance</dt><dd>${neto >= 0 ? "+" : "−"}${formatoPago(Math.round(Math.abs(neto) * 100) / 100)}</dd></div>
            </dl>` : `<p class="jg-nada">${c ? "Aún no apuestas. Empieza con poco: la apuesta mínima es de " + APUESTA_MIN + "." : "Contando tus monedas…"}</p>`}
          </section>
          <section class="jg-cs-caja">
            <h3>Grandes premios</h3>
            <div data-cs-feed>${feedHtml(8)}</div>
          </section>
        </div>
      </div>`;
  }
  /* Los últimos premios de todos (de las rondas que la economía da por
     válidas), los más recientes primero. */
  function feedHtml(n) {
    const e = d ? economia(d) : null;
    if (!e) return `<p class="jg-nada">Cargando…</p>`;
    const l = Object.values(e.rondas).filter(r => r.valida && r.estado === "cobrada" && r.pago > r.p).sort((a, b) => b.fin - a.fin).slice(0, n);
    if (!l.length) return `<p class="jg-nada">Nadie ha cobrado todavía. ¿Serás la primera persona?</p>`;
    return `<ul class="jg-cs-feed">${l.map(r => `<li>
      <span class="jg-cs-feed-j">${r.j === "a" ? "✈️" : "🐧"}</span>
      <span class="jg-cs-feed-n" data-perfil="${esc(r.u)}" translate="no">${esc(nombreDe(r.u))}</span>
      <span class="jg-cs-feed-m">${formatoMult(r.mult)}</span>
      <b>+${formatoPago(Math.round((r.pago - r.p) * 100) / 100)} ${MONEDA}</b></li>`).join("")}</ul>`;
  }
  api.feedHtml = feedHtml;

  function irA(cual) {
    const j = JUEGOS[cual] ? cual : "";
    if (j === actual && (j || cuerpo.firstChild)) return;
    if (juego) { juego.destruir(); juego = null; }
    actual = j;
    raiz.querySelector("[data-cs-volver]").hidden = !j;
    raiz.classList.toggle("en-juego", !!j);
    raiz.dataset.juego = j;
    if (!j) { menu(); return; }
    cuerpo.innerHTML = "";
    juego = JUEGOS[j].montar(cuerpo, api);
    if (d && juego.datos) juego.datos(d);
  }

  return {
    montar(h, cual) {
      raiz = document.createElement("section");
      raiz.className = "jg-cs";
      raiz.innerHTML = cabecera() + `<div class="jg-cs-cuerpo"></div>`;
      h.appendChild(raiz);
      cuerpo = raiz.querySelector(".jg-cs-cuerpo");
      ambientar("casino");
      pintaSonido();
      raiz.querySelector("[data-cs-volver]").onclick = () => { suena("clic"); ir(""); };
      raiz.querySelector("[data-cs-mudo]").onclick = () => { silenciar(!silenciado()); pintaSonido(); if (juego && juego.sonido) juego.sonido(); suena("clic"); };
      raiz.querySelector("[data-cs-vol]").oninput = e => { configurarEfectos(e.target.value / 100); if (silenciado() && +e.target.value > 0) silenciar(false); pintaSonido(); if (juego && juego.sonido) juego.sonido(); };
      cuerpo.addEventListener("click", e => {
        const b = e.target.closest("[data-cs-juego]");
        if (b) { suena("ficha"); ir(b.dataset.csJuego); }
      });
      irA(cual);
      off = datos(x => {
        d = x; pintaSaldo();
        if (juego && juego.datos) juego.datos(d);
        else if (!actual) menu();
      });
    },
    ir: cual => { if (raiz) irA(cual); },
    destruir() {
      if (off) off();
      if (juego) juego.destruir();
      juego = null; off = null;
      ambientar("");
      if (raiz) raiz.remove();
      raiz = null;
    }
  };
}
