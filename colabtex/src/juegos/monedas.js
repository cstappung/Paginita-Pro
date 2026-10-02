/* ============================================================
   Monedas 🪙 — puras y verificables en Node.

   El saldo **no se guarda en ningún sitio**: se calcula, como los logros
   de la fila, a partir de lo que ya está escrito y que las reglas ya
   validan. Un saldo guardado sería una cifra que cualquiera con la
   consola abierta podría reescribir; una suma de cosas comprobadas no.
   Salen de cinco fuentes:

   - **Partidas de sala** (`ranks/<juego>/<uid>`): cada partida, cada
     victoria y cada empate, por el `PESO` del juego. Una partida de
     Catan es una tarde; una de Cuadritos, cinco minutos.
   - **Récords del club** (`soloRanks`): una vez por modalidad en la que
     tengas marca. Mejorar una marca no paga dos veces la misma tabla, así
     que no se puede «farmear» repitiendo la partida fácil.
   - **Logros**: según su dificultad, en cuatro niveles (`NIVEL`). Es la
     fuente grande a propósito: lo difícil es lo que más paga.
   - **Días seguidos jugando** (`diario/<uid>`): lo único nuevo. Cada día
     en que terminas una partida (de sala o del club) paga 10, y la racha
     sube el pago 5 por día hasta 50 desde el noveno. Las reglas validan
     la fecha, la racha y la suma; el cliente solo puede apuntar *hoy*.
   - La racha de la Sopa diaria y la de Electrodle, los puntos de
     Electrodle y la ronda de BBTAN suman un extra sobre su récord, porque
     ahí la marca misma es la dificultad.

   **Gastar** sí se guarda, porque no se puede deducir de nada: cada sobre
   de PRODROP (`cartas/s/<uid>/<clave>`, con su precio `p`) y cada carta
   graduada (`cartas/g/<uid>/<clave>/<i>`). Las reglas comprueban el precio
   de cada compra, pero no pueden sumar lo ganado — eso se calcula aquí —,
   así que no pueden impedir gastar de más. Lo que sí garantiza el cálculo
   es que se nota: lo ganado nunca baja, así que un saldo negativo es
   prueba de haber comprado sin fondos, y las cartas de esa cuenta no se
   exhiben en ninguna parte (juegos/cartas.js).
   ============================================================ */
import { LOGROS, SOLO_PREFIJO, deFila, deMarca } from "./logros.js";

/* ---------- tarifas ---------- */
export const TARIFA = { partida: 5, victoria: 15, empate: 5 };

/* Cuánto pesa una partida de cada juego: lo que dura y lo que cuesta
   ganarla. 1 es una partida corta a dos. */
export const PESO = {
  escondite: 1, cartas: 1, cuadritos: 1, reversi: 1.2, orbita: 1.2, cadena: 1,
  flip7: 1.3, cacho: 1.3, uno: 1.3, spicy: 1.3, tetris: 1, yemas: 1.2,
  worms: 1.5, presidente: 1.5, ajedrez: 1.6, clue: 2.2, catan: 2.5
};

/* Lo que vale un logro según su nivel: 1 fácil … 4 legendario. */
export const VALOR_NIVEL = [0, 15, 40, 100, 250];
export const NOMBRE_NIVEL = ["", "Fácil", "Medio", "Difícil", "Legendario"];
/* El nivel de cada logro, en el orden de `LOGROS[juego]`: un dígito por
   logro. En los de sala los cuatro primeros son los de la fila (primera
   victoria, diez victorias, racha de tres, veinticinco partidas). */
const F = "1322";
export const NIVEL = {
  orbita: F + "212233", escondite: F + "322311", cartas: F + "222132",
  cuadritos: F + "123233", reversi: F + "331324", ajedrez: F + "132233",
  cadena: F + "132232", worms: F + "132323", flip7: F + "221232",
  cacho: F + "212132", uno: F + "121223", catan: F + "122213",
  presidente: F + "113322", spicy: F + "122113", tetris: F + "131332",
  yemas: F + "133243", clue: F + "321233",
  minas: "1232323344", snake: "2222221334", tetrisclub: "1231234124",
  sortem: "1121223434", bbtan: "1122333444", sopa: "1124112333", electro: "1123412334"
};
export function nivelDe(juego, id) {
  const l = LOGROS[juego] || [], i = l.findIndex(x => x.id === id);
  return i < 0 ? 0 : +((NIVEL[juego] || "")[i] || 1);
}
export const valorLogro = (juego, id) => VALOR_NIVEL[nivelDe(juego, id)] || 0;

/* Récords del club: lo que paga tener marca en una modalidad, y el extra
   que sale de la marca misma donde la marca es la dificultad. */
export const RECORD = { minas: 30, snake: 8, tetrisclub: 25, sortem: 25, bbtan: 25, sopa: 15, electro: 15 };
function extraRecord(cat, f) {
  if (cat === "club-bbtan-rondas") return Math.floor(Math.min(f.puntos || 0, 1000) / 2);
  if (cat === "club-sopa-racha" || cat === "club-electro-racha") return 10 * Math.min(f.puntos || 0, 60);
  /* Un día perfecto de Electrodle son 700 puntos: 14 monedas. */
  if (cat === "club-electro-puntos") return Math.floor(Math.min(f.puntos || 0, 100000) / 50);
  return 0;
}
const juegoDeCategoria = c => Object.keys(SOLO_PREFIJO).find(k => String(c).startsWith(SOLO_PREFIJO[k])) || "";

