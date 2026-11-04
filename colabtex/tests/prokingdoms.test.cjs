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
const PK = carga(['util.js', 'data.js', 'world.js', 'entities.js', 'game.js', 'auto.js', 'consejo.js', 'asesor.js', 'heroes.js', 'incursion.js', 'life.js', 'aventura.js', 'leyendas.js', 'campana.js', 'datos-vida.js', 'vida.js']);
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
  const sp = JS('sprites.js'), i = sp.indexOf('const BDRAW = {'), bloque = sp.slice(i, sp.indexOf('\n  };', i));
  for (const t of Object.keys(D.BUILD)) {
    assert.ok(new RegExp('\\b' + t + '\\s*[:(]').test(bloque), t + ' no tiene BDRAW en sprites.js');
    if (!D.BUILD[t].noUp) assert.equal(typeof D.BSTATS[t], 'function', t + ' se mejora pero no tiene D.BSTATS');
    assert.ok(D.BUILD_ORDER.includes(t), t + ' no está en D.BUILD_ORDER');
  }
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
test('todo enemigo tiene al menos 2 tropas con ventaja', { todo: 'las bestias solo tienen al Lancero (Fase 4)' }, () => {
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
    assert.deepEqual([...H.ORDEN].sort(), Object.keys(H.CLASES).sort());
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
  const stat0 = G.stat, inv0 = G.invalidateCaps;
  G.stat = () => {}; G.invalidateCaps = () => {};
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
  } finally { G.state = viejo; G.stat = stat0; G.invalidateCaps = inv0; }
});
