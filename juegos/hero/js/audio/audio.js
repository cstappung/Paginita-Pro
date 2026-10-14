// Motor de audio: reproduce todas las pistas (stems) de la canción sincronizadas
// con Web Audio y ofrece un reloj de canción preciso y suave.
import { settings } from '../settings.js';

let sharedCtx = null;
export function audioContext() {
  if (!sharedCtx) sharedCtx = new AudioContext({ latencyHint: 'interactive' });
  return sharedCtx;
}

export class SongAudio {
  constructor() {
    this.ctx = audioContext();
    this.out = this.ctx.createGain();
    this.out.connect(this.ctx.destination);
    this.sfxOut = this.ctx.createGain();
    this.sfxOut.connect(this.ctx.destination);
    this.buffers = {};
    this.gains = {};
    this.sources = [];
    this.startCtx = 0;
    this.duration = 0;
    this.playing = false;
    this.paused = false;
    this.pausedAt = 0;
    // reloj suavizado
    this._smooth = null;
    this._lastPerf = 0;
    this.applyVolumes();
  }

  applyVolumes() {
    this.out.gain.value = settings.volume.master;
    this.sfxOut.gain.value = settings.volume.master * settings.volume.sfx;
  }

  async load(files, onProgress) {
    const entries = Object.entries(files);
    let done = 0;
    let lastErr = null;
    await Promise.all(entries.map(async ([stem, src]) => {
      try {
        // src: URL o función que devuelve los bytes (descarga con caché)
        let data;
        if (typeof src === 'function') data = await src();
        else {
          const res = await fetch(src);
          if (!res.ok) throw new Error(res.statusText);
          data = await res.arrayBuffer();
        }
        this.buffers[stem] = await this.ctx.decodeAudioData(data);
        this.duration = Math.max(this.duration, this.buffers[stem].duration);
      } catch (err) {
        console.warn('No se pudo cargar el audio', stem, err);
        lastErr = err;
      }
      onProgress?.(++done / entries.length);
    }));
    if (!Object.keys(this.buffers).length) throw lastErr || new Error('No se pudo decodificar ningún archivo de audio');
    // efectos listos antes de empezar para que no causen tirones en plena canción
    missBank(this.ctx);
    await sampleBank(this.ctx);
    for (const stem of Object.keys(this.buffers)) {
      const g = this.ctx.createGain();
      g.connect(this.out);
      this.gains[stem] = g;
    }
  }

  // Volumen base de cada stem; `instrumentStems` son los que tocan los jugadores
  setStemVolumes(instrumentStems) {
    this.instrumentStems = new Set(instrumentStems);
    this.muted ??= new Set();
    this.refreshVolumes();
  }

  // Aplica los volúmenes actuales de los ajustes (se puede llamar en plena canción)
  refreshVolumes() {
    this.applyVolumes();
    const t = this.ctx.currentTime;
    for (const [stem, g] of Object.entries(this.gains)) {
      const isInst = this.instrumentStems?.has(stem);
      const base = isInst ? settings.volume.instrument : settings.volume.song;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(isInst && this.muted?.has(stem) ? base * 0.08 : base, t, 0.02);
    }
  }

  setMuted(stems, muted) {
    const t = this.ctx.currentTime;
    this.muted ??= new Set();
    for (const stem of stems) {
      const g = this.gains[stem];
      if (!g) continue;
      if (muted === this.muted.has(stem)) continue;
      if (muted) this.muted.add(stem);
      else this.muted.delete(stem);
      const base = settings.volume.instrument;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(muted ? base * 0.08 : base, t, muted ? 0.015 : 0.03);
    }
  }

