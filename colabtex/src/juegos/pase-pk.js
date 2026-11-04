/* El Pase del Reino de Pro Kingdoms (Fase 8 del plan de juegos/prokingdoms/): la única conexión del juego con
   las monedas de Juegos, y en un solo sentido (el juego nunca da monedas de la página).

   Una compra es `pkPase/<uid>/<periodo>` = {at: now, p: PRECIO_PASE, s: periodo}, escrita una sola vez. La
   regla (firebase/database.rules.json) exige el precio, que `s` sea la clave y que sea el período de `now`;
   monedas.js la repite como un gasto más (categoría «pkPase») y la Cloud Function la lee para dar la pista
   dorada. Puro: lo leen el cartero (prokingdoms.js), monedas.js y las pruebas. La misma cuenta del período
   está en juegos/prokingdoms/js/pase.js (el juego y su servidor no cargan este módulo): la prueba las compara. */
export const PRECIO_PASE = 2500;
/* Los pases se cuentan de a dos semanas desde el lunes 2-11-2026 a medianoche de Chile (UTC−3 en verano).
   En invierno (UTC−4) el corte cae a la 1 de la madrugada: la regla da una hora de margen a cada lado. */
export const PASE_INICIO = Date.UTC(2026, 10, 2, 3, 0, 0);
export const PASE_MS = 14 * 86400000;
export const MARGEN_PASE = 3600000;
export const periodoPase = t => Math.floor((t - PASE_INICIO) / PASE_MS);
export const inicioPase = n => PASE_INICIO + n * PASE_MS;
/* ¿Vale una compra escrita a la hora `at` para el período `s`? (lo mismo que mira la regla) */
export const compraValida = (s, at, p) => Number.isInteger(s) && s >= 0 && p === PRECIO_PASE &&
  at >= inicioPase(s) - MARGEN_PASE && at < inicioPase(s + 1) + MARGEN_PASE;
