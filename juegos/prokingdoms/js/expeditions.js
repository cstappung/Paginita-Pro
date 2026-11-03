// Expediciones: el ejército sale del Cuartel a mazmorras del mapa (por pisos) o a encargos del tablón y
// vuelve con recursos especiales. Cada tropa rinde distinto contra cada tipo de enemigo y gana veteranía.
// También viven aquí la Fuente de los Deseos y los efectos de las estructuras de las Leyendas.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const Exp = (PK.Exp = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k, act) => PK.UI && !G().offline && PK.UI.toast(t, k, act);
  const log = (t, k) => PK.Social.log(t, k);
  const BOARD_MS = 4 * 3600e3;

  Exp.init = function (st) {
    st.exp = st.exp || { runs: [], board: { at: 0, list: [] }, sites: {}, xp: {}, wish: { day: '', offer: [], buff: null }, rid: 1 };
    for (const k in D.ARMY) st.exp.xp[k] = st.exp.xp[k] || 0;
    st.war.reports = st.war.reports || []; // informes de batalla (los últimos 12) para la Crónica del Cuartel
  };

  // ---------- Efectos de las estructuras ----------
  Exp.bonus = key => D.LEGEND_B.reduce((s, t) => s + G().best(t, key), 0) + (G().perk ? G().perk(key) : 0);
  Exp.wishMult = function (k) {
    const st = S(), b = st && st.exp && st.exp.wish.buff;
    return b && b.k === k && b.until > Date.now() ? 1 + b.p : 1;
  };
  Exp.unitMult = type => 1 + 0.04 * D.rankOf(S().exp.xp[type]);
  Exp.armyMult = () => (1 + Exp.bonus('armyPower')) * Exp.wishMult('army');
  // Los lobos no se acercan a la Casa de Fieras.
  Exp.warded = function (x, y) {
    for (const b of G().buildings) if (b.owner === 'p' && b.done && b.type === 'beasthouse' && U.dist(x, y, b.cx, b.cy) < G().bst(b).wolfWard) return true;
    return false;
  };

  // ---------- Fuerza contra un tipo de enemigo ----------
  // enemy = { beast: 0.6, golem: 0.4 }: mezcla de enemigos; cada tropa rinde según su multiplicador.
  Exp.vsFactor = function (type, enemy) {
    const vs = D.ARMY[type].vs || {};
    let f = 0, tot = 0;
    for (const e in enemy) { f += enemy[e] * (vs[e] || 1); tot += enemy[e]; }
    return tot ? f / tot : 1;
  };
  Exp.powerVs = function (units, enemy) {
    let p = 0;
    for (const k in units) p += (units[k] || 0) * D.ARMY[k].power * Exp.unitMult(k) * Exp.vsFactor(k, enemy);
    return p * (1 + 0.15 * G().lvl('tactics')) * G().eraMult() * Exp.armyMult();
  };
  Exp.heal = units => Math.min(0.45, Object.keys(units).reduce((s, k) => s + (units[k] || 0) * (D.ARMY[k].heal || 0), 0));
  // Probabilidad de victoria según la proporción de fuerzas: 1:1 es 50%, 1,5:1 ya es casi seguro.
  Exp.chance = ratio => U.clamp(0.5 + (ratio - 1) * 0.9, 0.03, 0.97);
  // Compañía recomendada: lo mejor que tienes en casa contra ese enemigo, hasta superar la fuerza pedida x1,4.
  Exp.recommend = function (enemy, need) {
    const army = S().war.army, out = {};
    // primero los especialistas contra ese enemigo, después los más fuertes
    const order = Object.keys(D.ARMY).filter(k => army[k] > 0 && (!D.ARMY[k].heal || Exp.vsFactor(k, enemy) > 1)).sort((a, b) => (Exp.vsFactor(b, enemy) - Exp.vsFactor(a, enemy)) || (D.ARMY[b].power - D.ARMY[a].power));
    const target = need * 1.4;
    for (const k of order) {
      out[k] = 0;
      while (out[k] < army[k] && Exp.powerVs(out, enemy) < target) out[k]++;
      if (Exp.powerVs(out, enemy) >= target) break;
    }
    // un par de clérigos siempre ayudan a volver con vida
    if (army.cleric && !out.cleric) out.cleric = Math.min(army.cleric, 3);
    return out;
  };

  // ---------- Mazmorras ----------
  Exp.found = function (p) {
    G().stat('dungeons_found', 1);
    const d = D.DUNGEON[p.kind];
    toast('¡' + d.name + '! ' + (S().era < d.era ? 'Hará falta la Era ' + U.roman(d.era) + ' para entrar.' : 'Manda una expedición desde el Cuartel.'), 'epic');
  };
  Exp.sites = function () {
    const st = S(), [hx, hy] = D.PLAYER_HOME;
    return W.pois.filter(p => D.DUNGEON[p.kind] && st.pois[p.id] && st.pois[p.id].f)
      .sort((a, b) => U.dist(a.x, a.y, hx, hy) - U.dist(b.x, b.y, hx, hy));
  };
  Exp.site = id => S().exp.sites[id] || (S().exp.sites[id] = { best: 0, rest: 0 });
  Exp.travel = function (p) {
    const [hx, hy] = D.PLAYER_HOME;
    return Math.round((60 + U.dist(p.x, p.y, hx, hy) * 2) * (1 - Exp.bonus('expSpeed')));
  };
  // El Observatorio marca en el mapa las mazmorras dentro de su radio, aunque estén en la niebla.
  function scan() {
    const r = G().best('observatory', 'scan');
    if (!r) return;
    const st = S(), [hx, hy] = D.PLAYER_HOME;
    for (const p of W.pois) {
      if (!D.DUNGEON[p.kind] || (st.pois[p.id] && st.pois[p.id].f)) continue;
      if (U.dist(p.x, p.y, hx, hy) > r) continue;
      st.pois[p.id] = { f: 1, scan: 1 };
      Exp.found(p);
    }
  }

  // ---------- Encargos ----------
  Exp.board = function () {
    const st = S(), b = st.exp.board, n = 3 + Exp.bonus('missions');
    if (Date.now() - b.at > BOARD_MS || !b.at) {
      b.at = Date.now();
      const pool = D.MISSIONS.filter(m => st.era >= m.era), rng = U.rng(Math.floor(Date.now() / BOARD_MS) * 7 + st.created % 997);
      b.list = [];
      for (let i = 0; i < n && pool.length; i++) b.list.push(makeMission(pool.splice(Math.floor(rng() * pool.length), 1)[0], i));
    }
    while (b.list.length < n && st.era >= 2) { // la Taberna suma encargos sin esperar a la renovación
      const pool = D.MISSIONS.filter(m => st.era >= m.era && !b.list.some(o => o.tpl === m.id));
      if (!pool.length) break;
      b.list.push(makeMission(U.pick(pool), b.list.length));
    }
    return b.list;
  };
  function makeMission(m, i) {
    const k = D.missionScale(S().era), loot = {};
    for (const r in m.loot) loot[r] = Math.round(m.loot[r] * k);
    loot[m.sp] = Math.round(m.spN * Math.sqrt(k));
    return { uid: Date.now().toString(36) + i, tpl: m.id, power: Math.round(m.base * k), loot, time: m.time };
  }
  Exp.boardLeft = () => Math.max(0, BOARD_MS - (Date.now() - S().exp.board.at));

  // ---------- Enviar ----------
  // target: { poi, floor } (mazmorra) o { mission: uid } (encargo).
  Exp.campTravel = p => Math.round((30 + U.dist(p.x, p.y, D.PLAYER_HOME[0], D.PLAYER_HOME[1]) * 1.5) * (1 - Exp.bonus('expSpeed')));
  Exp.preview = function (target) {
    if (target.camp !== undefined) {
      const p = W.pois[target.camp];
      if (!p) return null;
      const tier = G().poiTier(p);
      return { name: 'Campamento de bandidos ' + U.roman(tier + 1), enemy: { bandit: 1 }, power: D.campPower(tier), loot: D.campLoot(tier), travel: Exp.campTravel(p) };
    }
    if (target.mission) {
      const m = S().exp.board.list.find(o => o.uid === target.mission);
      if (!m) return null;
      const tpl = D.MISSIONS.find(o => o.id === m.tpl);
      return { name: tpl.name, enemy: tpl.enemy, power: m.power, loot: m.loot, travel: Math.round((m.time / 2) * (1 - Exp.bonus('expSpeed'))) };
    }
    const p = W.pois[target.poi], d = D.DUNGEON[p.kind], site = Exp.site(p.id);
    return { name: d.name + ' · piso ' + target.floor, enemy: d.enemy, power: D.dungeonPower(p.kind, target.floor), loot: D.dungeonLoot(p.kind, target.floor, target.floor > site.best), travel: Exp.travel(p) };
  };
  Exp.canSend = function (target) {
    const st = S();
    if (!G().countB('barracks')) return 'Necesitas un Cuartel.';
    if (target.camp !== undefined) {
      const p = W.pois[target.camp], ps = p && G().poiState(p);
      if (!ps || !ps.f) return 'Todavía no descubres ese campamento.';
      if (ps.d) return 'Ese campamento ya fue destruido.';
      if (st.exp.runs.some(r => r.camp === target.camp) || st.war.exps.some(e => e.camp === target.camp)) return 'Ya hay tropas en camino a ese campamento.';
    }
    if (target.poi !== undefined) {
      const p = W.pois[target.poi], d = D.DUNGEON[p.kind], site = Exp.site(p.id);
      if (st.era < d.era) return 'Requiere la Era ' + U.roman(d.era) + '.';
      if (target.floor > site.best + 1) return 'Primero limpia el piso ' + (site.best + 1) + '.';
      if (target.floor > d.floors) return 'Esa mazmorra no tiene más pisos.';
      if (site.rest > Date.now()) return 'La mazmorra se está reponiendo: ' + U.fmtTime((site.rest - Date.now()) / 1000) + '.';
      if (st.exp.runs.some(r => r.poi === p.id)) return 'Ya hay una expedición en esa mazmorra.';
    }
    return null;
  };
  Exp.send = function (target, units) {
    const why = Exp.canSend(target), st = S(), army = st.war.army;
    if (why) { toast(why, 'warn'); return false; }
    let total = 0;
    for (const k in units) { units[k] = Math.max(0, Math.floor(units[k] || 0)); if (units[k] > army[k]) { toast('No tienes tantas tropas.', 'warn'); return false; } total += units[k]; }
    if (!total) { toast('Elige tropas para la expedición.', 'warn'); return false; }
    const pv = Exp.preview(target);
    if (!pv) return false;
    for (const k in units) army[k] -= units[k];
    const run = { id: st.exp.rid++, poi: target.poi, camp: target.camp, floor: target.floor, mission: target.mission ? st.exp.board.list.find(o => o.uid === target.mission) : null, name: pv.name, enemy: pv.enemy, need: pv.power, power: Math.round(Exp.powerVs(units, pv.enemy)), heal: Exp.heal(units), units: Object.assign({}, units), loot: pv.loot, phase: 'go', arrive: Date.now() + pv.travel * 1000, travel: pv.travel };
    if (run.mission) st.exp.board.list.splice(st.exp.board.list.indexOf(run.mission), 1);
    st.exp.runs.push(run);
    run.chance = Exp.chance(run.power / Math.max(1, pv.power));
    log('Expedición a ' + pv.name + ': fuerza ' + U.fmt(run.power) + ' contra ~' + U.fmt(pv.power) + '. Llegan en ' + U.fmtTime(pv.travel) + '.', 'info');
    const to = PK.Troops ? PK.Troops.targetOf(run) : null;
    toast('¡En marcha! ' + PK.Troops.total(units) + ' soldados salen del Cuartel hacia ' + pv.name + ' (llegan en ' + U.fmtTime(pv.travel) + ').', 'good',
      to && run.mission === null ? { label: 'Seguirlos', fn: () => { const b = G().buildings.find(o => o.owner === 'p' && o.type === 'barracks' && o.done); if (b) PK.Render.centerOn(b.cx, b.cy); else PK.Render.centerOn(to[0], to[1]); } } : null);
    if (PK.Sfx) PK.Sfx.play('event');
    return true;
  };

  // ---------- Resolver ----------
  function resolve(r) {
    const st = S(), ratio = r.power / Math.max(1, r.need), sent = Object.assign({}, r.units);
    r.won = Math.random() < Exp.chance(ratio);
    const loss = (r.won ? U.clamp(0.32 / ratio, 0.03, 0.4) : 0.55 + Math.random() * 0.2) * (1 - r.heal);
    r.lost = {};
    for (const k in r.units) { const l = Math.round(r.units[k] * loss * U.rand(0.8, 1.2)); r.lost[k] = Math.min(r.units[k], l); r.units[k] -= r.lost[k]; }
    // veteranía para quienes vuelven (también se aprende perdiendo, menos)
    const xp = Math.max(4, r.need / 8) * (r.won ? 1 : 0.4) * (1 + Exp.bonus('xpBoost'));
    for (const k in r.units) if (r.units[k] > 0) st.exp.xp[k] += xp;
    if (r.poi !== undefined) {
      const p = W.pois[r.poi], site = Exp.site(p.id);
      site.rest = Date.now() + D.DUNGEON[p.kind].rest * 1000;
      if (r.won && r.floor > site.best) {
        site.best = r.floor;
        st.stats['floor_' + p.kind] = Math.max(st.stats['floor_' + p.kind] || 0, r.floor);
        st.stats.floor_max = Math.max(st.stats.floor_max || 0, r.floor);
      }
    }
    if (r.camp !== undefined && r.won) {
      const p = W.pois[r.camp], ps = p && G().poiState(p);
      if (ps && !ps.d) { ps.d = 1; W.poiFree(p); G().stat('camps_cleared', 1); }
    }
    r.phase = 'back';
    r.back = Date.now() + r.travel * 1000;
    log(r.won ? 'Victoria en ' + r.name + '. Bajas: ' + lostText(r.lost) + '. Vuelven con el botín.' : 'Derrota en ' + r.name + '. Bajas: ' + lostText(r.lost) + '.', r.won ? 'good' : 'bad');
    const rep = { id: r.id, at: Date.now(), name: r.name, won: r.won, power: r.power, need: r.need, chance: r.chance || Exp.chance(ratio), sent, lost: r.lost, loot: r.won ? r.loot : null, enemy: r.enemy };
    st.war.reports = st.war.reports || [];
    st.war.reports.unshift(rep);
    if (st.war.reports.length > 12) st.war.reports.length = 12;
    const to = PK.Troops ? PK.Troops.targetOf(r) : null;
    if (to && !r.mission && PK.Troops) PK.Troops.fight(to[0], to[1], { won: r.won, units: sent, enemy: r.enemy });
    toast(r.won ? '¡Victoria en ' + r.name + '! Tus tropas vuelven con el botín.' : 'Derrota en ' + r.name + '. Los que quedaron vuelven a casa.', r.won ? 'good' : 'bad',
      { label: 'Ver informe', fn: () => PK.UI.openReport(rep) });
  }
  const lostText = l => Object.keys(l).filter(k => l[k]).map(k => l[k] + ' ' + D.ARMY[k].name.toLowerCase() + (l[k] > 1 ? 's' : '')).join(', ') || 'ninguna';
  function arrive(r) {
    const st = S(), g = G();
    for (const k in r.units) st.war.army[k] += r.units[k];
    if (r.won) {
      g.give(r.loot);
      for (const k of D.SPECIAL) if (r.loot[k]) g.stat('sp_' + k, r.loot[k]);
      g.stat('exp_won', 1);
      log('Botín de ' + r.name + ': ' + Object.keys(r.loot).map(k => U.fmt(r.loot[k]) + ' ' + (k === 'coins' ? 'monedas' : D.RES[k].name.toLowerCase())).join(', ') + '.', 'good');
      toast('Tus tropas volvieron de ' + r.name + ' con el botín: ' + Object.keys(r.loot).map(k => '+' + U.fmt(r.loot[k]) + ' ' + (k === 'coins' ? 'monedas' : D.RES[k].name.toLowerCase())).join(', ') + '.', 'epic');
      if (PK.Sfx) PK.Sfx.play('coin');
    } else if (PK.Troops.total(r.units)) toast('Los sobrevivientes de ' + r.name + ' volvieron al Cuartel.', 'info');
    st.exp.runs.splice(st.exp.runs.indexOf(r), 1);
  }

  // ---------- Fuente de los Deseos ----------
  // Tres bendiciones al día (las mismas todo el día); se elige una.
  Exp.wishOffer = function () {
    const w = S().exp.wish, day = U.dayKey();
    if (w.day === day) return [];
    const pool = D.WISHES.map(o => o.k), rng = U.rng(U.strHash(day + ':' + S().created)), out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  };
  Exp.makeWish = function (k) {
    const w = S().exp.wish, b = G().buildings.find(o => o.owner === 'p' && o.done && o.type === 'wishwell');
    if (!b || w.day === U.dayKey() || !Exp.wishOffer().includes(k)) return;
    const s = G().bst(b), def = D.WISHES.find(o => o.k === k);
    w.day = U.dayKey();
    G().stat('wishes', 1);
    if (def.instant) {
      const gold = Math.round(300 * S().era * (1 + s.wishPower * 4));
      G().give({ gold });
      toast('Lluvia de monedas: +' + U.fmt(gold) + ' de oro.', 'epic');
    } else {
      w.buff = { k, p: s.wishPower, until: Date.now() + s.wishTime * 1000 };
      toast(def.name + ': +' + Math.round(s.wishPower * 100) + '% de ' + def.desc + ' por ' + U.fmtTime(s.wishTime) + '.', 'epic');
    }
    if (PK.Sfx) PK.Sfx.play('coin');
  };

  // ---------- Bucle ----------
  let t1 = 0;
  Exp.update = function (dt, offline) {
    const st = S();
    if (!st || !st.exp) return;
    t1 += dt;
    if (t1 < 1) return;
    const sec = t1;
    t1 = 0;
    const now = Date.now();
    for (const r of st.exp.runs.slice()) {
      if (r.phase === 'go' && now >= r.arrive) resolve(r);
      else if (r.phase === 'back' && now >= r.back) arrive(r);
    }
    // la Arena entrena a las tropas que están en casa
    const xpH = Exp.bonus('armyXp');
    if (xpH) for (const k in st.war.army) if (st.war.army[k] > 0) st.exp.xp[k] += (xpH * sec) / 3600;
    if (!offline) scan();
  };

  // Para el panel del Observatorio: cuánto falta para los lobos y el próximo evento.
  Exp.forecast = () => (PK.Life && PK.Life.timers ? PK.Life.timers() : null);
})();
