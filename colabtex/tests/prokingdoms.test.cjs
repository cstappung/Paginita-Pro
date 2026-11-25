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
const PK = carga(['util.js', 'data.js', 'pase.js', 'world.js', 'entities.js', 'game.js', 'auto.js', 'logistics.js', 'cintas.js', 'mayor.js', 'mina.js', 'consejo.js', 'asesor.js', 'heroes.js', 'incursion.js', 'life.js', 'aventura.js', 'leyendas.js', 'campana.js', 'datos-vida.js', 'datos-mar.js', 'vida.js']);
const { D, World: W, Game: G } = PK;
const PILA = D.CINTA.pila || 1; // pk-67: cada ítem de cinta es un paquete de hasta PILA unidades
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
  // el Templo Hundido, siempre junto a un lago (medido con la huella con la que se ubicó: desde pk-62 queda la entrada)
  for (const p of W.pois.filter(o => o.kind === 'temple')) {
    let agua = false;
    const T = D.POI.temple;
    for (let j = -3; j <= T.h + 3 && !agua; j++) for (let i = -3; i <= T.w + 3; i++) if (W.inb(p.x + i, p.y + j) && W.terrain[W.idx(p.x + i, p.y + j)] === 4) { agua = true; break; }
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
  for (const d of D.DESAFIOS) assert.ok(['tick', 'batalla', 'era', 'fiesta', 'incursion', 'carta', 'asedio', 'defensa'].includes(d.on) && typeof d.ok === 'function', d.id);
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
  const hj = JS('retratos.js'); // pk-50: los accesorios de los retratos se dibujan ahí
  for (const [id, T] of Object.entries(D.PASE_TEMAS)) {
    assert.ok(T.name && T.col.length === 3, id);
    assert.ok(PK.Heroes.CLASES[T.heroe.clase], id + ': clase del héroe');
    assert.ok(hj.includes("A === '" + T.heroe.acc + "'"), id + ': el accesorio ' + T.heroe.acc + ' se dibuja en retratos.js');
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

test('Mejoras en serie: el Capataz sube vivienda y recolección, deja tu cola primero (si se puede pagar) y un maestro libre', () => {
  const A = PK.Auto, guarda = {}, cambia = o => { for (const k in o) { guarda[k] = G[k]; G[k] = o[k]; } };
  const casa = (id, lvl, extra) => Object.assign({ id, owner: 'p', type: 'house', done: true, lvl, upg: null, def: D.BUILD.house }, extra);
  const bs = [casa(1, 1), casa(2, 3), casa(3, 2), casa(4, 1, { owner: 'b1' }),
    { id: 9, owner: 'p', type: 'farm', done: true, lvl: 1, upg: null, def: D.BUILD.farm },
    { id: 10, owner: 'p', type: 'farm', done: true, lvl: 1, upg: null, def: D.BUILD.farm }];
  // torres y talleres pueden ser muchos, pero subirlos es una decisión: nunca entran
  for (let i = 0; i < 3; i++) for (const t of ['tower', 'sawmill']) bs.push({ id: 20 + bs.length, owner: 'p', type: t, done: true, lvl: 1, upg: null, def: D.BUILD[t] });
  const st = { auto: { serie: {}, plan: 'mano' }, upq: [], res: { food: 1e6, wood: 1e6, stone: 1e6, gold: 1e6 } };
  let maestros = 2, plata = true, caro = false;
  const ocupados = () => bs.filter(b => b.upg).length;
  PK.UI = PK.UI || {};
  cambia({ state: st, buildings: bs, bById: new Map(bs.map(b => [b.id, b])), maxLvl: () => 5, builders: () => maestros, buildersBusy: ocupados,
    upCost: b => (caro && b.id === 2 ? { stone: 2e6 } : { wood: 10 }), canAfford: c => plata && Object.keys(c).every(r => (st.res[r] || 0) >= c[r]),
    colaNecesita: () => (caro ? { stone: 2e6 } : {}), metaNecesita: () => ({ wood: 1e6 }), upgrade: b => { b.upg = { t: 0, total: 9 }; return true; } });
  try {
    const tipos = A.serieTipos();
    assert.equal(JSON.stringify(tipos.map(x => [x.type, x.n, x.min, x.max])), JSON.stringify([['house', 3, 1, 3], ['farm', 2, 1, 1]]), 'solo lo tuyo y solo vivienda y recolección, aunque haya pocos');
    A.serieTick(G, st);
    assert.equal(ocupados(), 0, 'sin nivel elegido no hace nada');
    A.setSerie('house', 3);
    st.upq = [2];
    A.serieTick(G, st);
    assert.equal(ocupados(), 0, 'con algo de tu cola que ya se puede pagar, tu cola va primero');
    caro = true;
    A.serieTick(G, st);
    assert.deepEqual(bs.filter(b => b.upg).map(b => b.id), [1], 'lo que espera recursos en tu cola no frena al Capataz (pk-40)');
    bs[0].upg = null; caro = false;
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

test('Sonidos grabados (pk-38): cada nombre de sfx.js tiene su archivo, cada sonido sintetizado tiene grabación y el ambiente la usa', () => {
  const sfx = JS('sfx.js'), mus = JS('musica.js');
  const gan = sfx.slice(sfx.indexOf('const GAN = {'), sfx.indexOf('};', sfx.indexOf('const GAN = {')));
  const nombres = [...gan.matchAll(/'?([a-z-]+)'?\s*:\s*[0-9.]+/g)].map(m => m[1]);
  const archivo = { 'amb-hacha': 'chop', 'amb-pico': 'pick' };
  assert.ok(nombres.length >= 33, 'leí ' + nombres.length + ' nombres');
  for (const n of nombres) {
    const f = path.join(PKDIR, 'sfx', (archivo[n] || n) + '.mp3');
    assert.ok(fs.existsSync(f), 'falta ' + f);
    assert.ok(fs.statSync(f).size < 150 * 1024, n + ' pesa demasiado');
  }
  // todo lo que el switch sintetiza tiene grabación (si no, ese sonido quedaría como antes sin que nadie lo note)
  for (const m of sfx.matchAll(/case '([a-z]+)':/g)) assert.ok(nombres.includes(m[1]), 'sin grabación: ' + m[1]);
  // y todo lo que el ambiente sabe sonar pasa primero por la grabación
  const graba = mus.slice(mus.indexOf('const GRABADO = {'), mus.indexOf('};', mus.indexOf('const GRABADO = {')));
  for (const m of mus.matchAll(/if \(k === '([a-z]+)'\)/g)) {
    assert.ok(graba.includes(m[1] + ':'), 'el ambiente «' + m[1] + '» no usa grabación');
    assert.ok(nombres.includes('amb-' + m[1]), 'sin ganancia: amb-' + m[1]);
  }
});

test('pk-40: el Mercado nunca vende más caro de lo que compra (oro infinito en Nv 8–9) y los eventos no se pisan', () => {
  const D = PK.D;
  for (let L = 1; L <= 12; L++) {
    const s = D.BSTATS.market(L);
    assert.ok(s.sell <= s.buy - 0.1 + 1e-9, 'Nv ' + L + ': compra ' + s.buy + ' y venta ' + s.sell);
    if (L > 1) { const a = D.BSTATS.market(L - 1); assert.ok(s.buy <= a.buy && s.sell >= a.sell, 'mejorar el Mercado nunca empeora el precio (Nv ' + L + ')'); }
  }
  // dos claves iguales en un objeto literal se pisan en silencio: el Torneo de caballeros nunca salía
  const life = fs.readFileSync(path.join(PKDIR, 'js', 'life.js'), 'utf8');
  const claves = [...life.matchAll(/^ {4}([a-zA-Z]+): \{\s*$/gm)].map(m => m[1]);
  const rep = claves.filter((k, i) => claves.indexOf(k) !== i);
  assert.deepEqual(rep, [], 'eventos repetidos en life.js');
  assert.ok(PK.Life.EVENTS.torneo && PK.Life.EVENTS.torneoVerano);
});

// ---------- Plan de logística (juegos/prokingdoms/PLAN-LOGISTICA.md) ----------

test('L1 (pk-41): la ruta por tiempo toma el camino rápido aunque dé un rodeo, y la de los aldeanos sigue siendo la corta', () => {
  const N = W.W * W.H, costo = new Float32Array(N).fill(1 / 0.65);
  // un camino en U: de (10,10) baja a y=14, cruza hasta x=30 y sube a (30,10); la línea recta y=10 es pasto
  const road = [];
  for (let y = 10; y <= 14; y++) road.push([10, y], [30, y]);
  for (let x = 10; x <= 30; x++) road.push([x, 14]);
  for (const [x, y] of road) costo[W.idx(x, y)] = 1 / 1.8;
  const r = W.rutaCosto(10, 10, { x0: 30, y0: 10, x1: 30, y1: 10 }, costo, 1 / 1.8);
  assert.ok(r.ok);
  const enCamino = r.path.filter(([x, y]) => costo[W.idx(x, y)] < 1).length;
  assert.ok(enCamino / r.path.length > 0.9, 'casi todo el viaje va por el camino (' + enCamino + ' de ' + r.path.length + ')');
  assert.ok(r.seg < 20 / 0.65, 'y tarda menos que la recta: ' + r.seg.toFixed(1));
  // sin el camino, va derecho
  const llano = new Float32Array(N).fill(1 / 0.65);
  const r2 = W.rutaCosto(10, 10, { x0: 30, y0: 10, x1: 30, y1: 10 }, llano, 1 / 0.65);
  assert.ok(r2.path.every(([, y]) => y === 10), 'recta');
  // lo que no pasa (Infinity) no se pisa, ni cortando una esquina en diagonal
  const muro = new Float32Array(N).fill(1);
  for (let y = 0; y < 30; y++) muro[W.idx(20, y)] = Infinity;
  const r3 = W.rutaCosto(15, 5, { x0: 25, y0: 5, x1: 25, y1: 5 }, muro, 1);
  assert.ok(r3.ok && r3.path.every(([x, y]) => muro[W.idx(x, y)] < Infinity));
  assert.ok(r3.path.some(([, y]) => y >= 30), 'rodea el muro por abajo');
});

test('L1 (pk-41): las rutas de carretas unen talleres y bodegas del pueblo, sin campamentos ni modo automático', () => {
  const L = PK.Logi;
  // pk-43: el Molino es del pueblo solo dentro de tu tierra (afuera es campamento): los de la prueba van en una casilla tuya
  const mx = 10, my = 10, ownerAt = W.ownerAt;
  W.ownerAt = () => 'p'; // la prueba no arma territorios: todo es tuyo
  const B = (type, id) => ({ id, type, owner: 'p', def: D.BUILD[type], done: true, x: mx, y: my, w: 1, h: 1, cx: mx + 0.5, cy: my + 0.5 });
  const tc = B('tc', 1), saw = B('sawmill', 2), forge = B('forge', 3), lumber = B('lumber', 4), wh = B('warehouse', 5), mill = B('mill', 6);
  assert.equal(L.parMalo(tc, saw), null);
  assert.equal(L.parMalo(saw, forge), null, 'de un taller a otro');
  assert.equal(L.parMalo(saw, tc), null, 'del taller a la bodega');
  assert.equal(L.parMalo(mill, saw), null, 'el Molino del pueblo es bodega (decisión 4)');
  assert.equal(L.parMalo(lumber, saw), null, 'pk-43: del campamento maderero al Aserradero va un carromato');
  assert.equal(L.claseRuta ? 'ok' : '', 'ok');
  assert.match(L.parMalo(saw, lumber), /campamento no recibe/, 'a un campamento no se lleva nada');
  assert.match(L.parMalo(tc, wh), /dos bodegas/);
  assert.match(L.parMalo(saw, saw), /mismo/);
  W.ownerAt = () => null; // en tierra de nadie, el Molino es un campamento más
  assert.match(L.parMalo(mill, saw), /no usa nada/);
  assert.equal(L.parMalo(mill, tc), null);
  W.ownerAt = ownerAt;
  // ningún resto del findJob automático (decisión 2)
  assert.doesNotMatch(JS('logistics.js'), /function findJob/);
  // step() usa el mismo factor que las tablas de costo, y la carreta no corta esquinas por el pasto
  const ent = JS('entities.js');
  assert.match(ent, /PK\.Logi\.factorUnidad\(u\)/);
  assert.match(ent, /parejo\(u, u\.path\[1\]\[0\] \+ 0\.5/);
  // la Carretería arma más carretas por nivel
  assert.equal(D.BSTATS.cartwright(1).carts, 4);
  assert.equal(D.BSTATS.cartwright(3).carts, 8);
});

test('L2 (pk-42): cada aldeano trabaja para un edificio, con radio y puestos, y nunca busca más allá', () => {
  const B = (type, lvl, extra) => Object.assign({ id: 9, type, lvl, owner: 'p', def: D.BUILD[type], done: true, cx: 50, cy: 50 }, extra);
  // tabla 5.2 del plan, con los radios más grandes de pk-54 (pedido del dueño)
  assert.equal(G.radioBase(B('tc', 3)), 13);
  assert.equal(G.puestosBase(B('tc', 3)), 13);
  assert.equal(G.radioBase(B('lumber', 1)), 14);
  assert.equal(G.radioBase(B('lumber', 6)), 17);
  assert.equal(G.radioBase(B('mining', 20)), 22, 'el radio tiene tope');
  assert.equal(G.puestosBase(B('mining', 20)), 16, 'los puestos también');
  assert.equal(G.radioBase(B('mill', 4)), 15);
  // solo los edificios de trabajo terminados y tuyos
  assert.ok(G.esBase(B('lumber', 1)));
  assert.ok(!G.esBase(B('lumber', 1, { done: false })));
  assert.ok(!G.esBase(B('lumber', 1, { owner: 'b1' })));
  assert.ok(!G.esBase(B('sawmill', 1)));
  // «qué saca»: lo que acepta y, si elegiste uno, solo eso
  const mina = B('mining', 2, { extrae: 'gold' });
  assert.ok(G.baseToma(mina, 'gold'));
  assert.ok(!G.baseToma(mina, 'stone'));
  assert.ok(!G.baseToma(B('lumber', 1), 'stone'));
  assert.equal(G.queSaca(mina).join(), 'gold');
  // el radio se mide desde el centro del edificio
  assert.ok(G.enRadio(B('lumber', 1), 63, 49));
  assert.ok(!G.enRadio(B('lumber', 1), 65, 49));
  // el «cada vez más lejos» desapareció: doGather y el reparto usan el radio de la base
  const ent = JS('entities.js');
  assert.match(ent, /nodoEnRadio/);
  assert.match(JS('auto.js'), /A\.sinRadio = /);
  // la base se guarda con el aldeano (task.base) y lo que saca un edificio, con el edificio
  assert.match(ent, /extrae/);
});

test('L3 (pk-43): libro mayor — las bodegas suman S.res, los campamentos guardan aparte y nada se pierde', () => {
  const Lb = PK.Libro, st0 = G.state, capDe0 = G.capDe, cap0 = G.cap, bs0 = G.buildings;
  const caps = { tc: 800, warehouse: 1500, granary: 0 };
  G.capDe = (b, r) => (b.type === 'granary' ? (r === 'food' ? 2000 : 0) : caps[b.type] || 0);
  G.cap = r => G.buildings.reduce((s, b) => s + G.capDe(b, r), 0);
  const mk = (id, type, x) => ({ id, type, owner: 'p', done: true, lvl: 1, def: D.BUILD[type], x, y: 10, w: 2, h: 2, cx: x + 1, cy: 11, inv: {} });
  const tc = mk(1, 'tc', 10), wh = mk(2, 'warehouse', 20), gr = mk(3, 'granary', 30), camp = mk(4, 'lumber', 60);
  G.buildings = [tc, wh, gr, camp];
  G.state = { res: { wood: 1000, food: 500, stone: 0 }, flags: {}, logi: { rutas: [] } };
  try {
    const suma = r => [tc, wh, gr].reduce((s, b) => s + (b.inv[r] || 0), 0);
    Lb.conciliar();
    assert.equal(suma('wood'), 1000, 'una partida vieja: su S.res entra en sus bodegas');
    assert.equal(tc.inv.wood, 800, 'primero el Centro Urbano, hasta su tope');
    assert.equal(wh.inv.wood, 200);
    assert.equal(suma('food'), 500);
    // operaciones al azar: la suma de las bodegas siempre es S.res, nada negativo
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 4000; i++) {
      const r = ['wood', 'food', 'stone'][i % 3], n = Math.floor(rnd() * 120), op = Math.floor(rnd() * 6);
      if (op === 0) G.state.res[r] = Math.max(0, G.state.res[r] - n);          // pagar
      else if (op === 1) G.state.res[r] += n;                                   // premiar (puede pasar el tope)
      else if (op === 2) Lb.poner([tc, wh, gr][i % 3], r, n);                   // descargar en una bodega
      else if (op === 3) Lb.sacar([tc, wh, gr][i % 3], r, n);                   // una carreta carga
      else if (op === 4) Lb.ponerCampo(camp, r, n);                             // un aldeano descarga en el campamento
      else Lb.sacarCampo(camp, r, n);                                           // un carromato carga
      Lb.conciliar();
      for (const k of ['wood', 'food', 'stone']) {
        assert.ok(Math.abs(suma(k) - G.state.res[k]) < 1e-6, 'descuadre en ' + k + ' (paso ' + i + ')');
        for (const b of [tc, wh, gr, camp]) assert.ok(!(b.inv[k] < -1e-9), 'negativo en ' + b.type);
      }
      assert.ok(Lb.totalCampo(camp) <= Lb.capCampo(camp) + 1e-9, 'el campamento no pasa su tope');
    }
    // demoler un campamento: lo suyo va al pueblo entero
    const w = G.state.res.wood + (camp.inv.wood || 0);
    Lb.vaciarAlPueblo(camp);
    assert.ok(Math.abs(G.state.res.wood - w) < 1e-9);
    // la foto al servidor cuenta lo de afuera (campamentos y carromatos)
    camp.inv = { stone: 40 };
    G.units.push({ owner: 'p', kind: 'carromato', carry: 25, carryRes: 'stone' });
    assert.equal(Lb.fuera('stone'), 65);
    G.units.pop();
  } finally { G.capDe = capDe0; G.cap = cap0; G.buildings = bs0; G.state = st0; }
  // el carromato no cabe por una puerta chica, sí por el Gran Portón; la tierra ajena le cuesta ×4
  const lg = JS('logistics.js');
  assert.match(lg, /if \(perfil === 'carromato'\) return W\.wall\[k\] !== 2;/);
  assert.match(lg, /f \/ C\.ajeno/);
  assert.match(JS('world.js'), /noGate && W\.wall\[ni\] >= 2/, 'lobos y bandidos tampoco pasan por el Gran Portón');
  assert.equal(D.BUILD.granportonv.alias, 'granporton');
  assert.ok(!D.BUILD.establo.noUp && D.BUILD.establo.era === 1, 'el Establo es de la Era I');
});

test('L6 (pk-44): la barcaza solo navega, el carromato nunca, y la tormenta alarga el viaje ×1,4', () => {
  const L = PK.Logi, st0 = G.state, ahora0 = G.ahora;
  G.state = Object.assign({ res: {}, flags: {}, logi: { rutas: [] }, techs: {}, era: 1 }, st0 || {});
  try {
    const agua = [], tierra = [];
    for (let k = 0; k < W.W * W.H; k++) (W.terrain[k] === 4 ? agua : tierra).push(k);
    assert.ok(agua.length > 50 && tierra.length > 50, 'el mapa de prueba tiene de los dos');
    const barca = L.tabla('barcaza').costo, carro = L.tabla('carromato').costo;
    for (const k of tierra) assert.ok(!isFinite(barca[k]), 'barcaza en tierra en ' + k);
    for (const k of agua) assert.ok(!isFinite(carro[k]), 'carromato en el agua en ' + k);
    assert.ok(agua.some(k => isFinite(barca[k])), 'y sí navega');
    // tormenta: mismo viento, un 40 % más de viaje
    let tor = null, calma = null;
    for (let k = 0; k < 5000 && !(tor && calma); k++) { const t = Date.UTC(2026, 10, 1) + k * 300e3; if (D.tormenta(t)) tor = tor || t; else calma = calma || t; }
    assert.ok(tor && calma);
    G.ahora = () => tor; const vt = L.velocidad('barcaza'), wt = D.vientoMar(tor);
    G.ahora = () => calma; const vc = L.velocidad('barcaza'), wc = D.vientoMar(calma);
    const base = w => D.BARCAZA.speed * (0.8 + 0.4 * w);
    assert.ok(Math.abs(vc - base(wc)) < 1e-9, 'en calma, el viento');
    assert.ok(Math.abs(vt - base(wt) / D.TORMENTA.viaje) < 1e-9 && D.TORMENTA.viaje === 1.4, 'con tormenta, ÷1,4');
  } finally { G.state = st0; G.ahora = ahora0; }
  // las rutas del mar: solo del Muelle de la colonia al Embarcadero, y la barcaza atraca en el agua
  const B = (type, id) => ({ id, type, owner: 'p', def: D.BUILD[type] || { name: type }, done: true, x: 5, y: 5, w: 1, h: 1, cx: 5.5, cy: 5.5 });
  assert.equal(L.parMalo(B('colonia', 1), B('embarcadero', 2)), null);
  assert.match(L.parMalo(B('colonia', 1), B('tc', 3)), /barcaza/);
  assert.match(L.parMalo(B('lumber', 4), B('embarcadero', 2)), /Embarcadero/);
  assert.equal(L.claseRuta({ de: 1 }) !== undefined, true);
  assert.match(JS('logistics.js'), /L\.atracadero = /);
});

test('L4 (pk-45): el despeje es global, puro y a 12 casillas de todo territorio', () => {
  const t0 = W.terr.slice();
  try {
    const a = W.ubicarLugares(), d = W.distTerritorio(W.terr);
    assert.ok(Object.keys(a.n).length > 50 && Object.keys(a.p).length > 10, 'mueve lo de todos los reinos');
    let cerca = 0;
    for (const id in a.n) { const [x, y] = a.n[id]; if (d[W.idx(x, y)] < W.LEJOS) cerca++; assert.ok(!W.terr[W.parcel(x, y)] && !W.terrCommon[W.parcel(x, y)] && W.terrain[W.idx(x, y)] !== 4); }
    assert.equal(cerca, a.cerca, 'lo que no cupo a 12 se cuenta');
    assert.equal(a.cerca, 0);
    for (const id in a.n) assert.ok(!W.QUEDAN[W.nodes[id].kind], 'los árboles y arbustos se quedan');
    // dos historias de territorio distintas que terminan igual dan las mismas posiciones
    for (let k = 0; k < W.terr.length; k++) if (!W.terr[k] && !W.terrCommon[k] && W.parcelNeighbors(k).some(n => W.terr[n] === 2)) W.terr[k] = 2;
    const b = W.ubicarLugares();
    assert.ok(Object.keys(b.n).length > Object.keys(a.n).length);
    W.terr.set(t0); W.terr[0] = W.terr[0]; // otra copia del mismo territorio
    const c = W.ubicarLugares(Uint8Array.from(t0));
    assert.equal(JSON.stringify(c), JSON.stringify(a));
    // nada movido pisa a otro
    const usadas = new Set();
    for (const id in a.n) { const k = a.n[id].join(); assert.ok(!usadas.has(k)); usadas.add(k); }
  } finally { W.terr.set(t0); }
  // una puerta ajena solo la cruza su gente (W.pasoDe), y una muralla ajena nadie
  const b0 = W.block.slice(), o0 = W.wallOwner.slice();
  try {
    W.block.fill(1); for (let x = 100; x <= 120; x++) W.block[W.idx(x, 100)] = 0;
    W.wallOwner[W.idx(110, 100)] = 4;
    const g = { x0: 120, y0: 100, x1: 120, y1: 100 };
    assert.ok(!W.findPath(100, 100, g).ok, 'un extraño no pasa');
    W.pasoDe = 4; assert.ok(W.findPath(100, 100, g).ok, 'los suyos sí'); W.pasoDe = 0;
  } finally { W.block.set(b0); W.wallOwner.set(o0); W.pasoDe = 0; }
  assert.match(JS('entities.js'), /W\.pasoDe = D\.slotOfOwner\(u\.owner\) \+ 1/);
  assert.match(JS('logistics.js'), /W\.wallOwner\[k\]\) return false/);
  assert.equal(D.WALL.max(1), 450);
  // el cliente ya no informa recolección ni aplica recursos del servidor
  assert.doesNotMatch(JS('net.js'), /harvest|applyNodes|serverNodes/);
  assert.doesNotMatch(fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8'), /checkHarvest|COMMON\[/);
});

test('L5 (pk-47, pk-78): la Calzada Real va en tierra de nadie, en la tuya y en las zonas comunes, nunca en agua, tierra ajena, minerales ni lugares sin vencer', () => {
  const me = 0, otro = W.terr.find(v => v && v !== me + 1) - 1; // en la prueba D.MY_SLOT es -1: un reino cualquiera
  let mia = -1, ajena = -1, agua = -1, comun = -1, mineral = -1, nadie = -1, lugar = -1;
  const ub = W.ubicarLugares();
  for (let k = 0; k < W.W * W.H; k++) {
    const x = k % W.W, y = (k / W.W) | 0, o = W.terr[W.parcel(x, y)];
    if (W.terrain[k] === 4) { if (agua < 0) agua = k; continue; }
    if (W.terrCommon[W.parcel(x, y)]) { if (ub.ocupa[k] < 0) { if (mineral < 0) mineral = k; } else if (!ub.ocupa[k] && comun < 0) comun = k; continue; }
    if (ub.ocupa[k]) { if (lugar < 0 && !o && ub.ocupa[k] > 0 && W.PISABLE(W.pois[ub.ocupa[k] - 1].kind)) lugar = k; continue; }
    if (o === me + 1 && mia < 0 && W.zoneAt[k] < 0) mia = k;
    else if (o === otro + 1 && ajena < 0) ajena = k;
    else if (!o && nadie < 0 && W.zoneAt[k] < 0) nadie = k;
  }
  assert.ok(W.calzadaPuede(mia, me), 'en tu tierra');
  assert.ok(W.calzadaPuede(nadie, me), 'en tierra de nadie');
  assert.ok(!W.calzadaPuede(ajena, me), 'no en la de otro');
  assert.ok(W.calzadaPuede(ajena, otro), 'su dueño sí');
  assert.ok(!W.calzadaPuede(agua, me) && !W.calzadaPuede(lugar, me) && !W.calzadaPuede(mineral, me));
  assert.ok(comun >= 0 && W.calzadaPuede(comun, me), 'pk-78: en las zonas comunes sí');
  assert.ok(W.calzadaPuede(mineral, me, null, ub, null, new Set([-ub.ocupa[mineral] - 1])), 'pk-79: donde estaba un recurso que moviste sí');
  assert.ok(!W.calzadaPuede(mineral, me, null, ub, null, new Set([-ub.ocupa[mineral]])), 'pk-79: con otro recurso movido, no');
  assert.ok(W.calzadaPuede(lugar, me, null, ub, new Set([ub.ocupa[lugar] - 1])), 'pk-78: sobre el lugar que ya venciste sí');
  assert.ok(!W.calzadaPuede(-1, me) && !W.calzadaPuede(W.W * W.H, me));
  // la velocidad: la calzada es el mejor terreno de cada perfil
  const L = PK.Logi, a0 = W.autopista[nadie];
  W.autopista[nadie] = me + 1;
  try {
    assert.equal(L.factor('carromato', nadie), D.CARROMATO.highway);
    assert.ok(L.factor('carreta', nadie) >= D.AUTOPISTA.carreta);
    assert.ok(L.factor('aldeano', nadie) >= D.AUTOPISTA.aldeano);
  } finally { W.autopista[nadie] = a0; }
  assert.ok(D.AUTOPISTA.costo(3).blocks === 4 && D.AUTOPISTA.costo(1).stone === 10 && D.AUTOPISTA.porDia(2) === 120);
  const sim = fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8');
  assert.match(sim, /W\.calzadaPuede\(k, p\.slot, w\.terr, ub, venc, mov\)/, 'el servidor usa la misma regla');
  assert.match(sim, /W\.ubicarLugares\(w\.terr, k => doc\.t\[k\] > 0, doc\.v\)/, 'y mira los lugares con la capa de Calzada');
  for (const f of ['server/index.js', '../../functions/index.js']) assert.match(fs.readFileSync(path.join(PKDIR, f), 'utf8'), /'POST \/api\/autopista'/, f);
});

test('pk-78: una mazmorra o un campamento que pisa una Calzada Real se muda (para todos), y lo vencido no se ve', () => {
  const ub0 = W.ubicarLugares();
  // un campamento o una mazmorra en tierra de nadie, en su lugar
  let id = -1;
  for (let i = 0; i < W.ORIG.p.length; i++) if (!ub0.sub[i] && !ub0.p[i] && W.PISABLE(W.pois[i].kind)) { id = i; break; }
  assert.ok(id >= 0, 'hay un lugar pisable');
  const [x0, y0] = W.ORIG.p[id], tapa = new Set([W.idx(x0, y0)]);
  const ub = W.ubicarLugares(W.terr, k => tapa.has(k), 1);
  assert.ok(ub.sub[id] || ub.p[id], 'se mudó (o quedó bajo tierra)');
  if (ub.p[id]) {
    const [nx, ny] = ub.p[id], p = W.pois[id];
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) assert.ok(!tapa.has(W.idx(nx + i, ny + j)), 'no quedó bajo la Calzada');
    assert.ok(Math.max(Math.abs(nx - x0), Math.abs(ny - y0)) <= 32, 'cerca de donde estaba');
  }
  assert.ok(!ub.ocupa[W.idx(x0, y0)] || ub.ocupa[W.idx(x0, y0)] !== id + 1, 'su casilla vieja quedó libre de él');
  // misma capa, misma respuesta (el servidor y el cliente deben coincidir)
  const ubB = W.ubicarLugares(W.terr, k => tapa.has(k), 2);
  assert.deepEqual(JSON.parse(JSON.stringify(ubB.p)), JSON.parse(JSON.stringify(ub.p)));
  // sin Calzada encima, como antes
  assert.strictEqual(W.ubicarLugares(W.terr, () => false, 3), ub0);
  // lo vencido: game.js y render.js
  const gsrc = fs.readFileSync(path.join(PKDIR, 'js', 'game.js'), 'utf8'), rsrc = fs.readFileSync(path.join(PKDIR, 'js', 'render.js'), 'utf8');
  assert.match(gsrc, /G\.poiVencido = function/);
  assert.match(rsrc, /p\.sub \|\| G\(\)\.poiVencido\(p\)/, 'lo vencido no se dibuja ni se elige');
  // decoraciones y mover recursos: datos y servidor
  assert.ok(D.AUTOPISTA.decos.length >= 5 && D.AUTOPISTA.decoMax > 0);
  assert.equal(D.moverRecursoCosto(1), 1); assert.equal(D.moverRecursoCosto(3), 1); assert.equal(D.moverRecursoCosto(4), 2); assert.equal(D.moverRecursoCosto(30), 10);
  const sim = fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8');
  assert.match(sim, /D\.AUTOPISTA\.decoMax/, 'el servidor pone tope a las decoraciones');
  assert.match(sim, /if \(o === me1 && p\.apDia\.n > 0\) p\.apDia\.n--/, 'pk-79: quitar tu Calzada devuelve cupo del día');
  const dsrc = fs.readFileSync(path.join(PKDIR, 'js', 'despeje.js'), 'utf8');
  assert.match(dsrc, /W\.isShared\(n\) \|\| W\.zoneAt\[W\.idx\(x, y\)\] === n\.zone/, 'pk-79: lo de una zona común no sale de ella');
});

test('pk-78: una casilla que se tapa sin avisar (un árbol que vuelve a crecer) no deja a las carretas paradas', () => {
  const L = PK.Logi;
  assert.equal(typeof W.onBloqueo, 'function', 'world.js avisa a la logística');
  const t = L.tabla('carromato');
  let k = -1;
  for (let i = 0; i < t.costo.length; i++) if (t.costo[i] < Infinity && W.block[i] === 0) { k = i; break; }
  assert.ok(k >= 0);
  W.onBloqueo(k);
  assert.equal(L.tabla('carromato').costo[k], Infinity, 'la tabla guardada ya no pasa por ahí');
  W.onDesbloqueo(k);
  assert.ok(L.tabla('carromato').costo[k] < Infinity, 'y vuelve a pasar cuando se libera');
  const ent = fs.readFileSync(path.join(PKDIR, 'js', 'entities.js'), 'utf8'), wsrc = fs.readFileSync(path.join(PKDIR, 'js', 'world.js'), 'utf8');
  assert.match(ent, /PK\.Logi\.tapar\(W\.idx\(tx, ty\)\)/, 'la carreta que choca avisa');
  assert.match(ent, /PK\.Logi\.vigilar\(u, el\)/, 'y la que no avanza se despierta');
  assert.match(wsrc, /W\.block\[i\] = 1;\n\s*if \(W\.onBloqueo\) W\.onBloqueo\(i\)/, 'el rebrote avisa');
});

test('pk-81: dos Maestros de Obras extra con monedas del reino, desde la Era VI y la Era VIII', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(D.MAESTRO_EXTRA)), [{ era: 6, precio: 1000 }, { era: 8, precio: 1000 }]);
  const gsrc = fs.readFileSync(path.join(PKDIR, 'js', 'game.js'), 'utf8');
  assert.match(gsrc, /G\.builders = \(\) => 1 \+ G\.countB\('builder'\) \+ G\.maestroMar\(\) \+ G\.maestrosComprados\(\)/, 'cuentan como maestros');
  assert.match(gsrc, /spendCoins\(sig\.precio, 'maestro-extra'\)/, 'se pagan con monedas del reino');
});

test('pk-54: rutas comodín — «cualquier campamento» va al que tiene más y «cualquier bodega» a la más cercana', () => {
  const L = PK.Logi, st0 = G.state, bs0 = G.buildings, us0 = G.units, by0 = G.bById, cap0 = G.capDe;
  const mk = (id, type, x, inv) => ({ id, type, owner: 'p', done: true, lvl: 1, def: D.BUILD[type], x, y: 10, w: 2, h: 2, cx: x + 1, cy: 11, inv: inv || {} });
  const c1 = mk(1, 'lumber', 60, { wood: 100 }), c2 = mk(2, 'lumber', 80, { wood: 220 }), mina = mk(3, 'mining', 90, { stone: 50 });
  const tc = mk(4, 'tc', 10), wh = mk(5, 'warehouse', 70), taller = mk(6, 'sawmill', 40);
  G.buildings = [c1, c2, mina, tc, wh, taller]; G.bById = new Map(G.buildings.map(b => [b.id, b])); G.units = [];
  G.capDe = (b, r) => (b.type === 'tc' || b.type === 'warehouse' ? 1000 : 0);
  G.state = Object.assign({}, st0 || {}, { res: { wood: 0, stone: 0 }, flags: {}, logi: { rutas: [], belts: [], nextRuta: 1 } });
  try {
    assert.deepEqual(L.camposDe('wood').map(b => b.id), [1, 2]);
    assert.equal(L.claseRuta({ de: 'campo', a: 'bodega', res: 'wood' }), 'carromato');
    assert.equal(L.claseRuta({ de: 'bodega', a: 6 }), 'cart');
    assert.equal(L.nombreRuta({ de: 'campo', a: 'bodega', res: 'wood' }), 'Cualquier campamento de madera → Cualquier bodega');
    assert.equal(L.comodinMalo('campo', 'bodega', 'wood'), null);
    assert.match(L.comodinMalo('campo', 'bodega', null), /de qué campamentos/);
    assert.match(L.comodinMalo('campo', 'bodega', 'food'), /No tienes campamentos/);
    assert.equal(L.comodinMalo(4, 'bodega', null), null, 'pk-67: de una bodega a «cualquier bodega» es un traslado (pedido del dueño)');
    assert.equal(L.comodinMalo('bodega', 6, null), null);
    const r = { id: 1, de: 'campo', a: 'bodega', res: 'wood' };
    G.state.logi.rutas.push(r);
    // el primero va al que tiene más; el segundo, descontando lo que va a buscar el primero, al otro
    const u1 = { id: 11, kind: 'carromato', owner: 'p', ruta: 1, x: 70, y: 11, carry: 0 }, u2 = { id: 12, kind: 'carromato', owner: 'p', ruta: 1, x: 70, y: 11, carry: 0 };
    G.units = [u1, u2];
    assert.equal(L.extremos(u1, r).from.id, 2, 'el que tiene más madera');
    assert.equal(L.extremos(u2, r).from.id, 1, 'no van todos al mismo');
    assert.equal(L.extremosRep(r).from.id, 2, 'la muestra mira solo cuánto guarda cada uno');
    // la bodega: la más cercana al campamento, y si está llena, otra
    assert.equal(L.extremos(u1, r).to.id, 5, 'el Almacén queda al lado del campamento');
    assert.equal(L.rutasDesde(c1).length, 1, 'la ruta comodín cuenta para los campamentos que puede vaciar');
    assert.equal(L.rutasDesde(mina).length, 0);
  } finally { G.state = st0; G.buildings = bs0; G.units = us0; G.bById = by0; G.capDe = cap0; }
  // sugerencias, el selector con fichas y la misión de la Maravilla (cualquiera de las cuatro cuenta)
  assert.match(JS('logistics.js'), /L\.sugerencias = function/);
  assert.match(JS('ui/reino.js'), /UI\.rutaNueva = function/);
  assert.match(JS('quests.js'), /req\.b === 'wonder' \? D\.WONDERS\.reduce/);
});

test('pk-55: «cualquier campamento minero» trae de todo, en carga mezclada', () => {
  const L = PK.Logi, st0 = G.state, bs0 = G.buildings, us0 = G.units, by0 = G.bById, cap0 = G.capDe, stat0 = G.stat, gcap0 = G.cap;
  G.stat = () => {}; G.cap = () => 1000;
  const mk = (id, type, x, inv) => ({ id, type, owner: 'p', done: true, lvl: 1, def: D.BUILD[type], x, y: 10, w: 2, h: 2, cx: x + 1, cy: 11, inv: inv || {} });
  const m1 = mk(1, 'mining', 60, { stone: 30, gold: 20 }), m2 = mk(2, 'mining', 80, { stone: 10, gold: 5, ore: 4 }), lena = mk(3, 'lumber', 90, { wood: 500 });
  const tc = mk(4, 'tc', 10), granero = mk(5, 'granary', 62);
  G.buildings = [m1, m2, lena, tc, granero]; G.bById = new Map(G.buildings.map(b => [b.id, b])); G.units = [];
  G.capDe = (b, r) => (b.type === 'tc' || (b.type === 'granary' && r === 'food') ? 1000 : 0);
  G.state = Object.assign({}, st0 || {}, { res: { wood: 0, stone: 0, gold: 0, ore: 0, food: 0 }, flags: {}, logi: { rutas: [], belts: [], nextRuta: 1 } });
  try {
    assert.deepEqual(L.camposDe(null, 'mining').map(b => b.id), [1, 2], 'por tipo: los dos mineros');
    assert.equal(L.tipoDeRes('gold'), 'mining');
    assert.equal(L.comodinMalo('campo', 'bodega', null, 'mining'), null);
    assert.match(L.comodinMalo('campo', 'bodega', null, 'mill'), /No tienes Molinos/);
    const r = L.crearRuta('campo', 'bodega', null, 'mining');
    assert.equal(r.tipo, 'mining');
    assert.equal(L.nombreRuta(r), 'Cualquier campamento minero → Cualquier bodega');
    assert.equal(L.nombreRuta({ de: 'campo', a: 'bodega', res: 'gold', tipo: 'mining' }), 'Cualquier campamento minero (solo oro) → Cualquier bodega');
    const u = { id: 11, kind: 'carromato', owner: 'p', ruta: r.id, x: 70, y: 11, carry: 0 };
    G.units = [u];
    const e = L.extremos(u, r);
    assert.equal(e.from.id, 1, 'el que más guarda en total (50 contra 19)');
    assert.equal(e.to.id, 4, 'una bodega que recibe todo, no el Granero de al lado');
    const lista = L.queCargarVarios(m1, tc, 40, true);
    assert.equal(JSON.stringify(lista), JSON.stringify([{ res: 'stone', n: 30 }, { res: 'gold', n: 10 }]), 'lo que más hay primero, hasta llenar');
    // la carga mezclada se cuenta fuera del pueblo (foto al servidor) y se guarda con la partida
    u.carga = { stone: 30, gold: 10 }; u.carry = 40; u.carryRes = 'stone';
    assert.equal(PK.Libro.fuera('gold'), 25 + 10);
    assert.equal(L.nombresCarga(u.carga), 'piedra y oro');
    assert.equal(JSON.stringify(L.cargaDe({ carry: 5, carryRes: 'wood' })), '{"wood":5}');
    assert.equal(L.rutasDesde(lena).length, 0, 'el maderero no es de esa ruta');
  } finally { G.state = st0; G.buildings = bs0; G.units = us0; G.bById = by0; G.capDe = cap0; G.stat = stat0; G.cap = gcap0; }
  assert.match(JS('entities.js'), /carga: this\.carga \|\| undefined/);
});

test('pk-57: «cualquier Aserradero» — la carreta lleva al que tiene menos y saca del que tiene más', () => {
  const L = PK.Logi, st0 = G.state, bs0 = G.buildings, us0 = G.units, by0 = G.bById, cap0 = G.capDe, stat0 = G.stat, gcap0 = G.cap;
  G.stat = () => {}; G.cap = () => 1000;
  const mk = (id, type, x, extra) => Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def: D.BUILD[type], x, y: 10, w: 3, h: 3, cx: x + 1.5, cy: 11.5 }, extra || {});
  const s1 = mk(1, 'sawmill', 40, { inb: { wood: 30 }, outb: { planks: 2 } }), s2 = mk(2, 'sawmill', 60, { inb: { wood: 2 }, outb: { planks: 25 } });
  const tc = mk(4, 'tc', 10), forja = mk(5, 'forge', 80, { inb: {}, outb: {} });
  G.buildings = [s1, s2, tc, forja]; G.bById = new Map(G.buildings.map(b => [b.id, b])); G.units = [];
  G.capDe = (b, r) => (b.type === 'tc' ? 1000 : 0);
  G.state = Object.assign({}, st0 || {}, { res: { wood: 500, planks: 0 }, flags: {}, logi: { rutas: [], belts: [], nextRuta: 1 } });
  try {
    assert.deepEqual(L.talleresDe('sawmill').map(b => b.id), [1, 2]);
    assert.equal(L.nombreExtremo('taller:sawmill'), 'Cualquier Aserradero');
    assert.equal(L.claseRuta({ de: 'bodega', a: 'taller:sawmill' }), 'cart');
    assert.equal(L.comodinMalo('bodega', 'taller:sawmill', null), null);
    assert.equal(L.comodinMalo('taller:sawmill', 'bodega', null), null);
    assert.equal(L.comodinMalo('taller:sawmill', 'taller:forge', null), null, 'tablones a la Herrería');
    assert.match(L.comodinMalo('taller:forge', 'taller:sawmill', null), /no usa/);
    assert.match(L.comodinMalo('bodega', 'taller:steelworks', null), /Necesitas/);
    const ri = { id: 1, de: 'bodega', a: 'taller:sawmill', res: null }, ro = { id: 2, de: 'taller:sawmill', a: 'bodega', res: null };
    G.state.logi.rutas.push(ri, ro);
    const u = { id: 11, kind: 'cart', owner: 'p', ruta: 1, x: 30, y: 11, carry: 0 }, v = { id: 12, kind: 'cart', owner: 'p', ruta: 2, x: 30, y: 11, carry: 0 };
    G.units = [u, v];
    assert.equal(L.extremos(u, ri).to.id, 2, 'el que tiene menos madera');
    assert.equal(L.extremos(u, ri).from.id, 4, 'desde la bodega más cercana a él');
    assert.equal(L.extremos(v, ro).from.id, 2, 'saca del que más tablones tiene');
    assert.equal(L.rutasHacia(s1).length, 1, 'la ruta comodín abastece a los dos');
    assert.equal(L.rutasDesde(s1).length, 1);
  } finally { G.state = st0; G.buildings = bs0; G.units = us0; G.bById = by0; G.capDe = cap0; G.stat = stat0; G.cap = gcap0; }
  assert.match(JS('campana.js'), /for \(let dy = -1; dy <= 1; dy\+\+\) for \(let dx = -1; dx <= 1; dx\+\+\) if \(!casillaLibre/, 'el lugar del capítulo mira sus 9 casillas');
});

test('pk-58: red de cintas — cuello de botella, atasco, cruce, paso elevado, conversión y sin conexión', () => {
  const Ci = PK.Cintas, L = PK.Logi, st0 = G.state, bs0 = G.buildings, by0 = G.bById, cap0 = G.cap, stat0 = G.stat, bAt0 = W.bAt.slice(), belt0 = W.belt.slice();
  const buf0 = L.bufCap;
  G.stat = () => {}; G.cap = () => 1000; L.bufCap = () => 100000;
  const mk = (id, type, x, y, extra) => { const def = D.BUILD[type]; return Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def, x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2, workers: [] }, extra || {}); };
  const poner = b => { for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) W.bAt[W.idx(b.x + i, b.y + j)] = b.id; };
  const saw = mk(1, 'sawmill', 20, 40, { inb: {}, outb: { planks: 1000 * PILA } }), forja = mk(2, 'forge', 31, 41, { inb: {}, outb: {} }), mina = mk(3, 'mining', 21, 50, { inv: { stone: 50 * PILA, gold: 50 * PILA } });
  G.buildings = [saw, forja, mina]; G.bById = new Map(G.buildings.map(b => [b.id, b]));
  W.bAt.fill(-1); W.belt.fill(-1); G.buildings.forEach(poner);
  G.state = Object.assign({}, st0 || {}, { era: 4, res: { planks: 0, stone: 0, gold: 0 }, flags: {}, auto: {}, logi: { belts: [], rutas: [], red: { v: 1, t: {} } } });
  const t = G.state.logi.red.t, pz = (x, y, d, n, extra) => { t[W.idx(x, y)] = Object.assign({ p: 'c', d, n, i: [] }, extra || {}); };
  try {
    // aserradero (x 20..22) → cinta de x 23 a 30, fila 41 → herrería (x 31). La pieza de x 26 es de nivel I.
    for (let x = 23; x <= 30; x++) pz(x, 41, 0, x === 26 ? 1 : 3);
    Ci.init(G.state);
    const cs = Ci.carrilesEn(W.idx(23, 41));
    assert.equal(cs[0].src, saw, 'nace junto al aserradero: boca de salida');
    assert.equal(Ci.carrilesEn(W.idx(30, 41))[0].dst, forja, 'apunta a la herrería: boca de entrada');
    assert.ok(Ci.alimenta(forja) && L.supplied(forja));
    for (let i = 0; i < 1200; i++) Ci.update(0.1); // 2 minutos
    const n1 = forja.inb.planks || 0;
    assert.ok(n1 >= 100 * PILA && n1 <= 121 * PILA, 'el nivel I frena todo a 60/min (llegaron ' + n1 + ')');
    const dg = Ci.diagnostico(W.idx(24, 41))[0];
    assert.equal(dg.min.k, W.idx(26, 41), 'el diagnóstico encuentra la pieza lenta');
    // al subirla, rinde como las demás
    forja.inb.planks = 0;
    t[W.idx(26, 41)].n = 3; Ci.cambio();
    for (let i = 0; i < 600; i++) Ci.update(0.1);
    assert.ok((forja.inb.planks || 0) > 120, 'sin cuello de botella pasan más (' + forja.inb.planks + ')');
    // atasco: del campamento minero sale piedra y oro, y la herrería no los usa
    for (let y = 46; y <= 49; y++) pz(22, y, 3, 2);
    pz(22, 45, 0, 2); pz(23, 45, 0, 2); pz(24, 45, 3, 2); pz(24, 44, 3, 2); pz(24, 43, 3, 2); pz(24, 42, 0, 2);
    Ci.cambio();
    for (let i = 0; i < 300; i++) Ci.update(0.1);
    // (24,42) apunta a (25,42): nada → sin destino; la cadena empieza en el campamento
    assert.equal(Ci.carrilesEn(W.idx(22, 49))[0].src, mina);
    assert.equal(Ci.carrilesEn(W.idx(24, 42))[0].motivo, 'La cinta no llega a ningún lado');
    t[W.idx(24, 42)].d = 1; Ci.cambio(); // ahora baja a la fila 43? no: apunta a (24,43), que va en contra → choca
    Ci.update(0.1);
    assert.match(Ci.carrilesEn(W.idx(24, 42))[0].motivo || '', /choca|ningún lado/);
    // atasco de verdad: del campamento minero (x 21..22, y 50..51) sale piedra y oro hacia otra herrería, que no los usa
    const forja2 = mk(4, 'forge', 27, 50, { inb: {}, outb: {} });
    G.buildings.push(forja2); G.bById.set(4, forja2); poner(forja2);
    for (let x = 23; x <= 26; x++) pz(x, 50, 0, 2);
    Ci.cambio();
    for (let i = 0; i < 100; i++) Ci.update(0.1);
    assert.equal(Ci.carrilesEn(W.idx(23, 50))[0].src, mina, 'boca de salida del campamento: todo lo que junta');
    // pk-70: lo que nadie de adelante recibe ya no sale (antes salía y trababa la cinta)
    assert.match(Ci.carrilesEn(W.idx(23, 50))[0].motivo || '', /^No sale nada: adelante nadie recibe (piedra|oro)/);
    assert.ok(!Ci.carrilesEn(W.idx(26, 50))[0].atasco, 'no se traba');
    assert.equal([23, 24, 25, 26].reduce((n, x) => n + t[W.idx(x, 50)].i.length, 0), 0, 'la cinta queda vacía');
    assert.ok(!forja2.inb.stone && !forja2.inb.gold, 'no entra lo que no usa');
    // pk-72: carga vieja que nadie recibe no traba la cinta: vuelve al pueblo y queda el motivo a la vista
    const piedra0 = G.state.res.stone || 0;
    t[W.idx(26, 50)].i.push(['stone', 0.9, 4]);
    for (let i = 0; i < 10; i++) Ci.update(0.1);
    assert.match(Ci.carrilesEn(W.idx(26, 50))[0].motivo || '', /^Volvió al pueblo: llegó piedra y Herrería no lo usa/);
    assert.ok(!Ci.carrilesEn(W.idx(26, 50))[0].atasco && !t[W.idx(26, 50)].i.length);
    assert.equal(G.state.res.stone, piedra0 + 4, 'el paquete entero vuelve');
    // cruce: una cinta vertical cruza la horizontal en x 28 sin mezclarse
    t[W.idx(28, 41)].p = 'k'; t[W.idx(28, 41)].j = [];
    pz(28, 39, 1, 3); pz(28, 40, 1, 3); pz(28, 42, 1, 3); pz(28, 43, 1, 3);
    Ci.cambio();
    const k = Ci.carrilesEn(W.idx(28, 41));
    assert.equal(k.length, 2);
    assert.equal(k[0].sig ? k[0].sig.k : null, W.idx(29, 41), 'la horizontal sigue a la derecha');
    assert.equal(k[1].d, 1, 'la de través baja');
    assert.equal(k[1].sig.k, W.idx(28, 42));
    t[W.idx(28, 40)].i.push(['gold', 0.9]);
    for (let i = 0; i < 30; i++) Ci.update(0.1);
    assert.equal(Ci.enCinta('gold') >= 1, true);
    assert.ok(!(forja.inb.gold), 'el oro de la vertical no entra a la horizontal');
    // paso elevado: carretas y carromatos no cruzan cintas, pero sí por debajo del paso
    const tb = L.tabla('carromato');
    assert.equal(tb.costo[W.idx(25, 41)], Infinity, 'una cinta corta el paso a los carromatos');
    t[W.idx(40, 60)] = { p: 'e', d: 0, n: 2, i: [], hasta: W.idx(44, 60), lp: 4 };
    t[W.idx(44, 60)] = { p: 'x', d: 0, n: 2, i: [], desde: W.idx(40, 60) };
    Ci.init(G.state);
    const pe = Ci.carrilesEn(W.idx(40, 60))[0];
    assert.equal(pe.sig.k, W.idx(44, 60), 'la entrada salta hasta la salida');
    assert.equal(W.belt[W.idx(42, 60)], -1, 'debajo queda libre');
    // sin conexión: lo mismo que deja pasar el nivel más bajo
    for (const ks in t) { t[ks].i = []; if (t[ks].j) t[ks].j = []; }
    forja.inb = {}; saw.outb.planks = 1000;
    t[W.idx(28, 41)].n = 1; Ci.cambio();
    Ci.offline(60);
    assert.equal(forja.inb.planks, 60 * PILA, 'sin conexión: 60 por minuto con una pieza de nivel I');
    // conversión de las cintas de antes: nivel III, con lo que llevaban
    G.state.logi.red = null; W.belt.fill(-1);
    G.state.logi.belts = [{ id: 1, a: 1, b: 2, res: null, path: [[23, 41], [24, 41], [25, 41]], items: [{ p: 1.5, r: 'planks' }] }];
    Ci.init(G.state);
    const r2 = G.state.logi.red.t;
    assert.equal(Object.keys(r2).length, 3);
    assert.equal(r2[W.idx(24, 41)].n, 3);
    assert.equal(r2[W.idx(24, 41)].i.length, 1, 'lo que iba encima sigue');
    assert.equal(G.state.logi.belts.length, 0);
    assert.ok(W.belt[W.idx(23, 41)] >= 0);
  } finally { G.state = st0; G.buildings = bs0; G.bById = by0; G.cap = cap0; G.stat = stat0; L.bufCap = buf0; W.bAt.set(bAt0); W.belt.set(belt0); }
});

