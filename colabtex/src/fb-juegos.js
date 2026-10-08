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
     misPartidas/<uid>/<pid>   {juego, at, sec: {sem, sal}}
                               índice propio, para volver — y, en `sec`,
                               la semilla privada con la que se baraja
                               *su* mazo de cartas (ver abajo)
     ranks/<juego>/<uid>       la fila de la clasificación
     chat/<pid>/<id>           {uid, nombre, t, at} — la charla de la sala,
                               que escriben jugadores y espectadores
     enCurso/<pid>             {juego, nombres, n, at} — el cartel de
                               «en juego ahora» del vestíbulo

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

   3. **Lo privado vive en `misPartidas`, que solo lee su dueño.** El
      mazo de cartas de cada jugador se baraja con una semilla que
      nadie más puede leer, y por eso la mano del contrario no se
      puede deducir ni desde la consola. La promesa de esa semilla
      (`hmazo`) sí va en la ficha, que las reglas dejan escribir una
      sola vez, así que al acabar se revela y se audita. Y por eso
      `marcarMia` hace `update` y no `set`: `unirse` la llama también
      para quien ya estaba dentro, y un `set` le borraría la semilla
      — le cambiaría la mano a mitad de partida y dejaría su `hmazo`
      apuntando a un mazo que ya no existe.

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
  ref, get, set, update, push, remove, onValue, onDisconnect,
  runTransaction, query, orderByChild, equalTo, serverTimestamp, onChildAdded,
  limitToLast, limitToFirst, startAt, endAt, goOffline
} from "firebase/database";
import {
  claveJugada, semillaAleatoria, salAleatoria, compromiso, LADO, cupoDe,
  cadenaCacho, CC_CADENA, sha256hex, arrUno, dhPublica, cadenaCatan, CT_CADENA,
  cadenaPr, PR_CADENA, arrSp, cadenaPk, PK_CADENA
} from "./juegos/motor.js";
import { sanea, saneaPartida, colorSano, fotoSana } from "./juegos/sano.js";

const P = "partidas", MIAS = "misPartidas", R = "ranks";

/* `ranks/<juego>/<uid>` entero, con cada fila limpia (ver juegos/sano.js). */
const saneaRanks = v => {
  const out = v || {};
  for (const filas of Object.values(out))
    if (filas && typeof filas === "object") for (const f of Object.values(filas)) sanea(f);
  return out;
};

/* ---------- reloj compartido ----------
   Los dos relojes de los dos ordenadores no coinciden, y el escondite
   cuenta hacia atrás hasta una hora concreta. `.info/serverTimeOffset`
   es la diferencia con el reloj del servidor, que sí es uno solo. */
let offset = 0;
export function seguirReloj(alCambiar) {
  return onValue(ref(db, ".info/serverTimeOffset"), s => {
    offset = s.val() || 0;
    if (alCambiar) { try { alCambiar(offset); } catch (e) { console.warn("[juegos] reloj", e); } }
  });
}
export const ahora = () => Date.now() + offset;

/* ---------- partidas ---------- */

/* `extra` es lo que eligió quien abre la sala — de momento `cupo` y
   `lado` de cuadritos. Va detrás del objeto base a propósito: los
   valores por omisión son los de siempre y lo elegido los pisa, así
   que un juego que no ofrezca nada no tiene que pasar nada. */
export async function crearPartida(juego, quien, extra) {
  const pid = push(ref(db, P)).key;
  const sec = await secreto(pid, quien.uid, juego);
  await set(ref(db, `${P}/${pid}`), Object.assign({
    juego,
    estado: "esperando",
    anfitrion: quien.uid,
    nombre: (quien.nombre || "Alguien").split(" ")[0],
    semilla: semillaAleatoria(),
    lado: LADO,
    cupo: 2,
    at: serverTimestamp(),
    jugadores: { [quien.uid]: ficha(quien, 0, sec.h, sec.extra) }
  }, extra || {}));
  await marcarMia(pid, juego, quien.uid);
  return pid;
}

const ficha = (q, orden, hmazo, extra) => Object.assign({
  nombre: q.nombre || "Alguien",
  foto: fotoSana(q.foto, false),
  color: colorSano(q.color) || "#0d9488",
  orden,
  hmazo: hmazo || "",
  at: Date.now()
}, extra || {});

/* ---------- el secreto de cada jugador ----------
   Una semilla y una sal, guardadas donde solo su dueño puede leerlas,
   más la promesa que se publica en la ficha. Con ella se baraja su
   mazo de cartas: el contrario no puede calcularlo, y al acabar la
   partida se revela la semilla y se comprueba que jugara lo que
   tenía. Cuelga de su propio hijo, `sec`, para que `marcarMia` — que
   escribe `juego` y `at` — no lo pise.

   En el cacho la misma semilla da además la cadena de llaves de los
   dados, y lo que se publica es su punta (`hcad`, ver `redCacho`). En
   el UNO, la promesa de su parte de la mezcla (`hcad` también) y su
   clave pública de Diffie-Hellman (`pk`), la de los sobres. En Catan,
   la punta de la cadena de llaves con que se tiran los dados y se roba
   (`hcad`, ver `redCatan`): 800 hashes, que salen en milisegundos. En
   el Presidente, la de las llaves de cada reparto (`redPresidente`). */
async function secreto(pid, uid, juego) {
  const sem = semillaAleatoria(), sal = salAleatoria();
  /* Con `juego` y `at` en la misma escritura: una entrada de
     `misPartidas` que solo tuviera `sec` parecería, a `revisaMias`, una
     sala vieja (sin `at`) que ya no existe (la sala aún no está
     escrita), y la borraría con la semilla dentro. */
  await update(ref(db, `${MIAS}/${uid}/${pid}`), { sec: { sem, sal }, juego, at: Date.now() });
  const extra = juego === "cacho" ? { hcad: cadenaCacho(sem, sal)[CC_CADENA] }
    : juego === "uno" ? { hcad: sha256hex(arrUno(sem, sal)), pk: dhPublica(sem, sal) }
    : juego === "catan" ? { hcad: cadenaCatan(sem, sal)[CT_CADENA] }
    : juego === "presidente" ? { hcad: cadenaPr(sem, sal)[PR_CADENA] }
    : juego === "spicy" ? { hcad: sha256hex(arrSp(sem, sal)) }
    : juego === "pokemon" ? { hcad: cadenaPk(sem, sal)[PK_CADENA] }
    : {};
  return { sem, sal, h: await compromiso(sem, sal), extra };
}

