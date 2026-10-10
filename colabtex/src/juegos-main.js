/* El medidor de descarga va antes que todo: tiene que estar puesto antes
   de que el SDK abra su primera conexión con la base. */
import { crearMedidor, alDescargar, enMB } from "./consumo.js";
import { crearSolo } from "./juegos/solo/club.js";
import { esRachaClub, rachaClub } from "./juegos/solo/club-datos.js";
import { VERIFICADORES, juegoDeCategoria, textoPrueba } from "./juegos/solo/verifica.js";
import { crearFrontera } from "./juegos/frontera.js";
import { crearAdmin } from "./juegos/admin.js";
import { merecesRevision } from "./juegos/admin-datos.js";
import { esTrampa, castiga, revisaCastigo, castigoActivo, configuraCastigo, hastaDeCuenta } from "./juegos/castigo.js";
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
import { watchAuth, loginGoogle, logout, AVISO_RECAPTCHA } from "./firebase.js";
import * as fb from "./fb-juegos.js";
import { escapeHtml, timeAgo, colorForUid } from "./util.js";
import { AJ_RITMOS, JUEGOS, reducir, jugadasDe, acumula, cupoDe, minimoDe, TAMANOS, etiquetaTamano, meToca, progreso, CR_MALLAS, mayoriaExpulsion, MODOS_F7, MODOS_UNO, CT_EXPANSIONES, YM_VARIANTES, YM_LARGOS, YM_MAPAS, mapaYemas, varianteYemas, ganoEn, ordenaRanks, BX_VARIANTES, BX_METAS, BX_MAPAS, GT_VARIANTES, TL_TIEMPOS, TL_RONDAS, salaInactiva, ultimaActividad, INACTIVA_MS } from "./juegos/motor.js";
import { crearEscondite } from "./juegos/escondite.js";
import { crearCartas } from "./juegos/cartas.js";
import { crearCuadritos } from "./juegos/cuadritos.js";
import { crearOrbita } from "./juegos/orbita.js";
import { crearReversi } from "./juegos/reversi.js";
import { crearGato } from "./juegos/gato.js";
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
import { crearBoxhead } from "./juegos/boxhead.js";
import { crearTulones } from "./juegos/tulones.js";
import { crearClue } from "./juegos/clue.js";
import { abreReglas, tieneReglas } from "./juegos/reglas.js";
import { portadaSolo } from "./juegos/portadas-solo.js";
import { crearRanks } from "./juegos/ranks.js";
import { LOGROS, detecta, deFila, deMarca } from "./juegos/logros.js";
import { crearLogros } from "./juegos/logros-vista.js";
import { monedasDe, formatoMonedas, valorLogro, registraDia, diaChile as diaMonedas, pagoDia, rachaHoy,
  registraJugadaClub, PAGO_CLUB, topeClub, PODIO, topMonedas, economia, ultimosPodios } from "./juegos/monedas.js";
import { PRECIO_TIENDA } from "./juegos/tienda.js";
import { crearMonedas, topHtml, MONEDA } from "./juegos/monedas-vista.js";
import { crearProdrop } from "./juegos/prodrop.js";
import { mejoresDrops, miniCarta, cifras as cifrasCartas, MOTOR, rankingColeccion } from "./juegos/prodrop-cartas.js";
import { mezcla, abrePerfil } from "./juegos/perfil.js";
import { abreMini, cierraMini, miniAbierta, crearPaginaPerfil, avatarMarco, quien } from "./juegos/perfil-vista.js";
import { estadisticas, nombreCategoria, marcoVisible, valorMarca } from "./juegos/perfil-tarjeta.js";
import { fotoSana, colorSano } from "./juegos/sano.js";
import { suena, silenciar, silenciado, ambientar, ajustarMusica, activarAudio } from "./juegos/sonido.js";
import { montaReproductor } from "./juegos/reproductor.js";
import { createReportWidget } from "./report-widget.js";
import { crearRieles } from "./juegos/rieles.js";
import { repDe, entradaRep, mejoraRep } from "./juegos/rieles-datos.js";
import { anunciaSala, anunciaPodio, puestoSolo, conRecord, ordenSolo } from "./juegos/discord.js";
import { crearSalon, ICONO_SOLO, ICONO_MULTI, CANDADO, plataformas } from "./juegos/salon.js";
import { SOLOS, entradasSalon, nuevos, modoSalon, esClaveInvitado, UID_INVITADO, MOTIVO_CUENTA, enMovil, enPc, juegoDeNovedad, rutaLibre } from "./juegos/salon-datos.js";

const $ = id => document.getElementById(id);
const VER = (document.currentScript && document.currentScript.src.split("?v=")[1]) || "";

const FABRICAS = {
  orbita: crearOrbita, escondite: crearEscondite, cartas: crearCartas,
  cuadritos: crearCuadritos, reversi: crearReversi, worms: crearWorms,
  cadena: crearCadena, flip7: crearFlip7, cacho: crearCacho, uno: crearUno, catan: crearCatan,
  presidente: crearPresidente, spicy: crearSpicy, tetris: crearTetris, yemas: crearYemas, clue: crearClue,
  ajedrez: crearAjedrez, pokemon: crearPokemon, boxhead: crearBoxhead, gato: crearGato, tulones: crearTulones
};

const ICONO = { orbita: "✦", escondite: "🔍", cartas: "🔥", cuadritos: "▦", reversi: "⚫", worms: "💥", cadena: "⚛", flip7: "🃏", cacho: "🎲", uno: "🟥", catan: "⬢", presidente: "👑", spicy: "🌶", tetris: "▤", yemas: "🥚", clue: "🕵️", ajedrez: "♞", pokemon: "◓", boxhead: "▣", gato: "#", tulones: "🩲" };
/* Los clubes de un jugador, con sus claves de la clasificación y los
   mismos signos que llevan en su tarjeta del vestíbulo. */
const ICONO_TODOS = { ...ICONO, general: "★", minas: "✦", snake: "ϟ", tetrisclub: "▤", sortem: "↔", bbtan: "●", sopa: "🔤", electro: "⚡", frontera: "🏰", sudoku: "🔢", fanal: "🪔", atasco: "🚗", aleteo: "🐦", dosmil: "🟨", trigon: "🔺", metrorush: "🚇", tulones: "🩲", yzombis: "🧟" };

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
  /* Gato: la variante, no `modo` (las reglas lo restringen). */
  gato: [{ clave: "variante", etiqueta: "Modo", por: "clasico",
    valores: Object.keys(GT_VARIANTES).map(v => ({ v, t: GT_VARIANTES[v] })) }],
  clue: [{ clave: "cupo", etiqueta: "Detectives", por: 4, valores: cupos("clue") }],
  /* Boxhead: el cupo es cuántos caben; la partida arranca con los que
     hayan entrado (en cooperativo, incluso uno solo), y cuántos son
     decide cuántos enemigos salen por nivel. */
  boxhead: [
    { clave: "cupo", etiqueta: "Jugadores", por: 4, valores: cupos("boxhead") },
    { clave: "variante", etiqueta: "Modo", por: "coop",
      valores: Object.keys(BX_VARIANTES).map(v => ({ v, t: BX_VARIANTES[v] })) },
    { clave: "mapa", etiqueta: "Mapa", por: "patio",
      valores: Object.keys(BX_MAPAS).map(v => ({ v, t: BX_MAPAS[v] })) },
    /* La meta solo cuenta en versus: bajas para ganar. */
    { clave: "meta", etiqueta: "Bajas para ganar (versus)", por: BX_METAS[1],
      valores: BX_METAS.map(n => ({ v: n, t: n + " bajas" })) }
  ],
  /* Tulones: `tiempo` son los segundos de cada turno y `rondas` 0 es sin fin
     (gana el último en pie). Ninguno es `modo`. */
  tulones: [
    { clave: "cupo", etiqueta: "Jugadores", por: 4, valores: cupos("tulones") },
    { clave: "tiempo", etiqueta: "Turno", por: 45, valores: TL_TIEMPOS.map(v => ({ v, t: v + " s" })) },
    { clave: "rondas", etiqueta: "Rondas", valores: TL_RONDAS.map(v => ({ v, t: v ? String(v) : "Sin fin" })) }
  ],
  /* El formato decide qué equipos valen (el validador de Showdown); se
     guarda como `formato` y no como `modo`, que las reglas restringen. */
  pokemon: [{ clave: "formato", etiqueta: "Formato", por: PK_FORMATO_POR,
    valores: Object.entries(PK_FORMATOS).map(([v, t]) => ({ v, t })) }]
};

/* La pestaña del manual que abre cada sala: la de su variante. */
const modoReglas = (juego, o) => juego === "cacho" ? (Number(o.sicil) || 0)
  : juego === "catan" ? (o.exp === "mar" ? "mar" : "base")
  : juego === "yemas" ? (o.variante || "todos")
  : juego === "boxhead" ? (o.variante || "coop")
  : juego === "gato" ? (o.variante === "super" ? "super" : "clasico") : o.modo;

const state = {
  user: null,           // el perfil ya aplicado: lo que se pinta
  invitado: false,      // sin sesión: se ve el salón y se juega a lo de un jugador
  admin: false,         // `admins/<uid>`: ve el escudo 🛡️ y el panel #admin (null mientras se comprueba)
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
const CLUBES = ["club-minas", "club-snake", "club-tetris", "club-sortem", "club-bbtan", "club-sopa", "club-electro", "club-frontera", "club-sudoku", "club-fanal", "club-atasco", "club-aleteo", "club-dosmil", "club-trigon", "club-metrorush", "club-tulones"];
function ordenPopular(claves) {
  const n = state.popular, pos = Object.fromEntries(claves.map((k, i) => [k, i]));
  return claves.slice().sort((a, b) => (n[b] || 0) - (n[a] || 0) || pos[a] - pos[b]);
}

let offSalas = null, offMias = null, offPartida = null, offReloj = null, offEnCurso = null, offCastigo = null, offSuspension = null;
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
let adminVista = null;
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
    /* El marco va en la ficha para que entre en la firma de repintado de
       cada pantalla: si llega tarde (el perfil, o lo ganado), se repinta. */
    j.marco = marcoDeUid(j.uid);
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
    datosP = conDerivados(Object.assign({}, d, { completo: !!d.completo }));
    for (const f of [...oyentesP]) f(datosP);
  });
  else if (datosP) setTimeout(() => { if (oyentesP.has(cb)) cb(datosP); }, 0);
  return () => oyentesP.delete(cb);
}
/* Lo que el perfil necesita y no está en ningún nodo: el n.º 1 de monedas
   y el de la colección de PRODROP (piden la economía entera) y lo que la
   economía aceptó de la tienda. Perezosos y no enumerables: se calculan la
   primera vez que alguien pinta un marco, una vez por llegada. */
