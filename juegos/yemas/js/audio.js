// Sonidos sintetizados con WebAudio, sin archivos.
//
// Cada sonido arma su propio «bus»: ganancia por distancia, un pasabajos que
// le quita brillo a lo lejano (el aire se come los agudos), el paneo según
// dónde suena respecto de la cámara y un envío a la reverberación común. Todo
// termina en un compresor, así una explosión encima de veinte gruñidos no
// satura. Donde se pide `l` va una distancia (número) o una posición
// ({x, y, z}); con la posición, `oido()` (la cámara, cada cuadro) decide de
// qué lado suena.
//
// Las voces de los zombis son sintetizadas como una voz de verdad: una sierra
// con temblor y carraspera (la «voz rota»), saturada y pasada por tres
// formantes que se mueven de una vocal a otra («uuuaaargh»). Es lo que les da
// el gemido de Call of Duty en vez del zumbido de antes.
let ctx = null, ruidoBuf = null, cafeBuf = null, master = null, eco = null;
const oidoPos = { x: 0, y: 0, z: 0, yaw: 0 };
let voces = 0;
const VOCES_MAX = 7;
const mecanica = new Set();   // lo que suena de una recarga, para cortarla

function a() {
  if (!ctx) {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(comp);
    const rev = ctx.createConvolver();
    rev.buffer = impulso(2.2, 2.8);
    eco = ctx.createGain();
    eco.gain.value = 0.9;
    eco.connect(rev).connect(master);
    const n = ctx.sampleRate * 2;
    ruidoBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    cafeBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0), c = cafeBuf.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < n; i++) {
      d[i] = Math.random() * 2 - 1;
      ult = (ult + 0.02 * d[i]) / 1.02;   // ruido café: el retumbe de un trueno
      c[i] = ult * 3.5;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// La respuesta de una sala: ruido estéreo que se apaga, con un poco de
// pre-retardo. Sirve igual para un sótano de Nacht que para la arena.
function impulso(dur, caida) {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      d[i] = i < ctx.sampleRate * 0.012 ? 0 : (Math.random() * 2 - 1) * Math.pow(1 - t, caida) * (0.6 + 0.4 * Math.sin(i * 0.0007 + ch));
    }
  }
  return b;
}

// Distancia y paneo de lo que suena.
function lugar(x) {
  if (x == null) return { d: 0, pan: 0 };
  if (typeof x === 'number') return { d: Math.max(0, x), pan: 0 };
  const dx = x.x - oidoPos.x, dz = x.z - oidoPos.z, dy = (x.y ?? oidoPos.y) - oidoPos.y;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.5) return { d, pan: 0 };
  // La derecha de la cámara con yaw: (cos, 0, -sin).
  const pan = (dx * Math.cos(oidoPos.yaw) - dz * Math.sin(oidoPos.yaw)) / Math.hypot(dx, dz || 1e-6);
  return { d, pan: Math.max(-1, Math.min(1, pan * 0.75)) };
}

// El bus de un sonido. `k` es a qué distancia suena a la mitad.
function bus(l, k = 12, vol = 1, rev = 0.18, t = 0) {
  const c = a();
  const g = c.createGain();
  g.gain.value = vol / (1 + l.d / k);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = Math.max(700, 19000 / (1 + l.d / 9));
  g.connect(f);
  let fin = f;
  if (l.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = l.pan; f.connect(p); fin = p; }
  fin.connect(master);
  const s = c.createGain();
  s.gain.value = Math.min(0.9, rev + l.d / 70);
  fin.connect(s).connect(eco);
  // Que el recolector se lo lleve cuando termina: nada lo referencia después.
  return { g, t: c.currentTime + t };
}

function ruido(b, ret, dur, o = {}) {
  const c = ctx, t = b.t + ret;
  const vol = o.vol ?? 0.5;
  if (vol < 0.003) return null;
  const src = c.createBufferSource();
  src.buffer = o.cafe ? cafeBuf : ruidoBuf;
  src.playbackRate.value = o.vel ?? 1;
  const f = c.createBiquadFilter();
  f.type = o.tipo || 'lowpass';
  f.frequency.setValueAtTime(o.f ?? 2000, t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
  f.Q.value = o.q ?? 0.7;
  const g = c.createGain();
  const at = o.ataque ?? 0.002;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + at);
  g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(at + 0.005, dur));
  src.connect(f).connect(g).connect(b.g);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
  return src;
}

function tono(b, ret, f0, f1, dur, vol, tipo = 'sine', ataque = 0.002) {
  if (vol < 0.003) return null;
  const c = ctx, t = b.t + ret;
  const o = c.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(ataque + 0.005, dur));
  o.connect(g).connect(b.g);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