test('pk-59: divisor, unidor y clasificador (Fase C2), en vivo y sin conexión', () => {
  const Ci = PK.Cintas, L = PK.Logi, st0 = G.state, bs0 = G.buildings, by0 = G.bById, cap0 = G.cap, stat0 = G.stat, buf0 = L.bufCap, bAt0 = W.bAt.slice(), belt0 = W.belt.slice();
  G.stat = () => {}; G.cap = () => 1000; L.bufCap = () => 100000;
  const mk = (id, type, x, y, extra) => { const def = D.BUILD[type]; return Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def, x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2, workers: [], inb: {}, outb: {} }, extra || {}); };
  const poner = b => { for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) W.bAt[W.idx(b.x + i, b.y + j)] = b.id; };
  // divisor: aserradero (x 20..22, y 40..42) → (23..25, 41) → divisor en (26,41) → herrería A adelante (27..28, 41..42) y B abajo (26..27, 42..43)? B a la derecha del divisor (abajo en y)
  const saw = mk(1, 'sawmill', 20, 40, { outb: { planks: 1250 * PILA } }), fa = mk(2, 'forge', 27, 40), fb = mk(3, 'forge', 25, 43);
  // unidor: dos aserraderos en (40..42, 40..42) y (40..42, 46..48) que se juntan en (46,44) hacia la herrería C (47..48, 44..45)
  const s1 = mk(4, 'sawmill', 40, 40, { outb: { planks: 1250 * PILA } }), s2 = mk(5, 'sawmill', 40, 46, { outb: { planks: 1250 * PILA } }), fc = mk(6, 'forge', 47, 44);
  // clasificador: campamento minero (60..61, 40..41) con piedra y oro → (62..64, 40) → clasificador (65,40): piedra adelante a la cantería (66..67, 40..41), oro abajo a los copistas (65..66, 41..42)? abajo = (65,41)
  const mina = mk(7, 'mining', 60, 40, { inv: { stone: 750 * PILA, gold: 750 * PILA } }), can = mk(8, 'masonry', 66, 39), cop = mk(9, 'scriptorium', 65, 41);
  const todos = [saw, fa, fb, s1, s2, fc, mina, can, cop];
  G.buildings = todos; G.bById = new Map(todos.map(b => [b.id, b]));
  W.bAt.fill(-1); W.belt.fill(-1); todos.forEach(poner);
  G.state = Object.assign({}, st0 || {}, { era: 4, res: {}, flags: {}, auto: {}, logi: { belts: [], rutas: [], red: { v: 1, t: {} } } });
  const t = G.state.logi.red.t, pz = (x, y, d, n, p) => { t[W.idx(x, y)] = { p: p || 'c', d, n, i: [] }; };
  try {
    for (let x = 23; x <= 25; x++) pz(x, 41, 0, 3);
    pz(26, 41, 0, 3, 'v'); // adelante (27,41) = herrería A; derecha (26,42): una cinta que baja a B
    pz(26, 42, 1, 3); // (26,43) es la herrería B (x 25..26)
    // unidor
    for (let x = 43; x <= 45; x++) pz(x, 41, 0, 2); pz(46, 41, 1, 2); pz(46, 42, 1, 2); pz(46, 43, 1, 2);
    for (let x = 43; x <= 45; x++) pz(x, 47, 0, 2); pz(46, 47, 3, 2); pz(46, 46, 3, 2); pz(46, 45, 3, 2);
    pz(46, 44, 0, 3, 'u'); // recibe de arriba y de abajo, sale a la derecha → herrería C (47,44)
    // clasificador
    for (let x = 62; x <= 64; x++) pz(x, 40, 0, 3);
    pz(65, 40, 0, 3, 's');
    Ci.init(G.state);
    const dv = Ci.carrilesEn(W.idx(26, 41))[0];
    assert.equal(dv.outs.length, 2, 'el divisor tiene dos salidas: la herrería A y la cinta hacia B');
    const un = Ci.carrilesEn(W.idx(46, 44))[0];
    assert.equal(un.ent.length, 2, 'el unidor recibe de las dos');
    assert.equal(un.dst, fc);
    const cl = Ci.carrilesEn(W.idx(65, 40))[0];
    assert.equal(cl.outs.length, 2);
    Ci.ponerFiltro(W.idx(65, 40), 0, 'stone'); Ci.ponerFiltro(W.idx(65, 40), 1, 'gold');
    for (let i = 0; i < 1200; i++) Ci.update(0.1); // 2 minutos
    const a = fa.inb.planks || 0, b = fb.inb.planks || 0;
    assert.ok(a > 120 * PILA && b > 120 * PILA && Math.abs(a - b) <= 20 * PILA, 'el divisor reparte por turnos (' + a + ' / ' + b + ')');
    const c = fc.inb.planks || 0;
    assert.ok(c >= 300 * PILA && c <= 361 * PILA, 'el unidor junta las dos hasta su nivel III (' + c + ')');
    assert.ok(Math.abs((s1.outb.planks) - (s2.outb.planks)) <= 20 * PILA, 'toma por turnos de las dos (' + s1.outb.planks + ' / ' + s2.outb.planks + ')');
    assert.ok((can.inb.stone || 0) > 100 * PILA && !can.inb.gold, 'la piedra va a la cantería (' + can.inb.stone + ')');
    assert.ok((cop.inb.gold || 0) > 100 * PILA && !cop.inb.stone, 'el oro a los copistas (' + cop.inb.gold + ')');
    // sin «lo que sobre» y sin salida para el oro: la boca deja de sacar oro y lo que ya venía vuelve al pueblo (pk-72)
    Ci.ponerFiltro(W.idx(65, 40), 1, '');
    for (let i = 0; i < 100; i++) Ci.update(0.1);
    assert.ok(!Ci.carrilesEn(W.idx(65, 40))[0].atasco, 'no se traba');
    assert.ok(!Object.values(t).some(p => (p.i || []).some(it => it[0] === 'gold')), 'ya no anda oro por la red');
    assert.ok((can.inb.stone || 0) > 0, 'la piedra sigue');
    { const ll = Ci.llegan(W.idx(65, 40)); assert.ok(ll.includes('gold') && ll.includes('stone') && !ll.includes('planks'), 'el panel del clasificador ofrece lo que llega (' + ll + ')'); }
    // sin conexión: el divisor reparte en partes iguales y el clasificador separa
    Ci.ponerFiltro(W.idx(65, 40), 1, 'gold');
    for (const ks in t) t[ks].i = [];
    fa.inb = {}; fb.inb = {}; fc.inb = {}; can.inb = {}; cop.inb = {};
    Ci.offline(60);
    assert.equal(fa.inb.planks + fb.inb.planks, 180 * PILA, 'sin conexión: 180 por el divisor de nivel III');
    assert.equal(fa.inb.planks, fb.inb.planks);
    assert.ok(fc.inb.planks <= 180 * PILA && fc.inb.planks >= 170 * PILA, 'el unidor de nivel III deja pasar 180 (' + fc.inb.planks + ')');
    assert.ok(can.inb.stone >= 80 * PILA && cop.inb.gold >= 80 * PILA && !can.inb.gold && !cop.inb.stone, 'clasificado sin conexión');
    // tramo: un divisor corta el tramo
    assert.ok(!Ci.tramo(W.idx(24, 41)).includes(W.idx(26, 42)));
  } finally { G.state = st0; G.buildings = bs0; G.bById = by0; G.cap = cap0; G.stat = stat0; L.bufCap = buf0; W.bAt.set(bAt0); W.belt.set(belt0); }
});

