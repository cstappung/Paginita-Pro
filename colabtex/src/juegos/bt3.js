import * as fb from "../fb-juegos.js";
import { auth } from "../firebase.js";
import { revisaBt3 } from "./bt3-amigos.js";
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
const SRC = "juegos/bt3/index.html?modo=online&v=bt3-3";
const TIEMPO_TXT = t => t ? t + " segundos" : "Sin límite";

/* El disco privado (juegos/bt3/fuente/disco/): el marco del juego le pide a esta página el token de Firebase
   de quien está con la sesión iniciada, y con él le pide los pedazos de la ISO al Worker, que solo responde a
   los amigos de su lista. Vale para el marco de una sala y para el de «un jugador» del salón; solo se le da a
   un marco de esta misma página que carga juegos/bt3/. Un listener para toda la página, puesto una vez. */
window.addEventListener("message", async e => {
  if (e.origin !== location.origin || e.data?.canal !== "bt3-hijo" || e.data.tipo !== "token") return;
  const marco = [...document.querySelectorAll("iframe")].find(f => f.contentWindow === e.source);
  if (!marco || !/\/juegos\/bt3\/index\.html/.test(new URL(marco.src, location.href).pathname)) return;
  let token = null;
  try { token = await auth.currentUser?.getIdToken(!!e.data.nuevo); } catch (err) {}   // nuevo: el anterior venció
  e.source.postMessage({ canal: "bt3-padre", tipo: "token", token: token || null }, location.origin);
});

