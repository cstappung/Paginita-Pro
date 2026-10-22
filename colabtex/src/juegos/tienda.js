/* La tienda de marcos y fondos: lo que se compra con monedas para el
   perfil. Puro y sin importaciones, para que lo lean igual las monedas
   (que cobran), el perfil (que desbloquea) y las pruebas en Node.

   Una compra es `tienda/<uid>/<artículo>` = {at, p}, escrita una vez y
   nunca borrada (las reglas exigen `at === now` y el precio exacto de ese
   artículo). Como las reglas no saben sumar lo ganado, la compra se repasa
   en `economia()` con el resto del gasto: solo vale si el saldo la cubre,
   y si no, la cuenta queda parada como con un sobre impago. */
export const PRECIO_TIENDA = 5000;

/* La tienda de Halloween: edición limitada, con rareza y precio por
   artículo. Se vende solo dentro de `VENTA_HALLOWEEN` (la regla de
   `tienda` repite la hora de cierre y los precios: si cambian, cambian
   los dos; tests/tienda.test.cjs lo comprueba). Lo comprado es para
   siempre; lo que no, desaparece del catálogo al cerrar. */
export const RAREZAS_HW = {
  raro: { n: "Raro", p: 3000 },
  epico: { n: "Épico", p: 5000 },
  legendario: { n: "Legendario", p: 7500 },
  mitico: { n: "Mítico", p: 10000 }
};
export const HALLOWEEN = {
  calabazas: "raro", murcielagos: "raro", telarana: "epico", fantasmas: "epico", caldero: "legendario", parca: "mitico",
  cementerio: "raro", calabazar: "raro", aquelarre: "epico", mansion: "legendario", lunasangre: "mitico"
};
/* Del 1 de octubre al 1 de noviembre incluido, hora de Chile (UTC−3 en
   esas fechas): cierra el 2 de noviembre a las 00:00. */
export const VENTA_HALLOWEEN = { desde: 1790823600000, hasta: 1793588400000 };
/* Los premios de coleccionista: no se venden, se ganan teniendo `n`
   artículos de Halloween comprados (y se re-chequean donde se ven). */
export const PREMIOS_HALLOWEEN = [
  { id: "reycalabaza", tipo: "marco", n: 5 },
  { id: "nocheeterna", tipo: "fondo", n: Object.keys(HALLOWEEN).length }
];

export const TIENDA = {
  cometa: "marco", vortice: "marco", sakura: "marco", plasma: "marco", mariposas: "marco",
  estrellas: "fondo", olas: "fondo", lluvia: "fondo", fuegos: "fondo", holo: "fondo",
  calabazas: "marco", murcielagos: "marco", telarana: "marco", fantasmas: "marco", caldero: "marco", parca: "marco",
  cementerio: "fondo", calabazar: "fondo", aquelarre: "fondo", mansion: "fondo", lunasangre: "fondo"
};

export const precioDe = id => HALLOWEEN[id] ? RAREZAS_HW[HALLOWEEN[id]].p : PRECIO_TIENDA;
export const rarezaHw = id => HALLOWEEN[id] || "";
/* ¿Se puede comprar a esta hora? Lo de siempre, siempre; lo de Halloween,
   dentro de su ventana. En la economía `t` es la hora del servidor que la
   regla fijó (`at === now`), así que no se puede adelantar. */
export const aLaVenta = (id, t) => !!TIENDA[id] && (!HALLOWEEN[id] || (t >= VENTA_HALLOWEEN.desde && t < VENTA_HALLOWEEN.hasta));
export const tiendaHalloweenAbierta = t => t >= VENTA_HALLOWEEN.desde && t < VENTA_HALLOWEEN.hasta;
/* Cuántos artículos de Halloween tiene comprados (`compras` = id → algo). */
export const coleccionHalloween = compras => Object.keys(HALLOWEEN).filter(id => compras && compras[id]).length;

/* El número de edición de un artículo de Halloween: en qué orden lo
   compró cada cuenta (por la hora del servidor; empate, por uid) y cuántas
   lo tienen. `compras` = uid → {id: at} (lo que aceptó la economía) o
   uid → {id: {at, p}} (el nodo tal cual, mientras no hay economía). Lo
   que no trae hora (una compra recién hecha aquí) va al final.
   Un premio de coleccionista se numera por la hora de su `n`-ésima compra. */
const horaDe = v => typeof v === "number" ? v : v && Number.isFinite(v.at) ? v.at : Infinity;
function ordenEdicion(filas, uid) {
  filas.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return { n: filas.findIndex(f => f[1] === uid) + 1, total: filas.length };
}
export function edicion(id, uid, compras) {
  const premio = PREMIOS_HALLOWEEN.find(p => p.id === id), filas = [];
  for (const [u, l] of Object.entries(compras || {})) {
    if (!l) continue;
    if (premio) {
      const horas = Object.keys(HALLOWEEN).filter(k => l[k]).map(k => horaDe(l[k])).sort((a, b) => a - b);
      if (horas.length >= premio.n) filas.push([horas[premio.n - 1], u]);
    } else if (l[id]) filas.push([horaDe(l[id]), u]);
  }
  return ordenEdicion(filas, uid);
}
/* Las ediciones de todo lo de Halloween que tiene `uid`: id → {n, total}. */
export function edicionesDe(uid, compras) {
  const mias = (compras || {})[uid] || {}, out = {}, k = coleccionHalloween(mias);
  for (const id of Object.keys(HALLOWEEN)) if (mias[id]) out[id] = edicion(id, uid, compras);
  for (const p of PREMIOS_HALLOWEEN) if (k >= p.n) out[p.id] = edicion(p.id, uid, compras);
  return out;
}
