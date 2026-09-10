"use strict";
/* ============================================================
   Juegos — la página

   Quinta página del sitio. Misma cuenta de Google y misma base que
   ColabTeX, ColabDraw e Informes, así que no hay nada que configurar:
   quien ya entra en el editor, ya puede jugar.

   Este archivo no sabe jugar a nada. Es el vestíbulo, la sesión y el
   cartero: elige el módulo que toca, le pasa la partida ya reducida y
   le presta dos funciones —`jugar` y `terminar`— para escribir en la
   base. Las reglas de los tres juegos viven enteras en `juegos/motor.js`,
   y lo que se ve, en su módulo. Tres decisiones que sí son de aquí:

   1. **El número de jugada lo lleva la página, y reintenta.** El
      registro es un apéndice y la regla de la base exige que la casilla
      esté vacía, así que cuando los dos escriben la jugada 4 a la vez
      uno de los dos aborta. Aquí eso no es un error: se sube al 5 y se
      vuelve a intentar. Sin este bucle, la primera vez que dos personas
      pulsan a la vez uno se queda sin jugada y sin saber por qué.
   2. **Una partida tiene enlace propio** (`#p/<pid>`). Un juego de dos
      empieza casi siempre por «pásame el enlace», y buscarse en una
      lista de salas es un rodeo que nadie quiere dar. El vestíbulo
      sigue estando para quien no tiene a quién escribirle.
   3. **La clasificación la apunta cada uno de su partida.** Al ver el
      `fin` escrito, cada navegador lee su propia fila, le suma la
      partida y la vuelve a guardar — nunca la del otro, que es lo único
      que las reglas dejan hacer sin un servidor. `acumula` se niega a
      contar dos veces la misma partida, así que recargar la página con
      la partida terminada no infla el marcador.
   ============================================================ */
import { watchAuth, loginGoogle, logout } from "./firebase.js";
import * as fb from "./fb-juegos.js";
import { escapeHtml, timeAgo, colorForUid } from "./util.js";
import { JUEGOS, reducir, jugadasDe, acumula } from "./juegos/motor.js";
import { crearEscondite } from "./juegos/escondite.js";
import { crearCartas } from "./juegos/cartas.js";
import { crearCuadritos } from "./juegos/cuadritos.js";
import { crearRanks } from "./juegos/ranks.js";
import { createReportWidget } from "./report-widget.js";

const $ = id => document.getElementById(id);
const VER = (document.currentScript && document.currentScript.src.split("?v=")[1]) || "";

const FABRICAS = { escondite: crearEscondite, cartas: crearCartas, cuadritos: crearCuadritos };

const ICONO = { escondite: "🔍", cartas: "🔥", cuadritos: "▦" };

const state = {
  user: null,
  vista: "vestibulo",     // vestibulo | partida | ranks
  pid: "",
  partida: null,
  estado: null,
  salas: [],
  mias: [],
  fallo: null,            // por qué no se puede leer (reglas sin publicar, casi siempre)
  cargando: false
};

let offSalas = null, offMias = null, offPartida = null, offReloj = null;
let cancelarLimpieza = null;
let modulo = null, pidMontado = "";
let vistaPintada = "";
let ranks = null;
let proximo = 0;          // el número de jugada que toca escribir
let anotada = "";         // partida ya sumada a la clasificación desde esta pestaña
let finEnviado = "";

/* ---------- sesión ---------- */
function pintaUsuario() {
  const u = state.user;
  $("userName").textContent = u ? u.name : "";
  const av = $("userAvatar");
  if (!u) { av.textContent = ""; return; }
  if (u.photo) av.innerHTML = `<img src="${escapeHtml(u.photo)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover">`;
  else { av.textContent = (u.name || "?").charAt(0).toUpperCase(); av.style.background = u.color; }
}

