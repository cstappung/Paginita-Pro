/* Mascotas: la lógica pura del juego (colabtex/src/mascotas/game, pets/tint y
   pets/rig, sus *.test.ts de siempre) y su economía en juegos/monedas.js.

   Los tests del juego están en TypeScript y usan la API de vitest. No hay
   vitest aquí (ni otro runner): esbuild los compila a CJS al vuelo, con un
   `vitest` de mentira que traduce describe/it/expect a node:test, igual que
   build:rules-test compila test-rules.mjs antes de correrlo. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

const SRC = path.join(__dirname, '..', 'src');

/* ---------- el vitest de mentira ---------- */
const prefijo = [];
const igual = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch { return false; } };
const contiene = (obj, sub) => {
  if (sub && sub.__arrayContaining) return Array.isArray(obj) && sub.__arrayContaining.every(x => obj.some(y => igual(y, x)));
  if (sub === null || typeof sub !== 'object') return igual(obj, sub);
  if (obj === null || typeof obj !== 'object') return false;
  return Object.keys(sub).every(k => contiene(obj[k], sub[k]));
};
function expect(v) {
  const m = {
    toBe: x => assert.ok(Object.is(v, x), `esperaba ${JSON.stringify(x)} y fue ${JSON.stringify(v)}`),
    toEqual: x => (x && x.__arrayContaining ? assert.ok(contiene(v, x), 'no contiene lo pedido') : assert.deepStrictEqual(JSON.parse(JSON.stringify(v)), JSON.parse(JSON.stringify(x)))),
    toMatchObject: x => assert.ok(contiene(v, x), `${JSON.stringify(v)} no calza con ${JSON.stringify(x)}`),
    toBeGreaterThan: x => assert.ok(v > x, `${v} > ${x}`),
    toBeGreaterThanOrEqual: x => assert.ok(v >= x, `${v} >= ${x}`),
    toBeLessThan: x => assert.ok(v < x, `${v} < ${x}`),
    toBeLessThanOrEqual: x => assert.ok(v <= x, `${v} <= ${x}`),
    toBeCloseTo: (x, d = 2) => assert.ok(Math.abs(v - x) < Math.pow(10, -d) / 2, `${v} ≈ ${x}`),
    toBeUndefined: () => assert.equal(v, undefined),
    toBeDefined: () => assert.notEqual(v, undefined),
    toBeFalsy: () => assert.ok(!v, `${v} debía ser falso`),
    toBeTruthy: () => assert.ok(!!v, `${v} debía ser verdadero`),
    toHaveLength: n => assert.equal(v.length, n),
    toContain: x => assert.ok(v.includes(x), `no contiene ${x}`)
  };
  m.not = {
    toBe: x => assert.ok(!Object.is(v, x), `no debía ser ${JSON.stringify(x)}`),
    toEqual: x => assert.ok(!igual(JSON.parse(JSON.stringify(v)), JSON.parse(JSON.stringify(x))), 'no debía ser igual')
  };
  return m;
}
expect.arrayContaining = l => ({ __arrayContaining: l });
globalThis.__vitest = {
  describe: (n, f) => { prefijo.push(n); try { f(); } finally { prefijo.pop(); } },
  it: (n, f) => test([...prefijo, n].join(' › '), f),
  expect
};

const compila = (entrada, extra = {}) => {
  const r = esbuild.buildSync(Object.assign({
    stdin: { contents: entrada, resolveDir: SRC, loader: 'ts' },
    bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node20', logLevel: 'silent',
    external: ['vitest']
  }, extra));
  const m = { exports: {} };
  const pide = id => (id === 'vitest' ? globalThis.__vitest : require(id));
  new Function('module', 'exports', 'require', r.outputFiles[0].text)(m, m.exports, pide);
  return m.exports;
};

/* ---------- los tests del juego, tal cual ---------- */
const PRUEBAS = ['mascotas/game', 'mascotas/pets', 'mascotas/pets/rig']
  .flatMap(d => fs.readdirSync(path.join(SRC, d)).filter(f => f.endsWith('.test.ts')).map(f => './' + d + '/' + f));
assert.ok(PRUEBAS.length >= 7, 'faltan los tests del juego');
compila(PRUEBAS.map(f => `import ${JSON.stringify(f)};`).join('\n'));

