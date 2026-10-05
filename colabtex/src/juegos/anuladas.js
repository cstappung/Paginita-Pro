/* Gastos de PRODROP y la tienda anulados a mano (docs/antitrampas.md,
   «Cuentas paradas»).

   Cuando se borran récords falsos, lo ganado con ellos desaparece hacia
   atrás y el recorrido de `economia()` encuentra compras que nunca se
   pudieron pagar: la cuenta queda parada y todo lo que gane después se va
   a tapar ese hueco. Anular esas compras (con sus cartas) deja la cuenta
   en lo que de verdad ganó, sin deuda.

   La lista sale de `colabtex/scripts/anular-paradas.cjs` sobre una
   exportación de la base, y va en el código, no en Firebase: no cuesta
   descargas ni reglas. Cada entrada es `idGasto()` de monedas.js. Solo se
   agrega: quitar una devolvería la deuda. */
export const ANULADAS = new Set([
]);
