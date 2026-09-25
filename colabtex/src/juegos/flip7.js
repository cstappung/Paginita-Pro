/* Flip 7 — pedir carta o plantarse, de dos a seis, normal o con venganza.
 *
 * Esta pantalla no decide nada: el reductor (`redFlip7` en motor.js)
 * sabe de quién es el turno, qué carta salió y quién se pasó. Aquí se
 * pinta eso y se mandan tres clases de jugada — pedir, plantarse y
 * apuntar una acción — más una que nadie pulsa:
 *
 * - **El aporte al robo va solo.** Cada carta sale de dos aportes, el
 *   de quien la recibe y el del siguiente asiento, y los dos navegadores
 *   los publican en cuanto el reductor los pide (`espera.k === "roba"`).
 *   Pedir carta ya lleva el propio dentro, así que en un turno normal
 *   solo falta el del vecino. Se espera un momento antes de mandarlo —
 *   un reparto a la velocidad de la red son seis cartas en medio segundo,
 *   y lo que se quiere es verlas caer — y bastante más al empezar una
 *   ronda, para que dé tiempo a leer cómo acabó la anterior.
 * - **Al acabar se revela la semilla** (`{t:"s"}`) antes de `terminar`,
 *   porque la regla de la base rechaza cualquier jugada con `fin` escrito.
 *   `auditaFlip7` rehace entonces cada aporte, en todas las pantallas.
 *
 * Lo que se ve es una mesa redonda con un crupier en medio. Tres cosas
 * sostienen la puesta en escena:
 *
 * - **La carta nueva vuela desde el mazo** (`lanza`). Se pinta primero
 *   en su sitio de verdad, oculta (`enVuelo`), y un doble con dos caras
 *   viaja del mazo a ese sitio girándose por el camino; al aterrizar se
 *   destapa la de verdad. Así el destino lo decide el pintado — la fila
 *   de quien la recibe, la vitrina si hay que elegir — y no una copia de
 *   las reglas aquí dentro.
 * - **Lo que pasó sale de comparar el historial** (`nuevosDe`), no del
 *   último suceso: dos «pide» seguidos son iguales, y buscar el último
 *   visto con `lastIndexOf` se comía el segundo.
 * - **La pantalla dice cuándo está ocupada** (`ocupado`): mientras vuela
 *   una carta y mientras se enseña el resumen de la última ronda, el
 *   cartel de fin de partida espera. Si no, quien perdía veía el cartel
 *   antes que la carta que le hizo perder. Con la pestaña detrás no se
 *   anima nada: se guarda lo pendiente y se cuenta al volver (`alVolver`).
 *
 * Al cerrarse una ronda el reductor vacía las filas en el acto; la mesa
 * sigue enseñando cómo quedaron (la vista «fantasma», de `finRonda`)
 * hasta que cae la primera carta de la siguiente, que es cuando se lee.
 *
 * El repintado va por firmas, como en los demás juegos: reescribir el
 * innerHTML en cada tic reiniciaría las animaciones.
 */
import { mazoF7, aporteF7, auditaFlip7, F7_SIETE, F7_BONO } from "./motor.js";
import { suena } from "./sonido.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Lo que se tarda en mandar el propio aporte: entre robos (lo que dura
   el vuelo de la carta y un respiro), y al empezar una ronda nueva, que
   es lo que dura el resumen de la anterior. */
const PAUSA_ROBO = 850;
const PAUSA_RONDA = 4600;
/* Lo que espera un suplente antes de aportar en lugar de alguien que no
   contesta (una pestaña dormida, un móvil bloqueado), y cuánto más el
   siguiente suplente: el que está no pisa al que tarda un poco, y dos
   suplentes no escriben a la vez. */
const SUPLENCIA_MS = 6000;
const SUPLENCIA_PASO = 2000;
/* Cuánto se espera a que los demás revelen su semilla antes de cerrar
   la partida igualmente: quien ya cerró la pestaña no va a hacerlo. */
const ESPERA_SEMILLAS = 6000;
/* El vuelo de una carta, y lo que se deja ver el resumen final antes
   de soltar el cartel de fin de partida. */
const VUELO_MS = 760;
const FIN_MS = 2200;
const ANCHO = 44;             // el ancho de una carta normal, en px

const quieto = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const ACCION = {
  congela: { n: "Congelar", i: "❄", t: "#38bdf8" },
  tres: { n: "Voltea tres", i: "③", t: "#f59e0b" },
  segunda: { n: "Segunda oportunidad", i: "♥", t: "#ec4899" },
  cuatro: { n: "Voltea cuatro", i: "④", t: "#f97316" },
  otra: { n: "Solo una más", i: "☝", t: "#a855f7" },
  cambia: { n: "Intercambio", i: "⇄", t: "#14b8a6" },
  roba: { n: "Robo", i: "✋", t: "#ef4444" },
  tira: { n: "Descarte", i: "✕", t: "#64748b" }
};

/* Un tono por número, del frío al cálido, como en la caja: a la hora de
   buscar el repetido en una fila se mira el color antes que la cifra. */
const TONO = ["#8a97a3", "#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e", "#84cc16", "#eab308",
  "#f59e0b", "#f97316", "#ef4444", "#e11d48", "#d946ef", "#8b5cf6", "#6366f1"];

function nombreCarta(c) {
  if (!c) return "";
  if (c.k === "n") return c.cero ? "el Cero" : c.gafe ? "el 7 gafe" : c.suerte ? "el 13 de la suerte" : "un " + c.v;
  if (c.k === "m") return c.doble ? "×2" : c.mitad ? "÷2" : (c.v > 0 ? "+" : "−") + Math.abs(c.v);
  return "«" + ACCION[c.a].n + "»";
}

const DORSO = `<i><b>7</b></i>`;

/* Una carta. Siempre lleva `data-c` con su índice en el mazo: por ahí
   la encuentra el vuelo, esté en una fila, en la vitrina o en el
   resumen. Sin carta, un dorso. */
function htmlCarta(c, clases, attrs, estilo) {
  if (!c) return `<div class="jg-f7-c jg-f7-dorso ${clases || ""}" style="${estilo || ""}">${DORSO}</div>`;
  let cara, tipo, st = estilo || "";
  const titulo = nombreCarta(c);
  if (c.k === "n") {
    tipo = "num" + (c.cero ? " jg-f7-cero" : c.gafe ? " jg-f7-gafe" : c.suerte ? " jg-f7-suerte" : "");
    st += `;--t:${TONO[c.v] || TONO[0]}`;
    const cifra = c.cero ? "∅" : String(c.v);
    const lema = c.gafe ? "gafe" : c.suerte ? "suerte" : c.cero ? "cero" : "";
    cara = `<span class="jg-f7-esq">${cifra}</span><b class="jg-f7-cifra">${cifra}</b>`
      + (lema ? `<i class="jg-f7-lema">${lema}</i>` : "") + `<span class="jg-f7-esq2">${cifra}</span>`;
  } else if (c.k === "m") {
    tipo = "mod" + (c.v < 0 || c.mitad ? " jg-f7-neg" : "");
    const t = c.doble ? "×2" : c.mitad ? "÷2" : (c.v > 0 ? "+" : "−") + Math.abs(c.v);
    cara = `<span class="jg-f7-esq">${t}</span><b class="jg-f7-cifra">${t}</b><i class="jg-f7-lema">${c.doble || c.mitad ? "multiplica" : "suma"}</i>`;
  } else {
    const a = ACCION[c.a];
    tipo = "acc jg-f7-" + c.a;
    st += `;--t:${a.t}`;
    cara = `<b class="jg-f7-icono">${a.i}</b><i class="jg-f7-lema">${esc(a.n)}</i>`;
  }
  return `<div ${attrs || ""} data-c="${c.i}" class="jg-f7-c jg-f7-${tipo} ${clases || ""}" style="${st}" title="${esc(titulo)}">${cara}</div>`;
}

