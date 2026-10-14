import * as fb from "../fb-juegos.js";
import { escapeHtml } from "../util.js";
import { BT3_BATALLAS, BT3_TIEMPOS } from "./motor.js";

/* Budokai Tenkaichi 3 — el cartero entre la sala y el juego.

   El juego entero vive en `juegos/bt3/` (el port de PS2 en WebAssembly, con la ISO de cada jugador) y entra
   aquí en un iframe. Este módulo no toca la pelea:

   - **La pelea va de marco a marco**: el marco abre su propia malla WebRTC (`bt3-marco.js` → `juegos/bt3/
     red.js`) y le pasa al juego cada paquete sin salir del iframe, para que ningún paquete espere a que la
     página de la sala esté libre. Lo único que pasa por aquí es la **presentación**: el buzón de Firebase
     (`fb.senalMalla`, `vivo/<pid>/rtc`) vive en esta página, que tiene la sesión, y el marco lo usa por
     postMessage (`senal`). Son unos veinte mensajes por pelea, que se borran al leerse; durante la pelea,
     Firebase no ve nada.
   - **Al registro va solo el vestíbulo** (`redBt3` en `motor.js`): quién es el anfitrión (lo eligen los
     jugadores), las reglas que pone el anfitrión, que cada uno ya cargó su ISO, empezar y volver.
   - El marco se recarga al volver al vestíbulo: cada pelea arranca el programa de cero, como el juego
     espera (BT3_NET_SESSION). */
const PADRE = "bt3-padre", HIJO = "bt3-hijo";
const SRC = "juegos/bt3/index.html?modo=online&v=bt3-2";
const TIEMPO_TXT = t => t ? t + " segundos" : "Sin límite";

