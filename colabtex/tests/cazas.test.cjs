/* Las cacerías de récords (src/juegos/cazas.js y su paso por monedas.js):
   la custodia, el reparto, que gana el primer reclamo que vale, que una sin
   fondos no vale, y que el cierre de la economía las conserva abiertas. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

const r = esbuild.buildSync({
  stdin: { contents: `export * from './juegos/cazas.js'; export * from './juegos/cierre.js'; export { economia, monedasDe } from './juegos/monedas.js';`, resolveDir: path.join(__dirname, '..', 'src'), loader: 'js' },
  bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node20', logLevel: 'silent'
});
const M = { exports: {} };
new Function('module', 'exports', 'require', r.outputFiles[0].text)(M, M.exports, require);
const X = M.exports;

const T0 = Date.parse('2026-11-01T12:00:00Z'), H = 3600000;
const JLO = 'jloRecord01', PIA = 'piaCazadora2', ZE = 'zeRetador03', CAT = 'club-tetris-maraton';
const fila = (puntos, tiempo, at) => ({ nombre: 'x', puntos, tiempo, partida: 'p' + at, at });
/* Cada uno parte con monedas puestas a mano por un administrador. */
const base = extra => Object.assign({
  completo: true,
  ajustes: { [JLO]: { a: { n: 20000 } }, [PIA]: { a: { n: 20000 } }, [ZE]: { a: { n: 1000 } } },
  solo: { [CAT]: { [JLO]: fila(1000, 50000, 1), [ZE]: fila(400, 9000, 2) } },
  cazas: { b: {}, g: {} }
}, extra);
const caza = (u, p, at, q = JLO, mp = 1000, mt = 50000) => ({ u, c: CAT, q, p, mp, mt, at });
/* `economia()` memoriza por objeto (en la página cada lectura llega en uno
   nuevo): cada cálculo va sobre una copia. Cada récord del club ya paga 50. */
const saldo = (d, u) => X.monedasDe(u, Object.assign({}, d)).saldo - 50 * Object.values(d.solo).filter(t => t[u]).length;
const eco = d => X.economia(Object.assign({}, d));

test('el reparto: otro se lo lleva todo, el dueño se queda la mitad, lo propio vuelve', () => {
  const b = caza(PIA, 10001, T0);
  assert.deepEqual(X.reparto(b, ZE), [{ u: ZE, p: 10001 }]);
  assert.deepEqual(X.reparto(b, JLO), [{ u: JLO, p: 5000 }, { u: PIA, p: 5001 }]);
  assert.deepEqual(X.reparto(caza(JLO, 800, T0), JLO), [{ u: JLO, p: 800 }]);
  assert.equal(X.supera({ puntos: 1000, tiempo: 49999 }, b), true);
  assert.equal(X.supera({ puntos: 1000, tiempo: 50000 }, b), false);
  assert.equal(X.supera({ puntos: 999, tiempo: 1 }, b), false);
  assert.equal(X.nivelCaza(500).n, 1);
  assert.equal(X.nivelCaza(10000).n, 3);
  assert.equal(X.nivelCaza(250000).n, 5);
});

test('las monedas quedan en custodia y se las lleva quien supera el récord', () => {
  const d = base();
  d.cazas.b.k1 = caza(PIA, 10000, T0);
  assert.equal(saldo(d, PIA), 10000, 'se descuenta al publicar');
  const ab = X.cazasAbiertas(d, eco(d));
  assert.equal(ab.length, 1);
  assert.equal(ab[0].pozo, 10000);
  // Ze supera la marca y reclama
  const d2 = base({ cazas: { b: d.cazas.b, g: { k1: { [ZE]: { at: T0 + H } } } } });
  d2.solo[CAT][ZE] = fila(1200, 60000, 3);
  assert.equal(saldo(d2, ZE), 11000);
  assert.equal(saldo(d2, PIA), 10000, 'no vuelve nada');
  assert.equal(eco(d2).cazas.k1.estado, 'cobrada');
  assert.equal(X.cazasAbiertas(d2, eco(d2)).length, 0);
  // la pestaña de Ze ya no la reclama otra vez
  assert.deepEqual(X.porReclamar(d2, eco(d2), ZE), []);
});

test('si el dueño se supera, mitad y mitad; si era su propia cacería, le vuelve todo', () => {
  const d = base();
  d.cazas.b.k1 = caza(PIA, 10000, T0);
  d.cazas.b.k2 = caza(JLO, 2000, T0 + 1);
  d.solo[CAT][JLO] = fila(1500, 40000, 9);
  assert.deepEqual(X.porReclamar(d, eco(d), JLO).sort(), ['k1', 'k2']);
  d.cazas.g = { k1: { [JLO]: { at: T0 + H } }, k2: { [JLO]: { at: T0 + H } } };
  assert.equal(saldo(d, JLO), 25000);
  assert.equal(saldo(d, PIA), 15000);
  const e = eco(d);
  assert.equal(e.cazas.k1.estado, 'defendida');
  assert.equal(e.cazas.k2.estado, 'propia');
});

