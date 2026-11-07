// Ventana «Aspectos» (pk-36, Reino → Aspectos): todo lo que cambia cómo se ve tu reino en un solo lugar.
// Los aspectos del Pase (st.aspectos) y los cosméticos de la tienda (st.tienda) se eligen aquí:
// - edificios y decoraciones: uno por tipo (st.flags['asp_' + tipo]) y, si quieres, uno por edificio (b.asp:
//   vacío sigue al de su tipo, 'normal' es sin aspecto, un id es ese aspecto; ver Sp.aspectoDe);
// - tropas (st.flags['asp_' + tropa]) y héroes (h.aspecto, como en la ficha del héroe);
// - color del reino y marco de retratos: la tienda y el Pase comparten el lugar (usar uno saca el otro);
// - efecto de habilidad (st.flags.aspEfecto), barco (st.flags.aspBarco) y fuegos al llegar a una era.
// Son solo visuales: nada de esto pasa por el servidor.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, UI = PK.UI, Sp = PK.Sprites;
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const P = () => PK.Pase;
  const abiertos = {}; // qué listas «uno por uno» quedaron abiertas entre un repintado y otro
  const rgb = c => 'rgb(' + c.join(',') + ')';

  // lo que tienes, ordenado por grupo
  function inventario() {
    const st = S(), inv = { edificios: {}, tropas: {}, heroe: [], estandarte: [], marco: [], efecto: [], barco: [] };
    for (const id of Object.keys(st.aspectos || {})) {
      const a = D.aspecto(id);
      if (!a) continue;
      if ((a.tipo === 'edificio' || a.tipo === 'deco') && a.o && D.BUILD[a.o.b]) (inv.edificios[a.o.b] = inv.edificios[a.o.b] || []).push(id);
      else if (a.tipo === 'tropa' && a.o && D.ARMY[a.o.t]) (inv.tropas[a.o.t] = inv.tropas[a.o.t] || []).push(id);
      else if (a.tipo === 'heroe' || a.tipo === 'heroe2') inv.heroe.push(id);
      else if (inv[a.tipo]) inv[a.tipo].push(id);
    }
    const t = st.tienda || { tengo: {} };
    inv.colores = D.TIENDA.filter(it => it.t === 'color' && t.tengo[it.id]);
    inv.marcos = D.TIENDA.filter(it => it.t === 'marco' && t.tengo[it.id]);
    inv.fuegos = D.TIENDA.filter(it => it.t === 'fuegos' && t.tengo[it.id]);
    return inv;
  }
  UI.hayAspectos = function () {
    const st = S();
    if (!st) return false;
    if (Object.keys(st.aspectos || {}).length) return true;
    const t = st.tienda && st.tienda.tengo;
    return !!t && D.TIENDA.some(it => it.t !== 'cola' && t[it.id]);
  };

  function aplicar() {
    if (PK.Vida && PK.Vida.aplicarAspectos) PK.Vida.aplicarAspectos();
    else if (P()) P().aplicar();
    UI.rerender();
    UI.refreshPanel && UI.refreshPanel(true);
  }
  const opcion = (txt, activo, fn, extra) => UI.btn(extra ? el('span', null, extra, ' ', txt) : txt, fn, { small: true, cls: activo ? 'gold' : '' });
  const muestra = (col, marco) => el('span', { class: 'asp-muestra' + (marco ? ' marco' : ''), style: marco ? { borderColor: col } : { background: col } });
  const fila = (cab, ...ops) => el('div', { class: 'asp-fila' }, el('div', { class: 'asp-cab' }, cab), el('div', { class: 'asp-ops' }, ops.flat(3)));

  UI.openAspectos = function () {
    UI.modal('aspectos', 'Aspectos', body => {
      const st = S(), g = G(), inv = inventario(), f = st.flags, t = st.tienda;
      const nada = !UI.hayAspectos();
      body.append(el('p', null, 'Elige cómo se ve tu reino. Todo es solo visual: no cambia producción, fuerza ni el balance.'));
      if (nada) {
        body.append(el('p', { class: 'small muted' }, 'Todavía no tienes aspectos. Salen en la pista dorada del Pase del Reino (👑 arriba) y en la tienda del reino (las monedas, arriba a la derecha).'),
          el('div', { class: 'row' }, PK.Pase ? UI.btn('Pase del Reino', () => PK.Pase.open(), { cls: 'gold' }) : '', UI.openTienda ? UI.btn('Tienda del reino', () => UI.openTienda()) : ''));
        return;
      }

      // ---- edificios y decoraciones ----
      const tipos = Object.keys(inv.edificios);
      if (tipos.length) {
        body.append(el('h3', null, 'Edificios y decoraciones'), el('p', { class: 'small muted' }, 'El botón elige el aspecto de todos los de ese tipo. Para uno solo: tócalo en el mapa (su panel tiene «Aspecto») o ábrelo en «Uno por uno».'));
        for (const tipo of tipos) {
          const ids = inv.edificios[tipo], def = D.BUILD[tipo], mios = g.buildings.filter(b => b.owner === 'p' && b.type === tipo && b.done);
          const actual = f['asp_' + tipo] || null, propios = mios.filter(b => b.asp).length;
          const set = id => { f['asp_' + tipo] = id; aplicar(); };
          const cab = el('span', null, el('img', { class: 'asp-ico', src: Sp.buildingIcon(tipo, 'p', 1), alt: '' }), el('b', null, def.name), el('span', { class: 'small muted' }, ' · tienes ' + mios.length));
          body.append(fila(cab, opcion('Normal', !actual, () => set(null)), ids.map(id => opcion(P().nombre(id), actual === id, () => set(id)))));
          if (!mios.length) continue;
          const det = el('details', { class: 'asp-uno', open: abiertos[tipo] ? true : null, ontoggle: e => { abiertos[tipo] = e.target.open; } },
            el('summary', { class: 'small' }, 'Uno por uno (' + mios.length + ')' + (propios ? ' · ' + propios + ' con aspecto propio' : '')));
          if (propios) det.append(el('div', { class: 'row' }, UI.btn('Que todos sigan el de su tipo', () => { for (const b of mios) b.asp = undefined; aplicar(); }, { small: true })));
          mios.forEach((b, k) => det.append(unoEl(b, k, ids, actual)));
          body.append(det);
        }
      }

      // ---- tropas ----
      const tropas = Object.keys(inv.tropas);
      if (tropas.length) {
        body.append(el('h3', null, 'Tropas'));
        for (const tr of tropas) {
          const actual = f['asp_' + tr] || null, set = id => { f['asp_' + tr] = id; aplicar(); };
          const cab = el('span', null, el('img', { class: 'asp-ico', src: Sp.troopIcon(tr), alt: '' }), el('b', null, D.ARMY[tr].name));
          body.append(fila(cab, opcion('Normal', !actual, () => set(null)), inv.tropas[tr].map(id => opcion(P().nombre(id), actual === id, () => set(id), muestra(rgb(D.aspecto(id).o.col || D.aspecto(id).T.col))))));
        }
      }

      // ---- héroes ----
      const H = PK.Heroes;
      if (inv.heroe.length && H) {
        body.append(el('h3', null, 'Héroes'));
        const conAsp = H.lista().filter(h => inv.heroe.some(id => D.aspecto(id).o && D.aspecto(id).o.clase === h.clase));
        if (!conAsp.length) body.append(el('p', { class: 'small muted' }, 'Tus aspectos de héroe son de otra clase (' + [...new Set(inv.heroe.map(id => H.CLASES[D.aspecto(id).o.clase] ? H.CLASES[D.aspecto(id).o.clase].name : D.aspecto(id).o.clase))].join(', ') + '). Contrata un héroe de esa clase en la Taberna para usarlos.'));
        for (const h of conAsp) {
          const ids = inv.heroe.filter(id => D.aspecto(id).o.clase === h.clase), set = id => { h.aspecto = id; UI.rerender(); };
          const cab = el('span', null, H.retratoEl(h, 'asp-ret'), el('b', { translate: 'no' }, h.nombre), el('span', { class: 'small muted' }, ' · ' + (H.CLASES[h.clase] ? H.CLASES[h.clase].name : h.clase)));
          body.append(fila(cab, opcion('Normal', !h.aspecto, () => set(null)), ids.map(id => opcion(P().nombre(id), h.aspecto === id, () => set(id)))));
        }
      }

      // ---- color del reino ----
      if (inv.colores.length || inv.estandarte.length) {
        body.append(el('h3', null, 'Color del reino'), el('p', { class: 'small muted' }, 'Tus banderas, estandartes y techos de tela, como los ves tú.'));
        const usarTienda = it => { f.aspEstandarte = null; t.color = it.id; aplicar(); };
        const usarPase = id => { t.color = null; f.aspEstandarte = id; aplicar(); };
        body.append(fila(el('b', null, 'Color'),
          opcion('Normal', !t.color && !f.aspEstandarte, () => { t.color = null; f.aspEstandarte = null; aplicar(); }, muestra(rgb(D.PLAYER_COLOR))),
          inv.colores.map(it => opcion(it.name, t.color === it.id, () => usarTienda(it), muestra(rgb(it.col)))),
          inv.estandarte.map(id => opcion(P().nombre(id), !t.color && f.aspEstandarte === id, () => usarPase(id), muestra(rgb(D.aspecto(id).T.col))))));
      }

      // ---- marco de retratos ----
      if (inv.marcos.length || inv.marco.length) {
        body.append(el('h3', null, 'Marco de los retratos'));
        body.append(fila(el('b', null, 'Marco'),
          opcion('Sin marco', !t.marco && !f.aspMarco, () => { t.marco = null; f.aspMarco = null; aplicar(); }),
          inv.marcos.map(it => opcion(it.name, t.marco === it.id, () => { f.aspMarco = null; t.marco = it.id; aplicar(); }, muestra(it.css, true))),
          inv.marco.map(id => opcion(P().nombre(id), !t.marco && f.aspMarco === id, () => { t.marco = null; f.aspMarco = id; aplicar(); }, muestra(P().marcoCss(D.aspecto(id)), true)))));
      }

      // ---- efecto de habilidad ----
      if (inv.efecto.length) {
        body.append(el('h3', null, 'Efecto de habilidad'), el('p', { class: 'small muted' }, 'El destello que suelta tu héroe cuando usa su habilidad en una batalla.'));
        body.append(fila(el('b', null, 'Efecto'), opcion('Normal', !f.aspEfecto, () => { f.aspEfecto = null; aplicar(); }),
          inv.efecto.map(id => opcion(D.aspecto(id).o.name, f.aspEfecto === id, () => { f.aspEfecto = id; aplicar(); }, muestra(D.aspecto(id).o.col)))));
      }

      // ---- barco ----
      if (inv.barco.length) {
        body.append(el('h3', null, 'Barcos'), el('p', { class: 'small muted' }, 'Las velas de tus balandras, fragatas y galeones en el Archipiélago.'));
        body.append(fila(el('b', null, 'Velas'), opcion('Normal', !f.aspBarco, () => { f.aspBarco = null; aplicar(); }),
          inv.barco.map(id => opcion(D.aspecto(id).o.name, f.aspBarco === id, () => { f.aspBarco = id; aplicar(); }, muestra(rgb(D.aspecto(id).T.col))))));
      }

      // ---- fuegos al llegar a una era ----
      if (inv.fuegos.length) {
        body.append(el('h3', null, 'Al llegar a una era'));
        body.append(fila(el('b', null, 'Fuegos'), opcion('Ninguno', !t.fuegos, () => { t.fuegos = null; aplicar(); }),
          inv.fuegos.map(it => opcion(it.name, t.fuegos === it.id, () => { t.fuegos = it.id; aplicar(); })),
          t.fuegos && PK.Vida && PK.Vida.fuegos ? UI.btn('Probar', () => { UI.closeModal(); PK.Vida.fuegos(); }, { small: true }) : ''));
      }

      body.append(el('div', { class: 'row' }, PK.Pase ? UI.btn('Pase del Reino', () => PK.Pase.open()) : '', UI.openTienda ? UI.btn('Tienda del reino', () => UI.openTienda()) : ''));
    }, { wide: true });

    // una fila de «Uno por uno»: dónde está, su nivel, qué aspecto lleva y un botón para ir a verlo
    function unoEl(b, k, ids, actual) {
      const sel = el('select', { class: 'asp-sel', 'aria-label': 'Aspecto de ' + b.def.name + ' ' + (k + 1), onchange: e => { b.asp = e.target.value || undefined; aplicar(); } },
        el('option', { value: '' }, 'Como todos (' + (actual ? P().nombre(actual) : 'Normal') + ')'),
        el('option', { value: 'normal' }, 'Normal'),
        ids.map(id => el('option', { value: id }, P().nombre(id))));
      sel.value = b.asp && (b.asp === 'normal' || ids.includes(b.asp)) ? b.asp : '';
      return el('div', { class: 'asp-b' }, el('img', { class: 'asp-ico', src: Sp.buildingIcon(b.type, 'p', b.lvl, b.asp), alt: '' }),
        el('span', { class: 'small' }, b.def.name + ' ' + (k + 1) + (b.def.noUp ? '' : ' · Nv ' + b.lvl)), sel,
        UI.btn('Ver', () => { UI.closeModal(); UI.selectBuilding(b); }, { small: true }));
    }
  };

  // la fila «Aspecto» del panel de un edificio (ui.js): solo si tienes aspectos para su tipo
  UI.aspectoFila = function (b) {
    if (!b || b.owner !== 'p' || !b.done) return '';
    const st = S(), ids = Object.keys(st.aspectos || {}).filter(id => { const a = D.aspecto(id); return a && a.o && a.o.b === b.type && (a.tipo === 'edificio' || a.tipo === 'deco'); });
    if (!ids.length) return '';
    const tipo = st.flags['asp_' + b.type] || null, set = v => { b.asp = v; aplicar(); };
    return el('div', { class: 'row wrap asp-panel' }, el('span', { class: 'small' }, 'Aspecto: '),
      opcion('Como todos' + (tipo ? ' (' + P().nombre(tipo) + ')' : ''), !b.asp, () => set(undefined)),
      opcion('Normal', b.asp === 'normal', () => set('normal')),
      ids.map(id => opcion(P().nombre(id), b.asp === id, () => set(id))),
      UI.btn('Todos…', () => UI.openAspectos(), { small: true, title: 'Abre Reino → Aspectos' }));
  };
})();
