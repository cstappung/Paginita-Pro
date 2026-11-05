// Arte del Archipiélago de Bruma (Fase 9, pk-28): íconos, recursos del mapa y el dibujo propio de cada edificio en el
// mar. Usa las herramientas de sprites.js (PB, el pintor isométrico de BDRAW, la sombra) y solo se nota con
// D.temaActivo === 'mar': en la tierra nada de esto se dibuja.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, Sp = PK.Sprites;
  const { PB, ramp, LIGHT } = Sp;

  // ---------- Íconos (12x12, el mismo formato que ICON_MAPS) ----------
  Object.assign(Sp.ICON_MAPS, {
    food_mar: { m: ['', '', '.......kk', '..kkkkkbbk', '.kbbbbbbbbk', 'kbwbLbbbbbbk', 'kbbbbbbbbbbk', '.kbbbLLbbbk', '..kkkkkbbk', '.......kk'], p: { k: '#1a2a3a', b: '#6aa0c8', L: '#c8e4f4', w: '#ffffff' } },
    wood_mar: { m: ['', '..kkkkkkkkk', '.kyyykrrrrrk', '.kyoykrRrrrk', '.kyyykrrrrrk', '..kkkkkkkkk', '..kkkkkkkkk', '.kyyykrrrrrk', '.kyoykrrrRrk', '.kyyykrrrrrk', '..kkkkkkkkk'], p: { k: '#2a140a', y: '#e0a070', o: '#a0582e', r: '#8a4424', R: '#5e2c16' } },
    stone_mar: { m: ['', '...k...k', '..kpk.kpk.k', '..kpk.kpkkpk', '.k.kpkpk.kpk', 'kpk.kppk.kpk', '.kpkkpkkpk', '..kppppppk', '...kpppk', '...kpppk', '..kkkkkkk'], p: { k: '#5a1a24', p: '#f07a8a' } },
    fibra: { m: ['', '.g.......g', '..g.....g', '...g...g', '..gGgggGg', '.gGGGGGGGg', '..ybybybyb', '..bybybybk', '..ybybybyb', '..byybybyb', '..kkkkkkkk'], p: { k: '#3a2a10', g: '#3a8a3a', G: '#7ac05a', y: '#e0c070', b: '#b08a40' } },
    salitre: { m: ['', '', '....kkk', '...kwwwk', '..kwwLwwk', '.kwwwwwgwk', '.kwwLwwggk', 'kwwwwwwwggk', 'kgwwwwwgggk', '.kkkkkkkkk'], p: { k: '#4a4a52', w: '#f4f4f0', L: '#ffffff', g: '#c8c8c0' } },
    especias: { m: ['', '...kkkkkk', '..koooooook', '.korrorrook', '.koorroorok', '..kkkkkkkk', '..kbbbbbbk', '.kbbBbbBbbk', '.kbbbbbbbbk', '.kbbbbbbbbk', '..kkkkkkkk'], p: { k: '#3a1a08', o: '#e08a30', r: '#c03a20', b: '#a87a48', B: '#7a5428' } },
    lona: { m: ['', '.kkkkkkkkkk', '.kwwwwwwwwk', '.kwLwwwwwwk', '.kwwwwwwwwk', '.kwwwwwLwwk', '.kwwwwwwwwk', '.kkkkkkkkkk', '..b.b.b.b', '.b.b.b.b', '..b.b.b.b'], p: { k: '#6a5a40', w: '#efe6cc', L: '#ffffff', b: '#a07a48' } },
    tablazon: { m: ['', 'kkkkkkkkkkkk', 'krrrrrrrrrrk', 'kRRRRRRRRRRk', 'kkkkkkkkkkkk', 'krrrrrrrrrrk', 'kRRRRwRRRRRk', 'kkkkkkkkkkkk', 'krrrrrrrrrrk', 'kRRRRRRRRRRk', 'kkkkkkkkkkkk'], p: { k: '#2a140a', r: '#b0683a', R: '#8a4a28', w: '#f4f4f0' } },
    polvora: { m: ['....kk', '.....k', '...kkkkk', '..kbbbbbk', '.kbbbbbbbk', '.kddddddddk', '.kbbbbbbbk', '.kbbrrbbbk', '.kddddddddk', '.kbbbbbbbk', '..kkkkkkk'], p: { k: '#1a1008', b: '#8a5a30', d: '#4a3018', r: '#c03028' } },
  });

  // ---------- Recursos del mapa ----------
  const TEC = [[22, 52, 30], [32, 72, 38], [44, 92, 46], [62, 116, 56], [86, 140, 66]];
  function makeTeca(seed) {
    const r = U.rng(seed), w = 30, h = 42, pb = new PB(w, h), base = 39;
    Sp.sombra(pb, 18, base - 1, 9, 2, 70);
    for (let y = base; y >= 18; y--) { pb.set(14, y, [92, 58, 34]); pb.set(15, y, [72, 44, 26]); pb.set(16, y, [54, 34, 20]); }
    const blobs = [];
    for (let i = 0; i < 6; i++) blobs.push({ x: 15 + (r() - 0.5) * 14, y: 12 + r() * 10, r: 5 + r() * 3 });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = -99, bn = null;
      for (const b of blobs) {
        const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / (b.r * 0.8), d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2), zt = nz * b.r - b.y * 0.2;
        if (zt > best) { best = zt; bn = [dx, dy, nz]; }
      }
      if (!bn) continue;
      const l = (bn[0] * LIGHT[0] + bn[1] * LIGHT[1] + bn[2] * LIGHT[2]) * 0.5 + 0.5 + (U.hash(x, y, seed) - 0.5) * 0.3;
      pb.set(x, y, ramp(TEC, l));
    }
    return Sp.withMask({ c: pb.canvas(), ax: 15, ay: base - 1 });
  }
  // Coral: ramas de colores sobre la arena; con la marea alta se ve bajo el agua (`hundido`).
  function makeArrecife(seed, hundido) {
    const r = U.rng(seed), w = 30, h = 22, pb = new PB(w, h), cx = 15, cy = 15;
    const agua = [64, 140, 176];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - cx) / 13, dy = (y - cy) / 6;
      if (dx * dx + dy * dy <= 1) pb.set(x, y, hundido ? [70, 150, 180] : [214, 196, 140], hundido ? 200 : 255);
    }
    const cols = [[240, 110, 130], [250, 160, 90], [190, 90, 200], [250, 230, 120]];
    for (let i = 0; i < 7; i++) {
      const bx = cx + (r() - 0.5) * 20, by = cy + (r() - 0.5) * 6, c = cols[Math.floor(r() * cols.length)], ht = 4 + r() * 6;
      for (let k = 0; k < ht; k++) {
        const x = bx + Math.sin(k * 0.9 + i) * 1.2, y = by - k;
        pb.set(x, y, k > ht - 2 ? Sp.mix(c, [255, 255, 255], 0.35) : c);
        if (k % 3 === 2) { pb.set(x - 1, y, c); pb.set(x + 1, y - 1, c); }
      }
    }
    if (hundido) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (U.hash(x, y, seed) > 0.4) pb.set(x, y, agua, 120);
    return Sp.withMask({ c: pb.canvas(), ax: cx, ay: cy + 1 });
  }
  function makeAlmeja(seed) {
    const r = U.rng(seed), w = 20, h = 12, pb = new PB(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x - 10) / 9, dy = (y - 7) / 4; if (dx * dx + dy * dy <= 1) pb.set(x, y, [200, 184, 130]); }
    for (let i = 0; i < 7; i++) {
      const x = 3 + r() * 14, y = 4 + r() * 6, c = r() < 0.5 ? [236, 226, 210] : [210, 170, 150];
      pb.set(x, y, c); pb.set(x + 1, y, c); pb.set(x, y - 1, Sp.mix(c, [255, 255, 255], 0.5)); pb.set(x + 1, y + 1, [120, 100, 80]);
    }
    return Sp.withMask({ c: pb.canvas(), ax: 10, ay: 8 });
  }
  function makeSalitral(seed, sz) {
    const r = U.rng(seed), w = 30, h = 22, pb = new PB(w, h), cx = 15, cy = 15;
    Sp.sombra(pb, cx + 2, cy + 2, 11, 3, 70);
    const n = [2, 4, 6][sz];
    for (let i = 0; i < n; i++) {
      const bx = cx + (r() - 0.5) * 16, by = cy + (r() - 0.5) * 5, rad = 2.5 + r() * 2;
      for (let y = Math.floor(by - rad * 1.3); y <= by + rad * 0.7; y++) for (let x = Math.floor(bx - rad); x <= bx + rad; x++) {
        const dx = (x - bx) / rad, dy = (y - by) / (y < by ? rad * 1.3 : rad * 0.7);
        if (dx * dx + dy * dy > 1) continue;
        const l = 0.55 - dx * 0.25 - dy * 0.2 + (U.hash(x, y, seed + i) - 0.5) * 0.2;
        pb.set(x, y, ramp([[120, 110, 100], [170, 164, 152], [214, 210, 200], [240, 238, 232], [255, 255, 252]], l));
      }
    }
    return Sp.withMask({ c: pb.canvas(), ax: cx, ay: cy + 1 });
  }
  function makeEspecia(seed, pelado) {
    const r = U.rng(seed), w = 18, h = 16, pb = new PB(w, h), cx = 9, base = 13;
    Sp.sombra(pb, cx + 2, base, 7, 2, 70);
    const blobs = [{ x: cx, y: 8, r: 5 }, { x: cx - 3.5, y: 10, r: 3.4 }, { x: cx + 3.5, y: 10, r: 3.4 }, { x: cx + (r() - 0.5) * 3, y: 5, r: 3 }];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = -99, bn = null;
      for (const b of blobs) { const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / b.r, d2 = dx * dx + dy * dy; if (d2 > 1) continue; const nz = Math.sqrt(1 - d2); if (nz * b.r > best) { best = nz * b.r; bn = [dx, dy, nz]; } }
      if (!bn) continue;
      const l = (bn[0] * LIGHT[0] + bn[1] * LIGHT[1] + bn[2] * LIGHT[2]) * 0.5 + 0.5;
      pb.set(x, y, ramp(pelado ? [[70, 60, 34], [96, 84, 46], [120, 106, 60]] : [[24, 70, 30], [40, 104, 40], [70, 140, 52], [110, 170, 70]], l));
      if (!pelado && U.hash(x, y, seed + 3) > 0.8 && bn[2] > 0.3) pb.set(x, y, U.hash(x, y, seed) > 0.5 ? [220, 60, 30] : [240, 150, 40]);
    }
    return Sp.withMask({ c: pb.canvas(), ax: cx, ay: base });
  }
  function makeNaufragio(seed) {
    const r = U.rng(seed), w = 34, h = 24, pb = new PB(w, h);
    Sp.sombra(pb, 18, 18, 14, 3, 80);
    // casco partido y tablas
    for (let x = 4; x < 30; x++) {
      const top = 10 + Math.round(Math.abs(x - 17) * 0.25 + (x > 20 ? (x - 20) * 0.5 : 0)), bot = 18;
      for (let y = top; y <= bot; y++) pb.set(x, y, y === top ? [150, 96, 54] : (y + x) % 4 === 0 ? [70, 42, 24] : [104, 64, 36]);
    }
    for (let k = 0; k < 4; k++) { const x0 = 8 + k * 5; for (let y = 4 + r() * 3; y < 11; y++) pb.set(x0, y, [84, 54, 30]); } // costillas
    for (let y = 1; y < 10; y++) pb.set(14, y, [70, 46, 26]); // mástil roto
    // cofre
    for (let y = 14; y < 19; y++) for (let x = 20; x < 27; x++) pb.set(x, y, y === 14 ? [200, 150, 50] : y === 16 ? [232, 190, 70] : [130, 80, 40]);
    pb.set(23, 16, [255, 240, 160]);
    return Sp.withMask({ c: pb.canvas(), ax: 17, ay: 19 });
  }

  Sp.initMar = function () {
    Sp.trees.teca = [0, 1, 2, 3].map(i => makeTeca(700 + i));
    Sp.mar = {
      arrecife: [0, 1].map(i => makeArrecife(720 + i, false)),
      arrecifeHundido: [0, 1].map(i => makeArrecife(720 + i, true)),
      almeja: [0, 1, 2].map(i => makeAlmeja(730 + i)),
      salitral: [0, 1, 2].map(sz => makeSalitral(740 + sz, sz)),
      especia: [0, 1].map(i => makeEspecia(750 + i, false)),
      especiaPelada: makeEspecia(752, true),
      naufragio: [0, 1].map(i => makeNaufragio(760 + i)),
    };
  };
  // render.js pregunta aquí por los recursos propios del mar
  Sp.nodoMar = function (n, baja) {
    const M = Sp.mar;
    if (!M) return null;
    switch (n.kind) {
      case 'palma': return n.dead ? Sp.stump : Sp.trees.palm[n.v % Sp.trees.palm.length];
      case 'arrecife': return (baja ? M.arrecife : M.arrecifeHundido)[n.v % 2];
      case 'almeja': return n.dead ? null : M.almeja[n.v % 3];
      case 'salitral': { const q = n.amount / n.max; return M.salitral[q > 0.5 ? 2 : q > 0.15 ? 1 : 0]; }
      case 'especia': return n.dead || n.amount < n.max * 0.15 ? M.especiaPelada : M.especia[n.v % 2];
      case 'naufragio': return n.dead ? null : M.naufragio[n.v % 2];
    }
    return null;
  };
  Sp.NODE_MM_MAR = { palma: [80, 150, 60], arrecife: [240, 120, 140], almeja: [230, 220, 200], salitral: [240, 240, 236], especia: [220, 90, 40], naufragio: [200, 150, 60] };

  // ---------- Edificios del mar ----------
  // Madera clara, techos de palma (thatch), pilotes y mucha agua alrededor. El color del reino va en banderas y lonas.
  const SAND = '#d8c48a', SAND2 = '#c8b07a', AGUA = '#5aa0c8', TECA = '#9a5a34', LONA = '#efe6cc';
  const suelo = (p, w, h, c) => p.fill([p.P(0, 0, 0), p.P(w, 0, 0), p.P(w, h, 0), p.P(0, h, 0)], c || SAND, 1, 0);
  const pilotes = (p, x, y, w, h, ht) => { for (const [a, b] of [[x, y], [x + w - 0.14, y], [x, y + h - 0.14], [x + w - 0.14, y + h - 0.14]]) p.post(a, b, ht); };
  const tarima = (p, x, y, w, h, z) => p.box(x, y, w, h, z - 2, z, 'plank', 'darkwood', 'plank');
  function chozaPilotes(p, b, z, alto, techo) {
    pilotes(p, b.x, b.y, b.w, b.h, z);
    tarima(p, b.x - 0.1, b.y - 0.1, b.w + 0.2, b.h + 0.2, z);
    p.box(b.x, b.y, b.w, b.h, z, z + alto, 'plank');
    p.roof(b.x, b.y, b.w, b.h, z + alto, techo || 12, 'thatch', 0.25, 0.3, 'x');
  }
  const BD = Sp.BDRAW_MAR;
  Object.assign(Sp.BTOP_MAR, { tc: 76, house: 40, mill: 34, muelle: 34, lumber: 30, mining: 26, granary: 40, warehouse: 40, builder: 36, tower: 64, salinas: 10, velas: 44, astillero: 50, polvorin: 34, faromar: 110, embarcadero: 44, comercio: 46, granfaro: 150, colonia: 40 });

  BD.tc = function (p, col, m, tier) { // Fortaleza del Puerto: murallas de piedra, torre y muelle de madera
    suelo(p, 4, 4);
    p.box(0.1, 2.9, 3.8, 1.0, 0, 2, 'plank', 'darkwood', 'plank'); // muelle delante
    const mu = { x: 0.2, y: 0.2, w: 3.0, h: 2.6 };
    p.box(mu.x, mu.y, mu.w, mu.h, 0, 14, 'stone', 'stone', 'paving');
    for (let i = 0; i < 6; i++) p.box(mu.x + i * 0.52, mu.y + mu.h - 0.25, 0.26, 0.25, 14, 17, 'stone'); // almenas
    const to = { x: 2.3, y: 0.3, w: 1.3, h: 1.3 };
    p.box(to.x, to.y, to.w, to.h, 0, 34, 'stone');
    for (let i = 0; i < 3; i++) p.box(to.x + i * 0.48, to.y + to.h - 0.2, 0.22, 0.2, 34, 38, 'stone');
    p.win(to, 'L', 0.65, 22, 0.3, 5); p.win(to, 'R', 0.65, 22, 0.3, 5);
    const sala = { x: 0.6, y: 0.5, w: 1.6, h: 1.7 };
    p.box(sala.x, sala.y, sala.w, sala.h, 14, 22, 'plaster');
    p.roof(sala.x, sala.y, sala.w, sala.h, 22, 12, 'tile', 0.4, 0.2, 'x');
    p.door(mu, 'L', 1.5, 0.7, 9, 0);
    p.quad(mu, 'L', 0.5, 0.75, 4, 12, col); p.quad(mu, 'L', 2.25, 2.5, 4, 12, col);
    p.flag(to.x + 0.65, to.y + 0.65, 38, col, 16);
    m.smoke.push(p.P(1.4, 1.3, 30));
  };
  BD.house = function (p, col) { // Cabaña sobre pilotes
    suelo(p, 2, 2, SAND2);
    chozaPilotes(p, { x: 0.25, y: 0.25, w: 1.5, h: 1.5 }, 8, 10, 13);
    p.door({ x: 0.25, y: 0.25, w: 1.5, h: 1.5 }, 'L', 0.75, 0.42, 7, 8);
    p.win({ x: 0.25, y: 0.25, w: 1.5, h: 1.5 }, 'R', 0.75, 12, 0.3, 3);
    p.box(1.65, 1.0, 0.5, 0.14, 0, 8, 'darkwood'); // escalera
    p.quad({ x: 0.25, y: 0.25, w: 1.5, h: 1.5 }, 'R', 1.15, 1.35, 9, 16, col);
  };
  BD.mill = function (p, col) { // Lonja: galpón abierto con pescado colgado
    suelo(p, 2, 2);
    for (const [x, y] of [[0.15, 0.15], [1.7, 0.15], [0.15, 1.7], [1.7, 1.7]]) p.post(x, y, 14);
    p.box(0.3, 0.9, 1.4, 0.2, 6, 8, 'darkwood');
    for (let i = 0; i < 5; i++) p.box(0.4 + i * 0.27, 0.95, 0.1, 0.1, 2, 6, '#7aa8c8', '#5a88a8');
    p.box(0.3, 1.3, 0.6, 0.5, 0, 4, 'plank', 'darkwood', 'plank'); // cajón
    p.roof(0.05, 0.05, 1.9, 1.9, 14, 8, 'thatch', 0.5, 0.15, 'y');
    p.flag(1.85, 0.2, 14, col, 8);
  };
  BD.muelle = function (p, col) { // Cabaña de pescadores con red y bote
    suelo(p, 2, 2, SAND2);
    p.box(0.1, 1.2, 1.8, 0.7, 0, 3, 'plank', 'darkwood', 'plank');
    chozaPilotes(p, { x: 0.25, y: 0.2, w: 1.1, h: 1.0 }, 5, 9, 10);
    for (let i = 0; i < 4; i++) p.line(p.P(1.45 + i * 0.12, 0.2, 14), p.P(1.45 + i * 0.12, 1.1, 2), 'rgba(80,60,40,0.7)'); // red
    p.box(1.2, 1.4, 0.7, 0.35, 0, 3, TECA, '#7a4224', '#b06a3a'); // bote
    p.flag(0.3, 1.8, 3, col, 9);
  };
  BD.lumber = function (p) { // Aserradero de teca
    suelo(p, 2, 2);
    p.post(0.15, 0.15, 12); p.post(1.7, 0.15, 12); p.post(0.15, 1.7, 12); p.post(1.7, 1.7, 12);
    for (let i = 0; i < 3; i++) p.box(0.4, 0.5 + i * 0.32, 1.2, 0.28, i * 0, 3, '#8a4a2a', '#6a3418', '#c88a5a');
    p.box(0.4, 0.6, 1.2, 0.5, 3, 6, '#8a4a2a', '#6a3418', '#c88a5a');
    p.box(1.4, 1.3, 0.4, 0.4, 0, 6, '#b8a060', '#9a8448', '#d8c070'); // atados de fibra
    p.roof(0.05, 0.05, 1.9, 1.9, 12, 7, 'thatch', 0.6, 0.12, 'y');
  };
  BD.mining = function (p) { // Cantera de coral
    suelo(p, 2, 2);
    for (const [x, y, c] of [[0.3, 0.3, '#f07a8a'], [1.0, 0.4, '#f0a060'], [0.5, 1.1, '#e88aa0'], [1.2, 1.1, '#f4c070']]) p.box(x, y, 0.5, 0.5, 0, 4 + (x * 3 | 0), c, '#b85060', '#ffc0c8');
    p.post(0.1, 0.1, 10); p.post(1.8, 0.1, 10);
    p.box(0.1, 0.05, 1.84, 0.12, 10, 11, 'darkwood');
  };
  BD.granary = function (p, col, m) { // Ahumadero
    suelo(p, 2, 2);
    const b = { x: 0.3, y: 0.3, w: 1.4, h: 1.4 };
    p.box(b.x, b.y, b.w, b.h, 0, 12, 'plank');
    p.roof(b.x, b.y, b.w, b.h, 12, 14, 'thatch', 0.1, 0.2, 'x');
    p.door(b, 'L', 0.7, 0.4, 7);
    m.smoke.push(p.P(1.0, 1.0, 26)); m.smoke.push(p.P(1.2, 0.8, 26));
  };
  BD.warehouse = function (p, col) { // Bodega del puerto con barriles
    suelo(p, 3, 3);
    const b = { x: 0.3, y: 0.3, w: 2.4, h: 2.0 };
    p.box(b.x, b.y, b.w, b.h, 0, 14, 'plank');
    p.roof(b.x, b.y, b.w, b.h, 14, 12, 'thatch', 0.5, 0.2, 'x');
    p.door(b, 'L', 1.2, 0.8, 10);
    for (let i = 0; i < 3; i++) p.box(0.4 + i * 0.4, 2.45, 0.3, 0.3, 0, 5, '#8a5a30', '#6a4222', '#a87040');
    p.quad(b, 'R', 0.8, 1.2, 4, 12, col);
  };
  BD.builder = function (p, col) { // Casa del Carpintero de Ribera: costillas de un casco
    suelo(p, 2, 2);
    chozaPilotes(p, { x: 0.2, y: 0.2, w: 1.0, h: 1.0 }, 4, 9, 10);
    for (let i = 0; i < 4; i++) { const x = 1.25 + i * 0.16; p.line(p.P(x, 1.0, 0), p.P(x, 1.0, 8), '#7a4a24'); p.line(p.P(x, 1.8, 0), p.P(x, 1.8, 8), '#7a4a24'); }
    p.box(1.25, 1.0, 0.6, 0.8, 0, 1, TECA);
    p.flag(0.3, 1.8, 2, col, 9);
  };
  BD.tower = function (p, col) { // Torre de vigía de la costa
    pilotes(p, 0.1, 0.1, 0.8, 0.8, 26);
    p.box(0.1, 0.1, 0.8, 0.8, 26, 28, 'plank', 'darkwood', 'plank');
    p.box(0.2, 0.2, 0.6, 0.6, 28, 34, 'plank');
    p.roof(0.1, 0.1, 0.8, 0.8, 34, 9, 'thatch', 0.05, 0.1, 'x');
    p.flag(0.5, 0.5, 43, col, 10);
  };
  BD.salinas = function (p) { // estanques con montones de sal
    suelo(p, 3, 3, SAND2);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const x = 0.2 + i * 1.35, y = 0.2 + j * 1.35;
      p.fill([p.P(x, y, 0), p.P(x + 1.15, y, 0), p.P(x + 1.15, y + 1.15, 0), p.P(x, y + 1.15, 0)], (i + j) % 2 ? '#a8d0e0' : '#e8f0f0', 1, 0);
    }
    for (const [x, y] of [[1.25, 1.25], [2.6, 0.3]]) { p.box(x, y, 0.3, 0.3, 0, 4, '#f4f4f0', '#d0d0c8', '#ffffff'); }
  };
  BD.velas = function (p, col) { // Taller de Velas: una vela tendida
    suelo(p, 2, 2);
    const b = { x: 0.2, y: 0.4, w: 1.0, h: 1.3 };
    p.box(b.x, b.y, b.w, b.h, 0, 10, 'plank');
    p.roof(b.x, b.y, b.w, b.h, 10, 8, 'thatch', 0.3, 0.15, 'y');
    p.post(1.6, 0.2, 22); p.post(1.6, 1.7, 22);
    p.fill([p.P(1.65, 0.3, 21), p.P(1.65, 1.7, 21), p.P(1.65, 1.6, 6), p.P(1.65, 0.4, 8)], LONA, 1, 0);
    p.fill([p.P(1.65, 0.75, 18), p.P(1.65, 1.1, 18), p.P(1.65, 1.1, 10), p.P(1.65, 0.75, 10)], 'rgb(' + col.join(',') + ')', 1, 0);
  };
  BD.astillero = function (p, col) { // grada con un casco a medio armar y una grúa
    suelo(p, 3, 3);
    p.box(0.2, 0.9, 2.6, 1.2, 0, 2, 'plank', 'darkwood', 'plank');
    for (let i = 0; i < 6; i++) { const x = 0.5 + i * 0.36; p.line(p.P(x, 1.0, 2), p.P(x, 1.0, 12 - Math.abs(i - 2.5) * 1.5), '#8a4a24'); p.line(p.P(x, 2.0, 2), p.P(x, 2.0, 12 - Math.abs(i - 2.5) * 1.5), '#6a3418'); }
    p.box(0.45, 1.3, 2.1, 0.4, 2, 5, TECA, '#7a4224', '#b06a3a'); // quilla
    p.post(2.6, 0.3, 30); p.line(p.P(2.67, 0.37, 30), p.P(1.5, 1.4, 28), '#5a3a20'); p.line(p.P(1.5, 1.4, 28), p.P(1.5, 1.4, 14), '#3a2a18');
    p.box(0.2, 2.3, 0.8, 0.5, 0, 6, 'plank', 'darkwood', 'plank');
    p.flag(2.6, 2.6, 0, col, 12);
  };
  BD.polvorin = function (p) { // búnker de piedra con barriles y bandera roja
    suelo(p, 2, 2);
    const b = { x: 0.25, y: 0.25, w: 1.5, h: 1.3 };
    p.box(b.x, b.y, b.w, b.h, 0, 10, 'stone', 'stone', 'paving');
    p.roof(b.x, b.y, b.w, b.h, 10, 6, 'slate', 0.6, 0.05, 'x');
    p.door(b, 'L', 0.75, 0.45, 7);
    for (let i = 0; i < 2; i++) p.box(0.4 + i * 0.4, 1.65, 0.3, 0.3, 0, 5, '#6a4222', '#4a2e18', '#8a5a30');
    p.flag(1.7, 1.7, 0, [190, 40, 30], 14);
  };
  BD.faromar = function (p, col) { // Faro a rayas
    suelo(p, 2, 2, SAND2);
    p.box(0.1, 0.1, 1.8, 1.8, 0, 3, 'stone', 'stone', 'paving');
    const t = { x: 0.55, y: 0.55, w: 0.9, h: 0.9 };
    for (let k = 0; k < 6; k++) p.box(t.x, t.y, t.w, t.h, 3 + k * 10, 13 + k * 10, k % 2 ? '#c03028' : '#f0ece0', k % 2 ? '#902018' : '#c8c4b8');
    p.box(0.45, 0.45, 1.1, 1.1, 63, 65, 'darkwood', 'darkwood', 'plank');
    p.box(0.6, 0.6, 0.8, 0.8, 65, 73, '#fff4b0', '#e8c870', '#fffbe0');
    p.roof(0.55, 0.55, 0.9, 0.9, 73, 8, 'slate', 0.02, 0.02, 'x');
    p.door(t, 'L', 0.45, 0.32, 7, 3);
    p.flag(0.2, 1.8, 3, col, 9);
  };
  BD.embarcadero = function (p, col) { // muelle largo con un barco de colonos
    suelo(p, 3, 3);
    p.box(0.2, 1.8, 2.6, 0.7, 0, 3, 'plank', 'darkwood', 'plank');
    for (let i = 0; i < 4; i++) p.post(0.3 + i * 0.8, 2.4, 6);
    chozaPilotes(p, { x: 0.3, y: 0.3, w: 1.1, h: 1.1 }, 3, 9, 10);
    p.box(1.7, 0.4, 1.1, 1.0, 0, 5, TECA, '#7a4224', '#b06a3a'); // casco
    p.post(2.2, 0.85, 24);
    p.fill([p.P(2.25, 0.4, 22), p.P(2.25, 1.35, 22), p.P(2.25, 1.3, 8), p.P(2.25, 0.45, 9)], LONA, 1, 0);
    p.flag(2.27, 0.9, 24, col, 7);
  };
  BD.comercio = function (p, col) { // Casa de comercio: toldo a rayas y sacos de especias
    suelo(p, 3, 3);
    const b = { x: 0.3, y: 0.3, w: 2.2, h: 1.7 };
    p.box(b.x, b.y, b.w, b.h, 0, 14, 'plaster');
    p.roof(b.x, b.y, b.w, b.h, 14, 12, 'tile', 0.5, 0.2, 'x');
    p.door(b, 'L', 1.1, 0.6, 9); p.win(b, 'L', 0.45, 6, 0.3, 4); p.win(b, 'L', 1.75, 6, 0.3, 4);
    p.fill([p.P(0.3, 2.0, 9), p.P(2.5, 2.0, 9), p.P(2.5, 2.6, 5), p.P(0.3, 2.6, 5)], 'canvasR', 1, 0); // toldo
    for (const [x, c] of [[0.5, '#e08a30'], [0.9, '#c03a20'], [1.3, '#d0b040']]) p.box(x, 2.5, 0.3, 0.3, 0, 4, c, '#7a4a20', c);
    p.flag(2.4, 0.4, 26, col, 10);
  };
  BD.granfaro = function (p, col, m, tier, lvl) { // la Maravilla: un faro enorme sobre una isla de piedra
    suelo(p, 4, 4, SAND2);
    p.box(0.2, 0.2, 3.6, 3.6, 0, 8, 'stone', 'stone', 'paving');
    const fase = Math.min(6, Math.floor((lvl || 1) / 5));
    const t = { x: 1.2, y: 1.2, w: 1.6, h: 1.6 }, alto = 70 + fase * 8;
    for (let k = 0; k * 12 < alto; k++) p.box(t.x, t.y, t.w, t.h, 8 + k * 12, Math.min(8 + alto, 20 + k * 12), k % 2 ? '#2a6a8a' : 'marbleS', k % 2 ? '#1a4a6a' : 'marbleS');
    p.box(1.0, 1.0, 2.0, 2.0, 8 + alto, 11 + alto, 'marbleS', 'marbleS', 'paving');
    p.box(1.3, 1.3, 1.4, 1.4, 11 + alto, 23 + alto, '#fffbd0', '#f0d880', '#ffffff');
    p.roof(1.2, 1.2, 1.6, 1.6, 23 + alto, 12, fase >= 3 ? 'gilt' : 'verdigris', 0.02, 0.02, 'x');
    for (let i = 0; i < 4; i++) p.flag(0.3 + (i % 2) * 3.4, 0.3 + Math.floor(i / 2) * 3.4, 8, col, 12);
  };
  // ---------- La armada (pk-29) ----------
  Object.assign(Sp.BTOP_MAR, { barracks: 64, escuela: 42, bateria: 22, cadena: 30 });
  BD.barracks = function (p, col) { // Dársena de guerra: dique de piedra, galpón y una fragata en grada
    suelo(p, 3, 3, SAND2);
    p.box(0.1, 0.1, 2.8, 2.8, 0, 2, 'stone', 'stone', 'paving');
    const g = { x: 0.2, y: 0.2, w: 1.2, h: 1.3 };
    p.box(g.x, g.y, g.w, g.h, 2, 14, 'plank');
    p.roof(g.x, g.y, g.w, g.h, 14, 10, 'thatch', 0.3, 0.3, 'x');
    p.door(g, 'L', 0.6, 0.5, 9);
    p.box(1.6, 0.5, 1.2, 2.2, 2, 8, TECA, '#7a4224', '#b06a3a'); // el casco
    p.box(1.65, 0.55, 1.1, 2.1, 8, 9, 'plank', 'darkwood', 'plank');
    for (const [y, h] of [[1.0, 34], [2.0, 30]]) { p.post(2.2, y, h); p.fill([p.P(2.25, y - 0.45, h - 2), p.P(2.25, y + 0.45, h - 2), p.P(2.25, y + 0.4, 12), p.P(2.25, y - 0.4, 12)], LONA, 1, 0); }
    for (let i = 0; i < 3; i++) p.box(1.55, 0.8 + i * 0.6, 0.12, 0.12, 5, 6, '#22222a', '#14141a', '#3a3a44'); // cañones
    p.flag(2.27, 1.0, 34, col, 9);
  };
  BD.escuela = function (p, col) { // Escuela de navegantes: casa con una rosa de los vientos y un ancla
    suelo(p, 2, 2);
    const b = { x: 0.25, y: 0.25, w: 1.5, h: 1.3 };
    p.box(b.x, b.y, b.w, b.h, 0, 13, 'plaster');
    p.roof(b.x, b.y, b.w, b.h, 13, 10, 'tile', 0.5, 0.2, 'x');
    p.door(b, 'L', 0.75, 0.45, 8); p.win(b, 'L', 0.3, 6, 0.25, 4); p.win(b, 'L', 1.2, 6, 0.25, 4);
    p.box(0.3, 1.7, 0.25, 0.25, 0, 8, '#3a3a44', '#2a2a32', '#5a5a64'); // el ancla
    p.line(p.P(0.2, 1.8, 6), p.P(0.65, 1.8, 6), '#3a3a44');
    p.flag(1.7, 1.7, 0, col, 14);
  };
  BD.bateria = function (p, col) { // Batería costera: parapeto de piedra con dos cañones
    suelo(p, 2, 2, SAND2);
    p.box(0.1, 0.1, 1.8, 1.8, 0, 3, 'stone', 'stone', 'paving');
    for (const [x, y, w, h] of [[0.1, 0.1, 1.8, 0.3], [0.1, 0.1, 0.3, 1.8]]) p.box(x, y, w, h, 3, 8, 'stone', 'stone', 'paving');
    for (const y of [0.6, 1.3]) { p.box(0.6, y, 0.7, 0.25, 3, 5, '#5a3a20', '#3a2410', '#7a5030'); p.box(0.3, y + 0.05, 0.7, 0.15, 5, 7, '#22222a', '#14141a', '#3a3a44'); }
    p.box(1.4, 1.4, 0.3, 0.3, 3, 5, '#1c1c22', '#101014', '#3a3a44'); // balas
    p.flag(1.8, 1.8, 3, col, 10);
  };
  BD.cadena = function (p, col) { // Cadena de puerto: torreón con un torno y la cadena que entra al agua
    suelo(p, 2, 2, SAND2);
    const t = { x: 0.3, y: 0.3, w: 1.0, h: 1.0 };
    p.box(t.x, t.y, t.w, t.h, 0, 18, 'stone', 'stone', 'paving');
    p.box(t.x - 0.05, t.y - 0.05, t.w + 0.1, t.h + 0.1, 18, 20, 'stone', 'stone', 'paving');
    p.door(t, 'L', 0.5, 0.35, 7);
    p.box(1.4, 0.5, 0.4, 0.6, 0, 6, 'darkwood', 'darkwood', 'plank'); // torno
    for (let i = 0; i < 6; i++) p.box(1.5 + i * 0.08, 1.15 + i * 0.13, 0.1, 0.1, 3 - i * 0.5, 4 - i * 0.5, '#4a4a54', '#2a2a32', '#6a6a74');
    p.flag(0.4, 0.4, 20, col, 10);
  };
  BD.colonia = function (p, col) { // Muelle de la colonia: tarima, una choza y la bandera
    suelo(p, 2, 2);
    p.box(0.1, 1.3, 1.8, 0.6, 0, 3, 'plank', 'darkwood', 'plank');
    chozaPilotes(p, { x: 0.3, y: 0.2, w: 1.0, h: 0.9 }, 4, 8, 9);
    for (let i = 0; i < 2; i++) p.box(1.4, 0.3 + i * 0.4, 0.3, 0.3, 0, 5, '#8a5a30', '#6a4222', '#a87040');
    p.flag(1.7, 1.7, 3, col, 14);
  };

  // ---------- Barco de colonos (en travesía, mientras se funda una colonia) ----------
  const BARCOS = {};
  Sp.barcoColonos = function (col, flip) {
    const key = col.join(',') + (flip ? 1 : 0);
    if (BARCOS[key]) return BARCOS[key];
    const w = 30, h = 30, pb = new PB(w, h), f = x => (flip ? w - 1 - x : x);
    for (let x = 4; x < 26; x++) { const t = 18 + Math.round(Math.abs(x - 15) * 0.15), b = 24 - Math.round(Math.abs(x - 15) * 0.25); for (let y = t; y <= b; y++) pb.set(f(x), y, y === t ? [190, 120, 70] : [130, 70, 36]); }
    for (let y = 3; y < 19; y++) pb.set(f(14), y, [80, 50, 28]);
    for (let y = 4; y < 16; y++) for (let x = 15; x < 15 + Math.round((y - 3) * 0.7); x++) pb.set(f(x), y, y % 5 === 0 ? col : [240, 234, 214]);
    for (let x = 4; x < 26; x++) pb.set(f(x), 25, [200, 230, 240], 120);
    return (BARCOS[key] = { c: pb.canvas(), ax: 15, ay: 24 });
  };
})();
