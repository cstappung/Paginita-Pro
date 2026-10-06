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
   - **La recompensa diaria** (`diario/<uid>`): se reclama con un botón
     sobre el top de monedas, una vez por día de Chile. Paga 250 el primer
     día de racha y 250 más cada día seguido, hasta 1000 desde el cuarto;
     saltarse un día vuelve a 250. Las reglas validan la fecha, la racha y
     la suma; el cliente solo puede apuntar *hoy*.
   - La racha de la Sopa diaria y la de Electrodle, los puntos de
     Electrodle, la ronda de BBTAN y la rapidez en sortEm suman un extra
     sobre su récord, porque ahí la marca misma es la dificultad.
   - **Partidas del club** (`clubJugadas/<uid>/<juego>`): cada partida que
     termina con resultado paga `PAGO_CLUB[juego]`, hasta `TOPE_CLUB_DIA`
     por juego y por día. Esta es la fuente que se puede «farmear» a
     propósito: lo que paga cada juego depende de lo que dura una partida.
     BBTAN queda en 8 y 10 al día, porque lo suyo ya lo paga el récord.
     Las reglas validan el día y que el contador suba de a uno.
   - **Podios** (`podios/<uid>/<partida>`): quitarle a otra persona el
     primer, segundo o tercer puesto de una tabla del club paga 500, 250 o
     100, cada vez. Se escribe justo después del récord que lo logró, y la
     regla exige que ese récord exista y sea el suyo.

   **Gastar** sí se guarda, porque no se puede deducir de nada, y desde
   que existe el mercado las monedas también **pasan de una cuenta a otra**.
   Todo eso (`economia`) se reproduce en un solo recorrido, en orden de hora
   del servidor: sobres (`cartas/s`, uno gratis cada 6 horas), graduaciones
   (`cartas/g`), ventas del mercado (`mercado/o`) e intercambios
   (`mercado/t`). Las reglas comprueban precios, horas y que cada cosa se
   escriba una vez, pero no pueden sumar lo ganado, así que no pueden
   impedir que un cliente modificado escriba un gasto sin fondos. Por eso
   **un gasto solo vale si estaba pagado**: el que no alcanza no cuenta,
   lo que compraba no existe, y la cuenta queda **parada** desde ahí (nada
   de lo que haga después vale) hasta que gane lo que falta. El saldo es lo
   ganado más lo cobrado menos lo pagado, así que **nunca es negativo**,
   por construcción y no por confianza.
   ============================================================ */
import { LOGROS, SOLO_PREFIJO, deFila, deMarca } from "./logros.js";
import PM from "../../../juegos/prodrop/motor.js";
import { TIENDA, PRECIO_TIENDA } from "./tienda.js";
import { CORTES } from "./cortes.js";

/* ---------- tarifas ---------- */
/* Jugar es lo que se puede repetir, y se paga: una partida corta a dos
   ronda las 20 monedas perdida y las 60 ganada; una tarde de Catan, 60 y
   180. Sin tope diario, porque una sala necesita a otra persona. */
export const TARIFA = { partida: 20, victoria: 40, empate: 20 };

/* Cuánto pesa una partida de cada juego: lo que dura y lo que cuesta
   ganarla. 1 es una partida corta a dos. */
