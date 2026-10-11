/* Trigon — la pantalla.
   Todo lo que decide una partida está en motor.js (el tablero, las piezas de
   cada tanda y las líneas que se borran); aquí solo se dibuja, se arrastra,
   se suena y se lleva la cuenta. El tablero es un SVG: cada triángulo es un
   <polygon> con su color, y la pieza que se arrastra es otro SVG fijo a la
   ventana, a la misma escala que el tablero, que se imanta a la posición
   válida más cercana. */
(() => {
  'use strict';
  const M = window.TrigonMotor, Club = window.Club;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  // El color de cada forma lo pone el tema (temas.css, --p1…--p8): aquí solo se apunta a la variable.
  const color = v => 'var(--p' + v + ')';
  const ENCOGE = 0.86;

  /* ---------- Guardado: por ahora solo el récord, en este navegador ---------- */
  const CUENTA = Club && Club.storageKey ? Club.storageKey('').replace(/^\.cuenta\./, '') : 'local';
  const clave = k => Club && Club.storageKey ? Club.storageKey(k) : k + '.cuenta.local';
  function lee(k) { try { return JSON.parse(localStorage.getItem(clave(k)) || 'null'); } catch (_) { return null; } }
  function guarda(k, v) { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } }
  const prog = Object.assign({ mejor: 0, partidas: 0 }, lee('trigon.datos'));

  let E = null, terminada = false, kb = null;
  const CAT = 'club-trigon-puntos';
  const VIGENCIA = 24 * 3600 * 1000;

  /* ---------- Sonido ----------
     Un AudioContext con tres salidas: la música («Prisma Neón», musica.js,
     que trae sus propios sintetizadores y no pasa por el chip de la casa),
     los efectos y una reverb de sala hecha aquí mismo (un impulso de ruido
     que se apaga), a la que los efectos mandan un poco: es lo que hace que
     cerrar una línea suene a campana y no a pitido. Todo sale por
     ctx.destination, que volumen.js ya envolvió, así que el 🔊 del Club y su
     deslizador gobiernan las dos cosas; ♪ y el parlante de la barra callan
     una u otra.
     Los efectos están en la tonalidad de la música (Fa# menor): poner una
     pieza es una nota suave de la pentatónica, una por forma; cerrar líneas
     es un acorde en arpegio que crece con dos líneas y se satura en tres, y
     la racha va recorriendo los acordes del tema. */
  let ac = null, bus = null, ruidoBuf = null, rep = null;
  let mudo = false, sinMusica = false;
  try { mudo = localStorage.getItem('trigon.mudo') === '1'; sinMusica = localStorage.getItem('trigon.musica') === '0'; } catch (_) { /* nada */ }
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  function impulso(c, seg) {
    const n = Math.floor(c.sampleRate * seg), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3.4; }
    return b;
  }
  // Crea el contexto y sus buses (el navegador solo lo deja tras un gesto) o lo despierta.
  function contexto() {
    if (mudo && sinMusica) return null;
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const master = ac.createGain(); master.gain.value = .9; master.connect(ac.destination);
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .25;
        comp.connect(master);
        const fx = ac.createGain(); fx.connect(comp);
        const rev = ac.createConvolver(); rev.buffer = impulso(ac, 2.6);
        const revSal = ac.createGain(); revSal.gain.value = .5; rev.connect(revSal); revSal.connect(comp);
        const mus = ac.createGain(); mus.gain.value = .5; mus.connect(master);
        bus = { fx, rev, mus };
        ruidoBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        ac.onstatechange = musica;
      }
      if (ac.state === 'suspended') ac.resume().catch(() => {});
    } catch (_) { ac = null; }
    return ac;
  }
  const ctxEfectos = () => (mudo ? null : contexto());
  const sale = (c, g, o) => {
    let x = g;
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); x = p; }
    x.connect(bus.fx);
    if (o.rev) { const r = c.createGain(); r.gain.value = o.rev; x.connect(r); r.connect(bus.rev); }
  };
  const envolvente = (g, t, a, dur, vol) => {
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  };
  /* Una voz: oscilador con golpe y caída. `fm` la vuelve campana (un
     modulador que se apaga antes que la portadora, como un vidrio), `corte`
     le pone un pasabajos que puede cerrarse, `det` la desafina. */
  function voz(o) {
    const c = ctxEfectos(); if (!c || !bus) return;
    try {
      const t = c.currentTime + .005 + (o.t || 0), dur = o.dur;
      const os = c.createOscillator(), g = c.createGain();
      os.type = o.tipo || 'sine'; os.frequency.setValueAtTime(o.f, t);
      if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || dur));
      if (o.det) os.detune.value = o.det;
      let n = os, mod = null;
      if (o.fm) {
        mod = c.createOscillator(); const mg = c.createGain();
        mod.frequency.value = o.f * o.fm;
        mg.gain.setValueAtTime(o.f * (o.ind || 1.5), t); mg.gain.exponentialRampToValueAtTime(o.f * .02 + 1, t + dur * .5);
        mod.connect(mg); mg.connect(os.frequency); mod.start(t); mod.stop(t + dur + .05);
      }
      if (o.corte) {
        const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || .7;
        fl.frequency.setValueAtTime(o.corte, t);
        if (o.corte1) fl.frequency.exponentialRampToValueAtTime(o.corte1, t + dur);
        n.connect(fl); n = fl;
      }
      n.connect(g); envolvente(g, t, o.a || .004, dur, o.vol || .08); sale(c, g, o);
      os.start(t); os.stop(t + dur + .05);
      os.onended = () => { try { g.disconnect(); } catch (_) { /* nada */ } };
    } catch (_) { /* el sonido nunca para el juego */ }
  }
  // Un soplo de ruido filtrado: chasquidos, roces, el aire de una explosión.
  function soplo(o) {
    const c = ctxEfectos(); if (!c || !bus) return;
    try {
      const t = c.currentTime + .005 + (o.t || 0), src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = ruidoBuf; src.loop = true;
      fl.type = o.tipo || 'bandpass'; fl.Q.value = o.q || 1;
      fl.frequency.setValueAtTime(o.f || 1000, t);
      if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
      src.connect(fl); fl.connect(g); envolvente(g, t, o.a || .002, o.dur, o.vol || .04); sale(c, g, o);
      src.start(t, Math.random() * .8); src.stop(t + o.dur + .05);
      src.onended = () => { try { g.disconnect(); } catch (_) { /* nada */ } };
    } catch (_) { /* nada */ }
  }
  // Fa# menor: la pentatónica para las piezas y los acordes del tema para las líneas.
  const PENTA = [66, 69, 71, 73, 76, 78, 81, 83, 85, 88];
  const ACORDES = [[54, 66, 69, 73, 76, 80], [50, 62, 66, 69, 73, 76], [47, 59, 62, 66, 69, 73], [45, 57, 61, 64, 68, 71]];
  const campana = (t, m, vol, dur, pan, rev) => voz({ t, f: hz(m), fm: 2, ind: 1.6, dur, vol, pan, rev });
  const brillo = (t, m, vol) => voz({ t, f: hz(m), fm: 3.5, ind: .9, dur: .5, vol, pan: Math.random() * 1.4 - .7, rev: .6 });
  // Un colchón de dos sierras desafinadas que se cierra despacio: el «aaah» de debajo.
  const colchon = (t, notas, vol, dur) => notas.forEach(m => [-9, 9].forEach(det =>
    voz({ t, f: hz(m), tipo: 'sawtooth', det, a: .09, dur, vol, corte: 1500, corte1: 450, rev: .5 })));
  const sonidos = {
    toma: () => voz({ f: 1480, dur: .045, vol: .025, rev: .05 }),
    // Poner una pieza: un «toc» de vidrio, suave, con la nota de su forma.
    pone: (forma, x) => {
      const m = PENTA[(forma || 0) % 8], pan = (x || 0) * .6;
      voz({ f: hz(m), fm: 2, ind: .7, dur: .34, vol: .065, pan, rev: .16 });
      voz({ f: hz(m - 12), tipo: 'triangle', dur: .14, vol: .05, corte: 900, pan });
      voz({ f: 150, f1: 68, glide: .06, dur: .09, vol: .08 });
      soplo({ dur: .025, vol: .02, f: 3200, q: 1.4, pan });
    },
    vuelve: () => voz({ f: 520, f1: 300, dur: .14, vol: .035, tipo: 'triangle', rev: .1 }),
    /* Cerrar líneas: con una, cuatro campanas del acorde; con dos, seis más
       un colchón y destellos; con tres o más (se satura ahí), dos octavas,
       el bajo, un barrido de aire y una campana final arriba. */
    borra: (n, racha) => {
      const k = Math.max(1, Math.min(3, n)), ch = ACORDES[Math.max(0, (racha || 1) - 1) % ACORDES.length];
      const notas = k === 1 ? ch.slice(1, 5) : k === 2 ? ch.slice(1).concat(ch[1] + 12)
        : ch.slice(1).concat(ch.slice(1, 4).map(m => m + 12));
      const paso = [.075, .058, .045][k - 1];
      notas.forEach((m, i) => campana(i * paso, m, .055 + k * .006, .9 + k * .25, (i / (notas.length - 1) - .5) * 1.2, .35 + k * .08));
      voz({ f: hz(ch[0] + 12), fm: 1, ind: .4, dur: .5 + k * .2, vol: .05 + k * .015 });
      if (k >= 2) {
        colchon(0, ch.slice(1, k === 3 ? 5 : 4), .016 + k * .003, 1.2 + k * .3);
        for (let i = 0; i < (k === 2 ? 4 : 8); i++) brillo(.18 + i * .07, PENTA[(i * 3 + 2) % PENTA.length] + 12, .022);
      }
      if (k === 3) {
        voz({ f: hz(ch[0]), dur: 1.6, vol: .12, a: .02 });
        soplo({ dur: 1.2, vol: .028, tipo: 'highpass', f: 1800, f1: 9000, q: .7, rev: .6, a: .2 });
        campana(notas.length * paso + .12, ch[1] + 24, .045, 1.6, 0, .7);
      }
    },
    fin: () => {
      [76, 73, 69, 66, 61].forEach((m, i) => campana(i * .16, m, .05, 1.1, (2 - i) * .25, .45));
      colchon(.3, [54, 61, 66], .016, 2);
    },
    // Ganar un poder: un barrido de cristal que sube.
    poder: () => {
      [0, 2, 4, 7].forEach((j, i) => voz({ t: i * .055, f: hz(PENTA[j] + 12), tipo: 'sawtooth', det: 9, dur: .14, vol: .024, corte: 3800, corte1: 1200, rev: .3 }));
      soplo({ t: .05, dur: .35, vol: .02, tipo: 'bandpass', f: 1200, f1: 7000, q: 3, rev: .4 });
      brillo(.24, PENTA[9] + 12, .03);
    },
    // El martillo rompe un triángulo: golpe seco y vidrio que se quiebra.
    golpe: () => {
      voz({ f: 190, f1: 55, glide: .08, dur: .14, vol: .14 });
      soplo({ dur: .12, vol: .09, f: 2400, q: 1.2 });
      for (let i = 0; i < 4; i++) voz({ t: .015 + i * .028, f: 2200 + Math.random() * 2400, fm: 2.7, ind: 2, dur: .16, vol: .016, pan: Math.random() - .5, rev: .3 });
    },
    // La bomba: un estallido grave con aire.
    bomba: () => {
      voz({ f: 110, f1: 28, glide: .5, dur: .7, vol: .22 });
      soplo({ dur: .8, vol: .1, tipo: 'lowpass', f: 2400, f1: 120, q: .7, rev: .3 });
      soplo({ t: .02, dur: .25, vol: .04, f: 5000, f1: 1500, q: .8 });
    },
    // Segunda oportunidad: la bomba y un barrido que sube, como un respiro.
    vida: () => {
      sonidos.bomba();
      soplo({ t: .35, dur: .9, vol: .03, tipo: 'bandpass', f: 400, f1: 6000, q: 2, rev: .6 });
      [0, 2, 4, 5, 7].forEach((j, i) => campana(.45 + i * .07, PENTA[j] + 12, .04, .9, (i - 2) * .3, .5));
    },
    // Girar: un roce de aire que sube.
    girar: () => {
      soplo({ dur: .2, vol: .05, tipo: 'bandpass', f: 700, f1: 3600, q: 2.5, rev: .15 });
      voz({ f: hz(73), f1: hz(85), glide: .12, dur: .16, vol: .035, tipo: 'triangle', rev: .2 });
    },
    // Cambiar la mano: tres naipes que se barajan.
    cambio: () => {
      for (let i = 0; i < 3; i++) soplo({ t: i * .06, dur: .06, vol: .05, tipo: 'highpass', f: 2600 + i * 600, q: .8 });
      [0, 4, 7].forEach((j, i) => voz({ t: .2 + i * .05, f: hz(PENTA[j] + 12), fm: 2, ind: .8, dur: .3, vol: .03, rev: .3 }));
    }
  };

  /* La música: «Prisma Neón» (musica.js, sus propios sintetizadores)
     mientras la página se ve. En el menú y al terminar calla la melodía y
     quedan los pads, el bajo y la ciudad. */
  function musica() {
    const c = ac, TM = window.TrigonMusica;
    const suena = !sinMusica && c && bus && c.state === 'running' && !document.hidden && TM;
    if (!suena) { if (rep) try { rep.detener(); } catch (_) { /* nada */ } return; }
    try {
      if (!rep) rep = TM.crear(c, bus.mus, { jugando: () => !!E && !terminada && !enMenu() });
      rep.arranca();
    } catch (_) { rep = null; }
  }
  function pintaSonido() {
    const b = $('sound-button'), m = $('music-button');
    b.setAttribute('aria-pressed', mudo ? 'false' : 'true');
    b.setAttribute('aria-label', mudo ? 'Activar efectos' : 'Desactivar efectos');
    m.setAttribute('aria-pressed', sinMusica ? 'false' : 'true');
    m.setAttribute('aria-label', sinMusica ? 'Activar música' : 'Desactivar música');
  }
  $('sound-button').addEventListener('click', () => {
    mudo = !mudo;
    try { localStorage.setItem('trigon.mudo', mudo ? '1' : '0'); } catch (_) { /* nada */ }
    pintaSonido(); if (!mudo) sonidos.pone(0, 0);
  });
  $('music-button').addEventListener('click', () => {
    sinMusica = !sinMusica;
    try { localStorage.setItem('trigon.musica', sinMusica ? '0' : '1'); } catch (_) { /* nada */ }
    pintaSonido(); contexto(); musica();
  });
  // El primer gesto en cualquier parte despierta el audio y arranca la música.
  for (const t of ['pointerdown', 'keydown']) addEventListener(t, () => { contexto(); musica(); }, true);
  document.addEventListener('visibilitychange', musica);
  pintaSonido();

  /* ---------- Geometría en pantalla ---------- */
  const PAD = 0.3;
  const VB = { x: -M.LADO - PAD, y: -M.LADO * M.H - PAD, w: 2 * (M.LADO + PAD), h: 2 * (M.LADO * M.H + PAD) };

  // Los puntos de un triángulo en el plano, encogidos hacia su centro para dejar la junta.
  function puntos(x, y, d, k) {
    const v = M.vertices(x, y, d).map(([a, b]) => M.plano(a, b));
    const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cy = (v[0][1] + v[1][1] + v[2][1]) / 3;
    return v.map(([a, b]) => (cx + (a - cx) * k).toFixed(4) + ',' + (cy + (b - cy) * k).toFixed(4)).join(' ');
  }
  function poligono(padre, x, y, d, clase) {
    const p = document.createElementNS(NS, 'polygon');
    p.setAttribute('points', puntos(x, y, d, ENCOGE));
    if (clase) p.setAttribute('class', clase);
    padre.appendChild(p);
    if (clase === 'celda' || clase === 'pieza') padre.appendChild(bisel(x, y, d));
    return p;
  }
  /* El bisel que hace de cada triángulo una gema: tres caras inclinadas
     entre el borde y una mesa interior, iluminadas desde arriba (blanco las
     que miran a la luz, negro las que le dan la espalda), y la mesa con un
     brillo leve. Va justo después de su triángulo, así el CSS lo prende y
     apaga con `.celda.llena + .bisel` sin tocar el polígono de siempre. */
  const LUZ = [-.36, -.93], MESA = .5;
  function bisel(x, y, d) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'bisel');
    const v = M.vertices(x, y, d).map(([a, b]) => M.plano(a, b));
    const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cy = (v[0][1] + v[1][1] + v[2][1]) / 3;
    const en = k => v.map(([a, b]) => [cx + (a - cx) * k, cy + (b - cy) * k]);
    const fuera = en(ENCOGE), dentro = en(MESA), txt = ps => ps.map(([a, b]) => a.toFixed(4) + ',' + b.toFixed(4)).join(' ');
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      const mx = (fuera[i][0] + fuera[j][0]) / 2 - cx, my = (fuera[i][1] + fuera[j][1]) / 2 - cy, n = Math.hypot(mx, my);
      const luz = (mx * LUZ[0] + my * LUZ[1]) / n;
      const cara = document.createElementNS(NS, 'polygon');
      cara.setAttribute('points', txt([fuera[i], fuera[j], dentro[j], dentro[i]]));
      cara.setAttribute('fill', luz > 0 ? '#fff' : '#000');
      cara.setAttribute('fill-opacity', (luz > 0 ? .1 + .34 * luz : .1 + .3 * -luz).toFixed(3));
      g.appendChild(cara);
    }
    const mesa = document.createElementNS(NS, 'polygon');
    mesa.setAttribute('points', txt(dentro)); mesa.setAttribute('class', 'mesa');
    g.appendChild(mesa);
    return g;
  }
  // La caja de una pieza en el plano, contando sus vértices.
  function caja(celdas) {
    const v = celdas.flatMap(([x, y, d]) => M.vertices(x, y, d).map(([a, b]) => M.plano(a, b)));
    const xs = v.map(p => p[0]), ys = v.map(p => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
  }
  function dibujaPieza(svg, p, margen) {
    svg.replaceChildren();
    const celdas = M.celdasDe(p), b = caja(celdas);
    svg.setAttribute('viewBox', [b.x - margen, b.y - margen, b.w + 2 * margen, b.h + 2 * margen].map(n => n.toFixed(4)).join(' '));
    svg.style.setProperty('--color', color(p.f + 1));
    for (const [x, y, d] of celdas) poligono(svg, x, y, d, 'pieza');
    return b;
  }

  /* ---------- El tablero ---------- */
  const tablero = $('tablero');
  tablero.setAttribute('viewBox', [VB.x, VB.y, VB.w, VB.h].map(n => n.toFixed(4)).join(' '));
  $('escenario').style.aspectRatio = (VB.w / VB.h).toFixed(4);
  const capaCeldas = document.createElementNS(NS, 'g'), capaEfectos = document.createElementNS(NS, 'g');
  tablero.append(capaCeldas, capaEfectos);
  const celdas = M.CELDAS.map(c => poligono(capaCeldas, c.x, c.y, c.d, 'celda'));
  celdas.forEach((p, i) => p.setAttribute('data-i', String(i)));

  function pintaTablero() {
    M.CELDAS.forEach((_, i) => {
      const v = E.t[i];
      celdas[i].classList.toggle('llena', !!v);
      celdas[i].style.setProperty('--color', v ? color(v) : '');
      celdas[i].classList.remove('fantasma', 'cierra', 'invalida');
    });
  }
  // Las casillas recién puestas se asientan: entran un poco grandes y con un destello.
  function asienta(casillas) {
    for (const i of casillas) {
      const c = celdas[i];
      c.classList.remove('nueva'); void c.getBBox(); c.classList.add('nueva');
      setTimeout(() => c.classList.remove('nueva'), 420);
    }
  }
  function estalla(casillas, valores) {
    const arcoiris = raiz.dataset.skin === 'gris';
    casillas.forEach((i, k) => {
      const c = M.CELDAS[i], p = poligono(capaEfectos, c.x, c.y, c.d, 'estalla');
      p.style.setProperty('--color', arcoiris ? 'hsl(' + (k * 47 % 360) + ' 85% 60%)' : valores[k] ? color(valores[k]) : 'var(--tinta)');
      p.style.animationDelay = (k % 12) * 12 + 'ms';
      setTimeout(() => p.remove(), 700);
    });
  }

  /* ---------- Celebraciones por tema ----------
     Al cerrar líneas, cada tema suelta lo suyo sobre el tablero, en una capa
     de DOM encima del SVG: Halloween, calabazas, murciélagos y vampiros;
     Espacio, un cohete por línea; Forest, luciérnagas; Gris, una onda (sus
     triángulos además estallan en arcoíris, en `estalla`). Clásico se queda
     con el estallido de siempre. */
  const efectos = $('efectos');
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)');
  const azar = (a, b) => a + Math.random() * (b - a);
  // El centro de una línea, en % del tablero.
  function centroDe(j) {
    let sx = 0, sy = 0;
    for (const i of M.LINEAS[j]) {
      const c = M.CELDAS[i];
      for (const [a, b] of M.vertices(c.x, c.y, c.d)) { const [px, py] = M.plano(a, b); sx += px; sy += py; }
    }
    const n = M.LINEAS[j].length * 3;
    return { x: (sx / n - VB.x) / VB.w * 100, y: (sy / n - VB.y) / VB.h * 100 };
  }
  function suelta_efecto(clase, x, y, texto, dura, props) {
    const el = document.createElement('span');
    el.className = 'fx ' + clase;
    el.style.left = x + '%'; el.style.top = y + '%';
    if (texto) el.textContent = texto;
    for (const [k, v] of Object.entries(props || {})) el.style.setProperty(k, v);
    efectos.appendChild(el);
    setTimeout(() => el.remove(), dura);
  }
  const CELEBRACIONES = {
    halloween(centros) {
      const caras = ['🎃', '🦇', '🧛', '🎃', '👻'];
      centros.forEach((c, k) => {
        for (let n = 0; n < 2; n++)
          suelta_efecto('fx-susto', c.x + azar(-14, 14), c.y, caras[Math.floor(Math.random() * caras.length)], 1500,
            { '--dx': azar(-40, 40) + 'px', 'animation-delay': (k * 120 + n * 160) + 'ms' });
      });
      if (centros.length >= 2)
        for (let n = 0; n < 5; n++) suelta_efecto('fx-bandada', -10, azar(10, 60), '🦇', 2200, { 'animation-delay': n * 90 + 'ms' });
    },
    espacio(centros) {
      centros.forEach((c, k) => {
        suelta_efecto('fx-cohete', c.x, c.y, '🚀', 1400, { 'animation-delay': k * 180 + 'ms' });
        for (let n = 0; n < 4; n++)
          suelta_efecto('fx-chispa', c.x + azar(-12, 12), c.y + azar(-6, 6), '✨', 900, { 'animation-delay': (k * 180 + n * 60) + 'ms' });
      });
    },
    forest(centros) {
      centros.forEach((c, k) => {
        for (let n = 0; n < 9; n++)
          suelta_efecto('fx-luciernaga', c.x + azar(-22, 22), c.y + azar(-6, 6), '', 2200,
            { '--dx': azar(-30, 30) + 'px', '--dy': azar(-90, -40) + 'px', 'animation-delay': (k * 100 + n * 70) + 'ms' });
      });
    },
    gris(centros) {
      centros.forEach((c, k) => suelta_efecto('fx-onda', c.x, c.y, '', 900, { 'animation-delay': k * 90 + 'ms' }));
    }
  };
  function celebra(lineas) {
    const f = CELEBRACIONES[raiz.dataset.skin];
    if (!f || sinMovimiento.matches || !lineas.length) return;
    f(lineas.slice(0, 4).map(centroDe));
  }

  /* ---------- La mano ---------- */
  const mano = $('mano');
  const ranuras = [];
  for (let s = 0; s < M.MANO; s++) {
    const r = document.createElement('div');
    r.className = 'ranura';
    const svg = document.createElementNS(NS, 'svg');
    r.appendChild(svg);
    mano.appendChild(r);
    r.addEventListener('pointerdown', e => toma(e, s));
    ranuras.push({ r, svg });
  }
  function pintaMano(llega) {
    E.mano.forEach((p, s) => {
      const { r, svg } = ranuras[s];
      r.classList.toggle('elegida', !!kb && kb.s === s);
      if (llega && p) { r.classList.remove('llega'); void r.offsetWidth; r.style.animationDelay = s * 70 + 'ms'; r.classList.add('llega'); }
      r.classList.toggle('vacia', !p);
      r.classList.toggle('no-cabe', !!p && !M.cabe(E, p));
      if (p) dibujaPieza(svg, p, 0.6); else svg.replaceChildren();
      // Todas a la misma escala: el viewBox fija cuántas unidades caben en la ranura.
      if (p) {
        const b = caja(M.celdasDe(p)), lado = 4.2;
        svg.setAttribute('viewBox', [b.x + b.w / 2 - lado / 2, b.y + b.h / 2 - lado / 2, lado, lado].map(n => n.toFixed(4)).join(' '));
      }
    });
  }

  function pintaMarcador() {
    $('nPuntos').textContent = String(E ? E.puntos : 0);
    $('nMejor').textContent = String(Math.max(prog.mejor, E ? E.puntos : 0));
    $('nLineas').textContent = String(E ? E.lineas : 0);
    pintaPoderes();
  }
  function popSuma(n) {
    const p = $('popSuma');
    p.textContent = '+' + n;
    p.classList.remove('sube'); void p.offsetWidth; p.classList.add('sube');
  }
  // El fantasma de una pieza en (dx, dy): con su color si cabe, en rojo si cae sobre fichas.
  function pintaFantasma(p, dx, dy) {
    pintaTablero();
    const libres = M.destino(E, p, dx, dy);
    if (libres) {
      for (const i of libres) { celdas[i].classList.add('fantasma'); celdas[i].style.setProperty('--color', color(p.f + 1)); }
      for (const j of M.lineasQueCierra(E, libres)) for (const i of M.LINEAS[j]) celdas[i].classList.add('cierra');
      return true;
    }
    for (const i of M.cubre(p, dx, dy) || []) celdas[i].classList.add('invalida');
    return false;
  }
  function muestraRacha(lineas, racha) {
    const b = $('racha');
    b.textContent = (lineas > 1 ? lineas + ' LÍNEAS' : '¡LÍNEA!') + (racha > 1 ? ' · BONO ×' + racha : '');
    b.classList.remove('sube'); void b.offsetWidth; b.classList.add('sube');
  }

  /* ---------- Arrastrar ---------- */
  const flota = $('arrastre');
  let arr = null, volviendo = false;
  const tactil = matchMedia('(pointer:coarse)').matches;
  const enMenu = () => !$('menu').hidden || !$('fin').hidden || !$('temas').hidden;

  function toma(e, s) {
    if (!E || terminada || arr || volviendo || enMenu() || e.button > 0) return;
    const p = E.mano[s];
    if (!p) return;
    e.preventDefault();
    if (modo === 'girar') { usaPoder('girar', s, 0, !e.isTrusted ? 'x' : e.pointerType === 'touch' ? 't' : 'r'); return; }
    modoPoder(null);
    suelta_teclado();
    const b = dibujaPieza(flota, p, 0.15);
    const px = tablero.getBoundingClientRect().width / VB.w;
    flota.style.width = (b.w + 0.3) * px + 'px';
    flota.style.height = (b.h + 0.3) * px + 'px';
    flota.style.transition = 'none';
    flota.removeAttribute('hidden');
    arr = { s, p, b, px, id: e.pointerId, dx: 0, dy: 0, valida: false, alzado: tactil || e.pointerType === 'touch' ? 1.6 : 0.4 };
    ranuras[s].r.classList.add('levantada');
    try { ranuras[s].r.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
    sonidos.toma();
    mueve(e);
  }

  function mueve(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const { b, px } = arr;
    const ancho = (b.w + 0.3) * px, alto = (b.h + 0.3) * px;
    const izq = e.clientX - ancho / 2, arriba = e.clientY - alto / 2 - arr.alzado * px;
    flota.style.transform = 'translate(' + izq + 'px,' + arriba + 'px)';
    // Dónde cae, en el plano del tablero, el punto (0,0) de la red de la pieza.
    const rect = tablero.getBoundingClientRect();
    const ox = izq + (0.15 - b.x) * px, oy = arriba + (0.15 - b.y) * px;
    const bx = VB.x + (ox - rect.left) / px, by = VB.y + (oy - rect.top) / px;
    const fy = by / M.H, fx = bx - fy / 2;
    let mejor = null;
    for (let dy = Math.floor(fy) - 1; dy <= Math.ceil(fy) + 1; dy++)
      for (let dx = Math.floor(fx) - 1; dx <= Math.ceil(fx) + 1; dx++) {
        const [cx, cy] = M.plano(dx, dy), dist = Math.hypot(cx - bx, cy - by);
        if (dist > 0.9 || (mejor && dist >= mejor.dist)) continue;
        if (M.destino(E, arr.p, dx, dy)) mejor = { dx, dy, dist };
      }
    arr.valida = !!mejor;
    if (!mejor) { pintaTablero(); return; }
    arr.dx = mejor.dx; arr.dy = mejor.dy;
    pintaFantasma(arr.p, mejor.dx, mejor.dy);
  }

  // La pieza que no se pudo soltar vuela de vuelta a su ranura antes de desaparecer.
  function devuelve(s) {
    const r = ranuras[s].r.getBoundingClientRect();
    const w = parseFloat(flota.style.width), h = parseFloat(flota.style.height);
    volviendo = true;
    flota.style.transition = 'transform .2s ease-in, opacity .2s ease-in';
    flota.style.transform = 'translate(' + (r.left + r.width / 2 - w / 2) + 'px,' + (r.top + r.height / 2 - h / 2) + 'px) scale(.5)';
    setTimeout(() => {
      flota.setAttribute('hidden', ''); flota.replaceChildren(); flota.style.transition = 'none';
      ranuras[s].r.classList.remove('levantada');
      volviendo = false;
    }, 200);
  }

  function suelta(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const { s, valida, dx, dy } = arr;
    arr = null;
    if (!valida) { pintaTablero(); sonidos.vuelve(); devuelve(s); return; }
    ranuras[s].r.classList.remove('levantada');
    flota.setAttribute('hidden', ''); flota.replaceChildren();
    juega(s, dx, dy, !e.isTrusted ? 'x' : e.pointerType === 'touch' ? 't' : 'r');
  }
  addEventListener('pointermove', mueve);
  addEventListener('pointerup', suelta);
  addEventListener('pointercancel', e => { if (arr && e.pointerId === arr.id) { arr.valida = false; suelta(e); } });
  for (const t of ['selectstart', 'contextmenu', 'dragstart']) document.addEventListener(t, e => { if (e.target.closest && e.target.closest('.escenario,.mano')) e.preventDefault(); });
  mano.addEventListener('touchstart', e => e.preventDefault(), { passive: false });

  /* ---------- Poderes ----------
     Lo que se gana al cerrar líneas (motor.js, PODERES) aparece como botón
     sobre el tablero, solo si tienes alguno. Martillo, bomba y girar abren
     un modo (el siguiente toque en el tablero o en la mano los usa);
     cambiar mano y segunda oportunidad se usan al tocarlos. Si no cabe
     nada y algún poder puede destrabar la partida, esos botones laten. */
  /* Los iconos son trazos propios (SVG, currentColor) y no emojis: se ven
     iguales en todo sistema y toman el color de su poder (--pc, temas.css). */
  const ICONOS = {
    martillo: '<path d="M13.2 3.2 20.8 10.8 17.6 14 10 6.4Z" fill="currentColor" fill-opacity=".28"/><path d="M13.2 3.2 20.8 10.8 17.6 14 10 6.4Z"/><path d="m12.6 9.2-8 8a2 2 0 0 0 2.8 2.8l8-8"/>',
    bomba: '<circle cx="10.5" cy="14" r="6.5" fill="currentColor" fill-opacity=".28"/><circle cx="10.5" cy="14" r="6.5"/><path d="m15.2 9.3 2.3-2.3"/><path d="M19.5 2.5v2.2M21.6 5.6h-2.2M21 3.1l-1.4 1.4"/><path d="M7.4 12.2a3.6 3.6 0 0 1 2.4-2" stroke-opacity=".7"/>',
    girar: '<path d="M20 12a8 8 0 1 1-2.35-5.66"/><path d="M20.2 3.8v4.6h-4.6"/><path d="m12 8.4 3.6 6.2H8.4Z" fill="currentColor" fill-opacity=".45"/>',
    cambio: '<path d="M3 7h3.5l10 10H21"/><path d="M3 17h3.5l3-3M14 10l2.5-3H21"/><path d="m18 4 3 3-3 3M18 14l3 3-3 3"/>',
    vida: '<path d="M12 20.5s-7.5-4.6-7.5-10.4A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.5c0 5.8-7.5 10.4-7.5 10.4Z" fill="currentColor" fill-opacity=".28"/><path d="M12 20.5s-7.5-4.6-7.5-10.4A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.5c0 5.8-7.5 10.4-7.5 10.4Z"/><path d="m12.8 9.6-2.4 3.6h3.2l-2.4 3.6"/>'
  };
  const icono = k => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONOS[k] + '</svg>';
  const PODER_UI = {
    martillo: { corto: 'Martillo', nombre: 'Martillo', ayuda: 'toca un triángulo ocupado para romperlo', tecla: 'KeyH', modo: true },
    bomba: { corto: 'Bomba', nombre: 'Bomba', ayuda: 'toca un punto del tablero: rompe los triángulos a su alrededor', tecla: 'KeyB', modo: true },
    girar: { corto: 'Girar', nombre: 'Girar', ayuda: 'toca una pieza de tu mano (o 1, 2, 3) para girarla 60°', tecla: 'KeyG', modo: true },
    cambio: { corto: 'Cambio', nombre: 'Cambiar mano', ayuda: 'descarta tus piezas y recibe tres nuevas', tecla: 'KeyC' },
    vida: { corto: '2ª vida', nombre: 'Segunda oportunidad', ayuda: 'solo cuando no cabe nada: borra la mitad de abajo del tablero', tecla: 'KeyV' }
  };
  let modo = null;
  const botonesPoder = {};
  for (const k of M.ORDEN_PODERES) {
    const u = PODER_UI[k], b = document.createElement('button');
    b.type = 'button'; b.className = 'poder vacio'; b.dataset.poder = k;
    b.title = u.nombre + ': ' + u.ayuda + ' (' + u.tecla.slice(3) + ')';
    b.setAttribute('aria-label', u.nombre + ': ' + u.ayuda);
    if (u.modo) b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="poder-ico">' + icono(k) + '</span><span class="poder-nombre">' + u.corto + '</span>' +
      '<b class="poder-n" translate="no">0</b><kbd class="poder-tecla" aria-hidden="true">' + u.tecla.slice(3) + '</kbd>';
    b.addEventListener('click', e => activa(k, !e.isTrusted ? 'x' : e.pointerType === 'touch' ? 't' : 'r'));
    $('poderes').appendChild(b);
    botonesPoder[k] = b;
  }
  for (const el of document.querySelectorAll('.ico-poder[data-poder]')) el.innerHTML = icono(el.dataset.poder);
  function activa(k, origen) {
    if (!E || terminada || enMenu() || !E.poderes[k]) return;
    if (PODER_UI[k].modo) modoPoder(modo === k ? null : k);
    else usaPoder(k, 0, 0, origen);
  }
  function pintaPoderes() {
    const atascado = !!E && !terminada && !M.puedeJugar(E);
    for (const k of M.ORDEN_PODERES) {
      const n = E ? E.poderes[k] : 0, b = botonesPoder[k];
      // Sin cargas el botón queda invisible pero en su sitio: si se corrieran, un segundo toque caería en otro poder.
      b.classList.toggle('vacio', !n);
      b.querySelector('.poder-n').textContent = String(n);
      b.disabled = !n || terminada || (k === 'vida' && !atascado);
      b.classList.toggle('urge', atascado && n > 0 && !b.disabled);
      if (PODER_UI[k].modo) b.setAttribute('aria-pressed', String(modo === k));
    }
    $('aviso').hidden = !atascado;
    if (modo && !(E && E.poderes[modo])) modoPoder(null);
  }
  function modoPoder(k) {
    modo = k && E && E.poderes[k] > 0 && !terminada ? k : null;
    if (modo) suelta_teclado();
    const esc = $('escenario');
    for (const m of ['martillo', 'bomba']) esc.classList.toggle('modo-' + m, modo === m);
    mano.classList.toggle('modo-girar', modo === 'girar');
    for (const c of celdas) c.classList.remove('mira');
    for (const [j, b] of Object.entries(botonesPoder)) if (PODER_UI[j].modo) b.setAttribute('aria-pressed', String(modo === j));
  }
  function ganaPoderes(lista) {
    if (!lista.length) return;
    sonidos.poder();
    const p = $('popPoder');
    p.innerHTML = '+' + lista.map(k => '<span class="poder-ico" data-poder="' + k + '">' + icono(k) + '</span>').join('');
    p.classList.remove('sube'); void p.offsetWidth; p.classList.add('sube');
  }
  const SONIDO_PODER = { martillo: 'golpe', bomba: 'bomba', vida: 'vida', girar: 'girar', cambio: 'cambio' };
  function usaPoder(k, a, b, origen) {
    arranca();
    const ahora = reloj().a, dt = Math.max(0, Math.round(ahora - ultimaA));
    const r = M.usa(E, M.PODERES[k].codigo, a, b, [origen || 'x', dt]);
    if (!r) { sonidos.vuelve(); return; }
    ultimaA += dt;
    modoPoder(null);
    pintaTablero();
    if (r.borradas && r.borradas.length) estalla(r.borradas, r.valores);
    (sonidos[SONIDO_PODER[k]] || sonidos.pone)();
    pintaMano(!!r.reparte); pintaMarcador();
    if (E.fin) termina(); else guardaPartida();
  }
  // El punto de la red más cercano al puntero, para la bomba.
  function puntoBajo(e) {
    const rect = tablero.getBoundingClientRect(), px = rect.width / VB.w;
    const bx = VB.x + (e.clientX - rect.left) / px, by = VB.y + (e.clientY - rect.top) / px;
    const fy = by / M.H, fx = bx - fy / 2;
    let mejor = null;
    for (let y = Math.floor(fy); y <= Math.ceil(fy); y++)
      for (let x = Math.floor(fx); x <= Math.ceil(fx); x++) {
        const [cx, cy] = M.plano(x, y), d = Math.hypot(cx - bx, cy - by);
        if (!mejor || d < mejor.d) mejor = { x, y, d };
      }
    return mejor;
  }
  tablero.addEventListener('pointermove', e => {
    if (modo !== 'bomba') return;
    const q = puntoBajo(e), zona = new Set(M.alrededor(q.x, q.y));
    celdas.forEach((c, i) => c.classList.toggle('mira', zona.has(i)));
  });
  tablero.addEventListener('pointerleave', () => { for (const c of celdas) c.classList.remove('mira'); });
  tablero.addEventListener('pointerup', e => {
    if (!modo || enMenu() || arr) return;
    const origen = !e.isTrusted ? 'x' : e.pointerType === 'touch' ? 't' : 'r';
    if (modo === 'bomba') { const q = puntoBajo(e); usaPoder('bomba', q.x, q.y, origen); return; }
    if (modo !== 'martillo') return;
    const p = e.target.closest && e.target.closest('polygon.celda');
    if (!p) return;
    const i = +p.getAttribute('data-i');
    if (E.t[i]) usaPoder('martillo', i, 0, origen);
  });

  /* ---------- Teclado ----------
     1, 2 y 3 eligen pieza y la ponen en la posición libre más cerca del
     centro; las flechas la mueven por la red (arriba y abajo alternan el
     paso para no derivar de lado, porque la red está inclinada 60°). */
  let alterna = false;
  function centroMasCercano(p) {
    const [x0, y0, d0] = M.celdasDe(p)[0];
    let mejor = null;
    for (const c of M.CELDAS) {
      if (c.d !== d0) continue;
      const dx = c.x - x0, dy = c.y - y0;
      if (!M.destino(E, p, dx, dy)) continue;
      const [cx, cy] = M.plano(c.x, c.y), dist = Math.hypot(cx, cy);
      if (!mejor || dist < mejor.dist) mejor = { dx, dy, dist };
    }
    return mejor;
  }
  function elige(s) {
    const p = E.mano[s];
    if (!p) return;
    const pos = centroMasCercano(p);
    if (!pos) { sonidos.vuelve(); return; }
    kb = { s, dx: pos.dx, dy: pos.dy };
    sonidos.toma();
    pintaMano(); pintaFantasma(p, kb.dx, kb.dy);
  }
  function suelta_teclado() {
    if (!kb) return;
    kb = null;
    pintaMano(); pintaTablero();
  }
  function mueveTeclado(ddx, ddy) {
    const p = E.mano[kb.s];
    if (!M.cubre(p, kb.dx + ddx, kb.dy + ddy)) return;
    kb.dx += ddx; kb.dy += ddy;
    pintaFantasma(p, kb.dx, kb.dy);
  }
  addEventListener('keydown', e => {
    if (!E || terminada || enMenu() || arr) return;
    const poder = M.ORDEN_PODERES.find(k => PODER_UI[k].tecla === e.code);
    if (poder) { e.preventDefault(); activa(poder, e.isTrusted ? 'k' : 'x'); return; }
    if (e.code === 'Escape' && modo) { e.preventDefault(); modoPoder(null); return; }
    if (modo === 'girar' && (/^Digit[1-3]$/.test(e.code) || /^Numpad[1-3]$/.test(e.code))) { e.preventDefault(); usaPoder('girar', +e.code.slice(-1) - 1, 0, e.isTrusted ? 'k' : 'x'); return; }
    if (/^Digit[1-3]$/.test(e.code) || /^Numpad[1-3]$/.test(e.code)) { e.preventDefault(); elige(+e.code.slice(-1) - 1); return; }
    if (!kb) return;
    const paso = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      ArrowUp: alterna ? [1, -1] : [0, -1], ArrowDown: alterna ? [-1, 1] : [0, 1]
    }[e.code];
    if (paso) {
      e.preventDefault();
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') alterna = !alterna;
      mueveTeclado(paso[0], paso[1]);
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      const { s, dx, dy } = kb;
      if (!M.destino(E, E.mano[s], dx, dy)) { sonidos.vuelve(); return; }
      kb = null;
      juega(s, dx, dy, e.isTrusted ? 'k' : 'x');
    } else if (e.code === 'Escape') { e.preventDefault(); suelta_teclado(); }
  });

  /* ---------- Relojes ----------
     Lo jugado se mide con dos relojes a la vez, el del navegador
     (performance.now) y el del sistema (Date.now), y los dos se paran con
     la pestaña oculta o sin foco. Viajan en la prueba: si alguien acelera
     el juego, se separan y el verificador lo nota. Cada jugada guarda los
     ms ENTEROS desde la anterior (resultadoClub pide enteros). */
  let accA = 0, accW = 0, corre = false, segA = 0, segW = 0, ultimaA = 0;
  function reloj() {
    let a = accA, w = accW;
    if (corre) { a += performance.now() - segA; w += Date.now() - segW; }
    return { a, w };
  }
  function arranca() {
    if (corre || terminada || document.hidden || !E) return;
    corre = true; segA = performance.now(); segW = Date.now();
  }
  function para() {
    if (!corre) return;
    accA += performance.now() - segA; accW += Date.now() - segW; corre = false;
  }
  function reiniciaRelojes(g) {
    corre = false;
    accA = Math.max(0, +(g && g.a) || 0); accW = Math.max(0, +(g && g.w) || 0);
    ultimaA = Math.min(accA, Math.max(0, +(g && g.ua) || 0));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { para(); guardaPartida(); } else arranca(); });
  addEventListener('blur', para);
  addEventListener('focus', arranca);

  /* ---------- Guardado de la partida en curso ----------
     Solo en este navegador, nunca en la nube: la semilla y las jugadas,
     que el motor rehace. Si la última jugada fue hace más de VIGENCIA, se
     descarta y se empieza de cero. */
  function guardaPartida() {
    if (!E || terminada || !E.jugadas) { try { localStorage.removeItem(clave('trigon.partida')); } catch (_) { /* nada */ } return; }
    const r = reloj();
    guarda('trigon.partida', { s: E.semilla, u: E.u, j: E.registro, a: Math.round(r.a), w: Math.round(r.w), ua: Math.round(ultimaA), at: Date.now() });
  }
  function retoma() {
    const g = lee('trigon.partida');
    if (!g || g.u !== CUENTA || !(Date.now() - (+g.at || 0) < VIGENCIA)) return false;
    const r = M.rehace(g.s, g.u, g.j);
    if (r.error || r.E.fin) return false;
    E = r.E; terminada = false;
    reiniciaRelojes(g); arranca();
    pintaTablero(); pintaMano(true); pintaMarcador();
    return true;
  }

  /* ---------- Ciclo de una partida ---------- */
  function juega(s, dx, dy, origen) {
    arranca();
    const antes = E.t.slice(), propio = E.mano[s] ? E.mano[s].f + 1 : 0;
    const libres = E.mano[s] && M.destino(E, E.mano[s], dx, dy);
    // Dónde cae, de -1 (izquierda) a 1: la nota de la pieza suena de ese lado.
    const lado = libres && libres.length ? libres.reduce((t, i) => t + M.plano(M.CELDAS[i].x, M.CELDAS[i].y)[0], 0) / libres.length / M.LADO : 0;
    const cerradas = libres ? M.lineasQueCierra(E, libres) : [];
    const ahora = reloj().a, dt = Math.max(0, Math.round(ahora - ultimaA));
    const r = M.coloca(E, s, dx, dy, [origen || 'x', dt]);
    if (!r) { pintaTablero(); return; }
    ultimaA += dt;
    pintaTablero();
    if (r.borradas.length) {
      estalla(r.borradas, r.borradas.map(i => antes[i] || propio));
      celebra(cerradas);
      sonidos.borra(r.lineas, E.racha);
      muestraRacha(r.lineas, E.racha);
    } else sonidos.pone(propio - 1, lado);
    if (libres) asienta(libres.filter(i => E.t[i]));
    popSuma(r.suma);
    ganaPoderes(r.ganados);
    pintaMano(r.reparte); pintaMarcador();
    if (E.fin) termina(); else guardaPartida();
  }

  /* Manda el puntaje a la clasificación de Juegos con su prueba: la semilla,
     la cuenta, las jugadas tal cual (con origen y ms) y los dos relojes. El
     verificador (solo/verifica/trigon.js) la rehace antes de guardar nada.
     Una partida con jugadas sintéticas se juega, pero no se manda. */
  function reporta(fin) {
    if (!Club || !E || !E.jugadas || E.puntos < 1) return;
    if (E.registro.some(j => j[3] === 'x' || j.length !== 5)) return;
    const ms = E.registro.reduce((t, j) => t + j[4], 0);
    if (ms < 1) return;
    const r = reloj();
    Club.result({ categoria: CAT, puntos: E.puntos, tiempo: ms },
      { v: 1, s: E.semilla, u: E.u, j: E.registro, a: Math.round(r.a), w: Math.round(r.w), fin: !!fin });
  }

  function termina() {
    terminada = true;
    modoPoder(null);
    para();
    reporta(true);
    const nuevo = E.puntos > prog.mejor && E.puntos > 0;
    prog.mejor = Math.max(prog.mejor, E.puntos); prog.partidas++;
    guarda('trigon.datos', prog);
    guardaPartida();
    sonidos.fin();
    $('finPuntos').textContent = String(E.puntos);
    $('finLineas').textContent = String(E.lineas);
    $('finRacha').textContent = E.mejorRacha ? '×' + E.mejorRacha : '—';
    $('finNuevo').hidden = !nuevo;
    $('finFrase').textContent = nuevo ? 'Tu mejor partida hasta ahora.' : 'Ninguna pieza cabe ya en el hexágono. Otra vuelta.';
    setTimeout(() => { $('fin').hidden = false; $('btnOtra').focus(); }, 500);
    pintaMarcador();
  }

  function nuevaPartida() {
    const s = new Uint32Array(1); crypto.getRandomValues(s);
    E = M.nueva(s[0], CUENTA);
    terminada = false; kb = null;
    modoPoder(null);
    reiniciaRelojes(null); arranca();
    $('fin').hidden = true; $('menu').hidden = true;
    pintaTablero(); pintaMano(true); pintaMarcador();
    guardaPartida();
  }

  // Abandonar a mitad: si la partida superaba el récord, el récord queda.
  function abandona() {
    if (!E || terminada) return;
    if (E.puntos > prog.mejor) { prog.mejor = E.puntos; guarda('trigon.datos', prog); }
    reporta(false);
  }

  /* ---------- Menú ---------- */
  function abreMenu() {
    suelta_teclado();
    $('menuMejor').textContent = String(Math.max(prog.mejor, E && !terminada ? E.puntos : 0));
    $('menuPartidas').textContent = prog.partidas === 1 ? '1 partida jugada' : prog.partidas + ' partidas jugadas';
    $('btnSeguirPartida').hidden = !(E && !terminada && E.jugadas > 0);
    $('fin').hidden = true; $('menu').hidden = false;
    $('btnJugar').focus({ preventScroll: true });
  }
  function cierraMenu() { $('menu').hidden = true; }

  $('btnMenu').addEventListener('click', () => $('menu').hidden ? abreMenu() : (E && !terminada ? cierraMenu() : null));
  $('btnJugar').addEventListener('click', () => {
    if (E && !terminada && E.jugadas > 5 && !confirm('¿Empezar una partida nueva? La actual se da por terminada.')) return;
    abandona(); nuevaPartida();
  });
  $('btnSeguirPartida').addEventListener('click', cierraMenu);
  $('btnComo').addEventListener('click', () => {
    const c = $('comoSeJuega'), abre = c.hidden;
    c.hidden = !abre; $('btnComo').setAttribute('aria-expanded', String(abre));
  });
  $('btnNueva').addEventListener('click', () => {
    if (E && !terminada && E.jugadas > 5 && !confirm('¿Empezar una partida nueva? Esta se da por terminada.')) return;
    abandona(); nuevaPartida();
  });
  $('btnOtra').addEventListener('click', nuevaPartida);
  $('btnMenuFin').addEventListener('click', abreMenu);

  /* ---------- Temas ----------
     El tema y el modo viven en <html data-skin data-modo> (el <head> los
     pone antes de pintar) y se recuerdan en este navegador, sin cuenta:
     son un gusto de la pantalla, no de la persona. Cambiarlo no toca la
     partida; el selector solo tapa la mesa mientras está abierto. */
  const TEMAS = [
    { id: 'clasico', nombre: 'Clásico' },
    { id: 'halloween', nombre: 'Halloween' },
    { id: 'gris', nombre: 'Gris' },
    { id: 'forest', nombre: 'Forest' },
    { id: 'espacio', nombre: 'Espacio' }
  ];
  const raiz = document.documentElement;
  function aplicaTema(skin, modo) {
    if (!TEMAS.some(t => t.id === skin)) skin = 'clasico';
    modo = modo === 'claro' ? 'claro' : 'oscuro';
    raiz.dataset.skin = skin; raiz.dataset.modo = modo;
    try { localStorage.setItem('trigon.tema', JSON.stringify({ skin, modo })); } catch (_) { /* nada */ }
    pintaTemas();
  }
  // Cada tarjeta lleva su propio data-skin y data-modo: temas.css la pinta con sus colores.
  function miniatura() {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-1.6 -1.5 3.2 3');
    svg.setAttribute('aria-hidden', 'true');
    const fondo = document.createElementNS(NS, 'rect');
    fondo.setAttribute('x', '-1.6'); fondo.setAttribute('y', '-1.5'); fondo.setAttribute('width', '3.2'); fondo.setAttribute('height', '3');
    fondo.setAttribute('class', 'mini-fondo');
    svg.appendChild(fondo);
    const hex = [[0, 0, 0], [-1, 0, 0], [0, -1, 0], [-1, 0, 1], [0, -1, 1], [-1, -1, 1]];
    hex.forEach(([x, y, d], k) => {
      const p = poligono(svg, x, y, d, 'mini-tri');
      p.style.setProperty('--color', k < 4 ? color(k + 1) : 'var(--celda)');
    });
    return svg;
  }
  const lista = $('temasLista');
  for (const t of TEMAS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tema'; b.dataset.tema = t.id;
    const nombre = document.createElement('span'); nombre.textContent = t.nombre;
    b.append(miniatura(), nombre);
    b.addEventListener('click', () => aplicaTema(t.id, raiz.dataset.modo));
    lista.appendChild(b);
  }
  function pintaTemas() {
    for (const b of lista.children) {
      b.dataset.skin = b.dataset.tema; b.dataset.modo = raiz.dataset.modo;
      b.setAttribute('aria-pressed', String(b.dataset.tema === raiz.dataset.skin));
    }
    for (const b of document.querySelectorAll('[data-modo-boton]')) b.setAttribute('aria-pressed', String(b.dataset.modoBoton === raiz.dataset.modo));
  }
  for (const b of document.querySelectorAll('[data-modo-boton]')) b.addEventListener('click', () => aplicaTema(raiz.dataset.skin, b.dataset.modoBoton));
  let volverAlMenu = false;
  function abreTemas() {
    suelta_teclado();
    pintaTemas();
    volverAlMenu = !$('menu').hidden;
    $('menu').hidden = true;
    $('temas').hidden = false;
    lista.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }
  function cierraTemas() {
    $('temas').hidden = true;
    if (volverAlMenu) abreMenu();
  }
  $('btnTema').addEventListener('click', () => $('temas').hidden ? abreTemas() : cierraTemas());
  $('btnTemasListo').addEventListener('click', cierraTemas);
  addEventListener('keydown', e => { if (e.code === 'Escape' && !$('temas').hidden) { e.preventDefault(); cierraTemas(); } });
  aplicaTema(raiz.dataset.skin, raiz.dataset.modo);

  /* ---------- Clasificación ----------
     La tabla llega de la página de Juegos con el mismo mensaje `ranking`
     que pinta el panel de conexion.js; aquí se escucha también para
     mostrarla en el menú. Fuera de Juegos no hay tabla. */
  const embebido = window.parent !== window;
  function pintaTabla(filas) {
    const ol = $('tabla');
    ol.replaceChildren();
    for (const f of (filas || []).slice(0, 10)) {
      const li = document.createElement('li');
      li.className = f.yo ? 'yo' : '';
      const n = document.createElement('span'); n.textContent = (f.nombre || 'Jugador') + (f.yo ? ' (tú)' : '');
      const p = document.createElement('b'); p.textContent = String(f.puntos); p.setAttribute('translate', 'no');
      li.append(n, p); ol.appendChild(li);
    }
    const top = filas && filas[0];
    $('tablaRecord').textContent = top ? 'Récord: ' + top.puntos + ' de ' + (top.nombre || 'Jugador') : '';
    $('tablaEstado').textContent = filas && filas.length ? '' : 'Todavía nadie tiene puntaje. ¡Sé el primero!';
  }
  $('tablaEstado').textContent = embebido ? 'Cargando clasificación…' : 'Abre Trigon desde Juegos para ver la clasificación de todos.';
  addEventListener('message', e => {
    if (!embebido || e.source !== parent || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.canal !== 'club-parent' || d.categoria !== CAT) return;
    if (d.tipo === 'ranking') pintaTabla(d.filas);
    else if (d.tipo === 'estado') $('tablaEstado').textContent = d.texto;
  });
  if (Club) Club.category(CAT);
  addEventListener('club-rechazo', e => {
    if (e.detail && e.detail.categoria === CAT) $('finFrase').textContent = 'Esta partida no entró en la clasificación: ' + (e.detail.motivo || '');
  });

  /* ---------- Arranque ---------- */
  $('nota').innerHTML = (tactil
    ? 'Arrastra con el dedo cada pieza hasta el hexágono. '
    : 'Arrastra cada pieza hasta el hexágono, o usa <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>, flechas y <kbd>Enter</kbd>. ') +
    'Completa una línea —horizontal o en cualquiera de las dos diagonales— para borrarla.';

  function ajustaPantalla() {
    let w = innerWidth, h = innerHeight;
    try { w = window.top.innerWidth; h = window.top.innerHeight; } catch (_) { /* otra página */ }
    const raiz = document.documentElement;
    raiz.style.setProperty('--alto-pantalla', h + 'px');
    raiz.classList.toggle('apaisado', w > h && h < 560);
  }
  ajustaPantalla();
  addEventListener('resize', ajustaPantalla);
  addEventListener('pagehide', guardaPartida);

  // Para probar desde la consola. Cambiar el estado a mano no sirve para la clasificación: el verificador rehace la partida.
  window.__trigon = { estado: () => E, motor: M, sonidos, repinta: () => { pintaTablero(); pintaMano(); pintaMarcador(); } };
  if (!retoma()) {
    const s = new Uint32Array(1); crypto.getRandomValues(s);
    E = M.nueva(s[0], CUENTA);
    pintaTablero(); pintaMano(); pintaMarcador();
    abreMenu();
  }
})();
