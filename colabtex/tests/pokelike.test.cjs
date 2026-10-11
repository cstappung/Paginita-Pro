// Pokelike: el motor puro (juegos/club/pokelike/motor.js) — mapa con semilla,
// combate, experiencia, evoluciones y runs completas en automático.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../../juegos/club/pokelike/motor.js');

test('los 151 de Gen 1 con tipos modernos', () => {
  assert.strictEqual(Object.keys(M.ESP).length, 151);
  assert.deepStrictEqual(M.ESP[35].t, ['Hada']);          // Clefairy
  assert.deepStrictEqual(M.ESP[81].t, ['Eléctrico', 'Acero']); // Magnemite
  for (const e of Object.values(M.ESP)) for (const t of e.t) assert.ok(M.D.TABLA[t], t);
});

test('tabla de tipos', () => {
  assert.strictEqual(M.efectividad('Agua', ['Roca', 'Tierra']), 4);
  assert.strictEqual(M.efectividad('Normal', ['Fantasma']), 0);
  assert.strictEqual(M.efectividad('Dragón', ['Hada']), 0);
  assert.strictEqual(M.efectividad('Fuego', ['Agua']), 0.5);
});

test('misma semilla, mismo mapa; todo nodo alcanzable y con salida', () => {
  assert.deepStrictEqual(M.generarMapa(42), M.generarMapa(42));
  assert.notDeepStrictEqual(M.generarMapa(42), M.generarMapa(43));
  for (let s = 1; s < 200; s++) {
    const { capas, aristas } = M.generarMapa(s);
    capas.forEach((capa, c) => capa.forEach(n => {
      if (c > 0) assert.ok(aristas.some(([, a]) => a === n.id), `sin llegada ${n.id}`);
      if (c < capas.length - 1) assert.ok(aristas.some(([d]) => d === n.id), `sin salida ${n.id}`);
    }));
    assert.strictEqual(capas.at(-1)[0].tipo, 'jefe');
    assert.strictEqual(capas.at(-2)[0].tipo, 'centro');
  }
});

test('movimientos: máximo 4, se aprenden más fuertes al subir', () => {
  assert.deepStrictEqual(M.movimientos(4, 5).map(m => m.nombre), ['Ascuas', 'Garra Metal', 'Placaje']);
  const alto = M.movimientos(6, 45);
  assert.ok(alto.length <= 4 && alto.some(m => m.nombre === 'Llamarada'));
});

test('solo se entra a un nodo conectado', () => {
  const run = M.nuevaRun(7, 7);
  assert.strictEqual(M.entrar(run, '5-0'), false);
  assert.strictEqual(M.entrar(run, M.siguientes(run)[0]), true);
  assert.strictEqual(run.fase, 'captura');
});

test('una run se reproduce igual desde la semilla y termina', () => {
  for (const ini of [1, 4, 7]) {
    const a = M.simular(1234, ini), b = M.simular(1234, ini);
    assert.deepStrictEqual(a, b);
    assert.strictEqual(a.fase, 'fin');
    assert.ok(['victoria', 'derrota'].includes(a.resultado));
  }
});

test('se puede ganar a Brock y se evoluciona en el camino', () => {
  let medallas = 0, evoluciones = 0;
  for (let s = 1; s <= 100; s++) {
    const r = M.simular(s * 31, 7);
    if (r.medallas > 0) medallas++;
    if (r.equipo.some(p => p.e !== 7 && [8, 9].includes(p.e))) evoluciones++;
  }
  assert.ok(medallas > 20, `medallas ${medallas}`);
  assert.ok(evoluciones > 0);
});

test('Kanto: ocho gimnasios con medalla y la Liga con cinco jefes en fila', () => {
  assert.strictEqual(M.D.TRAMOS.length, 9);
  M.D.TRAMOS.slice(0, 8).forEach(t => assert.ok(t.jefes.length === 1 && t.jefes[0].medalla));
  const liga = M.generarMapa(5, 8);
  const jefes = liga.capas.filter(c => c[0].tipo === 'jefe');
  assert.deepStrictEqual(jefes.map(c => c[0].jefe), [0, 1, 2, 3, 4]);
  assert.strictEqual(liga.capas[liga.capas.length - 6][0].tipo, 'centro');
});

test('ganar un gimnasio da medalla y abre el mapa siguiente con el equipo curado', () => {
  const run = M.nuevaRun(3, 1);
  M.debugIrAlJefe(run);
  M.entrar(run, M.siguientes(run)[0]);
  assert.strictEqual(run.combate.rival.nombre, 'Brock');
  M.debugGanar(run); M.terminarCombate(run);
  assert.strictEqual(run.fase, 'medalla');
  assert.strictEqual(run.medallas, 1);
  run.equipo[0].ps = 1;
  M.siguienteTramo(run);
  assert.strictEqual(run.tramo, 1);
  assert.strictEqual(run.equipo[0].ps, M.stats(run.equipo[0].e, run.equipo[0].nv).ps);
});

test('los rivales de nivel alto salen evolucionados', () => {
  const run = M.debugEmpezarEn(9, 4, 7);
  for (let k = 0; k < 30; k++) {
    if (run.fase !== 'mapa') { run.combate = null; run.oferta = null; run.fase = 'mapa'; }
    const sig = M.siguientes(run); if (!sig.length) break;
    M.entrar(run, sig[0]);
    if (run.combate && run.combate.tipo === 'jefe') continue; // los equipos de los líderes son fijos
    for (const p of (run.combate ? run.combate.enemigos : run.oferta || []))
      assert.ok(!M.ESP[p.e].evo.some(x => p.nv >= x.nv), `${M.ESP[p.e].n} Nv ${p.nv} sin evolucionar`);
  }
});

test('modo prueba: inmortal convierte la derrota en victoria; los atajos marcan la run', () => {
  const run = M.nuevaRun(4, 4);
  M.debugIrAlJefe(run);
  M.entrar(run, M.siguientes(run)[0]);
  run.equipo.forEach(p => { p.ps = 0; });
  run.combate.fin = 'pierde';
  M.terminarCombate(run, { inmortal: true });
  assert.strictEqual(run.fase, 'medalla');
  assert.ok(run.debug);
  assert.ok(run.equipo.every(p => p.ps > 0));
  const r2 = M.debugEmpezarEn(1, 7, 8);
  assert.strictEqual(r2.tramo, 8);
  assert.strictEqual(r2.equipo.length, 6);
  M.debugSaltarTramo(r2);
  assert.strictEqual(r2.resultado, 'victoria');
});

test('modo manual: el movimiento elegido es el que se usa', () => {
  const run = M.nuevaRun(99, 1);
  while (run.fase !== 'combate') {
    if (run.fase === 'mapa') M.entrar(run, M.siguientes(run).at(-1));
    else if (run.fase === 'captura') M.capturar(run, null);
    else if (run.fase === 'centro') M.salirCentro(run);
  }
  const ev = M.pasoCombate(run, 1);
  const mio = ev.find(e => e.t === 'ataque' && e.lado === 'j');
  if (mio) assert.strictEqual(mio.mov, M.movimientos(run.equipo[0].e, 5)[1].nombre);
});
