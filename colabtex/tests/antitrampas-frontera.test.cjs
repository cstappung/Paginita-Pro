/* Antitrampas de la Frontera Batalla (docs/antitrampas/frontera.md).
   Juega rachas enteras con un robot, como lo haría la pantalla
   (frontera.js: ordinales, historia `h`, libro de victorias, toques), y
   comprueba que el verificador del club las acepta, que las trampas de
   cada vía se rechazan y que `sospecha` no marca lo que el juego siempre
   escribió. El simulador se empaqueta al vuelo con esbuild; en Node el
   verificador usa el `globalThis.PokeMotor` que deja ese paquete. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os'), path = require('node:path');
const esbuild = require('esbuild');

const salida = path.join(os.tmpdir(), 'antitrampas-frontera-motor.cjs');
esbuild.buildSync({entryPoints: ['src/juegos/pokemon/motor-pk.js'], bundle: true, platform: 'node', format: 'cjs', outfile: salida, logLevel: 'error'});
require(salida);
const PM = globalThis.PokeMotor, F = PM.frontera;
const carga = entry => { const mod = {exports: {}}; new Function('module', 'exports', 'require', esbuild.buildSync({entryPoints: [entry], bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'error'}).outputFiles[0].text)(mod, mod.exports, require); return mod.exports; };
const V = carga('src/juegos/solo/verifica.js');
const VF = V.VERIFICADORES.frontera;
const verifica = (dato, prueba) => V.verificaClub('frontera', dato, prueba);
const copia = x => JSON.parse(JSON.stringify(x));   // lo que pasa por localStorage

const FUERTE = PM.importa(`Garchomp @ Life Orb
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Stone Edge
- Swords Dance

Metagross @ Leftovers
Ability: Clear Body
EVs: 252 HP / 252 Atk / 4 Def
Adamant Nature
- Meteor Mash
- Zen Headbutt
- Bullet Punch
- Earthquake

Gyarados @ Sitrus Berry
Ability: Intimidate
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Waterfall
- Crunch
- Dragon Dance
- Earthquake`);
const DEBIL = PM.importa(`Magikarp
Ability: Swift Swim
- Splash
- Tackle

Feebas
Ability: Swift Swim
- Splash
- Tackle

Wurmple
Ability: Shield Dust
- Tackle
- String Shot`);

/* Un ritmo humano: entre la elección anterior y esta pasan la animación
   del turno y lo que se tarda en decidir, con mucha variación. */
const humano = (r, base = 2500) => Math.round(base * (0.35 + r() * 1.6) + r() * 900);

/* Juega una racha como la pantalla. `o.toque(r, i)` da el intervalo de
   cada elección; `o.origen` quién hizo el clic; `o.tramposo(o)` deja
   tocar el combate jugado (el simulador de la página) sin que la prueba
   lo diga. */
