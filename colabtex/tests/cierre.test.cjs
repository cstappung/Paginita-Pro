/* El cierre de la economía (src/juegos/cierre.js y cierre-datos.js): con el
   cierre puesto y lo viejo archivado tienen que salir exactamente las mismas
   cuentas que rehaciendo la historia entera, también encadenando cierres y
   con eventos después. Se compila con esbuild (monedas.js importa los
   motores de PRODROP y Mascotas). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

const r = esbuild.buildSync({
  stdin: { contents: `export * from './juegos/cierre.js'; export * from './juegos/cierre-datos.js'; export { economia, monedasDe, topMonedas, recorreEconomia } from './juegos/monedas.js'; export { cifras, topColecciones, fijaSerie1 } from './juegos/prodrop-cartas.js';`, resolveDir: path.join(__dirname, '..', 'src'), loader: 'js' },
  bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node20', logLevel: 'silent'
});
const M = { exports: {} };
new Function('module', 'exports', 'require', r.outputFiles[0].text)(M, M.exports, require);
const X = M.exports;

const T0 = 1791700000000, H = 3600000;
const A = 'cuentaAAA1', B = 'cuentaBBB2', P = 'paradaPPP3';
X.fijaSerie1({ [A]: { at: 1 }, [B]: { at: 1 } }, A);

/* Una historia pequeña con un poco de todo: sobres, graduaciones, ofertas
   vendidas y activas, un intercambio, casino cerrado y abierto, mascotas,
   regalo, comida, una caja de rock y una cuenta que se queda sin fondos. */
function historia() {
  const d = { ranks: {}, solo: {}, logros: {}, diario: {}, clubJugadas: {}, podios: {}, tienda: {}, cofres: {}, referidos: {}, superChat: {}, completo: true,
    cartas: { s: {}, g: {}, r: {} }, mercado: { o: {}, t: {} }, casino: {}, mascotas: { a: {}, r: {}, c: {} }, rock: { c: {} },
    ajustes: { [A]: { 'aj-000000001': { n: 20000, m: 'x', por: 'adm', at: 1 } }, [B]: { 'aj-000000002': { n: 20000, m: 'x', por: 'adm', at: 1 } }, [P]: { 'aj-000000003': { n: 100, m: 'x', por: 'adm', at: 1 } } } };
  const sob = (u, k, at, p = 80) => { (d.cartas.s[u] = d.cartas.s[u] || {})[k] = { at, p }; };
  sob(A, 'p-sobreA0001', T0 + 1 * H); sob(A, 'c-sobreA0002', T0 + 2 * H); sob(B, 'c-sobreB0001', T0 + 3 * H); sob(A, 'g-sobreA0003', T0 + 30 * H);
  d.cartas.g[A] = { 'p-sobreA0001': { 0: { at: T0 + 4 * H, p: 100 } } };
  d.mercado.o['of-vendida01'] = { u: A, c: `${A}~p-sobreA0001.1`, p: 300, at: T0 + 5 * H, v: { u: B, at: T0 + 6 * H } };
  d.mercado.o['of-activa001'] = { u: A, c: `${A}~p-sobreA0001.2`, p: 400, at: T0 + 7 * H };
  d.mercado.o['of-retirada1'] = { u: B, c: `${B}~c-sobreB0001.0`, p: 50, at: T0 + 7 * H, x: T0 + 8 * H };
  d.mercado.o['of-tarde0001'] = { u: A, c: `${A}~c-sobreA0002.3`, p: 90, at: T0 + 9 * H, v: { u: B, at: T0 + 31 * H } };
  d.mercado.t['tr-hecho0001'] = { de: A, para: B, dar: [`${A}~c-sobreA0002.0`], pedir: [`${B}~c-sobreB0001.1`], at: T0 + 9 * H, ok: T0 + 10 * H };
  d.mercado.t['tr-pendien01'] = { de: B, para: A, dar: [`${B}~c-sobreB0001.2`], at: T0 + 11 * H };
  d.casino[A] = {
    'ca-ruleta001': { j: 'r', p: 100, b: { rojo: 100 }, at: T0 + 12 * H },
    'ca-avion0001': { j: 'a', p: 50, at: T0 + 13 * H, t: { 0: T0 + 13 * H + 350 }, c: T0 + 13 * H + 700 },
    'ca-pinguino1': { j: 'p', p: 50, d: 0, at: T0 + 14 * H, s: { 0: T0 + 14 * H + 900 } },
    'ca-pinguino2': { j: 'p', p: 50, d: 0, at: T0 + 15 * H, s: { 0: T0 + 15 * H + 900 }, c: T0 + 32 * H }
  };
  d.mascotas.a[B] = { 'ma-adopcion1': { at: T0 + 16 * H, e: 'cat', p: 0 } };
  d.mascotas.r[B] = { 'mr-regalo001': { at: T0 + 17 * H, p: 500 } };
  d.mascotas.c[B] = { 'mc-comida001': { at: T0 + 18 * H, k: 'comida', p: 60, n: 3 } };
  d.rock.c[A] = { 'rk-caja00001': { at: T0 + 19 * H, p: 500, b: 'm' } };
  // la parada: 100 de ajuste no le alcanzan para un sobre de 80 y otro más
  sob(P, 'p-sobreP0001', T0 + 20 * H); sob(P, 'p-sobreP0002', T0 + 21 * H);
  return d;
}

