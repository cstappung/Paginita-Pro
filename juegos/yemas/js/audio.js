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
    else if (arma === 5) { ruido(0.09, 6000, 0.25 * v); tono(900, 300, 0.08, 0.06 * v, 'sawtooth'); }
    else if (arma === 6) { ruido(0.6, 900, 0.7 * v); tono(160, 60, 0.4, 0.25 * v, 'sawtooth'); }
    else if (arma === 7) { ruido(0.18, 3200, 0.6 * v); tono(260, 70, 0.12, 0.2 * v); }
    else { ruido(0.5, 3800, 0.7 * v); tono(420, 50, 0.25, 0.2 * v); }
  },
  recoge() { tono(500, 900, 0.08, 0.12, 'triangle'); tono(900, 1300, 0.08, 0.1, 'triangle', 0.07); },
  // La granada de humo: un soplido largo.
  humo(dist = 0) { const v = 1 / (1 + dist / 12); ruido(1.6, 1400, 0.45 * v); },
  // La cegadora: el estallido seco y, si te encandiló, el pitido en los oídos.
  destello(dist = 0, cegado = 0) {
    const v = 1 / (1 + dist / 14);
    ruido(0.25, 8000, 0.9 * v); tono(140, 60, 0.2, 0.3 * v, 'sine');
    if (cegado > 0.1) tono(3100, 3000, 1 + 2.5 * cegado, 0.09 * cegado, 'sine', 0.1);
  },
  golpe(cab) { tono(cab ? 1900 : 1300, cab ? 1900 : 1300, 0.05, 0.12, 'sine'); },
  baja() { tono(600, 1200, 0.12, 0.15, 'triangle'); tono(900, 1800, 0.14, 0.15, 'triangle', 0.1); },
  dolor() { tono(220, 110, 0.12, 0.2, 'sawtooth'); },
  crack(dist = 0) { const v = 1 / (1 + dist / 12); ruido(0.25, 5000, 0.8 * v); tono(300, 80, 0.3, 0.2 * v, 'triangle'); },
  recarga() { ruido(0.04, 4000, 0.3); ruido(0.05, 3000, 0.35, 0.45); },
  // La autodestrucción que se carga: un pitido que sube con cada paso.
  pitido(n = 0, dist = 0) { const v = 1 / (1 + dist / 12); tono(880 + n * 160, 880 + n * 160, 0.07, 0.12 * v, 'square'); },
  // El huevo que cae al piso se fríe: un chisporroteo corto.
  fritura(dist = 0) {
    const v = 1 / (1 + dist / 10);
    for (let k = 0; k < 16; k++) ruido(0.025 + Math.random() * 0.02, 7000, 0.07 * v, 0.15 + k * 0.08 + Math.random() * 0.05);
  },
  lanza() { tono(520, 260, 0.1, 0.1, 'triangle'); ruido(0.06, 2000, 0.15); },
  explosion(dist = 0) {
    const v = 1 / (1 + dist / 18);
    ruido(1.1, 700, 1.0 * v); ruido(0.35, 4500, 0.6 * v); tono(95, 28, 0.7, 0.55 * v, 'sine');
  },
  vacio() { tono(900, 900, 0.03, 0.08); },
};
