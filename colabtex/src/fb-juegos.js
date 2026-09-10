"use strict";
/* ============================================================
   Juegos — capa de Firebase

   Tres nodos nuevos, fuera de `projects/` por la misma razón que los
   informes: una partida no es de un documento de nadie.

     partidas/<pid>
       {juego, estado, anfitrion, nombre, semilla, lado, at,
        jugadores/<uid>: {nombre, foto, color, orden, at},
        jugadas/<0000..>: {t, uid, …},
        fin: {ganador, motivo, at}}
     misPartidas/<uid>/<pid>   {juego, at}      índice propio, para volver
     ranks/<juego>/<uid>       la fila de la clasificación

   Dos cosas de las reglas mandan sobre el diseño de este archivo:

   1. **Una jugada se escribe una vez y no se reescribe.** La regla de
      `jugadas/$n` exige `!data.exists()`, así que el registro es
      apéndice puro: nadie puede volver atrás y cambiar la carta que
      jugó. Aquí eso se traduce en `runTransaction` sobre la clave
      exacta, que aborta si ya hay algo — que es lo que pasa cuando los
      dos escriben la jugada número 4 a la vez. El que pierde vuelve a
      intentarlo con el siguiente número.
   2. **Un `.write` en un padre no se puede quitar en un hijo.** Por eso
      `partidas/$pid` solo tiene permiso de escritura para crearla o
      para que el anfitrión la borre, y todo lo demás (estado, turno,
      jugadores, jugadas) cuelga de reglas por hijo. Poner un `.write`
      cómodo arriba habría dejado a cualquiera reescribir la partida
      entera, y ninguna regla de abajo lo habría impedido.

   El listado del vestíbulo consulta solo las partidas en `esperando`
   (`orderByChild('estado')`, con su `.indexOn` en las reglas): son
   justo las que todavía no tienen ni una jugada, así que la consulta
   pesa lo que pesan cuatro campos. Escuchar `partidas` entero habría
   traído el registro de jugadas de todas las partidas jamás jugadas.

   OJO, igual que en los informes: las reglas hay que publicarlas A
   MANO en la consola de Firebase (CONFIGURAR-FIREBASE.md). Hasta
   entonces todo esto falla con PERMISSION_DENIED, y la página lo dice.
   ============================================================ */
import { db } from "./firebase.js";
import {
  ref, get, set, push, remove, onValue, onDisconnect,
  runTransaction, query, orderByChild, equalTo, serverTimestamp
} from "firebase/database";
import { claveJugada, semillaAleatoria, LADO, cupoDe } from "./juegos/motor.js";

const P = "partidas", MIAS = "misPartidas", R = "ranks";

/* ---------- reloj compartido ----------
   Los dos relojes de los dos ordenadores no coinciden, y el escondite
   cuenta hacia atrás hasta una hora concreta. `.info/serverTimeOffset`
   es la diferencia con el reloj del servidor, que sí es uno solo. */