function conDerivados(d) {
  let lid = null, com = null;
  Object.defineProperty(d, "lideres", { enumerable: false, get: () => lid || (lid = lideresDe(d)) });
  Object.defineProperty(d, "compras", { enumerable: false, get: () => com || (com = comprasDe(d)) });
  return d;
}
function lideresDe(d) {
  if (!d.completo) return {};
  const m = topMonedas(d), c = rankingColeccion(d, 2) || [];
  return {
    monedas: m.length >= 2 ? m[0].uid : "",
    prodrop: c.length >= 2 && c[0].tiene > 0 ? c[0].uid : ""
  };
}
function comprasDe(d) {
  if (!d.completo) return d.tienda || {};
  const out = {};
  for (const [u, x] of Object.entries(economia(d).usuarios || {})) if (x.tienda && Object.keys(x.tienda).length) out[u] = x.tienda;
  return out;
}
/* El marco que se ve en una foto cualquiera (tops, chips, tiras): el del
   perfil vivo, comprobado contra lo que esa persona tiene ganado. */
const marcoDeUid = uid => uid ? marcoVisible(perfilDe(uid), datosP ? estadisticas(uid, datosP) : null) : "anillo";

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
    saldo: () => datosP && datosP.completo ? monedasDe(b.uid, datosP).saldo : null,
    onComprar: async id => { await fb.comprarTienda(b.uid, id, PRECIO_TIENDA); },
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

/* La cabecera según quién mira: con sesión, nombre, foto, monedas y
   salir; como invitado, un único botón de «Iniciar sesión» que está a la
   vista en cualquier pantalla (también dentro de un juego). */
function mostrar() {
  const dentro = !!state.user;
  $("viewMain").style.display = dentro || state.invitado ? "" : "none";
  for (const id of ["userName", "userAvatar", "btnPerfil", "btnLogout", "userMonedas"]) $(id).style.display = dentro ? "" : "none";
  $("btnEntrar").style.display = state.invitado ? "" : "none";
  /* El escudo del panel solo lo ve quien está en `admins/<uid>`. */
  $("btnAdmin").style.display = dentro && state.admin ? "" : "none";
  document.documentElement.classList.toggle("jg-invitado", state.invitado);
}

/* ---------- el invitado ----------
   Sin sesión no hay muro: se entra directo al salón en modo invitado. Se
   juega a todo lo de un jugador (corre en el navegador); lo multijugador
   se ve, con su candado, porque la base solo deja escribir a quien inició
   sesión. Lo que no se puede como invitado no se esconde: se explica y se
   ofrece la cuenta (`MOTIVO_CUENTA`, la ficha bloqueada).

   «Como invitado no se guarda nada» tiene que ser verdad también en este
   navegador, así que lo que los juegos dejaron con la cuenta «invitado» se
   borra al empezar otra visita. Una visita es una sesión de la pestaña
   (`sessionStorage`): recargar a mitad de partida no la pierde. */
const INVITADO = { uid: UID_INVITADO, name: "Invitado", photo: "", color: "#8a8399", invitado: true };
function limpiaInvitado() {
  try {
    if (sessionStorage.getItem("jg.visitaInvitado")) return;
    sessionStorage.setItem("jg.visitaInvitado", "1");
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (esClaveInvitado(k)) localStorage.removeItem(k);
    }
  } catch (e) { /* sin almacenamiento: tampoco hay nada que borrar */ }
}

/* Iniciar sesión sin perder el hilo. `juego` es la ficha desde la que se
   pidió: al volver con la cuenta se reabre, ya desbloqueada, y el botón
   principal queda a un toque. Desde una partida compartida (#p/…) la ruta
   no cambia, así que al entrar se cae directo en la sala. */
let trasLogin = "";
async function entrarConGoogle(juego) {
  trasLogin = juego || "";
  try { await loginGoogle(); }
  catch (e) {
    trasLogin = "";
    const cod = (e && e.code) || "";
    /* Cerrar la ventana de Google es cambiar de idea, no un error. */
    if (/popup-closed-by-user|cancelled-popup-request/.test(cod)) return;
    alert("No se pudo iniciar sesión: " + (cod || (e && e.message) || e) +
      (/popup-blocked/.test(cod) ? "\nEl navegador bloqueó la ventana de Google: permite las ventanas emergentes de este sitio." : ""));
  }
}

/* Lo que sustituye a una pantalla que necesita cuenta (la clasificación,
   una partida compartida…): qué es, por qué pide cuenta y la salida. */
function puertaHtml(m) {
  return `<section class="jg-puerta" aria-labelledby="jgPuertaT">
    <span class="jg-puerta-ico" aria-hidden="true">${CANDADO}</span>
    <h2 id="jgPuertaT">${escapeHtml(m.t)}</h2>
    <p>${escapeHtml(m.d)}</p>
    <div class="jg-puerta-btns">
      <button class="btn" type="button" data-login>Iniciar sesión con Google</button>
      <a class="btn2" href="#">Volver al salón</a>
    </div>
    <p class="jg-puerta-nota">Sin cuenta puedes jugar, como invitado, a Snake, Buscaminas, Tetris y sortEm.</p>
    <p class="jg-puerta-nota jg-recaptcha">${AVISO_RECAPTCHA}</p>
  </section>`;
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
      (r ? `<span class="jg-racha-chip${ya ? "" : " falta"}" title="${r} ${r === 1 ? "día seguido" : "días seguidos"}${ya ? "" : " · reclama hoy tu recompensa diaria para no perder la racha"}">🔥${r}</span>` : "");
  }
  const caja = $("vesMonedas");
  if (caja && u && d) caja.innerHTML = topHtml(d, u.uid, perfilDe, colorForUid);
  const drops = $("vesDrops");
  if (drops && u && d && d.completo) drops.innerHTML = dropsHtml(d);
  const tops = $("vesTops");
  if (tops && u && d && d.completo) tops.innerHTML = topsLista(d);
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
    return `<div class="jg-drop">${miniCarta(c)}<span class="jg-drop-quien" data-perfil="${escapeHtml(c.uid)}" data-nombre="${escapeHtml(q.nombre)}">${avatarMarco(q.foto, q.nombre, q.color, marcoDeUid(c.uid), 18, c.uid)}<b>${escapeHtml(q.nombre)}</b></span><small class="jg-drop-cuando">${c.rr ? "♻ re-roll · " : ""}${haceCuanto(c.at)}</small></div>`;
  }).join("");
}
/* La recompensa diaria se reclama con un clic (el botón de `rachaHtml`,
   sobre el top de monedas y en la pestaña #monedas). Lee el registro
   fresco, porque la caja puede estar pintada desde ayer, y escribe lo
   mismo que comprueba la regla de `diario/$uid`. */
async function reclamaDia(btn) {
  const u = state.user, hoy = diaMonedas();
  if (!u || diaMarcado === hoy) return;
  diaMarcado = hoy;
  document.querySelectorAll("[data-reclama-dia]").forEach(b => { b.disabled = true; b.textContent = "Cobrando…"; });
  try {
    const reg = registraDia(await fb.leerDiario(u.uid), hoy);
    if (reg) {
      await fb.apuntaDiario(u.uid, reg);
      suena("gana");
      avisaMonedas("🔥", reg.racha > 1 ? `¡${reg.racha} días seguidos!` : "¡Recompensa diaria!",
        `+${formatoMonedas(pagoDia(reg.racha))} monedas hoy · mañana +${formatoMonedas(pagoDia(reg.racha + 1))} si vuelves`, pagoDia(reg.racha), "racha");
    }
  } catch (e) {
    diaMarcado = -1;   // sin reglas publicadas, o sin red: el botón vuelve
    console.warn("[juegos] no se pudo cobrar la recompensa diaria", e);
    if (esPermiso(e)) capaReglas((e && (e.code || e.message)) || "", null); else alert("No se pudo cobrar la recompensa diaria. Revisa la conexión e inténtalo otra vez.");
  }
  if (datosMonedas && state.user) {
    /* Pinta ya con lo escrito; el listener de `diario` lo confirma enseguida. */
    try { const di = await fb.leerDiario(u.uid); datosMonedas = Object.assign({}, datosMonedas, { diario: Object.assign({}, datosMonedas.diario, { [u.uid]: di }) }); } catch (e) { /* queda el listener */ }
  }
  pintaMonedas();
  if (monedasVista) monedasVista.refresca();
}
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-reclama-dia]");
  if (b && !b.disabled) { ev.preventDefault(); reclamaDia(b); }
});

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

/* Cada partida del club que termina con resultado paga PAGO_CLUB[juego],
   hasta topeClub(juego) al día (la regla de `clubJugadas` comprueba lo
   mismo que `registraJugadaClub`). Se encadenan para que dos resultados
   seguidos no lean el mismo contador. */