function racha(inst, nivel, semilla, combates, o = {}) {
  const r = F.rng('robot|' + semilla);
  const run = {inst, nivel, semilla, n: 1, h: [], tiempo: 0, sw: ''};
  if (inst === 'fabrica') { run.t = o.t || '024'; run.equipo = copia(F.aNivel([...run.t].map(i => F.alquiler(1, semilla, nivel)[+i]), nivel)); }
  else run.equipo = copia(F.aNivel(o.equipo || FUERTE, nivel));
  const libro = [];
  let oMax = o.oMax || 0, tiempoTot = 0;
  while (run.n <= combates) {
    const n = run.n, ord = ++oMax;
    const R = F.rivalDe(inst, n, semilla);
    let rival = F.equipoRival(inst, nivel, n, semilla).sets;
    if (o.tramposo) rival = o.tramposo(rival);
    const P = F.nuevaPelea({semilla: F.semillaPelea(semilla, n, ord), sets: [run.equipo, rival], nombres: ['Ana', R.nombre],
      lados: ['tú', 'cpu'], iq: F.iqDe(n), palacio: inst === 'palacio'});
    const z = [];
    let k = 0;
    while (P.est().fase !== 'fin' && k < 400) {
      const c = F.decideIA(P.battle, 0, 1, F.rng(`t|${semilla}|${n}|${k++}`));
      if (!P.elige(c)) break;
      z.push(F.toque(o.toque ? o.toque(r, z.length) : humano(r), o.origen || 'persona'));
    }
    if (P.est().ganador !== 'tú') break;
    const cod = F.codificaElecciones(P.elecciones);
    run.h.push([ord, cod, run.sw || '', z.join('.')]);
    run.sw = '';
    const dura = o.dura ? o.dura(n) : 20000 + Math.round(r() * 90000);
    run.tiempo += dura; tiempoTot += dura;
    libro.push([`${inst}-${nivel}`, semilla, n, ord, PM.empaqueta(run.equipo), cod, z.join('.')]);
    if (inst === 'fabrica') {
      const suyos = F.aNivel(F.equipoRival(inst, nivel, n, semilla).sets, nivel);
      for (let a = 0; a < 3 && !run.sw; a++) for (let b = 0; b < 3; b++) {
        const nuevo = run.equipo.slice(); nuevo[a] = suyos[b];
        if (!F.validaFrontera(nuevo).length && (n + a + b) % 2 === 0) { run.equipo = copia(nuevo); run.sw = `${a}${b}`; break; }
      }
    }
    run.n = n + 1;
  }
  const n = run.n - 1;
  return {run, n, libro, tiempoTot, oMax,
    dato: {categoria: `club-frontera-${inst}-${nivel}`, puntos: n, tiempo: Math.max(1, run.tiempo), partida: `${semilla}-${n}`},
    prueba: copia(F.pruebaRacha(run))};
}

const torre = racha('torre', '50', 'a1b2c3d4e5f6', 10);
const palacio = racha('palacio', 'abierto', '0f0f0f0f0f0f', 6);
const fabrica = racha('fabrica', '50', '123456abcdef', 6);

test('el robot gana combates de verdad en las tres instalaciones', () => {
  assert.ok(torre.n >= 8, 'torre ' + torre.n);
  assert.ok(palacio.n >= 1, 'palacio ' + palacio.n);
  assert.ok(fabrica.n >= 1, 'fábrica ' + fabrica.n);
  assert.ok(fabrica.run.h.some(x => x[2]), 'la fábrica tiene algún cambio');
});

test('la forma: elecciones, toques y el equipo empaquetado sobreviven al viaje', () => {
  const l = ['move 1', 'switch 3', 'move 4', 'switch 6'];
  assert.equal(F.codificaElecciones(l), '1c4f');
  assert.deepEqual(F.decodificaElecciones('1c4f'), l);
  assert.deepEqual(F.decodificaElecciones(F.codificaElecciones(['move 1 terastallize'])), ['move 1 terastallize']);
  assert.equal(F.decodificaElecciones('1z'), null);
  assert.deepEqual(F.leeToques([F.toque(1234), F.toque(80, 'mando'), F.toque(5, 'script')].join('.')),
    [{ms: 1230, script: false, mando: false}, {ms: 80, script: false, mando: true}, {ms: 10, script: true, mando: false}]);
  assert.equal(F.semillaPelea('abc', 3, 0), 'abc|3');   // los combates de antes no cambian
  // El equipo que se juega es el que el verificador rehace a partir del empaquetado.
  const eq = torre.run.equipo;
  assert.equal(PM.empaqueta(F.aNivel(PM.desempaqueta(PM.empaqueta(eq)), '50')), PM.empaqueta(eq));
});

test('rachas honradas pasan: Torre, Palacio, Fábrica', async () => {
  for (const x of [torre, palacio, fabrica]) assert.equal(await verifica(x.dato, x.prueba), null, x.dato.categoria);
});

