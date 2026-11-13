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
  assert.ok(R.CLUBES.includes('bayern'), 'el Bayern ya tiene plantel');
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
  assert.deepEqual([1, 2, 3, 4].map(k => R.retoDeSemana(R.PRIMERA + k).id), ['laroja', 'bleus', 'lions', 'furia'], 'La Roja va la semana 43');
  assert.equal(R.plantilla('club-bayern').club, 'bayern');
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
  // el premio 1 ya no da el marco del club: lo da el 3 (once con nota 8 o más)
  assert.deepEqual(economia(d).usuarios[A].desafios, {});
  // un premio 1 que trae un sobre Plus no vale
  const dp = datos({ plantillas: { p: { [A]: { [EL.clave + '_1']: { at, c, k: 'hPremio0000' } } } } });
  assert.equal(monedasDe(A, dp).premios, 0);
  // las mismas once, cobradas por otra cuenta: nada
  const d2 = datos({ plantillas: { p: { [B]: { [EL.clave + '_1']: { at, c, k } } } } });
  assert.equal(monedasDe(B, d2).premios, 0);
  assert.deepEqual((economia(d2).usuarios[B] || {}).desafios || {}, {}, 'sin premio no hay marco');
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
  assert.equal(monedasDe(A, d).premios, 300);
  assert.ok(e.sobres[A + '~' + k] && e.sobres[A + '~' + k2], 'los dos sobres del premio existen');
  // con un solo sobre en el reclamo, el premio 2 no vale
  const d1 = datos({ ajustes: { [A]: { x: { n: 5000 } } }, plantillas: { p: { [A]: { [EL.clave + '_2']: { at, c, k } } } } });
  d1.cartas.g = { [A]: g };
  assert.equal(monedasDe(A, d1).premios, 0);
  for (let i = 0; i < 5; i++) assert.equal(e.dueno[`${A}~${k}.${i}`], A);
  assert.equal(e.sobres[A + '~gOtra00001'], undefined, 'un segundo sobre del mismo premio no vale');
  // la forma de ahora: un solo sobre Plus
  const d4 = datos({ ajustes: { [A]: { x: { n: 5000 } } }, plantillas: { p: { [A]: { [EL.clave + '_2']: { at, c, k: 'hPremio0004' } } } } });
  d4.cartas.g = { [A]: g };
  d4.cartas.s[A] = Object.assign({}, SOBRES, { hPremio0004: { at, p: 0, pl: EL.clave + '_2' } });
  assert.equal(monedasDe(A, d4).premios, 300);
  assert.ok(economia(d4).sobres[A + '~hPremio0004'], 'su sobre Plus existe');
});

test('premio 3 (once con nota 8 o más): 1000, dos sobres Plus y el marco del club', () => {
  const D = 'cuentaDDD4', s = {}, copias = [];
  let el = null;
  for (let n = 0; n < 3000 && !el; n++) {
    const k = 'g' + String(n).padStart(9, '0'), at = T0 + n * 7 * H;
    s[k] = { at, p: 0 };
    PM.sobre(D, k, at).cartas.forEach((c, i) => copias.push({ key: `${D}~${k}.${i}`, id: c.id, g: c.g, gr: false }));
    if (n % 20) continue;
    for (const club of R.CLUBES) {
      const once = R.mejorOnce(R.claveClub(club), copias.filter(x => x.g >= 8));
      if (R.evalua(R.claveClub(club), once).valida) { el = { clave: R.claveClub(club), once, fin: at }; break; }
    }
  }
  assert.ok(el, 'sale algún club con once de nota 8 o más');
  const at = el.fin + 2 * H, c = el.once.map(f => f.key), g = {};
  el.once.forEach((f, i) => { const [, kk, ii] = /~(.+)\.(\d)$/.exec(f.key); (g[kk] = g[kk] || {})[ii] = { at: el.fin + H + i, p: 100 }; });
  const con = (ks, extra = {}) => {
    const d = { ajustes: { [D]: { x: { n: 5000 } } }, cartas: { s: { [D]: Object.assign({}, s) }, g: { [D]: g } }, plantillas: { p: { [D]: { [el.clave + '_3']: Object.assign({ at, c, k: ks[0] }, ks[1] ? { k2: ks[1] } : {}) } } } };
    ks.forEach(k => { d.cartas.s[D][k] = { at, p: 0, pl: el.clave + '_3' }; });
    return Object.assign(d, extra);
  };
  const d = con(['hPremio0010', 'hPremio0011']), e = economia(d);
  assert.equal(monedasDe(D, d).premios, 1000);
  assert.ok(e.sobres[D + '~hPremio0010'] && e.sobres[D + '~hPremio0011'], 'sus dos sobres Plus existen');
  assert.deepEqual(e.usuarios[D].desafios, { [el.clave.slice(5)]: at }, 'y el marco del club');
  assert.equal(monedasDe(D, con(['hPremio0012'])).premios, 1000, 'un reclamo de antes (un solo Plus) sigue valiendo');
  assert.equal(monedasDe(D, con(['hPremio0013', 'gPremio0014'])).premios, 0, 'un Plus y un normal no');
});