function mostrar(dentro) {
  $("viewLogin").style.display = dentro ? "none" : "grid";
  $("viewMain").style.display = dentro ? "" : "none";
  for (const id of ["userName", "userAvatar", "btnLogout"]) $(id).style.display = dentro ? "" : "none";
}

/* ---------- escribir en la partida ----------
   El bucle del punto 1 de la cabecera. `proximo` es lo que esta
   pestaña cree que toca; el registro que ha llegado por la escucha es
   la otra fuente, y se toma la mayor de las dos, porque la escucha
   puede ir un instante por detrás de lo que uno mismo acaba de
   escribir. */
async function jugar(jugada) {
  if (!state.pid) return false;
  const enBase = Object.keys((state.partida && state.partida.jugadas) || {}).length;
  let n = Math.max(proximo, enBase);
  const pid = state.pid;
  for (let i = 0; i < 25; i++, n++) {
    if (await fb.jugar(pid, n, jugada)) { proximo = n + 1; return true; }
  }
  throw new Error("No se pudo escribir la jugada: la partida va demasiado rápida.");
}

/* El módulo canta el ganador en cuanto lo ve; los dos lo cantan, y
   suele ser a la vez. Escribirlo una vez por pestaña basta, y el
   segundo `update` es idéntico al primero. */
async function terminar(ganador, motivo) {
  if (!state.pid || finEnviado === state.pid) return;
  finEnviado = state.pid;
  try { await fb.terminar(state.pid, ganador, motivo); }
  catch (e) { finEnviado = ""; console.warn("[juegos] no se pudo cerrar la partida", e); }
}

/* ---------- clasificación ---------- */
async function anotar(p) {
  const u = state.user;
  if (!p || !p.fin || !u || anotada === state.pid) return;
  if (!(p.jugadores || {})[u.uid]) return;         // mirón: no juega, no puntúa
  anotada = state.pid;
  const g = p.fin.ganador || "";
  const res = !g ? "empate" : (g === u.uid ? "ganada" : "perdida");
  try {
    const previa = await fb.leerRank(p.juego, u.uid);
    const fila = acumula(previa, res, state.pid, { nombre: u.name, foto: u.photo });
    if (fila) await fb.guardarRank(p.juego, u.uid, fila);
  } catch (e) {
    anotada = "";
    console.warn("[juegos] no se pudo apuntar la partida", e);
  }
}

/* ---------- rutas ----------
   El hash es la ruta: vacío es el vestíbulo, `#ranks` la tabla y
   `#p/<pid>` una partida. Así una partida se comparte pegando la
   barra de direcciones. */