test('pk-60: cintas de nivel IV y V (Fase C3) y copiar una red', () => {
  const Ci = PK.Cintas, L = PK.Logi, st0 = G.state, bs0 = G.buildings, by0 = G.bById, cap0 = G.cap, stat0 = G.stat, bAt0 = W.bAt.slice(), belt0 = W.belt.slice();
  const buf0 = L.bufCap, libre0 = Ci.libre, owner0 = W.ownerAt, pay0 = G.pay;
  G.pay = c => { const r = G.state.res; for (const k in c) if ((r[k] || 0) < c[k]) return false; for (const k in c) r[k] -= c[k]; return true; };
  G.stat = () => {}; G.cap = () => 1e9; L.bufCap = () => 100000;
  const mk = (id, type, x, y, extra) => { const def = D.BUILD[type]; return Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def, x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2, workers: [] }, extra || {}); };
  const poner = b => { for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) W.bAt[W.idx(b.x + i, b.y + j)] = b.id; };
  const saw = mk(1, 'sawmill', 20, 40, { inb: {}, outb: { planks: 5000 * PILA } }), forja = mk(2, 'forge', 31, 41, { inb: {}, outb: {} });
  G.buildings = [saw, forja]; G.bById = new Map(G.buildings.map(b => [b.id, b]));
  W.bAt.fill(-1); W.belt.fill(-1); G.buildings.forEach(poner);
  G.state = Object.assign({}, st0 || {}, { era: 6, res: { planks: 0 }, flags: {}, auto: {}, logi: { belts: [], rutas: [], red: { v: 1, t: {} } } });
  const t = G.state.logi.red.t, pz = (x, y, d, n, p) => { t[W.idx(x, y)] = { p: p || 'c', d, n, i: [] }; };
  try {
    assert.equal(Ci.maxNivel(), 5, 'en la Era VI se construye hasta el nivel V');
    G.state.era = 5; assert.equal(Ci.maxNivel(), 4); G.state.era = 6;
    // nivel V: 480 por minuto
    for (let x = 23; x <= 30; x++) pz(x, 41, 0, 5);
    Ci.init(G.state);
    for (let i = 0; i < 1200; i++) Ci.update(0.1);
    const v = forja.inb.planks || 0;
    assert.ok(v >= 900 * PILA && v <= 961 * PILA, 'el nivel V lleva 480/min (' + v + ' en 2 min)');
    // una pieza de nivel IV en medio frena a 300
    forja.inb = {}; for (const k in t) t[k].i = [];
    t[W.idx(26, 41)].n = 4; Ci.cambio();
    for (let i = 0; i < 1200; i++) Ci.update(0.1);
    const iv = forja.inb.planks || 0;
    assert.ok(iv >= 560 * PILA && iv <= 601 * PILA, 'el nivel IV frena a 300/min (' + iv + ')');
    forja.inb = {}; for (const k in t) t[k].i = [];
    t[W.idx(26, 41)].n = 5; Ci.cambio();
    Ci.offline(60);
    assert.equal(forja.inb.planks, 480 * PILA, 'sin conexión: 480 por minuto');
    // copiar: una red con un clasificador y un paso elevado
    for (const k in t) delete t[k];
    W.belt.fill(-1);
    pz(50, 60, 0, 2); pz(51, 60, 0, 2); pz(52, 60, 0, 2, 's');
    t[W.idx(52, 60)].f2 = { 0: 'stone', 1: 'gold' };
    pz(52, 61, 1, 2);
    t[W.idx(53, 60)] = { p: 'e', d: 0, n: 2, i: [['stone', 0.5]], hasta: W.idx(56, 60), lp: 3 };
    t[W.idx(56, 60)] = { p: 'x', d: 0, n: 2, i: [], desde: W.idx(53, 60) };
    pz(70, 70, 0, 1); // suelta, no se copia
    Ci.init(G.state);
    const m = Ci.molde(W.idx(50, 60));
    assert.equal(m.piezas.length, 6, 'toma todo lo unido, también el otro extremo del paso, y nada más');
    Ci.libre = (x, y) => !t[W.idx(x, y)]; W.ownerAt = () => 'p';
    const p = Ci.planCopia(m, 40, 80, 1); // un cuarto de vuelta: lo que iba al este va al sur
    assert.equal(p.malas.length, 0);
    const c = Ci.costoMolde(m);
    for (const r in c) G.state.res[r] = c[r] + 5;
    assert.equal(Ci.estampar(p), 6);
    for (const r in c) assert.equal(G.state.res[r], 5, 'paga lo que cuesta la copia (' + r + ')');
    const cl = t[W.idx(40, 82)];
    assert.equal(cl.p, 's'); assert.equal(cl.d, 1, 'girado: sale al sur');
    assert.equal(JSON.stringify(cl.f2), JSON.stringify({ 1: 'stone', 2: 'gold' }), 'los filtros giran con la pieza');
    assert.equal(t[W.idx(39, 82)].d, 2, 'la salida de abajo ahora va al oeste');
    const pe = t[W.idx(40, 83)];
    assert.equal(pe.p, 'e'); assert.equal(pe.hasta, W.idx(40, 86)); assert.equal(t[W.idx(40, 86)].desde, W.idx(40, 83));
    assert.equal(pe.i.length, 0, 'la copia sale vacía');
    assert.ok(W.belt[W.idx(40, 80)] >= 0);
    Ci.cambio();
    assert.equal(Ci.carrilesEn(W.idx(40, 83))[0].sig.k, W.idx(40, 86), 'el paso copiado anda');
    // ocupado: no se estampa
    assert.equal(Ci.planCopia(m, 40, 80, 1).malas.length, 6);
    Ci.libre = (x, y) => !(x === 90 && y === 92);
    const p2 = Ci.planCopia(m, 90, 90, 1);
    assert.equal(p2.malas.length, 1);
    assert.equal(Ci.estampar(p2), 0);
  } finally { Ci.libre = libre0; W.ownerAt = owner0; G.pay = pay0; G.state = st0; G.buildings = bs0; G.bById = by0; G.cap = cap0; G.stat = stat0; L.bufCap = buf0; W.bAt.set(bAt0); W.belt.set(belt0); }
});

