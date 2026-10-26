// Dibuja una autopista (highway) en pseudo-3D con Canvas 2D, al estilo Clone Hero:
// mástil con textura en perspectiva, trastes metálicos, cuerdas que vibran, sostenidos
// suaves con brillo y efectos (llamas, chispas, ondas, rayos de Star Power).
import { FRET_COLORS, OPEN_COLOR, SP_COLOR, DRUM_COLORS4, DRUM_COLORS5, KICK_COLOR } from '../core/constants.js';
import { HIT, MISSED, DROPPED, SKIPPED } from '../core/engine.js';
import {
  gemSprite, openSprite, drumSprite, kickSprite, glowSprite, sparkSprite, flameTongue, neckTexture,
  GEM_W, GEM_H, shade, lighten,
} from './sprites.js';
import { PODERES as PODERES_BT, MAX_PODERES as MAX_PODERES_BT, REPARA as REPARA_BT } from '../game/batalla.js';

const K = 2.6; // fuerza de la perspectiva
const S_FAR = 1 / (1 + K);
const D_MIN = -0.16;
const MULT_COLORS = { 1: '#ffffff', 2: '#ffb21e', 3: '#3ee36b', 4: '#c75cff' };
const MAX_PARTICLES = 450;
const MAX_PARTICLES_ALTO = 140;