test('humanos lentos y rápidos-pero-humanos pasan', async () => {
  const lenta = racha('torre', 'abierto', 'aaaaaaaaaaaa', 4, {toque: r => 20000 + Math.round(r() * 200000), dura: () => 3600000});
  assert.ok(lenta.n >= 2);
  assert.equal(await verifica(lenta.dato, lenta.prueba), null);
  // Rápida: la pestaña con las animaciones saltadas, ~450 ms por elección, un segundo por combate.
  const rapida = racha('torre', '50', 'bbbbbbbbbbbb', 6, {toque: r => 250 + Math.round(r() * 450), dura: () => 1000});
  assert.ok(rapida.n >= 3);
  assert.equal(await verifica(rapida.dato, rapida.prueba), null);
  // Con mando (clics sintéticos de mando.js con un mando conectado).
  const mando = racha('torre', '50', 'cccccccccccc', 3, {origen: 'mando'});
  assert.equal(await verifica(mando.dato, mando.prueba), null);
});

test('la racha que una versión vieja tenía a medias entra sin ordinal ni toques, solo la primera', async () => {
  const x = copia(torre);
  x.prueba.b[0][0] = 0; x.prueba.b[0][3] = null;
  // Con ordinal 0 el combate es el de antes (`semilla|n`): el robot lo vuelve a jugar así.
  const P = F.nuevaPelea({semilla: F.semillaPelea(x.prueba.s, 1, 0), sets: [torre.run.equipo, F.equipoRival('torre', '50', 1, x.prueba.s).sets],
    nombres: ['Ana', 'R'], iq: F.iqDe(1)});
  let k = 0; while (P.est().fase !== 'fin' && k < 400) P.elige(F.decideIA(P.battle, 0, 1, F.rng('v|' + k++)));
  assert.equal(P.est().ganador, 'tú');
  x.prueba.b[0][1] = F.codificaElecciones(P.elecciones);
  assert.equal(await verifica(x.dato, x.prueba), null);
  const y = copia(x); y.prueba.b[1][0] = 0; y.prueba.b[1][3] = null;
  assert.match(await verifica(y.dato, y.prueba), /no tiene ordinal/);
});

test('trampas de número: sin prueba, puntos inflados, tiempo recortado, prueba de otra partida', async () => {
  const {dato, prueba} = torre;
  assert.match(await verifica(dato, null), /sin prueba/);
  assert.match(await verifica({...dato, puntos: dato.puntos + 5}, prueba), /dice/);
  assert.match(await verifica({...dato, tiempo: 999 * dato.puntos}, prueba), /ni un segundo/);
  assert.match(await verifica({...dato, partida: 'ffffffffffff-' + dato.puntos}, prueba), /otra partida/);
  assert.match(await verifica({...dato, categoria: 'club-frontera-torre-abierto'}, prueba), /otra instalación/);
  assert.match(await verifica(fabrica.dato, torre.prueba), /otra instalación/);
  assert.match(await verifica(dato, {...prueba, v: 0}), /versión/);
});

test('trampas de historia: combates que no se ganan, inventados o repetidos', async () => {
  const {dato} = torre;
  // Un combate sin elecciones no termina: no se ganó.
  const a = copia(torre.prueba); a.b[2][1] = ''; a.b[2][3] = '';
  assert.match(await verifica(dato, a), /combate 3 no se gana/);
  // Alargar la racha copiando el último combate (con otro ordinal) es otro combate.
  const b = copia(torre.prueba); const ult = b.b[b.b.length - 1];
  b.b.push([ult[0] + 1, ult[1], '', ult[3]]);
  assert.match(await verifica({...dato, puntos: b.b.length, partida: `${b.s}-${b.b.length}`}, b), /no se gana/);
  // Toques que no van a la par de las elecciones.
  const c = copia(torre.prueba); c.b[1][3] = c.b[1][3].split('.').slice(1).join('.');
  assert.match(await verifica(dato, c), /no se pueden leer/);
  // Un cambio en la Torre, o uno imposible en la Fábrica.
  const d = copia(torre.prueba); d.b[1][2] = '01';
  assert.match(await verifica(dato, d), /cambio/);
  const e = copia(fabrica.prueba); e.b[0][2] = '00';
  assert.match(await verifica(fabrica.dato, e), /cambio/);
  const f = copia(fabrica.prueba); f.t = '002';
  assert.match(await verifica(fabrica.dato, f), /equipo/);
});

