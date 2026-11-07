/* Pro Kingdoms (juegos/prokingdoms/): las tablas de js/data.js y los arreglos de la Fase 0 del plan
   (juegos/prokingdoms/PLAN-MEGA-ACTUALIZACION.md, T3). Carga los js/ del juego en Node con un `window`
   falso, como hace server/sim.js. Si una comprobación falla, casi siempre es una tabla nueva a la que le
   falta algo (una misión que pide una estadística que nadie registra, un edificio sin dibujo).

   Huella de los lugares del mapa (solo al reiniciar a propósito con un D.MAPV nuevo), desde colabtex/:
   node -e "const vm=require('vm'),fs=require('fs'),d='../juegos/prokingdoms/js/',w={},c=vm.createContext({window:w,URLSearchParams});
     for(const f of ['util','data','world'])vm.runInContext(fs.readFileSync(d+f+'.js','utf8'),c);const {D,World:W}=w.PK;D.setupRealms(-1,null);
     W.generate(D.SEED);fs.writeFileSync('tests/fixtures/prokingdoms-pois.json',JSON.stringify({mapv:D.MAPV,pois:W.pois.slice(0,300).map(p=>[p.kind,p.x,p.y])}))" */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const PKDIR = path.join(__dirname, '..', '..', 'juegos', 'prokingdoms');
const JS = f => fs.readFileSync(path.join(PKDIR, 'js', f), 'utf8');
function carga(files) {
  const win = {}, ctx = vm.createContext({ window: win, console, URLSearchParams, location: { search: '' }, performance: { now: () => Date.now() } });
  for (const f of files) vm.runInContext(JS(f), ctx, { filename: f });
  const PK = win.PK;
  PK.D.setupRealms(-1, null);
  PK.World.generate(PK.D.SEED);
  return PK;
}
const PK = carga(['util.js', 'data.js', 'pase.js', 'world.js', 'entities.js', 'game.js', 'auto.js', 'logistics.js', 'consejo.js', 'asesor.js', 'heroes.js', 'incursion.js', 'life.js', 'aventura.js', 'leyendas.js', 'campana.js', 'datos-vida.js', 'datos-mar.js', 'vida.js']);
const { D, World: W, Game: G } = PK;
// ojo: los arreglos que vienen del vm tienen otro prototipo, y deepEqual estricto los da por distintos
const FUENTES = fs.readdirSync(path.join(PKDIR, 'js')).filter(f => f.endsWith('.js')).map(f => [f, JS(f)]);
const TODO = FUENTES.map(([, s]) => s).join('\n');

// Toda la lista de pedidos de las misiones, diarias y semanales.
function pedidos() {
  const out = [];
  const walk = (r, de) => { if (!r) return; if (r.t) out.push([r, de]); if (r.of) for (const x of r.of) walk(x, de); };
  for (const q of D.QUESTS) walk(q.req, q.id);
  for (const d of D.DAILY.concat(D.WEEKLY)) out.push([{ t: 'stat', k: d.k }, d.id]);
  return out;
}

test('toda estadística que piden las misiones tiene quien la registre', () => {
  const fijas = new Set();
  for (const re of [/\.stat\(\s*'([A-Za-z0-9_]+)'\s*,/g, /stats\.([A-Za-z0-9_]+)\s*=/g, /stats\['([A-Za-z0-9_]+)'\]\s*=/g])
    for (const m of TODO.matchAll(re)) fijas.add(m[1]);
  const zonas = new Set(W.zones.filter(z => z.common).flatMap(z => [z.id, z.type].filter(Boolean)));
  const salidas = new Set(Object.values(D.RECIPES).flatMap(r => Object.keys(r.out)));
  const lugares = new Set(W.pois.map(p => p.kind));
  // las que se arman con un prefijo: g_<recurso>, p_<producto>, sp_<especial>, floor_<lugar>, z_<zona o tipo>
  const dinamica = k => {
    const [, pre, resto] = /^([a-z]+)_(.+)$/.exec(k) || [];
    if (pre === 'g') return !!D.RES[resto];
    if (pre === 'p') return salidas.has(resto);
    if (pre === 'sp') return D.SPECIAL.includes(resto);
    if (pre === 'floor') return lugares.has(resto);
    if (pre === 'z') return zonas.has(resto);
    return false;
  };
  const malas = pedidos().filter(([r]) => r.t === 'stat' && !fijas.has(r.k) && !dinamica(r.k)).map(([r, de]) => de + ' pide ' + r.k);
  assert.deepEqual(malas, [], 'misiones imposibles (B3 era «z_forest»)');
  assert.ok(D.QUESTS.find(q => q.id === 'e3').req.k === 'z_tree');
});

test('toda marca (flag) que piden las misiones se escribe en algún lado', () => {
  const sinData = FUENTES.filter(([f]) => f !== 'data.js').map(([, s]) => s).join('\n');
  const malas = pedidos().filter(([r]) => r.t === 'flag' && !sinData.includes(r.k)).map(([r, de]) => de + ' pide ' + r.k);
  assert.deepEqual(malas, []);
});

test('los prerrequisitos existen y no forman ciclos', () => {
  const por = new Map(D.QUESTS.map(q => [q.id, q]));
  assert.equal(por.size, D.QUESTS.length, 'ids repetidos');
  for (const q of D.QUESTS) for (const p of q.pre) assert.ok(por.has(p), q.id + ' pide ' + p + ', que no existe');
  const estado = new Map();
  const visita = (id, camino) => {
    if (estado.get(id) === 2) return;
    assert.notEqual(estado.get(id), 1, 'ciclo: ' + camino.concat(id).join(' → '));
    estado.set(id, 1);
    for (const p of por.get(id).pre) visita(p, camino.concat(id));
    estado.set(id, 2);
  };
  for (const q of D.QUESTS) visita(q.id, []);
});

test('todo edificio tiene dibujo, estadísticas y lugar en el orden de construcción', () => {
  const sp = JS('sprites.js'), i = sp.indexOf('const BDRAW = {'), bloque = sp.slice(i, sp.indexOf('\n  };', i)), mar = JS('sprites-mar.js');
  for (const t of Object.keys(D.BUILD)) {
    if (!D.BUILD[t].noUp) assert.equal(typeof D.BSTATS[t], 'function', t + ' se mejora pero no tiene D.BSTATS');
    // los del archipiélago (pk-28) se dibujan en sprites-mar.js y se construyen desde la lista del mar
    if (D.BUILD[t].mar) {
      assert.ok(mar.includes('BD.' + t + ' = function'), t + ' no tiene dibujo en sprites-mar.js');
      if (t !== 'colonia') assert.ok(D.MAR.construir.includes(t), t + ' no está en D.MAR.construir');
      continue;
    }
    assert.ok(new RegExp('\\b' + t + '\\s*[:(]').test(bloque), t + ' no tiene BDRAW en sprites.js');
    if (!D.BUILD[t].retirada) assert.ok(D.BUILD_ORDER.includes(t), t + ' no está en D.BUILD_ORDER');
  }
  // lo que se construye en el mar y es de la tierra se dibuja distinto allá
  for (const t of D.MAR.construir) assert.ok(D.BUILD[t], t + ' no existe');
  for (const t in D.MAR.edificios) assert.ok(mar.includes('BD.' + t + ' = function'), t + ' no tiene su dibujo del mar');
});

test('todo recurso especial cuesta algo', () => {
  const usados = new Set();
  const mira = o => { if (!o || typeof o !== 'object') return; for (const k in o) { if (D.SPECIAL.includes(k) && typeof o[k] === 'number') usados.add(k); mira(o[k]); } };
  for (const t in D.BUILD) { mira(D.BUILD[t].cost); mira(D.BUILD[t].up); }
  for (const a in D.ARMY) mira(D.ARMY[a].cost);
  for (const t in D.TECHS) mira(D.TECHS[t].base);
  assert.deepEqual([...D.SPECIAL].filter(k => !usados.has(k)), []);
});

test('toda tropa tiene su figura en la batalla (TROPA)', () => {
  const b = JS('batalla.js'), i = b.indexOf('const TROPA = {'), bloque = b.slice(i, b.indexOf('\n  };', i));
  for (const id of Object.keys(D.ARMY)) assert.ok(new RegExp('\\n\\s+' + id + ': \\{').test(bloque), id + ' no está en TROPA');
});

// Hoy las bestias solo tienen al Lancero; la Fase 4 del plan suma tropas (Jinete, Ballestero…) y lo arregla.
test('todo enemigo tiene al menos 2 tropas con ventaja', () => {
  for (const e of Object.keys(D.ENEMY)) {
    const buenas = Object.keys(D.ARMY).filter(a => (D.ARMY[a].vs[e] || 1) > 1);
    assert.ok(buenas.length >= 2, e + ': ' + buenas.join(', '));
  }
});

test('los costos crecen con el nivel', () => {
  const suma = c => Object.values(c).reduce((s, v) => s + v, 0);
  for (const t of Object.keys(D.BUILD)) {
    if (D.BUILD[t].noUp) continue;
    for (let L = 1; L < 15; L++) assert.ok(suma(D.upCost(t, L + 1)) > suma(D.upCost(t, L)), t + ' nivel ' + L);
  }
  for (let n = 2; n < 12; n++) assert.ok(suma(D.eraCost(n + 1)) > suma(D.eraCost(n)), 'era ' + n);
  for (const id of Object.keys(D.TECHS)) for (let l = 0; l < 10; l++) assert.ok(suma(G.techCost(id, l + 1)) > suma(G.techCost(id, l)), id + ' ' + l);
});

// Las partidas guardan S.pois por la posición en W.pois: si un lugar nuevo se inserta en el medio sin
// reiniciar (D.MAPV + D.SAVE_V), todos los descubrimientos se corren. Al reiniciar a propósito, regenera
// la huella (el comando está en juegos/prokingdoms/CLAUDE.md).
test('los lugares del mapa no cambian de número', () => {
  const h = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'prokingdoms-pois.json'), 'utf8'));
  assert.equal(h.mapv, D.MAPV, 'subiste D.MAPV: regenera la huella');
  assert.deepEqual(JSON.parse(JSON.stringify(W.pois.slice(0, h.pois.length).map(p => [p.kind, p.x, p.y]))), h.pois); // arreglos del vm → normales
});

