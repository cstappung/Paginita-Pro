/* Referidos — lo que se pinta: el «+» junto al saldo de la cabecera, el
   menú que abre (canjear un código, la barra de juegos jugados y «Referir
   a otros») y la ventana del medio que explica cómo funciona y donde se
   configura el código propio, una sola vez. El cálculo es de
   referidos.js; las reglas de `referidos/` comprueban lo demás. */
import {
  PREMIO_REFERIDO, MIN_JUEGOS, normalizaCodigo, juegosJugados, puedeReferir, codigoDe, referidos,
  motivoNoCanje, motivoNoCodigo
} from "./referidos.js";
import { formatoMonedas } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* La barra de «¿cumples con los juegos mínimos?». */
function barraHtml(n) {
  const k = Math.min(n, MIN_JUEGOS), ok = n >= MIN_JUEGOS, falta = MIN_JUEGOS - k;
  return `<div class="jg-ref-req${ok ? " ok" : ""}">
    <div class="jg-ref-req-t"><span>Juegos distintos jugados</span><b>${k}/${MIN_JUEGOS}</b></div>
    <div class="jg-ref-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${MIN_JUEGOS}" aria-valuenow="${k}"><i style="width:${Math.round(100 * k / MIN_JUEGOS)}%"></i></div>
    <small>${ok ? "✓ Cumples: ya puedes referir a otros" : `Juega ${falta} ${falta === 1 ? "juego distinto más" : "juegos distintos más"} (de sala o del club) para poder referir`}</small>
  </div>`;
}

/* `boton`: el «+» de la cabecera. `uid()` y `datos()` dan la sesión y las
   lecturas de las monedas; `fb` escribe; `avisa` es la cola de avisos de
   monedas; `alFallar(e)` decide qué decir ante un error de escritura
   (devuelve true si ya lo mostró, p. ej. la capa de las reglas). */
