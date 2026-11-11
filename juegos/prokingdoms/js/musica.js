// Música y ambiente generados con Web Audio (U5 de la Fase 6), sin archivos. Pasa por la salida de sfx.js, así que la
// tecla M la calla igual que a los efectos, y el volumen compartido de Juegos (volumen.js) también la alcanza.
// Tiene su propio volumen en Opciones (pk_musica y pk_ambiente, 0–100).
//
// Cómo suena: un compás de 8 corcheas, frases de 4 compases con un acorde por compás. La melodía es un motivo
// sembrado por frase (se repite con variación, así que se reconoce) que cae en notas del acorde en los tiempos
// fuertes. Cada grupo de eras tiene su modo, su tempo y sus timbres; de noche todo baja de tempo y de octava y
// hay menos notas. En batalla (la vista de batalla o bandidos atacando) suena un tema rápido con tambores, y con
// un jefe en el campo se le suman platillos y sube el tempo. En el Archipiélago suena su propio modo.
// El ambiente, en cambio, sale de lo que se ve en pantalla (ver «ambiente» más abajo).
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
  // Lo común a la música y al ambiente. La música además pide su volumen > 0: antes «Música» en 0 también callaba el
  // ambiente (pájaros, olas, obras), aunque «Ambiente» estuviera en 60.
  function puedeSonar() {
    const X = PK.Sfx;
    return X && X.on && ctx && ctx.state === 'running' && !document.hidden && !(PK.Game && PK.Game.offline);
  }
  function suena() { return vol > 0 && puedeSonar(); }
  function tick() {
    if (!ctx && !armar()) return;
    const ahora = ctx.currentTime;
    if (!suena()) {
      if (bus.gain.value > 0.001) { bus.gain.cancelScheduledValues(ahora); bus.gain.setTargetAtTime(0, ahora, 0.2); }
      prox = 0;
      if (puedeSonar()) { const m = elegir(); if (m) modo = m; ambiente(ahora); } // sin música, el ambiente sigue
      return;
    }
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
  // Suena lo que se ve (resto de la Fase 6): cada 1,5 s `mirar` recorre la pantalla (una grilla de 16 × 10 puntos
  // sobre el mapa explorado, más los edificios y aldeanos a la vista) y arma las fuentes con su peso y su lugar en
  // la pantalla. Cada sonido sale por un paneo según de qué lado está (olas a la izquierda si el agua está a la
  // izquierda) y más fuerte con el zoom cerca. La estación, la noche y el mar siguen mandando sobre los pájaros, los
  // grillos y el viento. Nada de esto toca el juego: solo lee.
  const TALA = { tree: 'hacha', palm: 'hacha' }, PICO = { stone: 'pico', gold: 'pico', ore: 'pico', marble: 'pico', gems: 'pico', arrecife: 'pico' };
  const YUNQUE = { forge: 1, smelter: 1, steelworks: 1, workshop: 1 }, SIERRA = { sawmill: 1, masonry: 1, cartwright: 1 }, GENTE = { house: 1, market: 1, tc: 1, tavern: 1, guild: 1 };
  let escena = null, tMira = 0;
  function mirar() {
    const R = PK.Render, G = PK.Game, W = PK.World;
    if (!R || !R.cv || !W || !W.terrain || !W.fog) return null;
    const w = R.cv.width / R.dpr, h = R.cv.height / R.dpr, s = {};
    const suma = (k, x, p) => { const f = s[k] || (s[k] = { n: 0, x: 0 }); f.n += p || 1; f.x += (x / w) * (p || 1); };
    let vistos = 0;
    for (let j = 0; j < 10; j++) for (let i = 0; i < 16; i++) {
      const sx = ((i + 0.5) / 16) * w, sy = ((j + 0.5) / 10) * h, t = R.screenToTile(sx, sy), tx = Math.floor(t[0]), ty = Math.floor(t[1]);
      if (!W.inb(tx, ty)) continue;
      const k = W.idx(tx, ty);
      if (!W.fog[k]) continue;
      vistos++;
      const ter = W.terrain[k], nid = W.nodeAt[k], n = nid >= 0 ? W.nodes[nid] : null;
      if (ter === 4) suma('agua', sx); else if (ter === 3) suma('costa', sx);
      if (n && !n.dead && (n.kind === 'tree' || n.kind === 'palm')) suma('bosque', sx);
      else if (ter === 1) suma('bosque', sx, 0.5);
      else if (ter === 0) suma('pasto', sx);
    }
    const enPantalla = (tx, ty) => { const p = R.iso(tx, ty), q = R.worldToScreen(p[0], p[1]); return q[0] > -40 && q[0] < w + 40 && q[1] > -40 && q[1] < h + 40 ? q : null; };
    // pk-37: obras, talleres y aldeanos ajenos pesan según qué tan al centro de la pantalla están (lo de la orilla
    // casi no cuenta), como los golpes de tus aldeanos (Render.volumenEn)
    const alCentro = q => Math.pow(Math.max(0, 1 - 0.95 * Math.hypot((q[0] - w / 2) / (w / 2), (q[1] - h / 2) / (h / 2)) / Math.SQRT2), 1.3);
    for (const b of G.buildings || []) {
      const q = enPantalla(b.x + b.w / 2, b.y + b.h / 2);
      if (!q) continue;
      const c = alCentro(q);
      if (c < 0.05) continue;
      if (!b.done || b.upg) suma('obra', q[0], c);
      else if (b.workers && b.workers.length && YUNQUE[b.type]) suma('yunque', q[0], b.workers.length * c);
      else if (b.workers && b.workers.length && SIERRA[b.type]) suma('sierra', q[0], b.workers.length * c);
      if (b.done && GENTE[b.type]) suma('gente', q[0], (b.type === 'house' ? 1 : 3) * c);
    }
    for (const u of G.units || []) {
      // los tuyos ya suenan en cada golpe (impact en render.js); aquí, los de los otros reinos
      if (u.owner === 'p' || u.inside || u.mode !== 'work' || !u.task || u.task.t !== 'gather') continue;
      const n = W.nodes[u.task.node], tipo = n && (TALA[n.kind] || PICO[n.kind]);
      if (!tipo) continue;
      const q = enPantalla(u.x, u.y), c = q ? alCentro(q) : 0;
      if (c >= 0.05) suma(tipo, q[0], c);
    }
    for (const k in s) s[k].x = s[k].x / s[k].n; // de 0 (izquierda) a 1 (derecha)
    s.vistos = vistos;
    s.cerca = Math.max(0.55, Math.min(1.5, (R.cam.z || 2) / 2)); // el zoom acerca (la naturaleza)
    s.cercaCosas = Math.pow(Math.max(0, Math.min(1, ((R.cam.z || 2) - 0.25) / 2.25)), 1.1); // y los trabajos, mucho más
    return s;
  }
  // un canal con paneo para un sonido: se desarma solo cuando termina
  function canal(x, dur) {
    const g = ctx.createGain();
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.8, Math.min(0.8, ((x === undefined ? 0.5 : x) - 0.5) * 1.6));
      g.connect(p); p.connect(amb);
      setTimeout(() => { try { p.disconnect(); g.disconnect(); } catch (e) { /* ya estaba */ } }, (dur + 0.5) * 1000);
    } else g.connect(amb);
    return g;
  }
  // qué suena ahora: cada fuente con su peso (cuánto hay a la vista), una por vez, al azar según el peso
  function fuentes(s, est, enMar) {
    const f = [], fr = k => (s[k] ? s[k].n : 0), V = Math.max(1, s.vistos);
    const agua = fr('agua') / V, costa = fr('costa') / V, bosque = fr('bosque') / V, pasto = fr('pasto') / V;
    if (agua > 0.03 || enMar) f.push(['olas', 0.4 + agua * 2.2 + costa * 3, s.agua ? s.agua.x : 0.5, 0.5 + Math.min(1, agua * 1.5 + costa * 2) * 0.6]);
    if ((agua > 0.15 || enMar) && !noche) f.push(['gaviota', 0.25 + agua * 0.6, s.agua ? s.agua.x : 0.5, 0.8]);
    if (noche) f.push(['grillo', 0.3 + pasto * 2 + bosque, s.pasto ? s.pasto.x : 0.5, 1]);
    else if (est !== 3) f.push(['pajaro', 0.15 + bosque * 3 + pasto * 0.5, s.bosque ? s.bosque.x : 0.5, 0.7 + Math.min(1, bosque * 2) * 0.5]);
    f.push(['viento', est === 3 ? 1.6 : 0.12 + (s.vistos < 40 ? 0.6 : 0), 0.5, est === 3 ? 1 : 0.7]);
    const cosas = [['obra', 1.2], ['hacha', 0.5], ['pico', 0.5], ['yunque', 0.6], ['sierra', 0.5], ['gente', 0.12]];
    // e[4]: es un trabajo (suena según el zoom, s.cercaCosas, no como la naturaleza)
    for (const [k, p] of cosas) if (s[k] && s[k].n > 0.05) f.push([k, Math.min(2.2, p * s[k].n), s[k].x, Math.min(1.3, 0.6 + 0.1 * s[k].n), true]);
    return f;
  }
  function ambiente(ahora) {
    if (volAmb <= 0 || modo === 'batalla' || ahora < tAmb) return;
    const G = PK.Game, enMar = !!(G.enMar && G.enMar()), est = PK.Vida && PK.Vida.estacion ? PK.Vida.estacion() : 0;
    if (!escena || ahora > tMira) { escena = mirar() || { vistos: 0, cerca: 1 }; tMira = ahora + 1.5; }
    const f = fuentes(escena, enMar ? 0 : est, enMar);
    const tot = f.reduce((a, x) => a + x[1], 0);
    let r = Math.random() * tot, e = f[0];
    for (const x of f) { if ((r -= x[1]) <= 0) { e = x; break; } }
    // con mucho a la vista los sonidos vienen más seguido
    tAmb = ahora + Math.max(1.1, 4.5 - tot * 0.6) + Math.random() * 2.5;
    if (e) sonar(e[0], ahora, e[2], 0.5 * e[3] * (e[4] ? (escena.cercaCosas !== undefined ? escena.cercaCosas * 1.3 : 1) : escena.cerca));
  }
  // pk-38: si la grabación de ese sonido ya llegó (sfx.js), suena ella; si no, lo sintetizado de abajo.
  // [archivo, golpes (segundos desde t)]: hacha, pico y yunque repiten el golpe como antes.
  const GRABADO = {
    olas: ['amb-olas', [0]], viento: ['amb-viento', [0]], grillo: ['amb-grillo', [0]], pajaro: ['amb-pajaro', [0]], gaviota: ['amb-gaviota', [0]],
    obra: ['amb-obra', [0]], sierra: ['amb-sierra', [0]], gente: ['amb-gente', [0]], yunque: ['amb-yunque', [0, 0.5]],
    hacha: ['amb-hacha', [0, 0.6]], pico: ['amb-pico', [0, 0.36, 0.72]],
  };
  function grabado(k, t, x, v) {
    const X = PK.Sfx, e = GRABADO[k];
    if (!e || !X || !X.duracion || !X.duracion(e[0])) return false;
    const d = canal(x, X.duracion(e[0]) + e[1][e[1].length - 1]);
    // v ronda 0.5 con el zoom normal: la ganancia de sfx.js se midió así
    for (const dt of e[1]) X.muestra(e[0], d, v / 0.5, t + dt);
    return true;
  }
  function sonar(k, t, x, v) {
    if (grabado(k, t, x, v)) return;
    if (k === 'olas') { const d = canal(x, 3.6); ruido(t, 3.2, v * 0.06, 420, 'lowpass', d, 1.4); return; }
    if (k === 'viento') { const d = canal(x, 4.4); ruido(t, 4, v * 0.06, 520, 'bandpass', d, 1.8); return; }
    if (k === 'grillo') { grillo(t, canal(x, 0.6)); return; }
    if (k === 'pajaro') { pajaro(t, v, canal(x, 1)); return; }
    if (k === 'gaviota') { const d = canal(x, 1.2); for (let i = 0; i < 2; i++) barrido(t + i * 0.32, 1500, 950, 0.24, 'triangle', v * 0.03, d); return; }
    if (k === 'obra') { const d = canal(x, 1.6); for (let i = 0; i < 3; i++) { ruido(t + i * 0.42, 0.05, v * 0.05, 1500, 'bandpass', d); nota(80, t + i * 0.42, 0.06, 'triangle', v * 0.03, 0.003, d); } return; }
    if (k === 'hacha') { const d = canal(x, 1.4); for (let i = 0; i < 2; i++) { ruido(t + i * 0.6, 0.07, v * 0.06, 850, 'bandpass', d); nota(43, t + i * 0.6, 0.1, 'triangle', v * 0.05, 0.002, d); } return; }
    if (k === 'pico') { const d = canal(x, 1.2); for (let i = 0; i < 3; i++) { nota(98 + (i % 2) * 2, t + i * 0.36, 0.09, 'triangle', v * 0.018, 0.001, d); ruido(t + i * 0.36, 0.03, v * 0.03, 3200, 'highpass', d); } return; }
    if (k === 'yunque') { const d = canal(x, 1.6); for (let i = 0; i < 2; i++) { nota(93, t + i * 0.5, 0.55, 'sine', v * 0.022, 0.001, d); nota(100, t + i * 0.5, 0.3, 'sine', v * 0.01, 0.001, d); } return; }
    if (k === 'sierra') { const d = canal(x, 1.4); for (let i = 0; i < 4; i++) ruido(t + i * 0.26, 0.22, v * 0.03, i % 2 ? 2400 : 1800, 'bandpass', d, 0.06); return; }
    if (k === 'gente') { const d = canal(x, 1.8); const n = 3 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) ruido(t + i * (0.18 + Math.random() * 0.2), 0.16 + Math.random() * 0.14, v * 0.025, 350 + Math.random() * 600, 'bandpass', d, 0.04); }
  }
  function barrido(t, f0, f1, dur, onda, v, destino) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = onda; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino || amb); o.start(t); o.stop(t + dur + 0.05);
  }
  function grillo(t, destino) {
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 4300;
      const ti = t + i * 0.085;
      g.gain.setValueAtTime(0.0001, ti); g.gain.exponentialRampToValueAtTime(0.012, ti + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.05);
      o.connect(g); g.connect(destino || amb); o.start(ti); o.stop(ti + 0.08);
    }
  }
  function pajaro(t, v, destino) {
    const n = 2 + Math.floor(Math.random() * 3), f0 = 2400 + Math.random() * 1400;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), ti = t + i * (0.11 + Math.random() * 0.05);
      o.type = 'sine'; o.frequency.setValueAtTime(f0, ti); o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.3), ti + 0.07);
      g.gain.setValueAtTime(0.0001, ti); g.gain.exponentialRampToValueAtTime(v * 0.035, ti + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.09);
      o.connect(g); g.connect(destino || amb); o.start(ti); o.stop(ti + 0.12);
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
  M.escena = () => mirar(); // lo que el ambiente ve en pantalla (para probar)
  M.fuentes = () => { const s = mirar(); return s ? fuentes(s, PK.Vida && PK.Vida.estacion ? PK.Vida.estacion() : 0, !!(PK.Game.enMar && PK.Game.enMar())) : []; };
  M.iniciar = function () { if (!timer) timer = setInterval(tick, 100); };
})();