test('pk-61: las cantidades grandes no pierden ceros (reporte: 220K se veía 22K)', () => {
  const U = PK.U;
  assert.equal(U.fmt(220000), '220K');
  assert.equal(U.fmt(100000), '100K');
  assert.equal(U.fmt(10000), '10K');
  assert.equal(U.fmt(12500), '12.5K');
  assert.equal(U.fmt(1500000), '1.5M');
  assert.equal(U.fmt(300000000), '300M');
  assert.equal(U.fmt(9999), '9999');
});

test('pk-62: de cada mazmorra queda la entrada (1 casilla que se pisa), las mudadas a 6 de toda otra, y las que no caben, bajo tierra', () => {
  W.generate(D.SEED);
  const mz = W.pois.filter(p => D.POI[p.kind].dungeon);
  assert.ok(mz.length > 150);
  for (const p of mz) {
    assert.ok(p.w === 1 && p.h === 1, p.kind + ' de una casilla');
    const k = W.idx(p.x, p.y);
    assert.equal(W.poiAt[k], p.id);
    assert.equal(W.block[k], 0, 'la entrada se pisa');
  }
  // nada más del mapa queda marcado por una mazmorra (la huella vieja volvió a ser libre)
  let marcas = 0;
  for (let k = 0; k < W.W * W.H; k++) if (W.poiAt[k] >= 0 && D.POI[W.pois[W.poiAt[k]].kind].dungeon) marcas++;
  assert.equal(marcas, mz.length);
  assert.deepEqual(W.ORIG.p.filter((o, id) => D.POI[W.pois[id].kind].dungeon).length, mz.length);
  const ub = W.ubicarLugares(), ids = mz.map(p => p.id);
  const pos = id => ub.p[id] || W.ORIG.p[id];
  const mudadas = ids.filter(id => ub.p[id]), hundidas = ids.filter(id => ub.sub[id]);
  assert.ok(mudadas.length > 0, 'algunas se mudan');
  for (const id of mudadas) {
    const [x, y] = pos(id);
    assert.ok(PK.U.dist(x, y, W.ORIG.p[id][0], W.ORIG.p[id][1]) <= 32.01, 'cerca de donde estaba');
    for (const o of ids) {
      if (o === id || ub.sub[o]) continue;
      const [x2, y2] = pos(o);
      assert.ok(Math.max(Math.abs(x - x2), Math.abs(y - y2)) >= 6, 'mazmorra ' + id + ' a menos de 6 de ' + o);
    }
  }
  for (const id of hundidas) { assert.ok(!ub.p[id]); assert.ok(!ub.ocupa[W.idx(W.ORIG.p[id][0], W.ORIG.p[id][1])], 'bajo tierra no ocupa casilla'); } // lo mudado nunca cae en territorio
  // se dibujan con su propio dibujo de una casilla, y solo cuando las encontraste
  assert.match(JS('sprites.js'), /if \(def\.dungeon\) return \(BCACHE\[key\] = isoSprite\(1, 1, ETOP\[kind\]/);
  const pent = JS('sprites.js').split('const PENT = {')[1].split('\n  };')[0];
  for (const k of Object.keys(D.POI).filter(k => D.POI[k].dungeon)) assert.match(pent, new RegExp('\\n    ' + k + '\\(p\\) \\{'), k + ' tiene entrada');
  assert.match(JS('render.js'), /R\.poiVisible = function/);
  assert.match(JS('game.js'), /W\.subAt\.get\(i\)/);
});

test('pk-67: paquetes (de 16 desde pk-74), varias cintas desde un mismo edificio, menú de cintas, bocas y modo transparente', () => {
  const Ci = PK.Cintas, L = PK.Logi, st0 = G.state, bs0 = G.buildings, by0 = G.bById, cap0 = G.cap, stat0 = G.stat, bAt0 = W.bAt.slice(), belt0 = W.belt.slice();
  const buf0 = L.bufCap, pay0 = G.pay;
  G.pay = () => true; G.stat = () => {}; G.cap = () => 1e9;
  let cupo = 100000; L.bufCap = () => cupo;
  const mk = (id, type, x, y, extra) => { const def = D.BUILD[type]; return Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def, x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2, workers: [] }, extra || {}); };
  const poner = b => { for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) W.bAt[W.idx(b.x + i, b.y + j)] = b.id; };
  const saw = mk(1, 'sawmill', 20, 40, { inb: {}, outb: { planks: 250 * PILA } }), forja = mk(2, 'forge', 31, 41, { inb: {}, outb: {} });
  G.buildings = [saw, forja]; G.bById = new Map(G.buildings.map(b => [b.id, b]));
  W.bAt.fill(-1); W.belt.fill(-1); G.buildings.forEach(poner);
  G.state = Object.assign({}, st0 || {}, { era: 6, res: { planks: 0 }, flags: {}, auto: {}, logi: { belts: [], rutas: [], red: { v: 1, t: {} } } });
  const t = G.state.logi.red.t, libre0 = Ci.libre, owner0 = W.ownerAt;
  try {
    assert.equal(D.CINTA.pila, 16, 'cada ítem lleva hasta 16 (pk-74)');
    assert.equal(Ci.porMin(1), 960); assert.equal(Ci.porMin(5), 7680);
    // del aserradero a la herrería: los ítems van de a 4
    for (let x = 23; x <= 30; x++) t[W.idx(x, 41)] = { p: 'c', d: 0, n: 3, i: [] };
    Ci.init(G.state);
    for (let i = 0; i < 40; i++) Ci.update(0.1);
    const its = Object.values(t).flatMap(pz => pz.i);
    assert.ok(its.length && its.every(it => it[2] === PILA), 'paquetes de ' + PILA);
    assert.equal(Ci.enCinta('planks'), its.length * PILA, 'lo que va arriba se cuenta por unidades');
    // una entrega que no cabe entera: lo que sobra espera en la punta
    for (let i = 0; i < 200; i++) Ci.update(0.1);
    cupo = (forja.inb.planks || 0) + 2;
    for (let i = 0; i < 30; i++) Ci.update(0.1);
    assert.equal(forja.inb.planks, cupo, 'entra justo lo que cabe');
    const punta = Ci.carrilesEn(W.idx(30, 41))[0].pz.i[0];
    assert.ok(punta && punta[2] === PILA - 2, 'en la punta quedan ' + (PILA - 2) + ' de ese paquete (' + (punta && punta[2]) + ')');
    // quitar una pieza devuelve el paquete entero
    const antes = G.state.res.planks || 0, lleva = (t[W.idx(30, 41)].i || []).reduce((a, it) => a + (it[2] || 1), 0);
    Ci.quitar(W.idx(30, 41), true);
    assert.equal(G.state.res.planks, antes + lleva);
    // varias cintas desde el mismo edificio: al tocar el aserradero, el plan sale por un borde libre
    Ci.libre = (x, y) => W.inb(x, y) && W.bAt[W.idx(x, y)] < 0 && !t[W.idx(x, y)];
    W.ownerAt = () => 'p';
    const p2 = Ci.plan(21, 41, 30, 41);
    assert.ok(p2 && !p2.malas.length, 'la segunda no choca con la primera (' + (p2 && p2.malas[0] && p2.malas[0].why) + ')');
    assert.ok(!(p2.tiles[0].x === 23 && p2.tiles[0].y === 41), 'no empieza sobre la cinta que ya sale');
    Ci.trazar(p2, 3);
    Ci.rearmar();
    assert.ok(Ci.carriles().filter(c => c.src === saw).length >= 2, 'el aserradero tiene dos bocas de salida');
    // el menú de cintas y el dibujo
    for (const h of ['cnodo', 'csubir', 'cgirar', 'cquitar', 'cmolde']) assert.ok(Ci.HERR_PIEZA[h] && Ci.HERR[h], h);
    assert.ok(Ci.HERR.cinta && Ci.HERR.paso && Ci.HERR.copiar);
    assert.match(JS('sprites.js'), /S\.beltBoca = function \(d, entrada, n\)/);
    assert.match(JS('render.js'), /R\.modoCintas = function/);
    assert.match(JS('render.js'), /PK\.Cintas\.bocas\(R, Sp, seen\)/);
    assert.match(JS('ui.js'), /'cintas', \(g, st\) =>|cintas: \(g, st\) =>/);
    assert.match(JS('input.js'), /k === 'k'/);
  } finally { Ci.libre = libre0; W.ownerAt = owner0; G.state = st0; G.buildings = bs0; G.bById = by0; G.cap = cap0; G.stat = stat0; G.pay = pay0; L.bufCap = buf0; W.bAt.set(bAt0); W.belt.set(belt0); }
});

