/* Los desafíos de plantilla (juegos/prodrop/retos.js) y sus premios en la
   economía (src/juegos/monedas.js, evento `pl`). Se compila con esbuild,
   como cierre.test.cjs, porque monedas.js importa los motores. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

const r = esbuild.buildSync({
  stdin: { contents: `export { economia, monedasDe } from './juegos/monedas.js';`, resolveDir: path.join(__dirname, '..', 'src'), loader: 'js' },
  bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node20', logLevel: 'silent'
});
const X = { exports: {} };
new Function('module', 'exports', 'require', r.outputFiles[0].text)(X, X.exports, require);
const { economia, monedasDe } = X.exports;
const PM = require('../../juegos/prodrop/motor.js');
const R = require('../../juegos/prodrop/retos.js');

const fut = PM.CARDS.filter(c => PM.esFutbol(c.col));
const todas = fut.map(c => ({ key: 'x' + c.n, id: c.n, g: 10, gr: true }));

test('cada club del álbum y cada reto se pueden completar con el catálogo', () => {
  assert.ok(R.CLUBES.length >= 15);
  assert.ok(!R.CLUBES.includes('bayern'), 'el Bayern solo tiene la especial de Kane');
  for (const club of R.CLUBES) assert.ok(R.evalua(R.claveClub(club), R.mejorOnce(R.claveClub(club), todas)).valida, club);
  // la mejor plantilla: cualquier club y país, siempre abierta, y su mejor once supera al de cualquier club
  const mejor = R.evalua('mejor', R.mejorOnce('mejor', todas));
  assert.ok(mejor.valida && R.vigente(R.plantilla('mejor'), 0));
  for (const club of R.CLUBES) assert.ok(mejor.puntaje >= R.evalua(R.claveClub(club), R.mejorOnce(R.claveClub(club), todas)).puntaje, club);
  R.RETOS.forEach((reto, i) => {
    const clave = 'reto-' + reto.id + '-' + (R.PRIMERA + i);
    assert.equal(R.plantilla(clave).id, reto.id);
    assert.ok(R.evalua(clave, R.mejorOnce(clave, todas)).valida, reto.id);
  });
});

test('la clave de un reto lleva su semana: otra semana no existe', () => {
  assert.equal(R.plantilla('reto-bleus-' + R.PRIMERA), null, 'la primera semana es de El Clásico');
  assert.equal(R.retoDeSemana(R.semanaDe(Date.UTC(2026, 9, 27, 12))).id, 'clasico', 'la semana del 26-10-2026 es El Clásico');
  assert.deepEqual([1, 2, 3].map(k => R.retoDeSemana(R.PRIMERA + k).id), ['bleus', 'lions', 'furia']);
  assert.equal(R.plantilla('club-bayern'), null);
  assert.equal(R.plantilla('club-nadie'), null);
  const p = R.plantilla(R.claveReto(42));
  assert.ok(R.vigente(p, R.inicioSemana(42)) && !R.vigente(p, R.finSemana(42)) && !R.vigente(p, R.inicioSemana(42) - 1));
  assert.ok(R.vigente(R.plantilla('club-psg'), 0), 'un club vale siempre');
});

test('el puntaje: un punto de media son 10 puntos, la nota escala y sin graduar es ×0,80', () => {
  const clave = 'club-realmadrid', base = R.mejorOnce(clave, todas);
  const mvp = fut.find(c => c.uid === 'realmadrid-mbappe-mvp-legend'), mb = fut.find(c => c.uid === 'realmadrid-mbappe-legend');
  const i = base.findIndex(f => f && PM.CARDS[f.id].person === 'realmadrid-mbappe');
  assert.ok(i >= 0, 'Mbappé entra en el mejor once del Madrid');
  const con = id => base.map((f, j) => (j === i ? { id, g: 10, gr: true } : f));
  assert.equal(R.evalua(clave, con(mvp.n)).puntaje - R.evalua(clave, con(mb.n)).puntaje, 10);
  assert.equal(R.puntosFicha({ id: mb.n, g: 6, gr: true }), 91 * 0.92);
  assert.equal(R.puntosFicha({ id: mb.n, g: 10, gr: false }), 91 * 0.8, 'la nota oculta no cuenta');
  // Mbappé y su especial son el mismo jugador
  const dos = base.slice(); dos[i] = { id: mb.n, g: 10, gr: true };
  const otra = dos.findIndex((f, j) => j !== i && f && PM.CARDS[f.id].pos === 'DEL');
  dos[otra] = { id: mvp.n, g: 10, gr: true };
  assert.equal(R.evalua(clave, dos).valida, false);
});

test('fuera de su puesto resta 3 de media, y un defensa no juega de delantero', () => {
  const dc = R.mejorOnce('club-realmadrid', todas);
  const i = PM.FORMACION.findIndex(s => s.pos === 'DC'), por = PM.FORMACION.findIndex(s => s.pos === 'POR');
  const cambio = dc.slice(); [cambio[i], cambio[por]] = [cambio[por], cambio[i]];
  assert.equal(R.evalua('club-realmadrid', cambio).valida, false, 'un portero de delantero');
  assert.equal(R.encaje(i, fut.find(c => c.uid === 'realmadrid-mbappe-legend').n).nivel, 0);
});

/* Una cuenta que abre sobres gratis (uno cada 7 h) hasta poder armar un
   once válido de algún club con cartas de nota oculta 6 o más (para que el
   premio 2 se pueda cobrar al graduarlas), y cobra sus premios. */
