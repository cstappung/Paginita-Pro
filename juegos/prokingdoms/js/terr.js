// Territorio: el mapa está dividido en parcelas de 8x8. Cada reino parte con las de su hogar, reclama las
// parcelas libres vecinas pagando y solo puede quitarle tierra a otro conquistándola. La conquista está
// pensada para ser un riesgo calculado: cuesta mucho, da botín de guerra al ganar, siempre mueren tropas y
// defender es mucho más fácil. Los reinos muy avanzados no pueden atacar a los que recién empiezan.
// En línea, el servidor decide el dueño de cada parcela; sin servidor, todo se resuelve aquí.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const T = (PK.Terr = { mode: false, sel: null });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);
  const online = () => PK.Net && PK.Net.online;
  const H = 3600e3;

  T.init = function (st) {
    // rev: parcelas que te quitó un jugador real { k: { at, name, pid, slot } } (revancha); battles: últimos resúmenes
    st.terr = Object.assign({ map: null, conquests: [], lost: {}, rev: {}, battles: [], shield: 0, camps: [], threats: [], botShield: {}, botAt: {}, nextThreat: 0, log: [] }, st.terr || {});
    if (st.terr.map && !online()) W.loadTerr(st.terr.map);
    T.sel = null;
  };
  T.save = function (st) { st.terr.map = W.saveTerr(); };

  const me = () => D.MY_SLOT;
  T.mine = k => W.terr[k] === me() + 1;
  T.count = () => W.countParcels(me());
  T.start = () => W.startParcels[me()] || 21;
  T.max = () => D.maxParcels(T.start(), S().era);
  T.touchesMine = k => W.parcelNeighbors(k).some(T.mine);
  T.touches = (k, slot) => W.parcelNeighbors(k).some(n => W.terr[n] === slot + 1);
  T.center = k => [((k % W.PW) + 0.5) * D.PARCEL, (Math.floor(k / W.PW) + 0.5) * D.PARCEL];
  T.explored = function (k) {
    const x0 = (k % W.PW) * D.PARCEL, y0 = Math.floor(k / W.PW) * D.PARCEL;
    for (let j = 0; j < D.PARCEL; j += 2) for (let i = 0; i < D.PARCEL; i += 2) if (W.fog[W.idx(x0 + i, y0 + j)]) return true;
    return false;
  };
  T.recent = () => S().terr.conquests.filter(t => Date.now() - t < 24 * H).length;
  T.realmOf = slot => (slot === me() ? null : D.BOTS.find(b => b.slot === slot));

  // ---------- Reclamar tierra libre ----------
  T.claimCost = () => D.claimCost(Math.max(0, T.count() - T.start()), S().era);
  T.canClaim = function (k) {
    if (W.terrCommon[k]) return 'Las zonas comunes no tienen dueño: son de todos.';
    if (W.terr[k]) return T.mine(k) ? 'Ya es tuya.' : 'Pertenece a otro reino.';
    if (!T.explored(k)) return 'Primero explora esa parcela.';
    if (!T.touchesMine(k)) return 'Solo puedes reclamar parcelas que toquen tu territorio.';
    if (T.count() >= T.max()) return 'Llegaste al máximo de parcelas de tu era (' + T.max() + ').';
    return null;
  };
  T.claim = function (k) {
    const why = T.canClaim(k);
    if (why) { toast(why, 'warn'); return; }
    const cost = T.claimCost();
    if (!G().pay(cost)) { toast('Recursos insuficientes para reclamar esa parcela.', 'warn'); return; }
    if (online()) {
      PK.Net.claim(k).then(() => { W.terr[k] = me() + 1; W.terrVer++; took(k); }).catch(e => { G().give(cost); toast(e.message, 'warn'); PK.UI.rerender(); });
      return;
    }
    W.terr[k] = me() + 1; W.terrVer++;
    took(k);
  };
  function took(k) {
    G().stat('parcels', 1);
    const [x, y] = T.center(k);
    if (PK.Render.burst) PK.Render.burst(x, y, [120, 190, 255], 30);
    if (PK.Sfx) PK.Sfx.play('build');
    toast('La parcela ahora es parte de tu reino.', 'good');
    PK.UI.rerender();
  }

  // ---------- Información de un reino vecino ----------
  // Para los reinos simulados se estima todo aquí; para jugadores reales llega del servidor.
  T.botEra = bot => U.clamp(S().era + (bot.strength > 1.1 ? 1 : bot.strength < 0.9 ? -1 : 0), 1, 99);
  T.realmInfo = function (slot) {
    const bot = T.realmOf(slot), st = S();
    if (!bot) return null;
    if (bot.human) return { era: bot.era || 1, score: bot.score || 0, newbie: !!bot.newbie, shield: !!bot.tshield, human: true, name: bot.name, realm: bot.realm };
    const era = T.botEra(bot);
    return { era, score: D.realmScore(era, 18 * era * bot.strength, 20 + 12 * era), newbie: false, shield: (st.terr.botShield[slot] || 0) > Date.now(), human: false, name: bot.name, realm: bot.realm };
  };
  T.myInfo = function () {
    const g = G(), lv = g.buildings.reduce((s, b) => s + (b.owner === 'p' && b.done ? b.lvl : 0), 0);
    return { era: S().era, score: D.realmScore(S().era, lv, g.pop()) };
  };

  // Defensa estimada de una parcela de otro reino (o de las tuyas, para saber qué tan seguras están).
  T.defenseOf = (k, slot) => T.defenseParts(k, slot).total;
  // La misma defensa, separada por origen (tropas, torres, murallas, local, vecinas, milicia de la era).
  T.defenseParts = function (k, slot) {
    const P = W.PW, owner = D.ownerOfSlot(slot), towers = [];
    for (const b of G().buildings) if (b.owner === owner && b.done && (b.type === 'tower' || b.type === 'tc')) towers.push([b.cx, b.cy, (D.BSTATS[b.type](b.lvl).defense || 0)]);
    const around = W.parcelNeighbors(k).filter(n => W.terr[n] === slot + 1).length;
    if (slot === me()) return D.parcelDefenseParts({ era: S().era, px: k % P, py: Math.floor(k / P), towers, army: PK.Social.power(S().war.army), walls: G().lvl('walls'), around, mult: PK.Def.parcelMult(k) * (1 + G().best('dragontower', 'terrDef')) });
    const bot = T.realmOf(slot), info = T.realmInfo(slot);
    if (bot.human) return D.parcelDefenseParts({ era: info.era, px: k % P, py: Math.floor(k / P), towers, army: bot.army || 0, walls: 0, around });
    return D.parcelDefenseParts({ era: info.era, px: k % P, py: Math.floor(k / P), towers, army: 45 * info.era * bot.strength, walls: Math.floor(info.era / 2), around });
  };

  // ---------- Resumen de batallas ----------
  // b: { role: 'atk' | 'def', k, vs, won, atk, def, parts }. Se guarda, se anota en la crónica y en las novedades.
  T.recordBattle = function (b) {
    const tr = S().terr;
    b.at = Date.now();
    b.cause = D.battleCause(b);
    tr.battles.unshift(b);
    if (tr.battles.length > 12) tr.battles.length = 12;
    return b.cause;
  };
  T.lastBattle = k => S().terr.battles.find(b => b.k === k) || null;

  // ---------- Revancha ----------
  // Si un jugador real te quitó una parcela, durante 48 h puedes recuperarla a mitad de precio, solo contra él,
  // aunque esté en tregua.
  T.revenge = function (k) {
    const rv = S().terr.rev[k];
    if (!rv || Date.now() - rv.at >= D.TERR.retake * 1000 || W.terr[k] !== rv.slot + 1) return null;
    const bot = T.realmOf(rv.slot);
    if (!bot || !bot.human || (rv.pid && bot.pid && bot.pid !== rv.pid)) return null;
    return Object.assign({ left: (rv.at + D.TERR.retake * 1000 - Date.now()) / 1000 }, rv);
  };
  T.revenges = () => Object.keys(S().terr.rev).map(Number).map(k => (T.revenge(k) ? Object.assign({ k }, T.revenge(k)) : null)).filter(Boolean);
  T.revengeText = rv => 'Revancha disponible contra ' + rv.name + ' · ' + Math.max(1, Math.ceil(rv.left / 3600)) + ' h';
  // Un jugador real tomó una parcela tuya (llega del servidor): se anota la revancha y el resumen.
  T.onLost = function (it) {
    const tr = S().terr, t = Date.now();
    if (it.k !== undefined) {
      tr.lost[it.k] = t;
      if (!it.revenge) tr.rev[it.k] = { at: t, name: it.from, pid: it.fromId || null, slot: it.fromSlot };
    }
    for (const k in tr.rev) if (t - tr.rev[k].at >= D.TERR.retake * 1000) delete tr.rev[k];
    return it.parts ? T.recordBattle({ role: 'def', k: it.k, vs: it.from, won: false, atk: it.atk, def: it.def, parts: it.parts }) : null;
  };
  T.onDefended = it => (it.parts ? T.recordBattle({ role: 'def', k: it.k, vs: it.from, won: true, atk: it.atk, def: it.def, parts: it.parts }) : null);

  // ---------- Conquista ----------
  T.canAttack = function (k) {
    const slot = W.terr[k] - 1;
    if (W.terr[k] === 0) return 'Esa parcela es libre: reclámala en vez de atacarla.';
    if (slot === me()) return 'Esa parcela es tuya.';
    if (!T.explored(k)) return 'Primero explora esa parcela.';
    if (!T.touchesMine(k)) return 'Solo puedes atacar parcelas que toquen tu territorio.';
    if (W.isCore(k, slot)) return 'Es el corazón de ese reino: nunca se puede conquistar.';
    if (!G().countB('barracks')) return 'Necesitas un Cuartel.';
    if (S().terr.camps.some(c => c.k === k)) return 'Ya hay una campaña contra esa parcela.';
    if (T.count() >= T.max()) return 'Llegaste al máximo de parcelas de tu era (' + T.max() + ').';
    return D.canConquer(T.myInfo(), T.realmInfo(slot), !!T.revenge(k));
  };
  // Recuperar una parcela que te quitaron hace poco cuesta la mitad (contra un jugador, solo si la tiene quien te la quitó).
  T.retakeLeft = function (k) {
    const lost = S().terr.lost[k], left = lost ? (lost + D.TERR.retake * 1000 - Date.now()) / 1000 : 0;
    const rv = S().terr.rev[k], bot = T.realmOf(W.terr[k] - 1);
    if (bot && bot.human) return T.revenge(k) ? left : 0; // contra un jugador real, la rebaja es solo la revancha
    return rv ? 0 : Math.max(0, left);
  };
  T.campaignCost = function (k) {
    const c = D.conquestCost(S().era, T.recent());
    if (T.retakeLeft(k) > 0) for (const r in c) c[r] = Math.round(c[r] / 2);
    return c;
  };
  T.attack = function (k, units) {
    const why = T.canAttack(k);
    if (why) { toast(why, 'warn'); return false; }
    const w = S().war, total = Object.keys(units).reduce((s, u) => s + units[u], 0);
    if (!total) { toast('Elige tropas para la campaña.', 'warn'); return false; }
    for (const u in units) if (units[u] > w.army[u]) { toast('No tienes tantas tropas.', 'warn'); return false; }
    const cost = T.campaignCost(k);
    if (!G().pay(cost)) { toast('Una campaña cuesta mucho: te faltan recursos.', 'warn'); return false; }
    for (const u in units) w.army[u] -= units[u];
    const slot = W.terr[k] - 1, [cx, cy] = T.center(k), [hx, hy] = D.PLAYER_HOME;
    const travel = 90 + U.dist(cx, cy, hx, hy) * 1.5, power = PK.Social.power(units);
    const camp = { k, slot, units: Object.assign({}, units), power, travel, arrive: Date.now() + travel * 1000, back: 0, phase: 'go', won: false, revenge: !!T.revenge(k) };
    S().terr.camps.push(camp);
    if (online() && T.realmOf(slot).human) {
      camp.remote = true;
      PK.Net.conquer(k, units, power).then(r => { camp.rid = r.id; camp.arrive = r.arrive; }).catch(e => {
        S().terr.camps.splice(S().terr.camps.indexOf(camp), 1);
        for (const u in units) w.army[u] += units[u];
        G().give(cost); toast(e.message, 'warn'); PK.UI.rerender();
      });
    }
    PK.Social.log((camp.revenge ? '¡Revancha! ' : '') + 'Campaña contra ' + T.realmInfo(slot).realm + ': tus tropas llegan en ' + U.fmtTime(travel) + '.', 'info');
    toast('Tus tropas marchan a conquistar la parcela. Llegan en ' + U.fmtTime(travel) + '.', 'good');
    return true;
  };

  function resolveCampaign(c) {
    const parts = T.defenseParts(c.k, c.slot), def = parts.total * U.rand(0.85, 1.15), atk = c.power * U.rand(0.85, 1.15);
    finishCampaign(c, atk > def && W.terr[c.k] === c.slot + 1, atk / Math.max(1, def), { atk, def, parts: D.scaleParts(parts, def) });
  }
  // También la usa la red cuando el servidor resuelve contra un jugador real. bt: { atk, def, parts } (resumen).
  function finishCampaign(c, won, ratio, bt) {
    const st = S(), info = T.realmInfo(c.slot);
    c.won = won;
    const cause = bt && bt.parts ? T.recordBattle({ role: 'atk', k: c.k, vs: info.realm, won, atk: bt.atk, def: bt.def, parts: bt.parts }) : null;
    if (won) delete st.terr.rev[c.k];
    const loss = D.conquestLoss(won, ratio || 1);
    for (const u in c.units) c.units[u] = Math.floor(c.units[u] * (1 - loss));
    c.phase = 'back';
    c.back = Date.now() + (c.travel || 120) * 1000;
    if (won) {
      if (!c.remote) {
        transfer(c.k, c.slot, me()); st.terr.botShield[c.slot] = Date.now() + D.TERR.shieldLoss * 1000;
        if (online()) PK.Net.conquerBot(c.k).catch(() => {}); // el servidor lleva el mapa de todos
      }
      st.terr.conquests.push(Date.now());
      G().stat('conquests', 1);
      if (!info.human) scheduleRevenge(c.slot, c.k);
      const loot = D.conquestLoot(info.era || st.era);
      G().give(loot);
      const lootTxt = Object.keys(loot).map(r => U.fmt(loot[r]) + ' ' + D.RES[r].name.toLowerCase()).join(', ');
      PK.Social.log('Conquistaste una parcela de ' + info.realm + '. Botín: ' + lootTxt + '. Perdiste el ' + Math.round(loss * 100) + '% de las tropas.' + (cause ? ' ' + cause : ''), 'good');
      toast('¡La parcela es tuya! Botín de guerra: ' + lootTxt + '. Perdiste el ' + Math.round(loss * 100) + '% de las tropas.', 'good');
      G().logNews('Tomaste una parcela de ' + info.realm + '.' + (cause ? ' ' + cause : ''), 'good');
      PK.Notify.now('¡Parcela conquistada!', 'Tomaste una parcela de ' + info.realm + '.');
      const [x, y] = T.center(c.k);
      if (!G().offline && PK.Render.burst) PK.Render.burst(x, y, null, 50);
    } else {
      if (!c.remote) st.terr.botShield[c.slot] = Date.now() + D.TERR.shieldWin * 1000;
      PK.Social.log(info.realm + ' resistió tu ataque. Perdiste el ' + Math.round(loss * 100) + '% de las tropas.' + (cause ? ' ' + cause : ''), 'bad');
      toast(info.name + ' rechazó tu campaña.' + (cause ? ' ' + cause : ''), 'bad');
      G().logNews(info.realm + ' resistió tu campaña.' + (cause ? ' ' + cause : ''), 'bad');
      PK.Notify.now('Tu campaña fracasó', info.realm + ' resistió.' + (cause ? ' ' + cause : ''));
    }
  }
  T.finishRemote = function (rid, won, ratio, units, bt) {
    const c = S().terr.camps.find(o => o.rid === rid);
    if (!c) return;
    if (units) c.units = units;
    finishCampaign(c, won, ratio, bt);
  };

  // Cambia el dueño de una parcela. Lo que el perdedor tenía construido ahí se desarma y se le devuelve
  // completo (construcción y mejoras): perder tierra no debe arruinar a nadie.
  function transfer(k, fromSlot, toSlot) {
    const g = G(), P = W.PW, x0 = (k % P) * D.PARCEL, y0 = Math.floor(k / P) * D.PARCEL, x1 = x0 + D.PARCEL, y1 = y0 + D.PARCEL;
    const owner = D.ownerOfSlot(fromSlot);
    const inside = b => b.owner === owner && b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0;
    for (const b of g.buildings.filter(inside)) {
      if (b.type === 'tc') continue;
      if (owner === 'p') {
        g.give(g.buildCost(b.type));
        for (let L = 1; L < b.lvl; L++) g.give(D.upCost(b.type, L));
        PK.Social.log('Tu ' + b.def.name.toLowerCase() + ' quedó en tierra ajena: se desarmó y recuperaste todo lo invertido.', 'info');
      }
      if (owner === 'p') forceRemove(b); else g.removeBuilding(b);
    }
    W.terr[k] = toSlot + 1;
    W.terrVer++;
    if (PK.Logi) PK.Logi.onTerritory(k);
    if (PK.Def) PK.Def.onTerritory();
  }
  function forceRemove(b) {
    for (const u of G().units) if (u.task && u.task.b === b.id) G().release(u);
    G().removeBuilding(b);
  }
  T.transfer = transfer;

  // ---------- Reinos simulados ----------
  // Si atacas a un reino simulado, contraataca más tarde contra tu frontera. Además, de vez en cuando algún
  // vecino tantea tus bordes. Con torres y algo de ejército se rechaza sin problema.
  function scheduleRevenge(slot, k) {
    const bot = T.realmOf(slot);
    S().terr.threats.push({ slot, k, power: Math.round(T.defenseOf(k, me()) * U.rand(0.35, 0.7) * bot.strength), at: Date.now() + U.rand(20, 60) * 60e3, warned: false });
  }
  function borderParcelFacing(slot) {
    const cands = [];
    for (let k = 0; k < W.terr.length; k++) if (T.mine(k) && !W.isCore(k, me()) && T.touches(k, slot)) cands.push(k);
    return cands.length ? U.pick(cands) : null;
  }
  function resolveThreat(th) {
    const st = S(), bot = T.realmOf(th.slot);
    if (!bot || bot.human || !T.mine(th.k)) return;
    const parts = T.defenseParts(th.k, me()), def = parts.total * U.rand(0.85, 1.15), atk = th.power * U.rand(0.85, 1.15);
    const w = st.war, cause = T.recordBattle({ role: 'def', k: th.k, vs: bot.realm, won: atk <= def, atk, def, parts: D.scaleParts(parts, def) });
    if (atk > def) {
      transfer(th.k, me(), th.slot);
      st.terr.lost[th.k] = Date.now();
      st.terr.shield = Date.now() + D.TERR.shieldLoss * 1000;
      for (const u in w.army) w.army[u] = Math.floor(w.army[u] * 0.85);
      PK.Social.log(bot.realm + ' tomó una parcela de tu frontera. Durante 48 h recuperarla cuesta la mitad. ' + cause, 'bad');
      toast(bot.name + ' tomó una parcela de tu frontera. Refuerza tus torres.', 'bad');
      G().logNews(bot.realm + ' tomó una parcela de tu frontera. ' + cause, 'bad');
    } else {
      const gold = Math.round(40 * S().era * bot.strength);
      G().give({ gold });
      st.terr.shield = Date.now() + D.TERR.shieldWin * 1000;
      G().stat('defenses_won', 1);
      PK.Social.log('Rechazaste a ' + bot.realm + ' en tu frontera. Recuperaste ' + gold + ' de oro de lo que dejaron. ' + cause, 'good');
      toast('¡Tus defensas rechazaron a ' + bot.name + '!', 'good');
      G().logNews('Rechazaste a ' + bot.realm + ' en tu frontera. ' + cause, 'good');
    }
  }

  // Los reinos simulados también crecen: cada cierto tiempo reclaman una parcela libre junto a su tierra.
  function botGrowth() {
    const st = S(), now = Date.now();
    for (const bot of D.BOTS) {
      if (bot.human) continue;
      const next = st.terr.botAt[bot.slot] || (st.terr.botAt[bot.slot] = now + U.rand(1, 3) * H);
      if (now < next) continue;
      st.terr.botAt[bot.slot] = now + U.rand(3, 6) * H / bot.strength;
      const have = W.countParcels(bot.slot), max = D.maxParcels(W.startParcels[bot.slot], T.botEra(bot));
      if (have >= max) continue;
      const cands = [];
      for (let k = 0; k < W.terr.length; k++) if (!W.terr[k] && !W.terrCommon[k] && T.touches(k, bot.slot)) cands.push(k);
      if (!cands.length) continue;
      const h = W.homeParcel(bot.slot), P = W.PW;
      cands.sort((a, b) => Math.hypot(a % P - h % P, (a / P | 0) - (h / P | 0)) - Math.hypot(b % P - h % P, (b / P | 0) - (h / P | 0)));
      W.terr[cands[0]] = bot.slot + 1; W.terrVer++;
    }
  }

  let tickT = 0;
  T.update = function (dt, offline) {
    const st = S();
    if (!st || !st.terr) return;
    tickT += dt;
    if (tickT < 1) return;
    tickT = 0;
    const now = Date.now();
    for (const c of st.terr.camps.slice()) {
      if (c.phase === 'go' && !c.remote && now >= c.arrive) resolveCampaign(c);
      else if (c.phase === 'back' && now >= c.back) {
        for (const u in c.units) st.war.army[u] += c.units[u];
        st.terr.camps.splice(st.terr.camps.indexOf(c), 1);
        PK.Social.log('Volvieron los sobrevivientes de la campaña.', 'info');
      }
    }
    if (online()) return; // el servidor decide sobre el resto
    for (const th of st.terr.threats.slice()) {
      if (!th.warned && now >= th.at - 120e3 && !offline) {
        th.warned = true;
        toast('¡' + T.realmOf(th.slot).name + ' marcha contra tu frontera! Llega en 2 minutos.', 'bad');
        PK.Social.log(T.realmOf(th.slot).realm + ' viene contra tu frontera con una fuerza de ~' + th.power + '.', 'bad');
      }
      if (now >= th.at) { st.terr.threats.splice(st.terr.threats.indexOf(th), 1); if (st.terr.shield < now) resolveThreat(th); }
    }
    // tanteos al azar: solo si ya no eres novato y nunca mientras estás desconectado
    if (!offline && st.era >= D.TERR.minEra && G().countB('barracks') && now >= st.terr.nextThreat) {
      st.terr.nextThreat = now + U.rand(2, 5) * H;
      const bots = D.BOTS.filter(b => !b.human && W.countParcels(b.slot));
      const bot = bots.find(b => borderParcelFacing(b.slot) !== null);
      if (bot && st.terr.shield < now) {
        const k = borderParcelFacing(bot.slot);
        st.terr.threats.push({ slot: bot.slot, k, power: Math.round(T.defenseOf(k, me()) * U.rand(0.25, 0.6)), at: now + 180e3, warned: false });
      }
    }
    botGrowth();
  };

  // ---------- Selección en el mapa ----------
  T.toggle = function (on) {
    T.mode = on === undefined ? !T.mode : on;
    if (!T.mode) T.sel = null;
    PK.UI.rerender(); PK.UI.refreshPanel(true);
  };
  T.pick = function (tx, ty) {
    if (!W.inb(Math.floor(tx), Math.floor(ty))) return;
    T.sel = W.parcel(Math.floor(tx), Math.floor(ty));
    PK.UI.openParcel(T.sel);
  };
})();
