// Efectos de sonido sintetizados con Web Audio (sin archivos). Suenan bajito y se pueden silenciar (tecla M).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U;
  const X = (PK.Sfx = { on: U.store.get('pk_sound') !== '0' });
  let ctx = null, master = null;
  const last = {};

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // el navegador solo permite sonido después de que el jugador toca la página
  window.addEventListener('pointerdown', () => ac());
  window.addEventListener('keydown', () => ac());

  function tone(f, at, dur, type, vol, f2) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(at, dur, vol, freq) {
    const t = ctx.currentTime + at, n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 2000; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t);
  }
  const GAP = { deposit: 0.15, arrow: 0.12, hit: 0.1, chop: 0.09, pick: 0.09, hammer: 0.08, dig: 0.12, reap: 0.12 };

  X.play = function (name) {
    if (!X.on || !ctx || ctx.state !== 'running' || (PK.Game && PK.Game.offline)) return;
    const now = performance.now() / 1000;
    if (last[name] && now - last[name] < (GAP[name] || 0.05)) return;
    last[name] = now;
    switch (name) {
      case 'deposit': tone(520, 0, 0.06, 'triangle', 0.035, 780); break;
      case 'coin': tone(988, 0, 0.08, 'square', 0.04); tone(1319, 0.07, 0.16, 'square', 0.04); break;
      case 'build': [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.14, 'square', 0.045)); break;
      case 'level': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.06, 0.18, 'square', 0.045)); noise(0.3, 0.3, 0.05, 6000); break;
      case 'era': [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.4, 'sawtooth', 0.04)); tone(1047, 0.7, 0.8, 'triangle', 0.05); break;
      case 'quest': tone(880, 0, 0.25, 'triangle', 0.05); tone(1175, 0.12, 0.35, 'triangle', 0.05); break;
      case 'event': tone(659, 0, 0.15, 'square', 0.045); tone(988, 0.15, 0.3, 'square', 0.045); break;
      case 'arrow': noise(0, 0.07, 0.06, 3500); break;
      case 'hit': tone(180, 0, 0.08, 'square', 0.05, 90); break;
      case 'chop': noise(0, 0.06, 0.05, 900); tone(150, 0, 0.06, 'triangle', 0.04, 90); break;
      case 'pick': tone(1250, 0, 0.04, 'square', 0.022, 900); noise(0, 0.05, 0.04, 4200); break;
      case 'hammer': tone(420, 0, 0.05, 'square', 0.028, 260); noise(0, 0.03, 0.03, 1800); break;
      case 'dig': noise(0, 0.09, 0.045, 500); break;
      case 'reap': noise(0, 0.08, 0.03, 5200); break;
      case 'howl': tone(300, 0, 0.5, 'sine', 0.06, 620); tone(620, 0.5, 0.9, 'sine', 0.06, 380); break;
    }
  };
  X.toggle = function () {
    X.on = !X.on;
    U.store.set('pk_sound', X.on ? '1' : '0');
    if (X.on) { ac(); X.play('coin'); }
    return X.on;
  };
})();
