// Tropas en el mapa: la guarnición que entrena frente al Cuartel, las columnas que marchan a una mazmorra,
// a un campamento, a un encargo o a una campaña de territorio (y vuelven), y la pelea al llegar.
// Es solo dibujo: las batallas las resuelven expeditions.js, social.js y terr.js por tiempo, igual que
// antes, así que nada de esto entra en el guardado ni lo ve el servidor.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const T = (PK.Troops = { fights: [], texts: [] });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  // herramienta con la que pelea cada tropa (los arqueros y los clérigos pelean quietos, con su arma)
  const FIGHT_TOOL = { militia: 'hammer', spear: 'spear', knight: 'sword', catapult: 'hammer' };

  // n figuras repartidas según la composición de la compañía (al menos una de cada tipo presente).
  function pickTypes(units, n) {
    const ks = Object.keys(units || {}).filter(k => units[k] > 0 && D.ARMY[k]);
    const tot = ks.reduce((s, k) => s + units[k], 0);
    if (!tot) return [];
    n = Math.min(n, tot);
    const out = [];
    ks.sort((a, b) => units[b] - units[a]);
    for (const k of ks) if (out.length < n) out.push(k);
    for (const k of ks) { const want = Math.round((units[k] / tot) * n); while (out.filter(x => x === k).length < want && out.length < n) out.push(k); }
    while (out.length < n) out.push(ks[0]);
    return out;
  }
  T.pickTypes = pickTypes;
  T.soldierItem = (...a) => soldierItem(...a); // también lo usan los defensores de incursiones.js
  T.total = units => Object.keys(units || {}).reduce((s, k) => s + (units[k] || 0), 0);

  // De dónde salen: el Cuartel más cercano al destino (o el Centro Urbano), por su frente.
  function homeFor(tx, ty) {
    const g = G();
    let best = null, bd = 1e9;
    for (const b of g.buildings) {
      if (b.owner !== 'p' || !b.done || (b.type !== 'barracks' && b.type !== 'tc')) continue;
      const d = U.dist(b.cx, b.cy, tx, ty) + (b.type === 'tc' ? 1000 : 0);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return D.PLAYER_HOME.slice();
    const p = W.freeAround(best.x, best.y, best.x + best.w - 1, best.y + best.h - 1, best.x + best.w, best.y + best.h);
    return [p[0] + 0.5, p[1] + 0.5];
  }

  // Ruta de la marcha: A* una sola vez por destino (en línea recta si no hay camino), con largos acumulados.
  const routes = new Map();
  function route(from, to) {
    const key = Math.floor(from[0]) + ',' + Math.floor(from[1]) + '>' + Math.floor(to[0]) + ',' + Math.floor(to[1]);
    let r = routes.get(key);
    if (r) return r;
    if (routes.size > 40) routes.clear();
    const tx = U.clamp(Math.floor(to[0]), 0, W.W - 1), ty = U.clamp(Math.floor(to[1]), 0, W.H - 1);
    let pts = [from];
    try {
      const res = W.findPath(Math.floor(from[0]), Math.floor(from[1]), { x0: tx, y0: ty, x1: tx, y1: ty, adj: true }, 40000);
      if (res && res.path && res.path.length) pts = pts.concat(res.path.map(p => [p[0] + 0.5, p[1] + 0.5]));
    } catch (e) { /* sin ruta: en línea recta */ }
    pts.push(to);
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + U.dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
    r = { pts, len, L: len[len.length - 1] || 1 };
    routes.set(key, r);
    return r;
  }
  function along(r, d) {
    d = U.clamp(d, 0, r.L);
    let i = 1;
    while (i < r.pts.length - 1 && r.len[i] < d) i++;
    const a = r.pts[i - 1], b = r.pts[i], seg = Math.max(1e-6, r.len[i] - r.len[i - 1]), k = U.clamp((d - r.len[i - 1]) / seg, 0, 1);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, (b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
  }

  // Encargos del tablón: no están en el mapa; la columna sale del reino hacia un rumbo fijo y se pierde a lo lejos.
  function missionSpot(id) {
    const a = U.hash(id, 7, 3) * Math.PI * 2, [hx, hy] = D.PLAYER_HOME;
    return [U.clamp(hx + Math.cos(a) * 30, 2, W.W - 3), U.clamp(hy + Math.sin(a) * 30, 2, W.H - 3)];
  }
  T.targetOf = function (r) {
    const id = r.poi !== undefined && r.poi !== null ? r.poi : r.camp;
    if (id !== undefined && id !== null && W.pois[id]) { const p = W.pois[id]; return [p.x + p.w / 2, p.y + p.h / 2]; }
    if (r.k !== undefined && PK.Terr) return PK.Terr.center(r.k);
    if (r.cap && PK.Campana && PK.Campana.lugar(r.cap)) { const l = PK.Campana.lugar(r.cap); return [l.x + 0.5, l.y + 0.5]; }
    return missionSpot(r.id || 1);
  };

  // Todas las columnas en marcha: { key, units, from, to, f (0 = en casa, 1 = en el destino), back }.
  T.marches = function () {
    const st = S(), now = Date.now(), out = [];
    if (!st) return out;
    for (const r of (st.exp && st.exp.runs) || []) {
      const adentro = r.phase === 'battle' || r.phase === 'sala' || r.phase === 'fin'; // en el destino (incursión: entre salas)
      const go = r.phase === 'go' || adentro, ms = Math.max(1, r.travel * 1000);
      const f = adentro ? 1 : go ? 1 - (r.arrive - now) / ms : (r.back - now) / ms; // en batalla, en el destino
      out.push({ key: 'x' + r.id, units: r.units, to: T.targetOf(r), f: U.clamp(f, 0, 1), back: !go, name: r.name, heroe: r.heroe });
    }
    for (const e of (st.war && st.war.exps) || []) {
      if (e.camp === undefined) continue;
      const k = Math.min(1, e.t / Math.max(1, e.travel));
      out.push({ key: 'c' + e.camp, units: e.units, to: T.targetOf({ camp: e.camp }), f: e.phase === 'go' ? k : 1 - k, back: e.phase !== 'go', name: 'un campamento de bandidos' });
    }
    for (const c of (st.terr && st.terr.camps) || []) {
      const go = c.phase === 'go', ms = Math.max(1, (c.travel || 60) * 1000);
      const f = go ? 1 - (c.arrive - now) / ms : (c.back - now) / ms;
      out.push({ key: 't' + c.k + (c.rid || ''), units: c.units, to: PK.Terr.center(c.k), f: U.clamp(f, 0, 1), back: !go, name: 'una campaña' });
    }
    for (const m of out) m.from = homeFor(m.to[0], m.to[1]);
    return out;
  };

  // Dónde va ahora una columna (para el botón «Ver»).
  T.where = function (key) {
    const m = T.marches().find(o => o.key === key);
    if (!m) return null;
    const r = route(m.from, m.to), p = along(r, m.f * r.L);
    return [p[0], p[1]];
  };

  const faceOf = (dx, dy) => ({ flip: dx - dy < 0, back: dx + dy < 0 });
  function soldierItem(type, x, y, mode, frame, flip, back, tool, id, extra) {
    const [px, py] = PK.Render.iso(x, y);
    const spr = type === 'catapult' ? Sp.cart(D.PLAYER_COLOR, 'stone', flip, frame % 4, mode === 'walk') : Sp.troop(type, Sp.colorDeTropa ? Sp.colorDeTropa(type) : D.PLAYER_COLOR, mode, frame, flip, back, tool, id);
    return Object.assign({ d: x + y, k: 'troop', o: extra || {}, spr, x: px - spr.ax, y: py - spr.ay, px, py }, {});
  }
  function banner(it, flip) {
    it.after = ctx => {
      const x = Math.round(it.px + (flip ? -6 : 5)), y = Math.round(it.py);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x, y - 30, 1, 20);
      ctx.fillStyle = 'rgb(' + D.PLAYER_COLOR.join(',') + ')';
      const w = 7, wave = Math.floor(performance.now() / 180) % 2;
      ctx.fillRect(flip ? x - w : x + 1, y - 30 + wave, w, 5);
      ctx.fillStyle = '#e8b83a'; ctx.fillRect(flip ? x - w : x + 1, y - 26 + wave, w, 1);
    };
  }

  // ---------- Guarnición ----------
  // Los soldados en casa forman frente al Cuartel; los de cuerpo a cuerpo practican de a pares.
  const slotCache = new Map();
  function slotsOf(b) {
    const c = slotCache.get(b.id);
    if (c && performance.now() - c.at < 3000) return c.list;
    const list = [];
    for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) continue;
      if (!W.passable(x, y) || W.bAt[W.idx(x, y)] >= 0 || (W.wall && W.wall[W.idx(x, y)])) continue;
      list.push([x, y]);
    }
    list.sort((a, c2) => (c2[0] + c2[1]) - (a[0] + a[1])); // primero el frente (lo que se ve)
    const pos = [];
    for (const [x, y] of list.slice(0, 7)) pos.push([x + 0.3, y + 0.35], [x + 0.75, y + 0.7]);
    slotCache.set(b.id, { at: performance.now(), list: pos });
    return pos;
  }
  function garrison(items) {
    const g = G(), st = S(), army = st && st.war && st.war.army;
    if (!army) return;
    if (PK.Incursiones && PK.Incursiones.defensores.length) return; // salieron a pelear contra los bandidos
    const bars = g.buildings.filter(b => b.owner === 'p' && b.done && b.type === 'barracks');
    if (!bars.length) return;
    const types = pickTypes(army, 12 * bars.length), now = performance.now() / 1000;
    let i = 0;
    for (const b of bars) {
      const slots = slotsOf(b);
      for (let j = 0; j < slots.length && i < types.length; j++, i++) {
        const type = types[i], [x, y] = slots[j], ph = (now + i * 0.9) % 7, melee = !!FIGHT_TOOL[type] && type !== 'catapult';
        const drill = melee && ph < 3; // de a pares: uno mira a la derecha y el otro a la izquierda
        const flip = j % 2 === 1, frame = drill ? Math.floor((now * 1.3 + j * 0.37) * 4) % 4 : 0;
        items.push(soldierItem(type, x, y, drill ? 'work' : 'idle', frame, flip, false, drill ? FIGHT_TOOL[type] : null, i, { home: true }));
      }
    }
  }

  // ---------- Columnas en marcha ----------
  function marches(items) {
    const now = performance.now() / 1000;
    for (const m of T.marches()) {
      const r = route(m.from, m.to), dir = m.back ? -1 : 1, d0 = m.f * r.L;
      if ((m.f <= 0.001 && !m.back) || (m.back && m.f <= 0.001)) continue; // todavía en el Cuartel o ya llegaron
      const types = pickTypes(m.units, 6);
      types.forEach((type, i) => {
        const d = d0 - dir * i * 0.6, [x, y, dx, dy] = along(r, d), side = (i % 2 ? 1 : -1) * (i ? 0.22 : 0);
        const fx = dx * dir, fy = dy * dir, f = faceOf(fx, fy);
        const it = soldierItem(type, x - fy * side, y + fx * side, 'walk', Math.floor(now * 9 + i * 1.7) % 6, f.flip, f.back, null, i, { march: m });
        if (!i) banner(it, f.flip);
        items.push(it);
      });
      // el héroe va adelante de la columna, con su estrella (H2)
      const h = m.heroe && PK.Heroes ? PK.Heroes.de(m.heroe) : null;
      if (h) {
        const c = PK.Heroes.CLASES[h.clase], [x, y, dx, dy] = along(r, d0 + dir * 0.7), f = faceOf(dx * dir, dy * dir), [px, py] = PK.Render.iso(x, y);
        const spr = Sp.villager(c.col, 1, 1, 'walk', Math.floor(now * 9) % 6, null, f.flip, null, false, f.back, null, c.look);
        items.push({ d: x + y, k: 'troop', o: { march: m, heroe: h.id }, spr, x: px - spr.ax, y: py - spr.ay, px, py, after: ctx => { ctx.fillStyle = '#ffd860'; ctx.font = 'bold 7px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.fillText('★', Math.round(px), Math.round(py - 26)); } });
      }
    }
  }

  // ---------- Peleas ----------
  // Al llegar: las dos líneas chocan unos segundos (polvo y chispas) y después queda en pie el que ganó.
  T.fight = function (x, y, o) {
    if (G().offline || !o) return;
    const from = homeFor(x, y), dx = from[0] - x, dy = from[1] - y, l = Math.hypot(dx, dy) || 1;
    const en = o.enemy || { bandit: 1 }, top = Object.keys(en).sort((a, b) => en[b] - en[a])[0];
    T.fights.push({ x, y, ux: dx / l, uy: dy / l, t: 0, dur: 5.5, won: !!o.won, types: pickTypes(o.units, 4), enemy: top, said: false });
    if (T.fights.length > 4) T.fights.shift();
  };
  const ENEMY_COL = { bandit: [70, 44, 40], undead: [176, 176, 164] };
  function enemyItem(kind, x, y, flip, frame, i) {
    const [px, py] = PK.Render.iso(x, y);
    let spr;
    if (kind === 'beast' || kind === 'dragon') spr = Sp.wolf[flip ? 1 : 0][frame % 2];
    else if (kind === 'golem') spr = Sp.rocks.stone[2][i % 2];
    else spr = Sp.villager(ENEMY_COL[kind] || ENEMY_COL.bandit, 1 + (i % 2), kind === 'undead' ? 0 : 2, 'work', frame % 4, null, flip, 'knife');
    return { d: x + y, k: 'troop', o: { enemy: true }, spr, x: px - spr.ax, y: py - spr.ay, px, py };
  }
  function fights(items, dt) {
    for (const f of T.fights.slice()) {
      f.t += dt;
      if (f.t > f.dur + 2.5) { T.fights.splice(T.fights.indexOf(f), 1); continue; }
      const clash = f.t < f.dur, now = f.t, px = -f.uy, py = f.ux;
      const mine = clash || f.won, theirs = clash || !f.won;
      if (mine) f.types.forEach((type, i) => {
        const off = (i - (f.types.length - 1) / 2) * 0.7, x = f.x + f.ux * 0.9 + px * off, y = f.y + f.uy * 0.9 + py * off, fc = faceOf(-f.ux, -f.uy);
        const tool = FIGHT_TOOL[type];
        items.push(soldierItem(type, x, y, clash && tool ? 'work' : 'idle', Math.floor((now * 1.4 + i * 0.3) * 4) % 4, fc.flip, fc.back, clash ? tool : null, i, { fight: f }));
      });
      if (theirs) for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 0.75, x = f.x - f.ux * 0.2 + px * off, y = f.y - f.uy * 0.2 + py * off, fc = faceOf(f.ux, f.uy);
        items.push(enemyItem(f.enemy, x, y, fc.flip, Math.floor(now * 6 + i), i));
      }
      if (clash && Math.random() < dt * 9) {
        const [cx, cy] = PK.Render.iso(f.x + f.ux * 0.35 + (Math.random() - 0.5) * 1.6 * px, f.y + f.uy * 0.35 + (Math.random() - 0.5) * 1.6 * py);
        PK.Render.particles.push({ x: cx, y: cy - 4, vx: (Math.random() - 0.5) * 14, vy: -6 - Math.random() * 6, life: 0, max: 0.8, s: 1, puff: [196, 176, 140] });
        if (Math.random() < 0.5) PK.Render.particles.push({ x: cx, y: cy - 10, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 20, life: 0, max: 0.25, s: 1, rgb: [255, 236, 170] });
        if (PK.Sfx && Math.random() < 0.25) PK.Sfx.play(Math.random() < 0.5 ? 'hit' : 'pick');
      }
      if (!clash && !f.said) {
        f.said = true;
        T.texts.push({ x: f.x, y: f.y, t: 0, text: f.won ? '¡Victoria!' : 'Derrota', col: f.won ? '#ffe27a' : '#ff8a70' });
        if (f.won && PK.Render.burst) PK.Render.burst(f.x, f.y, null, 40);
        if (PK.Sfx) PK.Sfx.play(f.won ? 'level' : 'hit');
      }
    }
  }

  // Lo que dibuja render.js junto con aldeanos y edificios (ordenado por profundidad).
  T.collect = function (list, dt, vis) {
    if (!S()) return;
    const items = [];
    garrison(items);
    marches(items);
    fights(items, dt);
    for (const it of items) if (vis(it.x, it.y, it.spr.k ? it.spr.w : it.spr.c.width, it.spr.k ? it.spr.h : it.spr.c.height)) list.push(it);
  };
  // Textos grandes sobre la pelea (en coordenadas de pantalla).
  T.drawTexts = function (ctx, s, ox, oy, dpr, dt) {
    for (const tx of T.texts.slice()) {
      tx.t += dt;
      if (tx.t > 2.6) { T.texts.splice(T.texts.indexOf(tx), 1); continue; }
      const [wx, wy] = PK.Render.iso(tx.x, tx.y), sx = wx * s + ox, sy = (wy - 34 - tx.t * 10) * s + oy;
      ctx.globalAlpha = Math.min(1, 3 - tx.t * 1.1);
      ctx.font = 'bold ' + 16 * dpr + 'px "PK Num", "Pixelify Sans", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(tx.text, sx + 2 * dpr, sy + 2 * dpr);
      ctx.fillStyle = tx.col; ctx.fillText(tx.text, sx, sy);
      ctx.globalAlpha = 1;
    }
  };
})();
