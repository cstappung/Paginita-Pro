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
  assert.equal(m.abismo, true, 'desde la ronda 50 baja al abismo');
  m.detener(); const n = starts.length;
  ctx.currentTime += 30; m.tick(.2);
  assert.ok(starts.length - n < 40, 'tras una pausa larga no hay ráfaga');
  assert.ok(starts.every(Number.isFinite));
});

test('bbtan: audio.js y game.js cargan con la música nueva', () => {
  for (const f of ['audio.js', 'game.js', 'musica.js', 'descenso.js', 'character.js']) new vm.Script(fs.readFileSync(path.join(__dirname, f), 'utf8'), { filename: f });
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(html.indexOf('descenso.js') < html.indexOf('musica.js'), 'el descenso antes que la música');
  assert.ok(html.indexOf('chip.js') < html.indexOf('musica.js') && html.indexOf('musica.js') < html.indexOf('audio.js'));
});

const DSC = require('./descenso.js');

test('bbtan: el descenso funde de a veinte rondas por piso', () => {
  assert.equal(DSC.corrupcion(1), 0);
  assert.equal(DSC.corrupcion(49), 0);
  assert.ok(DSC.corrupcion(50) > 0 && DSC.corrupcion(50) < .1, 'la 50 apenas empieza');
  assert.ok(Math.abs(DSC.corrupcion(79) - .5) < .05, 'a mitad del primer fundido');
  assert.equal(DSC.corrupcion(109), 1);
  assert.equal(DSC.corrupcion(229), 3);
  assert.ok(DSC.corrupcion(300) < 5, 'aún no está roto del todo');
  assert.equal(DSC.corrupcion(349), 5);
  assert.equal(DSC.corrupcion(9999), 5);
  for (let r = 1, a = 0; r < 600; r++) { const c = DSC.corrupcion(r); assert.ok(c >= a); a = c; }
  for (const c of [0, .3, 1, 1.5, 2.7, 4, 5]) {
    const p = DSC.mezcla(c);
    for (const k of ['lime', 'purple', 'orange', 'cyan', 'bg', 'bola', 'velo']) assert.match(p[k], /^#[0-9a-f]{6}([0-9a-f]{2})?$/, k);
    for (const k in p.css) assert.match(p.css[k], /^#[0-9a-f]{6}([0-9a-f]{2})?$/, k);
  }
  assert.deepEqual([0, .4, .6, 2.5, 5].map(DSC.etapa), [0, 0, 1, 3, 5]);
  for (const k of ['entrada', 'animo', 'combo', 'recall', 'fin', 'pausa']) assert.equal(DSC.TEXTOS[k].length, 6, k);
  for (const k in DSC.TEXTOS.estado) assert.equal(DSC.TEXTOS.estado[k].length, 6, k);
  assert.equal(DSC.corrompe('HOLA', 0, 3), 'HOLA');
  assert.equal(DSC.corrompe('PANTALLA', 1, 7), DSC.corrompe('PANTALLA', 1, 7), 'la misma semilla, el mismo texto');
});

test('bbtan: la música se rompe piso a piso', () => {
  const por = {};
  for (const D of [0, .5, 1, 1.5, 2, 3, 4, 4.7, 5]) {
    const ev = compas({ I: .3, D });
    for (const e of ev) {
      assert.ok(e.c === 'bat' ? typeof e.d === 'string' : Number.isFinite(e.n), JSON.stringify(e));
      assert.ok(Number.isFinite(e.vol) && e.vol > 0);
    }
    por[D] = ev;
  }
  assert.ok(!por[0].some(e => e.c === 'bat' && e.d === 'r'), 'la luz no cruje');
  assert.ok(por[3].some(e => e.c === 'bat' && e.d === 'r'), 'la estática cruje');
  const latidos = D => por[D].filter(e => e.c === 'bat' && e.d === 't').length;
  assert.ok(latidos(4) >= latidos(1) + 12, 'lo hostil late sin parar aunque no haya peligro');
  assert.ok(por[5].length < por[1].length, 'el vacío se va quedando sin notas');
  assert.ok(por[5].some(e => e.cae), 'en el vacío las notas se caen');
  const grave = D => Math.min(...por[D].filter(e => e.c === 'sub' || e.c === 'bajo').map(e => e.n));
  assert.ok(grave(1) < grave(0) && grave(5) <= grave(1), 'cada piso es más grave');
});

test('bbtan: el motor baja piso a piso y cada vez más lento', () => {
  const { ctx, starts } = contexto();
  const m = new M.Motor(ctx, ctx.createGain());
  m.animo({ filas: 7, bloques: 3, ronda: 1 }); m.reinicia();
  const avanza = (n, dt = .05) => { for (let i = 0; i < n; i++) { ctx.currentTime += dt; m.tick(.2); } };
  avanza(100);
  const bpms = [m.bpm()];
  for (const ronda of [110, 250, 349]) { m.animo({ filas: 7, bloques: 3, ronda }); avanza(600); bpms.push(m.bpm()); }
  assert.ok(Math.abs(m.D - 5) < .1, 'llega al vacío');
  assert.equal(m.piso, 5);
  for (let i = 1; i < bpms.length; i++) assert.ok(bpms[i] < bpms[i - 1] + 3, `más lento: ${bpms}`);
  assert.ok(bpms[3] < bpms[0] - 10, `el vacío es mucho más lento: ${bpms}`);
  m.animo({ filas: 7, bloques: 3, ronda: 349 }); m.reinicia();
  assert.equal(m.D, 5, 'reiniciar no rehace la caída');
  assert.ok(starts.every(Number.isFinite));
});

test('bbtan: pasada la 350 el descenso se deshace y entra el cielo', () => {
  assert.equal(DSC.perfeccion(349), 0);
  assert.equal(DSC.corrupcionVista(349), 5);
  assert.ok(DSC.corrupcionVista(357) < 5 && DSC.corrupcionVista(357) > 0, 'se deshace de a poco');
  assert.equal(DSC.corrupcionVista(364), 0);
  assert.equal(DSC.perfeccion(369), 1);
  assert.equal(DSC.perfeccion(449), 2);
  assert.equal(DSC.perfeccion(499), 3);
  assert.equal(DSC.perfeccion(9999), 3);
  for (let r = 1, a = 0; r < 700; r++) { const p = DSC.perfeccion(r); assert.ok(p >= a); a = p; }
  for (const r of [300, 352, 360, 380, 420, 470, 520]) {
    const pal = DSC.mezclaCielo(DSC.mezcla(DSC.corrupcionVista(r)), DSC.perfeccion(r));
    for (const k of ['lime', 'purple', 'orange', 'cyan', 'bg', 'bola']) assert.match(pal[k], /^#[0-9a-f]{6}([0-9a-f]{2})?$/, `${r} ${k}`);
    for (const k in pal.css) assert.match(pal.css[k], /^#[0-9a-f]{6}([0-9a-f]{2})?$/, `${r} css ${k}`);
    assert.equal(new Set([pal.lime, pal.purple, pal.orange, pal.cyan]).size, 4, 'los bloques se siguen distinguiendo');
  }
  assert.deepEqual([0, .4, .6, 1.4, 2.6, 3].map(DSC.etapaCielo), [0, 0, 1, 1, 3, 3]);
  for (const k of ['animo', 'combo', 'recall', 'fin', 'pausa']) assert.equal(DSC.TEXTOS_CIELO[k].length, 4, k);
  for (const k in DSC.TEXTOS.estado) assert.equal(DSC.TEXTOS_CIELO.estado[k].length, 4, k);
});

test('bbtan: el cielo suena en mayor, no se tensa y sube sin parar', () => {
  const cielo = compas({ I: .2, D: 0, C: 3 });
  assert.ok(cielo.some(e => e.c === 'lead') && cielo.some(e => e.c === 'brillo'), 'melodía y campanitas');
  assert.equal(cielo.filter(e => e.c === 'bat' && e.d === 'k').length, 32, 'bombo en negras, ocho compases');
  assert.ok(!cielo.some(e => e.c === 'sub' || e.c === 'grave' || e.cae), 'nada del abismo');
  const campanas = I => compas({ I, D: 0, C: 3 }).filter(e => e.c === 'brillo').length;
  assert.ok(campanas(1) > campanas(0) + 10, 'con peligro, más contenta');
  const alto = v => Math.min(...M.eventos({ I: .2, D: 0, C: 3, vuelta: v }, 0).filter(e => e.c === 'bajo').map(e => e.n));
  assert.equal(alto(1), alto(0) + 1, 'cada vuelta sube un semitono');
  const antes = M.eventos({ I: .2, D: 0, C: 1, vuelta: 1 }, 0).filter(e => e.c === 'bajo').map(e => e.n);
  assert.deepEqual(antes, M.eventos({ I: .2, D: 0, C: 1, vuelta: 0 }, 0).filter(e => e.c === 'bajo').map(e => e.n), 'antes de la 450 no sube');
  for (const e of cielo) assert.ok(Number.isFinite(e.vol) && e.vol > 0 && (e.c === 'bat' || Number.isFinite(e.n)));
});

test('bbtan: el motor sube al cielo y se acelera', () => {
  const { ctx, starts } = contexto();
  const m = new M.Motor(ctx, ctx.createGain());
  m.animo({ filas: 7, bloques: 3, ronda: 349 }); m.reinicia();
  const avanza = (n, dt = .05) => { for (let i = 0; i < n; i++) { ctx.currentTime += dt; m.tick(.2); } };
  avanza(100); const abajo = m.bpm();
  m.animo({ filas: 7, bloques: 3, ronda: 500 }); avanza(800);
  assert.ok(Math.abs(m.C - 3) < .1 && m.D < .1, 'arriba del todo');
  assert.ok(m.bpm() > abajo + 30, `mucho más rápido: ${abajo} → ${m.bpm()}`);
  m.animo({ filas: 1, bloques: 20, ronda: 500 }); avanza(400);
  assert.ok(m.bpm() > 140, 'con peligro, aún más rápido');
  assert.ok(starts.every(Number.isFinite));
});