const A = 'cuentaAAA1', B = 'cuentaBBB2', T0 = Date.UTC(2026, 9, 26, 12), H = 3600000;
function historia() {
  const s = {}, copias = [];
  let elegido = null;
  for (let n = 0; n < 800 && !elegido; n++) {
    const k = 'g' + String(n).padStart(9, '0'), at = T0 + n * 7 * H;
    s[k] = { at, p: 0 };
    PM.sobre(A, k, at).cartas.forEach((c, i) => copias.push({ key: `${A}~${k}.${i}`, id: c.id, g: c.g, gr: false }));
    if (n % 20) continue;
    for (const club of R.CLUBES) {
      const once = R.mejorOnce(R.claveClub(club), copias.filter(x => x.g >= 6));
      if (R.evalua(R.claveClub(club), once).valida) { elegido = { clave: R.claveClub(club), once, fin: at }; break; }
    }
  }
  assert.ok(elegido, 'en 800 sobres sale algún club completo');
  return { s, elegido };
}
const { s: SOBRES, elegido: EL } = historia();
const datos = (extra = {}) => Object.assign({ cartas: { s: { [A]: SOBRES } } }, extra);

test('el premio 1 paga 50 y un sobre si las once son de quien cobra', () => {
  const at = EL.fin + H, c = EL.once.map(f => f.key), k = 'gPremio0000';
  const d = datos({ plantillas: { p: { [A]: { [EL.clave + '_1']: { at, c, k } } } } });
  d.cartas.s[A] = Object.assign({}, SOBRES, { [k]: { at, p: 0, pl: EL.clave + '_1' } });
  assert.equal(monedasDe(A, d).premios, 50);
  assert.ok(economia(d).sobres[A + '~' + k], 'su sobre existe');
  // un premio 1 que trae un sobre Plus no vale
  const dp = datos({ plantillas: { p: { [A]: { [EL.clave + '_1']: { at, c, k: 'hPremio0000' } } } } });
  assert.equal(monedasDe(A, dp).premios, 0);
  // las mismas once, cobradas por otra cuenta: nada
  const d2 = datos({ plantillas: { p: { [B]: { [EL.clave + '_1']: { at, c, k } } } } });
  assert.equal(monedasDe(B, d2).premios, 0);
  // antes de tenerlas: nada
  const d3 = datos({ plantillas: { p: { [A]: { [EL.clave + '_1']: { at: T0 - H, c, k } } } } });
  assert.equal(monedasDe(A, d3).premios, 0);
});

test('el premio 2 pide las once graduadas: sin eso no paga ni vale su sobre', () => {
  const at = EL.fin + H, c = EL.once.map(f => f.key), k = 'gPremio0001';
  const d = datos({ plantillas: { p: { [A]: { [EL.clave + '_2']: { at, c, k, k2: 'gPremio0011' } } } } });
  d.cartas.s[A] = Object.assign({}, SOBRES, { [k]: { at, p: 0, pl: EL.clave + '_2' }, gPremio0011: { at, p: 0, pl: EL.clave + '_2' } });
  const e = economia(d);
  assert.equal(monedasDe(A, d).premios, 0);
  assert.equal(e.sobres[A + '~' + k], undefined, 'el sobre de un premio que no valió no existe');
});

test('un sobre con `pl` sin su premio no vale, ni un reto fuera de su semana', () => {
  const at = EL.fin + H, c = EL.once.map(f => f.key);
  const d = datos();
  d.cartas.s[A] = Object.assign({}, SOBRES, { gSuelto0001: { at, p: 0, pl: EL.clave + '_2' } });
  assert.equal(economia(d).sobres[A + '~gSuelto0001'], undefined);
  // un reto fuera de su semana tampoco paga
  const n = R.semanaDe(at), clave = R.claveReto(n - 1);
  const d2 = datos({ plantillas: { p: { [A]: { [clave + '_1']: { at, c } } } } });
  assert.equal(monedasDe(A, d2).premios, 0);
});

test('graduadas con nota 6 o más: el premio 2 paga 100 y sus dos sobres entran, una sola vez', () => {
  const at = EL.fin + 2 * H, c = EL.once.map(f => f.key), k = 'gPremio0002', k2 = 'gPremio0003';
  // se gradúan las once (100 cada una, pagadas con un ajuste del admin)
  const g = {};
  EL.once.forEach((f, i) => { const [, kk, ii] = /~(.+)\.(\d)$/.exec(f.key); (g[kk] = g[kk] || {})[ii] = { at: EL.fin + H + i, p: 100 }; });
  const d = datos({ ajustes: { [A]: { x: { n: 5000 } } }, plantillas: { p: { [A]: { [EL.clave + '_2']: { at, c, k, k2 } } } } });
  d.cartas.g = { [A]: g };
  d.cartas.s[A] = Object.assign({}, SOBRES, { [k]: { at, p: 0, pl: EL.clave + '_2' }, [k2]: { at, p: 0, pl: EL.clave + '_2' }, gOtra00001: { at: at + 1, p: 0, pl: EL.clave + '_2' } });
  const e = economia(d);
  assert.equal(monedasDe(A, d).premios, 100);
  assert.ok(e.sobres[A + '~' + k] && e.sobres[A + '~' + k2], 'los dos sobres del premio existen');
  // con un solo sobre en el reclamo, el premio 2 no vale
  const d1 = datos({ ajustes: { [A]: { x: { n: 5000 } } }, plantillas: { p: { [A]: { [EL.clave + '_2']: { at, c, k } } } } });
  d1.cartas.g = { [A]: g };
  assert.equal(monedasDe(A, d1).premios, 0);
  for (let i = 0; i < 5; i++) assert.equal(e.dueno[`${A}~${k}.${i}`], A);
  assert.equal(e.sobres[A + '~gOtra00001'], undefined, 'un segundo sobre del mismo premio no vale');
});
