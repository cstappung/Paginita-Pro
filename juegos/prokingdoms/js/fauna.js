// Animales (pk-50, evaluación del arte: lobos, ciervos y el caballo del jinete eran cajas de pocos píxeles).
// Un pintor de cuadrúpedos con volumen: el cuerpo, el pecho, las ancas y la cabeza son elipses sombreadas como esferas
// (luz de arriba a la izquierda, 4 tonos), el cuello, la cola y el hocico son trazos de grosor variable, y las patas
// tienen dos tramos que se doblan al levantarse, con el paso calculado por fase (trote o galope). Al final, contorno
// oscuro y sombra en el suelo. Todo a la resolución doble de los aldeanos (`k: 2`): el render los dibuja a w x h.
// Sprites.init los usa para S.wolf (6 cuadros de carrera), S.deer (de pie, mirando y pastando) y S.deerGold; el
// jinete (S.troop 'rider') usa F.caballo.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U;
  const F = (PK.Fauna = {});
  const cl3 = v => Math.max(0, Math.min(255, Math.round(v)));
  const sh = (c, f) => [cl3(c[0] * f), cl3(c[1] * f), cl3(c[2] * f)];
  const mx = (a, b, t) => [cl3(a[0] + (b[0] - a[0]) * t), cl3(a[1] + (b[1] - a[1]) * t), cl3(a[2] + (b[2] - a[2]) * t)];
  const LUZ = (() => { const l = Math.hypot(-0.5, -0.75, 0.55); return [-0.5 / l, -0.75 / l, 0.55 / l]; })();
  const TONO = k => (k > 0.78 ? 1.16 : k > 0.5 ? 1 : k > 0.25 ? 0.82 : 0.66); // 4 tonos, como pixel art

  function lienzo(W, H, flip) {
    const col = new Array(W * H).fill(null), alfa = new Float32Array(W * H);
    const X = x => (flip ? W - 1 - x : x);
    const B = {
      W, H, col, alfa,
      p(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H || !c) return; const i = y * W + X(x); col[i] = c; alfa[i] = 1; },
      // elipse con volumen. o.vientre: color de la parte de abajo (ny > o.vy); o.lomo: color de arriba (ny < o.ly)
      e(cx, cy, rx, ry, base, o) {
        o = o || {};
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
          if (d > 1) continue;
          const nz = Math.sqrt(1 - d), k = Math.max(0, nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2]);
          let c = base;
          if (o.vientre && ny > (o.vy === undefined ? 0.45 : o.vy)) c = o.vientre;
          if (o.lomo && ny < (o.ly === undefined ? -0.55 : o.ly)) c = o.lomo;
          this.p(x, y, sh(c, TONO(k) * (o.k || 1)));
        }
      },
      // trazo de (x0,y0) a (x1,y1), radio de r0 a r1, sombreado a lo ancho
      t(x0, y0, x1, y1, r0, r1, base, o) {
        o = o || {};
        const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
        const xa = Math.floor(Math.min(x0, x1) - Math.max(r0, r1) - 1), xb = Math.ceil(Math.max(x0, x1) + Math.max(r0, r1) + 1);
        const ya = Math.floor(Math.min(y0, y1) - Math.max(r0, r1) - 1), yb = Math.ceil(Math.max(y0, y1) + Math.max(r0, r1) + 1);
        for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
          const px = x + 0.5 - x0, py = y + 0.5 - y0, s = U.clamp((px * (x1 - x0) + py * (y1 - y0)) / (L * L), 0, 1);
          const qx = px - s * (x1 - x0), qy = py - s * (y1 - y0), r = r0 + (r1 - r0) * s, d = Math.hypot(qx, qy);
          if (d > r) continue;
          const lado = (qx * nx + qy * ny) / r; // -1..1 a través del trazo
          const k = 0.55 - lado * 0.45 * Math.sign(nx * LUZ[0] + ny * LUZ[1] || 1) + (o.luz || 0);
          this.p(x, y, sh(base, TONO(U.clamp(k, 0, 1)) * (o.k || 1)));
        }
      },
      // polígono plano (alas): tono por fila, más claro arriba
      poly(pts, base, k0, k1) {
        const ys = pts.map(q => q[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
        for (let y = y0; y <= y1; y++) {
          const xs = [];
          for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((y + 0.5 >= Math.min(ay, by)) && (y + 0.5 < Math.max(ay, by))) xs.push(ax + ((y + 0.5 - ay) * (bx - ax)) / (by - ay)); }
          xs.sort((p1, p2) => p1 - p2);
          const k = (k0 || 1.1) + ((k1 || 0.8) - (k0 || 1.1)) * ((y - y0) / Math.max(1, y1 - y0));
          for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.p(x, y, sh(base, TONO(U.clamp((k - 0.6) / 0.6, 0, 1))));
        }
      },
      sombra(cx, cy, rx, ry, a) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
          if (d > 1 || x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = y * W + X(x); if (!col[i]) { col[i] = [0, 0, 0]; alfa[i] = a * (1 - d * 0.5); }
        }
      },
      // contorno oscuro (del tono del vecino) y salida a canvas
      canvas() {
        const out = col.slice(), oa = Float32Array.from(alfa);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (alfa[i] >= 1) continue;
          let v = null;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && alfa[yy * W + xx] >= 1) { v = col[yy * W + xx]; break; } }
          if (v) { out[i] = mx(sh(v, 0.32), [18, 12, 10], 0.4); oa[i] = 1; }
        }
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'), img = x.createImageData(W, H);
        for (let i = 0; i < W * H; i++) if (out[i]) { img.data[i * 4] = out[i][0]; img.data[i * 4 + 1] = out[i][1]; img.data[i * 4 + 2] = out[i][2]; img.data[i * 4 + 3] = Math.round(oa[i] * 255); }
        x.putImageData(img, 0, 0);
        return c;
      },
    };
    return B;
  }
  // Una pata de dos tramos. ang: hacia adelante (+) o atrás (−) desde la vertical; alza: 0..1 (al levantarla se dobla).
  // trasera: el corvejón dobla al revés.
  function pata(B, hx, hy, l1, l2, r0, r1, ang, alza, trasera, col, pezuna) {
    const dob = alza * 1.1;
    const a1 = trasera ? ang - 0.25 - dob * 0.2 : ang + dob * 0.35;
    const kx = hx + Math.sin(a1) * l1, ky = hy + Math.cos(a1) * l1;
    const a2 = trasera ? ang + 0.3 + dob * 0.9 : ang - dob * 1.1;
    const fx = kx + Math.sin(a2) * l2, fy = ky + Math.cos(a2) * l2;
    B.t(hx, hy, kx, ky, r0, (r0 + r1) / 2, col);
    B.t(kx, ky, fx, fy, (r0 + r1) / 2, r1, col);
    if (pezuna) { B.p(fx, fy, pezuna); B.p(fx + 1, fy, pezuna); }
  }
  // fase 0..1 → ángulo y alza de cada pata (desfase por pata)
  const paso = (fase, desf, amp) => { const a = 2 * Math.PI * (fase + desf); return [Math.sin(a) * amp, Math.max(0, Math.cos(a))]; };
  const sprite = (B, ax, ay) => { const c = B.canvas(); return { c, ax: ax / 2, ay: ay / 2, k: 2, w: B.W / 2, h: B.H / 2, mask: null }; };

  // ---------- Lobo ----------
  // fase: 0..1 del trote (null = quieto). El mapa usa 6 cuadros; la batalla, los mismos.
  F.lobo = function (fase, flip, pelaje) {
    const W = 40, H = 28, B = lienzo(W, H, flip), suelo = 25;
    const g = pelaje || [128, 124, 118], osc = sh(g, 0.62), crema = [206, 196, 178], ojo = [250, 196, 60];
    const anda = fase !== null && fase !== undefined, ff = anda ? fase : 0, bob = anda ? Math.sin(ff * Math.PI * 4) * 0.6 : 0;
    B.sombra(20, suelo + 0.5, 13, 2, 0.32);
    const legs = [[25, 0.5, false, false], [12, 0, true, false], [27, 0, false, true], [14, 0.5, true, true]]; // x, desfase, trasera, cerca
    const amp = anda ? 0.62 : 0;
    for (const [hx, d, tr, cerca] of legs) if (!cerca) { const [a, al] = paso(ff, d, amp); pata(B, hx, 15 + bob, 5, 5.5, 1.7, 1.1, a, al, tr, sh(g, 0.72), sh(osc, 0.7)); }
    // cola (se mece)
    const cola = anda ? Math.sin(ff * Math.PI * 2) * 1.5 : 0;
    B.t(8, 11 + bob, 3, 15 + cola, 2.2, 1.5, g); B.p(2, 16 + cola, crema); B.p(3, 16 + cola, crema);
    B.e(11, 13 + bob, 5.5, 4.8, g, { vientre: crema, lomo: osc });
    B.e(18, 13 + bob, 9, 4.2, g, { vientre: crema, lomo: osc, ly: -0.4 });
    B.e(25.5, 12.5 + bob, 5, 5, g, { vientre: crema, vy: 0.2 });
    for (const [hx, d, tr, cerca] of legs) if (cerca) { const [a, al] = paso(ff, d, amp); pata(B, hx, 15 + bob, 5, 5.5, 1.8, 1.2, a, al, tr, g, osc); }
    // cuello, cabeza, hocico, orejas, ojo y nariz
    const cab = anda ? Math.sin(ff * Math.PI * 4 + 1) * 0.5 : 0;
    B.t(26, 11 + bob, 30, 8 + cab, 3.6, 2.8, g, { luz: 0.1 });
    B.e(32, 7.5 + cab, 4, 3.3, g, { vientre: crema, vy: 0.3 });
    B.t(34, 8.6 + cab, 38.6, 9.2 + cab, 1.9, 1.2, g); B.t(34, 10 + cab, 37.5, 10.2 + cab, 1, 0.8, crema);
    for (const ox of [30.5, 32.8]) { B.p(ox, 3.5 + cab, osc); B.p(ox, 4.5 + cab, osc); B.p(ox + 0.6, 4.5 + cab, sh(g, 0.9)); B.p(ox, 2.5 + cab, sh(osc, 0.8)); }
    B.p(33.6, 6.6 + cab, ojo); B.p(34.4, 6.6 + cab, [30, 20, 14]);
    B.p(39, 8.8 + cab, [24, 18, 16]); B.p(38.6, 10.4 + cab, [24, 18, 16]);
    return sprite(B, 20, suelo);
  };

  // ---------- Oso (batalla) ----------
  F.oso = function (fase, flip) {
    const W = 56, H = 36, B = lienzo(W, H, flip), suelo = 33;
    const pel = [112, 72, 42], osc = [70, 44, 26], luz = [150, 102, 62], hocico = [176, 138, 96], neg = [26, 16, 10];
    const anda = fase !== null && fase !== undefined, ff = anda ? fase : 0, bob = anda ? Math.abs(Math.sin(ff * Math.PI * 2)) * -0.8 : 0;
    B.sombra(27, suelo + 0.5, 19, 2.5, 0.34);
    const legs = [[37, 0.5, false, false], [17, 0, true, false], [39, 0, false, true], [19, 0.5, true, true]], amp = anda ? 0.4 : 0;
    for (const [hx, d, tr, cerca] of legs) if (!cerca) { const [a, al] = paso(ff, d, amp); pata(B, hx, 22 + bob, 5, 6, 3.4, 2.6, a, al * 0.6, tr, sh(pel, 0.7), neg); }
    B.e(17, 19 + bob, 8, 8, pel, { lomo: luz, ly: -0.6 });
    B.e(27, 19 + bob, 12, 8, pel, { lomo: luz, ly: -0.6 });
    B.e(36, 17 + bob, 8, 9, pel, { lomo: luz, ly: -0.5 }); // la joroba de los hombros
    for (const [hx, d, tr, cerca] of legs) if (cerca) { const [a, al] = paso(ff, d, amp); pata(B, hx, 22 + bob, 5, 6, 3.6, 2.8, a, al * 0.6, tr, pel, neg); }
    for (const x of [36, 41]) { B.p(x + 2, suelo, [240, 230, 210]); B.p(x + 3, suelo, [240, 230, 210]); } // garras
    const cab = anda ? Math.sin(ff * Math.PI * 4) * 0.6 : 0;
    B.e(45, 17 + bob + cab, 6, 5.4, pel, { vientre: luz, vy: 0.4 });
    B.t(48, 18.5 + bob + cab, 53, 19.5 + bob + cab, 3, 2.2, hocico);
    B.p(54, 18.5 + bob + cab, neg); B.p(53.5, 19 + bob + cab, neg); B.p(47.5, 15.5 + bob + cab, neg); B.p(48, 15.2 + bob + cab, [220, 200, 170]);
    B.e(42, 12 + bob + cab, 1.8, 1.8, osc); B.e(46, 12 + bob + cab, 1.6, 1.6, osc); // orejas
    B.p(52, 21.6 + bob + cab, sh(hocico, 0.6));
    return sprite(B, 27, suelo);
  };

  // ---------- Esqueleto (batalla) ----------
  // modo: 'walk' (fase 0..1), 'work' (golpe: fase 0..1 del tajo), 'idle'. Del tamaño de un aldeano (22x22 lógicos).
  F.esqueleto = function (modo, fase, flip) {
    const W = 44, H = 44, B = lienzo(W, H, flip), suelo = 38, cx = 17;
    const hue = [234, 228, 208], hueO = [168, 160, 140], neg = [30, 24, 26], ojo = [120, 240, 255], trapo = [70, 56, 64], oxid = [150, 110, 80];
    const ff = fase || 0, anda = modo === 'walk', bob = anda ? Math.abs(Math.sin(ff * Math.PI * 2)) * -1 : modo === 'idle' ? Math.sin(ff * Math.PI * 2) * 0.5 : 0;
    B.sombra(cx, suelo + 0.5, 7, 1.6, 0.32);
    const hip = 26 + bob;
    // piernas (huesos finos, con rodilla)
    for (const [ox, d, cerca] of [[-1.5, 0.5, false], [1.5, 0, true]]) {
      const [a, al] = anda ? paso(ff, d, 0.5) : [0, 0];
      pata(B, cx + ox, hip + 1, 5.5, 6, 1, 0.9, a, al, false, cerca ? hue : hueO);
      const fx = cx + ox + Math.sin(a) * 9.5; B.p(fx + 1, suelo, cerca ? hue : hueO); B.p(fx + 2, suelo, cerca ? hue : hueO);
    }
    // brazo de atrás
    const sw = modo === 'work' ? Math.sin(ff * Math.PI * 2) : anda ? Math.sin(ff * Math.PI * 2) * 0.4 : 0;
    B.t(cx - 2, 15 + bob, cx - 4 - sw * 2, 21 + bob, 1, 0.9, hueO); B.t(cx - 4 - sw * 2, 21 + bob, cx - 3 - sw * 3, 26 + bob, 0.9, 0.8, hueO);
    // pelvis, trapo, columna y costillas
    B.e(cx, hip, 3.6, 1.8, hue);
    B.poly([[cx - 4, hip - 1], [cx + 4, hip - 1], [cx + 3, hip + 4], [cx - 1, hip + 3], [cx - 3, hip + 5]], trapo, 1, 0.7);
    B.t(cx, 13 + bob, cx, hip - 1, 0.8, 0.8, hueO);
    for (let i = 0; i < 4; i++) { const y = 15.5 + i * 2.2 + bob, w = 4.2 - i * 0.5; B.t(cx - w, y + 0.6, cx + w, y + 0.6, 0.6, 0.6, hue); B.p(cx - w, y + 1.4, hueO); B.p(cx + w, y + 1.4, hueO); }
    B.t(cx - 4.6, 14 + bob, cx + 4.6, 14 + bob, 0.8, 0.8, hue); // clavículas
    // cráneo
    B.e(cx + 0.5, 9 + bob, 4.4, 4.2, hue);
    B.t(cx + 1, 12.5 + bob, cx + 3.5, 13.2 + bob, 1.4, 1, hue); // mandíbula
    B.p(cx + 2, 8.5 + bob, neg); B.p(cx + 3, 8.5 + bob, neg); B.p(cx + 2.4, 9.3 + bob, ojo); B.p(cx - 0.5, 8.8 + bob, neg); B.p(cx - 0.5, 9.5 + bob, sh(ojo, 0.7));
    B.p(cx + 3.6, 10.8 + bob, neg); for (const x of [cx + 1.5, cx + 2.6, cx + 3.6]) B.p(x, 12.3 + bob, [250, 248, 236]);
    B.p(cx - 2, 6.5 + bob, hueO); B.p(cx + 1, 5.6 + bob, [255, 255, 250]);
    // brazo de adelante con la espada oxidada
    const ex = cx + 3 + sw * 3, ey = 20 + bob - sw * 2, mx2 = ex + 2 + sw * 2, my2 = ey + 3 - sw * 4;
    B.t(cx + 2.5, 15 + bob, ex, ey, 1, 0.9, hue); B.t(ex, ey, mx2, my2, 0.9, 0.8, hue);
    const ang = -0.6 - sw * 1.1, L = 10, tipx = mx2 + Math.cos(ang) * L, tipy = my2 + Math.sin(ang) * L;
    B.t(mx2, my2, tipx, tipy, 0.9, 0.5, oxid); B.t(mx2 - Math.sin(ang) * 2, my2 + Math.cos(ang) * 2, mx2 + Math.sin(ang) * 2, my2 - Math.cos(ang) * 2, 0.6, 0.6, [90, 70, 50]);
    if (modo === 'work' && sw > 0.5) for (let i = 0; i < 5; i++) B.p(tipx - Math.cos(ang) * i * 1.5, tipy - Math.sin(ang) * i * 1.5 - 1, [255, 255, 240]); // brillo del tajo
    return sprite(B, cx, suelo);
  };

  // ---------- Gólem (batalla) ----------
  // Roca con vetas y cristales que brillan (cr: color del cristal). fase: balanceo de los brazos.
  F.golem = function (fase, flip, cr) {
    const W = 48, H = 50, B = lienzo(W, H, flip), suelo = 46, cx = 22;
    const roca = [124, 118, 108], osc = [84, 80, 74], luz = [160, 154, 142], musgo = [86, 120, 62];
    const ff = fase || 0, bra = Math.sin(ff * Math.PI * 2) * 2.2, bob = Math.abs(Math.sin(ff * Math.PI * 2)) * -0.8;
    const brillo = cr || [122, 240, 255], brilloL = mx(brillo, [255, 255, 255], 0.6);
    B.sombra(cx, suelo + 0.5, 14, 2.4, 0.36);
    B.e(cx - 9, 25 + bob + bra, 4.5, 7, osc); B.e(cx - 9.5, 33 + bob + bra, 5, 4.4, sh(roca, 0.8)); // brazo de atrás
    for (const s2 of [-1, 1]) { B.e(cx + s2 * 4.5, 39, 4.2, 4, s2 < 0 ? osc : roca); B.e(cx + s2 * 4.8, 44, 5, 2.6, sh(roca, s2 < 0 ? 0.7 : 0.9)); } // piernas
    B.e(cx, 26 + bob, 11, 10, roca, { lomo: luz, ly: -0.55 });
    B.e(cx + 0.5, 13 + bob, 6, 5, roca, { lomo: luz });
    B.e(cx - 2, 18 + bob, 4, 2.6, musgo, { k: 0.95 }); B.p(cx - 4, 17 + bob, sh(musgo, 1.2));
    for (const [x0, y0, x1, y1] of [[cx - 5, 22, cx - 1, 30], [cx + 3, 20, cx + 6, 27], [cx - 2, 31, cx + 4, 34]]) B.t(x0, y0 + bob, x1, y1 + bob, 0.5, 0.5, sh(osc, 0.7)); // grietas
    // cristales
    for (const [x, y, h] of [[cx + 4, 17, 5], [cx - 6, 19, 4], [cx + 1, 27, 3]]) { B.t(x, y + bob, x + 1, y - h + bob, 1.2, 0.5, brillo); B.p(x, y - h + 1 + bob, brilloL); }
    B.p(cx + 2.5, 12.5 + bob, brilloL); B.p(cx + 3.5, 12.5 + bob, brillo); B.p(cx - 1, 12.5 + bob, brillo); // ojos
    B.e(cx + 10, 25 + bob - bra, 4.8, 7.5, roca, { lomo: luz }); B.e(cx + 10.5, 34 + bob - bra, 5.4, 4.6, roca, { lomo: luz }); // brazo de adelante
    B.p(cx + 11, 33 + bob - bra, brillo);
    return sprite(B, cx, suelo);
  };

  // ---------- Ciervo ----------
  // pose: 'pie' | 'mira' (cabeza alta y girada) | 'pasta' (cabeza en el pasto). oro: el ciervo dorado.
  F.ciervo = function (pose, flip, oro, astas, manchas) {
    const W = 36, H = 34, B = lienzo(W, H, flip), suelo = 31;
    const pel = oro ? [236, 188, 70] : [156, 100, 58], osc = oro ? [184, 130, 34] : [108, 68, 40], vien = oro ? [255, 238, 170] : [220, 194, 156];
    const asta = oro ? [255, 250, 214] : [212, 190, 146], neg = [26, 18, 14];
    B.sombra(17, suelo + 0.5, 11, 2, 0.32);
    const piernas = [[22, 0.25, false, false], [11, 0.75, true, false], [24, 0, false, true], [13, 0.5, true, true]];
    for (const [hx, , tr, cerca] of piernas) if (!cerca) pata(B, hx, 19, 5.5, 6.5, 1.25, 0.8, tr ? -0.05 : 0.05, 0, tr, sh(pel, 0.7), neg);
    B.e(10.5, 16.5, 5, 4.5, pel, { vientre: vien, lomo: osc, vy: 0.5 });
    B.e(17, 17, 9, 4.2, pel, { vientre: vien, lomo: osc, vy: 0.5, ly: -0.6 });
    B.e(23, 16.5, 4.5, 4.6, pel, { vientre: vien, vy: 0.4 });
    B.p(6, 14, [250, 246, 236]); B.p(6, 15, [250, 246, 236]); B.p(5, 14, sh(pel, 0.9)); // la cola blanca
    if (manchas) for (const [x, y] of [[14, 15], [17, 14], [20, 15], [16, 17], [12, 16]]) B.p(x, y, mx(pel, vien, 0.6));
    for (const [hx, , tr, cerca] of piernas) if (cerca) pata(B, hx, 19, 5.5, 6.5, 1.35, 0.9, tr ? -0.05 : 0.05, 0, tr, pel, neg);
    let hx = 28.5, hy = 7, nx0 = 24, ny0 = 15;
    if (pose === 'pasta') { hx = 29; hy = 26; }
    if (pose === 'mira') { hx = 27; hy = 5.5; }
    B.t(nx0, ny0, hx - 1, hy + 1.5, 2.7, 1.9, pel, { luz: 0.1 });
    B.e(hx, hy, 3, 2.5, pel, { vientre: vien, vy: 0.4 });
    const dir = pose === 'mira' ? 0.6 : 1;
    B.t(hx + 1.5 * dir, hy + 0.8, hx + 4 * dir, hy + 1.8, 1.6, 1, pel); B.p(hx + 4.4 * dir, hy + 1.6, neg);
    B.p(hx + 0.6 * dir, hy - 0.6, neg); // ojo
    B.t(hx - 1.5, hy - 1.5, hx - 3.5, hy - 3.5, 1, 0.6, osc); // oreja
    if (astas) {
      const b0 = [hx - 0.5, hy - 2.2];
      B.t(b0[0], b0[1], b0[0] - 1, b0[1] - 4, 0.6, 0.5, asta); B.t(b0[0] - 1, b0[1] - 4, b0[0] - 3, b0[1] - 6.5, 0.5, 0.4, asta);
      B.t(b0[0] - 0.8, b0[1] - 3, b0[0] + 1.5, b0[1] - 5.5, 0.5, 0.4, asta); B.t(b0[0] - 2, b0[1] - 5.2, b0[0] - 1.5, b0[1] - 7.5, 0.45, 0.35, asta);
      B.t(b0[0] + 1, b0[1], b0[0] + 2, b0[1] - 3, 0.5, 0.4, sh(asta, 0.85));
    }
    return sprite(B, 17, suelo);
  };

  // ---------- Estatua (Coloso del Reino y Coloso de Bronce) ----------
  // Un guerrero de bronce con yelmo de cresta, capa, escudo del reino y la antorcha en alto. es: escala (1 = 64 px de
  // alto); partes: { piernas, torso, cabeza, lanza, antorcha, escudo } (la Maravilla la levanta por fases). Devuelve el
  // canvas (a la resolución del mapa) y dónde van los pies y la llama.
  F.estatua = function (es, col, partes) {
    partes = partes || { piernas: 1, torso: 1, cabeza: 1, antorcha: 1, escudo: 1 };
    const S = es || 1, W = Math.ceil(34 * S), H = Math.ceil(76 * S), B = lienzo(W, H, false);
    const q = v => v * S, oy = 10; // margen arriba para la llama
    const br = [192, 130, 66], brO = [132, 86, 44], brL = [236, 186, 110], capa = [118, 76, 40];
    const Y = v => q(v + oy);
    if (partes.torso) B.poly([[q(9), Y(22)], [q(25), Y(22)], [q(28), Y(52)], [q(6), Y(52)]], capa, 0.95, 0.7); // capa por detrás
    // la lanza va en la mano del escudo: el asta primero (queda detrás del brazo y del escudo), el puño encima al final
    const lanza = partes.lanza && partes.torso, LX = 4.4;
    if (lanza) { B.t(q(LX), Y(3), q(LX), Y(63), q(0.75), q(0.75), [120, 80, 44]); B.poly([[q(LX), Y(-4)], [q(LX + 1.9), Y(3.5)], [q(LX - 1.9), Y(3.5)]], [210, 214, 226], 1.2, 0.9); B.t(q(LX - 1.3), Y(3.6), q(LX + 1.3), Y(3.6), q(0.6), q(0.6), [236, 196, 96]); }
    if (partes.piernas) {
      for (const s2 of [-1, 1]) { const x = q(17 + s2 * 3.4); B.t(x, Y(40), x + s2 * q(0.6), Y(51), q(2.9), q(2.4), br); B.t(x + s2 * q(0.6), Y(51), x + s2 * q(0.8), Y(62), q(2.4), q(2), br); B.e(x + s2 * q(1.2), Y(63), q(3.2), q(1.4), brO); }
      B.poly([[q(10.5), Y(34)], [q(23.5), Y(34)], [q(25), Y(45)], [q(9), Y(45)]], br, 1.12, 0.78); // faldón
      for (let x = 11; x <= 23; x += 3) B.t(q(x), Y(37), q(x + 0.3), Y(44), q(0.5), q(0.5), brO);
    }
    if (partes.torso) {
      B.e(q(17), Y(32), q(5.6), q(4.2), br); // cintura
      B.e(q(17), Y(27), q(8.4), q(5.6), br, { lomo: brL, ly: -0.45 }); // pecho
      B.t(q(17), Y(24), q(17), Y(34), q(0.5), q(0.5), brO); // línea de la coraza
      for (const s2 of [-1, 1]) { B.t(q(17 + s2 * 1.5), Y(29), q(17 + s2 * 6), Y(28), q(0.45), q(0.45), brO); B.p(q(17 + s2 * 3.5), Y(25.5), brL); }
      for (const s2 of [-1, 1]) B.e(q(17 + s2 * 8), Y(23.5), q(3.6), q(3), br, { lomo: brL }); // hombreras
      B.t(q(10.5), Y(35), q(23.5), Y(35), q(1.1), q(1.1), brO); // cinturón
      B.p(q(17), Y(35), [255, 220, 120]);
      // brazo de la antorcha (alzado) y el del escudo
      B.t(q(25), Y(24), q(28), Y(15), q(2.9), q(2.4), br); B.t(q(28), Y(15), q(28.5), Y(7), q(2.4), q(2), br);
      if (lanza) { B.t(q(9), Y(24), q(5.6), Y(31), q(2.9), q(2.5), br); B.t(q(5.6), Y(31), q(LX + 0.4), Y(28.5), q(2.4), q(2.1), br); } // codo afuera, puño en el asta
      else { B.t(q(9), Y(24), q(6.5), Y(31), q(2.9), q(2.5), br); B.t(q(6.5), Y(31), q(7), Y(37), q(2.5), q(2.1), br); }
      B.t(q(27.2), Y(11), q(29.6), Y(11), q(0.8), q(0.8), [236, 196, 96]); if (!lanza) B.t(q(5.4), Y(33), q(8), Y(33), q(0.8), q(0.8), [236, 196, 96]); // brazaletes
    }
    if (partes.cabeza) {
      B.t(q(17), Y(20), q(17), Y(17), q(2.4), q(2.4), brO);
      B.e(q(17), Y(13.5), q(4.4), q(4.8), br);
      B.e(q(17), Y(11.5), q(5), q(4), br, { lomo: brL, ly: -0.3 }); // yelmo
      B.t(q(13), Y(13), q(21), Y(13), q(0.7), q(0.7), brO); // visera
      for (let i = 0; i < 8; i++) B.t(q(13 + i), Y(7.4 - Math.sin((i / 7) * Math.PI) * 2.2), q(13 + i), Y(9), q(0.8), q(0.8), i % 2 ? [190, 60, 50] : [220, 90, 70]); // cresta
      B.p(q(15.5), Y(14), [60, 36, 20]); B.p(q(18.5), Y(14), [60, 36, 20]);
    }
    if (partes.escudo) { // con lanza baja un poco para no tapar el puño
      const ex = q(lanza ? 6.6 : 6.5), ey = Y(lanza ? 39.5 : 37), rx = q(4.6), ry = q(lanza ? 6.2 : 6.4);
      B.e(ex, ey, rx, ry, col); B.e(ex, ey, q(1.6), q(2), [240, 204, 88]);
      for (let a = 0; a < 40; a++) { const k = (a / 40) * Math.PI * 2; B.p(ex + Math.cos(k) * rx, ey + Math.sin(k) * ry, [214, 170, 70]); }
    }
    if (lanza) { B.e(q(LX), Y(28.6), q(1.9), q(1.7), br); B.t(q(LX - 1.6), Y(27.6), q(LX + 1.6), Y(27.6), q(0.45), q(0.45), brO); } // puño
    const llama = partes.antorcha ? [q(28.5), Y(4)] : null;
    if (partes.antorcha) { B.t(q(28.5), Y(8), q(28.5), Y(4), q(1.2), q(1.4), [150, 100, 50]); B.e(q(28.5), Y(4), q(1.8), q(0.9), [240, 200, 90]); }
    return { c: B.canvas(), pies: [q(17), Y(63)], llama, cabeza: [q(17), Y(2.5)], w: W, h: H };
  };

  // ---------- El Coloso de Bronce (la Maravilla) ----------
  // pk-52: su propia estatua a tamaño real (antes era la del Coloso chico agrandada ×1.32, y la cara quedaba en una
  // mancha). Pose de la Atenea Pártenos: la antorcha en alto, la lanza en la otra mano y el escudo apoyado en el suelo.
  // Yelmo ático con carrilleras y cresta de crin, cara con cejas, ojos, nariz y boca, coraza musculada, faldón de
  // tiras (pteruges) con tachas de oro, grebas, capa con pliegues y plinto de bronce (una pátina verde salpicada
  // parecía suciedad: se probó y se sacó).
  // partes: { piernas, torso, cabeza, lanza, antorcha, escudo } como F.estatua. Devuelve { c, pies, cabeza }.
  F.coloso = function (col, partes) {
    partes = partes || { piernas: 1, torso: 1, cabeza: 1, lanza: 1, antorcha: 1, escudo: 1 };
    const OY = 9, W = 56, H = 123 + OY, B = lienzo(W, H, false);
    const e = (x, y, rx, ry, c, o) => B.e(x, y + OY, rx, ry, c, o);
    const t = (x0, y0, x1, y1, r0, r1, c, o) => B.t(x0, y0 + OY, x1, y1 + OY, r0, r1, c, o);
    const poly = (pts, c, k0, k1) => B.poly(pts.map(v => [v[0], v[1] + OY]), c, k0, k1);
    const p = (x, y, c) => B.p(x, y + OY, c);
    const plano = (cx, cy, rx, ry, c) => { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p(x, y, c); };
    const br = [200, 138, 74], brO = [116, 72, 38], brL = [244, 198, 124], brD = [160, 104, 56], yel = [186, 124, 64];
    const oro = [246, 206, 104], oroO = [170, 124, 50], luz = [255, 238, 186];
    const crin = [[200, 54, 44], [230, 90, 66], [158, 36, 30]];
    const cuerpo = partes.torso, lanza = partes.lanza && cuerpo;

    // capa por detrás, con el borde movido por el viento
    if (cuerpo) {
      poly([[17, 38], [39, 38], [44, 70], [47, 97], [41, 101], [33, 98], [25, 101], [17, 98], [10, 96], [13, 70]], brD, 1.02, 0.66);
      for (const [x0, x1] of [[19, 14], [24, 21], [32, 34], [37, 43]]) t(x0, 45, x1, 97, 0.45, 0.8, brO);
      for (const [x0, x1] of [[21, 17.5], [35, 39]]) t(x0, 47, x1, 95, 0.4, 0.55, br);
    }
    // el asta de la lanza (detrás del brazo y del escudo); apoya en el plinto
    if (lanza) {
      t(10, 4, 10, 117, 0.8, 0.8, [124, 84, 46]); t(9.6, 6, 9.6, 115, 0.3, 0.3, [164, 116, 66]);
      poly([[10, -6], [12.6, 1], [11.4, 5], [8.6, 5], [7.4, 1]], [206, 212, 226], 1.25, 0.85); // hoja
      t(10, -4, 10, 4, 0.3, 0.3, [244, 248, 255]); // filo
      t(8, 5.5, 12, 5.5, 0.7, 0.7, oro); // virola
    }
    // plinto
    e(28, 117, 15, 3.4, brD, { lomo: brL, ly: -0.2 });
    poly([[13, 117], [43, 117], [43, 121], [13, 121]], brO, 1, 0.85);
    t(13.5, 119, 42.5, 119, 0.45, 0.45, oroO);

    if (partes.piernas) {
      // izquierda (la del apoyo, recta) y derecha (suelta, rodilla adelante)
      const P2 = [[23, 70, 22, 91, 22, 111], [33, 70, 35, 90, 36.5, 110]];
      for (const [hx, hy, kx, ky, ax, ay] of P2) {
        t(hx, hy, kx, ky, 4.4, 3.3, br); // muslo
        e(kx + 0.3, ky + 6, 3.4, 5, br); // pantorrilla
        t(kx, ky + 1, ax, ay, 3.2, 2.2, br, { k: 1.1 }); // greba
        t(kx - 2.6, ky + 1.5, kx + 2.6, ky + 1.5, 0.45, 0.45, brO); t(ax - 2, ay - 0.5, ax + 2, ay - 0.5, 0.45, 0.45, brO);
        e(kx, ky, 2.6, 2.2, br, { lomo: brL, ly: -0.1 }); // rodillera
        p(kx - 1, ky - 1, luz);
        e(ax + (ax > 28 ? 1 : -1), ay + 4, 3.6, 2, brD); // pie con sandalia
        t(ax - 2.2, ay + 2.4, ax + 2.2, ay + 2.4, 0.4, 0.4, brO);
        for (let i = -1; i <= 1; i++) p(ax + (ax > 28 ? 1 : -1) + i * 1.4, ay + 5, brL); // dedos
      }
      // faldón de tiras: la fila de atrás y la de adelante, con tachas de oro
      for (let x = 18.5; x <= 37.5; x += 2.4) { t(x, 70, x + (x - 28) * 0.08, 81, 1.05, 1.05, br, { k: 0.86 }); p(x + (x - 28) * 0.08, 80.5, oro); }
      for (let x = 19.7; x <= 36.5; x += 2.4) { t(x, 64, x + (x - 28) * 0.06, 74, 1.05, 1.05, br, { k: 1.06 }); p(x + (x - 28) * 0.06, 73.5, oro); }
    }

    if (cuerpo) {
      // brazo de la lanza: hombro → codo afuera → puño en el asta
      t(17, 41, 12.5, 53, 3.5, 2.9, br); t(12.5, 53, 10.4, 61, 2.9, 2.3, br);
      t(11.2, 57.5, 12.6, 53.8, 2.5, 2.5, br, { k: 1.12 }); t(10.6, 58, 13, 58.6, 0.45, 0.45, oro); // brazal
      // coraza musculada
      e(28, 57, 8.6, 8.4, br); // vientre
      e(28, 46, 12.2, 8.8, br); // pecho
      t(28, 41, 28, 52, 0.45, 0.45, brO); // esternón
      for (const s2 of [-1, 1]) { // pectorales y abdominales
        t(28 + s2 * 0.8, 51, 28 + s2 * 5.5, 51.6, 0.5, 0.5, brO); t(28 + s2 * 5.5, 51.6, 28 + s2 * 10, 48, 0.5, 0.45, brO);
        for (const y of [55, 58.6]) { t(28 + s2 * 1, y, 28 + s2 * 5, y - 0.4, 0.42, 0.42, brO); p(28 + s2 * 3, y - 1.6, brL); }
        p(28 + s2 * 4, 44, brL); p(28 + s2 * 6.5, 45, brL);
      }
      p(28, 61.5, brO); p(23, 43, luz); p(24, 43, luz); p(33, 44, luz);
      // cinturón con hebilla
      t(19.2, 65.5, 36.8, 65.5, 1.3, 1.3, brO); e(28, 65.5, 2.1, 1.5, oro); p(27.5, 65, luz);
      // hombreras de láminas
      for (const s2 of [-1, 1]) { e(28 + s2 * 12.9, 45, 4.2, 2.4, brD); e(28 + s2 * 12.2, 42, 4.6, 3.4, br, { lomo: brL }); t(28 + s2 * 9.2, 43.6, 28 + s2 * 15.6, 43.6, 0.4, 0.4, brO); p(28 + s2 * 12.2, 41.6, oro); }
      // brazo de la antorcha: hombro → codo → puño en alto
      t(39.5, 41, 44, 28, 3.5, 2.9, br); t(44, 28, 45, 17, 2.9, 2.3, br);
      t(44.3, 24.5, 44.9, 19.5, 2.6, 2.4, br, { k: 1.12 }); t(42.3, 24.6, 46.7, 24.6, 0.45, 0.45, oro); t(42.6, 19.4, 47.1, 19.4, 0.45, 0.45, oro);
    }
    // la antorcha y su llama (dibujada aquí: es grande)
    if (cuerpo && partes.antorcha) {
      t(45.2, 17, 45.2, 6.5, 1.1, 1.5, brD);
      e(45.2, 6, 2.9, 1.5, oro); t(42.6, 5.6, 47.8, 5.6, 0.4, 0.4, oroO);
      plano(45.2, 0.8, 3.3, 5, [222, 88, 30]); plano(45.3, 2, 2.3, 3.6, [246, 156, 46]); plano(45.4, 3.2, 1.3, 2.2, [255, 226, 120]);
      for (const [x, y, c] of [[45, -5, [222, 88, 30]], [46, -6, [246, 140, 40]], [44, -3.5, [246, 156, 46]], [46.6, -3, [222, 88, 30]]]) p(x, y, c);
    }
    if (cuerpo) { // puño de la antorcha encima del mango
      e(45.2, 15.4, 2.7, 2.3, br); t(43.6, 14.6, 46.8, 14.6, 0.4, 0.4, brO); t(43.6, 16.2, 46.8, 16.2, 0.4, 0.4, brO);
    }

    if (partes.cabeza) {
      // cuello y trapecios
      poly([[25.2, 31], [30.8, 31], [31.4, 36], [38, 39.5], [18, 39.5], [24.6, 36]], br, 1.08, 0.86);
      t(25.8, 37, 26.6, 32.6, 0.35, 0.35, brO); t(30.2, 37, 29.4, 32.6, 0.35, 0.35, brO);
      // la cabeza va pixel a pixel (a esta escala las formas sueltas hacían una caja): yelmo dorado con brillo arriba
      // a la izquierda y carrilleras que enmarcan la cara; la frente en sombra bajo la visera, cejas, ojos, nariz con sus
      // aletas, boca, labio y mentón. La cresta de crin va antes, por detrás de la calota.
      for (let i = 0; i < 15; i++) { const h = 2 + Math.round(6.5 * Math.sin((Math.PI * (i + 0.5)) / 15)), c = i % 3 === 1 ? crin[1] : i % 3 === 2 ? crin[2] : crin[0]; for (let y = 0; y <= h; y++) p(21 + i, 16 - y, y === h && i < 8 ? crin[1] : c); }
      const CAB = [
        '....wYYgggggG....',
        '...wYYgggggggG...',
        '..YYYggggggggGG..',
        '.YYgggggggggggGG.',
        '.YgggggggggggggG.',
        'oGYYwYYYYYYgggGGo',
        '.YgGkkkkkkkkkgGo.',
        '.YgGfhhfhfhhkgGo.',
        '.YgGfeefhfeekgGo.',
        '.YgGfhffhfffkgGo.',
        '.YgGfffhhkffkgGo.',
        '.YgGkffdhdfkkgGo.',
        '..gGkfffffffkGo..',
        '...Gkffdddffko...',
        '....kfffhfffk....',
        '.....kffhffk.....',
        '......kkhkk......',
        '......ddddd......',
      ];
      const PAL = { Y: [252, 218, 128], g: [226, 174, 76], G: oroO, o: [118, 82, 34], w: luz, f: br, h: brL, k: brD, d: brO, e: [56, 32, 16] };
      CAB.forEach((fila, y) => { for (let x = 0; x < fila.length; x++) if (PAL[fila[x]]) p(20 + x, 15 + y, PAL[fila[x]]); });
    }
    // el escudo apoyado en el suelo, contra la pierna
    if (partes.escudo && cuerpo) {
      const ex = 15.2, ey = 101, rx = 8.6, ry = 10.2;
      e(ex, ey, rx, ry, col);
      for (let a = 0; a < 64; a++) { const k = (a / 64) * Math.PI * 2; for (const f of [1, 0.9]) p(ex + Math.cos(k) * rx * f, ey + Math.sin(k) * ry * f, f === 1 ? oroO : oro); }
      for (let a = 0; a < 40; a++) { const k = (a / 40) * Math.PI * 2; p(ex + Math.cos(k) * rx * 0.55, ey + Math.sin(k) * ry * 0.55, oroO); }
      for (let a = 0; a < 8; a++) { const k = (a / 8) * Math.PI * 2; t(ex + Math.cos(k) * 1.6, ey + Math.sin(k) * 1.9, ex + Math.cos(k) * 4, ey + Math.sin(k) * 4.8, 0.5, 0.3, oro); } // sol del reino
      e(ex, ey, 1.9, 2.2, oro); p(ex - 0.8, ey - 0.9, luz); p(ex - 5, ey - 6.5, [255, 255, 255]);
    }
    if (lanza) { e(10.2, 62, 2.4, 2.2, br); t(8.2, 61.2, 12.2, 61.2, 0.4, 0.4, brO); t(8.2, 62.8, 12.2, 62.8, 0.4, 0.4, brO); } // puño en el asta

    return { c: B.canvas(), pies: [28, 121 + OY], llama: null, cabeza: [28, 6 + OY], w: W, h: H };
  };

  // ---------- Dragón posado (Torre del Dragón) ----------
  // Mirando a la derecha, agarrado a la almena: cuerpo, cuello en S, cabeza con cuernos, alas a medio abrir con
  // membrana y nervaduras, y la cola que cuelga por el borde. Devuelve el canvas y el punto de las patas.
  F.dragon = function () {
    const W = 50, H = 44, B = lienzo(W, H, false);
    const R0 = [184, 48, 40], Ro = [116, 26, 22], Rl = [236, 104, 74], vien = [238, 178, 96], mem = [150, 36, 36], hueso = [240, 228, 200];
    // ala de atrás
    B.poly([[20, 18], [12, 2], [30, 8], [33, 14]], sh(mem, 0.7), 1, 0.7);
    for (const [x1, y1] of [[12, 2], [20, 5], [27, 8]]) B.t(20, 18, x1, y1, 0.7, 0.5, Ro);
    // cola que cuelga
    B.t(15, 29, 8, 34, 3, 2.4, R0); B.t(8, 34, 5, 41, 2.4, 1.4, R0); B.poly([[3, 41], [7, 40], [5, 44]], Ro, 1, 0.8);
    // patas traseras y cuerpo
    B.t(18, 30, 16, 36, 2.4, 1.8, Ro); B.p(15, 37, hueso); B.p(17, 37, hueso);
    B.e(22, 27, 9, 6, R0, { vientre: vien, vy: 0.35, lomo: Ro, ly: -0.7 });
    for (let x = 15; x <= 28; x += 3) B.p(x, 21, hueso); // púas del lomo
    B.t(28, 30, 29, 36, 2.2, 1.6, R0); B.p(28, 37, hueso); B.p(30, 37, hueso); // pata delantera
    // cuello en S y cabeza
    B.t(29, 25, 33, 18, 3.4, 2.8, R0, { luz: 0.1 }); B.t(33, 18, 36, 12, 2.8, 2.4, R0);
    for (let i = 0; i < 4; i++) B.p(31 + i * 1.3, 21 - i * 3, vien);
    B.e(38.5, 10.5, 4.2, 3.2, R0, { vientre: vien, vy: 0.4 });
    B.t(41, 11, 46.5, 12.5, 2.2, 1.4, R0); B.t(41, 13, 45.5, 13.8, 1, 0.8, vien); // hocico y mandíbula
    B.p(46.8, 11.8, [40, 10, 8]); B.p(39.5, 9.5, [255, 220, 90]); B.p(40.2, 9.5, [40, 10, 8]); // nariz y ojo
    B.t(36, 8, 32, 3, 1, 0.5, hueso); B.t(38, 7.5, 36, 2, 0.9, 0.4, hueso); // cuernos
    B.p(44, 14.2, [255, 255, 255]); B.p(42.5, 14.2, [255, 255, 255]); // colmillos
    // ala de adelante, más grande
    B.poly([[24, 22], [30, 0], [46, 4], [41, 13], [36, 15]], mem, 1.15, 0.75);
    for (const [x1, y1] of [[30, 0], [38, 2], [46, 4], [41, 13]]) B.t(24, 22, x1, y1, 0.9, 0.5, Ro);
    B.t(24, 22, 30, 0, 1.3, 0.8, R0); B.p(30, 0, hueso);
    return { c: B.canvas(), patas: [23, 37], w: W, h: H };
  };

  // ---------- Dragón en vuelo (jefe de las batallas) ----------
  // 72x52, mirando a la derecha. fase 0..1 del aleteo: las alas suben y bajan, la cola ondea, las patas recogidas.
  F.dragonVuelo = function (fase) {
    const W = 72, H = 52, B = lienzo(W, H, false);
    const R0 = [184, 48, 40], Ro = [116, 26, 22], vien = [238, 178, 96], mem = [150, 36, 36], hueso = [240, 228, 200];
    const a = Math.sin(fase * Math.PI * 2), alaY = a * 14; // arriba (−) y abajo (+)
    const ond = Math.sin(fase * Math.PI * 2 + 1.5);
    // ala de atrás
    B.poly([[30, 26], [18 - a * 2, 8 + alaY * 0.8], [36, 12 + alaY * 0.6], [42, 22]], sh(mem, 0.66), 1, 0.7);
    for (const [x1, y1] of [[18 - a * 2, 8 + alaY * 0.8], [27, 10 + alaY * 0.7], [36, 12 + alaY * 0.6]]) B.t(30, 26, x1, y1, 0.8, 0.5, Ro);
    // cola ondulante
    let px0 = 22, py0 = 32;
    for (let i = 1; i <= 6; i++) { const x = 22 - i * 3.4, y = 32 + Math.sin(i * 0.9 + fase * Math.PI * 2) * 2.2 * (i / 6) + i * 0.6; B.t(px0, py0, x, y, 3 - i * 0.35, 2.7 - i * 0.35, R0); px0 = x; py0 = y; }
    B.poly([[px0 - 1, py0 - 3], [px0 - 5, py0], [px0 - 1, py0 + 3]], Ro, 1, 0.8);
    // cuerpo, patas recogidas, púas
    B.e(33, 30, 12, 7, R0, { vientre: vien, vy: 0.3, lomo: Ro, ly: -0.7 });
    B.t(28, 35, 25, 39, 2.4, 1.8, Ro); B.p(24, 40, hueso); B.t(38, 35, 40, 39, 2.2, 1.7, Ro); B.p(41, 40, hueso);
    for (let x = 24; x <= 42; x += 3) B.p(x, 23, hueso);
    // cuello y cabeza (hacia adelante)
    B.t(43, 28, 52, 22 + ond, 4, 3.2, R0, { luz: 0.1 }); B.t(52, 22 + ond, 57, 20 + ond, 3.2, 2.8, R0);
    for (let i = 0; i < 4; i++) B.p(45 + i * 3, 27 - i * 1.8 + ond * (i / 4), vien);
    B.e(60, 19 + ond, 5, 3.8, R0, { vientre: vien, vy: 0.4 });
    B.t(63, 19.5 + ond, 70, 21 + ond, 2.6, 1.6, R0); B.t(63, 22 + ond, 69, 22.8 + ond, 1.2, 0.9, vien);
    B.p(70.4, 20.2 + ond, [40, 10, 8]); B.p(61, 17.6 + ond, [255, 220, 90]); B.p(61.8, 17.6 + ond, [40, 10, 8]);
    B.t(57, 16 + ond, 52, 11 + ond, 1.2, 0.5, hueso); B.t(59.5, 15.5 + ond, 57, 9.5 + ond, 1.1, 0.4, hueso);
    B.p(67, 23.4 + ond, [255, 255, 255]); B.p(65, 23.4 + ond, [255, 255, 255]);
    // ala de adelante
    B.poly([[34, 26], [40, 4 + alaY], [62, 10 + alaY * 0.9], [54, 20 + alaY * 0.4], [46, 24]], mem, 1.15, 0.75);
    for (const [x1, y1] of [[40, 4 + alaY], [51, 6 + alaY * 0.95], [62, 10 + alaY * 0.9], [54, 20 + alaY * 0.4]]) B.t(34, 26, x1, y1, 1, 0.5, Ro);
    B.t(34, 26, 40, 4 + alaY, 1.5, 0.9, R0); B.p(40, 3 + alaY, hueso);
    return B.canvas();
  };

  // ---------- Caballo (para el jinete) ----------
  // 60x56 a resolución doble, como el lienzo de montado(). fase: galope 0..1 (null = quieto). manta: color del reino.
  F.caballo = function (fase, manta, pelaje) {
    const W = 60, H = 56, B = lienzo(W, H, false), suelo = 55;
    const pel = pelaje || [124, 82, 50], osc = sh(pel, 0.62), crin = [46, 32, 24], neg = [30, 22, 18];
    const anda = fase !== null && fase !== undefined, ff = anda ? fase : 0, bob = anda ? Math.sin(ff * Math.PI * 2) * 1.2 : 0;
    B.sombra(30, suelo, 20, 2.5, 0.3);
    // galope: delanteras y traseras casi juntas
    const legs = [[41, 0.08, false, false], [19, 0.55, true, false], [43, 0, false, true], [21, 0.45, true, true]];
    const amp = anda ? 0.55 : 0;
    for (const [hx, d, tr, cerca] of legs) if (!cerca) { const [a, al] = paso(ff, d, amp); pata(B, hx, 36 + bob, 8, 10, 2.6, 1.6, a, al, tr, sh(pel, 0.7), neg); }
    const cola = anda ? Math.sin(ff * Math.PI * 2 + 1) * 2 : 0;
    B.t(14, 28 + bob, 9 - cola * 0.5, 36 + bob, 2.8, 2.2, crin); B.t(9 - cola * 0.5, 36 + bob, 8 + cola, 44 + bob, 2.2, 1.4, crin);
    B.e(19.5, 31 + bob, 7, 6.8, pel, { lomo: mx(pel, [255, 255, 255], 0.12) });
    B.e(30, 32 + bob, 13, 6.4, pel, { vientre: sh(pel, 0.86), vy: 0.55 });
    B.e(41, 31 + bob, 6.2, 6.8, pel);
    for (const [hx, d, tr, cerca] of legs) if (cerca) { const [a, al] = paso(ff, d, amp); pata(B, hx, 36 + bob, 8, 10, 2.8, 1.8, a, al, tr, pel, neg); }
    // cuello, crin, cabeza
    const cab = anda ? Math.sin(ff * Math.PI * 2 + 2) * 1 : 0;
    B.t(44, 29 + bob, 50, 17 + cab, 5, 3.4, pel, { luz: 0.08 });
    for (let i = 0; i <= 10; i++) { const s = i / 10; B.t(42.5 + s * 5.5, 25 + bob - s * 11 + cab * s, 41.5 + s * 5.5, 23 + bob - s * 11 + cab * s, 1.6, 1.2, crin); }
    B.t(50, 16 + cab, 56.5, 22.5 + cab, 3.2, 2.2, pel);
    B.e(50.5, 16 + cab, 3.4, 3, pel);
    B.p(57, 23 + cab, neg); B.p(55.5, 23.6 + cab, sh(pel, 0.5)); // nariz y boca
    B.p(52, 15.5 + cab, [20, 14, 12]); B.p(51.5, 15 + cab, [200, 190, 180]); // ojo
    B.t(48.5, 13 + cab, 48, 9.5 + cab, 1.2, 0.6, pel); B.t(50, 13 + cab, 50.3, 9.8 + cab, 1.1, 0.6, osc); // orejas
    B.t(47, 13 + cab, 46, 18 + cab, 1.4, 1, crin); // copete
    // brida
    for (let i = 0; i < 7; i++) B.p(51 + i * 0.8, 18.5 + i * 0.6 + cab, [90, 56, 30]);
    // manta y montura
    if (manta) {
      for (let y = 24; y <= 33; y++) for (let x = 23; x <= 37; x++) {
        const xx = x, yy = y + Math.round(bob);
        const borde = y === 33 || x === 23 || x === 37;
        B.p(xx, yy, borde ? [232, 190, 72] : sh(manta, x > 33 ? 0.78 : y < 26 ? 1.12 : 1));
      }
      B.e(30, 24.5 + bob, 5.5, 2.2, [110, 66, 34]);
    }
    return { c: B.canvas(), w: W, h: H };
  };
})();
