/* Casino — el motor, sin DOM: lo usan la pestaña, la economía
   (monedas.js) y las pruebas de Node.

   **El azar decide el pasado, nunca el futuro.** Cada ronda es
   `casino/<uid>/<clave>` y cada decisión del jugador es una escritura de
   una vez cuyo valor es la hora del servidor (la regla exige `=== now`):
   el despegue `at`, los avisos del avión `t/<i>`, los saltos del pingüino
   `s/<i>` y el «me retiro» `c`. Lo que pasó en el tramo que termina en una
   de esas horas sale de `sha256(uid, clave, hora)`. Nadie elige el
   milisegundo en que el servidor recibe su escritura, así que nadie elige
   el resultado; y como el tramo ya pasó cuando se decide, saber la fórmula
   no sirve para ver venir el choque. No hay nada guardado que leer antes
   de tiempo: el punto de choque no existe hasta que alguien escribe.

   Lo que se reparte es una martingala: ninguna forma de jugar (cobrar
   antes, tarde, con o sin avisos, a mano o con un programa) cambia la
   esperanza, que es `RETORNO` (0,97 por moneda apostada) menos lo que se
   pierde al redondear el multiplicador hacia abajo. Por eso no hay
   antitrampas de automatización: no habría nada que ganarle. */
import PM from "../../../juegos/prodrop/motor.js";

export const RETORNO = 0.97;
export const APUESTA_MIN = 10;

/* Un número en [0, 1) de una ronda y una hora. */
export function azar(uid, k, etiqueta, ms) {
  const h = PM.sha256("casino:" + uid + ":" + k + ":" + etiqueta + ":" + ms);
  return (h[0] * 2097152 + (h[1] >>> 11)) / 9007199254740992;
}
const baja2 = x => Math.floor(x * 100 + 1e-9) / 100;
/* El pago va en centésimas de moneda: redondearlo a monedas enteras se
   comía hasta un 10 % de la apuesta mínima (10 × 1,07 = 10). La economía
   suma los premios así y redondea hacia abajo una sola vez al final. */
const centavos = x => Math.round(x * 100) / 100;
export const pagoDe = (p, mult) => centavos(p * mult);
/* Un número a la chilena con entre `min` y `max` decimales. El formateador
   se guarda: `toLocaleString` con opciones arma uno nuevo en cada llamada,
   y los juegos escriben números en cada cuadro. */
const formatos = {};
export const numeroEs = (x, min, max) => (formatos[min + ":" + max] || (formatos[min + ":" + max] = new Intl.NumberFormat("es-CL", { minimumFractionDigits: min, maximumFractionDigits: max }))).format(x);
export const formatoPago = n => numeroEs(+n || 0, Number.isInteger(+n || 0) ? 0 : 2, 2);
const horas = l => Object.values(l || {}).filter(Number.isFinite);

/* ---------- el avión ----------
   Despega `ESPERA` ms después de la apuesta y desde ahí el multiplicador
   es exp(K·t): ×2 a los 6,3 s, ×10 a los 21 s, ×100 a los 42 s, donde
   se va del cielo y se pierde lo que no se cobró. Al despegar, con
   probabilidad 1 − RETORNO choca en ×1,00 (la casa). Después, cada tramo
   [a, b] se sobrevive con probabilidad M(a)/M(b), así que llegar a ×x
   tiene probabilidad RETORNO/x y cobrar en ×x vale RETORNO en promedio. */
export const AVION = { min: APUESTA_MIN, max: 500, K: 0.11, ESPERA: 1500, TOPE: 100, AVISO: 350 };
AVION.VUELO = Math.log(AVION.TOPE) / AVION.K * 1000;   // ms de ×1 a ×100
export function multAvion(at, ms) {
  const t = ms - at - AVION.ESPERA;
  return t <= 0 ? 1 : Math.min(AVION.TOPE, Math.exp(AVION.K * t / 1000));
}
/* La hora (ms) en que el avión marca ×m. */
export const horaAvion = (at, m) => at + AVION.ESPERA + Math.log(Math.max(1, m)) / AVION.K * 1000;
/* Lo que fue una ronda del avión `r` = {j: "a", p, at, t: {i: ms}, c: ms}:
   {estado: "vuela" | "cobrada" | "perdida", choque (multiplicador, si ya
   se sabe), fin (ms), mult (al cobrar), pago, hasta (la última hora
   decidida)}. `ahora` solo dice si ya pasó el ×100 (para una ronda que
   nadie cobró). */
