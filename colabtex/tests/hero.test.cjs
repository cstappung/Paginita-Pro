'use strict';
// PRO HERO: la prueba que se vuelve a tocar, las estrellas y lo que pagan, y la sala en línea.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const esbuild = require('esbuild');

const HERO = path.resolve(__dirname, '../../juegos/hero');
const mod = rel => import(pathToFileURL(path.join(HERO, rel)).href);
const carga = entry => {
  const m = { exports: {} };
  new Function('module', 'exports', 'require', esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', platform: 'node', write: false }).outputFiles[0].text)(m, m.exports, require);
  return m.exports;
};

/* Un .chart de prueba: guitarra en Experto y Fácil, con acordes, notas
   largas, una frase de Star Power y un cambio de tempo. */
function chartDePrueba(semilla = 1, n = 300) {
  let r = semilla;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const notas = [];
  let t = 768;
  for (let i = 0; i < n; i++) {
    const lane = Math.floor(rnd() * 5), len = rnd() < 0.2 ? 192 : 0;
    notas.push(`  ${t} = N ${lane} ${len}`);
    if (rnd() < 0.1) notas.push(`  ${t} = N ${(lane + 2) % 5} ${len}`);
    t += rnd() < 0.5 ? 96 : 192;
  }
  const facil = notas.filter((_, i) => i % 3 === 0);
  return `[Song]\n{\n  Resolution = 192\n}\n[SyncTrack]\n{\n  0 = TS 4\n  0 = B 120000\n  ${192 * 40} = B 150000\n}\n[Events]\n{\n}\n` +
    `[ExpertSingle]\n{\n  ${768 + 192 * 20} = S 2 ${192 * 8}\n${notas.join('\n')}\n}\n[EasySingle]\n{\n${facil.join('\n')}\n}\n`;
}

/* Toca como una persona: cada nota con un desvío de hasta ±30 ms, en cuadros
   de duración irregular (como en un navegador de verdad). */
async function tocaHumano(song, cab, { desvio = 0.06, rasguea = true, semilla = 7 } = {}) {
  const { Grabadora, opcionesMotor } = await mod('js/game/prueba.js');
  const { createEngine } = await mod('js/core/engine.js');
  const { applyNoteMode } = await mod('js/core/noteMode.js');
  const track = applyNoteMode(song.parts[cab.p][cab.d], cab.m);
  const e = createEngine(track, song.tempo, opcionesMotor(cab));
  const g = new Grabadora(e, cab);
  let r = semilla;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const acciones = [];
  for (const nt of track.notes) {
    acciones.push({ t: nt.time + (rnd() - 0.5) * desvio, f: nt.open ? 0 : nt.frets });
    if (rnd() < 0.05) acciones.push({ t: nt.time + 0.02, sp: 1 });
  }
  acciones.sort((a, b) => a.t - b.t);
  let cuadro = -2, i = 0;
  while (cuadro < track.notes[track.notes.length - 1].time + 3) {
    cuadro += 0.010 + rnd() * 0.012;
    while (i < acciones.length && acciones[i].t < cuadro) {
      const a = acciones[i++];
      if (a.sp) { g.sp(a.t); continue; }
      g.fret(a.f, a.t);
      if (rasguea && cab.m !== 'taps') g.strum(a.t + 0.004);
    }
    g.hasta(cuadro);
  }
  return { stats: e.stats(), prueba: g.texto() };
}

test('la prueba vuelve a tocar la canción y da exactamente lo mismo', async () => {
  const { leeCancion } = await mod('js/core/leer.js');
  const { rehace, pareceBot } = await mod('js/game/prueba.js');
  const song = leeCancion('notes.chart', new TextEncoder().encode(chartDePrueba()).buffer, null);
  for (const m of ['normal', 'taps', 'hopos', 'strums']) {
    const cab = { id: 'Artista - Canción', p: 'guitar', d: 'expert', m, xp: 0, pc: 0 };
    const { stats, prueba } = await tocaHumano(song, cab);
    const r = rehace(song, prueba);
    assert.deepEqual(r.stats, stats, m);
    assert.ok(r.completa, m);
    assert.equal(pareceBot(r.desvios), false, m + ': una persona no es un bot');
  }
});

test('un puntaje editado no cuadra, y el bot del juego se reconoce', async () => {
  const { leeCancion } = await mod('js/core/leer.js');
  const { rehace, pareceBot, Grabadora, opcionesMotor } = await mod('js/game/prueba.js');
  const { createEngine } = await mod('js/core/engine.js');
  const song = leeCancion('notes.chart', new TextEncoder().encode(chartDePrueba(3)).buffer, null);
  const cab = { id: 'x', p: 'guitar', d: 'expert', m: 'normal', xp: 0, pc: 0 };
  const { stats, prueba } = await tocaHumano(song, cab, { desvio: 0.3, semilla: 11 });
  const humano = rehace(song, prueba);
  assert.equal(humano.stats.score, stats.score);
  assert.equal(pareceBot(humano.desvios), false);
  // A la hora exacta de cada nota, como el Bot del juego (o un script que manda teclas)
  const track = song.parts.guitar.expert;
  const e = createEngine(track, song.tempo, opcionesMotor(cab));
  const g = new Grabadora(e, cab);
  for (const nt of track.notes) { g.fret(nt.frets, nt.time); g.strum(nt.time); }
  g.hasta(track.notes[track.notes.length - 1].time + 3);
  const r = rehace(song, g.texto());
  assert.equal(r.stats.score, e.stats().score);
  assert.equal(pareceBot(r.desvios), true);
});

test('verificaHero: la canción, la parte y el puntaje tienen que cuadrar', async () => {
  const D = carga(path.join(__dirname, '../src/juegos/hero-datos.js'));
  const { claveCancion } = await mod('js/sitio/clave.js');
  const { leeCancion } = await mod('js/core/leer.js');
  const chart = new TextEncoder().encode(chartDePrueba(5)).buffer;
  const song = leeCancion('notes.chart', chart, null);
  const id = 'Muse - Knights of Cydonia';
  for (const d of ['expert', 'easy']) {
    const cab = { id, p: 'guitar', d, m: 'normal', xp: 0, pc: 0 };
    const { stats, prueba } = await tocaHumano(song, cab, { semilla: 13 });
    const base = { k: claveCancion(id), id, part: 'guitar', diff: d, stats, prueba, chartFile: 'notes.chart', chart, ini: null };
    const v = D.verificaHero(base);
    assert.equal(v.score, stats.score);
    assert.equal(v.oro, d === 'expert', 'doradas solo en la dificultad más alta');
    assert.throws(() => D.verificaHero({ ...base, stats: { ...stats, score: stats.score + 1 } }), /no cuadra/);
    assert.throws(() => D.verificaHero({ ...base, k: 'cotra' }), /clave/);
    assert.throws(() => D.verificaHero({ ...base, diff: d === 'expert' ? 'easy' : 'expert' }), /otra parte/);
  }
});

test('la clave de una canción es estable y sirve de clave en Firebase', async () => {
  const { claveCancion, ES_CLAVE } = await mod('js/sitio/clave.js');
  const a = claveCancion('AC/DC - Back In Black [charter.v2]');
  assert.equal(a, claveCancion('AC/DC - Back In Black [charter.v2]'));
  assert.notEqual(a, claveCancion('AC/DC - Back In Black [charter.v3]'));
  assert.match(a, ES_CLAVE);
  assert.doesNotMatch(a, /[.#$[\]/]/);
});

test('estrellas: doradas encima de las azules, y lo que pagan (los ejemplos de la dueña)', async () => {
  const D = carga(path.join(__dirname, '../src/juegos/hero-datos.js'));
  // la misma cuenta que estrellasDe (puente.js, que necesita window)
  const vista = r => ({ oro: Math.min(5, r.g), azul: Math.max(0, Math.min(5, r.b) - Math.min(5, r.g)) });
  assert.deepEqual(vista({ g: 3, b: 4 }), { oro: 3, azul: 1 }, '4 azules y 3 doradas: 3 doradas y luego una azul');
  // Cada estrella paga una vez: 100 la dorada, 50 la azul
  const pago = (antes, v) => D.aplicaHero(antes, v).monedas;
  assert.equal(pago(null, { estrellas: 2, oro: false, score: 1 }), 100, 'dos azules: 100');
  assert.equal(pago({ g: 0, b: 2 }, { estrellas: 1, oro: true, score: 1 }), 50, 'luego una dorada: los otros 50');
  assert.equal(pago({ g: 1, b: 0 }, { estrellas: 2, oro: false, score: 1 }), 50, 'con 1 dorada, 2 azules pagan 50');
  assert.equal(pago({ g: 3, b: 0 }, { estrellas: 5, oro: true, score: 1 }), 200, 'de 3 a 5 doradas: 200');
  assert.equal(pago({ g: 5, b: 5 }, { estrellas: 5, oro: true, score: 1 }), 0, 'repetir no paga');
  assert.equal(pago({ g: 2, b: 0 }, { estrellas: 6, oro: true, score: 1 }), 300, 'la sexta estrella del motor cuenta como cinco');
  // La fila de la clasificación: doradas·10 000 + todas
  const r = D.resumenHero({ c1: { g: 5, b: 0 }, c2: { g: 1, b: 4 }, c3: { g: 0, b: 3 } });
  assert.deepEqual([r.G, r.M, r.h, r.h5], [6, 12, 2, 1]);
  assert.equal(r.puntos, 60012);
  assert.deepEqual(D.decodificaHero(r.puntos), { g: 6, m: 12 });
  // Y la economía paga lo mismo que la suma canción por canción
  const M = carga(path.join(__dirname, '../src/juegos/monedas.js'));
  assert.equal(M.monedasHero(r.puntos), [{ g: 5, b: 0 }, { g: 1, b: 4 }, { g: 0, b: 3 }].reduce((t, x) => t + D.monedasCancionHero(x), 0));
  assert.equal(M.PAGO_CLUB.hero, 50);
});

test('logros de PRO HERO: unas 40 canciones bien tocadas dan los diez', () => {
  const sin = f => fs.readFileSync(f, 'utf8').replace(/^import .*$/mg, '').replace(/\bexport\s+/g, '');
  const c = { crypto: require('node:crypto').webcrypto, TextEncoder }; vm.createContext(c);
  vm.runInContext(sin('src/juegos/motor.js') + '\n' + sin('src/juegos/logros.js') + '\n;globalThis.__L={LOGROS,deMarca};', c);
  const { LOGROS, deMarca } = c.__L;
  const cat = 'club-hero-estrellas';
  assert.equal(LOGROS.hero.length, 10);
  assert.deepEqual([...deMarca('hero', { categoria: cat, puntos: 3, tiempo: 1, h: 0, h5: 0 })], ['e1']);
  assert.equal(deMarca('hero', { categoria: cat, puntos: 200 * 10000 + 200, tiempo: 1, h: 40, h5: 40 }).length, 10);
  assert.equal(deMarca('hero', { categoria: cat, puntos: 199 * 10000 + 199, tiempo: 1, h: 40, h5: 39 }).length, 9);
  const V = carga(path.join(__dirname, '../src/juegos/solo/verifica/hero.js'));
  assert.equal(V.verifica({ categoria: cat, puntos: 60012 }, { v: 1, c: { c1: [5, 0], c2: [1, 4], c3: [0, 3] } }), null);
  assert.match(V.verifica({ categoria: cat, puntos: 70012 }, { v: 1, c: { c1: [5, 0], c2: [1, 4], c3: [0, 3] } }), /no suman/);
  assert.match(V.verifica({ categoria: cat, puntos: 60000 }, { v: 1, c: { c1: [6, 0] } }), /no valen/);
});

/* ---------- la sala en línea (redHero en motor.js) ---------- */
const codigo = fs.readFileSync('src/juegos/motor.js', 'utf8').replace(/\bexport\s+/g, '');
const ctx = { crypto: require('node:crypto').webcrypto }; vm.createContext(ctx); vm.runInContext(codigo, ctx);
const { reducir } = ctx;
const [JUEGOS, HR_DEMORA] = vm.runInContext('[JUEGOS, HR_DEMORA]', ctx);
const sala = (n = 3) => ({ juego: 'hero', semilla: 1, estado: 'jugando', cupo: 8,
  jugadores: Object.fromEntries(['a', 'b', 'c', 'd'].slice(0, n).map((u, i) => [u, { nombre: u, orden: i }])), jugadas: {} });
const mover = (p, j) => { p.jugadas[String(Object.keys(p.jugadas).length).padStart(4, '0')] = j; return reducir(p); };

test('sala: canción, partes, listo, descarga, arranque y resultados de todos', () => {
  assert.equal(JUEGOS.hero.cupo, 8);
  const p = sala(3);
  let e = reducir(p);
  assert.equal(e.etapa, 'sala');
  assert.equal(e.director, 'a');
  mover(p, { t: 'cancion', uid: 'b', id: 'otra' });
  assert.equal(reducir(p).cancion, '', 'solo quien dirige elige la canción');
  mover(p, { t: 'cancion', uid: 'a', id: 'Muse - Uprising' });
  for (const u of ['a', 'b', 'c']) mover(p, { t: 'parte', uid: u, p: u === 'c' ? 'drums' : 'guitar', d: 'expert', m: 'taps' });
  mover(p, { t: 'listo', uid: 'b', on: true });
  e = mover(p, { t: 'empieza', uid: 'a' });
  assert.equal(e.etapa, 'sala', 'falta que c esté listo');
  mover(p, { t: 'listo', uid: 'c', on: true });
  e = mover(p, { t: 'empieza', uid: 'a' });
  assert.equal(e.etapa, 'cargando');
  assert.deepEqual([...e.enJuego], ['a', 'b', 'c']);
  mover(p, { t: 'cargado', uid: 'a' });
  mover(p, { t: 'cargado', uid: 'b' });
  e = mover(p, { t: 'go', uid: 'a', at: 1000 });
  assert.equal(e.etapa, 'cargando', 'no arranca mientras alguien descarga');
  mover(p, { t: 'cargado', uid: 'c' });
  e = mover(p, { t: 'go', uid: 'a', at: 5000 });
  assert.equal(e.etapa, 'tocando');
  assert.equal(e.go, 5000 + HR_DEMORA);
  mover(p, { t: 'fin', uid: 'a', r: 1, s: 120000, e: 5, h: 300, n: 310 });
  mover(p, { t: 'fin', uid: 'a', r: 1, s: 999999, e: 6 });
  e = mover(p, { t: 'fin', uid: 'b', r: 1, s: 90000, e: 4 });
  assert.equal(e.etapa, 'tocando');
  e = mover(p, { t: 'fin', uid: 'c', r: 1, s: 80000, e: 3, q: 1 });
  assert.equal(e.etapa, 'sala', 'con todos los resultados se vuelve a elegir canción');
  assert.equal(e.ultima.ronda, 1);
  assert.equal(e.ultima.fines.a.s, 120000, 'el resultado se escribe una vez');
  assert.equal(e.ultima.fines.c.q, 1);
  assert.deepEqual({ ...e.preparados }, {}, 'la ronda nueva pide «listo» de nuevo');
  assert.equal(e.fase, 'jugando', 'la sala no termina sola');
});

test('sala: quien se va no traba la ronda y quien sigue dirige', () => {
  const p = sala(3);
  mover(p, { t: 'cancion', uid: 'a', id: 'x' });
  for (const u of ['a', 'b', 'c']) { mover(p, { t: 'parte', uid: u, p: 'guitar', d: 'hard', m: 'normal' }); mover(p, { t: 'listo', uid: u, on: true }); }
  mover(p, { t: 'empieza', uid: 'a' });
  mover(p, { t: 'cargado', uid: 'a' });
  mover(p, { t: 'cargado', uid: 'b' });
  let e = mover(p, { t: 'nocarga', uid: 'c' });
  assert.deepEqual([...e.enJuego], ['a', 'b']);
  e = mover(p, { t: 'go', uid: 'a', at: 1 });
  assert.equal(e.etapa, 'tocando');
  e = mover(p, { t: 'abandona', uid: 'a' });
  assert.equal(e.director, 'b', 'dirige el primer asiento que sigue');
  e = mover(p, { t: 'fin', uid: 'b', r: 1, s: 10 });
  assert.equal(e.etapa, 'sala', 'la ronda cierra sin el que se fue');
  mover(p, { t: 'abandona', uid: 'b' });
  e = mover(p, { t: 'abandona', uid: 'c' });
  assert.equal(e.fase, 'fin', 'sin nadie, la sala se cierra');
});

test('el mapa de módulos del juego tiene todos los archivos con la misma versión', () => {
  const html = fs.readFileSync(path.join(HERO, 'index.html'), 'utf8');
  const mapa = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
  const v = /src="js\/main\.js\?v=([\w-]+)"/.exec(html)[1];
  const modulos = [];
  const recorre = d => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, n.name); if (n.isDirectory()) recorre(f); else if (n.name.endsWith('.js')) modulos.push('./' + path.relative(HERO, f).split(path.sep).join('/')); } };
  recorre(path.join(HERO, 'js'));
  for (const m of modulos) assert.equal(mapa[m], m + '?v=' + v, m);
  assert.equal(Object.keys(mapa).length, modulos.length);
  // y los carteros piden la misma versión del documento
  for (const f of ['src/juegos/hero.js', 'src/juegos/hero-sala.js'])
    assert.match(fs.readFileSync(f, 'utf8'), new RegExp('juegos/hero/index\\.html\\?(modo=online&)?v=' + v), f);
});