test('pk-69: el clasificador manda por «lo que sobre» lo que no entra en la salida de ese recurso (en vivo y sin conexión)', () => {
  const Ci = PK.Cintas, L = PK.Logi, st0 = G.state, bs0 = G.buildings, by0 = G.bById, cap0 = G.cap, stat0 = G.stat, bAt0 = W.bAt.slice(), belt0 = W.belt.slice();
  const buf0 = L.bufCap;
  G.stat = () => {}; G.cap = () => 1e9;
  const mk = (id, type, x, y, extra) => { const def = D.BUILD[type]; return Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def, x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2, workers: [] }, extra || {}); };
  const poner = b => { for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) W.bAt[W.idx(b.x + i, b.y + j)] = b.id; };
  // aserradero (x 20..22, fila 41) → cinta → clasificador en x 26: madera a la derecha (abajo, a la forja A), lo que sobre adelante (a la forja B)
  const saw = mk(1, 'sawmill', 20, 40, { inb: {}, outb: { planks: 100000 } }), fa = mk(2, 'forge', 26, 43, { inb: {}, outb: {} }), fb = mk(3, 'forge', 31, 41, { inb: {}, outb: {} });
  G.buildings = [saw, fa, fb]; G.bById = new Map(G.buildings.map(b => [b.id, b]));
  W.bAt.fill(-1); W.belt.fill(-1); G.buildings.forEach(poner);
  L.bufCap = b => (b === fa ? 20 : 100000); // la forja de la derecha se llena enseguida
  G.state = Object.assign({}, st0 || {}, { era: 6, res: { planks: 0 }, flags: {}, auto: {}, logi: { belts: [], rutas: [], red: { v: 1, t: {} } } });
  const t = G.state.logi.red.t, pz = (x, y, d, n, p) => { t[W.idx(x, y)] = { p: p || 'c', d, n, i: [] }; };
  try {
    for (let x = 23; x <= 25; x++) pz(x, 41, 0, 3);
    pz(26, 41, 0, 3, 's'); t[W.idx(26, 41)].f2 = { 1: 'planks', 0: '*' };
    pz(26, 42, 1, 3);
    for (let x = 27; x <= 30; x++) pz(x, 41, 0, 3);
    Ci.init(G.state);
    assert.equal(Ci.carrilesEn(W.idx(26, 41))[0].outs.length, 2);
    for (let i = 0; i < 600; i++) Ci.update(0.1);
    assert.equal(fa.inb.planks, 20, 'la de la derecha recibe hasta llenarse');
    assert.ok((fb.inb.planks || 0) > 300, 'lo que no entra sigue por «lo que sobre» (' + fb.inb.planks + ')');
    assert.ok(!Ci.carrilesEn(W.idx(26, 41))[0].atasco, 'el clasificador no se traba');
    // sin conexión, igual
    for (const k in t) t[k].i = [];
    fa.inb = { planks: 15 }; fb.inb = {};
    Ci.offline(60);
    assert.equal(fa.inb.planks, 20, 'sin conexión: la derecha se completa');
    assert.ok(fb.inb.planks >= 150 * PILA, 'sin conexión: el resto va adelante (' + fb.inb.planks + ')');
  } finally { G.state = st0; G.buildings = bs0; G.bById = by0; G.cap = cap0; G.stat = stat0; L.bufCap = buf0; W.bAt.set(bAt0); W.belt.set(belt0); }
});