/* El crupier, de pie al otro lado de la mesa. Mira a quien espera la
   mesa (`--ox`/`--oy` en las pupilas, `--rz` en la cabeza). El brazo con
   el que reparte no está en el dibujo: es `#f7Brazo`, HTML, porque tiene
   que alargarse hasta el asiento y pasar por encima del paño, y el
   dibujo queda detrás de la mesa, que le tapa la cintura. */
const CRUPIER = `
<svg class="jg-f7-crupier" id="f7Crupier" viewBox="-20 0 160 130" aria-hidden="true">
  <path d="M-2 130 C0 102 18 84 44 78 L60 76 L76 78 C102 84 120 102 122 130 Z" fill="#6b1f2a"/>
  <path d="M26 88 C30 84 38 80 44 78 L50 96 Z M94 88 C90 84 82 80 76 78 L70 96 Z" fill="#561824"/>
  <path d="M47 77 L60 104 L73 77 Z" fill="#f7f3ea"/>
  <path d="M60 104 L60 130" stroke="#4a141d" stroke-width="1.2"/>
  <circle cx="60" cy="110" r="1.7" fill="#e8b64a"/><circle cx="60" cy="118" r="1.7" fill="#e8b64a"/><circle cx="60" cy="126" r="1.7" fill="#e8b64a"/>
  <path d="M51 78 L60 82.5 L51 87 Z M69 78 L60 82.5 L69 87 Z" fill="#17131c"/><circle cx="60" cy="82.5" r="2.4" fill="#17131c"/>
  <rect x="76" y="98" width="17" height="6" rx="1.5" fill="#e8b64a"/><rect x="78" y="100" width="13" height="2" rx="1" fill="#9a6d1c"/>
  <path d="M20 94 C10 104 8 118 12 130" stroke="#6b1f2a" stroke-width="15" fill="none" stroke-linecap="round"/>
  <circle cx="102" cy="93" r="8.5" fill="#6b1f2a"/>
  <g class="jg-f7-cabeza">
    <rect x="54" y="58" width="12" height="16" rx="4" fill="#dca57c"/>
    <circle cx="39.5" cy="46" r="4" fill="#e6b087"/><circle cx="80.5" cy="46" r="4" fill="#e6b087"/>
    <circle cx="60" cy="44" r="20" fill="#f0bf94"/>
    <path d="M40 42 C40 26 50 20 60 20 C72 20 81 27 80 42 C76 34 70 31 60 31 C50 31 44 34 40 42 Z" fill="#2b1d18"/>
    <path d="M36 35 C44 29 76 29 84 35 L84 38 C76 34 44 34 36 38 Z" fill="#1f8a5a" opacity=".8"/>
    <path d="M47 38 L56 37 M64 37 L73 38" stroke="#2b1d18" stroke-width="2" stroke-linecap="round"/>
    <g class="jg-f7-ojos"><circle cx="52" cy="44" r="2.2" fill="#1d1a24"/><circle cx="68" cy="44" r="2.2" fill="#1d1a24"/></g>
    <g class="jg-f7-parpado"><rect x="48.5" y="40.5" width="7" height="7" rx="3" fill="#f0bf94"/><rect x="64.5" y="40.5" width="7" height="7" rx="3" fill="#f0bf94"/></g>
    <path d="M51 53 C55 50 58 51 60 52 C62 51 65 50 69 53 C65 54 62 54 60 53 C58 54 55 54 51 53 Z" fill="#3a2620"/>
    <path d="M54 57 C57 60 63 60 66 57" stroke="#a0513f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

/* Lo impreso en el paño: la regla que paga, en arco como en las mesas
   de casino, y el nombre del juego debajo. */
const LEMA = `
<svg class="jg-f7-lema-m" viewBox="0 0 560 130" aria-hidden="true">
  <path id="f7Arco" d="M30 18 Q280 118 530 18" fill="none"/>
  <path d="M22 30 Q280 132 538 30" fill="none" stroke="#e8c56a" stroke-opacity=".28" stroke-width="1.2"/>
  <text class="jg-f7-lema-t"><textPath href="#f7Arco" startOffset="50%" text-anchor="middle">SIETE NÚMEROS DISTINTOS PAGAN +${F7_BONO}</textPath></text>
  <text class="jg-f7-lema-l" x="280" y="112" text-anchor="middle">FLIP 7</text>