const saldos = d => Object.fromEntries(Object.keys(X.economia(d).usuarios).sort().map(u => [u, X.monedasDe(u, d).saldo]));
/* Lo que queda vivo tras escribir el cierre, más un sobre tardío de B. */
const aplica = (d, c) => Object.assign(X.sinRutas(d, c.archivar), { cierre: c.nodo });

test('el formato va y vuelve', () => {
  const d = historia(), c = X.hacerCierre(d, T0 + 25 * H);
  const x = X.leeCierre(c.nodo);
  assert.equal(x.T, c.T);
  assert.ok(x.sobres.length >= 2, 'los sobres con copias vivas');
  assert.ok(Object.keys(x.ofertas).includes('of-activa001'));
  assert.ok(Object.keys(x.mascotas).length === 1 && Object.keys(x.regalos).length === 1);
  assert.equal(X.leeCierre({ v: 99, T: 1, d: '{}' }), null, 'una versión que no conoce se ignora');
});

test('con el cierre salen las mismas cuentas, y lo que viene después también', () => {
  const d = historia(), c = X.hacerCierre(d, T0 + 25 * H);
  assert.ok(!c.nada);
  assert.deepEqual(X.verificaCierre(d, c), []);
  const despues = aplica(d, c);
  assert.deepEqual(saldos(despues), saldos(d));
  // lo que pasa después del cierre se suma igual en los dos
  // (un objeto nuevo: economia() memoriza por objeto)
  const mas = y => { const x = Object.assign({}, y); x.cartas =Object.assign({}, x.cartas, { s: Object.assign({}, x.cartas.s, { [B]: Object.assign({}, x.cartas.s[B], { 'c-sobreB0009': { at: T0 + 40 * H, p: 80 } }) }) }); return x; };
  assert.deepEqual(saldos(mas(despues)), saldos(mas(d)));
  assert.equal(X.monedasDe(B, mas(despues)).saldo, X.monedasDe(B, despues).saldo - 80, 'el sobre nuevo se cobra');
  // la oferta activa se puede comprar después del cierre
  const compra = x => { x.mercado = { o: Object.assign({}, x.mercado.o, { 'of-activa001': Object.assign({}, d.mercado.o['of-activa001'], { v: { u: B, at: T0 + 41 * H } }) }), t: x.mercado.t }; return x; };
  const a = X.economia(compra(Object.assign({}, d))), b = X.economia(compra(aplica(d, c)));
  assert.equal(b.dueno[`${A}~p-sobreA0001.2`], B);
  assert.equal(a.dueno[`${A}~p-sobreA0001.2`], b.dueno[`${A}~p-sobreA0001.2`]);
});

