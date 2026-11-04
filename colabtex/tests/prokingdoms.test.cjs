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
const PK = carga(['util.js', 'data.js', 'world.js', 'entities.js', 'game.js', 'auto.js', 'consejo.js', 'asesor.js', 'heroes.js']);
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
