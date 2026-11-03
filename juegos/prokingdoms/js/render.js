// Render isométrico en canvas. El mapa es grande, así que todo se hace por trozos de 16x16: solo se pinta y
// se recorre lo que está a la vista, el terreno de cada trozo se genera cuando hace falta (y se olvida si
// hay demasiados en memoria) y la niebla se repinta solo donde cambió. Pensado para que ande en celular.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const R = (PK.Render = { cam: { x: 0, y: 0, z: 2 }, drawn: [], particles: [], showZones: true, hover: null });
  const G = () => PK.Game;
  const MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const MAX_CHUNKS = MOBILE ? 36 : 90;

  R.iso = (tx, ty) => [(tx - ty) * 16 + W.H * 16, (tx + ty) * 8];
  R.tileAt = (wx, wy) => { const a = (wx - W.H * 16) / 16, b = wy / 8; return [(a + b) / 2, (b - a) / 2]; };

  R.init = function (canvas) {
    R.cv = canvas;
    R.ctx = canvas.getContext('2d');
    R.resize();
    window.addEventListener('resize', () => R.resize());
  };
  R.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2);
    R.dpr = dpr;
    R.cv.width = Math.floor(window.innerWidth * dpr);
    R.cv.height = Math.floor(window.innerHeight * dpr);
    R.cv.style.width = window.innerWidth + 'px';
    R.cv.style.height = window.innerHeight + 'px';
  };
  R.scale = () => R.cam.z * R.dpr;

  R.screenToWorld = function (sx, sy) {
    const s = R.scale();
    return [(sx * R.dpr - R.cv.width / 2) / s + R.cam.x, (sy * R.dpr - R.cv.height / 2) / s + R.cam.y];
  };
  R.screenToTile = function (sx, sy) { const [wx, wy] = R.screenToWorld(sx, sy); return R.tileAt(wx, wy); };
  R.worldToScreen = function (wx, wy) {
    const s = R.scale();
    return [((wx - R.cam.x) * s + R.cv.width / 2) / R.dpr, ((wy - R.cam.y) * s + R.cv.height / 2) / R.dpr];
  };
  R.centerOn = function (tx, ty) { const [x, y] = R.iso(tx, ty); R.cam.x = x; R.cam.y = y; R.clampCam(); };
  R.clampCam = function () {
    const maxX = (W.W + W.H) * 16, maxY = (W.W + W.H) * 8;
    R.cam.x = U.clamp(R.cam.x, 0, maxX);
    R.cam.y = U.clamp(R.cam.y, 0, maxY);
  };

  // ---------- Terreno por trozos ----------
  const ground = new Map();
  let frameNo = 0, budget = 0;
  function groundChunk(cx, cy) {
    const ci = cy * W.CW + cx;
    let g = ground.get(ci);
    if (!g) {
      if (budget <= 0) return null;
      budget--;
      g = Sp.renderGroundChunk(W, cx, cy);
      ground.set(ci, g);
      if (ground.size > MAX_CHUNKS) {
        let worst = null, wu = Infinity;
        for (const [k, o] of ground) if (o.used < wu && k !== ci) { wu = o.used; worst = k; }
        ground.delete(worst);
      }
    }
    g.used = frameNo;
    return g;
  }
  // ¿Hay algo explorado en el trozo? Si no, se tapa con niebla y ni se pinta.
  function chunkSeen(ci) {
    if (!W.chunkSeen || W.chunkSeenVer !== W.fogVer) {
      if (!W.chunkSeen) W.chunkSeen = new Uint8Array(W.CW * W.CW);
      if (W.fogDirty || W.chunkSeenVer === undefined) for (let i = 0; i < W.fog.length; i += 1) if (W.fog[i]) W.chunkSeen[W.chunkOf(i % W.W, (i / W.W) | 0)] = 1;
      W.chunkSeenVer = W.fogVer;
    }
    return W.chunkSeen[ci] === 1;
  }
  // Agua de cada trozo (para los destellos), calculada una sola vez.
  const waterOf = [];
  function chunkWater(ci) {
    if (waterOf[ci]) return waterOf[ci];
    const out = [], x0 = (ci % W.CW) * W.CH, y0 = Math.floor(ci / W.CW) * W.CH;
    for (let y = y0; y < y0 + W.CH; y++) for (let x = x0; x < x0 + W.CH; x++) if (W.terrain[W.idx(x, y)] === 4 && W.waterDist[W.idx(x, y)] > 0.5) out.push([x, y]);
    return (waterOf[ci] = out);
  }
  // Bordes punteados de las zonas comunes, por trozo (no cambian nunca).
  const zoneSegs = [];
  function chunkZoneSegs(ci) {
    if (zoneSegs[ci]) return zoneSegs[ci];
    const out = [], x0 = (ci % W.CW) * W.CH, y0 = Math.floor(ci / W.CW) * W.CH;
    for (let y = y0; y < y0 + W.CH; y++) for (let x = x0; x < x0 + W.CH; x++) {
      const z = W.zoneAt[W.idx(x, y)];
      if (z < 0 || !W.zones[z].common) continue;
      const other = (nx, ny) => !W.inb(nx, ny) || W.zoneAt[W.idx(nx, ny)] !== z;
      if (other(x, y - 1)) out.push([x, y, x + 1, y]);
      if (other(x + 1, y)) out.push([x + 1, y, x + 1, y + 1]);
      if (other(x, y + 1)) out.push([x, y + 1, x + 1, y + 1]);
      if (other(x - 1, y)) out.push([x, y, x, y + 1]);
    }
    return (zoneSegs[ci] = out);
  }

  // ---------- Niebla ----------
  // Una sola imagen a 1/4 de resolución, escalada con suavizado. Solo se repinta el rectángulo que cambió.
  let fogC = null, fogCtx = null;
  function fogPaint(x0, y0, x1, y1) {
    const fw = fogC.width, fh = fogC.height;
    const px0 = U.clamp(Math.floor(((x0 - y1 - 1) * 16 + W.H * 16) / 4) - 2, 0, fw), px1 = U.clamp(Math.ceil(((x1 + 1 - y0) * 16 + W.H * 16) / 4) + 2, 0, fw);
    const py0 = U.clamp(Math.floor(((x0 + y0) * 8) / 4) - 2, 0, fh), py1 = U.clamp(Math.ceil(((x1 + y1 + 2) * 8) / 4) + 2, 0, fh);
    const w = px1 - px0, h = py1 - py0;
    if (w <= 0 || h <= 0) return;
    const im = fogCtx.createImageData(w, h), d = im.data;
    for (let my = 0; my < h; my++) {
      const b = ((py0 + my) * 4) / 8;
      for (let mx = 0; mx < w; mx++) {
        const a = ((px0 + mx) * 4 - W.H * 16) / 16, tx = Math.floor((a + b) / 2), ty = Math.floor((b - a) / 2);
        const inside = tx >= 0 && ty >= 0 && tx < W.W && ty < W.H;
        if (inside && W.fog[ty * W.W + tx]) continue;
        const i = (my * w + mx) * 4, hh = U.hash((px0 + mx) >> 2, (py0 + my) >> 2, 5);
        d[i] = 16 + hh * 8; d[i + 1] = 14 + hh * 6; d[i + 2] = 10 + hh * 4; d[i + 3] = inside ? 238 : 255;
      }
    }
    fogCtx.putImageData(im, px0, py0);
  }
  function updateFog() {
    if (!fogC) {
      fogC = Sp.mk((W.W + W.H) * 4, (W.W + W.H) * 2 + 1);
      fogCtx = fogC.getContext('2d');
      W.fogDirty = { x0: 0, y0: 0, x1: W.W - 1, y1: W.H - 1 };
    }
    const f = W.fogDirty;
    if (!f) return;
    W.fogDirty = null;
    fogPaint(Math.max(0, f.x0), Math.max(0, f.y0), Math.min(W.W - 1, f.x1), Math.min(W.H - 1, f.y1));
    if (W.chunkSeen) for (let y = Math.max(0, f.y0); y <= Math.min(W.H - 1, f.y1); y++) for (let x = Math.max(0, f.x0); x <= Math.min(W.W - 1, f.x1); x++) if (W.fog[W.idx(x, y)]) W.chunkSeen[W.chunkOf(x, y)] = 1;
  }
  const seen = (x, y) => W.fog[(y | 0) * W.W + (x | 0)] === 1;

  function nodeSprite(n) {
    if (n.gone) return null;
    if (n.kind === 'deer') return n.dead ? null : n.gold ? Sp.deerGold[n.v % 2] : Sp.deer[n.v % 4];
    if (n.kind === 'tree') return n.dead ? Sp.stump : Sp.trees[n.sp][n.v % Sp.trees[n.sp].length];
    if (n.kind === 'berry') return n.dead || n.amount < n.max * 0.15 ? Sp.bushBare : Sp.bush[n.v % 3];
    const r = n.amount / n.max, sz = r > 0.5 ? 2 : r > 0.15 ? 1 : 0;
    return Sp.rocks[n.kind][sz][n.v % 2];
  }

  // Golpes por segundo de cada herramienta. Cuadros: preparar (largo), medio, impacto (se sostiene) y rebote.
  const SWING = { axe: 1.0, pick: 0.95, hammer: 1.5, sickle: 1.25, knife: 1.4, hand: 1.1 };
  function unitSprite(u) {
    const col = Sp.ownerColor(u.owner);
    if (u.kind === 'cart') return Sp.cart(col, u.carry > 0 ? u.carryRes : null, u.flip, Math.floor(u.anim * 8) % 4, u.mode === 'walk');
    let mode = u.mode, frame = 0, tool = null, aim = null;
    if (mode === 'walk') frame = Math.floor(u.anim * 9) % 6;
    else if (mode === 'work') {
      const t = u.task && u.task.t, n = t === 'gather' && W.nodes[u.task.node];
      tool = t === 'dig' ? 'pick' : t === 'build' ? 'hammer' : t === 'farm' ? 'sickle' : !n ? 'pick'
        : n.kind === 'tree' ? 'axe' : n.kind === 'berry' ? 'hand' : n.kind === 'deer' ? 'knife' : 'pick';
      const ph = (u.anim * SWING[tool] + u.id * 0.37) % 1;
      frame = tool === 'hand' ? Math.floor(ph * 4) : ph < 0.4 ? 0 : ph < 0.52 ? 1 : ph < 0.8 ? 2 : 3;
      if (u.aim) { // punto de contacto en pantalla: el borde del objetivo que da al aldeano, a la altura del golpe
        const a = u.aim, [ux, uy] = R.iso(u.x, u.y), [tx, ty] = R.iso(a.x, a.y);
        let dx = tx - ux, dy = ty - uy;
        const d = Math.hypot(dx, dy) || 1;
        dx -= (dx / d) * a.r; dy -= (dy / d) * a.r * 0.5;
        dy = Math.max(dy - a.h1, Math.min(dy - a.h0, -a.w));
        aim = [Math.round(Math.abs(dx)), Math.round(dy)];
      }
    }
    u.swTool = tool; u.swF = frame;
    return Sp.villager(col, u.hair, u.skin, mode, frame, u.carry > 0 ? u.carryRes : null, u.flip, tool, u.kind === 'scout', u.back && (mode === 'walk' || mode === 'work'), aim);
  }

  // Efecto del golpe, en el cuadro exacto en que la herramienta toca: astillas y hojas, esquirlas y chispas,
  // tierra, paja o polvo según lo que se golpea, más la sacudida del objetivo y su sonido.
  function impact(u, x, y) {
    const t = u.task, tool = u.swTool, n = t && t.t === 'gather' && W.nodes[t.node], away = u.flip ? 1 : -1, P = R.particles, rnd = Math.random;
    const bits = (k, cols, sp, up, grav, max) => {
      for (let i = 0; i < k; i++) P.push({ x, y, vx: away * (3 + rnd() * sp) * (rnd() < 0.2 ? -1 : 1), vy: -up * (0.4 + rnd() * 0.8), life: 0, max: max * (0.7 + rnd() * 0.6), s: 1, grav, rgb: cols[i % cols.length] });
    };
    const puff = (k, c) => { for (let i = 0; i < k; i++) P.push({ x: x + (rnd() - 0.5) * 4, y: y + 1, vx: (rnd() - 0.5) * 10, vy: -3 - rnd() * 4, life: 0, max: 0.6 + rnd() * 0.4, s: 1, puff: c }); };
    let snd = null;
    if (n) n.shk = n.kind === 'tree' ? 0.22 : 0.14;
    if (tool === 'axe') {
      bits(4, [[204, 160, 104], [232, 200, 146], [120, 84, 50]], 20, 26, 90, 0.55);
      for (let i = 0; i < 2; i++) if (rnd() < 0.7) P.push({ x: x + (rnd() - 0.5) * 14, y: y - 10 - rnd() * 10, vx: (rnd() - 0.5) * 8, vy: 3 + rnd() * 4, life: 0, max: 1.3, s: 1, rgb: rnd() < 0.5 ? [70, 130, 50] : [118, 166, 62] });
      snd = 'chop';
    } else if (tool === 'pick' && n) {
      bits(4, [Sp.CARRY[t.res] || [150, 148, 140], [118, 116, 110], [184, 182, 174]], 22, 30, 110, 0.45);
      P.push({ x, y, vx: -away * 26, vy: -22, life: 0, max: 0.12, s: 1, rgb: [255, 244, 190] }, { x, y, vx: -away * 14, vy: -32, life: 0, max: 0.1, s: 1, rgb: [255, 214, 110] });
      snd = 'pick';
    } else if (tool === 'pick') { bits(4, [[118, 90, 58], [150, 120, 80]], 14, 24, 100, 0.5); puff(2, [168, 140, 104]); snd = 'dig'; }
    else if (tool === 'hammer') { bits(2, [[196, 156, 100], [150, 110, 70]], 12, 20, 100, 0.4); puff(1, [200, 186, 160]); snd = 'hammer'; }
    else if (tool === 'sickle') { bits(3, [[230, 200, 100], [196, 164, 72], [120, 150, 60]], 10, 18, 70, 0.6); snd = 'reap'; }
    else if (tool === 'knife') bits(2, [[150, 112, 80], [120, 90, 62]], 6, 10, 80, 0.4);
    else if (tool === 'hand') bits(2, [[80, 140, 60], [206, 52, 56]], 6, 12, 80, 0.5);
    if (snd && u.owner === 'p' && PK.Sfx) PK.Sfx.play(snd);
  }

  // Trozos visibles: se pasa de las esquinas de la pantalla a casillas y se revisa cada trozo del rango.
  function visibleChunks(vx0, vy0, vw, vh) {
    const corners = [R.tileAt(vx0, vy0), R.tileAt(vx0 + vw, vy0), R.tileAt(vx0, vy0 + vh), R.tileAt(vx0 + vw, vy0 + vh)];
    const tx0 = Math.min(...corners.map(c => c[0])) - 2, tx1 = Math.max(...corners.map(c => c[0])) + 6;
    const ty0 = Math.min(...corners.map(c => c[1])) - 2, ty1 = Math.max(...corners.map(c => c[1])) + 6;
    const out = [];
    for (let cy = Math.max(0, Math.floor(ty0 / W.CH)); cy <= Math.min(W.CW - 1, Math.floor(ty1 / W.CH)); cy++)
      for (let cx = Math.max(0, Math.floor(tx0 / W.CH)); cx <= Math.min(W.CW - 1, Math.floor(tx1 / W.CH)); cx++) {
        const x0 = cx * W.CH, y0 = cy * W.CH, gx = (x0 - y0 - W.CH) * 16 + W.H * 16, gy = (x0 + y0) * 8;
        if (gx + W.CH * 32 < vx0 || gx > vx0 + vw || gy + W.CH * 16 < vy0 - 10 || gy - 120 > vy0 + vh) continue;
        out.push({ ci: cy * W.CW + cx, cx, cy, gx, gy, onScreen: gy + W.CH * 16 >= vy0 && gy <= vy0 + vh });
      }
    return out;
  }

  let sparkT = 0, smokeT = 0, firstFrame = true;
  R.draw = function (dt) {
    const ctx = R.ctx, cv = R.cv, s = R.scale(), g = G();
    frameNo++;
    sparkT += dt; smokeT += dt;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16140f';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    const ox = Math.round(cv.width / 2 - R.cam.x * s), oy = Math.round(cv.height / 2 - R.cam.y * s);
    ctx.setTransform(s, 0, 0, s, ox, oy);
    const vx0 = -ox / s, vy0 = -oy / s, vw = cv.width / s, vh = cv.height / s;
    const vis = (x, y, w, h) => x + w >= vx0 && y + h >= vy0 && x <= vx0 + vw && y <= vy0 + vh;
    updateFog();
    const chunks = visibleChunks(vx0, vy0, vw, vh);
    budget = firstFrame ? 999 : MOBILE ? 1 : 2; // trozos nuevos por cuadro (el primero, todos)
    firstFrame = false;

    // terreno
    const pending = [];
    for (const c of chunks) {
      if (!c.onScreen || !chunkSeen(c.ci)) continue;
      const gch = groundChunk(c.cx, c.cy);
      if (gch) ctx.drawImage(gch.c, gch.x, gch.y);
      else pending.push(c);
    }
    // trozo aún sin pintar: color de pasto liso para que no se vea un hueco
    for (const c of pending) {
      const x0 = c.cx * W.CH, y0 = c.cy * W.CH;
      const p = [R.iso(x0, y0), R.iso(x0 + W.CH, y0), R.iso(x0 + W.CH, y0 + W.CH), R.iso(x0, y0 + W.CH)];
      ctx.fillStyle = '#5a7c32'; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); ctx.fill();
    }
    // destellos del agua
    const tsec = performance.now() / 1000;
    ctx.fillStyle = 'rgba(220,240,255,0.55)';
    for (const c of chunks) {
      if (!c.onScreen || !chunkSeen(c.ci)) continue;
      const wl = chunkWater(c.ci);
      for (let i = 0; i < wl.length; i += 3) {
        const [x, y] = wl[i], hsh = U.hash(x, y, 1);
        const ph = (tsec * 0.6 + hsh * 10) % 4;
        if (ph > 0.5) continue;
        const [px, py] = R.iso(x + 0.5, y + 0.5);
        const w = ph < 0.25 ? 3 : 2;
        ctx.fillRect(Math.round(px - 4 + hsh * 8), Math.round(py - 2 + U.hash(x, y, 2) * 4), w, 1);
      }
    }
    // caminos y cintas (planos, sobre el suelo)
    drawRoads(ctx, chunks);
    drawBelts(ctx, vis);
    // bordes de zonas comunes
    if (R.showZones) {
      ctx.strokeStyle = 'rgba(255,226,120,0.8)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (const c of chunks) {
        if (!c.onScreen) continue;
        for (const [x0, y0, x1, y1] of chunkZoneSegs(c.ci)) {
          if (!seen(x0 < W.W ? x0 : x0 - 1, y0 < W.H ? y0 : y0 - 1)) continue;
          const a = R.iso(x0, y0), b = R.iso(x1, y1);
          ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        }
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (!PK.Terr.mode) drawTerritory(ctx, vx0, vy0, vw, vh);

    const sel = g.sel;
    const selUnits = sel && sel.type === 'units' ? new Set(sel.ids) : null;
    const list = [], flats = [], aprons = [];
    const labels = [];
    // recursos (solo los trozos a la vista)
    for (const c of chunks) {
      for (const n of W.chunkNodes[c.ci]) {
        const [px, py] = R.iso(n.x + 0.5, n.y + 0.5);
        if (px < vx0 - 24 || px > vx0 + vw + 24 || py < vy0 - 8 || py > vy0 + vh + 48) continue;
        if (!seen(n.x, n.y)) continue;
        const spr = nodeSprite(n);
        if (!spr) continue;
        let shx = 0; // sacudida al recibir un golpe
        if (n.shk > 0) { n.shk -= dt; shx = Math.round(Math.sin(n.shk * 70) * (n.kind === 'tree' ? 1.3 : 0.8)); }
        list.push({ d: n.x + n.y + 1, k: 'node', o: n, spr, x: Math.round(px - spr.ax) + shx, y: Math.round(py - spr.ay) });
      }
    }
    // puntos de interés
    for (const p of W.pois) {
      const [px, py] = R.iso(p.x, p.y);
      if (px < vx0 - 60 || px > vx0 + vw + 60 || py < vy0 - 20 || py > vy0 + vh + 80 || !seen(p.x, p.y)) continue;
      const st = g.poiState(p), spr = Sp.poi(p.kind, st && st.d);
      const x = Math.round(px - spr.ox), y = Math.round(py - spr.oy);
      if (!vis(x, y, spr.c.width, spr.c.height)) continue;
      list.push({ d: p.x + p.y + (p.w + p.h) / 2, k: 'poi', o: p, spr, x, y });
      if (st && !st.d && p.kind === 'relic' && Math.random() < dt * 3) R.particles.push({ x: px + (Math.random() - 0.5) * 6, y: py - 12, vx: 0, vy: -8, life: 0, max: 1.2, s: 1, rgb: [255, 230, 120] });
      if (p.kind === 'camp' && !(st && st.d) && smokeT > 0.35) R.particles.push({ x: x + spr.c.width / 2, y: y + spr.oy + 10, vx: 2, vy: -7, life: 0, max: 2, s: 1, c: 90 });
    }
    // lobos
    for (const w of PK.Life.wolves) {
      if (!seen(w.x, w.y)) continue;
      const [px, py] = R.iso(w.x, w.y), spr = Sp.wolf[w.flip ? 1 : 0][Math.floor(w.anim * 8) % 2];
      list.push({ d: w.x + w.y, k: 'wolf', o: w, spr, x: Math.round(px - spr.ax), y: Math.round(py - spr.ay), px, py });
    }
    // edificios
    for (const b of g.buildings) {
      if (b.owner !== 'p' && !seen(b.cx, b.cy)) continue;
      const [px, py] = R.iso(b.x, b.y);
      if (px < vx0 - 200 || px > vx0 + vw + 200 || py < vy0 - 40 || py > vy0 + vh + 200) continue;
      const spr = Sp.building(b.type, b.owner, b.lvl);
      const x = Math.round(px - spr.ox), y = Math.round(py - spr.oy);
      if (!vis(x, y, spr.c.width, spr.c.height)) continue;
      const item = { d: b.x + b.y + (b.w + b.h) / 2, k: 'building', o: b, spr, x, y };
      if (b.def.flat) { item.d = b.x + b.y; flats.push(item); } else list.push(item);
      // suelo alrededor según la era del dueño (los reinos simulados, según el nivel del edificio)
      const st = b.done && !b.def.walkable ? Sp.apronStyle(b.owner === 'p' ? g.state.era : Math.ceil((b.lvl - 1) / 2)) : 0;
      if (st) { const a = Sp.apron(b.w, b.h, st); aprons.push([a, Math.round(px - a.ox), Math.round(py - a.oy)]); }
      if (b.done && spr.smoke.length && smokeT > 0.35 && (b.type !== 'house' || U.hash(b.id, 0, 4) > 0.4)) {
        const working = !b.def.recipe || b.workers.length > 0 || b.owner !== 'p', big = spr.tier >= 3 ? 1 + (spr.tier - 2) * 0.2 : 1;
        if (working) for (const sm of spr.smoke) {
          R.particles.push({ x: x + sm[0], y: y + sm[1], vx: 3 + Math.random() * 2, vy: -6 - Math.random() * 3, life: 0, max: 2.6 + Math.random(), s: 1, big, c: b.type === 'smelter' || b.type === 'forge' ? 70 : 150 });
          if (spr.tier >= 4 && Math.random() < 0.3) R.particles.push({ x: x + sm[0], y: y + sm[1], vx: (Math.random() - 0.5) * 6, vy: -14, life: 0, max: 0.7, s: 1, rgb: [255, 200, 110] }); // chispas
        }
      }
    }
    if (smokeT > 0.35) smokeT = 0;
    // murallas y puertas (cada casilla se une con sus vecinas)
    const dst = g.state && g.state.def;
    if (dst && (dst.walls.length || dst.gates.length)) {
      const wl = (x, y) => W.inb(x, y) && W.wall[W.idx(x, y)] > 0;
      for (const arr of [dst.walls, dst.gates]) for (const k of arr) {
        const x = k % W.W, y = (k / W.W) | 0, [px, py] = R.iso(x, y);
        if (px < vx0 - 40 || px > vx0 + vw + 40 || py < vy0 - 50 || py > vy0 + vh + 30) continue;
        const mask = (wl(x, y - 1) ? 1 : 0) | (wl(x + 1, y) ? 2 : 0) | (wl(x, y + 1) ? 4 : 0) | (wl(x - 1, y) ? 8 : 0);
        const spr = Sp.wall(mask, dst.tier, W.wall[k] === 2, D.PLAYER_COLOR);
        list.push({ d: x + y + 1, k: 'wall', o: { k, x, y }, spr, x: Math.round(px - spr.ox), y: Math.round(py - spr.oy) });
      }
    }
    // unidades (en alta definición: se dibujan achicadas y con suavizado)
    for (const u of g.units) {
      if (u.inside || (u.owner !== 'p' && !seen(u.x, u.y))) continue;
      const [px, py] = R.iso(u.x, u.y);
      if (!vis(px - 14, py - 20, 28, 24)) continue;
      const prevF = u.mode === 'work' ? u.swF : -1, spr = unitSprite(u);
      list.push({ d: u.x + u.y, k: 'unit', o: u, spr, x: px - spr.ax, y: py - spr.ay, px, py, sel: selUnits && selUnits.has(u.id) });
      if (u.mode === 'work' && u.swF === 2 && prevF !== 2 && spr.hit) impact(u, px + spr.hit[0], py + spr.hit[1]);
    }
    // soldados: guarnición del Cuartel, columnas en marcha y peleas (troops.js)
    if (PK.Troops) PK.Troops.collect(list, dt, vis);

    // capa plana: granjas y marcas de selección
    for (const [a, ax, ay] of aprons) ctx.drawImage(a.c, ax, ay);
    flats.sort((a, b) => a.d - b.d);
    for (const f of flats) drawBuilding(ctx, f);
    if (sel && sel.type === 'building') {
      const b = g.bById.get(sel.id);
      if (b) diamond(ctx, b.x, b.y, b.w, b.h, 'rgba(255,255,255,0.85)');
    }
    if (sel && sel.type === 'node') { const n = W.nodes[sel.id]; if (n) diamond(ctx, n.x, n.y, 1, 1, 'rgba(255,240,170,0.85)'); }
    for (const it of list) if (it.k === 'unit' && it.sel) ellipse(ctx, it.px, it.py, 'rgba(255,255,255,0.9)', it.o.kind === 'cart' ? 9 : 5);
    if (R.hover && R.hover.k === 'unit' && !(R.hover.o && selUnits && selUnits.has(R.hover.o.id))) {
      const [px, py] = R.iso(R.hover.o.x, R.hover.o.y);
      ellipse(ctx, px, py, 'rgba(255,255,255,0.4)', 5);
    }

    list.sort((a, b) => a.d - b.d);
    R.drawn = flats.concat(list);
    for (const it of list) {
      if (it.k === 'building') drawBuilding(ctx, it);
      else if (it.spr.k) {
        // sprites al doble de píxeles (aldeanos): nítidos si caben enteros, suavizados solo al alejar la cámara
        const k = it.spr.k, soft = R.scale() < k;
        if (soft) ctx.imageSmoothingEnabled = true;
        ctx.drawImage(it.spr.c, Math.round(it.x * k) / k, Math.round(it.y * k) / k, it.spr.w, it.spr.h);
        if (soft) ctx.imageSmoothingEnabled = false;
      }
      else ctx.drawImage(it.spr.c, it.x, it.y);
      if (it.after) it.after(ctx);
    }

    // niebla de lo no explorado
    if (fogC) {
      ctx.imageSmoothingEnabled = true;
      const fx0 = Math.max(0, Math.floor(vx0 / 4) - 2), fy0 = Math.max(0, Math.floor(vy0 / 4) - 2);
      const fw = Math.min(fogC.width - fx0, Math.ceil(vw / 4) + 5), fh = Math.min(fogC.height - fy0, Math.ceil(vh / 4) + 5);
      if (fw > 0 && fh > 0) ctx.drawImage(fogC, fx0, fy0, fw, fh, fx0 * 4, fy0 * 4, fw * 4, fh * 4);
      ctx.imageSmoothingEnabled = false;
    }
    // en el mapa de territorio las parcelas se ven encima de la niebla (tus tierras siempre)
    if (PK.Terr.mode) drawTerritory(ctx, vx0, vy0, vw, vh);

    // barras de progreso y marcas
    for (const it of list) {
      if (it.k === 'building') {
        const b = it.o;
        if (!b.done) bar(ctx, it.x + it.spr.c.width / 2 - 14, it.y + it.spr.oy - 10, 28, b.progress, '#e8c050');
        else if (b.upg) bar(ctx, it.x + it.spr.c.width / 2 - 14, it.y + (it.spr.pad || 0) + 2, 28, b.upg.t / b.upg.total, '#f0a040');
        else if (b.owner === 'p' && b.def.trains && b.queue.length) bar(ctx, it.x + it.spr.c.width / 2 - 14, it.y + (it.spr.pad || 0) + 4, 28, b.qt / g.trainTime(b), '#7ac0ff');
        else if (b.owner === 'p' && b.type === 'barracks' && g.state.war.q.length && PK.Social.trainSpeed()) bar(ctx, it.x + it.spr.c.width / 2 - 14, it.y + (it.spr.pad || 0) + 4, 28, g.state.war.qt / D.ARMY[g.state.war.q[0]].time, '#e05040');
        else if (b.owner === 'p' && b.type === 'cartwright' && b.queue.length) bar(ctx, it.x + it.spr.c.width / 2 - 14, it.y + (it.spr.pad || 0) + 4, 28, b.qt / D.CART.time, '#7ac0ff');
        if (b.owner === 'p' && b.def.recipe && b.done) {
          const cx = it.x + it.spr.c.width / 2, cy = it.y + (it.spr.pad || 0) + 8, n = g.slots(b);
          for (let i = 0; i < n; i++) {
            ctx.fillStyle = i < b.workers.length ? '#7ac0ff' : 'rgba(0,0,0,0.45)';
            ctx.fillRect(Math.round(cx - n * 2.5 + i * 5), cy, 4, 3);
          }
          // depósitos: entrada (verde) y salida (ámbar)
          const cap = PK.Logi.bufCap(b), r = D.RECIPES[b.def.recipe], out = Object.keys(r.out)[0];
          const inFill = Math.min(...Object.keys(r.in).map(k => ((b.inb && b.inb[k]) || 0) / cap));
          bar(ctx, cx - 12, cy + 5, 11, inFill, '#7ad070');
          bar(ctx, cx + 1, cy + 5, 11, ((b.outb && b.outb[out]) || 0) / cap, '#f0b040');
          if (b.status === 'Faltan insumos' || b.status === 'Depósito de salida lleno') { ctx.fillStyle = '#ff5040'; ctx.fillRect(Math.round(cx) - 1, cy - 8, 2, 5); ctx.fillRect(Math.round(cx) - 1, cy - 2, 2, 1); }
        }
        if (b.owner === 'p' && b.done && !b.def.noUp) labels.push([it.x + it.spr.c.width / 2, it.y + it.spr.c.height - 2, b.lvl, !!b.upg]);
      } else if (it.k === 'wolf' && it.o.hp < it.o.max) {
        bar(ctx, it.px - 7, it.y - 3, 14, it.o.hp / it.o.max, '#e05040');
      } else if (it.k === 'unit' && it.o.scared > 0) {
        ctx.fillStyle = '#ffe070'; ctx.fillRect(Math.round(it.px) - 1, Math.round(it.y) - 5, 2, 4); ctx.fillRect(Math.round(it.px) - 1, Math.round(it.y), 2, 1);
      } else if (it.k === 'unit' && it.sel && it.o.carry > 0 && it.o.kind === 'v') {
        const cap = g.carryCap(it.o.owner);
        bar(ctx, it.px - 6, it.y - 3, 12, it.o.carry / cap, '#e8c050');
      }
    }

    // fantasma de construcción, de camino o de cinta
    if (g.placing && R.ghost) {
      const def = D.BUILD[g.placing.type], { x, y, ok } = R.ghost;
      for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) diamondFill(ctx, x + i, y + j, ok ? 'rgba(80,220,90,0.28)' : 'rgba(230,60,50,0.35)');
      const spr = Sp.building(g.placing.type, 'p', 1), [px, py] = R.iso(x, y);
      ctx.globalAlpha = ok ? 0.75 : 0.45;
      ctx.drawImage(spr.c, Math.round(px - spr.ox), Math.round(py - spr.oy));
      ctx.globalAlpha = 1;
    }
    if (R.roadGhost) for (const [x, y] of R.roadGhost) diamondFill(ctx, x, y, 'rgba(230,200,120,0.45)');
    if (R.wallGhost) for (const [x, y] of R.wallGhost) diamondFill(ctx, x, y, PK.Def.tool === 'gate' ? 'rgba(232,184,74,0.6)' : 'rgba(210,210,220,0.55)');
    if (R.beltGhost) for (const [x, y] of R.beltGhost) diamondFill(ctx, x, y, 'rgba(140,200,255,0.45)');

    // punto de reunión
    if (sel && sel.type === 'building') {
      const b = g.bById.get(sel.id);
      if (b && b.rally) {
        const r = b.rally, t = r.kind === 'node' ? [W.nodes[r.id].x + 0.5, W.nodes[r.id].y + 0.5] : r.kind === 'building' && g.bById.get(r.id) ? [g.bById.get(r.id).cx, g.bById.get(r.id).cy] : [r.x + 0.5, r.y + 0.5];
        const [px, py] = R.iso(t[0], t[1]);
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(Math.round(px), Math.round(py) - 12, 1, 12);
        ctx.fillStyle = 'rgb(' + D.PLAYER_COLOR.join(',') + ')'; ctx.fillRect(Math.round(px) + 1, Math.round(py) - 12, 5, 4);
      }
    }

    // flechas en vuelo (con un pequeño arco)
    for (const a of PK.Life.arrows) {
      const t = Math.min(1, a.t / a.dur), [x0, y0] = R.iso(a.x0, a.y0), [x1, y1] = R.iso(a.w.x, a.w.y);
      const x = x0 + (x1 - x0) * t, y = y0 - a.z0 + (y1 - 6 - (y0 - a.z0)) * t - Math.sin(t * Math.PI) * 14;
      const t2 = Math.max(0, t - 0.08), xb = x0 + (x1 - x0) * t2, yb = y0 - a.z0 + (y1 - 6 - (y0 - a.z0)) * t2 - Math.sin(t2 * Math.PI) * 14;
      pxLine(ctx, xb, yb, x, y, '#3a2a1a'); ctx.fillStyle = '#e8e4dc'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // partículas
    for (let i = R.particles.length - 1; i >= 0; i--) {
      const p = R.particles[i];
      p.life += dt;
      if (p.life < 0) continue;
      if (p.life >= p.max || R.particles.length > (MOBILE ? 400 : 900)) { R.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) p.vy += p.grav * dt;
      const t = p.life / p.max;
      if (p.rgb) { ctx.fillStyle = 'rgb(' + p.rgb.join(',') + ')'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      else {
        const sz = Math.round((1 + t * 3) * (p.big || 1));
        ctx.fillStyle = p.puff ? 'rgba(' + p.puff.join(',') + ',' + (0.6 * (1 - t)).toFixed(2) + ')' : 'rgba(' + p.c + ',' + p.c + ',' + (p.c + 8) + ',' + (0.55 * (1 - t)).toFixed(2) + ')';
        ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
      }
    }

    // nombres de las zonas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (R.showZones) {
      ctx.font = (R.cam.z >= 2 ? 14 : 12) * R.dpr + 'px "PK Num", "Pixelify Sans", monospace';
      ctx.textAlign = 'center';
      for (const z of W.zones) {
        if (!seen(z.cx, z.cy)) continue;
        const k = z.common ? 0 : z.r * 0.62;
        const [wx, wy] = R.iso(z.cx + 0.5 - k, z.cy + 0.5 - k);
        const sx = wx * s + ox, sy = wy * s + oy;
        if (sx < -100 || sy < -40 || sx > cv.width + 100 || sy > cv.height + 40) continue;
        const label = z.name;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(label, sx + R.dpr, sy + R.dpr);
        ctx.fillStyle = z.common ? '#ffe7a0' : z.owner === 'p' ? '#b8d4ff' : 'rgb(' + Sp.ownerColor(z.owner).map(c => Math.min(255, c + 70)).join(',') + ')';
        ctx.fillText(label, sx, sy);
        if (z.common) {
          const st = W.zoneStats(W.zones.indexOf(z));
          ctx.font = 11 * R.dpr + 'px "PK Num", "Pixelify Sans", monospace';
          ctx.fillStyle = 'rgba(255,240,200,0.8)';
          ctx.fillText('zona común · ' + Math.round((st.amt / Math.max(1, st.max)) * 100) + '%', sx, sy + 14 * R.dpr);
          ctx.font = (R.cam.z >= 2 ? 14 : 12) * R.dpr + 'px "PK Num", "Pixelify Sans", monospace';
        }
      }
    }
    // globos de la plaza del mundo sobre el Centro Urbano de quien habló
    if (PK.Social && PK.Social.worldChat) {
      const now = Date.now();
      ctx.font = 11 * R.dpr + 'px "PK Num", "Pixelify Sans", monospace';
      ctx.textAlign = 'center';
      for (const m of PK.Social.worldChat()) {
        if (now - m.at > 8000 || m.slot === undefined || m.slot === null) continue;
        const home = m.slot === D.MY_SLOT ? D.PLAYER_HOME : D.REALM_SLOTS[m.slot] && D.REALM_SLOTS[m.slot].home;
        if (!home || !seen(home[0], home[1])) continue;
        const [wx, wy] = R.iso(home[0] + 1.5, home[1] + 1.5), sx = Math.round(wx * s + ox), sy = Math.round((wy - 58) * s + oy);
        const text = m.text.length > 34 ? m.text.slice(0, 33) + '…' : m.text, tw = Math.ceil(ctx.measureText(text).width) + 10 * R.dpr, th = 16 * R.dpr;
        if (sx < -tw || sy < -th || sx > cv.width + tw || sy > cv.height + th) continue;
        ctx.globalAlpha = Math.min(1, (8000 - (now - m.at)) / 800);
        ctx.fillStyle = '#2a1a0e'; ctx.fillRect(sx - tw / 2 - R.dpr, sy - th - R.dpr, tw + 2 * R.dpr, th + 2 * R.dpr);
        ctx.fillStyle = '#f4e8c8'; ctx.fillRect(sx - tw / 2, sy - th, tw, th);
        ctx.fillRect(sx - 2 * R.dpr, sy, 4 * R.dpr, 3 * R.dpr);
        ctx.fillStyle = '#2a1a0e'; ctx.fillText(text, sx, sy - 4 * R.dpr);
        ctx.globalAlpha = 1;
      }
    }
    // números que suben al descargar recursos
    ctx.font = 11 * R.dpr + 'px "PK Num", "Pixelify Sans", monospace';
    ctx.textAlign = 'left';
    for (let i = R.floats.length - 1; i >= 0; i--) {
      const f = R.floats[i];
      f.t += dt;
      if (f.t > 1.4) { R.floats.splice(i, 1); continue; }
      const [wx, wy] = R.iso(f.x, f.y), sx = wx * s + ox, sy = (wy - 26 - f.t * 18) * s + oy;
      ctx.globalAlpha = Math.min(1, 2.2 - f.t * 1.6);
      if (f.img && f.img.complete) ctx.drawImage(f.img, Math.round(sx - 14 * R.dpr), Math.round(sy - 10 * R.dpr), 12 * R.dpr, 12 * R.dpr);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(f.text, sx + R.dpr, sy + R.dpr);
      ctx.fillStyle = '#fff2c0'; ctx.fillText(f.text, sx, sy);
      ctx.globalAlpha = 1;
    }
    if (PK.Troops) PK.Troops.drawTexts(ctx, s, ox, oy, R.dpr, dt);
    // nivel de tus edificios
    if (R.showZones && R.cam.z >= 2) {
      ctx.font = 10 * R.dpr + 'px "PK Num", "Pixelify Sans", monospace';
      ctx.textAlign = 'center';
      for (const [wx, wy, lvl, up] of labels) {
        const sx = wx * s + ox, sy = wy * s + oy;
        if (sx < -20 || sy < -20 || sx > cv.width + 20 || sy > cv.height + 20) continue;
        const t = String(lvl), w = (t.length * 6 + 8) * R.dpr, h = 12 * R.dpr;
        ctx.fillStyle = up ? 'rgba(120,70,10,0.88)' : 'rgba(20,14,8,0.78)';
        ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - h), Math.round(w), Math.round(h));
        ctx.fillStyle = up ? '#ffd27a' : '#f2dca0';
        ctx.fillText(t, sx, sy - 3 * R.dpr);
      }
    }
    // caja de selección
    const box = PK.Input && PK.Input.box;
    if (box) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = R.dpr;
      ctx.setLineDash([4 * R.dpr, 3 * R.dpr]);
      ctx.strokeRect(Math.min(box.x0, box.x1) * R.dpr, Math.min(box.y0, box.y1) * R.dpr, Math.abs(box.x1 - box.x0) * R.dpr, Math.abs(box.y1 - box.y0) * R.dpr);
      ctx.setLineDash([]);
    }
    void sparkT;
  };

  // ---------- Caminos ----------
  function drawRoads(ctx, chunks) {
    for (const c of chunks) {
      if (!c.onScreen) continue;
      const x0 = c.cx * W.CH, y0 = c.cy * W.CH;
      for (let y = y0; y < y0 + W.CH; y++) for (let x = x0; x < x0 + W.CH; x++) {
        const k = W.idx(x, y);
        if (!W.road[k] || !W.fog[k]) continue;
        const r = (dx, dy) => W.inb(x + dx, y + dy) && (W.road[W.idx(x + dx, y + dy)] || W.bAt[W.idx(x + dx, y + dy)] >= 0);
        const mask = (r(0, -1) ? 1 : 0) | (r(1, 0) ? 2 : 0) | (r(0, 1) ? 4 : 0) | (r(-1, 0) ? 8 : 0);
        const spr = Sp.road(mask), [px, py] = R.iso(x, y);
        ctx.drawImage(spr.c, px - spr.ox, py);
      }
    }
  }
  // ---------- Cintas ----------
  const dirOf = (a, b) => (b[0] > a[0] ? 'E' : b[0] < a[0] ? 'W' : b[1] > a[1] ? 'S' : 'N');
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  function sideToward(t, b) { // de la casilla t hacia el edificio b
    if (t[0] < b.x) return 'E'; if (t[0] >= b.x + b.w) return 'W'; if (t[1] < b.y) return 'S'; return 'N';
  }
  function drawBelts(ctx, vis) {
    const st = G().state;
    if (!st || !st.logi || !st.logi.belts.length) return;
    const phase = Math.floor(performance.now() / 110) % 4;
    for (const bl of st.logi.belts) {
      const a = G().bById.get(bl.a), b = G().bById.get(bl.b), p = bl.path;
      if (!a || !b) continue;
      for (let i = 0; i < p.length; i++) {
        const [px, py] = R.iso(p[i][0], p[i][1]);
        if (!vis(px - 16, py, 32, 16)) continue;
        const inD = i === 0 ? OPP[sideToward(p[0], a)] : OPP[dirOf(p[i - 1], p[i])];
        const outD = i === p.length - 1 ? sideToward(p[i], b) : dirOf(p[i], p[i + 1]);
        const spr = Sp.belt(inD, outD, phase);
        ctx.drawImage(spr.c, px - 16, py);
      }
      // carga que viaja por la cinta
      for (const it of bl.items) {
        const i = Math.min(p.length - 1, Math.floor(it.p)), f = it.p - i, q = p[Math.min(p.length - 1, i + 1)];
        const tx = p[i][0] + 0.5 + (q[0] - p[i][0]) * f, ty = p[i][1] + 0.5 + (q[1] - p[i][1]) * f;
        const [px, py] = R.iso(tx, ty);
        const col = Sp.CARRY[it.r] || [200, 200, 200];
        ctx.fillStyle = 'rgba(20,14,10,0.85)'; ctx.fillRect(Math.round(px) - 2, Math.round(py) - 4, 5, 4);
        ctx.fillStyle = Sp.rgb(col); ctx.fillRect(Math.round(px) - 1, Math.round(py) - 3, 3, 2);
      }
    }
  }

  // ---------- Territorio ----------
  // Borde de color en el límite de cada reino. En modo territorio se rellena cada parcela y se marcan las
  // que puedes reclamar (blanco) o atacar (rojo).
  function drawTerritory(ctx, vx0, vy0, vw, vh) {
    if (!W.terr) return;
    const P = W.PW, PS = D.PARCEL, T = PK.Terr, mode = T && T.mode;
    const corners = [R.tileAt(vx0, vy0), R.tileAt(vx0 + vw, vy0), R.tileAt(vx0, vy0 + vh), R.tileAt(vx0 + vw, vy0 + vh)];
    const px0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0])) / PS) - 1), px1 = Math.min(P - 1, Math.floor(Math.max(...corners.map(c => c[0])) / PS) + 1);
    const py0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1])) / PS) - 1), py1 = Math.min(P - 1, Math.floor(Math.max(...corners.map(c => c[1])) / PS) + 1);
    const colOf = o => (o === 'p' ? [110, 175, 255] : Sp.ownerColor(o).map(c => Math.min(255, c + 40)));
    const poly = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
    const quad = (x0, y0, x1, y1) => [R.iso(x0, y0), R.iso(x1, y0), R.iso(x1, y1), R.iso(x0, y1)];
    ctx.lineWidth = mode ? 1.6 : 1.2;
    for (let py = py0; py <= py1; py++) for (let px = px0; px <= px1; px++) {
      const k = py * P + px, x0 = px * PS, y0 = py * PS;
      const o = W.ownerOfParcel(k);
      if (!(mode && o === 'p') && !seen(x0 + PS / 2, y0 + PS / 2) && !seen(x0, y0) && !seen(x0 + PS - 1, y0 + PS - 1)) continue;
      if (mode) {
        // cuadrícula de parcelas + relleno del color del dueño
        if (o) { ctx.fillStyle = 'rgba(' + colOf(o).join(',') + ',0.3)'; poly(quad(x0, y0, x0 + PS, y0 + PS)); ctx.fill(); }
        else if (W.terrCommon[k]) { ctx.fillStyle = 'rgba(255,220,120,0.14)'; poly(quad(x0, y0, x0 + PS, y0 + PS)); ctx.fill(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'; poly(quad(x0, y0, x0 + PS, y0 + PS)); ctx.stroke();
        const claim = T.canClaim(k) === null, atk = o && o !== 'p' && T.touchesMine(k) && !W.isCore(k, W.terr[k] - 1);
        if (claim || atk) {
          ctx.setLineDash([3, 3]); ctx.strokeStyle = claim ? 'rgba(255,255,255,0.75)' : 'rgba(255,90,70,0.85)';
          poly(quad(x0 + 0.4, y0 + 0.4, x0 + PS - 0.4, y0 + PS - 0.4)); ctx.stroke(); ctx.setLineDash([]);
        }
        if (o && W.isCore(k, W.terr[k] - 1)) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; poly(quad(x0 + 2, y0 + 2, x0 + PS - 2, y0 + PS - 2)); ctx.fill(); }
      }
      if (!o) continue;
      // borde hacia afuera, un poco hacia adentro para que dos reinos vecinos se vean los dos
      const c = colOf(o), inset = 0.18;
      ctx.strokeStyle = 'rgba(' + c.join(',') + ',' + (mode ? 0.95 : 0.7) + ')';
      ctx.beginPath();
      const diff = n => n < 0 || W.terr[n] !== W.terr[k];
      if (py === 0 || diff(k - P)) { const a = R.iso(x0, y0 + inset), b = R.iso(x0 + PS, y0 + inset); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      if (px === P - 1 || diff(k + 1)) { const a = R.iso(x0 + PS - inset, y0), b = R.iso(x0 + PS - inset, y0 + PS); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      if (py === P - 1 || diff(k + P)) { const a = R.iso(x0, y0 + PS - inset), b = R.iso(x0 + PS, y0 + PS - inset); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      if (px === 0 || diff(k - 1)) { const a = R.iso(x0 + inset, y0), b = R.iso(x0 + inset, y0 + PS); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
    }
    if (mode && T.sel !== null && T.sel !== undefined) {
      const x0 = (T.sel % P) * PS, y0 = Math.floor(T.sel / P) * PS;
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,170,0.95)';
      poly(quad(x0 + 0.2, y0 + 0.2, x0 + PS - 0.2, y0 + PS - 0.2)); ctx.stroke();
    }
    // campañas en curso: banderas rojas sobre la parcela
    const st = G().state;
    if (st && st.terr) for (const c of st.terr.camps) {
      const [cx, cy] = PK.Terr.center(c.k), [px, py] = R.iso(cx, cy);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(Math.round(px), Math.round(py) - 18, 1, 18);
      ctx.fillStyle = c.phase === 'go' ? '#d83a2a' : '#888'; ctx.fillRect(Math.round(px) + 1, Math.round(py) - 18, 7, 5);
    }
  }

  function drawBuilding(ctx, it) {
    const b = it.o, spr = it.spr;
    if (b.done) {
      ctx.drawImage(spr.c, it.x, it.y);
      if (b.upg) scaffold(ctx, b, it);
      if (b.type === 'mill' && spr.hub) {
        const hx = it.x + spr.hub[0], hy = it.y + spr.hub[1], a = performance.now() / 1400 + b.id;
        for (let k = 0; k < 4; k++) {
          const ang = a + (k * Math.PI) / 2, ex = Math.cos(ang), ey = Math.sin(ang);
          for (let o = 1; o <= 3; o++) pxLine(ctx, hx + ex * 5 - ey * o, hy + ey * 5 + ex * o, hx + ex * 17 - ey * o, hy + ey * 17 + ex * o, o === 3 ? '#8a7a60' : '#f2ead6');
          pxLine(ctx, hx, hy, hx + ex * 18, hy + ey * 18, '#3a2414');
        }
        ctx.fillStyle = '#2a1a0e'; ctx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 2, 2);
      }
    } else {
      // en obra: cimientos, estructura y terminaciones según el avance; polvo al cambiar de etapa
      const st = b.progress < 1 / 3 ? 0 : b.progress < 2 / 3 ? 1 : 2, prev = siteStage.get(b);
      siteStage.set(b, st);
      if (prev !== undefined && prev !== st) siteDust(b);
      ctx.drawImage(Sp.site(b.type, b.owner, b.lvl, st).c, it.x, it.y);
    }
  }
  const siteStage = new WeakMap();
  function siteDust(b) {
    if (G().offline) return;
    for (let i = 0; i < 22; i++) {
      const u = Math.random(), [px, py] = i % 2 ? R.iso(b.x + u * b.w, b.y + b.h) : R.iso(b.x + b.w, b.y + u * b.h);
      if (i % 3) R.particles.push({ x: px, y: py - 2, vx: (Math.random() - 0.5) * 22, vy: -5 - Math.random() * 9, life: 0, max: 0.8 + Math.random() * 0.6, s: 1, puff: [198, 178, 146] });
      else R.particles.push({ x: px, y: py - 3, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 15, life: 0, max: 0.6, s: 1, grav: 70, rgb: [150, 128, 96] });
    }
  }

  // Andamios y polvo mientras un Maestro de Obras mejora el edificio.
  // El andamio es un sprite cacheado por tipo; encima se anima la polea: el balde sube y baja despacio y la rueda gira.
  const WHEEL = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  function scaffold(ctx, b, it) {
    const sc = Sp.scaffold(b.type), sy0 = it.y + it.spr.oy - sc.oy; // el edificio puede tener más alto de lienzo que el andamio
    ctx.drawImage(sc.c, it.x, sy0);
    if (sc.hub) {
      const hx = it.x + sc.hub[0], hy = sy0 + sc.hub[1], gy = sy0 + sc.hub[2], t = performance.now() / 1000 + b.id * 1.7;
      const f = 0.5 - 0.5 * Math.cos(t * 0.8), by = Math.round(hy + 3 + f * Math.max(0, gy - hy - 10));
      ctx.fillStyle = '#d8c49a'; ctx.fillRect(hx + 1, hy, 1, by - hy);
      ctx.drawImage(Sp.bucket(), hx - 1, by);
      ctx.fillStyle = '#3a2414';
      for (const [dx, dy] of WHEEL) ctx.fillRect(hx + dx, hy + dy, 1, 1);
      ctx.fillStyle = '#9a7048'; ctx.fillRect(hx, hy, 1, 1);
      const [sx, sy] = WHEEL[Math.floor(f * 20) % 8]; ctx.fillStyle = '#d8b080'; ctx.fillRect(hx + sx, hy + sy, 1, 1);
    }
    if (Math.random() < 0.05) {
      const [px, py] = R.iso(b.x + b.w, b.y + b.h * Math.random());
      R.particles.push({ x: px + 2, y: py - Math.random() * it.spr.oy * 0.5, vx: (Math.random() - 0.5) * 10, vy: -8, life: 0, max: 0.9, s: 1, puff: [200, 186, 160] });
    }
  }

  // Efectos: número flotante, estallido de chispas (subidas de nivel) y estrella fugaz.
  R.floats = [];
  const icoImg = {};
  R.float = function (x, y, text, res) {
    if (G().offline || R.floats.length > 40) return;
    if (res && !icoImg[res]) { icoImg[res] = new Image(); icoImg[res].src = Sp.icon(res); }
    R.floats.push({ x, y, text, t: 0, img: res ? icoImg[res] : null });
  };
  R.burst = function (x, y, rgb, n) {
    if (G().offline) return;
    const [px, py] = R.iso(x, y), cols = [[255, 220, 110], [255, 250, 220], [255, 160, 60], [140, 220, 255]];
    for (let i = 0; i < (n || 30); i++) {
      const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 50;
      R.particles.push({ x: px, y: py - 24, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0, max: 0.8 + Math.random() * 0.7, s: 1, grav: 70, rgb: rgb || cols[i % cols.length] });
    }
  };
  R.meteor = function (x, y) {
    const [px, py] = R.iso(x + 0.5, y + 0.5);
    for (let i = 0; i < 24; i++) R.particles.push({ x: px - 160 + i * 6, y: py - 220 + i * 9, vx: 60, vy: 90, life: -i * 0.02, max: 0.5, s: 1, rgb: [255, 240, 200] });
    setTimeout(() => R.burst(x + 0.5, y + 0.5, null, 50), 600);
  };

  function pxLine(ctx, x0, y0, x1, y1, c) {
    ctx.fillStyle = c;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
  }
  function diamondPath(ctx, x, y, w, h) {
    const a = R.iso(x, y), b = R.iso(x + w, y), c = R.iso(x + w, y + h), d = R.iso(x, y + h);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
  }
  function diamond(ctx, x, y, w, h, col) {
    const pts = [R.iso(x, y), R.iso(x + w, y), R.iso(x + w, y + h), R.iso(x, y + h)];
    for (let i = 0; i < 4; i++) pxLine(ctx, pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1], col);
  }
  function diamondFill(ctx, x, y, _a, _b, col, w, h) {
    if (typeof _a === 'string') { col = _a; w = 1; h = 1; }
    diamondPath(ctx, x, y, w || 1, h || 1);
    ctx.fillStyle = col;
    ctx.fill();
  }
  function ellipse(ctx, px, py, col, r) {
    ctx.strokeStyle = col; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(px, py, r || 5, (r || 5) / 2, 0, 0, Math.PI * 2); ctx.stroke();
  }
  function bar(ctx, x, y, w, t, col) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * U.clamp(t, 0, 1)), 2);
  }

  // Selección por píxel: recorre lo dibujado de adelante hacia atrás.
  R.pick = function (sx, sy) {
    const [wx, wy] = R.screenToWorld(sx, sy);
    if (PK.Terr && PK.Terr.mode) {
      const [tx, ty] = R.tileAt(wx, wy);
      return W.inb(Math.floor(tx), Math.floor(ty)) ? { k: 'parcel', x: tx, y: ty } : null;
    }
    for (let i = R.drawn.length - 1; i >= 0; i--) {
      const it = R.drawn[i];
      const lx = wx - it.x, ly = wy - it.y;
      const w = it.spr.k ? it.spr.w : it.spr.c.width, h = it.spr.k ? it.spr.h : it.spr.c.height;
      if (lx < 0 || ly < 0 || lx >= w || ly >= h) continue;
      if (it.k === 'wolf' || (it.k === 'troop' && it.o.enemy)) continue;
      if (it.k === 'troop') { if (lx >= 3 && lx <= w - 3 && ly <= h - 1) return it; continue; }
      if (it.k === 'unit') { if (lx >= 3 && lx <= w - 3 && ly <= h - 1) return it; continue; }
      if (it.k === 'node' && it.o.dead && it.o.kind === 'tree') continue;
      if (Sp.hit(it.spr, lx, ly)) return it;
    }
    const [tx, ty] = R.tileAt(wx, wy);
    const x = Math.floor(tx), y = Math.floor(ty);
    if (!W.inb(x, y)) return null;
    if (!W.fog[W.idx(x, y)]) return { k: 'tile', x, y, fog: true };
    const bid = W.bAt[W.idx(x, y)];
    if (bid >= 0) return { k: 'building', o: G().bById.get(bid) };
    const pid = W.poiAt[W.idx(x, y)];
    if (pid >= 0) return { k: 'poi', o: W.pois[pid] };
    if (W.belt[W.idx(x, y)] >= 0) return { k: 'belt', x, y };
    return { k: 'tile', x, y };
  };

  // ---------- Minimapa ----------
  // Muestra el territorio de cada reino con su color. Se recalcula cada pocos segundos.
  let mmBase = null, mmT = 99, mmFog = -1, mmTerr = -1;
  R.drawMinimap = function (mc, dt) {
    const ctx = mc.getContext('2d'), w = W.W + W.H, h = (W.W + W.H) / 2;
    mmT += dt;
    if (!mmBase || mmT > 4 || ((mmFog !== W.fogVer || mmTerr !== W.terrVer) && mmT > 0.7)) {
      mmFog = W.fogVer; mmTerr = W.terrVer;
      mmT = 0;
      mmBase = mmBase || Sp.mk(w, h);
      const bctx = mmBase.getContext('2d'), im = bctx.createImageData(w, h), d = im.data;
      for (let my = 0; my < h; my++) for (let mx = 0; mx < w; mx++) {
        const a = mx - W.H, b = my * 2, tx = Math.floor((a + b) / 2), ty = Math.floor((b - a) / 2);
        if (!W.inb(tx, ty)) continue;
        const k = W.idx(tx, ty), nid = W.nodeAt[k];
        let col = Sp.TERRAIN_MM[W.terrain[k]];
        if (nid >= 0 && !W.nodes[nid].dead) col = Sp.NODE_MM[W.nodes[nid].kind];
        if (W.poiAt[k] >= 0) col = [210, 180, 120];
        const o = W.terr[W.parcel(tx, ty)];
        if (o) { const c2 = o - 1 === D.MY_SLOT ? [110, 175, 255] : D.REALM_SLOTS[o - 1].color; col = [col[0] * 0.6 + c2[0] * 0.4, col[1] * 0.6 + c2[1] * 0.4, col[2] * 0.6 + c2[2] * 0.4]; }
        if (!W.fog[k]) col = [22, 19, 14];
        const i = (my * w + mx) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
      bctx.putImageData(im, 0, 0);
    }
    const sx = mc.width / w, sy = mc.height / h;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, mc.width, mc.height);
    ctx.drawImage(mmBase, 0, 0, mc.width, mc.height);
    const toMM = (x, y) => [(x - y + W.H) * sx, ((x + y) / 2) * sy];
    for (const b of G().buildings) {
      if (b.owner !== 'p' && !seen(b.cx, b.cy)) continue;
      const [x, y] = toMM(b.cx, b.cy);
      ctx.fillStyle = 'rgb(' + Sp.ownerColor(b.owner).join(',') + ')';
      const s = b.w >= 3 ? 3 : 2;
      ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    }
    for (const u of G().units) {
      if (u.inside || (u.owner !== 'p' && !seen(u.x, u.y))) continue;
      const [x, y] = toMM(u.x, u.y);
      ctx.fillStyle = u.owner === 'p' ? '#cfe0ff' : 'rgb(' + Sp.ownerColor(u.owner).map(c => Math.min(255, c + 60)).join(',') + ')';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // vista de la cámara
    const s = R.scale(), vw = R.cv.width / s, vh = R.cv.height / s;
    const ax = (R.cam.x - vw / 2) / 16 * sx, ay = (R.cam.y - vh / 2) / 16 * sy;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(ax) + 0.5, Math.round(ay) + 0.5, Math.round((vw / 16) * sx), Math.round((vh / 16) * sy));
  };
  R.minimapToTile = function (mc, mx, my) {
    const w = W.W + W.H, h = (W.W + W.H) / 2;
    const a = (mx / mc.clientWidth) * w - W.H, b = (my / mc.clientHeight) * h * 2;
    return [(a + b) / 2, (b - a) / 2];
  };
})();