// ---------- Fase 0 ----------

test('B1: «+» en Aldeanos usa a un aldeano al que ya se le pasó el susto (scared negativo)', () => {
  const llamados = [];
  PK.UI = { toast: () => {} };
  const setJob = PK.Auto.setJob;
  PK.Auto.setJob = (us, job) => { llamados.push([us[0].id, job]); return 1; };
  G.units = [{ id: 1, owner: 'p', kind: 'v', task: null, inside: false, scared: -0.03 }];
  try {
    assert.equal(PK.Auto.addJob('ore'), true);
    assert.deepEqual(llamados, [[1, 'ore']]);
    G.units = [{ id: 2, owner: 'p', kind: 'v', task: null, inside: false, scared: 3 }];
    assert.equal(PK.Auto.addJob('ore'), false, 'uno asustado de verdad no se mueve');
  } finally { PK.Auto.setJob = setJob; G.units = []; }
});

test('B2: no se puede cerrar el patio del Centro Urbano', () => {
  // mapa plano y libre, todo tuyo y descubierto
  W.block.fill(0); W.terrain.fill(0); W.bAt.fill(-1); W.belt.fill(-1); W.wall.fill(0); W.fog.fill(1);
  const ownerAt = W.ownerAt;
  W.ownerAt = () => 'p';
  try {
    G.buildings.length = 0; G.bById.clear();
    G.addBuilding('tc', 'p', 100, 100, true, 1);
    // anillo de 2 de grosor alrededor del patio (94..109), con una puerta de 2 casillas arriba en x 101..102
    for (let y = 94; y <= 109; y++) for (let x = 94; x <= 109; x++) {
      const borde = x <= 95 || x >= 108 || y <= 95 || y >= 108, puerta = y <= 95 && (x === 101 || x === 102);
      if (borde && !puerta) W.block[W.idx(x, y)] = 2;
    }
    G.blockVer++;
    assert.equal(G.placeWhy('house', 101, 94), 'encierra', 'la casa que tapa la puerta');
    assert.match(G.placeText('encierra'), /encerrarías/);
    assert.equal(G.placeWhy('house', 150, 150), null, 'lejos, sin problema');
    assert.equal(G.placeWhy('house', 97, 97), null, 'dentro del patio, con la puerta abierta');
    // un pueblo que ya estaba cerrado (murallas sin puerta) no se traba: solo cuenta lo que corta el edificio
    W.block[W.idx(101, 94)] = W.block[W.idx(102, 94)] = 2;
    G.blockVer++;
    assert.equal(G.placeWhy('house', 97, 97), null);
    assert.ok(W.reachCount([[100, 100, 4, 4]]) < 200, 'el patio quedó chico');
    assert.ok(W.biggestRegion().n > 60000);
  } finally { W.ownerAt = ownerAt; G.buildings.length = 0; G.bById.clear(); }
});

