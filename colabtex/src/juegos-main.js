import { crearSolo } from "./juegos/solo/club.js";
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
import { JUEGOS, reducir, jugadasDe, acumula, cupoDe, TAMANOS, etiquetaTamano, meToca, progreso, CR_MALLAS, mayoriaExpulsion, MODOS_F7 } from "./juegos/motor.js";
import { crearEscondite } from "./juegos/escondite.js";
import { crearCartas } from "./juegos/cartas.js";
import { crearCuadritos } from "./juegos/cuadritos.js";
import { crearOrbita } from "./juegos/orbita.js";
import { crearReversi } from "./juegos/reversi.js";
import { crearWorms } from "./juegos/worms.js";
import { crearCadena } from "./juegos/cadena.js";
import { crearFlip7 } from "./juegos/flip7.js";
import { crearRanks } from "./juegos/ranks.js";
import { mezcla, abrePerfil } from "./juegos/perfil.js";
import { suena, silenciar, silenciado, ambientar, ajustarMusica, activarAudio, configurarMusica, musicaActiva, volumenMusica } from "./juegos/sonido.js";
import { createReportWidget } from "./report-widget.js";

const $ = id => document.getElementById(id);
const VER = (document.currentScript && document.currentScript.src.split("?v=")[1]) || "";

const FABRICAS = {
  orbita: crearOrbita, escondite: crearEscondite, cartas: crearCartas,
  cuadritos: crearCuadritos, reversi: crearReversi, worms: crearWorms,
  cadena: crearCadena, flip7: crearFlip7
};

const ICONO = { orbita: "✦", escondite: "🔍", cartas: "🔥", cuadritos: "▦", reversi: "⚫", worms: "💥", cadena: "⚛", flip7: "🃏" };

/* Lo que puede elegir quien abre la sala, por juego. Vive aquí y no en
   `motor.js` porque son controles y no reglas: el motor ya recorta lo
   que llegue (`cupoDe`, `ladoDe`), así que una sala creada a mano en la
   base tampoco puede pedir un tablero que no existe. Un juego que no
   aparezca aquí no ofrece nada y su tarjeta sale con el botón solo. */
/* Cuántos pueden entrar, del mínimo al cupo del juego: sale de `JUEGOS`
   para que subir el tope de un juego sea cambiar un número en un sitio. */
const cupos = k => Array.from({ length: JUEGOS[k].cupo - JUEGOS[k].minimo + 1 },
  (_, i) => ({ v: JUEGOS[k].minimo + i, t: JUEGOS[k].minimo + i + " jugadores" }));

