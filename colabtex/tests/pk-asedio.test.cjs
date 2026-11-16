/* Pro Kingdoms, plan de guerra (juegos/prokingdoms/PLAN-GUERRA.md, G1 y G2): el asedio por etapas.
   El plan de batalla (D.asedioPlan, js/data.js) es la verdad de la conquista y lo usará también el servidor: aquí se
   comprueba que la probabilidad de ganar según la proporción de fuerzas es la de antes de pk-55 (la tabla de la
   sección 1 del plan es el contrato de balance), que el estado en el tiempo es continuo y termina donde dice el plan,
   y que el dibujo (js/frente.js) no decide nada. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const PKDIR = path.join(__dirname, '..', '..', 'juegos', 'prokingdoms');
const JS = f => fs.readFileSync(path.join(PKDIR, 'js', f), 'utf8');
const win = {}, ctx = vm.createContext({ window: win, console, URLSearchParams, location: { search: '' } });
for (const f of ['util.js', 'data.js']) vm.runInContext(JS(f), ctx, { filename: f });
const { D } = win.PK;

// una parcela de frontera corriente (Era III, una torre cerca, algo de ejército, murallas y dos parcelas vecinas)
const PARTES = D.parcelDefenseParts({ era: 3, px: 5, py: 5, towers: [[44, 44, 120]], army: 300, walls: 1, around: 2 });
const SIN_MUROS = D.parcelDefenseParts({ era: 3, px: 5, py: 5, towers: [], army: 200, walls: 0, around: 1 });
const plan = (r, semilla, parts) => D.asedioPlan({ atk: (parts || PARTES).total * r, parts: parts || PARTES, semilla });

test('la probabilidad de ganar según la proporción de fuerzas es la de antes (contrato de PLAN-GUERRA.md §1)', () => {
  const ANTES = { 0.8: 3, 0.9: 21, 1: 50, 1.1: 77, 1.2: 92, 1.3: 99 }, N = 20000;
  for (const r of Object.keys(ANTES)) {
    let g = 0;
    for (let i = 0; i < N; i++) if (plan(+r, i * 7919 + 13).gano) g++;
    const pct = (100 * g) / N;
    assert.ok(Math.abs(pct - ANTES[r]) <= 3, 'con ' + r + ' veces la defensa gana el ' + pct.toFixed(1) + ' % (antes ' + ANTES[r] + ' %)');
  }
});

test('la misma semilla da la misma batalla, y otra semilla da otra', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(plan(1.1, 42))), JSON.parse(JSON.stringify(plan(1.1, 42))));
  assert.notEqual(JSON.stringify(plan(1.1, 42)), JSON.stringify(plan(1.1, 43)));
});

test('las etapas suman la defensa, van en orden y el ataque se quiebra donde se le acaba el ímpetu', () => {
  for (let i = 1; i <= 400; i++) {
    const r = 0.6 + (i % 9) * 0.1, p = plan(r, i * 31, i % 3 ? PARTES : SIN_MUROS);
    assert.equal(p.gano, p.atk > p.def || (p.atk === p.def && p.gano), 'gana el que tiró más');
    assert.deepEqual(p.etapas.map(e => e.id), D.ASEDIO.etapas.slice(0, p.etapas.length));
    let t = 0;
    for (const e of p.etapas) { assert.equal(e.t0, t); assert.ok(e.dur >= D.ASEDIO.vacia); t += e.dur; }
    assert.equal(p.total, t);
    assert.ok(p.total <= 400, 'un asedio no dura más de unos minutos: ' + p.total);
    if (p.gano) {
      assert.equal(p.etapas.length, 3);
      assert.ok(Math.abs(p.gastado - p.def) < 2 && !p.etapas.some(e => e.rota));
      assert.ok(p.bajas >= 0.12 && p.bajas <= 0.3, 'bajas del que gana: ' + p.bajas);
    } else {
      assert.ok(p.etapas[p.etapas.length - 1].rota && p.gastado < p.def);
      assert.ok(p.bajas >= 0.7 && p.bajas <= 0.8, 'bajas del que pierde: ' + p.bajas);
    }
    // las partes a escala (el resumen de D.battleCause) suman la defensa tirada
    const suma = Object.keys(D.DEF_PARTS).reduce((s, k) => s + p.parts[k], 0);
    assert.ok(Math.abs(suma - p.def) <= 6, 'partes ' + suma + ' contra defensa ' + p.def);
  }
});

test('una parcela sin torres ni murallas pasa la etapa de defensas en segundos', () => {
  const p = plan(1.4, 5, SIN_MUROS), e = p.etapas.find(x => x.id === 'defensas');
  assert.ok(p.gano && e && e.dur === D.ASEDIO.vacia && e.r < 1);
});

test('el estado en el tiempo es continuo, no retrocede y termina donde dice el plan', () => {
  for (const [r, s] of [[1.3, 3], [1.02, 8], [0.95, 11], [0.7, 19]]) {
    const p = plan(r, s);
    let antes = D.asedioEn(p, 0);
    assert.equal(antes.etapa, 0); assert.equal(antes.control, 0); assert.equal(antes.impetu, 1); assert.equal(antes.resistencia, 1);
    for (let t = 0.5; t <= p.total; t += 0.5) {
      const e = D.asedioEn(p, t);
      for (const v of Object.values(e)) if (typeof v === 'number') assert.ok(Number.isFinite(v), 'NaN en t=' + t);
      assert.ok(e.etapa >= antes.etapa && e.control >= antes.control - 1e-9 && e.impetu <= antes.impetu + 1e-9 && e.resistencia <= antes.resistencia + 1e-9 && e.bajasA >= antes.bajasA - 1e-9);
      assert.ok(e.control - antes.control < 0.05, 'salto de avance en t=' + t);
      antes = e;
    }
    const fin = D.asedioEn(p, p.total + 100);
    assert.ok(fin.fin && Math.abs(fin.bajasA - p.bajas) < 1e-9);
    if (p.gano) { assert.ok(fin.resistencia < 0.001 && fin.impetu > 0 && fin.etapa === 2 && Math.abs(fin.f - 1) < 1e-9); }
    else assert.ok(fin.impetu < 0.01 && fin.resistencia > 0 && fin.f < 1);
  }
});

test('la repetición de una batalla que decidió el servidor respeta su resultado', () => {
  const parts = D.scaleParts(PARTES, 2300);
  const gana = D.asedioDe({ atk: 2100, def: 2300, parts, semilla: 9, gano: false });
  assert.ok(!gana.gano && gana.etapas[gana.etapas.length - 1].rota);
  const pierde = D.asedioDe({ atk: 2600, def: 2300, parts, semilla: 9, gano: true });
  assert.ok(pierde.gano && pierde.etapas.length === 3);
  assert.ok(D.asedioDe({ atk: 900, def: 800, parts: {}, semilla: 2 }).etapas.length === 3, 'un resumen viejo sin partes también se puede ver');
});

test('el dibujo no decide: frente.js no tira dados para el resultado ni toca el guardado', () => {
  const src = JS('frente.js').replace(/\/\/.*$/gm, ''); // sin los comentarios
  assert.ok(!/asedioPlan|conquestLoss|\.terr\.(camps|threats|battles)\b|st\.res\b|give\(|pay\(/.test(src), 'frente.js solo dibuja');
  assert.ok(/D\.asedioEn\(/.test(src), 'lee el estado del plan');
  const terr = JS('terr.js');
  assert.ok(!/U\.rand\(0\.85, 1\.15\)/.test(terr), 'la tirada de la campaña vive en el plan, con semilla');
  const html = fs.readFileSync(path.join(PKDIR, 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/troops.js') < html.indexOf('js/frente.js') && html.indexOf('js/frente.js') < html.indexOf('js/render.js'), 'frente.js va después de troops.js y antes de render.js');
});
