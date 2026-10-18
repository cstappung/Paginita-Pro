/* PRO TILES — la pantalla.
   Todo lo que decide una partida está en motor.js (pasos fijos de 4 ms);
   aquí se dibuja, suena el piano y se lleva la cuenta. La prueba de una
   partida es la semilla y el tick de cada nota tocada (y de cada ficha
   larga soltada); verifica/protiles.js la rehace con el mismo motor.
   Hay una tabla por canción y otra para la mezcla de las ocho
   (`club-protiles-<id>` / `club-protiles-mezcla`). */
(() => {
'use strict';
const M = window.ProTilesMotor, Club = window.Club;
const { SONGS, DIFF, STAR_AT, level, TICK_MS } = M;
/* Las teclas de los carriles son configurables (⚙ Ajustes): se guardan como
   `KeyboardEvent.code`, así que no dependen del idioma del teclado. */
const TECLAS_BASE = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
const PROHIBIDAS = new Set(['Escape', 'Tab', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'ContextMenu', 'CapsLock', 'F5', 'F11', 'F12']);
let teclas = TECLAS_BASE.slice();
const carrilDe = code => teclas.indexOf(code);
const NOMBRE_TECLA = { Space: 'Espacio', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
  Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', IntlBackslash: '<', Enter: 'Intro',
  ShiftLeft: 'Mayús', ShiftRight: 'Mayús der.', ControlLeft: 'Ctrl', ControlRight: 'Ctrl der.', AltLeft: 'Alt', AltRight: 'Alt der.', Backspace: '⌫' };
const etiqueta = code => /^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit\d$/.test(code) ? code.slice(5)
  : /^Numpad\d$/.test(code) ? 'Num ' + code.slice(6) : NOMBRE_TECLA[code] || String(code || '?').replace(/^Numpad/, 'Num ');
const KEYS = { get length() { return 4; } };
for (let i = 0; i < 4; i++) Object.defineProperty(KEYS, i, { get: () => etiqueta(teclas[i]) });

/* Paletas (⚙ Ajustes). Cada una da las variables de la caja (--pt-*) y los
   colores del lienzo. `ficha` es el color de las fichas y de las superficies
   macizas (botones, la tarjeta de la mezcla); `sobre`, lo que va encima. */
const TEMAS = {
  clasico:    { nombre: 'Clásico',    bg: '#EEE8DD', paper: '#FAF7F1', card: '#FFFFFF', ink: '#141414', ink2: '#34312C', mut: '#8C857A', line: '#E4DCCF', bar: '#EFE8DC', lane: '#E8E1D5', ghost: '#E6DFD3', coral: '#FF5A36', coral2: '#FF8A6B', red: '#D7263D', ficha: '#141414', sobre: '#FFFFFF', velo: 'rgba(238,232,221,.72)', tecla: '#BDB4A6', acTxt: '#FFFFFF' },
  medianoche: { nombre: 'Medianoche', bg: '#0F1220', paper: '#161A2B', card: '#1E2337', ink: '#EEF0F7', ink2: '#C9CDE0', mut: '#8A90AB', line: '#2A3050', bar: '#1D2236', lane: '#262C46', ghost: '#232A45', coral: '#8C6CFF', coral2: '#B9A4FF', red: '#FF4D6D', ficha: '#E9ECFF', sobre: '#161A2B', velo: 'rgba(15,18,32,.75)', tecla: '#4C5478', acTxt: '#FFFFFF' },
  menta:      { nombre: 'Menta',      bg: '#E1F1E8', paper: '#F4FBF7', card: '#FFFFFF', ink: '#10261C', ink2: '#2D4A3D', mut: '#6F8A7D', line: '#CFE3D8', bar: '#E4F2EA', lane: '#D6E9DE', ghost: '#D3E7DB', coral: '#0FAF7F', coral2: '#5FDDB5', red: '#E03131', ficha: '#10261C', sobre: '#FFFFFF', velo: 'rgba(225,241,232,.74)', tecla: '#9CB8AA', acTxt: '#FFFFFF' },
  atardecer:  { nombre: 'Atardecer',  bg: '#FCE6E1', paper: '#FFF5F2', card: '#FFFFFF', ink: '#3A1A2A', ink2: '#5C3346', mut: '#A07A88', line: '#F3D3CC', bar: '#FBE9E4', lane: '#F5DAD3', ghost: '#F3D9D2', coral: '#E64980', coral2: '#F783AC', red: '#C92A2A', ficha: '#3A1A2A', sobre: '#FFFFFF', velo: 'rgba(252,230,225,.74)', tecla: '#C9A2AE', acTxt: '#FFFFFF' },
  neon:       { nombre: 'Neón',       bg: '#07070C', paper: '#0D0D16', card: '#16161F', ink: '#F5F5FF', ink2: '#C8C8E0', mut: '#7A7A99', line: '#25253C', bar: '#141422', lane: '#1E1E33', ghost: '#1C1C2E', coral: '#00E5FF', coral2: '#7DF9FF', red: '#FF2E63', ficha: '#FF2E88', sobre: '#FFFFFF', velo: 'rgba(7,7,12,.75)', tecla: '#4A4A6E', acTxt: '#07070C' },
};
const C = {};
// rgba de un #RRGGBB: el brillo, las ondas y los destellos siguen al acento de la paleta.
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
const CAT = modo => 'club-protiles-' + modo;
const NOMBRE = modo => modo === 'mezcla' ? 'Mezcla infinita' : (SONGS.find(S => S.id === modo) || {}).name || modo;

/* ---------- Utilidades ---------- */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const ICON = {
  star:  '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>',
  world: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="#2D6CDF"/><path d="M1.5 12h21M12 1.5c3.6 3.4 3.6 17.6 0 21M12 1.5c-3.6 3.4-3.6 17.6 0 21M3.4 6.8h17.2M3.4 17.2h17.2" fill="none" stroke="#fff" stroke-width="1.3" opacity=".9"/></svg>',
  play:  '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg>',
};
function nextThreshold(score) {
  const all = [0, ...STAR_AT]; for (let i = 1; i < all.length; i++) if (score < all[i]) return [all[i - 1], all[i]];
  return null;                                                  // mundo conseguido: barra llena
}
// 0–3 estrellas, 4–6 coronas (sustituyen a las estrellas), 7 = mundo
function starsHTML(lv, popFrom) {
  const pop = popFrom != null && lv > popFrom;
  if (lv >= 7) return ICON.world.replace('<svg', `<svg class="world on${pop ? ' pop' : ''}" style="animation-delay:.15s"`);
  const crown = lv >= 4, on = crown ? lv - 3 : lv, icon = crown ? ICON.crown : ICON.star;
  return [0, 1, 2].map(k => icon.replace('<svg', `<svg class="${crown ? 'cw ' : ''}${k < on ? 'on' : ''}${pop && k === on - 1 ? ' pop' : ''}" style="animation-delay:${.15 + k * .15}s"`)).join('');
}

/* ---------- Guardado (por cuenta: Club.storageKey) ---------- */
const CUENTA = Club && Club.storageKey ? Club.storageKey('').replace(/^\.cuenta\./, '') : 'local';
const SKEY = Club && Club.storageKey ? Club.storageKey('protiles') : 'protiles.cuenta.local';
let save = { best: {}, mara: 0, mode: null, muted: false, tabla: '', teclas: null, tema: 'clasico' };
try { const s = JSON.parse(localStorage.getItem(SKEY)); if (s && typeof s === 'object') save = Object.assign(save, s); } catch (e) { /* sin almacenamiento */ }
if (!save.best || typeof save.best !== 'object') save.best = {};
if (Array.isArray(save.teclas) && save.teclas.length === 4 && new Set(save.teclas).size === 4 &&
  save.teclas.every(k => typeof k === 'string' && /^[A-Za-z0-9]{1,24}$/.test(k) && !PROHIBIDAS.has(k))) teclas = save.teclas.slice();
if (!TEMAS[save.tema]) save.tema = 'clasico';
const persist = () => { try { localStorage.setItem(SKEY, JSON.stringify(save)); } catch (e) { /* sin almacenamiento */ } };
const mejorDe = modo => modo === 'mezcla' ? save.mara || 0 : save.best[modo] || 0;
function anotaMejor(modo, p) {
  if (!(p > mejorDe(modo))) return false;
  if (modo === 'mezcla') save.mara = p; else save.best[modo] = p;
  persist(); return true;
}
let mode = save.mode || (matchMedia('(pointer:coarse)').matches ? 'touch' : 'kb');

/* =========================================================
   AUDIO — piano de cola real (Salamander) + batería sintetizada.
   Todo va a AC.destination, que volumen.js envuelve con el volumen del Club.
   ========================================================= */
const SAMPLE_URL = 'https://tonejs.github.io/audio/salamander/';
const SAMPLE_NAMES = ['C2','Ds2','Fs2','A2','C3','Ds3','Fs3','A3','C4','Ds4','Fs4','A4','C5','Ds5','Fs5','A5','C6','Ds6','Fs6','A6','C7'];
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const sampleMidi = n => { const m = n.match(/^([A-G])(s?)(\d)$/); return (+m[3] + 1) * 12 + PC[m[1]] + (m[2] ? 1 : 0); };
const buffers = new Map(), voices = new Set(), cercana = new Map();
let AC = null, bus = null, master = null, drums = null, noiseBuf = null, loadedN = 0, failedN = 0, cargando = false;

function ensureAudio() {
  if (AC) return AC;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  AC = new Ctx();
  const comp = AC.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3;
  comp.connect(AC.destination);
  master = AC.createGain(); master.gain.value = save.muted ? 0 : .9; master.connect(comp);
  bus = AC.createGain(); bus.connect(master);
  drums = AC.createGain(); drums.gain.value = .8; drums.connect(master);
  const len = AC.sampleRate * 2.4, ir = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  const conv = AC.createConvolver(); conv.buffer = ir;
  const wet = AC.createGain(); wet.gain.value = .2;
  bus.connect(conv); conv.connect(wet); wet.connect(master);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * .5, AC.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return AC;
}
function unlockAudio() { if (ensureAudio() && AC.state === 'suspended') AC.resume(); }
// El piano se descarga al abrir (un AudioContext suspendido ya decodifica).
function loadSamples() {
  if (cargando || !ensureAudio()) return;
  cargando = true; updLoad();
  SAMPLE_NAMES.forEach(n => {
    fetch(SAMPLE_URL + n + '.mp3')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => new Promise((res, rej) => AC.decodeAudioData(b, res, rej)))
      .then(buf => { buffers.set(sampleMidi(n), buf); cercana.clear(); loadedN++; updLoad(); })
      .catch(() => { failedN++; updLoad(); });
  });
}
function updLoad() {
  const el = $('load'), tx = $('loadTxt'), total = SAMPLE_NAMES.length;
  if (!cargando) { tx.textContent = 'Sin audio en este navegador'; return; }
  if (loadedN === total) { el.classList.add('ok'); tx.textContent = 'Piano de cola listo'; }
  else if (loadedN + failedN === total) { el.classList.add('ok'); tx.textContent = loadedN ? 'Piano listo (parcial)' : 'Sin conexión: piano sintetizado'; }
  else tx.textContent = `Cargando piano… ${Math.round(100 * loadedN / total)}%`;
}
function setMuted(m) {
  save.muted = m; persist();
  if (master) master.gain.setTargetAtTime(m ? 0 : .9, AC.currentTime, .02);
  const b = $('sound-button');
  b.setAttribute('aria-pressed', m ? 'false' : 'true');
  b.setAttribute('aria-label', m ? 'Activar sonido' : 'Silenciar');
  $('pSound').textContent = m ? 'Activar sonido' : 'Silenciar';
}
function playNote(midi, when, vel, dur) {
  if (!AC) return null;
  const t = Math.max(when || 0, AC.currentTime);
  // La muestra más cercana se recuerda por nota (cada nota la buscaba entre todas).
  let best = cercana.get(midi);
  if (best === undefined) {
    let bd = 99; best = null;
    for (const m of buffers.keys()) { const d = Math.abs(m - midi); if (d < bd) { bd = d; best = m; } }
    if (bd > 4) best = null;
    cercana.set(midi, best);
  }
  if (best === null) return synthNote(midi, t, vel, dur);
  const src = AC.createBufferSource();
  src.buffer = buffers.get(best);
  src.playbackRate.value = Math.pow(2, (midi - best) / 12);
  const g = AC.createGain(); g.gain.value = vel;
  src.connect(g); g.connect(bus); src.start(t);
  const v = { g, src }; voices.add(v); src.onended = () => voices.delete(v);
  if (dur != null) releaseVoice(v, t + dur, .3);
  return v;
}
function synthNote(midi, t, vel, dur) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const g = AC.createGain();
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vel * .7, t + .006); g.gain.exponentialRampToValueAtTime(vel * .2, t + .5);
  g.connect(bus);
  const oscs = [[1, 'triangle', 1], [2, 'sine', .3], [3, 'sine', .1]].map(([m, ty, a]) => {
    const o = AC.createOscillator(); o.type = ty; o.frequency.value = f * m;
    const og = AC.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); return o;
  });
  const v = { g, src: { stop: x => oscs.forEach(o => { try { o.stop(x); } catch (e) { /* ya parado */ } }) } };
  if (dur != null) releaseVoice(v, t + dur, .25); else oscs.forEach(o => o.stop(t + 8));
  return v;
}
function releaseVoice(v, t, tc) {
  if (!v || !AC) return;
  t = Math.max(t, AC.currentTime);
  try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, tc || .2); v.src.stop(t + (tc || .2) * 7); } catch (e) { /* ya parado */ }
}
function silenceAll(tc) { if (AC) for (const v of voices) releaseVoice(v, AC.currentTime, tc || .25); }
function noise(t, type, freq, q, vel, decay) {
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(.001, t + decay);
  s.connect(f); f.connect(g); g.connect(drums); s.start(t); s.stop(t + decay + .02);
}
function drum(kind, t, vel) {
  if (!AC) return;
  vel = vel == null ? 1 : vel;
  if (kind === 'k') {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .11);
    g.gain.setValueAtTime(.55 * vel, t); g.gain.exponentialRampToValueAtTime(.001, t + .32);
    o.connect(g); g.connect(drums); o.start(t); o.stop(t + .34);
    noise(t, 'lowpass', 1200, .7, .12 * vel, .02);
  } else if (kind === 's') {
    noise(t, 'bandpass', 1900, .7, .24 * vel, .16);
    const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = 185;
    g.gain.setValueAtTime(.12 * vel, t); g.gain.exponentialRampToValueAtTime(.001, t + .09);
    o.connect(g); g.connect(drums); o.start(t); o.stop(t + .1);
  } else if (kind === 'c') {
    // Aplauso: tres ráfagas cortas y una cola, como las palmas del pop de ahora.
    [0, .011, .023].forEach((d, i) => noise(t + d, 'bandpass', 1500, .9, (i < 2 ? .14 : .22) * vel, i < 2 ? .02 : .15));
  } else if (kind === 'r') noise(t, 'bandpass', 3200, 4, .16 * vel, .05);
  else if (kind === 'h') noise(t, 'highpass', 8000, .7, .045 * vel, .04);
  else if (kind === 'o') noise(t, 'highpass', 7000, .7, .04 * vel, .22);
}
const sfxFail = () => { if (!AC) return; silenceAll(.15); const t = AC.currentTime + .02; [36, 37, 43, 44].forEach(m => playNote(m, t, .35, 1.4)); };
const sfxStar = lv => { if (!AC) return; const t = AC.currentTime; (lv >= 7 ? [84, 88, 91, 96, 100] : lv >= 4 ? [86, 89, 93, 98] : [88, 91, 96]).forEach((m, i) => playNote(m, t + i * .05, .08, .9)); };
const sfxClick = () => { if (AC) playNote(96, 0, .05, .25); };

