// La música adaptativa de BBTAN, sin tarjeta de sonido: la medida del
// peligro, lo que se toca en cada estado y el agendador con un AudioContext
// de mentira que cuenta cada start().
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const M = require('./musica.js');

function contexto() {
  const starts = [];
  class Param {
    constructor() { this.value = 0; }
    setValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t)); }
    linearRampToValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t)); }
    exponentialRampToValueAtTime(v, t) { assert.ok(v > 0 && Number.isFinite(t)); }
    setTargetAtTime(v, t, d) { assert.ok(Number.isFinite(v) && Number.isFinite(t) && d > 0); }
    cancelScheduledValues() {}
  }
  class Nodo {
    constructor() { for (const p of ['gain', 'frequency', 'detune', 'Q', 'playbackRate', 'delayTime']) this[p] = new Param(); }
    connect() {} disconnect() {} setPeriodicWave() {}
    start(t) { assert.ok(Number.isFinite(t)); starts.push(t); }
    stop(t) { assert.ok(Number.isFinite(t)); }
  }
  const ctx = {
    currentTime: 0, sampleRate: 8000, state: 'running', destination: new Nodo(),
    createGain: () => new Nodo(), createOscillator: () => new Nodo(), createBufferSource: () => new Nodo(),
    createBiquadFilter: () => new Nodo(), createWaveShaper: () => new Nodo(), createDelay: () => new Nodo(),
    createPeriodicWave: () => ({}),
    createBuffer(n, len) { const d = Array.from({ length: n }, () => new Float32Array(Math.floor(len))); return { getChannelData: i => d[i] }; }
  };
  return { ctx, starts };
}

test('bbtan: el peligro sube cuando los bloques bajan', () => {
  assert.equal(M.intensidad({ filas: 8, bloques: 0 }), 0);
  assert.equal(M.intensidad({}), 0);
  assert.equal(M.intensidad({ filas: 1, bloques: 3 }), 1);
  const lejos = M.intensidad({ filas: 6, bloques: 4 }), cerca = M.intensidad({ filas: 3, bloques: 4 });
  assert.ok(cerca > lejos, 'más cerca del suelo, más tenso');
  assert.ok(M.intensidad({ filas: 6, bloques: 30 }) > lejos, 'un tablero lleno también aprieta');
  assert.ok(M.intensidad({ filas: 6, bloques: 4, disparando: true }) > lejos);
  assert.equal(M.siguienteArmonia('calma', .69), 'calma');
  assert.equal(M.siguienteArmonia('calma', .7), 'filo');
  assert.equal(M.siguienteArmonia('filo', .55), 'filo', 'histéresis: no parpadea');
  assert.equal(M.siguienteArmonia('filo', .45), 'calma');
});

function compas(e) { const out = []; for (let k = 0; k < 128; k++) out.push(...M.eventos(e, k)); return out; }

test('bbtan: calma sin caja, tensión con semicorcheas y abismo grave', () => {
  const calma = compas({ I: 0 }), tensa = compas({ I: .95, filo: true });
  const abismo = compas({ I: .3, abismo: true });
  for (const e of [...calma, ...tensa, ...abismo]) {
    assert.ok(e.c === 'bat' ? typeof e.d === 'string' : Number.isFinite(e.n), JSON.stringify(e));
    assert.ok(Number.isFinite(e.vol) && e.vol > 0);
  }
  assert.ok(!calma.some(e => e.c === 'bat' && e.d === 's'), 'en calma no hay caja');
  assert.ok(!calma.some(e => e.c === 'alarma'));
  const hats = tensa.filter(e => e.c === 'bat' && (e.d === 'h' || e.d === 'o')).length;
  assert.ok(hats >= 128, 'tensa: platillo en cada semicorchea');
  assert.ok(tensa.some(e => e.c === 'alarma'));
  assert.ok(tensa.some(e => e.c === 'bat' && e.d === 't'), 'latido al borde de perder');
  const sub = abismo.filter(e => e.c === 'sub');
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  assert.ok(sub.length && sub.every(e => hz(e.n) < 60) && Math.min(...sub.map(e => hz(e.n))) < 40, 'el abismo baja de 40 Hz');
  const graveLuz = Math.min(...calma.filter(e => e.c !== 'bat').map(e => e.n));
  assert.ok(Math.min(...sub.map(e => e.n)) <= graveLuz - 6, 'más grave que la luz');
  assert.ok(abismo.some(e => e.c === 'bat' && e.d === 'K'));
});

test('bbtan: el motor agenda, se calma, baja al abismo y calla', () => {
  const { ctx, starts } = contexto();
  const m = new M.Motor(ctx, ctx.createGain());
  m.animo({ filas: 8, bloques: 2, ronda: 1 }); m.reinicia();
  const avanza = (n, dt = .05) => { for (let i = 0; i < n; i++) { ctx.currentTime += dt; m.tick(.2); } };
  avanza(200);
  assert.ok(starts.length > 50, 'suena');
  const lento = m.bpm();
  m.animo({ filas: 1, bloques: 20, ronda: 50 }); avanza(200);
  assert.ok(m.bpm() > lento, 'con peligro acelera');
  m.animo({ filas: 7, bloques: 3, ronda: 120 }); avanza(200);
  assert.equal(m.abismo, true, 'desde la ronda 100 baja al abismo');
  m.detener(); const n = starts.length;
  ctx.currentTime += 30; m.tick(.2);
  assert.ok(starts.length - n < 40, 'tras una pausa larga no hay ráfaga');
  assert.ok(starts.every(Number.isFinite));
});

test('bbtan: audio.js y game.js cargan con la música nueva', () => {
  for (const f of ['audio.js', 'game.js', 'musica.js']) new vm.Script(fs.readFileSync(path.join(__dirname, f), 'utf8'), { filename: f });
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(html.indexOf('chip.js') < html.indexOf('musica.js') && html.indexOf('musica.js') < html.indexOf('audio.js'));
});
