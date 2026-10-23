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
  const ini = new Set(C.iniciales().map(C.invId));
  for (const b of ['m', 'f']) for (const k in C.INV_CATS) for (const it of C.ED_CAT[b][k] || []) {
    if (C.esNada(it[0])) continue;
    // de la cara y el pelo, lo inicial no sale en cajas
    if (C.INV_CATS[k].cara && ini.has(C.invId(C.invVar(b, k, { type: it[0] })))) { assert.ok(!vistos.has(b + ':' + k + ':' + it[0]), 'inicial en POOL: ' + it[0]); continue; }
    assert.ok(vistos.has(b + ':' + k + ':' + it[0]), 'falta en POOL (se agrega al final): ' + b + ':' + k + ':' + it[0]);
  }
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
      // un legendario de antes de CORTE_CAJAS_3 trae sus colores de fábrica
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

test('una pieza se vende en el mercado y la ve todo el mundo (solo un admin si vuelve a estar a prueba)', () => {
  const d = datos({ '-Ncaja0001': { at: T, p: 500, b: 'f' } });
  const c = 'rk:' + A + '~-Ncaja0001';
  if (!X.rocasDe(A, d).length) return;   // salió repetida de algo inicial: no hay copia que vender
  // la economía se recuerda por objeto (monedas.js): cada cambio, un objeto nuevo, como en la página
  d.mercado.o['-Nofrock001'] = { u: A, c, p: 700, at: T + 10 };
  let d2 = Object.assign({}, d);
  X.fijaVeRock(false);
  assert.equal(X.ROCK_SOLO_ADMIN, false, 'abierto a todos');
  assert.equal(X.ofertasMercado(d2, B, {}).length, 1, 'sin ser admin también se ve');
  assert.ok(X.juegosMercado().some(([k]) => k === 'rock'));
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
    for (const cat in C.INV_CATS) if (L[cat] && !C.INV_CATS[cat].cara) assert.deepEqual(V[cat], L[cat], k + ' ' + cat);
  }
});

test('la cara y el pelo salen en cajas: de partida solo lo del rockero por defecto (y «nada»)', () => {
  const ini = C.iniciales().filter(v => C.INV_CATS[v.k].cara).map(v => v.b + ':' + v.k + ':' + v.t).sort();
  assert.deepEqual(ini, ['f:eyeStyle:brillo', 'f:hair:longF', 'f:mkStyle:natural', 'f:tatDesign:estrellas', 'm:beard:stubble', 'm:eyeStyle:clasico', 'm:hair:long', 'm:tatDesign:calavera']);
  // un rockero con cosas que no tiene: vuelve a lo de partida, o a «nada» si la categoría lo admite
  const L = C.sanitizeLook(C.defaultLook('m'));
  Object.assign(L.face, { eyeStyle: 'rayo', mkStyle: 'corpse' }); L.hair.style = 'mohawk'; L.beard.type = 'goatee';
  L.tattoos = [{ design: 'calavera', spot: 'pecho', color: 0 }, { design: 'dragon', spot: 'espalda', color: 0 }];
  const V = C.lookPosible(JSON.parse(JSON.stringify(L)), []);
  assert.deepEqual([V.face.eyeStyle, V.face.mkStyle, V.hair.style, V.beard.type, V.tattoos.map(t => t.design)], ['clasico', 'ninguno', 'long', 'none', ['calavera']]);
  // con la pieza propia (de una caja) se queda
  const mias = [{ b: 'm', k: 'hair', t: 'mohawk', c: {} }, { b: 'm', k: 'eyeStyle', t: 'rayo', c: {} }, { b: 'm', k: 'tatDesign', t: 'dragon', c: {} }];
  const W = C.lookPosible(JSON.parse(JSON.stringify(L)), mias);
  assert.deepEqual([W.face.eyeStyle, W.hair.style, W.tattoos.length], ['rayo', 'mohawk', 2]);
});

