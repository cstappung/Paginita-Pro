/* Circuit Breakers: la música y los efectos, sin tarjeta de sonido.
   Carga chip.js, temas.js y el audio del juego en un contexto vm con un
   AudioContext de mentira que cuenta cada `start()`. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");

const RAIZ = path.join(__dirname, "../../juegos");

function carga() {
  const agendados = [];
  const vivos = new Set();
  class Param {
    constructor() { this.value = 0; }
    setValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t)); }
    linearRampToValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t)); }
    exponentialRampToValueAtTime(v, t) { assert.ok(v > 0 && Number.isFinite(t)); }
    setTargetAtTime(v, t, d) { assert.ok(Number.isFinite(v) && d > 0); }
  }
  class Nodo {
    constructor() { this.gain = new Param(); this.frequency = new Param(); this.playbackRate = new Param(); this.delayTime = new Param(); }
    connect() {} disconnect() { vivos.delete(this); }
    start(t) { assert.ok(Number.isFinite(t)); agendados.push(t); vivos.add(this); }
    stop(t) { assert.ok(Number.isFinite(t)); }
  }
  class AudioContext {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = "suspended"; this.destination = new Nodo(); }
    async resume() { this.state = "running"; }
    createGain() { return new Nodo(); }
    createOscillator() { return new Nodo(); }
    createBufferSource() { return new Nodo(); }
    createDelay() { return new Nodo(); }
    createBuffer(n, largo) { const d = Array.from({ length: n }, () => new Float32Array(Math.floor(largo))); return { getChannelData: i => d[i] }; }
  }
  const sb = { CB: {}, AudioContext, Math, Float32Array, WeakMap, Set, Object, Array };
  sb.globalThis = sb;
  vm.createContext(sb);
  for (const f of ["audio/chip.js", "audio/temas.js", "worms/audio.js"]) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), "utf8"), sb, { filename: f });
  return { sb, agendados, vivos };
}

function avanza(s, veces, dt = .05) { for (let i = 0; i < veces; i++) { s.ctx.currentTime += dt; s.tick(); } }

test("worms: la música agenda, calla y vuelve sin ráfaga", async () => {
  const { sb, agendados } = carga();
  const s = new sb.CB.Soundtrack();
  assert.ok(await s.unlock());
  avanza(s, 100);
  assert.ok(agendados.length > 20, "el menú suena");

  s.enabled = false; s.tick();
  const n = agendados.length;
  avanza(s, 20);
  assert.equal(agendados.length, n, "sin música no se agenda nada");

  s.enabled = true; s.setPause(true);
  s.ctx.currentTime += 20; s.tick();
  assert.equal(agendados.length, n, "en pausa tampoco");
  s.setPause(false); s.tick();
  assert.ok(agendados.length > n, "al volver suena");
  assert.ok(agendados.length < n + 15, "sin ráfaga de notas atrasadas: " + (agendados.length - n));
});

test("worms: cambiar a combate corta el menú y usa la otra canción", async () => {
  const { sb } = carga();
  const s = new sb.CB.Soundtrack();
  await s.unlock();
  avanza(s, 30);
  const menu = s.rep;
  assert.ok(menu.voces.size > 0);
  s.mode = "combat"; s.tick();
  assert.notEqual(s.rep, menu);
  assert.equal(menu.voces.size, 0, "las notas del menú ya agendadas se callan");
  assert.equal(s.rep.cancion, sb.Temas.temas["worms-combate"]);
  avanza(s, 60);
  assert.ok(s.rep.voces.size > 0);
});

test("worms: efectos independientes y volumen acotado", async () => {
  const { sb, agendados } = carga();
  const s = new sb.CB.Soundtrack();
  await s.unlock();
  s.effects = false;
  const n = agendados.length;
  s.effect("explosion");
  assert.equal(agendados.length, n);
  s.effects = true;
  for (const e of ["explosion", "shot", "lightning", "turn", "heal", "pickup", "victory", "jump", "splash", "bounce", "select"]) {
    const antes = agendados.length;
    s.effect(e, 3);
    assert.ok(agendados.length > antes, e + " suena");
  }
  s.setVolume(0); assert.equal(s.volume, 0);
  s.setVolume(10); assert.equal(s.volume, .7);
});
