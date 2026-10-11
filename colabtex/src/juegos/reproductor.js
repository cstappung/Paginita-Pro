/* El reproductor de la cabecera: un botón con el nombre de lo que suena y,
   al pulsarlo, un panel con el repertorio.

   El panel cuelga de `<body>` en `position:fixed`, como el de reglas y el
   popover de color de ColabDraw: la cabecera se parte en dos filas en un
   teléfono y un panel anclado dentro de ella quedaba cortado. Se reconstruye
   solo al abrirse; mientras está abierto, `sonido.js` avisa de cada cambio
   (`alCambiarMusica`) y únicamente se retocan las clases y los textos, así el
   deslizador de volumen no pierde el dedo a mitad de arrastre.

   La pestaña YouTube (`youtube.js`) pega enlaces y lista las playlists de
   la cuenta de Google. Mientras YouTube suena, «ahora», ⏯ ⏮ ⏭ y el botón de
   la cabecera hablan de YouTube; elegir una canción de la casa lo cierra. */
"use strict";
import {
  CANCIONES, GRUPOS, MODOS_LISTA, estadoMusica, alCambiarMusica, elegirCancion,
  siguienteCancion, modoMusica, configurarMusica, activarAudio,
  volumenEfectos, configurarEfectos
} from "./sonido.js";
import {
  estadoYT, alCambiarYT, preparaYT, tocaEnlace, tocaListaYT, conectarYT, desconectarYT,
  alternaYT, siguienteYT, cierraYT
} from "./youtube.js";

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const G = '<svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const EQ = '<span class="jg-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';