export function resuelveAvion(uid, k, r, ahora = Infinity) {
  const at = r.at, cierre = horaAvion(at, AVION.TOPE), c = Number.isFinite(r.c) && r.c >= at ? r.c : null;
  if (azar(uid, k, "0", at) >= RETORNO) return { estado: "perdida", choque: 1, fin: at, pago: 0, hasta: at };
  const marcas = [...new Set(horas(r.t).filter(x => x > at && (c === null || x < c)).concat(c === null ? [] : [c]))].sort((a, b) => a - b);
  let a = at;
  for (const b0 of marcas) {
    const b = Math.min(b0, cierre), ma = multAvion(at, a), mb = multAvion(at, b);
    if (mb > ma) {
      const u = azar(uid, k, "t", b0);
      if (u >= ma / mb) { const choque = Math.max(ma, baja2(ma / u)); return { estado: "perdida", choque, fin: horaAvion(at, choque), pago: 0, hasta: b0 }; }
    }
    a = b;
    if (b0 >= cierre) return { estado: "perdida", choque: AVION.TOPE, fin: cierre, pago: 0, hasta: b0 };
    if (b0 === c) { const mult = baja2(mb); return { estado: "cobrada", mult, fin: c, pago: centavos(r.p * mult), hasta: c }; }
  }
  if (ahora >= cierre) return { estado: "perdida", choque: null, fin: cierre, pago: 0, hasta: a };
  return { estado: "vuela", fin: null, pago: 0, hasta: a };
}

/* ---------- el pingüino ----------
   Salta de baldosa en baldosa; cada salto cae al agua con probabilidad
   `cae`. Tras n saltos, plantarse paga RETORNO / (1 − cae)^n (redondeado
   hacia abajo a centésimas), así que plantarse en cualquier baldosa vale
   RETORNO en promedio. Llegar a la última cobra solo. */
export const PINGUINO = [
  { nombre: "Fácil", cae: 1 / 10, n: 20, max: 1000 },
  { nombre: "Medio", cae: 1 / 5, n: 15, max: 500 },
  { nombre: "Difícil", cae: 1 / 3, n: 12, max: 200 },
  { nombre: "Extremo", cae: 1 / 2, n: 10, max: 50 }
];
export const multPinguino = (d, n) => (n <= 0 ? 1 : baja2(RETORNO / Math.pow(1 - PINGUINO[d].cae, n)));

/* `r` = {j: "p", p, d, at, s: {i: ms}, c: ms} → {estado: "juega" |
   "cobrada" | "perdida", n (baldosas avanzadas), mult, pago, fin, cayo
   (ms del salto que cayó), saltos: [{ms, ok}] en orden}. A igual hora el
   salto va antes que el plantarse; lo que viene después del final no
   cuenta. */
export function resuelvePinguino(uid, k, r) {
  const D = PINGUINO[r.d], c = Number.isFinite(r.c) && r.c >= r.at ? r.c : null;
  const saltos = horas(r.s).filter(x => x >= r.at).sort((a, b) => a - b), hechos = [];
  let n = 0;
  for (const ms of saltos) {
    if (c !== null && ms > c) break;
    const ok = azar(uid, k, "s", ms) < 1 - D.cae;
    hechos.push({ ms, ok });
    if (!ok) return { estado: "perdida", n, mult: 0, pago: 0, fin: ms, cayo: ms, saltos: hechos };
    n++;
    if (n >= D.n) { const mult = multPinguino(r.d, n); return { estado: "cobrada", n, mult, pago: centavos(r.p * mult), fin: ms, saltos: hechos }; }
  }
  if (c !== null) { const mult = multPinguino(r.d, n); return { estado: "cobrada", n, mult, pago: centavos(r.p * mult), fin: c, saltos: hechos }; }
  return { estado: "juega", n, mult: multPinguino(r.d, n), pago: 0, fin: null, saltos: hechos };
}

