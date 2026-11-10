/* Pro BoxHead — los sonidos. Todo sintetizado con WebAudio (nada que
   alojar ni esperar), pero con cuerpo:

   - **Armas**: cada disparo junta un chasquido (ruido filtrado agudo), un
     golpe grave (un seno que cae) y la cola de una sala (una reverberación
     hecha con ruido que se apaga). La escopeta suma el «chk-chak» de la
     corredera; la explosión, un retumbo largo, el sub y los escombros.
   - **Zombis**: gemidos con formantes, como una voz: una diente de sierra
     grave con vibrato pasa por dos filtros de banda (las vocales «uu»/«aa»)
     y un poco de distorsión. Los diablos gruñen más grave y más sucio.
   - Todo pasa por `bus` → compresor → limitador → `destination`, así que el
     🔊 y el volumen del Club (`volumen.js`, que envuelve `destination`) lo
     gobiernan.
   - **Hay un tope de piezas sonando a la vez** (`carga`): con la horda
     encima, cada disparo, baja y gemido armaba sus osciladores y filtros, el
     hilo de audio no daba abasto y el sonido se entrecortaba hasta apagarse.
     Pasado `TOPE_LEJOS` se callan los sonidos lejanos; pasado `TOPE`, todos.
   - **Grabaciones** (`MUESTRAS`, archivos en `sfx/`): donde hay una, suena
     ella; mientras no llega, o si falla, suena el sintetizado. El `switch`
     de `son` es ese respaldo: no se borra.
   - **La música** (`musica`) es por capas y la arma este archivo: un
     colchón siempre, el bajo, la batería y el arpegio entran con la
     intensidad que manda `juego.js` (enemigos cerca, multiplicador), y con
     un jefe vivo cambia a su tema. Va por su propio bus al mismo compresor,
     así que el volumen del Club también la gobierna. */