let jugadasClubCola = Promise.resolve();
function marcaJugadaClub(juego) {
  const u = state.user;
  if (!u) return;
  jugadasClubCola = jugadasClubCola.then(async () => {
    try {
      const reg = registraJugadaClub(await fb.leerJugadasClub(u.uid, juego), diaMonedas(), juego);
      if (!reg) return;
      await fb.apuntaJugadaClub(u.uid, juego, reg);
      avisaMonedas("🕹️", "Partida del club", `${reg.hoy} de ${topeClub(juego)} que pagan hoy en este juego`, PAGO_CLUB[juego], "club");
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
  if (/^solo\/(minas|snake|tetris|sortem|bbtan|sopa|electro|frontera|sudoku|fanal|atasco|aleteo|dosmil|trigon|metrorush|tulones)$/.test(h)) return { vista: "solo-" + h.slice(5), pid: "" };
  if (h === "ranks") return { vista: "ranks", pid: "" };
  if (h === "logros") return { vista: "logros", pid: "" };
  if (h === "monedas") return { vista: "monedas", pid: "" };
  if (h === "cartas") return { vista: "cartas", pid: "" };
  if (h === "admin") return { vista: "admin", pid: "" };
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
  /* Un invitado no puede leer partidas: la ruta se queda (para entrar
     directo al iniciar sesión) y `armazon` pinta la puerta. */
  state.cargando = r.vista === "partida" && !state.invitado;
  if (r.vista !== "partida" || state.invitado) { soltarPartida(); }
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
      /* Sin `at` es una entrada a medio escribir (la semilla llega antes
         que la sala): mirarla ahora la daría por muerta y borrarla se
         llevaría la semilla, y con ella la mano de toda la partida. */
      if (!m.at || !m.juego) continue;
      if (miasRevisadas.has(m.id) || fb.ahora() - m.at < INACTIVA_MS) continue;
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
    // Una marca, no el texto: el selector de idioma lo traduce en el DOM.
    const marca = String(Date.now());
    b.dataset.copiado = marca;
    setTimeout(() => { if (b.dataset.copiado === marca) { delete b.dataset.copiado; b.textContent = antes; } }, 2500);
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
  if (!state.user && !state.invitado) { if (individual) { individual.destruir(); individual = null; } if (rieles) rieles.pon(false); return; }
  /* Retenido por el antitrampas (castigo.js): no se monta nada debajo de
     la capa. Un juego del club seguía sonando bajo el pantallazo, y al
     recargar en `#solo/<juego>` se volvía a montar entero. Al terminar,
     la capa avisa y esto vuelve a montar lo que diga la ruta. */
  if (castigoActivo()) {
    if (rieles) rieles.pon(false);
    if (vistaPintada !== "castigo") {
      salon.cierra(false);
      desmontaVista();
      desmontaJuego();
      $("pantalla").style.display = "none";
      vistaPintada = "castigo";
    }
    ambientar(null);
    return;
  }
  $("pantalla").style.display = "";
  const clave = state.vista === "perfil" ? "perfil:" + state.perfilUid : state.vista;
  /* La barra de pestañas va abajo en el móvil solo en las pantallas de
     menú; en una partida o un juego del club se va (tienen su «volver»). */
  document.documentElement.dataset.vista = state.vista.startsWith("solo-") ? "solo" : state.vista;
  if (clave !== vistaPintada) {
    /* La ficha cuelga de <body>: fuera del salón no puede quedar flotando. */
    if (state.vista !== "vestibulo") salon.cierra(false);
    desmontaVista();
    armazon();
    vistaPintada = clave;
  }
  if (state.vista === "vestibulo") pintaVestibulo();
  else if (state.vista === "partida" && state.user) pintaPartida();
  pintaTabs();
  /* Los rieles (repeticiones y chat general) solo en las vistas de menú:
     en una partida, un juego del club o los sobres, la pantalla es del juego. */
  if (rieles) rieles.pon(VISTAS_RIEL.has(state.vista) && !(state.invitado && MOTIVO_CUENTA[state.vista]));
}
const VISTAS_RIEL = new Set(["vestibulo", "ranks", "logros", "monedas", "perfil"]);
let rieles = null;

/* La mejor partida del día de cada cuenta en los cuatro juegos del riel
   (rieles-datos.js), con su prueba ya verificada para que el salón la
   repita. Se escribe aunque no sea récord —es la de hoy—, solo si mejora
   la que ya había, y de a una por vez (dos resultados seguidos leerían la
   misma «previa»). Si las reglas aún no conocen el nodo, no pasa nada. */
const repPropias = new Map();
let repCola = Promise.resolve();
function apuntaRepeticion(dato, prueba) {
  const u = state.user;
  if (!u || !dato || !repDe(dato.categoria)) return;
  const juego = juegoDeCategoria(dato.categoria);
  const e = entradaRep(dato.categoria, diaMonedas(fb.ahora()), dato, VERIFICADORES[juego] ? VERIFICADORES[juego].PRUEBA : 0, textoPrueba(prueba) || "", u.name);
  if (!e) return;
  const clave = u.uid + ":" + dato.categoria;
  repCola = repCola.then(async () => {
    let previa = repPropias.get(clave);
    if (previa === undefined) previa = await fb.leerRepeticion(dato.categoria, u.uid).catch(() => null);
    repPropias.set(clave, previa || null);
    if (!mejoraRep(e, previa)) return;
    await fb.guardarRepeticion(dato.categoria, u.uid, e);
    repPropias.set(clave, e);
  }).catch(err => console.warn("[juegos] no se pudo guardar la repetición", err));
}

/* Lo que cada vista dejó montado (un juego del club, PRODROP, las tablas…). */
function desmontaVista() {
  if (individual) { individual.destruir(); individual = null; }
  if (ranks) { ranks.destruir(); ranks = null; }
  if (logrosVista) { logrosVista.destruir(); logrosVista = null; }
  if (monedasVista) { monedasVista.destruir(); monedasVista = null; }
  if (prodropVista) { prodropVista.destruir(); prodropVista = null; }
  if (adminVista) { adminVista.destruir(); adminVista = null; }
  if (paginaPerfil) { paginaPerfil.destruir(); paginaPerfil = null; }
}

function pintaTabs() {
  $("tabJugar").classList.toggle("on", !["ranks", "logros", "perfil", "monedas", "cartas"].includes(state.vista));
  $("tabCartas").classList.toggle("on", state.vista === "cartas");
  $("tabRanks").classList.toggle("on", state.vista === "ranks");
  $("tabLogros").classList.toggle("on", state.vista === "logros");
  $("tabMonedas").classList.toggle("on", state.vista === "monedas");
  /* Como invitado se ven todas, con candado: tocarlas lleva a la puerta
     que explica qué hay detrás, que es la mejor razón para la cuenta. */
  for (const id of ["tabRanks", "tabLogros", "tabMonedas", "tabCartas"]) {
    $(id).classList.toggle("bloq", state.invitado);
    if (state.invitado) $(id).title = "Requiere cuenta"; else $(id).removeAttribute("title");
  }
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
  /* Un récord que sube al podio de una tabla del club queda en la cola de
     los administradores (admin.js), que pueden ver su repetición y decidir
     si se queda. Una fila chica; la prueba ya está guardada aparte. */
  if (merecesRevision(categoria, puesto, previo) && dato.partida)
    fb.apuntaRevision(categoria, uid, { p: dato.partida, pts: dato.puntos, t: dato.tiempo, l: puesto, n: dato.nombre })
      .catch(e => console.warn("[juegos] no se pudo apuntar la revisión", e));
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

/* Un récord del club ya verificado (verifica.js): primero su prueba, por
   su partida, y después la fila. La regla de `soloRanks` pide que la
   prueba exista; si las reglas nuevas aún no se publican, escribir la
   prueba falla con PERMISSION_DENIED y la fila se intenta igual (con las
   viejas, no la pide). Solo se escribe si mejora la marca guardada: una
   prueba por cada récord, no por cada partida. */
async function guardaClub(categoria, uid, dato, prueba) {
  const juego = juegoDeCategoria(categoria);
  if (juego) {
    const previa = await fb.leerSolo(categoria).then(f => f.find(x => x.uid === uid), () => null);
    /* Una racha diaria no pasa de la que cuenta `rachasClub`, que solo sube
       de a uno por día (club-datos.js: rachaClub). Si las reglas aún no la
       conocen, se sigue como antes. */
    if (esRachaClub(categoria)) {
      const sinReglas = e => { if (!/permission/i.test(String(e && (e.code || e.message)))) throw e; return undefined; };
      const prev = await fb.leerRachaClub(uid, categoria).catch(sinReglas);
      if (prev !== undefined) {
        const reg = rachaClub(prev, diaMonedas(), previa ? previa.puntos : 0);
        const escrita = reg ? await fb.apuntaRachaClub(uid, categoria, reg).then(() => true, sinReglas) : true;
        if (escrita) dato = Object.assign({}, dato, { puntos: Math.min(dato.puntos, (reg || prev).n) });
      }
    }
    if (previa && (previa.puntos > dato.puntos || previa.puntos === dato.puntos && previa.tiempo <= dato.tiempo)) return { committed: false };
    await fb.guardarPruebaSolo(categoria, uid, dato.partida, VERIFICADORES[juego].PRUEBA, textoPrueba(prueba) || "").catch(e => {
      if (!/permission/i.test(String(e && (e.code || e.message)))) throw e;
    });
  }
  return guardaConPodio(categoria, uid, dato);
}
/* Una partida que el verificador rechazó: el aviso para los
   administradores y, si es trampa de verdad (castigo.js: `esTrampa`, solo
   lo que se acaba de jugar), el pantallazo y la retención. Un invitado
   nunca llega aquí: no se verifica lo que no se guarda. */
const sospechaClub = s => {
  if (!state.user) return Promise.resolve();
  const uid = state.user.uid;
  if (esTrampa(s)) castiga(s, { uid, escribe: () => fb.ponCastigo(uid) });
  return fb.reportaSospecha(uid, s);
};

/* ---------- el medidor de descarga (consumo.js) ----------
   Cuánto bajó de la base este navegador y esta cuenta hoy. Lo raro va a
   `sospechas/<uid>` (una vez por día y tipo); en el tope se corta la
   conexión y la página queda tapada hasta la medianoche de Chile. */
const MOTIVO_CONSUMO = {
  dia: e => `Descarga inusual: ${enMB(e.total)} MB de la base en el día (aviso desde ${enMB(e.limites.aviso)} MB).`,
  rafaga: e => `Ráfaga de descarga: ${enMB(e.rafaga)} MB en ${Math.round(e.limites.ventana / 60000)} min en una pestaña.`,
  tope: e => `Llegó al tope diario de descarga: ${enMB(e.total)} MB (tope ${enMB(e.limites.tope)} MB). Se cortó la conexión.`
};
let marcasConsumo = [], envioConsumo = Promise.resolve(), offConsumo = null;
let apuntadoConsumo = 0, apunteConsumoAt = 0, cortadoConsumo = false;
const medidor = crearMedidor({
  alMarca: (tipo, e) => { marcasConsumo.push({ tipo, e }); vaciaMarcasConsumo(); },
  alTope: e => { cortaPorConsumo(e); }
});
alDescargar(n => medidor.cuenta(n));
/* Las marcas que llegan antes de saber de quién es la sesión esperan. */
function vaciaMarcasConsumo() {
  if (!state.user || !marcasConsumo.length) return envioConsumo;
  const uid = state.user.uid, van = marcasConsumo;
  marcasConsumo = [];
  envioConsumo = Promise.all(van.map(({ tipo, e }) => fb.reportaSospecha(uid, {
    c: "red-descarga", m: MOTIVO_CONSUMO[tipo](e), p: enMB(e.total), t: enMB(e.rafaga), d: tipo
  }).catch(err => console.warn("[consumo]", err))));
  return envioConsumo;
}
function apuntaConsumo(e, forzado) {
  if (!state.user || !e.mios) return Promise.resolve();
  const t = Date.now();
  if (!forzado && (e.mios - apuntadoConsumo < 256 * 1024 || t - apunteConsumoAt < 30000)) return Promise.resolve();
  apuntadoConsumo = e.mios; apunteConsumoAt = t;
  return fb.apuntaConsumo(state.user.uid, e.dia, e.pestaña, e.mios).catch(err => console.warn("[consumo]", err));
}
function tickConsumo() {
  const e = medidor.tick();
  /* Pasó la medianoche con la página cortada: se vuelve a empezar. */
  if (cortadoConsumo && !e.cortado) { location.reload(); return; }
  if (!e.cortado) apuntaConsumo(e, false);
}
async function cortaPorConsumo(e) {
  cortadoConsumo = true;
  /* Primero el aviso y lo bajado, para que lleguen antes de cortar (a lo
     más cuatro segundos: sin red, se corta igual). */
  if (state.user) await Promise.race([Promise.all([vaciaMarcasConsumo(), apuntaConsumo(e, true)]), new Promise(r => setTimeout(r, 4000))]);
  try { fb.desconecta(); } catch (err) { console.warn("[consumo]", err); }
  pintaTopeConsumo(e);
}
function pintaTopeConsumo(e) {
  if (document.getElementById("jgTopeDatos")) return;
  const capa = document.createElement("div");
  capa.id = "jgTopeDatos";
  capa.className = "jg-fin-capa";
  capa.style.zIndex = "95";
  capa.innerHTML = `<div class="jg-fin jg-fin-empate" role="alertdialog" aria-modal="true">
    <div class="jg-fin-cara">📶</div>
    <div class="jg-fin-t">Llegaste al límite de datos de hoy</div>
    <div class="jg-fin-sub">Hoy esta cuenta bajó ${enMB(e.total)} MB de la base de datos de Juegos, y el máximo es ${enMB(e.limites.tope)} MB por jugador al día.</div>
    <div class="jg-fin-m">El sitio comparte un cupo diario entre todos; el tope es para que nadie lo agote. Se libera a medianoche (hora de Chile). Los juegos que ya estaban abiertos dejan de guardar.</div>
  </div>`;
  document.body.appendChild(capa);
}

function armazon() {
  const h = $("pantalla");
  if (state.vista !== "partida") ponInmersivo(false);
  /* Como invitado, lo que lee o escribe la base (una partida, la
     clasificación, los sobres…) se cambia por una puerta que lo explica. */
  const motivo = !state.invitado ? null : MOTIVO_CUENTA[state.vista] ||
    /* Y de los juegos de un jugador, solo los cuatro libres (`rutaLibre`):
       una ruta escrita a mano a cualquier otro también da con la puerta. */
    (state.vista.startsWith("solo-") && !rutaLibre(state.vista.slice(5)) ? MOTIVO_CUENTA.solo : null);
  /* sortEm es solo el juego: el iframe ocupa la ventana, sin la cabecera
     del sitio ni la barra de juegos individuales. */
  document.documentElement.classList.toggle("jg-sortem", state.vista === "solo-sortem");
  document.documentElement.classList.toggle("jg-prodrop", state.vista === "cartas" && !motivo);
  h.closest("main").classList.toggle("jg-ancho", !motivo && (state.vista === "partida" || state.vista.startsWith("solo-")));
  if (motivo) { h.innerHTML = puertaHtml(motivo); return; }
  const u = state.user;
  if (state.vista === "solo-frontera") {
    /* La Frontera Batalla no es un iframe del club: es la pantalla de
       Pokémon en modo local, con sus propias rachas. Como invitado juega
       igual, con el usuario `INVITADO`, y no escribe nada fuera. */
    h.innerHTML = "";
    individual = crearFrontera({ usuario: u || INVITADO, guardar: guardaClub, reportaSospecha: sospechaClub, watch: fb.watchSolo, volver: () => ir(""),
      partida: u ? { leer: () => fb.leerPartidaClub(u.uid, "frontera"), guardar: (d, at) => fb.guardarPartidaClub(u.uid, "frontera", d, at) } : null,
      alResultado: u ? lista => { marcaJugadaClub("frontera");
        for (const { d, previa } of lista || []) {
          const antes = new Set(previa ? deMarca("frontera", Object.assign({ categoria: d.categoria }, previa)) : []);
          for (const id of deMarca("frontera", d)) if (!antes.has(id)) celebra("frontera", id);
        } } : undefined });
    individual.montar(h);
    return;
  }
  if (state.vista.startsWith("solo-")) {
    const juego = state.vista.slice(5);
    const clave = juego === "tetris" ? "tetrisclub" : juego;
    /* Sin cuenta (`usuario: null`) el club juega en modo invitado: ni
       clasificación, ni partida a medias en la nube, ni logros. */
    individual = crearSolo({ juego, usuario: u, guardar: guardaClub, reportaSospecha: sospechaClub, watch: fb.watchSolo, volver: () => ir(""),
      partida: u ? { leer: () => fb.leerPartidaClub(u.uid, juego), guardar: (d, at) => fb.guardarPartidaClub(u.uid, juego, d, at) } : null,
      /* El fantasma de Metro Rush: la tabla de la categoría y la prueba de su n.º 1, por clave (solo/club.js). */
      fantasma: u ? { leerTabla: cat => fb.leerSolo(cat), leerPrueba: (cat, uid, p) => fb.leerPruebaSolo(cat, uid, p) } : null,
      /* Un logro que el juego detecta en vivo (Metro Rush: «Cazafantasmas»): una vez, como los de sala. */
      logro: u ? id => misLogros(clave, u.uid).then(ya => { if (ya.has(id)) return; ya.add(id);
        fb.otorgarLogro(clave, u.uid, id).then(() => celebra(clave, id), e => console.warn("[juegos] no se pudo guardar el logro", id, e)); }) : null,
      /* Un logro individual sale de la marca: se celebra el que esta
         partida da y la mejor marca guardada no daba ya. */
      alResultado: u ? (d, previa, prueba) => { marcaJugadaClub(clave); apuntaRepeticion(d, prueba); const antes = new Set(previa ? deMarca(clave, Object.assign({ categoria: d.categoria }, previa)) : []);
        for (const id of deMarca(clave, d)) if (!antes.has(id)) celebra(clave, id); } : undefined });
    individual.montar(h);
    /* La barra de arriba sale del mismo catálogo que el salón, así que un
       juego nuevo del club aparece aquí sin tocar esta línea. */
    const club = SOLOS.filter(x => x.tipo === "club"), este = club.find(x => x.ruta === "#solo/" + juego) || {};
    const corto = { minas: "Buscaminas", snake: "Snake", sopa: "Sopa", sudoku: "Sudoku", frontera: "Frontera" };
    const barra = document.createElement("div");
    barra.className = "jg-solo-barra";
    barra.innerHTML = `<a class="btn2" href="#">← Juegos</a><div class="jg-solo-titulo"><small>${este.ranking === false ? "DE 1 A 8 EN EL MISMO TECLADO · SIN RANKING" : state.invitado ? "UN JUGADOR · MODO INVITADO, NO SE GUARDA" : "UN JUGADOR · RANKING POR MODALIDAD"}</small><strong>${escapeHtml(este.nombre || juego)}</strong></div>` +
      (state.invitado ? '<button class="btn jg-solo-entrar" type="button" data-login>Iniciar sesión</button>' : "") +
      `<nav aria-label="Juegos individuales">${club.map(x => `<a class="btn2${x === este ? " on" : ""}" href="${x.ruta}">${escapeHtml(corto[x.id] || x.nombre)}</a>`).join("")}` +
      `<button class="btn2" type="button" data-reglas-solo>📖 Reglas</button></nav>`;
    barra.querySelector("[data-reglas-solo]").onclick = () => abreReglas(clave);
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
        .map(k => ({ "club-minas": "minas", "club-snake": "snake", "club-tetris": "tetrisclub", "club-sortem": "sortem", "club-bbtan": "bbtan", "club-sopa": "sopa", "club-electro": "electro", "club-frontera": "frontera", "club-sudoku": "sudoku", "club-fanal": "fanal", "club-atasco": "atasco", "club-aleteo": "aleteo", "club-dosmil": "dosmil", "club-trigon": "trigon", "club-metrorush": "metrorush", "club-tulones": "tulones" })[k] || k) });
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
  if (state.vista === "admin") {
    /* El panel de administración (admin.js). Las reglas vuelven a
       comprobar cada escritura; esto solo evita enseñarlo a quien no es. */
    if (!state.user || !state.admin) {
      h.innerHTML = `<section class="jg-adm"><p class="jg-nada">${state.user && state.admin === null ? "Comprobando permisos…" : "Esta página es solo para administradores."}</p></section>`;
      return;
    }
    h.innerHTML = "";
    adminVista = crearAdmin({ uid: state.user.uid, fb, datos: datosPerfil, ahora: fb.ahora,
      nombre: u => (datosP && nombreEnDatos(u, datosP)) || "" });
    adminVista.montar(h);
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
      perfil: perfilDe, colorDe: colorForUid, icono: Object.assign({ prodrop: "🃏" }, ICONO_TODOS), orden: () => ordenPopular(Object.keys(JUEGOS)),
      datos: datosPerfil, quien: u => quien(u, perfilDe(u), null, { nombre: datosP ? nombreEnDatos(u, datosP) : "" }, colorForUid),
      /* Un administrador borra desde la propia tabla el récord que le
         parece sospechoso, sin pasar por la cola del panel. La regla
         vuelve a mirar que lo sea. */
      esAdmin: () => !!state.admin,
      borraRecord: (c, u, p) => fb.borraRecord(c, u, p, !!repDe(c)) });
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
        <div class="jg-chat-lista" id="jgChatLista" aria-live="polite" translate="no"></div>
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
  /* El salón, de arriba abajo y pensado primero para el móvil:
       1. las novedades, un banner que pasa solo y que ningún modo esconde;
       2. el saludo y la barra de modo (Todos · 1 jugador · Multijugador),
          que se queda pegada arriba al hacer scroll;
       3. el aviso del invitado, si lo es;
       4. «Para jugar solo», un carrusel justo a la entrada: antes estaban
          al final del catálogo y nadie los veía;
       5. las salas (abiertas, tuyas, en juego), en su columna;
       6. «Multijugador», con su insignia de grupo y sus filtros;
       7. los últimos tops del club y la tira de drops de PRODROP.
     En pantalla ancha la columna de salas va a la derecha y pegajosa, y
     baja hasta el final del salón: si acababa en «Multijugador», al hacer
     scroll se quedaba pegada encima de los tops y de los drops, porque
     Chrome no la sujeta a su área de la rejilla sino a la rejilla entera.
     En el móvil cae entre el carrusel de un jugador y el catálogo
     multijugador, donde se busca una sala. */
  const inv = state.invitado;
  const nombre = u ? String(u.name || "").split(" ")[0] : "";
  h.innerHTML = `
    <div class="jg-sal" id="vesSalon" data-modo="${modoVes}">
      ${novedadesHtml()}
      <header class="jg-sal-intro">
        <span class="jg-eyebrow">LABORATORIO · SALÓN DE JUEGOS</span>
        <h1>¿A qué jugamos${nombre ? `, <span translate="no">${escapeHtml(nombre)}</span>` : ""}?</h1>
        <p>Juegos para ti solo, sin esperar a nadie, y juegos para jugar con otros en línea.</p>
      </header>
      <nav class="jg-modos" aria-label="Qué juegos mostrar">
        <div class="jg-modos-sel" role="group" aria-label="Modo de juego">
          <button type="button" data-modo-ves="todos">Todos <b id="vesNTodos"></b></button>
          <button type="button" data-modo-ves="solo"><span class="jg-modos-ico m-solo" aria-hidden="true">${ICONO_SOLO}</span><span class="mo-l">1 jugador</span><span class="mo-c">Solo</span> <b id="vesNSolo"></b></button>
          <button type="button" data-modo-ves="multi"><span class="jg-modos-ico m-multi" aria-hidden="true">${ICONO_MULTI}</span><span class="mo-l">Multijugador</span><span class="mo-c">Multi</span> <b id="vesNMulti"></b></button>
        </div>
        ${inv ? '<button class="btn jg-modos-entrar" type="button" data-login><span class="mo-l">Iniciar sesión</span><span class="mo-c">Acceder</span></button>' : ""}
      </nav>
      <div class="jg-sal-avisos">
        ${inv ? `<p class="jg-invitado-aviso" role="note"><span class="jg-invitado-ico" aria-hidden="true">${ICONO_SOLO}</span><span><b>Estás como invitado.</b> Juegas a Snake, Buscaminas, Tetris y sortEm, pero nada se guarda ni cuenta para rankings, logros ni monedas. El resto necesita cuenta.</span><button type="button" data-login>Iniciar sesión</button></p><p class="jg-recaptcha">${AVISO_RECAPTCHA}</p>` : ""}
        <div id="vesAviso"></div>
      </div>
      <section class="jg-sal-sec jg-sal-solo" aria-labelledby="vesSoloT">
        <header class="jg-sal-tit">
          <span class="jg-sal-ico m-solo" aria-hidden="true">${ICONO_SOLO}</span>
          <div><h2 id="vesSoloT">Para jugar solo</h2><p>Sin sala ni espera: toca ▶ y juegas.${inv ? " Sin cuenta: Snake, Buscaminas, Tetris y sortEm." : ""}</p></div>
          <button class="jg-sal-ver" type="button" data-ver-solo>Ver todos</button>
          <button class="jg-desliza" type="button" data-desliza="-1" aria-label="Anteriores">‹</button><button class="jg-desliza" type="button" data-desliza="1" aria-label="Siguientes">›</button>
        </header>
        <div class="jg-carrusel" id="vesSolos"></div>
      </section>
      <aside class="jg-ves-lado" aria-label="${inv ? "Jugar con otros" : "Salas y partidas"}">${inv ? `
        <section class="jg-lado-caja jg-lado-cuenta">
          <header><span class="jg-sal-ico m-multi" aria-hidden="true">${ICONO_MULTI}</span><h2>Juega con otros</h2></header>
          <p>Con tu cuenta de Google:</p>
          <ul><li>Abres salas y entras a las de tus amigos</li><li>Sumas en la clasificación, logros y monedas</li><li>Tus récords del club quedan guardados</li></ul>
          <button class="btn" type="button" data-login>Iniciar sesión con Google</button>
        </section>` : `
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
        </section>`}
      </aside>
      <section class="jg-sal-sec jg-sal-multi" id="vesCatalogo" aria-labelledby="vesMultiT">
        <header class="jg-sal-tit">
          <span class="jg-sal-ico m-multi" aria-hidden="true">${ICONO_MULTI}</span>
          <div><h2 id="vesMultiT">Multijugador</h2><p>${inv ? "Se juega con cuenta: abres una sala y pasas el enlace." : "Abre una sala y pasa el enlace, o únete a una que espera."}</p></div>
          ${inv ? "" : '<button class="btn jg-sal-rapida" id="vesRapida" type="button" hidden></button>'}
        </header>
        <div class="jg-filtros" role="group" aria-label="Filtrar multijugador">
          <button type="button" data-filtro="todos">Todos</button><button type="button" data-filtro="duelo">Duelos</button><button type="button" data-filtro="grupo">En grupo</button>
        </div>
        <div class="jg-rejilla" id="vesElige"></div>
      </section>
      ${inv ? "" : topsHtml()}
      ${inv ? "" : tiraHtml()}
    </div>`;
  vesFirma = "";
  for (const b of h.querySelectorAll("[data-filtro]")) {
    b.onclick = () => { filtroVes = b.getAttribute("data-filtro"); aplicaFiltro(); };
  }
  for (const b of h.querySelectorAll("[data-modo-ves]")) b.onclick = () => ponModo(b.dataset.modoVes);
  h.querySelector("[data-ver-solo]").onclick = () => ponModo("solo");
  /* Con ratón no hay deslizar: las flechas mueven el carrusel una página. */
  for (const b of h.querySelectorAll("[data-desliza]")) {
    b.onclick = () => { const c = $("vesSolos"); c.scrollBy({ left: Number(b.dataset.desliza) * c.clientWidth * 0.9, behavior: "smooth" }); };
  }
  enganchaNovedades(h);
  enganchaBanner(h);
  salon.enganchar($("vesSalon"));
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
  { id: "gato", color: "#2f6b4f", alta: "2026-10-06", titulo: "Gato y Super Gato",
    lema: "El tres en raya de siempre, en tiza sobre la pizarra. O el Super Gato: nueve gatos dentro de uno, y la casilla donde juegas decide en qué gato juega el otro.",
    sub: "Duelo · dos modalidades", sala: { k: "gato", ops: { variante: "super" } }, reglas: ["gato", "super"],
    modo: "multi", jugadores: "2 jugadores", cuenta: true },
  { id: "tulonesred", color: "#63b8ee", alta: "2026-10-10", titulo: "TULONES en línea",
    lema: "La torre de amigos, ahora cada uno desde su casa: por turnos, ves en directo al que trepa y su cuerpo congelado queda para siempre. Quien no supera la línea roja queda fuera.",
    sub: "2 a 8 jugadores · por turnos", sala: { k: "tulones", ops: {} }, reglas: ["tulones"],
    modo: "multi", jugadores: "2 a 8 jugadores", cuenta: true },
  { id: "trigon", color: "#f6d23c", alta: "2026-10-10", titulo: "TRIGON",
    lema: "Arrastra piezas hechas de triángulos al tablero hexagonal. Completa una línea —horizontal o en cualquiera de las dos diagonales— y se borra. Encadena líneas para multiplicar el bono.",
    sub: "Un jugador · puzle de triángulos · 5 temas", ruta: "#solo/trigon", boton: "Jugar", reglas: ["trigon"], modo: "solo" },
  { id: "tulones", color: "#63b8ee", alta: "2026-10-09", titulo: "TULONES",
    lema: "Trepa sobre una cabra y sobre tus amigos congelados en calzoncillos. Cada brazo y cada pierna se agarra por separado y todo se bambolea. La torre más alta gana. De 1 a 8 en el mismo teclado.",
    sub: "1 a 8 jugadores en el mismo equipo · física de muñecos", ruta: "#solo/tulones", boton: "Trepar", reglas: ["tulones"], modo: "solo" },
  { id: "dosmil", color: "#edc22e", alta: "2026-10-07", titulo: "2048",
    lema: "Desliza las fichas hacia un lado: las iguales que chocan se juntan en una del doble. Cada jugada trae una ficha nueva. Llega al 2048… y sigue.",
    sub: "Un jugador · junta fichas hasta el 2048", ruta: "#solo/dosmil", boton: "Jugar", reglas: ["dosmil"], modo: "solo" },
  { id: "aleteo", color: "#3fb6f5", alta: "2026-10-06", titulo: "ALETEO",
    lema: "Un pajarito vuelve al nido por entre los tubos. Toca para aletear. Cuanto más lejos llega, más tarde se hace… y lo que hay al final del cielo no es un nido.",
    sub: "Un jugador · seis cielos y una sola tabla", ruta: "#solo/aleteo", boton: "Volar", reglas: ["aleteo"], modo: "solo" },
  { id: "metrorush", color: "#ff6a3d", alta: "2026-10-05", titulo: "METRO RUSH",
    lema: "Corre por las vías esquivando trenes: salta las barreras bajas, rueda bajo las altas y sube por las rampas a correr sobre los techos. Junta monedas, cumple retos y no dejes que el inspector te atrape.",
    sub: "Un jugador · esquiva trenes, junta monedas y llega a la Estación Fantasma", ruta: "#solo/metrorush", boton: "Correr", reglas: ["metrorush"], modo: "solo" },
  { id: "atasco", color: "#e8322f", alta: "2026-10-05", titulo: "Atasco",
    lema: "Estás encerrado en el auto rojo. Desliza autos, camiones y buses por su carril hasta abrirte camino a la salida. Con el mínimo de movidas, tres estrellas.",
    sub: "Un jugador · 240 niveles en seis pisos", ruta: "#solo/atasco", boton: "Arrancar", reglas: ["atasco"], modo: "solo" },
  { id: "boxhead", color: "#c8892f", alta: "2026-10-05", titulo: "Boxhead",
    lema: "Zombis y diablos vistos desde arriba. Cada baja sube el multiplicador y con él llegan la Uzi, la escopeta, los barriles, las cargas y el cohete. Cooperativo o versus, con los que entren a la sala.",
    sub: "1–8 jugadores · cinco mapas", sala: { k: "boxhead", ops: { variante: "coop" } }, reglas: ["boxhead", "coop"],
    modo: "multi", jugadores: "1–8 jugadores", cuenta: true },
  { id: "componentes", color: "#2fbf71", alta: "2026-10-04", titulo: "PRODROP · colección Componentes",
    lema: "La segunda colección de cartas: 25 componentes electrónicos en 11 temas, del realista y el esquemático al pixel art, el dieciochero y el arcano. Las legendarias salen quemadas… o con nieve de Navidad.",
    sub: "275 cartas nuevas · elige el sobre de Componentes al abrir", ruta: "#cartas", boton: "Abrir un sobre", cuenta: true },
  { id: "sudoku", color: "#ff2fb4", alta: "2026-10-04", titulo: "Sudoku Arcade",
    lema: "El sudoku del día con su racha, el clásico en cuatro dificultades y el arcade: tres vidas, combos de hasta ×4 y premio por cerrar filas, columnas y cajas.",
    sub: "Un jugador · diario, clásico y arcade", ruta: "#solo/sudoku", boton: "Jugar", reglas: ["sudoku"], modo: "solo" },
  { id: "fanal", color: "#d9a85b", alta: "2026-10-08", titulo: "FANAL · la otra orilla",
    lema: "Llevas la última luz a través de la noche, hacia el Alba… y más allá: la otra orilla, los cascos, la seda y la Hoguera. Cada jornada da una brasa para mejorar el arma o el fanal, y cada tres, evolucionan. Dispara al pulso de la música… y averigua qué estás apagando.",
    sub: "Un jugador · veinticinco jornadas, siete jefes, taller de mejoras y una travesía sin fin", ruta: "#solo/fanal", boton: "Encender", reglas: ["fanal"], modo: "solo" },
  { id: "prodrop", color: "#9b4dff", alta: "2026-10-02", titulo: "PRODROP · sobres y mercado",
    lema: "Sobres de cinco cartas, de los profes o de componentes, y uno gratis cada 6 horas. Gradúalas, exhíbelas en tu perfil, véndelas en el mercado, cámbialas con otros o junta diez para un re-roll.",
    sub: () => { const a = fb.ahora(), p = MOTOR.precioSobre(a);
      return a < MOTOR.PRECIO.promoHasta ? `Sobre a ${p} monedas hasta el 4 de octubre (después, ${MOTOR.PRECIO.normal})` : `Sobre a ${p} monedas · graduar, ${MOTOR.PRECIO.gradua}`; },
    ruta: "#cartas", boton: "Abrir sobres", cuenta: true }
];
function arteNovedad(n) {
  // 2048: el tablero de 4×4 con sus fichas y la del 2048 que late.
  if (n.id === "dosmil") {
    const f = [2, 0, 4, 8, 0, 16, 2, 0, 32, 64, 0, 4, 128, 256, 512, 2048];
    return `<div class="jg-nov-arte-dm"><div>${f.map(v => `<i class="v${v}">${v || ""}</i>`).join("")}</div><b>2048</b></div>`;
  }
  // ALETEO: el cielo que se oscurece de izquierda a derecha, tubos y el pájaro.
  if (n.id === "aleteo") return `<div class="jg-nov-arte-al"><i></i><i></i><i></i><i></i><s></s><em></em><b>ALETEO</b></div>`;
  // Sudoku Arcade: el tablero de neón con unas cifras, la casilla que late, las vidas y el combo.
  if (n.id === "sudoku") {
    const cifras = [[0, 0, 5, 1], [2, 0, 3], [4, 1, 7, 1], [7, 1, 1], [1, 3, 8], [3, 2, 6, 1], [6, 3, 2], [8, 4, 9, 1], [5, 5, 4], [2, 6, 1, 1], [7, 6, 5], [0, 8, 6], [4, 7, 3, 1], [6, 8, 7], [8, 7, 8]];
    return `<div class="jg-nov-arte-sd"><div>${cifras.map(([x, y, v, p]) => `<i${p ? ' class="p"' : ""} style="--x:${x};--y:${y}">${v}</i>`).join("")}<em></em></div><u>♥♥♥</u><s>×4</s><b>SUDOKU <span>ARCADE</span></b></div>`;
  }
  if (n.id === "componentes") {
    const cs = ["arcano/esp32", "navidad/timer-555", "quemado/mosfet-potencia"];
    return `<div class="jg-nov-arte-pd cmp">${cs.map(c => `<img src="juegos/prodrop/cards/componentes/${c}.webp" alt="" loading="lazy">`).join("")}<i>NUEVA COLECCIÓN</i><b>COMPO<span>NENTES</span></b></div>`;
  }
  // Atasco: un estacionamiento visto desde arriba, el auto rojo y la barrera de salida.
  if (n.id === "atasco") return `<div class="jg-nov-arte-at"><i></i><i></i><i></i><i></i><em></em><s></s><b>ATASCO</b></div>`;
  // Metro Rush: tres vías que se juntan en el horizonte, un tren de frente con los focos encendidos y unas monedas.
  if (n.id === "metrorush") return `<div class="jg-nov-arte-mr"><i></i><i></i><i></i><em></em><b>METRO RUSH</b></div>`;
  // FANAL: un farol que alumbra la noche y unas polillas que bajan hacia él.
  if (n.id === "fanal") return `<div class="jg-nov-arte-fn"><i></i><i></i><i></i><i></i><i></i><em></em><b>FANAL</b></div>`;
  // Tulones: la misma escena de la portada del club.
  if (n.id === "trigon") return `<div class="jg-nov-arte-zb">${portadaSolo("trigon")}<b>TRIGON</b></div>`;
  if (n.id === "tulonesred") return `<div class="jg-nov-arte-zb">${portadaSolo("tulones")}<b>EN LÍNEA</b></div>`;
  if (n.id === "tulones") return `<div class="jg-nov-arte-zb">${portadaSolo("tulones")}<b>TULONES</b></div>`;
  if (n.id === "gato") return `<div class="jg-nov-arte-zb">${arteJuego("gato")}</div>`;
  if (n.id === "boxhead") return `<div class="jg-nov-arte-zb">${arteJuego("boxhead")}</div>`;
  if (n.id === "zombis") return `<div class="jg-nov-arte-zb">${arteJuego("yemas")}<b>ZOMBIS</b></div>`;
  if (n.id === "prodrop") {
    const cs = ["javier-pereda-torres-gta", "claudia-prieto-shiny", "david-watts-casino"];
    return `<div class="jg-nov-arte-pd">${cs.map((c, i) => `<img src="juegos/prodrop/cards/${i === 1 ? "legendarias" : "epicas"}/${c}.webp" alt="" loading="lazy">`).join("")}<b>PRO<span>DROP</span></b></div>`;
  }
  return `<div class="jg-nov-arte-bb"><i></i><i></i><i></i><i></i><i></i><i></i><em></em><b>BBTAN</b></div>`;
}

/* Dónde se juega un juego del salón, con la forma que espera
   `plataformas`; vacío si la novedad no lleva a un juego (PRODROP). */
const plataformaDe = id => id ? { movil: enMovil(id), pc: enPc(id) } : {};

/* Las novedades son un banner: una diapositiva a la vez, a todo el ancho
   y antes del saludo, que pasa sola a la siguiente (entra por la derecha)
   cada `BAN_MS`. Llevan la misma insignia de modo que las miniaturas. El
   invitado ve las mismas; las que necesitan cuenta (una sala, la tienda)
   lo dicen y ofrecen lo que sí puede hacer: la práctica, si la hay.
   Tras la última va una copia de la primera (`inert`): el paso de la
   última a la primera sigue hacia la derecha y, al terminar, la pista
   salta sin transición a la primera de verdad (`enganchaBanner`). */
function novedadesHtml() {
  const inv = state.invitado, N = NOVEDADES.length;
  const diapo = (n, i, copia) => {
    /* Como invitado solo se abren los cuatro juegos libres; lo demás
       (también las prácticas contra bots) pide iniciar sesión. */
    const cuenta = inv && (n.cuenta || !(n.ruta && n.ruta.startsWith("#solo/") && rutaLibre(n.ruta.slice(6))));
    const insignia = (n.modo ? `<span class="jg-mn-modo m-${n.modo}">${n.modo === "solo" ? ICONO_SOLO + "1 jugador" : ICONO_MULTI + escapeHtml(n.jugadores)}</span>` : "") +
      /* Las mismas etiquetas que la miniatura, de la misma tabla (`CONTROLES`),
         para el juego al que lleva la novedad. */
      plataformas(plataformaDe(juegoDeNovedad(n)));
    const accion = cuenta
      ? `<button class="btn" type="button" data-login><span class="jg-nov-candado">${CANDADO}</span> Iniciar sesión</button>`
      : n.sala ? `<button class="btn" data-nov-crear="${n.id}">Abrir sala <span aria-hidden="true">→</span></button>`
      : `<a class="btn" href="${n.ruta}">${escapeHtml(n.boton)} <span aria-hidden="true">→</span></a>`;
    return `
          <article class="jg-ban-c${cuenta ? " bloq" : ""}" style="--c:${n.color}" ${copia ? 'aria-hidden="true" inert' : `role="group" aria-roledescription="diapositiva" aria-label="${i + 1} de ${N}: ${escapeHtml(n.titulo)}"`}>
            <div class="jg-portada jg-nov-arte jg-ban-arte" aria-hidden="true">${arteNovedad(n)}</div>
            <div class="jg-ban-cuerpo">
              <div class="jg-ban-meta"><span class="jg-nov-sello">${i === 0 ? "★ Lo último" : "Nuevo"}</span>${insignia}<span class="jg-ban-fecha">${escapeHtml(fechaAlta(n.alta))}</span></div>
              <h2>${escapeHtml(n.titulo)}</h2>
              <p>${escapeHtml(n.lema)}</p>
              <small>${escapeHtml(typeof n.sub === "function" ? n.sub() : n.sub)}${cuenta ? " · requiere cuenta" : ""}</small>
              <div class="jg-nov-pie">
                ${accion}
                ${n.reglas ? `<button class="btn2" data-nov-reglas="${n.id}" title="Cómo se juega" aria-label="Reglas de ${escapeHtml(n.titulo)}">📖</button>` : ""}
              </div>
            </div>
          </article>`;
  };
  return `
      <section class="jg-ban" id="vesBanner" aria-roledescription="carrusel" aria-label="Novedades del salón">
        <div class="jg-ban-vista">
          <div class="jg-ban-pista" aria-live="off">${NOVEDADES.map((n, i) => diapo(n, i, false)).join("")}${N > 1 ? diapo(NOVEDADES[0], 0, true) : ""}</div>
        </div>${N > 1 ? `
        <button class="jg-ban-flecha ant" type="button" data-ban="-1" aria-label="Novedad anterior">‹</button>
        <button class="jg-ban-flecha sig" type="button" data-ban="1" aria-label="Novedad siguiente">›</button>
        <div class="jg-ban-pie">
          <div class="jg-ban-puntos" role="group" aria-label="Elegir novedad">${NOVEDADES.map((n, i) => `<button type="button" data-ban-ir="${i}" aria-label="${escapeHtml(n.titulo)}"><i></i></button>`).join("")}</div>
          <button class="jg-ban-pausa" type="button" data-ban-pausa aria-label="Pausar las novedades" title="Pausar">❚❚</button>
        </div>` : ""}
      </section>`;
}
/* La tira de los últimos drops de PRODROP: va al final, después de los
   juegos, porque no es un juego; y no sale al invitado, que no puede
   leer las cartas de nadie. */
const tiraHtml = () => `
      <section class="jg-tira" aria-labelledby="vesTiraT">
        <header><h2 id="vesTiraT">🃏 Últimos drops</h2><small>épicas y legendarias de PRODROP, de la más reciente a la más antigua</small><a href="#cartas">Abrir sobres →</a></header>
        <div id="vesDrops" class="jg-tira-fila"><p class="jg-nada">Buscando cartas…</p></div>
      </section>`;

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

/* El banner de novedades pasa solo cada `BAN_MS`. El tiempo se cuenta a
   mano (un tic cada 100 ms que solo suma mientras nadie lo mira de cerca),
   porque se detiene por cinco motivos a la vez: el ratón encima, el foco
   dentro, la pestaña oculta, el botón de pausa y quien pidió menos
   movimiento (que empieza en pausa). El punto activo se llena con lo que
   falta para pasar. Con el dedo se arrastra; un arrastre no es un clic. */
const BAN_MS = 7000;
let banTic = 0;
function enganchaBanner(h) {
  clearInterval(banTic);
  const raiz = h.querySelector("#vesBanner"), N = NOVEDADES.length;
  if (!raiz || N < 2) return;
  const pista = raiz.querySelector(".jg-ban-pista"), vista = raiz.querySelector(".jg-ban-vista");
  const puntos = [...raiz.querySelectorAll("[data-ban-ir]")], pausa = raiz.querySelector("[data-ban-pausa]");
  const quieto = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
  let i = 0, t = 0, encima = false, foco = false, pausado = quieto, arrastre = null;
  const pon = (k, anima, dx = 0) => {
    pista.classList.toggle("sin-trans", !anima || quieto);
    pista.style.transform = `translateX(calc(${-k * 100}% + ${dx}px))`;
  };
  const pinta = () => {
    const j = i % N;
    puntos.forEach((b, k) => { b.classList.toggle("on", k === j); b.setAttribute("aria-current", String(k === j)); });
    const lleno = raiz.querySelector(".jg-ban-puntos .on i");
    for (const b of puntos) b.firstChild.style.transform = "";
    if (lleno) lleno.style.transform = `scaleX(${Math.min(1, t / BAN_MS)})`;
    raiz.classList.toggle("pausa", pausado);
    pausa.textContent = pausado ? "▶" : "❚❚";
    pausa.setAttribute("aria-label", pausado ? "Reanudar las novedades" : "Pausar las novedades");
    pausa.title = pausado ? "Reanudar" : "Pausar";
  };
  const ve = k => {
    t = 0;
    /* Parada en la copia (a medio pasar): se cuenta desde la primera. */
    if (i >= N) { k -= N; i = 0; pon(0, false); void pista.offsetWidth; }
    /* De la primera hacia atrás: se salta a la copia y se anima desde ahí. */
    if (k < 0) { pon(N, false); void pista.offsetWidth; k = N - 1; }
    i = Math.min(k, N);
    pon(i, true);
    if (quieto && i >= N) { i = 0; pon(0, false); }   // sin transición no llega `transitionend`
    pinta();
  };
  /* Al llegar a la copia de la primera, se vuelve a la de verdad sin que
     se note: son idénticas. */
  pista.addEventListener("transitionend", e => {
    if (e.target === pista && i >= N) { i = 0; pon(0, false); pinta(); }
  });
  raiz.querySelectorAll("[data-ban]").forEach(b => b.onclick = () => ve(i + Number(b.dataset.ban)));
  puntos.forEach(b => b.onclick = () => ve(Number(b.dataset.banIr)));
  pausa.onclick = () => { pausado = !pausado; pinta(); };
  raiz.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") encima = true; });
  raiz.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") encima = false; });
  raiz.addEventListener("focusin", () => { foco = true; });
  raiz.addEventListener("focusout", e => { if (!raiz.contains(e.relatedTarget)) foco = false; });
  raiz.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); ve(i + (e.key === "ArrowRight" ? 1 : -1)); }
  });
  vista.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return;
    arrastre = { x: e.clientX, y: e.clientY, dx: 0, movio: false };
  });
  vista.addEventListener("pointermove", e => {
    if (!arrastre) return;
    arrastre.dx = e.clientX - arrastre.x;
    if (!arrastre.movio && Math.abs(arrastre.dx) > 8 && Math.abs(arrastre.dx) > Math.abs(e.clientY - arrastre.y)) arrastre.movio = true;
    if (arrastre.movio) { t = 0; pon(i, false, arrastre.dx); }
  });
  const suelta = () => {
    if (!arrastre) return;
    const a = arrastre; arrastre = null;
    if (!a.movio) return;
    const ancho = vista.clientWidth || 1;
    if (Math.abs(a.dx) > Math.min(60, ancho * 0.18)) ve(i + (a.dx < 0 ? 1 : -1)); else pon(i, true);
    vista.dataset.arrastro = "1";
    setTimeout(() => { delete vista.dataset.arrastro; }, 0);
  };
  vista.addEventListener("pointerup", suelta);
  vista.addEventListener("pointercancel", suelta);
  vista.addEventListener("click", e => { if (vista.dataset.arrastro) { e.preventDefault(); e.stopPropagation(); } }, true);
  pon(0, false);
  pinta();
  banTic = setInterval(() => {
    if (!document.body.contains(raiz)) { clearInterval(banTic); return; }
    if (pausado || encima || foco || arrastre || document.hidden || salon.abiertaPara()) return;
    t += 100;
    if (t >= BAN_MS) ve(i + 1); else pinta();
  }, 100);
}

