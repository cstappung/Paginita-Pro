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
    if (!enabled && root.BBTANVoz) root.BBTANVoz.calla();
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

  /* La música la compone musica.js paso a paso mirando el tablero (mood):
     tensa cuando los bloques se acercan al suelo, tranquila cuando quedan
     pocos, y desde la ronda 100 baja al abismo. Va a su propio bus para
     quedar bajo los efectos y agacharse mientras suena el NICE!. */
  let player = null, musicBus = null, musicTimer = null, musicOn = false, lastMood = null;
  function tickMusic() {
    if (!player || !enabled || !context || context.state !== 'running') return;
    player.tick(.2);
  }
  function mood(o) {
    lastMood = o;
    if (player) player.animo(o);
  }
  function music(on, round = 1) {
    if (lastMood) lastMood = Object.assign({}, lastMood, { ronda: round });
    else lastMood = { ronda: round, filas: 8, bloques: 0 };
    if (player) player.animo(lastMood);
    if (on === musicOn) return;
    musicOn = on;
    if (!on) { clearInterval(musicTimer); musicTimer = null; if (player) player.detener(); return; }
    unlock();
    if (!context || !root.Chip || !root.BBTANMusica) { musicOn = false; return; }
    if (!player) {
      musicBus = context.createGain(); musicBus.gain.value = .5; musicBus.connect(master);
      player = new root.BBTANMusica.Motor(context, musicBus);
      player.animo(lastMood);
    }
    if (round <= 1) player.reinicia(); else player.detener();
    musicTimer = setInterval(tickMusic, 75); tickMusic();
  }
  function duck(seconds = 1.7) {
    if (!musicBus || !context) return;
    const g = musicBus.gain, t = context.currentTime;
    try { g.cancelScheduledValues(t); g.setTargetAtTime(.12, t, .05); g.setTargetAtTime(.5, t + seconds, .35); } catch {}
  }

  /* Cada 50 rondas habla el juego (voz.js). Bajo la voz va una cama que dice
     lo mismo sin palabras: un arpegio de feria cuando está contento, pitidos
     que se cortan cuando se rompe, y en el susurro un aliento de ruido que
     respira y un zumbido grave y desafinado. La música se agacha mientras. */
  function anuncio(ronda, partes) {
    const V = root.BBTANVoz;
    if (!enabled || !V) return;
    unlock();
    V.decir(partes);
    if (!context || context.state !== 'running') return;
    const dur = Math.min(14, V.duracion(partes) + 1), animo = V.animo(ronda);
    duck(dur);
    if (animo === 'alegre') {
      [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, .22, 'square', .028, i * .07, f * 1.02));
      note(1568, .5, 'triangle', .03, .4, 1760);
    } else if (animo === 'roto') {
      for (let i = 0; i < 16; i++) {
        const f = 120 + Math.random() * 1800;
        note(f, .03 + Math.random() * .09, Math.random() < .5 ? 'square' : 'sawtooth', .02, Math.random() * dur * .85, f * (Math.random() < .5 ? .3 : 2.5));
      }
      noise(.3, 4000, 300, .05, .1);
    } else susurro(dur, V.nivel(ronda) - 4);
  }
  function susurro(dur, hondo) {
    noise(.01, 1000, 1000, .0001); // asegura noiseBuffer
    const at = context.currentTime, fin = at + dur, bus = context.createGain();
    bus.gain.setValueAtTime(.0001, at); bus.gain.exponentialRampToValueAtTime(1, at + .8);
    bus.gain.setValueAtTime(1, fin - 1.2); bus.gain.exponentialRampToValueAtTime(.0001, fin);
    bus.connect(effects); bus.connect(reverb);
    // El aliento: ruido en banda que entra y sale como una respiración.
    const aire = context.createBufferSource(), banda = context.createBiquadFilter(), pecho = context.createGain();
    aire.buffer = noiseBuffer; aire.loop = true;
    banda.type = 'bandpass'; banda.frequency.value = 1500 - 250 * hondo; banda.Q.value = 1.1;
    pecho.gain.setValueAtTime(.0001, at);
    for (let t = at, k = 0; t < fin; t += 1.7, k++) {
      pecho.gain.exponentialRampToValueAtTime(k % 2 ? .05 : .09, t + .7);
      pecho.gain.exponentialRampToValueAtTime(.006, t + 1.6);
    }
    aire.connect(banda); banda.connect(pecho); pecho.connect(bus);
    aire.start(at); aire.stop(fin + .05);
    // El zumbido: dos sierras desafinadas bajo un paso bajo, y un sub.
    const grave = context.createBiquadFilter(), zumba = context.createGain();
    grave.type = 'lowpass'; grave.frequency.value = 190; zumba.gain.value = .07 + .015 * hondo;
    grave.connect(zumba); zumba.connect(bus);
    for (const [f, tipo] of [[55 - 4 * hondo, 'sawtooth'], [55.9 - 4 * hondo, 'sawtooth'], [36, 'sine']]) {
      const o = context.createOscillator(); o.type = tipo; o.frequency.value = f;
      o.connect(tipo === 'sine' ? zumba : grave); o.start(at); o.stop(fin + .05);
    }
  }
  function calla() { if (root.BBTANVoz) root.BBTANVoz.calla(); }

  root.BBTANAudio = { setEnabled, unlock, launch, hit, broken, pickup, combo, gameOver, clear, music, mood, duck, anuncio, calla };
})(globalThis);
