import { escapeHtml as esc } from "../util.js";
import { suena } from "./sonido.js";

export function crearOrbita({ uid, jugar, terminar }) {
  let host, est, enviando = false, eje = "fila", firma = "", vistas = -1, muerto = false;
  function montar(el) {
    host = el;
    host.innerHTML = '<section class="jg-orbita">' +
      '<div class="jg-barra"><div class="jg-fase" aria-live="polite"></div><div class="jg-marcador"></div></div>' +
      '<div class="jg-orbita-cosmos"><div class="jg-orbita-grid" aria-label="Tablero de Órbita, seis filas por seis columnas"></div></div>' +
      '<div class="jg-orbita-controles"><span>Después de capturar, envía al rival a tu:</span>' +
      '<div class="jg-ejes" role="group" aria-label="Próximo eje del rival">' +
      '<button type="button" data-eje="fila" aria-pressed="true">↔ Fila</button>' +
      '<button type="button" data-eje="columna" aria-pressed="false">↕ Columna</button></div></div>' +
      '<p class="jg-orbita-error" role="alert"></p>' +
      '<details class="jg-instrucciones"><summary>Cómo jugar a Órbita</summary>' +
      '<p>Captura una estrella iluminada y suma su valor (1–5). Antes de capturar, elige <b>fila</b> o <b>columna</b>: tu rival solo podrá elegir una estrella de ese eje, pasando por tu captura.</p>' +
      '<p>Si ese eje queda vacío, el rival podrá elegir cualquier estrella libre. Al capturar las 36 estrellas, gana quien tenga más puntos. Un empate también es posible.</p></details></section>';
    host.addEventListener("click", clic);
  }
  function pintar() {
    if (!host || !est) return;
    const mio = est.fase === "jugando" && est.turno === uid;
    const rival = est.jugadores.find(j => j.uid === est.turno);
    host.querySelector(".jg-fase").textContent = est.fase === "espera" ? "Esperando a tu rival…"
      : est.fase === "fin" ? "Órbita completada" : mio
      ? "Tu turno · " + (est.libre ? "órbita libre" : "elige en la " + est.eje + " iluminada")
      : "Turno de " + (rival?.nombre || "tu rival");
    host.querySelector(".jg-marcador").innerHTML = est.jugadores.map((j, i) =>
      '<span class="jg-m" style="--c:' + (i ? "#fbba65" : "#b0a0ff") + '"><b>' +
      (est.puntos[j.uid] || 0) + '</b><span>' + esc(j.uid === uid ? "Tú" : j.nombre) + '</span></span>').join("");
    const focused = document.activeElement?.dataset?.casilla;
    host.querySelector(".jg-orbita-grid").innerHTML = est.estrellas.map((n, i) => {
      const autor = est.tomadas[i], legal = est.legales.includes(i), yo = autor === uid;
      return '<button type="button" class="jg-estrella ' + (legal ? "legal " : "") +
        (autor ? "tomada " + (yo ? "propia " : "rival ") : "") + (est.ultima === i ? "ultima" : "") +
        '" data-casilla="' + i + '" ' + (!mio || !legal || enviando ? "disabled" : "") +
        ' aria-label="Fila ' + (Math.floor(i / 6) + 1) + ", columna " + (i % 6 + 1) + ": " + n + " puntos" +
        (autor ? (yo ? ", capturada por ti" : ", capturada por el rival") : "") +
        '"><span aria-hidden="true">' + (autor ? (yo ? "●" : "◆") : "✦") + "</span><b>" + n + "</b></button>";
    }).join("");
    if (focused !== undefined) host.querySelector('[data-casilla="' + focused + '"]:not(:disabled)')?.focus();
    for (const b of host.querySelectorAll("[data-eje]")) {
      b.setAttribute("aria-pressed", String(b.dataset.eje === eje));
      b.disabled = !mio || enviando;
    }
  }
  async function clic(ev) {
    const b = ev.target.closest("button");
    if (!b || !est || enviando || est.fase !== "jugando" || est.turno !== uid) return;
    if (b.dataset.eje) { eje = b.dataset.eje; pintar(); return; }
    if (b.dataset.casilla === undefined) return;
    const casilla = Number(b.dataset.casilla);
    if (!est.legales.includes(casilla)) return;
    enviando = true;
    host.querySelector(".jg-orbita-error").textContent = "";
    pintar();
    try { await jugar({ t: "orbita", uid, casilla, eje }); }
    catch (e) { if (!muerto) host.querySelector(".jg-orbita-error").textContent = "No se pudo guardar la captura. Inténtalo de nuevo."; }
    finally { enviando = false; if (!muerto) pintar(); }
  }
  function actualizar(p, estado) {
    est = estado;
    const n = Object.keys(est.tomadas).length;
    if (vistas >= 0 && n > vistas) suena(est.fase === "fin" ? (est.ganador === uid ? "victoria" : est.ganador === "" ? "empate" : "derrota") : "ficha");
    vistas = n;
    const nueva = JSON.stringify([est.tomadas, est.turno, est.fase, est.jugadores]);
    if (nueva !== firma) { firma = nueva; pintar(); }
    if (est.fase === "fin" && !p.fin && est.jugadores.some(j => j.uid === uid)) terminar(est.ganador, est.motivo);
  }
  function destruir() { muerto = true; host?.removeEventListener("click", clic); if (host) host.innerHTML = ""; host = null; }
  return { montar, actualizar, destruir };
}
