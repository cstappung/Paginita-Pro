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
  // Calle Victoria: solo entrenadores y capturas, sin hierba ni centros.
  for (let s = 1; s < 200; s++) {
    const tipos = new Set(M.generarMapa(s, 8).capas.flat().map(n => n.tipo));
    assert.ok(!tipos.has('salvaje') && !tipos.has('centro'), `semilla ${s}`);
  }
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

const DEX = require('../../juegos/club/pokelike/pokedex.js');

test('Pokédex: marcar solo sube (sin ver → visto → capturado)', () => {
  const dex = DEX.normaliza(null);
  assert.strictEqual(DEX.marca(dex, 25, 1), true);
  assert.strictEqual(DEX.marca(dex, 25, 1), false);
  assert.strictEqual(DEX.marca(dex, 25, 2), true);
  assert.strictEqual(DEX.marca(dex, 25, 1), false);
  assert.strictEqual(dex.d[24], '2');
  assert.strictEqual(DEX.marca(dex, 0, 1), false);
  assert.strictEqual(DEX.marca(dex, 152, 1), false);
  assert.deepStrictEqual(DEX.cuenta(dex), { vistos: 1, capturados: 1, total: 151, medallas: 0, liga: 0 });
});

test('Pokédex: mezclar navegador y cuenta se queda con lo máximo', () => {
  const a = DEX.normaliza(null), b = DEX.normaliza(null);
  DEX.marca(a, 1, 2); DEX.marca(a, 4, 1); a.medallas = 3;
  DEX.marca(b, 4, 2); DEX.marca(b, 7, 1); b.medallas = 1; b.liga = 1;
  const m = DEX.mezclar(a, b);
  assert.deepStrictEqual([m.d[0], m.d[3], m.d[6], m.d[9]], ['2', '2', '1', '0']);
  assert.strictEqual(m.medallas, 3);
  assert.strictEqual(m.liga, 1);
  assert.ok(DEX.iguales(DEX.mezclar(b, a), m));
  assert.ok(DEX.iguales(DEX.mezclar(m, null), m));
});

test('Pokédex: datos rotos o de otra forma se descartan', () => {
  const n = DEX.normaliza({ d: '3'.repeat(151), medallas: 99, liga: 'si', extra: 1 });
  assert.deepStrictEqual(n, { d: '0'.repeat(151), medallas: 8, liga: 0 });
  assert.strictEqual(DEX.normaliza({ d: '1'.repeat(150) }).d, '0'.repeat(151));
});

test('captura con el equipo lleno: el nuevo ocupa la casilla del que se libera', () => {
  const run = M.debugEmpezarEn(7, 1, 3);
  assert.strictEqual(run.equipo.length, M.MAX_EQUIPO);
  const antes = run.equipo.map(p => p.uid);
  run.fase = 'captura';
  run.oferta = [{ uid: 999, e: 25, nv: 10, xp: 0, ps: 30 }];
  assert.strictEqual(M.capturar(run, 0), false);
  assert.strictEqual(M.capturar(run, 0, 2), true);
  assert.deepStrictEqual(run.equipo.map(p => p.uid), [...antes.slice(0, 2), 999, ...antes.slice(3)]);
  assert.strictEqual(run.fase, 'mapa');
});

test('el equipo que muestra el ojito es el mismo con el que pelea el jefe', () => {
  for (const inicial of [1, 4, 7]) for (let t = 0; t < 9; t++) {
    const run = M.debugEmpezarEn(11, inicial, t);
    M.debugIrAlJefe(run);
    const jefe = M.siguientes(run).map(id => M.nodo(run, id)).find(n => n.tipo === 'jefe');
    const vista = M.equipoJefe(run, jefe.jefe || 0);
    assert.ok(M.entrar(run, jefe.id));
    assert.deepStrictEqual(run.combate.enemigos.map(p => [p.e, p.nv]), vista, `tramo ${t}, inicial ${inicial}`);
  }
});

test('Ruta Infinita: entrenadores, capturas y centros; la dificultad sube cada 3 victorias y suma puntaje', () => {
  const run = M.debugInfinito(5, 4);
  assert.ok(run.infinito);
  assert.strictEqual(run.equipo.length, 6);
  assert.ok(run.equipo.every(p => p.nv === 75));
  assert.strictEqual(M.puntaje(run), 8 * 100 + 4 * 150 + 500);
  const tipos = new Set();
  let niveles = [], pisos = new Set(), ofertas = [];
  for (let k = 0; k < 80; k++) {
    run.mapa.capas.flat().forEach(n => tipos.add(n.tipo));
    if (run.fase === 'centro') { M.salirCentro(run); continue; }
    if (run.fase === 'captura') { ofertas.push([M.nivelInfinito(run), ...run.oferta.map(p => p.nv)]); M.capturar(run, null); continue; }
    const sig = M.siguientes(run);
    assert.ok(sig.length, `sin salida en el piso ${run.infinito.piso}`);
    M.entrar(run, sig[0]);
    pisos.add(run.infinito.piso);
    if (run.fase === 'combate') {
      niveles.push([M.dificultad(run), run.combate.enemigos[0].nv, run.combate.enemigos.length]);
      M.debugGanar(run); M.terminarCombate(run);
    }
  }
  assert.deepStrictEqual([...tipos].sort(), ['captura', 'centro', 'entrenador', 'inicio']);
  assert.ok(ofertas.length, 'hay capturas');
  for (const [nvRival, ...nvs] of ofertas) assert.ok(nvs.every(nv => nv <= nvRival - 13), 'las capturas salen más bajas que los rivales');
  assert.ok(pisos.size >= 2, 'pasa al piso siguiente');
  assert.strictEqual(M.dificultad(run), Math.floor(run.infinito.victorias / M.INF_CADA));
  const [d0, nv0] = niveles[0], [dN, nvN, nN] = niveles.at(-1);
  assert.ok(dN > d0 && nvN > nv0, 'los rivales suben');
  assert.ok(nN >= 3 && nN <= 6);
  assert.ok(M.puntaje(run) > 1900);
});

test('Liga: cada miembro del Alto Mando vencido suma y el Campeón cierra con 1900', () => {
  const run = M.debugLigaFuerte(9, 1, 100);
  M.debugIrAlJefe(run);
  const vistos = [];
  while (run.fase !== 'fin') {
    const sig = M.siguientes(run).find(id => M.nodo(run, id).tipo === 'jefe');
    assert.ok(sig);
    M.entrar(run, sig);
    vistos.push(run.combate.rival.nombre);
    M.debugGanar(run); M.terminarCombate(run);
  }
  assert.deepStrictEqual(vistos, ['Lorelei', 'Bruno', 'Agatha', 'Lance', 'Azul']);
  assert.strictEqual(run.ligaVencidos, 4);
  assert.strictEqual(run.campeon, true);
  assert.strictEqual(M.puntaje(run), 1900);
  assert.ok(M.empezarInfinito(run));
  assert.strictEqual(run.fase, 'mapa');
});

test('antes de Lorelei el equipo se cura entero (la Calle Victoria no tiene centros)', () => {
  const run = M.debugLigaFuerte(13, 7, 55);
  M.debugIrAlJefe(run);
  run.equipo.forEach(p => { p.ps = 1; });
  run.equipo[5].ps = 0;
  const sig = M.siguientes(run).find(id => M.nodo(run, id).tipo === 'jefe');
  M.entrar(run, sig);
  assert.strictEqual(run.combate.rival.nombre, 'Lorelei');
  assert.ok(run.equipo.every(p => p.ps === M.stats(p.e, p.nv).ps));
});