test('trampas de equipo: legendarios, más de cuatro movimientos', async () => {
  const mew = PM.importa('Mewtwo\nAbility: Pressure\n- Psystrike\n- Recover');
  const a = copia(torre.prueba); a.e = PM.empaqueta(F.aNivel([mew[0], ...FUERTE.slice(1)], '50'));
  assert.match(await verifica(torre.dato, a), /equipo/);
  const cinco = copia(FUERTE); cinco[0].moves.push('Fire Fang');
  assert.ok(F.validaFrontera(cinco).length, 'la propia Frontera ya lo refuta al elegir');
  const b = copia(torre.prueba); b.e = PM.empaqueta(F.aNivel(cinco, '50'));
  assert.match(await verifica(torre.dato, b), /equipo/);
});

test('el simulador tocado desde la consola: lo que se gana así no se gana en la prueba', async () => {
  // Con el equipo flojo se pierde el primer combate…
  const honrada = racha('torre', '50', 'dddddddddddd', 3, {equipo: DEBIL});
  assert.equal(honrada.n, 0);
  // …pero con los rivales a nivel 1 (un `PokeMotor` parcheado en la página) se gana.
  const trampa = racha('torre', '50', 'dddddddddddd', 3, {equipo: DEBIL, tramposo: sets => sets.map(s => ({...s, level: 1}))});
  assert.equal(trampa.n, 3);
  assert.match(await verifica(trampa.dato, trampa.prueba), /combate 1 no se gana/);
});

test('bots: clics de script, metrónomo y ritmo inhumano se rechazan', async () => {
  const script = racha('torre', '50', 'eeeeeeeeeeee', 3, {origen: 'script'});
  assert.match(await verifica(script.dato, script.prueba), /script/);
  const metronomo = racha('torre', '50', 'eeeeeeeeeeee', 8, {toque: () => 1200});
  assert.ok(metronomo.prueba.b.reduce((s, x) => s + x[3].split('.').length, 0) >= 20);
  assert.match(await verifica(metronomo.dato, metronomo.prueba), /metrónomo/);
  const veloz = racha('torre', '50', 'eeeeeeeeeeee', 8, {toque: r => 120 + Math.round(r() * 200)});
  assert.match(await verifica(veloz.dato, veloz.prueba), /ritmo de un programa/);
  const instante = racha('torre', '50', 'eeeeeeeeeeee', 3, {toque: () => 30});
  assert.match(await verifica(instante.dato, instante.prueba), /menos de 100 ms/);
  // Unos pocos toques imposibles (el reloj del aparato que salta) se toleran.
  const z = F.leeToques(torre.prueba.b.map(x => x[3]).join('.'));
  z[0].ms = 0; z[5].ms = 20;
  assert.equal(F.ritmoHumano(z), null);
});

test('victorias: el libro sobre la fila de la tabla, sin contar dos veces', async () => {
  const libro = [...torre.libro, ...palacio.libro.map(x => x.slice())];
  // Ordinales de la otra racha por encima de los de la Torre, como los reparte la pantalla.
  libro.slice(torre.libro.length).forEach((x, i) => { x[3] = torre.oMax + 1 + i; });
  // El palacio se jugó con otros ordinales: se rehacen con los nuevos.
  const pal = racha('palacio', 'abierto', '0f0f0f0f0f0f', 6, {oMax: torre.oMax});
  const todo = [...torre.libro, ...pal.libro];
  const x = F.pruebaVictorias(37, 0, copia(todo));
  assert.equal(x.usadas, todo.length);
  const dato = {categoria: 'club-frontera-victorias', puntos: x.puntos, tiempo: 5000000, partida: x.partida};
  assert.equal(await verifica(dato, copia(x.prueba)), null);
  // La siguiente subida parte de esa fila: las viejas ya no cuentan.
  const y = F.pruebaVictorias(x.puntos, +x.partida.slice(3), copia(todo));
  assert.equal(y.usadas, 0);
  assert.equal(y.descartar.length, todo.length);
  // Trampas: base que no suma, una vieja que vuelve, una repetida, una perdida, otra partida.
  assert.match(await verifica({...dato, puntos: x.puntos + 1}, x.prueba), /suma/);
  assert.match(await verifica(dato, {...copia(x.prueba), h: 3}), /ya estaba en la tabla/);
  const rep = copia(x.prueba); rep.l[1][3] = rep.l[0][3];
  assert.match(await verifica(dato, rep), /dos veces/);
  const per = copia(x.prueba); per.l[0][5] = ''; per.l[0][6] = '';
  assert.match(await verifica(dato, per), /no se gana/);
  assert.match(await verifica({...dato, partida: 'fv-999999'}, x.prueba), /otra partida/);
  const bot = copia(x.prueba); bot.l.forEach(f => { f[6] = f[6] && f[6].split('.').map(t => '!' + t.replace(/^[!m]/, '')).join('.'); });
  assert.match(await verifica(dato, bot), /script/);
  void libro;
});

