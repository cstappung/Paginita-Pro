/* Catan: partidas de robots enteras, mitad 1 de las variantes (la otra en catan-variantes-2.test.cjs;
   en dos archivos para que `node --test` las corra en paralelo). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { variantes } = require('./catan-robots.cjs');
/* 5 jugadores con Navegantes y ladrón amable era la semilla 19: una partida de 2533 jugadas que sola tardaba
   65 s (cada jugada reduce el registro entero). La 27 juega la misma variante en 874 y llega a las islas. */

test('catan: partidas de robots terminan en todas las variantes (1/2)', async () => {
  const total = await variantes([
    [2, 11, {}], [4, 13, { baraja: 1 }], [5, 15, {}], [3, 17, { exp: 'mar' }], [5, 27, { exp: 'mar', amable: 1 }]
  ]);
  for (const k of ['ladron', 'roba', 'barco', 'comercio', 'juega', 'isla']) assert.ok(total[k] > 0, 'nunca pasó: ' + k);
});
