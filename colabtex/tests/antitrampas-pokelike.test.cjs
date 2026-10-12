// Pokelike en el Club: el verificador rehace la run con el mismo motor y
// solo acepta el puntaje (o las especies atrapadas) que salen de verdad.
const { test } = require('node:test'), assert = require('node:assert/strict'), esbuild = require('esbuild');
const carga = entry => { const mod = { exports: {} }; new Function('module', 'exports', 'require', esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', platform: 'node', write: false }).outputFiles[0].text)(mod, mod.exports, require); return mod.exports; };
const V = carga('src/juegos/solo/verifica.js');
const M = require('../../juegos/club/pokelike/motor.js');

// Una run honesta que gana al menos una medalla: el bot elige caminos y captura.
function partida(u) {
  for (let semilla = 1; semilla < 500; semilla++) {
    const p = intento(u, semilla);
    if (p.run.medallas >= 1) return p;
  }
  throw new Error('ninguna semilla ganó a Brock');
}
function intento(u, semilla) {
  const run = M.nuevaRun(semilla, 7, u);
  for (let k = 0; k < 20000 && run.fase !== 'fin' && run.medallas < 1; k++) {
    if (run.fase === 'mapa') M.entrar(run, M.siguientes(run)[0]);
    else if (run.fase === 'combate') { if (!run.combate.fin) M.pasoCombate(run); else M.terminarCombate(run); }
    else if (run.fase === 'captura') M.capturar(run, run.equipo.length < 6 ? 0 : null);
    else if (run.fase === 'centro') M.salirCentro(run);
  }
  const turnos = run.log.filter(t => t === 'a' || t[0] === 'x').length;
  const a = turnos * 400 + 5000;
  return { run, prueba: { v: 1, s: run.nonce, u, i: run.inicial, d: run.log.join(' '), a, w: a + 30 }, tiempo: a };
}

test('Pokelike: acepta la run honesta en las dos tablas', async () => {
  const { run, prueba, tiempo } = partida('ana');
  assert.ok(M.puntaje(run) >= 1, 'la run suma puntos');
  assert.equal(await V.verificaClub('pokelike', { categoria: 'club-pokelike-puntos', puntos: M.puntaje(run), tiempo, partida: 'p' }, prueba, { uid: 'ana' }), null);
  assert.equal(await V.verificaClub('pokelike', { categoria: 'club-pokelike-pokedex', puntos: M.atrapados(run), tiempo, partida: 'p' }, prueba, { uid: 'ana' }), null);
});

test('Pokelike: rechaza puntaje inflado, otra cuenta, decisiones tocadas, tiempo falso y reloj acelerado', async () => {
  const { run, prueba, tiempo } = partida('ana');
  const dato = { categoria: 'club-pokelike-puntos', puntos: M.puntaje(run), tiempo, partida: 'p' };
  const mal = async (d, p, ctx = { uid: 'ana' }, re) => assert.match(await V.verificaClub('pokelike', d, p, ctx), re);
  await mal({ ...dato, puntos: dato.puntos + 100 }, prueba, undefined, /suma/);
  await mal({ ...dato, categoria: 'club-pokelike-pokedex', puntos: M.atrapados(run) + 5 }, prueba, undefined, /especies/);
  await mal(dato, prueba, { uid: 'beto' }, /otra cuenta/);
  await mal(dato, { ...prueba, u: 'beto' }, { uid: 'beto' }, /rehecha|no se puede jugar/);
  await mal(dato, { ...prueba, d: prueba.d.replace(/e(\d+-\d+)/, 'e9-9') }, undefined, /no se puede jugar/);
  await mal({ ...dato, tiempo: 200 }, { ...prueba, a: 200, w: 200 }, undefined, /más rápido/);
  await mal(dato, { ...prueba, w: prueba.a * 2 }, undefined, /velocidad del juego/);
  await mal(dato, { ...prueba, v: 2 }, undefined, /otra versión/);
  await mal(dato, null, undefined, /sin prueba/);
});

test('Pokelike: sospecha de filas imposibles', () => {
  const v = V.VERIFICADORES.pokelike;
  assert.match(v.sospecha('club-pokelike-pokedex', { puntos: 200 }), /151/);
  assert.equal(v.sospecha('club-pokelike-pokedex', { puntos: 40 }), null);
  assert.match(v.sospecha('club-pokelike-puntos', { puntos: 5e6 }), /más de lo que/);
});