test('pk-70: de bodega a bodega la cinta entrega aunque el pueblo esté lleno o sobre el tope, y no saca lo que nadie recibe', () => {
  const Ci = PK.Cintas, L = PK.Logi, Lb = PK.Libro, st0 = G.state, bs0 = G.buildings, by0 = G.bById, cap0 = G.cap, capDe0 = G.capDe, stat0 = G.stat, bAt0 = W.bAt.slice(), belt0 = W.belt.slice();
  G.stat = () => {}; G.cap = () => 500; G.capDe = () => 1000;
  const mk = (id, type, x, y, extra) => { const def = D.BUILD[type]; return Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def, x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2, workers: [] }, extra || {}); };
  const poner = b => { for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) W.bAt[W.idx(b.x + i, b.y + j)] = b.id; };
  const a = mk(1, 'warehouse', 20, 40, { inv: { wood: 100 * PILA, stone: 100 * PILA, gold: 100 * PILA, iron: 0 } }), b = mk(2, 'warehouse', 30, 40, { inv: {} });
  G.buildings = [a, b]; G.bById = new Map(G.buildings.map(o => [o.id, o]));
  W.bAt.fill(-1); W.belt.fill(-1); G.buildings.forEach(poner);
  // el pueblo, muy por encima del tope (un premio): 800 de cada uno con tope 500
  G.state = Object.assign({}, st0 || {}, { era: 6, res: { wood: 800, stone: 800, gold: 800, food: 800 }, flags: {}, auto: { reserve: 0 }, logi: { belts: [], rutas: [], red: { v: 1, t: {} } } });
  const t = G.state.logi.red.t;
  try {
    for (let x = 23; x <= 29; x++) t[W.idx(x, 41)] = { p: 'c', d: 0, n: 3, i: [] };
    Ci.init(G.state);
    const boca = Ci.carrilesEn(W.idx(23, 41))[0];
    assert.equal(boca.src, a); assert.equal(Ci.carrilesEn(W.idx(29, 41))[0].dst, b);
    boca.pz.f = ['wood', 'stone', 'gold', 'food', 'planks'];
    Ci.cambio();
    const RS = ['wood', 'stone', 'gold', 'food'], total0 = RS.reduce((n, r) => n + G.state.res[r], 0);
    for (let i = 0; i < 600; i++) Ci.update(0.1);
    const llego = ['wood', 'stone', 'gold'].map(r => b.inv[r] || 0);
    assert.ok(llego.every(n => n >= 40), 'llegan los tres a la otra bodega (' + llego + ')');
    const enCinta = RS.reduce((n, r) => n + Ci.enCinta(r), 0);
    assert.equal(RS.reduce((n, r) => n + G.state.res[r], 0) + enCinta, total0, 'no se crea ni se pierde nada');
    // pk-72 (pedido del dueño): la boca saca de los estantes de su bodega: la comida, que esta no tiene, no sale
    assert.ok(!(b.inv.food) && !Ci.enCinta('food'), 'la comida no sale: esta bodega no tiene');
    assert.ok(!Object.values(t).some(pz => pz.i.some(it => it[0] === 'planks')), 'lo que el pueblo no tiene no sale');
    assert.ok(Object.values(t).every(pz => pz.i.every(it => it[3] === 1)), 'los paquetes llevan la marca de que salieron de una bodega');
    // sin conexión, igual
    for (const k in t) t[k].i = [];
    b.inv = {};
    Ci.offline(60);
    assert.ok((b.inv.wood || 0) >= 100, 'sin conexión también llega (' + b.inv.wood + ')');
    // Lb.poner sin margen no pasa el tope; con margen, sí (lo que vuelve)
    assert.equal(Lb.poner(b, 'wood', 4), 0);
    assert.equal(Lb.poner(b, 'wood', 4, 4), 4);
  } finally { G.state = st0; G.buildings = bs0; G.bById = by0; G.cap = cap0; G.capDe = capDe0; G.stat = stat0; W.bAt.set(bAt0); W.belt.set(belt0); }
});

test('pk-72: un divisor no manda a una rama lo que nadie de esa rama recibe, y la boca de una bodega saca de sus estantes', () => {
  const Ci = PK.Cintas, L = PK.Logi, st0 = G.state, bs0 = G.buildings, by0 = G.bById, cap0 = G.cap, capDe0 = G.capDe, stat0 = G.stat, bAt0 = W.bAt.slice(), belt0 = W.belt.slice(), buf0 = L.bufCap;
  G.stat = () => {}; G.cap = () => 100000; G.capDe = () => 100000; L.bufCap = () => 100000;
  const mk = (id, type, x, y, extra) => { const def = D.BUILD[type]; return Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def, x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2, workers: [] }, extra || {}); };
  const poner = b => { for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) W.bAt[W.idx(b.x + i, b.y + j)] = b.id; };
  // bodega (x 20..22, y 40..42) → cinta en la fila 41 → divisor en x 26: adelante un aserradero (madera), abajo una cantería (piedra)
  const a = mk(1, 'warehouse', 20, 40, { inv: { wood: 5000, stone: 5000 } }), saw = mk(2, 'sawmill', 31, 40, { inb: {}, outb: {} }), mas = mk(3, 'masonry', 26, 45, { inb: {}, outb: {} });
  const otra = mk(4, 'warehouse', 40, 40, { inv: { gold: 5000 } });
  G.buildings = [a, saw, mas, otra]; G.bById = new Map(G.buildings.map(o => [o.id, o]));
  W.bAt.fill(-1); W.belt.fill(-1); G.buildings.forEach(poner);
  G.state = Object.assign({}, st0 || {}, { era: 6, res: { wood: 5000, stone: 5000, gold: 5000 }, flags: {}, auto: { reserve: 0 }, logi: { belts: [], rutas: [], red: { v: 1, t: {} } } });
  const t = G.state.logi.red.t, pz = (x, y, d, p) => { t[W.idx(x, y)] = { p: p || 'c', d, n: 3, i: [] }; };
  try {
    for (let x = 23; x <= 25; x++) pz(x, 41, 0);
    pz(26, 41, 0, 'v');
    for (let x = 27; x <= 30; x++) pz(x, 41, 0);
    for (let y = 42; y <= 44; y++) pz(26, y, 1);
    Ci.init(G.state);
    const boca = Ci.carrilesEn(W.idx(23, 41))[0];
    assert.equal(boca.src, a);
    boca.pz.f = ['wood', 'stone', 'gold']; boca.pz.rr = 1; // empieza por la piedra: el divisor la manda primero adelante
    Ci.cambio();
    for (let i = 0; i < 1200; i++) Ci.update(0.1);
    assert.ok((saw.inb.wood || 0) > 300, 'la madera llega al aserradero (' + saw.inb.wood + ')');
    assert.ok((mas.inb.stone || 0) > 300, 'la piedra llega a la cantería (' + mas.inb.stone + ')');
    assert.ok(!Ci.carriles().some(c => c.atasco), 'nada se traba: ' + Ci.carriles().filter(c => c.atasco).map(c => c.motivo));
    // pk-72 (pedido del dueño): la boca saca de los estantes de su bodega; el oro está en otra
    assert.ok(!Object.values(t).some(p => p.i.some(it => it[0] === 'gold')), 'el oro de otra bodega no sale por esta boca');
    // el panel dice por qué no sale cada cosa
    assert.match(Ci.porQueNoSale(boca, 'gold'), /adelante nadie recibe oro/);
    assert.equal(Ci.porQueNoSale(boca, 'wood'), null);
    // pk-73 (pedido del dueño): la reserva de los talleres no frena la cinta (el taller ya se para solo)
    G.state.auto.reserve = 0.5; G.state.res.wood = 100;
    assert.equal(Ci.porQueNoSale(boca, 'wood'), null);
    assert.ok(Ci.puedeSacar(boca.src, 'wood'), 'bajo la reserva la boca igual saca');
  } finally { G.state = st0; G.buildings = bs0; G.bById = by0; G.cap = cap0; G.capDe = capDe0; G.stat = stat0; L.bufCap = buf0; W.bAt.set(bAt0); W.belt.set(belt0); }
});