test('el verificador recuerda lo ya rehecho, y solo eso', async () => {
  const x = racha('torre', '50', '9a9a9a9a9a9a', 6);
  assert.ok(x.n >= 4);
  const parte = n => ({dato: {...x.dato, puntos: n, partida: `${x.prueba.s}-${n}`, tiempo: x.dato.tiempo}, prueba: {...copia(x.prueba), b: x.prueba.b.slice(0, n)}});
  const a = parte(x.n - 1);
  assert.equal(await verifica(a.dato, a.prueba), null);
  const t0 = Date.now(); const b = parte(x.n);
  assert.equal(await verifica(b.dato, b.prueba), null);
  const rapido = Date.now() - t0;
  // Cambiar un combate ya comprobado obliga a rehacerlo todo: no se cuela.
  const c = parte(x.n); c.prueba.b[0][1] = ''; c.prueba.b[0][3] = '';
  assert.match(await verifica(c.dato, c.prueba), /combate 1 no se gana/);
  assert.ok(rapido < 5000, rapido);
});

test('sospecha: lo que el juego siempre escribió no se marca, lo demás sí', () => {
  const s = (c, f) => VF.sospecha(c, f);
  // La fila real de la migración de `mejor` sin `tMejor`: tiempo en el tope.
  assert.equal(s('club-frontera-fabrica-50', {puntos: 7, tiempo: 604800000, partida: 'fr-fabrica-50-7-AbCd1234'}), null);
  assert.equal(s('club-frontera-torre-50', {puntos: 21, tiempo: 21 * 60000, partida: 'a1b2c3d4e5f6-21'}), null);
  assert.equal(s('club-frontera-torre-50', {puntos: 21, tiempo: 21000, partida: 'a1b2c3d4e5f6-21'}), null);
  assert.equal(s('club-frontera-victorias', {puntos: 40, tiempo: 4000000, partida: 'a1b2c3d4e5f6-12v'}), null);
  assert.equal(s('club-frontera-victorias', {puntos: 40, tiempo: 604800000, partida: 'frv-40-AbCd1234'}), null);
  assert.equal(s('club-frontera-victorias', {puntos: 40, tiempo: 4000000, partida: 'fv-57'}), null);
  assert.match(s('club-frontera-torre-50', {puntos: 999, tiempo: 999000, partida: 'hack'}), /forma/);
  assert.match(s('club-frontera-torre-50', {puntos: 30, tiempo: 900000, partida: 'a1b2c3d4e5f6-21'}), /dice 21/);
  assert.match(s('club-frontera-torre-50', {puntos: 50, tiempo: 20000, partida: 'a1b2c3d4e5f6-50'}), /un segundo/);
  assert.match(s('club-frontera-torre-50', {puntos: 7, tiempo: 1e6, partida: 'fr-palacio-50-7-AbCd1234'}), /forma/);
  assert.match(s('club-frontera-victorias', {puntos: 100000, tiempo: 5000, partida: 'frv-100000-x'}), /cuarto de segundo/);
  assert.match(s('club-frontera-victorias', {puntos: 5, tiempo: 50000, partida: 'frv-6-x'}), /forma/);
});

test('el registro exige la prueba de la Frontera', () => {
  assert.equal(VF.PRUEBA, 1);
});
