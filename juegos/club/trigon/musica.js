/* Trigon — la música: «Prisma Neón».
   No pasa por el chip de la casa (juegos/audio/chip.js): un pulso de 8 bits
   suena a sala de máquinas, y lo que se buscaba es la noche de Night City
   en el anime. Así que esta canción trae sus propios instrumentos, hechos
   con osciladores y ruido pero pensados como un sintetizador de verdad:

   - pads de sierras desafinadas detrás de un pasabajos que respira, con una
     reverb larga y oscura (un impulso de ruido que se apaga, filtrado);
   - bajo Reese: dos sierras que se baten entre sí, saturadas, con un seno
     debajo, y todo lo que no es batería se hunde con cada bombo (el bombeo);
   - plucks de arpegio con un delay de ida y vuelta (corchea con puntillo);
   - una melodía de sierras con vibrato que llega tarde y portamento;
   - en el coro, acordes de quinta saturados que hacen de guitarra eléctrica;
   - batería de bombo con clic, caja con cola de reverb, palmas y charles de
     ruido; y debajo de todo, la ciudad: un rumor grave y lluvia.

   El ritmo y la armonía son los de la primera versión: Fa# menor armónico a
   120, el bajo que rueda a semicorcheas, el puente en Sol mayor sobre el Fa#
   (el segundo grado napolitano) y el Mi# sobre Do# que deja cada vuelta en
   tensión.

   Se programa por delante del reloj de audio (`programa(hasta)`), así que
   también se puede renderizar en un OfflineAudioContext para medirla.
   UMD: `TrigonMusica.crear(ctx, destino, {jugando})`. */
