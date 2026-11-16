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
  const toast = (t, k, act) => PK.UI && PK.UI.toast(t, k, act);
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
    const pacto = PK.Diplo ? PK.Diplo.pacto(slot) : null; // S1: los pactos impiden conquistar
    if (bot.human) return { era: bot.era || 1, score: bot.score || 0, newbie: !!bot.newbie, shield: !!bot.tshield, human: true, name: bot.name, realm: bot.realm, pacto };
    const era = T.botEra(bot);
    return { era, score: D.realmScore(era, 18 * era * bot.strength, 20 + 12 * era), newbie: false, shield: (st.terr.botShield[slot] || 0) > Date.now(), human: false, name: bot.name, realm: bot.realm, pacto };
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
  T.recordBattle = function (b, cuando) {
    const tr = S().terr;
    b.at = cuando || Date.now();
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
    if (PK.Diplo && PK.Diplo.pacto(W.terr[k] - 1) === 'rival') for (const r in c) c[r] = Math.round(c[r] * D.DIPLO.rival.conquista); // S1: contra un rival, más barato
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
    // semilla: la del plan de asedio (D.asedioPlan). Se crea al lanzar y se guarda: recargar no cambia la batalla.
    const camp = { k, slot, units: Object.assign({}, units), power, travel, arrive: Date.now() + travel * 1000, back: 0, phase: 'go', won: false, revenge: !!T.revenge(k), semilla: 1 + Math.floor(Math.random() * 2e9) };
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

  // ---------- El asedio (plan de guerra, G1, pk-55) ----------
  // Al llegar las tropas ya no hay una tirada: se calcula el plan de la batalla (D.asedioPlan, con la semilla de la
  // campaña) y la pelea dura lo que diga el plan. Todo va por marcas de tiempo (c.ini), como c.arrive: recargar o
  // volver después de un rato da el mismo final. La parcela no cambia de dueño hasta que termina.
  // Por qué lado entra el atacante: 0 norte (y−), 1 este (x+), 2 sur (y+), 3 oeste (x−). El lado de la parcela que
  // toca su tierra (si son varios, el más cercano a su hogar); si no toca, el que mira a su hogar.
  T.ladoDe = function (k, atkSlot) {
    const P = W.PW, px = k % P, py = Math.floor(k / P), lados = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const h = D.REALM_SLOTS[atkSlot] ? D.REALM_SLOTS[atkSlot].home : D.PLAYER_HOME, hx = h[0] / D.PARCEL, hy = h[1] / D.PARCEL;
    let mejor = 0, md = 1e9;
    lados.forEach(([dx, dy], i) => {
      const x = px + dx, y = py + dy, toca = x >= 0 && y >= 0 && x < P && y < P && W.terr[y * P + x] === atkSlot + 1;
      const d = Math.hypot(x + 0.5 - hx, y + 0.5 - hy) + (toca ? 0 : 1000);
      if (d < md) { md = d; mejor = i; }
    });
    return mejor;
  };
  function empezarAsedio(c, offline) {
    const now = Date.now(), info = T.realmInfo(c.slot);
    if (W.terr[c.k] !== c.slot + 1) { finishCampaign(c, false, 1, null); return; } // ya no es de ese reino
    c.semilla = c.semilla || 1 + Math.floor(Math.random() * 2e9); // campañas guardadas antes de pk-55
    c.plan = D.asedioPlan({ atk: c.power, parts: T.defenseParts(c.k, c.slot), semilla: c.semilla });
    c.ini = c.arrive; c.lado = T.ladoDe(c.k, me()); c.phase = 'asedio';
    if (offline || now >= c.ini + c.plan.total * 1000) return; // ya terminó mientras no estabas: directo al final
    PK.Social.log('Tus tropas llegaron a la parcela de ' + info.realm + ': empieza el asedio.', 'info');
    toast('¡Empieza el asedio a ' + info.realm + '! Tres etapas: la frontera, las defensas y el estandarte.', 'epic', { label: 'Ver', fn: () => T.verFrente('c' + c.k) });
    if (PK.Sfx) PK.Sfx.play('cuerno');
  }
  // Los asedios en curso, de los dos lados, en una sola forma (lo que leen frente.js y la interfaz).
  // mio: 'atk' (una campaña tuya) o 'def' (un reino vecino contra tu frontera). units: las del atacante, si se saben.
  T.frentes = function () {
    const st = S(), out = [];
    if (!st || !st.terr) return out;
    for (const c of st.terr.camps) if (c.phase === 'asedio' && c.plan) out.push({ id: 'c' + c.k, k: c.k, de: me(), a: c.slot, lado: c.lado || 0, ini: c.ini, plan: c.plan, units: c.units, mio: 'atk', fuerza: c.power });
    for (const th of st.terr.threats) if (th.plan) out.push({ id: 't' + th.k, k: th.k, de: th.slot, a: me(), lado: th.lado || 0, ini: th.ini, plan: th.plan, units: null, mio: 'def', fuerza: th.power });
    return out;
  };
  T.frente = id => T.frentes().find(f => f.id === id) || null;
  T.enDisputa = k => T.frentes().some(f => f.k === k);
  // El estado de un frente ahora mismo (D.asedioEn con el reloj).
  T.estado = f => D.asedioEn(f.plan, (Date.now() - f.ini) / 1000);
  T.nombreFrente = function (f) {
    const otro = T.realmInfo(f.mio === 'atk' ? f.a : f.de);
    return { otro: otro ? otro.realm : 'otro reino', titulo: f.mio === 'atk' ? 'Asedio a ' : 'Te asedia ' };
  };
  T.verFrente = function (id) {
    const f = T.frente(id) || T.frentes()[0];
    if (!f) return;
    if (PK.Frente && PK.Frente.ver) { PK.Frente.ver(f); return; }
    const [x, y] = T.center(f.k);
    PK.Render.centerOn(x, y);
  };

  // También la usa la red cuando el servidor resuelve contra un jugador real. bt: { atk, def, parts } (resumen).
  // plan: el del asedio, si lo hubo (da las bajas con su semilla y queda guardado para la repetición).
  function finishCampaign(c, won, ratio, bt, plan) {
    const st = S(), info = T.realmInfo(c.slot), fin = plan && c.ini ? c.ini + plan.total * 1000 : Date.now();
    c.won = won;
    const pv = plan || c.repPlan || null; // repPlan: la línea de tiempo armada con lo que decidió el servidor (T.finishRemote)
    const rep = pv ? { plan: pv, units: Object.assign({}, c.units), lado: c.lado === undefined ? T.ladoDe(c.k, me()) : c.lado, de: me(), a: c.slot } : null;
    const cause = bt && bt.parts ? T.recordBattle(Object.assign({ role: 'atk', k: c.k, vs: info.realm, won, atk: bt.atk, def: bt.def, parts: bt.parts }, rep ? { rep } : null), fin) : null;
    if (won) delete st.terr.rev[c.k];
    const loss = plan && won === plan.gano ? plan.bajas : D.conquestLoss(won, ratio || 1);
    const antes = Object.assign({}, c.units);
    for (const u in c.units) c.units[u] = Math.floor(c.units[u] * (1 - loss));
    c.phase = 'back';
    c.back = fin + (c.travel || 120) * 1000;
    if (plan && PK.Frente && PK.Frente.final && !G().offline) PK.Frente.final({ id: 'c' + c.k, k: c.k, de: me(), a: c.slot, lado: c.lado || 0, ini: c.ini, plan, units: antes, mio: 'atk' }, won);
    // contra un jugador todavía decide el servidor con una tirada (G3 lo cambia): se muestra la batalla en repetición
    else if (!plan && rep && PK.Frente && PK.Frente.repetir && !G().offline) PK.Frente.repetir(st.terr.battles[0], true);
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
    if (bt && bt.parts && bt.atk && bt.def) c.repPlan = D.asedioDe({ atk: bt.atk, def: bt.def, parts: bt.parts, semilla: c.semilla || 1, gano: !!won });
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
  // pk-55: el tanteo también es un asedio. Al llegar se calcula su plan y se pelea a la vista; al terminar se aplica.
  function empezarTanteo(th, offline) {
    const bot = T.realmOf(th.slot);
    if (!bot || bot.human || !T.mine(th.k)) return false;
    th.semilla = 1 + Math.floor(Math.random() * 2e9);
    th.plan = D.asedioPlan({ atk: th.power, parts: T.defenseParts(th.k, me()), semilla: th.semilla });
    th.ini = th.at; th.lado = T.ladoDe(th.k, th.slot);
    if (!offline && Date.now() < th.ini + th.plan.total * 1000) {
      toast('¡' + bot.name + ' asedia una parcela de tu frontera!', 'bad', { label: 'Ver', fn: () => T.verFrente('t' + th.k) });
      if (PK.Sfx) PK.Sfx.play('cuerno');
    }
    return true;
  }
  function resolveThreat(th) {
    const st = S(), bot = T.realmOf(th.slot), plan = th.plan;
    if (!bot || bot.human || !T.mine(th.k) || !plan) return;
    const atk = plan.atk, def = plan.def, cayo = plan.gano, fin = th.ini + plan.total * 1000;
    const w = st.war, cause = T.recordBattle({ role: 'def', k: th.k, vs: bot.realm, won: !cayo, atk, def, parts: plan.parts, rep: { plan, units: null, lado: th.lado || 0, de: th.slot, a: me() } }, fin);
    if (PK.Frente && PK.Frente.final && !G().offline) PK.Frente.final({ id: 't' + th.k, k: th.k, de: th.slot, a: me(), lado: th.lado || 0, ini: th.ini, plan, units: null, mio: 'def' }, cayo);
    if (cayo) {
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
      if (c.phase === 'go' && !c.remote && now >= c.arrive) empezarAsedio(c, offline);
      if (c.phase === 'asedio' && now >= c.ini + c.plan.total * 1000) { const p = c.plan; finishCampaign(c, p.gano && W.terr[c.k] === c.slot + 1, p.ratio, { atk: p.atk, def: p.def, parts: p.parts }, p); }
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
        PK.Social.log(T.realmOf(th.slot).realm + ' viene contra tu frontera con una fuerza de aprox. ' + th.power + '.', 'bad');
      }
      if (now >= th.at && !th.plan) { // llegaron: si hay tregua se vuelven; si no, empieza el asedio
        if (st.terr.shield >= th.at || !empezarTanteo(th, offline)) { st.terr.threats.splice(st.terr.threats.indexOf(th), 1); continue; }
      }
      if (th.plan && now >= th.ini + th.plan.total * 1000) { st.terr.threats.splice(st.terr.threats.indexOf(th), 1); resolveThreat(th); }
    }
    // tanteos al azar: solo si ya no eres novato y nunca mientras estás desconectado
    if (!offline && st.era >= D.TERR.minEra && G().countB('barracks') && now >= st.terr.nextThreat) {
      st.terr.nextThreat = now + U.rand(2, 5) * H;
      const bots = D.BOTS.filter(b => !b.human && W.countParcels(b.slot));
      const bot = bots.find(b => borderParcelFacing(b.slot) !== null);
      if (bot && st.terr.shield < now && !st.terr.threats.length) {
        const k = borderParcelFacing(bot.slot);
        st.terr.threats.push({ slot: bot.slot, k, power: Math.round(T.defenseOf(k, me()) * U.rand(0.25, 0.6)), at: now + 180e3, warned: false });
      }
    }
    botGrowth();
  };

  // ---------- El camino a la frontera de un vecino (pk-55) ----------
  // Solo se puede atacar una parcela que toque tu tierra, y los reinos nacen separados por 2 a 4 parcelas libres.
  // Cuántas hay que reclamar para tocar a ese reino y cuáles (el camino más corto por parcelas reclamables).
  // { n, camino: [k…] } · n = 0 si ya se tocan · null si no hay camino (agua de zonas comunes u otro reino en medio).
  T.caminoA = function (slot) {
    const N = W.terr.length, dist = new Int16Array(N).fill(-1), prev = new Int32Array(N).fill(-1), cola = [];
    for (let k = 0; k < N; k++) if (T.mine(k)) { dist[k] = 0; cola.push(k); }
    for (let i = 0; i < cola.length; i++) {
      const k = cola[i];
      if (W.parcelNeighbors(k).some(n => W.terr[n] === slot + 1 && !W.isCore(n, slot))) {
        const camino = [];
        for (let c = k; c >= 0 && dist[c] > 0; c = prev[c]) camino.unshift(c);
        return { n: dist[k], camino };
      }
      for (const n of W.parcelNeighbors(k)) if (dist[n] < 0 && !W.terr[n] && !W.terrCommon[n]) { dist[n] = dist[k] + 1; prev[n] = k; cola.push(n); }
    }
    return null;
  };
  T.marca = null; // parcelas resaltadas en el mapa de territorio (el camino hacia un vecino)
  T.marcarCamino = function (slot) {
    const c = T.caminoA(slot);
    T.marca = c && c.camino.length ? c.camino : null;
    if (T.marca) { const [x, y] = T.center(T.marca[0]); PK.Render.centerOn(x, y); }
    T.toggle(true);
  };

  // ---------- Selección en el mapa ----------
  T.toggle = function (on) {
    T.mode = on === undefined ? !T.mode : on;
    if (!T.mode) { T.sel = null; T.marca = null; }
    PK.UI.rerender(); PK.UI.refreshPanel(true);
  };
  T.pick = function (tx, ty) {
    if (!W.inb(Math.floor(tx), Math.floor(ty))) return;
    T.sel = W.parcel(Math.floor(tx), Math.floor(ty));
    PK.UI.openParcel(T.sel);
  };
})();