</svg>`;

/* Dónde se sienta cada uno, en % de la sala, de derecha a izquierda (el
   sentido en que reparte el crupier, que está arriba). Hechas a mano por
   número de jugadores: un arco calculado dejaba siempre a alguien encima
   del zapato o fuera del paño. */
const PUESTOS = {
  1: [[50, 72]],
  2: [[70, 70], [30, 70]],
  3: [[82, 55], [50, 76], [18, 55]],
  4: [[85, 50], [62, 78], [38, 78], [15, 50]],
  5: [[87, 43], [72, 70], [50, 83], [28, 70], [13, 43]],
  6: [[86.5, 36], [77, 61], [62, 85], [38, 85], [23, 61], [13.5, 36]]
};
const ALTO_SALA = n => n <= 2 ? 640 : n <= 4 ? 700 : 780;

/* Qué sucesos del historial son nuevos. El historial es una cola de 40:
   al llenarse, cada suceso nuevo empuja uno viejo por delante. Se busca
   el menor desplazamiento con el que lo que ya había casa con el
   principio de lo que hay, y lo que sobra por detrás es lo nuevo. */
function nuevosDe(prev, cur) {
  const a = prev.map(x => JSON.stringify(x)), b = cur.map(x => JSON.stringify(x));
  for (let d = 0; d <= a.length; d++) {
    const k = a.length - d;
    if (k > b.length) continue;
    let igual = true;
    for (let i = 0; i < k; i++) if (a[d + i] !== b[i]) { igual = false; break; }
    if (igual) return cur.slice(k);
  }
  return cur.slice();
}

export function crearFlip7(ctx) {
  const { uid, jugar, terminar, secreto } = ctx;

  let host = null, muerto = false;
  let p = null, est = null, M = null;
  let sec = null, secPedido = false, secListo = false;
  let enviando = false;
  let enviadoN = -1;           // robo cuyo aporte ya salió de esta pestaña
  let reloj = null, relojN = -1;
  let roboN = -1, roboT = 0;   // el robo pendiente y cuándo lo vio esta pestaña
  let rondaVista = 0, tRonda = 0;
  let sel1 = null;             // primera carta del intercambio, aún sin pareja
  let tramposos = [], auditando = false, firmaAudit = "";
  let cerrando = false, finVisto = 0, relojFin = null;
  const firmas = {};

  /* La puesta en escena. */
  let histPrev = [], ultimaN = -1, primera = true;
  const enVuelo = new Set();   // cartas pintadas en su sitio pero aún en el aire
  let vuelos = 0, finHasta = 0;
  let vioJugar = false, finAnimado = false;
  let pendiente = null;        // lo que pasó con la pestaña detrás
  let resumenR = 0, relojRes = null, resumenFijo = false, relojListo = null;
  let firmaOrden = "";
  const angulo = {};           // uid → ángulo de su asiento, en grados
  const temporizadores = new Set();

  const ocupado = () => vuelos > 0 || Date.now() < finHasta;
  const luego = (f, ms) => { const t = setTimeout(() => { temporizadores.delete(t); if (!muerto) f(); }, ms); temporizadores.add(t); return t; };
  const $ = sel => host && host.querySelector(sel);

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-f7">
        <div class="jg-barra">
          <div class="jg-fase" id="f7Fase"></div>
          <div class="jg-grow"></div>
          <div class="jg-f7-modo" id="f7Modo"></div>
        </div>
        <div id="f7Trampa"></div>
        <div class="jg-tablero jg-f7-tablero">
          <div class="jg-f7-sala" id="f7Sala">
            <div class="jg-f7-luz"></div>
            <div class="jg-f7-crup">
              ${CRUPIER}
              <div class="jg-f7-brazo" id="f7Brazo"><i class="jg-f7-manga"><b class="jg-f7-mano-d"></b></i></div>
            </div>
            <div class="jg-f7-mesa-o"></div>
            ${LEMA}
            <div class="jg-f7-riel">
              <div class="jg-f7-pila jg-f7-bandeja" id="f7Desc"></div>
              <div class="jg-f7-vitrina" id="f7Vitrina"></div>
              <div class="jg-f7-pila jg-f7-sabot" id="f7Mazo"></div>
            </div>
            <div class="jg-f7-info" id="f7Info"></div>
            <div id="f7Asientos"></div>
            <div class="jg-f7-resumen" id="f7Resumen"></div>
            <div class="jg-f7-vuelos" id="f7Vuelos"></div>
            <div class="jg-f7-fx" id="f7Fx"></div>
          </div>
        </div>
        <div class="jg-pie" id="f7Pie"></div>
        <div class="jg-f7-hist" id="f7Hist"></div>
      </div>`;
    host.addEventListener("click", alClic);
    document.addEventListener("visibilitychange", alVolver);
    pideSecreto();
  }

  function destruir() {
    muerto = true;
    clearTimeout(reloj); clearTimeout(relojFin); clearTimeout(relojRes); clearTimeout(relojListo);
    for (const t of temporizadores) clearTimeout(t);
    temporizadores.clear();
    document.removeEventListener("visibilitychange", alVolver);
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  function pideSecreto() {
    if (secPedido || !secreto) return;
    secPedido = true;
    Promise.resolve().then(() => secreto())
      .then(s => { sec = s || null; })
      .catch(() => { sec = null; })
      .then(() => { secListo = true; if (!muerto && est) actualizar(p, est); });
  }

  /* ---------- quién es quién ---------- */
  const jugador = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombre = u => u === uid ? "tú" : ((jugador(u) || {}).nombre || "alguien");
  const Nombre = u => { const s = nombre(u); return s.charAt(0).toUpperCase() + s.slice(1); };
  const juego = () => !!jugador(uid) && !(est.fuera || {})[uid];

  /* La semilla con la que aporto. Una sala sin secreto guardado (abierta
     a mano en la base, o antes de que esto existiera) cae a una que sale
     de la pública: se puede jugar, y la auditoría dirá que no cuadra con
     la ficha, que es la verdad. */
  function miSemilla() {
    if (sec && sec.sem != null) return { sem: sec.sem >>> 0, sal: sec.sal || "" };
    const y = jugador(uid);
    if (!p || !y) return null;
    return { sem: ((p.semilla >>> 0) ^ Math.imul((y.orden || 0) + 1, 0x9E3779B1)) >>> 0, sal: "" };
  }

  const carta = id => (M && id != null ? M[id] : null);

  /* ---------- pintado ---------- */
  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
  }

  /* Las filas de la ronda que acaba de cerrarse, mientras la nueva aún
     no tiene ninguna carta: el reductor ya las vació, pero es justo lo
     que se quiere estar mirando. */
  function fantasma() {
    const f = est.finRonda, w = est.espera;
    if (est.fase !== "jugando" || !f || f.r !== est.ronda - 1) return false;
    /* Sólo mientras el crupier reparte. Si la ronda nueva ya pide algo a
       alguien —un comodín que elige a quién va, o un turno con todas las
       filas vacías porque el reparto fue todo acciones—, la mesa tiene
       que ser la de ahora: con la de la ronda pasada no había botones de
       objetivo ni de turno y la partida se quedaba parada para siempre. */
    if (!w || w.k !== "roba") return false;
    return est.jugadores.every(j => {
      const l = est.lineas[j.uid];
      return !l || (!l.nums.length && !l.mods.length && l.seg == null);
    });
  }

  function pinta() {
    if (!host || !est) return;
    set("f7Fase", textoFase(), esc(textoFase()));
    const modo = est.modo === "venganza" ? "Con venganza" : "Normal";
    set("f7Modo", modo + est.ronda, `<span class="jg-f7-etq${est.modo === "venganza" ? " jg-f7-v" : ""}">${modo}</span>
      ${est.ronda ? `<span class="jg-nota">Ronda ${est.ronda} · a ${est.meta}</span>` : ""}`);
    set("f7Trampa", tramposos.map(t => t.uid + t.que).join(","), avisoTrampa());
    const fant = fantasma();
    pintaCentro();
    pintaAsientos(fant);
    pintaPie();
    pintaHist();
    /* Las que siguen en el aire no se ven en su sitio todavía. */
    for (const id of enVuelo) {
      host.querySelectorAll(`#f7Asientos [data-c="${id}"], #f7Vitrina [data-c="${id}"]`).forEach(el => el.classList.add("jg-f7-oculta"));
    }
    if (!resumenFijo && !fant && est.fase === "jugando") escondeResumen();
    mira(aQuienEspera(fant));
    reposa();
  }

  /* El brazo en reposo: la mano apoyada en el paño junto al zapato, sin
     tapar la carta de arriba ni la cuenta. Se mide en vez de
     escribirse porque el zapato cambia de sitio con el ancho (en el
     móvil queda debajo del crupier, no a su derecha). */
  let reposo = { ang: 40, l: 90 };
  function reposa() {
    const b = $("#f7Brazo"), z = $("#f7Mazo");
    if (!b || !z || vuelos > 0) return;
    const rb = b.getBoundingClientRect(), rz = z.getBoundingClientRect();
    if (!rz.width) return;
    const dx = rz.left - 14 - rb.left, dy = rz.top + rz.height * 0.55 - rb.top;
    reposo = { ang: Math.atan2(dy, dx) * 180 / Math.PI, l: Math.max(30, Math.hypot(dx, dy) - 6) };
    b.style.setProperty("--ang", reposo.ang.toFixed(1) + "deg");
    b.style.setProperty("--l", reposo.l.toFixed(0) + "px");
  }

  function textoFase() {
    if (est.fase === "espera") return "Esperando a que empiece la partida…";
    if (est.fase === "fin") {
      if (est.motivo === "abandono") return est.ganador === uid ? "¡Ganas! Los demás se fueron." : "Partida terminada por abandono.";
      return est.ganador === uid ? `¡Ganas con ${est.puntos[uid]} puntos!` : `Gana ${nombre(est.ganador)} con ${est.puntos[est.ganador]}.`;
    }
    const w = est.espera;
    if (!w) return "…";
    if (w.k === "decide") return w.uid === uid ? "Te toca: ¿pides o te plantas?" : `Le toca a ${nombre(w.uid)}.`;
    if (w.k === "elige") return w.quien === uid ? `Tienes ${nombreCarta(carta(w.id))}: elige.` : `${Nombre(w.quien)} decide qué hacer con ${nombreCarta(carta(w.id))}.`;
    if (w.de === "reparto") return `Repartiendo a ${nombre(w.para)}…`;
    if (w.serie) return `${Nombre(w.para)} voltea: ${w.serie.total - w.serie.quedan} de ${w.serie.total}…`;
    return `Carta para ${nombre(w.para)}…`;
  }

  function avisoTrampa() {
    const graves = tramposos.filter(t => t.que !== "oculta");
    if (graves.length) {
      const t = graves[0];
      return `<div class="jg-trampa">${t.que === "semilla"
        ? `La semilla que reveló ${esc(nombre(t.uid))} al acabar no es la que prometía al entrar.`
        : `Un aporte de ${esc(nombre(t.uid))} (carta ${t.n + 1}) no sale de su semilla: escogió la carta.`} La partida ya no vale.</div>`;
    }
    const ocultas = tramposos.filter(t => t.que === "oculta");
    if (!ocultas.length) return "";
    return `<div class="jg-f7-aviso">${ocultas.map(t => esc(Nombre(t.uid))).join(", ")} no ${ocultas.length === 1 ? "reveló su semilla" : "revelaron su semilla"} al acabar
      (¿pestaña cerrada?), así que sus aportes no se han podido comprobar.</div>`;
  }

  /* El riel del crupier: la bandeja del descarte, la vitrina (la carta
     que espera a que alguien decida qué hacer con ella, sobre su marca
     impresa en el paño) y el zapato del que reparte. */
  function pintaCentro() {
    const mon = est.monton ?? 0, des = est.descarte ?? 0;
    const altura = Math.min(4, Math.ceil(mon / 20));
    set("f7Mazo", "m" + altura + ":" + mon, altura
      ? Array.from({ length: altura }, (_, k) => htmlCarta(null, k === altura - 1 ? "jg-f7-tope" : "", "", `--k:${k}`)).join("")
        + `<span class="jg-f7-cuenta">${mon}</span>`
      : `<div class="jg-f7-hueco">vacío</div><span class="jg-f7-cuenta">0</span>`);
    const alto = Math.min(3, Math.ceil(des / 15));
    set("f7Desc", "d" + alto + ":" + des, alto
      ? Array.from({ length: alto }, (_, k) => htmlCarta(null, "jg-f7-tirada", "", `--k:${k}`)).join("")
        + `<span class="jg-f7-cuenta">${des} fuera</span>`
      : `<div class="jg-f7-hueco">descarte</div>`);
    const w = est.espera, eli = est.fase === "jugando" && w && w.k === "elige";
    set("f7Vitrina", eli ? "v" + w.id + w.quien : "v-", eli
      ? htmlCarta(carta(w.id), "jg-f7-grande" + (w.quien === uid ? " jg-f7-mia" : "")) + `<span class="jg-f7-de">${w.quien === uid ? "la tuya" : "de " + esc(nombre(w.quien))}</span>`
      : `<div class="jg-f7-hueco jg-f7-hueco-g"><b>7</b></div>`);
    const info = est.ronda
      ? `Ronda ${est.ronda} · reparte ${esc(est.reparte === uid ? "tú" : (jugador(est.reparte) || {}).nombre || "—")}`
      : est.fase === "espera" ? "La mesa está abierta" : "";
    set("f7Info", info, info);
  }

  /* A quién mira el crupier: al que tiene que decidir, al que elige a
     quién va una carta, o al que la va a recibir. */
  function aQuienEspera(fant) {
    const w = est.espera;
    if (est.fase === "fin") return est.ganador;
    if (!w || fant) return null;
    return w.k === "decide" ? w.uid : w.k === "elige" ? w.quien : w.para;
  }

  function mira(u) {
    const cr = $("#f7Crupier");
    if (!cr) return;
    const a = u != null && angulo[u] != null ? angulo[u] * Math.PI / 180 : null;
    cr.style.setProperty("--ox", a == null ? "0px" : (Math.cos(a) * 2.4).toFixed(2) + "px");
    cr.style.setProperty("--oy", a == null ? "0px" : (Math.sin(a) * 1.8).toFixed(2) + "px");
    cr.style.setProperty("--rz", a == null ? "0deg" : (Math.cos(a) * 8).toFixed(2) + "deg");
  }

  /* Qué cartas de la mesa se pueden tocar ahora mismo: solo cuando me
     toca elegir una carta (robo, descarte o intercambio). */
  function elegibles() {
    const w = est.espera;
    if (est.fase !== "jugando" || !w || w.k !== "elige" || w.quien !== uid || w.op.tipo === "a") return null;
    const o = {};
    for (const u in w.op.cartas) {
      if (sel1 && w.op.tipo === "2" && u === sel1.u) continue;
      o[u] = w.op.cartas[u];
    }
    return o;
  }

  /* Los asientos, en la media luna frente al crupier: yo en el centro
     del arco, los demás en el orden de la mesa de derecha a izquierda,
     que es como reparte un crupier. Las cajas se rehacen solo cuando
     cambia quién se sienta; lo de dentro va por firma. */
  function ordenMesa() {
    const js = est.jugadores.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const i = js.findIndex(j => j.uid === uid);
    return i > 0 ? js.slice(i).concat(js.slice(0, i)) : js;
  }

  function pintaAsientos(fant) {
    const js = ordenMesa(), N = js.length;
    const orden = js.map(j => j.uid).join(",");
    const cont = $("#f7Asientos"), sala = $("#f7Sala");
    if (!cont) return;
    if (orden !== firmaOrden) {
      firmaOrden = orden;
      sala.classList.toggle("jg-f7-muchos", N > 2);
      sala.dataset.n = Math.min(6, Math.max(1, N));
      const pos = PUESTOS[Math.min(6, Math.max(1, N))], m = Math.floor((N - 1) / 2);
      cont.innerHTML = js.map((j, i) => {
        const [x, y] = pos[(m + i) % pos.length];
        /* Visto desde la cabeza del crupier, que está arriba en el centro. */
        angulo[j.uid] = Math.atan2(y / 100 * ALTO_SALA(N) - 62, (x - 50) * 10) * 180 / Math.PI;
        return `<div class="jg-f7-asiento${j.uid === uid ? " jg-f7-yo" : ""}" id="f7S${i}" data-u="${esc(j.uid)}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%"></div>`;
      }).join("");
      for (const k in firmas) if (/^f7S\d/.test(k)) delete firmas[k];
    }
    const w = est.espera, el = elegibles();
    const apuntables = w && w.k === "elige" && w.quien === uid && w.op.tipo === "a" ? w.op.uids : [];
    const f = est.finRonda;
    js.forEach((j, i) => {
      const fuera = !!(est.fuera || {})[j.uid];
      const l = fant ? Object.assign({ seg: null, congelado: false }, f.lineas[j.uid] || { nums: [], mods: [], estado: "fuera" })
        : est.lineas[j.uid] || { nums: [], mods: [], estado: "fuera" };
      const turno = !fant && est.fase === "jugando" && w && ((w.k === "decide" && w.uid === j.uid) || (w.k === "elige" && w.quien === j.uid) || (w.k === "roba" && w.para === j.uid));
      const puede = !fant && el && el[j.uid] ? el[j.uid] : [];
      const apunta = !fant && apuntables.includes(j.uid);
      const estado = fuera ? "fuera"
        : l.f7 ? "¡Flip 7!"
        : l.estado === "pasa" ? "se pasó"
        : l.congelado ? "congelado"
        : l.estado === "planta" ? "plantado"
        : fant ? "en pie"
        : est.ronda ? "en juego" : "";
      const cls = "jg-f7-jug" + (turno ? " jg-f7-turno" : "") + (l.estado === "pasa" ? " jg-f7-pasado" : "")
        + (l.estado === "planta" ? " jg-f7-plantado" : "") + (l.f7 ? " jg-f7-siete" : "") + (apunta ? " jg-f7-apuntable" : "")
        + (fuera ? " jg-f7-fuera" : "") + (fant ? " jg-f7-fantasma" : "");
      const pts = est.puntos[j.uid] || 0;
      const vale = fant ? (f.pts[j.uid] || 0) : (est.valor[j.uid] || 0);
      const n = l.nums.length;
      const paso = n > 1 ? Math.min(40, (160 - ANCHO) / (n - 1)) : 0;
      const nums = l.nums.map((id, k) => {
        const d = k - (n - 1) / 2;
        const ok = puede.includes(id), s = sel1 && sel1.id === id && sel1.u === j.uid;
        return htmlCarta(carta(id), (ok ? "jg-f7-elegible" : "") + (s ? " jg-f7-sel" : ""),
          ok || s ? `data-u="${esc(j.uid)}" data-id="${id}"` : "",
          `--r:${(d * 4).toFixed(1)}deg;--y:${(d * d * 0.9).toFixed(1)}px;margin-left:${k ? (paso - ANCHO).toFixed(1) : 0}px;z-index:${k + 1}`);
      }).join("");
      const minis = l.mods.map(id => {
        const ok = puede.includes(id), s = sel1 && sel1.id === id && sel1.u === j.uid;
        return htmlCarta(carta(id), "jg-f7-mini" + (ok ? " jg-f7-elegible" : "") + (s ? " jg-f7-sel" : ""), ok || s ? `data-u="${esc(j.uid)}" data-id="${id}"` : "");
      }).join("") + (l.seg != null ? htmlCarta(carta(l.seg), "jg-f7-mini jg-f7-guardada") : "");
      const foto = j.foto && /^(https?:|data:image\/)/.test(j.foto)
        ? `<img src="${esc(j.foto)}" alt="" referrerpolicy="no-referrer">` : esc((j.nombre || "?").charAt(0).toUpperCase());
      const firma = [fant, j.nombre, j.color, j.foto, l.nums.join(","), l.mods.join(","), l.seg, l.estado, l.f7, l.congelado, pts,
        vale, turno, apunta, puede.join(","), sel1 && sel1.u === j.uid ? sel1.id : "", fuera, est.reparte === j.uid].join(":");
      set("f7S" + i, firma, `<div class="${cls}" style="--c:${esc(j.color || "#888")}" ${apunta ? `data-apunta="${esc(j.uid)}"` : ""}>
        <div class="jg-f7-placa">
          <span class="jg-f7-ava">${foto}</span>
          <span class="jg-f7-quien"><b>${esc(j.uid === uid ? "Tú" : j.nombre)}</b><span class="jg-f7-est">${esc(estado)}</span></span>
          ${est.reparte === j.uid && est.ronda ? `<span class="jg-f7-dealer" title="Reparte esta ronda">D</span>` : ""}
          <span class="jg-f7-total" title="Puntos de la partida"><b>${pts}</b>/${est.meta}</span>
        </div>
        <div class="jg-f7-barra"><i style="width:${Math.min(100, pts / est.meta * 100)}%"></i></div>
        <div class="jg-f7-mano">${nums || (fuera ? "" : `<span class="jg-f7-vacia" title="Sin cartas"></span>`)}</div>
        ${minis ? `<div class="jg-f7-extras">${minis}</div>` : ""}
        <div class="jg-f7-pie-j">
          <span class="jg-f7-siete-p" title="Números distintos: ${n} de ${F7_SIETE}">${Array.from({ length: F7_SIETE }, (_, k) => `<i class="${k < n ? "on" : ""}"></i>`).join("")}</span>
          <span class="jg-grow"></span>
          <span title="${fant ? "Lo que sumó la ronda pasada" : "Lo que se lleva si la ronda acabara ahora"}">${fant ? "sumó" : "vale"} <b>${fant ? "+" : ""}${vale}</b></span>
        </div>
        ${apunta ? `<button class="jg-btn jg-f7-apunta" data-apunta="${esc(j.uid)}">${j.uid === uid ? "A mí" : "A " + esc(j.nombre)}</button>` : ""}
      </div>`);
    });
  }

  function pintaPie() {
    const w = est.espera;
    let firma, html;
    if (est.fase === "espera") { firma = "esp"; html = `<span class="jg-nota">Pásale el enlace de la sala a quien quieras; empieza cuando quien la abrió lo diga.</span>`; }
    else if (est.fase === "fin") { firma = "fin"; html = `<span class="jg-nota">Partida terminada.</span>`; }
    else if (!juego()) { firma = "mira"; html = `<span class="jg-nota">${jugador(uid) ? "Has abandonado esta partida." : "Estás mirando."}</span>`; }
    else if (w && w.k === "decide" && w.uid === uid) {
      const listo = secListo && !enviando;
      firma = "dec" + w.cero + listo + est.valor[uid];
      html = `<button class="jg-btn jg-f7-pide" id="f7Pide"${listo ? "" : " disabled"}><span>✋</span> Pedir carta</button>
        <button class="jg-btn jg-f7-planta" id="f7Planta"${w.cero || !listo ? " disabled" : ""}><span>✊</span> Plantarme con ${est.valor[uid] || 0}</button>
        <span class="jg-nota">${w.cero ? "Tienes el Cero: no puedes plantarte. O haces Flip 7, o esta ronda no suma." : "Si repites un número te pasas y la ronda no te da nada."}</span>`;
    } else if (w && w.k === "elige" && w.quien === uid) {
      const c = carta(w.id);
      firma = "eli" + w.id + (sel1 ? sel1.u + sel1.id : "");
      html = `${htmlCarta(c, "jg-f7-mini")}<span class="jg-nota">${esc(textoEleccion(c, w.op))}</span>
        ${sel1 ? `<button class="jg-btn jg-f7-anula" id="f7Anula">Cambiar la primera</button>` : ""}`;
    } else {
      firma = "otro";
      html = `<span class="jg-nota">Pide carta cuando sea tu turno. Siete números distintos cierran la ronda con +15; un repetido y te quedas sin nada.</span>`;
    }
    set("f7Pie", firma, html);
  }

  function textoEleccion(c, op) {
    if (c.k === "m") return `¿A quién le pones ${nombreCarta(c)}?`;
    if (op.tipo === "2") return sel1 ? "Ahora una carta de otro jugador para intercambiarlas." : "Elige dos cartas de dos jugadores distintos para intercambiarlas.";
    return {
      congela: "¿A quién congelas? Se planta con lo que tiene.",
      tres: "¿Quién voltea tres cartas seguidas?",
      cuatro: "¿Quién voltea cuatro cartas seguidas?",
      segunda: "¿A quién le regalas la segunda oportunidad?",
      otra: "¿Quién voltea una más y se planta?",
      roba: "Elige la carta de otro jugador que te quedas.",
      tira: "Elige la carta de la mesa que se descarta."
    }[c.a] || "Elige.";
  }

  /* El historial va en tercera persona: con «tú» cada verbo tendría que
     conjugarse aparte, y «Tú pide carta» es lo que salía. */
  function textoSuceso(h) {
    const c = h.id != null ? nombreCarta(carta(h.id)) : "";
    const nombre = u => ((jugador(u) || {}).nombre || "alguien") + (u === uid ? " (tú)" : "");
    const Nombre = nombre, mismo = h.a === h.uid;
    switch (h.e) {
      case "ronda": return `— Ronda ${h.r}, reparte ${nombre(h.uid)} —`;
      case "carta": return `${Nombre(h.uid)}: ${c}.`;
      case "pide": return `${Nombre(h.uid)} pide carta.`;
      case "planta": return `${Nombre(h.uid)} se planta.`;
      case "pasa": return `${Nombre(h.uid)} se pasa${c ? ` con ${c}` : ""}.`;
      case "salva": return `${Nombre(h.uid)} gasta la segunda oportunidad contra ${c}.`;
      case "f7": return `¡${Nombre(h.uid)} hace Flip 7! +15`;
      case "gafe": return `El 7 gafe deja a ${nombre(h.uid)} solo con el 7.`;
      case "aparta": return `${Nombre(h.uid)} aparta ${c} hasta acabar la serie.`;
      case "da": return mismo ? `${Nombre(h.uid)} se queda ${c}.` : `${Nombre(h.uid)} le pone ${c} a ${nombre(h.a)}.`;
      case "congela": return mismo ? `${Nombre(h.uid)} se congela.` : `${Nombre(h.uid)} congela a ${nombre(h.a)}.`;
      case "tres": case "cuatro": return mismo ? `${Nombre(h.uid)} voltea ${h.e} cartas.` : `${Nombre(h.uid)} hace voltear ${h.e} a ${nombre(h.a)}.`;
      case "regala": return `${Nombre(h.uid)} le da la segunda oportunidad a ${nombre(h.a)}.`;
      case "otra": return mismo ? `${Nombre(h.uid)} voltea una más y se planta.` : `${Nombre(h.uid)}: ${nombre(h.a)} voltea una más y se planta.`;
      case "roba": return `${Nombre(h.uid)} le roba ${c} a ${nombre(h.a)}.`;
      case "tira": return mismo ? `${Nombre(h.uid)} descarta ${c} de su propia fila.` : `${Nombre(h.uid)} descarta ${c} de ${nombre(h.a)}.`;
      case "cambia": return `${Nombre(h.uid)} cambia ${nombreCarta(carta(h.c))} de ${nombre(h.a)} por ${nombreCarta(carta(h.d))} de ${nombre(h.b)}.`;
      case "nada": return `${c.charAt(0).toUpperCase() + c.slice(1)} de ${nombre(h.uid)} no tiene a quién ir.`;
      case "baraja": return "Se baraja el descarte.";
      case "cierra": return `Fin de la ronda ${h.r}.`;
      case "abandona": return `${Nombre(h.uid)} abandona.`;
    }
    return "";
  }

  function pintaHist() {
    const h = (est.hist || []).slice(-12).reverse();
    set("f7Hist", JSON.stringify(h), h.length
      ? `<div class="jg-f7-hist-t">Lo último</div>` + h.map(x => `<div class="jg-f7-h jg-f7-h-${x.e}">${esc(textoSuceso(x))}</div>`).join("")
      : "");
  }

  /* ---------- la puesta en escena ---------- */

  /* Dónde está una carta ahora mismo, en el pintado de verdad. */
  const sitioDe = id => $(`#f7Asientos [data-c="${id}"]`) || $(`#f7Vitrina [data-c="${id}"]`);
  const asientoDe = u => {
    if (!host) return null;
    for (const s of host.querySelectorAll(".jg-f7-asiento")) if (s.dataset.u === u) return s;
    return null;
  };

  function destapa(id) {
    enVuelo.delete(id);
    const el = sitioDe(id);
    if (!el) return;
    el.classList.remove("jg-f7-oculta");
    el.classList.remove("jg-f7-cae");
    void el.offsetWidth;                  // para que la animación vuelva a empezar
    el.classList.add("jg-f7-cae");
  }

  /* El crupier lanza la carta `id` hacia `para`; al aterrizar se cuentan
     los sucesos `ev` que trajo. */
  function lanza(id, para, ev) {
    const sala = $("#f7Sala"), capa = $("#f7Vuelos"), tope = $("#f7Mazo .jg-f7-tope") || $("#f7Mazo");
    const c = carta(id);
    if (quieto() || !sala || !capa || !tope || typeof Element.prototype.animate !== "function" || !c) {
      destapa(id);
      efectos(ev, true);
      trasVuelos();
      return;
    }
    vuelos++;
    const rs = sala.getBoundingClientRect(), ro = tope.getBoundingClientRect();
    const destino = sitioDe(id);
    let dx, dy, esc2 = 0.6, giro = 0, desvanece = false;
    const ox = ro.left + ro.width / 2 - rs.left, oy = ro.top + ro.height / 2 - rs.top;
    if (destino) {
      const rd = destino.getBoundingClientRect();
      dx = rd.left + rd.width / 2 - rs.left - ox;
      dy = rd.top + rd.height / 2 - rs.top - oy;
      esc2 = (destino.offsetWidth || ANCHO) / ANCHO;
      giro = parseFloat(destino.style.getPropertyValue("--r")) || 0;
    } else {
      /* Una carta que no se queda en la mesa (una acción que ya se
         aplicó, una segunda oportunidad gastada): va hacia su asiento y
         se desvanece. */
      const s = asientoDe(para);
      const rd = s ? s.getBoundingClientRect() : rs;
      dx = rd.left + rd.width / 2 - rs.left - ox;
      dy = rd.top + rd.height / 2 - rs.top - oy;
      desvanece = true;
    }
    /* El crupier estira el brazo hacia el asiento, la carta sale del
       zapato a su mano boca abajo y desde ahí se lanza, volteándose. */
    const brazo = $("#f7Brazo"), manga = brazo && brazo.querySelector(".jg-f7-manga");
    let hx = ox, hy = oy, hombro = null;
    if (brazo && manga && brazo.animate) {
      reposa();
      const rh = brazo.getBoundingClientRect();
      hombro = { x: rh.left - rs.left, y: rh.top - rs.top };
      const tx = ox + dx - hombro.x, ty = oy + dy - hombro.y;
      let th = Math.atan2(ty, tx) * 180 / Math.PI;
      if (th < -90) th += 360;
      const lejos = Math.hypot(tx, ty);
      const alcance = Math.min(250, lejos - 40, Math.max(90, lejos * 0.55));
      const r = th * Math.PI / 180;
      if (alcance > reposo.l) {
        hx = hombro.x + Math.cos(r) * alcance;
        hy = hombro.y + Math.sin(r) * alcance;
        const ang0 = `rotate(${reposo.ang.toFixed(1)}deg)`, ang1 = `rotate(${th.toFixed(1)}deg)`;
        brazo.animate([{ transform: ang0 }, { transform: ang1, offset: 0.35 }, { transform: ang1, offset: 0.5 }, { transform: ang0 }],
          { duration: VUELO_MS, easing: "ease-in-out" });
        const l0 = reposo.l.toFixed(0) + "px", l1 = alcance.toFixed(0) + "px";
        manga.animate([{ width: l0 }, { width: l1, offset: 0.35 }, { width: l1, offset: 0.5 }, { width: l0 }],
          { duration: VUELO_MS, easing: "ease-in-out" });
      }
    }
    const v = document.createElement("div");
    v.className = "jg-f7-vuelo";
    v.style.left = (ox - ANCHO / 2) + "px";
    v.style.top = (oy - 31) + "px";
    v.innerHTML = `<div class="jg-f7-vuelo-in">${htmlCarta(null, "jg-f7-cara-a")}${htmlCarta(c, "jg-f7-cara-b")}</div>`;
    capa.appendChild(v);
    const px = hx - ox, py = hy - oy;
    const mx = (px + dx) / 2, my = (py + dy) / 2 - 30;
    const anim = v.animate([
      { transform: "perspective(700px) translate(0px,0px) rotate(0deg) rotateY(0deg) scale(1)", opacity: 1 },
      { transform: `perspective(700px) translate(${px.toFixed(1)}px,${py.toFixed(1)}px) rotate(-6deg) rotateY(0deg) scale(1.05)`, opacity: 1, offset: 0.35, easing: "cubic-bezier(.3,.7,.3,1)" },
      { transform: `perspective(700px) translate(${mx.toFixed(1)}px,${my.toFixed(1)}px) rotate(${(giro / 2 - 3).toFixed(1)}deg) rotateY(90deg) scale(1.1)`, opacity: 1, offset: 0.68 },
      { transform: `perspective(700px) translate(${dx}px,${dy}px) rotate(${giro}deg) rotateY(180deg) scale(${esc2})`, opacity: desvanece ? 0 : 1 }
    ], { duration: VUELO_MS, easing: "ease-in-out", fill: "forwards" });
    mira(para);
    if (!document.hidden) suena("reparte");
    let hecho = false;
    const acaba = () => {
      if (hecho) return;
      hecho = true;
      v.remove();
      destapa(id);
      vuelos--;
      if (muerto) return;
      efectos(ev, true);
      trasVuelos();
      if (est) mira(aQuienEspera(fantasma()));
    };
    anim.onfinish = acaba;
    anim.oncancel = acaba;
    luego(acaba, VUELO_MS + 300);
  }

  /* Un sello sobre un asiento («¡Se pasó!», «Congelado»…). Varios sobre
     el mismo asiento se apilan. */
  function sello(u, texto, clase, pila) {
    const s = asientoDe(u), sala = $("#f7Sala"), fx = $("#f7Fx");
    if (!s || !sala || !fx) return;
    const rs = sala.getBoundingClientRect(), ra = s.getBoundingClientRect();
    const k = pila[u] = (pila[u] || 0) + 1;
    const el = document.createElement("div");
    el.className = "jg-f7-sello " + (clase || "");
    el.textContent = texto;
    el.style.left = (ra.left + ra.width / 2 - rs.left) + "px";
    el.style.top = (ra.top + ra.height / 2 - rs.top - (k - 1) * 30) + "px";
    fx.appendChild(el);
    luego(() => el.remove(), 1700);
  }

  function sacude(u) {
    const s = asientoDe(u);
    if (!s || quieto()) return;
    s.classList.remove("jg-f7-sacude");
    void s.offsetWidth;
    s.classList.add("jg-f7-sacude");
    luego(() => s.classList.remove("jg-f7-sacude"), 700);
  }

  function flip7(u) {
    const fx = $("#f7Fx");
    if (!fx) return;
    const b = document.createElement("div");
    b.className = "jg-f7-banner";
    b.innerHTML = `<b>¡FLIP 7!</b><span>${esc(Nombre(u))} · +15</span>`;
    fx.appendChild(b);
    luego(() => b.remove(), 2400);
    if (quieto()) return;
    const colores = ["#e8b64a", "#ef4444", "#22c55e", "#3b82f6", "#d946ef", "#f97316", "#fff"];
    for (let k = 0; k < 28; k++) {
      const c = document.createElement("i");
      c.className = "jg-f7-confeti";
      c.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 360 - 180).toFixed(0)}deg;--s:${(0.9 + Math.random() * 0.9).toFixed(2)}s;--w:${(Math.random() * 0.5).toFixed(2)}s;background:${colores[k % colores.length]}`;
      fx.appendChild(c);
      luego(() => c.remove(), 2400);
    }
  }

  /* Lo que se ve y se oye de un puñado de sucesos. Un solo sonido por
     tanda, el más importante: tres a la vez no se distinguen. */
  function efectos(ev, aterriza) {
    if (!host || document.hidden) return;
    const pila = {}, oye = new Set();
    for (const h of ev || []) {
      switch (h.e) {
        case "f7": flip7(h.uid); sello(h.uid, "¡Flip 7!", "jg-f7-sello-oro", pila); oye.add("flip7"); break;
        case "pasa": sello(h.uid, "¡Se pasó!", "jg-f7-sello-rojo", pila); sacude(h.uid); oye.add("revienta"); break;
        case "salva": sello(h.uid, "¡Salvado!", "jg-f7-sello-rosa", pila); oye.add("gana"); break;
        case "gafe": sello(h.uid, "¡Gafe!", "jg-f7-sello-rojo", pila); sacude(h.uid); oye.add("pierde"); break;
        case "congela": sello(h.a, "Congelado", "jg-f7-sello-hielo", pila); oye.add("hielo"); break;
        case "roba": sello(h.a, "¡Robo!", "jg-f7-sello-rojo", pila); oye.add("golpe"); break;
        case "tira": sello(h.a, "Descarte", "jg-f7-sello-gris", pila); oye.add("golpe"); break;
        case "cambia": sello(h.a, "⇄", "jg-f7-sello-verde", pila); sello(h.b, "⇄", "jg-f7-sello-verde", pila); oye.add("golpe"); break;
        case "planta": sello(h.uid, "Plantado", "jg-f7-sello-oro", pila); oye.add("planta"); break;
        case "regala": sello(h.a, "♥ Segunda", "jg-f7-sello-rosa", pila); oye.add("ficha"); break;
        case "da": sello(h.a, nombreCarta(carta(h.id)), "", pila); oye.add("ficha"); break;
        case "tres": case "cuatro": sello(h.a, h.e === "tres" ? "Voltea 3" : "Voltea 4", "", pila); oye.add("ficha"); break;
        case "otra": sello(h.a, "Una más", "", pila); oye.add("ficha"); break;
      }
    }
    const orden = ["flip7", "revienta", "gana", "pierde", "hielo", "golpe", "planta", "ficha"];
    const s = orden.find(x => oye.has(x));
    if (s) suena(s);
    else if (aterriza) suena("carta");
  }

  /* Cuando ya no vuela nada: el resumen de la ronda que se cerró, o el
     final de la partida, que se enseña entero antes de soltar el cartel. */
  function trasVuelos() {
    if (vuelos > 0 || !est || muerto) return;
    if (est.fase === "fin") {
      if (finAnimado || document.hidden) return;
      finAnimado = true;
      if (est.motivo === "abandono" || !vioJugar) { if (ctx.listo) ctx.listo(); return; }
      finHasta = Date.now() + FIN_MS;
      mostrarResumen(true);
      clearTimeout(relojListo);
      relojListo = setTimeout(() => { if (!muerto && ctx.listo) ctx.listo(); }, FIN_MS + 30);
      return;
    }
    const f = est.finRonda;
    if (f && f.r !== resumenR) {
      resumenR = f.r;
      clearTimeout(relojRes);
      relojRes = setTimeout(() => {
        if (muerto || !est || est.fase !== "jugando") return;
        mostrarResumen(false);
        relojRes = setTimeout(escondeResumen, 3400);
      }, 500);
    }
  }

  function mostrarResumen(fin) {
    const f = est && est.finRonda, caja = $("#f7Resumen");
    if (!f || !caja) return;
    resumenFijo = fin;
    const filas = est.jugadores.slice().sort((a, b) => (f.total[b.uid] || 0) - (f.total[a.uid] || 0)).map(j => {
      const l = f.lineas[j.uid] || { nums: [], mods: [] };
      const fuera = (est.fuera || {})[j.uid];
      const tag = l.f7 ? ["Flip 7", "oro"] : fuera || l.estado === "fuera" ? ["fuera", "gris"] : l.estado === "pasa" ? ["se pasó", "rojo"]
        : l.estado === "planta" ? ["plantado", "verde"] : ["en pie", "verde"];
      const minis = l.nums.concat(l.mods).map(id => htmlCarta(carta(id), "jg-f7-mini")).join("");
      return `<div class="jg-f7-res-f${j.uid === est.ganador && fin ? " jg-f7-res-gana" : ""}" style="--c:${esc(j.color || "#888")}">
        <span class="jg-f7-res-n"><i></i>${esc(j.uid === uid ? "Tú" : j.nombre)}</span>
        <span class="jg-f7-res-c">${minis || '<span class="jg-nota">—</span>'}</span>
        <span class="jg-f7-res-tag jg-f7-tag-${tag[1]}">${tag[0]}</span>
        <span class="jg-f7-res-p">+${f.pts[j.uid] || 0}</span>
        <span class="jg-f7-res-t2"><b>${f.total[j.uid] || 0}</b>/${est.meta}</span>
      </div>`;
    }).join("");
    caja.innerHTML = `<div class="jg-f7-res-in">
        <div class="jg-f7-res-titulo">${fin ? "Última ronda" : `Fin de la ronda ${f.r}`}${f.f7 ? ` · <span>¡Flip 7 de ${esc(nombre(f.f7))}!</span>` : ""}</div>
        ${filas}
        ${fin ? "" : `<div class="jg-f7-res-pie">Toca para cerrar</div>`}
      </div>`;
    caja.classList.add("jg-f7-res-on");
    if (!fin) suena("entra");
  }

  function escondeResumen() {
    clearTimeout(relojRes);
    resumenFijo = false;
    const caja = $("#f7Resumen");
    if (caja && caja.classList.contains("jg-f7-res-on")) caja.classList.remove("jg-f7-res-on");
  }

  /* La pestaña vuelve: se cuenta lo que pasó mientras estaba detrás. */
  function alVolver() {
    if (document.hidden || muerto || !est) return;
    /* Un reloj de una pestaña de fondo puede haberse retrasado mucho (el
       navegador los frena) o estar ya viejo: al volver se rearma. */
    if (reloj) { clearTimeout(reloj); reloj = null; relojN = -1; }
    automatismos();
    const q = pendiente;
    pendiente = null;
    if (q && q.carta && sitioDe(q.carta.id) && !quieto()) {
      enVuelo.add(q.carta.id);
      sitioDe(q.carta.id).classList.add("jg-f7-oculta");
      lanza(q.carta.id, q.carta.para, q.ev);
    } else {
      if (q) efectos(q.ev, !!q.carta);
      trasVuelos();
    }
  }

  /* ---------- interacción ---------- */
  function alClic(ev) {
    if (ev.target.closest("#f7Resumen") && !resumenFijo) { escondeResumen(); return; }
    if (!est || est.fase !== "jugando" || enviando) return;
    const w = est.espera;
    if (ev.target.closest("#f7Pide")) { pide(); return; }
    if (ev.target.closest("#f7Planta")) { manda({ t: "planta", uid }); return; }
    if (ev.target.closest("#f7Anula")) { sel1 = null; pinta(); return; }
    if (!w || w.k !== "elige" || w.quien !== uid) return;
    const a = ev.target.closest("[data-apunta]");
    if (a && w.op.tipo === "a") { manda({ t: "apunta", uid, a: a.getAttribute("data-apunta") }); return; }
    const c = ev.target.closest(".jg-f7-c[data-id]");
    if (!c) return;
    const u = c.getAttribute("data-u"), id = Number(c.getAttribute("data-id"));
    if (w.op.tipo === "c") { manda({ t: "apunta", uid, a: u, c: id }); return; }
    if (w.op.tipo === "2") {
      if (sel1 && sel1.u === u && sel1.id === id) { sel1 = null; pinta(); return; }
      if (!sel1) { sel1 = { u, id }; suena("clic"); pinta(); return; }
      const par = sel1; sel1 = null;
      manda({ t: "apunta", uid, a: par.u, c: par.id, b: u, d: id });
    }
  }

  async function manda(j) {
    if (enviando) return;
    enviando = true; pinta();
    try { await jugar(j); } catch (e) { console.warn("[flip7]", e); }
    finally { enviando = false; if (est) pinta(); }
  }

  async function pide() {
    const s = miSemilla();
    if (!s || !est || est.espera.k !== "decide" || est.espera.uid !== uid) return;
    const n = est.n;
    enviando = true; pinta();
    try {
      const v = await aporteF7(s.sem, s.sal, n);
      await jugar({ t: "pide", uid, n, v });
    } catch (e) { console.warn("[flip7]", e); }
    finally { enviando = false; if (est) pinta(); }
  }

  /* Mi aporte al robo pendiente, con su pausa. El reloj se rearma si el
     robo que espera cambia; si no, se deja correr. Si no me toca aportar
     pero soy suplente (`espera.suplentes`), aporto igual pasado un rato:
     el reductor sólo lo usa si los designados siguen sin estar, y sin
     eso una pestaña dormida dejaba la mesa entera esperando. */
  function papel(w) {
    if (w.faltan.includes(uid)) return 0;
    const k = (w.suplentes || []).indexOf(uid);
    return k < 0 ? -1 : k + 1;
  }
  function automatismos() {
    const w = est && est.espera;
    if (!w || est.fase !== "jugando" || w.k !== "roba" || !juego() || !secListo
        || papel(w) < 0 || enviadoN === w.n) {
      if (reloj && (!w || w.k !== "roba" || w.n !== relojN)) { clearTimeout(reloj); reloj = null; relojN = -1; }
      return;
    }
    if (roboN !== w.n) { roboN = w.n; roboT = Date.now(); }
    if (reloj && relojN === w.n) return;
    clearTimeout(reloj);
    relojN = w.n;
    const rango = papel(w);
    const falta = Math.max(PAUSA_ROBO, PAUSA_RONDA - (Date.now() - tRonda) * (w.de === "reparto" ? 1 : 99))
      + (rango ? Math.max(0, SUPLENCIA_MS + (rango - 1) * SUPLENCIA_PASO - (Date.now() - roboT)) : 0);
    reloj = setTimeout(async () => {
      reloj = null;
      const x = est && est.espera;
      if (muerto || !x || x.k !== "roba" || x.n !== relojN || papel(x) < 0 || enviadoN === x.n) return;
      const s = miSemilla();
      if (!s) return;
      enviadoN = x.n;
      try {
        const v = await aporteF7(s.sem, s.sal, x.n);
        if (!(await jugar({ t: "r", uid, n: x.n, v }))) enviadoN = -1;
      } catch (e) { enviadoN = -1; console.warn("[flip7]", e); if (est) automatismos(); }
    }, falta);
  }

  /* Al acabar: revelar la semilla y, cuando la hayan revelado todos los
     que siguen en la mesa (o haya pasado un rato), cerrar la partida. */
  function cierre() {
    if (!finVisto) finVisto = Date.now();
    if (!cerrando && jugador(uid) && !(est.semillas || {})[uid] && secListo) {
      cerrando = true;
      const s = miSemilla();
      if (s) jugar({ t: "s", uid, sem: s.sem, sal: s.sal }).catch(() => {});
    }
    const faltan = est.jugadores.filter(j => !(est.fuera || {})[j.uid] && !(est.semillas || {})[j.uid]);
    if (!faltan.length || Date.now() - finVisto > ESPERA_SEMILLAS) terminar(est.ganador, est.motivo);
    /* Se sigue mirando hasta que `fin` está escrito: un `terminar` que
       falló (la red, una jugada que no llegó) no puede dejar la sala
       abierta para siempre con la partida ya decidida. */
    clearTimeout(relojFin);
    relojFin = setTimeout(() => { if (!muerto && est && !(p.fin && p.fin.at)) cierre(); }, 1000);
  }

  async function audita() {
    if (auditando || !p || !est) return;
    const firma = Object.keys(p.jugadas || {}).length + "|" + !!p.fin;
    if (firma === firmaAudit || (!p.fin && !Object.keys(est.semillas || {}).length)) return;
    auditando = true;
    try {
      const malas = await auditaFlip7(p, est);
      firmaAudit = firma;
      if (JSON.stringify(malas) !== JSON.stringify(tramposos)) { tramposos = malas; pinta(); }
    } catch (e) { /* una auditoría que falla no puede tumbar la partida */ }
    finally { auditando = false; }
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    M = mazoF7(est.modo || "normal");
    pideSecreto();
    if (est.ronda !== rondaVista) {
      if (rondaVista) tRonda = Date.now();
      rondaVista = est.ronda;
    }
    const w = est.espera;
    if (sel1 && !(w && w.k === "elige" && w.quien === uid && w.op.tipo === "2")) sel1 = null;

    const hist = est.hist || [];
    const nuevos = primera ? [] : nuevosDe(histPrev, hist).slice(-16);
    histPrev = hist.slice();
    const u = est.ultima;
    const cartaNueva = !primera && !!u && u.n !== ultimaN;
    if (u) ultimaN = u.n;
    if (est.fase === "jugando") vioJugar = true;
    const visible = !document.hidden;
    if (visible && nuevos.some(h => h.e === "pide")) suena("madera");
    if (cartaNueva && visible && !quieto()) enVuelo.add(u.id);

    pinta();

    if (primera) {
      primera = false;
      resumenR = est.finRonda ? est.finRonda.r : 0;
      if (est.fase === "fin") trasVuelos();
    } else if (!visible) {
      if (cartaNueva || nuevos.length) {
        const ev = ((pendiente && pendiente.ev) || []).concat(nuevos).slice(-12);
        pendiente = { carta: cartaNueva ? { id: u.id, para: u.para } : (pendiente && pendiente.carta), ev };
      }
    } else if (cartaNueva) {
      lanza(u.id, u.para, nuevos);
    } else {
      efectos(nuevos, false);
      trasVuelos();
    }

    automatismos();
    audita();
    if (est.fase === "fin" && !(p.fin && p.fin.at)) cierre();
  }

  return { montar, actualizar, destruir, ocupado };
}