/* =========================================================
   CANVAS (mide la caja #app, no la ventana: vive en un iframe)
   ========================================================= */
const app = $('app'), stage = $('stage'), cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, rowH = 0, laneW = 0;
// El degradado del brillo de un carril, hecho una vez por tamaño y paleta.
let brillo = null, brilloDe = '';
function brilloCarril() {
  const k = H + C.coral;
  if (k !== brilloDe) { brilloDe = k; brillo = ctx.createLinearGradient(0, H, 0, H * .45); brillo.addColorStop(0, rgba(C.coral, .12)); brillo.addColorStop(1, rgba(C.coral, 0)); }
  return brillo;
}
function layout() {
  const vw = app.clientWidth, vh = app.clientHeight;
  if (!vw || !vh) return;
  const hudH = $('hud').offsetHeight + 3 || 67;
  H = Math.max(200, vh - hudH);
  W = Math.min(vw, Math.round(H * .62));
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  stage.style.width = W + 'px';
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  rowH = H / M.FILAS; laneW = W / 4;
  if (G && G.E.hold) soltar();          // cambió el tamaño: la larga se suelta
}
function rr(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* =========================================================
   PARTIDA
   ========================================================= */
let G = null, screen = 'menu', tocado = false;
const FX = { ripples: [], texts: [] };
const keyDown = [0, 0, 0, 0], laneFlash = [0, 0, 0, 0];
// En pantalla se dibuja `vp` (la posición del motor más lo que va del paso
// en curso, o la animación del fallo); los toques se miden contra E.pos.
const tileBot = t => H - (t.s - G.vp) * rowH;
const tileBotL = t => H - (t.s - G.E.pos) * rowH;
const semillaNueva = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return (Math.random() * 4294967296) >>> 0; } };
const hayMando = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(g => g && g.connected); } catch (e) { return false; } };
const deVerdad = e => !!e && (e.isTrusted || (!!e.__mando && hayMando()));
const inmersivo = v => { if (Club && Club.inmersivo) Club.inmersivo(v); };

