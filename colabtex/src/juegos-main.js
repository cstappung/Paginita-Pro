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
import { JUEGOS, reducir, jugadasDe, acumula, cupoDe, TAMANOS, etiquetaTamano } from "./juegos/motor.js";
import { crearEscondite } from "./juegos/escondite.js";
import { crearCartas } from "./juegos/cartas.js";
import { crearCuadritos } from "./juegos/cuadritos.js";
import { crearReversi } from "./juegos/reversi.js";
import { crearRanks } from "./juegos/ranks.js";
import { mezcla, abrePerfil } from "./juegos/perfil.js";
import { suena, silenciar, silenciado } from "./juegos/sonido.js";
import { createReportWidget } from "./report-widget.js";

const $ = id => document.getElementById(id);
const VER = (document.currentScript && document.currentScript.src.split("?v=")[1]) || "";

const FABRICAS = {
  escondite: crearEscondite, cartas: crearCartas,
  cuadritos: crearCuadritos, reversi: crearReversi
};

const ICONO = { escondite: "🔍", cartas: "🔥", cuadritos: "▦", reversi: "⚫" };

/* Lo que puede elegir quien abre la sala, por juego. Vive aquí y no en
   `motor.js` porque son controles y no reglas: el motor ya recorta lo
   que llegue (`cupoDe`, `ladoDe`), así que una sala creada a mano en la
   base tampoco puede pedir un tablero que no existe. Un juego que no
   aparezca aquí no ofrece nada y su tarjeta sale con el botón solo. */
const OPCIONES = {
  cuadritos: [
    { clave: "cupo", etiqueta: "Jugadores",
      valores: [2, 3, 4, 5, 6].map(n => ({ v: n, t: n + " jugadores" })) },
    { clave: "lado", etiqueta: "Tablero", por: TAMANOS.mediano.lado,
      valores: Object.keys(TAMANOS).map(k => ({ v: TAMANOS[k].lado, t: etiquetaTamano(k) })) }
  ]
};

const state = {
  user: null,           // el perfil ya aplicado: lo que se pinta
  base: null,           // lo que dice Google, sin tocar
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
let finCerrado = "";        // partida cuyo cartel de fin se ha cerrado a mano
let dentroVistos = -1;    // cuánta gente había en la sala la última vez

/* ---------- perfiles ----------
   La ficha que guarda la partida se escribe una vez y no se puede
   reescribir — así nadie se cambia el nombre a mitad de duelo — así
   que el apodo, la foto y el color vivos se superponen encima al
   pintar, y un cambio se ve también en las partidas de ayer.

   Se escucha **bajo demanda**: el primero que pregunta por un uid
   abre la escucha, y desde entonces llega sola. Traer `users`
   entero habría sido bajarse el perfil de todo el que haya entrado
   jamás en ColabTeX para pintar dos nombres. */
const perfiles = new Map();   // uid -> perfil (o null: no tiene)
const oyendo = new Map();     // uid -> cómo dejar de escucharlo

function perfilDe(uid) {
  if (!uid) return null;
  if (!oyendo.has(uid)) {
    /* Un perfil que no se puede leer no es un fallo de la página:
       se pinta la ficha y ya, que es lo que había antes de esto. */
    oyendo.set(uid, fb.watchPerfil(uid, (p, err) => {
      if (err) { perfiles.set(uid, null); return; }
      const antes = JSON.stringify(perfiles.get(uid) || null);
      if (JSON.stringify(p || null) === antes) return;
      perfiles.set(uid, p || null);
      if (state.base && uid === state.base.uid) aplicaPropio();
      if (state.estado) vistePerfiles(state.estado);
      if (ranks) ranks.refresca();
      render();
    }));
    perfiles.set(uid, perfiles.get(uid) || null);
  }
  return perfiles.get(uid) || null;
}

/* Se escribe **dentro** de cada ficha en vez de cambiarla por otra
   para no romper ninguna referencia que el reductor haya dejado
   apuntando a ella — `auditaCartas`, sin ir más lejos, lee el
   `hmazo` de estos mismos objetos. */
function vistePerfiles(est) {
  for (const j of (est && est.jugadores) || []) {
    const p = perfilDe(j.uid);
    if (p) Object.assign(j, mezcla(j, p));
  }
}

/* Lo propio se aplica sobre lo de Google, que es lo único que hay
   cuando todavía no se ha tocado nada. */
function aplicaPropio() {
  const b = state.base;
  if (!b) return;
  const m = mezcla({ nombre: b.name, foto: b.photo, color: b.color },
                   perfiles.get(b.uid) || null);
  state.user = { uid: b.uid, name: m.nombre, photo: m.foto, color: m.color };
  pintaUsuario();
}

/* Las reglas limitan a 400 caracteres la `foto` de la ficha y la de
   la clasificación — caben de sobra una URL de Google, y ninguna
   foto subida por nadie. Mandar la data URL entera ahí no es que se
   vea mal: la base **rechaza la escritura entera**, así que crear
   una sala con foto propia habría fallado con PERMISSION_DENIED. Va
   vacía, y al pintar se superpone el perfil, que no tiene tope. */
const fotoBreve = f => (typeof f === "string" && f.length <= 400 && !/^data:/.test(f)) ? f : "";

function editaPerfil() {
  const b = state.base;
  if (!b) return;
  abrePerfil({
    base: { nombre: b.name, foto: b.photo, color: b.color },
    perfil: perfiles.get(b.uid) || null,
    onGuardar: async p => {
      await fb.guardarPerfil(b.uid, p);
      /* La escucha traerá lo mismo en un instante; adelantarlo aquí
         evita que el botón se cierre sobre el avatar de antes. */
      perfiles.set(b.uid, Object.assign({}, p));
      aplicaPropio();
      if (state.estado) vistePerfiles(state.estado);
      if (ranks) ranks.refresca();
      render();
      suena("clic");
    }
  });
}

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
  for (const id of ["userName", "userAvatar", "btnPerfil", "btnLogout"]) $(id).style.display = dentro ? "" : "none";
}