export function crearBt3({ uid, pid, jugar, terminar, mirando }) {
  let host, frame, vest, partida = null, est = null, listo = false, muerto = false, ocupado = false, vestFirma = "";
  let senal = null, offP = null, offM = null, faseAntes = "", borrado = false, discoPedido = false;

  const enSala = () => !mirando && !!est?.jugadores?.some(j => j.uid === uid);
  const presentes = () => (est?.jugadores || []).filter(j => !est.fuera?.[j.uid]);
  const nombre = u => (est?.jugadores || []).find(j => j.uid === u)?.nombre || "Jugador";
  const soyAnfitrion = () => enSala() && est.anfitrion === uid;

  function enviar(tipo, datos = {}) {
    if (muerto || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ canal: PADRE, tipo, ...datos }, location.origin);
  }

  // Lo que el marco necesita saber de la sala. En «jugando» lleva todo lo de la pelea (rol, reglas, rival).
  function reenvia() {
    if (!listo || !est) return;
    const rival = presentes().find(j => j.uid !== uid);
    enviar("estado", {
      yo: uid, nombre: nombre(uid), mirando: !enSala(), fase: est.fase, ronda: est.ronda || 0,
      rol: est.anfitrion === uid ? "host" : "join", reglas: est.reglas,
      rival: rival ? { uid: rival.uid, nombre: rival.nombre || "Jugador" } : null,
      disco: !!est.discos?.[uid]
    });
  }

  /* ---------- el buzón, prestado al marco ----------
     Las mismas operaciones que `malla.js` le pide a su `senal` (entra, sale, alPresentes, envia,
     alMensajes), una por mensaje. Solo un jugador de la sala puede usarlo (las reglas de `vivo/<pid>/rtc`
     ya lo exigen; esto evita pedirlo en vano). */
  function senalOp(d) {
    if (!enSala()) return;
    if (!senal) senal = fb.senalMalla(pid, uid);
    if (d.op === "mensajes") {
      offM?.();
      offM = d.on ? senal.alMensajes((de, m) => enviar("senal-mensaje", { de, m })) : null;
    } else if (d.op === "presentes") {
      offP?.();
      offP = d.on ? senal.alPresentes(v => enviar("senal-presentes", { v })) : null;
    } else if (d.op === "entra") {
      senal.entra(String(d.s || "").slice(0, 16)).then(() => enviar("senal-entro", { id: d.id, ok: true }),
        () => enviar("senal-entro", { id: d.id, ok: false }));
    } else if (d.op === "sale") {
      offP?.(); offM?.(); offP = offM = null;
      senal.sale();
    } else if (d.op === "envia" && typeof d.para === "string" && d.m && typeof d.m === "object") {
      senal.envia(d.para, d.m);
    }
  }

  async function anota(j) {
    try { await jugar(j); } catch (err) { console.warn("[bt3] no se pudo anotar", j.t, err); }
  }

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "listo") { listo = true; reenvia(); return; }
    if (d.tipo === "senal") { senalOp(d); return; }
    if (partida?.fin || !enSala()) return;   // un mirón no escribe
    if (d.tipo === "disco" && est.fase === "vestibulo" && !est.discos?.[uid] && !discoPedido) {
      discoPedido = true;
      anota({ t: "disco", uid }).finally(() => { discoPedido = false; });
    } else if (d.tipo === "termino" && est.fase === "jugando") {
      anota({ t: "vuelve", uid });
    }
  }

  // ---------- el vestíbulo ----------
  async function empieza() {
    if (ocupado) return;
    ocupado = true;
    try {
      await jugar({ t: "empieza", uid });
      if (partida.estado === "esperando") await fb.setEstado(pid, "jugando");
    } catch (err) { console.warn("[bt3] no se pudo empezar", err); }
    finally { ocupado = false; }
  }

  function pintaVestibulo(forzar) {
    if (!vest || !est) return;
    const jugando = est.fase === "jugando", ver = !partida?.fin;
    vest.hidden = !ver;
    if (!ver) return;
    const js = presentes(), manda = soyAnfitrion();
    const firma = JSON.stringify([js.map(j => [j.uid, j.nombre]), est.anfitrion, est.discos, est.batalla, est.tiempo, est.fase, est.ronda, manda, enSala()]);
    if (!forzar && firma === vestFirma) return;
    vestFirma = firma;
    if (jugando) {
      vest.innerHTML = `<p class="jg-bt3-info">Pelea ${est.ronda} en curso · anfitrión <b translate="no">${escapeHtml(nombre(est.anfitrion))}</b> ·
        ${escapeHtml(BT3_BATALLAS[est.batalla] || "")} · ${TIEMPO_TXT(est.tiempo)}</p>
        ${enSala() ? `<button class="btn2 jg-bt3-vuelve" title="Si la pelea se quedó colgada">Volver al vestíbulo</button>` : ""}`;
      const v = vest.querySelector(".jg-bt3-vuelve");
      if (v) v.onclick = () => { v.disabled = true; anota({ t: "vuelve", uid }); };
      return;
    }
    const filas = js.map(j => {
      const anf = j.uid === est.anfitrion, disco = !!est.discos?.[j.uid];
      return `<li class="${j.uid === uid ? "yo" : ""}">
        <span class="jg-bt3-n" translate="no">${escapeHtml(j.nombre || "Jugador")}</span>${j.uid === uid ? " <em>(tú)</em>" : ""}
        ${anf ? '<span class="jg-bt3-anf" title="Anfitrión: jugador 1, pone las reglas">👑 Anfitrión</span>'
          : enSala() ? `<button class="btn2 jg-bt3-hacer" data-a="${escapeHtml(j.uid)}">Hacer anfitrión</button>` : ""}
        <span class="jg-bt3-disco ${disco ? "ok" : ""}">${disco ? "ISO lista" : "Eligiendo ISO…"}</span></li>`;
    }).join("");
    const listos = js.length === 2 && js.every(j => est.discos?.[j.uid]);
    const sel = (k, opciones, actual) => `<select data-k="${k}" ${manda ? "" : "disabled"}>${opciones.map(([v, t]) =>
      `<option value="${v}" ${String(v) === String(actual) ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}</select>`;
    vest.innerHTML = `
      <ul class="jg-bt3-jug">${filas}</ul>
      <div class="jg-bt3-ajustes">
        <label>Batalla ${sel("batalla", Object.entries(BT3_BATALLAS), est.batalla)}</label>
        <label>Tiempo ${sel("tiempo", BT3_TIEMPOS.map(t => [t, TIEMPO_TXT(t)]), est.tiempo)}</label>
      </div>
      <p class="jg-bt3-info">El anfitrión es el jugador 1 y pone las reglas. Cada uno necesita su propia ISO de la versión USA
        (SLUS-21678); se lee solo en su navegador. La pelea va directo entre los dos navegadores.</p>
      ${manda ? `<button class="btn jg-bt3-empieza" ${listos ? "" : "disabled"}>Empezar pelea</button>
        ${listos ? "" : `<p class="jg-bt3-info">${js.length < 2 ? "Falta el otro jugador." : "Esperando que los dos elijan su ISO."}</p>`}`
        : `<p class="jg-bt3-info">Empieza cuando lo diga <span translate="no">${escapeHtml(nombre(est.anfitrion))}</span>.</p>`}`;
    vest.querySelectorAll(".jg-bt3-hacer").forEach(b => b.onclick = () => { b.disabled = true; anota({ t: "anfitrion", uid, a: b.dataset.a }); });
    vest.querySelectorAll("select[data-k]").forEach(s => s.onchange = () =>
      anota({ t: "ajuste", uid, k: s.dataset.k, v: s.dataset.k === "tiempo" ? Number(s.value) : s.value }));
    const emp = vest.querySelector(".jg-bt3-empieza");
    if (emp) emp.onclick = () => { emp.disabled = true; empieza(); };
  }

  // Al volver de una pelea, el marco se recarga: el programa arranca de cero para la siguiente.
  function reiniciaMarco() {
    listo = false;
    if (frame) frame.src = SRC + "&r=" + Date.now();
  }

  function pantallaCompleta() {
    const pide = frame?.requestFullscreen || frame?.webkitRequestFullscreen;
    if (!pide) return false;
    try { pide.call(frame, { navigationUI: "hide" })?.then?.(() => frame.contentWindow?.focus(), () => {}); }
    catch { return false; }
    frame.contentWindow?.focus();
    return true;
  }

  function montar(el) {
    host = el; host.innerHTML = "";
    vest = document.createElement("div");
    vest.className = "jg-bt3-vest";
    vest.hidden = true;
    frame = document.createElement("iframe");
    frame.title = "Budokai Tenkaichi 3 — partida en línea";
    frame.className = "jg-yemas-marco jg-bt3-marco";
    frame.allow = "fullscreen; gamepad";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    frame.src = SRC;
    host.append(vest, frame);
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    if (faseAntes === "jugando" && est.fase === "vestibulo") reiniciaMarco();
    faseAntes = est.fase;
    pintaVestibulo();
    reenvia();
    if (est.fase === "fin" && !p.fin && enSala()) terminar(est.ganador, est.motivo);
    if (p.fin && !borrado && enSala()) {
      borrado = true;
      offP?.(); offM?.();
      fb.borraYemasVivo(pid);   // (borra `vivo/<pid>/rtc`, el buzón de esta sala)
    }
  }

  function destruir() {
    muerto = true;
    offP?.(); offM?.();
    senal?.sale();
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}