/* ---------- la ruleta ----------
   Europea: un solo cero. `r` = {j: "r", p, at, b: {apuesta: monedas}}; la
   suma de `b` es `p`. El número sale de la hora de la apuesta, así que la
   ronda se decide al apostar y la rueda solo lo cuenta. Cada apuesta paga
   lo justo de 36 casillas sobre 37 (un pleno ×36, una docena ×3, un color
   ×2), y el cero se lleva las de fuera: la esperanza es 36/37 = 0,973 en
   cualquier casilla, sin forma de jugar que la mejore. */
export const RULETA = { min: APUESTA_MIN, max: 500, GIRO: 6200 };
export const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
/* El orden de las casillas en la rueda, desde el cero en sentido horario. */
export const RUEDA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
/* Qué números cubre cada apuesta y cuánto multiplica si sale. */
export function casillaRuleta(b) {
  let m = /^n([0-9]{1,2})$/.exec(b);
  if (m && +m[1] <= 36 && String(+m[1]) === m[1]) return { mult: 36, gana: n => n === +m[1] };
  if ((m = /^([dc])([1-3])$/.exec(b))) {
    const i = +m[2];
    return { mult: 3, gana: m[1] === "d" ? n => n > 0 && Math.ceil(n / 12) === i : n => n > 0 && (n - 1) % 3 === i - 1 };
  }
  const f = { rojo: n => ROJOS.has(n), negro: n => n > 0 && !ROJOS.has(n), par: n => n > 0 && n % 2 === 0, impar: n => n % 2 === 1, baja: n => n >= 1 && n <= 18, alta: n => n >= 19 }[b];
  return f ? { mult: 2, gana: f } : null;
}
/* La suma de las apuestas de `b`, o -1 si alguna no es legible. */
export function sumaRuleta(b) {
  if (!b || typeof b !== "object") return -1;
  let s = 0;
  for (const [x, v] of Object.entries(b)) { if (!casillaRuleta(x) || !Number.isInteger(v) || v < 1) return -1; s += v; }
  return s;
}
export function resuelveRuleta(uid, k, r) {
  const n = Math.floor(azar(uid, k, "r", r.at) * 37);
  let pago = 0;
  const ganan = [];
  for (const [x, v] of Object.entries(r.b)) { const c = casillaRuleta(x); if (c.gana(n)) { pago += v * c.mult; ganan.push(x); } }
  return { estado: pago > 0 ? "cobrada" : "perdida", n, ganan, mult: pago / r.p, pago: centavos(pago), fin: r.at };
}

/* ---------- plinko ----------
   La bola rebota en `n` filas de clavos; cada rebote es un bit de
   sha256(uid, clave, hora de la apuesta), así que cae en la casilla k con
   probabilidad C(n, k) / 2^n. Las tablas reparten el multiplicador de modo
   que la esperanza quede justo bajo RETORNO (las pruebas la calculan
   exacta). Cada bola es una ronda. Más riesgo: el centro paga menos y los
   bordes más, y la apuesta máxima baja. */