export async function leerSecreto(pid, uid) {
  const s = await get(ref(db, `${MIAS}/${uid}/${pid}/sec`));
  return s.val() || null;
}

/* Entrar en una sala. El orden se calcula de lo que ya hay: es lo que
   decide qué paisaje le toca a cada uno y quién abre en cuadritos, así
   que tiene que quedar escrito y no deducirse del reloj. */
export async function unirse(pid, quien) {
  const snap = await get(ref(db, `${P}/${pid}`));
  const p = snap.val();
  if (!p) throw new Error("Esa partida ya no existe.");
  const ya = p.jugadores || {};
  const cupo = cupoDe(p);
  /* El Presidente no se acaba nunca, así que se puede entrar con la
     partida en marcha: la ficha se escribe ya y la mesa te sienta al
     empezar la ronda siguiente (`{t:"entra"}`, lo manda la pantalla).
     El cupo lo hace cumplir el reductor, que no sienta a más; aquí
     solo se pone un techo para que la sala no crezca sin fin. */
  const enMarcha = p.juego === "presidente" && p.estado === "jugando";
  if (enMarcha && p.fin) throw new Error("Esa partida ya terminó.");
  if (!ya[quien.uid]) {
    if (Object.keys(ya).length >= (enMarcha ? 3 * cupo : cupo)) throw new Error("La sala está llena.");
    const sec = await secreto(pid, quien.uid, p.juego);
    await set(ref(db, `${P}/${pid}/jugadores/${quien.uid}`),
              ficha(quien, Object.keys(ya).length, sec.h, sec.extra));
    /* La sala se cierra sola al llenarse. Con cupo de más de dos puede
       cerrarla antes quien la abrió (`setEstado`), porque si no, una
       sala de seis con cuatro dentro no empezaría nunca. Las reglas
       solo dejan entrar mientras el estado sea «esperando», así que
       cerrar es también lo que echa el cerrojo. */
    if (!enMarcha && Object.keys(ya).length + 1 >= cupo) {
      await set(ref(db, `${P}/${pid}/estado`), "jugando");
    }
    tocaSala(pid).catch(() => {});
  }
  await marcarMia(pid, p.juego, quien.uid);
  return p.juego;
}

export function watchPartida(pid, cb) {
  return onValue(ref(db, `${P}/${pid}`), s => cb(saneaPartida(s.val()), null), err => cb(null, err));
}

export function watchSalas(cb) {
  const q = query(ref(db, P), orderByChild("estado"), equalTo("esperando"));
  return onValue(q, s => {
    const v = s.val() || {};
    cb(Object.entries(v).map(([id, x]) => Object.assign({ id }, saneaPartida(x))), null);
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

/* ---------- salas dormidas (motor.js: `salaInactiva`) ----------
   `toque` es la hora del servidor de la última jugada o entrada; la
   escribe un jugador mientras la partida no ha acabado. Con seis horas
   sin toque, cualquiera con sesión puede cerrar la sala con
   `fin.motivo = "inactiva"`: la regla de `fin` lo comprueba contra `at`
   y `toque`, así que nadie puede cerrar una sala viva que no es suya. */
export const tocaSala = pid => set(ref(db, `${P}/${pid}/toque`), serverTimestamp());
export async function cierraInactiva(pid) {
  await set(ref(db, `${P}/${pid}/fin`), { ganador: "", motivo: "inactiva", at: Date.now() });
  try { await set(ref(db, `${P}/${pid}/estado`), "fin"); }
  catch (e) { console.warn("[juegos] la sala quedó cerrada pero el estado no", e); }
}
/* Lo justo para saber si una sala de «Tus partidas» sigue viva, sin
   bajar su registro de jugadas (en Circuit Breakers lleva el tablero
   entero de cada turno). `null` si la sala ya no existe. */
export async function resumenSala(pid) {
  const lee = k => get(ref(db, `${P}/${pid}/${k}`)).then(s => s.val(), () => null);
  const [juego, at, toque, fin, jugadores] = await Promise.all(["juego", "at", "toque", "fin", "jugadores"].map(lee));
  return juego ? { juego, at, toque, fin, jugadores } : null;
}

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
/* `update` y no `set`: aquí abajo cuelga también `sec`, la semilla
   privada del mazo, y `unirse` llama a esto también para quien ya
   estaba dentro. Con un `set` cada reentrada le habría borrado la
   semilla — mano nueva a mitad de partida y `hmazo` mintiendo. */
const marcarMia = (pid, juego, uid) =>
  update(ref(db, `${MIAS}/${uid}/${pid}`), { juego, at: Date.now() });

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
    cb(Object.entries(v).map(([uid, x]) => Object.assign({ uid }, sanea(x))), null);
  }, err => cb([], err));
}

/* Cuánto se juega cada cosa, para ordenar el catálogo: la suma de
   `jugadas` de todas las filas de `ranks/<juego>` (una partida de cuatro
   cuenta cuatro — es tiempo de gente jugando, que es lo que se mide) y,
   de los individuales, cuántos récords hay en `soloRanks` (por juego, y
   también por tabla: el riel elige con eso qué modo repetir). Una lectura
   al entrar; las filas son pequeñas y no hace falta escucharlas. */
export async function leerPopularidad() {
  const [r, s] = await Promise.all([get(ref(db, R)), get(ref(db, "soloRanks")).catch(() => null)]);
  const n = {};
  for (const [juego, filas] of Object.entries(r.val() || {}))
    n[juego] = Object.values(filas || {}).reduce((t, f) => t + (+(f && f.jugadas) || 0), 0);
  for (const [cat, filas] of Object.entries((s && s.val()) || {})) {
    const m = /^club-(minas|snake|tetris|sortem|bbtan|sopa|electro|frontera|sudoku|fanal|atasco|aleteo|dosmil|metrorush)-/.exec(cat);
    if (m) {
      n["club-" + m[1]] = (n["club-" + m[1]] || 0) + Object.keys(filas || {}).length;
      n[cat] = Object.keys(filas || {}).length;
    }
  }
  /* Las filas ya están aquí, así que van también: con ellas el
     vestíbulo pinta el podio del juego destacado sin otra lectura. */
  return { n, ranks: saneaRanks(r.val()) };
}

