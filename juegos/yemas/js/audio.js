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
    else if (arma === 10) { tono(1400, 300, 0.22, 0.2 * v, 'sawtooth'); tono(2200, 700, 0.18, 0.08 * v, 'sine'); }
    else if (arma === 11) { ruido(0.14, 2000, 0.6 * v); tono(140, 50, 0.1, 0.2 * v); }
    else if (arma === 12) { ruido(0.2, 3000, 0.65 * v); tono(320, 70, 0.14, 0.22 * v); }
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
  desliza(dist = 0) { const v = 1 / (1 + dist / 12); ruido(0.55, 700, 0.4 * v); ruido(0.3, 2400, 0.12 * v, 0.05); },
  lanza() { tono(520, 260, 0.1, 0.1, 'triangle'); ruido(0.06, 2000, 0.15); },
  explosion(dist = 0) {
    const v = 1 / (1 + dist / 18);
    ruido(1.1, 700, 1.0 * v); ruido(0.35, 4500, 0.6 * v); tono(95, 28, 0.7, 0.55 * v, 'sine');
  },
  vacio() { tono(900, 900, 0.03, 0.08); },
  // El sartenazo que da: un «clang» metálico con su eco.
  sarten(dist = 0) {
    const v = 1 / (1 + dist / 12);
    tono(620, 600, 0.35, 0.16 * v, 'triangle'); tono(1490, 1460, 0.25, 0.08 * v, 'sine'); ruido(0.05, 5000, 0.25 * v);
  },
  // La espátula dorada: un silbido al lanzarla y una campanita en cada golpe.
  espatula() { tono(700, 1700, 0.35, 0.1, 'sine'); ruido(0.3, 3000, 0.12); },
  espatulazo(dist = 0) { const v = 1 / (1 + dist / 14); tono(2100, 2050, 0.4, 0.12 * v, 'sine'); tono(3150, 3100, 0.3, 0.06 * v, 'sine', 0.02); },
  // Zombis: el gruñido de cada uno, el mordisco y la campana de cada ronda.
  grunido(dist = 0) {
    const v = 1 / (1 + dist / 8);
    const f = 70 + Math.random() * 40;
    tono(f * 1.4, f, 0.7 + Math.random() * 0.4, 0.16 * v, 'sawtooth'); ruido(0.5, 500, 0.12 * v);
  },
  mordida() { ruido(0.12, 1800, 0.5); tono(160, 70, 0.15, 0.25, 'sawtooth'); },
  ronda() { for (const [f, t] of [[196, 0], [147, 0.45], [196, 0.9]]) { tono(f, f * 0.98, 1.6, 0.22, 'triangle', t); tono(f * 2.01, f * 2, 1.2, 0.06, 'sine', t); } },
  // Lo que se compra en zombis.
  caja() { for (let k = 0; k < 10; k++) tono(500 + (k % 4) * 180, 500 + (k % 4) * 180, 0.12, 0.07, 'triangle', k * 0.22); },
  osito() { tono(300, 120, 0.9, 0.18, 'sawtooth'); ruido(0.6, 600, 0.2, 0.2); },
  bebida() { ruido(0.15, 5000, 0.3); tono(300, 900, 0.3, 0.1, 'sine', 0.15); tono(500, 300, 0.2, 0.1, 'triangle', 0.5); },
  tabla() { ruido(0.08, 1800, 0.45); tono(220, 180, 0.08, 0.12, 'square'); },
  rompe(dist = 0) { const v = 1 / (1 + dist / 10); ruido(0.18, 1200, 0.6 * v); tono(140, 70, 0.12, 0.2 * v, 'sawtooth'); },
  luz() { tono(60, 60, 1.6, 0.25, 'sawtooth'); ruido(0.4, 3000, 0.4); tono(120, 480, 1.2, 0.08, 'sine', 0.3); },
  pap() { for (const [f, t] of [[220, 0], [277, 0.3], [330, 0.6], [440, 0.9]]) tono(f, f, 0.5, 0.12, 'square', t); ruido(1.4, 900, 0.3, 0.2); },
  teleport() { tono(200, 1600, 1.2, 0.15, 'sine'); ruido(1.2, 6000, 0.25); },
  puerta() { ruido(0.5, 900, 0.5); tono(110, 60, 0.4, 0.2, 'sawtooth'); },
  // Lo de los zombis especiales: el rayo del perro, el grito del chillón, el
  // rugido del Mutante y el casco que salta.
  trueno(dist = 0) { const v = 1 / (1 + dist / 18); ruido(0.08, 8000, 0.7 * v); ruido(1.1, 500, 0.5 * v, 0.05); tono(70, 40, 0.9, 0.25 * v, 'sawtooth', 0.05); },
  chillido(dist = 0) { const v = 1 / (1 + dist / 14); tono(1400, 2300, 0.5, 0.18 * v, 'sawtooth'); tono(1900, 1500, 0.7, 0.12 * v, 'square', 0.1); ruido(0.7, 5000, 0.25 * v); },
  ruge(dist = 0) { const v = 1 / (1 + dist / 20); tono(90, 55, 1.3, 0.35 * v, 'sawtooth'); tono(140, 70, 1.1, 0.2 * v, 'square', 0.08); ruido(1.1, 700, 0.4 * v); },
  casco(dist = 0) { const v = 1 / (1 + dist / 12); tono(2400, 2300, 0.25, 0.15 * v, 'triangle'); tono(3600, 3500, 0.2, 0.08 * v, 'sine', 0.02); },
  quema(dist = 0) { const v = 1 / (1 + dist / 12); ruido(0.4, 1500, 0.35 * v); },
  bono() { for (const [f, t] of [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]]) tono(f, f, 0.25, 0.1, 'square', t); ruido(0.5, 6000, 0.12, 0.3); },
  compra() { tono(800, 1200, 0.07, 0.12, 'square'); tono(1200, 1600, 0.1, 0.1, 'square', 0.08); },
};
