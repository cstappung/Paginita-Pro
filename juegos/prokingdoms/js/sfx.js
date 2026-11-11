// Efectos de sonido con Web Audio. Desde pk-38 suenan grabaciones (sfx/*.mp3, hechas con ElevenLabs); mientras un
// archivo no llega, o si no carga, suena el sintetizado de antes, así nunca queda mudo. Se silencian con M.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U;
  const X = (PK.Sfx = { on: U.store.get('pk_sound') !== '0' });
  let ctx = null, master = null, out = null; // out: adónde va el sonido que se arma ahora (master o un canal con paneo)
  const last = {};

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      cargar();
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
    o.connect(g); g.connect(out || master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(at, dur, vol, freq) {
    const t = ctx.currentTime + at, n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 2000; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(out || master);
    s.start(t);
  }
  // ---------- grabaciones (pk-38) ----------
  // Ganancia de cada archivo: medida contra el sintetizado (la ventana de 100 ms más fuerte de cada uno), para que
  // ninguno suene más fuerte que antes, por 1.25 porque una grabación se oye más «llena». Los amb-* los toca musica.js.
  const GAN = { chop: 0.0226, pick: 0.0337, hammer: 0.0331, dig: 0.0127, reap: 0.0185, deposit: 0.0334, build: 0.0928, level: 0.0732,
    era: 0.0781, quest: 0.0718, coin: 0.1296, event: 0.1114, cuerno: 0.0554, arrow: 0.0382, hit: 0.038, espada: 0.0252, boom: 0.0465,
    fuego: 0.0363, magia: 0.0346, victoria: 0.1128, derrota: 0.0382, howl: 0.0593,
    'amb-olas': 0.0073, 'amb-viento': 0.0092, 'amb-grillo': 0.0081, 'amb-pajaro': 0.014, 'amb-gaviota': 0.0085, 'amb-obra': 0.0092,
    'amb-yunque': 0.0216, 'amb-sierra': 0.0081, 'amb-gente': 0.0066, 'amb-hacha': 0.0129, 'amb-pico': 0.0093 };
  // (sierra y gente, ×1.5 y ×2 sobre lo medido: el murmullo de antes casi no se oía)
  // level (pk-40, reporte de un jugador): la grabación de ElevenLabs duraba 1,6 s, con ruido y notas que chocaban, y
  // suena en cada mejora. Ahora es una campanita hecha por código (un golpecito de madera y do-mi-sol-do, 0,95 s),
  // medida igual que las demás.
  const ARCHIVO = { 'amb-hacha': 'chop', 'amb-pico': 'pick' }; // el ambiente reusa los golpes de los aldeanos
  // los que se repiten mucho cambian un poco de altura en cada golpe, para que 20 aldeanos no suenen como uno
  const VARIA = { chop: 1, pick: 1, hammer: 1, dig: 1, reap: 1, deposit: 1, hit: 1, espada: 1, arrow: 1, coin: 1, 'amb-hacha': 1, 'amb-pico': 1, 'amb-yunque': 1, 'amb-pajaro': 1, 'amb-grillo': 1 };
  const VOCES = 4; // tope de copias sonando a la vez de un mismo archivo (la hoz dura 1,3 s y se golpea más seguido)
  const bufs = {}, sonando = {};
  const VER = ((document.currentScript && /[?&]v=([^&]+)/.exec(document.currentScript.src)) || [])[1] || '';
  function cargar() {
    const nombres = Object.keys(GAN).filter(n => !ARCHIVO[n]);
    let i = 0;
    // de a 4, sin apuro: el juego ya está andando y mientras tanto suena lo sintetizado
    const sig = () => {
      const n = nombres[i++];
      if (!n) return;
      fetch('sfx/' + n + '.mp3' + (VER ? '?v=' + VER : ''))
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then(b => new Promise((ok, mal) => ctx.decodeAudioData(b, ok, mal)))
        .then(b => { bufs[n] = b; })
        .catch(() => { /* queda el sintetizado */ })
        .then(sig);
    };
    for (let k = 0; k < 4; k++) sig();
  }
  // toca la grabación «name» en «destino» (o out/master); false si todavía no está, para usar el sintetizado
  function muestra(name, destino, vol, cuando) {
    const b = ctx && bufs[ARCHIVO[name] || name];
    if (!b) return false;
    if ((sonando[name] || 0) >= VOCES) return true;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = b;
    if (VARIA[name]) s.playbackRate.value = 0.93 + Math.random() * 0.14;
    g.gain.value = GAN[name] * 1.25 * (vol == null ? 1 : vol);
    s.connect(g); g.connect(destino || out || master);
    sonando[name] = (sonando[name] || 0) + 1;
    s.onended = () => { sonando[name]--; try { g.disconnect(); } catch (e) { /* ya estaba */ } };
    s.start(cuando || ctx.currentTime);
    return true;
  }
  X.muestra = (name, destino, vol, cuando) => !!(ctx && muestra(name, destino, vol, cuando));
  X.duracion = name => { const b = bufs[ARCHIVO[name] || name]; return b ? b.duration : 0; };

  const GAP = { level: 0.6, deposit: 0.15, arrow: 0.12, hit: 0.1, chop: 0.09, pick: 0.09, hammer: 0.08, dig: 0.12, reap: 0.12, espada: 0.08, boom: 0.15, magia: 0.25, fuego: 0.4 };

  // pk-37: un sonido con lugar (PK.Render.sonarEn): vol 0..1 y pan -1..1. El tope de repetición no deja que uno
  // lejano y bajito le quite el turno a uno cerca: si el nuevo suena más fuerte que el último, pasa igual.
  const lastVol = {};
  X.playEn = function (name, vol, pan) {
    if (!X.on || !ctx || ctx.state !== 'running' || (PK.Game && PK.Game.offline) || !(vol > 0)) return;
    const now = performance.now() / 1000;
    if (last[name] && now - last[name] < (GAP[name] || 0.05) && vol <= (lastVol[name] || 0) * 1.4) return;
    const g = ctx.createGain();
    g.gain.value = Math.min(1.2, vol);
    let p = null;
    if (ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.85, Math.min(0.85, pan || 0)); g.connect(p); p.connect(master); } else g.connect(master);
    out = g;
    try { sonido(name, now); } finally { out = null; }
    lastVol[name] = vol;
    setTimeout(() => { try { g.disconnect(); if (p) p.disconnect(); } catch (e) { /* ya estaba */ } }, 1500 + X.duracion(name) * 1000);
  };
  X.play = function (name) {
    if (!X.on || !ctx || ctx.state !== 'running' || (PK.Game && PK.Game.offline)) return;
    const now = performance.now() / 1000;
    if (last[name] && now - last[name] < (GAP[name] || 0.05)) return;
    lastVol[name] = 1;
    sonido(name, now);
  };
  function sonido(name, now) {
    last[name] = now;
    if (muestra(name)) return;
    switch (name) {
      case 'deposit': tone(520, 0, 0.06, 'triangle', 0.035, 780); break;
      case 'coin': tone(988, 0, 0.08, 'square', 0.04); tone(1319, 0.07, 0.16, 'square', 0.04); break;
      case 'build': [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.14, 'square', 0.045)); break;
      case 'level': tone(190, 0, 0.06, 'sine', 0.05, 140); [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.03 + i * 0.075, 0.45, 'triangle', i === 3 ? 0.03 : 0.045)); break;
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
      case 'cuerno': tone(196, 0, 0.55, 'sawtooth', 0.045, 233); tone(233, 0.6, 0.9, 'sawtooth', 0.045, 175); break; // incursión de bandidos
      // batalla en vivo (batalla.js)
      case 'espada': noise(0, 0.05, 0.05, 5200); tone(1400 + Math.random() * 500, 0, 0.07, 'square', 0.02, 900); break;
      case 'boom': noise(0, 0.35, 0.09, 220); tone(110, 0, 0.3, 'sine', 0.08, 40); break;
      case 'fuego': noise(0, 0.7, 0.07, 700); noise(0.05, 0.6, 0.05, 1600); tone(90, 0, 0.6, 'sawtooth', 0.03, 60); break;
      case 'magia': [1319, 1568, 1976].forEach((f, i) => tone(f, i * 0.05, 0.16, 'triangle', 0.025)); break;
      case 'victoria': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.22, 'square', 0.045)); tone(784, 0.55, 0.2, 'square', 0.045); tone(1047, 0.72, 0.7, 'square', 0.05); noise(0.7, 0.4, 0.04, 6000); break;
      case 'derrota': [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.22, 0.35, 'triangle', 0.05)); break;
      case 'howl': tone(300, 0, 0.5, 'sine', 0.06, 620); tone(620, 0.5, 0.9, 'sine', 0.06, 380); break;
    }
  }
  // para la música (musica.js): el mismo contexto y la misma salida, así M y el volumen la alcanzan
  X.ac = () => (ctx ? ac() : null); // sin crearlo: lo crea el primer toque del jugador
  X.salida = () => master;
  X.toggle = function () {
    X.on = !X.on;
    U.store.set('pk_sound', X.on ? '1' : '0');
    if (X.on) { ac(); X.play('coin'); }
    return X.on;
  };
})();