/* ---------- últimos tops ----------
   Quién subió hace poco al podio de una tabla del club quitándole el
   puesto a otra persona (`ultimosPodios`, de `podios`, que es lo único con
   fecha). Una lista corta: es noticia, no una clasificación. */
const NOMBRE_PUESTO = ["", "1.º", "2.º", "3.º"], MEDALLA = ["", "🥇", "🥈", "🥉"];
const topsHtml = () => `
      <section class="jg-tops" aria-labelledby="vesTopsT">
        <header><h2 id="vesTopsT">🏆 Últimos tops</h2><small>quién se subió al podio del club, del más reciente al más antiguo</small><a href="#ranks">Clasificación →</a></header>
        <ol id="vesTops" class="jg-tops-lista"><li class="jg-nada">Buscando récords…</li></ol>
      </section>`;
function topsLista(d) {
  const l = ultimosPodios(d, 8);
  if (!l.length) return `<li class="jg-nada">Nadie le ha quitado todavía un puesto del podio a nadie. ¿Serás el primero? <a href="#ranks">Mira las tablas →</a></li>`;
  const nom = (uid, c) => {
    const f = d.solo && d.solo[c] && d.solo[c][uid];
    return quien(uid, perfilDe(uid), null, { nombre: (f && f.nombre) || nombreEnDatos(uid, d) }, colorForUid);
  };
  return l.map(x => {
    const q = nom(x.uid, x.c), o = nom(x.q, x.c);
    const tabla = x.c.startsWith("yemas-zombis-") ? `Yemas zombis · ${YM_MAPAS[x.c.slice(13)] || x.c.slice(13)}` : nombreCategoria(x.c);
    const marca = x.fila ? valorMarca(x.c, x.fila) : "";
    return `<li class="jg-top p${x.p}">
          <span class="jg-top-med" aria-label="Puesto ${x.p}">${MEDALLA[x.p]}</span>
          <span class="jg-top-quien" data-perfil="${escapeHtml(x.uid)}" data-nombre="${escapeHtml(q.nombre)}">${avatarMarco(q.foto, q.nombre, q.color, marcoDeUid(x.uid), 30, x.uid)}</span>
          <span class="jg-top-txt"><b translate="no" data-perfil="${escapeHtml(x.uid)}">${escapeHtml(q.nombre)}</b> le quitó el ${NOMBRE_PUESTO[x.p]} puesto a <b translate="no" data-perfil="${escapeHtml(x.q)}">${escapeHtml(o.nombre)}</b>
            <small>${escapeHtml(tabla)}${marca ? ` · ${escapeHtml(marca)}` : ""} · ${haceCuanto(x.at)}</small></span>
        </li>`;
  }).join("");
}

