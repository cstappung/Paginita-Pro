/* Pokémon: el protocolo de promesas sobre el simulador de Showdown.
   Juega peleas enteras con robots, como lo harían dos pestañas, y
   comprueba que el registro basta para que cualquiera llegue al mismo
   final, que nadie puede cambiar lo prometido y que un equipo ilegal
   pierde. El motor de Showdown se empaqueta al vuelo con esbuild. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), os = require('node:os'), path = require('node:path');
const esbuild = require('esbuild');

const salida = path.join(os.tmpdir(), 'pk-motor-test.cjs');
esbuild.buildSync({entryPoints: ['src/juegos/pokemon/motor-pk.js'], bundle: true, platform: 'node', format: 'cjs', outfile: salida, logLevel: 'error'});
const PM = require(salida);

const sin = f => fs.readFileSync(f, 'utf8').replace(/^import .*$/mg, '').replace(/\bexport\s+/g, '');
const context = {crypto: require('node:crypto').webcrypto, TextEncoder, PokeMotor: PM};
vm.createContext(context);
vm.runInContext(sin('src/juegos/motor.js') + '\n;globalThis.__M={reducir,cadenaPk,llavePk,sha256hex,meToca,JUEGOS};', context);
const {reducir, cadenaPk, llavePk, sha256hex, meToca, JUEGOS} = context.__M;
// El reductor busca el motor en globalThis.
context.PokeMotor = PM; vm.runInContext('globalThis.PokeMotor = PokeMotor;', context);

const EQ1 = `Garchomp @ Choice Scarf
Ability: Rough Skin
Tera Type: Ground
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Outrage
- Stone Edge
- Fire Fang

Rotom-Wash @ Leftovers
Ability: Levitate
EVs: 252 HP / 252 Def / 4 SpA
Bold Nature
- Hydro Pump
- Volt Switch
- Will-O-Wisp
- Pain Split

Corviknight @ Leftovers
Ability: Pressure
EVs: 252 HP / 4 Def / 252 SpD
Careful Nature
- Brave Bird
- Roost
- U-turn
- Defog`;
const EQ2 = `Gholdengo @ Choice Specs
Ability: Good as Gold
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Focus Blast
- Trick

Great Tusk @ Booster Energy
Ability: Protosynthesis
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Headlong Rush
- Close Combat
- Ice Spinner
- Rapid Spin

Dragonite @ Heavy-Duty Boots
Ability: Multiscale
Tera Type: Normal
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Dragon Dance
- Extreme Speed
- Earthquake
- Roost`;

function sala(formato = 'gen9ou') {
  const js = {};
  const sec = {a: {sem: 11, sal: 'xa'}, b: {sem: 22, sal: 'yb'}};
  for (const [u, o] of [['a', 0], ['b', 1]]) js[u] = {nombre: u === 'a' ? 'Ana' : 'Beto', orden: o, hcad: cadenaPk(sec[u].sem, sec[u].sal)[2000]};
  return {p: {juego: 'pokemon', semilla: 77, formato, estado: 'jugando', jugadores: js, jugadas: {}}, sec};
}
let n = 0;
const pon = (p, j) => { p.jugadas[String(n++).padStart(4, '0')] = j; };

/* Un robot por lado: en cada punto promete y luego revela, como haría
   la pantalla. `elige` decide qué. */
function juega(formato, equipos, elige, max = 3000) {
  n = 0;
  const {p, sec} = sala(formato);
  const cad = {a: cadenaPk(sec.a.sem, sec.a.sal), b: cadenaPk(sec.b.sem, sec.b.sal)};
  let est = reducir(p), vueltas = 0;
  const pend = {};
  while (est.fase !== 'fin' && vueltas++ < max) {
    const k = est.punto;
    for (const [i, u] of ['a', 'b'].entries()) {
      if (est.prometido[u]) continue;
      let c;
      if (k === 0) c = PM.empaqueta(PM.importa(equipos[i]));
      else c = est.decide[u] ? elige(est.peticion[i], u) : PM.NADA;
      const l = llavePk(cad[u], k);
      pend[u] = {c, l};
      pon(p, {t: 'c', uid: u, k, h: sha256hex(c + '|' + l)});
    }
    est = reducir(p);
    for (const u of ['a', 'b']) {
      if (est.punto !== k || est.revelado[u]) continue;
      pon(p, {t: 'r', uid: u, k, c: pend[u].c, l: pend[u].l, sk: 'red'});
      est = reducir(p);
    }
  }
  return {p, est};
}
const azar = s => { let x = s; return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; };