test('P1: el servidor reinicia el mundo cuando cambia D.MUNDO_VER (sin tocar las sospechas)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-mundo-'));
  const corre = () => execFileSync(process.execPath, ['-e', "require(process.argv[1]); require('./store').flush();", path.join(PKDIR, 'server', 'sim.js')],
    { cwd: path.join(PKDIR, 'server'), env: Object.assign({}, process.env, { PK_DATA: dir, PK_TICK_PEREZOSO: '1' }), stdio: 'pipe' });
  const lee = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
  try {
    fs.mkdirSync(path.join(dir, 'saves'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'players.json'), JSON.stringify({ p1: { id: 'p1', token: 't1', world: 'w1', slot: 0 } }));
    fs.writeFileSync(path.join(dir, 'saves', 'p1.json'), '{}');
    fs.writeFileSync(path.join(dir, 'sospechas.log'), '{"x":1}\n');
    corre(); // sin versión anotada: la anota y no borra nada
    assert.equal(lee('mundo.json').v, D.MUNDO_VER);
    assert.ok(lee('players.json').p1, 'el primer arranque no reinicia');
    fs.writeFileSync(path.join(dir, 'mundo.json'), JSON.stringify({ v: D.MUNDO_VER - 1 }));
    corre(); // otra versión: borra jugadores y partidas
    assert.equal(lee('mundo.json').v, D.MUNDO_VER);
    assert.ok(!lee('players.json') || !Object.keys(lee('players.json')).length, 'jugadores borrados');
    assert.ok(!fs.existsSync(path.join(dir, 'saves', 'p1.json')), 'partidas borradas');
    assert.match(fs.readFileSync(path.join(dir, 'sospechas.log'), 'utf8'), /"x":1/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('P1: versiones de protocolo y del mundo', () => {
  assert.ok(Number.isInteger(D.PROTO) && D.PROTO > 0);
  assert.ok(Number.isInteger(D.MUNDO_VER) && D.MUNDO_VER > 0);
  assert.match(JS('net.js'), /proto: D\.PROTO/, 'el cliente manda su versión en join');
  assert.match(fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8'), /b\.proto !== D\.PROTO/);
});

// ---------- Fase 1: automatización ----------

test('A2: los planes y la receta inversa (productos → materia prima)', () => {
  const A = PK.Auto;
  for (const id in A.PLANES) if (A.PLANES[id].w) for (const r of A.RES) assert.ok(A.PLANES[id].w[r] >= 0 && A.PLANES[id].w[r] <= 5, id + ' ' + r);
  assert.deepEqual({ ...A.crudo({ ingots: 2 }, {}) }, { ore: 4, wood: 2 });
  assert.deepEqual({ ...A.crudo({ tools: 1 }, {}) }, { wood: 3, ore: 2 });
  assert.deepEqual({ ...A.crudo({ stone: 5, gold: 1 }, {}) }, { stone: 5, gold: 1 });
});

test('A3: el Salón del Consejo y sus seis consejeros', () => {
  const C = PK.Consejo, b = D.BUILD.consejo;
  assert.equal(b.era, 2); assert.equal(b.max, 1);
  assert.deepEqual([...C.LISTA.map(c => c.lvl)], [1, 2, 3, 5, 7, 9]);
  for (const c of C.LISTA) {
    assert.equal(typeof C.HACE[c.id], 'function', c.id);
    // cada consejero se puede tener en alguna era (el nivel máximo crece 2 por era)
    assert.ok([...Array(12)].some((_, e) => D.maxLevel('consejo', e + 1) >= c.lvl), c.id);
  }
  assert.equal(D.BSTATS.consejo(9).consejeros, 6);
  assert.equal(D.BSTATS.consejo(4).consejeros, 3);
  assert.ok(D.QUESTS.some(q => q.req.t === 'build' && q.req.b === 'consejo'));
  // el Tesorero se queda bajo el límite diario del mercado del servidor
  const sim = fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8'), dia = +/marketDay: (\d+)/.exec(sim)[1];
  assert.ok(C.MERCADO_DIA < dia, 'Tesorero ' + C.MERCADO_DIA + ' contra el servidor ' + dia);
});

test('A6: las reglas del Asesor tienen texto y botones', () => {
  assert.ok(PK.Asesor.REGLAS.length >= 8);
  assert.match(JS('asesor.js'), /prioridad: 100/);
});

test('H1: héroes, equipo y talentos', () => {
  const H = PK.Heroes, viejo = G.state;
  PK.UI = { toast: () => {} };
  G.state = { era: 12, stats: {}, created: 1 };
  H.init(G.state);
  try {
    // la Corsaria (pk-30) es del mar: no sale en la Taberna
    assert.deepEqual([...H.ORDEN].sort(), Object.keys(H.CLASES).filter(k => !H.CLASES[k].mar).sort());
    assert.ok(H.CLASES.corsaria && H.CLASES.corsaria.mar && !H.ORDEN.includes('corsaria'));
    for (const id of H.ORDEN) {
      const c = H.CLASES[id];
      assert.equal(H.TAL_NOMBRES[id].length, 16, id + ': 8 escalones x 2 nombres');
      assert.ok(c.hab.cd > 0 && c.hab.name && c.pasTxt, id);
      assert.ok(D.SPECIAL.includes(c.sp), id + ' se recluta con un recurso especial');
      for (const e of c.vs) assert.ok(D.ENEMY[e], id + ' rinde contra ' + e);
    }
    assert.equal(H.TALENTOS.length, 8);
    // el equipo sale de la semilla: el mismo objeto da lo mismo, y la mejora lo sube
    const it = { id: 1, t: 'arma', r: 3, s: 12345, m: 0 }, a = { ...H.itemStats(it) };
    assert.deepEqual({ ...H.itemStats({ id: 2, t: 'arma', r: 3, s: 12345, m: 0 }) }, a);
    assert.ok(Object.keys(a).length >= 3);
    // tope: héroe de nivel 40 con lo mejor que puede tener → nunca más de +60% (plan H1)
    const h = { id: 1, clase: 'paladin', nombre: 'Prueba', semilla: 7, rasgo: 'valiente', nivel: 40, xp: 0, talentos: [0, 0, 0, 0, 0, 0, 0, 0], equipo: {}, estado: 'libre', gobierna: null };
    G.state.heroes.lista.push(h);
    for (const [i, t] of [[10, 'arma'], [11, 'armadura'], [12, 'talisman']]) { G.state.heroes.inv.push({ id: i, t, r: 3, s: 999 + i, m: 5 }); h.equipo[t] = i; }
    for (const e of Object.keys(D.ENEMY)) assert.ok(H.mult(h, { [e]: 1 }) <= 1 + H.TOPE_FUERZA + 1e-9, e);
    assert.ok(H.mult(h, { undead: 1 }) > H.mult({ ...h, nivel: 1, talentos: [], equipo: {} }, { undead: 1 }));
    assert.ok(H.efecto(h, 'bajas') <= 0.5 && H.efecto(h, 'cd') <= 0.4);
    // niveles: el tope es 5 + 3 x era (hasta 40); cada 5 niveles, un talento
    G.state.era = 2;
    const n = { ...h, nivel: 1, xp: 0, talentos: [], equipo: {} };
    H.darXp(n, 1e6);
    assert.equal(n.nivel, 11);
    assert.equal(H.talentosPendientes(n), 2);
    assert.ok(H.elegirTalento(n, 1) && H.elegirTalento(n, 0) && !H.elegirTalento(n, 0));
    assert.equal(G.state.stats.hero_lvl, 11);
    assert.equal(H.crearObjeto(1, 0).m, 0);
  } finally { G.state = viejo; }
});

test('H3: incursiones, jefes y afijos', () => {
  const I = PK.Inc;
  // un jefe por cada tipo de mazmorra, aquí y en la batalla (batalla.js no carga sin document: se lee el código)
  assert.deepEqual(Object.keys(I.JEFES).sort(), Object.keys(D.DUNGEON).sort());
  const bat = JS('batalla.js'), tabla = /const JEFE = \{([\s\S]*?)\n  \};/.exec(bat)[1];
  for (const k in D.DUNGEON) { assert.match(tabla, new RegExp('\\b' + k + ': \\{'), 'JEFE.' + k); assert.match(bat, new RegExp('    ' + k + ": '"), 'CONSEJO_JEFE.' + k); }
  assert.equal(Object.keys(I.AFIJOS).length, 8);
  for (const id in I.AFIJOS) assert.ok(I.AFIJOS[id].dureza >= 1 && I.AFIJOS[id].botin >= 1, id);
  const a = [...I.afijos()];
  assert.equal(a.length, 2); assert.notEqual(a[0], a[1]); assert.deepEqual([...I.afijos()], a, 'los mismos toda la semana');
  // el último piso de cada bloque (y el último de la mazmorra) es un jefe
  for (const k in D.DUNGEON) { assert.ok(I.esJefe(k, 5) && I.esJefe(k, D.DUNGEON[k].floors)); assert.ok(!I.esJefe(k, 4)); }
  for (const k in I.SALAS) assert.ok(I.SALAS[k].name && I.SALAS[k].desc, k);
  assert.ok(I.BOTIN_SALA > 0 && I.BOTIN_SALA < 1, 'una incursión trae varios pisos: cada sala da una parte');
});

test('H2/H7/H8: encuentros en el camino, mapas del tesoro y eventos con decisiones', () => {
  const A = PK.Aventura, ev = PK.Life.EVENTS;
  // eventos con opciones: botones con texto y acción, y una opción por defecto válida (regla 8 del plan)
  for (const id in ev) {
    const e = ev[id];
    assert.ok(e.name, id);
    if (!e.opciones) continue;
    assert.ok(e.opciones.length >= 1, id);
    for (const o of e.opciones) assert.ok(o.label && typeof o.run === 'function', id);
    // sin defecto, al acabarse el tiempo no pasa nada (el incendio sigue su curso); con él, debe existir
    if (e.defecto !== undefined) assert.ok(Number.isInteger(e.defecto) && e.defecto >= 0 && e.defecto < e.opciones.length, id + ': defecto');
  }
  assert.ok(Object.keys(ev).length >= 30, 'los 10 de antes y los 20 nuevos');
  // encuentros: ids únicos y exactamente una opción cauta (la que se toma sola sin jugador)
  const ids = new Set(A.ENCUENTROS.map(c => c.id));
  assert.equal(ids.size, A.ENCUENTROS.length, 'ids repetidos');
  for (const c of A.ENCUENTROS) {
    assert.ok(c.name && c.desc && c.ops.length >= 2, c.id);
    assert.equal(c.ops.filter(o => o.cauta).length, 1, c.id + ': una sola opción cauta');
    for (const o of c.ops) { assert.ok(o.label && o.ef && o.txt, c.id); if (o.ef.riesgo) assert.ok(o.ef.riesgo > 0 && o.ef.riesgo < 1, c.id); }
  }
  // cuántos encuentros toca por salida: ninguno sin héroe o en viajes cortos
  assert.deepEqual([...A.puntos({ travel: 300 })], []);
  assert.deepEqual([...A.puntos({ travel: 30, heroe: 1 })], []);
  assert.deepEqual([...A.puntos({ travel: 120, heroe: 1 })], [0.5]);
  assert.deepEqual([...A.puntos({ travel: 400, heroe: 1 })], [0.35, 0.7]);
});

test('H4: mazmorras, enemigos y estructuras nuevas', () => {
  W.generate(D.SEED); // B2 aplanó el terreno: el mapa de verdad otra vez
  for (const k of ['swamp', 'giants', 'temple']) {
    const d = D.DUNGEON[k];
    assert.ok(d && D.POI[k] && D.RES[d.loot].special && D.SPECIAL.includes(d.loot), k);
    for (const e in d.enemy) assert.ok(D.ENEMY[e], k + ' pelea contra ' + e);
    assert.ok(W.pois.filter(p => p.kind === k).length >= 5, k + ' está en el mapa');
  }
  // el Templo Hundido, siempre junto a un lago
  for (const p of W.pois.filter(o => o.kind === 'temple')) {
    let agua = false;
    for (let j = -3; j <= p.h + 3 && !agua; j++) for (let i = -3; i <= p.w + 3; i++) if (W.inb(p.x + i, p.y + j) && W.terrain[W.idx(p.x + i, p.y + j)] === 4) { agua = true; break; }
    assert.ok(agua, 'templo en ' + p.x + ',' + p.y);
  }
  // cada enemigo nuevo tiene al menos dos respuestas buenas entre las tropas
  for (const e of ['arcane', 'giant', 'abyss']) assert.ok(Object.values(D.ARMY).filter(a => (a.vs[e] || 1) >= 1.4).length >= 2, e);
  // figuras en la batalla para los enemigos nuevos (batalla.js no carga sin document: se lee el código)
  const bat = JS('batalla.js');
  for (const e of ['arcane', 'giant', 'abyss']) assert.match(bat, new RegExp('\\n    ' + e + ': \\['), 'ENEMIGOS.' + e);
  for (const t of ['herbolario', 'titanforge', 'faro']) {
    assert.ok(D.LEGEND_B.includes(t) && D.BSTATS[t] && D.BUILD[t].lock === t, t);
    assert.ok(D.QUESTS.some(q => q.unlock === t), t + ' se desbloquea con una misión');
    assert.match(JS('sprites.js'), new RegExp('\\n    ' + t + '\\(p'), t + ' tiene dibujo');
  }
});

test('H6: lugares legendarios', () => {
  const Ly = PK.Leyendas, viejo = G.state;
  assert.equal(D.LEYENDAS.length, 12);
  const lp = W.pois.filter(p => p.kind === 'legend');
  for (let i = 0; i < 12; i++) assert.equal(lp.filter(p => p.ley === i).length, 3, D.LEYENDAS[i].name + ': 3 copias');
  for (const L of D.LEYENDAS) assert.ok(L.name && L.bono && L.historia, L.id);
  G.state = { era: 4, stats: {}, flags: {}, leyendas: {}, created: 1, perks: {}, decrees: [] };
  try {
    assert.equal(Ly.recurso('food'), 0);
    G.state.leyendas = { 0: 1, 5: 1, 6: 1, 2: 1, 8: 1 }; // cascada, mina, estatua, círculo, campo
    assert.equal(Ly.recurso('food'), 0.05);
    assert.equal(Ly.recurso('gold'), 0.1, 'mina y estatua');
    assert.equal(Ly.perk('researchP'), 0.05);
    assert.equal(Ly.perk('xpBoost'), 0.1);
    assert.match(JS('game.js'), /PK\.Leyendas\.perk\(k\)/, 'G.perk los suma');
    assert.ok(Ly.contra({ dragon: 1 }) === 0);
    G.state.leyendas[3] = 1;
    assert.ok(Math.abs(Ly.contra({ dragon: 1 }) - 0.1) < 1e-9 && Ly.contra({ beast: 1 }) === 0, 'solo contra dragones (PvE)');
  } finally { G.state = viejo; }
});

test('H5: la campaña', () => {
  const C = PK.Campana, viejo = G.state;
  assert.equal(D.CAPITULOS.length, 10);
  D.CAPITULOS.forEach((c, i) => {
    const n = i + 1;
    assert.ok(D.ESCENAS[c.ini] && D.ESCENAS[c.fin], n + ': escenas');
    for (const id of [c.ini, c.fin]) assert.ok(D.PERSONAJES[D.ESCENAS[id].quien], id + ': quién habla');
    assert.ok(D.QUESTS.find(q => q.id === 'c' + n + '_fin' && q.cap === n && q.req.t === 'cap'), n + ': misión final');
    assert.ok(i === 0 || c.era > D.CAPITULOS[i - 1].era, 'un capítulo por era');
    if (c.lugar) {
      for (const e in c.lugar.enemy) assert.ok(D.ENEMY[e], n + ': ' + e);
      assert.match(JS('batalla.js'), new RegExp('\\n    ' + c.lugar.jefe + ': \\{ id:'), n + ': jefe ' + c.lugar.jefe);
    }
    if (c.eleccion) for (const op of c.eleccion.ops) assert.ok(op.label && op.txt && (op.res || op.perk || op.militia || op.heroe), n + ': ' + op.label);
  });
  // abrir y cerrar capítulos
  G.state = { era: 2, stats: {}, flags: {}, campana: null, created: 1, heroes: { lista: [], nid: 1 }, war: { army: { militia: 0 } }, res: {}, perks: {} };
  PK.UI = { toast: () => {} };
  const stat0 = G.stat;
  G.stat = (k, n) => { G.state.stats[k] = (G.state.stats[k] || 0) + n; };
  try {
    C.init(G.state);
    assert.equal(C.actual(), 1);
    G.state.era = 6;
    assert.equal(C.actual(), 1, 'sin cerrar el I no se abre el II');
    C.ganar(1);
    assert.equal(G.state.campana.pend, 1);
    assert.ok(C.elegir(1, 0) && !C.elegir(1, 1), 'se elige una sola vez');
    assert.equal(G.state.war.army.militia, 10);
    assert.equal(C.actual(), 2);
    C.ganar(2); C.elegir(2, 0);
    assert.equal(G.state.heroes.lista.length, 1, 'el Rey Bandido se une');
  } finally { G.state = viejo; G.stat = stat0; }
});

// ---------- Fase 3 (pk-18): árbol 2.0, cartas de era y estaciones ----------
test('árbol 2.0: 32 nodos, un par enfrentado por era de la II a la IX, y cartas de sobra', () => {
  const ids = Object.keys(D.ARBOL);
  assert.ok(ids.length >= 32, ids.length + ' nodos');
  for (const id of ids) {
    const n = D.ARBOL[id];
    assert.ok(D.RAMAS[n.rama] && n.name && n.desc && n.ef && Object.keys(n.ef).length, id);
    if (n.ex) assert.equal(D.ARBOL[n.ex].ex, id, id + ': su par lo nombra a él');
    if (n.ex) assert.equal(D.ARBOL[n.ex].era, n.era, id + ': el par es de la misma era');
  }
  for (let e = 2; e <= 9; e++) assert.equal(ids.filter(id => D.ARBOL[id].ex && D.ARBOL[id].era === e).length, 2, 'Era ' + e + ': un par');
  assert.ok(Object.keys(D.CARTAS).length >= 30, 'mazo de 30');
  assert.equal(D.ESTACIONES.length, 4);
});
test('cada efecto del árbol, las cartas y las estaciones tiene dónde usarse', () => {
  const fuente = FUENTES.filter(([f]) => f !== 'datos-vida.js').map(([, s]) => s).join('\n');
  const PERKS = ['gatherP', 'craftP', 'researchP', 'upgradeP', 'expSpeed', 'xpBoost'];
  const usada = k => {
    if (PERKS.includes(k)) return new RegExp("perk(All)?\\('" + k + "'\\)").test(fuente) || fuente.includes("'" + k + "'");
    const m = /^(g|c|pve|slots)_/.exec(k);
    if (m) return fuente.includes("'" + m[1] + "_' +");
    return new RegExp("\\b(bono|vb|b)\\('" + k + "'\\)").test(fuente);
  };
  const todas = [].concat(...Object.values(D.ARBOL).map(n => Object.keys(n.ef)), ...Object.values(D.CARTAS).map(c => Object.keys(c.ef || {})), ...D.ESTACIONES.map(e => Object.keys(e.ef)));
  const malas = [...new Set(todas)].filter(k => !usada(k));
  assert.deepEqual(malas, [], 'efectos que nadie lee');
  for (const c of Object.values(D.CARTAS)) if (c.al) assert.ok(PK.Vida.CARTA_AL[c.al], c.name + ': ' + c.al);
});
test('el tope de recolección de la Fase 3 es el mismo que el margen del servidor', () => {
  const sim = fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8');
  const lim = +/vida: ([\d.]+),/.exec(sim)[1];
  assert.equal(lim, D.VIDA_TOPE, 'LIM.vida = D.VIDA_TOPE');
  assert.match(sim, /LIM\.slack \* LIM\.vida/, 'kindRate lo usa');
  // con todo a favor (todas las cartas y nodos juntos, y la mejor estación) no pasa del tope
  const viejo = G.state;
  G.state = { era: 12, arbol: {}, arbolBloq: {}, cartas: { tomadas: Object.keys(D.CARTAS).map((id, i) => ({ id, era: i + 2 })) }, flags: {} };
  for (const id in D.ARBOL) G.state.arbol[id] = 1;
  try {
    PK.Vida.init(G.state);
    for (const r of ['food', 'wood', 'stone', 'gold', 'ore']) for (const k of [undefined, 'deer', 'berry', 'farm']) assert.ok(PK.Vida.recoleccion(r, k) <= D.VIDA_TOPE + 1e-9, r + '/' + k);
  } finally { G.state = viejo; }
});
test('las estaciones salen del reloj real y las cartas de una semilla fija', () => {
  const h6 = D.ESTACION_H * 3600 * 1000;
  assert.equal(PK.Vida.estacion(0), 0);
  assert.equal(PK.Vida.estacion(h6 + 1), 1);
  assert.equal(PK.Vida.estacion(4 * h6 + 5), 0, 'da la vuelta');
  const viejo = G.state;
  G.state = { era: 3, created: 12345, arbol: {}, arbolBloq: {}, cartas: { tomadas: [] }, flags: {}, stats: {} };
  PK.UI = PK.UI || { toast: () => {} };
  const stat0 = G.stat, inv0 = G.invalidateCaps, give0 = G.give;
  G.stat = () => {}; G.invalidateCaps = () => {}; G.give = () => {};
  try {
    PK.Vida.init(G.state);
    const m = PK.Vida.mano(2);
    assert.equal(m.length, 3);
    assert.deepEqual([...PK.Vida.mano(2)], [...m], 'recargar no cambia la mano');
    assert.equal(PK.Vida.pendiente(), 2);
    assert.ok(PK.Vida.elegirCarta(2, m[1]));
    assert.ok(!PK.Vida.elegirCarta(2, m[0]), 'una sola por era');
    assert.equal(PK.Vida.pendiente(), 3);
    assert.ok(!PK.Vida.mano(3).includes(m[1]), 'una carta tomada no vuelve a salir');
    G.state.era = 7;
    PK.Vida.elegirCarta(3, PK.Vida.mano(3)[0]); PK.Vida.elegirCarta(4, PK.Vida.mano(4)[0]); PK.Vida.elegirCarta(5, PK.Vida.mano(5)[0]); PK.Vida.elegirCarta(6, PK.Vida.mano(6)[0]);
    assert.equal(PK.Vida.pendiente(), 0, 'la Era VII es de decreto, no de carta');
  } finally { G.state = viejo; G.stat = stat0; G.invalidateCaps = inv0; G.give = give0; }
});
test('Fase 3b: cercanía, decoraciones, Maravillas, desafíos y tienda tienen sus piezas', () => {
  for (const c of D.CERCANIA) { assert.ok(D.BUILD[c.a], c.a); for (const b of c.b) assert.ok(D.BUILD[b], b); assert.ok(c.r > 0 && c.ef > 0 && c.txt, c.a); }
  assert.equal(D.DECOS.length, 15, '15 decoraciones');
  for (const t of D.DECOS) assert.ok(D.BUILD[t].deco.animo > 0 && D.BUILD[t].deco.r > 0, t);
  assert.deepEqual([...D.MARAVILLAS].sort(), Object.keys(D.MARAV).sort(), 'cada Maravilla tiene sus efectos');
  for (const t of D.MARAVILLAS) { assert.equal(D.BUILD[t].w, 5); assert.equal(D.MARAV[t].fase.length, 7, t + ': 7 etapas'); assert.ok(Object.keys(D.MARAV[t].ef(40)).length); }
  assert.ok(D.DESAFIOS.length >= 40, D.DESAFIOS.length + ' desafíos');
  assert.equal(new Set(D.DESAFIOS.map(d => d.id)).size, D.DESAFIOS.length, 'ids únicos');
  for (const d of D.DESAFIOS) assert.ok(['tick', 'batalla', 'era', 'fiesta', 'incursion', 'carta'].includes(d.on) && typeof d.ok === 'function', d.id);
  // las estadísticas que piden los Retos del Rey las registra alguien
  for (const r of D.RETOS) assert.ok(r.k.startsWith('g_') || new RegExp("stat\\('" + r.k + "'").test(TODO), r.id + ' pide ' + r.k);
  for (const it of D.TIENDA) assert.ok(['color', 'marco', 'fuegos', 'cola'].includes(it.t) && (it.premio ? !it.precio : it.precio > 0), it.id); // los premios de escalera (V7) no tienen precio
  // el ánimo topado: en 0 resta 10%, en 100 suma 15%
  const viejo = G.state;
  try {
    G.state = { animo: { v: 0, ev: [] } }; assert.ok(Math.abs(PK.Vida.animoMult() - 0.9) < 1e-9);
    G.state = { animo: { v: 100, ev: [] } }; assert.ok(Math.abs(PK.Vida.animoMult() - 1.15) < 1e-9);
  } finally { G.state = viejo; }
});

// ---------- Fase 8 (pk-20): el Pase del Reino ----------
test('Pase del Reino: cada tema del calendario tiene sus aspectos, y el actual y el siguiente tienen tema', () => {
  const hj = JS('heroes.js');
  for (const [id, T] of Object.entries(D.PASE_TEMAS)) {
    assert.ok(T.name && T.col.length === 3, id);
    assert.ok(PK.Heroes.CLASES[T.heroe.clase], id + ': clase del héroe');
    assert.ok(hj.includes("A === '" + T.heroe.acc + "'"), id + ': el accesorio ' + T.heroe.acc + ' se dibuja en heroes.js');
    assert.ok(D.BUILD[T.edificio.b] && T.edificio.techo, id + ': aspecto de edificio');
    assert.ok(D.ARMY[T.tropa.t] && T.tropa.col, id + ': aspecto de tropa');
    assert.ok(D.BUILD[T.deco.b], id + ': decoración');
    assert.ok(T.barco.name && T.efecto.name, id + ': barco y efecto');
  }
  assert.equal(D.CALENDARIO_PASE.length, 26, '26 quincenas al año');
  for (const t of D.CALENDARIO_PASE) if (t) assert.ok(D.PASE_TEMAS[t], t);
  const n = D.paseDe(Date.now());
  assert.ok(D.paseTema(n), 'el pase actual (' + n + ') no tiene tema: agrega uno a D.CALENDARIO_PASE');
  assert.ok(D.paseTema(n + 1), 'el pase siguiente (' + (n + 1) + ') no tiene tema: agrega uno a D.CALENDARIO_PASE');
});
test('Pase del Reino: premios de los 30 niveles en las dos pistas y retos con quien registre su estadística', () => {
  assert.equal(D.PASE.precio, 2500);
  for (let n = 1; n <= 35; n++) for (const pista of n <= 30 ? ['g', 'd'] : ['d']) {
    const pr = D.pasePremio(n, pista, 4, 'dragon');
    assert.ok(pr.txt, n + pista);
    if (pr.aspecto) assert.ok(D.aspecto(pr.aspecto), pr.aspecto);
  }
  for (const k of ['heroe', 'edificio', 'tropa', 'deco', 'efecto', 'marco', 'estandarte', 'heroe2']) assert.ok([...Array(30).keys()].some(i => D.pasePremio(i + 1, 'd', 3, 'dragon').aspecto === 'dragon:' + k), 'la pista dorada da ' + k);
  for (const k of D.PASE_STATS) assert.ok(k.startsWith('g_') || new RegExp("stat\\('" + k + "'").test(TODO), 'nadie registra ' + k);
  assert.equal(D.paseDiarios(0, '2026-11-04').length, 3);
  assert.equal(D.paseRetos(0).length, 10);
  assert.deepEqual(D.paseRetos(5).map(r => r.id), D.paseRetos(5).map(r => r.id), 'con semilla fija');
  // jugando normal se llega al 30 en 9 o 10 días: retos del pase + 3 diarios + actividad, contra 4.500 PP
  const retos = D.PASE_RETOS.reduce((a, r) => a + r.pp, 0) / D.PASE_RETOS.length * 10, diarios = D.PASE_DIARIOS.reduce((a, r) => a + r.pp, 0) / D.PASE_DIARIOS.length * 3;
  const dias = (D.PASE.niveles * D.PASE.pp - retos) / (diarios + 160);
  assert.ok(dias > 7 && dias < 12, dias.toFixed(1) + ' días');
});
test('Diplomacia (S1): personalidades sembradas, umbrales en orden y los pactos frenan la conquista', () => {
  const cuenta = {};
  for (const s of D.REALM_SLOTS) cuenta[s.bot.pers] = (cuenta[s.bot.pers] || 0) + 1;
  for (const k of D.PERS_ORDEN) assert.equal(cuenta[k], 4, k + ': cuatro por mundo');
  // otra carga del mismo código da la misma personalidad por casilla (servidor y navegador coinciden)
  const otra = carga(['util.js', 'data.js', 'pase.js', 'world.js']);
  assert.equal(JSON.stringify(otra.D.REALM_SLOTS.map(s => s.bot.pers)), JSON.stringify(D.REALM_SLOTS.map(s => s.bot.pers)));
  for (const k of D.PERS_ORDEN) {
    const P = D.PERSONALIDADES[k];
    assert.ok(P.umbral.alianza > P.umbral.comercio && P.umbral.alianza > P.umbral.noAgresion, k + ': la alianza es lo más difícil');
    assert.ok(P.saq > 0 && P.peso > 0 && P.regalo > 0, k);
  }
  assert.ok(D.PERSONALIDADES.conquistador.saq < 1 && D.PERSONALIDADES.conquistador.peso > 1, 'el Conquistador saquea más seguido');
  const e = { rel: 0, pacto: null, tratado: false };
  assert.ok(D.diploAcepta('conquistador', e, 'alianza', 0), 'con relación 0 el Conquistador no se alía');
  assert.equal(D.diploAcepta('comerciante', Object.assign({}, e, { rel: 60 }), 'alianza', 0), null);
  assert.ok(D.diploAcepta('comerciante', Object.assign({}, e, { rel: 99 }), 'alianza', D.DIPLO.maxAliados), 'tope de aliados');
  assert.ok(D.regaloRel(1e9, 5, 'comerciante', 'gold') <= D.DIPLO.regaloMax, 'un regalo enorme no pasa el tope');
  assert.ok(D.regaloRel(500, 3, 'sabio', 'books') > D.regaloRel(500, 3, 'sabio', 'food'), 'al Sabio le gustan los libros');
  const yo = { era: 5, score: 600 }, el = { era: 5, score: 600, newbie: false, shield: false };
  assert.equal(D.canConquer(yo, el, false), null);
  assert.ok(D.canConquer(yo, Object.assign({}, el, { pacto: 'alianza' }), true), 'una alianza impide conquistar, aun con revancha');
});
test('Fase 9: el mapa del archipiélago es casi todo agua, con tu isla en tu hogar, y la tierra no cambia', () => {
  const huella = JSON.stringify(W.pois.slice(0, 50).map(p => [p.kind, p.x, p.y]));
  W.generate(D.SEED, 'mar');
  try {
    assert.equal(W.tema, 'mar');
    let agua = 0;
    for (let i = 0; i < W.terrain.length; i++) if (W.terrain[i] === 4) agua++;
    assert.ok(agua / W.terrain.length > 0.85, 'casi todo agua: ' + Math.round((agua / W.terrain.length) * 100) + '%');
    const [hx, hy] = D.PLAYER_HOME;
    assert.notEqual(W.terrain[W.idx(hx, hy)], 4, 'tu hogar es tierra firme');
    assert.equal(W.realms.length, 1, 'sin otros reinos');
    assert.equal(W.pois.length, 0, 'sin lugares todavía');
    // pk-28: cinco islas con su rasgo y sus recursos; las especias solo en la suya
    assert.equal(W.islas.length, 6, W.islas.length + ' islas');
    assert.deepEqual(W.islas.slice(1).map(I => I.k).sort(), D.ISLAS_ORDEN.slice().sort());
    const cuantos = k => W.nodes.filter(n => n.kind === k).length;
    for (const k of ['palma', 'arrecife', 'almeja', 'salitral', 'especia', 'naufragio']) assert.ok(cuantos(k) > 3, k + ': ' + cuantos(k));
    assert.ok(W.nodes.filter(n => n.sp === 'teca').length > 20, 'teca');
    const esp = W.islas.find(I => I.k === 'especias');
    assert.ok(W.nodes.filter(n => n.kind === 'especia').every(n => Math.hypot(n.x - esp.x, n.y - esp.y) < esp.r * 1.6), 'especias solo en su isla');
    // los arrecifes están en la orilla (con la bajamar se trabajan desde la arena)
    assert.ok(W.nodes.filter(n => n.kind === 'arrecife').every(n => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => W.terrain[W.idx(n.x + a, n.y + b)] === 4)), 'arrecifes en la orilla');
    assert.ok(W.costa && W.costa.size > 10, 'la costa para la marea');
    for (let i = 1; i < W.islas.length; i++) assert.ok(Math.hypot(W.islas[i].x - hx, W.islas[i].y - hy) > 25, 'las islas están lejos de casa');
  } finally { W.generate(D.SEED); }
  assert.equal(W.tema, 'tierra');
  assert.equal(JSON.stringify(W.pois.slice(0, 50).map(p => [p.kind, p.x, p.y])), huella, 'volver a la tierra da el mismo mapa');
  // las cuatro piezas del Galeón las da la Crónica, cada una en su capítulo
  for (const p of D.GALEON.piezas) assert.equal(D.CAPITULOS[p.cap - 1].galeon, p.id, p.id);
});

test('V7: escaleras de hasta 4 rangos, sin perder premios ni mejoras de los peldaños absorbidos', () => {
  const ids = new Set(D.QUESTS.map(q => q.id));
  const esc = Object.keys(D.ESCALERAS);
  assert.ok(esc.length >= 10, 'escaleras: ' + esc.length);
  let perks = 0;
  for (const k of esc) {
    const vis = D.QUESTS.filter(q => q.rango && q.rango.esc === k);
    assert.ok(vis.length >= 1 && vis.length <= 4, k + ': ' + vis.length + ' rangos visibles');
    assert.deepEqual(vis.map(q => q.id), D.ESCALERAS[k].ids.slice());
    vis.forEach((q, i) => {
      assert.equal(q.rango.k, i);
      if (i) assert.equal(q.pre[0], vis[i - 1].id, k + ': cada rango pide el anterior visible');
      for (const a of q.absorbe || []) assert.ok(!ids.has(a.id), a.id + ' quedó dos veces');
      perks += (q.perk ? 1 : 0) + (q.absorbe || []).filter(a => a.perk).length;
    });
    // el último rango sigue siendo el más difícil de antes (no se recorta la meta final)
    const n = D.QUESTS.filter(q => q.rango && q.rango.esc === k).length + vis.reduce((s, q) => s + (q.absorbe || []).length, 0);
    assert.equal(vis[vis.length - 1].id, k + (n - 1));
    for (const t of [D.ESCALERAS[k].ids[1] && 'esc_' + k + '_c', vis.length >= 3 && 'esc_' + k + '_m'].filter(Boolean)) assert.ok(D.TIENDA.some(o => o.id === t && o.premio === k), t);
  }
  assert.equal(perks, 10, 'las 10 mejoras permanentes de las escaleras siguen en algún rango');
  // Constructor Incansable: 8 peldaños de antes, 4 visibles, y las monedas suman lo mismo (10 + 20 + … + 80)
  const bt = D.QUESTS.filter(q => q.rango && q.rango.esc === 'bt');
  assert.equal(bt.reduce((s, q) => s + q.reward.coins + (q.absorbe || []).reduce((t, a) => t + a.reward.coins, 0), 0), 360);
  assert.ok(D.TIENDA.filter(o => o.premio).every(o => !o.precio), 'los premios de escalera no se venden');
});

test('Fase 9 «b»: tablas del archipiélago, marea del reloj y el tema del mar aplicado', () => {
  // la marea: entre 0 y 1, con un ciclo de D.MAREA_MS, y la bajamar existe un rato en cada ciclo
  const t0 = Date.UTC(2026, 10, 5, 12);
  let bajas = 0;
  for (let k = 0; k < 240; k++) { const m = D.marea(t0 + (k / 240) * D.MAREA_MS); assert.ok(m >= 0 && m <= 1); if (m < D.MAREA_BAJA) bajas++; }
  assert.ok(bajas > 40 && bajas < 120, 'bajamar ' + bajas + ' de 240');
  assert.equal(D.marea(t0), D.marea(t0 + D.MAREA_MS), 'ciclo exacto');
  assert.equal(D.marea(0), 0.5);
  const s = D.mareaCambia(t0);
  assert.ok(s > 0 && s <= D.MAREA_MS / 1000 && D.mareaBaja(t0) !== D.mareaBaja(t0 + (s + 1) * 1000), 'cuándo cambia');
  // recursos y recetas del mar
  for (const r of D.RES_MAR) assert.ok(D.RES[r] && D.RES[r].mar && D.RES_ORDER.includes(r), r);
  for (const k in D.RECIPES) for (const r in Object.assign({}, D.RECIPES[k].in, D.RECIPES[k].out)) assert.ok(D.RES[r], k + ' usa ' + r);
  for (const k of ['palma', 'arrecife', 'almeja', 'salitral', 'especia', 'naufragio']) assert.ok(D.RES[D.NODES[k].res], k);
  // en la tierra nada cambió: el tema solo se aplica en el mar
  assert.equal(D.RES.food.name, 'Comida');
  assert.ok(!D.BUILD_ORDER.includes('salinas') && D.QUESTS.every(q => q.branch !== 'mar'));
  // otro contexto, ya en el mar (como la página después de zarpar)
  const PM = carga(['util.js', 'data.js', 'datos-vida.js', 'datos-mar.js', 'world.js']), DM = PM.D;
  assert.ok(DM.aplicarTema('mar'));
  assert.ok(!DM.aplicarTema('mar'), 'una sola vez');
  assert.equal(DM.RES.food.name, 'Pescado');
  assert.equal(DM.BUILD.tc.name, 'Fortaleza del Puerto');
  assert.equal(DM.eraName(1), 'Caleta');
  assert.equal(DM.eraName(6), 'Señor de los Mares');
  for (let n = 2; n <= 6; n++) {
    for (const r in DM.eraCost(n)) assert.ok(DM.RES[r] && (!DM.RES[r].special), 'era ' + n + ' pide ' + r);
    for (const q of DM.eraReq(n)) for (const t of q.any || []) assert.ok(DM.BUILD[t], 'era ' + n + ' pide ' + t);
  }
  assert.ok(DM.eraReq(7)[0].pop > 1e6, 'no hay Era VII en el mar');
  // las mejoras del mar no piden nada de la tierra
  // (el Astillero del Maestro de Ribera, pk-30, pide herramientas y maquinaria traídas en el Galeón)
  for (const t of DM.MAR.construir) for (let L = 1; L <= 15; L++) for (const r in DM.upCost(t, L)) assert.ok(DM.CARGA.desde.tierra.includes(r) || !['planks', 'blocks', 'ingots', 'tools', 'books', 'marble', 'steel', 'machinery', 'gems'].includes(r), t + ' ' + L + ' pide ' + r);
  // la Crónica del Mar: ids únicos, cadena sin huecos, y cada estadística que pide alguien la escribe
  const ids = new Set(DM.QUESTS.map(q => q.id));
  assert.equal(ids.size, DM.QUESTS.length);
  for (const q of DM.QUESTS) { assert.equal(q.branch, 'mar'); for (const p of q.pre) assert.ok(ids.has(p)); }
  const fuentes = FUENTES.map(([, x]) => x).join('\n'), stats = new Set();
  const mira = r => { if (r.t === 'stat') stats.add(r.k); for (const o of r.of || []) mira(o); };
  for (const q of DM.QUESTS) mira(q.req);
  for (const d of DM.DAILY.concat(DM.WEEKLY)) stats.add(d.k);
  for (const k of stats) {
    const ok = /^g_/.test(k) || /^p_/.test(k) || fuentes.includes("'" + k + "'");
    assert.ok(ok, 'nadie escribe la estadística ' + k);
  }
  for (const q of DM.QUESTS) for (const r in q.reward) assert.ok(r === 'coins' || DM.RES[r], q.id + ' paga ' + r);
});

test('Fase 9 «c»: la armada, los enemigos y jefes del mar, las tormentas y los asaltos', () => {
  // en la tierra no hay barcos ni enemigos del mar
  for (const k in D.ARMY) assert.ok(!D.ARMY[k].mar, 'barco en la tierra: ' + k);
  for (const k in D.ENEMY_MAR) assert.ok(!D.ENEMY[k], 'enemigo del mar en la tierra: ' + k);
  const PM = carga(['util.js', 'data.js', 'datos-vida.js', 'datos-mar.js', 'world.js']), DM = PM.D;
  DM.aplicarTema('mar');
  assert.equal(DM.ARMY, DM.ARMY_MAR);
  assert.equal(DM.ENEMY, DM.ENEMY_MAR);
  assert.equal(DM.MISSIONS, DM.MISSIONS_MAR);
  assert.equal(DM.BUILD.barracks.name, 'Dársena de guerra');
  assert.ok(DM.BUILD.barracks.agua);
  for (const t of ['barracks', 'escuela', 'bateria', 'cadena']) assert.ok(DM.MAR.construir.includes(t), t);
  // cada enemigo del mar tiene dos respuestas o más (como la T3 de la tierra)
  for (const e in DM.ENEMY_MAR) {
    const n = Object.keys(DM.ARMY_MAR).filter(k => (DM.ARMY_MAR[k].vs[e] || 1) > 1).length;
    assert.ok(n >= 2, e + ' tiene ' + n + ' respuestas');
  }
  const TIERRA = ['planks', 'blocks', 'ingots', 'tools', 'books', 'marble', 'steel', 'machinery', 'gems', 'ore'];
  for (const k in DM.ARMY_MAR) {
    const a = DM.ARMY_MAR[k];
    for (const r in a.cost) assert.ok(DM.RES[r] && (!TIERRA.includes(r) || DM.CARGA.desde.tierra.includes(r)), k + ' cuesta ' + r); // lo de la tierra, solo si viaja en el Galeón
    for (const e in a.vs) assert.ok(DM.ENEMY_MAR[e], k + ' contra ' + e);
    if (a.req) assert.ok(DM.BUILD[a.req] && DM.MAR.construir.includes(a.req), k + ' pide ' + a.req);
    assert.ok(a.era >= 2 && a.era <= 6, k);
  }
  for (const m of DM.MISSIONS_MAR) {
    for (const e in m.enemy) assert.ok(DM.ENEMY_MAR[e], m.id + ': ' + e);
    assert.ok(DM.RES[m.sp], m.id + ' da ' + m.sp);
    for (const r in m.loot) assert.ok(DM.RES[r], m.id + ' paga ' + r);
  }
  for (const id in DM.JEFES_MAR) {
    const J = DM.JEFES_MAR[id];
    for (const e in J.enemy) assert.ok(DM.ENEMY_MAR[e], id);
    for (const r in Object.assign({}, J.loot, J.rep)) assert.ok(r === 'coins' || DM.RES[r], id + ' paga ' + r);
  }
  // armada.js: cómo pelea cada barco y cada enemigo, los jefes y sus dibujos (no carga sin document: se lee el código)
  const ar = JS('armada.js');
  for (const k in DM.ARMY_MAR) assert.match(ar, new RegExp('\\n    ' + k + ': \\{ hp:'), 'TROPA.' + k);
  for (const e in DM.ENEMY_MAR) assert.match(ar, new RegExp('\\n    ' + e + ': \\['), 'ENEMIGOS.' + e);
  for (const id in DM.JEFES_MAR) { assert.match(ar, new RegExp('\\n    ' + id + ": \\{ id: '" + id + "'"), 'JEFE.' + id); assert.match(ar, new RegExp('B\\.ext\\.jefePaso\\.' + id + ' = '), 'mecánica de ' + id); }
  const sprs = new Set([...ar.matchAll(/spr: '(\w+)'/g)].map(m => m[1]).concat(Object.keys(DM.ARMY_MAR)));
  const modelos = ar.slice(ar.indexOf('const MODELOS = {'), ar.indexOf('\n  };', ar.indexOf('const MODELOS = {')));
  for (const s of sprs) assert.ok(new RegExp('\\b' + s + '\\b').test(modelos), 'sin dibujo: ' + s);
  // las estadísticas de la Crónica de la armada las escribe alguien
  assert.match(JS('expeditions.js'), /stat\('jefe_' \+ r\.jefeMar, 1\)/);
  assert.match(ar, /stat\('asaltos_ganados', 1\)/);
  // tormentas: del reloj, iguales para todos; un 5–12% del tiempo, de a 40 minutos
  const t0 = Date.UTC(2026, 10, 1);
  let con = 0;
  const N = 30 * 24 * 12; // cada 5 minutos durante 30 días
  for (let i = 0; i < N; i++) { const t = t0 + i * 300e3, a = DM.tormenta(t); if (a) { con++; assert.ok(a.hasta > t && a.hasta - t <= 40 * 60e3); } }
  assert.ok(con / N > 0.04 && con / N < 0.13, 'tormenta ' + (con / N));
  assert.deepEqual(DM.tormenta(t0 + 12345678), PM.D.tormenta(t0 + 12345678));
  // asaltos: más fuertes con la era y con cada asalto (hasta 8), premio y tope del robo crecen
  assert.ok(DM.asaltoFuerza(3, 0) > DM.asaltoFuerza(2, 0) && DM.asaltoFuerza(2, 8) === DM.asaltoFuerza(2, 20));
  assert.ok(DM.asaltoTope(4) > DM.asaltoTope(2) && DM.asaltoPremio(4).gold > DM.asaltoPremio(2).gold);
  assert.ok(DM.BSTATS.cadena(1).cadena < 1 && DM.BSTATS.cadena(20).cadena >= 0.55);
});

test('Fase 9 «d»: la Regata, los duelos y los puentes entre mundos', () => {
  // la regata: rutas, partes y un tiempo que mejora con el barco y depende del mar del momento
  const t0 = Date.UTC(2026, 10, 5, 10);
  for (const ruta in D.REGATA.rutas) {
    const lento = D.regataTiempo({}, ruta, t0, 1), rapido = D.regataTiempo({ casco: 10, velas: 10, timon: 10 }, ruta, t0, 1);
    assert.ok(lento > 30 && lento < 200 && rapido < lento, ruta + ' ' + lento + ' → ' + rapido);
    assert.equal(D.regataTiempo({ velas: 99 }, ruta, t0, 1), D.regataTiempo({ velas: 10 }, ruta, t0, 1), 'el nivel tiene tope');
  }
  // ninguna ruta es la mejor siempre: cambia con la marea y el viento
  const mejores = new Set();
  for (let k = 0; k < 96; k++) { const t = t0 + k * 900e3, ts = Object.keys(D.REGATA.rutas).map(r => [r, D.regataTiempo({ velas: 4, timon: 4, casco: 4 }, r, t, 1)]).sort((a, b) => a[1] - b[1]); mejores.add(ts[0][0]); }
  assert.ok(mejores.size >= 2, 'la mejor ruta cambia con la hora: ' + [...mejores].join(', '));
  for (let k = 0; k < 50; k++) { const v = D.vientoMar(t0 + k * 7e5); assert.ok(v >= 0 && v <= 1); }
  // duelos: el poder por barco es el de la armada, y la ventaja es chica (como mucho ×1,15)
  const PM = carga(['util.js', 'data.js', 'datos-vida.js', 'datos-mar.js', 'world.js']), DM = PM.D;
  for (const k in DM.ARMY_MAR) assert.equal(D.DUELO.poder[k], DM.ARMY_MAR[k].power, 'poder de duelo de ' + k);
  assert.equal(Object.keys(D.DUELO.poder).length, Object.keys(DM.ARMY_MAR).length);
  const v = D.dueloVentaja({ brulote: 10 }, { galeon: 4 });
  assert.ok(v > 1 && v <= 1.15 + 1e-9 && D.dueloVentaja({ galeon: 4 }, { brulote: 10 }) === 1, 'brulotes a galeones ' + v);
  // la bodega del Galeón y el Astillero del Maestro
  for (const w in DM.CARGA.desde) for (const r of DM.CARGA.desde[w]) assert.ok(DM.RES[r], r);
  assert.ok(DM.CARGA.desde.mar.every(r => DM.RES[r].mar), 'del mar sale lo del mar');
  assert.ok(DM.CARGA.desde.tierra.every(r => !DM.RES[r].mar), 'de la tierra, lo de la tierra');
  assert.ok(DM.BUILD.maestro && DM.MAR.construir.includes('maestro'));
  for (const r in DM.BUILD.maestro.cost) assert.ok(DM.RES[r].mar || ['wood', 'stone', 'food', 'gold'].includes(r) || DM.CARGA.desde.tierra.includes(r), 'maestro pide ' + r);
  assert.match(JS('game.js'), /G\.maestroMar = \(\) =>/);
  assert.match(JS('game.js'), /especias: Math\.round\(20 \* k/);
  // mar.js mueve la carga y los héroes al viajar, con su equipo
  const mar = JS('mar.js');
  assert.match(mar, /const carga = moverCarga\(actual, otro\), heroes = moverHeroes\(actual, otro\);/);
  assert.match(mar, /it\.id = a\.nid\+\+/);
  // el servidor y la Cloud Function tienen las mismas rutas nuevas
  const srv = fs.readFileSync(path.join(PKDIR, 'server', 'index.js'), 'utf8'), fn = fs.readFileSync(path.join(PKDIR, '..', '..', 'functions', 'index.js'), 'utf8');
  for (const r of ['/api/regata', '/api/regata/info', '/api/flota', '/api/duelos', '/api/duelo']) { assert.ok(srv.includes("'POST " + r + "'"), 'server ' + r); assert.ok(fn.includes("'POST " + r + "'"), 'functions ' + r); }
  assert.ok(D.RANKINGS.regata);
});

test('Mejoras en serie: el Capataz sube vivienda y recolección, deja tu cola primero y un maestro libre', () => {
  const A = PK.Auto, guarda = {}, cambia = o => { for (const k in o) { guarda[k] = G[k]; G[k] = o[k]; } };
  const casa = (id, lvl, extra) => Object.assign({ id, owner: 'p', type: 'house', done: true, lvl, upg: null, def: D.BUILD.house }, extra);
  const bs = [casa(1, 1), casa(2, 3), casa(3, 2), casa(4, 1, { owner: 'b1' }),
    { id: 9, owner: 'p', type: 'farm', done: true, lvl: 1, upg: null, def: D.BUILD.farm },
    { id: 10, owner: 'p', type: 'farm', done: true, lvl: 1, upg: null, def: D.BUILD.farm }];
  // torres y talleres pueden ser muchos, pero subirlos es una decisión: nunca entran
  for (let i = 0; i < 3; i++) for (const t of ['tower', 'sawmill']) bs.push({ id: 20 + bs.length, owner: 'p', type: t, done: true, lvl: 1, upg: null, def: D.BUILD[t] });
  const st = { auto: { serie: {}, plan: 'mano' }, upq: [], res: { food: 1e6, wood: 1e6, stone: 1e6, gold: 1e6 } };
  let maestros = 2, plata = true;
  const ocupados = () => bs.filter(b => b.upg).length;
  PK.UI = PK.UI || {};
  cambia({ state: st, buildings: bs, maxLvl: () => 5, builders: () => maestros, buildersBusy: ocupados, upCost: () => ({ wood: 10 }),
    canAfford: () => plata, metaNecesita: () => ({ wood: 1e6 }), upgrade: b => { b.upg = { t: 0, total: 9 }; return true; } });
  try {
    const tipos = A.serieTipos();
    assert.equal(JSON.stringify(tipos.map(x => [x.type, x.n, x.min, x.max])), JSON.stringify([['house', 3, 1, 3], ['farm', 2, 1, 1]]), 'solo lo tuyo y solo vivienda y recolección, aunque haya pocos');
    A.serieTick(G, st);
    assert.equal(ocupados(), 0, 'sin nivel elegido no hace nada');
    A.setSerie('house', 3);
    st.upq = [2];
    A.serieTick(G, st);
    assert.equal(ocupados(), 0, 'con algo en tu cola, tu cola va primero');
    st.upq = [];
    A.serieTick(G, st);
    assert.deepEqual(bs.filter(b => b.upg).map(b => b.id), [1], 'el más bajo primero, y con 2 maestros deja 1 libre');
    assert.ok(!bs[4].upg && !bs[5].upg, 'las granjas sin nivel elegido no se tocan');
    A.setSerie('tower', 5); A.setSerie('sawmill', 5);
    maestros = 1; bs[0].upg = null;
    A.serieTick(G, st);
    assert.deepEqual(bs.filter(b => b.upg).map(b => b.id), [1], 'con un solo maestro lo usa');
    bs[0].upg = null; bs[0].lvl = 3; bs[2].lvl = 3; maestros = 3;
    A.serieTick(G, st);
    assert.equal(ocupados(), 0, 'todas en el nivel elegido');
    A.setSerie('house', A.SERIE_ERA);
    assert.equal(A.serieNivel('house'), 5, '«máx. de la era» sigue el tope de la era');
    st.auto.plan = 'meta';
    A.serieTick(G, st);
    assert.equal(ocupados(), 0, 'con «Meta de era» no gasta lo que la era guarda');
    st.auto.plan = 'mano'; plata = false;
    A.serieTick(G, st);
    assert.equal(ocupados(), 0, 'sin recursos espera');
    plata = true;
    A.serieTick(G, st);
    assert.equal(ocupados(), 2, 'con 3 maestros usa 2');
    assert.ok(bs.filter(b => b.upg).every(b => b.type === 'house'), 'ni torres ni talleres, aunque tengan nivel puesto');
    A.setSerie('house', 0);
    assert.equal(st.auto.serie.house, undefined, 'apagar la borra');
  } finally { for (const k in guarda) G[k] = guarda[k]; }
});

test('«Respetar reserva» devuelve a la bodega lo que el taller juntó con «Producir igual»', () => {
  const guarda = G.state, avisos = [];
  PK.UI = Object.assign(PK.UI || {}, { toast: t => avisos.push(t) });
  G.state = { res: { wood: 10 } };
  const b = { type: 'sawmill', def: D.BUILD.sawmill, inb: { wood: 90 }, outb: {}, sinReserva: false };
  try {
    G.setSinReserva(b, true);
    assert.equal(b.sinReserva, true);
    assert.equal(G.state.res.wood, 10, 'encenderlo no mueve nada');
    G.setSinReserva(b, false);
    const tanda = PK.Logi.recipe(b).in.wood;
    assert.equal(b.inb.wood, tanda, 'se queda con una tanda');
    assert.equal(G.state.res.wood, 10 + 90 - tanda, 'el resto vuelve a la bodega');
    assert.match(avisos.pop(), /Volvió a la bodega/);
  } finally { G.state = guarda; }
});

test('Aspectos (pk-36): cada aspecto del Pase se elige en algún lado y el de cada edificio se guarda', () => {
  // los tipos que reparte la pista dorada
  const tipos = new Set();
  for (let n = 1; n <= D.PASE.niveles; n++) { const p = D.pasePremio(n, 'd', 3, 'dragon'); for (const a of [p.aspecto, p.aspecto2]) if (a) tipos.add(a.split(':')[1]); }
  assert.deepEqual([...tipos].sort(), ['barco', 'deco', 'edificio', 'efecto', 'estandarte', 'heroe', 'heroe2', 'marco', 'tropa']);
  const ven = JS('ui/aspectos.js'), pase = JS('ui/pase.js');
  // dónde se elige cada uno (la ventana) y quién lo lee después (marco, efecto y barco no tenían quien: pk-36)
  for (const t of ['edificio', 'deco', 'tropa', 'heroe', 'heroe2']) assert.ok(ven.includes("'" + t + "'"), 'la ventana no ofrece ' + t);
  for (const t of ['estandarte', 'marco', 'efecto', 'barco']) assert.ok(ven.includes('inv.' + t), 'la ventana no ofrece ' + t);
  assert.match(pase, /flags\.aspMarco[\s\S]*--marco/, 'el marco del Pase pinta los retratos');
  assert.match(JS('batalla.js'), /Pase\.efectoCol\(\)/, 'el efecto se ve en la habilidad del héroe');
  assert.match(pase, /Armada\.aspecto\(/, 'el barco tiñe las velas');
  assert.match(JS('render.js'), /Sp\.building\(b\.type, b\.owner, b\.lvl, b\.asp\)/, 'el mapa dibuja el aspecto propio de cada edificio');
  // el aspecto propio de un edificio viaja en la partida guardada y vuelve al cargar
  const b = new PK.Building({ id: 7, type: 'house', owner: 'p', x: 1, y: 1, done: true, lvl: 2 });
  assert.equal(JSON.parse(JSON.stringify(b)).asp, undefined, 'sin aspecto propio no ocupa lugar');
  b.asp = 'carnaval:edificio';
  assert.equal(JSON.parse(JSON.stringify(b)).asp, 'carnaval:edificio');
  assert.match(JS('game.js'), /asp: o\.asp \|\| undefined/, 'loadSave lo repone');
  // los aspectos de edificio y decoración apuntan a edificios que existen
  for (const id in D.PASE_TEMAS) for (const k of ['edificio', 'deco']) assert.ok(D.BUILD[D.PASE_TEMAS[id][k].b], id + ':' + k + ' apunta a ' + D.PASE_TEMAS[id][k].b);
});

test('Exploración por área (pk-37): mismas casillas en el medio y en la orilla, el mapa entero al máximo y nada a mano fuera del área', () => {
  const P = carga(['util.js', 'data.js', 'pase.js', 'world.js', 'entities.js', 'game.js']);
  const { D: D2, World: W2, Game: G2 } = P, N = W2.W * W2.H;
  const dentro = (R, h) => { let n = 0; for (let i = 0; i < N; i++) if (Math.hypot(i % W2.W - h[0], ((i / W2.W) | 0) - h[1]) <= R) n++; return n; };
  const radios = {};
  for (const slot of [5, 0]) { // 5 queda en el medio del mapa; 0, en una esquina
    P.D.setupRealms(slot, null); W2.generate(D2.SEED);
    const area = 20000, R = G2.radioDeArea(area), n = dentro(R, D2.PLAYER_HOME);
    assert.ok(Math.abs(n - area) < area * 0.01, 'slot ' + slot + ': ' + n + ' casillas dentro del radio, se pedían ' + area);
    radios[slot] = R;
    assert.equal(dentro(G2.radioDeArea(N), D2.PLAYER_HOME), N, 'con el área del mapa entero entra todo');
  }
  assert.ok(radios[0] > radios[5] * 1.3, 'la esquina llega más lejos para ver lo mismo (' + radios[0] + ' contra ' + radios[5] + ')');
  // el Puesto en su nivel máximo de la Era X ya cubre el mapa entero, sin Cartografía ni héroe
  const r = D2.BSTATS.scout(D2.maxLevel('scout', 10)).range;
  assert.ok(Math.PI * Math.pow(r + D2.SIGHT.scout, 2) >= N, 'nivel ' + D2.maxLevel('scout', 10) + ': radio ' + r);
  // lo que revela un explorador pasa por su área, también si lo llevaste a mano
  const ent = JS('entities.js'), gm = JS('game.js');
  assert.match(ent, /g\.revealScout\(u\.x, u\.y\)/);
  assert.doesNotMatch(ent + gm, /revealAt\(u\.x, u\.y, g?G?\.?scoutSight\(\)\)/);
  assert.match(gm, /if \(!G\.enAlcance\(tx, ty\)\)/, 'G.command no manda exploradores fuera del área');
});
