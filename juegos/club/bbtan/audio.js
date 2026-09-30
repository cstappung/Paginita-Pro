(function (root) {
  'use strict';

  // The clip is prefetched, but audio only starts after the player's first gesture.
  const clipBytes = typeof fetch === 'function'
    ? fetch('assets/nice.mp3').then(response => response.ok ? response.arrayBuffer() : null).catch(() => null)
    : Promise.resolve(null);
  let enabled = false, context, master, effects, clearBus, reverb, clipBuffer, fallbackClip;
  let lastHit = -1, lastBreak = -1, clearSource;

  function makeReverb() {
    const length = Math.floor(context.sampleRate * 1.55);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    let seed = 2026;
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        const noise = ((seed >>> 0) / 2147483648) - 1;
        data[i] = noise * Math.pow(1 - i / length, 2.6);
      }
    }
    const convolver = context.createConvolver();
    convolver.buffer = impulse;
    const predelay = context.createDelay(.1); predelay.delayTime.value = .032;
    const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 5200;
    const wet = context.createGain(); wet.gain.value = .25;
    predelay.connect(convolver); convolver.connect(lowpass); lowpass.connect(wet); wet.connect(clearBus);
    return predelay;
  }

  function unlock() {
    if (!enabled) return;
    try {
      if (!context) {
        const AudioContext = root.AudioContext || root.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext();
        master = context.createGain(); master.gain.value = .88;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -12; limiter.knee.value = 12; limiter.ratio.value = 5;
        limiter.attack.value = .004; limiter.release.value = .18;
        master.connect(limiter); limiter.connect(context.destination);
        effects = context.createGain(); effects.connect(master);
        clearBus = context.createGain(); clearBus.connect(master);
        reverb = makeReverb();
        clipBuffer = clipBytes.then(bytes => bytes ? context.decodeAudioData(bytes) : null).catch(() => null);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* The game remains playable without Web Audio. */ }
  }

  function setEnabled(value, activate = true) {
    enabled = value;
    if (enabled && activate) unlock();
    if (master && context) master.gain.setTargetAtTime(enabled ? .88 : 0, context.currentTime, .015);
    if (!enabled && clearSource) { try { clearSource.stop(); } catch {} clearSource = null; }
    if (!enabled && fallbackClip) fallbackClip.pause();
  }

  function note(frequency, duration, type, volume, delay = 0, endFrequency = frequency * .72) {
    if (!enabled || !context || context.state !== 'running') return;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), at + duration);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + Math.min(.012, duration / 4));
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain); gain.connect(effects);
    oscillator.start(at); oscillator.stop(at + duration + .01);
  }

  // Una burbuja es un seno cuya altura sube deprisa mientras se apaga: ese
  // «bloop» ascendente es lo que el oído reconoce como burbuja. Cada choque
  // varía un poco la altura para que una ráfaga de bolas no suene a metralleta.
  function bubble(frequency, volume, delay = 0) {
    if (!enabled || !context || context.state !== 'running') return;
    const at = context.currentTime + delay, duration = .085;
    const oscillator = context.createOscillator(), gain = context.createGain(), filter = context.createBiquadFilter();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 2.6, at + duration * .8);
    filter.type = 'lowpass'; filter.frequency.value = 2600; filter.Q.value = 3;
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(filter); filter.connect(gain); gain.connect(effects);
    oscillator.start(at); oscillator.stop(at + duration + .01);
  }
  let noiseBuffer;
  function noise(duration, from, to, volume, delay = 0) {
    if (!enabled || !context || context.state !== 'running') return;
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * .4), context.sampleRate);
      const data = noiseBuffer.getChannelData(0); let seed = 7;
      for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; data[i] = ((seed >>> 0) / 2147483648) - 1; }
    }
    const at = context.currentTime + delay;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'bandpass'; filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(from, at); filter.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(effects);
    source.start(at); source.stop(at + duration + .01);
  }

  function hit(hp) {
    if (!context || context.currentTime - lastHit < .045) return;
    lastHit = context.currentTime;
    bubble(300 + hp % 12 * 18 + Math.random() * 60, .07);
  }
  // Reventar un cuadrado es otra cosa: un estallido de ruido que cae de
  // agudo a grave, un golpe sordo debajo y un arpegio de onda cuadrada que
  // baja, a lo consola de 8 bits. Sube un poco con la racha.
  function broken(combo) {
    if (!context || context.currentTime - lastBreak < .065) return;
    lastBreak = context.currentTime;
    const up = Math.pow(1.04, Math.min(combo, 12));
    noise(.16, 3200, 380, .09);
    note(170, .12, 'triangle', .07, 0, 55);
    [880, 660, 494].forEach((frequency, i) => note(frequency * up, .05, 'square', .018, .012 + i * .032, frequency * up * .94));
  }
  function pickup(kind) {
    const base = kind === 'ball' ? 620 : kind === 'scatter' ? 520 : 760;
    note(base, .10, 'sine', .046, 0, base * 1.2);
    note(base * 1.5, .15, 'sine', .028, .07, base * 1.8);
  }
  function combo(level) {
    [0, 1, 2].forEach((step) => note(520 * Math.pow(1.22, step + level - 2), .20, 'triangle', .035, step * .06));
  }
  function launch() { note(390, .09, 'triangle', .033, 0, 320); }
  function gameOver() {
    note(250, .30, 'triangle', .055, 0, 120);
    note(150, .38, 'sine', .04, .12, 75);
  }

  function clear() {
    if (!enabled) return;
    unlock();
    if (!context || context.state !== 'running') return;
    const at = context.currentTime;
    effects.gain.cancelScheduledValues(at);
    effects.gain.setValueAtTime(effects.gain.value, at);
    effects.gain.linearRampToValueAtTime(.22, at + .08);
    effects.gain.setValueAtTime(.22, at + 1.65);
    effects.gain.linearRampToValueAtTime(1, at + 2.1);
    [659, 830, 988].forEach((frequency, i) => note(frequency, .55, 'sine', .035, i * .07, frequency * 1.08));
    const requested = performance.now();
    clipBuffer?.then(buffer => {
      if (!enabled || context.state !== 'running' || performance.now() - requested > 1200) return;
      if (!buffer) {
        // File URLs often block fetch; this copy already contains a soft reverb tail.
        fallbackClip ||= new Audio('assets/nice-wet.mp3');
        fallbackClip.volume = .58; fallbackClip.currentTime = 0;
        fallbackClip.play().catch(() => {});
        return;
      }
      if (clearSource) { try { clearSource.stop(); } catch {} }
      const source = context.createBufferSource(); clearSource = source; source.buffer = buffer;
      const dry = context.createGain(); dry.gain.value = .72;
      const send = context.createGain(); send.gain.value = .62;
      source.connect(dry); dry.connect(clearBus);
      source.connect(send); send.connect(reverb);
      source.onended = () => { if (clearSource === source) clearSource = null; source.disconnect(); dry.disconnect(); send.disconnect(); };
      // The supplied meme has about 0.8 s of silence before the spoken phrase.
      source.start(context.currentTime + .06, .76, 1.56);
    });
  }

  /* The song («Rebote», `bbtan` in the shared songbook) runs on the same
     Chip.Reproductor as the rest of the site, into its own bus so it sits
     under the effects and can duck while the NICE! clip plays. */
  let player = null, musicBus = null, musicTimer = null, musicOn = false, pace = 1;
  function tickMusic() {
    if (!player || !enabled || !context || context.state !== 'running') return;
    player.tempo = pace; player.tick(.2);
  }
  function music(on, round = 1) {
    pace = 1 + Math.min(.1, Math.max(0, round - 1) * .0025);
    if (player) { player.capas.arp = round >= 3 ? 1 : 0; player.capas.bat = round >= 6 ? 1 : .55; }
    if (on === musicOn) return;
    musicOn = on;
    if (!on) { clearInterval(musicTimer); musicTimer = null; if (player) player.detener(); return; }
    unlock();
    if (!context || !root.Chip || !root.Temas || !root.Temas.temas.bbtan) { musicOn = false; return; }
    if (!player) {
      musicBus = context.createGain(); musicBus.gain.value = .5; musicBus.connect(master);
      player = new root.Chip.Reproductor(context, musicBus, root.Temas.temas.bbtan);
      player.capas.arp = round >= 3 ? 1 : 0; player.capas.bat = round >= 6 ? 1 : .55;
    }
    if (round <= 1) player.reinicia(); else player.detener();
    musicTimer = setInterval(tickMusic, 75); tickMusic();
  }
  function duck(seconds = 1.7) {
    if (!musicBus || !context) return;
    const g = musicBus.gain, t = context.currentTime;
    try { g.cancelScheduledValues(t); g.setTargetAtTime(.12, t, .05); g.setTargetAtTime(.5, t + seconds, .35); } catch {}
  }

  root.BBTANAudio = { setEnabled, unlock, launch, hit, broken, pickup, combo, gameOver, clear, music, duck };
})(globalThis);
