(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const COLS = 28, ROWS = 22;
  const DIRS = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
  const MODES = {
    classic: { label: 'CLÁSICO', number: '01', title: 'Lo simple tiene su truco.', tip: 'Come las frutas, evita las paredes y no te muerdas la cola. Fácil… al principio.', hint: 'POCO A POCO SE LLEGA LEJOS.' },
    arcade: { label: 'ARCADE', number: '02', title: 'Un poquito de caos.', tip: 'Atrapa poderes: escudo, cámara lenta y puntos dobles. Las frutas doradas valen 50. ¡Ojo con los obstáculos!', hint: 'PODERES, COMBOS Y ALGUNA SORPRESA.' },
    portals: { label: 'PORTALES', number: '03', title: 'Las paredes son puertas.', tip: 'Cruza los bordes y aparecerás al otro lado. Los dos portales están conectados. Tu cola sigue siendo peligrosa.', hint: 'EL CAMINO MÁS CORTO NO ES UNA RECTA.' },
    zen: { label: 'ZEN', number: '04', title: 'Aquí se viene a fluir.', tip: 'Atraviesa paredes y tu propia cola. La velocidad se mantiene. Respira, recoge frutas y disfruta el camino.', hint: 'NO HAY PRISA. ESTE MOMENTO ES TUYO.' }
  };
  const THEMES = { lime: ['#c1f45a', '#77b83e'], cyan: ['#7fe5ee', '#369aab'], pink: ['#ffacd1', '#b8619a'] };
  const POWER_TYPES = { shield: { icon: '◇', label: 'ESCUDO', color: '#80dbef' }, slow: { icon: '◷', label: 'CÁMARA LENTA', color: '#b6a0fa' }, double: { icon: '×2', label: 'PUNTOS DOBLES', color: '#f5cd72' } };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(window.Club?.storageKey('snake-club-v1') || 'snake-club-v1') || '{}') || {}; } catch (_) { /* Storage is optional. */ }
  let mode = MODES[saved.mode] ? saved.mode : 'classic';
  let speed = ['chill', 'normal', 'fast'].includes(saved.speed) ? saved.speed : 'normal';
  let theme = THEMES[saved.theme] ? saved.theme : 'lime';
  let sound = saved.sound === true;
  let records = saved.records && typeof saved.records === 'object' ? saved.records : {};
  let state = 'ready', snake = [], previous = [], direction = DIRS.right, queue = [];
  let score = 0, eaten = 0, fruit = null, bonus = null, pickup = null, obstacles = [], portals = [];
  let activePower = null, particles = [], combo = 0, lastEat = -100, gameTime = 0;
  let accumulator = 0, lastFrame = 0, visualTime = 0, deathAt = 0, oldBest = 0;
  let cell = 28, width = 784, height = 616, toastTimer, audioContext;
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
  const copy = p => ({ x: p.x, y: p.y });
  const bestKey = () => `${mode}-${speed}`;
  const getBest = () => Number(records[bestKey()]) || 0;
  const pad = n => String(n).padStart(3, '0');

  window.addEventListener('club-record', e => {
    if(e.detail.categoria!==`club-snake-${mode}-${speed}`)return;
    if(e.detail.puntos>getBest()){records[bestKey()]=e.detail.puntos;save();$('best').textContent=pad(getBest());}
  });
  function save() {
    try { localStorage.setItem(window.Club?.storageKey('snake-club-v1') || 'snake-club-v1', JSON.stringify({ mode, speed, theme, sound, records })); } catch (_) { /* Private browsing still works. */ }
  }
  function announce(text) { $('announcer').textContent = text; }
  function toast(text) {
    $('toast').textContent = text;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2300);
  }
  function initAudio() {
    if (!sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!audioContext && Audio) audioContext = new Audio();
      if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (_) { /* Audio may be unavailable. */ }
  }
  function tone(freq, duration = .1, type = 'sine', volume = .045, delay = 0) {
    if (!sound || !audioContext) return;
    try {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      const time = audioContext.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(.001, time + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(time); oscillator.stop(time + duration);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch (_) { /* Sound never blocks the game. */ }
  }
  function melody(notes) { notes.forEach((f, i) => tone(f, .15, 'sine', .04, i * .075)); }

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
    document.querySelectorAll('[data-theme]').forEach(b => { b.classList.toggle('active', b.dataset.theme === theme); b.setAttribute('aria-pressed', b.dataset.theme === theme); });
    document.documentElement.style.setProperty('--accent', THEMES[theme][0]);
    $('board-mode').textContent = `${MODES[mode].number} / ${MODES[mode].label}`;
    $('tip-title').textContent = MODES[mode].title;
    $('tip-text').textContent = MODES[mode].tip;
    $('board-hint').textContent = MODES[mode].hint;
    $('best').textContent = pad(getBest());
    $('sound-button').setAttribute('aria-label', sound ? 'Desactivar sonido' : 'Activar sonido');
    $('sound-button').title = sound ? 'Desactivar sonido' : 'Activar sonido';
    $('sound-button').setAttribute('aria-pressed', sound);
    $('sound-waves').setAttribute('d', sound ? 'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14' : 'm16 9 6 6m0-6-6 6');
  }

  function freeCell(extra = []) {
    const occupied = [...snake, ...obstacles, ...portals, ...extra, fruit, bonus, pickup].filter(Boolean);
    const free = [];
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      const p = { x, y };
      if (!occupied.some(o => same(o, p))) free.push(p);
    }
    // The outer ring becomes available when the inner board fills up.
    if (!free.length) for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const p = { x, y };
      if (!occupied.some(o => same(o, p))) free.push(p);
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }
  function reset() {
    window.Club?.category(mode === 'zen' ? 'zen' : `club-snake-${mode}-${speed}`);
    snake = Array.from({ length: 5 }, (_, i) => ({ x: 8 - i, y: 11 }));
    previous = snake.map(copy); direction = DIRS.right; queue = [];
    score = 0; eaten = 0; gameTime = 0; combo = 0; lastEat = -100;
    fruit = null; bonus = null; pickup = null; activePower = null; obstacles = [];
    portals = mode === 'portals' ? [{ x: 6, y: 5 }, { x: 21, y: 16 }] : [];
    particles = []; accumulator = 0; oldBest = getBest();
    fruit = { x: 18, y: 11 };
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
    melody([330, 440, 660]); announce('Partida iniciada. Modo ' + MODES[mode].label);
    canvas.focus({ preventScroll: true });
  }
  function pause() {
    if (state !== 'playing' && state !== 'paused') return;
    if (state === 'playing') {
      state = 'paused'; status('EN PAUSA');
      $('pause-button').setAttribute('aria-label', 'Continuar partida');
      setOverlay('TÓMATE TU TIEMPO', 'Respira.<br><span>Seguimos.</span>', 'Tu serpiente te espera justo aquí.', 'Continuar');
      announce('Juego en pausa.');
    } else {
      state = 'playing'; accumulator = 0; previous = snake.map(copy);
      $('overlay').classList.add('hidden'); $('overlay').inert = true; $('overlay').setAttribute('aria-hidden', 'true'); status(mode === 'zen' ? 'TODO FLUYE' : 'EN JUEGO');
      $('pause-button').setAttribute('aria-label', 'Pausar partida');
      canvas.focus({ preventScroll: true }); initAudio();
    }
  }
  function finish(win = false) {
    if (state !== 'playing') return;
    state = 'over'; deathAt = visualTime;
    if (mode !== 'zen' && score > 0) window.Club?.result({categoria:`club-snake-${mode}-${speed}`,puntos:score,tiempo:Math.max(1,Math.round(gameTime*1000))});
    $('pause-button').disabled = true;
    if (score > getBest()) { records[bestKey()] = score; save(); }
    const newRecord = score > oldBest;
    $('best').textContent = pad(getBest());
    status(newRecord ? 'NUEVO RÉCORD' : 'BUENA PARTIDA');
    if (!reducedMotion) { $('board-wrap').classList.remove('hit'); void $('board-wrap').offsetWidth; $('board-wrap').classList.add('hit'); }
    burst(snake[0], win ? THEMES[theme][0] : '#f19a7e', 28);
    if (win || newRecord) melody([523, 659, 784, 1047]); else { tone(180, .22, 'triangle'); tone(100, .3, 'triangle', .045, .13); }
    setOverlay(win ? 'TE QUEDASTE CON TODO EL TABLERO' : newRecord ? '✦ NUEVO RÉCORD PERSONAL ✦' : 'LAS BUENAS PARTIDAS PIDEN OTRA', win ? 'Qué<br><span>leyenda.</span>' : '¿Una<br><span>más?</span>', `<strong style="color:#edf4df;font-size:24px">${score} puntos</strong><br>${eaten} bocados · ${Math.floor(gameTime / 60)}:${String(Math.floor(gameTime % 60)).padStart(2, '0')} de puro juego`, 'Volver a jugar');
    announce(`Partida terminada. ${score} puntos.${newRecord ? ' Nuevo récord.' : ''}`);
  }
  function enqueue(name) {
    if (state !== 'playing' || queue.length >= 2) return;
    const next = DIRS[name], last = queue.length ? queue[queue.length - 1] : direction;
    if (!next || same(next, last) || (next.x === -last.x && next.y === -last.y)) return;
    queue.push(next);
  }
  function interval() {
    const base = { chill: .175, normal: .125, fast: .087 }[speed];
    const acceleration = mode === 'zen' ? 0 : Math.min(eaten * .0015, .038);
    return Math.max(.055, base - acceleration) * (activePower?.type === 'slow' ? 1.65 : 1);
  }
  function addPoints(amount) {
    const multiplier = activePower?.type === 'double' ? 2 : 1;
    const total = amount * multiplier;
    score += total; $('score').textContent = pad(score);
    if (score > getBest()) { records[bestKey()] = score; $('best').textContent = pad(score); save(); }
    $('score-pop').textContent = `+${total}`;
    $('score-pop').classList.remove('pop'); void $('score-pop').offsetWidth; $('score-pop').classList.add('pop');
  }
  function spawnArcadeExtras() {
    if (eaten % 3 === 0 && !pickup) {
      const p = freeCell();
      if (p) pickup = { ...p, type: ['shield', 'slow', 'double'][Math.floor(Math.random() * 3)], expires: gameTime + 14 };
    }
    if (eaten % 4 === 0 && !bonus) { const p = freeCell(); if (p) bonus = { ...p, expires: gameTime + 9 }; }
    if (eaten % 6 === 0 && obstacles.length < 24) {
      const candidates = [];
      for (let n = 0; n < 40; n++) {
        const p = freeCell(candidates);
        if (p && Math.abs(p.x - snake[0].x) + Math.abs(p.y - snake[0].y) > 6) { candidates.push(p); break; }
      }
      if (candidates.length) { obstacles.push(...candidates); burst(candidates[0], '#829477', 10); toast('Nuevo obstáculo. ¡Busca otro camino!'); }
    }
  }
  function step() {
    previous = snake.map(copy);
    if (queue.length) direction = queue.shift();
    let head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const outside = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
    const shield = activePower?.type === 'shield';
    if (outside) {
      if (mode === 'zen' || mode === 'portals' || shield) {
        head.x = (head.x + COLS) % COLS; head.y = (head.y + ROWS) % ROWS;
        if (shield && mode !== 'zen' && mode !== 'portals') consumeShield();
      } else { finish(); return; }
    }
    if (mode === 'portals') {
      const portalIndex = portals.findIndex(p => same(p, head));
      if (portalIndex !== -1) { burst(head, '#9b91f1', 14); head = copy(portals[1 - portalIndex]); burst(head, '#83dfcc', 14); tone(420, .2, 'sine'); tone(840, .2, 'sine', .03, .06); }
    }
    const eatsFruit = same(head, fruit), eatsBonus = same(head, bonus), grows = eatsFruit || eatsBonus;
    const body = grows ? snake : snake.slice(0, -1);
    const bodyHit = body.some(p => same(p, head)), obstacleHit = obstacles.some(p => same(p, head));
    if (mode !== 'zen' && (bodyHit || obstacleHit)) {
      if (activePower?.type === 'shield') {
        consumeShield();
        if (bodyHit) snake = snake.slice(0, Math.max(1, snake.findIndex(p => same(p, head))));
        if (obstacleHit) obstacles = obstacles.filter(p => !same(p, head));
      } else { finish(); return; }
    }
    snake.unshift(head);
    if (!grows) snake.pop();
    // Keep Zen bounded for indefinitely long sessions, without ending the run.
    if (mode === 'zen' && snake.length > 130) snake.pop();
    if (eatsFruit) {
      eaten++; combo = gameTime - lastEat < 4 ? Math.min(combo + 1, 5) : 1; lastEat = gameTime;
      addPoints(mode === 'arcade' ? 10 + (combo - 1) * 2 : 10);
      burst(head, '#f2a086', 13); melody([500 + combo * 65, 700 + combo * 65]);
      fruit = null; fruit = freeCell();
      if (!fruit) { finish(true); return; }
      if (mode === 'arcade') { spawnArcadeExtras(); if (combo >= 3) toast(`¡Combo ×${combo}! +${10 + (combo - 1) * 2} puntos base`); }
      if (eaten === 10 || eaten === 25 || eaten === 50) toast(eaten === 10 ? '10 bocados. Ya le pillaste el ritmo.' : `${eaten} bocados. ¡No hay quien te pare!`);
    }
    if (eatsBonus) { addPoints(50); burst(head, '#f7d776', 24); bonus = null; melody([660, 880, 1100]); toast('Fruta dorada. ¡+50 puntos base!'); }
    if (same(head, pickup)) {
      activePower = { type: pickup.type, expires: gameTime + 10 }; pickup = null;
      burst(head, POWER_TYPES[activePower.type].color, 22); melody([440, 660, 880]);
      toast(`${POWER_TYPES[activePower.type].label} · 10 segundos`);
    }
  }
  function consumeShield() { activePower = null; burst(snake[0], '#80dbef', 20); toast('¡El escudo te salvó!'); melody([880, 440]); }

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
    if (!pickup) return;
    const info = POWER_TYPES[pickup.type], x = (pickup.x + .5) * cell, y = (pickup.y + .5) * cell;
    if (pickup.expires - gameTime < 3 && Math.sin(visualTime * 12) < 0) return;
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
    if (activePower?.type === 'shield' && state !== 'ready') {
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
    drawSnake(path.map(p => ({ x: p.x + wave, y: p.y })), DIRS.down, .87);
    const second = [{ x: 23, y: 15 }, { x: 24, y: 15 }, { x: 24, y: 16 }, { x: 24, y: 17 }, { x: 23, y: 17 }, { x: 22, y: 17 }, { x: 21, y: 17 }, { x: 20, y: 17 }, { x: 20, y: 18 }, { x: 20, y: 19 }, { x: 19, y: 19 }, { x: 18, y: 19 }];
    drawSnake(second.map(p => ({ x: p.x, y: p.y - wave })), DIRS.left, .72);
    drawFruit({ x: 22, y: 4 }); drawFruit({ x: 5, y: 17 });
    circle(11.5 * cell, 18.5 * cell, cell * .09, '#88a16d55');
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
    portals.forEach(drawPortal);
    for (const p of obstacles) {
      roundRect((p.x + .13) * cell, (p.y + .13) * cell, cell * .74, cell * .74, cell * .16, '#63745a');
      roundRect((p.x + .24) * cell, (p.y + .24) * cell, cell * .52, cell * .11, cell * .04, '#829375');
    }
    drawFruit(fruit);
    if (bonus && (bonus.expires - gameTime > 3 || Math.sin(visualTime * 12) > 0)) drawFruit(bonus, true);
    drawPickup();
    const alpha = state === 'playing' ? Math.min(1, accumulator / interval()) : 1;
    const points = snake.map((p, i) => {
      const old = previous[Math.min(i, previous.length - 1)] || p;
      if (Math.abs(old.x - p.x) + Math.abs(old.y - p.y) > 1.8) return p;
      return { x: old.x + (p.x - old.x) * alpha, y: old.y + (p.y - old.y) * alpha };
    });
    drawSnake(points, direction, state === 'over' ? .6 : 1);
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); circle(p.x * cell, p.y * cell, p.size * cell, p.color); }
    ctx.globalAlpha = 1;
    if (!reducedMotion && state === 'over' && visualTime - deathAt < .35) { ctx.fillStyle = `rgba(240,153,123,${(.35 - (visualTime - deathAt)) * .35})`; ctx.fillRect(0, 0, width, height); }
  }
  function frame(time) {
    const dt = Math.min((time - (lastFrame || time)) / 1000, .06); lastFrame = time; visualTime += dt;
    if (state === 'playing') {
      gameTime += dt; accumulator += dt;
      if (activePower && gameTime >= activePower.expires) activePower = null;
      if (bonus && gameTime >= bonus.expires) bonus = null;
      if (pickup && gameTime >= pickup.expires) pickup = null;
      $('power-status').textContent = activePower ? `${POWER_TYPES[activePower.type].icon} ${POWER_TYPES[activePower.type].label} ${Math.ceil(activePower.expires - gameTime)}s` : '';
      let tick = interval();
      while (accumulator >= tick && state === 'playing') { accumulator -= tick; step(); tick = interval(); }
    }
    if (state !== 'paused') {
      for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.2, dt); p.vy *= Math.pow(.2, dt); }
      particles = particles.filter(p => p.life > 0);
    }
    render(); requestAnimationFrame(frame);
  }

  $('play-button').addEventListener('click', () => state === 'paused' ? pause() : start());
  $('pause-button').addEventListener('click', pause);
  $('sound-button').addEventListener('click', () => { sound = !sound; initAudio(); syncSettings(); save(); if (sound) melody([440, 660]); });
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
  document.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => { theme = b.dataset.theme; syncSettings(); save(); }));
  document.querySelectorAll('[data-direction]').forEach(b => b.addEventListener('pointerdown', e => {
    e.preventDefault(); if (state === 'ready' || state === 'over') start(); enqueue(b.dataset.direction);
  }));
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    const map = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    if (map[key]) { e.preventDefault(); enqueue(map[key]); }
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
    enqueue(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    touch = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { touch = null; });
  canvas.addEventListener('pointercancel', () => { touch = null; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  window.addEventListener('blur', () => { if (state === 'playing') pause(); });
  syncSettings(); ready(); resize(); requestAnimationFrame(frame);
})();
