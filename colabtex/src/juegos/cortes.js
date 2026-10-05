/* Cortes de cuentas paradas (docs/antitrampas.md, «Cuentas paradas»).

   Cuando un administrador borra récords falsos, lo ganado con ellos
   desaparece hacia atrás, y el recorrido de `economia()` encuentra compras
   que nunca se pudieron pagar: la cuenta queda parada y todo lo que gane
   después se va a tapar ese hueco. Un corte lo arregla sin deuda:

     <uid>: {desde?, hasta, tope}

   Hasta `hasta` (ms), la cuenta gasta contra lo que había ganado al
   limpiarla (`tope`), y una compra que no alcanzaba simplemente no vale
   (el sobre no existe, la graduación no se hizo, la compra en el mercado
   se cae) en vez de parar la cuenta. Desde `hasta`, lo que gane es suyo.
   Con `desde`, lo comprado antes de esa hora vale entero aunque no
   alcanzara (se perdona: el saldo queda en cero) y solo se anula lo que
   cae entre `desde` y `hasta`.

   Lo calcula `colabtex/scripts/cortes.cjs` sobre una exportación de la
   base. Va en el código, no en Firebase: no cuesta descargas ni reglas. */
export const CORTES = {
  "qxNDBkP2D8dToGCHIJhfoA8k2hl2": { desde: 1791084600000, hasta: 1791190800000, tope: 7879 }, // anula del 2026-10-04 00:30 al 2026-10-05 06:00, Chile
  "aKFYNzP6IgO0O0lOaoD9V2f49oJ3": { desde: 1791084600000, hasta: 1791190800000, tope: 6346 }, // anula del 2026-10-04 00:30 al 2026-10-05 06:00, Chile
};
