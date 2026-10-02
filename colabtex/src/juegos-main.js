import { crearSolo } from "./juegos/solo/club.js";
import { crearFrontera } from "./juegos/frontera.js";
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
import { AJ_RITMOS, JUEGOS, reducir, jugadasDe, acumula, cupoDe, minimoDe, TAMANOS, etiquetaTamano, meToca, progreso, CR_MALLAS, mayoriaExpulsion, MODOS_F7, MODOS_UNO, CT_EXPANSIONES, YM_VARIANTES, YM_LARGOS, YM_MAPAS, mapaYemas, varianteYemas, ganoEn, ordenaRanks, salaInactiva, ultimaActividad, INACTIVA_MS } from "./juegos/motor.js";
import { crearEscondite } from "./juegos/escondite.js";
import { crearCartas } from "./juegos/cartas.js";
import { crearCuadritos } from "./juegos/cuadritos.js";
import { crearOrbita } from "./juegos/orbita.js";
import { crearReversi } from "./juegos/reversi.js";
import { crearAjedrez, piezaSvg } from "./juegos/ajedrez.js";
import { crearPokemon } from "./juegos/pokemon.js";
import { FORMATOS as PK_FORMATOS, FORMATO_POR as PK_FORMATO_POR } from "./juegos/pokemon/formatos.js";
import { abreEquipos } from "./juegos/pokemon/equipos.js";
import { crearWorms } from "./juegos/worms.js";
import { crearCadena } from "./juegos/cadena.js";
import { crearFlip7 } from "./juegos/flip7.js";
import { crearCacho } from "./juegos/cacho.js";
import { crearUno } from "./juegos/uno.js";
import { crearCatan } from "./juegos/catan.js";
import { crearPresidente } from "./juegos/presidente.js";
import { crearSpicy } from "./juegos/spicy.js";
import { crearTetris } from "./juegos/tetris.js";
import { crearYemas } from "./juegos/yemas.js";
import { crearClue } from "./juegos/clue.js";
import { abreReglas, tieneReglas } from "./juegos/reglas.js";
import { crearRanks } from "./juegos/ranks.js";
import { LOGROS, detecta, deFila, deMarca } from "./juegos/logros.js";
import { crearLogros } from "./juegos/logros-vista.js";
import { monedasDe, formatoMonedas, valorLogro, registraDia, diaChile as diaMonedas, pagoDia, rachaHoy,
  registraJugadaClub, PAGO_CLUB, TOPE_CLUB_DIA, PODIO } from "./juegos/monedas.js";
import { crearMonedas, topHtml, MONEDA } from "./juegos/monedas-vista.js";
import { crearProdrop } from "./juegos/prodrop.js";
import { mejoresDrops, miniCarta, cifras as cifrasCartas, MOTOR } from "./juegos/prodrop-cartas.js";
import { mezcla, abrePerfil } from "./juegos/perfil.js";
import { abreMini, cierraMini, miniAbierta, crearPaginaPerfil, avatarMarco, quien } from "./juegos/perfil-vista.js";
import { estadisticas, nombreCategoria } from "./juegos/perfil-tarjeta.js";
import { fotoSana } from "./juegos/sano.js";
import { suena, silenciar, silenciado, ambientar, ajustarMusica, activarAudio } from "./juegos/sonido.js";
import { montaReproductor } from "./juegos/reproductor.js";
import { createReportWidget } from "./report-widget.js";
import { anunciaSala, anunciaPodio, puestoSolo, conRecord, ordenSolo } from "./juegos/discord.js";

const $ = id => document.getElementById(id);
const VER = (document.currentScript && document.currentScript.src.split("?v=")[1]) || "";

const FABRICAS = {
  orbita: crearOrbita, escondite: crearEscondite, cartas: crearCartas,
  cuadritos: crearCuadritos, reversi: crearReversi, worms: crearWorms,
  cadena: crearCadena, flip7: crearFlip7, cacho: crearCacho, uno: crearUno, catan: crearCatan,
  presidente: crearPresidente, spicy: crearSpicy, tetris: crearTetris, yemas: crearYemas, clue: crearClue,
  ajedrez: crearAjedrez, pokemon: crearPokemon
};

const ICONO = { orbita: "✦", escondite: "🔍", cartas: "🔥", cuadritos: "▦", reversi: "⚫", worms: "💥", cadena: "⚛", flip7: "🃏", cacho: "🎲", uno: "🟥", catan: "⬢", presidente: "👑", spicy: "🌶", tetris: "▤", yemas: "🥚", clue: "🕵️", ajedrez: "♞", pokemon: "◓" };
/* Los clubes de un jugador, con sus claves de la clasificación y los
   mismos signos que llevan en su tarjeta del vestíbulo. */
const ICONO_TODOS = { ...ICONO, general: "★", minas: "✦", snake: "ϟ", tetrisclub: "▤", sortem: "↔", bbtan: "●", sopa: "🔤", electro: "⚡", frontera: "🏰", yzombis: "🧟" };

/* Lo que puede elegir quien abre la sala, por juego. Vive aquí y no en
   `motor.js` porque son controles y no reglas: el motor ya recorta lo
   que llegue (`cupoDe`, `ladoDe`), así que una sala creada a mano en la
   base tampoco puede pedir un tablero que no existe. Un juego que no
   aparezca aquí no ofrece nada y su tarjeta sale con el botón solo. */
/* Cuántos pueden entrar, del mínimo al cupo del juego: sale de `JUEGOS`
   para que subir el tope de un juego sea cambiar un número en un sitio. */
/* El cupo es cuánta gente cabe, y una sala es para dos o más aunque el
   juego deje empezar con uno (Yemas en zombis): el anfitrión arranca
   con «Empezar con 1» sin esperar a nadie. */
const cupoMin = k => Math.max(2, JUEGOS[k].minimo);
const cupos = k => Array.from({ length: JUEGOS[k].cupo - cupoMin(k) + 1 },
  (_, i) => ({ v: cupoMin(k) + i, t: cupoMin(k) + i + " jugadores" }));

const OPCIONES = {
  /* En el ajedrez lo único que se elige es el color de quien abre; «al
     azar» lo decide la semilla de la sala, que nadie controla. */
  ajedrez: [
    { clave: "ritmo", etiqueta: "Ritmo", por: "10+0",
      valores: [...Object.keys(AJ_RITMOS).map(v => ({ v, t: `${AJ_RITMOS[v]} · ${v}` })), { v: "libre", t: "Sin reloj" }] },
    { clave: "color", etiqueta: "Color de quien abre", por: "azar",
      valores: [{ v: "azar", t: "Al azar" }, { v: "blancas", t: "Blancas" }, { v: "negras", t: "Negras" }] }
  ],
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
  ],
  cacho: [
    { clave: "cupo", etiqueta: "Jugadores", valores: cupos("cacho") },
    { clave: "sicil", etiqueta: "Partida", por: 0,
      valores: [{ v: 0, t: "Normal" }, { v: 1, t: "Siciliana" }] }
  ],
  uno: [
    { clave: "cupo", etiqueta: "Jugadores", valores: cupos("uno") },
    { clave: "modo", etiqueta: "Versión", por: "clasico",
      valores: Object.keys(MODOS_UNO).map(v => ({ v, t: MODOS_UNO[v] })) }
  ],
  /* Catan: de 2 a 6 (con 5 o 6 entra sola la ampliación: isla grande y
     fase especial de construcción), y cada expansión o variante en su
     propio desplegable. Los campos no son `modo` a propósito: `modo` está
     en la lista blanca de las reglas, y estos van por `$otro`. El
     primer valor de cada lista es el de siempre, que es el que queda
     elegido — `por: 0` se leería como «sin valor por omisión». */
  catan: [
    { clave: "cupo", etiqueta: "Jugadores", por: 4, valores: cupos("catan") },
    { clave: "exp", etiqueta: "Expansión", por: "base",
      valores: Object.keys(CT_EXPANSIONES).map(v => ({ v, t: CT_EXPANSIONES[v] })) },
    { clave: "baraja", etiqueta: "Dados", valores: [{ v: 0, t: "Dos dados" }, { v: 1, t: "Baraja de eventos" }] },
    { clave: "amable", etiqueta: "Ladrón", valores: [{ v: 0, t: "Normal" }, { v: 1, t: "Amistoso" }] },
    { clave: "puerto", etiqueta: "Puertos", valores: [{ v: 0, t: "Normales" }, { v: 1, t: "Maestro del puerto" }] },
    { clave: "largo", etiqueta: "Partida", valores: [{ v: 0, t: "Estándar" }, { v: -2, t: "Corta (−2 puntos)" }, { v: 2, t: "Larga (+2 puntos)" }] }
  ],
  /* En el Presidente el cupo es cuántos se sientan a la mesa a la vez:
     la sala admite a más, que esperan a que alguien se levante. */
  presidente: [
    { clave: "cupo", etiqueta: "Asientos", por: 6, valores: cupos("presidente") }
  ],
  spicy: [{ clave: "cupo", etiqueta: "Jugadores", por: 4, valores: cupos("spicy") }],
  tetris: [{ clave: "cupo", etiqueta: "Jugadores", por: 4, valores: cupos("tetris") }],
  yemas: [
    { clave: "cupo", etiqueta: "Jugadores", por: 4, valores: cupos("yemas") },
    { clave: "variante", etiqueta: "Modo", por: "todos",
      valores: Object.keys(YM_VARIANTES).map(v => ({ v, t: YM_VARIANTES[v] })) },
    /* La meta depende del modo (bajas, bajas del equipo o banderas), y un
       desplegable no puede cambiar sus opciones según otro: se elige el
       largo y el motor lo traduce con `YM_LARGOS`. */
    { clave: "largo", etiqueta: "Partida", por: 1,
      valores: ["Corta", "Normal", "Larga"].map((t, i) => ({ v: i,
        t: `${t} (${YM_LARGOS.todos[i]} / ${YM_LARGOS.equipos[i]} bajas, ${YM_LARGOS.bandera[i]} 🚩)` })) },
    /* El mapa solo cuenta en zombis; en las otras variantes se ignora. */
    { clave: "mapa", etiqueta: "Mapa (zombis)", por: "nacht",
      valores: Object.keys(YM_MAPAS).map(v => ({ v, t: YM_MAPAS[v] })) }
  ],
  clue: [{ clave: "cupo", etiqueta: "Detectives", por: 4, valores: cupos("clue") }],
  /* El formato decide qué equipos valen (el validador de Showdown); se
     guarda como `formato` y no como `modo`, que las reglas restringen. */
  pokemon: [{ clave: "formato", etiqueta: "Formato", por: PK_FORMATO_POR,
    valores: Object.entries(PK_FORMATOS).map(([v, t]) => ({ v, t })) }]
};

/* La pestaña del manual que abre cada sala: la de su variante. */
const modoReglas = (juego, o) => juego === "cacho" ? (Number(o.sicil) || 0)
  : juego === "catan" ? (o.exp === "mar" ? "mar" : "base")
  : juego === "yemas" ? (o.variante || "todos") : o.modo;

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
  enCurso: [],            // partidas empezadas que se pueden mirar
  popular: leePopular(),  // juego → cuánto se ha jugado (ordena el catálogo)
  tablas: {}              // ranks/<juego>/<uid>, leído con la popularidad
};