let offset = 0;
export function seguirReloj() {
  return onValue(ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
}
export const ahora = () => Date.now() + offset;

/* ---------- partidas ---------- */

/* `extra` es lo que eligió quien abre la sala — de momento `cupo` y
   `lado` de cuadritos. Va detrás del objeto base a propósito: los
   valores por omisión son los de siempre y lo elegido los pisa, así
   que un juego que no ofrezca nada no tiene que pasar nada. */
export async function crearPartida(juego, quien, extra) {
  const pid = push(ref(db, P)).key;
  await set(ref(db, `${P}/${pid}`), Object.assign({
    juego,
    estado: "esperando",
    anfitrion: quien.uid,
    nombre: (quien.nombre || "Alguien").split(" ")[0],
    semilla: semillaAleatoria(),
    lado: LADO,
    cupo: 2,
    at: serverTimestamp(),
    jugadores: { [quien.uid]: ficha(quien, 0) }
  }, extra || {}));
  await marcarMia(pid, juego, quien.uid);
  return pid;
}

const ficha = (q, orden) => ({
  nombre: q.nombre || "Alguien",
  foto: q.foto || "",
  color: q.color || "#0d9488",
  orden,
  at: Date.now()
});

/* Entrar en una sala. El orden se calcula de lo que ya hay: es lo que
   decide qué paisaje le toca a cada uno y quién abre en cuadritos, así
   que tiene que quedar escrito y no deducirse del reloj. */
export async function unirse(pid, quien) {
  const snap = await get(ref(db, `${P}/${pid}`));
  const p = snap.val();
  if (!p) throw new Error("Esa partida ya no existe.");
  const ya = p.jugadores || {};
  const cupo = cupoDe(p);
  if (!ya[quien.uid]) {
    if (Object.keys(ya).length >= cupo) throw new Error("La sala está llena.");
    await set(ref(db, `${P}/${pid}/jugadores/${quien.uid}`), ficha(quien, Object.keys(ya).length));
    /* La sala se cierra sola al llenarse. Con cupo de más de dos puede
       cerrarla antes quien la abrió (`setEstado`), porque si no, una
       sala de seis con cuatro dentro no empezaría nunca. Las reglas
       solo dejan entrar mientras el estado sea «esperando», así que
       cerrar es también lo que echa el cerrojo. */
    if (Object.keys(ya).length + 1 >= cupo) {
      await set(ref(db, `${P}/${pid}/estado`), "jugando");
    }
  }
  await marcarMia(pid, p.juego, quien.uid);
  return p.juego;
}

export function watchPartida(pid, cb) {
  return onValue(ref(db, `${P}/${pid}`), s => cb(s.val(), null), err => cb(null, err));
}

export function watchSalas(cb) {
  const q = query(ref(db, P), orderByChild("estado"), equalTo("esperando"));
  return onValue(q, s => {
    const v = s.val() || {};
    cb(Object.entries(v).map(([id, x]) => Object.assign({ id }, x)), null);
  }, err => cb([], err));
}

/* Escribe la jugada número `n`. Si alguien se adelantó a esa casilla,
   `runTransaction` aborta devolviendo undefined y aquí se responde
   false: quien llama vuelve a mirar el registro y reintenta. */
export async function jugar(pid, n, jugada) {
  const nodo = ref(db, `${P}/${pid}/jugadas/${claveJugada(n)}`);
  const res = await runTransaction(nodo, actual => (actual === null ? jugada : undefined));
  return res.committed;
}

export const setEstado = (pid, estado) => set(ref(db, `${P}/${pid}/estado`), estado);

/* Dos escrituras y no un `update` del nodo entero. `fin` y `estado`
   cuelgan de reglas distintas (una exige que el que escribe sea
   jugador y que el ganador no cambie; la otra solo que sea jugador), y
   un `update` en el padre se valida hijo por hijo pero se aplica o se
   rechaza **entero**: si una de las dos condiciones no se cumple,
   la partida se queda sin cerrar y sin decir cuál de las dos falló.
   Separadas, `fin` — que es la que congela el registro de jugadas —
   va primero y siempre entra, y el `estado` es solo para que la sala
   salga del listado. */
export async function terminar(pid, ganador, motivo) {
  await set(ref(db, `${P}/${pid}/fin`), {
    ganador: ganador || "", motivo: motivo || "", at: Date.now()
  });
  try { await set(ref(db, `${P}/${pid}/estado`), "fin"); }
  catch (e) { console.warn("[juegos] la partida quedó cerrada pero el estado no", e); }
}

export const borrarPartida = pid => remove(ref(db, `${P}/${pid}`));

/* Si el anfitrión cierra la pestaña con la sala vacía, la sala se
   borra sola: un vestíbulo lleno de salas fantasma no invita a nadie
   a entrar. Solo mientras está esperando — una partida empezada tiene
   que sobrevivir a una recarga. */
export function limpiarSiSeVa(pid) {
  const od = onDisconnect(ref(db, `${P}/${pid}`));
  od.remove();
  return () => { try { od.cancel(); } catch (e) {} };
}

/* ---------- índice propio ---------- */
const marcarMia = (pid, juego, uid) =>
  set(ref(db, `${MIAS}/${uid}/${pid}`), { juego, at: Date.now() });

export const olvidarMia = (pid, uid) => remove(ref(db, `${MIAS}/${uid}/${pid}`));

export function watchMias(uid, cb) {
  return onValue(ref(db, `${MIAS}/${uid}`), s => {
    const v = s.val() || {};
    cb(Object.entries(v).map(([id, x]) => Object.assign({ id }, x)), null);
  }, err => cb([], err));
}

/* ---------- clasificación ---------- */

export function watchRanks(juego, cb) {
  return onValue(ref(db, `${R}/${juego}`), s => {
    const v = s.val() || {};
    cb(Object.entries(v).map(([uid, x]) => Object.assign({ uid }, x)), null);
  }, err => cb([], err));
}

export const leerRank = (juego, uid) => get(ref(db, `${R}/${juego}/${uid}`)).then(s => s.val());
export const guardarRank = (juego, uid, fila) => set(ref(db, `${R}/${juego}/${uid}`), fila);
