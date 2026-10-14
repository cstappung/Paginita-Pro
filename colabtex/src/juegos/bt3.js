import * as fb from "../fb-juegos.js";
import { auth } from "../firebase.js";
import { revisaBt3 } from "./bt3-amigos.js";
import { escapeHtml } from "../util.js";
import { BT3_BATALLAS, BT3_TIEMPOS } from "./motor.js";
import { suena } from "./sonido.js";

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
const SRC = "juegos/bt3/index.html?modo=online&v=bt3-5";
const TIEMPO_TXT = t => t ? t + " segundos" : "Sin límite";

/* El disco privado (juegos/bt3/fuente/disco/): el marco del juego le pide a esta página el token de Firebase
   de quien está con la sesión iniciada, y con él le pide los pedazos de la ISO al Worker, que solo responde a
   los amigos de su lista. Vale para el marco de una sala y para el de «un jugador» del salón; solo se le da a
   un marco de esta misma página que carga juegos/bt3/. Un listener para toda la página, puesto una vez. */
/* La página del juego suelta («un jugador») también ofrece Duelo y Torneo: esos se juegan en una sala, así que
   le pide a Juegos que abra una (`{tipo:"sala", cupo}`: 2 es un duelo, más es un torneo). Quien abre la sala
   la registra `juegos-main.js` con `alPedirSalaBt3`. */
let pideSala = null;
export const alPedirSalaBt3 = fn => { pideSala = fn; };
window.addEventListener("message", async e => {
  if (e.origin !== location.origin || e.data?.canal !== "bt3-hijo" || (e.data.tipo !== "token" && e.data.tipo !== "sala")) return;
  const marco = [...document.querySelectorAll("iframe")].find(f => f.contentWindow === e.source);
  if (!marco || !/\/juegos\/bt3\/index\.html/.test(new URL(marco.src, location.href).pathname)) return;
  if (e.data.tipo === "sala") { if (pideSala) pideSala(e.data.cupo === 2 ? 2 : 8); return; }
  let token = null;
  try { token = await auth.currentUser?.getIdToken(!!e.data.nuevo); } catch (err) {}   // nuevo: el anterior venció
  e.source.postMessage({ canal: "bt3-padre", tipo: "token", token: token || null }, location.origin);
});