/* La clasificación general: todas las filas de todos los juegos, que es
   lo que ya lee la pestaña de logros. Se suma al pintar. */
export function watchRanksTodos(cb) {
  return onValue(ref(db, R), s => cb(saneaRanks(s.val()), null), err => cb({}, err));
}

/* ---------- logros ----------
   `logros/<juego>/<uid>/<id>` = cuándo. Solo los de partida: los de la
   fila y los individuales se derivan de `ranks` y `soloRanks` al pintar
   (juegos/logros.js). La regla deja escribir cada uno una vez, y solo a
   su dueño. La pestaña escucha los tres nodos enteros: son filas
   pequeñas, y el porcentaje necesita a todo el mundo. */
export const leerMisLogros = (juego, uid) =>
  get(ref(db, `logros/${juego}/${uid}`)).then(s => s.val() || {}, () => ({}));
export const otorgarLogro = (juego, uid, id) => set(ref(db, `logros/${juego}/${uid}/${id}`), serverTimestamp());
/* También escucha `diario`, la racha de días jugando: con las cuatro
   lecturas se calcula el saldo de monedas de cualquiera (juegos/monedas.js).
   Antes de publicar las reglas `diario` falla sola y el resto sigue. */
const NODOS_MONEDAS = 10;
export function watchLogros(cb) {
  const d = { ranks: {}, solo: {}, logros: {}, diario: {}, cartas: {}, mercado: {}, clubJugadas: {}, podios: {}, tienda: {}, ajustes: {} }, err = {}, llegados = new Set();
  /* `completo`: ya llegaron todas al menos una vez. Antes de eso el
     saldo sale de una suma a medias. */
  const oye = (nodo, k) => onValue(ref(db, nodo), s => {
    d[k] = (k === "ranks" ? saneaRanks(s.val()) : s.val()) || {}; err[k] = null; llegados.add(k);
    d.completo = llegados.size === NODOS_MONEDAS; cb(d, err);
  }, e => { err[k] = e; llegados.add(k); d.completo = llegados.size === NODOS_MONEDAS; cb(d, err); });
  const offs = [oye(R, "ranks"), oye("soloRanks", "solo"), oye("logros", "logros"), oye("diario", "diario"), oye("cartas", "cartas"), oye("mercado", "mercado"),
    oye("clubJugadas", "clubJugadas"), oye("podios", "podios"), oye("tienda", "tienda"), oye("ajustesMonedas", "ajustes")];
  return () => offs.forEach(f => f());
}

/* La tienda del perfil: `tienda/<uid>/<artículo>` = {at, p}. La regla
   exige `at === now` y el precio; el saldo lo repasa `economia()`. */
export async function comprarTienda(uid, item, p) {
  await set(ref(db, `tienda/${uid}/${item}`), { at: serverTimestamp(), p });
}

/* ---------- PRODROP: sobres y graduaciones ----------
   `cartas/s/<uid>/<clave>` = {at, p}: un sobre comprado. `at` lo pone el
   servidor (la regla exige `at === now`) y el contenido sale de ahí
   (juegos/prodrop/motor.js), así que nadie elige lo que trae. `p` es lo
   que costó, y la regla comprueba que sea el precio de ese instante.
   `cartas/g/<uid>/<clave>/<i>` = {at, p: 100}: la carta i de ese sobre,
   graduada. Las dos se escriben una vez y no se borran: son el gasto. */
/* `pre` es la colección (`p` profes, `c` componentes): va delante de la
   clave de push, y el motor la lee de ahí. Sin prefijo, el sobre es de
   los de antes de las colecciones. */
export async function comprarSobre(uid, p, pre = "") {
  const r = ref(db, `cartas/s/${uid}/${pre}${push(ref(db, `cartas/s/${uid}`)).key}`);
  await set(r, { at: serverTimestamp(), p });
  const x = (await get(r)).val();
  return { k: r.key, at: x.at, p: x.p };
}
/* El sobre gratis: el sobre con `p: 0` y `cartas/gratis/<uid>` = {at, k}
   en una sola escritura; la regla mira en el segundo que hayan pasado 6
   horas desde el anterior. */
export async function sobreGratis(uid, pre = "") {
  const k = pre + push(ref(db, `cartas/s/${uid}`)).key;
  await update(ref(db), { [`cartas/s/${uid}/${k}`]: { at: serverTimestamp(), p: 0 }, [`cartas/gratis/${uid}`]: { at: serverTimestamp(), k } });
  const x = (await get(ref(db, `cartas/s/${uid}/${k}`))).val();
  return { k, at: x.at, p: 0 };
}
/* Re-roll: `cartas/r/<uid>/<clave>` = {at, c}: diez copias de una misma
   rareza a cambio de una de la siguiente. La carta nueva sale del motor
   con `at`, la hora del servidor (la regla exige `at === now`), y la
   economía comprueba que las diez fueran de quien lo escribe. */
export async function rerollCartas(uid, c, pre = "") {
  const r = ref(db, `cartas/r/${uid}/${pre}${push(ref(db, `cartas/r/${uid}`)).key}`);
  await set(r, { at: serverTimestamp(), c });
  const x = (await get(r)).val();
  return { k: r.key, at: x.at };
}
/* Graduar la copia `o~k.i`. Si el sobre es de quien gradúa, `o` no se
   escribe (así eran las graduaciones de antes del mercado). */
export const graduarCarta = (uid, o, k, i) =>
  set(ref(db, `cartas/g/${uid}/${k}/${i}`), Object.assign({ at: serverTimestamp(), p: 100 }, o && o !== uid ? { o } : {}));

/* ---------- el mercado de cartas ----------
   `mercado/o/<id>` = {u, c, p, at}: una oferta (quien vende, la copia, el
   precio). `x` = hora en que se retiró, `v` = {u, at}: quien compró. Las
   reglas dejan que haya una sola de las dos, y una sola vez.
   `mercado/t/<id>` = {de, para, dar, pedir, at}: un intercambio propuesto;
   `ok` = hora en que `para` lo aceptó, `x` = hora en que alguien lo cerró.
   Quién tiene qué y quién pagó a quién lo decide la economía
   (juegos/monedas.js), que es la que sabe si había fondos y cartas. */
