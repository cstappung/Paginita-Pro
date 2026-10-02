/* Frontera Batalla: el motor (pokemon/frontera-motor.js) sobre el
   simulador de Showdown, y su registro en el club, las reglas, las
   monedas y los logros. El motor se empaqueta al vuelo con esbuild. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), os = require('node:os'), path = require('node:path');
const esbuild = require('esbuild');

const salida = path.join(os.tmpdir(), 'frontera-motor-test.cjs');
esbuild.buildSync({entryPoints: ['src/juegos/pokemon/motor-pk.js'], bundle: true, platform: 'node', format: 'cjs', outfile: salida, logLevel: 'error'});
require(salida);
const F = globalThis.PokeMotor.frontera;
const sin = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/^import [\s\S]*?;$/mg, '').replace(/\bexport\s+/g, '');

/* Juega un combate entero: el jugador lo lleva otra IA sembrada. */
function juega(inst, nivel, n, semilla, mios, elecciones) {
  const rival = F.equipoRival(inst, nivel, n, semilla);
  const sets = [F.aNivel(mios, nivel), rival.sets || rival];
  const o = {semilla: `${semilla}|${n}`, sets, nombres: ['Tú', 'Rival'], iq: F.iqDe(n), palacio: inst === 'palacio', elecciones};
  const P = F.nuevaPelea(o);
  let k = 0;
  while (P.est().fase !== 'fin' && k < 600) {
    const c = F.decideIA(P.battle, 0, 0.6, F.rng(`t|${n}|${k++}`));
    if (!P.elige(c)) break;
  }
  return {P, o};
}
const limpio = l => l.filter(x => !x.startsWith('|t:|'));

test('la dificultad sube y el rival sale de la serie', () => {
  assert.ok(F.iqDe(1) < F.iqDe(30) && F.iqDe(30) <= F.iqDe(80));
  assert.ok(F.ivDe(1) < F.ivDe(60));
  assert.equal(F.rivalDe('torre', 35, 's').as, 'plata');
  assert.equal(F.rivalDe('torre', 70, 's').as, 'oro');
  assert.equal(F.rivalDe('palacio', 21, 's').id, 'spenser');
  assert.equal(F.rivalDe('fabrica', 42, 's').id, 'noland');
  assert.deepEqual(F.rivalDe('torre', 9, 'x'), F.rivalDe('torre', 9, 'x'));
  const e = F.equipoRival('torre', '50', 3, 'x');
  assert.equal((e.sets || e).length, 3);
});

test('un combate termina y se rehace igual con la lista de elecciones', () => {
  const mios = F.alquiler(1, 'semX', '50').slice(0, 3);
  assert.deepEqual(F.validaFrontera(mios), []);
  for (const inst of ['torre', 'palacio']) {
    const {P, o} = juega(inst, '50', 8, 'semX', mios);
    const e = P.est();
    assert.equal(e.fase, 'fin', inst);
    const Q = F.nuevaPelea({...o, elecciones: P.elecciones.slice()});
    assert.deepEqual(limpio(Q.est().log), limpio(e.log), inst);
    assert.equal(Q.est().ganador, e.ganador);
  }
});

test('cualquier trío de alquiler cumple las cláusulas', () => {
  for (let k = 0; k < 40; k++) {
    const seis = F.alquiler(1 + k * 3, 'alq' + k, k % 2 ? 'abierto' : '50');
    assert.equal(seis.length, 6);
    assert.deepEqual(F.validaFrontera(seis.slice(0, 3)), [], 'semilla ' + k);
    assert.deepEqual(F.validaFrontera(seis.slice(3)), [], 'semilla ' + k);
  }
});

test('validaFrontera refuta equipos ilegales', () => {
  const tres = F.alquiler(1, 'v', '50').slice(0, 3);
  assert.ok(F.validaFrontera(tres.slice(0, 2)).length);
  assert.ok(F.validaFrontera([tres[0], tres[0], tres[1]]).length);
  assert.ok(F.validaFrontera([{...tres[0], species: 'Mewtwo'}, tres[1], tres[2]]).length);
});

test('las monedas del registro coinciden con las del motor', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(sin('src/juegos/monedas.js') + ';globalThis.__M={monedasCombateFrontera,monedasRachaFrontera};', ctx);
  const M = ctx.__M;
  let suma = 0;
  for (let n = 1; n <= 120; n++) { assert.equal(M.monedasCombateFrontera(n), F.monedasCombate(n), n); suma += F.monedasCombate(n); }
  assert.equal(M.monedasRachaFrontera(120), suma);
});

test('las categorías del club, la regla de soloRanks y Discord', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(sin('src/juegos/solo/club-datos.js') + ';globalThis.__C={categoriaClub,resultadoClub};', ctx);
  const C = ctx.__C;
  const cats = ['club-frontera-victorias'];
  for (const i of ['torre', 'palacio', 'fabrica']) for (const n of ['50', 'abierto']) cats.push(`club-frontera-${i}-${n}`);
  for (const c of cats) {
    assert.ok(C.categoriaClub('frontera', c), c);
    assert.ok(C.resultadoClub('frontera', {categoria: c, puntos: 14, tiempo: 5000, partida: 'abc-14'}), c);
  }
  assert.ok(!C.categoriaClub('frontera', 'club-frontera-pike-50'));
  const reglas = JSON.parse(fs.readFileSync(path.join(__dirname, '../../firebase/database.rules.json'), 'utf8'));
  const re = new RegExp(reglas.rules.soloRanks.$categoria.$uid['.validate'].match(/matches\(\/(.+?)\/\)/)[1]);
  for (const c of cats) assert.ok(re.test(c), c);
  const dctx = {}; vm.createContext(dctx);
  vm.runInContext(sin('src/juegos/discord.js') + '\n;globalThis.__D={marcaSolo,categoriaLegible};', dctx);
  assert.equal(dctx.__D.categoriaLegible('club-frontera-torre-50').club.nombre, 'Frontera Batalla');
  assert.match(dctx.__D.marcaSolo('club-frontera-palacio-abierto', {puntos: 21, tiempo: 1}), /21 combates seguidos/);
});