/* ---------- escribir en la partida ----------
   El bucle del punto 1 de la cabecera. `proximo` es lo que esta
   pestaña cree que toca; el registro que ha llegado por la escucha es
   la otra fuente, y se toma la mayor de las dos, porque la escucha
   puede ir un instante por detrás de lo que uno mismo acaba de
   escribir. */
async function jugar(jugada) {
  if (!state.pid) return false;
  /* Una partida terminada no acepta más jugadas, y el sitio de decirlo
     es este y no cada juego. La regla de la base ya lo exige
     (`jugadas/$n` pide que `fin` no exista) y el reductor ignora todo lo
     que llegue detrás de un ganador — pero sin este portón la escritura
     fallaba en silencio, el módulo no se enteraba, y la última jugada se
     podía repetir con su animación infinitas veces. Se mira `est.fase`
     además de `fin` porque el reductor sabe que la partida acabó antes
     de que `fb.terminar` llegue a escribirlo.

     La única excepción es `t: "s"`, la revelación de la semilla del
     mazo en cartas: llega justo cuando la partida acaba de acabar, y
     es lo que deja auditarla. La regla de la base también la deja
     pasar mientras `fin` no esté escrito, que es por lo que se manda
     antes de `terminar`. */
  if (state.partida && state.partida.fin) return false;
  if (state.estado && state.estado.fase === "fin" && jugada.t !== "s") return false;
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
    const fila = acumula(previa, res, state.pid, { nombre: u.name, foto: fotoBreve(u.photo) });
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
  proximo = 0; anotada = ""; finEnviado = ""; finCerrado = ""; dentroVistos = -1;
  offPartida = fb.watchPartida(pid, (p, err) => {
    state.cargando = false;
    if (err) { state.fallo = err; state.partida = null; render(); return; }
    state.partida = p;
    state.estado = p ? reducir(p) : null;
    vistePerfiles(state.estado);
    if (p) {
      /* Alguien ha entrado. Suena aquí y no en `unirse` porque quien
         necesita enterarse es justamente el que ya estaba dentro,
         mirando el enlace y esperando. */
      const dentro = Object.keys(p.jugadores || {}).length;
      if (dentroVistos >= 0 && dentro > dentroVistos) suena("entra");
      dentroVistos = dentro;
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
async function crear(juego, extra) {
  const u = state.user;
  if (!u) return;
  try {
    const pid = await fb.crearPartida(juego,
      { uid: u.uid, nombre: u.name, foto: fotoBreve(u.photo), color: u.color }, extra);
    ir("#p/" + pid);
  } catch (e) { avisa(e, juego); }
}

async function entrar(pid) {
  const u = state.user;
  if (!u) return;
  try {
    await fb.unirse(pid, { uid: u.uid, nombre: u.name, foto: fotoBreve(u.photo), color: u.color });
    ir("#p/" + pid);
  } catch (e) { avisa(e); }
}

/* ---------- cuando la base dice que no ---------- */

const CONSOLA_REGLAS =
  "https://console.firebase.google.com/project/mi-pagina-pro/database/mi-pagina-pro-default-rtdb/rules";

/* El archivo de reglas está en el mismo sitio que la página — Pages
   sirve el repositorio entero — así que se puede traer desde aquí. */
const URL_REGLAS = new URL("firebase/database.rules.json", location.href).href;

/* Las reglas de seguridad no viajan con la página: subirla no las
   publica, se pegan a mano en la consola. Así que una copia publicada
   antes de que existiera un juego rechaza justamente las salas de ese
   juego — su nombre no está en la lista blanca de `juego` — y el
   navegador solo dice «permission denied». Contarlo entero es la
   diferencia entre un fallo de dos minutos y uno que parece del juego. */
function esPermiso(e) {
  const t = ((e && (e.code || e.message)) || "") + "";
  return /permission[_ ]denied/i.test(t);
}

function cuerpoReglas(cod, juego) {
  const nombre = juego && JUEGOS[juego] ? JUEGOS[juego].nombre : null;
  return `
    <div class="jg-fin-m">La base de datos ha rechazado la operación${
      nombre ? " al abrir una sala de <b>" + escapeHtml(nombre) + "</b>" : ""
    }: <code>${escapeHtml(String(cod || "PERMISSION_DENIED"))}</code>.</div>
    <div class="jg-fin-m">Las reglas de seguridad <b>no viajan con la página</b>:
      subirla no las publica. La copia que hay puesta en Firebase es anterior a
      <b>Reversi</b> y a las manos privadas de Cartas, así que rechaza las salas
      de ese juego y el nodo <code>misPartidas</code>.</div>
    <div class="jg-fin-m">Se arregla una sola vez: copia el archivo
      <code>firebase/database.rules.json</code> de este repositorio, pégalo en la
      consola de Firebase en <b>Realtime Database → Reglas</b> y pulsa
      <b>Publicar</b>. Está contado en <code>firebase/CONFIGURAR-FIREBASE.md</code>.</div>`;
}

/* Copiar el archivo evita el viaje a GitHub a buscarlo. Si el
   portapapeles se niega — pide un origen seguro — el botón pasa a
   abrirlo en otra pestaña, que es lo mismo con un paso más. */
async function copiaReglas(b) {
  b.disabled = true;
  const antes = b.textContent;
  b.textContent = "Copiando…";
  try {
    const r = await fetch(URL_REGLAS, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    await navigator.clipboard.writeText(await r.text());
    b.textContent = "Copiado ✓";
    setTimeout(() => { if (b.textContent === "Copiado ✓") b.textContent = antes; }, 2500);
  } catch (e) {
    b.textContent = "Ábrelo en otra pestaña ↗";
    b.onclick = () => window.open(URL_REGLAS, "_blank", "noopener");
  }
  b.disabled = false;
}

function capaReglas(cod, juego) {
  const vieja = document.getElementById("jgReglas");
  if (vieja) vieja.remove();
  const capa = document.createElement("div");
  capa.id = "jgReglas";
  capa.className = "jg-fin-capa";
  capa.innerHTML = `<div class="jg-fin jg-fin-empate jg-reglas">
    <button class="jg-fin-x" title="Cerrar">✕</button>
    <div class="jg-fin-cara">🔒</div>
    <div class="jg-fin-t">Faltan reglas por publicar</div>
    ${cuerpoReglas(cod, juego)}
    <div class="jg-fin-btns">
      <button class="btn2" id="jgCopiaReglas">Copiar las reglas</button>
      <a class="btn" href="${CONSOLA_REGLAS}" target="_blank" rel="noopener">Abrir la consola</a>
    </div>
  </div>`;
  capa.querySelector(".jg-fin-x").onclick = () => capa.remove();
  capa.onclick = e => { if (e.target === capa) capa.remove(); };
  capa.querySelector("#jgCopiaReglas").onclick = e => copiaReglas(e.currentTarget);
  document.body.appendChild(capa);
}

/* Un `alert` con «permission denied» dentro no dice quién ha denegado
   qué ni qué hacer con ello, que es exactamente como se leyó la primera
   vez que alguien intentó abrir una sala de Reversi. */
function avisa(e, juego) {
  if (esPermiso(e)) { capaReglas((e && (e.code || e.message)) || "", juego); return; }
  alert(e && e.message ? e.message : String(e));
}

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
    ranks = crearRanks({ uid: state.user.uid, watchRanks: fb.watchRanks, perfil: perfilDe });
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
      Cuatro juegos por turnos: tres duelos y uno para hasta seis. Abre una sala, pásale
      el enlace a quien quieras y jugad — no hace falta que estéis a la vez frente a la
      pantalla: la partida espera, y cada jugada llega sola a la otra.
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
      ${opcionesHtml(k)}
      <button class="btn jg-of-btn" data-crear="${k}">Abrir sala</button>
    </div>`).join("");
  for (const b of $("vesElige").querySelectorAll("[data-crear]")) {
    b.onclick = () => crear(b.getAttribute("data-crear"), leeOpciones(b));
  }

  const mias = new Set(state.mias.map(x => x.id));
  const abiertas = state.salas.filter(s => s.anfitrion !== state.user.uid && !mias.has(s.id));
  $("vesSalas").innerHTML = abiertas.length ? abiertas.map(s => `
    <div class="row row-top">
      ${pillJuego(s.juego)}
      <div class="row-title">${escapeHtml(s.nombre || "Alguien")} ${cupoDe(s) > 2 ? "abrió una sala" : "espera rival"}
        <div class="row-meta">${escapeHtml((JUEGOS[s.juego] || {}).nombre || s.juego)} ·
          ${Object.keys(s.jugadores || {}).length}/${cupoDe(s)} dentro · abierta ${escapeHtml(timeAgo(s.at))}</div>
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

/* Los controles de la tarjeta. Se leen del DOM al pulsar y no se
   guardan en `state`: son de un solo uso, y un estado paralelo que hay
   que mantener a la par de dos `<select>` cuesta más de lo que vale. */
function opcionesHtml(juego) {
  const ops = OPCIONES[juego];
  if (!ops) return "";
  return `<div class="jg-of-ops">` + ops.map(o => `
    <label class="jg-of-op"><span>${escapeHtml(o.etiqueta)}</span>
      <select data-op="${o.clave}">${o.valores.map(v =>
        `<option value="${v.v}"${v.v === (o.por || o.valores[0].v) ? " selected" : ""}>${escapeHtml(v.t)}</option>`
      ).join("")}</select>
    </label>`).join("") + `</div>`;
}

function leeOpciones(boton) {
  const tarjeta = boton.closest(".jg-oferta");
  const extra = {};
  if (tarjeta) for (const sel of tarjeta.querySelectorAll("[data-op]")) {
    extra[sel.getAttribute("data-op")] = Number(sel.value);
  }
  return extra;
}

const pillJuego = j => `<span class="pill jg-p" style="--c:${(JUEGOS[j] || {}).color || "#888"}">${escapeHtml(ICONO[j] || "●")}</span>`;

function avisoReglas(err) {
  const cod = (err && (err.code || err.message)) || "";
  return `<div class="aviso">
    <b>No se puede leer la base de datos.</b>
    ${cuerpoReglas(cod, null)}
    <div style="margin-top:8px">
      <a href="${escapeHtml(URL_REGLAS)}" target="_blank" rel="noopener">ver el archivo de reglas</a> ·
      <a href="${CONSOLA_REGLAS}" target="_blank" rel="noopener">abrir la consola de Firebase</a>
    </div>
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

  const enJuego = !datosFin(p, est) && (p.jugadores || {})[state.user.uid];
  $("jgAbandonar").style.display = enJuego && est.listos ? "" : "none";

  /* Mientras falte gente, el enlace es lo único que hay que hacer. */
  $("jgInvita").innerHTML = est.listos ? "" : panelEspera(p, est);
  if (!est.listos) {
    $("jgCopiar").onclick = async () => {
      const campo = $("jgUrl");
      campo.select();
      try { await navigator.clipboard.writeText(enlace()); $("jgCopiar").textContent = "Copiado"; }
      catch (e) { $("jgCopiar").textContent = "Copia a mano ↑"; }
    };
    const emp = $("jgEmpezar");
    if (emp) emp.onclick = () => {
      emp.disabled = true;
      fb.setEstado(state.pid, "jugando").catch(e => { emp.disabled = false; avisa(e); });
    };
  }

  montaJuego(p);
  if (modulo) modulo.actualizar(p, est);
  pintaFin(p, est);
}

/* Una sala de dos se cierra sola al llenarse, así que ahí no hay nada
   que decidir. Una de más de dos no se llena nunca — cuatro dentro de
   seis se quedan esperando a dos que no van a venir — así que alguien
   tiene que decir «ya está», y ese alguien es quien la abrió, que es
   quien puso las condiciones. */
function panelEspera(p, est) {
  const cupo = est.cupo || 2;
  const dentro = (est.jugadores || []).length;
  const min = (JUEGOS[p.juego] || {}).minimo || 2;
  const anfitrion = p.anfitrion === state.user.uid;
  const varios = cupo > min;
  return `
    <div class="jg-invita">
      <b>${varios ? `${dentro} de ${cupo} dentro.` : "Falta el otro jugador."}</b>
      <p>Pásale este enlace a quien quieras: en cuanto entre,
         ${varios ? "aparece en la partida" : "la partida empieza sola"}.</p>
      <div class="jg-enlace">
        <input class="inp" id="jgUrl" readonly value="${escapeHtml(enlace())}">
        <button class="btn2" id="jgCopiar">Copiar</button>
      </div>
      ${!varios ? ""
        : anfitrion && dentro >= min
          ? `<button class="btn jg-empezar" id="jgEmpezar">Empezar con ${dentro}</button>`
        : anfitrion
          ? `<div class="jg-nota">Hacen falta ${min} para poder empezar.</div>`
          : `<div class="jg-nota">Empieza cuando lo diga quien abrió la sala.</div>`}
    </div>`;
}

const enlace = () => location.origin + location.pathname + "#p/" + state.pid;

function montaJuego(p) {
  if (pidMontado === state.pid && modulo) return;
  desmontaJuego();
  const fab = FABRICAS[p.juego];
  if (!fab) { $("jgHost").innerHTML = `<div class="vacio">Ese juego no existe en esta versión.</div>`; return; }
  /* `secreto` solo lo usa cartas, pero se pasa a todos: el contrato de un
     juego es un objeto, y ramificarlo por juego lo convierte en cuatro. */
  modulo = fab({
    uid: state.user.uid, pid: state.pid, jugar, terminar, ahora: fb.ahora,
    secreto: () => fb.leerSecreto(state.pid, state.user.uid)
  });
  modulo.montar($("jgHost"));
  pidMontado = state.pid;
}

function desmontaJuego() {
  if (modulo) { try { modulo.destruir(); } catch (e) {} modulo = null; }
  pidMontado = "";
  const h = $("jgHost");
  if (h) h.innerHTML = "";
}

/* ---------- el cartel de fin ----------
   Va en una capa fija por encima de todo y no en un bloque debajo del
   tablero, que es donde estaba: un tablero de cuadritos grande mide
   más que la pantalla, así que el cartel salía bajo el pliegue y la
   partida parecía acabar sin decir nada. Dos decisiones más:

   - **Se dibuja en cuanto el reductor sabe que hay ganador**, sin
     esperar a que `fin` esté escrito en la base. Escribirlo es una ida
     y vuelta a la red que puede fallar (o quedarse a medias si las
     reglas no están publicadas), y quien acaba de ganar no tiene por
     qué mirar una pantalla muerta mientras tanto.
   - **Se puede cerrar** con la ✕, y queda cerrado para esa partida:
     mirar el tablero final es la mitad de la gracia, y un cartel que
     vuelve a salir en cada repintado tapa justo eso. */
function datosFin(p, est) {
  if (p.fin) return { ganador: p.fin.ganador || "", motivo: p.fin.motivo || "" };
  if (est && est.fase === "fin") return { ganador: est.ganador || "", motivo: est.motivo || "" };
  return null;
}

const CARA = { gano: "🏆", perdi: "😫", empate: "🤝", mirando: "🏁" };

function pintaFin(p, est) {
  const caja = $("jgFin");
  const f = datosFin(p, est);
  if (!f || finCerrado === state.pid) {
    if (caja.innerHTML) { caja.innerHTML = ""; caja.dataset.firma = ""; }
    return;
  }
  const yo = state.user.uid, g = f.ganador;
  const juega = !!(p.jugadores || {})[yo];
  const clase = !g ? "empate" : g === yo ? "gano" : juega ? "perdi" : "mirando";
  const titulo = clase === "gano" ? "¡Has ganado!"
    : clase === "perdi" ? "Has perdido"
    : clase === "empate" ? "Empate"
    : "Ganó " + nombreDe(est, g);
  const sub = clase === "perdi" ? "Ganó " + nombreDe(est, g) : "";
  const marca = marcadorFin(est);
  const firma = clase + titulo + sub + f.motivo + marca;
  if (caja.dataset.firma === firma) return;      // no repintar: reinicia la animación
  caja.dataset.firma = firma;
  caja.innerHTML = `
    <div class="jg-fin-capa">
      <div class="jg-fin jg-fin-${clase}">
        <button class="jg-fin-x" id="jgFinX" title="Ver el tablero">✕</button>
        <div class="jg-fin-cara">${CARA[clase]}</div>
        <div class="jg-fin-t">${escapeHtml(titulo)}</div>
        ${sub ? `<div class="jg-fin-sub">${escapeHtml(sub)}</div>` : ""}
        <div class="jg-fin-m">${escapeHtml(razon(f.motivo))}</div>
        ${marca}
        <div class="jg-fin-btns">
          <button class="btn" id="jgOtra">Otra partida</button>
          <button class="btn2" id="jgAlVestibulo">Vestíbulo</button>
        </div>
      </div>
    </div>`;
  $("jgFinX").onclick = () => { finCerrado = state.pid; caja.innerHTML = ""; caja.dataset.firma = ""; };
  $("jgOtra").onclick = () => crear(p.juego, { cupo: est.cupo || 2, lado: p.lado || undefined });
  $("jgAlVestibulo").onclick = () => ir("#");
}

/* El marcador final, cuando el juego cuenta algo: en cuadritos son las
   cajas y en reversi las fichas, y en los dos la pregunta inmediata al
   acabar es «por cuánto». Los que no cuentan nada — el escondite, las
   cartas — no ponen nada. */
function marcadorFin(est) {
  const cuenta = est && (est.puntos || est.cuenta);
  if (!cuenta || !est.jugadores || !est.jugadores.length) return "";
  const filas = est.jugadores.map(x => ({ x, n: cuenta[x.uid] || 0 }));
  if (!filas.some(r => r.n)) return "";
  filas.sort((a, b) => b.n - a.n);
  return `<div class="jg-fin-marca">` + filas.map(r => `
    <span class="jg-m" style="--c:${escapeHtml(r.x.color || "#888")}">
      <b>${r.n}</b><span>${escapeHtml(r.x.uid === state.user.uid ? "tú" : (r.x.nombre || "?"))}</span>
    </span>`).join("") + `</div>`;
}

const RAZONES = {
  encontrado: "Encontró al personaje escondido.",
  abandono: "La partida acabó por abandono.",
  trio: "Reunió tres cartas del mismo elemento en tres colores distintos.",
  puntos: "Cerró más cajas que nadie.",
  fichas: "Acabó con más fichas sobre el tablero.",
  empate: "Nadie sacó ventaja."
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
/* El botón dice lo que hay, no lo que haría al pulsarlo: un altavoz
   tachado sobre un juego mudo se lee como «pulsa para callarlo». */
function pintaSonido() {
  const b = $("btnSonido");
  if (!b) return;
  const on = !silenciado();
  b.textContent = on ? "\uD83D\uDD0A" : "\uD83D\uDD07";
  b.title = on ? "Sonido activado \u2014 pulsa para silenciar" : "Silenciado \u2014 pulsa para o\u00edr";
  b.setAttribute("aria-pressed", on ? "true" : "false");
}

function wire() {
  $("btnLogin").onclick = () => loginGoogle().catch(e => {
    $("loginError").textContent = "No se pudo iniciar sesión: " + (e.code || e.message);
  });
  $("btnLogout").onclick = () => logout();
  $("btnPerfil").onclick = editaPerfil;
  pintaSonido();
  $("btnSonido").onclick = () => { silenciar(silenciado()); pintaSonido(); suena("clic"); };
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
      state.base = null;
      soltarPartida();
      for (const f of [offSalas, offMias, offReloj]) { if (f) { try { f(); } catch (e) {} } }
      offSalas = offMias = offReloj = null;
      vistaPintada = "";
      mostrar(false); pintaUsuario();
      return;
    }
    state.base = {
      uid: user.uid,
      name: user.displayName || user.email || "Usuario",
      photo: user.photoURL || "",
      color: colorForUid(user.uid)
    };
    state.user = Object.assign({}, state.base);
    perfilDe(user.uid);          // abre la escucha; al llegar repinta
    aplicaPropio();
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