export async function publicarOferta(uid, c, p) {
  const r = push(ref(db, "mercado/o"));
  await set(r, { u: uid, c, p, at: serverTimestamp() });
  return r.key;
}
export const retirarOferta = id => set(ref(db, `mercado/o/${id}/x`), serverTimestamp());
export const comprarOferta = (uid, id) => set(ref(db, `mercado/o/${id}/v`), { u: uid, at: serverTimestamp() });
export async function proponerCambio(de, para, dar, pedir) {
  const r = push(ref(db, "mercado/t"));
  await set(r, Object.assign({ de, para, dar, at: serverTimestamp() }, pedir.length ? { pedir } : {}));
  return r.key;
}
export const aceptarCambio = id => set(ref(db, `mercado/t/${id}/ok`), serverTimestamp());
export const cerrarCambio = id => set(ref(db, `mercado/t/${id}/x`), serverTimestamp());
/* Las cartas que exhibe en su perfil: claves `<sobre>.<i>`. */
export const exhibirCartas = (uid, lista) => set(ref(db, `${U}/${uid}/perfil/cartas`), lista.length ? lista : null);

/* ---------- días jugando ----------
   `diario/<uid>` = {dia, racha, mejor, dias, bono, at}. La regla exige que
   `dia` sea hoy en Chile y que racha, días y bono sean los que tocan a
   partir del registro anterior (juegos/monedas.js: registraDia). */
export const leerDiario = uid => get(ref(db, `diario/${uid}`)).then(s => s.val());

/* Las partidas del club que pagan (juegos/monedas.js: registraJugadaClub),
   y el premio por quitarle un podio a alguien: `podios/<uid>/<partida>`,
   escrito justo después del récord cuya `partida` nombra. */
export const leerJugadasClub = (uid, juego) => get(ref(db, `clubJugadas/${uid}/${juego}`)).then(s => s.val());
export const apuntaJugadaClub = (uid, juego, reg) => set(ref(db, `clubJugadas/${uid}/${juego}`), Object.assign({}, reg, { at: serverTimestamp() }));
export const cobraPodio = (uid, partida, x) => set(ref(db, `podios/${uid}/${partida}`), { c: x.c, p: x.p, q: x.q, at: serverTimestamp() });
export const apuntaDiario = (uid, reg) => set(ref(db, `diario/${uid}`), Object.assign({}, reg, { at: serverTimestamp() }));

export const leerRank = (juego, uid) => get(ref(db, `${R}/${juego}/${uid}`)).then(s => sanea(s.val()));
export const guardarRank = (juego, uid, fila) => set(ref(db, `${R}/${juego}/${uid}`), fila);

/* ---------- perfil ----------

   El perfil vive en `users/<uid>/perfil`, que ya existe (lo usa
   ColabTeX) y cuya regla es la más simple de todo el archivo: lo lee
   cualquiera con sesión, lo escribe solo su dueño. Así que esto **no
   necesita publicar reglas nuevas**, que es justo lo que acaba de
   costarle una tarde a alguien con Reversi.

   Por qué no guardarlo en la ficha de la partida y ya: la ficha se
   escribe una sola vez al entrar (las reglas lo exigen, para que nadie
   se cambie el nombre a mitad de partida) y su `foto` está limitada a
   400 caracteres, que es una URL de Google pero no una foto subida por
   el jugador. Aquí no hay tope, la foto va como data URL de ~10 kB, y
   al pintar se superpone el perfil vivo sobre la ficha congelada: quien
   cambie su apodo lo ve cambiado también en las partidas de ayer. */

const U = "users";

export const leerPerfil = uid =>
  get(ref(db, `${U}/${uid}/perfil`)).then(s => sanea(s.val(), true));

export const guardarPerfil = (uid, p) =>
  set(ref(db, `${U}/${uid}/perfil`), Object.assign({}, p, { at: Date.now() }));

/* La partida a medias de un juego del club (hoy, BBTAN), para seguirla otro
   día. Va bajo users/<uid>, que ya solo escribe su dueño: no hizo falta tocar
   las reglas. Con `d` nulo queda solo `at`, una lápida que le dice al otro
   dispositivo que esa partida ya terminó. */
export const leerPartidaClub = (uid, juego) =>
  get(ref(db, `${U}/${uid}/club/${juego}`)).then(s => s.val());

/* ---------- Pokémon: los equipos de cada uno ----------
   `users/<uid>/pokemon` = `{equipos: {<id>: {nombre, formato, eq, at}},
   skin}`, donde `eq` es el equipo empaquetado de Showdown. Es un nodo del
   propio usuario (solo él lo lee y lo escribe), así que no hizo falta
   tocar las reglas. */
export const leerPokemon = uid =>
  get(ref(db, `${U}/${uid}/pokemon`)).then(s => s.val() || {});
export const guardarEquipoPk = (uid, id, e) =>
  set(ref(db, `${U}/${uid}/pokemon/equipos/${id}`), {
    nombre: String(e.nombre || "Equipo").slice(0, 60),
    formato: String(e.formato || "").slice(0, 40),
    eq: String(e.eq || "").slice(0, 8000),
    at: Date.now()
  });
export const borrarEquipoPk = (uid, id) => remove(ref(db, `${U}/${uid}/pokemon/equipos/${id}`));
export const guardarSkinPk = (uid, skin) => set(ref(db, `${U}/${uid}/pokemon/skin`), String(skin || "").slice(0, 40));
export const nuevoIdEquipo = () => push(ref(db, "x")).key;

export const guardarPartidaClub = (uid, juego, d, at) =>
  set(ref(db, `${U}/${uid}/club/${juego}`), { d: d || null, at: Number.isFinite(at) ? at : Date.now() });

export function watchPerfil(uid, cb) {
  return onValue(ref(db, `${U}/${uid}/perfil`), s => cb(sanea(s.val(), true), null),
                 err => cb(null, err));
}


