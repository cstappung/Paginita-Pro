/* Pro BoxHead — los sonidos. Todo sintetizado con WebAudio (nada que
   alojar ni esperar), pero con cuerpo:

   - **Armas**: cada disparo junta un chasquido (ruido filtrado agudo), un
     golpe grave (un seno que cae) y la cola de una sala (una reverberación
     hecha con ruido que se apaga). La escopeta suma el «chk-chak» de la
     corredera; la explosión, un retumbo largo, el sub y los escombros.
   - **Zombis**: gemidos con formantes, como una voz: una diente de sierra
     grave con vibrato pasa por dos filtros de banda (las vocales «uu»/«aa»)
     y un poco de distorsión. Los diablos gruñen más grave y más sucio.
   - Todo pasa por `bus` → compresor → `destination`, así que el 🔊 y el
     volumen del Club (`volumen.js`, que envuelve `destination`) lo gobiernan. */
(function (raiz) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const azar = (a, b) => a + Math.random() * (b - a);

  function crear() {
    let ac = null, bus = null, seco = null, eco = null, ruidoBuf = null, distor = null;
    const ultimo = {};

    function inicia() {
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          const comp = ac.createDynamicsCompressor();
          comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
          comp.connect(ac.destination);
          bus = ac.createGain(); bus.gain.value = 0.55;
          seco = ac.createGain(); seco.gain.value = 1;
          bus.connect(seco); seco.connect(comp);
          // la sala: una respuesta al impulso de ruido que se apaga en 1.4 s
          const n = Math.floor(ac.sampleRate * 1.4), ir = ac.createBuffer(2, n, ac.sampleRate);
          for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
          const conv = ac.createConvolver(); conv.buffer = ir;
          eco = ac.createGain(); eco.gain.value = 0.16;
          bus.connect(conv); conv.connect(eco); eco.connect(comp);
          // ruido blanco de 2 s, del que cada sonido toma un trozo al azar
          const m = ac.sampleRate * 2;
          ruidoBuf = ac.createBuffer(1, m, ac.sampleRate);
          const d = ruidoBuf.getChannelData(0);
          for (let i = 0; i < m; i++) d[i] = Math.random() * 2 - 1;
          // una curva de saturación para gruñidos
          distor = ac.createWaveShaper();
          const k = 18, cur = new Float32Array(512);
          for (let i = 0; i < 512; i++) { const x = i / 256 - 1; cur[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
          distor.curve = cur;
          const ds = ac.createGain(); ds.gain.value = 0.2;
          distor.connect(ds); ds.connect(bus);
        } catch { ac = null; }
      }
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
      return ac;
    }

    // ---------- piezas ----------
    /* Ruido filtrado con su envolvente: `f` y `f2` (barrido), `q`, el tipo de
       filtro, ataque y caída (en segundos), retardo `t0`. */
    function ruido(o) {
      const t = ac.currentTime + (o.t0 || 0), dur = o.dur || 0.1;
      const s = ac.createBufferSource(); s.buffer = ruidoBuf;
      const fl = ac.createBiquadFilter(); fl.type = o.tipo || 'lowpass'; fl.Q.value = o.q || 0.8;
      fl.frequency.setValueAtTime(o.f || 1000, t);
      if (o.f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t + dur);
      const g = ac.createGain(), at = o.ataque || 0.002;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t + at);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(o.dest || bus);
      s.start(t, Math.random() * Math.max(0, 1.9 - dur), dur + 0.05);
    }
    function tono(o) {
      const t = ac.currentTime + (o.t0 || 0), dur = o.dur || 0.1;
      const os = ac.createOscillator(), g = ac.createGain();
      os.type = o.tipo || 'sine';
      os.frequency.setValueAtTime(o.f1, t);
      if (o.f2 && o.f2 !== o.f1) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
      const at = o.ataque || 0.003;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t + at);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      os.connect(g); g.connect(o.dest || bus);
      os.start(t); os.stop(t + dur + 0.05);
    }
    /* Una voz: diente de sierra con vibrato por dos formantes. `f0` y `f1`
       el tono al empezar y al terminar; `a`/`b` los formantes; `sucio` la
       manda por la distorsión. */
    function voz(o) {
      const t = ac.currentTime + (o.t0 || 0), dur = o.dur;
      const os = ac.createOscillator(); os.type = 'sawtooth';
      os.frequency.setValueAtTime(o.f0, t);
      os.frequency.linearRampToValueAtTime(o.f1, t + dur);
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = o.vib || 6; lg.gain.value = o.prof || 5;
      lfo.connect(lg); lg.connect(os.frequency);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol, t + (o.ataque || 0.08));
      g.gain.setValueAtTime(o.vol, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const salida = o.sucio ? distor : bus;
      for (const [f, q, v] of [[o.a || 520, 7, 1], [o.b || 1050, 8, 0.6], [o.c || 2400, 9, 0.18]]) {
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, t); bp.Q.value = q;
        if (o.a2) bp.frequency.linearRampToValueAtTime(f * o.a2, t + dur);
        const gv = ac.createGain(); gv.gain.value = v;
        os.connect(bp); bp.connect(gv); gv.connect(g);
      }
      g.connect(salida);
      // aliento: un soplo de ruido por el primer formante
      ruido({ tipo: 'bandpass', f: o.a || 520, q: 2, dur, vol: o.vol * 0.35, ataque: 0.06, t0: o.t0 });
      os.start(t); os.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    // El «clic» metálico de un mecanismo.
    const clic = (t0, f = 2600, vol = 0.25) => { ruido({ tipo: 'bandpass', f, q: 6, dur: 0.025, vol, t0 }); tono({ f1: f * 0.7, dur: 0.012, vol: vol * 0.4, tipo: 'square', t0 }); };

    // ---------- el catálogo ----------
    const ESPERA = { baja: 40, gemido: 0, impacto: 35, uzi: 20, rebote: 60, dolor: 120 };
    function son(k, lejos) {
      if (!ac || ac.state !== 'running') return;
      const ahora = performance.now();
      if (ahora - (ultimo[k] || 0) < (ESPERA[k] !== undefined ? ESPERA[k] : 28)) return;
      ultimo[k] = ahora;
      const v = lejos === undefined ? 1 : clamp(1 - lejos / 620, 0.06, 0.75);
      // a lo lejos se pierden los agudos
      const lp = lejos === undefined ? 1 : clamp(1 - lejos / 900, 0.25, 1);
      switch (k) {
        case 'pistola': {
          const p = azar(0.94, 1.06);
          ruido({ tipo: 'highpass', f: 1200 * p, q: 0.7, dur: 0.07, vol: 0.55 * v });
          ruido({ tipo: 'bandpass', f: 2400 * p * lp, q: 1.1, dur: 0.11, vol: 0.5 * v });
          tono({ f1: 190 * p, f2: 55, dur: 0.09, vol: 0.55 * v });
          ruido({ tipo: 'lowpass', f: 700, dur: 0.22, vol: 0.18 * v, t0: 0.01 });
          clic(0.004, 3400, 0.12 * v);
          break;
        }
        case 'uzi': {
          const p = azar(0.92, 1.08);
          ruido({ tipo: 'bandpass', f: 1900 * p * lp, q: 0.9, dur: 0.06, vol: 0.5 * v });
          ruido({ tipo: 'highpass', f: 2600, dur: 0.03, vol: 0.3 * v });
          tono({ f1: 230 * p, f2: 70, dur: 0.055, vol: 0.38 * v });
          clic(0.002, 3000, 0.08 * v);
          break;
        }
        case 'escopeta': {
          ruido({ tipo: 'highpass', f: 900, dur: 0.06, vol: 0.7 * v });
          ruido({ tipo: 'lowpass', f: 3200 * lp, f2: 380, dur: 0.42, vol: 1.0 * v, ataque: 0.002 });
          tono({ f1: 110, f2: 32, dur: 0.32, vol: 0.95 * v });
          tono({ f1: 62, f2: 28, dur: 0.4, vol: 0.5 * v, t0: 0.01 });
          // la corredera: chk… chak
          if (lejos === undefined) {
            ruido({ tipo: 'bandpass', f: 1300, q: 3.5, dur: 0.05, vol: 0.35, t0: 0.34 });
            tono({ f1: 420, f2: 300, dur: 0.04, vol: 0.12, tipo: 'square', t0: 0.34 });
            ruido({ tipo: 'bandpass', f: 900, q: 3, dur: 0.07, vol: 0.4, t0: 0.47 });
            tono({ f1: 260, f2: 180, dur: 0.05, vol: 0.14, tipo: 'square', t0: 0.47 });
          }
          break;
        }
        case 'cohete':
          tono({ f1: 140, f2: 50, dur: 0.18, vol: 0.6 * v });
          ruido({ tipo: 'bandpass', f: 380, f2: 1800, q: 1.2, dur: 0.6, vol: 0.55 * v, ataque: 0.03 });
          ruido({ tipo: 'highpass', f: 2200, dur: 0.12, vol: 0.25 * v });
          break;
        case 'lanza':
          ruido({ tipo: 'bandpass', f: 500, f2: 1400, q: 1.4, dur: 0.18, vol: 0.28 * v, ataque: 0.04 });
          tono({ f1: 2600, f2: 2400, dur: 0.09, vol: 0.12 * v, tipo: 'triangle', t0: 0.02 });
          tono({ f1: 3900, dur: 0.06, vol: 0.06 * v, tipo: 'triangle', t0: 0.03 });
          break;
        case 'rebote':
          tono({ f1: 520, f2: 300, dur: 0.06, vol: 0.2 * v, tipo: 'triangle' });
          ruido({ tipo: 'bandpass', f: 1800, q: 3, dur: 0.03, vol: 0.12 * v });
          break;
        case 'boom': {
          ruido({ tipo: 'highpass', f: 700, dur: 0.08, vol: 0.9 * v });
          ruido({ tipo: 'lowpass', f: 2200 * lp, f2: 90, dur: 1.4, vol: 1.3 * v, ataque: 0.004 });
          tono({ f1: 70, f2: 24, dur: 1.0, vol: 1.1 * v });
          tono({ f1: 46, f2: 22, dur: 1.2, vol: 0.6 * v, t0: 0.02 });
          for (let i = 0; i < 9; i++) ruido({ tipo: 'bandpass', f: azar(1500, 4200) * lp, q: 4, dur: 0.02, vol: azar(0.05, 0.16) * v, t0: azar(0.12, 0.8) });
          break;
        }
        case 'pon':
          tono({ f1: 130, f2: 62, dur: 0.12, vol: 0.4 });
          ruido({ tipo: 'lowpass', f: 600, dur: 0.1, vol: 0.3 });
          clic(0.01, 1800, 0.1);
          break;
        case 'clic': clic(0, 2800, 0.25); break;
        case 'cambia': clic(0, 2200, 0.22); clic(0.07, 3000, 0.2); ruido({ tipo: 'bandpass', f: 1200, q: 2, dur: 0.05, vol: 0.12, t0: 0.03 }); break;
        case 'impacto':
          ruido({ tipo: 'bandpass', f: azar(600, 900), q: 1.4, dur: 0.08, vol: 0.32 * v });
          tono({ f1: 150, f2: 70, dur: 0.06, vol: 0.22 * v });
          break;
        case 'chispa': ruido({ tipo: 'highpass', f: 3800, dur: 0.04, vol: 0.12 * v }); tono({ f1: azar(2600, 4200), f2: 1800, dur: 0.05, vol: 0.04 * v, tipo: 'triangle' }); break;
        case 'baja': {
          // un zombi que cae: un «urgh» corto y el chapoteo
          const p = azar(0.85, 1.2);
          voz({ f0: 120 * p, f1: 70 * p, dur: azar(0.32, 0.5), vol: 0.32 * v, a: 480, b: 900, a2: 0.8, vib: 9, prof: 6 });
          ruido({ tipo: 'lowpass', f: 900, f2: 200, dur: 0.2, vol: 0.4 * v, t0: 0.02 });
          tono({ f1: 90, f2: 45, dur: 0.18, vol: 0.4 * v, t0: 0.05 });
          break;
        }
        case 'bajaDiablo':
          voz({ f0: 95, f1: 48, dur: 0.6, vol: 0.38 * v, a: 380, b: 760, a2: 0.7, vib: 14, prof: 9, sucio: 1 });
          ruido({ tipo: 'bandpass', f: 600, f2: 2400, q: 1, dur: 0.5, vol: 0.3 * v, ataque: 0.05 });
          break;
        case 'gemido': {
          // el gemido de fondo de la horda
          const p = azar(0.8, 1.25), larga = azar(0.7, 1.5);
          voz({ f0: 95 * p, f1: azar(70, 110) * p, dur: larga, vol: 0.2 * v, a: azar(380, 560), b: azar(780, 1050), a2: azar(0.85, 1.2), vib: azar(4, 7), prof: azar(3, 8), ataque: 0.18 });
          break;
        }
        case 'grunido':
          voz({ f0: 70, f1: 58, dur: azar(0.6, 1), vol: 0.22 * v, a: 340, b: 700, vib: 16, prof: 10, sucio: 1, ataque: 0.1 });
          break;
        case 'mordida':
          voz({ f0: 160, f1: 120, dur: 0.18, vol: 0.2 * v, a: 650, b: 1300, vib: 20, prof: 12, sucio: 1, ataque: 0.02 });
          ruido({ tipo: 'bandpass', f: 1400, q: 2, dur: 0.06, vol: 0.25 * v, t0: 0.06 });
          break;
        case 'dolor': {
          const p = azar(0.95, 1.1);
          voz({ f0: 175 * p, f1: 130 * p, dur: 0.2, vol: 0.3, a: 700, b: 1200, vib: 8, prof: 4, ataque: 0.015 });
          tono({ f1: 120, f2: 60, dur: 0.1, vol: 0.3 });
          break;
        }
        case 'muere':
          voz({ f0: 210, f1: 80, dur: 1.0, vol: 0.36, a: 760, b: 1150, a2: 0.75, vib: 6, prof: 6, ataque: 0.03 });
          tono({ f1: 80, f2: 30, dur: 0.5, vol: 0.5, t0: 0.6 });
          ruido({ tipo: 'lowpass', f: 500, dur: 0.3, vol: 0.4, t0: 0.62 });
          break;
        case 'recoge':
          clic(0, 2400, 0.2);
          tono({ f1: 880, dur: 0.09, vol: 0.16, tipo: 'square', t0: 0.03 });
          tono({ f1: 1320, dur: 0.14, vol: 0.14, tipo: 'square', t0: 0.1 });
          tono({ f1: 1760, dur: 0.12, vol: 0.06, tipo: 'triangle', t0: 0.1 });
          break;
        case 'fuego':
          ruido({ tipo: 'bandpass', f: 280, f2: 1500, q: 1.1, dur: 0.38, vol: 0.32 * v, ataque: 0.04 });
          tono({ f1: 90, f2: 60, dur: 0.3, vol: 0.18 * v });
          break;
        case 'acido':
          ruido({ tipo: 'bandpass', f: 2000, f2: 500, q: 2, dur: 0.22, vol: 0.22 * v, ataque: 0.01 });
          tono({ f1: 520, f2: 180, dur: 0.18, vol: 0.1 * v, tipo: 'sine' });
          tono({ f1: 300, f2: 700, dur: 0.06, vol: 0.06 * v, tipo: 'sine', t0: 0.12 });
          break;
        case 'golpe':
          ruido({ tipo: 'lowpass', f: 800, f2: 120, dur: 0.4, vol: 0.9 * v });
          tono({ f1: 80, f2: 30, dur: 0.45, vol: 0.8 * v });
          break;
        case 'jefe':
          voz({ f0: 62, f1: 44, dur: 1.3, vol: 0.5 * v, a: 300, b: 640, a2: 0.75, vib: 11, prof: 8, sucio: 1, ataque: 0.12 });
          tono({ f1: 55, f2: 30, dur: 1.2, vol: 0.5 * v });
          ruido({ tipo: 'lowpass', f: 700, dur: 0.9, vol: 0.35 * v, ataque: 0.1 });
          break;
        case 'premio':
          [523, 659, 784, 1046].forEach((f, i) => { tono({ f1: f, dur: 0.16, vol: 0.13, tipo: 'square', t0: i * 0.07 }); tono({ f1: f * 2, dur: 0.12, vol: 0.04, tipo: 'triangle', t0: i * 0.07 }); });
          break;
        case 'compra':
          clic(0, 2000, 0.2);
          [988, 1319].forEach((f, i) => tono({ f1: f, dur: 0.1, vol: 0.15, tipo: 'square', t0: 0.04 + i * 0.07 }));
          ruido({ tipo: 'highpass', f: 5000, dur: 0.12, vol: 0.12, t0: 0.12 });
          break;
        case 'nivel':
          [392, 523, 659, 784].forEach((f, i) => tono({ f1: f, f2: f * 1.01, dur: 0.22, vol: 0.15, tipo: 'triangle', t0: i * 0.11 }));
          tono({ f1: 98, dur: 0.6, vol: 0.25, t0: 0.33 });
          break;
      }
    }
    return { inicia, son, activo: () => !!(ac && ac.state === 'running') };
  }

  raiz.BoxheadAudio = { crear };
})(typeof self !== 'undefined' ? self : this);