export function crearReferidos({ boton, uid, datos, fb, avisa, nombre, alFallar }) {
  let pop = null, modal = null, ocupado = false, vistos = null, confirma = "";

  /* ---------- el menú del «+» ---------- */
  function pintaPop() {
    if (!pop) return;
    const u = uid(), d = datos();
    if (!u) { cierraPop(); return; }
    const listo = !!(d && d.completo), usado = listo && ((d.referidos || {}).u || {})[u];
    const n = listo ? juegosJugados(u, d).size : 0;
    const firma = JSON.stringify([listo, !!usado, n, ocupado]);
    if (pop.dataset.f === firma) return;
    const borrador = pop.querySelector("#refCodigo"), valor = borrador ? borrador.value : "";
    const error = pop.querySelector("#refErr"), textoError = error ? error.textContent : "";
    pop.dataset.f = firma;
    pop.innerHTML = !listo ? `<p class="jg-ref-carga">Cargando…</p>` : `
      <section class="jg-ref-canje">
        ${usado ? `<p class="jg-ref-usado">✓ Código ya usado</p>` : `
        <b class="jg-ref-t">¿Te invitó alguien?</b>
        <small class="jg-ref-s">Ingresa su código y ganan ${formatoMonedas(PREMIO_REFERIDO)} ${MONEDA} cada uno.</small>
        <form class="jg-ref-fila" id="refForm">
          <input class="inp" id="refCodigo" maxlength="16" placeholder="Código" autocomplete="off" autocapitalize="characters" spellcheck="false" translate="no" aria-label="Código de referido">
          <button class="btn" id="refCanjear" ${ocupado ? "disabled" : ""}>${ocupado ? "…" : "Canjear"}</button>
        </form>
        <div class="jg-modal-err" id="refErr"></div>`}
      </section>
      ${barraHtml(n)}
      <button type="button" class="btn2 jg-ref-btn" id="refReferir">🤝 Referir a otros</button>`;
    const inp = pop.querySelector("#refCodigo");
    if (inp) {
      inp.value = valor;
      inp.oninput = () => { const v = normalizaCodigo(inp.value); if (v !== inp.value) inp.value = v; pop.querySelector("#refErr").textContent = ""; };
      pop.querySelector("#refErr").textContent = textoError;
      pop.querySelector("#refForm").onsubmit = ev => { ev.preventDefault(); canjea(inp.value); };
    }
    pop.querySelector("#refReferir").onclick = () => { cierraPop(); abreModal(); };
  }
  function colocaPop() {
    if (!pop) return;
    const r = boton.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 16);
    pop.style.width = w + "px";
    pop.style.top = Math.round(r.bottom + 8) + "px";
    pop.style.left = Math.round(Math.max(8, Math.min(r.right - w + 14, window.innerWidth - w - 8))) + "px";
  }
  function abrePop() {
    if (pop) { cierraPop(); return; }
    pop = document.createElement("div");
    pop.className = "jg-ref-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Códigos de referido");
    document.body.appendChild(pop);
    boton.setAttribute("aria-expanded", "true");
    pintaPop();
    colocaPop();
    const inp = pop.querySelector("#refCodigo");
    if (inp && window.matchMedia("(pointer:fine)").matches) inp.focus();
  }
  function cierraPop() {
    if (!pop) return;
    pop.remove(); pop = null;
    boton.setAttribute("aria-expanded", "false");
  }
  document.addEventListener("pointerdown", ev => {
    if (pop && !pop.contains(ev.target) && !boton.contains(ev.target)) cierraPop();
  }, true);
  document.addEventListener("keydown", ev => {
    if (ev.key !== "Escape") return;
    if (modal) cierraModal(); else if (pop) { cierraPop(); boton.focus(); }
  });
  window.addEventListener("resize", colocaPop);
  boton.onclick = abrePop;

  async function canjea(texto) {
    const u = uid(), d = datos(), c = normalizaCodigo(texto);
    const err = m => { const e = pop && pop.querySelector("#refErr"); if (e) e.textContent = m; };
    if (!u || !d || ocupado) return;
    if (!c) { err("Escribe el código que te pasaron."); return; }
    /* Lo que hay ahora, no lo de hace un rato: el código pudo nacer recién. */
    let fresco = d;
    try { fresco = Object.assign({}, d, { referidos: await fb.leeReferidos() }); } catch (e) { /* vale lo que hay */ }
    const motivo = motivoNoCanje(u, c, fresco);
    if (motivo) { err(motivo); return; }
    ocupado = true; pintaPop();
    try {
      await fb.usaCodigo(u, c, fresco.referidos.c[c]);
      ocupado = false;
      avisa("🤝", "¡Código canjeado!", `Tú y quien te invitó ganan ${formatoMonedas(PREMIO_REFERIDO)} monedas`, PREMIO_REFERIDO, "referido");
    } catch (e) {
      ocupado = false;
      console.warn("[juegos] no se pudo usar el código", e);
      pop && (pop.dataset.f = "");
      pintaPop();
      if (!alFallar(e)) err("No se pudo canjear. Revisa la conexión e inténtalo otra vez.");
      return;
    }
    pintaPop();
  }

  /* ---------- la ventana «Referir a otros» ---------- */
  function pintaModal() {
    if (!modal) return;
    const u = uid(), d = datos();
    if (!u) { cierraModal(); return; }
    const listo = !!(d && d.completo), mio = listo ? codigoDe(u, d) : "", n = listo ? juegosJugados(u, d).size : 0;
    const puede = listo && puedeReferir(u, d), de = listo ? (referidos(d).de[u] || []) : [];
    const firma = JSON.stringify([listo, mio, n, de, ocupado, confirma]);
    const caja = modal.querySelector("#refCuerpo");
    if (caja.dataset.f === firma) return;
    const borrador = caja.querySelector("#refNuevo"), valor = borrador ? borrador.value : "";
    const error = caja.querySelector("#refErr2"), textoError = error ? error.textContent : "";
    caja.dataset.f = firma;
    let html;
    if (!listo) html = `<p class="jg-ref-carga">Cargando…</p>`;
    else if (mio) html = `
      <div class="jg-ref-mio">
        <small>Tu código</small>
        <b translate="no">${esc(mio)}</b>
        <button type="button" class="btn2" id="refCopiar">Copiar</button>
      </div>
      <p class="jg-ref-cuenta">${de.length ? `${de.length} ${de.length === 1 ? "persona usó" : "personas usaron"} tu código · +${formatoMonedas(de.length * PREMIO_REFERIDO)} ${MONEDA}` : "Todavía nadie usó tu código. ¡Compártelo!"}</p>
      ${de.length ? `<ul class="jg-ref-lista">${de.slice(-8).reverse().map(x => `<li data-perfil="${esc(x)}" translate="no">${esc(nombre(x) || "Alguien")}</li>`).join("")}</ul>` : ""}`;
    else if (!puede) html = `
      ${barraHtml(n)}
      <p class="jg-ref-nota">Cuando cumplas podrás elegir aquí tu código.</p>`;
    else html = `
      ${barraHtml(n)}
      <form id="refFormNuevo">
        <label class="jg-campo">
          <span>Elige tu código</span>
          <input class="inp jg-ref-nuevo" id="refNuevo" maxlength="16" placeholder="Ej.: PIA2026" autocomplete="off" autocapitalize="characters" spellcheck="false" translate="no" ${confirma ? "readonly" : ""}>
        </label>
        <p class="jg-ref-aviso">⚠ Solo se puede configurar <b>una vez</b>: después no se cambia. De 4 a 12 letras o números.</p>
        <div class="jg-modal-err" id="refErr2"></div>
        <div class="jg-fin-btns jg-ref-btns">
          <button class="btn" id="refGuardar" ${ocupado ? "disabled" : ""}>${ocupado ? "Guardando…" : confirma ? `Sí, mi código es «${esc(confirma)}»` : "Guardar mi código"}</button>
          ${confirma && !ocupado ? `<button type="button" class="btn2" id="refCambiar">Cambiar</button>` : ""}
        </div>
      </form>`;
    caja.innerHTML = html;
    const nuevo = caja.querySelector("#refNuevo");
    if (nuevo) {
      nuevo.value = confirma || valor;
      caja.querySelector("#refErr2").textContent = textoError;
      nuevo.oninput = () => { const v = normalizaCodigo(nuevo.value); if (v !== nuevo.value) nuevo.value = v; caja.querySelector("#refErr2").textContent = ""; };
      caja.querySelector("#refFormNuevo").onsubmit = ev => { ev.preventDefault(); guarda(nuevo.value); };
      const cambia = caja.querySelector("#refCambiar");
      if (cambia) cambia.onclick = () => { confirma = ""; pintaModal(); const i = caja.querySelector("#refNuevo"); if (i) i.focus(); };
    }
    const copiar = caja.querySelector("#refCopiar");
    if (copiar) copiar.onclick = async () => {
      try { await navigator.clipboard.writeText(mio); copiar.textContent = "¡Copiado!"; }
      catch (e) { copiar.textContent = mio; }
      setTimeout(() => { if (copiar.isConnected) copiar.textContent = "Copiar"; }, 1600);
    };
  }
  function abreModal() {
    if (modal) return;
    confirma = "";
    modal = document.createElement("div");
    modal.className = "jg-modal-capa";
    modal.innerHTML = `
      <div class="jg-modal jg-ref-modal" role="dialog" aria-modal="true" aria-label="Referir a otros">
        <button class="jg-fin-x" title="Cerrar">✕</button>
        <div class="jg-modal-t">🤝 Invita y ganen ${formatoMonedas(PREMIO_REFERIDO)} ${MONEDA} cada uno</div>
        <p class="jg-modal-s">Trae gente a jugar: cada persona que entre con tu código te da
          ${formatoMonedas(PREMIO_REFERIDO)} monedas, y a ella otras ${formatoMonedas(PREMIO_REFERIDO)}.</p>
        <ol class="jg-ref-pasos">
          <li><b>Crea tu código</b> aquí abajo. Es único: nadie más puede tener el mismo.</li>
          <li><b>Compártelo</b> con quien quieras invitar.</li>
          <li><b>Que lo canjee:</b> toca el <span class="jg-ref-mas-ej">+</span> junto a sus monedas,
            arriba a la derecha, y escribe tu código. En ese momento los dos reciben las monedas.</li>
        </ol>
        <ul class="jg-ref-letra">
          <li>Para referir necesitas haber jugado al menos <b>${MIN_JUEGOS} juegos distintos</b> (de sala o del club).</li>
          <li>Cada persona puede usar <b>un solo código</b>, y nunca el suyo. Dos personas no se pueden referir la una a la otra.</li>
          <li>Tu código lo pueden usar todas las personas que quieras.</li>
        </ul>
        <div class="jg-ref-cuerpo" id="refCuerpo"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal || ev.target.closest(".jg-fin-x")) cierraModal(); };
    pintaModal();
    const i = modal.querySelector("#refNuevo");
    if (i && window.matchMedia("(pointer:fine)").matches) i.focus();
  }
  function cierraModal() {
    if (!modal) return;
    modal.remove(); modal = null; confirma = "";
    boton.focus();
  }

  async function guarda(texto) {
    const u = uid(), d = datos(), c = normalizaCodigo(texto);
    const caja = modal && modal.querySelector("#refCuerpo");
    const err = m => { const e = caja && caja.querySelector("#refErr2"); if (e) e.textContent = m; };
    if (!u || !d || ocupado) return;
    let fresco = d;
    try { fresco = Object.assign({}, d, { referidos: await fb.leeReferidos() }); } catch (e) { /* vale lo que hay */ }
    const motivo = motivoNoCodigo(u, c, fresco);
    if (motivo) { confirma = ""; caja && (caja.dataset.f = ""); pintaModal(); err(motivo); return; }
    /* Primero se pide confirmar: no hay vuelta atrás. */
    if (confirma !== c) { confirma = c; pintaModal(); return; }
    ocupado = true; pintaModal();
    try {
      await fb.configuraCodigo(u, c);
      ocupado = false; confirma = "";
      avisa("🤝", "¡Tu código está listo!", "Compártelo para que lo canjeen", 0, "referido");
    } catch (e) {
      ocupado = false; confirma = "";
      console.warn("[juegos] no se pudo guardar el código", e);
      let tomado = false;
      try { tomado = !!(await fb.leeReferidos()).c?.[c]; } catch (x) { /* sin red */ }
      caja && (caja.dataset.f = "");
      pintaModal();
      if (tomado) err("Ese código ya lo tiene otra persona. Elige otro.");
      else if (!alFallar(e)) err("No se pudo guardar. Revisa la conexión e inténtalo otra vez.");
      return;
    }
    pintaModal();
  }

  /* Alguien entró con mi código: un aviso, solo por lo que llega estando
     aquí (lo de antes de abrir la página ya está en el saldo). Sin su
     nombre: el aviso no lleva `translate="no"`, la lista de la ventana sí. */
  function avisaNuevos() {
    const u = uid(), d = datos();
    if (!u || !d || !d.completo) return;
    const de = referidos(d).de[u] || [];
    if (vistos && vistos.u === u) for (const x of de) if (!vistos.s.has(x))
      avisa("🤝", "Alguien entró con tu código", "Míralo en «Referir a otros», junto a tus monedas", PREMIO_REFERIDO, "referido");
    vistos = { u, s: new Set(de) };
  }

  return {
    refresca() { avisaNuevos(); pintaPop(); pintaModal(); },
    cierra() { cierraPop(); cierraModal(); vistos = null; }
  };
}