function startGame(modo) {
  const E = M.nueva(modo, semillaNueva(), CUENTA);
  G = { E, modo, vp: 0, acc: 0, lv: 0, countdown: 0, paused: false, failT: 0, failFrom: 0, failTo: 0, wrong: null,
    why: '', acciones: [], fiable: true, t0: 0, w0: 0, pP: 0, pW: 0, pausaP: 0, pausaW: 0, enviado: false, frame: 0 };
  FX.ripples.length = FX.texts.length = 0;
  elige(modo);
  show('game');
  layout();
  const S = E.tiles[0].S, first = KEYS[E.tiles[0].lane];
  $('iKick').textContent = E.kind === 'song' ? `${S.genre} · ${S.bpm} BPM` : 'Mezcla infinita';
  $('iTitle').textContent = E.kind === 'song' ? S.name : 'Todas, sin fin';
  $('iComp').textContent = E.kind === 'song' ? 'Adaptada a piano · no termina nunca' : 'Empieza con ' + S.name;
  $('iHow').innerHTML = mode === 'kb' ? `Pulsa <kbd>${first}</kbd> para empezar` : 'Toca la ficha de color para empezar';
  $('intro').classList.remove('gone');
  $('count').textContent = '';
  $('hstars').innerHTML = starsHTML(0);
  $('rNota').textContent = '';
  inmersivo(true);
  updHUD();
}

