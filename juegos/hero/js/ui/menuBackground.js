// Fondo animado de los menús y de los resultados: un escenario de concierto en penumbra.
// Focos que barren el humo, luces desenfocadas (bokeh) de los colores de los trastes que flotan,
// un suelo de neón que se pierde en el horizonte y un pulso suave como de bombo.
import { FRET_COLORS } from '../core/constants.js';
import { settings } from '../settings.js';

const TAU = Math.PI * 2;

// luz desenfocada pre-renderizada (una por color)
const bokehCache = new Map();
function bokehSprite(color) {
  if (bokehCache.has(color)) return bokehCache.get(color);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const n = parseInt(color.slice(1), 16);
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(${rgb},0.9)`);
  grad.addColorStop(0.55, `rgba(${rgb},0.55)`);
  grad.addColorStop(0.8, `rgba(${rgb},0.18)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // borde apenas marcado, como el de una lente
  g.strokeStyle = `rgba(${rgb},0.25)`;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(64, 64, 50, 0, TAU);
  g.stroke();
  bokehCache.set(color, c);
  return c;
}

const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

export class MenuBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this.t0 = performance.now();
    this.calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.orbs = [];
    for (let i = 0; i < 26; i++) this.orbs.push(this._orb(Math.random()));
    // focos: posición en el techo, color y fase de su vaivén
    this.beams = [
      { x: 0.12, col: FRET_COLORS[3], ph: 0.0, sp: 0.21, amp: 0.32 },
      { x: 0.32, col: FRET_COLORS[4], ph: 1.7, sp: 0.17, amp: 0.26 },
      { x: 0.5, col: '#b18cff', ph: 3.1, sp: 0.13, amp: 0.2 },
      { x: 0.68, col: FRET_COLORS[1], ph: 4.4, sp: 0.19, amp: 0.26 },
      { x: 0.88, col: FRET_COLORS[0], ph: 5.6, sp: 0.23, amp: 0.32 },
    ];
  }

  _orb(y = 1.1) {
    return {
      x: Math.random(),
      y, // 0 arriba, 1 abajo (en fracción de la pantalla)
      r: 0.012 + Math.random() ** 2 * 0.05,
      v: 0.008 + Math.random() * 0.02,
      drift: Math.random() * TAU,
      col: FRET_COLORS[Math.floor(Math.random() * 5)],
      a: 0.25 + Math.random() * 0.45,
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.canvas.classList.remove('hidden');
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.draw();
    };
    loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas.classList.add('hidden');
  }

  draw() {
    // alto rendimiento: el fondo de los menús también se pinta a menos resolución
    const dpr = settings.altoRendimiento ? 0.75 : Math.min(1.5, window.devicePixelRatio || 1);
    const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = innerWidth, h = innerHeight;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = ((now - this.t0) / 1000) * (this.calm ? 0.3 : 1);
    // pulso lento, como un bombo a 92 bpm, muy suave
    const beat = Math.pow(Math.max(0, Math.cos(t * Math.PI * (92 / 60))), 12);
    const horizon = h * 0.64;

    // cielo: degradado profundo
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#05040b');
    sky.addColorStop(0.55, '#100a22');
    sky.addColorStop(0.64, '#1f0f38');
    sky.addColorStop(1, '#07050e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';

    // resplandor del escenario en el horizonte
    const glowR = Math.max(w, h) * 0.6;
    const hg = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, glowR);
    hg.addColorStop(0, `rgba(160,70,255,${0.28 + beat * 0.08})`);
    hg.addColorStop(0.35, 'rgba(90,30,160,0.12)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h);

    // focos que barren el humo
    for (const b of this.beams) {
      const ox = b.x * w, oy = -h * 0.05;
      const ang = Math.PI / 2 + Math.sin(t * b.sp + b.ph) * b.amp;
      const len = h * 1.15;
      const spread = 0.11 + 0.02 * Math.sin(t * 0.7 + b.ph);
      const ex = ox + Math.cos(ang) * len, ey = oy + Math.sin(ang) * len;
      const lx = ox + Math.cos(ang - spread) * len, ly = oy + Math.sin(ang - spread) * len;
      const rx = ox + Math.cos(ang + spread) * len, ry = oy + Math.sin(ang + spread) * len;
      const g = ctx.createLinearGradient(ox, oy, ex, ey);
      const rgb = rgbOf(b.col);
      const alpha = 0.085 + beat * 0.03;
      g.addColorStop(0, `rgba(${rgb},${alpha * 2.2})`);
      g.addColorStop(0.5, `rgba(${rgb},${alpha})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      ctx.fill();
      // núcleo más brillante del haz
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(ang - spread * 0.35) * len, oy + Math.sin(ang - spread * 0.35) * len);
      ctx.lineTo(ox + Math.cos(ang + spread * 0.35) * len, oy + Math.sin(ang + spread * 0.35) * len);
      ctx.closePath();
      ctx.fill();
      // la lámpara
      const lg = ctx.createRadialGradient(ox, oy + 6, 0, ox, oy + 6, 46);
      lg.addColorStop(0, `rgba(${rgb},0.7)`);
      lg.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = lg;
      ctx.fillRect(ox - 46, oy - 40, 92, 92);
    }

    // suelo de neón en perspectiva que avanza hacia el espectador
    const vx = w / 2;
    ctx.lineWidth = 1;
    const speed = 0.12;
    for (let i = 0; i < 16; i++) {
      const z = 1 - ((t * speed + i / 16) % 1); // 1 lejos, 0 cerca
      const p = 1 / (1 + z * 6);
      const y = horizon + (h - horizon) * ((p - 1 / 7) / (1 - 1 / 7));
      const a = (1 - z) * 0.22;
      ctx.strokeStyle = `rgba(190,120,255,${a})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = -12; i <= 12; i++) {
      const xb = vx + i * (w / 9);
      const fade = 1 - Math.abs(i) / 13;
      const grad = ctx.createLinearGradient(0, horizon, 0, h);
      grad.addColorStop(0, 'rgba(190,120,255,0)');
      grad.addColorStop(1, `rgba(190,120,255,${0.16 * fade})`);
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(vx + i * 6, horizon);
      ctx.lineTo(xb, h);
      ctx.stroke();
    }
    // línea del horizonte
    const hl = ctx.createLinearGradient(0, 0, w, 0);
    hl.addColorStop(0, 'rgba(255,140,255,0)');
    hl.addColorStop(0.5, `rgba(255,170,255,${0.5 + beat * 0.25})`);
    hl.addColorStop(1, 'rgba(255,140,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(0, horizon - 1, w, 2);

    // luces desenfocadas que flotan hacia arriba
    const unit = Math.min(w, h);
    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      o.y -= o.v * dt * (this.calm ? 0.3 : 1);
      if (o.y < -0.1) this.orbs[i] = this._orb();
      const x = (o.x + Math.sin(t * 0.3 + o.drift) * 0.02) * w;
      const y = o.y * h;
      const r = o.r * unit * (1 + beat * 0.05);
      // aparecen y se desvanecen suavemente en los bordes
      const edge = Math.min(1, (1.1 - o.y) * 4, (o.y + 0.1) * 5);
      ctx.globalAlpha = Math.max(0, o.a * edge * (0.85 + 0.15 * Math.sin(t * 1.3 + o.drift)));
      ctx.drawImage(bokehSprite(o.col), x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // viñeta
    const vg = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
