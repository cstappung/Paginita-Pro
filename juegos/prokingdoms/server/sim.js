// Lógica del servidor: jugadores, mundos (16 casillas de reino cada uno), zonas comunes y territorio con
// autoridad, mercado global, gremios y conquista de parcelas entre jugadores. Los reinos vacíos siguen simulados.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const store = require('./store');

// El servidor carga el mismo código de datos y mapa que el navegador: así conoce exactamente los
// mismos recursos (mismos ids) sin duplicar nada.
const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ window: {}, console });
for (const f of ['js/util.js', 'js/data.js', 'js/pase.js', 'js/world.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const PK = ctx.window.PK, D = PK.D, W = PK.World;
D.setupRealms(-1, null);
W.generate(D.SEED);

const COMMON = {};   // id del recurso -> { kind, max, zone }
const BY_ZONE = {};  // id de zona -> [ids]
for (const n of W.nodes) {
  if (!W.isShared(n)) continue;
  const z = W.zones[n.zone].id;
  COMMON[n.id] = { kind: n.kind, max: n.max, zone: z };
  (BY_ZONE[z] = BY_ZONE[z] || []).push(String(n.id));
}

const SLOTS = D.REALM_SLOTS.length;
// Territorio inicial: el mismo reparto que genera el mapa (parcela -> casilla+1, 0 = libre).
const TERR0 = Array.from(W.terrStart);
const TSTART = new Array(SLOTS).fill(0);
for (const v of TERR0) if (v) TSTART[v - 1]++;
const ONLINE_MS = 40000;      // «en línea»: con sync cada 15 s (Cloud Functions), dos syncs perdidos no lo apagan
const BOT_RATE = 500;          // recursos por hora que un reino simulado saca de las zonas comunes
const RES = D.RES_ORDER;
const BASE = { food: 100, wood: 100, stone: 130, ore: 140, marble: 320, gems: 1500, planks: 260, blocks: 450, ingots: 650, tools: 1600, books: 900, steel: 1800, machinery: 5000, gold: 100 };
const ARMY = Object.keys(D.ARMY);
const MERCHANTS = ['Mercader Odo', 'Hansa del Norte', 'Caravana de Salim', 'Lonja de Vera', 'Mercader Ilse'];
const NPC_MEMBERS = D.GUILD_MEMBERS;

const now = () => Date.now();
const rid = p => p + crypto.randomBytes(6).toString('hex');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const cleanText = (s, n) => String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

class GameError extends Error { constructor(msg, status) { super(msg); this.status = status || 400; } }

// ---------- Reinicio por versión del mundo (D.MUNDO_VER) ----------
// Antes de leer a nadie: si la versión guardada es otra, se borra todo menos las sospechas. Sin versión
// guardada (el primer arranque con esto) solo se anota, sin borrar.
if (store.mundoVer) {
  const v = store.mundoVer();
  if (v === null || v === undefined) store.setMundoVer(D.MUNDO_VER);
  else if (v !== D.MUNDO_VER) { store.reinicia(D.MUNDO_VER); console.log('Mundo reiniciado: versión', v, '→', D.MUNDO_VER); }
}

// ---------- Jugadores y mundos ----------
const tokens = new Map(), uids = new Map();
for (const p of store.all('players')) { tokens.set(p.token, p); if (p.uid) uids.set(p.uid, p); }

const player = id => store.get('players', id);
const byToken = t => (t ? tokens.get(t) || null : null);
// En Cloud Functions la cuenta es el uid de Firebase (verificado antes de llamar a join): una cuenta, un reino.
const byUid = u => (u ? uids.get(u) || null : null);
const world = p => store.get('worlds', p.world);

function newWorld() {
  const n = store.all('worlds').length + 1;
  const w = { id: 'w' + n, name: 'Mundo ' + n, slots: new Array(SLOTS).fill(null), nodes: {}, nv: {}, ver: 1, last: now(), botCur: {}, mapv: D.MAPV, terr: TERR0.slice(), tv: 1, tshield: {}, botGrow: {} };
  for (const id in COMMON) w.nodes[id] = [COMMON[id].max, 0];
  return store.set('worlds', w.id, w);
}
// Si cambió el mapa (nueva versión del juego), los recursos compartidos de los mundos viejos se reinician.
for (const w of store.all('worlds')) {
  if (w.mapv === D.MAPV) continue;
  w.mapv = D.MAPV; w.nodes = {}; w.nv = {}; w.botCur = {}; w.ver = (w.ver || 1) + 1;
  w.terr = TERR0.slice(); w.tv = (w.tv || 0) + 1; w.tshield = {}; w.botGrow = {};
  // el mapa nuevo tiene más casillas de reino
  while (w.slots.length < SLOTS) w.slots.push(null);
  for (const id in COMMON) w.nodes[id] = [COMMON[id].max, 0];
  for (const pid of w.slots) { const o = pid && store.get('players', pid); if (o) { o.buildings = []; o.bver = 'map' + D.MAPV; o.units = []; o.snap = null; } }
  store.touch('worlds'); store.touch('players');
  console.log('Mapa actualizado en', w.name);
}

for (const w of store.all('worlds')) ensureTerr(w); // mundos guardados antes del territorio
store.touch('worlds');

function humans(w, me) {
  const out = {};
  w.slots.forEach((pid, slot) => {
    if (!pid || (me && pid === me.id)) return;
    const o = player(pid);
    if (o) out[slot] = { id: o.id, name: o.name };
  });
  return out;
}

function join(b) {
  // un cliente de otra versión vería otro mapa: mejor un mensaje claro (el juego ofrece jugar sin conexión)
  if (b.proto !== D.PROTO) throw new GameError('El servidor se está actualizando. Recarga la página en unos minutos.', 426);
  // b.uid solo lo pone el servidor (functions/index.js, tras verificar el token de Firebase); el cliente no lo elige
  let p = b.uid ? byUid(b.uid) : byToken(b.token);
  const name = cleanText(b.name, 20);
  if (!p) {
    const pref = Number.isInteger(b.preferSlot) && b.preferSlot >= 0 && b.preferSlot < SLOTS ? b.preferSlot : null;
    let w = store.all('worlds').find(o => (pref !== null ? o.slots[pref] === null : o.slots.includes(null)));
    if (!w) w = newWorld();
    const slot = pref !== null ? pref : w.slots.indexOf(null);
    p = {
      id: rid('p'), token: rid('t') + crypto.randomBytes(8).toString('hex'), name: name || 'Jugador',
      world: w.id, slot, created: now(), lastSeen: now(), snap: null, buildings: [], bver: '', units: [],
      inbox: [], inSeq: 0,
    };
    if (b.uid) { p.uid = b.uid; uids.set(b.uid, p); }
    w.slots[slot] = p.id;
    store.touch('worlds');
    store.set('players', p.id, p);
    tokens.set(p.token, p);
    console.log('Nuevo jugador', p.name, '→', w.name, 'casilla', slot);
  } else if (name) p.name = name;
  p.lastSeen = now();
  store.touch('players');
  const w = world(p);
  return { player: { id: p.id, name: p.name, token: p.token }, world: { id: w.id, name: w.name, slot: p.slot, humans: humans(w, p) }, hasSave: !!store.getSave(p.id), now: now() };
}

function push(p, item) {
  item.id = ++p.inSeq;
  item.at = now();
  p.inbox.push(item);
  if (p.inbox.length > 100) p.inbox.shift();
  credit(p, item.res);
  if (item.gold) credit(p, { gold: item.gold });
  store.touch('players');
}

// ---------- Antitrampa: límites a lo que informa el cliente ----------
// El cliente sigue calculando su reino, pero nada de lo que informa puede pasar de lo que un jugador real
// lograría con su era y sus aldeanos. Lo que se pasa se recorta o se rechaza y queda registrado; al jugador
// nunca se lo desconecta. Todos los topes son holgados: apuntan a frenar números imposibles, no a ajustar.
const LIM = {
  firstEra: 4,        // era máxima que se acepta en la primera foto de una cuenta
  eraGap: 0.1,        // fracción de D.eraTime(n) que debe pasar como mínimo entre dos subidas de era
  slack: 2.5,         // margen sobre la mejor tasa posible (deseos, eventos, reliquias, maravilla…)
  vida: 1.6,          // árbol 2.0, cartas de era y estación juntos (Fase 3): el cliente los topa en D.VIDA_TOPE
  startBudget: 120,   // segundos de recolección que trae una cuenta nueva
  maxKeys: 300,       // recursos distintos por sync
  resSlack: 0.2,      // margen fijo por foto (en múltiplos de scale(era)) para premios del cliente
  marketSync: 2,      // compra/venta con los mercaderes por sync, en oro (en múltiplos de scale)
  marketDay: 20,      // lo mismo, por día
  tradeValue: 10,     // valor máximo de una oferta (en múltiplos de scale, medido en oro)
  offersDay: 30, acceptsDay: 40, recvValueDay: 30,
  giftDay: 10,        // valor en oro que se puede mandar y recibir por día en el tablón "Necesito…" (en múltiplos de scale)
  contribDay: 6,      // aporte diario al gremio por recurso (en múltiplos de scale)
  helpsDay: 40, helpsPair: 8, helpedDay: 40, asksDay: 30,
  defendedDay: 10,    // premios de defensa por día
  pasePPDia: D.PASE.diaMax, // Pase del Reino: puntos por día como mucho (un tramposo como mucho completa el pase)
  paseSalto: 60,      // cuánto puede subir una estadística del pase entre dos syncs (más es un número inventado)
};
const TRACKED = ['food', 'wood', 'stone', 'gold']; // los recursos que el servidor ve en la foto
const scale = era => 1000 * Math.pow(1.6, era - 1);
const techMax = era => D.maxLevel('library', era);
const vEra = p => p.vera || (p.snap && p.snap.era) || 1;
const workers = p => clamp(p.snap ? p.snap.pop : 0, 5, D.maxPop(vEra(p)));
const guildStageOf = p => { const g = guildOf(p); return g ? g.stage : 0; };

// Mejor tasa por aldeano y segundo de un tipo de recurso: técnica al máximo de la era, punto de acopio al
// máximo, gremio real y un margen para todo lo demás.
function kindRate(kind, era, stage) {
  const L = techMax(era), tech = kind === 'deer' ? 1 + 0.2 * L : 1 + 0.15 * L;
  return D.NODES[kind].rate * tech * (1 + 0.1 * (L - 1)) * (1 + 0.03 * stage + 0.02 * L) * LIM.slack * LIM.vida;
}
const RES_KINDS = {};
for (const k in D.NODES) (RES_KINDS[D.NODES[k].res] = RES_KINDS[D.NODES[k].res] || []).push(k);
const resRate = (res, era, stage) => Math.max(0, ...(RES_KINDS[res] || []).map(k => kindRate(k, era, stage)));
// Multiplicador máximo de fuerza (rango, tácticas, era y bonos al máximo) y fuerza máxima por soldado.
const armyMultMax = era => (1 + 0.04 * (D.RANKS.length - 1)) * (1 + 0.15 * techMax(era)) * (1 + 0.05 * (era - 1)) * LIM.slack;
const unitPowerMax = era => Math.max(...ARMY.filter(k => D.ARMY[k].era <= Math.max(2, era)).map(k => D.ARMY[k].power)) * armyMultMax(era);

// Contadores diarios por jugador (se reinician al cambiar el día UTC).
function today(p) {
  const d = new Date().toISOString().slice(0, 10);
  if (!p.day || p.day.d !== d) p.day = { d, contrib: {}, helps: 0, helpTo: {}, helped: 0, asks: 0, offers: 0, accepts: 0, recv: 0, defended: 0 };
  return p.day;
}
// Lo que el servidor le entregó al jugador (buzón, ofertas, botín): se suma a lo que su foto puede crecer.
function credit(p, res) {
  if (!res) return;
  p.cred = p.cred || {};
  for (const r of TRACKED) if (res[r] > 0) p.cred[r] = (p.cred[r] || 0) + res[r];
}
// Descuenta del stock que el servidor conoce (para que no se gaste dos veces lo mismo entre fotos).
function spend(p, r, n) { if (p.snap && TRACKED.includes(r)) p.snap.res[r] = Math.max(0, p.snap.res[r] - n); }
const stockOf = (p, r) => (TRACKED.includes(r) ? (p.snap ? p.snap.res[r] : 0) : Infinity);

const logged = new Map(); // pid:tipo -> última vez registrada (como mucho una línea por minuto)
function suspect(p, kind, info) {
  p.flags = p.flags || {};
  p.flags[kind] = (p.flags[kind] || 0) + 1;
  store.touch('players');
  const key = p.id + ':' + kind, t = now();
  if (t - (logged.get(key) || 0) < 60000) return;
  logged.set(key, t);
  const entry = Object.assign({ at: new Date(t).toISOString(), pid: p.id, name: p.name, kind, n: p.flags[kind] }, info);
  console.warn('[sospecha]', p.name, kind, JSON.stringify(info));
  store.log(entry);
}

// Recolección en zonas comunes: cada jugador tiene una cubeta de "aldeano-segundos" que se llena con el
// tiempo real (hasta 12 h, como simulateOffline). Cada unidad recolectada cuesta 1 / tasa máxima de ese recurso.
function checkHarvest(p, harvest, w, t) {
  const n = workers(p), era = vEra(p), stage = guildStageOf(p);
  if (p.hb === undefined) { p.hb = n * LIM.startBudget; p.hbAt = t; }
  p.hb = Math.min(n * D.OFFLINE_CAP, p.hb + n * clamp((t - p.hbAt) / 1000, 0, D.OFFLINE_CAP));
  p.hbAt = t;
  const out = {};
  let asked = 0, kept = 0, keys = 0;
  for (const id in harvest) {
    const c = COMMON[id], h = Math.max(0, +harvest[id] || 0);
    if (!c || !h || ++keys > LIM.maxKeys) continue;
    asked += h;
    const cost = 1 / kindRate(c.kind, era, stage), ok = Math.min(h, c.max, p.hb / cost);
    if (ok <= 0) continue;
    p.hb -= ok * cost;
    out[id] = ok; kept += ok;
  }
  if (asked - kept > 1) suspect(p, 'recoleccion', { informado: Math.round(asked), aceptado: Math.round(kept), aldeanos: n, era });
  return out;
}

// Operaciones de mercado contra los mercaderes: mueven el precio global, así que su valor en oro tiene
// tope por sync y por día (si no, una sola cuenta podría llevar cualquier precio al máximo).
function checkMarket(p, ops) {
  const era = vEra(p), day = today(p), out = [];
  let left = Math.min(LIM.marketSync * scale(era), LIM.marketDay * scale(era) - (day.market || 0)), cut = 0;
  for (const op of ops.slice(0, 50)) {
    if (!op || !BASE[op.res] || op.res === 'gold') continue;
    const asked = clamp(+op.n || 0, 0, 1e7), n = Math.floor(Math.min(asked, Math.max(0, left) * 100 / (market().p[op.res] || BASE[op.res])));
    if (asked > n) cut += value(op.res, asked - n);
    if (n <= 0) continue;
    left -= value(op.res, n);
    day.market = (day.market || 0) + value(op.res, n);
    out.push({ res: op.res, n, side: op.side });
    credit(p, op.side === 'buy' ? { [op.res]: n } : { gold: value(op.res, n) });
  }
  if (cut > 1) suspect(p, 'mercado', { recortadoOro: Math.round(cut), hoy: Math.round(day.market || 0) });
  return out;
}

// Edificios de la foto: tipos existentes, niveles dentro del máximo de la era y cantidades dentro del tope.
function cleanBuildings(p, list, era) {
  const count = {}, out = [];
  let bad = 0;
  for (const b of list.slice(0, 800)) {
    const def = Array.isArray(b) && D.BUILD[b[0]];
    if (!def || !Number.isFinite(+b[1]) || !Number.isFinite(+b[2])) { bad++; continue; }
    const max = typeof def.max === 'function' ? def.max(era) : def.max;
    if (max !== undefined && (count[b[0]] = (count[b[0]] || 0) + 1) > max) { bad++; continue; }
    const lvl = clamp(Math.floor(+b[4] || 1), 1, D.maxLevel(b[0], era));
    if (lvl !== Math.floor(+b[4] || 1)) bad++;
    out.push([b[0], Math.floor(+b[1]), Math.floor(+b[2]), b[3] ? 1 : 0, lvl]);
  }
  if (bad) suspect(p, 'edificios', { descartados: bad, era });
  return out;
}
const buildingLevels = list => list.reduce((s, b) => s + (b[3] ? b[4] : 0), 0);
function towerDefense(list) {
  let d = 0;
  for (const [type, , , done, lvl] of list) if (done && (type === 'tower' || type === 'tc')) d += D.BSTATS[type](lvl).defense || 0;
  return d;
}

// Foto del reino: la era no baja ni salta, los recursos no crecen más de lo que se puede recolectar en el
// tiempo transcurrido (más lo que el servidor le entregó), y fuerza, defensa y puntaje tienen techo.
function checkSnap(p, raw, t) {
  const s = sanitizeSnap(raw), prev = p.snap, odd = {};
  // lo último que informó el cliente: solo se registra un salto nuevo, no la diferencia que ya se recortó antes
  const last = (prev && p.rawSnap) || null;
  p.rawSnap = { era: s.era, total: s.total, res: Object.assign({}, s.res) };
  if (p.vera == null && prev) p.vera = prev.era; // jugadores de antes de estas validaciones
  if (p.vera == null) {
    if (s.era > LIM.firstEra) odd.era = s.era;
    s.era = Math.min(s.era, LIM.firstEra);
    p.eraAt = t;
  } else if (s.era < p.vera) {
    odd.eraBaja = s.era; s.era = p.vera;
  } else if (s.era > p.vera) {
    const next = p.vera + 1, gap = Math.max(30, D.eraTime(next) * LIM.eraGap) * 1000;
    if ((s.era > next || t - (p.eraAt || 0) < gap) && (!last || s.era > last.era)) odd.eraSalto = s.era;
    s.era = t - (p.eraAt || 0) >= gap ? next : p.vera;
    if (s.era !== p.vera) p.eraAt = t;
  }
  p.vera = s.era;
  const era = s.era, stage = guildStageOf(p);
  if (s.pop > D.maxPop(era)) { odd.pop = s.pop; s.pop = D.maxPop(era); }

  const dt = prev && p.snapAt ? clamp((t - p.snapAt) / 1000, 0, D.OFFLINE_CAP) : 0;
  const n = prev ? workers(p) : Math.min(s.pop, D.maxPop(era)), extra = LIM.resSlack * scale(era);
  p.cred = p.cred || {};
  for (const r of TRACKED) {
    const cred = p.cred[r] || 0, grow = n * resRate(r, era, stage) * dt + extra;
    const limit = prev ? prev.res[r] + grow + cred : 5 * scale(era);
    const jump = last ? s.res[r] - last.res[r] : s.res[r] - limit;
    if (s.res[r] > limit) { if (jump > (grow + cred) * 1.5 + extra) odd[r] = Math.round(s.res[r]); s.res[r] = limit; }
    if (prev) p.cred[r] = Math.max(0, cred - Math.max(0, s.res[r] - prev.res[r] - grow));
  }
  // recolección total (ranking): solo sube al ritmo posible
  const best = Math.max(...TRACKED.map(r => resRate(r, era, stage)), resRate('gems', era, stage));
  const totalMax = prev ? prev.total + n * best * dt + extra : 5 * scale(era);
  if (s.total > totalMax) { if (!last || s.total - last.total > n * best * dt * 1.5 + extra) odd.total = Math.round(s.total); s.total = totalMax; }

  const armyMax = s.pop * unitPowerMax(era) + 50;
  if (s.army > armyMax) { odd.army = Math.round(s.army); s.army = armyMax; }
  if (s.walls > techMax(era)) { odd.walls = s.walls; s.walls = techMax(era); }
  if (Array.isArray(raw.buildings)) s.buildings = cleanBuildings(p, raw.buildings, era);
  const blds = s.buildings || p.buildings || [];
  const defMax = towerDefense(blds) * (1 + 0.2 * s.walls) * LIM.slack + s.army + 50;
  if (s.defense > defMax) { odd.defense = Math.round(s.defense); s.defense = defMax; }
  s.score = D.realmScore(era, buildingLevels(blds), s.pop); // el puntaje lo calcula el servidor
  p.snapAt = t;
  if (Object.keys(odd).length) suspect(p, 'foto', odd);
  return s;
}

// Fuerza y tropas de una campaña: no más soldados que población ni más fuerza que el ejército
// de la última foto. Las tropas enviadas dejan de contar en casa hasta la próxima foto.
function checkArmy(p, rawUnits, rawPower) {
  const era = vEra(p), s = p.snap, units = {}, asked = clamp(+rawPower || 0, 0, 1e12);
  let total = 0;
  for (const k of ARMY) { units[k] = Math.max(0, Math.floor(+((rawUnits || {})[k]) || 0)); total += units[k]; }
  const army = s ? s.army : 0, maxUnits = Math.min(s ? s.pop : 5, Math.ceil(army / 4) + 5), sent = total;
  if (total > maxUnits) {
    const f = maxUnits / total;
    total = 0;
    for (const k of ARMY) { units[k] = Math.floor(units[k] * f); total += units[k]; }
  }
  let raw = 0;
  for (const k of ARMY) raw += units[k] * D.ARMY[k].power;
  const power = Math.min(asked, raw * armyMultMax(era), army * 1.1 + 10);
  if (power < asked * 0.99 || total < sent) suspect(p, 'ejercito', { fuerza: Math.round(asked), aceptada: Math.round(power), tropas: sent, aceptadas: total });
  if (s) s.army = Math.max(0, s.army - power);
  return { units, total, power };
}

function sanitizeSnap(s) {
  const res = {};
  for (const r of ['food', 'wood', 'stone', 'gold']) res[r] = Math.max(0, +((s.res || {})[r]) || 0);
  return {
    era: clamp(Math.floor(+s.era || 1), 1, 999), pop: Math.max(0, Math.floor(+s.pop || 0)), defense: Math.max(0, +s.defense || 0), truce: !!s.truce, res, total: Math.max(0, +s.total || 0),
    army: clamp(+s.army || 0, 0, 1e9), walls: clamp(Math.floor(+s.walls || 0), 0, 30), score: clamp(+s.score || 0, 0, 1e9),
    walled: Array.isArray(s.walled) ? s.walled.slice(0, 400).map(k => Math.floor(+k) || 0) : [], wallMult: clamp(+s.wallMult || 1, 1, 3), terrMult: clamp(+s.terrMult || 1, 1, 4),
  };
}

// Sincronización: el cliente manda lo que recolectó en zonas comunes, sus operaciones de mercado y una
// foto de su reino; recibe el estado de los recursos compartidos, los otros reinos, precios y su buzón.
function sync(p, b) {
  const w = world(p), t = now();
  ensureTerr(w);
  p.lastSeen = t;
  if (b.name) p.name = cleanText(b.name, 20) || p.name;
  if (b.harvest && typeof b.harvest === 'object') {
    const ok = checkHarvest(p, b.harvest, w, t);
    for (const id in ok) {
      const st = w.nodes[id];
      if (!st) continue;
      st[0] = Math.max(0, st[0] - ok[id]);
      if (st[0] <= 0.5 && !st[1]) { st[0] = 0; st[1] = t; }
      w.nv[id] = ++w.ver;
    }
  }
  if (Array.isArray(b.market)) for (const op of checkMarket(p, b.market)) marketOp(op);
  if (b.snap && typeof b.snap === 'object') {
    const s = checkSnap(p, b.snap, t);
    if (s.buildings) { p.buildings = s.buildings; p.bver = String(b.snap.bver || ''); delete s.buildings; }
    p.snap = s;
    p.units = Array.isArray(b.snap.units) ? b.snap.units.slice(0, 250) : [];
  }
  if (b.ack) p.inbox = p.inbox.filter(i => i.id > b.ack);
  if (b.pase && typeof b.pase === 'object') paseStats(p, b.pase);
  w.chat = w.chat || [];
  const wsince = +b.wsince || 0;
  store.touch('players'); store.touch('worlds');

  const since = +b.since || 0, nodes = {};
  for (const id in w.nodes) if (!since || (w.nv[id] || 0) > since) nodes[id] = w.nodes[id];
  const kb = b.kb || {}, players = [];
  w.slots.forEach((pid, slot) => {
    if (!pid || pid === p.id) return;
    const o = player(pid);
    if (!o) return;
    const online = t - o.lastSeen < ONLINE_MS;
    players.push({
      slot, id: o.id, name: o.name, online, era: o.snap ? o.snap.era : 1, defense: o.snap ? Math.round(o.snap.defense) : 20,
      truce: o.snap ? o.snap.truce : true, bver: o.bver,
      score: o.snap ? o.snap.score : 0, army: o.snap ? Math.round(o.snap.army) : 0, newbie: !o.snap || o.snap.era < D.TERR.minEra, tshield: (w.tshield[slot] || 0) > t,
      buildings: kb[o.id] !== o.bver ? o.buildings : undefined, units: online ? o.units : [],
    });
  });
  ensureTerr(w);
  return { now: t, ver: w.ver, nodes, players, prices: market().p, inbox: p.inbox, pase: b.pase ? paseInfo(p) : undefined, incoming: incomingFor(p), guild: guildSummary(p), tv: w.tv, terr: +b.tv === w.tv ? undefined : w.terr,
    wchat: w.chat.filter(m => m.at > wsince).slice(-30) };
}
// Plaza del mundo: un chat corto entre los 16 reinos del mundo (también se ve como globo sobre cada reino).
function worldChat(p, b) {
  const w = world(p), t = now(), text = cleanText(b.text, 100);
  if (!text) throw new GameError('Mensaje vacío.');
  if (t - (p.chatAt || 0) < 2000) throw new GameError('Espera un momento antes de volver a escribir.');
  p.chatAt = t;
  w.chat = w.chat || [];
  w.chat.push({ who: p.name, pid: p.id, slot: p.slot, text, at: t });
  if (w.chat.length > 40) w.chat.shift();
  store.touch('worlds');
  return { ok: true };
}

// ---------- Zonas comunes: regeneración y presión de los reinos simulados ----------
function tickWorld(w) {
  const t = now(), dt = Math.min((t - (w.last || t)) / 1000, 12 * 3600);
  w.last = t;
  if (dt <= 0) return;
  for (const id in w.nodes) {
    const c = COMMON[id], st = w.nodes[id], def = D.NODES[c.kind];
    if (def.regen) {
      if (st[0] < c.max) {
        const before = Math.floor(st[0]);
        st[0] = Math.min(c.max, st[0] + (c.max * def.regen * dt) / 3600);
        if (st[1] && st[0] >= 1) st[1] = 0;
        if (Math.floor(st[0]) !== before) w.nv[id] = ++w.ver;
      }
    } else if (st[1] && t - st[1] >= def.regrow * 1000) {
      st[0] = c.max; st[1] = 0; w.nv[id] = ++w.ver;
    }
  }
  w.botCur = w.botCur || {};
  ensureTerr(w);
  w.slots.forEach((pid, slot) => {
    if (pid) return;
    // los reinos simulados también crecen, despacio, hacia la tierra libre
    if (t >= (w.botGrow[slot] || 0)) {
      w.botGrow[slot] = t + rand(1.5, 4) * 3600e3;
      if (countT(w, slot) < TSTART[slot] + D.TERR.maxBase) {
        const free = [];
        for (let k = 0; k < w.terr.length; k++) if (w.terr[k] === slot + 1) for (const n of W.parcelNeighbors(k)) if (!w.terr[n] && !W.terrCommon[n]) free.push(n);
        if (free.length) { w.terr[pick(free)] = slot + 1; w.tv++; }
      }
    }
    D.REALM_SLOTS[slot].bot.zones.forEach((zid, zi) => {
      let take = (BOT_RATE * (zi === 0 ? 0.6 : 0.4) * dt) / 3600;
      const ids = BY_ZONE[zid] || [];
      for (let guard = 0; take > 0.01 && guard < 50; guard++) {
        const key = slot + ':' + zid;
        let id = w.botCur[key];
        if (!id || w.nodes[id][1] || w.nodes[id][0] < 1) {
          const alive = ids.filter(i => !w.nodes[i][1] && w.nodes[i][0] >= 1);
          if (!alive.length) break;
          id = w.botCur[key] = pick(alive);
        }
        const st = w.nodes[id], got = Math.min(st[0], take);
        st[0] -= got; take -= got;
        if (st[0] <= 0.5) { st[0] = 0; st[1] = t; }
        w.nv[id] = ++w.ver;
      }
    });
  });
  store.touch('worlds');
}

// ---------- Mercado global ----------
function market() {
  return store.get('market', 'global') || store.set('market', 'global', { p: Object.assign({}, BASE), offers: [], seq: 1, drift: now(), nextBot: 0, botCheck: now() });
}
function marketOp(op) {
  if (!op || !BASE[op.res] || op.res === 'gold') return;
  const m = market(), n = clamp(+op.n || 0, 0, 1e7);
  m.p[op.res] = clamp(m.p[op.res] * Math.pow(op.side === 'buy' ? 1.03 : 0.97, n / 100), BASE[op.res] * 0.25, BASE[op.res] * 4);
  store.touch('market');
}
const value = (res, n) => (market().p[res] || BASE[res]) * n / 100;
function activeEra() {
  const recent = store.all('players').filter(p => now() - p.lastSeen < 86400e3 && p.snap);
  return recent.length ? pick(recent).snap.era : 1;
}
function tradePool(era) {
  const pool = ['food', 'wood', 'stone', 'gold'];
  if (era >= 2) pool.push('ore', 'planks');
  if (era >= 3) pool.push('blocks', 'ingots', 'books', 'marble');
  if (era >= 4) pool.push('tools', 'gems');
  if (era >= 5) pool.push('steel');
  if (era >= 6) pool.push('machinery');
  return pool;
}
function botOffer() {
  const m = market(), era = activeEra(), pool = tradePool(era);
  const give = pick(pool);
  let want = pick(pool);
  while (want === give) want = pick(pool);
  const scale = 200 * Math.pow(1.6, era - 1);
  const gn = Math.max(10, Math.round((scale * 100) / m.p[give] / 10) * 10);
  const wn = Math.max(10, Math.round((value(give, gn) * rand(0.8, 1.2) * 100) / m.p[want] / 10) * 10);
  return { id: m.seq++, pid: null, by: pick(MERCHANTS), give, gn, want, wn, expires: now() + (15 + Math.random() * 25) * 60e3 };
}
function tickMarket() {
  const m = market(), t = now();
  while (t - m.drift >= 30000) {
    m.drift += 30000;
    for (const r of RES) {
      if (r === 'gold') continue;
      m.p[r] = clamp(m.p[r] + (BASE[r] - m.p[r]) * 0.04 + m.p[r] * (Math.random() - 0.5) * 0.03, BASE[r] * 0.25, BASE[r] * 4);
    }
    if (t - m.drift > 3600e3) m.drift = t; // tras mucho tiempo apagado, no recalcular de más
  }
  for (const o of m.offers.filter(x => x.expires < t)) {
    m.offers.splice(m.offers.indexOf(o), 1);
    const p = o.pid && player(o.pid);
    if (p) push(p, { type: 'res', res: { [o.give]: o.gn }, text: 'Tu oferta expiró: se te devolvió ' + o.gn + ' de ' + D.RES[o.give].name.toLowerCase() + '.' });
  }
  if (t >= m.nextBot) {
    m.nextBot = t + (90 + Math.random() * 120) * 1000;
    if (m.offers.filter(o => !o.pid).length < 6) m.offers.push(botOffer());
  }
  // los mercaderes simulados también aceptan ofertas de jugadores si son justas
  if (t - m.botCheck >= 20000) {
    m.botCheck = t;
    for (const o of m.offers.filter(x => x.pid)) {
      const fair = value(o.want, o.wn) / Math.max(1, value(o.give, o.gn));
      // los mercaderes no aceptan ofertas abusivas: si no, crearían recursos de la nada
      if (fair <= 1.5 && Math.random() < clamp(0.3 - (fair - 1) * 1.1, 0.01, 0.5) * 0.6) fillOffer(o, pick(MERCHANTS));
    }
  }
  store.touch('market');
}
function fillOffer(o, byName) {
  const m = market();
  m.offers.splice(m.offers.indexOf(o), 1);
  const p = o.pid && player(o.pid);
  if (p) push(p, { type: 'offer_filled', res: { [o.want]: o.wn }, value: Math.round(value(o.give, o.gn)), text: byName + ' aceptó tu oferta: recibiste ' + o.wn + ' de ' + D.RES[o.want].name.toLowerCase() + '.' });
}
const pubOffer = o => ({ id: o.id, by: o.by, human: !!o.pid, give: o.give, gn: o.gn, want: o.want, wn: o.wn, ttl: Math.max(0, (o.expires - now()) / 1000) });
function listOffers(p) {
  const m = market();
  return { prices: m.p, offers: m.offers.filter(o => o.pid !== p.id).map(pubOffer), mine: m.offers.filter(o => o.pid === p.id).map(pubOffer) };
}
function postOffer(p, b) {
  const m = market();
  const give = b.give, want = b.want, gn = Math.floor(+b.gn), wn = Math.floor(+b.wn);
  if (!RES.includes(give) || !RES.includes(want) || give === want || !(gn > 0) || !(wn > 0)) throw new GameError('Oferta no válida.');
  if (m.offers.filter(o => o.pid === p.id).length >= 3) throw new GameError('Máximo 3 ofertas publicadas.');
  const day = today(p), cap = LIM.tradeValue * scale(vEra(p));
  if (day.offers >= LIM.offersDay) throw new GameError('Ya publicaste muchas ofertas hoy.');
  if (value(give, gn) > cap) { suspect(p, 'oferta', { give, gn, tope: Math.round(cap) }); throw new GameError('Esa oferta es demasiado grande para tu era.'); }
  if (gn > stockOf(p, give) + 1) { suspect(p, 'oferta', { give, gn, stock: Math.round(stockOf(p, give)) }); throw new GameError('No tienes suficiente para ofrecer.'); }
  if (value(want, wn) > 3 * value(give, gn)) throw new GameError('Pides demasiado a cambio.');
  day.offers++;
  spend(p, give, gn);
  const o = { id: m.seq++, pid: p.id, by: p.name, give, gn, want, wn, expires: now() + 24 * 3600e3 };
  m.offers.push(o);
  store.touch('market');
  return { ok: true, offer: pubOffer(o) };
}
function acceptOffer(p, b) {
  const m = market(), o = m.offers.find(x => x.id === +b.id);
  if (!o) throw new GameError('Esa oferta ya no está disponible.');
  if (o.pid === p.id) throw new GameError('No puedes aceptar tu propia oferta.');
  const day = today(p), got = value(o.give, o.gn), cap = LIM.recvValueDay * scale(vEra(p));
  if (day.accepts >= LIM.acceptsDay) throw new GameError('Ya aceptaste muchas ofertas hoy.');
  if (day.recv + got > cap) { suspect(p, 'aceptar', { valor: Math.round(got), hoy: Math.round(day.recv), tope: Math.round(cap) }); throw new GameError('Ya recibiste mucho por el mercado hoy.'); }
  if (o.wn > stockOf(p, o.want) + 1) throw new GameError('No tienes suficiente para pagar ese trato.');
  day.accepts++; day.recv += got;
  spend(p, o.want, o.wn);
  credit(p, { [o.give]: o.gn });
  fillOffer(o, p.name);
  store.touch('market');
  return { ok: true, give: o.give, gn: o.gn, want: o.want, wn: o.wn, by: o.by, value: Math.round(value(o.give, o.gn)) };
}
function cancelOffer(p, b) {
  const m = market(), o = m.offers.find(x => x.id === +b.id && x.pid === p.id);
  if (!o) throw new GameError('Esa oferta ya no está disponible.');
  m.offers.splice(m.offers.indexOf(o), 1);
  credit(p, { [o.give]: o.gn });
  store.touch('market');
  return { ok: true, give: o.give, gn: o.gn };
}

// ---------- Gremios ----------
function ensureNpcGuild() {
  if (!store.get('guilds', 'g_roble')) store.set('guilds', 'g_roble', { id: 'g_roble', name: D.GUILD_NAME, npc: true, members: [], stage: 0, prog: {}, contrib: {}, chat: [], last: now(), chatAt: 0 });
}
ensureNpcGuild();
const guildOf = p => store.all('guilds').find(g => g.members.includes(p.id)) || null;
function guildSummary(p) { const g = guildOf(p); return g ? { id: g.id, name: g.name, stage: g.stage } : null; }
function guildDetail(g, p) {
  const st = D.guildStage(g.stage), members = [];
  const medals = g.medals || {};
  for (const pid of g.members) { const o = player(pid); if (o) members.push({ name: o.name, c: g.contrib[pid] || 0, me: pid === p.id, online: now() - o.lastSeen < ONLINE_MS, medals: medals[pid] || 0 }); }
  if (g.npc) for (const n of NPC_MEMBERS) members.push({ name: n, c: g.contrib['npc:' + n] || 0, npc: true, medals: medals['npc:' + n] || 0 });
  members.sort((a, b) => b.c - a.c);
  ensureEvent(g);
  const ev = g.ev, t = now(), names = {};
  for (const pid of g.members) { const o = player(pid); if (o) names[pid] = o.name; }
  // todos los que aportaron al evento, de mayor a menor (no hay lista de "los que no ayudan")
  const top = Object.keys(ev.contrib).filter(k => ev.contrib[k] > 0)
    .map(k => ({ name: k.startsWith('npc:') ? k.slice(4) : names[k] || '—', c: ev.contrib[k], me: k === p.id, medals: medals[k] || 0 })).sort((a, b) => b.c - a.c);
  const helps = (g.helps || []).filter(h => t - h.at < D.GUILD_HELP.ttl * 1000 && h.by.length < D.GUILD_HELP.max)
    .map(h => ({ id: h.id, name: h.name, what: h.what, n: h.by.length, mine: h.pid === p.id, helped: h.by.includes(p.id) }));
  const needs = liveNeeds(g).map(h => ({ id: h.id, name: h.name, res: h.res, n: h.n, got: h.got, mine: h.pid === p.id, ttl: Math.max(0, (h.at + D.GUILD_NEED.ttl * 1000 - t) / 1000) }));
  return {
    id: g.id, name: g.name, npc: g.npc, stage: g.stage, stageName: st.name, cost: st.cost, zoneRes: st.zoneRes, prog: g.prog, members, chat: g.chat.slice(-40),
    ev: { name: ev.name, res: ev.res, goal: ev.goal, prog: ev.prog, ends: ev.ends, done: ev.done, my: ev.contrib[p.id] || 0, top }, helps, needs,
  };
}
function listGuilds(p) {
  const g = guildOf(p);
  return {
    list: store.all('guilds').map(o => ({ id: o.id, name: o.name, members: o.members.length + (o.npc ? NPC_MEMBERS.length : 0), stage: o.stage, npc: o.npc })),
    mine: g ? guildDetail(g, p) : null,
  };
}
function chatPush(g, who, text, pid) {
  g.chat.push({ who, text, pid: pid || null, at: now() });
  if (g.chat.length > 60) g.chat.shift();
}
function createGuild(p, b) {
  if (guildOf(p)) throw new GameError('Ya perteneces a un gremio.');
  const name = cleanText(b.name, 24);
  if (name.length < 3) throw new GameError('El nombre debe tener al menos 3 letras.');
  if (store.all('guilds').some(g => g.name.toLowerCase() === name.toLowerCase())) throw new GameError('Ya existe un gremio con ese nombre.');
  const id = rid('g');
  const g = store.set('guilds', id, { id, name, npc: false, members: [p.id], stage: 0, prog: {}, contrib: {}, chat: [], last: now(), chatAt: 0 });
  chatPush(g, 'Gremio', p.name + ' fundó el gremio.');
  return listGuilds(p);
}
function joinGuild(p, b) {
  if (guildOf(p)) throw new GameError('Ya perteneces a un gremio.');
  const g = store.get('guilds', b.id);
  if (!g) throw new GameError('Ese gremio no existe.');
  g.members.push(p.id);
  chatPush(g, 'Gremio', '¡' + p.name + ' se unió al gremio!');
  store.touch('guilds');
  return listGuilds(p);
}
function leaveGuild(p) {
  const g = guildOf(p);
  if (!g) return listGuilds(p);
  g.members.splice(g.members.indexOf(p.id), 1);
  chatPush(g, 'Gremio', p.name + ' dejó el gremio.');
  if (!g.npc && !g.members.length) store.del('guilds', g.id);
  store.touch('guilds');
  return listGuilds(p);
}
// Aportes (etapas y eventos): tope diario por recurso según la era y, para los recursos que el servidor
// ve, no más de lo que hay en el almacén. Lo que no se acepta vuelve al jugador (el cliente lo reintegra).
const contribLeft = (p, res) => Math.max(0, Math.min(LIM.contribDay * scale(vEra(p)) - (today(p).contrib[res] || 0), stockOf(p, res)));
function takeContrib(p, res, accepted, asked) {
  const day = today(p);
  day.contrib[res] = (day.contrib[res] || 0) + accepted;
  spend(p, res, accepted);
  if (asked > accepted * 1.5 + 100 && !(contribLeft(p, res) > 0)) suspect(p, 'aporte', { res, pedido: Math.floor(asked) || 0, aceptado: accepted, hoy: day.contrib[res] });
  store.touch('players');
}
function contribute(p, b) {
  const g = guildOf(p);
  if (!g) throw new GameError('No perteneces a ningún gremio.');
  const st = D.guildStage(g.stage);
  if (!st.cost[b.res]) throw new GameError('Ese recurso no hace falta en esta etapa.');
  const left = st.cost[b.res] - (g.prog[b.res] || 0);
  const accepted = clamp(Math.floor(+b.n || 0), 0, Math.max(0, Math.min(left, contribLeft(p, b.res))));
  takeContrib(p, b.res, accepted, +b.n);
  g.prog[b.res] = (g.prog[b.res] || 0) + accepted;
  g.contrib[p.id] = (g.contrib[p.id] || 0) + accepted;
  checkStage(g);
  store.touch('guilds');
  return { accepted, guilds: listGuilds(p) };
}
function guildChat(p, b) {
  const g = guildOf(p);
  if (!g) throw new GameError('No perteneces a ningún gremio.');
  const text = cleanText(b.text, 140);
  if (text) chatPush(g, p.name, text, p.id);
  store.touch('guilds');
  return listGuilds(p);
}
// Evento del gremio: se crea si no hay, se resuelve al llegar a la meta o al vencer el plazo.
function ensureEvent(g) {
  if (!g.ev) { g.evn = (g.evn || 0) + 1; g.ev = D.newGuildEvent(g.stage, g.members.length + (g.npc ? NPC_MEMBERS.length : 0), g.evn + g.id.length); }
}
function resolveEvent(g) {
  const ev = g.ev, ratio = ev.prog / ev.goal, total = Math.max(1, ev.prog), topKey = D.eventTopKey(ev.contrib);
  ev.done = true;
  chatPush(g, 'Gremio', ratio >= 1 ? '¡Meta cumplida en "' + ev.name + '"! Premios para todos los que aportaron.' : '"' + ev.name + '" terminó al ' + Math.round(ratio * 100) + '%.');
  // quien más aportó: medalla, mención en el chat y premio extra (si se llegó al menos a la mitad)
  if (topKey) {
    const o = topKey.startsWith('npc:') ? null : player(topKey), name = o ? o.name : topKey.slice(4);
    if (ratio >= 0.5) { g.medals = g.medals || {}; g.medals[topKey] = (g.medals[topKey] || 0) + 1; }
    chatPush(g, 'Gremio', (ratio >= 0.5 ? '★ Medalla de "' + ev.name + '" para ' : 'Quien más aportó a "' + ev.name + '" fue ') + name + ' (' + ev.contrib[topKey] + ' de ' + D.RES[ev.res].name.toLowerCase() + '). ¡Gracias!');
  }
  for (const pid of Object.keys(ev.contrib)) {
    if (pid.startsWith('npc:')) continue;
    const o = player(pid), rw = D.guildEventReward(ev.contrib[pid] / total, ratio, g.stage, pid === topKey);
    if (o && rw) push(o, { type: 'guild_event', reward: rw, text: (ratio >= 1 ? '¡El gremio cumplió "' : 'El gremio llegó a la mitad de "') + ev.name + '"! Tu premio: ' + rw.coins + ' monedas' + (rw.gems ? ' y ' + rw.gems + ' gemas' : '') + (rw.top ? ', con el extra y la medalla por ser quien más aportó.' : '.') });
  }
}
function eventContribute(p, b) {
  const g = guildOf(p);
  if (!g) throw new GameError('No perteneces a ningún gremio.');
  ensureEvent(g);
  const ev = g.ev;
  if (ev.done) throw new GameError('El evento ya terminó; pronto empieza otro.');
  const accepted = clamp(Math.floor(+b.n || 0), 0, Math.max(0, Math.min(ev.goal - ev.prog, contribLeft(p, ev.res))));
  takeContrib(p, ev.res, accepted, +b.n);
  ev.prog += accepted;
  ev.contrib[p.id] = (ev.contrib[p.id] || 0) + accepted;
  if (ev.prog >= ev.goal) resolveEvent(g);
  store.touch('guilds');
  return { accepted, res: ev.res, guilds: listGuilds(p) };
}
// Ayudas entre compañeros: cada ayuda descuenta tiempo de una mejora del que la pidió.
function askHelp(p, b) {
  const g = guildOf(p);
  if (!g) throw new GameError('No perteneces a ningún gremio.');
  g.helps = (g.helps || []).filter(h => now() - h.at < D.GUILD_HELP.ttl * 1000 && h.by.length < D.GUILD_HELP.max);
  if (g.helps.some(h => h.pid === p.id)) throw new GameError('Ya pediste ayuda; espera a que te ayuden.');
  const day = today(p);
  if (day.asks >= LIM.asksDay) throw new GameError('Ya pediste mucha ayuda hoy.');
  day.asks++;
  // al primer pedido de cada jugador siempre lo ayuda un miembro simulado a los pocos minutos (ver tickGuilds)
  const sure = p.firstHelp ? 0 : now() + rand(D.GUILD_HELP.firstHelp[0], D.GUILD_HELP.firstHelp[1]) * 1000;
  p.firstHelp = true;
  store.touch('players');
  g.helps.push({ id: rid('h'), pid: p.id, name: p.name, bid: Math.floor(+b.bid || 0), what: cleanText(b.what, 40), by: [], at: now(), sure });
  chatPush(g, 'Gremio', p.name + ' pide ayuda con ' + cleanText(b.what, 40) + '.');
  store.touch('guilds');
  return listGuilds(p);
}
function giveHelp(p, b) {
  const g = guildOf(p);
  if (!g) throw new GameError('No perteneces a ningún gremio.');
  const h = (g.helps || []).find(o => o.id === b.id);
  if (!h || h.by.length >= D.GUILD_HELP.max) throw new GameError('Ese pedido ya no necesita ayuda.');
  if (h.pid === p.id || h.by.includes(p.id)) throw new GameError('Ya ayudaste en ese pedido.');
  // topes por cuenta: ayudas dadas al día, a un mismo compañero y recibidas (frena granjas de multicuentas)
  const o = h.pid.startsWith('npc:') ? null : player(h.pid), mine = today(p);
  if (mine.helps >= LIM.helpsDay) throw new GameError('Ya ayudaste mucho por hoy.');
  if ((mine.helpTo[h.pid] || 0) >= LIM.helpsPair) { suspect(p, 'ayuda', { a: h.pid, hoy: mine.helpTo[h.pid] }); throw new GameError('Ya ayudaste mucho a ese compañero hoy.'); }
  if (o && today(o).helped >= LIM.helpedDay) throw new GameError('Tu compañero ya recibió muchas ayudas hoy.');
  mine.helps++; mine.helpTo[h.pid] = (mine.helpTo[h.pid] || 0) + 1;
  if (o) today(o).helped++;
  h.by.push(p.id);
  if (o) push(o, { type: 'guild_help', bid: h.bid, from: p.name, text: p.name + ' te ayudó con ' + h.what + '.' });
  const day = new Date().toISOString().slice(0, 10);
  if (!p.helpDay || p.helpDay.d !== day) p.helpDay = { d: day, n: 0 };
  // el cliente suma además oro y comida de su era (D.helpReward) cuando hay monedas
  const coins = p.helpDay.n < D.GUILD_HELP.daily ? D.GUILD_HELP.coins || 1 : 0;
  p.helpDay.n++;
  store.touch('guilds'); store.touch('players');
  return { coins, guilds: listGuilds(p) };
}
// Tablón "Necesito…": cada miembro pide un recurso (uno a la vez) y los demás se lo mandan desde su bodega.
// El que manda al menos un cuarto (o completa el pedido) gana unas monedas, con tope diario. Lo mandado y lo
// recibido tienen además un tope diario de valor (frena el traspaso entre cuentas).
const liveNeeds = g => (g.needs = (g.needs || []).filter(h => now() - h.at < D.GUILD_NEED.ttl * 1000 && h.got < h.n));
const giftLeft = (p, key) => { const day = today(p); return Math.max(0, LIM.giftDay * scale(vEra(p)) - (day[key] || 0)); };
function askNeed(p, b) {
  const g = guildOf(p);
  if (!g) throw new GameError('No perteneces a ningún gremio.');
  const mine = liveNeeds(g).find(h => h.pid === p.id);
  if (b.cancel) { if (mine) g.needs.splice(g.needs.indexOf(mine), 1); store.touch('guilds'); return listGuilds(p); }
  if (mine) throw new GameError('Ya tienes un pedido en el tablón. Retíralo para pedir otra cosa.');
  if (!D.NEED_RES.includes(b.res)) throw new GameError('Ese recurso no se puede pedir.');
  const n = D.needAmount(b.res, vEra(p)); // la cantidad la decide el servidor, según la era que conoce
  g.needs.push({ id: rid('n'), pid: p.id, name: p.name, res: b.res, n, got: 0, at: now() });
  chatPush(g, 'Gremio', p.name + ' necesita ' + n + ' de ' + D.RES[b.res].name.toLowerCase() + '.');
  store.touch('guilds');
  return listGuilds(p);
}
function needGift(g, h, n, fromName) {
  h.got += n;
  const o = h.pid.startsWith('npc:') ? null : player(h.pid);
  if (o) push(o, { type: 'guild_gift', res: { [h.res]: n }, from: fromName, text: fromName + ' te mandó ' + n + ' de ' + D.RES[h.res].name.toLowerCase() + ' del tablón del gremio' + (h.got >= h.n ? ': ¡tu pedido está completo!' : '.') });
  if (h.got >= h.n) { chatPush(g, 'Gremio', '¡' + h.name + ' ya tiene su ' + D.RES[h.res].name.toLowerCase() + '! Gracias, ' + fromName + '.'); g.needs.splice(g.needs.indexOf(h), 1); }
}
function sendNeed(p, b) {
  const g = guildOf(p);
  if (!g) throw new GameError('No perteneces a ningún gremio.');
  const h = liveNeeds(g).find(o => o.id === b.id);
  if (!h) throw new GameError('Ese pedido ya no está en el tablón.');
  if (h.pid === p.id) throw new GameError('No puedes mandarte a ti mismo.');
  const o = h.pid.startsWith('npc:') ? null : player(h.pid), price = market().p[h.res] || BASE[h.res];
  const capUnits = v => Math.floor((v * 100) / price);
  const asked = Math.floor(+b.n || 0);
  const n = clamp(asked, 0, Math.min(h.n - h.got, stockOf(p, h.res), capUnits(giftLeft(p, 'giftOut')), o ? capUnits(giftLeft(o, 'giftIn')) : Infinity));
  if (asked > stockOf(p, h.res) + 1) suspect(p, 'tablon', { res: h.res, pedido: asked, stock: Math.round(stockOf(p, h.res)) });
  if (n <= 0) {
    if (asked > 0 && giftLeft(p, 'giftOut') <= 0) throw new GameError('Ya mandaste mucho por el tablón hoy.');
    if (asked > 0 && o && giftLeft(o, 'giftIn') <= 0) throw new GameError('Tu compañero ya recibió mucho por el tablón hoy.');
    throw new GameError('No tienes de eso en tu bodega.');
  }
  const eligible = D.needRewardable(n, h), day = today(p);
  spend(p, h.res, n);
  day.giftOut = (day.giftOut || 0) + value(h.res, n);
  if (o) { const od = today(o); od.giftIn = (od.giftIn || 0) + value(h.res, n); }
  needGift(g, h, n, p.name);
  const coins = eligible && (day.needCoins || 0) < D.GUILD_NEED.daily ? D.GUILD_NEED.coins : 0;
  if (coins) day.needCoins = (day.needCoins || 0) + 1;
  store.touch('guilds'); store.touch('players');
  return { accepted: n, coins, eligible, guilds: listGuilds(p) };
}
function checkStage(g) {
  const st = D.guildStage(g.stage);
  for (const r in st.cost) if ((g.prog[r] || 0) < st.cost[r]) return;
  g.stage++;
  g.prog = {};
  const coins = 25 * g.stage;
  chatPush(g, 'Gremio', '¡' + st.name + ' terminada! Gracias a todos.');
  for (const pid of g.members) { const o = player(pid); if (o) push(o, { type: 'guild_stage', name: st.name, coins, text: '¡El gremio completó "' + st.name + '"! +3% de recolección y +' + coins + ' monedas.' }); }
}
function tickGuilds() {
  const t = now();
  for (const g of store.all('guilds')) {
    if (g.members.length) {
      ensureEvent(g);
      if (t >= g.ev.ends) { if (!g.ev.done) resolveEvent(g); g.ev = null; ensureEvent(g); chatPush(g, 'Gremio', 'Nuevo evento: "' + g.ev.name + '". Meta: ' + g.ev.goal + ' de ' + D.RES[g.ev.res].name.toLowerCase() + ' en 48 horas.'); }
    }
    // el primer pedido de ayuda de cada jugador siempre recibe una a los pocos minutos (en cualquier gremio)
    g.helps = (g.helps || []).filter(h => t - h.at < D.GUILD_HELP.ttl * 1000 && h.by.length < D.GUILD_HELP.max);
    for (const h of g.helps) {
      if (!h.sure || t < h.sure || h.by.length || h.pid.startsWith('npc:')) continue;
      const n = g.npc ? pick(NPC_MEMBERS) : D.GUILD_APPRENTICE, o = player(h.pid);
      h.by.push('npc:' + n); h.sure = 0;
      if (o) push(o, { type: 'guild_help', bid: h.bid, from: n, text: n + ' te ayudó con ' + h.what + '.' });
    }
    liveNeeds(g);
    if (!g.npc || !g.members.length) { g.last = t; continue; }
    // los miembros simulados mandan lo que piden los jugadores en el tablón y a veces piden algo
    for (const h of g.needs.slice()) {
      if (h.pid.startsWith('npc:') ? Math.random() > 0.004 : Math.random() > 0.03) continue;
      const n = Math.min(h.n - h.got, Math.max(10, Math.ceil((h.n * rand(0.25, 0.5)) / 10) * 10));
      needGift(g, h, n, pick(NPC_MEMBERS.filter(m => 'npc:' + m !== h.pid)));
    }
    if (g.needs.filter(h => h.pid.startsWith('npc:')).length < 2 && Math.random() < 0.005) {
      const n = pick(NPC_MEMBERS), era = activeEra(), res = pick(tradePool(era).filter(r => D.NEED_RES.includes(r)));
      if (!g.needs.some(h => h.pid === 'npc:' + n)) g.needs.push({ id: rid('n'), pid: 'npc:' + n, name: n, res, n: D.needAmount(res, era), got: 0, at: t });
    }
    // los miembros simulados también aportan al evento y ayudan a los jugadores
    if (!g.ev.done && Math.random() < 0.25) {
      const add = Math.ceil(((g.ev.goal * 0.6) / (D.GUILD_EVENT_HOURS * 720)) * rand(0.5, 1.5) * 4), who = 'npc:' + pick(NPC_MEMBERS);
      g.ev.prog = Math.min(g.ev.goal, g.ev.prog + add); g.ev.contrib[who] = (g.ev.contrib[who] || 0) + add;
      if (g.ev.prog >= g.ev.goal) resolveEvent(g);
    }
    g.helps = (g.helps || []).filter(h => t - h.at < D.GUILD_HELP.ttl * 1000 && h.by.length < D.GUILD_HELP.max);
    for (const h of g.helps) {
      if (h.pid.startsWith('npc:') || Math.random() > 0.04) continue;
      const free = NPC_MEMBERS.filter(n => !h.by.includes('npc:' + n));
      if (!free.length) continue;
      const n = pick(free), o = player(h.pid);
      h.by.push('npc:' + n);
      if (o) push(o, { type: 'guild_help', bid: h.bid, from: n, text: n + ' te ayudó con ' + h.what + '.' });
    }
    if (g.helps.filter(h => h.pid.startsWith('npc:')).length < 2 && Math.random() < 0.01) {
      const n = pick(NPC_MEMBERS);
      g.helps.push({ id: rid('h'), pid: 'npc:' + n, name: n, bid: 0, what: pick(D.GUILD_HELP_WANTS), by: [], at: t });
    }
    // los miembros simulados del gremio del Roble aportan poco a poco
    const mins = Math.min((t - g.last) / 60000, 12 * 60);
    if (mins >= 1) {
      g.last = t;
      const st = D.guildStage(g.stage), hours = 20 * Math.pow(1.15, g.stage);
      for (const r in st.cost) {
        const left = st.cost[r] - (g.prog[r] || 0);
        if (left <= 0) continue;
        const add = Math.min(left, Math.ceil((st.cost[r] / (hours * 60)) * mins * rand(0.5, 1.5)));
        g.prog[r] = (g.prog[r] || 0) + add;
        const who = pick(NPC_MEMBERS);
        g.contrib['npc:' + who] = (g.contrib['npc:' + who] || 0) + add;
      }
      checkStage(g);
    }
    const someoneOnline = g.members.some(pid => { const o = player(pid); return o && t - o.lastSeen < ONLINE_MS; });
    if (someoneOnline && t >= (g.chatAt || 0)) {
      g.chatAt = t + (90 + Math.random() * 180) * 1000;
      chatPush(g, pick(NPC_MEMBERS), pick(D.GUILD_CHAT));
    }
  }
  store.touch('guilds');
}

// ---------- Ataques en camino ----------
// Ya no hay saqueos: lo único que marcha contra un jugador son las campañas de conquista de parcelas.
// Las incursiones que quedaron guardadas de antes se descartan (el cliente devuelve esas tropas a casa).
for (const r of store.all('raids')) store.del('raids', r.id);
function incomingFor(p) {
  return store.all('camps').filter(c => c.to === p.id).map(c => ({ id: c.id, from: c.fromName, arrive: c.arrive, power: Math.round(c.power), k: c.k }));
}

// ---------- Territorio: parcelas y conquista ----------
function ensureTerr(w) {
  if (!Array.isArray(w.terr) || w.terr.length !== TERR0.length) { w.terr = TERR0.slice(); w.tv = (w.tv || 0) + 1; }
  w.tshield = w.tshield || {}; w.botGrow = w.botGrow || {};
  while (w.slots.length < SLOTS) w.slots.push(null);
}
const countT = (w, slot) => w.terr.reduce((s, v) => s + (v === slot + 1 ? 1 : 0), 0);
const touches = (w, k, slot) => W.parcelNeighbors(k).some(n => w.terr[n] === slot + 1);
const parcelK = k => { k = Math.floor(+k); if (!(k >= 0 && k < TERR0.length)) throw new GameError('Parcela no válida.'); return k; };
const parcelCenter = k => [((k % W.PW) + 0.5) * D.PARCEL, (Math.floor(k / W.PW) + 0.5) * D.PARCEL];

function claim(p, b) {
  const w = world(p), k = parcelK(b.k);
  ensureTerr(w);
  if (W.terrCommon[k]) throw new GameError('Las zonas comunes no tienen dueño.');
  if (w.terr[k]) throw new GameError('Otro reino reclamó esa parcela antes que tú.');
  if (!touches(w, k, p.slot)) throw new GameError('Solo puedes reclamar parcelas que toquen tu territorio.');
  const era = p.snap ? p.snap.era : 1;
  if (countT(w, p.slot) >= D.maxParcels(TSTART[p.slot], era)) throw new GameError('Llegaste al máximo de parcelas de tu era.');
  w.terr[k] = p.slot + 1; w.tv++;
  store.touch('worlds');
  return { ok: true, tv: w.tv };
}
// Contra un reino simulado la batalla se resuelve en el navegador; aquí solo se valida y se registra.
function conquerBot(p, b) {
  const w = world(p), k = parcelK(b.k);
  ensureTerr(w);
  const slot = w.terr[k] - 1;
  if (slot < 0 || slot === p.slot) throw new GameError('Esa parcela no es de otro reino.');
  if (w.slots[slot]) throw new GameError('Esa parcela es de un jugador.');
  if (W.isCore(k, slot)) throw new GameError('Es el corazón de ese reino.');
  if (!touches(w, k, p.slot)) throw new GameError('Esa parcela no toca tu territorio.');
  if (!p.snap || p.snap.era < D.TERR.minEra) throw new GameError('Conquistar requiere la Era III.');
  w.terr[k] = p.slot + 1; w.tv++;
  store.touch('worlds');
  return { ok: true, tv: w.tv };
}
function terrInfo(o, w, slot) {
  return { era: o.snap ? o.snap.era : 1, score: o.snap ? o.snap.score : 0, newbie: !o.snap || o.snap.era < D.TERR.minEra, shield: (w.tshield[slot] || 0) > now() };
}
// Revancha: si un jugador te quitó una parcela, durante 48 h puedes atacarla aunque él esté en tregua (y sin
// el filtro de poder), solo contra él. La parcela recuperada así no da revancha de vuelta.
function revengeOf(p, k, tpid) {
  const rv = p.rev && p.rev[k];
  return !!rv && rv.by === tpid && now() - rv.at < D.TERR.retake * 1000;
}
function conquer(p, b) {
  const w = world(p), k = parcelK(b.k), t = now();
  ensureTerr(w);
  const slot = w.terr[k] - 1, tpid = slot >= 0 && w.slots[slot];
  if (!tpid || tpid === p.id) throw new GameError('Esa parcela no pertenece a otro jugador.');
  const tgt = player(tpid);
  if (W.isCore(k, slot)) throw new GameError('Es el corazón de ese reino: nunca se puede conquistar.');
  if (!touches(w, k, p.slot)) throw new GameError('Solo puedes atacar parcelas que toquen tu territorio.');
  const revenge = revengeOf(p, k, tpid);
  const why = D.canConquer({ era: p.snap ? p.snap.era : 1, score: p.snap ? p.snap.score : 0 }, terrInfo(tgt, w, slot), revenge);
  if (why) throw new GameError(why);
  if (store.all('camps').some(c => c.k === k && c.world === w.id)) throw new GameError('Ya hay una campaña contra esa parcela.');
  const { units, total, power } = checkArmy(p, b.units, b.power);
  if (!total) throw new GameError('Elige tropas para la campaña.');
  const [cx, cy] = parcelCenter(k), [hx, hy] = D.REALM_SLOTS[p.slot].home;
  const travel = 90 + Math.hypot(cx - hx, cy - hy) * 1.5;
  const c = { id: rid('c'), world: w.id, k, from: p.id, fromName: p.name, fromSlot: p.slot, to: tgt.id, toName: tgt.name, toSlot: slot, units, power, arrive: t + travel * 1000, revenge };
  store.set('camps', c.id, c);
  // aviso al defensor: le llega aunque no esté conectado (lo ve al volver, en el resumen)
  push(tgt, { type: 'under_attack', cid: c.id, k, from: p.name, power: Math.round(power), arrive: c.arrive, revenge,
    text: (revenge ? p.name + ' viene a recuperar la parcela que le quitaste' : p.name + ' lanzó una campaña contra una parcela de tu frontera') + '.' });
  return { ok: true, id: c.id, arrive: c.arrive, travel, revenge };
}
// Defensa real de la parcela: torres y Centro Urbano del defensor (de su última foto), su ejército y murallas,
// separada por origen para el resumen de la batalla.
function parcelDefense(w, k, tgt, slot) {
  const towers = [];
  for (const b of tgt.buildings || []) {
    const [type, x, y, done, lvl] = b, def = D.BUILD[type];
    if (!def || !done || (type !== 'tower' && type !== 'tc')) continue;
    towers.push([x + def.w / 2, y + def.h / 2, D.BSTATS[type](lvl || 1).defense || 0]);
  }
  const s = tgt.snap || {};
  return D.parcelDefenseParts({ era: s.era || 1, px: k % W.PW, py: Math.floor(k / W.PW), towers, army: s.army || 0, walls: s.walls || 0, around: W.parcelNeighbors(k).filter(n => w.terr[n] === slot + 1).length,
    mult: ((s.walled || []).includes(k) ? s.wallMult || 1 : 1) * (s.terrMult || 1) });
}
function tickCamps() {
  const t = now();
  for (const c of store.all('camps')) {
    if (t < c.arrive) continue;
    const w = store.get('worlds', c.world), tgt = player(c.to), att = player(c.from);
    store.del('camps', c.id);
    if (!w || !att) continue;
    ensureTerr(w);
    const still = w.terr[c.k] === c.toSlot + 1;
    const raw = tgt && still ? parcelDefense(w, c.k, tgt, c.toSlot) : null;
    const def = (raw ? raw.total : 1) * rand(0.85, 1.15), atk = c.power * rand(0.85, 1.15);
    const won = still && atk > def;
    // resumen: fuerza contra defensa y de dónde salió la defensa (con la misma tirada que decidió la batalla)
    const bt = raw ? { atk: Math.round(atk), def: Math.round(def), parts: D.scaleParts(raw, def) } : {};
    if (won) {
      w.terr[c.k] = c.fromSlot + 1; w.tv++;
      w.tshield[c.toSlot] = t + D.TERR.shieldLoss * 1000;
      if (att.rev) delete att.rev[c.k];
      if (tgt && !c.revenge) { // revancha para el que perdió la parcela (si no la perdió en una revancha)
        tgt.rev = tgt.rev || {};
        for (const key in tgt.rev) if (t - tgt.rev[key].at >= D.TERR.retake * 1000) delete tgt.rev[key];
        tgt.rev[c.k] = { by: att.id, at: t };
      }
      if (tgt) push(tgt, Object.assign({ type: 'parcel_lost', k: c.k, from: c.fromName, fromId: att.id, fromSlot: c.fromSlot, revenge: !!c.revenge,
        text: c.fromName + ' conquistó una parcela de tu frontera. Lo que tenías ahí se desarmó y recuperaste lo invertido.' }, bt));
    } else if (still) {
      w.tshield[c.toSlot] = t + D.TERR.shieldWin * 1000;
      if (tgt) { const day = today(tgt); c.gold = day.defended < LIM.defendedDay ? 60 * ((tgt.snap && tgt.snap.era) || 1) : 0; day.defended++; }
      if (tgt) push(tgt, Object.assign({ type: 'parcel_defended', k: c.k, from: c.fromName, gold: c.gold, text: '¡Tu frontera resistió la campaña de ' + c.fromName + '!' }, bt));
    }
    push(att, Object.assign({ type: 'conquest_result', rid: c.id, k: c.k, won, ratio: atk / Math.max(1, def), target: c.toName,
      text: (won ? 'Tus tropas tomaron la parcela de ' + c.toName + '.' : still ? c.toName + ' resistió tu campaña.' : 'La parcela ya no era de ' + c.toName + ' cuando llegaron tus tropas.') }, bt));
    store.touch('worlds'); store.touch('players');
  }
}

// ---------- Ranking, partidas y estado ----------
function ranking(p) {
  const t = now();
  return store.all('players').map(o => ({
    name: o.name, era: o.snap ? o.snap.era : 1, pop: o.snap ? o.snap.pop : 0, total: o.snap ? Math.floor(o.snap.total) : 0,
    world: (store.get('worlds', o.world) || {}).name, online: t - o.lastSeen < ONLINE_MS, me: o.id === p.id,
  })).sort((a, b) => b.era - a.era || b.total - a.total).slice(0, 50);
}
function getSave(p) { return { save: store.getSave(p.id) }; }
function putSave(p, b) {
  const text = JSON.stringify(b.save || null);
  if (text.length > (+process.env.PK_SAVE_MAX || 4e6)) throw new GameError('Partida demasiado grande.', 413);
  store.setSave(p.id, text);
  return { ok: true };
}
function deleteSave(p) {
  store.delSave(p.id);
  p.buildings = []; p.bver = 'reset'; p.units = []; p.snap = null;
  p.vera = null; p.snapAt = 0; p.cred = {}; // partida nueva: la era vuelve a empezar
  store.touch('players');
  return { ok: true };
}
function status() {
  const t = now(), ps = store.all('players');
  return { ok: true, players: ps.length, online: ps.filter(p => t - p.lastSeen < ONLINE_MS).length, worlds: store.all('worlds').length };
}

function tick() {
  for (const w of store.all('worlds')) tickWorld(w);
  tickMarket();
  tickGuilds();
  tickCamps();
}
// ---------- Pase del Reino (Fase 8) ----------
// Los puntos los decide el servidor: el cliente informa sus estadísticas acumuladas (D.PASE_STATS) y aquí se suman
// las diferencias, con tope por fuente (D.PASE_ACT), por día (LIM.pasePPDia) y por sync (LIM.paseSalto, salvo las
// que cuentan recursos). La pista dorada solo la marca paseActivar, después de que functions/index.js leyera
// `pkPase/<uid>/<período>` en la RTDB (la compra la escribe la página de Juegos). Los premios van por el buzón.
const diaUTC = () => new Date().toISOString().slice(0, 10);
const cleanStats = o => { const out = {}; for (const k of D.PASE_STATS) { const v = Math.floor(+((o || {})[k]) || 0); out[k] = v > 0 ? Math.min(v, 1e9) : 0; } return out; };
function paseDe(p) {
  const n = D.paseDe(now());
  if (!p.pase || p.pase.n !== n) {
    if (p.pase) cierraPase(p);
    p.pase = { n, pp: 0, dorado: false, cg: {}, cd: {}, dia: '', ppHoy: 0, act: {}, rd: {}, rp: {}, vis: p.pase ? p.pase.vis : null, base: p.pase ? p.pase.vis : null, baseDia: null };
    store.touch('players');
  }
  return p.pase;
}
function paseSuma(q, n) { const m = Math.max(0, Math.min(n, LIM.pasePPDia - q.ppHoy)); q.pp += m; q.ppHoy += m; return m; }
function paseStats(p, raw) {
  const q = paseDe(p), cur = cleanStats(raw), dia = diaUTC();
  if (!q.vis) { q.vis = cur; q.base = q.base || cur; }
  if (q.dia !== dia) { q.dia = dia; q.ppHoy = 0; q.act = {}; q.rd = {}; q.baseDia = q.vis; }
  // una partida nueva (estadísticas que bajan): se cuenta desde ahora, sin premiar el salto
  if (D.PASE_STATS.some(k => cur[k] < (q.vis[k] || 0))) { q.vis = cur; q.base = cur; q.baseDia = cur; return; }
  let raro = 0;
  for (const k of D.PASE_STATS) {
    const d = cur[k] - (q.vis[k] || 0);
    if (k !== 'g_total' && d > LIM.paseSalto) { raro++; cur[k] = (q.vis[k] || 0) + LIM.paseSalto; }
  }
  if (raro) suspect(p, 'pase', { saltos: raro });
  for (const k in D.PASE_ACT) {
    const [pp, tope] = D.PASE_ACT[k], d = cur[k] - (q.vis[k] || 0);
    if (d <= 0) continue;
    const gan = Math.min(d * pp, tope - (q.act[k] || 0));
    if (gan > 0) q.act[k] = (q.act[k] || 0) + paseSuma(q, gan);
  }
  const bd = q.baseDia || q.vis;
  for (const r of D.paseDiarios(q.n, dia)) if (!q.rd[r.id] && cur[r.k] - (bd[r.k] || 0) >= r.n) { q.rd[r.id] = 1; paseSuma(q, r.pp); }
  for (const r of D.paseRetos(q.n)) if (!q.rp[r.id] && cur[r.k] - (q.base[r.k] || 0) >= r.n) { q.rp[r.id] = 1; paseSuma(q, r.pp); }
  q.vis = cur;
  store.touch('players');
}
function paseEntrega(p, q, nivel, pista) {
  const pr = D.pasePremio(nivel, pista, vEra(p), D.paseTemaId(q.n));
  (pista === 'd' ? q.cd : q.cg)[nivel] = 1;
  push(p, { type: 'pase', text: 'Pase del Reino, nivel ' + (nivel > D.PASE.niveles ? '30+' : nivel) + (pista === 'd' ? ' (dorado)' : '') + ': ' + pr.txt + '.', res: pr.res, pase: pr, nivel, pista });
}
function alcanzado(q, nivel) { return nivel <= D.PASE.niveles ? D.paseNivel(q.pp) >= nivel : D.paseExtras(q.pp) >= nivel - D.PASE.niveles; }
// Al cambiar de período, lo ganado y no reclamado se entrega solo
function cierraPase(p) {
  const q = p.pase;
  for (let n = 1; n <= D.PASE.niveles + D.PASE.extraMax; n++) {
    if (n <= D.PASE.niveles && alcanzado(q, n) && !q.cg[n]) paseEntrega(p, q, n, 'g');
    if (q.dorado && alcanzado(q, n) && !q.cd[n]) paseEntrega(p, q, n, 'd');
  }
}
function paseInfo(p) {
  const q = paseDe(p), tid = D.paseTemaId(q.n), v = q.vis || {}, bd = q.baseDia || v, base = q.base || v;
  return { n: q.n, tema: tid, pp: q.pp, nivel: D.paseNivel(q.pp), extras: D.paseExtras(q.pp), dorado: q.dorado, cg: q.cg, cd: q.cd, ppHoy: q.ppHoy, tope: LIM.pasePPDia, fin: D.paseInicio(q.n + 1),
    diarios: D.paseDiarios(q.n, q.dia || diaUTC()).map(r => ({ id: r.id, txt: r.txt, pp: r.pp, n: r.n, v: Math.max(0, (v[r.k] || 0) - (bd[r.k] || 0)), ok: !!q.rd[r.id] })),
    retos: D.paseRetos(q.n).map(r => ({ id: r.id, txt: r.txt, pp: r.pp, n: r.n, v: Math.max(0, (v[r.k] || 0) - (base[r.k] || 0)), ok: !!q.rp[r.id] })) };
}
function paseClaim(p, b) {
  const q = paseDe(p), nivel = Math.floor(+b.nivel), pista = b.pista === 'd' ? 'd' : 'g';
  if (!(nivel >= 1 && nivel <= D.PASE.niveles + (pista === 'd' ? D.PASE.extraMax : 0))) throw new GameError('Ese nivel no existe.');
  if (!alcanzado(q, nivel)) throw new GameError('Todavía no llegas a ese nivel.');
  if (pista === 'd' && !q.dorado) throw new GameError('Ese premio es de la pista dorada.');
  if ((pista === 'd' ? q.cd : q.cg)[nivel]) throw new GameError('Ya reclamaste ese premio.');
  paseEntrega(p, q, nivel, pista);
  return { pase: paseInfo(p), inbox: p.inbox };
}
// comprado: lo que functions/index.js leyó en la RTDB (o PK_PASE_LIBRE en el servidor local de pruebas). Comprar a
// mitad del pase entrega de una vez los premios dorados de los niveles ya alcanzados.
function paseActivar(p, comprado) {
  const q = paseDe(p);
  if (comprado && !q.dorado) {
    q.dorado = true;
    for (let n = 1; n <= D.PASE.niveles + D.PASE.extraMax; n++) if (alcanzado(q, n) && !q.cd[n]) paseEntrega(p, q, n, 'd');
    store.touch('players');
  }
  return { pase: paseInfo(p), inbox: p.inbox };
}
const pasePeriodo = () => D.paseDe(now());

// Con PK_TICK_PEREZOSO (Cloud Functions) no hay reloj: una función no corre entre pedidos, así que el que
// la llama ejecuta tick() antes de atender un pedido si pasaron 5 s. Todo lo que avanza usa el tiempo
// transcurrido (regeneración, deriva de precios, eventos), así que un tick tarde equivale a varios.
if (!process.env.PK_TICK_PEREZOSO) setInterval(tick, 5000).unref();

module.exports = {
  GameError, byToken, byUid, tick, suspect, LIM, join, sync, listOffers, postOffer, acceptOffer, cancelOffer,
  listGuilds, createGuild, joinGuild, leaveGuild, contribute, guildChat, eventContribute, askHelp, giveHelp, askNeed, sendNeed, worldChat, claim, conquer, conquerBot, ranking, getSave, putSave, deleteSave, status,
  paseInfo, paseClaim, paseActivar, pasePeriodo,
};