const espejo = m => m.concat(m.slice(0, -1).reverse());
export const PLINKO = {
  filas: [8, 12, 16],
  riesgos: [
    { nombre: "Bajo", max: 500 },
    { nombre: "Medio", max: 200 },
    { nombre: "Alto", max: 50 }
  ],
  tablas: {
    8: [[5.49, 2.06, 1.07, 0.98, 0.49], [12.8, 2.95, 1.28, 0.68, 0.39], [28.6, 3.94, 1.47, 0.29, 0.19]].map(espejo),
    12: [[9.85, 2.95, 1.57, 1.37, 1.08, 0.98, 0.49], [32.4, 10.8, 3.93, 1.96, 1.08, 0.58, 0.29], [167, 23.6, 7.98, 1.97, 0.68, 0.19, 0.19]].map(espejo),
    16: [[15.7, 8.84, 1.96, 1.37, 1.37, 1.17, 1.08, 0.98, 0.49], [108, 40.4, 9.85, 4.92, 2.95, 1.47, 0.98, 0.49, 0.29], [988, 128, 25.6, 8.89, 3.95, 1.97, 0.19, 0.19, 0.19]].map(espejo)
  }
};
/* El camino: 1 = a la derecha en esa fila. */
export function caminoPlinko(uid, k, at, n) {
  const w = PM.sha256("casino:" + uid + ":" + k + ":l:" + at)[0];
  return Array.from({ length: n }, (_, i) => (w >>> i) & 1);
}
export function resuelvePlinko(uid, k, r) {
  const camino = caminoPlinko(uid, k, r.at, r.n), casilla = camino.reduce((a, b) => a + b, 0), mult = PLINKO.tablas[r.n][r.d][casilla];
  return { estado: "cobrada", camino, casilla, mult, pago: pagoDe(r.p, mult), fin: r.at };
}

/* ---------- las cartas ----------
   Una carta es un número 0–51: palo = floor(c / 13) (♠ ♥ ♦ ♣), valor =
   c % 13 (0 = as, 10 = J, 11 = Q, 12 = K). */
export const PALOS = ["♠", "♥", "♦", "♣"];
export const VALORES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const nombreCarta = c => VALORES[c % 13] + PALOS[Math.floor(c / 13)];
const carta = (uid, k, et, ms) => Math.floor(azar(uid, k, et, ms) * 52);

/* ---------- blackjack ----------
   Mazo infinito (cada carta sale sola de su hora), el crupier pide con 17
   blando, el blackjack paga 3:2, doblar con dos cartas cualesquiera (no
   tras separar), separar una vez y los ases separados reciben una carta.
   **El crupier no mira su carta tapada** (sin «hole card»): su segunda
   carta sale de la hora de la última decisión del jugador, porque una
   carta sacada de la hora de la apuesta sería un secreto que se puede
   calcular antes de decidir. Para que eso no cambie la esperanza, si el
   crupier tiene blackjack solo se pierde la apuesta original (lo doblado o
   separado se devuelve), que es lo que vale con «hole card». La ventaja de
   la casa con estrategia básica queda por debajo del 1 % (las pruebas la
   simulan).

   `r` = {j: "b", p, at, a: {i: {t, at}}}: `t` es "p" (pedir), "q"
   (plantarse), "d" (doblar) o "s" (separar). Las acciones van por hora; la
   que no se puede hacer en ese momento no cuenta. Cada carta sale de la
   hora de la acción que la pide. */
