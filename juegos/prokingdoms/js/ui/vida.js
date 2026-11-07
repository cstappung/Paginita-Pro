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
    if (!e || avisada === e || G().offline || D.temaActivo === 'mar') return; // en el mar no hay cartas de era (pk-28)
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
  // ---------- V4. Ánimo (barra de arriba y ventana) ----------
  UI.animoEl = function () {
    const b = el('button', { class: 'res animo', onclick: () => UI.openAnimo() });
    const pintar = () => {
      const v = V().animo(), m = V().animoMult();
      b.textContent = (v >= 70 ? '😊 ' : v >= 40 ? '🙂 ' : '😟 ') + v;
      b.classList.toggle('bajo', v < 40); b.classList.toggle('alto', v >= 80);
      b.title = 'Ánimo del pueblo: ' + v + '/100 (' + (m >= 1 ? '+' : '') + Math.round((m - 1) * 100) + '% de recolección y talleres)';
    };
    pintar();
    setInterval(pintar, 2000);
    return b;
  };
  UI.openAnimo = function () {
    UI.modal('animo', 'Ánimo del pueblo', body => {
      const v = V().animo(), m = V().animoMult();
      body.append(el('div', { class: 'era-box' }, el('b', null, 'Ánimo ' + v + ' de 100'), el('div', { class: 'bar' }, el('div', { class: 'fill ' + (v >= 50 ? 'green' : 'gold'), style: { width: v + '%' } }), el('span', null, (m >= 1 ? '+' : '') + Math.round((m - 1) * 100) + '% de recolección y talleres'))));
      const partes = V().animoPartes();
      body.append(el('h3', null, 'Qué lo mueve'), el('ul', { class: 'info' }, el('li', null, 'Base: 50'), partes.map(p => el('li', { class: p.v < 0 ? 'warn-t' : '' }, p.txt + ': ' + (p.v > 0 ? '+' : '') + p.v))));
      body.append(el('p', { class: 'small muted' }, 'En 50 no cambia nada. En 0 tu gente rinde 10% menos y en 100, 15% más. Pasado 80, de vez en cuando hay un «Día feliz». Sube con decoraciones junto a las casas, la Taberna, las fiestas, la variedad de edificios y un Juglar que gobierne. Baja si te saquean, si la despensa se vacía o si hay casas lejos de un punto de acopio.'),
        UI.btn('Construir decoraciones', () => { UI.closeModal(); UI.openBuild(); }, { small: true }));
    });
  };

  // ---------- V6. La Maravilla vieja: elegir en qué se transforma ----------
  UI.maravillaEl = function (b) {
    const box = el('div', { class: 'era-box' }, el('b', null, 'Maravillas 2.0'), el('p', { class: 'small' }, 'Tu Maravilla puede transformarse gratis, conservando el nivel, en una de las cuatro nuevas (5×5): elige qué quieres que haga por tu reino.'));
    for (const t of D.MARAVILLAS) box.append(el('div', { class: 'work-row' }, el('span', null, el('b', null, D.BUILD[t].name), el('span', { class: 'small muted' }, ' — ' + D.MARAV[t].txt(b.lvl))), UI.btn('Elegir', () => { const n = V().transformar(b, t); if (n) UI.selectBuilding(n); }, { small: true })));
    return box;
  };
  UI.maravillaInfo = function (b) {
    const M = D.MARAV[b.type], f = V().fase(b);
    return el('div', { class: 'era-box' }, el('b', null, 'Etapa ' + (f + 1) + ' de 7: ' + M.fase[f]), el('p', { class: 'small' }, 'Da ' + M.txt(b.lvl) + '.'), f < 6 ? el('p', { class: 'small muted' }, 'En el nivel ' + (f + 1) * 5 + ' se suma ' + M.fase[f + 1] + '.') : '');
  };

  // ---------- V7. Desafíos, Retos del Rey y títulos (pestaña del Libro de Misiones) ----------
  UI.renderDesafios = function (left, right) {
    const st = S(), n = V().cumplidos();
    left.append(el('h2', null, 'Retos del Rey'), el('p', { class: 'small muted' }, 'Tres por semana. Se renuevan el lunes. Cumplir los tres abre un cofre real.'));
    const rs = V().retos();
    for (const id of rs.ids) {
      const p = V().retoProg(id), ok = rs.hechos[id];
      left.append(el('div', { class: 'quest' + (ok ? ' done' : '') }, el('b', null, (ok ? '✓ ' : '') + p.r.name), el('p', { class: 'small' }, p.r.desc.replace(/\d[\d.]*/, U.fmt(p.meta)) + '.'),
        el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: Math.min(100, (p.n / p.meta) * 100) + '%' } }), el('span', null, U.fmt(Math.min(p.n, p.meta)) + ' / ' + U.fmt(p.meta)))));
    }
    left.append(el('p', { class: 'small' + (rs.cofre ? '' : ' muted') }, rs.cofre ? '✓ Cofre real abierto esta semana.' : 'Cofre real: ' + rs.ids.filter(id => rs.hechos[id]).length + ' de 3.'));
    // títulos
    const t = st.flags.titulo;
    left.append(el('h3', null, 'Título del reino'), el('p', { class: 'small muted' }, 'Cada desafío cumplido te da su título. El que elijas se ve en el panel de tu Centro Urbano.'),
      el('div', { class: 'row wrap' }, D.DESAFIOS.filter(d => st.desafios[d.id]).map(d => UI.btn(d.name, () => { st.flags.titulo = t === d.id ? null : d.id; UI.rerender(); }, { small: true, cls: t === d.id ? 'gold' : '' })),
        // V7: el rango más alto de cada escalera de misiones también es un título
        Object.keys(D.ESCALERAS).map(k => { const id = D.ESCALERAS[k].ids.filter(x => st.quests[x] === 'claimed').pop(); if (!id) return ''; const q = D.QUESTS.find(o => o.id === id), v = 'q:' + id;
          return UI.btn(q.title, () => { st.flags.titulo = t === v ? null : v; UI.rerender(); }, { small: true, cls: t === v ? 'gold' : '' }); })));
    right.append(el('h2', null, 'Desafíos (' + n + '/' + D.DESAFIOS.length + ')'), el('p', { class: 'small muted' }, 'Se cumplen una vez y para siempre. Con 10 se desbloquea el Arco de triunfo.'));
    right.append(el('div', { class: 'desafios' }, D.DESAFIOS.map(d => el('div', { class: 'desafio' + (st.desafios[d.id] ? ' done' : '') }, el('b', null, (st.desafios[d.id] ? '✓ ' : '') + d.name), el('span', { class: 'small' }, d.desc)))));
  };
  UI.openDesafios = () => PK.Quests.openBook('desafios');

  // ---------- V8. Tienda del reino ----------
  UI.openTienda = function () {
    UI.modal('tienda', 'Tienda del reino', body => {
      const st = S(), m = PK.Platform.getCoins();
      body.append(el('p', null, 'Tienes ', el('b', null, U.fmt(m) + ' monedas del reino'), '. Aquí solo hay cosas que se ven y comodidades: nada que cambie el balance. Las monedas del reino salen de misiones, cofres y la Maravilla, y no son las de Juegos.'));
      const grupos = { color: 'Color del reino (banderas y estandartes)', marco: 'Marco para los retratos de héroe', fuegos: 'Al llegar a una era', cola: 'Comodidades', premio: 'Premios de las escaleras de misiones' };
      if (UI.openAspectos) body.append(el('div', { class: 'row' }, UI.btn('Mis aspectos', () => UI.openAspectos(), { small: true }), el('span', { class: 'small muted' }, 'Lo de la tienda y lo del Pase del Reino, juntos (Reino → Aspectos).')));
      for (const g in grupos) {
        body.append(el('h3', null, grupos[g]));
        // V7: los premios no se compran: se ganan con el rango II (estandarte) y el último (marco) de cada escalera
        if (g === 'premio') body.append(el('p', { class: 'small muted' }, 'Se ganan con el rango II y el último de cada escalera del Libro de Misiones.'));
        body.append(el('div', { class: 'tienda' }, D.TIENDA.filter(it => (g === 'premio' ? !!it.premio : it.t === g && !it.premio)).map(it => {
          const tengo = st.tienda.tengo[it.id], uso = st.tienda[it.t] === it.id;
          const muestra = it.col ? el('span', { class: 'muestra', style: { background: 'rgb(' + it.col.join(',') + ')' } }) : it.css ? el('span', { class: 'muestra marco', style: { borderColor: it.css } }) : '';
          return el('div', { class: 'item' + (uso ? ' uso' : '') }, muestra, el('b', null, it.name), it.desc ? el('span', { class: 'small' }, it.desc) : '',
            tengo ? (it.t === 'cola' ? el('span', { class: 'small ok' }, '✓ Tuyo') : UI.btn(uso ? 'Quitar' : 'Usar', () => { V().usar(it.id); UI.rerender(); }, { small: true, cls: uso ? '' : 'gold' }))
              : it.premio ? el('span', { class: 'small muted' }, it.t === 'color' ? 'Rango II' : 'Último rango')
              : UI.btn(it.precio + ' monedas', () => { V().comprar(it.id); UI.rerender(); }, { small: true, disabled: m < it.precio }));
        })));
      }
    }, { wide: true });
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
