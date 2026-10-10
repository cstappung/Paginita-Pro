/* El mercado de Juegos (src/juegos/mercado-datos.js): las filas que pinta,
   los filtros por juego y tipo, y las comprobaciones antes de escribir. Se
   compila con esbuild (importa el catálogo .ts de Mascotas). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

const r = esbuild.buildSync({
  stdin: { contents: `export * from './juegos/mercado-datos.js'; export { leeCopia } from './juegos/monedas.js';`, resolveDir: path.join(__dirname, '..', 'src'), loader: 'js' },
  bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node20', logLevel: 'silent'
});
const M = { exports: {} };
new Function('module', 'exports', 'require', r.outputFiles[0].text)(M, M.exports, require);
const { ofertasMercado, filtra, misVentas, misCambios, intercambiables, gente, puedeComprar, puedeProponer, pendientesDe, FILTROS_INICIALES } = M.exports;

const T = 1791700000000, V = 'vende0001', C = 'compra001';
function base() {
  const d = { ranks: {}, solo: {}, logros: {}, diario: {}, cartas: { s: {} }, mercado: { o: {}, t: {} }, clubJugadas: {}, podios: {}, tienda: {}, mascotas: { a: {}, r: {}, c: {} }, completo: true,
    ajustes: { [V]: { a: { n: 9000, m: 'x', por: 'admin', at: T - 1 } }, [C]: { a: { n: 9000, m: 'x', por: 'admin', at: T - 1 } } } };
  d.cartas.s[V] = { 'p-Npack0001': { at: T, p: 80 } };
  d.mascotas.a[V] = { '-Nadop00001': { at: T + 1, e: 'chicken', p: 0 } };
  d.mascotas.r[V] = { '-Nrega00001': { at: T + 2, p: 500 }, '-Nrega00002': { at: T + 3, p: 500 } };
  const of = (id, c, p, at) => { d.mercado.o[id] = { u: V, c, p, at }; };
  of('-Nof0000001', `${V}~p-Npack0001.0`, 50, T + 10);
  of('-Nof0000002', `ma:${V}~-Nadop00001`, 300, T + 11);
  of('-Nof0000003', `ob:${V}~-Nrega00001`, 120, T + 12);
  return d;
}

test('las ofertas de los dos juegos salen juntas, cada una con su tipo', () => {
  const d = base(), l = ofertasMercado(d, C, {});
  assert.deepEqual(l.map(x => [x.tipo === 'baile' ? 'objeto' : x.tipo, x.juego]).sort(), [['carta', 'prodrop'], ['mascota', 'mascotas'], ['objeto', 'mascotas']]);
  assert.ok(l.every(x => !x.propia));
  assert.ok(ofertasMercado(d, V, {}).every(x => x.propia), 'quien vende ve las suyas marcadas');
});

test('los filtros cambian según el juego y el tipo; el orden y la búsqueda son comunes', () => {
  const d = base(), l = ofertasMercado(d, C, { [`${V}~-Nadop00001`]: { n: 'Clotilde', e: 'adult' } });
  const f = x => filtra(l, Object.assign({}, FILTROS_INICIALES, x)).map(r => r.tipo);
  assert.equal(f({}).length, 3);
  assert.deepEqual(f({ juego: 'prodrop' }), ['carta']);
  assert.equal(f({ juego: 'mascotas' }).length, 2);
  assert.deepEqual(f({ juego: 'mascotas', tipoM: 'mascota' }), ['mascota']);
  assert.deepEqual(f({ juego: 'mascotas', tipoM: 'mascota', etapa: 'egg' }), []);
  assert.deepEqual(f({ juego: 'mascotas', tipoM: 'mascota', etapa: 'adult', especie: 'chicken' }), ['mascota']);
  assert.deepEqual(f({ q: 'clotilde' }), ['mascota'], 'busca por el nombre de la mascota');
  assert.deepEqual(filtra(l, { orden: 'caro' }).map(r => r.p), [300, 120, 50]);
  assert.deepEqual(filtra(l, { orden: 'barato' }).map(r => r.p), [50, 120, 300]);
});

test('comprar: fondos, cupo y la propia oferta', () => {
  const d = base();
  assert.equal(puedeComprar(d, C, '-Nof0000002'), '');
  assert.match(puedeComprar(d, V, '-Nof0000002'), /propia/);
  d.ajustes[C].a.n = 10;
  assert.match(puedeComprar(d, C, '-Nof0000002'), /faltan/);
  const d2 = base();
  d2.mascotas.a[C] = {};
  for (let i = 0; i < 6; i++) d2.mascotas.a[C]['-Nmia000' + i] = { at: T + 20 + i, e: 'cat', p: i ? 1000 : 0 };
  assert.match(puedeComprar(d2, C, '-Nof0000002'), /corral está lleno/);
  assert.equal(puedeComprar(d2, C, '-Nof0000003'), '', 'un objeto sí');
});

test('mis ventas: lo vendido, lo comprado y lo que no cupo', () => {
  const d = base();
  d.mercado.o['-Nof0000003'].v = { u: C, at: T + 20 };
  const v = misVentas(d, V, {}), c = misVentas(d, C, {});
  assert.equal(v.find(x => x.id === '-Nof0000003').estado, 'vendida');
  assert.equal(c.length, 1);
  assert.equal(c[0].compra, true);
});

test('intercambios: los tres tipos, el cupo y los pendientes', () => {
  const d = base();
  d.mascotas.a[C] = { '-Nmia00001': { at: T + 30, e: 'cat', p: 0 } };
  d.mascotas.r[C] = { '-Nmia00002': { at: T + 31, p: 500 } };
  const mias = intercambiables(d, C, {}).map(x => x.tipo).sort();
  assert.deepEqual(mias.map(t => (t === 'baile' ? 'objeto' : t)).sort(), ['mascota', 'objeto']);
  assert.ok(gente(d, C)[V].includes(`ob:${V}~-Nrega00002`), 'lo que no está a la venta se puede pedir');
  assert.ok(!gente(d, C)[V].includes(`ob:${V}~-Nrega00001`), 'lo que está a la venta, no');
  const dar = [`ma:${C}~-Nmia00001`], pedir = [`${V}~p-Npack0001.1`, `ob:${V}~-Nrega00002`];
  assert.equal(puedeProponer(d, C, V, dar, pedir), '');
  assert.match(puedeProponer(d, C, V, [], pedir), /de 1 a 3/);
  assert.match(puedeProponer(d, C, V, dar, [`ob:${V}~-Nrega00001`]), /a la venta/);
  d.mercado.t['-Ntrato0001'] = { de: C, para: V, dar, pedir, at: T + 40 };
  assert.equal(pendientesDe(d, V), 1);
  assert.equal(pendientesDe(d, C), 0);
  assert.equal(misCambios(d, V, {})[0].posible, true);
});