/* El orden del catálogo es el de la última visita mientras llega el de
   hoy: si no, las tarjetas saltarían de sitio medio segundo después de
   pintarse, justo cuando uno va a hacer clic. */
function leePopular() {
  try { return JSON.parse(localStorage.getItem("jg.popular") || "{}") || {}; } catch (e) { return {}; }
}
/* Los de un jugador, con su clave de popularidad. Cuentan como juegos en
   la marquesina: el «18» fijo de antes se quedó atrás con cada club. */
const CLUBES = ["club-minas", "club-snake", "club-tetris", "club-sortem", "club-bbtan", "club-sopa", "club-electro", "club-frontera"];
function ordenPopular(claves) {
  const n = state.popular, pos = Object.fromEntries(claves.map((k, i) => [k, i]));
  return claves.slice().sort((a, b) => (n[b] || 0) - (n[a] || 0) || pos[a] - pos[b]);
}

let offSalas = null, offMias = null, offPartida = null, offReloj = null, offEnCurso = null;
let offChat = null, chatMsgs = [], chatFirma = "";
let jugadasVistas = -1;   // cuántas jugadas tenía el registro la última vez
let ultimoCambio = 0;     // cuándo creció el registro por última vez (reloj local)
let relojVotos = 0;       // repinta los botones de votar, que dependen del tiempo
let enCursoToque = 0;     // cuándo se anunció la partida en «En juego ahora»
let cancelarLimpieza = null;
let modulo = null, pidMontado = "", mirandoMontado = false;
let vistaPintada = "";
let ranks = null;
let logrosVista = null;
let paginaPerfil = null;
let monedasVista = null;
let prodropVista = null;
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
      if (logrosVista) logrosVista.refresca();
      if (paginaPerfil) paginaPerfil.refresca();
      if (monedasVista) monedasVista.refresca();
      if (prodropVista) prodropVista.refresca();
      const mini = miniAbierta();
      if (mini && mini.uid === uid) mini.refresca();
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
const fotoBreve = f => { const s = fotoSana(f, false); return s.length <= 400 ? s : ""; };

/* ---------- el perfil público ----------
   La tarjeta y la página leen lo mismo que la pestaña de logros (ranks,
   soloRanks y logros: `fb.watchLogros`), con una sola escucha para toda
   la sesión que se abre la primera vez que alguien toca una foto. Firebase
   junta las escuchas del mismo nodo, así que la pestaña de logros no lo
   baja dos veces. */
let datosP = null, offDatosP = null;
const oyentesP = new Set();
function datosPerfil(cb) {
  oyentesP.add(cb);
  if (!offDatosP) offDatosP = fb.watchLogros(d => {
    /* Todos los nodos que lee `watchLogros` (las monedas los necesitan
       todos: el mercado y las partidas del club también mueven el saldo),
       en un objeto nuevo por llegada, que es lo que invalida las memorias
       de juegos/monedas.js. */
    datosP = Object.assign({}, d, { completo: !!d.completo });
    for (const f of [...oyentesP]) f(datosP);
  });
  else if (datosP) setTimeout(() => { if (oyentesP.has(cb)) cb(datosP); }, 0);
  return () => oyentesP.delete(cb);
}
const ctxPerfil = {
  yo: () => state.user && state.user.uid,
  perfil: uid => perfilDe(uid),
  colorDe: uid => colorForUid(uid || ""),
  datos: datosPerfil,
  ir: h => ir(h),
  editar: pestana => editaPerfil(pestana),
  propio: () => state.base ? { nombre: state.base.name, foto: state.base.photo, color: state.base.color } : null
};
/* Cualquier foto o nombre con `data-perfil` abre la tarjeta; tocar la
   misma otra vez la cierra. */
function alTocarPerfil(e) {
  const el = e.target.closest && e.target.closest("[data-perfil]");
  if (!el || !state.user || el.closest(".jg-mini, .jg-modal")) return;
  const uid = el.getAttribute("data-perfil");
  if (!uid) return;
  e.preventDefault();
  const m = miniAbierta();
  if (m && m.uid === uid) { cierraMini(); return; }
  const pista = uid === state.user.uid ? ctxPerfil.propio()
    : { nombre: el.getAttribute("data-nombre") || "", foto: el.getAttribute("data-foto") || "" };
  abreMini(uid, el, ctxPerfil, pista);
  suena("clic");
}

/* El editor necesita saber qué marcos tiene ganados: espera a los datos
   (como mucho cuatro segundos; sin ellos, los que se ganan salen cerrados). */
async function editaPerfil(pestana) {
  const b = state.base;
  if (!b) return;
  const d = datosP || await new Promise(ok => {
    let off = null;
    const t = setTimeout(() => { if (off) off(); ok(null); }, 4000);
    off = datosPerfil(x => { clearTimeout(t); setTimeout(() => off(), 0); ok(x); });
  });
  abrePerfil({
    base: { nombre: b.name, foto: b.photo, color: b.color },
    perfil: perfiles.get(b.uid) || null,
    est: d ? estadisticas(b.uid, d) : null,
    uid: b.uid, colorDe: colorForUid, pestana,
    onGuardar: async p => {
      /* El editor no conoce las cartas exhibidas (se eligen en PRODROP):
         sin esto, guardar el perfil las borraría. */
      const cartas = (perfiles.get(b.uid) || {}).cartas;
      if (cartas) p = Object.assign({}, p, { cartas });
      await fb.guardarPerfil(b.uid, p);
      /* La escucha traerá lo mismo en un instante; adelantarlo aquí
         evita que el botón se cierre sobre el avatar de antes. */
      perfiles.set(b.uid, Object.assign({}, p));
      aplicaPropio();
      if (state.estado) vistePerfiles(state.estado);
      if (ranks) ranks.refresca();
      if (paginaPerfil) paginaPerfil.refresca();
      render();
      suena("clic");
    }
  });
}

function pintaUsuario() {
  const u = state.user;
  $("userName").textContent = u ? u.name : "";
  const av = $("userAvatar");
  if (!u) { av.textContent = ""; av.removeAttribute("data-perfil"); return; }
  av.setAttribute("data-perfil", u.uid);
  av.title = "Tu perfil";
  if (u.photo) av.innerHTML = `<img src="${escapeHtml(u.photo)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover">`;
  else { av.textContent = (u.name || "?").charAt(0).toUpperCase(); av.style.background = u.color; }
}

function mostrar(dentro) {
  $("viewLogin").style.display = dentro ? "none" : "grid";
  $("viewMain").style.display = dentro ? "" : "none";
  for (const id of ["userName", "userAvatar", "btnPerfil", "btnLogout", "userMonedas"]) $(id).style.display = dentro ? "" : "none";
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
     antes de `terminar`. En el Presidente pasa lo mismo con `llave`: la
     de la ronda que se cortó al votar acabar se revela con la partida
     ya acabada para el reductor, antes de escribir `fin`. */
  if (state.partida && state.partida.fin) return false;
  if (state.estado && state.estado.fase === "fin" && jugada.t !== "s" && jugada.t !== "llave") return false;
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
      if (await fb.jugar(pid, n, jugada)) { proximo = n + 1; tocaSala(pid); return true; }
    }
    throw new Error("No se pudo escribir la jugada: la partida va demasiado rápida.");
  } finally { enVuelo.delete(tarea); suelta(); }
}

/* La sala sigue viva: se apunta la hora de la jugada (`toque`), como
   mucho cada diez minutos por pestaña. Con seis horas sin toque la sala
   se cierra sola (ver `salaInactiva`); diez minutos de holgura no
   cambian nada y ahorran una escritura por jugada. */
let ultimoToque = 0;
function tocaSala(pid) {
  if (Date.now() - ultimoToque < 10 * 60e3) return;
  ultimoToque = Date.now();
  fb.tocaSala(pid).catch(() => { ultimoToque = 0; });
}
/* Cerrar una sala dormida, una vez por sala y sesión. Sin las reglas
   nuevas publicadas solo lo consigue alguien que juega en ella. */
const cerrandoInactivas = new Set();
function cierraInactiva(pid) {
  if (cerrandoInactivas.has(pid)) return;
  cerrandoInactivas.add(pid);
  fb.cierraInactiva(pid).catch(e => console.warn("[juegos] no se pudo cerrar la sala dormida", e));
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
  if (p.fin.motivo === "inactiva") return;          // se cerró sola: no se jugó
  anotada = state.pid;
  /* Yemas zombis no va a la tabla de Yemas: es cooperativo y lo que
     clasifica es la ronda a la que llegó la sala, por mapa, como un
     récord del club (`yemas-zombis-<mapa>`). */
  if (p.juego === "yemas" && varianteYemas(p) === "zombis") {
    const ronda = (reducir(p) || {}).ronda || 0;
    if (ronda < 1) return;
    const tiempo = Math.min(604800000, Math.max(1, Math.round((+p.fin.at || 0) - (+p.at || 0)) || 1));
    try {
      await guardaConPodio(`yemas-zombis-${mapaYemas(p)}`, u.uid, { nombre: u.name, puntos: ronda, tiempo, partida: state.pid }, false);
      marcaDia();
    } catch (e) { anotada = ""; console.warn("[juegos] no se pudo apuntar la ronda de zombis", e); }
    return;
  }
  const g = p.fin.ganador || "";
  const res = !g ? "empate" : (ganoEn(p, g, u.uid) ? "ganada" : "perdida");
  try {
    const previa = await fb.leerRank(p.juego, u.uid);
    const fila = acumula(previa, res, state.pid, { nombre: u.name, foto: fotoBreve(u.photo) });
    if (fila) {
      await fb.guardarRank(p.juego, u.uid, fila);
      const antes = new Set(deFila(previa));
      for (const id of deFila(fila)) if (!antes.has(id)) celebra(p.juego, id);
      marcaDia();
    }
  } catch (e) {
    anotada = "";
    console.warn("[juegos] no se pudo apuntar la partida", e);
  }
}

/* ---------- monedas ----------
   El saldo se calcula (juegos/monedas.js) de las mismas cuatro lecturas
   que usan el perfil y los logros, con la escucha compartida de
   `datosPerfil`: el vestíbulo pinta el top y la cabecera tu saldo. Lo
   único que se escribe es el día jugado, una vez al día, al terminar una
   partida de sala o del club; la regla de `diario` comprueba el resto. */
let offMonedas = null, datosMonedas = null, diaMarcado = -1;
function pintaMonedas() {
  const u = state.user, d = datosMonedas;
  const chip = $("userMonedas");
  if (chip) {
    /* La racha va pegada al saldo: 🔥 encendida si hoy ya contó, apagada
       (y titilando) si todavía falta jugar hoy para no perderla. */
    const di = u && d ? (d.diario || {})[u.uid] : null, hoy = diaMonedas(), r = rachaHoy(di, hoy), ya = !!(di && di.dia === hoy);
    chip.innerHTML = `${MONEDA} ${u && d && d.completo ? formatoMonedas(monedasDe(u.uid, d).saldo) : "…"}` +
      (r ? `<span class="jg-racha-chip${ya ? "" : " falta"}" title="${r} ${r === 1 ? "día seguido" : "días seguidos"}${ya ? "" : " · juega hoy para no perder la racha"}">🔥${r}</span>` : "");
  }
  const caja = $("vesMonedas");
  if (caja && u && d) caja.innerHTML = topHtml(d, u.uid, perfilDe, colorForUid);
  const drops = $("vesDrops");
  if (drops && u && d && d.completo) drops.innerHTML = dropsHtml(d);
}
/* El nombre que alguien dejó en sus filas, si no tiene perfil. */
function nombreEnDatos(uid, d) {
  for (const t of [...Object.values(d.ranks || {}), ...Object.values(d.solo || {})]) if (t && t[uid] && t[uid].nombre) return t[uid].nombre;
  return "";
}
/* Los últimos drops de PRODROP, en orden de salida (la más reciente
   primero): solo épicas y legendarias, con quién las sacó y cuándo. */