(function (raiz) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const azar = (a, b) => a + Math.random() * (b - a);

  function crear() {
    let ac = null, bus = null, seco = null, eco = null, ruidoBuf = null, distor = null, salida = null;
    const ultimo = {};
    // cuándo termina cada pieza (ruido, tono; una voz pesa cuatro) que suena
    let fines = [];
    const TOPE = 80, TOPE_LEJOS = 44;
    const suena = (fin, peso = 1) => { for (let i = 0; i < peso; i++) fines.push(fin); };
    function carga() {
      const t = ac.currentTime;
      if (fines.length) fines = fines.filter(f => f > t);
      return fines.length;
    }

    function inicia() {
      if (!ac) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          // un búfer algo más holgado que el mínimo: en un PC cargado el
          // mínimo se quedaba corto y el audio se cortaba
          try { ac = new AC({ latencyHint: 'balanced' }); } catch { ac = new AC(); }
          const comp = ac.createDynamicsCompressor();
          comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
          // el limitador: una explosión sobre veinte bajas ya no recorta en el parlante
          const lim = ac.createDynamicsCompressor();
          lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12;
          comp.connect(lim); lim.connect(ac.destination);
          salida = comp;
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
          // 513 puntos: el del medio es justo 0. Con 512, el silencio caía entre
          // dos puntos y salía una corriente continua constante por el parlante
          const k = 18, cur = new Float32Array(513);
          for (let i = 0; i < 513; i++) { const x = i / 256 - 1; cur[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
          distor.curve = cur;
          const ds = ac.createGain(); ds.gain.value = 0.2;
          distor.connect(ds); ds.connect(bus);
          cargaMuestras();
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
      if (!o.libre) suena(t + dur);
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
      if (!o.libre) suena(t + dur);
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
      suena(t + dur, 4);
    }
    // El «clic» metálico de un mecanismo.
    const clic = (t0, f = 2600, vol = 0.25) => { ruido({ tipo: 'bandpass', f, q: 6, dur: 0.025, vol, t0 }); tono({ f1: f * 0.7, dur: 0.012, vol: vol * 0.4, tipo: 'square', t0 }); };

    // ---------- el catálogo ----------
    /* ---------- grabaciones ----------
       `MUESTRAS[k]` = cuántas tomas hay de ese sonido (`sfx/<k>-<n>.mp3`,
       hechas con ElevenLabs); con varias se elige una al azar para que veinte
       disparos no suenen iguales. `GAN[k]` es la ganancia de cada archivo,
       medida contra el sintetizado (la ventana de 100 ms más fuerte, las dos
       versiones renderizadas por esta misma cadena en un OfflineAudioContext)
       para que la mezcla no cambie. Excepciones: lo que era apenas un clic
       sube a un mínimo de 0,015 (si no, la grabación quedaba inaudible);
       impacto, rebote y chatarra, que suenan sin parar, solo ×3; y «quedan
       cinco» ×1,5, que no se sentía. Los archivos están recortados (sin
       silencios, los que suenan seguido cortos para no llenar las `VOCES`)
       y en mono a 96 kbps. Se cargan de a cuatro después del primer toque;
       mientras tanto suena el sintetizado. */
    const MUESTRAS = {
      pistola: 1, uzi: 1, escopeta: 1, cohete: 1, boom: 1, lanza: 1,
      rebote: 1, pon: 1, impacto: 1, baja: 1, bajaDiablo: 1, gemido: 1,
      grunido: 1, mordida: 1, dolor: 1, muere: 1, recoge: 1, fuego: 1,
      acido: 1, golpe: 1, jefe: 1, premio: 1, compra: 1, mejora: 1, nivel: 1,
      chatarra: 1, racha: 1, avisoCombo: 1, quedan: 1
    };
    const GAN = {
      pistola: 0.016, uzi: 0.052, escopeta: 0.336, cohete: 0.102, boom: 0.566,
      lanza: 0.036, rebote: 0.057, pon: 0.052, impacto: 0.088, baja: 0.13,
      bajaDiablo: 0.146, gemido: 0.024, grunido: 0.074, mordida: 0.064,
      dolor: 0.464, muere: 0.35, recoge: 0.237, fuego: 0.018, acido: 0.034,
      golpe: 0.095, jefe: 0.184, premio: 0.188, compra: 0.107, mejora: 0.164,
      nivel: 0.332, chatarra: 0.089, racha: 0.37, avisoCombo: 0.017,
      quedan: 4.76
    };
    const VARIA = { pistola: 1, uzi: 1, escopeta: 1, impacto: 1, baja: 1, gemido: 1, grunido: 1, mordida: 1, chispa: 1, rebote: 1, chatarra: 1, dolor: 1 };
    const VOCES = 6;
    const bufs = {}, sonando = {};
    const VER = ((typeof document !== 'undefined' && document.currentScript && /[?&]v=([^&]+)/.exec(document.currentScript.src)) || [])[1] || '';
    function cargaMuestras() {
      const lista = [];
      for (const k of Object.keys(MUESTRAS)) for (let i = 1; i <= MUESTRAS[k]; i++) lista.push([k, i]);
      let i = 0;
      const sig = () => {
        const it = lista[i++];
        if (!it || !ac) return;
        fetch('sfx/' + it[0] + '-' + it[1] + '.mp3' + (VER ? '?v=' + VER : ''))
          .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
          .then(b => new Promise((ok, mal) => ac.decodeAudioData(b, ok, mal)))
          .then(b => { (bufs[it[0]] || (bufs[it[0]] = [])).push(b); })
          .catch(() => { /* queda el sintetizado */ })
          .then(sig);
      };
      for (let k = 0; k < 4; k++) sig();
    }
    // Toca una grabación de `k` (false si no hay: suena el sintetizado).
    function muestra(k, v, lp) {
      const l = bufs[k];
      if (!l || !l.length) return false;
      if ((sonando[k] || 0) >= VOCES) return true;
      const b = l[(Math.random() * l.length) | 0];
      const s = ac.createBufferSource(), g = ac.createGain();
      s.buffer = b;
      if (VARIA[k]) s.playbackRate.value = azar(0.93, 1.07);
      g.gain.value = (GAN[k] || 0.5) * 1.25 * v;
      let n = s;
      if (lp < 0.98) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700 + 11000 * lp * lp; s.connect(f); n = f; }
      n.connect(g); g.connect(bus);
      sonando[k] = (sonando[k] || 0) + 1;
      s.onended = () => { sonando[k]--; try { g.disconnect(); } catch {} };
      s.start();
      suena(ac.currentTime + b.duration, 2);
      return true;
    }

    const ESPERA = { baja: 40, gemido: 0, impacto: 35, uzi: 20, rebote: 60, dolor: 120, chatarra: 45, avisoCombo: 300, racha: 400 };
    function son(k, lejos) {
      if (!ac) return;
      if (ac.state !== 'running') { if (ac.state !== 'closed') ac.resume().catch(() => {}); return; }
      const ahora = performance.now();
      if (ahora - (ultimo[k] || 0) < (ESPERA[k] !== undefined ? ESPERA[k] : 28)) return;
      if (carga() >= (lejos === undefined ? TOPE : TOPE_LEJOS)) return;
      ultimo[k] = ahora;
      const v = lejos === undefined ? 1 : clamp(1 - lejos / 620, 0.06, 0.75);
      // a lo lejos se pierden los agudos
      const lp = lejos === undefined ? 1 : clamp(1 - lejos / 900, 0.25, 1);
      if (muestra(k, v, lp)) return;
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
        case 'mejora':
          // Subir un arma de nivel: el cerrojo, un golpe de yunque y una escala que brilla.
          clic(0, 1800, 0.25); clic(0.06, 2600, 0.2);
          ruido({ tipo: 'bandpass', f: 3200, q: 8, dur: 0.25, vol: 0.18, t0: 0.1 });
          [659, 880, 1175, 1568].forEach((f, i) => tono({ f1: f, dur: 0.14, vol: 0.13, tipo: 'square', t0: 0.12 + i * 0.06 }));
          tono({ f1: 2349, dur: 0.35, vol: 0.06, tipo: 'triangle', t0: 0.36 });
          break;
        case 'nivel':
          [392, 523, 659, 784].forEach((f, i) => tono({ f1: f, f2: f * 1.01, dur: 0.22, vol: 0.15, tipo: 'triangle', t0: i * 0.11 }));
          tono({ f1: 98, dur: 0.6, vol: 0.25, t0: 0.33 });
          break;
        case 'chatarra':
          // una tuerca que cae en el bolsillo: tintineo metálico corto
          tono({ f1: azar(2300, 2900), f2: 2100, dur: 0.07, vol: 0.07, tipo: 'triangle' });
          tono({ f1: azar(3800, 4600), dur: 0.05, vol: 0.035, tipo: 'sine', t0: 0.025 });
          break;
        case 'racha':
          // un hito del multiplicador: subida brillante con golpe
          [440, 554, 659, 880, 1109].forEach((f, i) => tono({ f1: f, dur: 0.14, vol: 0.12, tipo: 'square', t0: i * 0.05 }));
          ruido({ tipo: 'highpass', f: 4000, dur: 0.35, vol: 0.12, t0: 0.22 });
          tono({ f1: 110, f2: 55, dur: 0.3, vol: 0.35, t0: 0.2 });
          break;
        case 'avisoCombo':
          // dos pitidos que bajan: el combo se está por caer
          tono({ f1: 1320, dur: 0.06, vol: 0.09, tipo: 'square' });
          tono({ f1: 990, dur: 0.08, vol: 0.09, tipo: 'square', t0: 0.09 });
          break;
        case 'quedan':
          // quedan cinco: tres golpes graves de tambor
          for (let i = 0; i < 3; i++) { tono({ f1: 150, f2: 60, dur: 0.16, vol: 0.32, t0: i * 0.14 }); ruido({ tipo: 'lowpass', f: 900, dur: 0.08, vol: 0.18, t0: i * 0.14 }); }
          break;
      }
    }

    /* ---------- la música ----------
       Un secuenciador de semicorcheas con 0,2 s de adelanto (setInterval de
       50 ms). `meta` es la intensidad que pide el juego (−1 = callar); `int`
       la sigue despacio para que las capas entren y salgan sin saltos. */
    const mus = { on: true, vol: 0.6, meta: -1, int: 0, jefe: false, paso: 0, t: 0, timer: null, bus: null };
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    // La menor, Fa, Sol, Mi menor; con jefe: La menor, Si bemol, Fa, Mi (tensión frigia)
    const ACORDES = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
    const ACORDES_JEFE = [[57, 60, 64], [58, 62, 65], [53, 57, 60], [52, 56, 59]];
    function nota(f, t, dur, vol, tipo, lp, ataque) {
      const os = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
      os.type = tipo; os.frequency.setValueAtTime(f, t);
      fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 0.8;
      const at = Math.min(ataque || 0.006, dur * 0.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + at);
      g.gain.setValueAtTime(vol, t + Math.max(at, dur * 0.6));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      os.connect(fl); fl.connect(g); g.connect(mus.bus);
      os.start(t); os.stop(t + dur + 0.05);
    }
    function golpeMus(t, dur, vol, tipo, f, q) {
      ruido({ tipo, f, q: q || 0.8, dur, vol, t0: Math.max(0, t - ac.currentTime), dest: mus.bus, libre: true });
    }
    function bombo(t, vol) {
      const os = ac.createOscillator(), g = ac.createGain();
      os.frequency.setValueAtTime(140, t); os.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      os.connect(g); g.connect(mus.bus); os.start(t); os.stop(t + 0.3);
    }
    function pasoMusica(p, t, d) {
      const i = mus.int, jefe = mus.jefe, s16 = p % 16, A = (jefe ? ACORDES_JEFE : ACORDES)[Math.floor(p / 16) % 4];
      // colchón: los tres sonidos del acorde, todo el compás
      if (s16 === 0) for (const m of A) nota(hz(m - 12), t, d * 16, 0.022, 'sawtooth', 500 + 700 * i, d * 4);
      // bajo
      if (i > 0.12 || jefe) {
        const pat = jefe ? [0, 2, 3, 6, 8, 10, 11, 14] : [0, 3, 6, 8, 11, 14];
        if (pat.includes(s16)) nota(hz(A[0] - 24 + (s16 === 3 || s16 === 11 ? 12 : 0)), t, d * 1.7, 0.085, 'sawtooth', 360 + 300 * i, 0.004);
      }
      // batería
      if (i > 0.3 || jefe) {
        if (s16 % 8 === 0 || ((i > 0.65 || jefe) && s16 % 4 === 0)) bombo(t, 0.42);
        if (s16 % 4 === 2 || (i > 0.6 && s16 % 2 === 1)) golpeMus(t, 0.035, 0.035, 'highpass', 7500);
      }
      if ((i > 0.5 || jefe) && (s16 === 4 || s16 === 12)) { golpeMus(t, 0.12, 0.13, 'bandpass', 1800, 0.9); nota(190, t, 0.08, 0.05, 'triangle', 2000); }
      // arpegio
      if (i > 0.72 || jefe) nota(hz(A[[0, 1, 2, 1][s16 % 4]] + 12), t, d * 0.8, 0.02, 'square', 1800 + 1200 * i, 0.003);
    }
    function programa() {
      if (!ac || ac.state !== 'running' || !mus.bus) return;
      const quiere = mus.on && mus.meta >= 0;
      mus.bus.gain.setTargetAtTime(quiere ? mus.vol * 0.6 : 0, ac.currentTime, quiere ? 0.8 : 0.4);
      if (!quiere && mus.bus.gain.value < 0.003) { mus.t = 0; return; }
      mus.int += ((mus.meta < 0 ? 0 : mus.meta) - mus.int) * 0.04;
      const d = 60 / (mus.jefe ? 136 : 102 + 24 * mus.int) / 4;
      if (mus.t < ac.currentTime) mus.t = ac.currentTime + 0.05;
      while (mus.t < ac.currentTime + 0.2) { pasoMusica(mus.paso, mus.t, d); mus.t += d; mus.paso++; }
    }
    function musica(meta, jefe) {
      mus.meta = meta; mus.jefe = !!jefe;
      if (meta < 0 || !ac || mus.timer) return;
      mus.bus = ac.createGain(); mus.bus.gain.value = 0; mus.bus.connect(salida);
      mus.timer = setInterval(programa, 50);
    }
    function ponMusica(on, vol) {
      if (on !== null && on !== undefined) mus.on = !!on;
      if (vol !== null && vol !== undefined) mus.vol = clamp(+vol || 0, 0, 1);
    }

    return { inicia, son, activo: () => !!(ac && ac.state === 'running'), musica, ponMusica, opcionesMusica: () => ({ on: mus.on, vol: mus.vol }) };
  }

  raiz.BoxheadAudio = { crear };
})(typeof self !== 'undefined' ? self : this);
