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
  // Cabeza abajo y en el aire, colgado del pie izquierdo (sin teletransportar el pie, que daba un latigazo).
  for (let i = 0; i < M.N; i++) { const y = -400 - c.p[i * 2 + 1]; c.p[i * 2 + 1] = c.q[i * 2 + 1] = y; }
  fija(c, 2, c.p[M.I.pieI * 2], c.p[M.I.pieI * 2 + 1]);
  deja(c, W, 1200);
  assert.ok(c.p[M.I.cabeza * 2 + 1] > c.pin[2][1], 'la cabeza cuelga bajo el pie');
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

test('teclas: WASD de fábrica y lo guardado se limpia', () => {
  assert.deepStrictEqual(M.limpiaTeclas(null), M.TECLAS);
  assert.strictEqual(M.TECLAS[0], 'KeyA');
  assert.strictEqual(M.TECLAS[1], 'KeyD');
  assert.strictEqual(M.TECLAS[2], 'KeyW');
  const t = M.limpiaTeclas({ 0: 'KeyQ', 1: 'KeyQ', 2: 'ArrowUp', 3: '<x>', congela: 7 });
  assert.strictEqual(t[0], 'KeyQ');
  const usadas = M.ACCIONES.map(a => t[a]);
  assert.strictEqual(new Set(usadas).size, usadas.length, 'sin repetidas');
  for (const c of usadas) assert.ok(M.teclaValida(c), c);
});

test('teclas: asignar una usada intercambia y las reservadas no se aceptan', () => {
  let t = M.asignaTecla(M.TECLAS, '0', 'KeyD');
  assert.strictEqual(t[0], 'KeyD');
  assert.strictEqual(t[1], 'KeyA');
  t = M.asignaTecla(t, 'congela', 'Escape');
  assert.strictEqual(t.congela, 'Space');
  t = M.asignaTecla(t, 'pausa', 'ShiftLeft');
  assert.strictEqual(t.pausa, 'ShiftLeft');
  assert.strictEqual(M.nombreTecla('KeyW'), 'W');
  assert.strictEqual(M.nombreTecla('Space'), 'Espacio');
  assert.strictEqual(M.nombreTecla('Semicolon', new Map([['Semicolon', 'ñ']])), 'Ñ');
});

test('el tono lo deja de pie y no abierto de piernas', () => {
  const W = M.mundo(), c = M.crea(-200);
  deja(c, W, 1200);
  assert.ok(c.p[M.I.cabeza * 2 + 1] < -170, 'la cabeza sigue arriba: ' + c.p[M.I.cabeza * 2 + 1]);
  assert.ok(Math.abs(c.p[M.I.pieI * 2] - c.p[M.I.pieD * 2]) < 60, 'los pies bajo la cadera');
});

test('un pie que ya tocaba el suelo no se pega hasta despegarse y volver a apoyar un rato', () => {
  const W = M.mundo(), c = M.crea(-200);
  deja(c, W, 300);
  M.sostiene(c, 2, true);
  deja(c, W, 60);
  assert.strictEqual(c.pin[2], null, 'apretar no lo pega al instante');
  for (let i = 0; i < 40; i++) { M.empujaMiembros(c, 0, -3); M.paso(c, W); }
  assert.strictEqual(c.pin[2], null);
  let n = 0;
  for (; n < 200 && !c.pin[2]; n++) { M.empujaMiembros(c, 0, 3); M.paso(c, W); }
  assert.ok(c.pin[2], 'al volver a apoyar se agarra');
});

test('agitar los miembros no lo hace volar (rebotes y pogo)', () => {
  const com = c => { let y = 0; for (let i = 0; i < M.N; i++) y += c.p[i * 2 + 1]; return y / M.N; };
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let subida = 0;
  for (let run = 0; run < 20; run++) {
    const W = M.mundo(), c = M.crea(-300 + rnd() * 350); deja(c, W, 200);
    let vx = 0, vy = 0, aire = 0, y0 = 0;
    for (let t = 0; t < 1500; t++) {
      if (t % 40 === 0) { const k = Math.floor(rnd() * 4); M.sostiene(c, k, !c.held[k]); }
      vx = Math.max(-7, Math.min(7, vx * .95 + (rnd() - .5) * 1.2)); vy = Math.max(-7, Math.min(7, vy * .95 + (rnd() - .5) * 1.2));
      M.empujaMiembros(c, vx, vy); M.paso(c, W);
      const enAire = !c.pin.some(Boolean) && !c.contacto.some(Boolean);
      if (enAire) { if (!aire) y0 = com(c); aire++; subida = Math.max(subida, y0 - com(c)); } else aire = 0;
      assert.ok(M.valido(c));
    }
  }
  assert.ok(subida < 150, 'en el aire no sube más de 1,5 m: ' + subida);
});