/* ---------- Entrada ---------- */
function tryHit(lane, y, src) {
  const g = G;
  if (!g || g.E.over || g.paused || g.countdown > 0) return;
  const E = g.E, t = E.tiles[E.next]; if (!t) return;
  const bot = tileBotL(t), top = bot - t.len * rowH;
  if (src.type === 'touch') {
    if (lane === t.lane && y >= top - rowH * .25 && y <= bot + rowH * .35) { hit(t, src, y); return; }
    if (!E.started) return;
    for (let i = Math.max(0, E.next - 10); i < E.tiles.length; i++) {          // tocar fichas ya tocadas o futuras no cuenta
      const u = E.tiles[i], ub = tileBotL(u);
      if (ub < 0) break;
      if (i !== E.next && u.lane === lane && y >= ub - u.len * rowH - 4 && y <= ub + 4) return;
    }
    fail('wrong', lane, y);
  } else {
    if (bot < rowH * .2) return;
    if (lane === t.lane) hit(t, src, null);
    else if (E.started) fail('wrong', lane, clamp((top + bot) / 2, rowH * .5, H - rowH * .5));
  }
}
function hit(t, src, y) {
  const g = G, E = g.E, empezo = E.started;
  const bot = tileBotL(t), top0 = bot - t.len * rowH;
  let dc = null;
  if (t.hold) {
    // Se completa al llegar al punto de pulsación (con teclado, al final).
    const target = y == null ? bot : clamp(y, top0 + rowH * M.HOLD_MIN, bot);
    dc = clamp(Math.round((target - top0) / rowH * 100), M.HOLD_MIN * 100, t.len * 100);
  }
  const tick = E.t, r = M.golpe(E, dc);
  if (!r) return;
  if (!empezo) { g.t0 = performance.now(); g.w0 = Date.now(); $('intro').classList.add('gone'); }
  g.acciones.push(dc == null ? { t: tick, l: t.lane } : { t: tick, l: t.lane, dc });
  if (!src.fiable) g.fiable = false;
  if (r.fin) cierraLarga(r.fin);
  const cx = (t.lane + .5) * laneW;
  const cy = y == null ? clamp(bot - Math.min(t.len, 1) * rowH / 2, 20, H - 20) : y;
  const sec = t.len / E.speed, v = .56 / Math.sqrt(t.midis.length);
  const vs = t.midis.map((m, i) => playNote(m, 0, i ? v * .6 : v, t.hold ? null : Math.max(.3, sec) + .12));
  if (t.hold) { t.state = 2; t.voices = vs; t.src = src.id; t.target = top0 + dc / 100 * rowH; }
  else { t.state = 1; t.t = 0; }
  laneFlash[t.lane] = 1;
  FX.ripples.push({ x: cx, y: cy, t: 0 });
  revisaNivel();
  updHUD();
}
// Una larga terminó (sola, al soltar o al tocar la siguiente).
function cierraLarga(fin) {
  const h = fin.tile;
  h.state = 1; h.t = 0;
  if (fin.bonus > 0) {
    FX.texts.push({ x: (h.lane + .5) * laneW, y: clamp(tileBot(h) - h.len * rowH + 26, 40, H - 40), text: '+' + fin.bonus, t: 0 });
    (h.voices || []).forEach(v => releaseVoice(v, AC ? AC.currentTime + .25 : 0, .35));
  } else (h.voices || []).forEach(v => releaseVoice(v, AC ? AC.currentTime : 0, .15));
  h.voices = null;   // la ficha queda en la partida: sin esto retenía sus nodos de audio
  revisaNivel();
  updHUD();
}
function soltar() {
  const E = G.E;
  if (!E.hold || E.over) return;
  G.acciones.push({ t: E.t, r: true });
  cierraLarga(M.suelta(E));
}
const release = id => { if (G && G.E.hold && G.E.hold.tile.src === id) soltar(); };
function revisaNivel() {
  const g = G, lv = level(g.E.score);
  if (lv > g.lv) { $('hstars').innerHTML = starsHTML(lv, g.lv); g.lv = lv; sfxStar(lv); }
}

function fail(kind, lane, y, h) {
  const g = G, E = g.E;
  h = h || E.hold;
  if (kind === 'wrong') { if (E.over) return; M.falla(E); }
  if (h) { h.tile.state = 1; h.tile.t = 1; (h.tile.voices || []).forEach(v => releaseVoice(v, AC ? AC.currentTime : 0, .1)); h.tile.voices = null; }
  g.failT = 0; g.failFrom = g.vp;
  if (kind === 'miss') {
    const t = E.tiles[E.next]; t.state = 3; t.t = 0;
    g.failTo = t.s - .35;
    g.why = 'Se te escapó una ficha';
  } else {
    g.wrong = { lane, s: E.pos + (H - y) / rowH - .5, t: 0 };
    g.failTo = E.pos;
    g.why = 'Tocaste fuera de una ficha';
  }
  sfxFail();
  if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(120); } catch (e) { /* sin vibración */ }
  enviaResultado(g);
  setTimeout(() => { if (G === g) showResult(); }, 1500);
}

/* La partida terminó: al Club con su prueba (solo si sumó algo). */
function enviaResultado(g) {
  if (g.enviado) return;
  g.enviado = true;
  const E = g.E;
  g.nuevo = E.score > 0 && anotaMejor(E.modo, E.score);
  if (!Club || E.score < 1 || tocado) return;
  const prueba = { v: M.PRUEBA_V, m: E.modo, s: E.semilla, u: E.u, g: M.codifica(g.acciones), n: E.t,
    a: Math.round(performance.now() - g.t0 - g.pP), w: Date.now() - g.w0 - g.pW };
  if (!g.fiable) prueba.x = 1;
  Club.result({ categoria: CAT(E.modo), puntos: E.score, tiempo: Math.max(1, E.t * TICK_MS) }, prueba);
}