/* ---------- el día de Chile y la racha diaria ----------
   El mismo día para todos: el de Santiago. `dia` es el número de días
   desde 1970 de esa fecha, que es lo que las reglas pueden comparar con
   `now` (sin fechas en texto). */
const FORMATO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
export function diaChile(ms) {
  const p = {};
  for (const x of FORMATO.formatToParts(new Date(ms == null ? Date.now() : ms))) p[x.type] = x.value;
  return Math.round(Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5);
}
/* Lo que paga el día número `racha` de una racha: 10, 15, … 50. */
export const pagoDia = racha => 10 + 5 * Math.min(Math.max(racha, 1) - 1, 8);
/* El registro de hoy a partir del anterior; null si hoy ya está apuntado.
   Es exactamente lo que comprueba la regla de `diario/$uid`. */
export function registraDia(prev, dia) {
  if (!prev || !Number.isInteger(prev.dia)) return { dia, racha: 1, mejor: 1, dias: 1, bono: pagoDia(1) };
  if (dia <= prev.dia) return null;
  const racha = dia === prev.dia + 1 ? prev.racha + 1 : 1;
  return { dia, racha, mejor: Math.max(prev.mejor, racha), dias: prev.dias + 1, bono: prev.bono + pagoDia(racha) };
}
/* La racha que se ve hoy: si ayer no jugaste, ya no hay. */
export const rachaHoy = (d, hoy) => (d && (d.dia === hoy || d.dia === hoy - 1) ? d.racha : 0);

/* ---------- el saldo ----------
   `datos` = {ranks, solo, logros, diario}, las cuatro lecturas enteras. */
const num = x => (Number.isFinite(+x) ? +x : 0);
export function monedasDe(uid, datos) {
  const d = datos || {}, p = { partidas: 0, victorias: 0, records: 0, logros: 0, dias: 0 };
  const tengo = {};   // juego -> Set(id) de logros
  const pon = (j, id) => { (tengo[j] = tengo[j] || new Set()).add(id); };
  for (const [j, filas] of Object.entries(d.ranks || {})) {
    const f = filas && filas[uid];
    if (!f) continue;
    const w = PESO[j] || 1;
    p.partidas += TARIFA.partida * w * num(f.jugadas);
    p.victorias += w * (TARIFA.victoria * num(f.ganadas) + TARIFA.empate * num(f.empates));
    for (const id of deFila(f)) pon(j, id);
  }
  for (const [cat, filas] of Object.entries(d.solo || {})) {
    const f = filas && filas[uid], j = juegoDeCategoria(cat);
    if (!f || !j) continue;
    p.records += (RECORD[j] || 0) + extraRecord(cat, f);
    for (const id of deMarca(j, Object.assign({ categoria: cat }, f))) pon(j, id);
  }
  for (const [j, porUid] of Object.entries(d.logros || {}))
    for (const id of Object.keys((porUid && porUid[uid]) || {})) pon(j, id);
  for (const [j, ids] of Object.entries(tengo)) for (const id of ids) p.logros += valorLogro(j, id);
  const dia = (d.diario || {})[uid];
  if (dia) p.dias = num(dia.bono);
  for (const k of Object.keys(p)) p[k] = Math.round(p[k]);
  const total = Object.values(p).reduce((a, b) => a + b, 0), gastadas = gastoDe(uid, d.cartas);
  return { total, gastadas, saldo: total - gastadas, partes: p, logros: Object.values(tengo).reduce((a, s) => a + s.size, 0) };
}

/* Lo gastado en PRODROP: el precio anotado de cada sobre y de cada
   graduación (`cartas` = {s, g}, ver fb-juegos.js). */
export function gastoDe(uid, cartas) {
  const c = cartas || {};
  let t = 0;
  for (const x of Object.values((c.s || {})[uid] || {})) t += num(x && x.p);
  for (const porK of Object.values((c.g || {})[uid] || {})) for (const x of Object.values(porK || {})) t += num(x && x.p);
  return Math.round(t);
}

/* Todos los que aparecen en alguna de las cuatro lecturas, con lo que
   han ganado (no lo que les queda: gastar en sobres no baja a nadie del
   top), de más a menos (el uid desempata, para que el orden no baile). El
   nombre sale de sus filas; la pantalla le superpone el perfil vivo. */
export function topMonedas(datos) {
  const d = datos || {}, nombres = {};
  const mira = filas => { for (const [u, f] of Object.entries(filas || {})) if (f && f.nombre && !nombres[u]) nombres[u] = f.nombre; else if (!(u in nombres)) nombres[u] = ""; };
  for (const filas of Object.values(d.ranks || {})) mira(filas);
  for (const filas of Object.values(d.solo || {})) mira(filas);
  for (const porUid of Object.values(d.logros || {})) for (const u of Object.keys(porUid || {})) if (!(u in nombres)) nombres[u] = "";
  for (const u of Object.keys(d.diario || {})) if (!(u in nombres)) nombres[u] = "";
  return Object.keys(nombres)
    .map(uid => Object.assign({ uid, nombre: nombres[uid] }, monedasDe(uid, d)))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total || a.uid.localeCompare(b.uid));
}

export const formatoMonedas = n => Math.round(n || 0).toLocaleString("es-CL");