/* Los filtros de los multijugador (todos, duelos, en grupo) solo
   esconden tarjetas: no se repinta nada. */
let filtroVes = "todos";
function aplicaFiltro() {
  for (const b of document.querySelectorAll("[data-filtro]"))
    b.setAttribute("aria-pressed", String(b.getAttribute("data-filtro") === filtroVes));
  for (const c of document.querySelectorAll("#vesElige .jg-mn"))
    c.hidden = filtroVes !== "todos" && c.dataset.grupo !== filtroVes;
}

/* El modo del salón (todos, un jugador, multijugador) es la forma más
   directa de decir «hoy quiero jugar solo»; se recuerda entre visitas. */
const MODO_VES = "jg.modoSalon";
let modoVes = modoSalon((() => { try { return localStorage.getItem(MODO_VES); } catch (e) { return null; } })());
function aplicaModo() {
  const raiz = $("vesSalon");
  if (raiz) raiz.dataset.modo = modoVes;
  for (const b of document.querySelectorAll("[data-modo-ves]"))
    b.setAttribute("aria-pressed", String(b.dataset.modoVes === modoVes));
}
function ponModo(m) {
  modoVes = modoSalon(m);
  try { localStorage.setItem(MODO_VES, modoVes); } catch (e) { /* sin almacenamiento */ }
  aplicaModo();
  /* Si la barra ya iba pegada arriba, el contenido nuevo empieza bajo
     ella y no a media página de lo que había antes. */
  const barra = document.querySelector(".jg-modos");
  if (barra && barra.getBoundingClientRect().top <= 1) {
    const sec = document.querySelector(modoVes === "multi" ? ".jg-sal-multi" : ".jg-sal-solo");
    if (sec) window.scrollTo({ top: window.scrollY + sec.getBoundingClientRect().top - barra.offsetHeight - 8 });
  }
}

