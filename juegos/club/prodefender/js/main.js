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
  // Los reinos de la segunda era (levels.js: `abre`) se abren a todos uno por día. Hasta
  // su día están en pruebas: solo los juega quien es administrador de Juegos
  // (conexion.js: Club.esAdmin, que manda la página) o quien abre el juego suelto en su
  // propio equipo (localhost); el resto los ve como «Próximamente». En pruebas no guardan
  // récords ni monedas: nada de ellos va a la nube. Ya abiertos no piden la ronda 50 del
  // anterior: se juegan desde el primer día, con su tabla y sus monedas.
  const PUB = PD.PUBLIC_LEVELS;
  const LOCAL = !EMBEBIDO && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  let admin = LOCAL || !!(CLUB && CLUB.esAdmin && CLUB.esAdmin());
  const segunda = li => !!PD.LEVELS[li].abre;
  const enPrueba = li => !PD.abierto(li);
  const puedeJugar = li => !enPrueba(li) || admin;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // «mañana», «el 25 de octubre»: cuándo se abre un reino en pruebas.
  const cuandoAbre = li => {
    const f = PD.LEVELS[li].abre, m = new Date(PD.diaChile() + 'T12:00:00Z');
    m.setUTCDate(m.getUTCDate() + 1);
    return f === m.toISOString().slice(0, 10) ? 'mañana' : 'el ' + (+f.slice(8)) + ' de ' + MESES[+f.slice(5, 7) - 1];
  };
  window.addEventListener('club-admin', e => { admin = LOCAL || !!(e.detail && e.detail.admin); if (screen === 'levels') buildLevels(); if (screen === 'almanac') buildAlmanac(almTab); });
  // Monedas de Juegos: cada ronda nueva de tu récord en un reino paga 20 × el número del
  // reino, y los de la segunda era, 100 como el Vacío (monedas.js: monedasProdefender).
  const monedasRonda = li => 20 * Math.min(li + 1, PUB);
  const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'g'];
  const MODES = [['first', 'Primero'], ['last', 'Último'], ['strong', 'Fuerte'], ['close', 'Cerca']];
  const ABIL_ICON = { absolute: '❄', judgement: '⚡', meteors: '☄', supernova: '✹', blackhole: '◉', treasure: '◆', wardrum: '♫', inferno: '♨',
    selva: '❦', tormenta: '≋', invierno: '❅', erupcion: '▲', grieta: '⧗', cienaga: '☘', tempestad: 'ϟ', maremoto: '≈', sobrecarga: '⚙', amanecer: '☀' };
  const DTYPE = { phys: 'Físico', explosive: 'Explosivo', ice: 'Hielo', elec: 'Eléctrico', fire: 'Fuego', arcane: 'Arcano', poison: 'Ácido', steam: 'Vapor' };
  const realmTowers = li => PD.towersFor(li).filter(id => PD.TOWERS[id].realm === li && !PD.TOWERS[id].hero);
  // La tienda: las torres (con las teclas de HOTKEYS) y, aparte, el héroe del reino (tecla H).
  const PINCHOS = '@pinchos';   // en ui.placing: tirar pinchos en vez de colocar una torre
  const PODER = '@poder';       // en ui.placing: apuntar el Poder del Reino (tercera era)
  const HEROE = '@heroe';       // en la tienda: elegir uno de los diez héroes (tercera era)
  const shopTowers = li => PD.towersFor(li).filter(id => !PD.TOWERS[id].hero);
  const abCd = t => t.s.abCd || PD.ABILITIES[t.s.ability].cd;

  // ------------------------------ Guardado -------------------------------
  // `pend`: por reino, el récord que todavía no confirma la tabla de Juegos ({r, t, p}: ronda,
  // tiempo y su prueba). Si la pestaña se cierra antes, se manda al volver (ver «Clasificación y monedas»).
  function defaultSave() { return { v: 1, unlocked: 0, best: PD.LEVELS.map(() => 0), won: PD.LEVELS.map(() => false), runs: {}, pend: {}, settings: { auto: false, muted: false, sfx: 0.8, music: 0.45, cursor: 'grande' } }; }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.v === 1) {
        const d = defaultSave(); const o = Object.assign(d, s); o.settings = Object.assign(defaultSave().settings, s.settings || {});
        // Una partida guardada sin su prueba (o con la de otro motor) no se puede verificar: se descarta.
        for (const k of Object.keys(o.runs || {})) { const r = o.runs[k]; if (!r || !r.snap || !r.pr || r.pr.ve !== PR.VERSION) delete o.runs[k]; }
        o.pend = o.pend && typeof o.pend === 'object' ? o.pend : {};
        for (const k of Object.keys(o.pend)) { const r = o.pend[k]; if (!r || !r.p || r.p.ve !== PR.VERSION || !(r.r > 0)) delete o.pend[k]; }
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
    AU.playMusic(id === 'game' && game ? (game.L.musica !== undefined ? game.L.musica : game.li) : 'menu');
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
    box.className = 'modal-box';   // sin las clases de un modal anterior (pactos, héroes)
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

  // ============================== NIVELES ================================
  function buildLevels() {
    const grid = $('#level-grid');
    grid.innerHTML = '';
    PD.LEVELS.forEach((L, li) => {
      const prueba = enPrueba(li);
      if (li === PUB) {
        const quedan = PD.LEVELS.filter((L, i) => enPrueba(i) && L.era !== 3).length;
        grid.appendChild(el(`<div class="lvl-sep"><b>Segunda Era</b> · ${quedan ? 'un reino nuevo cada día, abierto a todos y sin pasar por los anteriores: 🪙 100 por ronda en cada uno' + (admin ? ' · los que aún no abren, solo para administradores y sin récords' : '') : 'cinco reinos más, con jefes, defensas y héroes nuevos: 🪙 100 por ronda en cada uno'}</div>`));
      }
      if (L.era === 3 && PD.LEVELS[li - 1].era !== 3) {
        const quedan = PD.LEVELS.filter((L, i) => enPrueba(i) && L.era === 3).length;
        grid.appendChild(el(`<div class="lvl-sep era3"><b>Tercera Era · La Era del Caos</b> · más difícil: <b>pactos</b> cada diez rondas, <b>eventos</b> que cambian la ronda, el <b>Poder del Reino</b> y el <b>héroe que elijas</b>. ${quedan ? 'Un reino nuevo cada día desde el 27 de octubre' + (admin ? ' · los que aún no abren, solo para administradores' : '') : 'Cinco reinos de pesadilla'} · 🪙 100 por ronda</div>`));
      }
      const locked = prueba ? !admin : !segunda(li) && li > save.unlocked;
      const best = prueba ? 0 : save.best[li] || 0;
      const run = save.runs[li];
      const clasicas = PD.towersFor(li).filter(id => !PD.TOWERS[id].hero && PD.TOWERS[id].realm === undefined).length;
      const card = el(`<div class="lvl-card ${locked ? 'locked' : ''} ${prueba ? 'pronto' : ''}">
        <canvas width="500" height="320"></canvas>
        ${prueba && locked ? `<div class="lock"><div class="padlock">⏳</div>PRÓXIMAMENTE<br><small>Se abre ${cuandoAbre(li)}</small></div>`
          : locked ? `<div class="lock"><div class="padlock">🔒</div>Completa la ronda ${PD.UNLOCK_ROUND} de<br>${PD.LEVELS[li - 1].name}</div>` : ''}
        ${prueba && !locked ? `<div class="lc-prueba">EN PRUEBAS · solo admins · se abre ${cuandoAbre(li)}</div>` : segunda(li) && L.abre === PD.diaChile() ? '<div class="lc-prueba">¡NUEVO HOY!</div>' : ''}
        <div class="lc-body">
          <h3><span class="num">${li + 1}</span>${L.name}</h3>
          <p>${L.subtitle}</p>
          ${L.era === 3 ? `<div class="lc-new">${L.poder ? `<span class="poder" title="${PD.PODERES[L.poder].desc}">${PD.PODERES[L.poder].icon} ${PD.PODERES[L.poder].name}</span>` : ''}<span class="hero" title="Elige uno de los diez héroes (uno por partida).">♛ Héroe a elección</span><span title="${L.eventos.map(id => PD.EVENTOS[id].name).join(' · ')}">${L.eventos.map(id => PD.EVENTOS[id].icon).join(' ')} Eventos</span></div>`
            : `<div class="lc-new">${realmTowers(li).concat(PD.heroOf(li) ? [PD.heroOf(li)] : []).map(id => `<span class="${PD.TOWERS[id].hero ? 'hero' : ''}" title="${PD.TOWERS[id].desc}"><canvas width="44" height="44" data-t="${id}"></canvas>${PD.TOWERS[id].hero ? '♛ ' : ''}${PD.TOWERS[id].name}</span>`).join('')}</div>`}
          ${L.torres ? `<div class="lc-menos" title="${PD.TOWER_ORDER.filter(id => !PD.TOWERS[id].hero && PD.TOWERS[id].realm === undefined && L.torres.indexOf(id) < 0).map(id => PD.TOWERS[id].name).join(', ')}">Solo ${clasicas} de las 12 defensas clásicas y ${L.torres.filter(id => PD.TOWERS[id].realm !== undefined && (L.era === 3 || PD.TOWERS[id].realm < PUB)).length} de las ${L.era === 3 ? 15 : 10} de reino</div>` : ''}
          <div class="meta">
            <span class="stars">${'★'.repeat(L.stars)}${'☆'.repeat(5 - L.stars)}</span>
            <span>❤ ${L.lives}</span><span>🪙 ${L.cash}</span>
            ${prueba ? '<span>Jefe: <b>' + PD.ENEMIES[L.boss].name + '</b></span>' : `<span>Récord: <b>${best}</b>/100</span>
            <span class="medals"><span class="medal m50 ${best >= 50 ? 'got' : ''}">R50</span><span class="medal m100 ${best >= 100 ? 'got' : ''}">🏆 R100</span></span>`}
          </div>
          ${EN_LA_NUBE && !prueba ? `<div class="lc-coins" title="Cada ronda nueva de tu récord paga ${monedasRonda(li)} monedas de Juegos, una sola vez.">🪙 ${monedasRonda(li)} por ronda · ${nube[li] === null ? '…' : fmt(Math.min(100, nube[li]) * monedasRonda(li))} de ${fmt(100 * monedasRonda(li))} ganadas</div>` : ''}
          <div class="lc-actions"></div>
        </div></div>`);
      card.querySelector('canvas').getContext('2d').drawImage(PD.levelThumb(li, 500, 320), 0, 0);
      card.querySelectorAll('canvas[data-t]').forEach(c => towerIcon(c, c.dataset.t, [0, 0]));
      const acts = card.querySelector('.lc-actions');
      if (EN_LA_NUBE && !prueba) {
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
    if (d.hop) b.push(['Salta', 'b-special']);
    if (d.steal) b.push(['Roba oro', 'b-special']);
    if (d.fogAura) b.push(['Niebla', 'b-special']);
    if (d.heads || d.twins) b.push(['Se multiplica', 'b-special']);
    if (d.regenFuego) b.push(['Regenera sin fuego', 'b-special']);
    if (d.stone) b.push(['Se petrifica', 'b-special']);
    if (d.absorb) b.push(['Absorbe ' + (DTYPE[d.absorb] || d.absorb).toLowerCase(), 'b-res']);
    if (d.thunder) b.push(['Fulmina torres', 'b-special']);
    if (d.shellHits) b.push(['Caparazón', 'b-armor']);
    if (d.ink) b.push(['Ciega torres', 'b-special']);
    if (d.grab) b.push(['Atrapa torres', 'b-special']);
    if (d.adapt) b.push(['Se adapta', 'b-special']);
    if (d.shieldAura) b.push(['Da escudos', 'b-special']);
    if (d.cycle) b.push(['Inmunidad cambiante', 'b-res']);
    if (d.field) b.push(['Campo de fuerza', 'b-special']);
    if (d.cleanse) b.push(['Purifica', 'b-special']);
    if (d.ward) b.push(['Protege al morir', 'b-special']);
    if (d.silence) b.push(['Silencia habilidades', 'b-special']);
    if (d.rise) b.push(['Se levanta', 'b-special']);
    if (d.raise) b.push(['Levanta zombis', 'b-special']);
    if (d.intangible) b.push(['Intangible', 'b-res']);
    if (d.phylactery) b.push(['Filacterias', 'b-special']);
    if (d.deathSpores) b.push(['Esporas al morir', 'b-special']);
    if (d.root) b.push(['Echa raíces', 'b-special']);
    if (d.pollen) b.push(['Polen que cura', 'b-special']);
    if (d.infect) b.push(['Infecta torres', 'b-special']);
    if (d.mirror) b.push(['Se desdobla', 'b-special']);
    if (d.maxHit) b.push(['Coraza de cristal', 'b-res']);
    if (d.swap || d.ilusion) b.push(['Ilusiones', 'b-special']);
    if (d.frontShield) b.push(['Escudo frontal', 'b-armor']);
    if (d.gust) b.push(['Vendaval', 'b-special']);
    if (d.drain) b.push(['Chupa oro', 'b-special']);
    if (d.taunt) b.push(['Provoca', 'b-special']);
    if (d.pumpkins) b.push(['Apaga torres', 'b-special']);
    if (d.charge) b.push(['Embiste', 'b-special']);
    if (d.resist) for (const k in d.resist) {
      const v = d.resist[k];
      b.push([(v === 0 ? 'Inmune ' : v < 1 ? 'Resiste ' : 'Débil ') + (DTYPE[k] || k).toLowerCase(), v > 1 ? 'b-special' : 'b-res']);
    }
    return b.map(x => `<span class="badge ${x[1]}">${x[0]}</span>`).join('');
  }
  function buildAlmanac(tab) {
    const box = $('#alm-content');
    box.innerHTML = '';
    if (tab === 'caos') {
      // la tercera era: pactos, eventos y poderes de cada reino
      const era3 = PD.LEVELS.map((L, li) => [L, li]).filter(([L]) => L.era === 3);
      box.appendChild(el('<div class="alm-sec">📜 Pactos</div>'));
      box.appendChild(el('<p class="alm-nota">En la Tercera Era, antes de la primera ronda y cada diez rondas se ofrecen tres de estos pactos: tomas uno (o ninguno) y su ventaja y su carga duran toda la partida. No se repiten.</p>'));
      for (const P of PD.PACTOS) box.appendChild(el(`<div class="alm-card"><div class="alm-head"><span class="alm-ico">${P.icon}</span><div><h4>${P.name}</h4><div class="sub" style="color:#7affb0">✔ ${P.bueno}</div><div class="sub" style="color:#ff8a8a">✘ ${P.malo}</div></div></div></div>`));
      box.appendChild(el('<div class="alm-sec">⚡ Eventos</div>'));
      box.appendChild(el('<p class="alm-nota">Una ronda de cada cinco (la 8, la 13, … la 98) trae un evento. La vista previa lo anuncia antes, para que prepares la defensa.</p>'));
      for (const id in PD.EVENTOS) {
        const E = PD.EVENTOS[id], donde = era3.filter(([L]) => L.eventos.includes(id)).map(([L]) => L.short).join(' · ');
        box.appendChild(el(`<div class="alm-card"><div class="alm-head"><span class="alm-ico">${E.icon}</span><div><h4>${E.name}</h4><div class="sub">${donde}</div></div></div><p>${E.desc}</p></div>`));
      }
      box.appendChild(el('<div class="alm-sec">✨ Poderes del Reino</div>'));
      box.appendChild(el(`<p class="alm-nota">Se cargan eliminando enemigos (${PD.ENERGIA_MAX} de energía; los grandes y los jefes dan más) y se lanzan durante una ronda donde quieras, con el botón de abajo a la izquierda o la tecla V. Su daño crece con la ronda.</p>`));
      for (const [L] of era3) { const P = PD.PODERES[L.poder]; box.appendChild(el(`<div class="alm-card"><div class="alm-head"><span class="alm-ico">${P.icon}</span><div><h4>${P.name}</h4><div class="sub">${L.name}</div></div></div><p>${P.desc}</p></div>`)); }
      return;
    }
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
        if (b.ability && d.hero) stats.push('Habilidad: ' + PD.ABILITIES[b.ability].name);
        if (b.pct) stats.push(Math.round(b.pct * 1000) / 10 + '% de la vida/s');
        const pronto = d.realm !== undefined && enPrueba(d.realm) ? ' <span class="badge b-camo">Próximamente</span>' : '';
        const where = (d.hero ? `<span class="badge b-boss">♛ Héroe de ${PD.LEVELS[d.realm].name} · uno por partida</span>`
          : d.realm === undefined ? '' : `<span class="badge b-special">Nueva en ${PD.LEVELS[d.realm].name}</span>`) + pronto;
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
      ['Los grandes · rondas altas', ['fortaleza', 'ciudadela', 'leviatan', 'zepelin', 'dirigible', 'celeste', 'arca']],
      ['Reino 1 · Prado Esmeralda', ['musgo', 'chaman', 'enjambre']],
      ['Reino 2 · Dunas de Ámbar', ['excavador', 'escorpion', 'espejismo']],
      ['Reino 3 · Glaciar Cristal', ['golem', 'cristal', 'yeti']],
      ['Reino 4 · Caldera Volcánica', ['salamandra', 'magma', 'brasa', 'heraldo', 'ave']],
      ['Reino 5 · Nexo del Vacío', ['espectro', 'saboteador', 'magnetita', 'fractal', 'fractal2', 'fractal3', 'colosoVacio']],
      ['Jefes', ['reyEscarabajo', 'gusano', 'coloso', 'fenix', 'devorador']],
      ['Reino 6 · Pantano Sombrío', ['sapo', 'duende', 'bruma', 'cabezaHidra'], 5],
      ['Reino 7 · Cumbres Tormentosas', ['gargola', 'tormentoso'], 6],
      ['Reino 8 · Fosa Abisal', ['cangrejo', 'pulpo'], 7],
      ['Reino 9 · Ciudadela de Engranajes', ['automata', 'reparador'], 8],
      ['Reino 10 · Trono del Eclipse', ['purificador', 'martir', 'solGemelo', 'lunaGemela'], 9],
      ['Jefes de la Segunda Era', ['hidra', 'reyTrueno', 'kraken', 'mecatitan', 'eclipse'], 9],
      ['Reino 11 · Necrópolis Olvidada', ['esqueleto', 'nigromante', 'alma', 'filacteria'], 10],
      ['Reino 12 · Jardín de Esporas', ['seta', 'enredadera', 'polinizador'], 11],
      ['Reino 13 · Laberinto de Espejos', ['reflejo', 'prismaVivo', 'ilusion'], 12],
      ['Reino 14 · Archipiélago Celeste', ['templario', 'jinete', 'pirata', 'galeon'], 13],
      ['Reino 15 · La Noche Eterna', ['calabaza', 'semilla', 'murcielago', 'espantapajaros'], 14],
      ['Jefes de la Tercera Era', ['liche', 'reinaMicelio', 'reinaEspejos', 'tifon', 'jineteSinCabeza'], 14]
    ];
    for (const [title, ids, li] of sections) {
      box.appendChild(el(`<div class="alm-sec">${title}${li !== undefined && enPrueba(li) ? ' · próximamente' : ''}</div>`));
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
  const ponCursor = () => cv.classList.toggle('cur-grande', save.settings.cursor !== 'clasico');
  ponCursor();
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
    if (!puedeJugar(li)) { show('levels'); return; }
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
    if (enPrueba(li)) toast(`<b>Reino en pruebas</b>Se abre a todos ${cuandoAbre(li)}. Hasta entonces, solo para administradores: esta partida no guarda récords ni paga monedas.`, 'boss', null, 6500);
    if (!run) {
      toast(`<b>${game.L.name}</b>${game.L.subtitle}<br>Elige un defensor a la derecha, colócalo junto al camino y pulsa ▶.`, 'good', null, 6500);
      for (const id of realmTowers(li)) { const d = PD.TOWERS[id]; toast(`<b>Nueva defensa: ${d.name}</b>${d.desc}`, 'special', { tower: id }, 8000); }
      const hid = PD.heroOf(li);
      if (hid) toast(`<b>♛ Héroe del reino: ${PD.TOWERS[hid].name}</b>Uno por partida y muy caro, pero único. Está arriba en la tienda (tecla H).`, 'special', { tower: hid }, 8000);
      if (game.era3) {
        toast('<b>♛ Héroe a elección</b>En este reino puedes llamar a cualquiera de los diez héroes (uno por partida). Arriba en la tienda o con la tecla H.', 'special', null, 8000);
        const P = PD.PODERES[game.L.poder];
        if (P) toast(`<b>${P.icon} Poder del Reino: ${P.name}</b>${P.desc} Se carga eliminando enemigos; lánzalo con el botón de abajo a la izquierda o la tecla V.`, 'special', null, 9000);
      }
    }
    else toast(`<b>Partida reanudada</b>Ronda ${game.round + 1} de 100.`, 'good');
    construyePactos();
    if (game.pactoPendiente()) setTimeout(abrePacto, run ? 300 : 900);
  }

  // ---------------------- Tercera era: pactos y poder ----------------------
  // El pacto: tres cartas (ventaja y carga) o rechazarlas. Se elige antes de la ronda.
  function abrePacto() {
    if (!game || !game.pactoPendiente() || ui.modal) return;
    ui.autoT = -1;
    const ofs = game.ofertasPacto(), r = game.round;
    const carta = (P, i) => ({ label: `<span class="pc-ico">${P.icon}</span><span class="pc-txt"><b>${P.name}</b><span class="pc-b">✔ ${P.bueno}${P.oro ? ' (+' + fmt(P.oro(r)) + ' oro)' : ''}</span><span class="pc-m">✘ ${P.malo}</span></span>`, cls: 'pacto', fn: () => elige(i) });
    const elige = i => {
      if (!rec.pacto(i)) { sfx('error'); return; }
      guardaQuieto(); construyePactos(); updateHud(true); updateShop(); refreshInfo();
      sfx('upgradeMax');
    };
    modal(`<div class="big-ico">📜</div><h2>${r === 0 ? 'Un pacto para empezar' : 'Hora de un pacto'}</h2><p>${r === 0 ? 'Antes de la primera ronda' : 'Has resistido ' + r + ' rondas'}. Elige un pacto: cada uno trae una <b style="color:#7affb0">ventaja</b> y una <b style="color:#ff8a8a">carga</b> que duran toda la partida. También puedes rechazarlos.</p>`,
      ofs.map(carta).concat([{ label: 'Rechazar los pactos', cls: 'ghost', fn: () => elige(3) }]));
    $('#modal-box').classList.add('pactos');
  }
  // los pactos tomados, arriba a la izquierda del mapa (con su explicación al pasar el ratón)
  function construyePactos() {
    const box = $('#pactos');
    box.innerHTML = '';
    if (!game || !game.era3) { box.hidden = true; return; }
    box.hidden = false;
    for (const p of game.pactos) {
      const P = p.id && PD.PACTOS.find(q => q.id === p.id);
      if (!P) continue;
      const b = el(`<span class="pt">${P.icon}</span>`);
      b.addEventListener('mousemove', ev => showTip(`<b>${P.name}</b><span style="color:#7affb0">✔ ${P.bueno}</span><br><span style="color:#ff8a8a">✘ ${P.malo}</span><br><span class="tc">Desde la ronda ${p.r + 1}</span>`, ev.clientX, ev.clientY));
      b.addEventListener('mouseleave', hideTip);
      box.appendChild(b);
    }
  }
  // el botón del Poder del Reino (se carga matando; luego se apunta en el mapa)
  let poderKey = '';
  function updatePoder() {
    const b = $('#poder');
    if (!game || !game.era3 || !game.L.poder) { b.hidden = true; poderKey = ''; return; }
    const P = PD.PODERES[game.L.poder];
    if (poderKey !== game.L.poder) {
      poderKey = game.L.poder;
      b.hidden = false;
      b.style.setProperty('--pc', P.color);
      b.innerHTML = `<div class="pw-fill"></div><span class="pw-ico">${P.icon}</span><span class="pw-k">V</span>`;
    }
    const f = Math.min(1, game.energia / PD.ENERGIA_MAX), listo = game.poderListo();
    b.querySelector('.pw-fill').style.height = (f * 100) + '%';
    b.classList.toggle('ready', listo);
    b.classList.toggle('sel', ui.placing === PODER);
  }
  function apuntaPoder() {
    if (!game || !game.era3) return;
    if (ui.placing === PODER) { setPlacing(null); return; }
    if (!game.poderListo()) { sfx('error'); toast(game.active ? `<b>${PD.PODERES[game.L.poder].name}</b>Aún se está cargando: elimina más enemigos (${Math.floor(game.energia)} / ${PD.ENERGIA_MAX}).` : `<b>${PD.PODERES[game.L.poder].name}</b>Se lanza durante una ronda.`, '', null, 2200); return; }
    setPlacing(PODER);
  }
  $('#poder').addEventListener('click', apuntaPoder);
  $('#poder').addEventListener('mousemove', ev => { if (!game || !game.L.poder) return; const P = PD.PODERES[game.L.poder]; showTip(`<b>${P.icon} ${P.name}</b>${P.desc}<br><span class="tc">Energía ${Math.floor(game.energia)} / ${PD.ENERGIA_MAX} · se carga eliminando enemigos · tecla V</span>`, ev.clientX, ev.clientY); });
  $('#poder').addEventListener('mouseleave', hideTip);
  // elegir héroe entre los diez (tercera era)
  function eligeHeroe() {
    if (!game || game.hasHero() || ui.modal) return;
    const ids = PD.heroesOf(game.li);
    if (ids.length === 1) { setPlacing(ui.placing === ids[0] ? null : ids[0]); return; }
    ui.paused = true;
    modal(`<h2>♛ Elige tu héroe</h2><p>Uno por partida. Cada uno trae su aura y su habilidad automática.</p><div class="heroes-pick"></div>`, [{ label: 'Cancelar', fn: () => { ui.paused = false; } }]);
    const box = $('#modal-box .heroes-pick');
    for (const id of ids) {
      const d = PD.TOWERS[id], c = game.towerCost(id);
      const it = el(`<button class="hp-it ${game.money < c ? 'poor' : ''}"><canvas width="88" height="88"></canvas><b>${d.name.split(',')[0]}</b><small>${PD.ABILITIES[d.base.ability].name} · ${fmt(c)}</small></button>`);
      towerIcon(it.querySelector('canvas'), id, [0, 0]);
      it.addEventListener('click', () => { closeModal(); ui.paused = false; setPlacing(id); });
      it.addEventListener('mousemove', ev => showTip(`<b>${d.name}</b><span class="tc">${fmt(c)} oro</span><br>${d.desc}`, ev.clientX, ev.clientY));
      it.addEventListener('mouseleave', hideTip);
      box.appendChild(it);
    }
    $('#modal-box').classList.add('heroes');
  }

  // ------------------------------ Tienda ---------------------------------
  function buildShop() {
    const shop = $('#shop');
    shop.innerHTML = '';
    const hid = PD.heroOf(game.li);
    if (!hid && PD.heroesOf(game.li).length > 1) {
      const it = el(`<div class="shop-item hero" data-id="${HEROE}"><span class="nw">♛ HÉROE</span><span class="hk">H</span><canvas width="108" height="108"></canvas><div class="nm">A elección</div><div class="ct">Elegir</div></div>`);
      towerIcon(it.querySelector('canvas'), game.towers.find(t => t.def.hero) ? game.towers.find(t => t.def.hero).type : 'heroeeclipse', [0, 0]);
      it.addEventListener('click', eligeHeroe);
      it.addEventListener('mousemove', ev => showTip('<b>♛ Héroe a elección</b>En la Tercera Era puedes llamar a cualquiera de los diez héroes, uno por partida.<br><span class="tc">Tecla H.</span>', ev.clientX, ev.clientY));
      it.addEventListener('mouseleave', hideTip);
      shop.appendChild(it);
    }
    if (hid) {
      const d = PD.TOWERS[hid];
      const it = el(`<div class="shop-item hero" data-id="${hid}"><span class="nw">♛ HÉROE</span><span class="hk">H</span><canvas width="108" height="108"></canvas><div class="nm">${d.name.split(',')[0]}</div><div class="ct">${fmt(d.cost)}</div></div>`);
      towerIcon(it.querySelector('canvas'), hid, [0, 0]);
      it.addEventListener('click', () => { if (!game.hasHero()) setPlacing(ui.placing === hid ? null : hid); });
      it.addEventListener('mousemove', ev => showTip(`<b>${d.name}</b><span class="tc">${fmt(d.cost)} oro</span> · Héroe (uno por partida)<br>${d.desc}<br><span class="tc">Puede subir sus dos caminos hasta el nivel 4 y uno de ellos al nivel 5.</span>`, ev.clientX, ev.clientY));
      it.addEventListener('mouseleave', hideTip);
      shop.appendChild(it);
    }
    {
      const it = el(`<div class="shop-item pinchos" data-id="${PINCHOS}"><span class="hk">K</span><canvas width="108" height="108"></canvas><div class="nm">Pinchos</div><div class="ct">${fmt(game.spikeCost())}</div></div>`);
      const c = it.querySelector('canvas').getContext('2d');
      c.save(); c.scale(108 / 34, 108 / 34); PD.drawSpikes(c, 17, 18, 1); c.restore();
      it.addEventListener('click', () => setPlacing(ui.placing === PINCHOS ? null : PINCHOS));
      it.addEventListener('mousemove', ev => showTip(`<b>Pinchos</b><span class="tc">${fmt(game.spikeCost())} oro</span> · Trampa<br>Un montón de ${PD.PINCHOS.puas} púas que se tira sobre el camino: cada enemigo de tierra que pasa encima recibe un golpe y gasta una púa (los grandes y los jefes reciben más daño, pero gastan más). Duran hasta gastarse. El daño y el precio suben con la ronda; hasta ${PD.PINCHOS.max} montones a la vez.<br><span class="tc">Tecla K · Mayús para tirar varios.</span>`, ev.clientX, ev.clientY));
      it.addEventListener('mouseleave', hideTip);
      shop.appendChild(it);
    }
    shopTowers(game.li).forEach((id, i) => {
      const d = PD.TOWERS[id];
      const fresh = d.realm === game.li ? '<span class="nw">NUEVA</span>' : '';
      const it = el(`<div class="shop-item${fresh ? ' fresh' : ''}" data-id="${id}">${fresh}<span class="hk">${(HOTKEYS[i] || '').toUpperCase()}</span><canvas width="108" height="108"></canvas><div class="nm">${d.name}</div><div class="ct">${fmt(game.towerCost(id))}</div></div>`);
      towerIcon(it.querySelector('canvas'), id, [0, 0]);
      it.addEventListener('click', () => setPlacing(ui.placing === id ? null : id));
      it.addEventListener('mousemove', ev => showTip(`<b>${d.name}</b><span class="tc">${fmt(game.towerCost(id))} oro</span> · ${DTYPE[d.base.dtype] || 'Apoyo'}<br>${d.desc}`, ev.clientX, ev.clientY));
      it.addEventListener('mouseleave', hideTip);
      shop.appendChild(it);
    });
    updateShop();
  }
  function updateShop() {
    if (!game) return;
    document.querySelectorAll('.shop-item').forEach(it => {
      if (it.dataset.id === PINCHOS) {
        const c = game.spikeCost(), lleno = game.spikes.length >= PD.PINCHOS.max;
        it.classList.toggle('poor', game.money < c || lleno);
        it.classList.toggle('sel', ui.placing === PINCHOS);
        it.querySelector('.ct').textContent = lleno ? 'Máximo' : fmt(c);
        return;
      }
      if (it.dataset.id === HEROE) {
        const puesto = game.hasHero();
        it.classList.toggle('used', puesto);
        it.classList.toggle('sel', !!(ui.placing && PD.TOWERS[ui.placing] && PD.TOWERS[ui.placing].hero));
        it.querySelector('.ct').textContent = puesto ? 'En el mapa' : 'Elegir';
        return;
      }
      const d = PD.TOWERS[it.dataset.id], c = game.towerCost(it.dataset.id);
      it.classList.toggle('poor', game.money < c);
      it.classList.toggle('sel', ui.placing === it.dataset.id);
      it.querySelector('.ct').textContent = fmt(c);
      if (d.hero) {
        const puesto = game.hasHero();
        it.classList.toggle('used', puesto);
        it.querySelector('.ct').textContent = puesto ? 'En el mapa' : fmt(c);
      }
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
    if (k === 'hero') {
      const A = PD.ABILITIES[s.ability];
      rows.push(['Daño', `<b>${n1(s.dmg)}</b>`]);
      if (s.atk === 'slam') rows.push(['Golpes/s', `<b>${n1(1 / s.cd)}</b>`]);
      else rows.push(['Ataques/s', `<b>${n1(1 / s.cd)}${s.count > 1 ? ' ×' + s.count : s.bolts > 1 ? ' ×' + s.bolts : s.shells > 1 ? ' ×' + s.shells : ''}</b>`]);
      rows.push(['Alcance', `<b>${Math.round(s.range)}</b>`]);
      if (s.lifeRegen) rows.push(['Cura / ronda', `<b>+${s.lifeRegen} ❤</b>`]);
      if (s.shredAura) rows.push(['Quita blindaje', `<b>${s.shredAura}</b>`]);
      if (s.ampAura) rows.push(['Daño recibido', `<b>+${Math.round(s.ampAura * 100)}%</b>`]);
      if (s.slowAura) rows.push(['Aura lenta', `<b>${Math.round(s.slowAura * 100)}%</b>`]);
      if (s.buffDmgMult) rows.push(['Torres cercanas', `<b>x${s.buffDmgMult}${s.buffRate ? ' · +' + Math.round(s.buffRate * 100) + '% vel.' : ''}</b>`]);
      else if (s.buffRate || s.buffRange) rows.push(['Torres cercanas', `<b>+${Math.round((s.buffRange || 0) * 100)}% alcance · +${Math.round((s.buffRate || 0) * 100)}% vel.</b>`]);
      if (s.goldAura) rows.push(['Oro en su alcance', `<b>+${Math.round((s.goldAura - 1) * 100)}%</b>`]);
      if (s.heroDiscount) rows.push(['Mejoras cercanas', `<b>−${Math.round(s.heroDiscount * 100)}%</b>`]);
      if (s.purgeAura) rows.push(['Su luz', '<b class="yes">Revela y quita invulnerabilidad</b>']);
      rows.push(['Habilidad', `<b>${A.name} · ${abCd(t)} s</b>`]);
      rows.push(['Camuflados', s.atk === 'slam' ? '<b class="yes">Área</b>' : yn(s.camo)]);
      rows.push(['Tipo', `<b>${DTYPE[s.dtype] || '-'}</b>`]);
      rows.push(['Daño total', `<b class="dealt">${fmt(t.dealt)}</b>`]);
      return rows;
    }
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
    if (k === 'rod') {
      rows.push(['Daño', `<b>${n1(s.dmg)} × ${s.strikes || 1}</b>`]);
      rows.push(['Saltos', `<b>${s.jumps}</b>`]);
      rows.push(['Cada', `<b>${n1(s.cd)} s</b>`]);
      rows.push(['Protege', '<b class="yes">Torres en su alcance</b>']);
      if (s.buffRate || s.buffDmgMult) rows.push(['Protegidas', `<b>${s.buffDmgMult ? 'x' + s.buffDmgMult + ' daño' : ''}${s.buffRate ? ' +' + Math.round(s.buffRate * 100) + '% vel.' : ''}</b>`]);
      rows.push(['Alcance', `<b>${Math.round(s.range)}</b>`]);
      rows.push(['Tipo', `<b>${DTYPE[s.dtype] || '-'}</b>`]);
      rows.push(['Daño total', `<b class="dealt">${fmt(t.dealt)}</b>`]);
      return rows;
    }
    if (k === 'frog' || k === 'bubble' || k === 'bell' || k === 'disint') {
      if (k === 'disint') { rows.push(['Vida/s', `<b>${n1(s.pct * 100)}% + ${n1(s.dps)}</b>`]); rows.push(['Rayos', `<b>${s.beams}</b>`]); }
      else rows.push(['Daño', `<b>${n1(s.dmg)}</b>`]);
      if (k === 'frog') { rows.push(['Sapo', `<b>${n1(s.frogDur)} s${s.frogBig ? ' (grandes ' + s.frogBig + ' s)' : ''}</b>`]); rows.push(['Radio', `<b>${Math.round(s.radius)}</b>`]); }
      if (k === 'bubble') { rows.push(['Atrapa', `<b>${n1(s.trapDur)} s${s.trapBig ? ' (grandes ' + s.trapBig + ' s)' : ''}</b>`]); rows.push(['Burbujas', `<b>${s.count || 1} / ${n1(s.cd)} s</b>`]); }
      if (k === 'bell') { rows.push(['Eco', `<b>${Math.round(s.eco * 100)}% del daño</b>`]); rows.push(['Toca cada', `<b>${n1(s.cd)} s</b>`]); }
      if (k !== 'bubble' && s.cd && k !== 'bell') rows.push(['Ataques/s', `<b>${n1(1 / s.cd)}</b>`]);
      rows.push(['Alcance', `<b>${Math.round(s.range)}</b>`]);
      rows.push(['Camuflados', k === 'bell' ? '<b class="yes">Área</b>' : yn(s.camo)]);
      rows.push(['Tipo', `<b>${DTYPE[s.dtype] || '-'}</b>`]);
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
    const pips = P.ups.map((u, i) => `<span class="pip ${i < tier ? 'f' : ''}${i > 3 ? ' p5' : ''}"></span>`).join('');
    let body;
    if (!next) body = `<div class="up-max">★ Camino al máximo</div>`;
    else if (!game.canUpgrade(t, p)) body = `<div class="up-lock">🔒 Bloqueado: ${t.def.hero ? 'el otro camino ya llegó al nivel 5 (solo uno puede).' : 'el otro camino ya pasó del nivel 2.'}</div>`;
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
      ${d.hero ? `<div class="sub" style="font-size:12px;color:var(--gold)">♛ Héroe del reino: uno por partida. Puede subir sus <b>dos</b> caminos hasta el nivel 4 y <b>uno</b> de ellos al nivel 5.</div>` : ''}
      ${ab ? `<div class="sub" style="font-size:12px;color:var(--violet)">Habilidad automática: <b>${ab.name}</b> — ${ab.desc} Se lanza sola cuando hay peligro (recarga ${abCd(t)} s).</div>` : ''}
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
      const fin = t.tiers[p] === t.def.paths[p].ups.length;
      sfx(t.tiers[p] >= 4 ? 'upgradeMax' : 'upgrade', t.x);
      if (fin || t.tiers[p] === 4) toast(`<b>${up.name}</b>${!fin && game.canUpgrade(t, p) ? '¡Nivel 4! Este camino aún puede llegar al nivel 5 (solo uno de los dos).' : '¡Mejora definitiva desbloqueada!'}`, 'good', { tower: t.type });
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
    if (pv.evento) { const E = PD.EVENTOS[pv.evento]; box.appendChild(el(`<span class="ev" title="${E.desc}">${E.icon} ${E.name}</span>`)); }
    if (game.pactoPendiente()) box.appendChild(el('<span class="ev">📜 Pacto</span>'));
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
        b.addEventListener('mousemove', ev => showTip(`<b>${A.name}</b>${A.desc}<br><span class="tc">Automática · recarga ${abCd(groups[id][0])} s</span>`, ev.clientX, ev.clientY));
        b.addEventListener('mouseleave', hideTip);
        box.appendChild(b);
      }
    }
    box.querySelectorAll('.abil').forEach(b => {
      const list = groups[b.dataset.id] || [];
      let best = Infinity, cd = 1;
      for (const t of list) { const v = Math.max(0, t.abilityCd); if (v < best) { best = v; cd = abCd(t); } }
      const frac = Math.min(1, best / cd);
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
    if (game.pactoPendiente()) { abrePacto(); return; }
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
      <label>Efectos <input type="range" id="v-sfx" min="0" max="1" step="0.05" value="${save.settings.sfx}"></label>
      <label>Cursor <select id="v-cur"><option value="grande">Grande (mira amarilla)</option><option value="clasico">Clásico</option></select></label></div>`, [
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
    const vc = $('#v-cur');
    vc.value = save.settings.cursor === 'clasico' ? 'clasico' : 'grande';
    vc.addEventListener('change', () => { save.settings.cursor = vc.value; writeSave(); ponCursor(); });
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
          if (ev.evento) { const E = PD.EVENTOS[ev.evento]; toast(`<b>${E.icon} Evento: ${E.name}</b>${E.desc}`, 'boss', null, 6500); sfx('bossSpawn'); }
          break;
        }
        case 'pacto': if (ev.pacto) toast(`<b>${ev.pacto.icon} ${ev.pacto.name}</b><span style="color:#7affb0">✔ ${ev.pacto.bueno}</span><br><span style="color:#ff8a8a">✘ ${ev.pacto.malo}</span>`, 'special', null, 5000); else toast('<b>Sin pacto</b>Esta vez sigues por tu cuenta.', '', null, 2500); break;
        case 'poder': sfx('upgradeMax', ev.x); break;
        case 'filacteria': toast(`<b>¡${ev.enemy.name || ev.enemy.d.name} esconde su alma!</b>Es INVULNERABLE hasta que destruyas sus 3 Filacterias.`, 'boss', { enemy: 'filacteria' }, 5000); break;
        case 'vendaval': toast('<b>¡Vendaval!</b>El alcance de tus torres baja un 35% unos segundos (salvo las que protege un Pararrayos).', 'boss', null, 2600); break;
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
        case 'heads': if (ev.enemy.d.heads.type === 'cabezaHidra') toast(`<b>¡A la ${ev.enemy.d.name} le crecen cabezas!</b>Hazla arder: el fuego corta su regeneración.`, 'boss', { enemy: 'cabezaHidra' }, 3200);
          else toast(`<b>¡${ev.enemy.name || ev.enemy.d.name} hace brotar ${PD.ENEMIES[ev.enemy.d.heads.type].name}s!</b>`, 'boss', { enemy: ev.enemy.d.heads.type }, 3200); break;
        case 'split': sfx('bossSpawn'); toast(`<b>¡${ev.enemy.d.name} se parte en dos!</b>El Sol resiste lo físico y lo explosivo; la Luna, la magia.`, 'boss', { enemy: ev.enemy.type }, 6000); break;
        case 'robo': toast(`<b>¡Te robaron ${fmt(ev.amount)} de oro!</b>Un Duende Ladrón se escapó con su botín.`, 'boss', { enemy: 'duende' }, 2600); break;
        case 'ciclo': { const nom = { fisico: 'lo físico y lo explosivo', magia: 'el arcano y la electricidad', elemental: 'el fuego, el hielo, el ácido y el vapor' }[ev.enemy.inmune]; toast(`<b>${ev.enemy.name || ev.enemy.d.name}</b>Ahora casi inmune a ${nom}.`, 'boss', null, 2200); break; }
        case 'roundEnd': {
          sfx('roundEnd'); sfx('coin');
          toast(`<b>Ronda ${ev.round} superada</b>+${fmt(ev.bonus)} oro${ev.farm ? ` · cosecha +${fmt(ev.farm)}` : ''}`, 'good', null, 2600);
          const li = game.li, prueba = enPrueba(li);
          if (!prueba) save.best[li] = Math.max(save.best[li] || 0, ev.round);
          if (ev.round >= PD.UNLOCK_ROUND && li < PUB - 1) save.unlocked = Math.max(save.unlocked, li + 1);
          if (!prueba) anota(li, ev.round);   // los reinos en pruebas no guardan récords
          if (game.won) { delete save.runs[li]; if (!prueba) save.won[li] = true; writeSave(); }
          else guardaPartida();
          if (!prueba) manda(li);
          buildPreview();
          if (game.pactoPendiente()) setTimeout(abrePacto, 700);
          else if (ui.auto && !game.won) ui.autoT = 1.2;
          break;
        }
        case 'unlock': {
          const li = game.li;
          ui.autoT = -1;
          sfx('unlock');
          if (li < PUB - 1) {
            ui.paused = true;
            const nt = realmTowers(li + 1).map(id => PD.TOWERS[id].name).join(' y ');
            modal(`<div class="big-ico">🔓</div><h2>¡Reino desbloqueado!</h2><p>Has resistido ${PD.UNLOCK_ROUND} rondas en <b>${game.L.name}</b>.<br>Ya puedes jugar <b>${PD.LEVELS[li + 1].name}</b>${nt ? `, con dos defensas nuevas: <b>${nt}</b>` : ''}.</p><p style="font-size:13px;color:var(--muted)">Sigue hasta la ronda 100 para conseguir el trofeo de este reino.</p>`, [
              { label: 'Seguir hasta la ronda 100', cls: 'go', fn: () => { ui.paused = false; } },
              { label: `Ir a ${PD.LEVELS[li + 1].name}`, cls: 'gold', fn: () => { exitGame(); } }
            ]);
          } else toast(`<b>¡Mitad de ${game.L.short} superada!</b>Solo quedan 50 rondas para la victoria total.`, 'good');
          break;
        }
        case 'victory': {
          ui.paused = true; ui.autoT = -1;
          sfx('victory');
          const li = game.li;
          const hasta = n => PD.LEVELS.slice(0, n).every((L, i) => save.won[i]);
          const all = hasta(PD.LEVELS.length) ? 'quince' : li < PUB && hasta(PUB) ? 'cinco' : '';
          modal(`<div class="big-ico">🏆</div><h2>¡Victoria!</h2><p>Has completado las 100 rondas de <b>${game.L.name}</b>.<br>Eliminados: ${fmt(game.stats.kills)} · Vidas restantes: ${fmt(game.lives)}</p>${all ? `<p><b>¡Has conquistado los ${all} reinos! Eres un verdadero PRO DEFENDER.</b></p>` : ''}`, [
            ...(li < PD.LEVELS.length - 1 && puedeJugar(li + 1) && (segunda(li + 1) || save.unlocked > li) ? [{ label: `Jugar ${PD.LEVELS[li + 1].name}`, cls: 'gold', fn: () => { game = null; rec = null; startGame(li + 1, save.runs[li + 1] || null); } }] : []),
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
          if (!enPrueba(li)) save.best[li] = Math.max(save.best[li] || 0, game.round);
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
    if (ui.placing === PODER) {
      const ok = rec.poder(p.x, p.y);
      sfx(ok ? 'place' : 'error', p.x);
      if (ok) setPlacing(null);
      if (ev.pointerType !== 'mouse') ui.mouse = null;
      return;
    }
    if (ui.placing === PINCHOS) {
      const sp = rec.pinchos(p.x, p.y);
      sfx(sp ? 'place' : 'error', p.x);
      if (sp) { if (!ev.shiftKey || game.money < game.spikeCost()) setPlacing(null); else updateShop(); guardaQuieto(); }
      if (ev.pointerType !== 'mouse') ui.mouse = null;
      return;
    }
    if (ui.placing) {
      const t = rec.colocar(ui.placing, p.x, p.y);
      if (!t) sfx('error', p.x);
      if (t) {
        sfx('place', p.x);
        if (!ev.shiftKey || game.money < game.towerCost(t.type) || t.def.hero) setPlacing(null);
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
    if (k === 'k' || k === 'K') { setPlacing(ui.placing === PINCHOS ? null : PINCHOS); return; }
    if (k === 'h' || k === 'H') { const id = PD.heroOf(game.li); if (id && !game.hasHero()) setPlacing(ui.placing === id ? null : id); else if (!id) eligeHeroe(); return; }
    if ((k === 'v' || k === 'V') && game.era3) { apuntaPoder(); return; }
    const hi2 = HOTKEYS.indexOf(k.toLowerCase());
    if (hi2 >= 0) { const id = shopTowers(game.li)[hi2]; if (id) setPlacing(ui.placing === id ? null : id); return; }
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
    updatePoder();
    slowT -= dt;
    if (slowT <= 0) { slowT = 0.2; updateShop(); refreshInfo(); if (ui.selected && game.towers.indexOf(ui.selected) < 0) { ui.selected = null; renderInfo(); } }
  }
  requestAnimationFrame(loop);

  // ------------------------- Clasificación y monedas -------------------------
  // Lo que la tabla del club sabe de cada reino (tu ronda récord; null: aún no se sabe).
  // Cada ronda que la supera queda anotada (`save.pend`) y se manda a Juegos con la prueba
  // de la partida: la página la rehace (verifica/prodefender.js), la guarda (compacta, y
  // borrando la del récord anterior: una sola por reino) y eso paga monedasRonda(li) por
  // ronda. Lo anotado se borra cuando la tabla lo confirma; si la pestaña se cerró antes de
  // que la página lo guardara, se manda la próxima vez que se abra el juego (recorreTablas).
  const nube = PD.LEVELS.map(() => null), enviada = PD.LEVELS.map(() => 0);
  let verTabla = -1;
  function escuchaTabla(li) {
    if (!EN_LA_NUBE || verTabla === li || enPrueba(li)) return;
    verTabla = li; CLUB.category(PR.categoria(li));
    $('.pd-lado-tit').textContent = '🏆 ' + PD.LEVELS[li].name;
  }
  if (!EN_LA_NUBE) $('.pd-lado').hidden = true;
  function adoptaNube() {
    let cambio = false;
    nube.forEach((n, li) => {
      if (!n) return;
      if (n > (save.best[li] || 0)) { save.best[li] = n; cambio = true; }
      if (n >= PD.UNLOCK_ROUND && li < PUB - 1 && save.unlocked < li + 1) { save.unlocked = li + 1; cambio = true; }
      if (n >= PD.MAX_ROUND && !save.won[li]) { save.won[li] = true; cambio = true; }
    });
    if (cambio) writeSave();
    return cambio;
  }
  window.addEventListener('club-tabla', e => {
    const li = PR.reinoDe(e.detail && e.detail.categoria);
    if (li < 0) return;
    nube[li] = Math.max(nube[li] || 0, (e.detail.propio && e.detail.propio.puntos) || 0);
    if (save.pend[li] && nube[li] >= save.pend[li].r) { delete save.pend[li]; writeSave(); }   // ya está en la tabla
    if (adoptaNube() || screen === 'levels') { if (screen === 'levels') buildLevels(); }
    if (esperaTabla && esperaTabla.li === li) esperaTabla.listo();
  });
  // Al abrir, una pasada por las tablas para saber tus récords (y qué reinos tienes abiertos).
  // Los reinos aún en pruebas no tienen tabla que mirar.
  let esperaTabla = null;
  async function recorreTablas() {
    if (!EN_LA_NUBE) return;
    for (let li = 0; li < PD.LEVELS.length; li++) {
      if (game) return;   // ya se está jugando: esa tabla es la que se escucha
      if (enPrueba(li) || nube[li] !== null) continue;
      await new Promise(listo => {
        const t = setTimeout(() => { esperaTabla = null; listo(); }, 4000);
        esperaTabla = { li, listo: () => { clearTimeout(t); esperaTabla = null; listo(); } };
        verTabla = -1; escuchaTabla(li);
      });
    }
    if (!game) { let ul = 0; PD.LEVELS.forEach((L, li) => { if (li <= save.unlocked && li < PUB) ul = li; }); escuchaTabla(ul); if (screen === 'levels') buildLevels(); }
    // Lo que quedó anotado y la tabla no tiene (la pestaña se cerró antes de guardarlo).
    for (const k of Object.keys(save.pend)) if (!game || game.li !== +k) manda(+k);
  }
  // Una ronda que supera el récord: se anota con su prueba (se guarda con la partida local).
  function anota(li, ronda) {
    if (!EN_LA_NUBE || !rec || enPrueba(li)) return;
    const antes = Math.max(nube[li] || 0, enviada[li]);
    if (ronda <= antes || (save.pend[li] && save.pend[li].r >= ronda)) return;
    save.pend[li] = { r: ronda, t: rec.tiempo(), p: rec.prueba() };
    toast(`<b>¡Récord del reino: ronda ${ronda}!</b>Juegos la comprueba y te paga 🪙 ${fmt((ronda - antes) * monedasRonda(li))}`, 'good', null, 3200);
  }
  // Manda a Juegos el récord anotado del reino, si la tabla todavía no lo tiene.
  function manda(li) {
    const P = save.pend[li];
    if (!EN_LA_NUBE || !P || enPrueba(li)) return;
    if (P.r <= Math.max(nube[li] || 0, enviada[li])) { if (P.r <= (nube[li] || 0)) { delete save.pend[li]; writeSave(); } return; }
    enviada[li] = P.r;
    CLUB.result({ categoria: PR.categoria(li), puntos: P.r, tiempo: P.t }, P.p);
    // Las monedas las avisa Juegos cuando termina de comprobar la partida (puede tardar unos segundos).
  }
  window.addEventListener('club-rechazo', e => {
    const li = PR.reinoDe(e.detail && e.detail.categoria);
    if (li < 0) return;
    const motivo = String(e.detail.motivo || '');
    // Un rechazo no se vuelve a mandar; «No se pudo comprobar…» (el verificador falló) sí, la próxima vez.
    if (save.pend[li] && !/^No se pudo comprobar/.test(motivo)) { delete save.pend[li]; writeSave(); }
    toast(`<b>Esta ronda no se guardó</b>${motivo.replace(/[<&]/g, '')}`, 'boss', null, 7000);
  });
  recorreTablas();
  // A medianoche de Chile se abre el reino del día: la pantalla de reinos se rehace sola
  // y se lee la tabla del recién abierto.
  let hoy = PD.diaChile();
  setInterval(() => {
    const d = PD.diaChile();
    if (d === hoy) return;
    hoy = d;
    if (screen === 'levels') buildLevels();
    if (screen === 'almanac') buildAlmanac(almTab);
    recorreTablas();
  }, 60000);
})();
