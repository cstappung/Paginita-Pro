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
export const formatoPago = n => (+n || 0).toLocaleString("es-CL", { minimumFractionDigits: Number.isInteger(+n || 0) ? 0 : 2, maximumFractionDigits: 2 });
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
export const apuestaValida = (j, p, d) => Number.isInteger(p) && p >= APUESTA_MIN &&
  (j === "a" ? p <= AVION.max : j === "p" ? Number.isInteger(d) && d >= 0 && d < PINGUINO.length && p <= PINGUINO[d].max : false);

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

/* Una ronda cualquiera, o null si no es una ronda legible. */
export const CLAVE_RONDA = /^[-_A-Za-z0-9]{8,24}$/;
export function resuelve(uid, k, r, ahora) {
  if (!r || !CLAVE_RONDA.test(k) || !Number.isFinite(r.at) || !apuestaValida(r.j, r.p, r.d)) return null;
  return r.j === "a" ? resuelveAvion(uid, k, r, ahora) : resuelvePinguino(uid, k, r);
}
