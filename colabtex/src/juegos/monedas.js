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
   - **Referidos** (`referidos/`, ver referidos.js): 5000 a quien entra
     con el código de alguien y 5000 a ese alguien, si jugó tres juegos
     distintos.

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
import PR from "../../../juegos/prodrop/retos.js";
import MM from "../../../juegos/mascotas/motor.js";
import { cajaRock, reembolsoRock, repetidaRock, claveRock, PRECIO_CAJA } from "./rock-datos.js";
import { TIENDA, precioDe, aLaVenta } from "./tienda.js";
import { PRECIO_COFRE, abreCofre, reembolsoDe } from "./tacos.js";
import { CORTES } from "./cortes.js";
import * as CM from "./casino-motor.js";
import { monedasReferidos } from "./referidos.js";
import { nivelSuper } from "./rieles-datos.js";
import { leeCierre } from "./cierre-datos.js";

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
  boxhead: 1.3, haxball: 1.2, bt3: 1.5, mkw: 1.5, tulones: 1.6, hero: 1.2, memazo: 1.4, pool: 1.6, typerace: 1, worms: 1.8, presidente: 1.8, pokemon: 1.8, clue: 2.5, catan: 3
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
  pokemon: F + "112323", pool: F + "232132",
  cadena: F + "132232", worms: F + "132323", flip7: F + "221232",
  cacho: F + "212132", uno: F + "121223", catan: F + "122213",
  presidente: F + "113322", spicy: F + "122113", tetris: F + "131332",
  yemas: F + "133243", clue: F + "321233", boxhead: F + "232223", haxball: F + "123223", tulones: F + "232323", memazo: F + "313222", typerace: F + "322312",
  /* BT3 no lleva los de la fila (no clasifica): primera anfitrion visita revancha maraton incansable
     equipo dp infinito relampago. */
  bt3: "1112342212",
  /* Mario Kart Wii tampoco (no clasifica): largada anfitrion visita puros rivales grupo parrilla otra gira leyenda. */
  mkw: "1112323234",
  minas: "1232323344", snake: "2222221334", tetrisclub: "1231234124",
  sortem: "1121223434", bbtan: "1122333444", sopa: "1124112333", electro: "1123412334",
  integral: "1123412334",
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
  /* ALETEO, en el orden de LOGROS.aleteo: t1 t10 t15 t25 t35 t50 t60
     t90 t100 t130. */
  aleteo: "1122233444",
  /* 2048, en el orden de LOGROS.dosmil: f256 f512 f1024 f2048 f4096 f8192 ·
     p5k p20k p50k p100k. */
  dosmil: "1223441234",
  /* Trigon, en el orden de LOGROS.trigon: p100 p250 p500 p1k p1.5k p2.5k
     p4k p6k p10k p20k. */
  trigon: "1122233344",
  /* PRO PACMAN, en el orden de LOGROS.propac: p1k p5k p10k p25k p50k p100k
     p200k · t3 t6 t10. */
  propac: "1122334123",
  /* PRO TILES, en el orden de LOGROS.protiles: e1 e2 e3 c1 c2 c3 w ·
     m300 m1k m2500. */
  protiles: "1122344234",
  /* Pokelike, en el orden de LOGROS.pokelike: p100 p400 p800 p1400 p1900
     p2500 p4000 · d10 d25 d50. */
  pokelike: "1223444123",
  /* Metro Rush, en el orden de LOGROS.metrorush: c50k c250k c1m c3m c10m ·
     d1k d5k d10k d21k d42k · fan (Cazafantasmas: pasar al n.º 1 de la distancia). */
  metrorush: "12334123344",
  /* PRO HERO, en el orden de LOGROS.hero: e1 o1 c5 c10 o50 l10 o100 c40
     o150 l40. */
  hero: "1122233344",
  /* PRO DEFENDER, en el orden de LOGROS.prodefender: r10 r25 r50 · prado
     dunas glaciar caldera · vacio50 vacio75 vacio. Bajos a propósito: lo
     grande de este juego lo paga cada ronda del récord (monedasProdefender). */
  prodefender: "1112222333"
};
export function nivelDe(juego, id) {
  const l = LOGROS[juego] || [], i = l.findIndex(x => x.id === id);
  return i < 0 ? 0 : +((NIVEL[juego] || "")[i] || 1);
}
export const valorLogro = (juego, id) => VALOR_NIVEL[nivelDe(juego, id)] || 0;

/* Récords del club: lo que paga tener marca en una modalidad, y el extra
   que sale de la marca misma donde la marca es la dificultad. */
export const RECORD = { minas: 60, snake: 20, tetrisclub: 50, sortem: 50, bbtan: 50, sopa: 30, electro: 30, integral: 30, frontera: 40, sudoku: 40, fanal: 40, atasco: 40, aleteo: 30, dosmil: 30, trigon: 30, protiles: 20, pokelike: 40, metrorush: 40, propac: 30 };
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
/* FANAL, como BBTAN: el récord de jornadas paga cada jornada hasta él, y
   cada una más que la anterior: la n paga 5n + 5 (la 1 paga 10, la 13 —el
   Alba— 70) hasta 250 por jornada desde la 49, y pasada la 160 el récord ya
   no paga más. Llegar al Alba son 520; a la Hoguera (25), 1750; a la 50,
   6620; a la 100, 19 120. Nunca paga menos que lo de antes (10 por jornada). */