test('lo que se archiva: solo lo que ya no puede cambiar', () => {
  const d = historia(), c = X.hacerCierre(d, T0 + 25 * H), rutas = c.archivar.map(x => x[0]);
  assert.ok(rutas.includes(`casino/${A}/ca-ruleta001`) && rutas.includes(`casino/${A}/ca-avion0001`));
  assert.ok(!rutas.includes(`casino/${A}/ca-pinguino1`), 'una ronda sin terminar sigue viva');
  assert.ok(!rutas.includes(`casino/${A}/ca-pinguino2`), 'una ronda que termina después de T sigue viva');
  assert.ok(rutas.includes('mercado/o/of-vendida01') && rutas.includes('mercado/o/of-retirada1') && rutas.includes('mercado/t/tr-hecho0001'));
  assert.ok(!rutas.includes('mercado/o/of-activa001') && !rutas.includes('mercado/o/of-tarde0001') && !rutas.includes('mercado/t/tr-pendien01'));
  assert.ok(rutas.includes(`cartas/s/${A}/p-sobreA0001`) && rutas.includes(`cartas/g/${A}/p-sobreA0001/0`));
  assert.ok(!rutas.includes(`cartas/s/${A}/g-sobreA0003`), 'lo posterior a T no se toca');
  assert.ok(rutas.every(x => /^(casino|cartas|mercado)\//.test(x)), 'las adopciones, la tienda y los demás nodos no se archivan');
});

test('no se cierra a nadie parado: T queda antes de su primer gasto sin fondos', () => {
  const d = historia(), c = X.hacerCierre(d, T0 + 25 * H);
  assert.equal(c.frenos.length, 1);
  assert.equal(c.frenos[0].uid, P);
  assert.equal(c.T, T0 + 21 * H - 1);
  assert.equal(X.monedasDe(P, d).parada, true);
  // gana lo que le falta: deja de estar parada igual que sin cierre
  const gana = x => Object.assign({}, x, { ajustes: Object.assign({}, x.ajustes, { [P]: Object.assign({}, x.ajustes[P], { 'aj-000000009': { n: 100, m: 'x', por: 'adm', at: 2 } }) }) });
  const despues = aplica(d, c);
  assert.equal(X.monedasDe(P, gana(despues)).parada, false);
  assert.deepEqual(saldos(gana(despues)), saldos(gana(d)));
});

test('dos cierres seguidos, y recalcular desde el archivo da lo mismo', () => {
  const d = historia(), gana = x => Object.assign({}, x, { ajustes: Object.assign({}, x.ajustes, { [P]: { 'aj-000000009': { n: 900, m: 'x', por: 'adm', at: 2 } } }) });
  const full = gana(d), c1 = X.hacerCierre(full, T0 + 12 * H), d1 = aplica(full, c1);
  assert.deepEqual(X.verificaCierre(full, c1), []);
  const c2 = X.hacerCierre(d1, T0 + 35 * H);
  assert.ok(!c2.nada && c2.T > c1.T && !c2.frenos.length);
  assert.deepEqual(X.verificaCierre(d1, c2), []);
  const d2 = aplica(d1, c2);
  assert.deepEqual(saldos(d2), saldos(full));
  // el archivo es lo que se movió en los dos cierres, con las mismas rutas
  const archivo = {};
  for (const [ruta, v] of [...c1.archivar, ...c2.archivar]) {
    const p = ruta.split('/'); let o = archivo;
    for (const k of p.slice(0, -1)) o = o[k] = o[k] || {};
    o[p[p.length - 1]] = v;
  }
  const junto = X.conArchivo(d2, archivo);
  assert.equal(junto.cierre, null);
  assert.deepEqual(saldos(junto), saldos(full));
  assert.deepEqual(X.enVivo(d2, c1.archivar), [], 'lo archivado ya no está vivo');
  // PRODROP sigue contando los sobres abiertos que se archivaron
  assert.deepEqual(X.cifras(d2), X.cifras(full));
  for (const col of ['profes', 'comp', 'futbol']) assert.deepEqual(X.topColecciones(d2, col).map(x => [x.uid, x.sobres, x.puntos]), X.topColecciones(full, col).map(x => [x.uid, x.sobres, x.puntos]));
});

test('rehacer el cierre desde cero: con lo vivo de verdad, y nunca hacia atrás', () => {
  const d = historia(), gana = x => Object.assign({}, x, { ajustes: Object.assign({}, x.ajustes, { [P]: { 'aj-000000009': { n: 900, m: 'x', por: 'adm', at: 2 } } }) });
  const full = gana(d), c1 = X.hacerCierre(full, T0 + 12 * H), d1 = aplica(full, c1);
  const archivo = {};
  for (const [ruta, v] of c1.archivar) { const p = ruta.split('/'); let o = archivo; for (const k of p.slice(0, -1)) o = o[k] = o[k] || {}; o[p[p.length - 1]] = v; }
  const junto = Object.assign(X.conArchivo(d1, archivo), { completo: true });
  // hacia adelante: solo se mueve lo que sigue vivo, y cuadra contra lo que quedará
  const c2 = X.hacerCierre(junto, T0 + 35 * H);
  c2.archivar = X.enVivo(d1, c2.archivar);
  assert.ok(c2.archivar.length > 0 && c2.archivar.every(([r]) => !c1.archivar.some(([q]) => q === r)));
  assert.deepEqual(X.verificaCierre(junto, c2, d1), []);
  assert.deepEqual(saldos(aplica(d1, c2)), saldos(full));
  // hacia atrás: lo archivado entre los dos cierres faltaría, y la comprobación lo ve
  const c0 = X.hacerCierre(junto, T0 + 4 * H);
  c0.archivar = X.enVivo(d1, c0.archivar);
  assert.ok(c0.T < c1.T);
  assert.ok(X.verificaCierre(junto, c0, d1).length > 0);
});

test('un cierre de una versión que no se conoce no rompe nada', () => {
  const d = historia();
  assert.deepEqual(saldos(Object.assign({}, d, { cierre: { v: 2, T: T0, d: 'x' } })), saldos(d));
});
