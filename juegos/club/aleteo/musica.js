/* La música y los efectos de ALETEO, sintetizados en vivo con WebAudio.

   La música no es una grabación: se compone compás a compás desde el mismo
   número que oscurece el cielo (`corrupcion`, en lore.js). Hay seis cielos
   y cada uno tiene su armonía, su tempo, su instrumento principal y su
   batería:

     mañana  112 bpm  mayor pentatónica, pulso de pluck, palmas
     tarde   100 bpm  mixolidia, triángulo, la batería se aligera
     ocaso    92 bpm  dórica, vibrato, sólo bombo y aro
     noche    84 bpm  eólica, seno con eco largo, sin caja
     jaula    76 bpm  frigia, caja de música y un reloj que hace tic
     vacío    60 bpm  locria, un zumbido y un latido; las notas caen

   El cielo entero (armonía, tempo, instrumento) cambia en el compás
   siguiente a cruzar la mitad del fundido; lo que sí se corre sin
   escalones es el filtro del bus, el eco y la desafinación, así que el
   cambio se oye venir. Nada usa Math.random: el patrón de cada compás sale
   de un contador, y el mismo vuelo suena igual.

   Todo pasa por `destination`, que juegos/audio/volumen.js convierte en una
   ganancia propia: el volumen del Club lo gobierna sin que este archivo lo
   sepa. */