export function crearBt3({ uid, pid, jugar, terminar, mirando }) {
  let host, frame, vest, partida = null, est = null, listo = false, muerto = false, ocupado = false, vestFirma = "";
  let senal = null, offP = null, offM = null, faseAntes = "", borrado = false, discoPedido = false;
  let permitido = false;   // es de la lista de amigos (se sabe al montar): antes, nada se pinta

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

  /* El vestíbulo, como la pantalla de versus de un juego de pelea: los dos frente a frente (foto, quién es el
     anfitrión, si su disco ya cargó), las reglas como botones que solo el anfitrión aprieta, y el botón grande
     para empezar. En plena pelea queda una franja con lo que se está jugando. */
  const BATALLA_CORTA = { single: "Single", team: "Team", dp10: "DP 10", dp15: "DP 15", dp20: "DP 20" };
  const TIEMPO_CORTO = t => t ? t + " s" : "∞";
  function avatar(j) {
    const foto = typeof j.foto === "string" && /^(data:image\/|https:\/\/)/.test(j.foto) ? j.foto : "";
    const color = typeof j.color === "string" && /^#[0-9a-f]{3,8}$/i.test(j.color) ? j.color : "#f28c1e";
    return foto ? `<img class="jg-bt3-ava" src="${escapeHtml(foto)}" alt="">`
      : `<span class="jg-bt3-ava" style="--c:${color}" aria-hidden="true">${escapeHtml((j.nombre || "?").trim().charAt(0).toUpperCase() || "?")}</span>`;
  }
  function tarjeta(j) {
    if (!j) return `<div class="jg-bt3-luchador vacio"><span class="jg-bt3-ava" aria-hidden="true">?</span>
      <b>Esperando rival</b><span class="jg-bt3-rol">J2</span><span class="jg-bt3-estado">Pásale el enlace de la sala</span>
      <span class="jg-bt3-hacer jg-bt3-hueco" aria-hidden="true">Hacer anfitrión</span></div>`;
    const anf = j.uid === est.anfitrion, disco = !!est.discos?.[j.uid], yo = j.uid === uid;
    return `<div class="jg-bt3-luchador${anf ? " anf" : ""}${yo ? " yo" : ""}">
      ${avatar(j)}
      <b translate="no">${escapeHtml(j.nombre || "Jugador")}${yo ? ' <em>(tú)</em>' : ""}</b>
      <span class="jg-bt3-rol">${anf ? "👑 Anfitrión · J1" : "J2"}</span>
      <span class="jg-bt3-estado ${disco ? "ok" : ""}">${disco ? "● Disco listo" : "○ Cargando el disco…"}</span>
      ${!anf && enSala() ? `<button class="jg-bt3-hacer" data-a="${escapeHtml(j.uid)}">Hacer anfitrión</button>`
        : '<span class="jg-bt3-hacer jg-bt3-hueco" aria-hidden="true">Hacer anfitrión</span>'}
    </div>`;
  }
  function pintaVestibulo(forzar) {
    if (!vest || !est || !permitido) return;
    const jugando = est.fase === "jugando", ver = !partida?.fin;
    vest.hidden = !ver;
    if (!ver) return;
    const js = presentes(), manda = soyAnfitrion();
    const firma = JSON.stringify([js.map(j => [j.uid, j.nombre, j.foto]), est.anfitrion, est.discos, est.batalla, est.tiempo, est.fase, est.ronda, manda, enSala()]);
    if (!forzar && firma === vestFirma) return;
    vestFirma = firma;
    vest.classList.toggle("jugando", jugando);
    if (jugando) {
      vest.innerHTML = `<div class="jg-bt3-franja"><span class="jg-bt3-vivo">● En pelea</span>
        <span>Pelea ${est.ronda} · ${escapeHtml(BT3_BATALLAS[est.batalla] || "")} · ${TIEMPO_TXT(est.tiempo)} · anfitrión <b translate="no">${escapeHtml(nombre(est.anfitrion))}</b></span>
        ${enSala() ? `<button class="jg-bt3-vuelve" title="Si la pelea se quedó colgada, vuelven los dos al vestíbulo">Volver al vestíbulo</button>` : ""}</div>`;
      const v = vest.querySelector(".jg-bt3-vuelve");
      if (v) v.onclick = () => { v.disabled = true; anota({ t: "vuelve", uid }); };
      return;
    }
    // el anfitrión a la izquierda, como el jugador 1 en la pantalla del juego
    const orden = [...js].sort((a, b) => (b.uid === est.anfitrion) - (a.uid === est.anfitrion));
    const listos = js.length === 2 && js.every(j => est.discos?.[j.uid]);
    const fichas = (k, opciones, actual) => opciones.map(([v, txt]) =>
      `<button class="jg-bt3-ficha" data-k="${k}" data-v="${v}" aria-pressed="${String(v) === String(actual)}" ${manda ? "" : "disabled"}>${escapeHtml(txt)}</button>`).join("");
    const falta = js.length < 2 ? "Falta el otro jugador: pásale el enlace de la sala."
      : !listos ? "Esperando el disco de " + js.filter(j => !est.discos?.[j.uid]).map(j => j.nombre || "Jugador").join(" y ") + "."
      : manda ? "Todo listo." : "Todo listo: empieza " + nombre(est.anfitrion) + ".";
    vest.innerHTML = `
      <div class="jg-bt3-versus">${tarjeta(orden[0])}<span class="jg-bt3-vs" aria-hidden="true">VS</span>${tarjeta(orden[1])}</div>
      <div class="jg-bt3-reglas" role="group" aria-label="Reglas de la pelea">
        <div><span class="jg-bt3-et">Batalla</span><div class="jg-bt3-fichas">${fichas("batalla", Object.entries(BATALLA_CORTA), est.batalla)}</div></div>
        <div><span class="jg-bt3-et">Tiempo por round</span><div class="jg-bt3-fichas">${fichas("tiempo", BT3_TIEMPOS.map(t => [t, TIEMPO_CORTO(t)]), est.tiempo)}</div></div>
        ${manda ? "" : `<p class="jg-bt3-nota">Las reglas las pone el anfitrión.</p>`}
      </div>
      <div class="jg-bt3-pie">
        ${manda ? `<button class="jg-bt3-empieza" ${listos ? "" : "disabled"}>¡A pelear!</button>` : ""}
        <p class="jg-bt3-nota" role="status">${escapeHtml(falta)}</p>
      </div>`;
    vest.querySelectorAll(".jg-bt3-hacer").forEach(b => b.onclick = () => { b.disabled = true; anota({ t: "anfitrion", uid, a: b.dataset.a }); });
    vest.querySelectorAll(".jg-bt3-ficha").forEach(b => b.onclick = () => {
      if (b.getAttribute("aria-pressed") === "true") return;
      anota({ t: "ajuste", uid, k: b.dataset.k, v: b.dataset.k === "tiempo" ? Number(b.dataset.v) : b.dataset.v });
    });
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
    host.append(vest, frame);
    /* Solo los amigos de la lista del disco privado (bt3-amigos.js): a cualquier otro, ni el vestíbulo ni el
       juego, aunque haya llegado con el enlace de la sala. */
    revisaBt3().then(ok => {
      if (muerto) return;
      if (ok) { permitido = true; frame.src = SRC; pintaVestibulo(true); return; }
      vest.remove(); frame.remove(); vest = frame = null;
      host.innerHTML = '<p class="jg-bt3-info jg-bt3-privado">Esta sala es privada.</p>';
    });
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
