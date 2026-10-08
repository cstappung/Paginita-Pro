/* 2048 — la pantalla.
   Todo lo que decide una partida está en motor.js (el tablero, las jugadas y
   el azar de cada ficha nueva, que sale de la semilla y la cuenta); aquí solo
   se dibuja, se suena y se lleva la cuenta. El tablero es DOM: cada ficha es
   un elemento que se desliza con una transición de CSS, y la jugada siguiente
   no espera a que termine la anterior. La prueba de una partida son la
   semilla y cada jugada con su dirección, su origen y los ms jugados desde la
   anterior; verifica/dosmil.js la rehace con el mismo motor. */
(() => {
  'use strict';
  const M = window.DosmilMotor, Club = window.Club;
  const $ = id => document.getElementById(id);
  const CAT_PUNTOS = 'club-dosmil-puntos', CAT_FICHA = 'club-dosmil-ficha';
  const N = M.N;

  /* ---------- Guardado ----------
     Un solo blob, aquí y en la cuenta: el progreso (mejor puntaje, mejor
     ficha, partidas) y la partida en curso, que se retoma donde quedó. */
  const CUENTA = Club && Club.storageKey ? Club.storageKey('').replace(/^\.cuenta\./, '') : 'local';
  const clave = k => Club && Club.storageKey ? Club.storageKey(k) : k + '.cuenta.local';
  function lee(k) { try { return JSON.parse(localStorage.getItem(clave(k)) || 'null'); } catch (_) { return null; } }
  function guarda(k, v) { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } }
  const local = lee('dosmil.datos') || {};
  let prog = M.mezclaProgreso(local.prog, null);
  let ultimaSubida = '';

  /* ---------- Estado ---------- */
  let E = null, jugadas = [], fiable = true, tocado = false, terminada = false, vioGano = false;
  let enSesion = 0;                       // jugadas hechas desde que se cargó la página
  let pausado = false;                    // la pausa con cartel (P o Esc)
  // Relojes de lo jugado: se paran en pausa, con la pestaña oculta o sin foco.
  let accA = 0, accW = 0, corre = false, segA = 0, segW = 0, ultimaA = 0;
  let fichas = new Array(M.CASILLAS).fill(null);
  let desdeSubida = 0;

  function reloj() {
    let a = accA, w = accW;
    if (corre) { a += performance.now() - segA; w += Date.now() - segW; }
    return { a, w };
  }
  function arranca() {
    if (corre || pausado || terminada || document.hidden) return;
    corre = true; segA = performance.now(); segW = Date.now();
  }
  function para() {
    if (!corre) return;
    accA += performance.now() - segA; accW += Date.now() - segW; corre = false;
  }

  function juegoGuardable() {
    if (!E) return null;
    const r = reloj();
    return { s: E.semilla, u: E.u, f: M.codifica(jugadas), a: Math.round(r.a), w: Math.round(r.w), ua: Math.round(ultimaA),
      g: vioGano ? 1 : 0, t: tocado || !fiable ? 1 : 0, fin: terminada ? 1 : 0, at: Date.now() };
  }
  function blob() { return { v: 1, prog, juego: terminada ? null : juegoGuardable() }; }
  function guardaTodo() { guarda('dosmil.datos', blob()); }
  function subeNube(forzar) {
    if (!Club || !Club.guardarPartida) return;
    const texto = JSON.stringify(blob());
    if (!forzar && texto === ultimaSubida) return;
    ultimaSubida = texto; desdeSubida = 0;
    Club.guardarPartida(texto);
  }

  /* ---------- Sonido: efectos cortos de WebAudio (volumen.js los gobierna) ---------- */
  let ac = null, mudo = false;
  try { mudo = localStorage.getItem('dosmil.mudo') === '1'; } catch (_) { /* nada */ }
  function audio() {
    if (mudo) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (_) { return null; }
    return ac;
  }
  function tono(f, t0, dur, tipo, vol) {
    const c = audio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function soplo() {
    const c = audio(); if (!c) return;
    const n = Math.floor(c.sampleRate * 0.07), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8; g.gain.value = 0.08;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  // Pentatónica de do: cada exponente una nota más arriba.
  const ESCALA = [0, 2, 4, 7, 9];
  const notaDe = e => 261.63 * 2 ** ((Math.floor((e - 1) / 5) * 12 + ESCALA[(e - 1) % 5]) / 12);
  const sonidos = {
    mueve: () => soplo(),
    junta: e => { tono(notaDe(e), 0, 0.18, 'triangle', 0.13); tono(notaDe(e) * 2, 0.02, 0.12, 'sine', 0.05); },
    gana: () => [0, 4, 7, 12].forEach((s, i) => tono(523.25 * 2 ** (s / 12), i * 0.09, 0.4, 'triangle', 0.12)),
    fin: () => [7, 4, 0, -5].forEach((s, i) => tono(392 * 2 ** (s / 12), i * 0.12, 0.35, 'sine', 0.1)),
  };
  function pintaSonido() {
    const b = $('sound-button');
    b.setAttribute('aria-pressed', mudo ? 'false' : 'true');
    b.setAttribute('aria-label', mudo ? 'Activar efectos' : 'Desactivar efectos');
  }
  $('sound-button').addEventListener('click', () => {
    mudo = !mudo;
    try { localStorage.setItem('dosmil.mudo', mudo ? '1' : '0'); } catch (_) { /* nada */ }
    pintaSonido(); if (!mudo) sonidos.junta(3);
  });
  pintaSonido();

  /* ---------- El tablero ---------- */
  const tablero = $('tablero');
  for (let i = 0; i < M.CASILLAS; i++) {
    const c = document.createElement('div');
    c.className = 'celda';
    c.style.setProperty('--x', i % N); c.style.setProperty('--y', Math.floor(i / N));
    tablero.appendChild(c);
  }
  function ficha(i, e, clase) {
    const f = document.createElement('div'), v = String(M.valor(e));
    f.className = 'ficha' + (clase ? ' ' + clase : '');
    f.dataset.e = String(Math.min(e, 17)); f.dataset.d = String(v.length);
    f.style.setProperty('--x', i % N); f.style.setProperty('--y', Math.floor(i / N));
    const b = document.createElement('b'); b.textContent = v; f.appendChild(b);
    tablero.appendChild(f);
    return f;
  }
  function ponEn(f, i) { f.style.setProperty('--x', i % N); f.style.setProperty('--y', Math.floor(i / N)); }
  function pintaTodo() {
    for (const f of tablero.querySelectorAll('.ficha')) f.remove();
    fichas = new Array(M.CASILLAS).fill(null);
    for (let i = 0; i < M.CASILLAS; i++) if (E.t[i]) fichas[i] = ficha(i, E.t[i], 'nueva');
  }
  function anima(r) {
    const juntas = new Set(r.fusiones), nuevas = new Array(M.CASILLAS).fill(null);
    for (const [d, h] of r.movs) {
      const f = fichas[d]; if (!f) continue;
      f.classList.remove('nueva', 'fusion');
      ponEn(f, h);
      if (juntas.has(h)) setTimeout(() => f.remove(), 120);
      else nuevas[h] = f;
    }
    for (const h of juntas) nuevas[h] = ficha(h, E.t[h], 'fusion');
    if (r.nueva) nuevas[r.nueva.i] = ficha(r.nueva.i, r.nueva.e, 'nueva');
    fichas = nuevas;
  }

  function pintaMarcador() {
    $('nPuntos').textContent = String(E ? E.puntos : 0);
    $('nMejor').textContent = String(Math.max(prog.mejor, E ? E.puntos : 0));
    $('nFicha').textContent = prog.ficha ? String(prog.ficha) : '—';
  }
  function popSuma(n) {
    const p = $('popSuma');
    p.textContent = '+' + n;
    p.classList.remove('sube'); void p.offsetWidth; p.classList.add('sube');
  }

  /* ---------- Ciclo de una partida ---------- */
  function nuevaPartida() {
    const s = new Uint32Array(1); crypto.getRandomValues(s);
    E = M.nueva(s[0], CUENTA);
    jugadas = []; fiable = true; tocado = false; terminada = false; vioGano = false;
    accA = accW = 0; corre = false; ultimaA = 0;
    $('fin').hidden = true; $('gano').hidden = true; $('pausa').hidden = true; pausado = false;
    pintaTodo(); pintaMarcador();
    arranca();
    guardaTodo();
  }

  function retoma(j) {
    if (!j || j.u !== CUENTA || j.fin) return false;
    const lista = M.decodifica(j.f);
    if (!lista) return false;
    const r = M.rehace(j.s, j.u, lista);
    if (r.error || !r.vivo) return false;
    E = r.E; jugadas = lista; terminada = false;
    vioGano = !!j.g || E.gano; tocado = !!j.t; fiable = true;
    accA = Math.max(0, +j.a || 0); accW = Math.max(0, +j.w || 0); ultimaA = Math.min(accA, Math.max(0, +j.ua || 0));
    corre = false;
    $('fin').hidden = true; $('gano').hidden = true;
    pintaTodo(); pintaMarcador();
    arranca();
    return true;
  }

  function juega(dir, origen) {
    if (!E || terminada || pausado || !$('gano').hidden) return;
    arranca();
    const r = M.mueve(E, dir);
    if (!r) return;
    /* Cada jugada guarda ms ENTEROS: performance.now trae decimales, y un
       tiempo con decimales no pasa `resultadoClub` (Number.isSafeInteger),
       que tiraba el récord sin avisar. `ultimaA` avanza lo mismo que se
       redondeó, para que la suma no se aleje del reloj. */
    const ahora = reloj().a;
    const dt = Math.min(M.DELTA_MAX, Math.max(0, Math.round(ahora - ultimaA)));
    jugadas.push([dir, origen, dt]);
    ultimaA = dt < M.DELTA_MAX ? ultimaA + dt : ahora;
    if (origen === 'x') fiable = false;
    enSesion++; desdeSubida++;
    anima(r);
    if (r.suma) {
      popSuma(r.suma);
      sonidos.junta(Math.max(...r.fusiones.map(h => E.t[h])));
    } else sonidos.mueve();
    pintaMarcador();
    if (E.gano && !vioGano) {
      vioGano = true;
      sonidos.gana();
      setTimeout(() => { if (!terminada) { $('gano').hidden = false; $('btnSigue').focus(); } }, 260);
    }
    if (!M.puedeMover(E)) { termina(); return; }
    guardaTodo();
    if (desdeSubida >= 20) subeNube();
  }

  // Cierra la partida: guarda el progreso y manda lo que corresponde.
  function cierra(fin) {
    para();
    // Lo mismo que leerá el verificador: las jugadas tal como viajan en la prueba.
    const res = M.rehace(E.semilla, E.u, M.decodifica(M.codifica(jugadas)) || jugadas);
    if (res.error) return { res: null, mejoraPuntos: false, mejoraFicha: false };
    const antes = { mejor: prog.mejor, ficha: prog.ficha, fichaT: prog.fichaT };
    const mejoraFicha = res.ficha > antes.ficha || (res.ficha === antes.ficha && res.ficha > 0 && (!antes.fichaT || res.tFicha < antes.fichaT));
    prog = M.mezclaProgreso(prog, { mejor: res.puntos, ficha: res.ficha, fichaT: res.tFicha, partidas: prog.partidas + 1 });
    reporta(res, fin, mejoraFicha);
    return { res, mejoraPuntos: res.puntos > antes.mejor && res.puntos > 0, mejoraFicha };
  }

  function reporta(res, fin, mejoraFicha) {
    if (!Club || !fiable || tocado || !jugadas.length) return;
    const r = reloj();
    const prueba = { v: 1, s: E.semilla, u: E.u, f: M.codifica(jugadas),
      // Lo jugado sin pausas en los dos relojes: un reloj trucado en uno solo los separa.
      a: Math.round(r.a), w: Math.round(r.w), fin: !!fin };
    if (res.puntos >= 1) Club.result({ categoria: CAT_PUNTOS, puntos: res.puntos, tiempo: res.ms }, prueba);
    if (mejoraFicha && res.ficha >= 4) Club.result({ categoria: CAT_FICHA, puntos: res.ficha, tiempo: res.tFicha }, prueba);
  }

  function termina() {
    terminada = true;
    const { res, mejoraPuntos, mejoraFicha } = cierra(true);
    sonidos.fin();
    $('finTitulo').textContent = E.gano ? '¡PARTIDAZO!' : 'SIN JUGADAS';
    $('finPuntos').textContent = String(E.puntos);
    $('finFicha').textContent = String(M.valor(E.max));
    $('finNuevo').hidden = !(mejoraPuntos || mejoraFicha);
    $('finFrase').textContent = !fiable || tocado
      ? 'Esta partida tuvo jugadas que no hizo una mano: no entra en la clasificación.'
      : res && res.ficha >= 2048 ? 'Llegaste al 2048. Pocas manos llegan ahí.'
        : res && res.ficha >= 1024 ? 'A un paso del 2048.' : 'El tablero se llenó. Otra vuelta.';
    setTimeout(() => { $('gano').hidden = true; $('fin').hidden = false; $('btnOtra').focus(); }, 380);
    pintaMarcador();
    guardaTodo(); subeNube(true);
  }

  function otraPartida() {
    // Reiniciar a mitad cuenta como partida si ya valía algo.
    if (E && !terminada && jugadas.length && E.puntos >= 100) cierra(false);
    nuevaPartida();
    pintaMarcador();
    subeNube(true);
    $('escenario').focus();
  }

  function pausa() {
    if (!E || terminada || pausado) return;
    pausado = true; para();
    $('pausa').hidden = false; $('btnSeguir').focus();
  }
  function sigue() {
    if (!pausado) return;
    pausado = false; $('pausa').hidden = true;
    arranca(); $('escenario').focus();
  }

  /* ---------- Entrada ---------- */
  const hayMando = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(g => g && g.connected); } catch (_) { return false; } };
  const deVerdad = e => !!e && (e.isTrusted || (!!e.__mando && hayMando()));
  const TECLAS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };

  addEventListener('keydown', e => {
    const k = e.code;
    if (k === 'KeyP' || k === 'Escape') {
      if (E && !terminada && $('gano').hidden) { e.preventDefault(); pausado ? sigue() : pausa(); }
      return;
    }
    if (!(k in TECLAS)) return;
    // Un botón con foco se queda con sus teclas, salvo las que manda el mando.
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && !e.__mando && !/^Arrow/.test(k)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (pausado) { sigue(); return; }
    juega(TECLAS[k], !deVerdad(e) ? 'x' : e.__mando ? 'm' : 'k');
  });

  // Deslizar: con el dedo o arrastrando el ratón sobre el tablero.
  const escenario = $('escenario');
  let toque = null;
  escenario.addEventListener('pointerdown', e => {
    if (e.button > 0 || e.target.closest('button')) return;
    toque = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { escenario.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
    escenario.focus({ preventScroll: true });
    arranca();
  });
  function suelta(e) {
    if (!toque || e.pointerId !== toque.id) return;
    const dx = e.clientX - toque.x, dy = e.clientY - toque.y;
    toque = null;
    const min = e.pointerType === 'touch' ? 24 : 30;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
    if (pausado) { sigue(); return; }
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    juega(dir, !deVerdad(e) ? 'x' : e.pointerType === 'touch' ? 't' : 'r');
  }
  escenario.addEventListener('pointerup', suelta);
  escenario.addEventListener('pointercancel', () => { toque = null; });
  escenario.addEventListener('touchstart', e => { if (!e.target.closest('button')) e.preventDefault(); }, { passive: false });
  escenario.addEventListener('touchmove', e => { if (toque) e.preventDefault(); }, { passive: false });
  for (const t of ['selectstart', 'contextmenu', 'dragstart']) escenario.addEventListener(t, e => e.preventDefault());

  $('btnNueva').addEventListener('click', () => {
    if (E && !terminada && jugadas.length > 10 && !confirm('¿Empezar una partida nueva? Esta se da por terminada.')) return;
    otraPartida();
  });
  $('btnOtra').addEventListener('click', otraPartida);
  $('btnSeguir').addEventListener('click', sigue);
  $('btnSigue').addEventListener('click', () => { $('gano').hidden = true; arranca(); escenario.focus(); });

  // Sin cartel: con la pestaña oculta o sin foco el reloj simplemente se para.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { para(); guardaTodo(); subeNube(); } else arranca();
  });
  addEventListener('blur', para);
  addEventListener('focus', arranca);
  addEventListener('pagehide', () => { para(); guardaTodo(); subeNube(); });

  /* ---------- Copia de la cuenta ---------- */
  if (Club && Club.pedirPartida) Club.pedirPartida(dato => {
    let nube = null;
    try { nube = dato && typeof dato.d === 'string' ? JSON.parse(dato.d) : null; } catch (_) { nube = null; }
    if (!nube || typeof nube !== 'object') { subeNube(true); return; }
    prog = M.mezclaProgreso(prog, nube.prog);
    // La partida de la nube gana si es más nueva y aquí todavía no se jugó nada.
    const aqui = juegoGuardable();
    if (nube.juego && enSesion === 0 && (+nube.juego.at || 0) > (local.juego && +local.juego.at || 0)) retoma(nube.juego);
    pintaMarcador(); guardaTodo();
    if (JSON.stringify(blob()) !== JSON.stringify({ v: 1, prog: M.mezclaProgreso(nube.prog, null), juego: nube.juego || null }) || !aqui) subeNube(true);
  });

  /* ---------- Mando ---------- */
  if (window.Mando) {
    window.Mando.configura({
      botones: { start: 'KeyP' },
      objetivo: () => escenario,
      menu: () => terminada || pausado || !$('gano').hidden,
      inicio: () => pausado ? $('btnSeguir') : !$('gano').hidden ? $('btnSigue') : $('btnOtra'),
      pistas: [['cruceta', 'mover'], ['start', 'pausa']],
      zonas: [{ sel: '#nota' }]
    });
  }

  /* ---------- Ganchos para probar desde la consola ----------
     Cualquiera que cambie la partida la marca: se juega, pero no se manda. */
  window.__dosmil = {
    estado: () => ({ pausado, terminada, puntos: E ? E.puntos : 0, max: E ? M.valor(E.max) : 0, jugadas: jugadas.length, t: E ? [...E.t] : [], prog: { ...prog }, reloj: reloj() }),
    mueve(d) { tocado = true; juega(+d, 'x'); },
    pon(t) { if (!E || !Array.isArray(t)) return; tocado = true; for (let i = 0; i < M.CASILLAS; i++) E.t[i] = Math.max(0, t[i] | 0); E.max = Math.max(...E.t); pintaTodo(); pintaMarcador(); },
  };

  /* ---------- Arranque ---------- */
  const tactil = matchMedia('(pointer:coarse)').matches;
  $('nota').innerHTML = (tactil
    ? 'Desliza el dedo por el tablero para mover todas las fichas. Dos iguales que chocan se juntan en una. '
    : '<kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> (o <kbd>WASD</kbd>, o arrastrando) para mover todas las fichas; <kbd>P</kbd> o <kbd>Esc</kbd> para pausar. Dos iguales que chocan se juntan en una. ') +
    (document.documentElement.classList.contains('club-integrado')
      ? 'La partida y tus récords se guardan en tu cuenta.'
      : 'Tus récords viven en este navegador; juega desde Juegos para entrar en la clasificación.');

  function ajustaPantalla() {
    let w = innerWidth, h = innerHeight;
    try { w = window.top.innerWidth; h = window.top.innerHeight; } catch (_) { /* otra página */ }
    const raiz = document.documentElement;
    raiz.style.setProperty('--alto-pantalla', h + 'px');
    raiz.classList.toggle('apaisado', w > h && h < 560);
  }
  ajustaPantalla();
  addEventListener('resize', ajustaPantalla);
  addEventListener('orientationchange', ajustaPantalla);
  try { if (window.top !== window) window.top.addEventListener('resize', ajustaPantalla); } catch (_) { /* nada */ }

  addEventListener('club-rechazo', e => {
    if (e.detail && (e.detail.categoria === CAT_PUNTOS || e.detail.categoria === CAT_FICHA))
      $('finFrase').textContent = 'Esta partida no se guardó: ' + (e.detail.motivo || '');
  });

  if (Club) Club.category(CAT_PUNTOS);
  if (!retoma(local.juego)) nuevaPartida();
  pintaMarcador();
  escenario.focus({ preventScroll: true });
})();