/* ---------- el podio de cada semana ----------
   Tres cuentas que arman el Real Madrid y El Clásico (el reto de la semana
   42) con sobres pagados (un ajuste del admin les da monedas), todos
   dentro de esa semana. El lunes (fin de la semana 42) la economía mira las
   tablas como estaban justo antes. */
const SEM = R.PRIMERA, FIN = R.finSemana(SEM), CLUB = R.claveClub('realmadrid'), RETO = R.claveReto(SEM);
function armaCuenta(uid, salto) {
  const s = {}, copias = [];
  for (let n = 0; n < 4000; n++) {
    const k = 'g' + uid.slice(-1) + String(n).padStart(8, '0'), at = T0 + salto + n * 60000;
    s[k] = { at, p: 80 };
    PM.sobre(uid, k, at).cartas.forEach((c, i) => copias.push({ key: `${uid}~${k}.${i}`, id: c.id, g: c.g, gr: false }));
    if (n % 25) continue;
    const club = R.mejorOnce(CLUB, copias), reto = R.mejorOnce(RETO, copias);
    if (R.evalua(CLUB, club).valida && R.evalua(RETO, reto).valida) return { s, club: club.map(f => f.key), reto: reto.map(f => f.key), pts: { club: R.evalua(CLUB, club).puntaje, reto: R.evalua(RETO, reto).puntaje } };
  }
  throw new Error('no se armó ' + uid);
}
const C3 = 'cuentaCCC3', TRES = [A, B, C3], ARM = Object.fromEntries(TRES.map((u, i) => [u, armaCuenta(u, i * 7)]));
const conAhora = (ms, f) => { const ahora = Date.now; Date.now = () => ms; try { return f(); } finally { Date.now = ahora; } };
function datosPodio(clave, subidas, extra = {}) {
  const v = { [clave]: {} };
  for (const [u, at] of Object.entries(subidas)) v[clave][u] = { ['v' + u.slice(-1) + 'Subida01']: { at, c: clave === CLUB ? ARM[u].club : ARM[u].reto } };
  return Object.assign({
    cartas: { s: Object.fromEntries(TRES.map(u => [u, ARM[u].s])) },
    ajustes: Object.fromEntries(TRES.map(u => [u, { x: { n: 1e6 } }])),
    plantillas: { v }
  }, extra);
}
const orden = clave => TRES.slice().sort((a, b) => ARM[b].pts[clave === CLUB ? 'club' : 'reto'] - ARM[a].pts[clave === CLUB ? 'club' : 'reto'] || 0);