test('pk-75: una boca solo manda paquetes llenos, y el taller junto a una bodega le guarda uno a su cinta', () => {
  const Ci = PK.Cintas, L = PK.Logi, Lb = PK.Libro, st0 = G.state, bs0 = G.buildings, by0 = G.bById, cap0 = G.cap, capDe0 = G.capDe, stat0 = G.stat, bAt0 = W.bAt.slice(), belt0 = W.belt.slice(), buf0 = L.bufCap;
  G.stat = () => {}; G.cap = () => 1e9; G.capDe = () => 1e9; L.bufCap = () => 100000;
  const mk = (id, type, x, y, extra) => { const def = D.BUILD[type]; return Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def, x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2, workers: [] }, extra || {}); };
  const poner = b => { for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) W.bAt[W.idx(b.x + i, b.y + j)] = b.id; };
  // aserradero → forja por la fila 41; bodega → bodega por la fila 51
  const saw = mk(1, 'sawmill', 20, 40, { inb: {}, outb: { planks: PILA - 1 } }), forja = mk(2, 'forge', 31, 41, { inb: {}, outb: {} });
  const a = mk(3, 'warehouse', 20, 50, { inv: { wood: PILA - 6 } }), b = mk(4, 'warehouse', 30, 50, { inv: {} });
  G.buildings = [saw, forja, a, b]; G.bById = new Map(G.buildings.map(o => [o.id, o]));
  W.bAt.fill(-1); W.belt.fill(-1); G.buildings.forEach(poner);
  G.state = Object.assign({}, st0 || {}, { era: 6, res: { planks: 0, wood: PILA - 6 }, flags: {}, auto: { reserve: 0 }, logi: { belts: [], rutas: [], red: { v: 1, t: {} } } });
  const t = G.state.logi.red.t;
  try {
    for (let x = 23; x <= 30; x++) t[W.idx(x, 41)] = { p: 'c', d: 0, n: 5, i: [] };
    for (let x = 23; x <= 29; x++) t[W.idx(x, 51)] = { p: 'c', d: 0, n: 5, i: [] };
    Ci.init(G.state);
    const boca = Ci.carrilesEn(W.idx(23, 51))[0];
    boca.pz.f = ['wood']; Ci.cambio();
    const its = () => Object.values(t).flatMap(pz => pz.i);
    for (let i = 0; i < 30; i++) Ci.update(0.1);
    assert.equal(its().length, 0, 'con menos de un paquete no sale nada');
    assert.equal(saw.outb.planks, PILA - 1);
    assert.match(Ci.porQueNoSale(boca, 'wood'), /espera juntar 16 .*tiene 10/);
    saw.outb.planks += 1; Lb.inv(a).wood += 6; G.state.res.wood += 6;
    for (let i = 0; i < 3; i++) Ci.update(0.1);
    assert.deepEqual(its().map(it => it[0] + 'x' + it[2]).sort(), ['planksx' + PILA, 'woodx' + PILA], 'salen llenos');
    assert.equal(saw.outb.planks, 0); assert.equal(Lb.inv(a).wood || 0, 0);
    // el taller junto a una bodega le deja un paquete a la cinta y manda a la bodega solo lo que sobra
    assert.ok(Ci.sacaDe(saw), 'la cinta se lleva los tablones del aserradero');
    saw.outb.planks = PILA + 5; G.state.res.planks = 0; saw.sinReserva = true; // (sin insumos: la reserva no viene al caso)
    for (let i = 0; i < 40; i++) L.direct(saw, 0.1);
    assert.ok(Math.abs(saw.outb.planks - PILA) < 1e-6, 'queda un paquete para la cinta (' + saw.outb.planks + ')');
    assert.ok(Math.abs(G.state.res.planks - 5) < 1e-6);
    forja.outb.ingots = 50;
    assert.ok(!Ci.sacaDe(forja), 'sin cinta que se lleve su producción');
  } finally { G.state = st0; G.buildings = bs0; G.bById = by0; G.cap = cap0; G.capDe = capDe0; G.stat = stat0; L.bufCap = buf0; W.bAt.set(bAt0); W.belt.set(belt0); }
});

test('pk-77: un traslado entre bodegas descarga aunque el pueblo esté sobre el tope, no descarga en una bodega llena y no da vueltas si su destino desaparece', () => {
  const L = PK.Logi, Lb = PK.Libro, st0 = G.state, bs0 = G.buildings, us0 = G.units, by0 = G.bById, cap0 = G.cap, capDe0 = G.capDe, stat0 = G.stat;
  const mk = (id, type, x) => { const def = D.BUILD[type]; return { id, type, owner: 'p', done: true, lvl: 1, def, x, y: 10, w: def.w, h: def.h, cx: x + def.w / 2, cy: 10 + def.h / 2, inv: {}, workers: [] }; };
  const tc = mk(1, 'tc', 10), wh = mk(2, 'warehouse', 40), gr = mk(3, 'granary', 70);
  const CAP = { tc: { wood: 1000, food: 1000 }, warehouse: { wood: 1000 }, granary: { food: 1000 } };
  G.capDe = (b, r) => (CAP[b.type] || {})[r] || 0;
  G.cap = r => G.buildings.filter(b => b.done).reduce((n, b) => n + G.capDe(b, r), 0);
  G.stat = () => {};
  const rend0 = PK.Render; PK.Render = rend0 || {};
  G.buildings = [tc, wh, gr]; G.bById = new Map(G.buildings.map(b => [b.id, b]));
  G.state = Object.assign({}, st0 || {}, { res: { wood: 2500, food: 500 }, flags: {}, logi: { rutas: [], belts: [], nextRuta: 2, red: { v: 1, t: {} } } });
  const r = { id: 1, de: tc.id, a: 'bodega', lista: ['wood', 'food'] };
  G.state.logi.rutas.push(r);
  const junto = b => ({ x: b.x - 0.5, y: b.y + 0.5 });
  const cargada = (b, n) => { G.state.res.wood -= n; return Object.assign({ id: 50, kind: 'cart', owner: 'p', ruta: 1, carry: n, carryRes: 'wood', wait: 0, rA: wh.id, path: [] }, junto(b)); };
  try {
    tc.inv = { wood: 2400, food: 500 }; wh.inv = {}; // el pueblo sobre el tope (un premio): 2500 con tope 2000
    const u = cargada(wh, 100); G.units = [u];
    L.cart(u, 0.1);
    assert.equal(u.carry, 0, 'descarga en el Almacén vacío (' + u.estado + ')');
    assert.equal(wh.inv.wood, 100); assert.equal(G.state.res.wood, 2500, 'el total del pueblo no cambia');
    // un Almacén lleno: espera con la carga en vez de «descargar» y que la conciliación lo devuelva al origen
    tc.inv.wood = 900; wh.inv.wood = 1000; G.state.res.wood = 1900;
    const u2 = cargada(wh, 100); u2.id = 51; G.units = [u2];
    L.cart(u2, 0.1);
    assert.equal(u2.carry, 100, 'no descarga en una bodega llena (' + u2.estado + ')');
    assert.equal(wh.inv.wood, 1000);
    // el Almacén desaparece con la carreta cargada: ninguna otra bodega guarda madera, la carga vuelve al pueblo
    G.buildings = [tc, gr]; G.bById = new Map(G.buildings.map(b => [b.id, b]));
    const u3 = cargada(gr, 100); u3.id = 52; G.units = [u3];
    for (let i = 0; i < 10 && u3.carry > 0; i++) { u3.wait = 0; L.cart(u3, 0.1); Object.assign(u3, junto(G.bById.get(u3.rA) || gr)); }
    assert.equal(u3.carry, 0, 'no da vueltas con la madera (' + u3.estado + ')');
    assert.equal(G.state.res.wood, 1800, 'la madera vuelve al pueblo (la de la segunda carreta sigue arriba de ella)');
  } finally { G.state = st0; G.buildings = bs0; G.units = us0; G.bById = by0; G.cap = cap0; G.capDe = capDe0; G.stat = stat0; PK.Render = rend0; }
});

test('pk-77: cintas — el unidor no se traba con un divisor, el clasificador manda por «lo que sobre» lo que su rama no recibe, sin restos de paquete y sin conexión por origen', () => {
  const Ci = PK.Cintas, L = PK.Logi, Lb = PK.Libro, st0 = G.state, bs0 = G.buildings, by0 = G.bById, cap0 = G.cap, capDe0 = G.capDe, stat0 = G.stat, bAt0 = W.bAt.slice(), belt0 = W.belt.slice(), buf0 = L.bufCap;
  G.stat = () => {};
  const mk = (id, type, x, y, extra) => { const def = D.BUILD[type]; return Object.assign({ id, type, owner: 'p', done: true, lvl: 1, def, x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2, workers: [] }, extra || {}); };
  const mundo = (bs, res) => {
    G.buildings = bs; G.bById = new Map(bs.map(o => [o.id, o]));
    W.bAt.fill(-1); W.belt.fill(-1);
    for (const b of bs) for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) W.bAt[W.idx(b.x + i, b.y + j)] = b.id;
    G.state = Object.assign({}, st0 || {}, { era: 6, res, flags: {}, auto: { reserve: 0 }, logi: { belts: [], rutas: [], red: { v: 1, t: {} } } });
    return G.state.logi.red.t;
  };
  try {
    // 1) bodega (piedra y madera) → divisor V: adelante una cantería llena de piedra, abajo un unidor que también recibe
    //    madera de otra cinta y entrega a un aserradero. La piedra en la punta de V no puede ir al unidor: no lo traba.
    G.cap = () => 1e9; G.capDe = () => 1e9; L.bufCap = () => 100;
    let a = mk(1, 'warehouse', 20, 47, { inv: { wood: 5000, stone: 5000 } }), mas = mk(2, 'masonry', 29, 47, { inb: { stone: 100 }, outb: {} }), saw = mk(3, 'sawmill', 25, 51, { inb: {}, outb: {} });
    let t = mundo([a, mas, saw], { wood: 5000, stone: 5000 });
    for (let x = 23; x <= 28; x++) t[W.idx(x, 48)] = { p: x === 26 ? 'v' : 'c', d: 0, n: 5, i: [] };
    t[W.idx(26, 49)] = { p: 'u', d: 1, n: 5, i: [] }; t[W.idx(26, 50)] = { p: 'c', d: 1, n: 5, i: [] };
    for (let x = 23; x <= 25; x++) t[W.idx(x, 49)] = { p: 'c', d: 0, n: 5, i: [] };
    Ci.init(G.state);
    Ci.carrilesEn(W.idx(23, 48))[0].pz.f = ['stone', 'wood']; Ci.carrilesEn(W.idx(23, 49))[0].pz.f = ['wood']; Ci.cambio();
    let got = 0, tarde = 0;
    for (let i = 0; i < 400; i++) { const n = saw.inb.wood || 0; got += n; if (i >= 300) tarde += n; saw.inb.wood = 0; Ci.update(0.1); Lb.conciliar(); }
    assert.ok(tarde > 100, 'el aserradero sigue recibiendo madera (' + got + ', en los últimos 10 s ' + tarde + ')');
    // 2) clasificador: «madera» al norte (a una forja, que no la usa), «lo que sobre» adelante al aserradero
    G.cap = () => 1e9; G.capDe = () => 1e9; L.bufCap = () => 1e6;
    a = mk(1, 'warehouse', 20, 50, { inv: { wood: 1000 } }); saw = mk(2, 'sawmill', 30, 50, { inb: {}, outb: {} });
    const forja = mk(3, 'forge', 26, 46, { inb: {}, outb: {} });
    t = mundo([a, saw, forja], { wood: 1000 });
    for (let x = 23; x <= 29; x++) t[W.idx(x, 51)] = { p: x === 26 ? 's' : 'c', d: 0, n: 5, i: [] };
    t[W.idx(26, 51)].f2 = { 0: '*', 3: 'wood' };
    for (let y = 50; y >= 48; y--) t[W.idx(26, y)] = { p: 'c', d: 3, n: 5, i: [] };
    Ci.init(G.state);
    Ci.carrilesEn(W.idx(23, 51))[0].pz.f = ['wood']; Ci.cambio();
    for (let i = 0; i < 300; i++) { Ci.update(0.1); Lb.conciliar(); }
    assert.ok((saw.inb.wood || 0) > 500, 'la madera sigue por «lo que sobre» (' + saw.inb.wood + ')');
    // 3) S.res por debajo del estante (antes de conciliar): no sale un paquete de 15,5 que después se traba
    G.cap = () => 1e9; G.capDe = () => 1e9; L.bufCap = () => 100;
    a = mk(1, 'warehouse', 20, 50, { inv: { wood: 40 } }); saw = mk(2, 'sawmill', 30, 50, { inb: { wood: 85 }, outb: {} });
    t = mundo([a, saw], { wood: 40 });
    for (let x = 23; x <= 29; x++) t[W.idx(x, 51)] = { p: 'c', d: 0, n: 5, i: [] };
    Ci.init(G.state);
    Ci.carrilesEn(W.idx(23, 51))[0].pz.f = ['wood']; Ci.cambio();
    G.state.res.wood = 15.5;
    Ci.update(0.1);
    assert.equal(t[W.idx(23, 51)].i.length, 0, 'no sale un paquete a medias');
    G.state.res.wood = 24.5; Lb.conciliar();
    for (let i = 0; i < 200; i++) { Ci.update(0.1); if (i >= 50) saw.inb.wood = 0; }
    assert.equal(t[W.idx(29, 51)].i.length, 0, 'la punta no queda trabada');
    // el resto de un paquete menor que 1 entra igual
    t[W.idx(29, 51)].i = [['wood', 1, 0.5, 1]]; saw.inb.wood = 0;
    Ci.update(0.1);
    assert.equal(t[W.idx(29, 51)].i.length, 0); assert.equal(saw.inb.wood, 0.5);
    // 4) sin conexión: lo del campamento no usa el margen de lo que sale de bodegas, y cada boca pierde lo que entregó
    G.cap = () => 1000; G.capDe = (b, r) => (b.type === 'warehouse' ? 1000 : 0); L.bufCap = () => 1e6;
    const camp = mk(1, 'lumber', 20, 40, { inv: { wood: 300 } }), b = mk(2, 'warehouse', 30, 40, { inv: { wood: 1000 } });
    a = mk(3, 'warehouse', 20, 50, { inv: {} }); saw = mk(4, 'sawmill', 30, 50, { inb: {}, outb: {} });
    t = mundo([camp, b, a, saw], { wood: 1000 });
    for (let x = camp.x + camp.w; x <= 29; x++) t[W.idx(x, 41)] = { p: 'c', d: 0, n: 5, i: [] };
    for (let x = 23; x <= 29; x++) t[W.idx(x, 51)] = { p: 'c', d: 0, n: 5, i: [] };
    Ci.init(G.state);
    a.inv.wood = 200; G.state.res.wood = 1200; b.inv.wood = 1000;
    Ci.carrilesEn(W.idx(23, 51))[0].pz.f = ['wood']; Ci.cambio();
    Ci.offline(10);
    assert.equal(camp.inv.wood, 300, 'el campamento no entrega: el pueblo está sobre el tope');
    assert.equal(G.state.res.wood + (saw.inb.wood || 0), 1200, 'lo que sale de la bodega A llega al aserradero, nada más');
  } finally { G.state = st0; G.buildings = bs0; G.bById = by0; G.cap = cap0; G.capDe = capDe0; G.stat = stat0; L.bufCap = buf0; W.bAt.set(bAt0); W.belt.set(belt0); }
});

