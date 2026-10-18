// =====================================================================
//  PRO DEFENDER — Audio sintetizado con Web Audio (sin archivos)
//  Efectos de sonido + banda sonora compuesta en tiempo real: cada reino
//  tiene su canción con secciones (intro, estrofa, puente, estribillo y
//  pausa), melodías que se reescriben en cada vuelta y un modo batalla
//  cuando aparece un jefe.
// =====================================================================
(function () {
  const PD = (globalThis.PD = globalThis.PD || {});

  const A = {
    ctx: null, master: null, sfx: null, atk: null, mus: null, verb: null, mverb: null, delIn: null, dL: null, dR: null, noiseBuf: null,
    sfxVol: 0.8, musVol: 0.45, muted: false,
    last: {}, voices: 0, music: null, intensity: 0
  };
  const MUS_GAIN = 0.6;
  const GKEYS = ['ctx', 'master', 'sfx', 'atk', 'mus', 'verb', 'mverb', 'delIn', 'dL', 'dR', 'noiseBuf'];
  const wrap = (n, m) => ((n % m) + m) % m;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // --------------------------- Inicialización ---------------------------
  // respuesta al impulso sintética: ruido que se oscurece mientras decae
  function makeIR(c, secs, decay) {
    const len = Math.floor(c.sampleRate * secs), ir = c.createBuffer(2, len, c.sampleRate);
    const pre = Math.floor(c.sampleRate * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const k = i / len, a = 0.1 + 0.8 * k;
        lp += (Math.random() * 2 - 1 - lp) * (1 - a);
        d[i] = lp * Math.pow(1 - k, decay);
      }
    }
    return ir;
  }
  function graph(c, muted) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    const master = c.createGain(); master.gain.value = muted ? 0 : 1;
    master.connect(comp); comp.connect(c.destination);
    const sfx = c.createGain(); sfx.gain.value = A.sfxVol; sfx.connect(master);
    // bus de ataques de torres: más bajo y sin agudos molestos
    const atk = c.createGain(); atk.gain.value = 0.9;
    const atkLp = c.createBiquadFilter(); atkLp.type = 'lowpass'; atkLp.frequency.value = 4500; atkLp.Q.value = 0.5;
    const atkSh = c.createBiquadFilter(); atkSh.type = 'highshelf'; atkSh.frequency.value = 2500; atkSh.gain.value = -4;
    atk.connect(atkSh); atkSh.connect(atkLp); atkLp.connect(sfx);
    const mus = c.createGain(); mus.gain.value = A.musVol * MUS_GAIN; mus.connect(master);
    const verb = c.createConvolver(); verb.buffer = makeIR(c, 2.2, 2.6);
    const vg = c.createGain(); vg.gain.value = 0.35; verb.connect(vg); vg.connect(sfx);
    // reverberación y eco propios de la música (escalan con su volumen)
    const mverb = c.createConvolver(); mverb.buffer = makeIR(c, 3, 2.3);
    const mvg = c.createGain(); mvg.gain.value = 0.6; mverb.connect(mvg); mvg.connect(mus);
    const delIn = c.createGain(), dL = c.createDelay(2), dR = c.createDelay(2), fb = c.createGain(), dlp = c.createBiquadFilter();
    dL.delayTime.value = dR.delayTime.value = 0.36; fb.gain.value = 0.35; dlp.type = 'lowpass'; dlp.frequency.value = 3200;
    const pL = c.createStereoPanner(), pR = c.createStereoPanner(); pL.pan.value = -0.75; pR.pan.value = 0.75;
    const dOut = c.createGain(); dOut.gain.value = 0.5;
    delIn.connect(dL); dL.connect(pL); pL.connect(dOut); dL.connect(dR); dR.connect(pR); pR.connect(dOut);
    dR.connect(dlp); dlp.connect(fb); fb.connect(dL); dOut.connect(mus);
    const noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return { ctx: c, master, sfx, atk, mus, verb, mverb, delIn, dL, dR, noiseBuf };
  }
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    Object.assign(A, graph(new AC(), A.muted));
    if (A.pendingMusic !== undefined) A.playMusic(A.pendingMusic);
  };
  A.setVolumes = function (sfx, mus) {
    A.sfxVol = sfx; A.musVol = mus;
    if (A.sfx) A.sfx.gain.value = sfx;
    if (A.mus) A.mus.gain.value = mus * MUS_GAIN;
  };
  A.setMuted = function (m) {
    A.muted = m;
    if (A.master) A.master.gain.setTargetAtTime(m ? 0 : 1, A.ctx.currentTime, 0.05);
  };

  // ----------------------------- Primitivas -----------------------------
  let CUR = null;   // bus por defecto mientras suena un efecto (ataques → A.atk)
  function out(pan, bus, verb) {
    const c = A.ctx;
    let node = bus || CUR || A.sfx;
    if (pan !== undefined && pan !== 0 && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(node); node = p;
    }
    if (verb) {
      const g = c.createGain(); g.gain.value = verb;
      g.connect(A.verb);
      const split = c.createGain(); split.connect(node); split.connect(g);
      return split;
    }
    return node;
  }
  // oscilador con barrido de frecuencia y envolvente percusiva
  function tone(o) {
    const c = A.ctx, t = o.t || c.currentTime;
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || o.dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    const a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.lp || o.hp || o.bp) {
      const f = c.createBiquadFilter();
      f.type = o.lp ? 'lowpass' : o.hp ? 'highpass' : 'bandpass';
      f.frequency.value = o.lp || o.hp || o.bp; f.Q.value = o.q || 0.8;
      node.connect(f); node = f;
    }
    node.connect(g); g.connect(o.dest || out(o.pan, o.bus, o.verb));
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  // ráfaga de ruido filtrado
  function noise(o) {
    const c = A.ctx, t = o.t || c.currentTime;
    const src = c.createBufferSource();
    src.buffer = A.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.ft || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.value = o.q || 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.dest || out(o.pan, o.bus, o.verb));
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ------------------------ Instrumentos (voces) -------------------------
  // Todas reciben dst(nodo): una función que conecta la salida donde toque.
  function O(type, f, t, det) {
    const o = A.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (det) o.detune.setValueAtTime(det, t);
    return o;
  }
  function F(type, f, q) { const b = A.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q === undefined ? 0.7 : q; return b; }
  function G(v) { const g = A.ctx.createGain(); g.gain.value = v; return g; }
  function N(t, dur) { const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur); return s; }
  function run(list, t, end) { for (const o of list) { o.start(t); o.stop(end); } }
  // envolvente: ataque lineal, caída al sostenido y liberación exponencial
  function env(g, t, a, v, sus, dec, end, rel) {
    const p = g.gain;
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(v, t + a);
    if (sus < 1) p.setTargetAtTime(v * sus, t + a, dec);
    p.setTargetAtTime(0, Math.max(t + a + 0.001, end), rel);
  }
  let DIST = null;
  function distCurve() {
    if (DIST) return DIST;
    DIST = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) DIST[i] = Math.tanh((i / 1023 * 2 - 1) * 3.5);
    return DIST;
  }

  const V = {
    // síntesis FM: campanas, marimbas, pianos eléctricos
    fm(t, f, v, dst, ratio, index, decay) {
      const car = O('sine', f, t), mod = O('sine', f * ratio, t), mg = G(0), g = G(0);
      mg.gain.setValueAtTime(f * index, t); mg.gain.setTargetAtTime(f * index * 0.06, t, decay * 0.22);
      mod.connect(mg); mg.connect(car.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, decay * 0.3);
      car.connect(g); dst(g); run([car, mod], t, t + decay * 2 + 0.05);
    },
    // sintetizador pulsado con filtro que se cierra
    pluck(t, f, dur, v, dst, bright, decay) {
      const a = O('sawtooth', f, t, -8), b = O('sawtooth', f, t, 8), lp = F('lowpass', 300, 4);
      lp.frequency.setValueAtTime(350 + bright * 5200, t); lp.frequency.setTargetAtTime(200 + bright * 500, t, decay * 0.35);
      const g = G(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, decay * 0.45);
      a.connect(lp); b.connect(lp); lp.connect(g); dst(g); run([a, b], t, t + decay * 3 + 0.05);
    },
    // voz solista: sierra doble (saw), lengüeta (reed) o flauta (flute)
    lead(t, f, dur, v, dst, o) {
      const k = o.kind, list = [];
      const add = (type, mult, det, vol) => { const x = O(type, f * mult, t, det), g = G(vol); x.connect(g); list.push([x, mult, g]); };
      if (k === 'flute') { add('sine', 1, 0, 1); add('triangle', 1, 6, 0.35); add('sine', 2, 0, 0.08); }
      else if (k === 'reed') { add('sawtooth', 1, -4, 0.7); add('square', 1, 5, 0.5); }
      else { add('sawtooth', 1, -11, 0.6); add('sawtooth', 1, 11, 0.6); add('square', 0.5, 0, 0.3); }
      const lfo = O('sine', k === 'reed' ? 6.3 : 5.5, t), lg = G(0);
      lg.gain.setValueAtTime(0, t);
      if (dur > 0.2) lg.gain.linearRampToValueAtTime(k === 'reed' ? 30 : k === 'flute' ? 14 : 17, t + Math.min(dur, 0.5));
      lfo.connect(lg);
      let flt;
      if (k === 'flute') flt = F('lowpass', 3800, 0.5);
      else if (k === 'reed') flt = F('lowpass', Math.min(9000, f * 5), 3.5);
      else {
        const cut = 1600 + (o.bright || 0.5) * 3600;
        flt = F('lowpass', cut, 1.6);
        flt.frequency.setValueAtTime(cut * 0.35, t); flt.frequency.exponentialRampToValueAtTime(cut, t + 0.035); flt.frequency.setTargetAtTime(cut * 0.6, t + 0.04, 0.3);
      }
      const glide = k === 'reed' ? 0.08 : 0.045;
      const from = o.prev || (o.orn ? f * 0.944 : 0);
      for (const [x, mult, g] of list) {
        if (from) { x.frequency.setValueAtTime(from * mult, t); x.frequency.exponentialRampToValueAtTime(f * mult, t + glide); }
        lg.connect(x.detune); g.connect(flt);
      }
      const amp = G(0);
      env(amp, t, k === 'flute' ? 0.05 : k === 'reed' ? 0.025 : 0.008, v, 0.82, 0.12, t + dur, 0.07);
      flt.connect(amp);
      if (k === 'reed') { const hp = F('highpass', 280); amp.connect(hp); dst(hp); } else dst(amp);
      if (k === 'flute') {
        const n = N(t, dur + 0.3), bp = F('bandpass', f * 2.2, 1.2), ng = G(0);
        env(ng, t, 0.02, v * 0.16, 0.25, 0.05, t + dur, 0.05);
        n.connect(bp); bp.connect(ng); dst(ng);
      }
      run(list.map(l => l[0]).concat(lfo), t, t + dur + 0.5);
    },
    // metales: sierras con filtro que se abre y un pequeño "scoop" de afinación
    brass(t, f, dur, v, dst, att) {
      const a = O('sawtooth', f * 0.98, t, -7), b = O('sawtooth', f * 0.98, t, 7), s = O('square', f * 0.98, t), sg = G(0.25);
      for (const x of [a, b, s]) x.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      const at = att || 0.025, lp = F('lowpass', 450, 1.1);
      lp.frequency.setValueAtTime(450, t); lp.frequency.linearRampToValueAtTime(3200, t + at + 0.05);
      lp.frequency.setTargetAtTime(1500, t + at + 0.06, 0.25); lp.frequency.setTargetAtTime(400, t + dur, 0.1);
      a.connect(lp); b.connect(lp); s.connect(sg); sg.connect(lp);
      const g = G(0); env(g, t, at, v, 0.85, 0.15, t + dur, 0.09); lp.connect(g); dst(g);
      run([a, b, s], t, t + dur + 0.6);
    },
    // colchón armónico estéreo
    pad(t, fs, dur, v, dst, kind, cut) {
      const lp = F('lowpass', cut * 0.55, 0.6);
      lp.frequency.setValueAtTime(cut * 0.55, t); lp.frequency.linearRampToValueAtTime(cut, t + dur * 0.5);
      const g = G(0); env(g, t, kind === 'glass' ? 0.45 : 0.22, v, 0.85, 0.5, t + dur, 0.3);
      const pl = A.ctx.createStereoPanner(), pr = A.ctx.createStereoPanner(); pl.pan.value = -0.6; pr.pan.value = 0.6;
      pl.connect(lp); pr.connect(lp); lp.connect(g); dst(g);
      const list = [];
      for (const f of fs) {
        if (kind === 'glass') {
          const x = O('triangle', f, t, -7), y = O('sine', f, t, 7), z = O('sine', f * 2, t, 3), zg = G(0.18);
          x.connect(pl); y.connect(pr); z.connect(zg); zg.connect(lp); list.push(x, y, z);
        } else {
          const d = kind === 'dark' ? 19 : 13, x = O('sawtooth', f, t, -d), y = O('sawtooth', f, t, d);
          x.connect(pl); y.connect(pr); list.push(x, y);
        }
      }
      run(list, t, t + dur + 1.6);
    },
    // bajos: sub, pulsado, "reese" desafinado o distorsionado
    bass(t, f, dur, v, dst, kind, bright) {
      const g = G(0), sub = O('sine', f, t), subG = G(kind === 'sub' ? 1 : 0.7), list = [sub];
      sub.connect(subG); subG.connect(g);
      if (kind === 'sub') { const tr = O('triangle', f * 2, t), tg = G(0.12); tr.connect(tg); tg.connect(g); list.push(tr); }
      else {
        const top = kind === 'pluck' ? 2600 : kind === 'dist' ? 1900 : 1500, base = kind === 'pluck' ? 260 : kind === 'dist' ? 900 : 600;
        const lp = F('lowpass', base, kind === 'pluck' ? 5 : 1.4);
        lp.frequency.setValueAtTime(top * (0.7 + (bright || 0) * 0.6), t); lp.frequency.setTargetAtTime(base, t + 0.005, kind === 'pluck' ? 0.07 : 0.15);
        let inp = lp;
        if (kind === 'dist') { const pre = G(2.6), sh = A.ctx.createWaveShaper(); sh.curve = distCurve(); pre.connect(sh); sh.connect(lp); inp = pre; }
        const x = O('sawtooth', f, t, kind === 'saw' ? -14 : 0), xg = G(0.45); x.connect(xg); xg.connect(inp); list.push(x);
        if (kind !== 'pluck') { const y = O(kind === 'dist' ? 'square' : 'sawtooth', f, t, kind === 'saw' ? 14 : 7), yg = G(0.45); y.connect(yg); yg.connect(inp); list.push(y); }
        const o = G(kind === 'dist' ? 0.4 : 0.8); lp.connect(o); o.connect(g);
      }
      env(g, t, 0.005, v, 0.9, 0.2, t + dur, 0.035); dst(g); run(list, t, t + dur + 0.3);
    }
  };
  // instrumentos de ataque usados para arpegios, melodías alternas y armonías
  function keyInst(name, t, f, dur, v, dst, bright) {
    switch (name) {
      case 'marimba': V.fm(t, f, v, dst, 4, 1.3, 0.55); break;
      case 'kalimba': V.fm(t, f, v, dst, 3, 1.1, 0.8); V.fm(t, f, v * 0.35, dst, 7, 0.7, 0.09); break;
      case 'bell': V.fm(t, f, v, dst, 3.5, 2, 1.4); V.fm(t, f, v * 0.5, dst, 1, 0.4, 1.1); break;
      case 'bellS': V.fm(t, f, v, dst, 3.5, 1.8, 0.6); break;
      case 'epiano': V.fm(t, f, v, dst, 1, 1.4, 1.1); V.fm(t, f, v * 0.3, dst, 14, 0.35, 0.06); break;
      case 'chug': V.pluck(t, f, dur, v, dst, 0.12 + bright * 0.2, 0.09); break;
      default: V.pluck(t, f, dur, v, dst, bright, 0.2);
    }
  }

  // ------------------------------ Batería --------------------------------
  const D = {
    kick(t, v, dst) {
      const o = O('sine', 160, t), g = G(0);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.setTargetAtTime(0, t + 0.03, 0.11);
      o.connect(g); dst(g); o.start(t); o.stop(t + 0.7);
      const n = N(t, 0.03), hp = F('highpass', 2500), ng = G(0);
      ng.gain.setValueAtTime(v * 0.22, t); ng.gain.setTargetAtTime(0, t, 0.004);
      n.connect(hp); hp.connect(ng); dst(ng);
    },
    snare(t, v, dst) {
      const n = N(t, 0.35), hp = F('highpass', 1300), lp = F('lowpass', 9000), g = G(0);
      g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t + 0.005, 0.055);
      n.connect(hp); hp.connect(lp); lp.connect(g); dst(g);
      const o = O('triangle', 220, t), og = G(0);
      o.frequency.exponentialRampToValueAtTime(165, t + 0.05);
      og.gain.setValueAtTime(v * 0.75, t); og.gain.setTargetAtTime(0, t + 0.003, 0.035);
      o.connect(og); dst(og); o.start(t); o.stop(t + 0.3);
    },
    clap(t, v, dst) {
      const n = N(t, 0.4), bp = F('bandpass', 1150, 1.1), g = G(0);
      g.gain.setValueAtTime(0, t);
      for (const k of [0, 0.01, 0.021]) { g.gain.setValueAtTime(v, t + k); g.gain.setTargetAtTime(v * 0.1, t + k + 0.0005, 0.003); }
      g.gain.setValueAtTime(v * 0.75, t + 0.031); g.gain.setTargetAtTime(0, t + 0.032, 0.06);
      n.connect(bp); bp.connect(g); dst(g);
    },
    hat(t, v, dst, open) {
      const n = N(t, open ? 0.6 : 0.12), hp = F('highpass', 7200), g = G(0);
      g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t + 0.002, open ? 0.1 : 0.014);
      n.connect(hp); hp.connect(g); dst(g);
    },
    tom(t, f, v, dst) {
      const o = O('sine', f * 1.6, t), g = G(0);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.02, 0.11);
      o.connect(g); dst(g); o.start(t); o.stop(t + 0.7);
      const n = N(t, 0.1), lp = F('lowpass', 900), ng = G(0);
      ng.gain.setValueAtTime(v * 0.3, t); ng.gain.setTargetAtTime(0, t, 0.015);
      n.connect(lp); lp.connect(ng); dst(ng);
    },
    crash(t, v, dst) {
      const n = N(t, 2.4), hp = F('highpass', 3800), g = G(0);
      g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t + 0.01, 0.5);
      n.connect(hp); hp.connect(g); dst(g);
    },
    shaker(t, v, dst) {
      const n = N(t, 0.1), bp = F('bandpass', 7000, 1.4), g = G(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.setTargetAtTime(0, t + 0.007, 0.018);
      n.connect(bp); bp.connect(g); dst(g);
    },
    riser(t, dur, v, dst) {
      const n = N(t, dur + 0.2), bp = F('bandpass', 350, 2.2), g = G(0);
      bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(7500, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur); g.gain.setTargetAtTime(0, t + dur, 0.02);
      n.connect(bp); bp.connect(g); dst(g);
    },
    drop(t, v, dst) {
      const o = O('sine', 85, t), g = G(0);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.9);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.setTargetAtTime(0, t + 0.05, 0.3);
      o.connect(g); dst(g); o.start(t); o.stop(t + 1.8);
    }
  };

  // ------------------------------ Efectos -------------------------------
  const sd = (verb, pan) => n => n.connect(out(pan, A.sfx, verb));
  // tónica de la canción que suena, para que las fanfarrias no desafinen
  const keyRoot = () => 48 + wrap((A.music ? A.music.th.root : 48) - 48, 12);
  // [intervalo mínimo en s, duración aproximada, función]
  const SFX = {
    thorn: [0.06, 0.08, (t, p) => { tone({ t, f: rnd(480, 540), f2: 230, dur: 0.06, v: 0.11, type: 'triangle', pan: p }); noise({ t, f: 1400, ft: 'bandpass', q: 1, dur: 0.025, v: 0.06, pan: p }); }],
    spear: [0.08, 0.25, (t, p) => { noise({ t, f: 400, f2: 1400, ft: 'bandpass', q: 1.5, dur: 0.18, v: 0.11, pan: p }); tone({ t, f: 140, f2: 55, dur: 0.15, v: 0.18, pan: p }); }],
    frost: [0.12, 0.45, (t, p) => { tone({ t, f: 880, dur: 0.35, v: 0.06, pan: p, verb: 0.4 }); tone({ t, f: 1320, dur: 0.2, v: 0.02, pan: p }); noise({ t, f: 2800, ft: 'bandpass', q: 0.8, dur: 0.2, v: 0.04, pan: p }); }],
    shard: [0.09, 0.1, (t, p) => tone({ t, f: 900, f2: 600, dur: 0.07, v: 0.085, type: 'triangle', pan: p })],
    zap: [0.08, 0.15, (t, p) => { tone({ t, f: rnd(80, 110), dur: 0.12, v: 0.1, type: 'sawtooth', lp: 1200, pan: p }); noise({ t, f: 1300, ft: 'bandpass', q: 2, dur: 0.1, v: 0.09, pan: p }); tone({ t, f: 600, f2: 180, dur: 0.09, v: 0.04, type: 'triangle', pan: p }); }],
    zapBig: [0.15, 0.4, (t, p) => { noise({ t, f: 900, f2: 160, ft: 'bandpass', q: 1.2, dur: 0.35, v: 0.13, pan: p }); tone({ t, f: 55, dur: 0.3, v: 0.15, type: 'sawtooth', lp: 450, pan: p }); }],
    mortar: [0.08, 0.25, (t, p) => { tone({ t, f: 150, f2: 50, dur: 0.22, v: 0.22, pan: p }); noise({ t, f: 700, f2: 150, dur: 0.18, v: 0.09, pan: p }); }],
    boom: [0.06, 0.6, (t, p) => { noise({ t, f: 1100, f2: 120, dur: 0.5, v: 0.17, pan: p, verb: 0.2 }); tone({ t, f: 95, f2: 32, dur: 0.45, v: 0.23, pan: p }); }],
    boomSmall: [0.05, 0.3, (t, p) => { noise({ t, f: 2000, f2: 250, dur: 0.25, v: 0.13, pan: p }); tone({ t, f: 130, f2: 50, dur: 0.18, v: 0.16, pan: p }); }],
    beam: [0.15, 0.25, (t, p) => { tone({ t, f: 260, f2: 520, dur: 0.2, v: 0.08, type: 'sawtooth', lp: 900, pan: p }); tone({ t, f: 780, dur: 0.16, v: 0.02, pan: p }); }],
    drone: [0.09, 0.05, (t, p) => tone({ t, f: rnd(480, 560), f2: 330, dur: 0.05, v: 0.085, type: 'triangle', pan: p })],
    missile: [0.12, 0.35, (t, p) => { noise({ t, f: 300, f2: 1300, ft: 'bandpass', q: 1, dur: 0.3, v: 0.22, a: 0.02, pan: p }); tone({ t, f: 180, f2: 90, dur: 0.12, v: 0.08, pan: p }); }],
    gravity: [0.15, 0.6, (t, p) => { tone({ t, f: 320, f2: 55, dur: 0.55, v: 0.18, pan: p, verb: 0.3 }); noise({ t, f: 3000, f2: 200, dur: 0.45, v: 0.06, pan: p }); }],
    sniper: [0.06, 0.2, (t, p) => { noise({ t, f: 2200, ft: 'bandpass', q: 0.7, dur: 0.05, v: 0.12, pan: p }); tone({ t, f: 260, f2: 60, dur: 0.14, v: 0.17, type: 'triangle', pan: p, verb: 0.15 }); }],
    sniperArc: [0.06, 0.12, (t, p) => { tone({ t, f: 700, f2: 280, dur: 0.09, v: 0.08, type: 'triangle', pan: p }); noise({ t, f: 1600, ft: 'bandpass', dur: 0.03, v: 0.05, pan: p }); }],
    mineSet: [0.15, 0.05, (t, p) => tone({ t, f: 620, f2: 480, dur: 0.05, v: 0.085, type: 'triangle', pan: p })],
    flame: [0.18, 0.25, (t, p) => noise({ t, f: 500, f2: 320, ft: 'bandpass', q: 0.7, dur: 0.24, v: 0.2, pan: p, a: 0.03 })],
    pop: [0.04, 0.09, (t, p) => { const f = rnd(260, 380); tone({ t, f, f2: f * 0.5, dur: 0.08, v: 0.09, type: 'triangle', pan: p }); }],
    bigPop: [0.06, 0.5, (t, p) => { noise({ t, f: 900, f2: 100, dur: 0.45, v: 0.15, pan: p }); tone({ t, f: 220, f2: 40, dur: 0.4, v: 0.19, type: 'sawtooth', lp: 500, pan: p }); }],
    rang: [0.12, 0.3, (t, p) => { noise({ t, f: 500, f2: 1100, ft: 'bandpass', q: 1.4, dur: 0.26, v: 0.07, a: 0.06, pan: p }); tone({ t, f: 300, f2: 380, dur: 0.18, v: 0.03, type: 'triangle', pan: p }); }],
    roots: [0.2, 0.35, (t, p) => { noise({ t, f: 260, f2: 160, ft: 'bandpass', q: 2, dur: 0.3, v: 0.12, a: 0.05, pan: p }); tone({ t, f: 110, f2: 80, dur: 0.25, v: 0.1, type: 'triangle', pan: p }); }],
    rootsBreak: [0.12, 0.3, (t, p) => { noise({ t, f: 900, f2: 200, ft: 'bandpass', q: 1, dur: 0.22, v: 0.12, pan: p }); tone({ t, f: 160, f2: 70, dur: 0.15, v: 0.1, type: 'triangle', pan: p }); }],
    saw: [0.15, 0.35, (t, p) => { tone({ t, f: 190, f2: 240, dur: 0.3, v: 0.05, type: 'sawtooth', lp: 900, a: 0.04, pan: p }); noise({ t, f: 1800, ft: 'bandpass', q: 3, dur: 0.25, v: 0.035, a: 0.04, pan: p }); }],
    acid: [0.12, 0.2, (t, p) => { tone({ t, f: 240, f2: 420, dur: 0.12, v: 0.08, type: 'triangle', pan: p }); }],
    acidHit: [0.1, 0.3, (t, p) => { noise({ t, f: 700, f2: 300, ft: 'bandpass', q: 1.2, dur: 0.22, v: 0.1, pan: p }); for (let i = 0; i < 3; i++) tone({ t: t + 0.04 + i * 0.05, f: rnd(330, 520), dur: 0.05, v: 0.03, type: 'sine', pan: p }); }],
    flashB: [0.2, 0.6, (t, p) => { tone({ t, f: 784, dur: 0.5, v: 0.045, pan: p, verb: 0.5 }); tone({ t, f: 1175, dur: 0.35, v: 0.02, pan: p, verb: 0.5 }); }],
    rail: [0.1, 0.3, (t, p) => { tone({ t, f: 220, f2: 70, dur: 0.18, v: 0.16, type: 'triangle', pan: p }); noise({ t, f: 1200, f2: 500, ft: 'bandpass', q: 1, dur: 0.12, v: 0.08, pan: p }); }],
    forge: [0.3, 0.5, (t, p) => { tone({ t, f: 523, dur: 0.4, v: 0.05, type: 'triangle', pan: p, verb: 0.3 }); tone({ t, f: 130, f2: 90, dur: 0.2, v: 0.1, pan: p }); }],
    golemHit: [0.12, 0.15, (t, p) => { tone({ t, f: 120, f2: 60, dur: 0.12, v: 0.13, type: 'triangle', pan: p }); noise({ t, f: 500, dur: 0.06, v: 0.05, pan: p }); }],
    geyser: [0.15, 0.5, (t, p) => { noise({ t, f: 400, f2: 1600, ft: 'bandpass', q: 0.8, dur: 0.45, v: 0.13, a: 0.03, pan: p }); tone({ t, f: 90, f2: 60, dur: 0.25, v: 0.1, pan: p }); }],
    hex: [0.2, 0.45, (t, p) => { tone({ t, f: 196, f2: 185, dur: 0.4, v: 0.07, type: 'sawtooth', lp: 700, pan: p, verb: 0.4 }); tone({ t, f: 277, dur: 0.3, v: 0.03, pan: p, verb: 0.4 }); }],
    blade: [0.14, 0.15, (t, p) => { noise({ t, f: 1600, f2: 700, ft: 'bandpass', q: 1.5, dur: 0.12, v: 0.06, a: 0.02, pan: p }); }],
    shield: [0.1, 0.2, (t, p) => { tone({ t, f: 740, dur: 0.18, v: 0.06, type: 'triangle', pan: p }); tone({ t, f: 1110, dur: 0.1, v: 0.02, pan: p }); }],
    leak: [0.25, 0.5, (t, p) => { tone({ t, f: 440, dur: 0.18, v: 0.09, type: 'square', lp: 1800, pan: p }); tone({ t: t + 0.18, f: 311, dur: 0.25, v: 0.09, type: 'square', lp: 1800, pan: p }); }],
    heal: [0.3, 0.4, (t, p) => { tone({ t, f: 660, f2: 990, dur: 0.35, v: 0.04, pan: p, verb: 0.4 }); }],
    sabotage: [0.25, 0.4, (t, p) => { for (let i = 0; i < 5; i++) tone({ t: t + i * 0.05, f: rnd(150, 900), dur: 0.05, v: 0.06, type: 'square', lp: 2000, pan: p }); }],
    teleport: [0.15, 0.35, (t, p) => { tone({ t, f: 200, f2: 1800, dur: 0.18, v: 0.06, pan: p }); tone({ t: t + 0.15, f: 1800, f2: 220, dur: 0.18, v: 0.05, pan: p }); }],
    freezeBurst: [0.2, 0.6, (t, p) => { noise({ t, f: 8000, f2: 1500, ft: 'highpass', dur: 0.5, v: 0.1, pan: p, verb: 0.5 }); tone({ t, f: 2093, dur: 0.5, v: 0.04, pan: p }); }],
    revive: [0.5, 1.4, (t, p) => { noise({ t, f: 200, f2: 4000, ft: 'bandpass', q: 1, dur: 1.2, v: 0.2, a: 0.4, pan: p, verb: 0.4 }); [262, 330, 392, 523].forEach((f, i) => tone({ t: t + 0.4 + i * 0.1, f, dur: 0.8, v: 0.06, type: 'sawtooth', lp: 2000, verb: 0.5 })); }],
    bossDeath: [0.5, 1.6, (t, p) => { noise({ t, f: 1600, f2: 60, dur: 1.5, v: 0.4, pan: p, verb: 0.4 }); tone({ t, f: 110, f2: 25, dur: 1.4, v: 0.45, type: 'sawtooth', lp: 400 }); [523, 392, 330, 262].forEach((f, i) => tone({ t: t + 0.3 + i * 0.12, f, dur: 0.6, v: 0.05, type: 'triangle', verb: 0.5 })); }],
    // jefe: metales graves que crecen y tambores de guerra
    bossSpawn: [1, 2.2, (t) => {
      const d = sd(0.45), r = keyRoot();
      for (const n of [r - 24, r - 17, r - 12, r - 11]) V.brass(t, mtof(n), 1.5, 0.05, d, 0.6);
      for (let i = 0; i < 3; i++) { D.tom(t + i * 0.28, 60, 0.55, d); D.kick(t + i * 0.28, 0.4, d); }
      D.drop(t + 0.85, 0.35, d);
    }],
    place: [0.05, 0.2, (t, p) => { tone({ t, f: 300, f2: 140, dur: 0.14, v: 0.18, type: 'triangle', pan: p }); noise({ t, f: 1500, dur: 0.06, v: 0.08, pan: p }); }],
    upgrade: [0.05, 0.4, (t, p) => { [523, 659, 784, 1047].forEach((f, i) => tone({ t: t + i * 0.055, f, dur: 0.2, v: 0.07, type: 'triangle', pan: p, verb: 0.3 })); }],
    upgradeMax: [0.1, 1, (t, p) => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ t: t + i * 0.06, f, dur: 0.5, v: 0.07, type: 'triangle', pan: p, verb: 0.5 })); noise({ t, f: 6000, ft: 'highpass', dur: 0.8, v: 0.04, a: 0.2 }); }],
    sell: [0.05, 0.3, (t, p) => { tone({ t, f: 1568, dur: 0.1, v: 0.07, type: 'square', lp: 4000, pan: p }); tone({ t: t + 0.08, f: 2093, dur: 0.18, v: 0.07, type: 'square', lp: 4000, pan: p }); }],
    coin: [0.05, 0.2, (t) => { tone({ t, f: 1975, dur: 0.08, v: 0.05, type: 'square', lp: 5000 }); tone({ t: t + 0.06, f: 2637, dur: 0.15, v: 0.05, type: 'square', lp: 5000 }); }],
    // inicio de ronda: una sola nota de campana, cálida, en la tonalidad de la música
    roundStart: [0.4, 1.4, (t) => {
      const d = sd(0.35), f = mtof(keyRoot() + 12);
      V.fm(t, f, 0.11, d, 2, 1, 1.3);
      tone({ t, f, dur: 1.1, v: 0.05, a: 0.01, verb: 0.35 });
    }],
    roundEnd: [0.3, 1, (t) => {
      const d = sd(0.5), r = keyRoot();
      [r + 19, r + 24, r + 26, r + 31].forEach((n, i) => V.fm(t + i * 0.07, mtof(n), 0.05, d, 3.5, 1.6, 0.9));
      for (const n of [r, r + 7, r + 12]) V.brass(t, mtof(n), 0.35, 0.022, d, 0.06);
    }],
    unlock: [1, 2.2, (t) => {
      const d = sd(0.45), r = keyRoot();
      [r, r + 4, r + 7].forEach((n, i) => V.brass(t + i * 0.11, mtof(n + 12), 0.1, 0.045, d));
      for (const n of [r, r + 7, r + 12, r + 16, r + 19]) V.brass(t + 0.33, mtof(n), 1.1, 0.035, d);
      D.crash(t + 0.33, 0.1, d); D.tom(t + 0.33, 65, 0.45, d);
      [r + 24, r + 28, r + 31, r + 36].forEach((n, i) => V.fm(t + 0.45 + i * 0.09, mtof(n), 0.035, d, 3.5, 1.6, 1.2));
    }],
    victory: [1, 3.4, (t) => {
      const d = sd(0.45), r = keyRoot(), b = 0.16;
      [[0, 7, 1], [1, 7, 1], [2, 7, 1], [3, 12, 3]].forEach(([i, n, l]) => V.brass(t + i * b, mtof(r + n + 12), l * b * 0.9, 0.05, d));
      [[r + 5, r + 9, r + 12], [r + 7, r + 11, r + 14], [r, r + 4, r + 7, r + 12]].forEach((ch, i) => {
        const tt = t + (6 + i * 2) * b;
        for (const n of ch) V.brass(tt, mtof(n), i === 2 ? 1.3 : 2 * b * 0.9, 0.035, d);
        D.tom(tt, 70, 0.4, d);
      });
      D.crash(t + 10 * b, 0.12, d);
      [r + 24, r + 28, r + 31, r + 36].forEach((n, i) => V.fm(t + 10 * b + i * 0.08, mtof(n), 0.035, d, 3.5, 1.6, 1.3));
    }],
    defeat: [1, 3, (t) => {
      const d = sd(0.45), r = keyRoot();
      [7, 6, 5, 3].forEach((n, i) => V.brass(t + i * 0.34, mtof(r + n), 0.42, 0.045, d, 0.05));
      for (const n of [r - 12, r - 5, r, r + 3]) V.brass(t + 1.36, mtof(n), 1.3, 0.03, d, 0.15);
      D.tom(t + 1.36, 55, 0.5, d);
    }],
    click: [0.03, 0.05, (t) => tone({ t, f: 900, f2: 700, dur: 0.04, v: 0.05, type: 'triangle' })],
    error: [0.1, 0.2, (t) => tone({ t, f: 140, dur: 0.16, v: 0.1, type: 'square', lp: 700 })],
    ab_absolute: [0.5, 1.2, (t) => { noise({ t, f: 9000, f2: 2000, ft: 'highpass', dur: 1.1, v: 0.18, verb: 0.6 }); [1568, 2093, 2637, 3136].forEach((f, i) => tone({ t: t + i * 0.05, f, dur: 1, v: 0.04, verb: 0.6 })); }],
    ab_judgement: [0.5, 1.5, (t) => { for (let i = 0; i < 6; i++) noise({ t: t + i * 0.09, f: 3000, f2: 120, dur: 0.6, v: 0.2, verb: 0.4 }); tone({ t, f: 60, f2: 30, dur: 1.2, v: 0.3, type: 'sawtooth', lp: 300 }); }],
    ab_meteors: [0.5, 1.5, (t) => { noise({ t, f: 300, f2: 3000, ft: 'bandpass', dur: 0.9, v: 0.2, a: 0.3, verb: 0.3 }); }],
    ab_supernova: [0.5, 1.6, (t) => { noise({ t, f: 200, f2: 8000, dur: 0.6, v: 0.15, a: 0.5 }); tone({ t: t + 0.55, f: 80, f2: 30, dur: 1, v: 0.4, verb: 0.5 }); noise({ t: t + 0.55, f: 4000, f2: 100, dur: 1, v: 0.3, verb: 0.5 }); }],
    ab_blackhole: [0.5, 2, (t) => { tone({ t, f: 90, f2: 30, dur: 1.8, v: 0.35, type: 'sawtooth', lp: 400, verb: 0.5 }); tone({ t, f: 92, f2: 31, dur: 1.8, v: 0.3, type: 'sawtooth', lp: 400 }); }],
    ab_treasure: [0.5, 1, (t) => { for (let i = 0; i < 8; i++) tone({ t: t + i * 0.06, f: rnd(1800, 3000), dur: 0.15, v: 0.05, type: 'square', lp: 5000, verb: 0.3 }); }],
    ab_wardrum: [0.5, 1.4, (t) => { for (let i = 0; i < 6; i++) { tone({ t: t + i * 0.2, f: 120, f2: 45, dur: 0.25, v: 0.35 }); noise({ t: t + i * 0.2 + 0.1, f: 1800, ft: 'bandpass', dur: 0.1, v: 0.1 }); } }],
    ab_inferno: [0.5, 1.4, (t) => { noise({ t, f: 300, f2: 1200, ft: 'bandpass', q: 0.6, dur: 1.3, v: 0.3, a: 0.2, verb: 0.3 }); tone({ t, f: 70, dur: 1.2, v: 0.2, type: 'sawtooth', lp: 300 }); }]
  };

  const ATK = new Set(['thorn', 'spear', 'frost', 'shard', 'zap', 'zapBig', 'mortar', 'boom', 'boomSmall', 'beam', 'drone', 'missile', 'gravity', 'sniper', 'sniperArc', 'mineSet', 'flame', 'pop', 'bigPop', 'shield',
    'rang', 'roots', 'rootsBreak', 'saw', 'acid', 'acidHit', 'flashB', 'rail', 'forge', 'golemHit', 'geyser', 'hex', 'blade']);
  A.play = function (name, x) {
    if (!A.ctx || A.muted || A.sfxVol <= 0) return;
    const def = SFX[name];
    if (!def) return;
    const now = A.ctx.currentTime;
    if (A.last[name] !== undefined && now - A.last[name] < def[0]) return;
    if (A.voices > 34 && def[1] < 0.6) return;
    A.last[name] = now;
    A.voices++;
    setTimeout(() => { A.voices--; }, def[1] * 1000 + 60);
    const pan = x === undefined ? 0 : (x / (PD.W || 1000) - 0.5) * 1.4;
    CUR = ATK.has(name) ? A.atk : null;
    try { def[2](now + 0.005, pan); } catch (e) { /* ignorar */ }
    CUR = null;
  };

  // =============================== MÚSICA =================================
  const SC = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], phrygDom: [0, 1, 4, 5, 7, 8, 10]
  };
  // Patrones de 16 semicorcheas. k bombo, s caja, c palmas, h charles, o charles abierto,
  // p shaker, t toms (L/M/H). x = golpe, g = golpe suave (ghost).
  const GROOVES = {
    none: {},
    introHat: { h: '..x...x...x...x.' },
    pop: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    pop2: { k: 'x.....x...x..x..', s: '....x.......x..g', h: 'x.xgx.xgx.xgx.xg' },
    four: { k: 'x...x...x...x...', c: '....x.......x...', h: 'x..gx..gx..gx..g', o: '..x...x...x...x.' },
    half: { k: 'x.........x.....', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
    drive: { k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'xgxgxgxgxgxgxgxg' },
    double: { k: 'x.xxx.xxx.xxx.xx', s: '....x.......x...', o: 'x...x...x...x...' },
    tribalLite: { t: 'L.....L...H.....', p: 'gxggxggxggxggxgx' },
    tribal: { k: 'x.....x...x.....', t: 'L..H.HL..L.H.H..', s: '............x...', p: 'gxggxggxggxggxgx' },
    tribal2: { k: 'x..x..x...x..x..', t: 'L.HHL.H.L.HH.HLH', c: '....x.......x...', h: '..x...x...x...x.' },
    tribal3: { k: 'x..x..x.x..x.x..', t: 'L.HHL.HHL.HHLHLH', c: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    step: { k: 'x.........x..x..', s: '....x..g....x...', h: 'x.xxx.xxx.xxx.xx' },
    dnb: { k: 'x......x..x.....', s: '....x..g.g..x..g', h: 'xgxgxgxgxgxgxgxg', o: '..............x.' },
    synth: { k: 'x...x...x...x...', c: '....x.......x...', h: 'gx.xgx.xgx.xgx.x', o: '..x...x...x...x.' },
    synth2: { k: 'x...x...x...x..x', s: '....x.......x...', c: '....x.......x...', h: 'gx.xgx.xgx.xgx.x', o: '..x...x...x...x.', p: 'xgxgxgxgxgxgxgxg' }
  };
  // redobles: sustituyen la segunda mitad del compás (8 pasos)
  const FILLS = {
    snare: { k: 'x.......', s: '..x.xxxx' },
    roll: { k: 'x...x...', s: 'xxxxxxxx' },
    toms: { k: 'x.......', t: 'HHMMLLLL' },
    dunas: { k: 'x.......', t: 'HLHHLHLL' }
  };
  const TOM = { L: 92, M: 130, H: 175 };
  // ritmos de frase melódica (2 compases): x = nota, - = sostener, . = silencio
  const RH = {
    S: ['x--.x--.x-x.x---x--.x--.x-------', 'x---..x-x---x-x-x-------....x-x-', '..x-x-x-x---x-x-x-------x---....'],
    M: ['x-x-.xx-x-x-.x-xx---x-x-x-------', 'x--x--x-x-x-x---x--x--x-x-------', '.x-x-x-xx---x-x-x-x-.x-xx-------'],
    D: ['xxx-x-x-xxx-x-x-x-x-x-xxx-------', 'x-xxx-xx.xxx.xx-x-x-x-x-x---x-x-', 'x--x--x-x-xxx-x-x--x--x-xxx-x---']
  };
  // Forma de cada canción: [sección, compases, transposición]. Tras el final vuelve a la estrofa.
  const FORM = [['i', 4], ['a', 8], ['b', 8], ['c', 8], ['br', 4], ['a', 8], ['b', 8], ['c', 8, 2]];
  const SEC = {
    i: { pad: 1, arp: 'soft', bass: -1, lead: 0, rh: 'S' },
    a: { pad: 0.7, arp: 0, bass: 0, lead: 'alt', rh: 'SM' },
    b: { pad: 0.85, arp: 1, bass: 1, lead: 'main', rh: 'M' },
    c: { pad: 1, arp: 0, bass: 2, lead: 'main', harm: 1, rh: 'MD' },
    br: { pad: 1, arp: 'soft', bass: 'long', lead: 'bell', rh: 'S' }
  };
  // Acordes en grados de la escala (0 = tónica). Bajo: R raíz, O octava, F quinta, T tercera.
  // Arpegio: índices sobre las notas del acorde (4+ sube de octava).
  const TH = {
    menu: {
      bpm: 112, root: 50, scale: SC.minor, swing: 0, padCut: 2000,
      progs: { i: [0, 5, 2, 6], a: [0, 5, 2, 6, 0, 5, 3, 4], b: [3, 4, 2, 5, 3, 4, 6, 6], c: [5, 6, 0, 0, 5, 6, 2, 4], br: [5, 6, 5, 6] },
      inst: { lead: 'saw', alt: 'epiano', arp: 'pluck', harm: 'bell', pad: 'saw', bass: 'pluck' },
      arps: ['0.1.2.1.3.2.1.2.', '0..1..2.3..2..1.'], bass: ['R-------R---F---', 'R--R--R-R--R--O-', 'R.RO.R.FR.RO.ROF'],
      dr: { i: 'none', a: 'half', b: 'pop', c: 'four', br: 'half' }, fill: 'snare'
    },
    // Prado Esmeralda: aventura luminosa en Sol mayor
    0: {
      bpm: 124, root: 55, scale: SC.major, swing: 0.05, padCut: 2600,
      progs: { i: [0, 4, 5, 3], a: [0, 4, 5, 3, 0, 4, 3, 4], b: [5, 3, 0, 4, 5, 3, 1, 4], c: [3, 4, 2, 5, 3, 4, 0, 0], br: [5, 3, 0, 4] },
      inst: { lead: 'saw', alt: 'marimba', arp: 'marimba', harm: 'bell', pad: 'saw', bass: 'pluck' },
      arps: ['0.2.1.3.2.4.3.2.', '0..2..1.3..2..4.'], bass: ['R-..R-..R-.RO-..', 'R.RO.R.FR.RO.RTF', 'R.O.R.O.R.O.R.OF'],
      dr: { i: 'introHat', a: 'pop', b: 'pop2', c: 'four', br: 'half' }, fill: 'snare', vol: { arp: 1.3 }
    },
    // Dunas de Ámbar: frigio dominante, percusión de darbuka y lengüeta con adornos
    1: {
      bpm: 116, root: 52, scale: SC.phrygDom, swing: 0.1, padCut: 1500,
      progs: { i: [0, 1, 0, 1], a: [0, 1, 0, 1, 3, 1, 0, 0], b: [3, 6, 1, 0, 3, 6, 1, 1], c: [0, 6, 1, 0, 3, 6, 1, 0], br: [3, 3, 1, 1] },
      inst: { lead: 'reed', alt: 'kalimba', arp: 'kalimba', harm: 'kalimba', pad: 'dark', bass: 'saw' },
      arps: ['0..1.2..3.2.1...', '0.10.21.0.10.32.'], bass: ['R--.R.R.---.R.F.', 'R.R.F.R.O.R.F.T.', 'RR.RR.RFRR.RR.OF'],
      dr: { i: 'tribalLite', a: 'tribal', b: 'tribal2', c: 'tribal3', br: 'tribalLite' }, fill: 'dunas', vol: { arp: 1.2 }
    },
    // Glaciar Cristal: acordes con séptima, campanas, flauta y breakbeat
    2: {
      bpm: 112, root: 57, scale: SC.minor, sev: true, swing: 0, padCut: 3200,
      progs: { i: [0, 5, 2, 6], a: [0, 5, 2, 6, 0, 5, 3, 4], b: [3, 0, 5, 6, 3, 0, 4, 4], c: [5, 6, 0, 0, 5, 6, 2, 4], br: [3, 5, 3, 6] },
      inst: { lead: 'flute', alt: 'bell', arp: 'bellS', harm: 'bell', pad: 'glass', bass: 'sub' },
      arps: ['0213243524130243', '3.1.4.2.5.3.4.1.'], bass: ['R-------F-------', 'R--.R--.R--.F-T-', 'R.R.R.O.R.R.F.O.'],
      dr: { i: 'none', a: 'step', b: 'step', c: 'dnb', br: 'half' }, fill: 'roll', vol: { lead: 1.35, arp: 0.75 }
    },
    // Caldera Volcánica: metal sinfónico, bajo distorsionado, doble bombo y metales
    3: {
      bpm: 144, root: 52, scale: SC.minor, swing: 0, padCut: 1800, arpLo: 45, stabs: true,
      progs: { i: [0, 0, 5, 6], a: [0, 5, 6, 0, 0, 5, 3, 4], b: [3, 0, 3, 4, 5, 6, 4, 4], c: [0, 5, 6, 4, 0, 5, 3, 6], br: [5, 5, 3, 4] },
      inst: { lead: 'saw', alt: 'pluck', arp: 'chug', harm: 'twin', pad: 'saw', bass: 'dist' },
      arps: ['0.00.00.0.00.0.3', '00.00.0000.00.34'], bass: ['R.R.R.R.R.R.R.R.', 'RRRRRRRRRRRRF-T-', 'RR.RR.RR.RR.RFTO'],
      dr: { i: 'introHat', a: 'drive', b: 'drive', c: 'double', br: 'half' }, fill: 'toms', vol: { pad: 0.7, lead: 1.1 }
    },
    // Nexo del Vacío: synthwave oscuro con arpegios a semicorcheas y bajo "reese"
    4: {
      bpm: 126, root: 53, scale: SC.minor, sev: true, swing: 0, padCut: 1400,
      progs: { i: [0, 5, 3, 4], a: [0, 0, 5, 5, 3, 3, 4, 4], b: [5, 3, 0, 4, 5, 3, 6, 6], c: [0, 5, 2, 6, 0, 5, 6, 4], br: [3, 3, 5, 5] },
      inst: { lead: 'saw', alt: 'pluck', arp: 'pluck', harm: 'bell', pad: 'dark', bass: 'saw' },
      arps: ['0123012301230123', '0312031203120312'], bass: ['R---R---R---R-OF', '.R.R.R.R.R.R.R.R', 'RROORRFFRROORRTF'],
      dr: { i: 'introHat', a: 'synth', b: 'synth', c: 'synth2', br: 'half' }, fill: 'snare', vol: { arp: 0.8 }
    }
  };

  function rngOf(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const degMidi = (th, d) => th.root + th.scale[wrap(d, 7)] + 12 * Math.floor(d / 7);
  const leadMidi = (th, d) => 60 + wrap(th.root - 60, 12) + th.scale[wrap(d, 7)] + 12 * Math.floor(d / 7);
  const place = (midi, lo) => lo + wrap(midi - lo, 12);
  function chordTones(th, ch) { const out = []; for (let i = 0; i < (th.sev ? 4 : 3); i++) out.push(degMidi(th, ch + i * 2)); return out; }
  function rhythm(str) {
    const ev = [];
    for (let i = 0; i < str.length; i++) if (str[i] === 'x') { let l = 1; while (str[i + l] === '-') l++; ev.push([i, l]); }
    return ev;
  }

  // Melodía de una sección: frase A, respuesta A', contraste B y cadencia A''
  function makeMelody(m, sec) {
    const rng = m.rng, sev = m.th.sev;
    const pool = [...sec.cfg.rh].flatMap(k => RH[k]);
    const r1 = pool[(rng() * pool.length) | 0];
    let r2 = pool[(rng() * pool.length) | 0];
    if (r2 === r1) r2 = pool[(pool.indexOf(r1) + 1) % pool.length];
    const chordOf = s => sec.prog[Math.floor(s / 16) % sec.prog.length];
    const base = sec.type === 'c' ? 2 : sec.type === 'b' ? 1 : 0, lo = base - 3, hi = base + 6;
    const isCT = (d, ch) => { const r = wrap(d - ch, 7); return r === 0 || r === 2 || r === 4 || (sev && r === 6); };
    const snap = (d, ch, dir) => { for (let k = 0; k < 4; k++) for (const s of dir >= 0 ? [k, -k] : [-k, k]) if (isCT(d + s, ch)) return d + s; return d; };
    const clamp = d => Math.max(lo, Math.min(hi, d));
    function fresh(rh, off, start, trend) {
      const res = []; let d = start, last = 0;
      rhythm(rh).forEach(([s, l], i) => {
        const ch = chordOf(off + s), strong = s % 8 === 0 || l >= 6;
        if (i === 0) d = snap(start, ch, trend);
        else {
          const r = rng(), step = r < 0.5 ? 1 : r < 0.78 ? 2 : r < 0.9 ? 0 : 3 + (rng() < 0.4 ? 1 : 0);
          let dir = rng() < 0.5 + trend * 0.25 ? 1 : -1;
          if (Math.abs(last) >= 3) dir = -Math.sign(last);   // tras un salto, volver por grados
          if (d + dir * step > hi || d + dir * step < lo) dir = -dir;
          last = dir * step; d += last;
          if (strong) d = snap(d, ch, dir);
        }
        d = clamp(d);
        res.push({ s: off + s, l, d });
      });
      return res;
    }
    function refit(src, off, shift, cadence) {
      const res = src.map(n => {
        const s = off + (n.s % 32), ch = chordOf(s); let d = n.d + shift;
        if ((n.s % 8 === 0 || n.l >= 6) && !isCT(d, ch)) d = snap(d, ch, 1);
        return { s, l: n.l, d: clamp(d) };
      });
      if (cadence && res.length) {
        const ln = res[res.length - 1], ch = chordOf(ln.s);
        let best = ln.d, bd = 9;
        for (let k = -3; k <= 3; k++) if (wrap(ln.d + k - ch, 7) === 0 && Math.abs(k) < bd) { bd = Math.abs(k); best = ln.d + k; }
        ln.d = clamp(best); ln.l = Math.max(1, off + 30 - ln.s);
      }
      return res;
    }
    const units = sec.bars / 2, u0 = fresh(r1, 0, base + 2, 0.3);
    let mel = u0.slice();
    for (let u = 1; u < units; u++) {
      const off = u * 32;
      if (u % 4 === 2) mel = mel.concat(fresh(r2, off, base + 4, -0.2));
      else mel = mel.concat(refit(u0, off, u % 4 === 1 ? (rng() < 0.5 ? 0 : 1) : (rng() < 0.5 ? 0 : -1), u === units - 1));
    }
    const map = {};
    for (const n of mel) map[n.s] = n;
    return map;
  }

  function route(m, n, o) {
    let x = n;
    if (o.pan) { const p = A.ctx.createStereoPanner(); p.pan.value = o.pan; x.connect(p); x = p; }
    x.connect(o.bus || (o.duck ? m.duck : m.dry));
    if (o.rev) { const g = G(o.rev); x.connect(g); g.connect(m.rev); }
    if (o.del) { const g = G(o.del); x.connect(g); g.connect(m.del); }
  }
  // compresión "sidechain": el bombo hace respirar al colchón y al bajo
  function duck(m, t) { const p = m.duck.gain; p.setTargetAtTime(0.38, t, 0.004); p.setTargetAtTime(1, t + 0.025, 0.07); }

  function newSong(id, t0) {
    const th = TH[id], spb = 60 / th.bpm / 4;
    const m = { id, th, spb, next: t0, si: -1, pass: 0, step: 0, abs: 0, sec: null, battle: 0, lastLead: null, rng: rngOf((Math.random() * 1e9) | 0) };
    m.out = G(0); m.out.gain.setValueAtTime(0, t0); m.out.gain.linearRampToValueAtTime(1, t0 + 1.2); m.out.connect(A.mus);
    m.duck = G(1); m.duck.connect(m.out);
    m.dry = G(1); m.dry.connect(m.out);
    m.drum = G(1); m.drum.connect(m.out);
    m.rev = G(1); m.rev.connect(A.mverb);
    m.del = G(1); m.del.connect(A.delIn);
    A.dL.delayTime.setValueAtTime(spb * 3, t0); A.dR.delayTime.setValueAtTime(spb * 3, t0);
    const R = o => n => route(m, n, o);
    m.r = {
      pad: R({ duck: 1, rev: 0.5 }), bass: R({ duck: 1 }), arpL: R({ duck: 1, rev: 0.22, del: 0.3, pan: -0.3 }), arpR: R({ duck: 1, rev: 0.22, del: 0.3, pan: 0.3 }),
      lead: R({ rev: 0.32, del: 0.24 }), harm: R({ rev: 0.4, del: 0.2, pan: -0.25 }), stab: R({ rev: 0.35 }),
      drum: R({ bus: m.drum }), snare: R({ bus: m.drum, rev: 0.18 }), hatL: R({ bus: m.drum, pan: -0.25 }), hatR: R({ bus: m.drum, pan: 0.3 }), fx: R({ bus: m.drum, rev: 0.45 })
    };
    nextSection(m);
    return m;
  }
  function nextSection(m) {
    let si = m.si + 1;
    if (si >= FORM.length) { si = 1; m.pass++; }
    m.si = si;
    let [type, bars, lift] = FORM[si];
    let next = FORM[si + 1 >= FORM.length ? 1 : si + 1][0];
    if (A.intensity > 0) {   // modo batalla: alterna estribillo y puente, subiendo de tono
      type = m.sec && m.sec.type === 'c' ? 'b' : 'c'; bars = 8;
      lift = type === 'c' && m.battle++ % 2 ? 2 : 0;
      next = type === 'c' ? 'b' : 'c';
    }
    const th = m.th, cfg = SEC[type], P = m.pass;
    const sec = { type, bars, cfg, next, tr: lift || 0, prog: th.progs[type], groove: th.dr[type] };
    sec.arp = typeof cfg.arp === 'number' ? th.arps[(cfg.arp + P) % th.arps.length] : th.arps[P % th.arps.length];
    sec.soft = cfg.arp === 'soft';
    sec.bass = cfg.bass === 'long' ? 'R---------------' : cfg.bass < 0 ? null : type === 'c' ? th.bass[2] : th.bass[(cfg.bass + P) % 2];
    sec.mel = cfg.lead ? makeMelody(m, sec) : null;
    m.sec = sec; m.step = 0;
  }

  function tick(m, t) {
    const th = m.th, sec = m.sec, cfg = sec.cfg, spb = m.spb, r = m.r, rng = m.rng;
    const s = m.step, bar = s >> 4, s16 = s & 15, inten = A.intensity;
    const ch = sec.prog[bar % sec.prog.length], lastBar = bar === sec.bars - 1;
    const stop = lastBar && sec.next === 'c' && sec.type !== 'c' && s16 >= 12;   // silencio antes del estribillo
    const tt = t + (s16 & 1 ? th.swing * spb : 0);
    const hz = n => mtof(n + sec.tr);
    const vol = th.vol || {};

    // --- comienzo de compás: acordes, platos, subidas
    if (s16 === 0) {
      if (cfg.pad) {
        const fs = chordTones(th, ch).map(n => hz(place(n, 53)));
        V.pad(t, fs, spb * 16 + 0.05, 0.05 * cfg.pad * (vol.pad || 1), r.pad, th.inst.pad, (th.padCut || 2200) * (1 + inten * 0.5));
      }
      if (bar === 0 && sec.type !== 'i') {
        D.crash(t, sec.type === 'c' ? 0.13 : 0.07, r.fx);
        if (sec.type === 'c') D.drop(t, 0.32, r.drum);
      }
      if (lastBar && (sec.type === 'i' || (sec.next === 'c' && sec.type !== 'c'))) D.riser(t, spb * 16, 0.08, r.fx);
    }
    if (th.stabs && sec.type === 'c' && (s16 === 0 || s16 === 10)) {
      for (const n of chordTones(th, ch).slice(0, 3)) V.brass(t, hz(place(n, 55)), spb * (s16 ? 2 : 3), 0.03, r.stab);
    }

    // --- batería
    if (!stop) {
      const gname = inten > 0 && sec.type !== 'c' ? th.dr.c : sec.groove;
      let gr = GROOVES[gname] || {}, pos = s16, vm = 1;
      const fillBar = lastBar ? sec.bars >= 4 : sec.type === 'c' && bar % 4 === 3;
      if (fillBar && s16 >= 8 && gname !== 'none' && gname !== 'introHat') { gr = FILLS[th.fill]; pos = s16 - 8; vm = 0.55 + 0.45 * pos / 7; }
      const hit = key => { const p = gr[key]; const c = p && p[pos]; return c === 'x' ? 1 : c === 'g' ? 0.45 : 0; };
      let k = hit('k');
      if (inten > 0 && s16 % 4 === 0) k = k || 0.85;
      if (k) { D.kick(t, 0.55 * k * Math.max(vm, 0.8), r.drum); duck(m, t); }
      const sn = hit('s'); if (sn) D.snare(tt, 0.26 * sn * vm, r.snare);
      else if (gr.s && pos % 8 === 7 && rng() < 0.12) D.snare(tt, 0.08, r.snare);
      const cl = hit('c'); if (cl) D.clap(tt, 0.22 * cl * vm, r.snare);
      const hh = hit('h'); if (hh) D.hat(tt, 0.06 * hh * (0.88 + rng() * 0.24), s16 & 2 ? r.hatR : r.hatL, false);
      const oh = hit('o') || (gr.h && bar % 2 === 1 && s16 === 14 ? 0.7 : 0); if (oh) D.hat(tt, 0.05 * oh, r.hatR, true);
      const sh = hit('p'); if (sh) D.shaker(tt, 0.045 * sh, r.hatL);
      const tc = gr.t && gr.t[pos]; if (TOM[tc]) D.tom(tt, TOM[tc], 0.26 * vm, r.drum);
      if (inten > 0) {
        if (s16 & 1) D.hat(tt, 0.03, r.hatL, false);
        if (bar % 2 === 1 && s16 >= 12) D.tom(t, [200, 160, 130, 100][s16 - 12], 0.2, r.drum);
      }
    }

    // --- bajo
    if (sec.bass && !stop) {
      const c = sec.bass[s16];
      if (c !== '.' && c !== '-') {
        let l = 1; while (s16 + l < 16 && sec.bass[s16 + l] === '-') l++;
        const root = place(degMidi(th, ch), th.bassLo || 33);
        const n = c === 'O' ? root + 12 : c === 'F' ? root + wrap(degMidi(th, ch + 4) - root, 12) : c === 'T' ? root + wrap(degMidi(th, ch + 2) - root, 12) : root;
        V.bass(tt, hz(n), l * spb * 0.9, 0.2 * (vol.bass || 1) * (s16 % 4 === 0 ? 1 : 0.85), r.bass, th.inst.bass, inten);
      }
    }

    // --- arpegio
    if (sec.arp && !stop) {
      const c = sec.arp[s16];
      if (c >= '0' && c <= '9') {
        const tones = chordTones(th, ch).map(n => place(n, th.arpLo || 57)).sort((a, b) => a - b);
        const i = +c, n = tones[i % tones.length] + 12 * Math.floor(i / tones.length);
        let v = 0.07 * (vol.arp || 1), bright = 0.45 + inten * 0.3;
        if (sec.soft) { const k = (s + 1) / (sec.bars * 16); bright = 0.12 + 0.5 * k; v *= 0.55 + 0.45 * k; }
        keyInst(th.inst.arp, tt, hz(n), spb, v * (s16 % 4 === 0 ? 1 : 0.8), s16 & 2 ? r.arpR : r.arpL, bright);
      }
    }

    // --- melodía
    const nt = sec.mel && sec.mel[s];
    if (nt) {
      const midi = leadMidi(th, nt.d);
      const dur = nt.l * spb * (sec.mel[s + nt.l] ? 1 : 0.9), acc = s16 % 4 === 0 ? 1 : 0.85;
      if (cfg.lead === 'main') {
        const kind = th.inst.lead;
        const legato = m.lastLead && m.lastLead.end === m.abs && Math.abs(m.lastLead.midi - midi) <= 7;
        V.lead(tt, hz(midi), dur, 0.075 * (vol.lead || 1) * acc, r.lead, { kind, prev: legato ? hz(m.lastLead.midi) : 0, bright: 0.55 + inten * 0.35, orn: kind === 'reed' && !legato && rng() < 0.3 });
        if (cfg.harm) {
          const hm = leadMidi(th, nt.d - 2);
          if (th.inst.harm === 'twin') V.lead(tt, hz(hm), dur, 0.045 * acc, r.harm, { kind, bright: 0.5 });
          else keyInst(th.inst.harm, tt, hz(hm), dur, 0.05 * acc, r.harm, 0.5);
        }
      } else if (cfg.lead === 'alt') keyInst(th.inst.alt, tt, hz(midi), dur, 0.11 * acc, r.lead, 0.6);
      else keyInst('bell', tt, hz(midi + 12), dur, 0.065, r.lead, 0.5);
      m.lastLead = { midi, end: m.abs + nt.l };
    }

    m.step++; m.abs++;
    if (m.step >= sec.bars * 16) nextSection(m);
  }
  function schedule(m, until) { while (m.next < until) { tick(m, m.next); m.next += m.spb; } }

  A.playMusic = function (id) {
    A.pendingMusic = id;
    if (!A.ctx) return;
    if (A.music && A.music.id === id) return;
    A.stopMusic();
    if (!TH[id]) return;
    const m = A.music = newSong(id, A.ctx.currentTime + 0.1);
    m.timer = setInterval(() => {
      if (A.music !== m) return;
      const now = A.ctx.currentTime;
      if (m.next < now - 0.1) m.next = now + 0.05;   // la pestaña estuvo en segundo plano: no amontonar notas
      try { schedule(m, now + 0.3); } catch (e) { /* ignorar */ }
    }, 50);
  };
  A.stopMusic = function () {
    const m = A.music;
    if (!m) return;
    clearInterval(m.timer); A.music = null;
    const t = A.ctx.currentTime;
    for (const g of [m.out, m.rev, m.del]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.setTargetAtTime(0, t, 0.25); }
    setTimeout(() => { try { m.out.disconnect(); m.rev.disconnect(); m.del.disconnect(); } catch (e) { /* ignorar */ } }, 2500);
  };
  A.setIntensity = function (v) { A.intensity = v; };

  // Prueba sin altavoces: renderiza una canción (o un efecto) y devuelve niveles por segundo.
  A.renderTest = async function (id, secs, inten, sfxName) {
    const saved = {}; for (const k of GKEYS) saved[k] = A[k];
    const savedI = A.intensity, savedM = A.music;
    const sr = 44100, oc = new OfflineAudioContext(2, Math.floor(sr * secs), sr);
    let buf;
    try {
      Object.assign(A, graph(oc, false));
      A.intensity = inten || 0;
      if (sfxName) { A.music = id !== null && TH[id] ? { th: TH[id] } : null; CUR = ATK.has(sfxName) ? A.atk : null; try { SFX[sfxName][2](0.05, 0); } finally { CUR = null; } }
      else { const m = newSong(id, 0.05); A.music = m; schedule(m, secs); }
    } finally {
      for (const k of GKEYS) A[k] = saved[k];
      A.intensity = savedI; A.music = savedM;
    }
    buf = await oc.startRendering();
    const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
    let peak = 0, sum = 0, bad = 0; const win = [];
    for (let w = 0; w < secs; w++) {
      let ws = 0; const a = w * sr, b = Math.min(L.length, a + sr);
      for (let i = a; i < b; i++) { const x = L[i], y = Rr[i]; if (!isFinite(x) || !isFinite(y)) { bad++; continue; } peak = Math.max(peak, Math.abs(x), Math.abs(y)); ws += x * x + y * y; }
      sum += ws; win.push(+Math.sqrt(ws / (2 * (b - a))).toFixed(3));
    }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / (2 * L.length)).toFixed(3), bad, win, buffer: buf };
  };

  PD.Audio = A;
})();
