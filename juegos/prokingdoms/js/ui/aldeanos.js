// Aldeanos (trabajos y Capataz) y el menú Construir.
// Salió de js/ui.js al partirlo por ventanas (T5 del plan): los mismos atajos que allá. Va después de ui.js.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites, UI = PK.UI;
  const el = U.el;
  const G = () => PK.Game;
  const S = () => PK.Game.state;

  // ---------- Aldeanos: trabajos y Capataz ----------
  // Los aldeanos ya no construyen (las obras se levantan solas): solo se elige qué hacen. Arriba, cuántos hay en
  // cada trabajo con − y +; abajo, el Capataz, que reparte a los que quedan ociosos según tus prioridades.
  // A5: cuánto caminan los recolectores de ese recurso; si es más de la mitad, un botón deja el campamento ubicado.
  function eficiencia(res) {
    const A = PK.Auto, ef = A.eficiencia(res);
    if (ef === null) return '';
    const mal = ef > 0.5;
    return el('span', { class: 'small jr-ef ' + (mal ? 'warn-t' : 'muted') }, 'caminan ' + Math.round(ef * 100) + '% del tiempo' + (mal ? ': pon un punto de acopio más cerca ' : ''),
      mal && A.CAMPO[res] ? UI.btn('Ubicar ' + D.BUILD[A.CAMPO[res]].name, () => { const p = A.acopioCerca(res); if (!p) { UI.toast('No encuentro lugar libre junto a donde trabajan.', 'warn'); return; } UI.closeModal(); A.proponerCampo(p.tipo, p.x, p.y); }, { small: true }) : '');
  }
  // Mejoras en serie (PK.Auto.serieTick): − nivel + para un tipo. 0 = apagado; A.SERIE_ERA = siempre el máximo de la era.
  UI.serieCtl = function (type, refresca) {
    const A = PK.Auto, g = PK.Game, max = g.maxLvl(type), v = g.state.auto.serie[type] || 0;
    const pon = n => { A.setSerie(type, n); refresca(); };
    const txt = !v ? 'apagado' : v >= A.SERIE_ERA ? 'máx. de la era (' + max + ')' : 'hasta nivel ' + Math.min(v, max);
    return el('span', { class: 'serie-ctl' },
      UI.btn('−', () => pon(v >= A.SERIE_ERA ? max : v - 1 <= 1 ? 0 : v - 1), { small: true, disabled: !v, title: 'Bajar el nivel de la serie' }),
      el('b', { class: v ? 'good' : 'muted' }, ' ' + txt + ' '),
      UI.btn('+', () => { const x = A.serieTipos().find(t => t.type === type); pon(!v ? Math.min(max, Math.max(2, (x ? x.min : 1) + 1)) : v >= max ? A.SERIE_ERA : v + 1); }, { small: true, disabled: v >= A.SERIE_ERA, title: 'Subir el nivel de la serie' }));
  };
  function serieEl() {
    const A = PK.Auto, g = PK.Game, tipos = A.serieTipos();
    const box = el('div', null, el('h3', null, 'Mejoras en serie'),
      el('p', { class: 'small' }, 'Para casas, granjas, campamentos, molinos y muelles: elige hasta qué nivel y el Capataz los mejora solo, primero los más bajos. No usa tu cola de obras: lo que pongas ahí va antes apenas se pueda pagar, y el Capataz no gasta lo que pide la próxima obra de la cola. Deja un Maestro de Obras libre si tienes más de uno y con «Meta de era» no gasta lo que la era necesita.'));
    if (!tipos.length) { box.append(el('p', { class: 'small muted' }, 'Todavía no tienes casas, granjas, campamentos, molinos ni muelles.')); return box; }
    if (A.colaLista() && Object.keys(g.state.auto.serie).length) box.append(el('p', { class: 'small warn-t' }, 'Un momento: primero empieza lo de tu cola de obras que ya se puede pagar.'));
    const rows = el('div', { class: 'guild-rows' });
    for (const x of tipos) {
      const meta = A.serieNivel(x.type), faltan = meta ? g.buildings.filter(b => b.owner === 'p' && b.done && b.type === x.type && b.lvl < meta).length : 0;
      const subiendo = g.buildings.filter(b => b.owner === 'p' && b.type === x.type && b.upg).length;
      rows.append(el('div', { class: 'g-row serie-row' }, el('img', { class: 'serie-ico', src: Sp.buildingIcon(x.type, 'p', x.max), alt: '' }),
        el('b', { class: 'fw-name' }, D.BUILD[x.type].name + ' ×' + x.n),
        el('span', { class: 'small muted' }, ' nivel ' + (x.min === x.max ? x.min : x.min + '–' + x.max) + ' '),
        UI.serieCtl(x.type, () => UI.rerender()),
        el('span', { class: 'small muted' }, meta ? (faltan ? ' · faltan ' + faltan + (subiendo ? ' (' + subiendo + ' mejorando)' : '') : ' · todas listas') : '')));
    }
    box.append(rows);
    return box;
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
          el('span', { class: 'small muted rr-help' }, ' los talleres no gastan un insumo si la bodega queda bajo este porcentaje; si un taller pasa 20 s parado, los trabajadores que puso el Capataz salen a recolectar')),
        serieEl());
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
    ['Recolección', ['lumber', 'mining', 'mill', 'farm', 'muelle', 'scout']],
    ['Talleres', ['sawmill', 'masonry', 'smelter', 'forge', 'scriptorium', 'steelworks', 'workshop', 'cartwright']],
    ['Reino', ['market', 'library', 'consejo', 'university', 'monastery', 'guild']],
    ['Ejército y defensa', ['barracks', 'tower']],
    ['Maravilla (elige una)', D.MARAVILLAS || []],
    ['Decoraciones (ánimo)', D.DECOS || []],
  ];
  const BUILD_CATS_MAR = [
    ['Casas y bodegas', ['house', 'granary', 'warehouse', 'builder', 'tc']],
    ['Recolección', ['lumber', 'mining', 'mill', 'muelle', 'salinas']],
    ['Talleres', ['velas', 'astillero', 'polvorin']],
    ['Puerto', ['embarcadero', 'comercio', 'faromar', 'tower']],
    ['Maravilla', ['granfaro']],
  ];
  UI.openBuild = function () {
    UI.modal('build', 'Construir', body => {
      const g = G(), st = S(), seen = new Set();
      body.append(el('p', { class: 'small muted' }, 'Elige un edificio y ' + UI.hint('haz clic donde va', 'toca dónde va') + ' en tu tierra. Se levanta solo: tus aldeanos siguen con lo suyo. Arquitectura (Investigar) acelera las obras.'));
      // En el mar (pk-28) la lista es otra: solo D.MAR.construir, en sus propias secciones
      const cats = D.temaActivo === 'mar' ? BUILD_CATS_MAR.map(c => [c[0], c[1].filter(t => D.BUILD_ORDER.includes(t))]) : BUILD_CATS.concat([['Leyendas', D.LEGEND_B]]);
      const rest = D.BUILD_ORDER.filter(t => !cats.some(c => c[1].includes(t)));
      if (rest.length) cats[3][1] = cats[3][1].concat(rest);
      if (D.temaActivo === 'mar') body.firstChild.textContent = 'Elige un edificio y ' + UI.hint('haz clic', 'toca') + ' en la isla donde va. Para levantar en otra isla primero funda allí una colonia (Embarcadero).';
      for (const [name, types] of cats) {
        const grid = el('div', { class: 'bmenu' });
        for (const type of types) {
          if (!D.BUILD[type] || seen.has(type) || D.BUILD[type].retirada) continue;
          seen.add(type);
          const def = D.BUILD[type], legend = g.legendLocked(type), eraLock = def.era > st.era, have = g.countAll(type), max = g.maxCount(type), full = have >= max;
          if (legend && name === 'Leyendas' && def.era > st.era + 2) continue; // las muy lejanas no se muestran todavía
          const cost = g.buildCost(type), afford = g.canAfford(cost), logro = g.logroFalta(type), locked = legend || eraLock || !!logro;
          const otra = def.marav && full && g.maravilla() && g.maravilla().type !== type;
          const why = legend ? 'Se desbloquea con una misión de la rama Leyendas del Libro.' : eraLock ? 'Requiere la Era ' + U.roman(def.era) + '.' : logro ? logro : otra ? 'Ya elegiste la ' + g.maravilla().def.name + ': solo hay una Maravilla por reino.' : full ? 'Ya tienes el máximo' + (typeof def.max === 'function' ? ' para tu era' : '') + ' (' + have + '/' + max + ').' : !afford ? 'Te faltan recursos.' : '';
          grid.append(el('button', { class: 'bcard' + (locked ? ' locked' : full ? ' full' : !afford ? ' poor' : ''), title: def.desc, onclick: () => {
            if (locked || full) { UI.toast(why, 'warn'); return; }
            UI.closeModal();
            PK.Input.startPlacing(type);
            UI.toast(UI.hint('Haz clic donde va ' + def.name + '.', 'Toca dónde va ' + def.name + ': primero verás cómo queda.'), 'info');
          } }, el('img', { class: 'bc-img', src: Sp.buildingIcon(type), alt: '' }),
            el('div', { class: 'bc-txt' }, el('b', null, def.name), el('span', { class: 'small bc-desc' }, def.desc),
              locked ? el('span', { class: 'small muted' }, legend ? '★ Leyendas' : logro ? '★ ' + logro : 'Era ' + U.roman(def.era)) : el('span', { class: 'bc-cost' }, UI.costEl(cost), el('span', { class: 'small muted' }, ' · ' + U.fmtTime(def.time / g.buildMult('p')))),
              why && !locked ? el('span', { class: 'small warn-t' }, why) : null),
            max < 99 ? el('span', { class: 'bc-n' }, have + '/' + max) : have ? el('span', { class: 'bc-n' }, String(have)) : null));
        }
        if (grid.children.length) body.append(el('h3', null, name), grid);
      }
      // pk-40: el terreno de tus tierras (despeje.js)
      if (D.temaActivo !== 'mar' && PK.Despeje) body.append(el('h3', null, 'Terreno'), el('div', { class: 'row' },
        UI.btn('Plantar árboles', () => PK.Despeje.empezar('plantar'), { small: true, title: 'Un brote en una casilla libre de tus tierras; en 20 minutos es un árbol' }),
        UI.btn('Talar árboles', () => PK.Despeje.empezar('talar'), { small: true, title: 'Marca una zona: sus árboles se quitan para siempre (vuelve la mitad de la madera)' }),
        UI.btn('Quitar muros y caminos', () => PK.Despeje.empezar('quitar'), { small: true, title: 'Marca una zona: se quitan sus murallas, puertas y caminos (vuelve la mitad del material)' })),
        el('p', { class: 'small muted' }, 'Dentro de tus tierras solo quedan árboles: las minas, cuevas y campamentos que caen en una parcela tuya se mudan solos a la tierra de nadie más cercana.'));
    }, { wide: true });
  };
})();