/* ---------- el catálogo del salón ----------
   Las entradas (`salon-datos.js`) se rehacen en cada pintado: el orden
   por popularidad y las salas que esperan cambian solos. La miniatura y
   la ficha las pinta `salon.js`. */
let entradasVes = { solos: [], multi: [] }, nuevosVes = new Set();
const entradaVes = id => entradasVes.solos.find(e => e.id === id) || entradasVes.multi.find(e => e.id === id) || null;

/* Las salas a las que uno puede entrar: no las propias ni las de
   revancha, y no las dormidas (llevan seis horas sin nadie). */
function salasAbiertas() {
  if (!state.user) return [];
  const mias = new Set(state.mias.map(x => x.id)), ahora = fb.ahora();
  return state.salas.filter(s => s.anfitrion !== state.user.uid && !mias.has(s.id) && !s.origen && !salaInactiva(s, ahora));
}

/* El podio de un juego, en su ficha: es la razón para abrir una sala de
   ese juego y no de otro. Sale de las filas que ya trajo la lectura de
   popularidad, así que no cuesta otra consulta. */
function podioHtml(k) {
  if (!state.user) return "";
  const orden = ordenaRanks(Object.entries(state.tablas[k] || {}).map(([uid, f]) => Object.assign({ uid }, f)));
  if (!orden.length) return "";
  const nombre = f => mezcla(f, perfilDe(f.uid)).nombre || "Jugador";
  const cara = f => { const q = mezcla(f, perfilDe(f.uid)); return avatarMarco(q.foto, q.nombre, q.color || colorForUid(f.uid), marcoDeUid(f.uid), 20); };
  const yo = orden.findIndex(f => f.uid === state.user.uid);
  return `<a class="jg-of-podio" href="#ranks" data-rk="${escapeHtml(k)}"><span class="jg-of-podio-t">Salón de la fama <b>ver todo →</b></span><ol>${orden.slice(0, 3).map((f, i) =>
    `<li class="${f.uid === state.user.uid ? "yo" : ""}"><i>${i + 1}</i>${cara(f)}<span translate="no">${escapeHtml(nombre(f))}</span><b>${f.puntos || 0}</b></li>`).join("")}</ol>` +
    `<small>${yo < 0 ? "Aún no estás en la tabla de este juego." : yo < 3 ? "Estás en el podio. Defiéndelo." : `Vas #${yo + 1} de ${orden.length}.`}</small></a>`;
}

