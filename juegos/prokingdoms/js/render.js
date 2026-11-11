// Render isométrico en canvas. El mapa es grande, así que todo se hace por trozos de 16x16: solo se pinta y
// se recorre lo que está a la vista, el terreno de cada trozo se genera cuando hace falta (y se olvida si
// hay demasiados en memoria) y la niebla se repinta solo donde cambió. Pensado para que ande en celular.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const R = (PK.Render = { cam: { x: 0, y: 0, z: 2 }, drawn: [], particles: [], showZones: true, hover: null });
  const G = () => PK.Game;
  const I0 = () => (PK.Input && PK.Input.mouse && PK.Input.mouse.in ? PK.Input.mouse : null); // el puntero sobre el mapa
  const MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const MAX_CHUNKS = MOBILE ? 36 : 90;

  R.iso = (tx, ty) => [(tx - ty) * 16 + W.H * 16, (tx + ty) * 8];
  R.tileAt = (wx, wy) => { const a = (wx - W.H * 16) / 16, b = wy / 8; return [(a + b) / 2, (b - a) / 2]; };

  R.init = function (canvas) {
    R.cv = canvas;
    R.ctx = canvas.getContext('2d');
    // en el celular arranca más lejos: con zoom 2 en 390 px se veían 12 casillas de ancho (playtest)
    if (Math.min(window.innerWidth, window.innerHeight) < 560) R.cam.z = 1;
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
  // pk-37: los sonidos del mapa (golpes de los aldeanos, entregas…) suenan según qué tan cerca los miras:
  // - el zoom: con zoom 3-4 a todo volumen, con 2 algo menos, con 1 bajito y alejado del todo (0,5) casi nada;
  // - el centro de la pantalla: lo que miras suena, lo de la orilla apenas; fuera de la pantalla, nada;
  // - el lado: paneo izquierda/derecha según dónde está.
  // Antes cada golpe en pantalla sonaba igual de fuerte y en el medio: alejado se oía el pueblo entero picando
  // sin saber de dónde. wx, wy: coordenadas del mundo en píxeles (R.iso).
  R.volumenEn = function (wx, wy) {
    if (!R.cv) return null;
    const [sx, sy] = R.worldToScreen(wx, wy), w = R.cv.width / R.dpr, h = R.cv.height / R.dpr;
    if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) return null;
    const dn = Math.hypot((sx - w / 2) / (w / 2), (sy - h / 2) / (h / 2)) / Math.SQRT2; // 0 en el centro, 1 en la esquina
    const cerca = Math.pow(U.clamp((R.cam.z - 0.25) / 2.25, 0, 1), 1.1), centro = Math.pow(U.clamp(1 - dn * 0.95, 0, 1), 1.3);
    return { vol: cerca * centro, pan: (sx / w - 0.5) * 1.7 };
  };
  R.sonarEn = function (name, wx, wy) {
    if (!PK.Sfx || !PK.Sfx.playEn) return;
    const v = R.volumenEn(wx, wy);
    if (v && v.vol >= 0.03) PK.Sfx.playEn(name, v.vol, v.pan);
  };
  R.sonarEnCasilla = function (name, tx, ty) { const [x, y] = R.iso(tx, ty); R.sonarEn(name, x, y); };
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
      // Solo se olvida un trozo que no se usó en este cuadro: a zoom 0,5 se ven más trozos que el tope, y sacar uno
      // visible obligaba a repintarlo al cuadro siguiente sin fin (parpadeo). Ese cuadro se pasa del tope y listo.
      if (ground.size > MAX_CHUNKS) {
        let worst = null, wu = Infinity;
        for (const [k, o] of ground) if (o.used < wu && o.used < frameNo && k !== ci) { wu = o.used; worst = k; }
        if (worst !== null) ground.delete(worst);
      }
    }
    g.used = frameNo;
    return g;
  }
  // Estaciones (Fase 3, V3): el suelo se repinta con el tinte de la estación (sprites.js) una vez por cambio.
  R.nuevaEstacion = function () {
    const e = PK.Vida ? PK.Vida.estacion() : 1;
    if (Sp.temporada === e) return;
    Sp.temporada = e;
    ground.clear();
  };
  // Clima de la estación y noche. Las partículas viven en coordenadas de pantalla (no del mundo): 50 copos u hojas
  // que caen y dan la vuelta. Nada de esto cambia números del juego.
  const clima = [];
  let glowC = null;
  function brillo() {
    if (glowC) return glowC;
    glowC = document.createElement('canvas'); glowC.width = glowC.height = 32;
    const c = glowC.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,200,110,0.55)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    return glowC;
  }
  const LUZ = { house: 1, tc: 3, tavern: 2, market: 1, library: 2, monastery: 2, consejo: 2, barracks: 1, guild: 2, university: 2, scriptorium: 1 };
  function dibujarClima(ctx, dt, vis, g) {
    const V = PK.Vida, cv = R.cv, dpr = R.dpr;
    if (!V || !g.state) return;
    if (Sp.temporada !== V.estacion()) R.nuevaEstacion();
    const noche = V.noche();
    if (noche > 0) {
      // la oscuridad tapa el mundo y las ventanas de tus edificios se encienden (en coordenadas del mundo)
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(12,18,48,' + (0.42 * noche).toFixed(3) + ')';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = noche;
      const gl = brillo(), t = performance.now() / 1000;
      ctx.fillStyle = 'rgba(255,214,120,0.9)';
      for (const b of g.buildings) {
        if (b.owner !== 'p' || !b.done || !LUZ[b.type]) continue;
        const [x, y] = R.iso(b.x + b.w / 2, b.y + b.h / 2);
        if (!vis(x - 30, y - 50, 60, 60)) continue;
        // Las luces van en las dos paredes del frente (la de la izquierda y la de la derecha de la esquina de abajo),
        // un poco sobre el suelo: antes salían en medio del techo.
        const n = LUZ[b.type], [fx, fy] = R.iso(b.x + b.w, b.y + b.h), [lx, ly] = R.iso(b.x, b.y + b.h), [rx, ry] = R.iso(b.x + b.w, b.y);
        for (let i = 0; i < n; i++) {
          const izq = i % 2 === 0, k = (Math.floor(i / 2) + 1) / (Math.ceil(n / 2) + 1), ax = izq ? lx : rx, ay = izq ? ly : ry;
          const wx = fx + (ax - fx) * (0.35 + 0.3 * k), wy = fy + (ay - fy) * (0.35 + 0.3 * k) - 7 - b.h, fl = 0.8 + 0.2 * Math.sin(t * 3 + U.hash(b.x, b.y, 4) * 20 + i);
          ctx.globalAlpha = noche * fl;
          ctx.drawImage(gl, wx - 9, wy - 9, 18, 18);
          ctx.fillRect(Math.round(wx - 1), Math.round(wy - 1), 2, 2);
        }
      }
      ctx.restore();
    }
    // copos (invierno), hojas (otoño) y pétalos (primavera)
    const e = Sp.temporada, n = e === 1 ? 0 : MOBILE ? 26 : 50;
    if (!n || PK.menosMov || (g.state.flags && g.state.flags.sinClima)) { clima.length = 0; return; }
    const W0 = cv.width / dpr, H0 = cv.height / dpr;
    while (clima.length < n) clima.push({ x: Math.random() * W0, y: Math.random() * H0, v: 0.5 + Math.random(), f: Math.random() * 6 });
    clima.length = n;
    const col = e === 3 ? 'rgba(245,248,255,0.85)' : e === 2 ? 'rgba(206,110,40,0.9)' : 'rgba(244,170,200,0.9)';
    const sp = e === 3 ? 22 : 30;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col;
    for (const p of clima) {
      p.f += dt * 2;
      p.y += dt * sp * p.v; p.x += dt * (e === 3 ? 6 : 14) * Math.sin(p.f);
      if (p.y > H0 + 4) { p.y = -4; p.x = Math.random() * W0; }
      if (p.x < -4) p.x = W0 + 3; else if (p.x > W0 + 4) p.x = -3;
      const z = e === 3 ? (p.v > 1.1 ? 2 : 1) : 2;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), z, e === 3 ? z : 1);
    }
    ctx.restore();
  }
  // El bote de cada muelle de pesca (V9): en el agua más cercana, meciéndose, y con el pescador si hay uno.
  function botes(ctx, vis, g) {
    const t = performance.now() / 1000;
    for (const b of g.buildings) {
      if (b.type !== 'muelle' || !b.done) continue;
      if (b._bote === undefined) {
        b._bote = null;
        let bd = 1e9;
        for (let y = b.y - 3; y < b.y + b.h + 3; y++) for (let x = b.x - 3; x < b.x + b.w + 3; x++) {
          if (!W.inb(x, y) || W.terrain[W.idx(x, y)] !== 4) continue;
          const d = U.dist(x + 0.5, y + 0.5, b.cx, b.cy);
          if (d < bd) { bd = d; b._bote = [x + 0.5, y + 0.5]; }
        }
      }
      if (!b._bote) continue;
      const [px, py] = R.iso(b._bote[0], b._bote[1]), x = Math.round(px), y = Math.round(py + Math.sin(t * 1.6 + b.id) * 1.2);
      if (!vis(x - 10, y - 14, 20, 20)) continue;
      ctx.fillStyle = 'rgba(20,40,70,0.35)'; ctx.fillRect(x - 7, y + 2, 14, 2);
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 6, y - 1, 12, 3); ctx.fillRect(x - 7, y - 2, 2, 2); ctx.fillRect(x + 5, y - 2, 2, 2);
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(x - 5, y - 2, 10, 1);
      if (b.farmer !== null && g.uById.get(b.farmer)) {
        ctx.fillStyle = '#3a5a9a'; ctx.fillRect(x - 1, y - 6, 3, 4);
        ctx.fillStyle = '#e8c8a0'; ctx.fillRect(x - 1, y - 8, 3, 2);
        ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2, y - 6); ctx.lineTo(x + 8, y - 11); ctx.stroke();
        ctx.fillStyle = 'rgba(230,240,255,0.7)'; ctx.fillRect(x + 8, y - 11 + Math.round(Math.sin(t * 2) * 1), 1, 9);
      }
    }
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
    if (D.NODES[n.kind] && D.NODES[n.kind].mar && Sp.nodoMar) return Sp.nodoMar(n, G().mareaBaja()); // Fase 9 (pk-28)
    if (n.kind === 'deer') return n.dead ? null : n.gold ? Sp.deerGold[n.v % 2] : Sp.deer[n.v % 4];
    if (n.kind === 'tree') return n.dead ? (n.planta && Sp.brote ? Sp.brote : Sp.stump) : Sp.trees[n.sp][n.v % Sp.trees[n.sp].length];
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
        : n.kind === 'tree' ? 'axe' : n.kind === 'berry' ? 'hand' : n.kind === 'deer' ? 'knife' : (D.NODES[n.kind] && D.NODES[n.kind].tool) || 'pick';
      const ph = (u.anim * SWING[tool] + u.id * 0.37) % 1;
      frame = tool === 'hand' ? Math.floor(ph * 4) : ph < 0.4 ? 0 : ph < 0.52 ? 1 : ph < 0.8 ? 2 : 3;
      // punto de contacto en pantalla: el borde del objetivo que da al aldeano, a la altura del golpe. T4: lejos no se
      // nota (y multiplicaba las figuras), y cerca se recalcula solo si se movió 0,3 casillas o cambió de objetivo:
      // los empujones entre vecinos que trabajan juntos hacían una figura nueva por cuadro.
      const fa = u._aimF;
      if (u.aim && R.cam.z >= 1.5 && fa && fa.a === u.aim && Math.abs(fa.x - u.x) + Math.abs(fa.y - u.y) < 0.3) aim = fa.v;
      else if (u.aim && R.cam.z >= 1.5) {
        const a = u.aim, [ux, uy] = R.iso(u.x, u.y), [tx, ty] = R.iso(a.x, a.y);
        let dx = tx - ux, dy = ty - uy;
        const d = Math.hypot(dx, dy) || 1;
        dx -= (dx / d) * a.r; dy -= (dy / d) * a.r * 0.5;
        dy = Math.max(dy - a.h1, Math.min(dy - a.h0, -a.w));
        aim = [Math.round(Math.abs(dx) / 2) * 2, Math.round(dy / 2) * 2]; // de a 2 px: menos figuras distintas
        u._aimF = { a: u.aim, x: u.x, y: u.y, v: aim };
      }
    }
    u.swTool = tool; u.swF = frame;
    // T4: lejos (zoom < 1,5) todos usan una de dos caras (hombre o mujer): con el pelo y la piel de cada uno, las
    // combinaciones no cabían en el caché. Y cada cuadro se hacen pocas figuras nuevas (vPres); el que se queda sin
    // la suya muestra la de antes, nunca más de 3 cuadros seguidos (8 en el celular, donde cada figura cuesta más).
    const lejos = R.cam.z < 1.5, hair = lejos ? (u.id % 2) : u.hair, skin = lejos ? 0 : u.skin;
    const espera = vPres <= 0 && u._spr && (u._hambre || 0) < (MOBILE ? 8 : 3), n0 = Sp.vNuevas;
    const spr = Sp.villager(col, hair, skin, mode, frame, u.carry > 0 ? u.carryRes : null, u.flip, tool, u.kind === 'scout', u.back && (mode === 'walk' || mode === 'work'), aim, undefined, espera);
    if (!spr) { u._hambre = (u._hambre || 0) + 1; return u._spr; }
    if (Sp.vNuevas !== n0) vPres--;
    u._hambre = 0; u._spr = spr;
    return spr;
  }
  let vPres = 0;

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
    if (snd && u.owner === 'p') R.sonarEn(snd, x, y); // pk-37: según el zoom y qué tan al centro está
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
  // ---------- Fase 9 (pk-28): marea y bruma ----------
  // Con la bajamar, las casillas de agua pegadas a la costa se ven como bancos de arena (más la primera fila que la
  // segunda); con la pleamar, agua llena. La espuma va y viene en la primera fila, al ritmo de las olas.
  function costaMarea(ctx, chunks, tsec) {
    const m = D.marea(), seco = 1 - m;
    for (const c of chunks) {
      if (!c.onScreen || !chunkSeen(c.ci)) continue;
      const L = W.costa.get(c.ci);
      if (!L) continue;
      for (const [x, y, d] of L) {
        if (!seen(x, y)) continue;
        const a = d === 1 ? Math.max(0, seco - 0.25) * 0.95 : Math.max(0, seco - 0.55) * 0.9;
        const p = [R.iso(x, y), R.iso(x + 1, y), R.iso(x + 1, y + 1), R.iso(x, y + 1)];
        if (a > 0.02) {
          ctx.fillStyle = 'rgba(214,196,140,' + a.toFixed(2) + ')';
          ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); ctx.fill();
        }
        if (d === 1) {
          const hsh = U.hash(x, y, 5), ph = (tsec * 0.45 + hsh * 3) % 1.6;
          if (ph < 0.8) {
            ctx.fillStyle = 'rgba(245,250,255,' + (0.55 * (1 - ph / 0.8)).toFixed(2) + ')';
            const [px, py] = R.iso(x + 0.5, y + 0.5);
            ctx.fillRect(Math.round(px - 5 + hsh * 4), Math.round(py - 1 + ph * 2), 6, 1);
          }
        }
      }
    }
  }
  // Bancos de bruma: manchas grandes que derivan despacio (dan la vuelta al mapa) y se abren cerca de un faro.
  const BRUMA = [];
  for (let i = 0; i < 9; i++) BRUMA.push({ x: (i * 97) % 256, y: (i * 61 + 40) % 256, r: 9 + (i % 4) * 3, vx: 0.18 + (i % 3) * 0.07, vy: 0.05 * ((i % 2) * 2 - 1) });
  let faros = [], farosT = 0;
  function bruma(ctx, vx0, vy0, vw, vh, g) {
    if ((farosT -= 1) <= 0) { farosT = 60; faros = g.buildings.filter(b => b.owner === 'p' && b.done && (b.type === 'faromar' || b.type === 'granfaro' || b.type === 'tc')).map(b => [b.cx, b.cy, b.type === 'tc' ? 12 : g.bst(b).sight || 20]); }
    const t = Date.now() / 1000;
    for (const B of BRUMA) {
      const x = (((B.x + B.vx * t) % 256) + 256) % 256, y = (((B.y + B.vy * t) % 256) + 256) % 256;
      let a = 0.42;
      for (const [fx, fy, r] of faros) { const d = Math.hypot(fx - x, fy - y); if (d < r + B.r) a *= U.clamp((d - r * 0.6) / (B.r + r * 0.4), 0, 1); }
      if (a < 0.03) continue;
      const [px, py] = R.iso(x, y), rr = B.r * 16;
      if (px + rr < vx0 || px - rr > vx0 + vw || py + rr < vy0 || py - rr > vy0 + vh) continue;
      const gr = ctx.createRadialGradient(px, py, rr * 0.15, px, py, rr);
      gr.addColorStop(0, 'rgba(226,234,240,' + a.toFixed(2) + ')'); gr.addColorStop(1, 'rgba(226,234,240,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(px, py, rr, rr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  R.draw = function (dt) {
    const ctx = R.ctx, cv = R.cv, s = R.scale(), g = G();
    frameNo++;
    vPres = MOBILE ? 2 : 10; // figuras de aldeano nuevas por cuadro (T4)
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
    // Fase 9 (pk-28): la marea en la costa del archipiélago (bancos de arena con la bajamar y espuma)
    if (W.costa && g.enMar()) costaMarea(ctx, chunks, tsec);
    // caminos y cintas (planos, sobre el suelo)
    drawRoads(ctx, chunks);
    drawBelts(ctx, vis);
    botes(ctx, vis, g);
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
    // el Galeón del Alba (Fase 9): encallado en la orilla del lago, o fondeado frente a tu isla
    const gal = PK.Mar && PK.Mar.item(R, seen);
    if (gal && vis(gal.x, gal.y, gal.spr.c.width, gal.spr.c.height)) list.push(gal);
    if (PK.Arch && g.enMar()) for (const it of PK.Arch.items(R, seen)) if (vis(it.x, it.y, it.spr.c.width, it.spr.c.height)) list.push(it); // barcos de colonos
    if (PK.Armada && g.enMar()) for (const it of PK.Armada.items(R, seen)) if (vis(it.x, it.y, it.spr.c.width, it.spr.c.height)) list.push(it); // la flota (pk-29)
    // el lugar del capítulo en curso de la campaña (H5): el dibujo de su terreno, con estandarte
    const cn = PK.Campana && g.state && g.state.campana ? PK.Campana.actual() : 0, cl = cn && PK.Campana.lugar(cn);
    if (cl && seen(cl.x, cl.y)) {
      const c0 = D.CAPITULOS[cn - 1], kind = { crater: 'crater', nest: 'nest', temple: 'temple', giants: 'giants' }[c0.lugar.terreno] || 'camp', spr = Sp.poi(kind, false);
      const [px, py] = R.iso(cl.x - 1, cl.y - 1);
      list.push({ d: cl.x + cl.y + 1, k: 'cap', o: { n: cn }, spr, x: Math.round(px - spr.ox), y: Math.round(py - spr.oy), after: ctx2 => {
        const [bx, by] = R.iso(cl.x + 0.5, cl.y + 0.5), x = Math.round(bx), y = Math.round(by) - 34, ond = Math.round(Math.sin(performance.now() / 240));
        ctx2.fillStyle = '#2a1a0e'; ctx2.fillRect(x, y, 2, 26);
        ctx2.fillStyle = '#b02020'; ctx2.fillRect(x + 2, y, 12, 8 + ond); ctx2.fillStyle = '#ffd040'; ctx2.fillRect(x + 6, y + 2, 4, 4);
      } });
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
      const spr = Sp.building(b.type, b.owner, b.lvl, b.asp);
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
      list.push({ d: u.x + u.y, k: 'unit', o: u, spr, x: px - spr.ax, y: py - spr.ay, px, py, sel: selUnits && selUnits.has(u.id), after: u.balde ? c => c.drawImage(Sp.bucket(), Math.round(px + (u.flip ? -7 : 2)), Math.round(py - 9)) : null }); // el balde del incendio (life.js)
      if (u.mode === 'work' && u.swF === 2 && prevF !== 2 && spr.hit) impact(u, px + spr.hit[0], py + spr.hit[1]);
    }
    // soldados: guarnición del Cuartel, columnas en marcha y peleas (troops.js)
    if (PK.Troops) PK.Troops.collect(list, dt, vis);
    if (PK.Incursiones) PK.Incursiones.collect(list, dt, vis); // bandidos y tropas que salen a pelear

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

    if (g.enMar()) bruma(ctx, vx0, vy0, vw, vh, g); // los bancos de bruma del archipiélago, que los faros despejan
    // niebla de lo no explorado
    if (fogC) {
      ctx.imageSmoothingEnabled = true;
      const fx0 = Math.max(0, Math.floor(vx0 / 4) - 2), fy0 = Math.max(0, Math.floor(vy0 / 4) - 2);
      const fw = Math.min(fogC.width - fx0, Math.ceil(vw / 4) + 5), fh = Math.min(fogC.height - fy0, Math.ceil(vh / 4) + 5);
      if (fw > 0 && fh > 0) ctx.drawImage(fogC, fx0, fy0, fw, fh, fx0 * 4, fy0 * 4, fw * 4, fh * 4);
      ctx.imageSmoothingEnabled = false;
    }
    // noche y clima de la estación (Fase 3), sobre la niebla para que de noche también se vea oscuro
    if (!PK.Terr.mode) dibujarClima(ctx, dt, vis, g);
    // en el mapa de territorio las parcelas se ven encima de la niebla (tus tierras siempre)
    if (PK.Terr.mode) drawTerritory(ctx, vx0, vy0, vw, vh);

    // barras de progreso y marcas
    const puertas = g.encierro && g.encierro.puertas.length ? new Set(g.encierro.puertas) : null;
    for (const it of flats.length ? flats.concat(list) : list) { // las granjas, jardines y plazas van en `flats`
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
          if (b.status === 'Faltan insumos' || b.status === 'En reserva' || b.status === 'Depósito de salida lleno') { ctx.fillStyle = '#ff5040'; ctx.fillRect(Math.round(cx) - 1, cy - 8, 2, 5); ctx.fillRect(Math.round(cx) - 1, cy - 2, 2, 1); }
        }
        // Centro Urbano encerrado (G.checkEncierro): una flecha roja sobre los edificios que, movidos o demolidos,
        // abren el patio. Va sobre el techo porque un contorno en el suelo lo tapaba el propio edificio.
        if (puertas && puertas.has(b.id)) {
          const ax = Math.round(it.x + it.spr.c.width / 2), ay = Math.round(it.y + techo(it.spr) - 3 + 2 * Math.sin(performance.now() / 180));
          ctx.fillStyle = '#2a0a06'; ctx.fillRect(ax - 6, ay - 7, 13, 4); for (let k = 0; k < 5; k++) ctx.fillRect(ax - 5 + k, ay - 3 + k, 11 - 2 * k, 1);
          ctx.fillStyle = '#ff4a3a'; ctx.fillRect(ax - 5, ay - 6, 11, 2); for (let k = 0; k < 4; k++) ctx.fillRect(ax - 4 + k, ay - 4 + k, 9 - 2 * k, 1);
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
      // bonos por cercanía (V5): líneas verdes hacia los vecinos que suman
      if (ok && g.cercaDe) {
        const [gx, gy] = R.iso(x + def.w / 2, y + def.h / 2);
        ctx.strokeStyle = 'rgba(110,240,120,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        for (const c of g.cercaDe(null, x, y, g.placing.type)) { const [ox2, oy2] = R.iso(c.o.cx, c.o.cy); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ox2, oy2); ctx.stroke(); }
        // y al revés: lo que este edificio le suma a los que ya están (una casa nueva no, una plaza junto a casas sí)
        for (const o of g.buildings) {
          if (o.owner !== 'p' || !o.done) continue;
          const r = D.CERCANIA && D.CERCANIA.find(c => c.a === o.type && c.b.includes(g.placing.type));
          if (r && g.rectDist(x, y, def.w, def.h, o.x, o.y, o.w, o.h) <= r.r) { const [ox2, oy2] = R.iso(o.cx, o.cy); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ox2, oy2); ctx.stroke(); }
        }
        ctx.setLineDash([]); ctx.lineWidth = 1;
      }
    }
    if (R.roadGhost) for (const [x, y] of R.roadGhost) diamondFill(ctx, x, y, 'rgba(230,200,120,0.45)');
    if (R.wallGhost) {
      const tl = PK.Def.tool, col = tl === 'gate' ? 'rgba(232,184,74,0.6)' : tl === 'quitar' || tl === 'talar' ? 'rgba(230,60,50,0.5)' : tl === 'plantar' ? 'rgba(80,220,90,0.45)' : 'rgba(210,210,220,0.55)';
      for (const [x, y] of R.wallGhost) diamondFill(ctx, x, y, col);
    }
    // la zona elegida para talar o quitar (el primer toque y el puntero)
    if ((PK.Def.tool === 'quitar' || PK.Def.tool === 'talar') && PK.Def.start && I0()) {
      const [sx, sy] = PK.Def.start, m = I0(), [tx, ty] = R.screenToTile(m.x, m.y), L = (PK.Despeje && PK.Despeje.ZONA_MAX) || 24;
      const x1 = U.clamp(Math.floor(tx), sx - L + 1, sx + L - 1), y1 = U.clamp(Math.floor(ty), sy - L + 1, sy + L - 1);
      ctx.strokeStyle = 'rgba(255,120,100,0.9)'; ctx.lineWidth = 1;
      const c = [[Math.min(sx, x1), Math.min(sy, y1)], [Math.max(sx, x1) + 1, Math.min(sy, y1)], [Math.max(sx, x1) + 1, Math.max(sy, y1) + 1], [Math.min(sx, x1), Math.max(sy, y1) + 1]].map(([a, b]) => R.iso(a, b));
      ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); for (const p of c.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.stroke();
    }
    if (R.beltGhost) for (const [x, y] of R.beltGhost) diamondFill(ctx, x, y, 'rgba(140,200,255,0.45)');

    // mapas del tesoro (H7): una X roja en el suelo, también sobre la niebla
    for (const m of (g.state && g.state.mapas) || []) {
      const [px, py] = R.iso(m.x + 0.5, m.y + 0.5), x = Math.round(px), y = Math.round(py), k = 0.7 + 0.3 * Math.sin(performance.now() / 300);
      ctx.fillStyle = 'rgba(200,30,20,' + k + ')';
      for (let i = -4; i <= 4; i++) { ctx.fillRect(x + i * 2, y + i, 2, 1); ctx.fillRect(x - i * 2, y + i, 2, 1); }
    }
    // banderas de exploración (A4): un mástil con el color del reino, también sobre la niebla
    for (const f of g.banderas()) {
      const [px, py] = R.iso(f[0] + 0.5, f[1] + 0.5), x = Math.round(px), y = Math.round(py), ond = Math.round(Math.sin(performance.now() / 260 + f[0]));
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 3, y - 1, 7, 2);
      ctx.fillStyle = '#2a1a0e'; ctx.fillRect(x, y - 20, 1, 20);
      ctx.fillStyle = 'rgb(' + D.PLAYER_COLOR.join(',') + ')'; ctx.fillRect(x + 1, y - 20, 8, 5 + ond); ctx.fillRect(x + 1, y - 15 + ond, 5, 1);
      ctx.fillStyle = '#f2ead6'; ctx.fillRect(x + 3, y - 18, 2, 2);
    }
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
      pxLine(ctx, xb, yb, x, y, a.col ? '#2a1a10' : '#3a2a1a'); ctx.fillStyle = a.col || '#e8e4dc'; ctx.fillRect(Math.round(x), Math.round(y), a.col ? 2 : 1, a.col ? 2 : 1);
    }
    if (PK.Asedios) PK.Asedios.dibujar(ctx, R); // trampas (C5)
    if (PK.Saqueos) PK.Saqueos.dibujar(ctx, R); // partidas de saqueo (C6)
    if (PK.Mundo) PK.Mundo.dibujar(ctx, R); // caravanas (S2)
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
    if (PK.Incursiones) PK.Incursiones.dibujarPantalla(ctx, s, ox, oy, R.dpr);
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
    const P = W.PW, PS = D.PARCEL, T = PK.Terr, mode = T && T.mode, dal = Sp.daltonico();
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
        if (o) { const pt = dal ? Sp.patronSlotDe(o) : -1; ctx.fillStyle = pt >= 0 ? Sp.trama(ctx, pt, colOf(o), 0.3) : 'rgba(' + colOf(o).join(',') + ',0.3)'; poly(quad(x0, y0, x0 + PS, y0 + PS)); ctx.fill(); }
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
      const pg = dal ? Sp.patronSlotDe(o) : -1;
      if (pg >= 0) ctx.setLineDash(Sp.GUIONES[pg]); // daltonismo: cada reino con su guion, el tuyo continuo
      ctx.beginPath();
      const diff = n => n < 0 || W.terr[n] !== W.terr[k];
      if (py === 0 || diff(k - P)) { const a = R.iso(x0, y0 + inset), b = R.iso(x0 + PS, y0 + inset); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      if (px === P - 1 || diff(k + 1)) { const a = R.iso(x0 + PS - inset, y0), b = R.iso(x0 + PS - inset, y0 + PS); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      if (py === P - 1 || diff(k + P)) { const a = R.iso(x0, y0 + PS - inset), b = R.iso(x0 + PS, y0 + PS - inset); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      if (px === 0 || diff(k - 1)) { const a = R.iso(x0 + inset, y0), b = R.iso(x0 + inset, y0 + PS); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
      if (pg >= 0) ctx.setLineDash([]);
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

  // Primera fila con dibujo de un sprite (el lienzo tiene aire arriba): se calcula una vez por sprite.
  function techo(spr) {
    if (spr._techo === undefined) {
      spr._techo = spr.pad || 0;
      try {
        const c = spr.c, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        fila: for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { spr._techo = y; break fila; }
      } catch (e) { /* lienzo sin acceso: queda pad */ }
    }
    return spr._techo;
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
  // Encuadra lo explorado (más un margen), no el mundo entero: al empezar, el mundo completo era un rectángulo
  // negro con un manchón diminuto. El encuadre crece suave a medida que exploras. mmView está en píxeles de mmBase.
  let mmBase = null, mmT = 99, mmFog = -1, mmTerr = -1, mmBox = null, mmDal = false;
  R.mmView = null;
  function mmTarget(w, h, aspect) {
    if (!mmBox) return { x: 0, y: 0, w, h };
    const m = 14;
    let x0 = mmBox[0] - m, x1 = mmBox[2] + m, y0 = mmBox[1] - m / 2, y1 = mmBox[3] + m / 2;
    for (const f of G().banderas()) { const fx = f[0] - f[1] + W.H, fy = (f[0] + f[1]) / 2; x0 = Math.min(x0, fx - 6); x1 = Math.max(x1, fx + 6); y0 = Math.min(y0, fy - 6); y1 = Math.max(y1, fy + 3); } // que se vean las banderas
    let vw = Math.max(72, x1 - x0), vh = Math.max(vw / aspect, y1 - y0);
    vw = Math.max(vw, vh * aspect);
    if (vw >= w || vh >= h) return { x: 0, y: 0, w, h };
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: U.clamp(cx - vw / 2, 0, w - vw), y: U.clamp(cy - vh / 2, 0, h - vh), w: vw, h: vh };
  }
  R.drawMinimap = function (mc, dt) {
    const ctx = mc.getContext('2d'), w = W.W + W.H, h = (W.W + W.H) / 2;
    mmT += dt;
    const dal = Sp.daltonico();
    if (!mmBase || mmT > 4 || mmDal !== dal || ((mmFog !== W.fogVer || mmTerr !== W.terrVer) && mmT > 0.7)) {
      mmFog = W.fogVer; mmTerr = W.terrVer; mmDal = dal;
      mmT = 0;
      mmBase = mmBase || Sp.mk(w, h);
      const bctx = mmBase.getContext('2d'), im = bctx.createImageData(w, h), d = im.data;
      const box = [1e9, 1e9, -1e9, -1e9];
      for (let my = 0; my < h; my++) for (let mx = 0; mx < w; mx++) {
        const a = mx - W.H, b = my * 2, tx = Math.floor((a + b) / 2), ty = Math.floor((b - a) / 2);
        if (!W.inb(tx, ty)) continue;
        const k = W.idx(tx, ty), nid = W.nodeAt[k];
        let col = Sp.TERRAIN_MM[W.terrain[k]];
        if (nid >= 0 && !W.nodes[nid].dead) col = Sp.NODE_MM[W.nodes[nid].kind] || (Sp.NODE_MM_MAR && Sp.NODE_MM_MAR[W.nodes[nid].kind]) || col;
        if (W.poiAt[k] >= 0) col = W.pois[W.poiAt[k]].kind === 'legend' ? [255, 220, 90] : [210, 180, 120];
        const o = W.terr[W.parcel(tx, ty)];
        if (o) {
          const c2 = o - 1 === D.MY_SLOT ? [110, 175, 255] : D.REALM_SLOTS[o - 1].color, pt = dal ? Sp.patronDe(o - 1) : -1, f = pt >= 0 && Sp.enPatron(pt, mx, my) ? 0.85 : 0.4; // daltonismo: el patrón del reino
          col = [col[0] * (1 - f) + c2[0] * f, col[1] * (1 - f) + c2[1] * f, col[2] * (1 - f) + c2[2] * f];
        }
        if (!W.fog[k]) col = [22, 19, 14];
        else { if (mx < box[0]) box[0] = mx; if (my < box[1]) box[1] = my; if (mx > box[2]) box[2] = mx; if (my > box[3]) box[3] = my; }
        const i = (my * w + mx) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
      bctx.putImageData(im, 0, 0);
      mmBox = box[2] >= box[0] ? box : null;
    }
    const tg = mmTarget(w, h, mc.width / mc.height);
    let v = R.mmView;
    if (!v) v = R.mmView = Object.assign({}, tg);
    else { const k = Math.min(1, dt * 3); for (const p of ['x', 'y', 'w', 'h']) v[p] += (tg[p] - v[p]) * k; }
    const sx = mc.width / v.w, sy = mc.height / v.h, zk = U.clamp(sx / (mc.width / w), 1, 3);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#16130e';
    ctx.fillRect(0, 0, mc.width, mc.height);
    ctx.drawImage(mmBase, v.x, v.y, v.w, v.h, 0, 0, mc.width, mc.height);
    const toMM = (x, y) => [(x - y + W.H - v.x) * sx, ((x + y) / 2 - v.y) * sy];
    for (const b of G().buildings) {
      if (b.owner !== 'p' && !seen(b.cx, b.cy)) continue;
      const [x, y] = toMM(b.cx, b.cy);
      ctx.fillStyle = 'rgb(' + Sp.ownerColor(b.owner).join(',') + ')';
      const s = Math.round((b.w >= 3 ? 3 : 2) * zk);
      if (dal && b.owner !== 'p') { const c = Math.max(1, Math.round(s / 3)), r = Math.round(s / 2) + 1; ctx.fillRect(Math.round(x - r), Math.round(y - c / 2), r * 2, c); ctx.fillRect(Math.round(x - c / 2), Math.round(y - r), c, r * 2); } // ajenos: una cruz, los tuyos: un cuadrado
      else ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    }
    const escCss = Math.max(1, Math.round(mc.width / Math.max(1, mc.clientWidth))), pu = Math.max(zk > 1.5 ? 2 : 1, escCss); // puntos visibles en el celular
    for (const u of G().units) {
      if (u.inside || (u.owner !== 'p' && !seen(u.x, u.y))) continue;
      const [x, y] = toMM(u.x, u.y);
      ctx.fillStyle = u.owner === 'p' ? '#cfe0ff' : 'rgb(' + Sp.ownerColor(u.owner).map(c => Math.min(255, c + 60)).join(',') + ')';
      ctx.fillRect(Math.round(x), Math.round(y), pu, pu);
    }
    if (PK.Incursiones) PK.Incursiones.minimapa(ctx, toMM);
    if (PK.Saqueos) PK.Saqueos.minimapa(ctx, toMM); // C6
    if (PK.Mundo) PK.Mundo.minimapa(ctx, toMM); // S2
    if (PK.Mar) PK.Mar.minimapa(ctx, toMM); // Fase 9: el Galeón
    if (PK.Campana && G().state && G().state.campana) { // el lugar del capítulo en curso: un punto rojo y dorado que late
      const n = PK.Campana.actual(), l = n && PK.Campana.lugar(n);
      if (l) { const [x, y] = toMM(l.x + 0.5, l.y + 0.5), s = Math.max(2, Math.round(zk * 2)), on = Math.floor(performance.now() / 350) % 2; ctx.fillStyle = on ? '#ffd040' : '#c02020'; ctx.fillRect(Math.round(x) - s, Math.round(y) - s, s * 2, s * 2); }
    }
    for (const m of (G().state && G().state.mapas) || []) { // mapas del tesoro: una X que late
      const [x, y] = toMM(m.x + 0.5, m.y + 0.5), s = Math.max(1, Math.round(zk)), on = Math.floor(performance.now() / 400) % 2;
      ctx.fillStyle = on ? '#ff4030' : '#ffd040';
      for (let i = -2; i <= 2; i++) { ctx.fillRect(Math.round(x) + i * s, Math.round(y) + i * s, s, s); ctx.fillRect(Math.round(x) - i * s, Math.round(y) + i * s, s, s); }
    }
    for (const f of G().banderas()) { // banderas de exploración
      const [x, y] = toMM(f[0] + 0.5, f[1] + 0.5), s = Math.max(1, Math.round(zk));
      ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x), Math.round(y) - 5 * s, s, 5 * s);
      ctx.fillStyle = 'rgb(' + D.PLAYER_COLOR.join(',') + ')'; ctx.fillRect(Math.round(x) + s, Math.round(y) - 5 * s, 3 * s, 2 * s);
    }
    // vista de la cámara
    const s = R.scale(), vw = R.cv.width / s, vh = R.cv.height / s;
    const ax = ((R.cam.x - vw / 2) / 16 - v.x) * sx, ay = ((R.cam.y - vh / 2) / 16 - v.y) * sy;
    // El lienzo es más grande que lo que se ve (en el celular, 384 px mostrados en 120–160): el trazo de 1 px se
    // perdía al achicarse. Se engruesa según esa escala para que siempre mida al menos 1 px en pantalla.
    const lw = Math.max(1, Math.round(mc.width / Math.max(1, mc.clientWidth)));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = lw;
    ctx.strokeRect(Math.round(ax) + lw / 2, Math.round(ay) + lw / 2, Math.round((vw / 16) * sx), Math.round((vh / 16) * sy));
  };
  R.minimapToTile = function (mc, mx, my) {
    const w = W.W + W.H, h = (W.W + W.H) / 2, v = R.mmView || { x: 0, y: 0, w, h };
    const a = v.x + (mx / mc.clientWidth) * v.w - W.H, b = (v.y + (my / mc.clientHeight) * v.h) * 2;
    return [(a + b) / 2, (b - a) / 2];
  };
})();