const OPCIONES = {
  cuadritos: [
    { clave: "cupo", etiqueta: "Jugadores", valores: cupos("cuadritos") },
    { clave: "lado", etiqueta: "Tablero", por: TAMANOS.mediano.lado,
      valores: Object.keys(TAMANOS).map(k => ({ v: TAMANOS[k].lado, t: etiquetaTamano(k) })) }
  ],
  worms: [
    { clave: "cupo", etiqueta: "Cuadrillas", valores: cupos("worms") },
    { clave: "mapa", etiqueta: "Mapa", valores: [
      { v: "substation", t: "Valle del reactor" }, { v: "alpine", t: "Cordillera Boreal" },
      { v: "desert", t: "Desierto de cobre" }, { v: "tidal", t: "Puerto de tormenta" }] },
    { clave: "escuadra", etiqueta: "Robots por cuadrilla", por: 4,
      valores: [2, 3, 4, 6].map(n => ({ v: n, t: n + " robots" })) },
    { clave: "tiempo", etiqueta: "Tiempo por turno", por: 45,
      valores: [30, 45, 60].map(n => ({ v: n, t: n + " s" })) }
  ],
  cadena: [
    { clave: "cupo", etiqueta: "Jugadores", valores: cupos("cadena") },
    { clave: "malla", etiqueta: "Tablero", por: "clasica",
      valores: Object.keys(CR_MALLAS).map(k => ({ v: k, t: `${CR_MALLAS[k].nombre} ${CR_MALLAS[k].cols}×${CR_MALLAS[k].filas}` })) }
  ],
  flip7: [
    { clave: "cupo", etiqueta: "Jugadores", valores: cupos("flip7") },
    { clave: "modo", etiqueta: "Modo", por: "normal",
      valores: Object.keys(MODOS_F7).map(v => ({ v, t: MODOS_F7[v] })) }
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
  cargando: false,
  enCurso: []             // partidas empezadas que se pueden mirar
};

let offSalas = null, offMias = null, offPartida = null, offReloj = null, offEnCurso = null;
let offChat = null, chatMsgs = [], chatFirma = "";
let jugadasVistas = -1;   // cuántas jugadas tenía el registro la última vez
let ultimoCambio = 0;     // cuándo creció el registro por última vez (reloj local)
let relojVotos = 0;       // repinta los botones de votar, que dependen del tiempo
let enCursoToque = 0;     // cuándo se anunció la partida en «En juego ahora»
let cancelarLimpieza = null;
let modulo = null, pidMontado = "";
let vistaPintada = "";
let ranks = null;
let individual = null;
let proximo = 0;          // el número de jugada que toca escribir
const enVuelo = new Set(); // jugadas de esta pestaña aún sin confirmar (ver `terminar`)
let anotada = "";         // partida ya sumada a la clasificación desde esta pestaña
let finEnviado = "";
let finCerrado = "";        // partida cuyo cartel de fin se ha cerrado a mano
let finVivo = "";           // partida que esta pestaña vio en juego, sin terminar
let finDesde = 0;           // cuándo se vio el final (0: aún no, o la pantalla sigue contando)
let finReloj = 0;           // el temporizador que sacará el cartel
let finSonado = "";         // partida cuya fanfarria ya sonó
let dentroVistos = -1;    // cuánta gente había en la sala la última vez
let tocaba = false;       // si la última foto de la partida esperaba algo de mí
const TITULO = document.title;

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
const soyJugador = () => !!(state.partida && state.partida.jugadores && state.user &&
  state.partida.jugadores[state.user.uid]);

async function jugar(jugada) {
  if (!state.pid) return false;
  /* Quien mira no juega. Las reglas ya lo impiden (una jugada la firma
     un jugador de la sala), pero los módulos tienen temporizadores que
     escriben solos — Flip 7 manda aportes — y un espectador no debe
     ni intentarlo. */
  if (!soyJugador()) return false;
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
  /* Se apunta en `enVuelo` ANTES de llamar a `fb.jugar`, no al volver:
     el `terminar` que esta misma jugada provoca corre dentro de esa
     llamada (ver `terminar`), y para entonces tiene que poder verla. */
  let suelta;
  const tarea = new Promise(r => { suelta = r; });
  enVuelo.add(tarea);
  try {
    for (let i = 0; i < 25; i++, n++) {
      if (await fb.jugar(pid, n, jugada)) { proximo = n + 1; return true; }
    }
    throw new Error("No se pudo escribir la jugada: la partida va demasiado rápida.");
  } finally { enVuelo.delete(tarea); suelta(); }
}

/* El módulo canta el ganador en cuanto lo ve; los dos lo cantan, y
   suele ser a la vez. Escribirlo una vez por pestaña basta, y el
   segundo `update` es idéntico al primero.

   Lo que no puede hacer es cantarlo antes de que la jugada ganadora
   esté en el servidor, y eso es exactamente lo que pasaba en la pestaña
   de quien ganaba. `runTransaction` del SDK dispara el evento local
   (el valor optimista) de forma síncrona y SÓLO DESPUÉS envía la
   transacción (`repoStartTransaction`: primero
   `eventQueueRaiseEventsForChangedPath`, luego
   `repoSendReadyTransactions`). Nuestro `onValue` repinta dentro de ese
   evento, el módulo ve al ganador y llama aquí, y el `set(fin)` salía
   por el socket antes que la jugada. El servidor aplicaba `fin`, la
   regla de `jugadas/$n` (que `fin` no exista) rechazaba la jugada
   ganadora y el SDK la revertía: la partida quedaba cerrada sin su
   última jugada — nadie veía la cadena final y el perdedor conservaba
   sus puntos de antes. Por eso se espera a que se confirme toda jugada
   de esta pestaña que siga en vuelo, y sólo se cierra si, tras ello,
   la partida sigue acabada. */
async function terminar(ganador, motivo) {
  const pid = state.pid;
  if (!pid || finEnviado === pid || !soyJugador()) return;
  finEnviado = pid;
  if (enVuelo.size) {
    await Promise.allSettled([...enVuelo]);
    if (state.pid !== pid) return;
    const acabada = (state.partida && state.partida.fin) || (state.estado && state.estado.fase === "fin");
    if (!acabada) { finEnviado = ""; return; }   // la jugada no entró: la partida sigue
  }
  try { await fb.terminar(pid, ganador, motivo); }
  catch (e) { if (finEnviado === pid) finEnviado = ""; console.warn("[juegos] no se pudo cerrar la partida", e); }
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
  if (h === "solo/minas" || h === "solo/snake") return {vista: h === "solo/minas" ? "solo-minas" : "solo-snake", pid:""};
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
  /* Sin reglas publicadas este nodo falla; no es motivo para tapar el
     vestíbulo con el aviso: la lista simplemente sale vacía. */
  offEnCurso = fb.watchEnCurso(lista => {
    state.enCurso = lista || [];
    if (state.vista === "vestibulo") render();
  });
}

function engancharPartida(pid) {
  soltarPartida();
  proximo = 0; anotada = ""; finEnviado = ""; finCerrado = ""; dentroVistos = -1; tocaba = false;
  finVivo = ""; finDesde = 0; finSonado = ""; clearTimeout(finReloj);
  jugadasVistas = -1; ultimoCambio = Date.now(); enCursoToque = 0;
  chatMsgs = []; chatFirma = "";
  offPartida = fb.watchPartida(pid, (p, err) => {
    state.cargando = false;
    if (err) { state.fallo = err; state.partida = null; render(); return; }
    state.partida = p;
    state.estado = p ? reducir(p) : null;
    vistePerfiles(state.estado);
    if (p && !datosFin(p, state.estado)) finVivo = pid;
    if (p) {
      /* Alguien ha entrado. Suena aquí y no en `unirse` porque quien
         necesita enterarse es justamente el que ya estaba dentro,
         mirando el enlace y esperando. */
      const dentro = Object.keys(p.jugadores || {}).length;
      if (dentroVistos >= 0 && dentro > dentroVistos) suena("entra");
      avisaTurno(meToca(state.estado, state.user && state.user.uid), dentroVistos >= 0);
      dentroVistos = dentro;
      proximo = Math.max(proximo, jugadasDe(p).length);
      cuidaLaSala(p);
      anotar(p);
      const hechas = jugadasDe(p).length;
      if (hechas !== jugadasVistas) { jugadasVistas = hechas; ultimoCambio = Date.now(); }
      anunciaEnCurso(p, state.estado);
    }
    render();
  });
  offChat = fb.watchChat(pid, v => { chatMsgs = v || []; pintaChat(); });
  /* Los botones de votar en un duelo aparecen solo tras un rato sin
     jugadas, y eso no lo dice ninguna escucha: lo dice el reloj. */
  relojVotos = setInterval(() => {
    if (state.vista === "partida" && state.partida && state.estado) pintaQuienes(state.partida, state.estado);
  }, 5000);
}

/* «En juego ahora»: el cartel con el que una partida empezada sale en
   el vestíbulo para que otros entren a mirarla. Lo pone cualquiera de
   sus jugadores — el primero que la ve empezada — y se refresca cada
   cinco minutos mientras dura, porque el vestíbulo descarta los que
   llevan un cuarto de hora sin tocarse (una pestaña que se cerró a
   mitad no puede quitar el suyo). Al terminar lo quita quien lo vea. */
function anunciaEnCurso(p, est) {
  const u = state.user;
  if (!u || !est) return;
  if (datosFin(p, est) || p.fin) {
    if (enCursoToque >= 0) { enCursoToque = -1; fb.quitaEnCurso(state.pid); }
    return;
  }
  if (!(p.jugadores || {})[u.uid] || !est.listos) return;
  if (enCursoToque > 0 && Date.now() - enCursoToque < 5 * 60 * 1000) return;
  enCursoToque = Date.now();
  fb.anunciaEnCurso(state.pid, {
    juego: p.juego,
    nombres: (est.jugadores || []).map(j => j.nombre || "").join(" · ").slice(0, 200),
    n: (est.jugadores || []).length
  });
}

/* «Te toca» en el título de la pestaña, y un timbre solo si la pestaña
   no se ve: con ella delante ya suena la jugada del otro, y dos avisos
   por el mismo hecho es ruido. Tampoco suena al entrar en la sala (la
   primera foto), porque eso no es que te haya llegado el turno. */
function avisaTurno(toca, yaVista) {
  document.title = (toca ? "● Tu turno · " : "") + TITULO;
  if (toca && !tocaba && yaVista && document.hidden) suena("turno");
  tocaba = toca;
}

function soltarPartida() {
  document.title = TITULO; tocaba = false; clearTimeout(finReloj);
  if (offPartida) { try { offPartida(); } catch (e) {} offPartida = null; }
  if (offChat) { try { offChat(); } catch (e) {} offChat = null; }
  clearInterval(relojVotos); relojVotos = 0;
  chatMsgs = []; chatFirma = "";
  if (cancelarLimpieza) { try { cancelarLimpieza(); } catch (e) {} cancelarLimpieza = null; }
  ambientar("");
  desmontaJuego();
}

/* Una sala vacía que su anfitrión abandona no debe quedarse en el
   vestíbulo llamando a gente a una partida que no va a empezar. Se
   borra sola al cerrar la pestaña — y solo mientras espera: una
   partida empezada tiene que sobrevivir a una recarga. */
function cuidaLaSala(p) {
  const soyAnfitrion = state.user && p.anfitrion === state.user.uid;
  const espera = !p.origen && p.estado === "esperando" && Object.keys(p.jugadores || {}).length < 2;
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
  if (!state.user) { if (individual) { individual.destruir(); individual = null; } return; }
  if (state.vista !== vistaPintada) {
    if (individual) { individual.destruir(); individual = null; }
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
  if (state.vista.startsWith("solo-")) {
    individual = crearSolo({juego:state.vista.slice(5),usuario:state.user,guardar:fb.guardarSolo,watch:fb.watchSolo,volver:()=>ir("")});
    individual.montar(h); return;
  }
  if (state.vista === "ranks") {
    h.innerHTML = "";
    ranks = crearRanks({ uid: state.user.uid, watchRanks: fb.watchRanks, watchSolo: fb.watchSolo, perfil: perfilDe });
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
      <div id="jgMirando"></div>
      <div id="jgInvita"></div>
      <div id="jgHost"></div>
      <div id="jgRevancha" aria-live="polite"></div>
      <div id="jgFin"></div>
      <section class="jg-chat" id="jgChat" aria-label="Chat de la partida">
        <header><h2>Chat de la sala</h2><small>lo leen jugadores y espectadores</small></header>
        <div class="jg-chat-lista" id="jgChatLista" aria-live="polite"></div>
        <form class="jg-chat-form" id="jgChatForm" autocomplete="off">
          <input class="inp" id="jgChatTxt" maxlength="${fb.CHAT_LARGO}" placeholder="Escribe algo…">
          <button class="btn" id="jgChatBtn">Enviar</button>
        </form>
      </section>`;
    $("jgVolver").onclick = salirDeLaPartida;
    $("jgAbandonar").onclick = abandonar;
    $("jgChatForm").onsubmit = async ev => {
      ev.preventDefault();
      const campo = $("jgChatTxt"), texto = campo.value.trim();
      if (!texto || !state.pid) return;
      campo.value = "";
      const ok = await fb.mandaChat(state.pid, { uid: state.user.uid, nombre: state.user.name }, texto);
      /* Lo que no salió se devuelve al campo: perder una frase escrita
         porque las reglas no están publicadas es peor que no mandarla. */
      if (!ok && !campo.value) { campo.value = texto; avisa(Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" })); }
    };
    pidMontado = "";
    chatFirma = "";
    pintaChat();
    return;
  }
  /* El vestíbulo es un salón: a la izquierda el catálogo, a la derecha la
     puerta. Las salas abiertas van en una columna propia y pegajosa porque
     son lo único de la página que cambia solo —alguien abre una mientras
     miras las tarjetas— y abajo del todo nadie las veía. La rejilla va por
     áreas y no por dos cajas anidadas: en el móvil la columna cae entre la
     marquesina y el catálogo, que es donde tiene que estar una sala que
     espera, y con dos cajas habría acabado al final de la página. */
  h.innerHTML = `
    <div class="jg-ves">
      <section class="jg-marquesina">
        <div class="jg-mq-texto">
          <span class="jg-eyebrow">LABORATORIO · SALÓN DE JUEGOS</span>
          <h2>¿A qué jugamos?</h2>
          <p>Elige un juego, abre la sala y pasa el enlace. O entra en una que ya esté esperando.</p>
          <div class="jg-mq-cifras">
            <span><b id="vesNSalas">0</b>salas esperando</span>
            <span><b id="vesNMias">0</b>partidas tuyas</span>
            <span><b>${String(Object.keys(JUEGOS).length + 2).padStart(2, "0")}</b>juegos</span>
          </div>
          <div class="jg-mq-acciones">
            <button class="btn jg-mq-rapida" id="vesRapida"></button>
            <a class="jg-mq-link" href="#vesCatalogo">Ver el catálogo ↓</a>
          </div>
        </div>
        <div class="jg-mq-rueda" aria-hidden="true">${Object.keys(JUEGOS).map((k, i, t) =>
          `<i style="--c:${JUEGOS[k].color};--a:${Math.round(360 * i / t.length)}deg">${escapeHtml(ICONO[k] || "●")}</i>`).join("")}<b>▶</b></div>
      </section>
      <aside class="jg-ves-lado" aria-label="Salas y partidas">
        <section class="jg-lado-caja">
          <header><span class="jg-vivo" aria-hidden="true"></span><h2>Salas abiertas</h2><span class="jg-lado-n" id="vesCuenta">0</span></header>
          <div id="vesSalas"></div>
        </section>
        <section class="jg-lado-caja">
          <header><h2>Tus partidas</h2></header>
          <div id="vesMias"></div>
        </section>
        <section class="jg-lado-caja">
          <header><span class="jg-ojo" aria-hidden="true">👁</span><h2>En juego ahora</h2><span class="jg-lado-n" id="vesNCurso">0</span></header>
          <div id="vesEnCurso"></div>
        </section>
      </aside>
      <div class="jg-ves-cat" id="vesCatalogo">
        <div id="vesAviso"></div>
        <div class="jg-section-title"><h2>Multijugador</h2>
          <div class="jg-filtros" role="group" aria-label="Filtrar juegos">
            <button data-filtro="todos">Todos</button><button data-filtro="duelo">Duelos</button><button data-filtro="grupo">En grupo</button>
          </div></div>
        <div class="jg-elige" id="vesElige"></div>
        <div class="jg-section-title"><h2>Para jugar solo</h2><span>sin sala, cuando quieras</span></div>
        <div class="sp-entradas"><a href="#solo/minas" class="sp-entrada sp-e-minas"><small>SINGLEPLAYER / ESTRATEGIA</small><strong>MINA CLUB <span>✦</span></strong><p>Piensa, explora y florece. Tres dificultades y música progresiva.</p><b>Explorar →</b></a><a href="#solo/snake" class="sp-entrada sp-e-snake"><small>SINGLEPLAYER / REFLEJOS</small><strong>SNAKE CLUB <span>ϟ</span></strong><p>Clásico, arcade, portales y Zen. Una más.</p><b>Entrar al circuito →</b></a><a href="juegos/worms/index.html?v=worms-4" class="sp-entrada sp-e-worms"><small>LOCAL · BOTS / ARTILLERÍA</small><strong>CIRCUIT BREAKERS <span>💥</span></strong><p>Tu cuadrilla contra bots o amigos en el mismo equipo. En línea: abre una sala arriba.</p><b>Desplegar →</b></a></div>
      </div>
    </div>`;
  for (const b of h.querySelectorAll("[data-filtro]")) {
    b.onclick = () => { filtroVes = b.getAttribute("data-filtro"); aplicaFiltro(); };
  }
  h.querySelector(".jg-mq-link").onclick = ev => {
    ev.preventDefault();   // un #ancla cambiaría la ruta del hash
    $("vesCatalogo").scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

/* El filtro solo esconde tarjetas: no se repinta nada, así que lo que
   alguien haya elegido en los `<select>` de una tarjeta sobrevive a
   cambiar de pestaña y volver. */
let filtroVes = "todos";
function aplicaFiltro() {
  for (const b of document.querySelectorAll("[data-filtro]"))
    b.setAttribute("aria-pressed", String(b.getAttribute("data-filtro") === filtroVes));
  for (const c of document.querySelectorAll("#vesElige [data-tipo]"))
    c.hidden = filtroVes !== "todos" && c.getAttribute("data-tipo") !== filtroVes;
}

/* ---------- pintado: el vestíbulo ---------- */
function pintaVestibulo() {
  $("vesAviso").innerHTML = state.fallo ? avisoReglas(state.fallo) : "";

  $("vesElige").innerHTML = Object.entries(JUEGOS).map(([k, j]) => `
    <div class="jg-oferta jg-of-${k}" style="--c:${j.color}" data-tipo="${j.cupo > 2 ? "grupo" : "duelo"}">
      <div class="jg-portada jg-portada-${k}" aria-hidden="true">${arteJuego(k)}</div>
      <div class="jg-of-meta">${k === "orbita" ? "NUEVO · ORIGINAL" : j.cupo > 2 ? "EN GRUPO" : "DUELO"}<span>${j.cupo > 2 ? "2–" + j.cupo : "2"} JUGADORES</span></div>
      <div class="jg-of-nombre">${escapeHtml(j.nombre)}</div>
      <div class="jg-of-lema">${escapeHtml(j.lema)}</div>
      ${opcionesHtml(k)}
      <button class="btn jg-of-btn" data-crear="${k}">Abrir sala <span aria-hidden="true">↗</span></button>
    </div>`).join("");
  for (const b of $("vesElige").querySelectorAll("[data-crear]")) {
    b.onclick = () => crear(b.getAttribute("data-crear"), leeOpciones(b));
  }
  aplicaFiltro();

  const mias = new Set(state.mias.map(x => x.id));
  const abiertas = state.salas.filter(s => s.anfitrion !== state.user.uid && !mias.has(s.id) && !s.origen);
  $("vesCuenta").textContent = abiertas.length;
  $("vesNSalas").textContent = abiertas.length;
  $("vesNMias").textContent = state.mias.length;

  /* El botón grande de la marquesina hace lo más probable: entrar en la
     sala que lleva más rato esperando, o, si no hay ninguna, llevarte a
     abrir una. */
  const rapida = $("vesRapida");
  const primera = abiertas.slice().sort((x, y) => (x.at || 0) - (y.at || 0))[0];
  rapida.innerHTML = primera
    ? `Unirme a ${escapeHtml(primera.nombre || "alguien")} <small>${escapeHtml((JUEGOS[primera.juego] || {}).nombre || primera.juego)}</small>`
    : `Abrir una sala`;
  rapida.onclick = primera ? () => entrar(primera.id)
    : () => $("vesCatalogo").scrollIntoView({ behavior: "smooth", block: "start" });

  $("vesSalas").innerHTML = abiertas.length ? abiertas.map(s => {
    const j = JUEGOS[s.juego] || {}, n = Object.keys(s.jugadores || {}).length, cupo = cupoDe(s);
    return `
    <div class="jg-sala" style="--c:${j.color || "#888"}">
      <span class="jg-sala-ico" aria-hidden="true">${escapeHtml(ICONO[s.juego] || "●")}</span>
      <div class="jg-sala-txt">
        <b>${escapeHtml(j.nombre || s.juego)}</b>
        <span>${escapeHtml(s.nombre || "Alguien")} · ${escapeHtml(timeAgo(s.at))}</span>
        <span class="jg-sala-cupo" title="${n} de ${cupo} dentro"><i style="width:${Math.round(100 * n / cupo)}%"></i></span>
      </div>
      <div class="jg-sala-der"><small>${n}/${cupo}</small>
        <button class="btn" data-entrar="${escapeHtml(s.id)}">Entrar</button></div>
    </div>`;
  }).join("")
    : `<div class="vacio">No hay ninguna sala abierta ahora mismo.<br>Abre tú una y pasa el enlace.</div>`;
  for (const b of $("vesSalas").querySelectorAll("[data-entrar]")) {
    b.onclick = () => entrar(b.getAttribute("data-entrar"));
  }

  $("vesMias").innerHTML = state.mias.length ? state.mias.map(m => `
    <div class="jg-sala jg-sala-mia" style="--c:${(JUEGOS[m.juego] || {}).color || "#888"}">
      <span class="jg-sala-ico" aria-hidden="true">${escapeHtml(ICONO[m.juego] || "●")}</span>
      <div class="jg-sala-txt">
        <b>${escapeHtml((JUEGOS[m.juego] || {}).nombre || m.juego)}</b>
        <span>${escapeHtml(timeAgo(m.at))}</span>
      </div>
      <div class="jg-sala-der">
        <button class="btn2" data-abrir="${escapeHtml(m.id)}">Abrir</button>
        <button class="mini del" data-olvidar="${escapeHtml(m.id)}" title="Quitarla de tu lista">✕</button></div>
    </div>`).join("")
    : `<div class="vacio">Todavía no has jugado ninguna partida.</div>`;
  for (const b of $("vesMias").querySelectorAll("[data-abrir]")) {
    b.onclick = () => ir("#p/" + b.getAttribute("data-abrir"));
  }
  for (const b of $("vesMias").querySelectorAll("[data-olvidar]")) {
    b.onclick = () => fb.olvidarMia(b.getAttribute("data-olvidar"), state.user.uid).catch(avisa);
  }

  /* Las partidas que se pueden mirar. Las mías ya están arriba, y un
     anuncio viejo es de una partida que alguien dejó a medias sin
     cerrar la pestaña: la base no lo sabe, así que se filtra aquí. */
  const fresco = fb.ahora() - fb.EN_CURSO_FRESCO;
  const vivas = state.enCurso.filter(x => !mias.has(x.id) && (x.at || 0) > fresco);
  $("vesNCurso").textContent = vivas.length;
  $("vesEnCurso").innerHTML = vivas.length ? vivas.map(x => {
    const j = JUEGOS[x.juego] || {};
    return `
    <div class="jg-sala" style="--c:${j.color || "#888"}">
      <span class="jg-sala-ico" aria-hidden="true">${escapeHtml(ICONO[x.juego] || "●")}</span>
      <div class="jg-sala-txt">
        <b>${escapeHtml(j.nombre || x.juego)}</b>
        <span>${escapeHtml(x.nombres || "")}</span>
      </div>
      <div class="jg-sala-der"><small>${x.n || ""}</small>
        <button class="btn2" data-mirar="${escapeHtml(x.id)}">Mirar</button></div>
    </div>`;
  }).join("")
    : `<div class="vacio">No hay partidas en juego ahora mismo.</div>`;
  for (const b of $("vesEnCurso").querySelectorAll("[data-mirar]")) {
    b.onclick = () => ir("#p/" + b.getAttribute("data-mirar"));
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
    /* Casi todo es un número, pero el mapa de worms es un nombre: un
       `Number("alpine")` habría escrito NaN y la base rechaza la sala. */
    const n = Number(sel.value);
    extra[sel.getAttribute("data-op")] = Number.isFinite(n) ? n : sel.value;
  }
  return extra;
}


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
    ambientar("");
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
  pintaQuienes(p, est);

  const enJuego = !datosFin(p, est) && (p.jugadores || {})[state.user.uid];
  $("jgAbandonar").style.display = enJuego && est.listos ? "" : "none";

  /* Un enlace permite ver la invitación; entrar requiere aceptarla. Y
     si ya no se puede entrar —la partida empezó—, se puede **mirar**: el
     módulo del juego se monta igual que para un jugador, porque todo lo
     que pinta sale del registro, que es público. Lo que no puede es
     escribir: `jugar()` se niega a quien no está en la ficha, así que
     ninguna pantalla tiene que saber que existe el modo espectador. */
  if (!p.jugadores?.[state.user.uid]) {
    $("jgRevancha").innerHTML = "";
    const admite = p.estado === "esperando" && !p.fin && est.jugadores.length < cupoDe(p);
    if (admite) {
      $("jgMirando").innerHTML = "";
      ambientar(""); desmontaJuego(); $("jgFin").innerHTML = "";
      $("jgInvita").innerHTML = '<div class="jg-invita"><b>Te han invitado a jugar</b>' +
        '<p>Únete para comenzar la partida con quienes están dentro.</p>' +
        '<button class="btn" id="jgUnirse">Unirse a la partida</button></div>';
      const unir = $("jgUnirse");
      unir.onclick = async () => { unir.disabled = true; await entrar(state.pid); if (unir.isConnected) unir.disabled = false; };
    } else {
      const acabada = !!datosFin(p, est);
      $("jgMirando").innerHTML = `<div class="jg-mirando"><span aria-hidden="true">👁</span>
        <b>Estás mirando esta partida.</b>
        <span>${acabada ? "Ya terminó: esto es cómo quedó." : est.listos ? "Lo ves en directo; puedes escribir en el chat, pero no jugar." : "Todavía no ha empezado."}</span></div>`;
      $("jgInvita").innerHTML = "";
      if (est.listos) {
        ambientar(acabada ? "" : p.juego);
        montaJuego(p);
        if (modulo) modulo.actualizar(p, est);
        pintaFin(p, est);
      } else { ambientar(""); desmontaJuego(); $("jgFin").innerHTML = ""; }
    }
    pintaChat();
    return;
  }
  $("jgMirando").innerHTML = "";

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

  ambientar(est.listos && !datosFin(p, est) ? p.juego : "");
  /* El último tramo acelera la música hasta un 12 %: el «hurry up» de
     las recreativas. Antes del 70 % no se toca, para que el tema suene
     a su tempo casi toda la partida y el cambio se note cuando llega. */
  ajustarMusica({ tempo: 1 + 0.12 * Math.max(0, (progreso(est, p.juego) - 0.7) / 0.3) });
  montaJuego(p);
  if (modulo) modulo.actualizar(p, est);
  pintaRevancha(p, est);
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
    /* Quien mira monta el mismo módulo, que con esto sabe que no debe
       pintar una mano «suya» ni ofrecer botones que no van a escribir. */
    mirando: !soyJugador(),
    /* Un espectador no tiene mano propia, y leer `misPartidas` de una
       partida en la que no está solo devolvería vacío tras un viaje. */
    secreto: () => soyJugador()
      ? fb.leerSecreto(state.pid, state.user.uid) : Promise.resolve(null),
    /* La pantalla avisa cuando acaba de contar una jugada: el cartel del
       final espera a que la cadena que ganó la partida se haya visto. */
    listo: () => { if (state.partida && state.estado) pintaFin(state.partida, state.estado); }
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
const FANFARRIA = { gano: "victoria", perdi: "derrota", empate: "empate", mirando: "victoria" };

/* Cuánto se deja ver la última jugada antes de tapar el tablero, por
   juego: lo que dura su animación y un respiro para leer el marcador.
   En cartas es el choque entero (`CHOQUE`, 2,6 s): la ronda que gana
   el trío se enseña igual que las demás. Worms no pone fanfarria — el
   marco tiene su propio audio y su propio final. */
const PAUSA_FIN = { cuadritos: 1400, reversi: 1500, orbita: 1300, cartas: 2800, escondite: 1700, worms: 2500, cadena: 800, flip7: 1000 };

function pintaFin(p, est) {
  const caja = $("jgFin");
  const f = datosFin(p, est);
  const vacia = () => { if (caja.innerHTML) { caja.innerHTML = ""; caja.dataset.firma = ""; } };
  if (!f || finCerrado === state.pid) { vacia(); return; }
  /* La pantalla sigue contando la jugada: la pausa empieza cuando acabe
     (llamará a `listo`), no ahora. */
  if (modulo && modulo.ocupado && modulo.ocupado()) { finDesde = 0; vacia(); return; }
  const vivo = finVivo === state.pid;
  if (vivo && f.motivo !== "abandono") {
    /* Con la pestaña detrás no se ha visto nada: la pantalla se salta
       la animación y el reloj corre igual, así que al volver el cartel
       ya tapaba la jugada que decidió la partida — casi siempre la del
       que pierde, que es quien espera mirando otra cosa. La pausa se
       cuenta desde que la pestaña vuelve (`visibilitychange`). */
    if (document.hidden) { finDesde = 0; clearTimeout(finReloj); vacia(); return; }
    if (!finDesde) finDesde = Date.now();
    const falta = (PAUSA_FIN[p.juego] ?? 1200) - (Date.now() - finDesde);
    if (falta > 0) {
      const pid = state.pid;
      clearTimeout(finReloj);
      finReloj = setTimeout(() => {
        if (state.pid === pid && state.vista === "partida" && state.partida && state.estado) pintaFin(state.partida, state.estado);
      }, falta);
      vacia();
      return;
    }
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
  const echados = (est.expulsados || []).map(x => nombreDe(est, x.uid)).join(", ");
  const expulsion = echados ? `Expulsad${(est.expulsados || []).length > 1 ? "os" : "o"} por votación: ${echados}.` : "";
  const firma = clase + titulo + sub + f.motivo + marca + expulsion + (p.revancha || "");
  if (caja.dataset.firma === firma) return;      // no repintar: reinicia la animación
  caja.dataset.firma = firma;
  if (vivo && finSonado !== state.pid) {
    finSonado = state.pid;
    if (p.juego !== "worms") suena(FANFARRIA[clase]);
  }
  caja.innerHTML = `
    <div class="jg-fin-capa">
      <div class="jg-fin jg-fin-${clase}" role="dialog" aria-modal="true" aria-label="Resultado de la partida" tabindex="-1">
        <button class="jg-fin-x" id="jgFinX" title="Ver el tablero">✕</button>
        <div class="jg-fin-cara">${CARA[clase]}</div>
        <div class="jg-fin-t">${escapeHtml(titulo)}</div>
        ${sub ? `<div class="jg-fin-sub">${escapeHtml(sub)}</div>` : ""}
        <div class="jg-fin-m">${escapeHtml(razon(f.motivo))}</div>
        ${expulsion ? `<div class="jg-fin-m jg-fin-exp">${escapeHtml(expulsion)}</div>` : ""}
        ${marca}
        <div class="jg-fin-btns">
          ${juega ? `<button class="btn" id="jgOtra">${p.revancha ? "Aceptar revancha" : "Pedir revancha"}</button>` : ""}
          <button class="btn2" id="jgAlVestibulo">Vestíbulo</button>
        </div>
      </div>
    </div>`;
  const cerrar = () => { finCerrado = state.pid; caja.innerHTML = ""; caja.dataset.firma = ""; $("jgRevanchaBtn")?.focus(); };
  $("jgFinX").onclick = cerrar;
  const dialogo = caja.querySelector('[role="dialog"]');
  dialogo.focus();
  dialogo.onkeydown = e => {
    if (e.key === "Escape") { e.preventDefault(); cerrar(); }
    if (e.key !== "Tab") return;
    const botones = [...dialogo.querySelectorAll("button:not(:disabled)")];
    const primero = botones[0], ultimo = botones[botones.length - 1];
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === dialogo)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  };
  if ($("jgOtra")) $("jgOtra").onclick = () => revancha(p, est);
  $("jgAlVestibulo").onclick = () => ir("#");
}

/* Un tick después, para que la pantalla del juego — que escucha el
   mismo evento — haya arrancado ya la animación que se perdió y
   `ocupado()` lo diga. */
document.addEventListener("visibilitychange", () => setTimeout(() => {
  if (!document.hidden && state.vista === "partida" && state.partida && state.estado) pintaFin(state.partida, state.estado);
}, 0));

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
  estrellas: "Capturó más energía en las 36 estrellas.",
  encontrado: "Encontró al personaje escondido.",
  abandono: "La partida acabó por abandono.",
  trio: "Reunió tres cartas del mismo elemento en tres colores distintos.",
  puntos: "Cerró más cajas que nadie.",
  fichas: "Acabó con más fichas sobre el tablero.",
  empate: "Nadie sacó ventaja.",
  victoria: "Su cuadrilla fue la última en pie.",
  apagon: "Apagón total: no quedó ninguna cuadrilla en pie.",
  reaccion: "Su reacción en cadena se tragó a todos los demás.",
  flip7: "Pasó de 200 puntos con más que nadie."
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
  if (p && !p.origen && p.anfitrion === state.user.uid && p.estado === "esperando"
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

/* ---------- quién juega, y la votación para echar a alguien ----------
   Los votos son jugadas como las demás (`{t:"voto", uid, contra}`), así
   que el reductor los ve en el mismo orden en los dos navegadores y la
   expulsión ocurre exactamente en la misma jugada para todos: no hay un
   «ya lo han echado» que un cliente vea y el otro no.

   El botón no sale siempre. En un duelo votar contra el otro es ganar,
   así que solo se ofrece a quien **no** tiene el turno y lleva un rato
   (`VOTO_DUELO_MS`) esperando sin que se mueva nada: es el remedio para
   la pestaña dormida, no un botón de «gano yo». Con tres o más la
   mayoría de los demás ya es freno suficiente y se ofrece desde que la
   partida empieza. */
const VOTO_DUELO_MS = 90 * 1000;

function fueraDe(est) {
  const f = new Set();
  for (const o of [est.fuera, est.caidos]) if (o) for (const u in o) if (o[u]) f.add(u);
  for (const x of est.expulsados || []) f.add(x.uid);
  return f;
}

function pintaQuienes(p, est) {
  const caja = $("jgQuienes");
  if (!caja) return;
  const yo = state.user.uid;
  const juego = !!(p.jugadores || {})[yo];
  const fuera = fueraDe(est);
  const activos = (est.jugadores || []).filter(x => !fuera.has(x.uid));
  const hace = mayoriaExpulsion(activos.length);
  const abierta = juego && est.listos && !datosFin(p, est) && !fuera.has(yo) && activos.length >= 2;
  const duelo = activos.length <= 2;
  const puedoVotar = abierta && (!duelo || (!meToca(est, yo) && Date.now() - ultimoCambio >= VOTO_DUELO_MS));
  const votos = est.votos || {};
  const firma = JSON.stringify([est.jugadores.map(x => [x.uid, x.nombre, x.color, x.foto]), [...fuera], votos, puedoVotar, hace]);
  if (caja.dataset.firma === firma) return;
  caja.dataset.firma = firma;
  caja.innerHTML = (est.jugadores || []).map(x => {
    const contra = votos[x.uid] || [];
    const mio = contra.includes(yo);
    const out = fuera.has(x.uid);
    const boton = !out && x.uid !== yo && (mio || puedoVotar)
      ? `<button class="jg-voto${mio ? " on" : ""}" data-voto="${escapeHtml(x.uid)}" title="${mio ? "Retirar tu voto" : "Votar para expulsar a " + escapeHtml(x.nombre || "Alguien")}">${mio ? "↺" : "⏏"}</button>` : "";
    return `
    <span class="jg-quien-chip${out ? " fuera" : ""}" style="--c:${escapeHtml(x.color || "#888")}">
      ${x.foto ? `<img src="${escapeHtml(x.foto)}" alt="" referrerpolicy="no-referrer">` : `<i>${escapeHtml((x.nombre || "?").charAt(0))}</i>`}
      ${escapeHtml(x.nombre || "Alguien")}${x.uid === yo ? " (tú)" : ""}
      ${contra.length && !out ? `<small class="jg-voto-n" title="Votos para expulsar">⏏ ${contra.length}/${hace}</small>` : ""}
      ${boton}
    </span>`;
  }).join("");
  for (const b of caja.querySelectorAll("[data-voto]")) b.onclick = () => vota(b.getAttribute("data-voto"));
}

async function vota(contra) {
  const est = state.estado;
  if (!est) return;
  const yo = state.user.uid;
  const ya = ((est.votos || {})[contra] || []).includes(yo);
  const nombre = nombreDe(est, contra);
  const activos = (est.jugadores || []).filter(x => !fueraDe(est).has(x.uid)).length;
  const hace = mayoriaExpulsion(activos);
  const aviso = ya ? `¿Retirar tu voto contra ${nombre}?`
    : hace <= 1 ? `¿Expulsar a ${nombre}? Sale de la partida al momento, como si hubiera abandonado.`
    : `¿Votar para expulsar a ${nombre}? Hacen falta ${hace} votos de los demás; cuando se alcancen, sale como si hubiera abandonado.`;
  if (!confirm(aviso)) return;
  try { await jugar(ya ? { t: "voto", uid: yo, contra, no: true } : { t: "voto", uid: yo, contra }); }
  catch (e) { avisa(e); }
}

/* ---------- el chat ----------
   Va aparte de `partidas/` (`chat/<pid>`) para que escribir no sea una
   jugada: el registro de jugadas es el estado, y un «hola» no puede
   cambiar de quién es el turno. Lo escriben también los espectadores. */
function pintaChat() {
  const lista = $("jgChatLista");
  if (!lista) return;
  const firma = chatMsgs.map(m => m.id).join(",");
  if (lista.dataset.firma === firma && chatFirma === firma) return;
  lista.dataset.firma = firma;
  chatFirma = firma;
  const yo = state.user && state.user.uid;
  const jugadores = (state.partida && state.partida.jugadores) || {};
  lista.innerHTML = chatMsgs.length ? chatMsgs.map(m => `
    <div class="jg-chat-msg${m.uid === yo ? " mio" : ""}" style="--c:${escapeHtml(colorForUid(m.uid || ""))}">
      <b>${escapeHtml(m.nombre || "Alguien")}${jugadores[m.uid] ? "" : ' <small>mirando</small>'}</b>
      <span>${escapeHtml(m.t || "")}</span>
    </div>`).join("")
    : `<div class="vacio">Nadie ha escrito todavía.</div>`;
  lista.scrollTop = lista.scrollHeight;
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
  const pintaMusica = () => {
    $("btnMusica").textContent = musicaActiva() ? "♫ Música" : "♫ Sin música";
    $("btnMusica").setAttribute("aria-pressed", String(musicaActiva()));
  };
  pintaMusica();
  $("volMusica").value = Math.round(volumenMusica() * 100);
  $("btnMusica").onclick = () => { activarAudio(); configurarMusica(!musicaActiva()); pintaMusica(); };
  $("volMusica").oninput = e => { activarAudio(); configurarMusica(musicaActiva(), Number(e.target.value) / 100); };
  document.addEventListener("pointerdown", activarAudio, { passive: true });
  document.addEventListener("keydown", activarAudio);
  $("btnSonido").onclick = () => { silenciar(!silenciado()); pintaSonido(); suena("clic"); };
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
      if (individual) { individual.destruir(); individual = null; }
      state.user = null;
      state.base = null;
      soltarPartida();
      for (const f of [offSalas, offMias, offReloj, offEnCurso]) { if (f) { try { f(); } catch (e) {} } }
      offSalas = offMias = offReloj = offEnCurso = null;
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


function arteJuego(k) {
  if (k === "orbita") return '<div class="jg-art-orbit"><i></i><i></i><b>✦</b><span>✧</span></div>';
  if (k === "cartas") return '<img src="juegos/cartas/agua/agua_10.png" alt=""><img src="juegos/cartas/fuego/fuego_12.png" alt=""><img src="juegos/cartas/nieve/nieve_11.png" alt="">';
  if (k === "reversi") return '<div class="jg-art-rev">' + Array.from({ length: 16 }, (_, i) => '<i class="' + ([1, 4, 5, 10, 11, 14].includes(i) ? "negra" : [2, 6, 9, 13].includes(i) ? "blanca" : "") + '"></i>').join("") + '</div>';
  if (k === "worms") return '<div class="jg-art-worms"><i></i><i></i><i></i><b>💥</b><span>CIRCUIT BREAKERS</span></div>';
  if (k === "cadena") return '<div class="jg-art-cr">' + Array.from({ length: 12 }, (_, i) => '<i class="o' + [1, 0, 2, 1, 3, 0, 1, 2, 0, 3, 2, 1][i] + " c" + (i % 4) + '"></i>').join("") + '</div>';
  if (k === "flip7") return '<div class="jg-art-f7">' + [[7, "#e8a317"], [3, "#3fa7d6"], [12, "#d64545"]].map(([n, c]) => '<i style="--t:' + c + '">' + n + '</i>').join("") + '<b>FLIP 7</b></div>';
  if (k === "cuadritos") return '<div class="jg-art-dots">' + Array.from({ length: 9 }, (_, i) => '<i class="' + (i % 3 === 0 ? "llena" : "") + '"></i>').join("") + '</div>';
  return '<div class="jg-art-land"><i></i><i></i><i></i><b>⌖</b><span>ENCUENTRA LO INVISIBLE</span></div>';
}
let pidiendoRevancha = false;
async function revancha(p, est) {
  if (pidiendoRevancha) return;
  pidiendoRevancha = true;
  const pid = state.pid, u = state.user;
  for (const b of document.querySelectorAll("#jgOtra, #jgRevanchaBtn")) { b.disabled = true; b.textContent = "Preparando revancha…"; }
  try {
    const fin = datosFin(p, est);
    if (!p.fin) await fb.terminar(pid, fin.ganador, fin.motivo);
    const destino = p.revancha || await fb.pedirRevancha(pid, {
      uid: u.uid, nombre: u.name, foto: fotoBreve(u.photo), color: u.color
    });
    if (state.pid === pid) await entrar(destino);
  } catch (e) { avisa(e, p.juego); }
  finally {
    pidiendoRevancha = false;
    if (state.pid === pid && state.partida && $("jgFin")) {
      $("jgFin").dataset.firma = "";
      pintaRevancha(state.partida, state.estado); pintaFin(state.partida, state.estado);
    }
  }
}
function pintaRevancha(p, est) {
  const el = $("jgRevancha");
  if (!el) return;
  if (!datosFin(p, est) || !p.jugadores?.[state.user.uid]) { el.innerHTML = ""; return; }
  el.innerHTML = '<div class="jg-revancha"><div><b>' +
    (p.revancha ? "Hay una revancha esperándote" : "¿Nos damos otra oportunidad?") + '</b><p>' +
    (p.revancha ? "Únete a la nueva sala con los mismos participantes." : "Invita a los participantes a repetir este juego.") +
    '</p></div><button class="btn" id="jgRevanchaBtn" ' + (pidiendoRevancha ? "disabled" : "") + '>' +
    (p.revancha ? "Aceptar revancha" : "Pedir revancha") + '</button></div>';
  $("jgRevanchaBtn").onclick = () => revancha(p, est);
}
