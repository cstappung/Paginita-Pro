// Mundo: generación del mapa con semilla fija, zonas comunes/privadas, recursos, rutas (A*) y regeneración.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const W = (PK.World = {});
  W.W = D.MAP; W.H = D.MAP;
  W.CH = D.CHUNK; W.CW = W.W / W.CH;           // trozos de 16x16
  W.PW = W.W / D.PARCEL;                       // parcelas de territorio por lado

  const T_GRASS = 0, T_FOREST = 1, T_DIRT = 2, T_SAND = 3, T_WATER = 4;
  W.inb = (x, y) => x >= 0 && y >= 0 && x < W.W && y < W.H;
  W.idx = (x, y) => y * W.W + x;

  // tema: 'tierra' (el reino de siempre) o 'mar' (el Archipiélago de Bruma, Fase 9). Un mundo vivo a la vez.
  W.generate = function (seed, tema) {
    const w = W.W, h = W.H, N = w * h;
    W.seed = seed;
    W.tema = tema === 'mar' ? 'mar' : 'tierra';
    W.terrain = new Uint8Array(N);
    W.block = new Uint8Array(N);      // 0 libre, 1 recurso, 2 edificio, 4 agua
    W.nodeAt = new Int32Array(N).fill(-1);
    W.bAt = new Int32Array(N).fill(-1);
    W.zoneAt = new Int16Array(N).fill(-1);
    W.reserved = new Uint8Array(N);
    W.road = new Uint8Array(N);              // 1 = camino
    W.belt = new Int16Array(N).fill(-1);     // id de la cinta que pasa por la casilla
    W.wall = new Uint8Array(N);              // 1 = muralla, 2 = puerta
    W.wallOwner = new Uint8Array(N);         // L4: muralla o puerta de otro reino (casilla del reino + 1)
    W.wallAj = new Uint8Array(N);            // L4: 1 = muralla ajena, 2 = puerta ajena
    W.autopista = new Uint8Array(N);         // L5: Calzada Real (casilla del reino que la hizo + 1)
    W.apVer = 0;
    W.roadVer = 0;
    W.fog = new Uint8Array(N);        // 1 = explorado por ti
    W.fogCount = 0;
    W.poiAt = new Int16Array(N).fill(-1);
    W.subAt = new Map(); // pk-62: casilla → mazmorra bajo tierra (despeje.js)
    W.nodes = [];
    W.zones = [];
    W.pois = [];
    const rng = U.rng(seed);
    if (W.tema === 'mar') return generarMar(seed);

    // Siempre en orden de casilla, para que todos generen exactamente los mismos recursos (mismos ids).
    W.realms = D.REALM_SLOTS.map((s, i) => {
      const bot = D.BOTS.find(b => b.slot === i);
      return { id: D.ownerOfSlot(i), slot: i, home: s.home, name: i === D.MY_SLOT ? 'Tus tierras' : 'Tierras de ' + (bot ? bot.name : s.bot.name) };
    });
    for (const z of D.ZONES) W.zones.push(Object.assign({ common: true, owner: null }, z));
    for (const r of W.realms) W.zones.push({ id: 'home_' + r.slot, name: r.name, common: false, owner: r.id, cx: r.home[0], cy: r.home[1], r: 13 });

    W.zones.forEach((z, zi) => {
      const rr = z.common ? z.r + 1.6 : z.r;
      for (let y = Math.floor(z.cy - rr - 2); y <= z.cy + rr + 2; y++) for (let x = Math.floor(z.cx - rr - 2); x <= z.cx + rr + 2; x++) {
        if (!W.inb(x, y)) continue;
        const d = U.dist(x + 0.5, y + 0.5, z.cx + 0.5, z.cy + 0.5) + (U.noise(x * 0.3, y * 0.3, seed + zi) - 0.5) * 1.6;
        if (d <= rr && W.zoneAt[W.idx(x, y)] < 0) W.zoneAt[W.idx(x, y)] = zi;
      }
    });

    // Agua (lagos con borde orgánico); nunca dentro de zonas ni cerca de los hogares.
    for (const L of D.LAKES) {
      const R = Math.ceil(L.r * 1.5) + 1;
      for (let y = Math.max(0, L.y - R); y <= Math.min(h - 1, L.y + R); y++) for (let x = Math.max(0, L.x - R); x <= Math.min(w - 1, L.x + R); x++) {
        const i = W.idx(x, y);
        if (W.zoneAt[i] >= 0 || W.terrain[i] === T_WATER) continue;
        const d = U.dist(x, y, L.x, L.y) / L.r + (U.fbm(x * 0.15, y * 0.15, seed + 3, 3) - 0.5) * 0.7;
        if (d < 1) { W.terrain[i] = T_WATER; W.block[i] = 4; }
      }
    }
    W.waterDist = new Float32Array(N);
    computeWaterDist();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = W.idx(x, y);
      if (W.terrain[i] === T_WATER) continue;
      let nearW = false;
      for (let dy = -1; dy <= 1 && !nearW; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (W.inb(nx, ny) && W.terrain[W.idx(nx, ny)] === T_WATER) { nearW = true; break; }
      }
      if (nearW) W.terrain[i] = T_SAND;
    }

    // Suelo: bosque oscuro bajo los bosques, tierra alrededor de pueblos y minas.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = W.idx(x, y);
      if (W.terrain[i] !== T_GRASS) continue;
      const z = W.zoneAt[i] >= 0 ? W.zones[W.zoneAt[i]] : null;
      if (z && z.common && z.type === 'tree') W.terrain[i] = T_FOREST;
      if (z && z.common && (z.type === 'stone' || z.type === 'gold' || z.type === 'ore' || z.type === 'marble' || z.type === 'gems') && U.dist(x, y, z.cx, z.cy) < z.r + 1.2) W.terrain[i] = T_DIRT;
      const r = W.realmNear(x, y, 8);
      if (r) {
        const d = U.dist(x + 0.5, y + 0.5, r.home[0], r.home[1]) + (U.noise(x * 0.4, y * 0.4, seed + 21) - 0.5) * 2.5;
        if (d < 4.2) W.terrain[i] = T_DIRT;
        if (d < 7) W.reserved[i] = 1;
      }
    }

    // Recursos de las zonas comunes
    W.zones.forEach((z, zi) => {
      if (!z.common) return;
      for (let y = Math.floor(z.cy - z.r - 1); y <= z.cy + z.r + 1; y++) for (let x = Math.floor(z.cx - z.r - 1); x <= z.cx + z.r + 1; x++) {
        if (!W.inb(x, y) || W.zoneAt[W.idx(x, y)] !== zi) continue;
        const d = U.dist(x, y, z.cx, z.cy) + (U.noise(x * 0.35, y * 0.35, seed + 40 + zi) - 0.5) * 2;
        if (d > z.r) continue;
        if (z.type === 'tree') {
          if (U.noise(x * 0.22, y * 0.22, seed + 9) < 0.27) continue;
          if (rng() < 0.82) addNode('tree', x, y, zi, rng);
        } else if (z.type === 'berry') {
          if (rng() < 0.4) addNode('berry', x, y, zi, rng);
        } else if (z.type === 'deer') {
          if (rng() < 0.16) addNode('deer', x, y, zi, rng);
          else if (rng() < 0.12) addNode('tree', x, y, zi, rng);
        } else if (rng() < 0.78) addNode(z.type, x, y, zi, rng);
      }
    });

    // Recursos privados de cada reino
    for (const r of W.realms) {
      const zi = W.zones.findIndex(z => z.owner === r.id);
      const [hx, hy] = r.home;
      let dx = W.W / 2 - hx, dy = W.H / 2 - hy;
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      const px = -dy, py = dx;
      const patch = (cx, cy, rad, kind, prob) => {
        for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
          if (!W.inb(x, y) || W.reserved[W.idx(x, y)]) continue;
          const d = U.dist(x, y, cx, cy) + (U.noise(x * 0.4, y * 0.4, seed + 77) - 0.5) * 1.5;
          if (d <= rad && rng() < prob) addNode(kind, x, y, W.zoneAt[W.idx(x, y)] === zi ? zi : -1, rng);
        }
      };
      patch(hx - dx * 9 + px * 4, hy - dy * 9 + py * 4, 4.5, 'tree', 0.85);
      patch(hx + px * 7 + dx * 2, hy + py * 7 + dy * 2, 1.8, 'berry', 0.75);
      patch(hx - px * 8 + dx * 1, hy - py * 8 + dy * 1, 1.6, 'stone', 0.9);
      patch(hx + dx * 8 - px * 3, hy + dy * 8 - py * 3, 1.6, 'gold', 0.9);
      patch(hx - px * 9 - dx * 6, hy - py * 9 - dy * 6, 3.2, 'tree', 0.8);
      patch(hx + px * 10 - dx * 5, hy + py * 10 - dy * 5, 1.4, 'deer', 0.3);
    }

    // Depósitos silvestres más allá de los pueblos: se encuentran explorando (son de quien los encuentre).
    const farFromHomes = (x, y, d) => W.realms.every(r => U.dist(x, y, r.home[0], r.home[1]) >= d);
    const wild = (kind, count, rad, prob, minD) => {
      for (let k = 0, tries = 0; k < count && tries < count * 40; tries++) {
        const cx = 6 + rng() * (w - 12), cy = 6 + rng() * (h - 12);
        if (!farFromHomes(cx, cy, minD) || W.zoneAt[W.idx(cx | 0, cy | 0)] >= 0 || W.terrain[W.idx(cx | 0, cy | 0)] === T_WATER) continue;
        k++;
        for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
          if (!W.inb(x, y) || W.reserved[W.idx(x, y)] || W.zoneAt[W.idx(x, y)] >= 0) continue;
          if (U.dist(x, y, cx, cy) <= rad && rng() < prob) {
            addNode(kind, x, y, -1, rng);
            if (kind !== 'deer' && W.terrain[W.idx(x, y)] === T_GRASS) W.terrain[W.idx(x, y)] = T_DIRT;
          }
        }
      }
    };
    wild('deer', 52, 2.2, 0.22, 16);
    wild('stone', 34, 1.5, 0.85, 16);
    wild('gold', 28, 1.4, 0.85, 18);
    wild('ore', 26, 1.4, 0.85, 18);
    wild('marble', 22, 1.6, 0.85, 20);
    wild('gems', 14, 1.0, 0.9, 22);
    wild('berry', 40, 1.6, 0.6, 15);

    // Puntos de interés escondidos en la niebla.
    const poi = (kind, count, minD) => {
      const def = D.POI[kind];
      for (let k = 0, tries = 0; k < count && tries < count * 60; tries++) {
        const x = 3 + Math.floor(rng() * (w - 6 - def.w)), y = 3 + Math.floor(rng() * (h - 6 - def.h));
        if (!farFromHomes(x, y, minD)) continue;
        let ok = true;
        for (let j = -1; j <= def.h && ok; j++) for (let i = -1; i <= def.w; i++) {
          const k2 = W.idx(x + i, y + j);
          if (W.block[k2] || W.zoneAt[k2] >= 0 || W.reserved[k2] || W.poiAt[k2] >= 0) { ok = false; break; }
        }
        if (!ok) continue;
        k++;
        const p = { id: W.pois.length, kind, x, y, w: def.w, h: def.h, v: Math.floor(rng() * 4) };
        W.pois.push(p);
        for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) { const k2 = W.idx(x + i, y + j); W.poiAt[k2] = p.id; W.block[k2] = 3; if (W.terrain[k2] === T_GRASS && kind !== 'chest') W.terrain[k2] = T_DIRT; }
      }
    };
    poi('watch', 26, 18);
    poi('camp', 44, 20);
    poi('ruin', 38, 15);
    poi('relic', 24, 22);
    poi('chest', 100, 12);

    // Árboles silvestres dispersos
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = W.idx(x, y);
      if (W.block[i] || W.reserved[i] || W.zoneAt[i] >= 0 && W.zones[W.zoneAt[i]].common) continue;
      if (W.realmNear(x, y, 10)) continue;
      const f = U.fbm(x * 0.11, y * 0.11, seed + 55, 3);
      if ((f > 0.6 && rng() < 0.6) || rng() < 0.012) addNode('tree', x, y, W.zoneAt[i], rng);
    }
    // Mazmorras: con su propio generador y al final, así no cambia nada de lo que el mapa ya tenía.
    const drng = U.rng(seed + 9091), pasto = [];
    const placeDungeon = (kind, x, y) => {
      const def = D.POI[kind];
      if (x < 4 || y < 4 || x + def.w > w - 4 || y + def.h > h - 4) return false;
      for (let j = -1; j <= def.h; j++) for (let i = -1; i <= def.w; i++) {
        const k2 = W.idx(x + i, y + j);
        if (W.block[k2] || W.zoneAt[k2] >= 0 || W.reserved[k2] || W.poiAt[k2] >= 0) return false;
      }
      const p = { id: W.pois.length, kind, x, y, w: def.w, h: def.h, v: Math.floor(drng() * 4) };
      W.pois.push(p);
      for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) { const k2 = W.idx(x + i, y + j); W.poiAt[k2] = p.id; W.block[k2] = 3; if (W.terrain[k2] === T_GRASS) { W.terrain[k2] = T_DIRT; if (def.dungeon) pasto.push(k2); } }
      return true;
    };
    const dungeon = (kind, count, minD) => {
      for (let k = 0, tries = 0; k < count && tries < count * 120; tries++) {
        const x = 4 + Math.floor(drng() * (w - 8)), y = 4 + Math.floor(drng() * (h - 8));
        if (farFromHomes(x, y, minD) && placeDungeon(kind, x, y)) k++;
      }
    };
    // todos los reinos tienen una cueva y una guarida a mano: así cualquiera puede empezar las Leyendas
    for (const r of W.realms) for (const kind of ['cave', 'lair']) {
      for (let t = 0; t < 300; t++) {
        const a = drng() * Math.PI * 2, d = 14 + drng() * 10;
        if (placeDungeon(kind, Math.round(r.home[0] + Math.cos(a) * d), Math.round(r.home[1] + Math.sin(a) * d))) break;
      }
    }
    dungeon('lair', 44, 12);
    dungeon('cave', 44, 12);
    dungeon('crypt', 26, 20);
    dungeon('crater', 14, 30);
    dungeon('nest', 6, 36);
    // H4 (pk-17): el Templo Hundido solo junto a un lago (agua a 3 casillas o menos)
    const junto = (x, y, kind) => { const d = D.POI[kind]; for (let j = -3; j <= d.h + 3; j++) for (let i = -3; i <= d.w + 3; i++) if (W.inb(x + i, y + j) && W.terrain[W.idx(x + i, y + j)] === T_WATER) return true; return false; };
    dungeon('swamp', 22, 18);
    dungeon('giants', 10, 30);
    for (let k = 0, tries = 0; k < 9 && tries < 9 * 400; tries++) {
      const x = 4 + Math.floor(drng() * (w - 8)), y = 4 + Math.floor(drng() * (h - 8));
      if (farFromHomes(x, y, 24) && junto(x, y, 'temple') && placeDungeon('temple', x, y)) k++;
    }
    // Lugares legendarios (H6, pk-17): cada uno 3 veces, lejos de las otras copias, con su propio generador.
    const lrng = U.rng(seed + 5531), LD = D.POI.legend;
    for (let copia = 0; copia < 3; copia++) D.LEYENDAS.forEach((L, i) => {
      for (let t = 0; t < 600; t++) {
        const x = 4 + Math.floor(lrng() * (w - 8)), y = 4 + Math.floor(lrng() * (h - 8));
        if (!farFromHomes(x, y, 16) || (L.agua && !junto(x, y, 'legend'))) continue;
        if (W.pois.some(o => o.kind === 'legend' && o.ley === i && U.dist(o.x, o.y, x, y) < 60)) continue;
        if (!placeDungeon('legend', x, y)) continue;
        W.pois[W.pois.length - 1].ley = i;
        break;
      }
    });
    // pk-62 (pedido del dueño): de cada mazmorra se ve solo la entrada, una casilla que se pisa. Se ubican con su
    // tamaño de antes (así el generador sigue la misma secuencia y nada más del mapa se corre) y recién acá se
    // achican: el resto de la huella vuelve a ser pasto libre.
    for (const k2 of pasto) W.terrain[k2] = T_GRASS;
    for (const p of W.pois) {
      if (!D.POI[p.kind].dungeon) continue;
      for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const k2 = W.idx(p.x + i, p.y + j); W.poiAt[k2] = -1; W.block[k2] = 0; }
      p.w = p.h = 1;
      const k2 = W.idx(p.x, p.y);
      W.poiAt[k2] = p.id; W.terrain[k2] = W.terrain[k2] === T_GRASS ? T_DIRT : W.terrain[k2];
    }
    W.buildBuckets();
    W.initTerritory();
    // L4: dónde puso cada cosa el mapa (W.ubicarLugares parte siempre de acá, así da lo mismo en todos lados)
    W.ORIG = { n: W.nodes.map(n => [n.x, n.y]), p: W.pois.map(p => [p.x, p.y]) };
  };
  // ---------- El Archipiélago de Bruma (Fase 9, pk-25: la isla de prueba) ----------
  // Casi todo es agua. Tu isla queda en el mismo lugar que tu hogar de la tierra (así la cámara, el Centro Urbano y
  // la niebla funcionan igual), con playa, palmeras, rocas y arbustos; alrededor, unos islotes. Sin otros reinos,
  // zonas comunes ni lugares: eso llega con las islas y colonias de la siguiente entrega.
  function generarMar(seed) {
    const w = W.W, h = W.H, rng = U.rng(seed + 777), [hx, hy] = D.PLAYER_HOME;
    W.realms = [{ id: 'p', slot: D.MY_SLOT, home: [hx, hy], name: 'Tu isla' }];
    W.zones.push({ id: 'home_' + D.MY_SLOT, name: 'Tu isla', common: false, owner: 'p', cx: hx, cy: hy, r: 13 });
    for (let i = 0; i < w * h; i++) { W.terrain[i] = T_WATER; W.block[i] = 4; }
    // la isla de casa y cinco islas con rasgo (pk-28): la más cercana es la de las palmeras y la más lejana, la de
    // las especias (rara y disputada). Las distancias crecen con el orden para que fundar colonias sea un camino.
    const islas = [{ x: hx, y: hy, r: 15, k: 'casa' }];
    const orden = (D.ISLAS_ORDEN || ['palmas', 'coral', 'volcan', 'naufragios', 'especias']).slice();
    for (let t = 0, n = 0; n < orden.length && t < 2000; t++) {
      const a = rng() * Math.PI * 2, d = 28 + n * 9 + rng() * 10, x = Math.round(hx + Math.cos(a) * d), y = Math.round(hy + Math.sin(a) * d), r = 6 + rng() * 3;
      if (x < r + 4 || y < r + 4 || x > w - r - 4 || y > h - r - 4 || islas.some(o => U.dist(o.x, o.y, x, y) < o.r + r + 7)) continue;
      islas.push({ x, y, r, k: orden[n++] });
    }
    W.islas = islas;
    for (const I of islas) {
      const R = Math.ceil(I.r * 1.4) + 2;
      for (let y = Math.max(0, I.y - R); y <= Math.min(h - 1, I.y + R); y++) for (let x = Math.max(0, I.x - R); x <= Math.min(w - 1, I.x + R); x++) {
        const d = U.dist(x, y, I.x, I.y) / I.r + (U.fbm(x * 0.18, y * 0.18, seed + 31, 3) - 0.5) * 0.55;
        if (d < 1) { const i = W.idx(x, y); W.terrain[i] = d > 0.78 ? T_SAND : T_GRASS; W.block[i] = 0; }
      }
    }
    W.waterDist = new Float32Array(w * h);
    computeWaterDist();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = W.idx(x, y);
      if (W.terrain[i] === T_WATER) continue;
      const dHome = U.dist(x + 0.5, y + 0.5, hx, hy);
      if (dHome < 7) W.reserved[i] = 1;
      if (dHome < 4.2) W.terrain[i] = T_DIRT;
    }
    W.zoneAt.fill(-1);
    const zi = 0;
    for (let y = hy - 16; y <= hy + 16; y++) for (let x = hx - 16; x <= hx + 16; x++) if (W.inb(x, y) && W.terrain[W.idx(x, y)] !== T_WATER && U.dist(x, y, hx, hy) <= 14) W.zoneAt[W.idx(x, y)] = zi;
    const pon = (kind, x, y, sp) => { const n = addNode(kind, x, y, W.zoneAt[W.idx(x, y)], rng); if (n && sp) n.sp = sp; return n; };
    const orilla = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => W.inb(x + dx, y + dy) && W.terrain[W.idx(x + dx, y + dy)] === T_WATER);
    const hayNodos = D.NODES.palma; // sin datos-mar.js (el servidor nunca arma el mar) no hay nodos propios
    for (const I of islas) {
      for (let y = Math.floor(I.y - I.r - 2); y <= I.y + I.r + 2; y++) for (let x = Math.floor(I.x - I.r - 2); x <= I.x + I.r + 2; x++) {
        if (!W.inb(x, y)) continue;
        const i = W.idx(x, y);
        if (W.terrain[i] === T_WATER || W.reserved[i]) continue;
        const arena = W.terrain[i] === T_SAND, costa = orilla(x, y), f = U.fbm(x * 0.2, y * 0.2, seed + 57, 3), r = rng();
        if (!hayNodos) { if (r < (arena ? 0.2 : 0.5)) pon('tree', x, y, 'palm'); continue; }
        if (I.k === 'casa') {
          const dx = x - I.x, dy = y - I.y;
          if (costa && dx > 3 && r < 0.45) pon('arrecife', x, y);
          else if (costa && dy > 3 && r < 0.35) pon('almeja', x, y);
          else if (costa && dx < -6 && dy < -3 && r < 0.12) pon('naufragio', x, y);
          else if (arena && r < 0.16) pon('palma', x, y);
          else if (!arena && f > 0.55 && r < 0.6) pon('tree', x, y, 'teca');
          else if (!arena && dx < -4 && dy > 2 && r < 0.3) pon('palma', x, y);
        } else if (I.k === 'palmas') { if (r < (arena ? 0.3 : 0.55)) pon(r < 0.42 ? 'palma' : 'tree', x, y, r < 0.42 ? null : 'teca'); }
        else if (I.k === 'coral') { if (costa && r < 0.7) pon('arrecife', x, y); else if (arena && r < 0.25) pon('almeja', x, y); else if (!arena && r < 0.2) pon('palma', x, y); }
        else if (I.k === 'volcan') { if (!arena && r < 0.45) pon(r < 0.3 ? 'salitral' : 'gold', x, y); else if (arena && r < 0.1) pon('salitral', x, y); }
        else if (I.k === 'naufragios') { if (costa && r < 0.3) pon('naufragio', x, y); else if (r < 0.25) pon('palma', x, y); }
        else if (I.k === 'especias') { if (!arena && r < 0.4) pon(r < 0.25 ? 'especia' : 'tree', x, y, r < 0.25 ? null : 'teca'); else if (arena && r < 0.12) pon('especia', x, y); }
      }
    }
    // Costa: casillas de agua a 1 o 2 de la tierra, por trozo (render.js pinta ahí la marea y la espuma)
    W.costa = new Map();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = W.idx(x, y);
      if (W.terrain[i] !== T_WATER) continue;
      let d = 9;
      for (let yy = -2; yy <= 2 && d > 1; yy++) for (let xx = -2; xx <= 2; xx++) {
        if (!W.inb(x + xx, y + yy) || W.terrain[W.idx(x + xx, y + yy)] === T_WATER) continue;
        d = Math.min(d, Math.max(Math.abs(xx), Math.abs(yy)));
      }
      if (d > 2) continue;
      const c = Math.floor(y / W.CH) * W.CW + Math.floor(x / W.CH);
      if (!W.costa.has(c)) W.costa.set(c, []);
      W.costa.get(c).push([x, y, d]);
    }
    W.buildBuckets();
    W.initTerritory();
  }

  // Reino cuyo hogar está a menos de d casillas (o null).
  W.realmNear = function (x, y, d) {
    for (const r of W.realms) if (Math.abs(x - r.home[0]) < d && Math.abs(y - r.home[1]) < d && U.dist(x, y, r.home[0], r.home[1]) < d) return r;
    return null;
  };

  // ---------- Índice por trozos ----------
  // Los recursos se guardan por trozo de 16x16: dibujar y buscar solo mira lo cercano, no todo el mapa.
  const chunkOf = (x, y) => Math.floor(y / W.CH) * W.CW + Math.floor(x / W.CH);
  W.chunkOf = chunkOf;
  W.buildBuckets = function () {
    W.chunkNodes = [];
    for (let i = 0; i < W.CW * W.CW; i++) W.chunkNodes.push([]);
    W.zoneNodes = W.zones.map(() => []);
    for (const n of W.nodes) W.bucket(n);
  };
  W.bucket = function (n) {
    W.chunkNodes[chunkOf(n.x, n.y)].push(n);
    if (n.zone >= 0 && !n.temp) W.zoneNodes[n.zone].push(n);
  };
  W.unbucket = function (n) {
    const a = W.chunkNodes[chunkOf(n.x, n.y)], i = a.indexOf(n);
    if (i >= 0) a.splice(i, 1);
  };

  function addNode(kind, x, y, zone, rng) {
    const i = W.idx(x, y);
    if (W.block[i] || W.terrain[i] === T_WATER) return null;
    const def = D.NODES[kind], z = zone >= 0 ? W.zones[zone] : null;
    const m = z && z.common ? 1 : def.priv || 1; // pk-42: los de tu tierra duran más (las comunes, como el servidor)
    const n = { id: W.nodes.length, kind, x, y, amount: def.amount * m, max: def.amount * m, zone, v: Math.floor(rng() * 6), dead: false, t: 0 };
    if (kind === 'deer') n.dir = rng() < 0.5;
    if (kind === 'tree') n.sp = z && z.common && z.type === 'tree' ? (rng() < 0.55 ? 'pine' : 'oak') : rng() < 0.08 ? 'aut' : rng() < 0.3 ? 'pine' : 'oak';
    W.nodes.push(n);
    W.nodeAt[i] = n.id;
    W.block[i] = 1;
    return n;
  }

  function computeWaterDist() {
    const w = W.W, h = W.H, q = [];
    W.waterDist.fill(99);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = W.idx(x, y);
      if (W.terrain[i] !== T_WATER) { W.waterDist[i] = 0; q.push(i); }
    }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!W.inb(nx, ny)) continue;
        const j = W.idx(nx, ny);
        if (W.waterDist[j] > W.waterDist[i] + 1) { W.waterDist[j] = W.waterDist[i] + 1; q.push(j); }
      }
    }
  }

  // ---------- Consultas ----------
  W.passable = (x, y) => x >= 0 && y >= 0 && x < W.W && y < W.H && W.block[y * W.W + x] === 0;
  W.zoneOf = n => (n && n.zone >= 0 ? W.zones[n.zone] : null);
  // Se puede recolectar en zonas comunes, en tierra de nadie y en tu propio territorio.
  W.canUse = function (n, owner) {
    const z = W.zoneOf(n);
    if (z && z.common) return true;
    const o = W.ownerAt(n.x, n.y);
    return !o || o === owner;
  };
  W.nodeRes = n => D.NODES[n.kind].res;

  // Busca por anillos de trozos alrededor del punto y se detiene cuando ya no puede haber nada más cerca.
  W.nearestNode = function (res, x, y, maxR, owner, opts) {
    let best = null, bd = Math.min(maxR || 1e9, W.W * 1.5), regs = null;
    opts = opts || {};
    const cx = Math.floor(x / W.CH), cy = Math.floor(y / W.CH), rings = Math.ceil(bd / W.CH) + 1;
    for (let r = 0; r <= rings; r++) {
      if ((r - 1) * W.CH > bd) break;
      for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
        if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== r || i < 0 || j < 0 || i >= W.CW || j >= W.CW) continue;
        for (const n of W.chunkNodes[j * W.CW + i]) {
          if (n.dead || D.NODES[n.kind].res !== res || n.id === opts.exclude) continue;
          const d = U.dist(x, y, n.x + 0.5, n.y + 0.5);
          if (d >= bd) continue;
          if (owner === 'p' && !W.fog[n.y * W.W + n.x]) continue;
          if (opts.zone && (n.zone < 0 || W.zones[n.zone].id !== opts.zone)) continue;
          if (!W.canUse(n, owner)) continue;
          if (W.reachable(n, regs || (regs = W.regionsAt(x, y)))) { bd = d; best = n; }
        }
      }
    }
    return best;
  };

  // Regiones conectadas del mapa (las casillas libres que se tocan por un lado). Un recurso en el centro de
  // una veta o encerrado por edificios queda en otra región: buscar una ruta hasta él recorre medio mapa
  // para nada, así que ni se intenta. Se recalcula como mucho una vez por segundo de juego.
  let region = null, regT = -1, regStack = null, regSize = [];
  function regions() {
    const t = PK.Game ? PK.Game.time : 0;
    if (region && t >= regT && t - regT < 1) return region;
    regT = t;
    const w = W.W, N = w * W.H;
    if (!region) { region = new Int32Array(N); regStack = new Int32Array(N); }
    region.fill(0);
    regSize = [0];
    let label = 0;
    for (let i = 0; i < N; i++) {
      if (region[i] || W.block[i] !== 0) continue;
      label++;
      let sp = 0;
      regStack[sp++] = i; region[i] = label;
      while (sp) {
        const k = regStack[--sp], x = k % w, y = (k / w) | 0;
        if (x > 0 && !region[k - 1] && W.block[k - 1] === 0) { region[k - 1] = label; regStack[sp++] = k - 1; }
        if (x < w - 1 && !region[k + 1] && W.block[k + 1] === 0) { region[k + 1] = label; regStack[sp++] = k + 1; }
        if (y > 0 && !region[k - w] && W.block[k - w] === 0) { region[k - w] = label; regStack[sp++] = k - w; }
        if (y < W.H - 1 && !region[k + w] && W.block[k + w] === 0) { region[k + w] = label; regStack[sp++] = k + w; }
      }
    }
    for (let i = 0; i < N; i++) if (region[i]) regSize[region[i]] = (regSize[region[i]] || 0) + 1;
    return region;
  }
  // Regiones a las que se puede salir desde un punto (si está sobre un edificio, las de su borde).
  // Los huecos chicos que quedan entre edificios no cuentan.
  W.regionsAt = function (x, y) {
    const reg = regions(), cx = Math.floor(x), cy = Math.floor(y), out = new Set();
    for (let r = 0; r <= 16 && !out.size; r++)
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r || !W.inb(cx + i, cy + j)) continue;
        const l = reg[W.idx(cx + i, cy + j)];
        if (l && (r === 0 || regSize[l] >= 30)) out.add(l);
      }
    return out;
  };
  // Región de una casilla (0 si está bloqueada) y su tamaño: para saber si un aldeano quedó encerrado.
  W.regionAt = (x, y) => (W.inb(x, y) ? regions()[W.idx(x, y)] : 0);
  W.regionSize = l => (l ? regSize[l] || 0 : 0);
  // Casilla libre de la región l más cercana a un punto (por anillos, hasta maxR), o null.
  W.nearestInRegion = function (px, py, l, maxR) {
    const reg = regions(), cx = Math.floor(px), cy = Math.floor(py);
    for (let r = 0; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || !W.inb(x, y) || reg[W.idx(x, y)] !== l) continue;
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) return best;
    }
    return null;
  };
  // La región más grande del mapa (la tierra firme por donde se camina): {l, n}.
  W.biggestRegion = function () {
    regions();
    let l = 0, n = 0;
    for (let i = 1; i < regSize.length; i++) if (regSize[i] > n) { n = regSize[i]; l = i; }
    return { l, n };
  };
  // Cuántas casillas libres se alcanzan caminando desde el borde de unos rectángulos ([x, y, w, h], los
  // Centros Urbanos). Las casillas de `tapa` cuentan como bloqueadas y las de `libre` como libres (índices):
  // así se prueba un edificio antes de ponerlo o mudarlo. Se detiene al llegar a `tope`. Sirve para no
  // encerrar al pueblo (G.placeWhy, 'encierra'): un patio cerrado por casas dejaba a los aldeanos sin salida.
  let rcMark = null, rcStack = null, rcGen = 0;
  W.reachCount = function (rects, tapa, libre, tope) {
    const w = W.W, N = w * W.H;
    if (!rcMark) { rcMark = new Int32Array(N); rcStack = new Int32Array(N); }
    if (++rcGen > 2e9) { rcMark.fill(0); rcGen = 1; }
    const g = rcGen, T = new Set(tapa || []), L = new Set(libre || []);
    const free = k => !T.has(k) && (W.block[k] === 0 || L.has(k));
    let sp = 0, n = 0;
    const push = k => { if (rcMark[k] !== g && free(k)) { rcMark[k] = g; rcStack[sp++] = k; } };
    for (const [x0, y0, rw, rh] of rects) // las casillas que lo tocan por un lado (las esquinas no: se camina en 4 direcciones)
      for (let y = y0 - 1; y <= y0 + rh; y++) for (let x = x0 - 1; x <= x0 + rw; x++) {
        if ((x < x0 || x >= x0 + rw) === (y < y0 || y >= y0 + rh)) continue;
        if (W.inb(x, y)) push(W.idx(x, y));
      }
    tope = tope || N;
    while (sp && n < tope) {
      const k = rcStack[--sp], x = k % w, y = (k / w) | 0;
      n++;
      if (x > 0) push(k - 1);
      if (x < w - 1) push(k + 1);
      if (y > 0) push(k - w);
      if (y < W.H - 1) push(k + w);
    }
    return n;
  };
  W.reachable = function (n, regs) {
    if (!regs.size) return true; // no se sabe desde dónde: que lo resuelva la ruta
    const reg = regions();
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if ((!i && !j) || !W.inb(n.x + i, n.y + j)) continue;
      if (regs.has(reg[W.idx(n.x + i, n.y + j)])) return true;
    }
    return false;
  };

  // Casilla libre más cercana alrededor de un rectángulo (o de un punto si el rectángulo es 1x1).
  W.freeAround = function (x0, y0, x1, y1, px, py, avoid) {
    for (let r = 1; r < 14; r++) {
      let best = null, bd = 1e9;
      for (let y = y0 - r; y <= y1 + r; y++) for (let x = x0 - r; x <= x1 + r; x++) {
        if (x > x0 - r && x < x1 + r && y > y0 - r && y < y1 + r) continue;
        if (!W.passable(x, y) || (avoid && avoid(x, y))) continue;
        const d = px === undefined ? 0 : U.dist(x + 0.5, y + 0.5, px, py);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) return best;
    }
    return [x0, y0];
  };

  W.rectFree = function (x, y, w, h, allowReserved) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x + i, ty = y + j;
      if (!W.inb(tx, ty)) return false;
      const k = W.idx(tx, ty);
      if (W.block[k] || W.bAt[k] >= 0 || W.terrain[k] === T_WATER || W.belt[k] >= 0) return false;
      if (!allowReserved && W.reserved[k]) return false;
    }
    return true;
  };
  W.findFreeRect = function (cx, cy, w, h, maxR, allowReserved) {
    for (let r = 0; r <= (maxR || 12); r++) {
      for (let y = Math.round(cy) - r; y <= Math.round(cy) + r; y++) for (let x = Math.round(cx) - r; x <= Math.round(cx) + r; x++) {
        if (Math.max(Math.abs(x - Math.round(cx)), Math.abs(y - Math.round(cy))) !== r) continue;
        if (W.rectFree(x, y, w, h, allowReserved)) {
          // Deja un pasillo de una casilla alrededor para que nadie quede encerrado.
          let ok = true;
          for (let j = -1; j <= h && ok; j++) for (let i = -1; i <= w; i++) {
            const k = W.inb(x + i, y + j) ? W.idx(x + i, y + j) : -1;
            if (k >= 0 && W.bAt[k] >= 0) { ok = false; break; }
          }
          if (ok) return [x, y];
        }
      }
    }
    return null;
  };

  // ---------- Rutas (A* 8 direcciones) ----------
  let gS, from, seen, closed, heapI, heapF, stamp = 0;
  function heapPush(i, f, n) {
    let k = n;
    heapI[k] = i; heapF[k] = f;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heapF[p] <= heapF[k]) break;
      [heapI[p], heapI[k]] = [heapI[k], heapI[p]]; [heapF[p], heapF[k]] = [heapF[k], heapF[p]];
      k = p;
    }
  }
  function heapPop(n) {
    const top = heapI[0];
    heapI[0] = heapI[n - 1]; heapF[0] = heapF[n - 1];
    let k = 0;
    const m = n - 1;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let s = k;
      if (l < m && heapF[l] < heapF[s]) s = l;
      if (r < m && heapF[r] < heapF[s]) s = r;
      if (s === k) break;
      [heapI[s], heapI[k]] = [heapI[k], heapI[s]]; [heapF[s], heapF[k]] = [heapF[k], heapF[s]];
      k = s;
    }
    return top;
  }
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

  // goal = { x0, y0, x1, y1, adj }: adj=true significa llegar a una casilla vecina del rectángulo.
  // noGate: las puertas cuentan como muralla (para los lobos y los enemigos).
  W.pasoDe = 0; // L4: reino (casilla + 1) de quien pide la ruta; lo pone pathTo de entities.js y lo vuelve a 0
  W.findPath = function (sx, sy, goal, maxIter, noGate) {
    const w = W.W, N = w * W.H;
    if (!gS) {
      gS = new Float32Array(N); from = new Int32Array(N); seen = new Uint32Array(N); closed = new Uint32Array(N);
      heapI = new Int32Array(N * 8); heapF = new Float32Array(N * 8);
    }
    stamp++;
    maxIter = maxIter || 9000;
    const inRect = (x, y) => x >= goal.x0 && x <= goal.x1 && y >= goal.y0 && y <= goal.y1;
    const isGoal = (x, y) => goal.adj ? (x >= goal.x0 - 1 && x <= goal.x1 + 1 && y >= goal.y0 - 1 && y <= goal.y1 + 1 && !inRect(x, y)) : inRect(x, y);
    const hf = (x, y) => {
      const dx = Math.max(goal.x0 - x, 0, x - goal.x1), dy = Math.max(goal.y0 - y, 0, y - goal.y1);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    sx = U.clamp(sx, 0, w - 1); sy = U.clamp(sy, 0, W.H - 1);
    const start = sy * w + sx;
    if (isGoal(sx, sy)) return { path: [], ok: true };
    let n = 0;
    gS[start] = 0; seen[start] = stamp; from[start] = -1;
    heapPush(start, hf(sx, sy), n++);
    let best = start, bestH = hf(sx, sy), iter = 0;
    while (n > 0 && iter++ < maxIter) {
      const cur = heapPop(n); n--;
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      const cx = cur % w, cy = (cur / w) | 0;
      if (cur !== start && isGoal(cx, cy)) return { path: build(cur), ok: true };
      for (const [dx, dy, c] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!W.passable(nx, ny)) continue;
        if (dx && dy && (!W.passable(cx + dx, cy) || !W.passable(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (noGate && W.wall[ni] >= 2) continue; // puertas y el paso del Gran Portón (pk-43)
        if (W.wallOwner[ni] && W.wallOwner[ni] !== W.pasoDe) continue; // L4: una puerta ajena solo la cruza su gente
        if (closed[ni] === stamp) continue;
        const ng = gS[cur] + c;
        if (seen[ni] !== stamp || ng < gS[ni]) {
          seen[ni] = stamp; gS[ni] = ng; from[ni] = cur;
          const hh = hf(nx, ny);
          if (hh < bestH) { bestH = hh; best = ni; }
          if (n < heapI.length) heapPush(ni, ng + hh * 1.05, n++);
        }
      }
    }
    return { path: build(best), ok: false };
    function build(end) {
      const out = [];
      let c = end;
      while (c !== start && c >= 0) { out.push([c % w, (c / w) | 0]); c = from[c]; }
      return out.reverse();
    }
  };

  // ---------- Rutas por tiempo (pk-41, plan de logística L1) ----------
  // El mismo A*, pero cada casilla cuesta lo que tarda en cruzarla quien viaja (1 / velocidad): así una carreta toma
  // el camino más RÁPIDO (por el camino empedrado, aunque dé un rodeo) y no el más corto. `costo` es un Float32Array
  // por casilla con Infinity donde no pasa; `minCosto`, el de la casilla más rápida (la heurística nunca se pasa).
  // Lo arma logistics.js por perfil (carreta, carromato, barcaza) y guarda los caminos: este A* explora más que el
  // de los aldeanos y no debe correr en cada decisión.
  W.rutaCosto = function (sx, sy, goal, costo, minCosto, maxIter) {
    const w = W.W, N = w * W.H;
    if (!gS) {
      gS = new Float32Array(N); from = new Int32Array(N); seen = new Uint32Array(N); closed = new Uint32Array(N);
      heapI = new Int32Array(N * 8); heapF = new Float32Array(N * 8);
    }
    stamp++;
    maxIter = maxIter || N;
    const mc = Math.max(1e-3, minCosto || 1);
    const inRect = (x, y) => x >= goal.x0 && x <= goal.x1 && y >= goal.y0 && y <= goal.y1;
    const isGoal = (x, y) => goal.adj ? (x >= goal.x0 - 1 && x <= goal.x1 + 1 && y >= goal.y0 - 1 && y <= goal.y1 + 1 && !inRect(x, y)) : inRect(x, y);
    const hf = (x, y) => {
      const dx = Math.max(goal.x0 - x, 0, x - goal.x1), dy = Math.max(goal.y0 - y, 0, y - goal.y1);
      return (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)) * mc;
    };
    sx = U.clamp(sx, 0, w - 1); sy = U.clamp(sy, 0, W.H - 1);
    const start = sy * w + sx;
    if (isGoal(sx, sy)) return { path: [], ok: true, seg: 0 };
    let n = 0;
    gS[start] = 0; seen[start] = stamp; from[start] = -1;
    heapPush(start, hf(sx, sy), n++);
    let best = start, bestH = hf(sx, sy), iter = 0;
    const libre = (x, y) => x >= 0 && y >= 0 && x < w && y < W.H && costo[y * w + x] < Infinity;
    while (n > 0 && iter++ < maxIter) {
      const cur = heapPop(n); n--;
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      const cx = cur % w, cy = (cur / w) | 0;
      if (cur !== start && isGoal(cx, cy)) return { path: build(cur), ok: true, seg: gS[cur] };
      for (const [dx, dy, c] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!libre(nx, ny)) continue;
        if (dx && dy && (!libre(cx + dx, cy) || !libre(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (closed[ni] === stamp) continue;
        const ng = gS[cur] + c * costo[ni];
        if (seen[ni] !== stamp || ng < gS[ni]) {
          seen[ni] = stamp; gS[ni] = ng; from[ni] = cur;
          const hh = hf(nx, ny);
          if (hh < bestH) { bestH = hh; best = ni; }
          if (n < heapI.length) heapPush(ni, ng + hh, n++);
        }
      }
    }
    return { path: build(best), ok: false, seg: gS[best] };
    function build(end) {
      const out = [];
      let c = end;
      while (c !== start && c >= 0) { out.push([c % w, (c / w) | 0]); c = from[c]; }
      return out.reverse();
    }
  };

  // ---------- Agotamiento y regeneración ----------
  W.depleteNode = function (n) {
    n.amount = 0;
    n.dead = true;
    n.t = Date.now();
    if (W.soft(n)) {
      const i = W.idx(n.x, n.y);
      if (W.block[i] === 1) { W.block[i] = 0; if (W.onDesbloqueo) W.onDesbloqueo(i); }
    }
  };

  W.soft = n => n.kind === 'tree' || n.kind === 'berry' || n.kind === 'deer' || !!(D.NODES[n.kind] && D.NODES[n.kind].soft); // al agotarse dejan pasar
  W.isShared = n => n.zone >= 0 && W.zones[n.zone].common;

  W.regrow = function (now, occupied, hoursPassed) {
    for (const n of W.nodes) {
      if (n.temp || n.gone) continue; // gone: talado para siempre (despeje.js)
      const def = D.NODES[n.kind];
      if (def.regen) {
        if (n.amount < n.max && hoursPassed > 0) {
          // las tuyas, casi como las comunes (era 0,6; pk-40); con el monto ×priv (pk-42) rellenan lo mismo por hora
          const mult = W.zoneOf(n) && W.zoneOf(n).common ? 1 : 0.8 / (def.priv || 1);
          n.amount = Math.min(n.max, n.amount + n.max * def.regen * mult * hoursPassed);
          if (n.dead && n.amount >= 1) n.dead = false;
        }
      } else if (n.dead && now - n.t >= def.regrow * 1000 * (n.kind === 'tree' && PK.Leyendas ? PK.Leyendas.rebrote() : 1)) {
        const i = W.idx(n.x, n.y);
        if (W.block[i] || W.bAt[i] >= 0 || occupied(n.x, n.y)) continue;
        n.dead = false; n.amount = n.max; W.block[i] = 1;
        if (W.onBloqueo) W.onBloqueo(i); // pk-78: los caminos guardados de carretas y carromatos se enteran
      }
    }
  };

  W.saveNodes = function () {
    const out = {};
    for (const n of W.nodes) if (!n.temp && !n.gone && !n.planta && (n.dead || n.amount < n.max)) out[n.id] = [Math.round(n.amount * 10) / 10, n.dead ? n.t : 0];
    return out;
  };
  W.loadNodes = function (data) {
    if (!data) return;
    for (const id in data) {
      const n = W.nodes[id];
      if (!n) continue;
      n.amount = data[id][0];
      if (data[id][1]) {
        n.dead = true; n.t = data[id][1];
        if (W.soft(n)) W.block[W.idx(n.x, n.y)] = 0;
      }
    }
  };

  // ---------- Niebla ----------
  W.explored = (x, y) => W.inb(x, y) && W.fog[y * W.W + x] === 1;
  // ok(x, y), opcional: qué casillas se pueden revelar (el explorador, solo dentro de su área)
  W.reveal = function (cx, cy, r, ok) {
    const out = [];
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (!W.inb(x, y)) continue;
      const i = y * W.W + x;
      if (W.fog[i] || U.dist(x + 0.5, y + 0.5, cx, cy) > r + 0.3 || (ok && !ok(x, y))) continue;
      W.fog[i] = 1; W.fogCount++;
      out.push(i);
    }
    if (out.length) { W.fogVer = (W.fogVer || 0) + 1; W.fogTouch(cx - r, cy - r, cx + r, cy + r); }
    return out;
  };
  W.saveFog = function () {
    const bytes = new Uint8Array(Math.ceil(W.fog.length / 8));
    for (let i = 0; i < W.fog.length; i++) if (W.fog[i]) bytes[i >> 3] |= 1 << (i & 7);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  };
  W.loadFog = function (str) {
    if (!str) return;
    const s = atob(str);
    W.fogCount = 0;
    for (let i = 0; i < W.fog.length; i++) { W.fog[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1; W.fogCount += W.fog[i]; }
    W.fogVer = (W.fogVer || 0) + 1;
    W.fogDirty = { x0: 0, y0: 0, x1: W.W - 1, y1: W.H - 1 };
  };
  // Zona de la niebla que hay que volver a pintar (en casillas).
  W.fogTouch = function (x0, y0, x1, y1) {
    const f = W.fogDirty;
    if (!f) W.fogDirty = { x0: Math.floor(x0), y0: Math.floor(y0), x1: Math.ceil(x1), y1: Math.ceil(y1) };
    else { f.x0 = Math.min(f.x0, Math.floor(x0)); f.y0 = Math.min(f.y0, Math.floor(y0)); f.x1 = Math.max(f.x1, Math.ceil(x1)); f.y1 = Math.max(f.y1, Math.ceil(y1)); }
  };
  W.poiFree = function (p) { // un campamento derrotado deja de bloquear
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const k = W.idx(p.x + i, p.y + j); if (W.block[k] === 3) W.block[k] = 0; }
  };

  W.zoneStats = function (zi) {
    let amt = 0, max = 0, alive = 0;
    for (const n of W.zoneNodes[zi]) { amt += n.amount; max += n.max; if (!n.dead) alive++; }
    return { amt, max, alive };
  };

  // ---------- Territorio ----------
  // W.terr guarda el dueño de cada parcela de 8x8: 0 = nadie, si no, casilla del reino + 1. Las parcelas con
  // zona común nunca tienen dueño.
  W.parcel = (x, y) => Math.floor(y / D.PARCEL) * W.PW + Math.floor(x / D.PARCEL);
  W.initTerritory = function () {
    const P = W.PW, N = P * P;
    W.terr = new Uint8Array(N);
    W.terrCommon = new Uint8Array(N);
    W.terrVer = 1;
    for (let y = 0; y < W.H; y++) for (let x = 0; x < W.W; x++) {
      const z = W.zoneAt[W.idx(x, y)];
      if (z >= 0 && W.zones[z].common) W.terrCommon[W.parcel(x, y)] = 1;
    }
    W.startParcels = {};
    for (const r of W.realms) {
      const hp = [r.home[0] / D.PARCEL - 0.5, r.home[1] / D.PARCEL - 0.5];
      let n = 0;
      for (let py = 0; py < P; py++) for (let px = 0; px < P; px++) {
        const k = py * P + px;
        if (W.terrCommon[k] || W.terr[k] || Math.hypot(px - hp[0], py - hp[1]) > D.TERR.startR) continue;
        W.terr[k] = r.slot + 1; n++;
      }
      W.startParcels[r.slot] = n;
    }
    W.terrStart = W.terr.slice();
  };
  W.ownerOfParcel = k => (W.terr[k] ? D.ownerOfSlot(W.terr[k] - 1) : null);
  W.ownerAt = (x, y) => (W.inb(x, y) ? W.ownerOfParcel(W.parcel(x, y)) : null);
  W.homeParcel = slot => { const h = D.REALM_SLOTS[slot].home; return W.parcel(h[0], h[1]); };
  W.isCore = function (k, slot) {
    const h = W.homeParcel(slot), P = W.PW;
    return Math.max(Math.abs((k % P) - (h % P)), Math.abs(Math.floor(k / P) - Math.floor(h / P))) <= D.TERR.core;
  };
  // G5 (pk-62): el rasgo de una parcela (clave de D.COMARCAS) o null. Sembrado con su propio rng: no mueve el mapa
  // ni depende de quién sea el dueño, así que el servidor y todos los navegadores ven las mismas comarcas.
  let rasgos = null;
  W.rasgoDe = function (k) {
    if (!rasgos) {
      const r = U.rng(D.SEED + 6151), ids = Object.keys(D.COMARCAS), N = W.PW * W.PW;
      rasgos = new Array(N).fill(null);
      for (let i = 0; i < N; i++) {
        const sale = r() < 1 / D.COMARCA_CADA, cual = ids[Math.floor(r() * ids.length)]; // siempre dos tiradas por parcela
        if (!sale || W.terrCommon[i] || D.REALM_SLOTS.some((s, slot) => W.isCore(i, slot))) continue;
        rasgos[i] = cual;
      }
    }
    return rasgos[k] || null;
  };
  W.parcelNeighbors = function (k) {
    const P = W.PW, x = k % P, y = Math.floor(k / P), out = [];
    if (x > 0) out.push(k - 1);
    if (x < P - 1) out.push(k + 1);
    if (y > 0) out.push(k - P);
    if (y < P - 1) out.push(k + P);
    return out;
  };
  // ---------- Despeje global (L4, pk-45) ----------
  // Dentro de cualquier territorio solo quedan árboles y arbustos (W.QUEDAN). Lo demás (lugares, minas, vetas,
  // ciervos) se ubica en la casilla más cercana a su lugar original que esté a W.LEJOS casillas o más de todo
  // territorio. Función pura de W.ORIG y del territorio: dos clientes (o el servidor) con el mismo W.terr dan lo
  // mismo, sin importar su historia. Devuelve { n: { id: [x, y] }, p: { id: [x, y] }, cerca } (cerca: los que no
  // cupieron a W.LEJOS y quedaron lo más lejos posible).
  W.QUEDAN = { tree: 1, berry: 1 };
  W.LEJOS = 12;
  const UB_R = 80, MZ_SEP = 6, MZ_R = 32;
  let UB_OFF = null, ubCache = null;
  function ubOffsets() {
    if (UB_OFF) return UB_OFF;
    UB_OFF = [];
    for (let dy = -UB_R; dy <= UB_R; dy++) for (let dx = -UB_R; dx <= UB_R; dx++) { const d = dx * dx + dy * dy; if (d <= UB_R * UB_R) UB_OFF.push([dx, dy, d]); }
    UB_OFF.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]); // mismo orden siempre: mismo destino
    return UB_OFF;
  }
  // distancia (Chebyshev, en casillas) de cada casilla al territorio más cercano, hasta W.LEJOS
  W.distTerritorio = function (terr) {
    const w = W.W, h = W.H, N = w * h, L = W.LEJOS, d = new Uint8Array(N).fill(L);
    let q = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (terr[W.parcel(x, y)]) { const k = y * w + x; d[k] = 0; q.push(k); }
    for (let v = 1; v < L && q.length; v++) {
      const nq = [];
      for (const k of q) {
        const x = k % w, y = (k / w) | 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const xx = x + i, yy = y + j;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const kk = yy * w + xx;
          if (d[kk] > v) { d[kk] = v; nq.push(kk); }
        }
      }
      q = nq;
    }
    return d;
  };
  function ubicar0(terr, key, forz, ap) {
    const w = W.W, N = w * W.H, dist = W.distTerritorio(terr), ocup = new Uint8Array(N), out = { n: {}, p: {}, cerca: 0, sub: {} };
    // pk-62: las entradas de mazmorra que se mudan quedan a MZ_SEP casillas de toda otra entrada y a no más de MZ_R
    // de donde las puso el mapa; la que no tiene lugar así queda «bajo tierra» (sin casilla: se entra desde el Cuartel)
    const esMz = id => !!D.POI[W.pois[id].kind].dungeon, mzCerca = new Uint8Array(N);
    const marcaMz = (x0, y0) => { for (let j = 1 - MZ_SEP; j < MZ_SEP; j++) for (let i = 1 - MZ_SEP; i < MZ_SEP; i++) if (W.inb(x0 + i, y0 + j)) mzCerca[W.idx(x0 + i, y0 + j)] = 1; };
    const enTerr = (x, y) => !!terr[W.parcel(x, y)];
    const nOrig = W.ORIG.n.length, pOrig = W.ORIG.p.length;
    const poiTerr = id => { const p = W.pois[id], [x0, y0] = W.ORIG.p[id]; for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) if (enTerr(x0 + i, y0 + j)) return true; return false; };
    const poiMueve = id => poiTerr(id) || !!(forz && forz.has(id)); // pk-78: también el que pisa una Calzada Real
    const nodoMueve = id => { const n = W.nodes[id]; return !W.QUEDAN[n.kind] && enTerr(W.ORIG.n[id][0], W.ORIG.n[id][1]); };
    const mueveP = [], mueveN = [];
    // lo que se queda ocupa su lugar original
    for (let id = 0; id < pOrig; id++) {
      if (poiMueve(id)) { mueveP.push(id); continue; }
      const p = W.pois[id], [x0, y0] = W.ORIG.p[id];
      for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) ocup[W.idx(x0 + i, y0 + j)] = 1;
      if (esMz(id)) marcaMz(x0, y0);
    }
    for (let id = 0; id < nOrig; id++) { if (nodoMueve(id)) mueveN.push(id); else ocup[W.idx(W.ORIG.n[id][0], W.ORIG.n[id][1])] = 1; }
    // libre según datos fijos: el terreno, las zonas, las parcelas comunes, lo reservado y lo ya ubicado
    const libre = (x, y) => { if (!W.inb(x, y)) return false; const k = y * w + x; return !ocup[k] && W.terrain[k] !== 4 && !W.reserved[k] && W.zoneAt[k] < 0 && !W.terrCommon[W.parcel(x, y)] && !enTerr(x, y); };
    const cerca = (x0, y0, cabe, lejos) => {
      for (const [dx, dy, d2] of ubOffsets()) {
        if (d2 > MZ_R * MZ_R) return null;
        const x = x0 + dx, y = y0 + dy;
        if (W.inb(x, y) && lejos(x, y) >= 2 && cabe(x, y)) return [x, y];
      }
      return null;
    };
    const buscar = (x0, y0, cabe, lejos, r2) => {
      let mejor = null, md = -1;
      for (const [dx, dy, d2] of ubOffsets()) {
        if (r2 && d2 > r2) return null; // con radio, solo a W.LEJOS o nada
        const x = x0 + dx, y = y0 + dy;
        if (!W.inb(x, y)) continue;
        const dd = lejos(x, y);
        if ((dd < W.LEJOS && dd <= md) || !cabe(x, y)) continue; // la distancia primero: es lo barato
        if (dd >= W.LEJOS) return [x, y];
        if (dd > md) { md = dd; mejor = [x, y]; }
      }
      if (mejor) out.cerca++;
      return mejor;
    };
    for (const id of mueveP) {
      const p = W.pois[id], [x0, y0] = W.ORIG.p[id], mz = esMz(id);
      const cabe = (x, y) => {
        if (mz && mzCerca[y * w + x]) return false;
        for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) if (!libre(x + i, y + j) || (ap && ap((y + j) * w + x + i))) return false;
        for (let j = -1; j <= p.h; j++) for (let i = -1; i <= p.w; i++) { const xx = x + i, yy = y + j; if (W.inb(xx, yy) && ocup[yy * w + xx] === 2) return false; } // dos lugares movidos nunca se tocan
        return true;
      };
      const lejos = (x, y) => { let m = 99; for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { if (!W.inb(x + i, y + j)) return 0; m = Math.min(m, dist[W.idx(x + i, y + j)]); } return m; };
      // pk-78: lo que se muda solo porque una Calzada Real lo pisa (fuera de todo territorio) va a la casilla libre más
      // cercana a 2 o más de todo territorio, sin pedir W.LEJOS: con esa regla casi todo se iba bajo tierra
      const to = forz && forz.has(id) && !poiTerr(id) ? cerca(x0, y0, cabe, lejos) : buscar(x0, y0, cabe, lejos, mz ? MZ_R * MZ_R : 0);
      if (!to) { if (mz) out.sub[id] = 1; continue; }
      if (mz) marcaMz(to[0], to[1]);
      out.p[id] = to;
      for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) ocup[W.idx(to[0] + i, to[1] + j)] = 2;
    }
    for (const id of mueveN) {
      const [x0, y0] = W.ORIG.n[id];
      const to = buscar(x0, y0, libre, (x, y) => dist[y * w + x]);
      if (!to) continue;
      out.n[id] = to;
      ocup[W.idx(to[0], to[1])] = 1;
    }
    // las casillas que quedan ocupadas por lugares y recursos que no son árboles (para la Calzada, L5). pk-78: un lugar
    // marca su id + 1 (la Calzada puede ir sobre un campamento o una mazmorra que ese reino ya venció); un recurso, -1
    const ocupa = new Int32Array(N);
    for (let id = 0; id < pOrig; id++) { if (out.sub[id]) continue; const p = W.pois[id], [x0, y0] = out.p[id] || W.ORIG.p[id]; for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) ocupa[W.idx(x0 + i, y0 + j)] = id + 1; }
    for (let id = 0; id < nOrig; id++) if (!W.QUEDAN[W.nodes[id].kind]) { const [x0, y0] = out.n[id] || W.ORIG.n[id]; ocupa[W.idx(x0, y0)] = -1; }
    Object.defineProperty(out, 'ocupa', { value: ocupa, enumerable: false }); // fuera del JSON (la prueba compara posiciones)
    return out;
  }
  // pk-78 (pedido del dueño): los campamentos de bandidos y las mazmorras que alguien venció puede pisarlos su Calzada
  // Real; para los demás, el lugar que una Calzada pisa se muda. ap(k): ¿hay Calzada en la casilla k? (el cliente lee
  // W.autopista, el servidor su documento); apv: una versión de esa capa, solo para la caché. Sin ap, como antes.
  // Pura: la misma respuesta en el cliente y en el servidor con la misma capa.
  W.PISABLE = kind => kind === 'camp' || !!(D.POI[kind] && D.POI[kind].dungeon);
  let ub2Cache = null;
  W.ubicarLugares = function (terr, ap, apv) {
    terr = terr || W.terr;
    if (!W.ORIG || W.tema === 'mar') return { n: {}, p: {}, cerca: 0, ocupa: new Int32Array(0) };
    const key = Array.from(terr).join(',');
    if (!ubCache || ubCache.key !== key) ubCache = { key, r: ubicar0(terr, key, null, null) };
    const base = ubCache.r;
    if (!ap) return base;
    const pisa = [];
    for (let id = 0; id < W.ORIG.p.length; id++) {
      const p = W.pois[id];
      if (base.sub[id] || !W.PISABLE(p.kind)) continue;
      const [x0, y0] = base.p[id] || W.ORIG.p[id];
      let si = false;
      for (let j = 0; j < p.h && !si; j++) for (let i = 0; i < p.w; i++) if (ap(W.idx(x0 + i, y0 + j))) { si = true; break; }
      if (si) pisa.push(id);
    }
    if (!pisa.length) return base;
    const k2 = key + '|' + pisa.join(',') + '|' + apv;
    if (!ub2Cache || ub2Cache.key !== k2) ub2Cache = { key: k2, r: ubicar0(terr, k2, new Set(pisa), ap) };
    return ub2Cache.r;
  };
  // L5: ¿puede ir una casilla de Calzada Real ahí, para ese reino? Pura (datos fijos, territorio y W.ubicarLugares):
  // la misma respuesta en el cliente y en el servidor. Los edificios los mira solo el cliente (L.calzadaLibre).
  // pk-78 (pedido del dueño): también en las zonas comunes (no sobre el mineral: el recurso marca su casilla en ocupa) y
  // sobre un campamento o una mazmorra que ese reino ya venció (venc: Set o { id: 1 } de ids de W.pois). ub: lo que
  // devuelve W.ubicarLugares con la capa de Calzada (se pasa una vez para muchas casillas).
  W.calzadaPuede = function (k, slot, terr, ub, venc) {
    terr = terr || W.terr;
    if (!(k >= 0 && k < W.W * W.H) || W.tema === 'mar' || !W.ORIG) return false;
    const x = k % W.W, y = (k / W.W) | 0, pc = W.parcel(x, y);
    if (W.terrain[k] === 4) return false;
    if (terr[pc] && terr[pc] !== slot + 1) return false; // no en tierra ajena
    const o = (ub || W.ubicarLugares(terr)).ocupa[k];
    if (!o) return true;
    if (o < 0 || !venc) return false;
    const id = o - 1;
    return !!(venc.has ? venc.has(id) : venc[id]) && W.PISABLE(W.pois[id].kind);
  };
  W.countParcels = slot => { let n = 0; for (let k = 0; k < W.terr.length; k++) if (W.terr[k] === slot + 1) n++; return n; };
  W.saveTerr = () => Array.from(W.terr).join(',');
  W.loadTerr = function (str) {
    if (!str) return;
    const a = str.split(',');
    if (a.length !== W.terr.length) return;
    for (let k = 0; k < a.length; k++) W.terr[k] = +a[k] || 0;
    W.terrVer++;
  };

})();