export const FANAL_SATURA = 49, FANAL_TOPE = 160;
export function monedasFanal(jornadas) {
  const J = Math.max(0, Math.floor(Math.min(+jornadas || 0, FANAL_TOPE)));
  const S = Math.min(J, FANAL_SATURA);
  return 5 * S * (S + 1) / 2 + 5 * S + (J - S) * (5 * FANAL_SATURA + 5);
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
/* PRO HERO: la fila guarda doradas·10 000 + Σ máx(doradas, azules) de cada
   canción (juegos/hero.js), y cada canción paga 100 por estrella dorada y
   50 por cada azul que no tape ya una dorada: 50·(doradas + máx). Así una
   estrella se paga una sola vez, y pasar de azul a dorada paga los 50 que
   faltaban. Con las 333 canciones a cinco doradas son 166 500. El tope
   (5000 doradas, mil canciones) es el de la regla de `soloRanks`. */
export function monedasHero(puntos) {
  const p = Math.max(0, Math.floor(+puntos || 0)), g = Math.min(Math.floor(p / 10000), 5000), m = Math.min(p % 10000, 5000);
  return 50 * (g + Math.max(g, m));
}
/* PRO DEFENDER: cada ronda del récord de un reino paga 20 × el número del
   reino (el Prado, 20; el Vacío, 100), así que llegar a la 100 son 2000,
   4000, 6000, 8000 y 10 000; los diez de la segunda y la tercera era pagan
   como el Vacío, 100 por ronda (10 000 cada uno). Sale del récord, así que una
   partida que no lo supera no paga nada, y la que lo supera paga solo las
   rondas nuevas. */
export const PRODEFENDER_REINOS = ["prado", "dunas", "glaciar", "caldera", "vacio", "pantano", "cumbres", "fosa", "engranajes", "eclipse",
  "necropolis", "esporas", "espejos", "archipielago", "noche"];
export function monedasProdefender(cat, rondas) {
  const m = /^club-prodefender-([a-z]+)$/.exec(String(cat || "")), r = m ? PRODEFENDER_REINOS.indexOf(m[1]) : -1;
  if (r < 0) return 0;
  return 20 * Math.min(r + 1, 5) * Math.max(0, Math.min(100, Math.floor(+rondas || 0)));
}
function extraRecord(cat, f) {
  if (cat === "club-hero-estrellas") return monedasHero(f.puntos);
  if (cat.startsWith("club-prodefender-")) return monedasProdefender(cat, f.puntos);
  if (/^club-frontera-(torre|palacio|fabrica)-(50|abierto)$/.test(cat)) return monedasRachaFrontera(f.puntos);
  if (cat === "club-frontera-victorias") return 3 * Math.min(f.puntos || 0, 100000);
  if (cat === "club-bbtan-rondas") return monedasBbtan(f.puntos);
  const so = /^club-sortem-(\d+)$/.exec(cat);
  if (so) return monedasSortem(+so[1], f.tiempo);
  if (cat === "club-sopa-racha" || cat === "club-electro-racha" || cat === "club-integral-racha" || cat === "club-sudoku-racha") return 10 * Math.min(f.puntos || 0, 60);
  /* Sudoku Arcade: el récord del arcade paga 1 moneda por cada 1000
     puntos (con tope, para que una marca absurda no compre la tienda). */
  if (cat === "club-sudoku-arcade") return Math.floor(Math.min(f.puntos || 0, 200000) / 1000);
  /* FANAL: el récord de jornadas paga como BBTAN (monedasFanal) y los
     puntos de la travesía o del sin fin, 1 por cada 1000, hasta el tope
     del ranking (1 000 000 son 1000). */
  if (cat === "club-fanal-jornadas") return monedasFanal(f.puntos);
  if (cat === "club-fanal-travesia" || cat === "club-fanal-sinfin") return Math.floor(Math.min(f.puntos || 0, 1000000) / 1000);
  /* Atasco: 4 monedas por estrella juntada (720 estrellas son 2880). */
  if (cat === "club-atasco-estrellas") return 4 * Math.min(f.puntos || 0, 3000);
  /* ALETEO: 2 monedas por tubo del mejor vuelo (100 tubos son 200), con
     tope en 300 tubos. */
  if (cat === "club-aleteo-vuelo") return 2 * Math.min(f.puntos || 0, 300);
  // 2048: 1 por cada 1000 puntos, y la ficha paga su exponente al cuadrado (2048 → 121).
  if (cat === "club-dosmil-puntos") return Math.floor(Math.min(f.puntos || 0, 4000000) / 1000);
  if (cat === "club-dosmil-ficha") { const e = Math.round(Math.log2(f.puntos || 1)); return e > 0 && e <= 18 ? e * e : 0; }
  // Trigon: 1 por cada 100 puntos (sus puntajes son unas diez veces más chicos que los del 2048).
  if (cat === "club-trigon-puntos") return Math.floor(Math.min(f.puntos || 0, 1000000) / 100);
  // PRO PACMAN: 1 por cada 500 puntos (un nivel limpio son unos 4 000), tope en 1 000 000.
  if (cat === "club-propac-puntos") return Math.floor(Math.min(f.puntos || 0, 1000000) / 500);
  // PRO TILES: 1 por cada 50 puntos en cada tabla (nueve: 8 canciones y la mezcla), tope en 3000.
  if (/^club-protiles-/.test(cat)) return Math.floor(Math.min(f.puntos || 0, 3000) / 50);
  /* Pokelike: 1 por cada 50 puntos (la Liga, 1900, son 38; tope en 200) y
     1 por especie atrapada en la run. */
  if (cat === "club-pokelike-puntos") return Math.floor(Math.min(f.puntos || 0, 10000) / 50);
  if (cat === "club-pokelike-pokedex") return Math.min(f.puntos || 0, 151);
  /* Metro Rush: la mejor carrera paga 1 moneda por cada 25 000 puntos
     (1 000 000 son 40, con tope en 200: en el juego se llega a millones) y
     la distancia, 1 por cada 500 m (10 km son 20, tope en 100). */
  if (/^club-metrorush-(carrera|puro|sinmonedas|fantasma|city|citypuro|cityfantasma)$/.test(cat)) return Math.floor(Math.min(f.puntos || 0, 5000000) / 25000);   // la mejor carrera de cada modo paga igual
  if (/^club-metrorush-(city)?distancia$/.test(cat)) return Math.floor(Math.min(f.puntos || 0, 50000) / 500);
  /* Un día perfecto de Electrodle son 700 puntos: 14 monedas. */
  if (cat === "club-electro-puntos") return Math.floor(Math.min(f.puntos || 0, 100000) / 50);
  /* Integrodle: 120 por día a lo más (Electrodle da 700). */
  if (cat === "club-integral-puntos") return Math.floor(Math.min(f.puntos || 0, 100000) / 10);
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
export const PAGO_CLUB = { minas: 20, snake: 15, tetrisclub: 25, sortem: 15, bbtan: 8, sopa: 25, electro: 20, integral: 20, frontera: 20, sudoku: 20, fanal: 20, atasco: 15, aleteo: 10, dosmil: 15, trigon: 15, protiles: 15, pokelike: 25, metrorush: 20, hero: 50, propac: 15 };
export const TOPE_CLUB_DIA = 15, TOPE_BBTAN_DIA = 10;
export const topeClub = juego => (juego === "bbtan" ? TOPE_BBTAN_DIA : TOPE_CLUB_DIA);
export const JUEGOS_CLUB = ["minas", "snake", "tetrisclub", "sortem", "bbtan", "sopa", "electro", "integral", "frontera", "sudoku", "fanal", "atasco", "aleteo", "dosmil", "trigon", "protiles", "pokelike", "metrorush", "hero", "propac"];
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

/* Los últimos podios tomados, del más reciente al más antiguo, para la
   sección «Últimos tops» del salón. Salen de `podios` porque es lo único
   con fecha: una fila de `soloRanks` no dice cuándo se hizo. Solo los que
   todavía valen (`podioValido`: las dos filas siguen en la tabla), y con
   la marca (`fila`) solo si la fila sigue siendo esa misma partida; si la
   persona ya la mejoró, la marca de entonces no se sabe. */
export function ultimosPodios(d, n = 8) {
  const solo = (d && d.solo) || {}, out = [];
  for (const [uid, l] of Object.entries((d && d.podios) || {}))
    for (const [partida, x] of Object.entries(l || {})) {
      if (!podioValido(uid, x, solo) || !Number.isFinite(x.at)) continue;
      const f = solo[x.c][uid];
      out.push({ uid, partida, c: x.c, p: x.p, q: x.q, at: x.at, fila: f.partida === partida ? f : null });
    }
  return out.sort((a, b) => b.at - a.at || String(a.partida).localeCompare(String(b.partida))).slice(0, n);
}

/* La racha que se ve hoy: si ayer no jugaste, ya no hay. */
export const rachaHoy = (d, hoy) => (d && (d.dia === hoy || d.dia === hoy - 1) ? d.racha : 0);

/* ---------- el saldo ----------
   `datos` = {ranks, solo, logros, diario}, las cuatro lecturas enteras. */
const num = x => (Number.isFinite(+x) ? +x : 0);
/* `porJuego` (opcional): si viene, se llena con lo que dio cada juego,
   {juego: {partidas, victorias, records, club, podios, logros}}. */
export function ganadoDe(uid, datos, porJuego) {
  const pj = (j, k, n) => { if (!porJuego || !n) return; const x = porJuego[j] || (porJuego[j] = { partidas: 0, victorias: 0, records: 0, club: 0, podios: 0, logros: 0 }); x[k] += n; };
  const d = datos || {}, p = { partidas: 0, victorias: 0, records: 0, club: 0, podios: 0, logros: 0, dias: 0, referidos: 0, ajustes: 0 };
  const tengo = {};   // juego -> Set(id) de logros
  const pon = (j, id) => { (tengo[j] = tengo[j] || new Set()).add(id); };
  for (const [j, filas] of Object.entries(d.ranks || {})) {
    const f = filas && filas[uid];
    if (!f) continue;
    const w = PESO[j] || 1;
    const pa = TARIFA.partida * w * num(f.jugadas), vi = w * (TARIFA.victoria * num(f.ganadas) + TARIFA.empate * num(f.empates));
    p.partidas += pa; p.victorias += vi; pj(j, "partidas", pa); pj(j, "victorias", vi);
    for (const id of deFila(f)) pon(j, id);
  }
  for (const [cat, filas] of Object.entries(d.solo || {})) {
    const f = filas && filas[uid], j = juegoDeCategoria(cat);
    if (!f || !j) continue;
    const re = (RECORD[j] || 0) + extraRecord(cat, f);
    p.records += re; pj(j, "records", re);
    for (const id of deMarca(j, Object.assign({ categoria: cat }, f))) pon(j, id);
  }
  for (const [j, porUid] of Object.entries(d.logros || {}))
    for (const id of Object.keys((porUid && porUid[uid]) || {})) pon(j, id);
  for (const [j, ids] of Object.entries(tengo)) for (const id of ids) { const v = valorLogro(j, id); p.logros += v; pj(j, "logros", v); }
  const dia = (d.diario || {})[uid];
  if (dia) p.dias = num(dia.bono);
  for (const [j, x] of Object.entries((d.clubJugadas || {})[uid] || {}))
    if (JUEGOS_CLUB.includes(j) && x) { const c = PAGO_CLUB[j] * Math.max(0, Math.floor(num(x.total))); p.club += c; pj(j, "club", c); }
  for (const x of Object.values((d.podios || {})[uid] || {})) if (podioValido(uid, x, d.solo)) {
    p.podios += PODIO[x.p];
    pj(juegoDeCategoria(x.c) || (String(x.c).startsWith("yemas-zombis-") ? "yemas" : "otros"), "podios", PODIO[x.p]);
  }
  /* Lo que un administrador sumó o restó a mano (`ajustesMonedas/<uid>/<id>`
     = {n, m, por, at}, admin.js). La regla solo deja escribir a quien está
     en `admins` y pide un entero de ±10 millones; lo que no cumple eso no
     cuenta aunque alguien lo cuele. */
  for (const a of Object.values((d.ajustes || {})[uid] || {}))
    if (a && Number.isInteger(a.n) && Math.abs(a.n) <= 10000000) p.ajustes += a.n;
  /* Los referidos (referidos.js): por el código que usaste y por cada
     persona que entró con el tuyo. */
  p.referidos = monedasReferidos(uid, d);
  for (const k of Object.keys(p)) p[k] = Math.round(p[k]);
  return { total: Object.values(p).reduce((a, b) => a + b, 0), partes: p, logros: Object.values(tengo).reduce((a, s) => a + s.size, 0) };
}

/* Lo que el invitado se está perdiendo en una visita: lo que esas partidas
   le habrían pagado a una cuenta nueva con las mismas reglas de arriba
   (`ganadoDe`): la partida del club por cada una (con el tope del día),
   el récord de cada modalidad por su mejor marca y los logros que esas
   marcas dan. `mejores` es categoría → la mejor marca de la visita. Es
   solo un aviso (`avisaPerdido` en juegos-main.js): no se guarda nada. */
export function ganariaInvitado(juego, jugadas, mejores) {
  let m = JUEGOS_CLUB.includes(juego) ? PAGO_CLUB[juego] * Math.min(Math.max(0, Math.floor(+jugadas || 0)), topeClub(juego)) : 0;
  const logros = new Set();
  for (const [cat, d] of Object.entries(mejores || {})) {
    if (!d) continue;
    const j = juegoDeCategoria(cat) || juego;
    m += (RECORD[j] || 0) + extraRecord(cat, d);
    for (const id of deMarca(j, Object.assign({}, d, { categoria: cat }))) logros.add(id);
  }
  for (const id of logros) m += valorLogro(juego, id);
  return { monedas: Math.round(m), logros: [...logros] };
}

/* Lo ganado más lo que dice la economía: `gastadas` (sobres, graduaciones
   y compras del mercado), `cobradas` (ventas), `saldo` y si la cuenta está
   parada por un gasto sin fondos. */
export function monedasDe(uid, datos) {
  const porJuego = {}, g = ganadoDe(uid, datos, porJuego), e = economia(datos).usuarios[uid];
  const gastadas = e ? e.gastadas : 0, cobradas = e ? e.cobradas : 0, premios = e ? e.premios : 0;
  return Object.assign(g, { gastadas, cobradas, premios, saldo: g.total + cobradas + premios - gastadas, parada: !!(e && e.parada), falta: e ? e.falta : 0,
    casino: e ? e.casino : { apostado: 0, pagado: 0, rondas: 0, porJuego: {} },
    porJuego, gasto: e ? e.gasto : {}, cuenta: e ? e.cuenta : {}, movs: e ? e.movs : [] });
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
/* Cuatro tipos de copia, y ninguno se confunde con otro: la carta (como
   siempre, sin prefijo y con `.i`), el objeto de mascota (`ob:`, de un
   regalo), la mascota (`ma:`, de una adopción) y la pieza de Batalla de
   Rock (`rk:`, de una caja), estos tres con prefijo y sin `.i`. Una copia
   escrita antes de Mascotas sigue leyéndose igual. */
const RE_COPIA = /^([A-Za-z0-9]{6,40})~([-_A-Za-z0-9]{8,24})\.([0-4])$/;
const RE_COPIA_M = /^(ob|ma|rk):([A-Za-z0-9]{6,40})~([-_A-Za-z0-9]{8,24})$/;
export const claveCopia = (o, k, i) => o + "~" + k + "." + i;
export const claveObjeto = (o, k) => "ob:" + o + "~" + k;
export const claveMascota = (o, k) => "ma:" + o + "~" + k;
export const leeCopia = c => {
  const s = String(c || ""), m = RE_COPIA.exec(s);
  if (m) return { tipo: "carta", o: m[1], k: m[2], i: +m[3] };
  const x = RE_COPIA_M.exec(s);
  return x ? { tipo: x[1] === "ob" ? "objeto" : x[1] === "rk" ? "rock" : "mascota", o: x[2], k: x[3] } : null;
};
export const esCarta = c => { const q = leeCopia(c); return !!q && q.tipo === "carta"; };
export const esMascota = c => { const q = leeCopia(c); return !!q && q.tipo === "mascota"; };
const CLAVE_SOBRE = /^[-_A-Za-z0-9]{8,24}$/;
const memoEco = new WeakMap();
const comoLista = x => (Array.isArray(x) ? x : x && typeof x === "object" ? Object.values(x) : []);
/* Lo que resolvió cada ronda del casino, por `uid~clave`. Resolver una
   cuesta un sha256 por marca (un vuelo largo del avión lleva más de cien
   avisos) y la economía se rehace cada vez que alguien apuesta: sin esto,
   cada segundo de casino rehacía todas las rondas de todo el mundo, unos
   300 ms de CPU en cada pestaña abierta del sitio, juegue o no. Cada marca
   se escribe una sola vez (las reglas), así que una ronda solo cambia
   ganando marcas: la firma lleva cuántas tiene y la suma de sus horas. */
const memoRondas = new Map();
const marcas = o => {
  if (!o || typeof o !== "object") return "";
  let n = 0, s = 0;
  for (const v of Object.values(o)) { n++; s += typeof v === "number" ? v : v && typeof v === "object" ? (+v.at || 0) + (v.t ? v.t.charCodeAt(0) : 0) : 0; }
  return n + ":" + s;
};
const firmaRonda = x => x.j + "|" + x.p + "|" + x.at + "|" + x.d + "|" + x.n + "|" + x.c + "|" + marcas(x.t) + "|" + marcas(x.s) + "|" + marcas(x.a) + "|" +
  (x.x ? x.x.at + ":" + x.x.m : "") + "|" + (x.b && typeof x.b === "object" ? JSON.stringify(x.b) : "");
/* {ronda, ev}: la ronda como la lista `economia().rondas` y sus eventos
   (la apuesta, lo que se dobló o separó y el premio), que apuntan a ella.
   Se reusan de una economía a la siguiente: lo único que la economía
   cambia es `valida`, y lo vuelve a poner en false antes de recorrer. */
function resuelveRonda(u, k, x) {
  const id = u + "~" + k, f = x && typeof x === "object" ? firmaRonda(x) : null, m = memoRondas.get(id);
  if (m && f !== null && m.f === f) return m;
  const res = CM.resuelve(u, k, x), ev = [];
  const ronda = res ? Object.assign({ u, k, j: x.j, p: x.p, d: x.d, at: x.at, valida: false }, res) : null;
  if (ronda) {
    ev.push({ t: "ca", at: x.at, u, k, p: x.p, r: ronda });
    (res.cargos || []).forEach((c, i) => ev.push({ t: "ca", at: c.at, u, k, p: c.p, extra: true, i: i + 1, r: ronda }));
    if (res.pago > 0) ev.push({ t: "cp", at: res.fin, u, k, p: res.pago, r: ronda });
  }
  const r = { f, id, ronda, ev };
  if (f !== null) memoRondas.set(id, r);
  return r;
}
/* Las rondas de una cuenta, por el objeto `casino/<uid>` que llegó:
   fb-juegos.js escucha cuenta por cuenta, así que las de quien no jugó
   desde la última lectura llegan en el mismo objeto y ni se firman.
   `rondas` es la lista que sale en `economia().casinoPorCuenta[uid]`, en el
   orden de las claves (el de las apuestas): es la misma lista mientras la
   cuenta no cambie, y casino.js guarda lo que deriva de ella. */
const memoCuentas = new WeakMap();
function rondasDe(u, l) {
  let r = memoCuentas.get(l);
  if (!r) {
    r = [];
    for (const [k, x] of Object.entries(l)) { const m = resuelveRonda(u, k, x); if (m.ronda) r.push(m); }
    r.rondas = r.map(m => m.ronda);
    memoCuentas.set(l, r);
  }
  return r;
}

export function economia(datos) {
  const d = datos || {};
  if (memoEco.has(d)) return memoEco.get(d);
  const res = recorreEconomia(d).res;
  memoEco.set(d, res);
  return res;
}

/* El estado con que empieza el recorrido: vacío, o el del último cierre
   (`datos.cierre`, ver cierre-datos.js), nuevo en cada recorrido porque el
   recorrido lo cambia. Las cartas, regalos y piezas se rehacen con su hora,
   como al abrirlas. */
function estadoInicial(base) {
  const st = { usuarios: {}, dueno: {}, graduada: {}, enVenta: {}, sobres: {}, ofertas: {}, mascotas: {}, regalos: {}, congelada: {}, historial: {}, rocas: {}, rocasPor: {}, tiene: {} };
  if (!base) return st;
  for (const [u, x] of Object.entries(base.usuarios)) st.usuarios[u] = JSON.parse(JSON.stringify(x));
  const de = (cc, o) => base.ajenas[cc] || o;
  for (const so of base.sobres) {
    st.sobres[so.u + "~" + so.k] = { u: so.u, k: so.k, at: so.at, gratis: false, cierre: true };
    for (let i = 0; i < 5; i++) if (so.vivas & (1 << i)) {
      const cc = claveCopia(so.u, so.k, i);
      st.dueno[cc] = de(cc, so.u);
      if (so.grad & (1 << i)) st.graduada[cc] = base.T;
    }
  }
  for (const so of base.rerolls) {
    st.sobres[so.u + "~" + so.k] = { u: so.u, k: so.k, at: so.at, r: so.r, de: [], tier: so.tier, cierre: true };
    const cc = claveCopia(so.u, so.k, 0);
    st.dueno[cc] = de(cc, so.u);
    if (so.grad) st.graduada[cc] = base.T;
  }
  for (const [cc, m] of Object.entries(base.mascotas)) {
    const q = leeCopia(cc);
    if (!q) continue;
    st.mascotas[cc] = { u: q.o, k: q.k, at: m.at, e: m.e };
    const w = st.dueno[cc] = de(cc, q.o);
    st.tiene[w] = (st.tiene[w] || 0) + 1;
    if (base.congelada[cc]) st.congelada[cc] = base.congelada[cc];
    if (base.historial[cc]) st.historial[cc] = base.historial[cc].slice();
  }
  for (const [cc, at] of Object.entries(base.regalos)) {
    const q = leeCopia(cc);
    if (!q) continue;
    st.regalos[cc] = { u: q.o, k: q.k, at, item: MM.regalo(q.o, q.k, at) };
    st.dueno[cc] = de(cc, q.o);
  }
  for (const [cc, x] of Object.entries(base.rocas)) {
    const q = leeCopia(cc);
    if (!q) continue;
    st.rocas[cc] = { u: q.o, k: q.k, at: x.at, b: x.b, item: cajaRock(q.o, q.k, x.at, x.b) };
    const w = st.dueno[cc] = de(cc, q.o);
    (st.rocasPor[w] = st.rocasPor[w] || []).push(cc);
  }
  for (const [id, o] of Object.entries(base.ofertas)) {
    st.ofertas[id] = { id, u: o.u, c: o.c, p: o.p, at: o.at, estado: "activa" };
    st.enVenta[o.c] = id;
  }
  return st;
}

/* El recorrido de la economía: los eventos de después del cierre (si lo
   hay) y hasta `hasta`, en orden. `crudo` deja los importes sin redondear,
   que es como los guarda un cierre (las centésimas del casino se suman y
   se redondean una sola vez al final). Devuelve también desde cuándo está
   parada cada cuenta parada (`paradaDesde`): un cierre no pasa de ahí. */
export function recorreEconomia(datos, hasta = Infinity, crudo = false) {
  const d = datos || {}, base = d.cierre ? leeCierre(d.cierre) : null, desde = base ? base.T : -Infinity;
  const c = d.cartas || {}, m = d.mercado || {}, ms = d.mascotas || {}, ev = [];
  /* Mascotas va entre el re-roll y la oferta: a igual hora se adopta, se
     abre un regalo y se compra antes de que eso mismo salga a la venta. */
  /* Un premio de desafío (`pl`) va antes que su sobre (`s`), que se
     escribe en el mismo instante: el sobre vale si su premio valió. */
  /* El cierre de cada semana (`ps`) va antes que todo lo de ese instante:
     las tablas se miran como estaban justo antes del lunes. El reclamo de
     los sobres de un podio (`pq`) va, como el de un premio, antes que sus sobres. */
  const ORDEN = { ps: -2, pq: -1, pl: -1, s: 0, g: 1, r: 2, ma: 2.1, mr: 2.2, mc: 2.3, rc: 2.4, sc: 2.5, o: 3, x: 4, v: 5, t: 6, c: 7, cf: 7.5, ca: 8, cp: 9 };
  for (const [u, l] of Object.entries(c.s || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "s", at: x.at, u, k, p: num(x.p), pl: typeof x.pl === "string" ? x.pl : "" });
  /* Los premios de los desafíos de plantilla (juegos/prodrop/retos.js):
     `plantillas/p/<uid>/<plantilla>_<nivel>` = {at, c: [once copias], k, k2?}.
     `k` y `k2` son los sobres que regala (`k2`, el segundo del nivel 2). */
  for (const [u, l] of Object.entries((d.plantillas && d.plantillas.p) || {}))
    for (const [id, x] of Object.entries(l || {}))
      if (x && Number.isFinite(x.at)) ev.push({ t: "pl", at: x.at, u, k: id, c: comoLista(x.c).map(String), sobres: [x.k, x.k2].filter(k => typeof k === "string" && k) });
  /* El podio de cada semana (retos.js): las versiones de cada subida
     (`plantillas/v/<plantilla>/<uid>/<clave>` = {at, c}, una por subida,
     y la fila de la tabla, `plantillas/s`) dicen qué tenía cada uno en la
     tabla en cualquier momento; el lunes cuenta la última de antes. */
  const versiones = {};
  /* Algunas pruebas concatenan este archivo sin sus imports: sin retos.js no hay podios. */
  const conRetos = typeof PR !== "undefined";
  const ponVersion = (tpl, u, x) => {
    if (!conRetos || !x || !Number.isFinite(x.at) || !PR.plantilla(tpl)) return;
    const l = ((versiones[tpl] = versiones[tpl] || {})[u] = versiones[tpl][u] || []);
    if (!l.some(y => y.at === x.at)) l.push({ at: x.at, c: comoLista(x.c).map(String) });
  };
  const pd = d.plantillas || {};
  for (const [tpl, porU] of Object.entries(pd.s || {})) for (const [u, x] of Object.entries(porU || {})) ponVersion(tpl, u, x);
  for (const [tpl, porU] of Object.entries(pd.v || {})) for (const [u, l] of Object.entries(porU || {})) for (const x of Object.values(l || {})) ponVersion(tpl, u, x);
  for (const porU of Object.values(versiones)) for (const l of Object.values(porU)) l.sort((a, b) => a.at - b.at);
  const tope = Math.min(hasta, Date.now());
  if (conRetos && Object.keys(versiones).length) for (let n = PR.PRIMERA; PR.finSemana(n) <= tope; n++) ev.push({ t: "ps", at: PR.finSemana(n), n });
  /* Los sobres de un podio del reto: `plantillas/q/<uid>/<reto>_p<n>` = {at, k, k2?, k3?}. */
  for (const [u, l] of Object.entries(pd.q || {}))
    for (const [id, x] of Object.entries(l || {}))
      if (x && Number.isFinite(x.at)) ev.push({ t: "pq", at: x.at, u, k: id, sobres: [x.k, x.k2, x.k3].filter(k => typeof k === "string" && k) });
  for (const [u, l] of Object.entries(c.g || {}))
    for (const [k, porI] of Object.entries(l || {}))
      for (const [i, x] of Object.entries(porI || {}))
        if (CLAVE_SOBRE.test(k) && /^[0-4]$/.test(i) && x && Number.isFinite(x.at))
          ev.push({ t: "g", at: x.at, u, k, i: +i, p: num(x.p), copia: claveCopia(typeof x.o === "string" ? x.o : u, k, i) });
  /* Los re-roll: `cartas/r/<uid>/<clave>` = {at, c: [diez copias]}. */
  for (const [u, l] of Object.entries(c.r || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "r", at: x.at, u, k, c: comoLista(x.c).map(String) });
  /* Mascotas: `mascotas/a` adopciones {at, e, p}, `mascotas/r` regalos
     {at, p} y `mascotas/c` compras {at, k, p, n?, m?}. */
  for (const [u, l] of Object.entries(ms.a || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "ma", at: x.at, u, k, e: String(x.e || ""), p: num(x.p) });
  for (const [u, l] of Object.entries(ms.r || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "mr", at: x.at, u, k, p: num(x.p) });
  for (const [u, l] of Object.entries(ms.c || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "mc", at: x.at, u, k, q: String(x.k || ""), p: num(x.p), n: x.n, m: typeof x.m === "string" ? x.m : "" });
  /* Batalla de Rock: `rock/c/<uid>/<clave>` = {at, p, b}, una caja (rock-datos.js). */
  for (const [u, l] of Object.entries((d.rock && d.rock.c) || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "rc", at: x.at, u, k, p: num(x.p), b: String(x.b || "") });
  /* Los super chats: `superChat/<uid>/<clave del mensaje>` = {at, p} (rieles-datos.js). */
  for (const [u, l] of Object.entries(d.superChat || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "sc", at: x.at, u, k, p: num(x.p) });
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
  /* Los cofres de tacos de Pool: `cofres/<uid>/<clave>` = {at, p}. */
  for (const [u, l] of Object.entries(d.cofres || {}))
    for (const [k, x] of Object.entries(l || {}))
      if (CLAVE_SOBRE.test(k) && x && Number.isFinite(x.at)) ev.push({ t: "cf", at: x.at, u, k, p: num(x.p) });
  /* El casino: `casino/<uid>/<clave>` es una ronda (casino-motor.js). La
     apuesta se cobra a la hora de la apuesta y el premio, si lo hubo, se
     suma a la hora en que se cobró; lo que pasó entremedio lo decide el
     motor con las horas del servidor. Lo que se dobla o se separa en el
     blackjack (`cargos`) se cobra a la hora de esa decisión. */
  const rondas = {}, casinoPorCuenta = {};
  for (const [u, l] of Object.entries(d.casino || {})) {
    if (!l || typeof l !== "object") continue;
    const lista = rondasDe(u, l);
    casinoPorCuenta[u] = lista.rondas;
    for (const { id, ronda, ev: er } of lista) {
      ronda.valida = false;
      rondas[id] = ronda;
      for (const e of er) ev.push(e);
    }
  }
  const T0 = desde;
  for (const r of Object.values(rondas)) r.valida = !!(base && r.at <= T0 && base.rondas[r.u + "~" + r.k]);
  const evs = ev.filter(e => e.at > T0 && e.at <= hasta);
  evs.sort((a, b) => a.at - b.at || ORDEN[a.t] - ORDEN[b.t] || ((a.id || a.k) < (b.id || b.k) ? -1 : (a.id || a.k) > (b.id || b.k) ? 1 : 0) || (a.i || 0) - (b.i || 0));

  const st = estadoInicial(base), paradaDesde = {};
  const { usuarios, dueno, graduada, enVenta, sobres, ofertas } = st, cambios = {};
  /* Mascotas: las adopciones y los regalos válidos (por clave de copia),
     las que tomaron la poción, y quiénes tuvieron cada mascota antes que
     su dueño de ahora (para heredar su estado). */
  const { mascotas, regalos, congelada, historial, tiene } = st;
  /* Batalla de Rock: las piezas de cajas válidas, por clave de copia, y
     las claves que pasaron alguna vez por cada cuenta (`rocasPor`, se
     filtra por `dueno` al leer). Buscar las propias recorriendo `rocas`
     entera en cada caja era cuadrático: con unas 2000 cajas en el sitio,
     más de medio segundo por cada lectura de Firebase, en cada pestaña. */
  const { rocas, rocasPor } = st;
  const llegaRoca = (cc, u) => { if (rocas[cc]) (rocasPor[u] = rocasPor[u] || []).push(cc); };
  const ganado = {};
  /* `gasto`/`cuenta`: lo pagado y cuántas veces, por categoría (`CATEGORIAS`);
     `movs`: cada gasto e ingreso con hora, para el historial. */
  const U = u => usuarios[u] || (usuarios[u] = { gastadas: 0, cobradas: 0, parada: false, falta: 0, gratis: -Infinity, sobres: {}, tienda: {}, desafios: {}, tacos: {}, cofres: [],
    intentos: 0, adopciones: 0, comida: 0, fondos: {}, cajasRock: [], superChats: {}, premios: 0, casino: { apostado: 0, pagado: 0, rondas: 0, porJuego: {} },
    gasto: {}, cuenta: {}, movs: [] });
  const anota = (u, c, p, d) => {
    const x = U(u);
    if (p < 0) { x.gasto[c] = (x.gasto[c] || 0) - p; x.cuenta[c] = (x.cuenta[c] || 0) + 1; }
    x.movs.push({ at: ahora, c, p, d: d || "" });
  };
  /* Una mascota cambia de manos: cuenta para el cupo de quien la tiene. */
  const pasaMascota = (cc, de, a) => {
    tiene[de] = (tiene[de] || 1) - 1; tiene[a] = (tiene[a] || 0) + 1;
    (historial[cc] = historial[cc] || []).push(de);
  };
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
    return (k ? Math.min(ganado[u], k.tope) : ganado[u]) + x.cobradas + x.premios - x.gastadas;
  };
  /* Cobra `p` a `u` por `cat` (y un detalle `d`). Si no puede, la cuenta
     queda parada (dentro de un corte, solo no vale). */
  const paga = (u, p, cat, d) => {
    const x = U(u);
    if (x.parada) { x.falta += p; return false; }
    const k = enCorte(u);
    if (k && ahora < (k.desde || 0)) { const q = Math.min(p, Math.max(0, saldo(u))); x.gastadas += q; anota(u, cat, -q, d); return true; }
    if (saldo(u) < p) { if (k) return false; x.parada = true; paradaDesde[u] = ahora; x.falta += p - Math.max(0, saldo(u)); return false; }
    x.gastadas += p; anota(u, cat, -p, d); return true;
  };
  /* Lo que es una copia: {id, g, w}, de su sobre o de su re-roll. */
  const ficha = cc => {
    const q = leeCopia(cc), so = q && q.tipo === "carta" && sobres[q.o + "~" + q.k];
    if (!so) return null;
    if (so.r) return q.i === 0 ? so.r : null;
    return PM.sobre(q.o, q.k, so.at).cartas[q.i];
  };
  // los premios de desafío que valieron, por `<uid>~<reclamo>`: cada uno de sus sobres se acepta una vez
  const reclamos = {};
  const casinoDe = (u, j) => { const pj = U(u).casino.porJuego; return pj[j] || (pj[j] = { apostado: 0, pagado: 0, rondas: 0 }); };
  /* Los podios de cada semana que cerró, para la pantalla: semana → plantilla → [uid 1.º, 2.º, 3.º]. */
  const podiosSemana = {};
  /* La tabla `clave` como estaba justo antes de `T`: de cada cuenta, su
     última subida de antes, si las once seguían siendo suyas y valía. */
  const tablaEn = (clave, T) => {
    const filas = [];
    for (const [u, l] of Object.entries(versiones[clave] || {})) {
      const x = l.filter(y => y.at < T).pop();
      if (!x || U(u).parada || x.c.length !== 11 || new Set(x.c).size !== 11 || !x.c.every(cc => dueno[cc] === u)) continue;
      const fs = x.c.map(cc => { const f = ficha(cc); return f && { id: f.id, g: f.g, gr: !!graduada[cc] }; });
      if (fs.some(f => !f)) continue;
      const ev = PR.evalua(clave, fs);
      if (ev.valida) filas.push({ u, at: x.at, puntaje: ev.puntaje });
    }
    return PR.ordenaTabla(filas);
  };
  for (const e of evs) {
    ahora = e.at;
    if (e.t === "ps") {
      /* El lunes: el podio de cada club (monedas) y el del reto que se
         cierra (monedas, y los sobres se cobran aparte). */
      const reto = PR.claveReto(e.n), sem = (podiosSemana[e.n] = {});
      for (const clave of [...PR.CLUBES.map(PR.claveClub), reto]) {
        const t = tablaEn(clave, e.at);
        if (t.length < PR.MIN_PODIO) continue;
        const titulo = PR.plantilla(clave).titulo;
        sem[clave] = t.slice(0, 3).map(f => f.u);
        t.slice(0, 3).forEach((f, i) => {
          const x = U(f.u), monedas = clave === reto ? PR.PODIO_RETO[i].monedas : PR.PODIO_CLUB[i];
          x.premios += monedas;
          anota(f.u, "plantilla", monedas, `${i + 1}.º de la semana · ${titulo}`);
          if (clave === reto) (x.podiosReto || (x.podiosReto = {}))[reto] = i + 1;
        });
      }
    } else if (e.t === "pq") {
      /* Los sobres del podio de un reto: solo quien quedó en ese puesto,
         una vez, tantos como su puesto y cada uno con el prefijo de su tipo. */
      const r = PR.leePodio(e.k), pr = r && PR.PODIO_RETO[r.n - 1], x = U(e.u);
      if (!pr || !x.podiosReto || x.podiosReto[r.clave] !== r.n || reclamos[e.u + "~" + e.k]) continue;
      if (e.sobres.length !== pr.sobres.length || new Set(e.sobres).size !== e.sobres.length
        || e.sobres.some((k, i) => k[0] !== PM.SOBRE[pr.sobres[i]].prefijo)) continue;
      reclamos[e.u + "~" + e.k] = { sobres: e.sobres.slice() };
    } else if (e.t === "pl") {
      /* Un premio vale si la plantilla está vigente (un reto, solo en su
         semana), las once son de quien reclama en ese momento y, con lo
         graduado hasta ahí, cumplen lo que pide ese nivel. Paga sus monedas
         como premio y deja pasar sus sobres (tantos como el nivel, cada uno
         con el prefijo de su tipo). */
      const r = PR.leeReclamo(e.k), pt = r && PR.plantilla(r.clave), pr = r && PR.PREMIOS[r.n - 1];
      if (!pt || !PR.vigente(pt, e.at) || e.c.length !== 11 || new Set(e.c).size !== 11) continue;
      if (!e.c.every(cc => dueno[cc] === e.u)) continue;
      const fs = e.c.map(cc => { const f = ficha(cc); return f && { id: f.id, g: f.g, gr: !!graduada[cc] }; });
      if (fs.some(f => !f) || !PR.premioOk(r.n, PR.evalua(r.clave, fs))) continue;
      if (new Set(e.sobres).size !== e.sobres.length || !PR.sobresValen(pr, e.sobres.map(k => k[0]))) continue;
      reclamos[e.u + "~" + e.k] = { sobres: e.sobres.slice() };
      // el premio 3 de un club (las once con nota 8 o más) deja además su marco de perfil (perfil-tarjeta.js)
      if (pt.tipo === "club" && r.n === PR.PREMIO_MARCO) { const ds = U(e.u).desafios || (U(e.u).desafios = {}); if (!ds[pt.club]) ds[pt.club] = e.at; }
      U(e.u).premios += pr.monedas;
      anota(e.u, "plantilla", pr.monedas, pt.titulo);
    } else if (e.t === "s") {
      const x = U(e.u);
      const plus = String(e.k)[0] === "h";   // el sobre Plus de fútbol (prefijo h) vale el doble y no tiene gratis
      if (e.pl) {
        // el sobre de un premio de desafío: gratis, una vez, y solo si el premio valió
        const r = reclamos[e.u + "~" + e.pl];
        if (e.p !== 0 || !r || !r.sobres.includes(e.k)) continue;
        r.sobres = r.sobres.filter(k => k !== e.k);
        x.cuenta.sobrePremio = (x.cuenta.sobrePremio || 0) + 1;
      } else if (e.p === 0) {
        if (plus || x.parada || e.at - x.gratis < SEIS_HORAS) continue;
        x.gratis = e.at;
        x.cuenta.sobreGratis = (x.cuenta.sobreGratis || 0) + 1;
      } else if (!(plus ? (e.p === 100 || e.p === 160) : (e.p === 50 || e.p === 80)) || !paga(e.u, e.p, "sobre")) continue;
      x.sobres[e.k] = e.at;
      sobres[e.u + "~" + e.k] = { u: e.u, k: e.k, at: e.at, gratis: e.p === 0 };
      for (let i = 0; i < 5; i++) dueno[claveCopia(e.u, e.k, i)] = e.u;
    } else if (e.t === "g") {
      if (dueno[e.copia] !== e.u || graduada[e.copia] || enVenta[e.copia] || e.p !== 100) continue;
      if (paga(e.u, 100, "graduar")) graduada[e.copia] = e.at;
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
    } else if (e.t === "ma") {
      /* Adopción: la primera escrita por cada cuenta es gratis y las demás
         cuestan PRECIO.adopcion, lo mismo que mira la regla (que solo sabe
         si ya había alguna). Con el cupo lleno (las que tiene ahora,
         compradas incluidas) no ocurre: ni cobra ni para la cuenta. */
      const x = U(e.u), precio = x.intentos === 0 ? 0 : MM.PRECIO.adopcion;
      x.intentos++;
      if (!MM.ESPECIES.includes(e.e) || (tiene[e.u] || 0) >= MM.MAX_MASCOTAS) continue;
      if (e.p !== precio || (precio === 0 ? x.parada : !paga(e.u, precio, "adopcion", e.e))) continue;
      const cc = claveMascota(e.u, e.k);
      x.adopciones++;
      mascotas[cc] = { u: e.u, k: e.k, at: e.at, e: e.e };
      dueno[cc] = e.u; tiene[e.u] = (tiene[e.u] || 0) + 1;
    } else if (e.t === "mr") {
      /* Un regalo: lo que trae sale del motor, no de lo escrito. */
      if (e.p !== MM.PRECIO.regalo || !paga(e.u, e.p, "regalo")) continue;
      const cc = claveObjeto(e.u, e.k);
      regalos[cc] = { u: e.u, k: e.k, at: e.at, item: MM.regalo(e.u, e.k, e.at) };
      dueno[cc] = e.u;
    } else if (e.t === "mc") {
      /* Comida, poción (para una mascota suya, que no está a la venta ni la
         tomó antes), un fondo (una vez) o despedir a una mascota (gratis:
         sale de la cuenta y libera su cupo). */
      const x = U(e.u), n = Number.isInteger(e.n) ? e.n : 0, precio = MM.precioCompra(e.q, n);
      if (precio === null || e.p !== precio) continue;
      if (e.q === "comida") { if (paga(e.u, precio, "comida", String(n))) x.comida += n; continue; }
      const fondo = /^fondo-([a-z]+)$/.exec(e.q);
      if (fondo) { if (!x.fondos[fondo[1]] && paga(e.u, precio, "fondoMascota", fondo[1])) x.fondos[fondo[1]] = e.at; continue; }
      if (!esMascota(e.m) || dueno[e.m] !== e.u || enVenta[e.m]) continue;
      if (e.q === "pocion") { if (!congelada[e.m] && paga(e.u, precio, "pocion")) congelada[e.m] = e.at; continue; }
      if (e.q === "adios" && !x.parada) { delete dueno[e.m]; tiene[e.u] = (tiene[e.u] || 1) - 1; }
    } else if (e.t === "rc") {
      /* Una caja de rock: al precio y para un cuerpo. Lo que trae sale de
         `cajaRock`; un repetido exacto de algo que la cuenta tiene ahora
         (lo inicial incluido) devuelve monedas y no deja copia. */
      if (e.p !== PRECIO_CAJA || (e.b !== "m" && e.b !== "f") || !paga(e.u, PRECIO_CAJA, "cajaRock", e.b)) continue;
      const v = cajaRock(e.u, e.k, e.at, e.b), propias = [];
      for (const cc of rocasPor[e.u] || []) if (dueno[cc] === e.u) propias.push(rocas[cc].item);
      const dup = repetidaRock(v, propias), cc = claveRock(e.u, e.k);
      if (dup) { const r = reembolsoRock(v); U(e.u).premios += r; anota(e.u, "cajaRock", r, "repetida"); }
      else { rocas[cc] = { u: e.u, k: e.k, at: e.at, b: e.b, item: v }; dueno[cc] = e.u; llegaRoca(cc, e.u); }
      U(e.u).cajasRock.push({ k: e.k, at: e.at, c: dup ? "" : cc, v, dup, reembolso: dup ? reembolsoRock(v) : 0 });
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
      /* Una mascota para quien ya tiene el cupo lleno: la venta no ocurre
         (no cobra ni para) y la mascota se queda con quien vendía. */
      if (esMascota(o.c) && (tiene[e.u] || 0) >= MM.MAX_MASCOTAS) { o.estado = "rechazada"; o.comprador = e.u; continue; }
      const tipo = (leeCopia(o.c) || {}).tipo || "";
      if (paga(e.u, o.p, "mercado", tipo)) {
        dueno[o.c] = e.u; llegaRoca(o.c, e.u); U(o.u).cobradas += o.p; anota(o.u, "venta", o.p, tipo); o.estado = "vendida"; o.comprador = e.u;
        if (esMascota(o.c)) pasaMascota(o.c, o.u, e.u);
      }
      else { o.estado = "impaga"; o.comprador = e.u; }
    } else if (e.t === "c") {
      /* Un marco o un fondo de la tienda: una vez por cuenta, a su precio,
         y lo de edición limitada solo mientras se vendía. */
      if (!TIENDA[e.k] || e.p !== precioDe(e.k) || !aLaVenta(e.k, e.at) || U(e.u).tienda[e.k]) continue;
      if (paga(e.u, e.p, "tienda", e.k)) U(e.u).tienda[e.k] = e.at;
    } else if (e.t === "sc") {
      /* Un super chat: al precio de un nivel. El que no se pudo pagar no
         vale, y el chat lo pinta como un mensaje normal. */
      if (nivelSuper(e.p) && paga(e.u, e.p, "superChat")) U(e.u).superChats[e.k] = e.p;
    } else if (e.t === "cf") {
      /* Un cofre de tacos: al precio, y lo que sale lo decide `abreCofre`
         con la hora del servidor. Un taco repetido devuelve monedas. */
      if (e.p !== PRECIO_COFRE || !paga(e.u, PRECIO_COFRE, "cofre", e.k)) continue;
      const x = U(e.u), id = abreCofre(e.u, e.k, e.at), dup = !!x.tacos[id];
      if (dup) { const r = reembolsoDe(id); x.premios += r; anota(e.u, "cofre", r, "repetido " + id); }
      else x.tacos[id] = e.at;
      x.cofres.push({ k: e.k, at: e.at, id, dup });
    } else if (e.t === "ca") {
      /* Una apuesta sin fondos (o de una cuenta parada) no vale: no juega
         ni paga, y la cuenta queda parada como con cualquier gasto. */
      const r = e.r;
      if (e.extra) {
        // doblar o separar: si no alcanza, la ronda entera deja de valer
        if (!r.valida) continue;
        if (!paga(e.u, e.p, "apuesta", r.j)) { r.valida = false; continue; }
        U(e.u).casino.apostado += e.p; casinoDe(e.u, r.j).apostado += e.p;
        continue;
      }
      if (!paga(e.u, e.p, "apuesta", r.j)) continue;
      r.valida = true;
      const z = U(e.u).casino; z.apostado += e.p; z.rondas++;
      const zj = casinoDe(e.u, r.j); zj.apostado += e.p; zj.rondas++;
    } else if (e.t === "cp") {
      const r = e.r;
      if (!r.valida) continue;
      U(e.u).premios += e.p; U(e.u).casino.pagado += e.p; casinoDe(e.u, r.j).pagado += e.p;
      anota(e.u, "premio", e.p, r.j);
    } else if (e.t === "t") {
      const x = e.x, dar = comoLista(x.dar).map(String), pedir = comoLista(x.pedir).map(String), todas = [...dar, ...pedir];
      const ok = x.de && x.para && x.de !== x.para && dar.length >= 1 && dar.length <= 3 && pedir.length <= 3 &&
        new Set(todas).size === todas.length && !U(x.de).parada && !U(x.para).parada &&
        dar.every(cc => dueno[cc] === x.de && !enVenta[cc]) && pedir.every(cc => dueno[cc] === x.para && !enVenta[cc]);
      /* Y nadie queda con más mascotas que el cupo. */
      const nd = dar.filter(esMascota).length, np = pedir.filter(esMascota).length;
      const cabe = (tiene[x.de] || 0) - nd + np <= MM.MAX_MASCOTAS && (tiene[x.para] || 0) - np + nd <= MM.MAX_MASCOTAS;
      cambios[e.id] = { estado: ok && cabe ? "hecho" : "nulo", at: e.at };
      if (ok && cabe) {
        for (const cc of dar) { dueno[cc] = x.para; llegaRoca(cc, x.para); if (esMascota(cc)) pasaMascota(cc, x.de, x.para); }
        for (const cc of pedir) { dueno[cc] = x.de; llegaRoca(cc, x.de); if (esMascota(cc)) pasaMascota(cc, x.para, x.de); }
      }
    }
  }
  if (!crudo) for (const [u, x] of Object.entries(usuarios)) { x.gastadas = Math.round(x.gastadas); x.cobradas = Math.round(x.cobradas); x.premios = Math.floor(x.premios + 1e-6); x.casino.pagado = Math.round(x.casino.pagado * 100) / 100; x.falta = Math.round(x.falta);
    for (const c of Object.keys(x.gasto)) x.gasto[c] = Math.round(x.gasto[c]);
    for (const z of Object.values(x.casino.porJuego)) { z.apostado = Math.round(z.apostado); z.pagado = Math.round(z.pagado * 100) / 100; }
    void u; }
  const res = { usuarios, dueno, graduada, enVenta, sobres, ofertas, cambios, mascotas, regalos, congelada, historial, rocas, rondas, casinoPorCuenta, podiosSemana,
    cierre: base ? { T: base.T, est: base.est } : null };
  return { res, paradaDesde };
}

/* Las copias de una cuenta, ya resueltas a {o, k, at, i, gr, venta}. */
export function copiasDe(uid, datos) {
  const e = economia(datos), out = [];
  for (const [cc, u] of Object.entries(e.dueno)) {
    if (u !== uid) continue;
    const q = leeCopia(cc), so = q.tipo === "carta" && e.sobres[q.o + "~" + q.k];
    if (so) out.push(Object.assign({ c: cc, o: q.o, k: q.k, i: q.i, at: so.at, gr: !!e.graduada[cc], venta: e.enVenta[cc] || "" },
      so.r ? { id: so.r.id, g: so.r.g, w: so.r.w } : {}));
  }
  return out.sort((a, b) => a.at - b.at || (a.k < b.k ? -1 : 1) || a.i - b.i);
}

/* Las mascotas que una cuenta tiene ahora: de dónde salieron (origen,
   clave y hora de la adopción, que es lo que da sus genes), su especie, si
   tomó la poción y si está a la venta. */
export function mascotasDe(uid, datos) {
  const e = economia(datos), out = [];
  for (const [cc, u] of Object.entries(e.dueno)) {
    const m = u === uid && e.mascotas[cc];
    if (m) out.push({ c: cc, o: m.u, k: m.k, at: m.at, e: m.e, frozen: !!e.congelada[cc], venta: e.enVenta[cc] || "", antes: (e.historial[cc] || []).slice() });
  }
  return out.sort((a, b) => a.at - b.at || (a.c < b.c ? -1 : 1));
}
/* Los objetos de regalos que una cuenta tiene ahora (los iniciales no
   están: no tienen copia). */
export function objetosDe(uid, datos) {
  const e = economia(datos), out = [];
  for (const [cc, u] of Object.entries(e.dueno)) {
    const r = u === uid && e.regalos[cc];
    if (r) out.push({ c: cc, o: r.u, k: r.k, at: r.at, kind: r.item.kind, id: r.item.id, tint: r.item.tint, leg: r.item.leg, venta: e.enVenta[cc] || "" });
  }
  return out.sort((a, b) => a.at - b.at || (a.c < b.c ? -1 : 1));
}

/* Los últimos legendarios que salieron de cajas de Batalla de Rock (también
   los repetidos, que devolvieron monedas), del más nuevo al más viejo, con
   quién y cuándo: la tira del salón. */
export function dropsRock(datos, n = 24) {
  if (!datos || !datos.completo) return [];
  const out = [];
  for (const [u, x] of Object.entries(economia(datos).usuarios)) for (const c of x.cajasRock || []) if (c.v && c.v.leg) out.push({ uid: u, at: c.at, k: c.k, v: c.v, dup: !!c.dup });
  return out.sort((a, b) => b.at - a.at || (a.k < b.k ? -1 : 1)).slice(0, n);
}

/* Las piezas de Batalla de Rock que una cuenta tiene ahora (las iniciales
   no están: no tienen copia). */
export function rocasDe(uid, datos) {
  const e = economia(datos), out = [];
  for (const [cc, u] of Object.entries(e.dueno)) {
    const r = u === uid && e.rocas[cc];
    if (r) out.push(Object.assign({ c: cc, o: r.u, k: r.k, at: r.at, venta: e.enVenta[cc] || "" }, r.item, { c: cc, colores: r.item.c }));
  }
  return out.sort((a, b) => a.at - b.at || (a.c < b.c ? -1 : 1));
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
   nombre y la foto salen de sus filas; la pantalla les superpone el perfil vivo. */
export function topMonedas(datos) {
  const d = datos || {}, nombres = {}, fotos = {};
  const mira = filas => { for (const [u, f] of Object.entries(filas || {})) {
    if (f && f.nombre && !nombres[u]) nombres[u] = f.nombre; else if (!(u in nombres)) nombres[u] = "";
    if (f && f.foto && !fotos[u]) fotos[u] = f.foto;   // la de Google, de una tabla de sala: por si su perfil no tiene
  } };
  for (const filas of Object.values(d.ranks || {})) mira(filas);
  for (const filas of Object.values(d.solo || {})) mira(filas);
  for (const porUid of Object.values(d.logros || {})) for (const u of Object.keys(porUid || {})) if (!(u in nombres)) nombres[u] = "";
  for (const nodo of [d.diario, d.clubJugadas, d.podios, (d.cartas || {}).s, d.tienda, d.ajustes, (d.mascotas || {}).a, (d.mascotas || {}).r, (d.rock || {}).c, d.superChat, d.casino, (d.referidos || {}).m, (d.referidos || {}).u]) for (const u of Object.keys(nodo || {})) if (!(u in nombres)) nombres[u] = "";
  /* Y quien solo sale en el cierre (todo lo suyo ya está archivado). */
  if (d.cierre) for (const u of Object.keys(economia(d).usuarios)) if (!(u in nombres)) nombres[u] = "";
  return Object.keys(nombres)
    .map(uid => Object.assign({ uid, nombre: nombres[uid], foto: fotos[uid] || "" }, monedasDe(uid, d)))
    .filter(x => x.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo || b.total - a.total || a.uid.localeCompare(b.uid));
}

const enteroEs = new Intl.NumberFormat("es-CL");
export const formatoMonedas = n => enteroEs.format(Math.round(n || 0));