/* ---------- Bucle ---------- */
function schedule(g) {
  const E = g.E;
  if (!AC || E.over || g.paused || !E.started || g.countdown > 0) return;
  const now = AC.currentTime;
  while (E.evq.length) {
    const e = E.evq[0];
    const dt = (e.row - 1 - g.vp) / E.speed;     // 1 = la línea de pulso, una fila sobre el borde
    if (dt > .12) break;
    E.evq.shift();
    if (dt < -.06) continue;
    const t = now + Math.max(0, dt);
    if (e.perc) drum(e.perc, t, e.pv);
    else { const v = e.vel / Math.sqrt(e.notes.length); e.notes.forEach(m => playNote(m, t, v, e.len / E.speed)); }
  }
}
function envejece(arr, dt) { for (let i = arr.length - 1; i >= 0; i--) { arr[i].t += dt; if (arr[i].t > .7) arr.splice(i, 1); } }
function update(dt) {
  envejece(FX.ripples, dt); envejece(FX.texts, dt);
  for (let i = 0; i < 4; i++) laneFlash[i] = Math.max(0, laneFlash[i] - dt * 4);
  const g = G; if (!g) return;
  const E = g.E;
  if (g.wrong) g.wrong.t += dt;
  if (g.paused) return;
  if (E.over) { g.failT += dt; g.vp = lerp(g.failFrom, g.failTo, easeOut(Math.min(1, g.failT / .45))); return; }
  if (g.countdown > 0) {
    const b = Math.ceil(g.countdown); g.countdown -= dt; const n = Math.ceil(g.countdown), el = $('count');
    if (g.countdown <= 0) { el.textContent = ''; g.acc = 0; }
    else if (n !== b) { el.textContent = n; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); sfxClick(); }
    return;
  }
  if (!E.started) { g.vp = E.pos; return; }
  // el tempo sube de forma continua (sin saltos); en la mezcla se adapta a cada canción
  g.acc += dt * 1000;
  while (g.acc >= TICK_MS) {
    g.acc -= TICK_MS;
    const h = E.hold, r = M.paso(E);
    if (r && r.larga) cierraLarga(r.larga);
    if (r && r.fallo) { g.vp = E.pos; fail('miss', 0, 0, r.larga ? null : h); return; }
  }
  g.vp = E.pos + E.speed * g.acc / 1000;
  schedule(g);
  if (++g.frame % 15 === 0) updSub();
}

function render(dt) {
  const g = G;
  if (!g || !W) return;
  const E = g.E;
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.bar;                                       // líneas de compás
  for (let i = E.barRows.length - 1; i >= 0; i--) {
    const y = H - (E.barRows[i] - g.vp) * rowH;
    if (y > H) break;
    if (y >= 0) ctx.fillRect(0, Math.round(y), W, 1);
  }
  for (let i = 1; i < 4; i++) { ctx.fillStyle = C.lane; ctx.fillRect(Math.round(i * laneW), 0, 1, H); }
  for (let i = 0; i < 4; i++) {
    const a = Math.max(laneFlash[i] * .8, keyDown[i] ? .6 : 0);
    if (a <= 0) continue;
    ctx.globalAlpha = a; ctx.fillStyle = brilloCarril(); ctx.fillRect(i * laneW, 0, laneW, H); ctx.globalAlpha = 1;
  }
  if (mode === 'kb') {
    ctx.font = '600 13px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) { ctx.fillStyle = keyDown[i] ? C.coral : C.tecla; ctx.fillText(KEYS[i], (i + .5) * laneW, H - 16); }
  }
  const adt = g.paused ? 0 : dt;
  for (let i = Math.max(0, E.next - 16); i < E.tiles.length; i++) {
    const t = E.tiles[i], bot = tileBot(t);
    if (bot - t.len * rowH > H) continue;
    if (bot < 0) break;
    t.t += adt;
    drawTile(t, bot, i);
  }
  if (g.wrong) {
    const w = g.wrong, bot = H - (w.s - g.vp) * rowH;
    rr(w.lane * laneW + 1.5, bot - rowH + 1.5, laneW - 3, rowH - 3, 6);
    ctx.fillStyle = `rgba(215,38,61,${.55 + .45 * Math.cos(w.t * 18)})`; ctx.fill();
  }
  for (const r of FX.ripples) {
    const k = r.t / .45; if (k > 1) continue;
    ctx.strokeStyle = rgba(C.coral, (1 - k) * .9); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, 8 + easeOut(k) * laneW * .5, 0, 6.283); ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 18px Sora, system-ui, sans-serif';
  for (const tx of FX.texts) {
    const k = tx.t / .7; ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.fillStyle = C.coral;
    ctx.fillText(tx.text, tx.x, tx.y - easeOut(Math.min(1, k)) * 30);
  }
  ctx.globalAlpha = 1;
}

function drawTile(t, bot, i) {
  const g = G;
  const x = t.lane * laneW + 1.5, w = laneW - 3, h = t.len * rowH - 3, y = bot - t.len * rowH + 1.5, cx = x + w / 2;
  const R = Math.min(7, h / 3);
  if (t.state === 0 || t.state === 2) {
    const start = i === 0 && !g.E.started;
    rr(x, y, w, h, R); ctx.fillStyle = start ? C.coral : C.ficha; ctx.fill();
    ctx.fillStyle = rgba(C.sobre, .09); ctx.fillRect(x + R, y + 1.5, w - R * 2, 1.2);
    if (t.hold) {
      ctx.fillStyle = rgba(C.coral, .55); ctx.fillRect(cx - .75, y + 16, 1.5, Math.max(0, h - 40));
      ctx.beginPath(); ctx.arc(cx, y + h - 18, 4.5, 0, 6.283); ctx.fillStyle = start ? C.sobre : C.coral; ctx.fill();
      if (t.state === 2) {
        const fh = clamp(y + h - t.target, 20, h - 4);
        const gr = ctx.createLinearGradient(0, y + h - fh, 0, y + h);
        gr.addColorStop(0, C.coral2); gr.addColorStop(1, C.coral);
        rr(x + 3, y + h - fh - 2, w - 6, fh, Math.min(5, R)); ctx.fillStyle = gr; ctx.fill();
        ctx.save(); ctx.shadowColor = rgba(C.coral, .8); ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(cx, y + h - fh + 8, 6, 0, 6.283); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      }
    }
    if (start) {
      const p = (performance.now() / 1000) % 1.3 / 1.3;
      ctx.strokeStyle = rgba(C.coral, 1 - p); ctx.lineWidth = 2;
      rr(x - p * 10, y - p * 10, w + p * 20, h + p * 20, R + p * 6); ctx.stroke();
      ctx.fillStyle = C.acTxt; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 15px Sora, system-ui, sans-serif'; ctx.fillText('Iniciar', cx, y + h / 2 - (mode === 'kb' ? 7 : 0));
      if (mode === 'kb') { ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.fillStyle = rgba(C.acTxt, .8); ctx.fillText('tecla ' + KEYS[t.lane], cx, y + h / 2 + 11); }
    } else if (mode === 'kb' && t.state === 0 && h > 26) {
      ctx.fillStyle = rgba(C.sobre, .32); ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(KEYS[t.lane], cx, y + h / 2);
    }
  } else if (t.state === 1) {
    const k = Math.min(1, t.t / .16), s = Math.sin(k * Math.PI) * 3;
    rr(x + s, y + s, w - s * 2, h - s * 2, R); ctx.fillStyle = C.ghost; ctx.fill();
    if (k < 1) { ctx.globalAlpha = 1 - k; ctx.fillStyle = C.ficha; ctx.fill(); ctx.globalAlpha = 1; }
  } else if (t.state === 3) {
    rr(x, y, w, h, R); ctx.fillStyle = C.red; ctx.globalAlpha = .55 + .45 * Math.cos(t.t * 18); ctx.fill(); ctx.globalAlpha = 1;
  }
}

