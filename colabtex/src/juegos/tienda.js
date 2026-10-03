/* La tienda de marcos y fondos: lo que se compra con monedas para el
   perfil. Puro y sin importaciones, para que lo lean igual las monedas
   (que cobran), el perfil (que desbloquea) y las pruebas en Node.

   Una compra es `tienda/<uid>/<artículo>` = {at, p}, escrita una vez y
   nunca borrada (las reglas exigen `at === now` y `p === PRECIO_TIENDA`).
   Como las reglas no saben sumar lo ganado, la compra se repasa en
   `economia()` con el resto del gasto: solo vale si el saldo la cubre, y
   si no, la cuenta queda parada como con un sobre impago. */
export const PRECIO_TIENDA = 5000;
export const TIENDA = {
  cometa: "marco", vortice: "marco", sakura: "marco", plasma: "marco", mariposas: "marco",
  estrellas: "fondo", olas: "fondo", lluvia: "fondo", fuegos: "fondo", holo: "fondo"
};