export const PESO = {
  escondite: 1, gato: 1, cartas: 1, cuadritos: 1, cadena: 1, tetris: 1, reversi: 1.2, orbita: 1.2,
  yemas: 1.3, spicy: 1.4, flip7: 1.5, cacho: 1.5, uno: 1.5, ajedrez: 1.6,
  boxhead: 1.3, worms: 1.8, presidente: 1.8, pokemon: 1.8, clue: 2.5, catan: 3
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
  cuadritos: F + "123233", reversi: F + "331324", gato: F + "132331", ajedrez: F + "132233",
  pokemon: F + "112323",
  cadena: F + "132232", worms: F + "132323", flip7: F + "221232",
  cacho: F + "212132", uno: F + "121223", catan: F + "122213",
  presidente: F + "113322", spicy: F + "122113", tetris: F + "131332",
  yemas: F + "133243", clue: F + "321233", boxhead: F + "232223",
  minas: "1232323344", snake: "2222221334", tetrisclub: "1231234124",
  sortem: "1121223434", bbtan: "1122333444", sopa: "1124112333", electro: "1123412334",
  frontera: "1234422134",
  /* Sudoku Arcade, en el orden de LOGROS.sudoku: dia1 racha3 racha7
     racha30 · facil experto medio5 dificil10 · a10000 a25000. */
  sudoku: "1124133324",
  /* FANAL, en el orden de LOGROS.fanal: j4 j8 j11 alba · sf20 sf30 ·
     p20k p60k · s100k s250k. */
  fanal: "1233341334",
  /* Atasco, en el orden de LOGROS.atasco: e1 e30 e60 e120 e180 e270
     e360 e480 e600 e720. */
  atasco: "1122333444",
  /* Metro Rush, en el orden de LOGROS.metrorush: c50k c250k c1m c3m c10m ·
     d1k d5k d10k d21k d42k. */
  metrorush: "1233412334"
};
export function nivelDe(juego, id) {
  const l = LOGROS[juego] || [], i = l.findIndex(x => x.id === id);
  return i < 0 ? 0 : +((NIVEL[juego] || "")[i] || 1);
}
export const valorLogro = (juego, id) => VALOR_NIVEL[nivelDe(juego, id)] || 0;

/* Récords del club: lo que paga tener marca en una modalidad, y el extra
   que sale de la marca misma donde la marca es la dificultad. */
export const RECORD = { minas: 60, snake: 20, tetrisclub: 50, sortem: 50, bbtan: 50, sopa: 30, electro: 30, frontera: 40, sudoku: 40, fanal: 40, atasco: 40, metrorush: 40 };
/* BBTAN: cada ronda n paga ⌊n/4⌋, acumulado hasta la ronda del récord
   (1 a 3 no pagan, 4 y 5 pagan 1 cada una: llegar a la 5 da 2). Lo que
   paga cada ronda deja de crecer en la 450 (112 por ronda desde ahí) y
   pasada la 600 el récord ya no paga más. */
export const BBTAN_SATURA = 450, BBTAN_TOPE = 600;
export function monedasBbtan(ronda) {
  const R = Math.max(0, Math.floor(Math.min(+ronda || 0, BBTAN_TOPE)));
  const S = Math.min(R, BBTAN_SATURA), q = Math.floor(S / 4), r = S % 4;
  return 2 * q * (q - 1) + q * (r + 1) + (R - S) * Math.floor(BBTAN_SATURA / 4);
}
/* sortEm: los bloques de la modalidad, más 2 por cada segundo bajo un
   ritmo de 3 s por bloque (30 s para el 1–10, 60 s para el 1–20). */
export function monedasSortem(n, ms) {
  const N = +n || 0, seg = (+ms || 0) / 1000;
  return Math.round(N + 2 * Math.max(0, 3 * N - seg));
}
/* Frontera Batalla: lo que paga el combate n de una racha (la misma
   cuenta que `monedasCombate` en pokemon/frontera-motor.js, copiada aquí
   porque este módulo no puede cargar el simulador; el test comprueba que
   coinciden). La serie sube el pago y el séptimo, el del rival fuerte,
   paga 10 más. */