test('gana el primer reclamo que vale; uno de un récord borrado no cuenta', () => {
  const d = base();
  d.cazas.b.k1 = caza(PIA, 4000, T0);
  // Ze reclamó primero pero su fila ya no supera (un admin la borró); luego Pía
  d.cazas.g = { k1: { [ZE]: { at: T0 + H }, [JLO]: { at: T0 + 2 * H } } };
  d.solo[CAT][JLO] = fila(1001, 1, 9);
  const e = eco(d);
  assert.equal(e.cazas.k1.estado, 'defendida');
  assert.equal(e.cazas.k1.w, JLO);
  assert.equal(saldo(d, ZE), 1000);
});

test('una cacería sin fondos no vale y no abre pozo', () => {
  const d = base();
  d.cazas.b.k1 = caza(ZE, 5000, T0);   // Ze tiene 1000
  assert.equal(X.cazasAbiertas(d, eco(d)).length, 0);
  assert.equal(X.monedasDe(ZE, Object.assign({}, d)).parada, true);
});

test('si el récord desaparece, vuelve todo a quien la puso', () => {
  const d = base();
  d.cazas.b.k1 = caza(PIA, 3000, T0);
  delete d.solo[CAT][JLO];
  assert.deepEqual(X.porReclamar(d, eco(d), PIA), ['k1']);
  d.cazas.g = { k1: { [PIA]: { at: T0 + H } } };
  assert.equal(saldo(d, PIA), 20000);
  assert.equal(eco(d).cazas.k1.estado, 'anulada');
});

test('varios aportes al mismo récord hacen un solo pozo, y suben de nivel', () => {
  const d = base();
  d.cazas.b.k1 = caza(PIA, 6000, T0);
  d.cazas.b.k2 = caza(JLO, 5000, T0 + 5);
  const ab = X.cazasAbiertas(d, eco(d));
  assert.equal(ab.length, 1);
  assert.equal(ab[0].pozo, 11000);
  assert.equal(ab[0].n, 2);
  assert.equal(ab[0].nivel.id, 'gran');
  const av = X.avisosCaza(d, eco(d), T0 + 10 * 60000);
  assert.equal(av.filter(a => a.tipo === 'pone').length, 2);
  // pasado el aviso de su nivel, ya no sale en el chat
  assert.equal(X.avisosCaza(d, eco(d), T0 + 25 * H).length, 0);
});

test('el cierre de la economía conserva las cacerías abiertas', () => {
  const d = base();
  d.cazas.b.k1 = caza(PIA, 10000, T0);
  const c = X.hacerCierre(d, T0 + 2 * H);
  assert.ok(!c.nada, c.motivo);
  assert.deepEqual(X.verificaCierre(d, c), []);
  let d2 = Object.assign(X.sinRutas(d, c.archivar), { cierre: c.nodo });
  assert.equal(eco(d2).cazas.k1.estado, 'abierta');
  // y se cobra después del cierre igual que sin él
  const d1 = Object.assign({}, d); d2 = Object.assign({}, d2);
  for (const x of [d1, d2]) { x.cazas = { b: d.cazas.b, g: { k1: { [ZE]: { at: T0 + 3 * H } } } }; x.solo = JSON.parse(JSON.stringify(d.solo)); x.solo[CAT][ZE] = fila(2000, 1, 3); }
  assert.equal(saldo(d2, ZE), saldo(d1, ZE));
  assert.equal(saldo(d2, ZE), 11000);
});

test('la regla pide la marca de la tabla y deja reclamar solo a quien la supera', () => {
  const reglas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'firebase', 'database.rules.json'), 'utf8')).rules.cazas;
  const b = reglas.b.$id, g = reglas.g.$id.$uid;
  assert.match(b['.write'], /!data\.exists\(\)/);
  assert.match(b['.validate'], /child\('puntos'\)\.val\(\) === newData\.child\('mp'\)/);
  assert.match(b.p['.validate'], new RegExp('>= ' + X.CAZA_MIN + ' '));
  assert.match(b.p['.validate'], new RegExp('<= ' + X.CAZA_MAX));
  assert.match(g['.write'], /auth\.uid === \$uid && !data\.exists\(\)/);
  assert.match(g['.validate'], /child\('puntos'\)\.val\(\) >/);
});
