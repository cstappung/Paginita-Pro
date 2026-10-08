/* Los rieles del salón (solo en PC): a la izquierda, las mejores partidas
   del día de cuatro de los juegos del club que más se juegan (otros cuatro
   cada día), repetidas en bucle; a la derecha, el chat general. Esto es lo puro —qué se guarda, cómo se ordena, cuánto se
   espera— para que se pueda comprobar en Node sin navegador ni Firebase
   (tests/rieles.test.cjs). El DOM vive en rieles.js y las repeticiones en
   repeticion.js.

   **Una repetición no es un vídeo: es la prueba antitrampas.** Cada
   partida del club ya viaja con lo que hace falta para rehacerla (la
   semilla y las jugadas con su instante, docs/antitrampas.md), y los
   motores son deterministas. Así que la mejor partida del día se guarda
   como esa misma prueba, y el salón la rehace con el mismo motor que la
   jugó: lo que se ve es exactamente lo que pasó, en unos KB.

   `repeticiones/<categoría>/<uid>` = {dia, o, p, t, n, v, d, at}: la mejor
   partida *del día* de cada cuenta, que se reescribe cuando la mejora (o
   al día siguiente). `o` es la clave por la que se ordena y la regla la
   recalcula: el día delante, así que la consulta «los tres `o` más altos»
   devuelve los mejores de hoy y, si hoy nadie jugó, los del último día con
   partidas. */

/* Las tablas que pueden salir en el riel: todos los modos de los juegos
   del club que se rehacen jugada a jugada con su motor (repeticion.js).
   ALETEO y BBTAN también se pueden rehacer, pero se dejaron fuera a
   propósito; FANAL y Metro Rush no se rehacen cuadro a cuadro, y los
   diarios (sopa, sudoku, Electrodle) son una grilla casi quieta.
   `menor`: compite el tiempo (el buscaminas, sortEm y el sprint de
   Tetris tienen los puntos fijos); `unidad`, cómo se dice su marca.
   `popular` es la clave con que el salón cuenta cuánto se juega cada
   juego (`leerPopularidad`). */
const tabla = (juego, titulo, cat, modo, ruta, extra) => Object.assign({ cat, juego, titulo, modo, ruta, menor: false, popular: "club-" + juego }, extra);
const SN_MODOS = { classic: "Clásico", arcade: "Arcade", portals: "Portales", reloj: "Contrarreloj", espejo: "Espejo", laberinto: "Laberinto" };
const SN_TAMANOS = { chico: "chico", mediano: "mediano", grande: "grande", gigante: "gigante" };
export const REPES = [
  tabla("tetris", "Tetris", "club-tetris-maraton", "Maratón", "#solo/tetris"),
  tabla("tetris", "Tetris", "club-tetris-sprint", "Sprint · 40 líneas", "#solo/tetris", { menor: true }),
  tabla("tetris", "Tetris", "club-tetris-ultra", "Ultra · 2 minutos", "#solo/tetris"),
  ...Object.entries(SN_MODOS).flatMap(([m, nm]) => Object.entries(SN_TAMANOS).map(([t, nt]) =>
    tabla("snake", "Snake", `club-snake-${m}-${t}`, `${nm} · ${nt}`, "#solo/snake"))),
  tabla("sortem", "sortEm", "club-sortem-10", "10 números", "#solo/sortem", { menor: true }),
  tabla("sortem", "sortEm", "club-sortem-20", "20 números", "#solo/sortem", { menor: true }),
  tabla("minas", "Buscaminas", "club-minas-easy", "Un paseo · fácil", "#solo/minas", { menor: true }),
  tabla("minas", "Buscaminas", "club-minas-medium", "La aventura · medio", "#solo/minas", { menor: true }),
  tabla("minas", "Buscaminas", "club-minas-hard", "Sin miedo · difícil", "#solo/minas", { menor: true }),
  tabla("dosmil", "2048", "club-dosmil-puntos", "Puntos", "#solo/dosmil"),
  tabla("dosmil", "2048", "club-dosmil-ficha", "Ficha más alta", "#solo/dosmil", { unidad: "ficha" })
];
/* Los juegos, una vez cada uno, en el orden de `REPES`. */
export const JUEGOS_REP = [...new Set(REPES.map(r => r.juego))];
export const repDe = cat => REPES.find(r => r.cat === cat) || null;