function leerRuta() {
  const h = (location.hash || "").replace(/^#/, "");
  if (h === "ranks") return { vista: "ranks", pid: "" };
  const m = h.match(/^p\/([-\w]+)$/);
  if (m) return { vista: "partida", pid: m[1] };
  return { vista: "vestibulo", pid: "" };
}

function ir(hash) {
  if ((location.hash || "") === hash) aplicaRuta();
  else location.hash = hash;
}

function aplicaRuta() {
  const r = leerRuta();
  if (r.vista === state.vista && r.pid === state.pid) return;
  state.vista = r.vista;
  state.pid = r.pid;
  state.partida = null;
  state.estado = null;
  state.cargando = r.vista === "partida";
  if (r.vista !== "partida") { soltarPartida(); }
  else { engancharPartida(r.pid); }
  render();
}

/* ---------- escuchas ---------- */
function engancharVestibulo() {
  if (offSalas || !state.user) return;
  offSalas = fb.watchSalas((lista, err) => {
    if (err) state.fallo = err;
    state.salas = lista || [];
    if (state.vista === "vestibulo") render();
  });
  offMias = fb.watchMias(state.user.uid, (lista, err) => {
    if (err) state.fallo = err;
    state.mias = (lista || []).sort((a, b) => (b.at || 0) - (a.at || 0));
    if (state.vista === "vestibulo") render();
  });
}

function engancharPartida(pid) {
  soltarPartida();
  proximo = 0; anotada = ""; finEnviado = "";
  offPartida = fb.watchPartida(pid, (p, err) => {
    state.cargando = false;
    if (err) { state.fallo = err; state.partida = null; render(); return; }
    state.partida = p;
    state.estado = p ? reducir(p) : null;
    if (p) {
      proximo = Math.max(proximo, jugadasDe(p).length);
      cuidaLaSala(p);
      anotar(p);
    }
    render();
  });
}

function soltarPartida() {
  if (offPartida) { try { offPartida(); } catch (e) {} offPartida = null; }
  if (cancelarLimpieza) { try { cancelarLimpieza(); } catch (e) {} cancelarLimpieza = null; }
  desmontaJuego();
}

/* Una sala vacía que su anfitrión abandona no debe quedarse en el
   vestíbulo llamando a gente a una partida que no va a empezar. Se
   borra sola al cerrar la pestaña — y solo mientras espera: una
   partida empezada tiene que sobrevivir a una recarga. */
function cuidaLaSala(p) {
  const soyAnfitrion = state.user && p.anfitrion === state.user.uid;
  const espera = p.estado === "esperando" && Object.keys(p.jugadores || {}).length < 2;
  if (soyAnfitrion && espera && !cancelarLimpieza) cancelarLimpieza = fb.limpiarSiSeVa(state.pid);
  else if ((!espera || !soyAnfitrion) && cancelarLimpieza) { cancelarLimpieza(); cancelarLimpieza = null; }
}

/* ---------- acciones del vestíbulo ---------- */
async function crear(juego) {
  const u = state.user;
  if (!u) return;
  try {
    const pid = await fb.crearPartida(juego, { uid: u.uid, nombre: u.name, foto: u.photo, color: u.color });
    ir("#p/" + pid);
  } catch (e) { avisa(e); }
}

async function entrar(pid) {
  const u = state.user;
  if (!u) return;
  try {
    await fb.unirse(pid, { uid: u.uid, nombre: u.name, foto: u.photo, color: u.color });
    ir("#p/" + pid);
  } catch (e) { avisa(e); }
}

const avisa = e => alert(e && e.message ? e.message : String(e));

/* ---------- pintado: el armazón ---------- */
function render() {
  if (!state.user) return;
  if (state.vista !== vistaPintada) {
    if (vistaPintada === "ranks" && ranks) { ranks.destruir(); ranks = null; }
    armazon();
    vistaPintada = state.vista;
  }
  if (state.vista === "vestibulo") pintaVestibulo();
  else if (state.vista === "partida") pintaPartida();
  pintaTabs();
}

function pintaTabs() {
  const jugando = state.vista !== "ranks";
  $("tabJugar").classList.toggle("on", jugando);
  $("tabRanks").classList.toggle("on", !jugando);
}

function armazon() {
  const h = $("pantalla");
  if (state.vista === "ranks") {
    h.innerHTML = "";
    ranks = crearRanks({ uid: state.user.uid, watchRanks: fb.watchRanks });
    ranks.montar(h);
    return;
  }
  if (state.vista === "partida") {
    h.innerHTML = `
      <div class="jg-cab">
        <button class="btn2" id="jgVolver">← Vestíbulo</button>
        <b id="jgTitulo"></b>
        <span class="grow"></span>
        <span id="jgQuienes" class="jg-quienes"></span>
        <button class="btn2" id="jgAbandonar" style="display:none">Abandonar</button>
      </div>
      <div id="jgInvita"></div>
      <div id="jgHost"></div>
      <div id="jgFin"></div>`;
    $("jgVolver").onclick = salirDeLaPartida;
    $("jgAbandonar").onclick = abandonar;
    pidMontado = "";
    return;
  }
  h.innerHTML = `
    <p class="lead">
      Tres juegos por turnos para dos personas. Abre una sala, pásale el enlace a quien
      quieras y jugad — no hace falta que estéis a la vez frente a la pantalla: la partida
      espera, y cada jugada llega sola a la otra.
    </p>
    <div id="vesAviso"></div>
    <div class="jg-elige" id="vesElige"></div>
    <h2 class="jg-h2">Salas abiertas</h2>
    <div class="card" id="vesSalas"></div>
    <h2 class="jg-h2">Tus partidas</h2>
    <div class="card" id="vesMias"></div>`;
}

/* ---------- pintado: el vestíbulo ---------- */
function pintaVestibulo() {
  $("vesAviso").innerHTML = state.fallo ? avisoReglas(state.fallo) : "";

  $("vesElige").innerHTML = Object.entries(JUEGOS).map(([k, j]) => `
    <div class="jg-oferta" style="--c:${j.color}">
      <div class="jg-of-icono">${ICONO[k] || "●"}</div>
      <div class="jg-of-nombre">${escapeHtml(j.nombre)}</div>
      <div class="jg-of-lema">${escapeHtml(j.lema)}</div>
      <button class="btn jg-of-btn" data-crear="${k}">Abrir sala</button>
    </div>`).join("");
  for (const b of $("vesElige").querySelectorAll("[data-crear]")) {
    b.onclick = () => crear(b.getAttribute("data-crear"));
  }

  const mias = new Set(state.mias.map(x => x.id));
  const abiertas = state.salas.filter(s => s.anfitrion !== state.user.uid && !mias.has(s.id));
  $("vesSalas").innerHTML = abiertas.length ? abiertas.map(s => `
    <div class="row row-top">
      ${pillJuego(s.juego)}
      <div class="row-title">${escapeHtml(s.nombre || "Alguien")} espera rival
        <div class="row-meta">${escapeHtml((JUEGOS[s.juego] || {}).nombre || s.juego)} · abierta ${escapeHtml(timeAgo(s.at))}</div>
      </div>
      <button class="btn" data-entrar="${escapeHtml(s.id)}">Entrar</button>
    </div>`).join("")
    : `<div class="vacio">No hay ninguna sala abierta ahora mismo.<br>Abre tú una y pasa el enlace.</div>`;
  for (const b of $("vesSalas").querySelectorAll("[data-entrar]")) {
    b.onclick = () => entrar(b.getAttribute("data-entrar"));
  }

  $("vesMias").innerHTML = state.mias.length ? state.mias.map(m => `
    <div class="row row-top">
      ${pillJuego(m.juego)}
      <div class="row-title">${escapeHtml((JUEGOS[m.juego] || {}).nombre || m.juego)}
        <div class="row-meta">${escapeHtml(timeAgo(m.at))}</div>
      </div>
      <button class="btn2" data-abrir="${escapeHtml(m.id)}">Abrir</button>
      <button class="mini del" data-olvidar="${escapeHtml(m.id)}" title="Quitarla de tu lista">✕</button>
    </div>`).join("")
    : `<div class="vacio">Todavía no has jugado ninguna partida.</div>`;
  for (const b of $("vesMias").querySelectorAll("[data-abrir]")) {
    b.onclick = () => ir("#p/" + b.getAttribute("data-abrir"));
  }
  for (const b of $("vesMias").querySelectorAll("[data-olvidar]")) {
    b.onclick = () => fb.olvidarMia(b.getAttribute("data-olvidar"), state.user.uid).catch(avisa);
  }
}

const pillJuego = j => `<span class="pill jg-p" style="--c:${(JUEGOS[j] || {}).color || "#888"}">${escapeHtml(ICONO[j] || "●")}</span>`;

function avisoReglas(err) {
  const cod = (err && (err.code || err.message)) || "";
  return `<div class="aviso">
    <b>No se puede leer la base de datos.</b> ${escapeHtml(String(cod))}<br>
    Si pone <code>PERMISSION_DENIED</code>, es que las reglas de los nodos
    <code>partidas</code>, <code>misPartidas</code> y <code>ranks</code> todavía no se han
    publicado a mano en la consola de Firebase: no viajan solas al subir la página.
    Está explicado en <code>firebase/CONFIGURAR-FIREBASE.md</code>.
  </div>`;
}

/* ---------- pintado: la partida ---------- */
function pintaPartida() {
  const p = state.partida, est = state.estado;
  if (!p) {
    $("jgTitulo").textContent = state.cargando ? "Abriendo…" : "Esa partida ya no existe";
    $("jgInvita").innerHTML = state.fallo ? avisoReglas(state.fallo)
      : state.cargando ? "" : `<div class="vacio">La sala se cerró o el enlace no es correcto.</div>`;
    desmontaJuego();
    $("jgFin").innerHTML = "";
    return;
  }

  const j = JUEGOS[p.juego] || { nombre: p.juego, color: "#888" };
  $("jgTitulo").textContent = j.nombre;
  $("jgTitulo").style.color = j.color;
  $("jgQuienes").innerHTML = (est.jugadores || []).map(x => `
    <span class="jg-quien-chip" style="--c:${escapeHtml(x.color || "#888")}">
      ${x.foto ? `<img src="${escapeHtml(x.foto)}" alt="" referrerpolicy="no-referrer">` : `<i>${escapeHtml((x.nombre || "?").charAt(0))}</i>`}
      ${escapeHtml(x.nombre || "Alguien")}${x.uid === state.user.uid ? " (tú)" : ""}
    </span>`).join("");

  const enJuego = !p.fin && (p.jugadores || {})[state.user.uid];
  $("jgAbandonar").style.display = enJuego && est.listos ? "" : "none";

  /* Mientras falte el rival, el enlace es lo único que hay que hacer. */
  $("jgInvita").innerHTML = est.listos ? "" : `
    <div class="jg-invita">
      <b>Falta el otro jugador.</b>
      <p>Pásale este enlace: en cuanto entre, la partida empieza sola.</p>
      <div class="jg-enlace">
        <input class="inp" id="jgUrl" readonly value="${escapeHtml(enlace())}">
        <button class="btn2" id="jgCopiar">Copiar</button>
      </div>
    </div>`;
  if (!est.listos) {
    $("jgCopiar").onclick = async () => {
      const campo = $("jgUrl");
      campo.select();
      try { await navigator.clipboard.writeText(enlace()); $("jgCopiar").textContent = "Copiado"; }
      catch (e) { $("jgCopiar").textContent = "Copia a mano ↑"; }
    };
  }

  montaJuego(p);
  if (modulo) modulo.actualizar(p, est);
  pintaFin(p, est);
}

const enlace = () => location.origin + location.pathname + "#p/" + state.pid;

function montaJuego(p) {
  if (pidMontado === state.pid && modulo) return;
  desmontaJuego();
  const fab = FABRICAS[p.juego];
  if (!fab) { $("jgHost").innerHTML = `<div class="vacio">Ese juego no existe en esta versión.</div>`; return; }
  modulo = fab({ uid: state.user.uid, pid: state.pid, jugar, terminar, ahora: fb.ahora });
  modulo.montar($("jgHost"));
  pidMontado = state.pid;
}

function desmontaJuego() {
  if (modulo) { try { modulo.destruir(); } catch (e) {} modulo = null; }
  pidMontado = "";
  const h = $("jgHost");
  if (h) h.innerHTML = "";
}

function pintaFin(p, est) {
  const caja = $("jgFin");
  if (!p.fin) { caja.innerHTML = ""; return; }
  const g = p.fin.ganador || "";
  const yo = state.user.uid;
  const clase = !g ? "jg-fin-empate" : g === yo ? "jg-fin-gano" : "jg-fin-perdi";
  const texto = !g ? "Empate" : g === yo ? "¡Has ganado!" : "Ha ganado " + nombreDe(est, g);
  const firma = clase + texto;
  if (caja.dataset.firma === firma) return;      // no repintar: reinicia la animación
  caja.dataset.firma = firma;
  caja.innerHTML = `
    <div class="jg-fin ${clase}">
      <div class="jg-fin-t">${escapeHtml(texto)}</div>
      <div class="jg-fin-m">${escapeHtml(razon(p.fin.motivo))}</div>
      <div class="jg-fin-btns">
        <button class="btn" id="jgOtra">Otra partida</button>
        <button class="btn2" id="jgAlVestibulo">Vestíbulo</button>
      </div>
    </div>`;
  $("jgOtra").onclick = () => crear(p.juego);
  $("jgAlVestibulo").onclick = () => ir("#");
}

const RAZONES = {
  encontrado: "Encontró al personaje escondido.",
  abandono: "El otro jugador abandonó la partida.",
  trio: "Reunió tres cartas del mismo elemento en tres colores distintos.",
  puntos: "Cerró más cajas.",
  empate: "Las mismas cajas cada uno."
};
const razon = m => RAZONES[m] || "";
const nombreDe = (est, uid) => {
  const x = (est.jugadores || []).find(y => y.uid === uid);
  return x ? (x.nombre || "el otro") : "el otro";
};

/* ---------- salir ---------- */
async function salirDeLaPartida() {
  const p = state.partida;
  /* Si la sala es mía y sigue vacía, se va conmigo: nadie tiene por
     qué encontrarse un vestíbulo lleno de salas que no arrancan. */
  if (p && p.anfitrion === state.user.uid && p.estado === "esperando"
      && Object.keys(p.jugadores || {}).length < 2) {
    const pid = state.pid;
    try { await fb.borrarPartida(pid); await fb.olvidarMia(pid, state.user.uid); } catch (e) {}
  }
  ir("#");
}

async function abandonar() {
  if (!confirm("¿Abandonar la partida? Cuenta como derrota.")) return;
  try { await jugar({ t: "abandona", uid: state.user.uid }); } catch (e) { avisa(e); }
}

/* ---------- arranque ---------- */
function wire() {
  $("btnLogin").onclick = () => loginGoogle().catch(e => {
    $("loginError").textContent = "No se pudo iniciar sesión: " + (e.code || e.message);
  });
  $("btnLogout").onclick = () => logout();
  $("tabJugar").onclick = () => ir(state.pid ? "#p/" + state.pid : "#");
  $("tabRanks").onclick = () => ir("#ranks");
  window.addEventListener("hashchange", aplicaRuta);
}

(function boot() {
  wire();
  createReportWidget({
    app: "juegos", ver: VER, urlInformes: "informes.html",
    getUser: () => state.user,
    enviar: async (r, u) => {
      const rep = await import("./fb-reports.js");
      return rep.sendFeedback(r, { uid: u.uid, userName: u.name });
    }
  });
  watchAuth(user => {
    if (!user) {
      state.user = null;
      soltarPartida();
      for (const f of [offSalas, offMias, offReloj]) { if (f) { try { f(); } catch (e) {} } }
      offSalas = offMias = offReloj = null;
      vistaPintada = "";
      mostrar(false); pintaUsuario();
      return;
    }
    state.user = {
      uid: user.uid,
      name: user.displayName || user.email || "Usuario",
      photo: user.photoURL || "",
      color: colorForUid(user.uid)
    };
    pintaUsuario();
    mostrar(true);
    if (!offReloj) offReloj = fb.seguirReloj();
    engancharVestibulo();
    vistaPintada = "";
    const r = leerRuta();
    state.vista = r.vista; state.pid = r.pid;
    state.cargando = r.vista === "partida";
    if (r.vista === "partida") engancharPartida(r.pid);
    render();
  });
})();
