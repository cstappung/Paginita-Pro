(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  /* El tablero tiene cuatro tamaños; la clasificación es por modo y tamaño,
     y el ritmo multiplica los puntos (×1, ×2, ×3) en vez de partir la tabla
     en tres: con 7 modos × 4 tamaños × 3 ritmos nadie encontraría a nadie. */
  const SIZES = { chico: { cols: 16, rows: 12, label: 'CHICO' }, mediano: { cols: 22, rows: 17, label: 'MEDIANO' }, grande: { cols: 28, rows: 22, label: 'GRANDE' }, gigante: { cols: 40, rows: 30, label: 'GIGANTE' } };
  const SPEED_MULT = { chill: 1, normal: 2, fast: 3 };
  let COLS = 28, ROWS = 22;
  const DIRS = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
  const MODES = {
    classic: { label: 'CLÁSICO', number: '01', title: 'Lo simple tiene su truco.', tip: 'Come las frutas, evita las paredes y no te muerdas la cola. Fácil… al principio.', hint: 'POCO A POCO SE LLEGA LEJOS.' },
    arcade: { label: 'ARCADE', number: '02', title: 'Un poquito de caos.', tip: 'Atrapa poderes: escudo, cámara lenta y puntos dobles. Las frutas doradas valen 50. ¡Ojo con los obstáculos!', hint: 'PODERES, COMBOS Y ALGUNA SORPRESA.' },
    portals: { label: 'PORTALES', number: '03', title: 'Las paredes son puertas.', tip: 'Cruza los bordes y aparecerás al otro lado. Los dos portales están conectados. Tu cola sigue siendo peligrosa.', hint: 'EL CAMINO MÁS CORTO NO ES UNA RECTA.' },
    reloj: { label: 'CONTRARRELOJ', number: '04', title: 'El reloj no espera.', tip: 'Empiezas con 40 segundos. Cada fruta suma 2,5 s y los relojes dorados, 6 s y 30 puntos. Cuando llega a cero, se acabó.', hint: 'CADA BOCADO ES TIEMPO.' },
    espejo: { label: 'ESPEJO', number: '05', title: 'Izquierda es derecha.', tip: 'Cada 5 frutas los controles se invierten (y vuelven). Mientras estás al revés, cada fruta vale 15 en vez de 10.', hint: 'CONFÍA EN LOS DEDOS, NO EN LA CABEZA.' },
    laberinto: { label: 'LABERINTO', number: '06', title: 'Cada nivel, más muros.', tip: 'Cada 6 frutas pasas de nivel y el tablero se llena de muros nuevos. Los bordes llevan al otro lado; los muros no perdonan.', hint: 'LA SALIDA SIEMPRE ESTÁ POR ALGÚN LADO.' },
    zen: { label: 'ZEN', number: '07', title: 'Aquí se viene a fluir.', tip: 'Atraviesa paredes y tu propia cola. La velocidad se mantiene. Respira, recoge frutas y disfruta el camino.', hint: 'NO HAY PRISA. ESTE MOMENTO ES TUYO.' }
  };
  const THEMES = { lime: ['#c1f45a', '#77b83e'], cyan: ['#7fe5ee', '#369aab'], pink: ['#ffacd1', '#b8619a'] };
  const POWER_TYPES = { shield: { icon: '◇', label: 'ESCUDO', color: '#80dbef' }, slow: { icon: '◷', label: 'CÁMARA LENTA', color: '#b6a0fa' }, double: { icon: '×2', label: 'PUNTOS DOBLES', color: '#f5cd72' } };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(window.Club?.storageKey('snake-club-v1') || 'snake-club-v1') || '{}') || {}; } catch (_) { /* Storage is optional. */ }
  let mode = MODES[saved.mode] ? saved.mode : 'classic';
  let speed = ['chill', 'normal', 'fast'].includes(saved.speed) ? saved.speed : 'normal';
  let size = SIZES[saved.size] ? saved.size : 'grande';
  let theme = THEMES[saved.theme] ? saved.theme : 'lime';
  let sound = saved.sound === true;
  let records = saved.records && typeof saved.records === 'object' ? saved.records : {};
  /* La partida vive en el motor puro (motor.js, `SnakeMotor`): la
     serpiente, la fruta, los poderes, el reloj de juego. Aquí queda el
     estado de la pantalla (lista, jugando, en pausa, terminada), el dibujo
     y el sonido. */
  const Motor = window.SnakeMotor;
  let m = Motor.crear({ mode, size, speed, semilla: 0 });
  let state = 'ready', previous = [], particles = [];
  /* Prueba antitrampas (docs/antitrampas/snake.md): la semilla y cada giro
     que entró en la cola, con el tic en que entró. Con eso el verificador
     rehace la partida tic a tic con el mismo motor y saca los puntos y el
     tiempo. `muroMs` son los ms de reloj de pared (Date.now) que pasaron
     jugando, contados fotograma a fotograma con tope de 100 ms cada uno:
     si el reloj del juego avanza mucho menos que eso, alguien frenó el
     tiempo para jugar en cámara lenta. */
  const cuenta = new URLSearchParams(location.search).get('cuenta') || '';
  let giros = '', ultimoGiro = 0, muroMs = 0, muroAntes = 0, pausas = 0;
  let accumulator = 0, lastFrame = 0, visualTime = 0, deathAt = 0, oldBest = 0;
  let cell = 28, width = 784, height = 616, toastTimer, audioContext;
  const same = Motor.same, copy = Motor.copy;
  const bestKey = () => `${mode}-${size}`;
  const category = () => `club-snake-${mode}-${size}`;
  const getBest = () => Number(records[bestKey()]) || 0;
  const pad = n => String(n).padStart(3, '0');

  window.addEventListener('club-record', e => {
    if(e.detail.categoria!==category())return;
    if(e.detail.puntos>getBest()){records[bestKey()]=e.detail.puntos;save();$('best').textContent=pad(getBest());}
  });
  function save() {
    try { localStorage.setItem(window.Club?.storageKey('snake-club-v1') || 'snake-club-v1', JSON.stringify({ mode, speed, size, theme, sound, records })); } catch (_) { /* Private browsing still works. */ }
  }
  function announce(text) { $('announcer').textContent = text; }
  function toast(text) {
    $('toast').textContent = text;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2300);
  }
  /* El sonido es el chip de la sala (juegos/audio). El tema `snake` suena
     solo mientras se juega, al tempo de la velocidad elegida y un poco más
     rápido a cada bocado; la cámara lenta lo frena y en zen se queda sin
     batería. Pausar o perder llama a `detener()`, que calla también las notas
     que el reproductor ya había agendado 0,2 s por delante; reanudar sigue
     donde iba y una partida nueva empieza el tema desde el principio. */
  const TEMPO = { chill: .9, normal: 1, fast: 1.12 };
  let audio = null, musicPlaying = false, musicFresh = true;
  function initAudio() {
    if (!sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!audio && Audio && window.Chip && window.Temas) {
        const c = new Audio(), master = c.createGain(), music = c.createGain(), fx = c.createGain();
        master.gain.value = .6; music.gain.value = .5; fx.gain.value = .75;
        music.connect(master); fx.connect(master); master.connect(c.destination);
        audio = { ctx: c, fx, rep: new window.Chip.Reproductor(c, music, window.Temas.temas.snake) };
      }
      if (audio?.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    } catch (_) { audio = null; /* Audio may be unavailable. */ }
  }
  function tickMusic() {
    if (!audio) return;
    const r = audio.rep;
    if (!sound || state !== 'playing' || audio.ctx.state !== 'running') {
      if (musicPlaying || r.voces.size) r.detener();
      musicPlaying = false; return;
    }
    if (musicFresh) { r.reinicia(); musicFresh = false; }
    musicPlaying = true;
    r.tempo = TEMPO[speed] * (m.activePower?.type === 'slow' ? .82 : 1) + (mode === 'zen' ? 0 : Math.min(m.eaten * .002, .06));
    r.capas.bat = mode === 'zen' ? 0 : 1;
    r.capas.arp = mode === 'zen' || m.eaten >= 6 || m.activePower?.type === 'double' ? 1 : 0;
    try { r.tick(.2); } catch (_) { /* Sound never blocks the game. */ }
  }
  /** Efectos de 8 bits; `n` afina algunos (el combo sube el bocado). */
  function sfx(kind, n = 0) {
    if (!sound || !audio) return;
    try {
      const C = window.Chip, c = audio.ctx, d = audio.fx, t = c.currentTime + .005, H = C.hz;
      const P = (m, dur, o = {}) => C.voz(c, d, Object.assign({ t, f: H(m), dur, vol: .1, onda: 'p25', sus: .8 }, o));
      const N = (dur, o = {}) => C.ruido(c, d, Object.assign({ t, dur, vol: .16 }, o));
      const run = (notes, step, o = {}) => notes.forEach((m, i) => P(m, step * .95, Object.assign({ t: t + i * step }, o)));
      switch (kind) {
        case 'start': run([60, 64, 67, 72, 76, 79], .05, { onda: 'p12', vol: .08 }); P(84, .22, { t: t + .3, vol: .09, onda: 'p50' }); break;
        case 'eat': { const m = 76 + Math.min(12, n); P(m, .05, { onda: 'p12', vol: .09 }); P(m + 7, .08, { t: t + .045, onda: 'p12', vol: .08 }); break; }
        case 'bonus': P(83, .07, { onda: 'p50' }); P(88, .3, { t: t + .07, onda: 'p50', sus: .6 }); run([91, 95, 98], .04, { t: t + .12, onda: 'p12', vol: .05 }); break;
        case 'power': run([72, 76, 79, 84, 88, 91], .04, { vol: .09 }); P(96, .25, { t: t + .24, onda: 'p12', vol: .06, vib: .01 }); break;
        case 'shield': P(88, .12, { onda: 'p50', f1: H(76) }); P(76, .2, { t: t + .12, onda: 'tri', vol: .16, sus: 1 }); N(.12, { vol: .1, corto: true, tono: 1.6 }); break;
        case 'portal': P(55, .22, { onda: 'p12', f1: H(91), vol: .08 }); P(91, .2, { t: t + .12, onda: 'tri', f1: H(67), vol: .12, sus: 1 }); break;
        case 'record': run([72, 76, 79, 84, 79, 84], .09, { vol: .09 }); P(88, .6, { t: t + .54, vol: .09, vib: .008 }); P(48, .9, { t: t + .54, onda: 'tri', vol: .18, sus: 1 }); break;
        case 'die': N(.45, { vol: .2, tono: .9, tono1: .2 }); P(45, .5, { onda: 'tri', f1: H(28), vol: .2, sus: 1 }); run([67, 63, 60, 55], .12, { t: t + .12, vol: .08 }); break;
        case 'on': P(72, .06, { onda: 'p12', vol: .08 }); P(79, .1, { t: t + .06, onda: 'p12', vol: .08 }); break;
      }
    } catch (_) { /* Sound never blocks the game. */ }
  }

  function applySize() {
    COLS = SIZES[size].cols; ROWS = SIZES[size].rows;
    $('board-wrap').style.setProperty('--ar', `${COLS}/${ROWS}`);
    $('board-wrap').style.setProperty('--arn', COLS / ROWS);
    resize();
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height; cell = width / COLS;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);

  function syncSettings() {
    document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-pressed', b.dataset.mode === mode); });
    document.querySelectorAll('[data-speed]').forEach(b => { b.classList.toggle('active', b.dataset.speed === speed); b.setAttribute('aria-pressed', b.dataset.speed === speed); });
    document.querySelectorAll('[data-size]').forEach(b => { b.classList.toggle('active', b.dataset.size === size); b.setAttribute('aria-pressed', b.dataset.size === size); });
    document.querySelectorAll('[data-theme]').forEach(b => { b.classList.toggle('active', b.dataset.theme === theme); b.setAttribute('aria-pressed', b.dataset.theme === theme); });
    const fl = $('fruit-points'); if (fl) fl.textContent = `+${10 * SPEED_MULT[speed]} PTS`;
    document.documentElement.style.setProperty('--accent', THEMES[theme][0]);
    $('board-mode').textContent = `${MODES[mode].number} / ${MODES[mode].label} · ${SIZES[size].label}`;
    $('tip-title').textContent = MODES[mode].title;
    $('tip-text').textContent = MODES[mode].tip;
    $('board-hint').textContent = MODES[mode].hint;
    $('best').textContent = pad(getBest());
    $('sound-button').setAttribute('aria-label', sound ? 'Desactivar sonido' : 'Activar sonido');
    $('sound-button').title = sound ? 'Desactivar sonido' : 'Activar sonido';
    $('sound-button').setAttribute('aria-pressed', sound);
    $('sound-waves').setAttribute('d', sound ? 'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14' : 'm16 9 6 6m0-6-6 6');
  }

  function reset() {
    window.Club?.category(mode === 'zen' ? 'zen' : category());
    m = Motor.crear({ mode, size, speed, semilla: Motor.nuevaSemilla() });
    previous = m.snake.map(copy);
    giros = ''; ultimoGiro = 0; muroMs = 0; muroAntes = 0; pausas = 0;
    particles = []; accumulator = 0; oldBest = getBest();
    $('board-wrap').classList.remove('mirror');
    $('score').textContent = '000'; $('best').textContent = pad(getBest());
    $('power-status').textContent = '';
    $('toast').classList.remove('show'); clearTimeout(toastTimer);
    $('board-wrap').classList.remove('hit');
  }
  function setOverlay(eyebrow, title, description, button, keyHint = 'o pulsa') {
    $('overlay-eyebrow').textContent = eyebrow;
    $('overlay-title').innerHTML = title;
    $('overlay-text').innerHTML = description;
    $('play-label').textContent = button;
    $('keyboard-start').innerHTML = `${keyHint} <kbd>ESPACIO</kbd>`;
    $('overlay').inert = false;
    $('overlay').setAttribute('aria-hidden', 'false');
    $('overlay').classList.remove('hidden');
  }
  function status(text) { $('game-status').innerHTML = `<span class="live-dot"></span> ${text}`; }
  function ready() {
    state = 'ready'; reset();
    $('pause-button').disabled = true;
    $('pause-button').setAttribute('aria-label', 'Pausar partida');
    status('A TU RITMO');
    setOverlay('¿UN DESCANSO RÁPIDO?', 'Sigue tu<br><span>instinto.</span>', 'Un bocado más. Una curva más.<br>Veamos hasta dónde llegas.', 'Vamos a jugar');
  }
  function start() {
    initAudio(); reset(); state = 'playing';
    $('overlay').classList.add('hidden'); $('overlay').inert = true; $('overlay').setAttribute('aria-hidden', 'true'); $('pause-button').disabled = false;
    $('pause-button').setAttribute('aria-label', 'Pausar partida');
    status(mode === 'zen' ? 'TODO FLUYE' : 'EN JUEGO');
    musicFresh = true; sfx('start'); announce('Partida iniciada. Modo ' + MODES[mode].label);
    canvas.focus({ preventScroll: true });
  }
  function pause() {
    if (state !== 'playing' && state !== 'paused') return;
    if (state === 'playing') {
      state = 'paused'; pausas++; status('EN PAUSA');
      $('pause-button').setAttribute('aria-label', 'Continuar partida');
      setOverlay('TÓMATE TU TIEMPO', 'Respira.<br><span>Seguimos.</span>', 'Tu serpiente te espera justo aquí.', 'Continuar');
      announce('Juego en pausa.');
    } else {
      state = 'playing'; accumulator = 0; muroAntes = 0; previous = m.snake.map(copy);
      $('overlay').classList.add('hidden'); $('overlay').inert = true; $('overlay').setAttribute('aria-hidden', 'true'); status(mode === 'zen' ? 'TODO FLUYE' : 'EN JUEGO');
      $('pause-button').setAttribute('aria-label', 'Pausar partida');
      canvas.focus({ preventScroll: true }); initAudio();
    }
  }
  function prueba() {
    return Object.assign({ v: 1, m: mode, t: size, r: speed, s: m.semilla, n: m.ticks, g: giros, w: Math.round(muroMs), p: pausas }, cuenta ? { u: cuenta } : {});
  }
  function finish(win = false) {
    if (state !== 'playing') return;
    state = 'over'; deathAt = visualTime;
    const score = m.score, eaten = m.eaten, gameTime = m.gameTime;
    if (mode !== 'zen' && score > 0) window.Club?.result({categoria:category(),puntos:score,tiempo:Math.max(1,Math.round(gameTime*1000))},prueba());
    $('pause-button').disabled = true;
    if (score > getBest()) { records[bestKey()] = score; save(); }
    const newRecord = score > oldBest;
    $('best').textContent = pad(getBest());
    status(newRecord ? 'NUEVO RÉCORD' : 'BUENA PARTIDA');
    if (!reducedMotion) { $('board-wrap').classList.remove('hit'); void $('board-wrap').offsetWidth; $('board-wrap').classList.add('hit'); }
    burst(m.snake[0], win ? THEMES[theme][0] : '#f19a7e', 28);
    tickMusic(); sfx(win || newRecord ? 'record' : 'die');
    setOverlay(win ? 'TE QUEDASTE CON TODO EL TABLERO' : newRecord ? '✦ NUEVO RÉCORD PERSONAL ✦' : 'LAS BUENAS PARTIDAS PIDEN OTRA', win ? 'Qué<br><span>leyenda.</span>' : '¿Una<br><span>más?</span>', `<strong style="color:#edf4df;font-size:24px">${score} puntos</strong><br>${eaten} bocados · ${Math.floor(gameTime / 60)}:${String(Math.floor(gameTime % 60)).padStart(2, '0')} de puro juego`, 'Volver a jugar');
    announce(`Partida terminada. ${score} puntos.${newRecord ? ' Nuevo récord.' : ''}`);
  }
  /* mando.js despacha teclas sintéticas marcadas con __mando: son
     legítimas si hay un mando conectado de verdad. Un script que despacha
     teclas (isTrusted falso) queda marcado X en la prueba. */
  function hayMando() { try { return Array.from(navigator.getGamepads?.() || []).some(p => p && p.connected !== false); } catch (_) { return false; } }
  function marcas(event) {
    if (!event) return '';
    const toque = event.type && event.type.startsWith('pointer') ? 'T' : '';
    return toque + (event.__mando && hayMando() ? 'M' : event.isTrusted === false ? 'X' : '');
  }
  function enqueue(name, event) {
    if (state !== 'playing') return;
    // Solo se anota lo que entró en la cola; el motor aplica el espejo.
    if (m.enqueue(name)) { giros += Motor.codificaGiro(ultimoGiro, m.ticks, name, marcas(event)); ultimoGiro = m.ticks; }
  }
  function interval() { return m.interval(); }
  function freeCell(extra) { return m.freeCell(extra); }
  function showPoints(total) {
    $('score').textContent = pad(m.score);
    if (m.score > getBest()) { records[bestKey()] = m.score; $('best').textContent = pad(m.score); save(); }
    $('score-pop').textContent = `+${total}`;
    $('score-pop').classList.remove('pop'); void $('score-pop').offsetWidth; $('score-pop').classList.add('pop');
  }
  /* Un tic del motor y lo que eso pinta y suena. Los avisos de combo y de
     bocados van al final, como antes, para que tapen a los demás. */
  function step() {
    if (state !== 'playing') return;
    previous = m.snake.map(copy);
    m.tick();
    let comio = null;
    for (const e of m.ev.splice(0)) {
      if (e.k === 'puntos') showPoints(e.n);
      else if (e.k === 'portal') { burst(e.de, '#9b91f1', 14); burst(e.a, '#83dfcc', 14); sfx('portal'); }
      else if (e.k === 'escudo') { burst(e.p, '#80dbef', 20); toast('¡El escudo te salvó!'); sfx('shield'); }
      else if (e.k === 'come') { burst(e.p, '#f2a086', 13); sfx('eat', e.combo); comio = e; }
      else if (e.k === 'portales') { burst(e.antes[0], '#9b91f1', 10); burst(e.antes[1], '#83dfcc', 10); toast('Los portales se movieron.'); }
      else if (e.k === 'espejo') {
        $('board-wrap').classList.toggle('mirror', e.on); sfx('portal');
        toast(e.on ? '¡Espejo! Los controles se invierten.' : 'Todo vuelve a su sitio.');
      }
      else if (e.k === 'nivel') { sfx('power'); toast(`Nivel ${e.n}. Más muros.`); }
      else if (e.k === 'obstaculo') { burst(e.p, '#829477', 10); toast('Nuevo obstáculo. ¡Busca otro camino!'); }
      else if (e.k === 'dorada') { burst(e.p, '#f7d776', 24); sfx('bonus'); toast(e.reloj ? 'Reloj dorado. ¡+6 segundos!' : 'Fruta dorada. ¡+50 puntos base!'); }
      else if (e.k === 'poder') { burst(e.p, POWER_TYPES[e.type].color, 22); sfx('power'); toast(`${POWER_TYPES[e.type].label} · 10 segundos`); }
      else if (e.k === 'fin') finish(e.win);
    }
    if (comio && state === 'playing') {
      const eaten = m.eaten, combo = comio.combo;
      if (mode === 'arcade' && combo >= 3) toast(`¡Combo ×${combo}! +${10 + (combo - 1) * 2} puntos base`);
      if (eaten === 10 || eaten === 25 || eaten === 50) toast(eaten === 10 ? '10 bocados. Ya le pillaste el ritmo.' : `${eaten} bocados. ¡No hay quien te pare!`);
    }
  }

  function burst(p, color, count) {
    if (reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, velocity = 1.5 + Math.random() * 3;
      particles.push({ x: p.x + .5, y: p.y + .5, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: .45 + Math.random() * .35, max: .8, color, size: .035 + Math.random() * .08 });
    }
  }
  function roundRect(x, y, w, h, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  function drawFruit(p, golden = false) {
    if (!p) return;
    const x = (p.x + .5) * cell, y = (p.y + .5) * cell;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(visualTime * 3 + p.x) * .05;
    ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
    ctx.shadowColor = golden ? '#f7d776' : '#ed997a'; ctx.shadowBlur = cell * (golden ? .6 : .28);
    roundRect(-cell * .29, -cell * .24, cell * .58, cell * .53, cell * .2, golden ? '#f5ce6f' : '#ee987b');
    ctx.shadowBlur = 0;
    ctx.save(); ctx.rotate(-.55); roundRect(cell * .01, -cell * .42, cell * .25, cell * .1, cell * .05, golden ? '#fff1b6' : '#a8c47b'); ctx.restore();
    roundRect(-cell * .18, -cell * .13, cell * .07, cell * .17, cell * .035, '#ffffff60');
    if (golden) { ctx.strokeStyle = '#f7d77655'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, cell * .48, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  function drawPortal(p, index) {
    const x = (p.x + .5) * cell, y = (p.y + .5) * cell;
    const color = index ? '#80d7c4' : '#b1a1f4';
    ctx.save(); ctx.translate(x, y); ctx.rotate(reducedMotion ? 0 : visualTime * (index ? 1 : -1));
    ctx.shadowColor = color; ctx.shadowBlur = cell * .55;
    ctx.strokeStyle = color; ctx.lineWidth = cell * .08;
    ctx.beginPath(); ctx.ellipse(0, 0, cell * .43, cell * .35, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = color + '55'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, cell * .65, .3, 2.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, cell * .65, 3.4, 5.5); ctx.stroke();
    circle(0, 0, cell * .19, color + '22'); ctx.restore();
  }
  function drawPickup() {
    const pickup = m.pickup;
    if (!pickup) return;
    const info = POWER_TYPES[pickup.type], x = (pickup.x + .5) * cell, y = (pickup.y + .5) * cell;
    if (pickup.expires - m.gameTime < 3 && Math.sin(visualTime * 12) < 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.shadowColor = info.color; ctx.shadowBlur = cell * .4;
    roundRect(-cell * .31, -cell * .31, cell * .62, cell * .62, cell * .12, info.color);
    ctx.restore(); ctx.fillStyle = '#1e3028'; ctx.font = `bold ${cell * .4}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(info.icon, x, y + 1);
  }
  function drawSnake(points, heading, opacity = 1) {
    if (!points.length) return;
    const colors = THEMES[theme];
    ctx.save(); ctx.globalAlpha = opacity;
    const gradient = ctx.createLinearGradient(0, height, width, 0); gradient.addColorStop(0, colors[1]); gradient.addColorStop(1, colors[0]);
    ctx.strokeStyle = gradient; ctx.lineWidth = cell * .71; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = colors[0] + '35'; ctx.shadowBlur = cell * .5;
    ctx.beginPath();
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i], next = points[i + 1];
      if (!next || Math.abs(next.x - p.x) + Math.abs(next.y - p.y) > 1.8) ctx.moveTo((p.x + .5) * cell, (p.y + .5) * cell);
      else ctx.lineTo((p.x + .5) * cell, (p.y + .5) * cell);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    // Round endpoints also render isolated segments when passing through a portal.
    for (let i = 0; i < points.length; i++) {
      if (i === 0 || i === points.length - 1 || (points[i + 1] && Math.abs(points[i].x - points[i + 1].x) + Math.abs(points[i].y - points[i + 1].y) > 1.8)) circle((points[i].x + .5) * cell, (points[i].y + .5) * cell, cell * .35, gradient);
    }
    const head = points[0], hx = (head.x + .5) * cell, hy = (head.y + .5) * cell;
    circle(hx, hy, cell * .385, colors[0]);
    if (m.activePower?.type === 'shield' && state !== 'ready') {
      ctx.strokeStyle = '#a6e9f7'; ctx.lineWidth = cell * .06;
      ctx.beginPath(); ctx.arc(hx, hy, cell * .52, 0, Math.PI * 2); ctx.stroke();
    }
    const px = -heading.y, py = heading.x;
    for (const side of [-1, 1]) {
      const ex = hx + heading.x * cell * .13 + px * cell * .19 * side, ey = hy + heading.y * cell * .13 + py * cell * .19 * side;
      circle(ex, ey, cell * .115, '#f9ffe9'); circle(ex + heading.x * cell * .04, ey + heading.y * cell * .04, cell * .057, '#203022');
    }
    ctx.restore();
  }
  function idleSnake() {
    const path = [{ x: 3, y: 6 }, { x: 3, y: 5 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }, { x: 8, y: 4 }, { x: 8, y: 3 }, { x: 8, y: 2 }];
    const wave = reducedMotion ? 0 : Math.sin(visualTime * .85) * .18;
    const sx = COLS / 28, sy = ROWS / 22, sc = p => ({ x: p.x * sx, y: p.y * sy });
    drawSnake(path.map(p => sc({ x: p.x + wave, y: p.y })), DIRS.down, .87);
    const second = [{ x: 23, y: 15 }, { x: 24, y: 15 }, { x: 24, y: 16 }, { x: 24, y: 17 }, { x: 23, y: 17 }, { x: 22, y: 17 }, { x: 21, y: 17 }, { x: 20, y: 17 }, { x: 20, y: 18 }, { x: 20, y: 19 }, { x: 19, y: 19 }, { x: 18, y: 19 }];
    drawSnake(second.map(p => sc({ x: p.x, y: p.y - wave })), DIRS.left, .72);
    drawFruit(sc({ x: 22, y: 4 })); drawFruit(sc({ x: 5, y: 17 }));
    circle(11.5 * sx * cell, 18.5 * sy * cell, cell * .09, '#88a16d55');
  }
  function render() {
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#17271e'; ctx.fillRect(0, 0, width, height);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if ((x + y) % 2 === 0) { ctx.fillStyle = '#ffffff02'; ctx.fillRect(x * cell, y * cell, cell, cell); }
      circle((x + .5) * cell, (y + .5) * cell, .65, '#7b967922');
    }
    const vignette = ctx.createRadialGradient(width / 2, height / 2, width * .1, width / 2, height / 2, width * .65);
    vignette.addColorStop(0, '#00000000'); vignette.addColorStop(1, '#07160c45'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
    if (state === 'ready') { idleSnake(); return; }
    m.portals.forEach(drawPortal);
    for (const p of m.obstacles) {
      roundRect((p.x + .13) * cell, (p.y + .13) * cell, cell * .74, cell * .74, cell * .16, '#63745a');
      roundRect((p.x + .24) * cell, (p.y + .24) * cell, cell * .52, cell * .11, cell * .04, '#829375');
    }
    if (m.mirrored) { ctx.fillStyle = '#9b91f114'; ctx.fillRect(0, 0, width, height); }
    drawFruit(m.fruit);
    if (m.bonus && (m.bonus.expires - m.gameTime > 3 || Math.sin(visualTime * 12) > 0)) drawFruit(m.bonus, true);
    drawPickup();
    const alpha = state === 'playing' ? Math.min(1, accumulator / interval()) : 1;
    const points = m.snake.map((p, i) => {
      const old = previous[Math.min(i, previous.length - 1)] || p;
      if (Math.abs(old.x - p.x) + Math.abs(old.y - p.y) > 1.8) return p;
      return { x: old.x + (p.x - old.x) * alpha, y: old.y + (p.y - old.y) * alpha };
    });
    drawSnake(points, m.direction, state === 'over' ? .6 : 1);
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); circle(p.x * cell, p.y * cell, p.size * cell, p.color); }
    ctx.globalAlpha = 1;
    if (!reducedMotion && state === 'over' && visualTime - deathAt < .35) { ctx.fillStyle = `rgba(240,153,123,${(.35 - (visualTime - deathAt)) * .35})`; ctx.fillRect(0, 0, width, height); }
  }
  function frame(time) {
    const dt = Math.min((time - (lastFrame || time)) / 1000, .06); lastFrame = time; visualTime += dt;
    if (state === 'playing') {
      accumulator += dt;
      const ahora = Date.now();
      if (muroAntes) muroMs += Math.min(100, Math.max(0, ahora - muroAntes));
      muroAntes = ahora;
      let tick = interval();
      while (accumulator >= tick && state === 'playing') { accumulator -= tick; step(); tick = interval(); }
      // El contrarreloj baja de a tic en el motor; aquí se muestra continuo.
      const ap = m.activePower, resta = Math.max(0, m.timeLeft - (state === 'playing' ? accumulator : 0));
      $('power-status').textContent = mode === 'reloj' ? `⏱ ${resta.toFixed(1)}s` : mode === 'laberinto' ? `NIVEL ${m.level}` : mode === 'espejo' && m.mirrored ? '⇄ CONTROLES INVERTIDOS' : ap ? `${POWER_TYPES[ap.type].icon} ${POWER_TYPES[ap.type].label} ${Math.ceil(ap.expires - m.gameTime)}s` : '';
    }
    if (state !== 'paused') {
      for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.2, dt); p.vy *= Math.pow(.2, dt); }
      particles = particles.filter(p => p.life > 0);
    }
    tickMusic(); render(); requestAnimationFrame(frame);
  }

  $('play-button').addEventListener('click', () => state === 'paused' ? pause() : start());
  $('pause-button').addEventListener('click', pause);
  $('sound-button').addEventListener('click', () => { sound = !sound; initAudio(); syncSettings(); save(); if (sound) sfx('on'); });
  $('fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.querySelector('.play-section').requestFullscreen) await document.querySelector('.play-section').requestFullscreen();
      else toast('La pantalla completa no está disponible aquí.');
    } catch (_) { toast('La pantalla completa no está disponible aquí.'); }
  });
  document.addEventListener('fullscreenchange', () => { $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa'); resize(); });
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    if (mode === b.dataset.mode) return;
    mode = b.dataset.mode; syncSettings(); save(); ready(); announce('Modo ' + MODES[mode].label + ' seleccionado.');
  }));
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
    if (speed === b.dataset.speed) return;
    speed = b.dataset.speed; syncSettings(); save(); ready();
  }));
  document.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => {
    if (size === b.dataset.size) return;
    size = b.dataset.size; applySize(); syncSettings(); save(); ready();
  }));
  document.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => { theme = b.dataset.theme; syncSettings(); save(); }));
  document.querySelectorAll('[data-direction]').forEach(b => b.addEventListener('pointerdown', e => {
    e.preventDefault(); if (state === 'ready' || state === 'over') start(); enqueue(b.dataset.direction, e);
  }));
  /* iOS: que una pulsación larga no seleccione la flecha ni abra el menú. */
  document.querySelectorAll('[data-direction]').forEach(b => {
    b.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    b.addEventListener('contextmenu', e => e.preventDefault());
    b.addEventListener('selectstart', e => e.preventDefault());
  });
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    const map = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    if (map[key]) { e.preventDefault(); enqueue(map[key], e); }
    else if (key === ' ') {
      if (e.target.tagName === 'BUTTON' && !['play-button', 'pause-button'].includes(e.target.id)) return;
      e.preventDefault(); if (e.repeat) return;
      if (state === 'playing' || state === 'paused') pause(); else start();
    } else if (key === 'p' || key === 'escape') { e.preventDefault(); if (!e.repeat) pause(); }
    else if (key === 'r' && !e.repeat) { e.preventDefault(); start(); }
  });
  let touch = null;
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; touch = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!touch) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return;
    enqueue(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), e);
    touch = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { touch = null; });
  canvas.addEventListener('pointercancel', () => { touch = null; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  window.addEventListener('blur', () => { if (state === 'playing') pause(); });
  /* Mando de consola (juegos/audio/mando.js): cruceta o stick para moverse,
     A empieza o pausa como Espacio, Start pausa, X reinicia. Select da el
     cursor para tocar los ajustes. */
  if (window.Mando) window.Mando.configura({
    botones: { a: 'Space', start: 'KeyP', x: 'KeyR' },
    pistas: [['dpad stickL', 'moverte'], ['a', 'empezar'], ['start', 'pausa'], ['x', 'reinicia']],
    zonas: [{ sel: '.controls-caption' }, { sel: '#keyboard-start', prefijo: 'o pulsa ', pistas: [['a', '']] }]
  });
  applySize(); syncSettings(); ready(); requestAnimationFrame(frame);
})();