(function (root) {
  'use strict';
  const BPM = 120, PASO = 60 / BPM / 4, COMPAS = 16;
  // Volumen de salida: deja la canción al nivel de las demás del Club, por debajo de los efectos.
  const NIVEL = .42;
  const TONO = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(s) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    return m ? 12 * (+m[3] + 1) + TONO[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) : null;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  /* «C#6*3 B5 .*2» → notas con su paso de inicio y su duración en pasos. */
  function melodia(txt) {
    const ev = []; let i = 0;
    for (const f of String(txt).trim().split(/\s+/)) {
      const [n, k] = f.split('*'), dur = +(k || 1);
      if (n !== '.') ev.push({ paso: i, dur, m: midi(n), txt: n });
      i += dur;
    }
    return { ev, largo: i };
  }

  /* Cada acorde: la fundamental del bajo y la voz del pad (los plucks la
     arpegian una octava arriba). */
  const ACORDES = {
    'F#m': { raiz: 42, pad: [57, 61, 64, 66, 68] },
    D: { raiz: 38, pad: [57, 62, 64, 66, 69] },
    Bm: { raiz: 35, pad: [57, 59, 62, 66, 69] },
    'C#': { raiz: 37, pad: [56, 61, 65, 68, 73] },
    'C#7': { raiz: 37, pad: [56, 59, 61, 65, 68] },
    E: { raiz: 40, pad: [56, 59, 64, 68, 71] },
    A: { raiz: 45, pad: [57, 61, 64, 68, 71] },
    G: { raiz: 43, pad: [55, 59, 62, 66, 69] }
  };
  /* Batería, un carácter por semicorchea: k bombo, K bombo largo, s caja,
     c palmas, h charles, o charles abierto, r redoble (caja a fusas), x platillo. */
  const RUEDA = 'R R O R R R O R R R O R R O R O'.split(' ');
  const TRESILLO = 'R . . R . . R . R . . R . . O .'.split(' ');
  const SECCIONES = {
    I: { acordes: ['F#m', 'F#m', 'D', 'C#'], bajo: TRESILLO, pluck: [0, 0, .55, .8], abre: true,
      bat: ['......h.......h.', '......h.......h.', 'k...o...k...o..h', 'k...o...k...o.rr'] },
    A: { acordes: ['F#m', 'D', 'Bm', 'C#'], bajo: RUEDA, pluck: [1, 1, 1, 1], oct: -12,
      lead: 'C#6*3 B5 A5*2 G#5*2 A5*2 C#6*2 F#6*4  E6*3 D6 C#6*2 A5*2 F#5*4 .*2 A5*2  ' +
        'B5*2 D6*2 F#6*3 E6 D6*2 C#6*2 B5*4  E#5*4 G#5*2 B5*2 C#6*6 .*2',
      bat: ['k.o.c.okk.o.c.oh', 'k.o.c.okk.o.c.oh', 'k.o.c.okk.o.c.oh', 'k.o.c.okk.o.srrr'] },
    B: { acordes: ['D', 'E', 'A', 'C#'], bajo: RUEDA, pluck: [1, 1, 1, 1], guitarra: true, impacto: true,
      lead: 'F#6*2 A6*2 F#6*2 E6*2 D6*4 A5*4  G#6*2 B6*2 G#6*2 F#6*2 E6*4 B5*4  ' +
        'A6*3 G#6 E6*2 C#6*2 E6*2 F#6*2 G#6*4  E#6*4 G#6*4 C#7*8',
      bat: ['xho.shokkho.shoc', 'kho.shokkho.shoc', 'kho.shokkho.shoc', 'kho.shokkho.rrrr'] },
    C: { acordes: ['G', 'F#m', 'G', 'C#7'], bajo: 'largo', pluck: [0, 0, 0, 0], oct: -12,
      lead: 'B5*6 D6*2 G6*4 F#6*4  F#6*8 C#6*4 A5*4  B5*4 D6*4 G6*2 A6*2 B6*4  G#6*4 E#6*4 C#6*8',
      bat: ['K.......s.......', 'K.......s.......', 'K.......s.......', 'K.......s...rrrr'] }
  };
  const ORDEN = ['I', 'A', 'A', 'B', 'C', 'A', 'B', 'B'];
  // La melodía de cada sección, indexada por paso.
  for (const s of Object.values(SECCIONES)) {
    s.notas = {};
    if (s.lead) for (const e of melodia(s.lead).ev) s.notas[e.paso] = e;
  }
  const ARP = [0, 2, 4, 1, 3, 2, 4, 3];

  function crear(ac, destino, opciones) {
    const op = opciones || {};
    const jugando = typeof op.jugando === 'function' ? op.jugando : () => true;

    /* ---------- La consola: buses, envíos y efectos ---------- */
    const salida = ac.createGain(); salida.gain.value = 0; salida.connect(destino);
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = .006; comp.release.value = .2;
    comp.connect(salida);
    const ganancia = (v, a) => { const g = ac.createGain(); g.gain.value = v; if (a) g.connect(a); return g; };

    // Reverb: ruido estéreo que se apaga en 3,4 s, suavizado para que sea oscura.
    const reverb = ac.createConvolver();
    {
      const n = Math.floor(ac.sampleRate * 3.4), b = ac.createBuffer(2, n, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch); let y = 0;
        for (let i = 0; i < n; i++) { y += .35 * ((Math.random() * 2 - 1) - y); d[i] = y * Math.pow(1 - i / n, 2.6); }
      }
      reverb.buffer = b;
    }
    reverb.connect(ganancia(.9, comp));
    const aReverb = ganancia(1, reverb);

    // Delay de ida y vuelta: corchea con puntillo, cada rebote más apagado.
    const aDelay = ac.createGain(), dI = ac.createDelay(2), dD = ac.createDelay(2);
    dI.delayTime.value = dD.delayTime.value = PASO * 3;
    const fI = ac.createBiquadFilter(), fD = ac.createBiquadFilter();
    fI.type = fD.type = 'lowpass'; fI.frequency.value = fD.frequency.value = 2400;
    const rI = ganancia(.42), rD = ganancia(.42);
    aDelay.connect(dI); dI.connect(fI); fI.connect(rI); rI.connect(dD); dD.connect(fD); fD.connect(rD); rD.connect(dI);
    const lado = p => { const x = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain(); if (x.pan) x.pan.value = p; x.connect(comp); return x; };
    fI.connect(lado(-.7)); fD.connect(lado(.7));
    fI.connect(ganancia(.25, aReverb));

    // El bombeo: todo lo que no es batería pasa por aquí y se hunde con cada bombo.
    const hunde = ganancia(1, comp);
    const bus = (v, rev, del, destinoBus) => {
      const g = ganancia(v, destinoBus || hunde);
      if (rev) g.connect(ganancia(rev, aReverb));
      if (del) g.connect(ganancia(del, aDelay));
      return g;
    };
    const bPad = bus(.55, .55, 0), bBajo = bus(.42, 0, 0), bPluck = bus(.5, .2, .45), bLead = bus(.62, .4, .32);
    const bGtr = bus(.36, .12, 0), bBat = ganancia(.8, comp), bFx = bus(.6, .6, .2, comp);
    const revCaja = ganancia(.5, aReverb);

    // Saturación: una suave (bombo y bajo) y una fuerte (la guitarra).
    const curva = k => { const c = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } return c; };
    const SUAVE = curva(2.2), FUERTE = curva(9);
    const satura = (c, a) => { const w = ac.createWaveShaper(); w.curve = c; w.oversample = '2x'; if (a) w.connect(a); return w; };

    const ruidoBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    { const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

    /* ---------- Piezas sueltas ---------- */
    const limpia = (fuente, nodos) => { fuente.onended = () => { for (const n of nodos) { try { n.disconnect(); } catch (_) { /* nada */ } } }; };
    function osc(tipo, f, t, fin, det) {
      const o = ac.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t);
      if (det) o.detune.setValueAtTime(det, t);
      o.start(t); o.stop(fin + .05);
      return o;
    }
    function ruido(t, fin) {
      const s = ac.createBufferSource(); s.buffer = ruidoBuf; s.loop = true;
      s.start(t, Math.random() * 1.5); s.stop(fin + .05);
      return s;
    }
    function filtro(tipo, f, q) { const x = ac.createBiquadFilter(); x.type = tipo; x.frequency.value = f; x.Q.value = q || .7; return x; }
    // Golpe: sube en `a` y cae exponencial hasta `fin`.
    function golpe(g, t, a, pico, fin) {
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(pico, t + a); g.gain.exponentialRampToValueAtTime(.0001, fin);
    }
    // Nota sostenida: ataque, meseta y relajación.
    function sostiene(g, t, a, pico, suelta, r) {
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pico, t + a);
      g.gain.setValueAtTime(pico, Math.max(t + a, suelta)); g.gain.linearRampToValueAtTime(0, Math.max(t + a, suelta) + r);
    }

    /* ---------- Batería ---------- */
    function bombea(t, k) {
      const g = hunde.gain;
      g.setValueAtTime(1, t); g.linearRampToValueAtTime(k || .32, t + .012); g.linearRampToValueAtTime(1, t + .24);
    }
    function bombo(t, largo) {
      const fin = t + (largo ? .9 : .42), o = osc('sine', largo ? 130 : 165, t, fin), g = ac.createGain();
      o.frequency.exponentialRampToValueAtTime(largo ? 38 : 46, t + (largo ? .16 : .09));
      golpe(g, t, .002, largo ? 1 : .95, fin);
      o.connect(g); g.connect(satura(SUAVE, bBat)); limpia(o, [g]);
      const r = ruido(t, t + .02), f = filtro('highpass', 2800), gc = ac.createGain();
      golpe(gc, t, .001, .22, t + .018); r.connect(f); f.connect(gc); gc.connect(bBat); limpia(r, [f, gc]);
      bombea(t, largo ? .2 : .32);
    }
    function caja(t, v) {
      v = v == null ? 1 : v;
      const fin = t + .26, r = ruido(t, fin), bp = filtro('bandpass', 1900, .7), g = ac.createGain();
      golpe(g, t, .002, .5 * v, fin); r.connect(bp); bp.connect(g); g.connect(bBat); g.connect(revCaja);
      const hp = filtro('highpass', 5200), g2 = ac.createGain();
      golpe(g2, t, .001, .16 * v, t + .14); r.connect(hp); hp.connect(g2); g2.connect(bBat);
      const o = osc('triangle', 210, t, t + .12), g3 = ac.createGain();
      o.frequency.exponentialRampToValueAtTime(165, t + .1); golpe(g3, t, .002, .35 * v, t + .12);
      o.connect(g3); g3.connect(bBat); limpia(r, [bp, g, hp, g2]); limpia(o, [g3]);
    }
    function palmas(t) {
      const fin = t + .2, r = ruido(t, fin), bp = filtro('bandpass', 1250, 1.1), g = ac.createGain();
      g.gain.setValueAtTime(.0001, t);
      for (const [d, v] of [[0, .45], [.011, .4], [.022, .5]]) { g.gain.setValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(.05, t + d + .009); }
      g.gain.setValueAtTime(.32, t + .031); g.gain.exponentialRampToValueAtTime(.0001, fin);
      r.connect(bp); bp.connect(g); g.connect(bBat); g.connect(revCaja); limpia(r, [bp, g]);
    }
    function charles(t, abierto) {
      const fin = t + (abierto ? .32 : .05), r = ruido(t, fin), hp = filtro('highpass', 7600), g = ac.createGain();
      golpe(g, t, .001, abierto ? .13 : .11, fin);
      const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
      r.connect(hp); hp.connect(g);
      if (p) { p.pan.value = .25; g.connect(p); p.connect(bBat); } else g.connect(bBat);
      limpia(r, [hp, g].concat(p ? [p] : []));
    }
    function platillo(t) {
      const fin = t + 2.2, r = ruido(t, fin), hp = filtro('highpass', 4200), g = ac.createGain();
      golpe(g, t, .002, .2, fin); r.connect(hp); hp.connect(g); g.connect(bBat); g.connect(revCaja); limpia(r, [hp, g]);
    }
    function golpeBat(c, t) {
      if (c === 'k') bombo(t);
      else if (c === 'K') bombo(t, true);
      else if (c === 's') caja(t);
      else if (c === 'c') { palmas(t); caja(t, .45); }
      else if (c === 'h') charles(t);
      else if (c === 'o') charles(t, true);
      else if (c === 'r') { caja(t, .55); caja(t + PASO / 2, .4); }
      else if (c === 'x') { platillo(t); bombo(t); }
    }

    /* ---------- Bajo, pads, plucks, melodía, guitarra ---------- */
    // Reese: dos sierras que se baten, un pasabajos que se cierra y saturación; un seno debajo.
    function bajo(t, m, dur, corte) {
      const fin = t + dur, f = hz(m), lp = filtro('lowpass', corte * 2.4, 3.2), g = ac.createGain();
      lp.frequency.setValueAtTime(corte * 2.4, t); lp.frequency.exponentialRampToValueAtTime(corte, t + Math.min(.12, dur));
      const a = osc('sawtooth', f, t, fin + .06, -11), b = osc('sawtooth', f, t, fin + .06, 11);
      a.connect(lp); b.connect(lp); lp.connect(satura(SUAVE, g));
      sostiene(g, t, .004, .5, fin, .05); g.connect(bBajo);
      const s = osc('sine', hz(m >= 40 ? m - 12 : m), t, fin + .06), gs = ac.createGain();
      sostiene(gs, t, .004, .55, fin, .05); s.connect(gs); gs.connect(bBajo);
      limpia(a, [lp, g]); limpia(s, [gs]);
    }
    // El 808 del puente: un seno que cae desde la octava y zumba largo.
    function bajo808(t, m, dur) {
      const fin = t + dur, o = osc('sine', hz(m + 12), t, fin), g = ac.createGain();
      o.frequency.exponentialRampToValueAtTime(hz(m), t + .07);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.95, t + .005);
      g.gain.setTargetAtTime(.0001, t + .12, dur / 3.2);
      o.connect(g); g.connect(satura(SUAVE, bBajo)); limpia(o, [g]);
    }
    // Pad: cada nota, tres sierras desafinadas; un solo pasabajos que abre y cierra en el compás.
    function pad(t, notas, dur) {
      const fin = t + dur, lp = filtro('lowpass', 700, .6), g = ac.createGain();
      lp.frequency.setValueAtTime(650, t); lp.frequency.linearRampToValueAtTime(1500, t + dur * .55); lp.frequency.linearRampToValueAtTime(800, fin + .8);
      sostiene(g, t, .45, .055, fin, 1.1); lp.connect(g); g.connect(bPad);
      const os = [];
      for (const m of notas) for (const det of [-14, 0, 13]) { const o = osc('sawtooth', hz(m), t, fin + 1.15, det + (Math.random() * 4 - 2)); o.connect(lp); os.push(o); }
      limpia(os[0], [lp, g]);
    }
    // Pluck: sierra y cuadrada con un pasabajos que se cierra enseguida.
    function pluck(t, m, v) {
      const fin = t + .3, lp = filtro('lowpass', 4200, 4), g = ac.createGain();
      lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(420, t + .17);
      const a = osc('sawtooth', hz(m), t, fin), b = osc('square', hz(m), t, fin, 7);
      const gb = ganancia(.4); b.connect(gb); gb.connect(lp); a.connect(lp);
      golpe(g, t, .002, .13 * v, fin); lp.connect(g); g.connect(bPluck); limpia(a, [lp, g, gb]);
    }
    // La melodía: sierras con vibrato tardío y portamento si la nota anterior la toca.
    let ultima = null;
    function lead(t, m, dur) {
      const fin = t + dur, f = hz(m), lp = filtro('lowpass', 2100, .9), g = ac.createGain();
      const desde = ultima && Math.abs(ultima.fin - t) < .02 ? hz(ultima.m) : null;
      const vib = osc('sine', 5.3, t, fin + .35), gv = ac.createGain();
      gv.gain.setValueAtTime(0, t); gv.gain.linearRampToValueAtTime(0, t + .28); gv.gain.linearRampToValueAtTime(11, t + .6);
      vib.connect(gv);
      const os = [osc('sawtooth', f, t, fin + .35, -8), osc('sawtooth', f, t, fin + .35, 8), osc('triangle', f / 2, t, fin + .35)];
      os.forEach((o, i) => {
        if (desde) { o.frequency.setValueAtTime(i === 2 ? desde / 2 : desde, t); o.frequency.exponentialRampToValueAtTime(i === 2 ? f / 2 : f, t + .07); }
        gv.connect(o.detune);
        if (i === 2) { const gt = ganancia(.5); o.connect(gt); gt.connect(lp); } else o.connect(lp);
      });
      sostiene(g, t, .035, .085, fin, .3); lp.connect(g); g.connect(bLead);
      limpia(os[0], [lp, g, gv]);
      ultima = { m, fin };
    }
    // Guitarra: quinta y octava en sierra, saturadas fuerte y con caja de amplificador.
    function guitarra(t, raiz, dur, acento) {
      const fin = t + dur, hp = filtro('highpass', 110), lp = filtro('lowpass', acento ? 2900 : 1500, .8), g = ac.createGain();
      const sat = satura(FUERTE, hp); hp.connect(lp); lp.connect(g); g.connect(bGtr);
      const os = [];
      for (const [i, det] of [[0, -6], [0, 6], [7, -5], [12, 4]]) { const o = osc('sawtooth', hz(raiz + i), t, fin + .08, det); o.connect(sat); os.push(o); }
      sostiene(g, t, .003, acento ? .22 : .15, fin, .06);
      limpia(os[0], [sat, hp, lp, g]);
    }
    // Lo que se oye entre secciones: el impacto del coro y la subida antes de él.
    function impacto(t) {
      const o = osc('sine', 72, t, t + 1.6), g = ac.createGain();
      o.frequency.exponentialRampToValueAtTime(27, t + 1.4); golpe(g, t, .004, .55, t + 1.6);
      o.connect(g); g.connect(bBat); limpia(o, [g]);
    }
    function subida(t, dur) {
      const fin = t + dur, r = ruido(t, fin), bp = filtro('bandpass', 300, 4), g = ac.createGain();
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7000, fin);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, fin - .02); g.gain.linearRampToValueAtTime(0, fin);
      r.connect(bp); bp.connect(g); g.connect(bFx); limpia(r, [bp, g]);
    }

    /* ---------- La ciudad: un rumor grave y lluvia, todo el rato ---------- */
    let ciudad = null;
    function enciendeCiudad(t) {
      if (ciudad) return;
      const r = ac.createBufferSource(); r.buffer = ruidoBuf; r.loop = true;
      const grave = filtro('lowpass', 380, .5), gG = ganancia(.05);
      const lluvia = filtro('bandpass', 3200, .4), gL = ganancia(.016);
      const lfo = ac.createOscillator(), gLfo = ganancia(900);
      lfo.frequency.value = .07; lfo.connect(gLfo); gLfo.connect(lluvia.frequency);
      r.connect(grave); grave.connect(gG); gG.connect(comp);
      r.connect(lluvia); lluvia.connect(gL); gL.connect(comp); gL.connect(ganancia(.4, aReverb));
      r.start(t); lfo.start(t);
      ciudad = { r, lfo };
    }
    function apagaCiudad(t) {
      if (!ciudad) return;
      try { ciudad.r.stop(t + .4); ciudad.lfo.stop(t + .4); } catch (_) { /* nada */ }
      ciudad = null;
    }

    /* ---------- El secuenciador ---------- */
    let sec = 0, paso = 0, sig = 0, nivelLead = 1, nivelPluck = 1;
    function tocaPaso(t) {
      const nombre = ORDEN[sec], S = SECCIONES[nombre], compas = paso >> 4, p = paso & 15;
      const ac0 = ACORDES[S.acordes[compas]];
      const sigNombre = ORDEN[(sec + 1) % ORDEN.length];
      if (p === 0) {
        pad(t, ac0.pad, COMPAS * PASO);
        if (S.impacto && compas === 0) impacto(t);
        if (compas === 3 && sigNombre === 'B' && nombre !== 'B') subida(t, COMPAS * PASO);
      }
      // Bajo
      const corte = S.abre ? 160 + compas * 130 + p * 8 : 420;
      if (S.bajo === 'largo') {
        if (p === 0) bajo808(t, ac0.raiz, PASO * 8);
        else if (p === 8) bajo808(t, ac0.raiz, PASO * 4);
        else if (p === 12) bajo808(t, ac0.raiz + 12, PASO * 4);
      } else {
        const c = S.bajo[p];
        if (c === 'R' || c === 'O') bajo(t, ac0.raiz + (c === 'O' ? 12 : 0), PASO * .85, corte);
      }
      // Batería
      const golpeC = S.bat[compas][p];
      if (golpeC && golpeC !== '.') golpeBat(golpeC, t);
      // Plucks
      const v = S.pluck[compas] * nivelPluck;
      if (v > 0 && (p % 2 === 0 || S.guitarra || compas >= 2)) pluck(t, ac0.pad[ARP[p % 8]] + 12, v);
      // Guitarra: corcheas apagadas y un acento al principio de cada medio compás
      if (S.guitarra && p % 2 === 0) guitarra(t, ac0.raiz + 12, PASO * (p % 8 === 0 ? 1.7 : .8), p % 8 === 0);
      // Melodía
      const n = S.notas[paso];
      if (n && nivelLead > .01) lead(t, n.m + (S.oct || 0), n.dur * PASO);
    }
    function programa(hasta) {
      let n = 0;
      while (sig < hasta && n++ < 200) {
        tocaPaso(sig);
        sig += PASO;
        if (++paso >= COMPAS * 4) { paso = 0; sec = (sec + 1) % ORDEN.length; }
      }
    }

    let reloj = null, suena = false;
    function vuelta() {
      const j = !!jugando();
      nivelLead = j ? 1 : 0; nivelPluck = j ? 1 : .55;
      if (sig < ac.currentTime) sig = ac.currentTime + .05;
      programa(ac.currentTime + .3);
    }
    return {
      programa, ciudad: enciendeCiudad,
      get sonando() { return suena; },
      /* Desde el principio, con un fundido corto. */
      arranca() {
        if (suena) return;
        suena = true; sec = 0; paso = 0; ultima = null;
        const t = ac.currentTime;
        sig = t + .08;
        salida.gain.cancelScheduledValues(t); salida.gain.setValueAtTime(0, t); salida.gain.linearRampToValueAtTime(NIVEL, t + .8);
        enciendeCiudad(t);
        vuelta();
        reloj = setInterval(() => { try { vuelta(); } catch (_) { /* la música nunca para el juego */ } }, 60);
      },
      detener() {
        if (!suena) return;
        suena = false; clearInterval(reloj); reloj = null;
        const t = ac.currentTime;
        salida.gain.cancelScheduledValues(t); salida.gain.setValueAtTime(salida.gain.value, t); salida.gain.linearRampToValueAtTime(0, t + .3);
        apagaCiudad(t);
      },
      /* Para renderizar sin reloj (pruebas): sube la salida y deja el secuenciador en 0. */
      _prepara(t) { salida.gain.value = NIVEL; sec = 0; paso = 0; sig = t || 0; }
    };
  }

  const TrigonMusica = { crear, BPM, SECCIONES, ORDEN, ACORDES, melodia, midi };
  if (typeof module === 'object' && module.exports) module.exports = TrigonMusica;
  else root.TrigonMusica = TrigonMusica;
})(typeof globalThis !== 'undefined' ? globalThis : this);
