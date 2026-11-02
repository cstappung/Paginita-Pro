// Automatización: el Capataz reparte a los aldeanos ociosos según tus prioridades, el Centro Urbano puede
// entrenar sin parar y los Maestros de Obras toman solas las mejoras de una cola. Todo sigue funcionando
// mientras no estás (dentro del cálculo offline).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const A = (PK.Auto = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;

  A.RES = ['food', 'wood', 'stone', 'gold', 'ore', 'marble', 'gems'];
  A.QMAX = 6;
  A.init = function (st) {
    st.auto = Object.assign({ idle: true, work: true, train: false, reserve: 0.3, w: { food: 4, wood: 4, stone: 2, gold: 2, ore: 0, marble: 0, gems: 0 } }, st.auto || {});
    st.upq = (st.upq || []).filter(id => G().bById.get(id));
  };

  // Cuántos aldeanos hay en cada recurso (contando granjeros como comida).
  A.counts = function () {
    const c = {};
    let n = 0;
    for (const u of G().units) {
      if (u.owner !== 'p' || u.kind !== 'v' || !u.task) continue;
      const r = u.task.t === 'gather' ? u.task.res : u.task.t === 'farm' ? 'food' : null;
      if (r) { c[r] = (c[r] || 0) + 1; n++; }
    }
    return { c, n };
  };

  // Recurso más cercano al punto de acopio que corresponde (así los viajes son cortos).
  function targetFor(u, res) {
    const g = G();
    if (res === 'food') {
      let best = null, bd = 1e9;
      for (const b of g.buildings) {
        if (b.owner !== 'p' || b.type !== 'farm' || !b.done || (b.farmer !== null && g.uById.get(b.farmer))) continue;
        const d = U.dist(u.x, u.y, b.cx, b.cy);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) return { kind: 'building', obj: best };
    }
    const drop = g.findDrop('p', res, u.x, u.y);
    // cerca del punto de acopio; si ya se agotó todo alrededor, lo que haya aunque quede lejos
    const n = (drop && W.nearestNode(res, drop.cx, drop.cy, 40, 'p')) || W.nearestNode(res, u.x, u.y, 100, 'p');
    return n ? { kind: 'node', obj: n } : null;
  }

  function assignIdle(u, st) {
    const g = G();
    // primero, puestos libres en talleres que tengan insumos
    if (st.auto.work) {
      for (const b of g.buildings) {
        if (b.owner !== 'p' || !b.done || !b.def.recipe || b.workers.length >= g.slots(b)) continue;
        const rc = D.RECIPES[b.def.recipe];
        if (!g.reserveOk(rc.in, Object.keys(rc.out)[0]) && !PK.Logi.carts().length) continue;
        if (!PK.Logi.nearStore(b) && !PK.Logi.carts().length && !S().logi.belts.some(bl => bl.b === b.id)) continue; // sin abastecimiento no sirve de nada
        const reserved = g.units.filter(o => o.task && o.task.t === 'work' && o.task.b === b.id && !o.inside).length;
        if (b.workers.length + reserved >= g.slots(b)) continue;
        g.command([u], { kind: 'building', obj: b }, true);
        return true;
      }
    }
    const w = st.auto.w, sum = A.RES.reduce((s, r) => s + (w[r] || 0), 0);
    if (!sum) return false;
    const { c, n } = A.counts();
    const order = A.RES.filter(r => w[r] > 0).sort((a, b) => (w[b] / sum - (c[b] || 0) / (n + 1)) - (w[a] / sum - (c[a] || 0) / (n + 1)));
    for (const r of order) {
      const t = targetFor(u, r);
      if (t && g.command([u], t, true)) return true;
    }
    return false;
  }

  let t = 0;
  A.tick = function (dt) {
    const st = S(), g = G();
    if (!st || !st.auto) return;
    for (const u of g.units) if (u.owner === 'p' && u.kind === 'v') u.idleT = !u.task && !u.inside ? (u.idleT || 0) + dt : 0;
    t += dt;
    if (t < 1) return;
    t = 0;
    if (st.auto.idle) {
      let k = 0;
      for (const u of g.units) {
        if (u.owner !== 'p' || u.kind !== 'v' || u.task || u.inside || u.idleT < 3 || u.scared > 0) continue;
        if (assignIdle(u, st)) u.idleT = 0;
        if (++k > 12) break; // reparte de a poco para no buscar rutas de golpe
      }
    }
    // talleres parados (sin insumos, en reserva o con el almacén lleno): sus trabajadores salen a recolectar
    if (st.auto.work) {
      for (const b of g.buildings) {
        if (b.owner !== 'p' || !b.def.recipe || !b.workers.length) continue;
        // si una carreta o una cinta ya trae lo que falta, no cuenta como parado
        const coming = b.status === 'Faltan insumos' && (PK.Logi.carts().some(c => c.job && c.job.to === b.id) || st.logi.belts.some(x => x.b === b.id && x.items.length));
        b.stallT = b.status === 'Produciendo' || coming ? 0 : (b.stallT || 0) + 1;
        if (b.stallT < 20) continue;
        b.stallT = 0;
        for (const id of b.workers.slice()) { const u = g.uById.get(id); if (u) { g.release(u); u.task = null; u.mode = 'idle'; } }
      }
    }
    if (st.auto.train) {
      for (const b of g.buildings) {
        if (b.owner !== 'p' || b.type !== 'tc' || !b.done || b.queue.length >= 2) continue;
        const queued = g.buildings.reduce((s, o) => s + (o.owner === 'p' ? o.queue.length : 0), 0);
        if (g.pop() + queued < g.popCap() && st.res.food >= D.VILLAGER.cost.food + 30) g.train(b, 1);
      }
    }
    // cola de obras
    while (st.upq.length && g.buildersBusy() < g.builders()) {
      const b = g.bById.get(st.upq[0]);
      if (!b || b.owner !== 'p' || b.upg || b.lvl >= g.maxLvl(b.type) || b.def.noUp) { st.upq.shift(); continue; }
      if (!b.done || !g.canAfford(g.upCost(b))) break;
      g.upgrade(b);
      st.upq.shift();
    }
  };

  A.queued = b => S().upq.includes(b.id);
  A.enqueue = function (b) {
    const q = S().upq;
    if (q.includes(b.id)) return;
    if (q.length >= A.QMAX) { PK.UI.toast('La cola de obras admite ' + A.QMAX + ' mejoras.', 'warn'); return; }
    q.push(b.id);
    PK.UI.toast(b.def.name + ' en la cola de obras: un maestro lo tomará cuando haya recursos.', 'info');
  };
  A.dequeue = function (b) { const q = S().upq, i = q.indexOf(b.id); if (i >= 0) q.splice(i, 1); };
})();
