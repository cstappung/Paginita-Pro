/* Herramientas comunes de la capa «cómo se jugó» de los verificadores.

   La prueba de una partida dice qué se hizo y el motor lo rehace: eso
   atrapa los datos inventados. Lo que no atrapa es un programa que juega
   de verdad, con jugadas válidas. A ese se lo reconoce por la forma de sus
   entradas: hace lo mismo, igual de bien y en el mismo instante, muchas
   veces seguidas. Una persona también acierta, pero no N veces seguidas
   con la misma precisión. Por eso todo aquí mira **tramos seguidos**
   (ventanas, rachas) y no medias: una partida larga y buena de una
   persona tiene su media, pero no tiene veinte saltos idénticos en fila.

   Puro: sin DOM, sin Firebase; lo usan los verificadores y los tests. */

export const media = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

export function desviacion(a) {
  if (!a.length) return 0;
  const m = media(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
}

/* La menor desviación típica de `w` valores seguidos de `a` (Infinity si
   no hay tantos). Una sola ventana así de pareja basta para delatar a
   quien repite el mismo gesto. */
export function minDesviacion(a, w) {
  if (a.length < w) return Infinity;
  let s = 0, s2 = 0, mejor = Infinity;
  for (let i = 0; i < a.length; i++) {
    s += a[i]; s2 += a[i] * a[i];
    if (i >= w) { s -= a[i - w]; s2 -= a[i - w] * a[i - w]; }
    if (i >= w - 1) mejor = Math.min(mejor, Math.sqrt(Math.max(0, s2 / w - (s / w) ** 2)));
  }
  return mejor;
}

/* Rachas de elementos seguidos que cumplen `f`: {larga (la más larga),
   rachas (cuántas llegan a `minimo`)}. */
export function rachas(a, f, minimo = 1) {
  let r = 0, larga = 0, n = 0;
  for (let i = 0; i < a.length; i++) {
    if (f(a[i], i)) { r++; if (r > larga) larga = r; if (r === minimo) n++; } else r = 0;
  }
  return { larga, rachas: n };
}

/* Máximo común divisor de una lista de enteros: el grano del reloj con que
   se midieron. Un navegador que redondea `performance.now()` (Firefox con
   resistFingerprinting lo lleva a 100 ms) da muchos intervalos «0» sin
   que haya nada raro; las señales de «a la vez» lo tienen que mirar. */
export function grano(a) {
  const mcd = (x, y) => y ? mcd(y, x % y) : x;
  let g = 0;
  for (const x of a) if (x > 0) g = mcd(g, Math.round(x));
  return g;
}

/* La velocidad del juego. Los juegos avanzan con `performance.now()` (y
   requestAnimationFrame); las extensiones que «ralentizan el juego» lo
   hacen trucando ese reloj, y la partida entera se juega más lenta sin que
   el motor lo note: la prueba rehace igual. Las pruebas que lo traen
   cuentan lo jugado con los dos relojes, `a` (performance.now) y `w`
   (Date.now), y uno solo trucado los separa. Sin ninguno de los dos (una
   prueba de antes) no se mira; con uno solo, la prueba está rota. Por
   debajo de `RELOJ_MIN` no se juzga: el redondeo y un ajuste NTP pesan
   demasiado. El límite honesto: una extensión que truque los dos relojes
   a la vez no se ve desde el navegador; para eso haría falta la hora del
   servidor. */
export const RELOJ_MIN = 20000, RELOJ_TOL = 0.05;

export function dosRelojes(a, w) {
  if (a === undefined && w === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(w) || a < 0 || w < 0) return 'Los relojes de la prueba no son válidos.';
  if (Math.max(a, w) < RELOJ_MIN) return null;
  if (Math.abs(w - a) > RELOJ_TOL * Math.max(a, w) + 1000)
    return `El reloj del juego marcó ${(a / 1000).toFixed(1)} s y el del sistema ${(w / 1000).toFixed(1)} s: la velocidad del juego fue alterada.`;
  return null;
}