/* Lo que eligió quien abrió la sala y la revancha repite. Solo lo que
   existe: un `undefined` en un `set` hace fallar la escritura entera. */
const opcionesDe = p => Object.fromEntries(["mapa", "escuadra", "tiempo", "malla", "modo", "sicil", "ritmo",
  "color", "variante", "largo", "meta", "exp", "baraja", "amable", "puerto", "formato"]
  .filter(k => p[k] !== undefined && p[k] !== null).map(k => [k, p[k]]));

/* Una única invitación por partida; las solicitudes simultáneas convergen. */
export async function pedirRevancha(pid, quien) {
  const original = (await get(ref(db, P + "/" + pid))).val();
  if (!original?.fin || !original.jugadores?.[quien.uid]) throw new Error("La partida debe terminar antes de pedir revancha.");
  if (original.revancha) return original.revancha;
  const candidata = await crearPartida(original.juego, quien, {
    origen: pid, cupo: cupoDe(original), lado: original.lado || LADO,
    ...opcionesDe(original)
  });
  let res;
  try {
    res = await runTransaction(ref(db, P + "/" + pid + "/revancha"), actual => actual === null ? candidata : undefined);
  } catch (error) {
    // No borrar una invitación confirmada si se perdió la respuesta.
    try {
      const enlace = (await get(ref(db, P + "/" + pid + "/revancha"))).val();
      if (enlace === candidata) return candidata;
      await borrarPartida(candidata);
      await olvidarMia(candidata, quien.uid);
    } catch (_) {}
    throw error;
  }
  if (res.committed) return candidata;
  await borrarPartida(candidata);
  await olvidarMia(candidata, quien.uid);
  const elegida = (await get(ref(db, P + "/" + pid + "/revancha"))).val();
  if (!elegida) throw new Error("No se pudo enviar la revancha. Inténtalo de nuevo.");
  return elegida;
}

/* Las cuentas vetadas por trampa (`vetados/<uid>`, que solo escribe un
   administrador) no aparecen en ninguna tabla del club. Un solo oyente
   por sesión; antes de publicar las reglas la lectura falla y no se veta
   a nadie. */
let vetadosSet = new Set(), vetadosOff = null;
const vetadosOyentes = new Set();
function vigilaVetados(cb) {
  vetadosOyentes.add(cb);
  if (!vetadosOff) vetadosOff = onValue(ref(db, "vetados"), s => {
    vetadosSet = new Set(Object.keys(s.val() || {}));
    for (const f of vetadosOyentes) f();
  }, () => {});
  return () => vetadosOyentes.delete(cb);
}
export const estaVetado = uid => vetadosSet.has(uid);

/* Récord por categoría; la transacción conserva el mejor entre pestañas. */
export function watchSolo(categoria, cb) {
  let filas = null;
  const emite = () => { if (filas) cb(filas.filter(f => !vetadosSet.has(f.uid)), null); };
  const offV = vigilaVetados(emite);
  const off = onValue(ref(db, `soloRanks/${categoria}`), s => {
    filas = Object.entries(s.val() || {}).map(([uid, fila]) => ({...fila, uid}));
    emite();
  }, e => cb([], e));
  return () => { off(); offV(); };
}
/* La tabla de una modalidad, una vez: el aviso del podio la necesita
   *antes* del récord para saber de qué puesto venía. */
export async function leerSolo(categoria) {
  const s = await get(ref(db, `soloRanks/${categoria}`));
  return Object.entries(s.val() || {}).map(([uid, fila]) => ({...fila, uid})).filter(f => !vetadosSet.has(f.uid));
}
/* La prueba de un récord del club (docs/antitrampas.md), guardada por su
   partida antes que la fila: la regla de `soloRanks` no acepta una fila
   cuya prueba no exista. Se escribe una vez y no se reescribe. */
export const guardarPruebaSolo = (categoria, uid, partida, v, texto) =>
  set(ref(db, `soloPruebas/${categoria}/${uid}/${partida}`), { v: Number.isSafeInteger(v) ? v : 0, d: String(texto || ""), at: serverTimestamp() });
export const leerPruebaSolo = (categoria, uid, partida) =>
  get(ref(db, `soloPruebas/${categoria}/${uid}/${partida}`)).then(s => s.val());
/* La racha diaria de verdad de un juego del club (club-datos.js:
   rachaClub). La regla solo deja subir `n` de a uno por día de Chile. */
export const leerRachaClub = (uid, categoria) =>
  get(ref(db, `rachasClub/${uid}/${categoria}`)).then(s => s.val());
export const apuntaRachaClub = (uid, categoria, r) =>
  set(ref(db, `rachasClub/${uid}/${categoria}`), { dia: r.dia, n: r.n, at: serverTimestamp() });
/* Una partida que el verificador rechazó, para que la vean los
   administradores en Informes. Solo la puede escribir su dueño, y solo
   la leen ellos. */
export const reportaSospecha = (uid, s) =>
  set(push(ref(db, `sospechas/${uid}`)), {
    c: String(s.c || "").slice(0, 60), m: String(s.m || "").slice(0, 300),
    p: Number.isFinite(s.p) ? s.p : 0, t: Number.isFinite(s.t) ? s.t : 0,
    d: String(s.d || "").slice(0, 20), at: serverTimestamp()
  });
/* El medidor de descarga (consumo.js): lo que cada pestaña de esta
   cuenta bajó hoy, en `users/<uid>/consumo` = {dia, t: {pestaña: bytes}}.
   Es nodo del dueño, sin reglas nuevas. Una transacción, porque varias
   pestañas y aparatos escriben a la vez, y el primero de un día nuevo
   tira lo del anterior en vez de dejarlo crecer. */
export const apuntaConsumo = (uid, dia, pestaña, bytes) =>
  runTransaction(ref(db, `users/${uid}/consumo`), v => {
    const t = v && v.dia === dia && v.t && typeof v.t === "object" ? Object.assign({}, v.t) : {};
    t[pestaña] = Math.max(Number(t[pestaña]) || 0, Math.round(bytes));
    return { dia, t };
  }, { applyLocally: false });
export const watchConsumo = (uid, cb) =>
  onValue(ref(db, `users/${uid}/consumo`), s => cb(s.val()), () => cb(null));
