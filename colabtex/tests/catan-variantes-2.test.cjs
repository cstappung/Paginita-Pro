/* Catan: partidas de robots enteras, mitad 2 de las variantes (la otra en catan-variantes-1.test.cjs;
   en dos archivos para que `node --test` las corra en paralelo). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { variantes } = require('./catan-robots.cjs');

test('catan: partidas de robots terminan en todas las variantes (2/2)', async () => {
  const total = await variantes([
    [3, 12, {}], [4, 14, { amable: 1, puerto: 1 }], [6, 16, { largo: -2 }], [4, 18, { exp: 'mar', baraja: 1 }], [2, 20, { exp: 'mar', puerto: 1, largo: -2 }]
  ]);
  for (const k of ['ladron', 'roba', 'barco', 'comercio', 'juega', 'isla']) assert.ok(total[k] > 0, 'nunca pasó: ' + k);
});
