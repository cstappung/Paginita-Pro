/* El reproductor de la cabecera: un botón con el nombre de lo que suena y,
   al pulsarlo, un panel con el repertorio.

   El panel cuelga de `<body>` en `position:fixed`, como el de reglas y el
   popover de color de ColabDraw: la cabecera se parte en dos filas en un
   teléfono y un panel anclado dentro de ella quedaba cortado. Se reconstruye
   solo al abrirse; mientras está abierto, `sonido.js` avisa de cada cambio
   (`alCambiarMusica`) y únicamente se retocan las clases y los textos, así el
   deslizador de volumen no pierde el dedo a mitad de arrastre. */
"use strict";
import {
  CANCIONES, GRUPOS, MODOS_LISTA, estadoMusica, alCambiarMusica, elegirCancion,
  siguienteCancion, modoMusica, configurarMusica, activarAudio
} from "./sonido.js";

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const EQ = '<span class="jg-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';

export function montaReproductor(boton) {
  if (!boton) return;
  let panel = null;
  boton.innerHTML = EQ + '<span class="jg-rep-nom"></span><span class="jg-rep-flecha" aria-hidden="true">▾</span>';
  boton.setAttribute("aria-haspopup", "dialog");
  boton.setAttribute("aria-expanded", "false");

  function titulo(e) {
    if (!e.on) return "Sin música";
    if (e.cancion) return e.cancion.nombre;
    return e.eleccion === "auto" ? "Música · auto" : "Música";
  }
  function pintaBoton(e) {
    boton.querySelector(".jg-rep-nom").textContent = titulo(e);
    boton.classList.toggle("sonando", e.sonando);
    boton.classList.toggle("apagado", !e.on);
    boton.title = e.cancion ? "Sonando: " + e.cancion.nombre + " — " + e.cancion.desc : "Elegir música";
  }

  function lista(e) {
    let h = `<button class="jg-rep-it auto" data-cancion="auto"><span class="jg-rep-ic">✦</span><span><b>Automático</b><small>La canción de cada juego · silencio en el vestíbulo</small></span></button>`;
    for (const g of GRUPOS) {
      const cs = CANCIONES.filter(c => c.grupo === g);
      if (!cs.length) continue;
      h += `<div class="jg-rep-grupo">${esc(g)}</div>`;
      for (const c of cs) h += `<button class="jg-rep-it" data-cancion="${esc(c.id)}"><span class="jg-rep-ic">${EQ}<em>♪</em></span><span><b>${esc(c.nombre)}</b><small>${esc(c.desc)}</small></span></button>`;
    }
    return h;
  }

  function construye() {
    const e = estadoMusica();
    panel = document.createElement("div");
    panel.className = "jg-rep";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Reproductor de música");
    panel.innerHTML = `
      <div class="jg-rep-ahora">
        <div class="jg-rep-disco">${EQ}</div>
        <div class="jg-rep-txt"><div class="jg-rep-k"></div><div class="jg-rep-tit"></div><div class="jg-rep-sub"></div></div>
      </div>
      <div class="jg-rep-ctrl">
        <button class="jg-rep-b" data-rep="ant" title="Anterior" aria-label="Anterior">⏮</button>
        <button class="jg-rep-b pp" data-rep="pp" title="Reproducir o pausar" aria-label="Reproducir o pausar"></button>
        <button class="jg-rep-b" data-rep="sig" title="Siguiente" aria-label="Siguiente">⏭</button>
        <label class="jg-rep-vol"><span aria-hidden="true">🔉</span><input type="range" min="0" max="100" data-rep="vol" aria-label="Volumen de la música"></label>
      </div>
      <div class="jg-rep-modos" role="radiogroup" aria-label="Al terminar la canción">
        ${Object.entries(MODOS_LISTA).map(([k, v]) => `<button role="radio" data-modo="${k}">${k === "repite" ? "🔁" : k === "lista" ? "➡" : "🔀"} ${esc(v)}</button>`).join("")}
      </div>
      <div class="jg-rep-aviso" hidden>Este juego trae su propia música; la tuya vuelve al salir.</div>
      <div class="jg-rep-lista">${lista(e)}</div>`;
    panel.querySelector('[data-rep="vol"]').value = Math.round(e.volumen * 100);
    document.body.appendChild(panel);
    panel.addEventListener("click", alClic);
    panel.querySelector('[data-rep="vol"]').addEventListener("input", ev => {
      activarAudio(); configurarMusica(true, Number(ev.target.value) / 100);
    });
    refresca(e);
    coloca();
    requestAnimationFrame(() => panel && panel.classList.add("abierto"));
    const act = panel.querySelector(".jg-rep-it.elegida");
    if (act) act.scrollIntoView({ block: "center" });
  }

  function refresca(e) {
    pintaBoton(e);
    if (!panel) return;
    const c = e.cancion;
    panel.classList.toggle("sonando", e.sonando);
    panel.querySelector(".jg-rep-k").textContent = !e.on ? "En pausa" : e.sonando ? "Sonando" : c ? "Lista para sonar" : "Nada que tocar aquí";
    panel.querySelector(".jg-rep-tit").textContent = c ? c.nombre : e.eleccion === "auto" ? "Automático" : "—";
    panel.querySelector(".jg-rep-sub").textContent = c ? c.desc : e.eleccion === "auto" ? "Elige una canción para que suene también en el vestíbulo" : "";
    panel.querySelector('[data-rep="pp"]').textContent = e.on ? "⏸" : "▶";
    panel.querySelector(".jg-rep-aviso").hidden = !e.propia;
    for (const b of panel.querySelectorAll("[data-modo]")) {
      const on = b.dataset.modo === e.modo;
      b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on));
      b.disabled = e.eleccion === "auto";
    }
    for (const b of panel.querySelectorAll("[data-cancion]")) {
      const id = b.dataset.cancion;
      b.classList.toggle("elegida", id === e.eleccion);
      b.classList.toggle("activa", !!c && id === c.id);
    }
  }

  function coloca() {
    if (!panel) return;
    const r = boton.getBoundingClientRect(), ancho = Math.min(340, window.innerWidth - 24);
    panel.style.width = ancho + "px";
    panel.style.left = Math.max(12, Math.min(window.innerWidth - ancho - 12, r.right - ancho)) + "px";
    panel.style.top = Math.round(r.bottom + 8) + "px";
    panel.style.maxHeight = Math.max(240, window.innerHeight - r.bottom - 20) + "px";
  }

  function alClic(ev) {
    activarAudio();
    const c = ev.target.closest("[data-cancion]");
    if (c) { elegirCancion(c.dataset.cancion); return; }
    const m = ev.target.closest("[data-modo]");
    if (m) { modoMusica(m.dataset.modo); return; }
    const b = ev.target.closest("[data-rep]");
    if (!b) return;
    const e = estadoMusica();
    if (b.dataset.rep === "pp") configurarMusica(!e.on);
    else if (b.dataset.rep === "sig") siguienteCancion(1);
    else if (b.dataset.rep === "ant") siguienteCancion(-1);
  }

  function cierra() {
    if (!panel) return;
    const p = panel; panel = null;
    boton.setAttribute("aria-expanded", "false");
    p.classList.remove("abierto");
    setTimeout(() => p.remove(), 180);
  }
  function abre() {
    if (panel) return;
    boton.setAttribute("aria-expanded", "true");
    construye();
  }

  boton.addEventListener("click", () => { activarAudio(); panel ? cierra() : abre(); });
  document.addEventListener("pointerdown", ev => {
    if (panel && !panel.contains(ev.target) && !boton.contains(ev.target)) cierra();
  }, true);
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && panel) { cierra(); boton.focus(); } });
  window.addEventListener("resize", coloca);
  window.addEventListener("scroll", coloca, { passive: true });
  alCambiarMusica(refresca);
  pintaBoton(estadoMusica());
}
