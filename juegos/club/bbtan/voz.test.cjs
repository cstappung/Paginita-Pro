const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const V = require('./voz.js');

test('habla solo en múltiplos de 50 desde la 50', () => {
  for (const r of [50, 100, 350, 500, 650]) assert.ok(V.habla(r), r);
  for (const r of [0, 1, 49, 51, 99, 125]) assert.ok(!V.habla(r), r);
});

test('nivel y ánimo por umbral', () => {
  assert.strictEqual(V.nivel(50), 0);
  assert.strictEqual(V.nivel(350), 6);
  assert.strictEqual(V.nivel(500), 9);
  assert.strictEqual(V.nivel(900), V.FRASES.length - 1);
  assert.deepStrictEqual([50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 800].map(V.animo),
    ['alegre', 'alegre', 'roto', 'roto', 'susurro', 'susurro', 'giro', 'perfecto', 'perfecto', 'perfecto', 'perfecto']);
  assert.strictEqual(V.FRASES.length, V.ANIMO.length);
});

test('cada frase tiene su grabación, y ninguna sobra', () => {
  const dir = path.join(__dirname, 'assets', 'voz'), esperados = [];
  for (let r = 50; r <= 500; r += 50)
    for (let i = 0; i < V.FRASES[V.nivel(r)].length; i++) {
      const f = path.join(__dirname, V.archivo(r, i)); esperados.push(path.basename(f));
      assert.ok(fs.statSync(f).size > 4000, f);
      assert.strictEqual(fs.readFileSync(f).subarray(0, 3).toString('latin1') === 'ID3' || fs.readFileSync(f)[0] === 0xff, true, `${f} es MP3`);
    }
  assert.deepStrictEqual(fs.readdirSync(dir).filter(n => n.endsWith('.mp3')).sort(), esperados.sort());
});

test('el texto que se lee es el que se grabó, sin marcas', () => {
  for (let r = 50; r <= 600; r += 50)
    for (const a of [0, .5, .99]) {
      const i = V.eleccion(r, a), t = V.texto(r, i);
      assert.ok(i >= 0 && i < V.FRASES[V.nivel(r)].length);
      assert.ok(t && !t.includes('|') && !t.includes('  '), t);
      assert.ok(V.estimada(t) >= 2.5 && V.estimada(t) < 12);
    }
  // Las rondas de más allá de la 500 no dicen un número que no es.
  for (const f of V.FRASES[V.FRASES.length - 1]) assert.ok(!/\d/.test(f), f);
  // El giro tiene las dos mitades.
  for (const f of V.FRASES[6]) assert.strictEqual(f.split('|').length, 2, f);
});
