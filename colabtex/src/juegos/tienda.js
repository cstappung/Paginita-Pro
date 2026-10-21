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
  raro: { n: "Raro", p: 6000 },
  epico: { n: "Épico", p: 12000 },
  legendario: { n: "Legendario", p: 20000 },
  mitico: { n: "Mítico", p: 35000 }
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