export function monedasCombateFrontera(n) {
  const k = Math.max(1, Math.floor(+n || 0)), serie = Math.floor((k - 1) / 7);
  return 4 + 2 * Math.min(10, serie) + (k % 7 === 0 ? 10 : 0);
}
/* Lo acumulado por una racha de n: la suma de cada combate, hasta 500. */
export function monedasRachaFrontera(n) {
  let t = 0;
  for (let k = 1; k <= Math.min(Math.floor(+n || 0), 500); k++) t += monedasCombateFrontera(k);
  return t;
}
function extraRecord(cat, f) {
  if (/^club-frontera-(torre|palacio|fabrica)-(50|abierto)$/.test(cat)) return monedasRachaFrontera(f.puntos);
  if (cat === "club-frontera-victorias") return 3 * Math.min(f.puntos || 0, 100000);
  if (cat === "club-bbtan-rondas") return monedasBbtan(f.puntos);
  const so = /^club-sortem-(\d+)$/.exec(cat);
  if (so) return monedasSortem(+so[1], f.tiempo);
  if (cat === "club-sopa-racha" || cat === "club-electro-racha" || cat === "club-sudoku-racha") return 10 * Math.min(f.puntos || 0, 60);
  /* Sudoku Arcade: el récord del arcade paga 1 moneda por cada 1000
     puntos (con tope, para que una marca absurda no compre la tienda). */
  if (cat === "club-sudoku-arcade") return Math.floor(Math.min(f.puntos || 0, 200000) / 1000);
  /* FANAL: cada jornada completada paga 10 (hasta la 60) y los puntos de
     la travesía o del sin fin, 1 por cada 1000, con el mismo tope. */
  if (cat === "club-fanal-jornadas") return 10 * Math.min(f.puntos || 0, 60);
  if (cat === "club-fanal-travesia" || cat === "club-fanal-sinfin") return Math.floor(Math.min(f.puntos || 0, 200000) / 1000);
  /* Atasco: 4 monedas por estrella juntada (720 estrellas son 2880). */
  if (cat === "club-atasco-estrellas") return 4 * Math.min(f.puntos || 0, 3000);
  /* Metro Rush: la mejor carrera paga 1 moneda por cada 25 000 puntos
     (1 000 000 son 40, con tope en 200: en el juego se llega a millones) y
     la distancia, 1 por cada 500 m (10 km son 20, tope en 100). */
  if (cat === "club-metrorush-carrera") return Math.floor(Math.min(f.puntos || 0, 5000000) / 25000);
  if (cat === "club-metrorush-distancia") return Math.floor(Math.min(f.puntos || 0, 50000) / 500);
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
/* Lo que paga el día número `racha` de una racha: 250, 500, 750 y, desde
   el cuarto, 1000. (Antes eran 10 a 50 por día jugado; lo ya cobrado sigue
   sumado en `bono`, que es una suma y no se recalcula.) */
export const PAGO_DIA = 250, TOPE_DIA = 4;
export const pagoDia = racha => PAGO_DIA * Math.min(Math.max(racha, 1), TOPE_DIA);
/* El registro de hoy a partir del anterior; null si hoy ya está apuntado.
   Es exactamente lo que comprueba la regla de `diario/$uid`. */
export function registraDia(prev, dia) {
  if (!prev || !Number.isInteger(prev.dia)) return { dia, racha: 1, mejor: 1, dias: 1, bono: pagoDia(1) };
  if (dia <= prev.dia) return null;
  const racha = dia === prev.dia + 1 ? prev.racha + 1 : 1;
  return { dia, racha, mejor: Math.max(prev.mejor, racha), dias: prev.dias + 1, bono: prev.bono + pagoDia(racha) };
}
/* ---------- partidas del club ----------
   `clubJugadas/<uid>/<juego>` = {dia, hoy, total, at}. Lo que paga es
   `total`: la regla solo deja sumar de a uno y hasta `topeClub(juego)` en
   el mismo día (Chile). Cada juego paga según lo que dura una partida: un
   sortEm es un minuto, una Sopa libre o un Tetris maratón son varios.
   BBTAN se queda donde estaba (8, y 10 al día): su récord ya paga cada
   ronda y es lo que no se puede repetir. Las mismas cuentas que la regla: */
export const PAGO_CLUB = { minas: 20, snake: 15, tetrisclub: 25, sortem: 15, bbtan: 8, sopa: 25, electro: 20, frontera: 20, sudoku: 20, fanal: 20, atasco: 15, metrorush: 20 };
export const TOPE_CLUB_DIA = 15, TOPE_BBTAN_DIA = 10;
export const topeClub = juego => (juego === "bbtan" ? TOPE_BBTAN_DIA : TOPE_CLUB_DIA);
export const JUEGOS_CLUB = ["minas", "snake", "tetrisclub", "sortem", "bbtan", "sopa", "electro", "frontera", "sudoku", "fanal", "atasco", "metrorush"];
export function registraJugadaClub(prev, dia, juego) {
  if (!prev || !Number.isInteger(prev.dia)) return { dia, hoy: 1, total: 1 };
  if (dia < prev.dia) return null;
  if (dia === prev.dia) return prev.hoy >= topeClub(juego) ? null : { dia, hoy: prev.hoy + 1, total: prev.total + 1 };
  return { dia, hoy: 1, total: prev.total + 1 };
}
/* ---------- podios ----------
   `podios/<uid>/<partida>` = {c: categoría, p: puesto 1–3, q: a quién se
   lo quitó, at}. Vale si la categoría es del club (o de Yemas zombis), los
   dos tienen fila en ella y no es a uno mismo. */
export const PODIO = [0, 500, 250, 100];
const CAT_PODIO = /^(club-[a-z0-9-]+|yemas-zombis-[a-z]+)$/;
export function podioValido(uid, x, solo) {
  return !!(x && CAT_PODIO.test(String(x.c)) && PODIO[x.p] && x.p === Math.floor(x.p) && typeof x.q === "string" && x.q !== uid &&
    solo && solo[x.c] && solo[x.c][uid] && solo[x.c][x.q]);
}

/* La racha que se ve hoy: si ayer no jugaste, ya no hay. */
export const rachaHoy = (d, hoy) => (d && (d.dia === hoy || d.dia === hoy - 1) ? d.racha : 0);

/* ---------- el saldo ----------
   `datos` = {ranks, solo, logros, diario}, las cuatro lecturas enteras. */
const num = x => (Number.isFinite(+x) ? +x : 0);
export function ganadoDe(uid, datos) {
  const d = datos || {}, p = { partidas: 0, victorias: 0, records: 0, club: 0, podios: 0, logros: 0, dias: 0, ajustes: 0 };
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
  for (const [j, x] of Object.entries((d.clubJugadas || {})[uid] || {}))
    if (JUEGOS_CLUB.includes(j) && x) p.club += PAGO_CLUB[j] * Math.max(0, Math.floor(num(x.total)));
  for (const x of Object.values((d.podios || {})[uid] || {})) if (podioValido(uid, x, d.solo)) p.podios += PODIO[x.p];
  /* Lo que un administrador sumó o restó a mano (`ajustesMonedas/<uid>/<id>`
     = {n, m, por, at}, admin.js). La regla solo deja escribir a quien está
     en `admins` y pide un entero de ±10 millones; lo que no cumple eso no
     cuenta aunque alguien lo cuele. */
  for (const a of Object.values((d.ajustes || {})[uid] || {}))
    if (a && Number.isInteger(a.n) && Math.abs(a.n) <= 10000000) p.ajustes += a.n;
  for (const k of Object.keys(p)) p[k] = Math.round(p[k]);
  return { total: Object.values(p).reduce((a, b) => a + b, 0), partes: p, logros: Object.values(tengo).reduce((a, s) => a + s.size, 0) };
}

/* Lo ganado más lo que dice la economía: `gastadas` (sobres, graduaciones
   y compras del mercado), `cobradas` (ventas), `saldo` y si la cuenta está
   parada por un gasto sin fondos. */
export function monedasDe(uid, datos) {
  const g = ganadoDe(uid, datos), e = economia(datos).usuarios[uid];
  const gastadas = e ? e.gastadas : 0, cobradas = e ? e.cobradas : 0;
  return Object.assign(g, { gastadas, cobradas, saldo: g.total + cobradas - gastadas, parada: !!(e && e.parada), falta: e ? e.falta : 0 });
}

/* ---------- la economía de PRODROP ----------
   Una copia de una carta se llama `<uid de origen>~<clave del sobre>.<i>`:
   el sobre (y por tanto la carta, su nota y su desgaste) sale de quien lo
   compró, pero la copia puede cambiar de dueño.

   Las reglas del recorrido, en orden de hora (a igual hora: sobre,
   graduación, oferta, retiro, venta, intercambio):
   - **Gastar** (sobre, graduación, compra en el mercado) necesita que la
     cuenta no esté parada y que el saldo alcance. Si no alcanza, el gasto
     no vale y la cuenta queda parada desde ahí: es lo que hace que lo
     aceptado solo crezca cuando lo ganado crece, sin que una compra barata
     posterior pueda colarse hoy y salir mañana.
   - Lo que **no vale por otra razón** (graduar una carta que ya no es tuya,
     comprar una oferta ya retirada) simplemente no ocurre: no cobra ni para.
   - Un **sobre gratis** (`p: 0`) vale si el anterior gratis válido de esa
     cuenta fue hace 6 horas o más. No es gasto, así que no para a nadie.
   - Una **oferta** vale si quien vende tiene la carta, no está parado y la
     carta no está ya en venta. Mientras está en venta no se gradúa ni se
     intercambia. Una **venta** a quien no puede pagar no vale: la carta se
     queda con quien vendía y la oferta se cierra.
   - Un **intercambio** vale al aceptarse si los dos tienen todavía sus
     cartas, ninguna está en venta y ninguno está parado. */
export const SEIS_HORAS = 6 * 3600 * 1000;
const RE_COPIA = /^([A-Za-z0-9]{6,40})~([-_A-Za-z0-9]{8,24})\.([0-4])$/;
export const claveCopia = (o, k, i) => o + "~" + k + "." + i;
export const leeCopia = c => { const m = RE_COPIA.exec(String(c || "")); return m ? { o: m[1], k: m[2], i: +m[3] } : null; };
const CLAVE_SOBRE = /^[-_A-Za-z0-9]{8,24}$/;
const memoEco = new WeakMap();
const comoLista = x => (Array.isArray(x) ? x : x && typeof x === "object" ? Object.values(x) : []);

export function economia(datos) {
  const d = datos || {};
  if (memoEco.has(d)) return memoEco.get(d);
  const c = d.cartas || {}, m = d.mercado || {}, ev = [];
  const ORDEN = { s: 0, g: 1, r: 2, o: 3, x: 4, v: 5, t: 6, c: 7 };
  for (const [u, l] of Object.entries(c.s || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "s", at: x.at, u, k, p: num(x.p) });
  for (const [u, l] of Object.entries(c.g || {}))
    for (const [k, porI] of Object.entries(l || {}))
      for (const [i, x] of Object.entries(porI || {}))
        if (CLAVE_SOBRE.test(k) && /^[0-4]$/.test(i) && x && Number.isFinite(x.at))
          ev.push({ t: "g", at: x.at, u, k, i: +i, p: num(x.p), copia: claveCopia(typeof x.o === "string" ? x.o : u, k, i) });
  /* Los re-roll: `cartas/r/<uid>/<clave>` = {at, c: [diez copias]}. */
  for (const [u, l] of Object.entries(c.r || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "r", at: x.at, u, k, c: comoLista(x.c).map(String) });
  for (const [id, o] of Object.entries(m.o || {})) {
    if (!o || !Number.isFinite(o.at)) continue;
    ev.push({ t: "o", at: o.at, id, o });
    if (Number.isFinite(o.x)) ev.push({ t: "x", at: o.x, id });
    if (o.v && Number.isFinite(o.v.at)) ev.push({ t: "v", at: o.v.at, id, u: o.v.u });
  }
  for (const [id, x] of Object.entries(m.t || {}))
    if (x && Number.isFinite(x.ok) && !Number.isFinite(x.x)) ev.push({ t: "t", at: x.ok, id, x });
  /* La tienda del perfil: `tienda/<uid>/<artículo>` = {at, p}. */
  for (const [u, l] of Object.entries(d.tienda || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (x && Number.isFinite(x.at)) ev.push({ t: "c", at: x.at, u, k, p: num(x.p) });
  ev.sort((a, b) => a.at - b.at || ORDEN[a.t] - ORDEN[b.t] || ((a.id || a.k) < (b.id || b.k) ? -1 : (a.id || a.k) > (b.id || b.k) ? 1 : 0) || (a.i || 0) - (b.i || 0));

  const usuarios = {}, dueno = {}, graduada = {}, enVenta = {}, sobres = {}, ofertas = {}, cambios = {};
  const ganado = {};
  const U = u => usuarios[u] || (usuarios[u] = { gastadas: 0, cobradas: 0, parada: false, falta: 0, gratis: -Infinity, sobres: {}, tienda: {} });
  /* Un corte (cortes.js) congela lo que la cuenta ganó hasta `hasta` en
     `tope`: lo que gastó antes se mide contra eso y, si no alcanzaba, se
     anula sin parar la cuenta. Lo que gane después ya no tapa nada viejo.
     Antes de `desde` (si lo hay) todo lo comprado vale igual: lo que no
     alcanzaba se perdona y el saldo queda en cero, no en negativo. */
  const cortes = d.cortes || CORTES;
  let ahora = 0;
  const enCorte = u => { const k = cortes[u]; return k && ahora <= k.hasta ? k : null; };
  const saldo = u => {
    if (!(u in ganado)) ganado[u] = ganadoDe(u, d).total;
    const x = U(u), k = enCorte(u);
    return (k ? Math.min(ganado[u], k.tope) : ganado[u]) + x.cobradas - x.gastadas;
  };
  /* Cobra `p` a `u`. Si no puede, la cuenta queda parada (dentro de un
     corte, solo no vale). */
  const paga = (u, p) => {
    const x = U(u);
    if (x.parada) { x.falta += p; return false; }
    const k = enCorte(u);
    if (k && ahora < (k.desde || 0)) { x.gastadas += Math.min(p, Math.max(0, saldo(u))); return true; }
    if (saldo(u) < p) { if (k) return false; x.parada = true; x.falta += p - Math.max(0, saldo(u)); return false; }
    x.gastadas += p; return true;
  };
  /* Lo que es una copia: {id, g, w}, de su sobre o de su re-roll. */
  const ficha = cc => {
    const q = leeCopia(cc), so = q && sobres[q.o + "~" + q.k];
    if (!so) return null;
    if (so.r) return q.i === 0 ? so.r : null;
    return PM.sobre(q.o, q.k, so.at).cartas[q.i];
  };
  for (const e of ev) {
    ahora = e.at;
    if (e.t === "s") {
      const x = U(e.u);
      if (e.p === 0) {
        if (x.parada || e.at - x.gratis < SEIS_HORAS) continue;
        x.gratis = e.at;
      } else if (!(e.p === 50 || e.p === 80) || !paga(e.u, e.p)) continue;
      x.sobres[e.k] = e.at;
      sobres[e.u + "~" + e.k] = { u: e.u, k: e.k, at: e.at, gratis: e.p === 0 };
      for (let i = 0; i < 5; i++) dueno[claveCopia(e.u, e.k, i)] = e.u;
    } else if (e.t === "g") {
      if (dueno[e.copia] !== e.u || graduada[e.copia] || enVenta[e.copia] || e.p !== 100) continue;
      if (paga(e.u, 100)) graduada[e.copia] = e.at;
    } else if (e.t === "r") {
      /* Un re-roll vale si quien lo hace no está parado y las diez son
         suyas, distintas, no están a la venta y son de la misma rareza
         (menos que legendaria) y de la colección de su clave. Las diez desaparecen y queda una copia
         nueva, `<uid>~<clave>.0`, cuya carta y nota salen del motor. */
      const x = U(e.u), cs = e.c;
      if (x.parada || cs.length !== PM.REROLL.n || new Set(cs).size !== cs.length) continue;
      if (!cs.every(cc => dueno[cc] === e.u && !enVenta[cc])) continue;
      const fs = cs.map(ficha);
      if (fs.some(f => !f)) continue;
      const tier = PM.CARDS[fs[0].id].tier;
      if (tier >= 3 || fs.some(f => PM.CARDS[f.id].tier !== tier)) continue;
      // y de la colección que dice su clave (antes de las colecciones, todo era de los profes)
      if (fs.some(f => PM.CARDS[f.id].col !== PM.coleccionDe(e.k))) continue;
      const res = PM.reroll(e.u, e.k, e.at, tier, fs.map(f => f.g));
      for (const cc of cs) delete dueno[cc];
      sobres[e.u + "~" + e.k] = { u: e.u, k: e.k, at: e.at, r: res, de: cs.slice(), tier };
      dueno[claveCopia(e.u, e.k, 0)] = e.u;
    } else if (e.t === "o") {
      const o = e.o, copia = typeof o.c === "string" ? o.c : "", p = num(o.p);
      const ok = leeCopia(copia) && dueno[copia] === o.u && !enVenta[copia] && !U(o.u).parada && Number.isInteger(p) && p >= 1 && p <= 100000;
      ofertas[e.id] = { id: e.id, u: o.u, c: copia, p, at: e.at, estado: ok ? "activa" : "nula" };
      if (ok) enVenta[copia] = e.id;
    } else if (e.t === "x") {
      const o = ofertas[e.id];
      if (o && o.estado === "activa") { o.estado = "retirada"; o.fin = e.at; delete enVenta[o.c]; }
    } else if (e.t === "v") {
      const o = ofertas[e.id];
      if (!o || o.estado !== "activa" || !e.u || e.u === o.u) continue;
      delete enVenta[o.c];
      o.fin = e.at;
      if (paga(e.u, o.p)) { dueno[o.c] = e.u; U(o.u).cobradas += o.p; o.estado = "vendida"; o.comprador = e.u; }
      else { o.estado = "impaga"; o.comprador = e.u; }
    } else if (e.t === "c") {
      /* Un marco o un fondo de la tienda: una vez por cuenta, al precio. */
      if (!TIENDA[e.k] || e.p !== PRECIO_TIENDA || U(e.u).tienda[e.k]) continue;
      if (paga(e.u, PRECIO_TIENDA)) U(e.u).tienda[e.k] = e.at;
    } else if (e.t === "t") {
      const x = e.x, dar = comoLista(x.dar).map(String), pedir = comoLista(x.pedir).map(String), todas = [...dar, ...pedir];
      const ok = x.de && x.para && x.de !== x.para && dar.length >= 1 && dar.length <= 3 && pedir.length <= 3 &&
        new Set(todas).size === todas.length && !U(x.de).parada && !U(x.para).parada &&
        dar.every(cc => dueno[cc] === x.de && !enVenta[cc]) && pedir.every(cc => dueno[cc] === x.para && !enVenta[cc]);
      cambios[e.id] = { estado: ok ? "hecho" : "nulo", at: e.at };
      if (ok) { for (const cc of dar) dueno[cc] = x.para; for (const cc of pedir) dueno[cc] = x.de; }
    }
  }
  for (const [u, x] of Object.entries(usuarios)) { x.gastadas = Math.round(x.gastadas); x.cobradas = Math.round(x.cobradas); x.falta = Math.round(x.falta); void u; }
  const res = { usuarios, dueno, graduada, enVenta, sobres, ofertas, cambios };
  memoEco.set(d, res);
  return res;
}

/* Las copias de una cuenta, ya resueltas a {o, k, at, i, gr, venta}. */
export function copiasDe(uid, datos) {
  const e = economia(datos), out = [];
  for (const [cc, u] of Object.entries(e.dueno)) {
    if (u !== uid) continue;
    const q = leeCopia(cc), so = e.sobres[q.o + "~" + q.k];
    if (so) out.push(Object.assign({ c: cc, o: q.o, k: q.k, i: q.i, at: so.at, gr: !!e.graduada[cc], venta: e.enVenta[cc] || "" },
      so.r ? { id: so.r.id, g: so.r.g, w: so.r.w } : {}));
  }
  return out.sort((a, b) => a.at - b.at || (a.k < b.k ? -1 : 1) || a.i - b.i);
}

/* Cuándo toca el próximo sobre gratis (0: ya). */
export function proximoGratis(uid, datos, ahora) {
  const x = economia(datos).usuarios[uid];
  if (!x || !Number.isFinite(x.gratis)) return 0;
  const t = x.gratis + SEIS_HORAS;
  return t > ahora ? t : 0;
}

/* Todos los que aparecen en alguna lectura, con las monedas que tienen
   **ahora** (el saldo, lo mismo que dice la cabecera de cada uno), de más
   a menos (el uid desempata, para que el orden no baile). El
   nombre sale de sus filas; la pantalla le superpone el perfil vivo. */
export function topMonedas(datos) {
  const d = datos || {}, nombres = {};
  const mira = filas => { for (const [u, f] of Object.entries(filas || {})) if (f && f.nombre && !nombres[u]) nombres[u] = f.nombre; else if (!(u in nombres)) nombres[u] = ""; };
  for (const filas of Object.values(d.ranks || {})) mira(filas);
  for (const filas of Object.values(d.solo || {})) mira(filas);
  for (const porUid of Object.values(d.logros || {})) for (const u of Object.keys(porUid || {})) if (!(u in nombres)) nombres[u] = "";
  for (const nodo of [d.diario, d.clubJugadas, d.podios, (d.cartas || {}).s, d.tienda, d.ajustes]) for (const u of Object.keys(nodo || {})) if (!(u in nombres)) nombres[u] = "";
  return Object.keys(nombres)
    .map(uid => Object.assign({ uid, nombre: nombres[uid] }, monedasDe(uid, d)))
    .filter(x => x.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo || b.total - a.total || a.uid.localeCompare(b.uid));
}

export const formatoMonedas = n => Math.round(n || 0).toLocaleString("es-CL");
