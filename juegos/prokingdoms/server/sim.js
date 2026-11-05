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
const PK = ctx.window.PK, D = PK.D, W = PK.World, U = PK.U;
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
  // Fase 9: en el archipiélago no llega foto ni recolección; el reino de la tierra queda como «sin conexión»
  p.mar = b.mundo === 'mar';
  if (p.mar) { b.harvest = null; b.market = null; b.snap = null; b.pase = null; }
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
  if (b.snap && b.snap.rk) checkRk(p, b.snap.rk);
  w.chat = w.chat || [];
  const wsince = +b.wsince || 0;
  store.touch('players'); store.touch('worlds');

  const since = +b.since || 0, nodes = {};
  if (!p.mar) for (const id in w.nodes) if (!since || (w.nv[id] || 0) > since) nodes[id] = w.nodes[id]; // en el mar no hace falta la tierra
  const kb = b.kb || {}, players = [];
  w.slots.forEach((pid, slot) => {
    if (!pid || pid === p.id || p.mar) return;
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
  // la diplomacia solo viaja cuando cambió su versión (S6: el sync no crece)
  const diplo = vEra(p) >= DP.era ? (diploDe(p).v === +b.dv ? undefined : diploInfo(p)) : undefined;
  return { now: t, ver: w.ver, nodes, players, prices: market().p, inbox: p.inbox, pase: b.pase ? paseInfo(p) : undefined, incoming: incomingFor(p), saqueo: saqueoInfo(p), diplo, caravanas: p.caravanas && p.caravanas.length ? caravanasInfo(p) : undefined, titulo: tituloDe(p) || undefined, guild: guildSummary(p), tv: w.tv, terr: +b.tv === w.tv || p.mar ? undefined : w.terr,
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
    ev: { name: ev.name, res: ev.res, goal: ev.goal, prog: ev.prog, ends: ev.ends, done: ev.done, my: ev.contrib[p.id] || 0, top }, helps, needs, jefe: jefeInfo(g, p),
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
  const pa = pactoCon(p, slot);
  if (pa === 'noAgresion' || pa === 'alianza') throw new GameError('Tienes un pacto con ese reino.');
  relSuma(p, slot, -15); // le quitaste tierra: se ofende (puede romper un tratado)
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
  const why = D.canConquer({ era: p.snap ? p.snap.era : 1, score: p.snap ? p.snap.score : 0 }, Object.assign(terrInfo(tgt, w, slot), { pacto: pactoCon(p, slot) }), revenge);
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
function ranking(p, b) {
  const t = now(), cat = D.RANKINGS[b && b.cat] ? b.cat : 'era';
  return store.all('players').filter(o => cat === 'era' || rkValor(o, cat) > 0).map(o => ({
    id: o.id, name: o.name, era: o.snap ? o.snap.era : 1, pop: o.snap ? o.snap.pop : 0, total: o.snap ? Math.floor(o.snap.total) : 0, v: rkValor(o, cat), titulo: tituloDe(o),
    world: (store.get('worlds', o.world) || {}).name, online: t - o.lastSeen < ONLINE_MS, me: o.id === p.id,
  })).sort((a, b) => (cat === 'era' ? b.era - a.era || b.total - a.total : b.v - a.v)).slice(0, 50);
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

// ---------- Diplomacia (Fase 5, S1, pk-23) ----------
// Cada jugador guarda su relación con los otros 15 reinos de su mundo (p.diplo.s[casilla]). Con un reino simulado
// hay relación (−100 a +100, que deriva hacia la base de su personalidad), tratado de comercio y un pacto
// (no agresión, alianza o rivalidad); el servidor responde por él según su personalidad (D.diploAcepta). Con un
// jugador real no hay número: las propuestas le llegan por el buzón y él las acepta. Si en una casilla cambia
// quién la ocupa (llegó un jugador o se fue), esa entrada vuelve a empezar.
const PERS = D.PERSONALIDADES, DP = D.DIPLO;
const persDe = slot => (D.REALM_SLOTS[slot] && D.REALM_SLOTS[slot].bot.pers) || 'sabio';
const realmName = (p, slot) => { const w = world(p), o = w && w.slots[slot] && player(w.slots[slot]); return o ? 'Reino de ' + o.name : D.REALM_SLOTS[slot].bot.realm; };
function diploDe(p) {
  const w = world(p), t = now();
  const d = p.diplo || (p.diplo = { v: 1, at: t, s: {}, prop: [], ev: null, evNext: 0 });
  const dias = clamp((t - (d.at || t)) / 864e5, 0, 3);
  d.at = t;
  let cambio = false;
  for (let slot = 0; slot < SLOTS; slot++) {
    if (slot === p.slot) continue;
    const con = (w && w.slots[slot]) || 'bot';
    let e = d.s[slot];
    if (!e || e.con !== con) {
      e = d.s[slot] = { con, rel: con === 'bot' ? PERS[persDe(slot)].base : 0, pacto: null, tratado: false, boda: false, reg: { d: '', n: 0 }, trop: 0 };
      cambio = true;
      continue;
    }
    if (con !== 'bot' || dias <= 0) continue;
    const P = PERS[persDe(slot)], base = e.boda ? Math.max(P.base, 60) : e.pacto === 'rival' ? Math.min(P.base, -40) : P.base, paso = 2 * P.deriva * dias, antes = Math.round(e.rel);
    e.rel += clamp(base - e.rel, -paso, paso);
    if (Math.round(e.rel) !== antes) cambio = true;
    if (rompeSiCae(p, slot, e)) cambio = true;
  }
  d.prop = (d.prop || []).filter(o => t - o.at < 864e5);
  if (cambio) { d.v++; store.touch('players'); }
  return d;
}
// Un reino simulado rompe el pacto (o el tratado) si la relación cae muy bajo lo que pidió para firmarlo.
function rompeSiCae(p, slot, e) {
  const u = PERS[persDe(slot)].umbral, nombre = D.REALM_SLOTS[slot].bot.realm;
  let roto = null;
  if (e.pacto === 'alianza' && !e.boda && e.rel < u.alianza - DP.rompe) { e.pacto = e.rel >= u.noAgresion - DP.rompe ? 'noAgresion' : null; roto = 'la alianza'; }
  else if (e.pacto === 'noAgresion' && e.rel < u.noAgresion - DP.rompe) { e.pacto = null; roto = 'el pacto de no agresión'; }
  else if (e.tratado && e.rel < u.comercio - DP.rompe) { e.tratado = false; roto = 'el tratado de comercio'; }
  if (roto) push(p, { type: 'diplo', text: nombre + ' rompió ' + roto + ': la relación se enfrió demasiado.' });
  return !!roto;
}
const aliadosDe = p => { const d = diploDe(p); return Object.keys(d.s).map(Number).filter(k => d.s[k].pacto === 'alianza'); };
function diploAccion(p) {
  const day = today(p);
  day.diplo = (day.diplo || 0) + 1;
  if (day.diplo > DP.accionesDia) throw new GameError('Ya hiciste mucha diplomacia hoy. Vuelve mañana.');
}
function diploInfo(p) {
  const d = diploDe(p), s = {}, t = now(), dia = diaUTC();
  for (const k in d.s) {
    const e = d.s[k];
    s[k] = { rel: e.con === 'bot' ? Math.round(e.rel) : null, pacto: e.pacto, tratado: !!e.tratado, boda: !!e.boda, reg: e.reg.d === dia ? e.reg.n : 0, h: e.con !== 'bot' };
  }
  return { v: d.v, s, prop: d.prop.map(o => ({ id: o.id, slot: o.slot, from: o.from, pacto: o.pacto })), ev: d.ev && d.ev.hasta > t ? d.ev : null };
}
const diploResp = (p, extra) => Object.assign({ diplo: diploInfo(p), inbox: p.inbox }, extra || {});
function entrada(p, b) {
  const slot = Math.floor(+b.slot), d = diploDe(p), e = d.s[slot];
  if (!e) throw new GameError('Ese reino no existe.');
  if (vEra(p) < DP.era) throw new GameError('La diplomacia se abre en la Era ' + U.roman(DP.era) + '.');
  return { slot, d, e };
}
function aplicaPacto(e, pacto) {
  const bot = e.con === 'bot';
  if (pacto === 'comercio') e.tratado = true;
  else if (pacto === 'noAgresion' || pacto === 'alianza') e.pacto = pacto;
  else if (pacto === 'rival') { e.pacto = 'rival'; e.tratado = false; e.boda = false; if (bot) e.rel = Math.max(-100, Math.min(e.rel - 40, -30)); }
  else if (pacto === 'paz') { e.pacto = null; if (bot) e.rel = Math.min(100, e.rel + 10); }
  else if (pacto === 'romper') {
    if (bot) e.rel = Math.max(-100, e.rel - (e.pacto === 'alianza' ? 30 : e.pacto === 'noAgresion' ? 20 : 10));
    if (e.pacto === 'alianza' || e.pacto === 'noAgresion') { e.pacto = null; e.boda = false; } else e.tratado = false;
  }
}
const PACTO_TXT = { comercio: 'un tratado de comercio', noAgresion: 'un pacto de no agresión', alianza: 'una alianza', paz: 'hacer las paces' };
function diploPropose(p, b) {
  const { slot, d, e } = entrada(p, b), pacto = b.pacto;
  if (!['comercio', 'noAgresion', 'alianza', 'rival', 'paz', 'romper'].includes(pacto)) throw new GameError('Esa propuesta no existe.');
  if (pacto === 'romper' && !e.pacto && !e.tratado) throw new GameError('No tienes nada firmado con ese reino.');
  const nAli = aliadosDe(p).length;
  if (e.con === 'bot') {
    const pers = persDe(slot), why = D.diploAcepta(pers, e, pacto, nAli), nombre = D.REALM_SLOTS[slot].bot.realm;
    diploAccion(p);
    if (why) return diploResp(p, { ok: false, motivo: why });
    aplicaPacto(e, pacto);
    d.v++; store.touch('players');
    const txt = pacto === 'rival' ? 'Declaraste la rivalidad a ' + nombre + '.' : pacto === 'romper' ? 'Rompiste con ' + nombre + '.' : pacto === 'paz' ? nombre + ' aceptó la paz.' : nombre + ' aceptó ' + PACTO_TXT[pacto] + '.';
    return diploResp(p, { ok: true, txt });
  }
  // con un jugador real: la rivalidad y romper son de una parte; lo demás es una propuesta que él acepta
  const o = player(e.con);
  if (!o) throw new GameError('Ese jugador ya no está en tu mundo.');
  const oe = diploDe(o).s[p.slot];
  if (pacto === 'rival' || pacto === 'romper') {
    diploAccion(p);
    aplicaPacto(e, pacto); if (oe) aplicaPacto(oe, pacto);
    d.v++; o.diplo.v++;
    push(o, { type: 'diplo', text: pacto === 'rival' ? p.name + ' te declaró la rivalidad.' : p.name + ' rompió lo que tenían firmado.' });
    return diploResp(p, { ok: true, txt: pacto === 'rival' ? 'Declaraste la rivalidad a ' + o.name + '.' : 'Rompiste con ' + o.name + '.' });
  }
  const why = D.diploAcepta('sabio', Object.assign({}, e, { rel: 100 }), pacto, nAli);
  if (why) throw new GameError(why);
  if (o.diplo.prop.some(x => x.fromId === p.id && x.pacto === pacto)) throw new GameError('Ya le propusiste eso: espera su respuesta.');
  diploAccion(p);
  o.diplo.prop.push({ id: rid('d'), fromId: p.id, from: p.name, slot: p.slot, pacto, at: now() });
  if (o.diplo.prop.length > 10) o.diplo.prop.shift();
  o.diplo.v++;
  push(o, { type: 'diplo', text: p.name + ' te propone ' + PACTO_TXT[pacto] + '. Respóndele en Reinos.' });
  store.touch('players');
  return diploResp(p, { ok: true, txt: 'Le propusiste ' + PACTO_TXT[pacto] + ' a ' + o.name + '.' });
}
function diploAccept(p, b) {
  const d = diploDe(p), x = d.prop.find(o => o.id === b.id);
  if (!x) throw new GameError('Esa propuesta ya no está.');
  d.prop.splice(d.prop.indexOf(x), 1); d.v++;
  const q = player(x.fromId), w = world(p);
  if (!q || w.slots[x.slot] !== q.id) { store.touch('players'); return diploResp(p, { ok: false, motivo: 'Ese jugador ya no está en tu mundo.' }); }
  if (!b.si) { push(q, { type: 'diplo', text: p.name + ' rechazó ' + PACTO_TXT[x.pacto] + '.' }); store.touch('players'); return diploResp(p, { ok: true, txt: 'Rechazaste la propuesta.' }); }
  const e = d.s[x.slot], qe = diploDe(q).s[p.slot];
  const why = D.diploAcepta('sabio', Object.assign({}, e, { rel: 100 }), x.pacto, aliadosDe(p).length) || D.diploAcepta('sabio', Object.assign({}, qe, { rel: 100 }), x.pacto, aliadosDe(q).length);
  if (why) throw new GameError(why);
  diploAccion(p);
  aplicaPacto(e, x.pacto); aplicaPacto(qe, x.pacto);
  q.diplo.v++;
  push(q, { type: 'diplo', text: p.name + ' aceptó ' + PACTO_TXT[x.pacto] + '.' });
  store.touch('players');
  return diploResp(p, { ok: true, txt: 'Aceptaste ' + PACTO_TXT[x.pacto] + ' con ' + q.name + '.' });
}
// Regalo: a un reino simulado le sube la relación (se va de tu economía); a un jugador real le llega el recurso,
// con los mismos topes diarios de valor que el tablón del gremio.
function diploGift(p, b) {
  const { slot, d, e } = entrada(p, b), res = b.res, era = vEra(p), dia = diaUTC();
  if (!DP.regaloRes.includes(res)) throw new GameError('Ese recurso no se regala.');
  const asked = Math.floor(+b.n || 0);
  if (!(asked > 0)) throw new GameError('Elige cuánto regalar.');
  if (e.reg.d !== dia) e.reg = { d: dia, n: 0 };
  if (e.reg.n >= DP.regalosDia) throw new GameError('Ya le mandaste ' + DP.regalosDia + ' regalos hoy.');
  if (asked > stockOf(p, res) + 1) suspect(p, 'regalo', { res, pedido: asked, stock: Math.round(stockOf(p, res)) });
  let n = Math.min(asked, Math.floor(stockOf(p, res)));
  const o = e.con !== 'bot' ? player(e.con) : null, price = market().p[res] || BASE[res];
  if (o) n = Math.min(n, Math.floor((giftLeft(p, 'giftOut') * 100) / price), Math.floor((giftLeft(o, 'giftIn') * 100) / price));
  if (n <= 0) throw new GameError(o ? 'Ya mandaste (o recibió) mucho por hoy.' : 'No tienes de eso en tu bodega.');
  diploAccion(p);
  e.reg.n++;
  spend(p, res, n);
  let gana = 0, extra = '';
  if (o) {
    const day = today(p), od = today(o), v = value(res, n);
    day.giftOut = (day.giftOut || 0) + v; od.giftIn = (od.giftIn || 0) + v;
    push(o, { type: 'res', res: { [res]: n }, text: p.name + ' te regaló ' + n + ' de ' + D.RES[res].name.toLowerCase() + '.' });
  } else {
    gana = D.regaloRel(value(res, n), era, persDe(slot), res);
    const ev = d.ev;
    if (ev && ev.tipo === 'pedido' && ev.slot === slot && ev.res === res && n >= ev.n && ev.hasta > now()) { gana = Math.min(2 * DP.regaloMax, gana * 2 + 5); d.ev = null; extra = ' Era justo lo que te pidió: vale el doble.'; }
    e.rel = clamp(e.rel + gana, -100, 100);
  }
  d.v++; store.touch('players');
  return diploResp(p, { accepted: n, gana: Math.round(gana * 10) / 10, txt: extra });
}
// Respuesta a un evento diplomático (ultimátum o pedido de ayuda). Lo que se paga lo descuenta el cliente con `paga`.
function diploEvento(p, b) {
  const d = diploDe(p), ev = d.ev, t = now();
  if (!ev || ev.id !== b.id || ev.hasta <= t) throw new GameError('Ese asunto ya pasó.');
  const e = d.s[ev.slot], nombre = D.REALM_SLOTS[ev.slot].bot.realm, pide = ev.tipo === 'ultimatum' ? ev.pide : { [ev.res]: ev.n };
  d.ev = null; d.v++;
  if (b.acc !== 'pagar') { venceEvento(p, ev, e, nombre); store.touch('players'); return diploResp(p, { ok: true }); }
  for (const r in pide) if (pide[r] > stockOf(p, r) + 1) { d.ev = ev; throw new GameError('No te alcanza.'); }
  diploAccion(p);
  for (const r in pide) spend(p, r, pide[r]);
  if (ev.tipo === 'ultimatum') { e.rel = clamp(e.rel + 10, -100, 100); p.saqNext = Math.max(p.saqNext || 0, t + 3 * 3600e3); if (p.saqDe === ev.slot) p.saqDe = null; }
  else e.rel = clamp(e.rel + 12, -100, 100);
  store.touch('players');
  return diploResp(p, { ok: true, paga: pide, txt: ev.tipo === 'ultimatum' ? nombre + ' aceptó tu pago y se queda tranquilo por un tiempo.' : nombre + ' agradece tu ayuda.' });
}
// Rechazar (o dejar vencer) un evento.
function venceEvento(p, ev, e, nombre) {
  if (ev.tipo === 'ultimatum') {
    e.rel = clamp(e.rel - 5, -100, 100);
    p.saqDe = ev.slot; p.saqNext = now(); // manda su partida enseguida (con el aviso de siempre)
    push(p, { type: 'diplo', text: nombre + ' no recibió su tributo: su partida de saqueo ya sale hacia tu pueblo.' });
  } else { e.rel = clamp(e.rel - 2, -100, 100); push(p, { type: 'diplo', text: nombre + ' se quedó esperando tu ayuda.' }); }
}
function nuevoEvento(p, d, t) {
  const era = vEra(p), bots = Object.keys(d.s).map(Number).filter(k => d.s[k].con === 'bot'), opc = [];
  const saqEnCurso = p.saqueo && !p.saqueo.fin;
  const ult = bots.filter(k => persDe(k) === 'conquistador' && d.s[k].rel < 10 && (!d.s[k].pacto || d.s[k].pacto === 'rival'));
  if (ult.length && era >= SAQ.era && !saqEnCurso && !p.snap.truce) opc.push(['ultimatum', pick(ult), 2]);
  const amigos = bots.filter(k => d.s[k].rel >= 20);
  if (amigos.length) opc.push(['embajada', pick(amigos), 2]);
  const piden = bots.filter(k => d.s[k].rel >= 25 || d.s[k].pacto === 'alianza');
  if (piden.length) opc.push(['pedido', pick(piden), 2]);
  const boda = bots.filter(k => d.s[k].pacto === 'alianza' && d.s[k].rel >= 80 && !d.s[k].boda);
  if (boda.length) opc.push(['boda', boda[0], 3]);
  const ali = bots.filter(k => d.s[k].pacto === 'alianza' && t - (d.s[k].trop || 0) > 864e5);
  if (ali.length) opc.push(['tropas', pick(ali), 2]);
  if (!opc.length) return;
  let r = Math.random() * opc.reduce((s, o) => s + o[2], 0), elegido = opc[0];
  for (const o of opc) { r -= o[2]; if (r <= 0) { elegido = o; break; } }
  const [tipo, slot] = elegido, e = d.s[slot], nombre = D.REALM_SLOTS[slot].bot.realm, esc = D.diploEscala(era);
  if (tipo === 'embajada') {
    e.rel = clamp(e.rel + 2, -100, 100);
    push(p, { type: 'diplo', res: { gold: Math.round(esc * 0.25), food: Math.round(esc * 0.4) }, text: 'Embajada de ' + nombre + ': te traen regalos en señal de amistad.' });
  } else if (tipo === 'pedido') {
    const pool = ['food', 'wood', 'stone', 'gold'].concat(era >= 3 ? ['books'] : []), res = pick(pool), n = D.needAmount(res, era);
    d.ev = { id: rid('e'), tipo, slot, res, n, hasta: t + 6 * 3600e3 };
    push(p, { type: 'diplo', ev: true, text: nombre + ' te pide ayuda: necesita ' + n + ' de ' + D.RES[res].name.toLowerCase() + '. Mandárselo vale el doble.' });
  } else if (tipo === 'ultimatum') {
    d.ev = { id: rid('e'), tipo, slot, pide: D.ultimatumPide(era), hasta: t + 20 * 60e3 };
    push(p, { type: 'diplo', ev: true, urgente: true, text: 'Ultimátum de ' + nombre + ': paga ' + d.ev.pide.gold + ' de oro en 20 minutos o manda una partida de saqueo.' });
  } else if (tipo === 'boda') {
    e.boda = true; e.rel = Math.max(e.rel, 85);
    push(p, { type: 'diplo', res: { gems: 3 * era, gold: Math.round(esc * 0.5) }, text: '¡Boda real con ' + nombre + '! La alianza queda sellada para siempre y los invitados dejan regalos.' });
  } else if (tipo === 'tropas') {
    e.trop = t;
    push(p, { type: 'diplo', tropas: { spear: 2 + era, archer: 1 + Math.ceil(era / 2) }, text: nombre + ', tu aliado, te manda soldados para tu guarnición.' });
  }
  d.v++;
}
function tickDiplo() {
  const t = now();
  for (const p of store.all('players')) {
    if (!p.snap || t - p.lastSeen > ONLINE_MS || vEra(p) < DP.era || p.mar) continue;
    const d = diploDe(p);
    if (d.ev && d.ev.hasta <= t) { const ev = d.ev; d.ev = null; d.v++; venceEvento(p, ev, d.s[ev.slot], D.REALM_SLOTS[ev.slot].bot.realm); }
    if (!d.evNext) { d.evNext = t + rand(0.5, 1.5) * 3600e3; store.touch('players'); continue; }
    if (t < d.evNext || d.ev) continue;
    d.evNext = t + rand(3, 6) * 3600e3;
    nuevoEvento(p, d, t);
    store.touch('players');
  }
}
// Cambio de relación por algo que pasó en el mundo (saqueos, conquistas).
function relSuma(p, slot, n) { const d = diploDe(p), e = d.s[slot]; if (!e || e.con !== 'bot') return; e.rel = clamp(e.rel + n, -100, 100); rompeSiCae(p, slot, e); d.v++; store.touch('players'); }
const pactoCon = (p, slot) => { const e = diploDe(p).s[slot]; return e ? e.pacto : null; };

// ---------- Caravanas (Fase 5, S2, pk-24) ----------
// Van de tu Centro Urbano a un reino con tratado de comercio y vuelven con oro (por el buzón). El riesgo de bandidos
// crece con la distancia y baja con escolta (que se paga al salir) o con el Faro Abisal (de la foto de edificios).
const CV = D.CARAVANA;
const tieneFaro = p => (p.buildings || []).some(b => b[0] === 'faro' && b[3]);
const caravanasInfo = p => (p.caravanas || []).map(c => ({ id: c.id, slot: c.slot, sale: c.sale, llega: c.llega, vuelve: c.vuelve, escolta: c.escolta, oro: c.oro, riesgo: c.riesgo }));
function caravana(p, b) {
  const slot = Math.floor(+b.slot), era = vEra(p), t = now(), d = diploDe(p), e = d.s[slot];
  if (era < CV.era) throw new GameError('Las caravanas salen desde la Era ' + U.roman(CV.era) + '.');
  if (!e) throw new GameError('Ese reino no existe.');
  if (!e.tratado) throw new GameError('Necesitas un tratado de comercio con ese reino.');
  p.caravanas = (p.caravanas || []).filter(c => c.vuelve > t);
  if (p.caravanas.length >= CV.max) throw new GameError('Ya tienes ' + CV.max + ' caravanas en camino.');
  const day = today(p);
  if ((day.caravanas || 0) >= CV.dia) throw new GameError('Ya mandaste ' + CV.dia + ' caravanas hoy.');
  const escolta = !!b.escolta, paga = escolta ? D.caravanaEscolta(era) : null;
  if (paga) for (const r in paga) if (paga[r] > stockOf(p, r) + 1) throw new GameError('No te alcanza para la escolta.');
  if (paga) for (const r in paga) spend(p, r, paga[r]);
  day.caravanas = (day.caravanas || 0) + 1;
  const dist = D.distReinos(p.slot, slot), ida = D.caravanaIda(dist) * 1000;
  const c = { id: rid('v'), slot, sale: t, llega: t + ida, vuelve: t + 2 * ida, escolta, oro: D.caravanaOro(era, dist), riesgo: D.caravanaRiesgo(dist, escolta, tieneFaro(p)) };
  p.caravanas.push(c);
  store.touch('players');
  return { caravanas: caravanasInfo(p), paga };
}
function tickCaravanas() {
  const t = now();
  for (const p of store.all('players')) {
    if (!p.caravanas || !p.caravanas.length) continue;
    for (const c of p.caravanas.slice()) {
      if (t < c.vuelve) continue;
      p.caravanas.splice(p.caravanas.indexOf(c), 1);
      const nombre = realmName(p, c.slot), asalto = Math.random() < c.riesgo, oro = Math.round(c.oro * (asalto ? 1 - CV.asalto : 1));
      push(p, { type: 'caravana', res: { gold: oro }, asalto, slot: c.slot, text: asalto ? 'Unos bandidos asaltaron tu caravana de vuelta de ' + nombre + ': salvaste ' + oro + ' de oro.' : 'Volvió tu caravana de ' + nombre + ' con ' + oro + ' de oro.' });
      // con un jugador real, el socio también gana algo
      const w = world(p), o = w && w.slots[c.slot] && player(w.slots[c.slot]);
      if (o && !asalto) push(o, { type: 'res', res: { gold: Math.round(c.oro * CV.socio) }, text: 'La caravana de ' + p.name + ' comerció en tu reino: +' + Math.round(c.oro * CV.socio) + ' de oro.' });
      store.touch('players');
    }
  }
}

// ---------- Jefe semanal del gremio (Fase 5, S3, pk-24) ----------
// g.jefe = { sem, id, max, hp, dano: {pid|npc:nombre: n}, tramo }. La vida sale de la era media de los miembros
// reales y de cuántos son. Cada ataque gasta la fuerza que valida checkArmy (como una campaña) y vuelve con bajas.
const JG = D.JEFE_GREMIO;
function jefeDe(g) {
  const sem = D.semana(now());
  if (!g.jefe || g.jefe.sem !== sem) {
    if (g.jefe && g.jefe.hp > 0) chatPush(g, 'Gremio', D.jefeGremioDe(g.jefe.sem).name + ' se retiró con ' + Math.round((g.jefe.hp / g.jefe.max) * 100) + '% de vida.');
    const reales = g.members.map(player).filter(Boolean), era = reales.length ? Math.round(reales.reduce((s, o) => s + vEra(o), 0) / reales.length) : 2;
    const J = D.jefeGremioDe(sem), max = D.jefeGremioVida(era, reales.length + (g.npc ? NPC_MEMBERS.length * 0.5 : 0));
    g.jefe = { sem, id: J.id, max, hp: max, dano: {}, tramo: 0, era, at: now() };
    chatPush(g, 'Gremio', '¡' + J.name + ' apareció! Ataquen con sus ejércitos: el daño de todos suma.');
    store.touch('guilds');
  }
  return g.jefe;
}
function jefeDano(g, quien, n) {
  const j = jefeDe(g);
  if (j.hp <= 0) return 0;
  const hecho = Math.min(j.hp, Math.max(0, Math.round(n)));
  j.hp -= hecho;
  j.dano[quien] = (j.dano[quien] || 0) + hecho;
  // premios por tramo de daño total, para cada miembro real que pegó esta semana
  while (j.tramo < JG.tramos.length && (j.max - j.hp) / j.max >= JG.tramos[j.tramo] - 1e-9) {
    j.tramo++;
    const J = D.jefeGremioDe(j.sem), top = D.eventTopKey(j.dano);
    chatPush(g, 'Gremio', j.tramo === JG.tramos.length ? '¡' + J.name + ' cayó! Gracias a todos.' : J.name + ' perdió el ' + Math.round(JG.tramos[j.tramo - 1] * 100) + '% de su vida.');
    for (const pid of Object.keys(j.dano)) {
      if (pid.startsWith('npc:')) continue;
      const o = player(pid);
      if (!o) continue;
      const pr = D.jefeGremioPremio(j.tramo, vEra(o));
      if (j.tramo === JG.tramos.length) { o.jefes = (o.jefes || 0) + 1; if (pid === top) { pr.gems += 2 * vEra(o); pr.coins += 10; } }
      push(o, { type: 'jefe_gremio', res: { gold: pr.gold, gems: pr.gems }, coins: pr.coins, text: J.name + ': tramo ' + j.tramo + ' de ' + JG.tramos.length + (j.tramo === JG.tramos.length && pid === top ? ' (y el extra por más daño)' : '') + '.' });
    }
  }
  store.touch('guilds');
  return hecho;
}
function jefeInfo(g, p) {
  const j = jefeDe(g), J = D.jefeGremioDe(j.sem), names = {};
  for (const pid of g.members) { const o = player(pid); if (o) names[pid] = o.name; }
  const top = Object.keys(j.dano).map(k => ({ name: k.startsWith('npc:') ? k.slice(4) : names[k] || '—', n: j.dano[k], me: k === p.id })).sort((a, b) => b.n - a.n).slice(0, 6);
  return { id: J.id, name: J.name, desc: J.desc, max: j.max, hp: j.hp, tramo: j.tramo, mio: j.dano[p.id] || 0, top, hoy: today(p).jefe || 0, fin: (j.sem + 1) * 7 * 864e5 - 3 * 864e5 };
}
function guildBoss(p, b) {
  const g = guildOf(p);
  if (!g) throw new GameError('No perteneces a ningún gremio.');
  const j = jefeDe(g), day = today(p);
  if (j.hp <= 0) throw new GameError('El jefe de esta semana ya cayó. El lunes llega otro.');
  if ((day.jefe || 0) >= JG.ataquesDia) throw new GameError('Ya atacaste ' + JG.ataquesDia + ' veces hoy.');
  const { total, power } = checkArmy(p, b.units, b.power);
  if (!total) throw new GameError('Elige tropas para atacar.');
  day.jefe = (day.jefe || 0) + 1;
  const hecho = jefeDano(g, p.id, power * JG.golpe * rand(0.9, 1.1));
  chatPush(g, 'Gremio', p.name + ' le hizo ' + hecho + ' de daño a ' + D.jefeGremioDe(j.sem).name + '.');
  store.touch('players');
  return { dano: hecho, bajas: JG.bajas, guilds: listGuilds(p) };
}
// los miembros simulados pegan poco a poco: entre todos, cerca del 40% de la vida en la semana
function tickJefes() {
  const t = now();
  for (const g of store.all('guilds')) {
    if (!g.members.length) continue;
    const j = jefeDe(g), mins = Math.min((t - (j.npcAt || j.at || t)) / 60000, 12 * 60);
    if (mins < 5 || j.hp <= 0) continue;
    j.npcAt = t;
    const npc = g.npc ? NPC_MEMBERS : [D.GUILD_APPRENTICE];
    jefeDano(g, 'npc:' + pick(npc), (j.max * JG.npc * mins) / (7 * 24 * 60) * rand(0.5, 1.5) * (g.npc ? 1 : 0.4));
  }
}

// ---------- Visitas (Fase 5, S4, pk-24) ----------
// Vista de solo lectura del reino de otro jugador (sus edificios de la última foto), con un «me gusta» y un regalo
// por día y por reino. Cada visitante cuenta una vez por día.
function otroJugador(p, b) {
  const o = player(String(b.id || ''));
  if (!o || o.id === p.id) throw new GameError('Ese reino no existe.');
  return o;
}
function visita(p, b) {
  const o = otroJugador(p, b), dia = diaUTC();
  o.vis = o.vis || { n: 0, likes: 0, de: {} };
  if (o.vis.de[p.id] !== dia) { o.vis.n++; o.vis.de[p.id] = dia; for (const k in o.vis.de) if (o.vis.de[k] !== dia) delete o.vis.de[k]; store.touch('players'); }
  const yo = (p.visHoy && p.visHoy.d === dia ? p.visHoy : (p.visHoy = { d: dia, like: {}, reg: {} }));
  const s = o.snap || {};
  return { id: o.id, name: o.name, slot: o.slot, world: (world(o) || {}).name, era: s.era || 1, pop: s.pop || 0, score: s.score || 0, buildings: o.buildings || [], visitas: o.vis.n, likes: o.vis.likes, titulo: tituloDe(o),
    yaLike: !!yo.like[o.id], yaRegalo: !!yo.reg[o.id] };
}
function visitaLike(p, b) {
  const o = otroJugador(p, b), dia = diaUTC();
  p.visHoy = p.visHoy && p.visHoy.d === dia ? p.visHoy : { d: dia, like: {}, reg: {} };
  if (p.visHoy.like[o.id]) throw new GameError('Ya le diste «me gusta» hoy.');
  p.visHoy.like[o.id] = 1;
  o.vis = o.vis || { n: 0, likes: 0, de: {} }; o.vis.likes++;
  push(o, { type: 'visita', text: p.name + ' visitó tu reino y le dio «me gusta».' });
  store.touch('players');
  return visita(p, b);
}
function visitaRegalo(p, b) {
  const o = otroJugador(p, b), dia = diaUTC(), pr = D.visitaRegalo(vEra(p));
  p.visHoy = p.visHoy && p.visHoy.d === dia ? p.visHoy : { d: dia, like: {}, reg: {} };
  if (p.visHoy.reg[o.id]) throw new GameError('Ya le dejaste un regalo hoy.');
  const v = value('gold', pr.gold);
  if (pr.gold > stockOf(p, 'gold') + 1) throw new GameError('No te alcanza.');
  if (giftLeft(p, 'giftOut') < v || giftLeft(o, 'giftIn') < v) throw new GameError('Ya se mandó mucho por hoy.');
  p.visHoy.reg[o.id] = 1;
  spend(p, 'gold', pr.gold);
  today(p).giftOut = (today(p).giftOut || 0) + v; today(o).giftIn = (today(o).giftIn || 0) + v;
  push(o, { type: 'res', res: pr, text: p.name + ' visitó tu reino y te dejó ' + pr.gold + ' de oro.' });
  store.touch('players');
  return Object.assign(visita(p, b), { paga: pr });
}

// ---------- Rankings y títulos semanales (Fase 5, S5, pk-24) ----------
// La foto trae `rk` (nivel de la Maravilla, piso más profundo, defensas ganadas). El servidor los acota como a la era:
// no pueden subir más rápido de lo posible. Los jefes de gremio y las visitas los cuenta él mismo.
const RK_MAX = { wonder: 3, floor: 5, def: 3 }; // cuánto puede subir cada uno entre dos fotos
function checkRk(p, raw) {
  if (!raw || typeof raw !== 'object') return;
  const prev = p.rk || { wonder: 0, floor: 0, def: 0 }, era = vEra(p), out = {}, odd = {};
  const techo = { wonder: 200, floor: 15, def: 1e6 };
  for (const k in RK_MAX) {
    const v = clamp(Math.floor(+raw[k] || 0), 0, techo[k]);
    // una partida nueva baja los números: se acepta (como el pase)
    out[k] = v < prev[k] ? v : Math.min(v, prev[k] + RK_MAX[k]);
    if (v > out[k]) odd[k] = v;
  }
  if (Object.keys(odd).length) suspect(p, 'ranking', odd);
  p.rk = out;
}
const rkValor = (o, cat) => {
  const rk = o.rk || {};
  return cat === 'era' ? (o.snap ? o.snap.era * 1e7 + Math.min(9e6, Math.floor(o.snap.total / 100)) : 0) : cat === 'maravilla' ? rk.wonder || 0 : cat === 'piso' ? rk.floor || 0 : cat === 'defensas' ? rk.def || 0 : cat === 'jefes' ? o.jefes || 0 : cat === 'visitas' ? (o.vis ? o.vis.n + 3 * o.vis.likes : 0) : cat === 'regata' ? regataValor(o) : 0;
};
function tituloDe(o) { const t = o.titulo; return t && t.sem >= D.semana(now()) - 1 ? D.RANKINGS[t.cat].titulo : null; }
function tickTitulos() {
  const sem = D.semana(now()), meta = store.get('meta', 'rk') || store.set('meta', 'rk', { sem });
  if (meta.sem === sem) return;
  meta.sem = sem;
  const recientes = store.all('players').filter(o => now() - o.lastSeen < 7 * 864e5);
  for (const cat in D.RANKINGS) {
    // un título por jugador y semana: si el primero ya tiene uno, va al siguiente
    const top = recientes.filter(o => !(o.titulo && o.titulo.sem === sem)).sort((a, b) => rkValor(b, cat) - rkValor(a, cat))[0];
    if (!top || rkValor(top, cat) <= 0) continue;
    top.titulo = { sem, cat };
    push(top, { type: 'titulo', text: '¡Título de la semana: «' + D.RANKINGS[cat].titulo + '»! Fuiste el primero del servidor en ' + D.RANKINGS[cat].name.toLowerCase() + '.' });
  }
  store.touch('meta'); store.touch('players');
}

// ---------- Partidas de saqueo de los reinos simulados (Fase 4, C6, pk-22; con diplomacia en pk-23) ----------
// Desde la Era IV, cada tanto un reino que maneja el servidor manda una partida contra un jugador conectado (que la
// ve marchar, con aviso). Quién la manda sale de los 5 reinos simulados más cercanos sin pacto de no agresión ni
// alianza, pesados por personalidad (el Conquistador manda más), rivalidad y relación; y el tiempo hasta la próxima
// lo acorta el vecino más agresivo. El jugador elige: pagar tributo, pelear (por defecto) o pedir ayuda a sus
// aliados, que suman a su defensa. El servidor decide el resultado con la defensa de la última foto (la misma que usa
// la conquista). Los recursos viven en el cliente: el tributo lo paga él y una derrota le llega por el buzón como un
// porcentaje que descuenta; una victoria le llega como premio por el buzón (y entra en lo que su foto puede crecer).
const SAQ = { era: 4, aviso: 180, entre: [2.5, 5] };
const saqTope = D.saqTope;
function saqCandidatos(p, w) {
  const d = diploDe(p), [hx, hy] = D.REALM_SLOTS[p.slot].home, out = [];
  w.slots.forEach((pid, slot) => {
    if (pid || slot === p.slot) return;
    const e = d.s[slot];
    if (e && (e.pacto === 'noAgresion' || e.pacto === 'alianza')) return;
    const h = D.REALM_SLOTS[slot].home;
    out.push({ slot, e, dist: Math.hypot(h[0] - hx, h[1] - hy) });
  });
  return out.sort((a, b) => a.dist - b.dist);
}
const saqPeso = c => PERS[persDe(c.slot)].peso * (c.e && c.e.pacto === 'rival' ? DP.rival.peso : 1) * (c.e && c.e.rel < -20 ? 1.5 : c.e && c.e.rel >= 30 ? 0.5 : 1);
const saqRitmo = c => PERS[persDe(c.slot)].saq * (c.e && c.e.pacto === 'rival' ? DP.rival.saq : 1);
// Los aliados que ayudarían ahora: reinos simulados con alianza y jugadores reales aliados (como mucho 3).
function aliadosAyuda(p) {
  const d = diploDe(p), out = [];
  for (const slot of aliadosDe(p).slice(0, DP.maxAliados)) {
    const e = d.s[slot];
    if (e.con === 'bot') out.push({ slot, name: D.REALM_SLOTS[slot].bot.realm, bot: true, boda: !!e.boda });
    else { const o = player(e.con); if (o) out.push({ slot, name: 'Reino de ' + o.name, pid: o.id }); }
  }
  return out;
}
function saqueoInfo(p) {
  const q = p.saqueo;
  if (!q || q.fin) return null;
  const al = aliadosAyuda(p);
  return { id: q.id, from: q.from, slot: q.slot, power: q.power, arrive: q.arrive, at: q.at, eleccion: q.eleccion || null, tributo: q.tributo, ayuda: al.length, aliados: al.map(a => ({ slot: a.slot, name: a.name })), pers: q.pers, rival: !!q.rival };
}
function tickSaqueos() {
  const t = now();
  for (const p of store.all('players')) {
    const q = p.saqueo;
    if (q && !q.fin && t >= q.arrive) { resolverSaqueo(p, q); continue; }
    if (q && !q.fin) continue;
    const s = p.snap;
    if (!s || s.era < SAQ.era || t - p.lastSeen > ONLINE_MS || s.truce || p.mar) continue; // en el mar, su tierra está sin nadie
    if (!p.saqNext) { p.saqNext = t + rand(0.5, 1.5) * 3600e3; store.touch('players'); continue; }
    if (t < p.saqNext) continue;
    const w = store.get('worlds', p.world);
    if (!w) continue;
    const todos = saqCandidatos(p, w), cands = todos.slice(0, 5);
    // en paz con todos los vecinos: nadie viene (y se vuelve a mirar en unas horas)
    if (!cands.length) { p.saqNext = t + 6 * 3600e3; p.saqDe = null; store.touch('players'); continue; }
    // el que dio un ultimátum (si sigue sin pacto) o uno al azar, pesado por personalidad
    let c = todos.find(o => o.slot === p.saqDe) || null;
    if (!c) {
      let r = Math.random() * cands.reduce((a, o) => a + saqPeso(o), 0);
      c = cands[cands.length - 1];
      for (const o of cands) { r -= saqPeso(o); if (r <= 0) { c = o; break; } }
    }
    p.saqDe = null;
    const best = c.slot, bot = D.REALM_SLOTS[best].bot, str = bot.strength, pers = persDe(best), rival = !!(c.e && c.e.pacto === 'rival');
    const power = Math.round(Math.max(60 * s.era * s.era, (s.defense || 0) * rand(0.75, 1.2)) * str);
    p.saqueo = { id: rid('s'), slot: best, from: bot.realm, power, at: t, arrive: t + SAQ.aviso * 1000, tributo: D.saqTributo(s.era), pers, rival };
    p.saqNext = t + rand(SAQ.entre[0], SAQ.entre[1]) * 3600e3 * Math.min(...cands.map(saqRitmo));
    push(p, { type: 'saqueo', sid: p.saqueo.id, from: bot.realm, power, arrive: p.saqueo.arrive, text: '¡' + bot.realm + ' manda una partida de saqueo contra tu pueblo!' });
    store.touch('players');
  }
}
function saqueo(p, b) {
  const q = p.saqueo, acc = b && b.accion;
  if (!q || q.fin || (b.id && b.id !== q.id)) throw new GameError('No hay ninguna partida en camino.');
  if (now() >= q.arrive) throw new GameError('Ya llegaron.');
  if (!['tributo', 'pelear', 'ayuda'].includes(acc)) throw new GameError('Esa opción no existe.');
  if (acc === 'ayuda' && !aliadosAyuda(p).length) throw new GameError('Necesitas un aliado para pedir ayuda (Reinos → Alianza).');
  if (q.eleccion === 'tributo') throw new GameError('Ya pagaste el tributo.');
  q.eleccion = acc;
  // el tributo resuelve en el acto: se vuelven a casa (el cliente lo descuenta de sus bodegas)
  if (acc === 'tributo') {
    q.fin = true;
    relSuma(p, q.slot, q.pers === 'comerciante' ? 8 : 5);
    push(p, { type: 'saqueo_fin', sid: q.id, res: 'tributo', from: q.from, text: q.from + ' aceptó tu tributo y su partida vuelve a casa.' });
  }
  store.touch('players');
  return { saqueo: saqueoInfo(p), inbox: p.inbox };
}
function resolverSaqueo(p, q) {
  q.fin = true;
  const s = p.snap || {}, era = s.era || SAQ.era, tope = saqTope(era);
  // los aliados suman a la defensa: cada reino simulado según su fuerza (más si hubo boda), cada jugador según la suya
  let mult = 1;
  const ayudaron = [];
  if (q.eleccion === 'ayuda') for (const a of aliadosAyuda(p)) {
    let ap = 0;
    if (a.bot) { ap = (DP.ayuda.base + DP.ayuda.fuerza * D.REALM_SLOTS[a.slot].bot.strength) * (a.boda ? DP.ayuda.boda : 1); relSuma(p, a.slot, -DP.ayuda.favor); }
    else {
      const o = player(a.pid);
      ap = o && o.snap ? Math.min(0.3, ((o.snap.defense || 0) * 0.25) / Math.max(1, s.defense || 1)) : 0;
      if (ap > 0.01) push(o, { type: 'diplo', res: { gold: 20 * era }, text: 'Tus soldados ayudaron a ' + p.name + ' contra la partida de ' + q.from + '.' });
    }
    if (ap > 0.01) { mult += ap; ayudaron.push(a.name); }
  }
  const def = Math.max(1, (s.defense || 0) * mult) * rand(0.85, 1.15), atk = q.power * rand(0.85, 1.15), gano = def >= atk;
  const base = { sid: q.id, from: q.from, atk: Math.round(atk), def: Math.round(def), ayuda: ayudaron.length > 0, aliados: ayudaron, rival: !!q.rival };
  // el Conquistador respeta a quien lo rechaza; los demás se ofenden
  relSuma(p, q.slot, gano ? (q.pers === 'conquistador' ? 3 : -5) : q.pers === 'conquistador' ? -3 : 0);
  if (gano) {
    const k = q.rival ? DP.rival.premio : 1;
    push(p, Object.assign(base, { type: 'saqueo_fin', res: 'gano', premio: { gold: Math.round(tope * 0.35 * k), gems: Math.round(era * k) }, text: '¡Rechazaste la partida de saqueo de ' + q.from + '!' }));
  } else push(p, Object.assign(base, { type: 'saqueo_fin', res: 'perdio', pct: 0.08, tope, text: 'La partida de ' + q.from + ' saqueó tus bodegas.' }));
  store.touch('players');
}

// ---------- La Regata de la Bruma y los duelos navales (Fase 9 «d», pk-30) ----------
// El mar no manda foto (los recursos del archipiélago viven en el cliente), así que el servidor no puede comprobar
// cuánto se gastó en el barco o en la flota. Lo que sí controla: cada parte del barco sube de a poco
// (D.REGATA.subeHora), el tiempo lo calcula él (D.regataTiempo, con su reloj y su suerte), 3 regatas por día, la
// flota de duelo crece a un ritmo posible y 5 duelos por día. Lo peor que logra un tramposo es el barco y la flota
// que pudo haber tenido.
const RG = D.REGATA;
const regataValor = o => (o.reg && o.reg.sem === D.semana(now()) && o.reg.mejor ? Math.round(1e5 / o.reg.mejor) : 0);
function regData(p) {
  const sem = D.semana(now()), r = (p.reg = p.reg || { liga: 0, barco: { casco: 0, velas: 0, timon: 0 }, at: 0 });
  if (r.sem !== sem) { r.semAnt = r.sem === sem - 1 ? { mejor: r.mejor || 0, n: r.n || 0 } : null; r.sem = sem; r.mejor = 0; r.n = 0; }
  if (r.dia !== diaUTC()) { r.dia = diaUTC(); r.hoy = 0; }
  return r;
}
function regataInfo(p) {
  const r = regData(p), sem = r.sem, liga = r.liga || 0;
  const rivales = store.all('players').filter(o => o.reg && o.reg.sem === sem && o.reg.mejor && (o.reg.liga || 0) === liga).sort((a, b) => a.reg.mejor - b.reg.mejor);
  return { liga, ligaName: RG.ligas[liga], mejor: r.mejor || 0, n: r.n || 0, hoy: r.hoy || 0, porDia: RG.porDia, barco: r.barco,
    tabla: rivales.slice(0, 20).map((o, i) => ({ pos: i + 1, id: o.id, name: o.name, mejor: o.reg.mejor, me: o.id === p.id })), puesto: rivales.findIndex(o => o.id === p.id) + 1, de: rivales.length };
}
function regata(p, b) {
  const r = regData(p), t = now(), ruta = String((b && b.ruta) || '');
  if (!RG.rutas[ruta]) throw new GameError('Esa ruta no existe.');
  if (r.hoy >= RG.porDia) throw new GameError('Ya corriste ' + RG.porDia + ' regatas hoy. Mañana hay más.');
  // el barco: cada parte puede subir 1 + subeHora por hora desde la última regata (y nunca más del máximo)
  const horas = r.at ? (t - r.at) / 3600e3 : 1e9, pedido = (b && b.barco) || {}, barco = {}, raro = {};
  for (const k in RG.partes) {
    const v = clamp(Math.floor(+pedido[k] || 0), 0, RG.maxNivel), tope = Math.min(RG.maxNivel, (r.barco[k] || 0) + 1 + Math.floor(horas * RG.subeHora));
    barco[k] = Math.min(v, tope);
    if (v > tope) raro[k] = v;
  }
  if (Object.keys(raro).length) suspect(p, 'regata', raro);
  const tiempo = D.regataTiempo(barco, ruta, t, rand(0.97, 1.03));
  r.barco = barco; r.at = t; r.hoy++; r.n = (r.n || 0) + 1;
  const record = !r.mejor || tiempo < r.mejor;
  if (record) r.mejor = tiempo;
  store.touch('players');
  return Object.assign(regataInfo(p), { tiempo, record, ruta, barcoUsado: barco, marea: D.marea(t), viento: D.vientoMar(t), tormenta: !!D.tormenta(t) });
}
// Cada lunes: en cada liga, los mejores ascienden y los peores descienden; todos los que corrieron reciben premio.
function tickRegata() {
  const sem = D.semana(now()), meta = store.get('meta', 'regata') || store.set('meta', 'regata', { sem });
  if (meta.sem === sem) return;
  meta.sem = sem;
  const corrieron = store.all('players').filter(o => o.reg && o.reg.sem === sem - 1 && o.reg.mejor);
  const ligaDe = new Map(corrieron.map(o => [o, o.reg.liga || 0])); // la de antes: ascender no hace correr de nuevo en la de arriba
  for (let liga = 0; liga < RG.ligas.length; liga++) {
    const l = corrieron.filter(o => ligaDe.get(o) === liga).sort((a, b) => a.reg.mejor - b.reg.mejor), n = l.length;
    if (!n) continue;
    const suben = n >= 2 ? Math.max(1, Math.floor(n * RG.sube)) : n, bajan = n >= 3 ? Math.floor(n * RG.baja) : 0;
    l.forEach((o, i) => {
      const nueva = i < suben ? Math.min(RG.ligas.length - 1, liga + 1) : i >= n - bajan ? Math.max(0, liga - 1) : liga;
      const coins = 5 + 5 * liga + (i === 0 ? 10 : i < 3 ? 5 : 0);
      o.reg.liga = nueva;
      push(o, { type: 'res', res: { coins }, text: 'Regata de la Bruma: terminaste ' + (i + 1) + '.º de ' + n + ' en la liga ' + RG.ligas[liga] + ' (+' + coins + ' monedas).' + (nueva > liga ? ' ¡Asciendes a ' + RG.ligas[nueva] + '!' : nueva < liga ? ' Bajas a ' + RG.ligas[nueva] + '.' : '') });
    });
  }
  store.touch('meta'); store.touch('players');
}
// Duelos: la flota de duelo se anota con lo que hay en casa (POST /api/flota) y no se pierde al pelear.
const DU = D.DUELO;
function duData(p) {
  const d = (p.duelo = p.duelo || { trofeos: DU.inicial, gan: 0, per: 0, hist: [] });
  if (d.dia !== diaUTC()) { d.dia = diaUTC(); d.hoy = 0; }
  return d;
}
function flotaMar(p, b) {
  const d = duData(p), t = now(), units = {};
  let n = 0;
  for (const k in DU.poder) { const v = clamp(Math.floor(+((b && b.units) || {})[k] || 0), 0, 1e6); units[k] = v; n += v; }
  if (n > DU.maxBarcos) throw new GameError('Una flota de duelo lleva como mucho ' + DU.maxBarcos + ' barcos.');
  if (!n) throw new GameError('Elige al menos un barco.');
  // a un ritmo posible: el poder puede crecer un 50% más 400 por hora desde la última vez
  const poder = D.dueloPoder(units), prev = d.flota ? d.flota.poder : 0, horas = d.flota ? (t - d.flota.at) / 3600e3 : 1e9;
  const tope = prev ? Math.max(prev, 300) * 1.5 + 400 * horas : 1e9;
  if (poder > tope) { suspect(p, 'flota', { poder, tope: Math.round(tope) }); throw new GameError('Tu flota creció demasiado rápido; espera un rato.'); }
  d.flota = { units, poder, at: t };
  store.touch('players');
  return duelosInfo(p);
}
function duelosInfo(p) {
  const d = duData(p), yo = d.trofeos;
  const rivales = store.all('players').filter(o => o.id !== p.id && o.duelo && o.duelo.flota)
    .sort((a, b) => Math.abs(a.duelo.trofeos - yo) - Math.abs(b.duelo.trofeos - yo)).slice(0, 8)
    .map(o => ({ id: o.id, name: o.name, trofeos: o.duelo.trofeos, poder: Math.round(o.duelo.flota.poder / 10) * 10 }));
  return { trofeos: yo, gan: d.gan, per: d.per, hoy: d.hoy, porDia: DU.porDia, flota: d.flota || null, rivales, hist: d.hist.slice(0, 8) };
}
function duelo(p, b) {
  const d = duData(p), o = player(b && b.id);
  if (!d.flota) throw new GameError('Primero anota tu flota de duelo.');
  if (!o || o.id === p.id || !o.duelo || !o.duelo.flota) throw new GameError('Ese rival no tiene flota de duelo.');
  if (d.hoy >= DU.porDia) throw new GameError('Ya hiciste ' + DU.porDia + ' duelos hoy.');
  const od = duData(o), a = d.flota, c = od.flota;
  const ratio = (a.poder * D.dueloVentaja(a.units, c.units)) / Math.max(1, c.poder * D.dueloVentaja(c.units, a.units));
  const chance = clamp(0.5 + (ratio - 1) * 0.9, 0.05, 0.95), gano = Math.random() < chance;
  // más trofeos por ganarle a alguien de más arriba
  const dif = clamp((od.trofeos - d.trofeos) / 400, -0.5, 0.5), gan = Math.round(DU.gana * (1 + dif)), per = Math.round(DU.pierde * (1 - dif * 0.5));
  d.hoy++;
  if (gano) { d.trofeos += gan; d.gan++; od.trofeos = Math.max(0, od.trofeos - Math.round(per * 0.5)); }
  else { d.trofeos = Math.max(0, d.trofeos - per); d.per++; od.trofeos += Math.round(gan * 0.5); }
  const linea = { at: now(), rival: o.name, gano, trofeos: gano ? gan : -per, chance: Math.round(chance * 100) };
  d.hist.unshift(linea); d.hist.length = Math.min(d.hist.length, 20);
  od.hist = od.hist || [];
  od.hist.unshift({ at: now(), rival: p.name, gano: !gano, trofeos: gano ? -Math.round(per * 0.5) : Math.round(gan * 0.5), defensa: true }); od.hist.length = Math.min(od.hist.length, 20);
  push(o, { type: 'res', res: gano ? {} : { coins: 1 }, text: 'Duelo naval: la flota de ' + p.name + ' ' + (gano ? 'le ganó a la tuya.' : 'atacó la tuya y perdió (+1 moneda).') });
  if (gano) push(p, { type: 'res', res: { coins: 2 }, text: 'Duelo naval ganado contra ' + o.name + ': +' + gan + ' trofeos y 2 monedas.' });
  store.touch('players');
  return Object.assign(duelosInfo(p), { resultado: linea });
}

function tick() {
  for (const w of store.all('worlds')) tickWorld(w);
  tickMarket();
  tickGuilds();
  tickCamps();
  tickSaqueos();
  tickDiplo();
  tickCaravanas();
  tickJefes();
  tickTitulos();
  tickRegata();
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
  paseInfo, paseClaim, paseActivar, pasePeriodo, saqueo, tickSaqueos,
  diploInfo: p => diploInfo(p), diploPropose, diploAccept, diploGift, diploEvento, tickDiplo,
  caravana, tickCaravanas, guildBoss, tickJefes, visita, visitaLike, visitaRegalo, tickTitulos,
  regata, regataInfo: p => regataInfo(p), tickRegata, flotaMar, duelosInfo: p => duelosInfo(p), duelo,
};