// ---------- Plan «Hacha y Pico» (PLAN-HACHA-Y-PICO.md) ----------

test('HP1 (pk-82): cada taller tiene tope por era, que nunca baja, y los de más (de antes) se conservan', () => {
  const tabla = { sawmill: [2, 2, 3, 3, 4, 4, 5, 5, 6], masonry: [2, 2, 3, 3, 4, 4, 5, 5, 6], smelter: [2, 2, 2, 3, 3, 4, 4, 5, 5],
    forge: [1, 1, 2, 2, 2, 3, 3, 3, 4], scriptorium: [1, 1, 2, 2, 2, 3, 3, 3, 4], steelworks: [1, 1, 2, 2, 3, 3, 4, 4, 5], workshop: [0, 1, 1, 2, 2, 3, 3, 4, 4] };
  for (const t in tabla) for (let e = 2; e <= 10; e++) {
    // en eras anteriores al taller el número no importa (no se puede construir); se compara desde la suya
    if (e >= D.BUILD[t].era) assert.equal(D.BUILD[t].max(e), tabla[t][e - 2], t + ' en la Era ' + e);
  }
  for (const t of Object.keys(D.BUILD).filter(k => D.BUILD[k].recipe)) {
    assert.equal(typeof D.BUILD[t].max, 'function', t + ' no tiene tope');
    for (let e = D.BUILD[t].era; e < 12; e++) assert.ok(D.BUILD[t].max(e + 1) >= D.BUILD[t].max(e), t + ' baja de la Era ' + e);
    assert.ok(D.BUILD[t].max(D.BUILD[t].era) >= 1, t + ' no se puede construir en su era');
  }
  assert.equal(D.BSTATS.sawmill(11).slots, 3 + 5, 'un puesto cada 2 niveles');
  const st0 = G.state, bs0 = G.buildings, mc0 = G.maxCount;
  try {
    G.state = { era: 3, res: {}, flags: {} };
    G.maxCount = t => D.BUILD[t].max(3);
    G.buildings = [1, 2, 3, 4].map(i => ({ id: i, type: 'sawmill', owner: 'p', done: true, lvl: 1, def: D.BUILD.sawmill }));
    const t = G.topeInfo('sawmill');
    assert.equal(t.max, 2); assert.ok(t.sobra, 'tiene más que el tope');
    assert.equal(t.sig.era, 4); assert.equal(t.sig.max, 3);
    assert.match(G.topeTexto('sawmill'), /siguen trabajando/);
  } finally { G.state = st0; G.buildings = bs0; G.maxCount = mc0; }
  assert.match(fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8'), /const max = def\.recipe \? undefined/, 'el servidor no descarta talleres de más');
});

test('HP1 (pk-82): campamentos, carromatos, carretas, muelle de colonia y barcaza llevan más', () => {
  assert.equal(D.campoCap(1), 900); assert.equal(D.campoCap(11), 5400);
  assert.equal(D.CARROMATO.cap, 600); assert.equal(D.CARROMATO.capLvl, 120);
  assert.equal(D.BSTATS.cartwright(1).cartCap, 45); assert.equal(D.BSTATS.cartwright(11).cartCap, 165);
  assert.equal(D.coloniaCap(1), 1500); assert.equal(D.coloniaCap(11), 6500);
  assert.equal(D.BARCAZA.cap, 700); assert.equal(D.BARCAZA.capLvl, 140);
  assert.ok(PK.Logi.MEDIA_MAX > 0 && PK.Logi.MEDIA_MAX < D.CARROMATO.cap / 2, 'un carromato grande no espera media carga entera');
  assert.equal((JS('logistics.js').match(/cap \* 0\.5/g) || []).length, 1, 'toda «media carga» pasa por media()');
});

test('HP2 (pk-83): Taller del Hachero — tres ramas que al máximo dan ×4 por minuto y por árbol, y el árbol dura lo mismo', () => {
  const H = D.HACHERO, R = H.ramas, M = r => R[r].mult[5];
  assert.deepEqual([...H.orden], ['filo', 'golpe', 'aguante']);
  assert.ok(Math.abs(M('filo') * M('golpe') - 4) < 1e-9, 'madera por minuto ×4');
  assert.ok(Math.abs(M('golpe') * M('aguante') - 4) < 1e-9, 'madera por árbol ×4');
  assert.ok(Math.abs(M('filo') / M('aguante') - 1) < 1e-9, 'el árbol dura lo mismo');
  for (const r of H.orden) {
    assert.equal(R[r].mult.length, 6); assert.equal(R[r].niv.length, 6);
    for (let n = 1; n <= 5; n++) assert.ok(R[r].mult[n] > R[r].mult[n - 1], r + ' sube en cada nivel');
  }
  for (let n = 1; n < 5; n++) {
    const a = H.niveles[n - 1], b = H.niveles[n];
    assert.ok(b.era > a.era && b.time > a.time && b.prueba > a.prueba, 'cada nivel pide más que el anterior');
  }
  assert.equal(D.talaMax(1), 1); assert.equal(D.talaMax(7), R.filo.mult[4] * R.golpe.mult[4]); assert.ok(Math.abs(D.talaMax(8) - 4) < 1e-9);
  for (let n = 1; n <= 5; n++) assert.equal(D.BSTATS.hachero(H.lvlTaller(n)).talaNivel, n, 'el nivel del taller abre el de la herramienta');
  assert.match(fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8'), /D\.talaMax\(era\)/, 'el servidor suma las herramientas a kindRate');
  // investigar: requisitos, la prueba de campo, una cosa a la vez y el efecto
  const st0 = G.state, bs0 = G.buildings, pay0 = G.pay, ca0 = G.canAfford, cb0 = G.countB, sta0 = G.stat;
  try {
    G.stat = () => {};
    const taller = { id: 1, type: 'hachero', owner: 'p', done: true, lvl: 1, def: D.BUILD.hachero };
    G.buildings = [taller];
    G.state = { era: 2, res: {}, flags: {}, stats: {} };
    G.pay = () => true; G.canAfford = () => true; G.countB = t => (t === 'hachero' ? 1 : 0);
    assert.equal(G.talaRate(), 1); assert.equal(G.talaDesgaste(), 1);
    assert.ok(!G.talaSig('golpe').ok, 'sin prueba de campo no se puede');
    G.talaCorta(H.niveles[0].prueba);
    assert.ok(G.talaSig('golpe').ok && G.talaEmpezar('golpe'));
    assert.equal(G.state.tala.cortado.golpe, 0, 'la prueba del nivel siguiente empieza de cero');
    assert.equal(G.state.tala.cortado.filo, H.niveles[0].prueba, 'las otras ramas siguen contando');
    assert.ok(!G.talaEmpezar('filo'), 'una cosa a la vez');
    G.talaTick(H.niveles[0].time + 1);
    assert.equal(G.state.tala.n.golpe, 1);
    assert.ok(Math.abs(G.talaRate() - R.golpe.mult[1]) < 1e-9);
    assert.ok(Math.abs(1 / G.talaDesgaste() - R.golpe.mult[1]) < 1e-9, 'el árbol pierde menos de lo que junta el leñador');
    assert.ok(!G.talaSig('golpe').ok, 'el nivel II pide la Era III y el taller en nivel 3');
    G.state.tala.n = { filo: 5, golpe: 5, aguante: 5 };
    assert.ok(Math.abs(G.talaRate() - 4) < 1e-9 && Math.abs(1 / G.talaDesgaste() - 4) < 1e-9);
    assert.equal(G.talaSig('filo'), null, 'al máximo no hay siguiente');
  } finally { G.state = st0; G.buildings = bs0; G.pay = pay0; G.canAfford = ca0; G.countB = cb0; G.stat = sta0; }
  // el árbol pierde por desgaste, no por lo que junta (en vivo y sin conexión)
  assert.match(JS('entities.js'), /n\.amount -= dg/);
  assert.match(JS('game.js'), /n\.amount -= take \* dg/);
});

test('HP3 (pk-84): Mina Profunda — estratos, vetas con semilla, topes y lo mismo en vivo que sin conexión', () => {
  const M = D.MINA, Mi = PK.Mina;
  for (const e of M.estratos) assert.equal(Object.values(e.res).reduce((a, b) => a + b, 0), 100, e.name + ' suma 100');
  assert.equal(D.BUILD.mina.max, 1, 'una sola mina por reino');
  assert.ok(D.BUILD.mina.mina && D.BUILD.mina.era === 3);
  assert.equal(D.BSTATS.mina(9).pisos, 9, 'un piso por nivel');
  assert.deepEqual({ ...D.vetaMina(1234, 7, 3) }, { ...D.vetaMina(1234, 7, 3) }, 'la misma veta siempre');
  assert.deepEqual({ ...D.pisoMina(99, 10) }.agua, { ...D.pisoMina(99, 10) }.agua);
  // más hondo, vetas más grandes y minerales más raros
  const prom = (n, f) => { let s2 = 0; for (let i = 0; i < 200; i++) s2 += f(D.vetaMina(777, n, i)); return s2 / 200; };
  assert.ok(prom(10, v => v.cant) > 2 * prom(1, v => v.cant), 'las vetas del piso 10 son más grandes');
  assert.equal(prom(1, v => (v.res === 'gems' ? 1 : 0)), 0, 'arriba no hay gemas');
  assert.ok(prom(14, v => (v.res === 'gems' ? 1 : 0)) > 0.35, 'en el fondo, muchas gemas');
  assert.equal(prom(13, v => (v.esp ? 1 : 0)), 0, 'especiales solo desde el piso 14');
  const esp = prom(16, v => (v.esp ? 1 : 0));
  assert.ok(esp > 0.05 && esp < 0.25, 'especiales en medida justa (una de cada 8 vetas aprox.): ' + esp);
  assert.ok(Math.abs(D.minaRitmo(10, false, false) - 1.45) < 1e-9 && D.minaMax(10) > D.minaMax(5));
  assert.match(fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8'), /D\.minaMax\(era\)/, 'el servidor suma la mina a kindRate');
  // una hora en pasos de 1 s y en pasos de 60 s da lo mismo
  const guarda = {}, cambia = o => { for (const k in o) { guarda[k] = G[k]; G[k] = o[k]; } };
  const ais0 = PK.Logi.campoAislado;
  const corre = paso => {
    const b = { id: 7, type: 'mina', owner: 'p', done: true, lvl: 12, def: D.BUILD.mina, x: 0, y: 0, w: 4, h: 3, cx: 2, cy: 1.5, workers: [], inv: {} };
    const st = { era: 7, created: 1, res: { stone: 0, gold: 0, ore: 0, marble: 0, gems: 0 }, flags: {}, stats: {} };
    let dado = {};
    cambia({ state: st, buildings: [b], units: [], gatherRate: (o, r) => D.NODES[r].rate, cap: () => 1e12, metaNecesita: () => ({}), give: o => { for (const k in o) dado[k] = (dado[k] || 0) + o[k]; }, stat: () => {}, gained: () => {}, offline: true });
    PK.Logi.campoAislado = () => false;
    Mi.estado(b).mont = 3;
    for (let n = 1; n <= 12; n++) { const pz = Mi.piso(b, n); pz.m.ventilacion = 1; pz.m.bomba = 1; pz.m.rieles = 1; }
    for (let i = 0; i < 70; i++) { b.workers.push(100 + i); Mi.ubicar(b, { id: 100 + i, task: {} }); }
    assert.ok(b.workers.length <= Mi.puestos(b));
    for (let t = 0; t < 3600; t += paso) Mi.paso(paso);
    const tot = PK.Libro.totalCampo(b);
    return { tot, inv: Object.assign({}, b.inv), dado, cap: PK.Libro.capCampo(b), cuenta: Mi.cuenta(b) };
  };
  try {
    const a = corre(1), c = corre(60);
    assert.ok(a.tot > 1000, 'la mina saca algo: ' + a.tot);
    assert.ok(Math.abs(a.tot - c.tot) / a.tot < 0.01, 'en vivo ' + a.tot + ' y sin conexión ' + c.tot);
    assert.ok(a.tot <= a.cap + 1e-6, 'no pasa la bodega de la mina');
    assert.ok(a.tot <= D.MINA.montacargas[3].sube * 60 + 1e-6, 'no pasa el montacargas');
    assert.equal(a.cuenta.reduce((x, y) => x + y, 0), 70);
  } finally { for (const k in guarda) G[k] = guarda[k]; PK.Logi.campoAislado = ais0; }
  // un piso con gas sin ventilación no se trabaja
  const b2 = { id: 9, type: 'mina', owner: 'p', done: true, lvl: 19, def: D.BUILD.mina, workers: [], inv: {}, mina: { sem: 5, pisos: [], asig: {}, mont: 0, mano: false } };
  const gas = Array.from({ length: 19 }, (_, i) => i + 1).find(n => D.pisoMina(5, n).gas);
  assert.ok(gas, 'hay algún piso con gas');
  assert.ok(!Mi.trabajable(b2, gas)); Mi.piso(b2, gas).m.ventilacion = 1; assert.ok(Mi.trabajable(b2, gas));
  // la mina es un campamento para la logística y en ella no descarga nadie
  assert.ok(PK.Libro.CAMPOS.mina);
  assert.match(JS('game.js'), /b\.def\.mina\) continue; \/\/ pk-84: en la mina no descarga nadie/);
});
