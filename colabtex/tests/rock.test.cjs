/* Batalla de Rock (el fondo de PRO HERO, a prueba): el catálogo y sus cajas
   (juegos/hero/js/rock/catalogo.js), la caja derivada (src/juegos/rock-datos.js),
   su cobro en la economía (monedas.js) y su venta en el mercado. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

const r = esbuild.buildSync({
  stdin: { contents: `export * from './juegos/rock-datos.js'; export { economia, monedasDe, rocasDe, leeCopia } from './juegos/monedas.js'; export { ofertasMercado, filtra, intercambiables, juegosMercado } from './juegos/mercado-datos.js'; export * as CAT from '../../juegos/hero/js/rock/catalogo.js';`, resolveDir: path.join(__dirname, '..', 'src'), loader: 'js' },
  bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node20', logLevel: 'silent'
});
const M = { exports: {} };
new Function('module', 'exports', 'require', r.outputFiles[0].text)(M, M.exports, require);
const X = M.exports, C = X.CAT;

const T = 1791700000000, A = 'rockero01', B = 'compra001';
/* `n` monedas de ajuste para cada cuenta y las cajas de A */
function datos(cajas, n = 5000) {
  return { ranks: {}, solo: {}, logros: {}, diario: {}, cartas: {}, mercado: { o: {}, t: {} }, clubJugadas: {}, podios: {}, tienda: {}, mascotas: {}, completo: true,
    ajustes: { [A]: { a: { n, m: 'x', por: 'admin', at: T - 1 } }, [B]: { a: { n, m: 'x', por: 'admin', at: T - 1 } } },
    rock: { c: { [A]: cajas } } };
}

test('las cajas traen todo el catálogo (menos «nada») y nada más, una vez cada cosa', () => {
  const vistos = new Set();
  for (const p of C.POOL) {
    const k = p.b + ':' + p.k + ':' + p.t;
    assert.ok(!vistos.has(k), 'repetido ' + k);
    vistos.add(k);
    assert.ok(C.invItem(p.b, p.k, p.t), 'no existe ' + k);
  }
  for (const b of ['m', 'f']) for (const k in C.INV_CATS) for (const it of C.ED_CAT[b][k] || [])
    if (it[0] !== 'none') assert.ok(vistos.has(b + ':' + k + ':' + it[0]), 'falta en POOL (se agrega al final): ' + b + ':' + k + ':' + it[0]);
  assert.ok(C.POOL.some(p => p.leg) && C.POOL.some(p => !p.leg));
});

test('una caja se deriva igual en todos lados, del cuerpo pedido, y 1 de cada 10 es legendaria', () => {
  assert.deepEqual(X.cajaRock(A, '-Ncaja0001', T, 'f'), X.cajaRock(A, '-Ncaja0001', T, 'f'));
  let leg = 0;
  for (let i = 0; i < 4000; i++) {
    const v = X.cajaRock(A, 'k' + String(i).padStart(9, '0'), T + i, i % 2 ? 'f' : 'm');
    assert.equal(v.b, i % 2 ? 'f' : 'm');
    assert.ok(C.invItem(v.b, v.k, v.t));
    for (const c of Object.values(v.c)) assert.ok(Number.isInteger(c) && c >= 0 && c <= 0xffffff);
    if (v.leg) {
      leg++;
      // un legendario trae sus colores de fábrica
      const fab = C.invItem(v.b, v.k, v.t)[2];
      for (const [f, c] of Object.entries(fab)) if (C.INV_CATS[v.k].cols.includes(f)) assert.equal(v.c[f], c);
    }
  }
  assert.ok(leg > 300 && leg < 500, 'legendarias: ' + leg);
});

test('la caja cobra 500, deja una copia rk: de la cuenta y solo vale bien escrita', () => {
  const d = datos({ '-Ncaja0001': { at: T, p: 500, b: 'm' }, '-Ncaja0002': { at: T + 1, p: 50, b: 'm' }, '-Ncaja0003': { at: T + 2, p: 500, b: 'x' } });
  const e = X.economia(d), m = X.monedasDe(A, d);
  assert.equal(m.gastadas, 500);
  const mias = X.rocasDe(A, d);
  assert.equal(mias.length + (e.usuarios[A].cajasRock[0].dup ? 1 : 0), 1);
  assert.equal(e.usuarios[A].cajasRock.length, 1, 'las mal escritas no existen');
  if (mias.length) {
    assert.equal(mias[0].c, 'rk:' + A + '~-Ncaja0001');
    assert.deepEqual(X.leeCopia(mias[0].c), { tipo: 'rock', o: A, k: '-Ncaja0001' });
    assert.deepEqual({ b: mias[0].b, k: mias[0].k, t: mias[0].t, c: mias[0].colores }, (({ b, k, t, c }) => ({ b, k, t, c }))(X.cajaRock(A, '-Ncaja0001', T, 'm')));
  }
});