function lowerBound(arr, time) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Acepta '#rrggbb', 'rgb(r,g,b)' o 'rgba(r,g,b,x)' y devuelve el color con alfa `a`
function rgba(col, a) {
  if (col[0] === '#') {
    const n = parseInt(col.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const [r, g, b] = col.match(/[\d.]+/g);
  return `rgba(${r},${g},${b},${a})`;
}

// Botones de la barra de golpeo que "brotan" uno tras otro al empezar (escala, desplazamiento)
function introRipple(age, lane, ry) {
  if (age >= 1.2) return [1, 0];
  const k = Math.min(1, Math.max(0, (age - 0.32 - lane * 0.075) / 0.26));
  if (k <= 0) return [0, 0];
  const c = 2.2; // easeOutBack: se pasa un poco y vuelve
  const e = 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
  return [Math.max(0.05, e), (1 - k) * ry * 2.5];
}

// Celular (sitio/celular.js): la barra de golpeo sube y la autopista se ensancha
// hasta que, a la altura de los botones táctiles (ui/tactil.js: el 20 % de abajo,
// centro en CEL_BOTONES), cada carril mide justo un quinto de la pantalla.
const CEL_STRIKE = 0.7, CEL_BOTONES = 0.9;
function anchoCelular(w, h, strikeY, topY) {
  const s = 1 + ((h * CEL_BOTONES - strikeY) * (1 - S_FAR)) / (strikeY - topY);
  return w / 2 / s;
}

// el apagón de la batalla tapa desde esta distancia (0 = la barra, 1 = el fondo de la pista) hacia la barra,
// con un borde que se funde en APAGON_BORDE: lo lejano se ve, lo que está por llegar no
const APAGON_DESDE = 0.35, APAGON_BORDE = 0.1;

// las etiquetas de teclas con dos trastes intercambiados (teclas cruzadas de la batalla)
function cruzaEtiquetas(labels, [a, b]) {
  const out = Object.assign(labels.slice(), labels);
  [out[a], out[b]] = [labels[b], labels[a]];
  return out;
}

export class HighwayRenderer {
  draw(ctx, view, p, now, song, opts) {
    // modo alto rendimiento: los mismos elementos, con efectos más sencillos
    this.alto = !!opts.alto;
    const perf = performance.now();
    const dt = Math.min(0.05, Math.max(0, (perf - (p._lastPerf ?? perf)) / 1000));
    p._lastPerf = perf;
    const fx = (p.fx ??= {
      particles: [], rings: [], shake: 0, btnPop: new Float64Array(8).fill(-100),
      missFlash: -100, spWave: -100, spFlash: -100, phraseFlash: -100, multPop: -100, lastMult: 1, bolts: null, boltT: 0,
    });
    const e = p.engine;
    const drums = e.kind === 'drums';
    const lanes = drums ? e.track.lanes : 5;
    const cel = !!opts.celular;
    // modo batalla (game/batalla.js): lo que le pasa a este jugador (vida, poderes, ataques recibidos)
    const B = p.batalla || null;
    const strikeY = view.y + view.h * (cel ? CEL_STRIKE : 0.8);
    const topY = view.y + view.h * (cel ? 0.05 : 0.08);
    const hw = cel ? anchoCelular(view.w, view.h, strikeY - view.y, topY - view.y) : Math.min(view.w * 0.4, view.h * 0.3);
    const G = {
      view, drums, lanes, strikeY, topY, hw, cx: view.x + view.w / 2, celular: cel,
      laneW: (2 * hw) / lanes,
      vis: 1.45 / Math.max(0.3, opts.noteSpeed),
      lefty: !!opts.lefty,
      colors: drums ? (lanes === 5 ? DRUM_COLORS5 : DRUM_COLORS4) : FRET_COLORS,
    };
    G.proj = (d) => {
      const s = 1 / (1 + K * d);
      return [s, strikeY - ((strikeY - topY) * (1 - s)) / (1 - S_FAR)];
    };
    G.laneN = (l) => {
      const n = ((l + 0.5) / lanes) * 2 - 1;
      return G.lefty ? -n : n;
    };
    G.laneX = (l, s) => G.cx + G.laneN(l) * hw * s;
    G.dOf = (t) => (t - now) / G.vis;
    const sB = 1 + ((view.y + view.h - strikeY) * (1 - S_FAR)) / (strikeY - topY);
    G.dBottom = Math.max(-0.6, (1 / sB - 1) / K);

    // multiplicador: pequeño "pop" al subir
    const mult = e.multiplier();
    if (mult > fx.lastMult) fx.multPop = now;
    fx.lastMult = mult;

    this._consumeFx(p, fx, G, now, opts);

    if (B?.amp) fx.shake = Math.max(fx.shake, 9 + 7 * Math.abs(Math.sin(perf / 70)));   // amplificador saturado: la pista se sacude
    fx.shake = Math.max(0, fx.shake - dt * 28);
    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() * 2 - 1) * fx.shake, (Math.random() * 2 - 1) * fx.shake);
    // y además se bambolea entera: gira, se estira y se corre de lado (dos ondas para que no sea un vaivén parejo)
    if (B?.amp) {
      const rot = 0.075 * Math.sin(perf / 140) + 0.035 * Math.sin(perf / 53), sx = 1 + 0.07 * Math.sin(perf / 95);
      ctx.translate(G.cx, strikeY);
      ctx.rotate(rot);
      ctx.scale(sx, 1 - 0.04 * Math.sin(perf / 120));
      ctx.translate(-G.cx + Math.sin(perf / 170) * view.w * 0.05, -strikeY);
    }
    // entrada de la autopista al empezar la canción: sube desde abajo
    G.intro = opts.introAge ?? 99;
    if (G.intro < 0.5) {
      const k = Math.max(0, G.intro / 0.5);
      ctx.translate(0, (1 - k) ** 3 * view.h * 0.75);
    }
    // bamboleo de la guitarra al perder la racha (como en CH): gira y cae un poco y vuelve con rebote
    if (fx.wobble) {
      const k = (perf - fx.wobble.t) / 1000;
      if (k > 0.9) fx.wobble = null;
      else {
        const a = fx.wobble.a, decay = Math.exp(-k * 5.5);
        const rot = a * 0.045 * decay * Math.sin(k * 26 + 0.4);
        const dy = a * view.h * 0.03 * Math.exp(-k * 9) * Math.abs(Math.cos(k * 18));
        ctx.translate(G.cx, strikeY + dy);
        ctx.rotate(rot);
        ctx.translate(-G.cx, -strikeY);
      }
    }

    // el mástil (veta de madera) va con el reloj de la canción aunque la autopista de
    // otro jugador se pinte con retraso (session.js): así se comparte y no se nota
    this._neck(ctx, G, opts.neckNow ?? now, opts);
    if (e.spActive) this._spTint(ctx, G, now);
    this._inlays(ctx, G, song, now);
    this._fretWires(ctx, G, song, now);
    if (drums) this._separators(ctx, G);
    else this._strings(ctx, G, e, now);
    this._rails(ctx, G, e, now, fx, mult);
    // con las teclas cruzadas, las etiquetas de esas dos teclas se cambian de traste
    const cruce = B?.cruce;
    this._strikeBar(ctx, G, e, now, fx, cruce && opts.keyLabels ? { ...opts, keyLabels: cruzaEtiquetas(opts.keyLabels, cruce) } : opts);
    // amplificador saturado: las notas parpadean, a ratos casi se apagan
    if (B?.amp) ctx.globalAlpha = Math.floor(perf / 90) % 4 === 0 ? 0.06 : 0.25 + 0.75 * Math.abs(Math.sin(perf / 55)) ** 2;
    if (!drums) this._sustains(ctx, G, e, now);
    this._gems(ctx, G, e, now, opts);
    ctx.globalAlpha = 1;
    if (B?.apagon) this._apagon(ctx, G, perf);
    if (cruce) this._cruce(ctx, G, cruce, perf);
    if (B && B.roto >= 0) this._cuerdaRota(ctx, G, B, perf);
    this._hitBursts(ctx, G, fx, now);
    if (!opts.rewinding) this._flames(ctx, G, e, now, fx, dt);
    this._particles(ctx, fx, dt, now);
    this._spEffects(ctx, G, e, now, fx);
    ctx.restore();

    this._hud(ctx, view, p, now, G, fx, mult);
  }

  /* Todo lo que se dibuja por primera vez a mitad de canción —un sprite que aún
     no existía, su textura en la GPU, un modo de mezcla o un trazo nuevo— cuesta
     un tirón ese cuadro: el primer rayo de Star Power era el más visible. Aquí,
     durante la pantalla de carga, se crean todos los sprites que puede pedir la
     pista y se pintan dos cuadros de mentira con todos los efectos (rayo, Star
     Power, llamas de los dos colores, chispas, mensajes); luego se borra. El
     motor del jugador no se toca: se dibuja una copia con su estado prestado. */
  precalienta(ctx, view, p, song, opts) {
    const e = p.engine;
    const drums = e.kind === 'drums';
    const sprites = [neckTexture(opts.style || 'wood'), flameTongue('blue'), flameTongue('orange')];
    const colores = drums ? [...DRUM_COLORS4, ...DRUM_COLORS5] : FRET_COLORS;
    for (const sp of [false, true]) {
      if (drums) {
        sprites.push(kickSprite(sp));
        for (const c of colores) sprites.push(drumSprite(c, false, sp), drumSprite(c, true, sp));
      } else {
        sprites.push(openSprite(0, sp), openSprite(1, sp));
        for (const c of colores) for (const t of [0, 1, 2]) sprites.push(gemSprite(c, t, sp));
      }
    }
    const brillos = ['rgba(255,255,255,1)', 'rgba(80,200,255,1)', 'rgba(255,170,40,1)', 'rgba(83,231,255,1)',
      ...colores, ...Object.values(MULT_COLORS).map((c) => rgba(c, 1)), rgba(SP_COLOR, 1)];
    for (const c of brillos) sprites.push(glowSprite(c));
    for (const c of [...colores, OPEN_COLOR, KICK_COLOR, SP_COLOR, '#ffffff', '#9fe8ff', '#ffcf5a', ...colores.map((x) => lighten(x, 0.3))]) sprites.push(sparkSprite(c));
    // cada textura sube a la GPU al pintarla una vez
    for (const c of sprites) ctx.drawImage(c, view.x, view.y, 2, 2);

    // un cuadro con Star Power activo y otro sin él, con el estado del jugador prestado
    const notes = e.track.notes;
    const t0 = (notes.find((n) => n.sp >= 0) || notes[0])?.time ?? 0;
    const fe = Object.create(e);
    const lanes = drums ? [...Array(e.track.lanes).keys()] : [0, 1, 2, 3, 4];
    const falso = {
      engine: fe, fxQueue: [], label: p.label, color: p.color, keyLabels: p.keyLabels,
      popups: [{ text: '¡STAR POWER!', t: t0, color: SP_COLOR, big: true }, { text: 'x', t: t0, color: '#ffd34d' }],
    };
    for (const [k, sp] of [[0, true], [1, false]]) {
      const now = t0 + k * 0.05;
      Object.assign(fe, { spActive: sp, sp: sp ? 1 : 0.6, held: 31, combo: 120, laneHitTime: new Float64Array(8).fill(now), padHitTime: new Float64Array(8).fill(now) });
      fe.multiplier = () => (sp ? 8 : 4);
      fe.comboProgress = () => 1;
      fe.sustainingMask = () => 63;
      falso.fxQueue.push(
        { type: 'hit', lanes, sp, star: true, gtype: 0 },
        { type: 'hit', lanes: [drums ? 'kick' : 'open'], sp, star: !sp, gtype: 1 },
        { type: 'phrase', lanes }, { type: 'spActivate' }, { type: 'break', had: 60 }, { type: 'streak' });
      this.draw(ctx, view, falso, now, song, { ...opts, introAge: 99 });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // ---------- Cola de efectos (los eventos del motor llegan aquí) ----------
  _consumeFx(p, fx, G, now, opts) {
    fx.ghosts ??= [];
    fx.beams ??= [];
    fx.bolts2 ??= [];
    const q = p.fxQueue;
    if (!q || !q.length) return;
    const [s0, y0] = G.proj(0);
    for (const ev of q.splice(0)) {
      if (ev.type === 'hit') {
        for (const lane of ev.lanes) {
          const wide = lane === 'open' || lane === 'kick';
          const base = lane === 'open' ? OPEN_COLOR : lane === 'kick' ? KICK_COLOR : G.colors[lane];
          const color = ev.sp ? SP_COLOR : base;
          if (wide) {
            fx.btnPop[7] = now;
            fx.rings.push({ x: G.cx, y: y0, rx0: G.hw * 0.5, rx1: G.hw * 1.15, t: now, color, wide: true });
            for (let l = 0; l < G.lanes; l++) this._sparks(fx, G.laneX(l, s0), y0, color, 5, G.laneW);
            const w = 2 * G.hw * 0.98;
            const spr = lane === 'open' ? openSprite(ev.gtype === 0 ? 0 : 1, ev.star) : kickSprite(ev.star);
            const h = lane === 'open' ? w * (48 / 512) * 1.3 * opts.tilt : w * (32 / 512) * 1.4;
            fx.ghosts.push({ spr, x: G.cx, y: y0, w, h, ay: lane === 'open' ? 0.35 : 0.4, t: now });
            if (lane === 'kick' && opts.shake) fx.shake = Math.max(fx.shake, 1.6);
          } else {
            fx.btnPop[lane] = now;
            const x = G.laneX(lane, s0);
            fx.rings.push({ x, y: y0, rx0: G.laneW * 0.32, rx1: G.laneW * 0.72, t: now, color });
            this._sparks(fx, x, y0, color, 12, G.laneW);
            if (ev.star) this._sparks(fx, x, y0, '#ffffff', 7, G.laneW);
            // la gema "estalla" al ser absorbida, sube un haz de luz y destella el traste
            const gw = G.laneW * 0.92;
            const spr = G.drums ? drumSprite(G.colors[lane], ev.cymbal, ev.star) : gemSprite(G.colors[lane], ev.gtype ?? 0, ev.star);
            fx.ghosts.push({ spr, x, y: y0, w: gw, h: gw * (GEM_H / GEM_W) * opts.tilt, ay: 40 / GEM_H, t: now });
            fx.beams.push({ lane, color: ev.sp ? SP_COLOR : lighten(base, 0.3), t: now });
          }
        }
      } else if (ev.type === 'break') {
        fx.missFlash = now;
        if (opts.shake) fx.wobble = { t: performance.now(), a: ev.had >= 50 ? 1 : ev.had >= 10 ? 0.75 : 0.4 };
      } else if (ev.type === 'overstrum') {
        fx.missFlash = now;
      } else if (ev.type === 'spActivate') {
        fx.spWave = now;
        fx.spFlash = now;
        if (opts.shake) fx.shake = Math.max(fx.shake, 4);
        for (let l = 0; l < G.lanes; l++) this._sparks(fx, G.laneX(l, s0), y0, SP_COLOR, 22, G.laneW * 1.6);
      } else if (ev.type === 'phrase') {
        // ¡Rayo! cae sobre los trastes de la nota que completó la frase
        fx.phraseFlash = now;
        const lanes = (ev.lanes || []).map((l) => (l === 'open' || l === 'kick' ? Math.floor(G.lanes / 2) : l));
        const targets = (lanes.length ? lanes : [Math.floor(G.lanes / 2)]).map((l) => G.laneX(l, s0));
        fx.bolts2.push({ t: now, targets, pts: null, gen: -1 });
        if (opts.shake) fx.shake = Math.max(fx.shake, 3);
        for (const x of targets) {
          this._sparks(fx, x, y0, '#ffffff', 16, G.laneW * 1.2);
          this._sparks(fx, x, y0, '#9fe8ff', 10, G.laneW * 1.2);
          fx.rings.push({ x, y: y0, rx0: G.laneW * 0.3, rx1: G.laneW * 1.3, t: now, color: '#ffffff' });
        }
      } else if (ev.type === 'streak') {
        for (let l = 0; l < G.lanes; l++) fx.rings.push({ x: G.laneX(l, s0), y: y0, rx0: G.laneW * 0.3, rx1: G.laneW * 1.4, t: now, color: '#ffd34d' });
      }
    }
  }

  _sparks(fx, x, y, color, n, spread) {
    const max = this.alto ? MAX_PARTICLES_ALTO : MAX_PARTICLES;
    if (this.alto) n = Math.ceil(n / 3);
    for (let i = 0; i < n && fx.particles.length < max; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 140 + Math.random() * 360;
      fx.particles.push({
        x: x + (Math.random() - 0.5) * spread * 0.5, y,
        vx: Math.cos(a) * v * 0.7, vy: Math.sin(a) * v,
        life: 0.35 + Math.random() * 0.45, max: 0.8, size: 5 + Math.random() * 9, color, g: 900,
      });
    }
  }

  // ---------- Mástil con textura en perspectiva (una línea de pantalla por vez) ----------
  // Era el 40 % de cada cuadro: cientos de drawImage. La geometría de cada línea
  // (profundidad, ancho, transparencia) no cambia entre cuadros y se calcula una
  // vez; y las líneas seguidas que toman la misma fila de la textura (abajo, donde
  // el mástil se ve ampliado) van en un solo drawImage. Se ve igual: el ancho de
  // la línea más ancha del tramo asoma bajo los rieles, que la tapan.
  _neckLines(G) {
    const yBot = G.view.y + G.view.h;
    const key = `${G.topY}|${G.strikeY}|${G.hw}|${yBot}`;
    // con 4 o más hay autopistas de dos tamaños y en varias filas: una geometría por cada una
    const cache = (this._neckLs ??= new Map());
    const hecho = cache.get(key);
    if (hecho) return hecho;
    const range = G.strikeY - G.topY;
    const ys = [], ds = [], ws = [], as = [];
    for (let y = Math.floor(G.topY); y < yBot; y++) {
      const s = 1 - ((G.strikeY - y) * (1 - S_FAR)) / range;
      if (s <= 0) continue;
      const d = (1 / s - 1) / K;
      const a = d > 0.75 ? Math.max(0, (1 - d) / 0.25) : 1;
      if (a <= 0) continue;
      ys.push(y);
      ds.push(d);
      ws.push(2 * G.hw * s);
      as.push(a * 0.96);
    }
    const L = { n: ys.length, y: Int32Array.from(ys), d: Float64Array.from(ds), w: Float64Array.from(ws), a: Float64Array.from(as) };
    if (cache.size >= 16) cache.clear();
    cache.set(key, L);
    return L;
  }

  /* Con varios jugadores, todas las autopistas tienen el mismo mástil en el mismo
     instante (misma geometría, velocidad y estilo): se pinta una vez en un lienzo
     aparte y se copia a cada una. La copia cae en píxeles enteros del dispositivo
     y el desfase subpíxel va dentro del lienzo, así que queda idéntica. Si algo
     no coincide (un temblor, la guitarra que se bambolea), se pinta directo. */
  _neck(ctx, G, now, opts) {
    const tr = ctx.getTransform();
    if (!opts.compartido || tr.b || tr.c) return this._neckDraw(ctx, G, now, opts, tr.a);
    const k = tr.a;
    // bajo la barra de golpeo el mástil sigue abriéndose: el ancho es el de la última línea
    const L = this._neckLines(G), half = (L.n ? L.w[L.n - 1] : 2 * G.hw) / 2 + 1;
    const x0 = G.cx - half, y0 = Math.floor(G.topY), yBot = G.view.y + G.view.h;
    const dx = k * x0 + tr.e, dy = k * y0 + tr.f;
    const fx = dx - Math.floor(dx), fy = dy - Math.floor(dy);
    // Un lienzo por geometría (la grande del centro y las chicas de los lados, con
    // 4 o más): cada uno se pinta una vez por cuadro y se copia a las que coinciden.
    const geo = [opts.style, G.vis, G.topY - y0, G.strikeY - y0, G.hw, yBot - y0, this.alto, k, fx.toFixed(4), fy.toFixed(4)].join('|');
    const lienzos = (this._neckCs ??= new Map());
    let n = lienzos.get(geo);
    if (!n || n.now !== now) {
      const W = Math.ceil(2 * half * k + fx) + 2, H = Math.ceil((yBot - y0) * k + fy) + 2;
      if (!n) {
        if (lienzos.size >= 8) lienzos.clear();
        lienzos.set(geo, (n = { c: document.createElement('canvas'), now: null }));
      }
      const c = n.c;
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      const oc = c.getContext('2d');
      oc.setTransform(1, 0, 0, 1, 0, 0);
      oc.clearRect(0, 0, W, H);
      oc.setTransform(k, 0, 0, k, fx - x0 * k, fy - y0 * k);
      this._neckDraw(oc, G, now, opts, k);
      n.now = now;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(n.c, Math.floor(dx), Math.floor(dy));
    ctx.restore();
  }

  _neckDraw(ctx, G, now, opts, k) {
    const tex = neckTexture(opts.style || 'wood');
    const texH = tex.height, texW = tex.width;
    const scale = texH * 0.9;
    const scroll = (now / G.vis) * scale;
    const L = this._neckLines(G);
    // alto de cada línea (1.5 tapa las rendijas con escalas de pantalla fraccionarias)
    const step = this.alto ? 2 : 1;
    const lh = this.alto ? 2.5 : Number.isInteger(k) ? 1 : 1.5;
    let runV = -1, runA = -1, runY = 0, runEnd = 0, runW = 0, alpha = -1;
    const flush = () => {
      if (runV < 0) return;
      if (runA !== alpha) ctx.globalAlpha = alpha = runA;
      ctx.drawImage(tex, 0, runV, texW, 1, G.cx - runW / 2, runY, runW, runEnd - runY + lh);
    };
    // sin suavizado la textura se estira mucho más rápido (y casi no se nota: es veta de madera)
    if (this.alto) ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < L.n; i += step) {
      let v = (scroll + L.d[i] * scale) % texH;
      if (v < 0) v += texH;
      v |= 0;
      const a = L.a[i], y = L.y[i];
      if (v === runV && a === runA) {
        runEnd = y;
        runW = L.w[i];
        continue;
      }
      flush();
      runV = v;
      runA = a;
      runY = runEnd = y;
      runW = L.w[i];
    }
    flush();
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
  }

  _trapezoid(ctx, G, d0, d1, widthMul = 1) {
    const [s0, y0] = G.proj(d0);
    const [s1, y1] = G.proj(d1);
    ctx.beginPath();
    ctx.moveTo(G.cx - G.hw * widthMul * s0, y0);
    ctx.lineTo(G.cx + G.hw * widthMul * s0, y0);
    ctx.lineTo(G.cx + G.hw * widthMul * s1, y1);
    ctx.lineTo(G.cx - G.hw * widthMul * s1, y1);
    ctx.closePath();
    return [y0, y1];
  }

  _spTint(ctx, G, now) {
    const [y0, y1] = this._trapezoid(ctx, G, G.dBottom, 1);
    const g = ctx.createLinearGradient(0, y1, 0, y0);
    g.addColorStop(0, 'rgba(40,120,255,0)');
    g.addColorStop(0.35, 'rgba(40,130,255,0.22)');
    g.addColorStop(1, `rgba(80,190,255,${0.3 + 0.08 * Math.sin(now * 9)})`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fill();
    // franjas de energía que suben por el mástil
    for (let k = 0; k < 6; k++) {
      const d = ((now * 0.9 + k / 6) % 1) * 1.05 - 0.05;
      const [s, y] = G.proj(d);
      const a = 0.22 * (1 - d);
      ctx.fillStyle = `rgba(140,220,255,${a})`;
      ctx.fillRect(G.cx - G.hw * s, y - 3 * s, G.hw * 2 * s, 6 * s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _inlays(ctx, G, song, now) {
    const list = song.inlays || [];
    for (let i = lowerBound(list, now + G.dBottom * G.vis); i < list.length; i++) {
      const it = list[i];
      const d = G.dOf(it.time);
      if (d > 1) break;
      const [s, y] = G.proj(d);
      const a = (d > 0.75 ? Math.max(0, (1 - d) / 0.25) : 1) * 0.5;
      const rx = G.laneW * 0.2 * s, ry = rx * 0.42;
      const xs = it.double ? [G.cx - G.laneW * s, G.cx + G.laneW * s] : [G.cx];
      for (const x of xs) {
        if (this.alto) {
          ctx.fillStyle = `rgba(200,220,238,${a * 0.85})`;
          ctx.beginPath();
          ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0, x, y, rx);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.5, `rgba(190,215,235,${a * 0.85})`);
        g.addColorStop(1, `rgba(120,140,170,${a * 0.6})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Trastes metálicos en cada pulso (más gruesos al inicio de compás)
  _fretWires(ctx, G, song, now) {
    const beats = song.beats;
    for (let i = lowerBound(beats, now + G.dBottom * G.vis); i < beats.length; i++) {
      const b = beats[i];
      const d = G.dOf(b.time);
      if (d > 1) break;
      const [s, y] = G.proj(d);
      const a = d > 0.75 ? Math.max(0, (1 - d) / 0.25) : 1;
      const w = G.hw * s;
      const th = (b.measure ? 5.5 : 2.6) * s;
      ctx.fillStyle = `rgba(0,0,0,${0.5 * a})`;
      ctx.fillRect(G.cx - w, y + th * 0.5, 2 * w, th * 0.7);
      ctx.fillStyle = b.measure ? `rgba(185,190,202,${0.85 * a})` : `rgba(150,155,168,${0.45 * a})`;
      ctx.fillRect(G.cx - w, y - th * 0.5, 2 * w, th);
      ctx.fillStyle = `rgba(255,255,255,${(b.measure ? 0.75 : 0.35) * a})`;
      ctx.fillRect(G.cx - w, y - th * 0.5, 2 * w, Math.max(0.8, th * 0.32));
    }
  }

  _separators(ctx, G) {
    const [s0, y0] = G.proj(G.dBottom);
    const [s1, y1] = G.proj(1);
    for (let l = 1; l < G.lanes; l++) {
      const n = -1 + (2 * l) / G.lanes;
      const g = ctx.createLinearGradient(0, y1, 0, y0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.18)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(G.cx + n * G.hw * s0, y0);
      ctx.lineTo(G.cx + n * G.hw * s1, y1);
      ctx.stroke();
    }
  }

  // Cuerdas metálicas sobre cada carril; vibran al acertar o sostener
  _strings(ctx, G, e, now) {
    const sus = e.sustainingMask?.() || 0;
    const [, y1] = G.proj(1);
    const [, y0] = G.proj(G.dBottom);
    for (let l = 0; l < 5; l++) {
      const age = Math.min(now - e.laneHitTime[l], now - e.laneHitTime[5]);
      const holding = sus & (1 << l) || sus & 32;
      const amp = holding ? 0.5 : age >= 0 && age < 0.5 ? 1 - age / 0.5 : 0;
      const g = ctx.createLinearGradient(0, y1, 0, y0);
      const col = amp > 0 ? FRET_COLORS[l] : '#c8ccd6';
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.3, rgba(col, 0.22 + amp * 0.3));
      g.addColorStop(1, rgba(col, 0.5 + amp * 0.4));
      ctx.strokeStyle = g;
      ctx.beginPath();
      const N = amp > 0 ? (this.alto ? 10 : 36) : 1;
      for (let k = 0; k <= N; k++) {
        const d = G.dBottom + ((1 - G.dBottom) * k) / N;
        const [s, y] = G.proj(d);
        const wob = amp > 0 ? Math.sin(d * 70 - now * 90) * G.laneW * 0.045 * amp : 0;
        const x = G.cx + (G.laneN(l) * G.hw + wob) * s;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 1.6 + amp * 1.2;
      ctx.stroke();
    }
  }

  // Rieles cromados con luz del color del multiplicador
  _rails(ctx, G, e, now, fx, mult) {
    const d0 = G.dBottom, d1 = 1;
    const [s0, y0] = G.proj(d0);
    const [s1, y1] = G.proj(d1);
    const missA = Math.max(0, 1 - (now - fx.missFlash) / 0.4);
    const phraseA = Math.max(0, 1 - (now - fx.phraseFlash) / 0.6);
    const popA = Math.max(0, 1 - (now - fx.multPop) / 0.5);
    const light = e.spActive ? SP_COLOR : mult > 1 ? MULT_COLORS[Math.min(4, mult)] : null;
    for (const side of [-1, 1]) {
      const inner0 = G.cx + side * G.hw * s0, outer0 = G.cx + side * G.hw * 1.08 * s0;
      const inner1 = G.cx + side * G.hw * s1, outer1 = G.cx + side * G.hw * 1.08 * s1;
      ctx.beginPath();
      ctx.moveTo(inner0, y0);
      ctx.lineTo(outer0, y0);
      ctx.lineTo(outer1, y1);
      ctx.lineTo(inner1, y1);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, y1, 0, y0);
      g.addColorStop(0, 'rgba(120,125,140,0)');
      g.addColorStop(0.25, 'rgba(95,100,115,0.85)');
      g.addColorStop(1, 'rgba(175,180,195,1)');
      ctx.fillStyle = g;
      ctx.fill();
      // brillo y sombra del cromo
      const hl = ctx.createLinearGradient(0, y1, 0, y0);
      hl.addColorStop(0, 'rgba(255,255,255,0)');
      hl.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.strokeStyle = hl;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(inner0, y0);
      ctx.lineTo(inner1, y1);
      ctx.stroke();
      // tira de luz
      const mid0 = G.cx + side * G.hw * 1.04 * s0, mid1 = G.cx + side * G.hw * 1.04 * s1;
      const lights = [];
      if (light) lights.push([light, 0.55 + 0.35 * popA + (e.spActive ? 0.2 * Math.sin(now * 16) : 0)]);
      if (missA > 0) lights.push(['#ff2a2a', missA]);
      if (phraseA > 0) lights.push([SP_COLOR, phraseA]);
      for (const [col, a] of lights) {
        const lg = ctx.createLinearGradient(0, y1, 0, y0);
        lg.addColorStop(0, rgba(col, 0));
        lg.addColorStop(0.3, rgba(col, a * 0.6));
        lg.addColorStop(1, rgba(col, a));
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = lg;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(mid0, y0);
        ctx.lineTo(mid1, y1);
        ctx.stroke();
        if (!this.alto) {
          ctx.lineWidth = 10;
          ctx.globalAlpha = 0.25;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  // Barra metálica y botones de los trastes
  _strikeBar(ctx, G, e, now, fx, opts) {
    const [s, y] = G.proj(0);
    const bw = G.hw * s * 1.08;
    const g = ctx.createLinearGradient(0, y - 6, 0, y + 6);
    g.addColorStop(0, '#e6e9ef');
    g.addColorStop(0.5, '#8b909c');
    g.addColorStop(1, '#2c2e35');
    ctx.fillStyle = g;
    ctx.fillRect(G.cx - bw, y - 4, bw * 2, 8);

    const labels = opts.keyLabels;
    if (G.drums) {
      const kickAge = now - (e.padHitTime?.[0] ?? -100);
      const kickLit = kickAge >= 0 && kickAge < 0.12;
      ctx.fillStyle = kickLit ? `rgba(255,170,60,${1 - kickAge / 0.12})` : shade(KICK_COLOR, -0.25);
      ctx.fillRect(G.cx - G.hw * s, y - (kickLit ? 6 : 3), G.hw * s * 2, kickLit ? 12 : 6);
      for (let l = 0; l < G.lanes; l++) {
        const x = G.laneX(l, s);
        const rx = G.laneW * 0.4, ry = rx * 0.42;
        const age = now - (e.padHitTime?.[l + 1] ?? -100);
        const lit = age >= 0 && age < 0.12;
        const pop = Math.max(0, 1 - (now - fx.btnPop[l]) / 0.18);
        const [ik] = introRipple(G.intro, l, ry);
        if (ik <= 0) continue;
        const sc = (1 + pop * 0.2) * ik;
        ctx.beginPath();
        ctx.ellipse(x, y, rx * sc * 1.08, ry * sc * 1.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0a0e';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x, y - pop * ry * 0.3, rx * sc, ry * sc, 0, 0, Math.PI * 2);
        ctx.fillStyle = lit ? shade(G.colors[l], 0.3 * (1 - age / 0.12)) : '#1a1b22';
        ctx.fill();
        ctx.lineWidth = Math.max(2, rx * 0.16);
        ctx.strokeStyle = G.colors[l];
        ctx.stroke();
        if (labels?.[l]) this._label(ctx, x, y + ry * 2.3, labels[l], G);
      }
      if (labels?.kick) this._label(ctx, G.cx, y + G.laneW * 0.7, labels.kick, G);
      return;
    }

    for (let f = 0; f < 5; f++) {
      const x = G.laneX(f, s);
      const rx = G.laneW * 0.4, ry = rx * 0.45;
      const pressed = (e.held >> f) & 1;
      const pop = Math.max(0, 1 - (now - Math.max(fx.btnPop[f], fx.btnPop[7])) / 0.2);
      const [ik, idy] = introRipple(G.intro, f, ry);
      if (ik <= 0) continue;
      const sc = (1 + pop * 0.22) * ik;
      const lift = (pressed ? -ry * 0.25 : 0) - pop * ry * 0.35 + idy;
      ctx.beginPath();
      ctx.ellipse(x, y + ry * 0.35, rx * 1.05 * ik, ry * 1.05 * ik, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#060608';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y + lift, rx * sc, ry * sc, 0, 0, Math.PI * 2);
      const mg = ctx.createLinearGradient(0, y - ry, 0, y + ry);
      mg.addColorStop(0, '#e1e4ec');
      mg.addColorStop(1, '#4d505b');
      ctx.fillStyle = mg;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y + lift, rx * 0.8 * sc, ry * 0.8 * sc, 0, 0, Math.PI * 2);
      ctx.fillStyle = FRET_COLORS[f];
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y + lift, rx * 0.56 * sc, ry * 0.56 * sc, 0, 0, Math.PI * 2);
      ctx.fillStyle = pop > 0 ? shade(FRET_COLORS[f], 0.4 + 0.6 * pop) : pressed ? shade(FRET_COLORS[f], 0.5) : '#121319';
      ctx.fill();
      if (pressed || pop > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 + pop * 0.6;
        const r = rx * (1.5 + pop);
        ctx.drawImage(glowSprite(FRET_COLORS[f]), x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (labels?.[f]) this._label(ctx, x, y + ry * 2.4, labels[f], G);
    }
  }

  _label(ctx, x, y, text, G) {
    const fs = Math.max(10, Math.min(16, G.laneW * 0.24));
    ctx.font = `700 ${fs}px Rajdhani, "Segoe UI", sans-serif`;
    const w = Math.max(fs * 1.5, ctx.measureText(text).width + fs * 0.8);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - fs * 0.75, w, fs * 1.5, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.textBaseline = 'alphabetic';
  }

  // ---------- Sostenidos: cinta suave con brillo y onda al tocarlos ----------
  _sustains(ctx, G, e, now) {
    const notes = e.track.notes;
    const first = lowerBound(notes, now + D_MIN * G.vis);
    const last = lowerBound(notes, now + G.vis * 1.02);
    for (let i = Math.max(0, first - 48); i < last; i++) {
      const nt = notes[i];
      if (!nt.sus.length || nt.endTime < now + D_MIN * G.vis) continue;
      const st = e.noteState[i];
      for (const s of nt.sus) {
        // (tras retroceder en la pausa, las notas ya acertadas que vuelven a pasar no se dibujan)
        const held = st === HIT && s.endTime > now && nt.time <= now + 0.05;
        if (st === HIT && !held) continue;
        const d0 = Math.max(D_MIN, st === HIT ? 0 : G.dOf(nt.time));
        const d1 = Math.min(1, G.dOf(s.endTime));
        if (d1 <= d0) continue;
        const dead = st === MISSED || st === DROPPED;
        const sp = nt.sp >= 0 && !dead && !e.phraseFailed?.[nt.sp];
        if (nt.open) {
          this._ribbon(ctx, G, 0, G.hw * 0.85, d0, d1, dead ? '#4a4652' : sp ? lighten(OPEN_COLOR, 0.4) : OPEN_COLOR, held, dead, now, 0.38);
        } else {
          for (let f = 0; f < 5; f++) {
            if (!(s.mask & (1 << f))) continue;
            this._ribbon(ctx, G, G.laneN(f) * G.hw, G.laneW * 0.13, d0, d1, dead ? '#4a4652' : sp ? lighten(FRET_COLORS[f], 0.45) : FRET_COLORS[f], held, dead, now, 1);
          }
        }
      }
    }
  }

  _ribbon(ctx, G, offX, halfW, d0, d1, color, held, dead, now, alpha) {
    const len = d1 - d0;
    const N = Math.max(6, Math.min(this.alto ? 16 : 60, Math.ceil(len * (held ? 90 : 30))));
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const d = d0 + (len * k) / N;
      const [s, y] = G.proj(d);
      // la onda se atenúa en la punta y nace en la barra de golpeo
      const env = held ? Math.min(1, (d - d0) * 12) * Math.min(1, (d1 - d) * 20) : 0;
      const wave = held ? (Math.sin(d * 55 - now * 32) * 0.55 + Math.sin(d * 23 - now * 17) * 0.25) * halfW * env : 0;
      const fadeTop = d > 0.75 ? Math.max(0, (1 - d) / 0.25) : 1;
      pts.push({ x: G.cx + (offX + wave) * s, y, w: halfW * s, a: fadeTop });
    }
    const path = (mul) => {
      ctx.beginPath();
      for (let k = 0; k < pts.length; k++) ctx.lineTo(pts[k].x - pts[k].w * mul, pts[k].y);
      // punta redondeada
      const tip = pts[pts.length - 1];
      ctx.ellipse(tip.x, tip.y, tip.w * mul, tip.w * mul * 0.5, 0, Math.PI, 0, false);
      for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k].x + pts[k].w * mul, pts[k].y);
      ctx.closePath();
    };
    const [, yA] = G.proj(d0);
    const [, yB] = G.proj(d1);
    const grad = (c, a) => {
      const g = ctx.createLinearGradient(0, yB, 0, yA);
      g.addColorStop(0, rgba(c, a * pts[pts.length - 1].a));
      g.addColorStop(1, rgba(c, a));
      return g;
    };
    // halo
    if (!dead && !this.alto) {
      ctx.globalCompositeOperation = 'lighter';
      path(held ? 2.8 : 1.9);
      ctx.fillStyle = grad(color, (held ? 0.32 : 0.14) * alpha);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // cuerpo
    path(1);
    ctx.fillStyle = grad(held ? shade(color, 0.25) : color, (dead ? 0.55 : 0.92) * alpha);
    ctx.fill();
    // núcleo brillante
    path(0.34);
    ctx.fillStyle = grad('#ffffff', (dead ? 0.12 : held ? 0.85 : 0.45) * alpha);
    ctx.fill();
  }

  // ---------- Gemas ----------
  _gems(ctx, G, e, now, opts) {
    const notes = e.track.notes;
    const first = lowerBound(notes, now + D_MIN * G.vis);
    const last = lowerBound(notes, now + G.vis * 1.02);
    for (let i = last - 1; i >= first; i--) {
      const st = e.noteState[i];
      if (st === HIT || st === DROPPED || st === SKIPPED) continue;
      const nt = notes[i];
      const d = G.dOf(nt.time);
      if (d < D_MIN || d > 1.02) continue;
      const [s, y] = G.proj(d);
      const fade = d > 0.82 ? Math.max(0, (1 - d) / 0.18) : d < -0.05 ? Math.max(0, 1 + (d + 0.05) / 0.11) : 1;
      const a = fade * (st === MISSED ? 0.5 : 1);
      if (a <= 0) continue;
      // nota estrella mientras su frase siga intacta; si fallas, vuelve a su forma normal
      const sp = nt.sp >= 0 && st !== MISSED && !e.phraseFailed?.[nt.sp];
      if (G.drums) {
        if (nt.pad < 0) {
          const w = 2 * G.hw * s * 0.98;
          const h = w * (32 / 512) * 1.4;
          ctx.globalAlpha = a;
          ctx.drawImage(kickSprite(sp), G.cx - w / 2, y - h * 0.4, w, h);
        } else {
          const gw = G.laneW * s * 0.9;
          const gh = gw * (GEM_H / GEM_W) * opts.tilt;
          const x = G.laneX(nt.pad, s);
          if (sp) this._spGlow(ctx, x, y, gw, now, i, a);
          ctx.globalAlpha = a;
          ctx.drawImage(drumSprite(G.colors[nt.pad], nt.cymbal, sp), x - gw / 2, y - gh * (40 / GEM_H), gw, gh);
        }
      } else if (nt.open) {
        const w = 2 * G.hw * s * 0.98;
        const h = w * (48 / 512) * 1.3 * opts.tilt;
        ctx.globalAlpha = a;
        ctx.drawImage(openSprite(nt.type === 1 || nt.type === 2 ? 1 : 0, sp), G.cx - w / 2, y - h * 0.35, w, h);
      } else {
        const gw = G.laneW * s * 0.92 * (nt.type === 1 ? 0.92 : 1);
        const gh = gw * (GEM_H / GEM_W) * opts.tilt;
        for (let f = 0; f < 5; f++) {
          if (!(nt.frets & (1 << f))) continue;
          const x = G.laneX(f, s);
          if (sp) this._spGlow(ctx, x, y, gw, now, i, a);
          ctx.globalAlpha = a;
          ctx.drawImage(gemSprite(FRET_COLORS[f], nt.type, sp), x - gw / 2, y - gh * (40 / GEM_H), gw, gh);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Brillo blanco que "respira" alrededor de las notas estrella
  _spGlow(ctx, x, y, gw, now, i, a) {
    const r = gw * (0.8 + 0.12 * Math.sin(now * 9 + i));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * (0.22 + 0.14 * Math.sin(now * 8 + i * 1.7));
    ctx.drawImage(glowSprite('rgba(255,255,255,1)'), x - r, y - r * 0.6, r * 2, r * 1.2);
    // destello ocasional
    const tw = (now * 2.3 + i * 0.37) % 1;
    if (tw < 0.12 && !this.alto) {
      const k = 1 - Math.abs(tw - 0.06) / 0.06;
      const sz = gw * 0.35 * k;
      ctx.globalAlpha = a * k;
      ctx.drawImage(sparkSprite('#ffffff'), x + gw * 0.18 - sz / 2, y - gw * 0.12 - sz / 2, sz, sz);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- Sensación de acierto: la gema estalla, sube un haz de luz y destella el traste ----------
  _hitBursts(ctx, G, fx, now) {
    const [s0, y0] = G.proj(0);
    ctx.globalCompositeOperation = 'lighter';
    // haz de luz que sube por el carril
    for (let i = fx.beams.length - 1; i >= 0; i--) {
      const b = fx.beams[i];
      const k = (now - b.t) / 0.2;
      if (k >= 1 || k < 0) {
        if (k >= 1) fx.beams.splice(i, 1);
        continue;
      }
      const reach = 0.12 + 0.4 * Math.sqrt(k);
      const [s1, y1] = G.proj(reach);
      const n = G.laneN(b.lane);
      const w0 = G.laneW * 0.42 * s0 * (1 - k * 0.4), w1 = G.laneW * 0.12 * s1;
      const x0 = G.cx + n * G.hw * s0, x1 = G.cx + n * G.hw * s1;
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, rgba(b.color, 0.4 * (1 - k)));
      g.addColorStop(1, rgba(b.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 - w0, y0);
      ctx.lineTo(x0 + w0, y0);
      ctx.lineTo(x1 + w1, y1);
      ctx.lineTo(x1 - w1, y1);
      ctx.fill();
      // destello blanco en el traste
      if (k < 0.5) {
        const r = G.laneW * 0.45 * (1 + k);
        ctx.globalAlpha = (1 - k * 2) * 0.8;
        ctx.drawImage(glowSprite('rgba(255,255,255,1)'), x0 - r, y0 - r * 0.7, r * 2, r * 1.4);
        ctx.globalAlpha = 1;
      }
    }
    // la gema crece y se desvanece (eco brillante)
    for (let i = fx.ghosts.length - 1; i >= 0; i--) {
      const g = fx.ghosts[i];
      const k = (now - g.t) / 0.17;
      if (k >= 1 || k < 0) {
        if (k >= 1) fx.ghosts.splice(i, 1);
        continue;
      }
      const sc = 1 + 0.65 * k;
      const w = g.w * sc, h = g.h * sc;
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.drawImage(g.spr, g.x - w / 2, g.y - h * g.ay - k * G.laneW * 0.15, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Rayo que cae del cielo al completar una frase de Star Power
  _bolts(ctx, G, fx, now) {
    const [, y0] = G.proj(0);
    for (let i = fx.bolts2.length - 1; i >= 0; i--) {
      const b = fx.bolts2[i];
      const k = (now - b.t) / 0.45;
      if (k >= 1 || k < 0) {
        if (k >= 1) fx.bolts2.splice(i, 1);
        continue;
      }
      // el trazo se regenera cada pocos ms para que "chisporrotee"
      const gen = Math.floor((now - b.t) / 0.045);
      if (gen !== b.gen) {
        b.gen = gen;
        b.pts = b.targets.map((tx) => {
          const main = [];
          const top = G.view.y - 10;
          const N = 14;
          let x = tx + (Math.random() - 0.5) * G.laneW * 2;
          for (let j = 0; j <= N; j++) {
            const f = j / N;
            const y = top + (y0 - top) * f;
            const jit = G.laneW * 0.55 * (1 - f * 0.8);
            x = j === N ? tx : x + (tx - x) / (N - j + 1) + (Math.random() - 0.5) * jit;
            main.push([x, y]);
          }
          const branches = [];
          for (let r = 0; r < 2; r++) {
            const from = main[3 + Math.floor(Math.random() * 7)];
            const br = [from];
            let [bx, by] = from;
            const dir = Math.random() < 0.5 ? -1 : 1;
            for (let j = 0; j < 4; j++) {
              bx += dir * G.laneW * (0.2 + Math.random() * 0.4);
              by += (y0 - G.view.y) * 0.05;
              br.push([bx, by]);
            }
            branches.push(br);
          }
          return [main, ...branches];
        });
      }
      const flick = (1 - k) * (0.65 + 0.35 * Math.random());
      ctx.globalCompositeOperation = 'lighter';
      for (const paths of b.pts) {
        paths.forEach((pts, pi) => {
          for (const [w, col] of (this.alto ? [[6, `rgba(170,230,255,${0.7 * flick})`], [2.2, `rgba(255,255,255,${flick})`]] : [[16, `rgba(80,160,255,${0.22 * flick})`], [6, `rgba(170,230,255,${0.7 * flick})`], [2.2, `rgba(255,255,255,${flick})`]])) {
            ctx.strokeStyle = col;
            ctx.lineWidth = pi ? w * 0.5 : w;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
          }
        });
      }
      // destello general al caer
      if (k < 0.25) {
        this._trapezoid(ctx, G, G.dBottom, 1, 1.08);
        ctx.fillStyle = `rgba(210,240,255,${0.35 * (1 - k / 0.25)})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ---------- Llamas ----------
  _flames(ctx, G, e, now, fx, dt) {
    const [s, y] = G.proj(0);
    const hue = e.spActive ? 'blue' : 'orange';
    const susMask = G.drums ? 0 : e.sustainingMask?.() || 0;
    ctx.globalCompositeOperation = 'lighter';
    const drawFlame = (x, k, big) => {
      const base = G.laneW * (big ? 1.25 : 0.95);
      ctx.globalAlpha = Math.max(0, k) * 0.55;
      const gr = base * 1.3;
      ctx.drawImage(glowSprite(hue === 'blue' ? 'rgba(80,200,255,1)' : 'rgba(255,170,40,1)'), x - gr, y - gr * 0.9, gr * 2, gr * 1.6);
      for (let j = this.alto ? 1 : 0; j < (this.alto ? 2 : 3); j++) {
        const w = base * (0.55 + Math.random() * 0.35) * (j === 1 ? 1.15 : 0.85);
        const h = w * (1.7 + Math.random() * 0.8) * (0.6 + 0.4 * k);
        const ox = (j - 1) * w * 0.28 + (Math.random() - 0.5) * w * 0.1;
        ctx.globalAlpha = Math.max(0, k) * (j === 1 ? 1 : 0.7);
        ctx.drawImage(flameTongue(hue), x + ox - w / 2, y - h * 0.86, w, h);
      }
    };
    const count = G.drums ? G.lanes + 1 : 6;
    for (let l = 0; l < count; l++) {
      const age = now - e.laneHitTime[l];
      const fresh = age >= 0 && age < 0.26;
      const sustaining = !G.drums && ((l < 5 && susMask & (1 << l)) || (l === 5 && susMask & 32));
      if (!fresh && !sustaining) continue;
      const k = fresh ? 1 - age / 0.26 : 0.45 + Math.random() * 0.25;
      const wide = (G.drums && l === 0) || (!G.drums && l === 5);
      const lanesToDraw = wide ? [...Array(G.lanes).keys()] : [G.drums ? l - 1 : l];
      for (const lane of lanesToDraw) {
        const x = G.laneX(lane, s);
        drawFlame(x, wide ? k * 0.7 : k, fresh && !wide);
        if (sustaining && Math.random() < dt * 40) this._sparks(fx, x, y, hue === 'blue' ? SP_COLOR : '#ffcf5a', 1, G.laneW * 0.4);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- Partículas y ondas ----------
  _particles(ctx, fx, dt, now) {
    ctx.globalCompositeOperation = 'lighter';
    const ps = fx.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.life / p.max;
      const sz = p.size * (0.4 + k);
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.drawImage(sparkSprite(p.color), p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
    for (let i = fx.rings.length - 1; i >= 0; i--) {
      const r = fx.rings[i];
      const k = (now - r.t) / 0.24;
      if (k >= 1 || k < 0) {
        if (k >= 1) fx.rings.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const rx = r.rx0 + (r.rx1 - r.rx0) * e;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = (r.wide ? 4 : 3) * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx, rx * (r.wide ? 0.18 : 0.42), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Rayos en los rieles, onda de activación y destello
  _spEffects(ctx, G, e, now, fx) {
    this._bolts(ctx, G, fx, now);
    ctx.globalCompositeOperation = 'lighter';
    if (e.spActive) {
      if (!fx.bolts || now - fx.boltT > 0.06 || now < fx.boltT) {
        fx.boltT = now;
        fx.bolts = [-1, 1].map((side) => {
          const pts = [];
          for (let k = 0; k <= 16; k++) {
            const d = G.dBottom + ((0.95 - G.dBottom) * k) / 16;
            const [s, y] = G.proj(d);
            pts.push([G.cx + side * G.hw * s * (1.04 + (Math.random() - 0.5) * 0.06), y]);
          }
          return pts;
        });
      }
      for (const pts of fx.bolts) {
        for (const [w, col] of [[7, 'rgba(60,160,255,0.35)'], [2, 'rgba(220,250,255,0.95)']]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      }
    }
    const wk = (now - fx.spWave) / 0.7;
    if (wk >= 0 && wk < 1) {
      const d = wk * 1.05;
      const [s, y] = G.proj(d);
      const w = G.hw * s * 1.1;
      const g = ctx.createLinearGradient(0, y - 30 * s, 0, y + 30 * s);
      g.addColorStop(0, 'rgba(83,231,255,0)');
      g.addColorStop(0.5, `rgba(200,250,255,${0.9 * (1 - wk)})`);
      g.addColorStop(1, 'rgba(83,231,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(G.cx - w, y - 30 * s, w * 2, 60 * s);
    }
    const fk = (now - fx.spFlash) / 0.45;
    if (fk >= 0 && fk < 1) {
      this._trapezoid(ctx, G, G.dBottom, 1, 1.08);
      ctx.fillStyle = `rgba(120,220,255,${0.45 * (1 - fk)})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- HUD ----------
  // Multiplicador como velocímetro: la aguja sube con la racha y se satura (tiembla) en el máximo
  _multGauge(ctx, e, now, fx, mult, multColor, x, y, R) {
    const perf = performance.now();
    const dt = Math.min(0.05, Math.max(0, (perf - (fx.gLast ?? perf)) / 1000));
    fx.gLast = perf;
    const maxM = e.maxMult || 4;
    const base = e.spActive ? mult / 2 : mult;
    const maxed = base >= maxM;
    const target = maxed ? 1 : Math.min(1, (base - 1 + e.comboProgress()) / (maxM - 1));
    // aguja con resorte: rebota un poco al subir y cae de golpe al perder la racha
    fx.gp ??= 0;
    fx.gv ??= 0;
    fx.gv += ((target - fx.gp) * 190 - fx.gv * 15) * dt;
    fx.gp += fx.gv * dt;
    let v = Math.max(-0.03, Math.min(1.03, fx.gp));
    if (maxed && v > 0.97) v = 1 + Math.sin(perf / 19) * 0.012 + (Math.random() - 0.5) * 0.012;
    const A0 = Math.PI * 0.75, SW = Math.PI * 1.5;
    const ang = (t) => A0 + Math.max(0, Math.min(1.03, t)) * SW;
    const pop = Math.max(0, 1 - (now - fx.multPop) / 0.45);
    const hot = e.spActive ? SP_COLOR : multColor;

    // halo: crece con la aguja; al máximo, late
    const heat = Math.max(0, Math.min(1, v));
    if (heat > 0.05 || e.spActive) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, 0.15 + heat * 0.35 + pop * 0.5 + (maxed ? 0.18 * Math.sin(perf / 90) + 0.15 : 0) + (e.spActive ? 0.25 : 0));
      const gr = R * (2.1 + pop * 0.5);
      ctx.drawImage(glowSprite(rgba(hot, 1)), x - gr, y - gr, gr * 2, gr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // carcasa metálica y esfera
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    const face = ctx.createRadialGradient(x, y - R * 0.3, R * 0.1, x, y, R);
    face.addColorStop(0, '#22212e');
    face.addColorStop(1, '#07070b');
    ctx.fillStyle = face;
    ctx.fill();
    const bez = ctx.createLinearGradient(x, y - R, x, y + R);
    bez.addColorStop(0, '#f2f4f8');
    bez.addColorStop(0.45, '#8d929e');
    bez.addColorStop(1, '#2b2d35');
    ctx.lineWidth = Math.max(2, R * 0.07);
    ctx.strokeStyle = bez;
    ctx.stroke();

    // arco por zonas (una por multiplicador)
    const rr = R * 0.76, lw = R * 0.15;
    ctx.lineCap = 'butt';
    for (let z = 0; z < maxM - 1; z++) {
      const a = z / (maxM - 1), b = (z + 1) / (maxM - 1);
      const col = e.spActive ? SP_COLOR : MULT_COLORS[Math.min(4, z + 2)];
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(x, y, rr, ang(a) + 0.02, ang(b) - 0.02);
      ctx.strokeStyle = rgba(col, 0.16);
      ctx.stroke();
      if (v > a) {
        ctx.beginPath();
        ctx.arc(x, y, rr, ang(a) + 0.02, ang(Math.min(v, b)) - (v >= b ? 0.02 : 0));
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = this.alto ? 0 : R * 0.25;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    // zona roja al final del recorrido
    ctx.lineWidth = Math.max(1.5, R * 0.035);
    ctx.beginPath();
    ctx.arc(x, y, R * 0.9, ang((maxM - 1.6) / (maxM - 1)), ang(1));
    ctx.strokeStyle = maxed ? `rgba(255,70,60,${0.75 + 0.25 * Math.sin(perf / 70)})` : 'rgba(255,60,50,0.55)';
    ctx.stroke();

    // marcas: una por nota de cada zona; las grandes en cada cambio de multiplicador
    const ticks = (maxM - 1) * 10;
    for (let k = 0; k <= ticks; k++) {
      const t = k / ticks, major = k % 10 === 0;
      const a = ang(t);
      const r0 = R * (major ? 0.5 : 0.56), r1 = R * 0.62;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      ctx.lineWidth = major ? Math.max(1.5, R * 0.045) : 1;
      ctx.strokeStyle = t <= v + 1e-3 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)';
      ctx.stroke();
    }

    // chispas en la punta cuando está saturado
    if (maxed) {
      const a = ang(1);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const rad = rr + (Math.random() - 0.5) * lw * 1.6;
        const da = (Math.random() - 0.5) * 0.25;
        ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : hot;
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a + da) * rad, y + Math.sin(a + da) * rad, R * (0.02 + Math.random() * 0.03), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // aguja
    const na = ang(v);
    const nx = Math.cos(na), ny = Math.sin(na);
    const px = -ny, py = nx;
    const tip = R * 0.84, tail = R * 0.16, bw = R * 0.06;
    ctx.beginPath();
    ctx.moveTo(x + nx * tip, y + ny * tip);
    ctx.lineTo(x + px * bw - nx * tail, y + py * bw - ny * tail);
    ctx.lineTo(x - px * bw - nx * tail, y - py * bw - ny * tail);
    ctx.closePath();
    ctx.fillStyle = e.spActive ? '#bff8ff' : '#ff3d3d';
    ctx.shadowColor = e.spActive ? SP_COLOR : '#ff2a2a';
    ctx.shadowBlur = this.alto ? 0 : R * 0.3;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, R * 0.12, 0, Math.PI * 2);
    const cap = ctx.createRadialGradient(x - R * 0.04, y - R * 0.05, 1, x, y, R * 0.12);
    cap.addColorStop(0, '#ffffff');
    cap.addColorStop(1, '#5d616c');
    ctx.fillStyle = cap;
    ctx.fill();

    // número del multiplicador en la parte baja de la esfera
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fs = R * 0.5 * (1 + pop * 0.35);
    ctx.font = `800 ${Math.round(fs)}px Rajdhani, "Segoe UI", sans-serif`;
    ctx.shadowColor = hot;
    ctx.shadowBlur = this.alto ? 0 : R * (0.15 + pop * 0.5 + (maxed ? 0.2 : 0));
    ctx.fillStyle = mult > 1 || e.spActive ? hot : '#e8e8ee';
    ctx.fillText(`x${mult}`, x, y + R * 0.52);
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';
  }

  // Star Power como celda de energía: tubo de vidrio con energía líquida que sube, burbujas,
  // una oleada al ganar energía y rayos alrededor cuando está lista para activarse.
  // (x, y, w, h) es el rectángulo en pantalla; horizontal = se llena de izquierda a derecha.
  /* ---------- modo batalla ---------- */
  // Apagón: las notas se ven al aparecer, en la parte lejana de la pista (para adivinar dónde van a caer), y se
  // pierden en un negro opaco que tapa desde APAGON_DESDE hasta pasada la barra donde se tocan; solo se ven
  // las llamas y chispas de lo que aciertas, que se pintan encima
  _apagon(ctx, G, perf) {
    const [s0, y0] = G.proj(Math.max(G.dBottom, -0.09)), [s1, y1] = G.proj(APAGON_DESDE), [s2, y2] = G.proj(APAGON_DESDE + APAGON_BORDE), w = G.hw * 1.14;
    ctx.save();
    const gr = ctx.createLinearGradient(0, y2, 0, y1);
    gr.addColorStop(0, 'rgba(3,2,8,0)');
    gr.addColorStop(1, 'rgba(3,2,8,1)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(G.cx - w * s2, y2); ctx.lineTo(G.cx + w * s2, y2); ctx.lineTo(G.cx + w * s1, y1); ctx.lineTo(G.cx - w * s1, y1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#030208';
    ctx.beginPath();
    ctx.moveTo(G.cx - w * s1, y1 - 0.5); ctx.lineTo(G.cx + w * s1, y1 - 0.5); ctx.lineTo(G.cx + w * s0, y0); ctx.lineTo(G.cx - w * s0, y0);
    ctx.closePath(); ctx.fill();
    // el borde de abajo, apenas marcado (para saber dónde está la barra), y el aviso
    const [sb, yb] = G.proj(0);
    ctx.strokeStyle = `rgba(106,138,255,${0.18 + 0.1 * Math.sin(perf / 160)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(G.cx - G.hw * sb, yb); ctx.lineTo(G.cx + G.hw * sb, yb); ctx.stroke();
    ctx.font = `800 ${Math.round(Math.max(14, G.laneW * 0.42))}px Rajdhani, "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(106,138,255,0.35)';
    ctx.fillText('🌑 APAGÓN', G.cx, (y1 + yb) / 2);
    ctx.restore();
  }

  // Teclas cruzadas: una flecha doble une los dos trastes y cada uno lleva un anillo del color de la tecla que
  // ahora lo toca
  _cruce(ctx, G, [a, b], perf) {
    if (a >= G.lanes || b >= G.lanes) return;
    const [s, y] = G.proj(0), xa = G.laneX(a, s), xb = G.laneX(b, s), rx = G.laneW * 0.4, ry = rx * 0.45;
    const k = 0.6 + 0.4 * Math.abs(Math.sin(perf / 140)), top = y - G.laneW * (0.75 + 0.18 * Math.abs(b - a));
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [l, otro] of [[a, b], [b, a]]) {
      const x = l === a ? xa : xb;
      ctx.beginPath(); ctx.ellipse(x, y, rx * 1.32, ry * 1.32, 0, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(3, rx * 0.22); ctx.strokeStyle = G.colors[otro]; ctx.globalAlpha = k; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const curva = () => { ctx.beginPath(); ctx.moveTo(xa, y - ry * 1.4); ctx.quadraticCurveTo((xa + xb) / 2, top, xb, y - ry * 1.4); };
    curva(); ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.stroke();
    curva(); ctx.lineWidth = 4.5; ctx.strokeStyle = '#c79bff'; ctx.stroke();
    // puntas de flecha en los dos extremos, siguiendo la curva
    for (const x0 of [xa, xb]) {
      const ang = Math.atan2(y - ry * 1.4 - top, x0 - (xa + xb) / 2), L = Math.max(9, rx * 0.55);
      ctx.beginPath();
      ctx.moveTo(x0, y - ry * 1.4);
      ctx.lineTo(x0 - L * Math.cos(ang - 0.5), y - ry * 1.4 - L * Math.sin(ang - 0.5));
      ctx.moveTo(x0, y - ry * 1.4);
      ctx.lineTo(x0 - L * Math.cos(ang + 0.5), y - ry * 1.4 - L * Math.sin(ang + 0.5));
      ctx.lineWidth = 4.5; ctx.strokeStyle = '#c79bff'; ctx.stroke();
    }
    ctx.restore();
  }

  // Cuerda rota: el carril queda rojo y cortado; abajo, cuántas pulsaciones faltan para repararla
  _cuerdaRota(ctx, G, B, perf) {
    const l = B.roto, top = G.topY, s1 = S_FAR, half = G.laneW * 0.42;
    const x0 = G.laneX(l, 1), x1 = G.laneX(l, s1);
    ctx.save();
    ctx.fillStyle = `rgba(255,50,50,${0.16 + 0.08 * Math.sin(perf / 120)})`;
    ctx.beginPath();
    ctx.moveTo(x1 - half * s1, top); ctx.lineTo(x1 + half * s1, top); ctx.lineTo(x0 + half, G.strikeY); ctx.lineTo(x0 - half, G.strikeY);
    ctx.closePath(); ctx.fill();
    // la cuerda cortada: zigzag rojo
    ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const k = i / 12, y = top + (G.strikeY - top) * k, x = x1 + (x0 - x1) * k + (i % 2 ? 1 : -1) * half * 0.35 * (s1 + (1 - s1) * k);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.font = '800 18px Rajdhani, "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = this.alto ? 0 : 5;
    ctx.fillText(`✂ ${B.reparo}/${REPARA_BT}`, x0, G.strikeY - 34);
    ctx.restore();
  }

  /* La vida (barra que sube y baja, en vez de la celda de Star Power), los poderes guardados, el aviso de lo
     que te lanzaron o ganaste, los ataques que tienes encima y el cartel del final */
  _hudBatalla(ctx, view, G, B, now, scale, x, y, w, h, horiz) {
    const perf = performance.now(), v = Math.max(0, Math.min(1, B.vida));
    const col = v > 0.5 ? '#3ee36b' : v > 0.25 ? '#ffb21e' : '#ff4d5e';
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = v < 0.25 ? 0.55 + 0.45 * Math.abs(Math.sin(perf / 110)) : 1;
    const gr = horiz ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y + h, 0, y);
    gr.addColorStop(0, '#ff4d5e'); gr.addColorStop(0.35, '#ffb21e'); gr.addColorStop(0.7, '#3ee36b'); gr.addColorStop(1, '#53e7ff');
    ctx.fillStyle = gr;
    if (horiz) ctx.fillRect(x, y, w * v, h); else ctx.fillRect(x, y + h * (1 - v), w, h * v);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = B.drenaje ? `rgba(255,58,106,${0.6 + 0.4 * Math.sin(perf / 80)})` : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = B.drenaje ? 3 : 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    for (const k of [0.25, 0.5, 0.75]) { ctx.beginPath(); if (horiz) { ctx.moveTo(x + w * k, y); ctx.lineTo(x + w * k, y + h); } else { ctx.moveTo(x, y + h * k); ctx.lineTo(x + w, y + h * k); } ctx.stroke(); }
    // etiqueta
    ctx.font = `800 ${Math.round(12 * scale)}px Rajdhani, "Segoe UI", sans-serif`; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (horiz) ctx.fillText('VIDA', x - 22 * scale, y + h / 2); else ctx.fillText('VIDA', x + w / 2, y + h + 12 * scale);
    // poderes guardados (el primero es el que sale con el botón de Star Power)
    const R = 15 * scale;
    for (let i = 0; i < MAX_PODERES_BT; i++) {
      const k = B.poderes[i], P = k && PODERES_BT[k];
      // al lado de la barra vertical; con la barra horizontal (autopistas angostas), en columna a la izquierda de
      // la autopista (a la derecha está el multiplicador); en el celular, en fila tras la barra
      const fila = horiz && G.celular, col = horiz && !G.celular;
      const px = fila ? x + w + 12 * scale + R + i * (2 * R + 6 * scale) : col ? G.cx - G.hw * 1.12 - R - 8 * scale : x + w / 2;
      const py = fila ? y + h / 2 : col ? G.strikeY - R - i * (2 * R + 6 * scale) : y - 12 * scale - R - i * (2 * R + 6 * scale);
      ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2);
      ctx.fillStyle = P ? 'rgba(20,10,40,0.85)' : 'rgba(0,0,0,0.35)'; ctx.fill();
      ctx.lineWidth = i === 0 && P ? 3 : 1.5; ctx.strokeStyle = P ? P.color : 'rgba(255,255,255,0.25)'; ctx.stroke();
      if (P) {
        ctx.font = `${Math.round(R * 1.1)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.fillStyle = '#fff'; ctx.fillText(P.ic, px, py + 1);
      }
    }
    // ataques que tienes encima: íconos arriba de la autopista
    const act = ['amp', 'cruce', 'dobles', 'apagon', 'drenaje'].filter((k) => B[k]).concat(B.roto >= 0 ? ['cuerda'] : []);
    act.forEach((k, i) => {
      const P = PODERES_BT[k], ax = G.cx + (i - (act.length - 1) / 2) * 34 * scale, ay = G.topY + 26 * scale;
      ctx.beginPath(); ctx.arc(ax, ay, 14 * scale, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
      // el anillo se vacía con el tiempo que le queda
      const q = B.quedan?.[k] ?? 1;
      ctx.beginPath(); ctx.arc(ax, ay, 14 * scale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q);
      ctx.lineWidth = 3; ctx.strokeStyle = P.color; ctx.stroke();
      ctx.font = `${Math.round(15 * scale)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(P.ic, ax, ay + 1);
    });
    // el aviso: lo que te lanzaron (con cómo zafar) o el poder que ganaste
    if (B.aviso) {
      const age = Math.max(0, now - B.aviso.t), a = Math.min(1, age * 6) * Math.min(1, (2.2 - age) * 2), sc = 1 + 0.25 * Math.max(0, 1 - age * 5);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `800 ${Math.round(30 * scale * sc)}px Rajdhani, "Segoe UI", sans-serif`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = B.aviso.color || '#fff';
      const ty = G.topY + view.h * 0.16;
      ctx.strokeText(B.aviso.text, G.cx, ty); ctx.fillText(B.aviso.text, G.cx, ty);
      if (B.aviso.sub) { ctx.font = `700 ${Math.round(16 * scale)}px Rajdhani, "Segoe UI", sans-serif`; ctx.lineWidth = 4; ctx.strokeText(B.aviso.sub, G.cx, ty + 28 * scale); ctx.fillStyle = '#fff'; ctx.fillText(B.aviso.sub, G.cx, ty + 28 * scale); }
      ctx.globalAlpha = 1;
    }
    // el final: K.O. o quién ganó
    if (B.gano !== null) {
      const t = B.ko ? '¡K.O.!' : B.gano ? '¡GANASTE!' : 'PERDISTE';
      const c = B.ko ? '#ff4d5e' : B.gano ? '#ffd34d' : '#9aa0b8';
      ctx.font = `900 ${Math.round(64 * scale)}px Rajdhani, "Segoe UI", sans-serif`;
      ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.fillStyle = c;
      const ty = (G.topY + G.strikeY) / 2;
      ctx.strokeText(t, G.cx, ty); ctx.fillText(t, G.cx, ty);
    }
    ctx.restore();
  }

  _spCell(ctx, e, now, fx, x, y, w, h, horizontal) {
    const perf = performance.now();
    const dt = Math.min(0.05, Math.max(0, (perf - (fx.spLast ?? perf)) / 1000));
    fx.spLast = perf;
    fx.spShown ??= e.sp;
    if (e.sp > fx.spShown + 0.01 && (!fx.surge || perf - fx.surge > 600)) fx.surge = perf;
    // el nivel visible se acerca al real: al ganar energía se ve cómo se carga
    fx.spShown += (e.sp - fx.spShown) * Math.min(1, dt * (e.sp > fx.spShown ? 3.5 : 10));
    const lvl = Math.max(0, Math.min(1, fx.spShown));
    const ready = e.sp >= 0.5 && !e.spActive;
    const active = e.spActive;

    ctx.save();
    // se dibuja un tubo vertical de ancho W y alto H en coordenadas locales
    let W = w, H = h;
    if (horizontal) {
      W = h;
      H = w;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-W / 2, -H / 2);
    } else ctx.translate(x, y);

    const capH = Math.min(W * 0.55, H * 0.08);
    const top = capH, bot = H - capH, bodyH = bot - top;
    const rad = W * 0.35;

    // halo exterior
    if (ready || active || lvl > 0.02) {
      const pulse = active ? 0.55 + 0.25 * Math.sin(perf / 60) : ready ? 0.4 + 0.25 * Math.sin(perf / 160) : 0.12 * lvl;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pulse;
      const gw = W * 3.2, gy = bot - bodyH * lvl;
      ctx.drawImage(glowSprite('rgba(83,231,255,1)'), W / 2 - gw / 2, gy - gw * 0.2, gw, bot - gy + gw * 0.4);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // cuerpo de vidrio (fondo)
    const body = new Path2D();
    body.roundRect(0, top - 2, W, bodyH + 4, rad);
    ctx.fillStyle = 'rgba(6,10,20,0.88)';
    ctx.fill(body);

    // energía líquida
    const fillH = bodyH * lvl;
    const steps = 10;
    const surfY = bot - fillH;
    const amp = Math.min(W * 0.09, fillH * 0.3) * (active ? 1.4 : 1);
    const waveY = (k) => surfY + Math.sin((k / steps) * Math.PI * 2 + perf / 260) * amp;
    if (fillH > 0.5) {
      ctx.save();
      ctx.clip(body);
      const liquid = new Path2D();
      liquid.moveTo(0, bot + 4);
      for (let k = 0; k <= steps; k++) liquid.lineTo((k / steps) * W, waveY(k));
      liquid.lineTo(W, bot + 4);
      liquid.closePath();
      const lg = ctx.createLinearGradient(0, bot, 0, surfY);
      lg.addColorStop(0, '#062a74');
      lg.addColorStop(0.55, active ? '#36c6ff' : '#1a86e0');
      lg.addColorStop(1, active ? '#e8feff' : ready ? '#aef4ff' : '#5fd8ff');
      ctx.fillStyle = lg;
      ctx.fill(liquid);
      ctx.clip(liquid);
      ctx.globalCompositeOperation = 'lighter';
      // franjas de energía que suben
      ctx.globalAlpha = active ? 0.3 : 0.16;
      ctx.fillStyle = '#9ff0ff';
      const band = W * 0.9, off = (perf / (active ? 4 : 9)) % (band * 2);
      for (let yy = bot + band * 2 - off; yy > surfY - band * 2; yy -= band * 2) {
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(W, yy - W * 0.8);
        ctx.lineTo(W, yy - W * 0.8 + band * 0.55);
        ctx.lineTo(0, yy + band * 0.55);
        ctx.fill();
      }
      // burbujas de energía
      ctx.fillStyle = '#ffffff';
      const n = horizontal ? 7 : 12;
      for (let k = 0; k < n; k++) {
        const seed = Math.sin(k * 91.7) * 43758.5453;
        const r1 = seed - Math.floor(seed);
        const speed = 0.25 + r1 * 0.5;
        const ph = ((perf / 1000) * speed + r1 * 7) % 1;
        const by = bot - ph * fillH;
        if (by < surfY + 2) continue;
        const bx = W * (0.2 + 0.6 * ((r1 * 13.3) % 1)) + Math.sin(perf / 300 + k) * W * 0.08;
        ctx.globalAlpha = 0.55 * (1 - ph) + 0.1;
        ctx.beginPath();
        ctx.arc(bx, by, W * (0.05 + 0.06 * ((r1 * 7.1) % 1)), 0, Math.PI * 2);
        ctx.fill();
      }
      // oleada al ganar energía: una banda brillante que sube hasta la superficie
      const sk = fx.surge ? (perf - fx.surge) / 550 : 2;
      if (sk < 1) {
        const sy = bot - fillH * sk;
        const sg = ctx.createLinearGradient(0, sy + W, 0, sy - W);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1 - sk * 0.6;
        ctx.fillStyle = sg;
        ctx.fillRect(0, sy - W, W, W * 2);
      }
      ctx.restore();
      // superficie brillante
      ctx.save();
      ctx.clip(body);
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      for (let k = 0; k <= steps; k++) {
        if (k) ctx.lineTo((k / steps) * W, waveY(k));
        else ctx.moveTo(0, waveY(0));
      }
      ctx.strokeStyle = 'rgba(220,255,255,0.95)';
      ctx.lineWidth = Math.max(1.5, W * 0.08);
      ctx.shadowColor = '#7ff3ff';
      ctx.shadowBlur = this.alto ? 0 : W * 0.6;
      ctx.stroke();
      ctx.restore();
    }

    // marcas cada 25 %; la del 50 % (desde ahí se puede activar) en dorado
    for (const q of [0.25, 0.5, 0.75]) {
      const qy = bot - bodyH * q;
      const gold = q === 0.5;
      ctx.fillStyle = gold ? (e.sp >= 0.5 ? '#ffe27a' : 'rgba(255,214,90,0.7)') : 'rgba(255,255,255,0.35)';
      const tw = gold ? W * 0.32 : W * 0.2;
      ctx.fillRect(0, qy - 1, tw, 2);
      ctx.fillRect(W - tw, qy - 1, tw, 2);
    }

    // reflejos del vidrio
    const gl = ctx.createLinearGradient(0, 0, W, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0.08)');
    gl.addColorStop(0.18, 'rgba(255,255,255,0.32)');
    gl.addColorStop(0.32, 'rgba(255,255,255,0.04)');
    gl.addColorStop(0.8, 'rgba(255,255,255,0)');
    gl.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = gl;
    ctx.fill(body);
    ctx.lineWidth = Math.max(1, W * 0.05);
    ctx.strokeStyle = 'rgba(190,230,255,0.45)';
    ctx.stroke(body);

    // tapas metálicas
    const capGrad = ctx.createLinearGradient(0, 0, W, 0);
    capGrad.addColorStop(0, '#3a3d46');
    capGrad.addColorStop(0.3, '#e9ecf2');
    capGrad.addColorStop(0.6, '#8b909b');
    capGrad.addColorStop(1, '#2c2e35');
    for (const cy of [0, bot]) {
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.roundRect(-W * 0.08, cy, W * 1.16, capH, W * 0.12);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-W * 0.08, cy + capH * 0.45, W * 1.16, Math.max(1, capH * 0.12));
    }
    // piloto de la tapa superior: se enciende cuando el Star Power está listo
    ctx.beginPath();
    ctx.arc(W / 2, capH / 2, capH * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#ffffff' : ready ? `rgba(120,240,255,${0.65 + 0.35 * Math.sin(perf / 120)})` : '#1b2533';
    ctx.shadowColor = '#53e7ff';
    ctx.shadowBlur = this.alto ? 0 : ready || active ? W * 0.8 : 0;
    ctx.fill();
    ctx.shadowBlur = 0;

    // rayos eléctricos alrededor cuando está lista o activa
    if (ready || active) {
      if (!fx.spArcs || perf - fx.spArcsT > 70) {
        fx.spArcsT = perf;
        fx.spArcs = [];
        const count = active ? 3 : Math.random() < 0.5 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const y0 = top + Math.random() * bodyH * 0.8, len = bodyH * (0.15 + Math.random() * 0.25);
          const pts = [];
          for (let s2 = 0; s2 <= 6; s2++) {
            const yy = y0 + (len * s2) / 6;
            const out = s2 === 0 || s2 === 6 ? 0 : W * (0.15 + Math.random() * 0.5);
            pts.push([side < 0 ? -out : W + out, yy]);
          }
          fx.spArcs.push(pts);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const pts of fx.spArcs) {
        for (const [lw2, col] of [[W * 0.22, 'rgba(83,231,255,0.35)'], [Math.max(1, W * 0.06), 'rgba(235,255,255,0.95)']]) {
          ctx.beginPath();
          pts.forEach(([px2, py2], k) => (k ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2)));
          ctx.lineWidth = lw2;
          ctx.strokeStyle = col;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  _hud(ctx, view, p, now, G, fx, mult) {
    const e = p.engine;
    const { cx, hw, strikeY, topY } = G;
    if (G.celular) return this._hudCelular(ctx, view, p, now, G, fx, mult);
    const right = cx + hw * 1.12;
    const compact = view.x + view.w - right < 120;
    const scale = Math.max(0.6, Math.min(1.3, view.h / 900));
    const multColor = e.spActive ? SP_COLOR : MULT_COLORS[Math.min(4, mult)] || '#fff';
    const font = (wgt, px) => `${wgt} ${Math.round(px * scale)}px Rajdhani, "Segoe UI", sans-serif`;

    let sx, sy, mx, my;
    if (compact) {
      sx = cx - hw * 0.15;
      sy = strikeY + view.h * 0.085;
      mx = cx + hw * 0.62;
      my = strikeY + view.h * 0.12;
    } else {
      sx = right + 18 * scale;
      sy = strikeY - 158 * scale;
      mx = right + 66 * scale;
      my = strikeY - 52 * scale;
    }

    ctx.textBaseline = 'alphabetic';
    ctx.font = font(700, 34);
    ctx.textAlign = compact ? 'center' : 'left';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = this.alto ? 0 : 6;
    ctx.fillText(Math.floor(e.score).toLocaleString('es'), sx, sy);
    ctx.shadowBlur = 0;

    this._multGauge(ctx, e, now, fx, mult, multColor, mx, my, (compact ? 34 : 50) * scale);

    if (e.combo > 0) {
      ctx.font = font(600, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = compact ? 'center' : 'left';
      ctx.fillText(`Racha ${e.combo}`, sx, compact ? sy + 24 * scale : sy + 26 * scale);
    }

    // Celda de energía del Star Power (en la batalla, la vida y los poderes)
    const B = p.batalla;
    if (compact) {
      const len = hw * 1.1;
      if (B) this._hudBatalla(ctx, view, G, B, now, scale, sx - len / 2, sy + 34 * scale, len, 16 * scale, true);
      else this._spCell(ctx, e, now, fx, sx - len / 2, sy + 34 * scale, len, 16 * scale, true);
    } else {
      const len = 220 * scale;
      if (B) this._hudBatalla(ctx, view, G, B, now, scale, cx - hw * 1.12 - 46 * scale, strikeY - len, 26 * scale, len, false);
      else this._spCell(ctx, e, now, fx, cx - hw * 1.12 - 46 * scale, strikeY - len, 26 * scale, len, false);
    }

    if (p.label) {
      ctx.font = font(700, 20);
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color || '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = this.alto ? 0 : 6;
      ctx.fillText(p.label, cx, topY - 8);
      ctx.shadowBlur = 0;
    }

    this._soloYPopups(ctx, view, p, now, G, scale, font);
  }

  // Celular: la autopista ocupa casi todo el ancho y abajo están los botones, así
  // que el marcador va en la esquina de arriba a la izquierda, donde la autopista
  // es angosta. A la derecha quedan los botones ★ y pausa (ui/tactil.js).
  _hudCelular(ctx, view, p, now, G, fx, mult) {
    const e = p.engine;
    const scale = Math.max(0.7, Math.min(1.1, view.h / 480));
    const multColor = e.spActive ? SP_COLOR : MULT_COLORS[Math.min(4, mult)] || '#fff';
    const font = (wgt, px) => `${wgt} ${Math.round(px * scale)}px Rajdhani, "Segoe UI", sans-serif`;
    const x = view.x + 16, y = view.y + 40 * scale;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = font(700, 34);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = this.alto ? 0 : 6;
    ctx.fillText(Math.floor(e.score).toLocaleString('es'), x, y);
    ctx.shadowBlur = 0;
    if (e.combo > 0) {
      ctx.font = font(600, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`Racha ${e.combo}`, x, y + 22 * scale);
    }
    const R = 30 * scale;
    this._multGauge(ctx, e, now, fx, mult, multColor, x + R + 6, y + 40 * scale + R, R);
    if (p.batalla) this._hudBatalla(ctx, view, G, p.batalla, now, scale, x, y + 52 * scale + 2 * R + 14 * scale, 120 * scale, 14 * scale, true);
    else this._spCell(ctx, e, now, fx, x, y + 52 * scale + 2 * R + 14 * scale, 120 * scale, 14 * scale, true);
    this._soloYPopups(ctx, view, p, now, G, scale, font);
  }

  // El cartel del solo y los mensajes emergentes, iguales en los dos marcadores
  _soloYPopups(ctx, view, p, now, G, scale, font) {
    const e = p.engine;
    const { cx, strikeY, topY } = G;
    const solo = e.currentSolo?.(now);
    if (solo && solo.total) {
      const pct = Math.round((solo.hits / solo.total) * 100);
      const y = topY + view.h * 0.12;
      const w = 150 * scale, h = 54 * scale;
      ctx.fillStyle = 'rgba(10,10,20,0.78)';
      ctx.fillRect(cx - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - w / 2, y - h / 2, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd34d';
      ctx.font = font(800, 24);
      ctx.fillText(`${pct}%`, cx, y + 2 * scale);
      ctx.font = font(600, 14);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${solo.hits}/${solo.total}`, cx, y + 20 * scale);
    }

    // Mensajes emergentes con rebote
    const popY = topY + (strikeY - topY) * 0.42;
    p.popups = (p.popups || []).filter((pp) => now - pp.t < 1.7 && now >= pp.t - 0.1);
    p.popups.forEach((pp, k) => {
      const age = now - pp.t;
      const a = age < 0.12 ? age / 0.12 : age > 1.3 ? 1 - (age - 1.3) / 0.4 : 1;
      const sc = age < 0.12 ? 0.4 + (age / 0.12) * 0.9 : age < 0.3 ? 1.3 - ((age - 0.12) / 0.18) * 0.3 : 1;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = font(800, (pp.big ? 40 : 30) * sc);
      ctx.textAlign = 'center';
      ctx.shadowColor = pp.color || '#fff';
      ctx.shadowBlur = this.alto ? 0 : 18;
      ctx.fillStyle = pp.color || '#fff';
      ctx.fillText(pp.text, cx, popY + k * 40 * scale - age * 10);
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = this.alto ? 0 : 4;
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = Math.max(0, a) * 0.35;
      ctx.fillText(pp.text, cx, popY + k * 40 * scale - age * 10);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
  }
}