// Una campana o un metal: parciales inarmónicos que se apagan a destiempo.
function campana(b, ret, f, dur, vol, parciales = [1, 2.32, 4.25, 6.63]) {
  parciales.forEach((p, i) => tono(b, ret, f * p, f * p * 0.998, dur / (1 + i * 0.7), vol / (1 + i * 0.9), 'sine', 0.001));
}

// Lo que un cuerpo choca: un clic seco con su golpe grave (las piezas de una recarga).
function clic(b, ret, f = 3200, vol = 0.45, grave = 0) {
  const n = ruido(b, ret, 0.035, { tipo: 'bandpass', f, q: 4, vol });
  if (n) mecanica.add(n);
  if (grave) { const o = tono(b, ret, grave, grave * 0.7, 0.05, vol * 0.5, 'triangle'); if (o) mecanica.add(o); }
}
function roce(b, ret, dur, f = 1400, vol = 0.25) {
  const n = ruido(b, ret, dur, { tipo: 'bandpass', f, f1: f * 1.4, q: 1.5, vol, ataque: dur * 0.3 });
  if (n) mecanica.add(n);
}

// ---------- La voz ----------
const VOCAL = { a: [730, 1090, 2440], o: [570, 840, 2410], u: [300, 870, 2240], e: [530, 1840, 2480], i: [390, 2000, 2550], r: [620, 1150, 2500] };
const curvas = new Map();
function saturacion(k) {
  k = Math.round(k);
  if (!curvas.has(k)) {
    const n = 1024, cu = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; cu[i] = Math.tanh(k * x) / Math.tanh(k); }
    curvas.set(k, cu);
  }
  return curvas.get(k);
}
// o: { f: [puntos de la altura en Hz], dur, de, a (vocales), aspera 0–1,
//      aire 0–1, sat, grave (una octava abajo), vol, ret, tracto (×formantes) }
function voz(b, o) {
  const c = ctx, t = b.t + (o.ret || 0), d = o.dur;
  const fs = Float32Array.from(o.f.map(v => Math.max(20, v * (0.97 + Math.random() * 0.06))));
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueCurveAtTime(fs, t, d);
  // El temblor de la voz.
  const lfo = c.createOscillator(), lfoG = c.createGain();
  lfo.frequency.value = 6 + Math.random() * 9;
  lfoG.gain.value = fs[0] * (0.025 + (o.aspera || 0) * 0.05);
  lfo.connect(lfoG).connect(osc.frequency);
  // La carraspera: la voz se corta y vuelve decenas de veces por segundo.
  const am = c.createGain();
  am.gain.value = 1 - (o.aspera || 0) * 0.55;
  const fry = c.createOscillator(), fryG = c.createGain();
  fry.type = 'square';
  fry.frequency.value = 28 + Math.random() * 30;
  fryG.gain.value = (o.aspera || 0) * 0.55;
  fry.connect(fryG).connect(am.gain);
  osc.connect(am);
  const fuentes = [osc, lfo, fry];
  if (o.grave) {
    const sub = c.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.setValueCurveAtTime(fs.map(v => v / 2), t, d);
    const sg = c.createGain(); sg.gain.value = o.grave;
    sub.connect(sg).connect(am);
    fuentes.push(sub);
  }
  if (o.aire) {
    const n = c.createBufferSource(); n.buffer = ruidoBuf;
    const ng = c.createGain(); ng.gain.value = o.aire;
    n.connect(ng).connect(am);
    fuentes.push(n);
  }
  const sat = c.createWaveShaper();
  sat.curve = saturacion(1 + (o.sat ?? 3));
  am.connect(sat);
  // Los formantes: tres pasabandas que van de una vocal a la otra.
  const env = c.createGain();
  const tr = o.tracto || 0.86;
  const de = VOCAL[o.de || 'u'], hasta = VOCAL[o.a || 'a'];
  [1, 0.55, 0.22].forEach((gan, i) => {
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 5 + i * 3;
    f.frequency.setValueAtTime(de[i] * tr, t);
    f.frequency.linearRampToValueAtTime(hasta[i] * tr, t + d * (o.giro ?? 0.55));
    const g = c.createGain(); g.gain.value = gan * 3;
    sat.connect(f).connect(g).connect(env);
  });
  const vol = o.vol ?? 0.3;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.12, d * 0.2));
  env.gain.setValueAtTime(vol, t + d * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0005, t + d);
  env.connect(b.g);
  for (const s of fuentes) { s.start(t); s.stop(t + d + 0.05); }
  voces++;
  osc.onended = () => { voces--; };
}