test('una caja repetida exacta devuelve monedas y no deja copia', () => {
  // busca dos claves que traigan la misma pieza con los mismos colores
  const vistas = new Map();
  let par = null;
  for (let i = 0; i < 20000 && !par; i++) {
    const k = 'k' + String(i).padStart(9, '0'), v = X.cajaRock(A, k, T + i, 'm');
    if (X.repetidaRock(v, [])) continue;   // igual a algo inicial
    const id = C.invId(v);
    if (vistas.has(id)) par = [vistas.get(id), [k, T + i, v]]; else vistas.set(id, [k, T + i, v]);
  }
  assert.ok(par, 'hay repetidas');
  const [[k1, t1], [k2, t2, v]] = par;
  const d = datos({ [k1]: { at: t1, p: 500, b: 'm' }, [k2]: { at: t2, p: 500, b: 'm' } });
  const m = X.monedasDe(A, d), cajas = X.economia(d).usuarios[A].cajasRock;
  assert.equal(X.rocasDe(A, d).length, 1);
  assert.equal(cajas[1].dup, true);
  assert.equal(m.premios, X.reembolsoRock(v));
  assert.equal(m.saldo, 5000 - 1000 + X.reembolsoRock(v));
});

test('sin saldo la caja no vale y la cuenta queda parada', () => {
  const d = datos({ '-Ncaja0001': { at: T, p: 500, b: 'f' } }, 100);
  assert.equal(X.rocasDe(A, d).length, 0);
  assert.equal(X.monedasDe(A, d).parada, true);
});

test('una pieza se vende en el mercado, pero solo la ve un administrador', () => {
  const d = datos({ '-Ncaja0001': { at: T, p: 500, b: 'f' } });
  const c = 'rk:' + A + '~-Ncaja0001';
  if (!X.rocasDe(A, d).length) return;   // salió repetida de algo inicial: no hay copia que vender
  // la economía se recuerda por objeto (monedas.js): cada cambio, un objeto nuevo, como en la página
  d.mercado.o['-Nofrock001'] = { u: A, c, p: 700, at: T + 10 };
  let d2 = Object.assign({}, d);
  X.fijaVeRock(false);
  assert.equal(X.ofertasMercado(d2, B, {}).length, 0, 'sin ser admin no existe');
  assert.ok(!X.juegosMercado().some(([k]) => k === 'rock'));
  X.fijaVeRock(true);
  const of = X.ofertasMercado(d2, B, {});
  assert.equal(of.length, 1);
  assert.equal(of[0].tipo, 'rock');
  assert.equal(of[0].juego, 'rock');
  assert.ok(of[0].colores.every(x => /^#[0-9a-f]{6}$/.test(x)));
  assert.equal(X.filtra(of, { juego: 'rock' }).length, 1);
  assert.equal(X.filtra(of, { juego: 'mascotas' }).length, 0);
  assert.ok(X.juegosMercado().some(([k]) => k === 'rock'));
  // comprada, pasa a ser de B
  d.mercado.o['-Nofrock001'].v = { u: B, at: T + 20 };
  d2 = Object.assign({}, d);
  assert.equal(X.rocasDe(B, d2).length, 1);
  assert.equal(X.rocasDe(A, d2).length, 0);
  assert.equal(X.monedasDe(A, d2).cobradas, 700);
  X.fijaVeRock(false);
});

test('un rockero ajeno se limpia entero y solo se ve con lo que su dueño tiene', () => {
  const sucio = { body: 'f', name: '<img src=x onerror=alert(1)>'.repeat(3), ui: 'red;}', skin: 'rojo', face: { eyes: -5, eyeStyle: 'galaxia', hack: 1 },
    top: { type: 'diamante', color: 0x123456 }, guitar: { type: 'noexiste' }, tattoos: [{ design: 'rosa', spot: 'cuello', color: 0x111111 }, { design: 'x', spot: 'y' }], extra: { a: 1 } };
  const L = X.limpiaLook(JSON.stringify(sucio));
  assert.equal(L.name.length, 24);
  assert.equal(L.ui, C.defaultLook('f').ui);
  assert.equal(L.skin, C.defaultLook('f').skin);
  assert.equal(L.face.hack, undefined);
  assert.equal(L.extra, undefined);
  assert.equal(L.guitar.type, C.defaultLook('f').guitar.type);
  assert.equal(L.tattoos.length, 1);
  assert.equal(X.limpiaLook('no es json'), null);
  // el corsé de diamantes (legendario) no lo tiene: se ve con lo de fábrica
  const V = X.lookVisible(JSON.stringify(sucio), []);
  assert.equal(V.top.type, C.defaultLook('f').top.type);
  // con la pieza en el inventario, se ve (con los colores de su variante)
  const mia = { b: 'f', k: 'top', t: 'diamante', c: { color: 0xc8c0f0 } };
  assert.equal(X.lookVisible(JSON.stringify(sucio), [mia]).top.type, 'diamante');
  assert.equal(X.lookVisible(JSON.stringify(sucio), [mia]).top.color, 0xc8c0f0);
});

test('lo inicial lo tiene todo el mundo: los rockeros de fábrica se ven tal cual', () => {
  for (const k of ['violeta', 'rex', 'kid']) {
    const L = C.sanitizeLook(C.ROCKERS[k]), V = C.lookPosible(JSON.parse(JSON.stringify(L)), []);
    for (const cat in C.INV_CATS) if (L[cat]) assert.deepEqual(V[cat], L[cat], k + ' ' + cat);
  }
});
