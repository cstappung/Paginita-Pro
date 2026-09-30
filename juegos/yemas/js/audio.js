// Sonidos sintetizados con WebAudio, sin archivos.
let ctx = null, buf = null, master = null;

function a() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function ruido(dur, freq, vol, retraso = 0) {
  if (vol < 0.005) return;
  const c = a(), t = c.currentTime + retraso;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur);
}

function tono(f0, f1, dur, vol, tipo = 'square', retraso = 0) {
  if (vol < 0.005) return;
  const c = a(), t = c.currentTime + retraso;
  const o = c.createOscillator(); o.type = tipo;
  const g = c.createGain();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur);
}

export const sonido = {
  iniciar() { a(); },
  disparo(arma, dist = 0) {
    const v = 1 / (1 + dist / 12);
    if (arma === 0) { ruido(0.12, 2600, 0.5 * v); tono(180, 60, 0.08, 0.15 * v); }
    else if (arma === 1) { ruido(0.32, 1300, 0.85 * v); tono(120, 40, 0.16, 0.3 * v); }
    else { ruido(0.5, 3800, 0.7 * v); tono(420, 50, 0.25, 0.2 * v); }
  },
  golpe(cab) { tono(cab ? 1900 : 1300, cab ? 1900 : 1300, 0.05, 0.12, 'sine'); },
  baja() { tono(600, 1200, 0.12, 0.15, 'triangle'); tono(900, 1800, 0.14, 0.15, 'triangle', 0.1); },
  dolor() { tono(220, 110, 0.12, 0.2, 'sawtooth'); },
  crack(dist = 0) { const v = 1 / (1 + dist / 12); ruido(0.25, 5000, 0.8 * v); tono(300, 80, 0.3, 0.2 * v, 'triangle'); },
  recarga() { ruido(0.04, 4000, 0.3); ruido(0.05, 3000, 0.35, 0.45); },
  lanza() { tono(520, 260, 0.1, 0.1, 'triangle'); ruido(0.06, 2000, 0.15); },
  explosion(dist = 0) {
    const v = 1 / (1 + dist / 18);
    ruido(1.1, 700, 1.0 * v); ruido(0.35, 4500, 0.6 * v); tono(95, 28, 0.7, 0.55 * v, 'sine');
  },
  vacio() { tono(900, 900, 0.03, 0.08); },
};
