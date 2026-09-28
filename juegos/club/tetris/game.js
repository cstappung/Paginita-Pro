/* Tetris Club: el pozo en solitario, sobre el mismo motor que la sala
   multijugador (TetrisMotor). Tres modos: Maratón (hasta que no quepa),
   Sprint (40 líneas contra el reloj) y Ultra (dos minutos). */
(() => {
  'use strict';
  const TM = window.TetrisMotor;
  const $ = id => document.getElementById(id);
  const CLAVE = window.Club?.storageKey('tetris-club-v1') || 'tetris-club-v1';
  const SPRINT = 40, ULTRA_MS = 120000;
  const NOMBRE = { maraton: 'Maratón', sprint: 'Sprint', ultra: 'Ultra' };

  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch (_) { /* Storage es opcional. */ }
  let modo = NOMBRE[guardado.modo] ? guardado.modo : 'maraton';
  let sonido = guardado.sonido !== false;
  const records = guardado.records || {};
  const guarda = () => { try { localStorage.setItem(CLAVE, JSON.stringify({ modo, sonido, records })); } catch (_) { /* nada */ } };

  let s = null, estado = 'menu', ultimo = 0;
  const pozo = $('pozo'), cx = pozo.getContext('2d');
  const cxG = $('guarda').getContext('2d'), cxC = $('cola').getContext('2d');

  const reloj = ms => { const t = Math.max(0, ms) / 1000; return `${Math.floor(t / 60)}:${(t % 60).toFixed(modo === 'sprint' ? 2 : 0).padStart(modo === 'sprint' ? 5 : 2, '0')}`; };
  const cat = () => `club-tetris-${modo}`;
  const mejor = r => modo === 'sprint' ? (r?.tiempo ? reloj(r.tiempo) : '—') : (r?.puntos ? String(r.puntos) : '—');
  function mejora(r) {
    const a = records[modo];
    if (modo === 'sprint') return !a?.tiempo || r.tiempo < a.tiempo;
    return !a?.puntos || r.puntos > a.puntos;
  }
  window.addEventListener('club-record', e => {
    const d = e.detail; if (!d || d.categoria !== cat()) return;
    if (mejora(d)) { records[modo] = { puntos: d.puntos, tiempo: d.tiempo }; guarda(); pintaDatos(); }
  });

  /* ---------- sonido ---------- */
  let audio = null, sonando = false, fresco = true;
  function iniciaAudio() {
    if (!sonido) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!audio && A && window.Chip && window.Temas) {
        const c = new A(), m = c.createGain(), mu = c.createGain(), fx = c.createGain();
        m.gain.value = .6; mu.gain.value = .45; fx.gain.value = .75;
        mu.connect(m); fx.connect(m); m.connect(c.destination);
        audio = { ctx: c, fx, rep: new window.Chip.Reproductor(c, mu, window.Temas.temas.neon) };
      }
      if (audio?.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    } catch (_) { audio = null; }
  }
  function musica() {
    if (!audio) return;
    const r = audio.rep;
    if (!sonido || estado !== 'jugando' || audio.ctx.state !== 'running') {
      if (sonando || r.voces.size) r.detener();
      sonando = false; return;
    }
    if (fresco) { r.reinicia(); fresco = false; }
    sonando = true;
    const alto = altura();
    r.tempo = 1 + Math.min(.12, (s.nivel - 1) * .01) + (alto > 14 ? .06 : 0);
    try { r.tick(.2); } catch (_) { /* el sonido nunca bloquea */ }
  }
  function efecto(k, n = 0) {
    if (!sonido || !audio) return;
    try {
      const C = window.Chip, c = audio.ctx, d = audio.fx, t = c.currentTime + .005, H = C.hz;
      const P = (m, dur, o = {}) => C.voz(c, d, Object.assign({ t, f: H(m), dur, vol: .09, onda: 'p25', sus: .8 }, o));
      const run = (ns, st, o = {}) => ns.forEach((m, i) => P(m, st * .95, Object.assign({ t: t + i * st }, o)));
      if (k === 'mueve') P(84, .02, { onda: 'p12', vol: .03 });
      else if (k === 'gira') P(79, .035, { onda: 'p12', vol: .05 });
      else if (k === 'fija') C.ruido(c, d, { t, dur: .06, vol: .1, corto: true, tono: .8 });
      else if (k === 'guarda') P(67, .08, { onda: 'tri', vol: .14, f1: H(74) });
      else if (k === 'linea') run([72, 76, 79, 84].slice(0, n).concat(n >= 4 ? [88, 91] : []), .045, { vol: .08 });
      else if (k === 'nivel') run([60, 67, 72, 79, 84], .06, { onda: 'p50', vol: .08 });
      else if (k === 'fin') run([67, 63, 60, 55, 48], .12, { onda: 'tri', vol: .16, sus: 1 });
      else if (k === 'inicio') run([60, 64, 67, 72], .06, { onda: 'p12', vol: .08 });
      else if (k === 'record') run([72, 76, 79, 84, 88, 91, 96], .07, { vol: .09 });
    } catch (_) { /* nada */ }
  }
  function altura() {
    if (!s) return 0;
    for (let y = 0; y < TM.H; y++) for (let x = 0; x < TM.W; x++) if (s.pozo[y * TM.W + x]) return TM.H - y;
    return 0;
  }

  /* ---------- partida ---------- */
  function empieza() {
    iniciaAudio();
    s = TM.crear({ semilla: (Math.random() * 2 ** 32) >>> 0, nivel: 1 });
    estado = 'jugando'; fresco = true; ultimo = 0;
    mando.suelta();
    $('capa').hidden = true;
    bloqueaModos(true);
    efecto('inicio');
    pozo.focus();
  }
  function termina(gano) {
    estado = 'fin';
    bloqueaModos(false);
    mando.suelta();
    const r = { puntos: s.puntos, tiempo: Math.max(1, Math.round(s.tiempo)) };
    const vale = modo === 'sprint' ? gano : r.puntos >= 1;
    const nuevo = vale && mejora(r);
    if (nuevo) { records[modo] = r; guarda(); }
    if (vale) window.Club?.result({ categoria: cat(), puntos: modo === 'sprint' ? SPRINT : r.puntos, tiempo: r.tiempo });
    efecto(nuevo ? 'record' : 'fin');
    capa(
      modo === 'sprint' ? (gano ? '¡40 líneas!' : 'Se llenó') : modo === 'ultra' && gano ? '¡Tiempo!' : 'Se acabó',
      modo === 'sprint' ? (gano ? `En ${reloj(r.tiempo)}${nuevo ? ' · ¡récord!' : ''}` : `${s.lineas} de ${SPRINT} líneas`)
        : `${r.puntos} puntos · ${s.lineas} líneas${nuevo ? ' · ¡récord!' : ''}`,
      'Otra vez');
    pintaDatos();
  }
  function capa(t, p, b) {
    $('capaT').innerHTML = `${t}<span>.</span>`.replace(/([.!])<span>\.<\/span>$/, '$1');
    $('capaP').textContent = p; $('jugar').textContent = b; $('capa').hidden = false;
  }
  function pausa() {
    if (estado === 'jugando') { estado = 'pausa'; mando.suelta(); capa('Pausa', `${NOMBRE[modo]} · nivel ${s.nivel}`, 'Seguir'); }
    else if (estado === 'pausa') { estado = 'jugando'; ultimo = 0; $('capa').hidden = true; pozo.focus(); }
  }
  function bloqueaModos(b) { document.querySelectorAll('[data-modo]').forEach(x => { x.disabled = b; }); }

  function acciones(a) {
    if (a === 'pausa') return pausa();
    if (estado !== 'jugando') return;
    if (TM.accion(s, a) && (a === 'izq' || a === 'der')) efecto('mueve');
  }
  const mando = TM.crearMando(acciones);
  document.addEventListener('keydown', e => {
    if (estado !== 'jugando' && estado !== 'pausa' && (e.code === 'Space' || e.code === 'Enter')) {
      if (e.target.closest?.('button') && e.code === 'Enter') return;
      e.preventDefault(); return estado === 'pausa' ? pausa() : empieza();
    }
    if (estado === 'pausa' && e.code !== 'KeyP' && e.code !== 'Escape') return;
    mando.baja(e);
  });
  document.addEventListener('keyup', e => mando.sube(e));
  window.addEventListener('blur', () => { mando.suelta(); if (estado === 'jugando') pausa(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && estado === 'jugando') pausa(); });

  /* Botones táctiles: ◀ ▶ se repiten al mantener, ▼ es bajada blanda. */
  document.querySelectorAll('.tt-tactil [data-a]').forEach(b => {
    const a = b.dataset.a;
    let rep = null;
    const suelta = () => { clearInterval(rep); clearTimeout(rep); rep = null; if (a === 'blando') mando.blando = false; };
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); iniciaAudio();
      if (estado !== 'jugando') return;
      if (a === 'blando') { mando.blando = true; return; }
      acciones(a);
      if (a === 'izq' || a === 'der') rep = setTimeout(() => { rep = setInterval(() => acciones(a), 50); }, 170);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, suelta));
  });

  $('jugar').addEventListener('click', () => estado === 'pausa' ? pausa() : empieza());
  $('sonido').addEventListener('click', () => {
    sonido = !sonido; guarda(); $('sonido').textContent = sonido ? '🔊' : '🔈';
    if (sonido) iniciaAudio(); else if (audio) { audio.rep.detener(); sonando = false; }
  });
  document.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => {
    if (estado === 'jugando' || estado === 'pausa') return;
    modo = b.dataset.modo; guarda(); ponModo();
  }));
  function ponModo() {
    document.querySelectorAll('[data-modo]').forEach(x => x.classList.toggle('activo', x.dataset.modo === modo));
    window.Club?.category(cat());
    s = null; estado = 'menu';
    capa(NOMBRE[modo], modo === 'sprint' ? 'Cuarenta líneas, lo más rápido que puedas.' : modo === 'ultra' ? 'Dos minutos: todos los puntos que quepan.' : 'Completa filas. Que no llegue arriba.', 'Jugar');
    pintaDatos(); pinta();
  }

  /* ---------- dibujo ---------- */
  const avisa = t => { const a = $('aviso'); a.textContent = t; a.classList.remove('ve'); void a.offsetWidth; a.classList.add('ve'); };
  let datosFirma = '';
  function pintaDatos() {
    const t = !s ? 0 : modo === 'ultra' ? ULTRA_MS - s.tiempo : s.tiempo;
    const f = [modo, s?.puntos, s?.lineas, s?.nivel, reloj(t), mejor(records[modo])].join('|');
    if (f === datosFirma) return; datosFirma = f;
    $('etqA').textContent = 'Puntos';
    $('datoA').textContent = s ? s.puntos : 0;
    $('datoL').textContent = s ? (modo === 'sprint' ? `${s.lineas}/${SPRINT}` : s.lineas) : 0;
    $('datoN').textContent = s ? s.nivel : 1;
    $('etqT').textContent = modo === 'ultra' ? 'Queda' : 'Tiempo';
    $('datoT').textContent = reloj(s ? t : modo === 'ultra' ? ULTRA_MS : 0);
    $('record').textContent = mejor(records[modo]);
  }
  function pinta() {
    const c = pozo.width / TM.W;
    if (s) TM.pintaPozo(cx, s, { celda: c });
    else { cx.fillStyle = '#0b0f1a'; cx.fillRect(0, 0, pozo.width, pozo.height); }
    cxG.clearRect(0, 0, 100, 70);
    if (s?.guardada) TM.pintaPieza(cxG, s.guardada, 50, 35, 18, s.puedeGuardar ? 1 : .35);
    cxC.clearRect(0, 0, 100, 320);
    if (s) s.cola.slice(0, 5).forEach((t, i) => TM.pintaPieza(cxC, t, 50, 34 + i * 62, i ? 15 : 18));
  }

  function eventos() {
    for (const ev of s.eventos.splice(0)) {
      if (ev.e === 'gira') efecto('gira');
      else if (ev.e === 'guarda') efecto('guarda');
      else if (ev.e === 'nivel') { efecto('nivel'); avisa(`Nivel ${ev.n}`); }
      else if (ev.e === 'fija') {
        if (ev.n) efecto('linea', ev.n); else efecto('fija');
        const txt = [ev.pc ? '¡Pozo limpio!' : '', ev.ts ? `T-spin${ev.n ? ' ' + ['', 'simple', 'doble', 'triple'][ev.n] : ''}` : '',
          ev.n === 4 ? '¡TETRIS!' : '', ev.b2b && (ev.n === 4 || ev.ts) ? 'B2B' : '', ev.combo > 0 ? `Combo ×${ev.combo}` : ''].filter(Boolean).join(' · ');
        if (txt) avisa(txt);
      }
    }
    s.salida = 0;
  }

  function bucle(t) {
    requestAnimationFrame(bucle);
    const dt = ultimo ? Math.min(100, t - ultimo) : 0; ultimo = t;
    if (estado === 'jugando') {
      mando.paso(dt);
      s.blando = mando.blando;
      TM.avanza(s, dt);
      eventos();
      if (s.fin) termina(false);
      else if (modo === 'sprint' && s.lineas >= SPRINT) termina(true);
      else if (modo === 'ultra' && s.tiempo >= ULTRA_MS) { s.tiempo = ULTRA_MS; termina(true); }
    }
    musica();
    pinta(); pintaDatos();
  }

  $('sonido').textContent = sonido ? '🔊' : '🔈';
  ponModo();
  requestAnimationFrame(bucle);
})();