let lastTs = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - lastTs) / 1000 || 0); lastTs = ts;
  update(dt);
  if (screen !== 'menu') render(dt);
  requestAnimationFrame(frame);
}

/* =========================================================
   HUD / RESULTADOS / PAUSA
   ========================================================= */
function updHUD() {
  const g = G; if (!g) return;
  const el = $('score'), sc = g.E.score;
  if (el.textContent !== String(sc)) { el.textContent = sc; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  $('nPuntos').textContent = sc;
  const nt = nextThreshold(sc);
  $('lapfill').style.width = nt ? (100 * (sc - nt[0]) / (nt[1] - nt[0])) + '%' : '100%';
  updSub();
}
function updSub() {
  const g = G; if (!g) return;
  const E = g.E, S = M.actual(E);
  $('sub').textContent = (E.kind === 'song' ? S.genre : S.name) + ' · ×' + (E.started ? E.speed / S.tps : 1).toFixed(1);
}
function showResult() {
  const g = G, E = g.E, lv = level(E.score), best = mejorDe(E.modo);
  $('rKick').textContent = NOMBRE(E.modo);
  $('rTitle').textContent = lv >= 7 ? '¡Nivel mundial!' : lv >= 4 ? '¡Leyenda!' : lv === 3 ? '¡Magistral!' : lv >= 1 ? '¡Bien tocado!' : 'Casi…';
  $('rWhy').textContent = g.why;
  $('rScore').textContent = E.score;
  $('rStars').innerHTML = starsHTML(lv);
  $('rBest').innerHTML = g.nuevo ? '<b>¡Nuevo récord!</b>' : `Récord: ${best}`;
  $('rNotes').textContent = E.hits;
  $('rTime').textContent = fmtTime(E.t * TICK_MS / 1000);
  $('rSpeed').textContent = '×' + E.maxF.toFixed(1);
  show('result');
  pintaMarcador();
  setTimeout(() => $('rAgain').focus({ preventScroll: true }), 60);
}
function pauseGame() {
  if (!G || G.E.over || screen !== 'game') return;
  if (G.E.hold) soltar();
  G.paused = true; keyDown.fill(0);
  if (G.E.started) { G.pausaP = performance.now(); G.pausaW = Date.now(); }
  silenceAll(.3);
  $('pKick').textContent = NOMBRE(G.modo);
  show('pause');
  $('pResume').focus({ preventScroll: true });
}
function resumeGame() {
  if (!G || !G.paused) return;
  show('game'); G.paused = false;
  if (G.E.started) { G.pP += performance.now() - G.pausaP; G.pW += Date.now() - G.pausaW; G.countdown = 3; }
  cv.focus({ preventScroll: true });
}
const restart = () => startGame(G.modo);
function toMenu() { G = null; keyDown.fill(0); silenceAll(.4); buildMenu(); show('menu'); }
function show(name) {
  screen = name;
  // Los ajustes se abren encima del menú o de la pausa (con el juego detrás).
  const fondo = name === 'ajustes' ? (ajustesDesde === 'menu' ? 'menu' : 'game') : name;
  $('menu').classList.toggle('hidden', fondo !== 'menu');
  $('game').classList.toggle('hidden', fondo === 'menu');
  $('pause').classList.toggle('hidden', name !== 'pause');
  $('result').classList.toggle('hidden', name !== 'result');
  $('ajustes').classList.toggle('hidden', name !== 'ajustes');
  document.querySelectorAll('.kb-only').forEach(e => e.classList.toggle('hidden', mode !== 'kb'));
  inmersivo(name === 'game');
}

/* =========================================================
   MENÚ, MARCADOR Y TABLA
   ========================================================= */
function cover(S, i) {
  // "carátula": mini ecualizador con la forma del estribillo
  const notes = S.hookBars.slice(0, 2).flat(), lo = Math.min(...notes.map(n => n.idx)), hi = Math.max(...notes.map(n => n.idx));
  const hues = ['#141414', '#2B2622', '#141414', '#1E1A2E', '#141414', '#2A1C17', '#141414', '#1A2420'];
  return `<span class="cover" style="background:${hues[i % hues.length]}">${notes.slice(0, 6).map((n, k) =>
    `<i style="left:${6 + k * 6.4}px;height:${10 + (n.idx - lo) / Math.max(1, hi - lo) * 26}px;${k === 2 ? 'background:var(--pt-coral)' : ''}"></i>`).join('')}</span>`;
}
function buildMenu() {
  const ol = $('songs'); ol.innerHTML = '';
  SONGS.forEach((S, i) => {
    const b = save.best[S.id] || 0;
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="song" style="animation-delay:${i * .035}s">${cover(S, i)}
      <span class="meta"><b translate="no"></b><small>${S.genre} <span class="dots">${[1, 2, 3, 4].map(k => `<i class="${k <= S.diff ? 'on' : ''}"></i>`).join('')}</span></small></span>
      <span class="rec"><span class="stars">${starsHTML(level(b))}</span><small translate="no">${b ? 'Récord ' + b : S.bpm + ' BPM'}</small></span>
      <span class="play">${ICON.play}</span></button>`;
    li.querySelector('b').textContent = S.name;
    const btn = li.querySelector('button');
    btn.setAttribute('aria-label', `${S.name}, ${S.genre}, ${DIFF[S.diff]}`);
    btn.onclick = () => { unlockAudio(); sfxClick(); startGame(S.id); };
    ol.appendChild(li);
  });
  $('maraRec').textContent = save.mara ? `Récord ${save.mara} · Las 8 canciones encadenadas` : 'Las 8 canciones encadenadas como una sesión de DJ';
  setMode(mode, true);
}
function setMode(m, silent) {
  mode = m; save.mode = m; if (!silent) persist();
  document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('modeHint').innerHTML = m === 'kb' ? 'Teclas ' + kbds() : 'Toca las fichas';
}

/* La tabla que se mira: la de la canción que se juega, o la que se eligió
   en el selector de al lado (cambiarla vuelve a leer la tabla). */
let tabla = M.MODOS.includes(save.tabla) ? save.tabla : 'mezcla';
const sel = $('selTabla');
for (const m of M.MODOS) { const o = document.createElement('option'); o.value = m; o.textContent = m === 'mezcla' ? 'Todas, sin fin (mezcla)' : NOMBRE(m); o.setAttribute('translate', 'no'); sel.appendChild(o); }
function elige(modo) {
  if (!M.MODOS.includes(modo)) return;
  sel.value = modo;
  pintaMarcador(modo);
  if (modo === tabla) return;
  tabla = modo; save.tabla = modo; persist();
  if (Club) Club.category(CAT(modo));
}
function pintaMarcador(modo) {
  modo = modo || tabla;
  $('nModo').textContent = NOMBRE(modo);
  $('nMejor').textContent = mejorDe(modo);
  if (!G) $('nPuntos').textContent = 0;
}
sel.onchange = () => elige(sel.value);

/* =========================================================
   EVENTOS
   ========================================================= */
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  unlockAudio();
  if (screen !== 'game') return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (e.pointerType === 'touch' && mode !== 'touch' && !(G && G.E.started)) setMode('touch');
  tryHit(clamp(Math.floor(x / laneW), 0, 3), y, { type: 'touch', id: 'p' + e.pointerId, fiable: deVerdad(e) });
});
const up = e => release('p' + e.pointerId);
window.addEventListener('pointerup', up);
window.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
for (const t of ['selectstart', 'dragstart']) app.addEventListener(t, e => e.preventDefault());
app.addEventListener('touchstart', e => { if (screen === 'game' && !e.target.closest('button')) e.preventDefault(); }, { passive: false });

window.addEventListener('keydown', e => {
  if (screen === 'ajustes') { teclaAjustes(e); return; }
  const lane = carrilDe(e.code);
  if (screen === 'game') {
    if (lane >= 0) {
      e.preventDefault();
      if (e.repeat) return;
      unlockAudio();
      if (mode !== 'kb') setMode('kb');
      keyDown[lane] = 1;
      tryHit(lane, null, { type: 'key', id: 'k' + e.code, fiable: deVerdad(e) });
    } else if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); pauseGame(); }
  } else if (screen === 'pause') {
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); resumeGame(); }
    else if (e.code === 'KeyR') restart();
    else if (e.code === 'KeyM') toMenu();
  } else if (screen === 'result') {
    if (e.code === 'Escape' || e.code === 'KeyM') toMenu();
    else if (e.code === 'KeyR') restart();
  } else if (screen === 'menu') {
    const m = e.code.match(/^(?:Digit|Numpad)([1-8])$/);
    if (m && !(e.target && e.target.closest && e.target.closest('select,input'))) { unlockAudio(); if (mode !== 'kb') setMode('kb'); startGame(SONGS[+m[1] - 1].id); }
  }
});
window.addEventListener('keyup', e => {
  const lane = carrilDe(e.code);
  if (lane >= 0) { keyDown[lane] = 0; release('k' + e.code); }
});

$('bPause').addEventListener('click', () => { unlockAudio(); pauseGame(); });
$('pResume').onclick = resumeGame;
$('pRestart').onclick = restart;
$('pMenu').onclick = toMenu;
$('pSound').onclick = () => { unlockAudio(); setMuted(!save.muted); };
$('sound-button').onclick = () => { unlockAudio(); setMuted(!save.muted); sfxClick(); };
$('rMenu').onclick = toMenu;
$('rAgain').onclick = () => { unlockAudio(); restart(); };
$('bMara').onclick = () => { unlockAudio(); sfxClick(); startGame('mezcla'); };
document.querySelectorAll('#seg button').forEach(b => b.onclick = () => { unlockAudio(); setMode(b.dataset.m); });

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());
new ResizeObserver(() => { if (screen !== 'menu') layout(); }).observe(app);

/* ---------- Mando: cruceta ← ↓ y botones A B son los cuatro carriles ---------- */
function configuraMando() {
  if (!window.Mando) return;
  window.Mando.configura({
    botones: { izq: teclas[0], abajo: teclas[1], a: teclas[2], b: teclas[3], start: 'KeyP' },
    objetivo: () => document.body,
    menu: () => screen !== 'game',
    inicio: () => screen === 'pause' ? $('pResume') : screen === 'result' ? $('rAgain') : $('bMara'),
    pistas: [['izq abajo a b', 'tocar los carriles'], ['start', 'pausa']],
    zonas: [{ sel: '#nota' }]
  });
}
configuraMando();

/* ---------- Pantalla completa (⛶ en el marcador y en la pausa) ----------
   Se pide sobre el documento entero (el iframe del Club tiene
   allow="fullscreen"); html.pt-pc deja solo la franja del marcador —con el
   sonido, el volumen y el ⛶ para salir— y la caja ocupando el resto. En el
   iPhone no hay pantalla completa de elementos: el botón no se muestra y
   queda el modo celular de conexion.js. El estado sigue a fullscreenchange,
   también si se sale con Escape. */
const enPantallaCompleta = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const hayPantallaCompleta = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function alternaPantallaCompleta() {
  if (!hayPantallaCompleta) return;
  try {
    if (enPantallaCompleta()) { const f = document.exitFullscreen || document.webkitExitFullscreen; const r = f && f.call(document); if (r && r.catch) r.catch(() => {}); }
    else { const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; const r = f && f.call(el); if (r && r.catch) r.catch(() => {}); }
  } catch (e) { /* el navegador no dejó: se sigue en ventana */ }
}
function pintaPantallaCompleta() {
  const si = enPantallaCompleta();
  document.documentElement.classList.toggle('pt-pc', si);
  const b = $('bFull'), t = si ? 'Salir de pantalla completa' : 'Pantalla completa';
  b.hidden = $('pFull').hidden = !hayPantallaCompleta;
  b.setAttribute('aria-pressed', String(si)); b.title = t; b.setAttribute('aria-label', t);
  $('pFull').textContent = t;
}
$('bFull').onclick = () => { unlockAudio(); alternaPantallaCompleta(); };
$('pFull').onclick = () => { unlockAudio(); alternaPantallaCompleta(); };
document.addEventListener('fullscreenchange', pintaPantallaCompleta);
document.addEventListener('webkitfullscreenchange', pintaPantallaCompleta);

/* ---------- ⚙ Ajustes: teclas de los carriles y paleta ---------- */
let ajustesDesde = 'menu', esperando = -1;
const kbds = () => [0, 1, 2, 3].map(i => `<kbd translate="no">${KEYS[i]}</kbd>`).join(' ');
function aplicaTema(id) {
  const T = TEMAS[id] || TEMAS.clasico;
  save.tema = TEMAS[id] ? id : 'clasico';
  Object.assign(C, T);
  for (const k of ['bg', 'paper', 'card', 'ink', 'ink2', 'mut', 'line', 'coral', 'coral2', 'red', 'ficha', 'sobre', 'velo', 'acTxt'])
    app.style.setProperty('--pt-' + k, T[k]);
  app.dataset.tema = save.tema;
  pintaAjustes();
}
function pintaTeclas() {
  if ($('modeHint')) setMode(mode, true);
  const n = $('notaTeclas'); if (n) n.innerHTML = kbds();
  configuraMando();
}
function pintaAjustes() {
  const caja = $('ajTeclas');
  caja.innerHTML = [0, 1, 2, 3].map(i => `<button type="button" class="tecla${esperando === i ? ' espera' : ''}" data-i="${i}" aria-label="Carril ${i + 1}: ${KEYS[i]}"><small>Carril ${i + 1}</small><b translate="no">${esperando === i ? '…' : KEYS[i]}</b></button>`).join('');
  caja.querySelectorAll('.tecla').forEach(b => b.onclick = () => { esperando = esperando === +b.dataset.i ? -1 : +b.dataset.i; pintaAjustes(); });
  $('ajAviso').textContent = esperando >= 0 ? `Pulsa la tecla nueva para el carril ${esperando + 1} (Esc cancela).` : 'Toca un carril y pulsa la tecla que quieras.';
  const temas = $('ajTemas');
  temas.innerHTML = Object.entries(TEMAS).map(([id, T]) => `<button type="button" class="tema${id === save.tema ? ' on' : ''}" data-t="${id}" aria-pressed="${id === save.tema}">
    <span class="muestra" style="background:${T.paper};border-color:${T.line}">${[0, 1, 2, 3].map(k => `<i style="background:${k === 1 ? T.coral : k === 3 ? T.ficha : 'transparent'};${k ? 'border-left:1px solid ' + T.lane : ''}"></i>`).join('')}</span>
    <b>${T.nombre}</b></button>`).join('');
  temas.querySelectorAll('.tema').forEach(b => b.onclick = () => { aplicaTema(b.dataset.t); persist(); });
}
function abreAjustes() {
  if (screen === 'game') pauseGame();
  if (screen !== 'menu' && screen !== 'pause') return;
  ajustesDesde = screen; esperando = -1;
  pintaAjustes(); show('ajustes');
  $('ajListo').focus({ preventScroll: true });
}
function cierraAjustes() {
  esperando = -1;
  if (ajustesDesde === 'pause') { show('pause'); $('pResume').focus({ preventScroll: true }); } else show('menu');
}
function teclaAjustes(e) {
  if (esperando < 0) { if (e.code === 'Escape') { e.preventDefault(); cierraAjustes(); } return; }
  e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') { esperando = -1; pintaAjustes(); return; }
  if (PROHIBIDAS.has(e.code) || !/^[A-Za-z0-9]{1,24}$/.test(e.code)) { $('ajAviso').textContent = 'Esa tecla no se puede usar. Prueba otra.'; return; }
  const otra = teclas.indexOf(e.code);
  if (otra >= 0 && otra !== esperando) teclas[otra] = teclas[esperando];   // ya estaba en otro carril: se intercambian
  teclas[esperando] = e.code;
  esperando = -1;
  save.teclas = teclas.slice(); persist();
  pintaTeclas(); pintaAjustes();
}
$('bAjustes').onclick = () => { unlockAudio(); abreAjustes(); };
$('pAjustes').onclick = abreAjustes;
$('ajListo').onclick = cierraAjustes;
$('ajReset').onclick = () => { teclas = TECLAS_BASE.slice(); save.teclas = null; esperando = -1; persist(); pintaTeclas(); pintaAjustes(); };

/* ---------- La tabla del Club ---------- */
// Un récord de la nube mejor que el local (otro dispositivo) se adopta.
addEventListener('club-record', e => {
  const d = e.detail || {}, m = /^club-protiles-([a-z]+)$/.exec(d.categoria || '');
  if (!m || !M.MODOS.includes(m[1])) return;
  if (anotaMejor(m[1], Number(d.puntos) || 0)) { if (screen === 'menu') buildMenu(); pintaMarcador(); }
});
addEventListener('club-rechazo', e => {
  if (e.detail && /^club-protiles-/.test(e.detail.categoria || '')) $('rNota').textContent = 'Esta partida no se guardó: ' + (e.detail.motivo || '');
});

/* ---------- Ganchos para probar desde la consola ----------
   Cualquiera que cambie la partida la marca: se juega, pero no se manda. */
window.__protiles = {
  estado: () => G ? { modo: G.modo, puntos: G.E.score, notas: G.E.hits, t: G.E.t, pos: G.E.pos, fin: G.E.over } : null,
  siguiente: () => { const t = G && G.E.tiles[G.E.next]; return t ? { carril: t.lane, s: t.s, largo: t.len, pos: G.E.pos, manteniendo: !!G.E.hold } : null; },
  salta(p) { if (!G) return; tocado = true; G.E.score = Math.max(0, p | 0); updHUD(); },
};

/* ---------- Arranque ---------- */
const tactil = matchMedia('(pointer:coarse)').matches;
$('nota').innerHTML = (tactil
  ? 'Toca las fichas negras de abajo hacia arriba; mantén las largas. '
  : 'Teclas <span id="notaTeclas"></span> (o clic) para tocar, cámbialas en ⚙ Ajustes; mantén las largas; <kbd>Esc</kbd> pausa; <kbd>1</kbd>–<kbd>8</kbd> eligen canción en el menú. ') +
  'Un error termina la partida. ' +
  (document.documentElement.classList.contains('club-integrado')
    ? 'Cada canción tiene su propio top, y la mezcla el suyo.'
    : 'Tus récords viven en este navegador; juega desde Juegos para entrar en la clasificación.');

aplicaTema(save.tema);
buildMenu();
pintaTeclas();
pintaPantallaCompleta();
setMuted(save.muted);
loadSamples();
updLoad();
sel.value = tabla;
pintaMarcador();
if (Club) Club.category(CAT(tabla));
show('menu');
requestAnimationFrame(t => { lastTs = t; frame(t); });
})();