  // Tiempo del contexto que se está oyendo AHORA (compensa la latencia de salida)
  ctxTimeAtPerf(perf) {
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (perf - ts.performanceTime) / 1000;
    return this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0) + (perf - performance.now()) / 1000;
  }

  // Programa el arranque para que el segundo 0 de la canción suene en `perfTime`
  startAtPerf(perfTime) {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.startCtx = this.ctxTimeAtPerf(perfTime);
    this._schedule(0);
  }

  startWithLeadIn(leadIn) {
    this.startAtPerf(performance.now() + leadIn * 1000 + 60);
  }

  _schedule(offset) {
    this.stopSources();
    const minStart = this.ctx.currentTime + 0.02;
    for (const [stem, buf] of Object.entries(this.buffers)) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.gains[stem]);
      let when = this.startCtx + offset;
      let off = offset;
      if (off < 0) {
        // empieza antes del segundo 0 (cuenta atrás): espera en silencio
        when -= off;
        off = 0;
      }
      if (when < minStart) {
        off += minStart - when;
        when = minStart;
      }
      if (off < buf.duration) src.start(when, off);
      this.sources.push(src);
    }
    this.playing = true;
    this._smooth = null;
  }

  stopSources() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
      s.disconnect();
    }
    this.sources = [];
  }

  rawSongTime(perf = performance.now()) {
    return this.ctxTimeAtPerf(perf) - this.startCtx - settings.audioOffset / 1000;
  }

  // Reloj suavizado: avanza con performance.now() y se corrige poco a poco con el audio
  songTime(perf = performance.now()) {
    if (this.paused && !this._releasePause(perf)) return this.pausedAt;
    const raw = this.rawSongTime(perf);
    if (this._smooth === null || Math.abs(raw - (this._smooth + (perf - this._lastPerf) / 1000)) > 0.06) {
      this._smooth = raw;
    } else {
      const pred = this._smooth + (perf - this._lastPerf) / 1000;
      this._smooth = pred + (raw - pred) * 0.08;
    }
    this._lastPerf = perf;
    return this._smooth;
  }

  // Tiempo de canción para un evento ocurrido en `perf` (entre fotogramas)
  timeAt(perf) {
    if (this.paused && !this._releasePause(perf)) return this.pausedAt;
    if (this._smooth === null) return this.rawSongTime(perf);
    return this._smooth + (perf - this._lastPerf) / 1000;
  }

  // Tras resumeFrom(): el reloj sigue congelado hasta el instante programado
  _releasePause(perf) {
    if (this._resumePerf == null || perf < this._resumePerf) return false;
    this._resumePerf = null;
    this.paused = false;
    this._smooth = null;
    return true;
  }

  async pause() {
    if (this.paused && this._resumePerf == null) return;
    if (this.paused) {
      // pausa en plena cuenta atrás: se cancela el arranque programado
      this.stopSources();
      this._resumePerf = null;
    } else this.pausedAt = this.songTime();
    this.paused = true;
    await this.ctx.suspend();
  }

  // Retroceso al salir de la pausa: el audio se reactiva (para los efectos) pero la canción no suena
  async beginRewind() {
    this.stopSources();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  // Programa que la canción vuelva a sonar desde `songT` justo en `perfWhen`
  resumeFrom(songT, perfWhen) {
    const offs = settings.audioOffset / 1000;
    this.startCtx = this.ctxTimeAtPerf(perfWhen) - songT - offs;
    this._schedule(songT + offs);
    this.paused = true;
    this.pausedAt = songT;
    this._resumePerf = perfWhen;
  }

  async resume() {
    if (!this.paused) return;
    this._resumePerf = null;
    await this.ctx.resume();
    this.paused = false;
    this._smooth = null;
  }

  stop() {
    this.stopSources();
    this.playing = false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.paused = false;
    this.out.disconnect();
    this.sfxOut.disconnect();
  }

  // ---- Efectos de sonido ----
  // Reproduce un sonido de public/sfx; devuelve false si no está disponible (para usar el sintetizado)
  playSample(name, vol = 1, delay = 0) {
    const list = loadedSamples.get(name);
    if (!list?.length) return false;
    let buf = list[0];
    if (list.length > 1) {
      // variante aleatoria sin repetir la anterior
      let k;
      do k = Math.floor(Math.random() * list.length); while (list.length > 1 && k === lastVariant.get(name));
      lastVariant.set(name, k);
      buf = list[k];
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.sfxOut);
    src.start(this.ctx.currentTime + delay);
    return true;
  }

  // Al perder una racha: nota fallida de guitarra + "bajón" del multiplicador
  loseStreak(strength = 1) {
    if (!this.playSample('bad_note', 0.9)) {
      this.detunedGuitar(strength);
      return;
    }
    this.playSample('ui_lose_multiplier', 0.55);
  }

  // Frase de Star Power completada (o barra lista para activar)
  spAwarded(ready) {
    if (ready ? this.playSample('star_available', 0.85) : this.playSample('sp_awarded', 0.9)) return;
    this.lightning();
  }

  spDeployed() {
    if (!this.playSample('star_deployed', 0.85)) this.sfx('sp');
  }

  spReleased() {
    this.playSample('star_release', 0.75);
  }

  // ---- Efectos de sonido sintetizados (respaldo si faltan los archivos) ----
  // Nota fallida de guitarra eléctrica (como en Guitar Hero / Clone Hero):
  // dos cuerdas disonantes + raspado de púa, pasadas por distorsión y "caja" de amplificador.
  detunedGuitar(strength = 1) {
    const ctx = this.ctx;
    const bank = missBank(ctx);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = bank.buffers[Math.floor(Math.random() * bank.buffers.length)];
    // la cuerda se "afloja": baja un poco la afinación mientras suena
    src.playbackRate.setValueAtTime(1, t);
    src.playbackRate.linearRampToValueAtTime(0.955, t + 0.32);
    const drive = ctx.createGain();
    drive.gain.value = 2.2;
    const shaper = ctx.createWaveShaper();
    shaper.curve = bank.curve;
    shaper.oversample = '4x';
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 110;
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 850;
    mid.gain.value = 5;
    mid.Q.value = 0.9;
    const cab = ctx.createBiquadFilter();
    cab.type = 'lowpass';
    cab.frequency.value = 3200;
    cab.Q.value = 0.8;
    const env = ctx.createGain();
    const vol = 0.32 * (0.7 + 0.3 * Math.min(1, strength));
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    env.gain.setValueAtTime(vol, t + 0.09);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    src.connect(drive).connect(shaper).connect(hp).connect(mid).connect(cab).connect(env).connect(this.sfxOut);
    src.start(t);
    src.stop(t + 0.6);
  }

  // Rayo + trueno al completar una frase de Star Power
  lightning() {
    const ctx = this.ctx;
    const bank = missBank(ctx);
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(this.sfxOut);
    // chasquido eléctrico
    const crack = ctx.createBufferSource();
    crack.buffer = bank.noise;
    const chp = ctx.createBiquadFilter();
    chp.type = 'highpass';
    chp.frequency.value = 1800;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.7, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    crack.connect(chp).connect(cg).connect(out);
    crack.start(t, 0, 0.1);
    // descarga que baja de tono
    const zap = ctx.createOscillator();
    zap.type = 'sawtooth';
    zap.frequency.setValueAtTime(2600, t);
    zap.frequency.exponentialRampToValueAtTime(90, t + 0.22);
    const zg = ctx.createGain();
    zg.gain.setValueAtTime(0.13, t);
    zg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    zap.connect(zg).connect(out);
    zap.start(t);
    zap.stop(t + 0.26);
    // trueno grave
    const rum = ctx.createBufferSource();
    rum.buffer = bank.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t + 0.03);
    lp.frequency.exponentialRampToValueAtTime(140, t + 0.5);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.9, t + 0.05);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    rum.connect(lp).connect(rg).connect(out);
    rum.start(t + 0.02);
    rum.stop(t + 1.35);
    // brillo de "energía ganada"
    [1760, 2637, 3520].forEach((f, k) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      const st = t + 0.04 + k * 0.05;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.09, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.55);
      o.connect(g).connect(out);
      o.start(st);
      o.stop(st + 0.6);
    });
  }

  sfx(type) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(this.sfxOut);
    if (type === 'miss') {
      const len = 0.12;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 1.5;
      src.connect(f).connect(g);
      g.gain.value = 0.9;
      src.start(t);
    } else if (type === 'sp') {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.62);
    } else if (type === 'phrase') {
      this.lightning();
    } else if (type === 'tick') {
      const o = ctx.createOscillator();
      o.frequency.value = 1000;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.09);
    }
  }
}