export const BLACKJACK = { min: APUESTA_MIN, max: 500 };
export function totalBJ(cartas) {
  let t = 0, ases = 0;
  for (const c of cartas) { const v = c % 13; if (v === 0) { ases++; t += 11; } else t += Math.min(10, v + 1); }
  while (t > 21 && ases) { t -= 10; ases--; }
  return { t, blando: ases > 0 };
}
const valorBJ = c => Math.min(10, (c % 13) + 1);
export const esBlackjack = cartas => cartas.length === 2 && totalBJ(cartas).t === 21;
export function resuelveBlackjack(uid, k, r) {
  const p = r.p, at = r.at;
  const manos = [{ cartas: [carta(uid, k, "j0", at), carta(uid, k, "j1", at)], apuesta: p, hecha: false, doblada: false, separada: false }];
  const crupier = [carta(uid, k, "c0", at)];
  const cargos = [];
  let h = 0, fin = null;
  const avanza = ms => { while (h < manos.length && manos[h].hecha) h++; if (h >= manos.length) fin = ms; };
  const cierra = m => { const t = totalBJ(m.cartas).t; if (t >= 21) m.hecha = true; };
  if (esBlackjack(manos[0].cartas)) { manos[0].hecha = true; avanza(at); }
  const acciones = Object.entries(r.a || {}).map(([i, x]) => ({ i: +i, t: x && x.t, at: x && x.at }))
    .filter(x => Number.isFinite(x.at) && x.at >= at).sort((a, b) => a.at - b.at || a.i - b.i);
  for (const x of acciones) {
    if (fin !== null) break;
    const m = manos[h];
    if (x.t === "p") { m.cartas.push(carta(uid, k, "p" + x.i, x.at)); cierra(m); }
    else if (x.t === "q") m.hecha = true;
    else if (x.t === "d") {
      if (m.cartas.length !== 2 || m.separada) continue;
      m.cartas.push(carta(uid, k, "d" + x.i, x.at)); m.apuesta += p; m.doblada = true; m.hecha = true;
      cargos.push({ at: x.at, p });
    } else if (x.t === "s") {
      if (manos.length !== 1 || m.cartas.length !== 2 || valorBJ(m.cartas[0]) !== valorBJ(m.cartas[1])) continue;
      const ases = m.cartas[0] % 13 === 0;
      manos.splice(0, 1,
        { cartas: [m.cartas[0], carta(uid, k, "s1" + x.i, x.at)], apuesta: p, hecha: ases, doblada: false, separada: true },
        { cartas: [m.cartas[1], carta(uid, k, "s2" + x.i, x.at)], apuesta: p, hecha: ases, doblada: false, separada: true });
      cierra(manos[0]); cierra(manos[1]);
      cargos.push({ at: x.at, p });
    } else continue;
    avanza(x.at);
  }
  const apostado = p + cargos.reduce((a, c) => a + c.p, 0);
  if (fin === null) return { estado: "juega", manos, mano: h, crupier, cargos, apostado, pago: 0, fin: null };
  // el turno del crupier, desde la hora de la última decisión
  crupier.push(carta(uid, k, "c1", fin));
  const bjJugador = manos.length === 1 && esBlackjack(manos[0].cartas), bjCrupier = esBlackjack(crupier);
  const vivas = manos.some(m => totalBJ(m.cartas).t <= 21);
  if (vivas && !bjJugador && !bjCrupier) {
    for (let i = 2; ; i++) { const { t, blando } = totalBJ(crupier); if (t > 17 || (t === 17 && !blando)) break; crupier.push(carta(uid, k, "c" + i, fin)); }
  }
  const tc = totalBJ(crupier).t;
  let pago = 0;
  if (bjCrupier) {
    pago = bjJugador ? p : apostado - p;
    for (const m of manos) m.res = bjJugador ? "empate" : "pierde";
  } else if (bjJugador) { pago = p * 2.5; manos[0].res = "blackjack"; }
  else for (const m of manos) {
    const t = totalBJ(m.cartas).t;
    m.res = t > 21 ? "pasa" : tc > 21 || t > tc ? "gana" : t === tc ? "empate" : "pierde";
    pago += m.res === "gana" ? 2 * m.apuesta : m.res === "empate" ? m.apuesta : 0;
  }
  return { estado: pago > 0 ? "cobrada" : "perdida", manos, mano: h, crupier, cargos, apostado, pago: centavos(pago), mult: pago / apostado, fin };
}

/* ---------- video póker ----------
   Jacks or Better, tabla 8/5: 97,3 % con la mejor estrategia posible, y
   menos con cualquier otra. Las cinco cartas salen de un mazo barajado con
   la hora de la apuesta; al cambiar, `x` = {m, at} guarda de una vez qué
   cartas se quedan (los bits de `m`) y la hora, y **las de reemplazo salen
   de las 47 restantes barajadas otra vez con esa hora**: las siguientes
   del primer mazo se podrían calcular antes de decidir. */