/* ---------- la economía ---------- */
const E = compila(`export * from './juegos/monedas.js'; export { default as MM } from '../../juegos/mascotas/motor.js';`);
const { economia, monedasDe, mascotasDe, objetosDe, leeCopia, MM } = E;

const T = 1791700000000;   // después de la promoción de los sobres
let n = 0;
const clave = () => '-Nprueba' + String(++n).padStart(4, '0');
/* Un estado de la base, con lo ganado a mano (`ajustesMonedas`). */
function base(ganado = {}) {
  const d = { ranks: {}, solo: {}, logros: {}, diario: {}, cartas: {}, mercado: { o: {}, t: {} }, clubJugadas: {}, podios: {}, tienda: {}, ajustes: {}, mascotas: { a: {}, r: {}, c: {} }, completo: true };
  for (const [u, x] of Object.entries(ganado)) d.ajustes[u] = { a: { n: x, m: 'prueba', por: 'admin', at: T - 1000 } };
  return d;
}
const fresco = d => Object.assign({}, d);   // la economía memoriza por objeto
const adopta = (d, u, at, p, e = 'chicken') => { const k = clave(); (d.mascotas.a[u] = d.mascotas.a[u] || {})[k] = { at, e, p }; return 'ma:' + u + '~' + k; };
const regala = (d, u, at, p = 500) => { const k = clave(); (d.mascotas.r[u] = d.mascotas.r[u] || {})[k] = { at, p }; return { c: 'ob:' + u + '~' + k, k }; };
const compra = (d, u, at, x) => { const k = clave(); (d.mascotas.c[u] = d.mascotas.c[u] || {})[k] = Object.assign({ at }, x); return k; };
const oferta = (d, u, c, p, at) => { const id = clave(); d.mercado.o[id] = { u, c, p, at }; return id; };

test('las claves de copia: las viejas se leen igual y las nuevas no se confunden', () => {
  assert.deepEqual({ ...leeCopia('abcdef12~-Nabcdefgh.3') }, { tipo: 'carta', o: 'abcdef12', k: '-Nabcdefgh', i: 3 });
  assert.deepEqual({ ...leeCopia('ob:abcdef12~-Nabcdefgh') }, { tipo: 'objeto', o: 'abcdef12', k: '-Nabcdefgh' });
  assert.deepEqual({ ...leeCopia('ma:abcdef12~-Nabcdefgh') }, { tipo: 'mascota', o: 'abcdef12', k: '-Nabcdefgh' });
  for (const malo of ['ob:abcdef12~-Nabcdefgh.3', 'abcdef12~-Nabcdefgh', 'xx:abcdef12~-Nabcdefgh', 'ma:abc~-Nabcdefgh'])
    assert.equal(leeCopia(malo), null, malo);
});

test('adoptar: la primera es gratis, las demás 1000, y hay cupo de 6', () => {
  const d = base({ ana00001: 20000 });
  const a1 = adopta(d, 'ana00001', T, 0);
  const gratisOtraVez = adopta(d, 'ana00001', T + 1, 0);
  const a2 = adopta(d, 'ana00001', T + 2, 1000, 'cat');
  let e = economia(fresco(d));
  assert.equal(e.dueno[a1], 'ana00001');
  assert.equal(e.dueno[gratisOtraVez], undefined, 'una segunda gratis no vale');
  assert.equal(e.dueno[a2], 'ana00001');
  assert.equal(monedasDe('ana00001', fresco(d)).gastadas, 1000);
  for (let i = 0; i < 4; i++) adopta(d, 'ana00001', T + 10 + i, 1000);
  const septima = adopta(d, 'ana00001', T + 20, 1000);
  e = economia(fresco(d));
  assert.equal(mascotasDe('ana00001', fresco(d)).length, 6);
  assert.equal(e.dueno[septima], undefined, 'la séptima no ocurre');
  assert.equal(monedasDe('ana00001', fresco(d)).gastadas, 5000, 'y no se cobra');
  assert.equal(monedasDe('ana00001', fresco(d)).parada, false);
});

