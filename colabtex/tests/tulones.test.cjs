'use strict';
// Tulones: la física del cuerpo (Verlet), trepar, congelar y el aspecto.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../../juegos/club/tulones/motor.js');

const deja = (c, W, n) => { for (let i = 0; i < n; i++) M.paso(c, W); };
const pelvisY = c => c.p[M.I.pelvis * 2 + 1];

test('un cuerpo suelto cae y queda quieto y finito', () => {
  const W = M.mundo(), c = M.crea(-200);
  deja(c, W, 600);
  assert.ok(M.valido(c));
  for (let i = 0; i < M.N; i++) assert.ok(c.p[i * 2 + 1] <= 1, 'nada atraviesa el suelo');
  assert.ok(c.bulto.y > 1, 'de pie, el bulto cuelga hacia abajo');
});

const fija = (c, k, x, y) => {
  c.held[k] = true; c.pin[k] = [x, y];
  const m = M.MIEMBROS[k]; c.vec[k] = [x - c.p[m.raiz * 2], y - c.p[m.raiz * 2 + 1]];
};

test('colgado de un pie sigue siendo válido y el bulto se invierte', () => {
  const W = M.mundo(), c = M.crea(-500);
  deja(c, W, 100);
  fija(c, 2, -500, -400);
  deja(c, W, 1200);
  assert.ok(M.valido(c));
  assert.ok(c.bulto.y < -1, 'cabeza abajo, el bulto cae hacia el ombligo: ' + c.bulto.y);
});

test('con las manos agarradas, tirar hacia abajo sube el cuerpo', () => {
  const W = M.mundo(), c = M.crea(-500);
  deja(c, W, 400);
  fija(c, 0, c.p[M.I.hombroI * 2] - 10, c.p[M.I.hombroI * 2 + 1] - 40);
  fija(c, 1, c.p[M.I.hombroD * 2] + 10, c.p[M.I.hombroD * 2 + 1] - 40);
  deja(c, W, 60);
  const antes = pelvisY(c);
  for (let i = 0; i < 60; i++) { assert.strictEqual(M.empujaMiembros(c, 0, 2), 2); M.paso(c, W); }
  assert.ok(M.valido(c));
  assert.ok(pelvisY(c) < antes - 50, 'la pelvis sube: ' + antes + ' → ' + pelvisY(c));
});

test('congelar añade el cuerpo a la torre', () => {
  const W = M.mundo(), c = M.crea(0);
  deja(c, W, 600);
  const caps = W.caps.length;
  M.congela(c, W);
  assert.strictEqual(W.torre.length, 1);
  assert.ok(W.caps.length > caps);
  assert.ok(M.alturaMundo(W) >= 1.81);
  assert.ok(M.altura(c) > 0);
});

test('presets, limpia y aleatorio dan campos dentro del catálogo', () => {
  const ok = a => { for (const k of M.CAMPOS) assert.ok(Number.isInteger(a[k]) && a[k] >= 0 && a[k] < M.CATALOGO[k].length, k); };
  for (const p of M.PRESETS) { ok(p); ok(M.limpia(p)); }
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 50; i++) ok(M.aleatorio(rnd));
  const l = M.limpia({ nombre: '<b>xx</b>', piel: 99, pelo: -1, fisico: 1.5 });
  ok(l); assert.ok(!/[<>]/.test(l.nombre));
});