const salon = crearSalon({
  arteMulti: k => arteJuego(k),
  entrada: entradaVes,
  invitado: () => state.invitado,
  esNuevo: id => nuevosVes.has(id),
  opciones: k => OPCIONES[k] || [],
  salasDe: k => salasAbiertas().filter(s => s.juego === k).sort((x, y) => (x.at || 0) - (y.at || 0)),
  podioDe: podioHtml,
  /* Desde la ficha, el manual abre en la versión elegida en sus opciones:
     es la que se va a jugar. */
  reglas: (e, ops) => e.modo === "multi" ? abreReglas(e.id, { modo: modoReglas(e.id, ops), nombre: e.nombre }) : abreReglas(e.reglas),
  equipos: ops => { if (state.user) abreEquipos({ uid: state.user.uid, formato: ops.formato }); },
  login: id => entrarConGoogle(id),
  crearSala: (k, ops) => crear(k, Object.assign(porOmision(k), ops)),
  entrarSala: pid => entrar(pid)
});

/* ---------- pintado: el vestíbulo ---------- */
let vesFirma = "";
function pintaVestibulo() {
  $("vesAviso").innerHTML = state.fallo ? avisoReglas(state.fallo) : "";
  const inv = state.invitado;
  if (!inv) pintaMonedas();
  /* Una sala que lleva seis horas esperando sin que nadie entre se
     cierra, y mientras tanto no se ofrece. */
  const ahoraV = fb.ahora();
  if (!inv) for (const s of state.salas) if (salaInactiva(s, ahoraV)) cierraInactiva(s.id);
  const abiertas = salasAbiertas();

  /* El catálogo: los multijugador por popularidad (la de la última visita
     mientras llega la de hoy), los del club también, y las prácticas
     contra bots al final, que son la versión pequeña de un multijugador. */
  const orden = ordenPopular(Object.keys(JUEGOS));
  entradasVes = entradasSalon(JUEGOS, orden);
  const posClub = Object.fromEntries(ordenPopular(SOLOS.filter(x => x.popular).map(x => x.popular)).map((k, i) => [k, i]));
  const rango = new Map(entradasVes.solos.map((e, i) => [e.id, e.popular ? posClub[e.popular] : 100 + i]));
  entradasVes.solos.sort((x, y) => rango.get(x.id) - rango.get(y.id));
  nuevosVes = nuevos([...entradasVes.solos, ...entradasVes.multi], ahoraV);
  const porJuego = {};
  for (const s of abiertas) porJuego[s.juego] = (porJuego[s.juego] || 0) + 1;
  /* «Más jugado» solo con datos de popularidad de verdad: sin ellos el
     primero es el primero de la tabla y la etiqueta mentiría. */
  const top = Object.keys(state.popular).length ? orden[0] : "";
  const marcas = e => ({ invitado: inv, nuevo: nuevosVes.has(e.id), top: e.id === top, salas: porJuego[e.id] || 0 });
  const firma = JSON.stringify([inv, [...nuevosVes], top, porJuego, entradasVes.solos.map(e => e.id), orden]);
  if (firma !== vesFirma || !$("vesElige").firstElementChild) {
    vesFirma = firma;
    /* Repintar quita el foco de la tarjeta que lo tenía (alguien abrió
       una sala justo mientras uno recorría el catálogo con el teclado). */
    const foco = document.activeElement && document.activeElement.closest ? document.activeElement.closest("#vesSalon .jg-mn") : null;
    $("vesSolos").innerHTML = entradasVes.solos.map(e => salon.tarjeta(e, marcas(e))).join("");
    $("vesElige").innerHTML = entradasVes.multi.map(e => salon.tarjeta(e, marcas(e))).join("");
    if (foco) { const b = document.querySelector(`#vesSalon .jg-mn[data-id="${foco.dataset.id}"] .jg-mn-abre`); if (b) b.focus({ preventScroll: true }); }
  }
  $("vesNSolo").textContent = entradasVes.solos.length;
  $("vesNMulti").textContent = entradasVes.multi.length;
  $("vesNTodos").textContent = entradasVes.solos.length + entradasVes.multi.length;
  aplicaFiltro();
  aplicaModo();
  salon.refresca();
  if (inv) return;

  const mias = new Set(state.mias.map(x => x.id));
  $("vesCuenta").textContent = abiertas.length;
  /* El botón del catálogo multijugador hace lo más probable: entrar en la
     sala que lleva más rato esperando. Sin ninguna, no hay atajo. */
  const rapida = $("vesRapida");
  const primera = abiertas.slice().sort((x, y) => (x.at || 0) - (y.at || 0))[0];
  rapida.hidden = !primera;
  if (primera) {
    rapida.innerHTML = `Unirme a <span translate="no">${escapeHtml(primera.nombre || "alguien")}</span> <small>${escapeHtml((JUEGOS[primera.juego] || {}).nombre || primera.juego)}</small>`;
    rapida.onclick = () => entrar(primera.id);
  }

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
    /* La foto de un jugador con el marco de su perfil, para que las mesas
       la pinten igual que la cabecera. Sin `data-perfil`: dentro de un
       juego un clic en un asiento puede ser una jugada. */
    avatar: (j, tam, color) => avatarMarco(fotoSana(j.foto, true), j.nombre, color || colorSano(j.color) || colorForUid(j.uid || ""), j.marco || marcoDeUid(j.uid), tam),
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
const PAUSA_FIN = { cuadritos: 1400, reversi: 1500, orbita: 1300, cartas: 2800, escondite: 1700, worms: 2500, cadena: 800, flip7: 1000, cacho: 900, uno: 1000, catan: 1300, presidente: 1200, spicy: 1200, tetris: 1500, yemas: 1500, clue: 1800, ajedrez: 1300, pokemon: 1500, boxhead: 1500, gato: 1200, tulones: 1800 };

function pintaFin(p, est) {
  const caja = $("jgFin");
  if (!caja) return;   // la sala no está montada (la tapa el castigo)
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
  const firma = JSON.stringify([est.jugadores.map(x => [x.uid, x.nombre, x.color, x.foto, marcoDeUid(x.uid)]), [...fuera], votos, puedoVotar, hace]);
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
      ${avatarMarco(x.foto, x.nombre, x.color, marcoDeUid(x.uid), 20, x.uid)}
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
  /* Iniciar sesión está a la vista en todas partes mientras se es
     invitado: la cabecera, la barra de modo del salón, la barra de un
     juego del club, la puerta de cada pantalla con cuenta. Todos son
     `[data-login]` y los atiende este escuchador. */
  $("btnEntrar").onclick = () => entrarConGoogle();
  document.addEventListener("click", ev => {
    const b = ev.target.closest && ev.target.closest("[data-login]");
    if (b) { ev.preventDefault(); entrarConGoogle(b.getAttribute("data-login") || ""); }
    /* El podio de una ficha lleva a la clasificación de ese juego. */
    const rk = ev.target.closest && ev.target.closest("a[data-rk]");
    if (rk) try { localStorage.setItem("jg.rankJuego", rk.getAttribute("data-rk")); } catch (e) { /* sin almacenamiento */ }
  });
  $("btnLogout").onclick = () => logout();
  $("btnPerfil").onclick = () => { if (state.user) ir("#perfil/" + state.user.uid); };
  $("btnAdmin").onclick = () => ir("#admin");
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
  tickConsumo();
  setInterval(tickConsumo, 2000);
  /* El castigo del antitrampas se mira antes que la sesión: el registro
     local basta para tapar Juegos desde el primer momento al recargar. */
  configuraCastigo({ ahora: fb.ahora, entrar: () => entrarConGoogle(),
    alCambiar: () => { vistaPintada = ""; render(); } });
  revisaCastigo();
  rieles = crearRieles({
    fb, usuario: () => state.user ? { uid: state.user.uid, name: state.user.name } : null,
    perfil: perfilDe, marco: marcoDeUid, colorDe: colorForUid, dia: () => diaMonedas(fb.ahora()), popular: () => state.popular
  });
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
      /* Sin sesión (o al salir) no hay muro: el salón en modo invitado,
         en la misma ruta en que se estaba. */
      if (individual) { individual.destruir(); individual = null; }
      state.user = null;
      state.base = null;
      state.invitado = true;
      state.salas = []; state.mias = []; state.enCurso = []; state.tablas = {};
      soltarPartida();
      for (const f of [offSalas, offMias, offReloj, offEnCurso, offCastigo, offSuspension]) { if (f) { try { f(); } catch (e) {} } }
      offSalas = offMias = offReloj = offEnCurso = offCastigo = offSuspension = null;
      state.admin = false;
      revisaCastigo({ uid: null, cuenta: 0, suspension: null });
      if (offConsumo) { try { offConsumo(); } catch (e) {} offConsumo = null; }
      medidor.ponCuenta(null); apuntadoConsumo = 0;
      if (offMonedas) { offMonedas(); offMonedas = null; datosMonedas = null; }
      limpiaInvitado();
      mostrar(); pintaUsuario();
      const r = leerRuta();
      state.vista = r.vista; state.pid = r.pid; state.perfilUid = r.uid || "";
      state.cargando = false;
      vistaPintada = "";
      render();
      /* Una ficha abierta (se salió de la cuenta con ella delante) se
         repinta en su versión de invitado. */
      if (salon.abiertaPara()) salon.abre(salon.abiertaPara());
      return;
    }
    state.invitado = false;
    state.base = {
      uid: user.uid,
      name: user.displayName || "Usuario",
      photo: user.photoURL || "",
      color: colorForUid(user.uid)
    };
    state.user = Object.assign({}, state.base);
    /* El castigo de esta cuenta, en vivo (otra pestaña u otro aparato
       puede ponerlo), y medido con el reloj del servidor: cuando llega la
       corrección se vuelve a mirar, así adelantar el reloj no lo acorta. */
    if (offCastigo) { try { offCastigo(); } catch (e) {} }
    revisaCastigo({ uid: user.uid, cuenta: 0 });
    offCastigo = fb.watchCastigo(user.uid, v => revisaCastigo({ cuenta: hastaDeCuenta(v) }));
    /* La suspensión que puso un administrador (admin.js): la misma capa
       de «WASTED», con el tiempo que él eligió. Un nodo chico, casi
       siempre vacío. */
    if (offSuspension) { try { offSuspension(); } catch (e) {} }
    revisaCastigo({ suspension: null });
    offSuspension = fb.watchSuspension(user.uid, v => revisaCastigo({ suspension: v }));
    /* ¿Es administrador? Una lectura por sesión. */
    state.admin = null;
    fb.esAdminJuegos(user.uid).then(a => {
      if (!state.user || state.user.uid !== user.uid) return;
      state.admin = a; mostrar();
      if (state.vista === "admin") { vistaPintada = ""; render(); }
      if (a && ranks && ranks.refresca) ranks.refresca();
    });
    /* Lo que la cuenta bajó hoy en sus otros aparatos y pestañas: el tope
       es por jugador, no por navegador. */
    if (offConsumo) { try { offConsumo(); } catch (e) {} }
    apuntadoConsumo = 0;
    offConsumo = fb.watchConsumo(user.uid, v => { medidor.ponCuenta(v); tickConsumo(); });
    vaciaMarcasConsumo();
    perfilDe(user.uid);          // abre la escucha; al llegar repinta
    aplicaPropio();
    if (!offMonedas) offMonedas = datosPerfil(d => { datosMonedas = d; pintaMonedas(); });
    mostrar();
    if (!offReloj) offReloj = fb.seguirReloj(() => revisaCastigo());
    engancharVestibulo();
    vistaPintada = "";
    const r = leerRuta();
    state.vista = r.vista; state.pid = r.pid; state.perfilUid = r.uid || "";
    state.cargando = r.vista === "partida";
    if (r.vista === "partida") engancharPartida(r.pid);
    render();
    /* Se inició sesión desde una ficha bloqueada: se reabre ya con la
       cuenta, con «Abrir sala» a un toque. Si la ficha seguía abierta
       por otro motivo, se repinta con lo que ahora se puede hacer. */
    const reabrir = (state.vista === "vestibulo" && (trasLogin || salon.abiertaPara())) || "";
    trasLogin = "";
    if (reabrir) salon.abre(reabrir);
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
  if (k === "gato") return '<div class="jg-art-gt"><svg viewBox="0 0 120 120" aria-hidden="true"><path d="M42 12 Q40 60 43 108 M79 11 Q81 62 78 109 M12 41 Q60 39 108 42 M11 79 Q62 81 109 78"/><path class="x" d="M18 18 L35 34 M35 17 L18 35 M86 86 L103 103 M103 85 L86 103"/><circle class="o" cx="61" cy="60" r="11"/><circle class="o" cx="96" cy="25" r="10"/><path class="r" d="M14 14 Q60 61 106 106"/></svg><em>GATO</em></div>';
  if (k === "tulones") return '<div class="jg-art-tl">' + portadaSolo("tulones") + '<em>TULONES</em></div>';
  if (k === "boxhead") return '<div class="jg-art-bx"><i></i><i></i><i></i><b></b><s></s><em>BOXHEAD</em></div>';
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