test('podio semanal de un club: el lunes paga 300, 200 y 100 con lo subido justo antes', () => {
  const antes = FIN - H, d = datosPodio(CLUB, { [A]: antes, [B]: antes + 1, [C3]: antes + 2 });
  const [p1, p2, p3] = orden(CLUB);
  const e = conAhora(FIN + H, () => economia(d));
  assert.deepEqual(e.podiosSemana[SEM][CLUB], [p1, p2, p3]);
  assert.deepEqual([p1, p2, p3].map(u => e.usuarios[u].premios), [300, 200, 100]);
  // antes del lunes no paga nada
  assert.ok(conAhora(FIN - 1, () => TRES.every(u => (economia(datosPodio(CLUB, { [A]: antes, [B]: antes + 1, [C3]: antes + 2 })).usuarios[u] || {}).premios === 0)));
  // lo subido después del lunes no cuenta para esa semana: con dos en la tabla, solo 1.º y 2.º
  const d2 = datosPodio(CLUB, { [A]: antes, [B]: antes + 1, [C3]: FIN + 5 });
  const dos = [A, B].sort((x, y) => ARM[y].pts.club - ARM[x].pts.club);
  const e2 = conAhora(FIN + H, () => economia(d2));
  assert.deepEqual(e2.podiosSemana[SEM][CLUB], dos);
  assert.deepEqual(dos.map(u => e2.usuarios[u].premios), [300, 200]);
  assert.equal((e2.usuarios[C3] || {}).premios || 0, 0);
  // el lunes siguiente sí cuenta (y se paga otra vez)
  const e3 = conAhora(R.finSemana(SEM + 1) + H, () => economia(Object.assign({}, d2)));   // otro objeto: economia() guarda el resultado por objeto
  assert.deepEqual(e3.podiosSemana[SEM + 1][CLUB], [p1, p2, p3]);
  assert.equal(e3.usuarios[p1].premios, 300 + (dos[0] === p1 ? 300 : dos[1] === p1 ? 200 : 0));
});

test('podio con una sola persona en la tabla: el 1.º cobra igual', () => {
  const d = datosPodio(CLUB, { [A]: FIN - H }), e = conAhora(FIN + H, () => economia(d));
  assert.deepEqual(e.podiosSemana[SEM][CLUB], [A]);
  assert.equal(e.usuarios[A].premios, 300);
  const dr = datosPodio(RETO, { [B]: FIN - H }), er = conAhora(FIN + H, () => economia(dr));
  assert.equal(er.usuarios[B].premios, 1500);
  assert.equal(er.usuarios[B].podiosReto[RETO], 1, 'y puede cobrar los sobres del 1.º');
});

test('podio del reto: 1500, 1000 y 500, y los sobres se cobran una vez, según el puesto', () => {
  const antes = FIN - H, [p1, p2, p3] = orden(RETO), at = FIN + 2 * H;
  const reclamo = (u, n, ks) => ({ [R.clavePodio(RETO, n)]: Object.assign({ at, k: ks[0] }, ks[1] ? { k2: ks[1] } : {}, ks[2] ? { k3: ks[2] } : {}) });
  const sobres = (u, n, ks) => Object.fromEntries(ks.map(k => [k, { at, p: 0, pl: R.clavePodio(RETO, n) }]));
  const d = datosPodio(RETO, { [A]: antes, [B]: antes + 1, [C3]: antes + 2 }, {});
  d.plantillas.q = { [p1]: reclamo(p1, 1, ['hPodio00001', 'hPodio00002', 'hPodio00003']), [p2]: reclamo(p2, 1, ['hPodio00004', 'hPodio00005', 'hPodio00006']), [p3]: reclamo(p3, 3, ['gPodio00007']) };
  Object.assign(d.cartas.s[p1] = Object.assign({}, d.cartas.s[p1]), sobres(p1, 1, ['hPodio00001', 'hPodio00002', 'hPodio00003']));
  Object.assign(d.cartas.s[p2] = Object.assign({}, d.cartas.s[p2]), sobres(p2, 1, ['hPodio00004', 'hPodio00005', 'hPodio00006']));
  Object.assign(d.cartas.s[p3] = Object.assign({}, d.cartas.s[p3]), sobres(p3, 3, ['gPodio00007']));
  const e = conAhora(at + H, () => economia(d));
  assert.deepEqual([p1, p2, p3].map(u => e.usuarios[u].premios), [1500, 1000, 500]);
  assert.deepEqual([p1, p2, p3].map(u => e.usuarios[u].podiosReto[RETO]), [1, 2, 3]);
  assert.ok(['hPodio00001', 'hPodio00002', 'hPodio00003'].every(k => e.sobres[p1 + '~' + k]), 'el 1.º recibe sus tres Plus');
  assert.ok(['hPodio00004', 'hPodio00005', 'hPodio00006'].every(k => !e.sobres[p2 + '~' + k]), 'el 2.º no puede cobrar como 1.º');
  assert.ok(e.sobres[p3 + '~gPodio00007'], 'el 3.º recibe su sobre');
});

