/* ============================================================
   Referidos — puros y verificables en Node.

   Quien invita y quien entra con su código ganan `PREMIO_REFERIDO` cada
   uno. Como todo lo que paga monedas, el premio **no se guarda**: se
   deriva de tres ramas de `referidos/` que las reglas ya validan.

   - `referidos/c/<CÓDIGO>` = uid: de quién es cada código. Se escribe
     una vez y nunca se reescribe, así que un código es de una sola
     persona.
   - `referidos/m/<uid>` = {c, at}: el código de cada persona. También se
     escribe una vez, junto con el de arriba, así que cada persona tiene
     uno solo y no lo puede cambiar.
   - `referidos/u/<uid>` = {c, r, at}: el código que esa persona usó (`r`
     es su dueño). Una vez por persona, nunca el propio y nunca el de
     alguien que ya usó el tuyo (eso lo pide la regla).

   **Para referir y para canjear hay que haber jugado `MIN_JUEGOS` juegos
   distintos**: los dos lados. La regla no puede contar juegos (no recorre
   listas), así que eso se comprueba aquí, donde se ve, como los marcos:
   un código puesto o canjeado a mano por alguien que no llega no paga
   nada, ni a él ni a la otra persona, hasta que llegue. Cuenta todo lo que ya está escrito y validado: una fila de
   la clasificación de sala con partidas, una partida del club o una marca
   del club.
   ============================================================ */
import { SOLO_PREFIJO } from "./logros.js";

export const PREMIO_REFERIDO = 5000, MIN_JUEGOS = 3;
export const RE_CODIGO = /^[A-Z0-9]{4,12}$/;
/* Lo que alguien escribe, como se guarda: sin espacios ni guiones y en
   mayúsculas, para que «pia-2024» y «PIA2024» sean el mismo código. */
export const normalizaCodigo = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

const juegoDeMarca = c => Object.keys(SOLO_PREFIJO).find(k => String(c).startsWith(SOLO_PREFIJO[k])) ||
  (String(c).startsWith("yemas-zombis-") ? "yemas" : "");

/* Los juegos en los que `uid` tiene al menos una partida. */
export function juegosJugados(uid, datos) {
  const d = datos || {}, s = new Set();
  for (const [j, filas] of Object.entries(d.ranks || {})) {
    const f = filas && filas[uid];
    if (f && +f.jugadas > 0) s.add(j);
  }
  for (const [j, x] of Object.entries((d.clubJugadas || {})[uid] || {})) if (x && +x.total > 0) s.add(j);
  for (const [cat, filas] of Object.entries(d.solo || {})) {
    const j = filas && filas[uid] && juegoDeMarca(cat);
    if (j) s.add(j);
  }
  return s;
}
/* El mínimo es el mismo para referir y para canjear. */
export const puedeReferir = (uid, datos) => juegosJugados(uid, datos).size >= MIN_JUEGOS;

/* El código de `uid`, si lo configuró y es de verdad suyo. */
export function codigoDe(uid, datos) {
  const r = (datos && datos.referidos) || {}, m = (r.m || {})[uid];
  const c = m && typeof m.c === "string" ? m.c : "";
  return c && RE_CODIGO.test(c) && (r.c || {})[c] === uid ? c : "";
}
/* De quién es un código (o "" si no existe). */
export function duenoCodigo(codigo, datos) {
  const r = (datos && datos.referidos) || {}, u = (r.c || {})[codigo];
  return typeof u === "string" && codigoDe(u, datos) === codigo ? u : "";
}

/* Quién refirió a quién, ya resuelto: `usado[uid]` = la entrada de quien
   usó un código (`valido` dice si paga), `de[uid]` = la lista de uids que
   entraron con el código de `uid` y pagan. Una vez por llegada. */
const memoRef = new WeakMap();
export function referidos(datos) {
  const d = datos || {};
  if (memoRef.has(d)) return memoRef.get(d);
  const u = ((d.referidos || {}).u) || {}, usado = {}, de = {}, puede = {};
  const califica = x => (x in puede ? puede[x] : (puede[x] = puedeReferir(x, d)));
  for (const [uid, x] of Object.entries(u)) {
    if (!x || typeof x !== "object") continue;
    const r = typeof x.r === "string" ? x.r : "", c = typeof x.c === "string" ? x.c : "";
    let valido = !!r && r !== uid && RE_CODIGO.test(c) && duenoCodigo(c, d) === r && Number.isFinite(x.at) && califica(r) && califica(uid);
    /* Dos que se usan el código el uno al otro: la regla lo impide, pero
       si se colara vale solo el primero. */
    const vuelta = u[r];
    if (valido && vuelta && vuelta.r === uid && (vuelta.at < x.at || (vuelta.at === x.at && r < uid))) valido = false;
    usado[uid] = { c, r, at: x.at, valido };
    if (valido) (de[r] = de[r] || []).push(uid);
  }
  for (const l of Object.values(de)) l.sort((a, b) => u[a].at - u[b].at || (a < b ? -1 : 1));
  const res = { usado, de };
  memoRef.set(d, res);
  return res;
}

/* Lo que los referidos le pagan a `uid`: por el código que usó y por cada
   persona que usó el suyo. */
export function monedasReferidos(uid, datos) {
  const r = referidos(datos), yo = r.usado[uid];
  return PREMIO_REFERIDO * ((yo && yo.valido ? 1 : 0) + (r.de[uid] || []).length);
}

/* Si `uid` puede usar `codigo` ahora: "" si sí, o por qué no. */
export function motivoNoCanje(uid, codigo, datos) {
  const r = (datos && datos.referidos) || {};
  if ((r.u || {})[uid]) return "Ya usaste un código.";
  if (!puedeReferir(uid, datos)) return `Para canjear un código primero juega ${MIN_JUEGOS} juegos distintos.`;
  if (!RE_CODIGO.test(codigo)) return "El código tiene de 4 a 12 letras o números.";
  const dueno = duenoCodigo(codigo, datos);
  if (!dueno) return "Ese código no existe. Revisa que esté bien escrito.";
  if (dueno === uid) return "Ese es tu propio código: compártelo con otros.";
  if (((r.u || {})[dueno] || {}).r === uid) return "Esa persona entró con tu código: no se pueden referir el uno al otro.";
  if (!puedeReferir(dueno, datos)) return `Ese código todavía no está activo: su dueño aún no juega ${MIN_JUEGOS} juegos distintos.`;
  return "";
}
/* Si `uid` puede configurar `codigo` como el suyo: "" si sí, o por qué no. */
export function motivoNoCodigo(uid, codigo, datos) {
  if (codigoDe(uid, datos) || ((datos && datos.referidos && datos.referidos.m) || {})[uid]) return "Ya configuraste tu código.";
  if (!puedeReferir(uid, datos)) return `Primero juega ${MIN_JUEGOS} juegos distintos.`;
  if (!RE_CODIGO.test(codigo)) return "De 4 a 12 letras (sin tildes ni ñ) o números.";
  if (((datos && datos.referidos && datos.referidos.c) || {})[codigo]) return "Ese código ya lo tiene otra persona.";
  return "";
}