/* Llegado el tope: la conexión se corta y no vuelve sola. */
export const desconecta = () => goOffline(db);
/* El castigo del antitrampas (juegos/castigo.js): la hora *del servidor*
   en que empezó. Vive bajo `users/<uid>`, que ya es solo del dueño, así
   que no necesita reglas nuevas; se escucha para que llegue en vivo a las
   demás pestañas y aparatos de la misma cuenta. */
export const ponCastigo = uid => set(ref(db, `users/${uid}/castigo`), { at: serverTimestamp() });
export const watchCastigo = (uid, cb) =>
  onValue(ref(db, `users/${uid}/castigo`), s => cb(s.val()), () => cb(null));
export function guardarSolo(categoria, uid, dato) {
  return runTransaction(ref(db, `soloRanks/${categoria}/${uid}`), previo => {
    if (previo && (previo.puntos > dato.puntos || previo.puntos === dato.puntos && previo.tiempo <= dato.tiempo)) return;
    return {nombre:dato.nombre, puntos:dato.puntos, tiempo:dato.tiempo, partida:dato.partida};
  }, {applyLocally:false});
}

/* ---------- los rieles del salón (juegos/rieles.js) ----------
   `repeticiones/<categoría>/<uid>`: la mejor partida del día de cada
   cuenta en los juegos del riel (`REPES`), con su prueba antitrampas para
   rehacerla (rieles-datos.js). La consulta trae solo las tres con la
   clave de orden más alta, que son las mejores del último día con
   partidas: nunca la categoría entera, que traería cada prueba. */
export const leerRepeticion = (categoria, uid) =>
  get(ref(db, `repeticiones/${categoria}/${uid}`)).then(s => s.val());
export const guardarRepeticion = (categoria, uid, e) =>
  set(ref(db, `repeticiones/${categoria}/${uid}`), Object.assign({}, e, { at: serverTimestamp() }));
export function watchRepeticiones(categoria, cb) {
  let filas = null;
  const emite = () => { if (filas) cb(filas.filter(f => !vetadosSet.has(f.uid)), null); };
  const offV = vigilaVetados(emite);
  const off = onValue(query(ref(db, `repeticiones/${categoria}`), orderByChild("o"), limitToLast(3)), s => {
    filas = [];
    s.forEach(h => { filas.push(Object.assign({}, h.val(), { uid: h.key })); });
    filas.reverse();
    emite();
  }, e => cb([], e));
  return () => { off(); offV(); };
}

/* El chat general: `chatGeneral/<id>` y `chatGeneralUlt/<uid>` van en una
   sola actualización, y la regla del segundo exige 20 s desde el último
   mensaje de esa cuenta (rieles-datos.js). Se escuchan los de los últimos
   minutos (con tope), y la escucha se rehace de vez en cuando para que la
   ventana no crezca con la sesión. */
export function mandaChatGeneral(quien, texto, largo) {
  const k = push(ref(db, "chatGeneral")).key;
  return update(ref(db), {
    [`chatGeneral/${k}`]: { uid: quien.uid, n: String(quien.nombre || "Jugador").slice(0, 80), t: String(texto).slice(0, largo), at: serverTimestamp() },
    [`chatGeneralUlt/${quien.uid}`]: { at: serverTimestamp(), k }
  });
}
export const leerUltimoChatGeneral = uid => get(ref(db, `chatGeneralUlt/${uid}`)).then(s => s.val());
export function watchChatGeneral(desde, max, cb) {
  let v = null;
  const emite = () => { if (v) cb(v.filter(m => !vetadosSet.has(m.uid)), null); };
  const offV = vigilaVetados(emite);
  const q = query(ref(db, "chatGeneral"), orderByChild("at"), startAt(desde), limitToLast(max));
  const off = onValue(q, s => {
    v = [];
    s.forEach(h => { v.push(Object.assign({ id: h.key }, h.val())); });
    emite();
  }, err => cb([], err));
  return () => { off(); offV(); };
}
/* Los de hace más de un día los puede borrar cualquiera con sesión: el
   salón barre unos pocos al abrirse, así el nodo no crece para siempre. */
export async function barreChatGeneral(antesDe, cuantos) {
  const s = await get(query(ref(db, "chatGeneral"), orderByChild("at"), endAt(antesDe), limitToFirst(cuantos)));
  const borra = {};
  s.forEach(h => { borra[`chatGeneral/${h.key}`] = null; });
  if (Object.keys(borra).length) await update(ref(db), borra);
}

/* ---------- el directo de Circuit Breakers ----------
   `vivo/<pid>` es la pizarra del turno en curso: `h` dice de quién es
   (turno y uid) y `c` los trozos de entradas que va grabando, uno cada
   300 ms. Vive fuera de `partidas/` porque es efímero —se reescribe
   entero en cada turno y se borra al acabar— y porque colgado de la
   partida lo descargaría cualquiera que abra el vestíbulo o la lista de
   sus partidas. Lo que queda para siempre es la foto de cada turno, que
   va al registro de jugadas como cualquier otra jugada. */
export const escribeVivo = (pid, h) => set(ref(db, `vivo/${pid}`), { h });
export const trozoVivo = (pid, i, s) => set(ref(db, `vivo/${pid}/c/${i}`), s);
export const leerVivo = pid => get(ref(db, `vivo/${pid}`)).then(s => s.val(), () => null);
export function watchVivo(pid, alCabecera, alTrozo) {
  const a = onValue(ref(db, `vivo/${pid}/h`), s => alCabecera(s.val()), () => {});
  const b = onChildAdded(ref(db, `vivo/${pid}/c`), s => alTrozo(s.key, s.val()), () => {});
  return () => { a(); b(); };
}
/* El pozo de cada uno en el Tetris de sala, para las miniaturas de los
   demás: `vivo/<pid>/t/<uid>`, reescrito unas pocas veces por segundo.
   Tampoco es estado: la partida la deciden los ataques y las caídas. */
export const tetrisVivo = (pid, uid, d) => set(ref(db, `vivo/${pid}/t/${uid}`), d).catch(() => {});
export function watchTetrisVivo(pid, cb) {
  return onValue(ref(db, `vivo/${pid}/t`), s => cb(s.val() || {}), () => {});
}
/* Yemas ya no escribe ni escucha su directo en la base: va de navegador a
   navegador por la malla (`juegos/malla.js`, señalizada en `vivo/<pid>/rtc`).
   `vivo/<pid>/y` era el respaldo, y escucharlo era lo que se comía la cuota
   de descarga; las reglas ya no dejan escribir ahí, solo borrar lo que quede
   de versiones anteriores. */