export function crearBt3({ uid, pid, jugar, terminar, mirando }) {
  let host, frame, vest, partida = null, est = null, listo = false, muerto = false, ocupado = false, vestFirma = "";
  let senal = null, offP = null, offM = null, faseAntes = "", borrado = false, discoPedido = false;
  let permitido = false, discoMarco = false, peleabaAntes = false;   // es de la lista de amigos (se sabe al montar): antes, nada se pinta
  let escena = null, avisos = null;

  /* ---------- lo que se celebra ----------
     Solo lo que cambia mientras se mira (no al abrir la sala): una pelea del torneo que se decide (el ganador
     brilla, el perdedor cae, el ganador entra a su casilla de la ronda siguiente), el campeón (la copa y la
     corona) y cada pelea del duelo. Cada animación guarda cuándo empezó (`recientes`): si la llave se vuelve a
     pintar a la mitad, sigue donde iba (`--edad`, un retraso negativo) en vez de partir de cero. */
  const recientes = new Map();
  let vistoLlave = null, vistoDuelo = -1, vistoFuera = null;
  const edad = (k, dur) => { const t = recientes.get(k); const e = t === undefined ? null : (Date.now() - t) / 1000; return e !== null && e < dur ? e : null; };
  const conEdad = (k, dur, clase) => { const e = edad(k, dur); return e === null ? { c: "", st: "" } : { c: " " + clase, st: ` style="--edad:${e.toFixed(2)}s"` }; };
  function anuncia(html, clase = "", ms = 3600) {
    if (!avisos) return;
    const d = document.createElement("div");
    d.className = "jg-bt3-anuncio " + clase;
    d.innerHTML = html;
    avisos.replaceChildren(d);
    setTimeout(() => d.remove(), ms);
  }

  // Juega en esta sala: está entre los jugadores y no se fue ni lo sacaron (si no, mira como cualquier espectador).
  const enSala = () => !mirando && !!est?.jugadores?.some(j => j.uid === uid) && !est?.fuera?.[uid];
  const presentes = () => (est?.jugadores || []).filter(j => !est.fuera?.[j.uid]);
  const nombre = u => (est?.jugadores || []).find(j => j.uid === u)?.nombre || "Jugador";
  const soyAnfitrion = () => enSala() && est.anfitrion === uid;
  const peleando = () => !!est && enSala() && (est.torneo
    ? !!(est.actual && est.actual.enCurso && (est.actual.a === uid || est.actual.b === uid))
    : est.fase === "jugando");
  // en esta pelea, quién es el jugador 1 (el anfitrión de la sesión) y quién el 2
  const j1 = () => est.torneo ? est.actual?.a : est.anfitrion;
  const j2 = () => est.torneo ? est.actual?.b : (presentes().find(j => j.uid !== est.anfitrion) || {}).uid;

  function enviar(tipo, datos = {}) {
    if (muerto || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ canal: PADRE, tipo, ...datos }, location.origin);
  }

  // Lo que el marco necesita saber de la sala. En «jugando» lleva todo lo de la pelea (rol, reglas, rival).
  function reenvia() {
    if (!listo || !est) return;
    // El marco solo arranca una pelea cuando ve «jugando» con un rival: en el torneo, solo los dos que pelean ahora.
    const pelea = peleando();
    const rivalUid = est.torneo ? (pelea ? (est.actual.a === uid ? est.actual.b : est.actual.a) : "") : (presentes().find(j => j.uid !== uid) || {}).uid;
    const rival = rivalUid ? presentes().find(j => j.uid === rivalUid) || { uid: rivalUid } : null;
    enviar("estado", {
      yo: uid, nombre: nombre(uid), mirando: !enSala(), torneo: !!est.torneo,
      fase: est.torneo ? (pelea ? "jugando" : "espera") : est.fase, ronda: est.torneo ? (est.actual?.n || 0) : (est.ronda || 0),
      rol: j1() === uid ? "host" : "join", reglas: est.reglas,
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
    if (d.tipo === "disco") { discoMarco = true; marcaDisco(); }
    else if (d.tipo === "resultado" && peleando() && Number.isInteger(d.bits)) {
      // El juego contó quién ganó (bits de BattleResult: 1 jugador 1, 2 jugador 2, 4 empate; 8 = se abandonó).
      const g = d.bits & 4 ? "empate" : d.bits & 1 ? j1() : d.bits & 2 ? j2() : null;
      if (!g) { if (d.bits & 8 && !est.torneo) anota({ t: "vuelve", uid }); return; }   // la pelea se abandonó: al vestíbulo
      if (est.torneo) { if (d.b === 0 && est.actual.rep?.[uid] === undefined) anota({ t: "resultado", uid, m: est.actual.id, g }); }
      else anota({ t: "resultado", uid, n: est.ronda, b: d.b, g });
    } else if (d.tipo === "termino" && !est.torneo && est.fase === "jugando") {
      anota({ t: "vuelve", uid });
    }
  }
  // El disco listo de este marco, anotado cuando hace falta (el torneo lo pide de nuevo después de cada pelea).
  function marcaDisco() {
    if (!discoMarco || discoPedido || !est || !enSala() || partida?.fin || est.discos?.[uid]) return;
    if (!est.torneo && est.fase !== "vestibulo") return;
    discoPedido = true;
    anota({ t: "disco", uid }).finally(() => { discoPedido = false; });
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
  const ESFERAS = `<span class="jg-bt3-esferas" aria-hidden="true"><i></i><i></i><i></i></span>`;
  const BATALLA_CORTA = { single: "Single", team: "Team", dp10: "DP 10", dp15: "DP 15", dp20: "DP 20" };
  const TIEMPO_CORTO = t => t ? t + " s" : "∞";
  const jugador = u => (est?.jugadores || []).find(j => j.uid === u) || { uid: u, nombre: nombre(u) };
  /* La explosión del que pierde: un fogonazo y esquirlas de la carta que salen volando (posiciones fijas, para
     que un repintado no las cambie). La `--edad` la hereda de la casilla o la carta que explota; `k` escala la
     distancia a la que vuelan. */
  const ESQUIRLAS = Array.from({ length: 14 }, (_, i) => {
    const a = i / 14 * Math.PI * 2 + (i % 3) * 0.35, d = 30 + (i * 37 % 34);
    return `<b style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d * 0.75)}px;--r:${(i * 97 % 360) - 180}deg;--s:${(0.7 + (i * 13 % 10) / 16).toFixed(2)}"></b>`;
  }).join("");
  const explota = (k = 1) => `<i class="jg-bt3-boom" aria-hidden="true" style="--k:${k}"><s></s>${ESQUIRLAS}</i>`;
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
    const brillo = conEdad("duelo:" + j.uid, 3, "brilla"), cae = conEdad("duelo-pierde:" + j.uid, 3, "revienta");
    return `<div class="jg-bt3-luchador${anf ? " anf" : ""}${yo ? " yo" : ""}${brillo.c}${cae.c}"${brillo.st || cae.st}>${cae.c ? explota(1.6) : ""}
      ${avatar(j)}
      <b translate="no">${escapeHtml(j.nombre || "Jugador")}${yo ? ' <em>(tú)</em>' : ""}</b>
      <span class="jg-bt3-rol">${anf ? "👑 Anfitrión · J1" : "J2"}</span>
      <span class="jg-bt3-estado ${disco ? "ok" : ""}">${disco ? "● Disco listo" : "○ Cargando el disco…"}</span>
      ${!anf && enSala() ? `<button class="jg-bt3-hacer" data-a="${escapeHtml(j.uid)}">Hacer anfitrión</button>`
        : '<span class="jg-bt3-hacer jg-bt3-hueco" aria-hidden="true">Hacer anfitrión</span>'}
    </div>`;
  }
  // El marcador del duelo: las peleas en que los dos juegos dijeron el mismo ganador.
  function marcadorHtml(orden) {
    const m = est.marcador || {}, total = Object.values(m).reduce((a, b) => a + b, 0) + (est.empates || 0);
    if (!total || orden.length < 2) return "";
    const n = u => `<b translate="no">${escapeHtml(nombre(u))}</b>`;
    return `<p class="jg-bt3-marcador" aria-label="Marcador">${n(orden[0].uid)} <span>${m[orden[0].uid] || 0} – ${m[orden[1].uid] || 0}</span> ${n(orden[1].uid)}
      ${est.empates ? `<small>${est.empates} empate${est.empates > 1 ? "s" : ""}</small>` : ""}</p>`;
  }

  function pintaVestibulo(forzar) {
    if (!vest || !est || !permitido) return;
    if (est.torneo) return pintaTorneo(forzar);
    const jugando = est.fase === "jugando", ver = !partida?.fin;
    vest.hidden = !ver;
    if (!ver) return;
    const js = presentes(), manda = soyAnfitrion();
    // una pelea nueva en el marcador: quién ganó, con su sonido
    const peleas = Object.values(est.marcador || {}).reduce((x, y) => x + y, 0) + (est.empates || 0);
    if (vistoDuelo >= 0 && peleas > vistoDuelo) {
      const g = [...(est.hist || [])].reverse().find(h => h.e === "resultado")?.g;
      recientes.set("duelo", Date.now());
      if (g === "empate") { suena("kiCae"); anuncia(`<small>Pelea ${est.ronda}</small><b>¡Empate!</b>`, "empate"); }
      else if (g) {
        const p = (est.jugadores || []).find(j => j.uid !== g && !est.fuera?.[j.uid])?.uid;
        suena(g === uid || !enSala() ? "kiAvanza" : "kiCae");
        setTimeout(() => suena("kiBoom"), 300);
        anuncia((p ? caras(g, p) : "") + `<small>Pelea ${est.ronda}</small><b translate="no">¡Gana ${escapeHtml(nombre(g))}!</b>`, g === uid ? "gana" : enSala() ? "pierde" : "gana", 4200);
        recientes.set("duelo:" + g, Date.now());
        if (p) recientes.set("duelo-pierde:" + p, Date.now());
      }
    }
    vistoDuelo = peleas;
    const firma = JSON.stringify([js.map(j => [j.uid, j.nombre, j.foto]), est.anfitrion, est.discos, est.batalla, est.tiempo, est.fase, est.ronda, manda, enSala(), est.marcador, est.empates, est.revancha]);
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
    // la revancha: después de una pelea, los dos la piden y empieza sola en cuanto cargan los dos discos
    const rev = est.revancha || {}, otro = js.find(j => j.uid !== uid);
    let revancha = "";
    if (est.ronda > 0 && js.length === 2 && enSala()) {
      const yoSi = !!rev[uid], elSi = !!(otro && rev[otro.uid]);
      revancha = `<div class="jg-bt3-revancha${yoSi && elSi ? " lista" : ""}">
        ${yoSi ? `<button class="jg-bt3-rev no" data-no="1">Cancelar revancha</button>` : `<button class="jg-bt3-rev">🔁 ${elSi ? "¡Acepto la revancha!" : "Pedir revancha"}</button>`}
        <span class="jg-bt3-nota" role="status">${yoSi && elSi ? "¡Revancha! Empieza sola apenas carguen los dos discos."
          : yoSi ? "Esperando que " + `<b translate="no">${escapeHtml(otro.nombre || "tu rival")}</b>` + " acepte…"
          : elSi ? `<b translate="no">${escapeHtml(otro.nombre || "Tu rival")}</b> quiere la revancha.` : "Las mismas reglas, sin volver a configurar: tienen que confirmar los dos."}</span></div>`;
    }
    vest.innerHTML = `
      <header class="jg-bt3-tit"><b>Duelo</b>${ESFERAS}<span>${est.ronda ? "Pelea " + (est.ronda + 1) : "1 contra 1"} · el anfitrión pone las reglas</span></header>
      <div class="jg-bt3-versus">${tarjeta(orden[0])}<span class="jg-bt3-vs" aria-hidden="true">VS</span>${tarjeta(orden[1])}</div>
      ${marcadorHtml(orden)}
      ${revancha}
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
    const rb = vest.querySelector(".jg-bt3-rev");
    if (rb) rb.onclick = () => { rb.disabled = true; anota(rb.dataset.no ? { t: "revancha", uid, no: true } : { t: "revancha", uid }); };
  }

  /* ---------- el torneo ----------
     Antes de empezar: quiénes están (con su disco), las reglas y «Empezar torneo» del organizador. Después: la
     llave por rondas, la pelea actual destacada y lo que toca hacer en ella (arrancarla, o confirmar a mano si el
     juego no lo contó solo, o que el organizador decida si los dos no coinciden). */
  const NOMBRE_RONDA = (r, total) => ["Final", "Semifinal", "Cuartos", "Octavos"][total - 1 - r] || "Ronda " + (r + 1);
  const nomb = u => u === "" ? "—" : u === undefined ? "Por definir" : nombre(u);
  // Una pelea del torneo recién decidida: su animación, su sonido y el cartel de arriba.
  /* El cartel de una pelea: el ganador con su aura y, al lado, el que pierde, que revienta en pedazos. */
  const caras = (g, p) => `<div class="jg-bt3-caras"><span class="g">${avatar(jugador(g))}</span><span class="vs" aria-hidden="true">VS</span>
    <span class="p">${avatar(jugador(p))}${explota(1.7)}</span></div>`;
  function celebra(m, total, sinCartel = false) {
    recientes.set(m.id, Date.now());
    if (sinCartel && m.r !== total - 1) return;   // la casilla igual revienta en la llave
    const pierde = m.g === m.a ? m.b : m.a, n = u => `<b translate="no">${escapeHtml(nombre(u))}</b>`;
    setTimeout(() => suena("kiBoom"), 300);   // la carta del que pierde revienta
    if (m.r === total - 1) {   // la final: el campeón
      recientes.set("copa", Date.now());
      suena("kiCorona");
      anuncia(`<div class="jg-bt3-coronado"><i class="jg-bt3-rayos" aria-hidden="true"></i><span class="jg-bt3-anuncio-corona" aria-hidden="true">👑</span>${avatar(jugador(m.g))}</div>
        <small>Campeón del torneo</small>${n(m.g)}`, "campeon", 6500);
    } else {
      suena(pierde === uid ? "kiCae" : "kiAvanza");
      anuncia(caras(m.g, pierde) + (pierde === uid ? `<small>Quedaste fuera</small><b>Ganó ${n(m.g)}</b>`
        : `<small>${m.g === uid ? "¡Ganaste!" : "Pasa a la siguiente ronda"}</small>${n(m.g)} <span>avanza a ${NOMBRE_RONDA(m.r + 1, total).toLowerCase()}</span>`),
        pierde === uid ? "pierde" : "gana", 4200);
    }
  }
  function pintaTorneo(forzar) {
    const js = presentes(), manda = soyAnfitrion(), a = est.actual;
    vest.hidden = false;   // la llave se queda a la vista también al final, debajo del cartel
    // quien sale del torneo (sacado por el organizador o porque se fue): su foto revienta en el cartel
    const fueraAhora = Object.keys(est.fuera || {});
    if (vistoFuera) for (const u of fueraAhora) if (!vistoFuera.includes(u) && !document.hidden) {
      const echado = (est.hist || []).some(h => h.e === "echado" && h.uid === u);
      setTimeout(() => suena("kiBoom"), 250);
      anuncia(`<div class="jg-bt3-caras"><span class="p">${avatar(jugador(u))}${explota(1.7)}</span></div>
        <small>${echado ? (u === uid ? "El organizador te sacó del torneo" : "Expulsado por el organizador") : "Se fue del torneo"}</small>
        <b translate="no">${escapeHtml(nombre(u))}</b>`, "pierde", 4200);
    }
    const nuevosFuera = new Set(vistoFuera ? fueraAhora.filter(u => !vistoFuera.includes(u)) : []);   // (su pelea la perdieron por irse: ya tienen su cartel)
    vistoFuera = fueraAhora;
    if (est.llave) {   // peleas decididas desde la última vez: se celebran (no al abrir la sala)
      const ahora = {};
      est.llave.forEach((ronda, r) => ronda.forEach(m => { if (m.g !== undefined) ahora[m.id] = m; }));
      if (vistoLlave) for (const [id, m] of Object.entries(ahora)) if (!(id in vistoLlave) && m.g && m.a && m.b) celebra(m, est.llave.length, nuevosFuera.has(m.g === m.a ? m.b : m.a));
      vistoLlave = ahora;
    }
    const firma = JSON.stringify(["t", js.map(j => [j.uid, j.nombre, j.foto]), est.anfitrion, est.discos, est.batalla, est.tiempo, est.fase, est.llave, a, manda, enSala(), est.cupo]);
    if (!forzar && firma === vestFirma) return;
    vestFirma = firma;
    vest.classList.remove("jugando");
    const fichas = (k, opciones, actual) => opciones.map(([v, txt]) =>
      `<button class="jg-bt3-ficha" data-k="${k}" data-v="${v}" aria-pressed="${String(v) === String(actual)}" ${manda && !est.llave ? "" : "disabled"}>${escapeHtml(txt)}</button>`).join("");
    const reglas = `<div class="jg-bt3-reglas" role="group" aria-label="Reglas de las peleas">
        <div><span class="jg-bt3-et">Batalla</span><div class="jg-bt3-fichas">${fichas("batalla", Object.entries(BATALLA_CORTA), est.batalla)}</div></div>
        <div><span class="jg-bt3-et">Tiempo por round</span><div class="jg-bt3-fichas">${fichas("tiempo", BT3_TIEMPOS.map(x => [x, TIEMPO_CORTO(x)]), est.tiempo)}</div></div>
        ${est.llave ? `<p class="jg-bt3-nota">Las mismas reglas en todas las peleas del torneo.</p>` : manda ? "" : `<p class="jg-bt3-nota">Las reglas las pone el organizador.</p>`}
      </div>`;
    if (!est.llave) {   // antes de empezar
      const fila = j => `<li class="${j.uid === uid ? "yo" : ""}">${avatar(j)}<span translate="no">${escapeHtml(j.nombre || "Jugador")}</span>
        ${manda && j.uid !== uid ? `<button class="jg-bt3-echa" data-echa="${escapeHtml(j.uid)}" title="Sacar del torneo" aria-label="Sacar a ${escapeHtml(j.nombre || "Jugador")} del torneo">⏏</button>` : ""}
        ${j.uid === est.anfitrion ? '<em class="jg-bt3-org">👑 Organiza</em>' : ""}
        <i class="jg-bt3-estado ${est.discos?.[j.uid] ? "ok" : ""}">${est.discos?.[j.uid] ? "● Disco listo" : "○ Cargando…"}</i></li>`;
      const puede = js.length >= 3;
      vest.innerHTML = `
        <header class="jg-bt3-tit"><b>Torneo</b>${ESFERAS}<span>${js.length} inscrito${js.length === 1 ? "" : "s"} · eliminación directa</span></header>
        <ul class="jg-bt3-inscritos">${js.map(fila).join("")}</ul>
        ${reglas}
        <div class="jg-bt3-pie">
          ${manda ? `<button class="jg-bt3-empieza" data-h="torneo" ${puede ? "" : "disabled"}>¡Empezar torneo!</button>` : ""}
          <p class="jg-bt3-nota" role="status">${puede ? (manda ? "Al empezar se sortea la llave entre los que están." : "Empieza cuando lo diga " + escapeHtml(nombre(est.anfitrion)) + ".")
            : "Hacen falta al menos 3 para un torneo: pásales el enlace de la sala."}</p>
        </div>`;
    } else {
      const total = est.llave.length;
      /* La llave como pirámide: una columna por ronda, cada pelea centrada entre las dos que la alimentan (cada
         <li> ocupa el doble de alto que los de la ronda anterior) y unidas por líneas (CSS, ::before/::after).
         Al final, la copa con el campeón. */
      const caja = m => {
        const cls = m.g !== undefined ? "listo" : a && a.id === m.id ? (a.enCurso ? "vivo" : "sigue") : "";
        const decidida = conEdad(m.id, 3, "recien");
        // la casilla de esta pelea a la que llegó alguien recién: el ganador de la pelea de la ronda anterior entra
        const llega = k => m.r > 0 ? conEdad(est.llave[m.r - 1][2 * m.k + k].id, 3, "llega") : { c: "", st: "" };
        const fila = (u, k) => {
          const l = llega(k), res = m.g !== undefined && u ? (m.g === u ? "gana" : "pierde") : u === undefined ? "vacio" : "";
          const cara = u ? avatar(jugador(u)) : '<span class="jg-bt3-ava vacia" aria-hidden="true">?</span>';
          return `<span class="jg-bt3-slot ${res}${decidida.c}${l.c}"${decidida.st || l.st}>${cara}<span class="jg-bt3-nom" translate="no">${escapeHtml(nomb(u))}</span>${res === "pierde" && decidida.c ? explota() : ""}</span>`;
        };
        return `<li class="jg-bt3-par${m.g ? " listo" : ""}${m.r > 0 && m.a && m.b ? " lleno" : ""}${decidida.c}"${decidida.st}><div class="jg-bt3-caja ${cls}">${fila(m.a, 0)}${m.b === "" ? '<span class="jg-bt3-slot bye">pasa directo</span>' : fila(m.b, 1)}
          ${cls === "vivo" ? "<em>EN PELEA</em>" : cls === "sigue" ? "<em>SIGUIENTE</em>" : ""}</div></li>`;
      };
      const campeon = est.llave[total - 1][0].g, corona = conEdad("copa", 7, "corona");
      const llave = est.llave.map((ronda, r) => `<section class="jg-bt3-ronda${r === total - 1 ? " final" : ""}"><h4>${NOMBRE_RONDA(r, total)}</h4><ol>${ronda.map(caja).join("")}</ol></section>`).join("")
        + `<section class="jg-bt3-ronda copa"><h4>Campeón</h4><ol><li class="jg-bt3-par${campeon ? " listo" : ""}"><div class="jg-bt3-copa${campeon ? " gana" : ""}${corona.c}"${corona.st}>
            <i class="jg-bt3-rayos" aria-hidden="true"></i>${campeon
              ? `<span class="jg-bt3-campeon"><span class="jg-bt3-corona" aria-hidden="true">👑</span>${avatar(jugador(campeon))}<span class="jg-bt3-trofeo" aria-hidden="true">🏆</span></span>`
              : '<span class="jg-bt3-trofeo" aria-hidden="true">🏆</span>'}
            <b translate="no">${campeon ? escapeHtml(nombre(campeon)) : "Por definir"}</b></div></li></ol></section>`;
      let panel = "";
      if (a) {
        const yoPeleo = a.a === uid || a.b === uid, listos = est.discos?.[a.a] && est.discos?.[a.b];
        const quien = u => `<b translate="no">${escapeHtml(nombre(u))}</b>`;
        const marca = (g, txt) => `<button class="jg-bt3-ficha" data-g="${escapeHtml(g)}">${txt}</button>`;
        let cuerpo;
        if (!a.enCurso) {
          cuerpo = (listos
            ? (yoPeleo || manda ? `<button class="jg-bt3-empieza" data-h="pelea">¡A pelear!</button>` : `<p class="jg-bt3-nota">Listos los dos: empieza cuando uno de ellos quiera.</p>`)
            : `<p class="jg-bt3-nota">Esperando el disco de ${[a.a, a.b].filter(u => !est.discos?.[u]).map(quien).join(" y ")}.</p>`)
            + (manda ? `<details class="jg-bt3-mano"><summary>Organizador: decidir sin pelear (alguien no está)</summary>
              <div class="jg-bt3-fichas" data-accion="decide">${marca(a.a, "Pasa " + escapeHtml(nombre(a.a)))}${marca(a.b, "Pasa " + escapeHtml(nombre(a.b)))}</div></details>` : "");
        } else if (a.conflicto) {
          cuerpo = `<p class="jg-bt3-nota">Los dos juegos no dijeron el mismo ganador. ${manda ? "Decide tú:" : "Decide " + quien(est.anfitrion) + "."}</p>
            ${manda ? `<div class="jg-bt3-fichas" data-accion="decide">${marca(a.a, "Ganó " + escapeHtml(nombre(a.a)))}${marca(a.b, "Ganó " + escapeHtml(nombre(a.b)))}${marca("empate", "Repetir")}</div>` : ""}`;
        } else {
          const ya = a.rep?.[uid];
          cuerpo = `<p class="jg-bt3-nota"><span class="jg-bt3-vivo">● En pelea</span> El resultado se anota solo al terminar.</p>
            ${yoPeleo && ya === undefined ? `<details class="jg-bt3-mano"><summary>¿No se anotó solo? Márcalo a mano</summary>
              <div class="jg-bt3-fichas" data-accion="resultado">${marca(a.a, "Ganó " + escapeHtml(nombre(a.a)))}${marca(a.b, "Ganó " + escapeHtml(nombre(a.b)))}${marca("empate", "Empate")}</div></details>` : ""}
            ${manda && !yoPeleo ? `<details class="jg-bt3-mano"><summary>Organizador: decidir esta pelea</summary>
              <div class="jg-bt3-fichas" data-accion="decide">${marca(a.a, "Ganó " + escapeHtml(nombre(a.a)))}${marca(a.b, "Ganó " + escapeHtml(nombre(a.b)))}</div></details>` : ""}`;
        }
        panel = `<div class="jg-bt3-actual">
          <div class="jg-bt3-mini">${quien(a.a)}<span class="jg-bt3-vs">VS</span>${quien(a.b)}</div>
          <p class="jg-bt3-nota">${NOMBRE_RONDA(+a.id.split(".")[0], total)} · ${escapeHtml(BT3_BATALLAS[est.batalla] || "")} · ${TIEMPO_TXT(est.tiempo)}${yoPeleo ? " · <b>¡te toca!</b>" : ""}</p>
          ${cuerpo}</div>`;
      }
      vest.innerHTML = `<header class="jg-bt3-tit"><b>Torneo</b>${ESFERAS}<span>${est.llave[0].flatMap(m => [m.a, m.b]).filter(Boolean).length} peleadores · organiza <b translate="no">${escapeHtml(nombre(est.anfitrion))}</b></span></header>
        ${panel}<div class="jg-bt3-llave">${llave}</div>
        ${manda && js.length > 1 ? `<details class="jg-bt3-mano jg-bt3-echar"><summary>Organizador: sacar a un jugador del torneo</summary>
          <div class="jg-bt3-fichas">${js.filter(j => j.uid !== uid).map(j => `<button class="jg-bt3-ficha" data-echa="${escapeHtml(j.uid)}">⏏ <span translate="no">${escapeHtml(j.nombre || "Jugador")}</span></button>`).join("")}</div>
          <p class="jg-bt3-nota">Pierde sus peleas (la que esté en curso y las que le tocaban) y queda mirando.</p></details>` : ""}`;
    }
    vest.querySelectorAll(".jg-bt3-ficha[data-k]").forEach(b => b.onclick = () => {
      if (b.getAttribute("aria-pressed") === "true") return;
      anota({ t: "ajuste", uid, k: b.dataset.k, v: b.dataset.k === "tiempo" ? Number(b.dataset.v) : b.dataset.v });
    });
    vest.querySelectorAll("[data-echa]").forEach(b => b.onclick = () => {
      if (!confirm("¿Sacar a " + nombre(b.dataset.echa) + " del torneo? Pierde sus peleas y no puede volver a entrar.")) return;
      b.disabled = true;
      anota({ t: "echa", uid, a: b.dataset.echa });
    });
    vest.querySelectorAll("[data-accion] .jg-bt3-ficha").forEach(b => b.onclick = () => {
      b.disabled = true;
      const accion = b.closest("[data-accion]").dataset.accion;
      anota({ t: accion, uid, m: est.actual.id, g: b.dataset.g });
    });
    const emp = vest.querySelector(".jg-bt3-empieza");
    if (emp) emp.onclick = async () => {
      emp.disabled = true;
      if (emp.dataset.h === "torneo") {
        await anota({ t: "torneo", uid });
        if (partida.estado === "esperando") fb.setEstado(pid, "jugando").catch(() => {});   // cierra la puerta: ya no entra nadie
      } else anota({ t: "empieza", uid, m: est.actual.id });
    };
  }

  // Al volver de una pelea, el marco se recarga: el programa arranca de cero para la siguiente.
  function reiniciaMarco() {
    listo = false; discoMarco = false;
    // si la pelea estaba en pantalla completa, se sale: se vuelve a ver la sala (la llave o el vestíbulo)
    try { if (document.fullscreenElement && document.fullscreenElement === frame) document.exitFullscreen().catch(() => {}); } catch (e) {}
    if (frame && enSala()) frame.src = SRC + "&r=" + Date.now();
  }

  /* El marco del juego es solo para quien juega: un espectador (o alguien que se fue o sacaron) ve la sala —el
     vestíbulo, la llave, los carteles— sin bajar ni arrancar el juego. La pelea en sí se ve solo en las
     pantallas de los dos peleadores: el juego no tiene modo espectador. */
  function cargaMarco() {
    if (!frame || !permitido) return;
    frame.hidden = !enSala();
    if (enSala() && !frame.getAttribute("src")) frame.src = SRC;
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
    escena = document.createElement("div");
    escena.className = "jg-bt3-escena";
    vest = document.createElement("div");
    vest.className = "jg-bt3-vest";
    vest.hidden = true;
    avisos = document.createElement("div");
    avisos.className = "jg-bt3-avisos";
    avisos.setAttribute("aria-live", "polite");
    escena.append(vest, avisos);
    frame = document.createElement("iframe");
    frame.title = "Budokai Tenkaichi 3 — partida en línea";
    frame.className = "jg-yemas-marco jg-bt3-marco";
    frame.allow = "fullscreen; gamepad";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    host.append(escena, frame);
    /* Solo los amigos de la lista del disco privado (bt3-amigos.js): a cualquier otro, ni el vestíbulo ni el
       juego, aunque haya llegado con el enlace de la sala. */
    revisaBt3().then(ok => {
      if (muerto) return;
      if (ok) { permitido = true; cargaMarco(); pintaVestibulo(true); return; }
      escena.remove(); frame.remove(); vest = frame = escena = avisos = null;
      host.innerHTML = '<p class="jg-bt3-info jg-bt3-privado">Esta sala es privada.</p>';
    });
  }

  /* ---------- el comienzo de cada pelea ----------
     Como la presentación de un juego de pelea: las dos fotos entran por los lados, chocan con un destello y sale
     «¡A PELEAR!», con su sonido (`kiPelea`). Va encima de todo (fijo a la pantalla), porque en ese momento la
     sala ya muestra el marco del juego. Solo para lo que empieza mientras se mira: `vistoInicio` es null hasta
     el primer estado. El comienzo del torneo suena con un gong (`kiTorneo`). */
  let vistoInicio = null;
  function presentaPelea(a, b, detalle) {
    if (document.hidden) return;
    suena("kiPelea");
    const lado = (u, c) => { const j = jugador(u); return `<div class="${c}">${avatar(j)}<b translate="no">${escapeHtml(j.nombre || "Jugador")}</b></div>`; };
    const capa = document.createElement("div");
    capa.className = "jg-bt3-choque";
    capa.setAttribute("aria-hidden", "true");
    capa.innerHTML = `<i class="jg-bt3-rayos"></i>${lado(a, "l")}${lado(b, "r")}<i class="jg-bt3-destello"></i>
      <strong>¡A PELEAR!</strong><small>${escapeHtml(detalle)}</small>`;
    document.body.append(capa);
    setTimeout(() => capa.remove(), 2700);
  }
  function detectaInicio() {
    const llave = !!est.llave, pelea = est.torneo
      ? (est.actual && est.actual.enCurso ? "t" + est.actual.n : "")
      : (est.fase === "jugando" ? "d" + est.ronda : "");
    const antes = vistoInicio;
    vistoInicio = { llave, pelea };
    if (!antes || partida?.fin) return;
    if (llave && !antes.llave && !document.hidden) {
      suena("kiTorneo");
      anuncia(`<small>Torneo · ${est.llave[0].flatMap(m => [m.a, m.b]).filter(Boolean).length} peleadores</small><b>¡Comienza el torneo!</b>`, "gana", 3200);
    }
    if (pelea && pelea !== antes.pelea) {
      const reglas = (BT3_BATALLAS[est.batalla] || "") + " · " + TIEMPO_TXT(est.tiempo);
      if (est.torneo) presentaPelea(est.actual.a, est.actual.b, NOMBRE_RONDA(+est.actual.id.split(".")[0], est.llave.length) + " · " + reglas);
      else {
        const otro = presentes().find(j => j.uid !== est.anfitrion)?.uid;
        if (otro) presentaPelea(est.anfitrion, otro, "Pelea " + est.ronda + " · " + reglas);
      }
    }
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    cargaMarco();
    detectaInicio();
    // Al terminar mi pelea, mi marco se recarga: la siguiente arranca el programa de cero.
    const pelea = peleando();
    if (peleabaAntes && !pelea && !p.fin) reiniciaMarco();
    peleabaAntes = pelea;
    faseAntes = est.fase;
    marcaDisco();
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