// Sonidos de efectos en public/sfx (los de Clone Hero convertidos a OGG). Si alguno falta,
// el juego usa los sintetizados.
const SAMPLE_FILES = {
  bad_note: ['bad_note1', 'bad_note2', 'bad_note3', 'bad_note4', 'bad_note5'],
  ui_lose_multiplier: ['ui_lose_multiplier'],
  sp_awarded: ['sp_awarded'],
  star_available: ['star_available'],
  star_deployed: ['star_deployed'],
  star_release: ['star_release'],
  rewind: ['ui_rewind_highway_sound'],
  ripple: ['notes_ripple_up_01'],
};
const loadedSamples = new Map();
const lastVariant = new Map();
let samplesPromise = null;

export function sampleBank(ctx) {
  samplesPromise ??= Promise.all(Object.entries(SAMPLE_FILES).map(async ([name, files]) => {
    const bufs = await Promise.all(files.map(async (f) => {
      try {
        const res = await fetch(`sfx/${f}.ogg`);
        if (!res.ok) return null;
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        return null;
      }
    }));
    loadedSamples.set(name, bufs.filter(Boolean));
  }));
  return samplesPromise;
}

// Vista previa de canciones en el menú (streaming, sin decodificar todo)
export class PreviewPlayer {
  constructor() {
    this.el = new Audio();
    this.el.preload = 'auto';
    this.timer = null;
    this.fade = null;
  }

