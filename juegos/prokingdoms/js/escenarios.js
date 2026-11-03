// Escenarios de las batallas en vivo (batalla.js): el campo de cada lugar dibujado en pixel art, a pantalla
// completa. Un campamento de bandidos al atardecer, con empalizada, carpas, fogata, barriles y estandartes;
// una cueva de cristal con muros de roca, estalagmitas, cristales que brillan, charcos y goteras; la guarida de
// las bestias con huesos, nidos y rayos de luz que entran del techo; las catacumbas con baldosas, columnas,
// tumbas, velas y niebla; el cráter estelar con grietas de lava y hierro que brilla; el nido del dragón con
// montañas de oro y brasas. Todo se genera por código: el fondo y el frente una sola vez (por tamaño de
// pantalla) y lo animado (fuego, brillos, partículas, luz) en cada cuadro.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U;
  const E = (PK.Escenarios = {});
  const TILE = 16;

  // ---------- Pinceles ----------
  const rgb = (c, k) => 'rgb(' + c.map(q => Math.round(U.clamp(q * (k === undefined ? 1 : k), 0, 255))).join(',') + ')';
  const mix = (a, b, t) => a.map((q, i) => q + (b[i] - q) * t);
  function pincel(x) {
    const r = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(Math.round(px), Math.round(py), w, h); };
    const sombra = (cx, cy, w, h, a) => { x.fillStyle = 'rgba(0,0,0,' + (a || 0.3) + ')'; for (let j = 0; j < h; j++) { const k = Math.sqrt(1 - Math.pow((j - h / 2 + 0.5) / (h / 2), 2)); x.fillRect(Math.round(cx - (w / 2) * k), Math.round(cy - h / 2 + j), Math.round(w * k), 1); } };
    return { r, sombra };
  }

  // ---------- Suelo ----------
  function suelo(x, w, h, base, tono, seed, extra) {
    const rnd = U.rng(seed);
    for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) {
      let k = (U.noise(i / 26, j / 26, seed) - 0.5) * tono * 2 + (U.noise(i / 7, j / 7, seed + 3) - 0.5) * tono + (rnd() - 0.5) * tono * 0.5;
      if (extra) k += extra(i, j);
      x.fillStyle = rgb(base.map(q => q + k)); x.fillRect(i, j, 2, 2);
    }
  }

  // ---------- Objetos del campamento ----------
  function carpa(p, cx, cy, col, rnd, grande) {
    const w = grande ? 38 : 28, h = grande ? 26 : 19;
    p.sombra(cx + 3, cy, w + 10, 8, 0.32);
    for (let r = 0; r < h; r++) {
      const half = Math.round(((r + 1) / h) * (w / 2)), y = cy - h + r, banda = Math.floor(r / 4) % 2;
      p.r(cx - half, y, half, 1, rgb(col, banda ? 0.72 : 0.62));     // lado en sombra
      p.r(cx, y, half, 1, rgb(col, banda ? 1.05 : 0.92));            // lado al sol
    }
    p.r(cx - 1, cy - h - 3, 2, h + 3, '#3a2412');                    // poste
    p.r(cx - 1, cy - h - 4, 2, 1, '#2a1608');
    // entrada abierta
    const eh = Math.round(h * 0.55);
    for (let r = 0; r < eh; r++) { const half = Math.round(((r + 1) / eh) * (w * 0.17)); p.r(cx - half, cy - eh + r, half * 2, 1, r > eh - 3 ? '#140a04' : '#24140a'); }
    p.r(cx - Math.round(w * 0.17) - 1, cy - eh, 1, eh, rgb(col, 1.25));
    // vientos y estacas
    for (const s of [-1, 1]) { const ex = cx + s * (w / 2 + 6); for (let k = 0; k < 7; k++) p.r(cx + s * (w / 2 - 2) + s * k, cy - h * 0.55 + (k * h * 0.5) / 7, 1, 1, '#c8b890'); p.r(ex, cy - 2, 1, 3, '#5a3a1a'); }
    if (grande) { p.r(cx, cy - h - 10, 9, 5, '#8a1a14'); p.r(cx + 2, cy - h - 9, 3, 2, '#e8d8b0'); } // banderín de la carpa del jefe
  }
  function empalizada(p, x0, y0, x1, y1, rnd) { // troncos afilados a lo largo de una recta
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, h = 14 + Math.floor(rnd() * 5);
      p.r(x, y - h, 4, h, '#6a4424'); p.r(x, y - h, 1, h, '#8a5c32'); p.r(x + 3, y - h, 1, h, '#4a2c14');
      p.r(x + 1, y - h - 2, 2, 2, '#7a5030'); p.r(x + 1, y - h + 4, 2, 1, '#3a2010'); // punta y amarra
    }
    p.r(Math.min(x0, x1), Math.min(y0, y1) - 8, Math.abs(x1 - x0) + 4, 1, '#3a2010');
  }
  function barril(p, cx, cy) { p.sombra(cx, cy, 10, 4); p.r(cx - 4, cy - 10, 8, 10, '#7a4a24'); p.r(cx - 3, cy - 10, 2, 10, '#9a643a'); p.r(cx - 4, cy - 8, 8, 1, '#3a3a40'); p.r(cx - 4, cy - 3, 8, 1, '#3a3a40'); p.r(cx - 3, cy - 11, 6, 1, '#5a3418'); }
  function caja(p, cx, cy, s) { s = s || 9; p.sombra(cx, cy, s + 4, 4); p.r(cx - s / 2, cy - s, s, s, '#8a6232'); p.r(cx - s / 2, cy - s, s, 1, '#b08848'); p.r(cx - s / 2, cy - s / 2, s, 1, '#5a3a18'); p.r(cx - s / 2, cy - s, 1, s, '#5a3a18'); p.r(cx + s / 2 - 1, cy - s, 1, s, '#5a3a18'); }
  function lena(p, cx, cy) { for (let i = 0; i < 4; i++) { p.r(cx - 8 + i, cy - 3 - i * 2, 14, 2, i % 2 ? '#6a4424' : '#7a5030'); p.r(cx - 8 + i, cy - 3 - i * 2, 2, 2, '#c8a070'); } }
  function pino(p, cx, cy, rnd, k) {
    k = k || 1; const h = Math.round((26 + rnd() * 10) * k);
    p.sombra(cx + 4, cy, 16 * k, 5, 0.35);
    p.r(cx - 1, cy - 6, 3, 6, '#4a2c14');
    for (let i = 0; i < 4; i++) { const y = cy - 6 - i * (h / 5), w = Math.round((16 - i * 3.4) * k); for (let r = 0; r < 7 * k; r++) { const hw = Math.round(((r + 1) / (7 * k)) * w / 2); p.r(cx - hw, y - 7 * k + r, hw, 1, '#1e4a2a'); p.r(cx, y - 7 * k + r, hw, 1, '#2a6236'); } }
  }
  function estandarte(p, cx, cy) { p.r(cx, cy - 30, 2, 30, '#3a2412'); p.r(cx - 2, cy - 31, 6, 1, '#2a1608'); p.r(cx - 1, cy - 1, 4, 1, '#2a1608'); }
  function armas(p, cx, cy) { p.r(cx - 9, cy - 3, 18, 2, '#5a3a18'); for (let i = 0; i < 4; i++) { p.r(cx - 7 + i * 5, cy - 16, 1, 14, '#7a5a3a'); p.r(cx - 8 + i * 5, cy - 18, 3, 3, '#b8c0c8'); } }

  // ---------- Objetos de cuevas y criptas ----------
  function roca(p, cx, cy, w, h, col, rnd) {
    p.sombra(cx + 2, cy, w + 4, 5, 0.35);
    for (let r = 0; r < h; r++) { const k = Math.sqrt(1 - Math.pow(1 - (r + 1) / h, 2)), half = Math.round((w / 2) * (0.55 + 0.45 * k)); p.r(cx - half, cy - h + r, half * 2, 1, rgb(col, 0.75 + 0.35 * (1 - r / h))); }
    p.r(cx - w / 4, cy - h + 1, w / 3, 1, rgb(col, 1.35));
  }
  function estalagmita(p, cx, cy, h, col) {
    p.sombra(cx + 2, cy, 10, 3, 0.35);
    for (let r = 0; r < h; r++) { const half = Math.max(0, Math.round(((r + 1) / h) * 4)); p.r(cx - half, cy - h + r, half, 1, rgb(col, 0.7)); p.r(cx, cy - h + r, half, 1, rgb(col, 1.05)); }
  }
  function cristales(p, cx, cy, col, rnd, n) {
    n = n || 4;
    p.sombra(cx, cy, 14, 4, 0.4);
    for (let i = 0; i < n; i++) {
      const h = 7 + Math.floor(rnd() * 12), w = 3 + Math.floor(rnd() * 2), dx = Math.round((i - (n - 1) / 2) * 3.5 + (rnd() - 0.5) * 2), lean = (rnd() - 0.5) * 0.5;
      for (let r = 0; r < h; r++) {
        const x = cx + dx + Math.round(lean * (h - r)), hw = r < 2 ? 1 : w;
        p.r(x - Math.floor(hw / 2), cy - h + r, Math.ceil(hw / 2), 1, rgb(col, 0.75));
        p.r(x, cy - h + r, Math.floor(hw / 2) + 1, 1, rgb(col, 1.15));
      }
      p.r(cx + dx, cy - h + 1, 1, Math.round(h * 0.5), rgb(mix(col, [255, 255, 255], 0.7)));
    }
  }
  function charco(p, cx, cy, w) { for (let j = 0; j < 5; j++) { const k = Math.sqrt(1 - Math.pow((j - 2) / 2.5, 2)); p.r(cx - (w / 2) * k, cy + j, w * k, 1, j === 1 ? 'rgba(150,200,230,0.45)' : 'rgba(20,40,70,0.55)'); } }
  function hueso(p, cx, cy, rnd) { const l = 6 + Math.floor(rnd() * 5); if (rnd() < 0.5) { p.r(cx - l / 2, cy, l, 2, '#e6dcc0'); p.r(cx - l / 2 - 1, cy - 1, 2, 4, '#f2ead4'); p.r(cx + l / 2 - 1, cy - 1, 2, 4, '#d8ccb0'); } else { p.r(cx, cy - l / 2, 2, l, '#e6dcc0'); p.r(cx - 1, cy - l / 2 - 1, 4, 2, '#f2ead4'); p.r(cx - 1, cy + l / 2 - 1, 4, 2, '#d8ccb0'); } }
  function craneo(p, cx, cy) { p.r(cx - 3, cy - 6, 6, 5, '#e6dcc0'); p.r(cx - 2, cy - 1, 4, 2, '#d8ccb0'); p.r(cx - 2, cy - 4, 1, 2, '#2a1a10'); p.r(cx + 1, cy - 4, 1, 2, '#2a1a10'); p.r(cx - 2, cy - 7, 4, 1, '#f2ead4'); }
  function nido(p, cx, cy, rnd) { p.sombra(cx, cy, 30, 8, 0.35); for (let i = 0; i < 70; i++) { const a = rnd() * 6.28, d = 6 + rnd() * 8; p.r(cx + Math.cos(a) * d * 1.5, cy - 3 + Math.sin(a) * d * 0.5, 3, 1, rnd() < 0.5 ? '#a8884a' : '#7a6030'); } p.r(cx - 7, cy - 4, 14, 3, '#3a2a14'); }
  function lapida(p, cx, cy, rnd) {
    p.sombra(cx + 2, cy, 14, 4, 0.4);
    p.r(cx - 5, cy - 13, 10, 13, '#7a7a80'); p.r(cx - 4, cy - 15, 8, 2, '#7a7a80'); p.r(cx - 3, cy - 16, 6, 1, '#7a7a80');
    p.r(cx - 5, cy - 13, 1, 13, '#9a9aa0'); p.r(cx + 4, cy - 13, 1, 13, '#55555c');
    p.r(cx - 1, cy - 12, 2, 6, '#45454c'); p.r(cx - 3, cy - 10, 6, 2, '#45454c'); // cruz
    if (rnd() < 0.6) p.r(cx - 5, cy - 2, 4, 2, '#4a6a3a');                       // musgo
  }
  function columna(p, cx, cy, h) {
    p.sombra(cx + 3, cy, 22, 6, 0.4);
    p.r(cx - 9, cy - 5, 18, 5, '#6a6a72'); p.r(cx - 7, cy - h, 14, h - 5, '#7c7c84'); p.r(cx - 7, cy - h, 3, h - 5, '#9a9aa2'); p.r(cx + 4, cy - h, 3, h - 5, '#5a5a62');
    for (let y = cy - h + 4; y < cy - 6; y += 6) p.r(cx - 7, y, 14, 1, '#66666e');
    p.r(cx - 9, cy - h - 4, 18, 4, '#6a6a72'); p.r(cx - 9, cy - h - 4, 18, 1, '#8a8a92');
  }
  function sarcofago(p, cx, cy) { p.sombra(cx + 2, cy, 34, 7, 0.4); p.r(cx - 15, cy - 10, 30, 10, '#5a5a62'); p.r(cx - 14, cy - 13, 28, 4, '#7a7a82'); p.r(cx - 6, cy - 13, 12, 1, '#9a9aa2'); p.r(cx - 2, cy - 12, 4, 2, '#c8a848'); }
  function pilaOro(p, cx, cy, w, rnd) {
    p.sombra(cx, cy, w + 8, 6, 0.35);
    const h = Math.round(w * 0.45);
    for (let r = 0; r < h; r++) { const half = Math.round(Math.sqrt((r + 1) / h) * (w / 2)); for (let i = -half; i < half; i += 2) p.r(cx + i, cy - h + r, 2, 1, rnd() < 0.15 ? '#fff0a0' : rnd() < 0.5 ? '#e8b83a' : '#c8901e'); }
    for (let i = 0; i < 3; i++) { const gx = cx + (rnd() - 0.5) * w * 0.6; p.r(gx, cy - h * 0.5 - rnd() * 4, 3, 3, ['#e04050', '#40a8e8', '#50d070'][i]); }
  }

  // ---------- Muros alrededor (cuevas, criptas, guarida, nido) ----------
  // Todo lo que queda fuera del campo (y un borde fino adentro) es roca, con el filo de arriba iluminado.
  function muros(x, W, H, rect, base, seed, grosor) {
    const [fx, fy, fw, fh] = rect;
    const dentro = (i, j) => { const dx = Math.max(fx - i, 0, i - (fx + fw)), dy = Math.max(fy - j, 0, j - (fy + fh)); return Math.hypot(dx, dy) > 0 ? Math.hypot(dx, dy) : -Math.min(i - fx, fx + fw - i, j - fy, fy + fh - j); };
    const es = (i, j) => dentro(i, j) + (U.noise(i / 18, j / 18, seed) - 0.5) * 22 + (U.noise(i / 6, j / 6, seed + 9) - 0.5) * 6 > -grosor;
    for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
      if (!es(i, j)) {
        // al pie de la pared de arriba: la cara de roca (vertical, con vetas) y después su sombra en el suelo
        let k = 0;
        for (let d = 2; d <= 14 && !k; d += 2) if (es(i, j - d)) k = d;
        if (k && k <= 8) { const n = U.noise(i / 3, j / 11, seed + 6); x.fillStyle = rgb(base, 0.42 + n * 0.22 - k * 0.012); x.fillRect(i, j, 2, 2); if (n > 0.72) { x.fillStyle = rgb(base, 0.3); x.fillRect(i, j, 1, 2); } }
        else if (k) { x.fillStyle = 'rgba(0,0,0,' + (0.32 - (k - 8) * 0.04) + ')'; x.fillRect(i, j, 2, 2); }
        continue;
      }
      const n = U.noise(i / 9, j / 9, seed + 4), n2 = U.noise(i / 4, j / 4, seed + 8), filo = !es(i, j + 3), arriba = !es(i, j - 3);
      let k = 0.5 + n * 0.45 + (n2 - 0.5) * 0.25;
      if (filo) k = 1.4; else if (!es(i, j + 6)) k = 1.1; else if (arriba) k = 0.38;
      x.fillStyle = rgb(base, k); x.fillRect(i, j, 2, 2);
      if (n2 > 0.8) { x.fillStyle = rgb(base, 0.3); x.fillRect(i, j, 2, 1); } // grietas en la roca
    }
    return es;
  }

  // ---------- Crear un escenario ----------
  // W, H: tamaño total (cubre la pantalla); el campo ocupa fw x fh desde (mx, my). at(u, v) pasa del campo al dibujo.
  E.crear = function (lugar, o) {
    const { W, H, fw, fh, mx, my, parado, seed, LU, LV } = o;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const frente = document.createElement('canvas'); frente.width = W; frente.height = H;
    const x = c.getContext('2d'), xf = frente.getContext('2d'), p = pincel(x), pf = pincel(xf), rnd = U.rng(seed);
    const at = (u, v) => (parado ? [mx + v * TILE, my + (LU - u) * TILE] : [mx + u * TILE, my + v * TILE]);
    const esc = { c, frente, luces: [], anim: [], part: [], oscuro: 0, tinte: null, W, H, lugar, t: 0 };
    const rect = [mx, my, fw, fh];
    // posiciones lejos del centro de la pelea: los fondos (u bajo y alto) y las orillas (v cerca de 0 o de LV)
    const orilla = () => { const u = 2 + rnd() * (LU - 4), v = rnd() < 0.5 ? 0.3 + rnd() * 1.2 : LV - 0.3 - rnd() * 1.2; return at(u, v); };
    const fondoEnemigo = (du) => at(LU - 0.6 - rnd() * (du || 4), 0.8 + rnd() * (LV - 1.6));
    const fondoMio = (du) => at(0.6 + rnd() * (du || 3), 0.8 + rnd() * (LV - 1.6));
    const objetos = []; // se dibujan ordenados por altura en pantalla (lo de abajo, adelante)
    const pone = (y, fn) => objetos.push({ y, fn });

    if (lugar === 'camp') {
      // atardecer: tierra pisada en el centro, pasto alrededor, empalizada y bosque afuera
      // tierra pisada en todo el campo; el pasto entra solo por las orillas, con borde irregular y matas
      suelo(x, W, H, [124, 98, 64], 14, seed);
      for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
        const dx = Math.max(mx - i, 0, i - (mx + fw)), dy = Math.max(my - j, 0, j - (my + fh));
        const adentro = Math.min(i - mx, mx + fw - i, j - my, my + fh - j), d = dx || dy ? Math.hypot(dx, dy) : -adentro;
        const borde = d + (U.noise(i / 14, j / 14, seed + 5) - 0.5) * 36;
        if (borde > -4) { const n = U.noise(i / 6, j / 6, seed + 2); x.fillStyle = rgb([78, 112, 50], 0.85 + n * 0.3); x.fillRect(i, j, 2, 2); if (n > 0.75) { x.fillStyle = '#5a8a3a'; x.fillRect(i, j - 1, 1, 2); } }
        else if (borde > -8) { x.fillStyle = 'rgba(70,90,40,0.45)'; x.fillRect(i, j, 2, 2); }
      }
      for (let i = 0; i < 40; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); p.r(px, py, 2, 2, 'rgba(90,70,44,0.6)'); p.r(px + 3, py + 1, 1, 1, 'rgba(160,140,110,0.7)'); } // piedritas
      for (let i = 0; i < 26; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); p.r(px, py, 2, 1, 'rgba(60,40,20,0.35)'); } // huellas
      // bosque afuera del campo
      for (let i = 0; i < 70; i++) {
        const px = rnd() * W, py = rnd() * H;
        if (px > mx - 8 && px < mx + fw + 8 && py > my - 4 && py < my + fh + 12) continue;
        pone(py, () => pino(p, px, py, rnd, 0.9 + rnd() * 0.4));
      }
      // empalizada en el fondo del campamento (lado enemigo) y a los costados, con un portón
      const e0 = at(LU - 0.2, -0.2), e1 = at(LU - 0.2, LV * 0.38), e2 = at(LU - 0.2, LV * 0.62), e3 = at(LU - 0.2, LV + 0.2);
      pone(Math.max(e0[1], e1[1]), () => empalizada(p, e0[0], e0[1], e1[0], e1[1], rnd));
      pone(Math.max(e2[1], e3[1]), () => empalizada(p, e2[0], e2[1], e3[0], e3[1], rnd));
      for (const s of [0.6, LV - 0.6]) { const a = at(LU - 7, s), b = at(LU - 0.2, s); pone(Math.max(a[1], b[1]), () => empalizada(p, Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), rnd)); }
      // carpas, la del jefe más grande
      const cols = [[150, 60, 40], [110, 90, 60], [140, 120, 80], [90, 70, 110]];
      const carpas = [[LU - 2.2, 2.2, true], [LU - 4.6, 1.2], [LU - 2.6, LV - 2.2], [LU - 5, LV - 1.2], [LU - 7.5, 1], [LU - 7.8, LV - 1]];
      for (const [u, v, g] of carpas) { const [px, py] = at(u, v), col = cols[Math.floor(rnd() * cols.length)]; pone(py, () => carpa(p, px, py, col, rnd, g)); }
      // fogata en el claro del campamento y otra chica
      for (const [u, v, big] of [[LU - 4.2, LV / 2, true], [3.2, 1.6, false]]) {
        const [px, py] = at(u, v);
        pone(py, () => { p.sombra(px, py, 22, 6, 0.35); for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; p.r(px + Math.cos(a) * 7 - 1, py - 2 + Math.sin(a) * 2.5, 3, 2, i % 2 ? '#6a6a70' : '#8a8a90'); } p.r(px - 6, py - 3, 12, 2, '#4a2c14'); p.r(px - 2, py - 5, 3, 4, '#3a2010'); });
        esc.anim.push({ tipo: 'fuego', x: px, y: py - 3, k: big ? 1 : 0.7 });
        esc.luces.push({ x: px, y: py - 6, r: big ? 95 : 60, col: [255, 150, 60], flick: 0.12 });
      }
      for (let i = 0; i < 6; i++) { const [px, py] = fondoEnemigo(6); pone(py, () => (rnd() < 0.5 ? barril(p, px, py) : caja(p, px, py, 8 + Math.floor(rnd() * 4)))); }
      for (let i = 0; i < 2; i++) { const [px, py] = fondoEnemigo(5); pone(py, () => lena(p, px, py)); }
      { const [px, py] = at(LU - 6.5, LV / 2 - 2.2); pone(py, () => armas(p, px, py)); }
      for (const v of [LV * 0.38 - 0.4, LV * 0.62 + 0.4]) { const [px, py] = at(LU - 0.8, v); pone(py, () => estandarte(p, px, py)); esc.anim.push({ tipo: 'bandera', x: px + 2, y: py - 29, col: '#8a1a14' }); esc.luces.push({ x: px + 4, y: py - 24, r: 34, col: [255, 170, 80], flick: 0.2 }); esc.anim.push({ tipo: 'antorcha', x: px + 4, y: py - 26 }); }
      // tu lado: carros del ejército y un banderín azul
      { const [px, py] = fondoMio(2); pone(py, () => estandarte(p, px, py)); esc.anim.push({ tipo: 'bandera', x: px + 2, y: py - 29, col: rgb(PK.D.PLAYER_COLOR) }); }
      esc.oscuro = 0.32; esc.tinte = [255, 140, 80, 0.10]; // atardecer
      esc.part.push({ tipo: 'brasas', n: 18 });
    } else if (lugar === 'cave' || lugar === 'lair' || lugar === 'crypt' || lugar === 'nest' || lugar === 'crater') {
      const P = {
        cave: { suelo: [52, 58, 76], tono: 14, muro: [80, 86, 112], gros: 12, oscuro: 0.6 },
        lair: { suelo: [72, 58, 40], tono: 16, muro: [64, 50, 36], gros: 12, oscuro: 0.55 },
        crypt: { suelo: [78, 80, 86], tono: 8, muro: [62, 62, 70], gros: 8, oscuro: 0.58 },
        nest: { suelo: [84, 56, 42], tono: 18, muro: [62, 38, 32], gros: 14, oscuro: 0.42 },
        crater: { suelo: [46, 36, 34], tono: 14, muro: [70, 50, 44], gros: 6, oscuro: 0.45 },
      }[lugar];
      if (lugar === 'crypt') { // baldosas con juntas, grietas y musgo
        suelo(x, W, H, P.suelo, P.tono, seed);
        for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
          const gx = (i - mx) % 24, gy = (j - my) % 24;
          if ((gx >= 0 && gx < 2) || (gy >= 0 && gy < 2)) { x.fillStyle = 'rgba(30,30,36,0.55)'; x.fillRect(i, j, 2, 2); }
          if (U.noise(i / 12, j / 12, seed + 11) > 0.74) { x.fillStyle = 'rgba(70,100,60,0.45)'; x.fillRect(i, j, 2, 2); }
        }
        for (let i = 0; i < 16; i++) { let [px, py] = at(rnd() * LU, rnd() * LV); for (let k = 0; k < 8; k++) { p.r(px, py, 1, 1, 'rgba(20,20,26,0.7)'); px += Math.round((rnd() - 0.5) * 3); py += 1; } }
      } else if (lugar === 'crater' || lugar === 'nest') { // tierra quemada, con grietas de lava que laten
        const [cx0, cy0] = at(LU * (lugar === 'nest' ? 0.85 : 0.62), LV / 2);
        suelo(x, W, H, P.suelo, P.tono, seed, (i, j) => -Math.max(0, 1 - Math.hypot(i - cx0, (j - cy0) * 1.8) / 160) * 12);
        for (let g = 0; g < (lugar === 'nest' ? 9 : 14); g++) {
          let a = rnd() * 6.28, px = cx0 + Math.cos(a) * 20, py = cy0 + Math.sin(a) * 10;
          const pts = [];
          for (let k = 0; k < 26; k++) { a += (rnd() - 0.5) * 0.6; px += Math.cos(a) * 3; py += Math.sin(a) * 1.6; pts.push([px, py]); }
          for (const [qx, qy] of pts) p.r(qx, qy, 2, 1, '#1a0a06');
          esc.anim.push({ tipo: 'grieta', pts });
        }
        esc.luces.push({ x: cx0, y: cy0, r: 120, col: [255, 110, 40], flick: 0.08 });
      } else suelo(x, W, H, P.suelo, P.tono, seed);
      // muros de roca alrededor del campo
      muros(x, W, H, rect, P.muro, seed + 1, P.gros);
      esc.oscuro = P.oscuro;

      if (lugar === 'cave') {
        const COL = [[110, 230, 250], [200, 120, 250], [120, 250, 200]];
        for (let i = 0; i < 18; i++) { const [px, py] = orilla(), col = COL[Math.floor(rnd() * 3)]; pone(py, () => cristales(p, px, py, col, rnd, 3 + Math.floor(rnd() * 3))); esc.luces.push({ x: px, y: py - 8, r: 34 + rnd() * 24, col, flick: 0, pulso: rnd() * 6 }); esc.anim.push({ tipo: 'destello', x: px, y: py - 10, col }); }
        for (let i = 0; i < 6; i++) { const [px, py] = (rnd() < 0.5 ? fondoEnemigo : fondoMio)(3), col = COL[Math.floor(rnd() * 3)]; pone(py, () => cristales(p, px, py, col, rnd, 5)); esc.luces.push({ x: px, y: py - 10, r: 50, col, flick: 0, pulso: rnd() * 6 }); }
        for (let i = 0; i < 14; i++) { const [px, py] = orilla(); pone(py, () => estalagmita(p, px, py, 10 + Math.floor(rnd() * 14), P.muro)); }
        for (let i = 0; i < 6; i++) { const [px, py] = at(3 + rnd() * (LU - 6), 1.5 + rnd() * (LV - 3)); charco(p, px, py, 16 + rnd() * 16); }
        for (let i = 0; i < 20; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); p.r(px, py, 2, 2, rgb(P.muro, 0.6 + rnd() * 0.5)); }
        // estalactitas al frente, colgando del borde de arriba
        for (let i = 0; i < W; i += 8 + Math.floor(rnd() * 10)) { const h = 6 + Math.floor(rnd() * 18); for (let r = 0; r < h; r++) { const hw = Math.max(1, Math.round((1 - r / h) * 4)); pf.r(i - hw, r, hw, 1, rgb(P.muro, 0.55)); pf.r(i, r, hw, 1, rgb(P.muro, 0.8)); } }
        esc.part.push({ tipo: 'gotas', n: 10 }, { tipo: 'motas', n: 16, col: [160, 230, 255] });
      } else if (lugar === 'lair') {
        for (let i = 0; i < 40; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); pone(py, () => hueso(p, px, py, rnd)); }
        for (let i = 0; i < 6; i++) { const [px, py] = orilla(); pone(py, () => craneo(p, px, py)); }
        for (let i = 0; i < 4; i++) { const [px, py] = fondoEnemigo(5); pone(py, () => nido(p, px, py, rnd)); }
        for (let i = 0; i < 10; i++) { const [px, py] = orilla(); pone(py, () => roca(p, px, py, 14 + rnd() * 12, 8 + rnd() * 8, P.muro, rnd)); }
        // raíces que bajan del techo y rayos de luz que entran por los agujeros
        for (let i = 0; i < W; i += 10 + Math.floor(rnd() * 16)) { let px = i; for (let r = 0; r < 10 + rnd() * 22; r++) { pf.r(px, r, 2, 1, '#3a2814'); px += Math.round((rnd() - 0.5) * 2); } }
        for (let i = 0; i < 3; i++) esc.anim.push({ tipo: 'rayo', x: mx + fw * (0.2 + i * 0.3 + rnd() * 0.1), w: 26 + rnd() * 20 });
        for (let i = 0; i < 3; i++) { const [px, py] = at(LU * (0.25 + i * 0.25), LV * (0.3 + rnd() * 0.4)); esc.luces.push({ x: px, y: py, r: 70, col: [255, 230, 170], flick: 0 }); }
        esc.part.push({ tipo: 'motas', n: 22, col: [255, 230, 170] });
      } else if (lugar === 'crypt') {
        for (let k = 0; k < 5; k++) for (const v of [-0.15, LV + 0.15]) { const [px, py] = at(3 + k * ((LU - 6) / 4), v); pone(py, () => columna(p, px, py, 40)); }
        for (let i = 0; i < 10; i++) { const [px, py] = fondoEnemigo(6); pone(py, () => lapida(p, px, py, rnd)); }
        for (let i = 0; i < 5; i++) { const [px, py] = orilla(); pone(py, () => lapida(p, px, py, rnd)); }
        { const [px, py] = at(LU - 2.5, LV / 2); pone(py, () => sarcofago(p, px, py)); }
        for (let i = 0; i < 12; i++) { const [px, py] = orilla(); pone(py, () => { p.r(px - 1, py - 6, 3, 6, '#e8e0c8'); p.r(px - 2, py, 5, 1, '#8a8a90'); }); esc.anim.push({ tipo: 'vela', x: px, y: py - 7 }); esc.luces.push({ x: px, y: py - 8, r: 30, col: [255, 200, 120], flick: 0.25 }); }
        for (let i = 0; i < 4; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); esc.luces.push({ x: px, y: py, r: 40, col: [120, 255, 170], flick: 0, pulso: rnd() * 6, fantasma: true }); }
        esc.part.push({ tipo: 'niebla', n: 9 });
        esc.tinte = [90, 140, 120, 0.08];
      } else if (lugar === 'nest') {
        for (let i = 0; i < 6; i++) { const [px, py] = fondoEnemigo(6); pone(py, () => pilaOro(p, px, py, 24 + rnd() * 26, rnd)); }
        for (let i = 0; i < 10; i++) { const [px, py] = orilla(); pone(py, () => (rnd() < 0.4 ? pilaOro(p, px, py, 12 + rnd() * 10, rnd) : roca(p, px, py, 16 + rnd() * 12, 9 + rnd() * 9, P.muro, rnd))); }
        for (let i = 0; i < 20; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); pone(py, () => hueso(p, px, py, rnd)); }
        for (let i = 0; i < 8; i++) { const [px, py] = fondoEnemigo(6); esc.anim.push({ tipo: 'brillo', x: px + (rnd() - 0.5) * 20, y: py - 6 - rnd() * 8 }); }
        { const [px, py] = at(LU - 3, LV / 2); esc.luces.push({ x: px, y: py, r: 130, col: [255, 120, 50], flick: 0.06 }); }
        esc.part.push({ tipo: 'brasas', n: 30 });
        esc.tinte = [255, 90, 40, 0.08];
      } else if (lugar === 'crater') {
        for (let i = 0; i < 10; i++) { const [px, py] = orilla(); pone(py, () => roca(p, px, py, 14 + rnd() * 14, 8 + rnd() * 8, P.muro, rnd)); }
        for (let i = 0; i < 9; i++) { const [px, py] = at(LU * 0.4 + rnd() * LU * 0.55, 1 + rnd() * (LV - 2)); pone(py, () => cristales(p, px, py, [150, 180, 240], rnd, 2 + Math.floor(rnd() * 2))); esc.luces.push({ x: px, y: py - 6, r: 32, col: [150, 190, 255], flick: 0, pulso: rnd() * 6 }); }
        esc.part.push({ tipo: 'humo', n: 10 }, { tipo: 'brasas', n: 14 });
      }
    } else { // campo abierto (encargos y lo que no tenga escenario propio)
      suelo(x, W, H, [86, 126, 58], 16, seed);
      for (let i = 0; i < 120; i++) { const [px, py] = [rnd() * W, rnd() * H]; p.r(px, py, 1, 1, ['#e8e060', '#f0f0f0', '#d070a0'][Math.floor(rnd() * 3)]); }
      for (let i = 0; i < 50; i++) { const px = rnd() * W, py = rnd() * H; if (px > mx && px < mx + fw && py > my && py < my + fh) continue; pone(py, () => pino(p, px, py, rnd)); }
    }
    objetos.sort((a, b) => a.y - b.y);
    for (const o2 of objetos) o2.fn();
    // viñeta suave en los bordes de la pantalla
    const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // partículas iniciales
    const ps = [];
    for (const def of esc.part) for (let i = 0; i < def.n; i++) ps.push(nueva(def, W, H, rnd, true));
    esc.ps = ps;
    esc.luz = document.createElement('canvas'); esc.luz.width = W; esc.luz.height = H;
    return esc;
  };
  function nueva(def, W, H, rnd, inicio) {
    const r = rnd || Math.random;
    const q = { tipo: def.tipo, col: def.col, x: r() * W, y: inicio ? r() * H : H + 4, t: r() * 10, v: 0.5 + r() };
    if (def.tipo === 'gotas') { q.y = inicio ? r() * H : -4; q.x = r() * W; }
    if (def.tipo === 'niebla') { q.w = 60 + r() * 90; q.y = r() * H; }
    if (def.tipo === 'humo') q.y = inicio ? r() * H : H * (0.3 + r() * 0.6);
    return q;
  }

  // ---------- Lo animado, en cada cuadro ----------
  E.animar = function (ctx, esc, dt) {
    esc.t += dt;
    const t = esc.t, r = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    for (const a of esc.anim) {
      if (a.tipo === 'fuego') {
        const k = a.k;
        for (let i = 0; i < 6; i++) {
          const fx = a.x + (i - 2.5) * 2.2 * k, h = (7 + Math.sin(t * 9 + i * 1.7) * 3 + Math.sin(t * 23 + i) * 1.5) * k;
          r(fx - 1, a.y - h, 3 * k, h, i % 2 ? '#e8501c' : '#f07a24');
          r(fx, a.y - h * 0.7, 2 * k, h * 0.7, '#ffc040');
          r(fx, a.y - h * 0.35, 1, h * 0.35, '#fff2b0');
        }
      } else if (a.tipo === 'antorcha' || a.tipo === 'vela') {
        const h = a.tipo === 'vela' ? 2 + Math.sin(t * 13 + a.x) : 4 + Math.sin(t * 11 + a.x) * 1.5;
        r(a.x - 1, a.y - h, 3, h, '#f07a24'); r(a.x, a.y - h * 0.6, 1, h * 0.6, '#ffe080');
      } else if (a.tipo === 'bandera') {
        for (let i = 0; i < 12; i++) { const wv = Math.round(Math.sin(t * 5 - i * 0.6) * 1.5); r(a.x + i, a.y + wv, 1, 8 - Math.floor(i / 4), a.col); }
        r(a.x + 4, a.y + 2 + Math.round(Math.sin(t * 5 - 2.4) * 1.5), 3, 3, 'rgba(0,0,0,0.5)');
      } else if (a.tipo === 'destello') {
        const k = Math.max(0, Math.sin(t * 2 + a.x * 0.37));
        if (k > 0.92) { r(a.x - 2, a.y, 5, 1, 'rgba(255,255,255,0.9)'); r(a.x, a.y - 2, 1, 5, 'rgba(255,255,255,0.9)'); }
      } else if (a.tipo === 'brillo') {
        if (Math.sin(t * 3 + a.x) > 0.95) { r(a.x - 1, a.y, 3, 1, '#fffbe0'); r(a.x, a.y - 1, 1, 3, '#fffbe0'); }
      } else if (a.tipo === 'grieta') {
        const k = 0.55 + 0.45 * Math.sin(t * 1.6 + a.pts[0][0] * 0.05);
        for (const [qx, qy] of a.pts) r(qx, qy, 2, 1, 'rgba(255,' + Math.round(120 + 80 * k) + ',40,' + (0.6 + 0.4 * k) + ')');
      } else if (a.tipo === 'rayo') {
        const g = ctx.createLinearGradient(a.x, 0, a.x + 60, esc.H);
        g.addColorStop(0, 'rgba(255,240,190,0.22)'); g.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(a.x, 0); ctx.lineTo(a.x + a.w, 0); ctx.lineTo(a.x + a.w + 70, esc.H); ctx.lineTo(a.x + 70, esc.H); ctx.closePath(); ctx.fill();
      }
    }
  };
  // Partículas que van por encima de todo (brasas, gotas, motas de polvo, niebla, humo).
  E.particulas = function (ctx, esc, dt) {
    const W = esc.W, H = esc.H;
    for (let i = 0; i < esc.ps.length; i++) {
      const q = esc.ps[i];
      q.t += dt;
      if (q.tipo === 'brasas') { q.y -= 14 * q.v * dt; q.x += Math.sin(q.t * 2 + i) * 6 * dt; if (q.y < -4) esc.ps[i] = nueva(q, W, H); const a = 0.5 + 0.5 * Math.sin(q.t * 6); ctx.fillStyle = 'rgba(255,' + Math.round(140 + 80 * a) + ',60,' + (0.5 + 0.5 * a) + ')'; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      else if (q.tipo === 'gotas') { q.y += 70 * q.v * dt; if (q.y > H) { esc.ps[i] = nueva(q, W, H); continue; } ctx.fillStyle = 'rgba(170,210,240,0.7)'; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 3); }
      else if (q.tipo === 'motas') { q.y -= 3 * q.v * dt; q.x += Math.sin(q.t + i) * 4 * dt; if (q.y < 0) esc.ps[i] = nueva(q, W, H); const a = 0.25 + 0.25 * Math.sin(q.t * 2 + i); ctx.fillStyle = 'rgba(' + q.col.join(',') + ',' + a + ')'; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      else if (q.tipo === 'niebla') { q.x += 6 * q.v * dt; if (q.x - q.w > W) q.x = -q.w; ctx.fillStyle = 'rgba(190,210,200,0.06)'; for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(q.x - q.w / 2 + k * 6), Math.round(q.y - 6 + k * 3), Math.round(q.w - k * 12), 6); }
      else if (q.tipo === 'humo') { q.y -= 8 * q.v * dt; q.x += 3 * dt; if (q.y < -20) esc.ps[i] = nueva(q, W, H); const s = 4 + (q.t % 6) * 2; ctx.fillStyle = 'rgba(60,50,48,0.12)'; ctx.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s); }
    }
  };
  // Oscuridad con agujeros de luz (las fogatas, los cristales, las velas) y su color.
  // esc.extra: luces de un momento que pone la batalla (fuego, explosiones, magia), en coordenadas del escenario
  E.luz = function (ctx, esc) {
    const extra = esc.extra || [];
    if (!esc.oscuro && !esc.tinte && !extra.length) return;
    const t = esc.t, L = esc.luz, x = L.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, esc.W, esc.H);
    if (esc.oscuro) {
      x.fillStyle = 'rgba(6,6,16,' + esc.oscuro + ')'; x.fillRect(0, 0, esc.W, esc.H);
      x.globalCompositeOperation = 'destination-out';
      for (const l of extra.length ? esc.luces.concat(extra) : esc.luces) {
        const k = 1 + (l.flick ? (Math.sin(t * 17 + l.x) * 0.5 + Math.sin(t * 7.3 + l.y) * 0.5) * l.flick : 0) + (l.pulso !== undefined ? Math.sin(t * 1.5 + l.pulso) * 0.12 : 0);
        const rr = l.r * k, g = x.createRadialGradient(l.x, l.y, 0, l.x, l.y, rr);
        g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(l.x - rr, l.y - rr, rr * 2, rr * 2);
      }
      x.globalCompositeOperation = 'source-over';
    }
    if (esc.oscuro) ctx.drawImage(L, 0, 0);
    // el color de cada luz, sumado
    ctx.globalCompositeOperation = 'lighter';
    for (const l of extra) {
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, 'rgba(' + l.col.join(',') + ',0.32)'); g.addColorStop(1, 'rgba(' + l.col.join(',') + ',0)');
      ctx.fillStyle = g; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    for (const l of esc.luces) {
      const k = 1 + (l.flick ? Math.sin(t * 17 + l.x) * l.flick : 0) + (l.pulso !== undefined ? Math.sin(t * 1.5 + l.pulso) * 0.2 : 0), rr = l.r * 0.8 * k;
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, rr), a = l.fantasma ? 0.1 : 0.16;
      g.addColorStop(0, 'rgba(' + l.col.join(',') + ',' + a + ')'); g.addColorStop(1, 'rgba(' + l.col.join(',') + ',0)');
      ctx.fillStyle = g; ctx.fillRect(l.x - rr, l.y - rr, rr * 2, rr * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (esc.tinte) { ctx.fillStyle = 'rgba(' + esc.tinte.slice(0, 3).join(',') + ',' + esc.tinte[3] + ')'; ctx.fillRect(0, 0, esc.W, esc.H); }
  };
})();