test('álbum completo de un club: con una copia de cada jugador paga 2000 y dos sobres Plus, una vez', () => {
  const E = 'cuentaEEE5', s = {}, porId = {}, faltan = new Set(R.cartasAlbum('roma').map(c => c.n));
  let at = T0;
  for (let n = 0; n < 3000 && faltan.size; n++) {
    const k = 'g' + String(n).padStart(9, '0');
    at = T0 + n * 60000; s[k] = { at, p: 80 };
    PM.sobre(E, k, at).cartas.forEach((c, i) => { faltan.delete(c.id); porId[c.id] = porId[c.id] || `${E}~${k}.${i}`; });
  }
  assert.equal(faltan.size, 0, 'se juntó la Roma entera');
  const c = R.cartasAlbum('roma').map(cd => porId[cd.n]), cuando = at + H, id = R.claveAlbum('roma');
  const con = (lista, ks = ['hAlbum00001', 'hAlbum00009'], u = E) => {
    const d = { ajustes: { [E]: { x: { n: 1e6 } } }, cartas: { s: { [E]: Object.assign({}, s) } }, plantillas: { a: { [u]: { [id]: Object.assign({ at: cuando, c: lista, k: ks[0] }, ks[1] ? { k2: ks[1] } : {}, ks[2] ? { k3: ks[2] } : {}) } } } };
    if (u !== E) d.cartas.s[u] = {};
    ks.forEach(k => { d.cartas.s[u][k] = { at: cuando, p: 0, pl: id }; });
    return d;
  };
  const d = con(c), e = economia(d);
  assert.equal(monedasDe(E, d).premios, 2000);
  assert.equal(e.usuarios[E].albumes.roma, cuando);
  assert.ok(e.sobres[E + '~hAlbum00001'] && e.sobres[E + '~hAlbum00009'], 'sus dos sobres Plus existen');
  // desde el 4-11-2026 son tres Plus; los reclamos de dos (de antes) siguen valiendo
  const e3 = economia(con(c, ['hAlbum00011', 'hAlbum00012', 'hAlbum00013']));
  assert.equal(e3.usuarios[E].premios, 2000);
  assert.ok(['hAlbum00011', 'hAlbum00012', 'hAlbum00013'].every(k => e3.sobres[E + '~' + k]), 'sus tres sobres Plus existen');
  assert.equal(monedasDe(E, con(c, ['hAlbum00014', 'hAlbum00015', 'gAlbum00016'])).premios, 0, 'con un normal entre los tres no');
  assert.equal(monedasDe(E, con(c, ['hAlbum00008'])).premios, 0, 'con un solo Plus no');
  assert.equal(monedasDe(E, con(c.slice(1))).premios, 0, 'faltando una carta no paga');
  assert.equal(monedasDe(E, con(c, ['hAlbum00002', 'gAlbum00002'])).premios, 0, 'con un sobre normal no');
  assert.equal(monedasDe('cuentaFFF6', con(c, ['hAlbum00003', 'hAlbum00004'], 'cuentaFFF6')).premios, 0, 'con cartas de otro no');
  assert.equal(R.leeAlbum('album-nadie'), null);
  assert.ok(R.cartasAlbum('realmadrid').every(cd => !cd.especial), 'el álbum son las cartas normales');
  // se cuentan jugadores: la especial cubre el hueco de su carta normal
  const mvp = PM.CARDS.find(cd => cd.especial === 'clasico'), balon = PM.CARDS.find(cd => cd.especial === 'balon');
  assert.equal(R.huecoAlbum('realmadrid', mvp.n).uid, PM.CARDS.find(cd => cd.person === mvp.person && !cd.especial).uid);
  assert.equal(R.huecoAlbum('bayern', balon.n).person, 'bayern-harry-kane');
  assert.equal(R.huecoAlbum('barcelona', mvp.n), null, 'en otro club no cuenta');
});