const azar = (a0, a1) => a0 + Math.random() * (a1 - a0);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// El gemido de siempre: grave, largo, «uuuaaaarrgh» que sube y cae.
function gemido(b, ret = 0, f0 = azar(68, 95)) {
  const dur = azar(1.1, 1.9);
  voz(b, { ret, dur, f: [f0 * 0.9, f0 * 1.15, f0 * 1.05, f0 * 0.8, f0 * 0.65], de: pick(['u', 'o']), a: pick(['a', 'r', 'o']), aspera: azar(0.45, 0.8), aire: 0.25, sat: 4, grave: 0.35, vol: 0.32 });
}
// El de ataque: corto, áspero y más agudo, «¡AAGH!».
function rugido(b, ret = 0, f0 = azar(120, 160), vol = 0.34) {
  voz(b, { ret, dur: azar(0.35, 0.6), f: [f0, f0 * 1.25, f0 * 1.1, f0 * 0.8], de: 'r', a: 'a', aspera: 0.9, aire: 0.4, sat: 9, grave: 0.25, vol, giro: 0.3 });
}
// El corredor: el alarido agudo y desgarrado de los que vienen corriendo.
function alarido(b, ret = 0) {
  const f0 = azar(230, 320);
  voz(b, { ret, dur: azar(0.6, 0.9), f: [f0 * 0.8, f0 * 1.3, f0 * 1.2, f0 * 0.9, f0 * 0.6], de: 'e', a: 'a', aspera: 0.75, aire: 0.5, sat: 12, vol: 0.3, tracto: 0.95, giro: 0.35 });
}
// La gallina infernal: «bok bok bok… ¡bagAAWK!», con una octava de abajo
// para que suene a algo que salió del infierno y no del gallinero.
function cacareo(b, ret = 0, vol = 0.32) {
  const n = 2 + Math.floor(Math.random() * 3);
  let t = ret;
  for (let i = 0; i < n; i++) {
    const f0 = azar(380, 470);
    voz(b, { ret: t, dur: 0.075, f: [f0 * 1.15, f0, f0 * 0.75], de: 'o', a: 'u', aspera: 0.3, aire: 0.3, sat: 5, grave: 0.5, vol: vol * 0.8, tracto: 1.25, giro: 0.6 });
    t += azar(0.11, 0.17);
  }
  const f0 = azar(520, 640);
  voz(b, { ret: t + 0.05, dur: azar(0.32, 0.45), f: [f0 * 0.8, f0 * 1.25, f0 * 1.3, f0 * 1.1, f0 * 0.7], de: 'e', a: 'a', aspera: 0.6, aire: 0.45, sat: 10, grave: 0.6, vol, tracto: 1.3, giro: 0.25 });
}

// ---------- Los disparos ----------
// [clic, cuerpo: f, q, dur, vol; golpe: f0, f1, dur, vol; cola: f, dur, vol]
const TIRO = {
  0: [0.5, [1900, 1.2, 0.09, 0.55], [170, 55, 0.08, 0.38], [950, 0.3, 0.16]],
  1: [0.7, [1500, 0.7, 0.28, 0.9], [115, 32, 0.24, 0.7], [620, 0.9, 0.32]],
  2: [1.0, [2600, 1, 0.13, 0.8], [95, 28, 0.38, 0.65], [520, 1.5, 0.36]],
  7: [0.65, [2300, 1.3, 0.1, 0.6], [210, 60, 0.1, 0.32], [820, 0.45, 0.2]],
  11: [0.55, [1350, 1, 0.1, 0.6], [125, 40, 0.1, 0.45], [700, 0.4, 0.2]],
  12: [0.8, [2100, 1.1, 0.14, 0.7], [140, 38, 0.2, 0.48], [700, 0.7, 0.26]],
  13: [0.45, [1500, 1, 0.06, 0.5], [130, 45, 0.06, 0.35], [800, 0.25, 0.12]],
};
// Lo mecánico que viene después del tiro: la bomba de la escopeta y el
// cerrojo del francotirador.
function bomba(b, ret, vol = 1) { roce(b, ret, 0.07, 1500, 0.3 * vol); clic(b, ret + 0.08, 2600, 0.45 * vol, 380); roce(b, ret + 0.16, 0.06, 1900, 0.25 * vol); clic(b, ret + 0.23, 3200, 0.5 * vol, 520); }
function cerrojo(b, ret, vol = 1) { clic(b, ret, 4200, 0.35 * vol); roce(b, ret + 0.05, 0.1, 2200, 0.25 * vol); clic(b, ret + 0.22, 3000, 0.45 * vol, 600); clic(b, ret + 0.32, 5000, 0.3 * vol); }