test('adoptar sin fondos para la cuenta (como un sobre sin fondos)', () => {
  const d = base({ beto0001: 300 });
  adopta(d, 'beto0001', T, 0);
  const sinPlata = adopta(d, 'beto0001', T + 1, 1000);
  const m = monedasDe('beto0001', fresco(d));
  assert.equal(economia(fresco(d)).dueno[sinPlata], undefined);
  assert.equal(m.parada, true);
  assert.equal(m.saldo, 300);
});

test('un regalo cuesta 500 y lo que trae sale del motor', () => {
  const d = base({ ana00001: 1200 });
  const r1 = regala(d, 'ana00001', T);
  const mal = regala(d, 'ana00001', T + 1, 1000);
  const objs = objetosDe('ana00001', fresco(d));
  assert.equal(objs.length, 1);
  const g = MM.regalo('ana00001', r1.k, T);
  assert.deepEqual([objs[0].c, objs[0].kind, objs[0].id, objs[0].tint, objs[0].leg], [r1.c, g.kind, g.id, g.tint, g.leg]);
  assert.equal(economia(fresco(d)).dueno[mal.c], undefined, 'el precio lo fija la regla');
  assert.equal(monedasDe('ana00001', fresco(d)).saldo, 700);
});

test('comida, fondos y poción: precios fijos y cada cosa una vez', () => {
  const d = base({ ana00001: 5000, beto0001: 5000 });
  const mia = adopta(d, 'ana00001', T, 0), ajena = adopta(d, 'beto0001', T, 0);
  compra(d, 'ana00001', T + 1, { k: 'comida', p: 100, n: 5 });
  compra(d, 'ana00001', T + 2, { k: 'comida', p: 50, n: 5 });           // mal precio: no existe
  compra(d, 'ana00001', T + 3, { k: 'fondo-sunset', p: 10 });
  compra(d, 'ana00001', T + 4, { k: 'fondo-sunset', p: 10 });           // repetido: no cobra
  compra(d, 'ana00001', T + 5, { k: 'pocion', p: 1000, m: ajena });     // mascota ajena: no cobra
  compra(d, 'ana00001', T + 6, { k: 'pocion', p: 1000, m: mia });
  compra(d, 'ana00001', T + 7, { k: 'pocion', p: 1000, m: mia });       // ya la tomó: no cobra
  const e = economia(fresco(d)), u = e.usuarios.ana00001;
  assert.equal(u.comida, 5);
  assert.deepEqual(Object.keys(u.fondos), ['sunset']);
  assert.equal(e.congelada[mia], T + 6);
  assert.equal(e.congelada[ajena], undefined);
  assert.equal(monedasDe('ana00001', fresco(d)).gastadas, 100 + 10 + 1000);
  assert.equal(mascotasDe('ana00001', fresco(d))[0].frozen, true);
});

test('despedirse libera el cupo (y la adopción gratis no vuelve)', () => {
  const d = base({ ana00001: 10000 });
  const lista = [adopta(d, 'ana00001', T, 0)];
  for (let i = 1; i < 6; i++) lista.push(adopta(d, 'ana00001', T + i, 1000));
  compra(d, 'ana00001', T + 10, { k: 'adios', p: 0, m: lista[2] });
  const nueva = adopta(d, 'ana00001', T + 11, 1000);
  const e = economia(fresco(d));
  assert.equal(e.dueno[lista[2]], undefined);
  assert.equal(e.dueno[nueva], 'ana00001');
  assert.equal(mascotasDe('ana00001', fresco(d)).length, 6);
});

test('el mercado vende mascotas y objetos; la mascota viaja y cuenta para el cupo de quien la compra', () => {
  const d = base({ ana00001: 1000, beto0001: 9000 });
  const m = adopta(d, 'ana00001', T, 0);
  const g = regala(d, 'ana00001', T + 1);
  oferta(d, 'ana00001', m, 300, T + 2);
  const o2 = oferta(d, 'ana00001', g.c, 150, T + 3);
  d.mercado.o[Object.keys(d.mercado.o)[0]].v = { u: 'beto0001', at: T + 4 };
  d.mercado.o[o2].v = { u: 'beto0001', at: T + 5 };
  const e = economia(fresco(d));
  assert.equal(e.dueno[m], 'beto0001');
  assert.equal(e.dueno[g.c], 'beto0001');
  assert.deepEqual(e.historial[m], ['ana00001'], 'se sabe de quién heredar el estado');
  assert.equal(monedasDe('ana00001', fresco(d)).cobradas, 450);
  assert.equal(mascotasDe('beto0001', fresco(d))[0].antes[0], 'ana00001');
  // Los genes no cambian: salen de la adopción, no del dueño.
  assert.equal(mascotasDe('beto0001', fresco(d))[0].o, 'ana00001');
});

