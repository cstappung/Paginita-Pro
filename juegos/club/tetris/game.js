/* Tetris Club: el pozo en solitario, sobre el mismo motor que la sala
   multijugador (TetrisMotor). Tres modos: Maratón (hasta que no quepa),
   Sprint (40 líneas contra el reloj) y Ultra (dos minutos). */
(() => {
  'use strict';
  const TM = window.TetrisMotor, FX = window.TetrisFX;
  const $ = id => document.getElementById(id);
  const CLAVE = window.Club?.storageKey('tetris-club-v1') || 'tetris-club-v1';
  const SPRINT = TM.SPRINT, ULTRA_MS = TM.ULTRA_MS;
  /* La cuenta entra en la semilla de cada partida (TM.semillaDe): la
     prueba de un récord no le sirve a otra persona. */
  const CUENTA = new URLSearchParams(location.search).get('cuenta') || 'local';
  const NOMBRE = { maraton: 'Maratón', sprint: 'Sprint', ultra: 'Ultra' };

  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch (_) { /* Storage es opcional. */ }
  let modo = NOMBRE[guardado.modo] ? guardado.modo : 'maraton';
  let sonido = guardado.sonido !== false;
  const records = guardado.records || {};
  const guarda = () => { try { localStorage.setItem(CLAVE, JSON.stringify({ modo, sonido, records })); } catch (_) { /* nada */ } };

  /* `g` graba la partida (TM.grabadora); `resto` es el tiempo real que
     aún no llega a un paso entero; `pared` mide, con el reloj del
     sistema, cuánto se jugó de verdad (va en la prueba: un reloj del
     juego frenado a mano se nota contra él). */
  let s = null, g = null, estado = 'menu', ultimo = 0, resto = 0, pared = 0, paredAntes = 0;
  /* Las pulsaciones de la partida (TM.registroTeclas), para la capa
     anti-bot: instante, cuánto se mantuvo y de dónde vino cada una. */
  let pulsos = null;
  const hayMando = () => { try { return [...(navigator.getGamepads?.() || [])].some(p => p && p.connected); } catch (_) { return false; } };
  /* De dónde viene un evento: el teclado o el dedo de verdad (isTrusted),
     el mando (mando.js despacha teclas sintéticas marcadas `__mando`, y
     valen si hay un mando conectado) o nadie (un script). */
  const origen = (e, tactil) => e.__mando ? (hayMando() ? 'M' : 'X') : !e.isTrusted ? 'X' : tactil ? 'T' : '';
  const pozo = $('pozo'), cx = pozo.getContext('2d');
  const cxG = $('guarda').getContext('2d'), cxC = $('cola').getContext('2d');
  /* Los efectos (fx.js) se rehacen en cada partida: no hay nada que
     arrastrar de la anterior. */
  const nuevosEfectos = () => FX.crearEfectos({ TM, celda: pozo.width / TM.W });
  let fx = nuevosEfectos();

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
        audio = { ctx: c, fx, rep: new window.Chip.Reproductor(c, mu, window.Temas.temas.neon), son: FX.crearSonido(c, fx) };
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
  /* Los efectos suenan con el motor de fx.js (el pozo como instrumento),
     no con el chip: ver la cabecera de fx.js. */
  function efecto(k, ...a) {
    if (!sonido || !audio || !audio.son[k]) return;
    audio.son[k](...a);
  }
  const altura = () => s ? FX.altura(s) : 0;
  /* El latido: con la pila a cinco filas del techo, un corazón que se
     acelera cuanto más cerca está. */
  let latidoT = 0;
  function latido(dt) {
    const a = altura();
    if (estado !== 'jugando' || a < 15) { latidoT = 0; return; }
    latidoT -= dt;
    if (latidoT <= 0) { const k = (a - 14) / 6; efecto('latido', k); latidoT = 900 - k * 380; }
  }

  /* ---------- partida ---------- */
  function empieza() {
    iniciaAudio();
    let sal = (Math.random() * 2 ** 32) >>> 0;
    try { sal = crypto.getRandomValues(new Uint32Array(1))[0]; } catch (_) { /* con Math.random basta */ }
    g = TM.grabadora({ cuenta: CUENTA, sal, modo, alJugar: a => { if ((a === 'izq' || a === 'der') && s && s.p) efecto('mueve', s.p.x); } });
    s = g.s;
    fx = nuevosEfectos();
    estado = 'jugando'; fresco = true; ultimo = 0; resto = 0; pared = 0; paredAntes = 0;
    pulsos = TM.registroTeclas(performance.now());
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
    if (nuevo) { antesDelRecord = { modo, cat: cat(), r: records[modo] }; records[modo] = r; guarda(); }
    if (vale) window.Club?.result({ categoria: cat(), puntos: modo === 'sprint' ? SPRINT : r.puntos, tiempo: r.tiempo },
      g.prueba({ w: Math.round(pared), k: pulsos.texto() }));
    efecto(nuevo ? 'record' : 'fin');
    capa(
      modo === 'sprint' ? (gano ? '¡40 líneas!' : 'Se llenó') : modo === 'ultra' && gano ? '¡Tiempo!' : 'Se acabó',
      modo === 'sprint' ? (gano ? `En ${reloj(r.tiempo)}${nuevo ? ' · ¡récord!' : ''}` : `${s.lineas} de ${SPRINT} líneas`)
        : `${r.puntos} puntos · ${s.lineas} líneas${nuevo ? ' · ¡récord!' : ''}`,
      'Otra vez');
    pintaDatos();
  }
  /* Si la página no acepta la partida, el récord local tampoco cuenta. */
  let antesDelRecord = null;
  window.addEventListener('club-rechazo', e => {
    const d = e.detail; if (!d) return;
    if (antesDelRecord && d.categoria === antesDelRecord.cat) {
      if (antesDelRecord.r) records[antesDelRecord.modo] = antesDelRecord.r; else delete records[antesDelRecord.modo];
      antesDelRecord = null; guarda(); pintaDatos();
    }
    if (estado === 'fin' && d.categoria === cat()) $('capaP').textContent = 'No se guardó: ' + (d.motivo || 'la partida no cuadra.');
  });
  function capa(t, p, b) {
    $('capaT').innerHTML = `${t}<span>.</span>`.replace(/([.!])<span>\.<\/span>$/, '$1');
    $('capaP').textContent = p; $('jugar').textContent = b; $('capa').hidden = false;
  }
  function pausa() {
    if (estado === 'jugando') { estado = 'pausa'; mando.suelta(); g.vacia(); capa('Pausa', `${NOMBRE[modo]} · nivel ${s.nivel}`, 'Seguir'); }
    else if (estado === 'pausa') { estado = 'jugando'; ultimo = 0; paredAntes = 0; $('capa').hidden = true; pozo.focus(); }
  }
  function bloqueaModos(b) { document.querySelectorAll('[data-modo]').forEach(x => { x.disabled = b; }); }

  function acciones(a) {
    if (a === 'pausa') return pausa();
    if (estado !== 'jugando') return;
    /* No se aplica aquí: se deja para el comienzo del próximo paso, que
       es como la rehace el verificador. */
    g.pide(a);
  }
  const mando = TM.crearMando(acciones);
  let configurando = false;
  const pintaTeclas = () => { $('teclasTxt').textContent = TM.textoTeclas(); };
  // Mando de consola: mismas acciones que el teclado (ver TM.mandoTetris).
  const ponMando = t => window.Mando && window.Mando.configura(Object.assign(TM.mandoTetris(t), {
    menu: () => estado !== 'jugando' || configurando, inicio: '#jugar', zonas: [{ sel: '#teclasTxt' }]
  }));
  pintaTeclas(); ponMando();
  $('teclas').addEventListener('click', () => {
    if (estado === 'jugando') pausa();
    configurando = true; mando.suelta();
    TM.panelTeclas(document, t => { mando.recarga(t); pintaTeclas(); ponMando(t); }, () => { configurando = false; });
  });
  document.addEventListener('keydown', e => {
    if (configurando) return;
    if (estado !== 'jugando' && estado !== 'pausa' && (e.code === 'Space' || e.code === 'Enter')) {
      if (e.target.closest?.('button') && e.code === 'Enter') return;
      e.preventDefault(); return estado === 'pausa' ? pausa() : empieza();
    }
    if (estado === 'pausa' && e.code !== 'KeyP' && e.code !== 'Escape') return;
    const a = mando.accionDe(e.code);
    if (estado === 'jugando' && a && a !== 'pausa' && !e.repeat) pulsos.baja(e.code, e.timeStamp, origen(e));
    mando.baja(e);
  });
  document.addEventListener('keyup', e => { if (pulsos) pulsos.sube(e.code, e.timeStamp); mando.sube(e); });
  window.addEventListener('blur', () => { mando.suelta(); if (estado === 'jugando') pausa(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && estado === 'jugando') pausa(); });

  /* Botones táctiles: ◀ ▶ se repiten al mantener, ▼ es bajada blanda. */
  const sueltas = [];
  document.querySelectorAll('.tt-tactil [data-a]').forEach(b => {
    const a = b.dataset.a;
    let rep = null;
    const suelta = e => {
      clearInterval(rep); clearTimeout(rep); rep = null; if (a === 'blando') mando.blando = false;
      if (pulsos) pulsos.sube('tactil-' + a, e && e.timeStamp || performance.now());
    };
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); iniciaAudio();
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
      if (estado !== 'jugando') return;
      pulsos.baja('tactil-' + a, e.timeStamp, origen(e, true));
      if (a === 'blando') { mando.blando = true; return; }
      acciones(a);
      if (a === 'izq' || a === 'der') rep = setTimeout(() => { rep = setInterval(() => acciones(a), 50); }, 170);
    });
    ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture', 'touchend', 'touchcancel'].forEach(ev => b.addEventListener(ev, suelta));
    /* iOS: una pulsación larga seleccionaba el botón o abría el menú, que se
       quedaba con el dedo; el pointerup no llegaba y la pieza seguía corriendo. */
    b.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    b.addEventListener('contextmenu', e => e.preventDefault());
    b.addEventListener('selectstart', e => e.preventDefault());
    sueltas.push(suelta);
  });
  /* Red de seguridad: sin dedos en pantalla, ningún botón sigue apretado. */
  const sueltaTodo = () => sueltas.forEach(f => f());
  document.addEventListener('touchend', e => { if (!e.touches.length) sueltaTodo(); });
  document.addEventListener('touchcancel', e => { if (!e.touches.length) sueltaTodo(); });
  window.addEventListener('blur', sueltaTodo);
  document.addEventListener('visibilitychange', () => { if (document.hidden) sueltaTodo(); });

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
  const avisa = (t, k) => { const a = $('aviso'); a.textContent = t; a.dataset.k = k || ''; a.classList.remove('ve'); void a.offsetWidth; a.classList.add('ve'); };
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
    if (s) fx.pinta(cx, s);
    else { cx.fillStyle = '#0b0f1a'; cx.fillRect(0, 0, pozo.width, pozo.height); }
    fx.sacude(pozo);
    cxG.clearRect(0, 0, 100, 70);
    if (s?.guardada) FX.pintaPieza(cxG, TM, s.guardada, 50, 35, 18, s.puedeGuardar ? 1 : .35);
    cxC.clearRect(0, 0, 100, 320);
    if (s) s.cola.slice(0, 5).forEach((t, i) => FX.pintaPieza(cxC, TM, t, 50, 34 + i * 62, i ? 15 : 18));
  }

  function eventos() {
    let seco = false;
    for (const ev of s.eventos.splice(0)) {
      fx.evento(ev);
      if (ev.e === 'gira') efecto('gira', s.p?.t, s.p?.x);
      else if (ev.e === 'guarda') efecto('guarda');
      else if (ev.e === 'seco') { seco = true; efecto('seco', ev.a - ev.de, ev.celdas[0][0]); }
      else if (ev.e === 'nivel') { efecto('nivel'); avisa(`Nivel ${ev.n}`, 'nivel'); }
      else if (ev.e === 'fija') {
        if (ev.n || ev.ts) efecto('linea', ev.n, ev.combo, ev.ts, ev.pc, ev.b2b);
        else if (!seco) efecto('fija', Math.min(1, altura() / 20), ev.bloq?.[0]?.[0]);
        const txt = [ev.pc ? '¡Pozo limpio!' : '', ev.ts ? `T-spin${ev.n ? ' ' + ['', 'simple', 'doble', 'triple'][ev.n] : ''}` : '',
          ev.n === 4 ? '¡TETRIS!' : '', ev.b2b && (ev.n === 4 || ev.ts) ? 'B2B' : '', ev.combo > 0 ? `Combo ×${ev.combo}` : ''].filter(Boolean).join(' · ');
        if (txt) avisa(txt, ev.pc ? 'pc' : ev.n === 4 ? 'tetris' : ev.ts ? 'ts' : 'combo');
      }
    }
    s.salida = 0;
  }

  function bucle(t) {
    requestAnimationFrame(bucle);
    const dt = ultimo ? Math.min(100, t - ultimo) : 0; ultimo = t;
    if (estado === 'jugando') {
      const ahora = Date.now();
      if (paredAntes) pared += Math.min(1000, Math.max(0, ahora - paredAntes));
      paredAntes = ahora;
      /* Pasos fijos de TM.PASO ms, los que quepan en este cuadro: lo que
         rehace el verificador es exactamente esta sucesión. */
      resto += dt;
      while (resto >= TM.PASO && estado === 'jugando') {
        resto -= TM.PASO;
        mando.paso(TM.PASO);
        const fin = g.paso(mando.blando);
        eventos();
        if (fin) { if (modo === 'ultra' && fin.gano) s.tiempo = ULTRA_MS; termina(fin.gano); }
      }
    }
    if (estado !== 'pausa') fx.paso(dt);
    latido(dt);
    musica();
    pinta(); pintaDatos();
  }

  $('sonido').textContent = sonido ? '🔊' : '🔈';
  ponModo();
  requestAnimationFrame(bucle);
})();
