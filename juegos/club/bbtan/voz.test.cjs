const test = require('node:test');
const assert = require('node:assert');
const V = require('./voz.js');

test('habla solo en múltiplos de 50 desde la 50', () => {
  for (const r of [50, 100, 350, 400]) assert.ok(V.habla(r), r);
  for (const r of [0, 1, 49, 51, 99, 125]) assert.ok(!V.habla(r), r);
});

test('nivel acotado a las listas de frases', () => {
  assert.strictEqual(V.nivel(50), 0);
  assert.strictEqual(V.nivel(300), 5);
  assert.strictEqual(V.nivel(350), 6);
  assert.strictEqual(V.nivel(1000), V.FRASES.length - 1);
  assert.strictEqual(V.nivel(10), 0);
});

test('ánimo: alegre, roto y susurro', () => {
  assert.strictEqual(V.animo(50), 'alegre');
  assert.strictEqual(V.animo(100), 'alegre');
  assert.strictEqual(V.animo(150), 'roto');
  assert.strictEqual(V.animo(200), 'roto');
  assert.strictEqual(V.animo(250), 'susurro');
  assert.strictEqual(V.animo(400), 'susurro');
});

test('frase sustituye {n} y nunca se sale de la lista', () => {
  for (let r = 50; r <= 500; r += 50)
    for (const a of [0, .5, .999, 1]) {
      const f = V.frase(r, a);
      assert.ok(f && !f.includes('{n}'), f);
    }
  assert.ok(V.frase(50, 0).includes('50'));
});

function enRango(partes) {
  assert.ok(partes.length > 0);
  for (const p of partes) {
    assert.ok(p.t && p.t.trim(), 'texto vacío');
    assert.ok(p.pitch >= 0 && p.pitch <= 2, 'pitch ' + p.pitch);
    assert.ok(p.rate >= .1 && p.rate <= 10, 'rate ' + p.rate);
    assert.ok(p.volume >= 0 && p.volume <= 1, 'volume ' + p.volume);
  }
}

test('alegre: un trozo, agudo y rápido', () => {
  const p = V.trozos(V.frase(50, 0), 50, 0);
  assert.strictEqual(p.length, 1);
  assert.ok(p[0].pitch >= 1.8 && p[0].rate > 1);
});

test('roto: varios trozos a tirones', () => {
  const p = V.trozos(V.frase(150, 0), 150, .3);
  assert.ok(p.length > 3);
  assert.ok(new Set(p.map(x => x.pitch)).size > 1);
});

test('susurro: grave, lento y con eco', () => {
  const f = V.frase(300, 0), p = V.trozos(f, 300, 0);
  assert.ok(p.every(x => x.pitch <= .3 && x.rate < 1));
  assert.strictEqual(p[p.length - 1].pitch, 0);
});

test('todos los trozos están en rango', () => {
  for (let r = 50; r <= 600; r += 50)
    for (const a of [0, .2, .5, .8, .99]) enRango(V.trozos(V.frase(r, a), r, a));
  assert.ok(V.duracion(V.trozos(V.frase(250, 0), 250, 0)) > 1);
});

test('decir no rompe sin speechSynthesis', () => {
  assert.strictEqual(V.decir([{ t: 'x', pitch: 1, rate: 1, volume: 1 }]), false);
  V.calla();
});