test('el juego está en la tabla', () => {
  assert.equal(JUEGOS.pokemon.cupo, 2);
  assert.match(JUEGOS.pokemon.alta, /^\d{4}-\d{2}-\d{2}$/);
});

test('sin el motor cargado, la sala dice que carga', () => {
  const ctx2 = {crypto: require('node:crypto').webcrypto, TextEncoder}; vm.createContext(ctx2);
  vm.runInContext(sin('src/juegos/motor.js') + '\n;globalThis.__R=reducir;', ctx2);
  const {p} = sala();
  assert.equal(ctx2.__R(p).fase, 'cargando');
});

test('una pelea entera con robots termina y el registro la reproduce', () => {
  for (let s = 1; s <= 4; s++) {
    const r = azar(s);
    const {p, est} = juega('gen9ou', [EQ1, EQ2], req => { const o = PM.opciones(req); return o[Math.floor(r() * o.length)].c; });
    assert.equal(est.fase, 'fin', 'semilla ' + s);
    assert.ok(['a', 'b', ''].includes(est.ganador));
    assert.ok(est.ronda > 1);
    // Otra pestaña que llega tarde rehace la pelea desde cero y ve lo mismo.
    const copia = JSON.parse(JSON.stringify(p)); copia.semilla = p.semilla; copia.jugadores.a.nombre = 'Ana';
    const e2 = PM.reducir(Object.entries(copia.jugadas).map(([k, v]) => ({k, ...v})), [
      {uid: 'a', nombre: 'Ana', hcad: copia.jugadores.a.hcad}, {uid: 'b', nombre: 'Beto', hcad: copia.jugadores.b.hcad}],
      {semilla: p.semilla, formato: 'gen9ou', H: sha256hex, clave: 'otra'});
    assert.equal(e2.ganador, est.ganador);
    const limpio = l => l.filter(x => !x.startsWith('|t:|')).join('\n');
    assert.equal(limpio(e2.log), limpio(est.log));
  }
});

test('mientras uno no ha prometido, le toca; el otro ya no', () => {
  n = 0;
  const {p, sec} = sala();
  const cad = cadenaPk(sec.a.sem, sec.a.sal);
  const c = PM.empaqueta(PM.importa(EQ1)), l = llavePk(cad, 0);
  pon(p, {t: 'c', uid: 'a', k: 0, h: sha256hex(c + '|' + l)});
  const est = reducir(p);
  assert.equal(meToca(est, 'a'), false);
  assert.equal(meToca(est, 'b'), true);
  assert.equal(est.fase, 'equipos');
});

test('una revelación que no casa con la promesa no cuenta', () => {
  n = 0;
  const {p, sec} = sala();
  const ca = cadenaPk(sec.a.sem, sec.a.sal), cb = cadenaPk(sec.b.sem, sec.b.sal);
  const e1 = PM.empaqueta(PM.importa(EQ1)), e2 = PM.empaqueta(PM.importa(EQ2));
  pon(p, {t: 'c', uid: 'a', k: 0, h: sha256hex(e1 + '|' + llavePk(ca, 0))});
  pon(p, {t: 'c', uid: 'b', k: 0, h: sha256hex(e2 + '|' + llavePk(cb, 0))});
  // Beto intenta cambiar de equipo después de ver el hash de Ana.
  pon(p, {t: 'r', uid: 'b', k: 0, c: e1, l: llavePk(cb, 0)});
  let est = reducir(p);
  assert.ok(est.falsas.b); assert.equal(est.punto, 0);
  // Y una llave inventada tampoco.
  pon(p, {t: 'r', uid: 'a', k: 0, c: e1, l: 'f'.repeat(64)});
  est = reducir(p); assert.ok(est.falsas.a); assert.equal(est.punto, 0);
  pon(p, {t: 'r', uid: 'a', k: 0, c: e1, l: llavePk(ca, 0)});
  pon(p, {t: 'r', uid: 'b', k: 0, c: e2, l: llavePk(cb, 0)});
  est = reducir(p);
  assert.equal(est.punto, 1); assert.equal(est.fase, 'jugando');
});

