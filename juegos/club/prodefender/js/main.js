// =====================================================================
//  PRO DEFENDER — Interfaz, pantallas, guardado y bucle principal
// =====================================================================
(function () {
  const PD = globalThis.PD;
  const W = PD.W, H = PD.H, STEP = 1 / 60;
  const $ = s => document.querySelector(s);
  const fmt = n => Math.floor(n).toLocaleString('es-ES');
  // Dentro de Juegos el guardado es de cada cuenta (conexion.js: Club.storageKey).
  const CLUB = window.Club || null;
  const SAVE_KEY = CLUB ? CLUB.storageKey('prodefender.save.v1') : 'prodefender.save.v1';
  const PARAMS = new URLSearchParams(location.search);
  const CUENTA = PARAMS.get('cuenta') || 'local';
  const EMBEBIDO = window.parent !== window, INVITADO = PARAMS.get('invitado') === '1';
  const EN_LA_NUBE = !!CLUB && EMBEBIDO && !INVITADO;
  const PR = PD.Prueba;
  // Monedas de Juegos: cada ronda nueva de tu récord en un reino paga 20 × el número del reino.
  const monedasRonda = li => 20 * (li + 1);
  const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'g'];
  const MODES = [['first', 'Primero'], ['last', 'Último'], ['strong', 'Fuerte'], ['close', 'Cerca']];
  const ABIL_ICON = { absolute: '❄', judgement: '⚡', meteors: '☄', supernova: '✹', blackhole: '◉', treasure: '◆', wardrum: '♫', inferno: '♨' };
  const DTYPE = { phys: 'Físico', explosive: 'Explosivo', ice: 'Hielo', elec: 'Eléctrico', fire: 'Fuego', arcane: 'Arcano', poison: 'Ácido', steam: 'Vapor' };
  const realmTowers = li => PD.towersFor(li).filter(id => PD.TOWERS[id].realm === li);

  // ------------------------------ Guardado -------------------------------
  function defaultSave() { return { v: 1, unlocked: 0, best: [0, 0, 0, 0, 0], won: [false, false, false, false, false], runs: {}, settings: { auto: false, muted: false, sfx: 0.8, music: 0.45 } }; }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.v === 1) {
        const d = defaultSave(); const o = Object.assign(d, s); o.settings = Object.assign(defaultSave().settings, s.settings || {});
        // Una partida guardada sin su prueba (o con la de otro motor) no se puede verificar: se descarta.
        for (const k of Object.keys(o.runs || {})) { const r = o.runs[k]; if (!r || !r.snap || !r.pr || r.pr.ve !== PR.VERSION) delete o.runs[k]; }
        return o;
      }
    } catch (e) { /* sin almacenamiento disponible */ }
    return defaultSave();
  }
  let save = loadSave();
  function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignorar */ } }

  // -------------------------------- Sonido --------------------------------
  const AU = PD.Audio;
  AU.setVolumes(save.settings.sfx, save.settings.music);
  AU.setMuted(!!save.settings.muted);
  const sfx = (n, x) => AU.play(n, x);
  function unlockAudio() { AU.init(); }
  window.addEventListener('pointerdown', unlockAudio, true);
  window.addEventListener('keydown', unlockAudio, true);
  function setMuted(m) {
    save.settings.muted = m; writeSave(); AU.setMuted(m);
    document.querySelectorAll('.mute').forEach(b => { b.classList.toggle('off', m); b.textContent = (m ? '🔇' : '🔊') + (b.id === 'btn-mute-menu' ? (m ? ' Sin sonido' : ' Sonido') : ''); });
  }
  document.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b && !b.classList.contains('mute')) sfx('click'); }, true);

  // ------------------------------- Estado --------------------------------
  let game = null, rec = null;   // rec: la Grabadora (prueba.js); game === rec.game
  const ui = { vt: 0, placing: null, selected: null, mouse: null, speed: 1, paused: false, auto: !!save.settings.auto, autoT: -1, modal: false };
  let screen = 'menu';

  // ------------------------------ Utilidades -----------------------------
  function towerIcon(canvas, type, tiers) {
    const c = canvas.getContext('2d'), s = canvas.width, def = PD.TOWERS[type];
    c.clearRect(0, 0, s, s);
    const box = def.size * 2 + 18 + PD.towerRank(tiers || [0, 0]) * 7;
    c.save(); c.scale(s / box, s / box);
    PD.drawTower(c, type, box / 2, box / 2, -Math.PI / 4, tiers || [0, 0], { icon: true, noPips: true, time: 0 });
    c.restore();
  }
  function enemyIcon(canvas, type) {
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    PD.drawEnemyIcon(c, type, canvas.width, 0.3);
  }
  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
    screen = id;
    hideTip();
    AU.playMusic(id === 'game' && game ? game.li : 'menu');
    if (id !== 'game') AU.setIntensity(0);
    if (id === 'levels') buildLevels();
    if (id === 'almanac') buildAlmanac(almTab);
    if (id === 'game') requestAnimationFrame(resize);
  }
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));

  // ------------------------------- Toasts --------------------------------
  function toast(html, cls, icon, dur) {
    const box = $('#toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    const t = el(`<div class="toast ${cls || ''}">${icon ? '<canvas width="84" height="84"></canvas>' : ''}<div>${html}</div></div>`);
    if (icon) { const c = t.querySelector('canvas'); if (icon.enemy) enemyIcon(c, icon.enemy); else towerIcon(c, icon.tower); }
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, dur || 4200);
  }

  // -------------------------------- Modal --------------------------------
  function modal(html, buttons) {
    const box = $('#modal-box');
    box.innerHTML = html + '<div class="acts"></div>';
    const acts = box.querySelector('.acts');
    for (const b of buttons) {
      const btn = el(`<button class="btn ${b.cls || ''}">${b.label}</button>`);
      btn.addEventListener('click', () => { closeModal(); b.fn && b.fn(); });
      acts.appendChild(btn);
    }
    $('#modal').classList.remove('hidden');
    ui.modal = true;
  }
  function closeModal() { $('#modal').classList.add('hidden'); ui.modal = false; }

  // ------------------------------- Tooltip -------------------------------
  const tip = $('#tooltip');
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.classList.remove('hidden');
    const r = tip.getBoundingClientRect();
    let tx = x - r.width - 14, ty = y - 10;
    if (tx < 8) tx = x + 16;
    if (ty + r.height > innerHeight - 8) ty = innerHeight - r.height - 8;
    tip.style.left = tx + 'px'; tip.style.top = Math.max(8, ty) + 'px';
  }
  function hideTip() { tip.classList.add('hidden'); }

  // ============================== MENÚ ===================================
  let demo = null, demoT = 0;
  const MR = Object.create(PD.Render); MR.bg = null; MR.bgKey = ''; MR.gates = null; MR.lastT = 0;
  const menuCv = $('#menu-bg'), menuCtx = menuCv.getContext('2d');
  menuCv.width = 1000; menuCv.height = 640;
  menuCv.style.objectFit = 'cover';
  function initDemo() {
    demo = new PD.Game(0);
    demo.lives = 1e12; demo.money = 1e12;
    const plan = [['espinas', [2, 0]], ['escarcha', [0, 2]], ['voltaico', [3, 0]], ['dragon', [2, 1]], ['prisma', [0, 2]], ['vigia', [2, 2]], ['colmena', [3, 0]], ['mortero', [0, 3]], ['espinas', [0, 3]], ['sembrador', [2, 0]]];
    const cands = [];
    for (let x = 40; x < 980; x += 30) for (let y = 40; y < 620; y += 30) cands.push([x, y]);
    for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
    let ci = 0;
    for (const [type, tiers] of plan) {
      while (ci < cands.length) {
        const [x, y] = cands[ci++];
        let near = false;
        for (const s of demo.paths[0].segs) if (PD.distSeg(x, y, s.ax, s.ay, s.bx, s.by) < 70) near = true;
        if (near && demo.canPlace(type, x, y)) {
          const t = demo.place(type, x, y);
          for (let p = 0; p < 2; p++) for (let k = 0; k < tiers[p]; k++) demo.upgrade(t, p);
          break;
        }
      }
    }
  }
  const DEMO_TYPES = ['brote', 'veloz', 'robusto', 'alado', 'escudero', 'musgo', 'chaman', 'enjambre', 'blindado', 'divisor', 'sombra'];
  function demoFrame(dt) {
    if (!demo) initDemo();
    demoT -= dt;
    if (demoT <= 0) { demoT = 0.45; demo.spawn(DEMO_TYPES[Math.floor(Math.random() * DEMO_TYPES.length)], 0, 0, 7); }
    demo.update(dt);
    demo.events.length = 0;
    MR.frame(menuCtx, demo, {});
  }
  $('#btn-play').addEventListener('click', () => show('levels'));
  // «← Juegos»: el enlace que pone conexion.js (queda tapado por el juego, así que se pulsa por código).
  document.querySelectorAll('.pd-volver').forEach(b => {
    if (!EMBEBIDO) { b.hidden = true; return; }
    b.addEventListener('click', () => { const a = document.querySelector('.club-volver'); if (a) a.click(); });
  });
  $('#btn-almanac').addEventListener('click', () => show('almanac'));
  $('#btn-help').addEventListener('click', () => show('help'));
  $('#btn-reset').addEventListener('click', () => modal(`<h2>¿Borrar progreso?</h2><p>Se perderán los reinos desbloqueados, récords y partidas guardadas en este dispositivo.${EN_LA_NUBE ? '<br>Tus récords de la clasificación y tus monedas de Juegos no se borran.' : ''}</p>`, [
    { label: 'Sí, borrar todo', cls: 'danger', fn: () => { save = defaultSave(); writeSave(); adoptaNube(); toastMenu('Progreso borrado'); } },
    { label: 'Cancelar' }
  ]));
  function toastMenu(msg) { modal(`<h2>${msg}</h2>`, [{ label: 'Aceptar' }]); }

  // ============================== NIVELES ================================
  function buildLevels() {
    const grid = $('#level-grid');
    grid.innerHTML = '';
    PD.LEVELS.forEach((L, li) => {
      const locked = li > save.unlocked;
      const best = save.best[li] || 0;
      const run = save.runs[li];
      const card = el(`<div class="lvl-card ${locked ? 'locked' : ''}">
        <canvas width="500" height="320"></canvas>
        ${locked ? `<div class="lock"><div class="padlock">🔒</div>Completa la ronda ${PD.UNLOCK_ROUND} de<br>${PD.LEVELS[li - 1].name}</div>` : ''}
        <div class="lc-body">
          <h3><span class="num">${li + 1}</span>${L.name}</h3>
          <p>${L.subtitle}</p>
          <div class="lc-new">${realmTowers(li).map(id => `<span title="${PD.TOWERS[id].desc}"><canvas width="44" height="44" data-t="${id}"></canvas>${PD.TOWERS[id].name}</span>`).join('')}</div>
          <div class="meta">
            <span class="stars">${'★'.repeat(L.stars)}${'☆'.repeat(5 - L.stars)}</span>
            <span>❤ ${L.lives}</span><span>🪙 ${L.cash}</span>
            <span>Récord: <b>${best}</b>/100</span>
            <span class="medals"><span class="medal m50 ${best >= 50 ? 'got' : ''}">R50</span><span class="medal m100 ${best >= 100 ? 'got' : ''}">🏆 R100</span></span>
          </div>
          ${EN_LA_NUBE ? `<div class="lc-coins" title="Cada ronda nueva de tu récord paga ${monedasRonda(li)} monedas de Juegos, una sola vez.">🪙 ${monedasRonda(li)} por ronda · ${nube[li] === null ? '…' : fmt(Math.min(100, nube[li]) * monedasRonda(li))} de ${fmt(100 * monedasRonda(li))} ganadas</div>` : ''}
          <div class="lc-actions"></div>
        </div></div>`);
      card.querySelector('canvas').getContext('2d').drawImage(PD.levelThumb(li, 500, 320), 0, 0);
      card.querySelectorAll('canvas[data-t]').forEach(c => towerIcon(c, c.dataset.t, [0, 0]));
      const acts = card.querySelector('.lc-actions');
      if (EN_LA_NUBE) {
        const rb = el(`<button class="btn small ghost pd-rank ${verTabla === li ? 'on' : ''}" title="Ver la clasificación de este reino">🏆 Clasificación</button>`);
        rb.addEventListener('click', () => { escuchaTabla(li); buildLevels(); });
        acts.appendChild(rb);
      }
      if (!locked) {
        if (run) {
          const b = el(`<button class="btn go">Continuar · Ronda ${Math.min(100, run.snap.round + 1)}</button>`);
          b.addEventListener('click', () => startGame(li, run));
          acts.appendChild(b);
        }
        const nb = el(`<button class="btn ${run ? '' : 'gold'}">Nueva partida</button>`);
        nb.addEventListener('click', () => {
          if (run) modal('<h2>¿Nueva partida?</h2><p>Se perderá la partida guardada de este reino.</p>', [
            { label: 'Empezar de nuevo', cls: 'gold', fn: () => { delete save.runs[li]; writeSave(); startGame(li, null); } }, { label: 'Cancelar' }]);
          else startGame(li, null);
        });
        acts.appendChild(nb);
      }
      grid.appendChild(card);
    });
  }

  // ============================= ALMANAQUE ===============================
  let almTab = 'towers';
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    almTab = t.dataset.tab; buildAlmanac(almTab);
  }));
  function enemyBadges(d) {
    const b = [];
    if (d.boss) b.push(['JEFE', 'b-boss']);
    if (d.camo) b.push(['Camuflado', 'b-camo']);
    if (d.flying) b.push(['Volador', 'b-fly']);
    if (d.armor) b.push(['Blindaje ' + d.armor, 'b-armor']);
    if (d.shield) b.push(['Escudo', 'b-shield']);
    if (d.regen) b.push(['Regenera', 'b-special']);
    if (d.heal) b.push(['Cura', 'b-special']);
    if (d.haste) b.push(['Acelera', 'b-special']);
    if (d.sabotage) b.push(['Sabotea', 'b-special']);
    if (d.burrow) b.push(['Se entierra', 'b-special']);
    if (d.phase) b.push(['Fase', 'b-special']);
    if (d.teleport || d.blink) b.push(['Teletransporte', 'b-special']);
    if (d.enrage) b.push(['Furia', 'b-special']);
    if (d.revive) b.push(['Renace', 'b-special']);
    if (d.deathFreeze) b.push(['Congela torres', 'b-special']);
    if (d.spawn) b.push(['Invoca', 'b-special']);
    if (d.children) b.push(['Se divide', 'b-special']);
    if (d.slowImmune) b.push(['Inmune a ralentizar', 'b-res']);
    if (d.resist) for (const k in d.resist) {
      const v = d.resist[k];
      b.push([(v === 0 ? 'Inmune ' : v < 1 ? 'Resiste ' : 'Débil ') + (DTYPE[k] || k).toLowerCase(), v > 1 ? 'b-special' : 'b-res']);
    }
    return b.map(x => `<span class="badge ${x[1]}">${x[0]}</span>`).join('');
  }
  function buildAlmanac(tab) {
    const box = $('#alm-content');
    box.innerHTML = '';
    if (tab === 'towers') {
      for (const id of PD.TOWER_ORDER) {
        const d = PD.TOWERS[id], b = d.base;
        const stats = [];
        if (b.dmg !== undefined) stats.push('Daño ' + b.dmg);
        if (b.dps) stats.push(b.dps + ' daño/s');
        if (b.droneDmg) stats.push(b.drones + ' drones · ' + b.droneDmg + ' daño');
        if (b.mineDmg) stats.push('Minas de ' + b.mineDmg);
        if (b.range) stats.push(b.range > 5000 ? 'Alcance global' : 'Alcance ' + b.range);
        if (b.dtype) stats.push(DTYPE[b.dtype]);
        if (b.income) stats.push('+' + b.income + ' oro/ronda');
        if (b.golems) stats.push(b.golems + ' gólems');
        if (b.maxWalls) stats.push(b.maxWalls + ' murallas');
        if (b.blades) stats.push(b.blades + ' guadañas');
        if (d.kind === 'beacon') stats.push('Revela camuflados');
        const where = d.realm === undefined ? '' : `<span class="badge b-special">Nueva en ${PD.LEVELS[d.realm].name}</span>`;
        const card = el(`<div class="alm-card">
          <div class="alm-head"><canvas width="128" height="128"></canvas><div><h4>${d.name}</h4><div class="sub"><span style="color:var(--gold);font-weight:800">${fmt(d.cost)} oro</span> · ${stats.join(' · ')}</div>${where}</div></div>
          <p>${d.desc}</p>
          <div class="up-table">${d.paths.map((P, pi) => `<div class="up-col p${pi + 1}"><h5>${P.name}</h5>${P.ups.map((u, i) => `<div class="up-row"><b>${i + 1}. ${u.name} · ${fmt(u.cost)}</b><span>${u.desc}</span></div>`).join('')}</div>`).join('')}</div>
        </div>`);
        towerIcon(card.querySelector('canvas'), id, [0, 0]);
        box.appendChild(card);
      }
      return;
    }
    // atacantes agrupados por reino
    const where = {};
    PD.LEVELS.forEach((L, li) => {
      for (const [id, intro] of L.pool) (where[id] = where[id] || []).push(L.short + ' (R' + intro + ')');
      (where[L.boss] = where[L.boss] || []).push(L.short + ' (R25, 50, 75, 100)');
    });
    const parentOf = {};
    for (const id in PD.ENEMIES) { const d = PD.ENEMIES[id]; if (d.children) for (const [c] of d.children) parentOf[c] = d.name; }
    const sections = [
      ['Atacantes comunes', ['brote', 'veloz', 'robusto', 'alado', 'escudero', 'sombra', 'blindado', 'divisor', 'gelatinita', 'portador', 'titan']],
      ['Reino 1 · Prado Esmeralda', ['musgo', 'chaman', 'enjambre']],
      ['Reino 2 · Dunas de Ámbar', ['excavador', 'escorpion', 'espejismo']],
      ['Reino 3 · Glaciar Cristal', ['golem', 'cristal', 'yeti']],
      ['Reino 4 · Caldera Volcánica', ['salamandra', 'magma', 'brasa', 'heraldo', 'ave']],
      ['Reino 5 · Nexo del Vacío', ['espectro', 'saboteador', 'magnetita', 'fractal', 'fractal2', 'fractal3', 'colosoVacio']],
      ['Jefes', ['reyEscarabajo', 'gusano', 'coloso', 'fenix', 'devorador']]
    ];
    for (const [title, ids] of sections) {
      box.appendChild(el(`<div class="alm-sec">${title}</div>`));
      for (const id of ids) {
        const d = PD.ENEMIES[id];
        const appear = where[id] ? 'Aparece en: ' + where[id].join(' · ') : (parentOf[id] ? 'Surge de: ' + parentOf[id] : '');
        const card = el(`<div class="alm-card">
          <div class="alm-head"><canvas width="128" height="128"></canvas><div><h4>${d.name}</h4><div class="sub">${d.boss ? 'Vida base' : 'Vida'} ${fmt(d.hp)}${d.shield ? ' + escudo ' + d.shield : ''} · Velocidad ${d.speed} · Fuga ${d.boss ? 'enorme' : '−' + d._leak + ' ❤'}</div></div></div>
          <div class="badges">${enemyBadges(d)}</div>
          <p>${d.desc}</p>
          <div class="sub" style="font-size:12px;color:var(--muted)">${appear}</div>
        </div>`);
        enemyIcon(card.querySelector('canvas'), id);
        box.appendChild(card);
      }
    }
  }

  // =============================== JUEGO =================================
  const cv = $('#cv'), ctx = cv.getContext('2d');
  function resize() {
    if (screen !== 'game') return;
    const st = $('#stage').getBoundingClientRect();
    const pad = 10;
    const sc = Math.max(0.1, Math.min((st.width - pad * 2) / W, (st.height - pad * 2) / H));
    const cw = Math.floor(W * sc), ch = Math.floor(H * sc);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(cw * dpr)); cv.height = Math.max(1, Math.round(ch * dpr));
  }
  window.addEventListener('resize', resize);

  function startGame(li, run) {
    closeModal();
    if (run && !(run.snap && run.pr)) run = null;
    rec = new PR.Grabadora(li, CUENTA, run ? JSON.parse(JSON.stringify(run)) : null);
    game = rec.game;
    game.sounds = [];
    PD.Render.lastT = 0; ui.vt = 0;
    escuchaTabla(li);
    ui.selected = null; ui.placing = null; ui.paused = false; ui.autoT = -1;
    PD.Render.bgKey = '';
    $('#h-level').textContent = `${li + 1}. ${game.L.name}`;
    $('#toasts').innerHTML = '';
    show('game');
    buildShop(); renderInfo(); buildPreview(); updateHud(true);
    if (!run) {
      toast(`<b>${game.L.name}</b>${game.L.subtitle}<br>Elige un defensor a la derecha, colócalo junto al camino y pulsa ▶.`, 'good', null, 6500);
      for (const id of realmTowers(li)) { const d = PD.TOWERS[id]; toast(`<b>Nueva defensa: ${d.name}</b>${d.desc}`, 'special', { tower: id }, 8000); }
    }
    else toast(`<b>Partida reanudada</b>Ronda ${game.round + 1} de 100.`, 'good');
  }

  // ------------------------------ Tienda ---------------------------------
  function buildShop() {
    const shop = $('#shop');
    shop.innerHTML = '';
    PD.towersFor(game.li).forEach((id, i) => {
      const d = PD.TOWERS[id];
      const fresh = d.realm === game.li ? '<span class="nw">NUEVA</span>' : '';
      const it = el(`<div class="shop-item${fresh ? ' fresh' : ''}" data-id="${id}">${fresh}<span class="hk">${(HOTKEYS[i] || '').toUpperCase()}</span><canvas width="108" height="108"></canvas><div class="nm">${d.name}</div><div class="ct">${fmt(d.cost)}</div></div>`);
      towerIcon(it.querySelector('canvas'), id, [0, 0]);
      it.addEventListener('click', () => setPlacing(ui.placing === id ? null : id));
      it.addEventListener('mousemove', ev => showTip(`<b>${d.name}</b><span class="tc">${fmt(d.cost)} oro</span> · ${DTYPE[d.base.dtype] || 'Apoyo'}<br>${d.desc}`, ev.clientX, ev.clientY));
      it.addEventListener('mouseleave', hideTip);
      shop.appendChild(it);
    });
    updateShop();
  }
  function updateShop() {
    if (!game) return;
    document.querySelectorAll('.shop-item').forEach(it => {
      const d = PD.TOWERS[it.dataset.id];
      it.classList.toggle('poor', game.money < d.cost);
      it.classList.toggle('sel', ui.placing === it.dataset.id);
    });
  }
  function setPlacing(id) {
    ui.placing = id;
    if (id) { ui.selected = null; renderInfo(); }
    updateShop();
  }

  // --------------------------- Panel de torre ----------------------------
  function statsRows(t) {
    const s = t.s, k = t.def.kind, rows = [];
    const yn = v => `<b class="${v ? 'yes' : 'no'}">${v ? 'Sí' : 'No'}</b>`;
    if (k === 'farm') {
      rows.push(['Oro / ronda', `<b>${fmt(s.income * (s.incomeMult || 1))}</b>`]);
      rows.push(['Descuento', `<b>${Math.round((s.discount || 0) * 100)}%</b>`]);
      rows.push(['Interés', `<b>${Math.round((s.interest || 0) * 100)}%</b>`]);
      rows.push(['Área', `<b>${Math.round(s.range)}</b>`]);
      return rows;
    }
    if (k === 'support') {
      rows.push(['Velocidad', `<b>+${Math.round(s.buffRate * 100)}%</b>`]);
      rows.push(['Alcance', `<b>+${Math.round((s.buffRange || 0) * 100)}%</b>`]);
      rows.push(['Daño', `<b>${s.buffDmgMult ? 'x' + s.buffDmgMult : '+' + (s.buffDmg || 0)}</b>`]);
      rows.push(['Da camuflaje', yn(s.buffCamo)]);
      rows.push(['Rompe blindaje', `<b>${Math.round((s.buffArmor || 0) * 100)}%</b>`]);
      rows.push(['Área', `<b>${Math.round(s.range)}</b>`]);
      return rows;
    }
    const n1 = v => (Math.round(v * 10) / 10).toString();
    if (k === 'beacon') {
      rows.push(['Luz', `<b>${Math.round(s.range)}</b>`]);
      rows.push(['Revela camuflados', '<b class="yes">Sí</b>']);
      rows.push(['Lentitud', `<b>${Math.round((s.slowAura || 0) * 100)}%</b>`]);
      rows.push(['Daño recibido', `<b>+${Math.round((s.lightAmp || 0) * 100)}%</b>`]);
      rows.push(['Destello', `<b>${s.flashDmg ? n1(s.flashDmg) + ' / ' + n1(s.flashCd) + ' s' : 'No'}</b>`]);
      rows.push(['Daño total', `<b class="dealt">${fmt(t.dealt)}</b>`]);
      return rows;
    }
    if (k === 'barrier') {
      rows.push(['Murallas', `<b>${s.maxWalls}</b>`]);
      rows.push(['Resistencia', `<b>${Math.round(s.wallHp)}</b>`]);
      rows.push(['Brota cada', `<b>${n1(s.cd)} s</b>`]);
      rows.push(['Espinas', `<b>${s.thornDps ? s.thornDps + '/s' : 'No'}</b>`]);
      rows.push(['Frena jefes', yn(s.bossHold)]);
      rows.push(['Área', `<b>${Math.round(s.range)}</b>`]);
      rows.push(['Daño total', `<b class="dealt">${fmt(t.dealt)}</b>`]);
      return rows;
    }
    if (k === 'barracks') {
      rows.push(['Gólems', `<b>${s.golems}</b>`]);
      rows.push(['Daño gólem', `<b>${n1(s.golemDmg)}</b>`]);
      rows.push(['Vida gólem', `<b>${Math.round(s.golemHp)}</b>`]);
      rows.push(['Bloquea', `<b>${s.block} a la vez</b>`]);
      rows.push(['Reforja', `<b>${n1(s.golemCd)} s</b>`]);
      rows.push(['Área', `<b>${Math.round(s.range)}</b>`]);
      rows.push(['Daño total', `<b class="dealt">${fmt(t.dealt)}</b>`]);
      return rows;
    }
    if (k === 'hex') {
      rows.push(['Malditos', `<b>${s.targets}</b>`]);
      rows.push(['Daño recibido', `<b>+${Math.round(s.hexAmp * 100)}%</b>`]);
      rows.push(['Ejecuta bajo', `<b>${s.hexExec ? Math.round(s.hexExec * 100) + '%' : 'No'}</b>`]);
      rows.push(['Cada', `<b>${n1(s.cd)} s</b>`]);
      rows.push(['Alcance', `<b>${Math.round(s.range)}</b>`]);
      rows.push(['Camuflados', yn(s.camo)]);
      rows.push(['Daño total', `<b class="dealt">${fmt(t.dealt)}</b>`]);
      return rows;
    }
    if (k === 'beam') rows.push(['Daño/s', `<b>${n1(s.dps)} (x${s.rampMax})</b>`]);
    else if (k === 'hive') rows.push(['Daño dron', `<b>${n1(s.droneDmg)}</b>`]);
    else if (k === 'mines') rows.push(['Daño mina', `<b>${n1(s.mineDmg)}</b>`]);
    else rows.push(['Daño', `<b>${n1(s.dmg)}</b>`]);
    if (k === 'hive') rows.push(['Drones', `<b>${s.drones}</b>`]);
    else if (k === 'blades') rows.push(['Guadañas', `<b>${s.blades}</b>`]);
    else if (k === 'saw') rows.push(['Sierras', `<b>${s.saws} / ${n1(s.cd)} s</b>`]);
    else if (k === 'boomerang') rows.push(['Bumeranes', `<b>${s.count} / ${n1(s.cd)} s</b>`]);
    else if (k === 'rail') rows.push(['Virotes', `<b>${s.bolts} / ${n1(s.cd)} s</b>`]);
    else if (k === 'beam') rows.push(['Rayos', `<b>${s.beams}</b>`]);
    else if (s.cd) rows.push(['Ataques/s', `<b>${n1(1 / s.cd)}</b>`]);
    rows.push(['Alcance', `<b>${s.range > 5000 ? 'Global' : Math.round(s.range)}</b>`]);
    if (k === 'projectile' || k === 'boomerang' || k === 'saw') rows.push(['Perforación', `<b>${s.pierce}</b>`]);
    if (k === 'acid') rows.push(['Corrosión', `<b>${s.corr}/golpe (máx. ${s.corrMax})</b>`]);
    if (k === 'geyser') rows.push(['Géiseres', `<b>${s.erupts}</b>`]);
    if (k === 'chain') rows.push(['Saltos', `<b>${s.jumps}</b>`]);
    if (k === 'mortar') rows.push(['Radio', `<b>${Math.round(s.radius)}</b>`]);
    if (k === 'mines') rows.push(['Máx. minas', `<b>${s.maxMines}</b>`]);
    if (k === 'gravity') rows.push(['Retroceso', `<b>${s.pull}</b>`]);
    if (k === 'pulse' || k === 'gravity' || k === 'blades' || k === 'saw') rows.push(['Camuflados', '<b class="yes">Área</b>']);
    else if (k !== 'mines') rows.push(['Camuflados', yn(s.camo)]);
    rows.push(['Voladores', yn(!s.noFlying)]);
    rows.push(['Tipo', `<b>${DTYPE[s.dtype] || '-'}</b>`]);
    rows.push(['Daño total', `<b class="dealt">${fmt(t.dealt)}</b>`]);
    return rows;
  }
  function pathHtml(t, p) {
    const P = t.def.paths[p], tier = t.tiers[p], next = P.ups[tier];
    const pips = [0, 1, 2, 3].map(i => `<span class="pip ${i < tier ? 'f' : ''}"></span>`).join('');
    let body;
    if (!next) body = `<div class="up-max">★ Camino al máximo</div>`;
    else if (!game.canUpgrade(t, p)) body = `<div class="up-lock">🔒 Bloqueado: el otro camino ya pasó del nivel 2.</div>`;
    else body = `<div class="up-next"><div class="un">${next.name}</div><div class="ud">${next.desc}</div>
      <button class="btn up-btn" data-p="${p}"><span>Mejorar <small>(${p ? 'X' : 'Z'})</small></span><span class="cst"></span></button></div>`;
    const owned = P.ups.slice(0, tier).map(u => u.name).join(' · ');
    return `<div class="path p${p + 1}"><div class="ph"><span>${P.name}</span><span class="pips">${pips}</span></div>${body}${owned ? `<div class="owned">${owned}</div>` : ''}</div>`;
  }
  function renderInfo() {
    const box = $('#info');
    const t = ui.selected;
    if (!t || !game || game.towers.indexOf(t) < 0) { box.classList.add('hidden'); ui.selected = null; return; }
    box.classList.remove('hidden');
    const d = t.def;
    const ab = t.s.ability ? PD.ABILITIES[t.s.ability] : null;
    box.innerHTML = `
      <div class="inf-head"><canvas width="116" height="116"></canvas><div><h3>${d.name}</h3><div class="sub">Nivel ${t.tiers[0]}-${t.tiers[1]} · Invertido ${fmt(t.spent)}</div></div><button class="inf-close" title="Cerrar (Esc)">✕</button></div>
      <div class="inf-stats">${statsRows(t).map(r => `<div><span>${r[0]}</span>${r[1]}</div>`).join('')}</div>
      ${d.targeting ? `<div class="targets">${MODES.map(m => `<button data-m="${m[0]}" class="${t.mode === m[0] ? 'on' : ''}">${m[1]}</button>`).join('')}</div>` : ''}
      ${ab ? `<div class="sub" style="font-size:12px;color:var(--violet)">Habilidad automática: <b>${ab.name}</b> — ${ab.desc} Se lanza sola cuando hay peligro (recarga ${ab.cd} s).</div>` : ''}
      ${t.buffed ? `<div class="sub" style="font-size:12px;color:#e07bff">♫ Potenciada por un Tótem del Eco</div>` : ''}
      <div class="paths">${pathHtml(t, 0)}${pathHtml(t, 1)}</div>
      <div class="inf-actions"><button class="btn danger" id="i-sell">Vender · <span class="sv"></span></button></div>`;
    towerIcon(box.querySelector('canvas'), t.type, t.tiers);
    box.querySelector('.inf-close').addEventListener('click', () => { ui.selected = null; renderInfo(); });
    box.querySelectorAll('.targets button').forEach(b => b.addEventListener('click', () => { rec.modo(t, b.dataset.m); guardaQuieto(); renderInfo(); }));
    box.querySelectorAll('.up-btn').forEach(b => b.addEventListener('click', () => doUpgrade(+b.dataset.p)));
    box.querySelector('#i-sell').addEventListener('click', doSell);
    refreshInfo();
  }
  function refreshInfo() {
    const t = ui.selected;
    if (!t || !game) return;
    const box = $('#info');
    box.querySelectorAll('.up-btn').forEach(b => {
      const p = +b.dataset.p;
      const c = game.upgradeCost(t, p);
      const ok = game.money >= c;
      b.classList.toggle('can', ok);
      b.disabled = !ok;
      b.querySelector('.cst').textContent = fmt(c);
    });
    const dl = box.querySelector('.dealt'); if (dl) dl.textContent = fmt(t.dealt);
    const sv = box.querySelector('.sv'); if (sv) sv.textContent = fmt(game.sellValue(t));
  }
  function doUpgrade(p) {
    const t = ui.selected;
    if (t && !rec.mejorar(t, p)) { sfx('error', t.x); return; }
    if (t) {
      guardaQuieto();
      const up = t.def.paths[p].ups[t.tiers[p] - 1];
      sfx(t.tiers[p] === 4 ? 'upgradeMax' : 'upgrade', t.x);
      if (t.tiers[p] === 4) toast(`<b>${up.name}</b>¡Mejora definitiva desbloqueada!`, 'good', { tower: t.type });
      renderInfo();
    }
  }
  function doSell() {
    const t = ui.selected;
    if (!t) return;
    sfx('sell', t.x);
    rec.vender(t);
    guardaQuieto();
    ui.selected = null; renderInfo();
  }

  // --------------------------------- HUD ---------------------------------
  const hud = { lives: -1, money: -1, round: -1, active: null };
  function updateHud(force) {
    if (!game) return;
    const lv = Math.ceil(game.lives), mo = Math.floor(game.money);
    if (force || lv !== hud.lives) {
      if (hud.lives > lv && !force) { const s = $('.stat.lives'); s.classList.remove('hit'); void s.offsetWidth; s.classList.add('hit'); }
      $('#h-lives').textContent = fmt(lv); hud.lives = lv;
    }
    if (force || mo !== hud.money) { $('#h-money').textContent = fmt(mo); hud.money = mo; }
    const rd = Math.min(100, game.round + 1);
    if (force || rd !== hud.round || hud.active !== game.active) {
      $('#h-round').textContent = game.won ? 100 : rd; hud.round = rd; hud.active = game.active;
      const b = $('#b-start');
      if (game.won) { b.textContent = '🏆 Completado'; b.disabled = true; }
      else if (game.active) { b.textContent = '⏵ En curso…'; b.classList.add('running'); b.disabled = false; }
      else { b.textContent = `▶ Ronda ${rd}`; b.classList.remove('running'); b.disabled = false; }
    }
  }
  function buildPreview() {
    const box = $('#h-next');
    box.innerHTML = '';
    if (!game || game.round >= 100) return;
    const r = game.round + (game.active ? 2 : 1);
    if (r > 100) { box.innerHTML = '<span class="sp">¡Última ronda!</span>'; return; }
    const pv = game.roundPreview(r);
    box.appendChild(el(`<span>${game.active ? 'Después' : 'Siguiente'}:</span>`));
    if (pv.boss) box.appendChild(el(`<span class="bs">☠ JEFE</span>`));
    if (pv.special) box.appendChild(el(`<span class="sp">★ ${pv.special.name}</span>`));
    for (const [id, n] of pv.list.slice(0, 7)) {
      const chip = el(`<span class="pv" title="${PD.ENEMIES[id].name}"><canvas width="48" height="48"></canvas>×${n}</span>`);
      enemyIcon(chip.querySelector('canvas'), id);
      box.appendChild(chip);
    }
  }

  // ----------------------------- Habilidades -----------------------------
  let abilKey = '';
  function updateAbilities() {
    if (!game) return;
    const groups = {};
    for (const t of game.towers) if (t.s.ability) (groups[t.s.ability] = groups[t.s.ability] || []).push(t);
    const key = Object.keys(groups).map(k => k + groups[k].length).join(',');
    const box = $('#abilities');
    if (key !== abilKey) {
      abilKey = key;
      box.innerHTML = '';
      for (const id in groups) {
        const A = PD.ABILITIES[id];
        const b = el(`<div class="abil" data-id="${id}" style="background:${A.color}">${ABIL_ICON[id]}<div class="cdv"></div><div class="cdt"></div><span class="cnt"></span></div>`);
        b.addEventListener('mousemove', ev => showTip(`<b>${A.name}</b>${A.desc}<br><span class="tc">Automática · recarga ${A.cd} s</span>`, ev.clientX, ev.clientY));
        b.addEventListener('mouseleave', hideTip);
        box.appendChild(b);
      }
    }
    box.querySelectorAll('.abil').forEach(b => {
      const list = groups[b.dataset.id] || [];
      const A = PD.ABILITIES[b.dataset.id];
      let best = Infinity;
      for (const t of list) best = Math.min(best, Math.max(0, t.abilityCd));
      const frac = best / A.cd;
      b.querySelector('.cdv').style.height = (frac * 100) + '%';
      b.querySelector('.cdt').textContent = best > 0 ? Math.ceil(best) : '';
      b.querySelector('.cnt').textContent = list.length > 1 ? '×' + list.length : '';
      b.classList.toggle('ready', best <= 0);
    });
  }

  // ------------------------------- Rondas --------------------------------
  // Guarda la partida para reanudarla (con su prueba hasta ahora).
  function guardaPartida() { if (!rec || game.won) return; const g = rec.guardado(); if (g) { save.runs[game.li] = g; writeSave(); } }
  function guardaQuieto() { if (game && !game.active && !game.over) guardaPartida(); }
  function startRound() {
    if (!game || game.active || game.over || game.won || ui.modal) return;
    if (!rec.ronda()) return;
    guardaPartida();
    sfx('roundStart');
    buildPreview();
  }
  $('#b-start').addEventListener('click', () => {
    if (game && game.active) { cycleSpeed(); return; }
    startRound();
  });
  function cycleSpeed() {
    ui.speed = ui.speed >= 3 ? 1 : ui.speed + 1;
    const b = $('#b-speed'); b.textContent = 'x' + ui.speed; b.classList.toggle('on', ui.speed > 1);
  }
  $('#b-speed').addEventListener('click', cycleSpeed);
  function setAuto(v) { ui.auto = v; save.settings.auto = v; writeSave(); $('#b-auto').classList.toggle('on', v); }
  $('#b-auto').addEventListener('click', () => setAuto(!ui.auto));
  setAuto(ui.auto);
  $('#b-pause').addEventListener('click', openPause);
  $('#b-mute').addEventListener('click', () => setMuted(!save.settings.muted));
  $('#btn-mute-menu').addEventListener('click', () => setMuted(!save.settings.muted));
  setMuted(!!save.settings.muted);
  AU.playMusic('menu');

  function openPause() {
    if (!game || ui.modal) return;
    ui.paused = true;
    modal(`<h2>Pausa</h2><p>${game.L.name} · Ronda ${Math.min(100, game.round + 1)}/100<br>Eliminados: ${fmt(game.stats.kills)} · Fugas: ${fmt(game.stats.leaked)}</p>
      ${game.active ? '<p style="font-size:13px;color:var(--muted)">Si sales ahora, la partida se reanudará al inicio de esta ronda.</p>' : ''}
      <div class="vol"><label>Música <input type="range" id="v-mus" min="0" max="1" step="0.05" value="${save.settings.music}"></label>
      <label>Efectos <input type="range" id="v-sfx" min="0" max="1" step="0.05" value="${save.settings.sfx}"></label></div>`, [
      { label: 'Reanudar', cls: 'go', fn: () => { ui.paused = false; } },
      { label: 'Reiniciar reino', fn: () => modal('<h2>¿Reiniciar?</h2><p>Perderás el progreso de esta partida.</p>', [
        { label: 'Reiniciar', cls: 'danger', fn: () => { delete save.runs[game.li]; writeSave(); startGame(game.li, null); } },
        { label: 'Cancelar', fn: () => { ui.paused = false; } }]) },
      { label: 'Salir a los reinos', fn: () => { exitGame(); } }
    ]);
    const vm = $('#v-mus'), vs = $('#v-sfx');
    const onVol = () => { save.settings.music = +vm.value; save.settings.sfx = +vs.value; AU.setVolumes(+vs.value, +vm.value); writeSave(); };
    vm.addEventListener('input', onVol); vs.addEventListener('input', onVol);
    vs.addEventListener('change', () => sfx('coin'));
  }
  function exitGame() {
    if (game && !game.over && !game.won) guardaPartida();
    game = null; rec = null; ui.paused = false;
    show('levels');
  }

  function handleEvents() {
    const evs = game.events;
    if (!evs.length) return;
    game.events = [];
    for (const ev of evs) {
      switch (ev.type) {
        case 'roundStart': {
          const L = game.L;
          for (const [id, intro] of L.pool) if (intro === ev.round && intro > 1) {
            const d = PD.ENEMIES[id];
            toast(`<b>Nuevo atacante: ${d.name}</b>${d.desc}`, 'special', { enemy: id }, 7000);
          }
          if (ev.special) toast(`<b>★ Ronda especial: ${ev.special.name}</b>${ev.special.desc}`, 'special', null, 5000);
          break;
        }
        case 'ability': {
          const A = PD.ABILITIES[ev.id];
          const b = document.querySelector(`.abil[data-id="${ev.id}"]`);
          if (b) { b.classList.remove('fired'); void b.offsetWidth; b.classList.add('fired'); }
          if (A) toast(`<b>${ABIL_ICON[ev.id] || '★'} ${A.name}</b>${A.desc}`, 'special', null, 1800);
          break;
        }
        case 'boss': sfx('bossSpawn'); toast(`<b>☠ ¡Se acerca un jefe!</b>${ev.enemy.name}`, 'boss', { enemy: ev.enemy.type }, 6000); break;
        case 'bossDown': toast(`<b>¡Jefe derrotado!</b>${ev.enemy.name || ev.enemy.d.name}`, 'good', { enemy: ev.enemy.type }); break;
        case 'revive': toast(`<b>¡${ev.enemy.d.name} renace de sus cenizas!</b>`, 'boss', { enemy: ev.enemy.type }); break;
        case 'roundEnd': {
          sfx('roundEnd'); sfx('coin');
          toast(`<b>Ronda ${ev.round} superada</b>+${fmt(ev.bonus)} oro${ev.farm ? ` · cosecha +${fmt(ev.farm)}` : ''}`, 'good', null, 2600);
          const li = game.li;
          save.best[li] = Math.max(save.best[li] || 0, ev.round);
          if (ev.round >= PD.UNLOCK_ROUND && li < PD.LEVELS.length - 1) save.unlocked = Math.max(save.unlocked, li + 1);
          if (game.won) { delete save.runs[li]; save.won[li] = true; writeSave(); }
          else guardaPartida();
          reporta(li, ev.round);
          buildPreview();
          if (ui.auto && !game.won) ui.autoT = 1.2;
          break;
        }
        case 'unlock': {
          const li = game.li;
          ui.autoT = -1;
          sfx('unlock');
          if (li < PD.LEVELS.length - 1) {
            ui.paused = true;
            const nt = realmTowers(li + 1).map(id => PD.TOWERS[id].name).join(' y ');
            modal(`<div class="big-ico">🔓</div><h2>¡Reino desbloqueado!</h2><p>Has resistido ${PD.UNLOCK_ROUND} rondas en <b>${game.L.name}</b>.<br>Ya puedes jugar <b>${PD.LEVELS[li + 1].name}</b>${nt ? `, con dos defensas nuevas: <b>${nt}</b>` : ''}.</p><p style="font-size:13px;color:var(--muted)">Sigue hasta la ronda 100 para conseguir el trofeo de este reino.</p>`, [
              { label: 'Seguir hasta la ronda 100', cls: 'go', fn: () => { ui.paused = false; } },
              { label: `Ir a ${PD.LEVELS[li + 1].name}`, cls: 'gold', fn: () => { exitGame(); } }
            ]);
          } else toast('<b>¡Mitad del Vacío superada!</b>Solo quedan 50 rondas para la victoria total.', 'good');
          break;
        }
        case 'victory': {
          ui.paused = true; ui.autoT = -1;
          sfx('victory');
          const li = game.li;
          const all = save.won.every(Boolean);
          modal(`<div class="big-ico">🏆</div><h2>¡Victoria!</h2><p>Has completado las 100 rondas de <b>${game.L.name}</b>.<br>Eliminados: ${fmt(game.stats.kills)} · Vidas restantes: ${fmt(game.lives)}</p>${all ? '<p><b>¡Has conquistado los cinco reinos! Eres un verdadero PRO DEFENDER.</b></p>' : ''}`, [
            ...(li < PD.LEVELS.length - 1 ? [{ label: `Jugar ${PD.LEVELS[li + 1].name}`, cls: 'gold', fn: () => { game = null; rec = null; startGame(li + 1, save.runs[li + 1] || null); } }] : []),
            { label: 'Volver a los reinos', fn: () => { game = null; rec = null; ui.paused = false; show('levels'); } }
          ]);
          break;
        }
        case 'gameover': {
          ui.autoT = -1;
          sfx('defeat'); AU.setIntensity(0);
          const li = game.li, cont = game.continues;
          const r = game.round + 1;
          // Reintentar vuelve a la foto del comienzo de la ronda y gasta un reintento (prueba.js: recarga c = 1).
          const g = cont > 0 ? rec.guardado() : null;
          if (g) save.runs[li] = g;
          else delete save.runs[li];
          save.best[li] = Math.max(save.best[li] || 0, game.round);
          writeSave();
          const btns = [];
          if (g) btns.push({ label: `Reintentar ronda ${r} (quedan ${cont})`, cls: 'go', fn: () => startGame(li, save.runs[li]) });
          btns.push({ label: 'Reiniciar reino', cls: 'gold', fn: () => { delete save.runs[li]; writeSave(); startGame(li, null); } });
          btns.push({ label: 'Salir a los reinos', fn: () => { game = null; rec = null; show('levels'); } });
          modal(`<div class="big-ico">💀</div><h2>Derrota</h2><p>Los atacantes han arrasado <b>${game.L.name}</b> en la ronda ${r}.</p><p style="font-size:13px;color:var(--muted)">Consejo: revisa el Almanaque para conocer las debilidades de cada atacante.</p>`, btns);
          break;
        }
      }
    }
  }

  // ------------------------------- Entrada -------------------------------
  function toWorld(ev) {
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
  }
  cv.addEventListener('pointermove', ev => { ui.mouse = toWorld(ev); });
  cv.addEventListener('pointerdown', ev => { ui.mouse = toWorld(ev); });
  cv.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') ui.mouse = null; });
  cv.addEventListener('contextmenu', ev => { ev.preventDefault(); setPlacing(null); ui.selected = null; renderInfo(); });
  cv.addEventListener('pointerup', ev => {
    if (!game || ui.modal || ev.button !== 0) return;
    const p = toWorld(ev);
    ui.mouse = p;
    if (ui.placing) {
      const t = rec.colocar(ui.placing, p.x, p.y);
      if (!t) sfx('error', p.x);
      if (t) {
        sfx('place', p.x);
        if (!ev.shiftKey || game.money < t.def.cost) setPlacing(null);
        guardaQuieto();
        if (!ev.shiftKey) { ui.selected = t; renderInfo(); }
      }
      if (ev.pointerType !== 'mouse') ui.mouse = null;
      return;
    }
    let hit = null;
    for (const t of game.towers) if (Math.hypot(t.x - p.x, t.y - p.y) < t.def.size + 6) hit = t;
    ui.selected = hit; renderInfo();
  });
  window.addEventListener('keydown', ev => {
    if (screen !== 'game' || !game) return;
    if (ui.modal) { if (ev.key === 'Escape' && ui.paused && !game.over) { closeModal(); ui.paused = false; } return; }
    const k = ev.key;
    if (k === ' ') { ev.preventDefault(); if (game.active) cycleSpeed(); else startRound(); return; }
    if (k === 'Escape') { if (ui.placing) setPlacing(null); else if (ui.selected) { ui.selected = null; renderInfo(); } else openPause(); return; }
    if (k === 'f' || k === 'F') { cycleSpeed(); return; }
    if (k === 'p' || k === 'P') { openPause(); return; }
    if (k === 'm' || k === 'M') { setMuted(!save.settings.muted); return; }
    const hi2 = HOTKEYS.indexOf(k.toLowerCase());
    if (hi2 >= 0) { const id = PD.towersFor(game.li)[hi2]; if (id) setPlacing(ui.placing === id ? null : id); return; }
    if (ui.selected) {
      if (k === 'z' || k === 'Z') doUpgrade(0);
      else if (k === 'x' || k === 'X') doUpgrade(1);
      else if (k === 'Delete' || k === 'Backspace') doSell();
      else if (k === 'Tab' && ui.selected.def.targeting) {
        ev.preventDefault();
        const i = MODES.findIndex(m => m[0] === ui.selected.mode);
        rec.modo(ui.selected, MODES[(i + 1) % MODES.length][0]); guardaQuieto(); renderInfo();
      }
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && game && !ui.modal && game.active) openPause(); });

  function drainSounds() {
    const q = game.sounds;
    if (q && q.length) { for (let i = 0; i < q.length; i += 2) AU.play(q[i], q[i + 1]); q.length = 0; }
    AU.setIntensity(game.bosses.length && !game.over ? 1 : 0);
  }

  // ---------------------------- Bucle principal ---------------------------
  let last = performance.now(), acc = 0, slowT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    if (screen === 'menu') { demoFrame(dt); return; }
    if (screen !== 'game' || !game) return;
    if (!ui.paused && !ui.modal) {
      acc += dt * ui.speed;
      ui.vt += dt * ui.speed;   // el reloj de la pantalla: sigue aunque el motor descanse entre rondas
      let steps = 0;
      while (acc >= STEP && steps < 12) { rec.tick(); acc -= STEP; steps++; }
      if (steps >= 12) acc = 0;
      if (ui.autoT > 0) { ui.autoT -= dt; if (ui.autoT <= 0) { ui.autoT = -1; startRound(); } }
    }
    handleEvents();
    if (!game) return;
    drainSounds();
    PD.Render.frame(ctx, game, ui);
    updateHud(false);
    updateAbilities();
    slowT -= dt;
    if (slowT <= 0) { slowT = 0.2; updateShop(); refreshInfo(); if (ui.selected && game.towers.indexOf(ui.selected) < 0) { ui.selected = null; renderInfo(); } }
  }
  requestAnimationFrame(loop);

  // ------------------------- Clasificación y monedas -------------------------
  // Lo que la tabla del club sabe de cada reino (tu ronda récord; null: aún no se sabe).
  // Cada ronda que la supera se manda a Juegos con la prueba de la partida: la página la
  // rehace (verifica/prodefender.js), la guarda y eso paga monedasRonda(li) por ronda.
  const nube = [null, null, null, null, null], enviada = [0, 0, 0, 0, 0];
  let verTabla = -1;
  function escuchaTabla(li) {
    if (!EN_LA_NUBE || verTabla === li) return;
    verTabla = li; CLUB.category(PR.categoria(li));
    $('.pd-lado-tit').textContent = '🏆 ' + PD.LEVELS[li].name;
  }
  if (!EN_LA_NUBE) $('.pd-lado').hidden = true;
  function adoptaNube() {
    let cambio = false;
    nube.forEach((n, li) => {
      if (!n) return;
      if (n > (save.best[li] || 0)) { save.best[li] = n; cambio = true; }
      if (n >= PD.UNLOCK_ROUND && li < PD.LEVELS.length - 1 && save.unlocked < li + 1) { save.unlocked = li + 1; cambio = true; }
      if (n >= PD.MAX_ROUND && !save.won[li]) { save.won[li] = true; cambio = true; }
    });
    if (cambio) writeSave();
    return cambio;
  }
  window.addEventListener('club-tabla', e => {
    const li = PR.reinoDe(e.detail && e.detail.categoria);
    if (li < 0) return;
    nube[li] = Math.max(nube[li] || 0, (e.detail.propio && e.detail.propio.puntos) || 0);
    if (adoptaNube() || screen === 'levels') { if (screen === 'levels') buildLevels(); }
    if (esperaTabla && esperaTabla.li === li) esperaTabla.listo();
  });
  // Al abrir, una pasada por las cinco tablas para saber tus récords (y qué reinos tienes abiertos).
  let esperaTabla = null;
  async function recorreTablas() {
    if (!EN_LA_NUBE) return;
    for (let li = 0; li < PD.LEVELS.length; li++) {
      if (game) return;   // ya se está jugando: esa tabla es la que se escucha
      await new Promise(listo => {
        const t = setTimeout(() => { esperaTabla = null; listo(); }, 4000);
        esperaTabla = { li, listo: () => { clearTimeout(t); esperaTabla = null; listo(); } };
        verTabla = -1; escuchaTabla(li);
      });
    }
    if (!game) { let ul = 0; PD.LEVELS.forEach((L, li) => { if (li <= save.unlocked) ul = li; }); escuchaTabla(ul); if (screen === 'levels') buildLevels(); }
  }
  function reporta(li, ronda) {
    if (!EN_LA_NUBE || !rec) return;
    const antes = Math.max(nube[li] || 0, enviada[li]);
    if (ronda <= antes) return;
    enviada[li] = ronda;
    CLUB.result({ categoria: PR.categoria(li), puntos: ronda, tiempo: rec.tiempo() }, rec.prueba());
    // Las monedas las avisa Juegos cuando termina de comprobar la partida (puede tardar unos segundos).
    toast(`<b>¡Récord del reino: ronda ${ronda}!</b>Juegos la comprueba y te paga 🪙 ${fmt((ronda - antes) * monedasRonda(li))}`, 'good', null, 3200);
  }
  window.addEventListener('club-rechazo', e => {
    if (PR.reinoDe(e.detail && e.detail.categoria) < 0) return;
    toast(`<b>Esta ronda no se guardó</b>${String(e.detail.motivo || '').replace(/[<&]/g, '')}`, 'boss', null, 7000);
  });
  recorreTablas();
})();
