// Cuartel: tropas, ataques, encargos, defensa, crónica e informes de batalla.
// Salió de js/ui.js al partirlo por ventanas (T5 del plan): los mismos atajos que allá. Va después de ui.js.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites, UI = PK.UI;
  const el = U.el;
  const G = () => PK.Game;
  const S = () => PK.Game.state;

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
    const HH = PK.Heroes;
    if (plan.heroe === undefined) { const m = HH && HH.mejorPara(pv.enemy); plan.heroe = m ? m.id : null; }
    if (plan.heroe && !(HH.de(plan.heroe) && HH.de(plan.heroe).estado === 'libre')) plan.heroe = null;
    const est = el('div', { class: 'plan-est' }), go = el('span');
    const why = PK.Exp.canSend(plan.target);
    const refresh = () => {
      const p = PK.Exp.powerVs(plan.units, pv.enemy, plan.heroe), ch = PK.Exp.chance(p / Math.max(1, pv.power)), heal = PK.Exp.heal(plan.units), n = sumUnits(plan.units);
      est.innerHTML = '';
      est.append(el('div', null, el('b', null, 'Tu fuerza: '), U.fmt(p) + ' contra ' + U.fmt(pv.power) + ' (' + n + ' soldado' + (n === 1 ? '' : 's') + ')'),
        el('div', { class: 'bar' }, el('div', { class: 'fill ' + (ch >= 0.75 ? 'green' : ch >= 0.45 ? 'gold' : 'red'), style: { width: ch * 100 + '%' } }), el('span', null, 'Probabilidad de victoria: ' + Math.round(ch * 100) + '%')),
        el('div', { class: 'small muted' }, heal ? 'Los clérigos reducen las bajas un ' + Math.round(heal * 100) + '%.' : 'Sin clérigos: las bajas serán completas.'));
      go.innerHTML = '';
      go.append(UI.btn('¡En marcha! (' + n + ')', () => { if (PK.Exp.send(plan.target, Object.assign({}, plan.units), plan.heroe)) { plan = null; UI.closeModal(); } }, { cls: 'gold', disabled: !!why || !n }));
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
      kinds.length ? heroePick(pv) : null,
      kinds.length ? est : null,
      el('div', { class: 'row' }, el('b', null, 'Botín si ganas: '), UI.costEl(pv.loot, 1, true)),
      why ? el('p', { class: 'small warn-t' }, why) : null,
      kinds.length ? el('div', { class: 'row' }, UI.btn('Compañía recomendada', () => { plan.units = PK.Exp.recommend(pv.enemy, pv.power); UI.rerender(); }, { small: true }),
        UI.btn('Todos', () => { plan.units = Object.assign({}, w.army); UI.rerender(); }, { small: true }), go) : null));
    refresh();
  }

  // Qué héroe va con la compañía (H1): los libres, con cuánto suben la fuerza contra este enemigo.
  function heroePick(pv) {
    const HH = PK.Heroes, todos = HH ? HH.lista() : [];
    if (!todos.length) return '';
    const libres = HH.libres();
    return el('div', { class: 'pl-heroe' }, el('b', null, 'Héroe: '),
      UI.btn('Ninguno', () => { plan.heroe = null; UI.rerender(); }, { small: true, cls: plan.heroe ? '' : 'gold' }),
      libres.map(h => UI.btn('', () => { plan.heroe = h.id; UI.rerender(); }, { small: true, cls: plan.heroe === h.id ? 'gold' : '', title: H_txt(h, pv) })).map((b, i) => { b.append(HH.retratoEl(libres[i]), el('span', { translate: 'no' }, libres[i].nombre), el('small', null, ' +' + Math.round((HH.mult(libres[i], pv.enemy) - 1) * 100) + '%')); return b; }),
      libres.length < todos.length ? el('span', { class: 'small muted' }, (todos.length - libres.length) + ' fuera o herido' + (todos.length - libres.length > 1 ? 's' : '')) : '');
  }
  const H_txt = (h, pv) => PK.Heroes.CLASES[h.clase].name + ' nivel ' + h.nivel + ': +' + Math.round((PK.Heroes.mult(h, pv.enemy) - 1) * 100) + '% de fuerza contra estos enemigos';

  function runsList(pane) {
    const runs = S().exp.runs;
    if (!runs.length) return;
    pane.append(el('h3', null, 'Tropas fuera (' + runs.length + ')'));
    for (const r of runs) {
      // incursión (incursion.js): eligiendo sala o entrando a una
      if (r.inc && (r.phase === 'sala' || r.phase === 'fin' || (r.phase === 'go' && r.inc.llego))) {
        pane.append(el('div', { class: 'run-row' }, el('span', { class: 'run-ic' }, '☠'),
          el('div', { class: 'dg-info' }, el('b', null, 'Incursión: ' + D.DUNGEON[W.pois[r.poi].kind].name + ' · piso ' + r.inc.piso + ' de ' + r.inc.fin),
            el('div', { class: 'small muted' }, sumUnits(r.units) + ' soldados · ' + (r.phase === 'sala' ? 'elige el camino (' + U.fmtTime(Math.max(0, (r.inc.hasta - Date.now()) / 1000)) + ')' : 'entrando a la sala'))),
          UI.btn(r.phase === 'sala' ? 'Elegir sala' : 'Ver', () => PK.Inc.open(r.id), { small: true, cls: 'gold' })));
        continue;
      }
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
    if (PK.Inc && sites.length) pane.append(el('p', { class: 'small' }, 'Cada visita es una incursión de 5 pisos: eliges la sala de cada piso y el último es un jefe. Afijos de esta semana: ', PK.Inc.afijos().map((a, i) => el('span', { title: PK.Inc.AFIJOS[a].desc + (PK.Inc.AFIJOS[a].premio ? '; ' + PK.Inc.AFIJOS[a].premio : '') }, (i ? ' y ' : '') + PK.Inc.AFIJOS[a].name + ' (' + PK.Inc.AFIJOS[a].desc + (PK.Inc.AFIJOS[a].premio ? ', ' + PK.Inc.AFIJOS[a].premio : '') + ')')), '.'));
    if (!sites.length) pane.append(el('p', { class: 'muted small' }, 'Tus exploradores todavía no encontraron mazmorras. Están escondidas en la niebla: cuevas de cristal y guaridas cerca, catacumbas, cráteres y nidos de dragón más lejos. El Observatorio las marca en el mapa.'));
    for (const p of sites) {
      const d = D.DUNGEON[p.kind], site = PK.Exp.site(p.id), rest = site.rest - Date.now(), next = Math.min(d.floors, site.best + 1);
      const going = st.exp.runs.some(r => r.poi === p.id), locked = st.era < d.era;
      const floorBtn = f => UI.btn((f > site.best ? 'Piso ' : 'Repetir piso ') + f, () => { plan = { target: { poi: p.id, floor: f }, units: null }; UI.rerender(); }, { small: true, cls: f > site.best ? 'gold' : '' });
      // Mazmorras 2.0: incursiones por bloques de 5 pisos (el último bloque es el más nuevo)
      const bloques = PK.Inc ? PK.Inc.bloques(p) : null;
      const bloqueBtn = k => UI.btn((k.limpio ? 'Repetir ' : 'Pisos ') + k.desde + '–' + k.hasta, () => { plan = { target: { poi: p.id, floor: k.desde }, units: null }; UI.rerender(); }, { small: true, cls: k.limpio ? '' : 'gold', title: 'Incursión de ' + (k.hasta - k.desde + 1) + ' pisos con jefe al final' });
      pane.append(el('div', { class: 'raid-row dungeon' + (locked ? ' locked' : '') },
        el('img', { class: 'dg-ico', src: Sp.poi(p.kind, false).c.toDataURL() }),
        el('div', { class: 'dg-info' }, el('b', null, d.name), el('div', { class: 'small' }, enemyText(d.enemy) + ' · da ' + D.RES[d.loot].name.toLowerCase()),
          el('div', { class: 'small muted' }, 'Pisos ' + site.best + '/' + d.floors + ' · viaje ' + U.fmtTime(PK.Exp.travel(p)) + (rest > 0 ? ' · se repone en ' + U.fmtTime(rest / 1000) : ''))),
        locked ? el('span', { class: 'muted small' }, 'Era ' + U.roman(d.era)) : going ? el('span', { class: 'muted small' }, 'Expedición en curso') :
          bloques ? el('span', { class: 'row' }, bloques.slice(-2).map(bloqueBtn)) : el('span', { class: 'row' }, site.best ? floorBtn(site.best) : null, site.best < d.floors ? floorBtn(next) : null),
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
        r.heroe ? el('p', { class: 'small' }, 'Héroe: ', el('b', { translate: 'no' }, r.heroe), r.won ? '' : ' (vuelve herido)', r.hab ? ' · usó su habilidad ' + (r.hab === 1 ? 'una vez' : r.hab + ' veces') : '') : null,
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
  // el panel de selección (ui.js) los usa para el Cuartel y las mazmorras
  UI.barracksQuick = barracksQuick; UI.enemyText = enemyText; UI.bestVs = bestVs;
})();