test('con un pie agarrado, el brazo sostenido llega recto hacia arriba', () => {
  const W = M.mundo(), c = M.crea(-200);
  deja(c, W, 300);
  fija(c, 2, c.p[M.I.pieI * 2], c.p[M.I.pieI * 2 + 1]);
  M.sostiene(c, 0, true);
  for (let i = 0; i < 240; i++) { M.empujaMiembros(c, 0, -6); M.paso(c, W); }
  const dx = c.p[M.I.manoI * 2] - c.p[M.I.hombroI * 2], dy = c.p[M.I.manoI * 2 + 1] - c.p[M.I.hombroI * 2 + 1];
  assert.ok(dy < -50 && Math.abs(dx) < 15, 'mano sobre el hombro: ' + dx + ',' + dy);
});

test('agarrado de una mano, alcanzar con la otra levanta el cuerpo y las piernas cuelgan', () => {
  const W = M.mundo(), c = M.crea(-110);
  deja(c, W, 300);
  fija(c, 1, -45, -124);
  deja(c, W, 120);
  M.sostiene(c, 0, true);
  const antes = pelvisY(c);
  for (let i = 0; i < 480; i++) { M.empujaMiembros(c, i < 240 ? -2 : 2, -6); M.paso(c, W); }
  assert.ok(M.valido(c));
  assert.ok(pelvisY(c) < antes - 50, 'la pelvis sube: ' + antes + ' → ' + pelvisY(c));
  assert.ok(c.p[M.I.pieI * 2 + 1] > pelvisY(c) && c.p[M.I.pieD * 2 + 1] > pelvisY(c), 'los pies cuelgan bajo la pelvis');
});

const centroX = c => { let x = 0; for (let i = 0; i < M.N; i++) x += c.p[i * 2]; return x / M.N; };

test('sentado o tirado en el suelo y sin tocar nada, no se desliza solo', () => {
  for (const lado of [1, -1]) {
    const W = M.mundo(), c = M.crea(-400);
    const px = c.p[M.I.pelvis * 2], py = c.p[M.I.pelvis * 2 + 1];
    for (let i = 0; i < M.N; i++) {
      const dx = c.p[i * 2] - px, dy = c.p[i * 2 + 1] - py;
      c.p[i * 2] = c.q[i * 2] = px - dy * lado; c.p[i * 2 + 1] = c.q[i * 2 + 1] = py + dx * lado + 70;
    }
    deja(c, W, 600);
    const x0 = centroX(c);
    deja(c, W, 600);
    assert.ok(Math.abs(centroX(c) - x0) < 15, 'se movió ' + (centroX(c) - x0));
  }
});

test('sostener brazo y pierna con un pie apoyado no lo empuja de lado', () => {
  const W = M.mundo(), c = M.crea(-300);
  deja(c, W, 300);
  M.sostiene(c, 1, true); M.sostiene(c, 3, true);
  for (let i = 0; i < 60; i++) { M.empujaMiembros(c, 3, -1); M.paso(c, W); }
  const x0 = centroX(c);
  deja(c, W, 240);
  assert.ok(Math.abs(centroX(c) - x0) < 60, 'se movió ' + (centroX(c) - x0));
});

test('tirado en el suelo, un tirón brusco del brazo lo despega hacia donde va el ratón', () => {
  const W = M.mundo(), c = M.crea(-400);
  const px = c.p[M.I.pelvis * 2], py = c.p[M.I.pelvis * 2 + 1];
  for (let i = 0; i < M.N; i++) {
    const dx = c.p[i * 2] - px, dy = c.p[i * 2 + 1] - py;
    c.p[i * 2] = c.q[i * 2] = px + dy; c.p[i * 2 + 1] = c.q[i * 2 + 1] = py - dx + 70;
  }
  deja(c, W, 600);
  const centroY = () => { let y = 0; for (let i = 0; i < M.N; i++) y += c.p[i * 2 + 1]; return y / M.N; };
  const y0 = centroY(), x0 = centroX(c);
  M.sostiene(c, 1, true);
  let alto = y0;
  for (let i = 0; i < 40; i++) { M.empujaMiembros(c, 6, -10); M.paso(c, W); alto = Math.min(alto, centroY()); }
  deja(c, W, 60);
  assert.ok(alto < y0 - 25, 'el cuerpo se despega: ' + y0 + ' → ' + alto);
  assert.ok(alto > y0 - 90, 'pero no sale volando: ' + y0 + ' → ' + alto);
  assert.ok(centroX(c) > x0 + 10, 'va hacia la derecha: ' + x0 + ' → ' + centroX(c));
});
