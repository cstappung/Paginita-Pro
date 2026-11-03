// Logística, al estilo de una fábrica: cada taller tiene un depósito de entrada (insumos) y uno de salida
// (productos). Nadie los llena por arte de magia:
//  - Si el taller está a 3 casillas o menos de un almacén, se abastece y descarga solo (pero despacio).
//  - Las carretas (Carretería) llevan insumos desde los almacenes o desde otro taller, y sacan lo producido
//    hacia el taller que lo necesita o al almacén. Así se arman cadenas: madera → tablones → herramientas.
//  - Los caminos aceleran a todos; las carretas fuera del camino van lentas.
//  - Muy avanzado: cintas transportadoras que unen dos edificios y mueven todo solas, rapidísimo.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const L = (PK.Logi = { tool: null, beltFrom: null });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);

  // Qué guarda cada almacén. El Centro Urbano y el Almacén reciben de todo.
  const STORE = { tc: null, warehouse: null, granary: ['food'], mill: ['food'], lumber: ['wood'], mining: ['stone', 'gold', 'ore', 'marble', 'gems'] };
  L.isStore = b => b.def && Object.prototype.hasOwnProperty.call(STORE, b.type);
  L.storeAccepts = (b, res) => L.isStore(b) && (!STORE[b.type] || STORE[b.type].includes(res));
  L.isShop = b => !!(b.def && b.def.recipe);

  L.init = function (st) {
    st.logi = Object.assign({ belts: [], nextBelt: 1, roads: [] }, st.logi || {});
    for (const i of st.logi.roads) W.road[i] = 1;
    for (const bl of st.logi.belts) markBelt(bl, true);
    W.roadVer++;
    L.tool = null; L.beltFrom = null;
  };
  L.save = function (st) {
    const roads = [];
    for (let i = 0; i < W.road.length; i++) if (W.road[i]) roads.push(i);
    st.logi.roads = roads;
  };

  // ---------- Depósitos de los talleres ----------
  L.bufCap = b => D.BUF * Math.max(1, G().slots(b));
  L.recipe = b => D.RECIPES[b.def.recipe];
  L.output = b => Object.keys(L.recipe(b).out)[0];
  function ensure(b) { if (!b.inb) b.inb = {}; if (!b.outb) b.outb = {}; }
  L.need = function (b, res) { ensure(b); return Math.max(0, L.bufCap(b) - (b.inb[res] || 0)); };

  // Producir: solo con lo que hay en el depósito de entrada, y solo si queda lugar en el de salida.
  L.produce = function (b, dt) {
    ensure(b);
    const g = G(), r = L.recipe(b), out = L.output(b), cap = L.bufCap(b), n = b.workers.length;
    if (L.nearStore(b)) L.direct(b, dt);
    if (!n) { b.status = 'Sin trabajadores'; return; }
    b.prodAcc += (dt * n * g.prodMult(b.def.recipe, b)) / r.time;
    b.status = 'Produciendo';
    let guard = 0;
    while (b.prodAcc >= 1 && guard++ < 100000) {
      if ((b.outb[out] || 0) + r.out[out] > cap) { b.status = 'Depósito de salida lleno'; b.prodAcc = Math.min(b.prodAcc, 1); break; }
      let ok = true;
      for (const k in r.in) if ((b.inb[k] || 0) < r.in[k]) { ok = false; break; }
      if (!ok) { b.status = 'Faltan insumos'; b.prodAcc = Math.min(b.prodAcc, 1); break; }
      b.prodAcc -= 1;
      for (const k in r.in) b.inb[k] -= r.in[k];
      for (const k in r.out) { b.outb[k] = (b.outb[k] || 0) + r.out[k]; g.stat('p_' + k, r.out[k]); g.stat('p_total', r.out[k]); }
    }
  };

  // ¿Le llega algo a este taller? (junto a un almacén, con carretas o con una cinta que lo alimenta).
  // Sin eso no recibe insumos: no se le asignan trabajadores (antes aceptaba y prometía «≈30 por minuto»).
  L.supplied = b => !!(L.nearStore(b) || L.carts().length || S().logi.belts.some(bl => bl.b === b.id));
  // Almacén cercano: el taller se abastece y descarga solo, a un ritmo moderado.
  L.nearStore = function (b) {
    if (b._nsT === G().time) return b._ns;
    b._nsT = G().time;
    b._ns = null;
    for (const o of G().buildings) {
      if (o.owner !== b.owner || !o.done || !L.isStore(o)) continue;
      const dx = Math.max(o.x - (b.x + b.w), 0, b.x - (o.x + o.w)), dy = Math.max(o.y - (b.y + b.h), 0, b.y - (o.y + o.h));
      if (Math.max(dx, dy) <= D.NEAR_STORE && (!STORE[o.type] || o.type === 'tc' || o.type === 'warehouse')) { b._ns = o; break; }
    }
    return b._ns;
  };
  L.directRate = b => 2 + b.lvl;
  L.direct = function (b, dt) {
    const g = G(), st = S(), r = L.recipe(b), out = L.output(b);
    let budget = L.directRate(b) * dt;
    for (const k in r.in) {
      const want = Math.min(L.need(b, k), budget);
      if (want <= 0) continue;
      const avail = Math.max(0, st.res[k] - reserveOf(k, out));
      const n = Math.min(want, avail);
      if (n > 0) { st.res[k] -= n; b.inb[k] = (b.inb[k] || 0) + n; budget -= n; }
    }
    const have = b.outb[out] || 0;
    if (have > 0) { const n = Math.min(have, L.directRate(b) * dt, Math.max(0, g.cap(out) - st.res[out])); b.outb[out] -= n; st.res[out] += n; }
  };
  // Reserva que fija el Capataz: los talleres no vacían la bodega de lo que hace falta para construir.
  function reserveOf(res, out) {
    const st = S(), g = G();
    let rv = st.auto ? st.auto.reserve || 0 : 0;
    if (out && st.res[out] < 0.05 * g.cap(out)) rv /= 3;
    return rv * g.cap(res);
  }

  // ---------- Carretas ----------
  L.cartMax = () => G().buildings.reduce((s, b) => s + (b.owner === 'p' && b.done && b.type === 'cartwright' ? G().bst(b).carts : 0), 0);
  L.cartCap = () => Math.round(G().buildings.reduce((m, b) => Math.max(m, b.owner === 'p' && b.done && b.type === 'cartwright' ? G().bst(b).cartCap : 0), D.CART.cap) * (1 + G().best('beasthouse', 'cartBoost')));
  L.cartSpeed = () => G().buildings.reduce((m, b) => Math.max(m, b.owner === 'p' && b.done && b.type === 'cartwright' ? G().bst(b).cartSpeed : 0), 0) + G().best('beasthouse', 'cartBoost');
  L.carts = () => G().units.filter(u => u.owner === 'p' && u.kind === 'cart');
  L.trainCart = function (b) {
    if (L.carts().length + (b.queue ? b.queue.length : 0) >= L.cartMax()) { toast('Mejora la Carretería para tener más carretas.', 'warn'); return; }
    if (!G().pay(D.CART.cost)) { toast('Recursos insuficientes.', 'warn'); return; }
    b.queue.push('cart');
  };
  L.updateCartwright = function (b, dt) {
    if (!b.queue.length) { b.status = ''; b.qt = 0; return; }
    b.status = 'Armando carretas';
    b.qt += dt;
    if (b.qt >= D.CART.time) {
      b.qt = 0; b.queue.shift();
      G().spawnUnit(b, 'cart');
      G().stat('carts', 1);
    }
  };

  // Lo que ya viene en camino (para que dos carretas no hagan el mismo viaje).
  function inbound(b, res) {
    let n = 0;
    for (const u of G().units) if (u.kind === 'cart' && u.job && u.job.to === b.id && u.job.res === res) n += u.job.n;
    return n;
  }
  function outbound(b, res) {
    let n = 0;
    for (const u of G().units) if (u.kind === 'cart' && u.job && u.job.from === b.id && u.job.res === res && u.job.phase === 'go') n += u.job.n;
    return n;
  }
  function nearestStore(x, y, res, needRoom) {
    let best = null, bd = 1e9;
    for (const b of G().buildings) {
      if (b.owner !== 'p' || !b.done || !L.storeAccepts(b, res)) continue;
      if (needRoom && S().res[res] >= G().cap(res) - 1) continue;
      const d = U.dist(x, y, b.cx, b.cy);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // Elige el viaje más urgente: primero abastecer talleres con trabajadores que se quedan sin insumos,
  // después vaciar depósitos de salida que se llenan.
  function findJob(u) {
    const g = G(), st = S(), cap = L.cartCap(), shops = g.buildings.filter(b => b.owner === 'p' && b.done && L.isShop(b) && !L.nearStore(b));
    let best = null, bs = -1e9;
    for (const b of shops) {
      ensure(b);
      const r = L.recipe(b), bc = L.bufCap(b), out = L.output(b);
      // abastecer (no tiene sentido si su salida está llena y nadie la retira)
      if ((b.outb[out] || 0) < bc) for (const k in r.in) {
        const missing = bc - (b.inb[k] || 0) - inbound(b, k);
        if (missing < Math.min(cap, bc) * 0.4) continue;
        // ¿algún taller produce ese insumo y lo tiene listo? (cadena directa)
        let src = null;
        for (const o of shops) { if (o !== b && L.output(o) === k && (o.outb[k] || 0) - outbound(o, k) >= Math.min(cap, missing) * 0.5) { src = o; break; } }
        let avail;
        if (src) avail = (src.outb[k] || 0) - outbound(src, k);
        else { src = nearestStore(b.cx, b.cy, k); avail = st.res[k] - reserveOf(k, out); }
        if (!src || avail < 1) continue;
        const n = Math.floor(Math.min(cap, missing, avail));
        if (n < 1) continue;
        const score = 100 + (b.workers.length ? 60 : 0) + (missing / bc) * 40 - U.dist(u.x, u.y, src.cx, src.cy) - U.dist(src.cx, src.cy, b.cx, b.cy) * 0.5;
        if (score > bs) { bs = score; best = { from: src.id, to: b.id, res: k, n, phase: 'go' }; }
      }
      // sacar lo producido
      const have = (b.outb[out] || 0) - outbound(b, out);
      if (have >= Math.min(cap, bc) * 0.3) {
        let dst = null;
        for (const o of shops) { if (o !== b && L.recipe(o).in[out] && L.need(o, out) - inbound(o, out) >= 5) { dst = o; break; } }
        if (!dst) dst = nearestStore(b.cx, b.cy, out, true);
        if (!dst) continue;
        const n = Math.floor(Math.min(cap, have));
        const score = 60 + (have / bc) * 60 - U.dist(u.x, u.y, b.cx, b.cy) - U.dist(b.cx, b.cy, dst.cx, dst.cy) * 0.5;
        if (score > bs) { bs = score; best = { from: b.id, to: dst.id, res: out, n, phase: 'go' }; }
      }
    }
    return best;
  }

  function take(b, res, n) {
    const st = S();
    if (L.isShop(b)) { ensure(b); const k = Math.min(n, b.outb[res] || 0); b.outb[res] -= k; return k; }
    const k = Math.min(n, Math.max(0, st.res[res])); st.res[res] -= k; return k;
  }
  function put(b, res, n) {
    const st = S(), g = G();
    if (L.isShop(b)) { ensure(b); b.inb[res] = (b.inb[res] || 0) + n; return n; }
    const k = Math.min(n, Math.max(0, g.cap(res) - st.res[res])); st.res[res] += k; return k;
  }

  // Cerebro de una carreta: ir a cargar, ir a descargar, buscar el siguiente viaje.
  L.cart = function (u, dt) {
    const g = G(), Un = PK.Units;
    if (!u.job) {
      u.mode = 'idle';
      u.wait = (u.wait || 0) - dt;
      if (u.wait > 0) return;
      u.wait = 1.5;
      u.job = findJob(u);
      if (!u.job) { parkCart(u); return; }
    }
    const j = u.job, from = g.bById.get(j.from), to = g.bById.get(j.to);
    if (!from || !to) { dropCargo(u); u.job = null; return; }
    const tgt = j.phase === 'go' ? from : to;
    if (!Un.nearRect(u, tgt.x, tgt.y, tgt.x + tgt.w - 1, tgt.y + tgt.h - 1, 1.2)) {
      if (!Un.pathTo(u, Un.rectGoal(tgt, !tgt.def.walkable))) { dropCargo(u); u.job = null; u.wait = 3; }
      return;
    }
    if (j.phase === 'go') {
      const n = take(from, j.res, j.n);
      if (n < 1) { u.job = null; return; }
      u.carry = n; u.carryRes = j.res; j.n = n; j.phase = 'back';
      u.mode = 'idle'; u.wait = 0.6;
    } else {
      const n = put(to, j.res, u.carry);
      if (n > 0 && PK.Render.float && !g.offline) PK.Render.float(to.cx, to.cy, '+' + Math.floor(n), j.res);
      u.carry -= n;
      if (u.carry > 0.5) { // no cupo todo: al almacén más cercano
        const st2 = nearestStore(u.x, u.y, j.res, true);
        if (st2 && st2 !== to) { j.to = st2.id; return; }
      }
      u.carry = 0; u.carryRes = null; u.job = null; u.wait = 0.4;
      g.stat('hauled', n);
    }
  };
  function dropCargo(u) {
    if (u.carry > 0 && u.carryRes) put(nearestStore(u.x, u.y, u.carryRes) || { def: {}, type: 'tc' }, u.carryRes, u.carry);
    u.carry = 0; u.carryRes = null;
  }
  // Sin trabajo, vuelven a la Carretería.
  function parkCart(u) {
    const home = G().buildings.find(b => b.owner === 'p' && b.type === 'cartwright' && b.done);
    if (home && U.dist(u.x, u.y, home.cx, home.cy) > 4) PK.Units.pathTo(u, PK.Units.rectGoal(home, true));
    u.wait = 4;
  }

  // ---------- Caminos ----------
  L.roadAllowed = function (x, y) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y), o = W.ownerAt(x, y);
    return W.fog[k] && W.terrain[k] !== 4 && W.bAt[k] < 0 && W.poiAt[k] < 0 && (!o || o === 'p') && !(W.block[k] && W.block[k] !== 1);
  };
  // Traza un camino entre dos casillas por donde se pueda (rodeando lo que estorba).
  L.roadPlan = function (x0, y0, x1, y1) {
    const path = [[x0, y0]];
    let x = x0, y = y0, guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 400) {
      const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
      // primero en diagonal "escalonada": alterna ejes para que el camino quede parejo
      if (dx && (!dy || Math.abs(x1 - x) >= Math.abs(y1 - y))) x += dx; else y += dy;
      path.push([x, y]);
    }
    return path.filter(([a, b]) => L.roadAllowed(a, b) && !W.road[W.idx(a, b)]);
  };
  L.buildRoad = function (tiles) {
    if (!tiles.length) return 0;
    const cost = {};
    for (const r in D.ROAD.cost) cost[r] = D.ROAD.cost[r] * tiles.length;
    if (!G().pay(cost)) { toast('Faltan recursos para ' + tiles.length + ' casillas de camino.', 'warn'); return 0; }
    for (const [x, y] of tiles) {
      const k = W.idx(x, y);
      if (W.block[k] === 1 && W.nodeAt[k] >= 0) { const n = W.nodes[W.nodeAt[k]]; if (n && W.soft(n)) W.depleteNode(n); else continue; }
      W.road[k] = 1;
    }
    W.roadVer++;
    G().stat('roads', tiles.length);
    if (PK.Sfx) PK.Sfx.play('build');
    return tiles.length;
  };
  L.removeRoad = function (x, y) {
    const k = W.idx(x, y);
    if (!W.road[k]) return;
    W.road[k] = 0; W.roadVer++;
    G().give(D.ROAD.cost, 0.5);
  };
  L.onRoad = (x, y) => W.road[W.idx(Math.floor(x), Math.floor(y))] === 1;

  // ---------- Cintas transportadoras ----------
  L.beltUnlocked = () => S().era >= D.BELT.era && G().levelCount(D.BELT.need.lvl, D.BELT.need.b) > 0;
  L.beltLockText = () => 'Las cintas requieren la Era ' + U.roman(D.BELT.era) + ' y un ' + D.BUILD[D.BELT.need.b].name + ' de nivel ' + D.BELT.need.lvl + '.';
  function markBelt(bl, on) {
    for (const [x, y] of bl.path) W.belt[W.idx(x, y)] = on ? bl.id : -1;
  }
  const canBelt = (x, y) => {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y), o = W.ownerAt(x, y);
    return W.fog[k] && W.terrain[k] !== 4 && W.bAt[k] < 0 && W.belt[k] < 0 && W.poiAt[k] < 0 && W.block[k] !== 1 && o === 'p';
  };
  // Ruta de la cinta: de una casilla junto a A hasta una casilla junto a B, por casillas libres propias.
  L.beltPlan = function (a, b) {
    const starts = [];
    for (let y = a.y - 1; y <= a.y + a.h; y++) for (let x = a.x - 1; x <= a.x + a.w; x++) {
      const edge = x === a.x - 1 || x === a.x + a.w || y === a.y - 1 || y === a.y + a.h;
      if (edge && !((x === a.x - 1 || x === a.x + a.w) && (y === a.y - 1 || y === a.y + a.h)) && canBelt(x, y)) starts.push([x, y]);
    }
    starts.sort((p, q) => U.dist(p[0], p[1], b.cx, b.cy) - U.dist(q[0], q[1], b.cx, b.cy));
    for (const s of starts.slice(0, 4)) {
      const path = bfs(s, b);
      if (path) return path;
    }
    return null;
  };
  // Búsqueda en anchura por casillas de cinta (4 direcciones: las cintas no van en diagonal).
  function bfs(s, b) {
    const prev = new Map(), q = [s], key = (x, y) => y * W.W + x;
    prev.set(key(s[0], s[1]), -1);
    const goal = (x, y) => (x === b.x - 1 || x === b.x + b.w) && y >= b.y && y < b.y + b.h || (y === b.y - 1 || y === b.y + b.h) && x >= b.x && x < b.x + b.w;
    for (let qi = 0; qi < q.length && qi < 6000; qi++) {
      const [x, y] = q[qi];
      if (goal(x, y)) {
        const out = [];
        let k = key(x, y);
        while (k !== -1) { out.push([k % W.W, Math.floor(k / W.W)]); k = prev.get(k); }
        return out.reverse();
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = key(nx, ny);
        if (prev.has(nk) || !(canBelt(nx, ny) || goal(nx, ny) && canBelt(nx, ny))) continue;
        prev.set(nk, key(x, y));
        q.push([nx, ny]);
      }
    }
    return null;
  }
  L.beltCost = n => { const c = {}; for (const r in D.BELT.cost) c[r] = D.BELT.cost[r] * n; return c; };
  L.buildBelt = function (a, b) {
    if (!L.beltUnlocked()) { toast(L.beltLockText(), 'warn'); return null; }
    if (a === b) return null;
    const path = L.beltPlan(a, b);
    if (!path) { toast('No hay por dónde pasar la cinta (tiene que ir por tu territorio, sin cruzar edificios).', 'warn'); return null; }
    if (!G().pay(L.beltCost(path.length))) { toast('Faltan recursos: cada casilla de cinta cuesta ' + D.BELT.cost.steel + ' acero y ' + D.BELT.cost.machinery + ' maquinaria (' + path.length + ' casillas).', 'warn'); return null; }
    const st = S(), bl = { id: st.logi.nextBelt++, a: a.id, b: b.id, res: null, path, items: [], acc: 0 };
    st.logi.belts.push(bl);
    markBelt(bl, true);
    G().stat('belts', 1);
    if (PK.Sfx) PK.Sfx.play('level');
    toast('Cinta de ' + path.length + ' casillas lista: ' + a.def.name + ' → ' + b.def.name + '.', 'good');
    return bl;
  };
  L.removeBelt = function (bl) {
    const st = S();
    markBelt(bl, false);
    st.logi.belts.splice(st.logi.belts.indexOf(bl), 1);
    G().give(L.beltCost(bl.path.length), 0.5);
  };
  L.beltAt = (x, y) => { const id = W.belt[W.idx(x, y)]; return id >= 0 ? S().logi.belts.find(b => b.id === id) : null; };

  // Qué lleva la cinta: lo que produce el origen, o el insumo que más le falta al destino.
  function beltRes(bl, a, b) {
    if (bl.res) return bl.res;
    if (L.isShop(a)) return L.output(a);
    if (L.isShop(b)) {
      const r = L.recipe(b);
      let best = null, bn = 0;
      for (const k in r.in) { const n = L.need(b, k); if (n > bn && L.storeAccepts(a, k) && S().res[k] > reserveOf(k, L.output(b))) { bn = n; best = k; } }
      return best;
    }
    return null;
  }
  function beltTick(bl, dt) {
    const g = G(), a = g.bById.get(bl.a), b = g.bById.get(bl.b);
    if (!a || !b || !a.done || !b.done) return;
    const len = bl.path.length, sp = D.BELT.speed;
    // avanzar y entregar
    for (let i = bl.items.length - 1; i >= 0; i--) {
      const it = bl.items[i], ahead = bl.items[i + 1];
      it.p = Math.min(it.p + sp * dt, ahead ? ahead.p - 0.34 : len);
      if (it.p >= len - 0.01 && !ahead) {
        if (L.isShop(b) && L.need(b, it.r) < 1) continue; // destino lleno: la cinta se detiene
        if (!L.isShop(b) && S().res[it.r] >= g.cap(it.r)) continue;
        put(b, it.r, 1);
        bl.items.pop();
        g.stat('belted', 1);
      }
    }
    // cargar
    bl.acc = Math.min(1, bl.acc + dt * D.BELT.rate);
    const res = beltRes(bl, a, b);
    if (!res || bl.acc < 1 || (bl.items.length && bl.items[0].p < 0.34)) return;
    if (L.isShop(b) && L.need(b, res) - bl.items.length < 1) return;
    let ok = false;
    if (L.isShop(a)) { ensure(a); if ((a.outb[res] || 0) >= 1) { a.outb[res] -= 1; ok = true; } }
    else if (S().res[res] - 1 >= (L.isShop(b) ? reserveOf(res, L.output(b)) : 0)) { S().res[res] -= 1; ok = true; }
    if (ok) { bl.acc = 0; bl.items.unshift({ p: 0, r: res }); }
  }

  // ---------- Bucle ----------
  L.update = function (dt) {
    const st = S();
    if (!st || !st.logi) return;
    for (const bl of st.logi.belts) beltTick(bl, dt);
  };
  // Sin ti, las carretas no se mueven de verdad: se calcula cuánto habrían llevado según cuántas hay.
  L.offline = function (dt) {
    const g = G(), st = S(), carts = L.carts().length;
    for (const bl of st.logi.belts) {
      const a = g.bById.get(bl.a), b = g.bById.get(bl.b);
      if (!a || !b) continue;
      let n = D.BELT.rate * dt;
      const res = beltRes(bl, a, b);
      if (!res) continue;
      if (L.isShop(b)) n = Math.min(n, L.need(b, res));
      n = take(a, res, n);
      if (n > 0) put(b, res, n);
    }
    if (!carts) return;
    let budget = carts * L.cartCap() * dt / 45; // un viaje de ida y vuelta tarda ~45 s
    const shops = g.buildings.filter(b => b.owner === 'p' && b.done && L.isShop(b) && !L.nearStore(b));
    for (const b of shops) {
      if (budget <= 0) break;
      const r = L.recipe(b), out = L.output(b);
      for (const k in r.in) {
        const n = Math.min(L.need(b, k), budget, Math.max(0, st.res[k] - reserveOf(k, out)));
        if (n > 0) { st.res[k] -= n; ensure(b); b.inb[k] = (b.inb[k] || 0) + n; budget -= n; }
      }
      const have = (b.outb && b.outb[out]) || 0, n = Math.min(have, budget, Math.max(0, g.cap(out) - st.res[out]));
      if (n > 0) { b.outb[out] -= n; st.res[out] += n; budget -= n; }
    }
  };

  // Si una parcela cambia de dueño, las cintas que pasaban por ahí se cortan.
  L.onTerritory = function () {
    const st = S();
    if (!st.logi) return;
    for (const bl of st.logi.belts.slice()) if (bl.path.some(([x, y]) => W.ownerAt(x, y) !== 'p')) { markBelt(bl, false); st.logi.belts.splice(st.logi.belts.indexOf(bl), 1); }
    for (let i = 0; i < W.road.length; i++) if (W.road[i]) { const o = W.ownerAt(i % W.W, Math.floor(i / W.W)); if (o && o !== 'p') W.road[i] = 0; }
    W.roadVer++;
  };
  // Al demoler un edificio, sus cintas se desarman (se devuelve la mitad).
  L.onRemove = function (b) {
    const st = S();
    if (!st || !st.logi) return;
    for (const bl of st.logi.belts.slice()) if (bl.a === b.id || bl.b === b.id) L.removeBelt(bl);
    if (b.inb) for (const k in b.inb) st.res[k] += Math.floor(b.inb[k]);
    if (b.outb) for (const k in b.outb) st.res[k] += Math.floor(b.outb[k]);
  };
})();
