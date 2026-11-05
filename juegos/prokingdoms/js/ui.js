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
    if (UI.animoEl) bar.append(UI.animoEl());
    buildEl = el('b', null, '1/1');
    bar.append(el('button', { class: 'res builders', title: 'Maestros de Obras ocupados / total', onclick: () => UI.openWorks() }, el('img', { class: 'ico', src: Sp.icon('hammer') }), buildEl));
    eraEl = el('div', { class: 'era', title: 'Meta de la próxima era', role: 'button', tabindex: '0', onclick: () => UI.openEraGoal() });
    coinEl = el('b', null, '0');
    netEl = el('button', { class: 'net', onclick: () => UI.openRealms() });
    // «¿Qué me frena?» (A6, js/asesor.js): junto a la era, con cuántas cosas importantes hay
    asEl = el('span', { class: 'badge' });
    const asBtn = el('button', { class: 'res asesor', title: '¿Qué me frena?', 'aria-label': '¿Qué me frena?', onclick: () => PK.Asesor.open() }, '?', asEl);
    bar.append(eraEl, PK.Pase ? PK.Pase.barEl() : '', UI.estacionEl ? UI.estacionEl() : '', asBtn, netEl, el('button', { class: 'res coins', title: 'Monedas del reino: abre la tienda', onclick: () => UI.openTienda && UI.openTienda() }, el('img', { class: 'ico', src: Sp.icon('coin') }), coinEl));
    // en pantallas chicas la barra ocupa varias filas según la era: el minimapa y el menú se acomodan debajo
    // (incluye el margen del notch arriba: --top-h + 6 px es siempre el borde inferior de la barra)
    if (window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', Math.max(0, bar.offsetTop - 6) + bar.offsetHeight + 'px')).observe(bar);

    const menu = el('div', { id: 'menu' });
    const mbtn = (icon, label, fn, key, id) => {
      const b = el('button', { class: 'mbtn', title: label + (key ? ' (' + key + ')' : ''), 'aria-label': label, onclick: () => { b.classList.remove('nuevo'); fn(); } }, el('img', { class: 'ico', src: icon.startsWith('data:') ? icon : Sp.icon(icon), alt: '' }), el('span', null, label));
      menu.append(b);
      if (id) { b.dataset.mid = id; allIds[id] = b; if (MENU_VER[id]) menuIds[id] = b; }
      return b;
    };
    // U1 (Fase 6, pk-26): los botones son los de siempre (con su id para el menú progresivo) y después se agrupan
    // en cinco submenús (agrupar). Las teclas rápidas no pasan por aquí: siguen igual.
    const bb = mbtn('book', 'Misiones', () => PK.Quests.openBook('main'), 'B', 'book');
    bookDot = el('span', { class: 'badge' }); bb.append(bookDot);
    mbtn('chest', 'Diarias', () => PK.Quests.openBook('daily'), null, 'diarias');
    mbtn('crown', 'Desafíos', () => PK.Quests.openBook('desafios'), null, 'desafios');
    mbtn('gems', 'Álbum', () => PK.Quests.openBook('album'), null, 'album');
    mbtn(Sp.buildingIcon('house'), 'Construir', () => UI.openBuild(), 'C', 'build');
    mbtn('hammer', 'Obras', () => UI.openWorks(), null, 'works');
    mbtn('pop', 'Aldeanos', () => UI.openForeman(), null, 'foreman');
    mbtn('war', D.temaActivo === 'mar' ? 'Flota' : 'Cuartel', () => PK.Social.openWar('troops'), null, 'war');
    mbtn('crystal', 'Atacar', () => PK.Social.openWar('exp'), null, 'atacar');
    mbtn('wall', 'Defensa', () => PK.Social.openWar('defense'), null, 'defensa');
    mbtn('scroll', 'Batallas', () => PK.Social.openWar('log'), null, 'batallas');
    mbtn('hero', 'Héroes', () => PK.Heroes.open('heroes'), null, 'heroes');
    mbtn('coin', 'Taberna', () => PK.Heroes.open('taberna'), null, 'taberna');
    mbtn('tools', 'Equipo', () => PK.Heroes.open('inv'), null, 'equipo');
    mbtn('compass', 'Explorar', () => UI.openExplore(), null, 'explore');
    mbtn('flask', 'Investigar', () => UI.openResearch(), null, 'research');
    mbtn('market', 'Mercado', () => PK.Social.openMarket(), null, 'market');
    mbtn('guild', 'Gremio', () => PK.Social.openGuild(), null, 'guild');
    mbtn('scroll', 'Territorio', () => UI.openTerritory(), 'T', 'terr');
    mbtn('cart', 'Logística', () => UI.openLogistics(), null, 'logi');
    mbtn('book', 'Consejo', () => PK.Consejo.open(), null, 'consejo');
    mbtn('crown', 'Reinos', () => UI.openRealms(), null, 'realms');
    mbtn('ancla', 'Galeón', () => PK.Mar.abrir(), null, 'galeon'); // Fase 9
    mbtn('crown', 'Regata', () => PK.Regata && PK.Regata.abrir(), null, 'regata'); // pk-30, solo en el mar
    mbtn('gear', 'Opciones', () => UI.openSettings(), null, 'settings');
    agrupar(menu);

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
    UI.aplicarAcceso();
    window.addEventListener('pk:coins', () => { coinEl.textContent = U.fmt(PK.Platform.getCoins()); });
    UI.refreshPanel(true);
  };

  // ---------- U6 (Fase 6): accesibilidad ----------
  // Por equipo, no por partida (U.store): texto más grande (zoom de ventanas, panel, avisos y submenú), colores para
  // daltonismo (verde/rojo pasan a azul/naranja) y menos movimiento (sin animaciones CSS, sin sacudidas de cámara en
  // batalla ni copos y hojas). «Menos movimiento» arranca encendido si el sistema lo pide (prefers-reduced-motion).
  UI.acceso = function () {
    const mm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mov = U.store.get('pk_menosmov');
    return { texto: +U.store.get('pk_texto') || 0, dalto: U.store.get('pk_dalto') === '1', menosMov: mov === null || mov === undefined || mov === '' ? !!mm : mov === '1' };
  };
  UI.aplicarAcceso = function () {
    const a = UI.acceso(), h = document.documentElement;
    h.classList.toggle('texto-1', a.texto === 1);
    h.classList.toggle('texto-2', a.texto === 2);
    h.classList.toggle('daltonico', a.dalto);
    h.classList.toggle('menos-mov', a.menosMov);
    PK.menosMov = a.menosMov;
  };
  UI.setAcceso = function (k, v) {
    U.store.set({ texto: 'pk_texto', dalto: 'pk_dalto', menosMov: 'pk_menosmov' }[k], k === 'texto' ? String(v) : v ? '1' : '0');
    UI.aplicarAcceso();
  };

  // ---------- Menú progresivo ----------
  // Cada botón aparece cuando tiene sentido (playtest: 14 botones desde el minuto 1, varios vacíos o bloqueados
  // abrumaban). Una vez visto queda para siempre (flags.menu_<id>). Lo que aparece durante la partida brilla
  // hasta que lo tocas; al cargar, lo que ya correspondía se muestra sin anuncio (también en partidas viejas).
  // Cuartel siempre está: sus murallas (Defensa) sirven desde la Era I y una misión lo nombra.
  const menuIds = {}, allIds = {};
  // En el archipiélago (pk-28) no hay investigación, gremio, territorio, mercado, ejército ni héroes (todavía)
  const NO_MAR = ['explore', 'research', 'market', 'guild', 'terr', 'logi', 'realms', 'taberna', 'consejo', 'defensa', 'desafios', 'album']; // los héroes viajan (pk-30)
  const NO_TIERRA = ['regata']; // lo que solo existe en el archipiélago // la armada (pk-29) sí está en el mar
  const MENU_VER = {
    explore: (g, st) => g.countAll('scout') > 0 || st.era >= 2,
    research: (g, st) => st.era >= 2 || g.countAll('library') > 0,
    market: (g, st) => st.era >= 2 || g.countAll('market') > 0,
    guild: (g, st) => g.countAll('guild') > 0 || (st.guild && st.guild.joined) || (PK.Net.online && st.era >= 2),
    terr: (g, st) => st.era >= 2 || !!st.flags.verTerr,
    logi: (g, st) => g.countAll('cartwright') > 0 || g.buildings.some(b => b.owner === 'p' && b.def.recipe) || !!(st.logi && st.logi.roads.length),
    realms: (g, st) => !!PK.Net.online || D.BOTS.some(b => st.flags['seen_' + b.slot]),
    heroes: (g, st) => g.countAll('tavern') > 0 || !!(st.heroes && st.heroes.lista.length),
    galeon: () => !!(PK.Mar && PK.Mar.visible()),
    regata: (g, st) => D.temaActivo === 'mar' && st.era >= 2,
    // U1: lo que antes eran pestañas dentro de una ventana aparece cuando aparece su ventana
    diarias: (g, st) => st.era >= 2 || !!st.flags.menu_explore,
    desafios: (g, st) => st.era >= 2,
    album: (g, st) => st.era >= 2,
    atacar: g => g.countAll('barracks') > 0,
    defensa: () => true,
    batallas: g => g.countAll('barracks') > 0,
    taberna: g => g.countAll('tavern') > 0,
    equipo: (g, st) => !!(st.heroes && st.heroes.lista.length),
    consejo: g => g.countAll('consejo') > 0,
  };
  // ---------- U1 (Fase 6): menú agrupado ----------
  // Cinco grupos con submenú, más Opciones. Un grupo se ve si se ve alguno de sus botones, y brilla si alguno es nuevo.
  const GRUPOS = [
    { id: 'reino', label: 'Reino', icon: 'hammer', items: ['build', 'works', 'foreman', 'research', 'logi', 'terr', 'consejo', 'galeon'] },
    { id: 'heroes', label: 'Héroes', icon: 'hero', items: ['heroes', 'taberna', 'equipo'] },
    { id: 'guerra', label: 'Guerra', labelMar: 'Armada', icon: 'war', items: ['war', 'atacar', 'defensa', 'batallas'] },
    { id: 'mundo', label: 'Mundo', icon: 'compass', items: ['explore', 'market', 'guild', 'realms', 'regata'] },
    { id: 'libro', label: 'Libro', icon: 'book', items: ['book', 'diarias', 'desafios', 'album'] },
  ];
  const grupos = [];
  let subPop = null, subAbierto = null;
  function agrupar(menu) {
    const todos = {};
    for (const b of [...menu.children]) { if (b.dataset.mid) todos[b.dataset.mid] = b; b.remove(); }
    subPop = el('div', { id: 'submenu', role: 'menu' });
    subPop.addEventListener('click', e => { if (e.target.closest('.mbtn')) setTimeout(cerrarGrupo, 0); });
    for (const g of GRUPOS) {
      const box = el('div', { class: 'sub-items' });
      for (const id of g.items) if (todos[id]) box.append(todos[id]);
      const dot = el('span', { class: 'badge g-dot' });
      if (g.labelMar && D.temaActivo === 'mar') g.label = g.labelMar;
      const gb = el('button', { class: 'mbtn grupo', 'data-g': g.id, title: g.label, 'aria-label': g.label, 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: e => { e.stopPropagation(); abrirGrupo(g.id); } },
        el('img', { class: 'ico', src: Sp.icon(g.icon), alt: '' }), el('span', null, g.label), dot);
      menu.append(gb);
      grupos.push({ g, gb, box, dot });
    }
    menu.append(todos.settings);
    document.getElementById('hud').append(subPop);
    window.addEventListener('pointerdown', e => { if (subAbierto && !subPop.contains(e.target) && !e.target.closest('.mbtn.grupo')) cerrarGrupo(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && subAbierto) cerrarGrupo(); });
    window.addEventListener('resize', () => { if (subAbierto) ubicarSub(); });
  }
  function ubicarSub() {
    const x = grupos.find(o => o.g.id === subAbierto);
    if (!x) return;
    const r = x.gb.getBoundingClientRect(), m = x.gb.parentNode.getBoundingClientRect(), barra = m.width > m.height * 2;
    subPop.style.left = subPop.style.right = subPop.style.top = subPop.style.bottom = '';
    if (barra) { // celular vertical: barra de abajo, el submenú sube desde el botón
      subPop.style.bottom = window.innerHeight - r.top + 6 + 'px';
      subPop.style.left = Math.max(6, Math.min(window.innerWidth - subPop.offsetWidth - 6, r.left + r.width / 2 - subPop.offsetWidth / 2)) + 'px';
    } else {
      subPop.style.right = window.innerWidth - r.left + 6 + 'px';
      subPop.style.top = Math.max(6, Math.min(window.innerHeight - subPop.offsetHeight - 6, r.top)) + 'px';
    }
  }
  function abrirGrupo(id) {
    if (subAbierto === id) { cerrarGrupo(); return; }
    cerrarGrupo();
    const x = grupos.find(o => o.g.id === id);
    subAbierto = id;
    subPop.append(el('div', { class: 'sub-tit' }, x.g.label), x.box);
    subPop.classList.add('on');
    x.gb.classList.add('on'); x.gb.setAttribute('aria-expanded', 'true');
    ubicarSub();
    const first = x.box.querySelector('.mbtn:not([style*="none"])');
    if (first && !UI.isTouch()) first.focus({ preventScroll: true });
  }
  function cerrarGrupo() {
    if (!subAbierto) return;
    const x = grupos.find(o => o.g.id === subAbierto);
    subAbierto = null;
    subPop.classList.remove('on');
    subPop.innerHTML = '';
    if (x) { x.gb.classList.remove('on'); x.gb.setAttribute('aria-expanded', 'false'); }
  }
  UI.cerrarGrupo = cerrarGrupo;
  function updateGrupos() {
    for (const x of grupos) {
      const vis = [...x.box.children].filter(b => b.style.display !== 'none');
      x.gb.style.display = vis.length ? '' : 'none';
      x.gb.classList.toggle('nuevo', vis.some(b => b.classList.contains('nuevo')));
      const badge = vis.some(b => { const d = b.querySelector('.badge'); return d && d.textContent && d.style.display !== 'none'; });
      x.dot.textContent = badge ? '!' : '';
    }
  }
  let menuFirst = true;
  function updateMenu() {
    const g = G(), st = S(), nuevos = [];
    const mar = g.enMar && g.enMar();
    for (const id in menuIds) {
      if ((mar && NO_MAR.includes(id)) || (!mar && NO_TIERRA.includes(id))) { menuIds[id].style.display = 'none'; continue; }
      const b = menuIds[id], ok = !!st.flags['menu_' + id] || MENU_VER[id](g, st);
      if (ok && !st.flags['menu_' + id]) {
        st.flags['menu_' + id] = 1;
        if (!menuFirst) { b.classList.add('nuevo'); nuevos.push(b.getAttribute('aria-label')); }
      }
      b.style.display = ok ? '' : 'none';
    }
    menuFirst = false;
    if (mar) for (const id of NO_MAR) if (allIds[id]) allIds[id].style.display = 'none';
    if (!mar) for (const id of NO_TIERRA) if (allIds[id]) allIds[id].style.display = 'none';
    updateGrupos();
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
        resEls[r].box.style.display = !D.RES[r].special && (!D.resDelMundo || D.resDelMundo(r) || st.res[r] >= 1) && (D.RES_START.includes(r) || st.flags['seenRes_' + r]) ? '' : 'none';
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
      if (UI.revisarCartas) UI.revisarCartas();
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
    const lab = PK.Life.eventLabel(), ops = PK.Life.eventOptions ? PK.Life.eventOptions() : [], key = ev.id + '|' + evMin + '|' + lab + '|' + ev.desc + '|' + ops.map(o => o.label).join(',');
    if (key !== evKey) {
      evKey = key;
      evEl.innerHTML = '';
      evEl.classList.toggle('min', evMin);
      const time = el('span', { class: 'ev-t' }), fill = el('div');
      // eventos con opciones (H8): un botón por opción; la que se aplica sola al acabarse el tiempo lleva un «·»
      const act = ops.length ? el('span', { class: 'ev-ops' }, ops.map(o => UI.btn(o.label, () => { PK.Life.eventChoose(o.i); evKey = ''; }, { small: true, cls: (o.i === 0 ? 'gold' : '') + (o.defecto ? ' def' : ''), title: o.defecto ? 'Si no eliges, pasa esto' : '' })))
        : lab ? UI.btn(lab, () => { PK.Life.eventAction(); evKey = ''; }, { small: true, cls: 'gold' }) : ''; // append(null) escribe «null»
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
      out.push({ k: 'r' + st.research.id, icon: Sp.icon('flask'), name: g.researchName(st.research), left: (st.research.total - st.research.t) / g.researchMult(), pct: st.research.t / st.research.total, go: () => UI.openResearch() });
    }
    for (const r of (st.exp && st.exp.runs) || []) {
      if (r.phase === 'battle') { out.unshift({ k: 'b' + r.id, raid: true, icon: Sp.icon('war'), name: '⚔ Batalla en ' + r.name, left: null, pct: 1, go: () => PK.Batalla.abrir(r.id) }); continue; }
      // incursión entre salas (incursion.js): sin reloj de viaje
      if (r.inc && (r.phase === 'sala' || r.phase === 'fin' || (r.phase === 'go' && r.inc.llego))) { out.unshift({ k: 's' + r.id + r.phase, raid: r.phase === 'sala', icon: Sp.icon('scale'), name: '☠ ' + (r.phase === 'sala' ? 'Elige sala: piso ' : 'Piso ') + r.inc.piso + ' de ' + r.inc.fin, left: r.phase === 'sala' ? Math.max(0, (r.inc.hasta - now) / 1000) : null, pct: (r.inc.piso - r.inc.desde) / Math.max(1, r.inc.fin - r.inc.desde + 1), go: () => PK.Inc.open(r.id) }); continue; }
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
    const sq = PK.Saqueos && PK.Saqueos.fila(); // C6: partida de saqueo de un reino del servidor
    if (sq) out.unshift(Object.assign(sq, { icon: Sp.icon('war') }));
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
  // ---------- U2 y U3 (Fase 6): «¿Qué hago ahora?» y los primeros pasos ----------
  // Sin nada elegido, el panel dice la próxima misión de la Crónica (con su barra) y lo más importante del Asesor.
  // Mientras no reclamaste m4 es el tutorial guiado: «Muéstrame» lleva al lugar de cada paso, y se puede saltar
  // (flags.tuto = 'saltado'; al terminarlo, 'fin').
  const GUIA = {
    m1: { txt: 'Elige el Centro Urbano y toca «Aldeano».', fn: () => elegirTc() },
    m2: { txt: 'Abre Reino → Construir y elige Casa.', fn: () => { UI.openBuild(); }, grupo: 'reino' },
    m3: { txt: 'Elige el Centro Urbano y toca «Mejorar».', fn: () => elegirTc() },
    m4: { txt: 'Construye un Puesto de Exploradores y entrena un explorador en él.', fn: () => {
      const b = G().buildings.find(o => o.owner === 'p' && o.type === 'scout' && o.done);
      if (b) { G().sel = { type: 'building', id: b.id }; PK.Render.centerOn(b.cx, b.cy); UI.refreshPanel(true); } else UI.openBuild();
    }, grupo: 'reino' },
  };
  const TUTO = ['m1', 'm2', 'm3', 'm4'];
  function elegirTc() {
    const b = G().buildings.find(o => o.owner === 'p' && o.type === 'tc');
    if (!b) return;
    G().sel = { type: 'building', id: b.id };
    PK.Render.centerOn(b.cx, b.cy);
    UI.refreshPanel(true);
  }
  let tutoVisto = false, asCache = null, asT = 0;
  UI.tutoActivo = () => { const st = S(); return !st.flags.tuto && st.quests.m4 !== 'claimed' && !(G().enMar && G().enMar()); };
  function asesorTop() {
    const now = performance.now();
    if (!asCache || now - asT > 2000) { asCache = PK.Asesor.problemas(); asT = now; }
    return asCache;
  }
  function queHago() {
    const st = S(), Q = PK.Quests, enMar = G().enMar && G().enMar();
    const tuto = UI.tutoActivo();
    if (tuto) tutoVisto = true;
    else if (!st.flags.tuto && st.quests.m4 === 'claimed') { st.flags.tuto = 'fin'; if (tutoVisto) UI.toast('¡Terminaste los primeros pasos! Desde ahora este panel te dice la próxima misión y qué te frena.', 'epic'); }
    for (const x of grupos) x.gb.classList.toggle('guia', false);
    const box = el('div', { class: 'p-help que-hago' }, el('h3', null, '¿Qué hago ahora?'));
    const q = Q.siguiente(); // en el mar, la Crónica del Mar (pk-28)
    if (tuto && q) box.append(el('p', { class: 'small qh-paso' }, 'Primeros pasos · ' + (TUTO.indexOf(q.id) + 1) + ' de ' + TUTO.length));
    if (q) {
      const [a, b] = Q.progress(q.req), listo = Q.status(q) === 'ready', guia = GUIA[q.id];
      if (tuto && guia && guia.grupo && !listo) { const x = grupos.find(o => o.g.id === guia.grupo); if (x) x.gb.classList.add('guia'); }
      box.append(el('div', { class: 'qh-mision' + (listo ? ' lista' : '') },
        el('div', { class: 'qh-tit' }, el('img', { class: 'ico', src: Sp.icon('book'), alt: '' }), el('b', null, q.title), listo ? el('em', null, '¡cumplida!') : ''),
        el('p', { class: 'small' }, tuto && guia ? guia.txt : q.desc),
        listo ? '' : el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: Math.min(100, (a / Math.max(1, b)) * 100) + '%' } }), el('span', null, U.fmt(Math.min(a, b)) + ' / ' + U.fmt(b))),
        el('div', { class: 'row' },
          listo ? UI.btn('Reclamar', () => { Q.claim(q.id); UI.refreshPanel(true); }, { small: true, cls: 'gold' }) : guia && tuto ? UI.btn('Muéstrame', guia.fn, { small: true, cls: 'gold' }) : '',
          UI.btn('Ver en el libro', () => Q.openBook('main', q.id), { small: true }))));
    } else if (enMar) box.append(el('p', { class: 'small' }, 'Terminaste la Crónica del Mar. La armada y la Regata llegan en las próximas entregas.'));
    // lo que dice el Asesor (sin repetir «reclamar» cuando la misión ya muestra su botón)
    const ps = tuto ? [] : asesorTop().filter(p => p.prioridad >= 30 && !(q && p.id === 'reclamar' && Q.status(q) === 'ready')).slice(0, 2);
    for (const p of ps) box.append(el('div', { class: 'asesor-row' + (p.prioridad >= 70 ? ' grave' : '') }, el('span', { class: 'small' }, p.texto),
      el('span', { class: 'row' }, p.acciones.map(ac => UI.btn(ac.label, () => { ac.fn(); asCache = null; UI.refreshPanel(true); }, { small: true })))));
    if (!q && !ps.length && !enMar) box.append(el('p', { class: 'small muted' }, 'Nada te frena ahora: tu reino marcha bien.'));
    if (tuto) box.append(el('p', { class: 'small muted' }, UI.hint('Clic o arrastra para elegir aldeanos; clic derecho sobre un árbol, una mina o un taller para mandarlos.',
      'Toca un aldeano para elegirlo (mantén pulsado y arrastra para varios) y después toca un árbol, una mina o un taller.')));
    box.append(el('div', { class: 'row' },
      tuto ? UI.btn('Saltar tutorial', () => { st.flags.tuto = 'saltado'; UI.refreshPanel(true); UI.toast('Listo. Las misiones siguen en el Libro, y este panel te dice la próxima.', 'info'); }, { small: true })
        : UI.btn('Ocultar ayuda', () => { st.flags.helpOff = true; UI.refreshPanel(true); UI.toast('Listo. La ayuda vuelve desde Opciones.', 'info'); }, { small: true, title: 'El panel solo aparecerá al elegir algo' })));
    panel.append(box);
  }
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
    // U4: en el celular, pasado el tutorial, el panel sin nada elegido queda plegado (su cabecera dice «¿Qué hago ahora?»)
    if (key === 'none' && key !== lastPanelKey && UI.plegarPanel && !UI.tutoActivo()) UI.plegarPanel();
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
      queHago();
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
    // Fase 9 (pk-28): las ventanas del archipiélago
    if (b.type === 'embarcadero' && PK.Arch) act.append(el('div', { class: 'row' }, UI.btn('Fundar colonias', () => PK.Arch.abrirEmbarcadero(), { cls: 'gold' }), el('span', { class: 'small muted' }, 'Colonias: ' + PK.Arch.coloniasHechas() + '/' + PK.Arch.maxColonias())));
    if (b.type === 'comercio' && PK.Arch) act.append(el('div', { class: 'row' }, UI.btn('Comerciar', () => PK.Arch.abrirComercio(), { cls: 'gold' })));
    if (b.type === 'tavern' && PK.Heroes) act.append(el('div', { class: 'row' }, UI.btn('Candidatos del día', () => PK.Heroes.open('taberna'), { cls: 'gold' }), el('span', { class: 'small muted' }, 'Héroes: ' + PK.Heroes.lista().length + '/' + PK.Heroes.max())));
    if (PK.Heroes && b.done) { const gh = PK.Heroes.gobernanteDe(b); if (gh) act.append(el('p', { class: 'small' }, '★ Lo gobierna ', el('b', { translate: 'no' }, gh.nombre), ': ' + PK.Heroes.CLASES[gh.clase].pasTxt.split(': ').pop() + (gh.estado === 'libre' ? '.' : ' (ahora no: ' + (gh.estado === 'herido' ? 'herido' : 'de expedición') + ').'))); }
    // bonos por cercanía (V5): qué vecino le suma
    if (b.done && b.owner === 'p' && G().cercaDe) for (const c of G().cercaDe(b)) act.append(el('p', { class: 'small cerca-ok' }, '✚ Junto a ' + c.o.def.name + ': ' + c.c.txt + '.'));
    if (b.type === 'consejo' && PK.Consejo) act.append(el('div', { class: 'row' }, UI.btn('Abrir el Consejo', () => PK.Consejo.open(), { cls: 'gold' }), el('span', { class: 'small muted' }, PK.Consejo.resumen())));
    if (b.type === 'tc') {
      const st = S();
      act.append(el('div', { class: 'row' },
        UI.btn(el('span', null, 'Aldeano ', UI.costEl(D.VILLAGER.cost)), e => { G().train(b, e.shiftKey ? 5 : 1); UI.refreshPanel(true); }, { title: 'Mayús+clic: 5' }),
        UI.btn('+5', () => { G().train(b, 5); UI.refreshPanel(true); }, { small: true }),
        b.queue.length ? UI.btn('Quitar de la cola', () => { G().cancelTrain(b); UI.refreshPanel(true); }, { small: true }) : null,
        el('label', { class: 'chk small' }, el('input', { type: 'checkbox', checked: st.auto.train, onchange: e => { st.auto.train = e.target.checked; } }), ' Entrenar sin parar')));
      // cartas de era y título (Fase 3)
      if (PK.Vida && st.cartas) act.append(el('div', { class: 'row wrap' }, PK.Vida.titulo() ? el('span', { class: 'small' }, '★ ' + PK.Vida.titulo()) : '',
        UI.btn('Cartas (' + st.cartas.tomadas.length + ')' + (PK.Vida.pendiente() ? ' ¡nueva!' : ''), () => UI.openCartas(), { small: true, cls: PK.Vida.pendiente() ? 'gold' : '' }), UI.btn('Ánimo ' + PK.Vida.animo(), () => UI.openAnimo(), { small: true })));
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
    } else if (b.type === 'farm' || b.type === 'muelle') {
      const f = b.farmer !== null && G().uById.get(b.farmer), pes = b.type === 'muelle';
      act.append(el('p', null, f ? (pes ? 'Pescador trabajando.' : 'Granjero trabajando.') : UI.hint((pes ? 'Sin pescador.' : 'Sin granjero.') + ' Selecciona un aldeano y haz clic derecho aquí.', (pes ? 'Sin pescador.' : 'Sin granjero.') + ' Elige un aldeano y luego toca ' + (pes ? 'este muelle.' : 'esta granja.'))));
      if (pes) act.append(el('p', { class: 'small muted' }, 'Agua alrededor: ' + Math.round(G().aguaMuelle(b) * 100) + '% del rinde (más lago cerca, más pesca). Unos ' + (G().farmRate('p', b) * 60).toFixed(1) + ' de comida por minuto.'));
    } else if (b.def.deco) act.append(el('p', { class: 'small' }, '+' + b.def.deco.animo + ' de ánimo a las casas a ' + b.def.deco.r + ' casillas o menos.' + (b.def.deco.fiesta ? ' +' + b.def.deco.fiesta + ' más durante una fiesta.' : '')), UI.btn('Ver ánimo', () => UI.openAnimo && UI.openAnimo(), { small: true }));
    else if (b.type === 'wonder' && b.done && UI.maravillaEl) act.append(UI.maravillaEl(b));
    else if (b.def.marav && b.done && UI.maravillaInfo) act.append(UI.maravillaInfo(b));
    else if (b.type === 'library') act.append(UI.btn('Abrir investigación', () => UI.openResearch()));
    else if (b.type === 'market') act.append(UI.btn('Abrir mercado', () => PK.Social.openMarket()));
    else if (b.type === 'guild') act.append(UI.btn('Abrir gremio', () => PK.Social.openGuild()));
    else if (b.type === 'barracks') UI.barracksQuick(act);
    else if (b.type === 'tower') act.append(el('p', { class: 'small' }, 'Dispara a los lobos cercanos y suma a la defensa del reino (' + U.fmt(PK.Social.defense()) + ').'), PK.Asedios ? PK.Asedios.panelTorre(b) : '', UI.btn('Cuartel', () => PK.Social.openWar('troops')), UI.btn('Murallas y trampas', () => UI.openBarracks('defense'), { small: true }));
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
      info.append(el('p', { class: 'small' }, 'Enemigos: ' + UI.enemyText(d.enemy) + '. Conviene llevar ' + (UI.bestVs(d.enemy) || 'de todo') + '.'),
        el('p', { class: 'small muted' }, 'Pisos limpiados: ' + site.best + ' de ' + d.floors + (rest > 0 ? ' · se repone en ' + U.fmtTime(rest / 1000) : '') + '. Da ' + D.RES[d.loot].name.toLowerCase() + '.'),
        S().era < d.era ? el('p', { class: 'small warn-t' }, 'Hace falta la Era ' + U.roman(d.era) + '.') :
          UI.btn('Preparar expedición al piso ' + Math.min(d.floors, site.best + 1), () => UI.openBarracks('exp', { poi: p.id, floor: Math.min(d.floors, site.best + 1) }), { small: true, cls: 'gold' }));
    } else if (p.kind === 'legend' && PK.Leyendas) PK.Leyendas.panel(p, info);
    else info.append(el('p', { class: 'small muted' }, st.d ? 'Ya lo aprovechaste.' : ''));
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

  // ---------- Celular: botones táctiles y panel plegable ----------
  function initMobile(menu) {
    // Lo que en la computadora es solo teclado (. o I: aldeano ocioso · Supr: demoler). El CSS los muestra solo en pantallas táctiles.
    const tb = (icon, label, title, fn) => el('button', { class: 'mbtn touch-only', title, 'aria-label': title, onclick: fn }, el('img', { class: 'ico', src: Sp.icon(icon), alt: '' }), el('span', null, label));
    // U4 (Fase 6): van en su propia columna (#acciones), fuera del menú agrupado: en el celular vertical el menú
    // es la barra de abajo y no caben. «Ocioso» es grande y dice cuántos hay.
    const idleB = tb('idle', 'Ocioso', 'Siguiente aldeano ocioso', () => PK.Input.selectNextIdle());
    idleB.classList.add('ocioso');
    const idleN = el('span', { class: 'badge' }); idleB.append(idleN);
    const demoB = tb('tools', 'Demoler', 'Demoler el edificio seleccionado', () => PK.Input.demolishSelected());
    const acc = el('div', { id: 'acciones' }, idleB, demoB);
    menu.after(acc);
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
    acc.append(mmB);
    setInterval(() => {
      const ok = !!(PK.Input.demolishTarget && PK.Input.demolishTarget());
      demoB.classList.toggle('off', !ok);
      demoB.setAttribute('aria-disabled', ok ? 'false' : 'true');
      const n = G().units.filter(u => u.owner === 'p' && !u.task && !u.inside && u.kind === 'v').length;
      idleN.textContent = n || ''; idleN.style.display = n ? '' : 'none';
      idleB.classList.toggle('off', !n);
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
    if (window.matchMedia('(max-width: 900px)').matches) UI.plegarPanel = () => setOpen(false);
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
    else if (h.k === 'poi') { const st = G().poiState(h.o); text = (h.o.kind === 'legend' ? D.LEYENDAS[h.o.ley].name + (st && st.d ? ' · investigado' : ' · lugar legendario') : D.POI[h.o.kind].name + (st && st.d ? ' · ya aprovechado' : '')); }
    else if (h.k === 'cap') { const c = D.CAPITULOS[h.o.n - 1]; text = c.lugar.name + ' · Capítulo ' + U.roman(h.o.n) + ' de la Crónica'; }
    else if (h.k === 'troop') text = h.o.march ? 'Tus tropas marchan hacia ' + (h.o.march.back ? 'casa' : h.o.march.name) : 'Tus soldados · ' + UI.hint('clic', 'toca') + ' para abrir el Cuartel';
    else if (h.k === 'unit') text = h.o.owner === 'p' ? (h.o.kind === 'scout' ? 'Explorador · ' : 'Aldeano · ') + taskText(h.o) : 'Aldeano de ' + D.BOTS.find(b => b.id === h.o.owner).name;
    hoverKey = text;
    tip.textContent = text;
    tip.style.display = 'block';
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, x + 16) + 'px';
    tip.style.top = y + 18 + 'px';
  };
})();