(function (root) {
  'use strict';
  const L = root.AleteoLore;
  const CIELOS = [
    { bpm: 112, escala: [0, 2, 4, 7, 9], acordes: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], lead: 'pluck', densidad: .62, bat: 'pop' },
    { bpm: 100, escala: [0, 2, 4, 5, 7, 9, 10], acordes: [[0, 4, 7], [-2, 2, 5], [5, 9, 12], [0, 4, 7]], lead: 'tri', densidad: .5, bat: 'suave' },
    { bpm: 92, escala: [0, 2, 3, 5, 7, 9, 10], acordes: [[0, 3, 7], [5, 9, 12], [0, 3, 7], [-2, 2, 5]], lead: 'vibra', densidad: .4, bat: 'aro' },
    { bpm: 84, escala: [0, 2, 3, 5, 7, 8, 10], acordes: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], lead: 'seno', densidad: .28, bat: 'noche' },
    { bpm: 76, escala: [0, 1, 3, 5, 7, 8, 10], acordes: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [1, 5, 8]], lead: 'caja', densidad: .34, bat: 'reloj' },
    { bpm: 60, escala: [0, 1, 3, 5, 6, 8, 10], acordes: [[0, 3, 6], [0, 3, 6], [1, 5, 8], [0, 3, 6]], lead: 'cae', densidad: .14, bat: 'latido' },
  ];
  const RAIZ = 48; // Do3
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // Un pseudoazar fijo por (compás, paso, voz).
  const azar = (a, b, c) => { let h = Math.imul((a * 73856093) ^ (b * 19349663) ^ (c * 83492791), 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

  function crear() {
    let ctx = null, master, comp, bus, filtro, fx, ecoIn, eco, ecoFb, ecoOut, ruidoBuf;
    let mudo = false, corr = 0, jugando = false, sonando = false, timer = 0;
    let paso = 0, compas = 0, tSig = 0, cielo = 0;

    function monta() {
      if (ctx) return true;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = mudo ? 0 : 1;
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      bus = ctx.createGain(); bus.gain.value = 0;
      filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 9000; filtro.Q.value = .7;
      bus.connect(filtro); filtro.connect(master);
      fx = ctx.createGain(); fx.gain.value = .9; fx.connect(master);
      // Un eco para el instrumento principal: crece con la noche.
      ecoIn = ctx.createGain(); eco = ctx.createDelay(1.5); ecoFb = ctx.createGain(); ecoOut = ctx.createGain();
      const ecoLp = ctx.createBiquadFilter(); ecoLp.type = 'lowpass'; ecoLp.frequency.value = 2600;
      ecoIn.connect(eco); eco.connect(ecoLp); ecoLp.connect(ecoFb); ecoFb.connect(eco); ecoLp.connect(ecoOut); ecoOut.connect(filtro);
      ecoFb.gain.value = .3; ecoOut.gain.value = .2;
      ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = ruidoBuf.getChannelData(0);
      let s = 22222;
      for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
      document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (sonando) ctx.resume(); });
      return true;
    }

    const env = (g, t, a, v, r) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + r); };
    function osc(tipo, f, t, dur, v, dest, o) {
      o = o || {};
      const n = ctx.createOscillator(), g = ctx.createGain();
      n.type = tipo; n.frequency.setValueAtTime(f, t);
      if (o.a) n.frequency.exponentialRampToValueAtTime(Math.max(20, o.a), t + (o.ta || dur));
      if (o.det) n.detune.value = o.det;
      if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibA || 12; l.connect(lg); lg.connect(n.detune); l.start(t); l.stop(t + dur + .1); }
      env(g, t, o.at || .005, v, dur);
      n.connect(g); g.connect(dest);
      n.start(t); n.stop(t + dur + .05);
      return g;
    }
    function ruido(t, dur, v, dest, o) {
      o = o || {};
      const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      n.buffer = ruidoBuf; n.loop = true;
      f.type = o.tipo || 'highpass'; f.frequency.setValueAtTime(o.f || 6000, t); f.Q.value = o.q || .7;
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
      env(g, t, o.at || .002, v, dur);
      n.connect(f); f.connect(g); g.connect(dest);
      n.start(t, (o.off || 0) % .9); n.stop(t + dur + .05);
    }

    // ---- Batería ----
    function bombo(t, v) { osc('sine', 150, t, .28, v, bus, { a: 42, ta: .16 }); }
    function caja(t, v) { ruido(t, .14, v, bus, { tipo: 'bandpass', f: 1800, q: .8 }); osc('triangle', 220, t, .08, v * .5, bus, { a: 140 }); }
    function hat(t, v) { ruido(t, .035, v, bus, { f: 7500 }); }
    function aro(t, v) { osc('square', 1700, t, .02, v * .4, bus); ruido(t, .03, v, bus, { tipo: 'bandpass', f: 3200, q: 4 }); }
    function tic(t, v, alto) { osc('square', alto ? 2400 : 1900, t, .012, v, bus); }

    function bateria(C, s, t, beat) {
      const k = C.bat;
      if (k === 'pop' || k === 'suave') {
        if (s % 8 === 0) bombo(t, k === 'pop' ? .55 : .4);
        if (s === 10 && k === 'pop') bombo(t, .35);
        if (s % 8 === 4) caja(t, k === 'pop' ? .22 : .12);
        if (s % 2 === 0) hat(t, s % 4 === 2 ? .07 : .04);
      } else if (k === 'aro') {
        if (s === 0 || s === 7 || s === 10) bombo(t, .45);
        if (s % 8 === 4) aro(t, .14);
        if (s % 4 === 2) hat(t, .03);
      } else if (k === 'noche') {
        if (s === 0 || s === 11) bombo(t, .35);
        if (s % 4 === 2) hat(t, .02);
      } else if (k === 'reloj') {
        if (s % 4 === 0) tic(t, .05, s % 8 === 0);
        if (s === 0) bombo(t, .3);
      } else if (k === 'latido') {
        if (s === 0) bombo(t, .55);
        if (s === 2) bombo(t, .35);
      }
      return beat;
    }

    // ---- El compás: bajo, colchón, instrumento principal ----
    function pad(acorde, t, dur, v) {
      for (const n of acorde) for (const det of [-7, 7]) osc('sawtooth', mtof(RAIZ + 12 + n), t, dur, v, bus, { at: .4, det: det * (1 + corr * .6) });
    }
    function lead(C, nota, t, dur, v) {
      const f = mtof(nota);
      const dest = ctx.createGain(); dest.gain.value = 1; dest.connect(bus); dest.connect(ecoIn);
      switch (C.lead) {
        case 'pluck': osc('square', f, t, dur * .6, v * .45, dest); osc('triangle', f * 2, t, dur * .3, v * .25, dest); break;
        case 'tri': osc('triangle', f, t, dur, v * .8, dest, { at: .01 }); break;
        case 'vibra': osc('triangle', f, t, dur * 1.3, v * .8, dest, { at: .03, vib: 5.5, vibA: 18 }); break;
        case 'seno': osc('sine', f, t, dur * 1.8, v * .9, dest, { at: .04, vib: 4, vibA: 8 }); break;
        case 'caja': osc('sine', f * 2, t, 1.2, v * .55, dest); osc('sine', f * 6.02, t, .25, v * .12, dest); break;
        case 'cae': osc('sine', f, t, 2.5, v * .7, dest, { at: .2, a: f / 2, ta: 2.4 }); break;
      }
    }
    function compasEntero(C, t, dur) {
      const ac = C.acordes[compas % C.acordes.length];
      // Bajo: la raíz, una octava abajo; en el vacío es un zumbido continuo.
      if (C.lead === 'cae') {
        osc('sawtooth', mtof(RAIZ - 12 + ac[0]), t, dur, .09, bus, { at: .6, det: -10 });
        osc('sine', mtof(RAIZ - 24 + ac[0]), t, dur, .25, bus, { at: .6 });
      } else {
        const tipo = cielo >= 3 ? 'sine' : 'triangle';
        for (const q of [0, .5]) osc(tipo, mtof(RAIZ - 12 + ac[0]), t + dur * q, dur * .45, .26, bus);
        if (cielo <= 1) osc(tipo, mtof(RAIZ - 12 + ac[2]), t + dur * .75, dur * .2, .18, bus);
      }
      pad(ac, t, dur * .98, cielo >= 4 ? .025 : .03);
    }
    function nota(C, s) {
      if (azar(compas, s, 7) > C.densidad * (jugando ? 1 : .55)) return null;
      if (s % 2 && azar(compas, s, 9) < .6) return null;
      const ac = C.acordes[compas % C.acordes.length];
      const base = s % 4 === 0 ? ac[Math.floor(azar(compas, s, 3) * 3)] : C.escala[Math.floor(azar(compas, s, 5) * C.escala.length)];
      const oct = C.lead === 'caja' ? 12 : 24;
      return RAIZ + oct + base;
    }

    function agenda() {
      if (!ctx) return;
      while (tSig < ctx.currentTime + .12) {
        const C = CIELOS[cielo];
        const dur16 = 60 / C.bpm / 4;
        const s = paso % 16;
        if (s === 0) {
          // El cielo cambia en el compás, no a mitad.
          cielo = L ? L.etapa(corr) : 0;
          const C2 = CIELOS[cielo];
          compasEntero(C2, tSig, dur16 * 16 * (C.bpm / C2.bpm));
        }
        const C2 = CIELOS[cielo];
        bateria(C2, s, tSig, 0);
        const n = nota(C2, s);
        if (n != null) lead(C2, n, tSig, dur16 * 2, .16);
        paso++; if (paso % 16 === 0) compas++;
        tSig += 60 / C2.bpm / 4;
      }
    }
    function continuo() {
      if (!ctx) return;
      const t = ctx.currentTime;
      // El filtro se cierra de 9 kHz a 1,1 kHz; el eco se alarga.
      filtro.frequency.setTargetAtTime(9000 * Math.pow(1100 / 9000, Math.min(1, corr / 5)), t, .5);
      eco.delayTime.setTargetAtTime(.22 + corr * .1, t, .5);
      ecoFb.gain.setTargetAtTime(.25 + corr * .09, t, .5);
      ecoOut.gain.setTargetAtTime(.12 + corr * .07, t, .5);
      bus.gain.setTargetAtTime(sonando ? (jugando ? .5 : .32) : 0, t, .4);
    }

    function arranca() {
      if (!monta()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (sonando) return;
      sonando = true;
      tSig = ctx.currentTime + .08; paso = 0;
      clearInterval(timer);
      timer = setInterval(() => { agenda(); continuo(); }, 25);
      continuo();
    }

    // ---- Efectos ----
    function aleteo() {
      if (!ctx || mudo) return;
      const t = ctx.currentTime;
      ruido(t, .12, .22, fx, { tipo: 'bandpass', f: 500, f1: 1600, q: 1.2 });
      if (corr < 4.3) osc('sine', 900 - corr * 90, t, .07, .07 * (1 - corr / 5), fx, { a: 1400 - corr * 150 });
      else osc('sawtooth', 160, t, .1, .04, fx, { a: 110 }); // ya no pía: cruje
    }
    function punto(n) {
      if (!ctx || mudo) return;
      const t = ctx.currentTime;
      if (corr < 3) {
        const f = 1320 * (n % 5 === 0 ? 1.5 : 1);
        osc('sine', f, t, .25, .16, fx); osc('sine', f * 1.5, t + .05, .25, .1, fx);
      } else {
        // Una campana lejana y mal fundida: parciales que no son armónicos.
        const f = 330 - (corr - 3) * 40;
        for (const [m, v] of [[1, .14], [2.32, .07], [4.1, .04], [5.4, .02]]) osc('sine', f * m, t, 1.4, v, fx);
      }
    }
    function golpe(tipo) {
      if (!ctx || mudo) return;
      const t = ctx.currentTime;
      ruido(t, .25, .45, fx, { tipo: 'lowpass', f: 1800, f1: 200 });
      osc('sine', 130, t, .35, .5, fx, { a: 40 });
      if (tipo === 'tubo') osc('square', 300, t, .08, .08, fx, { a: 120 });
      if (corr >= 4) osc('sawtooth', 55, t + .05, 1.2, .1, fx, { a: 30 });
    }
    function caida() {
      if (!ctx || mudo) return;
      const t = ctx.currentTime;
      osc('triangle', 820, t, .5, .1, fx, { a: 180, ta: .5 });
    }
    function medalla(cual) {
      if (!ctx || mudo) return;
      const t = ctx.currentTime, oscuro = corr >= 3;
      const notas = oscuro ? [0, 3, 6, 12] : [0, 4, 7, 12, 16];
      notas.forEach((n, i) => osc(oscuro ? 'sine' : 'square', mtof(RAIZ + 24 + n + (cual === 'platino' ? 2 : 0)), t + i * .08, .4, oscuro ? .1 : .06, fx));
    }
    function nuevoRecord() {
      if (!ctx || mudo) return;
      const t = ctx.currentTime;
      [0, 7, 12, 19].forEach((n, i) => osc('triangle', mtof(RAIZ + 24 + n - (corr >= 3 ? 1 : 0)), t + i * .1, .5, .1, fx));
    }

    return {
      arranca,
      mood(c, j) { corr = Math.max(0, Math.min(5, +c || 0)); jugando = !!j; },
      mudo(v) { mudo = !!v; if (master) master.gain.setTargetAtTime(mudo ? 0 : 1, ctx.currentTime, .05); },
      get esMudo() { return mudo; },
      aleteo, punto, golpe, caida, medalla, nuevoRecord,
      cielo: () => cielo,
    };
  }

  const api = { crear, CIELOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AleteoMusica = api;
})(globalThis);
