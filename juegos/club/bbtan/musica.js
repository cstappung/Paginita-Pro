/* BBTAN · música que escucha la partida.

   No es una canción del cancionero que suena encima del juego: es un
   compositor pequeño que decide cada semicorchea mirando el tablero. Hay una
   sola medida del peligro, la intensidad I (0 = pocos bloques y lejos del
   suelo, 1 = la próxima ronda puede ser la última), y de ella sale todo:

   - el tempo (98 → 132 bpm arriba, 84 → 110 en el abismo);
   - la batería, que va de una pulsación y un shaker a caja, redobles,
     semicorcheas y un latido de corazón cuando la fila de abajo está a un paso;
   - la armonía: con I alta la progresión luminosa (Dm9 · B♭maj7♯11 · Fmaj9 ·
     C6/9) se cambia por un pedal de re con acordes que rozan un semitono
     arriba — y vuelve sólo cuando I baja de .5, para que no parpadee en el
     borde (`siguienteArmonia`);
   - la melodía calla cuando hay que concentrarse, entra un ostinato 3-3-2 y,
     al final, una alarma de segundas menores;
   - con pocos bloques suben burbujas pentatónicas y el filtro del colchón se
     cierra: es la música de tener la partida bajo control.

   Desde la ronda 100 la misma lógica toca en otro sitio, «el abismo»: más
   lento, en grave, con un sub que baja de 40 Hz, un bajo de sierra saturado,
   un 808 en medio tiempo que hunde el resto (sidechain) y una melodía de
   sierra en la octava 4. Entrar suena a caída.

   La mitad pura (`intensidad`, `siguienteArmonia`, `eventos`) no toca audio y
   se prueba en Node; `Motor` es sólo el agendador, a lo Chip.Reproductor. */
