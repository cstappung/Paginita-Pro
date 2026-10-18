// =====================================================================
//  PRO DEFENDER — Renderizado en Canvas 2D
//  Arte procedural: sprites pre-renderizados (enemigos y torres con
//  sombreado, brillos y animación), mapas con texturas y clima.
// =====================================================================
(function () {
  const PD = (globalThis.PD = globalThis.PD || {});
  const W = PD.W, H = PD.H, TAU = Math.PI * 2;
  let RS = 1; // resolución del sprite en construcción (para shadowBlur)

  // ============================ UTILIDADES ===============================
  function hex2rgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  function shadeRGB(hex, f) {
    let [r, g, b] = hex2rgb(hex);
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return [r | 0, g | 0, b | 0];
  }
  const shadeCache = {};
  function shade(hex, f) {
    const k = hex + f;
    if (shadeCache[k]) return shadeCache[k];
    const [r, g, b] = shadeRGB(hex, f);
    return (shadeCache[k] = `rgb(${r},${g},${b})`);
  }
  const sh = shade;
  function rgba(hex, a, f) { const [r, g, b] = f ? shadeRGB(hex, f) : hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; }
  PD.shade = shade;

  function circle(c, x, y, r, fill, stroke, lw) {
    c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 1.5; c.strokeStyle = stroke; c.stroke(); }
  }
  function ell(c, x, y, rx, ry, rot, fill, stroke, lw) {
    c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 1.5; c.strokeStyle = stroke; c.stroke(); }
  }
  function poly(c, x, y, r, n, rot, fill, stroke, lw) {
    c.beginPath();
    for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 1.5; c.strokeStyle = stroke; c.stroke(); }
  }
  function star(c, x, y, r1, r2, n, rot, fill, stroke, lw) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 1.5; c.strokeStyle = stroke; c.stroke(); }
  }
  function shape(c, pts, fill, stroke, lw) {
    c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p[0], p[1])); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 1.5; c.strokeStyle = stroke; c.stroke(); }
  }
  function rrect(c, x, y, w, h, r, fill, stroke, lw) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 1.5; c.strokeStyle = stroke; c.stroke(); }
  }
  // gradiente esférico (luz arriba-izquierda)
  function sg(c, x, y, r, col, hi, lo) {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.08);
    g.addColorStop(0, sh(col, hi === undefined ? 0.55 : hi)); g.addColorStop(0.5, col); g.addColorStop(1, sh(col, lo === undefined ? -0.55 : lo));
    return g;
  }
  function lg(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
  function orb(c, x, y, rx, ry, col, lw) {
    ell(c, x, y, rx, ry, 0, sg(c, x, y, Math.max(rx, ry), col), lw === 0 ? null : sh(col, -0.72), lw || 1.4);
  }
  function spec(c, x, y, r, a) { const o = c.globalAlpha; c.globalAlpha = o * (a || 0.6); ell(c, x, y, r, r * 0.65, -0.5, '#ffffff'); c.globalAlpha = o; }
  function glow(c, col, blur) { c.shadowColor = col; c.shadowBlur = blur * RS; }
  function noGlow(c) { c.shadowBlur = 0; c.shadowColor = 'transparent'; }
  // ojos mirando hacia +x
  function eyes(c, x, sep, er, o) {
    o = o || {};
    for (const s of [-1, 1]) {
      const y = s * sep;
      if (o.glow) {
        glow(c, o.glow, 6);
        ell(c, x, y, er * 0.9, er * 0.55, s * -0.35, o.glow);
        noGlow(c);
        ell(c, x + er * 0.15, y, er * 0.45, er * 0.25, s * -0.35, '#ffffff');
      } else {
        ell(c, x, y, er, er * 0.85, 0, '#ffffff', '#1a1a1a', 0.8);
        circle(c, x + er * 0.35, y + s * -er * 0.05, er * 0.55, o.pupil || '#161616');
        circle(c, x + er * 0.15, y - er * 0.25, er * 0.2, '#ffffff');
      }
      if (o.angry !== false) {
        c.strokeStyle = o.brow || '#161616'; c.lineWidth = Math.max(1, er * 0.42); c.lineCap = 'round';
        c.beginPath(); c.moveTo(x - er * 0.9, y + s * er * 1.15); c.lineTo(x + er * 0.9, y + s * er * 0.35); c.stroke();
      }
    }
  }
  function fangs(c, x, w, col) {
    c.strokeStyle = '#2a0c0c'; c.lineWidth = 1.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, -w); c.quadraticCurveTo(x + w * 0.35, 0, x, w); c.stroke();
    for (const s of [-1, 1]) shape(c, [[x, s * w * 0.6], [x - w * 0.15, s * w * 0.25], [x + w * 0.45, s * w * 0.42]], col || '#ffffff');
  }
  function leaf(c, len, w, col) {
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.5, -w, len, 0); c.quadraticCurveTo(len * 0.5, w, 0, 0);
    c.fillStyle = lg(c, 0, -w, 0, w, [sh(col, 0.3), col, sh(col, -0.4)]); c.fill();
    c.strokeStyle = sh(col, -0.6); c.lineWidth = 0.8; c.stroke();
    c.beginPath(); c.moveTo(len * 0.1, 0); c.lineTo(len * 0.85, 0); c.strokeStyle = sh(col, 0.5); c.lineWidth = 0.6; c.stroke();
  }
  // patas de insecto animadas
  function legs(c, n, x0, x1, w, len, p, col, lw) {
    c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? x0 : x0 + (x1 - x0) * i / (n - 1);
      for (const s of [-1, 1]) {
        const sw = Math.sin(p * TAU + i * Math.PI + (s > 0 ? Math.PI : 0)) * len * 0.35;
        c.lineWidth = lw;
        c.beginPath(); c.moveTo(x, s * w);
        c.lineTo(x + sw * 0.6 + len * 0.15, s * (w + len * 0.6));
        c.lineTo(x + sw - len * 0.1, s * (w + len));
        c.stroke();
      }
    }
  }
  function rivets(c, pts, r, col) { for (const [x, y] of pts) { circle(c, x, y, r, col || '#d9dee6'); circle(c, x - r * 0.3, y - r * 0.3, r * 0.4, '#ffffff'); } }

  // ============================ RUIDO ====================================
  function vnoise(seed) {
    const rng = PD.rng(seed), N = 128, v = new Float32Array(N * N);
    for (let i = 0; i < v.length; i++) v[i] = rng();
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      const x0 = xi & 127, x1 = (xi + 1) & 127, y0 = (yi & 127) * N, y1 = ((yi + 1) & 127) * N;
      const a = v[y0 + x0], b = v[y0 + x1], cc = v[y1 + x0], d = v[y1 + x1];
      return a + (b - a) * u + (cc - a) * w + (a - b - cc + d) * u * w;
    };
  }
  function fbm(n, x, y, o) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * n(x * f, y * f); t += a; a *= 0.5; f *= 2.03; } return s / t; }

  // ======================== ARTE DE ENEMIGOS =============================
  // Cada función dibuja centrada en (0,0) mirando hacia +x. p = fase (0..1)
  const ART = {};
  ART.sprout = (c, d, r, p) => {
    const sq = 1 + 0.08 * Math.sin(p * TAU);
    for (const s of [-1, 1]) { c.save(); c.translate(-r * 0.45, s * r * 0.15); c.rotate(Math.PI + s * (0.65 + Math.sin(p * TAU) * 0.12)); leaf(c, r * 1.05, r * 0.38, '#8fe05a'); c.restore(); }
    c.save(); c.scale(sq, 1 / sq);
    orb(c, 0, 0, r, r, d.color);
    spec(c, -r * 0.35, -r * 0.4, r * 0.32);
    c.restore();
    eyes(c, r * 0.35, r * 0.36, r * 0.27);
    fangs(c, r * 0.82, r * 0.24);
  };
  ART.moss = (c, d, r, p) => {
    const sq = 1 + 0.05 * Math.sin(p * TAU);
    c.save(); c.scale(sq, 1 / sq);
    poly(c, 0, 0, r * 1.02, 9, 0.2, sg(c, 0, 0, r, '#6b6f62'), '#2b2e26', 1.4);
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + 2, rr = r * (0.35 + (i % 3) * 0.12); const x = Math.cos(a) * r * 0.55 - r * 0.15, y = Math.sin(a) * r * 0.55; circle(c, x, y, rr, sg(c, x, y, rr, i % 2 ? d.color : '#2f8a3a')); }
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.5; circle(c, Math.cos(a) * r * 0.6 - r * 0.2, Math.sin(a) * r * 0.65, 1.8, i % 2 ? '#ff8ad8' : '#fff27a'); }
    c.restore();
    eyes(c, r * 0.45, r * 0.32, r * 0.24, { glow: '#d6ff5a' });
  };
  ART.jelly = (c, d, r, p) => {
    const a = Math.sin(p * TAU);
    c.save(); c.scale(1 + a * 0.1, 1 - a * 0.1);
    const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, rgba(d.color, 0.82)); g.addColorStop(1, rgba(d.color, 0.95, -0.4));
    ell(c, 0, 0, r, r, 0, g, sh(d.color, -0.6), 1.4);
    circle(c, -r * 0.15, r * 0.1, r * 0.38, 'rgba(122,14,74,0.45)');
    circle(c, -r * 0.45, -r * 0.2, r * 0.12, 'rgba(255,255,255,0.6)');
    circle(c, -r * 0.1, r * 0.55, r * 0.08, 'rgba(255,255,255,0.5)');
    spec(c, -r * 0.35, -r * 0.45, r * 0.3, 0.8);
    c.restore();
    eyes(c, r * 0.4, r * 0.32, r * 0.24);
  };
  function sparkArt(c, d, r, p, core) {
    c.globalAlpha = 0.45;
    for (let i = 0; i < 3; i++) { c.strokeStyle = d.color; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); const y = (i - 1) * r * 0.5; c.moveTo(-r * 0.8, y); c.lineTo(-r * (1.6 + (i % 2) * 0.3), y); c.stroke(); }
    c.globalAlpha = 1;
    glow(c, d.color, 10);
    star(c, 0, 0, r * 1.25, r * 0.62, 8, p * TAU / 8, sg(c, 0, 0, r, d.color, 0.8, -0.3), sh(d.color, -0.5), 1.2);
    noGlow(c);
    circle(c, 0, 0, r * 0.55, sg(c, 0, 0, r * 0.55, core, 0.9, -0.2));
    eyes(c, r * 0.22, r * 0.25, r * 0.2);
  }
  ART.spark = (c, d, r, p) => sparkArt(c, d, r, p, '#fff6b0');
  ART.ember = (c, d, r, p) => sparkArt(c, d, r, p, '#ffe08a');
  ART.shell = (c, d, r, p) => {
    for (const [x, s] of [[r * 0.5, -1], [r * 0.5, 1], [-r * 0.55, -1], [-r * 0.55, 1]]) {
      const sw = Math.sin(p * TAU + (x > 0 ? 0 : Math.PI) + (s > 0 ? Math.PI : 0)) * 0.4;
      c.save(); c.translate(x, s * r * 0.75); c.rotate(s * (0.5 + sw)); ell(c, 0, s * r * 0.15, r * 0.32, r * 0.2, 0, '#8db35a', '#3b5420', 1); c.restore();
    }
    ell(c, -r * 1.05, 0, r * 0.18, r * 0.1, 0, '#8db35a', '#3b5420', 1);
    const hx = r * 0.95 + Math.sin(p * TAU) * r * 0.05;
    orb(c, hx, 0, r * 0.38, r * 0.32, '#9cc463');
    circle(c, hx + r * 0.15, -r * 0.15, r * 0.07, '#111'); circle(c, hx + r * 0.15, r * 0.15, r * 0.07, '#111');
    shape(c, [[hx + r * 0.3, -r * 0.08], [hx + r * 0.42, 0], [hx + r * 0.3, r * 0.08]], '#e8c060');
    ell(c, 0, 0, r * 1.02, r * 0.92, 0, sg(c, 0, 0, r, d.color), '#3a220e', 1.6);
    ell(c, 0, 0, r * 0.82, r * 0.72, 0, null, sh(d.color, -0.5), 1);
    poly(c, 0, 0, r * 0.32, 6, 0, sh(d.color, 0.15), sh(d.color, -0.6), 1);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; poly(c, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.5, r * 0.22, 6, 0, sh(d.color, 0.05), sh(d.color, -0.6), 0.8); }
    spec(c, -r * 0.3, -r * 0.4, r * 0.3, 0.35);
  };
  ART.moth = (c, d, r, p) => {
    const f = 0.35 + 0.65 * Math.abs(Math.cos(p * TAU));
    for (const s of [-1, 1]) {
      c.save(); c.scale(1, s);
      c.save(); c.translate(r * 0.1, r * 0.15); c.rotate(-0.35); c.scale(1, f);
      ell(c, -r * 0.05, -r * 0.85, r * 0.75, r * 0.9, -0.2, lg(c, 0, 0, 0, -r * 1.7, [sh(d.color, -0.2), d.color, sh(d.color, 0.4)]), sh(d.color, -0.6), 1);
      circle(c, -r * 0.05, -r * 0.95, r * 0.28, '#3a2a5a'); circle(c, -r * 0.05, -r * 0.95, r * 0.16, '#ffd84d'); circle(c, -r * 0.05, -r * 0.95, r * 0.07, '#111');
      c.restore();
      c.save(); c.translate(-r * 0.45, r * 0.1); c.rotate(0.3); c.scale(1, f);
      ell(c, -r * 0.1, -r * 0.6, r * 0.5, r * 0.62, 0.3, sh(d.color, -0.15), sh(d.color, -0.6), 1);
      c.restore();
      c.restore();
    }
    ell(c, -r * 0.05, 0, r * 0.75, r * 0.3, 0, sg(c, 0, 0, r * 0.7, '#7a5a9a'), '#2a1a3a', 1);
    c.fillStyle = '#2a1a3a';
    for (let i = 0; i < 3; i++) c.fillRect(-r * 0.5 + i * r * 0.3, -r * 0.28, r * 0.06, r * 0.56);
    c.strokeStyle = '#3a2a5a'; c.lineWidth = 1;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.6, s * r * 0.1); c.quadraticCurveTo(r * 1.1, s * r * 0.2, r * 1.25, s * r * 0.55); c.stroke(); }
    circle(c, r * 0.62, -r * 0.12, r * 0.09, '#ff4060'); circle(c, r * 0.62, r * 0.12, r * 0.09, '#ff4060');
  };
  ART.bee = (c, d, r, p) => {
    const f = 0.4 + 0.6 * Math.abs(Math.sin(p * TAU * 2));
    c.globalAlpha = 0.6;
    for (const s of [-1, 1]) ell(c, -r * 0.1, s * r * 0.9 * f, r * 0.8, r * 0.45 * f + 0.5, s * 0.3, '#e6f6ff', '#9fb6c8', 0.6);
    c.globalAlpha = 1;
    shape(c, [[-r * 1.1, 0], [-r * 1.5, -r * 0.12], [-r * 1.5, r * 0.12]], '#2a2a2a');
    ell(c, 0, 0, r * 1.1, r * 0.75, 0, sg(c, 0, 0, r, d.color), '#3a2400', 1.2);
    c.fillStyle = '#1c1408';
    c.fillRect(-r * 0.55, -r * 0.7, r * 0.25, r * 1.4); c.fillRect(-r * 0.05, -r * 0.74, r * 0.25, r * 1.48);
    circle(c, r * 0.75, 0, r * 0.45, '#2a1c0a');
    circle(c, r * 0.9, -r * 0.22, r * 0.14, '#ff3a3a'); circle(c, r * 0.9, r * 0.22, r * 0.14, '#ff3a3a');
  };
  ART.knight = (c, d, r, p) => {
    const step = Math.sin(p * TAU) * r * 0.12;
    ell(c, -r * 0.1 + step, -r * 0.75, r * 0.32, r * 0.22, 0, '#3a4a6a'); ell(c, -r * 0.1 - step, r * 0.75, r * 0.32, r * 0.22, 0, '#3a4a6a');
    orb(c, -r * 0.1, 0, r * 0.95, r * 0.95, d.color);
    orb(c, -r * 0.05, 0, r * 0.62, r * 0.62, '#b8c4d6');
    c.fillStyle = '#1a1f2a'; c.fillRect(r * 0.15, -r * 0.4, r * 0.12, r * 0.8);
    glow(c, '#7cf0ff', 5); circle(c, r * 0.21, -r * 0.2, r * 0.07, '#bff8ff'); circle(c, r * 0.21, r * 0.2, r * 0.07, '#bff8ff'); noGlow(c);
    star(c, -r * 0.2, 0, r * 0.18, r * 0.08, 4, 0, '#ffd84d');
    c.save(); c.translate(r * 0.85, 0);
    shape(c, [[0, -r * 0.85], [r * 0.25, -r * 0.7], [r * 0.32, 0], [r * 0.25, r * 0.7], [0, r * 0.85], [-r * 0.12, 0]], lg(c, 0, -r, 0, r, ['#9fd0ff', '#3a7ad0', '#1a3a7a']), '#0c1a3a', 1.4);
    c.strokeStyle = '#ffd84d'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(r * 0.12, -r * 0.55); c.lineTo(r * 0.12, r * 0.55); c.stroke();
    c.restore();
  };
  function ghostArt(c, d, r, p, eyeCol, alpha) {
    c.globalAlpha = alpha;
    c.beginPath();
    c.arc(r * 0.15, 0, r, -Math.PI / 2, Math.PI / 2);
    for (let k = 0; k <= 6; k++) { const yy = r - k * r / 3; const xx = -r * 1.1 - (k % 2) * r * 0.5 - Math.sin(p * TAU + k) * r * 0.25; c.lineTo(xx, yy); }
    c.closePath();
    c.fillStyle = lg(c, r, 0, -r * 1.6, 0, [sh(d.color, 0.25), d.color, rgba(d.color, 0)]); c.fill();
    c.globalAlpha = 1;
    glow(c, eyeCol, 8);
    for (const s of [-1, 1]) { c.save(); c.translate(r * 0.55, s * r * 0.35); c.rotate(s * -0.4); ell(c, 0, 0, r * 0.25, r * 0.12, 0, eyeCol); c.restore(); }
    noGlow(c);
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(r * 0.85, -r * 0.2); for (let i = 0; i < 4; i++) c.lineTo(r * (0.95 + (i % 2) * 0.1), -r * 0.2 + i * r * 0.13); c.stroke();
  }
  ART.ghost = (c, d, r, p) => ghostArt(c, d, r, p, '#e07bff', 0.95);
  ART.mirage = (c, d, r, p) => { ghostArt(c, d, r, p, '#fff1a0', 0.85); c.globalAlpha = 0.3; ell(c, 0, 0, r * 1.3, r * 0.6, 0, null, '#fff6d0', 1); c.globalAlpha = 1; };
  ART.wisp = (c, d, r, p) => {
    for (let i = 0; i < 4; i++) { c.globalAlpha = 0.25; const a = p * TAU + i * 1.6; circle(c, -r * 0.6 + Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.5, r * 0.45, '#b9a8ff'); }
    c.globalAlpha = 1;
    ghostArt(c, d, r, p, '#7af0ff', 0.9);
    c.strokeStyle = '#d0d4e0'; c.lineWidth = 1.4; c.setLineDash([2, 1.5]);
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.7); c.quadraticCurveTo(-r * 1.2, 0, -r * 0.3, r * 0.7); c.stroke(); c.setLineDash([]);
  };
  function armorBody(c, d, r, p, metal, accent) {
    legs(c, 3, r * 0.45, -r * 0.45, r * 0.6, r * 0.55, p, '#1d2228', 1.6);
    poly(c, 0, 0, r * 1.05, 6, 0, lg(c, 0, -r, 0, r, [sh(metal, 0.45), metal, sh(metal, -0.5)]), '#15181d', 1.8);
    for (let i = 0; i < 3; i++) {
      const x = -r * 0.5 + i * r * 0.42;
      rrect(c, x - r * 0.16, -r * 0.7, r * 0.34, r * 1.4, r * 0.1, lg(c, x, -r * 0.7, x, r * 0.7, [sh(metal, 0.3), sh(metal, -0.1), sh(metal, -0.45)]), '#15181d', 1);
    }
    rivets(c, [[-r * 0.75, -r * 0.45], [-r * 0.75, r * 0.45], [r * 0.4, -r * 0.62], [r * 0.4, r * 0.62]], r * 0.07);
    rrect(c, r * 0.62, -r * 0.42, r * 0.28, r * 0.84, r * 0.1, '#1a1a1a');
    glow(c, accent, 6); c.fillStyle = accent; c.fillRect(r * 0.7, -r * 0.3, r * 0.12, r * 0.6); noGlow(c);
  }
  ART.hex = (c, d, r, p) => armorBody(c, d, r, p, d.color, '#ff3a2a');
  ART.magnet = (c, d, r, p) => {
    armorBody(c, d, r, p, d.color, '#5ad1ff');
    c.lineCap = 'butt'; c.lineWidth = r * 0.22; c.strokeStyle = '#d0302a';
    c.beginPath(); c.arc(-r * 0.05, 0, r * 0.32, Math.PI * 0.5, Math.PI * 1.5, true); c.stroke();
    c.fillStyle = '#e8eef5'; c.fillRect(-r * 0.12, -r * 0.43, r * 0.22, r * 0.2); c.fillRect(-r * 0.12, r * 0.23, r * 0.22, r * 0.2);
    glow(c, '#5ad1ff', 6); c.strokeStyle = '#9ff0ff'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(r * 0.15, -r * 0.33); c.lineTo(r * 0.3, -r * 0.1); c.lineTo(r * 0.18, r * 0.05); c.lineTo(r * 0.32, r * 0.33); c.stroke(); noGlow(c);
  };
  ART.carrier = (c, d, r, p) => {
    const L = r * 1.55, Hh = r * 0.85;
    for (const s of [-1, 1]) {
      rrect(c, -L * 0.75, s * Hh * 0.95 - r * 0.22, L * 0.9, r * 0.44, r * 0.2, lg(c, 0, s * Hh - r * 0.2, 0, s * Hh + r * 0.2, ['#6b7685', '#3c4450']), '#1a1e24', 1.2);
      glow(c, '#ffa040', 8); circle(c, -L * 0.82, s * Hh * 0.95, r * 0.15 + Math.sin(p * TAU * 2) * r * 0.04, '#ffd080'); noGlow(c);
    }
    c.beginPath();
    c.moveTo(-L, -Hh * 0.75); c.lineTo(L * 0.55, -Hh); c.quadraticCurveTo(L * 1.05, -Hh * 0.6, L * 1.05, 0); c.quadraticCurveTo(L * 1.05, Hh * 0.6, L * 0.55, Hh); c.lineTo(-L, Hh * 0.75); c.closePath();
    c.fillStyle = lg(c, 0, -Hh, 0, Hh, [sh(d.color, 0.45), d.color, sh(d.color, -0.55)]); c.fill(); c.strokeStyle = '#151a20'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = sh(d.color, -0.45); c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const x = -L * 0.75 + i * L * 0.42; c.beginPath(); c.moveTo(x, -Hh * 0.8); c.lineTo(x, Hh * 0.8); c.stroke(); }
    c.fillStyle = '#ffcc33'; for (let i = 0; i < 5; i++) { c.save(); c.translate(-L * 0.85 + i * r * 0.22, Hh * 0.62); c.rotate(0.6); c.fillRect(-1, -3, 2.2, 6); c.restore(); }
    rrect(c, -L * 0.45, -Hh * 0.4, L * 0.6, Hh * 0.8, r * 0.15, sh(d.color, -0.25), '#151a20', 1);
    rivets(c, [[-L * 0.6, -Hh * 0.55], [-L * 0.6, Hh * 0.55], [L * 0.3, -Hh * 0.7], [L * 0.3, Hh * 0.7]], r * 0.06);
    ell(c, L * 0.65, 0, r * 0.35, r * 0.4, 0, lg(c, L * 0.5, -r * 0.4, L * 0.8, r * 0.4, ['#e0fbff', '#5ad1ff', '#1a5a88']), '#0c2030', 1.2);
  };
  ART.titan = (c, d, r, p) => {
    const L = r * 1.5, Hh = r * 1.05, off = (p * 8) % 1;
    for (const s of [-1, 1]) {
      rrect(c, -L, s * Hh - r * 0.3, L * 2, r * 0.6, r * 0.2, '#1c2026', '#090b0e', 1.4);
      c.fillStyle = '#3a414c';
      for (let i = 0; i < 12; i++) { const x = -L + ((i + off) / 12) * L * 2; c.fillRect(x, s * Hh - r * 0.27, r * 0.08, r * 0.54); }
    }
    rrect(c, -L * 0.92, -Hh * 0.8, L * 1.84, Hh * 1.6, r * 0.2, lg(c, 0, -Hh, 0, Hh, [sh(d.color, 0.45), d.color, sh(d.color, -0.6)]), '#0d1014', 2);
    c.fillStyle = '#ffcc33'; for (let i = 0; i < 6; i++) { c.save(); c.translate(-L * 0.8 + i * r * 0.2, -Hh * 0.62); c.rotate(0.6); c.fillRect(-1, -3, 2.2, 6); c.restore(); }
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) shape(c, [[-L * 0.4 + i * L * 0.4, s * Hh * 0.8], [-L * 0.3 + i * L * 0.4, s * Hh * 1.25], [-L * 0.2 + i * L * 0.4, s * Hh * 0.8]], '#c0c6cf', '#0d1014', 1);
    c.fillStyle = lg(c, 0, -r * 0.2, 0, r * 0.2, ['#5a6270', '#2a2f37']); c.fillRect(0, -r * 0.16, L * 1.2, r * 0.32);
    c.strokeStyle = '#0d1014'; c.lineWidth = 1; c.strokeRect(0, -r * 0.16, L * 1.2, r * 0.32);
    orb(c, -r * 0.1, 0, r * 0.65, r * 0.65, sh(d.color, 0.1).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, a, b, cc) => '#' + [a, b, cc].map(v => (+v).toString(16).padStart(2, '0')).join('')));
    glow(c, '#ff4a2a', 8); circle(c, r * 0.2, 0, r * 0.14, '#ff6a4a'); noGlow(c);
    rivets(c, [[-L * 0.7, -Hh * 0.4], [-L * 0.7, Hh * 0.4], [L * 0.6, -Hh * 0.45], [L * 0.6, Hh * 0.45]], r * 0.06);
  };
  ART.voidtitan = (c, d, r, p) => {
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + Math.sin(p * TAU + i) * 0.2;
      c.strokeStyle = '#3a1d6a'; c.lineWidth = r * 0.16; c.lineCap = 'round';
      c.beginPath(); c.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      c.quadraticCurveTo(Math.cos(a + 0.4) * r * 1.4, Math.sin(a + 0.4) * r * 1.4, Math.cos(a + Math.sin(p * TAU + i) * 0.6) * r * 1.85, Math.sin(a + Math.sin(p * TAU + i) * 0.6) * r * 1.85); c.stroke();
    }
    ART.titan(c, d, r * 0.9, p);
    glow(c, '#b47cff', 10); c.strokeStyle = '#c9a7ff'; c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { const x = -r + i * r * 0.55; c.beginPath(); c.moveTo(x, -r * 0.5); c.lineTo(x + r * 0.15, -r * 0.3); c.lineTo(x, -r * 0.1); c.stroke(); }
    noGlow(c);
  };
  // ---- La escalera de los grandes: cada escalón con su color (d.color, d.accent) y cada vez
  // más imponente: más púas, calaveras desde el segundo, ojos que brillan en el último ----
  // púa: triángulo con la base en (x, y) que apunta hacia `ang`
  function pua(c, x, y, ang, len, w, fill, edge) {
    const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa * w / 2, py = ca * w / 2;
    shape(c, [[x + px, y + py], [x + ca * len, y + sa * len], [x - px, y - py]], fill, edge || '#0d0f12', 0.9);
  }
  // calavera vista desde arriba (la frente hacia +x, como el resto del sprite)
  function calavera(c, x, y, s, hueso, ojos) {
    c.save(); c.translate(x, y); c.rotate(Math.PI / 2);
    ell(c, 0, -s * 0.15, s, s * 0.9, 0, hueso, '#1a1410', s * 0.12);
    rrect(c, -s * 0.55, s * 0.45, s * 1.1, s * 0.55, s * 0.15, hueso, '#1a1410', s * 0.1);
    c.strokeStyle = '#1a1410'; c.lineWidth = s * 0.08;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * s * 0.25, s * 0.55); c.lineTo(i * s * 0.25, s * 0.95); c.stroke(); }
    if (ojos) glow(c, ojos, 8);
    for (const sx of [-1, 1]) ell(c, sx * s * 0.38, -s * 0.15, s * 0.27, s * 0.3, 0, ojos || '#1a1410');
    noGlow(c);
    shape(c, [[0, s * 0.12], [-s * 0.12, s * 0.35], [s * 0.12, s * 0.35]], '#1a1410');
    c.restore();
  }
  // Supertanques: el Titán con su color, torretas, púas en el casco y calaveras (d.rank 1–3)
  ART.supertank = (c, d, r, p) => {
    const k = d.rank || 1, acc = d.accent || '#ffcc33';
    for (const s of [-1, 1]) rrect(c, -r * 1.35, s * r * 1.25 - r * 0.16, r * 2.5, r * 0.32, r * 0.12, '#14171c', '#06080a', 1);
    // púas a los lados (más largas y más cuantas más alto el escalón) y un espolón delante
    const n = 3 + k * 2, largo = r * (0.25 + k * 0.12);
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
      const x = -r * 1.2 + (i + 0.5) * r * 2.3 / n;
      pua(c, x, s * r * 1.38, s * Math.PI / 2, largo, r * 0.2, '#d8dde4');
    }
    if (k >= 2) for (let i = -k + 1; i <= k - 1; i++) pua(c, r * 1.3, i * r * 0.32, 0, r * (0.3 + k * 0.1), r * 0.2, '#e8ecf0');
    ART.titan(c, d, r * 0.92, p);
    glow(c, acc, 8); c.fillStyle = acc;
    for (const s of [-1, 1]) c.fillRect(-r * 1.25, s * r * 0.86 - r * 0.05, r * 2.3, r * 0.1);   // franjas de su color
    noGlow(c);
    const pos = k === 1 ? [[-r * 0.65, 0]] : k === 2 ? [[-r * 0.7, -r * 0.5], [-r * 0.7, r * 0.5]] : [[-r * 0.75, -r * 0.55], [-r * 0.75, r * 0.55], [r * 0.85, 0]];
    for (const [x, y] of pos) {
      c.fillStyle = '#2a2f37'; c.fillRect(x, y - r * 0.07, r * 0.55, r * 0.14);
      orb(c, x, y, r * 0.26, r * 0.26, sh(d.color, 0.25));
      glow(c, acc, 6); circle(c, x, y, r * 0.07, acc); noGlow(c);
    }
    if (k >= 2) calavera(c, -r * 0.05, 0, r * (k === 3 ? 0.42 : 0.3), '#f2ead8', k === 3 ? acc : null);
    if (k === 3) for (const s of [-1, 1]) {   // cuernos y dos calaveras más
      pua(c, -r * 0.05 + r * 0.25, s * r * 0.35, s * 1.1, r * 0.55, r * 0.18, '#f2ead8');
      calavera(c, -r * 0.95, s * r * 0.15, r * 0.17, '#e0d6bf', acc);
    }
  };
  // Globos (zepelines): casco alargado de su color con costillas, aletas, góndola y motores;
  // planchas de blindaje, púas por todo el borde y calaveras cuanto más alto el escalón (0–3)
  ART.blimp = (c, d, r, p) => {
    const k = d.rank || 0, acc = d.accent || '#ffe08a', L = r * 1.45, Hh = r * 0.78, spin = p * TAU * 3;
    if (k >= 1) {   // púas alrededor del casco (antes del casco, para que asome solo la punta)
      const n = 8 + k * 6, largo = r * (0.2 + k * 0.1);
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) * TAU / n, x = Math.cos(a) * L * 0.97, y = Math.sin(a) * Hh * 0.97;
        pua(c, x, y, Math.atan2(y / (Hh * Hh), x / (L * L)), largo, r * 0.16, k >= 3 ? '#2a2030' : '#e8ecf0', k >= 3 ? acc : null);
      }
    }
    for (const s of [-1, 1]) shape(c, [[-L * 0.7, s * Hh * 0.35], [-L * 1.12, s * Hh * 1.05], [-L * 1.02, s * Hh * 0.2]], sh(d.color, -0.35), '#1a1030', 1.2);
    shape(c, [[-L * 0.75, 0], [-L * 1.15, -Hh * 0.18], [-L * 1.15, Hh * 0.18]], sh(d.color, -0.45), '#1a1030', 1);
    ell(c, 0, 0, L, Hh, 0, lg(c, 0, -Hh, 0, Hh, [sh(d.color, 0.5), d.color, sh(d.color, -0.55)]), '#1a1030', 2);
    c.strokeStyle = sh(d.color, -0.4); c.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const x = -L + i * L / 3; const h = Hh * Math.sqrt(Math.max(0, 1 - (x / L) * (x / L))); c.beginPath(); c.moveTo(x, -h); c.lineTo(x, h); c.stroke(); }
    // franjas de su color a lo largo
    glow(c, acc, 5); c.strokeStyle = acc; c.lineWidth = r * 0.07;
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(0, 0, L * 0.82, Hh * 0.62, 0, s > 0 ? 0.35 : Math.PI + 0.35, s > 0 ? Math.PI - 0.35 : TAU - 0.35); c.stroke(); }
    noGlow(c);
    for (let i = 0; i < k; i++) {   // planchas de blindaje
      const x = -L * 0.45 + i * L * 0.36;
      rrect(c, x - r * 0.14, -Hh * 0.62, r * 0.28, Hh * 1.24, r * 0.08, lg(c, x, -Hh, x, Hh, ['#c9cfd8', '#7a828e', '#3a404a']), '#15181d', 1);
    }
    rrect(c, -L * 0.3, -r * 0.16, L * 0.6, r * 0.32, r * 0.1, '#2b2140', '#0d0818', 1);   // góndola
    glow(c, acc, 6); for (let i = 0; i < 3; i++) circle(c, -L * 0.18 + i * L * 0.18, 0, r * 0.05, acc); noGlow(c);
    const mot = k >= 2 ? [[-L * 0.15, -Hh * 0.95], [-L * 0.15, Hh * 0.95], [L * 0.35, -Hh * 0.8], [L * 0.35, Hh * 0.8]] : [[-L * 0.1, -Hh * 0.95], [-L * 0.1, Hh * 0.95]];
    for (const [x, y] of mot) {
      circle(c, x, y, r * 0.14, '#3a3448', '#0d0818', 1);
      c.strokeStyle = 'rgba(230,230,255,0.7)'; c.lineWidth = r * 0.05;
      c.beginPath(); c.moveTo(x - Math.cos(spin) * r * 0.2, y - Math.sin(spin) * r * 0.08); c.lineTo(x + Math.cos(spin) * r * 0.2, y + Math.sin(spin) * r * 0.08); c.stroke();
    }
    ell(c, L * 0.78, 0, r * 0.2, r * 0.26, 0, lg(c, L * 0.65, -r * 0.3, L * 0.9, r * 0.3, ['#ffffff', acc, sh(d.color, -0.5)]), '#1a1030', 1);
    if (k >= 2) calavera(c, L * 0.42, 0, r * (k === 3 ? 0.36 : 0.26), '#f2ead8', k === 3 ? acc : null);
    if (k === 3) {   // cuernos en la proa y calaveras en las aletas
      for (const s of [-1, 1]) pua(c, L * 0.7, s * Hh * 0.45, s * 0.7, r * 0.6, r * 0.2, '#f2ead8');
      for (const s of [-1, 1]) calavera(c, -L * 0.9, s * Hh * 0.62, r * 0.15, '#e0d6bf', acc);
    }
    spec(c, -L * 0.2, -Hh * 0.45, r * 0.45, 0.35);
  };
  function maskArt(c, d, r, p, staffCol, horns) {
    const sw = Math.sin(p * TAU) * 0.15;
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i - 3) * 0.32; c.save(); c.rotate(a); leaf(c, r * 1.25, r * 0.22, ['#ff5050', '#ffd84d', '#4fe08a', '#5ad1ff'][i % 4]); c.restore(); }
    orb(c, 0, 0, r, r, d.color);
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10; circle(c, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, r * 0.1, sh(d.color, -0.35)); }
    c.save(); c.translate(r * 0.15, r * 0.95); c.rotate(-0.3 + sw);
    c.fillStyle = '#7a4a24'; c.fillRect(-r * 0.08, -r * 0.1, r * 1.3, r * 0.16);
    glow(c, staffCol, 10); circle(c, r * 1.3, 0, r * 0.22, staffCol); noGlow(c);
    c.restore();
    if (horns) for (const s of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.1, s * r * 0.45); c.quadraticCurveTo(-r * 0.3, s * r * 1.3, -r * 0.8, s * r * 1.15); c.lineTo(-r * 0.1, s * r * 0.6); c.fillStyle = lg(c, 0, 0, -r, 0, ['#f5e6c8', '#6a5a4a']); c.fill(); }
    c.save(); c.translate(r * 0.45, 0);
    shape(c, [[r * 0.5, 0], [r * 0.1, -r * 0.55], [-r * 0.3, -r * 0.45], [-r * 0.3, r * 0.45], [r * 0.1, r * 0.55]], lg(c, -r * 0.3, 0, r * 0.5, 0, ['#cdb898', '#f5e6c8']), '#3a2a1a', 1.2);
    c.fillStyle = staffCol; c.fillRect(-r * 0.25, -r * 0.05, r * 0.6, r * 0.1);
    glow(c, staffCol, 6); ell(c, r * 0.12, -r * 0.25, r * 0.1, r * 0.06, 0, '#ffffff'); ell(c, r * 0.12, r * 0.25, r * 0.1, r * 0.06, 0, '#ffffff'); noGlow(c);
    c.restore();
  }
  ART.mask = (c, d, r, p) => maskArt(c, d, r, p, '#5dff8a', false);
  ART.herald = (c, d, r, p) => {
    c.save(); c.translate(-r * 0.6, -r * 0.2);
    const wv = Math.sin(p * TAU) * r * 0.2;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-r * 1.3, -r * 0.4 + wv); c.lineTo(-r * 1.1, r * 0.1 + wv * 0.5); c.lineTo(-r * 1.4, r * 0.5 + wv); c.lineTo(0, r * 0.4); c.closePath();
    c.fillStyle = lg(c, 0, 0, -r * 1.4, 0, ['#a01030', '#ff3d6e']); c.fill(); c.restore();
    maskArt(c, d, r, p, '#ff5a2a', true);
  };
  ART.beetle = (c, d, r, p) => {
    legs(c, 3, r * 0.5, -r * 0.5, r * 0.6, r * 0.75, p, '#16301a', r * 0.12);
    for (const s of [-1, 1]) { c.save(); c.translate(r * 1.05, s * r * 0.2); c.rotate(s * (0.3 + Math.sin(p * TAU) * 0.15)); shape(c, [[0, 0], [r * 0.55, s * -r * 0.05], [r * 0.4, s * r * 0.15]], '#2a1a08', '#000', 1); c.restore(); }
    orb(c, r * 0.72, 0, r * 0.42, r * 0.42, '#1f3a1a');
    shape(c, [[r * 0.8, -r * 0.08], [r * 1.6, -r * 0.25], [r * 1.25, 0], [r * 1.6, r * 0.25], [r * 0.8, r * 0.08]], lg(c, r * 0.8, 0, r * 1.6, 0, ['#c09a30', '#ffe58a']), '#4a3000', 1);
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(r * 0.45, 0); c.quadraticCurveTo(r * 0.5, s * r * 0.95, -r * 0.4, s * r * 0.85); c.quadraticCurveTo(-r * 1.15, s * r * 0.5, -r * 1.05, 0); c.closePath();
      const g = c.createLinearGradient(0, 0, 0, s * r); g.addColorStop(0, '#9effa0'); g.addColorStop(0.35, d.color); g.addColorStop(0.75, '#1a6a5a'); g.addColorStop(1, '#0e2a20');
      c.fillStyle = g; c.fill(); c.strokeStyle = '#0a1a0c'; c.lineWidth = 2; c.stroke();
    }
    c.strokeStyle = '#ffd84d'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(r * 0.45, 0); c.lineTo(-r * 1.05, 0); c.stroke();
    for (let i = 0; i < 3; i++) { glow(c, '#ffd84d', 4); star(c, -r * 0.2 - i * r * 0.28, 0, r * 0.12, r * 0.05, 4, 0, '#fff6b0'); noGlow(c); }
    c.save(); c.translate(r * 0.62, 0);
    star(c, 0, 0, r * 0.38, r * 0.22, 6, 0, lg(c, -r * 0.3, 0, r * 0.3, 0, ['#b8860b', '#ffe58a']), '#5a3a00', 1);
    circle(c, 0, 0, r * 0.12, '#ff3a5a', '#5a0010', 0.8);
    c.restore();
    glow(c, '#ff3a2a', 5); circle(c, r * 0.95, -r * 0.2, r * 0.07, '#ff8a6a'); circle(c, r * 0.95, r * 0.2, r * 0.07, '#ff8a6a'); noGlow(c);
  };
  ART.mole = (c, d, r, p) => {
    const dig = Math.sin(p * TAU);
    for (const s of [-1, 1]) {
      c.save(); c.translate(r * 0.55, s * r * 0.7); c.rotate(s * (0.4 + dig * s * 0.35));
      ell(c, r * 0.2, 0, r * 0.32, r * 0.2, 0, '#e8b8a0', '#5a3020', 1);
      for (let i = -1; i <= 1; i++) shape(c, [[r * 0.4, i * r * 0.1 - 1], [r * 0.7, i * r * 0.12], [r * 0.4, i * r * 0.1 + 1]], '#f5f0e0', '#555', 0.5);
      c.restore();
    }
    orb(c, 0, 0, r, r * 0.9, d.color);
    for (let i = 0; i < 14; i++) { const a = Math.PI * 0.6 + i * 0.13; c.strokeStyle = sh(d.color, -0.4); c.lineWidth = 0.7; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.55); c.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.85); c.stroke(); }
    ell(c, r * 0.95, 0, r * 0.28, r * 0.22, 0, '#ff9fb4', '#8a3048', 1);
    circle(c, r * 0.55, -r * 0.3, r * 0.08, '#111'); circle(c, r * 0.55, r * 0.3, r * 0.08, '#111');
    c.save(); c.translate(-r * 0.05, 0);
    ell(c, 0, 0, r * 0.55, r * 0.6, 0, lg(c, 0, -r * 0.6, 0, r * 0.6, ['#fff27a', '#e0a000', '#8a5a00']), '#4a3000', 1.2);
    glow(c, '#fff6b0', 8); circle(c, r * 0.4, 0, r * 0.15, '#ffffff'); noGlow(c);
    c.restore();
  };
  ART.scorpion = (c, d, r, p) => {
    legs(c, 4, r * 0.45, -r * 0.55, r * 0.5, r * 0.75, p, sh(d.color, -0.5), 1.4);
    for (const s of [-1, 1]) {
      c.save(); c.translate(r * 0.7, s * r * 0.45); c.rotate(s * (0.5 + Math.sin(p * TAU) * 0.1));
      c.strokeStyle = sh(d.color, -0.5); c.lineWidth = r * 0.16; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 0.55, 0); c.stroke();
      c.translate(r * 0.7, 0);
      ell(c, 0, 0, r * 0.3, r * 0.2, 0, sg(c, 0, 0, r * 0.3, d.color), sh(d.color, -0.6), 1);
      shape(c, [[r * 0.2, -r * 0.05], [r * 0.5, -r * 0.18], [r * 0.25, -r * 0.2]], sh(d.color, -0.3)); shape(c, [[r * 0.2, r * 0.05], [r * 0.5, r * 0.18], [r * 0.25, r * 0.2]], sh(d.color, -0.3));
      c.restore();
    }
    const segs = 6;
    for (let i = segs; i >= 0; i--) {
      const k = i / segs, a = Math.PI + (k - 0.5) * 1.4 + Math.sin(p * TAU) * 0.25 * k;
      const rr = r * (0.75 + k * 0.6);
      const x = Math.cos(a) * rr * (1 - k * 0.55) - r * 0.3 * k, y = Math.sin(a) * rr * 0.5;
      if (i === segs) { glow(c, '#ff2a2a', 6); shape(c, [[x - r * 0.1, y - r * 0.12], [x + r * 0.35, y], [x - r * 0.1, y + r * 0.12]], '#ff4a3a', '#5a0000', 1); noGlow(c); }
      else circle(c, x, y, r * (0.28 - k * 0.06), sg(c, x, y, r * 0.3, d.color), sh(d.color, -0.6), 1);
    }
    for (let i = 0; i < 3; i++) ell(c, -r * 0.3 + i * r * 0.38, 0, r * 0.32, r * 0.55, 0, sg(c, -r * 0.3 + i * r * 0.38, 0, r * 0.5, d.color), sh(d.color, -0.6), 1.2);
    eyes(c, r * 0.65, r * 0.18, r * 0.12, { glow: '#ff3a3a' });
  };
  ART.worm = (c, d, r, p) => {
    const jaw = Math.sin(p * TAU) * 0.25;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + jaw; c.save(); c.rotate(a); shape(c, [[r * 0.7, -r * 0.18], [r * 1.25, 0], [r * 0.7, r * 0.18]], '#e8d8b8', '#5a4020', 1); c.restore(); }
    orb(c, 0, 0, r * 0.95, r * 0.95, d.color);
    for (let i = 0; i < 3; i++) circle(c, 0, 0, r * (0.85 - i * 0.12), null, sh(d.color, -0.4), 1);
    circle(c, r * 0.15, 0, r * 0.5, sg(c, r * 0.15, 0, r * 0.5, '#4a1a10', 0.1, -0.6));
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10; c.save(); c.translate(r * 0.15, 0); c.rotate(a); shape(c, [[r * 0.48, -r * 0.06], [r * 0.25, 0], [r * 0.48, r * 0.06]], '#fff'); c.restore(); }
    glow(c, '#ffb040', 6); circle(c, r * 0.15, 0, r * 0.12, '#ffcf80'); noGlow(c);
  };
  ART.wormSeg = (c, d, r, p) => {
    orb(c, 0, 0, r * 0.9, r * 0.9, d.color);
    c.strokeStyle = sh(d.color, -0.45); c.lineWidth = 1.5;
    for (const s of [-1, 1]) { c.beginPath(); c.arc(0, 0, r * 0.7, s > 0 ? -0.6 : Math.PI - 0.6, s > 0 ? 0.6 : Math.PI + 0.6); c.stroke(); }
    for (const s of [-1, 1]) shape(c, [[-r * 0.2, s * r * 0.7], [0, s * r * 1.15], [r * 0.2, s * r * 0.7]], '#e8d8b8', '#5a4020', 0.8);
  };
  function golemArt(c, d, r, p, boss) {
    const sw = Math.sin(p * TAU);
    for (const s of [-1, 1]) {
      c.save(); c.translate(r * (0.35 + sw * s * 0.15), s * r * 0.95);
      poly(c, 0, 0, r * 0.38, 6, 0.3, sg(c, 0, 0, r * 0.38, '#8a95a3'), '#2a3038', 1.3);
      c.restore();
    }
    const pts = []; for (let i = 0; i < 9; i++) { const a = i * TAU / 9, rr = r * (0.9 + ((i * 37) % 7) / 40); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    shape(c, pts, sg(c, 0, 0, r, '#9aa6b4'), '#2a3038', 1.8);
    c.strokeStyle = '#4a5560'; c.lineWidth = 1; c.beginPath(); c.moveTo(-r * 0.6, -r * 0.2); c.lineTo(-r * 0.1, r * 0.1); c.lineTo(-r * 0.3, r * 0.6); c.stroke();
    const n = boss ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i - (n - 1) / 2) * (boss ? 0.42 : 0.55), rr = r * 0.55;
      c.save(); c.translate(Math.cos(a) * rr, Math.sin(a) * rr); c.rotate(a);
      shape(c, [[0, -r * 0.16], [r * (boss ? 0.95 : 0.65), 0], [0, r * 0.16]], lg(c, 0, -r * 0.16, 0, r * 0.16, ['#ffffff', d.color, '#3a8ad0']), '#1a4a7a', 1);
      c.restore();
    }
    eyes(c, r * 0.55, r * 0.28, r * 0.17, { glow: '#7af0ff' });
    if (boss) star(c, -r * 0.05, 0, r * 0.35, r * 0.16, 6, 0, 'rgba(220,245,255,0.9)', '#3a8ad0', 1);
  }
  ART.golem = (c, d, r, p) => golemArt(c, d, r, p, !!d.boss);
  ART.crystal = (c, d, r, p) => {
    glow(c, '#9fe8ff', 12);
    shape(c, [[r * 1.2, 0], [0, -r * 0.8], [-r * 1.2, 0], [0, r * 0.8]], 'rgba(200,240,255,0.85)', '#6fc0e8', 1.2); noGlow(c);
    shape(c, [[r * 1.2, 0], [0, -r * 0.8], [0, 0]], 'rgba(255,255,255,0.9)');
    shape(c, [[-r * 1.2, 0], [0, r * 0.8], [0, 0]], 'rgba(120,190,230,0.85)');
    shape(c, [[0, -r * 0.8], [-r * 1.2, 0], [0, 0]], 'rgba(180,225,250,0.85)');
    circle(c, 0, 0, r * 0.25, '#ffffff');
    for (let i = 0; i < 3; i++) { const a = p * TAU + i * TAU / 3; poly(c, Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, r * 0.22, 4, a, 'rgba(220,250,255,0.9)', '#6fc0e8', 0.8); }
  };
  ART.yeti = (c, d, r, p) => {
    const sw = Math.sin(p * TAU);
    for (const s of [-1, 1]) { c.save(); c.translate(r * (0.4 + sw * s * 0.2), s * r * 0.95); orb(c, 0, 0, r * 0.32, r * 0.32, '#e8f0ff'); for (let k = -1; k <= 1; k++) shape(c, [[r * 0.25, k * r * 0.1 - 1], [r * 0.5, k * r * 0.12], [r * 0.25, k * r * 0.1 + 1]], '#2a3a5a'); c.restore(); }
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14, x = Math.cos(a) * r * 0.82, y = Math.sin(a) * r * 0.82; circle(c, x, y, r * 0.32, sg(c, x, y, r * 0.32, '#e6eeff')); }
    orb(c, 0, 0, r * 0.88, r * 0.88, '#f2f6ff', 0);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.1, s * r * 0.4); c.quadraticCurveTo(-r * 0.2, s * r * 1.0, -r * 0.65, s * r * 0.9); c.lineTo(-r * 0.05, s * r * 0.55); c.fillStyle = lg(c, 0, 0, -r * 0.6, 0, ['#d8c8a8', '#6a5a48']); c.fill(); }
    ell(c, r * 0.45, 0, r * 0.42, r * 0.5, 0, sg(c, r * 0.45, 0, r * 0.5, '#7aa0d8'), '#2a3a6a', 1);
    eyes(c, r * 0.5, r * 0.2, r * 0.13, { pupil: '#1a2a8a' });
    shape(c, [[r * 0.82, -r * 0.18], [r * 0.95, -r * 0.08], [r * 0.82, -r * 0.02]], '#fff'); shape(c, [[r * 0.82, r * 0.18], [r * 0.95, r * 0.08], [r * 0.82, r * 0.02]], '#fff');
  };
  ART.lizard = (c, d, r, p) => {
    const w = Math.sin(p * TAU);
    c.strokeStyle = d.color; c.lineCap = 'round';
    c.lineWidth = r * 0.45; c.beginPath(); c.moveTo(-r * 0.6, 0); c.quadraticCurveTo(-r * 1.4, w * r * 0.8, -r * 2.2, w * r * 0.2); c.stroke();
    c.lineWidth = r * 0.2; c.strokeStyle = sh(d.color, -0.3); c.beginPath(); c.moveTo(-r * 1.8, w * r * 0.4); c.lineTo(-r * 2.3, w * r * 0.15); c.stroke();
    for (const [x, ph] of [[r * 0.45, 0], [-r * 0.45, Math.PI]]) for (const s of [-1, 1]) {
      const sw = Math.sin(p * TAU + ph + (s > 0 ? Math.PI : 0)) * r * 0.3;
      c.strokeStyle = sh(d.color, -0.35); c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(x, s * r * 0.3); c.lineTo(x + sw, s * r * 0.95); c.stroke();
      circle(c, x + sw, s * r * 0.95, r * 0.12, sh(d.color, -0.35));
    }
    ell(c, 0, 0, r * 1.15, r * 0.55, 0, sg(c, 0, 0, r, d.color), sh(d.color, -0.65), 1.3);
    for (let i = 0; i < 4; i++) circle(c, -r * 0.6 + i * r * 0.35, (i % 2 ? 1 : -1) * r * 0.2, r * 0.1, '#5a1a08');
    glow(c, '#ffb020', 8);
    for (let i = 0; i < 5; i++) { const x = -r * 0.8 + i * r * 0.38, h = r * (0.35 + 0.2 * Math.sin(p * TAU * 2 + i)); shape(c, [[x - r * 0.14, 0], [x, -h * 1.3], [x + r * 0.14, 0]], i % 2 ? '#ffd84d' : '#ff8a1a'); }
    noGlow(c);
    ell(c, r * 1.15, 0, r * 0.45, r * 0.38, 0, sg(c, r * 1.15, 0, r * 0.45, d.color), sh(d.color, -0.65), 1.2);
    eyes(c, r * 1.2, r * 0.22, r * 0.11, { glow: '#fff27a' });
  };
  ART.rock = (c, d, r, p) => {
    glow(c, '#ff6a1a', 10);
    const pts = []; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2, rr = r * (0.88 + ((i * 53) % 9) / 40); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    shape(c, pts, sg(c, 0, 0, r, '#4a2418', 0.2, -0.6), '#1a0804', 1.8); noGlow(c);
    const pulse = 0.6 + 0.4 * Math.sin(p * TAU);
    glow(c, '#ffb040', 6);
    c.strokeStyle = `rgba(255,${150 + pulse * 80 | 0},40,1)`; c.lineWidth = 1.6; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-r * 0.7, -r * 0.3); c.lineTo(-r * 0.2, -r * 0.05); c.lineTo(r * 0.3, -r * 0.45); c.moveTo(-r * 0.2, -r * 0.05); c.lineTo(-r * 0.1, r * 0.55); c.lineTo(r * 0.5, r * 0.3); c.stroke();
    circle(c, -r * 0.2, -r * 0.05, r * 0.18 * pulse + 1, '#ffcf60');
    noGlow(c);
    eyes(c, r * 0.5, r * 0.28, r * 0.15, { glow: '#ffd060' });
  };
  ART.bird = (c, d, r, p) => {
    const f = Math.cos(p * TAU);
    for (const s of [-1, 1]) {
      c.save(); c.scale(1, s);
      c.beginPath(); c.moveTo(r * 0.3, -r * 0.2);
      c.quadraticCurveTo(-r * 0.2, -r * (1.2 + f * 0.4), -r * 0.9, -r * (1.5 + f * 0.5));
      c.lineTo(-r * 0.6, -r * 0.9); c.lineTo(-r * 0.95, -r * (1.0 + f * 0.2)); c.lineTo(-r * 0.4, -r * 0.3); c.closePath();
      c.fillStyle = lg(c, 0, 0, 0, -r * 1.5, ['#ff5a1a', '#ff9a3a', '#ffe08a']); c.fill(); c.strokeStyle = '#6a1a00'; c.lineWidth = 1; c.stroke();
      c.restore();
    }
    for (let i = 0; i < 3; i++) shape(c, [[-r * 0.5, 0], [-r * (1.3 + i * 0.15), (i - 1) * r * 0.35], [-r * 0.5, (i - 1) * r * 0.1 + 1]], i === 1 ? '#ffd84d' : '#ff6a1a');
    ell(c, 0, 0, r * 0.75, r * 0.38, 0, sg(c, 0, 0, r * 0.7, d.color), '#5a1000', 1.2);
    circle(c, r * 0.6, 0, r * 0.32, sg(c, r * 0.6, 0, r * 0.32, d.color), '#5a1000', 1);
    shape(c, [[r * 0.85, -r * 0.1], [r * 1.25, 0], [r * 0.85, r * 0.1]], '#ffd84d', '#6a4a00', 0.8);
    eyes(c, r * 0.68, r * 0.14, r * 0.09, { glow: '#fff6b0' });
  };
  ART.phoenix = (c, d, r, p) => {
    const f = Math.cos(p * TAU);
    glow(c, '#ff8a1a', 16);
    for (let i = 0; i < 5; i++) { const y = (i - 2) * r * 0.22; c.beginPath(); c.moveTo(-r * 0.4, y * 0.3); c.quadraticCurveTo(-r * 1.4, y + Math.sin(p * TAU + i) * r * 0.2, -r * (2.2 + (i % 2) * 0.2), y * 1.6); c.lineWidth = r * 0.14; c.strokeStyle = ['#ff3a0a', '#ff8a1a', '#ffd84d', '#ff8a1a', '#ff3a0a'][i]; c.lineCap = 'round'; c.stroke(); }
    for (const s of [-1, 1]) {
      c.save(); c.scale(1, s);
      for (let k = 0; k < 3; k++) {
        c.beginPath(); c.moveTo(r * 0.2, -r * 0.2);
        c.quadraticCurveTo(-r * 0.1 - k * r * 0.2, -r * (1.4 + f * 0.5), -r * (0.6 + k * 0.45), -r * (2.1 + f * 0.6 - k * 0.3));
        c.lineTo(-r * (0.3 + k * 0.3), -r * 0.35); c.closePath();
        c.fillStyle = lg(c, 0, 0, 0, -r * 2, [['#c01a00', '#ff5a1a', '#ff9a3a'][k], ['#ff9a3a', '#ffd84d', '#fff6b0'][k]]); c.fill();
      }
      c.restore();
    }
    noGlow(c);
    ell(c, 0, 0, r * 0.85, r * 0.42, 0, sg(c, 0, 0, r * 0.8, d.color, 0.6), '#5a1000', 1.4);
    circle(c, r * 0.75, 0, r * 0.36, sg(c, r * 0.75, 0, r * 0.36, '#ff7a1a', 0.6), '#5a1000', 1);
    for (let i = 0; i < 3; i++) shape(c, [[r * 0.6, 0], [r * (0.35 - i * 0.1), (i - 1) * r * 0.35 - r * 0.05], [r * 0.5, (i - 1) * r * 0.1]], '#ffd84d');
    shape(c, [[r * 1.02, -r * 0.12], [r * 1.45, 0], [r * 1.02, r * 0.12]], '#ffe58a', '#6a4a00', 0.8);
    eyes(c, r * 0.85, r * 0.16, r * 0.1, { glow: '#ffffff' });
  };
  ART.eye = (c, d, r, p) => {
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; c.save(); c.rotate(a); c.fillStyle = '#2a2240'; c.fillRect(r * 0.8, -r * 0.08, r * 0.5, r * 0.16); glow(c, '#ff3a8a', 6); circle(c, r * 1.35, 0, r * 0.1, '#ff6aa0'); noGlow(c); c.restore(); }
    orb(c, 0, 0, r, r, d.color);
    c.strokeStyle = sh(d.color, 0.4); c.lineWidth = 1; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, r * 0.82, i * 2.1, i * 2.1 + 1.2); c.stroke(); }
    circle(c, r * 0.2, 0, r * 0.58, '#e8e0ff', '#1a1030', 1.2);
    const look = Math.sin(p * TAU) * r * 0.08;
    glow(c, '#b47cff', 8); circle(c, r * 0.35, look, r * 0.32, sg(c, r * 0.35, look, r * 0.32, '#9a5aff', 0.5)); noGlow(c);
    circle(c, r * 0.42, look, r * 0.13, '#0a0010');
    circle(c, r * 0.28, look - r * 0.12, r * 0.07, '#ffffff');
  };
  ART.star = (c, d, r, p) => {
    glow(c, d.color, 10);
    star(c, 0, 0, r * 1.25, r * 0.55, 5, 0, sg(c, 0, 0, r * 1.1, d.color, 0.5), sh(d.color, -0.6), 1.3);
    noGlow(c);
    star(c, 0, 0, r * 0.75, r * 0.33, 5, Math.PI / 5, sg(c, 0, 0, r * 0.7, '#e8c8ff', 0.6), sh(d.color, -0.3), 1);
    star(c, 0, 0, r * 0.38, r * 0.17, 5, 0, '#ffffff');
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); c.stroke(); }
  };
  ART.voidboss = (c, d, r, p) => {
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + Math.PI / 10, wv = Math.sin(p * TAU + i * 1.3);
      c.strokeStyle = lg(c, 0, 0, Math.cos(a) * r * 2, Math.sin(a) * r * 2, ['#4a1d8a', '#1a0a3a']); c.lineWidth = r * 0.18; c.lineCap = 'round';
      c.beginPath(); c.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      c.bezierCurveTo(Math.cos(a + 0.3) * r * 1.3, Math.sin(a + 0.3) * r * 1.3, Math.cos(a - 0.3 + wv * 0.3) * r * 1.6, Math.sin(a - 0.3 + wv * 0.3) * r * 1.6, Math.cos(a + wv * 0.5) * r * 1.95, Math.sin(a + wv * 0.5) * r * 1.95);
      c.stroke();
      glow(c, '#ff2ad4', 4); circle(c, Math.cos(a + wv * 0.5) * r * 1.95, Math.sin(a + wv * 0.5) * r * 1.95, r * 0.06, '#ff7ae4'); noGlow(c);
    }
    glow(c, '#8a4aff', 16); orb(c, 0, 0, r, r, d.color); noGlow(c);
    c.strokeStyle = '#a07aff'; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.beginPath(); c.arc(0, 0, r * 0.88, a, a + 0.6); c.stroke(); }
    const open = 0.35 + 0.25 * Math.sin(p * TAU);
    c.save(); c.translate(r * 0.35, 0);
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r * 0.62, -open, open); c.closePath(); c.fillStyle = '#12001f'; c.fill();
    for (let i = 0; i < 6; i++) { const a = -open + (i + 0.5) * open * 2 / 6; shape(c, [[Math.cos(a - 0.08) * r * 0.62, Math.sin(a - 0.08) * r * 0.62], [Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35], [Math.cos(a + 0.08) * r * 0.62, Math.sin(a + 0.08) * r * 0.62]], '#f0e0ff'); }
    c.restore();
    for (const [x, y, s] of [[-r * 0.25, -r * 0.45, 0.16], [-r * 0.25, r * 0.45, 0.16], [-r * 0.55, 0, 0.2], [0.05 * r, -r * 0.7, 0.1], [0.05 * r, r * 0.7, 0.1]]) {
      glow(c, '#ff2ad4', 8); circle(c, x, y, r * s, '#ff9ae8'); noGlow(c); circle(c, x + r * s * 0.2, y, r * s * 0.45, '#2a0030');
    }
  };

  const EXT = { sprout: 1.55, spark: 1.95, ember: 1.95, shell: 1.6, moth: 2.0, bee: 1.8, knight: 1.45, ghost: 2.0, mirage: 2.0, wisp: 2.0, hex: 1.55, magnet: 1.55,
    jelly: 1.35, carrier: 1.75, titan: 1.85, voidtitan: 2.05, supertank: 2.15, blimp: 2.05, moss: 1.45, mask: 1.8, herald: 2.0, beetle: 1.95, mole: 1.55, scorpion: 2.25, worm: 1.4,
    wormSeg: 1.3, golem: 1.65, crystal: 1.75, yeti: 1.55, lizard: 2.45, rock: 1.3, bird: 2.0, phoenix: 2.5, eye: 1.6, star: 1.45, voidboss: 2.1 };
  const SPIN = { crystal: 1.4, star: 1.6 };
  const FR = 8;
  const ESPR = {};
  function enemySprite(d, f, shapeOverride) {
    const shp = shapeOverride || d.shape;
    const key = d.id + ':' + shp + ':' + f;
    let s = ESPR[key];
    if (s) return s;
    const ext = EXT[shp] || 1.6, res = d.r >= 28 ? 2 : 2.6;
    const half = d.r * ext + 3, size = Math.ceil(half * 2 * res);
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d');
    c.translate(size / 2, size / 2); c.scale(res, res);
    RS = res;
    c.lineJoin = 'round';
    (ART[shp] || ART.sprout)(c, d, d.r, f / FR);
    RS = 1;
    return (ESPR[key] = { c: cv, half });
  }
  function blit(ctx, s) { ctx.drawImage(s.c, -s.half, -s.half, s.half * 2, s.half * 2); }
  function drawEnemyIcon(ctx, type, size) {
    const d = PD.ENEMIES[type];
    const s = enemySprite(d, 1);
    const k = size / (s.half * 2) * 1.12;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(k, k);
    blit(ctx, s);
    ctx.restore();
  }

  // ========================= ARTE DE TORRES ==============================
  const TRES = 3;
  const TSPR = {};
  function gems(c, s, tiers) {
    for (let p = 0; p < 2; p++) for (let i = 0; i < Math.max(4, tiers[p]); i++) {   // el 5.º, solo en héroes
      const a = p ? (Math.PI * 0.5 - 0.42 - i * 0.3) : (Math.PI * 0.5 + 0.42 + i * 0.3);
      const x = Math.cos(a) * (s + 1.5), y = Math.sin(a) * (s + 1.5);
      if (i > 3) { glow(c, '#ff5ad1', 7); poly(c, x, y, 3, 4, 0, '#ff9ae8', '#8a1a6a', 0.8); noGlow(c); }
      else if (i < tiers[p]) { glow(c, p ? '#5ad1ff' : '#ffcf4d', 4); poly(c, x, y, 2.3, 4, 0, p ? '#8ae8ff' : '#ffe58a', p ? '#1a5a88' : '#8a5a00', 0.7); noGlow(c); }
      else circle(c, x, y, 1.5, 'rgba(0,0,0,0.5)');
    }
  }
  function baseStone(c, s, rim) {
    circle(c, 0, 0, s + 4, lg(c, 0, -s, 0, s, ['#8f8a80', '#5d5850', '#3a3630']), '#1e1c18', 1.6);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.8;
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + 0.15; c.beginPath(); c.moveTo(Math.cos(a) * (s - 1), Math.sin(a) * (s - 1)); c.lineTo(Math.cos(a) * (s + 4), Math.sin(a) * (s + 4)); c.stroke(); }
    circle(c, 0, 0, s - 1, lg(c, 0, -s, 0, s, ['#6e695f', '#4a463e']), rim, 1.6);
    circle(c, -s * 0.3, -s * 0.5, s * 0.25, 'rgba(255,255,255,0.06)');
  }
  function baseMetal(c, s, rim) {
    poly(c, 0, 0, s + 4.5, 8, Math.PI / 8, lg(c, 0, -s, 0, s, ['#a9b3c0', '#5f6873', '#2e343b']), '#14181c', 1.6);
    poly(c, 0, 0, s + 1, 8, Math.PI / 8, lg(c, 0, -s, 0, s, ['#4a525c', '#30363d']), rim, 1.4);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; circle(c, Math.cos(a) * (s + 2.6), Math.sin(a) * (s + 2.6), 0.9, '#d8dee6'); }
  }
  function baseArcane(c, s, rim) {
    circle(c, 0, 0, s + 4, lg(c, 0, -s, 0, s, ['#3a3150', '#1e1830']), '#0c0818', 1.6);
    circle(c, 0, 0, s + 2.2, null, '#c9a24a', 1.4);
    c.strokeStyle = rgba(rim, 0.7); c.lineWidth = 0.7;
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; c.save(); c.rotate(a); c.beginPath(); c.moveTo(s - 1, -1.2); c.lineTo(s + 1, 0); c.lineTo(s - 1, 1.2); c.stroke(); c.restore(); }
    circle(c, 0, 0, s - 1.5, '#1a1428', rim, 1);
  }
  function baseWood(c, s, rim) {
    circle(c, 0, 0, s + 4, lg(c, 0, -s, 0, s, ['#9a6a3a', '#6a4422', '#3a2410']), '#20140a', 1.6);
    for (let i = 1; i < 4; i++) circle(c, 0, 0, s + 4 - i * 2.2, null, 'rgba(40,20,5,0.35)', 0.6);
    circle(c, 0, 0, s - 1, lg(c, 0, -s, 0, s, ['#7a5230', '#5a3a1e']), rim, 1.4);
  }
  function baseSoil(c, s) {
    circle(c, 0, 0, s + 4, lg(c, 0, -s, 0, s, ['#8f8a80', '#5d5850']), '#1e1c18', 1.6);
    circle(c, 0, 0, s + 1, sg(c, 0, 0, s, '#5a3a22', 0.15, -0.4));
    c.strokeStyle = 'rgba(30,15,5,0.6)'; c.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-s * 0.8, i * s * 0.32); c.lineTo(s * 0.8, i * s * 0.32); c.stroke(); }
  }

  // bumerán en V (también se usa en vuelo)
  function rangShape(c, x, y, sz, rot, col, edge) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath(); c.moveTo(-sz * 0.9, -sz * 0.55); c.quadraticCurveTo(0, -sz * 0.2, sz * 0.25, 0); c.quadraticCurveTo(0, sz * 0.2, -sz * 0.9, sz * 0.55);
    c.quadraticCurveTo(-sz * 0.2, 0, -sz * 0.9, -sz * 0.55); c.closePath();
    c.fillStyle = lg(c, 0, -sz * 0.5, 0, sz * 0.5, [sh(col, 0.4), col, sh(col, -0.45)]); c.fill();
    c.strokeStyle = edge; c.lineWidth = 1; c.stroke();
    c.restore();
  }
  // disco de sierra dentado
  function sawBlade(c, R, col, hub) {
    c.beginPath();
    const n = 14;
    for (let i = 0; i < n; i++) { const a = i * TAU / n; c.lineTo(Math.cos(a) * R, Math.sin(a) * R); c.lineTo(Math.cos(a + TAU / n * 0.55) * R * 0.78, Math.sin(a + TAU / n * 0.55) * R * 0.78); }
    c.closePath(); c.fillStyle = lg(c, -R, -R, R, R, ['#ffffff', col, sh(col, -0.45)]); c.fill(); c.strokeStyle = '#2a2f37'; c.lineWidth = 1; c.stroke();
    circle(c, 0, 0, R * 0.62, null, 'rgba(40,46,56,0.35)', 0.8);
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3; circle(c, Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.4, R * 0.1, 'rgba(30,34,40,0.6)'); }
    circle(c, 0, 0, R * 0.24, sg(c, 0, 0, R * 0.24, hub), '#0c0e12', 1);
  }
  // guadaña curva: desde r0 hasta r1 a lo largo del eje x
  function scythe(c, r0, r1, col, arcane) {
    c.strokeStyle = '#2a1a3a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(r0, 0); c.lineTo(r1 * 0.82, 0); c.stroke();
    if (arcane) glow(c, '#c07bff', 6);
    c.beginPath(); c.moveTo(r1 * 0.78, 0); c.quadraticCurveTo(r1 * 1.02, -r1 * 0.12, r1 * 0.92, -r1 * 0.42); c.quadraticCurveTo(r1 * 0.86, -r1 * 0.16, r1 * 0.62, -r1 * 0.02); c.closePath();
    c.fillStyle = lg(c, r1 * 0.6, 0, r1, -r1 * 0.4, ['#ffffff', col, sh(col, -0.4)]); c.fill(); c.strokeStyle = sh(col, -0.6); c.lineWidth = 0.7; c.stroke();
    noGlow(c);
  }

  // ---- Héroes: pedestal dorado y una figura vista desde arriba que mira al objetivo (+x) ----
  function heroBase(c, s, col) {
    poly(c, 0, 0, s + 5, 6, 0, lg(c, 0, -s, 0, s, ['#fff1a8', '#d9a520', '#7a5208']), '#3a2604', 1.6);
    poly(c, 0, 0, s + 1.5, 6, 0, lg(c, 0, -s, 0, s, ['#3a3040', '#1c1624']), col, 1.6);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; circle(c, Math.cos(a) * (s + 3.2), Math.sin(a) * (s + 3.2), 1.2, '#fff6c8', '#7a5208', 0.5); }
    c.strokeStyle = rgba(col, 0.55); c.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55); c.lineTo(Math.cos(a) * (s - 1), Math.sin(a) * (s - 1)); c.stroke(); }
  }
  // o: { cape, armor, skin, hair } y weapon(c, s, t) dibujado delante
  function heroFigure(c, s, t, o) {
    ell(c, -s * 0.28, 0, s * 0.5, s * 0.78, 0, lg(c, -s * 0.8, 0, s * 0.2, 0, [shade(o.cape, -0.5), o.cape, shade(o.cape, 0.25)]), shade(o.cape, -0.6), 1);
    ell(c, 0, 0, s * 0.4, s * 0.62, 0, lg(c, 0, -s * 0.6, 0, s * 0.6, [shade(o.armor, 0.35), o.armor, shade(o.armor, -0.45)]), shade(o.armor, -0.65), 1);
    circle(c, s * 0.12, -s * 0.56, s * 0.17, o.skin, shade(o.skin, -0.5), 0.8);
    circle(c, s * 0.12, s * 0.56, s * 0.17, o.skin, shade(o.skin, -0.5), 0.8);
    o.weapon(c, s, t);
    circle(c, s * 0.06, 0, s * 0.31, sg(c, s * 0.06, 0, s * 0.31, o.hair), shade(o.hair, -0.6), 1);
    if (o.head) o.head(c, s, t);
  }
  const HERO_ART = {
    heroeprado: (c, s, t) => heroFigure(c, s, t, {
      cape: '#3f9a35', armor: '#8a6a3a', skin: '#f0c89a', hair: '#6fdc5a',
      weapon(c, s, t) {
        // arco largo con flecha de semilla
        c.strokeStyle = '#6a4422'; c.lineWidth = 2.4; c.beginPath(); c.arc(s * 0.2, 0, s * 0.85, -1.05, 1.05); c.stroke();
        c.strokeStyle = '#f0f0d0'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(s * 0.2 + Math.cos(-1.05) * s * 0.85, Math.sin(-1.05) * s * 0.85); c.lineTo(s * 0.2 + Math.cos(1.05) * s * 0.85, Math.sin(1.05) * s * 0.85); c.stroke();
        c.fillStyle = '#c8a060'; c.fillRect(s * 0.1, -0.8, s * 1.15, 1.6);
        if (t[1] >= 3) glow(c, '#c8f08a', 6);
        leaf(c, s * 1.45, s * 0.22, t[1] >= 4 ? '#ff9ad0' : '#7ae05a'); noGlow(c);
      },
      head(c, s, t) {
        for (let i = 0; i < 5; i++) { c.save(); c.translate(s * 0.02, 0); c.rotate(Math.PI + (i - 2) * 0.5); leaf(c, s * 0.5, s * 0.16, i % 2 ? '#5fbf4a' : '#9be36a'); c.restore(); }
        if (t[0] >= 3) { glow(c, '#ffcf4d', 6); star(c, s * 0.06, 0, s * 0.16, s * 0.07, 5, 0, '#fff1a8'); noGlow(c); }
      }
    }),
    heroedunas: (c, s, t) => heroFigure(c, s, t, {
      cape: '#2a6ad8', armor: '#e8c060', skin: '#c88a50', hair: '#1a2a6a',
      weapon(c, s, t) {
        // báculo con disco solar
        c.fillStyle = lg(c, 0, -1.2, 0, 1.2, ['#fff1a8', '#a8740a']); c.fillRect(s * 0.1, s * 0.5, s * 1.1, 2.2);
        const R = s * (0.3 + t[0] * 0.04);
        glow(c, '#ffd84d', 10);
        circle(c, s * 1.2, s * 0.55, R, sg(c, s * 1.2, s * 0.55, R, '#ffd84d', 0.6, -0.3), '#a86a00', 0.8);
        noGlow(c);
        star(c, s * 1.2, s * 0.55, R * 1.5, R * 1.05, 10, 0, null, '#ffe58a', 0.8);
      },
      head(c, s, t) {
        // tocado de faraón a rayas
        c.save(); c.translate(s * 0.06, 0);
        for (let i = -3; i <= 3; i++) { c.strokeStyle = i % 2 ? '#ffcf4d' : '#2a4aa8'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-s * 0.32, i * s * 0.08); c.lineTo(s * 0.18, i * s * 0.08 * 0.6); c.stroke(); }
        circle(c, s * 0.2, 0, s * 0.09, '#3ad0ff', '#0a3a6a', 0.6);
        c.restore();
      }
    }),
    heroeglaciar: (c, s, t) => heroFigure(c, s, t, {
      cape: '#5ab8e8', armor: '#dff4ff', skin: '#f6e2d6', hair: '#f0f8ff',
      weapon(c, s, t) {
        // lanza de hielo
        const len = s * (1.5 + t[1] * 0.08);
        c.fillStyle = lg(c, 0, -1.2, 0, 1.2, ['#e8fbff', '#5a8aa8']); c.fillRect(s * 0.05, s * 0.52, len, 2.2);
        glow(c, '#9be7ff', t[1] >= 3 ? 10 : 5);
        shape(c, [[s * 0.05 + len, s * 0.52 - 3.5], [s * 0.05 + len + s * 0.55, s * 0.52 + 1.1], [s * 0.05 + len, s * 0.52 + 5.7]], lg(c, len, 0, len + s * 0.5, 0, ['#ffffff', '#9be7ff', '#3a8ac8']), '#1a4a6a', 0.7);
        noGlow(c);
      },
      head(c, s, t) {
        // corona de hielo
        const n = t[0] >= 3 ? 7 : 5;
        glow(c, '#bff0ff', 6);
        for (let i = 0; i < n; i++) { const a = Math.PI + (i - (n - 1) / 2) * 0.42; c.save(); c.translate(s * 0.06, 0); c.rotate(a); shape(c, [[s * 0.22, -1.4], [s * 0.5, 0], [s * 0.22, 1.4]], '#e8fbff', '#5a9ac8', 0.5); c.restore(); }
        noGlow(c);
      }
    }),
    heroecaldera: (c, s, t) => heroFigure(c, s, t, {
      cape: '#8a2a10', armor: '#4a3a36', skin: '#d89a70', hair: '#2a2220',
      weapon(c, s, t) {
        // martillo de guerra
        c.fillStyle = lg(c, 0, -1.4, 0, 1.4, ['#a87a4a', '#4a2a10']); c.fillRect(s * 0.1, s * 0.48, s * 1.05, 2.8);
        const hw = s * (0.42 + t[0] * 0.04), hx = s * 1.05;
        if (t[0] >= 3) glow(c, '#ff7a2f', 10);
        rrect(c, hx, s * 0.48 + 1.4 - hw, s * 0.42, hw * 2, 2, lg(c, hx, 0, hx + s * 0.42, 0, ['#8a929e', '#3a4048', '#1a1e24']), '#0c0e12', 1);
        noGlow(c);
        if (t[0] >= 3) { c.strokeStyle = '#ffb34a'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx + 2, s * 0.48 - hw * 0.6); c.lineTo(hx + s * 0.3, s * 0.48 + hw * 0.4); c.stroke(); }
      },
      head(c, s, t) {
        // yelmo con cuernos y grietas de lava
        c.save(); c.translate(s * 0.06, 0);
        for (const k of [-1, 1]) shape(c, [[0, k * s * 0.22], [-s * 0.15, k * s * 0.55], [s * 0.12, k * s * 0.28]], '#e8dcc0', '#5a4a30', 0.7);
        circle(c, 0, 0, s * 0.24, lg(c, 0, -s * 0.24, 0, s * 0.24, ['#6a6a72', '#2a2a30']), '#0c0c10', 0.8);
        glow(c, '#ff7a2f', 6); c.strokeStyle = '#ff9a3a'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(s * 0.18, 0); c.lineTo(-s * 0.05, s * 0.06); c.lineTo(-s * 0.15, -s * 0.05); c.stroke(); noGlow(c);
        c.restore();
      }
    }),
    heroevacio: (c, s, t) => heroFigure(c, s, t, {
      cape: '#3a1670', armor: '#5a2a9a', skin: '#e6d0f0', hair: '#1a0a30',
      weapon(c, s, t) {
        // orbe arcano en la mano y estrellas que la rodean
        glow(c, '#c07bff', 12);
        circle(c, s * 0.75, s * 0.5, s * 0.24, sg(c, s * 0.75, s * 0.5, s * 0.24, '#e0b0ff', 0.6, -0.4), '#5a2a9a', 0.8);
        noGlow(c);
        const n = 2 + Math.min(4, t[1]);
        for (let i = 0; i < n; i++) { const a = i * TAU / n; star(c, s * 0.75 + Math.cos(a) * s * 0.42, s * 0.5 + Math.sin(a) * s * 0.42, 2.2, 0.9, 4, a, '#fff6ff'); }
      },
      head(c, s, t) {
        // capucha con ojos que brillan
        c.save(); c.translate(s * 0.06, 0);
        circle(c, 0, 0, s * 0.3, null, '#8a5bff', 1.2);
        glow(c, '#ff9ae8', 6);
        circle(c, s * 0.16, -s * 0.09, 1.3, '#ff9ae8'); circle(c, s * 0.16, s * 0.09, 1.3, '#ff9ae8');
        noGlow(c);
        if (t[0] >= 3) { c.strokeStyle = '#c9a7ff'; c.lineWidth = 0.8; c.beginPath(); c.arc(0, 0, s * 0.42, -1, 1); c.stroke(); }
        c.restore();
      }
    })
  };

  const TART = {
    espinas: {
      base: baseStone, spin: 'aim',
      top(c, s, t) {
        for (let i = 0; i < 5; i++) { c.save(); c.rotate(Math.PI + (i - 2) * 0.55); leaf(c, s * 0.95, s * 0.32, i % 2 ? '#5fbf4a' : '#3f9a35'); c.restore(); }
        if (t[1] >= 4) {
          c.fillStyle = lg(c, 0, -3, 0, 3, ['#fff6d8', '#cdb27a', '#8a6a30']); c.fillRect(0, -3, s * 1.7, 6);
          shape(c, [[s * 1.7, -5], [s * 2.25, 0], [s * 1.7, 5]], lg(c, s * 1.7, -5, s * 1.7, 5, ['#fff6b0', '#ffcf4d', '#a87a00']), '#5a3a00', 1);
          c.strokeStyle = '#8a5a00'; c.lineWidth = 1.2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * 0.4 + i * 5, -3); c.lineTo(s * 0.4 + i * 5, 3); c.stroke(); }
        } else {
          const n = t[0] >= 3 ? 3 : 1, len = s * (1.15 + t[1] * 0.12);
          for (let i = 0; i < n; i++) {
            c.save(); c.rotate((i - (n - 1) / 2) * 0.38);
            rrect(c, 0, -3.2, len, 6.4, 2.5, lg(c, 0, -3.2, 0, 3.2, ['#7ac85a', '#2e6a22']), '#173a10', 1);
            for (let k = 0; k < 3; k++) { const x = s * 0.35 + k * len * 0.22; shape(c, [[x, -3], [x + 2, -6], [x + 3, -3]], '#d8f0a0'); shape(c, [[x, 3], [x + 2, 6], [x + 3, 3]], '#d8f0a0'); }
            circle(c, len, 0, 2.6, '#173a10');
            c.restore();
          }
        }
        orb(c, 0, 0, s * 0.62, s * 0.62, '#4fae3a');
        if (t[0] >= 4) star(c, 0, 0, s * 1.0, s * 0.6, 12, 0, null, '#d8f0a0', 1.2);
        star(c, 0, 0, s * 0.42, s * 0.22, 6, 0, '#c8f08a', '#2e6a22', 0.8);
        if (t[0] >= 2) for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.5; glow(c, '#c06bff', 4); circle(c, Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, 2, '#c06bff'); noGlow(c); }
        if (t[1] >= 2) { glow(c, '#ffcf4d', 5); circle(c, -2, 0, 2.6, '#ffe58a'); noGlow(c); }
      }
    },
    escarcha: {
      base: baseMetal, spin: 'time',
      top(c, s, t) {
        const n = 6, len = s * (0.95 + t[1] * 0.08 + t[0] * 0.04);
        glow(c, '#8ae8ff', 8);
        for (let i = 0; i < n; i++) {
          c.save(); c.rotate(i * TAU / n);
          shape(c, [[s * 0.2, -s * 0.18], [len, 0], [s * 0.2, s * 0.18]], lg(c, 0, -s * 0.2, 0, s * 0.2, ['#ffffff', '#9fe8ff', '#3a9ad8']), '#1a5a88', 1);
          if (t[1] >= 2) shape(c, [[s * 0.55, 0], [s * 0.7, -s * 0.32], [s * 0.78, 0]], 'rgba(220,250,255,0.9)');
          c.restore();
        }
        noGlow(c);
        const core = t[0] >= 4 ? '#2a7aff' : t[0] >= 3 ? '#5ad1ff' : '#bff4ff';
        glow(c, core, 10);
        poly(c, 0, 0, s * 0.38, 6, 0, sg(c, 0, 0, s * 0.38, core, 0.8), '#ffffff', 1.2);
        noGlow(c);
        if (t[1] >= 3) { c.fillStyle = '#3a4a5a'; c.fillRect(s * 0.2, -2.5, s * 0.9, 5); poly(c, s * 1.1, 0, 3.5, 4, 0, '#e8fbff', '#3a9ad8', 1); }
      }
    },
    vigia: {
      base: baseMetal, spin: 'aim',
      top(c, s, t) {
        const len = s * (1.5 + t[0] * 0.12);
        const bw = 2.6 + t[0] * 0.5;
        if (t[1] >= 3) {
          for (const y of [-3.2, 0, 3.2]) { c.fillStyle = lg(c, 0, y - 1.4, 0, y + 1.4, ['#8a92a0', '#2a2f37']); c.fillRect(s * 0.2, y - 1.4, len * 0.95, 2.8); }
          rrect(c, s * 0.3, -5, 5, 10, 1.5, '#4a525c', '#14181c', 0.8);
        } else {
          c.fillStyle = lg(c, 0, -bw, 0, bw, ['#9aa3b2', '#3a404a', '#1a1e24']); c.fillRect(s * 0.2, -bw, len, bw * 2);
          c.strokeStyle = '#0c0e12'; c.lineWidth = 0.8; c.strokeRect(s * 0.2, -bw, len, bw * 2);
          rrect(c, s * 0.2 + len - 3, -bw - 1.2, 5, bw * 2 + 2.4, 1, '#2a2f37', '#0c0e12', 0.8);
          if (t[0] >= 4) { glow(c, '#ff3a3a', 6); for (let i = 0; i < 3; i++) { c.fillStyle = '#ff5a4a'; c.fillRect(s * 0.6 + i * 5, -bw - 0.4, 2, bw * 2 + 0.8); } noGlow(c); }
        }
        orb(c, 0, 0, s * 0.62, s * 0.58, '#5a6aff');
        rrect(c, -s * 0.1, -s * 0.72, s * 0.75, 4.2, 1.5, '#1a1e24', '#0c0e12', 0.8);
        const lens = t[1] >= 4 ? '#c06bff' : '#7af0ff';
        glow(c, lens, 6); circle(c, s * 0.62, -s * 0.72 + 2.1, 2.2, lens); noGlow(c);
        circle(c, -s * 0.15, 0, s * 0.18, '#2a2f6a');
      }
    },
    voltaico: {
      base: baseMetal, spin: 'none',
      top(c, s, t) {
        for (let i = 0; i < 4; i++) {
          const a = i * TAU / 4 + Math.PI / 4, x = Math.cos(a) * s * 0.8, y = Math.sin(a) * s * 0.8;
          circle(c, x, y, 3, lg(c, x, y - 3, x, y + 3, ['#e0e4ea', '#5a6070']), '#14181c', 0.8);
          glow(c, t[1] >= 2 ? '#7af0ff' : '#fff27a', 5); circle(c, x, y, 1.6, t[1] >= 2 ? '#bff8ff' : '#fffbd0'); noGlow(c);
        }
        const rings = 3 + Math.min(3, t[0]);
        for (let i = 0; i < rings; i++) circle(c, 0, 0, s * (0.72 - i * 0.07), null, i % 2 ? '#b8682a' : '#e09a4a', 2.2);
        const orbCol = t[0] >= 4 ? '#ffffff' : '#ffe14d';
        glow(c, '#fff27a', 8 + t[0] * 3);
        circle(c, 0, 0, s * (0.3 + t[0] * 0.03), sg(c, 0, 0, s * 0.35, orbCol, 0.9, -0.2));
        noGlow(c);
      }
    },
    sembrador: {
      base: baseMetal, spin: 'aim',
      top(c, s, t) {
        rrect(c, -s * 0.7, -s * 0.62, s * 1.4, s * 1.24, 3, lg(c, 0, -s, 0, s, ['#7a8a5a', '#4a5a32', '#2a3418']), '#141a0a', 1.4);
        c.save(); c.beginPath(); c.rect(-s * 0.7, s * 0.3, s * 1.4, s * 0.32); c.clip();
        for (let i = -3; i < 6; i++) { c.fillStyle = i % 2 ? '#1a1a1a' : '#ffcc33'; c.beginPath(); c.moveTo(-s * 0.7 + i * 5, s * 0.62); c.lineTo(-s * 0.7 + i * 5 + 5, s * 0.62); c.lineTo(-s * 0.7 + i * 5 + 9, s * 0.3); c.lineTo(-s * 0.7 + i * 5 + 4, s * 0.3); c.fill(); }
        c.restore();
        c.fillStyle = '#2a2f37'; c.fillRect(s * 0.2, -4, s * 0.85, 8);
        const mc = t[1] >= 3 ? '#7fd6ff' : '#c0302a';
        circle(c, 0, -s * 0.05, s * 0.36, sg(c, 0, 0, s * 0.36, mc), '#2a0806', 1.2);
        glow(c, '#ffec5c', 5); circle(c, 0, -s * 0.05, 1.8, '#ffec5c'); noGlow(c);
        if (t[0] >= 4) { c.fillStyle = '#ffd84d'; for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * TAU / 3); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, s * 0.3, -0.45, 0.45); c.closePath(); c.fill(); c.restore(); } circle(c, 0, 0, 1.8, '#1a1a1a'); }
      }
    },
    mortero: {
      base: baseStone, spin: 'aim',
      top(c, s, t) {
        const n = t[1] >= 4 ? 3 : 1;
        circle(c, 0, 0, s * 0.85, lg(c, 0, -s, 0, s, ['#7a6a5a', '#3a2e24']), '#14100c', 1.4);
        for (let i = 0; i < n; i++) {
          c.save(); c.translate(0, n > 1 ? (i - 1) * s * 0.55 : 0);
          const bw = n > 1 ? s * 0.32 : s * (0.45 + t[0] * 0.04), len = s * (1.05 + t[0] * 0.08);
          const hot = t[0] >= 4;
          rrect(c, -2, -bw, len, bw * 2, 3, lg(c, 0, -bw, 0, bw, hot ? ['#ff9a5a', '#8a2a10', '#3a0e04'] : ['#6a6a70', '#2e2e34', '#121216']), '#08080a', 1.2);
          for (let k = 0; k < 2; k++) { c.fillStyle = hot ? '#ffcf60' : '#8a8a90'; c.fillRect(len * (0.35 + k * 0.3), -bw, 2, bw * 2); }
          circle(c, len, 0, bw * 0.95, '#0a0a0c', hot ? '#ff8a3d' : '#3a3a40', 1.6);
          c.restore();
        }
        if (t[1] >= 3) { glow(c, '#ff7a2f', 6); circle(c, -s * 0.45, 0, 3, '#ff9a4a'); noGlow(c); }
      }
    },
    dragon: {
      base: baseStone, spin: 'aim',
      top(c, s, t) {
        const blue = t[0] >= 3;
        const col = blue ? '#3a6bff' : '#d8401a', dark = blue ? '#0a1a5a' : '#4a0e04';
        const k = 1 + t[0] * 0.04;
        for (const sgn of [-1, 1]) {
          c.beginPath(); c.moveTo(-s * 0.1, sgn * s * 0.35); c.quadraticCurveTo(-s * 0.7, sgn * s * 1.0, -s * 1.15 * k, sgn * s * 0.75);
          c.lineTo(-s * 0.35, sgn * s * 0.25); c.closePath(); c.fillStyle = lg(c, 0, 0, -s, 0, ['#f5e6c8', '#8a7a60']); c.fill(); c.strokeStyle = '#3a2a1a'; c.lineWidth = 0.8; c.stroke();
          if (t[0] >= 4) { c.beginPath(); c.moveTo(-s * 0.4, sgn * s * 0.15); c.lineTo(-s * 1.1, sgn * s * 0.25); c.lineTo(-s * 0.5, sgn * s * 0.05); c.fill(); }
        }
        if (t[1] >= 2) for (const sgn of [-1, 1]) shape(c, [[-s * 0.2, sgn * s * 0.5], [-s * 0.6, sgn * s * 1.05], [s * 0.1, sgn * s * 0.6]], rgba(blue ? '#5a8aff' : '#ff8a3a', 0.85), dark, 0.8);
        c.beginPath();
        c.moveTo(s * 1.15 * k, -s * 0.18); c.quadraticCurveTo(s * 0.6, -s * 0.6, -s * 0.2, -s * 0.62);
        c.quadraticCurveTo(-s * 0.7, -s * 0.4, -s * 0.65, 0); c.quadraticCurveTo(-s * 0.7, s * 0.4, -s * 0.2, s * 0.62);
        c.quadraticCurveTo(s * 0.6, s * 0.6, s * 1.15 * k, s * 0.18); c.closePath();
        c.fillStyle = lg(c, 0, -s * 0.6, 0, s * 0.6, [sh(col, 0.4), col, sh(col, -0.5)]); c.fill(); c.strokeStyle = dark; c.lineWidth = 1.4; c.stroke();
        c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.7;
        for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-s * 0.3 + i * s * 0.3, 0, s * 0.25, -1, 1); c.stroke(); }
        circle(c, s * 1.05 * k, -s * 0.1, 1.2, '#1a0a00'); circle(c, s * 1.05 * k, s * 0.1, 1.2, '#1a0a00');
        glow(c, '#ffec5c', 6);
        for (const sgn of [-1, 1]) { c.save(); c.translate(s * 0.35, sgn * s * 0.32); c.rotate(sgn * -0.4); ell(c, 0, 0, 3, 1.6, 0, blue ? '#bff8ff' : '#fff27a'); c.restore(); }
        noGlow(c);
      }
    },
    prisma: {
      base: baseArcane, spin: 'time',
      top(c, s, t) {
        const r = s * (0.85 + t[0] * 0.05);
        glow(c, '#ffcf66', 8 + t[0] * 3);
        poly(c, 0, 0, r, 3, -Math.PI / 2, 'rgba(255,214,120,0.95)', '#fff1c4', 1.4);
        noGlow(c);
        const pts = [0, 1, 2].map(i => [Math.cos(-Math.PI / 2 + i * TAU / 3) * r, Math.sin(-Math.PI / 2 + i * TAU / 3) * r]);
        shape(c, [pts[0], pts[1], [0, 0]], 'rgba(255,250,220,0.9)');
        shape(c, [pts[1], pts[2], [0, 0]], 'rgba(230,160,60,0.85)');
        shape(c, [pts[2], pts[0], [0, 0]], 'rgba(255,200,90,0.9)');
        poly(c, 0, 0, r * 0.35, 3, Math.PI / 2, '#ffffff');
        if (t[0] >= 4) { glow(c, '#ffffff', 12); circle(c, 0, 0, r * 0.25, '#ffffff'); noGlow(c); }
      }
    },
    colmena: {
      base: baseWood, spin: 'none',
      top(c, s, t) {
        const metal = t[1] >= 4;
        const cells = [[0, 0]]; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; cells.push([Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5]); }
        for (const [x, y] of cells) poly(c, x, y, s * 0.3, 6, Math.PI / 6, sg(c, x, y, s * 0.3, metal ? '#9aa6b4' : '#f0b030', 0.5), metal ? '#2a3038' : '#6a4000', 1.1);
        for (const [x, y] of cells.slice(1)) poly(c, x, y, s * 0.14, 6, Math.PI / 6, metal ? '#3a4450' : '#a86a10');
        glow(c, '#ffd84d', 8); poly(c, 0, 0, s * 0.18, 6, Math.PI / 6, '#ffe58a'); noGlow(c);
        if (t[0] >= 3) circle(c, 0, 0, s * 0.92, null, '#ff8a3a', 1);
        if (metal) { c.strokeStyle = '#d8dee6'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -s * 0.5); c.lineTo(0, -s * 1.1); c.stroke(); circle(c, 0, -s * 1.1, 2, '#ff5050'); }
      }
    },
    totem: {
      base: baseStone, spin: 'none',
      top(c, s, t) {
        const w = s * 0.6, h = s * 1.7, y0 = -h * 0.62;
        for (const sgn of [-1, 1]) shape(c, [[sgn * w * 0.4, y0 + 2], [sgn * w * 1.6, y0 - 4], [sgn * w * 1.4, y0 + 4], [sgn * w * 0.4, y0 + 7]], lg(c, 0, y0 - 4, 0, y0 + 7, ['#e07bff', '#7a2a9a']), '#2a0a3a', 0.8);
        rrect(c, -w / 2, y0, w, h, 2, lg(c, -w / 2, 0, w / 2, 0, ['#5a3420', '#9a6a3a', '#5a3420']), '#20120a', 1.2);
        for (let i = 0; i < 3; i++) {
          const fy = y0 + 4 + i * h * 0.31;
          c.fillStyle = ['#e07bff', '#4fe08a', '#ff5a5a'][i]; c.fillRect(-w / 2, fy + h * 0.24, w, 1.6);
          const glowC = t[1] >= 2 ? '#e07bff' : '#ffe58a';
          glow(c, glowC, 4);
          circle(c, -w * 0.2, fy + 3, 1.4, glowC); circle(c, w * 0.2, fy + 3, 1.4, glowC);
          noGlow(c);
          c.fillStyle = '#20120a'; c.fillRect(-w * 0.25, fy + 6, w * 0.5, 1.4);
        }
        for (let i = 0; i < 3; i++) { c.save(); c.translate(0, y0); c.rotate(-Math.PI / 2 + (i - 1) * 0.45); leaf(c, s * 0.7, s * 0.14, ['#ff5050', '#ffd84d', '#5ad1ff'][i]); c.restore(); }
        if (t[0] >= 4) { glow(c, '#e07bff', 8); circle(c, 0, y0 - s * 0.5, 2.5, '#ffd0ff'); noGlow(c); }
      }
    },
    ancla: {
      base: baseArcane, spin: 'none',
      top(c, s, t) {
        glow(c, '#9b6bff', 12);
        const g = c.createRadialGradient(0, 0, 1, 0, 0, s * 0.68);
        g.addColorStop(0, '#000000'); g.addColorStop(0.7, '#12052a'); g.addColorStop(1, t[1] >= 4 ? '#ff7ae4' : '#9b6bff');
        circle(c, 0, 0, s * 0.68, g);
        noGlow(c);
        circle(c, -s * 0.2, -s * 0.25, s * 0.12, 'rgba(255,255,255,0.15)');
      }
    },
    huerto: {
      base: baseSoil, spin: 'none',
      top(c, s, t) {
        const n = 3 + t[0] + Math.min(2, t[1]);
        const col = t[0] >= 4 ? '#e8ffff' : '#4be3b0';
        const rng = PD.rng(7 + n);
        const list = [];
        for (let k = 0; k < n; k++) { const a = k * 2.4 + 0.3, d = 2 + (k % 3) * s * 0.22; list.push([Math.cos(a) * d, Math.sin(a) * d * 0.8, 6 + rng() * 4 + t[0] * 1.5, (rng() - 0.5) * 0.8]); }
        list.sort((a, b) => a[1] - b[1]);
        for (const [x, y, hh, rot] of list) {
          c.save(); c.translate(x, y); c.rotate(rot);
          glow(c, col, 4);
          shape(c, [[0, -hh], [3.2, -hh * 0.55], [2.6, 2], [-2.6, 2], [-3.2, -hh * 0.55]], lg(c, -3, 0, 3, 0, [sh(col, 0.5), col, sh(col, -0.4)]), sh(col, -0.6), 0.8);
          noGlow(c);
          shape(c, [[0, -hh], [3.2, -hh * 0.55], [0, -hh * 0.4]], 'rgba(255,255,255,0.55)');
          c.restore();
        }
        if (t[1] >= 2) { c.save(); c.translate(s * 0.62, -s * 0.55); for (let i = 0; i < 3; i++) ell(c, 0, -i * 2, 4, 1.8, 0, '#ffd84d', '#8a5a00', 0.7); c.restore(); }
      }
    },
    // ===================== DEFENSAS DE REINO =====================
    bumeran: {
      base: baseWood, spin: 'aim',
      top(c, s, t) {
        // brazo del cazador: cuero, plumas y el bumerán listo para lanzar
        if (t[1] >= 2) for (const sg2 of [-1, 1]) { c.save(); c.rotate(Math.PI + sg2 * 0.55); leaf(c, s * 0.9, s * 0.2, t[1] >= 4 ? '#7ad86a' : '#e8e0c8'); c.restore(); }
        orb(c, -s * 0.1, 0, s * 0.6, s * 0.56, '#8a5a2a');
        c.strokeStyle = '#3a2410'; c.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-s * 0.55, i * s * 0.22); c.lineTo(s * 0.35, i * s * 0.22); c.stroke(); }
        const obs = t[0] >= 3;
        if (t[0] >= 4) {
          glow(c, '#ffcf4d', 8);
          circle(c, s * 0.75, 0, s * 0.62, null, lg(c, 0, -s, 0, s, ['#fff6b0', '#ffcf4d', '#a87a00']), 4);
          noGlow(c);
          for (let i = 0; i < 8; i++) { const a = i * TAU / 8; shape(c, [[s * 0.75 + Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6], [s * 0.75 + Math.cos(a + 0.25) * s * 0.85, Math.sin(a + 0.25) * s * 0.85], [s * 0.75 + Math.cos(a + 0.4) * s * 0.6, Math.sin(a + 0.4) * s * 0.6]], '#fff1a8', '#8a5a00', 0.7); }
          circle(c, s * 0.75, 0, s * 0.18, '#3a2410');
        } else {
          const n = t[0] >= 2 ? 2 : 1;
          for (let i = 0; i < n; i++) rangShape(c, s * (0.7 + i * 0.12), (i - (n - 1) / 2) * s * 0.5, s * 0.62, 0.4, obs ? '#2a2236' : '#d8a050', obs ? '#c08aff' : '#5a3410');
        }
        glow(c, '#ffe58a', 4); circle(c, -s * 0.2, -s * 0.18, 1.8, '#ffe58a'); noGlow(c);
      }
    },
    raices: {
      base: baseSoil, spin: 'none',
      top(c, s, t) {
        // raíces que serpentean hacia el suelo
        c.strokeStyle = '#4a2c12'; c.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = i * TAU / 6 + 0.3;
          c.lineWidth = 3.2; c.beginPath(); c.moveTo(0, 0);
          c.quadraticCurveTo(Math.cos(a + 0.5) * s * 0.6, Math.sin(a + 0.5) * s * 0.6, Math.cos(a) * s * 1.05, Math.sin(a) * s * 1.05); c.stroke();
          c.strokeStyle = '#8a5a2a'; c.lineWidth = 1.2; c.stroke(); c.strokeStyle = '#4a2c12';
        }
        // tocón con anillos
        circle(c, 0, 0, s * 0.55, lg(c, 0, -s * 0.5, 0, s * 0.5, ['#a8743a', '#6a4420']), '#2a1808', 1.4);
        for (let i = 1; i < 4; i++) circle(c, 0.5, 0.5, s * 0.55 - i * s * 0.12, null, 'rgba(60,30,10,0.55)', 0.8);
        const big = t[0] >= 3, crown = t[0] >= 4;
        const nl = 5 + t[1] + (big ? 2 : 0);
        for (let i = 0; i < nl; i++) {
          c.save(); c.rotate(i * TAU / nl + 0.2);
          leaf(c, s * (big ? 0.95 : 0.75), s * (big ? 0.3 : 0.22), crown ? (i % 2 ? '#c8f060' : '#ffd84d') : i % 2 ? '#5fbf4a' : '#3f9a35');
          c.restore();
        }
        glow(c, crown ? '#fff27a' : '#b8ff6a', 8);
        circle(c, 0, 0, s * 0.2, sg(c, 0, 0, s * 0.2, crown ? '#fff6b0' : '#b8ff6a', 0.7));
        noGlow(c);
        if (t[1] >= 3) for (let i = 0; i < 3; i++) { const a = i * 2.1 + 1; ell(c, Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42, 1.8, 2.6, a, '#ffcf4d', '#8a5a00', 0.5); }
      }
    },
    sierra: {
      base: baseMetal, spin: 'time',
      top(c, s, t) {
        const diam = t[0] >= 3, huge = t[0] >= 4;
        const n = t[1] >= 2 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          c.save(); if (n > 1) c.translate((k ? 1 : -1) * s * 0.28, (k ? -1 : 1) * s * 0.18);
          const R = s * (huge ? 0.95 : n > 1 ? 0.62 : 0.8);
          sawBlade(c, R, diam ? '#bff4ff' : '#dfe4ea', huge ? '#c0302a' : '#3a4048');
          c.restore();
        }
        if (t[1] >= 3) { glow(c, '#ff4a3a', 5); for (let i = 0; i < 3; i++) { const a = i * TAU / 3; circle(c, Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3, 1.4, '#ff6a5a'); } noGlow(c); }
      }
    },
    acido: {
      base: baseStone, spin: 'aim',
      top(c, s, t) {
        const liq = t[0] >= 4 ? '#c070ff' : t[0] >= 3 ? '#d8ff3a' : '#8be04a';
        const n = t[1] >= 4 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const y = n > 1 ? (i - 1) * s * 0.42 : 0;
          rrect(c, s * 0.15, y - 2.6, s * 1.05, 5.2, 2, lg(c, 0, y - 2.6, 0, y + 2.6, ['#c8d0d8', '#5a626e']), '#1a1e24', 0.9);
          glow(c, liq, 4); circle(c, s * 1.2, y, 2, liq); noGlow(c);
        }
        // matraz de vidrio con líquido burbujeante
        circle(c, -s * 0.1, 0, s * 0.62, 'rgba(210,240,255,0.25)', 'rgba(230,250,255,0.85)', 1.4);
        c.save(); c.beginPath(); c.arc(-s * 0.1, 0, s * 0.56, 0, TAU); c.clip();
        c.fillStyle = lg(c, 0, -s * 0.1, 0, s * 0.6, [sh(liq, 0.3), liq, sh(liq, -0.5)]); c.fillRect(-s, -s * 0.12, s * 2, s);
        c.restore();
        glow(c, liq, 6);
        for (let i = 0; i < 4; i++) circle(c, -s * 0.35 + i * s * 0.16, -s * 0.05 + (i % 2) * s * 0.18, 1.2 + (i % 2), sh(liq, 0.6));
        noGlow(c);
        rrect(c, -s * 0.28, -s * 0.95, s * 0.36, s * 0.42, 1.5, 'rgba(220,245,255,0.5)', 'rgba(230,250,255,0.85)', 1.1);
        rrect(c, -s * 0.33, -s * 1.02, s * 0.46, s * 0.14, 1, '#8a5a2a', '#3a2410', 0.7);
        spec(c, -s * 0.35, -s * 0.25, s * 0.16, 0.7);
        if (t[1] >= 3) { c.save(); c.translate(s * 0.35, s * 0.5); for (let i = 0; i < 2; i++) ell(c, 0, -i * 2, 3.6, 1.6, 0, '#ffd84d', '#8a5a00', 0.6); c.restore(); }
      }
    },
    faro: {
      base: baseStone, spin: 'none',
      top(c, s, t) {
        const aur = t[0] >= 4;
        // torre a franjas vista desde arriba
        circle(c, 0, 0, s * 0.85, '#f4f0e6', '#3a3630', 1.4);
        c.save(); c.beginPath(); c.arc(0, 0, s * 0.85, 0, TAU); c.clip();
        c.fillStyle = aur ? '#3a6aff' : '#d8402a';
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, s, i * TAU / 4, i * TAU / 4 + TAU / 8); c.closePath(); c.fill(); }
        c.restore();
        circle(c, 0, 0, s * 0.85, null, '#3a3630', 1.4);
        poly(c, 0, 0, s * 0.58, 8, Math.PI / 8, '#2a2e36', '#14161a', 1.2);
        // linterna
        const lamp = aur ? '#9affe0' : t[1] >= 3 ? '#ffffff' : '#fff1a8';
        glow(c, lamp, 14);
        poly(c, 0, 0, s * 0.44, 8, Math.PI / 8, sg(c, 0, 0, s * 0.44, lamp, 0.8, -0.1), '#ffffff', 1);
        noGlow(c);
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; c.strokeStyle = 'rgba(40,40,50,0.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * s * 0.44, Math.sin(a) * s * 0.44); c.stroke(); }
        circle(c, 0, 0, s * 0.14, '#ffffff');
        if (t[1] >= 2) for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - Math.PI / 2; poly(c, Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72, 3.2, 3, a, '#d8f4ff', '#5a8ac0', 0.7); }
      }
    },
    balista: {
      base: baseMetal, spin: 'aim',
      top(c, s, t) {
        const ice = t[0] >= 2, lance = t[0] >= 4, n = t[1] >= 3 ? 3 : 1;
        // arco
        c.strokeStyle = lg(c, 0, -s, 0, s, ['#c89a5a', '#6a4a22', '#c89a5a']); c.lineWidth = 3.6;
        c.beginPath(); c.moveTo(-s * 0.1, -s * 1.05); c.quadraticCurveTo(s * 0.55, 0, -s * 0.1, s * 1.05); c.stroke();
        c.strokeStyle = '#2a1a0a'; c.lineWidth = 0.9; c.stroke();
        c.strokeStyle = '#e8e0c8'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-s * 0.1, -s * 1.05); c.lineTo(-s * 0.45, 0); c.lineTo(-s * 0.1, s * 1.05); c.stroke();
        // culata
        rrect(c, -s * 0.7, -s * 0.18, s * 1.3, s * 0.36, 2, lg(c, 0, -s * 0.2, 0, s * 0.2, ['#8a929e', '#3a4048']), '#14181c', 1);
        rivets(c, [[-s * 0.5, 0], [s * 0.2, 0]], 1, '#d8dee6');
        for (let i = 0; i < n; i++) {
          c.save(); c.rotate((i - (n - 1) / 2) * 0.16);
          const L = s * (lance ? 1.8 : 1.45), col = ice ? '#bff4ff' : '#e8e0c8';
          c.fillStyle = lg(c, 0, -1.5, 0, 1.5, ['#f0e6d0', '#8a7a5a']); c.fillRect(-s * 0.45, -1.2, L, 2.4);
          if (ice) glow(c, '#8ae8ff', 6);
          shape(c, [[L - s * 0.45, -(lance ? 4.5 : 3)], [L - s * 0.45 + (lance ? 9 : 6), 0], [L - s * 0.45, lance ? 4.5 : 3]], col, ice ? '#3a9ad8' : '#5a4a2a', 0.8);
          noGlow(c);
          c.restore();
        }
        glow(c, '#7af0ff', 5); circle(c, -s * 0.15, 0, 2, '#bff8ff'); noGlow(c);
      }
    },
    forja: {
      base: baseStone, spin: 'none',
      top(c, s, t) {
        const magma = t[0] >= 4;
        // horno de ladrillo
        circle(c, 0, 0, s * 0.9, lg(c, 0, -s, 0, s, ['#7a4a3a', '#3a201a']), '#1a0c08', 1.4);
        c.strokeStyle = 'rgba(20,8,4,0.6)'; c.lineWidth = 0.8;
        for (let r = 0.35; r < 0.9; r += 0.22) circle(c, 0, 0, s * r, null, 'rgba(20,8,4,0.55)', 0.8);
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35); c.lineTo(Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.9); c.stroke(); }
        // boca incandescente
        glow(c, '#ff7a2f', 12);
        const g = c.createRadialGradient(0, s * 0.1, 1, 0, s * 0.1, s * 0.5);
        g.addColorStop(0, '#fff6b0'); g.addColorStop(0.4, magma ? '#ff3a1a' : '#ffa23a'); g.addColorStop(1, '#5a1a08');
        ell(c, 0, s * 0.12, s * 0.48, s * 0.36, 0, g);
        noGlow(c);
        // yunque
        shape(c, [[-s * 0.55, -s * 0.55], [s * 0.45, -s * 0.55], [s * 0.7, -s * 0.38], [s * 0.15, -s * 0.38], [s * 0.1, -s * 0.2], [-s * 0.35, -s * 0.2], [-s * 0.4, -s * 0.38], [-s * 0.55, -s * 0.38]], lg(c, 0, -s * 0.6, 0, -s * 0.2, ['#b0b8c4', '#4a525c']), '#14181c', 1);
        // chimenea
        circle(c, s * 0.55, s * 0.5, s * 0.22, '#2a2e36', '#0c0e12', 1);
        circle(c, s * 0.55, s * 0.5, s * 0.12, '#0a0a0c');
        if (t[1] >= 3) { glow(c, '#ffec5c', 6); poly(c, -s * 0.55, s * 0.45, 3, 4, 0, '#ffec5c'); noGlow(c); }
        if (magma) for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.6; shape(c, [[Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85], [Math.cos(a) * s * 1.15, Math.sin(a) * s * 1.15], [Math.cos(a + 0.2) * s * 0.85, Math.sin(a + 0.2) * s * 0.85]], '#ffcf4d', '#8a3a00', 0.7); }
      }
    },
    geiser: {
      base: baseStone, spin: 'none',
      top(c, s, t) {
        const big = t[0] >= 4, salt = t[1] >= 2;
        // anillo de roca volcánica
        for (let i = 0; i < 9; i++) { const a = i * TAU / 9; poly(c, Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7, s * 0.26, 5, a, lg(c, 0, -s * 0.3, 0, s * 0.3, ['#8a7a6a', '#3a3028']), '#1a1410', 0.9); }
        // charco hirviente
        const g = c.createRadialGradient(-s * 0.15, -s * 0.15, 1, 0, 0, s * 0.6);
        g.addColorStop(0, '#e8ffff'); g.addColorStop(0.4, big ? '#3ac0ff' : '#6fd6e8'); g.addColorStop(1, '#0a4a6a');
        circle(c, 0, 0, s * 0.58, g, '#0a2a3a', 1.2);
        glow(c, '#bff8ff', 6);
        for (let i = 0; i < 5; i++) { const a = i * 1.3; circle(c, Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28, 1.3 + (i % 2), 'rgba(240,255,255,0.85)'); }
        noGlow(c);
        circle(c, 0, 0, s * 0.18, '#0a3a5a');
        if (salt) for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; poly(c, Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95, 2.6, 4, a, '#ffffff', '#8ab0c0', 0.6); }
      }
    },
    obelisco: {
      base: baseArcane, spin: 'none',
      top(c, s, t) {
        const plague = t[1] >= 3, doom = t[0] >= 4;
        const rune = plague ? '#9dff4a' : doom ? '#ff5aa8' : '#c07bff';
        // aguja de piedra negra (vista en perspectiva)
        shape(c, [[0, -s * 1.25], [s * 0.42, -s * 0.2], [s * 0.3, s * 0.55], [-s * 0.3, s * 0.55], [-s * 0.42, -s * 0.2]], lg(c, -s * 0.4, 0, s * 0.4, 0, ['#3a2a5a', '#1a1028', '#0c0814']), '#06040a', 1.3);
        shape(c, [[0, -s * 1.25], [s * 0.42, -s * 0.2], [0, -s * 0.05]], 'rgba(255,255,255,0.12)');
        glow(c, rune, 8);
        c.strokeStyle = rune; c.lineWidth = 1.1;
        for (let i = 0; i < 3; i++) { const y = -s * 0.75 + i * s * 0.38; c.beginPath(); c.moveTo(-s * 0.1, y); c.lineTo(s * 0.1, y + s * 0.1); c.lineTo(-s * 0.08, y + s * 0.2); c.stroke(); }
        // ojo flotante
        ell(c, 0, -s * 1.0, s * 0.22, s * 0.13, 0, rune);
        circle(c, 0, -s * 1.0, s * 0.07, '#0c0814');
        noGlow(c);
        if (t[0] >= 2) for (const sg2 of [-1, 1]) shape(c, [[sg2 * s * 0.3, s * 0.5], [sg2 * s * 0.75, s * 0.75], [sg2 * s * 0.42, s * 0.2]], '#2a1a3a', rune, 0.8);
      }
    },
    segador: {
      base: baseArcane, spin: 'none',
      top(c, s, t) {
        const arc = t[0] >= 3;
        const col = arc ? '#d8b0ff' : '#c8ced8';
        // guadañas de la torreta (en el icono también se ven)
        const n = Math.max(2, Math.min(6, t[0] >= 4 ? 4 : t[0] >= 2 ? 3 : 2) + (t[1] >= 4 ? 2 : 0));
        for (let i = 0; i < n; i++) { c.save(); c.rotate(i * TAU / n); scythe(c, s * 0.25, s * 1.05, col, arc); c.restore(); }
        glow(c, '#9b6bff', 10);
        circle(c, 0, 0, s * 0.42, sg(c, 0, 0, s * 0.42, t[1] >= 4 ? '#ff7ae4' : '#7a4dff', 0.7), '#1a0a3a', 1.2);
        noGlow(c);
        circle(c, 0, 0, s * 0.16, '#0c0618');
        circle(c, 0, 0, s * 0.6, null, 'rgba(200,170,255,0.6)', 1);
      }
    },
    heroeprado: { base: heroBase, spin: 'aim', top: HERO_ART.heroeprado },
    heroedunas: { base: heroBase, spin: 'aim', top: HERO_ART.heroedunas },
    heroeglaciar: { base: heroBase, spin: 'aim', top: HERO_ART.heroeglaciar },
    heroecaldera: { base: heroBase, spin: 'aim', top: HERO_ART.heroecaldera },
    heroevacio: { base: heroBase, spin: 'aim', top: HERO_ART.heroevacio }
  };
  // Rango visual de una torre según sus mejoras: 0 básica … 4 legendaria
  function towerRank(t) {
    const mx = Math.max(t[0], t[1]), tot = t[0] + t[1];
    return mx >= 4 ? (tot >= 6 ? 4 : 3) : mx >= 3 || tot >= 4 ? 2 : tot >= 2 ? 1 : 0;
  }
  PD.towerRank = towerRank;
  const towerAccent = t => (t[0] >= t[1] ? '#ffcf4d' : '#5ad1ff');
  const BAND = [null, ['#e0a060', '#8a4a1a'], ['#f0f4fa', '#6a7480'], ['#fff1a8', '#a8740a'], ['#fff6c8', '#c08a10']];
  // pilares con cristal que asoman bajo la base (rango 2+)
  function spikes(c, s, rank, acc) {
    const n = rank === 2 ? 3 : rank === 3 ? 5 : 7, spread = 3.4;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * spread / (n - 1);
      c.save(); c.rotate(a);
      const r0 = s + 1, r1 = s + 8 + rank;
      shape(c, [[r0, -3.2], [r1, -1.6], [r1, 1.6], [r0, 3.2]], lg(c, 0, -3, 0, 3, ['#c8ced8', '#6a7280', '#2e343c']), '#14181c', 1);
      glow(c, acc, 5);
      poly(c, r1 + 1.2, 0, 2.8, 4, 0, lg(c, r1 - 2, 0, r1 + 4, 0, ['#ffffff', acc, shade(acc, -0.5)]), shade(acc, -0.6), 0.7);
      noGlow(c);
      c.restore();
    }
  }
  // aro de metal noble alrededor de la base (rango 1+)
  function band(c, s, rank) {
    const [hi, lo] = BAND[rank];
    circle(c, 0, 0, s + 4, null, '#120e08', 4.2);
    c.save(); c.lineWidth = 2.6; c.strokeStyle = lg(c, 0, -s - 4, 0, s + 4, [hi, lo, hi, lo]);
    c.beginPath(); c.arc(0, 0, s + 4, 0, TAU); c.stroke(); c.restore();
    const k = rank >= 3 ? 8 : 6;
    for (let i = 0; i < k; i++) { const a = i * TAU / k + Math.PI / k; circle(c, Math.cos(a) * (s + 4), Math.sin(a) * (s + 4), 1.1, hi, lo, 0.5); }
  }
  // runas brillantes grabadas en la plataforma (rango 3+)
  function runes(c, s, acc) {
    glow(c, acc, 6);
    c.strokeStyle = acc; c.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10;
      c.save(); c.rotate(a); c.translate(s - 3.2, 0);
      c.beginPath();
      if (i % 2) { c.moveTo(0, -1.6); c.lineTo(0, 1.6); c.moveTo(-1, -0.6); c.lineTo(1, 0.6); }
      else { c.moveTo(-1, -1.4); c.lineTo(1, 0); c.lineTo(-1, 1.4); }
      c.stroke(); c.restore();
    }
    noGlow(c);
  }

  function towerSprite(type, tiers, part) {
    const key = type + tiers[0] + tiers[1] + part;
    let s = TSPR[key];
    if (s) return s;
    const def = PD.TOWERS[type], sz = def.size;
    const half = sz * 3 + 8, size = Math.ceil(half * 2 * TRES);
    const rank = towerRank(tiers), acc = towerAccent(tiers);
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d');
    c.translate(size / 2, size / 2); c.scale(TRES, TRES); c.lineJoin = 'round';
    RS = TRES;
    const art = TART[type];
    if (part === 'base') {
      const bs = 1 + rank * 0.06;
      c.scale(bs, bs);
      c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 6 * RS; c.shadowOffsetX = 2 * RS; c.shadowOffsetY = 3 * RS;
      circle(c, 0, 0, sz + 3, '#000');
      c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
      if (rank >= 2) spikes(c, sz, rank, acc);
      art.base(c, sz, def.color);
      if (rank >= 1) band(c, sz, rank);
      if (rank >= 3) runes(c, sz, acc);
      gems(c, sz, tiers);
    } else {
      // la torreta se dibuja aparte y se proyecta con sombra para darle altura
      const tc = document.createElement('canvas'); tc.width = tc.height = size;
      const t2 = tc.getContext('2d');
      const ts = TRES * 1.2 * (1 + rank * 0.05);
      t2.translate(size / 2, size / 2); t2.scale(ts, ts); t2.lineJoin = 'round';
      art.top(t2, sz, tiers);
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (rank >= 3) { c.shadowColor = acc; c.shadowBlur = (rank >= 4 ? 11 : 7) * TRES; c.drawImage(tc, 0, 0); }
      c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 4 * TRES; c.shadowOffsetX = 2 * TRES; c.shadowOffsetY = 3.5 * TRES;
      c.drawImage(tc, 0, 0);
    }
    RS = 1;
    return (TSPR[key] = { c: cv, half });
  }

  function drawTower(ctx, type, x, y, ang, tiers, o) {
    o = o || {};
    const def = PD.TOWERS[type], art = TART[type], sz = def.size;
    const time = o.time || 0;
    const rank = towerRank(tiers), acc = towerAccent(tiers);
    const ga = ctx.globalAlpha;
    ctx.save();
    ctx.translate(x, y);
    if (!o.icon && rank >= 2) {
      // halo de poder en el suelo
      const pu = 0.5 + 0.5 * Math.sin(time * 2.4 + x * 0.013), R = sz + 10 + rank * 4;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, sz * 0.5, 0, 0, R);
      g.addColorStop(0, rgba(acc, (0.08 + 0.05 * rank) * (0.65 + 0.35 * pu))); g.addColorStop(1, rgba(acc, 0));
      circle(ctx, 0, 0, R, g);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!o.icon && def.hero) {
      // los héroes: corona de luz dorada en el suelo
      const pu = 0.5 + 0.5 * Math.sin(time * 3 + x * 0.01);
      ctx.save(); ctx.rotate(-time * 0.8);
      ctx.globalAlpha = ga * (0.5 + 0.35 * pu);
      ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 2; ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.arc(0, 0, sz + 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; star(ctx, Math.cos(a) * (sz + 9), Math.sin(a) * (sz + 9), 3.2, 1.2, 4, a, '#fff1a8'); }
      ctx.globalAlpha = ga; ctx.restore();
    }
    if (!o.icon && rank >= 3) {
      // anillos rúnicos giratorios
      const R1 = sz * (1 + rank * 0.06) + 11;
      ctx.save(); ctx.rotate(time * 0.6);
      ctx.globalAlpha = ga * (0.55 + 0.2 * Math.sin(time * 3));
      ctx.strokeStyle = acc; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(0, 0, R1, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; poly(ctx, Math.cos(a) * R1, Math.sin(a) * R1, 2.2, 4, a, acc); }
      if (rank >= 4) {
        ctx.rotate(-time * 1.5);
        ctx.globalAlpha = ga * 0.45; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, R1 + 5, 0, TAU); ctx.stroke();
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; star(ctx, Math.cos(a) * (R1 + 5), Math.sin(a) * (R1 + 5), 2.6, 1, 4, a, '#ffffff'); }
      }
      ctx.globalAlpha = ga;
      ctx.restore();
    }
    blit(ctx, towerSprite(type, tiers, 'base'));
    if (type === 'ancla') {
      ctx.save(); ctx.rotate(time * 1.4);
      ctx.strokeStyle = 'rgba(200,170,255,0.8)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(0, 0, sz * 1.05, sz * 0.38, 0, 0, TAU); ctx.stroke();
      if (tiers[0] + tiers[1] >= 3) { ctx.rotate(-time * 2.6); ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.95, sz * 0.32, 1, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    if (type === 'faro' && !o.icon) {
      // haz giratorio del faro
      const R = (o.tw ? o.tw.s.range : def.base.range) * 1.02, a0 = time * 1.3;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const off of [0, Math.PI]) {
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, R);
        g.addColorStop(0, tiers[0] >= 4 ? 'rgba(150,255,220,0.32)' : 'rgba(255,245,190,0.32)'); g.addColorStop(1, 'rgba(255,245,190,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0 + off - 0.22, a0 + off + 0.22); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    if (type === 'segador' && o.tw) {
      // guadañas largas que barren su alcance
      const s2 = o.tw.s, n = s2.blades, R = s2.range * 0.92, arc = s2.dtype === 'arcane';
      ctx.save(); ctx.rotate(o.tw.spin);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = arc ? 'rgba(200,150,255,0.18)' : 'rgba(220,225,235,0.14)'; ctx.lineWidth = 10;
      for (let k = 0; k < n; k++) { const a = k * TAU / n; ctx.beginPath(); ctx.arc(0, 0, R * 0.86, a - 0.55, a); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      for (let k = 0; k < n; k++) { ctx.save(); ctx.rotate(k * TAU / n); scythe(ctx, sz * 0.5, R, arc ? '#d8b0ff' : '#d8dee6', arc); ctx.restore(); }
      ctx.restore();
    }
    ctx.save();
    if (art.spin === 'aim') ctx.rotate(ang);
    else if (type === 'segador') ctx.rotate(o.tw ? o.tw.spin : 0);
    else if (art.spin === 'time') ctx.rotate(type === 'escarcha' && tiers[1] >= 3 ? ang : time * (type === 'sierra' ? 4 : 0.7));
    if (o.flash > 0 && art.spin === 'aim') ctx.translate(-1.5, 0);
    blit(ctx, towerSprite(type, tiers, 'top'));
    ctx.restore();
    if (!o.icon && rank >= 3) {
      // chispas de energía que ascienden
      ctx.globalCompositeOperation = 'lighter';
      const n = rank >= 4 ? 6 : 3;
      for (let k = 0; k < n; k++) {
        const ph = (time * 0.55 + k / n + x * 0.001) % 1;
        ctx.globalAlpha = ga * Math.sin(ph * Math.PI) * 0.9;
        star(ctx, Math.sin(k * 2.39 + x) * sz * 0.85, sz * 0.4 - ph * sz * 1.9, 2.4, 0.8, 4, ph * 3, k % 2 ? '#ffffff' : acc);
      }
      ctx.globalAlpha = ga; ctx.globalCompositeOperation = 'source-over';
    }
    if (def.hero && !o.icon) {
      const bob = Math.sin(time * 2.5 + x) * 1.5;
      shape(ctx, [[-6, -sz - 6 + bob], [-6, -sz - 12 + bob], [-3, -sz - 9 + bob], [0, -sz - 14 + bob], [3, -sz - 9 + bob], [6, -sz - 12 + bob], [6, -sz - 6 + bob]], lg(ctx, 0, -sz - 14, 0, -sz - 6, ['#fff6c8', '#ffcf4d', '#a8740a']), '#5a3a00', 0.8);
    }
    if (type === 'voltaico' && !o.icon) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = tiers[1] >= 2 ? 'rgba(150,240,255,0.9)' : 'rgba(255,240,120,0.9)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        if (Math.sin(time * 13 + i * 2.3) < 0.2) continue;
        const a = i * TAU / 4 + Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * sz * 0.4 + (Math.random() - 0.5) * 4, Math.sin(a) * sz * 0.4 + (Math.random() - 0.5) * 4);
        ctx.lineTo(Math.cos(a) * sz * 0.8, Math.sin(a) * sz * 0.8); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (type === 'prisma' && tiers[1] >= 2 && !o.icon) {
      const n = Math.min(5, 1 + tiers[1]);
      for (let k = 0; k < n; k++) { const a = time * 1.6 + k * TAU / n; poly(ctx, Math.cos(a) * sz * 1.15, Math.sin(a) * sz * 1.15, 3, 3, a, '#ffe08a', '#a8620a', 0.6); }
    }
    if (type === 'totem' && !o.icon) {
      const pr = (time * 0.8) % 1, ga2 = ctx.globalAlpha;
      ctx.globalAlpha = ga2 * (1 - pr) * 0.5; circle(ctx, 0, 0, sz * (0.6 + pr * 1.2), null, def.color, 2); ctx.globalAlpha = ga2;
    }
    if (type === 'huerto' && !o.icon) {
      const ga2 = ctx.globalAlpha;
      for (let k = 0; k < 3; k++) { const ph = (time * 0.7 + k * 0.33) % 1; ctx.globalAlpha = ga2 * Math.sin(ph * Math.PI); star(ctx, Math.sin(k * 7.1) * sz * 0.5, -ph * sz * 0.9, 2.2, 0.8, 4, 0, '#ffffff'); }
      ctx.globalAlpha = ga2;
    }
    if (o.flash > 0 && !o.icon && (def.kind === 'beacon' || def.kind === 'barracks' || def.kind === 'hex')) {
      ctx.globalCompositeOperation = 'lighter';
      const col = def.kind === 'hex' ? '192,123,255' : def.kind === 'barracks' ? '255,140,50' : '255,250,210';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 1.6);
      g.addColorStop(0, 'rgba(' + col + ',' + Math.min(0.7, o.flash * 3) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
      circle(ctx, 0, 0, sz * 1.6, g);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (o.flash > 0 && !o.icon && (def.kind === 'projectile' || def.kind === 'sniper' || def.kind === 'mortar' || def.kind === 'rail')) {
      ctx.rotate(ang);
      ctx.globalCompositeOperation = 'lighter';
      const fx = sz * (def.kind === 'sniper' ? 1.9 : def.kind === 'mortar' ? 1.3 : 1.25);
      const g = ctx.createRadialGradient(fx, 0, 0, fx, 0, 9);
      g.addColorStop(0, 'rgba(255,250,210,0.95)'); g.addColorStop(1, 'rgba(255,160,40,0)');
      circle(ctx, fx, 0, 9, g);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // ============================== MAPAS ==================================
  const PAL = {
    grass: ['#2f7a2e', '#459a3c', '#5cb04a', '#3a8a35'],
    sand: ['#c99a52', '#dcb36c', '#e9c886', '#d0a35c'],
    ice: ['#b9d8ee', '#d4e8f6', '#eef7fd', '#c6e0f2'],
    lava: ['#22140f', '#33201a', '#47302a', '#2a1813'],
    void: ['#0d0a1c', '#1a1236', '#2a1c52', '#120d26']
  };
  function lerpCol(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function groundTexture(L) {
    const th = L.theme.deco, pal = PAL[th].map(hex2rgb);
    const w = 250, h = 160;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), img = c.createImageData(w, h);
    const n1 = vnoise(L.seed), n2 = vnoise(L.seed + 99);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = fbm(n1, x / 26, y / 26, 5);
      const v2 = fbm(n2, x / 9, y / 9, 3);
      v = Math.max(0, Math.min(1, (v - 0.25) * 1.9));
      let col = v < 0.5 ? lerpCol(pal[0], pal[1], v * 2) : lerpCol(pal[1], pal[2], (v - 0.5) * 2);
      col = lerpCol(col, pal[3], Math.max(0, v2 - 0.55) * 1.5);
      if (th === 'void') { const neb = Math.max(0, fbm(n2, x / 40 + 10, y / 40, 4) - 0.5) * 2.4; col = lerpCol(col, [120, 60, 200], Math.min(1, neb * 0.55)); }
      if (th === 'lava') { const heat = Math.max(0, fbm(n1, x / 50 + 7, y / 50, 3) - 0.55) * 2.2; col = lerpCol(col, [140, 40, 10], Math.min(0.6, heat)); }
      const i = (y * w + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    return cv;
  }
  function grainTexture(seed, alpha) {
    const w = 500, h = 320;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), img = c.createImageData(w, h);
    const rng = PD.rng(seed);
    for (let i = 0; i < w * h; i++) { const v = rng() < 0.5 ? 0 : 255; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = rng() * 255 * alpha; }
    c.putImageData(img, 0, 0);
    return cv;
  }
  function nearPath(paths, x, y, m) {
    for (const p of paths) for (const s of p.segs) if (!s.jump && PD.distSeg(x, y, s.ax, s.ay, s.bx, s.by) < PD.PATH_HALF + m) return true;
    return false;
  }
  function strokePath(c, p) {
    c.beginPath();
    let started = false;
    for (const pt of p.pts) { if (!started || pt[2]) { c.moveTo(pt[0], pt[1]); started = true; } else c.lineTo(pt[0], pt[1]); }
  }
  function pathSamples(paths, step) {
    const out = [];
    for (const p of paths) for (const s of p.segs) {
      if (s.jump || s.len === 0) continue;
      const nx = -Math.sin(s.ang), ny = Math.cos(s.ang);
      for (let d = 0; d < s.len; d += step) out.push([s.ax + Math.cos(s.ang) * d, s.ay + Math.sin(s.ang) * d, nx, ny, s.ang]);
    }
    return out;
  }

  // ----------------------- decoración del terreno ------------------------
  function tree(c, x, y, s, rng) {
    ell(c, x + s * 0.5, y + s * 0.55, s * 1.05, s * 0.6, 0, 'rgba(0,0,0,0.28)');
    c.fillStyle = '#5a3a1e'; c.fillRect(x - s * 0.12, y, s * 0.24, s * 0.5);
    const greens = ['#2a6e2a', '#3a8a35', '#4fa244'];
    const blobs = [[0, -s * 0.2, s * 0.75], [-s * 0.45, s * 0.05, s * 0.55], [s * 0.45, s * 0.05, s * 0.55], [0, s * 0.2, s * 0.55], [-s * 0.15, -s * 0.5, s * 0.5]];
    for (const [bx, by, br] of blobs) circle(c, x + bx, y + by, br, sg(c, x + bx, y + by, br, greens[(rng() * 3) | 0], 0.35, -0.45));
    for (let i = 0; i < 4; i++) circle(c, x + (rng() - 0.6) * s * 0.8, y + (rng() - 0.7) * s * 0.7, s * 0.12, 'rgba(180,255,140,0.3)');
    if (rng() < 0.4) for (let i = 0; i < 3; i++) circle(c, x + (rng() - 0.5) * s, y + (rng() - 0.6) * s * 0.8, 1.6, '#ff4a4a');
  }
  function bush(c, x, y, s, rng, cols) {
    ell(c, x + 3, y + 4, s * 1.1, s * 0.6, 0, 'rgba(0,0,0,0.25)');
    for (let i = 0; i < 4; i++) circle(c, x + (i - 1.5) * s * 0.45, y + (i % 2) * s * 0.2 - s * 0.1, s * 0.55, sg(c, x, y, s * 0.6, cols[i % cols.length], 0.3, -0.4));
    if (rng() < 0.6) for (let i = 0; i < 4; i++) circle(c, x + (rng() - 0.5) * s * 1.6, y + (rng() - 0.6) * s * 0.8, 1.4, rng() < 0.5 ? '#ffe0f0' : '#fff27a');
  }
  function rockDeco(c, x, y, s, col, rng) {
    ell(c, x + s * 0.3, y + s * 0.4, s * 1.1, s * 0.6, 0, 'rgba(0,0,0,0.3)');
    const pts = []; for (let i = 0; i < 7; i++) { const a = i * TAU / 7, r = s * (0.75 + rng() * 0.35); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8]); }
    shape(c, pts, sg(c, x, y, s, col, 0.3, -0.5), shade(col, -0.6), 1.2);
    shape(c, [[x - s * 0.4, y - s * 0.3], [x + s * 0.1, y - s * 0.55], [x + s * 0.3, y - s * 0.1], [x - s * 0.2, y]], 'rgba(255,255,255,0.15)');
  }
  function cactus(c, x, y, s) {
    ell(c, x + s * 0.5, y + s * 0.9, s * 0.6, s * 0.25, 0, 'rgba(0,0,0,0.25)');
    const g = lg(c, x - s * 0.2, 0, x + s * 0.2, 0, ['#3a7a2a', '#6aae4a', '#2a5a1e']);
    rrect(c, x - s * 0.18, y - s, s * 0.36, s * 1.9, s * 0.18, g, '#1a3a10', 1);
    rrect(c, x - s * 0.65, y - s * 0.55, s * 0.28, s * 0.75, s * 0.14, g, '#1a3a10', 1);
    rrect(c, x - s * 0.65, y + 0.1 * s, s * 0.55, s * 0.24, s * 0.12, g, '#1a3a10', 1);
    rrect(c, x + s * 0.38, y - s * 0.75, s * 0.28, s * 0.65, s * 0.14, g, '#1a3a10', 1);
    rrect(c, x + s * 0.1, y - s * 0.2, s * 0.55, s * 0.24, s * 0.12, g, '#1a3a10', 1);
    circle(c, x, y - s * 1.0, 2, '#ff6aa0');
  }
  function pine(c, x, y, s) {
    ell(c, x + s * 0.4, y + s * 0.45, s * 0.9, s * 0.45, 0, 'rgba(20,40,70,0.25)');
    for (let i = 0; i < 3; i++) {
      const r = s * (1 - i * 0.28);
      star(c, x, y - i * s * 0.12, r, r * 0.62, 9, i * 0.2, sg(c, x, y - i * s * 0.12, r, '#3f8a68', 0.35, -0.4), '#1a4a36', 0.8);
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + i * 0.2; circle(c, x + Math.cos(a) * r * 0.75, y - i * s * 0.12 + Math.sin(a) * r * 0.75, r * 0.12, 'rgba(255,255,255,0.85)'); }
    }
    circle(c, x, y - s * 0.3, s * 0.12, '#ffffff');
  }
  function iceSpike(c, x, y, s) {
    ell(c, x + s * 0.3, y + s * 0.3, s * 0.8, s * 0.4, 0, 'rgba(40,90,140,0.2)');
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.5, l = s * (1 - Math.abs(i - 1) * 0.3);
      c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
      shape(c, [[-s * 0.22, 0], [0, -l * 1.3], [s * 0.22, 0]], lg(c, -s * 0.2, 0, s * 0.2, 0, ['#ffffff', '#bfe8ff', '#6fb0e0']), '#4a8ac0', 0.8);
      c.restore();
    }
  }
  function basalt(c, x, y, s, rng) {
    ell(c, x + s * 0.4, y + s * 0.5, s * 1.1, s * 0.6, 0, 'rgba(0,0,0,0.4)');
    for (let i = 0; i < 4; i++) {
      const bx = x + (i % 2) * s * 0.7 - s * 0.35, by = y + Math.floor(i / 2) * s * 0.6 - s * 0.3, r = s * (0.38 + rng() * 0.1);
      poly(c, bx, by, r, 6, 0, sg(c, bx, by, r, '#3a302c', 0.25, -0.5), '#120c0a', 1);
    }
  }
  function deadTree(c, x, y, s) {
    ell(c, x + s * 0.5, y + s * 0.5, s * 0.8, s * 0.35, 0, 'rgba(0,0,0,0.35)');
    c.strokeStyle = '#1a100c'; c.lineCap = 'round';
    const br = (x0, y0, a, l, w, d) => { if (d > 3) return; const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); br(x1, y1, a - 0.5, l * 0.65, w * 0.6, d + 1); br(x1, y1, a + 0.45, l * 0.6, w * 0.6, d + 1); };
    br(x, y, -Math.PI / 2, s * 0.7, 3, 0);
  }
  function voidCrystal(c, x, y, s, rng, k) {
    c.save(); c.shadowColor = rng() < 0.5 ? '#b47cff' : '#5ad1ff'; c.shadowBlur = 12 * k;
    for (let i = 0; i < 3; i++) {
      c.save(); c.translate(x + (i - 1) * s * 0.4, y); c.rotate((i - 1) * 0.35);
      shape(c, [[-s * 0.2, 0], [0, -s * (1.1 - Math.abs(i - 1) * 0.35)], [s * 0.2, 0], [0, s * 0.25]], lg(c, -s * 0.2, 0, s * 0.2, 0, ['#e0d0ff', '#9a6aff', '#3a1a7a']), '#1a0a3a', 0.8);
      c.restore();
    }
    c.restore();
  }
  function runeCircle(c, x, y, s) {
    c.save(); c.globalAlpha = 0.4;
    circle(c, x, y, s, null, '#9a7aff', 1); circle(c, x, y, s * 0.75, null, '#9a7aff', 0.8);
    star(c, x, y, s * 0.72, s * 0.3, 5, 0, null, '#9a7aff', 0.8);
    c.restore();
  }
  function bones(c, x, y, s) {
    c.strokeStyle = '#f2ead6'; c.lineWidth = 2.2; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x, y + i * 3, s * (1 - i * 0.15), Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    c.beginPath(); c.moveTo(x - s * 0.9, y + 1); c.lineTo(x + s * 0.9, y + 8); c.stroke();
    circle(c, x + s * 1.1, y + 9, 4, '#f2ead6', '#a89a80', 0.8);
  }
  function palm(c, x, y, s) {
    ell(c, x + s * 0.6, y + s * 0.3, s * 0.9, s * 0.3, 0, 'rgba(0,0,0,0.2)');
    c.strokeStyle = '#7a5530'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 2, y - s * 0.5, x + 3, y - s); c.stroke();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.save(); c.translate(x + 3, y - s); c.rotate(a); leaf(c, s * 0.75, s * 0.2, '#3f8f2a'); c.restore(); }
    circle(c, x + 3, y - s, 2.5, '#6a4a20');
  }

  function drawObstacle(c, o, theme, rng, k) {
    const r = o.r;
    if (o.kind === 'lake' || o.kind === 'oasis') {
      circle(c, o.x, o.y, r + 9, o.kind === 'oasis' ? '#d9c08a' : '#6a8a3a');
      circle(c, o.x, o.y, r + 5, o.kind === 'oasis' ? '#bfa26a' : '#4a6a2a');
      const g = c.createRadialGradient(o.x, o.y, r * 0.1, o.x, o.y, r);
      g.addColorStop(0, '#0e4a8a'); g.addColorStop(0.7, '#2a7ac0'); g.addColorStop(1, '#5ab8e8');
      circle(c, o.x, o.y, r, g);
      c.globalAlpha = 0.25; for (let i = 0; i < 4; i++) ell(c, o.x - r * 0.2 + i * 6, o.y - r * 0.3 + i * r * 0.2, r * 0.4, r * 0.08, 0, '#ffffff'); c.globalAlpha = 1;
      if (o.kind === 'lake') for (let i = 0; i < 3; i++) { const a = rng() * TAU, d = r * (0.3 + rng() * 0.45); const lx = o.x + Math.cos(a) * d, ly = o.y + Math.sin(a) * d; c.beginPath(); c.moveTo(lx, ly); c.arc(lx, ly, 5, 0.4, TAU - 0.2); c.closePath(); c.fillStyle = '#3f9a35'; c.fill(); if (rng() < 0.5) circle(c, lx + 1, ly - 1, 1.8, '#ffb0e0'); }
      for (let i = 0; i < 6; i++) { const a = rng() * TAU; const rx = o.x + Math.cos(a) * (r + 3), ry = o.y + Math.sin(a) * (r + 3); c.strokeStyle = '#2a5a1a'; c.lineWidth = 1.2; for (let q = 0; q < 3; q++) { c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + (q - 1) * 2, ry - 7 - q); c.stroke(); } }
      if (o.kind === 'oasis') for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; palm(c, o.x + Math.cos(a) * (r + 6), o.y + Math.sin(a) * (r + 6), 14); }
    } else if (o.kind === 'rock') {
      rockDeco(c, o.x, o.y, r, theme === 'ice' ? '#8a9aaa' : theme === 'lava' ? '#3a302c' : theme === 'void' ? '#3a3050' : '#8a8478', rng);
      rockDeco(c, o.x + r * 0.6, o.y + r * 0.4, r * 0.5, theme === 'ice' ? '#9aaabb' : theme === 'lava' ? '#2e2420' : '#9a9488', rng);
      if (theme === 'grass') for (let i = 0; i < 3; i++) circle(c, o.x - r * 0.3 + i * 4, o.y - r * 0.5, 3, 'rgba(70,140,60,0.8)');
      if (theme === 'ice') ell(c, o.x - r * 0.1, o.y - r * 0.5, r * 0.6, r * 0.25, 0, 'rgba(255,255,255,0.9)');
    } else if (o.kind === 'ice') {
      circle(c, o.x, o.y, r + 6, '#ffffff');
      const g = c.createRadialGradient(o.x - r * 0.3, o.y - r * 0.3, r * 0.1, o.x, o.y, r);
      g.addColorStop(0, '#f2fbff'); g.addColorStop(0.6, '#a9d8f2'); g.addColorStop(1, '#6aaed8');
      circle(c, o.x, o.y, r, g, '#8ac4e8', 2);
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) { let x = o.x + (rng() - 0.5) * r, y = o.y + (rng() - 0.5) * r; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 3; q++) { x += (rng() - 0.5) * r * 0.6; y += (rng() - 0.5) * r * 0.6; c.lineTo(x, y); } c.stroke(); }
    } else if (o.kind === 'lava') {
      c.save(); c.shadowColor = '#ff5a10'; c.shadowBlur = 30 * k;
      circle(c, o.x, o.y, r + 7, '#1c0e0a'); c.restore();
      const g = c.createRadialGradient(o.x, o.y, 2, o.x, o.y, r);
      g.addColorStop(0, '#fff2a0'); g.addColorStop(0.35, '#ffb020'); g.addColorStop(0.75, '#ff5a10'); g.addColorStop(1, '#a01a08');
      circle(c, o.x, o.y, r, g);
      for (let i = 0; i < 5; i++) { const a = rng() * TAU, d = r * (0.3 + rng() * 0.5); poly(c, o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, 3 + rng() * 5, 5, rng(), 'rgba(60,20,10,0.75)'); }
      for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + rng() * 0.3; rockDeco(c, o.x + Math.cos(a) * (r + 4), o.y + Math.sin(a) * (r + 4), 5 + rng() * 3, '#2a1c18', rng); }
    } else if (o.kind === 'rift') {
      c.save(); c.shadowColor = '#b47cff'; c.shadowBlur = 25 * k;
      const pts = []; for (let i = 0; i < 12; i++) { const a = i * TAU / 12, rr = r * (i % 2 ? 0.55 : 1) * (0.85 + rng() * 0.3); pts.push([o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr]); }
      shape(c, pts, '#05010d', '#c9a7ff', 2);
      c.restore();
      for (let i = 0; i < 18; i++) circle(c, o.x + (rng() - 0.5) * r, o.y + (rng() - 0.5) * r, rng() * 1.3 + 0.3, rng() < 0.4 ? '#ff9ae8' : '#ffffff');
    }
  }

  function drawGate(c, p, end, theme, k) {
    const pts = p.pts;
    const a = end ? pts[pts.length - 2] : pts[1], b = end ? pts[pts.length - 1] : pts[0];
    const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
    let t = 0, x = b[0], y = b[1];
    for (let i = 0; i < 60; i++) { if (x >= 6 && x <= W - 6 && y >= 6 && y <= H - 6) break; t += 2; x = b[0] + Math.cos(ang) * t; y = b[1] + Math.sin(ang) * t; }
    x += Math.cos(ang) * 14; y += Math.sin(ang) * 14;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const col = end ? '#5ad1ff' : '#ff4a4a';
    const stone = theme === 'void' ? '#3a2a5a' : theme === 'ice' ? '#a0b4c8' : theme === 'lava' ? '#3a2a24' : '#8a8070';
    for (const s of [-1, 1]) {
      const px = x + nx * s * (PD.PATH_HALF + 9), py = y + ny * s * (PD.PATH_HALF + 9);
      ell(c, px + 4, py + 5, 11, 7, 0, 'rgba(0,0,0,0.35)');
      poly(c, px, py, 10, 6, 0, sg(c, px, py, 10, stone, 0.35, -0.5), shade(stone, -0.6), 1.5);
      c.save(); c.shadowColor = col; c.shadowBlur = 14 * k;
      poly(c, px, py - 2, 5.5, 4, 0, lg(c, px - 5, py, px + 5, py, ['#ffffff', col, shade(col, -0.5)]), shade(col, -0.6), 1);
      c.restore();
    }
    return { x, y, col };
  }

  function paintBackground(ctx, L, paths) {
    const th = L.theme, deco = th.deco;
    const rng = PD.rng(L.seed * 7 + 3);
    const T = ctx.getTransform();
    const k = T.a || 1;
    // 1. terreno con ruido
    const gt = groundTexture(L);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(gt, 0, 0, W, H);
    ctx.globalAlpha = deco === 'void' ? 0.05 : 0.09;
    ctx.drawImage(grainTexture(L.seed + 5, 0.5), 0, 0, W, H);
    ctx.globalAlpha = 1;
    // 2. detalles del suelo
    const free = (x, y, m) => !nearPath(paths, x, y, m) && !L.obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + m);
    if (deco === 'grass') {
      ctx.lineWidth = 1;
      for (let i = 0; i < 1400; i++) {
        const x = rng() * W, y = rng() * H; if (!free(x, y, 4)) continue;
        ctx.strokeStyle = rng() < 0.5 ? 'rgba(120,200,90,0.55)' : 'rgba(25,80,25,0.5)';
        ctx.beginPath(); for (let b = 0; b < 3; b++) { ctx.moveTo(x + b * 1.5, y); ctx.lineTo(x + b * 1.5 + (rng() - 0.5) * 4, y - 3 - rng() * 4); } ctx.stroke();
      }
      for (let i = 0; i < 26; i++) {
        const x = rng() * W, y = rng() * H; if (!free(x, y, 10)) continue;
        const col = ['#ffffff', '#fff27a', '#ff9ad8', '#9ad0ff'][(rng() * 4) | 0];
        for (let f = 0; f < 6; f++) { const fx = x + (rng() - 0.5) * 22, fy = y + (rng() - 0.5) * 14; for (let pp = 0; pp < 5; pp++) { const a = pp * TAU / 5; circle(ctx, fx + Math.cos(a) * 1.5, fy + Math.sin(a) * 1.5, 1.2, col); } circle(ctx, fx, fy, 0.9, '#ffcc33'); }
      }
    } else if (deco === 'sand') {
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 160; i++) {
        const x = rng() * W, y = rng() * H; if (!free(x, y, 6)) continue;
        const l = 15 + rng() * 30;
        ctx.strokeStyle = 'rgba(150,100,40,0.35)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + l * 0.3, y - 4, x + l * 0.6, y + 4, x + l, y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,200,0.35)'; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.bezierCurveTo(x + l * 0.3, y - 2, x + l * 0.6, y + 6, x + l, y + 2); ctx.stroke();
      }
      for (let i = 0; i < 160; i++) { const x = rng() * W, y = rng() * H; if (free(x, y, 3)) circle(ctx, x, y, 0.8 + rng() * 1.6, rng() < 0.5 ? '#a8804a' : '#f5e0b0'); }
    } else if (deco === 'ice') {
      for (let i = 0; i < 34; i++) { const x = rng() * W, y = rng() * H; if (!free(x, y, 14)) continue; const rx = 22 + rng() * 34, ry = 7 + rng() * 9; ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); const gr = ctx.createRadialGradient(-rx * 0.2, -rx * 0.3, 1, 0, 0, rx); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.7, 'rgba(240,248,255,0.35)'); gr.addColorStop(1, 'rgba(240,248,255,0)'); circle(ctx, 0, 0, rx, gr); ctx.restore(); }
      ctx.strokeStyle = 'rgba(90,150,200,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) { let x = rng() * W, y = rng() * H; if (!free(x, y, 8)) continue; ctx.beginPath(); ctx.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (rng() - 0.5) * 30; y += (rng() - 0.5) * 30; ctx.lineTo(x, y); } ctx.stroke(); }
      for (let i = 0; i < 300; i++) { const x = rng() * W, y = rng() * H; if (free(x, y, 2)) { ctx.globalAlpha = 0.8; star(ctx, x, y, 1.6, 0.4, 4, 0, '#ffffff'); ctx.globalAlpha = 1; } }
    } else if (deco === 'lava') {
      ctx.save(); ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 8 * k;
      for (let i = 0; i < 45; i++) {
        let x = rng() * W, y = rng() * H; if (!free(x, y, 6)) continue;
        ctx.strokeStyle = '#120806'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) { x += (rng() - 0.5) * 34; y += (rng() - 0.5) * 34; ctx.lineTo(x, y); } ctx.stroke();
        ctx.strokeStyle = 'rgba(255,120,30,0.85)'; ctx.lineWidth = 1.1; ctx.stroke();
      }
      ctx.restore();
      for (let i = 0; i < 120; i++) { const x = rng() * W, y = rng() * H; if (free(x, y, 3)) circle(ctx, x, y, 1 + rng() * 2, rng() < 0.15 ? 'rgba(255,140,40,0.7)' : 'rgba(10,6,5,0.5)'); }
    } else if (deco === 'void') {
      for (let i = 0; i < 380; i++) { const x = rng() * W, y = rng() * H; const s = rng(); ctx.globalAlpha = 0.3 + s * 0.7; circle(ctx, x, y, s * 1.4 + 0.2, rng() < 0.25 ? '#c9a7ff' : rng() < 0.3 ? '#9ae8ff' : '#ffffff'); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(120,90,220,0.08)'; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let i = 0; i < 7; i++) { const x = rng() * W, y = rng() * H; if (free(x, y, 30)) runeCircle(ctx, x, y, 18 + rng() * 14); }
    }

    // 3. camino
    const pw = PD.PATH_HALF * 2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16 * k; ctx.shadowOffsetY = 3 * k;
    for (const p of paths) { strokePath(ctx, p); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = pw + 12; ctx.stroke(); }
    ctx.restore();
    if (deco === 'void') { ctx.save(); ctx.shadowColor = '#8a6bff'; ctx.shadowBlur = 14 * k; }
    for (const p of paths) { strokePath(ctx, p); ctx.strokeStyle = th.pathEdge; ctx.lineWidth = pw + 9; ctx.stroke(); }
    if (deco === 'void') ctx.restore();
    const layers = deco === 'lava' ? [[pw, '#2a120a'], [pw - 2, '#5a2410']] : [[pw + 1, shade(th.path, -0.3)], [pw - 4, th.path], [pw - 14, shade(th.path, 0.07)]];
    for (const [w, col] of layers) for (const p of paths) { strokePath(ctx, p); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); }
    if (deco === 'lava') { ctx.save(); ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 10 * k; for (const p of paths) { strokePath(ctx, p); ctx.strokeStyle = 'rgba(255,100,20,0.55)'; ctx.lineWidth = pw - 8; ctx.stroke(); } ctx.restore(); }

    // detalles del camino (se recortan con una máscara)
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const X = document.createElement('canvas'); X.width = cw; X.height = ch;
    const x = X.getContext('2d'); x.setTransform(T);
    const samples = pathSamples(paths, 7);
    const prng = PD.rng(L.seed + 17);
    if (deco === 'grass' || deco === 'sand') {
      for (const [sx, sy, nx, ny] of samples) for (let j = 0; j < 2; j++) {
        const o = (prng() - 0.5) * pw, px = sx + nx * o, py = sy + ny * o;
        const r = 0.8 + prng() * 2.2;
        if (prng() < 0.5) { ell(x, px + 0.6, py + 0.8, r, r * 0.7, 0, 'rgba(0,0,0,0.25)'); ell(x, px, py, r, r * 0.7, prng(), deco === 'sand' ? '#a8804a' : '#a39a88'); ell(x, px - r * 0.3, py - r * 0.3, r * 0.4, r * 0.25, 0, 'rgba(255,255,255,0.35)'); }
        else circle(x, px, py, r * 2, deco === 'sand' ? 'rgba(150,100,50,0.12)' : 'rgba(90,60,30,0.12)');
      }
      if (deco === 'sand') { x.strokeStyle = 'rgba(110,70,30,0.25)'; x.lineWidth = 1; for (const [sx, sy, nx, ny] of samples) if (prng() < 0.4) { x.beginPath(); x.moveTo(sx - nx * pw * 0.45, sy - ny * pw * 0.45); x.quadraticCurveTo(sx + 3, sy + 3, sx + nx * pw * 0.45, sy + ny * pw * 0.45); x.stroke(); } }
    } else if (deco === 'ice') {
      x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 1;
      for (const [sx, sy] of samples) if (prng() < 0.25) { let px = sx, py = sy; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 3; s++) { px += (prng() - 0.5) * 18; py += (prng() - 0.5) * 18; x.lineTo(px, py); } x.stroke(); }
      for (const [sx, sy, nx, ny] of samples) for (const s of [-1, 1]) if (prng() < 0.7) { x.globalAlpha = 0.75; circle(x, sx + nx * s * (pw / 2 - 2), sy + ny * s * (pw / 2 - 2), 4 + prng() * 4, '#ffffff'); x.globalAlpha = 1; }
    } else if (deco === 'lava') {
      for (const [sx, sy, nx, ny, a] of pathSamples(paths, 9)) for (let j = -2; j <= 2; j++) {
        const o = j * 8 + (prng() - 0.5) * 2, px = sx + nx * o, py = sy + ny * o;
        x.save(); x.translate(px, py); x.rotate(a + (prng() - 0.5) * 0.3);
        rrect(x, -4, -3.4, 8, 6.8, 2, lg(x, 0, -3.4, 0, 3.4, ['#5a4a44', '#3a2e2a', '#241a16']), '#120a08', 0.6);
        x.restore();
      }
    } else if (deco === 'void') {
      for (let yy = -20; yy < H + 20; yy += 18) for (let xx = ((yy / 18) % 2 ? 10 : 0) - 20; xx < W + 20; xx += 20) poly(x, xx, yy, 10.5, 6, Math.PI / 6, null, 'rgba(160,130,255,0.25)', 0.8);
      x.save(); x.shadowColor = '#b47cff'; x.shadowBlur = 8 * k;
      for (const [sx, sy] of samples) if (prng() < 0.06) star(x, sx, sy, 3, 1.2, 4, 0, '#d8c4ff');
      x.restore();
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'destination-in';
    const M = document.createElement('canvas'); M.width = cw; M.height = ch;
    const m = M.getContext('2d'); m.setTransform(T); m.lineCap = 'round'; m.lineJoin = 'round';
    for (const p of paths) { strokePath(m, p); m.strokeStyle = '#fff'; m.lineWidth = pw - 3; m.stroke(); }
    x.drawImage(M, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(X, 0, 0); ctx.restore();

    // bordes del camino
    const edge = pathSamples(paths, 11);
    for (const [sx, sy, nx, ny] of edge) for (const s of [-1, 1]) {
      const ex = sx + nx * s * (PD.PATH_HALF + 4) + (rng() - 0.5) * 3, ey = sy + ny * s * (PD.PATH_HALF + 4) + (rng() - 0.5) * 3;
      if (nearPath(paths, ex, ey, 1)) continue;
      if (deco === 'grass') {
        ctx.strokeStyle = rng() < 0.5 ? '#5fbf4a' : '#2e7a2a'; ctx.lineWidth = 1.2;
        ctx.beginPath(); for (let b = 0; b < 4; b++) { ctx.moveTo(ex + (b - 1.5) * 1.6, ey); ctx.lineTo(ex + (b - 1.5) * 2.4 + (rng() - 0.5) * 2, ey - 4 - rng() * 5); } ctx.stroke();
        if (rng() < 0.08) rockDeco(ctx, ex, ey, 3 + rng() * 2, '#a39a88', rng);
      } else if (deco === 'sand') { if (rng() < 0.35) rockDeco(ctx, ex, ey, 2 + rng() * 2.5, '#b8945a', rng); }
      else if (deco === 'ice') { const rr = 6 + rng() * 5; ctx.globalAlpha = 0.95; circle(ctx, ex, ey, rr, sg(ctx, ex, ey, rr, '#f4f9ff', 0.4, -0.1)); ctx.globalAlpha = 1; }
      else if (deco === 'lava') { if (rng() < 0.4) rockDeco(ctx, ex, ey, 2.5 + rng() * 3, '#2e2420', rng); }
      else if (deco === 'void') { if (rng() < 0.18) { ctx.save(); ctx.shadowColor = '#5ad1ff'; ctx.shadowBlur = 8 * k; poly(ctx, ex, ey, 2.5, 4, 0, '#bff8ff'); ctx.restore(); } }
    }

    // 4. obstáculos
    const orng = PD.rng(L.seed + 3);
    for (const o of L.obstacles) drawObstacle(ctx, o, deco, orng, k);

    // 5. decoración grande (ordenada por y)
    const items = [];
    for (let i = 0; i < 500 && items.length < 70; i++) {
      const xx = rng() * (W + 40) - 20, yy = rng() * (H + 40) - 20;
      const s = 11 + rng() * 11;
      if (nearPath(paths, xx, yy, 40 + s)) continue;
      if (L.obstacles.some(o => Math.hypot(o.x - xx, o.y - yy) < o.r + s + 12)) continue;
      if (items.some(it => Math.hypot(it[0] - xx, it[1] - yy) < it[2] + s + 4)) continue;
      items.push([xx, yy, s, rng()]);
    }
    items.sort((a, b) => a[1] - b[1]);
    for (const [xx, yy, s, v] of items) {
      if (deco === 'grass') { if (v < 0.55) tree(ctx, xx, yy, s, rng); else if (v < 0.85) bush(ctx, xx, yy, s * 0.7, rng, ['#2f8a3a', '#3fa34d', '#287a30']); else rockDeco(ctx, xx, yy, s * 0.6, '#9a9488', rng); }
      else if (deco === 'sand') { if (v < 0.45) cactus(ctx, xx, yy, s); else if (v < 0.65) bones(ctx, xx, yy, s * 0.6); else if (v < 0.8) palm(ctx, xx, yy, s * 1.1); else rockDeco(ctx, xx, yy, s * 0.7, '#b8945a', rng); }
      else if (deco === 'ice') { if (v < 0.55) pine(ctx, xx, yy, s); else if (v < 0.85) iceSpike(ctx, xx, yy, s * 0.8); else rockDeco(ctx, xx, yy, s * 0.7, '#8a9aaa', rng); }
      else if (deco === 'lava') { if (v < 0.45) basalt(ctx, xx, yy, s, rng); else if (v < 0.75) deadTree(ctx, xx, yy, s * 1.2); else rockDeco(ctx, xx, yy, s * 0.7, '#3a302c', rng); }
      else if (deco === 'void') { if (v < 0.6) voidCrystal(ctx, xx, yy, s, rng, k); else rockDeco(ctx, xx, yy, s * 0.6, '#3a3050', rng); }
    }

    // 6. puertas de entrada y salida
    const gates = [];
    for (const p of paths) {
      const st = drawGate(ctx, p, false, deco, k);
      if (!gates.some(g => Math.hypot(g.x - st.x, g.y - st.y) < 10)) gates.push(st);
      const en = drawGate(ctx, p, true, deco, k);
      if (!gates.some(g => Math.hypot(g.x - en.x, g.y - en.y) < 10)) gates.push(en);
    }

    // 7. iluminación
    const tint = { grass: 'rgba(255,240,180,0.10)', sand: 'rgba(255,200,120,0.12)', ice: 'rgba(200,230,255,0.12)', lava: 'rgba(255,90,20,0.10)', void: 'rgba(140,90,255,0.08)' }[deco];
    const lgt = ctx.createLinearGradient(0, 0, W, H); lgt.addColorStop(0, tint); lgt.addColorStop(0.6, 'rgba(0,0,0,0)');
    ctx.fillStyle = lgt; ctx.fillRect(0, 0, W, H);
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, deco === 'ice' ? 'rgba(20,50,90,0.35)' : 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    return gates;
  }

  // miniaturas cacheadas para la selección de nivel
  const THUMBS = {};
  PD.levelThumb = function (li, w, h) {
    const key = li + ':' + w;
    if (THUMBS[key]) return THUMBS[key];
    const L = PD.LEVELS[li];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.scale(w / W, h / H);
    paintBackground(c, L, L.paths.map(PD.buildPath));
    return (THUMBS[key] = cv);
  };

  // ----------------------------- ambiente --------------------------------
  function hash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function ambientUnder(ctx, g, t, gates) {
    const L = g.L, deco = L.theme.deco;
    if (deco === 'grass' || deco === 'sand' || deco === 'ice') {
      for (let i = 0; i < 3; i++) {
        const x = ((hash(i) * W + t * (6 + i * 2)) % (W + 500)) - 250, y = hash(i + 7) * H;
        const gr = ctx.createRadialGradient(x, y, 10, x, y, 190);
        gr.addColorStop(0, 'rgba(0,10,30,0.10)'); gr.addColorStop(1, 'rgba(0,10,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - 190, y - 190, 380, 380);
      }
    }
    for (const o of L.obstacles) {
      if (o.kind === 'lake' || o.kind === 'oasis') {
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) { const ph = (t * 0.35 + i / 3) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.6; circle(ctx, o.x + (hash(i + o.x) - 0.5) * o.r, o.y + (hash(i + o.y) - 0.5) * o.r * 0.8, 3 + ph * 10, null, 'rgba(255,255,255,0.8)', 1.2); }
        ctx.globalAlpha = 1;
      } else if (o.kind === 'lava') {
        const pu = 0.5 + 0.5 * Math.sin(t * 2 + o.x);
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, o.r * 1.8);
        gr.addColorStop(0, `rgba(255,160,40,${0.25 + pu * 0.2})`); gr.addColorStop(1, 'rgba(255,60,0,0)');
        circle(ctx, o.x, o.y, o.r * 1.8, gr);
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 2; i++) { const ph = (t * 0.5 + i * 0.5 + hash(o.x)) % 1; ctx.globalAlpha = 1 - ph; circle(ctx, o.x + (hash(i + o.y) - 0.5) * o.r, o.y + (hash(i * 3 + o.x) - 0.5) * o.r, 2 + ph * 5, null, '#ffe08a', 1.2); }
        ctx.globalAlpha = 1;
      } else if (o.kind === 'rift') {
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(t * 0.8);
        ctx.strokeStyle = 'rgba(200,160,255,0.6)'; ctx.lineWidth = 1.2;
        for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.arc(0, 0, o.r * (0.3 + q * 0.2), q * 2, q * 2 + 2.2); ctx.stroke(); }
        ctx.restore();
      }
    }
    if (gates) for (const gt of gates) {
      const pu = 0.5 + 0.5 * Math.sin(t * 3 + gt.x);
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(gt.x, gt.y, 2, gt.x, gt.y, 46);
      gr.addColorStop(0, rgba(gt.col, 0.18 + pu * 0.15)); gr.addColorStop(1, rgba(gt.col, 0));
      circle(ctx, gt.x, gt.y, 46, gr);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const p of g.paths) for (let i = 1; i < p.pts.length; i++) if (p.pts[i][2]) {
      const a = p.pts[i - 1], b = p.pts[i];
      for (const [x, y, col, dir] of [[a[0], a[1], '#ff5ad1', 1], [b[0], b[1], '#5ad1ff', -1]]) {
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(x, y, 2, x, y, 40);
        gr.addColorStop(0, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 0));
        circle(ctx, x, y, 40, gr);
        ctx.globalCompositeOperation = 'source-over';
        circle(ctx, x, y, 22, 'rgba(5,0,15,0.85)');
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2.2 * dir);
        for (let q = 0; q < 4; q++) { ctx.strokeStyle = q % 2 ? '#ffffff' : col; ctx.lineWidth = 2.4 - q * 0.3; ctx.beginPath(); ctx.arc(0, 0, 6 + q * 5, q * 1.6, q * 1.6 + 3.8); ctx.stroke(); }
        ctx.restore();
        circle(ctx, x, y, 24, null, col, 2.5);
      }
    }
  }
  function weather(ctx, g, t) {
    const deco = g.L.theme.deco;
    if (deco === 'ice') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 90; i++) {
        const sp = 18 + hash(i) * 26, x = (hash(i + 3) * W + t * 12 + Math.sin(t + i) * 10) % W, y = (hash(i + 9) * H + t * sp) % H;
        ctx.globalAlpha = 0.4 + hash(i + 1) * 0.5; ctx.beginPath(); ctx.arc(x, y, 0.8 + hash(i + 5) * 1.6, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (deco === 'lava') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 45; i++) {
        const life = 4 + hash(i) * 4, ph = ((t + hash(i + 2) * life) % life) / life;
        const x = hash(i + 4) * W + Math.sin(t * 2 + i) * 8, y = H + 10 - ph * (H * 0.7) - hash(i + 6) * H * 0.4;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
        circle(ctx, x, y, 1 + hash(i + 8) * 1.6, hash(i) < 0.5 ? '#ffb040' : '#ff6a1a');
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (deco === 'sand') {
      ctx.strokeStyle = 'rgba(255,235,190,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const x = (hash(i) * W * 2 + t * (140 + hash(i + 1) * 120)) % (W + 200) - 100, y = hash(i + 4) * H + Math.sin(t + i) * 6;
        ctx.globalAlpha = 0.25 + hash(i + 2) * 0.35; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 30 - hash(i + 3) * 30, y + 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (deco === 'grass') {
      for (let i = 0; i < 8; i++) {
        const x = (hash(i) * W + Math.sin(t * 0.3 + i) * 120 + t * 10) % W, y = hash(i + 5) * H + Math.sin(t * 0.7 + i * 2) * 40;
        const f = Math.abs(Math.sin(t * 12 + i));
        ctx.fillStyle = ['#ffffff', '#ffe066', '#ff9ad8', '#9ad0ff'][i % 4]; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.ellipse(x - 2.5 * f, y, 2.5 * f + 0.4, 2, 0, 0, TAU); ctx.ellipse(x + 2.5 * f, y, 2.5 * f + 0.4, 2, 0, 0, TAU); ctx.fill();
      }
      for (let i = 0; i < 30; i++) { const x = (hash(i + 20) * W + t * 8) % W, y = (hash(i + 30) * H + Math.sin(t + i) * 10); ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + i); circle(ctx, x, y, 1, '#fffbd0'); }
      ctx.globalAlpha = 1;
    } else if (deco === 'void') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) {
        const x = (hash(i) * W + t * (5 + hash(i + 1) * 10)) % W, y = (hash(i + 2) * H - t * (4 + hash(i + 3) * 8) + H * 10) % H;
        ctx.globalAlpha = Math.max(0, 0.3 + 0.4 * Math.sin(t * 3 + i));
        circle(ctx, x, y, 1.2 + hash(i + 4) * 1.4, hash(i) < 0.5 ? '#b47cff' : '#5ad1ff');
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }

  // ---------------------------- partículas -------------------------------
  const P = [], DEC = [];
  function addP(o) { if (P.length < 900) P.push(o); }
  function spawnFx(f) {
    switch (f.k) {
      case 'boom': {
        const n = Math.min(14, 5 + f.r / 6);
        for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 60 + Math.random() * 160; addP({ k: 'spark', x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, T: 0.3 + Math.random() * 0.3, c: Math.random() < 0.5 ? '#ffe08a' : f.color }); }
        for (let i = 0; i < 4; i++) { const a = Math.random() * TAU; addP({ k: 'smoke', x: f.x + Math.cos(a) * f.r * 0.3, y: f.y + Math.sin(a) * f.r * 0.3, vx: Math.cos(a) * 15, vy: Math.sin(a) * 15 - 10, t: 0, T: 0.8 + Math.random() * 0.5, r: f.r * 0.35 }); }
        if (DEC.length < 50) DEC.push({ x: f.x, y: f.y, r: f.r * 0.6, t: 0, T: 6, c: 'rgba(20,10,5,' });
        break;
      }
      case 'pop': {
        const n = f.big ? 22 : 7;
        for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = (f.big ? 80 : 40) + Math.random() * (f.big ? 200 : 90); addP({ k: 'gib', x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, T: 0.35 + Math.random() * 0.35, c: f.color, r: 1.2 + Math.random() * (f.big ? 3.5 : 2) }); }
        addP({ k: 'flash', x: f.x, y: f.y, t: 0, T: f.big ? 0.35 : 0.15, r: f.r * (f.big ? 2.4 : 1.4) });
        if (DEC.length < 50) DEC.push({ x: f.x, y: f.y, r: f.r * 0.8, t: 0, T: f.big ? 8 : 4, c: f.color });
        if (f.big) for (let i = 0; i < 6; i++) { const a = Math.random() * TAU; addP({ k: 'smoke', x: f.x, y: f.y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, t: 0, T: 1.2, r: f.r * 0.5 }); }
        break;
      }
      case 'puff': for (let i = 0; i < 8; i++) { const a = i * TAU / 8; addP({ k: 'gib', x: f.x, y: f.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, t: 0, T: 0.4, c: f.color, r: 2 }); } break;
      case 'dust': for (let i = 0; i < 6; i++) { const a = Math.random() * TAU; addP({ k: 'smoke', x: f.x, y: f.y, vx: Math.cos(a) * 25, vy: Math.sin(a) * 25, t: 0, T: 0.6, r: 6, c: 'rgba(120,90,55,' }); } break;
    }
  }
  function updateParticles(dt) {
    for (const p of P) { p.t += dt; if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; } }
    for (let i = P.length - 1; i >= 0; i--) if (P[i].t >= P[i].T) P.splice(i, 1);
    for (const d of DEC) d.t += dt;
    for (let i = DEC.length - 1; i >= 0; i--) if (DEC[i].t >= DEC[i].T) DEC.splice(i, 1);
  }
  function drawDecals(ctx) {
    for (const d of DEC) {
      const a = (1 - d.t / d.T) * 0.35;
      if (d.c[0] === '#') { ctx.globalAlpha = a; ell(ctx, d.x, d.y, d.r * 1.2, d.r * 0.9, 0, d.c); for (let i = 0; i < 3; i++) circle(ctx, d.x + Math.cos(i * 2.1 + d.x) * d.r * 1.3, d.y + Math.sin(i * 2.1 + d.y) * d.r, d.r * 0.25, d.c); }
      else { ctx.globalAlpha = 1; circle(ctx, d.x, d.y, d.r, d.c + a + ')'); }
    }
    ctx.globalAlpha = 1;
  }
  function drawParticles(ctx) {
    for (const p of P) {
      const k = p.t / p.T;
      if (p.k === 'smoke') { ctx.globalAlpha = (1 - k) * 0.35; circle(ctx, p.x, p.y, p.r * (0.6 + k * 1.2), (p.c || 'rgba(60,55,50,') + '1)'); }
      else if (p.k === 'gib') { ctx.globalAlpha = 1 - k; circle(ctx, p.x, p.y, p.r * (1 - k * 0.5), p.c); }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of P) {
      const k = p.t / p.T;
      if (p.k === 'spark') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.c; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); }
      else if (p.k === 'flash') { ctx.globalAlpha = (1 - k) * 0.8; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0)'); circle(ctx, p.x, p.y, p.r, g); }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // ----------------------------- enemigos --------------------------------
  const tp = { x: 0, y: 0, a: 0 };
  function drawEnemy(ctx, g, e, t) {
    const d = e.d, r = d.r;
    if (e.burrowed) {
      ctx.save(); ctx.translate(e.x, e.y);
      ell(ctx, 0, 2, r * 1.2, r * 0.75, 0, 'rgba(60,35,15,0.85)');
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t * 3; circle(ctx, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.55, 2.4, '#6a4a28'); }
      circle(ctx, 0, 0, r * 0.4, '#3a2410');
      ctx.restore(); return;
    }
    const fr = Math.floor((t * (d.boss ? 5 : 8) + e.wob) * FR / 6) % FR;
    if (d.shape === 'worm') {
      const seg = enemySprite(d, fr, 'wormSeg'), path = g.paths[e.path];
      for (let q = 6; q >= 1; q--) {
        PD.posAt(path, e.dist - q * r * 0.75, tp);
        const sc = 1 - q * 0.07;
        ctx.save(); ctx.translate(tp.x, tp.y); ctx.rotate(tp.a); ctx.scale(sc, sc); blit(ctx, seg); ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    if (d.flying) {
      ctx.globalAlpha = 0.28; ell(ctx, 8, 16, r * 1.1, r * 0.45, 0, '#000'); ctx.globalAlpha = 1;
      ctx.translate(0, -8 + Math.sin(t * 3 + e.wob) * 2);
    } else { ctx.globalAlpha = 0.3; ell(ctx, 2, r * 0.55, r * 1.05, r * 0.5, 0, '#000'); ctx.globalAlpha = 1; }
    if (e.liftT > 0) ctx.translate(0, -Math.sin(Math.min(1, e.liftT / 0.4) * Math.PI * 0.5) * 12);
    let alpha = 1;
    if (e.camo) alpha = e.lit || (e.hexT > 0 && e.hexReveal) ? 0.85 : 0.5 + 0.1 * Math.sin(t * 4 + e.wob);
    if (e.phased) alpha = 0.22 + 0.12 * Math.sin(t * 20);
    ctx.globalAlpha = alpha;
    const spin = SPIN[d.shape];
    const spr = enemySprite(d, fr);
    ctx.save();
    ctx.rotate(spin ? t * spin + e.wob : e.a);
    blit(ctx, spr);
    if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; blit(ctx, spr); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (e.camo) { ctx.save(); ctx.rotate(t); ctx.setLineDash([3, 4]); circle(ctx, 0, 0, r + 4, null, 'rgba(225,205,255,0.85)', 1.2); ctx.setLineDash([]); ctx.restore(); }
    if (e.frozenT > 0) {
      ctx.globalAlpha = 0.7;
      poly(ctx, 0, 0, r + 5, 6, 0.3, 'rgba(190,240,255,0.5)', '#ffffff', 1.6);
      shape(ctx, [[-r * 0.6, -r * 0.4], [-r * 0.1, -r * 0.8], [r * 0.2, -r * 0.3]], 'rgba(255,255,255,0.7)');
      ctx.globalAlpha = 1;
    } else if (e.slowT > 0 && e.slowF > 0) {
      for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; star(ctx, Math.cos(a) * (r + 3), Math.sin(a) * (r + 3), 2.6, 0.8, 4, 0, '#bff4ff'); }
    }
    if (e.burnT > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (let q = 0; q < 4; q++) { const ph = (t * 2.5 + q * 0.25) % 1, x = Math.sin(q * 2.7 + e.wob) * r * 0.6; ctx.globalAlpha = 1 - ph; ell(ctx, x, -r * 0.3 - ph * r * 1.2, 3 * (1 - ph) + 1, 4.5 * (1 - ph) + 1, 0, q % 2 ? '#ffd84d' : '#ff6a1a'); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (e.lit) { ctx.globalCompositeOperation = 'lighter'; circle(ctx, 0, 0, r + 3, 'rgba(255,245,190,0.16)'); ctx.globalCompositeOperation = 'source-over'; }
    if (e.wetT > 0) for (let q = 0; q < 3; q++) { const ph = (t * 1.8 + q / 3) % 1; ctx.globalAlpha = 1 - ph; ell(ctx, Math.sin(q * 2.2 + e.wob) * r * 0.7, -r * 0.2 + ph * r * 0.9, 1.4, 2.2, 0, '#9fe8ff', '#2a7aa8', 0.5); ctx.globalAlpha = 1; }
    if (e.corr > 0) {
      ctx.globalAlpha = 0.25 + Math.min(0.4, e.corr * 0.04); circle(ctx, 0, 0, r * 0.9, '#7ad82a'); ctx.globalAlpha = 1;
      for (let q = 0; q < Math.min(4, e.corr); q++) { const a = q * 1.7 + e.wob; ell(ctx, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.5 + r * 0.3, 1.3, 2.4, 0, '#b8ff4a', '#3a6a10', 0.5); }
    }
    if (e.hexT > 0) {
      ctx.save(); ctx.translate(0, -r - 9); ctx.rotate(t * 1.5);
      ctx.globalAlpha = Math.min(1, e.hexT * 2) * 0.9;
      circle(ctx, 0, 0, 5, null, '#c07bff', 1.2); star(ctx, 0, 0, 4.2, 1.6, 5, 0, null, '#e8c8ff', 0.8);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    if (e.engaged) { ctx.save(); ctx.rotate(t * 3); ctx.setLineDash([2, 3]); circle(ctx, 0, 0, r + 3, null, 'rgba(255,170,90,0.8)', 1.2); ctx.setLineDash([]); ctx.restore(); }
    if (e.poisT > 0) { for (let q = 0; q < 3; q++) { const ph = (t * 1.5 + q / 3) % 1; ctx.globalAlpha = 1 - ph; circle(ctx, Math.sin(q * 2 + e.wob) * r * 0.7, -r * 0.4 - ph * r, 1.8 + ph * 1.2, '#9dff4a', '#3a8a10', 0.6); } ctx.globalAlpha = 1; }
    if (e.stunT > 0) { for (let q = 0; q < 3; q++) { const a = t * 6 + q * 2.1; star(ctx, Math.cos(a) * r * 0.8, -r - 5 + Math.sin(a) * 3, 3.5, 1.5, 5, a, '#ffec5c', '#8a6a00', 0.6); } }
    if (e.shield > 0) {
      ctx.globalAlpha = 0.3 + 0.6 * (e.shield / e.maxShield);
      const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r + 5);
      gr.addColorStop(0, 'rgba(160,220,255,0.05)'); gr.addColorStop(0.8, 'rgba(90,170,255,0.25)'); gr.addColorStop(1, 'rgba(150,210,255,0.7)');
      circle(ctx, 0, 0, r + 5, gr, '#9fd8ff', 1.4);
      ctx.save(); ctx.rotate(t * 0.8); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; poly(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.3, 6, 0, null, 'rgba(200,240,255,0.5)', 0.7); } ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (e.invulnT > 0) { ctx.globalCompositeOperation = 'lighter'; circle(ctx, 0, 0, r + 8, null, '#ffd84d', 3); ctx.globalCompositeOperation = 'source-over'; }
    if (e.enraged) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 12); circle(ctx, 0, 0, r + 2, '#ff2020'); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (d.haste) { ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 4); circle(ctx, 0, 0, d.haste.radius, null, '#ff3d6e', 2); ctx.globalAlpha = 1; }
    if (!d.boss && (e.hp < e.maxHp - 0.01 || d.big)) {
      const bw = Math.max(20, r * 1.9), bx = -bw / 2, by = -r - 10 - (d.flying ? 4 : 0);
      rrect(ctx, bx - 1.5, by - 1.5, bw + 3, 6, 2, 'rgba(0,0,0,0.7)');
      const f = Math.max(0, e.hp / e.maxHp);
      const c1 = f > 0.5 ? '#5dff6a' : f > 0.25 ? '#ffd84d' : '#ff4a3a';
      ctx.fillStyle = c1; ctx.fillRect(bx, by, bw * f, 3);
      if (e.maxShield > 0 && e.shield > 0) { ctx.fillStyle = '#7cc4ff'; ctx.fillRect(bx, by - 2.5, bw * (e.shield / e.maxShield), 1.6); }
    }
    ctx.restore();
  }

  // ---------------------- murallas, sierras y luz -----------------------
  function drawGroundUnits(ctx, g, t) {
    for (const tw of g.towers) if (tw.def.kind === 'beacon') {
      // área iluminada del faro
      const R = tw.s.range, aur = tw.tiers[0] >= 4;
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(tw.x, tw.y, R * 0.2, tw.x, tw.y, R);
      gr.addColorStop(0, aur ? 'rgba(120,255,210,0.07)' : 'rgba(255,240,170,0.07)'); gr.addColorStop(0.85, aur ? 'rgba(120,255,210,0.05)' : 'rgba(255,240,170,0.045)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
      circle(ctx, tw.x, tw.y, R, gr);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const w of g.walls) {
      const k = w.grow, f = Math.max(0, w.hp / w.maxHp), fade = Math.min(1, w.life / 0.6);
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a + Math.PI / 2);
      ctx.globalAlpha = fade;
      ell(ctx, 0, 3, 22 * k, 7 * k, 0, 'rgba(30,18,6,0.4)');
      const big = w.src.tiers[0] >= 3, gold = w.src.tiers[0] >= 4;
      // raíces entrelazadas cruzando el camino
      for (let q = 0; q < 5; q++) {
        const y0 = (q - 2) * 3.2, ph = Math.sin(t * 2 + q + w.x) * 1.2;
        ctx.strokeStyle = q % 2 ? '#5a3a18' : '#7a5228'; ctx.lineWidth = (big ? 5 : 4) * k;
        ctx.beginPath(); ctx.moveTo(-24 * k, y0); ctx.quadraticCurveTo(0, y0 - 9 * k + ph, 24 * k, y0 + (q % 2 ? 2 : -2)); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,230,170,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-22 * k, -6); ctx.quadraticCurveTo(0, -15 * k, 22 * k, -6); ctx.stroke();
      for (let q = 0; q < (big ? 6 : 4); q++) { ctx.save(); ctx.translate((q - 2) * 9 * k, -7 * k); ctx.rotate(-Math.PI / 2 + (q % 2 ? 0.5 : -0.5)); leaf(ctx, 7 * k, 2.6 * k, gold ? '#ffd84d' : q % 2 ? '#5fbf4a' : '#8ad85a'); ctx.restore(); }
      if (w.src.s.thornDps) for (let q = 0; q < 5; q++) shape(ctx, [[(q - 2) * 9 - 1.5, -2], [(q - 2) * 9, -9 * k], [(q - 2) * 9 + 1.5, -2]], '#e8e0b0');
      ctx.restore();
      if (f < 0.999) {
        ctx.globalAlpha = fade;
        rrect(ctx, w.x - 12, w.y - 20, 24, 4, 2, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = '#9be36a'; ctx.fillRect(w.x - 11, w.y - 19, 22 * f, 2);
        ctx.globalAlpha = 1;
      }
    }
    for (const w of g.saws) {
      ctx.globalAlpha = 0.3; ell(ctx, w.x + 2, w.y + 4, w.r, w.r * 0.45, 0, '#000'); ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(-w.rot);
      sawBlade(ctx, w.r, w.src.tiers[0] >= 3 ? '#bff4ff' : '#dfe4ea', w.src.tiers[0] >= 4 ? '#c0302a' : '#3a4048');
      ctx.restore();
      if (Math.random() < 0.35) addP({ k: 'gib', x: w.x, y: w.y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 90, t: 0, T: 0.25, c: '#ffe08a', r: 1.2 });
    }
  }
  function drawGolem(ctx, gm, t) {
    const s = gm.src.s, big = gm.src.tiers[0] >= 3, titan = gm.src.tiers[0] >= 4, ign = !!s.golemBurn;
    const sc = titan ? 1.35 : big ? 1.15 : 1, fight = gm.engaged.length > 0;
    const step = fight ? 0 : Math.sin(t * 9 + gm.wob) * 1.2;
    ctx.save(); ctx.translate(gm.x, gm.y); ctx.scale(gm.face * sc, sc);
    ell(ctx, 0, 9, 10, 4, 0, 'rgba(0,0,0,0.35)');
    const rock = big ? '#2a2236' : '#5a4038', crack = ign ? '#ffcf4d' : '#ff7a2f';
    // piernas
    rrect(ctx, -6, 2 + step, 4.5, 7, 1.5, rock, '#120c0a', 0.8); rrect(ctx, 1.5, 2 - step, 4.5, 7, 1.5, rock, '#120c0a', 0.8);
    // torso
    poly(ctx, 0, -2, 8.5, 6, Math.PI / 6, sg(ctx, 0, -2, 8.5, rock, 0.35, -0.6), '#120c0a', 1);
    ctx.strokeStyle = crack; ctx.lineWidth = 1.1; glow(ctx, crack, 4);
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-1, -2); ctx.lineTo(-3, 2); ctx.moveTo(3, -7); ctx.lineTo(1, -3); ctx.stroke();
    noGlow(ctx);
    // cabeza y ojos
    poly(ctx, 0, -11, 4.5, 5, -Math.PI / 2, sg(ctx, 0, -11, 4.5, rock, 0.4), '#120c0a', 0.9);
    circle(ctx, 1.6, -11.5, 1.1, crack);
    // brazo con martillo
    const sw = gm.swing > 0 ? (1 - gm.swing / 0.22) * 1.6 - 0.8 : -0.5;
    ctx.save(); ctx.translate(6, -5); ctx.rotate(sw);
    rrect(ctx, -1.5, -1.5, 9, 3, 1.4, rock, '#120c0a', 0.7);
    rrect(ctx, 7, -4, 4.5, 8, 1.4, s.golemSplash ? '#8a929e' : rock, '#120c0a', 0.8);
    ctx.restore();
    if (titan) { glow(ctx, '#ffcf4d', 6); for (let i = 0; i < 3; i++) shape(ctx, [[-3 + i * 3, -15], [-2 + i * 3, -19], [-1 + i * 3, -15]], '#ffcf4d'); noGlow(ctx); }
    ctx.restore();
    if (gm.hp < gm.maxHp - 0.5) {
      const f = Math.max(0, gm.hp / gm.maxHp);
      rrect(ctx, gm.x - 10, gm.y - 22 * sc, 20, 4, 2, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = f > 0.5 ? '#ffb347' : '#ff5a3a'; ctx.fillRect(gm.x - 9, gm.y - 22 * sc + 1, 18 * f, 2);
    }
  }

  // ============================ FRAME ===================================
  const R = {
    bg: null, bgKey: '', gates: null, lastT: 0,
    frame(ctx, g, ui) {
      const t = ui && ui.vt !== undefined ? ui.vt : g.time;   // main.js: el reloj de la pantalla (el motor descansa entre rondas)
      const cw = ctx.canvas.width, ch = ctx.canvas.height;
      const key = g.li + ':' + cw + 'x' + ch;
      if (this.bgKey !== key) {
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const x = c.getContext('2d'); x.scale(cw / W, ch / H);
        this.gates = paintBackground(x, g.L, g.paths);
        this.bg = c; this.bgKey = key;
      }
      const dt = Math.max(0, Math.min(0.1, t - this.lastT)); this.lastT = t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.bg, 0, 0);
      ctx.setTransform(cw / W, 0, 0, ch / H, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      for (const f of g.fx) if (!f.sp) { f.sp = 1; spawnFx(f); }
      updateParticles(dt);

      ambientUnder(ctx, g, t, this.gates);
      drawDecals(ctx);
      for (const p of g.puddles) {
        const a = Math.min(1, p.t / 0.5);
        if (p.look === 'steam') {
          ctx.globalCompositeOperation = 'lighter';
          for (let q = 0; q < 5; q++) { const ph = (t * 0.6 + q / 5) % 1, x = p.x + Math.sin(q * 2.3 + p.x) * p.r * 0.5, y = p.y + Math.cos(q * 1.7 + p.y) * p.r * 0.35 - ph * 14; ctx.globalAlpha = 0.28 * a * Math.sin(ph * Math.PI); circle(ctx, x, y, p.r * (0.35 + ph * 0.35), '#e8f8ff'); }
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          continue;
        }
        if (p.look === 'acid') {
          ctx.globalAlpha = 0.7 * a;
          const gr = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r);
          gr.addColorStop(0, '#e8ff7a'); gr.addColorStop(0.55, '#7ad82a'); gr.addColorStop(1, 'rgba(30,70,10,0)');
          circle(ctx, p.x, p.y, p.r, gr);
          for (let q = 0; q < 3; q++) { const ph = (t * 1.4 + q / 3) % 1; ctx.globalAlpha = (1 - ph) * a; circle(ctx, p.x + Math.sin(q * 3 + p.x) * p.r * 0.5, p.y + Math.cos(q * 2 + p.y) * p.r * 0.4, 1.5 + ph * 3, null, '#f0ffb0', 1); }
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.globalAlpha = 0.75 * a;
        const gr = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r);
        gr.addColorStop(0, '#ffcf60'); gr.addColorStop(0.5, '#ff6a1a'); gr.addColorStop(1, 'rgba(60,15,5,0)');
        circle(ctx, p.x, p.y, p.r, gr);
        for (let q = 0; q < 3; q++) { const ph = (t * 1.2 + q / 3) % 1; ctx.globalAlpha = (1 - ph) * a; circle(ctx, p.x + Math.sin(q * 3 + p.x) * p.r * 0.5, p.y + Math.cos(q * 2 + p.y) * p.r * 0.4, 1.5 + ph * 3, null, '#ffe08a', 1); }
        ctx.globalAlpha = 1;
      }
      for (const r of g.rings) {
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(r.x, r.y, r.r * 0.6, r.x, r.y, r.r * 1.1);
        gr.addColorStop(0, 'rgba(255,80,10,0)'); gr.addColorStop(0.8, 'rgba(255,120,30,0.45)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
        circle(ctx, r.x, r.y, r.r * 1.1, gr);
        for (let q = 0; q < 24; q++) { const a = q * TAU / 24 + t * 0.7, fl = 6 + Math.sin(t * 14 + q * 1.7) * 3; ell(ctx, r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, fl * 0.6, fl, a + Math.PI / 2, q % 2 ? 'rgba(255,220,90,0.9)' : 'rgba(255,100,20,0.9)'); }
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const h of g.holes) {
        const gr = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, h.r);
        gr.addColorStop(0, '#000'); gr.addColorStop(0.45, 'rgba(25,5,55,0.95)'); gr.addColorStop(0.8, 'rgba(120,70,230,0.35)'); gr.addColorStop(1, 'rgba(138,107,255,0)');
        circle(ctx, h.x, h.y, h.r, gr);
        ctx.save(); ctx.translate(h.x, h.y);
        for (let q = 0; q < 5; q++) { ctx.rotate(t * 1.6); ctx.strokeStyle = q % 2 ? 'rgba(255,150,240,0.7)' : 'rgba(200,170,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, h.r * (0.25 + q * 0.13), 0, 2.2); ctx.stroke(); }
        ctx.restore();
        circle(ctx, h.x, h.y, h.r * 0.18, '#000', '#ff9ae8', 2);
      }
      for (const m of g.mines) {
        let x = m.x, y = m.y;
        if (!m.armed) { x = m.x + (m.tx - m.x) * m.fly; y = m.y + (m.ty - m.y) * m.fly - Math.sin(m.fly * Math.PI) * 30; }
        const fr = m.src.s && m.src.s.mineFreeze, nuke = m.src.s && m.src.s.mineDmg > 100;
        ell(ctx, x + 1, y + 2, 6, 3, 0, 'rgba(0,0,0,0.35)');
        circle(ctx, x, y, 5.5, sg(ctx, x, y, 5.5, fr ? '#5ab8e8' : nuke ? '#6a7a2a' : '#8a1e1a'), '#1a0806', 1.2);
        for (let i = 0; i < 4; i++) { const a = i * TAU / 4; circle(ctx, x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5, 1.2, '#3a3a3a'); }
        if (m.armed && Math.sin(t * 7 + x) > 0.2) { ctx.globalCompositeOperation = 'lighter'; circle(ctx, x, y, 3.5, 'rgba(255,230,80,0.6)'); circle(ctx, x, y, 1.4, '#fff6b0'); ctx.globalCompositeOperation = 'source-over'; }
      }
      drawGroundUnits(ctx, g, t);
      const sel = ui.selected;
      if (sel && g.towers.indexOf(sel) >= 0 && sel.s.range < 5000) {
        circle(ctx, sel.x, sel.y, sel.s.range, 'rgba(255,255,255,0.09)');
        ctx.save(); ctx.translate(sel.x, sel.y); ctx.rotate(t * 0.2); ctx.setLineDash([8, 6]); circle(ctx, 0, 0, sel.s.range, null, 'rgba(255,255,255,0.75)', 1.6); ctx.setLineDash([]); ctx.restore();
      }
      const ground = g.enemies.filter(e => !e.d.flying && !e.dead);
      for (const e of ground) if (e.d.big || e.d.boss) drawEnemy(ctx, g, e, t);
      for (const e of ground) if (!(e.d.big || e.d.boss)) drawEnemy(ctx, g, e, t);
      const tws = g.towers.slice().sort((a, b) => a.y - b.y);
      for (const tw of tws) {
        drawTower(ctx, tw.type, tw.x, tw.y, tw.ang, tw.tiers, { time: t, flash: tw.flash, tw });
        if (tw.buffed) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4 + tw.x); star(ctx, tw.x + tw.def.size, tw.y - tw.def.size, 3, 1.2, 4, t, '#e07bff'); ctx.globalAlpha = 1; }
        if (tw.disabledT > 0) {
          ctx.globalAlpha = 0.65; circle(ctx, tw.x, tw.y, tw.def.size + 4, 'rgba(60,40,120,0.6)'); ctx.globalAlpha = 1;
          ctx.strokeStyle = '#d8c8ff'; ctx.lineWidth = 1.4;
          for (let q = 0; q < 3; q++) { const a = t * 5 + q * 2.1; ctx.beginPath(); ctx.moveTo(tw.x, tw.y); ctx.lineTo(tw.x + Math.cos(a) * 9 + (Math.random() - 0.5) * 4, tw.y + Math.sin(a) * 9); ctx.stroke(); }
        }
        if (tw === sel) { ctx.save(); ctx.translate(tw.x, tw.y); ctx.rotate(-t); ctx.setLineDash([5, 4]); circle(ctx, 0, 0, tw.def.size + 7, null, '#ffffff', 2); ctx.setLineDash([]); ctx.restore(); }
        if (tw.def.kind === 'flame' && tw.flameOn > 0) {
          const s = tw.s, blue = s.fireFloor;
          ctx.save(); ctx.translate(tw.x, tw.y); ctx.rotate(tw.ang);
          ctx.globalCompositeOperation = 'lighter';
          for (let q = 0; q < 3; q++) {
            const rr = s.range * (0.55 + q * 0.22);
            const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, rr);
            gr.addColorStop(0, blue ? 'rgba(170,210,255,0.9)' : 'rgba(255,245,170,0.9)');
            gr.addColorStop(0.45, blue ? 'rgba(60,110,255,0.55)' : 'rgba(255,130,30,0.55)'); gr.addColorStop(1, 'rgba(255,40,0,0)');
            ctx.fillStyle = gr;
            const wob = Math.sin(t * 30 + q) * 0.08;
            ctx.beginPath(); ctx.moveTo(tw.def.size * 0.8, 0); ctx.arc(0, 0, rr, -s.cone * (1 - q * 0.2) + wob, s.cone * (1 - q * 0.2) + wob); ctx.closePath(); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
        }
        if (tw.def.kind === 'beam') for (const b of tw.beams) {
          const w = 2 + b.ramp * (tw.s.line ? 1.6 : 0.9);
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(255,170,50,0.35)'; ctx.lineWidth = w + 8 + Math.sin(t * 40) * 2;
          ctx.beginPath(); ctx.moveTo(tw.x, tw.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,220,120,0.8)'; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(tw.x, tw.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, w * 0.35);
          ctx.beginPath(); ctx.moveTo(tw.x, tw.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
          const gr = ctx.createRadialGradient(b.ex, b.ey, 0, b.ex, b.ey, 10 + b.ramp * 2);
          gr.addColorStop(0, 'rgba(255,255,230,0.9)'); gr.addColorStop(1, 'rgba(255,170,50,0)');
          circle(ctx, b.ex, b.ey, 10 + b.ramp * 2, gr);
          ctx.globalCompositeOperation = 'source-over';
        }
        if (tw.def.kind === 'hive') {
          const laser = tw.s.dtype === 'arcane';
          for (const dr of tw.drones) {
            if (dr.state === 2) continue;
            ctx.save(); ctx.translate(dr.x, dr.y);
            ell(ctx, 3, 8, 4, 2, 0, 'rgba(0,0,0,0.25)');
            const f = Math.abs(Math.sin(t * 45 + dr.ang * 5));
            ctx.globalAlpha = 0.65;
            ell(ctx, -1, -4, 4.5, 1.5 + f * 2, -0.3, '#e8f6ff'); ell(ctx, -1, 4, 4.5, 1.5 + f * 2, 0.3, '#e8f6ff');
            ctx.globalAlpha = 1;
            ell(ctx, 0, 0, 5, 3.4, 0, sg(ctx, 0, 0, 5, dr.state === 1 ? '#ff5050' : laser ? '#b9a8ff' : '#ffd84d'), '#3a2a10', 1);
            ctx.fillStyle = '#2a1c08'; ctx.fillRect(-1.5, -3, 1.4, 6);
            circle(ctx, 3.5, 0, 1.6, laser ? '#ff7ae4' : '#5ad1ff');
            ctx.restore();
          }
          if (tw.ship) {
            ctx.save(); ctx.translate(tw.ship.x, tw.ship.y);
            ell(ctx, 6, 14, 18, 6, 0, 'rgba(0,0,0,0.25)');
            ell(ctx, 0, 0, 18, 8, 0, lg(ctx, 0, -8, 0, 8, ['#c0c8d4', '#5a626e', '#2a2f37']), '#14181c', 1.4);
            ell(ctx, 2, -2, 7, 4, 0, lg(ctx, 0, -6, 0, 2, ['#e0fbff', '#3a9ad8']), '#0c2030', 1);
            ctx.globalCompositeOperation = 'lighter';
            for (let q = -1; q <= 1; q++) circle(ctx, q * 9, 5, 2.4, Math.sin(t * 8 + q) > 0 ? 'rgba(255,90,90,0.9)' : 'rgba(255,220,90,0.9)');
            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();
          }
        }
      }
      for (const gm of g.golems) if (!gm.dead) drawGolem(ctx, gm, t);
      for (const e of g.enemies) if (e.d.flying && !e.dead) drawEnemy(ctx, g, e, t);
      for (const b of g.rangs) {
        const obs = b.src.tiers[0] >= 3, col = obs ? '#2a2236' : '#d8a050', edge = obs ? '#c08aff' : '#5a3410';
        ctx.globalAlpha = 0.25; ell(ctx, b.x + 3, b.y + 7, 8, 3, 0, '#000'); ctx.globalAlpha = 1;
        if (b.big) {
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
          ctx.globalCompositeOperation = 'lighter'; circle(ctx, 0, 0, 16, 'rgba(255,210,90,0.25)'); ctx.globalCompositeOperation = 'source-over';
          circle(ctx, 0, 0, 12, null, lg(ctx, 0, -12, 0, 12, ['#fff6b0', '#ffcf4d', '#a87a00']), 4);
          for (let i = 0; i < 6; i++) { const a = i * TAU / 6; shape(ctx, [[Math.cos(a) * 12, Math.sin(a) * 12], [Math.cos(a + 0.3) * 17, Math.sin(a + 0.3) * 17], [Math.cos(a + 0.45) * 12, Math.sin(a + 0.45) * 12]], '#fff1a8', '#8a5a00', 0.7); }
          ctx.restore();
        } else {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; circle(ctx, b.x, b.y, 10, 'rgba(255,230,160,0.5)'); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          rangShape(ctx, b.x, b.y, 9, b.rot, col, edge);
        }
      }

      for (const p of g.projs) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
        switch (p.kind) {
          case 'thorn':
            ctx.globalCompositeOperation = 'lighter'; ell(ctx, -4, 0, 7, 2, 0, 'rgba(160,255,100,0.35)'); ctx.globalCompositeOperation = 'source-over';
            shape(ctx, [[7, 0], [-4, -2.6], [-2, 0], [-4, 2.6]], lg(ctx, -4, 0, 7, 0, ['#4a8a2a', '#e6ffb0']), '#2a4a10', 0.6); break;
          case 'spear':
            ctx.globalCompositeOperation = 'lighter'; ell(ctx, -14, 0, 16, 3, 0, 'rgba(255,230,140,0.3)'); ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = lg(ctx, 0, -2, 0, 2, ['#fff6d8', '#a88a50']); ctx.fillRect(-20, -1.8, 26, 3.6);
            shape(ctx, [[6, -4.5], [14, 0], [6, 4.5]], lg(ctx, 6, -4, 6, 4, ['#fff6b0', '#ffcf4d', '#a87a00']), '#5a3a00', 0.8); break;
          case 'shard':
            ctx.globalCompositeOperation = 'lighter'; ell(ctx, -5, 0, 8, 2.5, 0, 'rgba(150,230,255,0.4)'); ctx.globalCompositeOperation = 'source-over';
            poly(ctx, 0, 0, 5, 4, 0, lg(ctx, -5, 0, 5, 0, ['#5ab8e8', '#ffffff']), '#3a8ac0', 0.8); break;
          case 'dart':
            ctx.globalCompositeOperation = 'lighter'; ell(ctx, -3, 0, 7, 2, 0, 'rgba(255,220,80,0.5)'); ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#fff2a0'; ctx.fillRect(-4, -1, 8, 2); break;
          case 'laser':
            ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(190,150,255,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(6, 0); ctx.stroke();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; break;
          case 'missile': {
            ctx.globalCompositeOperation = 'lighter';
            const gr = ctx.createRadialGradient(-10, 0, 0, -10, 0, 9); gr.addColorStop(0, 'rgba(255,240,170,0.95)'); gr.addColorStop(1, 'rgba(255,100,20,0)'); circle(ctx, -10, 0, 9, gr);
            ctx.globalCompositeOperation = 'source-over';
            rrect(ctx, -7, -2.6, 13, 5.2, 2, lg(ctx, 0, -2.6, 0, 2.6, ['#f0f4fa', '#8a929e']), '#3a3f47', 0.8);
            shape(ctx, [[6, -2.6], [10, 0], [6, 2.6]], '#ff4a3a'); shape(ctx, [[-7, -2.6], [-10, -5], [-4, -2.6]], '#5a626e'); shape(ctx, [[-7, 2.6], [-10, 5], [-4, 2.6]], '#5a626e');
            if (Math.random() < 0.5) addP({ k: 'smoke', x: p.x - Math.cos(p.ang) * 10, y: p.y - Math.sin(p.ang) * 10, vx: 0, vy: -6, t: 0, T: 0.6, r: 3 });
            break;
          }
        }
        ctx.restore();
      }
      for (const s of g.shells) {
        if (s.t < 0) continue;
        const k = Math.max(0, s.t / s.T);
        const x = s.x0 + (s.x1 - s.x0) * k, y0 = s.y0 + (s.y1 - s.y0) * k;
        if (s.meteor) {
          ctx.globalAlpha = 0.35; ell(ctx, s.x1, s.y1, 20 * k + 4, (20 * k + 4) * 0.5, 0, '#000'); ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(255,140,40,0.6)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x - 40, y0 - 100); ctx.lineTo(x, y0); ctx.stroke();
          const gr = ctx.createRadialGradient(x, y0, 2, x, y0, 22); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.5, '#ff8a2a'); gr.addColorStop(1, 'rgba(255,60,0,0)'); circle(ctx, x, y0, 22, gr);
          ctx.globalCompositeOperation = 'source-over';
          circle(ctx, x, y0, 8, sg(ctx, x, y0, 8, '#5a2a10'));
          continue;
        }
        const hgt = Math.sin(k * Math.PI) * (s.mini ? 25 : 70);
        ctx.globalAlpha = 0.3; ell(ctx, x, y0, 5, 2.5, 0, '#000'); ctx.globalAlpha = 1;
        const rr = (s.mini ? 3.5 : 6) * (1 + hgt / 140);
        if (s.sun) {
          ctx.globalCompositeOperation = 'lighter'; circle(ctx, x, y0 - hgt, rr + 6, 'rgba(255,210,80,0.4)'); ctx.globalCompositeOperation = 'source-over';
          circle(ctx, x, y0 - hgt, rr + 1, sg(ctx, x, y0 - hgt, rr + 1, '#ffd84d'), '#a86a00', 1);
          continue;
        }
        if (s.acid) {
          ctx.globalCompositeOperation = 'lighter'; circle(ctx, x, y0 - hgt, rr + 3, 'rgba(160,240,80,0.35)'); ctx.globalCompositeOperation = 'source-over';
          circle(ctx, x, y0 - hgt, rr, sg(ctx, x, y0 - hgt, rr, '#9be04a'), '#2a5a10', 1);
          continue;
        }
        circle(ctx, x, y0 - hgt, rr, sg(ctx, x, y0 - hgt, rr, s.freeze ? '#5ab8e8' : '#3a2c22'), '#0c0806', 1);
        ctx.globalCompositeOperation = 'lighter'; circle(ctx, x - rr * 0.6, y0 - hgt, rr * 0.5, 'rgba(255,170,60,0.7)'); ctx.globalCompositeOperation = 'source-over';
      }
      drawParticles(ctx);
      for (const f of g.fx) {
        const k = f.t / f.T;
        switch (f.k) {
          case 'ring':
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * 0.9;
            circle(ctx, f.x, f.y, Math.max(1, f.r0 + (f.r1 - f.r0) * k), null, f.color, f.w + 2);
            ctx.globalAlpha = (1 - k) * 0.3; circle(ctx, f.x, f.y, Math.max(1, f.r0 + (f.r1 - f.r0) * k), null, f.color, f.w + 8);
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
          case 'boom': {
            ctx.globalCompositeOperation = 'lighter';
            const rr = f.r * (0.35 + 0.75 * Math.pow(k, 0.5));
            const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
            gr.addColorStop(0, `rgba(255,255,230,${(1 - k) * 0.95})`); gr.addColorStop(0.35, rgba(f.color, (1 - k) * 0.8)); gr.addColorStop(1, rgba(f.color, 0));
            circle(ctx, f.x, f.y, rr, gr);
            ctx.globalAlpha = (1 - k) * 0.7; circle(ctx, f.x, f.y, f.r * (0.4 + k * 0.9), null, '#ffffff', 2);
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
          }
          case 'bolt': {
            ctx.globalCompositeOperation = 'lighter';
            if (!f.jit) {
              f.jit = [];
              const pts = f.pts;
              for (let i = 0; i < pts.length; i++) {
                f.jit.push(pts[i]);
                if (i < pts.length - 1) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; for (let q = 1; q < 4; q++) f.jit.push([ax + (bx - ax) * q / 4 + (Math.random() - 0.5) * 12, ay + (by - ay) * q / 4 + (Math.random() - 0.5) * 12]); }
              }
            }
            for (const [w, col, a] of [[f.w + 7, f.color, 0.25], [f.w + 2, f.color, 0.8], [Math.max(1, f.w * 0.5), '#ffffff', 1]]) {
              ctx.globalAlpha = (1 - k) * a; ctx.strokeStyle = col; ctx.lineWidth = w;
              ctx.beginPath(); f.jit.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke();
            }
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
          }
          case 'tracer': {
            ctx.globalCompositeOperation = 'lighter';
            for (const [w, a] of [[6, 0.25], [2, 0.9]]) { ctx.globalAlpha = (1 - k) * a; ctx.strokeStyle = f.color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(f.pts[0][0], f.pts[0][1]); for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i][0], f.pts[i][1]); ctx.stroke(); }
            const last = f.pts[f.pts.length - 1];
            ctx.globalAlpha = 1 - k; circle(ctx, last[0], last[1], 6 * (1 - k) + 2, 'rgba(255,250,220,0.9)');
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
          }
          case 'text': {
            ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color; ctx.font = '700 16px Fredoka, sans-serif'; ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3.5; ctx.strokeText(f.text, f.x, f.y - k * 28); ctx.fillText(f.text, f.x, f.y - k * 28);
            ctx.globalAlpha = 1; break;
          }
          case 'flashscreen': ctx.fillStyle = f.color + (0.5 * (1 - k)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); break;
          case 'rail': {
            ctx.globalCompositeOperation = 'lighter';
            const a = f.pts[0], b = f.pts[1];
            for (const [w, al] of [[f.w * 2.2 + 6, 0.18], [f.w + 2, 0.45], [2.4, 1]]) {
              ctx.globalAlpha = (1 - k) * al; ctx.strokeStyle = w === 2.4 ? '#ffffff' : f.color; ctx.lineWidth = w;
              ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
            }
            ctx.globalAlpha = 1 - k;
            for (let q = 1; q < 6; q++) { const u = q / 6; poly(ctx, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 3 * (1 - k) + 1, 4, k * 4 + q, '#e8fbff'); }
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
          }
          case 'geyser': {
            const hgt = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 70, w = f.r * 0.45 * (1 - k * 0.4);
            ctx.globalAlpha = (1 - k) * 0.7;
            ell(ctx, f.x, f.y, f.r * (0.6 + k * 0.5), f.r * 0.35 * (0.6 + k * 0.5), 0, 'rgba(120,210,240,0.5)', 'rgba(230,250,255,0.8)', 1.5);
            const gr = ctx.createLinearGradient(0, f.y - hgt - 1, 0, f.y);
            gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(160,230,255,0.8)'); gr.addColorStop(1, 'rgba(60,170,220,0.6)');
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.moveTo(f.x - w, f.y); ctx.quadraticCurveTo(f.x - w * 0.4, f.y - hgt * 0.6, f.x - w * 0.6, f.y - hgt); ctx.quadraticCurveTo(f.x, f.y - hgt - 10, f.x + w * 0.6, f.y - hgt); ctx.quadraticCurveTo(f.x + w * 0.4, f.y - hgt * 0.6, f.x + w, f.y); ctx.closePath(); ctx.fill();
            for (let q = 0; q < 7; q++) { const a = q * 0.9 + f.x, dx = Math.cos(a) * f.r * 0.8 * k, dy = -hgt * 0.8 + k * k * 90 + Math.sin(a) * 6; circle(ctx, f.x + dx, f.y + dy, 2.2, 'rgba(220,250,255,0.9)'); }
            ctx.globalAlpha = 1; break;
          }
          case 'splash': {
            ctx.globalAlpha = (1 - k) * 0.85;
            const rr = f.r * (0.4 + 0.7 * Math.sqrt(k));
            circle(ctx, f.x, f.y, rr, rgba(f.color, 0.35 * (1 - k)), f.color, 2);
            for (let q = 0; q < 8; q++) { const a = q * TAU / 8 + f.x; circle(ctx, f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.8, 2.6 * (1 - k) + 0.6, f.color); }
            ctx.globalAlpha = 1; break;
          }
        }
      }
      weather(ctx, g, t);
      if (g.wardrum > 0) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 10);
        const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7); gr.addColorStop(0, 'rgba(224,123,255,0)'); gr.addColorStop(1, 'rgba(224,123,255,0.6)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      if (ui.placing && ui.mouse) {
        const def = PD.TOWERS[ui.placing];
        const ok = g.canPlace(ui.placing, ui.mouse.x, ui.mouse.y) && g.money >= def.cost;
        const range = def.base.range;
        if (range < 5000) {
          circle(ctx, ui.mouse.x, ui.mouse.y, range, ok ? 'rgba(255,255,255,0.12)' : 'rgba(255,60,60,0.16)');
          ctx.setLineDash([8, 6]); circle(ctx, ui.mouse.x, ui.mouse.y, range, null, ok ? 'rgba(255,255,255,0.75)' : 'rgba(255,90,90,0.85)', 1.6); ctx.setLineDash([]);
        }
        ctx.globalAlpha = 0.8;
        drawTower(ctx, ui.placing, ui.mouse.x, ui.mouse.y, -Math.PI / 2, [0, 0], { time: t });
        ctx.globalAlpha = 1;
        if (!ok) circle(ctx, ui.mouse.x, ui.mouse.y, def.size + 4, 'rgba(255,40,40,0.25)', '#ff4a4a', 2.5);
        // espacio reservado de las torres cercanas (no se pueden amontonar)
        ctx.setLineDash([3, 4]);
        for (const tw of g.towers) {
          const R = tw.def.size + def.size + PD.TOWER_GAP, d = Math.hypot(tw.x - ui.mouse.x, tw.y - ui.mouse.y);
          if (d > R + 40) continue;
          ctx.globalAlpha = d < R ? 0.85 : 0.35;
          circle(ctx, tw.x, tw.y, R, d < R ? 'rgba(255,60,60,0.08)' : null, d < R ? '#ff6a5a' : '#ffffff', 1.2);
        }
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      let by = 12;
      for (const b of g.bosses) {
        const bw = 440, bx = (W - bw) / 2;
        rrect(ctx, bx - 46, by - 6, bw + 56, 34, 10, 'rgba(10,6,16,0.82)', 'rgba(255,90,90,0.5)', 1.2);
        ctx.save(); ctx.translate(bx - 26, by + 11); const ic = enemySprite(b.d, 0); const sc = 16 / ic.half; ctx.scale(sc, sc); blit(ctx, ic); ctx.restore();
        rrect(ctx, bx, by + 10, bw, 10, 4, '#2a0a0a');
        const f = Math.max(0, b.hp / b.maxHp);
        if (f > 0) rrect(ctx, bx, by + 10, Math.max(8, bw * f), 10, 4, lg(ctx, 0, by + 10, 0, by + 20, b.revived ? ['#ffe08a', '#ff8a1a'] : ['#ff8a8a', '#d01a1a']));
        ctx.fillStyle = '#fff'; ctx.font = '700 13px Fredoka, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(b.name || b.d.name, bx, by + 6);
        ctx.textAlign = 'right'; ctx.fillStyle = '#ffd0d0'; ctx.fillText(Math.ceil(b.hp).toLocaleString('es') + ' / ' + Math.ceil(b.maxHp).toLocaleString('es'), bx + bw, by + 6);
        by += 40;
      }
    }
  };

  PD.Render = R;
  PD.drawTower = drawTower;
  PD.drawEnemyIcon = drawEnemyIcon;
  PD.paintBackground = paintBackground;
})();
