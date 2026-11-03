// Aldeanos y edificios. Los aldeanos recolectan al estilo clásico: van al recurso, llenan su carga,
// la llevan al punto de acopio más cercano y vuelven. Por eso importa construir campamentos cerca.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;

  class Unit {
    constructor(o) {
      this.id = o.id; this.owner = o.owner;
      this.x = o.x; this.y = o.y;
      this.task = o.task || null; this.phase = o.phase || 'go';
      this.carry = o.carry || 0; this.carryRes = o.carryRes || null; this.carryZone = o.carryZone === undefined ? -1 : o.carryZone;
      this.hair = o.hair === undefined ? o.id % 4 : o.hair;
      this.skin = o.skin === undefined ? (o.id * 7) % 3 : o.skin;
      this.inside = !!o.inside;
      this.kind = o.kind || 'v';       // 'v' aldeano, 'scout' explorador, 'cart' carreta
      this.job = o.job || null;        // viaje de una carreta
    this.ox = ((o.id * 37) % 9 - 4) * 0.05; this.oy = ((o.id * 53) % 9 - 4) * 0.05; // pequeño desvío para no apilarse
    this.back = false; this.scared = 0;
      this.dl = o.dl || 1;             // nivel del último punto de acopio donde descargó
      this.hold = !!o.hold;            // lo dejaste sin trabajo a propósito: el Capataz no lo toca
      this.path = []; this.acc = 0; this.anim = Math.random() * 10; this.flip = false;
      this.mode = 'idle'; this.fails = 0; this.wait = 0; this.fx = 0;
    }
    toJSON() {
      return { id: this.id, owner: this.owner, x: +this.x.toFixed(2), y: +this.y.toFixed(2), task: this.task, phase: this.phase, carry: this.carry, carryRes: this.carryRes, carryZone: this.carryZone, hair: this.hair, skin: this.skin, inside: this.inside, kind: this.kind, dl: this.dl, job: this.job, hold: this.hold || undefined };
    }
  }

  class Building {
    constructor(o) {
      this.id = o.id; this.type = o.type; this.owner = o.owner;
      this.def = D.BUILD[o.type];
      this.x = o.x; this.y = o.y; this.w = this.def.w; this.h = this.def.h;
      this.done = !!o.done; this.progress = o.progress || (o.done ? 1 : 0);
      this.workers = o.workers || []; this.queue = o.queue || []; this.qt = o.qt || 0;
      this.prodAcc = o.prodAcc || 0; this.rally = o.rally || null; this.farmer = null;
      this.status = ''; this.static = !!o.static;
      this.lvl = o.lvl || 1; this.upg = o.upg || null; // upg: { t, total } mientras lo mejora un Maestro de Obras
      this.inb = o.inb || {}; this.outb = o.outb || {}; // depósitos de entrada y salida de los talleres
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    toJSON() {
      return { id: this.id, type: this.type, owner: this.owner, x: this.x, y: this.y, done: this.done, progress: this.progress, workers: this.workers, queue: this.queue, qt: this.qt, prodAcc: this.prodAcc, rally: this.rally, lvl: this.lvl, upg: this.upg, inb: this.inb, outb: this.outb };
    }
  }
  PK.Unit = Unit;
  PK.Building = Building;

  const G = () => PK.Game;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);

  function nearRect(u, x0, y0, x1, y1, pad) {
    const dx = Math.max(x0 - u.x, 0, u.x - (x1 + 1)), dy = Math.max(y0 - u.y, 0, u.y - (y1 + 1));
    return dx <= (pad || 0.95) && dy <= (pad || 0.95);
  }

  // ¿Se puede caminar en línea recta de un punto a otro? Revisa la huella del aldeano (no solo el centro).
  function walkable(tx, ty) {
    if (W.passable(tx, ty)) return true;
    if (!W.inb(tx, ty)) return false;
    const bid = W.bAt[W.idx(tx, ty)], b = bid >= 0 && G().bById.get(bid);
    return !!(b && b.def.walkable);
  }
  const FOOT = [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]];
  function los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) * 3);
    for (let i = 1; i <= n; i++) {
      const x = x0 + (dx * i) / n, y = y0 + (dy * i) / n;
      for (const f of FOOT) if (!walkable(Math.floor(x + f[0]), Math.floor(y + f[1]))) return false;
    }
    return true;
  }
  function inRect(u, b) { return u.x >= b.x && u.x <= b.x + b.w && u.y >= b.y && u.y <= b.y + b.h; }

  // Pide una ruta. Devuelve false si no hay manera de llegar.
  function pathTo(u, goal) {
    const r = W.findPath(Math.floor(u.x), Math.floor(u.y), goal);
    if (!r.ok) {
      u.fails++;
      if (u.fails > 3 || !r.path.length) return false;
    } else u.fails = 0;
    u.path = r.path;
    return true;
  }
  const rectGoal = (b, adj) => ({ x0: b.x, y0: b.y, x1: b.x + b.w - 1, y1: b.y + b.h - 1, adj });
  const nodeGoal = n => ({ x0: n.x, y0: n.y, x1: n.x, y1: n.y, adj: true });

  // Caminar: la ruta de A* va casilla por casilla, pero el aldeano se salta los puntos intermedios que
  // puede alcanzar en línea recta, así camina en diagonales suaves y no en escalones.
  function step(u, dt) {
    const g = G();
    // los caminos aceleran a todos; las carretas fuera del camino van lentas
    const road = W.road[W.idx(Math.floor(u.x), Math.floor(u.y))] === 1;
    const terrain = u.kind === 'cart' ? (road ? D.ROAD.cart : D.CART.offRoad) : road ? D.ROAD.walk : 1;
    let move = g.speed(u.owner, u) * terrain * dt * (u.scared > 0 ? 1.4 : 1);
    while (move > 0 && u.path.length) {
      if (u.pchk !== u.path.length) {
        for (let k = 0; k < 14 && u.path.length > 1 && los(u.x, u.y, u.path[1][0] + 0.5, u.path[1][1] + 0.5); k++) u.path.shift();
        u.pchk = u.path.length;
      }
      const [tx, ty] = u.path[0];
      if (!walkable(tx, ty)) { u.path = []; return; } // el camino quedó bloqueado; la tarea pedirá otro
      const cx = tx + 0.5 + (u.path.length === 1 ? u.ox || 0 : 0), cy = ty + 0.5 + (u.path.length === 1 ? u.oy || 0 : 0);
      const dx = cx - u.x, dy = cy - u.y, d = Math.hypot(dx, dy);
      face(u, cx, cy);
      if (d <= move) { u.x = cx; u.y = cy; u.path.shift(); move -= d; }
      else { u.x += (dx / d) * move; u.y += (dy / d) * move; move = 0; }
    }
    u.mode = 'walk';
    u.hugId = null;
    if (u.kind === 'scout' && u.owner === 'p') {
      const tx = Math.floor(u.x), ty = Math.floor(u.y);
      if (tx !== u.lx || ty !== u.ly) { u.lx = tx; u.ly = ty; g.revealAt(u.x, u.y, g.scoutSight()); }
    }
  }

  // Hacia dónde mira en pantalla: izquierda/derecha y de frente/de espaldas.
  function face(u, x, y) {
    const sx = (x - y) - (u.x - u.y), sy = (x + y) - (u.x + u.y);
    if (Math.abs(sx) > 0.05) u.flip = sx < 0;
    if (Math.abs(sy) > 0.05) u.back = sy < 0;
  }

  // Al trabajar un recurso se arriman a un costado (en pantalla, a la izquierda o la derecha del objetivo, nunca justo
  // delante ni detrás) y a distancia de golpe, para que la herramienta llegue a tocarlo. Evita los puestos ya ocupados.
  const SIDES = [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7], [0.45, -0.45], [-0.45, 0.45]];
  function hug(u, cx, cy, dt, id, sc) {
    if (u.hugId === id && u.hugOk) return false;
    if (u.hugId !== id) { u.hugId = id; u.hugOk = false; u.hugT = 0; }
    u.hugT += dt;
    let best = null, bd = 1e9;
    for (const s of SIDES) {
      const x = cx + s[0] * (sc || 1), y = cy + s[1] * (sc || 1);
      if (!walkable(Math.floor(x), Math.floor(y))) continue;
      let d = Math.hypot(x - u.x, y - u.y);
      for (const o of G().units) if (o !== u && o.mode === 'work' && Math.abs(o.x - x) + Math.abs(o.y - y) < 0.45) d += 2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    const dist = best ? Math.hypot(best[0] - u.x, best[1] - u.y) : 0;
    if (!best || dist < 0.05 || dist > 1.8 || u.hugT > 2.5) { u.hugOk = true; return false; }
    const k = Math.min(1, (1.4 * dt) / dist);
    u.x += (best[0] - u.x) * k; u.y += (best[1] - u.y) * k;
    face(u, best[0], best[1]);
    u.mode = 'walk';
    return true;
  }
  // Para edificios y ruinas: se acerca al borde más cercano hasta quedar a un paso.
  function closeIn(u, x, y, dt, id) {
    if (u.hugId === id && u.hugOk) return false;
    if (u.hugId !== id) { u.hugId = id; u.hugOk = false; u.hugT = 0; }
    u.hugT += dt;
    const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
    if (d < 0.42 || u.hugT > 2 || !walkable(Math.floor(u.x + dx * 0.3), Math.floor(u.y + dy * 0.3))) { u.hugOk = true; return false; }
    const k = Math.min(1, (1.4 * dt) / d);
    u.x += dx * k; u.y += dy * k;
    face(u, x, y);
    u.mode = 'walk';
    return true;
  }
  const rectPoint = (u, x0, y0, x1, y1) => [Math.max(x0, Math.min(x1, u.x)), Math.max(y0, Math.min(y1, u.y))];
  // Punto de contacto: centro del objetivo (x, y), cuánto se mete hacia el aldeano (r, en píxeles), alto preferido
  // del golpe sobre los pies del aldeano (w) y la franja del objetivo que se puede golpear (h0..h1 sobre su base).
  const AIM = {
    tree: { r: 2, w: 11, h0: 2, h1: 13 }, berry: { r: 4, w: 2, h0: 1, h1: 8 }, deer: { r: 3, w: 4, h0: 1, h1: 5 },
    rock: { r: 4, w: 6, h0: 0, h1: 7 }, build: { r: 0, w: 9, h0: 1, h1: 18 }, ground: { r: 0, w: 1, h0: 0, h1: 1 },
  };
  const setAim = (u, x, y, a) => { u.aim = { x, y, r: a.r, w: a.w, h0: a.h0, h1: a.h1 }; };

  // Lleva la carga al punto de acopio más cercano. Devuelve true mientras sigue ocupado en eso.
  function goDeposit(u, dt) {
    const g = G();
    if (!u.carry) { u.phase = 'go'; return false; }
    const b = g.findDrop(u.owner, u.carryRes, u.x, u.y);
    if (!b) {
      u.mode = 'idle';
      u.wait -= dt;
      if (u.wait <= 0) { u.wait = 4; if (u.owner === 'p') toast('No hay punto de acopio para ' + D.RES[u.carryRes].name.toLowerCase() + '. Construye uno.', 'warn'); }
      return true;
    }
    if (nearRect(u, b.x, b.y, b.x + b.w - 1, b.y + b.h - 1)) {
      if (u.owner === 'p' && u.carry && PK.Render.float) PK.Render.float(b.cx, b.cy, '+' + Math.floor(u.carry), u.carryRes);
      g.deposit(u, b);
      u.dl = b.type === 'tc' ? 1 : b.lvl;
      u.phase = 'go';
      return false;
    }
    if (!pathTo(u, rectGoal(b, true))) { u.mode = 'idle'; u.wait = 2; }
    return true;
  }

  function doGather(u, dt) {
    const g = G(), t = u.task, cap = g.carryCap(u.owner, u);
    if (u.phase === 'return') { goDeposit(u, dt); return; }
    let n = W.nodes[t.node];
    if (!n || n.dead) {
      // se agotó: busca otro del mismo tipo (cerca de él y de su acopio, sin amontonarse); cada vez más lejos
      // antes de rendirse, para que siga con la tarea que le diste
      const nn = u.owner === 'p' ? g.bestNode(t.res, u.x, u.y, 'p', { zone: t.zone }) : W.nearestNode(t.res, u.x, u.y, 12, u.owner, { zone: t.zone });
      if (nn) { t.node = nn.id; n = nn; }
      else {
        if (u.carry) { u.phase = 'return'; return; }
        u.task = null; u.mode = 'idle';
        return;
      }
    }
    if (u.carry > 0 && u.carryRes !== t.res) { u.phase = 'return'; return; }
    if (u.carry >= cap) { u.phase = 'return'; return; }
    if (!nearRect(u, n.x, n.y, n.x, n.y)) {
      if (!pathTo(u, nodeGoal(n))) {
        const nn = u.owner === 'p' ? g.bestNode(t.res, u.x, u.y, 'p', { exclude: n.id, zone: t.zone }) : W.nearestNode(t.res, u.x, u.y, 14, u.owner, { exclude: n.id, zone: t.zone });
        if (nn && nn.id !== n.id) { t.node = nn.id; u.fails = 0; } else { u.task = null; u.mode = 'idle'; }
      }
      return;
    }
    if (hug(u, n.x + 0.5, n.y + 0.5, dt, 'n' + n.id, n.kind === 'berry' ? 0.75 : 1)) return; // a los arbustos, más cerca
    face(u, n.x + 0.5, n.y + 0.5);
    setAim(u, n.x + 0.5, n.y + 0.5, AIM[n.kind] || AIM.rock);
    u.mode = 'work';
    u.acc += g.gatherRate(u.owner, t.res, u, n.kind) * dt;
    const shared = W.isShared(n), online = PK.Net && PK.Net.online;
    // En línea, los reinos simulados no gastan recursos compartidos: eso lo calcula el servidor.
    const virtual = online && shared && u.owner !== 'p';
    let took = 0;
    while (u.acc >= 1 && n.amount > 0 && u.carry < cap) {
      u.acc -= 1; u.carry += 1; u.carryRes = t.res; u.carryZone = n.zone; u.hunt = n.kind === 'deer';
      if (!virtual) { n.amount -= 1; took++; }
    }
    if (took && online && shared && u.owner === 'p') PK.Net.harvest(n.id, took);
    if (n.amount <= 0 && !n.dead) { W.depleteNode(n); if (n.temp && u.owner === 'p' && PK.Life) PK.Life.tempDone(n); }
    if (u.carry >= cap) u.phase = 'return';
  }

  function doFarm(u, dt) {
    const g = G(), cap = g.carryCap(u.owner, u), b = g.bById.get(u.task.b);
    if (!b || !b.done) { u.task = null; return; }
    if (b.farmer !== null && b.farmer !== u.id && g.uById.get(b.farmer) && g.uById.get(b.farmer).task && g.uById.get(b.farmer).task.b === b.id) {
      u.task = null; u.mode = 'idle'; return;
    }
    b.farmer = u.id;
    if (u.phase === 'return') { goDeposit(u, dt); return; }
    if (u.carry > 0 && u.carryRes !== 'food') { u.phase = 'return'; return; }
    if (u.carry >= cap) { u.phase = 'return'; return; }
    if (!inRect(u, b)) {
      if (!pathTo(u, rectGoal(b, false))) { u.task = null; u.mode = 'idle'; }
      return;
    }
    u.mode = 'work';
    u.aim = null; // la hoz va a ras del suelo, delante
    u.fx += dt;
    if (u.fx > 3) { // el granjero se mueve por los surcos
      u.fx = 0;
      const tx = b.x + Math.floor(Math.random() * b.w), ty = b.y + Math.floor(Math.random() * b.h);
      u.path = [[tx, ty]];
    }
    u.acc += g.farmRate(u.owner, b, u) * dt;
    while (u.acc >= 1 && u.carry < cap) { u.acc -= 1; u.carry++; u.carryRes = 'food'; u.carryZone = -1; }
    if (u.carry >= cap) u.phase = 'return';
  }

  // Partidas viejas: las obras ahora se levantan solas (game.js, updateBuildings). Quien estaba construyendo
  // queda libre y el Capataz le da trabajo.
  function doBuildOld(u) { u.task = null; u.mode = 'idle'; }
  function doWork(u, dt) {
    const g = G(), b = g.bById.get(u.task.b);
    if (!b || !b.done) { u.task = null; return; }
    if (u.carry && goDeposit(u, dt)) return; // primero deja lo que lleva
    if (!nearRect(u, b.x, b.y, b.x + b.w - 1, b.y + b.h - 1)) {
      if (!pathTo(u, rectGoal(b, true))) { u.task = null; u.mode = 'idle'; }
      return;
    }
    if (b.workers.length >= g.slots(b)) {
      if (u.owner === 'p') toast(b.def.name + ' ya tiene todos sus puestos ocupados.', 'warn');
      u.task = null; u.mode = 'idle';
      return;
    }
    b.workers.push(u.id);
    u.inside = true;
    u.mode = 'idle';
  }

  // Exploradores: buscan el borde de la niebla más cercano dentro de su alcance y caminan hacia él.
  function doExplore(u) {
    const g = G();
    if (u.owner !== 'p') { u.task = null; return; }
    if (u.exT !== undefined && !W.fog[u.exT]) (u.skip = u.skip || new Set()).add(u.exT); // no pudo llegar
    const t = g.exploreTarget(u);
    if (!t) { u.exT = undefined; u.mode = 'idle'; u.wait = 6; g.exploreDone(u); return; }
    u.exT = t[1] * W.W + t[0];
    const r = W.findPath(Math.floor(u.x), Math.floor(u.y), { x0: t[0], y0: t[1], x1: t[0], y1: t[1], adj: !W.passable(t[0], t[1]) }, 7000);
    if (!r.path.length) { (u.skip = u.skip || new Set()).add(u.exT); u.exT = undefined; u.wait = 0.3; u.mode = 'idle'; return; }
    u.path = r.path;
  }

  // Excavar ruinas antiguas (puntos de interés de 2x2).
  function doDig(u, dt) {
    const g = G(), p = W.pois[u.task.poi], st = p && g.poiState(p);
    if (!p || !st || st.d) { u.task = null; u.mode = 'idle'; return; }
    if (!nearRect(u, p.x, p.y, p.x + p.w - 1, p.y + p.h - 1)) {
      if (!pathTo(u, { x0: p.x, y0: p.y, x1: p.x + p.w - 1, y1: p.y + p.h - 1, adj: true })) { u.task = null; u.mode = 'idle'; }
      return;
    }
    const [ax, ay] = rectPoint(u, p.x, p.y, p.x + p.w, p.y + p.h);
    if (closeIn(u, ax, ay, dt, 'p' + u.task.poi)) return;
    setAim(u, ax, ay, AIM.ground);
    face(u, p.x + p.w / 2, p.y + p.h / 2);
    u.mode = 'work';
    g.digProgress(p, dt);
  }

  function doDeposit(u, dt) {
    if (!u.carry) { u.task = u.task.next || null; return; }
    goDeposit(u, dt);
    if (!u.carry) u.task = u.task.next || null;
  }

  // Después de construir: los aldeanos se ponen a trabajar en lo lógico, como en los clásicos.
  function autoTask(u, b) {
    const g = G();
    const def = b.def;
    if (b.type === 'farm') { if (b.farmer === null || b.farmer === u.id) { g.assign(u, { t: 'farm', b: b.id }); return; } }
    if (def.recipe && b.workers.length < g.slots(b)) { g.assign(u, { t: 'work', b: b.id }); return; }
    if (def.drop && b.type !== 'tc') {
      let best = null, bd = 9;
      for (const res of def.drop) {
        const n = W.nearestNode(res, b.cx, b.cy, 9, u.owner);
        if (n) { const d = U.dist(b.cx, b.cy, n.x, n.y); if (d < bd) { bd = d; best = n; } }
      }
      if (best) { g.assign(u, { t: 'gather', node: best.id, res: W.nodeRes(best) }); return; }
      if (b.type === 'mill') {
        const f = g.buildings.find(o => o.owner === u.owner && o.type === 'farm' && o.done && o.farmer === null && U.dist(o.cx, o.cy, b.cx, b.cy) < 10);
        if (f) { g.assign(u, { t: 'farm', b: f.id }); return; }
      }
    }
    u.task = null; u.mode = 'idle';
  }

  // Aldeanos de otros jugadores: se deslizan hacia la última posición que informó el servidor.
  function remoteStep(u, dt) {
    const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy);
    if (d > 6) { u.x = u.tx; u.y = u.ty; u.mode = u.rmode; return; }
    if (d > 0.05) {
      const sp = Math.max(1.3, d / 3) * dt;
      if (d <= sp) { u.x = u.tx; u.y = u.ty; } else { u.x += (dx / d) * sp; u.y += (dy / d) * sp; }
      if (Math.abs(dx - dy) > 0.01) u.flip = dx - dy < 0;
      u.mode = 'walk';
    } else { u.mode = u.rmode; u.flip = u.rflip; }
  }

  // Choques suaves: los aldeanos se empujan entre sí. Quien trabaja pesa más, así los que caminan lo rodean.
  // Dos que caminan se cruzan sin empujarse (como en los clásicos): empujarse en los caminos angostos los
  // trababa y los sacaba de su ruta.
  const cells = new Map();
  const mass = u => (u.mode === 'work' ? 4 : u.mode === 'idle' ? 2 : 1);
  function separate(list, dt) {
    cells.clear();
    for (const u of list) {
      if (u.inside || u.remote) continue;
      const k = Math.floor(u.x) * 1024 + Math.floor(u.y);
      const c = cells.get(k);
      if (c) c.push(u); else cells.set(k, [u]);
    }
    const R = 0.44, k = Math.min(1, dt * 10);
    for (const u of list) {
      if (u.inside || u.remote) continue;
      const fx = Math.floor(u.x), fy = Math.floor(u.y);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const c = cells.get((fx + ox) * 1024 + fy + oy);
        if (!c) continue;
        for (const o of c) {
          if (o.id <= u.id) continue;
          if (u.mode === 'walk' && o.mode === 'walk') continue;
          let dx = o.x - u.x, dy = o.y - u.y, d = Math.hypot(dx, dy);
          const r = u.mode === 'work' && o.mode === 'work' ? R : R * 0.8;
          if (d >= r) continue;
          if (d < 1e-4) { const a = (u.id * 2.39 + o.id) % 6.283; dx = Math.cos(a); dy = Math.sin(a); d = 1; } else { dx /= d; dy /= d; }
          const push = (r - Math.min(d, r)) * k, mu = mass(u), mo = mass(o), t = mu + mo;
          nudge(u, -dx * push * (mo / t), -dy * push * (mo / t));
          nudge(o, dx * push * (mu / t), dy * push * (mu / t));
        }
      }
    }
  }
  function nudge(u, dx, dy) {
    if (walkable(Math.floor(u.x + dx + Math.sign(dx) * 0.2), Math.floor(u.y))) u.x += dx;
    if (walkable(Math.floor(u.x), Math.floor(u.y + dy + Math.sign(dy) * 0.2))) u.y += dy;
  }

  function update(u, dt) {
    u.anim += dt;
    if (u.remote) { remoteStep(u, dt); return; }
    if (u.inside) return;
    if (u.scared > 0) { // huye de los lobos hacia el Centro Urbano
      u.scared -= dt;
      if (u.scared <= 0) { u.path = []; u.fails = 0; return; } // pasó el susto: vuelve a lo suyo sin terminar la huida
      if (u.path.length) step(u, dt); else u.mode = 'idle';
      return;
    }
    if (u.path.length) { step(u, dt); return; }
    if (u.kind === 'cart') { if (u.owner === 'p') PK.Logi.cart(u, dt); else u.mode = 'idle'; return; }
    if (u.wait > 0 && u.mode === 'idle' && u.task) { u.wait -= dt; return; }
    if (!u.task) { u.mode = 'idle'; return; }
    switch (u.task.t) {
      case 'move': u.task = u.task.then ? { t: u.task.then } : null; u.mode = 'idle'; break;
      case 'gather': doGather(u, dt); break;
      case 'farm': doFarm(u, dt); break;
      case 'build': doBuildOld(u); break;
      case 'work': doWork(u, dt); break;
      case 'deposit': doDeposit(u, dt); break;
      case 'explore': doExplore(u, dt); break;
      case 'dig': doDig(u, dt); break;
      default: u.task = null;
    }
  }

  PK.Units = { update, autoTask, pathTo, nearRect, rectGoal, separate, los, walkable, face };
})();