test('álbum con nota: cada jugador graduado con 6 o más paga 5000, con 10 paga 25000, sin sobres y una vez', () => {
  const E = 'cuentaGGG7', s = {}, grad = {}, mejor = {};
  const club = 'roma', jugadores = R.cartasAlbum(club);
  // se junta la Roma y se gradúa, de cada jugador, la copia de mejor nota
  for (let n = 0; n < 40000 && jugadores.some(cd => !mejor[cd.n] || mejor[cd.n].g < 10); n++) {
    const k = 'g' + String(n).padStart(9, '0'), at = T0 + n * 60000;
    s[k] = { at, p: 80 };
    PM.sobre(E, k, at).cartas.forEach((cd, i) => { const h = R.huecoAlbum(club, cd.id); if (h && (!mejor[h.n] || cd.g > mejor[h.n].g)) mejor[h.n] = { g: cd.g, k, i, c: `${E}~${k}.${i}` }; });
  }
  const fin = T0 + 40000 * 60000, cuando = fin + 2 * H, g = {};
  // graduar cada una (cartas/g/<uid>/<sobre>/<i>), después del último sobre y antes del reclamo
  jugadores.forEach((cd, j) => { const m = mejor[cd.n]; (g[m.k] || (g[m.k] = {}))[m.i] = { at: fin + j * 1000, p: 100 }; grad[cd.n] = m; });
  const c = jugadores.map(cd => grad[cd.n].c), min = Math.min(...jugadores.map(cd => grad[cd.n].g));
  assert.equal(min, 10, 'se juntó la Roma entera con nota 10');
  const con = (id, lista, extra = {}, gs = g) => ({ ajustes: { [E]: { x: { n: 1e7 } } }, cartas: { s: { [E]: s }, g: { [E]: gs } }, plantillas: { a: { [E]: { [id]: Object.assign({ at: cuando, c: lista }, extra) } } } });
  assert.equal(R.leeAlbum('album6-roma'), null, 'no es el álbum normal');
  assert.deepEqual(R.leeAlbumNota('album10-roma'), { club: 'roma', nota: 10 });
  assert.equal(monedasDe(E, con(R.claveAlbum(club, 6), c)).premios, 5000);
  assert.equal(monedasDe(E, con(R.claveAlbum(club, 10), c)).premios, min === 10 ? 25000 : 0, 'el de 10 pide todas con 10');
  assert.equal(monedasDe(E, con(R.claveAlbum(club, 6), c.slice(1))).premios, 0, 'faltando uno no paga');
  assert.equal(monedasDe(E, con(R.claveAlbum(club, 6), c, { k: 'hAlbum00020' })).premios, 0, 'no trae sobres');
  assert.equal(monedasDe(E, con('album7-roma', c)).premios, 0, 'solo las notas que existen');
  // sin graduar no cuenta, aunque la carta tenga la nota
  assert.equal(monedasDe(E, con(R.claveAlbum(club, 6), c, {}, {})).premios, 0, 'tienen que estar graduadas');
});

test('las leyendas (sin club) juegan los desafíos: un once solo de leyendas es válido, y La Roja acepta a las chilenas', () => {
  const ley = PM.CARDS.filter(c => c.leyenda).map(c => ({ key: 'x' + c.n, id: c.n, g: 10, gr: true }));
  const once = R.mejorOnce(R.MEJOR.clave, ley);
  assert.ok(R.evalua(R.MEJOR.clave, once).valida, 'se arma un once de leyendas en el 4-3-3');
  assert.equal(new Set(once.map(f => PM.CARDS[f.id].person)).size, 11);
  assert.ok(!R.CLUBES.includes(null) && !R.CLUBES.includes('leyendas'), 'las leyendas no son un club: ni álbum ni desafío de club');
  const roja = R.RETOS.find(x => x.id === 'laroja');
  assert.deepEqual(PM.CARDS.filter(c => c.leyenda && roja.elegible(c)).map(c => c.name).sort(), ['Figueroa', 'Zamorano']);
});

