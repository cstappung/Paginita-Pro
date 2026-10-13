/* HaxBall — el marco: la cancha en un canvas, los controles, la práctica
   contra bots y el lado en línea. La física es `motor.js`.

   En línea cada uno mueve su disco y lo publica; la pelota la lleva quien
   dirige (el primer asiento presente, como los enemigos de Boxhead) y la
   publica en su estado como `w`. Los demás simulan la pelota por su cuenta
   (para que pegarle se sienta inmediato) y la acercan a la del director.
   Una patada ajena llega como un contador `kc` que sube: el director la
   aplica si ese disco está al alcance. Al registro va solo el gol, que
   escribe el director (ver `redHaxball`).

   En la práctica caben dos personas en un mismo teclado (`practica.modo`
   «versus» o «juntos»): J1 con WASD y Espacio, J2 con las flechas y Shift
   derecho, Enter o P. Con un solo jugador las flechas también mueven a J1.

   @controles: tactil teclado */
(function () {
  'use strict';
  if (window.__haxball) return;
  const M = window.HaxballMotor, C = M.C;
  const ONLINE = new URLSearchParams(location.search).get('modo') === 'online' && parent !== window;
  const $ = id => document.getElementById(id);
  const lienzo = $('lienzo'), g = lienzo.getContext('2d');
  const COLOR = { rojo: '#e56e56', azul: '#5689e5' };
  const NOMBRE_EQ = { rojo: 'Rojo', azul: 'Azul' };
  let nombresEq = Object.assign({}, NOMBRE_EQ);
  const nombreEq = e => nombresEq[e] || NOMBRE_EQ[e];
  function tomaNombresEq(x) {
    for (const e of ['rojo', 'azul']) {
      const v = x && typeof x[e] === 'string' ? x[e].replace(/\s+/g, ' ').trim().slice(0, 16) : '';
      nombresEq[e] = v || NOMBRE_EQ[e];
    }
  }
  const otro = e => e === 'rojo' ? 'azul' : 'rojo';
  const TICK = 1 / 60, CELEBRA_S = 2.5, REINTENTO_GOL = 3;

  // ---------- estado ----------
  let m = M.crea();
  let YO = 'yo', YO2 = '', jugando = false, pausado = false, terminado = false;
  let celebra = null, resetN = 0, tickN = 0;
  let nombres = {};
  // práctica
  let practica = { n: 1, nivel: 1, meta: 5, modo: 'bots', cancha: 'clasica', tiempo: 0, sprint: true }, bots = [], golesLoc = { rojo: 0, azul: 0 };
  // en línea
  let cfg = null, marcador = null, V = {}, soyDir = false, dirUid = null, ultimoW = null;
  // El reloj cuenta ticks con la pelota en juego (no en el saque ni celebrando).
  let relojT = 0, oro = false, oroVisto = false, tiempoPend = null, relojTxt = '';
  let kc = 0, kcVisto = {}, tgt = {}, bolaTgt = null, rVisto = 0, golPend = null, golEnviado = 0;

  function enviar(tipo, d) { if (ONLINE) parent.postMessage(Object.assign({ canal: 'haxball-hijo', tipo }, d || {}), location.origin); }

  // ---------- sonido ----------
  let A = null;
  function audio() {
    if (!A) { try { A = new (window.AudioContext || window.webkitAudioContext)(); } catch { A = null; } }
    if (A && A.state === 'suspended') A.resume();
    return A;
  }
  function tono(f, dur, tipo, vol, f2) {
    const a = A; if (!a) return;
    const t = a.currentTime, o = a.createOscillator(), v = a.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    v.gain.setValueAtTime(vol || 0.2, t); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(v).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function ruido(dur, vol, filtro) {
    const a = A; if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = filtro || 800; v.gain.value = vol || 0.2;
    s.connect(f).connect(v).connect(a.destination); s.start();
  }
  function son(k, suave) {
    if (!A) return;
    const s = suave ? 0.5 : 1;
    if (k === 'patada') { tono(180, 0.09, 'sine', 0.35 * s, 60); ruido(0.04, 0.15 * s, 2500); }
    else if (k === 'rebote') tono(520, 0.05, 'triangle', 0.08);
    else if (k === 'silbato') { tono(2300, 0.18, 'sine', 0.12); setTimeout(() => tono(2300, 0.32, 'sine', 0.12), 220); }
    else if (k === 'gol') { ruido(1.6, 0.25, 600); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tono(f, 0.35, 'square', 0.06), i * 110)); }
    else if (k === 'fin') { tono(2300, 0.25, 'sine', 0.12); setTimeout(() => tono(2300, 0.25, 'sine', 0.12), 300); setTimeout(() => tono(2300, 0.7, 'sine', 0.12), 600); }
  }

  // ---------- entrada ----------
  /* Las teclas de J1 y J2 se pueden cambiar (⌨ en el menú) y se guardan en
     el navegador. Jugando solo, o en línea, se juntan las dos: WASD o
     flechas, cualquier Shift para el sprint. */
  const ACCIONES = [['arriba', 'Arriba'], ['abajo', 'Abajo'], ['izq', 'Izquierda'], ['der', 'Derecha'], ['patea', 'Patear'], ['sprint', 'Sprint']];
  const TECLAS_POR = {
    j1: { arriba: ['KeyW'], abajo: ['KeyS'], izq: ['KeyA'], der: ['KeyD'], patea: ['Space', 'KeyX'], sprint: ['ShiftLeft'] },
    j2: { arriba: ['ArrowUp'], abajo: ['ArrowDown'], izq: ['ArrowLeft'], der: ['ArrowRight'], patea: ['Enter', 'KeyP', 'NumpadEnter'], sprint: ['ShiftRight'] },
  };
  const K_TECLAS = 'haxball.teclas', K_FICHAS = 'haxball.fichas';
  const lee = (k, por) => { try { return JSON.parse(localStorage.getItem(k)) || por; } catch { return por; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
  const copiaTeclas = t => JSON.parse(JSON.stringify(t));
  function teclasSanas(t) {
    const r = copiaTeclas(TECLAS_POR);
    for (const j of ['j1', 'j2']) for (const [a] of ACCIONES) {
      const v = t && t[j] && t[j][a];
      if (Array.isArray(v) && v.length && v.every(c => typeof c === 'string' && c.length < 32)) r[j][a] = v.slice(0, 4);
    }
    return r;
  }
  let TECLAS = teclasSanas(lee(K_TECLAS, null));
  const juntas = () => Object.fromEntries(ACCIONES.map(([a]) => [a, [...new Set([...TECLAS.j1[a], ...TECLAS.j2[a]])]]));
  const usada = code => ACCIONES.some(([a]) => TECLAS.j1[a].includes(code) || TECLAS.j2[a].includes(code));

  const teclas = new Set();
  let toque = null, pateaToque = false, sprintToque = false, capturando = null;
  const escribiendo = e => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  addEventListener('keydown', e => {
    audio();
    if (capturando) { e.preventDefault(); e.stopImmediatePropagation(); capturando(e.code); return; }
    if (escribiendo(e)) return;
    if (e.code === 'Escape' || (e.code === 'KeyP' && !usada('KeyP'))) {
      if (!$('teclasCapa').hidden) { cierraTeclas(); return; }
      if (jugando && !ONLINE && !terminado) pausa(!pausado);
      return;
    }
    teclas.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (jugando && (e.code === 'Enter' || e.code === 'NumpadEnter')) e.preventDefault();
  }, true);
  addEventListener('keyup', e => teclas.delete(e.code));
  addEventListener('blur', () => { teclas.clear(); toque = null; pateaToque = false; sprintToque = false; });
  lienzo.addEventListener('pointerdown', e => {
    audio();
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    lienzo.setPointerCapture?.(e.pointerId);
    if (e.clientX < innerWidth * 0.6 && !toque) toque = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
  });
  lienzo.addEventListener('pointermove', e => { if (toque && e.pointerId === toque.id) { toque.x = e.clientX; toque.y = e.clientY; } });
  const suelta = e => {
    if (toque && e.pointerId === toque.id) toque = null;
  };
  /* En el celular: joystick a la izquierda (donde apoyes el dedo) y dos
     botones a la derecha, encima de la cancha: patear, grande, y sprint. */
  const TACTIL = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  function botonTactil(id, alBajar) {
    const b = $(id);
    const suelta = e => { if (b.dataset.p === String(e.pointerId)) { delete b.dataset.p; b.classList.remove('activo'); alBajar(false); } };
    b.addEventListener('pointerdown', e => {
      audio(); e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch { /* puntero ya suelto */ }
      b.dataset.p = e.pointerId; b.classList.add('activo'); alBajar(true);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, suelta);
  }
  botonTactil('tPatea', v => { pateaToque = v; });
  botonTactil('tSprint', v => { sprintToque = v; });
  lienzo.addEventListener('pointerup', suelta);
  lienzo.addEventListener('pointercancel', suelta);

  const alguna = codigos => codigos.some(c => teclas.has(c));
  const haySprint = () => ONLINE ? !cfg || cfg.sprint !== false : practica.sprint;
  const capaAbierta = () => !$('menu').hidden || !$('teclasCapa').hidden || !$('novedades').hidden;

  // Sin `mapa` es J1: con J2 en la cancha usa solo las suyas, si no las de los dos.
  function entrada(mapa) {
    if (terminado || pausado || capaAbierta()) return { x: 0, y: 0, k: false, s: false };
    const t = mapa || (YO2 ? TECLAS.j1 : juntas());
    let x = 0, y = 0;
    if (alguna(t.izq)) x -= 1;
    if (alguna(t.der)) x += 1;
    if (alguna(t.arriba)) y -= 1;
    if (alguna(t.abajo)) y += 1;
    if (!mapa && toque) {
      const dx = toque.x - toque.x0, dy = toque.y - toque.y0, l = Math.hypot(dx, dy);
      if (l > 6) { const f = Math.min(1, l / 45); x = dx / l * f; y = dy / l * f; }
    }
    const k = alguna(t.patea) || (!mapa && pateaToque !== false);
    return { x, y, k, s: haySprint() && (alguna(t.sprint) || (!mapa && sprintToque)) };
  }

  // ---------- nombre y dorsal ----------
  /* El dorsal es lo que va dentro del disco: un número, un emoji o letras,
     hasta dos caracteres que se ven (un emoji compuesto cuenta como uno). */
  const MAX_NOMBRE = 14;
  function grafemas(txt) {
    try { return [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(txt)].map(x => x.segment); }
    catch { return Array.from(txt); }
  }
  const dorsalSano = v => grafemas(String(v || '').replace(/\s+/g, '')).slice(0, 2).join('');
  const nombreSano = v => String(v || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE);
  let FICHAS = lee(K_FICHAS, {});
  const ficha = j => ({ nombre: nombreSano(FICHAS[j] && FICHAS[j].nombre), dorsal: dorsalSano(FICHAS[j] && FICHAS[j].dorsal) });
  let dorsales = {};

  // ---------- mundo ----------
  const miJ = () => m.J.get(YO);
  function arma(lista) {
    m = M.crea();
    for (const [u, e] of lista) M.agrega(m, u, e);
    M.alinea(m, 'rojo');
    celebra = null; resetN = 0; tickN = 0; terminado = false;
    relojT = 0; oro = false; oroVisto = false; tiempoPend = null;
  }

  /* Arma la cancha de la práctica según `practica.modo`:
     - «bots»: J1 en rojo con `n - 1` bots, contra `n` bots azules.
     - «versus»: J1 en rojo y J2 en azul, cada uno con `n - 1` bots.
     - «juntos»: J1 y J2 en rojo (con `n - 2` bots) contra `n` bots azules. */
  function practicaNueva() {
    const modo = practica.modo;
    const n = modo === 'juntos' ? Math.max(2, practica.n) : practica.n;
    YO = 'yo';
    YO2 = modo === 'bots' ? '' : 'yo2';
    leeFichas();
    const f1 = ficha('j1'), f2 = ficha('j2');
    nombres = YO2 ? { yo: f1.nombre || 'J1', yo2: f2.nombre || 'J2' } : { yo: f1.nombre || 'Tú' };
    dorsales = YO2 ? { yo: f1.dorsal, yo2: f2.dorsal } : { yo: f1.dorsal };
    const lista = [['yo', 'rojo']];
    if (YO2) lista.push([YO2, modo === 'versus' ? 'azul' : 'rojo']);
    bots = [];
    const papelR = ['def', 'del'], papelA = ['del', 'def', 'del'];
    const botsRojos = modo === 'juntos' ? n - 2 : n - 1, botsAzules = modo === 'versus' ? n - 1 : n;
    for (let i = 0; i < botsRojos; i++) { const u = 'r' + i; lista.push([u, 'rojo']); nombres[u] = 'Bot ' + (i + 1); bots.push({ u, papel: papelR[i % 2] }); }
    for (let i = 0; i < botsAzules; i++) { const u = 'a' + i; lista.push([u, 'azul']); nombres[u] = 'Rival ' + (i + 1); bots.push({ u, papel: papelA[i % 3] }); }
    golesLoc = { rojo: 0, azul: 0 };
    M.usaCancha(practica.cancha);
    arma(lista);
    jugando = true; pausado = false;
    $('menu').hidden = true; $('fin').hidden = true; $('pausa').hidden = true;
    pintaAyuda();
    son('silbato');
    pintaMarca();
  }

  const NOMBRE_TECLA = {
    Space: 'Espacio', Enter: 'Enter', NumpadEnter: 'Enter num.', ShiftLeft: 'Shift izq.', ShiftRight: 'Shift der.',
    ControlLeft: 'Ctrl izq.', ControlRight: 'Ctrl der.', AltLeft: 'Alt izq.', AltRight: 'Alt der.', MetaLeft: 'Cmd izq.', MetaRight: 'Cmd der.',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Tab: 'Tab', Backspace: 'Borrar', CapsLock: 'Bloq Mayús',
    Comma: ',', Period: '.', Slash: '-', Semicolon: 'Ñ', Quote: '´', BracketLeft: '`', BracketRight: '+', Minus: "'", Equal: '¡', Backslash: 'Ç',
  };
  const nombreTecla = c => NOMBRE_TECLA[c] || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
  const kbd = codigos => codigos.map(c => '<kbd>' + nombreTecla(c) + '</kbd>').join('/');
  function movTxt(t) {
    const es = (a, b) => a.every((c, i) => t[c][0] === b[i]);
    if (es(['arriba', 'izq', 'abajo', 'der'], ['KeyW', 'KeyA', 'KeyS', 'KeyD'])) return '<kbd>WASD</kbd>';
    if (es(['arriba', 'izq', 'abajo', 'der'], ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'])) return '<kbd>flechas</kbd>';
    return ['arriba', 'izq', 'abajo', 'der'].map(a => '<kbd>' + nombreTecla(t[a][0]) + '</kbd>').join('');
  }
  const jugadorTxt = t => movTxt(t) + ' + ' + kbd(t.patea.slice(0, 2)) + ' patea' + (haySprint() ? ' + ' + kbd(t.sprint.slice(0, 1)) + ' sprint' : '');
  function pintaAyuda() {
    $('ayuda').innerHTML = YO2
      ? '<b>J1</b> ' + jugadorTxt(TECLAS.j1) + ' · <b>J2</b> ' + jugadorTxt(TECLAS.j2) + ' · <kbd>Esc</kbd> pausa'
      : movTxt(TECLAS.j1) + '/' + movTxt(TECLAS.j2) + ' moverte · ' + kbd(TECLAS.j1.patea.slice(0, 1)) + ' patear · ' +
        (haySprint() ? kbd([TECLAS.j1.sprint[0], TECLAS.j2.sprint[0]]) + ' sprint · ' : '') + '<kbd>Esc</kbd> pausa';
    $('menuAyudaTeclas').innerHTML = '<b>J1</b> ' + jugadorTxt(TECLAS.j1) + '.' +
      (ONLINE ? ' En línea también sirven las de J2.' : '<br><b>J2</b> ' + jugadorTxt(TECLAS.j2) + '.');
  }

  function goles() { return ONLINE ? (marcador ? marcador.goles : { rojo: 0, azul: 0 }) : golesLoc; }
  function meta() { return ONLINE ? (cfg && cfg.meta) || 5 : practica.meta; }
  function limite() { return (ONLINE ? (cfg && cfg.tiempo) || 0 : practica.tiempo) * 3600; }
  function pintaReloj() {
    const lim = limite();
    let txt;
    if (oro) txt = 'GOL DE ORO';
    else {
      const s = Math.ceil((lim ? Math.max(0, lim - relojT) : relojT) / 60);
      txt = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }
    if (txt === relojTxt) return;
    relojTxt = txt;
    $('reloj').textContent = txt;
    $('reloj').classList.toggle('oro', oro);
  }
  function empiezaOro() {
    oro = true;
    if (oroVisto) return;
    oroVisto = true;
    banner('¡GOL DE ORO!', '#f2c14e');
    son('silbato');
  }
  // Se acabó el reloj: en la práctica se decide aquí; en línea lo decide el registro.
  function finDelTiempo() {
    const gl = goles();
    if (!ONLINE) {
      if (gl.rojo === gl.azul) empiezaOro();
      else terminaPractica(gl.rojo > gl.azul ? 'rojo' : 'azul');
      return;
    }
    if (!tiempoPend) { tiempoPend = { n: gl.rojo + gl.azul, t: 0 }; }
  }
  function mandaTiempo() {
    if (!tiempoPend || tiempoPend.t > 0) return;
    tiempoPend.t = REINTENTO_GOL;
    enviar('tiempo', { n: tiempoPend.n });
  }

  function pintaMarca() {
    const gl = goles();
    $('nR').textContent = nombreEq('rojo'); $('nA').textContent = nombreEq('azul');
    $('gR').textContent = gl.rojo | 0; $('gA').textContent = gl.azul | 0;
    $('meta').textContent = 'a ' + meta();
  }

  let bannerT = null;
  function banner(txt, color) {
    const b = $('banner');
    b.textContent = txt; b.style.color = color || '';
    b.classList.add('ver');
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('ver'), 2200);
  }

  // Un gol visto por quien lleva la pelota.
  function golDetectado(gl) {
    celebra = { e: gl.e, t: CELEBRA_S, por: gl.por || '' };
    if (ONLINE) {
      const total = (marcador ? marcador.goles.rojo + marcador.goles.azul : 0);
      golPend = { e: gl.e, n: Math.max(total, golEnviado) + 1, por: gl.por || '', t: 0 };
      mandaGol();
    } else {
      golesLoc[gl.e]++;
      anunciaGol(gl.e, gl.por);
      pintaMarca();
      if (oro || golesLoc[gl.e] >= practica.meta) terminaPractica(gl.e);
    }
  }
  function mandaGol() {
    if (!golPend) return;
    golEnviado = Math.max(golEnviado, golPend.n);
    golPend.t = REINTENTO_GOL;
    enviar('gol', { e: golPend.e, n: golPend.n, por: golPend.por });
  }
  function anunciaGol(e, por) {
    const quien = por && nombres[por] ? ' · ' + nombres[por] : '';
    banner('¡GOL de ' + nombreEq(e) + '!' + quien, COLOR[e]);
    son('gol');
  }
  function reanuda() {
    const e = celebra.e;
    celebra = null;
    if (terminado) return;
    M.alinea(m, otro(e));
    resetN++;
    son('silbato');
  }

  function terminaPractica(e) {
    terminado = true;
    setTimeout(() => {
      son('fin');
      $('finTxt').textContent = textoFinPractica(e);
      $('otra').hidden = false;
      $('fin').hidden = false;
    }, 1200);
  }

  function textoFinPractica(e) {
    const r = golesLoc.rojo, a = golesLoc.azul;
    if (practica.modo === 'versus') return '¡Ganó ' + (e === 'rojo' ? nombres.yo + ' (Rojo)' : nombres.yo2 + ' (Azul)') + '! ' + r + ' – ' + a;
    if (practica.modo === 'juntos') return e === 'rojo' ? '¡Ganaron ' + r + ' a ' + a + '!' : 'Perdieron ' + r + ' a ' + a + '.';
    return e === 'rojo' ? '¡Ganaste ' + r + ' a ' + a + '!' : 'Perdiste ' + r + ' a ' + a + '.';
  }

  function pausa(on) {
    pausado = on;
    $('pausa').hidden = !on;
    teclas.clear();
  }

  // ---------- en línea ----------
  function config(c) {
    if (cfg) return;
    cfg = {
      yo: String(c.yo || ''), ronda: c.ronda | 0, mirando: !!c.mirando, sprint: c.sprint !== false, meta: [3, 5, 7].includes(c.meta | 0) ? c.meta | 0 : 5,
      equipos: c.equipos && typeof c.equipos === 'object' ? c.equipos : {},
      jugadores: (c.jugadores || []).map((j, i) => ({ uid: String(j.uid), nombre: String(j.nombre || 'Jugador'), orden: Number.isInteger(j.orden) ? j.orden : i })),
    };
    YO = cfg.mirando ? '' : cfg.yo;
    YO2 = '';
    M.usaCancha(c.cancha);
    tomaNombresEq(c.nombresEq);
    nombres = {}; dorsales = {};
    const lista = [];
    cfg.jugadores.sort((a, b) => a.orden - b.orden).forEach((j, i) => {
      nombres[j.uid] = nombreSano(j.nombre) || 'Jugador';
      const e = cfg.equipos[j.uid] === 'azul' || cfg.equipos[j.uid] === 'rojo' ? cfg.equipos[j.uid] : (i % 2 ? 'azul' : 'rojo');
      lista.push([j.uid, e]);
    });
    arma(lista);
    aplicaMiFicha();
    if (marcador) aplicaFuera();
    jugando = true;
    $('menu').hidden = true;
    $('jugar').textContent = 'Listo';
    $('jugar').hidden = false;
    $('cuenta').textContent = '';
    $('btnFicha').hidden = false;
    eligeDirector();
    son('silbato');
    pintaMarca();
  }

  function eligeDirector() {
    if (!ONLINE) { soyDir = true; dirUid = YO; return; }
    if (!cfg) return;
    const f = new Set(marcador ? marcador.fuera : []), p = [];
    for (const j of [...cfg.jugadores].sort((a, b) => a.orden - b.orden)) {
      if (f.has(j.uid)) continue;
      if (j.uid === cfg.yo) { if (!cfg.mirando) p.push({ uid: j.uid, h: document.hidden }); }
      else if (V[j.uid]) p.push({ uid: j.uid, h: !!V[j.uid].h });
    }
    const a = p.find(x => !x.h) || p[0];
    const nuevo = a ? a.uid : null;
    const era = soyDir;
    dirUid = nuevo; soyDir = !!nuevo && nuevo === cfg.yo;
    if (soyDir && !era && ultimoW) adopta(ultimoW);
  }

  // Quien pasa a dirigir sigue desde lo último que publicó el anterior.
  function adopta(w) {
    leeBola(w, true);
    m.saque = w.s || null; resetN = w.r | 0; m.ult = typeof w.u === 'string' ? w.u : '';
    relojT = Math.max(relojT, w.t | 0);
    m.gol = null; celebra = null;
    if (w.c === 'rojo' || w.c === 'azul') {
      m.gol = { e: w.c, por: w.p || '' };
      celebra = { e: w.c, t: CELEBRA_S, por: w.p || '' };
      const total = marcador ? marcador.goles.rojo + marcador.goles.azul : 0;
      if ((w.g | 0) > total) { golPend = { e: w.c, n: w.g | 0, por: w.p || '', t: 0 }; mandaGol(); }
    }
  }

  const num = (x, d) => Number.isFinite(+x) ? +x : (d || 0);
  function leeBola(w, duro) {
    if (!Array.isArray(w.b)) return;
    const [x, y, vx, vy] = w.b.map(v => num(v));
    bolaTgt = { x, y, vx, vy };
    if (duro) { m.b.x = x; m.b.y = y; m.b.vx = vx; m.b.vy = vy; }
  }

  function llegaVivo(v) {
    V = v && typeof v === 'object' ? v : {};
    if (!cfg) return;
    for (const u of Object.keys(V)) {
      const s = V[u];
      if (!s || typeof s !== 'object' || u === YO) continue;
      const j = m.J.get(u);
      if (j) {
        const t = tgt[u] || (tgt[u] = { x: j.d.x, y: j.d.y, vx: 0, vy: 0, n: 0 });
        t.x = num(s.x, j.d.x); t.y = num(s.y, j.d.y); t.vx = num(s.vx); t.vy = num(s.vy); t.n = 0;
        if (Math.hypot(t.x - j.d.x, t.y - j.d.y) > 60) { j.d.x = t.x; j.d.y = t.y; }
        j.k = !!s.k;
        j.en = Math.min(1, Math.max(0, num(s.en, 1))); j.espera = s.es ? 1 : 0;
        if (typeof s.n === 'string' && nombreSano(s.n)) nombres[u] = nombreSano(s.n);
        if (typeof s.dn === 'string') dorsales[u] = dorsalSano(s.dn);
        const k = s.kc | 0;
        if (kcVisto[u] === undefined) kcVisto[u] = k;
        else if (k > kcVisto[u]) {
          kcVisto[u] = k;
          const cerca = M.alcance(j.d, m.b, 14);
          if (soyDir && cerca && !celebra) {
            const dx = m.b.x - j.d.x, dy = m.b.y - j.d.y, dd = Math.hypot(dx, dy) || 1;
            m.b.vx += dx / dd * C.PATADA * m.b.im; m.b.vy += dy / dd * C.PATADA * m.b.im;
            m.ult = u;
            if (m.saque) m.saque = null;
          }
          if (cerca) son('patada', true);
        }
      }
    }
    eligeDirector();
    const w = dirUid && dirUid !== YO && V[dirUid] && V[dirUid].w;
    if (w && typeof w === 'object' && (w.pt | 0) === cfg.ronda) {
      ultimoW = w;
      if (!soyDir) {
        if ((w.r | 0) !== rVisto) {
          rVisto = w.r | 0; resetN = rVisto;
          M.alinea(m, w.s || null);
          son('silbato');
        }
        if (!w.s) m.saque = null;
        relojT = w.t | 0;
        leeBola(w, false);
      }
    }
  }

  function aplicaFuera() {
    for (const u of marcador.fuera) if (m.J.has(u) && u !== YO) m.J.delete(u);
  }

  function llegaMarcador(x) {
    const antes = marcador;
    marcador = {
      goles: { rojo: (x.goles && x.goles.rojo) | 0, azul: (x.goles && x.goles.azul) | 0 },
      puntos: x.puntos || {}, nombresEq: x.nombresEq, oro: !!x.oro, lider: !!x.lider, fuera: Array.isArray(x.fuera) ? x.fuera : [], meta: x.meta | 0, fin: x.fin || null,
    };
    tomaNombresEq(marcador.nombresEq);
    if (!cfg) return;
    if (marcador.oro) { tiempoPend = null; empiezaOro(); }
    $('aVestibulo').hidden = !marcador.lider || !!marcador.fin;
    aplicaFuera();
    const total = marcador.goles.rojo + marcador.goles.azul;
    if (golPend && total >= golPend.n) golPend = null;
    if (antes) {
      for (const e of M.EQUIPOS) if (marcador.goles[e] > antes.goles[e]) {
        let por = '';
        for (const u of Object.keys(marcador.puntos)) if ((marcador.puntos[u] | 0) > ((antes.puntos || {})[u] | 0)) por = u;
        anunciaGol(e, por);
      }
    }
    pintaMarca();
    if (marcador.fin && !terminado) {
      terminado = true;
      const gan = String(marcador.fin.ganador || ''), e = gan.startsWith('eq:') ? gan.slice(3) : '';
      const mio = cfg.equipos[cfg.yo];
      const txt = !e ? 'Partido sin ganador.' : (!cfg.mirando && mio === e ? '¡Ganó tu equipo!' : 'Ganó ' + nombreEq(e) + '.');
      setTimeout(() => {
        son('fin');
        $('finTxt').textContent = txt + ' ' + marcador.goles.rojo + ' – ' + marcador.goles.azul;
        $('otra').hidden = true;
        $('fin').hidden = false;
      }, 1200);
    }
  }

  function publica() {
    const j = miJ();
    const e = { h: document.hidden };
    if (j) {
      e.x = +j.d.x.toFixed(2); e.y = +j.d.y.toFixed(2); e.vx = +j.d.vx.toFixed(3); e.vy = +j.d.vy.toFixed(3); e.k = j.k ? 1 : 0; e.kc = kc;
      e.en = +j.en.toFixed(2); e.es = j.espera > 0 ? 1 : 0; e.n = nombres[YO] || ''; e.dn = dorsales[YO] || '';
    }
    if (soyDir) {
      const b = m.b;
      e.w = {
        b: [+b.x.toFixed(2), +b.y.toFixed(2), +b.vx.toFixed(3), +b.vy.toFixed(3)],
        s: m.saque || '', r: resetN, u: m.ult || '', c: celebra ? celebra.e : '',
        g: golPend ? golPend.n : golEnviado, p: celebra ? celebra.por : '', t: relojT, pt: cfg ? cfg.ronda : 0,
      };
    }
    enviar('estado', { e });
  }

  addEventListener('message', e => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.canal !== 'haxball-padre') return;
    if (d.tipo === 'config') config(d);
    else if (d.tipo === 'vivo') llegaVivo(d.v || {});
    else if (d.tipo === 'marcador') llegaMarcador(d);
  });

  // ---------- el tick ----------
  let pateaba = false;
  function paso() {
    if (!jugando || pausado) return;
    const entradas = {}, fijos = {};
    const yo = miJ();
    if (yo) {
      const en = entrada();
      entradas[YO] = en;
      if (en.k && !pateaba) kc++;
      pateaba = en.k;
    }
    if (YO2 && m.J.has(YO2)) entradas[YO2] = entrada(TECLAS.j2);
    if (ONLINE) {
      for (const [u, j] of m.J) {
        if (u === YO) continue;
        fijos[u] = true;
        const t = tgt[u];
        if (t) {
          if (t.n < 30) { t.x += t.vx; t.y += t.vy; t.n++; }
          j.d.vx = t.vx + (t.x - j.d.x) * 0.25; j.d.vy = t.vy + (t.y - j.d.y) * 0.25;
        } else { j.d.vx = j.d.vy = 0; }
      }
    } else {
      for (const b of bots) entradas[b.u] = celebra || terminado ? { x: 0, y: 0, k: false } : M.bot(m, b.u, b.papel, practica.nivel);
    }
    const ev = M.paso(m, entradas, fijos);
    if (ev.patadas.length) son('patada', !ev.patadas.includes(YO) && !(YO2 && ev.patadas.includes(YO2)));
    if (ev.rebote) son('rebote');
    if (ONLINE && !soyDir && bolaTgt) {
      bolaTgt.vx *= C.AMORT_B; bolaTgt.vy *= C.AMORT_B;
      bolaTgt.x += bolaTgt.vx; bolaTgt.y += bolaTgt.vy;
      const b = m.b, dx = bolaTgt.x - b.x, dy = bolaTgt.y - b.y;
      if (Math.hypot(dx, dy) > 40) { b.x = bolaTgt.x; b.y = bolaTgt.y; b.vx = bolaTgt.vx; b.vy = bolaTgt.vy; }
      else if (!ev.toque) { b.x += dx * 0.3; b.y += dy * 0.3; b.vx += (bolaTgt.vx - b.vx) * 0.3; b.vy += (bolaTgt.vy - b.vy) * 0.3; }
    }
    if (ev.gol && (soyDir || !ONLINE) && !celebra && !terminado) golDetectado(ev.gol);
    if (celebra && (soyDir || !ONLINE)) { celebra.t -= TICK; if (celebra.t <= 0) reanuda(); }
    if (golPend) { golPend.t -= TICK; if (golPend.t <= 0) mandaGol(); }
    const llevo = soyDir || !ONLINE;
    if (llevo && !celebra && !terminado && !m.saque && !oro) {
      relojT++;
      const lim = limite();
      if (lim && relojT >= lim) { relojT = lim; finDelTiempo(); }
    }
    if (tiempoPend) { tiempoPend.t -= TICK; mandaTiempo(); }
    if (marcador && marcador.fin) tiempoPend = null;
    pintaReloj();
    tickN++;
    if (ONLINE && tickN % 3 === 0) publica();
  }

  // ---------- dibujo ----------
  /* La escala sale siempre de la cancha clásica, así los discos se ven del
     mismo tamaño en todas. Si la cancha no cabe (la grande), la cámara
     sigue a tu disco (o a la pelota si miras o son dos en el teclado) con
     una zona muerta al centro, y se detiene en los bordes. */
  const ARRIBA = 54, ZONA_MUERTA = 0.22;
  let escala = 1, ox = 0, oy = 0, cam = { x: 0, y: 0 };
  function ajusta() {
    const r = devicePixelRatio || 1, K = M.CANCHAS.clasica;
    lienzo.width = Math.round(innerWidth * r); lienzo.height = Math.round(innerHeight * r);
    escala = Math.min(innerWidth / (2 * K.LIM_X + 20), (innerHeight - ARRIBA) / (2 * K.LIM_Y + 20)) * r;
  }
  function camara() {
    const r = devicePixelRatio || 1;
    const vw = lienzo.width / 2 / escala, vh = (lienzo.height - ARRIBA * r) / 2 / escala;
    const yo = !YO2 && m.J.get(YO), foco = yo ? yo.d : m.b;
    const eje = (c, f, v, lim) => {
      if (lim + 10 <= v) return 0;
      const dz = v * ZONA_MUERTA;
      let t = c;
      if (f - c > dz) t = f - dz; else if (c - f > dz) t = f + dz;
      t = clamp(t, -(lim + 10) + v, lim + 10 - v);
      return c + (t - c) * 0.18;
    };
    cam.x = eje(cam.x, foco.x, vw, C.LIM_X);
    cam.y = eje(cam.y, foco.y, vh, C.LIM_Y);
    ox = lienzo.width / 2 - cam.x * escala;
    oy = (lienzo.height + ARRIBA * r) / 2 - cam.y * escala;
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  addEventListener('resize', ajusta);
  ajusta();

  const PISO = {
    clasica: { fuera: '#5f7a4b', borde: '#718c5a', franjas: ['#76a558', '#6c9a4f'] },
    futsal: { fuera: '#6f7079', borde: '#8e8f99', franjas: ['#b6b6c2', '#adadb9'] },
    grande: { fuera: '#6f7079', borde: '#8e8f99', franjas: ['#b6b6c2', '#adadb9'] },
  };
  function circulo(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }
  const esHumano = u => ONLINE ? !!nombres[u] : (u === YO || u === YO2);
  function barraEnergia(j, x, y) {
    const w = 26, h = 4;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    g.fillStyle = j.espera > 0 ? '#e5564f' : j.sp ? '#ffe27a' : j.en >= 1 ? '#7fe08a' : '#f2c14e';
    g.fillRect(x - w / 2, y, w * j.en, h);
  }
  function dibuja() {
    const W = lienzo.width, H = lienzo.height;
    camara();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const piso = PISO[m.cancha] || PISO.clasica;
    g.fillStyle = piso.fuera; g.fillRect(0, 0, W, H);
    g.setTransform(escala, 0, 0, escala, ox, oy);
    g.fillStyle = piso.borde; g.fillRect(-C.LIM_X, -C.LIM_Y, 2 * C.LIM_X, 2 * C.LIM_Y);
    for (let x = -C.W, i = 0; x < C.W; x += 74, i++) {
      g.fillStyle = piso.franjas[i % 2];
      g.fillRect(x, -C.H, Math.min(74, C.W - x), 2 * C.H);
    }
    // líneas
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
    g.strokeRect(-C.W, -C.H, 2 * C.W, 2 * C.H);
    g.beginPath(); g.moveTo(0, -C.H); g.lineTo(0, C.H); g.stroke();
    circulo(0, 0, C.CIRCULO); g.stroke();
    if (m.saque) { g.fillStyle = COLOR[m.saque] + '33'; circulo(0, 0, C.CIRCULO); g.fill(); }
    // arcos
    for (const s of [-1, 1]) {
      const x0 = s * C.W, x1 = s * (C.W + C.D);
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.fillRect(Math.min(x0, x1), -C.G, C.D, 2 * C.G);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
      g.beginPath();
      for (let y = -C.G; y <= C.G; y += 10) { g.moveTo(x0, y); g.lineTo(x1, y); }
      for (let k = 0; k <= C.D; k += 10) { g.moveTo(x0 + s * k, -C.G); g.lineTo(x0 + s * k, C.G); }
      g.stroke();
      g.strokeStyle = '#222'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x0, -C.G); g.lineTo(x1, -C.G); g.lineTo(x1, C.G); g.lineTo(x0, C.G); g.stroke();
    }
    for (const p of M.POSTES) {
      circulo(p.x, p.y, p.r); g.fillStyle = p.x < 0 ? '#f0a698' : '#a9c3f0'; g.fill();
      g.lineWidth = 2; g.strokeStyle = '#111'; g.stroke();
    }
    // jugadores
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [u, j] of m.J) {
      const d = j.d;
      if (u === YO || u === YO2) { circulo(d.x, d.y, d.r + 6); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.stroke(); }
      circulo(d.x, d.y, d.r); g.fillStyle = COLOR[j.e]; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = j.k ? '#fff' : '#111'; g.stroke();
      const n = nombres[u] || '', dorsal = dorsales[u];
      g.fillStyle = '#fff'; g.font = 'bold ' + (dorsal && grafemas(dorsal).length > 1 ? 11 : 13) + 'px system-ui,sans-serif';
      g.fillText(dorsal || (n[0] || '?').toUpperCase(), d.x, d.y + 1);
      g.font = '11px system-ui,sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)';
      g.fillText(n.slice(0, MAX_NOMBRE), d.x, d.y + d.r + 12);
      if (esHumano(u) && haySprint()) barraEnergia(j, d.x, d.y + d.r + 21);
    }
    // pelota
    circulo(m.b.x, m.b.y, m.b.r); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#111'; g.stroke();
    // joystick táctil: fijo y tenue mientras no se toca, para que se vea dónde va
    const verTactil = TACTIL && jugando && !terminado && YO && !capaAbierta();
    $('tactil').hidden = !verTactil;
    $('tSprint').hidden = !haySprint();
    if (verTactil && !toque) {
      const r = devicePixelRatio || 1;
      g.setTransform(r, 0, 0, r, 0, 0);
      circulo(90, innerHeight - 90, 45); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.stroke();
      circulo(90, innerHeight - 90, 20); g.fillStyle = 'rgba(255,255,255,.16)'; g.fill();
    }
    if (toque) {
      const r = devicePixelRatio || 1;
      g.setTransform(r, 0, 0, r, 0, 0);
      circulo(toque.x0, toque.y0, 45); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
      circulo(toque.x, toque.y, 20); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    }
  }

  // ---------- bucle ----------
  let antes = performance.now(), acc = 0;
  function cuadro(t) {
    const dt = Math.min(0.25, (t - antes) / 1000); antes = t;
    acc += dt;
    let n = 0;
    while (acc >= TICK && n < 10) { paso(); acc -= TICK; n++; }
    if (n === 10) acc = 0;
    dibuja();
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
  // Una pestaña oculta no tiene rAF; en línea el partido sigue igual.
  setInterval(() => {
    if (!document.hidden || !ONLINE) return;
    for (let i = 0; i < 6; i++) paso();
    antes = performance.now();
  }, 100);

  // ---------- menú ----------
  function marcaSel(grupo, attr, v) {
    for (const b of document.querySelectorAll('[data-' + grupo + ']')) b.classList.toggle('sel', b.dataset[grupo] === String(v));
  }
  // «Juntos» necesita al menos 2 por equipo: el 1 vs 1 no deja sitio para J2 en el rojo.
  function eligeModo(modo) {
    practica.modo = modo;
    marcaSel('modo', 'modo', modo);
    const uno = document.querySelector('[data-n="1"]');
    uno.disabled = modo === 'juntos';
    if (modo === 'juntos' && practica.n < 2) { practica.n = 2; marcaSel('n', 'n', 2); }
  }
  for (const b of document.querySelectorAll('[data-modo]')) b.addEventListener('click', () => { eligeModo(b.dataset.modo); pintaFichas(); });
  for (const b of document.querySelectorAll('[data-n]')) b.addEventListener('click', () => { practica.n = +b.dataset.n; marcaSel('n', 'n', practica.n); });
  for (const b of document.querySelectorAll('[data-cancha]')) b.addEventListener('click', () => { practica.cancha = b.dataset.cancha; marcaSel('cancha', 'cancha', practica.cancha); });
  for (const b of document.querySelectorAll('[data-nivel]')) b.addEventListener('click', () => { practica.nivel = +b.dataset.nivel; marcaSel('nivel', 'nivel', practica.nivel); });
  for (const b of document.querySelectorAll('[data-meta]')) b.addEventListener('click', () => { practica.meta = +b.dataset.meta; marcaSel('meta', 'meta', practica.meta); });
  $('conSprint').addEventListener('change', e => { practica.sprint = e.target.checked; pintaAyuda(); });
  for (const b of document.querySelectorAll('[data-tiempo]')) b.addEventListener('click', () => { practica.tiempo = +b.dataset.tiempo; marcaSel('tiempo', 'tiempo', practica.tiempo); });
  eligeModo(practica.modo); marcaSel('n', 'n', practica.n); marcaSel('nivel', 'nivel', practica.nivel); marcaSel('meta', 'meta', practica.meta); marcaSel('cancha', 'cancha', practica.cancha); marcaSel('tiempo', 'tiempo', practica.tiempo);
  $('jugar').addEventListener('click', () => { audio(); if (!ONLINE) practicaNueva(); });
  $('otra').addEventListener('click', () => { audio(); practicaNueva(); });
  $('menuFin').addEventListener('click', () => { $('fin').hidden = true; jugando = false; $('menu').hidden = false; });
  $('seguir').addEventListener('click', () => pausa(false));
  $('aMenu').addEventListener('click', () => { pausa(false); jugando = false; $('menu').hidden = false; });
  if (ONLINE) {
    $('opciones').hidden = true;
    $('cuenta').textContent = 'Esperando a que empiece la sala…';
    $('jugar').hidden = true;
    $('menuFin').hidden = true;
  }

  // ---------- fichas: nombre y dorsal ----------
  function pintaFichas() {
    for (const j of ['j1', 'j2']) {
      const f = ficha(j);
      $('nom_' + j).value = f.nombre; $('dor_' + j).value = f.dorsal;
    }
    const dos = !ONLINE && practica.modo !== 'bots';
    $('ficha_j2').hidden = !dos;
    $('tag_j1').hidden = !dos;
  }
  function leeFichas() {
    FICHAS = {};
    for (const j of ['j1', 'j2']) FICHAS[j] = { nombre: nombreSano($('nom_' + j).value), dorsal: dorsalSano($('dor_' + j).value) };
    guarda(K_FICHAS, FICHAS);
  }
  function aplicaMiFicha() {
    if (!cfg || cfg.mirando) return;
    const f = ficha('j1'), perfil = cfg.jugadores.find(j => j.uid === cfg.yo);
    nombres[YO] = f.nombre || nombreSano(perfil && perfil.nombre) || 'Jugador';
    dorsales[YO] = f.dorsal;
  }
  for (const j of ['j1', 'j2']) {
    $('dor_' + j).addEventListener('input', e => { const v = dorsalSano(e.target.value); if (v !== e.target.value) e.target.value = v; });
    for (const id of ['nom_' + j, 'dor_' + j]) $(id).addEventListener('change', () => { leeFichas(); if (ONLINE) aplicaMiFicha(); });
  }
  $('btnFicha').addEventListener('click', () => { $('menu').hidden = false; $('nom_j1').focus(); });
  $('aVestibulo').addEventListener('click', () => {
    if (confirm('¿Cortar el partido y volver todos al vestíbulo? El marcador vuelve a cero.')) enviar('vestibulo');
  });
  $('jugar').addEventListener('click', () => { if (ONLINE && cfg) { leeFichas(); aplicaMiFicha(); $('menu').hidden = true; } });

  // ---------- teclas ----------
  function pintaTeclas() {
    $('teclasTabla').innerHTML = '<tr><th></th><th>J1</th><th>J2</th></tr>' + ACCIONES.map(([a, t]) =>
      '<tr><th>' + t + '</th>' + ['j1', 'j2'].map(j =>
        '<td><button class="btn2 tecla" data-j="' + j + '" data-a="' + a + '">' + TECLAS[j][a].map(nombreTecla).join(' / ') + '</button></td>').join('') + '</tr>').join('');
    for (const b of $('teclasTabla').querySelectorAll('button')) b.addEventListener('click', () => captura(b));
  }
  function captura(b) {
    for (const x of $('teclasTabla').querySelectorAll('button')) x.classList.remove('sel');
    b.classList.add('sel'); b.textContent = 'Pulsa una tecla…';
    capturando = code => {
      capturando = null;
      if (code !== 'Escape') {
        for (const j of ['j1', 'j2']) for (const [a] of ACCIONES) {
          const quedan = TECLAS[j][a].filter(c => c !== code);
          if (quedan.length) TECLAS[j][a] = quedan;
        }
        TECLAS[b.dataset.j][b.dataset.a] = [code];
        guarda(K_TECLAS, TECLAS);
        configuraMando(); pintaAyuda();
      }
      pintaTeclas();
    };
  }
  function abreTeclas() { pintaTeclas(); $('teclasCapa').hidden = false; }
  function cierraTeclas() { capturando = null; $('teclasCapa').hidden = true; }
  $('btnTeclas').addEventListener('click', abreTeclas);
  $('teclasCerrar').addEventListener('click', cierraTeclas);
  $('teclasRestaurar').addEventListener('click', () => {
    TECLAS = copiaTeclas(TECLAS_POR); guarda(K_TECLAS, TECLAS); configuraMando(); pintaAyuda(); pintaTeclas();
  });

  pintaFichas();
  pintaAyuda();
  pintaMarca();

  // El mando juega como J1 y sigue sus teclas aunque se hayan cambiado.
  function configuraMando() {
    if (!window.Mando) return;
    const t = TECLAS.j1, k = t.patea[0], s = t.sprint[0];
    Mando.configura({
      stick: { izq: t.izq[0], der: t.der[0], arriba: t.arriba[0], abajo: t.abajo[0] },
      botones: {
        a: k, rt: k, x: k, b: s, lb: s, lt: s, izq: t.izq[0], der: t.der[0], arriba: t.arriba[0], abajo: t.abajo[0],
        start: () => { if (jugando && !ONLINE && !terminado) pausa(!pausado); },
      },
      menu: () => !jugando || pausado || terminado || capaAbierta(),
      inicio: '#jugar',
      zonas: [{ sel: '#ayuda' }, { sel: '#menuAyuda' }],
      pistas: [['stickL', 'moverte'], ['a x rt', 'patear'], ['b lb lt', 'sprint'], ['start', 'pausa']],
    });
  }
  configuraMando();

  window.__haxball = {
    paso: n => { for (let i = 0; i < (n || 1); i++) paso(); },
    estado: () => ({ jugando, terminado, soyDir, dirUid, goles: Object.assign({}, goles()), bola: { x: m.b.x, y: m.b.y }, saque: m.saque, jugadores: m.J.size }),
    practica: o => { Object.assign(practica, o || {}); practicaNueva(); },
  };
  enviar('listo');
})();