test('un equipo ilegal en el formato pierde', () => {
  const ubers = `Koraidon @ Choice Scarf
Ability: Orichalcum Pulse
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Flare Blitz
- Collision Course
- U-turn
- Close Combat`;
  const {est} = juega('gen9ou', [ubers, EQ2], req => PM.opciones(req)[0].c);
  assert.equal(est.fase, 'fin'); assert.equal(est.ganador, 'b'); assert.equal(est.motivo, 'equipo');
  assert.ok(est.invalidos.a.length);
  // En Ubers sí vale.
  const {est: e2} = juega('gen9ubers', [ubers, EQ2], req => PM.opciones(req)[0].c);
  assert.notEqual(e2.motivo, 'equipo');
});

test('una elección imposible se cambia por la de por omisión', () => {
  const {est} = juega('gen9ou', [EQ1, EQ2], () => 'move 9', 400);
  assert.equal(est.fase, 'fin');
});

test('rendirse da la victoria al otro', () => {
  n = 0;
  const {p} = sala();
  pon(p, {t: 'rinde', uid: 'a'});
  const est = reducir(p);
  assert.equal(est.ganador, 'b'); assert.equal(est.motivo, 'rinde');
});

test('las opciones de un turno incluyen Tera y los cambios', () => {
  const {p} = sala(); n = 0;
  const {est} = juega('gen9ou', [EQ1, EQ2], req => PM.opciones(req)[0].c, 2);
  const o = PM.opciones(est.peticion[0]).map(x => x.c);
  assert.ok(o.includes('move 1'));
  assert.ok(o.some(c => /terastallize/.test(c)));
  assert.ok(o.some(c => /^switch/.test(c)));
});

test('validación, estadísticas y sprites', () => {
  assert.deepEqual(PM.valida('gen9ou', PM.importa(EQ1)), []);
  const st = PM.estadisticas(PM.importa(EQ1)[0], 'gen9ou');
  assert.equal(st.spe, 333); assert.equal(st.atk, 359);
  assert.equal(PM.numeroSprite('Rotom-Wash'), 10009);
  assert.equal(PM.numeroSprite('Garchomp'), 445);
  assert.match(PM.urlsSprite('Garchomp', {espalda: true})[0], /black-white\/animated\/back\/445\.gif$/);
  assert.match(PM.urlsSprite('Garchomp', {fijo: true})[0], /sprites\/pokemon\/445\.png$/);
  assert.ok(PM.urlsSprite('Gholdengo').every(u => !u.includes('showdown')));
  assert.ok(PM.aprende('Garchomp', 'gen9ou').includes('Earthquake'));
  assert.equal(PM.tipoEficacia('Ground', ['Steel', 'Ghost']), 2);
  assert.equal(PM.tipoEficacia('Ground', ['Flying']), 0);
});

test('el resumen cuenta debilitados y alimenta los logros', () => {
  const r = azar(9);
  const {est} = juega('gen9ou', [EQ1, EQ2], req => { const o = PM.opciones(req); return o[Math.floor(r() * o.length)].c; });
  const [ra, rb] = est.resumen;
  assert.equal(ra.perdidos + rb.perdidos, ra.ko + rb.ko);
  const perdedor = est.ganador === 'a' ? rb : ra;
  assert.equal(perdedor.perdidos, 3); assert.equal(perdedor.vivos, 0);
});

test('el relato cuenta en español y calla lo interno', () => {
  const out = salida.replace('pk-motor-test', 'pk-relato-test');
  esbuild.buildSync({entryPoints: ['src/juegos/pokemon/relato.js'], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error'});
  const {relata} = require(out);
  assert.equal(relata('|move|p1a: Garchomp|Earthquake|p2a: Gholdengo', 0), 'Garchomp usó Earthquake.');
  assert.equal(relata('|move|p2a: Gholdengo|Shadow Ball|p1a: Garchomp', 0), 'Gholdengo rival usó Shadow Ball.');
  assert.equal(relata('|switch|p2a: Dragonite|Dragonite, M|100/100', 0, ['Tú', 'Beto']), 'Beto envía a Dragonite.');
  assert.equal(relata('|-supereffective|p2a: Gholdengo'), '¡Es muy eficaz!');
  assert.equal(relata('|-boost|p1a: Dragonite|atk|2', 0), '¡Ataque de Dragonite subió mucho!');
  assert.equal(relata('|-status|p1a: X|brn', 0), '¡X se ha quemado!');
  assert.equal(relata('|-terastallize|p1a: X|Ground', 0), '¡X se teracristalizó en tipo Tierra!');
  assert.equal(relata('|-start|p2a: Great Tusk|protosynthesisatk', 0), '');
  assert.equal(relata('|t:|123'), '');
});