const haceCuanto = at => {
  const m = Math.max(0, Math.round((fb.ahora() - at) / 60000));
  return m < 1 ? "recién" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};
function dropsHtml(d) {
  const l = mejoresDrops(d, 24);
  if (!l.length) {
    const n = cifrasCartas(d);
    return `<p class="jg-nada">Nadie ha sacado todavía una épica. ${n.sobres ? `Van ${n.sobres} sobres abiertos.` : "Estrena PRODROP."} <a href="#cartas">Abrir un sobre →</a></p>`;
  }
  return l.map(c => {
    const q = quien(c.uid, perfilDe(c.uid), null, { nombre: nombreEnDatos(c.uid, d) }, colorForUid);
    return `<div class="jg-drop">${miniCarta(c)}<span class="jg-drop-quien" data-perfil="${escapeHtml(c.uid)}" data-nombre="${escapeHtml(q.nombre)}">${avatarMarco(q.foto, q.nombre, q.color, "anillo", 18, c.uid)}<b>${escapeHtml(q.nombre)}</b></span><small class="jg-drop-cuando">${c.rr ? "♻ re-roll · " : ""}${haceCuanto(c.at)}</small></div>`;
  }).join("");
}
async function marcaDia() {
  const u = state.user, hoy = diaMonedas();
  if (!u || diaMarcado === hoy) return;
  diaMarcado = hoy;
  try {
    const reg = registraDia(await fb.leerDiario(u.uid), hoy);
    if (reg) {
      await fb.apuntaDiario(u.uid, reg);
      avisaMonedas("🔥", reg.racha > 1 ? `¡${reg.racha} días seguidos jugando!` : "¡Primer día de tu racha!",
        `+${pagoDia(reg.racha)} monedas hoy · mañana +${pagoDia(reg.racha + 1)} si vuelves`, pagoDia(reg.racha), "racha");
      pintaMonedas();
    }
  } catch (e) {
    diaMarcado = -1;   // sin reglas publicadas, o sin red: se reintenta en la próxima partida
    console.warn("[juegos] no se pudo apuntar el día", e);
  }
}

/* Un aviso de monedas, en la misma cola que los logros para que no se
   pisen: la racha del día, una partida del club, un podio. */
function avisaMonedas(icono, titulo, detalle, monto, tipo) {
  toastCola = toastCola.then(() => new Promise(fin => {
    const t = document.createElement("div");
    t.className = "jg-logro-toast jg-mo-toast" + (tipo ? " " + tipo : "");
    t.setAttribute("role", "status");
    t.innerHTML = `<span class="i">${icono}</span><span><small>${monto ? `+${formatoMonedas(monto)} ${MONEDA}` : ""}</small><b>${escapeHtml(titulo)}</b><em>${escapeHtml(detalle)}</em></span>`;
    t.onclick = () => ir("#monedas");
    document.body.appendChild(t);
    suena("entra");
    setTimeout(() => { t.classList.add("sale"); setTimeout(() => { t.remove(); fin(); }, 400); }, tipo === "club" ? 2400 : 4200);
  }));
}

/* Cada partida del club que termina con resultado paga PAGO_CLUB, hasta
   TOPE_CLUB_DIA por juego al día (la regla de `clubJugadas` comprueba lo
   mismo que `registraJugadaClub`). Se encadenan para que dos resultados
   seguidos no lean el mismo contador. */
let jugadasClubCola = Promise.resolve();
function marcaJugadaClub(juego) {
  const u = state.user;
  if (!u) return;
  jugadasClubCola = jugadasClubCola.then(async () => {
    try {
      const reg = registraJugadaClub(await fb.leerJugadasClub(u.uid, juego), diaMonedas());
      if (!reg) return;
      await fb.apuntaJugadaClub(u.uid, juego, reg);
      avisaMonedas("🕹️", "Partida del club", `${reg.hoy} de ${TOPE_CLUB_DIA} que pagan hoy en este juego`, PAGO_CLUB, "club");
    } catch (e) { console.warn("[juegos] no se pudo apuntar la partida del club", e); }
  });
}

/* ---------- logros ----------
   Los de partida se miran en cada repintado (el `hist` es una ventana
   corta: esperar al final perdería lo que pasó al principio) y se
   escriben una sola vez; las reglas no dejan reescribir ni borrar uno.
   Un id que no se pudo escribir se queda en el conjunto igual, para no
   reintentarlo en cada repintado. */
const logrosMios = new Map();   // juego -> Promise<Set(id)>
function misLogros(juego, uid) {
  const k = juego + "/" + uid;
  if (!logrosMios.has(k)) logrosMios.set(k, fb.leerMisLogros(juego, uid).then(d => new Set(Object.keys(d))));
  return logrosMios.get(k);
}
async function revisaLogros(p, est) {
  const u = state.user;
  if (!p || !est || !u || !(p.jugadores || {})[u.uid] || !LOGROS[p.juego]) return;
  const nuevos = detecta(p, est, u.uid);
  if (!nuevos.length) return;
  const ya = await misLogros(p.juego, u.uid);
  for (const id of nuevos) {
    if (ya.has(id)) continue;
    ya.add(id);
    fb.otorgarLogro(p.juego, u.uid, id).then(() => celebra(p.juego, id),
      e => console.warn("[juegos] no se pudo guardar el logro", id, e));
  }
}
let toastCola = Promise.resolve();
function celebra(juego, id) {
  const x = (LOGROS[juego] || []).find(l => l.id === id);
  if (!x) return;
  toastCola = toastCola.then(() => new Promise(fin => {
    const t = document.createElement("div");
    t.className = "jg-logro-toast";
    t.setAttribute("role", "status");
    t.innerHTML = `<span class="i">${x.i}</span><span><small>🏆 ¡Logro desbloqueado! · +${valorLogro(juego, id)} ${MONEDA}</small><b>${escapeHtml(x.n)}</b><em>${escapeHtml(x.d)}</em></span>`;
    t.onclick = () => ir("#logros");
    document.body.appendChild(t);
    suena("entra");
    setTimeout(() => { t.classList.add("sale"); setTimeout(() => { t.remove(); fin(); }, 400); }, 3800);
  }));
}

/* ---------- rutas ----------
   El hash es la ruta: vacío es el vestíbulo, `#ranks` la tabla y
   `#p/<pid>` una partida. Así una partida se comparte pegando la
   barra de direcciones. */
function leerRuta() {
  const h = (location.hash || "").replace(/^#/, "");
  if (/^solo\/(minas|snake|tetris|sortem|bbtan|sopa|electro|frontera)$/.test(h)) return { vista: "solo-" + h.slice(5), pid: "" };
  if (h === "ranks") return { vista: "ranks", pid: "" };
  if (h === "logros") return { vista: "logros", pid: "" };
  if (h === "monedas") return { vista: "monedas", pid: "" };
  if (h === "cartas") return { vista: "cartas", pid: "" };
  const pf = h.match(/^perfil\/([-\w]+)$/);
  if (pf) return { vista: "perfil", pid: "", uid: pf[1] };
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
  cierraMini();
  if (r.vista === state.vista && r.pid === state.pid && (r.uid || "") === (state.perfilUid || "")) return;
  state.vista = r.vista;
  state.pid = r.pid;
  state.perfilUid = r.uid || "";
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
    revisaMias();
  });
  /* Sin reglas publicadas este nodo falla; no es motivo para tapar el
     vestíbulo con el aviso: la lista simplemente sale vacía. */
  fb.leerPopularidad().then(({ n, ranks }) => {
    state.tablas = ranks;
    const cambio = JSON.stringify(n) !== JSON.stringify(state.popular);
    state.popular = n;
    try { localStorage.setItem("jg.popular", JSON.stringify(n)); } catch (e) {}
    if (state.vista === "vestibulo") { if (cambio) vesFirma = ""; render(); }
  }).catch(() => {});
  offEnCurso = fb.watchEnCurso(lista => {
    state.enCurso = lista || [];
    if (state.vista === "vestibulo") render();
  });
}

/* «Tus partidas» se limpia sola: una sala a la que entraste hace más de
   seis horas se mira (solo sus datos de cabecera, `fb.resumenSala`), y
   si ya no existe, se cerró, o lleva seis horas sin una jugada, sale de
   la lista. Si seguía abierta pero dormida, de paso se cierra. Una vez
   por sala y sesión, de una en una. */
const miasRevisadas = new Set();
let revisandoMias = false;
async function revisaMias() {
  if (revisandoMias || !state.user) return;
  revisandoMias = true;
  try {
    for (const m of state.mias.slice()) {
      if (miasRevisadas.has(m.id) || fb.ahora() - (m.at || 0) < INACTIVA_MS) continue;
      miasRevisadas.add(m.id);
      const r = await fb.resumenSala(m.id).catch(() => undefined);
      if (r === undefined) continue;
      const ahora = fb.ahora();
      const muerta = !r || (r.fin ? ahora - ultimaActividad(r) > INACTIVA_MS : salaInactiva(r, ahora));
      if (!muerta) continue;
      if (r && !r.fin) cierraInactiva(m.id);
      if (state.pid !== m.id) await fb.olvidarMia(m.id, state.user.uid).catch(() => {});
    }
  } finally { revisandoMias = false; }
}

