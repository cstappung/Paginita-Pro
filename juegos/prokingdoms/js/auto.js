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
    st.auto = Object.assign({ idle: true, work: true, train: false, reserve: 0.3, w: { food: 4, wood: 5, stone: 2, gold: 2, ore: 0, marble: 0, gems: 0 } }, st.auto || {});
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

  // Recurso para ese aldeano: cerca de él y de su punto de acopio, sin amontonarse (G.bestNode).
  function targetFor(u, res, used) {
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
    const n = g.bestNode(res, u.x, u.y, 'p', { used, max: 100 });
    return n ? { kind: 'node', obj: n } : null;
  }
  A.targetFor = targetFor;

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
        if (u.owner !== 'p' || u.kind !== 'v' || u.task || u.inside || u.hold || u.idleT < 3 || u.scared > 0) continue;
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
        // los que pusiste tú se quedan: una orden tuya no la deshace el Capataz
        for (const id of b.workers.slice()) { const u = g.uById.get(id); if (u && !(u.task && u.task.m)) { g.release(u); u.task = null; u.mode = 'idle'; } }
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

  // ---------- Trabajos ----------
  // Lo que elige el jugador para sus aldeanos, desde el panel (aldeanos elegidos) o desde la ventana Aldeanos.
  // Una orden así queda marcada (task.m): el Capataz no la cambia.
  A.JOBS = {
    food: { name: 'Comida', icon: 'food', hint: 'granjas libres, bayas o caza' },
    wood: { name: 'Madera', icon: 'wood' },
    stone: { name: 'Piedra', icon: 'stone' },
    gold: { name: 'Oro', icon: 'gold' },
    ore: { name: 'Hierro', icon: 'ore' },
    marble: { name: 'Mármol', icon: 'marble' },
    gems: { name: 'Gemas', icon: 'gems' },
    work: { name: 'Talleres', icon: 'tools', hint: 'puestos libres de los talleres' },
    dig: { name: 'Excavar', icon: 'scroll', hint: 'ruinas descubiertas' },
  };
  A.jobOf = function (u) {
    const t = u.task;
    if (!t) return u.inside ? 'work' : 'idle';
    if (t.t === 'gather') return t.res;
    if (t.t === 'farm') return 'food';
    if (t.t === 'work') return 'work';
    if (t.t === 'dig') return 'dig';
    return 'other';
  };
  A.villagers = () => G().units.filter(u => u.owner === 'p' && u.kind === 'v');
  A.jobCounts = function () {
    const c = { idle: 0 };
    for (const u of A.villagers()) { const j = A.jobOf(u); c[j] = (c[j] || 0) + 1; }
    return c;
  };
  // ¿Hay dónde trabajar en eso? (para apagar los botones que no llevan a nada)
  A.jobAvailable = function (job) {
    const g = G();
    if (job === 'work') return g.buildings.some(b => b.owner === 'p' && b.done && b.def.recipe && b.workers.length < g.slots(b));
    if (job === 'dig') return W.pois.some(p => p.kind === 'ruin' && g.poiState(p) && g.poiState(p).f && !g.poiState(p).d);
    if (job === 'food' && g.buildings.some(b => b.owner === 'p' && b.type === 'farm' && b.done && (b.farmer === null || !g.uById.get(b.farmer)))) return true;
    const [hx, hy] = D.PLAYER_HOME;
    return !!g.bestNode(job, hx, hy, 'p', { r: 40, max: 100 });
  };
  function jobTarget(u, job, used) {
    const g = G();
    if (job === 'work') {
      let best = null, bd = 1e9;
      for (const b of g.buildings) {
        if (b.owner !== 'p' || !b.done || !b.def.recipe) continue;
        const going = g.units.filter(o => o !== u && o.task && o.task.t === 'work' && o.task.b === b.id && !o.inside).length + (used.get('b' + b.id) || 0);
        if (b.workers.length + going >= g.slots(b)) continue;
        const d = U.dist(u.x, u.y, b.cx, b.cy) - (PK.Logi.nearStore(b) ? 20 : 0);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) used.set('b' + best.id, (used.get('b' + best.id) || 0) + 1);
      return best ? { kind: 'building', obj: best } : null;
    }
    if (job === 'dig') {
      let best = null, bd = 1e9;
      for (const p of W.pois) {
        const ps = g.poiState(p);
        if (p.kind !== 'ruin' || !ps || !ps.f || ps.d) continue;
        const d = U.dist(u.x, u.y, p.x, p.y);
        if (d < bd) { bd = d; best = p; }
      }
      return best ? { kind: 'poi', obj: best } : null;
    }
    const t = targetFor(u, job, used);
    if (t && t.kind === 'node') used.set(t.obj.id, (used.get(t.obj.id) || 0) + 1);
    if (t && t.kind === 'building') used.set('f' + t.obj.id, 1);
    return t;
  }
  // Pone a esos aldeanos en ese trabajo. Devuelve cuántos.
  A.setJob = function (units, job) {
    const used = new Map(), g = G();
    let n = 0;
    for (const u of units) {
      if (u.kind !== 'v' || u.owner !== 'p') continue;
      if (A.jobOf(u) === job && u.task) { n++; continue; }
      const t = jobTarget(u, job, used);
      if (!t) break;
      if (g.command([u], t, false)) n++;
    }
    if (!n) PK.UI.toast(job === 'work' ? 'No hay puestos libres en los talleres.' : job === 'dig' ? 'No hay ruinas descubiertas por excavar.' : 'No conoces ' + A.JOBS[job].name.toLowerCase() + ' a la que puedan llegar. Explora o reclama más tierra.', 'warn');
    return n;
  };
  // +1 en un trabajo: primero un ocioso; si no hay, el que esté en el trabajo con más gente.
  A.addJob = function (job) {
    const vs = A.villagers().filter(u => !u.scared), c = A.jobCounts();
    let u = vs.find(o => A.jobOf(o) === 'idle');
    if (!u) {
      const from = Object.keys(c).filter(k => k !== job && k !== 'idle' && k !== 'other' && c[k] > 0).sort((a, b) => c[b] - c[a])[0];
      u = from && vs.filter(o => A.jobOf(o) === from).sort((a, b) => (a.carry || 0) - (b.carry || 0))[0];
    }
    if (!u) { PK.UI.toast('No tienes aldeanos libres: entrena más en el Centro Urbano.', 'warn'); return false; }
    return A.setJob([u], job) > 0;
  };
  // −1: uno de ese trabajo queda ocioso a propósito (el Capataz no lo reparte hasta que le des otra cosa).
  A.removeJob = function (job) {
    const u = A.villagers().filter(o => A.jobOf(o) === job).sort((a, b) => (a.carry || 0) - (b.carry || 0))[0];
    if (!u) return false;
    G().release(u);
    u.mode = 'idle'; u.hold = true;
    return true;
  };
  A.freeIdle = function () { // los ociosos «a propósito» vuelven a quedar en manos del Capataz
    let n = 0;
    for (const u of A.villagers()) if (!u.task && !u.inside) { u.hold = false; u.idleT = 3; n++; }
    return n;
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