test('las cajas de antes del corte traen lo mismo que cuando se abrieron', () => {
  assert.equal(C.POOL.slice(0, C.POOL_1).some(p => C.INV_CATS[p.k].cara), false);
  assert.ok(C.POOL.length > C.POOL_1);
  let cara = 0;
  for (let i = 0; i < 3000; i++) {
    const k = 'k' + String(i).padStart(9, '0'), b = i % 2 ? 'f' : 'm';
    const antes = X.cajaRock(A, k, C.CORTE_CAJAS_2 - 1 - i, b);
    assert.ok(!C.INV_CATS[antes.k].cara, 'antes del corte no hay cara ni pelo');
    if (C.INV_CATS[X.cajaRock(A, k, C.CORTE_CAJAS_2 + i, b).k].cara) cara++;
  }
  assert.ok(cara > 600, 'después del corte salen peinados, pupilas…: ' + cara);
});

test('la canción de verdad: descansos sin notas, el cursor y el humor del acierto', async () => {
  const { pathToFileURL } = require('node:url');
  const R = await import(pathToFileURL(path.join(__dirname, '../../juegos/hero/js/rock/ritmo.js')).href);
  // notas en 2 s, 3 s y 3.5 s (sostenida hasta 5 s), y después en 12 s
  const notas = [{ time: 2 }, { time: 3 }, { time: 3.5, endTime: 5 }, { time: 12 }];
  const d = R.descansos(notas, { min: 3, antes: 0.8, despues: 0.5, fin: 20 });
  assert.deepEqual(d, [[-Infinity, 1.2], [5.5, 11.2], [12.5, Infinity]]);
  const cur = { i: 0 };
  assert.equal(R.enDescanso(d, 0, cur), true, 'la entrada');
  assert.equal(R.enDescanso(d, 4, cur), false, 'tocando (el sostenido cuenta)');
  assert.equal(R.enDescanso(d, 8, cur), true, 'el hueco');
  assert.equal(R.enDescanso(d, 11.5, cur), false, 'se prepara antes de la siguiente');
  assert.equal(R.enDescanso(d, 15, cur), true, 'el final');
  assert.equal(R.enDescanso(d, 4, cur), false, 'y si la canción vuelve atrás, el cursor también');
  assert.deepEqual(R.descansos([], {}), [[-Infinity, Infinity]], 'sin notas, siempre descansa');
  // humor: 95 % o más es euforia, 72 % indiferencia, por debajo del 50 % el público se aburre
  const m = (pares) => pares.map(([t, h, f]) => ({ t, h, m: f }));
  assert.equal(R.humorDe(m([[0, 0, 0], [5, 40, 0]]), 5), 1);
  assert.ok(Math.abs(R.humorDe(m([[0, 0, 0], [5, 36, 14]]), 5)) < 0.01);
  assert.equal(R.humorDe(m([[0, 0, 0], [5, 10, 20]]), 5), -1);
  assert.equal(R.humorDe(m([[0, 0, 0], [5, 2, 1]]), 5), null, 'con muy pocas notas no dice nada');
  assert.equal(R.humorDe(m([[0, 0, 50], [3, 10, 50], [8, 40, 50]]), 8), 1, 'solo mira los últimos segundos');
});

test('desde CORTE_CAJAS_3 los legendarios salen con colores al azar; las cajas de antes no cambian', () => {
  let distintos = 0, legs = 0;
  for (let i = 0; i < 6000 && legs < 120; i++) {
    const b = i % 2 ? 'f' : 'm';
    // el mismo azar a un lado y otro del corte (la caja de verdad lo saca de la hora, que aquí es la que cambia)
    const azar = () => { let x = (i * 2654435761) >>> 0 || 1; return { entero: n => ((x = (x * 1103515245 + 12345) >>> 0) % n) }; };
    const antes = C.abreCaja(b, azar(), C.CORTE_CAJAS_3 - 1), despues = C.abreCaja(b, azar(), C.CORTE_CAJAS_3);
    assert.deepEqual([despues.k, despues.t, despues.leg], [antes.k, antes.t, antes.leg], 'la misma pieza');
    if (!antes.leg || !C.INV_CATS[antes.k].cols.length) continue;
    legs++;
    const fab = C.invItem(antes.b, antes.k, antes.t)[2];
    for (const [f, c] of Object.entries(fab)) if (C.INV_CATS[antes.k].cols.includes(f)) assert.equal(antes.c[f], c, 'antes, de fábrica');
    if (JSON.stringify(despues.c) !== JSON.stringify(antes.c)) distintos++;
  }
  assert.ok(legs > 30 && distintos > legs / 2, `legendarios con colores propios: ${distintos}/${legs}`);
});
