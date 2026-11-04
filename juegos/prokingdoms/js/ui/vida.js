// Ventanas de la Fase 3 (js/vida.js): el árbol 2.0 como pestaña de Investigación, las cartas de era y la estación
// de la barra de arriba. Agrega funciones a PK.UI; carga después de ui/reino.js (que tiene UI.openResearch).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, UI = PK.UI, Sp = PK.Sprites;
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const V = () => PK.Vida;
  const el = (...a) => U.el(...a);

  // ---------- Árbol 2.0 ----------
  // Una columna por rama, de la Era II a la IX. Los pares enfrentados van juntos con un «o» en el medio.
  UI.arbolEl = function () {
    const st = S(), wrap = el('div', { class: 'arbol' });
    wrap.append(el('p', { class: 'small muted' }, 'Cada nodo desbloquea algo para siempre. En cada era hay dos enfrentados (marcados «o»): elegir uno cierra el otro hasta la era siguiente. Se investigan con la Biblioteca, igual que los Fundamentos, y la Universidad los acelera. Llevas ' + V().contar() + ' de ' + Object.keys(D.ARBOL).length + '.'));
    const cols = el('div', { class: 'arbol-cols' });
    for (const rama in D.RAMAS) {
      const R = D.RAMAS[rama], col = el('div', { class: 'arbol-col', style: { '--rama': R.color } }, el('h4', null, el('img', { class: 'ico', src: Sp.icon(R.icon), alt: '' }), R.name, el('small', null, ' ' + V().contar(rama))));
      const ids = Object.keys(D.ARBOL).filter(id => D.ARBOL[id].rama === rama).sort((a, b) => D.ARBOL[a].era - D.ARBOL[b].era);
      const vistos = new Set();
      for (const id of ids) {
        if (vistos.has(id)) continue;
        const n = D.ARBOL[id];
        if (n.ex && D.ARBOL[n.ex].rama === rama) {
          vistos.add(n.ex);
          col.append(el('div', { class: 'arbol-par' }, nodoEl(id), el('span', { class: 'arbol-o' }, 'o'), nodoEl(n.ex)));
        } else col.append(nodoEl(id));
        vistos.add(id);
      }
      cols.append(col);
    }
    wrap.append(cols);
    return wrap;
    function nodoEl(id) {
      const n = D.ARBOL[id], e = V().estado(id), cost = V().costoNodo(id), why = V().porQueNo(id);
      const pie = e === 'hecho' ? el('p', { class: 'small ok' }, '✓ Investigado')
        : e === 'curso' ? el('p', { class: 'small' }, 'Investigando…')
          : e === 'bloq' || e === 'era' || e === 'lib' ? el('p', { class: 'small muted' }, why)
            : el('div', null, UI.costEl(cost), el('div', { class: 'small muted' }, U.fmtTime(V().tiempoNodo(id) / G().researchMult())),
              UI.btn('Investigar', () => { if (V().investigar(id)) UI.rerender(); }, { small: true, disabled: !!why }),
              PK.Consejo && PK.Consejo.tiene('mayordomo') ? UI.btn('+ cola', () => { PK.Consejo.encolar(V().nodoId(id)); UI.rerender(); }, { small: true, title: 'El Mayordomo lo empieza cuando termine lo que hay y alcancen los recursos' }) : '');
      return el('div', { class: 'tech nodo ' + e + (n.ex ? ' ex' : '') },
        el('div', { class: 'tech-h' }, el('b', null, n.name), el('span', { class: 'lvl' }, 'Era ' + U.roman(n.era))),
        el('p', { class: 'small' }, n.desc), pie);
    }
  };

  // ---------- Cartas de era ----------
  UI.openCartas = function () {
    UI.modal('cartas', 'Cartas de era', body => {
      const st = S(), e = V().pendiente();
      if (e) {
        body.append(el('p', null, 'Tu reino llegó a la Era ' + U.roman(e) + '. Elige una carta: dura para siempre. Algunas tienen una contra.'));
        body.append(el('div', { class: 'cartas' }, V().mano(e).map(id => cartaEl(id, () => { if (V().elegirCarta(e, id)) { if (V().pendiente()) UI.rerender(true); else UI.closeModal(); } }))));
      } else body.append(el('p', { class: 'small muted' }, 'La próxima carta llega con la próxima era.' + (D.DECREE_ERAS.some(x => x > st.era) ? ' En las Eras VII y X, en vez de cartas, se elige un decreto real.' : '')));
      const tom = st.cartas.tomadas.slice().sort((a, b) => a.era - b.era);
      if (tom.length || st.decrees.length) {
        body.append(el('h3', null, 'Tu mazo'));
        body.append(el('div', { class: 'cartas chicas' }, tom.map(c => cartaEl(c.id, null, c.era)),
          st.decrees.map((id, i) => el('div', { class: 'carta real' }, el('small', null, 'Era ' + U.roman(D.DECREE_ERAS[i]) + ' · real'), el('b', null, D.DECREES[id].name), el('p', { class: 'small' }, D.DECREES[id].desc)))));
      }
    }, { wide: true });
  };
  function cartaEl(id, fn, era) {
    const c = D.CARTAS[id], malo = /−/.test(c.desc);
    return el('div', { class: 'carta' + (malo ? ' contra' : '') }, era ? el('small', null, 'Era ' + U.roman(era)) : '', el('b', null, c.name), el('p', { class: 'small' }, c.desc), fn ? UI.btn('Elegir', fn) : '');
  }
  // Al llegar a una era se abre sola (como el decreto), si no hay otra ventana ni una batalla abierta.
  let avisada = 0;
  UI.revisarCartas = function () {
    const e = V() && S() && S().cartas ? V().pendiente() : 0;
    if (!e || avisada === e || G().offline) return;
    avisada = e;
    if (!UI.modalKey() && !(PK.Batalla && PK.Batalla.abierta())) UI.openCartas();
    else UI.toast('Tienes una carta de era para elegir.', 'epic', { label: 'Ver', fn: () => UI.openCartas() });
  };

  // ---------- Estación (barra de arriba) ----------
  UI.estacionEl = function () {
    const b = el('button', { class: 'res estacion', onclick: () => UI.openEstacion() });
    const pintar = () => { const E = V().estacionDe(); b.textContent = E.icon; b.title = E.name + ': ' + E.desc + ' Cambia en ' + U.fmtTime(V().estacionFalta()) + '.'; b.setAttribute('aria-label', E.name); };
    pintar();
    setInterval(pintar, 5000);
    return b;
  };
  UI.openEstacion = function () {
    UI.modal('estacion', 'Estaciones', body => {
      const e = V().estacion();
      body.append(el('p', null, 'Cada estación dura ' + D.ESTACION_H + ' horas reales y es la misma para todos los reinos. Faltan ' + U.fmtTime(V().estacionFalta()) + ' para la próxima.'));
      body.append(el('div', { class: 'cartas chicas' }, D.ESTACIONES.map((E, i) => el('div', { class: 'carta' + (i === e ? ' real' : '') }, el('b', null, E.icon + ' ' + E.name), el('p', { class: 'small' }, E.desc), i === e ? el('small', null, 'Ahora') : ''))));
      body.append(el('p', { class: 'small muted' }, 'De noche (según la hora de tu equipo) el pueblo enciende sus luces. Si no te gusta, apágala en Opciones → «Sin noche».'));
    });
  };
})();
