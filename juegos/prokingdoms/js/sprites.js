// Arte pixel procedural: texturas de materiales, terreno, árboles, minas, edificios isométricos, aldeanos e íconos.
// Todo se genera al iniciar, así que no hay archivos de imagen que cargar.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const S = (PK.Sprites = {});

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  S.mk = mk;
  const sc = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ramp = (r, t) => r[Math.max(0, Math.min(r.length - 1, Math.floor(t * r.length)))];
  const rgb = c => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  S.rgb = rgb;
  const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
  const LIGHT = norm3(-0.55, -0.65, 0.55);

  // Búfer de píxeles simple, sin antialiasing.
  class PB {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
    set(x, y, c, a) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = (y * this.w + x) * 4, d = this.d, al = a === undefined ? 255 : a;
      if (al >= 255 || d[i + 3] === 0) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = al; }
      else { const t = al / 255; d[i] += (c[0] - d[i]) * t; d[i + 1] += (c[1] - d[i + 1]) * t; d[i + 2] += (c[2] - d[i + 2]) * t; }
    }
    alpha(x, y) { return this.d[(y * this.w + x) * 4 + 3]; }
    canvas() { const cv = mk(this.w, this.h); cv.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0); return cv; }
  }

  function withMask(spr) {
    const c = spr.c, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const m = new Uint8Array(c.width * c.height);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 140 ? 1 : 0;
    spr.mask = m;
    return spr;
  }
  S.hit = function (spr, x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= spr.c.width || y >= spr.c.height) return false;
    return !spr.mask || spr.mask[y * spr.c.width + x] === 1;
  };

  function ellipseShadow(pb, cx, cy, rx, ry, a) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) pb.set(cx + x, cy + y, [10, 18, 6], a);
  }

  // ---------- Texturas de materiales ----------
  const MAT = {
    plank: [128, 90, 54], darkwood: [86, 58, 36], bark: [92, 64, 40], stone: [148, 142, 130], plaster: [224, 210, 178],
    thatch: [178, 142, 76], tile: [166, 76, 50], slate: [92, 100, 116], paving: [158, 150, 134], soil: [112, 80, 50],
    logend: [196, 158, 104], canvasR: [176, 48, 40], canvasB: [48, 84, 160], rock: [120, 116, 110], rust: [138, 72, 46],
    marbleS: [222, 218, 206], gilt: [214, 170, 64], glaze: [62, 92, 168], verdigris: [78, 152, 132],
  };
  const TEX = {};
  S.tex = function (mat, light) {
    const key = mat + '_' + light;
    if (TEX[key]) return TEX[key];
    const n = 32, pb = new PB(n, n), base = MAT[mat] || [255, 0, 255];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let f = 1, col = base;
      const h = U.hash(x, y, 7);
      switch (mat) {
        case 'plank': case 'darkwood': case 'bark': {
          const bd = x >> 2;
          f = 0.94 + U.hash(bd, 1, 3) * 0.14 + U.noise(x * 0.5, y * 0.18, bd) * 0.12 + h * 0.05;
          if ((x & 3) === 0) f = 0.66; else if ((y + bd * 11) % 16 === 0) f = 0.74;
          break;
        }
        case 'stone': case 'paving': case 'rock': case 'rust': case 'marbleS': {
          const rh = mat === 'paving' ? 4 : 5, bw = mat === 'paving' ? 6 : 8;
          const row = Math.floor(y / rh), off = (row & 1) * (bw >> 1);
          const bx = Math.floor((x + off) / bw);
          const mortar = y % rh === rh - 1 || (x + off) % bw === 0;
          if (mortar) f = 0.68 + h * 0.06;
          else { f = 0.9 + U.hash(bx, row, 9) * 0.2 + h * 0.08; if (y % rh === 0) f += 0.08; }
          break;
        }
        case 'plaster': f = 0.93 + U.noise(x * 0.3, y * 0.3, 2) * 0.09 + h * 0.05; break;
        case 'thatch': {
          const row = Math.floor(y / 3);
          f = 0.88 + U.hash(x, row, 4) * 0.16 + U.noise(x * 0.7, y * 0.2, 5) * 0.08;
          if (y % 3 === 2) f -= 0.17;
          if (h > 0.92) f += 0.12;
          break;
        }
        case 'tile': case 'slate': case 'glaze': case 'verdigris': {
          const rh = mat === 'slate' ? 3 : 4, row = Math.floor(y / rh), off = (row & 1) * 2;
          f = 0.94 + U.hash(Math.floor((x + off) / 4), row, 6) * 0.12;
          if (y % rh === rh - 1) f -= 0.28; else if ((x + off) % 4 === 0) f -= 0.1;
          if (y % rh === 0) f += 0.06;
          break;
        }
        case 'soil': f = 0.88 + U.noise(x * 0.4, y * 0.4, 8) * 0.14 + h * 0.08; if (x % 4 === 0) f -= 0.18; if (x % 4 === 1) f += 0.06; break;
        case 'logend': {
          const dx = (x % 8) - 3.5, dy = (y % 6) - 2.5, r = Math.hypot(dx, dy * 1.25);
          f = 0.9 + ((r | 0) % 2) * 0.12 + h * 0.05;
          if (r > 3.3) { col = MAT.bark; f = 0.8; }
          break;
        }
        case 'canvasR': case 'canvasB': if (Math.floor(x / 3) % 2) col = [228, 218, 196]; f = 0.95 + h * 0.06; break;
        default: f = 0.95 + h * 0.1;
      }
      pb.set(x, y, sc(col, f * light));
    }
    return (TEX[key] = pb.canvas());
  };

  // ---------- Pintor isométrico para edificios ----------
  // Con más nivel, los edificios cambian de materiales: techos de teja, luego pizarra y al final mármol.
  // Desde el nivel 13 se suman remates de oro (aleros, puertas, cumbreras) y desde el 16 y el 20, más brillo.
  const TIER_MAT = [{}, { thatch: 'tile', plank: 'darkwood' }, { thatch: 'slate', tile: 'slate', plank: 'darkwood', plaster: 'marbleS' }, { thatch: 'slate', tile: 'slate', plank: 'darkwood', plaster: 'marbleS', stone: 'marbleS', paving: 'marbleS' }];
  // nivel 16: tejas vidriadas azules; nivel 20: techos de cobre verde (con los remates de oro de antes)
  TIER_MAT[4] = TIER_MAT[3];
  TIER_MAT[5] = Object.assign({}, TIER_MAT[3], { thatch: 'glaze', tile: 'glaze', slate: 'glaze' });
  TIER_MAT[6] = Object.assign({}, TIER_MAT[3], { thatch: 'verdigris', tile: 'verdigris', slate: 'verdigris', glaze: 'verdigris' });
  const GOLD = '#f0cc58', GOLD2 = '#c89a3c', GLINT = '#fff4c0';
  function painter(ctx, ox, oy, tier) {
    tier = tier || 0;
    const P = (x, y, z) => [Math.round(ox + (x - y) * 16), Math.round(oy + (x + y) * 8 - z)];
    const remap = TIER_MAT[tier];
    const info = { flags: 0, roofs: [] }; // lo que dibujó cada edificio, para los adornos genéricos
    function path(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
    function fill(pts, mat, light, skew) {
      if (typeof mat === 'string' && remap[mat]) mat = remap[mat];
      path(pts);
      if (Array.isArray(mat)) ctx.fillStyle = rgb(sc(mat, light));
      else if (mat[0] === '#' || mat.startsWith('rgb')) ctx.fillStyle = mat;
      else {
        const pat = ctx.createPattern(S.tex(mat, light), 'repeat');
        if (skew && pat.setTransform) pat.setTransform(new DOMMatrix([1, skew, 0, 1, 0, 0]));
        ctx.fillStyle = pat;
      }
      ctx.fill();
    }
    function px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    function line(a, b, c) {
      let x0 = Math.round(a[0]), y0 = Math.round(a[1]);
      const x1 = Math.round(b[0]), y1 = Math.round(b[1]);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      ctx.fillStyle = c;
      for (let i = 0; i < 600; i++) {
        ctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    function box(x, y, w, h, z0, z1, mL, mR, mT) {
      fill([P(x, y + h, z0), P(x + w, y + h, z0), P(x + w, y + h, z1), P(x, y + h, z1)], mL, 1.0, 0.5);
      fill([P(x + w, y + h, z0), P(x + w, y, z0), P(x + w, y, z1), P(x + w, y + h, z1)], mR || mL, 0.7, -0.5);
      if (mT) fill([P(x, y, z1), P(x + w, y, z1), P(x + w, y + h, z1), P(x, y + h, z1)], mT, 1.12, 0);
      line(P(x + w, y + h, z0), P(x + w, y + h, z1), 'rgba(0,0,0,0.18)');
    }
    function roof(x, y, w, h, zb, ht, mat, frac, ov, axis) {
      if (tier >= 5 && (mat === 'plank' || mat === 'darkwood')) mat = tier >= 6 ? 'verdigris' : 'glaze'; // techos de madera, rehechos
      const x0 = x - ov, y0 = y - ov, x1 = x + w + ov, y1 = y + h + ov;
      let r0, r1;
      if (axis === 'y') { const a = (y1 - y0) * (1 - frac) / 2, cx = (x0 + x1) / 2; r0 = [cx, y0 + a]; r1 = [cx, y1 - a]; }
      else { const a = (x1 - x0) * (1 - frac) / 2, cy = (y0 + y1) / 2; r0 = [x0 + a, cy]; r1 = [x1 - a, cy]; }
      const c0 = P(x0, y0, zb), c1 = P(x1, y0, zb), c2 = P(x1, y1, zb), c3 = P(x0, y1, zb);
      const R0 = P(r0[0], r0[1], zb + ht), R1 = P(r1[0], r1[1], zb + ht);
      if (axis === 'y') {
        fill([c0, c1, R0], mat, 0.86, 0.5);
        fill([c0, c3, R1, R0], mat, 1.0, -0.5);
        fill([c3, c2, R1], mat, 1.1, 0.5);
        fill([c1, c2, R1, R0], mat, 0.72, -0.5);
        line(c2, R1, 'rgba(0,0,0,0.25)');
      } else {
        fill([c0, c1, R1, R0], mat, 0.86, 0.5);
        fill([c3, c0, R0], mat, 1.0, -0.5);
        fill([c3, c2, R1, R0], mat, 1.1, 0.5);
        fill([c1, c2, R1], mat, 0.72, -0.5);
        line(c2, R1, 'rgba(0,0,0,0.25)');
      }
      line(R0, R1, 'rgba(255,240,210,0.35)');
      line(c3, c2, 'rgba(0,0,0,0.3)');
      line(c2, c1, 'rgba(0,0,0,0.35)');
      if (tier >= 3) { // cumbrera con caballete y remates en las puntas; de oro desde el nivel 13
        line(R0, R1, tier >= 4 ? GOLD : '#4a4048');
        const fin = tier >= 4 ? GOLD : '#5a5048';
        for (const R of [R0, R1]) { px(R[0], R[1] - 1, fin); px(R[0], R[1] - 2, fin); if (tier >= 5) px(R[0], R[1] - 3, GLINT); }
        if (tier >= 4) { line(c3, c2, GOLD2); line(c2, c1, '#a07828'); }
      }
      info.roofs.push({ r0, r1, z: zb + ht });
      return [R0, R1, r0, r1];
    }
    const wp = (b, side, u, z) => (side === 'L' ? P(b.x + u, b.y + b.h, z) : P(b.x + b.w, b.y + b.h - u, z));
    function quad(b, side, u0, u1, z0, z1, mat, light) {
      const l = light === undefined ? (side === 'L' ? 1 : 0.7) : light;
      fill([wp(b, side, u0, z0), wp(b, side, u1, z0), wp(b, side, u1, z1), wp(b, side, u0, z1)], mat, l, side === 'L' ? 0.5 : -0.5);
    }
    function door(b, side, u, wd, ht, z0) {
      z0 = z0 || 0;
      if (tier >= 4) quad(b, side, u - wd / 2 - 0.07, u + wd / 2 + 0.07, z0, z0 + ht + 1, GOLD2); // marco dorado
      quad(b, side, u - wd / 2, u + wd / 2, z0, z0 + ht, '#2b1a0e');
      quad(b, side, u - wd / 2 + 0.07, u + wd / 2 - 0.07, z0, z0 + ht - 1, 'darkwood', side === 'L' ? 0.85 : 0.6);
    }
    // Ventanas: desde el nivel 7 algunas tienen luz adentro y desde el 10, todas (más cálidas arriba).
    function win(b, side, u, z, wd, ht) {
      quad(b, side, u - wd / 2, u + wd / 2, z, z + ht, tier >= 4 ? GOLD2 : '#3a2616');
      const lit = tier >= 3 || (tier >= 2 && U.hash(Math.round(u * 10), Math.round(z), side === 'L' ? 1 : 2) > 0.45);
      if (!lit) { quad(b, side, u - wd / 2 + 0.06, u + wd / 2 - 0.06, z + 1, z + ht - 1, '#16121a'); return; }
      quad(b, side, u - wd / 2 + 0.06, u + wd / 2 - 0.06, z + 1, z + ht - 1, side === 'L' ? '#d8963c' : '#b87a30');
      quad(b, side, u - wd / 2 + 0.06, u + wd / 2 - 0.06, z + Math.ceil(ht / 2), z + ht - 1, side === 'L' ? '#f6d070' : '#dcae54');
    }
    function timber(b, side, z0, z1, n) {
      const len = side === 'L' ? b.w : b.h, c = '#4a2f1c';
      line(wp(b, side, 0, z1), wp(b, side, len, z1), c);
      line(wp(b, side, 0, z0), wp(b, side, len, z0), c);
      for (let i = 0; i <= n; i++) { const u = (len * i) / n; line(wp(b, side, u, z0), wp(b, side, u, z1), c); }
      for (let i = 0; i < n; i += 2) {
        const u0 = (len * i) / n, u1 = (len * (i + 1)) / n;
        line(wp(b, side, u0, z0), wp(b, side, u1, z1), c);
      }
    }
    // Banderas que crecen con el nivel: bandera sola, + banderín (4), cola larga y remate (7), pendón con cola de
    // golondrina (10), pendón con banda e insignia de oro (13) y pendón largo (16).
    function flag(x, y, z, col, ht) {
      ht = ht || 12;
      info.flags++;
      const p = P(x, y, z), md = rgb(col), lt = rgb(sc(col, 1.3)), dk = rgb(sc(col, 0.65));
      const top = p[1] - ht - (tier >= 3 ? 3 : tier >= 2 ? 2 : 0);
      line(p, [p[0], top], '#3a2a1a');
      if (tier >= 2) { ctx.fillStyle = tier >= 4 ? GOLD : '#8a7a68'; ctx.fillRect(p[0] - 1, top - 1, 3, 1); ctx.fillRect(p[0], top - 2, 1, 1); }
      if (tier >= 3) {
        const fw = tier >= 4 ? 7 : 6, fh = tier >= 5 ? 15 : 11, x0 = p[0] + 1, y0 = top + 1;
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x0 - 1, y0, fw + 2, 1); // travesaño
        ctx.fillStyle = md; ctx.fillRect(x0, y0 + 1, fw, fh - 3);
        for (let i = 0; i < fw; i++) if (Math.abs(i - (fw - 1) / 2) >= 1.2) ctx.fillRect(x0 + i, y0 + fh - 2, 1, 2); // cola de golondrina
        ctx.fillStyle = lt; ctx.fillRect(x0, y0 + 1, 1, fh - 1);
        ctx.fillStyle = dk; ctx.fillRect(x0 + fw - 1, y0 + 1, 1, fh - 1);
        if (tier >= 4) { ctx.fillStyle = GOLD; ctx.fillRect(x0, y0 + 3, fw, 1); ctx.fillRect(x0 + (fw >> 1), y0 + 5, 1, 3); ctx.fillRect(x0 + (fw >> 1) - 1, y0 + 6, 3, 1); }
        if (tier >= 6) { ctx.fillStyle = GLINT; ctx.fillRect(x0 + (fw >> 1), y0 + 6, 1, 1); }
        return;
      }
      ctx.fillStyle = md; ctx.fillRect(p[0] + 1, top, 7, 4);
      ctx.fillStyle = lt; ctx.fillRect(p[0] + 1, top, 7, 1);
      ctx.fillStyle = dk; ctx.fillRect(p[0] + 1, top + 3, 7, 1); ctx.fillRect(p[0] + 7, top + 1, 1, 3);
      if (tier >= 2) { ctx.fillStyle = md; ctx.fillRect(p[0] + 8, top + 1, 2, 2); ctx.fillRect(p[0] + 10, top + 2, 1, 1); }
      if (tier >= 1) { ctx.fillStyle = tier >= 2 ? lt : md; for (let i = 0; i < 5; i++) ctx.fillRect(p[0] + 1 + i, top + 5, 1, Math.max(1, 3 - Math.floor(i * 0.6))); }
    }
    function post(x, y, ht) { box(x, y, 0.14, 0.14, 0, ht, 'darkwood'); }
    return { ctx, P, fill, px, line, box, roof, quad, door, win, timber, flag, post, wp, info, tier };
  }

  // Adornos genéricos según el tramo de nivel: banderín en la cumbrera (si el edificio no tiene bandera) y, en las
  // dos esquinas laterales, faroles (nivel 7), estatuas de piedra (10) y de oro (13), con halo desde el 20.
  function adorn(p, w, h, col, tier) {
    const { info } = p;
    if (!info.flags && tier >= 1 && info.roofs.length) {
      const r = info.roofs.reduce((a, b) => (b.z > a.z ? b : a));
      const room = p.P(r.r1[0], r.r1[1], r.z)[1] - (tier >= 3 ? 3 : tier >= 2 ? 2 : 0) - 3; // que no se salga del lienzo
      const ht = Math.min(6 + tier, room);
      if (ht >= 4) p.flag(r.r1[0], r.r1[1], r.z, col, ht);
    }
    if (w < 2 || h < 2 || tier < 2) return;
    for (const [x, y] of [[0.04, h - 0.3], [w - 0.3, 0.04]]) {
      if (tier === 2) {
        p.box(x + 0.08, y + 0.08, 0.09, 0.09, 0, 9, 'darkwood');
        const t = p.P(x + 0.12, y + 0.12, 11);
        p.ctx.fillStyle = '#3a2a1a'; p.ctx.fillRect(t[0] - 1, t[1] - 1, 3, 3);
        p.px(t[0], t[1], '#ffd070');
        continue;
      }
      const m = tier >= 4 ? 'gilt' : 'marbleS';
      p.box(x, y, 0.24, 0.24, 0, 4, 'stone', 'stone', 'paving');      // pedestal
      p.box(x + 0.07, y + 0.07, 0.11, 0.11, 4, 10, m, m, m);           // figura
      const hd = p.P(x + 0.12, y + 0.12, 12);
      p.ctx.fillStyle = rgb(sc(MAT[m], 1.08)); p.ctx.fillRect(hd[0] - 1, hd[1] - 1, 2, 2); // cabeza
      if (tier >= 6) { p.px(hd[0], hd[1] - 3, GLINT); p.px(hd[0] - 2, hd[1] - 2, GLINT); p.px(hd[0] + 2, hd[1] - 2, GLINT); }
    }
  }

  function logsPile(p, x, y, rows) {
    for (let r = 0; r < rows.length; r++)
      for (let i = 0; i < rows[r]; i++) p.box(x, y + i * 0.32 + r * 0.16, 1.05, 0.3, r * 4, r * 4 + 4, 'bark', 'logend', 'bark');
  }
  function rockPile(p, x, y, mats) {
    const pos = [[0, 0, 0.45, 5], [0.42, 0.1, 0.4, 4], [0.1, 0.42, 0.42, 4], [0.5, 0.5, 0.35, 3], [0.2, 0.15, 0.3, 8]];
    pos.forEach((q, i) => p.box(x + q[0], y + q[1], q[2], q[2], i === 4 ? 5 : 0, i === 4 ? 9 : q[3], mats[i % mats.length], null, mats[i % mats.length]));
  }

  // Dibujos de cada edificio (origen en la esquina trasera de la planta).
  const BDRAW = {
    tc(p, col, m, tier) {
      p.box(-0.05, -0.05, 4.1, 4.1, 0, 3, 'stone', 'stone', 'paving');
      if (tier >= 3) { // campanario detrás del salón (desde el nivel 10)
        p.box(0.15, 0.15, 0.9, 0.9, 3, 48, 'stone');
        p.quad({ x: 0.15, y: 0.15, w: 0.9, h: 0.9 }, 'L', 0.32, 0.58, 38, 44, '#16121a'); p.quad({ x: 0.15, y: 0.15, w: 0.9, h: 0.9 }, 'R', 0.32, 0.58, 38, 44, '#16121a');
        p.roof(0.15, 0.15, 0.9, 0.9, 48, 14, tier >= 4 ? 'gilt' : 'slate', 0.01, 0.12, 'x');
      }
      const b = { x: 0.35, y: 0.35, w: 3.3, h: 3.3 };
      p.box(b.x, b.y, b.w, b.h, 3, 15, 'stone');
      p.box(b.x, b.y, b.w, b.h, 15, 27, 'plaster');
      p.timber(b, 'L', 15, 27, 6); p.timber(b, 'R', 15, 27, 6);
      p.win(b, 'L', 0.7, 18, 0.35, 6); p.win(b, 'L', 2.6, 18, 0.35, 6);
      p.win(b, 'R', 0.8, 18, 0.35, 6); p.win(b, 'R', 2.5, 18, 0.35, 6); p.win(b, 'R', 1.65, 7, 0.3, 5);
      p.door(b, 'L', 1.65, 0.75, 10, 3);
      p.quad(b, 'L', 1.0, 1.18, 5, 13, col); p.quad(b, 'L', 2.12, 2.3, 5, 13, col);
      const r = p.roof(b.x, b.y, b.w, b.h, 27, 18, 'tile', 0.45, 0.3, 'x');
      p.box(2.3, 1.0, 0.42, 0.42, 36, 50, 'stone'); m.smoke.push(p.P(2.51, 1.21, 50));
      p.flag(r[3][0], r[3][1], 45, col, 15);
    },
    house(p, col, m) {
      p.box(0.1, 0.1, 1.8, 1.8, 0, 2, 'stone', 'stone', 'paving');
      const b = { x: 0.22, y: 0.22, w: 1.56, h: 1.56 };
      p.box(b.x, b.y, b.w, b.h, 2, 13, 'plaster');
      p.timber(b, 'L', 2, 13, 3); p.timber(b, 'R', 2, 13, 3);
      p.door(b, 'L', 1.08, 0.42, 8, 2);
      p.win(b, 'L', 0.4, 6, 0.24, 4); p.win(b, 'R', 0.78, 6, 0.3, 4);
      p.quad(b, 'R', 1.25, 1.38, 4, 10, col);
      p.roof(b.x, b.y, b.w, b.h, 13, 12, 'thatch', 0.3, 0.25, 'x');
      p.box(1.1, 0.6, 0.22, 0.22, 20, 28, 'stone'); m.smoke.push(p.P(1.21, 0.71, 28));
    },
    lumber(p) {
      p.fill([p.P(0, 0, 0), p.P(2, 0, 0), p.P(2, 2, 0), p.P(0, 2, 0)], 'soil', 0.9, 0.5);
      p.post(0.15, 0.15, 12); p.post(1.7, 0.15, 12); p.post(0.15, 1.7, 12);
      logsPile(p, 0.45, 0.5, [3, 2]);
      p.box(1.55, 1.55, 0.3, 0.3, 0, 3, 'bark', 'logend', 'logend');
      p.post(1.7, 1.7, 12);
      p.roof(0.05, 0.05, 1.9, 1.9, 12, 7, 'plank', 0.6, 0.12, 'y');
    },
    mining(p) {
      p.fill([p.P(0, 0, 0), p.P(2, 0, 0), p.P(2, 2, 0), p.P(0, 2, 0)], 'soil', 0.8, 0.5);
      p.post(0.15, 0.15, 12); p.post(1.7, 0.15, 12); p.post(0.15, 1.7, 12);
      rockPile(p, 0.35, 0.35, ['rock', 'stone', 'rust']);
      p.box(1.15, 1.25, 0.55, 0.35, 2, 6, 'darkwood', 'darkwood', '#3a2a1c');
      p.box(1.2, 1.3, 0.45, 0.25, 6, 7, 'rock', 'rock', 'rock');
      const wh = p.P(1.3, 1.6, 1), wh2 = p.P(1.6, 1.6, 1);
      p.px(wh[0], wh[1], '#1c140e'); p.px(wh2[0], wh2[1], '#1c140e');
      p.post(1.7, 1.7, 12);
      p.roof(0.05, 0.05, 1.9, 1.9, 12, 7, 'thatch', 0.6, 0.12, 'x');
    },
    mill(p, col, m) {
      const b = { x: 0.3, y: 0.3, w: 1.4, h: 1.4 };
      p.box(b.x, b.y, b.w, b.h, 0, 18, 'stone');
      p.door(b, 'L', 0.7, 0.4, 8);
      p.win(b, 'R', 0.7, 10, 0.25, 4);
      p.roof(b.x, b.y, b.w, b.h, 18, 13, 'thatch', 0.01, 0.18, 'x');
      p.box(1.75, 1.35, 0.22, 0.22, 0, 3, 'plaster', 'plaster', 'plaster');
      p.box(1.78, 1.0, 0.2, 0.2, 0, 3, 'plaster', 'plaster', 'plaster');
      m.hub = p.P(1.0, 1.85, 21);
    },
    farm(p) {
      p.fill([p.P(0.05, 0.05, 0), p.P(2.95, 0.05, 0), p.P(2.95, 2.95, 0), p.P(0.05, 2.95, 0)], 'soil', 1, 0.5);
      for (let u = 0.25; u < 2.85; u += 0.2) for (let v = 0.3; v < 2.85; v += 0.42) {
        const pt = p.P(u, v, 0), hh = 2 + Math.floor(U.hash(Math.round(u * 10), Math.round(v * 10), 3) * 2.5);
        for (let k = 0; k < hh; k++) p.px(pt[0], pt[1] - k, k === hh - 1 ? '#ead06c' : k === 0 ? '#8a6a28' : '#c49a3a');
      }
      const fc = '#5a3c22';
      p.line(p.P(0, 0, 2), p.P(3, 0, 2), fc); p.line(p.P(0, 0, 2), p.P(0, 3, 2), fc);
      p.line(p.P(0, 3, 2), p.P(3, 3, 2), fc); p.line(p.P(3, 0, 2), p.P(3, 3, 2), fc);
      for (const [x, y] of [[0, 0], [1.5, 0], [3, 0], [0, 1.5], [3, 1.5], [0, 3], [1.5, 3], [3, 3]]) p.line(p.P(x, y, 0), p.P(x, y, 4), '#3e2816');
    },
    market(p) {
      p.fill([p.P(0, 0, 0), p.P(3, 0, 0), p.P(3, 3, 0), p.P(0, 3, 0)], 'paving', 1.0, 0);
      const stall = (x, y, mat) => {
        p.post(x, y, 9); p.post(x + 0.8, y, 9);
        p.box(x, y, 0.9, 0.5, 0, 5, 'plank', 'plank', 'plank');
        for (let i = 0; i < 4; i++) { const g = p.P(x + 0.15 + i * 0.2, y + 0.25, 5); p.px(g[0], g[1] - 1, ['#c43a2a', '#e8b84a', '#6a9a3a', '#e8e0d0'][i]); }
        p.post(x, y + 0.45, 9); p.post(x + 0.8, y + 0.45, 9);
        p.roof(x - 0.05, y - 0.05, 1.0, 0.62, 9, 3, mat, 0.95, 0.04, 'x');
      };
      stall(0.3, 0.3, 'canvasR'); stall(1.75, 0.35, 'canvasB'); stall(0.35, 1.75, 'canvasB');
      p.box(1.9, 1.85, 0.5, 0.5, 0, 4, 'stone', 'stone', '#24405a');
      p.box(2.45, 2.4, 0.3, 0.3, 0, 4, 'plank', 'plank', 'plank');
      p.box(2.05, 2.55, 0.28, 0.28, 0, 4, 'darkwood', 'darkwood', 'darkwood');
    },
    sawmill(p) {
      const b = { x: 0.2, y: 0.25, w: 1.9, h: 2.5 };
      p.box(b.x, b.y, b.w, b.h, 0, 15, 'plank');
      p.quad(b, 'L', 0.45, 1.45, 0, 10, '#24160c');
      p.win(b, 'R', 0.6, 8, 0.3, 4); p.win(b, 'R', 1.9, 8, 0.3, 4);
      p.roof(b.x, b.y, b.w, b.h, 15, 12, 'thatch', 0.5, 0.22, 'y');
      for (let i = 0; i < 3; i++) p.box(2.3 + i * 0.2, 0.4, 0.2, 1.2, i * 1, 3 + i * 1, 'logend', 'bark', 'bark');
      p.box(2.3, 2.0, 0.6, 0.5, 0, 5, 'plank', 'plank', 'plank');
      p.box(2.35, 2.05, 0.5, 0.4, 5, 7, 'plank', 'plank', 'plank');
    },
    cartwright(p, col) {
      // galpón abierto al frente con una carreta a medio armar y ruedas apoyadas
      p.box(0, 0, 3, 3, 0, 1, 'paving', 'paving', 'paving');
      const b = { x: 0.2, y: 0.2, w: 1.7, h: 2.6 };
      p.box(b.x, b.y, b.w, b.h, 1, 14, 'plank');
      p.quad(b, 'L', 0.25, 1.45, 1, 11, '#24160c');
      p.win(b, 'R', 0.7, 7, 0.3, 4); p.win(b, 'R', 1.9, 7, 0.3, 4);
      p.quad(b, 'L', 0.1, 0.24, 3, 12, col);
      p.roof(b.x, b.y, b.w, b.h, 14, 10, 'plank', 0.5, 0.22, 'y');
      // carreta en obra: caja + varas
      p.box(2.15, 0.6, 0.65, 1.1, 3, 6, 'plank', 'plank', 'plank');
      p.box(2.4, 1.7, 0.12, 0.8, 4, 5, 'darkwood', 'darkwood', 'darkwood');
      // ruedas de pixeles (aro, rayos y maza), igual que las de las carretas pero más grandes
      const W9 = ['...ooo...', '.oo.s.oo.', '.os.s.so.', 'o..sss..o', 'ossshssso', 'o..sss..o', '.os.s.so.', '.oo.s.oo.', '...ooo...'];
      const WC = { o: '#5a3a20', s: '#9a7048', h: '#2a1a0e' };
      const wheel = (x, y, z) => {
        const c = p.P(x, y, z), cx = p.ctx, x0 = Math.round(c[0]) - 4, y0 = Math.round(c[1]) - 4;
        for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) {
          const ch = W9[j][i];
          if (ch === '.') continue;
          cx.fillStyle = ch === 'o' && j < 2 ? '#8a6a40' : WC[ch];
          cx.fillRect(x0 + i, y0 + j, 1, 1);
        }
      };
      wheel(2.15, 1.7, 4); wheel(2.8, 1.7, 4);
      wheel(0.6, 2.95, 5); wheel(1.25, 2.95, 5);
      p.box(2.3, 2.6, 0.5, 0.3, 0, 3, 'logend', 'bark', 'bark');
    },
    // ---------- Estructuras de las Leyendas ----------
    tavern(p, col, m) {
      p.box(0, 0, 3, 3, 0, 1, 'paving', 'paving', 'paving');
      const b = { x: 0.3, y: 0.3, w: 2.2, h: 2.4 };
      p.box(b.x, b.y, b.w, b.h, 1, 10, 'stone');
      p.box(b.x, b.y, b.w, b.h, 10, 20, 'plaster');
      p.timber(b, 'L', 10, 20, 4); p.timber(b, 'R', 10, 20, 5);
      p.door(b, 'L', 1.1, 0.55, 9, 1);
      for (const u of [0.45, 1.75]) p.quad(b, 'L', u - 0.15, u + 0.15, 4, 8, '#f0c060');
      for (const u of [0.6, 1.6]) p.quad(b, 'R', u - 0.15, u + 0.15, 12, 17, '#f0c060');
      p.roof(b.x, b.y, b.w, b.h, 20, 12, 'tile', 0.5, 0.22, 'y');
      p.box(1.85, 0.55, 0.35, 0.35, 26, 35, 'stone'); m.smoke.push(p.P(2.02, 0.72, 35));
      // letrero con una jarra dorada, colgado de un brazo de madera
      const s0 = p.P(2.55, 1.0, 17);
      p.line(s0, [s0[0] + 7, s0[1] - 3], '#3a2414');
      p.ctx.fillStyle = '#3a2414'; p.ctx.fillRect(s0[0] + 3, s0[1] - 2, 7, 6);
      p.ctx.fillStyle = '#7a4a24'; p.ctx.fillRect(s0[0] + 4, s0[1] - 1, 5, 4);
      p.ctx.fillStyle = '#e8b83a'; p.ctx.fillRect(s0[0] + 5, s0[1], 2, 3); p.ctx.fillRect(s0[0] + 7, s0[1] + 1, 1, 1);
      p.box(2.6, 1.95, 0.32, 0.32, 0, 5, 'darkwood', 'darkwood', 'logend');
      p.box(2.6, 2.4, 0.32, 0.32, 0, 5, 'darkwood', 'darkwood', 'logend');
      p.box(2.25, 2.6, 0.32, 0.32, 0, 5, 'darkwood', 'darkwood', 'logend');
      p.box(2.6, 2.15, 0.32, 0.32, 5, 10, 'darkwood', 'darkwood', 'logend');
    },
    wishwell(p) {
      p.box(0.05, 0.05, 1.9, 1.9, 0, 1, 'paving', 'paving', 'paving');
      // pileta escalonada (ocho lados se insinúan con dos cajas cruzadas) y agua
      p.box(0.35, 0.15, 1.3, 1.7, 1, 6, 'marbleS', 'marbleS', '#3a86b8');
      p.box(0.15, 0.35, 1.7, 1.3, 1, 6, 'marbleS', 'marbleS', '#3a86b8');
      const w0 = p.P(0.6, 0.9, 6); p.px(w0[0], w0[1], '#bfeaff'); p.px(w0[0] + 9, w0[1] + 3, '#bfeaff'); p.px(w0[0] - 6, w0[1] + 5, '#bfeaff');
      p.box(0.78, 0.78, 0.44, 0.44, 6, 14, 'marbleS');
      p.box(0.62, 0.62, 0.76, 0.76, 14, 16, 'marbleS', 'marbleS', '#5ab0e0');
      // cristal que flota sobre la fuente
      const c = p.P(1, 1, 24);
      p.fill([[c[0], c[1] - 7], [c[0] + 4, c[1]], [c[0], c[1] + 6], [c[0] - 4, c[1]]], '#8ae0f0');
      p.fill([[c[0], c[1] - 7], [c[0] + 4, c[1]], [c[0], c[1] + 6]], '#3a9ac0');
      p.px(c[0] - 1, c[1] - 3, '#ffffff');
      // monedas en el fondo
      const g0 = p.P(1.3, 0.5, 6); p.px(g0[0], g0[1], '#e8b83a'); p.px(g0[0] + 3, g0[1] + 1, '#e8b83a');
    },
    arena(p, col) {
      p.fill([p.P(0, 0, 0), p.P(3, 0, 0), p.P(3, 3, 0), p.P(0, 3, 0)], '#c8a874', 1, 0);
      // gradas: altas atrás, bajas adelante para ver la pista
      p.box(0, 0, 3, 0.45, 0, 12, 'stone', 'stone', 'plank');
      p.box(0, 0.45, 0.45, 2.55, 0, 12, 'stone', 'stone', 'plank');
      p.box(0.2, 0.15, 2.6, 0.3, 12, 15, 'plank', 'plank', 'plank');
      p.box(0.15, 0.4, 0.3, 2.4, 12, 15, 'plank', 'plank', 'plank');
      for (const [x, y] of [[0.05, 0.05], [2.75, 0.05], [0.05, 2.75]]) p.flag(x + 0.1, y + 0.1, 15, col, 14);
      // muñecos de práctica y armero
      for (const [x, y] of [[1.2, 1.1], [2.0, 1.5]]) {
        p.post(x, y, 11);
        p.box(x - 0.12, y - 0.04, 0.38, 0.22, 7, 11, '#c8a060', '#a07a40', '#d8b878');
        p.box(x - 0.02, y + 0.02, 0.18, 0.12, 11, 14, '#d8b878', '#b8905a', '#e8c890');
      }
      p.box(1.0, 2.1, 0.9, 0.18, 0, 7, 'darkwood', 'darkwood', 'darkwood');
      for (let i = 0; i < 4; i++) { const s = p.P(1.1 + i * 0.22, 2.12, 7); p.line(s, [s[0], s[1] - 6], '#c8ccd4'); }
      p.box(0, 2.8, 3, 0.2, 0, 4, 'stone', 'stone', 'stone');
      p.box(2.8, 0.45, 0.2, 2.35, 0, 4, 'stone', 'stone', 'stone');
    },
    beasthouse(p) {
      p.fill([p.P(0, 0, 0), p.P(3, 0, 0), p.P(3, 3, 0), p.P(0, 3, 0)], 'soil', 0.9, 0.3);
      const b = { x: 0.15, y: 0.15, w: 1.7, h: 1.4 };
      p.box(b.x, b.y, b.w, b.h, 0, 12, 'darkwood');
      p.quad(b, 'L', 0.45, 1.25, 0, 9, '#2a1a0e');
      p.line(p.wp(b, 'L', 0.45, 9), p.wp(b, 'L', 1.25, 0), '#7a5432'); p.line(p.wp(b, 'L', 1.25, 9), p.wp(b, 'L', 0.45, 0), '#7a5432');
      p.roof(b.x, b.y, b.w, b.h, 12, 11, 'thatch', 0.45, 0.2, 'x');
      // corral con un buey
      for (let i = 0; i <= 7; i++) { p.post(0.1 + i * 0.4, 2.85, 6); p.post(2.85, 1.65 + i * 0.17, 6); }
      p.line(p.P(0.1, 2.9, 4), p.P(2.9, 2.9, 4), '#7a5432'); p.line(p.P(2.9, 1.65, 4), p.P(2.9, 2.9, 4), '#7a5432');
      p.box(1.0, 2.05, 0.9, 0.4, 3, 8, '#7a5a3a', '#5a4028', '#8a6a48');
      p.box(1.85, 2.1, 0.3, 0.3, 5, 9, '#7a5a3a', '#5a4028', '#8a6a48');
      for (const x of [1.05, 1.7]) p.box(x, 2.1, 0.12, 0.3, 0, 3, '#4a3424', '#3a2818', '#4a3424');
      const h = p.P(2.1, 2.1, 9); p.px(h[0], h[1] - 1, '#e8e0d0'); p.px(h[0] + 3, h[1], '#e8e0d0');
      p.box(2.1, 0.3, 0.6, 0.5, 0, 4, 'thatch', 'thatch', 'thatch');
    },
    observatory(p, col) {
      p.box(0.05, 0.05, 1.9, 1.9, 0, 4, 'stone', 'stone', 'paving');
      const t = { x: 0.4, y: 0.4, w: 1.2, h: 1.2 };
      p.box(t.x, t.y, t.w, t.h, 4, 34, 'stone');
      p.win(t, 'L', 0.6, 14, 0.22, 6); p.win(t, 'R', 0.6, 22, 0.22, 6);
      p.door(t, 'L', 0.6, 0.4, 8, 4);
      p.box(0.3, 0.3, 1.4, 1.4, 34, 37, 'stone', 'stone', 'paving');
      p.roof(0.42, 0.42, 1.16, 1.16, 37, 13, 'slate', 0.02, 0.06, 'x');
      // telescopio de latón asomando por la cúpula
      const a = p.P(1.0, 0.7, 44), b2 = p.P(1.7, 0.05, 54);
      p.line(a, b2, '#c89a40'); p.line([a[0], a[1] + 1], [b2[0], b2[1] + 1], '#8a6420'); p.line([a[0] + 1, a[1]], [b2[0] + 1, b2[1]], '#e8c060');
      p.flag(0.5, 0.5, 37, col, 10);
    },
    sanctum(p) {
      p.box(0, 0, 3, 3, 0, 3, 'marbleS', 'marbleS', 'paving');
      p.box(0.35, 0.35, 2.3, 2.3, 3, 5, 'marbleS', 'marbleS', 'marbleS');
      for (const [x, y] of [[0.45, 0.45], [2.25, 0.45], [0.45, 2.25], [2.25, 2.25]]) {
        p.box(x, y, 0.3, 0.3, 5, 26, 'marbleS');
        p.box(x - 0.05, y - 0.05, 0.4, 0.4, 26, 29, 'marbleS', 'marbleS', 'gilt');
      }
      // gran cristal en el centro
      const c = p.P(1.5, 1.5, 5), top = [c[0], c[1] - 34];
      p.fill([top, [c[0] + 9, c[1] - 14], [c[0], c[1]], [c[0] - 9, c[1] - 14]], '#8ae0f0');
      p.fill([top, [c[0] + 9, c[1] - 14], [c[0], c[1]]], '#3a9ac0');
      p.fill([top, [c[0] - 3, c[1] - 16], [c[0], c[1] - 4], [c[0] - 9, c[1] - 14]], '#c8f4ff');
      for (const [dx, dy] of [[-12, -30], [12, -24], [-15, -8], [14, -40], [0, -44]]) p.px(c[0] + dx, c[1] + dy, '#e8fbff');
      // cristales chicos
      for (const [x, y] of [[0.9, 2.0], [2.1, 1.0]]) { const s = p.P(x, y, 5); p.fill([[s[0], s[1] - 9], [s[0] + 3, s[1] - 3], [s[0], s[1]], [s[0] - 3, s[1] - 3]], '#8ae0f0'); }
    },
    runeforge(p, col, m) {
      p.box(0, 0, 3, 3, 0, 2, 'stone', 'stone', 'paving');
      const b = { x: 0.3, y: 0.3, w: 1.6, h: 2.3 };
      p.box(b.x, b.y, b.w, b.h, 2, 18, '#4a4650', '#3a3640', '#5a5660');
      p.quad(b, 'L', 0.35, 1.2, 2, 11, '#1a1014');
      p.quad(b, 'L', 0.5, 1.05, 2, 7, '#ff7a2a'); p.quad(b, 'L', 0.62, 0.92, 2, 5, '#ffd060');
      // runas brillantes en los muros
      for (const [u, z] of [[0.3, 14], [0.9, 15], [1.4, 13]]) { const r = p.wp(b, 'R', u, z); p.px(r[0], r[1], '#b07aff'); p.px(r[0] + 1, r[1] - 1, '#b07aff'); p.px(r[0], r[1] - 2, '#e0c8ff'); }
      for (const u of [0.25, 1.4]) { const r = p.wp(b, 'L', u, 14); p.px(r[0], r[1], '#6ae8ff'); p.px(r[0] + 1, r[1] + 1, '#6ae8ff'); }
      p.roof(b.x, b.y, b.w, b.h, 18, 8, 'slate', 0.3, 0.15, 'y');
      p.box(0.5, 1.9, 0.5, 0.5, 18, 36, '#4a4650', '#3a3640', '#2a2630'); m.smoke.push(p.P(0.75, 2.15, 36));
      // yunque y canal de fuego
      p.box(2.2, 1.0, 0.5, 0.3, 0, 4, '#3a3a40', '#2a2a30', '#3a3a40');
      p.box(2.1, 0.95, 0.7, 0.4, 4, 7, '#6a6c78', '#4a4c58', '#9a9ca8');
      p.box(2.1, 2.1, 0.7, 0.6, 0, 2, '#3a3640', '#2a2630', '#ff8a2a');
      const lv = p.P(2.45, 2.4, 2); p.px(lv[0], lv[1], '#ffe070'); p.px(lv[0] - 3, lv[1] + 1, '#ffe070');
      p.flag(2.85, 0.2, 0, col, 20);
    },
    dragontower(p, col) {
      p.box(0, 0, 2, 2, 0, 4, 'slate', 'slate', 'paving');
      const t = { x: 0.3, y: 0.3, w: 1.4, h: 1.4 };
      p.box(t.x, t.y, t.w, t.h, 4, 58, 'slate');
      p.win(t, 'L', 0.7, 20, 0.25, 8); p.win(t, 'R', 0.7, 34, 0.25, 8); p.win(t, 'L', 0.7, 44, 0.2, 5);
      p.door(t, 'L', 0.7, 0.45, 10, 4);
      p.box(0.15, 0.15, 1.7, 1.7, 58, 62, 'slate', 'slate', 'paving');
      for (const [x, y] of [[0.15, 0.15], [0.85, 0.15], [1.55, 0.15], [0.15, 0.85], [0.15, 1.55]]) p.box(x, y, 0.3, 0.3, 62, 66, 'slate', 'slate', 'slate');
      // el dragón posado en la almena: cuerpo, cuello, cabeza, alas y cola (todo en bloques)
      const R = '#b8302a', Rd = '#7a1a16', Rl = '#e8604a';
      p.box(0.7, 0.8, 0.7, 0.4, 62, 68, R, Rd, Rl);
      p.box(1.3, 0.9, 0.25, 0.2, 66, 74, R, Rd, Rl);
      p.box(1.4, 0.85, 0.4, 0.28, 74, 78, R, Rd, Rl);
      const e = p.P(1.75, 0.9, 77); p.px(e[0], e[1], '#ffe070');
      const w1 = p.P(0.9, 0.8, 68), w2 = p.P(1.1, 0.9, 68);
      p.fill([w1, [w1[0] - 14, w1[1] - 18], [w1[0] - 6, w1[1] - 4], [w1[0] - 10, w1[1] - 2]], Rd);
      p.fill([w2, [w2[0] + 4, w2[1] - 20], [w2[0] + 10, w2[1] - 8], [w2[0] + 6, w2[1] - 2]], R);
      p.line(p.P(0.7, 1.0, 64), p.P(0.2, 1.6, 58), Rd); p.line(p.P(0.7, 1.05, 63), p.P(0.25, 1.65, 57), R);
      p.flag(0.25, 1.75, 66, col, 12);
    },
    library(p, col, m, tier) {
      p.box(0, 0, 3, 3, 0, 2, 'stone', 'stone', 'paving');
      const b = { x: 0.3, y: 0.3, w: 2.4, h: 2.4 };
      p.box(b.x, b.y, b.w, b.h, 2, 21, 'stone');
      p.win(b, 'L', 0.5, 8, 0.28, 9); p.win(b, 'L', 1.9, 8, 0.28, 9);
      p.win(b, 'R', 0.5, 8, 0.28, 9); p.win(b, 'R', 1.2, 8, 0.28, 9); p.win(b, 'R', 1.9, 8, 0.28, 9);
      p.door(b, 'L', 1.2, 0.5, 10, 2);
      p.quad(b, 'L', 1.05, 1.35, 14, 18, '#d8b850');
      p.roof(b.x, b.y, b.w, b.h, 21, 16, 'slate', 0.35, 0.28, 'x');
      if (tier >= 3) { // linterna con cúpula sobre el tejado (desde el nivel 10)
        const l = { x: 1.25, y: 1.25, w: 0.5, h: 0.5 };
        p.box(l.x, l.y, l.w, l.h, 33, 42, 'plaster');
        p.win(l, 'L', 0.25, 35, 0.2, 5); p.win(l, 'R', 0.25, 35, 0.2, 5);
        p.roof(l.x, l.y, l.w, l.h, 42, 9, tier >= 4 ? 'gilt' : 'slate', 0.01, 0.08, 'x');
      }
    },
    barracks(p, col, m, tier) {
      if (tier >= 3) { // torre de vigía en la esquina de atrás (desde el nivel 10)
        const t = { x: 0.2, y: 0.1, w: 0.75, h: 0.75 };
        p.box(t.x, t.y, t.w, t.h, 0, 33, 'stone');
        p.quad(t, 'L', 0.3, 0.44, 24, 30, '#141018'); p.quad(t, 'R', 0.3, 0.44, 24, 30, '#141018'); // troneras sobre el techo
        p.box(t.x - 0.04, t.y - 0.04, t.w + 0.08, t.h + 0.08, 33, 35, 'stone', 'stone', 'paving');
        for (const [x, y] of [[0.16, 0.06], [0.5, 0.06], [0.16, 0.4], [0.77, 0.06], [0.77, 0.4], [0.77, 0.77], [0.46, 0.77], [0.16, 0.77]]) p.box(x, y, 0.18, 0.18, 35, 38, 'stone', 'stone', 'stone');
      }
      const b = { x: 0.25, y: 0.45, w: 2.5, h: 2.1 };
      p.box(b.x, b.y, b.w, b.h, 0, 14, 'darkwood');
      p.box(b.x, b.y, b.w, b.h, 0, 3, 'stone');
      p.door(b, 'L', 1.25, 0.6, 9, 0);
      p.quad(b, 'L', 0.35, 0.55, 4, 12, col); p.quad(b, 'L', 1.95, 2.15, 4, 12, col);
      p.win(b, 'R', 1.05, 7, 0.3, 3);
      p.roof(b.x, b.y, b.w, b.h, 14, 10, 'plank', 0.6, 0.2, 'x');
      p.box(2.78, 2.78, 0.12, 0.12, 0, 9, 'darkwood');
      p.line(p.P(2.6, 2.84, 7), p.P(2.98, 2.84, 7), '#5a3c22');
      p.flag(2.9, 0.35, 0, col, 24);
    },
    tower(p, col, m, tier) {
      const b = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 };
      p.box(b.x, b.y, b.w, b.h, 0, 32, 'stone');
      p.quad(b, 'L', 0.36, 0.48, 14, 21, '#141018'); p.quad(b, 'R', 0.36, 0.48, 18, 25, '#141018');
      if (tier >= 2) p.box(0.02, 0.02, 0.96, 0.96, 20, 22, 'stone', 'stone', 'stone'); // cornisa intermedia
      p.box(0, 0, 1, 1, 32, 35, 'stone', 'stone', 'paving');
      for (const [x, y] of [[0, 0], [0.4, 0], [0, 0.4], [0.8, 0], [0, 0.8], [0.8, 0.4], [0.4, 0.8], [0.8, 0.8]]) p.box(x, y, 0.2, 0.2, 35, 39, 'stone', 'stone', 'stone');
      if (tier >= 3) { // chapitel cónico (desde el nivel 10)
        p.roof(0.15, 0.15, 0.7, 0.7, 39, 15, tier >= 6 ? 'verdigris' : tier >= 5 ? 'glaze' : tier >= 4 ? 'gilt' : 'slate', 0.01, 0.06, 'x');
        p.flag(0.5, 0.5, 54, col, 7);
      } else p.flag(0.5, 0.5, 35, col, 14);
    },
    guild(p) {
      p.box(0, 0, 3, 3, 0, 2, 'stone', 'stone', 'paving');
      const b = { x: 0.25, y: 0.25, w: 2.5, h: 2.5 };
      p.box(b.x, b.y, b.w, b.h, 2, 10, 'stone');
      p.box(b.x, b.y, b.w, b.h, 10, 20, 'plaster');
      p.timber(b, 'L', 10, 20, 4); p.timber(b, 'R', 10, 20, 4);
      p.door(b, 'L', 1.25, 0.7, 9, 2);
      p.win(b, 'R', 0.6, 13, 0.3, 5); p.win(b, 'R', 1.9, 13, 0.3, 5);
      const pur = [106, 58, 150], gold = [220, 180, 70];
      p.quad(b, 'L', 0.35, 0.65, 4, 17, pur); p.quad(b, 'L', 1.85, 2.15, 4, 17, pur);
      p.quad(b, 'L', 0.45, 0.55, 10, 13, gold); p.quad(b, 'L', 1.95, 2.05, 10, 13, gold);
      const r = p.roof(b.x, b.y, b.w, b.h, 20, 15, 'tile', 0.5, 0.25, 'y');
      p.flag(r[3][0], r[3][1], 35, pur, 12);
    },
    masonry(p) {
      p.fill([p.P(0, 0, 0), p.P(2, 0, 0), p.P(2, 2, 0), p.P(0, 2, 0)], 'paving', 0.9, 0);
      p.box(0.15, 0.15, 1.7, 0.22, 0, 10, 'stone'); p.box(0.15, 0.15, 0.22, 1.7, 0, 10, 'stone');
      p.box(0.6, 0.7, 0.4, 0.4, 0, 5, 'stone', 'stone', 'paving'); p.box(1.1, 0.7, 0.4, 0.4, 0, 5, 'stone', 'stone', 'paving');
      p.box(0.85, 0.75, 0.4, 0.4, 5, 10, 'stone', 'stone', 'paving'); p.box(0.7, 1.25, 0.4, 0.4, 0, 5, 'stone', 'stone', 'paving');
      p.post(1.7, 1.7, 12); p.post(1.7, 0.15, 12); p.post(0.15, 1.7, 12);
      p.roof(0.05, 0.05, 1.9, 1.9, 12, 6, 'plank', 0.6, 0.1, 'y');
    },
    smelter(p, col, m) {
      p.box(2.15, 0.3, 0.55, 0.55, 0, 42, 'stone'); m.smoke.push(p.P(2.42, 0.57, 42));
      const b = { x: 0.3, y: 0.6, w: 2.1, h: 2.0 };
      p.box(b.x, b.y, b.w, b.h, 0, 14, 'stone');
      p.quad(b, 'L', 0.65, 1.35, 0, 8, '#3a1608');
      p.quad(b, 'L', 0.78, 1.22, 1, 7, '#e8661c');
      p.quad(b, 'L', 0.9, 1.1, 2, 5, '#ffc24a');
      p.roof(b.x, b.y, b.w, b.h, 14, 10, 'slate', 0.5, 0.18, 'x');
      rockPile(p, 2.35, 2.2, ['rust', 'rust', 'rock']);
    },
    forge(p, col, m) {
      p.box(1.25, 0.2, 0.4, 0.4, 0, 30, 'stone'); m.smoke.push(p.P(1.45, 0.4, 30));
      const b = { x: 0.2, y: 0.3, w: 1.4, h: 1.3 };
      p.box(b.x, b.y, b.w, b.h, 0, 12, 'stone');
      p.quad(b, 'L', 0.45, 0.95, 0, 7, '#3a1608'); p.quad(b, 'L', 0.55, 0.85, 1, 5, '#f07a24');
      p.roof(b.x, b.y, b.w, b.h, 12, 9, 'tile', 0.4, 0.15, 'x');
      p.box(1.65, 1.55, 0.28, 0.14, 0, 2, '#2c2c30'); p.box(1.6, 1.52, 0.38, 0.2, 2, 4, '#4a4a52', '#36363c', '#5c5c66');
    },
    university(p) {
      p.box(0, 0, 3, 3, 0, 2, 'stone', 'stone', 'paving');
      const b = { x: 0.2, y: 0.2, w: 2.6, h: 2.6 };
      p.box(b.x, b.y, b.w, b.h, 2, 20, 'stone');
      for (const u of [0.45, 0.95, 1.65, 2.15]) { p.win(b, 'L', u, 9, 0.24, 7); p.win(b, 'R', u, 9, 0.24, 7); }
      p.door(b, 'L', 1.3, 0.5, 10, 2);
      p.roof(b.x, b.y, b.w, b.h, 20, 12, 'slate', 0.4, 0.2, 'x');
      p.box(1.1, 1.1, 0.8, 0.8, 24, 38, 'plaster');
      p.win({ x: 1.1, y: 1.1, w: 0.8, h: 0.8 }, 'L', 0.4, 29, 0.2, 5);
      p.roof(1.1, 1.1, 0.8, 0.8, 38, 14, 'slate', 0.01, 0.1, 'x');
    },
    granary(p) {
      p.box(0.15, 0.15, 1.7, 1.7, 0, 3, 'stone', 'stone', 'paving');
      for (const [x, y] of [[0.3, 0.3], [1.5, 0.3], [0.3, 1.5], [1.5, 1.5]]) p.box(x, y, 0.2, 0.2, 3, 7, 'stone');
      const b = { x: 0.25, y: 0.25, w: 1.5, h: 1.5 };
      p.box(b.x, b.y, b.w, b.h, 7, 17, 'plank');
      p.door(b, 'L', 0.75, 0.4, 7, 7);
      p.roof(b.x, b.y, b.w, b.h, 17, 11, 'thatch', 0.2, 0.2, 'x');
      for (let i = 0; i < 3; i++) p.box(1.75, 0.3 + i * 0.32, 0.22, 0.28, 0, 4, 'canvasR', 'canvasR', '#d8c08a');
    },
    warehouse(p, col) {
      p.box(0, 0, 3, 3, 0, 2, 'stone', 'stone', 'paving');
      const b = { x: 0.3, y: 0.4, w: 2.4, h: 2.2 };
      p.box(b.x, b.y, b.w, b.h, 2, 6, 'stone');
      p.box(b.x, b.y, b.w, b.h, 6, 18, 'plank');
      p.timber(b, 'R', 6, 18, 4);
      p.quad(b, 'L', 0.6, 1.8, 2, 13, '#24160c'); p.quad(b, 'L', 0.68, 1.72, 2, 12, 'darkwood', 0.8);
      p.line(p.wp(b, 'L', 0.68, 2), p.wp(b, 'L', 1.72, 12), '#4a2f1c'); p.line(p.wp(b, 'L', 1.72, 2), p.wp(b, 'L', 0.68, 12), '#4a2f1c');
      p.roof(b.x, b.y, b.w, b.h, 18, 12, 'tile', 0.55, 0.22, 'x');
      p.box(2.75, 2.65, 0.25, 0.25, 0, 4, 'bark', 'bark', 'logend'); p.box(2.75, 2.3, 0.25, 0.25, 0, 4, 'plank', 'plank', 'plank');
      p.quad(b, 'R', 1.0, 1.2, 9, 15, col);
    },
    builder(p, col) {
      p.fill([p.P(0, 0, 0), p.P(2, 0, 0), p.P(2, 2, 0), p.P(0, 2, 0)], 'soil', 0.95, 0.5);
      const b = { x: 0.2, y: 0.2, w: 1.3, h: 1.3 };
      p.box(b.x, b.y, b.w, b.h, 0, 11, 'plaster');
      p.timber(b, 'L', 0, 11, 2); p.timber(b, 'R', 0, 11, 2);
      p.door(b, 'L', 0.65, 0.38, 7);
      p.roof(b.x, b.y, b.w, b.h, 11, 9, 'tile', 0.3, 0.2, 'x');
      p.box(1.6, 0.3, 0.3, 1.2, 0, 3, 'plank', 'plank', 'plank'); p.box(1.6, 0.4, 0.3, 1.0, 3, 5, 'plank', 'plank', 'plank');
      p.post(1.6, 1.65, 14); p.post(1.85, 1.65, 14); p.line(p.P(1.6, 1.7, 13), p.P(1.95, 1.7, 13), '#4a2f1c');
      p.flag(1.0, 0.9, 20, col, 8);
    },
    scout(p, col) {
      p.fill([p.P(0, 0, 0), p.P(2, 0, 0), p.P(2, 2, 0), p.P(0, 2, 0)], 'soil', 0.9, 0.5);
      for (let i = 0; i <= 6; i++) p.post(0.1 + i * 0.3, 0.1, 6);
      for (let i = 1; i <= 6; i++) p.post(0.1, 0.1 + i * 0.3, 6);
      const b = { x: 0.5, y: 0.5, w: 0.9, h: 0.9 };
      for (const [x, y] of [[0.5, 0.5], [1.25, 0.5], [0.5, 1.25], [1.25, 1.25]]) p.box(x, y, 0.15, 0.15, 0, 26, 'darkwood');
      p.box(b.x - 0.1, b.y - 0.1, b.w + 0.2, b.h + 0.2, 26, 30, 'plank', 'plank', 'plank');
      p.roof(b.x - 0.15, b.y - 0.15, b.w + 0.3, b.h + 0.3, 30, 8, 'thatch', 0.01, 0.05, 'x');
      p.line(p.P(0.6, 1.3, 2), p.P(1.3, 0.6, 24), '#5a3c22'); p.line(p.P(0.7, 1.3, 2), p.P(1.3, 0.7, 24), '#5a3c22');
      p.box(1.55, 1.5, 0.35, 0.25, 0, 3, '#7a6a4a', '#5a4a34', '#9a8a64');
      p.flag(1.0, 1.0, 34, col, 9);
    },
    scriptorium(p) {
      p.box(0.1, 0.1, 1.8, 1.8, 0, 2, 'stone', 'stone', 'paving');
      const b = { x: 0.25, y: 0.25, w: 1.5, h: 1.5 };
      p.box(b.x, b.y, b.w, b.h, 2, 16, 'stone');
      p.win(b, 'L', 0.45, 8, 0.22, 6); p.win(b, 'R', 0.45, 8, 0.22, 6); p.win(b, 'R', 1.05, 8, 0.22, 6);
      p.door(b, 'L', 1.1, 0.4, 8, 2);
      p.roof(b.x, b.y, b.w, b.h, 16, 12, 'slate', 0.4, 0.2, 'y');
      p.quad(b, 'L', 0.25, 0.65, 13, 15, '#e8dcc0');
    },
    monastery(p) {
      p.box(0, 0, 3, 3, 0, 2, 'stone', 'stone', 'paving');
      const b = { x: 0.3, y: 0.9, w: 2.4, h: 1.8 };
      p.box(b.x, b.y, b.w, b.h, 2, 18, 'stone');
      for (const u of [0.5, 1.2, 1.9]) p.win(b, 'L', u, 8, 0.2, 8);
      p.door(b, 'R', 0.9, 0.5, 11, 2);
      p.roof(b.x, b.y, b.w, b.h, 18, 13, 'tile', 0.7, 0.18, 'x');
      const t = { x: 0.35, y: 0.2, w: 0.75, h: 0.75 };
      p.box(t.x, t.y, t.w, t.h, 2, 42, 'stone');
      p.win(t, 'L', 0.37, 30, 0.2, 7); p.win(t, 'R', 0.37, 30, 0.2, 7);
      p.roof(t.x, t.y, t.w, t.h, 42, 14, 'slate', 0.01, 0.08, 'x');
      const c = p.P(0.72, 0.57, 58);
      p.line(c, [c[0], c[1] - 7], '#e8c050'); p.line([c[0] - 2, c[1] - 5], [c[0] + 2, c[1] - 5], '#e8c050');
    },
    steelworks(p, col, m) {
      p.box(0.2, 0.2, 0.5, 0.5, 0, 46, 'stone'); m.smoke.push(p.P(0.45, 0.45, 46));
      p.box(1.0, 0.2, 0.45, 0.45, 0, 40, 'stone'); m.smoke.push(p.P(1.22, 0.42, 40));
      const b = { x: 0.3, y: 0.85, w: 2.4, h: 1.9 };
      p.box(b.x, b.y, b.w, b.h, 0, 16, 'stone');
      p.quad(b, 'L', 0.4, 1.0, 0, 9, '#3a1608'); p.quad(b, 'L', 0.5, 0.9, 1, 7, '#ff8a2a');
      p.quad(b, 'L', 1.4, 2.0, 0, 9, '#3a1608'); p.quad(b, 'L', 1.5, 1.9, 1, 7, '#ffb04a');
      p.roof(b.x, b.y, b.w, b.h, 16, 9, 'slate', 0.8, 0.15, 'x');
      p.box(2.3, 0.3, 0.55, 0.45, 0, 5, '#4a4a52', '#36363c', '#6a6a74');
    },
    workshop(p, col) {
      p.box(0, 0, 3, 3, 0, 2, 'stone', 'stone', 'paving');
      const b = { x: 0.25, y: 0.3, w: 2.0, h: 2.4 };
      p.box(b.x, b.y, b.w, b.h, 2, 20, 'plank');
      p.box(b.x, b.y, b.w, b.h, 2, 6, 'stone');
      p.quad(b, 'L', 0.4, 1.6, 2, 14, '#1c120a');
      p.win(b, 'R', 0.6, 12, 0.3, 4); p.win(b, 'R', 1.7, 12, 0.3, 4);
      p.roof(b.x, b.y, b.w, b.h, 20, 12, 'slate', 0.5, 0.2, 'y');
      p.post(2.55, 1.0, 30); p.line(p.P(2.6, 1.05, 30), p.P(2.6, 2.4, 26), '#4a2f1c');
      const g = p.P(2.6, 2.4, 14);
      for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; p.px(g[0] + Math.cos(t) * 4, g[1] + Math.sin(t) * 4, a % 2 ? '#6a6a72' : '#a0a0aa'); }
      p.px(g[0], g[1], '#2a2a30');
      p.quad(b, 'R', 1.0, 1.25, 8, 16, col);
    },
    // Jardines Colgantes: tres terrazas con pasto, enredaderas que cuelgan, arbolitos y una fuente arriba.
    gardens(p, col) {
      const G1 = [96, 154, 62], LEAF = ['#3e7a30', '#5a9a40', '#78b450'];
      p.box(-0.05, -0.05, 3.1, 3.1, 0, 3, 'stone', 'stone', 'paving');
      for (const [o, s, z0, z1] of [[0.2, 2.6, 3, 10], [0.6, 1.8, 10, 17], [1.0, 1.0, 17, 24]]) {
        p.box(o, o, s, s, z0, z1, 'stone', 'stone', G1);
        for (let i = 0; i < 10; i++) { // enredaderas con alguna flor
          const u = (s * (i + 0.5)) / 10, len = 2 + Math.floor(U.hash(i, z0, 5) * 4);
          for (const side of ['L', 'R']) {
            const a = side === 'L' ? p.P(o + u, o + s, z1) : p.P(o + s, o + s - u, z1);
            for (let k = 0; k < len; k++) p.px(a[0], a[1] + k, k === len - 1 && U.hash(i, k + (side === 'L' ? 0 : 9), z0) > 0.55 ? '#e86a8a' : LEAF[k % 2]);
          }
        }
        for (const [dx, dy] of [[0.25, 0.25], [s - 0.35, 0.25], [0.25, s - 0.35]]) { // arbolitos
          const c = p.P(o + dx, o + dy, z1);
          p.px(c[0], c[1] - 1, '#5a3c22'); p.px(c[0], c[1] - 2, '#5a3c22');
          for (const [x, y, k] of [[-1, -3, 0], [0, -3, 1], [1, -3, 0], [-2, -4, 0], [-1, -4, 2], [0, -4, 1], [1, -4, 1], [2, -4, 0], [-1, -5, 2], [0, -5, 2], [1, -5, 1], [0, -6, 2]]) p.px(c[0] + x, c[1] + y, LEAF[k]);
        }
      }
      const f = p.P(1.5, 1.5, 24); // fuente en la cima
      for (const [x, y, c] of [[-2, 0, '#9a9488'], [-1, 0, '#5a9ad8'], [0, 0, '#7ab8ec'], [1, 0, '#5a9ad8'], [2, 0, '#9a9488'], [0, -1, '#bfe0ff'], [0, -2, '#7ab8ec'], [-1, -3, '#bfe0ff'], [1, -3, '#bfe0ff']]) p.px(f[0] + x, f[1] + y, c);
      p.flag(2.6, 0.4, 10, col, 12);
    },
    // Gran Archivo: templo de columnas sobre una escalinata, frontón de pizarra y una pequeña cúpula dorada.
    archive(p, col) {
      p.box(0, 0, 3, 3, 0, 3, 'stone', 'stone', 'paving');
      p.box(0.2, 0.2, 2.6, 2.6, 3, 5, 'marbleS', 'marbleS', 'marbleS');
      const b = { x: 0.45, y: 0.45, w: 2.1, h: 2.1 };
      p.box(b.x, b.y, b.w, b.h, 5, 24, 'plaster');
      for (let i = 0; i < 6; i++) { const u = 0.1 + i * 0.37; p.quad(b, 'L', u, u + 0.14, 5, 24, '#f2ece0'); p.quad(b, 'R', u, u + 0.14, 5, 24, '#c8c0b0'); }
      p.door(b, 'L', 1.05, 0.5, 11, 5);
      p.win(b, 'R', 0.6, 13, 0.28, 7); p.win(b, 'R', 1.5, 13, 0.28, 7);
      p.box(b.x - 0.08, b.y - 0.08, b.w + 0.16, b.h + 0.16, 24, 27, 'marbleS', 'marbleS', 'marbleS');
      p.roof(b.x, b.y, b.w, b.h, 27, 12, 'slate', 0.5, 0.12, 'y');
      p.box(1.2, 1.2, 0.6, 0.6, 33, 40, 'plaster');
      const r = p.roof(1.2, 1.2, 0.6, 0.6, 40, 9, 'gilt', 0.01, 0.06, 'x');
      p.flag(r[3][0], r[3][1], 49, col, 9);
    },
    // Coloso del Reino: una estatua de bronce sobre pedestal de mármol, con escudo del reino y antorcha encendida.
    colossus(p, col) {
      const BR = [176, 118, 62], BR2 = [124, 82, 44];
      p.box(0.1, 0.1, 1.8, 1.8, 0, 4, 'stone', 'stone', 'paving');
      p.box(0.4, 0.4, 1.2, 1.2, 4, 15, 'marbleS', 'marbleS', 'marbleS');
      p.box(0.35, 0.35, 1.3, 1.3, 15, 17, 'gilt', 'gilt', 'marbleS');
      p.box(0.6, 0.86, 0.3, 0.3, 17, 36, BR, BR2, BR); p.box(1.04, 0.86, 0.3, 0.3, 17, 36, BR, BR2, BR); // piernas
      p.box(0.56, 0.8, 0.82, 0.44, 34, 41, BR2, BR2, BR);                                                     // faldón
      p.box(0.54, 0.78, 0.86, 0.48, 41, 55, BR, BR2, BR);                                                     // torso
      p.box(0.46, 0.8, 1.02, 0.44, 52, 57, BR, BR2, BR);                                                      // hombros
      p.box(0.82, 0.86, 0.32, 0.3, 57, 65, BR, BR2, BR);                                                      // cabeza
      p.box(0.78, 0.82, 0.4, 0.38, 65, 67, 'gilt', 'gilt', 'gilt');                                            // corona
      p.box(1.36, 0.9, 0.2, 0.2, 50, 76, BR, BR2, BR);                                                        // brazo alzado
      p.box(0.4, 0.88, 0.18, 0.18, 40, 55, BR, BR2, BR);                                                      // brazo bajo
      p.box(0.2, 1.08, 0.38, 0.1, 34, 52, col, sc(col, 0.7), col);                                          // escudo del reino
      const sh = p.P(0.39, 1.18, 45); p.px(sh[0], sh[1], '#f0cc58'); p.px(sh[0] - 1, sh[1], '#f0cc58'); p.px(sh[0], sh[1] - 1, '#f0cc58');
      const t = p.P(1.46, 1.0, 78); // llama de la antorcha
      for (const [x, y, c] of [[0, 0, '#c84a1c'], [-1, -1, '#e8701e'], [0, -1, '#f0a030'], [1, -1, '#e8701e'], [0, -2, '#ffd060'], [-1, -2, '#f0a030'], [0, -3, '#fff0a0'], [1, -3, '#ffd060'], [0, -4, '#fff0a0']]) p.px(t[0] + x, t[1] + y, c);
    },
    // La Maravilla no tiene tope: cada 5 niveles suma una fase (obeliscos, columnata, linterna, anillo de luz,
    // torres de las esquinas y un halo).
    wonder(p, col, m, tier, lvl) {
      const ph = Math.min(6, Math.floor((lvl || 1) / 5));
      p.box(-0.1, -0.1, 4.2, 4.2, 0, 4, 'stone', 'stone', 'marbleS');
      if (ph >= 5) for (const [x, y] of [[0.0, 0.0], [3.45, 0.0], [0.0, 3.45]]) { p.box(x, y, 0.55, 0.55, 4, 40, 'marbleS'); p.roof(x, y, 0.55, 0.55, 40, 12, 'gilt', 0.01, 0.06, 'x'); }
      if (ph >= 1) for (const [x, y] of [[0.05, 1.85], [1.85, 0.05]]) { // obeliscos que asoman por detrás
        p.box(x, y, 0.3, 0.3, 4, 46, 'marbleS'); p.roof(x, y, 0.3, 0.3, 46, 6, 'gilt', 0.01, 0.02, 'x');
        const t = p.P(x + 0.15, y + 0.15, 53); p.px(t[0], t[1], GLINT);
      }
      p.box(0.3, 0.3, 3.4, 3.4, 4, 8, 'marbleS', 'marbleS', 'marbleS');
      const b = { x: 0.6, y: 0.6, w: 2.8, h: 2.8 };
      p.box(b.x, b.y, b.w, b.h, 8, 30, 'marbleS');
      for (let i = 0; i < 6; i++) { const u = 0.25 + i * 0.47; p.quad(b, 'L', u, u + 0.12, 8, 30, '#b8b2a2'); p.quad(b, 'R', u, u + 0.12, 8, 30, '#9a9486'); }
      p.door(b, 'L', 1.4, 0.6, 14, 8);
      p.box(b.x, b.y, b.w, b.h, 30, 34, 'gilt', 'gilt', 'marbleS');
      const d = { x: 1.2, y: 1.2, w: 1.6, h: 1.6 };
      p.box(d.x, d.y, d.w, d.h, 34, 50, 'marbleS');
      if (ph >= 2) { // columnata alrededor del tambor
        for (let i = 0; i < 4; i++) { const u = 1.0 + i * 0.6; p.box(u, 3.0, 0.14, 0.14, 34, 47, 'marbleS'); p.box(3.0, u, 0.14, 0.14, 34, 47, 'marbleS'); }
        p.box(0.95, 2.95, 2.2, 0.24, 47, 50, 'gilt', 'gilt', 'marbleS'); p.box(2.95, 0.95, 0.24, 2.2, 47, 50, 'gilt', 'gilt', 'marbleS');
      }
      p.roof(d.x, d.y, d.w, d.h, 50, 22, 'gilt', 0.01, 0.15, 'x');
      let fz = 72;
      if (ph >= 3) { p.box(1.85, 1.85, 0.3, 0.3, 70, 80, 'marbleS'); p.roof(1.85, 1.85, 0.3, 0.3, 80, 8, 'gilt', 0.01, 0.04, 'x'); fz = 88; }
      if (ph >= 4) { // anillo de luz alrededor de la cúpula
        const c = p.P(2.0, 2.0, 58);
        for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2, x = c[0] + Math.cos(t) * 30, y = c[1] + Math.sin(t) * 11; if (Math.sin(t) > -0.2 || a % 2) p.px(x, y, a % 3 ? GOLD : GLINT); }
      }
      if (ph >= 6) { const t = p.P(2.0, 2.0, fz + 18); for (const [dx, dy] of [[0, -4], [-3, -2], [3, -2], [-4, 1], [4, 1], [0, -7]]) p.px(t[0] + dx, t[1] + dy, GLINT); }
      p.flag(2.0, 2.0, fz, col, 14);
    },
  };
  // Puntos de interés de la exploración (s: 0 sin tocar, 1 resuelto).
  const PDRAW = {
    // ---------- Mazmorras ----------
    cave(p) {
      p.fill([p.P(0, 0, 0), p.P(2, 0, 0), p.P(2, 2, 0), p.P(0, 2, 0)], 'soil', 0.75, 0.3);
      p.box(0.1, 0.1, 1.8, 1.0, 0, 12, 'rock', 'rock', 'rock');
      p.box(0.1, 0.1, 0.9, 1.7, 0, 9, 'rock', 'rock', 'rock');
      p.box(0.4, 0.3, 1.0, 0.6, 12, 18, 'rock', 'rock', 'rock');
      p.quad({ x: 0.1, y: 0.1, w: 1.8, h: 1.0 }, 'L', 1.05, 1.65, 0, 8, '#0e0a10');
      // cristales que asoman
      for (const [x, y, z, h] of [[1.75, 1.2, 0, 10], [1.2, 1.75, 0, 7], [0.6, 0.4, 18, 8], [1.55, 1.45, 0, 6]]) {
        const s = p.P(x, y, z);
        p.fill([[s[0], s[1] - h], [s[0] + 3, s[1] - 2], [s[0], s[1] + 1], [s[0] - 3, s[1] - 2]], '#8ae0f0');
        p.fill([[s[0], s[1] - h], [s[0] + 3, s[1] - 2], [s[0], s[1] + 1]], '#3a9ac0');
      }
    },
    lair(p) {
      p.fill([p.P(0, 0, 0), p.P(2, 0, 0), p.P(2, 2, 0), p.P(0, 2, 0)], 'soil', 0.8, 0.3);
      p.box(0.15, 0.1, 1.7, 1.1, 0, 11, 'rock', 'rock', '#5a6a3a');
      p.box(0.1, 0.15, 1.0, 1.6, 0, 8, 'rock', 'rock', '#5a6a3a');
      p.quad({ x: 0.15, y: 0.1, w: 1.7, h: 1.1 }, 'L', 0.95, 1.55, 0, 7, '#100a08');
      const e = p.wp({ x: 0.15, y: 0.1, w: 1.7, h: 1.1 }, 'L', 1.25, 4); p.px(e[0] - 1, e[1], '#ffcc40'); p.px(e[0] + 2, e[1] + 1, '#ffcc40');
      // huesos en la entrada
      for (const [x, y] of [[1.3, 1.6], [1.7, 1.4], [0.9, 1.85]]) { const b = p.P(x, y, 0); p.line([b[0] - 3, b[1]], [b[0] + 3, b[1] - 1], '#e8e0cc'); p.px(b[0] - 3, b[1] - 1, '#e8e0cc'); p.px(b[0] + 3, b[1], '#e8e0cc'); }
      // marcas de garras
      for (let i = 0; i < 3; i++) { const c = p.wp({ x: 0.1, y: 0.15, w: 1.0, h: 1.6 }, 'R', 0.5 + i * 0.12, 6); p.line(c, [c[0] + 2, c[1] + 4], '#3a3430'); }
    },
    crypt(p) {
      p.fill([p.P(0, 0, 0), p.P(2, 0, 0), p.P(2, 2, 0), p.P(0, 2, 0)], '#4a5a3a', 1, 0);
      const b = { x: 0.3, y: 0.25, w: 1.3, h: 1.1 };
      p.box(b.x, b.y, b.w, b.h, 0, 15, 'stone');
      p.quad(b, 'L', 0.45, 0.85, 0, 10, '#0c0a10');
      p.roof(b.x, b.y, b.w, b.h, 15, 10, 'slate', 0.05, 0.1, 'x');
      const c = p.P(0.95, 0.8, 26); p.line(c, [c[0], c[1] - 7], '#9a968c'); p.line([c[0] - 2, c[1] - 5], [c[0] + 2, c[1] - 5], '#9a968c');
      // lápidas torcidas
      for (const [x, y, h] of [[0.2, 1.65, 5], [0.7, 1.75, 6], [1.45, 1.6, 4], [1.75, 1.0, 5]]) p.box(x, y, 0.2, 0.1, 0, h, 'stone', 'stone', 'stone');
      const f = p.wp(b, 'L', 0.65, 5); p.px(f[0], f[1], '#7affb0'); p.px(f[0] + 1, f[1] - 2, '#7affb0');
    },
    crater(p) {
      p.fill([p.P(0, 0, 0), p.P(3, 0, 0), p.P(3, 3, 0), p.P(0, 3, 0)], '#3a2e28', 1, 0);
      p.fill([p.P(0.6, 0.6, 0), p.P(2.4, 0.6, 0), p.P(2.4, 2.4, 0), p.P(0.6, 2.4, 0)], '#1e1a18', 1, 0);
      // borde de rocas levantadas
      for (let i = 0; i < 6; i++) {
        p.box(0.15 + i * 0.45, 0.1, 0.4, 0.35, 0, 4 + (i % 2) * 3, 'rock', 'rock', 'rock');
        p.box(0.1, 0.15 + i * 0.45, 0.35, 0.4, 0, 4 + ((i + 1) % 2) * 3, 'rock', 'rock', 'rock');
      }
      // la estrella caída: roca negra con vetas azules que brillan
      p.box(1.15, 1.15, 0.7, 0.7, 0, 8, '#2e3850', '#1e2638', '#5a6a8a');
      p.box(1.3, 1.3, 0.4, 0.4, 8, 12, '#2e3850', '#1e2638', '#a8c0e8');
      const s = p.P(1.5, 1.5, 12);
      for (const [dx, dy] of [[0, -6], [6, -2], [-7, 1], [3, 4], [-3, -9]]) p.px(s[0] + dx, s[1] + dy, '#e8f4ff');
      for (let i = 0; i < 4; i++) { p.box(2.6, 0.5 + i * 0.6, 0.35, 0.3, 0, 3 + (i % 2) * 2, 'rock', 'rock', 'rock'); p.box(0.5 + i * 0.6, 2.6, 0.3, 0.35, 0, 3 + ((i + 1) % 2) * 2, 'rock', 'rock', 'rock'); }
    },
    nest(p) {
      p.fill([p.P(0, 0, 0), p.P(3, 0, 0), p.P(3, 3, 0), p.P(0, 3, 0)], '#4a3a30', 1, 0);
      p.box(0.2, 0.2, 2.2, 1.4, 0, 20, 'rock', 'rock', 'rock');
      p.box(0.2, 0.2, 1.3, 2.3, 0, 14, 'rock', 'rock', 'rock');
      p.box(0.5, 0.4, 1.2, 0.8, 20, 36, 'rock', 'rock', 'rock');
      p.box(0.8, 0.55, 0.5, 0.4, 36, 46, 'rock', 'rock', 'rock');
      const b = { x: 0.2, y: 0.2, w: 2.2, h: 1.4 };
      p.quad(b, 'L', 1.25, 2.0, 0, 13, '#0a0606');
      const e = p.wp(b, 'L', 1.6, 8); p.px(e[0] - 2, e[1], '#ff3a20'); p.px(e[0] + 2, e[1] - 1, '#ff3a20'); p.px(e[0] - 2, e[1] + 1, '#8a1a10'); p.px(e[0] + 2, e[1], '#8a1a10');
      // montaña de oro y huesos
      p.box(1.6, 1.9, 0.9, 0.7, 0, 3, 'gilt', 'gilt', 'gilt');
      p.box(1.8, 2.05, 0.5, 0.4, 3, 6, 'gilt', 'gilt', 'gilt');
      const g = p.P(2.0, 2.2, 6); p.px(g[0], g[1], '#fff0a0'); p.px(g[0] + 4, g[1] + 2, '#fff0a0');
      for (const [x, y] of [[0.6, 2.7], [1.2, 2.8], [2.6, 1.7]]) { const o = p.P(x, y, 0); p.line([o[0] - 3, o[1]], [o[0] + 3, o[1] - 1], '#e8e0cc'); }
      p.line(p.P(0.6, 0.5, 46), p.P(0.4, 0.3, 54), '#5a5a5a'); p.line(p.P(0.7, 0.5, 46), p.P(0.6, 0.2, 56), '#6a6a6a');
    },
    chest(p, s) {
      p.box(0.25, 0.3, 0.5, 0.35, 0, 5, 'darkwood', 'darkwood', s ? '#2a1a0e' : 'plank');
      p.line(p.P(0.25, 0.65, 3), p.P(0.75, 0.65, 3), '#e8b83a');
      if (s) p.box(0.25, 0.25, 0.5, 0.08, 5, 10, 'plank', 'plank', 'plank');
      else { const c = p.P(0.5, 0.65, 4); p.px(c[0], c[1], '#ffe48a'); }
    },
    ruin(p, s) {
      p.fill([p.P(0, 0, 0), p.P(2, 0, 0), p.P(2, 2, 0), p.P(0, 2, 0)], s ? 'soil' : 'paving', 0.8, 0);
      p.box(0.1, 0.1, 1.8, 0.25, 0, s ? 4 : 14, 'stone'); p.box(0.1, 0.1, 0.25, 1.2, 0, s ? 3 : 10, 'stone');
      p.box(1.4, 0.35, 0.25, 0.25, 0, s ? 2 : 20, 'stone'); p.box(0.5, 1.5, 0.3, 0.3, 0, 4, 'stone', 'stone', 'stone');
      p.box(1.2, 1.3, 0.4, 0.3, 0, 3, 'rock', 'rock', 'rock');
      if (!s) { p.box(0.7, 0.6, 0.25, 0.25, 0, 24, 'stone'); p.box(0.6, 0.5, 0.45, 0.45, 24, 27, 'stone', 'stone', 'paving'); }
    },
    camp(p, s) {
      p.fill([p.P(0, 0, 0), p.P(3, 0, 0), p.P(3, 3, 0), p.P(0, 3, 0)], 'soil', s ? 0.6 : 0.85, 0.5);
      if (s) { for (const [x, y] of [[0.8, 0.8], [1.9, 1.2], [1.0, 2.0]]) p.box(x, y, 0.5, 0.4, 0, 2, '#2a2420', '#1a1614', '#3a3028'); return; }
      for (let i = 0; i <= 9; i++) { p.post(i * 0.33, 0, 9); p.post(0, i * 0.33, 9); }
      const tent = (x, y, mat) => p.roof(x, y, 0.9, 0.8, 0, 13, mat, 0.6, 0, 'x');
      tent(0.4, 0.5, 'canvasR'); tent(1.7, 0.6, '#6a5a44'); tent(0.6, 1.8, '#6a5a44');
      p.box(1.75, 1.75, 0.3, 0.3, 0, 2, '#3a2a1a', '#2a1a10', '#ff7a2a');
      p.post(2.6, 2.4, 20);
      const f = p.P(2.6, 2.4, 20);
      p.ctx.fillStyle = '#1a1a1a'; p.ctx.fillRect(f[0] + 1, f[1], 7, 4);
      p.ctx.fillStyle = '#c03028'; p.ctx.fillRect(f[0] + 3, f[1] + 1, 3, 2);
    },
    relic(p, s) {
      p.box(0.15, 0.15, 0.7, 0.7, 0, 3, 'stone', 'stone', 'paving');
      p.box(0.3, 0.3, 0.4, 0.4, 3, 9, 'stone', 'stone', 'stone');
      p.post(0.2, 0.2, 14); p.post(0.75, 0.75, 14);
      if (!s) {
        const c = p.P(0.5, 0.5, 12);
        p.ctx.fillStyle = '#ffe070'; p.ctx.fillRect(c[0] - 1, c[1] - 2, 3, 3);
        p.ctx.fillStyle = '#fff6c0'; p.ctx.fillRect(c[0], c[1] - 3, 1, 1);
      }
    },
    watch(p) {
      const b = { x: 0.15, y: 0.15, w: 0.7, h: 0.7 };
      p.box(b.x, b.y, b.w, b.h, 0, 30, 'stone');
      p.box(b.x, b.y, 0.25, b.h, 30, 38, 'stone'); p.box(b.x, b.y, b.w, 0.2, 30, 34, 'stone');
      p.quad(b, 'L', 0.3, 0.42, 14, 20, '#141018');
      p.box(0.7, 0.75, 0.3, 0.25, 0, 3, 'rock', 'rock', 'rock');
    },
  };
  const PTOP = { chest: 14, ruin: 34, camp: 30, relic: 22, watch: 46, cave: 30, lair: 26, crypt: 36, crater: 24, nest: 60 };

  const BTOP = { tc: 68, house: 32, lumber: 24, mining: 24, mill: 38, farm: 8, market: 22, sawmill: 34, cartwright: 32, tavern: 48, wishwell: 34, arena: 30, beasthouse: 34, observatory: 70, sanctum: 50, runeforge: 46, dragontower: 92, library: 42, barracks: 36, tower: 58, guild: 52, masonry: 24, smelter: 50, forge: 36, university: 60, granary: 34, warehouse: 36, builder: 30, scout: 46, scriptorium: 34, monastery: 62, steelworks: 52, workshop: 40, wonder: 92, gardens: 46, archive: 62, colossus: 84 };
  // Tramos de nivel: 1-3, 4-6, 7-9, 10-12, 13-15, 16-19 y 20+ (cada era sube 2 niveles el tope).
  S.tier = lvl => (lvl >= 20 ? 6 : lvl >= 16 ? 5 : lvl >= 13 ? 4 : lvl >= 10 ? 3 : lvl >= 7 ? 2 : lvl >= 4 ? 1 : 0);
  // Alto extra del lienzo cuando el edificio crece (campanario, linterna, chapitel, pendones, fases de la Maravilla).
  const TALL = { library: 10, tower: 12, wonder: 0 };
  const wonderPhase = lvl => Math.min(6, Math.floor((lvl || 1) / 5));
  S.btop = (type, lvl) => {
    const t = S.tier(lvl || 1);
    return (BTOP[type] || 40) + (t >= 3 ? 7 + (TALL[type] || 0) : t >= 2 ? 5 : 0) +(type === 'wonder' ? wonderPhase(lvl) * 4 + (wonderPhase(lvl) >= 3 ? 14 : 0) : 0);
  };
  const bkey = (type, lvl) => S.tier(lvl || 1) + (type === 'wonder' ? '.' + wonderPhase(lvl) : '');

  S.ownerColor = function (owner) {
    if (owner === 'p') return D.PLAYER_COLOR;
    const b = D.BOTS.find(x => x.id === owner);
    return b ? b.color : [150, 150, 150];
  };

  const BCACHE = {};
  function isoSprite(w, h, top, flat, draw, tier, deco) {
    const MX = 10, cw = (w + h) * 16 + MX * 2, ch = (w + h) * 8 + top + 6;
    const c = mk(cw, ch), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const ox = h * 16 + MX, oy = top;
    const p = painter(ctx, ox, oy, tier), meta = { smoke: [], hub: null };
    draw(p, meta);
    if (deco && !flat) adorn(p, w, h, deco, tier || 0);
    const im = ctx.getImageData(0, 0, cw, ch), d = im.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
    ctx.putImageData(im, 0, 0);
    if (!flat) {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = 'rgba(8,14,4,0.34)';
      const s = [p.P(0.2, 0, 0), p.P(w + 0.45, -0.25, 0), p.P(w + 0.45, h + 0.15, 0), p.P(0.2, h + 0.1, 0)];
      ctx.beginPath(); ctx.moveTo(s[0][0] + 5, s[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(s[i][0] + 5, s[i][1]); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    return withMask({ c, ox, oy, smoke: meta.smoke, hub: meta.hub, tier: tier || 0 });
  }
  S.building = function (type, owner, lvl) {
    const tier = S.tier(lvl || 1), key = type + '|' + owner + '|' + bkey(type, lvl);
    if (BCACHE[key]) return BCACHE[key];
    const def = D.BUILD[type], col = S.ownerColor(owner);
    const spr = isoSprite(def.w, def.h, S.btop(type, lvl), def.flat, (p, meta) => BDRAW[type](p, col, meta, tier, lvl || 1), tier, col);
    spr.pad = S.btop(type, lvl) - (BTOP[type] || 40); // alto extra arriba (las barras se dibujan donde antes)
    return (BCACHE[key] = spr);
  };

  // Suelo alrededor de los edificios según la era del reino: tierra pisada (II), grava (III-IV), adoquín (V-VII)
  // y losas de mármol con ribete de oro (VIII+). Plano, con el borde tramado para que se funda con el pasto.
  const APRONC = {};
  S.apronStyle = era => (era >= 8 ? 4 : era >= 5 ? 3 : era >= 3 ? 2 : era >= 2 ? 1 : 0);
  S.apron = function (w, h, style) {
    const key = w + 'x' + h + '|' + style;
    if (APRONC[key]) return APRONC[key];
    const m = 0.6, W2 = w + 2 * m, H2 = h + 2 * m, cw = Math.ceil((W2 + H2) * 16) + 2, ch = Math.ceil((W2 + H2) * 8) + 2;
    const ox = Math.round(H2 * 16) + 1, oy = 1, pb = new PB(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const sx = x + 0.5 - ox, sy = y + 0.5 - oy, u = (sx / 16 + sy / 8) / 2, v = (sy / 8 - sx / 16) / 2;
      if (u < 0 || v < 0 || u > W2 || v > H2) continue;
      const e = Math.min(u, v, W2 - u, H2 - v), hh = U.hash(x, y, 31);
      if (e < 0.3 && hh > e / 0.3) continue; // borde tramado
      let c;
      if (style === 1) { c = sc([146, 116, 76], 0.9 + hh * 0.12); if (hh > 0.975) c = [176, 150, 112]; }
      else if (style === 2) c = sc([150, 144, 130], 0.8 + U.hash(x >> 1, y, 5) * 0.32);
      else {
        const k = style === 4 ? 2 : 4, row = Math.floor(v * k), col = Math.floor(u * k + (row & 1) * 0.5);
        const fu = u * k + (row & 1) * 0.5 - col, fv = v * k - row, mortar = fu < 0.1 || fv < 0.12;
        const base = style === 4 ? [224, 220, 208] : [160, 152, 136];
        c = mortar ? sc(base, 0.7) : sc(base, 0.9 + U.hash(col, row, 13) * 0.18 + hh * 0.04);
        if (style === 4 && e < 0.46 && e > 0.36) c = [214, 170, 64];
      }
      pb.set(x, y, c, style === 1 ? 200 : 235);
    }
    return (APRONC[key] = { c: pb.canvas(), ox, oy: oy + Math.round(16 * m) });
  };
  // Murallas. mask: 1 = sigue hacia -y, 2 = +x, 4 = +y, 8 = -x. Se dibujan con los mismos bloques que los
  // edificios: estacas de troncos, piedra, sillares con almenas o bastión de pizarra.
  const WALLC = {};
  S.wall = function (mask, tier, gate, col) {
    const key = mask + '|' + tier + '|' + (gate ? 1 : 0) + '|' + col;
    if (WALLC[key]) return WALLC[key];
    const H = [0, 12, 12, 15, 19][tier], mat = ['', 'bark', 'stone', 'paving', 'slate'][tier], top = ['', 'logend', 'paving', 'marbleS', 'paving'][tier];
    return (WALLC[key] = isoSprite(1, 1, 34, false, p => {
      const t = 0.36, a = (1 - t) / 2;
      if (gate) {
        const alongX = (mask & 10) || !(mask & 5);
        const posts = alongX ? [[0, a], [0.72, a]] : [[a, 0], [a, 0.72]];
        const pm = tier === 1 ? 'darkwood' : mat;
        p.box(posts[0][0], posts[0][1], alongX ? 0.28 : t, alongX ? t : 0.28, 0, H + 6, pm, pm, top);
        if (alongX) p.box(0.28, a + 0.06, 0.44, t - 0.12, 0, H - 2, 'darkwood', 'darkwood', 'plank');
        else p.box(a + 0.06, 0.28, t - 0.12, 0.44, 0, H - 2, 'darkwood', 'darkwood', 'plank');
        if (alongX) p.box(0.2, a, 0.6, t, H - 2, H + 2, pm, pm, top); else p.box(a, 0.2, t, 0.6, H - 2, H + 2, pm, pm, top);
        p.box(posts[1][0], posts[1][1], alongX ? 0.28 : t, alongX ? t : 0.28, 0, H + 6, pm, pm, top);
        const f = p.P(0.5, 0.5, H + 2);
        p.ctx.fillStyle = rgb(col); p.ctx.fillRect(f[0] - 1, f[1] - 2, 3, 4);
        p.ctx.fillStyle = '#e8b83a'; p.ctx.fillRect(f[0], f[1] - 1, 1, 1);
        return;
      }
      const segs = [];
      if (mask & 1) segs.push([a, 0, t, 0.5 - a]);
      if (mask & 8) segs.push([0, a, 0.5 - a, t]);
      segs.push([a, a, t, t, true]);
      if (mask & 2) segs.push([0.5 + t / 2, a, 0.5 - t / 2, t]);
      if (mask & 4) segs.push([a, 0.5 + t / 2, t, 0.5 - t / 2]);
      for (const [x, y, w, h, post] of segs) {
        if (tier === 1) {
          // empalizada: estacas de troncos de altura despareja
          const alongX = w >= h, n = Math.max(1, Math.round((alongX ? w : h) / 0.16));
          for (let i = 0; i < n; i++) {
            const sx = alongX ? x + (i * w) / n : x + 0.1, sy = alongX ? y + 0.1 : y + (i * h) / n;
            p.box(sx, sy, 0.15, 0.15, 0, H + (post ? 3 : 0) + ((i + Math.round(x * 7 + y * 3)) % 2 ? 1 : -1), 'bark', 'bark', 'logend');
          }
          continue;
        }
        p.box(x, y, w, h, 0, post ? H + 3 : H, mat, mat, top);
        if (tier >= 3) { // almenas
          const alongX = w >= h, n = Math.max(1, Math.floor((alongX ? w : h) / 0.2));
          for (let i = 0; i < n; i += 2) {
            const mx = alongX ? x + i * 0.2 : x, my = alongX ? y : y + i * 0.2;
            p.box(mx, my, alongX ? 0.12 : w, alongX ? h : 0.12, post ? H + 3 : H, (post ? H + 3 : H) + 3, mat, mat, top);
          }
        }
        if (tier === 4 && post) p.flag(0.5, 0.5, H + 6, col, 9);
      }
    }));
  };

  S.poi = function (kind, solved) {
    const key = 'poi|' + kind + '|' + (solved ? 1 : 0);
    if (BCACHE[key]) return BCACHE[key];
    const def = D.POI[kind];
    return (BCACHE[key] = isoSprite(def.w, def.h, PTOP[kind], false, p => PDRAW[kind](p, solved ? 1 : 0)));
  };

  // ---------- Obras en construcción y andamios ----------
  // Las obras tienen 3 etapas (0 cimientos, 1 estructura, 2 terminaciones) en un lienzo del mismo tamaño que el
  // edificio terminado. Las etapas 1 y 2 parten de la silueta del propio edificio: lo ya levantado se copia tal cual
  // (con el canto de arriba iluminado) y lo que falta se cambia por vigas o listones, columna por columna.
  const SW = { l: [150, 106, 66], m: [122, 86, 52], d: [86, 58, 36], k: [52, 34, 20], rope: [216, 196, 154] };
  // poste de 2 px: lado iluminado a la izquierda, sombra a la derecha
  function pole(p, a, b) { p.line(a, b, rgb(SW.l)); p.line([a[0] + 1, a[1]], [b[0] + 1, b[1]], rgb(SW.d)); }
  function stake(p, x, y) {
    const a = p.P(x, y, 0), b = p.P(x, y, 8);
    pole(p, a, b); p.px(b[0], b[1] - 1, rgb(MAT.logend)); p.px(b[0] + 1, b[1] - 1, rgb(sc(MAT.logend, 0.8)));
  }
  // Por columna: píxel más bajo y más alto del edificio, alto máximo y la columna de la esquina del frente.
  function silhouette(spr) {
    if (spr.sil) return spr.sil;
    const w = spr.c.width, h = spr.c.height, m = spr.mask, bot = new Int16Array(w).fill(-1), top = new Int16Array(w).fill(-1);
    let H = 0, fx = 0;
    for (let x = 0; x < w; x++) {
      for (let y = h - 1; y >= 0; y--) if (m[y * w + x]) { if (bot[x] < 0) bot[x] = y; top[x] = y; }
      if (bot[x] >= 0) { H = Math.max(H, bot[x] - top[x] + 1); if (bot[x] > bot[fx]) fx = x; }
    }
    return (spr.sil = { w, h, bot, top, H, fx });
  }
  // solid: alto (px) de lo ya levantado. rest: 'frame' (armazón: postes, vigas y riostras cada 6 px) o
  // 'lath' (techo sin terminar: cabios y listones cada 3 px).
  function siteBody(spr, solid, rest) {
    const si = silhouette(spr), W = si.w, H = si.h, m = spr.mask, pb = new PB(W, H);
    const src = spr.c.getContext('2d').getImageData(0, 0, W, H).data;
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
    const lath = rest === 'lath', st = lath ? 3 : 6, base = si.bot[si.fx];
    for (let x = 0; x < W; x++) {
      if (si.bot[x] < 0) continue;
      const u = x - si.fx, uu = ((u % st) + st) % st, tall = si.bot[x] - si.top[x] >= solid;
      for (let y = si.top[x]; y <= si.bot[x]; y++) {
        if (!on(x, y)) continue;
        const z = si.bot[x] - y, i = (y * W + x) * 4, col = [src[i], src[i + 1], src[i + 2]];
        if (z < solid) { pb.set(x, y, tall && z === solid - 1 ? mix(col, [255, 240, 205], 0.35) : col); continue; }
        // altura "ideal" sobre la base isométrica, para que las vigas corran paralelas a los muros
        const zz = Math.floor(base - Math.abs(u) / 2 - y), zm = ((zz % st) + st) % st;
        const edge = !on(x, y - 1) || !on(x - 1, y) || !on(x + 1, y);
        let c = null;
        if (lath) c = uu === 0 || edge ? SW.d : zm === 0 ? SW.l : null;
        else {
          const bi = Math.floor(u / st), bj = Math.floor(zz / st);
          if (uu === 0) c = SW.l; else if (uu === 1) c = SW.d;
          else if (zm === 1) c = SW.l; else if (zm === 0) c = SW.m;
          else if ((bi + bj) % 3 === 0 && zm === uu) c = SW.d;
          else if (edge) c = SW.m;
        }
        if (c) pb.set(x, y, c);
      }
    }
    return pb.canvas();
  }
  // Tramo de andamio junto a un muro. axis 'x': corre en x pegado a y = c (muro del frente izquierdo);
  // axis 'y': corre en y pegado a x = c (muro del frente derecho). Postes de a pares, tablones por piso,
  // riostras en cruz por fuera, baranda y escalera opcional.
  function scafRun(p, axis, a0, a1, c, zTop, ladder) {
    const d = 0.22, n = Math.max(1, Math.round((a1 - a0) / 0.7)), us = [];
    for (let i = 0; i <= n; i++) us.push(a0 + ((a1 - a0) * i) / n);
    const Q = (u, o, z) => (axis === 'x' ? p.P(u, c + o, z) : p.P(c + o, u, z));
    const lv = [];
    for (let z = 8; z < zTop - 4; z += 8) lv.push(z);
    lv.push(zTop);
    for (const u of us) pole(p, Q(u, 0, 0), Q(u, 0, zTop + 4));
    for (const z of lv) {
      if (axis === 'x') p.box(a0 - 0.06, c, a1 - a0 + 0.12, d, z - 2, z, 'plank', 'darkwood', 'plank');
      else p.box(c, a0 - 0.06, d, a1 - a0 + 0.12, z - 2, z, 'darkwood', 'plank', 'plank');
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < lv.length; k++) {
      const za = k ? lv[k - 1] : 0, zb = lv[k] - 2;
      p.line(Q(us[i], d, za), Q(us[i + 1], d, zb), rgb(SW.k));
      if ((i + k) % 2 === 0) p.line(Q(us[i], d, zb), Q(us[i + 1], d, za), rgb(SW.k));
    }
    p.line(Q(a0, d, zTop + 4), Q(a1, d, zTop + 4), rgb(SW.l));
    for (const u of us) pole(p, Q(u, d, 0), Q(u, d, zTop + 5));
    if (ladder) {
      const ua = us[n] - 0.34, ub = ua + 0.2, o = d + 0.07, zt = zTop + 3;
      p.line(Q(ua, o, 0), Q(ua, o, zt), rgb(SW.m)); p.line(Q(ub, o, 0), Q(ub, o, zt), rgb(SW.d));
      for (let z = 2; z < zt; z += 3) p.line(Q(ua, o, z), Q(ub, o, z), rgb(SW.l));
    }
  }
  function siteFoundation(p, bx, by, bw, bh) {
    const s = 0.26, back = [], front = [];
    const edge = (arr, x0, y0, dx, dy, len, frac) => {
      const n = Math.max(1, Math.round(len / 0.34));
      for (let k = 0; k < Math.ceil(n * frac); k++) arr.push([x0 + (dx * k * len) / n, y0 + (dy * k * len) / n]);
    };
    edge(back, bx, by, 1, 0, bw, 1); edge(back, bx, by + s, 0, 1, bh - s, 1);
    edge(front, bx + s, by + bh - s, 1, 0, bw - s, 0.6); edge(front, bx + bw - s, by + s, 0, 1, bh - 2 * s, 0.45);
    const lay = arr => {
      arr.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
      for (const [x, y] of arr) p.box(x, y, s, s, 0, U.hash(Math.round(x * 10), Math.round(y * 10), 5) > 0.55 ? 3 : 2, 'stone', 'stone', 'paving');
    };
    stake(p, bx - 0.05, by - 0.05);
    lay(back);
    // materiales dentro de la obra: tablones apilados y piedras
    const k = Math.min(1, Math.min(bw, bh) / 1.6);
    if (bw >= 1.2) {
      const px = bx + 0.3, py = by + bh * 0.42;
      for (let r = 0; r < 3; r++) for (let j = 0; j < 3 - r; j++) p.box(px, py + j * 0.2 + r * 0.1, 0.95 * k, 0.18, r * 2, r * 2 + 2, 'plank', 'logend', 'plank');
    }
    if (bw >= 1.5 && bh >= 1.5) rockPile(p, bx + bw * 0.55, by + bh * 0.18, ['stone', 'paving', 'stone']);
    else p.box(bx + bw * 0.4, by + bh * 0.3, 0.24, 0.24, 0, 3, 'stone', 'stone', 'paving');
    lay(front);
    stake(p, bx + bw + 0.07, by - 0.05); stake(p, bx - 0.05, by + bh + 0.07);
    const c = [[bx - 0.05, by - 0.05], [bx + bw + 0.07, by - 0.05], [bx + bw + 0.07, by + bh + 0.07], [bx - 0.05, by + bh + 0.07]];
    for (let i = 0; i < 4; i++) p.line(p.P(c[i][0], c[i][1], 6), p.P(c[(i + 1) % 4][0], c[(i + 1) % 4][1], 6), rgb(SW.rope));
    stake(p, bx + bw + 0.07, by + bh + 0.07);
  }
  const SITEC = {};
  S.site = function (type, owner, lvl, stage) {
    const tier = S.tier(lvl || 1), key = type + '|' + owner + '|' + bkey(type, lvl) + '|' + stage;
    if (SITEC[key]) return SITEC[key];
    const def = D.BUILD[type], w = def.w, h = def.h, bspr = S.building(type, owner, lvl), si = silhouette(bspr);
    const body = stage ? siteBody(bspr, Math.round(si.H * (stage === 1 ? 0.38 : 0.7)), stage === 1 ? 'frame' : 'lath') : null;
    const i = Math.min(0.2, w * 0.15), bx = i, by = i, bw = w - 2 * i, bh = h - 2 * i;
    const zt = Math.max(8, Math.min(44, Math.round(si.H * 0.55)));
    return (SITEC[key] = isoSprite(w, h, S.btop(type, lvl), stage === 0 || def.flat, p => {
      p.fill([p.P(0.05, 0.05, 0), p.P(w - 0.05, 0.05, 0), p.P(w - 0.05, h - 0.05, 0), p.P(0.05, h - 0.05, 0)], 'soil', 0.9, 0.5);
      if (stage === 0) {
        p.fill([p.P(bx, by, 0), p.P(bx + bw, by, 0), p.P(bx + bw, by + bh, 0), p.P(bx, by + bh, 0)], 'soil', 0.68, 0.5);
        siteFoundation(p, bx, by, bw, bh);
        return;
      }
      p.ctx.drawImage(body, 0, 0);
      if (def.flat) return;
      if (stage === 1) scafRun(p, 'x', 0.15, w - 0.15, h - 0.1, zt, true);
      else {
        scafRun(p, 'y', h * 0.45, h - 0.4, w - 0.1, Math.max(8, Math.round(zt * 0.75)), false);
        if (w >= 2) { p.box(0.2, h - 0.42, 0.34, 0.26, 0, 2, 'tile', 'tile', 'tile'); p.box(0.24, h - 0.4, 0.26, 0.2, 2, 4, 'tile', 'tile', 'tile'); }
      }
    }, tier));
  };
  // Andamio de mejora (se dibuja delante del edificio terminado). hub = [x, y de la polea, y del suelo] para el balde.
  const SCAFC = {};
  S.scaffold = function (type) {
    if (SCAFC[type]) return SCAFC[type];
    const def = D.BUILD[type], w = def.w, h = def.h, si = silhouette(S.building(type, 'p', 1));
    const zt = Math.max(8, Math.min(44, Math.round(si.H * 0.5)));
    return (SCAFC[type] = isoSprite(w, h, BTOP[type] || 40, true, (p, m) => {
      const ay = h * 0.42, bx = w + 0.12, tip = w + 0.5, zb = zt + 7;
      scafRun(p, 'y', ay, h - 0.4, w - 0.1, zt, false);
      // brazo de la polea con su tornapunta
      pole(p, p.P(bx, ay, zt), p.P(bx, ay, zb + 1));
      p.line(p.P(bx, ay, zb), p.P(tip, ay, zb), rgb(SW.l)); p.line(p.P(bx, ay, zb - 1), p.P(tip, ay, zb - 1), rgb(SW.d));
      p.line(p.P(bx, ay, zb - 7), p.P(tip - 0.2, ay, zb - 2), rgb(SW.k));
      const hub = p.P(tip, ay, zb - 3);
      m.hub = [hub[0], hub[1], p.P(tip, ay, 0)[1]];
      scafRun(p, 'x', 0.15, w - 0.15, h - 0.1, zt, true);
    }));
  };
  // Balde de madera con zuncho de hierro (5x5).
  let BUCKET = null;
  S.bucket = function () {
    if (BUCKET) return BUCKET;
    const rows = ['..k..', '.k.k.', 'lmmmd', 'iiiij', '.lmd.'], C = { k: SW.k, l: SW.l, m: SW.m, d: SW.d, i: [150, 150, 158], j: [96, 96, 106] }, pb = new PB(5, 5);
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (C[ch]) pb.set(x, y, C[ch]); }));
    return (BUCKET = pb.canvas());
  };

  // ---------- Árboles y recursos ----------
  const OAK = [[24, 44, 20], [34, 60, 25], [47, 79, 31], [64, 100, 38], [88, 126, 50], [120, 152, 66]];
  const PINE = [[16, 36, 26], [24, 52, 34], [35, 70, 44], [50, 92, 56], [74, 118, 70]];
  const AUT = [[60, 40, 18], [96, 60, 22], [140, 84, 28], [180, 116, 38], [214, 156, 60]];

  function makeOak(seed, palette) {
    const r = U.rng(seed), w = 28, h = 34, pb = new PB(w, h), cx = 14, base = 31;
    ellipseShadow(pb, cx + 4, base - 1, 10, 3, 80);
    for (let y = base - 11; y <= base; y++) { pb.set(cx - 1, y, [120, 88, 58]); pb.set(cx, y, [92, 64, 40]); pb.set(cx + 1, y, [64, 42, 26]); }
    pb.set(cx - 2, base, [96, 68, 44]); pb.set(cx + 2, base, [64, 42, 26]);
    const cy = 13, blobs = [{ x: cx, y: cy, r: 8.5 + r() }];
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2, dd = 4 + r() * 3.5;
      blobs.push({ x: cx + Math.cos(a) * dd, y: cy + Math.sin(a) * dd * 0.72 - 1, r: 3.4 + r() * 2.6 });
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = -99, bn = null;
      for (const b of blobs) {
        const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / b.r, d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2), zt = nz * b.r + (b.y - cy) * 0.35;
        if (zt > best) { best = zt; bn = [dx, dy, nz]; }
      }
      if (!bn) continue;
      if (bn[2] < 0.3 && U.hash(x, y, seed) > 0.5) continue;
      let l = (bn[0] * LIGHT[0] + bn[1] * LIGHT[1] + bn[2] * LIGHT[2]) * 0.5 + 0.5;
      l += (U.noise(x * 0.7, y * 0.7, seed) - 0.5) * 0.34 + (U.hash(x, y, seed + 1) - 0.5) * 0.12;
      l -= Math.max(0, (y - cy) / 16) * 0.2;
      pb.set(x, y, ramp(palette || OAK, l));
    }
    return withMask({ c: pb.canvas(), ax: cx, ay: base - 1 });
  }

  function makePine(seed) {
    const r = U.rng(seed), w = 22, h = 38, pb = new PB(w, h), cx = 11, base = 35;
    ellipseShadow(pb, cx + 3, base - 1, 7, 2, 80);
    for (let y = base - 7; y <= base; y++) { pb.set(cx - 1, y, [104, 74, 48]); pb.set(cx, y, [72, 50, 32]); }
    const layers = 4 + (r() < 0.5 ? 1 : 0), topY = 2 + Math.floor(r() * 3), botY = base - 4;
    for (let y = topY; y <= botY; y++) {
      const t = (y - topY) / (botY - topY), li = Math.min(layers - 1, Math.floor(t * layers)), lt = t * layers - li;
      const hw = (1.4 + t * 7.6) * (0.5 + lt * 0.5);
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - cx, jag = (U.hash(x, y, seed) - 0.5) * 1.8;
        if (Math.abs(dx) > hw + jag) continue;
        let l = 0.6 - (dx / (hw + 0.6)) * 0.34 + (lt - 0.5) * 0.3 + (U.hash(x, y, seed + 3) - 0.5) * 0.18;
        if (lt < 0.15) l -= 0.15;
        pb.set(x, y, ramp(PINE, l));
      }
    }
    return withMask({ c: pb.canvas(), ax: cx, ay: base - 1 });
  }

  function makeStump() {
    const pb = new PB(10, 8);
    ellipseShadow(pb, 6, 5, 4, 1, 60);
    for (let x = 2; x <= 7; x++) for (let y = 2; y <= 5; y++) pb.set(x, y, x < 4 ? [110, 78, 50] : x > 5 ? [62, 42, 26] : [88, 60, 38]);
    for (let x = 2; x <= 7; x++) pb.set(x, 2, [190, 154, 100]);
    pb.set(4, 2, [150, 112, 70]); pb.set(5, 2, [150, 112, 70]);
    return { c: pb.canvas(), ax: 5, ay: 5 };
  }

  function makeBush(seed, berries) {
    const r = U.rng(seed), w = 18, h = 14, pb = new PB(w, h), cx = 9, base = 11;
    ellipseShadow(pb, cx + 2, base, 7, 2, 70);
    const blobs = [{ x: cx, y: 7, r: 5.5 }, { x: cx - 3.5, y: 8, r: 3.6 }, { x: cx + 3.5, y: 8, r: 3.6 }, { x: cx + (r() - 0.5) * 3, y: 5, r: 3.4 }];
    const R = berries ? OAK : [[60, 58, 34], [84, 80, 44], [110, 104, 56], [136, 128, 70]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = -99, bn = null;
      for (const b of blobs) {
        const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / b.r, d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2), zt = nz * b.r + b.y * 0.3;
        if (zt > best) { best = zt; bn = [dx, dy, nz]; }
      }
      if (!bn) continue;
      let l = (bn[0] * LIGHT[0] + bn[1] * LIGHT[1] + bn[2] * LIGHT[2]) * 0.5 + 0.5 + (U.hash(x, y, seed) - 0.5) * 0.25;
      pb.set(x, y, ramp(R, l));
      if (berries && U.hash(x, y, seed + 5) > 0.84 && bn[2] > 0.3) {
        pb.set(x, y, [178, 30, 52]);
        if (bn[0] < 0) pb.set(x, y, [226, 70, 90]);
      }
    }
    return withMask({ c: pb.canvas(), ax: cx, ay: base });
  }

  const ROCK = {
    stone: { r: [[52, 52, 54], [80, 78, 76], [108, 104, 98], [138, 134, 126], [170, 166, 156], [202, 198, 186]] },
    gold: { r: [[56, 48, 38], [86, 74, 56], [116, 102, 76], [146, 130, 96], [176, 160, 120]], m: [[150, 106, 20], [206, 158, 38], [242, 204, 78], [255, 242, 170]] },
    ore: { r: [[46, 38, 36], [72, 58, 52], [98, 76, 64], [126, 98, 80], [152, 120, 98]], m: [[110, 44, 26], [150, 68, 38], [190, 98, 58], [220, 136, 90]] },
    marble: { r: [[110, 108, 104], [150, 148, 142], [186, 184, 176], [214, 212, 204], [236, 234, 226], [250, 248, 242]] },
    gems: { r: [[44, 40, 52], [66, 60, 76], [90, 82, 100], [116, 106, 126], [140, 130, 150]], m: [[40, 90, 160], [70, 150, 210], [150, 60, 190], [120, 230, 240]] },
  };
  function makeRocks(kind, seed, size) {
    const r = U.rng(seed), w = 32, h = 24, pb = new PB(w, h), cx = 16, cy = 15;
    const pal = ROCK[kind];
    const count = [2, 4, 6][size], spread = [5, 10, 14][size], spy = [2, 4, 5][size], rad = [2.8, 3.6, 4.4][size];
    const rocks = [];
    for (let i = 0; i < count; i++) rocks.push({ x: cx + (r() - 0.5) * spread, y: cy + (r() - 0.5) * spy, rx: rad + r() * 2 - (i > 3 ? 1 : 0) });
    rocks.sort((a, b) => a.y - b.y);
    ellipseShadow(pb, cx + 3, cy + 3, Math.round(spread / 2 + 5), 3, 80);
    rocks.forEach((k, ri) => {
      const ry = k.rx * 0.8;
      for (let y = Math.floor(k.y - ry * 1.4); y <= k.y + ry; y++) for (let x = Math.floor(k.x - k.rx); x <= k.x + k.rx; x++) {
        const dx = (x + 0.5 - k.x) / k.rx, dy = (y + 0.5 - k.y) / (dy0(y, k) ? ry * 1.4 : ry);
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2), ang = Math.atan2(dy, dx), q = Math.round(ang / (Math.PI / 3)) * (Math.PI / 3), rr = Math.sqrt(d2);
        const n = [Math.cos(q) * rr, Math.sin(q) * rr, nz];
        let l = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) * 0.5 + 0.38 + (U.hash(x, y, seed + ri) - 0.5) * 0.12;
        let col = ramp(pal.r, l);
        if (pal.m && U.hash(x, y, seed + 9 + ri) > 0.7 && l > 0.3) col = ramp(pal.m, l);
        pb.set(x, y, col);
      }
    });
    return withMask({ c: pb.canvas(), ax: cx, ay: cy + 1 });
  }
  function dy0(y, k) { return y < k.y; }

  // ---------- Aldeanos (pixel art x2, proporciones realistas al estilo de los RTS clásicos) ----------
  // Ocupan 18x22 del mundo pero se pintan al doble de píxeles (36x44) y se muestran nítidos, sin suavizado.
  // Cuerpo de ~7 cabezas: cabeza, cuello, torso con hombros, brazo y antebrazo, muslo y pierna, con codos y
  // rodillas que se doblan al caminar. Cada pieza (elipsoide, cápsula o cono) se sombrea por píxel con una rampa
  // de 6 tonos y tramado entre tonos, como los árboles. Sin contorno negro: borde suave del lado de la sombra.
  // Mira a la derecha; flip lo espeja.
  const HAIR = [[70, 44, 26], [30, 24, 20], [196, 160, 90], [150, 70, 34]];
  const SKIN = [[232, 188, 148], [200, 150, 108], [142, 96, 64]];
  const CARRY = { wood: [124, 86, 52], food: [190, 58, 62], stone: [150, 148, 140], gold: [236, 196, 70], ore: [164, 86, 56], marble: [232, 230, 222], gems: [80, 170, 230], planks: [196, 156, 100], blocks: [200, 196, 184], ingots: [190, 194, 204], tools: [150, 150, 160], books: [150, 50, 40], steel: [170, 186, 200], machinery: [200, 140, 60] };
  S.CARRY = CARRY;
  const VW = 22, VH = 22, VR = 2, VC = {}, RAMPS = {}; // 4 de ancho extra a la derecha para el alcance de la herramienta
  let vcN = 0;
  // Rampa de 6 tonos con más contraste: sombras hacia el violeta, luces hacia el cálido.
  function vRamp(c) {
    const k = c.join(',');
    if (RAMPS[k]) return RAMPS[k];
    return (RAMPS[k] = [0.36, 0.5, 0.65, 0.8, 0.96, 1.14].map(f => {
      let o = sc(c, f);
      if (f < 0.8) o = mix(o, [44, 32, 66], (0.8 - f) * 0.5);
      if (f > 1) o = mix(o, [255, 242, 210], (f - 1) * 0.65);
      return o.map(v => Math.max(0, Math.min(255, Math.round(v))));
    }));
  }
  const BAYER = [[0, 2], [3, 1]];
  // Luz propia del personaje: de arriba y un poco de frente, para que la cara quede iluminada hacia donde mire.
  const VLIGHT = norm3(0.4, -0.62, 0.68);
  // frame: caminando 0..5; trabajando 0..3 (preparar, medio, impacto, rebote).
  // aim: punto de contacto [dx, dy] en píxeles respecto de los pies, mirando a la derecha.
  const HEAD = { axe: 1.0, pick: 1.6, hammer: 1.0, sickle: 1.1, knife: 0.5, sword: 0.3, spear: 0.3 }; // del extremo del mango al filo que golpea
  // troop: el mismo cuerpo vestido de soldado (militia, spear, archer, knight, cleric o catapult, la dotación).
  // Cambian la túnica, el casco o la capucha y el arma que lleva en la mano de adelante (al pelear, la herramienta).
  const TROOP_TUNIC = { archer: [86, 108, 56], knight: [168, 174, 188], cleric: [226, 220, 204] };
  S.villager = function (col, hair, skin, mode, frame, carry, flip, tool, scout, back, aim, troop) {
    const key = col.join(',') + '|' + hair + skin + mode + frame + (carry || '') + (flip ? 1 : 0) + (tool || '') + (scout ? 's' : '') + (back ? 'b' : '') + (aim ? aim.join(',') : '') + (troop || '');
    if (VC[key]) return VC[key];
    if (++vcN > 3000) { for (const k in VC) delete VC[k]; vcN = 0; }
    const PW = VW * VR, PH = VH * VR, pb = new PB(PW, PH);
    const female = !troop && (hair * 3 + skin) % 2 === 1, hat = scout || troop ? 0 : (hair + skin * 2) % 4, robe = troop === 'cleric';
    const walk = mode === 'walk', ph = walk ? (frame % 6) / 6 * Math.PI * 2 : 0;
    // al recoger a mano se agacha: baja la cadera y adelanta las rodillas
    const crouch = mode === 'work' && tool === 'hand' ? 4 : 0;
    const sv = walk ? Math.sin(ph) : 0, lift = walk ? Math.abs(Math.cos(ph)) : 0, yo = -lift * 0.35 + crouch;
    const working = mode === 'work' && tool;
    // materiales
    const tcol = troop ? TROOP_TUNIC[troop] || col : scout ? [86, 108, 56] : col;
    const SK = vRamp(SKIN[skin]), HR = vRamp(HAIR[hair]), BRD = vRamp(sc(HAIR[hair], 0.85));
    const TU = vRamp(tcol), TU2 = vRamp(sc(tcol, 0.78)), LIN = vRamp([212, 196, 160]), LIN2 = vRamp([176, 160, 126]);
    const PA = vRamp([104, 80, 54]), WRAP = vRamp([150, 128, 92]), BO = vRamp([78, 54, 36]), BE = vRamp([92, 58, 30]);
    const WO = vRamp([150, 102, 58]), ME = vRamp([160, 166, 180]), ST = vRamp([216, 180, 98]), BAND = vRamp([150, 72, 40]);
    const HOOD = vRamp([70, 88, 46]), KER = vRamp([232, 222, 196]), SACK = vRamp([178, 142, 90]), BASK = vRamp([176, 128, 66]), BASK2 = vRamp([136, 94, 46]);
    const LOG = vRamp(CARRY.wood), LOGEND = vRamp([214, 178, 122]), RED = vRamp([206, 52, 56]), GRN = vRamp([104, 162, 62]);
    // ---- piezas: elipsoides (e), cápsulas (c) y conos (k). z ordena por capas. ----
    const P = [];
    const E = (cx, cy, rx, ry, z, m, clip) => P.push({ t: 'e', cx, cy, rx, ry, z, m, clip });
    const Cp = (x0, y0, x1, y1, r, z, m, clip) => P.push({ t: 'c', x0, y0, x1, y1, r, z, m, clip });
    const K = (cx, y0, y1, w0, w1, z, m, clip) => P.push({ t: 'k', cx, y0, y1, w0, w1, z, m, clip });
    const hx = 8.3, hy = 4.3 + yo, inFront = back ? 7 : 0;
    const shY = 6.9 + yo, waist = 10.9 + yo, hipY = 11.9 + yo;
    // carga a la espalda (de espaldas va adelante)
    if (carry === 'wood') for (let i = 0; i < 3; i++) {
      const x0 = 3.6 + i * 0.35, y0 = 10.4 - i * 0.95 + yo;
      Cp(x0, y0, 8.4 + i * 0.35, 6.0 - i * 0.95 + yo, 0.62, inFront + 0.2 + i * 0.01, (px, py) => (Math.hypot(px - x0, py - y0) < 0.65 ? LOGEND : LOG));
    } else if (carry && carry !== 'food') {
      E(6.0, 8.7 + yo, 1.6, 2.1, inFront + 0.5, (px, py) => (Math.abs(py - (7.4 + yo)) < 0.25 ? BE : SACK));
      E(6.2, 6.8 + yo, 1.0, 0.55, inFront + 0.6, vRamp(CARRY[carry] || [150, 120, 80]));
    }
    if (scout) K(7.0, 6.8 + yo, 15.6, 1.0, 1.9, 1, HOOD); // capa
    // piernas: muslo, rodilla que se dobla, pierna con polainas cruzadas y zapato
    const leg = (x, d, z) => {
      const f = sv * d, kx = x + f * 0.75 + Math.max(0, f) * 0.25 + crouch * 0.7, ky = 14.8 - Math.max(0, f) * 0.35 * lift + crouch * 0.2;
      const ax = x + f * 1.3, ay = 17.5 - Math.max(0, f) * 0.2;
      Cp(x, hipY, kx, ky, female ? 0.78 : 0.88, z, PA);
      Cp(kx, ky, ax, ay, 0.62, z + 0.01, (px, py) => (Math.floor((py + px * 0.6) * 2.4) % 2 ? WRAP : PA));
      E(ax + 0.4, 18.1, 1.05, 0.6, z + 0.02, BO);
    };
    leg(7.6, -1, 2); leg(9.0, 1, 2.5);
    // manos y herramienta: el golpe sale del hombro hacia el punto de contacto
    let hand = null, tip = null, hit = null;
    if (working) {
      const low = tool === 'sickle' || tool === 'knife', SX = 10.0, SY = shY + 0.3;
      const tx = Math.max(low || tool === 'hand' ? 11.2 : 12.4, Math.min(VW - 1, aim ? 8 + aim[0] : low ? 13.6 : 15)),
        ty = Math.max(low ? 12.5 : 4.2, Math.min(low ? 16.5 : 18.4, aim ? 19 + aim[1] : low ? 15 : 11.5));
      hit = [tx, ty];
      const dx = tx - SX, dy = ty - SY, dd = Math.hypot(dx, dy) || 1, ux = dx / dd, uy = dy / dd;
      if (tool === 'hand') { // recoger con la mano: estira, arranca y lo lleva a la cintura
        const r = Math.min(5.2, dd);
        hand = frame === 3 ? [10.3, 10.4 + yo] : [SX + ux * r * (frame === 0 ? 0.6 : 1), SY + uy * r * (frame === 0 ? 0.6 : 1)];
        if (frame === 2) hit = hand.slice(); // lo que toca es la mano
      } else {
        // el mango mide lo que falta del brazo estirado al contacto (dentro de un rango), igual en todos los cuadros
        const reach = Math.max(1.4, Math.min(4.2, dd - (tool === 'hammer' ? 3.2 : low ? 2.8 : 4.6))), len = Math.max(2.4, Math.min(7, dd - reach));
        const sh = [SX + ux * reach, SY + uy * reach];
        if (frame === 2) { hand = sh; tip = [sh[0] + ux * len, sh[1] + uy * len]; }
        else if (frame === 3) { hand = [sh[0] - 0.4, sh[1] - 0.7]; tip = [sh[0] + ux * len - 0.7, sh[1] + uy * len - 1.9]; }
        else if (low) { hand = frame === 0 ? [7.9, 9.4 + yo] : [10.9, 8.8 + yo]; const a = frame === 0 ? [-0.8, -0.6] : [0.96, 0.28]; tip = [hand[0] + a[0] * len, hand[1] + a[1] * len]; }
        else {
          hand = frame === 0 ? [8.8, 3.1 + yo] : [11.4, 4.0 + yo];
          const a = frame === 0 ? [-0.82, -0.57] : [0.62, -0.78];
          tip = [hand[0] + a[0] * len, Math.max(0.4, hand[1] + a[1] * len)];
        }
        if (frame >= 2) { // el filo (no la punta del mango) es lo que toca el objetivo
          const vl = Math.hypot(tip[0] - hand[0], tip[1] - hand[1]) || 1;
          let px = -(tip[1] - hand[1]) / vl, py = (tip[0] - hand[0]) / vl;
          if (px < 0) { px = -px; py = -py; }
          const k = HEAD[tool] || 1;
          hand = [hand[0] - px * k, hand[1] - py * k]; tip = [tip[0] - px * k, tip[1] - py * k];
        }
      }
    }
    // codo: se dobla lo justo para que brazo y antebrazo midan lo mismo (hacia abajo, o hacia adelante si el brazo sube)
    const elbow = (sx, sy, hX, hY) => {
      const vx = hX - sx, vy = hY - sy, d = Math.hypot(vx, vy) || 1, b = Math.sqrt(Math.max(0, 5.3 - d * d / 4));
      let px = -vy / d, py = vx / d;
      if (Math.abs(vy) > Math.abs(vx) ? px < 0 : py < 0) { px = -px; py = -py; }
      return [(sx + hX) / 2 + px * b, (sy + hY) / 2 + py * b];
    };
    // de espaldas, la herramienta y el brazo quedan del otro lado del cuerpo: el torso y la cabeza los tapan
    const zA = back ? 2.7 : 5, zT = back ? 2.6 : 6;
    const arm = (sx, d, z, hX, hY, eX, eY) => {
      Cp(sx, shY + 0.2, eX, eY, female ? 0.6 : 0.78, z, female ? TU : TU2);       // brazo (manga)
      if (!female) E(sx + (eX - sx) * 0.45, shY + 0.2 + (eY - shY - 0.2) * 0.45, 0.82, 1.0, z + 0.005, TU2); // bíceps
      Cp(eX, eY, hX, hY, female ? 0.48 : 0.6, z + 0.01, female ? (px, py) => (Math.hypot(px - hX, py - hY) < 0.6 ? LIN : TU) : SK); // antebrazo (descubierto en ellos)
      E(hX, hY + 0.15, female ? 0.46 : 0.56, 0.56, z + 0.02, SK);                  // mano
    };
    const sw = -sv;
    let grip = null;
    if (working && tip) { // la otra mano, más abajo en el mango
      const ul = Math.hypot(tip[0] - hand[0], tip[1] - hand[1]) || 1;
      grip = [hand[0] - ((tip[0] - hand[0]) / ul) * 1.0, hand[1] - ((tip[1] - hand[1]) / ul) * 1.0];
    }
    if (grip) { const e = elbow(6.9, shY + 0.2, grip[0], grip[1]); arm(6.9, -1, 1.5, grip[0], grip[1], e[0], e[1]); }
    else arm(6.7, -1, 1, 6.5 + sw * 1.0, 11.6 + yo, 6.5 + sw * 0.45, 9.3 + yo);
    // torso: camisa de lino, túnica del color del reino, escote, cinturón, ruedo y caída de la tela
    const beltY = waist - 0.3;
    const torsoM = (px, py) => {
      if (py >= beltY && py < beltY + 0.55) return BE;
      if (!back && py < shY + 1.2 && px > hx + 0.05 && px < hx + 0.75 + (py - shY) * 0.3) return py < shY + 0.9 ? SK : LIN; // escote
      if (py > shY + 2.4 && py < beltY && Math.abs(px - (hx + 0.7)) < 0.25 && !back) return TU2;        // costura
      return TU;
    };
    const chestW = female ? 2.05 : 2.45, waistW = female ? 1.6 : 1.55;
    K(hx, shY - 0.3, waist + 0.1, chestW, waistW, 3, torsoM, (px, py) => !(py - (shY - 0.3) < 0.6 && Math.abs(px - hx) > chestW - 0.55));
    const shR = female ? 0.75 : 1.0;
    E(hx - chestW + 0.5, shY + 0.4, shR, shR * 0.9, 3.05, TU2); E(hx + chestW - 0.45, shY + 0.4, shR, shR * 0.9, 3.05, TU); // hombros
    if (!female) { // pecho: dos volúmenes que sobresalen hacia la luz, con la línea del esternón
      E(hx + 0.95, shY + 1.35, 1.25, 1.05, 3.08, torsoM); E(hx - 0.35, shY + 1.4, 1.15, 1.0, 3.07, torsoM);
    }
    if (female || robe) K(hx, waist, 17.6, 1.7, 2.7, 3.2, (px, py) => (py > 17.0 ? LIN2 : py > 16.4 ? TU2 : Math.floor(px * 2.5) % 3 === 0 && py > waist + 1.5 ? TU2 : TU));
    else K(hx, waist, 13.6 + yo, 1.75, 2.3, 3.2, (px, py) => (py > 13.1 + yo ? LIN2 : Math.floor(px * 2.5) % 3 === 0 && py > waist + 0.8 ? TU2 : TU)); // faldón
    if (!back) E(hx - 1.5, beltY + 0.75, 0.55, 0.7, 3.4, BE); // bolsita
    Cp(hx + 0.1, 5.4 + yo, hx + 0.1, 6.4 + yo, female ? 0.58 : 0.72, 3.5, SK);  // cuello
    // cabeza: piel, pelo y barba según la zona
    const hairAt = (px, py) => {
      const dx = px - hx, dy = py - hy;
      if (back) return dy < 1.2 || (female && dy < 1.6);
      if (dy < -0.65 - Math.max(0, dx) * 0.15) return true;
      if (dx < -0.55 && dy < (female ? 1.6 : 0.7)) return true;
      return false;
    };
    const beard = !back && !female && hair === 1;
    E(hx, hy, 1.35, 1.6, 4, (px, py) => (hairAt(px, py) ? HR : beard && py - hy > 0.45 && px - hx > -0.7 ? BRD : SK));
    if (!back) E(hx + 1.35, hy + 0.15, 0.32, 0.35, 4.02, SK); // nariz
    if (female && !scout && hat !== 3) E(hx - 0.8, hy + 1.6, 0.85, 1.4, 3.8, HR); // trenza
    // sombreros
    if (hat === 1) { E(hx, hy - 1.05, 2.5, 0.55, 4.6, ST); E(hx - 0.05, hy - 1.55, 1.25, 0.85, 4.7, (px, py) => (py > hy - 1.3 ? BAND : ST)); }
    else if (hat === 2) { E(hx - 0.1, hy - 0.6, 1.5, 1.15, 4.6, TU2, (px, py) => py < hy - 0.45); if (!back) E(hx + 1.35, hy - 0.5, 0.7, 0.28, 4.65, TU2); }
    else if (hat === 3 && female) E(hx - 0.15, hy - 0.3, 1.6, 1.8, 4.6, KER, (px, py) => py < hy - 0.4 || (px < hx - 0.6 && py < hy + 1.4));
    if (scout) {
      E(hx - 0.15, hy - 0.1, 1.75, 1.95, 4.6, HOOD, (px, py) => back || !(px > hx - 0.25 && py > hy - 0.75));
      Cp(12.4, 1.2, 12.4, 18.4, 0.32, 6.5, WO); E(12.4, 0.9, 0.5, 0.5, 6.6, WO);
    }
    if (troop) {
      const helm = troop === 'knight' || troop === 'spear' ? ME : troop === 'militia' || troop === 'catapult' ? WRAP : null;
      if (helm) E(hx - 0.05, hy - 0.5, 1.6, 1.35, 4.65, helm, (px, py) => py < hy - 0.2 || (troop === 'knight' && (back || px < hx + 0.35) && py < hy + 1.3));
      if (troop === 'knight') E(hx - 0.35, hy - 1.95, 0.5, 0.8, 4.7, vRamp(col)); // penacho del color del reino
      if (troop === 'archer' || robe) E(hx - 0.15, hy - 0.1, 1.75, 1.95, 4.6, robe ? KER : HOOD, (px, py) => back || !(px > hx - 0.25 && py > hy - 0.75));
      if (troop === 'knight' && !back) E(hx - 1.15, 10.1 + yo, 1.45, 2.0, 3.6, (px, py) => (Math.abs(px - (hx - 1.15)) < 0.3 || Math.abs(py - (10.1 + yo)) < 0.3 ? ST : vRamp(col))); // escudo
    }
    // brazo de adelante: herramienta, canasta o balanceo
    if (working && tip) {
      const ul = Math.hypot(tip[0] - hand[0], tip[1] - hand[1]) || 1, u = [(tip[0] - hand[0]) / ul, (tip[1] - hand[1]) / ul];
      let p = [-u[1], u[0]]; if (p[0] < 0) p = [-p[0], -p[1]];
      const at = (a, b) => [tip[0] + u[0] * a + p[0] * b, tip[1] + u[1] * a + p[1] * b];
      const seg = (a, b, r) => Cp(a[0], a[1], b[0], b[1], r, zT + 0.03, ME);
      Cp(hand[0] - u[0] * 1.6, hand[1] - u[1] * 1.6, tip[0], tip[1], 0.28, zT, WO);
      if (tool === 'axe') { seg(at(-0.25, 0.15), at(-0.3, 1.0), 0.42); seg(at(-0.05, 1.05), at(-0.7, 1.2), 0.45); }
      else if (tool === 'pick') { seg(at(0, -1.0), at(0, 1.0), 0.32); seg(at(0, 1.0), at(-0.55, 1.8), 0.25); seg(at(0, -1.0), at(-0.55, -1.8), 0.25); }
      else if (tool === 'hammer') seg(at(0, -0.75), at(0, 0.75), 0.55);
      else if (tool === 'knife') seg(at(0, 0), at(-0.3, 0.55), 0.3);
      else if (tool === 'sword') seg(at(0.4, 0), at(-2.8, 0), 0.32);
      else if (tool === 'spear') seg(at(-0.4, 0), at(1.2, 0), 0.38);
      else { let q = at(0, 0); for (let i = 1; i <= 5; i++) { const a = i / 5 * Math.PI, n = at(-Math.sin(a) * 0.9, 0.9 - Math.cos(a) * 0.9); seg(q, n, 0.24); q = n; } }
      const e = elbow(10.0, shY + 0.2, hand[0], hand[1]);
      arm(10.0, 1, zA, hand[0], hand[1], e[0], e[1]);
      E(hand[0], hand[1] + 0.1, 0.5, 0.5, zT + 0.5, SK);
    } else if (working) { // a mano (bayas): el brazo de adelante va y vuelve del arbusto
      const e = elbow(10.0, shY + 0.2, hand[0], hand[1]);
      arm(10.0, 1, zA, hand[0], hand[1], e[0], e[1]);
      if (frame >= 2) E(hand[0] + 0.1, hand[1] - 0.1, 0.42, 0.42, zA + 0.05, RED); // la baya en la mano
    } else if (carry === 'food') {
      arm(9.9, 1, 5, 10.5, 10.3 + yo, 10.4, 8.9 + yo);
      E(11.2, 11.5 + yo, 1.6, 1.0, 6, (px, py) => (Math.floor(px * 2 + py * 2) % 3 ? BASK : BASK2), (px, py) => py > 10.8 + yo);
      E(10.5, 10.6 + yo, 0.5, 0.5, 5.9, RED); E(11.4, 10.4 + yo, 0.5, 0.5, 5.9, RED); E(12.0, 10.8 + yo, 0.46, 0.46, 5.9, GRN);
    } else if (troop) { // la mano de adelante sostiene el arma, quieta aunque camine
      const hX = 10.7, hY = 10.4 + yo;
      arm(9.9, 1, 5, hX, hY, 10.3, 8.9 + yo);
      const z = 6.5;
      if (troop === 'spear') { Cp(11.3, 0.9 + yo, 11.3, 18.0, 0.3, z, WO); E(11.3, 0.6 + yo, 0.5, 1.0, z + 0.1, ME); }
      else if (troop === 'knight') { Cp(11.2, 10.0 + yo, 12.6, 3.6 + yo, 0.32, z, ME); Cp(10.3, 9.2 + yo, 12.0, 9.8 + yo, 0.24, z + 0.05, ST); }
      else if (troop === 'archer') {
        let q = [11.6, 4.6 + yo];
        for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI, n = [11.6 + Math.sin(a) * 1.6, 4.6 + yo + (1 - Math.cos(a)) * 5.6]; Cp(q[0], q[1], n[0], n[1], 0.3, z, WO); q = n; }
        Cp(11.6, 4.6 + yo, 11.6, 15.8 + yo, 0.12, z - 0.1, LIN);
      } else if (robe) { Cp(11.6, 1.8 + yo, 11.6, 18.2, 0.32, z, WO); E(11.6, 1.4 + yo, 0.65, 0.65, z + 0.1, ST); }
      else { Cp(11.0, 10.8 + yo, 12.8, 6.0 + yo, 0.4, z, WO); E(12.9, 5.8 + yo, troop === 'catapult' ? 0.8 : 0.65, 0.7, z + 0.05, troop === 'catapult' ? ME : WO); } // garrote o martillo
      E(hX, hY + 0.1, 0.55, 0.55, z + 0.5, SK);
    } else arm(9.9, 1, 5, 10.1 - sw * 1.0, 11.6 + yo, 10.2 - sw * 0.45, 9.3 + yo);

    // ---- render por píxel (al doble de resolución, con tramado entre tonos) ----
    const L = VLIGHT, rampAt = new Array(PW * PH);
    for (let y = 0; y < PH; y++) for (let ox = 0; ox < PW; ox++) {
      const x = flip ? PW - 1 - ox : ox, px = (x + 0.5) / VR, py = (y + 0.5) / VR;
      let best = -1e9, bn = null, bm = null;
      for (const q of P) {
        let n, depth;
        if (q.t === 'e') {
          const dx = (px - q.cx) / q.rx, dy = (py - q.cy) / q.ry, d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2); n = [dx, dy, nz]; depth = q.z * 10 + nz * Math.min(q.rx, q.ry);
        } else if (q.t === 'c') {
          const vx = q.x1 - q.x0, vy = q.y1 - q.y0, ll = vx * vx + vy * vy || 1;
          const t = Math.max(0, Math.min(1, ((px - q.x0) * vx + (py - q.y0) * vy) / ll));
          const dx = (px - (q.x0 + vx * t)) / q.r, dy = (py - (q.y0 + vy * t)) / q.r, d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2); n = [dx, dy, nz]; depth = q.z * 10 + nz * q.r;
        } else {
          if (py < q.y0 || py > q.y1) continue;
          const w = q.w0 + (q.w1 - q.w0) * ((py - q.y0) / (q.y1 - q.y0)), dx = (px - q.cx) / w;
          if (Math.abs(dx) > 1) continue;
          const nz = Math.sqrt(1 - dx * dx); n = [dx, -0.2, nz]; depth = q.z * 10 + nz * w;
        }
        if (q.clip && !q.clip(px, py)) continue;
        if (depth > best) { best = depth; bn = n; bm = typeof q.m === 'function' ? q.m(px, py) : q.m; }
      }
      if (!bn) continue;
      let l = (bn[0] * L[0] + bn[1] * L[1] + bn[2] * L[2]) * 0.55 + 0.46;
      l += (BAYER[y & 1][ox & 1] / 4 - 0.375) * 0.15 + (U.hash(ox, y, 77) - 0.5) * 0.06;
      if (bm === HR || bm === BRD) l += (U.hash(x, 3, 91) - 0.5) * 0.24;                  // mechones
      else if (bm === TU || bm === TU2 || bm === PA || bm === LIN) l += (U.hash(x, 5, 41) - 0.5) * 0.1; // pliegues
      else if (bm === LOG || bm === BASK) l += (U.hash(ox + y, 1, 7) - 0.5) * 0.2;       // vetas
      pb.set(ox, y, bm[Math.max(0, Math.min(5, Math.floor(l * 6)))]); rampAt[y * PW + ox] = bm;
    }
    // detalles a pixel fino (coordenadas del mundo -> píxel del sprite)
    const put = (ux, uy, c) => {
      const x = Math.floor(ux * VR), y = Math.floor(uy * VR), ox = flip ? PW - 1 - x : x;
      if (ox >= 0 && ox < PW && y >= 0 && y < PH && pb.alpha(ox, y) >= 200) pb.set(ox, y, c);
    };
    if (!back) {
      put(hx + 0.75, hy - 0.05, [36, 24, 26]);                                    // ojo
      put(hx + 0.75, hy - 0.55, HR[1]);                                          // ceja
      put(hx + 0.25, hy + 0.5, mix(SK[3], [210, 100, 90], 0.3));                 // pómulo
      if (!beard) put(hx + 0.8, hy + 0.95, SK[1]);                               // boca
      else put(hx + 0.8, hy + 0.95, BRD[1]);
      put(hx + 0.75, beltY, [236, 202, 104]);                                    // hebilla
    }

    // ---- borde suave: del lado de atrás y abajo, el tono más oscuro del material; del lado de la luz, un velo ----
    const d = pb.d, solid = (x, y) => x >= 0 && y >= 0 && x < PW && y < PH && d[(y * PW + x) * 4 + 3] >= 200;
    const bk = flip ? -1 : 1, edge = [];
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      if (solid(x, y)) continue;
      const dark = solid(x + bk, y) ? [x + bk, y] : solid(x, y - 1) ? [x, y - 1] : null;
      const src = dark || (solid(x - bk, y) ? [x - bk, y] : solid(x, y + 1) ? [x, y + 1] : null);
      if (!src) continue;
      const m = rampAt[src[1] * PW + src[0]], i = (src[1] * PW + src[0]) * 4, base = m ? m[0] : sc([d[i], d[i + 1], d[i + 2]], 0.45);
      edge.push([x, y, dark ? mix(base, [28, 20, 24], 0.3) : base, dark ? 255 : 120]);
    }
    for (const [x, y, c, a] of edge) pb.set(x, y, c, a);
    // sombra en el suelo (solo donde no hay nada)
    const scx = flip ? VW - 8.4 : 8.4;
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const dx = ((x + 0.5) / VR - scx) / 3.4, dy = ((y + 0.5) / VR - 18.9) / 0.85, d2 = dx * dx + dy * dy;
      if (d2 <= 1 && d[(y * PW + x) * 4 + 3] === 0) pb.set(x, y, [10, 18, 6], d2 > 0.6 ? 45 : 75);
    }
    // hit: dónde toca la herramienta, en píxeles del mundo respecto del ancla (para los efectos del golpe)
    return (VC[key] = withMask({ c: pb.canvas(), ax: flip ? VW - 8 : 8, ay: 19, k: VR, w: VW, h: VH, hit: hit && [(hit[0] - 8) * (flip ? -1 : 1), hit[1] - 19] }));
  };

  // Carreta tirada por un burro: lleva la carga a la vista, con el color del recurso.
  const CC = {};
  // Carreta tirada por un burro, en pixel art como los animales: 30x22, 4 cuadros (patas, vaivén y rayos).
  // Mira a la derecha; flip la espeja. La rueda y todo lo demás se pinta pixel a pixel.
  const WHEEL9 = ['...ooo...', '.oo...oo.', '.o.....o.', 'o.......o', 'o...h...o', 'o.......o', '.o.....o.', '.oo...oo.', '...ooo...'];
  const SPOKES = [[[4, 1], [4, 2], [4, 3], [4, 5], [4, 6], [4, 7], [1, 4], [2, 4], [3, 4], [5, 4], [6, 4], [7, 4]],
    [[2, 2], [3, 3], [5, 5], [6, 6], [6, 2], [5, 3], [3, 5], [2, 6]]];
  const LEGS = [[1, -1, -1, 1], [0, 0, 0, 0], [-1, 1, 1, -1], [0, 0, 0, 0]];
  S.cart = function (col, carry, flip, frame, moving) {
    const f = moving ? frame % 4 : 1, key = col.join(',') + (carry || '') + (flip ? 1 : 0) + f;
    if (CC[key]) return CC[key];
    const Wd = 30, Ht = 22, pb = new PB(Wd, Ht), X = x => (flip ? Wd - 1 - x : x);
    const set = (x, y, c) => pb.set(X(x), y, c);
    const hline = (x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(x, y, c); };
    // paleta
    const pl = [168, 118, 68], plL = [204, 156, 98], plD = [116, 78, 42], ins = [84, 56, 32], edge = [52, 34, 20];
    const dk = [128, 112, 96], dkD = [92, 80, 68], dkL = [166, 150, 132], belly = [198, 186, 168], muz = [214, 204, 190], hoof = [38, 30, 24], mane = [66, 54, 44];
    const rim = [58, 54, 52], rimL = [122, 116, 108], wIn = [72, 48, 28], spoke = [184, 142, 90], hub = [30, 20, 14];
    for (let x = 4; x <= 28; x++) pb.set(X(x), 20, [10, 18, 6], x < 6 || x > 26 ? 40 : 75); // sombra
    const bob = moving && (f === 1 || f === 3) ? -1 : 0;
    // --- burro (detrás de las varas) ---
    const legX = [20, 21, 24, 25], lo = moving ? LEGS[f] : LEGS[1];
    for (let i = 0; i < 4; i++) {
      const lx = legX[i], o = lo[i], c = i === 1 || i === 3 ? dkD : dk;
      set(lx, 15 + bob, c); set(lx, 16, c); set(lx + (o > 0 ? 1 : o < 0 ? -1 : 0), 17, c); set(lx + o, 18, c); set(lx + o, 19, hoof);
    }
    const by = 11 + bob;
    hline(20, 25, by, mane);                         // lomo
    hline(19, 26, by + 1, dk); hline(19, 26, by + 2, dk);
    set(19, by + 1, dkD); set(26, by + 2, dkD);
    hline(20, 25, by + 3, belly); set(19, by + 3, dkD); set(26, by + 3, dkD);
    set(20, by + 1, dkL); set(21, by + 1, dkL); set(22, by + 1, dkL);
    set(18, by + 1, mane); set(18, by + 2, mane); set(17, by + 3, mane);   // cola
    // cuello y cabeza
    set(26, by, mane); set(27, by, dk); set(27, by - 1, mane); set(26, by + 1, dk); set(27, by + 1, dk);
    hline(27, 29, by - 2, dk); hline(27, 29, by - 1, dk); set(28, by - 2, dkL);
    set(29, by, muz); set(28, by, muz); set(29, by - 1, muz); set(28, by - 1, dk);
    set(28, by - 2, [24, 18, 14]);                   // ojo
    set(27, by - 3, dkD); set(27, by - 4, dk); set(28, by - 3, dkD); set(28, by - 4, dkL); // orejas
    // collera con el color del reino y arnés
    set(25, by, col); set(25, by + 1, sc(col, 0.8)); set(25, by + 2, sc(col, 0.65));
    hline(21, 24, by + 2, [70, 46, 26]);
    // --- varas ---
    hline(16, 20, 13, plD); set(21, 13 + (bob ? 0 : 0), plD);
    // --- caja de la carreta ---
    hline(4, 17, 9, plL);                            // borde de atrás
    hline(3, 16, 10, ins);                           // interior
    hline(2, 15, 11, plL);                           // borde de adelante
    for (let y = 12; y <= 14; y++) hline(2, 15, y, y === 13 ? plD : pl);
    hline(2, 15, 15, edge);
    for (const x of [2, 8, 15]) for (let y = 11; y <= 14; y++) set(x, y, plD);
    set(17, 10, plD); set(16, 10, plD); set(3, 10, plD);
    // --- carga ---
    if (carry) {
      const cc = CARRY[carry] || [150, 120, 80], cL = sc(cc, 1.25), cD = sc(cc, 0.72);
      if (carry === 'wood' || carry === 'planks') {
        const end = carry === 'wood' ? [214, 176, 120] : [226, 196, 140];
        for (const [y, x0, x1] of [[10, 3, 16], [9, 4, 15], [8, 5, 14], [7, 6, 13]]) {
          hline(x0, x1, y, y % 2 ? cc : cD);
          set(x0, y, end); set(x1, y, end);
        }
        hline(6, 13, 7, cL);
      } else if (carry === 'food') {
        for (const sx of [4, 10]) {
          const sk = [198, 172, 120], skD = [150, 124, 80];
          hline(sx, sx + 4, 10, skD); hline(sx, sx + 4, 9, sk); hline(sx, sx + 4, 8, sk); hline(sx + 1, sx + 3, 7, sk); set(sx + 2, 6, [110, 80, 46]);
          set(sx + 1, 8, [228, 206, 160]);
        }
      } else {
        const rows = [[10, 3, 16], [9, 4, 15], [8, 5, 14], [7, 7, 12], [6, 9, 10]];
        for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) {
          const h = U.hash(x, y, 31 + carry.length);
          set(x, y, y === 6 || (y === 7 && x < 10) ? cL : h > 0.78 ? cD : h < 0.12 ? cL : cc);
        }
      }
    }
    // --- rueda (de pixeles; los rayos alternan en cruz y en aspa) ---
    const sp = SPOKES[moving ? f % 2 : 0], wx = 4, wy = 11;
    for (let j = 0; j < 9; j++) {
      const row = WHEEL9[j], a0 = row.indexOf('o'), a1 = row.lastIndexOf('o');
      for (let i = 0; i < 9; i++) {
        const ch = row[i];
        if (ch === 'o') set(wx + i, wy + j, j < 3 && i < 6 ? rimL : rim);
        else if (ch === 'h') set(wx + i, wy + j, hub);
        else if (i > a0 && i < a1) set(wx + i, wy + j, wIn);
      }
    }
    for (const [i, j] of sp) set(wx + i, wy + j, spoke);
    // --- banderín del reino ---
    for (let y = 4; y <= 10; y++) set(3, y, edge);
    set(4, 4, col); set(5, 4, col); set(6, 5, sc(col, 0.8)); set(4, 5, col); set(5, 5, sc(col, 0.85)); set(4, 6, sc(col, 0.7));
    if (moving && (f === 0 || f === 2)) set(7, 5, sc(col, 0.7));
    return (CC[key] = withMask({ c: pb.canvas(), ax: 15, ay: 19 }));
  };

  // Lobo: gris, con lomo oscuro; 2 cuadros de carrera.
  function makeWolf(frame, flip) {
    const pb = new PB(18, 13), X = x => (flip ? 17 - x : x), set = (x, y, c) => pb.set(X(x), y, c);
    const g = [120, 116, 110], gd = [78, 74, 70], gl = [168, 164, 156], dk = [40, 36, 34];
    ellipseShadow(pb, 9, 11, 6, 1, 70);
    for (let x = 4; x <= 12; x++) for (let y = 4; y <= 7; y++) set(x, y, y === 4 ? gd : y === 7 ? gl : g);
    for (let x = 12; x <= 15; x++) for (let y = 2; y <= 5; y++) set(x, y, x === 15 && y > 3 ? gd : g);
    set(16, 4, gd); set(16, 5, dk); set(14, 3, dk); set(13, 1, gd); set(14, 1, gd);
    set(3, 4, g); set(2, 3, g); set(1, 3, gd); set(2, 5, gd);
    const legs = frame ? [[5, 1], [7, -1], [10, 1], [12, -1]] : [[5, -1], [7, 1], [10, -1], [12, 1]];
    for (const [lx, o] of legs) { set(lx + (o > 0 ? 1 : 0), 8, gd); set(lx + o, 9, gd); set(lx + o, 10, dk); }
    return withMask({ c: pb.canvas(), ax: 9, ay: 11 });
  }

  // Ciervo: pequeño animal pixelado, con pelaje claro en el vientre.
  function makeDeer(seed, flip, gold) {
    const r = U.rng(seed), pb = new PB(16, 14), X = x => (flip ? 15 - x : x);
    const body = gold ? [232, 186, 64] : [150, 98, 56], dark = gold ? [176, 128, 30] : [104, 66, 38], belly = gold ? [255, 236, 160] : [210, 180, 140], ant = gold ? [255, 250, 210] : [196, 170, 130];
    ellipseShadow(pb, 8, 12, 5, 1, 70);
    for (let y = 5; y <= 8; y++) for (let x = 4; x <= 11; x++) pb.set(X(x), y, y === 8 ? belly : x > 9 ? dark : body);
    for (const lx of [5, 6, 10, 11]) for (let y = 9; y <= 11; y++) pb.set(X(lx), y, y === 11 ? [50, 34, 20] : dark);
    for (let y = 2; y <= 5; y++) { pb.set(X(12), y, body); pb.set(X(13), y, y < 4 ? body : dark); }
    pb.set(X(14), 3, dark); pb.set(X(13), 2, [20, 14, 10]);
    pb.set(X(12), 1, ant); pb.set(X(12), 0, ant); pb.set(X(11), 0, ant); pb.set(X(13), 0, ant); pb.set(X(14), 0, ant);
    pb.set(X(3), 5, belly); pb.set(X(3), 6, body);
    if (r() > 0.5) pb.set(X(7), 6, [180, 130, 80]);
    return withMask({ c: pb.canvas(), ax: 8, ay: 11 });
  }

  // ---------- Íconos (mapas de píxeles) ----------
  const ICON_MAPS = {
    food: { m: ['', '', '....kkkk', '..kkyyyykk', '.kyyLyyLyyk', '.kyLyyLyyyk', 'kyyyyyyyyyyk', 'kbyyyyyyyybk', 'kbbbbbbbbbbk', '.kkkkkkkkkk.'], p: { k: '#46281a', y: '#d6a050', L: '#f2cc86', b: '#a06430' } },
    wood: { m: ['', '..kkkkkkkkk', '.kyyykbbbbbk', '.kyoykbBbbbk', '.kyyykbbbbbk', '..kkkkkkkkk', '..kkkkkkkkk', '.kyyykbbbbbk', '.kyoykbbbBbk', '.kyyykbbbbbk', '..kkkkkkkkk'], p: { k: '#3a2412', y: '#d8b07a', o: '#9a6a3a', b: '#7a5232', B: '#5a3a20' } },
    rock: { m: ['', '', '....kkkk', '...kwwggk', '..kwwgggk', '..kwggggdkk', '.kwgggddgwgk', '.kggggdggggk', '.kgggddgggdk', '..kdddddddk', '...kkkkkkk'], p: {} },
    planks: { m: ['', 'kkkkkkkkkkkk', 'kyyyyyyyyyyk', 'kbbbbbbbbbbk', 'kkkkkkkkkkkk', 'kyyyyyyyyyyk', 'kbbbbbbbbbbk', 'kkkkkkkkkkkk', 'kyyyyyyyyyyk', 'kbbbbbbbbbbk', 'kkkkkkkkkkkk'], p: { k: '#3a2412', y: '#d2a26a', b: '#a0703e' } },
    blocks: { m: ['.....kk', '...kkwwkk', '.kkwwwwwwkk', 'kwwwwwwwwwwk', 'kggwwwwwwddk', 'kggggwwddddk', 'kgggggdddddk', 'kgggggdddddk', 'kgggggdddddk', '.kkgggdddkk', '...kkgddk', '.....kk'], p: { k: '#38342e', w: '#dcd6c6', g: '#aaa496', d: '#7a766c' } },
    ingots: { m: ['', '', '', '...kkkkkkk', '..kwwwwwwwk', '.kwwwwwwwgdk', 'kggggggggddk', 'kggggggggdk', 'kkkkkkkkkk'], p: { k: '#26262c', w: '#d6d8e0', g: '#9a9ca8', d: '#62646e' } },
    tools: { m: ['', '..kkkkkkkk', '.kwwwwwwwgk', '.kggggggddk', '..kkkbbkkk', '....kbbk', '....kbbk', '....kbbk', '....kbbk', '....kbbk', '....kkkk'], p: { k: '#26262c', w: '#d6d8e0', g: '#9a9ca8', d: '#62646e', b: '#8a5a30' } },
    pop: { m: ['', '....kkkk', '...kssssk', '...kssssk', '...kssssk', '....kkkk', '..kkbbbbkk', '.kbbbbbbbbk', '.kbbbbbbbbk', '.kbbbbbbbbk', '.kkkkkkkkkk'], p: { k: '#1c1c2a', s: '#e8c4a0', b: '#3462c4' } },
    coin: { m: ['....kkkk', '..kkyyyykk', '.kyyLLLLyyk', '.kyLyyyyoyk', 'kyLyykkyyoyk', 'kyLykyykyoyk', 'kyLykyykyoyk', 'kyLyykkyyoyk', '.kyoyyyyoyk', '.kyyoooooyk', '..kkyyyykk', '....kkkk'], p: { k: '#5a3a08', y: '#e8b83a', L: '#fff0a0', o: '#b07a18' } },
    book: { m: ['..kkkkkkkk', '.krrrrrrrrk', '.krRRRRRRrk', '.krRyyyyRrk', '.krRRRRRRrk', '.krrrrrrrrk', '.krrrrrrrrk', '.krrrrrrrrk', '.krrrrrrrrk', '.kwwwwwwwwk', '..kkkkkkkk'], p: { k: '#2a1008', r: '#9a2a22', R: '#6a1a14', y: '#e8c050', w: '#efe6d0' } },
    flask: { m: ['....kkkk', '....kwwk', '....kwwk', '....kwwk', '...kwwwwk', '..kwwwwwwk', '.kwggggggwk', '.kgLgggggggk', 'kggggggLgggk', 'kgggggggggk', '.kkkkkkkkkk'], p: { k: '#1c2a2a', w: '#d8eef0', g: '#3aa86a', L: '#9af0b8' } },
    market: { m: ['....kkkk', '.....kk', '....kbbk', '...kbbbbk', '..kbbbbbbk', '.kbbbyybbbk', '.kbbyybbbbk', 'kbbbbyybbbbk', 'kbbbyybbbbbk', 'kbbbbbbbbbbk', '.kkkkkkkkkk'], p: { k: '#3a2412', b: '#a07040', y: '#f0c850' } },
    guild: { m: ['k', 'kkkkkkkkkk', 'kppppppppk', 'kppyyyyppk', 'kppyppyppk', 'kppyyyyppk', 'kppppppppk', 'kpppkkpppk', 'kppk..kppk', 'kpk....kpk', 'kk......kk', 'k'], p: { k: '#1c0e24', p: '#7a3aa6', y: '#e8c050' } },
    war: { m: ['w.........w', '.w.......w', '..w.....w', '...w...w', '....w.w', '.....w', '....w.w', '..bw...wb', '..b.....b', '.b.......b', 'b.........b'], p: { w: '#e0e4ec', b: '#8a5a30' } },
    gear: { m: ['....kk', '..k.kk.k', '.kkkggkkk', '..kgddgk', 'kkgd..dgkk', 'kkgd..dgkk', '..kgddgk', '.kkkggkkk', '..k.kk.k', '....kk'], p: { k: '#2a2a30', g: '#a0a0aa', d: '#6a6a72' } },
    chestOpen: { m: ['..kkkkkkkk', '.kbbbbbbbbk', '.kyyyyyyyyk', '.kkkkkkkkkk', 'kgwggggwgggk', 'kyyyyyyyyyyk', 'kbbbbyybbbbk', 'kbbbbkkbbbbk', 'kbbbbbbbbbbk', 'kyyyyyyyyyyk', 'kbbbbbbbbbbk', '.kkkkkkkkkk'], p: { k: '#2a1608', b: '#8a5228', y: '#e8b83a', g: '#ffd84a', w: '#fffbe0' } },
    chest: { m: ['', '..kkkkkkkk', '.kbbbbbbbbk', 'kbbbbbbbbbbk', 'kyyyyyyyyyyk', 'kbbbbyybbbbk', 'kbbbbkkbbbbk', 'kbbbbbbbbbbk', 'kyyyyyyyyyyk', 'kbbbbbbbbbbk', '.kkkkkkkkkk'], p: { k: '#2a1608', b: '#8a5228', y: '#e8b83a' } },
    gems: { m: ['', '...kkkkk', '..kwbbbbk', '.kwbbbbbdk', 'kkkkkkkkkkk', '.kbbbbbbdk', '..kbbbbdk', '...kbbdk', '....kdk', '.....k'], p: { k: '#1a2a4a', w: '#d0f4ff', b: '#4aa8e8', d: '#2a6aa8' } },
    books: { m: ['', '.kkkkkkkkk', '.krrrrrrrk', '.krRRRRRrk', '.kkkkkkkkk', 'kbbbbbbbbbk', 'kbBBBBBBBbk', 'kkkkkkkkkkk', '.kggggggggk', '.kgGGGGGGgk', '.kkkkkkkkkk'], p: { k: '#1c120a', r: '#a03028', R: '#e8c050', b: '#2a5a9a', B: '#e8e0c8', g: '#3a7a3a', G: '#e8c050' } },
    steel: { m: ['', '', '..kkkkkkkk', '.kwwwwwwwwk', 'kwLwwwwwwgk', 'kggggggggdk', 'kkkkkkkkkk', '..kkkkkkkk', '.kwwwwwwwwk', 'kggggggggdk', 'kkkkkkkkkk'], p: { k: '#1a1e26', w: '#b8c8d8', L: '#ffffff', g: '#7a8a9a', d: '#4a5664' } },
    machinery: { m: ['....kk', '..k.kk.k', '.kkkggkkk', '..kgyygk', 'kkgy..ygkk', 'kkgy..ygkk', '..kgyygk', '.kkkggkkk', '..k.kk.k', '....kk'], p: { k: '#2a1e10', g: '#c08a3a', y: '#e8c050' } },
    hammer: { m: ['', '.kkkkkk', 'kggggggk', 'kgggggdk', '.kkbbkk', '...kbk', '....kbk', '.....kbk', '......kbk', '.......kk'], p: { k: '#1c1c22', g: '#a8a8b2', d: '#6a6a72', b: '#8a5a30' } },
    compass: { m: ['...kkkkk', '..kwwrwwk', '.kwwwrwwwk', 'kwwwrrrwwwk', 'kwwkrrrkwwk', 'kwwwbbbwwwk', 'kwwwwbwwwwk', '.kwwwbwwwk', '..kwwwwwk', '...kkkkk'], p: { k: '#3a2410', w: '#efe6d0', r: '#c03028', b: '#2a4a8a' } },
    scroll: { m: ['', '.kkkkkkkkk', 'kyLLLLLLLyk', '.kLkkkkkLk', '.kLLLLLLLk', '.kLkkkkLLk', '.kLLLLLLLk', '.kLkkkkkLk', 'kyLLLLLLLyk', '.kkkkkkkkk'], p: { k: '#4a3010', y: '#a07040', L: '#efe0b8' } },
  };
  Object.assign(ICON_MAPS, {
    crystal: { m: ['', '.....kk', '....kLwk', '...kLwwgk', '..kLwwggk.k', '..kLwwgk.kLk', '.kLwwggkkLgk', '.kLwwgk.kLgk', '.kwwggkkLwgk', '..kgggk.kggk', '...kkk...kk'], p: { k: '#1a2a3a', L: '#e8fbff', w: '#8ae0f0', g: '#3a9ac0' } },
    hide: { m: ['', '.kk......kk', '.kbk....kbk', '..kbbbbbbk', '.kbbBbbBbbk', '.kbBbbbbBbk', '..kbbbbbbk', '..kbBbbBbk', '.kbbbbbbbbk', '.kbk....kbk', '.kk......kk'], p: { k: '#2a1a10', b: '#b0804e', B: '#7a5432' } },
    lore: { m: ['', '.kkkkkkkkk', 'kyyyyyyyyyk', '.kyrryrryk', '.kyyyyyyyk', '.kyrryyryk', '.kyyyyyyyk', '.kyrrryryk', 'kyyyyyyyyyk', '.kkkkkkkkk'], p: { k: '#4a3418', y: '#efe2b8', r: '#7a3aa0' } },
    starIron: { m: ['.......s', '......sSs', '.......s', '...kkkkk', '..kmmMmmk', '.kmMmmmmMk', '.kmmmbmmmk', 'kmmMmmmbmmk', 'kmmmmMmmmk', '.kbmmmmmbk', '..kkkkkkk'], p: { k: '#141a28', m: '#5a6a8a', M: '#a8c0e8', b: '#2e3850', s: '#fff4b0', S: '#ffffff' } },
    scale: { m: ['', '....kkkk', '...krrrrk', '..krRRrrrk', '.krRrrrrork', '.krrrrrrrok', '.krrrrrrook', '..krrrrook', '...krrook', '....kook', '.....kk'], p: { k: '#3a0a08', r: '#c83a28', R: '#ff8a5a', o: '#8a1a14' } },
    // Barra lateral del celular: antes tres botones tenían la misma persona y dos la misma brújula (playtest)
    idle: { m: ['......kkkk', '.....kwwk', '....kkkk.kk', '...kssssk.', '...kssssk', '...kssssk', '....kkkk', '..kkyyyykk', '.kyyyyyyyyk', '.kyyyyyyyyk', '.kkkkkkkkkk'], p: { k: '#1c1c2a', s: '#e8c4a0', y: '#c89a3a', w: '#efe6d0' } },
    map: { m: ['', 'kkkk.kkkk.kk', 'kggkkyykkbbk', 'kgggkyyykbbk', 'kggrkyyykbbk', 'kgrgkyrykbbk', 'kgggkyyrkbrk', 'kgggkyyykbbk', 'kggkkyykkbbk', 'kkkk.kkkk.kk'], p: { k: '#3a2410', g: '#7ab05a', y: '#e8d8a0', b: '#6aa0d8', r: '#c03028' } },
    crown: { m: ['', '', 'k...k...k', 'kyk.kyk.kyk', 'kyykkyykkyyk', 'kyyyyyyyyyyk', 'kyyryyyyryyk', 'kyyyyyyyyyyk', 'kooooooooook', '.kkkkkkkkkk'], p: { k: '#4a3008', y: '#f0c850', o: '#c08a28', r: '#c03028' } },
    cart: { m: ['', '', 'k........', 'kk.......', '.kbbbbbbbbk', '.kbBbbBbbbk', '.kbbbbbbbbk', '.kkkkkkkkkk', '..kgk..kgk', '..kkk..kkk'], p: { k: '#2a1a10', b: '#a07040', B: '#e8c050', g: '#a0a0aa' } },
    wall: { m: ['', 'kk.kk.kk.kk', 'kgkkgkkgkkgk', 'kggggggggggk', 'kgdggggdgggk', 'kggggdgggggk', 'kgggggggdggk', 'kgdgggggggk', 'kggggdggggk', 'kkkkkkkkkkk'], p: { k: '#2e2e30', g: '#a8a498', d: '#6a665e' } },
  });
  const ROCK_PAL = {
    stone: { k: '#2e2e30', w: '#d0ccc2', g: '#9a968c', d: '#66625c' },
    gold: { k: '#4a3408', w: '#fff0a0', g: '#e8b83a', d: '#a87a18' },
    ore: { k: '#2a1810', w: '#e09a70', g: '#a8583a', d: '#6a3424' },
    marble: { k: '#5a5850', w: '#ffffff', g: '#e2e0d8', d: '#b0aea4' },
  };
  const ICONS = {};
  S.icon = function (name) {
    if (ICONS[name]) return ICONS[name];
    let def = ICON_MAPS[name];
    if (ROCK_PAL[name]) def = { m: ICON_MAPS.rock.m, p: ROCK_PAL[name] };
    if (!def) return '';
    const c = mk(12, 12), ctx = c.getContext('2d');
    def.m.forEach((row, y) => { for (let x = 0; x < row.length && x < 12; x++) { const col = def.p[row[x]]; if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } } });
    return (ICONS[name] = c.toDataURL());
  };

  // Soldados: el aldeano vestido de tropa (ver S.villager). Retratos para la interfaz del Cuartel, ampliados x2.
  const TROOP_LOOK = { militia: [0, 0], spear: [1, 1], archer: [2, 0], knight: [1, 2], cleric: [3, 1], catapult: [1, 0] };
  S.troop = function (type, col, mode, frame, flip, back, tool, id) {
    const lk = TROOP_LOOK[type] || [0, 0], v = id === undefined ? 0 : id % 3;
    return S.villager(col, (lk[0] + v) % 4, (lk[1] + v) % 3, mode, frame, null, flip, tool || null, false, back, null, type);
  };
  S.troopIcon = function (type) {
    const key = 'troop_' + type;
    if (ICONS[key]) return ICONS[key];
    const spr = S.troop(type, PK.D.PLAYER_COLOR, 'idle', 0, false, false), c = mk(spr.c.width, spr.c.height), ctx = c.getContext('2d');
    ctx.drawImage(spr.c, 0, 0);
    return (ICONS[key] = c.toDataURL());
  };

  S.buildingIcon = function (type, owner, lvl) {
    const key = 'b_' + type + (owner || 'p') + bkey(type, lvl);
    if (ICONS[key]) return ICONS[key];
    const spr = S.building(type, owner || 'p', lvl);
    const size = 48, c = mk(size, size), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const s = Math.min(size / spr.c.width, size / spr.c.height);
    const w = spr.c.width * s, h = spr.c.height * s;
    ctx.drawImage(spr.c, (size - w) / 2, (size - h) / 2, w, h);
    return (ICONS[key] = c.toDataURL());
  };

  // ---------- Terreno ----------
  const GR1 = [92, 128, 50], GR2 = [72, 112, 40], GR3 = [108, 136, 58];
  const FF1 = [58, 82, 34], FF2 = [70, 90, 40];
  const DI1 = [128, 102, 66], DI2 = [112, 90, 58];
  const SA1 = [198, 178, 124], SA2 = [180, 160, 108];
  const WS = [62, 116, 146], WD = [30, 66, 104];

  // El terreno se pinta por trozos de 16x16 casillas, solo los que están a la vista (y se guardan unos
  // cuantos en memoria). Un mapa de 256x256 entero sería una imagen de 8192x4096: demasiado para un celular.
  S.renderGroundChunk = function (W, chx, chy) {
    const CH = W.CH, x0 = chx * CH, y0 = chy * CH, Wd = W.W, Ht = W.H, seed = W.seed;
    const gx0 = (x0 - y0 - CH) * 16 + Ht * 16, gy0 = (x0 + y0) * 8, cw = CH * 32, ch = CH * 16 + 2;
    const c = mk(cw, ch), ctx = c.getContext('2d');
    const im = ctx.createImageData(cw, ch), d = im.data;
    // campos de ruido en una grilla global (4 muestras por casilla), solo alrededor de este trozo
    const RES = 4, M = 2, fx0 = x0 - M, fy0 = y0 - M, fw = (CH + 2 * M) * RES + 2, fh = fw;
    const shadeF = new Float32Array(fw * fh), mixF = new Float32Array(fw * fh), wxF = new Float32Array(fw * fh), wyF = new Float32Array(fw * fh);
    for (let fy = 0; fy < fh; fy++) for (let fx = 0; fx < fw; fx++) {
      const tx = fx0 + fx / RES, ty = fy0 + fy / RES, i = fy * fw + fx;
      const e0 = U.fbm((tx - 0.6) / 14, ty / 14, seed + 1, 4), e1 = U.fbm((tx + 0.6) / 14, ty / 14, seed + 1, 4);
      shadeF[i] = U.clamp(1 + (e0 - e1) * 4.2, 0.84, 1.16);
      mixF[i] = U.fbm(tx * 0.22, ty * 0.22, seed + 5, 3);
      wxF[i] = (U.noise(tx * 0.9, ty * 0.9, seed + 11) - 0.5) * 0.9;
      wyF[i] = (U.noise(tx * 0.9, ty * 0.9, seed + 13) - 0.5) * 0.9;
    }
    const samp = (F, tx, ty) => {
      const fx = U.clamp((tx - fx0) * RES, 0, fw - 2), fy = U.clamp((ty - fy0) * RES, 0, fh - 2);
      const xa = fx | 0, ya = fy | 0, ax = fx - xa, ay = fy - ya, i = ya * fw + xa;
      return (F[i] * (1 - ax) + F[i + 1] * ax) * (1 - ay) + (F[i + fw] * (1 - ax) + F[i + fw + 1] * ax) * ay;
    };
    const wdist = W.waterDist;
    const sampW = (tx, ty) => {
      const fx = U.clamp(tx - 0.5, 0, Wd - 1.001), fy = U.clamp(ty - 0.5, 0, Ht - 1.001);
      const xa = fx | 0, ya = fy | 0, ax = fx - xa, ay = fy - ya, i = ya * Wd + xa;
      return (wdist[i] * (1 - ax) + wdist[i + 1] * ax) * (1 - ay) + (wdist[i + Wd] * (1 - ax) + wdist[i + Wd + 1] * ax) * ay;
    };
    const ox = Ht * 16;
    for (let ly = 0; ly < ch; ly++) {
      const py = gy0 + ly, b = py / 8;
      for (let lx = 0; lx < cw; lx++) {
        const px = gx0 + lx, a = (px - ox) / 16, tx = (a + b) / 2, ty = (b - a) / 2;
        if (tx < x0 || ty < y0 || tx >= x0 + CH || ty >= y0 + CH || tx >= Wd || ty >= Ht) continue;
        const wx = U.clamp(tx + samp(wxF, tx, ty), 0, Wd - 0.01), wy = U.clamp(ty + samp(wyF, tx, ty), 0, Ht - 0.01);
        const T = W.terrain[(wy | 0) * Wd + (wx | 0)];
        const sh = samp(shadeF, tx, ty), mx = samp(mixF, tx, ty), h = U.hash(px, py, 3);
        let col;
        if (T === 4) {
          const dep = sampW(tx, ty);
          col = mix(WS, WD, U.clamp((dep - 0.3) / 3.5, 0, 1));
          const rip = Math.sin(px * 0.21 + py * 0.9 + U.noise(px * 0.05, py * 0.1, 7) * 6);
          if (rip > 0.94) col = sc(col, 1.18);
          if (dep < 0.55 && h > 0.6) col = mix(col, [170, 200, 210], 0.35);
          col = sc(col, 0.97 + h * 0.05);
        } else {
          if (T === 0) {
            col = mix(GR2, GR1, U.clamp((mx - 0.35) * 2.4, 0, 1));
            if (mx > 0.62) col = mix(col, GR3, (mx - 0.62) * 2);
            if (h > 0.985) col = sc(col, 1.2); else if (h < 0.012) col = sc(col, 0.78);
            if (h > 0.9994) col = U.hash(px, py, 9) > 0.5 ? [232, 222, 120] : [226, 226, 236];
          } else if (T === 1) {
            col = mix(FF1, FF2, mx);
            if (h > 0.93) col = [84, 66, 40]; else if (h < 0.05) col = sc(col, 0.8);
          } else if (T === 2) {
            col = mix(DI2, DI1, mx);
            if (h > 0.97) col = sc(col, 1.18); else if (h < 0.03) col = sc(col, 0.75);
          } else {
            col = mix(SA2, SA1, mx);
            if (h > 0.96) col = sc(col, 0.9);
          }
          col = sc(col, sh * (0.96 + h * 0.08));
        }
        const i = (ly * cw + lx) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);
    return { c, x: gx0, y: gy0 };
  };

  // Coordenadas dentro de una casilla isométrica de 32x16: u avanza hacia +x, v hacia +y (0..1).
  function tileUV(px, py) { const a = (px + 0.5 - 16) / 16, b = (py + 0.5) / 8; return [(a + b) / 2, (b - a) / 2]; }

  // Camino de tierra apisonada. mask: 1 = sigue hacia -y, 2 = +x, 4 = +y, 8 = -x.
  const ROADC = {};
  S.road = function (mask) {
    if (ROADC[mask]) return ROADC[mask];
    const pb = new PB(32, 16), m = 0.24;
    for (let py = 0; py < 16; py++) for (let px = 0; px < 32; px++) {
      const [u, v] = tileUV(px, py);
      if (u < 0 || v < 0 || u > 1 || v > 1) continue;
      const inN = v < m, inS = v > 1 - m, inE = u > 1 - m, inW = u < m;
      if ((inN && !(mask & 1)) || (inS && !(mask & 4)) || (inE && !(mask & 2)) || (inW && !(mask & 8))) continue;
      if ((inN || inS) && (inE || inW)) continue; // esquinas: el camino dobla redondeado
      const edge = Math.min(mask & 1 ? 1 : v - m, mask & 4 ? 1 : 1 - m - v, mask & 2 ? 1 : 1 - m - u, mask & 8 ? 1 : u - m);
      const h = U.hash(px, py, 77 + mask);
      let col = mix([146, 118, 80], [168, 140, 98], U.hash(px >> 1, py, 5));
      if (edge < 0.06) col = sc(col, 0.78);
      if (h > 0.93) col = [120, 98, 68]; else if (h < 0.04) col = [196, 180, 150];
      pb.set(px, py, col, edge < 0.03 ? 170 : 235);
    }
    return (ROADC[mask] = { c: pb.canvas(), ox: 16, oy: 0 });
  };

  // Cinta transportadora: rieles de acero y tablillas que avanzan (4 cuadros). inD/outD: 'N','E','S','W'.
  const BELTC = {};
  const DUV = { N: [0.5, 0], S: [0.5, 1], E: [1, 0.5], W: [0, 0.5] };
  S.belt = function (inD, outD, phase) {
    const key = inD + outD + phase;
    if (BELTC[key]) return BELTC[key];
    const pb = new PB(32, 16), half = 0.26;
    // distancia a lo largo del recorrido: de la entrada al centro (0..0.5) y del centro a la salida (0.5..1)
    const along = (u, v) => {
      const a = DUV[inD], b = DUV[outD];
      const da = Math.hypot(u - a[0], v - a[1]), db = Math.hypot(u - b[0], v - b[1]);
      return da <= 0.5 && da <= db ? da : 1 - Math.min(0.5, db);
    };
    const inBand = (u, v, D2) => {
      const p = DUV[D2];
      if (p[0] === 0.5) return Math.abs(u - 0.5) <= half && (p[1] === 0 ? v <= 0.5 + half : v >= 0.5 - half);
      return Math.abs(v - 0.5) <= half && (p[0] === 0 ? u <= 0.5 + half : u >= 0.5 - half);
    };
    for (let py = 0; py < 16; py++) for (let px = 0; px < 32; px++) {
      const [u, v] = tileUV(px, py);
      if (u < 0 || v < 0 || u > 1 || v > 1) continue;
      if (!inBand(u, v, inD) && !inBand(u, v, outD)) continue;
      const axisIn = DUV[inD][0] === 0.5 ? Math.abs(u - 0.5) : Math.abs(v - 0.5), axisOut = DUV[outD][0] === 0.5 ? Math.abs(u - 0.5) : Math.abs(v - 0.5);
      const side = Math.min(inBand(u, v, inD) ? axisIn : 9, inBand(u, v, outD) ? axisOut : 9);
      let col;
      if (side > half - 0.06) col = [176, 186, 198];              // riel
      else {
        const t = along(u, v) * 5 - phase / 4;
        col = (t - Math.floor(t)) < 0.35 ? [74, 70, 66] : [46, 43, 41]; // tablillas
      }
      if (side > half - 0.025) col = [60, 64, 72];
      pb.set(px, py, col);
    }
    return (BELTC[key] = { c: pb.canvas(), ox: 16, oy: 0 });
  };

  S.TERRAIN_MM = [[86, 124, 48], [52, 78, 32], [124, 100, 64], [194, 174, 120], [36, 76, 116]];
  S.NODE_MM = { tree: [30, 58, 26], berry: [150, 60, 90], deer: [170, 120, 70], stone: [170, 168, 160], gold: [240, 200, 70], ore: [180, 90, 60], marble: [240, 240, 232], gems: [90, 170, 230] };

  S.init = function () {
    S.trees = { oak: [], pine: [], aut: [] };
    for (let i = 0; i < 6; i++) { S.trees.oak.push(makeOak(100 + i)); S.trees.pine.push(makePine(200 + i)); }
    for (let i = 0; i < 2; i++) S.trees.aut.push(makeOak(300 + i, AUT));
    S.stump = makeStump();
    S.bush = [makeBush(11, true), makeBush(12, true), makeBush(13, true)];
    S.bushBare = makeBush(14, false);
    S.rocks = {};
    for (const k of ['stone', 'gold', 'ore', 'marble', 'gems']) S.rocks[k] = [0, 1, 2].map(sz => [makeRocks(k, 40 + sz, sz), makeRocks(k, 50 + sz, sz)]);
    S.deer = [makeDeer(61, false), makeDeer(62, true), makeDeer(63, false), makeDeer(64, true)];
    S.deerGold = [makeDeer(65, false, true), makeDeer(66, true, true)];
    S.wolf = [[makeWolf(0, false), makeWolf(1, false)], [makeWolf(0, true), makeWolf(1, true)]];
  };
})();
