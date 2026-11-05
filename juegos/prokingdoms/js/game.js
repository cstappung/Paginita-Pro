// Núcleo del juego: estado, economía, niveles de edificios, maestros de obras, almacenes, órdenes,
// construcción, exploración y niebla, puntos de interés, eras, investigación, guardado y progreso offline.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const G = (PK.Game = {});
  const SAVE_KEY = U.key('prokingdoms_save_v2');
  const toast = (t, k, act) => PK.UI && PK.UI.toast(t, k, act);

  G.units = []; G.buildings = [];
  G.uById = new Map(); G.bById = new Map();
  G.sel = null; G.placing = null; G.time = 0; G.timeScale = 1;
  let S = null;
  let botId = 100000;
  let capsDirty = true, caps = null;

  G.newState = function () {
    const now = Date.now();
    const res = {};
    for (const r of D.RES_ORDER) res[r] = 0;
    Object.assign(res, { food: 200, wood: 250, stone: 100, gold: 60 });
    return {
      v: D.SAVE_V, created: now, lastSeen: now, nextId: 1, slot: D.MY_SLOT, inboxAck: 0,
      res, era: 1, eraProg: null, techs: {}, research: null,
      stats: {}, flags: {}, quests: {}, daily: null, streak: { last: null, n: 0 },
      lastRegen: now, units: [], buildings: [], nodes: {}, fog: null, pois: {}, relics: 0,
    };
  };

  // Fase 9: la partida dice en qué mundo está (S.tema). El otro espera guardado en S.otro (js/mar.js).
  G.enMar = () => W.tema === 'mar';
  G.init = function (save) {
    if (D.aplicarTema) D.aplicarTema(save && save.tema); // Fase 9 (pk-28): las tablas del mar, antes del mapa
    W.generate(D.SEED, save && save.tema);
    G.units = []; G.buildings = []; G.uById.clear(); G.bById.clear(); G.encierro = null;
    S = G.state = save || G.newState();
    S.slot = D.MY_SLOT;
    S.inboxAck = S.inboxAck || 0;
    S.pois = S.pois || {};
    S.relics = S.relics || 0;
    S.perks = S.perks || {}; S.decrees = S.decrees || []; S.mastered = S.mastered || {};
    // retención: cofre de bienvenida pendiente, ayudas recibidas, noticias (ataques, batallas, envíos del gremio;
    // para el resumen al volver) y aviso de "ya casi"
    S.ret = Object.assign({ welcome: null, helpLog: [], news: [], almostDay: null }, S.ret);
    for (const r of D.RES_ORDER) S.res[r] = S.res[r] || 0;
    PK.Social.init(S);
    if (!G.enMar()) setupBots(); // en el archipiélago no hay reinos vecinos (todavía)
    if (save) restore(save);
    // un mundo recién descubierto (el primer viaje al archipiélago) llega sin edificios: se arma como una partida nueva
    if (!save || !G.buildings.some(b => b.owner === 'p')) setupPlayer();
    PK.Terr.init(S);
    PK.Logi.init(S);
    PK.Def.init(S);
    PK.Exp.init(S);
    PK.Incursiones.init(S);
    PK.Auto.init(S);
    PK.Consejo.init(S);
    if (PK.Heroes) PK.Heroes.init(S);
    if (PK.Aventura) PK.Aventura.init(S);
    if (PK.Leyendas) PK.Leyendas.init(S);
    if (PK.Campana) PK.Campana.init(S);
    if (PK.Vida) PK.Vida.init(S);
    PK.Life.reset();
    PK.Quests.init(S);
    if (PK.Arch) PK.Arch.init(S); // colonias, comercio y marea del archipiélago
    if (PK.Armada) PK.Armada.init(S); // la armada del archipiélago (pk-29): asaltos, jefes del mar
  };

  // ---------- Registro de entidades ----------
  G.addBuilding = function (type, owner, x, y, done, id, isStatic, lvl) {
    if (id === undefined) id = owner === 'p' ? S.nextId++ : botId++;
    const b = new PK.Building({ id, type, owner, x, y, done, static: isStatic, lvl });
    G.buildings.push(b); G.bById.set(id, b);
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
      const k = W.idx(x + i, y + j);
      W.bAt[k] = id;
      if (!b.def.walkable) W.block[k] = 2;
    }
    if (owner === 'p') capsDirty = true;
    G.blockVer++;
    return b;
  };
  G.removeBuilding = function (b) {
    if (b.owner === 'p' && PK.Logi && S.logi) PK.Logi.onRemove(b);
    for (const id of b.workers) { const u = G.uById.get(id); if (u) { u.inside = false; placeOutside(u, b); u.task = null; } }
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
      const k = W.idx(b.x + i, b.y + j);
      W.bAt[k] = -1;
      if (W.block[k] === 2) W.block[k] = 0;
    }
    G.buildings.splice(G.buildings.indexOf(b), 1);
    G.bById.delete(b.id);
    if (b.owner === 'p') capsDirty = true;
    G.blockVer++;
    if (G.sel && G.sel.type === 'building' && G.sel.id === b.id) G.sel = null;
  };
  // Edificio de otro jugador: no pisa lo que ya existe y empuja fuera a quien esté parado encima.
  G.addRemoteBuilding = function (type, owner, x, y, done, id, lvl) {
    const def = D.BUILD[type];
    if (!def) return null;
    for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) {
      if (!W.inb(x + i, y + j) || W.bAt[W.idx(x + i, y + j)] >= 0) return null;
    }
    const b = G.addBuilding(type, owner, x, y, done, id, true, lvl);
    b.remote = true;
    if (!def.walkable) for (const u of G.units) {
      const tx = Math.floor(u.x), ty = Math.floor(u.y);
      if (!u.inside && !u.remote && tx >= x && tx < x + b.w && ty >= y && ty < y + b.h) placeOutside(u, b);
    }
    return b;
  };
  G.removeUnit = function (u) {
    G.units.splice(G.units.indexOf(u), 1);
    G.uById.delete(u.id);
    if (G.sel && G.sel.type === 'unit' && G.sel.id === u.id) G.sel = null;
  };
  // Borra todo lo de un dueño (cuando un reino simulado pasa a ser un jugador real).
  G.clearOwner = function (owner, onlyBuildings) {
    for (const b of G.buildings.filter(o => o.owner === owner)) G.removeBuilding(b);
    if (!onlyBuildings) for (const u of G.units.filter(o => o.owner === owner)) G.removeUnit(u);
  };
  G.addUnit = function (o) {
    if (o.id === undefined) o.id = o.owner === 'p' ? S.nextId++ : botId++;
    const u = new PK.Unit(o);
    G.units.push(u); G.uById.set(u.id, u);
    return u;
  };

  function setupPlayer() {
    const [hx, hy] = D.PLAYER_HOME;
    W.reveal(hx, hy, D.START_REVEAL);
    const tc = G.addBuilding('tc', 'p', hx - 2, hy - 2, true);
    for (let i = 0; i < 3; i++) G.spawnVillager(tc);
  }

  // Reinos vecinos: pueblo fijo + aldeanos que recolectan en las zonas comunes (y las agotan).
  function setupBots() {
    for (const bot of D.BOTS) {
      if (bot.human) continue; // los reinos de jugadores reales llegan desde el servidor
      const [hx, hy] = bot.home;
      const rng = U.rng(U.strHash(bot.id));
      const lv = () => 1 + Math.floor(rng() * 5);
      G.addBuilding('tc', bot.id, hx - 2, hy - 2, true, undefined, true, 4 + Math.floor(rng() * 3));
      const place = (type, ang, dist) => {
        const def = D.BUILD[type];
        const p = W.findFreeRect(hx + Math.cos(ang) * dist - def.w / 2, hy + Math.sin(ang) * dist - def.h / 2, def.w, def.h, 6, true);
        return p ? G.addBuilding(type, bot.id, p[0], p[1], true, undefined, true, lv()) : null;
      };
      for (let i = 0; i < 5; i++) place('house', i * 1.3 + rng() * 0.4, 5.5 + rng() * 1.5);
      place('mill', 2.2 + rng(), 7.5);
      const farms = [place('farm', 3.0, 9), place('farm', 3.8, 9.5)].filter(Boolean);
      place('warehouse', 5.9, 9);
      if (bot.id !== 'b2') place('market', 5.2, 8);
      if (bot.id === 'b1') { place('barracks', 0.6, 9); place('tower', 1.6, 8); place('tower', 4.6, 7); }
      if (bot.id === 'b3') { place('library', 0.3, 9); place('tower', 2.6, 6.5); }
      if (bot.id === 'b2') { place('sawmill', 5.6, 8.5); place('guild', 0.8, 9); }
      if (bot.id === 'b0') { place('granary', 0.9, 8); place('tower', 2.2, 10); }
      for (const f of farms) G.addUnit({ owner: bot.id, x: f.x + 1.5, y: f.y + 1.5, task: { t: 'farm', b: f.id } });
      // campamentos en las zonas comunes, del lado que mira a su pueblo
      bot.zones.forEach((zid, zi) => {
        const z = W.zones.find(o => o.id === zid);
        if (!z) return;
        let dx = hx - z.cx, dy = hy - z.cy;
        const l = Math.hypot(dx, dy); dx /= l; dy /= l;
        const type = z.type === 'tree' ? 'lumber' : z.type === 'berry' || z.type === 'deer' ? 'mill' : 'mining';
        const p = W.findFreeRect(z.cx + dx * (z.r + 2.5) - 1, z.cy + dy * (z.r + 2.5) - 1, 2, 2, 8, true);
        if (!p) return;
        const camp = G.addBuilding(type, bot.id, p[0], p[1], true, undefined, true, lv());
        const res = D.NODES[z.type].res;
        const count = zi === 0 ? 3 : 2;
        for (let i = 0; i < count; i++) {
          const n = W.nearestNode(res, camp.cx, camp.cy, 30, bot.id, { zone: zid });
          G.addUnit({ owner: bot.id, x: camp.x + 0.5 + i * 0.4, y: camp.y + 2.5, task: n ? { t: 'gather', node: n.id, res, zone: zid } : null });
        }
      });
    }
  }

  function restore(save) {
    W.loadNodes(save.nodes);
    W.loadFog(save.fog);
    if (!W.fogCount) W.reveal(D.PLAYER_HOME[0], D.PLAYER_HOME[1], D.START_REVEAL);
    for (const p of W.pois) { const st = S.pois[p.id]; if (st && st.d && p.kind === 'camp') W.poiFree(p); }
    for (const o of save.buildings || []) {
      const b = G.addBuilding(o.type, 'p', o.x, o.y, o.done, o.id, false, o.lvl);
      Object.assign(b, { progress: o.progress, workers: o.workers || [], queue: o.queue || [], qt: o.qt || 0, prodAcc: o.prodAcc || 0, rally: o.rally || null, upg: o.upg || null, inb: o.inb || {}, outb: o.outb || {}, sinReserva: !!o.sinReserva, rama: o.rama || undefined });
      if (b.done) W.reveal(b.cx, b.cy, G.sight(b));
    }
    for (const o of save.units || []) G.addUnit(o);
    for (const b of G.buildings) b.workers = b.workers.filter(id => G.uById.get(id) && G.uById.get(id).inside);
    for (const u of G.units) {
      if (u.task && u.task.t === 'farm') { const b = G.bById.get(u.task.b); if (b && b.farmer === null) b.farmer = u.id; }
      if (u.inside && !G.buildings.some(b => b.workers.includes(u.id))) { u.inside = false; u.task = null; }
    }
  }

  // ---------- Niveles y efectos de los edificios ----------
  G.bst = b => (D.BSTATS[b.type] ? D.BSTATS[b.type](b.lvl) : {});
  G.sight = b => (G.bst(b).sight || b.def.sight) + (b.type === 'tower' && b.owner === 'p' ? (PK.Leyendas && S.leyendas ? PK.Leyendas.visionTorre() : 0) + (PK.Vida && S.arbol ? PK.Vida.bono('vision') : 0) : 0);
  G.maxLvl = type => D.maxLevel(type, S.era) + (type === 'farm' && PK.Vida && S.arbol ? PK.Vida.bono('farmLvl') : 0);
  G.slots = b => (G.bst(b).slots || b.def.slots || 0) + (b.owner === 'p' && PK.Vida && S && S.arbol ? PK.Vida.bono('slots_' + b.type) : 0);
  const mine = type => G.buildings.filter(b => b.owner === 'p' && b.done && (!type || b.type === type));
  const best = (type, key) => mine(type).reduce((m, b) => Math.max(m, G.bst(b)[key] || 0), 0);
  G.best = best;
  const wish = k => (PK.Exp ? PK.Exp.wishMult(k) : 1);
  // pasivas de los héroes que gobiernan un edificio (js/heroes.js)
  const hp = (k, b) => (PK.Heroes && S && S.heroes ? PK.Heroes.pasiva(k, b) : 0);
  // modificadores pasajeros de los eventos (life.js, H8): cosecha, langostas, cometa, fiebre, gremio…
  const lm = k => (PK.Life && PK.Life.mod ? PK.Life.mod(k) : 1);
  // lugares legendarios (leyendas.js, H6): +5% de un recurso
  const ley = res => (PK.Leyendas && S && S.leyendas ? PK.Leyendas.recurso(res) : 0);
  // Fase 3 (js/vida.js): árbol 2.0, cartas de era y estación
  const vb = k => (PK.Vida && S ? PK.Vida.bono(k) : 0);
  const vr = (res, kind) => (PK.Vida && S ? PK.Vida.recoleccion(res, kind) : 1);
  G.bono = vb;
  const conMod = cost => { const m = lm('cost') * (1 + vb('cost')); if (m === 1) return cost; const o = {}; for (const r in cost) o[r] = Math.ceil(cost[r] * m); return o; };
  // Mejoras permanentes: decretos y rangos de misiones (G.perk); perkAll suma además las estructuras de Leyendas.
  G.perk = k => {
    let s = (S.perks && S.perks[k]) || 0;
    for (const id of S.decrees || []) s += (D.DECREES[id] && D.DECREES[id].perk[k]) || 0;
    if (PK.Leyendas && S.leyendas) s += PK.Leyendas.perk(k);
    if (PK.Vida) s += PK.Vida.perk(k);
    return s;
  };
  G.perkAll = k => G.perk(k) + D.LEGEND_B.reduce((s, t) => s + best(t, k), 0);
  const eclipse = () => (PK.Life && PK.Life.eclipse ? 1.5 : 1);
  // la Maravilla, cualquiera de las cinco (la vieja de 4×4 y las 4 de la Fase 3): +3% a todo por nivel
  const maravBonus = () => D.WONDERS.reduce((m, t) => Math.max(m, best(t, 'allBonus')), 0);
  G.maravilla = () => G.buildings.find(b => b.owner === 'p' && D.WONDERS.includes(b.type)) || null;
  // distancia en casillas entre dos rectángulos (0 si se tocan)
  const rectDist = (ax, ay, aw, ah, bx, by, bw, bh) => Math.max(Math.max(bx - (ax + aw), ax - (bx + bw), 0), Math.max(by - (ay + ah), ay - (by + bh), 0));
  G.rectDist = rectDist;

  // ---------- Recursos y multiplicadores ----------
  G.lvl = id => (S.techs[id] || 0);
  G.eraMult = () => 1 + 0.05 * (S.era - 1); // solo afecta la fuerza del ejército
  G.guildMult = () => (S.guild && S.guild.joined ? 1 + 0.03 * S.guild.stage + best('guild', 'guildBonus') : 1);
  G.globalMult = () => G.guildMult() * (1 + maravBonus()) * (1 + 0.01 * S.relics) * (PK.Life ? PK.Life.buff * lm('gather') : 1) * wish('harvest') * (1 + G.perkAll('gatherP')) * G.fiestaMult();
  const TECH_FOR = { wood: 'axes', food: 'harvest', stone: 'picks', gold: 'picks', ore: 'picks', marble: 'picks', gems: 'picks' };
  const RES_NODE = { wood: 'tree', food: 'berry', stone: 'stone', gold: 'gold', ore: 'ore', marble: 'marble', gems: 'gems', fibra: 'palma', salitre: 'salitral', especias: 'especia' };
  // Fase 9: el reloj de la marea. En el cálculo sin conexión es la hora simulada (G.tSim), así da lo mismo que en vivo.
  G.ahora = () => (G.offline && G.tSim ? G.tSim : Date.now());
  G.mareaBaja = () => D.mareaBaja(G.ahora());
  const dropMult = u => 1 + 0.1 * (((u && u.dl) || 1) - 1);
  G.gatherRate = function (owner, res, u, kind) {
    const nk = kind || RES_NODE[res], base = D.NODES[nk].rate;
    if (owner !== 'p') return base;
    const tech = nk === 'deer' ? (1 + 0.2 * G.lvl('hunting')) * (1 + hp('hunt')) : 1 + 0.15 * G.lvl(TECH_FOR[res]);
    return base * tech * dropMult(u) * G.globalMult() * (1 + ley(res)) * vr(res, nk);
  };
  // Muelle de pesca (V9): rinde según el agua que lo rodea; la Cosecha eficiente no le suma, Pesca con redes sí.
  G.MUELLE_RATE = 0.3;
  G.aguaMuelle = function (b) {
    if (b._agua !== undefined) return b._agua;
    let n = 0;
    for (let y = b.y - 3; y < b.y + b.h + 3; y++) for (let x = b.x - 3; x < b.x + b.w + 3; x++) if (W.inb(x, y) && W.terrain[W.idx(x, y)] === 4) n++;
    return (b._agua = U.clamp(n / 24, 0.25, 1.3));
  };
  G.esGranja = b => !!b && (b.type === 'farm' || b.type === 'muelle' || !!b.def.farmRes);
  G.granjaRes = b => (b && b.def.farmRes) || 'food'; // las Salinas del mar (pk-28) dan salitre
  G.SALINAS_RATE = 0.16;
  // en el mar la pesca sigue a la marea: 0,75 con bajamar y 1,25 con pleamar
  const mareaPesca = () => (G.enMar() ? 0.75 + 0.5 * D.marea(G.ahora()) : 1);
  G.farmRate = function (owner, b, u) {
    if (owner !== 'p') return D.FARM_RATE;
    if (b && b.def.farmRes) return G.SALINAS_RATE * G.aguaMuelle(b) * (1 + (G.bst(b).farm || 0)) * dropMult(u) * G.globalMult();
    if (b && b.type === 'muelle') return mareaPesca() * G.MUELLE_RATE * G.aguaMuelle(b) * (1 + (G.bst(b).farm || 0)) * (1 + vb('muelle')) * (1 + G.cerca(b)) * dropMult(u) * G.globalMult() * (1 + ley('food')) * vr('food');
    return D.FARM_RATE * (1 + G.cerca(b)) * (1 + 0.15 * G.lvl('harvest')) * (1 + (b ? G.bst(b).farm || 0 : 0)) * dropMult(u) * G.globalMult() * lm('farm') * (1 + ley('food')) * vr('food', 'farm');
  };
  // Bonos por cercanía (V5, D.CERCANIA en datos-vida.js): un edificio rinde más con un vecino de cierto tipo. Se
  // recalcula cuando cambia algo del mapa (G.blockVer sube al construir, terminar, mover o demoler).
  G.cerca = function (b) {
    if (!b || b.owner !== 'p' || !D.CERCANIA) return 0;
    if (b._cv === G.blockVer && b._cerca !== undefined) return b._cerca;
    let s = 0;
    for (const c of G.cercaDe(b)) s += c.ef;
    b._cv = G.blockVer;
    return (b._cerca = s);
  };
  // [{ c: regla, o: vecino, ef }] de las reglas que cumple (una por regla), para el panel y las líneas del fantasma
  G.cercaDe = function (b, x, y, type) {
    const out = [], t = type || b.type, bx = x === undefined ? b.x : x, by = y === undefined ? b.y : y, def = D.BUILD[t];
    for (const c of D.CERCANIA || []) {
      if (c.a !== t) continue;
      const o = G.buildings.find(o2 => o2 !== b && o2.owner === 'p' && o2.done && c.b.includes(o2.type) && rectDist(bx, by, def.w, def.h, o2.x, o2.y, o2.w, o2.h) <= c.r);
      if (o) out.push({ c, o, ef: c.ef });
    }
    return out;
  };
  G.carryCap = (owner, u) => (owner === 'p' ? 10 + 3 * G.lvl('carts') + (((u && u.dl) || 1) - 1) : 10);
  G.speed = function (owner, u) {
    if (u && u.kind === 'scout') return 2.3 * (1 + best('scout', 'scoutSpeed') + 0.1 * G.lvl('cartography'));
    if (u && u.kind === 'cart') return D.CART.speed * (1 + PK.Logi.cartSpeed());
    return owner === 'p' ? 1.3 * (1 + 0.08 * G.lvl('boots')) * lm('speed') : 1.2;
  };
  G.buildMult = owner => (owner === 'p' ? (1 + 0.2 * G.lvl('architecture')) * wish('build') * (1 + vb('build')) : 1);
  const PROD_TECH = { planks: 'saws', blocks: 'saws', books: 'saws', ingots: 'furnaces', tools: 'furnaces', steel: 'furnaces', machinery: 'furnaces' };
  G.prodMult = (recipe, b) => (1 + 0.2 * G.lvl(PROD_TECH[recipe])) * (1 + (b ? G.bst(b).prod || 0 : 0)) * (1 + maravBonus()) * (1 + (b ? G.cerca(b) : 0)) * (1 + best('sanctum', 'shrineProd')) * wish('craft') * (1 + G.perkAll('craftP')) * eclipse() * G.fiestaMult() * (b && PK.Heroes ? 1 + PK.Heroes.prodEn(b) : 1) * lm('craft') * (PK.Vida && S && S.animo ? PK.Vida.animoMult() : 1) * Math.max(0.5, 1 + vb('c_' + recipe) + (recipe === 'planks' && b && vb('aguaPlanks') && G.junAgua(b) ? vb('aguaPlanks') : 0));
  // ¿El edificio está a 4 casillas o menos del agua? (Molino de agua del árbol)
  G.junAgua = b => { const wd = W.waterDist; if (!wd) return false; for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) if (W.inb(b.x + i, b.y + j) && wd[W.idx(b.x + i, b.y + j)] <= 4) return true; return false; };
  G.researchMult = () => (1 + best('library', 'research') + best('observatory', 'research') + mine('university').slice(0, 2).reduce((s, b) => s + G.bst(b).research, 0) + G.perkAll('researchP') + hp('research')) * eclipse() * lm('research');

  // ---------- Decretos reales y dominio de la era ----------
  G.decreePending = () => D.DECREE_ERAS.filter(e => S.era >= e).length > S.decrees.length;
  G.chooseDecree = function (id) {
    if (!G.decreePending() || !D.DECREES[id] || S.decrees.includes(id)) return false;
    S.decrees.push(id);
    toast('Decreto real: ' + D.DECREES[id].name + '. ' + D.DECREES[id].desc, 'epic');
    if (PK.Sfx) PK.Sfx.play('level');
    G.invalidateCaps();
    return true;
  };
  G.mastery = function () {
    let done = 0, total = 0;
    for (const b of mine()) {
      if (b.def.noUp || b.def.noCap) continue;
      total++;
      if (b.lvl >= G.maxLvl(b.type)) done++;
    }
    return { done, total };
  };
  G.checkMastery = function () {
    if (!S.mastered || S.mastered[S.era] || G.offline) return;
    const m = G.mastery();
    if (m.total < 5 || m.done < m.total) return;
    S.mastered[S.era] = true;
    const r = D.masteryReward(S.era);
    G.give(r);
    G.stat('eras_mastered', 1);
    toast('¡Dominaste la Era ' + U.roman(S.era) + ': todos tus edificios están al máximo! +' + U.fmt(r.gold) + ' de oro, +' + r.gems + ' gemas y +' + r.coins + ' monedas.', 'epic');
    if (PK.Sfx) PK.Sfx.play('era');
  };

  // Capacidad de almacenamiento: el Centro Urbano guarda de todo; el Granero, comida; el Almacén, lo demás.
  function computeCaps() {
    let all = 0, food = 0, goods = 0;
    for (const b of mine()) { const s = G.bst(b); all += s.cap || 0; food += s.capFood || 0; goods += s.capGoods || 0; }
    const k = (1 + 0.08 * G.lvl('storage')) * (1 + vb('capAll'));
    caps = { food: Math.floor((all + food) * k * (1 + vb('capFood'))), goods: Math.floor((all + goods) * k) };
    capsDirty = false;
  }
  G.cap = function (res) {
    if (D.RES[res] && D.RES[res].special) return Infinity; // los tesoros de las mazmorras no ocupan bodega
    if (capsDirty || !caps) computeCaps();
    return res === 'food' ? caps.food : caps.goods;
  };
  G.invalidateCaps = () => { capsDirty = true; };
  // Suma respetando la capacidad. Devuelve cuánto entró.
  G.addRes = function (res, n) {
    const room = Math.max(0, G.cap(res) - (S.res[res] || 0)), add = Math.min(room, n);
    S.res[res] = (S.res[res] || 0) + add;
    if (add < n) G.noteFull(res);
    return add;
  };
  // ¿Está llena la bodega de eso? Los aldeanos esperan en vez de gastar el recurso del mapa.
  G.isFull = res => G.cap(res) !== Infinity && (S.res[res] || 0) >= G.cap(res) - 0.5;
  G.noteFull = function (res) {
    // un solo aviso cada 2 minutos que junta todo lo que se llenó (antes uno por recurso, y se apilaban)
    if (PK.UI && !G.offline) {
      fullWarn.set.add(res);
      // cada 2 minutos las tres primeras veces, después cada 6 (seguía siendo insistente; playtest)
      if (G.time - fullWarn.t > (fullWarn.n >= 3 ? 360 : 120)) {
        fullWarn.t = G.time; fullWarn.n = (fullWarn.n || 0) + 1;
        const list = [...fullWarn.set];
        fullWarn.set.clear();
        const store = list.includes('food') && list.length === 1 ? 'granary' : 'warehouse', has = G.countAll(store) > 0;
        toast('Almacenamiento lleno: ' + list.map(r => D.RES[r].name.toLowerCase()).join(', ') + '. ' + (has ? 'Mejora el Granero, el Almacén o el Centro Urbano.' : 'Construye un ' + D.BUILD[store].name + ' para guardar más.'), 'warn',
          has ? { label: 'Obras', fn: () => PK.UI.openWorks() } : { label: 'Construir', fn: () => PK.UI.openBuild() });
      }
    }
  };

  G.canAfford = function (cost, mult) {
    mult = mult || 1;
    for (const r in cost) if (r !== 'coins' && (S.res[r] || 0) < Math.ceil(cost[r] * mult)) return false;
    return true;
  };
  G.pay = function (cost, mult) {
    mult = mult || 1;
    if (!G.canAfford(cost, mult)) return false;
    for (const r in cost) if (r !== 'coins') S.res[r] -= Math.ceil(cost[r] * mult);
    return true;
  };
  const fullWarn = { t: -1e9, set: new Set() };
  // Recompensas (misiones, cofres, botín): pueden superar la capacidad.
  G.give = function (cost, mult) {
    mult = mult || 1;
    for (const r in cost) {
      if (r === 'coins') PK.Platform.addCoins(Math.round(cost[r] * mult), 'pro-kingdoms');
      else S.res[r] = (S.res[r] || 0) + Math.round(cost[r] * mult);
    }
  };
  G.stat = function (k, n) { S.stats[k] = (S.stats[k] || 0) + n; };
  function gained(res, n, zone, hunt) {
    G.stat('g_' + res, n); G.stat('g_total', n);
    if (hunt) G.stat('hunt', n);
    const z = zone >= 0 ? W.zones[zone] : null;
    // por zona y también por tipo (z_tree): la misión «Al bosque común» pedía z_forest, que nadie registraba
    if (z && z.common) { G.stat('z_' + z.id, n); if (z.type) G.stat('z_' + z.type, n); G.stat('g_common', n); }
  }

  G.deposit = function (u, b) {
    if (u.owner === 'p' && u.carry > 0) {
      const n = G.addRes(u.carryRes, u.carry);
      gained(u.carryRes, n, u.carryZone, u.hunt);
      if (PK.Sfx) PK.Sfx.play('deposit');
    }
    u.carry = 0; u.carryRes = null; u.carryZone = -1; u.hunt = false;
    void b;
  };

  // ---------- Elegir recurso ----------
  // Cuántos aldeanos tuyos tienen asignado cada árbol, mina o arbusto.
  G.gatherers = function () {
    const m = new Map();
    for (const u of G.units) if (u.owner === 'p' && u.task && u.task.t === 'gather') m.set(u.task.node, (m.get(u.task.node) || 0) + 1);
    return m;
  };
  // Cuántos caben cómodos en cada recurso antes de estorbarse (una mina es grande; un árbol, no).
  G.nodeRoom = n => (n.kind === 'tree' || n.kind === 'berry' || n.kind === 'deer' ? 2 : 4);
  // El mejor recurso de ese tipo para alguien parado en (x, y): cerca de él, cerca de su punto de acopio y sin
  // amontonarse con otros aldeanos (antes iban todos al mismo árbol y se chocaban). Busca primero cerca y,
  // si no hay nada, cada vez más lejos: así un aldeano sigue con su tarea cuando se agota lo de al lado.
  // opts: { zone, exclude, used (Map extra de asignaciones), r (primer radio), max (radio máximo) }.
  G.bestNode = function (res, x, y, owner, opts) {
    opts = opts || {};
    const crowd = opts.crowd || G.gatherers(), used = opts.used, drop = G.findDrop(owner, res, x, y);
    let regs = null, best = null;
    for (const R of [opts.r || 16, 34, opts.max || 70]) {
      let bs = 1e9;
      const c0x = Math.max(0, Math.floor((x - R) / W.CH)), c1x = Math.min(W.CW - 1, Math.floor((x + R) / W.CH));
      const c0y = Math.max(0, Math.floor((y - R) / W.CH)), c1y = Math.min(W.CW - 1, Math.floor((y + R) / W.CH));
      for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) for (const n of W.chunkNodes[cy * W.CW + cx]) {
        if (n.dead || D.NODES[n.kind].res !== res || n.id === opts.exclude) continue;
        const d = U.dist(x, y, n.x + 0.5, n.y + 0.5);
        if (d > R) continue;
        if (owner === 'p' && !W.fog[n.y * W.W + n.x]) continue;
        if (opts.zone && (n.zone < 0 || W.zones[n.zone].id !== opts.zone)) continue;
        if (!W.canUse(n, owner)) continue;
        const c = (crowd.get(n.id) || 0) + ((used && used.get(n.id)) || 0), room = G.nodeRoom(n);
        const sc = d + (drop ? 0.7 * U.dist(n.x + 0.5, n.y + 0.5, drop.cx, drop.cy) : 0) + (c >= room ? 8 * (c - room + 1) : c * 1.5) + (n.amount < 15 ? 4 : 0);
        if (sc >= bs) continue;
        if (!W.reachable(n, regs || (regs = W.regionsAt(x, y)))) continue;
        bs = sc; best = n;
      }
      if (best || R >= (opts.max || 70)) break;
    }
    return best;
  };

  G.findDrop = function (owner, res, x, y) {
    let bst = null, bd = 1e9;
    const isla = G.enMar() && PK.Arch ? PK.Arch.islaDe(x, y) : -1; // en el mar, solo los acopios de la misma isla
    for (const b of G.buildings) {
      if (b.owner !== owner || !b.done || !b.def.drop || !b.def.drop.includes(res)) continue;
      if (isla >= 0 && PK.Arch.islaDe(b.cx, b.cy) !== isla) continue;
      const d = U.dist(x, y, b.cx, b.cy) - b.w / 2;
      if (d < bd) { bd = d; bst = b; }
    }
    return bst;
  };

  G.countB = (type, owner) => G.buildings.reduce((s, b) => s + (b.owner === (owner || 'p') && b.type === type && b.done ? 1 : 0), 0);
  G.countAll = type => G.buildings.reduce((s, b) => s + (b.owner === 'p' && b.type === type ? 1 : 0), 0);
  G.maxCount = function (type) {
    if (D.BUILD[type].marav && D.WONDERS.some(t => t !== type && G.countAll(t))) return 0; // una sola Maravilla
    const m = D.BUILD[type].max; return m === undefined ? Infinity : typeof m === 'function' ? m(S.era) : m; };
  G.levelCount = (lvl, type, recipe) => G.buildings.reduce((s, b) => s + (b.owner === 'p' && b.done && b.lvl >= lvl && (!type || b.type === type) && (!recipe || b.def.recipe) ? 1 : 0), 0);
  G.villagers = () => G.units.filter(u => u.owner === 'p' && u.kind === 'v');
  G.villagerCount = () => G.units.reduce((s, u) => s + (u.owner === 'p' && u.kind === 'v' ? 1 : 0), 0);
  G.scoutCount = () => G.units.reduce((s, u) => s + (u.owner === 'p' && u.kind === 'scout' ? 1 : 0), 0);
  G.pop = () => G.units.reduce((s, u) => s + (u.owner === 'p' && u.kind !== 'cart' ? 1 : 0), 0) + PK.Social.armyPop();
  G.popCap = function () {
    let c = 0;
    for (const b of mine()) c += (G.bst(b).pop || 0) + (b.type === 'house' ? G.cerca(b) : 0); // casa junto a una plaza o fuente: +1
    return Math.min(c, D.maxPop(S.era));
  };

  // ---------- Maestros de obras y mejoras ----------
  G.builders = () => 1 + G.countB('builder');
  G.buildersBusy = () => G.buildings.reduce((s, b) => s + (b.owner === 'p' && b.upg ? 1 : 0), 0);
  G.upCost = b => conMod(D.upCost(b.type, b.lvl));
  G.upTime = b => D.upTime(b.type, b.lvl) * Math.max(0.5, 1 - 0.05 * G.lvl('engineering')) * (1 - Math.min(0.4, G.perkAll('upgradeP'))) * (1 - Math.min(0.3, hp('upTime', b))) / U.clamp(1 + vb('upSpeed'), 0.8, 1.5);
  G.canUpgrade = function (b) {
    if (b.def.noUp) return { ok: false, why: 'Este edificio no tiene mejoras.' };
    if (!b.done) return { ok: false, why: 'Primero termina de construirlo.' };
    if (b.upg) return { ok: false, why: 'Ya se está mejorando.' };
    if (b.lvl >= G.maxLvl(b.type)) return { ok: false, max: true, why: 'Nivel máximo en tu era. Avanza de era para subir más.' };
    if (G.buildersBusy() >= G.builders()) return { ok: false, busy: true, why: 'Todos tus Maestros de Obras están ocupados.' };
    if (!G.canAfford(G.upCost(b))) return { ok: false, why: 'Recursos insuficientes.' };
    return { ok: true };
  };
  G.upgrade = function (b) {
    const c = G.canUpgrade(b);
    if (!c.ok) { toast(c.why, 'warn'); return false; }
    G.pay(G.upCost(b));
    b.upg = { t: 0, total: G.upTime(b) };
    if (PK.Notify) PK.Notify.suggest(b.upg.total);
    toast('Un Maestro de Obras empieza a mejorar ' + b.def.name + ' a nivel ' + (b.lvl + 1) + '.', 'good');
    return true;
  };
  G.cancelUpgrade = function (b) {
    if (!b.upg) return;
    b.upg = null;
    G.give(G.upCost(b), 0.5);
    toast('Mejora cancelada: recuperaste la mitad.', 'info');
  };
  G.speedUpCost = b => (b.upg ? Math.max(1, Math.ceil((b.upg.total - b.upg.t) / 600)) : 0);
  G.speedUp = function (b) {
    const n = G.speedUpCost(b);
    if (!n) return;
    if (!PK.Platform.spendCoins(n, 'speedup')) { toast('No tienes monedas suficientes.', 'warn'); return; }
    b.upg.t = b.upg.total;
    G.updateTimers(0);
  };
  // Empujón: si a una obra le queda un minuto o menos, se termina gratis al instante (una vez por obra).
  G.NUDGE_SEC = 60;
  G.canNudge = b => !!(b && b.owner === 'p' && b.upg && !b.upg.nudged && b.upg.total - b.upg.t <= G.NUDGE_SEC);
  G.nudge = function (b) {
    if (!G.canNudge(b)) return;
    b.upg.nudged = true;
    b.upg.t = b.upg.total;
    toast('¡Empujón! Tus obreros apuraron el paso y terminaron la mejora de ' + b.def.name + '.', 'good');
    G.updateTimers(0);
  };
  // Horas extra: lo que sobra en las bodegas (comida, madera y piedra) se paga en jornales para adelantar el
  // avance de era o una mejora larga. Cada pago en el mismo reloj cuesta un 30% más y hay un tope por reloj
  // (la era: 8 x 10%; una mejora: 4 x 12,5%). Es el sumidero de excedentes que pedía el playtest: desde la
  // Era II las bodegas se llenaban y la espera de la Era III no tenía nada que hacer. El costo sale de la
  // capacidad (12% de cada bodega), así acompaña a las eras sin tabla aparte. t.ot cuenta los pagos.
  G.OT_RES = ['food', 'wood', 'stone'];
  G.otInfo = function (kind, b) {
    const t = kind === 'era' ? S.eraProg : b && b.owner === 'p' ? b.upg : null;
    if (!t || (kind !== 'era' && t.total < 120)) return null;
    const max = kind === 'era' ? 8 : 4, n = t.ot || 0, left = t.total - t.t;
    const skip = Math.min(left, t.total * (kind === 'era' ? 0.1 : 0.125)), k = Math.pow(1.3, n), cost = {};
    for (const r of G.OT_RES) cost[r] = Math.max(10, Math.round((G.cap(r) * 0.12 * k) / 10) * 10);
    const avail = n < max && left > 30;
    return { n, max, skip, cost, avail, ok: avail && G.canAfford(cost) };
  };
  G.overtime = function (kind, b) {
    const o = G.otInfo(kind, b);
    if (!o || !o.avail) return false;
    if (!G.pay(o.cost)) { toast('Faltan recursos para pagar las horas extra.', 'warn'); return false; }
    const t = kind === 'era' ? S.eraProg : b.upg, at = kind === 'era' ? G.buildings.find(o2 => o2.owner === 'p' && o2.type === 'tc') : b;
    t.ot = o.n + 1; t.t += o.skip;
    G.stat('overtime', 1);
    toast('¡Horas extra! ' + (kind === 'era' ? 'El avance a la Era ' + U.roman(S.eraProg.to) : 'La mejora de ' + b.def.name) + ' se adelanta ' + U.fmtTime(o.skip) + '.', 'good');
    if (at && PK.Render.burst) PK.Render.burst(at.cx, at.cy, [232, 184, 74], 30);
    if (PK.Sfx) PK.Sfx.play('build');
    G.updateTimers(0);
    return true;
  };
  // Fiesta del pueblo (Centro Urbano, desde la Era II): otro sumidero de excedentes, para cuando no hay reloj que
  // adelantar con horas extra (playtest: «a mitad de la Era II no hay en qué gastar»). Cuesta el 15% de las
  // bodegas de comida, madera, piedra y oro, +40% por cada fiesta del mismo día, y da +25% de recolección y de
  // talleres por 5 minutos. Con Date.now(), como los deseos del pozo. El servidor tolera 2,5x (LIM.slack).
  G.FIESTA = { p: 0.25, dur: 300, res: ['food', 'wood', 'stone', 'gold'] };
  G.fiestaMult = () => (S && S.fiesta && S.fiesta.until > Date.now() ? 1 + G.FIESTA.p * (1 + hp('fiesta')) : 1);
  G.fiestaInfo = function () {
    if (S.era < 2) return null;
    const f = S.fiesta || {}, n = f.day === U.dayKey() ? f.n || 0 : 0, k = Math.pow(1.4, n), cost = {};
    const kl = (PK.Leyendas && S.leyendas ? PK.Leyendas.fiestaK() : 1) * (1 - Math.min(0.5, vb('fiesta'))); // Colmena Gigante (H6), cartas
    for (const r of G.FIESTA.res) cost[r] = Math.max(10, Math.round((G.cap(r) * 0.15 * k * kl) / 10) * 10);
    const left = f.until ? Math.max(0, (f.until - Date.now()) / 1000) : 0;
    return { n, cost, left, ok: !left && G.canAfford(cost) };
  };
  G.fiesta = function () {
    const o = G.fiestaInfo();
    if (!o || o.left) return false;
    if (!G.pay(o.cost)) { toast('Faltan recursos para la fiesta.', 'warn'); return false; }
    S.fiesta = { until: Date.now() + G.FIESTA.dur * 1000, n: o.n + 1, day: U.dayKey() };
    G.stat('fiestas', 1);
    if (PK.Vida && PK.Vida.evento) PK.Vida.evento('fiesta', {});
    toast('¡Fiesta en el pueblo! Tu gente recolecta y produce un 25% más durante 5 minutos.', 'epic');
    const tc = G.buildings.find(b => b.owner === 'p' && b.type === 'tc');
    if (tc && PK.Render.burst) for (const c of [[232, 184, 74], [220, 80, 90], [90, 170, 230], [120, 200, 110]]) PK.Render.burst(tc.cx, tc.cy, c, 18);
    if (PK.Sfx) PK.Sfx.play('era');
    return true;
  };
  let fiestaFx = 0;
  function fiestaTick(dt) {
    if (G.fiestaMult() === 1 || G.offline || !PK.Render.burst) return;
    if ((fiestaFx -= dt) > 0) return;
    fiestaFx = 0.9;
    const tc = G.buildings.find(b => b.owner === 'p' && b.type === 'tc');
    const c = [[232, 184, 74], [220, 80, 90], [90, 170, 230], [120, 200, 110], [200, 120, 220]][Math.floor(Math.random() * 5)];
    if (tc) PK.Render.burst(tc.cx + (Math.random() - 0.5) * 4, tc.cy + (Math.random() - 0.5) * 4, c, 8);
  }

  G.finished = [];
  function finishUpgrade(b) {
    b.lvl++; b.upg = null;
    capsDirty = true;
    G.stat('upgrades', 1);
    W.reveal(b.cx, b.cy, G.sight(b));
    G.finished.push(b.def.name + ' ' + b.lvl);
    if (!G.offline) {
      toast(b.def.name + ' subió a nivel ' + b.lvl + '.', 'good');
      if (PK.Render.burst) PK.Render.burst(b.cx, b.cy, null, 40);
      if (PK.Sfx) PK.Sfx.play('level');
    }
    PK.Platform.reportStat('upgrades', S.stats.upgrades);
    if (D.WONDERS.includes(b.type)) PK.Platform.addCoins(10 * b.lvl, 'wonder');
    if (PK.Vida) PK.Vida.invalidar();
  }

  // ---------- Exploración ----------
  G.exploreRange = () => { const r = best('scout', 'range'); return r ? Math.round((r + 4 * G.lvl('cartography') + vb('range')) * (1 + hp('range'))) : 0; };
  G.scoutSight = () => D.SIGHT.scout + (G.lvl('cartography') >= 3 ? 1 : 0);
  G.scoutMax = () => best('scout', 'scouts');
  G.poiState = p => S.pois[p.id] || null;
  G.poiTier = p => D.poiTier(U.dist(p.x + p.w / 2, p.y + p.h / 2, D.PLAYER_HOME[0], D.PLAYER_HOME[1]));
  G.explorePct = () => W.fogCount / (W.W * W.H);

  G.revealAt = function (x, y, r) {
    const idx = W.reveal(x, y, r);
    if (!idx.length) return;
    G.stat('explored', idx.length);
    for (const i of idx) {
      const pid = W.poiAt[i];
      if (pid >= 0) discoverPoi(W.pois[pid]);
    }
    for (const bot of D.BOTS) {
      if (S.flags['seen_' + bot.slot]) continue;
      if (idx.some(i => U.dist(i % W.W, (i / W.W) | 0, bot.home[0], bot.home[1]) < 5)) {
        S.flags['seen_' + bot.slot] = true;
        G.stat('realms_seen', 1);
        toast('Tus exploradores encontraron ' + bot.realm + '.', 'epic');
      }
    }
  };

  function discoverPoi(p) {
    const st = S.pois[p.id] || (S.pois[p.id] = {});
    if (st.f) return;
    st.f = 1;
    const tier = G.poiTier(p), name = D.POI[p.kind].name;
    G.stat('pois_found', 1);
    if (p.kind === 'chest') {
      const r = D.chestReward(tier);
      G.give(r); st.d = 1; G.stat('chests', 1);
      toast('¡Cofre abandonado! ' + Object.keys(r).map(k => '+' + U.fmt(r[k]) + ' ' + D.RES[k].name.toLowerCase()).join(', '), 'epic');
    } else if (p.kind === 'watch') {
      st.d = 1; G.stat('watch_found', 1);
      toast('Atalaya en ruinas: desde lo alto se ve gran parte del mapa.', 'epic');
      G.revealAt(p.x + 0.5, p.y + 0.5, D.POI.watch.reveal);
    } else if (p.kind === 'ruin') toast('Descubriste ' + name + '. Envía aldeanos a excavar.', 'quest');
    else if (p.kind === 'camp') toast('¡Un campamento de bandidos! Fuerza aprox. ' + D.campPower(tier) + '.', 'bad', G.countB('barracks') ? { label: 'Atacar', fn: () => PK.UI.openBarracks('exp', { camp: p.id }) } : null);
    else if (p.kind === 'relic') toast('¡Una reliquia! Llévala a un Monasterio para que dé oro sin parar.', 'epic');
    else if (D.POI[p.kind].dungeon) PK.Exp.found(p);
    else if (p.kind === 'legend') { G.stat('legends_found', 1); toast('¡Un lugar legendario: ' + D.LEYENDAS[p.ley].name + '! Manda a un héroe a investigarlo: ' + D.LEYENDAS[p.ley].bono + '.', 'epic', { label: 'Ver', fn: () => { PK.Render.centerOn(p.x + 1, p.y + 1); G.sel = { type: 'poi', id: p.id }; PK.UI.refreshPanel(true); } }); }
  }

  // ---------- Banderas de exploración (A4 del plan) ----------
  // Hasta 3 banderas en la niebla: el explorador dirigido va hacia ellas antes que a la niebla más cercana.
  // Dirigido hay uno; el Puesto en nivel 5 o Cartografía III suman un segundo. Cuando la casilla de la bandera
  // se descubre, la bandera se quita sola.
  G.BANDERAS_MAX = 3;
  G.banderas = () => S.banderas || (S.banderas = []);
  G.dirigidos = () => Math.min(3, (mine('scout').some(b => b.lvl >= 5) || G.lvl('cartography') >= 3 ? 2 : 1) + vb('dirigido'));
  G.ponerBandera = function (x, y) {
    const fl = G.banderas(), [hx, hy] = D.PLAYER_HOME;
    const i = fl.findIndex(f => U.dist(f[0], f[1], x, y) < 3);
    if (i >= 0) { fl.splice(i, 1); toast('Bandera quitada.', 'info'); return 'quitada'; }
    if (!W.inb(x, y)) return null;
    if (W.fog[W.idx(x, y)]) { toast('Esa zona ya está descubierta: pon la bandera en la niebla.', 'warn'); return null; }
    const R = G.exploreRange();
    if (!R) { toast('Necesitas un Puesto de Exploradores.', 'warn'); return null; }
    if (U.dist(x, y, hx, hy) > R + 2) { toast('Queda fuera del alcance de tus exploradores (' + R + ' casillas): mejora el Puesto de Exploradores.', 'warn'); return null; }
    if (fl.length >= G.BANDERAS_MAX) { toast('Ya tienes ' + G.BANDERAS_MAX + ' banderas: toca una para quitarla.', 'warn'); return null; }
    fl.push([x, y]);
    for (const u of G.units) if (u.owner === 'p' && u.kind === 'scout' && u.task && u.task.t === 'explore') { u.path = []; u.exT = undefined; } // que lo tomen ya
    toast('Bandera puesta: tu explorador irá hacia allá.', 'good');
    return 'puesta';
  };
  // La bandera que sigue ese explorador (o null). Quita las que ya se descubrieron.
  function banderaDe(u) {
    const fl = G.banderas();
    for (let i = fl.length - 1; i >= 0; i--) if (W.fog[W.idx(fl[i][0], fl[i][1])]) { fl.splice(i, 1); if (!G.offline) toast('Tu explorador llegó a la bandera.', 'good'); }
    if (!fl.length) return null;
    const sc = G.units.filter(o => o.owner === 'p' && o.kind === 'scout').sort((a, b) => a.id - b.id), i = sc.indexOf(u);
    return i >= 0 && i < G.dirigidos() ? fl[i % fl.length] : null;
  }
  // Borde de la niebla más cercano a la bandera (por anillos desde ella) y, entre esos, el más cercano al explorador.
  function haciaBandera(u, f, R, frontier) {
    const [hx, hy] = D.PLAYER_HOME, skip = u.skip;
    for (let r = 0; r <= 90; r++) {
      let pick = null, bs = 1e9;
      for (let y = f[1] - r; y <= f[1] + r; y++) for (let x = f[0] - r; x <= f[0] + r; x++) {
        if (Math.max(Math.abs(x - f[0]), Math.abs(y - f[1])) !== r || !W.inb(x, y)) continue;
        const i = y * W.W + x;
        if (W.fog[i] || (skip && skip.has(i)) || U.dist(x, y, hx, hy) > R || !frontier(x, y)) continue;
        const sc = U.dist(x, y, u.x, u.y) + (W.passable(x, y) ? 0 : 3);
        if (sc < bs) { bs = sc; pick = [x, y]; }
      }
      if (pick) return pick;
    }
    return null;
  }

  // Exploradores: el borde de la niebla más cercano, dentro del alcance del Puesto de Exploradores.
  G.exploreTarget = function (u) {
    const [hx, hy] = D.PLAYER_HOME, R = G.exploreRange();
    if (!R) return null;
    const fb = banderaDe(u);
    if (fb) { const t = haciaBandera(u, fb, R, (x, y) => W.explored(x + 1, y) || W.explored(x - 1, y) || W.explored(x, y + 1) || W.explored(x, y - 1)); if (t) return t; }
    const ux = Math.floor(u.x), uy = Math.floor(u.y), skip = u.skip;
    const frontier = (x, y) => W.explored(x + 1, y) || W.explored(x - 1, y) || W.explored(x, y + 1) || W.explored(x, y - 1);
    for (let r = 1; r <= 60; r++) {
      let pick = null, bs = 1e9;
      for (let y = uy - r; y <= uy + r; y++) for (let x = ux - r; x <= ux + r; x++) {
        if (Math.max(Math.abs(x - ux), Math.abs(y - uy)) !== r || !W.inb(x, y)) continue;
        const i = y * W.W + x;
        if (W.fog[i] || (skip && skip.has(i)) || U.dist(x, y, hx, hy) > R || !frontier(x, y)) continue;
        const sc = U.hash(x, y, u.id) + (W.passable(x, y) ? 0 : 0.6);
        if (sc < bs) { bs = sc; pick = [x, y]; }
      }
      if (pick) return pick;
    }
    return null;
  };
  G.exploreDone = function (u) {
    if (u.doneMsg) return;
    u.doneMsg = true;
    // una vez por alcance, no en cada carga (u.doneMsg no se guarda): el aviso volvía cada vez que abrías el juego
    const range = G.exploreRange();
    if (S.flags.scoutDoneR === range) return;
    S.flags.scoutDoneR = range;
    toast('Tu explorador ya recorrió todo su alcance. Mejora el Puesto de Exploradores para llegar más lejos.', 'info');
  };
  G.trainScout = function (b) {
    if (G.scoutCount() + b.queue.length >= G.scoutMax()) { toast('Ya tienes los exploradores que permite el Puesto (mejóralo para más).', 'warn'); return false; }
    if (!G.pay(D.SCOUT.cost)) { toast('Recursos insuficientes.', 'warn'); return false; }
    b.queue.push('scout');
    return true;
  };

  // Ruinas: se excavan con aldeanos; más lejos, más trabajo y mejor premio.
  G.digProgress = function (p, dt) {
    const st = S.pois[p.id], tier = G.poiTier(p);
    st.p = (st.p || 0) + dt / (D.POI.ruin.work * (1 + 0.5 * tier));
    if (st.p >= 1 && !st.d) {
      st.d = 1; st.p = 1;
      const r = D.ruinReward(tier);
      G.give(r); G.stat('ruins_done', 1);
      if (tier >= 2) G.revealAt(p.x + 1, p.y + 1, 8); // un mapa antiguo entre los escombros
      if (PK.Aventura) PK.Aventura.mapaDeRuina(p); // y a veces, un mapa del tesoro (H7)
      toast('¡Excavación terminada! ' + Object.keys(r).map(k => '+' + U.fmt(r[k]) + ' ' + (k === 'coins' ? 'monedas' : D.RES[k].name.toLowerCase())).join(', '), 'epic');
    }
  };
  G.relicSlots = () => best('monastery', 'relics');
  G.claimRelic = function (p) {
    const st = G.poiState(p);
    if (!st || !st.f || st.d) return false;
    if (!G.countB('monastery')) { toast('Necesitas un Monasterio (Era III).', 'warn'); return false; }
    if (S.relics >= G.relicSlots()) { toast('Tu Monasterio no tiene lugar: mejóralo para guardar más reliquias.', 'warn'); return false; }
    st.d = 1; S.relics++;
    G.stat('relics', 1);
    toast('La reliquia descansa en tu Monasterio: +oro sin parar y +1% a todo.', 'epic');
    return true;
  };
  // Los talleres no gastan un insumo por debajo de la reserva que fija el Capataz (parte de la bodega),
  // así no dejan al reino sin madera ni piedra para construir. Si lo que fabrican escasea, la reserva baja.
  // Con «Producir igual» (b.sinReserva) ese taller la ignora.
  G.reserveOk = function (cost, out, b) {
    if (b && b.sinReserva) return true;
    let rv = S.auto ? S.auto.reserve || 0 : 0;
    if (out && S.res[out] < 0.05 * G.cap(out)) rv /= 3;
    for (const k in cost) if (S.res[k] - cost[k] < rv * G.cap(k)) return false;
    return true;
  };
  // ¿El taller está parado por la reserva? El primer insumo que retiene ({res, have, keep}) o null. Antes solo
  // decía «Sin trabajadores» y la Fundición quedaba vacía con 1.650 de hierro (B4 del plan).
  G.reservaDe = function (b) {
    if (!b || !b.def.recipe || b.sinReserva) return null;
    const rc = D.RECIPES[b.def.recipe], out = Object.keys(rc.out)[0];
    let rv = S.auto ? S.auto.reserve || 0 : 0;
    if (!rv) return null;
    if (S.res[out] < 0.05 * G.cap(out)) rv /= 3;
    for (const k in rc.in) { const keep = rv * G.cap(k); if (S.res[k] - rc.in[k] < keep) return { res: k, have: S.res[k], keep }; }
    return null;
  };
  G.reservaText = r => 'En reserva: falta ' + D.RES[r.res].name.toLowerCase() + ' (tienes ' + U.fmt(Math.floor(r.have)) + '; la reserva guarda ' + U.fmt(Math.ceil(r.keep)) + ')';
  G.relicGold = () => S.relics * best('monastery', 'relicGold') * (1 + 0.25 * G.lvl('faith')) * (1 + hp('relicGold')) * (1 + vb('relic')); // por minuto

  // ---------- Órdenes ----------
  G.release = function (u) {
    if (u.inside) {
      for (const b of G.buildings) {
        const i = b.workers.indexOf(u.id);
        if (i >= 0) { b.workers.splice(i, 1); placeOutside(u, b); }
      }
      u.inside = false;
    }
    if (u.task && u.task.t === 'farm') { const b = G.bById.get(u.task.b); if (b && b.farmer === u.id) b.farmer = null; }
    u.task = null; u.path = []; u.phase = 'go'; u.fails = 0; u.wait = 0;
  };
  function placeOutside(u, b) {
    const p = W.freeAround(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, b.x + b.w, b.y + b.h);
    u.x = p[0] + 0.5; u.y = p[1] + 0.5;
  }
  G.assign = function (u, task) {
    const keepCarry = u.carry;
    u.hold = false;
    if (u.task !== task) G.release(u);
    u.carry = keepCarry;
    u.task = task; u.phase = 'go'; u.path = []; u.fails = 0;
    if (task.t === 'farm') { const b = G.bById.get(task.b); if (b) b.farmer = u.id; }
  };

  G.command = function (units, target, silent) {
    units = units.filter(u => u.owner === 'p' && u.kind !== 'cart'); // las carretas se manejan solas
    if (!units.length) return false;
    // una orden tuya (no del Capataz) queda marcada: el Capataz no la cambia y el aldeano la sigue aunque se
    // agote lo de al lado
    if (!silent) for (const u of units) u.hold = false;
    const mark = t => { if (!silent && t) t.m = 1; return t; };
    const scouts = units.filter(u => u.kind === 'scout');
    if (scouts.length) {
      const tx = target.kind === 'tile' ? target.x : target.obj.x, ty = target.kind === 'tile' ? target.y : target.obj.y;
      scouts.forEach(u => { G.assign(u, { t: 'move', then: 'explore' }); u.doneMsg = false; moveUnit(u, tx, ty); });
      units = units.filter(u => u.kind === 'v');
      if (!units.length) return true;
    }
    if (target.kind === 'poi') {
      const p = target.obj, st = G.poiState(p);
      if (p.kind === 'ruin' && st && !st.d) { for (const u of units) G.assign(u, mark({ t: 'dig', poi: p.id })); return true; }
      if (p.kind === 'relic' && st && !st.d) { G.claimRelic(p); return true; }
      return G.command(units, { kind: 'tile', x: p.x + p.w, y: p.y + p.h }, silent);
    }
    if (target.kind === 'node') {
      const n = target.obj;
      if (!W.canUse(n, 'p')) { if (!silent) toast('Ese recurso pertenece a ' + W.zoneOf(n).name + '.', 'warn'); return false; }
      if (n.dead) return G.command(units, { kind: 'tile', x: n.x, y: n.y }, silent);
      // el primero va justo ahí; si ya hay gente de sobra, los demás se reparten por los vecinos del mismo tipo
      const res = W.nodeRes(n), crowd = G.gatherers(), used = new Map();
      for (const u of units) if (u.task && u.task.t === 'gather') crowd.set(u.task.node, Math.max(0, (crowd.get(u.task.node) || 0) - 1));
      for (const u of units) {
        let tgt = n;
        if ((crowd.get(n.id) || 0) + (used.get(n.id) || 0) >= G.nodeRoom(n)) tgt = G.bestNode(res, n.x + 0.5, n.y + 0.5, 'p', { crowd, used, r: 7, max: 12 }) || n;
        used.set(tgt.id, (used.get(tgt.id) || 0) + 1);
        G.assign(u, mark({ t: 'gather', node: tgt.id, res }));
      }
      return true;
    }
    if (target.kind === 'building') {
      const b = target.obj;
      if (b.owner !== 'p') return G.command(units, { kind: 'tile', x: b.x + b.w, y: b.y + b.h }, silent);
      if (!b.done) return G.command(units, { kind: 'tile', x: b.x + b.w, y: b.y + b.h }, silent); // las obras se levantan solas
      if (G.esGranja(b)) {
        const farms = [b].concat(G.buildings.filter(o => o.owner === 'p' && o.type === b.type && o.done && o !== b).sort((a, c) => U.dist(a.cx, a.cy, b.cx, b.cy) - U.dist(c.cx, c.cy, b.cx, b.cy)));
        let fi = 0;
        for (const u of units) {
          while (fi < farms.length && farms[fi].farmer !== null && farms[fi].farmer !== u.id && G.uById.get(farms[fi].farmer)) fi++;
          if (fi < farms.length) { G.assign(u, mark({ t: 'farm', b: farms[fi].id })); fi++; }
          else G.assign(u, { t: 'move' }), moveUnit(u, b.x + b.w, b.y + b.h);
        }
        return true;
      }
      if (b.def.recipe) {
        if (b.owner === 'p' && PK.Logi && !PK.Logi.supplied(b)) {
          if (!silent) toast(b.def.name + ' está lejos de los almacenes y sin carretas: no le llegarían insumos. Acércalo a 3 casillas de un Almacén o del Centro Urbano, o construye una Carretería.', 'warn',
            G.countB('cartwright') ? { label: 'Logística', fn: () => PK.UI.openLogistics() } : { label: 'Construir', fn: () => PK.UI.openBuild() });
          return false;
        }
        let free = G.slots(b) - b.workers.length;
        for (const u of units) {
          if (free > 0) { G.assign(u, mark({ t: 'work', b: b.id })); free--; }
          else { G.assign(u, { t: 'move' }); moveUnit(u, b.x + b.w, b.y + b.h); }
        }
        if (free < 0 && !silent) toast('No caben más trabajadores.', 'warn');
        return true;
      }
      if (b.def.drop) {
        for (const u of units) {
          const prev = u.task && u.task.t === 'gather' ? u.task : null;
          if (u.carry) G.assign(u, { t: 'deposit', next: prev });
          else { G.assign(u, { t: 'move' }); moveUnit(u, b.x + b.w, b.y + b.h); }
        }
        return true;
      }
      return G.command(units, { kind: 'tile', x: b.x + b.w, y: b.y + b.h }, silent);
    }
    if (!W.explored(target.x, target.y)) { if (!silent) toast('No conoces esa zona. Envía un explorador primero.', 'warn'); return false; }
    // mover en formación
    const spots = [];
    for (let r = 0; spots.length < units.length && r < 6; r++)
      for (let y = target.y - r; y <= target.y + r; y++) for (let x = target.x - r; x <= target.x + r; x++)
        if (Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) === r && W.passable(x, y)) spots.push([x, y]);
    units.forEach((u, i) => { G.assign(u, { t: 'move' }); const s = spots[i] || [target.x, target.y]; moveUnit(u, s[0], s[1]); });
    return true;
  };
  function moveUnit(u, x, y) {
    const r = W.findPath(Math.floor(u.x), Math.floor(u.y), { x0: x, y0: y, x1: x, y1: y, adj: !W.passable(x, y) });
    u.path = r.path;
  }

  G.spawnUnit = function (b, kind) {
    const tx = b.rally && b.rally.kind === 'tile' ? b.rally.x : b.x + b.w + 1, ty = b.rally && b.rally.kind === 'tile' ? b.rally.y : b.y + b.h + 1;
    // con el Centro Urbano encerrado, «sale por la puerta de atrás»: nace en la casilla libre más cercana de afuera
    const p = (b.owner === 'p' && G.encierro && W.nearestInRegion(b.cx, b.cy, G.encierro.out, 48)) || W.freeAround(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, tx, ty, occupied);
    const u = G.addUnit({ owner: b.owner, x: p[0] + 0.5, y: p[1] + 0.5, kind });
    if (b.owner !== 'p' || kind === 'cart') return u;
    if (kind === 'scout') { u.task = { t: 'explore' }; G.stat('scouts_trained', 1); return u; }
    G.stat('villagers_trained', 1);
    if (b.rally) {
      const r = b.rally;
      const tgt = r.kind === 'node' ? { kind: 'node', obj: W.nodes[r.id] } : r.kind === 'building' && G.bById.get(r.id) ? { kind: 'building', obj: G.bById.get(r.id) } : { kind: 'tile', x: r.x, y: r.y };
      G.command([u], tgt, true);
    }
    return u;
  };
  G.spawnVillager = tc => G.spawnUnit(tc, 'v');

  G.train = function (tc, n) {
    n = n || 1;
    let done = 0;
    for (let i = 0; i < n; i++) {
      if (tc.queue.length >= 10) { toast('La cola del Centro Urbano está llena.', 'warn'); break; }
      if (!G.pay(D.VILLAGER.cost)) { toast('Falta comida para entrenar aldeanos.', 'warn'); break; }
      tc.queue.push('villager'); done++;
    }
    return done;
  };
  G.cancelTrain = function (b) {
    if (!b.queue.length) return;
    const k = b.queue.pop();
    G.give(k === 'scout' ? D.SCOUT.cost : D.VILLAGER.cost);
    if (!b.queue.length) b.qt = 0;
  };
  G.trainTime = b => (b.type === 'scout' ? D.SCOUT.time : D.VILLAGER.time / (1 + (G.bst(b).train || 0)) / U.clamp(1 + vb('train'), 0.8, 1.6));

  // ---------- Construcción ----------
  G.isUnlocked = type => D.BUILD[type].era <= S.era && !G.legendLocked(type) && !D.BUILD[type].retirada && !G.logroFalta(type);
  // decoraciones que se ganan (V5): la Columna pide un trofeo de jefe por cada una; el Arco, 10 desafíos (V7)
  G.logroFalta = function (type) {
    const l = D.BUILD[type].logro;
    if (l === 'columna') return Object.values(S.trofeos || {}).reduce((a, n) => a + n, 0) > G.countAll('columna') ? null : 'Vence a un jefe de mazmorra por cada columna.';
    if (l === 'arco') return (S.stats.desafios || 0) >= 10 ? null : 'Cumple 10 desafíos (Libro de Misiones).';
    return null;
  };
  // la Taberna (héroes) se abre con el Cuartel, sin esperar a reclamar la misión l1 (H1 del plan)
  G.legendLocked = type => !!D.BUILD[type].lock && !S.flags['unlock_' + D.BUILD[type].lock] && !(type === 'tavern' && G.countAll('barracks'));
  G.buildCost = type => conMod(D.buildCost(type, G.countAll(type)));
  // Se construye en tu territorio. Los campamentos de acopio también pueden ir en tierra de nadie y junto a
  // las zonas comunes (para recolectar lejos), pero nunca en tierra de otro reino.
  G.OUTPOST = { lumber: 1, mining: 1, mill: 1 };
  // ignorar: el id del edificio que se está mudando (sus propias casillas cuentan como libres)
  G.placeWhy = function (type, x, y, ignorar) {
    const def = D.BUILD[type];
    for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) {
      const tx = x + i, ty = y + j;
      if (!W.inb(tx, ty)) return 'fuera';
      const k = W.idx(tx, ty);
      if (!W.fog[k]) return 'niebla';
      if (W.terrain[k] === 4) return 'agua';
      const propio = ignorar !== undefined && W.bAt[k] === ignorar;
      if ((W.block[k] && !(propio && W.block[k] === 2)) || (W.bAt[k] >= 0 && !propio) || W.belt[k] >= 0 || W.wall[k]) return 'ocupado';
      const o = W.ownerAt(tx, ty);
      if (o !== 'p' && !(G.OUTPOST[type] && !o)) return o ? 'ajeno' : 'libre';
    }
    if ((type === 'muelle' || def.agua) && !G.tocaAgua(x, y, def)) return 'sinAgua';
    if (G.encierra(type, x, y, ignorar)) return 'encierra';
    return null;
  };
  G.tocaAgua = function (x, y, def) {
    for (let j = -1; j <= def.h; j++) for (let i = -1; i <= def.w; i++) if ((i < 0 || j < 0 || i >= def.w || j >= def.h) && W.inb(x + i, y + j) && W.terrain[W.idx(x + i, y + j)] === 4) return true;
    return false;
  };
  // ¿Ese edificio encerraría al Centro Urbano? (B2 del plan: un patio cerrado por casas dejó 93 de 154 aldeanos
  // parados). Compara cuánto se camina desde el borde de los Centros Urbanos antes y después: si se pierde
  // algo más que el propio edificio y un hueco chico, y lo que queda es poco, lo cierra. Un pueblo que ya
  // estaba cerrado (murallas sin puerta) no se traba: solo cuenta lo que este edificio corta. Se recuerda
  // 150 ms por lugar porque el fantasma lo pregunta en cada movimiento del puntero.
  G.blockVer = 0;
  let encBefore = null, encMemo = new Map();
  G.encierra = function (type, x, y, ignorar) {
    const def = D.BUILD[type];
    if (!def || def.walkable) return false;
    const tcs = G.buildings.filter(b => b.owner === 'p' && b.type === 'tc' && b.id !== ignorar);
    if (!tcs.length) return false;
    const now = Date.now(), key = type + ',' + x + ',' + y + ',' + ignorar;
    const m = encMemo.get(key);
    if (m && m.v === G.blockVer && now - m.t < 150) return m.r;
    if (encMemo.size > 200) encMemo.clear();
    const rects = tcs.map(b => [b.x, b.y, b.w, b.h]);
    if (!encBefore || encBefore.v !== G.blockVer || now - encBefore.t > 2000) encBefore = { v: G.blockVer, t: now, n: W.reachCount(rects) };
    const tapa = [], libre = [];
    for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) tapa.push(W.idx(x + i, y + j));
    const mv = ignorar !== undefined && G.bById.get(ignorar);
    if (mv) for (let j = 0; j < mv.h; j++) for (let i = 0; i < mv.w; i++) libre.push(W.idx(mv.x + i, mv.y + j));
    const antes = encBefore.n + libre.length, tope = Math.min(antes - tapa.length - 30, Math.max(600, antes * 0.5));
    const r = tope > 0 && W.reachCount(rects, tapa, libre, tope) < tope;
    encMemo.set(key, { v: G.blockVer, t: now, r });
    return r;
  };
  // Si igual quedó encerrado (una partida de antes, árboles que rebrotaron, murallas), se detecta cada 5 s:
  // las regiones que tocan el Centro Urbano son chicas, no queda ningún recurso a su alcance y afuera hay
  // tierra grande. G.encierro = { out: la región de afuera, puertas: los edificios que tocan el patio y el
  // exterior a la vez (mover o demoler uno de ellos abre el paso) }. Con eso los aldeanos nuevos nacen afuera
  // (spawnUnit), el rescate los saca hacia afuera (entities.js) y el aviso de ociosos no dice «explora».
  G.encierro = null;
  let encAvisoT = -1e9;
  G.checkEncierro = function () {
    const prev = G.encierro;
    G.encierro = encierroAhora();
    S.flags.encerrado = G.encierro ? 1 : 0;
    if (G.offline || !PK.UI) return;
    if (G.encierro && (!prev || Date.now() - encAvisoT > 180000)) {
      encAvisoT = Date.now();
      const n = G.encierro.puertas.length;
      toast('Tu Centro Urbano quedó encerrado por edificios. ' + (n ? 'Mueve o demuele uno de los marcados en rojo.' : 'Abre una puerta en la muralla o despeja el paso.'), 'warn',
        n ? { label: 'Ver edificios', fn: G.verPuertas } : null);
    } else if (!G.encierro && prev) toast('Tu Centro Urbano volvió a tener salida.', 'good');
  };
  G.verPuertas = function () {
    const b = G.encierro && G.bById.get(G.encierro.puertas[0]);
    if (!b) return;
    G.sel = { type: 'building', id: b.id };
    PK.Render.centerOn(b.cx, b.cy);
    if (PK.UI) PK.UI.refreshPanel(true);
  };
  function encierroAhora() {
    const tcs = G.buildings.filter(b => b.owner === 'p' && b.type === 'tc');
    if (!tcs.length) return null;
    // las casillas que tocan el edificio por un lado (no las esquinas: se camina en 4 direcciones, como las regiones)
    const ring = (b, fn) => { for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) if (((x < b.x || x >= b.x + b.w) !== (y < b.y || y >= b.y + b.h)) && W.inb(x, y)) fn(W.regionAt(x, y)); };
    const casa = new Set();
    for (const b of tcs) ring(b, l => { if (l) casa.add(l); });
    const big = W.biggestRegion();
    if (casa.has(big.l) || big.n < 600 || [...casa].some(l => W.regionSize(l) >= 600)) return null;
    if (casa.size) for (const n of W.nodes) if (!n.dead && W.fog[W.idx(n.x, n.y)] && W.canUse(n, 'p') && W.reachable(n, casa)) return null; // todavía hay qué recolectar adentro
    const puertas = [];
    for (const b of G.buildings) {
      if (b.owner !== 'p' || b.type === 'tc' || b.def.walkable) continue;
      let adentro = false, afuera = false;
      ring(b, l => { if (casa.has(l)) adentro = true; else if (l === big.l) afuera = true; });
      if (adentro && afuera) puertas.push(b.id);
    }
    return { out: big.l, puertas };
  }
  G.canPlace = (type, x, y, ignorar) => !G.placeWhy(type, x, y, ignorar);
  // Por qué no se puede: antes en la computadora solo decía «No se puede construir ahí».
  G.placeText = why => {
    if (why === 'libre') S.flags.verTerr = 1; // desde ahora se ve el botón Territorio (ui.js, menú progresivo)
    return G.PLACE_TEXT[why] || 'No se puede construir ahí.';
  };
  G.PLACE_TEXT = {
    libre: 'Esa tierra no es tuya: reclama la parcela en Territorio (solo los campamentos van en tierra de nadie).',
    ajeno: 'Esa tierra pertenece a otro reino.',
    niebla: 'Esa zona sigue en la niebla: explórala primero.',
    agua: 'No se puede construir sobre el agua.',
    ocupado: 'Ahí hay algo (árboles, rocas, un edificio, una cinta o una muralla): busca un lugar despejado.',
    fuera: 'Eso queda fuera del mapa.',
    encierra: 'Así encerrarías a tu pueblo: deja al menos una casilla de paso.',
    sinAgua: 'El muelle va pegado al agua: ponlo en la orilla de un lago o río.',
  };
  G.place = function (type, x, y, builders) {
    if (G.legendLocked(type)) { toast(D.BUILD[type].name + ' se desbloquea con una misión de la rama Leyendas.', 'warn'); return null; }
    if (G.logroFalta(type)) { toast(G.logroFalta(type), 'warn'); return null; }
    if (!G.isUnlocked(type)) { toast('Necesitas la Era ' + U.roman(D.BUILD[type].era) + '.', 'warn'); return null; }
    if (G.countAll(type) >= G.maxCount(type)) { toast('Ya tienes el máximo de ' + D.BUILD[type].name + ' para tu era.', 'warn'); return null; }
    const why = G.placeWhy(type, x, y);
    if (why) { toast(G.placeText(why), 'warn'); return null; }
    const cost = G.buildCost(type);
    if (!G.pay(cost)) { toast('Recursos insuficientes.', 'warn'); return null; }
    const b = G.addBuilding(type, 'p', x, y, false);
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) if (W.road[W.idx(x + i, y + j)]) { W.road[W.idx(x + i, y + j)] = 0; W.roadVer++; }
    for (const u of G.units) {
      if (u.inside) continue;
      const tx = Math.floor(u.x), ty = Math.floor(u.y);
      if (!b.def.walkable && tx >= x && tx < x + b.w && ty >= y && ty < y + b.h) placeOutside(u, b);
    }
    void builders; // las obras se levantan solas (updateBuildings): los aldeanos ya no construyen
    toast('Obra iniciada: ' + b.def.name + ' estará lista en ' + U.fmtTime(b.def.time / G.buildMult('p')) + '.', 'info');
    if (PK.Sfx && !G.offline) PK.Sfx.play('build');
    return b;
  };
  G.demolish = function (b) {
    if (b.owner !== 'p') return;
    if (b.type === 'tc' && G.buildings.filter(o => o.owner === 'p' && o.type === 'tc').length <= 1) { toast('No puedes demoler tu único Centro Urbano.', 'warn'); return; }
    if (!b.done) G.give(G.buildCost(b.type), 0.75 * (1 - b.progress));
    for (const u of G.units) if (u.task && u.task.b === b.id) G.release(u);
    G.removeBuilding(b);
  };
  // Mudar un edificio sin demolerlo: conserva nivel, mejora en curso, obra, cola, trabajadores y depósitos.
  // Cuesta un 10% de lo que pide el edificio base, para que acomodar no sea gratis pero sí mucho más barato que
  // demoler y volver a construir (que además perdía los niveles). Las cintas que llegaban a él se quitan (su
  // recorrido ya no sirve). El Centro Urbano no se muda: de él salen el hogar y las regiones de los aldeanos.
  G.MOVE_NO = { tc: 'El Centro Urbano no se puede mover: es el corazón del reino.' };
  G.moveCost = b => { const c = {}, base = D.BUILD[b.type].cost || {}; for (const r in base) if (r !== 'coins') c[r] = Math.max(5, Math.round((base[r] * 0.1) / 5) * 5); return c; };
  G.canMove = b => !!b && b.owner === 'p' && !b.remote && !b.static && !G.MOVE_NO[b.type];
  G.moveBuilding = function (b, x, y) {
    if (!G.canMove(b)) { if (b && G.MOVE_NO[b.type]) toast(G.MOVE_NO[b.type], 'warn'); return false; }
    if (x === b.x && y === b.y) return false;
    const why = G.placeWhy(b.type, x, y, b.id);
    if (why) { toast(G.placeText(why), 'warn'); return false; }
    if (!G.pay(G.moveCost(b))) { toast('Faltan recursos para la mudanza.', 'warn'); return false; }
    if (PK.Logi && S.logi) for (const bl of S.logi.belts.slice()) if (bl.a === b.id || bl.b === b.id) PK.Logi.removeBelt(bl);
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) { const k = W.idx(b.x + i, b.y + j); W.bAt[k] = -1; if (W.block[k] === 2) W.block[k] = 0; }
    const ox = b.cx, oy = b.cy;
    b.x = x; b.y = y; b._nsT = null; b._agua = undefined; G.blockVer++;
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
      const k = W.idx(x + i, y + j);
      W.bAt[k] = b.id;
      if (!b.def.walkable) W.block[k] = 2;
      if (W.road[k]) { W.road[k] = 0; W.roadVer++; }
    }
    for (const u of G.units) {
      if (u.inside) continue;
      const tx = Math.floor(u.x), ty = Math.floor(u.y);
      if (!b.def.walkable && tx >= x && tx < x + b.w && ty >= y && ty < y + b.h) placeOutside(u, b);
      if (u.task && u.task.b === b.id) u.path = []; // los que iban para allá rehacen el camino
    }
    capsDirty = true;
    G.stat('moved', 1);
    toast(b.def.name + ' se mudó.', 'good');
    if (PK.Render.burst) { PK.Render.burst(ox, oy, [200, 180, 140], 14); PK.Render.burst(b.cx, b.cy, [232, 184, 74], 20); }
    if (PK.Sfx && !G.offline) PK.Sfx.play('build');
    return true;
  };
  G.completeBuilding = function (b) {
    if (b.done) return;
    b.done = true; b.progress = 1;
    if (b.owner === 'p') {
      capsDirty = true;
      toast(b.def.name + ' terminado.', 'good');
      if (!G.offline && PK.Sfx) PK.Sfx.play('build');
      G.stat('built_total', 1);
      if (b.def.deco) G.stat('decos', 1);
      G.revealAt(b.cx, b.cy, G.sight(b));
      G.blockVer++; // los bonos por cercanía se recalculan
      if (PK.Vida) PK.Vida.invalidar();
    }
  };

  // ---------- Producción y colas ----------
  G.updateBuildings = function (dt) {
    for (const b of G.buildings) {
      if (b.owner === 'p' && !b.done) { // obra en curso: avanza sola, a la velocidad de Arquitectura y los deseos
        b.progress += (dt / b.def.time) * G.buildMult('p');
        if (b.progress >= 1) G.completeBuilding(b);
        continue;
      }
      if (b.owner !== 'p' || !b.done) continue;
      if (b.type === 'cartwright') { PK.Logi.updateCartwright(b, dt); continue; }
      if (b.def.trains) {
        if (!b.queue.length) { b.status = ''; continue; }
        if (G.pop() >= G.popCap()) {
          // avisa al trabarse (antes el explorador quedaba en cola en silencio, con una línea chica en el panel)
          if (b.status !== 'Población máxima: construye o mejora casas' && !G.offline) toast(b.def.name + ': ' + (b.queue[0] === 'scout' ? 'el explorador' : 'el aldeano') + ' espera porque llegaste a la población máxima. Construye o mejora casas.', 'warn', { label: 'Construir', fn: () => PK.UI.openBuild() });
          b.status = 'Población máxima: construye o mejora casas';
          continue;
        }
        b.status = 'Entrenando';
        b.qt += dt;
        const tt = G.trainTime(b);
        while (b.qt >= tt && b.queue.length && G.pop() < G.popCap()) { b.qt -= tt; const k = b.queue.shift() === 'scout' ? 'scout' : 'v'; G.spawnUnit(b, k); if (k === 'v' && b.owner === 'p') G.stat('aldeanos', 1); }
        if (!b.queue.length) b.qt = 0;
      } else if (b.def.recipe) {
        PK.Logi.produce(b, dt);
      }
    }
  };

  // ---------- Eras ----------
  G.eraChecks = function (n) {
    return D.eraReq(n).map(r => {
      if (r.pop) return { text: r.text, ok: G.villagerCount() >= r.pop };
      if (r.lvlAny) return { text: r.text + ' (' + Math.min(r.n, G.levelCount(r.lvlAny)) + '/' + r.n + ')', ok: G.levelCount(r.lvlAny) >= r.n };
      if (r.b) return { text: r.text, ok: G.levelCount(r.lvl, r.b) >= 1 };
      const have = r.any.reduce((s, t) => s + G.countB(t), 0);
      const kinds = r.any.filter(t => G.countB(t) > 0).length;
      return { text: r.text, ok: r.any.length > 1 && r.n > 1 ? kinds >= r.n : have >= r.n };
    });
  };
  G.startEra = function () {
    if (S.eraProg) return false;
    const n = S.era + 1;
    if (!G.eraChecks(n).every(c => c.ok)) { toast('Aún no cumples los requisitos de la siguiente era.', 'warn'); return false; }
    if (!G.pay(D.eraCost(n))) { toast('Recursos insuficientes para avanzar de era.', 'warn'); return false; }
    S.eraProg = { to: n, t: 0, total: D.eraTime(n) };
    toast('Tu pueblo comienza el avance a ' + D.eraName(n) + '.' + (n >= 3 ? ' Si te sobran recursos, paga «Horas extra» en el Centro Urbano para adelantarlo.' : ''), 'good');
    return true;
  };

  // ---------- Investigación ----------
  G.techMax = () => best('library', 'techMax');
  G.techCost = function (id, lvl) {
    const t = D.TECHS[id], k = Math.pow(1.75, lvl), c = {};
    for (const r in t.base) c[r] = Math.round((t.base[r] * k) / 5) * 5;
    if (lvl >= 2) c.planks = (c.planks || 0) + Math.round(30 * Math.pow(1.75, lvl - 2));
    if (lvl >= 4) c.books = (c.books || 0) + Math.round(8 * Math.pow(1.75, lvl - 4));
    if (lvl >= 6) c.ingots = (c.ingots || 0) + Math.round(15 * Math.pow(1.75, lvl - 6));
    if (lvl >= 8) c.tools = (c.tools || 0) + Math.round(10 * Math.pow(1.75, lvl - 8));
    if (lvl >= 11) c.gems = (c.gems || 0) + Math.round(5 * Math.pow(1.75, lvl - 11));
    return c;
  };
  G.techTime = lvl => Math.min(45 * Math.pow(1.85, lvl), 5 * 86400);
  // Nombre de lo que se investiga: una técnica de D.TECHS (con su nivel) o un nodo del árbol 2.0 ('n:<id>')
  G.researchName = r => (PK.Vida && PK.Vida.esNodo(r.id) ? PK.Vida.nombre(r.id) : D.TECHS[r.id].name + ' ' + U.roman(r.lvl));
  G.startResearch = function (id) {
    if (PK.Vida && PK.Vida.esNodo(id)) return PK.Vida.investigar(id.slice(2));
    if (S.research) { toast('Ya hay una investigación en curso.', 'warn'); return false; }
    if (!G.countB('library')) { toast('Necesitas una Biblioteca.', 'warn'); return false; }
    const lvl = G.lvl(id), t = D.TECHS[id];
    if (t.era && S.era < t.era) { toast('Requiere la Era ' + U.roman(t.era) + '.', 'warn'); return false; }
    if (lvl >= G.techMax()) { toast('Nivel máximo: mejora la Biblioteca para investigar más.', 'warn'); return false; }
    if (!G.pay(G.techCost(id, lvl))) { toast('Recursos insuficientes.', 'warn'); return false; }
    S.research = { id, lvl: lvl + 1, t: 0, total: G.techTime(lvl) };
    return true;
  };

  // Temporizadores reales: avance de era, investigación y mejoras. Siguen corriendo sin tope mientras no estás.
  G.updateTimers = function (dt) {
    if (S.eraProg) {
      S.eraProg.t += dt;
      if (S.eraProg.t >= S.eraProg.total) {
        S.era = S.eraProg.to; S.eraProg = null;
        if (PK.Vida && PK.Vida.evento) PK.Vida.evento('era', { era: S.era, aldeanos: G.villagerCount() });
        if (!G.offline && PK.Vida && PK.Vida.fuegos) PK.Vida.fuegos();
        G.finished.push('Era ' + U.roman(S.era));
        toast('¡Has alcanzado la Era ' + U.roman(S.era) + ': ' + D.eraName(S.era) + '! Tus edificios pueden subir 2 niveles más.', 'epic');
        if (!G.offline) { const tc = G.buildings.find(b => b.owner === 'p' && b.type === 'tc'); if (tc && PK.Render.burst) for (let k = 0; k < 4; k++) PK.Render.burst(tc.cx + (Math.random() - 0.5) * 6, tc.cy + (Math.random() - 0.5) * 6, null, 50); if (PK.Sfx) PK.Sfx.play('era'); }
        PK.Platform.reportStat('era', S.era);
        if (G.decreePending() && !G.offline) setTimeout(() => PK.UI.openDecree(), 2500); // ¡a elegir decreto!
        else if (PK.UI.revisarCartas && !G.offline) setTimeout(() => PK.UI.revisarCartas(), 2500); // carta de era (Fase 3)
      }
    }
    if (S.research) {
      S.research.t += dt * G.researchMult();
      if (S.research.t >= S.research.total && PK.Vida && PK.Vida.esNodo(S.research.id)) { PK.Vida.terminarNodo(S.research.id); S.research = null; }
      else if (S.research.t >= S.research.total) {
        S.techs[S.research.id] = S.research.lvl;
        G.finished.push(D.TECHS[S.research.id].name + ' ' + U.roman(S.research.lvl));
        toast(D.TECHS[S.research.id].name + ' ' + U.roman(S.research.lvl) + ' investigado.', 'good');
        G.stat('techs', 1);
        if (S.research.id === 'storage') capsDirty = true;
        S.research = null;
      }
    }
    for (const b of G.buildings) {
      if (b.owner !== 'p' || !b.upg) continue;
      b.upg.t += dt;
      if (b.upg.t >= b.upg.total) finishUpgrade(b);
    }
  };

  // ---------- Bucle principal ----------
  let regrowT = 0, questT = 0;
  G.update = function (dt) {
    G.time += dt;
    for (let i = 0; i < G.units.length; i++) PK.Units.update(G.units[i], dt);
    PK.Units.separate(G.units, dt);
    G.updateBuildings(dt);
    G.updateTimers(dt);
    PK.Auto.tick(dt);
    PK.Logi.update(dt);
    const tierra = !G.enMar(); // en el archipiélago (Fase 9) no corren los sistemas de la tierra
    if (tierra) PK.Terr.update(dt, false);
    PK.Exp.update(dt, false);
    if (PK.Heroes) PK.Heroes.update(dt);
    if (PK.Aventura) PK.Aventura.tick(dt);
    if (tierra && PK.Leyendas) PK.Leyendas.tick(dt);
    if (tierra && PK.Campana) PK.Campana.tick(dt);
    PK.Batalla.update(dt);
    if (tierra) PK.Life.update(dt);
    if (tierra) PK.Incursiones.update(dt);
    fiestaTick(dt);
    if (S.relics) G.addRes('gold', (G.relicGold() / 60) * dt);
    frutales(dt);
    PK.Social.update(dt, false);
    regrowT += dt;
    if (regrowT > 5) { regrowT = 0; regrowNow(); G.checkMastery(); G.checkEncierro(); if (tierra && PK.Vida) PK.Vida.tick(); }
    questT += dt;
    if (questT > 1) { questT = 0; PK.Quests.check(); } // en el mar, con la Crónica del Mar (pk-28)
    if (!tierra && PK.Arch) PK.Arch.tick(dt);
    if (!tierra && PK.Armada) PK.Armada.tick(dt);
  };
  // Árboles frutales (V5): un poco de comida sin aldeanos, en vivo y sin conexión
  let frutT = 0, frutN = 0;
  function frutales(dt) {
    if ((frutT -= dt) <= 0) { frutT = 5; frutN = mine('frutal').length; }
    if (frutN) G.addRes('food', frutN * D.BUILD.frutal.deco.comida * dt * G.globalMult());
  }
  function occupied(x, y) {
    for (const u of G.units) if (!u.inside && Math.floor(u.x) === x && Math.floor(u.y) === y) return true;
    return false;
  }
  function regrowNow() {
    const now = Date.now(), hrs = (now - S.lastRegen) / 3600000;
    S.lastRegen = now;
    W.regrow(now, occupied, hrs);
  }

  // ---------- Progreso offline ----------
  // Se simula por tasas: cada aldeano rinde según la distancia entre su recurso y el punto de acopio.
  function tripRate(u, rate, fromX, fromY, res) {
    const drop = G.findDrop(u.owner, res, fromX, fromY);
    if (!drop) return 0;
    if (u.owner === 'p') u.dl = drop.type === 'tc' ? 1 : drop.lvl;
    const cap = G.carryCap(u.owner, u), d = Math.max(0.5, U.dist(fromX, fromY, drop.cx, drop.cy) - drop.w / 2) * 1.2;
    return cap / (cap / rate + (2 * d) / G.speed(u.owner) + 0.5);
  }
  // Los exploradores avanzan a saltos por el borde de la niebla.
  function exploreOffline(u, dt) {
    let budget = G.speed('p', u) * dt * 0.6;
    for (let k = 0; k < 40 && budget > 0; k++) {
      const t = G.exploreTarget(u);
      if (!t) return;
      const d = U.dist(u.x, u.y, t[0] + 0.5, t[1] + 0.5);
      const f = Math.min(1, budget / Math.max(0.1, d));
      const p = W.freeAround(Math.floor(u.x + (t[0] + 0.5 - u.x) * f), Math.floor(u.y + (t[1] + 0.5 - u.y) * f), Math.floor(u.x + (t[0] + 0.5 - u.x) * f), Math.floor(u.y + (t[1] + 0.5 - u.y) * f), t[0], t[1]);
      u.x = p[0] + 0.5; u.y = p[1] + 0.5; u.path = [];
      G.revealAt(u.x, u.y, G.scoutSight());
      if (!W.fog[t[1] * W.W + t[0]]) G.revealAt(t[0] + 0.5, t[1] + 0.5, 1.5);
      budget -= d;
    }
  }
  G.simulateOffline = function (secFull, quiet) {
    const sec = Math.min(secFull, D.OFFLINE_CAP);
    if (sec < 1) return null;
    G.offline = true;
    G.finished = [];
    const before = Object.assign({}, S.res), fogBefore = W.fogCount;
    const steps = U.clamp(Math.ceil(sec / 60), 1, 240), dt = sec / steps;
    const startEra = S.era, t0 = Date.now() - sec * 1000;
    let depleted = 0;
    for (let s = 0; s < steps; s++) {
      G.tSim = t0 + (s + 0.5) * dt * 1000; // la marea (y lo que dependa de la hora) va con el reloj simulado
      const online = PK.Net && PK.Net.online;
      for (const u of G.units) {
        if (!u.task || u.inside || u.remote) continue;
        if (online && u.owner !== 'p') continue; // el servidor ya simula a los demás reinos
        const t = u.task;
        if (t.t === 'explore' || (t.t === 'move' && t.then)) { if (t.then) u.task = { t: 'explore' }; exploreOffline(u, dt); continue; }
        if (t.t === 'gather') {
          let n = W.nodes[t.node];
          if (!n || n.dead) {
            n = u.owner === 'p' ? G.bestNode(t.res, u.x, u.y, 'p', { zone: t.zone }) : W.nearestNode(t.res, u.x, u.y, 14, u.owner, { zone: t.zone });
            if (!n) { u.task = null; continue; }
            t.node = n.id;
            const p = W.freeAround(n.x, n.y, n.x, n.y, u.x, u.y);
            u.x = p[0] + 0.5; u.y = p[1] + 0.5; u.path = [];
          }
          if (D.NODES[n.kind].marea && !D.mareaBaja(G.tSim)) continue; // el arrecife está bajo el agua
          const eff = tripRate(u, G.gatherRate(u.owner, t.res, u, n.kind), n.x + 0.5, n.y + 0.5, t.res);
          // los reinos simulados recolectan a menor ritmo sin ti, para que las zonas comunes no se vacíen
          // con la bodega llena, tus aldeanos no gastan el recurso del mapa (antes lo vaciaban y se perdía)
          const room = u.owner === 'p' ? Math.max(0, G.cap(t.res) - (S.res[t.res] || 0)) : Infinity;
          const take = Math.min(n.amount, eff * dt * (u.owner === 'p' ? 1 : 0.3), room);
          if (take <= 0) continue;
          n.amount -= take;
          if (online && u.owner === 'p' && W.isShared(n) && take > 0) PK.Net.harvest(n.id, take);
          if (n.amount <= 0.5) { W.depleteNode(n); if (u.owner === 'p') depleted++; } // solo los tuyos: contaba los de los 15 reinos simulados
          if (u.owner === 'p' && take > 0) gained(t.res, G.addRes(t.res, take), n.zone, n.kind === 'deer');
        } else if (t.t === 'farm') {
          const b = G.bById.get(t.b);
          if (!b) { u.task = null; continue; }
          const fr = G.granjaRes(b), eff = tripRate(u, G.farmRate(u.owner, b, u), b.cx, b.cy, fr);
          if (u.owner === 'p') gained(fr, G.addRes(fr, eff * dt), -1);
        } else if (t.t === 'build') { // partidas viejas: las obras ya se levantan solas
          u.task = null;
        } else if (t.t === 'dig') {
          const p = W.pois[t.poi], st = p && G.poiState(p);
          if (!st || st.d) { u.task = null; continue; }
          G.digProgress(p, dt);
        }
      }
      G.updateBuildings(dt);
      G.updateTimers(dt);
      PK.Auto.tick(dt);
      PK.Logi.offline(dt);
      PK.Terr.update(dt, true);
      PK.Exp.update(dt, true);
      if (PK.Heroes) PK.Heroes.update(dt);
      if (PK.Aventura) PK.Aventura.tick(dt);
      if (PK.Leyendas) PK.Leyendas.tick(dt);
      if (PK.Campana) PK.Campana.tick(dt);
      if (S.relics) G.addRes('gold', (G.relicGold() / 60) * dt);
      frutales(dt);
      PK.Social.update(dt, true);
    }
    // obras, estudios y eras siguen su reloj completo aunque hayan pasado más de 12 h
    if (secFull > sec) G.updateTimers(secFull - sec);
    for (const r of D.RES_ORDER) S.res[r] = Math.floor(S.res[r] * 100) / 100;
    regrowNow();
    G.offline = false; G.tSim = 0;
    if (quiet) return null;
    const got = {};
    for (const r of D.RES_ORDER) { const d = Math.floor(S.res[r] - before[r]); if (d) got[r] = d; }
    // ayudas del gremio que llegaron mientras no estabas (las del buzón se aplican justo antes de este cálculo)
    const from = Date.now() - secFull * 1000 - 120000, helps = S.ret.helpLog.filter(h => h.at >= from), news = S.ret.news.filter(h => h.at >= from);
    const welcome = secFull >= D.WELCOME_MIN ? G.newWelcome(secFull) : null;
    return { sec: secFull, capped: secFull > sec, gained: got, depleted, eraUp: S.era > startEra, finished: G.finished.slice(), explored: W.fogCount - fogBefore, helps: helps.length, helpsWhat: helps.length ? helps[helps.length - 1].what : null, news, welcome, consejo: PK.Consejo.informe(from) };
  };

  // ---------- Cofre de bienvenida ----------
  // Se arma al volver y queda guardado hasta que lo abras. Si había otro sin abrir, se entrega antes.
  G.newWelcome = function (sec) {
    if (S.ret.welcome) G.openWelcome(true);
    S.ret.welcome = D.welcomeChest(sec / 3600, S.era, Math.random());
    return S.ret.welcome;
  };
  G.openWelcome = function (quiet) {
    const w = S.ret.welcome;
    if (!w) return null;
    S.ret.welcome = null;
    w.opened = Date.now();
    G.give(w.reward);
    G.stat('welcome_chests', 1);
    if (!quiet && PK.Sfx) PK.Sfx.play(w.tier >= 2 ? 'level' : 'quest');
    if (quiet) toast(w.name + ': ' + Object.keys(w.reward).map(k => '+' + U.fmt(w.reward[k]) + ' ' + D.RES[k].name.toLowerCase()).join(', '), 'good');
    return w;
  };
  G.logHelp = function (from, what) {
    S.ret.helpLog.push({ at: Date.now(), from, what: what || null });
    if (S.ret.helpLog.length > 30) S.ret.helpLog.splice(0, S.ret.helpLog.length - 30);
  };
  // Noticias para el resumen al volver: ataques a tus parcelas, resultados de campañas y envíos del gremio.
  G.logNews = function (text, kind) {
    S.ret.news.push({ at: Date.now(), text, kind: kind || 'info' });
    if (S.ret.news.length > 30) S.ret.news.splice(0, S.ret.news.length - 30);
  };

  // ---------- Guardado ----------
  G.serialize = function () {
    S.lastSeen = Date.now();
    S.at = S.lastSeen; // cuándo se guardó (main.js elige entre la local y la nube por esto: lastSeen es del mundo)
    S.units = G.units.filter(u => u.owner === 'p').map(u => u.toJSON());
    S.buildings = G.buildings.filter(b => b.owner === 'p').map(b => b.toJSON());
    S.nodes = W.saveNodes();
    S.fog = W.saveFog();
    PK.Terr.save(S);
    PK.Logi.save(S);
    return JSON.stringify(S);

  };
  G.save = function () { U.store.set(SAVE_KEY, G.serialize()); };
  G.guardarObjeto = o => U.store.set(SAVE_KEY, JSON.stringify(o)); // la travesía (js/mar.js) guarda los dos mundos ya cambiados
  G.loadSave = function () {
    const s = U.store.get(SAVE_KEY);
    if (!s) return null;
    try {
      const o = JSON.parse(s);
      if (o && o.v !== D.SAVE_V) G.reinicioDe = o.v; // para el cartel «El mundo se reinició…» (main.js)
      return o && o.v === D.SAVE_V ? o : null;
    } catch (e) { return null; }
  };
  G.reset = async function () {
    G.noSave = true;
    U.store.del(SAVE_KEY);
    if (PK.Net && PK.Net.online) await PK.Net.deleteCloudSave();
    location.reload();
  };

  G.selUnits = function () {
    if (!G.sel || G.sel.type !== 'units') return [];
    return G.sel.ids.map(id => G.uById.get(id)).filter(Boolean);
  };
  G.nextIdle = function (after) {
    const idle = G.units.filter(u => u.owner === 'p' && !u.task && !u.inside && u.kind === 'v');
    if (!idle.length) return null;
    const i = idle.findIndex(u => u.id === after);
    return idle[(i + 1) % idle.length];
  };
})();
