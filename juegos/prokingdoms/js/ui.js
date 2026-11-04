// Interfaz: barra de recursos, panel de selección, menú, ventanas, avisos y descripción al pasar el mouse.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const el = U.el;
  const UI = (PK.UI = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;

  // ---------- Piezas reutilizables ----------
  UI.resIcon = r => el('img', { class: 'ico', src: Sp.icon(r === 'coins' ? 'coin' : r), alt: '', title: r === 'coins' ? 'Monedas' : D.RES[r] ? D.RES[r].name : r });
  UI.amount = (r, n) => el('span', { class: 'amt' }, UI.resIcon(r), U.fmt(n));
  UI.costEl = function (cost, mult, gain) {
    mult = mult || 1;
    return el('span', { class: 'cost' }, Object.keys(cost).map(r => {
      const n = Math.ceil(cost[r] * mult), bad = !gain && r !== 'coins' && (S().res[r] || 0) < n;
      return el('span', { class: 'amt' + (bad ? ' bad' : '') }, UI.resIcon(r), U.fmt(n));
    }));
  };
  UI.btn = function (label, fn, o) {
    o = o || {};
    const b = el('button', { class: 'btn' + (o.small ? ' small' : '') + (o.cls ? ' ' + o.cls : ''), disabled: o.disabled, title: o.title }, label);
    if (!b.textContent.trim() && (o.aria || o.title)) b.setAttribute('aria-label', o.aria || o.title);
    b.addEventListener('click', e => { e.stopPropagation(); if (!b.disabled) fn(e); });
    return b;
  };
  // Taller parado por la reserva de la bodega: por qué y un botón «Producir igual» (b.sinReserva) solo para él.
  UI.reservaRow = function (b) {
    const r = G().reservaDe(b);
    if (!r && !b.sinReserva) return '';
    return el('div', { class: 'row' },
      el('span', { class: 'small ' + (r ? 'warn-t' : 'muted') }, r ? G().reservaText(r) + '. ' : 'Este taller ignora la reserva de la bodega. '),
      UI.btn(b.sinReserva ? 'Respetar reserva' : 'Producir igual', () => { b.sinReserva = !b.sinReserva; UI.refreshPanel(true); }, { small: true, cls: b.sinReserva ? '' : 'gold' }));
  };
  // Pantalla táctil: cambia los textos de ayuda de "clic derecho" a "toca".
  UI.isTouch = () => !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  UI.hint = (mouse, touch) => (UI.isTouch() ? touch : mouse);
  // «Nombre (tú)», salvo que el nombre ya sea «Tú» (el de siempre sin nombre): salía «Tú (tú)».
  UI.yo = name => (!name || /^t[úu]$/i.test(name.trim()) ? 'Tú' : name + ' (tú)');

  // ---------- Avisos ----------
  let toastBox, lastToast = {};
  // act (opcional): { label, fn } agrega un botón al aviso, que dura más para dar tiempo a tocarlo.
  // UI.mute: los consejeros (js/consejo.js) actúan sin llenar la pantalla de avisos; lo suyo va al informe.
  UI.toast = function (text, kind, act) {
    if (!toastBox || UI.mute) return;
    const now = performance.now();
    if (lastToast[text] && now - lastToast[text] < 3000) return;
    lastToast[text] = now;
    const life = act ? 12000 : kind === 'epic' || kind === 'bad' ? 6500 : 4200;
    const close = t => { clearTimeout(t._tm); t.classList.add('out'); setTimeout(() => t.remove(), 400); };
    // Avisos repetidos se agrupan (playtest): si ya hay uno igual a la vista (los números no cuentan), se
    // actualiza su texto, suma «×N», vuelve arriba y reinicia su tiempo, en vez de apilar otro.
    const key = (kind || 'info') + '|' + text.replace(/\d+([.,]\d+)*/g, '#');
    const same = [...toastBox.children].find(o => o._key === key && !o.classList.contains('out'));
    if (same) {
      same._n = (same._n || 1) + 1;
      same.firstChild.textContent = text;
      same._cnt.textContent = '×' + same._n;
      same._cnt.style.display = '';
      toastBox.prepend(same);
      clearTimeout(same._tm); same._tm = setTimeout(() => close(same), life);
      return;
    }
    const cnt = el('b', { class: 'toast-n', style: { display: 'none' } });
    const t = el('div', { class: 'toast ' + (kind || 'info') + (act ? ' act' : ''), title: 'Toca para cerrar' }, el('span', null, text), cnt);
    t._key = key; t._cnt = cnt;
    if (act) t.append(UI.btn(act.label, () => { act.fn(); t.remove(); }, { small: true, cls: 'gold' }));
    t.addEventListener('click', () => { clearTimeout(t._tm); t.classList.add('out'); setTimeout(() => t.remove(), 250); });
    toastBox.prepend(t);
    while (toastBox.children.length > 5) toastBox.lastChild.remove();
    t._tm = setTimeout(() => close(t), life);
  };
  UI.flashTarget = function (x, y) {
    const f = el('div', { class: 'flash', style: { left: x + 'px', top: y + 'px' } });
    document.body.append(f);
    setTimeout(() => f.remove(), 450);
  };

  // ---------- Scroll y toques ----------
  // Las ventanas se redibujan cada segundo y el panel cada medio segundo (se recrea todo). Antes se perdía el
  // desplazamiento de lo que no tuviera la clase .scroll (la página derecha del Libro, listas, el panel): uno
  // bajaba y «se subía solo». Ahora se guarda el de cada elemento, por su posición en el árbol, y se repone.
  function snapScroll(root) {
    const out = [], all = [root, ...root.querySelectorAll('*')];
    all.forEach((e, i) => { if (e.scrollTop || e.scrollLeft) out.push([i, e.scrollTop, e.scrollLeft, e.className]); });
    return out;
  }
  function restoreScroll(root, snap) {
    if (!snap || !snap.length) return;
    const all = [root, ...root.querySelectorAll('*')];
    for (const [i, t, l, c] of snap) if (all[i] && all[i].className === c) { all[i].scrollTop = t; all[i].scrollLeft = l; }
  }
  // Mientras el dedo (o la rueda) está moviendo algo, no se redibuja solo: el redibujo cortaba el deslizamiento.
  let modalTouch = 0, panelTouch = 0;
  const recent = t => performance.now() - t < 1500;
  function watchTouch(node, set) {
    for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchmove', 'scroll']) node.addEventListener(ev, e => { if (ev !== 'pointermove' || e.buttons) set(); }, { capture: true, passive: true });
  }

  // ---------- Ventanas ----------
  let modal = null;
  // La meta de la próxima era (tocar «Era» en la barra): requisitos, costo y cuánto falta de cada cosa.
  UI.openEraGoal = function () {
    UI.modal('eraGoal', 'Próxima era', body => {
      const st = S(), g = G();
      if (st.eraProg) {
        body.append(el('h3', null, 'Avanzando a ' + D.eraName(st.eraProg.to)),
          el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: (st.eraProg.t / st.eraProg.total) * 100 + '%' } }), el('span', null, U.fmtTime(st.eraProg.total - st.eraProg.t))),
          el('p', { class: 'small muted' }, 'Si te sobran recursos, paga «Horas extra» en el Centro Urbano para adelantarlo.'));
      } else {
        const n = st.era + 1, ch = g.eraChecks(n), cost = D.eraCost(n);
        body.append(el('h3', null, 'Era ' + U.roman(n) + ' · ' + D.eraName(n)),
          el('ul', { class: 'info era-goal' }, ch.map(c => el('li', { class: c.ok ? 'ok' : '' }, (c.ok ? '✓ ' : '✗ ') + c.text))),
          el('h4', null, 'Costo'),
          el('div', { class: 'era-cost' }, Object.keys(cost).map(r => {
            const have = Math.floor(st.res[r] || 0), ok = have >= cost[r];
            return el('div', { class: 'ec-row' + (ok ? ' ok' : '') }, UI.resIcon(r), el('span', null, D.RES[r].name), el('b', null, U.fmt(Math.min(have, cost[r])) + ' / ' + U.fmt(cost[r])),
              el('div', { class: 'bar' }, el('div', { class: 'fill ' + (ok ? 'green' : 'gold'), style: { width: Math.min(100, (have / cost[r]) * 100) + '%' } })));
          })),
          el('p', { class: 'small muted' }, 'El avance dura ' + U.fmtTime(D.eraTime(n)) + '. Se inicia desde el Centro Urbano.'));
      }
      const tc = g.buildings.find(b => b.owner === 'p' && b.type === 'tc');
      if (tc) body.append(UI.btn('Ir al Centro Urbano', () => { UI.closeModal(); UI.selectBuilding(tc); }, { cls: 'gold' }));
    });
  };

  UI.modal = function (key, title, render, opts) {
    UI.closeModal();
    opts = opts || {};
    const body = el('div', { class: 'modal-body' });
    const prevFocus = document.activeElement;
    const box = el('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title', tabindex: '-1' },
      el('div', { class: 'modal-head' }, el('span', { id: 'modal-title' }, title), el('button', { class: 'x', 'aria-label': 'Cerrar', title: 'Cerrar', onclick: () => UI.closeModal() }, '✕')), body);
    const back = el('div', { class: 'modal-back', onpointerdown: e => { if (e.target === back) UI.closeModal(); } }, box);
    watchTouch(back, () => { modalTouch = performance.now(); });
    document.body.append(back);
    modal = { key, render, body, back, prevFocus };
    UI.rerender();
    try { box.focus({ preventScroll: true }); } catch (err) { box.focus(); }
  };
  UI.modalKey = () => (modal ? modal.key : null);
  UI.closeModal = function () {
    if (!modal) return false;
    const pf = modal.prevFocus;
    modal.back.remove(); modal = null;
    if (pf && pf.focus && document.contains(pf) && pf !== document.body) try { pf.focus({ preventScroll: true }); } catch (err) { /* nada */ }
    return true;
  };
  // fresh: al cambiar de pestaña no se repone el desplazamiento (es otra página).
  UI.rerender = function (fresh) {
    if (!modal) return;
    const keep = {};
    modal.body.querySelectorAll('input[id],select[id]').forEach(i => { keep[i.id] = i.value; });
    const snap = fresh === true ? null : snapScroll(modal.body);
    modal.body.innerHTML = '';
    modal.render(modal.body);
    for (const id in keep) { const i = document.getElementById(id); if (i) i.value = keep[id]; }
    if (snap) restoreScroll(modal.body, snap); else modal.body.scrollTop = 0;
  };
  function modalBusy() {
    const a = document.activeElement;
    return modal && a && modal.body.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT');
  }

  // ---------- HUD ----------
  let resEls = {}, popEl, eraEl, coinEl, netEl, panel, bookDot, mm, tip, buildEl, evEl, asEl;
  UI.init = function () {
    const hud = document.getElementById('hud');
    toastBox = el('div', { id: 'toasts' });
    const bar = el('div', { id: 'topbar' });
    for (const r of D.RES_ORDER) {
      const v = el('b', null, '0'), f = el('i', { class: 'capbar' });
      resEls[r] = { box: el('div', { class: 'res', title: D.RES[r].name }, el('img', { class: 'ico', src: Sp.icon(r) }), v, f), v, f };
      bar.append(resEls[r].box);
    }
    popEl = el('b', null, '0/0');
    bar.append(el('div', { class: 'res pop', title: 'Población' }, el('img', { class: 'ico', src: Sp.icon('pop') }), popEl));
    buildEl = el('b', null, '1/1');
    bar.append(el('button', { class: 'res builders', title: 'Maestros de Obras ocupados / total', onclick: () => UI.openWorks() }, el('img', { class: 'ico', src: Sp.icon('hammer') }), buildEl));
    eraEl = el('div', { class: 'era', title: 'Meta de la próxima era', role: 'button', tabindex: '0', onclick: () => UI.openEraGoal() });
    coinEl = el('b', null, '0');
    netEl = el('button', { class: 'net', onclick: () => UI.openRealms() });
    // «¿Qué me frena?» (A6, js/asesor.js): junto a la era, con cuántas cosas importantes hay
    asEl = el('span', { class: 'badge' });
    const asBtn = el('button', { class: 'res asesor', title: '¿Qué me frena?', 'aria-label': '¿Qué me frena?', onclick: () => PK.Asesor.open() }, '?', asEl);
    bar.append(eraEl, asBtn, netEl, el('div', { class: 'res coins', title: 'Monedas de la página' }, el('img', { class: 'ico', src: Sp.icon('coin') }), coinEl));
    // en pantallas chicas la barra ocupa varias filas según la era: el minimapa y el menú se acomodan debajo
    // (incluye el margen del notch arriba: --top-h + 6 px es siempre el borde inferior de la barra)
    if (window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', Math.max(0, bar.offsetTop - 6) + bar.offsetHeight + 'px')).observe(bar);

    const menu = el('div', { id: 'menu' });
    const mbtn = (icon, label, fn, key, id) => {
      const b = el('button', { class: 'mbtn', title: label + (key ? ' (' + key + ')' : ''), 'aria-label': label, onclick: () => { b.classList.remove('nuevo'); fn(); } }, el('img', { class: 'ico', src: icon.startsWith('data:') ? icon : Sp.icon(icon), alt: '' }), el('span', null, label));
      menu.append(b);
      if (id) menuIds[id] = b;
      return b;
    };
    const bb = mbtn('book', 'Misiones', () => PK.Quests.openBook(), 'B');
    bookDot = el('span', { class: 'badge' }); bb.append(bookDot);
    mbtn(Sp.buildingIcon('house'), 'Construir', () => UI.openBuild(), 'C');
    mbtn('hammer', 'Obras', () => UI.openWorks());
    mbtn('pop', 'Aldeanos', () => UI.openForeman());
    mbtn('war', 'Cuartel', () => PK.Social.openWar());
    mbtn('compass', 'Explorar', () => UI.openExplore(), null, 'explore');
    mbtn('flask', 'Investigar', () => UI.openResearch(), null, 'research');
    mbtn('market', 'Mercado', () => PK.Social.openMarket(), null, 'market');
    mbtn('guild', 'Gremio', () => PK.Social.openGuild(), null, 'guild');
    mbtn('scroll', 'Territorio', () => UI.openTerritory(), 'T', 'terr');
    mbtn('cart', 'Logística', () => UI.openLogistics(), null, 'logi');
    mbtn('crown', 'Reinos', () => UI.openRealms(), null, 'realms');
    mbtn('gear', 'Opciones', () => UI.openSettings());

    panel = el('div', { id: 'panel' });
    mm = el('canvas', { id: 'minimap', width: 384, height: 192 });
    const mmWrap = el('div', { id: 'mmwrap' }, mm, el('div', { class: 'mm-legend' }, 'Z: zonas · H: centro · . : ocioso'));
    let mmDrag = false;
    const mmGo = e => { const r = mm.getBoundingClientRect(); const [tx, ty] = PK.Render.minimapToTile(mm, e.clientX - r.left, e.clientY - r.top); PK.Render.centerOn(tx, ty); };
    // con «Poner bandera» activa, tocar el minimapa la pone ahí (A4)
    const mmFlag = e => { const r = mm.getBoundingClientRect(); const [tx, ty] = PK.Render.minimapToTile(mm, e.clientX - r.left, e.clientY - r.top); PK.Input.flagAt(tx, ty); };
    mm.addEventListener('pointerdown', e => { e.stopPropagation(); if (PK.Input.flagTool) { mmFlag(e); return; } mmDrag = true; mmGo(e); });
    window.addEventListener('pointermove', e => { if (mmDrag) mmGo(e); });
    window.addEventListener('pointerup', () => { mmDrag = false; });

    tip = el('div', { id: 'tip' });
    evEl = el('div', { id: 'event' });
    qsEl = el('div', { id: 'qstrip' });
    hud.append(bar, menu, panel, mmWrap, qsEl, toastBox, tip, evEl);
    watchTouch(panel, () => { panelTouch = performance.now(); });
    initMobile(menu);
    window.addEventListener('pk:coins', () => { coinEl.textContent = U.fmt(PK.Platform.getCoins()); });
    UI.refreshPanel(true);
  };

  // ---------- Menú progresivo ----------
  // Cada botón aparece cuando tiene sentido (playtest: 14 botones desde el minuto 1, varios vacíos o bloqueados
  // abrumaban). Una vez visto queda para siempre (flags.menu_<id>). Lo que aparece durante la partida brilla
  // hasta que lo tocas; al cargar, lo que ya correspondía se muestra sin anuncio (también en partidas viejas).
  // Cuartel siempre está: sus murallas (Defensa) sirven desde la Era I y una misión lo nombra.
  const menuIds = {};
  const MENU_VER = {
    explore: (g, st) => g.countAll('scout') > 0 || st.era >= 2,
    research: (g, st) => st.era >= 2 || g.countAll('library') > 0,
    market: (g, st) => st.era >= 2 || g.countAll('market') > 0,
    guild: (g, st) => g.countAll('guild') > 0 || (st.guild && st.guild.joined) || (PK.Net.online && st.era >= 2),
    terr: (g, st) => st.era >= 2 || !!st.flags.verTerr,
    logi: (g, st) => g.countAll('cartwright') > 0 || g.buildings.some(b => b.owner === 'p' && b.def.recipe) || !!(st.logi && st.logi.roads.length),
    realms: (g, st) => !!PK.Net.online || D.BOTS.some(b => st.flags['seen_' + b.slot]),
  };
  let menuFirst = true;
  function updateMenu() {
    const g = G(), st = S(), nuevos = [];
    for (const id in menuIds) {
      const b = menuIds[id], ok = !!st.flags['menu_' + id] || MENU_VER[id](g, st);
      if (ok && !st.flags['menu_' + id]) {
        st.flags['menu_' + id] = 1;
        if (!menuFirst) { b.classList.add('nuevo'); nuevos.push(b.getAttribute('aria-label')); }
      }
      b.style.display = ok ? '' : 'none';
    }
    menuFirst = false;
    if (nuevos.length) UI.toast('Nuevo en el menú: ' + (nuevos.length > 1 ? nuevos.slice(0, -1).join(', ') + ' y ' + nuevos[nuevos.length - 1] : nuevos[0]) + '.', 'quest');
  }

  let tHud = 0, tPanel = 0, tModal = 0, lastPanelKey = '';
  UI.update = function (dt) {
    tHud += dt; tPanel += dt; tModal += dt;
    PK.Render.drawMinimap(mm, dt);
    if (tHud > 0.25) {
      tHud = 0;
      const st = S();
      for (const r of D.RES_ORDER) {
        const cap = G().cap(r), v = st.res[r];
        resEls[r].v.textContent = U.fmt(v);
        resEls[r].f.style.width = Math.min(100, (v / Math.max(1, cap)) * 100) + '%';
        resEls[r].box.classList.toggle('full', v >= cap * 0.98);
        // Una sola regla para el tope: solo frena lo que juntan los aldeanos y producen los talleres. Premios, cofres,
        // botín, compras, ventas y tratos entran enteros aunque lo pasen (antes «Comprar» se negaba y vender con el
        // oro lleno se perdía).
        resEls[r].box.title = D.RES[r].name + ': ' + U.fmt(v) + ' / ' + U.fmt(cap) + (v >= cap * 0.98 ? ' — bodega llena: tus aldeanos esperan hasta que gastes. Premios, compras y tratos entran igual.' : '');
        if (v >= 1) st.flags['seenRes_' + r] = true;
        resEls[r].box.style.display = !D.RES[r].special && (D.RES_START.includes(r) || st.flags['seenRes_' + r]) ? '' : 'none';
      }
      popEl.textContent = G().pop() + '/' + G().popCap();
      buildEl.textContent = G().buildersBusy() + '/' + G().builders();
      buildEl.parentNode.classList.toggle('free', G().buildersBusy() < G().builders());
      eraEl.innerHTML = '';
      eraEl.append(el('span', null, 'Era ' + U.roman(st.era)), el('small', null, D.eraName(st.era)));
      // la meta de la próxima era a la vista (playtest): cuántos requisitos van y si ya se puede avanzar
      if (!st.eraProg) {
        const ch = G().eraChecks(st.era + 1), okN = ch.filter(c => c.ok).length, all = okN === ch.length && G().canAfford(D.eraCost(st.era + 1));
        eraEl.append(el('em', { class: 'era-meta' + (all ? ' lista' : '') }, all ? '¡avanzar!' : 'meta ' + okN + '/' + ch.length));
      }
      if (st.eraProg) eraEl.append(el('div', { class: 'mini-bar' }, el('div', { style: { width: (st.eraProg.t / st.eraProg.total) * 100 + '%' } })));
      coinEl.textContent = U.fmt(PK.Platform.getCoins());
      const net = PK.Net;
      netEl.className = 'net ' + (net.online ? (net.lost ? 'lost' : 'on') : 'off');
      netEl.textContent = net.online ? (net.lost ? '● Reconectando…' : '● ' + net.world.name) : '○ Modo local';
      netEl.title = net.online ? 'Conectado como ' + net.me.name + ' · ' + net.ping + ' ms' : 'Sin servidor: los demás reinos son simulados';
      updateEvent();
      updateMenu();
      const n = PK.Quests.readyCount();
      bookDot.textContent = n || '';
      bookDot.style.display = n ? '' : 'none';
      updateQueueStrip();
      const na = PK.Asesor.cuenta(0.25);
      asEl.textContent = na || '';
      asEl.style.display = na ? '' : 'none';
    }
    if (tPanel > 0.5) { tPanel = 0; UI.refreshPanel(false); }
    if (tModal > 1) { tModal = 0; if (modal && !modalBusy() && !recent(modalTouch)) UI.rerender(); }
  };

  // ---------- Aviso de evento (ciervo dorado, estrella, mercader…) ----------
  // Se puede achicar con ✕ a una pastilla (nombre, tiempo y su botón); a los 15 s se achica solo, y en Opciones
  // se elige que aparezcan ya achicados. Solo se rearma al cambiar de estado: rearmarlo 4 veces por segundo
  // se comía los toques en sus botones.
  let evRef = null, evMin = false, evAt = 0, evKey = '', evParts = null;
  function updateEvent() {
    const ev = PK.Life.event;
    evEl.style.display = ev ? '' : 'none';
    if (!ev) { evRef = null; evKey = ''; return; }
    if (ev !== evRef) { evRef = ev; evMin = !!S().flags.evMin; evAt = performance.now(); }
    if (!evMin && performance.now() - evAt > 15000) evMin = true;
    const lab = PK.Life.eventLabel(), key = ev.id + '|' + evMin + '|' + lab + '|' + ev.desc;
    if (key !== evKey) {
      evKey = key;
      evEl.innerHTML = '';
      evEl.classList.toggle('min', evMin);
      const time = el('span', { class: 'ev-t' }), fill = el('div');
      const act = lab ? UI.btn(lab, () => { PK.Life.eventAction(); evKey = ''; }, { small: true, cls: 'gold' }) : ''; // append(null) escribe «null»
      if (evMin) evEl.append(el('button', { class: 'ev-open', title: 'Ver el evento', onclick: () => { evMin = false; evAt = performance.now(); } }, '★ ', el('b', null, ev.name), ' ', time), act);
      else evEl.append(el('div', { class: 'ev-main' }, el('b', null, ev.name), el('span', null, ev.desc)), el('div', { class: 'mini-bar' }, fill), time, act,
        el('button', { class: 'ev-x', title: 'Achicar el aviso', 'aria-label': 'Achicar el aviso', onclick: () => { evMin = true; } }, '✕'));
      evParts = { time, fill };
    }
    evParts.time.textContent = U.fmtTime(ev.t);
    evParts.fill.style.width = U.clamp((ev.t / ev.total) * 100, 0, 100) + '%';
  }

  // ---------- Tira de cola: obras, era, investigación y expediciones en curso ----------
  let qsEl, qsKey = '', qsRows = [];
  const QS_MAX = 6;
  UI.selectBuilding = function (b) {
    G().sel = { type: 'building', id: b.id };
    PK.Render.centerOn(b.cx, b.cy);
    UI.refreshPanel(true);
  };
  function queueItems() {
    const g = G(), st = S(), now = Date.now(), out = [];
    for (const b of g.buildings) {
      if (b.owner !== 'p' || !b.upg) continue;
      out.push({ k: 'b' + b.id + (g.canNudge(b) ? 'n' : ''), icon: Sp.buildingIcon(b.type, 'p', b.lvl), name: b.def.name + ' → ' + (b.lvl + 1), left: b.upg.total - b.upg.t, pct: b.upg.t / b.upg.total, b, go: () => UI.selectBuilding(b) });
    }
    if (st.eraProg) {
      const tc = g.buildings.find(b => b.owner === 'p' && b.type === 'tc');
      out.push({ k: 'era', icon: Sp.icon('scroll'), name: 'Era ' + U.roman(st.eraProg.to), left: st.eraProg.total - st.eraProg.t, pct: st.eraProg.t / st.eraProg.total, go: () => tc && UI.selectBuilding(tc) });
    }
    if (st.research) {
      const t = D.TECHS[st.research.id];
      out.push({ k: 'r' + st.research.id, icon: Sp.icon('flask'), name: t.name + ' ' + U.roman(st.research.lvl), left: (st.research.total - st.research.t) / g.researchMult(), pct: st.research.t / st.research.total, go: () => UI.openResearch() });
    }
    for (const r of (st.exp && st.exp.runs) || []) {
      if (r.phase === 'battle') { out.unshift({ k: 'b' + r.id, raid: true, icon: Sp.icon('war'), name: '⚔ Batalla en ' + r.name, left: null, pct: 1, go: () => PK.Batalla.abrir(r.id) }); continue; }
      const go = r.phase === 'go', left = ((go ? r.arrive : r.back) - now) / 1000;
      out.push({ k: 'x' + r.id + r.phase, icon: Sp.icon('war'), name: (go ? '⚔ Hacia ' : '↩ Vuelve de ') + r.name, left, pct: 1 - left / Math.max(1, r.travel), go: () => UI.openBarracks('exp') });
    }
    if (st.war.q.length) {
      const sp = PK.Social.trainSpeed(), k = st.war.q[0], left = sp ? (D.ARMY[k].time - st.war.qt) / sp : 0;
      out.push({ k: 'army' + st.war.q.length, icon: Sp.troopIcon(k), name: D.ARMY[k].name + (st.war.q.length > 1 ? ' (+' + (st.war.q.length - 1) + ')' : ''), left, pct: st.war.qt / D.ARMY[k].time, go: () => UI.openBarracks('troops') });
    }
    for (const b of g.buildings) {
      if (b.owner !== 'p' || b.done) continue;
      out.push({ k: 'c' + b.id, icon: Sp.buildingIcon(b.type, 'p', 1), name: 'Obra: ' + b.def.name, left: ((1 - b.progress) * b.def.time) / g.buildMult('p'), pct: b.progress, b: null, go: () => UI.selectBuilding(b) });
    }
    const fi = g.fiestaInfo();
    if (fi && fi.left) out.push({ k: 'fiesta', icon: Sp.icon('coin'), name: '🎉 Fiesta (+25%)', left: fi.left, pct: 1 - fi.left / g.FIESTA.dur, go: () => { const tc = g.buildings.find(b => b.owner === 'p' && b.type === 'tc'); if (tc) UI.selectBuilding(tc); } });
    out.sort((a, b) => a.left - b.left);
    const inc = PK.Incursiones && PK.Incursiones.fila();
    if (inc) out.unshift(Object.assign(inc, { raid: true, icon: Sp.icon('war'), go: () => PK.Incursiones.ver() }));
    // maestros sin trabajo: un recordatorio para que no queden parados
    const free = g.builders() - g.buildersBusy();
    if (free > 0 && g.buildings.some(b => b.owner === 'p' && b.done && !b.def.noUp && !b.upg && b.lvl < g.maxLvl(b.type))) out.push({ k: 'free' + free, idle: true, icon: Sp.icon('hammer'), name: free === 1 ? '1 maestro libre' : free + ' maestros libres', go: () => UI.openWorks() });
    return out;
  }
  function updateQueueStrip() {
    const items = queueItems(), shown = items.slice(0, QS_MAX), key = shown.map(i => i.k).join(',') + '|' + items.length;
    if (key !== qsKey) {
      qsKey = key;
      qsEl.innerHTML = '';
      qsRows = shown.map(it => {
        const time = el('span', { class: 'qs-t' }), fill = el('i', { class: 'qs-fill' });
        const row = el('div', { class: 'qs-item' + (it.idle ? ' idle' : '') + (it.raid ? ' raid' : ''), title: it.name, onclick: () => it.go() },
          el('img', { src: it.icon }), el('span', { class: 'qs-n' }, it.name), time, it.idle ? null : el('b', { class: 'qs-bar' }, fill));
        if (it.b && G().canNudge(it.b)) row.append(UI.btn('Empujón', () => { G().nudge(it.b); UI.refreshPanel(true); }, { small: true, cls: 'gold', title: 'Le queda menos de un minuto: termínala gratis' }));
        qsEl.append(row);
        return { time, fill };
      });
      if (items.length > QS_MAX) qsEl.append(el('div', { class: 'qs-more', onclick: () => UI.openWorks() }, '+' + (items.length - QS_MAX) + ' más'));
    }
    shown.forEach((it, i) => {
      if (it.idle) return;
      qsRows[i].time.textContent = it.left === null ? '' : U.fmtTime(it.left); // la marcha de los bandidos no tiene reloj
      qsRows[i].fill.style.width = U.clamp(it.pct * 100, 0, 100) + '%';
    });
    qsEl.style.display = items.length ? '' : 'none';
  }

  // ---------- Panel de selección ----------
  UI.refreshPanel = function (force) {
    const g = G(), sel = g.sel;
    let key = sel ? sel.type + ':' + (sel.ids ? sel.ids.join(',') : sel.id) : 'none';
    if (g.placing) { const gh = PK.Render.ghost; key = 'placing:' + (g.placing.move !== undefined ? 'mv' + g.placing.move + ':' : '') + g.placing.type + (g.placing.armed && gh ? ':' + gh.x + ',' + gh.y + (gh.ok ? '+' : '-') : ''); }
    if (PK.Logi.tool) key = 'tool:' + PK.Logi.tool + (PK.Logi.beltFrom || '');
    if (PK.Def.tool) key = 'def:' + PK.Def.tool + (PK.Def.start ? PK.Def.start.join(',') : '') + S().def.walls.length + S().def.gates.length;
    if (PK.Terr.mode) key = 'terr';
    if (!force && key === lastPanelKey && sel && sel.type === 'units' && !g.placing) { updateUnitsLive(); return; }
    if (!force && recent(panelTouch)) return; // lo están deslizando o tocando: se actualiza después
    const snap = key === lastPanelKey ? snapScroll(panel) : null;
    lastPanelKey = key;
    panel.innerHTML = '';
    fillPanel(g, sel);
    if (snap) restoreScroll(panel, snap); else panel.scrollTop = 0; // otra cosa elegida: desde arriba
    // sin nada que mostrar (ayuda oculta y nada elegido) el panel desaparece y deja el mapa libre
    const hud = document.getElementById('hud');
    if (hud) hud.classList.toggle('p-none', !panel.childNodes.length);
  };
  function fillPanel(g, sel) {
    if (PK.Def.tool) {
      const gate = PK.Def.tool === 'gate';
      panel.append(el('div', { class: 'p-help' }, el('h3', null, gate ? 'Poner puerta' : 'Trazar muralla (' + PK.Def.tier().name.toLowerCase() + ')'),
        el('p', { class: 'small' }, gate ? 'Toca una muralla para convertirla en puerta (o una casilla libre). Tu gente pasa; los lobos no. Cuesta ' : 'Toca dónde empieza y dónde termina cada tramo; puedes encadenar tramos. Cada casilla cuesta '),
        UI.costEl(gate ? D.WALL.gate : PK.Def.tier().cost),
        el('p', { class: 'small muted' }, 'Parcelas amuralladas: ' + PK.Def.walledCount() + '. Cierra el recinto con murallas, edificios o agua.'),
        el('div', { class: 'row' }, UI.btn(gate ? 'Trazar muralla' : 'Poner puerta', () => { PK.Def.tool = gate ? 'wall' : 'gate'; PK.Def.start = null; UI.refreshPanel(true); }, { small: true }), UI.btn('Terminar', () => PK.Input.cancelTool(), { small: true }))));
      return;
    }
    if (PK.Logi.tool) {
      const road = PK.Logi.tool === 'road';
      panel.append(el('div', { class: 'p-help' }, el('h3', null, road ? 'Trazar camino' : 'Tender cinta transportadora'),
        el('p', { class: 'small' }, road ? 'Toca dónde empieza y dónde termina. Puedes seguir encadenando tramos. Cada casilla cuesta ' : 'Toca el edificio de origen y después el de destino: la cinta se traza sola por tu territorio. Cada casilla cuesta '),
        UI.costEl(road ? D.ROAD.cost : D.BELT.cost),
        el('div', { class: 'row' }, UI.btn('Terminar', () => PK.Input.cancelTool(), { small: true }))));
      return;
    }
    if (PK.Terr.mode) {
      panel.append(el('div', { class: 'p-help' }, el('h3', null, 'Mapa de territorio'),
        el('p', { class: 'small' }, 'Toca una parcela para verla. Borde blanco: la puedes reclamar. Borde rojo: la puedes intentar conquistar.'),
        el('p', { class: 'small muted' }, 'Tus parcelas: ' + PK.Terr.count() + ' de ' + PK.Terr.max() + ' posibles en tu era.'),
        el('div', { class: 'row' }, UI.btn('Salir del mapa', () => PK.Terr.toggle(false), { small: true }), UI.btn('Resumen', () => UI.openTerritory(), { small: true }))));
      return;
    }
    if (g.placing && g.placing.move !== undefined) { // mudando un edificio
      const def = D.BUILD[g.placing.type], gh = PK.Render.ghost, armed = g.placing.armed && gh, m = g.bById.get(g.placing.move);
      const cancel = () => { g.placing = null; PK.Render.ghost = null; UI.refreshPanel(true); };
      if (!m) { cancel(); return; }
      panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait', src: Sp.buildingIcon(m.type, 'p', m.lvl) }), el('div', null, el('h3', null, 'Mover: ' + def.name + ' · Nv ' + m.lvl),
        el('p', { class: 'small' }, UI.hint('Clic en el lugar nuevo · Clic derecho o Esc para cancelar',
          armed ? (gh.ok ? 'Así quedaría. Toca «Mover aquí» o el mismo lugar otra vez.' : (G().placeText(G().placeWhy(m.type, gh.x, gh.y, m.id)) + ' Toca otro lugar.')) : 'Toca el lugar nuevo: primero verás cómo queda.')),
        el('div', { class: 'row' }, armed && UI.isTouch() ? UI.btn('Mover aquí', () => PK.Input.placeGhost(), { cls: 'gold', disabled: !gh.ok }) : null, UI.btn('Cancelar', cancel, { small: true })),
        el('div', { class: 'row' }, el('span', { class: 'small' }, 'Mudanza: '), UI.costEl(G().moveCost(m))),
        el('p', { class: 'small muted' }, 'Conserva el nivel, la mejora en curso, la cola y los trabajadores. Las cintas que llegaban a él se quitan.'))));
      return;
    }
    if (g.placing) {
      const def = D.BUILD[g.placing.type], gh = PK.Render.ghost, armed = g.placing.armed && gh;
      const cancel = () => { g.placing = null; PK.Render.ghost = null; UI.refreshPanel(true); };
      // los botones van primero: en el celular el panel es bajo y quedaban fuera de la vista
      panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait', src: Sp.buildingIcon(g.placing.type) }), el('div', null, el('h3', null, 'Construir: ' + def.name),
        el('p', { class: 'small' }, UI.hint('Clic para colocarlo en tu tierra explorada · Mayús para poner varios · Clic derecho o Esc para cancelar',
          armed ? (gh.ok ? 'Así quedaría. Toca «Construir aquí» o el mismo lugar otra vez. Para moverlo, toca otro lugar.' : (G().placeText(G().placeWhy(g.placing.type, gh.x, gh.y)) + ' Toca otro lugar.')) : 'Toca dónde va: primero verás cómo queda.')),
        el('div', { class: 'row' }, armed && UI.isTouch() ? UI.btn('Construir aquí', () => PK.Input.placeGhost(), { cls: 'gold', disabled: !gh.ok }) : null,
          UI.btn('Otro edificio', () => UI.openBuild(), { small: true }), UI.btn('Cancelar', cancel, { small: true })),
        UI.costEl(G().buildCost(g.placing.type)),
        g.placing.type === 'house' ? el('div', { class: 'row small' },
          el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !!S().flags.barrio, onchange: e => { S().flags.barrio = e.target.checked ? 1 : 0; if (!e.target.checked) g.placing.barrio = null; } }), ' Modo barrio'),
          el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !S().flags.barrioSinCaminos, onchange: e => { S().flags.barrioSinCaminos = e.target.checked ? 0 : 1; } }), ' con caminos'),
          el('span', { class: 'muted' }, UI.hint('(o Mayús): ', '') + 'casas en cuadrícula con calles de 1 casilla')) : '',
        el('p', { class: 'small muted' }, def.desc + ' Se construye solo en ' + U.fmtTime(def.time / g.buildMult('p')) + ': no ocupa aldeanos.'))));
      return;
    }
    if (!sel) {
      if (S().flags.helpOff) return; // la ocultaste: el panel solo aparece al elegir algo
      panel.append(el('div', { class: 'p-help' },
        el('h3', null, 'Pro Kingdoms'),
        el('p', null, 'Toca ', el('b', null, 'Construir'), ' para levantar edificios: se construyen solos. Tus aldeanos solo recolectan y trabajan: usa ', el('b', null, 'Aldeanos'), ' para repartirlos, o elige alguno y dile qué hacer.'),
        el('p', { class: 'small muted' }, UI.hint('Clic o arrastra para elegir aldeanos; clic derecho sobre un árbol, una mina o un taller para mandarlos.',
          'Toca un aldeano para elegirlo (mantén pulsado y arrastra para varios; doble toque: todos los de su tipo) y después toca un árbol, una mina o un taller.')),
        el('p', { class: 'small muted' }, 'Lo oscuro es niebla: un Puesto de Exploradores la descubre. Cada edificio se mejora por separado con tus Maestros de Obras.'),
        el('div', { class: 'row' }, UI.btn('Construir', () => UI.openBuild(), { small: true, cls: 'gold' }), UI.btn('Aldeanos', () => UI.openForeman(), { small: true }),
          UI.btn('Ocultar ayuda', () => { S().flags.helpOff = true; UI.refreshPanel(true); UI.toast('Listo. La ayuda vuelve desde Opciones.', 'info'); }, { small: true, title: 'El panel solo aparecerá al elegir algo' }))));
      return;
    }
    if (sel.type === 'units') return unitsPanel(g.selUnits());
    if (sel.type === 'building') { const b = g.bById.get(sel.id); if (b) return buildingPanel(b); }
    if (sel.type === 'node') { const n = W.nodes[sel.id]; if (n) return nodePanel(n); }
    if (sel.type === 'poi') { const p = W.pois[sel.id]; if (p) return poiPanel(p); }
    if (sel.type === 'unit') { const u = g.uById.get(sel.id); if (u) return otherUnitPanel(u); }
    if (sel.type === 'belt') { const bl = S().logi.belts.find(x => x.id === sel.id); if (bl) return beltPanel(bl); }
    if (sel.type === 'wall' && W.wall[sel.id]) return wallPanel(sel.id);
    g.sel = null;
    UI.refreshPanel(true);
  };

  function taskText(u) {
    if (u.inside) { const b = G().buildings.find(o => o.workers.includes(u.id)); return b ? 'Trabajando en ' + b.def.name : 'Trabajando'; }
    if (!u.task) return 'Ocioso';
    const t = u.task;
    if (u.fullWait && (t.t === 'gather' || t.t === 'farm')) return 'Esperando: bodega de ' + D.RES[t.t === 'farm' ? 'food' : t.res].name.toLowerCase() + ' llena';
    if (t.t === 'gather') return (u.phase === 'return' ? 'Llevando ' : 'Recolectando ') + D.RES[t.res].name.toLowerCase();
    if (t.t === 'farm') return u.phase === 'return' ? 'Llevando la cosecha' : 'Cultivando';
    if (t.t === 'build') { const b = G().bById.get(t.b); return 'Construyendo ' + (b ? b.def.name : ''); }
    if (t.t === 'work') return 'Yendo a trabajar';
    if (t.t === 'deposit') return 'Descargando';
    if (t.t === 'explore') return 'Explorando';
    if (t.t === 'dig') return 'Excavando ruinas';
    return 'Caminando';
  }

  let liveEl = null;
  function updateUnitsLive() {
    if (!liveEl) return;
    const us = G().selUnits();
    if (!us.length) { G().sel = null; UI.refreshPanel(true); return; }
    liveEl.textContent = us.length === 1 ? taskText(us[0]) + (us[0].carry ? ' · carga ' + us[0].carry + '/' + G().carryCap('p', us[0]) : '') : summary(us);
  }
  function summary(us) {
    const c = {};
    for (const u of us) { const t = taskText(u); c[t] = (c[t] || 0) + 1; }
    return Object.keys(c).map(k => c[k] + ' ' + k.toLowerCase()).join(' · ');
  }

  function cartPanel(us) {
    const u = us[0], g = G(), port = Sp.cart(D.PLAYER_COLOR, u.carryRes, false, 0, false).c.toDataURL();
    const j = u.job, from = j && g.bById.get(j.from), to = j && g.bById.get(j.to);
    panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait unit', src: port }),
      el('div', null, el('h3', null, us.length === 1 ? 'Carreta' : us.length + ' carretas'),
        el('p', { class: 'small' }, j && from && to ? (j.phase === 'go' ? 'Va a cargar ' : 'Lleva ') + D.RES[j.res].name.toLowerCase() + ': ' + from.def.name + ' → ' + to.def.name : 'Esperando trabajo'),
        el('p', { class: 'small muted' }, 'Las carretas se manejan solas: abastecen los talleres que se quedan sin insumos y sacan lo que producen. Con caminos van mucho más rápido.'))));
  }
  function wallPanel(k) {
    const gate = W.wall[k] === 2, x = k % W.W, y = Math.floor(k / W.W), t = PK.Def.tier();
    panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait', src: Sp.wall(gate ? 10 : 2, S().def.tier, gate, D.PLAYER_COLOR).c.toDataURL() }),
      el('div', null, el('h3', null, gate ? 'Puerta' : t.name), el('p', { class: 'small' }, gate ? 'Tus aldeanos y carretas pasan; los lobos y los enemigos no.' : 'Bloquea el paso. Encierra parcelas para multiplicar su defensa.'),
        el('p', { class: 'small muted' }, PK.Def.isWalled(W.parcel(x, y)) ? 'Esta parcela está amurallada (defensa x' + (1 + t.bonus).toFixed(1) + ').' : 'Esta parcela todavía no está encerrada.'),
        el('div', { class: 'row' }, gate ? null : UI.btn('Convertir en puerta', () => { PK.Def.gate(x, y); UI.refreshPanel(true); }, { small: true }),
          UI.btn('Desarmar (devuelve la mitad)', () => { PK.Def.remove(k); G().sel = null; UI.refreshPanel(true); }, { small: true, cls: 'danger' }),
          UI.btn('Murallas', () => UI.openBarracks('defense'), { small: true })))));
  }
  function beltPanel(bl) {
    const g = G(), a = g.bById.get(bl.a), b = g.bById.get(bl.b);
    panel.append(el('div', { class: 'p-help' }, el('h3', null, 'Cinta transportadora'),
      el('p', { class: 'small' }, (a ? a.def.name : '?') + ' → ' + (b ? b.def.name : '?') + ' · ' + bl.path.length + ' casillas · ' + bl.items.length + ' en tránsito'),
      el('p', { class: 'small muted' }, 'Lleva lo que produce el origen o, si sale de un almacén, el insumo que más le falte al destino. Hasta ' + D.BELT.rate + ' unidades por segundo.'),
      el('div', { class: 'row end' }, UI.btn('Desarmar (devuelve la mitad)', () => { PK.Logi.removeBelt(bl); G().sel = null; UI.refreshPanel(true); }, { small: true, cls: 'danger' }))));
  }

  function scoutPanel(us) {
    const u = us[0], port = Sp.villager(D.PLAYER_COLOR, u.hair, u.skin, 'idle', 0, null, false, null, true).c.toDataURL();
    liveEl = el('p', { class: 'small' });
    panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait unit', src: port }),
      el('div', null, el('h3', null, us.length === 1 ? 'Explorador' : us.length + ' exploradores'), liveEl,
        el('p', { class: 'small muted' }, 'Explora solo hasta ' + G().exploreRange() + ' casillas de tu Centro Urbano. ' + UI.hint('Clic derecho', 'Toca el mapa') + ' para enviarlo a un lugar; después sigue explorando.'),
        el('div', { class: 'row' }, UI.btn('Explorar', () => { us.forEach(x => { G().assign(x, { t: 'explore' }); x.doneMsg = false; x.skip = null; }); UI.refreshPanel(true); }, { small: true }),
          UI.btn('⚑ Bandera', () => PK.Input.startFlag(), { small: true, title: 'Marca un lugar en la niebla: va hacia allá antes que a lo más cercano' }),
          UI.btn('Detener', () => { us.forEach(x => G().release(x)); UI.refreshPanel(true); }, { small: true })))));
    updateUnitsLive();
  }

  function unitsPanel(us) {
    if (!us.length) { G().sel = null; return UI.refreshPanel(true); }
    if (us.every(x => x.kind === 'scout')) return scoutPanel(us);
    if (us.every(x => x.kind === 'cart')) return cartPanel(us);
    us = us.filter(x => x.kind === 'v');
    const u = us[0];
    const port = Sp.villager(D.PLAYER_COLOR, u.hair, u.skin, 'idle', 0, null, false).c.toDataURL();
    liveEl = el('p', { class: 'small' });
    panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait unit', src: port }),
      el('div', null, el('h3', null, us.length === 1 ? 'Aldeano' : us.length + ' aldeanos'), liveEl,
        el('div', { class: 'row' }, UI.btn('Detener', () => { us.forEach(x => G().release(x)); UI.refreshPanel(true); }, { small: true }),
          UI.btn('Siguiente ocioso', () => { const n = G().nextIdle(u.id); if (n) { G().sel = { type: 'units', ids: [n.id] }; PK.Render.centerOn(n.x, n.y); UI.refreshPanel(true); } }, { small: true })))));
    updateUnitsLive();
    // ¿Qué hacen? Un toque y se reparten solos por los recursos cercanos de ese tipo (sin amontonarse).
    const A = PK.Auto, jobs = el('div', { class: 'job-grid' }), cur = us.length === 1 ? A.jobOf(us[0]) : null;
    for (const id in A.JOBS) {
      const j = A.JOBS[id];
      if ((id === 'ore' || id === 'marble' || id === 'gems') && !S().flags['seenRes_' + id] && S().era < 2) continue;
      if (id === 'dig' && !A.jobAvailable('dig')) continue;
      jobs.append(UI.btn(el('span', null, el('img', { class: 'ico', src: Sp.icon(j.icon), alt: '' }), j.name), () => { if (A.setJob(us, id)) UI.toast(us.length === 1 ? 'Aldeano: ' + j.name.toLowerCase() + '.' : us.length + ' aldeanos: ' + j.name.toLowerCase() + '.', 'good'); UI.refreshPanel(true); },
        { small: true, cls: cur === id ? 'gold' : '', title: j.hint ? j.name + ': ' + j.hint : j.name }));
    }
    panel.append(el('p', { class: 'small p-sub' }, el('b', null, '¿Qué hacen? '), el('span', { class: 'muted' }, 'Toca un trabajo y van al recurso más conveniente, cerca de su punto de acopio.')), jobs,
      el('div', { class: 'row' }, UI.btn('Construir…', () => UI.openBuild(), { small: true }), UI.btn('Todos los aldeanos', () => UI.openForeman(), { small: true })));
  }

  // Efecto actual → siguiente nivel.
  UI.statRows = function (type, lvl, next) {
    const f = D.BSTATS[type];
    if (!f) return null;
    const a = f(lvl), b = next ? f(lvl + 1) : null;
    return el('div', { class: 'stats' }, Object.keys(a).filter(k => D.STAT_LABELS[k] && (a[k] || (b && b[k]))).map(k => {
      const [label, fmt] = D.STAT_LABELS[k], changed = b && b[k] !== a[k];
      return el('div', { class: 'st' + (changed ? ' up' : '') }, el('span', null, label), el('b', null, fmt(a[k]) + (changed ? ' → ' + fmt(b[k]) : '')));
    }));
  };
  // Horas extra (G.overtime): pagar con lo que sobra para adelantar el reloj. Sin nada que ofrecer, ''.
  function overtimeRow(kind, b) {
    const o = G().otInfo(kind, b);
    if (!o) return '';
    if (!o.avail) return o.n >= o.max ? el('p', { class: 'small muted' }, 'Horas extra: ya pagaste todas las de este reloj (' + o.max + ').') : '';
    return el('div', { class: 'ot-row' },
      UI.btn(el('span', null, 'Horas extra −' + U.fmtTime(o.skip) + ' ', UI.costEl(o.cost)), () => { G().overtime(kind, b); UI.refreshPanel(true); },
        { small: true, cls: 'ot', disabled: !o.ok, title: 'Paga jornales con lo que te sobra para adelantar ' + (kind === 'era' ? 'el avance de era' : 'la mejora') + '. Cada vez cuesta un 30% más.' }),
      el('span', { class: 'small muted' }, ' ' + o.n + '/' + o.max));
  }

  function upgradeBox(b) {
    const g = G(), box = el('div', { class: 'up-box' });
    if (b.def.noUp) return null;
    const max = g.maxLvl(b.type);
    if (b.upg) {
      const left = b.upg.total - b.upg.t, coins = g.speedUpCost(b);
      box.append(el('b', null, 'Mejorando a nivel ' + (b.lvl + 1)),
        el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: (b.upg.t / b.upg.total) * 100 + '%' } }), el('span', null, U.fmtTime(left))),
        el('div', { class: 'row' }, g.canNudge(b) ? UI.btn('Empujón gratis', () => { g.nudge(b); UI.refreshPanel(true); }, { small: true, cls: 'gold', title: 'Le queda menos de un minuto: termínala ya, sin costo' })
          : UI.btn(el('span', null, 'Terminar ya ', UI.amount('coins', coins)), () => { g.speedUp(b); UI.refreshPanel(true); }, { small: true, cls: 'gold', disabled: PK.Platform.getCoins() < coins }),
          UI.btn('Cancelar', () => { g.cancelUpgrade(b); UI.refreshPanel(true); }, { small: true })),
        overtimeRow('upg', b));
      return box;
    }
    if (b.lvl >= max) { box.append(el('p', { class: 'small muted' }, 'Nivel ' + b.lvl + ' de ' + max + ': es el máximo en la Era ' + U.roman(g.state.era) + '. Cada era permite 2 niveles más.')); return box; }
    const c = g.canUpgrade(b), cost = g.upCost(b), q = PK.Auto.queued(b);
    box.append(el('div', { class: 'row' }, el('b', null, 'Mejorar a nivel ' + (b.lvl + 1)), el('span', { class: 'small muted' }, ' · ' + U.fmtTime(g.upTime(b)) + ' · máx. ' + max)),
      UI.costEl(cost),
      el('div', { class: 'row' }, UI.btn('Mejorar', () => { g.upgrade(b); PK.Auto.dequeue(b); UI.refreshPanel(true); }, { cls: 'gold', disabled: !c.ok }),
        q ? UI.btn('Quitar de la cola', () => { PK.Auto.dequeue(b); UI.refreshPanel(true); }, { small: true }) : c.ok ? null : UI.btn('Poner en cola', () => { PK.Auto.enqueue(b); UI.refreshPanel(true); }, { small: true, title: 'Un maestro lo mejorará solo cuando haya maestro libre y recursos' }),
        c.busy ? el('span', { class: 'small warn-t' }, 'Maestros ocupados (' + g.buildersBusy() + '/' + g.builders() + ')') : c.ok || q ? null : el('span', { class: 'small muted' }, c.why)));
    if (q) box.append(el('p', { class: 'small good' }, 'En la cola de obras (puesto ' + (g.state.upq.indexOf(b.id) + 1) + ').'));
    return box;
  }

  function buildingPanel(b) {
    const def = b.def, own = b.owner === 'p';
    const head = el('div', null, el('h3', null, def.name + (def.noUp ? '' : ' · Nv ' + b.lvl)), el('p', { class: 'small' }, own ? def.desc : 'Pertenece a ' + D.BOTS.find(x => x.id === b.owner).realm + '.'));
    panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait', src: Sp.buildingIcon(b.type, b.owner, b.lvl) }), head));
    if (!own) return;
    if (!b.done) {
      head.append(el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: b.progress * 100 + '%' } }), el('span', null, 'En construcción ' + Math.floor(b.progress * 100) + '% · ' + U.fmtTime(((1 - b.progress) * def.time) / G().buildMult('p')))));
      head.append(el('p', { class: 'small muted' }, 'Se levanta sola: tus aldeanos siguen con su trabajo. Arquitectura (Investigar) la acelera.'));
      head.append(el('div', { class: 'row' }, UI.btn('Cancelar obra', () => UI.confirmDemolish(b), { small: true })));
      return;
    }
    const act = el('div', { class: 'p-actions' });
    act.append(UI.statRows(b.type, b.lvl, !def.noUp && b.lvl < G().maxLvl(b.type)), upgradeBox(b) || ''); // append(null) escribe «null»
    if (b.type === 'consejo' && PK.Consejo) act.append(el('div', { class: 'row' }, UI.btn('Abrir el Consejo', () => PK.Consejo.open(), { cls: 'gold' }), el('span', { class: 'small muted' }, PK.Consejo.resumen())));
    if (b.type === 'tc') {
      const st = S();
      act.append(el('div', { class: 'row' },
        UI.btn(el('span', null, 'Aldeano ', UI.costEl(D.VILLAGER.cost)), e => { G().train(b, e.shiftKey ? 5 : 1); UI.refreshPanel(true); }, { title: 'Mayús+clic: 5' }),
        UI.btn('+5', () => { G().train(b, 5); UI.refreshPanel(true); }, { small: true }),
        b.queue.length ? UI.btn('Quitar de la cola', () => { G().cancelTrain(b); UI.refreshPanel(true); }, { small: true }) : null,
        el('label', { class: 'chk small' }, el('input', { type: 'checkbox', checked: st.auto.train, onchange: e => { st.auto.train = e.target.checked; } }), ' Entrenar sin parar')));
      const fi = G().fiestaInfo();
      if (fi) act.append(el('div', { class: 'ot-row fiesta-row' }, fi.left
        ? el('span', { class: 'small good-t' }, '🎉 Fiesta en curso: +25% de recolección y talleres (' + U.fmtTime(fi.left) + ')')
        : UI.btn(el('span', null, '🎉 Fiesta ', UI.costEl(fi.cost)), () => { G().fiesta(); UI.refreshPanel(true); },
          { small: true, cls: 'ot', disabled: !fi.ok, title: 'Gasta lo que te sobra: +25% de recolección y de talleres durante 5 minutos. Cada fiesta del mismo día cuesta un 40% más.' })));
      act.append(el('div', { class: 'bar' }, el('div', { class: 'fill blue', style: { width: (b.qt / G().trainTime(b)) * 100 + '%' } }), el('span', null, b.queue.length ? 'En cola: ' + b.queue.length + (b.status && b.status !== 'Entrenando' ? ' · ' + b.status : '') : UI.hint('Sin cola · clic derecho para punto de reunión', 'Sin cola · toca el mapa para punto de reunión'))));
      const n = st.era + 1;
      if (st.eraProg) {
        act.append(el('div', { class: 'era-box' }, el('b', null, 'Avanzando a ' + D.eraName(st.eraProg.to)),
          el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: (st.eraProg.t / st.eraProg.total) * 100 + '%' } }), el('span', null, U.fmtTime(st.eraProg.total - st.eraProg.t))),
          overtimeRow('era', null)));
      } else {
        const checks = G().eraChecks(n), ok = checks.every(c => c.ok) && G().canAfford(D.eraCost(n));
        act.append(el('div', { class: 'era-box' },
          el('b', null, 'Siguiente: Era ' + U.roman(n) + ' · ' + D.eraName(n)),
          el('ul', { class: 'info' }, checks.map(c => el('li', { class: c.ok ? 'ok' : '' }, c.text))),
          el('div', { class: 'row' }, UI.costEl(D.eraCost(n)), el('span', { class: 'small muted' }, ' · ' + U.fmtTime(D.eraTime(n)))),
          UI.btn('Avanzar de era', () => { G().startEra(); UI.refreshPanel(true); }, { disabled: !ok, cls: 'gold' })));
      }
    } else if (b.type === 'scout') {
      act.append(el('div', { class: 'row' },
        UI.btn(el('span', null, 'Explorador ', UI.costEl(D.SCOUT.cost)), () => { G().trainScout(b); UI.refreshPanel(true); }),
        b.queue.length ? UI.btn('Quitar de la cola', () => { G().cancelTrain(b); UI.refreshPanel(true); }, { small: true }) : null),
        el('p', { class: 'small' }, 'Exploradores: ' + G().scoutCount() + '/' + G().scoutMax() + ' · Mapa explorado: ' + Math.round(G().explorePct() * 1000) / 10 + '%'));
      if (b.queue.length) act.append(el('div', { class: 'bar' }, el('div', { class: 'fill blue', style: { width: (b.qt / G().trainTime(b)) * 100 + '%' } }), el('span', null, 'Entrenando explorador' + (b.status && b.status !== 'Entrenando' ? ' · ' + b.status : ''))));
      act.append(UI.btn('Ver descubrimientos', () => UI.openExplore(), { small: true }));
    } else if (b.type === 'monastery') {
      act.append(el('p', null, 'Reliquias: ' + S().relics + '/' + G().relicSlots() + ' · ' + G().relicGold().toFixed(1) + ' de oro por minuto'));
      const found = W.pois.filter(p => p.kind === 'relic' && G().poiState(p) && G().poiState(p).f && !G().poiState(p).d);
      for (const p of found) act.append(el('div', { class: 'row' }, el('span', { class: 'small' }, 'Reliquia descubierta'), UI.btn('Traerla', () => { G().claimRelic(p); UI.refreshPanel(true); }, { small: true, disabled: S().relics >= G().relicSlots() })));
      if (!found.length) act.append(el('p', { class: 'small muted' }, 'Explora el mapa para encontrar santuarios con reliquias.'));
    } else if (b.type === 'cartwright') {
      const L = PK.Logi, n = L.carts().length, max = L.cartMax();
      act.append(...[el('p', null, 'Carretas: ' + n + '/' + max + ' · carga ' + L.cartCap() + ' por viaje'),
        el('div', { class: 'row' }, UI.btn(el('span', null, 'Carreta ', UI.costEl(D.CART.cost)), () => { L.trainCart(b); UI.refreshPanel(true); }, { disabled: n + b.queue.length >= max })),
        b.queue.length ? el('div', { class: 'bar' }, el('div', { class: 'fill blue', style: { width: (b.qt / D.CART.time) * 100 + '%' } }), el('span', null, 'Armando carreta (' + b.queue.length + ' en cola)')) : null,
        el('p', { class: 'small muted' }, 'Las carretas no ocupan población. Abastecen los talleres alejados de los almacenes y llevan lo producido al taller que lo necesita (por ejemplo, tablones de un Aserradero a una Herrería).'),
        UI.btn('Logística', () => UI.openLogistics(), { small: true })].filter(Boolean));
    } else if (def.recipe) {
      const r = D.RECIPES[def.recipe], cap = PK.Logi.bufCap(b), ob = Object.keys(r.out)[0];
      const inp = Object.keys(r.in).map(k => UI.amount(k, r.in[k])), out = Object.keys(r.out).map(k => UI.amount(k, r.out[k]));
      act.append(el('div', { class: 'recipe' }, inp, ' → ', out, el('span', { class: 'small muted' }, ' · ' + r.time + 's por trabajador')));
      act.append(el('p', null, 'Trabajadores: ' + b.workers.length + '/' + G().slots(b) + ' · ' + (b.status || '')));
      act.append(UI.reservaRow(b));
      // depósitos y abastecimiento
      const near = PK.Logi.nearStore(b), belts = S().logi.belts.filter(x => x.a === b.id || x.b === b.id).length, carts = PK.Logi.carts().length;
      act.append(el('div', { class: 'bufs' },
        Object.keys(r.in).map(k => el('div', { class: 'buf' }, UI.resIcon(k), el('div', { class: 'bar' }, el('div', { class: 'fill green', style: { width: Math.min(100, ((b.inb[k] || 0) / cap) * 100) + '%' } }), el('span', null, Math.floor(b.inb[k] || 0) + '/' + cap)))),
        el('div', { class: 'buf' }, UI.resIcon(ob), el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: Math.min(100, ((b.outb[ob] || 0) / cap) * 100) + '%' } }), el('span', null, 'salida ' + Math.floor(b.outb[ob] || 0) + '/' + cap)))));
      act.append(el('p', { class: 'small ' + (near || carts || belts ? 'muted' : 'warn-t') }, near ? 'Junto a ' + near.def.name + ': se abastece solo (' + PK.Logi.directRate(b) + '/s).' + (belts ? ' Además tiene ' + belts + ' cinta(s).' : '') : belts ? 'Conectado por ' + belts + ' cinta(s).' : carts ? 'Lejos de los almacenes: lo abastecen tus ' + carts + ' carretas.' : 'Lejos de los almacenes y sin carretas: no recibe insumos. Construye una Carretería o acércalo a 3 casillas de un Almacén o del Centro Urbano.'));
      const rate = (b.workers.length * G().prodMult(def.recipe, b) * 60) / r.time;
      if (b.workers.length) act.append(el('p', { class: 'small ' + (near || carts || belts ? 'muted' : 'warn-t') }, near || carts || belts ? 'Hasta aprox. ' + rate.toFixed(1) + ' ' + D.RES[ob].name.toLowerCase() + ' por minuto, si le llegan insumos' : 'Sin abastecimiento no produce nada.'));
      act.append(el('p', { class: 'small muted' }, UI.hint('Selecciona aldeanos y haz clic derecho en el edificio para asignarlos.', 'Elige aldeanos y luego toca el edificio para asignarlos.')));
      if (b.workers.length) act.append(UI.btn('Sacar trabajadores', () => { b.workers.slice().forEach(id => G().release(G().uById.get(id))); UI.refreshPanel(true); }, { small: true }));
    } else if (b.type === 'farm') {
      const f = b.farmer !== null && G().uById.get(b.farmer);
      act.append(el('p', null, f ? 'Granjero trabajando.' : UI.hint('Sin granjero. Selecciona un aldeano y haz clic derecho aquí.', 'Sin granjero. Elige un aldeano y luego toca esta granja.')));
    } else if (b.type === 'library') act.append(UI.btn('Abrir investigación', () => UI.openResearch()));
    else if (b.type === 'market') act.append(UI.btn('Abrir mercado', () => PK.Social.openMarket()));
    else if (b.type === 'guild') act.append(UI.btn('Abrir gremio', () => PK.Social.openGuild()));
    else if (b.type === 'barracks') barracksQuick(act);
    else if (b.type === 'tower') act.append(el('p', { class: 'small' }, 'Dispara a los lobos cercanos y suma a la defensa del reino (' + U.fmt(PK.Social.defense()) + ').'), UI.btn('Cuartel', () => PK.Social.openWar('troops')), UI.btn('Murallas', () => UI.openBarracks('defense'), { small: true }));
    else if (b.type === 'tavern') act.append(el('p', { class: 'small' }, 'Encargos en el tablón: ' + PK.Exp.board().length + '.'), UI.btn('Ver encargos', () => UI.openBarracks('missions'), { cls: 'gold' }));
    else if (b.type === 'arena') act.append(el('p', { class: 'small' }, 'Tus tropas en casa ganan ' + G().bst(b).armyXp + ' de experiencia por hora.'), UI.btn('Ver tropas', () => UI.openBarracks('troops'), { small: true }));
    else if (b.type === 'wishwell' && b.done) {
      const w = S().exp.wish, offer = PK.Exp.wishOffer(), s2 = G().bst(b);
      if (w.buff && w.buff.until > Date.now()) { const d0 = D.WISHES.find(o => o.k === w.buff.k); act.append(el('p', { class: 'good-t' }, d0.name + ' activo: +' + Math.round(w.buff.p * 100) + '% (' + U.fmtTime((w.buff.until - Date.now()) / 1000) + ').')); }
      if (!offer.length) act.append(el('p', { class: 'small muted' }, 'Ya pediste el deseo de hoy. Mañana habrá tres nuevos.'));
      else act.append(el('p', { class: 'small' }, 'Lanza una moneda y elige un deseo (dura ' + U.fmtTime(s2.wishTime) + ', +' + Math.round(s2.wishPower * 100) + '%):'),
        el('div', { class: 'wish-row' }, offer.map(k => { const d0 = D.WISHES.find(o => o.k === k); return UI.btn(el('span', null, el('b', null, d0.name), el('br'), el('small', null, d0.desc)), () => { PK.Exp.makeWish(k); UI.refreshPanel(true); }, { cls: 'gold' }); })));
    } else if (b.type === 'observatory' && b.done) {
      const f = PK.Exp.forecast();
      act.append(el('p', { class: 'small' }, 'Mazmorras conocidas: ' + PK.Exp.sites().length + ' (busca hasta ' + G().bst(b).scan + ' casillas de tu Centro Urbano).'),
        f ? el('p', { class: 'small' }, 'Próximos lobos en aprox. ' + U.fmtTime(Math.max(0, f.wolves)) + ' · próximo evento en aprox. ' + U.fmtTime(Math.max(0, f.event)) + '.') : null,
        UI.btn('Expediciones', () => UI.openBarracks('exp'), { small: true }));
    }
    else if (def.drop) act.append(el('p', { class: 'small' }, 'Acepta: ' + def.drop.map(r => D.RES[r].name.toLowerCase()).join(', ') + '.'));
    if (b.type === 'granary' || b.type === 'warehouse') act.append(el('p', { class: 'small muted' }, 'Capacidad total: comida ' + U.fmt(G().cap('food')) + ' · bienes ' + U.fmt(G().cap('wood')) + '.'));
    if (b.type !== 'tc') act.append(el('div', { class: 'row end' },
      G().canMove(b) ? UI.btn(el('span', null, 'Mover ', UI.costEl(G().moveCost(b))), () => PK.Input.startMoving(b), { small: true, title: 'Llévalo a otro lugar sin perder su nivel (tecla V)' }) : '',
      UI.btn('Demoler', () => UI.confirmDemolish(b), { small: true, cls: 'danger' })));
    panel.append(act);
  }

  function nodePanel(n) {
    const def = D.NODES[n.kind], z = W.zoneOf(n);
    const workers = G().units.filter(u => u.task && u.task.t === 'gather' && u.task.node === n.id);
    const mine = workers.filter(u => u.owner === 'p').length;
    const spr = n.kind === 'tree' ? Sp.trees[n.sp][n.v % Sp.trees[n.sp].length] : n.kind === 'berry' ? Sp.bush[0] : n.kind === 'deer' ? Sp.deer[0] : Sp.rocks[n.kind][2][0];
    panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait', src: spr.c.toDataURL() }),
      el('div', null, el('h3', null, def.name),
        el('p', { class: 'small' }, z ? (z.common ? 'Zona común: ' + z.name : z.name) : 'Tierra salvaje (de todos)'),
        el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: (n.amount / n.max) * 100 + '%' } }), el('span', null, n.dead ? 'Agotado' : U.fmt(n.amount) + ' / ' + U.fmt(n.max))),
        el('p', { class: 'small muted' }, workers.length + ' recolectando (' + mine + ' tuyos) · ' + (def.regrow ? 'rebrota ' + U.fmtTime(def.regrow) + ' después de agotarse' : 'se regenera un ' + Math.round(def.regen * 100) + '% por hora')))));
    if (z && z.common) {
      const st = W.zoneStats(n.zone);
      panel.append(el('p', { class: 'small' }, z.name + ': ' + Math.round((st.amt / st.max) * 100) + '% de sus recursos disponibles. Compartida con todos los reinos.'));
    }
  }
  function poiPanel(p) {
    const def = D.POI[p.kind], st = G().poiState(p) || {}, tier = G().poiTier(p), spr = Sp.poi(p.kind, st.d);
    const info = el('div', null, el('h3', null, def.name + ' · rango ' + U.roman(tier + 1)), el('p', { class: 'small' }, def.desc));
    panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait', src: spr.c.toDataURL() }), info));
    if (p.kind === 'ruin') {
      if (st.d) info.append(el('p', { class: 'small muted' }, 'Ya excavada.'));
      else {
        info.append(el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: (st.p || 0) * 100 + '%' } }), el('span', null, 'Excavado ' + Math.floor((st.p || 0) * 100) + '%')));
        info.append(el('p', { class: 'small muted' }, UI.hint('Selecciona aldeanos y haz clic derecho aquí. Premio: ', 'Elige aldeanos y luego toca las ruinas. Premio: ')), UI.costEl(D.ruinReward(tier), 1, true));
      }
    } else if (p.kind === 'relic') {
      if (st.d) info.append(el('p', { class: 'small muted' }, 'La reliquia ya está en tu Monasterio.'));
      else info.append(UI.btn('Llevar al Monasterio', () => { G().claimRelic(p); UI.refreshPanel(true); }, { small: true, cls: 'gold' }));
    } else if (p.kind === 'camp') {
      if (st.d) info.append(el('p', { class: 'small muted' }, 'Destruido.'));
      else {
        const going = S().exp.runs.some(r => r.camp === p.id);
        info.append(el('p', { class: 'small' }, 'Fuerza aprox. ' + D.campPower(tier) + ' (bandidos: arqueros y caballeros rinden más). Botín: '), UI.costEl(D.campLoot(tier), 1, true),
          going ? el('p', { class: 'small good-t' }, 'Tus tropas van en camino.') : UI.btn('Atacar', () => UI.openBarracks('exp', { camp: p.id }), { small: true, cls: 'gold' }));
      }
    } else if (D.DUNGEON[p.kind]) {
      const d = D.DUNGEON[p.kind], site = PK.Exp.site(p.id), rest = site.rest - Date.now();
      info.firstChild.textContent = d.name;
      info.append(el('p', { class: 'small' }, 'Enemigos: ' + enemyText(d.enemy) + '. Conviene llevar ' + (bestVs(d.enemy) || 'de todo') + '.'),
        el('p', { class: 'small muted' }, 'Pisos limpiados: ' + site.best + ' de ' + d.floors + (rest > 0 ? ' · se repone en ' + U.fmtTime(rest / 1000) : '') + '. Da ' + D.RES[d.loot].name.toLowerCase() + '.'),
        S().era < d.era ? el('p', { class: 'small warn-t' }, 'Hace falta la Era ' + U.roman(d.era) + '.') :
          UI.btn('Preparar expedición al piso ' + Math.min(d.floors, site.best + 1), () => UI.openBarracks('exp', { poi: p.id, floor: Math.min(d.floors, site.best + 1) }), { small: true, cls: 'gold' }));
    } else info.append(el('p', { class: 'small muted' }, st.d ? 'Ya lo aprovechaste.' : ''));
  }

  function otherUnitPanel(u) {
    const bot = D.BOTS.find(b => b.id === u.owner);
    const port = Sp.villager(bot.color, u.hair, u.skin, 'idle', 0, null, false).c.toDataURL();
    panel.append(el('div', { class: 'p-head' }, el('img', { class: 'portrait unit', src: port }), el('div', null, el('h3', null, 'Aldeano de ' + bot.name), el('p', { class: 'small' }, bot.realm + ' · ' + taskText(u)))));
  }

  UI.confirmDemolish = function (b) {
    UI.modal('demo', 'Demoler ' + b.def.name, body => {
      body.append(el('p', null, b.done ? 'El edificio desaparecerá sin devolver recursos.' : 'Se cancelará la obra y recuperarás parte de lo invertido.'),
        el('div', { class: 'row' }, UI.btn('Sí, demoler', () => { G().demolish(b); UI.closeModal(); UI.refreshPanel(true); }, { cls: 'danger' }), UI.btn('Cancelar', () => UI.closeModal())));
    });
  };

  // ---------- Cuartel: tropas, ataques, encargos, defensa y crónica ----------
  // Revisión de nov. 2026 (beta): el botón «Atacar desde el Cuartel» de un campamento abría la pestaña de tropas
  // sin nada preparado, los ataques a campamentos eran un reloj invisible y las tropas no se veían en ninguna
  // parte. Ahora todo ataque (campamento, mazmorra o encargo) pasa por el mismo planificador, las tropas forman
  // frente al Cuartel y marchan por el mapa (troops.js), y cada batalla deja un informe.
  let barTab = 'troops', plan = null; // plan = { target: { poi, floor } | { mission } | { camp }, units }
  const enemyText = e => Object.keys(e).map(k => D.ENEMY[k].name + (Object.keys(e).length > 1 ? ' ' + Math.round(e[k] * 100) + '%' : '')).join(' · ');
  const bestVs = e => Object.keys(D.ARMY).sort((a, b) => PK.Exp.vsFactor(b, e) * D.ARMY[b].power - PK.Exp.vsFactor(a, e) * D.ARMY[a].power).filter(k => PK.Exp.vsFactor(k, e) > 1).map(k => D.ARMY[k].name).slice(0, 2).join(' y ');
  const troopImg = (k, cls) => el('img', { class: cls || 'tr-ico', src: Sp.troopIcon(k), alt: '', title: D.ARMY[k].name });
  const sumUnits = u => Object.keys(u || {}).reduce((s2, k) => s2 + (u[k] || 0), 0);

  // Lo que está fuera: expediciones, ataques y campañas.
  function awayUnits() {
    const st = S(), out = {};
    const add = u => { for (const k in u) out[k] = (out[k] || 0) + (u[k] || 0); };
    for (const r of st.exp.runs) add(r.units);
    for (const e of st.war.exps) add(e.units);
    for (const c of (st.terr && st.terr.camps) || []) add(c.units);
    return out;
  }
  // Resumen del ejército: en casa, fuera y la cola de entrenamiento (con la barra del que está saliendo).
  function armySummary() {
    const st = S(), w = st.war, away = awayUnits(), home = sumUnits(w.army), out = sumUnits(away);
    const box = el('div', { class: 'army-sum' });
    box.append(el('div', { class: 'as-head' }, el('b', null, home ? home + ' soldado' + (home > 1 ? 's' : '') + ' en casa' : 'Sin soldados en casa'),
      el('span', { class: 'small' }, ' · fuerza ' + U.fmt(PK.Social.power(w.army)) + (out ? ' · ' + out + ' fuera' : ''))));
    const kinds = Object.keys(D.ARMY).filter(k => w.army[k] || away[k]);
    if (kinds.length) box.append(el('div', { class: 'as-chips' }, kinds.map(k => el('span', { class: 'as-chip', title: D.ARMY[k].name + ': ' + w.army[k] + ' en casa' + (away[k] ? ', ' + away[k] + ' fuera' : '') },
      troopImg(k), el('b', null, String(w.army[k])), away[k] ? el('small', null, '+' + away[k] + ' fuera') : null))));
    else box.append(el('p', { class: 'small muted' }, 'Entrena tropas aquí abajo: salen del Cuartel y forman frente a él, en el mapa.'));
    if (w.q.length) {
      const k = w.q[0], sp = PK.Social.trainSpeed(), left = sp ? (D.ARMY[k].time - w.qt) / sp : 0, rest = w.q.slice(1);
      box.append(el('div', { class: 'as-queue' }, troopImg(k),
        el('div', { class: 'bar' }, el('div', { class: 'fill red', style: { width: U.clamp((w.qt / D.ARMY[k].time) * 100, 0, 100) + '%' } }), el('span', null, 'Entrenando ' + D.ARMY[k].name.toLowerCase() + ' · ' + U.fmtTime(left))),
        rest.length ? el('span', { class: 'as-next' }, rest.slice(0, 8).map(k2 => troopImg(k2, 'tr-mini')), rest.length > 8 ? el('small', null, '+' + (rest.length - 8)) : null) : null,
        UI.btn('Quitar último', () => { PK.Social.cancelArmy(); UI.rerender(); UI.refreshPanel(true); }, { small: true, title: 'Saca de la cola la última tropa y te devuelve lo que costó' })));
    }
    return box;
  }

  UI.openBarracks = function (tab, target) {
    if (tab) barTab = tab;
    if (target) plan = { target, units: null };
    UI.modal('war', 'Cuartel', body => {
      const st = S(), g = G();
      const tabs = el('div', { class: 'book-tabs bar-tabs' });
      const camps = W.pois.filter(p => p.kind === 'camp' && g.poiState(p) && g.poiState(p).f && !g.poiState(p).d).length;
      for (const [id, name, icon] of [['troops', 'Tropas', 'war'], ['exp', 'Atacar', 'crystal'], ['missions', 'Encargos', 'scroll'], ['defense', 'Defensa', 'wall'], ['log', 'Crónica', 'book']]) {
        const dot = id === 'exp' && camps && g.countB('barracks') && sumUnits(st.war.army);
        tabs.append(el('button', { class: 'book-tab' + (barTab === id ? ' on' : ''), onclick: () => { barTab = id; if (id !== 'exp' && id !== 'missions') plan = null; UI.rerender(true); } }, el('img', { class: 'ico', src: Sp.icon(icon) }), name, dot ? el('span', { class: 'dot' }) : null));
      }
      const tre = D.SPECIAL.filter(r => st.res[r] > 0);
      body.append(el('div', { class: 'war-top' },
        el('div', null, el('b', null, 'Defensa del reino: '), U.fmt(PK.Social.defense()), el('span', { class: 'muted small' }, ' (torres, Centro Urbano y soldados en casa)')),
        tre.length ? el('div', { class: 'treasure' }, el('b', null, 'Tesoros: '), tre.map(r => UI.amount(r, st.res[r]))) : null,
        PK.Social.truce() ? el('div', { class: 'truce' }, 'Tregua de novato: nadie te atacará hasta que construyas un Cuartel o llegues a la Era III.') : null,
        PK.Net.online ? PK.Net.incoming.map(r => el('div', { class: 'alert' }, '¡' + r.from + ' (jugador) ataca con fuerza aprox. ' + r.power + ' en ' + U.fmtTime((r.arrive - Date.now()) / 1000) + '!')) : null), tabs);
      const pane = el('div', { class: 'bar-pane' });
      body.append(pane);
      if (!g.countB('barracks') && barTab !== 'defense' && barTab !== 'log') {
        const can = g.isUnlocked('barracks'), building = g.countAll('barracks') > 0;
        pane.append(el('div', { class: 'empty-box' }, el('img', { src: Sp.buildingIcon('barracks'), alt: '' }),
          el('div', null, el('b', null, building ? 'Tu Cuartel está en obra.' : 'Todavía no tienes Cuartel.'),
            el('p', { class: 'small' }, building ? 'Cuando esté listo podrás entrenar tropas y atacar campamentos, mazmorras y encargos.' : can ? 'Constrúyelo para entrenar tropas y atacar campamentos de bandidos, mazmorras y encargos. Ojo: termina tu tregua de novato.' : 'Se desbloquea en la Era II. Las murallas (pestaña Defensa) sí se pueden levantar desde ya.'),
            can && !building ? UI.btn('Construir un Cuartel', () => { UI.closeModal(); PK.Input.startPlacing('barracks'); }, { cls: 'gold' }) : null)));
        return;
      }
      ({ troops: troopsTab, exp: expTab, missions: missionsTab, defense: defenseTab, log: logTab })[barTab](pane);
    }, { wide: true });
  };

  function troopsTab(pane) {
    const st = S(), w = st.war, bl = PK.Social.barracksLvl(), sp = PK.Social.trainSpeed() || 1;
    pane.append(armySummary());
    const grid = el('div', { class: 'army-grid' });
    for (const k in D.ARMY) {
      const a = D.ARMY[k], locked = st.era < a.era || bl < a.lvl, xp = st.exp.xp[k], r = D.rankOf(xp);
      const nx = D.rankXp(r + 1), cur = D.rankXp(r), why = locked ? null : PK.Social.trainWhy(k);
      const vs = Object.keys(a.vs).map(e => D.ENEMY[e].name.toLowerCase() + ' x' + String(a.vs[e]).replace('.', ',')).join(' · ');
      grid.append(el('div', { class: 'army-card' + (locked ? ' locked' : '') },
        el('div', { class: 'ac-top' }, troopImg(k, 'ac-img'),
          el('div', { class: 'ac-info' }, el('b', null, a.name), el('div', { class: 'small' }, 'Fuerza ' + a.power + ' · ' + U.fmtTime(a.time / sp) + (a.heal ? ' · sana' : '')),
            el('div', { class: 'small muted' }, vs ? 'Fuerte contra: ' + vs : 'Sin especialidad: sirve contra todo')),
          el('span', { class: 'ac-n', title: 'En casa' }, String(w.army[k]))),
        UI.costEl(a.cost),
        el('div', { class: 'bar thin' }, el('div', { class: 'fill gold', style: { width: (r >= D.RANKS.length - 1 ? 100 : ((xp - cur) / (nx - cur)) * 100) + '%' } }), el('span', null, D.RANKS[r] + (r ? ' (+' + r * 4 + '%)' : ''))),
        locked ? el('div', { class: 'muted small' }, 'Se desbloquea con ' + (st.era < a.era ? 'la Era ' + U.roman(a.era) : 'el Cuartel en nivel ' + a.lvl) + '.')
          : el('div', { class: 'row ac-btns' }, [1, 5, 10].map(n => UI.btn('+' + n, () => { PK.Social.trainArmy(k, n); UI.rerender(); UI.refreshPanel(true); }, { small: true, cls: n === 1 ? 'gold' : '', disabled: !!why, title: why || 'Entrenar ' + n }))),
        why && !locked ? el('div', { class: 'small warn-t' }, why) : null));
    }
    pane.append(el('h3', null, 'Entrenar'), grid);
    const nextLock = Object.keys(D.ARMY).filter(k => st.era >= D.ARMY[k].era && bl < D.ARMY[k].lvl).map(k => D.ARMY[k].name + ' (nivel ' + D.ARMY[k].lvl + ')');
    if (nextLock.length) pane.append(el('p', { class: 'small muted' }, 'Mejora el Cuartel para desbloquear: ' + nextLock.join(', ') + '. Cada nivel también entrena más rápido.'));
    const guide = el('details', { class: 'enemy-det' }, el('summary', null, 'Contra qué sirve cada tropa'), el('div', { class: 'enemy-guide' }, Object.keys(D.ENEMY).map(e => {
      const en = {}; en[e] = 1;
      return el('div', { class: 'eg' }, el('b', null, D.ENEMY[e].name), el('span', { class: 'small' }, D.ENEMY[e].desc), el('span', { class: 'small muted' }, 'Mejor: ' + (bestVs(en) || 'cualquiera')));
    })));
    pane.append(guide, el('p', { class: 'small muted' }, 'Cada tipo de tropa gana experiencia en las batallas (y sola en la Arena de Entrenamiento): +4% de fuerza por rango, también al defender.'));
  }

  // Planificador: elegir tropas, ver la fuerza contra ese enemigo, la probabilidad y el botín.
  function planner(pane) {
    const pv = PK.Exp.preview(plan.target);
    if (!pv) { plan = null; return; }
    const w = S().war;
    if (!plan.units) plan.units = PK.Exp.recommend(pv.enemy, pv.power);
    const est = el('div', { class: 'plan-est' }), go = el('span');
    const why = PK.Exp.canSend(plan.target);
    const refresh = () => {
      const p = PK.Exp.powerVs(plan.units, pv.enemy), ch = PK.Exp.chance(p / Math.max(1, pv.power)), heal = PK.Exp.heal(plan.units), n = sumUnits(plan.units);
      est.innerHTML = '';
      est.append(el('div', null, el('b', null, 'Tu fuerza: '), U.fmt(p) + ' contra ' + U.fmt(pv.power) + ' (' + n + ' soldado' + (n === 1 ? '' : 's') + ')'),
        el('div', { class: 'bar' }, el('div', { class: 'fill ' + (ch >= 0.75 ? 'green' : ch >= 0.45 ? 'gold' : 'red'), style: { width: ch * 100 + '%' } }), el('span', null, 'Probabilidad de victoria: ' + Math.round(ch * 100) + '%')),
        el('div', { class: 'small muted' }, heal ? 'Los clérigos reducen las bajas un ' + Math.round(heal * 100) + '%.' : 'Sin clérigos: las bajas serán completas.'));
      go.innerHTML = '';
      go.append(UI.btn('¡En marcha! (' + n + ')', () => { if (PK.Exp.send(plan.target, Object.assign({}, plan.units))) { plan = null; UI.closeModal(); } }, { cls: 'gold', disabled: !!why || !n }));
    };
    const kinds = Object.keys(D.ARMY).filter(k => w.army[k] > 0);
    const rows = el('div', { class: 'pick-rows' }, kinds.map(k => {
      const inp = el('input', { id: 'pl-' + k, type: 'number', min: 0, max: w.army[k], value: plan.units[k] || 0, inputmode: 'numeric' });
      const set = v => { plan.units[k] = U.clamp(Math.floor(+v || 0), 0, w.army[k]); inp.value = plan.units[k]; refresh(); };
      inp.addEventListener('input', () => set(inp.value));
      inp.addEventListener('keydown', e => e.stopPropagation());
      const f = PK.Exp.vsFactor(k, pv.enemy);
      return el('div', { class: 'pick-row' }, troopImg(k), el('b', null, D.ARMY[k].name), el('span', { class: 'small ' + (f > 1 ? 'good-t' : f < 1 ? 'warn-t' : 'muted') }, f !== 1 ? 'x' + (Math.round(f * 100) / 100).toString().replace('.', ',') : ''),
        UI.btn('−', () => set((plan.units[k] || 0) - 1), { small: true, aria: 'Uno menos' }), inp, UI.btn('+', () => set((plan.units[k] || 0) + 1), { small: true, aria: 'Uno más' }),
        el('span', { class: 'small muted' }, '/' + w.army[k]));
    }));
    pane.append(el('div', { class: 'planner' },
      el('div', { class: 'row pl-head' }, el('h3', null, pv.name), UI.btn('Cerrar', () => { plan = null; UI.rerender(); }, { small: true })),
      el('div', { class: 'small' }, 'Enemigos: ' + enemyText(pv.enemy) + '. Conviene: ' + (bestVs(pv.enemy) || 'cualquier tropa') + '. Viaje: ' + U.fmtTime(pv.travel) + ' de ida y otro tanto de vuelta.'),
      kinds.length ? rows : el('div', { class: 'empty-box small' }, el('div', null, el('b', null, 'No tienes soldados en casa.'), el('p', { class: 'small' }, 'Entrénalos en la pestaña Tropas: tardan unos segundos y quedan formados frente al Cuartel.'),
        UI.btn('Entrenar tropas', () => { barTab = 'troops'; UI.rerender(true); }, { small: true, cls: 'gold' }))),
      kinds.length ? est : null,
      el('div', { class: 'row' }, el('b', null, 'Botín si ganas: '), UI.costEl(pv.loot, 1, true)),
      why ? el('p', { class: 'small warn-t' }, why) : null,
      kinds.length ? el('div', { class: 'row' }, UI.btn('Compañía recomendada', () => { plan.units = PK.Exp.recommend(pv.enemy, pv.power); UI.rerender(); }, { small: true }),
        UI.btn('Todos', () => { plan.units = Object.assign({}, w.army); UI.rerender(); }, { small: true }), go) : null));
    refresh();
  }

  function runsList(pane) {
    const runs = S().exp.runs;
    if (!runs.length) return;
    pane.append(el('h3', null, 'Tropas fuera (' + runs.length + ')'));
    for (const r of runs) {
      if (r.phase === 'battle') {
        pane.append(el('div', { class: 'run-row' }, el('span', { class: 'run-ic' }, '⚔'),
          el('div', { class: 'dg-info' }, el('b', null, 'Peleando en ' + r.name), el('div', { class: 'small muted' }, sumUnits(r.units) + ' soldados · dirige la batalla en vivo')),
          UI.btn('Ver batalla', () => PK.Batalla.abrir(r.id), { small: true, cls: 'gold' })));
        continue;
      }
      const go = r.phase === 'go', left = Math.max(0, ((go ? r.arrive : r.back) - Date.now()) / 1000), pct = U.clamp(1 - left / Math.max(1, r.travel), 0, 1);
      pane.append(el('div', { class: 'run-row' + (go ? '' : r.won ? ' won' : ' lost') },
        el('span', { class: 'run-ic' }, go ? '⚔' : r.won ? '✔' : '✘'),
        el('div', { class: 'dg-info' }, el('b', null, (go ? 'Marchan hacia ' : r.won ? 'Vuelven con el botín de ' : 'Vuelven de ') + r.name),
          el('div', { class: 'bar thin' }, el('div', { class: 'fill ' + (go ? 'gold' : r.won ? 'green' : 'red'), style: { width: pct * 100 + '%' } }), el('span', null, (go ? 'llegan en ' : 'en casa en ') + U.fmtTime(left))),
          el('div', { class: 'small muted' }, sumUnits(r.units) + ' soldados' + (go && r.chance ? ' · probabilidad ' + Math.round(r.chance * 100) + '%' : '')),
          go ? el('div', { class: 'tactics', role: 'group', 'aria-label': 'Táctica' }, Object.keys(PK.Exp.TACTICS).map(k => {
            const tc = PK.Exp.TACTICS[k], on = (r.tactic || 'normal') === k;
            return UI.btn(tc.name, () => { PK.Exp.setTactic(r.id, k); UI.rerender(); }, { small: true, cls: on ? 'gold' : '', title: tc.desc, aria: 'Táctica ' + tc.name + ': ' + tc.desc });
          })) : null),
        r.mission ? null : UI.btn('Ver', () => { UI.closeModal(); const pos = PK.Troops.where('x' + r.id); if (pos) PK.Render.centerOn(pos[0], pos[1]); }, { small: true })));
    }
  }

  function expTab(pane) {
    const st = S(), g = G();
    if (plan && (plan.target.poi !== undefined || plan.target.camp !== undefined)) planner(pane);
    runsList(pane);
    // campamentos de bandidos (botín común, sin pisos)
    const camps = W.pois.filter(p => p.kind === 'camp' && g.poiState(p) && g.poiState(p).f && !g.poiState(p).d)
      .sort((a, b) => g.poiTier(a) - g.poiTier(b));
    pane.append(el('h3', null, 'Campamentos de bandidos (' + camps.length + ')'));
    if (!camps.length) pane.append(el('p', { class: 'muted small' }, 'Tus exploradores todavía no encontraron campamentos. Están en la niebla: cuando aparezca uno, lo verás aquí y en el mapa (humo negro).'));
    for (const p of camps) {
      const tier = g.poiTier(p), going = st.exp.runs.some(r => r.camp === p.id) || st.war.exps.some(e => e.camp === p.id);
      pane.append(el('div', { class: 'raid-row dungeon' },
        el('img', { class: 'dg-ico', src: Sp.poi('camp', false).c.toDataURL() }),
        el('div', { class: 'dg-info' }, el('b', null, 'Campamento de bandidos ' + U.roman(tier + 1)),
          el('div', { class: 'small' }, 'Fuerza aprox. ' + D.campPower(tier) + ' · viaje ' + U.fmtTime(PK.Exp.campTravel(p)) + ' · botín: ', UI.costEl(D.campLoot(tier), 1, true))),
        going ? el('span', { class: 'muted small' }, 'Tropas en camino') : UI.btn('Preparar ataque', () => { plan = { target: { camp: p.id }, units: null }; UI.rerender(); }, { small: true, cls: 'gold' }),
        UI.btn('Ver', () => { UI.closeModal(); PK.Render.centerOn(p.x + 1, p.y + 1); }, { small: true })));
    }
    const sites = PK.Exp.sites();
    pane.append(el('h3', null, 'Mazmorras descubiertas (' + sites.length + ')'));
    if (!sites.length) pane.append(el('p', { class: 'muted small' }, 'Tus exploradores todavía no encontraron mazmorras. Están escondidas en la niebla: cuevas de cristal y guaridas cerca, catacumbas, cráteres y nidos de dragón más lejos. El Observatorio las marca en el mapa.'));
    for (const p of sites) {
      const d = D.DUNGEON[p.kind], site = PK.Exp.site(p.id), rest = site.rest - Date.now(), next = Math.min(d.floors, site.best + 1);
      const going = st.exp.runs.some(r => r.poi === p.id), locked = st.era < d.era;
      const floorBtn = f => UI.btn((f > site.best ? 'Piso ' : 'Repetir piso ') + f, () => { plan = { target: { poi: p.id, floor: f }, units: null }; UI.rerender(); }, { small: true, cls: f > site.best ? 'gold' : '' });
      pane.append(el('div', { class: 'raid-row dungeon' + (locked ? ' locked' : '') },
        el('img', { class: 'dg-ico', src: Sp.poi(p.kind, false).c.toDataURL() }),
        el('div', { class: 'dg-info' }, el('b', null, d.name), el('div', { class: 'small' }, enemyText(d.enemy) + ' · da ' + D.RES[d.loot].name.toLowerCase()),
          el('div', { class: 'small muted' }, 'Pisos ' + site.best + '/' + d.floors + ' · viaje ' + U.fmtTime(PK.Exp.travel(p)) + (rest > 0 ? ' · se repone en ' + U.fmtTime(rest / 1000) : ''))),
        locked ? el('span', { class: 'muted small' }, 'Era ' + U.roman(d.era)) : going ? el('span', { class: 'muted small' }, 'Expedición en curso') :
          el('span', { class: 'row' }, site.best ? floorBtn(site.best) : null, site.best < d.floors ? floorBtn(next) : null),
        UI.btn('Ver', () => { UI.closeModal(); PK.Render.centerOn(p.x + 1, p.y + 1); }, { small: true })));
    }
  }

  function missionsTab(pane) {
    if (plan && plan.target.mission) planner(pane);
    runsList(pane);
    const list = PK.Exp.board();
    pane.append(el('h3', null, 'Tablón de encargos'), el('p', { class: 'small muted' }, 'Se renueva en ' + U.fmtTime(PK.Exp.boardLeft() / 1000) + '. La Taberna suma encargos. No están en el mapa: tus tropas salen del reino y vuelven.'));
    if (!list.length) pane.append(el('p', { class: 'muted small' }, 'No quedan encargos por ahora.'));
    for (const m of list) {
      const t = D.MISSIONS.find(o => o.id === m.tpl);
      pane.append(el('div', { class: 'raid-row' }, el('div', { class: 'dg-info' }, el('b', null, t.name), el('div', { class: 'small' }, t.desc),
        el('div', { class: 'small muted' }, enemyText(t.enemy) + ' · fuerza aprox. ' + U.fmt(m.power) + ' · ' + U.fmtTime(m.time))), UI.costEl(m.loot, 1, true),
        UI.btn('Preparar', () => { plan = { target: { mission: m.uid }, units: null }; UI.rerender(); }, { small: true, cls: 'gold' })));
    }
  }

  function defenseTab(pane) {
    const Def = PK.Def, st = S(), tier = Def.tier(), nx = Def.nextTier(), up = Def.upgradeCost();
    pane.append(el('div', { class: 'war-top' },
      el('div', null, el('b', null, 'Murallas: '), tier.name + ' · ' + st.def.walls.length + ' casillas y ' + st.def.gates.length + ' puertas'),
      el('div', null, el('b', null, 'Parcelas amuralladas: '), Def.walledCount() + ' (defensa x' + (1 + tier.bonus).toFixed(1) + ')')),
      el('div', { class: 'row' },
        el('span', null, UI.btn('Trazar muralla', () => { UI.closeModal(); PK.Input.cancelTool(); Def.tool = 'wall'; UI.refreshPanel(true); }, { cls: 'gold' }), ' ', UI.costEl(tier.cost), el('span', { class: 'small muted' }, ' por casilla')),
        el('span', null, UI.btn('Poner puerta', () => { UI.closeModal(); PK.Input.cancelTool(); Def.tool = 'gate'; UI.refreshPanel(true); }), ' ', UI.costEl(D.WALL.gate))),
      nx ? el('div', { class: 'row' }, UI.btn('Mejorar todo a ' + nx.name, () => { Def.upgrade(); UI.rerender(); }, { disabled: st.era < nx.era || !Def.count() }), UI.costEl(up),
        st.era < nx.era ? el('span', { class: 'small muted' }, 'Era ' + U.roman(nx.era)) : null) : el('p', { class: 'small muted' }, 'Tus murallas ya son bastiones.'),
      el('h3', null, 'Cómo funcionan'), el('ul', { class: 'info' },
        el('li', null, 'Se trazan con dos toques, como los caminos, y solo en tu territorio.'),
        el('li', null, 'Bloquean el paso a todos. Las puertas dejan pasar a tus aldeanos y carretas, pero no a los lobos.'),
        el('li', null, 'Una parcela rodeada por murallas (también valen edificios y agua) queda amurallada: su defensa se multiplica según el material (x1,3 empalizada, x1,6 piedra, x2 sillares, x2,6 bastión). Los aldeanos de adentro están a salvo de los lobos.'),
        el('li', null, 'Al mejorar, todas las murallas cambian de material juntas. Desarmar devuelve la mitad.')));
  }

  function logTab(pane) {
    const w = S().war, reps = w.reports || [];
    pane.append(el('h3', null, 'Informes de batalla'));
    if (!reps.length) pane.append(el('p', { class: 'muted small' }, 'Cuando tus tropas peleen, aquí quedará el informe: quiénes fueron, las bajas y el botín.'));
    for (const r of reps) pane.append(el('button', { class: 'rep-row ' + (r.won ? 'won' : 'lost'), onclick: () => UI.openReport(r) },
      el('b', null, (r.won ? '✔ Victoria · ' : '✘ Derrota · ') + r.name), el('span', { class: 'small muted' }, sumUnits(r.sent) + ' soldados · hace ' + U.fmtTime(Math.max(1, (Date.now() - r.at) / 1000)))));
    pane.append(el('h3', null, 'Crónica'), el('div', { class: 'log scroll' }, w.log.length ? w.log.map(l => el('div', { class: l.kind }, l.text)) : el('div', { class: 'muted' }, 'Todavía no pasó nada digno de contarse.')));
  }

  // Informe de una batalla: tu compañía, las bajas de cada tropa, la probabilidad que tenías y el botín.
  UI.openReport = function (r) {
    UI.modal('report', r.won ? '¡Victoria!' : 'Derrota', body => {
      const kinds = Object.keys(r.sent || {}).filter(k => r.sent[k] > 0);
      body.append(el('div', { class: 'report ' + (r.won ? 'won' : 'lost') },
        el('h2', null, r.name),
        r.live ? el('p', { class: 'small good-t' }, r.retreat ? 'Te retiraste a tiempo: se salvaron más soldados.' : 'Batalla peleada en vivo: el resultado y las bajas salieron de la pelea.') : null,
        el('p', null, 'Tu fuerza ' + U.fmt(r.power) + ' contra aprox. ' + U.fmt(r.need) + (r.enemy ? ' (' + enemyText(r.enemy).toLowerCase() + ')' : '') + '. Probabilidad: ' + Math.round((r.chance || 0) * 100) + '%.'),
        el('h3', null, 'Tu compañía'),
        el('div', { class: 'rep-units' }, kinds.map(k => el('div', { class: 'rep-u' }, troopImg(k), el('b', null, D.ARMY[k].name), el('span', { class: 'small' }, r.sent[k] + ' fueron'),
          (r.lost || {})[k] ? el('span', { class: 'small warn-t' }, '−' + r.lost[k] + ' bajas') : el('span', { class: 'small good-t' }, 'sin bajas')))),
        r.loot ? el('h3', null, 'Botín (llega con las tropas)') : null, r.loot ? UI.costEl(r.loot, 1, true) : null,
        r.won ? null : el('p', { class: 'small' }, 'Arma la compañía con las tropas que mejor rinden contra ' + (r.enemy ? enemyText(r.enemy).toLowerCase() : 'ese enemigo') + ' (' + (r.enemy ? bestVs(r.enemy) || 'cualquiera' : 'cualquiera') + ') o lleva más soldados, y vuelve a intentarlo.'),
        el('div', { class: 'row' }, UI.btn('Ir al Cuartel', () => UI.openBarracks('exp'), { small: true, cls: 'gold' }), UI.btn('Cerrar', () => UI.closeModal(), { small: true }))));
    });
  };

  // Panel del Cuartel elegido en el mapa: el ejército y entrenar sin abrir la ventana.
  function barracksQuick(act) {
    const st = S(), bl = PK.Social.barracksLvl();
    act.append(armySummary());
    const row = el('div', { class: 'row tq' });
    for (const k in D.ARMY) {
      const a = D.ARMY[k];
      if (st.era < a.era || bl < a.lvl) continue;
      const why = PK.Social.trainWhy(k);
      row.append(UI.btn(el('span', null, troopImg(k, 'tr-mini'), '+1 ' + a.name), () => { PK.Social.trainArmy(k, 1); UI.refreshPanel(true); }, { small: true, disabled: !!why, title: why || 'Entrenar un ' + a.name.toLowerCase() }));
    }
    act.append(el('p', { class: 'small p-sub' }, el('b', null, 'Entrenar')), row,
      el('div', { class: 'row' }, UI.btn('Abrir Cuartel', () => UI.openBarracks('troops'), { cls: 'gold' }), UI.btn('Atacar', () => UI.openBarracks('exp'), { small: true }),
        UI.btn('Encargos', () => UI.openBarracks('missions'), { small: true }), UI.btn('Territorio', () => UI.openTerritory(), { small: true })));
  }

  // ---------- Territorio ----------
  function armyPicker(w, prefix) {
    const ids = {};
    for (const k in D.ARMY) ids[k] = prefix + k;
    const box = el('span', { class: 'raid-in' }, Object.keys(ids).map(k => el('label', null, D.ARMY[k].name.slice(0, 3) + ' ', el('input', { id: ids[k], type: 'number', min: 0, max: w.army[k], value: w.army[k] }))));
    const read = () => { const u = {}; for (const k in ids) { const i = document.getElementById(ids[k]); u[k] = U.clamp(Math.floor(+(i && i.value) || 0), 0, w.army[k]); } return u; };
    return { box, read };
  }
  // Resumen de una batalla por una parcela: fuerza contra defensa, de dónde salió la defensa y la causa.
  UI.battleEl = function (b) {
    const total = Math.max(1, Object.keys(D.DEF_PARTS).reduce((s, k) => s + (b.parts[k] || 0), 0)), mine = b.role === 'def';
    const head = (mine ? (b.won ? 'Resististe a ' : 'Perdiste contra ') : (b.won ? 'Ganaste a ' : 'Perdiste contra ')) + b.vs + ' · hace ' + U.fmtTime(Math.max(1, (Date.now() - b.at) / 1000));
    return el('div', { class: 'battle' },
      el('b', null, head),
      el('p', { class: 'small' }, (mine ? 'Su fuerza ' : 'Tu fuerza ') + U.fmt(b.atk) + ' contra ' + (mine ? 'tu defensa ' : 'su defensa ') + U.fmt(b.def) + '.'),
      Object.keys(D.DEF_PARTS).filter(k => b.parts[k] > 0).sort((x, y) => b.parts[y] - b.parts[x]).map(k => el('div', { class: 'g-row' },
        el('span', { class: 'small', style: { minWidth: '120px' } }, D.DEF_PARTS[k][0][0].toUpperCase() + D.DEF_PARTS[k][0].slice(1)),
        el('div', { class: 'bar thin' }, el('div', { class: 'fill ' + (mine ? 'green' : 'red'), style: { width: Math.round((b.parts[k] / total) * 100) + '%' } }), el('span', null, U.fmt(b.parts[k]) + ' · ' + Math.round((b.parts[k] / total) * 100) + ' %')))),
      el('p', { class: 'small ' + (b.won ? 'good-t' : 'warn-t') }, b.cause));
  };
  UI.openTerritory = function () {
    UI.modal('terr', 'Territorio', body => {
      const T = PK.Terr, st = S(), tr = st.terr, now = Date.now();
      body.append(el('div', { class: 'war-top' },
        el('div', null, el('b', null, 'Tus parcelas: '), T.count() + ' de ' + T.max() + ' (cada era permite ' + D.TERR.maxPerEra + ' más)'),
        el('div', null, el('b', null, 'Reclamar la siguiente parcela libre: '), UI.costEl(T.claimCost())),
        tr.shield > now ? el('div', { class: 'truce' }, 'Tregua: nadie puede atacar tus fronteras por ' + U.fmtTime((tr.shield - now) / 1000) + '.') : null,
        st.era < D.TERR.minEra ? el('div', { class: 'truce' }, 'Tregua de novato: hasta la Era ' + U.roman(D.TERR.minEra) + ' nadie puede atacarte y tú tampoco puedes atacar. Sí puedes reclamar tierra libre.') : null),
        el('div', { class: 'row' }, UI.btn('Ver el mapa de territorio', () => { UI.closeModal(); PK.Terr.toggle(true); }, { cls: 'gold' })));
      body.append(el('h3', null, 'Cómo funciona'), el('ul', { class: 'info' },
        el('li', null, 'El mapa se divide en parcelas de 8x8. Solo puedes construir en las tuyas (los campamentos de acopio también van en tierra de nadie).'),
        el('li', null, 'Reclamar una parcela libre que toque tu territorio cuesta recursos, cada vez un poco más.'),
        el('li', null, 'Conquistar una parcela de otro reino es caro a propósito: la campaña se paga aunque pierdas, no hay botín y pierdes del 30% al 55% de las tropas aunque ganes.'),
        el('li', null, 'Defender es fácil: la defensa cuenta x1,5 en casa y +25% por cada parcela propia alrededor. Las torres y el Centro Urbano cercanos suman mucho.'),
        el('li', null, 'El corazón de cada reino (las parcelas junto a su Centro Urbano) nunca se puede conquistar. Lo que había en una parcela perdida se desarma y se devuelve completo.'),
        el('li', null, 'Los reinos muy avanzados no pueden atacar a los nuevos: hace falta estar a menos de 2 eras y que el otro tenga al menos la mitad de tu poder.')));
      if (tr.camps.length) {
        body.append(el('h3', null, 'Campañas'));
        for (const c of tr.camps) {
          const info = T.realmInfo(c.slot);
          body.append(el('div', { class: 'exp' }, (c.phase === 'go' ? 'Marchando contra ' : 'Regresando de ') + (info ? info.realm : '?') + ' · ' + U.fmtTime(Math.max(0, ((c.phase === 'go' ? c.arrive : c.back) - now) / 1000)),
            UI.btn('Ver', () => { UI.closeModal(); const [x, y] = T.center(c.k); PK.Render.centerOn(x, y); PK.Terr.toggle(true); }, { small: true })));
        }
      }
      const revs = T.revenges();
      if (revs.length) {
        body.append(el('h3', null, 'Revancha'));
        for (const rv of revs) body.append(el('div', { class: 'alert' }, T.revengeText(rv) + ' (a mitad de precio, aunque esté en tregua)',
          UI.btn('Ver', () => { UI.closeModal(); const [x, y] = T.center(rv.k); PK.Render.centerOn(x, y); PK.Terr.toggle(true); UI.openParcel(rv.k); }, { small: true })));
      }
      if (tr.battles.length) {
        body.append(el('h3', null, 'Últimas batallas'));
        for (const b of tr.battles.slice(0, 4)) body.append(UI.battleEl(b));
      }
      if (tr.threats.length) {
        body.append(el('h3', null, 'Amenazas'));
        for (const th of tr.threats) body.append(el('div', { class: 'alert' }, T.realmOf(th.slot).realm + ' prepara un ataque a tu frontera (fuerza aprox. ' + th.power + ').'));
      }
      const realms = D.BOTS.filter(b => st.flags['seen_' + b.slot]);
      if (realms.length) {
        body.append(el('h3', null, 'Reinos conocidos'));
        for (const b of realms) {
          const info = T.realmInfo(b.slot), why = D.canConquer(T.myInfo(), info);
          body.append(el('div', { class: 'raid-row' }, el('span', { class: 'swatch', style: { background: 'rgb(' + b.color.join(',') + ')' } }), el('b', null, b.realm), b.human ? el('span', { class: 'tag' }, 'jugador') : null,
            el('span', { class: 'small muted' }, ' Era ' + U.roman(info.era) + ' · ' + W.countParcels(b.slot) + ' parcelas · ' + (why ? why : 'se puede atacar en su frontera'))));
        }
      }
    }, { wide: true });
  };

  UI.openParcel = function (k) {
    UI.modal('parcel', 'Parcela', body => {
      const add = (...a) => body.append(...a.filter(Boolean));
      const T = PK.Terr, g = G(), st = S(), owner = W.ownerOfParcel(k), slot = W.terr[k] - 1;
      const [cx, cy] = T.center(k);
      if (W.terrCommon[k]) { add(el('p', null, 'Zona común: es de todos y nunca tendrá dueño. Cualquiera puede recolectar aquí.')); return; }
      if (!owner) {
        const why = T.canClaim(k);
        add(el('p', null, 'Tierra libre.'), el('div', { class: 'row' }, el('b', null, 'Reclamar: '), UI.costEl(T.claimCost())),
          why ? el('p', { class: 'small warn-t' }, why) : null,
          el('div', { class: 'row' }, UI.btn('Reclamar parcela', () => { T.claim(k); UI.closeModal(); }, { cls: 'gold', disabled: !!why })));
        return;
      }
      const last = T.lastBattle(k);
      if (owner === 'p') {
        const def = T.defenseOf(k, D.MY_SLOT);
        add(el('p', null, 'Es tuya.' + (W.isCore(k, D.MY_SLOT) ? ' Es el corazón de tu reino: nadie la puede conquistar.' : '')),
          el('p', { class: 'small' }, 'Defensa de esta parcela: aprox. ' + U.fmt(def) + ' (torres cercanas, tus tropas y las parcelas propias alrededor).'),
          last ? el('h3', null, 'Última batalla aquí') : null, last ? UI.battleEl(last) : null);
        return;
      }
      const info = T.realmInfo(slot), def = T.defenseOf(k, slot), why = T.canAttack(k), cost = T.campaignCost(k), w = st.war, rv = T.revenge(k), retake = T.retakeLeft(k);
      add(el('p', null, el('b', null, info.realm), info.human ? ' (jugador)' : '', ' · Era ' + U.roman(info.era)),
        rv ? el('div', { class: 'alert' }, T.revengeText(rv) + '. Te quitó esta parcela: recupérala a mitad de precio, aunque esté en tregua.') : null,
        !rv && retake > 0 ? el('p', { class: 'small good-t' }, 'Te la quitaron hace poco: recuperarla cuesta la mitad durante ' + U.fmtTime(retake) + '.') : null,
        W.isCore(k, slot) ? el('p', { class: 'small' }, 'Es el corazón de ese reino: nunca se puede conquistar.') : null,
        el('p', { class: 'small' }, 'Defensa estimada: aprox. ' + U.fmt(def) + '. Tu ejército en casa: ' + U.fmt(PK.Social.power(w.army)) + '.'),
        el('div', { class: 'row' }, el('b', null, 'Costo de la campaña: '), UI.costEl(cost)),
        el('div', { class: 'row' }, el('b', null, 'Botín si ganas: '), UI.costEl(D.conquestLoot(info.era), 1, true)),
        el('p', { class: 'small warn-t' }, 'Si ganas pierdes entre el 12% y el 30% de las tropas que mandes (menos cuanto más fuerte llegues); si pierdes, entre el 70% y el 80%.'),
        last ? el('h3', null, 'Última batalla aquí') : null, last ? UI.battleEl(last) : null);
      if (why) { add(el('p', { class: 'small warn-t' }, why)); return; }
      const pk = armyPicker(w, 'cq-');
      add(el('div', { class: 'row' }, pk.box),
        el('div', { class: 'row' }, UI.btn('Lanzar campaña', () => { if (T.attack(k, pk.read())) UI.closeModal(); else UI.rerender(); }, { cls: 'danger' }), UI.btn('Ver en el mapa', () => { UI.closeModal(); PK.Render.centerOn(cx, cy); }, { small: true })));
    });
  };

  // ---------- Logística ----------
  UI.openLogistics = function () {
    UI.modal('logi', 'Logística', body => {
      const L = PK.Logi, g = G(), st = S();
      const shops = g.buildings.filter(b => b.owner === 'p' && b.done && b.def.recipe);
      const far = shops.filter(b => !L.nearStore(b));
      body.append(el('div', { class: 'war-top' },
        el('div', null, el('b', null, 'Carretas: '), L.carts().length + '/' + L.cartMax() + (g.countB('cartwright') ? '' : ' (construye una Carretería, Era II)')),
        el('div', null, el('b', null, 'Talleres lejos de un almacén: '), far.length + ' de ' + shops.length),
        el('div', null, el('b', null, 'Cintas: '), st.logi.belts.length)));
      body.append(el('div', { class: 'row' },
        UI.btn('Trazar camino', () => { UI.closeModal(); PK.Logi.tool = 'road'; PK.Input.cancelTool && (PK.Input.roadStart = null); UI.refreshPanel(true); }, { cls: 'gold' }),
        UI.btn('Tender cinta', () => { if (!L.beltUnlocked()) { UI.toast(L.beltLockText(), 'warn'); return; } UI.closeModal(); PK.Logi.tool = 'belt'; PK.Logi.beltFrom = null; UI.refreshPanel(true); }, { disabled: !L.beltUnlocked(), title: L.beltUnlocked() ? '' : L.beltLockText() })));
      body.append(el('h3', null, 'Cómo se mueven las cosas'), el('ul', { class: 'info' },
        el('li', null, 'Cada taller tiene un depósito de entrada y uno de salida. Solo produce con lo que tiene adentro.'),
        el('li', null, 'Si está a 3 casillas o menos de un Almacén o del Centro Urbano, se abastece solo, pero despacio.'),
        el('li', null, 'Las carretas abastecen talleres lejanos y arman cadenas: llevan lo que sale de un taller directo al que lo usa (madera → tablones → herramientas).'),
        el('li', null, 'Los caminos aceleran un 40% a los aldeanos y casi triplican la velocidad de las carretas, que fuera del camino van lentas.'),
        el('li', null, 'Las cintas (' + L.beltLockText().replace('Las cintas requieren ', 'requieren ') + ') unen dos edificios y mueven ' + D.BELT.rate + ' unidades por segundo sin que nadie cargue nada.')));
      if (shops.length) {
        body.append(el('h3', null, 'Talleres'));
        for (const b of shops) {
          const r = D.RECIPES[b.def.recipe], cap = L.bufCap(b), out = Object.keys(r.out)[0];
          body.append(el('div', { class: 'work-row' }, el('img', { class: 'ico', src: Sp.buildingIcon(b.type) }), el('b', null, b.def.name + ' ' + b.lvl),
            el('span', { class: 'small muted' }, ' ' + (b.status === 'En reserva' && G().reservaDe(b) ? G().reservaText(G().reservaDe(b)) : b.status || '') + ' · entrada ' + Object.keys(r.in).map(k => Math.floor(b.inb[k] || 0)).join('/') + ' · salida ' + Math.floor(b.outb[out] || 0) + '/' + cap + (L.nearStore(b) ? ' · junto a almacén' : '')),
            G().reservaDe(b) || b.sinReserva ? UI.btn(b.sinReserva ? 'Respetar reserva' : 'Producir igual', () => { b.sinReserva = !b.sinReserva; UI.rerender(); }, { small: true, cls: b.sinReserva ? '' : 'gold' }) : '',
            UI.btn('Ver', () => { UI.closeModal(); g.sel = { type: 'building', id: b.id }; PK.Render.centerOn(b.cx, b.cy); UI.refreshPanel(true); }, { small: true })));
        }
      }
      if (st.logi.belts.length) {
        body.append(el('h3', null, 'Cintas'));
        for (const bl of st.logi.belts) {
          const a = g.bById.get(bl.a), b = g.bById.get(bl.b);
          body.append(el('div', { class: 'work-row' }, el('span', null, (a ? a.def.name : '?') + ' → ' + (b ? b.def.name : '?') + ' · ' + bl.path.length + ' casillas'),
            UI.btn('Desarmar', () => { L.removeBelt(bl); UI.rerender(); }, { small: true, cls: 'danger' })));
        }
      }
    }, { wide: true });
  };

  // ---------- Investigación ----------

  UI.openResearch = function () {
    UI.modal('research', 'Investigación', body => {
      const st = S();
      if (!G().countB('library')) { body.append(el('p', { class: 'muted' }, 'Construye una Biblioteca (Era II) para investigar. Las investigaciones siguen avanzando aunque cierres el juego.')); return; }
      if (st.research) {
        const t = D.TECHS[st.research.id];
        body.append(el('div', { class: 'era-box' }, el('b', null, 'Investigando: ' + t.name + ' ' + U.roman(st.research.lvl)),
          el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: (st.research.t / st.research.total) * 100 + '%' } }), el('span', null, U.fmtTime((st.research.total - st.research.t) / G().researchMult())))));
      }
      body.append(el('p', { class: 'small muted' }, 'Nivel máximo: ' + G().techMax() + ' (el nivel de tu Biblioteca). Cada nivel cuesta más y tarda más: avanza un poco cada día. Velocidad: +' + Math.round((G().researchMult() - 1) * 100) + '%.'));
      const grid = el('div', { class: 'tech-grid' });
      for (const id in D.TECHS) {
        const t = D.TECHS[id], lvl = G().lvl(id), max = lvl >= G().techMax(), eraLock = t.era && st.era < t.era;
        void max;
        const cost = G().techCost(id, lvl);
        grid.append(el('div', { class: 'tech' + (eraLock ? ' locked' : '') },
          el('div', { class: 'tech-h' }, el('b', null, t.name), el('span', { class: 'lvl' }, 'Nv ' + lvl)),
          el('p', { class: 'small' }, t.desc),
          eraLock ? el('p', { class: 'small muted' }, 'Requiere Era ' + U.roman(t.era)) : lvl >= G().techMax() ? el('p', { class: 'small muted' }, 'Mejora la Biblioteca para el nivel ' + (lvl + 1)) :
            el('div', null, UI.costEl(cost), el('div', { class: 'small muted' }, U.fmtTime(G().techTime(lvl) / G().researchMult())),
              UI.btn('Investigar Nv ' + (lvl + 1), () => { G().startResearch(id); UI.rerender(); }, { small: true, disabled: !!st.research || !G().canAfford(cost) }),
              PK.Consejo && PK.Consejo.tiene('mayordomo') ? UI.btn('+ cola', () => { PK.Consejo.encolar(id); UI.rerender(); }, { small: true, title: 'El Mayordomo la empieza cuando termine lo que hay y alcancen los recursos' }) : '')));
      }
      if (PK.Consejo && PK.Consejo.tiene('mayordomo')) body.prepend(PK.Consejo.colaEl());
      body.append(grid);
    }, { wide: true });
  };

  // ---------- Obras: todos tus edificios y sus mejoras ----------
  // Decretos del reino (Eras VII y X): una especialización permanente a elegir entre cuatro.
  UI.openDecree = function () {
    UI.modal('decree', 'Decreto real', body => {
      const g = G(), st = S(), pend = g.decreePending();
      body.append(el('p', null, pend ? 'Tu reino creció lo suficiente para especializarse. Elige un decreto: dura para siempre.' : 'Los decretos especializan tu reino para siempre.'));
      if (st.decrees.length) body.append(el('p', { class: 'small' }, el('b', null, 'Vigentes: '), st.decrees.map(id => D.DECREES[id].name).join(' · ')));
      if (!pend) {
        const next = D.DECREE_ERAS.find(e => e > st.era);
        body.append(el('p', { class: 'small muted' }, next ? 'El próximo decreto llega en la Era ' + U.roman(next) + '.' : 'Ya elegiste todos los decretos.'));
        return;
      }
      body.append(el('div', { class: 'decrees' }, Object.keys(D.DECREES).filter(id => !st.decrees.includes(id)).map(id => {
        const d = D.DECREES[id];
        return el('div', { class: 'decree' }, el('b', null, d.name), el('p', { class: 'small' }, d.desc), UI.btn('Decretar', () => { if (g.chooseDecree(id)) UI.closeModal(); }));
      })));
    });
  };

  UI.openWorks = function () {
    UI.modal('works', 'Obras y mejoras', body => {
      const g = G(), st = S();
      body.append(el('div', { class: 'war-top' },
        el('div', null, el('b', null, 'Maestros de Obras: '), g.buildersBusy() + ' ocupados de ' + g.builders(), g.builders() < 5 ? el('span', { class: 'muted small' }, ' · construye una Casa del Maestro de Obras para tener otro') : null),
        el('div', { class: 'small muted' }, 'Cada edificio sube de nivel por separado. Nivel máximo en la Era ' + U.roman(st.era) + ': ' + D.maxLevel('house', st.era) + '. Las obras siguen aunque cierres el juego.')));
      // dominio de la era: meta alcanzable de cada era, con premio
      const ms = g.mastery(), won = st.mastered && st.mastered[st.era];
      body.append(el('div', { class: 'row mastery' + (won ? ' good-t' : '') }, el('b', null, 'Dominio de la Era ' + U.roman(st.era) + ': '),
        el('span', null, ms.done + ' de ' + ms.total + ' edificios al máximo' + (won ? ' · ¡era dominada!' : ' · premio: ')), won ? null : UI.costEl(D.masteryReward(st.era), 1, true)));
      if (st.era >= D.DECREE_ERAS[0]) body.append(UI.btn(g.decreePending() ? '¡Elegir decreto real!' : 'Decretos del reino', () => UI.openDecree(), { small: true }));
      const busy = g.buildings.filter(b => b.owner === 'p' && b.upg);
      if (busy.length) {
        body.append(el('h3', null, 'En obra'));
        for (const b of busy) body.append(el('div', { class: 'work-row' }, el('img', { src: Sp.buildingIcon(b.type, 'p', b.lvl) }), el('b', null, b.def.name + ' → ' + (b.lvl + 1)),
          el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: (b.upg.t / b.upg.total) * 100 + '%' } }), el('span', null, U.fmtTime(b.upg.total - b.upg.t))),
          g.canNudge(b) ? UI.btn('Empujón gratis', () => { g.nudge(b); UI.rerender(); }, { small: true, cls: 'gold' })
            : UI.btn(el('span', null, 'Ya ', UI.amount('coins', g.speedUpCost(b))), () => { g.speedUp(b); UI.rerender(); }, { small: true, disabled: PK.Platform.getCoins() < g.speedUpCost(b) })));
      }
      const q = st.upq.map(id => g.bById.get(id)).filter(Boolean);
      body.append(el('h3', null, 'Cola de obras (' + q.length + '/' + PK.Auto.QMAX + ')'));
      if (!q.length) body.append(el('p', { class: 'small muted' }, 'Pon mejoras en la cola y tus maestros las empezarán solos, en orden apenas tengan recursos (si una no alcanza, siguen con la siguiente). Funciona también mientras no estás.'));
      q.forEach((b, i) => body.append(el('div', { class: 'work-row' }, el('span', { class: 'lvl' }, '#' + (i + 1)), el('img', { src: Sp.buildingIcon(b.type, 'p', b.lvl) }), el('b', null, b.def.name + ' → ' + (b.lvl + 1)),
        el('span', { class: 'wcost' }, UI.costEl(g.upCost(b))), UI.btn('Quitar', () => { PK.Auto.dequeue(b); UI.rerender(); }, { small: true }))));
      body.append(el('h3', null, 'Tus edificios'));
      const list = g.buildings.filter(b => b.owner === 'p' && b.done && !b.def.noUp && !b.upg)
        .sort((a, c) => D.BUILD_ORDER.indexOf(a.type) - D.BUILD_ORDER.indexOf(c.type) || a.lvl - c.lvl);
      const box = el('div', { class: 'works scroll' });
      for (const b of list) {
        const c = g.canUpgrade(b), max = g.maxLvl(b.type);
        const ver = () => { UI.closeModal(); g.sel = { type: 'building', id: b.id }; PK.Render.centerOn(b.cx, b.cy); UI.refreshPanel(true); };
        // toda la fila lleva al edificio (en el celular se esconde «Ver» para que la fila quepa en una línea)
        box.append(el('div', { class: 'work-row' + (c.ok ? ' ok' : ''), onclick: e => { if (!e.target.closest('button')) ver(); } }, el('img', { src: Sp.buildingIcon(b.type, 'p', b.lvl) }),
          el('b', null, b.def.name), el('span', { class: 'lvl' }, 'Nv ' + b.lvl + '/' + max),
          b.lvl >= max ? el('span', { class: 'muted small' }, 'máximo de la era') : el('span', { class: 'wcost' }, UI.costEl(g.upCost(b)), el('span', { class: 'muted small' }, ' ' + U.fmtTime(g.upTime(b)))),
          b.lvl >= max ? null : c.ok ? UI.btn('Mejorar', () => { g.upgrade(b); PK.Auto.dequeue(b); UI.rerender(); }, { small: true, cls: 'gold' }) :
            PK.Auto.queued(b) ? el('span', { class: 'small good' }, 'en cola') : UI.btn('A la cola', () => { PK.Auto.enqueue(b); UI.rerender(); }, { small: true }),
          UI.btn('Ver', ver, { small: true, cls: 'wk-ver' })));
      }
      body.append(box);
    }, { wide: true });
  };

  // ---------- Aldeanos: trabajos y Capataz ----------
  // Los aldeanos ya no construyen (las obras se levantan solas): solo se elige qué hacen. Arriba, cuántos hay en
  // cada trabajo con − y +; abajo, el Capataz, que reparte a los que quedan ociosos según tus prioridades.
  // A5: cuánto caminan los recolectores de ese recurso; si es más de la mitad, un botón deja el campamento ubicado.
  function eficiencia(res) {
    const A = PK.Auto, ef = A.eficiencia(res);
    if (ef === null) return '';
    const mal = ef > 0.5;
    return el('span', { class: 'small ' + (mal ? 'warn-t' : 'muted') }, ' · caminan ' + Math.round(ef * 100) + '% del tiempo' + (mal ? ': pon un punto de acopio más cerca ' : ''),
      mal && A.CAMPO[res] ? UI.btn('Ubicar ' + D.BUILD[A.CAMPO[res]].name, () => { const p = A.acopioCerca(res); if (!p) { UI.toast('No encuentro lugar libre junto a donde trabajan.', 'warn'); return; } UI.closeModal(); A.proponerCampo(p.tipo, p.x, p.y); }, { small: true }) : '');
  }
  UI.openForeman = function () {
    UI.modal('foreman', 'Aldeanos', body => {
      const st = S(), a = st.auto, A = PK.Auto, jc = A.jobCounts(), all = A.villagers().length;
      const held = A.villagers().filter(u => !u.task && !u.inside && u.hold).length;
      body.append(el('div', { class: 'war-top' },
        el('div', null, el('b', null, all + ' aldeanos'), el('span', { class: 'small' }, ' · ' + (jc.idle || 0) + ' ociosos' + (held ? ' (' + held + ' quietos a propósito)' : '') + ' · población ' + G().pop() + '/' + G().popCap())),
        el('div', { class: 'row' }, (jc.idle || 0) ? UI.btn('Repartir ociosos ahora', () => { A.freeIdle(); UI.rerender(); }, { small: true, cls: 'gold', title: 'El Capataz les da trabajo según tus prioridades' }) : null,
          UI.btn('Entrenar en el Centro Urbano', () => { const tc = G().buildings.find(b => b.owner === 'p' && b.type === 'tc' && b.done); if (tc) { UI.closeModal(); UI.selectBuilding(tc); } }, { small: true }))));
      body.append(el('h3', null, 'Trabajos'), el('p', { class: 'small muted' }, '+ suma un ocioso (o uno del trabajo con más gente) y lo manda al lugar más conveniente. − deja uno quieto, sin trabajo, hasta que le des otra cosa.'));
      const rows = el('div', { class: 'job-rows' });
      for (const id in A.JOBS) {
        const j = A.JOBS[id], n = jc[id] || 0;
        if ((id === 'ore' || id === 'marble' || id === 'gems') && !n && !st.flags['seenRes_' + id] && st.era < 2) continue;
        const ok = n > 0 || A.jobAvailable(id);
        rows.append(el('div', { class: 'job-row' + (ok ? '' : ' off') }, el('img', { class: 'ico', src: Sp.icon(j.icon), alt: '' }), el('b', null, j.name),
          el('span', { class: 'jr-n' }, String(n)),
          UI.btn('−', () => { A.removeJob(id); UI.rerender(); }, { small: true, disabled: !n, aria: 'Uno menos en ' + j.name }),
          UI.btn('+', () => { A.addJob(id); UI.rerender(); }, { small: true, cls: 'gold', disabled: !ok || !all, aria: 'Uno más en ' + j.name }),
          el('span', { class: 'small muted' }, ok ? j.hint || '' : id === 'work' ? 'sin talleres abastecidos con puestos libres' : id === 'dig' ? 'sin ruinas descubiertas' : A.whyText(id)),
          eficiencia(id)));
      }
      body.append(rows);
      const chk = (key, label, help) => el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: a[key], onchange: e => { a[key] = e.target.checked; UI.rerender(); } }), el('b', null, ' ' + label), el('span', { class: 'small muted' }, ' — ' + help));
      body.append(el('h3', null, 'Capataz'),
        el('p', { class: 'small' }, 'Da trabajo a los aldeanos que se quedan sin hacer nada más de 3 segundos (también mientras no estás). Las órdenes que das tú no las cambia.'),
        chk('idle', 'Repartir aldeanos ociosos', 'los manda al recurso que más falta según tus prioridades'),
        chk('work', 'Ocupar los talleres', 'llena los puestos libres de talleres con insumos: con los ociosos y, si no hay, con un recolector que puso él (cada 10 s)'),
        chk('train', 'Entrenar sin parar', 'el Centro Urbano entrena aldeanos mientras haya casas y comida'),
        chk('rebal', 'Reequilibrar', 'cada 20 s pasa hasta 3 de sus aldeanos al recurso más lejos de su objetivo (nunca a los que mandaste tú)'),
        el('div', { class: 'reserve-row' }, el('b', null, 'Reserva de los talleres: '),
          ...[0, 0.15, 0.3, 0.5].map(v => UI.btn(Math.round(v * 100) + '%', () => { a.reserve = v; UI.rerender(); }, { small: true, cls: a.reserve === v ? 'gold' : '' })),
          el('span', { class: 'small muted rr-help' }, ' los talleres no gastan un insumo si la bodega queda bajo este porcentaje; si un taller pasa 20 s parado, los trabajadores que puso el Capataz salen a recolectar')));
      body.append(el('h3', null, 'Prioridades del Capataz'),
        el('div', { class: 'row plan-row' }, Object.keys(A.PLANES).map(id => UI.btn(A.PLANES[id].name, () => { A.setPlan(id); UI.rerender(); }, { small: true, cls: (a.plan || 'mano') === id ? 'gold' : '', title: A.PLANES[id].help }))),
        el('p', { class: 'small muted' }, 'Plan: ' + A.PLANES[a.plan || 'mano'].name + ' — ' + A.PLANES[a.plan || 'mano'].help + (a.plan === 'meta' ? ' (se recalcula cada minuto)' : '') + '.'));
      const { c, n } = PK.Auto.counts();
      const sum = PK.Auto.RES.reduce((s2, r) => s2 + (a.w[r] || 0), 0) || 1;
      const prio = el('div', { class: 'guild-rows' });
      for (const r of PK.Auto.RES) {
        const v = a.w[r] || 0;
        prio.append(el('div', { class: 'g-row prio-row' }, UI.resIcon(r), el('b', { class: 'fw-name' }, D.RES[r].name),
          UI.btn('−', () => { a.w[r] = Math.max(0, v - 1); a.plan = 'mano'; PK.Auto.rebalance(10); UI.rerender(); }, { small: true }),
          el('span', { class: 'fw-dots' }, '●'.repeat(v) + '○'.repeat(5 - v)),
          UI.btn('+', () => { a.w[r] = Math.min(5, v + 1); a.plan = 'mano'; PK.Auto.rebalance(10); UI.rerender(); }, { small: true }),
          el('span', { class: 'small muted pr-help' }, 'objetivo ' + Math.round((v / sum) * 100) + '% · ahora ' + (c[r] || 0) + ' (' + (n ? Math.round(((c[r] || 0) / n) * 100) : 0) + '%)')));
      }
      body.append(prio);
    }, { wide: true });
  };

  // ---------- Construir ----------
  // Menú propio (antes la grilla salía solo al elegir aldeanos, que además tenían que ir a levantar la obra).
  const BUILD_CATS = [
    ['Casas y bodegas', ['house', 'granary', 'warehouse', 'builder', 'tc']],
    ['Recolección', ['lumber', 'mining', 'mill', 'farm', 'scout']],
    ['Talleres', ['sawmill', 'masonry', 'smelter', 'forge', 'scriptorium', 'steelworks', 'workshop', 'cartwright']],
    ['Reino', ['market', 'library', 'consejo', 'university', 'monastery', 'guild', 'wonder']],
    ['Ejército y defensa', ['barracks', 'tower']],
  ];
  UI.openBuild = function () {
    UI.modal('build', 'Construir', body => {
      const g = G(), st = S(), seen = new Set();
      body.append(el('p', { class: 'small muted' }, 'Elige un edificio y ' + UI.hint('haz clic donde va', 'toca dónde va') + ' en tu tierra. Se levanta solo: tus aldeanos siguen con lo suyo. Arquitectura (Investigar) acelera las obras.'));
      const cats = BUILD_CATS.concat([['Leyendas', D.LEGEND_B]]);
      const rest = D.BUILD_ORDER.filter(t => !cats.some(c => c[1].includes(t)));
      if (rest.length) cats[3][1] = cats[3][1].concat(rest);
      for (const [name, types] of cats) {
        const grid = el('div', { class: 'bmenu' });
        for (const type of types) {
          if (!D.BUILD[type] || seen.has(type)) continue;
          seen.add(type);
          const def = D.BUILD[type], legend = g.legendLocked(type), eraLock = def.era > st.era, have = g.countAll(type), max = g.maxCount(type), full = have >= max;
          if (legend && name === 'Leyendas' && def.era > st.era + 2) continue; // las muy lejanas no se muestran todavía
          const cost = g.buildCost(type), afford = g.canAfford(cost), locked = legend || eraLock;
          const why = legend ? 'Se desbloquea con una misión de la rama Leyendas del Libro.' : eraLock ? 'Requiere la Era ' + U.roman(def.era) + '.' : full ? 'Ya tienes el máximo' + (typeof def.max === 'function' ? ' para tu era' : '') + ' (' + have + '/' + max + ').' : !afford ? 'Te faltan recursos.' : '';
          grid.append(el('button', { class: 'bcard' + (locked ? ' locked' : full ? ' full' : !afford ? ' poor' : ''), title: def.desc, onclick: () => {
            if (locked || full) { UI.toast(why, 'warn'); return; }
            UI.closeModal();
            PK.Input.startPlacing(type);
            UI.toast(UI.hint('Haz clic donde va ' + def.name + '.', 'Toca dónde va ' + def.name + ': primero verás cómo queda.'), 'info');
          } }, el('img', { class: 'bc-img', src: Sp.buildingIcon(type), alt: '' }),
            el('div', { class: 'bc-txt' }, el('b', null, def.name), el('span', { class: 'small bc-desc' }, def.desc),
              locked ? el('span', { class: 'small muted' }, legend ? '★ Leyendas' : 'Era ' + U.roman(def.era)) : el('span', { class: 'bc-cost' }, UI.costEl(cost), el('span', { class: 'small muted' }, ' · ' + U.fmtTime(def.time / g.buildMult('p')))),
              why && !locked ? el('span', { class: 'small warn-t' }, why) : null),
            max < 99 ? el('span', { class: 'bc-n' }, have + '/' + max) : have ? el('span', { class: 'bc-n' }, String(have)) : null));
        }
        if (grid.children.length) body.append(el('h3', null, name), grid);
      }
    }, { wide: true });
  };

  // ---------- Exploración ----------
  UI.openExplore = function () {
    UI.modal('explore', 'Exploración', body => {
      const g = G(), st = S();
      const lodge = g.countB('scout');
      body.append(el('div', { class: 'war-top' },
        el('div', null, el('b', null, 'Mapa explorado: '), Math.round(g.explorePct() * 1000) / 10 + '% (' + U.fmt(W.fogCount) + ' casillas)'),
        el('div', null, el('b', null, 'Exploradores: '), g.scoutCount() + '/' + g.scoutMax() + ' · alcance ' + g.exploreRange() + ' casillas'),
        lodge ? null : el('p', { class: 'muted small' }, 'Construye un Puesto de Exploradores para entrenar exploradores. Su nivel define cuántos tienes y hasta dónde llegan. Las torres también ven lejos.')));
      const found = W.pois.filter(p => g.poiState(p) && g.poiState(p).f);
      const counts = {};
      for (const p of W.pois) { const c = counts[p.kind] || (counts[p.kind] = [0, 0]); c[1]++; if (g.poiState(p) && g.poiState(p).f) c[0]++; }
      body.append(el('h3', null, 'Descubrimientos'), el('div', { class: 'poi-sum' }, Object.keys(D.POI).map(k => el('span', { class: 'tag' }, D.POI[k].name + ': ' + (counts[k] ? counts[k][0] + '/' + counts[k][1] : '0')))));
      if (lodge) {
        const fl = g.banderas();
        body.append(el('h3', null, 'Banderas de exploración'),
          el('p', { class: 'small muted' }, 'Marca hasta ' + g.BANDERAS_MAX + ' lugares en la niebla: ' + (g.dirigidos() > 1 ? 'tus 2 primeros exploradores van' : 'tu primer explorador va') + ' hacia ellos antes que a la niebla más cercana. ' + (g.dirigidos() > 1 ? '' : 'El Puesto en nivel 5 o Cartografía III suman un segundo explorador dirigido.')),
          el('div', { class: 'row' }, UI.btn('Poner bandera', () => { UI.closeModal(); PK.Input.startFlag(); }, { small: true, cls: 'gold', disabled: fl.length >= g.BANDERAS_MAX }),
            fl.map((f, i) => el('span', { class: 'tag' }, '⚑ ' + (i + 1) + ' ', UI.btn('Ver', () => { UI.closeModal(); PK.Render.centerOn(f[0], f[1]); }, { small: true }), UI.btn('✕', () => { fl.splice(i, 1); UI.rerender(); }, { small: true, aria: 'Quitar la bandera ' + (i + 1) })))));
      }
      const realms = D.BOTS.filter(b => st.flags['seen_' + b.slot]);
      if (realms.length) body.append(el('p', { class: 'small' }, 'Reinos encontrados: ' + realms.map(b => b.realm).join(', ') + '.'));
      const box = el('div', { class: 'works scroll' });
      const order = { relic: 0, ruin: 1, camp: 2, watch: 3, chest: 4 };
      found.sort((a, b) => (g.poiState(a).d ? 1 : 0) - (g.poiState(b).d ? 1 : 0) || order[a.kind] - order[b.kind]);
      for (const p of found) {
        const s2 = g.poiState(p), tier = g.poiTier(p);
        const state = s2.d ? { chest: 'abierto', watch: 'visitada', ruin: 'excavada', camp: 'destruido', relic: 'en tu Monasterio' }[p.kind] : p.kind === 'ruin' ? 'excavada ' + Math.floor((s2.p || 0) * 100) + '%' : p.kind === 'camp' ? 'fuerza aprox. ' + D.campPower(tier) : 'sin reclamar';
        box.append(el('div', { class: 'work-row' + (s2.d ? ' done' : '') }, el('img', { src: Sp.poi(p.kind, s2.d).c.toDataURL() }),
          el('b', null, D.POI[p.kind].name), el('span', { class: 'lvl' }, 'rango ' + U.roman(tier + 1)), el('span', { class: 'muted small' }, state),
          p.kind === 'relic' && !s2.d ? UI.btn('Al Monasterio', () => { g.claimRelic(p); UI.rerender(); }, { small: true, cls: 'gold' }) : null,
          UI.btn('Ver', () => { UI.closeModal(); g.sel = { type: 'poi', id: p.id }; PK.Render.centerOn(p.x + p.w / 2, p.y + p.h / 2); UI.refreshPanel(true); }, { small: true })));
      }
      if (!found.length) box.append(el('p', { class: 'muted' }, 'Aún no descubres nada. Hay cofres, ruinas, atalayas, reliquias y campamentos de bandidos escondidos en la niebla.'));
      body.append(box);
    }, { wide: true });
  };

  // ---------- Reinos y ranking ----------
  UI.openRealms = function () {
    const net = PK.Net;
    UI.modal('realms', 'Reinos', body => {
      body.append(el('h3', null, net.online ? 'Tu mundo: ' + net.world.name : 'Tu mundo (modo local)'));
      const rows = [{ me: true, name: UI.yo(net.online ? net.me.name : PK.Platform.getPlayer().name), color: D.PLAYER_COLOR, era: S().era }]
        .concat(D.BOTS.map(b => ({ name: b.realm, color: b.color, human: b.human, online: b.online, era: b.human ? b.era : null })));
      const humansN = rows.filter(r => r.human).length, onlineN = rows.filter(r => r.human && r.online).length;
      if (net.online) body.append(el('p', { class: 'small' + (onlineN ? ' good-t' : ' muted') }, humansN ? humansN + ' jugador(es) real(es) en tu mundo · ' + onlineN + ' en línea ahora.' : 'Por ahora eres el único jugador real de este mundo: los demás reinos son simulados hasta que llegue alguien.'));
      rows.sort((a, b) => (b.me ? 2 : 0) + (b.human ? 1 : 0) + (b.online ? 1 : 0) - ((a.me ? 2 : 0) + (a.human ? 1 : 0) + (a.online ? 1 : 0)));
      body.append(el('div', { class: 'offers' }, rows.map(r => el('div', { class: 'offer' + (r.human ? ' human' : '') },
        el('span', { class: 'swatch', style: { background: 'rgb(' + r.color.join(',') + ')' } }), el('b', null, r.name),
        r.me ? null : el('span', { class: 'tag' }, r.human ? (r.online ? 'jugador ● en línea' : 'jugador') : 'simulado'),
        r.era ? el('span', { class: 'muted small' }, ' · Era ' + U.roman(r.era)) : null))));
      // plaza del mundo: chat corto entre reinos, que además aparece como globo sobre el reino que habla
      const chat = el('div', { class: 'chat scroll' }, PK.Social.worldChat().map(m => el('div', { class: m.me ? 'me' : '' }, el('b', null, m.who + ': '), m.text)));
      const input = el('input', { id: 'wchat-in', placeholder: 'Escribe a todo el mundo…', maxlength: 100 });
      const send = t => { PK.Social.sayWorld(t); input.value = ''; setTimeout(() => UI.rerender(), 300); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') send(input.value); e.stopPropagation(); });
      body.append(el('h3', null, 'Plaza del mundo'), chat, el('div', { class: 'chat-in' }, input, UI.btn('Enviar', () => send(input.value), { small: true })),
        el('div', { class: 'row quick-say' }, D.QUICK_SAY.map(t => UI.btn(t, () => send(t), { small: true }))));
      setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 0);
      if (!net.online) {
        body.append(el('p', { class: 'muted' }, (PK.Platform.name === 'paginita-pro-beta' ? 'Beta cerrada: por ahora los demás reinos son simulados y tu partida se guarda en este navegador. El mundo compartido con otras personas llega más adelante.' : 'No hay servidor: los demás reinos son simulados. Ejecuta "node server.js" y abre el juego desde http://localhost:8080 para jugar con otras personas.')));
        return;
      }
      body.append(el('p', { class: 'muted small' }, 'Cada mundo tiene 16 reinos. Las casillas libres las ocupan reinos simulados hasta que llegue un jugador.'));
      body.append(el('h3', null, 'Ranking del servidor'));
      const rk = net.cache.ranking;
      if (!rk) body.append(el('p', { class: 'muted' }, 'Cargando…'));
      else body.append(el('ol', { class: 'rank' }, rk.map(r => el('li', { class: r.me ? 'me' : '' },
        el('span', null, r.name + (r.online ? ' ●' : '') + ' · ' + r.world), el('span', null, 'Era ' + U.roman(r.era) + ' · ' + U.fmt(r.total))))));
    });
    if (net.online) net.refreshRanking();
  };

  // ---------- Opciones ----------
  UI.openSettings = function () {
    UI.modal('settings', 'Opciones', body => {
      const nameIn = el('input', { id: 'pname', value: PK.Platform.getPlayer().name, maxlength: 20 });
      nameIn.addEventListener('keydown', e => e.stopPropagation());
      body.append(el('h3', null, 'Jugador'), el('div', { class: 'row' }, nameIn, UI.btn('Guardar nombre', () => { U.store.set('pk_player_name', nameIn.value.trim() || 'Tú'); UI.toast('Nombre guardado.', 'good'); }, { small: true })),
        el('h3', null, 'Sonido'),
        el('div', { class: 'row' }, UI.btn(PK.Sfx.on ? 'Silenciar (M)' : 'Activar sonido (M)', () => { PK.Sfx.toggle(); UI.rerender(); }, { small: true })),
        el('h3', null, 'Avisos'),
        el('p', { class: 'small muted' }, 'Te avisamos cuando termine una mejora, una investigación, una era o una expedición, y cuando el cofre diario esté listo, aunque el juego esté en otra pestaña.'),
        el('div', { class: 'row' }, PK.Notify.enabled()
          ? UI.btn('Desactivar avisos', () => { PK.Notify.enable(false); UI.rerender(); }, { small: true })
          : UI.btn('Activar avisos', () => PK.Notify.enable(true).then(() => UI.rerender()), { small: true, cls: 'gold' })),
        el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !!S().flags.evMin, onchange: e => { S().flags.evMin = e.target.checked; } }),
          el('b', null, ' Eventos achicados'), el('span', { class: 'small muted' }, ' — los eventos del mapa (ciervo dorado, estrellas, mercader…) aparecen como una pastilla chica arriba, sin el cartel grande. Igual se pueden abrir tocándolos.')),
        el('p', { class: 'small muted' }, 'Los avisos que aparecen y se van solos se cierran antes tocándolos.'),
        el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !S().flags.helpOff, onchange: e => { S().flags.helpOff = !e.target.checked; UI.refreshPanel(true); } }),
          el('b', null, ' Ayuda en el panel'), el('span', { class: 'small muted' }, ' — con nada elegido, el panel de abajo muestra cómo se juega. Sin ella, el panel solo aparece al elegir algo y el mapa queda libre.')),
        el('h3', null, 'Partida'),
        el('p', { class: 'small muted' }, 'El juego se guarda solo cada 20 segundos y al cerrar. Tus aldeanos siguen trabajando hasta 12 horas sin ti.'),
        el('div', { class: 'row' }, UI.btn('Guardar ahora', () => { G().save(); UI.toast('Partida guardada.', 'good'); }, { small: true }),
          UI.btn('Borrar partida', () => { if (confirm('¿Seguro? Se perderá todo tu progreso.')) G().reset(); }, { small: true, cls: 'danger' })),
        el('h3', null, 'Controles'),
        UI.isTouch() ? el('ul', { class: 'small' },
          el('li', null, 'Toca: seleccionar · Con aldeanos elegidos, toca un árbol, una mina o un edificio: recolectar / trabajar'),
          el('li', null, 'Para soltar lo elegido: toca el suelo vacío, vuelve a tocar al aldeano o usa la ✕ del panel'),
          el('li', null, 'Construir: elige el edificio en el menú, toca dónde va y vuelve a tocar (o «Construir aquí») para confirmar'),
          el('li', null, 'Mantén pulsado y arrastra: seleccionar grupo · Doble toque en un aldeano: todos los de su tipo en pantalla'),
          el('li', null, 'Con el Centro Urbano elegido, toca un recurso para fijar el punto de reunión'),
          el('li', null, 'Arrastra: mover cámara · Pellizca: zoom'),
          el('li', null, 'Botones Ocioso y Demoler en el menú lateral'))
        : el('ul', { class: 'small' },
          el('li', null, 'Clic: seleccionar · Arrastrar: seleccionar grupo · Mayús: añadir'),
          el('li', null, 'Clic derecho: recolectar / trabajar / mover'),
          el('li', null, 'Con el Centro Urbano seleccionado, clic derecho fija el punto de reunión'),
          el('li', null, 'WASD / flechas / botón central: mover cámara · Rueda: zoom'),
          el('li', null, 'C: construir · H: Centro Urbano · . o I: aldeano ocioso · Z: zonas · B: libro · V: mover el edificio elegido · Supr: demoler')));
      if (PK.dev) {
        body.append(el('h3', null, 'Modo desarrollo'), el('div', { class: 'row' },
          [1, 5, 20].map(s => UI.btn('x' + s, () => { G().timeScale = s; UI.toast('Velocidad x' + s, 'info'); }, { small: true })),
          UI.btn('+5K recursos', () => { for (const r of D.RES_ORDER) S().res[r] += 5000; }, { small: true }),
          UI.btn('Terminar obras', () => { for (const b of G().buildings) if (b.upg) b.upg.t = b.upg.total; if (S().research) S().research.t = S().research.total; if (S().eraProg) S().eraProg.t = S().eraProg.total; G().updateTimers(0); }, { small: true }),
          UI.btn('Revelar mapa', () => { G().revealAt(W.W / 2, W.H / 2, W.W); }, { small: true }),
          UI.btn('Lobos', () => PK.Life.debug.spawnPack(), { small: true }),
          UI.btn('Bandidos', () => { if (PK.Incursiones.activa()) PK.Incursiones.debug.atacar(); else PK.Incursiones.debug.ya(); }, { small: true }),
          UI.btn('Evento', () => PK.Life.debug.startEvent(), { small: true }),
          UI.btn('Simular 3h offline', () => { const rep = G().simulateOffline(3 * 3600); UI.closeModal(); UI.offlineReport(rep); }, { small: true })));
      }
    });
  };

  // ---------- Cofre: animación al abrirlo ----------
  // Antes el cofre diario solo dejaba un aviso y no se entendía qué había salido. Ahora tiembla, se abre con un
  // destello y los premios saltan uno por uno. o = { title, sub, reward, tier (0 normal, 1 bueno, 2 especial) }.
  UI.chestReveal = function (o) {
    const old = document.querySelector('.cr-back');
    if (old) old.remove();
    const sfx = n => PK.Sfx && PK.Sfx.play(n);
    const keys = Object.keys(o.reward || {}).filter(k => o.reward[k] > 0);
    const OPEN = 1.05, STEP = 0.24;
    const chest = el('img', { class: 'cr-chest', src: Sp.icon('chest'), alt: '' });
    const items = el('div', { class: 'cr-items' }, keys.map((k, i) => el('div', { class: 'cr-item', style: { animationDelay: OPEN + 0.25 + i * STEP + 's' } },
      el('img', { class: 'ico', src: Sp.icon(k === 'coins' ? 'coin' : k), alt: '' }), el('b', null, '+' + U.fmt(o.reward[k])), el('small', null, k === 'coins' ? 'monedas' : D.RES[k].name))));
    const done = el('button', { class: 'btn gold cr-ok', style: { animationDelay: OPEN + 0.45 + keys.length * STEP + 's' } }, '¡Genial!');
    const conf = el('div', { class: 'cr-conf', 'aria-hidden': 'true' }, Array.from({ length: 22 }, (_, i) => el('i', { style: { left: (4 + ((i * 37) % 92)) + '%', animationDelay: OPEN + (i % 7) * 0.08 + 's', background: ['#ffd84a', '#e8b83a', '#fffbe0', '#6fbf5a', '#6aa8ff', '#d8503c'][i % 6] } })));
    const box = el('div', { class: 'cr-box tier' + (o.tier || 0) }, el('div', { class: 'cr-title' }, o.title), o.sub ? el('div', { class: 'cr-sub' }, o.sub) : null,
      el('div', { class: 'cr-stage' }, el('div', { class: 'cr-rays' }), el('div', { class: 'cr-glow' }), chest), items, done);
    const back = el('div', { class: 'cr-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title }, conf, box);
    let shut = false;
    const close = () => { if (shut) return; shut = true; back.classList.add('out'); setTimeout(() => back.remove(), 260); };
    done.addEventListener('click', close);
    back.addEventListener('pointerdown', e => { if (e.target === back && back.classList.contains('open')) close(); });
    back.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); close(); } });
    document.body.append(back);
    sfx('hammer');
    setTimeout(() => sfx('hammer'), 350); setTimeout(() => sfx('hammer'), 700);
    setTimeout(() => { if (shut) return; chest.src = Sp.icon('chestOpen'); back.classList.add('open'); sfx('level'); }, OPEN * 1000);
    keys.forEach((k, i) => setTimeout(() => { if (!shut) sfx('coin'); }, (OPEN + 0.25 + i * STEP) * 1000));
    setTimeout(() => { try { done.focus({ preventScroll: true }); } catch (e) { /* nada */ } }, (OPEN + 0.5 + keys.length * STEP) * 1000);
  };

  // Al entrar después de un reinicio (D.SAVE_V nuevo): una vez, porque la partida nueva se guarda con la versión nueva.
  UI.reinicio = function () {
    const N = D.NOVEDADES || { ver: '', items: [] };
    UI.modal('reinicio', 'Un mundo nuevo', body => {
      body.append(el('p', null, 'El mundo se reinició con la actualización ' + N.ver + '. Tu reino empieza de cero, igual que el de todos.'),
        N.items.length ? el('ul', { class: 'info' }, N.items.map(t => el('li', null, t))) : '',
        el('div', { class: 'row' }, UI.btn('¡A construir!', () => UI.closeModal(), { cls: 'gold' })));
    });
  };
  UI.offlineReport = function (rep) {
    if (!rep) return;
    UI.modal('offline', 'Mientras no estabas…', body => {
      body.append(el('p', null, 'Pasaron ' + U.fmtTime(rep.sec) + '. Tus aldeanos siguieron trabajando:'));
      const keys = Object.keys(rep.gained).filter(k => rep.gained[k] > 0);
      // Por qué no se ganó (o se ganó poco): antes culpaba siempre al jugador, aunque la causa fuera el almacén lleno.
      const full = ['food', 'wood', 'stone', 'gold', 'ore', 'marble', 'gems'].filter(r => G().cap(r) !== Infinity && (S().res[r] || 0) >= G().cap(r) - 1);
      const working = G().units.some(u => u.owner === 'p' && u.kind === 'v' && (u.task || u.inside));
      body.append(keys.length ? el('div', { class: 'reward big' }, keys.map(k => UI.amount(k, rep.gained[k])))
        : el('p', { class: 'muted' }, full.length ? 'No cupo nada más: el almacenamiento está lleno.' : working ? 'Tus aldeanos no lograron juntar nada: quizás se agotó lo que tenían cerca.' : 'Nadie estaba trabajando. ¡Asigna tareas antes de irte!'));
      if (full.length) body.append(el('p', { class: 'small warn-t' }, 'Lleno: ' + full.map(r => D.RES[r].name.toLowerCase()).join(', ') + '. Mejora el Granero, el Almacén o el Centro Urbano para guardar más mientras no estás.'));
      if (rep.depleted) body.append(el('p', { class: 'small muted' }, 'Tus aldeanos agotaron ' + rep.depleted + (rep.depleted === 1 ? ' árbol, veta o arbusto' : ' árboles, vetas o arbustos') + ' (vuelven a crecer con el tiempo).'));
      if (rep.explored > 0) body.append(el('p', { class: 'small' }, 'Tus exploradores revelaron ' + rep.explored + ' casillas del mapa.'));
      if (rep.finished && rep.finished.length) body.append(el('p', { class: 'small' }, 'Terminado: ' + rep.finished.join(', ') + '.'));
      if (rep.capped) body.append(el('p', { class: 'small muted' }, 'Las obras y estudios contaron todo el tiempo; los aldeanos, hasta 12 horas.'));
      if (rep.eraUp) body.append(el('p', { class: 'good' }, '¡Tu pueblo avanzó de era mientras dormías!'));
      if (rep.helps) body.append(el('p', { class: 'small good-t' }, 'Tu pedido' + (rep.helpsWhat ? ' (' + rep.helpsWhat + ')' : '') + ' recibió ' + rep.helps + (rep.helps === 1 ? ' ayuda' : ' ayudas') + ' del gremio.'));
      const traba = PK.Asesor.problemas()[0]; // lo primero que conviene arreglar al volver
      if (traba) body.append(el('div', { class: 'asesor-row' + (traba.prioridad >= 70 ? ' grave' : '') }, el('span', null, el('b', null, 'Ojo: '), traba.texto),
        el('span', { class: 'row' }, traba.acciones.slice(0, 2).map(a => UI.btn(a.label, () => { a.fn(); UI.refreshPanel(true); if (UI.modalKey() === 'offline') UI.rerender(); }, { small: true, cls: 'gold' })))));
      if (rep.consejo && rep.consejo.length) body.append(el('h3', null, 'Lo que hizo tu Consejo'), el('div', { class: 'log' }, rep.consejo.map(c => el('div', null, el('b', null, c.name + ': '), c.items.slice(0, 4).join(' ') + (c.items.length > 4 ? ' Y ' + (c.items.length - 4) + ' cosas más.' : '')))));
      if (rep.news && rep.news.length) body.append(el('h3', null, 'Novedades'), el('div', { class: 'log' }, rep.news.slice(-8).map(n => el('div', { class: n.kind }, n.text))));
      const sk = S().streak, Q = PK.Quests;
      if (sk.shielded === U.dayKey()) body.append(el('p', { class: 'small' }, 'Faltaste un día, pero tu escudo de racha la salvó: tus ' + sk.n + ' días siguen en pie.'));
      else if (Q.repairable()) body.append(el('p', { class: 'small warn-t' }, 'Tu racha de ' + sk.n + ' días se cortó. Puedes repararla hoy en el Libro (pestaña Diarias).'));
      const w = rep.welcome;
      if (w) {
        const open = () => { if (S().ret.welcome === w) { G().openWelcome(); UI.chestReveal({ title: w.name, sub: 'Por el tiempo que estuviste fuera', reward: w.reward, tier: w.tier }); } UI.rerender(); };
        body.append(w.opened
          ? el('div', { class: 'welcome-chest opened tier' + w.tier + (Date.now() - w.opened < 800 ? ' pop' : '') },el('img', { src: Sp.icon('chest') }), el('div', null, el('b', null, w.name + ' abierto'), el('div', { class: 'reward' }, Object.keys(w.reward).map(k => UI.amount(k, w.reward[k])))))
          : el('button', { class: 'welcome-chest closed', onclick: open }, el('img', { src: Sp.icon('chest') }),
            el('div', null, el('b', null, 'Cofre de bienvenida'), el('span', { class: 'small' }, 'Crece con el tiempo fuera (hasta 12 h) y a veces viene cargado. Tócalo para abrirlo.'))));
      }
      body.append(UI.btn('A trabajar', () => { if (w && S().ret.welcome === w) G().openWelcome(true); UI.closeModal(); }, { cls: 'gold' }));
    });
  };

  // ---------- Celular: botones táctiles y panel plegable ----------
  function initMobile(menu) {
    // Lo que en la computadora es solo teclado (. o I: aldeano ocioso · Supr: demoler). El CSS los muestra solo en pantallas táctiles.
    const tb = (icon, label, title, fn) => el('button', { class: 'mbtn touch-only', title, 'aria-label': title, onclick: fn }, el('img', { class: 'ico', src: Sp.icon(icon), alt: '' }), el('span', null, label));
    const idleB = tb('idle', 'Ocioso', 'Siguiente aldeano ocioso', () => PK.Input.selectNextIdle());
    const demoB = tb('tools', 'Demoler', 'Demoler el edificio seleccionado', () => PK.Input.demolishSelected());
    menu.prepend(idleB, demoB);
    // Si el menú se desliza y quedan botones abajo, se desvanece el borde inferior (CSS .more-below).
    const more = () => menu.classList.toggle('more-below', menu.scrollHeight - menu.scrollTop - menu.clientHeight > 6);
    menu.addEventListener('scroll', more, { passive: true });
    window.addEventListener('resize', more);
    setInterval(more, 1000);
    // Minimapa ocultable (solo en el celular): deja más mapa a la vista.
    const hud = document.getElementById('hud');
    const mmB = tb('map', 'Minimapa', 'Ocultar minimapa', () => {
      const off = hud.classList.toggle('mm-off');
      mmB.title = off ? 'Mostrar minimapa' : 'Ocultar minimapa';
      mmB.setAttribute('aria-label', mmB.title);
      mmB.setAttribute('aria-pressed', off ? 'false' : 'true');
    });
    mmB.setAttribute('aria-pressed', 'true');
    menu.append(mmB);
    setInterval(() => {
      const ok = !!(PK.Input.demolishTarget && PK.Input.demolishTarget());
      demoB.classList.toggle('off', !ok);
      demoB.setAttribute('aria-disabled', ok ? 'false' : 'true');
    }, 400);

    // Panel de selección plegable: en el celular tiene una cabecera con flecha (en la computadora no se ve).
    const body = panel, wrap = el('div', { id: 'panel' });
    body.removeAttribute('id');
    body.id = 'panel-body';
    body.className = 'p-body';
    const title = el('span', { class: 'p-title' }, 'Pro Kingdoms'), arrow = el('span', { class: 'p-arrow', 'aria-hidden': 'true' }, '▼');
    const head = el('button', { class: 'p-toggle', 'aria-controls': 'panel-body', 'aria-expanded': 'true', title: 'Ocultar panel' }, title, arrow);
    // ✕: suelta lo elegido (en el celular no hay Esc ni clic derecho). Solo se ve si hay algo elegido.
    const close = el('button', { class: 'p-close', title: 'Soltar selección', 'aria-label': 'Soltar selección', onclick: e => { e.stopPropagation(); G().sel = null; UI.refreshPanel(true); } }, '✕');
    body.replaceWith(wrap);
    wrap.append(el('div', { class: 'p-headrow' }, head, close), body);
    const syncClose = () => { close.style.display = G().sel ? '' : 'none'; };
    syncClose();
    setInterval(syncClose, 400);
    const setOpen = open => {
      wrap.classList.toggle('collapsed', !open);
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      head.title = open ? 'Ocultar panel' : 'Mostrar panel';
      arrow.textContent = open ? '▼' : '▲';
    };
    head.addEventListener('click', () => setOpen(wrap.classList.contains('collapsed')));
    let lastTitle = '';
    new MutationObserver(() => {
      const h = body.querySelector('h3'), t = h ? h.textContent : 'Pro Kingdoms';
      if (t === lastTitle) return;
      const first = !lastTitle;
      lastTitle = t; title.textContent = t;
      if (!first && G().sel && wrap.classList.contains('collapsed')) setOpen(true); // al elegir algo nuevo se vuelve a abrir
    }).observe(body, { childList: true });
  }

  // ---------- Descripción al pasar el mouse ----------
  UI.showTip = function (target, content) {
    tip.innerHTML = '';
    tip.append(content);
    tip.style.display = 'block';
    const r = target.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = U.clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8) + 'px';
    tip.style.top = Math.max(8, r.top - th - 8) + 'px';
  };
  UI.hideTip = function () { tip.style.display = 'none'; };
  let hoverKey = '';
  UI.hoverInfo = function (h, x, y) {
    if (!h) { if (hoverKey) { hoverKey = ''; UI.hideTip(); } return; }
    let text = '';
    if (h.k === 'node') { const z = W.zoneOf(h.o); text = D.NODES[h.o.kind].name + ' · ' + (h.o.dead ? 'agotado' : U.fmt(h.o.amount)) + (z ? ' · ' + z.name : ''); }
    else if (h.k === 'building') text = h.o.def.name + (h.o.def.noUp ? '' : ' · Nv ' + h.o.lvl) + (h.o.upg ? ' (mejorando)' : '') + (h.o.owner !== 'p' ? ' · ' + D.BOTS.find(b => b.id === h.o.owner).name : '');
    else if (h.k === 'poi') { const st = G().poiState(h.o); text = D.POI[h.o.kind].name + (st && st.d ? ' · ya aprovechado' : ''); }
    else if (h.k === 'troop') text = h.o.march ? 'Tus tropas marchan hacia ' + (h.o.march.back ? 'casa' : h.o.march.name) : 'Tus soldados · ' + UI.hint('clic', 'toca') + ' para abrir el Cuartel';
    else if (h.k === 'unit') text = h.o.owner === 'p' ? (h.o.kind === 'scout' ? 'Explorador · ' : 'Aldeano · ') + taskText(h.o) : 'Aldeano de ' + D.BOTS.find(b => b.id === h.o.owner).name;
    hoverKey = text;
    tip.textContent = text;
    tip.style.display = 'block';
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, x + 16) + 'px';
    tip.style.top = y + 18 + 'px';
  };
})();
