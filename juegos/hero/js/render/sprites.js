// Sprites pre-renderizados (gemas, flamas, botones) para dibujar rápido con drawImage.
import { OPEN_COLOR } from '../core/constants.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  } else {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

export const GEM_W = 128, GEM_H = 100;
const TOP = 40; // centro de la cara superior dentro del sprite
const THICK = 15; // grosor del "puck"

// Aclara un color hex mezclándolo con blanco (devuelve hex)
export function lighten(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(v + (255 - v) * f).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

function starPath(ctx, cx, cy, R, r, sy, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = rot + (k * Math.PI) / 5;
    const rad = k % 2 ? r : R;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * sy);
  }
  ctx.closePath();
}

// Cuerpo lateral extruido (da el aspecto 3D)
function extrude(ctx, pathFn, col) {
  for (let i = THICK; i >= 1; i--) {
    pathFn(TOP + i);
    ctx.fillStyle = shade(col, -0.35 - (i / THICK) * 0.4);
    ctx.fill();
  }
}

// Gema de guitarra. type: 0 strum, 1 hopo, 2 tap. star: nota de Star Power (forma de estrella)
export function gemSprite(color, type, star) {
  const key = `gem2:${color}:${type}:${star}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(GEM_W, GEM_H);
  const cx = 64;
  if (star) drawStarGem(ctx, cx, color, type);
  else drawPuck(ctx, cx, color, type);
  cache.set(key, c);
  return c;
}

function drawPuck(ctx, cx, col, type) {
  const rx = 58, ry = 27;
  // sombra difusa
  const sh = ctx.createRadialGradient(cx, TOP + THICK + 8, 4, cx, TOP + THICK + 8, rx);
  sh.addColorStop(0, 'rgba(0,0,0,0.55)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ellipse(ctx, cx, TOP + THICK + 8, rx + 4, ry + 4);
  ctx.fill();
  // lateral con degradado vertical
  extrude(ctx, (y) => ellipse(ctx, cx, y, rx, ry), col);
  // aro metálico entre la cara y el lateral
  ellipse(ctx, cx, TOP + 3, rx, ry);
  const rim = ctx.createLinearGradient(0, TOP - ry, 0, TOP + ry + 3);
  rim.addColorStop(0, '#ffffff');
  rim.addColorStop(0.5, '#9aa0ad');
  rim.addColorStop(1, '#3a3d46');
  ctx.fillStyle = rim;
  ctx.fill();

  // cara superior
  ellipse(ctx, cx, TOP, rx - 2, ry - 1.5);
  const face = ctx.createRadialGradient(cx - 16, TOP - 12, 3, cx, TOP + 2, rx);
  face.addColorStop(0, lighten(col, 0.55));
  face.addColorStop(0.45, col);
  face.addColorStop(1, shade(col, -0.45));
  ctx.fillStyle = face;
  ctx.fill();
  // bisel: luz arriba, sombra abajo
  ellipse(ctx, cx, TOP, rx - 5, ry - 3.5);
  const bev = ctx.createLinearGradient(0, TOP - ry, 0, TOP + ry);
  bev.addColorStop(0, 'rgba(255,255,255,0.65)');
  bev.addColorStop(0.5, 'rgba(255,255,255,0)');
  bev.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.lineWidth = 3;
  ctx.strokeStyle = bev;
  ctx.stroke();

  if (type === 2) {
    // TAP: centro negro brillante y núcleo de color
    ellipse(ctx, cx, TOP, 38, 17.5);
    const dark = ctx.createLinearGradient(0, TOP - 18, 0, TOP + 18);
    dark.addColorStop(0, '#30303c');
    dark.addColorStop(1, '#040406');
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    ellipse(ctx, cx, TOP - 1, 16, 7);
    const core = ctx.createRadialGradient(cx - 4, TOP - 4, 1, cx, TOP - 1, 16);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, lighten(col, 0.4));
    core.addColorStop(1, col);
    ctx.fillStyle = core;
    ctx.fill();
  } else if (type === 0) {
    // STRUM: anillo negro + botón blanco abombado
    ellipse(ctx, cx, TOP, 33, 15);
    ctx.fillStyle = '#0c0c10';
    ctx.fill();
    ellipse(ctx, cx, TOP + 2, 25, 11);
    ctx.fillStyle = '#7d828e';
    ctx.fill();
    ellipse(ctx, cx, TOP - 1, 25, 11);
    const w = ctx.createRadialGradient(cx - 6, TOP - 6, 1, cx, TOP, 26);
    w.addColorStop(0, '#ffffff');
    w.addColorStop(0.7, '#dde1ea');
    w.addColorStop(1, '#a3a8b4');
    ctx.fillStyle = w;
    ctx.fill();
  } else {
    // HOPO: tapa blanca grande con centro de color
    ellipse(ctx, cx, TOP + 1, 38, 17);
    ctx.fillStyle = '#8a8f9b';
    ctx.fill();
    ellipse(ctx, cx, TOP - 1, 38, 17);
    const w = ctx.createRadialGradient(cx - 8, TOP - 8, 2, cx, TOP, 40);
    w.addColorStop(0, '#ffffff');
    w.addColorStop(1, '#cdd2dc');
    ctx.fillStyle = w;
    ctx.fill();
    ellipse(ctx, cx, TOP - 1, 19, 8);
    ctx.fillStyle = lighten(col, 0.1);
    ctx.fill();
  }
  // brillo especular
  ellipse(ctx, cx - 22, TOP - 13, 15, 4.5);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
  ellipse(ctx, cx - 26, TOP - 14, 5, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
}

// Nota estrella (Star Power): estrella de 5 puntas extruida, del color del traste con borde plateado
function drawStarGem(ctx, cx, col, type) {
  const R = 62, r = 30, sy = 0.47;
  const sh = ctx.createRadialGradient(cx, TOP + THICK + 8, 4, cx, TOP + THICK + 8, R);
  sh.addColorStop(0, 'rgba(0,0,0,0.5)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ellipse(ctx, cx, TOP + THICK + 8, R, R * sy);
  ctx.fill();
  extrude(ctx, (y) => starPath(ctx, cx, y, R, r, sy), col);
  // borde plateado
  starPath(ctx, cx, TOP + 2, R, r, sy);
  ctx.fillStyle = '#d9dde6';
  ctx.fill();
  // cara
  starPath(ctx, cx, TOP, R - 4, r - 2.5, sy);
  const face = ctx.createRadialGradient(cx - 10, TOP - 10, 2, cx, TOP, R);
  face.addColorStop(0, '#ffffff');
  face.addColorStop(0.3, lighten(col, 0.45));
  face.addColorStop(0.75, col);
  face.addColorStop(1, shade(col, -0.35));
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  // centro según tipo
  if (type === 2) {
    starPath(ctx, cx, TOP, 24, 11, sy);
    ctx.fillStyle = '#0a0a10';
    ctx.fill();
    ellipse(ctx, cx, TOP, 7, 3.2);
    ctx.fillStyle = col;
    ctx.fill();
  } else if (type === 1) {
    starPath(ctx, cx, TOP, 26, 12, sy);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else {
    ellipse(ctx, cx, TOP, 12, 5.5);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  // destellos
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ellipse(ctx, cx - 18, TOP - 9, 8, 2.5);
  ctx.fill();
}

// Barra de nota abierta (cruza toda la autopista)
export function openSprite(type, sp) {
  const key = `open:${type}:${sp}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(512, 48);
  const col = sp ? lighten(OPEN_COLOR, 0.35) : OPEN_COLOR;
  const r = 16;
  const rr = (x, y, w, h) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  rr(4, 16, 504, 26);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  rr(4, 10, 504, 26);
  ctx.fillStyle = shade(col, -0.55);
  ctx.fill();
  rr(4, 4, 504, 26);
  const g = ctx.createLinearGradient(0, 4, 0, 30);
  g.addColorStop(0, shade(col, 0.4));
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  ctx.fill();
  if (type === 1) {
    rr(40, 11, 432, 11);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else {
    rr(40, 12, 432, 9);
    ctx.fillStyle = 'rgba(20,10,30,0.8)';
    ctx.fill();
  }
  if (sp) {
    for (const x of [70, 256, 442]) {
      starPath(ctx, x, 16, 15, 6.5, 0.75);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#7a3ca0';
      ctx.stroke();
    }
  }
  cache.set(key, c);
  return c;
}

// Batería: parche (tom) o platillo
export function drumSprite(color, cymbal, sp) {
  const key = `drum:${color}:${cymbal}:${sp}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(GEM_W, GEM_H);
  const col = color;
  const cx = 64, top = 40;
  if (cymbal) {
    // platillo: forma de disco con borde metálico puntiagudo
    const pts = 10;
    ctx.beginPath();
    for (let i = 0; i <= pts * 2; i++) {
      const a = (i / (pts * 2)) * Math.PI * 2;
      const rad = i % 2 ? 1 : 0.86;
      ctx.lineTo(cx + Math.cos(a) * 60 * rad, top + 9 + Math.sin(a) * 26 * rad);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i <= pts * 2; i++) {
      const a = (i / (pts * 2)) * Math.PI * 2;
      const rad = i % 2 ? 1 : 0.86;
      ctx.lineTo(cx + Math.cos(a) * 60 * rad, top + Math.sin(a) * 26 * rad);
    }
    const g = ctx.createRadialGradient(cx, top - 6, 4, cx, top, 60);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, shade(col, 0.3));
    g.addColorStop(1, shade(col, -0.3));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#e8edf5';
    ctx.stroke();
    ellipse(ctx, cx, top, 10, 4.5);
    ctx.fillStyle = '#20232b';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.roundRect(8, top - 14, 112, 46, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(8, top - 22, 112, 44, 22);
    ctx.fillStyle = shade(col, -0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(8, top - 28, 112, 40, 20);
    const g = ctx.createLinearGradient(0, top - 28, 0, top + 12);
    g.addColorStop(0, shade(col, 0.45));
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(28, top - 18, 72, 18, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }
  if (sp) {
    // nota estrella: emblema de estrella blanca con borde plateado
    starPath(ctx, cx, cymbal ? top : top - 9, 30, 13, 0.55);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = shade(col, -0.4);
    ctx.stroke();
  }
  cache.set(key, c);
  return c;
}

export function kickSprite(sp) {
  const key = `kick:${sp}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(512, 32);
  const col = sp ? '#ffd9a0' : '#f28a1c';
  ctx.beginPath();
  ctx.roundRect(2, 10, 508, 18, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(2, 4, 508, 16, 8);
  const g = ctx.createLinearGradient(0, 4, 0, 20);
  g.addColorStop(0, shade(col, 0.5));
  g.addColorStop(1, shade(col, -0.2));
  ctx.fillStyle = g;
  ctx.fill();
  if (sp) {
    for (const x of [90, 256, 422]) {
      starPath(ctx, x, 12, 11, 4.8, 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
  cache.set(key, c);
  return c;
}

// Flama de acierto
export function flameSprite(color = '#ffb020') {
  const key = `flame:${color}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(128, 192);
  const g = ctx.createRadialGradient(64, 150, 4, 64, 120, 90);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,240,180,0.95)');
  g.addColorStop(0.45, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(64, 4);
  ctx.bezierCurveTo(100, 70, 128, 120, 110, 160);
  ctx.bezierCurveTo(96, 190, 32, 190, 18, 160);
  ctx.bezierCurveTo(0, 120, 28, 70, 64, 4);
  ctx.fill();
  cache.set(key, c);
  return c;
}

export function glowSprite(color) {
  const key = `glow:${color}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  cache.set(key, c);
  return c;
}

// ---------- Textura del mástil (se dibuja en perspectiva por líneas) ----------
function rand(seed) {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function neckTexture(style) {
  const key = `neck:${style}`;
  if (cache.has(key)) return cache.get(key);
  const W = 256, H = 1024;
  const [c, ctx] = canvas(W, H);
  const r = rand(style === 'wood' ? 7 : 3);
  if (style === 'wood') {
    // palisandro oscuro: veta a lo largo del mástil (repetible verticalmente)
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#120a07');
    g.addColorStop(0.5, '#2b1810');
    g.addColorStop(1, '#120a07');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 220; k++) {
      const x0 = r() * W;
      const amp = 2 + r() * 7;
      const freq = 1 + Math.floor(r() * 3);
      const phase = r() * Math.PI * 2;
      const light = r() < 0.35;
      ctx.strokeStyle = light ? `rgba(120,70,40,${0.05 + r() * 0.12})` : `rgba(0,0,0,${0.1 + r() * 0.25})`;
      ctx.lineWidth = 0.5 + r() * 2.2;
      ctx.beginPath();
      for (let y = 0; y <= H; y += 8) {
        const x = x0 + Math.sin((y / H) * Math.PI * 2 * freq + phase) * amp + Math.sin((y / H) * Math.PI * 2 * (freq + 3) + phase * 2) * amp * 0.3;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // poros
    for (let k = 0; k < 2500; k++) {
      ctx.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.3})`;
      ctx.fillRect(r() * W, r() * H, 1, 2 + r() * 5);
    }
  } else {
    ctx.fillStyle = '#0e0e14';
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 6000; k++) {
      ctx.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
      ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
    }
  }
  // oscurecer bordes para dar volumen
  const v = ctx.createLinearGradient(0, 0, W, 0);
  v.addColorStop(0, 'rgba(0,0,0,0.55)');
  v.addColorStop(0.18, 'rgba(0,0,0,0)');
  v.addColorStop(0.82, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  cache.set(key, c);
  return c;
}

// Chispa (punto brillante con halo)
export function sparkSprite(color) {
  const key = `spark:${color}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  cache.set(key, c);
  return c;
}

// Llama con varias lenguas (se dibuja varias veces con variaciones)
export function flameTongue(hue) {
  const key = `tongue:${hue}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(96, 192);
  const g = ctx.createLinearGradient(0, 192, 0, 0);
  if (hue === 'blue') {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(150,240,255,0.95)');
    g.addColorStop(0.55, 'rgba(40,140,255,0.7)');
    g.addColorStop(1, 'rgba(20,40,255,0)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,240,170,0.95)');
    g.addColorStop(0.5, 'rgba(255,150,30,0.8)');
    g.addColorStop(1, 'rgba(255,40,0,0)');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(48, 0);
  ctx.bezierCurveTo(70, 60, 92, 110, 82, 160);
  ctx.bezierCurveTo(74, 194, 22, 194, 14, 160);
  ctx.bezierCurveTo(4, 110, 26, 60, 48, 0);
  ctx.fill();
  cache.set(key, c);
  return c;
}
