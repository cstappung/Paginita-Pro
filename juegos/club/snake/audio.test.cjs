// El sonido de Snake Club con el chip de la sala, sin tarjeta de sonido.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');

function game(speed = 'normal') {
  const noop = () => {}, starts = [], live = new Set();
  const param = () => ({ value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop, setTargetAtTime: noop });
  const source = () => { const n = { frequency: param(), playbackRate: param(), connect: noop, disconnect() { live.delete(n); }, start(t) { starts.push(t); live.add(n); }, stop(t) { if (t === 0) live.delete(n); } }; return n; };
  class AudioContext {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createGain() { return { gain: param(), connect: noop, disconnect: noop }; }
    createOscillator() { return source(); }
    createBufferSource() { return source(); }
    createBuffer(n, len) { const d = Array.from({ length: n }, () => new Float32Array(len)); return { getChannelData: i => d[i] }; }
  }
  const elements = new Map();
  const ctx2d = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: noop }) : noop, set: () => true });
  const element = () => ({ textContent: '', innerHTML: '', style: { setProperty: noop }, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, addEventListener: noop, focus: noop, getBoundingClientRect: () => ({ width: 784, height: 616 }), getContext: () => ctx2d });
  const storage = new Map([['snake-club-v1', JSON.stringify({ sound: true, speed })]]);
  const sb = {
    document: { getElementById: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, querySelectorAll: () => [], documentElement: element(), addEventListener: noop },
    addEventListener: noop, Club: { storageKey: k => k, category: noop, result: noop }, AudioContext,
    matchMedia: () => ({ matches: true }), localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    ResizeObserver: class { observe() {} }, requestAnimationFrame: noop, devicePixelRatio: 1, setTimeout: noop, clearTimeout: noop,
    Math, Float32Array, WeakMap, Set, Object, Array
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  for (const f of ['audio/chip.js', 'audio/temas.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../..', f), 'utf8'), sb, { filename: f });
  const src = fs.readFileSync(__dirname + '/game.js', 'utf8').replace(/\}\)\(\);\s*$/, `
    globalThis.engine = { start, pause, finish, tickMusic, sfx, get audio() { return audio; }, set eaten(v) { eaten = v; }, get state() { return state; } };
  })();`);
  vm.runInContext(src, sb);
  const g = sb.engine;
  g.advance = (times, dt = .05) => { for (let i = 0; i < times; i++) { g.audio.ctx.currentTime += dt; g.tickMusic(); } };
  return Object.assign(g, { starts, live, sb });
}

test('la música de snake suena solo jugando y se calla en pausa y al perder', () => {
  const g = game(); g.start();
  assert.ok(g.audio, 'con el sonido guardado, empezar crea el audio');
  assert.equal(g.audio.rep.cancion, g.sb.Temas.temas.snake);
  g.advance(60); assert.ok(g.audio.rep.voces.size > 0, 'el tema suena');
  g.pause(); g.tickMusic(); assert.equal(g.audio.rep.voces.size, 0, 'la pausa calla lo agendado');
  const n = g.starts.length; g.advance(20); assert.equal(g.starts.length, n);
  g.pause(); g.advance(4); assert.ok(g.audio.rep.voces.size > 0, 'reanudar vuelve a sonar');
  g.finish(); assert.equal(g.audio.rep.voces.size, 0, 'al perder se corta el tema');
});
test('el tempo sigue la velocidad elegida y el avance', () => {
  const lento = game('chill'); lento.start(); lento.advance(1); assert.equal(lento.audio.rep.tempo, .9);
  const rapido = game('fast'); rapido.start(); rapido.advance(1); assert.equal(rapido.audio.rep.tempo, 1.12);
  rapido.eaten = 100; rapido.advance(1); assert.ok(Math.abs(rapido.audio.rep.tempo - 1.18) < 1e-9, 'el avance acelera como mucho un 6 %');
  assert.equal(rapido.audio.rep.capas.arp, 1);
});
test('todos los efectos suenan', () => {
  const g = game(); g.start();
  for (const k of ['start', 'eat', 'bonus', 'power', 'shield', 'portal', 'record', 'die', 'on']) {
    const n = g.starts.length; g.sfx(k, 3); assert.ok(g.starts.length > n, k + ' suena');
  }
});