function engancharPartida(pid) {
  soltarPartida();
  proximo = 0; anotada = ""; finEnviado = ""; finCerrado = ""; dentroVistos = -1; tocaba = false;
  finVivo = ""; finDesde = 0; finSonado = ""; clearTimeout(finReloj);
  jugadasVistas = -1; ultimoCambio = Date.now(); enCursoToque = 0; ultimoToque = 0;
  chatMsgs = []; chatFirma = "";
  offPartida = fb.watchPartida(pid, (p, err) => {
    state.cargando = false;
    if (err) { state.fallo = err; state.partida = null; render(); return; }
    state.partida = p;
    state.estado = p ? reducir(p) : null;
    /* Una partida que el tablero ya da por acabada no se cierra como
       dormida: la cierra el módulo con su ganador. */
    if (p && salaInactiva(p, fb.ahora()) && !(state.estado && state.estado.fase === "fin")) cierraInactiva(pid);
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
      revisaLogros(p, state.estado);
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
    anunciaSala(salaParaDiscord(pid, juego, extra, u));
    ir("#p/" + pid);
  } catch (e) { avisa(e, juego); }
}

/* Lo que el aviso de Discord cuenta de la sala. Solo desde aquí: la
   revancha también crea una partida, pero es para los mismos que ya
   jugaban y no hace falta llamar a nadie. Las opciones se traducen con
   la misma tabla que pinta los desplegables, así que el mensaje dice
   «No Mercy» y no «nomercy». */
function salaParaDiscord(pid, juego, extra, u) {
  const j = JUEGOS[juego] || {};
  const opciones = (OPCIONES[juego] || []).filter(o => o.clave !== "cupo").map(o => {
    const v = extra && extra[o.clave] !== undefined ? extra[o.clave] : (o.por || o.valores[0].v);
    const hit = o.valores.find(x => x.v === v);
    return hit ? [o.etiqueta, hit.t] : null;
  }).filter(Boolean);
  const base = location.origin + location.pathname;
  return {
    pid, juego, nombre: j.nombre, lema: j.lema, color: j.color, icono: ICONO[juego],
    anfitrion: u.name, foto: fotoBreve(u.photo),
    cupo: cupoDe(Object.assign({ juego }, extra)), opciones,
    enlace: base + "#p/" + pid, vestibulo: base
  };
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
  const clave = state.vista === "perfil" ? "perfil:" + state.perfilUid : state.vista;
  if (clave !== vistaPintada) {
    if (individual) { individual.destruir(); individual = null; }
    if (vistaPintada === "ranks" && ranks) { ranks.destruir(); ranks = null; }
    if (vistaPintada === "logros" && logrosVista) { logrosVista.destruir(); logrosVista = null; }
    if (vistaPintada === "monedas" && monedasVista) { monedasVista.destruir(); monedasVista = null; }
    if (prodropVista) { prodropVista.destruir(); prodropVista = null; }
    if (paginaPerfil) { paginaPerfil.destruir(); paginaPerfil = null; }
    armazon();
    vistaPintada = clave;
  }
  if (state.vista === "vestibulo") pintaVestibulo();
  else if (state.vista === "partida") pintaPartida();
  pintaTabs();
}

function pintaTabs() {
  $("tabJugar").classList.toggle("on", !["ranks", "logros", "perfil", "monedas", "cartas"].includes(state.vista));
  $("tabCartas").classList.toggle("on", state.vista === "cartas");
  $("tabRanks").classList.toggle("on", state.vista === "ranks");
  $("tabLogros").classList.toggle("on", state.vista === "logros");
  $("tabMonedas").classList.toggle("on", state.vista === "monedas");
}

/* Guarda un récord de club y, si sube a su dueño al podio de la
   modalidad, lo anuncia en Discord. La tabla se lee *antes* de escribir
   para saber de qué puesto venía; la de después no hace falta leerla,
   es la misma con la fila nueva. Solo se anuncia si la transacción
   escribió de verdad (otra pestaña pudo guardar una marca mejor) y si
   el puesto mejoró: repetir el segundo lugar con mejor tiempo no es
   noticia. El aviso nunca estorba al guardado. */
async function guardaConPodio(categoria, uid, dato, anunciar = true) {
  const antes = await fb.leerSolo(categoria).catch(() => null);
  const res = await fb.guardarSolo(categoria, uid, dato);
  if (!antes || !res || !res.committed) return res;
  const filas = conRecord(antes, uid, dato);
  const puesto = puestoSolo(filas, uid), previo = puestoSolo(antes, uid);
  if (puesto >= 1 && puesto <= 3 && (!previo || puesto < previo)) {
    const sitio = antes.slice().sort(ordenSolo)[puesto - 1];
    const u = state.user || {};
    /* Quitarle el puesto a otra persona paga (500, 250 o 100), cada vez;
       llegar a un puesto que nadie tenía no. La regla de `podios` pide que
       el récord que se acaba de guardar sea el que nombra esta partida. */
    if (sitio && sitio.uid && sitio.uid !== uid && dato.partida && /^[-_A-Za-z0-9]{6,80}$/.test(dato.partida)) {
      fb.cobraPodio(uid, dato.partida, { c: categoria, p: puesto, q: sitio.uid }).then(() =>
        avisaMonedas(["", "👑", "🥈", "🥉"][puesto], `¡Le quitaste el puesto ${puesto} a ${sitio.nombre || "alguien"}!`, categoria.startsWith("yemas-zombis-") ? `Yemas zombis · ${YM_MAPAS[categoria.slice(13)] || categoria.slice(13)}` : nombreCategoria(categoria), PODIO[puesto], "podio"),
        e => console.warn("[juegos] no se pudo cobrar el podio", e));
    }
    if (anunciar) {
      const juego = categoria.split("-")[1];
      anunciaPodio({
        categoria, uid, nombre: dato.nombre || u.name, foto: fotoBreve(u.photo),
        puesto, antes: previo, filas,
        desbancado: sitio && sitio.uid !== uid ? sitio.nombre || "" : "",
        enlace: location.origin + location.pathname + "#solo/" + juego
      });
    }
  }
  return res;
}

function armazon() {
  const h = $("pantalla");
  if (state.vista !== "partida") ponInmersivo(false);
  /* sortEm es solo el juego: el iframe ocupa la ventana, sin la cabecera
     del sitio ni la barra de juegos individuales. */
  document.documentElement.classList.toggle("jg-sortem", state.vista === "solo-sortem");
  document.documentElement.classList.toggle("jg-prodrop", state.vista === "cartas");
  h.closest("main").classList.toggle("jg-ancho", state.vista === "partida" || state.vista.startsWith("solo-"));
  if (state.vista === "solo-frontera") {
    /* La Frontera Batalla no es un iframe del club: es la pantalla de
       Pokémon en modo local, con sus propias rachas. */
    h.innerHTML = "";
    individual = crearFrontera({ usuario: state.user, guardar: guardaConPodio, watch: fb.watchSolo, volver: () => ir(""),
      partida: { leer: () => fb.leerPartidaClub(state.user.uid, "frontera"), guardar: (d, at) => fb.guardarPartidaClub(state.user.uid, "frontera", d, at) },
      alResultado: lista => { marcaDia(); marcaJugadaClub("frontera");
        for (const { d, previa } of lista || []) {
          const antes = new Set(previa ? deMarca("frontera", Object.assign({ categoria: d.categoria }, previa)) : []);
          for (const id of deMarca("frontera", d)) if (!antes.has(id)) celebra("frontera", id);
        } } });
    individual.montar(h);
    return;
  }
  if (state.vista.startsWith("solo-")) {
    const clave = state.vista.slice(5) === "tetris" ? "tetrisclub" : state.vista.slice(5);
    individual = crearSolo({juego:state.vista.slice(5),usuario:state.user,guardar:guardaConPodio,watch:fb.watchSolo,volver:()=>ir(""),
      partida:{leer:()=>fb.leerPartidaClub(state.user.uid,state.vista.slice(5)),guardar:(d,at)=>fb.guardarPartidaClub(state.user.uid,state.vista.slice(5),d,at)},
      /* Un logro individual sale de la marca: se celebra el que esta
         partida da y la mejor marca guardada no daba ya. */
      alResultado: (d, previa) => { marcaDia(); marcaJugadaClub(clave); const antes = new Set(previa ? deMarca(clave, Object.assign({ categoria: d.categoria }, previa)) : []);
        for (const id of deMarca(clave, d)) if (!antes.has(id)) celebra(clave, id); }});
    individual.montar(h);
    const juego = state.vista.slice(5), barra = document.createElement("div");
    barra.className = "jg-solo-barra";
    barra.innerHTML = `<a class="btn2" href="#">← Juegos</a><div class="jg-solo-titulo"><small>UN JUGADOR · RANKING POR MODALIDAD</small><strong>${juego === "minas" ? "Buscaminas" : juego === "tetris" ? "Tetris" : juego === "sortem" ? "sortEm" : juego === "bbtan" ? "BBTAN" : juego === "sopa" ? "Sopa de letras" : juego === "electro" ? "Electrodle" : "Snake"}</strong></div><nav aria-label="Juegos individuales"><a class="btn2${juego === "minas" ? " on" : ""}" href="#solo/minas">Buscaminas</a><a class="btn2${juego === "snake" ? " on" : ""}" href="#solo/snake">Snake</a><a class="btn2${juego === "tetris" ? " on" : ""}" href="#solo/tetris">Tetris</a><a class="btn2${juego === "sortem" ? " on" : ""}" href="#solo/sortem">sortEm</a><a class="btn2${juego === "bbtan" ? " on" : ""}" href="#solo/bbtan">BBTAN</a><a class="btn2${juego === "sopa" ? " on" : ""}" href="#solo/sopa">Sopa</a><a class="btn2${juego === "electro" ? " on" : ""}" href="#solo/electro">Electrodle</a><a class="btn2" href="#solo/frontera">Frontera</a><button class="btn2" type="button">📖 Reglas</button></nav>`;
    barra.querySelector("button").onclick = () => abreReglas(juego === "tetris" ? "tetrisclub" : juego);
    h.insertBefore(barra, h.firstChild);
    return;
  }
  if (state.vista === "perfil") {
    h.innerHTML = "";
    paginaPerfil = crearPaginaPerfil({ uid: state.perfilUid, ctx: ctxPerfil });
    paginaPerfil.montar(h);
    return;
  }
  if (state.vista === "logros") {
    h.innerHTML = "";
    logrosVista = crearLogros({ uid: state.user.uid, watchLogros: fb.watchLogros, perfil: perfilDe, icono: ICONO_TODOS,
      orden: () => ordenPopular([...Object.keys(JUEGOS), ...CLUBES])
        .map(k => ({ "club-minas": "minas", "club-snake": "snake", "club-tetris": "tetrisclub", "club-sortem": "sortem", "club-bbtan": "bbtan", "club-sopa": "sopa", "club-electro": "electro", "club-frontera": "frontera" })[k] || k) });
    logrosVista.montar(h);
    return;
  }
  if (state.vista === "cartas") {
    h.innerHTML = "";
    prodropVista = crearProdrop({ usuario: state.user, datos: datosPerfil, perfil: perfilDe, fb, volver: () => ir(""),
      quien: u => quien(u, perfilDe(u), null, { nombre: nombreEnDatos(u, datosP || {}) }, colorForUid) });
    prodropVista.montar(h);
    return;
  }
  if (state.vista === "monedas") {
    h.innerHTML = "";
    monedasVista = crearMonedas({ uid: state.user.uid, datos: datosPerfil, perfil: perfilDe, colorDe: colorForUid });
    monedasVista.montar(h);
    return;
  }
  if (state.vista === "ranks") {
    h.innerHTML = "";
    ranks = crearRanks({ uid: state.user.uid, watchRanks: fb.watchRanks, watchSolo: fb.watchSolo, watchTodos: fb.watchRanksTodos,
      perfil: perfilDe, icono: ICONO_TODOS, orden: () => ordenPopular(Object.keys(JUEGOS)) });
    ranks.montar(h);
    return;
  }
  if (state.vista === "partida") {
    h.innerHTML = `
      <div class="jg-cab">
        <button class="btn2" id="jgVolver" title="Volver al vestíbulo">←<span class="jg-cab-txt"> Vestíbulo</span></button>
        <b id="jgTitulo"></b>
        <span class="grow"></span>
        <span id="jgQuienes" class="jg-quienes"></span>
        <button class="btn2" id="jgReglas" title="Cómo se juega">📖<span class="jg-cab-txt"> Reglas</span></button>
        <button class="btn2" id="jgAbandonar" style="display:none">Abandonar</button>
        <button class="btn2 jg-inm-btn" id="jgInm" type="button"></button>
      </div>
      <div class="jg-partida-layout"><div class="jg-partida-juego">
      <div id="jgMirando"></div>
      <div id="jgInvita"></div>
      <div id="jgHost"></div>
      <div id="jgRevancha" aria-live="polite"></div>
      <div id="jgFin"></div>
      </div><section class="jg-chat" id="jgChat" aria-label="Chat de la partida">
        <header><h2>Chat de la sala</h2><small>lo leen jugadores y espectadores</small></header>
        <div class="jg-chat-lista" id="jgChatLista" aria-live="polite"></div>
        <button class="jg-chat-abre" id="jgChatAbre" type="button" title="Escribir en el chat (Intro)" aria-label="Escribir en el chat">💬</button>
        <form class="jg-chat-form" id="jgChatForm" autocomplete="off">
          <input class="inp" id="jgChatTxt" maxlength="${fb.CHAT_LARGO}" placeholder="Escribe algo…">
          <button class="btn" id="jgChatBtn">Enviar</button>
        </form>
      </section></div>`;
    $("jgVolver").onclick = salirDeLaPartida;
    $("jgAbandonar").onclick = abandonar;
    /* Las reglas se abren en la versión de esta sala: quien entra a un
       No Mercy no tiene por qué leer primero las del clásico. */
    $("jgReglas").onclick = () => {
      const p = state.partida;
      if (!p || !tieneReglas(p.juego)) return;
      abreReglas(p.juego, { modo: modoReglas(p.juego, p), nombre: JUEGOS[p.juego].nombre });
    };
    $("jgChatForm").onsubmit = async ev => {
      ev.preventDefault();
      const campo = $("jgChatTxt"), texto = campo.value.trim();
      if (!texto || !state.pid) return;
      campo.value = "";
      const ok = await fb.mandaChat(state.pid, { uid: state.user.uid, nombre: state.user.name }, texto);
      /* Lo que no salió se devuelve al campo: perder una frase escrita
         porque las reglas no están publicadas es peor que no mandarla. */
      if (!ok && !campo.value) { campo.value = texto; avisa(Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" })); }
      /* En pantalla completa se escribe y se vuelve al juego, como en
         cualquier juego con chat: el campo abierto taparía el tablero. */
      else if (ok && enInmersivo()) chatAbierto(false);
    };
    /* Un juego que sabe ponerse él solo a pantalla completa (Yemas pone
       su marco, y así no queda nada de la página alrededor) lo hace; el
       resto usa el modo inmersivo de la sala. */
    $("jgInm").onclick = () => {
      if (!enInmersivo() && modulo && modulo.pantallaCompleta && modulo.pantallaCompleta()) return;
      ponInmersivo(!enInmersivo());
    };
    $("jgChatAbre").onclick = () => chatAbierto(true);
    /* El campo se cierra solo al perder el foco vacío; con algo escrito
       se queda, que es texto que alguien quería mandar. */
    $("jgChat").addEventListener("focusout", () => setTimeout(() => {
      const c = $("jgChat");
      if (c && enInmersivo() && !c.contains(document.activeElement) && !$("jgChatTxt").value) chatAbierto(false);
    }, 120));
    pintaInmersivo();
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
      ${novedadesHtml()}
      <section class="jg-marquesina">
        <div class="jg-mq-texto">
          <span class="jg-eyebrow">LABORATORIO · SALÓN DE JUEGOS</span>
          <h2>¿A qué jugamos?</h2>
          <p>Elige un juego, abre la sala y pasa el enlace. O entra en una que ya esté esperando.</p>
          <div class="jg-mq-cifras">
            <span><b id="vesNSalas">0</b>salas esperando</span>
            <span><b id="vesNMias">0</b>partidas tuyas</span>
            <span><b>${Object.keys(JUEGOS).length + CLUBES.length}</b>juegos</span>
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
        <section class="jg-lado-caja jg-mo-ves">
          <header>${MONEDA}<h2>Top monedas</h2></header>
          <div id="vesMonedas"><p class="jg-nada">Contando monedas…</p></div>
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
        <div class="sp-entradas"><a href="#solo/minas" class="sp-entrada sp-e-minas"><small>SINGLEPLAYER / ESTRATEGIA</small><strong>MINA CLUB <span>✦</span></strong><p>Piensa, explora y florece. Tres dificultades y música progresiva.</p><b>Explorar →</b></a><a href="#solo/snake" class="sp-entrada sp-e-snake"><small>SINGLEPLAYER / REFLEJOS</small><strong>SNAKE CLUB <span>ϟ</span></strong><p>Siete modos —contrarreloj, espejo, laberinto…— y cuatro tamaños de mapa.</p><b>Entrar al circuito →</b></a><a href="#solo/tetris" class="sp-entrada sp-e-tetris"><small>SINGLEPLAYER / REFLEJOS</small><strong>TETRIS CLUB <span>▤</span></strong><p>Maratón, Sprint de 40 líneas y Ultra de dos minutos.</p><b>Apilar →</b></a><a href="#solo/sortem" class="sp-entrada sp-e-sortem"><small>PLATANUS HACK 25 / PUZZLE</small><strong>sortEm <span>↔</span></strong><p>Mueve y fusiona los bloques hasta ordenar del 1 al 10 o al 20. Ranking por tiempo.</p><b>Ordenar →</b></a><a href="#solo/bbtan" class="sp-entrada sp-e-bbtan"><small>SINGLEPLAYER / ARCADE</small><strong>BBTAN <span>●</span></strong><p>Apunta, rebota y rompe los bloques antes de que lleguen abajo. Ranking por ronda máxima.</p><b>Lanzar →</b></a><a href="#solo/sopa" class="sp-entrada sp-e-sopa"><small>SINGLEPLAYER / PALABRAS</small><strong>SOPA DE LETRAS <span>🔤</span></strong><p>Una sopa diaria igual para todos, con racha de días seguidos, y sopas libres por temática.</p><b>Buscar →</b></a><a href="#solo/electro" class="sp-entrada sp-e-electro"><small>SINGLEPLAYER / DIARIO · NUEVO</small><strong>ELECTRODLE <span>⚡</span></strong><p>Adivina el componente, el científico, la fórmula y el símbolo eléctrico del día. Puntos, racha y podio.</p><b>Adivinar →</b></a><a href="#solo/frontera" class="sp-entrada sp-e-frontera"><small>POKÉMON / FRONTERA BATALLA · NUEVO</small><strong>FRONTERA BATALLA <span>🏰</span></strong><p>Torre, Palacio y Fábrica de Esmeralda: rachas de 7 combates contra entrenadores cada vez más duros y los Ases.</p><b>Desafiar →</b></a><a href="juegos/worms/index.html?v=worms-4" class="sp-entrada sp-e-worms"><small>LOCAL · BOTS / ARTILLERÍA</small><strong>CIRCUIT BREAKERS <span>💥</span></strong><p>Tu cuadrilla contra bots o amigos en el mismo equipo. En línea: abre una sala arriba.</p><b>Desplegar →</b></a></div>
      </div>
    </div>`;
  for (const b of h.querySelectorAll("[data-filtro]")) {
    b.onclick = () => { filtroVes = b.getAttribute("data-filtro"); aplicaFiltro(); };
  }
  enganchaNovedades(h);
  h.querySelector(".jg-mq-link").onclick = ev => {
    ev.preventDefault();   // un #ancla cambiaría la ruta del hash
    $("vesCatalogo").scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

/* ---------- novedades ----------
   Lo primero del vestíbulo es lo que llegó último, para que quien vuelve
   al salón lo vea sin recorrer el catálogo; justo debajo, la tira de los
   últimos drops de PRODROP. */
const fechaAlta = a => {
  const d = new Date(a + "T12:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString("es", { day: "numeric", month: "long" });
};
const porOmision = k => Object.fromEntries((OPCIONES[k] || []).map(o => [o.clave, o.por || o.valores[0].v]));

/* Lo que se destaca a mano: no siempre lo nuevo es un juego de sala
   (PRODROP es una tienda, BBTAN un juego del club, zombis un modo de
   Yemas), así que la lista se escribe aquí en vez de salir de las fechas
   `alta` de JUEGOS. El primero lleva «★ Lo último». */
const NOVEDADES = [
  { id: "zombis", color: "#4f8a2b", alta: "2026-10-01", titulo: "Yemas · modo Zombis",
    lema: "Todos juntos contra oleadas de huevos podridos, en cinco mapas clásicos: bebidas, la caja misteriosa, armas en la pared y Pack-a-Punch. Se puede jugar solo.",
    sub: "1–8 jugadores · cooperativo", sala: { k: "yemas", ops: { variante: "zombis" } }, reglas: ["yemas", "zombis"] },
  { id: "prodrop", color: "#9b4dff", alta: "2026-10-02", titulo: "PRODROP · sobres y mercado",
    lema: "Sobres de cinco cartas de los profes, uno gratis cada 6 horas. Gradúalas, exhíbelas en tu perfil, véndelas en el mercado o cámbialas con otros.",
    sub: () => { const a = fb.ahora(), p = MOTOR.precioSobre(a);
      return a < MOTOR.PRECIO.promoHasta ? `Sobre a ${p} monedas hasta el 4 de octubre (después, ${MOTOR.PRECIO.normal})` : `Sobre a ${p} monedas · graduar, ${MOTOR.PRECIO.gradua}`; },
    ruta: "#cartas", boton: "Abrir sobres" },
  { id: "bbtan", color: "#6aa514", alta: "2026-09-30", titulo: "BBTAN",
    lema: "Apunta, rebota y rompe los bloques antes de que toquen el suelo. Y no te quedes mucho rato: más abajo, algo cambia.",
    sub: "Un jugador · ranking por ronda máxima", ruta: "#solo/bbtan", boton: "Lanzar", reglas: ["bbtan"] }
];
function arteNovedad(n) {
  if (n.id === "zombis") return `<div class="jg-nov-arte-zb">${arteJuego("yemas")}<b>ZOMBIS</b></div>`;
  if (n.id === "prodrop") {
    const cs = ["javier-pereda-torres-gta", "claudia-prieto-shiny", "david-watts-casino"];
    return `<div class="jg-nov-arte-pd">${cs.map((c, i) => `<img src="juegos/prodrop/cards/${i === 1 ? "legendarias" : "epicas"}/${c}.webp" alt="" loading="lazy">`).join("")}<b>PRO<span>DROP</span></b></div>`;
  }
  return `<div class="jg-nov-arte-bb"><i></i><i></i><i></i><i></i><i></i><i></i><em></em><b>BBTAN</b></div>`;
}

function novedadesHtml() {
  return `
      <section class="jg-nov" aria-labelledby="vesNovT">
        <header class="jg-nov-cab">
          <span class="jg-eyebrow">RECIÉN LLEGADO</span>
          <h2 id="vesNovT">Novedades</h2>
          <p>Lo último que llegó al salón.</p>
        </header>
        <div class="jg-nov-lista">${NOVEDADES.map((n, i) => `
          <article class="jg-nov-c" style="--c:${n.color}">
            <div class="jg-portada jg-nov-arte" aria-hidden="true">${arteNovedad(n)}</div>
            <div class="jg-nov-cuerpo">
              <div class="jg-nov-meta"><span class="jg-nov-sello">${i === 0 ? "★ Lo último" : "Nuevo"}</span><span>${escapeHtml(fechaAlta(n.alta))}</span></div>
              <h3>${escapeHtml(n.titulo)}</h3>
              <p>${escapeHtml(n.lema)}</p>
              <small>${escapeHtml(typeof n.sub === "function" ? n.sub() : n.sub)}</small>
              <div class="jg-nov-pie">
                ${n.sala ? `<button class="btn" data-nov-crear="${n.id}">Abrir sala <span aria-hidden="true">→</span></button>`
                  : `<a class="btn" href="${n.ruta}">${escapeHtml(n.boton)} <span aria-hidden="true">→</span></a>`}
                ${n.reglas ? `<button class="btn2" data-nov-reglas="${n.id}" title="Cómo se juega" aria-label="Reglas de ${escapeHtml(n.titulo)}">📖</button>` : ""}
              </div>
            </div>
          </article>`).join("")}</div>
      </section>
      <section class="jg-tira" aria-labelledby="vesTiraT">
        <header><h2 id="vesTiraT">🃏 Últimos drops</h2><small>épicas y legendarias de PRODROP, de la más reciente a la más antigua</small><a href="#cartas">Abrir sobres →</a></header>
        <div id="vesDrops" class="jg-tira-fila"><p class="jg-nada">Buscando cartas…</p></div>
      </section>`;
}

function enganchaNovedades(h) {
  const de = id => NOVEDADES.find(n => n.id === id);
  for (const b of h.querySelectorAll("[data-nov-crear]")) {
    const n = de(b.getAttribute("data-nov-crear"));
    b.onclick = () => crear(n.sala.k, Object.assign(porOmision(n.sala.k), n.sala.ops));
  }
  for (const b of h.querySelectorAll("[data-nov-reglas]")) {
    const n = de(b.getAttribute("data-nov-reglas")), [k, modo] = n.reglas;
    b.onclick = () => abreReglas(k, modo ? { modo, nombre: JUEGOS[k] ? JUEGOS[k].nombre : n.titulo } : undefined);
  }
}

/* El filtro solo esconde tarjetas: no se repinta nada, así que lo que
   alguien haya elegido en los `<select>` de una tarjeta sobrevive a
   cambiar de pestaña y volver. */
let filtroVes = "todos";
function aplicaFiltro() {
  for (const b of document.querySelectorAll("[data-filtro]"))
    b.setAttribute("aria-pressed", String(b.getAttribute("data-filtro") === filtroVes));
  const el = document.getElementById("vesElige");
  if (el) el.dataset.filtro = filtroVes;
  for (const c of document.querySelectorAll("#vesElige [data-tipo]"))
    c.hidden = filtroVes !== "todos" && c.getAttribute("data-tipo") !== filtroVes;
}

/* ---------- pintado: el vestíbulo ---------- */
/* Los individuales son HTML fijo: se reordenan moviendo los nodos, con
   Circuit Breakers local siempre al final (su sala en línea está arriba). */
let vesFirma = "";
function ordenaSolos() {
  const caja = document.querySelector(".sp-entradas");
  if (!caja) return;
  const clave = a => { const m = /#solo\/(\w+)/.exec(a.getAttribute("href") || ""); return m ? "club-" + m[1] : ""; };
  const todas = [...caja.children];
  const solos = todas.filter(clave);
  const orden = ordenPopular(solos.map(clave));
  const nuevo = orden.map(k => solos.find(a => clave(a) === k)).concat(todas.filter(a => !clave(a)));
  if (nuevo.some((a, i) => a !== todas[i])) nuevo.forEach(a => caja.appendChild(a));
}

/* La tarjeta destacada ocupa dos columnas y le sobraba media tarjeta en
   blanco. Ahí va su podio y dónde vas tú: es la razón para abrir una
   sala de ese juego y no de otro. Sale de las filas que ya trajo la
   lectura de popularidad, así que no cuesta otra consulta. */
function pintaDestacado() {
  const el = document.querySelector(".jg-of-podio");
  if (!el) return;
  const k = el.getAttribute("data-rk");
  const orden = ordenaRanks(Object.entries(state.tablas[k] || {}).map(([uid, f]) => Object.assign({ uid }, f)));
  if (!orden.length) { el.hidden = true; return; }
  const nombre = f => mezcla(f, perfilDe(f.uid)).nombre || "Jugador";
  const yo = orden.findIndex(f => f.uid === state.user.uid);
  const html = `<span class="jg-of-podio-t">Salón de la fama <b>ver todo →</b></span><ol>${orden.slice(0, 3).map((f, i) =>
    `<li class="${f.uid === state.user.uid ? "yo" : ""}"><i>${i + 1}</i><span>${escapeHtml(nombre(f))}</span><b>${f.puntos || 0}</b></li>`).join("")}</ol>` +
    `<small>${yo < 0 ? "Aún no estás en la tabla de este juego." : yo < 3 ? "Estás en el podio. Defiéndelo." : `Vas #${yo + 1} de ${orden.length}.`}</small>`;
  if (el.innerHTML !== html) el.innerHTML = html;
  el.hidden = false;
  el.onclick = () => { try { localStorage.setItem("jg.rankJuego", k); } catch (e) {} };
}

function pintaVestibulo() {
  $("vesAviso").innerHTML = state.fallo ? avisoReglas(state.fallo) : "";
  pintaMonedas();

  ordenaSolos();
  const orden = ordenPopular(Object.keys(JUEGOS));
  const firmaV = orden.join();
  if (firmaV !== vesFirma || !$("vesElige").firstElementChild) {
  vesFirma = firmaV;
  /* La tarjeta es la portada: el arte manda y el texto va debajo, en
     una columna que no cambia de alto según cuántas opciones tenga el
     juego —las opciones se pliegan en un resumen que dice lo elegido—,
     así que la rejilla sale pareja. La primera, la más jugada, ocupa
     dos columnas en pantalla ancha. */
  const masJugado = orden[0];
  $("vesElige").innerHTML = orden.map(k => [k, JUEGOS[k]]).map(([k, j]) => {
    const grupo = j.cupo > 2, cupo = grupo ? (j.minimo || 2) + "–" + j.cupo : "2";
    const sello = k === masJugado ? "Más jugado" : j.nuevo || k === "orbita" ? "Original" : "";
    return `
    <article class="jg-oferta jg-of-${k}" style="--c:${j.color}" data-tipo="${grupo ? "grupo" : "duelo"}">
      <div class="jg-portada jg-portada-${k}" aria-hidden="true">${arteJuego(k)}</div>
      ${sello ? `<span class="jg-of-sello">${sello}</span>` : ""}
      <div class="jg-of-cuerpo">
        <div class="jg-of-meta"><span class="jg-of-tipo">${grupo ? "En grupo" : "Duelo"}</span><span class="jg-of-cupo" title="Jugadores"><i aria-hidden="true"></i>${cupo}</span></div>
        <h3 class="jg-of-nombre">${escapeHtml(j.nombre)}</h3>
        <p class="jg-of-lema" title="${escapeHtml(j.lema)}">${escapeHtml(j.lema)}</p>
        ${k === masJugado ? `<a class="jg-of-podio" href="#ranks" data-rk="${k}" hidden></a>` : ""}
        ${opcionesHtml(k)}
        <div class="jg-of-pie">
          <button class="btn jg-of-btn" data-crear="${k}">Abrir sala <span class="jg-of-flecha" aria-hidden="true">→</span></button>
          ${k === "pokemon" ? `<button class="btn2 jg-of-reglas" type="button" data-equipos="1" title="Mis equipos" aria-label="Mis equipos de Pokémon">📋</button>` : ""}
          ${tieneReglas(k) ? `<button class="btn2 jg-of-reglas" type="button" data-reglas="${k}" title="Cómo se juega" aria-label="Reglas de ${escapeHtml(j.nombre)}">📖</button>` : ""}
        </div>
      </div>
    </article>`;
  }).join("");
  $("vesElige").onchange = ev => { const d = ev.target.closest(".jg-of-ops"); if (d) resumeOpciones(d); };
  for (const b of $("vesElige").querySelectorAll("[data-crear]")) {
    b.onclick = () => crear(b.getAttribute("data-crear"), leeOpciones(b));
  }
  for (const b of $("vesElige").querySelectorAll("[data-equipos]")) {
    b.onclick = () => {
      if (!state.user) return;
      const op = leeOpciones(b) || {};
      abreEquipos({ uid: state.user.uid, formato: op.formato });
    };
  }
  /* Desde el vestíbulo, el manual abre en la versión que está elegida
     en la tarjeta: es la que se va a jugar. */
  for (const b of $("vesElige").querySelectorAll("[data-reglas]")) {
    b.onclick = () => {
      const k = b.getAttribute("data-reglas"), op = leeOpciones(b) || {};
      abreReglas(k, { modo: modoReglas(k, op), nombre: JUEGOS[k].nombre });
    };
  }
  }
  aplicaFiltro();
  pintaDestacado();

  const mias = new Set(state.mias.map(x => x.id));
  /* Una sala que lleva seis horas esperando sin que nadie entre se
     cierra, y mientras tanto no se ofrece. */
  const ahoraV = fb.ahora();
  for (const s of state.salas) if (salaInactiva(s, ahoraV)) cierraInactiva(s.id);
  const abiertas = state.salas.filter(s => s.anfitrion !== state.user.uid && !mias.has(s.id) && !s.origen && !salaInactiva(s, ahoraV));
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
  /* En el móvil una caja vacía se pliega a su cabecera: tres avisos de
     «no hay nada» apilados empujaban el catálogo una pantalla abajo. */
  for (const [id, n] of [["vesSalas", abiertas.length], ["vesMias", state.mias.length], ["vesEnCurso", vivas.length]])
    $(id).closest(".jg-lado-caja").classList.toggle("vacia", !n);
}

/* Los controles de la tarjeta. Se leen del DOM al pulsar y no se
   guardan en `state`: son de un solo uso, y un estado paralelo que hay
   que mantener a la par de dos `<select>` cuesta más de lo que vale. */
function opcionesHtml(juego) {
  const ops = OPCIONES[juego];
  if (!ops) return "";
  const elegido = o => o.valores.find(v => v.v === (o.por || o.valores[0].v)) || o.valores[0];
  return `<details class="jg-of-ops"><summary><span>Opciones</span><em>${escapeHtml(ops.map(o => elegido(o).t).join(" · "))}</em></summary><div class="jg-of-ops-in">` + ops.map(o => `
    <label class="jg-of-op"><span>${escapeHtml(o.etiqueta)}</span>
      <select data-op="${o.clave}">${o.valores.map(v =>
        `<option value="${v.v}"${v === elegido(o) ? " selected" : ""}>${escapeHtml(v.t)}</option>`
      ).join("")}</select>
    </label>`).join("") + `</div></details>`;
}
/* El resumen plegado dice lo que se va a jugar, no «Opciones» a secas:
   quien no abre el desplegable sabe igual con qué sale la sala. */
function resumeOpciones(d) {
  const em = d.querySelector("summary em");
  if (em) em.textContent = [...d.querySelectorAll("select")].map(s => (s.selectedOptions[0] || {}).textContent || "").join(" · ");
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
      /* El Presidente no se acaba: quien mira puede sentarse, y la mesa
         le hace sitio al empezar la ronda siguiente. */
      const sentarse = p.juego === "presidente" && p.estado === "jugando" && !acabada;
      $("jgMirando").innerHTML = `<div class="jg-mirando"><span aria-hidden="true">👁</span>
        <b>Estás mirando esta partida.</b>
        <span>${acabada ? "Ya terminó: esto es cómo quedó." : sentarse ? "Puedes sentarte: entras al empezar la ronda siguiente." : est.listos ? "Lo ves en directo; puedes escribir en el chat, pero no jugar." : "Todavía no ha empezado."}</span>
        ${sentarse ? '<button class="btn" id="jgSentarse">Sentarte a la mesa</button>' : ""}</div>`;
      const sen = $("jgSentarse");
      if (sen) sen.onclick = async () => { sen.disabled = true; await entrar(state.pid); if (sen.isConnected) sen.disabled = false; };
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
  const min = minimoDe(p);
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
  /* Quien mira y se sienta (el Presidente deja entrar con la partida en
     marcha) necesita la pantalla de jugador, no la de mirón. */
  if (pidMontado === state.pid && modulo && mirandoMontado === !soyJugador()) return;
  desmontaJuego();
  const fab = FABRICAS[p.juego];
  if (!fab) { $("jgHost").innerHTML = `<div class="vacio">Ese juego no existe en esta versión.</div>`; return; }
  /* `secreto` solo lo usan cartas, Flip 7 y el cacho, pero se pasa a
     todos: el contrato de un juego es un objeto, y ramificarlo por juego
     lo convierte en cuatro. */
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
    listo: () => { if (state.partida && state.estado) { pintaRevancha(state.partida, state.estado); pintaFin(state.partida, state.estado); } },
    /* Un juego cuyo reductor depende de algo que llega tarde (el
       simulador de Pokémon, que se baja aparte) pide aquí que se vuelva
       a reducir la partida en cuanto lo tiene. */
    rehaz: () => { if (state.partida) { state.estado = reducir(state.partida); vistePerfiles(state.estado); render(); } }
  });
  modulo.montar($("jgHost"));
  pidMontado = state.pid;
  mirandoMontado = !soyJugador();
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
const PAUSA_FIN = { cuadritos: 1400, reversi: 1500, orbita: 1300, cartas: 2800, escondite: 1700, worms: 2500, cadena: 800, flip7: 1000, cacho: 900, uno: 1000, catan: 1300, presidente: 1200, spicy: 1200, tetris: 1500, yemas: 1500, clue: 1800, ajedrez: 1300, pokemon: 1500 };

function pintaFin(p, est) {
  const caja = $("jgFin");
  const f = datosFin(p, est);
  const vacia = () => { if (caja.innerHTML) { caja.innerHTML = ""; caja.dataset.firma = ""; } };
  if (!f || finCerrado === state.pid) { vacia(); return; }
  /* La pantalla sigue contando la jugada: la pausa empieza cuando acabe
     (llamará a `listo`), no ahora. */
  if (modulo && modulo.ocupado && modulo.ocupado()) { finDesde = 0; vacia(); return; }
  const vivo = finVivo === state.pid;
  if (vivo && f.motivo !== "abandono" && f.motivo !== "inactiva") {
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
  const clase = !g ? "empate" : ganoEn(p, g, yo) ? "gano" : juega ? "perdi" : "mirando";
  const titulo = f.motivo === "inactiva" ? "Sala cerrada"
    : clase === "gano" ? "¡Has ganado!"
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
  if (vivo && finSonado !== state.pid && f.motivo !== "inactiva") {
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
  inactiva: "Se cerró sola: pasaron seis horas sin una jugada. No cuenta para la clasificación.",
  meta: "Llegó primero a la meta de bajas.",
  equipo: "Su equipo llegó primero a la meta de bajas.",
  bandera: "Su equipo capturó las banderas que pedía la meta.",
  trio: "Reunió tres cartas del mismo elemento en tres colores distintos.",
  puntos: "Cerró más cajas que nadie.",
  fichas: "Acabó con más fichas sobre el tablero.",
  empate: "Nadie sacó ventaja.",
  victoria: "Su cuadrilla fue la última en pie.",
  apagon: "Apagón total: no quedó ninguna cuadrilla en pie.",
  reaccion: "Su reacción en cadena se tragó a todos los demás.",
  flip7: "Pasó de 200 puntos con más que nadie.",
  cacho: "Fue el último en conservar dados en el vaso.",
  tope: "Se acabaron las rondas: ganó quien tenía más dados.",
  uno: "Se quedó sin cartas antes que nadie.",
  piedad: "Fue el último en pie: los demás llegaron a 25 cartas.",
  catan: "Llegó a los puntos de victoria antes que nadie.",
  agotado: "Se agotaron las llaves de los dados: ganó quien tenía más puntos.",
  cierre: "La mesa votó acabar: ganó quien llevaba más puntos.",
  mate: "Jaque mate.",
  ahogado: "Rey ahogado: sin jugadas y sin estar en jaque.",
  material: "No quedaba material para dar mate.",
  repeticion: "La misma posición se repitió tres veces.",
  cincuenta: "Cincuenta jugadas sin capturas ni movimientos de peón.",
  acuerdo: "Tablas de mutuo acuerdo.",
  rendicion: "El rival se rindió.",
  tiempo: "Al rival se le acabó el tiempo.",
  tiempomaterial: "Se acabó un reloj, pero el otro no tenía con qué dar mate: tablas."
};
const razon = m => RAZONES[m] || "";
const nombreDe = (est, uid) => {
  if (String(uid).startsWith("eq:")) return "el equipo " + (uid === "eq:rojo" ? "Rojo" : "Azul");
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
  const firma = JSON.stringify([est.jugadores.map(x => [x.uid, x.nombre, x.color, x.foto, x.marco]), [...fuera], votos, puedoVotar, hace]);
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
      ${avatarMarco(x.foto, x.nombre, x.color, x.marco, 20, x.uid)}
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
  const ahora = fb.ahora();
  lista.innerHTML = chatMsgs.length ? chatMsgs.map(m => `
    <div class="jg-chat-msg${m.uid === yo ? " mio" : ""}" style="--c:${escapeHtml(colorForUid(m.uid || ""))};--edad:${Math.max(0, Math.round((ahora - (Number(m.at) || ahora)) / 100) / 10)}s">
      <b data-perfil="${escapeHtml(m.uid || "")}" data-nombre="${escapeHtml(m.nombre || "")}">${escapeHtml(m.nombre || "Alguien")}${jugadores[m.uid] ? "" : ' <small>mirando</small>'}</b>
      <span>${escapeHtml(m.t || "")}</span>
    </div>`).join("")
    : `<div class="vacio">Nadie ha escrito todavía.</div>`;
  lista.scrollTop = lista.scrollHeight;
}

/* ---------- el modo inmersivo ----------
   La sala a pantalla completa: sin cabecera del sitio ni pestañas, una
   barra fina arriba y el chat encima del juego, sin fondo, con los
   mensajes que se apagan solos a los diez segundos. Es una clase en
   <html> (`jg-inm`) más la API de pantalla completa cuando existe; en
   el iPhone no existe para una página, y la clase sola ya deja el juego
   en los `100dvh` enteros. `viewport-fit=cover` se pide sólo aquí: en
   la página normal, con el móvil apaisado, el contenido se metería
   debajo de la muesca. */
let inmPantalla = false;
const enInmersivo = () => document.documentElement.classList.contains("jg-inm");
const pantallaDelNavegador = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function ponInmersivo(si) {
  const raiz = document.documentElement;
  if (!!si === enInmersivo()) return;
  raiz.classList.toggle("jg-inm", !!si);
  const meta = document.querySelector("meta[name=viewport]");
  if (meta) meta.content = "width=device-width, initial-scale=1" + (si ? ", viewport-fit=cover" : "");
  if (si) {
    const pide = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
    if (pide && !pantallaDelNavegador()) {
      try {
        const r = pide.call(raiz, { navigationUI: "hide" });
        if (r && r.then) r.then(() => { inmPantalla = true; }, () => {});
        else inmPantalla = true;
      } catch (e) {}
    }
  } else {
    chatAbierto(false);
    const sal = document.exitFullscreen || document.webkitExitFullscreen;
    if (pantallaDelNavegador() && sal) { try { const r = sal.call(document); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
    inmPantalla = false;
  }
  pintaInmersivo();
  refrescaChat();
  /* Los juegos que miden su mesa (Flip 7, UNO, Catan) lo hacen al
     cambiar el tamaño de la ventana. */
  window.dispatchEvent(new Event("resize"));
}
function pintaInmersivo() {
  const b = $("jgInm");
  if (!b) return;
  const si = enInmersivo();
  b.innerHTML = si ? `<span aria-hidden="true">✕</span><span class="jg-cab-txt"> Salir</span>`
    : `<span aria-hidden="true">⛶</span><span class="jg-cab-txt"> Pantalla completa</span>`;
  b.title = si ? "Salir de la pantalla completa (Esc)" : "Jugar a pantalla completa";
  b.setAttribute("aria-pressed", String(si));
}
/* La edad de cada mensaje se calcula al pintar, y la animación que lo
   apaga arranca con un retraso negativo de esa edad: por eso hay que
   repintar al entrar o al cerrar el campo, o un mensaje de hace un
   minuto volvería a encenderse. */
function refrescaChat() {
  const l = $("jgChatLista");
  if (l) l.dataset.firma = "";
  chatFirma = "";
  pintaChat();
}
function chatAbierto(si) {
  const c = $("jgChat");
  if (!c || c.classList.contains("abierto") === !!si) return;
  c.classList.toggle("abierto", !!si);
  refrescaChat();
  if (si) $("jgChatTxt").focus();
  else if (c.contains(document.activeElement)) document.activeElement.blur();
}
function wireInmersivo() {
  const cambia = () => {
    if (pantallaDelNavegador()) return;
    /* Salió de la pantalla completa con Esc o el gesto del sistema: la
       clase se va con ella, o quedaría una página a medias. */
    if (inmPantalla && enInmersivo()) ponInmersivo(false);
  };
  document.addEventListener("fullscreenchange", cambia);
  document.addEventListener("webkitfullscreenchange", cambia);
  document.addEventListener("keydown", e => {
    if (!enInmersivo() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector(".jg-reglas-capa,.jg-modal-capa")) return;
    const c = $("jgChat"), abierto = c && c.classList.contains("abierto");
    if (e.key === "Escape") {
      if (abierto) { $("jgChatTxt").value = ""; chatAbierto(false); e.preventDefault(); }
      else if (!pantallaDelNavegador()) ponInmersivo(false);
      return;
    }
    /* Intro abre el chat sólo si nada tiene el foco: el escondite usa
       Intro sobre su lienzo, y un botón enfocado es un botón. */
    const libre = !document.activeElement || document.activeElement === document.body;
    if (e.key === "Enter" && !abierto && libre && c) { e.preventDefault(); chatAbierto(true); }
  });
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

/* El tema claro u oscuro. El guion del <head> ya lo puso antes de pintar;
   aquí sólo se pinta el botón y se cambia. Mientras nadie haya elegido,
   sigue al sistema también en caliente (si el sistema pasa a oscuro al
   anochecer, la página lo sigue); una vez pulsado el botón, manda lo
   elegido. Como el sonido, el botón dice lo que hay: ☾ es oscuro. */
const TEMA = "jg.tema";
const temaGuardado = () => { try { return localStorage.getItem(TEMA); } catch (e) { return null; } };
const esOscuro = () => document.documentElement.dataset.tema === "oscuro";
function ponTema(oscuro) {
  if (oscuro) document.documentElement.dataset.tema = "oscuro";
  else delete document.documentElement.dataset.tema;
  const b = $("btnTema");
  if (!b) return;
  b.textContent = oscuro ? "☾" : "☀";
  b.title = oscuro ? "Modo oscuro — pulsa para el claro" : "Modo claro — pulsa para el oscuro";
  b.setAttribute("aria-pressed", oscuro ? "true" : "false");
}
function wireTema() {
  ponTema(esOscuro());
  $("btnTema").onclick = () => {
    const oscuro = !esOscuro();
    try { localStorage.setItem(TEMA, oscuro ? "oscuro" : "claro"); } catch (e) { /* sin almacenamiento: vale para esta visita */ }
    ponTema(oscuro);
    suena("clic");
  };
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  if (mq && mq.addEventListener) mq.addEventListener("change", e => { if (!temaGuardado()) ponTema(e.matches); });
}

function wire() {
  wireTema();
  wireInmersivo();
  $("btnLogin").onclick = () => loginGoogle().catch(e => {
    $("loginError").textContent = "No se pudo iniciar sesión: " + (e.code || e.message);
  });
  $("btnLogout").onclick = () => logout();
  $("btnPerfil").onclick = () => { if (state.user) ir("#perfil/" + state.user.uid); };
  document.addEventListener("click", alTocarPerfil);
  pintaSonido();
  montaReproductor($("btnMusica"));
  document.addEventListener("pointerdown", activarAudio, { passive: true });
  document.addEventListener("keydown", activarAudio);
  $("btnSonido").onclick = () => { silenciar(!silenciado()); pintaSonido(); suena("clic"); };
  $("tabJugar").onclick = () => ir(state.pid ? "#p/" + state.pid : "#");
  $("tabRanks").onclick = () => ir("#ranks");
  $("tabLogros").onclick = () => ir("#logros");
  $("tabMonedas").onclick = () => ir("#monedas");
  $("tabCartas").onclick = () => ir("#cartas");
  $("userMonedas").onclick = () => ir("#monedas");
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
      if (offMonedas) { offMonedas(); offMonedas = null; datosMonedas = null; }
      vistaPintada = "";
      mostrar(false); pintaUsuario();
      return;
    }
    state.base = {
      uid: user.uid,
      name: user.displayName || "Usuario",
      photo: user.photoURL || "",
      color: colorForUid(user.uid)
    };
    state.user = Object.assign({}, state.base);
    perfilDe(user.uid);          // abre la escucha; al llegar repinta
    aplicaPropio();
    if (!offMonedas) offMonedas = datosPerfil(d => { datosMonedas = d; pintaMonedas(); });
    mostrar(true);
    if (!offReloj) offReloj = fb.seguirReloj();
    engancharVestibulo();
    vistaPintada = "";
    const r = leerRuta();
    state.vista = r.vista; state.pid = r.pid; state.perfilUid = r.uid || "";
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
  if (k === "cacho") return '<div class="jg-art-cc"><b></b>' + [5, 1, 3].map(n => '<i class="c' + n + '">' + "<s></s>".repeat(n) + '</i>').join("") + '</div>';
  if (k === "uno") return '<div class="jg-art-uno">' + [["7", "#d72600"], ["⊘", "#0956bf"], ["+2", "#379711"], ["+4", "#222"]].map(([n, c]) => '<i style="--t:' + c + '"><span>' + n + '</span></i>').join("") + '<b>UNO</b></div>';
  if (k === "catan") return arteCatan();
  if (k === "presidente") return '<div class="jg-art-pr"><b>👑</b>' + [["2", "♠", "#1d1d1d"], ["A", "♥", "#c62828"], ["K", "♦", "#c62828"], ["3", "♣", "#1d1d1d"]].map(([r, p, c]) => '<i style="--t:' + c + '"><span>' + r + '</span><s>' + p + '</s></i>').join("") + '<em>PRESIDENTE</em></div>';
  if (k === "spicy") return '<div class="jg-art-sp"><b>🌶</b>' + [["7", "#e2412b", "🌶"], ["3", "#5dac3a", "🍃"], ["9", "#6b4a2b", "⚫"]].map(([n, c, e]) => '<i style="--t:' + c + '"><span>' + n + '</span><s>' + e + '</s></i>').join("") + '<em>SPICY</em></div>';
  if (k === "tetris") return '<div class="jg-art-tt">' + ["....ll", "t..zll", "ttzzoo", "itsjoo", "issjjj"].map(f => [...f].map(c => '<i class="' + (c === "." ? "" : "p-" + c) + '"></i>').join("")).join("") + '<em>TETRIS</em></div>';
  if (k === "yemas") return '<div class="jg-art-ym"><i></i><i></i><i></i><b></b><em>YEMAS</em></div>';
  if (k === "clue") return '<div class="jg-art-cl"><i></i><i></i><i></i><b>✉</b><s>🔍</s><em>CLUE</em></div>';
  if (k === "pokemon") return '<div class="jg-art-pk"><i></i><b></b><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/6.gif" alt=""><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/9.gif" alt=""><em>POKÉMON</em></div>';
  if (k === "ajedrez") return '<div class="jg-art-aj">' + ["r", "Q", "n", "K", "p"].map(x => '<svg viewBox="0 0 100 100" aria-hidden="true">' + piezaSvg(x) + '</svg>').join("") + '</div>';
  if (k === "cuadritos") return '<div class="jg-art-dots">' + Array.from({ length: 9 }, (_, i) => '<i class="' + (i % 3 === 0 ? "llena" : "") + '"></i>').join("") + '</div>';
  return '<div class="jg-art-land"><i></i><i></i><i></i><b>⌖</b><span>ENCUENTRA LO INVISIBLE</span></div>';
}
/* La portada de Catan: siete hexágonos con su terreno, una ficha roja,
   un poblado, una ciudad y un camino, y un barquito que se mece en el
   mar. Es SVG a mano y no los símbolos del tablero, que solo existen
   dentro de la partida. */
function arteCatan() {
  const R = 25, w = R * Math.sqrt(3) / 2;
  const hex = (cx, cy, fill) => `<polygon points="${[[0, -R], [w, -R / 2], [w, R / 2], [0, R], [-w, R / 2], [-w, -R / 2]]
    .map(([x, y]) => (cx + x).toFixed(1) + "," + (cy + y).toFixed(1)).join(" ")}" fill="${fill}" stroke="#00000030" stroke-width="1.2"/>`;
  const arbol = (x, y) => `<path d="M${x} ${y - 9}l6 9h-3l4 6h-14l4-6h-3z" fill="#1f6a31"/>`;
  const pico = (x, y) => `<path d="M${x - 10} ${y + 6}l10-15 10 15z" fill="#6e7885"/><path d="M${x - 3.5} ${y - 3}l3.5-6 3.5 6-2-1-1.5 1.5-1.5-1.5z" fill="#fff"/>`;
  const oveja = (x, y) => `<g fill="#fff"><circle cx="${x - 3}" cy="${y}" r="3.6"/><circle cx="${x + 1}" cy="${y - 2}" r="3.8"/><circle cx="${x + 3}" cy="${y + 1}" r="3.4"/></g><circle cx="${x + 7}" cy="${y - 2}" r="2.2" fill="#333"/>`;
  const celdas = [
    [0, 0, "#f0cf5e", ""], [2 * w, 0, "#3f8f45", arbol(2 * w, 2)], [-2 * w, 0, "#d9804a", `<rect x="${(-2 * w - 8).toFixed(1)}" y="-4" width="16" height="7" rx="1" fill="#a9481f"/>`],
    [w, -1.5 * R, "#9fd66b", oveja(w, -1.5 * R)], [-w, -1.5 * R, "#a7afb9", pico(-w, -1.5 * R)],
    [w, 1.5 * R, "#a7afb9", pico(w, 1.5 * R)], [-w, 1.5 * R, "#3f8f45", arbol(-w, 1.5 * R + 2)]
  ];
  return `<svg class="jg-art-ct" viewBox="-78 -70 156 140" aria-hidden="true">
    <path class="jg-art-ct-ola" d="M-78 58 q9 -6 18 0 t18 0 t18 0 t18 0 t18 0 t18 0 t18 0 t18 0 t18 0" fill="none" stroke="#ffffff55" stroke-width="2"/>
    ${celdas.map(([x, y, c, d]) => hex(x, y, c) + d).join("")}
    <circle cx="0" cy="2" r="9.5" fill="#f7ecd0" stroke="#b08f5a" stroke-width="1.2"/><text x="0" y="6" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="800" font-size="11" fill="#c0392b">8</text>
    <line x1="${(w * 0.2).toFixed(1)}" y1="${(-R * 0.9).toFixed(1)}" x2="${(w * 0.85).toFixed(1)}" y2="${(-R * 0.58).toFixed(1)}" stroke="#1d1a17" stroke-width="6.5" stroke-linecap="round"/>
    <line x1="${(w * 0.2).toFixed(1)}" y1="${(-R * 0.9).toFixed(1)}" x2="${(w * 0.85).toFixed(1)}" y2="${(-R * 0.58).toFixed(1)}" stroke="#d8412f" stroke-width="4" stroke-linecap="round"/>
    <path d="M-6 -${R + 6} v-7 l6 -6 6 6 v7z" fill="#d8412f" stroke="#1d1a17" stroke-width="1.3" class="jg-art-ct-casa"/>
    <path d="M${(-w - 9).toFixed(1)} ${R / 2 + 9} v-9 l5 -6 5 6 v3 h9 v6z" fill="#2f6fd6" stroke="#1d1a17" stroke-width="1.3" class="jg-art-ct-casa b"/>
    <g class="jg-art-ct-barco"><path d="M50 40 h22 l-4 7 h-14z" fill="#8a5a2c"/><path d="M61 40 v-16" stroke="#3b220f" stroke-width="1.5"/><path d="M62 25 l8 13 h-8z" fill="#f3efe3"/></g>
  </svg><b class="jg-art-ct-t">CATAN</b>`;
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
  if (!datosFin(p, est) || modulo?.ocupado?.() || !p.jugadores?.[state.user.uid]) { el.innerHTML = ""; return; }
  el.innerHTML = '<div class="jg-revancha"><div><b>' +
    (p.revancha ? "Hay una revancha esperándote" : "¿Nos damos otra oportunidad?") + '</b><p>' +
    (p.revancha ? "Únete a la nueva sala con los mismos participantes." : "Invita a los participantes a repetir este juego.") +
    '</p></div><button class="btn" id="jgRevanchaBtn" ' + (pidiendoRevancha ? "disabled" : "") + '>' +
    (p.revancha ? "Aceptar revancha" : "Pedir revancha") + '</button></div>';
  $("jgRevanchaBtn").onclick = () => revancha(p, est);
}
