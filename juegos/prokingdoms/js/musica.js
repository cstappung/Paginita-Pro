// Música y ambiente generados con Web Audio (U5 de la Fase 6), sin archivos. Pasa por la salida de sfx.js, así que la
// tecla M la calla igual que a los efectos, y el volumen compartido de Juegos (volumen.js) también la alcanza.
// Tiene su propio volumen en Opciones (pk_musica y pk_ambiente, 0–100).
//
// Cómo suena: un compás de 8 corcheas, frases de 4 compases con un acorde por compás. La melodía es un motivo
// sembrado por frase (se repite con variación, así que se reconoce) que cae en notas del acorde en los tiempos
// fuertes. Cada grupo de eras tiene su modo, su tempo y sus timbres; de noche todo baja de tempo y de octava y
// hay menos notas. En batalla (la vista de batalla o bandidos atacando) suena un tema rápido con tambores, y con
// un jefe en el campo se le suman platillos y sube el tempo. En el Archipiélago suena su propio modo.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U;
  const M = (PK.Musica = {});
  const acota = v => Math.max(0, Math.min(100, Math.round(Number(v)) || 0));
  const lee = (k, d) => { const v = U.store.get(k); return v === null || v === undefined || v === '' ? d : acota(v); };
  let vol = lee('pk_musica', 45), volAmb = lee('pk_ambiente', 60);

  const ESC = {
    dorico: [0, 2, 3, 5, 7, 9, 10], eolico: [0, 2, 3, 5, 7, 8, 10], jonico: [0, 2, 4, 5, 7, 9, 11],
    lidio: [0, 2, 4, 6, 7, 9, 11], armonica: [0, 2, 3, 5, 7, 8, 11],
  };
  // raiz: nota MIDI de la tónica de la melodía · prog: grados del acorde de cada compás (0 = tónica)
  const MODOS = {
    rustico: { raiz: 62, esc: 'dorico', bpm: 88, mel: 'triangle', pad: 'triangle', progs: [[0, 3, 4, 0], [0, 6, 3, 4], [0, 2, 3, 4]], dens: 0.55, brillo: 2600 },
    medieval: { raiz: 57, esc: 'eolico', bpm: 96, mel: 'square', pad: 'triangle', progs: [[0, 5, 6, 0], [0, 3, 6, 4], [0, 5, 3, 4]], dens: 0.6, brillo: 1900 },
    reino: { raiz: 60, esc: 'jonico', bpm: 104, mel: 'sawtooth', pad: 'triangle', progs: [[0, 4, 5, 3], [0, 3, 4, 4], [0, 5, 3, 4]], dens: 0.6, brillo: 1700 },
    imperio: { raiz: 64, esc: 'armonica', bpm: 80, mel: 'sine', pad: 'sine', progs: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 6, 5, 4]], dens: 0.5, brillo: 3200 },
    mar: { raiz: 67, esc: 'lidio', bpm: 72, mel: 'sine', pad: 'triangle', progs: [[0, 1, 0, 4], [0, 5, 1, 0], [0, 3, 1, 4]], dens: 0.42, brillo: 2800 },
    batalla: { raiz: 52, esc: 'armonica', bpm: 132, mel: 'square', pad: 'sawtooth', progs: [[0, 5, 6, 4], [0, 0, 5, 4], [0, 3, 5, 4]], dens: 0.5, brillo: 1500, tambor: true },
  };

  let ctx = null, sal = null, bus = null, amb = null, filtro = null, timer = null;
  let modo = null, noche = false, jefe = false, prox = 0, paso = 0, frase = null, fraseN = 0, silencioHasta = 0;
  let tAmb = 0;

  function armar() {
    if (ctx) return true;
    const X = PK.Sfx;
    if (!X || !X.ac) return false;
    const c = X.ac();
    if (!c || !X.salida()) return false;
    ctx = c;
    bus = ctx.createGain(); bus.gain.value = 0;
    filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 2600; filtro.Q.value = 0.3;
    // un eco corto da espacio sin reverberación (que costaría un convolver)
    const eco = ctx.createDelay(1), vuelta = ctx.createGain(), mojado = ctx.createGain();
    eco.delayTime.value = 0.31; vuelta.gain.value = 0.28; mojado.gain.value = 0.22;
    bus.connect(filtro); filtro.connect(X.salida());
    filtro.connect(eco); eco.connect(vuelta); vuelta.connect(eco); eco.connect(mojado); mojado.connect(X.salida());
    amb = ctx.createGain(); amb.gain.value = volAmb / 100 * 0.6; amb.connect(X.salida());
    sal = X.salida();
    return true;
  }
  const nivel = () => Math.pow(vol / 100, 1.4) * 0.55;

  // ---------- voces ----------
  function nota(midi, t, dur, onda, v, ataque, destino) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = onda; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const a = ataque || 0.01;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino || bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let ruidoBuf = null;
  function ruido(t, dur, v, frec, tipo, destino, ataque) {
    if (!ruidoBuf) {
      const n = ctx.sampleRate * 2; ruidoBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = ruidoBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruidoBuf; s.loop = true; f.type = tipo || 'bandpass'; f.frequency.value = frec; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (ataque || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(destino || bus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function bombo(t, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.3);
  }

  // ---------- composición ----------
  const grado = (m, g) => { const e = ESC[m.esc], o = Math.floor(g / e.length); return e[((g % e.length) + e.length) % e.length] + 12 * o; };
  function nuevaFrase() {
    const m = MODOS[modo], r = U.rng(U.strHash(modo + ':' + fraseN++ + ':' + Math.floor(Date.now() / 600000)));
    const prog = m.progs[Math.floor(r() * m.progs.length)];
    const dens = m.dens * (noche ? 0.6 : 1);
    // motivo de 8 corcheas: null = silencio; si no, cuántos grados sobre la nota del acorde
    const motivo = [];
    let g = 0;
    for (let i = 0; i < 8; i++) {
      if (i === 0 || i === 4) { motivo.push(r() < 0.5 ? 0 : r() < 0.5 ? 2 : 4); g = motivo[i]; continue; }
      if (r() > dens) { motivo.push(null); continue; }
      g += [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)];
      g = Math.max(-2, Math.min(7, g));
      motivo.push(g);
    }
    const largos = motivo.map((x, i) => (x === null ? 0 : motivo.slice(i + 1).findIndex(y => y !== null) + 1 || 8 - i));
    return { prog, motivo, largos, r };
  }
  function tocarPaso(t) {
    const m = MODOS[modo], dur8 = 60 / tempo() / 2;
    if (!frase) frase = nuevaFrase();
    const compas = Math.floor(paso / 8) % 4, p = paso % 8, acorde = frase.prog[compas], bajo8 = -24;
    const base = m.raiz + (noche ? -12 : 0);
    const n = nivel();
    // pad: el acorde entero, suave, al empezar el compás
    if (p === 0) for (const k of [0, 2, 4]) nota(base - 12 + grado(m, acorde + k), t, dur8 * 8.2, m.pad, n * (modo === 'batalla' ? 0.035 : 0.05), dur8 * 2);
    // bajo
    if (modo === 'batalla') { if (p % 2 === 0 || jefe) nota(base + bajo8 + grado(m, acorde), t, dur8 * 0.9, 'triangle', n * 0.22); }
    else if (p === 0 || (p === 4 && !noche)) nota(base + bajo8 + 12 + grado(m, acorde), t, dur8 * 3.6, 'sine', n * 0.22, 0.02);
    // melodía (en el cuarto compás, cadencia: termina en la tónica del acorde)
    let g = frase.motivo[p];
    if (compas === 3 && p >= 4) g = p === 4 ? 0 : null;
    if (compas === 2 && g !== null && p > 0) g += 1; // variación: el tercer compás sube un grado
    if (g !== null) {
      const largo = compas === 3 && p === 4 ? 4 : frase.largos[p] || 1;
      nota(base + grado(m, acorde + g), t, dur8 * Math.min(largo, 3) * 0.95, m.mel, n * (m.mel === 'square' || m.mel === 'sawtooth' ? 0.07 : 0.13), 0.012);
    }
    // tambores de batalla
    if (m.tambor) {
      if (p === 0 || p === 4 || (jefe && p === 6)) bombo(t, n * 0.9);
      if (p === 2 || p === 6) ruido(t, 0.12, n * 0.25, 1800);
      if (jefe) ruido(t, 0.04, n * 0.1, 8000, 'highpass');
    }
    paso++;
    if (paso % 32 === 0) frase = nuevaFrase();
  }
  const tempo = () => MODOS[modo].bpm * (noche && modo !== 'batalla' ? 0.78 : 1) * (jefe ? 1.08 : 1);

  // ---------- qué suena ahora ----------
  function elegir() {
    const G = PK.Game, st = G && G.state;
    if (!st) return null;
    const B = PK.Batalla, I = PK.Incursiones;
    jefe = false;
    if (B && B.abierta && B.abierta()) { const b = B.vistaActual && B.vistaActual(); jefe = !!(b && b.jefeF && b.jefeF.hp > 0); return 'batalla'; }
    if (I && I.activa && I.activa() && I.banda && I.banda.fase !== 'aviso') return 'batalla';
    if (G.enMar && G.enMar()) return 'mar';
    const e = st.era || 1;
    return e <= 3 ? 'rustico' : e <= 6 ? 'medieval' : e <= 9 ? 'reino' : 'imperio';
  }
  function suena() {
    const X = PK.Sfx;
    return X && X.on && vol > 0 && ctx && ctx.state === 'running' && !document.hidden && !(PK.Game && PK.Game.offline);
  }
  function tick() {
    if (!ctx && !armar()) return;
    const ahora = ctx.currentTime;
    if (!suena()) { if (bus.gain.value > 0.001) { bus.gain.cancelScheduledValues(ahora); bus.gain.setTargetAtTime(0, ahora, 0.2); } prox = 0; return; }
    const m = elegir(), n = PK.Vida && PK.Vida.noche ? PK.Vida.noche() >= 0.5 : false;
    if (!m) return;
    // cambio de tema: se apaga, silencio corto y entra el nuevo (al empezar un compás para no cortar una frase en la calma)
    if (m !== modo || n !== noche) {
      const urgente = m === 'batalla' || modo === 'batalla';
      if (!modo || urgente || paso % 8 === 0) {
        bus.gain.cancelScheduledValues(ahora); bus.gain.setTargetAtTime(0, ahora, urgente ? 0.08 : 0.4);
        modo = m; noche = n; paso = 0; frase = null; fraseN = 0;
        silencioHasta = ahora + (urgente ? 0.3 : 1.6);
        prox = 0;
      }
    }
    if (ahora < silencioHasta) return;
    if (!prox || prox < ahora) { prox = ahora + 0.05; bus.gain.cancelScheduledValues(ahora); bus.gain.setTargetAtTime(1, ahora, 0.6); }
    filtro.frequency.setTargetAtTime(MODOS[modo].brillo * (noche ? 0.6 : 1), ahora, 0.5);
    while (prox < ahora + 0.35) { tocarPaso(prox); prox += 60 / tempo() / 2; }
    ambiente(ahora);
  }

  // ---------- ambiente ----------
  // Pájaros de día, grillos de noche, viento en invierno, olas en el mar y martillos lejanos si hay obras.
  function ambiente(ahora) {
    if (volAmb <= 0 || modo === 'batalla' || ahora < tAmb) return;
    const G = PK.Game, enMar = G.enMar && G.enMar(), est = PK.Vida && PK.Vida.estacion ? PK.Vida.estacion() : 0;
    const v = 0.5, r = Math.random();
    tAmb = ahora + 2.5 + Math.random() * 5;
    if (enMar || r < 0.18) { ruido(ahora, 3.2, v * 0.05, 420, 'lowpass', amb, 1.4); if (enMar) return; }
    if (noche) { grillo(ahora); return; }
    if (est === 3 && r < 0.6) { ruido(ahora, 4, v * 0.06, 520, 'bandpass', amb, 1.8); return; }
    const obras = G.buildings && G.buildings.some(b => b.owner === 'p' && (!b.done || b.upg));
    if (obras && r < 0.45) { for (let i = 0; i < 3; i++) { ruido(ahora + i * 0.42, 0.05, v * 0.05, 1500, 'bandpass', amb); nota(80, ahora + i * 0.42, 0.06, 'triangle', v * 0.03, 0.003, amb); } return; }
    pajaro(ahora, v);
  }
  function grillo(t) {
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 4300;
      const ti = t + i * 0.085;
      g.gain.setValueAtTime(0.0001, ti); g.gain.exponentialRampToValueAtTime(0.012, ti + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.05);
      o.connect(g); g.connect(amb); o.start(ti); o.stop(ti + 0.08);
    }
  }
  function pajaro(t, v) {
    const n = 2 + Math.floor(Math.random() * 3), f0 = 2400 + Math.random() * 1400;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), ti = t + i * (0.11 + Math.random() * 0.05);
      o.type = 'sine'; o.frequency.setValueAtTime(f0, ti); o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.3), ti + 0.07);
      g.gain.setValueAtTime(0.0001, ti); g.gain.exponentialRampToValueAtTime(v * 0.035, ti + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.09);
      o.connect(g); g.connect(amb); o.start(ti); o.stop(ti + 0.12);
    }
  }

  // ---------- control ----------
  M.vol = () => vol;
  M.volAmb = () => volAmb;
  M.setVol = function (v) {
    vol = acota(v); U.store.set('pk_musica', String(vol));
    if (ctx) bus.gain.setTargetAtTime(vol > 0 ? 1 : 0, ctx.currentTime, 0.1);
  };
  M.setVolAmb = function (v) {
    volAmb = acota(v); U.store.set('pk_ambiente', String(volAmb));
    if (amb) amb.gain.setTargetAtTime(volAmb / 100 * 0.6, ctx.currentTime, 0.1);
  };
  M.estado = () => ({ modo, noche, jefe, paso, sonando: !!(ctx && suena()) });
  M.iniciar = function () { if (!timer) timer = setInterval(tick, 100); };
})();