export function montaReproductor(boton) {
  if (!boton) return;
  let panel = null;
  boton.innerHTML = EQ + '<span class="jg-rep-nom"></span><span class="jg-rep-flecha" aria-hidden="true">▾</span>';
  boton.setAttribute("aria-haspopup", "dialog");
  boton.setAttribute("aria-expanded", "false");

  let pestana = "casa";
  try { if (localStorage.getItem("jg.rep.pestana") === "yt") pestana = "yt"; } catch (_) {}
  let claveYT = "";

  function titulo(e) {
    const y = estadoYT();
    if (y.activo) return y.titulo || "YouTube";
    if (!e.on) return "Sin música";
    if (e.cancion) return e.cancion.nombre;
    return e.eleccion === "auto" ? "Música · auto" : "Música";
  }
  function pintaBoton(e) {
    const y = estadoYT(), nom = boton.querySelector(".jg-rep-nom");
    nom.textContent = titulo(e);
    nom.toggleAttribute("translate", y.activo); if (y.activo) nom.setAttribute("translate", "no");
    boton.classList.toggle("sonando", y.activo ? y.sonando : e.sonando);
    boton.classList.toggle("apagado", y.activo ? !y.sonando : !e.on);
    boton.title = y.activo ? "YouTube: " + (y.titulo || "cargando") : e.cancion ? "Sonando: " + e.cancion.nombre + " — " + e.cancion.desc : "Elegir música";
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
      <label class="jg-rep-vol jg-rep-fx"><span>Efectos</span><input type="range" min="0" max="100" data-rep="fx" aria-label="Volumen de los efectos"></label>
      <div class="jg-rep-modos" role="radiogroup" aria-label="Al terminar la canción">
        ${Object.entries(MODOS_LISTA).map(([k, v]) => `<button role="radio" data-modo="${k}">${k === "repite" ? "🔁" : k === "lista" ? "➡" : "🔀"} ${esc(v)}</button>`).join("")}
      </div>
      <div class="jg-rep-aviso" hidden>Este juego trae su propia música; la tuya vuelve al salir.</div>
      <div class="jg-rep-tabs" role="tablist">
        <button role="tab" data-pestana="casa">♪ Repertorio</button>
        <button role="tab" data-pestana="yt"><span class="jg-yt-logo" aria-hidden="true"></span> YouTube</button>
      </div>
      <div class="jg-rep-lista" role="tabpanel">${lista(e)}</div>
      <div class="jg-rep-lista jg-rep-yt" role="tabpanel">
        <form class="jg-yt-pega">
          <input type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Pega un enlace de YouTube o YouTube Music" aria-label="Enlace de YouTube o YouTube Music">
          <button type="submit" title="Reproducir el enlace" aria-label="Reproducir el enlace">▶</button>
        </form>
        <div class="jg-yt-err" role="alert" hidden></div>
        <div class="jg-yt-cuenta"></div>
        <div class="jg-yt-listas"></div>
      </div>`;
    panel.querySelector('[data-rep="vol"]').value = Math.round(e.volumen * 100);
    panel.querySelector('[data-rep="fx"]').value = Math.round(volumenEfectos() * 100);
    panel.querySelector('[data-rep="fx"]').addEventListener("input", ev => { activarAudio(); configurarEfectos(Number(ev.target.value) / 100); });
    document.body.appendChild(panel);
    panel.addEventListener("click", alClic);
    panel.querySelector(".jg-yt-pega").addEventListener("submit", ev => {
      ev.preventDefault();
      const inp = ev.target.querySelector("input");
      const err = tocaEnlace(inp.value);
      muestraError(err);
      if (!err) inp.value = "";
    });
    claveYT = "";
    if (pestana === "yt") preparaYT();
    panel.querySelector('[data-rep="vol"]').addEventListener("input", ev => {
      activarAudio(); configurarMusica(true, Number(ev.target.value) / 100);
    });
    refresca(e);
    coloca();
    requestAnimationFrame(() => panel && panel.classList.add("abierto"));
    const act = panel.querySelector(".jg-rep-it.elegida");
    if (act) act.scrollIntoView({ block: "center" });
  }

  function muestraError(m) {
    const d = panel && panel.querySelector(".jg-yt-err");
    if (!d) return;
    d.textContent = m || ""; d.hidden = !m;
  }

  /* La pestaña YouTube: la cuenta y las listas se rehacen solo si cambiaron,
     para no perder el desplazamiento ni el foco en cada pausa del video. */
  function pintaYT(y) {
    const clave = JSON.stringify([y.cuenta, y.listas && y.listas.map(l => l.id), y.conectando, y.conToken]);
    if (clave !== claveYT) {
      claveYT = clave;
      let h;
      if (y.conectando) h = `<div class="jg-yt-nota">Conectando con Google…</div>`;
      else if (!y.cuenta) h = `<button class="jg-yt-google" data-ytacc="conectar">${G}<span>Conectar con Google</span></button>
        <div class="jg-yt-nota">Para escuchar tus playlists y tus «Me gusta». Solo se pide permiso de lectura, y no cambia tu sesión del sitio.</div>`;
      else h = `<div class="jg-yt-yo">${y.cuenta.foto ? `<img src="${esc(y.cuenta.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="jg-yt-logo" aria-hidden="true"></span>`}
          <b translate="no">${esc(y.cuenta.nombre)}</b>
          <button class="jg-yt-salir" data-ytacc="salir">Desconectar</button></div>
        ${y.listas ? "" : `<button class="jg-yt-google" data-ytacc="conectar">${G}<span>Ver mis playlists</span></button>`}`;
      panel.querySelector(".jg-yt-cuenta").innerHTML = h;
      let l = "";
      if (y.listas && !y.listas.length) l = `<div class="jg-yt-nota">Esta cuenta no tiene playlists en YouTube.</div>`;
      else if (y.listas) {
        l = `<div class="jg-rep-grupo">Tus playlists</div>`;
        for (const x of y.listas) {
          const ic = x.especial ? `<em>👍</em>` : x.mini ? `<img src="${esc(x.mini)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<em>♪</em>`;
          const sub = x.especial ? "Lo que marcaste con 👍" : x.n == null ? "" : x.n === 1 ? "1 video" : x.n + " videos";
          l += `<button class="jg-rep-it" data-ytlista="${esc(x.id)}" data-yttit="${esc(x.titulo)}"><span class="jg-rep-ic jg-yt-ic">${EQ}${ic}</span><span><b translate="no">${esc(x.titulo)}</b><small>${esc(sub)}</small></span></button>`;
        }
      }
      panel.querySelector(".jg-yt-listas").innerHTML = l;
    }
    muestraError(y.error);
    for (const b of panel.querySelectorAll("[data-ytlista]")) {
      const id = b.dataset.ytlista;
      b.classList.toggle("activa", y.activo && id === y.origenId);
      b.classList.toggle("elegida", y.activo && id === y.origenId);
      b.classList.toggle("cargando", id === y.cargando);
    }
  }

  function refresca(e) {
    pintaBoton(e);
    if (!panel) return;
    const c = e.cancion, y = estadoYT();
    panel.classList.toggle("sonando", y.activo ? y.sonando : e.sonando);
    panel.classList.toggle("con-yt", y.activo);
    const tit = panel.querySelector(".jg-rep-tit"), sub = panel.querySelector(".jg-rep-sub");
    if (y.activo) {
      panel.querySelector(".jg-rep-k").textContent = "YouTube · " + (y.sonando ? "sonando" : y.estado === 3 || y.estado === -1 ? "cargando" : "en pausa");
      tit.textContent = y.titulo || "Cargando…";
      sub.textContent = [y.autor, y.origen].filter(Boolean).join(" · ");
      panel.querySelector('[data-rep="pp"]').textContent = y.estado === 1 || y.estado === 3 ? "⏸" : "▶";
    } else {
      panel.querySelector(".jg-rep-k").textContent = !e.on ? "En pausa" : e.sonando ? "Sonando" : c ? "Lista para sonar" : "Nada que tocar aquí";
      tit.textContent = c ? c.nombre : e.eleccion === "auto" ? "Automático" : "—";
      sub.textContent = c ? c.desc : e.eleccion === "auto" ? "Elige una canción para que suene también en el vestíbulo" : "";
      panel.querySelector('[data-rep="pp"]').textContent = e.on ? "⏸" : "▶";
    }
    tit.toggleAttribute("translate", y.activo); sub.toggleAttribute("translate", y.activo);
    if (y.activo) { tit.setAttribute("translate", "no"); sub.setAttribute("translate", "no"); }
    panel.querySelector(".jg-rep-aviso").hidden = !e.propia || y.activo;
    for (const b of panel.querySelectorAll("[data-modo]")) {
      const on = b.dataset.modo === e.modo;
      b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on));
      b.disabled = e.eleccion === "auto" || y.activo;
    }
    for (const b of panel.querySelectorAll("[data-pestana]")) {
      const on = b.dataset.pestana === pestana;
      b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on));
    }
    const [casa, yt] = panel.querySelectorAll(".jg-rep-lista");
    casa.hidden = pestana !== "casa"; yt.hidden = pestana !== "yt";
    pintaYT(y);
    for (const b of panel.querySelectorAll("[data-cancion]")) {
      const id = b.dataset.cancion;
      b.classList.toggle("elegida", !y.activo && id === e.eleccion);
      b.classList.toggle("activa", !y.activo && !!c && id === c.id);
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
    const p = ev.target.closest("[data-pestana]");
    if (p) {
      pestana = p.dataset.pestana;
      try { localStorage.setItem("jg.rep.pestana", pestana); } catch (_) {}
      if (pestana === "yt") preparaYT();
      refresca(estadoMusica());
      return;
    }
    const acc = ev.target.closest("[data-ytacc]");
    if (acc) { acc.dataset.ytacc === "salir" ? desconectarYT() : conectarYT(); return; }
    const l = ev.target.closest("[data-ytlista]");
    if (l) { tocaListaYT(l.dataset.ytlista, l.dataset.yttit); return; }
    const c = ev.target.closest("[data-cancion]");
    if (c) { if (estadoYT().activo) cierraYT(); elegirCancion(c.dataset.cancion); return; }
    const m = ev.target.closest("[data-modo]");
    if (m) { modoMusica(m.dataset.modo); return; }
    const b = ev.target.closest("[data-rep]");
    if (!b) return;
    const e = estadoMusica();
    if (estadoYT().activo && b.dataset.rep !== "vol") {
      if (b.dataset.rep === "pp") alternaYT(); else siguienteYT(b.dataset.rep === "sig" ? 1 : -1);
      return;
    }
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
  alCambiarYT(() => refresca(estadoMusica()));
  pintaBoton(estadoMusica());
}