export const sonido = {
  iniciar() { a(); },
  // La cámara: desde dónde se oye y hacia dónde mira.
  oido(p, yaw) { oidoPos.x = p.x; oidoPos.y = p.y; oidoPos.z = p.z; oidoPos.yaw = yaw; },
  disparo(arma, lx = 0) {
    const l = lugar(lx), b = bus(l, 16, 1, 0.22);
    const k = azar(0.95, 1.05);
    if (arma === 5) {
      // La sartén cortando el aire.
      ruido(b, 0, 0.22, { tipo: 'bandpass', f: 500, f1: 2600, q: 1.2, vol: 0.32, ataque: 0.08 });
      return;
    }
    if (arma === 6) {
      // La Benedictina: el golpe del tubo, el silbido del cohete que sale.
      tono(b, 0, 85, 38, 0.45, 0.6);
      ruido(b, 0, 0.12, { f: 2500, vol: 0.7 });
      ruido(b, 0.03, 0.9, { tipo: 'bandpass', f: 3200, f1: 900, q: 0.9, vol: 0.4, ataque: 0.05 });
      ruido(b, 0, 1.2, { f: 500, vol: 0.3, ataque: 0.04 });
      return;
    }
    if (arma === 10) {
      // El Rayo batido: el «piuu» de pistola de rayos de los cincuenta.
      tono(b, 0, 2300 * k, 240, 0.28, 0.22, 'sine');
      tono(b, 0, 3400 * k, 500, 0.22, 0.07, 'square');
      tono(b, 0.01, 1150 * k, 180, 0.3, 0.12, 'triangle');
      ruido(b, 0, 0.18, { tipo: 'highpass', f: 5000, vol: 0.15 });
      return;
    }
    const [cl, cu, go, co] = TIRO[arma] || TIRO[12];
    ruido(b, 0, 0.018, { tipo: 'highpass', f: 6000, vol: cl });
    ruido(b, 0, cu[2], { tipo: 'bandpass', f: cu[0] * k, q: cu[1], vol: cu[3] });
    ruido(b, 0, cu[2] * 0.6, { f: 9000, vol: cu[3] * 0.4 });
    tono(b, 0, go[0] * k, go[1], go[2], go[3]);
    ruido(b, 0.01, co[1], { f: co[0], vol: co[2], ataque: 0.012 });
    if (arma === 0) tono(b, 0, 950 * k, 760, 0.06, 0.03, 'square');   // el motorcito de la batidora
    if (arma === 1) bomba(b, 0.38, 0.8 / (1 + l.d / 6));
    if (arma === 2) cerrojo(b, 0.5, 0.8 / (1 + l.d / 6));
  },
  // La recarga, pieza por pieza, repartida en lo que dura (dur en segundos).
  recarga(arma = 7, dur = 1.8) {
    const b = bus(lugar(0), 12, 1, 0.08);
    mecanica.clear();
    if (arma === 1) {
      for (let i = 0; i < 4; i++) { clic(b, dur * (0.16 + i * 0.15), 2400, 0.4, 300); roce(b, dur * (0.16 + i * 0.15) + 0.04, 0.05, 1200, 0.15); }
      bomba(b, dur * 0.8);
    } else if (arma === 6) {
      clic(b, dur * 0.2, 1800, 0.45, 260);
      roce(b, dur * 0.42, 0.35, 900, 0.35);
      clic(b, dur * 0.8, 2800, 0.5, 400);
    } else if (arma === 10) {
      clic(b, dur * 0.15, 3800, 0.4);
      roce(b, dur * 0.25, 0.12, 1600, 0.25);
      clic(b, dur * 0.55, 2600, 0.45, 500);
      const o = tono(b, dur * 0.6, 200, 1600, dur * 0.3, 0.1, 'sine', dur * 0.25);
      if (o) mecanica.add(o);
      const p = tono(b, dur * 0.92, 2400, 2400, 0.2, 0.08, 'sine');
      if (p) mecanica.add(p);
    } else {
      clic(b, dur * 0.12, 4200, 0.4);
      roce(b, dur * 0.2, 0.12, 1300, 0.25);
      clic(b, dur * 0.55, 1600, 0.55, 220);
      clic(b, dur * 0.58, 4400, 0.35);
      if (arma === 2) cerrojo(b, dur * 0.75);
      else { roce(b, dur * 0.76, 0.06, 2000, 0.3); clic(b, dur * 0.84, 2900, 0.55, 520); }
    }
  },
  // Cambió de arma a mitad de la recarga: lo que faltaba no suena.
  cortaRecarga() {
    if (!ctx) return;
    for (const s of mecanica) { try { s.stop(); } catch {} }
    mecanica.clear();
  },
  recoge() { const b = bus(lugar(0), 12, 1, 0.1); clic(b, 0, 3000, 0.4, 300); tono(b, 0.04, 600, 900, 0.09, 0.1, 'triangle'); tono(b, 0.11, 900, 1350, 0.1, 0.08, 'triangle'); },
  sacar() { const b = bus(lugar(0), 12, 1, 0.06); roce(b, 0, 0.12, 1800, 0.18); clic(b, 0.12, 3600, 0.3, 450); },
  // Pasos y caídas del que juega.
  paso(corre = false) {
    const b = bus(lugar(0), 12, 1, 0.05);
    ruido(b, 0, 0.07, { f: azar(380, 520), vol: corre ? 0.22 : 0.15 });
    ruido(b, 0, 0.03, { tipo: 'bandpass', f: azar(1800, 2600), q: 2, vol: corre ? 0.06 : 0.04 });
  },
  aterriza(fuerza = 1) { const b = bus(lugar(0), 12, 1, 0.08); ruido(b, 0, 0.12, { f: 420, vol: 0.25 * fuerza }); tono(b, 0, 110, 55, 0.12, 0.2 * fuerza); },
  // La granada de humo: un soplido largo.
  humo(lx = 0) { const b = bus(lugar(lx), 12, 1, 0.3); clic(b, 0, 2500, 0.4); ruido(b, 0.02, 1.8, { tipo: 'bandpass', f: 2200, f1: 700, q: 0.6, vol: 0.45, ataque: 0.1 }); },
  // La cegadora: el estallido seco y, si te encandiló, el pitido en los oídos.
  destello(lx = 0, cegado = 0) {
    const l = lugar(lx), b = bus(l, 14, 1, 0.4);
    ruido(b, 0, 0.3, { f: 9000, vol: 0.9 }); tono(b, 0, 150, 50, 0.25, 0.4);
    if (cegado > 0.1) { const c = bus(lugar(0), 1e9, 1, 0); tono(c, 0.1, 3300, 3200, 1 + 2.5 * cegado, 0.08 * cegado, 'sine', 0.05); }
  },
  // El marcador de impacto: un «tic» seco, y en la cabeza, una campanita.
  golpe(cab) {
    const b = bus(lugar(0), 12, 1, 0.02);
    ruido(b, 0, 0.025, { tipo: 'highpass', f: 5000, vol: 0.28 });
    tono(b, 0, 1700, 1600, 0.04, 0.1, 'triangle');
    if (cab) campana(b, 0.005, 2500, 0.3, 0.09, [1, 1.5, 2.76]);
  },
  baja() { const b = bus(lugar(0), 12, 1, 0.15); tono(b, 0, 880, 880, 0.14, 0.12, 'triangle'); tono(b, 0.09, 1320, 1320, 0.2, 0.12, 'triangle'); campana(b, 0.09, 1760, 0.4, 0.05, [1, 2]); },
  dolor() { const b = bus(lugar(0), 12, 1, 0.05); tono(b, 0, 150, 70, 0.18, 0.35); ruido(b, 0, 0.12, { f: 700, vol: 0.3 }); },
  // Una cáscara que se quiebra: un racimo de chasquidos y el crujido de abajo.
  crack(lx = 0) {
    const b = bus(lugar(lx), 12, 1, 0.2);
    for (let i = 0; i < 6; i++) ruido(b, i * 0.014 + Math.random() * 0.01, 0.02, { tipo: 'highpass', f: azar(2500, 5000), vol: azar(0.3, 0.6) });
    ruido(b, 0, 0.18, { tipo: 'bandpass', f: 900, q: 1, vol: 0.4 });
    tono(b, 0, 260, 90, 0.2, 0.15, 'triangle');
  },
  // La autodestrucción que se carga: un pitido que sube con cada paso.
  pitido(n = 0, lx = 0) { const b = bus(lugar(lx), 12, 1, 0.1); tono(b, 0, 880 + n * 160, 880 + n * 160, 0.07, 0.13, 'square'); },
  // El huevo que cae al piso se fríe: un chisporroteo corto.
  fritura(lx = 0) {
    const b = bus(lugar(lx), 10, 1, 0.1);
    for (let k = 0; k < 18; k++) ruido(b, 0.15 + k * 0.07 + Math.random() * 0.05, 0.02 + Math.random() * 0.02, { tipo: 'bandpass', f: azar(4000, 8000), q: 2, vol: 0.12 });
    ruido(b, 0.1, 1.4, { tipo: 'highpass', f: 3000, vol: 0.05, ataque: 0.2 });
  },
  desliza(lx = 0) { const b = bus(lugar(lx), 12, 1, 0.1); ruido(b, 0, 0.6, { tipo: 'bandpass', f: 800, q: 0.8, vol: 0.4, ataque: 0.03 }); ruido(b, 0.05, 0.35, { tipo: 'bandpass', f: 2600, q: 1.5, vol: 0.12 }); },
  lanza() { const b = bus(lugar(0), 12, 1, 0.1); clic(b, 0, 5000, 0.25); ruido(b, 0.03, 0.22, { tipo: 'bandpass', f: 400, f1: 1600, q: 1.2, vol: 0.3, ataque: 0.06 }); },
  explosion(lx = 0) {
    const l = lugar(lx), b = bus(l, 22, 1, 0.45);
    tono(b, 0, 70, 24, 1.3, 0.85);
    ruido(b, 0, 1.8, { cafe: true, f: 900, vol: 1.0, ataque: 0.006 });
    ruido(b, 0, 0.3, { tipo: 'highpass', f: 1800, vol: 0.55 });
    ruido(b, 0, 0.6, { f: 3500, vol: 0.5 });
    for (let i = 0; i < 9; i++) ruido(b, azar(0.25, 1.2), 0.03, { tipo: 'bandpass', f: azar(1500, 4500), q: 3, vol: azar(0.05, 0.14) });
  },
  vacio() { const b = bus(lugar(0), 12, 1, 0.03); clic(b, 0, 3200, 0.4); tono(b, 0, 1300, 1200, 0.015, 0.06, 'square'); },
  // El sartenazo que da: un «clang» metálico con su eco.
  sarten(lx = 0) {
    const b = bus(lugar(lx), 12, 1, 0.3);
    ruido(b, 0, 0.04, { tipo: 'highpass', f: 3000, vol: 0.4 });
    campana(b, 0, 410, 0.9, 0.22);
    tono(b, 0, 140, 70, 0.12, 0.25);
  },
  // La espátula dorada: un silbido al lanzarla y una campanita en cada golpe.
  espatula() { const b = bus(lugar(0), 12, 1, 0.3); tono(b, 0, 700, 1700, 0.35, 0.1); ruido(b, 0, 0.3, { tipo: 'bandpass', f: 3000, q: 2, vol: 0.12 }); campana(b, 0.3, 1800, 0.6, 0.06, [1, 2.7, 5.4]); },
  espatulazo(lx = 0) { const b = bus(lugar(lx), 14, 1, 0.35); campana(b, 0, 2050, 0.6, 0.13, [1, 1.5, 2.76, 5.4]); },

  // ---------- Zombis ----------
  // El gemido de cada uno, a su manera: el corredor aúlla, la gallina
  // cacarea, el grandote y el Mutante gruñen una octava abajo.
  grunido(lx = 0, tipo = 'n') {
    if (voces >= VOCES_MAX) return;
    const b = bus(lugar(lx), 9, 1, 0.3);
    if (tipo === 'p') cacareo(b);
    else if (tipo === 'c') alarido(b);
    else if (tipo === 'g' || tipo === 'j' || tipo === 'f') gemido(b, 0, azar(48, 62));
    else if (tipo === 't') voz(b, { dur: 1.2, f: [90, 80, 70, 60], de: 'u', a: 'o', aspera: 0.9, aire: 0.7, sat: 6, vol: 0.28 });   // gorgoteo
    else gemido(b);
  },
  // Se le viene encima a alguien: el gruñido corto del ataque.
  ataque(lx = 0, tipo = 'n') {
    if (voces >= VOCES_MAX + 2) return;
    const b = bus(lugar(lx), 8, 1, 0.2);
    if (tipo === 'p') cacareo(b, 0, 0.36);
    else rugido(b, 0, tipo === 'g' || tipo === 'j' ? azar(70, 90) : azar(120, 165));
  },
  // El mordisco que te dan: crujido, gruñido encima y el golpe.
  mordida() {
    const b = bus(lugar(0), 12, 1, 0.15);
    for (let i = 0; i < 3; i++) ruido(b, i * 0.035, 0.05, { tipo: 'bandpass', f: azar(1200, 2200), q: 2, vol: 0.45 });
    tono(b, 0, 130, 60, 0.18, 0.4);
    rugido(b, 0, azar(110, 140), 0.25);
  },
  // Un zombi que muere: el gorgoteo que se apaga (la gallina, un último graznido y plumas).
  muereZombi(lx = 0, tipo = 'n') {
    if (voces >= VOCES_MAX + 2) return;
    const b = bus(lugar(lx), 10, 1, 0.25);
    if (tipo === 'p') {
      const f0 = azar(600, 700);
      voz(b, { dur: 0.35, f: [f0, f0 * 1.2, f0 * 0.6, f0 * 0.4], de: 'a', a: 'u', aspera: 0.7, aire: 0.5, sat: 10, grave: 0.5, vol: 0.3, tracto: 1.3 });
      ruido(b, 0.05, 0.5, { tipo: 'bandpass', f: 2500, q: 0.8, vol: 0.15, ataque: 0.05 });
      return;
    }
    const f0 = tipo === 'g' || tipo === 'j' ? azar(55, 70) : azar(85, 110);
    voz(b, { dur: azar(0.6, 0.9), f: [f0 * 1.2, f0, f0 * 0.7, f0 * 0.45], de: 'a', a: 'u', aspera: 0.95, aire: 0.6, sat: 6, grave: 0.4, vol: 0.3, giro: 0.8 });
  },
  // El cambio de ronda: un acorde grave que crece, tres campanadas en menor y
  // un coro de gargantas que se apaga en la reverberación.
  ronda() {
    const b = bus(lugar(0), 1e9, 1, 0.55);
    for (const [f, det] of [[73.4, 0], [73.4, 1.2], [110, -0.8]]) {
      const o = tono(b, 0, f + det, f + det, 4.2, 0.12, 'sawtooth', 1.2);
      o && o.frequency.linearRampToValueAtTime(f * 0.94, b.t + 4.2);
    }
    for (const [f, t] of [[293.7, 0.2], [220, 0.85], [233.1, 1.5], [196, 2.2]]) campana(b, t, f, 3, 0.16, [1, 2.01, 3.0, 4.17]);
    voz(b, { ret: 0.6, dur: 3.2, f: [110, 112, 108, 98], de: 'o', a: 'a', aspera: 0.15, aire: 0.35, sat: 1, vol: 0.12, tracto: 1, giro: 0.7 });
    voz(b, { ret: 0.6, dur: 3.2, f: [146.8, 149, 144, 131], de: 'o', a: 'a', aspera: 0.15, aire: 0.35, sat: 1, vol: 0.09, tracto: 1.05, giro: 0.7 });
  },
  // Lo que se compra en zombis.
  caja() { const b = bus(lugar(0), 12, 1, 0.35); const notas = [659, 784, 988, 784, 880, 1047, 988, 784, 659, 587]; notas.forEach((f, k) => campana(b, k * 0.22, f, 0.5, 0.07, [1, 3.01, 5.2])); },
  osito() { const b = bus(lugar(0), 12, 1, 0.3); for (let i = 0; i < 4; i++) voz(b, { ret: i * 0.16, dur: 0.14, f: [140, 120], de: 'a', a: 'o', aspera: 0.4, sat: 4, grave: 0.5, vol: 0.22 }); ruido(b, 0.2, 0.6, { f: 600, vol: 0.2 }); },
  // La bebida: destapa, glu glu y el eructo de rigor.
  bebida() {
    const b = bus(lugar(0), 12, 1, 0.2);
    ruido(b, 0, 0.12, { tipo: 'highpass', f: 4000, vol: 0.3 });
    for (let i = 0; i < 4; i++) tono(b, 0.3 + i * 0.17, 260, 520, 0.09, 0.09, 'sine', 0.02);
    voz(b, { ret: 1.15, dur: 0.45, f: [95, 85, 78, 70], de: 'o', a: 'u', aspera: 0.85, aire: 0.3, sat: 5, grave: 0.4, vol: 0.2 });
  },
  tabla() { const b = bus(lugar(0), 12, 1, 0.2); ruido(b, 0, 0.09, { tipo: 'bandpass', f: 1600, q: 1, vol: 0.5 }); tono(b, 0, 210, 160, 0.1, 0.18, 'triangle'); clic(b, 0.1, 2400, 0.3); },
  rompe(lx = 0) { const b = bus(lugar(lx), 10, 1, 0.25); ruido(b, 0, 0.2, { tipo: 'bandpass', f: 1100, q: 0.8, vol: 0.6 }); tono(b, 0, 150, 70, 0.14, 0.25, 'triangle'); for (let i = 0; i < 4; i++) ruido(b, 0.05 + i * 0.03, 0.03, { tipo: 'bandpass', f: azar(1800, 3200), q: 3, vol: 0.2 }); },
  luz() { const b = bus(lugar(0), 12, 1, 0.5); tono(b, 0, 60, 60, 1.6, 0.25, 'sawtooth', 0.2); ruido(b, 0, 0.4, { f: 3000, vol: 0.4 }); tono(b, 0.3, 120, 480, 1.2, 0.08); clic(b, 0, 1800, 0.6, 200); },
  pap() { const b = bus(lugar(0), 12, 1, 0.45); for (const [f, t] of [[220, 0], [277, 0.3], [330, 0.6], [440, 0.9]]) { tono(b, t, f, f, 0.5, 0.1, 'square'); campana(b, t, f * 2, 0.6, 0.05); } ruido(b, 0.2, 1.4, { f: 900, vol: 0.3 }); },
  teleport() { const b = bus(lugar(0), 12, 1, 0.5); tono(b, 0, 200, 1600, 1.2, 0.15); ruido(b, 0, 1.2, { tipo: 'bandpass', f: 1000, f1: 7000, q: 1, vol: 0.25, ataque: 0.4 }); },
  puerta() { const b = bus(lugar(0), 12, 1, 0.35); ruido(b, 0, 0.5, { cafe: true, f: 900, vol: 0.6 }); tono(b, 0, 110, 60, 0.4, 0.2, 'sawtooth'); clic(b, 0.35, 1400, 0.4, 150); },
  // Lo de los zombis especiales: el rayo de la gallina, el grito del chillón,
  // el rugido del Mutante y el casco que salta.
  trueno(lx = 0) {
    const l = lugar(lx), b = bus(l, 20, 1, 0.5);
    ruido(b, 0, 0.09, { tipo: 'highpass', f: 2500, vol: 0.8 });
    ruido(b, 0.04, 1.8, { cafe: true, f: 500, vol: 0.8, ataque: 0.05 });
    tono(b, 0.05, 65, 35, 1.1, 0.3, 'sawtooth');
    if (voces < VOCES_MAX) cacareo(b, 0.35, 0.34);
  },
  chillido(lx = 0) {
    const b = bus(lugar(lx), 14, 1, 0.4);
    const f0 = azar(650, 820);
    voz(b, { dur: 0.9, f: [f0 * 0.7, f0 * 1.3, f0 * 1.4, f0 * 1.2, f0 * 0.8], de: 'e', a: 'i', aspera: 0.6, aire: 0.6, sat: 14, vol: 0.32, tracto: 1.1, giro: 0.4 });
    ruido(b, 0, 0.8, { tipo: 'highpass', f: 4500, vol: 0.12, ataque: 0.1 });
  },
  ruge(lx = 0) {
    const b = bus(lugar(lx), 22, 1, 0.45);
    voz(b, { dur: 1.5, f: [55, 70, 66, 52, 40], de: 'o', a: 'a', aspera: 1, aire: 0.5, sat: 12, grave: 0.8, vol: 0.45, tracto: 0.75, giro: 0.4 });
    tono(b, 0, 45, 30, 1.4, 0.35);
    ruido(b, 0, 1.2, { cafe: true, f: 600, vol: 0.4, ataque: 0.1 });
  },
  casco(lx = 0) { const b = bus(lugar(lx), 12, 1, 0.3); campana(b, 0, 1150, 0.4, 0.15); ruido(b, 0, 0.03, { tipo: 'highpass', f: 4000, vol: 0.3 }); },
  quema(lx = 0) { const b = bus(lugar(lx), 12, 1, 0.25); ruido(b, 0, 0.5, { tipo: 'bandpass', f: 1300, q: 0.6, vol: 0.4, ataque: 0.05 }); ruido(b, 0, 0.6, { cafe: true, f: 400, vol: 0.4 }); },
  bono() { const b = bus(lugar(0), 12, 1, 0.4); for (const [f, t] of [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]]) { tono(b, t, f, f, 0.25, 0.08, 'square'); campana(b, t, f * 2, 0.4, 0.04, [1, 2]); } ruido(b, 0.3, 0.5, { tipo: 'highpass', f: 6000, vol: 0.12 }); },
  compra() { const b = bus(lugar(0), 12, 1, 0.15); tono(b, 0, 800, 1200, 0.07, 0.12, 'square'); tono(b, 0.08, 1200, 1600, 0.1, 0.1, 'square'); clic(b, 0, 3000, 0.3); },
};