/* El elenco de Clue: nombres y fotos de gente de verdad, así que no
   viven en el repositorio (que es público) sino aquí, legibles solo con
   sesión iniciada y escritos a mano en la consola, como el webhook de
   Discord. `{id: {n, d?, f}}`, con `f` una foto pequeña en data URL.
   Si no está, o las reglas aún no lo dejan leer, el juego usa su
   elenco inventado. */
export async function leerElencoClue() {
  try {
    const s = await get(ref(db, "clueElenco"));
    const v = s.val() || {};
    return Object.entries(v)
      .filter(([id, x]) => /^[a-z0-9-]{1,24}$/.test(id) && x && typeof x.n === "string")
      .map(([id, x]) => ({ id, n: x.n.slice(0, 60), c: typeof x.c === "string" ? x.c.slice(0, 24) : "", d: typeof x.d === "string" ? x.d.slice(0, 140) : "", foto: typeof x.f === "string" && x.f.startsWith("data:image/") ? x.f : "" }))
      .sort((a, b) => a.n.localeCompare(b.n));
  } catch (e) {
    return null;
  }
}

/* El buzón del chat de voz (`juegos/voz.js`), también dentro de `vivo`:
   `voz/en/<uid>` es la sesión de cada uno mientras está en la voz y
   `voz/b/<uid>/<push>` los mensajes de señalización que le mandan, que se
   borran al leerlos. Las dos cosas se van solas al desconectarse. Solo lo
   escriben los jugadores (es la regla de `vivo`), así que un mirón oye
   nada y no habla. El audio no pasa por aquí: va directo entre navegadores. */
export const senalVoz = (pid, uid) => buzon(`vivo/${pid}/voz`, uid);
/* El mismo buzón para la malla de datos de Yemas (`juegos/malla.js`):
   `vivo/<pid>/rtc`. Tiene regla propia para que un mirón también pueda
   presentarse y recibir el directo sin escribir nada más en `vivo`. */
export const senalMalla = (pid, uid) => buzon(`vivo/${pid}/rtc`, uid);
function buzon(base, uid) {
  const rEn = ref(db, `${base}/en/${uid}`), rB = ref(db, `${base}/b/${uid}`);
  return {
    async entra(sesion) {
      await remove(rB).catch(() => {});
      onDisconnect(rEn).remove().catch(() => {});
      onDisconnect(rB).remove().catch(() => {});
      await set(rEn, sesion);
    },
    sale() { remove(rEn).catch(() => {}); remove(rB).catch(() => {}); },
    alPresentes(cb) { return onValue(ref(db, `${base}/en`), s => cb(s.val() || {}), () => {}); },
    envia(para, m) { push(ref(db, `${base}/b/${para}`), { de: uid, ...m }).catch(() => {}); },
    alMensajes(cb) {
      return onChildAdded(rB, s => { const v = s.val(); remove(s.ref).catch(() => {}); if (v) cb(v.de, v); }, () => {});
    },
  };
}
export const borraVivo = pid => remove(ref(db, `vivo/${pid}`)).catch(() => {});
/* Al acabar una partida de Yemas se borran la malla (y los huevos que
   hubiera dejado una versión anterior), pero no la voz:
   la sala sigue abierta y la gente sigue hablando (y quizá pide la
   revancha). `vivo/<pid>/voz` tiene su propia regla, que deja escribir a
   los jugadores también con `fin`, y se vacía sola al desconectarse. */
export const borraYemasVivo = pid => Promise.all([
  remove(ref(db, `vivo/${pid}/y`)).catch(() => {}),
  remove(ref(db, `vivo/${pid}/rtc`)).catch(() => {}),
]);

/* ---------- el chat de la sala ----------
   `chat/<pid>` y no `partidas/<pid>/chat`: colgado de la partida, cada
   mensaje reescribiría el nodo que todos escuchan y el reductor volvería
   a correr por una frase. Cada mensaje se escribe una vez y no se edita
   (la regla exige `!data.exists()`), y solo mientras la partida existe.
   Se escuchan los últimos CHAT_MAX: una sala larga no tiene por qué
   descargar su charla entera cada vez que alguien entra a mirar. */
export const CHAT_MAX = 100, CHAT_LARGO = 300;
export function mandaChat(pid, quien, texto) {
  const t = String(texto || "").trim().slice(0, CHAT_LARGO);
  if (!t) return Promise.resolve(false);
  return push(ref(db, `chat/${pid}`), {
    uid: quien.uid, nombre: String(quien.nombre || "Jugador").slice(0, 80),
    t, at: serverTimestamp()
  }).then(() => true);
}
export function watchChat(pid, cb) {
  const q = query(ref(db, `chat/${pid}`), limitToLast(CHAT_MAX));
  return onValue(q, s => {
    const v = [];
    s.forEach(h => { v.push(Object.assign({ id: h.key }, h.val())); });
    cb(v, null);
  }, err => cb([], err));
}

/* ---------- «en juego ahora» ----------
   Para mirar una partida hay que saber que existe, y la consulta natural
   (`estado === 'jugando'`) bajaría el registro de jugadas de cada una.
   Así que los jugadores cuelgan un cartel pequeño en `enCurso/<pid>` y
   lo van refrescando (`at`) mientras juegan; el vestíbulo solo lista los
   frescos, de modo que una partida abandonada con la pestaña cerrada se
   cae sola de la lista aunque su cartel siga ahí. Lo quita quien vea el
   final, y las reglas dejan a cualquiera borrar el de una partida que ya
   acabó o que ya no existe. */
export const EN_CURSO_FRESCO = 15 * 60 * 1000;
export const anunciaEnCurso = (pid, datos) =>
  set(ref(db, `enCurso/${pid}`), Object.assign({}, datos, { at: serverTimestamp() })).catch(() => {});
