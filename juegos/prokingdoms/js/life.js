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
  L.reset = function () { L.wolves = []; L.arrows = []; L.event = null; L.buff = 1; L.mods = []; L.fuego = null; };

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

  function scare(u, who) {
    if (u.carry) { u.carry = 0; u.carryRes = null; }
    const tc = G().buildings.find(b => b.owner === 'p' && b.type === 'tc' && b.done);
    u.scared = 5;
    if (tc) u.path = W.findPath(Math.floor(u.x), Math.floor(u.y), { x0: tc.x, y0: tc.y, x1: tc.x + tc.w - 1, y1: tc.y + tc.h - 1, adj: true }, 4000).path;
    if (!L.warned || G().time - L.warned > 20) { L.warned = G().time; toast('¡' + (who || 'Los lobos') + ' asustan a tus aldeanos! Huyen al Centro Urbano.', 'bad'); }
    sfx('hit');
  }

  L.scare = scare; // también asustan los bandidos (incursiones.js)

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
      // fn: flechas de otros (incursiones.js: torres contra bandidos y arqueros que salen a defender)
      if (a.t >= a.dur) { L.arrows.splice(L.arrows.indexOf(a), 1); if (a.fn) a.fn(a); else if (L.wolves.includes(a.w)) hurt(a.w, a.dmg, true); }
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
    else if (n.hierro) { const r = { starIron: 3 * era }; G().give(r); toast('El fragmento se agotó: +' + r.starIron + ' de hierro estelar.', 'epic'); sfx('coin'); }
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
  // ---------- Modificadores pasajeros ----------
  // Los ponen los eventos (cosecha récord, langostas, cometa, fiebre…): k → multiplicador por t segundos de juego.
  // Solo en vivo, como todo este archivo; no se guardan (al recargar se pierden, igual que L.buff).
  // Ganchos: gather (G.globalMult), craft (G.prodMult), farm (G.farmRate), research (G.researchMult),
  // cost (obras y mejoras), speed (aldeanos).
  L.mods = [];
  L.mod = k => L.mods.reduce((m, o) => (o.k === k ? m * o.v : m), 1);
  L.ponerMod = (k, v, t, de) => { L.mods.push({ k, v, t, de }); };
  L.quitarMods = de => { L.mods = L.mods.filter(o => o.de !== de); };

  // ---------- Fuego (evento «Incendio») ----------
  // Llamas y humo sobre el edificio; los aldeanos que mandas llevan un balde (render.js lo dibuja).
  L.fuego = null;
  function llamas(dt) {
    const b = L.fuego && G().bById.get(L.fuego.b);
    if (!b || !PK.Render.particles) return;
    L.fuego.fx = (L.fuego.fx || 0) - dt;
    if (L.fuego.fx > 0) return;
    L.fuego.fx = L.fuego.apaga ? 0.18 : 0.06;
    const [px, py] = PK.Render.iso(b.cx, b.cy), k = L.fuego.apaga ? 0.4 : 1;
    for (let i = 0; i < 3; i++) PK.Render.particles.push({ x: px + (Math.random() - 0.5) * 18 * b.w / 3, y: py - 18 - Math.random() * 10, vx: (Math.random() - 0.5) * 8, vy: -25 - Math.random() * 20, life: 0, max: 0.5 + Math.random() * 0.4, s: 1, rgb: Math.random() < 0.5 ? [255, 160, 40] : [255, 90, 30] });
    if (Math.random() < 0.5 * k + 0.3) PK.Render.particles.push({ x: px + (Math.random() - 0.5) * 12, y: py - 30, vx: (Math.random() - 0.5) * 6, vy: -14, life: 0, max: 1.4, s: 1, puff: L.fuego.apaga ? [220, 220, 230] : [70, 64, 60] });
  }
  function soltarBaldes(e) {
    for (const id of e.cuadrilla || []) { const u = G().uById.get(id); if (u) { u.balde = false; if (u.task && u.task.t === 'move') u.task = null; } }
    e.cuadrilla = [];
  }

  // ---------- Eventos con decisiones (H8 del plan, Anexo A7) ----------
  // opciones: botones; run(e) devuelve true si el evento termina ahí. defecto: el índice que se aplica solo si nadie
  // eligió cuando se acaba el tiempo (sin él, no pasa nada). cond(): si puede salir ahora. tick(e, dt): cada cuadro.
  const k = () => Math.pow(1.7, S().era - 1);
  const oro = n => Math.round(n * k());
  const recl = (r) => Object.keys(r).map(x => U.fmt(r[x]) + ' de ' + (x === 'coins' ? 'monedas' : D.RES[x].name.toLowerCase())).join(', ');
  const pagar = (cost, que) => { if (!G().canAfford(cost)) { toast('Te falta para ' + que + '.', 'warn'); return false; } G().pay(cost); return true; };
  const H = () => PK.Heroes;
  Object.assign(EVENTS, {
    incendio: {
      name: 'Incendio en el pueblo', dur: 60,
      start(e) {
        const bs = G().buildings.filter(b => b.owner === 'p' && b.done && !b.upg && b.type !== 'tc' && b.lvl >= 2 && !b.def.noUp);
        if (!bs.length) return false;
        const b = U.pick(bs);
        e.b = b.id; e.desc = '¡Arde tu ' + b.def.name + '! Si no se apaga, pierde un nivel';
        L.fuego = { b: b.id };
      },
      tick(e, dt) {
        llamas(dt);
        if (e.apagando === undefined) return;
        e.apagando -= dt;
        if (e.apagando <= 0) { e.apagado = true; toast('¡Apagaron el fuego! Tus aldeanos vuelven al trabajo.', 'good'); sfx('coin'); endEvent(); }
      },
      opciones: [
        { label: 'Mandar baldes', run(e) {
          const b = G().bById.get(e.b);
          if (!b || e.apagando !== undefined) return true;
          const vs = G().units.filter(u => u.owner === 'p' && u.kind === 'v' && !u.inside && !(u.scared > 0)).sort((a, c) => U.dist(a.x, a.y, b.cx, b.cy) - U.dist(c.x, c.y, b.cx, b.cy)).slice(0, 4);
          e.cuadrilla = vs.map(u => u.id);
          for (const u of vs) { G().assign(u, { t: 'move' }); u.balde = true; u.path = W.findPath(Math.floor(u.x), Math.floor(u.y), { x0: b.x, y0: b.y, x1: b.x + b.w - 1, y1: b.y + b.h - 1, adj: true }, 3000).path; }
          e.apagando = 12; L.fuego.apaga = true;
          e.desc = 'Tus aldeanos corren con baldes a la ' + b.def.name;
          return false;
        } },
        { label: 'Dejarlo arder', run() { return true; } },
      ],
      end(e) {
        soltarBaldes(e);
        L.fuego = null;
        const b = G().bById.get(e.b);
        if (!e.apagado && b && b.lvl > 1) { b.lvl--; if (G().invalidateCaps) G().invalidateCaps(); toast('El incendio dejó tu ' + b.def.name + ' en el nivel ' + b.lvl + '.', 'bad'); }
      },
    },
    langostas: {
      name: 'Plaga de langostas', desc: 'Las granjas rinden la mitad por 3 minutos', dur: 180,
      start(e) { L.ponerMod('farm', 0.5, 180, e); },
      opciones: [
        { label: 'Quemar los campos', run(e) { const n = Math.floor(S().res.food * 0.1); S().res.food -= n; L.quitarMods(e); toast('Quemaste los campos (−' + U.fmt(n) + ' de comida): la plaga se fue.', 'info'); return true; } },
        { label: 'Esperar', run(e) { e.esperar = true; return true; } },
      ],
      end(e) { if (!e.esperar) L.quitarMods(e); },
    },
    peregrinos: {
      era: 2, name: 'Peregrinos', dur: 90,
      start(e) { e.cost = { food: oro(150) }; e.desc = 'Piden ' + recl(e.cost) + ' para seguir su camino'; },
      opciones: [
        { label: 'Darles comida', run(e) { if (!pagar(e.cost, 'darles comida')) return false; L.ponerMod('gather', 1.1, 600, 'peregrinos'); toast('Los peregrinos te bendicen: +10% de recolección por 10 minutos.', 'good'); return true; } },
        { label: 'Negarla', run() { return true; } },
      ],
    },
    torneo: {
      era: 3, name: 'Torneo de caballeros', dur: 90,
      cond: () => !!(H() && H().libres().length),
      start(e) { e.desc = 'En el pueblo vecino: puedes inscribir a un héroe'; },
      opciones: [
        { label: 'Inscribir a un héroe', run() {
          const hs = H().libres().sort((a, b) => b.nivel - a.nivel), h = hs[0];
          if (!h) { toast('No tienes un héroe libre.', 'warn'); return false; }
          const ok = Math.random() < 0.35 + 0.015 * h.nivel;
          if (ok) { const r = { gold: oro(200) }; G().give(r); H().darXp(h, 60); toast('¡' + h.nombre + ' ganó el torneo! +' + recl(r) + '.', 'epic'); sfx('level'); }
          else { H().darXp(h, 20); toast(h.nombre + ' cayó en la final. Aprendió algo (+experiencia).', 'info'); }
          return true;
        } },
        { label: 'Mirar', run() { L.ponerMod('gather', 1.05, 300, 'torneo'); toast('El pueblo disfruta del torneo: +5% de recolección por 5 minutos.', 'good'); return true; } },
      ],
      defecto: 1,
    },
    rey: {
      era: 3, name: 'Visita del rey', dur: 90,
      start(e) { e.cost = { gold: oro(150) }; e.desc = 'Pide un tributo de ' + recl(e.cost); },
      opciones: [
        { label: 'Pagar', run(e) { if (!pagar(e.cost, 'pagar el tributo')) return false; L.ponerMod('gather', 1.15, 600, 'rey'); L.ponerMod('craft', 1.15, 600, 'rey'); toast('El rey se va contento: +15% de recolección y talleres por 10 minutos.', 'good'); return true; } },
        { label: 'Excusarse', run() { L.ponerMod('gather', 0.9, 300, 'rey'); toast('El rey se fue molesto: −10% de recolección por 5 minutos.', 'warn'); return true; } },
      ],
      defecto: 1,
    },
    cometa: {
      era: 2, name: 'Cometa en el cielo', desc: '+20% de investigación por 5 minutos', dur: 300,
      start(e) { L.ponerMod('research', 1.2, 300, e); },
      end(e) { L.quitarMods(e); },
    },
    inundacion: {
      name: 'Inundación', desc: 'El río crece: −30% de recolección por 2 minutos', dur: 120,
      start(e) { e.cost = { stone: oro(100) }; L.ponerMod('gather', 0.7, 120, e); },
      opciones: [
        { label: 'Levantar diques', run(e) { if (!pagar(e.cost, 'los diques')) return false; L.quitarMods(e); toast('Los diques aguantan (−' + recl(e.cost) + ').', 'good'); return true; } },
        { label: 'Esperar', run(e) { e.esperar = true; return true; } },
      ],
      end(e) { if (!e.esperar) L.quitarMods(e); },
    },
    ladron: {
      era: 2, name: 'Ladrón nocturno', desc: 'Roba oro de a poco', dur: 90,
      start(e) { e.robado = 0; },
      tick(e, dt) { const n = S().res.gold * 0.0004 * dt; S().res.gold -= n; e.robado += n; },
      opciones: [
        { label: 'Mandar la guardia', run(e) {
          const home = Object.values(S().war.army).reduce((s, n) => s + n, 0);
          if (home < 3) { toast('Necesitas 3 soldados en casa.', 'warn'); return false; }
          const r = { gold: Math.round(e.robado * 2 + oro(40)) }; G().give(r); e.robado = 0;
          toast('¡Atraparon al ladrón! Devuelve lo robado y algo más: +' + recl(r) + '.', 'good'); sfx('coin'); return true;
        } },
      ],
    },
    nino: {
      name: 'Niño perdido', desc: 'Se perdió en el bosque', dur: 120,
      opciones: [
        { label: 'Mandar al explorador', run() {
          if (!G().units.some(u => u.owner === 'p' && u.kind === 'scout')) { toast('Necesitas un explorador.', 'warn'); return false; }
          const r = { gold: oro(80), gems: 3 * S().era }; G().give(r); toast('El explorador lo trajo de vuelta. La familia agradece: +' + recl(r) + '.', 'epic'); return true;
        } },
        { label: 'Dejarlo a los pastores', run() { return true; } },
      ],
      defecto: 1,
    },
    boda: {
      era: 4, name: 'Boda real', dur: 90,
      start(e) { e.cost = { gold: oro(120) }; e.desc = 'Un reino vecino te invita (el regalo cuesta ' + recl(e.cost) + ')'; },
      opciones: [
        { label: 'Ir', run(e) { if (!pagar(e.cost, 'el regalo')) return false; const r = { gems: 6 * S().era, coins: 5 }; G().give(r); toast('Una gran fiesta. Te devuelven el gesto: +' + recl(r) + '.', 'epic'); return true; } },
        { label: 'Declinar', run() { return true; } },
      ],
    },
    mapas: {
      era: 2, name: 'Mercader de mapas', dur: 90,
      cond: () => !!PK.Aventura,
      start(e) { e.cost = { gold: oro(120) }; e.desc = 'Vende un mapa del tesoro por ' + recl(e.cost); },
      opciones: [
        { label: 'Comprar', run(e) { if (!pagar(e.cost, 'el mapa')) return false; PK.Aventura.nuevoMapa('mercader', Date.now() % 100000); return true; } },
        { label: 'Regatear', run(e) {
          if (Math.random() < 0.5) { const c = { gold: Math.ceil(e.cost.gold / 2) }; if (!pagar(c, 'el mapa')) return false; toast('Aceptó la mitad.', 'good'); PK.Aventura.nuevoMapa('mercader', Date.now() % 100000); }
          else toast('El mercader se ofendió y se fue.', 'warn');
          return true;
        } },
      ],
    },
    grifo: {
      era: 4, name: 'Huevos de grifo', desc: 'Los encontraron en las rocas', dur: 90,
      opciones: [
        { label: 'Criarlos', run() {
          if (!G().countB('beasthouse') || !H()) { toast('Hace falta la Casa de Fieras.', 'warn'); return false; }
          const it = H().guardarObjeto(Object.assign(H().crearObjeto(0.9, 1), { t: 'talisman', r: 2 }));
          if (it) toast('Un grifo joven para tus héroes: ' + H().itemNombre(it) + '.', 'epic');
          return true;
        } },
        { label: 'Venderlos', run() { const r = { gold: oro(300) }; G().give(r); toast('Los huevos se vendieron: +' + recl(r) + '.', 'good'); return true; } },
      ],
      defecto: 1,
    },
    terremoto: {
      era: 3, name: 'Terremoto', desc: 'Un temblor dejó al descubierto una veta de gemas', dur: 240,
      start(e) { e.node = tempNode('gems', 120 + 40 * S().era, D.PLAYER_HOME); if (!e.node) return false; e.node.star = true; },
      end(e) { if (e.node && !e.node.dead) removeTemp(e.node); },
      action: { label: 'Ver', run(e) { PK.Render.centerOn(e.node.x, e.node.y); return false; } },
    },
    bardo: {
      era: 2, name: 'Bardo errante', desc: '+10% de recolección por 10 minutos', dur: 90,
      start(e) { e.cost = { gold: oro(100) }; L.ponerMod('gather', 1.1, 600, 'bardo'); },
      opciones: [
        { label: 'Pagarle una hora', run(e) { if (!pagar(e.cost, 'el bardo')) return false; L.quitarMods('bardo'); L.ponerMod('gather', 1.1, 3600, 'bardo'); toast('El bardo se queda una hora: +10% de recolección.', 'good'); return true; } },
      ],
    },
    cosecha: {
      name: 'Cosecha récord', desc: 'Las granjas rinden el doble por 2 minutos', dur: 120,
      start(e) { L.ponerMod('farm', 2, 120, e); },
      end(e) { L.quitarMods(e); },
    },
    fiebre: {
      era: 3, name: 'Fiebre en el pueblo', desc: 'Tus aldeanos van un 20% más lentos', dur: 180,
      start(e) { L.ponerMod('speed', 0.8, 180, e); },
      opciones: [
        { label: 'Curarlos', run(e) {
          const clériga = H() && H().lista().some(h => h.clase === 'clerigo' && h.estado === 'libre');
          if (!G().countB('monastery') && !clériga) { toast('Hace falta un Monasterio o la Clériga en casa.', 'warn'); return false; }
          L.quitarMods(e); toast('La fiebre pasó.', 'good'); return true;
        } },
        { label: 'Esperar', run(e) { e.esperar = true; return true; } },
      ],
      end(e) { if (!e.esperar) L.quitarMods(e); },
    },
    constructores: {
      era: 2, name: 'Gremio de constructores', desc: 'Obras y mejoras un 20% más baratas por 5 minutos', dur: 300,
      start(e) { L.ponerMod('cost', 0.8, 300, e); },
      end(e) { L.quitarMods(e); },
    },
    espia: {
      era: 3, name: 'Espía capturado', desc: 'Dice saber dónde hay algo escondido', dur: 90,
      opciones: [
        { label: 'Interrogarlo', run() {
          const st = S(), [hx, hy] = D.PLAYER_HOME, p = W.pois.filter(q => (D.DUNGEON[q.kind] || q.kind === 'camp' || q.kind === 'relic') && !(st.pois[q.id] && st.pois[q.id].f)).sort((a, b) => U.dist(a.x, a.y, hx, hy) - U.dist(b.x, b.y, hx, hy))[0];
          if (!p) { toast('No sabía nada que no supieras.', 'info'); return true; }
          st.pois[p.id] = { f: 1, scan: 1 };
          if (D.DUNGEON[p.kind]) PK.Exp.found(p); else toast('El espía habló: ' + D.POI[p.kind].name.toLowerCase() + ' marcado en el mapa.', 'quest');
          return true;
        } },
        { label: 'Liberarlo', run() { const r = { gems: 2 * S().era }; G().give(r); toast('Agradecido, deja ' + recl(r) + '.', 'info'); return true; } },
      ],
      defecto: 1,
    },
    desertores: {
      era: 2, name: 'Desertores', desc: 'Diez soldados piden entrar a tu ejército', dur: 90,
      cond: () => G().countB('barracks') > 0,
      opciones: [
        { label: 'Aceptarlos', run() { S().war.army.militia = (S().war.army.militia || 0) + 10; toast('Diez milicianos se suman a tu Cuartel.', 'good'); return true; } },
        { label: 'Rechazarlos', run() { return true; } },
      ],
    },
    meteoritos: {
      era: 4, name: 'Lluvia de meteoros', desc: 'Cayeron fragmentos con hierro estelar', dur: 240,
      start(e) {
        e.nodes = [];
        for (let i = 0; i < 3; i++) { const n = tempNode('gems', 40 + 15 * S().era, D.PLAYER_HOME); if (!n) continue; n.hierro = true; e.nodes.push(n); if (PK.Render.meteor) PK.Render.meteor(n.x, n.y); }
        return e.nodes.length > 0;
      },
      end(e) { for (const n of e.nodes) if (!n.dead) removeTemp(n); },
      action: { label: 'Ver', run(e) { const n = e.nodes.find(o => !o.dead); if (n) PK.Render.centerOn(n.x, n.y); return false; } },
    },
    // Eventos de temporada (Fase 3, V3): uno por estación, solo mientras dura (Vida.estacion sale del reloj real).
    feria: {
      era: 2, name: 'Feria de primavera', dur: 120, cond: () => est() === 0,
      start(e) { e.cost = { food: oro(150) }; e.desc = 'Los pueblos vecinos traen sus flores y semillas'; },
      opciones: [
        { label: 'Montar puestos', run(e) { if (!pagar(e.cost, 'los puestos')) return false; L.ponerMod('farm', 1.4, 300, e); const r = { gold: oro(90) }; G().give(r); toast('¡Feria! +' + recl(r) + ' y granjas +40% por 5 minutos.', 'epic'); sfx('coin'); return true; } },
        { label: 'Solo mirar', run() { return true; } },
      ],
      defecto: 1,
    },
    torneo: {
      era: 3, name: 'Torneo de verano', dur: 120, cond: () => est() === 1,
      start(e) { e.desc = 'Caballeros de todo el reino se miden en la plaza'; },
      opciones: [
        { label: 'Inscribir a un héroe', run() {
          const h = PK.Heroes && PK.Heroes.lista().find(o => o.estado === 'libre');
          if (!h) { toast('Necesitas un héroe libre.', 'warn'); return false; }
          // el resultado sale del día y del héroe: recargar no lo cambia
          const gana = U.rng(U.strHash('torneo:' + U.dayKey() + ':' + h.id))() < 0.35 + 0.015 * h.nivel;
          PK.Heroes.darXp(h, 30 + 6 * S().era);
          const r = gana ? { gold: oro(220), gems: 4 * S().era } : { gold: oro(40) };
          G().give(r); toast(h.nombre + (gana ? ' ganó el torneo: +' : ' perdió con honor: +') + recl(r) + ' y experiencia.', gana ? 'epic' : 'good'); return true;
        } },
        { label: 'Mirar desde las gradas', run() { L.ponerMod('gather', 1.1, 180); toast('El pueblo vuelve contento: +10% de recolección por 3 minutos.', 'good'); return true; } },
      ],
      defecto: 1,
    },
    cosechaOtono: {
      era: 2, name: 'Cosecha de otoño', desc: 'Los frutales están cargados: +60% de bayas y granjas', dur: 150, cond: () => est() === 2,
      start(e) { L.ponerMod('farm', 1.6, 150, e); },
      end(e) { L.quitarMods(e); },
    },
    inviernoFest: {
      era: 2, name: 'Festival de invierno', dur: 120, cond: () => est() === 3,
      start(e) { e.cost = { wood: oro(160) }; e.desc = 'Hogueras, villancicos y vino caliente'; },
      opciones: [
        { label: 'Encender las hogueras', run(e) { if (!pagar(e.cost, 'las hogueras')) return false; L.ponerMod('speed', 1.15, 300, e); L.ponerMod('craft', 1.15, 300, e); toast('¡Festival! Aldeanos +15% más rápidos y talleres +15% por 5 minutos.', 'epic'); return true; } },
        { label: 'Quedarse en casa', run() { return true; } },
      ],
      defecto: 1,
    },
  });
  const est = () => (PK.Vida ? PK.Vida.estacion() : -1);
  function startEvent() {
    const ids = Object.keys(EVENTS).filter(id => (EVENTS[id].era || 0) <= S().era && (!EVENTS[id].cond || EVENTS[id].cond()));
    for (let k = 0; k < 5; k++) {
      let id = U.pick(ids);
      // Mercaderes amigos / Diplomacia (Fase 3): el mercader errante pasa el doble
      if (id !== 'merchant' && ids.includes('merchant') && G().bono && G().bono('mercader') && Math.random() < 1 / ids.length) id = 'merchant';
      const def = EVENTS[id], e = { id, name: def.name, desc: def.desc, t: def.dur, total: def.dur };
      if (def.start && def.start(e) === false) continue;
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
  // Eventos con opciones (H8): los botones, y elegir uno. Si nadie elige, al acabarse el tiempo va la opción por defecto.
  L.eventOptions = () => (L.event && EVENTS[L.event.id].opciones && !L.event.elegido ? EVENTS[L.event.id].opciones.map((o, i) => ({ label: o.label, i, defecto: EVENTS[L.event.id].defecto === i })) : []);
  L.eventChoose = function (i) {
    const e = L.event, def = e && EVENTS[e.id], o = def && def.opciones && def.opciones[i];
    if (!o || e.elegido) return;
    const fin = o.run(e);
    if (fin === false && e.apagando === undefined) return; // no se pudo (falta oro…): sigue esperando
    e.elegido = true;
    if (fin) endEvent();
  };
  function endEvent() {
    const e = L.event, def = e && EVENTS[e.id];
    if (!e) return;
    L.event = null;
    if (def && def.opciones && !e.elegido && def.defecto !== undefined) { e.elegido = true; def.opciones[def.defecto].run(e); }
    if (def && def.end) def.end(e);
  }

  L.update = function (dt) {
    const g = G();
    if (!g.state || g.offline) return;
    wolfT -= dt; eventT -= dt;
    L.timers = () => ({ wolves: wolfT, event: eventT });
    if (wolfT <= 0) { wolfT = 300 + Math.random() * 300; if (g.villagerCount() >= 6 && !L.wolves.length && g.time > 240) spawnPack(); }
    if (eventT <= 0) { eventT = 200 + Math.random() * 220; if (!L.event) startEvent(); }
    if (L.event) { const def = EVENTS[L.event.id]; if (def.tick) def.tick(L.event, dt); if (L.event) { L.event.t -= dt; if (L.event.t <= 0) endEvent(); } }
    if (L.mods.length) { for (const o of L.mods) o.t -= dt; L.mods = L.mods.filter(o => o.t > 0); }
    if (L.wolves.length) updateWolves(dt);
    defenders(dt);
  };
  L.EVENTS = EVENTS;
  L.debug = { spawnPack, startEvent: id => { if (id) { const def = EVENTS[id], e = { id, name: def.name, desc: def.desc, t: def.dur, total: def.dur }; if (!def.start || def.start(e) !== false) { L.event = def.dur ? e : null; toast('Evento: ' + e.name + ' — ' + e.desc + '.', 'epic'); } } else startEvent(); } };
})();
