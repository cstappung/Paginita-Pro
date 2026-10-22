/* Batalla de Rock — lo que vale dinero, puro y sin DOM.

   El rockero que toca de fondo en PRO HERO (juegos/hero/js/rock/) se viste
   con piezas que salen de **cajas** a `PRECIO_CAJA` monedas. Igual que un
   regalo de Mascotas, una caja **no se tira, se deriva**: lo que trae es una
   función pura de `(uid, clave, at, cuerpo)`, donde `at` es la hora del
   servidor en el instante de la compra (la regla exige `at === now`). Nadie
   elige lo que sale y cualquiera puede rehacer la caja de cualquiera, que es
   lo que deja venderla en el mercado: la copia es `rk:<uid>~<clave>`.

   `rock/c/<uid>/<clave>` = {at, p: 500, b: "m" | "f"} (write-once). La
   economía (monedas.js) la cobra y, si la pieza es un repetido exacto de
   algo que la cuenta tiene en ese momento (misma pieza y mismos colores, lo
   inicial incluido), devuelve `REEMBOLSO` y no queda copia.

   **Abierto a todos** desde octubre de 2026 (`ROCK_SOLO_ADMIN = false`;
   estuvo a prueba solo para administradores). Volver a cerrarlo es ponerlo en
   true y devolver la condición `admins` a las reglas de `rock/c` y `rockLook`. */
import MM from "../../../juegos/mascotas/motor.js";
import { abreCaja, nombreItem, INV_CATS, invId, iniciales, limpiaLook, lookPosible, PRECIO_CAJA, REEMBOLSO } from "../../../juegos/hero/js/rock/catalogo.js";

export { PRECIO_CAJA, REEMBOLSO, nombreItem, INV_CATS, limpiaLook };
export const ROCK_SOLO_ADMIN = false;
export const RE_COPIA_ROCK = /^rk:([A-Za-z0-9]{6,40})~([-_A-Za-z0-9]{8,24})$/;
export const claveRock = (o, k) => "rk:" + o + "~" + k;

/* Lo que trae la caja `clave` de `uid`, abierta a la hora `at` para el cuerpo `b`. */
const memo = new Map();
export function cajaRock(uid, clave, at, b) {
  const g = b === "f" ? "f" : "m", k = uid + "|" + clave + "|" + at + "|" + g;
  if (memo.has(k)) return memo.get(k);
  const r = MM.generador(MM.sha256("rock-caja:" + k).slice(0, 4));
  const res = Object.freeze(abreCaja(g, r, at));
  if (memo.size > 4000) memo.clear();
  memo.set(k, res);
  return res;
}
export const reembolsoRock = v => (v.leg ? REEMBOLSO.leg : REEMBOLSO.comun);

/* ¿Ve Batalla de Rock quien mira? (la página lo fija al saber si es admin) */
let ve = false;
export function fijaVeRock(v) { const antes = ve; ve = !!v; return antes !== ve; }
export const veRock = () => !ROCK_SOLO_ADMIN || ve;

/* La ficha de una pieza para el mercado: nombre, categoría, cuerpo y colores. */
export function fichaRock(v) {
  const C = INV_CATS[v.k];
  return { nombre: nombreItem(v.b, v.k, v.t), emoji: C ? C.ic : "🎸", cat: C ? C.n : v.k, cuerpo: v.b === "f" ? "Rockera" : "Rockero",
    colores: Object.values(v.c || {}).map(c => "#" + (Number(c) >>> 0).toString(16).padStart(6, "0").slice(-6)) };
}

/* ¿Es repetida? Contra lo inicial y contra `propias` (las variantes que tiene ahora). */
const idsIniciales = new Set(iniciales().map(invId));
export const repetidaRock = (v, propias) => idsIniciales.has(invId(v)) || propias.some(p => invId(p) === invId(v));

/* El rockero de una cuenta como se ve: limpio y solo con lo que tiene. */
export function lookVisible(crudo, propias) {
  const L = limpiaLook(crudo);
  return L ? lookPosible(L, propias || []) : null;
}