(function (root) {
  'use strict';

  const Chip = root.Chip || (typeof require === 'function' ? require('../../audio/chip.js') : null);
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const clamp = x => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* ---------- La medida del peligro ---------- */

  /** Peligro según las filas libres entre el bloque más bajo y el suelo. */
  const PELIGRO = [1, 1, .78, .5, .28, .12, 0, 0, 0];

  /** {filas, bloques, disparando} → I en [0, 1]. Sin bloques, calma. */
  function intensidad(o) {
    o = o || {};
    const filas = Number.isFinite(o.filas) ? Math.max(0, Math.min(8, Math.round(o.filas))) : 8;
    const p = PELIGRO[filas];
    const lleno = Math.min(1, Math.max(0, o.bloques || 0) / 21);
    return clamp(Math.max(p, .55 * p + .45 * lleno) + (o.disparando ? .05 : 0));
  }

  /** Histéresis: se entra en «filo» a .7 y se sale por debajo de .5. */
  function siguienteArmonia(actual, I) {
    return actual === 'filo' ? (I < .5 ? 'calma' : 'filo') : (I >= .7 ? 'filo' : 'calma');
  }

  /* ---------- El material ---------- */

  // Cuatro compases de acordes por modo; la raíz es la del bajo.
  const PROG = {
    luz: { acordes: [[53, 57, 60, 64], [53, 57, 62, 64], [57, 60, 64, 67], [55, 57, 62, 64]], raices: [38, 34, 41, 36] },
    filo: { acordes: [[53, 57, 62], [55, 58, 63], [53, 58, 62], [61, 64, 67]], raices: [38, 38, 38, 38] },
    abismo: { acordes: [[45, 52, 53, 57], [50, 53, 57], [50, 55, 58], [49, 52, 55, 58]], raices: [26, 34, 31, 33] },
    sima: { acordes: [[50, 53, 57], [51, 55, 58], [51, 56, 60], [51, 55, 58]], raices: [26, 26, 26, 26] }
  };

  /** Ocho compases de dieciséis fichas → [compás][paso] = {n, pasos} | null. */
  function melodia(lineas) {
    const fichas = lineas.map(l => l.trim().split(/\s+/));
    const plano = [].concat(...fichas), out = fichas.map(() => new Array(16).fill(null));
    for (let i = 0; i < plano.length; i++) {
      if (plano[i] === '.') continue;
      let j = i + 1;
      while (j < plano.length && plano[j] === '.') j++;
      out[Math.floor(i / 16)][i % 16] = { n: Chip ? Chip.midi(plano[i]) : NaN, pasos: Math.min(8, j - i) };
    }
    return out;
  }
  const MEL_LUZ = melodia([
    'A5 . . . C6 . . . E6 . . . D6 . C6 .',
    'D6 . . . . . . . A5 . . . F5 . E5 .',
    'C6 . . . A5 . . . E6 . . . C6 . G5 .',
    'E5 . . . G5 . . . A5 . . . . . . .',
    'A5 . . . C6 . . . E6 . . . F6 . E6 .',
    'D6 . . . F6 . . . A6 . . . . . G6 .',
    'E6 . C6 . A5 . . . C6 . . . E6 . G6 .',
    'E6 . . . D6 . . . A5 . . . . . . .'
  ]);
  const MEL_ABISMO = melodia([
    'D4 . . . . . . . . . . . A3 . C4 .',
    'D4 . . . . . . . F4 . . . E4 . . .',
    'D4 . . . . . . . Bb3 . . . . . . .',
    'C#4 . . . . . . . E4 . . . G4 . . .',
    'A4 . . . . . . . . . . . G4 . F4 .',
    'F4 . . . . . . . D4 . . . . . . .',
    'Bb3 . . . D4 . . . G4 . . . F4 . . .',
    'E4 . . . . . . . C#4 . . . . . . .'
  ]);
  const PENTA = [74, 77, 79, 81, 84];
  const OSTINATO = [2, 0, 1, 2, 0, 1, 2, 1];
  const ACENTOS = new Set([0, 3, 6, 8, 11, 14]);

  /** Azar determinista: el mismo paso de la misma vuelta suena igual. */
  function azar(k, vuelta, sal) {
    let h = Math.imul(k + 1, 0x9E3779B1) ^ Math.imul(vuelta + 7, 0x85EBCA77) ^ Math.imul(sal + 3, 0xC2B2AE3D);
    h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D); h ^= h >>> 12;
    return (h >>> 0) / 4294967296;
  }

  /**
   * Lo que suena en el paso k (0‥127: ocho compases de semicorcheas).
   * e = {I, abismo, filo, vuelta}. Devuelve [{c, n|d, pasos, vol, ...}].
   * Canales: pad, bajo, sub, grave, lead, arp, brillo, alarma, bat.
   */
  function eventos(e, k) {
    const I = clamp(e.I), ab = !!e.abismo, filo = !!e.filo, v = e.vuelta || 0;
    k = ((k % 128) + 128) % 128;
    const b = Math.floor(k / 16), s = k % 16, bb = b % 4;
    const P = PROG[ab ? (filo ? 'sima' : 'abismo') : (filo ? 'filo' : 'luz')];
    const ac = P.acordes[bb], raiz = P.raices[bb], out = [];
    const bat = (d, vol) => out.push({ c: 'bat', d, vol: .34 * vol });

    // Colchón: un acorde por compás, más presente en el abismo.
    if (s === 0) for (const n of ac) out.push({ c: 'pad', n, pasos: 16, vol: ab ? .036 : .03 - .008 * I });

    if (!ab) {
      // Bajo: nota larga en calma, figura sincopada con tensión, pedal en el filo.
      if (filo) {
        const n = raiz + (b % 2 && s >= 14 ? 1 : 0);
        out.push({ c: 'bajo', n, pasos: .9, vol: s % 4 === 0 ? .15 : .1, onda: 'p50' });
      } else if (I < .35) {
        if (s === 0) out.push({ c: 'bajo', n: raiz, pasos: 16, vol: .15, onda: 'tri' });
      } else if (ACENTOS.has(s)) {
        out.push({ c: 'bajo', n: raiz + (s === 6 || s === 14 ? 12 : 0), pasos: 2, vol: .16, onda: 'tri' });
      }
      const m = !filo && MEL_LUZ[b][s];
      const vl = .12 * (1 - sm(.6, .85, I));
      if (m && vl > .004) out.push({ c: 'lead', n: m.n, pasos: m.pasos * .92, vol: vl, onda: 'tri' });
      // Burbujas: cuanto más tranquilo, más suben.
      if (s % 2 === 0 && azar(k, v, 1) < (1 - I) * .22) {
        out.push({ c: 'brillo', n: PENTA[Math.floor(azar(k, v, 2) * PENTA.length)], pasos: 2, vol: .05, sube: 2.2 });
      }
    } else {
      // Abismo: sub sostenido y un bajo saturado que se espesa con el peligro.
      if (s === 0) out.push({ c: 'sub', n: raiz, pasos: 16, vol: .24 });
      const denso = I > .8 ? true : I > .5 ? [0, 2, 3, 6, 8, 10, 12, 14].includes(s) : [0, 3, 6, 10, 12].includes(s);
      if (filo) {
        out.push({ c: 'grave', n: raiz + 12 + (b % 2 && s >= 14 ? 1 : 0), pasos: .85, vol: s % 4 === 0 ? .1 : .075 });
      } else if (denso) {
        out.push({ c: 'grave', n: raiz + 12 + (s === 14 && I > .5 ? 12 : 0), pasos: I > .8 ? .9 : 1.6, vol: .09 });
      }
      const m = !filo && MEL_ABISMO[b][s];
      const vl = .1 * (1 - .6 * sm(.7, .9, I));
      if (m) out.push({ c: 'lead', n: m.n, pasos: m.pasos * .95, vol: vl, onda: 'saw', det: 10 });
      // Gotas en la oscuridad: pocas y cayendo.
      if (s === 6 && azar(k, v, 3) < .35) out.push({ c: 'brillo', n: azar(k, v, 4) < .5 ? 81 : 86, pasos: 3, vol: .03, sube: .5 });
    }

    // Ostinato 3-3-2: aparece con la tensión.
    const vo = .06 * sm(.5, .8, I);
    if (vo > .002) {
      const n = ac[OSTINATO[s % 8] % ac.length] + (ab ? 0 : 12);
      out.push({ c: 'arp', n, pasos: .8, vol: vo * (ACENTOS.has(s) ? 1.4 : .8), onda: ab ? 'saw' : 'p25' });
    }
    // Arpegio medio: el pulso de la zona templada.
    const va = .045 * sm(.15, .45, I) * (1 - sm(.55, .8, I));
    if (va > .002 && s % 2 === 0) {
      const sube = [0, 1, 2, 3, 2, 1, 2, 3][(s / 2) % 8];
      out.push({ c: 'arp', n: ac[sube % ac.length] + 12, pasos: 1.6, vol: va, onda: ab ? 'saw' : 'p12' });
    }
    // Alarma: una segunda menor que roza cuando ya casi se pierde.
    if (I > .86 && (s === 0 || s === 8)) {
      const vx = .04 * sm(.86, 1, I);
      for (const n of ab ? [68, 69] : [81, 82]) out.push({ c: 'alarma', n, pasos: 3, vol: vx, onda: 'p12' });
    }

    // Batería.
    if (!ab) {
      const bombos = I < .25 ? [0] : I < .62 ? [0, 7, 10] : [0, 3, 6, 8, 10, 14];
      if (bombos.includes(s)) bat('k', s === 0 ? 1 : .8);
      if (I >= .3 && (s === 4 || s === 12)) bat('s', .85);
      if (I > .75 && (b === 3 || b === 7) && s >= 12) bat('s', .45 + .15 * (s - 12));
      if (I < .2) { if (s === 6 || s === 14) bat('h', .5); }
      else if (I < .62) { if (s % 2 === 0) bat('h', s % 4 ? .6 : .9); }
      else bat(s === 14 ? 'o' : 'h', s % 2 ? .6 : 1);
      if (I > .5 && k % 64 === 0) bat('x', .8);
    } else {
      const K = [0, 10].concat(I > .45 ? [7] : [], I > .8 ? [3, 14] : []);
      if (K.includes(s)) bat('K', s === 0 ? 1 : .8);
      if (s === 8) { bat('c', .9); bat('s', .5); }
      bat('h', s % 2 ? .45 : .7);
      if (I > .5 && (s === 6 || s === 14)) bat('o', .6);
      if (b === 7 && s >= 12) bat(s % 2 ? 'T' : 't', .7);
      if (k === 0) bat('x', .7);
    }
    if (I > .9 && (s === 0 || s === 3)) bat('t', s ? .6 : .9);
    return out;
  }

  /* ---------- El agendador ---------- */

  function saturador(ctx) {
    if (typeof ctx.createWaveShaper !== 'function') return null;
    const n = 1024, curva = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curva[i] = Math.tanh(3 * x) / Math.tanh(3); }
    const w = ctx.createWaveShaper(); w.curve = curva; w.oversample = '2x';
    return w;
  }
  function filtro(ctx, tipo, f, q) {
    if (typeof ctx.createBiquadFilter !== 'function') return null;
    const x = ctx.createBiquadFilter(); x.type = tipo; x.frequency.value = f; x.Q.value = q;
    return x;
  }
  /** Encadena nodos saltando los que el contexto no sabe crear. */
  function cadena(...ns) {
    const v = ns.filter(Boolean);
    for (let i = 0; i < v.length - 1; i++) v[i].connect(v[i + 1]);
    return v[0];
  }

  class Motor {
    constructor(ctx, dest) {
      this.ctx = ctx; this.voces = new Set();
      this.k = 0; this.vuelta = 0; this.sig = ctx.currentTime + .05;
      this.I = 0; this.meta = 0; this.filo = false; this.abismo = false; this.pideAbismo = false;
      this.visto = ctx.currentTime;
      this.salida = ctx.createGain(); this.salida.connect(dest);
      // Lo que respira con el 808 pasa por `bomba`; el bajo y la batería no.
      this.bomba = ctx.createGain(); this.bomba.connect(this.salida);
      const g = () => ctx.createGain();
      this.canal = { pad: g(), bajo: g(), sub: g(), grave: g(), lead: g(), arp: g(), brillo: g(), alarma: g(), bat: g() };
      this.fPad = filtro(ctx, 'lowpass', 900, 1.5);
      this.fGrave = filtro(ctx, 'lowpass', 400, 6);
      this.fArp = filtro(ctx, 'lowpass', 3000, 2);
      cadena(this.canal.pad, this.fPad, this.bomba);
      cadena(this.canal.grave, saturador(ctx), this.fGrave, this.bomba);
      cadena(this.canal.arp, this.fArp, this.bomba);
      this.canal.lead.connect(this.bomba);
      for (const c of ['bajo', 'sub', 'brillo', 'alarma', 'bat']) this.canal[c].connect(this.salida);
      this.nodos = [this.salida, this.bomba, ...Object.values(this.canal), this.fPad, this.fGrave, this.fArp].filter(Boolean);
      if (typeof ctx.createDelay === 'function') {
        try {
          const d = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
          d.delayTime.value = this.paso() * 3; fb.gain.value = .32; wet.gain.value = .26;
          this.canal.lead.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(this.bomba);
          this.eco = d; this.nodos.push(d, fb, wet);
        } catch (e) { this.eco = null; }
      }
    }
    /** Lo que el juego dice del tablero; I se acerca sola, sin saltos. */
    animo(o) {
      this.meta = intensidad(o);
      this.pideAbismo = (o && o.ronda) >= 100;
    }
    bpm() { return this.abismo ? 84 + 26 * this.I : 98 + 34 * this.I; }
    paso() { return 60 / this.bpm() / 4; }
    tick(margen) {
      const ctx = this.ctx, ahora = ctx.currentTime, hasta = ahora + (margen || .2);
      const dt = Math.max(0, Math.min(1, ahora - this.visto)); this.visto = ahora;
      this.I += (this.meta - this.I) * (1 - Math.exp(-dt / 1.6));
      if (this.sig < ahora - .25) this.sig = ahora + .03;
      for (const v of this.voces) if (v.fin < ahora - .5) this.voces.delete(v);
      let n = 0;
      while (this.sig < hasta && n++ < 64) {
        const t = Math.max(this.sig, ahora), d = this.paso();
        this.toca(t, d);
        this.sig += d;
        if (++this.k >= 128) { this.k = 0; this.vuelta++; }
      }
    }
    toca(t, d) {
      const s = this.k % 16;
      if (s === 0) {
        // La armonía y el lugar sólo cambian al empezar un compás.
        this.filo = siguienteArmonia(this.filo ? 'filo' : 'calma', this.I) === 'filo';
        if (this.pideAbismo !== this.abismo) {
          this.abismo = this.pideAbismo;
          if (this.abismo) this.caida(t);
        }
      }
      if (s % 4 === 0) this.colorea(t, d);
      const e = { I: this.I, abismo: this.abismo, filo: this.filo, vuelta: this.vuelta };
      for (const ev of eventos(e, this.k)) this.suena(ev, t, d);
    }
    /** Filtros y eco siguen a I cada tiempo. */
    colorea(t, d) {
      const I = this.I, ab = this.abismo, pon = (p, v) => { try { p.setTargetAtTime(v, t, .25); } catch (e) {} };
      if (this.fPad) { pon(this.fPad.frequency, ab ? 260 + 1100 * I : 650 + 2800 * I); pon(this.fPad.Q, ab ? 3 + 4 * I : 1 + 2 * I); }
      if (this.fGrave) pon(this.fGrave.frequency, 160 + 1000 * I);
      if (this.fArp) pon(this.fArp.frequency, ab ? 900 + 1800 * I : 2200 + 3000 * I);
      if (this.eco) pon(this.eco.delayTime, Math.min(.9, d * 3));
    }
    suena(ev, t, d) {
      const ctx = this.ctx, V = this.voces, dest = this.canal[ev.c];
      if (ev.c === 'bat') return this.golpe(ev.d, t, ev.vol, d);
      const f = hz(ev.n), dur = d * ev.pasos;
      if (!Number.isFinite(f)) return;
      if (ev.c === 'pad') {
        this.colchon(t, f, dur, ev.vol, 7); this.colchon(t, f, dur, ev.vol, -7);
      } else if (ev.c === 'sub') {
        Chip.voz(ctx, dest, { t, f, dur, vol: ev.vol, onda: 'sine', sus: .9 }, V);
      } else if (ev.c === 'grave') {
        Chip.voz(ctx, dest, { t, f, dur, vol: ev.vol * .6, onda: 'saw', det: 12, sus: .8 }, V);
        Chip.voz(ctx, dest, { t, f, dur, vol: ev.vol * .6, onda: 'saw', det: -12, sus: .8 }, V);
      } else if (ev.c === 'brillo') {
        Chip.voz(ctx, dest, { t, f, f1: f * ev.sube, dur: Math.min(.3, dur), vol: ev.vol, onda: 'sine', sus: .4 }, V);
      } else if (ev.det) {
        const o = { t, f, dur, vol: ev.vol * .62, onda: ev.onda, vib: .005, sus: .8 };
        Chip.voz(ctx, dest, Object.assign({}, o, { det: ev.det }), V);
        Chip.voz(ctx, dest, Object.assign({}, o, { det: -ev.det }), V);
      } else {
        Chip.voz(ctx, dest, { t, f, dur, vol: ev.vol, onda: ev.onda || 'p25', vib: ev.c === 'lead' ? .005 : 0, sus: ev.c === 'bajo' ? 1 : .7 }, V);
      }
    }
    /** Una voz de colchón: sierra desafinada con ataque y caída lentos. */
    colchon(t, f, dur, vol, det) {
      const ctx = this.ctx, osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f, t);
      if (osc.detune) osc.detune.setValueAtTime(det, t);
      const sube = Math.min(.6, dur * .3), fin = t + dur + .35;
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(vol * .6, t + sube);
      g.gain.setValueAtTime(vol * .6, t + dur);
      g.gain.linearRampToValueAtTime(.0001, fin);
      osc.connect(g); g.connect(this.canal.pad);
      osc.start(t); osc.stop(fin + .02);
      this.voces.add({ fuente: osc, nodos: [osc, g], fin: fin + .02 });
      osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
    }
    golpe(d, t, vol, paso) {
      const S = Chip.Sinte, ctx = this.ctx, dest = this.canal.bat, V = this.voces;
      switch (d) {
        case 'k': S.bombo(ctx, dest, t, vol, V); break;
        case 's': S.caja(ctx, dest, t, vol, V); break;
        case 'h': S.plato(ctx, dest, t, vol, .04, V); break;
        case 'o': S.plato(ctx, dest, t, vol * 1.1, .2, V); break;
        case 'x': S.platillo(ctx, dest, t, vol, V); break;
        case 't': S.tambor(ctx, dest, t, vol, false, V); break;
        case 'T': S.tambor(ctx, dest, t, vol, true, V); break;
        case 'K': S.bombo808(ctx, dest, t, vol, V); break;
        case 'c': S.palmas(ctx, dest, t, vol, V); break;
      }
      // El 808 hunde el colchón, el bajo saturado y la melodía y los deja volver.
      if (d === 'K' || (d === 'k' && this.I > .62)) {
        const prof = d === 'K' ? .6 : .25, gp = this.bomba.gain;
        try { gp.cancelScheduledValues(t); gp.setValueAtTime(1 - prof, t); gp.linearRampToValueAtTime(1, t + Math.min(.35, paso * 3.5)); } catch (e) {}
      }
    }
    /** Entrar al abismo: un sub que se desploma, platillo y un golpe grave. */
    caida(t) {
      const ctx = this.ctx, V = this.voces;
      Chip.voz(ctx, this.canal.sub, { t, f: 110, f1: 28, dur: 2.2, vol: .26, onda: 'sine', sus: .9 }, V);
      Chip.Sinte.platillo(ctx, this.canal.bat, t, .55, V);
      Chip.Sinte.tambor(ctx, this.canal.bat, t, .6, false, V);
    }
    detener() {
      for (const v of this.voces) {
        try { v.fuente.stop(0); } catch (e) {}
        for (const n of v.nodos) { try { n.disconnect(); } catch (e) {} }
      }
      this.voces.clear();
      this.sig = this.ctx.currentTime + .05;
    }
    /** Desde el principio, sin la caída: una partida nueva no es una sorpresa. */
    reinicia() {
      this.detener();
      this.k = 0; this.vuelta = 0; this.I = this.meta; this.filo = false;
      this.abismo = this.pideAbismo; this.visto = this.ctx.currentTime;
    }
    destruir() {
      this.detener();
      for (const n of this.nodos) { try { n.disconnect(); } catch (e) {} }
    }
  }

  const API = { intensidad, siguienteArmonia, eventos, Motor, PELIGRO, PROG, MEL_LUZ, MEL_ABISMO };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.BBTANMusica = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
