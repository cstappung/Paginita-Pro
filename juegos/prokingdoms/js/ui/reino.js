// Territorio, Logística, Investigación, decretos y Obras.
// Salió de js/ui.js al partirlo por ventanas (T5 del plan): los mismos atajos que allá. Va después de ui.js.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites, UI = PK.UI;
  const el = U.el;
  const G = () => PK.Game;
  const S = () => PK.Game.state;

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
        el('li', null, 'Conquistar una parcela de otro reino es caro a propósito: la campaña se paga aunque pierdas. Si ganas traes botín y pierdes del 12% al 30% de las tropas (menos cuanto más fuerte vayas); si pierdes, del 70% al 80%.'),
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
        UI.btn('Quitar caminos', () => PK.Despeje.empezar('quitar'), { title: 'Marca una zona y se quitan sus caminos (y murallas); vuelve la mitad del material' }),
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
            G().reservaDe(b) || b.sinReserva ? UI.btn(b.sinReserva ? 'Respetar reserva' : 'Producir igual', () => { G().setSinReserva(b, !b.sinReserva); UI.rerender(); }, { small: true, cls: b.sinReserva ? '' : 'gold' }) : '',
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

  // Dos pestañas: el Árbol del reino (V1 de la Fase 3, js/ui/vida.js) y los Fundamentos (las 15 técnicas por niveles).
  let resTab = 'arbol';
  UI.openResearch = function (tab) {
    if (tab) resTab = tab;
    UI.modal('research', 'Investigación', body => {
      const st = S();
      if (!G().countB('library')) { body.append(el('p', { class: 'muted' }, 'Construye una Biblioteca (Era II) para investigar. Las investigaciones siguen avanzando aunque cierres el juego.')); return; }
      if (UI.arbolEl) {
        const tabs = el('div', { class: 'book-tabs bar-tabs' });
        for (const [id, name, icon] of [['arbol', 'Árbol del reino', 'flask'], ['fund', 'Fundamentos', 'book']])
          tabs.append(el('button', { class: 'book-tab' + (resTab === id ? ' on' : ''), onclick: () => { resTab = id; UI.rerender(true); } }, el('img', { class: 'ico', src: PK.Sprites.icon(icon), alt: '' }), name));
        body.append(tabs);
      }
      if (st.research) {
        body.append(el('div', { class: 'era-box' }, el('b', null, 'Investigando: ' + G().researchName(st.research)),
          el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: (st.research.t / st.research.total) * 100 + '%' } }), el('span', null, U.fmtTime((st.research.total - st.research.t) / G().researchMult())))));
      }
      if (PK.Consejo && PK.Consejo.tiene('mayordomo')) body.append(PK.Consejo.colaEl());
      if (UI.arbolEl && resTab === 'arbol') { body.append(UI.arbolEl()); return; }
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
      // Qué le falta a cada una y, con Mercado, comprarlo de un toque (reporte de un jugador, pk-40: las obras se
      // quedaban en la cola sin materiales y no se veía por qué).
      const mk = g.countB('market') && PK.Social, pb = q.find(o => o.done && !o.upg), primera = pb ? pb.id : -1;
      q.forEach((b, i) => {
        const falta = g.colaFalta(b), fk = Object.keys(falta), compra = mk ? fk.filter(r => r !== 'gold' && PK.Social.tradePool().includes(r)) : [];
        const oro = compra.reduce((s, r) => s + PK.Social.buyPrice(r, falta[r]), 0), todo = compra.length === fk.length;
        body.append(el('div', { class: 'work-row' }, el('span', { class: 'lvl' }, '#' + (i + 1)), el('img', { src: Sp.buildingIcon(b.type, 'p', b.lvl) }), el('b', null, b.def.name + ' → ' + (b.lvl + 1)),
          el('span', { class: 'wcost' }, UI.costEl(g.upCost(b))),
          fk.length && compra.length ? UI.btn(el('span', null, 'Comprar ', UI.amount('gold', oro)), () => {
            for (const r of compra) { const n = g.colaFalta(b)[r]; if (n > 0 && PK.Social.buy(r, n) === false) break; }
            UI.rerender();
          }, { small: true, disabled: (st.res.gold || 0) < oro + (falta.gold || 0), title: todo ? 'Compra en el Mercado lo que le falta a esta mejora' : 'Compra lo que se vende en el Mercado; lo demás hay que juntarlo' }) : null,
          UI.btn('Quitar', () => { PK.Auto.dequeue(b); UI.rerender(); }, { small: true })));
        if (fk.length) body.append(el('p', { class: 'small muted q-falta' }, 'Falta: ' + fk.map(r => U.fmt(falta[r]) + ' de ' + D.RES[r].name.toLowerCase()).join(', ') + '.' + (b.id === primera ? ' Los talleres y el Capataz no gastan lo que le falta a esta obra.' : '')));
      });
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
})();