test('una mascota para quien ya tiene 6: la venta no ocurre y no cobra', () => {
  const d = base({ ana00001: 1000, beto0001: 9000 });
  const m = adopta(d, 'ana00001', T, 0);
  adopta(d, 'beto0001', T, 0);
  for (let i = 1; i < 6; i++) adopta(d, 'beto0001', T + i, 1000);
  const id = oferta(d, 'ana00001', m, 300, T + 10);
  d.mercado.o[id].v = { u: 'beto0001', at: T + 11 };
  const e = economia(fresco(d));
  assert.equal(e.ofertas[id].estado, 'rechazada');
  assert.equal(e.dueno[m], 'ana00001');
  assert.equal(monedasDe('beto0001', fresco(d)).parada, false);
  assert.equal(monedasDe('beto0001', fresco(d)).gastadas, 5000);
});

test('lo inicial no tiene copia: no se puede ofrecer', () => {
  const d = base({ ana00001: 100 });
  const id = oferta(d, 'ana00001', 'start-hat-beanie', 10, T);
  assert.equal(economia(fresco(d)).ofertas[id].estado, 'nula');
});

test('un intercambio mixto: carta y objeto por una mascota, con cupo', () => {
  const d = base({ ana00001: 2000, beto0001: 2000 });
  const k = clave();
  d.cartas.s = { ana00001: { [k]: { at: T, p: 80 } } };
  const carta = 'ana00001~' + k + '.0';
  const g = regala(d, 'ana00001', T + 1);
  const m = adopta(d, 'beto0001', T + 2, 0);
  d.mercado.t['-Ntrato0001'] = { de: 'ana00001', para: 'beto0001', dar: [carta, g.c], pedir: [m], at: T + 3, ok: T + 4 };
  const e = economia(fresco(d));
  assert.equal(e.cambios['-Ntrato0001'].estado, 'hecho');
  assert.equal(e.dueno[carta], 'beto0001');
  assert.equal(e.dueno[g.c], 'beto0001');
  assert.equal(e.dueno[m], 'ana00001');
  assert.deepEqual(e.historial[m], ['beto0001']);
});

test('la economía de antes (solo cartas) no cambia', () => {
  const d = base({ ana00001: 500, beto0001: 500 });
  const k = clave();
  d.cartas.s = { ana00001: { [k]: { at: T, p: 80 } } };
  const c = 'ana00001~' + k + '.2';
  const id = oferta(d, 'ana00001', c, 100, T + 1);
  d.mercado.o[id].v = { u: 'beto0001', at: T + 2 };
  const e = economia(fresco(d));
  assert.equal(e.ofertas[id].estado, 'vendida');
  assert.equal(e.dueno[c], 'beto0001');
  assert.deepEqual(mascotasDe('ana00001', fresco(d)), []);
  assert.deepEqual(objetosDe('beto0001', fresco(d)), []);
  assert.equal(monedasDe('ana00001', fresco(d)).saldo, 500 - 80 + 100);
});

test('las reglas tienen los precios del motor', () => {
  const r = fs.readFileSync(path.join(__dirname, '..', '..', 'firebase', 'database.rules.json'), 'utf8');
  assert.ok(r.includes("newData.child('p').val() === 500"), 'regalo');
  assert.ok(r.includes("newData.child('p').val() === 1000)"), 'poción');
  assert.ok(r.includes("20 * newData.child('n').val()"), 'comida');
  assert.ok(r.includes("exists() ? 1000 : 0)"), 'adopción');
  for (const [id, p] of Object.entries(MM.PRECIO.fondos)) assert.ok(r.includes(`'fondo-${id}' && newData.child('p').val() === ${p})`), 'fondo ' + id);
});