export const POKER = {
  min: APUESTA_MIN, max: 100,
  tabla: [
    ["escalera real", "Escalera real", 800], ["escalera color", "Escalera de color", 50], ["poker", "Póker", 25],
    ["full", "Full", 8], ["color", "Color", 5], ["escalera", "Escalera", 4], ["trio", "Trío", 3],
    ["dobles", "Doble pareja", 2], ["jotas", "Jotas o más", 1]
  ]
};
function sfc32(w) {
  let a = w[0] | 0, b = w[1] | 0, c = w[2] | 0, d = w[3] | 0;
  return () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function baraja(l, semilla) {
  const x = l.slice(), al = sfc32(PM.sha256(semilla));
  for (let i = 0; i < 12; i++) al();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(al() * (i + 1)), t = x[i]; x[i] = x[j]; x[j] = t; }
  return x;
}
/* La jugada de cinco cartas: el índice en POKER.tabla, o -1. */
export function manoPoker(cs) {
  const v = cs.map(c => c % 13).sort((a, b) => a - b), color = cs.every(c => Math.floor(c / 13) === Math.floor(cs[0] / 13));
  const cuenta = {};
  for (const x of v) cuenta[x] = (cuenta[x] || 0) + 1;
  const n = Object.values(cuenta).sort((a, b) => b - a);
  const distintos = n.length === 5;
  const real = distintos && v.join() === "0,9,10,11,12";
  const escalera = distintos && (v[4] - v[0] === 4 || real);
  if (escalera && color) return real ? 0 : 1;
  if (n[0] === 4) return 2;
  if (n[0] === 3 && n[1] === 2) return 3;
  if (color) return 4;
  if (escalera) return 5;
  if (n[0] === 3) return 6;
  if (n[0] === 2 && n[1] === 2) return 7;
  if (n[0] === 2) { const par = +Object.keys(cuenta).find(x => cuenta[x] === 2); if (par === 0 || par >= 10) return 8; }
  return -1;
}
export function resuelvePoker(uid, k, r) {
  const base = "casino:" + uid + ":" + k + ":v:";
  const mazo = baraja(Array.from({ length: 52 }, (_, i) => i), base + r.at), mano = mazo.slice(0, 5);
  const x = r.x;
  if (!x || !Number.isFinite(x.at) || x.at < r.at || !Number.isInteger(x.m) || x.m < 0 || x.m > 31) {
    const j = manoPoker(mano);
    return { estado: "juega", mano, inicial: mano, jugada: j, pago: 0, fin: null };
  }
  const resto = baraja(mazo.slice(5), base + "x:" + x.at), final = mano.slice();
  let s = 0;
  for (let i = 0; i < 5; i++) if (!((x.m >> i) & 1)) final[i] = resto[s++];
  const j = manoPoker(final), mult = j < 0 ? 0 : POKER.tabla[j][2];
  return { estado: mult > 0 ? "cobrada" : "perdida", inicial: mano, mano: final, guarda: x.m, jugada: j, mult, pago: pagoDe(r.p, mult), fin: x.at };
}

/* ---------- todos ---------- */
export const apuestaValida = (j, p, d, n) => Number.isInteger(p) && p >= APUESTA_MIN &&
  (j === "a" ? d === undefined && p <= AVION.max
    : j === "p" ? Number.isInteger(d) && d >= 0 && d < PINGUINO.length && p <= PINGUINO[d].max
      : j === "r" ? d === undefined && p <= RULETA.max
        : j === "b" ? d === undefined && p <= BLACKJACK.max
          : j === "v" ? d === undefined && p <= POKER.max
            : j === "l" ? Number.isInteger(d) && d >= 0 && d < PLINKO.riesgos.length && p <= PLINKO.riesgos[d].max && PLINKO.filas.includes(n)
              : false);

/* Una ronda cualquiera, o null si no es una ronda legible. */
export const CLAVE_RONDA = /^[-_A-Za-z0-9]{8,24}$/;
export function resuelve(uid, k, r, ahora) {
  if (!r || !CLAVE_RONDA.test(k) || !Number.isFinite(r.at) || !apuestaValida(r.j, r.p, r.d, r.n)) return null;
  switch (r.j) {
    case "a": return resuelveAvion(uid, k, r, ahora);
    case "p": return resuelvePinguino(uid, k, r);
    case "r": return sumaRuleta(r.b) === r.p ? resuelveRuleta(uid, k, r) : null;
    case "b": return resuelveBlackjack(uid, k, r);
    case "v": return resuelvePoker(uid, k, r);
    default: return resuelvePlinko(uid, k, r);
  }
}