test('una leyenda vale en los desafíos de los clubes donde jugó (hasta tres), no en el álbum', () => {
  const L = id => PM.CARDS.find(c => c.person === 'leyendas-' + id);
  assert.ok(PM.CARDS.filter(c => c.leyenda).every(c => Array.isArray(c.clubes) && c.clubes.length <= 3 && c.clubes.every(k => PM.CLUBES[k]) && c.club === null));
  const madrid = R.plantilla(R.claveClub('realmadrid')), milan = R.plantilla(R.claveClub('milan')), barca = R.plantilla(R.claveClub('barcelona'));
  assert.ok(madrid.elegible(L('kaka')) && milan.elegible(L('kaka')) && !barca.elegible(L('kaka')));
  assert.ok(['realmadrid', 'barcelona', 'inter'].every(k => R.plantilla(R.claveClub(k)).elegible(L('ronaldo-r9'))));
  assert.ok(!madrid.elegible(L('pele')), 'Pelé no jugó en ninguno');
  assert.ok(!R.cartasAlbum('realmadrid').some(c => c.leyenda), 'el álbum sigue sin leyendas');
  // el mejor once del Madrid con todo el catálogo mete leyendas y sigue valiendo
  const once = R.mejorOnce(R.claveClub('realmadrid'), todas);
  assert.ok(R.evalua(R.claveClub('realmadrid'), once).valida);
  assert.ok(once.some(f => PM.CARDS[f.id].leyenda));
  // El Clásico: Ronaldo y Figo (de los dos) completan el lado que falte
  const clasico = R.RETOS.find(x => x.id === "clasico"), cs = n => PM.CARDS.filter(c => c.club === n && !c.especial);
  const r = clasico.extra([...cs('realmadrid').slice(0, 5), ...cs('barcelona').slice(0, 4), L('ronaldo-r9'), L('figo')]);
  assert.ok(r.ok, r.txt);
  assert.ok(!clasico.extra([...cs('realmadrid').slice(0, 7), ...cs('barcelona').slice(0, 3), L('figo')]).ok);
  assert.ok(R.RETOS.find(x => x.id === "calcio").elegible(L('maradona')) && R.RETOS.find(x => x.id === "bigsix").elegible(L('gerrard')));
});

test('formaciones: diez, de once casillas con un portero; sin `f` es la 4-3-3 y la 4-4-2 tiene MI y MD', () => {
  assert.equal(PM.LISTA_FORMACIONES.length, 10);
  assert.deepEqual([...PM.LISTA_FORMACIONES].sort(), Object.keys(PM.FORMACIONES).sort());
  for (const k of PM.LISTA_FORMACIONES) {
    const F = PM.FORMACIONES[k];
    assert.equal(F.length, 11, k);
    assert.equal(F.filter(x => x.pos === 'POR').length, 1, k);
    assert.equal(F[0].pos, 'POR');
    // las cuentas de la clave son las de cada línea de campo
    const filas = [...new Set(F.slice(1).map(x => x.fila))].sort().map(f => F.filter(x => x.fila === f).length).join('');
    assert.equal(filas, k, k);
  }
  assert.equal(PM.formacionDe(''), PM.FORMACION);
  assert.equal(PM.formacionDe('9999'), PM.FORMACION);
  assert.equal(PM.claveFormacion(undefined), '433');
  assert.equal(PM.nombreFormacion('4231'), '4-2-3-1');
  const i442 = PM.FORMACIONES['442'].findIndex(x => x.pos === 'MI');
  const mi = PM.CARDS.find(c => c.posiciones && c.posiciones[0] === 'MI');
  assert.ok(mi, 'hay algún MI');
  assert.equal(R.encaje(i442, mi.n, '442').nivel, 0, 'un MI está en su puesto en la 4-4-2');
  assert.ok(!PM.FORMACION.some(x => x.pos === 'MI'), 'la 4-3-3 no tiene MI');
});

test('el premio se paga con la formación con que se cobró (`f`)', () => {
  const at = EL.fin + H, c = EL.once.map(f => f.key), k = 'gPremio0000';
  const fichas = EL.once.map(f => ({ id: f.id, g: f.g, gr: false }));
  const mala = PM.LISTA_FORMACIONES.find(f => !R.evalua(EL.clave, fichas, f).valida);
  assert.ok(mala, 'alguna formación deja a alguien fuera de su línea');
  const con = f => { const d = datos({ plantillas: { p: { [A]: { [EL.clave + '_1']: Object.assign({ at, c, k }, f ? { f } : {}) } } } }); d.cartas.s[A] = Object.assign({}, SOBRES, { [k]: { at, p: 0, pl: EL.clave + '_1' } }); return d; };
  assert.equal(monedasDe(A, con('')).premios, 50, 'sin f: la 4-3-3');
  assert.equal(monedasDe(A, con('433')).premios, 50);
  assert.equal(monedasDe(A, con(mala)).premios, 0, 'en la ' + mala + ' no vale');
});