  // opciones: loop (los 30 s de Apple se repiten), onError (la URL ya no sirve)
  play(url, startSec, { loop = false, onError = null } = {}) {
    this.stop();
    this.timer = setTimeout(() => {
      this.el.loop = loop;
      this.el.onerror = onError && (() => {
        this.el.onerror = null;
        onError();
      });
      this.el.src = url;
      this.el.volume = 0;
      const begin = () => {
        try {
          this.el.currentTime = Math.max(0, startSec);
        } catch {}
        this.el.play().catch(() => {});
        const target = settings.volume.master * settings.volume.preview;
        clearInterval(this.fade);
        this.fade = setInterval(() => {
          this.el.volume = Math.min(target, this.el.volume + target / 20);
          if (this.el.volume >= target) clearInterval(this.fade);
        }, 40);
      };
      this.el.addEventListener('loadedmetadata', begin, { once: true });
    }, 350);
  }

  stop() {
    clearTimeout(this.timer);
    clearInterval(this.fade);
    this.el.onerror = null;
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
  }
}

// ---------- Síntesis de los sonidos de fallo y del rayo ----------
const banks = new WeakMap();

function pluck(out, sr, freq, startSec, amp, damping) {
  const n = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(n);
  for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  const s0 = Math.floor(startSec * sr);
  for (let i = s0; i < out.length; i++) {
    const a = ring[idx];
    const b = ring[(idx + 1) % n];
    ring[idx] = (a + b) * 0.5 * damping;
    idx = (idx + 1) % n;
    out[i] += a * amp;
  }
}

export function missBank(ctx) {
  let bank = banks.get(ctx);
  if (bank) return bank;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.6);
  const roots = [82.41, 98, 110, 123.47, 146.83];
  const buffers = roots.map((root) => {
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    // intervalo disonante: segunda menor o tritono, ligeramente desafinado
    const ratio = (Math.random() < 0.6 ? 1.0595 : 1.4142) * (1 + (Math.random() - 0.5) * 0.02);
    pluck(d, sr, root, 0, 0.5, 0.9935);
    pluck(d, sr, root * ratio, 0.006, 0.42, 0.993);
    pluck(d, sr, root * 2.02, 0.011, 0.18, 0.989);
    // raspado de la púa sobre la cuerda
    let prev = 0;
    for (let i = 0; i < sr * 0.03; i++) {
      const w = Math.random() * 2 - 1;
      d[i] += (w - prev) * 0.35 * (1 - i / (sr * 0.03));
      prev = w;
    }
    return buf;
  });
  const curve = new Float32Array(2048);
  const k = 28;
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  const noise = ctx.createBuffer(1, Math.floor(sr * 1.4), sr);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  bank = { buffers, curve, noise };
  banks.set(ctx, bank);
  return bank;
}