export const quitaEnCurso = pid => remove(ref(db, `enCurso/${pid}`)).catch(() => {});
export function watchEnCurso(cb) {
  const q = query(ref(db, "enCurso"), orderByChild("at"), startAt(ahora() - EN_CURSO_FRESCO));
  return onValue(q, s => {
    const v = s.val() || {};
    cb(Object.entries(v).map(([id, x]) => Object.assign({ id }, x)), null);
  }, err => cb([], err));
}

/* ---------- la administración (juegos/admin.js) ----------
   Quién es administrador lo dice `admins/<uid>` = true, que solo se
   escribe a mano en la consola y que solo su dueño puede leer. Todo lo
   de abajo lo vuelven a comprobar las reglas: el panel es la cara, no la
   llave. Pensado para bajar lo mínimo:
   - un jugador normal solo escucha `suspensiones/<su uid>` (casi siempre
     vacío) y `ajustesMonedas` (unos pocos ajustes, dentro del saldo);
   - el panel escucha tres nodos chicos (`revisiones`, `suspensiones`,
     `vetados`) y lee `auditados` una vez al abrir la auditoría;
   - una prueba (hasta 200 kB) solo se baja por su clave, al abrir un
     récord o al verificar una fila que nadie auditó todavía. */
export const esAdminJuegos = uid =>
  uid ? get(ref(db, `admins/${uid}`)).then(s => s.val() === true, () => false) : Promise.resolve(false);

/* La suspensión de esta cuenta, en vivo: la pone o la levanta un
   administrador y llega al momento a todas sus pestañas. */
export const watchSuspension = (uid, cb) =>
  onValue(ref(db, `suspensiones/${uid}`), s => cb(s.val()), () => cb(null));

/* Un récord del club que subió al podio, para que lo revise un
   administrador. La regla pide que la fila de `soloRanks` sea esta misma
   partida. Una por tabla y cuenta: un récord nuevo reemplaza al anterior
   pendiente. */
export const apuntaRevision = (categoria, uid, r) =>
  set(ref(db, `revisiones/${categoria}/${uid}`), {
    p: String(r.p), pts: r.pts, t: r.t, l: r.l, n: String(r.n || "").slice(0, 80), at: serverTimestamp()
  });

/* Lo que mira el panel, en vivo: tres nodos chicos. */
export function watchAdmin(cb) {
  const d = { revisiones: {}, suspensiones: {}, vetados: {} }, err = {};
  const oye = (nodo, k) => onValue(ref(db, nodo), s => { d[k] = s.val() || {}; err[k] = null; cb(d, err); },
    e => { err[k] = e; cb(d, err); });
  const offs = [oye("revisiones", "revisiones"), oye("suspensiones", "suspensiones"), oye("vetados", "vetados")];
  return () => offs.forEach(f => f());
}
/* Lo ya auditado (`auditados/<cat>/<uid>` = {p, ok, m, at}): una lectura
   al abrir la auditoría, no una escucha. */
export const leerAuditados = () => get(ref(db, "auditados")).then(s => s.val() || {});
/* `vv` es la versión de los verificadores con que se juzgó (admin-datos:
   AUDITORIA_V): al subirla, todo lo auditado antes vuelve a la cola. Con
   las reglas sin publicar `vv` no entra y se reintenta sin él. */
export const apuntaAuditado = (categoria, uid, a) => {
  const r = ref(db, `auditados/${categoria}/${uid}`);
  const base = Object.assign({ p: String(a.p), ok: !!a.ok, m: String(a.m || "").slice(0, 300), at: serverTimestamp() }, a.h ? { h: true } : {});
  if (!Number.isSafeInteger(a.vv)) return set(r, base);
  return set(r, Object.assign({ vv: a.vv }, base)).catch(() => set(r, base));
};

/* Conservar un récord revisado: sale de la cola y queda auditado como
   bueno, para que la auditoría no vuelva a bajar su prueba. */
export const conservaRecord = (categoria, uid, partida) => update(ref(db), {
  [`revisiones/${categoria}/${uid}`]: null,
  [`auditados/${categoria}/${uid}`]: { p: String(partida), ok: true, h: true, m: "revisada a mano", at: serverTimestamp() }
});
/* Eliminar un récord: la fila, su prueba, su revisión, su auditoría y la
   repetición del riel, en una sola escritura (todo o nada). El cobro del
   podio no se borra —es del jugador y nadie lo puede tocar— pero deja de
   pagar solo: `podioValido` pide que la fila siga en la tabla. */
export function borraRecord(categoria, uid, partida, conRepeticion) {
  const u = {
    [`soloRanks/${categoria}/${uid}`]: null,
    [`revisiones/${categoria}/${uid}`]: null,
    [`auditados/${categoria}/${uid}`]: null
  };
  if (partida && /^[-a-zA-Z0-9]{1,80}$/.test(partida)) u[`soloPruebas/${categoria}/${uid}/${partida}`] = null;
  if (conRepeticion) u[`repeticiones/${categoria}/${uid}`] = null;
  return update(ref(db), u);
}
/* Descartar una revisión que ya no corresponde (la fila cambió o se
   borró): solo sale de la cola. */
export const descartaRevision = (categoria, uid) => remove(ref(db, `revisiones/${categoria}/${uid}`));

/* Sumar o restar monedas: un ajuste nuevo, que no se borra nunca (para
   deshacerlo se pone otro al revés). La regla pide `por` = quien escribe. */
export const ajustaMonedas = (uid, n, m, por) =>
  set(push(ref(db, `ajustesMonedas/${uid}`)), { n, m: String(m || "").slice(0, 200), por, at: serverTimestamp() });

/* Suspender hasta una hora (del servidor) y levantar la suspensión. */
export const suspende = (uid, hasta, m, por) =>
  set(ref(db, `suspensiones/${uid}`), { hasta: Math.round(hasta), m: String(m || "").slice(0, 300), por, at: serverTimestamp() });
export const levantaSuspension = uid => remove(ref(db, `suspensiones/${uid}`));
/* El veto de siempre (`vetados/<uid>`): para siempre, hasta que se quite. */
export const veta = (uid, m) => set(ref(db, `vetados/${uid}`), { at: serverTimestamp(), m: String(m || "").slice(0, 300) });
export const quitaVeto = uid => remove(ref(db, `vetados/${uid}`));
