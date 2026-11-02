// Murallas y puertas. Se trazan casilla por casilla en tu territorio; las puertas dejan pasar a tu gente
// pero no a los lobos. Una parcela rodeada por murallas (o edificios y agua) cuenta como "amurallada" y
// se defiende mucho mejor. Todas las murallas suben de material juntas: empalizada → piedra → sillares → bastión.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const Def = (PK.Def = { tool: null, start: null });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);
  const WALL = 1, GATE = 2, BLOCK = 5;

  Def.init = function (st) {
    st.def = st.def || { walls: [], gates: [], tier: 1 };
    W.wall.fill(0);
    for (const k of st.def.walls) { W.wall[k] = WALL; W.block[k] = BLOCK; }
    for (const k of st.def.gates) W.wall[k] = GATE;
    Def.recount();
  };
  Def.tier = () => D.WALL.tiers[S().def.tier - 1];
  Def.count = () => S().def.walls.length + S().def.gates.length;

  // ---------- Dónde se puede ----------
  Def.allowed = function (x, y, gate) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y);
    if (!W.fog[k] || W.terrain[k] === 4 || W.bAt[k] >= 0 || W.poiAt[k] >= 0 || W.belt[k] >= 0 || W.wall[k]) return false;
    if (W.ownerAt(x, y) !== 'p') return false;
    if (W.road[k] && !gate) return false; // sobre un camino solo va una puerta
    if (W.block[k] === 1) { const n = W.nodes[W.nodeAt[k]]; return !!(n && W.soft(n)); }
    return W.block[k] === 0;
  };
  // Línea escalonada de casillas (4-vecinas, así la muralla queda continua).
  Def.plan = function (x0, y0, x1, y1) {
    const out = [[x0, y0]];
    let x = x0, y = y0, guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 300) {
      if (x !== x1 && (y === y1 || Math.abs(x1 - x) >= Math.abs(y1 - y))) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
      out.push([x, y]);
    }
    return out.filter(([a, b]) => Def.allowed(a, b));
  };
  function clearSpot(k) {
    if (W.block[k] === 1 && W.nodeAt[k] >= 0) { const n = W.nodes[W.nodeAt[k]]; if (n && W.soft(n)) W.depleteNode(n); }
  }

  // ---------- Construir ----------
  Def.build = function (tiles) {
    if (!tiles.length) return 0;
    const cost = {}, c = Def.tier().cost;
    for (const r in c) cost[r] = c[r] * tiles.length;
    if (!G().pay(cost)) { toast('Faltan recursos para ' + tiles.length + ' casillas de ' + Def.tier().name.toLowerCase() + '.', 'warn'); return 0; }
    const st = S();
    for (const [x, y] of tiles) {
      const k = W.idx(x, y);
      clearSpot(k);
      W.wall[k] = WALL; W.block[k] = BLOCK;
      st.def.walls.push(k);
    }
    G().stat('walls_built', tiles.length);
    if (PK.Sfx) PK.Sfx.play('build');
    Def.recount();
    return tiles.length;
  };
  Def.gate = function (x, y) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y), st = S();
    if (W.wall[k] === GATE) { toast('Ahí ya hay una puerta.', 'info'); return false; }
    if (W.wall[k] !== WALL && !Def.allowed(x, y, true)) { toast('La puerta va sobre una muralla tuya o en una casilla libre de tu territorio.', 'warn'); return false; }
    if (!G().pay(D.WALL.gate)) { toast('Faltan recursos para la puerta.', 'warn'); return false; }
    if (W.wall[k] === WALL) st.def.walls.splice(st.def.walls.indexOf(k), 1);
    else clearSpot(k);
    W.wall[k] = GATE; W.block[k] = 0;
    st.def.gates.push(k);
    // se despeja el paso a ambos lados (árboles y arbustos frente a la puerta)
    let shut = 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      if (!W.inb(x + dx, y + dy)) continue;
      const n = W.idx(x + dx, y + dy);
      if (W.wall[n]) continue;
      clearSpot(n);
      if (!W.passable(x + dx, y + dy)) shut++;
    }
    if (shut) toast('Algo tapa un lado de la puerta: despéjalo para que tu gente pueda pasar.', 'warn');
    if (PK.Sfx) PK.Sfx.play('build');
    Def.recount();
    return true;
  };
  // Desarmar devuelve la mitad del material actual.
  Def.remove = function (k) {
    const st = S(), t = W.wall[k];
    if (!t) return;
    const c = t === GATE ? D.WALL.gate : Def.tier().cost, back = {};
    for (const r in c) back[r] = Math.floor(c[r] / 2);
    G().give(back);
    const list = t === GATE ? st.def.gates : st.def.walls;
    list.splice(list.indexOf(k), 1);
    W.wall[k] = 0;
    if (W.block[k] === BLOCK) W.block[k] = 0;
    Def.recount();
  };
  // Mejorar todas juntas al siguiente material.
  Def.nextTier = () => D.WALL.tiers[S().def.tier] || null;
  Def.upgradeCost = function () {
    const nx = Def.nextTier();
    if (!nx) return null;
    const n = Math.max(1, Def.count()), c = {};
    for (const r in nx.up) c[r] = nx.up[r] * n;
    return c;
  };
  Def.upgrade = function () {
    const nx = Def.nextTier();
    if (!nx) return;
    if (S().era < nx.era) { toast(nx.name + ' requiere la Era ' + U.roman(nx.era) + '.', 'warn'); return; }
    if (!G().pay(Def.upgradeCost())) { toast('Faltan recursos para mejorar todas tus murallas.', 'warn'); return; }
    S().def.tier++;
    toast('Tus murallas ahora son de ' + nx.name.toLowerCase() + '.', 'epic');
    if (PK.Sfx) PK.Sfx.play('level');
    Def.recount();
  };

  // Si pierdes la parcela, las murallas que quedaron en tierra ajena se desarman (con la mitad de vuelta).
  Def.onTerritory = function () {
    const st = S();
    for (const k of st.def.walls.concat(st.def.gates)) if (W.ownerAt(k % W.W, Math.floor(k / W.W)) !== 'p') Def.remove(k);
    dirty = true;
  };

  // ---------- Recinto ----------
  // Inundación desde todo lo que no es tuyo: lo tuyo que no se alcanza sin cruzar murallas, puertas,
  // edificios o agua está "adentro". Una parcela está amurallada si al menos el 60% de su tierra está adentro.
  let inside = null, dirty = true, lastTv = -1, lastB = -1;
  Def.walled = new Set();
  Def.recount = () => { dirty = true; };
  Def.ensure = function () {
    const g = G();
    if (!dirty && lastTv === W.terrVer && lastB === g.buildings.length) return;
    dirty = false; lastTv = W.terrVer; lastB = g.buildings.length;
    compute();
  };
  function compute() {
    const Wd = W.W, N = Wd * W.H;
    if (!inside) inside = new Uint8Array(N);
    inside.fill(1);
    const barrier = k => W.wall[k] || W.bAt[k] >= 0 || W.terrain[k] === 4;
    const stack = new Int32Array(N);
    let sp = 0;
    for (let k = 0; k < N; k++) {
      const x = k % Wd, y = (k / Wd) | 0;
      const out = W.ownerAt(x, y) !== 'p' || x === 0 || y === 0 || x === Wd - 1 || y === W.H - 1;
      if (out && !barrier(k)) { inside[k] = 0; stack[sp++] = k; }
    }
    while (sp) {
      const k = stack[--sp], x = k % Wd;
      const nb = [x > 0 ? k - 1 : -1, x < Wd - 1 ? k + 1 : -1, k - Wd, k + Wd];
      for (const n of nb) if (n >= 0 && n < N && inside[n] && !barrier(n)) { inside[n] = 0; stack[sp++] = n; }
    }
    Def.walled = new Set();
    if (!S().def.walls.length && !S().def.gates.length) return;
    const P = W.PW, PS = D.PARCEL;
    for (let k = 0; k < P * P; k++) {
      if (W.terr[k] !== D.MY_SLOT + 1) continue;
      const x0 = (k % P) * PS, y0 = Math.floor(k / P) * PS;
      let land = 0, inn = 0;
      for (let y = y0; y < y0 + PS; y++) for (let x = x0; x < x0 + PS; x++) {
        const i = y * Wd + x;
        if (W.terrain[i] === 4) continue;
        land++;
        if (inside[i]) inn++;
      }
      if (land && inn >= land * 0.6) Def.walled.add(k);
    }
  }
  Def.isInside = (x, y) => { Def.ensure(); return !!inside[W.idx(Math.floor(x), Math.floor(y))]; };
  Def.isWalled = k => { Def.ensure(); return Def.walled.has(k); };
  Def.walledCount = () => { Def.ensure(); return Def.walled.size; };
  // Multiplicador de defensa de una parcela propia.
  Def.parcelMult = (k, any) => (any || Def.isWalled(k) ? 1 + Def.tier().bonus : 1);
  Def.walledList = () => { Def.ensure(); return [...Def.walled]; };

  // ---------- Herramienta (dos toques para la muralla, uno para la puerta) ----------
  Def.cancel = function () { Def.tool = null; Def.start = null; if (PK.Render) PK.Render.wallGhost = null; };
  Def.ghost = function (tx, ty) {
    if (Def.tool === 'wall' && Def.start) PK.Render.wallGhost = Def.plan(Def.start[0], Def.start[1], tx, ty);
    else if (Def.tool === 'gate') PK.Render.wallGhost = W.inb(tx, ty) ? [[tx, ty]] : null;
  };
  Def.click = function (x, y) {
    if (Def.tool === 'gate') { Def.gate(x, y); return; }
    if (!Def.start) {
      if (!Def.allowed(x, y)) { toast('La muralla va en tu territorio, en casillas exploradas y libres.', 'warn'); return; }
      Def.start = [x, y]; toast('Toca dónde termina el tramo.', 'info'); return;
    }
    const n = Def.build(Def.plan(Def.start[0], Def.start[1], x, y));
    if (n) {
      toast(n + ' casillas de ' + Def.tier().name.toLowerCase() + '.' + (Def.walledCount() ? ' Parcelas amuralladas: ' + Def.walledCount() + '.' : ''), 'good');
      Def.start = [x, y];
      if (Def.walledCount() && !S().def.gates.length) toast('Tu gente necesita una puerta para salir del recinto.', 'warn');
    }
    PK.Render.wallGhost = null;
  };
})();
