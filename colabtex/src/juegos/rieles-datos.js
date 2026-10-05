/* Los rieles del salón (solo en PC): a la izquierda, las mejores partidas
   del día de cuatro juegos del club, repetidas en bucle; a la derecha, el
   chat general. Esto es lo puro —qué se guarda, cómo se ordena, cuánto se
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

/* Los cuatro juegos del riel, en el orden en que se apilan. `menor`: compite
   el tiempo (el buscaminas y sortEm tienen los puntos fijos). */
export const REPES = [
  { cat: "club-tetris-maraton", juego: "tetris", titulo: "Tetris", modo: "Maratón", ruta: "#solo/tetris", menor: false },
  { cat: "club-snake-classic-mediano", juego: "snake", titulo: "Snake", modo: "Clásico · mediano", ruta: "#solo/snake", menor: false },
  { cat: "club-sortem-20", juego: "sortem", titulo: "sortEm", modo: "20 números", ruta: "#solo/sortem", menor: true },
  { cat: "club-minas-medium", juego: "minas", titulo: "Buscaminas", modo: "La aventura · medio", ruta: "#solo/minas", menor: true }
];
export const repDe = cat => REPES.find(r => r.cat === cat) || null;

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