/* ---------- la alineación del día ----------
   Cada día salen `POR_DIA` juegos distintos, cada uno con uno de sus
   modos, en el orden en que se apilan. Los juegos se ordenan por cuánto se
   juegan (`popular`, lo que el salón ya lee para ordenar el catálogo;
   empate: el orden de `REPES`) y se sortean sin reponer con el día como
   semilla y un peso que baja con el puesto: el más jugado pesa tanto como
   juegos hay, el último 1. Después, el modo de cada uno se sortea con la
   misma semilla entre sus tablas que tienen récords (peso: la raíz de
   cuántos, así los modos chicos también salen); sin ese dato, entre todas.
   Así lo más jugado sale casi todos los días, los modos van rotando, y
   todos los que abren el salón el mismo día ven la misma alineación. */
export const POR_DIA = 4;
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sortea(r, items, peso) {
  const total = items.reduce((s, x) => s + peso(x), 0);
  if (!(total > 0)) return Math.floor(r() * items.length);
  let tiro = r() * total, j = 0;
  while (j < items.length - 1 && (tiro -= peso(items[j])) >= 0) j++;
  return j;
}
const cuenta = (popular, k) => +((popular || {})[k]) || 0;
export function masJugados(popular) {
  return JUEGOS_REP.map((j, i) => ({ j, i })).sort((a, b) => cuenta(popular, "club-" + b.j) - cuenta(popular, "club-" + a.j) || a.i - b.i).map(x => x.j);
}
export function alineacionDelDia(dia, popular, cuantos = POR_DIA) {
  const orden = masJugados(popular), r = azar(Math.imul((dia | 0) + 1, 0x9E3779B1) ^ 0x5EED);
  const quedan = orden.map((j, i) => ({ j, peso: orden.length - i })), out = [];
  while (out.length < cuantos && quedan.length) {
    const { j } = quedan.splice(sortea(r, quedan, x => x.peso), 1)[0];
    const modos = REPES.filter(t => t.juego === j);
    out.push(modos[sortea(r, modos, t => Math.sqrt(cuenta(popular, t.cat)))]);
  }
  return out;
}

/* Lo que la regla acepta: los puntos hasta mil millones (lo mismo que la
   tabla de Tetris y Snake) y el tiempo por debajo de mil millones de ms
   (once días: ninguna de estas partidas dura eso). */
export const P_MAX = 1e9, T_MAX = 1e9 - 1, DIA_ESCALA = 1e10;

/* La clave de orden: más alta, mejor. El día va delante, así que una
   partida de hoy siempre queda por encima de cualquiera de ayer; detrás,
   los puntos o (en las de tiempo) lo que le falta al tiempo para mil
   millones. La regla de `repeticiones` exige exactamente esta cuenta. */
export function ordenRep(cat, dia, p, t) {
  const r = repDe(cat);
  if (!r || !Number.isSafeInteger(dia)) return null;
  return dia * DIA_ESCALA + (r.menor ? 1e9 - t : p);
}

/* La entrada que se escribe para una partida ya verificada, o null si no
   cabe en lo que la regla deja (y entonces no se intenta). */
export function entradaRep(cat, dia, dato, version, texto, nombre) {
  const r = repDe(cat);
  if (!r || !dato || !Number.isSafeInteger(dato.puntos) || !Number.isSafeInteger(dato.tiempo)) return null;
  const p = dato.puntos, t = dato.tiempo;
  if (p < 1 || p > P_MAX || t < 1 || t > T_MAX) return null;
  if (typeof texto !== "string" || !texto || texto.length > 200000) return null;
  return {
    dia, o: ordenRep(cat, dia, p, t), p, t,
    n: String(nombre || "Jugador").slice(0, 80),
    v: Number.isSafeInteger(version) && version >= 0 && version <= 1000 ? version : 0,
    d: texto
  };
}

