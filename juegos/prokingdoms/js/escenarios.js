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
  function cristales(p, cx, cy, col, rnd, n, k) {
    n = n || 4; k = k || 1;
    p.sombra(cx, cy, 14 * k, 4 * Math.sqrt(k), 0.4);
    for (let i = 0; i < n; i++) {
      const h = Math.round((7 + Math.floor(rnd() * 12)) * k), w = Math.round((3 + Math.floor(rnd() * 2)) * Math.sqrt(k)), dx = Math.round(((i - (n - 1) / 2) * 3.5 + (rnd() - 0.5) * 2) * Math.sqrt(k)), lean = (rnd() - 0.5) * 0.5;
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

  // ---------- Profundidad: que no se vea plano ----------
  // Relieve: un mapa de alturas con ruido, iluminado desde arriba a la izquierda (lomas claras, hondonadas
  // oscuras). Se calcula una vez en una grilla de 2 px y se pinta encima del suelo.
  function relieve(x, W, H, seed, fuerza) {
    const gw = Math.ceil(W / 2) + 3, gh = Math.ceil(H / 2) + 3, hs = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) hs[j * gw + i] = U.noise(i / 24, j / 24, seed + 21) * 0.75 + U.noise(i / 9, j / 9, seed + 23) * 0.25;
    for (let j = 1; j < gh - 2; j++) for (let i = 1; i < gw - 2; i++) {
      const d = (hs[(j + 1) * gw + i + 1] - hs[(j - 1) * gw + i - 1]) * fuerza;
      if (Math.abs(d) < 0.015) continue;
      // en escalones de 0,03: el relieve queda en bandas suaves, como curvas de nivel en pixel art
      const q = Math.round(d / 0.03) * 0.03;
      if (!q) continue;
      x.fillStyle = q > 0 ? 'rgba(255,245,220,' + Math.min(0.12, q).toFixed(3) + ')' : 'rgba(0,0,0,' + Math.min(0.2, -q * 1.3).toFixed(3) + ')';
      x.fillRect((i - 1) * 2, (j - 1) * 2, 2, 2);
    }
  }
  // Meseta: una losa de roca levantada, con cima iluminada, cara de adelante con vetas y sombra al pie.
  function meseta(p, cx, cy, w, alto, col, rnd) {
    const hh = Math.max(6, Math.round(w * 0.36)), top = cy - alto, half = w / 2, sd = rnd() * 100;
    // borde irregular (rocoso): el radio cambia con ruido alrededor de la losa
    const borde = i => 0.72 + 0.28 * U.noise(i / 5 + sd, sd, 7);
    const bajo = i => { const k = Math.sqrt(Math.max(0, 1 - Math.pow(i / half, 2))); return Math.round(top + (hh / 2) * k * borde(i)); };
    p.sombra(cx + 5, cy + 2, w + 16, 9, 0.45);
    for (let i = -Math.floor(half); i < half; i++) { // la cara de adelante, con vetas y luz de la izquierda
      const yb = bajo(i), lado = -i / half, h = alto * (0.75 + 0.35 * U.noise(i / 4 + sd, 3, 9));
      for (let y = 0; y < h; y++) { const veta = U.noise((cx + i) / 2.5, (yb + y) / 9, 5) > 0.7 ? -0.12 : 0; p.r(cx + i, yb + y, 1, 1, rgb(col, 0.5 + lado * 0.12 - (y / h) * 0.18 + veta)); }
    }
    for (let i = -Math.floor(half); i < half; i++) { // la cima: textura de roca, más clara atrás
      const k = Math.sqrt(Math.max(0, 1 - Math.pow(i / half, 2))), yb = bajo(i), ya = Math.round(top - (hh / 2) * k * borde(i + 37));
      for (let y = ya; y < yb; y++) { const t = (y - ya) / Math.max(1, yb - ya), nn = U.noise((cx + i) / 4, y / 4, 11); p.r(cx + i, y, 1, 1, rgb(col, 0.95 + 0.2 * (1 - t) + (nn - 0.5) * 0.25)); }
      p.r(cx + i, yb - 1, 1, 1, rgb(col, 1.3)); // filo iluminado
    }
  }
  // Bruma de lejanía arriba (lo lejano se pierde en el color del lugar) y abajo, lo cercano, más oscuro.
  function profundidad(x, W, H, col, k) {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(' + col.join(',') + ',' + (0.34 * k).toFixed(3) + ')');
    g.addColorStop(0.3, 'rgba(' + col.join(',') + ',' + (0.1 * k).toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + (0.28 * k).toFixed(3) + ')');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  // Siluetas grandes y oscuras pegadas al borde de abajo y a los costados (fuera del campo): primer plano.
  function primerPlano(xf, W, H, rect, rnd, tipo, borde, n) {
    const [mx, my, fw, fh] = rect, abajo = H - (my + fh) + 8, lados = mx + 8;
    const sil = (cx, base, w, h, punta, dir) => {
      for (let r = 0; r < h; r++) {
        const t = r / h, hw = Math.round((w / 2) * (punta ? t : Math.sqrt(t)) * (0.85 + 0.15 * Math.sin(r * 0.7 + cx)));
        const y = dir > 0 ? base - h + r : base + h - r;
        xf.fillStyle = 'rgba(8,6,12,0.88)'; xf.fillRect(Math.round(cx - hw), Math.round(y), hw * 2, 1);
        if (r === 0 || r % 9 === 0) { xf.fillStyle = 'rgba(' + borde.join(',') + ',0.35)'; xf.fillRect(Math.round(cx - hw), Math.round(y), Math.max(1, Math.round(hw * 0.6)), 1); }
      }
    };
    for (let i = 0; i < n; i++) {
      const cx = rnd() * W, w = 24 + rnd() * 46, h = Math.min(abajo + 6, 14 + rnd() * 34);
      if (h > 4) sil(cx, H + 2, w, h, tipo === 'puntas' || (tipo === 'mixto' && rnd() < 0.5), 1);
    }
    for (let i = 0; i < Math.ceil(n / 3); i++) for (const s of [0, 1]) {
      if (lados < 12) continue;
      const cy = my + rnd() * fh, w = Math.min(lados * 2, 20 + rnd() * 30), h = 20 + rnd() * 30;
      sil(s ? W - rnd() * 6 : rnd() * 6, cy + h / 2, w, h, false, 1);
    }
    if (tipo === 'puntas' || tipo === 'mixto') for (let i = 0; i < n; i++) { // y colgando del techo, arriba
      const cx = rnd() * W, w = 10 + rnd() * 18, h = Math.min(my + 4, 10 + rnd() * 26);
      if (h > 6) sil(cx, -2, w, h, true, -1);
    }
  }

  // ---------- Lo que aparece al bajar de piso ----------
  function costillar(p, cx, cy, s) { // las costillas de una bestia enorme
    p.sombra(cx, cy, 50 * s, 8, 0.35);
    p.r(cx - 24 * s, cy - 3, 48 * s, 3, '#d8ccb0');
    for (let i = 0; i < 6; i++) { const x0 = cx - 20 * s + i * 8 * s, h = (18 - Math.abs(i - 2.5) * 3) * s; for (let r = 0; r < h; r++) p.r(x0 + Math.round(Math.sin((r / h) * 2.4) * 4 * s), cy - 3 - r, 2, 1, r % 5 ? '#e6dcc0' : '#c8bca0'); }
  }
  function calavera(p, cx, cy, s) { // un cráneo gigante de bestia
    p.sombra(cx + 3, cy, 44 * s, 9, 0.45);
    for (let r = 0; r < 22 * s; r++) { const t = r / (22 * s), hw = Math.round(18 * s * Math.sqrt(Math.sin(t * 3.1) + 0.05)); p.r(cx - hw, cy - 22 * s + r, hw * 2, 1, rgb([230, 220, 196], 0.85 + 0.2 * (1 - t))); }
    for (const sx of [-1, 1]) { p.r(cx + sx * 8 * s - 3 * s, cy - 15 * s, 6 * s, 5 * s, '#1a100a'); for (let k = 0; k < 14 * s; k++) p.r(cx + sx * (14 * s + k), cy - 18 * s - k * 0.6, 3, 2, '#e8dcc0'); }
    for (let i = -3; i <= 3; i++) p.r(cx + i * 3 * s, cy - 4 * s, 2, 4 * s, '#f0e8d4');
  }
  function estatua(p, cx, cy) { // un guerrero de piedra con espada
    p.sombra(cx + 3, cy, 22, 6, 0.4);
    p.r(cx - 8, cy - 6, 16, 6, '#5a5a62'); p.r(cx - 8, cy - 6, 16, 1, '#7a7a82');
    p.r(cx - 4, cy - 30, 8, 24, '#7c7c84'); p.r(cx - 4, cy - 30, 2, 24, '#9a9aa2');
    p.r(cx - 3, cy - 36, 6, 6, '#86868e'); p.r(cx - 6, cy - 28, 12, 4, '#74747c');
    p.r(cx + 5, cy - 40, 2, 30, '#9aa0a8'); p.r(cx + 3, cy - 18, 6, 2, '#6a6a72');
    p.r(cx - 2, cy - 34, 1, 1, '#1a1a20'); p.r(cx + 1, cy - 34, 1, 1, '#1a1a20');
  }
  function brasero(p, cx, cy) { p.sombra(cx + 2, cy, 14, 4, 0.4); p.r(cx - 1, cy - 12, 3, 12, '#4a4a52'); p.r(cx - 6, cy - 15, 13, 4, '#5a5a62'); p.r(cx - 6, cy - 15, 13, 1, '#7a7a82'); p.r(cx - 4, cy - 1, 9, 1, '#3a3a40'); }
  function torre(p, cx, cy) { // torre de vigía de madera
    p.sombra(cx + 4, cy, 22, 6, 0.4);
    for (const sx of [-6, 5]) p.r(cx + sx, cy - 34, 2, 34, '#5a3a1c');
    for (let y = cy - 30; y < cy; y += 8) { for (let k = 0; k < 11; k++) p.r(cx - 6 + k, y + Math.round(k * 0.6), 1, 1, '#6a4424'); }
    p.r(cx - 9, cy - 40, 19, 7, '#7a5030'); p.r(cx - 9, cy - 40, 19, 1, '#9a6a3a'); p.r(cx - 8, cy - 46, 2, 6, '#5a3a1c'); p.r(cx + 7, cy - 46, 2, 6, '#5a3a1c');
    p.r(cx - 10, cy - 49, 21, 3, '#6a2a1a'); p.r(cx - 8, cy - 51, 17, 2, '#7a3422');
  }
  function muroPiedra(p, x0, y0, x1, y1) { // muralla baja de piedra con almenas
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      p.r(x, y - 14, 6, 14, i % 2 ? '#7a7670' : '#86827a'); p.r(x, y - 14, 6, 1, '#a8a49c'); p.r(x, y - 7, 6, 1, '#5a5650');
      if (i % 2 === 0) { p.r(x + 1, y - 18, 4, 4, '#8a867e'); p.r(x + 1, y - 18, 4, 1, '#aaa69e'); }
    }
  }
  function meteoro(p, cx, cy) { // el trozo de estrella caída, con hierro que brilla
    p.sombra(cx + 4, cy + 2, 56, 12, 0.5);
    for (let r = 0; r < 26; r++) { const t = r / 26, hw = Math.round(26 * Math.sqrt(Math.sin(t * 3.0) + 0.05)); for (let i = -hw; i < hw; i += 2) p.r(cx + i, cy - 26 + r, 2, 1, rgb([60, 56, 70], 0.7 + 0.5 * (1 - t) + ((i * 13 + r * 7) % 9 === 0 ? 0.6 : 0))); }
    for (let i = 0; i < 9; i++) p.r(cx - 16 + i * 4, cy - 18 + ((i * 5) % 7), 2, 2, '#9ac8ff');
  }
  function pilarRoto(p, cx, cy, h, col) {
    p.sombra(cx + 3, cy, 22, 6, 0.4);
    p.r(cx - 7, cy - h, 14, h, rgb(col, 0.9)); p.r(cx - 7, cy - h, 3, h, rgb(col, 1.15)); p.r(cx + 4, cy - h, 3, h, rgb(col, 0.65));
    for (let k = 0; k < 6; k++) p.r(cx - 7 + k * 2, cy - h - (k % 3) * 2, 2, (k % 3) * 2 + 1, rgb(col, 0.9));
    for (let y = cy - h + 5; y < cy - 2; y += 7) p.r(cx - 7, y, 14, 1, rgb(col, 0.6));
  }
  function poza(p, cx, cy, w, col) { // charco de lava o de agua, en perspectiva
    const h = Math.max(4, Math.round(w * 0.3));
    for (let j = 0; j < h; j++) { const k = Math.sqrt(Math.max(0, 1 - Math.pow((j - h / 2 + 0.5) / (h / 2), 2))); p.r(cx - (w / 2) * k - 2, cy - h / 2 + j, w * k + 4, 1, 'rgba(20,10,8,0.8)'); p.r(cx - (w / 2) * k, cy - h / 2 + j, w * k, 1, rgb(col, 0.75 + 0.3 * (1 - j / h))); }
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
    // n: qué tan adentro (0 el primer piso, 1 el último; en campamentos, lo lejos que está). Cada piso suma
    // luz, decorado y cosas nuevas, para que bajar se sienta: ver «Lo que aparece al bajar de piso».
    const n = U.clamp(o.nivel || 0, 0, 1);
    const esc = { c, frente, luces: [], anim: [], part: [], oscuro: 0, tinte: null, W, H, lugar, t: 0, nivel: n };
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
      relieve(x, W, H, seed, 2.4);
      for (let i = 0; i < 40; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); p.r(px, py, 2, 2, 'rgba(90,70,44,0.6)'); p.r(px + 3, py + 1, 1, 1, 'rgba(160,140,110,0.7)'); } // piedritas
      for (let i = 0; i < 26; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); p.r(px, py, 2, 1, 'rgba(60,40,20,0.35)'); } // huellas
      // bosque afuera del campo
      for (let i = 0; i < 70; i++) {
        const px = rnd() * W, py = rnd() * H;
        if (px > mx - 8 && px < mx + fw + 8 && py > my - 4 && py < my + fh + 12) continue;
        pone(py, () => pino(p, px, py, rnd, 0.9 + rnd() * 0.4));
      }
      // empalizada en el fondo del campamento (lado enemigo) y a los costados, con un portón
      // los campamentos lejanos son fortines: muralla de piedra en vez de troncos
      const valla = n >= 0.6 ? (a, b) => muroPiedra(p, a[0], a[1], b[0], b[1]) : (a, b) => empalizada(p, a[0], a[1], b[0], b[1], rnd);
      const e0 = at(LU - 0.2, -0.2), e1 = at(LU - 0.2, LV * 0.38), e2 = at(LU - 0.2, LV * 0.62), e3 = at(LU - 0.2, LV + 0.2);
      pone(Math.max(e0[1], e1[1]), () => valla(e0, e1));
      pone(Math.max(e2[1], e3[1]), () => valla(e2, e3));
      for (const s of [0.6, LV - 0.6]) { const a = at(LU - 7, s), b = at(LU - 0.2, s); const y = Math.max(a[1], b[1]); pone(y, () => valla([Math.min(a[0], b[0]), y], [Math.max(a[0], b[0]), y])); }
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
      // más lejos, más grande: torres de vigía, braseros en el portón, más carpas y estandartes
      if (n >= 0.3) for (const v of [0.4, LV - 0.4]) { const [px, py] = at(LU - 0.6, v); pone(py, () => torre(p, px, py)); esc.luces.push({ x: px, y: py - 44, r: 40, col: [255, 170, 80], flick: 0.2 }); esc.anim.push({ tipo: 'antorcha', x: px, y: py - 45 }); }
      for (let i = 0; i < Math.round(n * 5); i++) { const [px, py] = at(LU - 3 - rnd() * 6, rnd() < 0.5 ? 0.6 + rnd() : LV - 0.6 - rnd()), col = cols[Math.floor(rnd() * cols.length)]; pone(py, () => carpa(p, px, py, col, rnd, false)); }
      if (n >= 0.55) for (const v of [LV * 0.38 - 1.2, LV * 0.62 + 1.2]) { const [px, py] = at(LU - 1.6, v); pone(py, () => brasero(p, px, py)); esc.anim.push({ tipo: 'fuego', x: px, y: py - 15, k: 0.6 }); esc.luces.push({ x: px, y: py - 18, r: 56, col: [255, 150, 60], flick: 0.15 }); }
      if (n >= 0.8) for (let i = 0; i < 4; i++) { const [px, py] = at(LU - 2 - i * 2.2, i % 2 ? 0.5 : LV - 0.5); pone(py, () => estandarte(p, px, py)); esc.anim.push({ tipo: 'bandera', x: px + 2, y: py - 29, col: i % 2 ? '#8a1a14' : '#c8a030' }); }
      for (let i = 0; i < 2 + Math.round(n * 4); i++) { const [px, py] = orilla(); pone(py, () => meseta(p, px, py, 22 + rnd() * 18, 5 + rnd() * 5, [120, 100, 70], rnd)); }
      primerPlano(xf, W, H, rect, rnd, 'rocas', [120, 170, 80], 7 + Math.round(n * 5));
      esc.oscuro = 0.32 + n * 0.08; esc.tinte = [255, 140 - n * 40, 80, 0.1 + n * 0.04]; // atardecer, más rojo lejos
      esc.part.push({ tipo: 'brasas', n: 18 + Math.round(n * 20) });
      esc.bruma = [255, 170, 110];
    } else if (lugar === 'cave' || lugar === 'lair' || lugar === 'crypt' || lugar === 'nest' || lugar === 'crater' || lugar === 'swamp' || lugar === 'giants' || lugar === 'temple') {
      const P = {
        cave: { suelo: [52, 58, 76], tono: 14, muro: [80, 86, 112], gros: 12, oscuro: 0.6 },
        lair: { suelo: [72, 58, 40], tono: 16, muro: [64, 50, 36], gros: 12, oscuro: 0.55 },
        crypt: { suelo: [78, 80, 86], tono: 8, muro: [62, 62, 70], gros: 8, oscuro: 0.58 },
        nest: { suelo: [84, 56, 42], tono: 18, muro: [62, 38, 32], gros: 14, oscuro: 0.42 },
        crater: { suelo: [46, 36, 34], tono: 14, muro: [70, 50, 44], gros: 6, oscuro: 0.45 },
        swamp: { suelo: [52, 66, 44], tono: 14, muro: [46, 58, 40], gros: 8, oscuro: 0.48 },
        giants: { suelo: [96, 90, 80], tono: 12, muro: [118, 110, 98], gros: 14, oscuro: 0.3 },
        temple: { suelo: [56, 74, 82], tono: 10, muro: [60, 78, 88], gros: 10, oscuro: 0.52 },
      }[lugar];
      // al bajar, los colores se van hacia el tono propio del lugar y se oscurece (las luces resaltan más)
      const HONDO = { cave: [60, 52, 150], lair: [92, 34, 26], crypt: [44, 84, 72], nest: [100, 30, 20], crater: [64, 40, 96], swamp: [40, 90, 40], giants: [90, 80, 70], temple: [30, 80, 110] }[lugar];
      P.muro = mix(P.muro, HONDO, n * 0.45); P.suelo = mix(P.suelo, HONDO.map(q => q * 0.7), n * 0.3); P.oscuro += n * 0.12;
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
        for (let g = 0; g < (lugar === 'nest' ? 9 : 14) + Math.round(n * 10); g++) {
          let a = rnd() * 6.28, px = cx0 + Math.cos(a) * 20, py = cy0 + Math.sin(a) * 10;
          const pts = [];
          for (let k = 0; k < 26; k++) { a += (rnd() - 0.5) * 0.6; px += Math.cos(a) * 3; py += Math.sin(a) * 1.6; pts.push([px, py]); }
          for (const [qx, qy] of pts) p.r(qx, qy, 2, 1, '#1a0a06');
          esc.anim.push({ tipo: 'grieta', pts });
        }
        esc.luces.push({ x: cx0, y: cy0, r: 120, col: [255, 110, 40], flick: 0.08 });
      } else suelo(x, W, H, P.suelo, P.tono, seed);
      relieve(x, W, H, seed, lugar === 'crypt' ? 1.1 : 2.8 + n);
      // muros de roca alrededor del campo
      muros(x, W, H, rect, P.muro, seed + 1, P.gros);
      esc.oscuro = P.oscuro;
      // salientes de roca que bajan de los muros a la orilla del campo (no en la crypta: es de baldosas)
      if (lugar !== 'crypt') for (let i = 0; i < 3 + Math.round(n * 6); i++) { const [px, py] = at(1 + rnd() * (LU - 2), rnd() < 0.5 ? -0.1 : LV + 0.1); pone(py, () => meseta(p, px, py, 24 + rnd() * 24 + n * 12, 7 + rnd() * 7 + n * 5, P.muro, rnd)); }
      primerPlano(xf, W, H, rect, rnd, lugar === 'cave' ? 'puntas' : lugar === 'lair' ? 'mixto' : 'rocas',
        { cave: [130, 220, 255], lair: [255, 200, 140], crypt: [140, 255, 190], nest: [255, 120, 50], crater: [160, 170, 255], swamp: [150, 255, 120], giants: [230, 210, 170], temple: [110, 240, 230] }[lugar], 6 + Math.round(n * 7));
      esc.bruma = { cave: [90, 120, 200], lair: [140, 100, 60], crypt: [90, 140, 120], nest: [200, 80, 40], crater: [110, 80, 160], swamp: [90, 140, 80], giants: [170, 160, 140], temple: [60, 120, 150] }[lugar];

      if (lugar === 'cave') {
        const COL = [[110, 230, 250], [200, 120, 250], [120, 250, 200]];
        for (let i = 0; i < 18 + Math.round(n * 14); i++) { const [px, py] = orilla(), col = COL[Math.floor(rnd() * 3)], k = 1 + n * 0.7 * rnd(); pone(py, () => cristales(p, px, py, col, rnd, 3 + Math.floor(rnd() * 3), k)); if (i % (n >= 0.5 ? 2 : 1) === 0) esc.luces.push({ x: px, y: py - 8, r: (34 + rnd() * 24) * (n >= 0.5 ? 1.3 : 1), col, flick: 0, pulso: rnd() * 6 }); esc.anim.push({ tipo: 'destello', x: px, y: py - 10, col }); } // en los pisos hondos, una luz cada dos (más grande): con todas bajaba de 60 cuadros
        for (let i = 0; i < 6; i++) { const [px, py] = (rnd() < 0.5 ? fondoEnemigo : fondoMio)(3), col = COL[Math.floor(rnd() * 3)]; pone(py, () => cristales(p, px, py, col, rnd, 5)); esc.luces.push({ x: px, y: py - 10, r: 50, col, flick: 0, pulso: rnd() * 6 }); }
        for (let i = 0; i < 14; i++) { const [px, py] = orilla(); pone(py, () => estalagmita(p, px, py, 10 + Math.floor(rnd() * 14), P.muro)); }
        for (let i = 0; i < 6; i++) { const [px, py] = at(3 + rnd() * (LU - 6), 1.5 + rnd() * (LV - 3)); charco(p, px, py, 16 + rnd() * 16); }
        for (let i = 0; i < 20; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); p.r(px, py, 2, 2, rgb(P.muro, 0.6 + rnd() * 0.5)); }
        // estalactitas al frente, colgando del borde de arriba
        for (let i = 0; i < W; i += 8 + Math.floor(rnd() * 10)) { const h = 6 + Math.floor(rnd() * 18); for (let r = 0; r < h; r++) { const hw = Math.max(1, Math.round((1 - r / h) * 4)); pf.r(i - hw, r, hw, 1, rgb(P.muro, 0.55)); pf.r(i, r, hw, 1, rgb(P.muro, 0.8)); } }
        esc.part.push({ tipo: 'gotas', n: 10 }, { tipo: 'motas', n: 16 + Math.round(n * 24), col: [160, 230, 255] });
        // pisos hondos: vetas de cristal que laten en el suelo, una geoda gigante al fondo, esquirlas que flotan y rayos
        if (n >= 0.3) for (let g = 0; g < 4 + Math.round(n * 6); g++) {
          let [px, py] = at(rnd() * LU, rnd() * LV), a = rnd() * 6.28; const pts = [], col = COL[Math.floor(rnd() * 3)];
          for (let k = 0; k < 18; k++) { a += (rnd() - 0.5) * 0.7; px += Math.cos(a) * 3; py += Math.sin(a) * 1.6; pts.push([px, py]); p.r(px, py, 2, 1, rgb(col, 0.35)); }
          esc.anim.push({ tipo: 'vena', pts, col });
        }
        if (n >= 0.5) { const [px, py] = at(LU - 0.9, LV / 2); pone(py, () => { cristales(p, px - 14, py + 2, COL[1], rnd, 5, 1.8); cristales(p, px + 14, py + 3, COL[2], rnd, 5, 1.7); cristales(p, px, py + 6, COL[0], rnd, 7, 2.4); }); esc.luces.push({ x: px, y: py - 20, r: 110 + n * 40, col: [150, 220, 255], flick: 0, pulso: 1 }); for (let i = 0; i < 4; i++) esc.anim.push({ tipo: 'destello', x: px + (rnd() - 0.5) * 40, y: py - 10 - rnd() * 30, col: COL[0] }); }
        if (n >= 0.7) { esc.part.push({ tipo: 'esquirlas', n: 8 + Math.round(n * 10), col: [170, 230, 255] }); for (let i = 0; i < 2; i++) esc.anim.push({ tipo: 'rayo', x: mx + fw * (0.25 + i * 0.4), w: 22, col: [150, 220, 255] }); }
        if (n >= 0.95) esc.tinte = [120, 90, 255, 0.07];
      } else if (lugar === 'lair') {
        for (let i = 0; i < 40 + Math.round(n * 40); i++) { const [px, py] = at(rnd() * LU, rnd() * LV); pone(py, () => hueso(p, px, py, rnd)); }
        for (let i = 0; i < 6 + Math.round(n * 8); i++) { const [px, py] = orilla(); pone(py, () => craneo(p, px, py)); }
        // pisos hondos: costillares de bestias enormes, un cráneo gigante al fondo con ojos que brillan, y ojos en la oscuridad
        if (n >= 0.3) for (let i = 0; i < 1 + Math.round(n * 2); i++) { const [px, py] = orilla(); pone(py, () => costillar(p, px, py, 0.8 + n * 0.5)); }
        if (n >= 0.5) { const [px, py] = at(LU - 0.8, LV / 2), s = 1 + n * 0.5; pone(py, () => calavera(p, px, py, s)); esc.anim.push({ tipo: 'ojos', x: px, y: py - 13 * s, sep: 8 * s, col: [255, 60, 40], grande: true }); esc.luces.push({ x: px, y: py - 12 * s, r: 50, col: [255, 60, 40], flick: 0.05 }); }
        if (n >= 0.65) for (let i = 0; i < 4 + Math.round(n * 6); i++) { const yy = rnd() < 0.5 ? rnd() * (my - 6) : my + fh + 6 + rnd() * Math.max(2, H - my - fh - 12); esc.anim.push({ tipo: 'ojos', x: rnd() * W, y: yy, sep: 4, col: rnd() < 0.5 ? [255, 200, 60] : [255, 70, 50] }); }
        esc.tinte = [150, 40, 30, 0.04 + n * 0.08];
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
        esc.part.push({ tipo: 'niebla', n: 9 + Math.round(n * 8) });
        esc.tinte = [90, 140, 120, 0.08 + n * 0.05];
        // pisos hondos: braseros de fuego verde, un círculo de runas en el piso, estatuas de guerreros y un portal
        if (n >= 0.3) for (let i = 0; i < 4; i++) { const [px, py] = at(LU * (0.2 + i * 0.2), i % 2 ? 0.2 : LV - 0.2); pone(py, () => brasero(p, px, py)); esc.anim.push({ tipo: 'fuego', x: px, y: py - 15, k: 0.6, verde: true }); esc.luces.push({ x: px, y: py - 18, r: 60, col: [110, 255, 150], flick: 0.15 }); }
        if (n >= 0.5) { const [px, py] = at(LU / 2, LV / 2); esc.anim.push({ tipo: 'runas', x: px, y: py, r: 46 + n * 20, col: n >= 0.85 ? [200, 120, 255] : [120, 255, 170] }); esc.luces.push({ x: px, y: py, r: 80, col: n >= 0.85 ? [180, 110, 255] : [110, 255, 160], flick: 0, pulso: 2, fantasma: true }); }
        if (n >= 0.7) for (let k = 0; k < 4; k++) { const [px, py] = at(4 + k * ((LU - 8) / 3), k % 2 ? 0.1 : LV - 0.1); pone(py, () => estatua(p, px, py)); }
        if (n >= 0.85) { const [px, py] = at(LU - 0.9, LV / 2); esc.anim.push({ tipo: 'portal', x: px, y: py - 18 }); esc.luces.push({ x: px, y: py - 18, r: 90, col: [190, 110, 255], flick: 0, pulso: 0 }); esc.part.push({ tipo: 'orbes', n: 10 }); }
      } else if (lugar === 'nest') {
        for (let i = 0; i < 6 + Math.round(n * 6); i++) { const [px, py] = fondoEnemigo(6); pone(py, () => pilaOro(p, px, py, (24 + rnd() * 26) * (1 + n * 0.25), rnd)); }
        // pisos hondos: pozas de lava, pilares de un templo antiguo y los huesos de un dragón que perdió
        if (n >= 0.3) for (let i = 0; i < 2 + Math.round(n * 2); i++) { const [px, py] = orilla(), w = 26 + rnd() * 20; pone(py - 10, () => poza(p, px, py, w, [255, 110, 40])); esc.anim.push({ tipo: 'lava', x: px, y: py, w }); esc.luces.push({ x: px, y: py, r: 50 + w, col: [255, 110, 40], flick: 0.06 }); }
        if (n >= 0.55) for (let i = 0; i < 4; i++) { const [px, py] = at(3 + i * ((LU - 6) / 3), i % 2 ? -0.1 : LV + 0.1); pone(py, () => pilarRoto(p, px, py, 26 + rnd() * 18, [120, 90, 80])); }
        if (n >= 0.8) { const [px, py] = orilla(); pone(py, () => { costillar(p, px, py, 1.6); }); const [qx, qy] = orilla(); pone(qy, () => calavera(p, qx, qy, 1.1)); esc.part.push({ tipo: 'esquirlas', n: 10, col: [255, 220, 120] }); }
        for (let i = 0; i < 10; i++) { const [px, py] = orilla(); pone(py, () => (rnd() < 0.4 ? pilaOro(p, px, py, 12 + rnd() * 10, rnd) : roca(p, px, py, 16 + rnd() * 12, 9 + rnd() * 9, P.muro, rnd))); }
        for (let i = 0; i < 20; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); pone(py, () => hueso(p, px, py, rnd)); }
        for (let i = 0; i < 8; i++) { const [px, py] = fondoEnemigo(6); esc.anim.push({ tipo: 'brillo', x: px + (rnd() - 0.5) * 20, y: py - 6 - rnd() * 8 }); }
        { const [px, py] = at(LU - 3, LV / 2); esc.luces.push({ x: px, y: py, r: 130, col: [255, 120, 50], flick: 0.06 }); }
        esc.part.push({ tipo: 'brasas', n: 30 + Math.round(n * 30) });
        esc.tinte = [255, 90, 40, 0.08 + n * 0.05];
      } else if (lugar === 'swamp') { // H4: agua verde, árboles muertos, fuegos fatuos y una choza al fondo
        for (let i = 0; i < 5 + Math.round(n * 4); i++) { const [px, py] = at(2 + rnd() * (LU - 4), 1 + rnd() * (LV - 2)), w = 20 + rnd() * 24; pone(py - 10, () => poza(p, px, py, w, [70, 130, 60])); }
        for (let i = 0; i < 12; i++) { const [px, py] = orilla(); pone(py, () => pino(p, px, py, rnd, 0.9 + rnd() * 0.3)); }
        for (let i = 0; i < 6 + Math.round(n * 6); i++) { const [px, py] = at(rnd() * LU, rnd() * LV); esc.luces.push({ x: px, y: py - 8, r: 34, col: [110, 255, 130], flick: 0, pulso: rnd() * 6, fantasma: true }); }
        { const [px, py] = at(LU - 1.2, LV / 2); pone(py, () => { p.sombra(px, py, 30, 6, 0.4); for (const dx of [-8, 6]) p.r(px + dx, py - 12, 2, 12, '#3a2a18'); p.r(px - 12, py - 24, 24, 12, '#5a4428'); p.r(px - 14, py - 30, 28, 6, '#3a5a2a'); p.r(px - 2, py - 20, 4, 6, '#9aff7a'); }); esc.luces.push({ x: px, y: py - 18, r: 60, col: [130, 255, 110], flick: 0.2 }); }
        for (let i = 0; i < 4 + Math.round(n * 6); i++) { const yy = rnd() < 0.5 ? rnd() * (my - 6) : my + fh + 6 + rnd() * Math.max(2, H - my - fh - 12); esc.anim.push({ tipo: 'ojos', x: rnd() * W, y: yy, sep: 4, col: [200, 255, 90] }); }
        esc.part.push({ tipo: 'niebla', n: 10 + Math.round(n * 8) }, { tipo: 'motas', n: 18, col: [150, 255, 130] });
        esc.tinte = [80, 160, 70, 0.08 + n * 0.05];
      } else if (lugar === 'giants') { // H4: murallas enormes, huesos de titán y armas del tamaño de un árbol
        for (let i = 0; i < 4; i++) { const [px, py] = at(3 + i * ((LU - 6) / 3), i % 2 ? -0.1 : LV + 0.1); pone(py, () => pilarRoto(p, px, py, 40 + rnd() * 24, [130, 122, 108])); }
        for (let i = 0; i < 1 + Math.round(n * 2); i++) { const [px, py] = orilla(); pone(py, () => costillar(p, px, py, 1.4 + n * 0.6)); }
        { const [px, py] = at(LU - 0.9, LV / 2); pone(py, () => calavera(p, px, py, 1.6 + n * 0.6)); }
        for (let i = 0; i < 12; i++) { const [px, py] = orilla(); pone(py, () => roca(p, px, py, 18 + rnd() * 16, 10 + rnd() * 10, P.muro, rnd)); }
        for (let i = 0; i < 3; i++) { const [px, py] = fondoEnemigo(5); pone(py, () => { p.sombra(px, py, 24, 5, 0.4); p.r(px - 2, py - 34, 4, 34, '#5a3a20'); p.r(px - 8, py - 40, 16, 8, '#8a8a92'); p.r(px - 8, py - 40, 16, 1, '#b0b0b8'); }); }
        esc.part.push({ tipo: 'motas', n: 26, col: [230, 210, 170] });
        esc.tinte = [200, 180, 140, 0.05 + n * 0.04];
      } else if (lugar === 'temple') { // H4: columnas bajo el agua, luz que baja del lago y un portal que canta
        for (let k = 0; k < 5; k++) for (const v of [-0.15, LV + 0.15]) { const [px, py] = at(3 + k * ((LU - 6) / 4), v); pone(py, () => columna(p, px, py, 38 + Math.round(rnd() * 10))); }
        for (let i = 0; i < 6; i++) { const [px, py] = at(2 + rnd() * (LU - 4), 1 + rnd() * (LV - 2)); charco(p, px, py, 18 + rnd() * 16); }
        for (let i = 0; i < 4; i++) esc.anim.push({ tipo: 'rayo', x: mx + fw * (0.15 + i * 0.25 + rnd() * 0.05), w: 24 + rnd() * 16, col: [110, 220, 240] });
        for (let i = 0; i < 6; i++) { const [px, py] = at(rnd() * LU, rnd() * LV); esc.luces.push({ x: px, y: py, r: 40, col: [90, 230, 220], flick: 0, pulso: rnd() * 6, fantasma: true }); }
        if (n >= 0.4) for (let k = 0; k < 3; k++) { const [px, py] = at(4 + k * ((LU - 8) / 2), k % 2 ? 0.1 : LV - 0.1); pone(py, () => estatua(p, px, py)); }
        if (n >= 0.6) { const [px, py] = at(LU - 0.9, LV / 2); esc.anim.push({ tipo: 'portal', x: px, y: py - 18 }); esc.luces.push({ x: px, y: py - 18, r: 90, col: [90, 230, 220], flick: 0, pulso: 0 }); }
        esc.part.push({ tipo: 'orbes', n: 8 }, { tipo: 'motas', n: 20, col: [140, 240, 240] });
        esc.tinte = [60, 160, 200, 0.1 + n * 0.05];
      } else if (lugar === 'crater') {
        for (let i = 0; i < 10; i++) { const [px, py] = orilla(); pone(py, () => roca(p, px, py, 14 + rnd() * 14, 8 + rnd() * 8, P.muro, rnd)); }
        for (let i = 0; i < 9; i++) { const [px, py] = at(LU * 0.4 + rnd() * LU * 0.55, 1 + rnd() * (LV - 2)); pone(py, () => cristales(p, px, py, [150, 180, 240], rnd, 2 + Math.floor(rnd() * 2))); esc.luces.push({ x: px, y: py - 6, r: 32, col: [150, 190, 255], flick: 0, pulso: rnd() * 6 }); }
        esc.part.push({ tipo: 'humo', n: 10 + Math.round(n * 8) }, { tipo: 'brasas', n: 14 + Math.round(n * 20) });
        // pisos hondos: pozas de lava, el trozo de estrella que cayó y estrellas fugaces en el cielo
        if (n >= 0.35) for (let i = 0; i < 2 + Math.round(n * 2); i++) { const [px, py] = orilla(), w = 24 + rnd() * 18; pone(py - 10, () => poza(p, px, py, w, [255, 120, 40])); esc.anim.push({ tipo: 'lava', x: px, y: py, w }); esc.luces.push({ x: px, y: py, r: 46 + w, col: [255, 120, 40], flick: 0.06 }); }
        if (n >= 0.6) { const [px, py] = at(LU - 1, LV / 2); pone(py, () => meteoro(p, px, py)); esc.luces.push({ x: px, y: py - 14, r: 100 + n * 40, col: [140, 180, 255], flick: 0, pulso: 0.5 }); for (let i = 0; i < 5; i++) esc.anim.push({ tipo: 'destello', x: px + (rnd() - 0.5) * 40, y: py - 6 - rnd() * 20, col: [160, 200, 255] }); }
        if (n >= 0.75) esc.part.push({ tipo: 'estrellas', n: 3 });
        esc.tinte = n >= 0.6 ? [120, 100, 255, 0.05 + n * 0.04] : null;
      }
    } else if (lugar === 'mar') { // pk-29: mar abierto. Olas, islotes y rocas en las orillas; más lejos, tormenta y bruma
      const azul = mix([40, 104, 146], [28, 52, 80], n), claro = mix([70, 150, 190], [56, 90, 120], n);
      for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
        const k = U.noise(i / 40, j / 22, seed) * 0.6 + U.noise(i / 9, j / 5, seed + 4) * 0.4;
        x.fillStyle = rgb(mix(azul, claro, U.clamp(k * 1.3 - 0.35, 0, 1))); x.fillRect(i, j, 2, 2);
      }
      // crestas de las olas, quietas (las que se mueven van en animar)
      for (let i = 0; i < 260; i++) { const px = rnd() * W, py = rnd() * H, w = 3 + Math.floor(rnd() * 6); p.r(px, py, w, 1, 'rgba(220,240,255,' + (0.16 + rnd() * 0.22).toFixed(2) + ')'); p.r(px + 1, py + 1, w - 2, 1, 'rgba(10,30,50,0.18)'); }
      // islotes y rocas fuera del campo (o en las orillas)
      const islote = (cx, cy, w, h, palma) => {
        p.sombra(cx, cy + 2, w + 10, 6, 0.2);
        for (let r = 0; r < 4; r++) p.r(cx - w / 2 - 4 + r, cy - 1 + r, w + 8 - r * 2, 1, 'rgba(230,245,255,' + (0.5 - r * 0.1) + ')');
        for (let r = 0; r < h; r++) { const half = Math.round((w / 2) * Math.sqrt(1 - Math.pow(1 - (r + 1) / h, 2))); p.r(cx - half, cy - h + r, half * 2, 1, r < 2 ? '#e8d8a0' : r < h - 2 ? '#d4bf84' : '#b89a60'); }
        if (palma) { p.r(cx - 1, cy - h - 12, 2, 12, '#7a5a34'); for (const [dx, dy] of [[-7, 0], [6, 0], [-5, -3], [4, -3], [0, -4]]) p.r(cx + dx - 2, cy - h - 13 + dy, 6, 2, '#3a8a3a'); }
      };
      const roquedal = (cx, cy, w) => { for (let r = 0; r < 3; r++) p.r(cx - w / 2 - 3, cy + r - 1, w + 6, 1, 'rgba(230,245,255,0.35)'); roca(p, cx, cy, w, Math.round(w * 0.6), [84, 84, 92], rnd); };
      for (let i = 0; i < 4 + Math.round(n * 3); i++) { const [px, py] = orilla(); pone(py, () => (rnd() < 0.5 ? roquedal(px, py, 10 + rnd() * 12) : islote(px, py, 22 + rnd() * 20, 6 + rnd() * 4, rnd() < 0.6))); }
      for (let i = 0; i < 8; i++) { const px = rnd() * W, py = rnd() * H; if (px > mx - 20 && px < mx + fw + 20 && py > my - 20 && py < my + fh + 20) continue; pone(py, () => islote(px, py, 30 + rnd() * 40, 8 + rnd() * 6, true)); }
      // restos flotando: barriles, tablas y un mástil roto
      for (let i = 0; i < 5 + Math.round(n * 5); i++) { const [px, py] = at(2 + rnd() * (LU - 4), 0.5 + rnd() * (LV - 1)); const t = rnd(); pone(py, () => { if (t < 0.4) { p.r(px - 3, py - 4, 6, 5, '#7a4a24'); p.r(px - 3, py - 3, 6, 1, '#3a3a40'); } else if (t < 0.8) { p.r(px - 6, py - 1, 12, 2, '#8a6232'); p.r(px - 6, py - 1, 12, 1, '#a8804a'); } else { p.r(px - 10, py - 2, 20, 2, '#6a4424'); p.r(px + 6, py - 4, 6, 3, '#d8d0b8'); } p.r(px - 6, py + 1, 12, 1, 'rgba(230,245,255,0.4)'); }); }
      for (let i = 0; i < 26; i++) esc.anim.push({ tipo: 'ola', x: rnd() * W, y: rnd() * H, w: 4 + Math.floor(rnd() * 6), f: rnd() * 6 });
      for (let i = 0; i < 10; i++) esc.anim.push({ tipo: 'destello', x: rnd() * W, y: rnd() * H });
      for (let i = 0; i < 3; i++) esc.anim.push({ tipo: 'gaviota', x: rnd() * W, y: rnd() * H * 0.5, f: rnd() * 6, v: 14 + rnd() * 10 });
      // tu lado: una boya con el color de tu reino; el de ellos, una bandera negra
      { const [px, py] = fondoMio(2); pone(py, () => { p.r(px - 3, py - 6, 6, 6, '#c8c0a8'); p.r(px - 1, py - 22, 2, 16, '#3a2412'); p.r(px - 4, py, 8, 1, 'rgba(230,245,255,0.5)'); }); esc.anim.push({ tipo: 'bandera', x: px + 1, y: py - 22, col: rgb(PK.D.PLAYER_COLOR) }); }
      { const [px, py] = fondoEnemigo(2); pone(py, () => { p.r(px - 3, py - 6, 6, 6, '#5a5a62'); p.r(px - 1, py - 22, 2, 16, '#2a1a10'); p.r(px - 4, py, 8, 1, 'rgba(230,245,255,0.5)'); }); esc.anim.push({ tipo: 'bandera', x: px + 1, y: py - 22, col: '#1a1a1e' }); }
      if (n >= 0.55) { esc.part.push({ tipo: 'niebla', n: 8 + Math.round(n * 10) }); esc.anim.push({ tipo: 'relampago', f: rnd() * 5 }); }
      if (n >= 0.85) esc.part.push({ tipo: 'gotas', n: 50 });
      esc.oscuro = 0.06 + n * 0.32; esc.tinte = n >= 0.55 ? [70, 110, 150, 0.08 + n * 0.06] : [255, 230, 180, 0.04];
      esc.bruma = [170, 200, 220];
    } else { // campo abierto (encargos y lo que no tenga escenario propio)
      suelo(x, W, H, [86, 126, 58], 16, seed);
      for (let i = 0; i < 120; i++) { const [px, py] = [rnd() * W, rnd() * H]; p.r(px, py, 1, 1, ['#e8e060', '#f0f0f0', '#d070a0'][Math.floor(rnd() * 3)]); }
      for (let i = 0; i < 50; i++) { const px = rnd() * W, py = rnd() * H; if (px > mx && px < mx + fw && py > my && py < my + fh) continue; pone(py, () => pino(p, px, py, rnd)); }
    }
    objetos.sort((a, b) => a.y - b.y);
    for (const o2 of objetos) o2.fn();
    profundidad(x, W, H, esc.bruma || [150, 180, 120], 0.8 + n * 0.4);
    // viñeta suave en los bordes de la pantalla
    const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // partículas iniciales
    const ps = [];
    for (const def of esc.part) for (let i = 0; i < def.n; i++) ps.push(nueva(def, W, H, rnd, true));
    esc.ps = ps;
    // la máscara de oscuridad va a media resolución (son degradados suaves): rinde 4 veces menos píxeles por cuadro
    esc.luz = document.createElement('canvas'); esc.luz.width = Math.ceil(W / 2); esc.luz.height = Math.ceil(H / 2);
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
          r(fx - 1, a.y - h, 3 * k, h, a.verde ? (i % 2 ? '#1ca850' : '#30d070') : i % 2 ? '#e8501c' : '#f07a24');
          r(fx, a.y - h * 0.7, 2 * k, h * 0.7, a.verde ? '#80ffb0' : '#ffc040');
          r(fx, a.y - h * 0.35, 1, h * 0.35, a.verde ? '#e0fff0' : '#fff2b0');
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
        ctx.fillStyle = 'rgba(255,' + Math.round(120 + 80 * k) + ',40,' + (0.6 + 0.4 * k).toFixed(2) + ')'; // un color por grieta (no uno por punto)
        for (const [qx, qy] of a.pts) ctx.fillRect(Math.round(qx), Math.round(qy), 2, 1);
      } else if (a.tipo === 'vena') { // veta de cristal que late, como un pulso que recorre el suelo
        const cab = (t * 8 + a.pts[0][0]) % (a.pts.length + 10);
        ctx.fillStyle = a.rgb || (a.rgb = 'rgb(' + a.col.join(',') + ')');
        for (let i = 0; i < a.pts.length; i++) { const d = Math.abs(i - cab); ctx.globalAlpha = d < 4 ? 1 - d / 4 : 0.25 + 0.15 * Math.sin(t * 2 + i); ctx.fillRect(Math.round(a.pts[i][0]), Math.round(a.pts[i][1]), 2, 1); }
        ctx.globalAlpha = 1;
      } else if (a.tipo === 'ojos') { // un par de ojos en la oscuridad que parpadea
        const ciclo = (t + a.x * 0.13) % 5, abiertos = ciclo > 0.18 && !(ciclo > 2.6 && ciclo < 2.75), k = 0.6 + 0.4 * Math.sin(t * 3 + a.x);
        if (abiertos) { const c = 'rgba(' + a.col.join(',') + ',' + k.toFixed(2) + ')', w = a.grande ? 4 : 2; r(a.x - a.sep / 2 - w / 2, a.y, w, a.grande ? 3 : 1, c); r(a.x + a.sep / 2 - w / 2, a.y, w, a.grande ? 3 : 1, c); }
      } else if (a.tipo === 'runas') { // círculo de runas en el piso, girando despacio, en perspectiva
        const n = 16, k = 0.45 + 0.25 * Math.sin(t * 1.8), c = 'rgba(' + a.col.join(',') + ',';
        ctx.globalCompositeOperation = 'lighter';
        for (const rr of [a.r, a.r * 0.72]) for (let i = 0; i < 48; i++) { const an = (i / 48) * 6.283 + t * (rr === a.r ? 0.15 : -0.22); r(a.x + Math.cos(an) * rr, a.y + Math.sin(an) * rr * 0.42, 2, 1, c + (k * 0.8).toFixed(2) + ')'); }
        for (let i = 0; i < n; i++) { const an = (i / n) * 6.283 + t * 0.15, gx = a.x + Math.cos(an) * a.r * 0.86, gy = a.y + Math.sin(an) * a.r * 0.86 * 0.42; r(gx - 1, gy - 2, 1, 4, c + k.toFixed(2) + ')'); r(gx - 1, gy - 2, 3, 1, c + k.toFixed(2) + ')'); if (i % 2) r(gx + 1, gy, 1, 2, c + k.toFixed(2) + ')'); }
        for (let i = 0; i < 6; i++) { const an = (i / 6) * 6.283 - t * 0.22; r(a.x + Math.cos(an) * a.r * 0.5, a.y + Math.sin(an) * a.r * 0.5 * 0.42, 3, 1, c + (k * 0.6).toFixed(2) + ')'); }
        ctx.globalCompositeOperation = 'source-over';
      } else if (a.tipo === 'portal') { // un portal que gira
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 60; i++) { const an = (i / 60) * 6.283 * 3 + t * 2.2, d = (i / 60) * 22; r(a.x + Math.cos(an) * d * 0.7, a.y + Math.sin(an) * d, 2, 2, 'rgba(' + (150 + i) + ',' + (80 + i) + ',255,' + (0.7 - i / 120).toFixed(2) + ')'); }
        ctx.globalCompositeOperation = 'source-over';
        r(a.x - 2, a.y - 2, 4, 4, '#f0e0ff');
      } else if (a.tipo === 'lava') { // la poza de lava: brillos que se mueven y burbujas que revientan
        const h = Math.max(4, Math.round(a.w * 0.3));
        for (let i = 0; i < 6; i++) { const ph = t * 0.8 + i * 1.3, gx = a.x + Math.sin(ph + i) * a.w * 0.32, gy = a.y + Math.cos(ph * 0.7 + i) * h * 0.25; r(gx - 2, gy, 5, 1, 'rgba(255,230,120,' + (0.5 + 0.3 * Math.sin(ph * 3)).toFixed(2) + ')'); }
        const b = (t * 1.3 + a.x) % 2.2; if (b < 0.4) { const bx = a.x + Math.sin(a.x + Math.floor(t * 1.3)) * a.w * 0.3; r(bx - 1, a.y - b * 6, 3, 2, 'rgba(255,200,90,' + (1 - b / 0.4).toFixed(2) + ')'); }
      } else if (a.tipo === 'ola') { // pk-29: una cresta que va y viene
        const k = Math.sin(t * 1.6 + a.f), ox = Math.round(Math.sin(t * 0.7 + a.f) * 3);
        if (k > 0) { r(a.x + ox, a.y, a.w, 1, 'rgba(235,248,255,' + (0.5 * k).toFixed(2) + ')'); r(a.x + ox + 1, a.y - 1, a.w - 2, 1, 'rgba(255,255,255,' + (0.3 * k).toFixed(2) + ')'); }
      } else if (a.tipo === 'gaviota') {
        a.x += a.v * dt; if (a.x > esc.W + 10) a.x = -10;
        const ala = Math.sin(t * 8 + a.f) > 0 ? -1 : 1, gy = a.y + Math.sin(t + a.f) * 4;
        r(a.x - 3, gy + ala, 3, 1, '#f0f0f0'); r(a.x, gy, 1, 1, '#f0f0f0'); r(a.x + 1, gy + ala, 3, 1, '#f0f0f0');
      } else if (a.tipo === 'relampago') { // de vez en cuando, un destello en el cielo
        const c = (t + a.f) % 7;
        if (c < 0.12 || (c > 0.22 && c < 0.28)) { ctx.fillStyle = 'rgba(220,235,255,0.22)'; ctx.fillRect(0, 0, esc.W, esc.H); }
      } else if (a.tipo === 'rayo') {
        const g = ctx.createLinearGradient(a.x, 0, a.x + 60, esc.H), rc = (a.col || [255, 240, 190]).join(',');
        g.addColorStop(0, 'rgba(' + rc + ',0.22)'); g.addColorStop(1, 'rgba(' + rc + ',0)');
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
      else if (q.tipo === 'esquirlas') { q.y -= 5 * q.v * dt; q.x += Math.sin(q.t * 0.7 + i) * 5 * dt; if (q.y < -6) esc.ps[i] = nueva(q, W, H); const a = 0.5 + 0.5 * Math.sin(q.t * 3 + i), c = 'rgba(' + q.col.join(',') + ',' + (0.35 + 0.5 * a).toFixed(2) + ')'; ctx.fillStyle = c; const fx = Math.round(q.x), fy = Math.round(q.y); if (Math.floor(q.t * 2 + i) % 2) { ctx.fillRect(fx, fy - 1, 1, 3); } else { ctx.fillRect(fx - 1, fy, 3, 1); } if (a > 0.95) { ctx.fillStyle = '#fff'; ctx.fillRect(fx, fy, 1, 1); } }
      else if (q.tipo === 'orbes') { q.y -= 6 * q.v * dt; q.x += Math.sin(q.t * 1.2 + i) * 10 * dt; if (q.y < -6) esc.ps[i] = nueva(q, W, H); const a = 0.4 + 0.3 * Math.sin(q.t * 2 + i); ctx.fillStyle = 'rgba(170,255,210,' + (a * 0.35).toFixed(2) + ')'; ctx.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 2, 5, 5); ctx.fillStyle = 'rgba(230,255,240,' + a.toFixed(2) + ')'; ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2); }
      else if (q.tipo === 'estrellas') { // estrellas fugaces arriba, de vez en cuando
        q.t2 = (q.t2 || 0) + dt;
        if (!q.on && q.t2 > 2 + (i * 1.7) % 4) { q.on = true; q.t2 = 0; q.x = Math.random() * W; q.y = Math.random() * H * 0.25; }
        if (q.on) { const k = q.t2 / 0.6; if (k > 1) { q.on = false; q.t2 = 0; continue; } const x0 = q.x + k * 90, y0 = q.y + k * 40; for (let s2 = 0; s2 < 10; s2++) { ctx.fillStyle = 'rgba(220,230,255,' + ((1 - s2 / 10) * (1 - k)).toFixed(2) + ')'; ctx.fillRect(Math.round(x0 - s2 * 3), Math.round(y0 - s2 * 1.33), 2, 1); } }
      }
      else if (q.tipo === 'humo') { q.y -= 8 * q.v * dt; q.x += 3 * dt; if (q.y < -20) esc.ps[i] = nueva(q, W, H); const s = 4 + (q.t % 6) * 2; ctx.fillStyle = 'rgba(60,50,48,0.12)'; ctx.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s); }
    }
  };
  // Oscuridad con agujeros de luz (las fogatas, los cristales, las velas) y su color.
  // esc.extra: luces de un momento que pone la batalla (fuego, explosiones, magia), en coordenadas del escenario
  E.luz = function (ctx, esc) {
    const extra = esc.extra || [];
    if (!esc.oscuro && !esc.tinte && !extra.length) return;
    const t = esc.t, L = esc.luz, x = L.getContext('2d');
    x.setTransform(L.width / esc.W, 0, 0, L.height / esc.H, 0, 0);
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
    if (esc.oscuro) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(L, 0, 0, esc.W, esc.H); ctx.imageSmoothingEnabled = sm; }
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
