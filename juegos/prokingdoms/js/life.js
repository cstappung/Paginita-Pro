// Vida del mundo mientras juegas: manadas de lobos que acosan a los aldeanos, torres y Centro Urbano que
// les disparan flechas, y eventos al azar (fiestas, mercaderes, ciervos dorados, estrellas fugaces…).
// Nada de esto pasa mientras no estás: es la parte "en vivo" del juego.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const L = (PK.Life = { wolves: [], arrows: [], event: null, buff: 1 });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);
  const sfx = n => PK.Sfx && PK.Sfx.play(n);

  let wolfT = 300 + Math.random() * 200, eventT = 150 + Math.random() * 120, nid = 1;
  L.reset = function () { L.wolves = []; L.arrows = []; L.event = null; L.buff = 1; };

  // ---------- Lobos ----------
  function spawnPack() {
    const st = S(), [hx, hy] = D.PLAYER_HOME;
    const own = G().buildings.filter(b => b.owner === 'p');
    for (let tries = 0; tries < 80; tries++) {
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 16;
      const x = Math.floor(hx + Math.cos(a) * r), y = Math.floor(hy + Math.sin(a) * r);
      if (!W.explored(x, y) || !W.passable(x, y)) continue;
      if (own.some(b => U.dist(b.cx, b.cy, x, y) < 8)) continue;
      const n = Math.min(6, 2 + Math.floor(st.era / 2)), hp = Math.round(35 * Math.pow(1.35, st.era - 1));
      for (let i = 0; i < n; i++) L.wolves.push({ id: nid++, x: x + 0.5 + (i % 2) * 0.6, y: y + 0.5 + (i >> 1) * 0.6, hp, max: hp, path: [], rt: Math.random(), bite: 0, anim: Math.random(), life: 160, flee: false, tgt: null });
      toast('¡Una manada de ' + n + ' lobos ronda tus tierras! Tus torres y el Centro Urbano les dispararán.', 'bad');
      sfx('howl');
      return true;
    }
    return false;
  }

  function wolfStep(w, tx, ty, sp, dt) {
    let move = sp * dt;
    while (move > 0 && w.path.length) {
      if (w.pchk !== w.path.length) {
        for (let k = 0; k < 10 && w.path.length > 1 && PK.Units.los(w.x, w.y, w.path[1][0] + 0.5, w.path[1][1] + 0.5); k++) w.path.shift();
        w.pchk = w.path.length;
      }
      const cx = w.path[0][0] + 0.5, cy = w.path[0][1] + 0.5, dx = cx - w.x, dy = cy - w.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx - dy) > 0.05) w.flip = dx - dy < 0;
      if (d <= move) { w.x = cx; w.y = cy; w.path.shift(); move -= d; } else { w.x += (dx / d) * move; w.y += (dy / d) * move; move = 0; }
    }
    void tx; void ty;
  }

  function updateWolves(dt) {
    const g = G();
    for (const w of L.wolves.slice()) {
      w.anim += dt; w.life -= dt; w.rt -= dt; w.bite -= dt;
      if (w.hp < w.max * 0.3 || w.life < 0) w.flee = true;
      const [hx, hy] = D.PLAYER_HOME;
      if (w.flee) {
        if (w.rt <= 0 || !w.path.length) {
          w.rt = 2;
          const ang = Math.atan2(w.y - hy, w.x - hx), fx = Math.floor(w.x + Math.cos(ang) * 10), fy = Math.floor(w.y + Math.sin(ang) * 10);
          w.path = W.findPath(Math.floor(w.x), Math.floor(w.y), { x0: fx, y0: fy, x1: fx, y1: fy, adj: !W.passable(fx, fy) }, 2500, true).path;
        }
        wolfStep(w, 0, 0, 2.6, dt);
        if (U.dist(w.x, w.y, hx, hy) > 34 || !W.explored(Math.floor(w.x), Math.floor(w.y)) || !w.path.length && w.rt < 0.5) L.wolves.splice(L.wolves.indexOf(w), 1);
        continue;
      }
      if (w.rt <= 0) {
        w.rt = 1.5;
        let best = null, bd = 20;
        for (const u of g.units) {
          if (u.owner !== 'p' || u.inside || u.kind !== 'v' || u.scared > 0 || PK.Exp.warded(u.x, u.y) || PK.Def.isInside(u.x, u.y)) continue;
          const d = U.dist(u.x, u.y, w.x, w.y);
          if (d < bd) { bd = d; best = u; }
        }
        w.tgt = best ? best.id : null;
        const tx = best ? Math.floor(best.x) : Math.floor(hx + (Math.random() - 0.5) * 16), ty = best ? Math.floor(best.y) : Math.floor(hy + (Math.random() - 0.5) * 16);
        w.path = W.findPath(Math.floor(w.x), Math.floor(w.y), { x0: tx, y0: ty, x1: tx, y1: ty, adj: !W.passable(tx, ty) }, 3000, true).path;
      }
      const u = w.tgt !== null && g.uById.get(w.tgt);
      if (u && U.dist(u.x, u.y, w.x, w.y) < 0.8) {
        if (w.bite <= 0) { w.bite = 1.2; scare(u); }
      } else wolfStep(w, 0, 0, 2.1, dt);
      // los aldeanos cercanos se defienden con lo que tengan a mano
      for (const v of g.units) if (v.owner === 'p' && !v.inside && v.kind === 'v' && !(v.scared > 0) && U.dist(v.x, v.y, w.x, w.y) < 1.1) hurt(w, 3 * dt, false);
    }
  }

  function scare(u) {
    if (u.carry) { u.carry = 0; u.carryRes = null; }
    const tc = G().buildings.find(b => b.owner === 'p' && b.type === 'tc' && b.done);
    u.scared = 5;
    if (tc) u.path = W.findPath(Math.floor(u.x), Math.floor(u.y), { x0: tc.x, y0: tc.y, x1: tc.x + tc.w - 1, y1: tc.y + tc.h - 1, adj: true }, 4000).path;
    if (!L.warned || G().time - L.warned > 20) { L.warned = G().time; toast('¡Los lobos asustan a tus aldeanos! Huyen al Centro Urbano.', 'bad'); }
    sfx('hit');
  }

  function hurt(w, dmg, arrow) {
    if (w.hp <= 0) return;
    w.hp -= dmg;
    if (arrow) sfx('hit');
    if (w.hp <= 0) {
      L.wolves.splice(L.wolves.indexOf(w), 1);
      const era = S().era, food = 25 * era;
      G().addRes('food', food);
      G().stat('wolves', 1);
      if (PK.Render.float) PK.Render.float(w.x, w.y, '+' + food, 'food');
      if (PK.Render.burst) PK.Render.burst(w.x, w.y, [160, 150, 140], 10);
      if (!L.wolves.length) { toast('¡La manada fue derrotada!', 'good'); sfx('coin'); }
    }
  }

  // Torres y Centro Urbano disparan a los lobos que estén a su alcance.
  function defenders(dt) {
    const g = G(), walls = 1 + 0.2 * g.lvl('walls');
    for (const b of g.buildings) {
      if (b.owner !== 'p' || !b.done || (b.type !== 'tower' && b.type !== 'tc')) continue;
      b.cd = (b.cd || 0) - dt;
      if (b.cd > 0) continue;
      const range = b.type === 'tower' ? 6 + 0.6 * b.lvl : 7.5;
      let best = null, bd = range;
      for (const w of L.wolves) { const d = U.dist(b.cx, b.cy, w.x, w.y); if (d < bd) { bd = d; best = w; } }
      if (!best) continue;
      b.cd = b.type === 'tower' ? 1.0 : 1.4;
      const dmg = (b.type === 'tower' ? 5 + 2.5 * (b.lvl - 1) : 4 + 1.5 * (b.lvl - 1)) * walls;
      L.arrows.push({ x0: b.cx, y0: b.cy, z0: b.type === 'tower' ? 36 : 30, w: best, t: 0, dur: Math.max(0.15, bd / 12), dmg });
      sfx('arrow');
    }
    for (const a of L.arrows.slice()) {
      a.t += dt;
      if (a.t >= a.dur) { L.arrows.splice(L.arrows.indexOf(a), 1); if (L.wolves.includes(a.w)) hurt(a.w, a.dmg, true); }
    }
  }

  // ---------- Eventos al azar ----------
  function tempNode(kind, amount, near) {
    const [hx, hy] = near;
    for (let tries = 0; tries < 80; tries++) {
      const x = Math.floor(hx + (Math.random() - 0.5) * 24), y = Math.floor(hy + (Math.random() - 0.5) * 24);
      if (!W.explored(x, y) || !W.passable(x, y) || (W.zoneAt[W.idx(x, y)] >= 0 && W.zones[W.zoneAt[W.idx(x, y)]].common)) continue;
      if (G().buildings.some(b => b.owner === 'p' && U.dist(b.cx, b.cy, x, y) < 3)) continue;
      if (G().units.some(u => !u.inside && Math.floor(u.x) === x && Math.floor(u.y) === y)) continue; // no encima de un aldeano
      const n = { id: W.nodes.length, kind, x, y, amount, max: amount, zone: -1, v: Math.floor(Math.random() * 4), dead: false, t: 0, temp: true };
      W.nodes.push(n); W.nodeAt[W.idx(x, y)] = n.id; W.block[W.idx(x, y)] = 1; W.bucket(n);
      return n;
    }
    return null;
  }
  function removeTemp(n) {
    if (!n || n.gone) return;
    const i = W.idx(n.x, n.y);
    if (W.block[i] === 1) W.block[i] = 0;
    if (W.nodeAt[i] === n.id) W.nodeAt[i] = -1;
    n.dead = true; n.gone = true; n.amount = 0;
    W.unbucket(n);
  }
  L.tempDone = function (n) {
    const era = S().era;
    if (n.gold) { const r = { gems: 8 * era, gold: 150 * era }; G().give(r); toast('¡Cazaste el ciervo dorado! +' + r.gems + ' gemas y +' + r.gold + ' de oro.', 'epic'); sfx('level'); }
    else if (n.star) { const r = { gems: 10 * era }; G().give(r); toast('El fragmento de estrella se agotó: +' + r.gems + ' gemas extra.', 'epic'); sfx('coin'); }
    removeTemp(n);
  };

  // Asedio bárbaro: tu defensa (Torres, Centro Urbano y tropas en casa) contra la horda.
  function siegeResolve(e) {
    if (e.done) return;
    e.done = true;
    const era = S().era, d = PK.Social.defense();
    if (d >= e.atk) {
      const r = { gold: Math.round(300 * Math.pow(1.8, era - 1)), gems: 4 * era, hide: 3 * era };
      G().give(r);
      G().stat('sieges_won', 1);
      toast('¡Rechazaste el asedio (' + U.fmt(d) + ' contra ' + U.fmt(e.atk) + ')! Botín: ' + Object.keys(r).map(k => '+' + U.fmt(r[k]) + ' ' + D.RES[k].name.toLowerCase()).join(', ') + '.', 'epic');
      sfx('level');
    } else {
      for (const k of ['food', 'gold']) S().res[k] -= Math.floor(S().res[k] * 0.05);
      toast('La horda (' + U.fmt(e.atk) + ') superó tu defensa (' + U.fmt(d) + ') y saqueó las afueras: perdiste el 5% de la comida y el oro. Sube tus Torres y tu ejército.', 'warn');
    }
  }
  L.eclipse = false;

  // Eventos: los de más abajo solo aparecen desde cierta era (era), para que lo tardío también traiga sorpresas.
  const EVENTS = {
    meteor: {
      era: 7, name: 'Lluvia de estrellas', desc: 'Tres fragmentos cayeron cerca: están llenos de gemas', dur: 240,
      start(e) {
        e.nodes = [];
        for (let i = 0; i < 3; i++) {
          const n = tempNode('gems', 60 + 30 * S().era, D.PLAYER_HOME);
          if (!n) continue;
          n.star = true; e.nodes.push(n);
          if (PK.Render.meteor) PK.Render.meteor(n.x, n.y);
        }
        return e.nodes.length > 0;
      },
      end(e) { for (const n of e.nodes) if (!n.dead) removeTemp(n); },
      action: { label: 'Ver', run(e) { const n = e.nodes.find(o => !o.dead); if (n) PK.Render.centerOn(n.x, n.y); return false; } },
    },
    siege: {
      era: 9, name: 'Asedio bárbaro', dur: 90,
      start(e) {
        e.atk = Math.round((25 + 40 * S().era) * 2.2);
        e.desc = 'Una horda de fuerza ' + U.fmt(e.atk) + ' llega a tus puertas (tu defensa: ' + U.fmt(PK.Social.defense()) + ')';
      },
      end(e) { siegeResolve(e); },
      action: { label: 'Defender', run(e) { siegeResolve(e); return true; } },
    },
    eclipse: {
      era: 11, name: 'Eclipse', desc: '+50% de producción en los talleres y de investigación mientras dure', dur: 300,
      start() { L.eclipse = true; }, end() { L.eclipse = false; },
    },
    tribute: {
      era: 13, name: 'Embajada lejana', dur: 0,
      start(e) {
        const era = S().era, r = { crystal: 5 * era, lore: 3 * era, starIron: 2 * era, scale: era };
        G().give(r);
        e.desc = 'Un imperio lejano te rinde tributo: ' + Object.keys(r).map(k => U.fmt(r[k]) + ' de ' + D.RES[k].name.toLowerCase()).join(', ');
      },
    },
    festival: {
      name: 'Fiesta de la cosecha', desc: '+50% de recolección', dur: 90,
      start() { L.buff = 1.5; }, end() { L.buff = 1; },
    },
    merchant: {
      name: 'Mercader errante', dur: 75,
      start(e) {
        const era = S().era, pool = ['wood', 'stone', 'food', 'ore'].concat(era >= 3 ? ['planks', 'blocks', 'ingots'] : []).concat(era >= 4 ? ['books', 'marble'] : []);
        const res = U.pick(pool), n = Math.round((300 * Math.pow(1.7, era - 1)) / 10) * 10;
        const price = Math.ceil(((D.MARKET_BASE[res] || 100) * n) / 100 * 0.45);
        Object.assign(e, { res, n, price, desc: 'Vende ' + U.fmt(n) + ' de ' + D.RES[res].name.toLowerCase() + ' por ' + U.fmt(price) + ' de oro (55% menos)' });
      },
      action: { label: 'Comprar', run(e) {
        if (S().res.gold < e.price) { toast('No tienes oro suficiente.', 'warn'); return false; }
        S().res.gold -= e.price; G().give({ [e.res]: e.n }); toast('¡Trato hecho con el mercader!', 'good'); sfx('coin'); return true;
      } },
    },
    golden: {
      name: 'Ciervo dorado', desc: 'Apareció cerca de tu pueblo: ¡cázalo antes de que se vaya!', dur: 150,
      start(e) { e.node = tempNode('deer', 400, D.PLAYER_HOME); if (e.node) { e.node.gold = true; e.node.v = 0; } return !!e.node; },
      end(e) { if (e.node && !e.node.dead) removeTemp(e.node); },
      action: { label: 'Ver', run(e) { PK.Render.centerOn(e.node.x, e.node.y); return false; } },
    },
    star: {
      name: 'Estrella fugaz', desc: 'Un fragmento cayó cerca: está lleno de gemas', dur: 180,
      start(e) {
        e.node = tempNode('gems', 60 + 30 * S().era, D.PLAYER_HOME);
        if (!e.node) return false;
        e.node.star = true;
        if (PK.Render.meteor) PK.Render.meteor(e.node.x, e.node.y);
        return true;
      },
      end(e) { if (e.node && !e.node.dead) removeTemp(e.node); },
      action: { label: 'Ver', run(e) { PK.Render.centerOn(e.node.x, e.node.y); return false; } },
    },
    inspire: {
      name: 'Inspiración', dur: 0,
      start(e) {
        let n = 0;
        for (const b of G().buildings) if (b.owner === 'p' && b.upg) { b.upg.t += (b.upg.total - b.upg.t) * 0.2; n++; }
        if (S().research) { S().research.t += (S().research.total - S().research.t) * 0.2; n++; }
        e.desc = n ? 'Tus maestros y sabios avanzan un 20% de golpe' : 'Tus aldeanos trabajan con ganas';
        if (!n) L.buff = 1.25, setTimeout(() => { L.buff = 1; }, 60000);
      },
    },
    caravan: {
      name: 'Caravana amiga', dur: 0,
      start(e) {
        const era = S().era, k = Math.pow(1.8, era - 1), r = { food: Math.round(200 * k), wood: Math.round(200 * k), gold: Math.round(80 * k) };
        G().give(r);
        e.desc = 'Un reino vecino te regala ' + Object.keys(r).map(x => U.fmt(r[x]) + ' de ' + D.RES[x].name.toLowerCase()).join(', ');
      },
    },
  };
  function startEvent() {
    const ids = Object.keys(EVENTS).filter(id => (EVENTS[id].era || 0) <= S().era);
    for (let k = 0; k < 5; k++) {
      const id = U.pick(ids), def = EVENTS[id], e = { id, name: def.name, desc: def.desc, t: def.dur, total: def.dur };
      if (def.start(e) === false) continue;
      // los que duran ya tienen su cartel (ui.js, que se puede achicar): el aviso extra tapaba la pantalla dos veces
      if (!def.dur) toast('Evento: ' + e.name + ' — ' + e.desc + '.', 'epic');
      sfx('event');
      G().stat('events', 1);
      L.event = def.dur ? e : null;
      return;
    }
  }
  L.eventAction = function () {
    const e = L.event, def = e && EVENTS[e.id];
    if (!def || !def.action) return;
    if (def.action.run(e)) endEvent();
  };
  L.eventLabel = () => (L.event && EVENTS[L.event.id].action ? EVENTS[L.event.id].action.label : null);
  function endEvent() {
    const e = L.event, def = e && EVENTS[e.id];
    if (def && def.end) def.end(e);
    L.event = null;
  }

  L.update = function (dt) {
    const g = G();
    if (!g.state || g.offline) return;
    wolfT -= dt; eventT -= dt;
    L.timers = () => ({ wolves: wolfT, event: eventT });
    if (wolfT <= 0) { wolfT = 300 + Math.random() * 300; if (g.villagerCount() >= 6 && !L.wolves.length && g.time > 240) spawnPack(); }
    if (eventT <= 0) { eventT = 200 + Math.random() * 220; if (!L.event) startEvent(); }
    if (L.event) { L.event.t -= dt; if (L.event.t <= 0) endEvent(); }
    if (L.wolves.length) updateWolves(dt);
    defenders(dt);
  };
  L.debug = { spawnPack, startEvent: id => { if (id) { const def = EVENTS[id], e = { id, name: def.name, desc: def.desc, t: def.dur, total: def.dur }; if (def.start(e) !== false) { L.event = def.dur ? e : null; toast('Evento: ' + e.name + ' — ' + e.desc + '.', 'epic'); } } else startEvent(); } };
})();