/* ¿Hay que escribirla? Solo si mejora la que ya está (la de hoy, o
   cualquiera de un día anterior, que siempre tiene un `o` menor). */
export const mejoraRep = (nueva, previa) => !!nueva && (!previa || !Number.isFinite(previa.o) || nueva.o > previa.o);

/* De dónde viene lo que se repite, para la etiqueta de la tarjeta. */
export function etiquetaDia(dia, hoy) {
  if (dia === hoy) return "Mejor de hoy";
  if (dia === hoy - 1) return "Mejor de ayer";
  return "Última mejor partida";
}

/* La repetición va siempre a la velocidad a la que se jugó, aunque la
   partida dure media hora: acelerada (lo hacía hasta ×4 con las de más de
   dos minutos), una Maratón de Tetris dejaba de parecerse a jugarla. */
/* Lo que se queda quieto el tablero final antes de volver a empezar. */
export const PAUSA_FINAL_MS = 2600;

/* «4:07», «38,2 s»: el tiempo de una partida, como en el club. */
export function formatoTiempo(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 60000) return (ms / 1000).toFixed(1).replace(".", ",") + " s";
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
export const formatoPuntos = n => Number.isFinite(n) ? Math.round(n).toLocaleString("es-CL") : "—";
/* La marca de una partida en su tabla: «4:07», «12.340 pts», «38 tubos»,
   «ronda 41». */
export function formatoMarca(rep, p, t) {
  if (rep.menor) return formatoTiempo(t);
  if (rep.unidad === "ronda") return "ronda " + formatoPuntos(p);
  if (rep.unidad === "ficha") return "ficha " + formatoPuntos(p);
  return formatoPuntos(p) + " " + (rep.unidad || "pts");
}

/* ---------- el chat general ----------
   `chatGeneral/<id>` = {uid, n, t, at}, y `chatGeneralUlt/<uid>` = {at, k}
   el último mensaje de cada cuenta. Los dos se escriben en una sola
   actualización, y la regla del segundo pide que hayan pasado 20 s desde
   el anterior: así la espera no la pone la página (que se puede saltar
   desde la consola), la pone la base. Se muestran los de los últimos
   15 minutos; los de más de un día los puede borrar cualquiera, y el salón
   barre unos pocos al abrirse para que el nodo no crezca para siempre. */
export const CHAT_VENTANA_MS = 15 * 60 * 1000, CHAT_ESPERA_MS = 20000, CHAT_LARGO = 200, CHAT_MAX = 150;
export const CHAT_VIEJO_MS = 24 * 3600 * 1000;

/* Los que se ven ahora: de los últimos 15 minutos, en orden. */
export function chatVisibles(msgs, ahora) {
  return (msgs || [])
    .filter(m => m && typeof m.t === "string" && m.t && Number.isFinite(m.at) && ahora - m.at < CHAT_VENTANA_MS)
    .sort((a, b) => a.at - b.at || String(a.id).localeCompare(String(b.id)));
}
/* Cuánto falta para poder escribir otra vez (0: ya se puede). `ultimo` es
   el `at` del último mensaje propio, del servidor. */
export const esperaChat = (ultimo, ahora) => Number.isFinite(ultimo) ? Math.max(0, ultimo + CHAT_ESPERA_MS - ahora) : 0;
/* El texto tal como se manda: sin espacios sobrantes ni saltos de línea. */
export const limpiaChat = s => String(s || "").replace(/\s+/g, " ").trim().slice(0, CHAT_LARGO);
/* Mensajes nuevos de otros desde la última vez que se miró el chat. */
export const sinLeer = (msgs, visto, yo) => (msgs || []).filter(m => m.uid !== yo && m.at > (visto || 0)).length;
