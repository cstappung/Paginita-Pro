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
      el('p', { class: 'small ' + (b.won ? 'good-t' : 'warn-t') }, b.cause),
      b.rep && b.rep.plan ? etapasEl(b) : null);
  };
  // pk-55: cómo fue el asedio, etapa por etapa, y «Ver de nuevo» (la repetición sale del plan guardado)
  function etapasEl(b) {
    const p = b.rep.plan, A = D.ASEDIO, hechas = {};
    for (const e of p.etapas) hechas[e.id] = e;
    return el('div', { class: 'bt-etapas' },
      A.etapas.map((id, i) => {
        const e = hechas[id];
        const txt = !e ? 'no se llegó' : e.r < 1 ? 'sin defensas' : e.rota ? 'aquí se quebró el ataque (' + Math.round(e.f1 * 100) + ' %)' : D.asedioSuerte(e.suerte) + ' · ' + U.fmtTime(e.dur);
        return el('div', { class: 'bt-et' + (!e ? ' no' : e.rota ? ' rota' : ' ok') }, el('b', null, (i + 1) + '. ' + A.nombres[id]), el('span', { class: 'small' }, ' ' + txt));
      }),
      PK.Frente ? el('div', { class: 'row' }, UI.btn('Ver de nuevo', () => { UI.closeModal(); if (PK.Terr.mode) PK.Terr.toggle(false); PK.Frente.repetir(b); }, { small: true, title: 'Repite la batalla en el mapa, acelerada' })) : null);
  }
  UI.frenteEl = function (f) {
    const T = PK.Terr, e = T.estado(f), n = T.nombreFrente(f), A = D.ASEDIO;
    return el('div', { class: 'battle' },
      el('b', null, n.titulo, el('span', { translate: 'no' }, n.otro)), el('span', { class: 'small' }, ' · etapa ' + (e.etapa + 1) + ' de 3: ' + A.nombres[e.id] + ' · quedan aprox. ' + U.fmtTime(e.quedaTotal)),
      el('div', { class: 'g-row' }, el('span', { class: 'small', style: { minWidth: '120px' } }, f.mio === 'atk' ? 'Tu ímpetu' : 'Su ímpetu'), el('div', { class: 'bar thin' }, el('div', { class: 'fill ' + (f.mio === 'atk' ? 'green' : 'red'), style: { width: Math.round(e.impetu * 100) + '%' } }), el('span', null, Math.round(e.impetu * 100) + ' %'))),
      el('div', { class: 'g-row' }, el('span', { class: 'small', style: { minWidth: '120px' } }, f.mio === 'atk' ? 'Su resistencia' : 'Tu resistencia'), el('div', { class: 'bar thin' }, el('div', { class: 'fill ' + (f.mio === 'atk' ? 'red' : 'green'), style: { width: Math.round(e.resistencia * 100) + '%' } }), el('span', null, Math.round(e.resistencia * 100) + ' %'))),
      el('div', { class: 'row' }, UI.btn('Ver la batalla', () => { UI.closeModal(); if (T.mode) T.toggle(false); T.verFrente(f.id); }, { small: true, cls: 'gold' })));
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
        el('li', null, 'Una conquista es un asedio de tres etapas que dura unos minutos y se ve en el mapa: la frontera (la milicia y las parcelas vecinas), las defensas (torres y murallas) y el estandarte (la guarnición). La parcela se va tiñendo con tu avance y solo cambia de dueño cuando cae el estandarte.'),
        el('li', null, 'Conquistar una parcela de otro reino es caro a propósito: la campaña se paga aunque pierdas. Si ganas traes botín y pierdes del 12% al 30% de las tropas (menos cuanto más fuerte vayas); si pierdes, del 70% al 80%.'),
        el('li', null, 'Defender es fácil: la defensa cuenta x1,5 en casa y +25% por cada parcela propia alrededor. Las torres y el Centro Urbano cercanos suman mucho.'),
        el('li', null, 'El corazón de cada reino (las parcelas junto a su Centro Urbano) nunca se puede conquistar. Lo que había en una parcela perdida se desarma y se devuelve completo.'),
        el('li', null, 'Los reinos muy avanzados no pueden atacar a los nuevos: hace falta estar a menos de 2 eras y que el otro tenga al menos la mitad de tu poder.')));
      if (tr.camps.length) {
        body.append(el('h3', null, 'Campañas'));
        for (const c of tr.camps) {
          const info = T.realmInfo(c.slot);
          if (c.phase === 'asedio') { const f = T.frente('c' + c.k); if (f) body.append(UI.frenteEl(f)); continue; }
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
        for (const th of tr.threats) {
          const f = th.plan ? T.frente('t' + th.k) : null;
          body.append(f ? UI.frenteEl(f) : el('div', { class: 'alert' }, T.realmOf(th.slot).realm + ' prepara un ataque a tu frontera (fuerza aprox. ' + th.power + ').'));
        }
      }
      const realms = D.BOTS.filter(b => st.flags['seen_' + b.slot]);
      if (realms.length) {
        body.append(el('h3', null, 'Reinos conocidos'));
        for (const b of realms) {
          const info = T.realmInfo(b.slot), why = D.canConquer(T.myInfo(), info);
          body.append(el('div', { class: 'raid-row' }, el('span', { class: 'swatch', style: { background: 'rgb(' + b.color.join(',') + ')' } }), el('b', null, b.realm), b.human ? el('span', { class: 'tag' }, 'jugador') : null,
            el('span', { class: 'small muted' }, ' Era ' + U.roman(info.era) + ' · ' + W.countParcels(b.slot) + ' parcelas · ' + (why ? why : 'se puede atacar en su frontera')),
            caminoEl(b.slot)));
        }
      }
    }, { wide: true });
  };

  // pk-55: cuánto falta para tocar la frontera de ese reino (solo se ataca una parcela que toque tu tierra)
  function caminoEl(slot) {
    const c = PK.Terr.caminoA(slot);
    if (!c) return el('span', { class: 'small muted' }, ' · sin camino por tierra libre');
    if (!c.n) return el('span', { class: 'small good-t' }, ' · ya tocas su frontera');
    return el('span', { class: 'small' }, ' · te ' + (c.n === 1 ? 'falta 1 parcela' : 'faltan ' + c.n + ' parcelas') + ' para tocar su frontera ',
      UI.btn('Marcar el camino', () => { UI.closeModal(); PK.Terr.marcarCamino(slot); }, { small: true, title: 'Resalta en el mapa las parcelas libres que te acercan' }));
  }
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
      const last = T.lastBattle(k), fr = T.frentes().find(f => f.k === k);
      if (fr) { add(el('p', null, 'Esta parcela está en disputa: hay un asedio en curso y no cambia de dueño hasta que termine.'), UI.frenteEl(fr)); return; }
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
  // pk-41: las carretas siguen rutas que eliges tú (origen, destino y, si quieres, un recurso). Sin ruta quedan paradas.
  const rutaForm = { de: 0, a: 0, res: '' };
  UI.nuevaRutaDesde = function (b, comoDestino) {
    if (comoDestino) rutaForm.a = b.id; else rutaForm.de = b.id;
    UI.openLogistics();
  };
  // pk-54: ícono de un extremo de ruta (un edificio, «cualquier campamento» o «cualquier bodega»)
  const iconoExtremo = (v, res) => {
    const L = PK.Logi;
    if (v === 'campo') return el('span', { class: 'rt-comodin' }, el('img', { class: 'ico', src: Sp.buildingIcon(res === 'wood' ? 'lumber' : res === 'food' ? 'mill' : 'mining'), alt: '' }), res ? UI.resIcon(res) : '');
    if (v === 'bodega') return el('span', { class: 'rt-comodin' }, el('img', { class: 'ico', src: Sp.buildingIcon('warehouse'), alt: '' }), el('b', { class: 'rt-asterisco' }, '*'));
    const b = G().bById.get(v);
    return b ? el('img', { class: 'ico', src: Sp.buildingIcon(b.type, undefined, undefined, b.asp), alt: '' }) : '';
  };
  UI.rutaEl = function (r, compacto) {
    const L = PK.Logi, g = G(), cs = L.cartsDe(r), mala = L.rutaMala(r), rep = L.extremosRep(r), a = rep.from, b = rep.to;
    const T = mala ? null : L.tiempos(r, true);
    const clase = L.claseRuta(r), carro = clase !== 'cart', nom = clase === 'barcaza' ? 'Barcazas' : carro ? 'Carromatos' : 'Carretas';
    const estado = mala || (!T ? 'Calculando el camino…' : !T.ok ? (carro ? 'No hay camino: si tu muralla rodea el destino, necesitas un Gran Portón (los carromatos no caben por una puerta chica).' : 'No hay camino: las carretas no salen de tu territorio. Une los dos edificios por tierra tuya.') : !cs.length ? (carro ? 'Sin carromatos: súmale uno con +.' : 'Sin carretas: súmale una con +.') : cs[0].estado || '');
    const malo = mala || (T && !T.ok) || !cs.length;
    return el('div', { class: 'ruta-row' + (malo ? ' mala' : '') + (carro ? ' carro' : '') },
      el('div', { class: 'ruta-nom' }, iconoExtremo(r.de, r.res), el('b', null, L.nombreExtremo(r.de, r.res)), ' → ',
        iconoExtremo(r.a, r.res), el('b', null, L.nombreExtremo(r.a, r.res)),
        r.res ? (r.de === 'campo' ? '' : el('span', { class: 'small' }, ' · ', UI.resIcon(r.res), ' ' + D.RES[r.res].name.toLowerCase())) : el('span', { class: 'small muted' }, ' · lo que haga falta'),
        L.comodin(r.de) || L.comodin(r.a) ? el('span', { class: 'small muted' }, ' · ahora: ' + (a ? a.def.name : '?') + ' → ' + (b ? b.def.name : '?')) : ''),
      el('div', { class: 'ruta-dat small' }, T && T.ok ? 'Ida ' + Math.round(T.ida) + ' s · vuelta ' + Math.round(T.vuelta) + ' s' + (cs.length ? ' · aprox. ' + Math.round(T.ritmo) + ' por minuto' : '') : '', el('span', { class: malo ? 'warn-t' : 'muted' }, (T && T.ok ? ' · ' : '') + estado)),
      el('div', { class: 'row ruta-btn' },
        el('span', { class: 'small' }, nom + ': '),
        UI.btn('−', () => { L.quitarCarreta(r); UI.rerender(); UI.refreshPanel(true); }, { small: true, disabled: !cs.length, title: carro ? 'Sacar un carromato de esta ruta' : 'Sacar una carreta de esta ruta' }),
        el('b', null, String(cs.length)),
        UI.btn('+', () => { L.sumarCarreta(r); UI.rerender(); UI.refreshPanel(true); }, { small: true, disabled: !!mala, title: carro ? 'Sumar un carromato sin ruta' : 'Sumar una carreta sin ruta' }),
        compacto ? '' : UI.btn('Ver', () => { UI.closeModal(); L.verRuta = r.id; L.verRutaT = performance.now(); if (a && b) PK.Render.centerOn((a.cx + b.cx) / 2, (a.cy + b.cy) / 2); }, { small: true }),
        compacto ? '' : UI.btn('Borrar', () => { L.borrarRuta(r.id); UI.rerender(); }, { small: true, cls: 'danger' })));
  };
  // ---------- Rutas recomendadas (pk-54) ----------
  UI.rutasSugeridas = function (body) {
    const L = PK.Logi, sug = L.sugerencias();
    if (!sug.length) return;
    body.append(el('h3', null, 'Rutas recomendadas'), el('div', { class: 'rt-sugs' }, sug.map(o => {
      if (o.tipo === 'camino') {
        const costo = L.costoCamino(o.tiles.length);
        return el('div', { class: 'rt-sug camino' },
          el('div', { class: 'rt-sug-t' }, el('img', { class: 'ico', src: Sp.icon('hammer'), alt: '' }), el('b', null, o.txt)),
          el('p', { class: 'small muted' }, o.por),
          el('div', { class: 'row' }, UI.costEl(costo), UI.btn('Trazar camino', () => { const n = L.buildRoad(o.tiles); if (n) UI.toast('Camino de ' + n + ' casillas en esa ruta.', 'good'); UI.rerender(); }, { small: true, cls: 'gold', disabled: !G().canAfford(costo) }),
            UI.btn('Ver', () => { const r = S().logi.rutas.find(x => x.id === o.ruta); UI.closeModal(); L.verRuta = o.ruta; L.verRutaT = performance.now(); const e = r && L.extremosRep(r); if (e && e.from && e.to) PK.Render.centerOn((e.from.cx + e.to.cx) / 2, (e.from.cy + e.to.cy) / 2); }, { small: true })));
      }
      const clase = L.claseRuta(o), libres = L.libres(clase).length, nom = clase === 'barcaza' ? 'barcaza' : clase === 'carromato' ? 'carromato' : 'carreta';
      return el('div', { class: 'rt-sug' },
        el('div', { class: 'rt-sug-t' }, iconoExtremo(o.de, o.res), el('span', null, '→'), iconoExtremo(o.a, o.res), el('b', null, o.txt)),
        el('p', { class: 'small muted' }, o.por),
        el('div', { class: 'row' }, el('span', { class: 'small ' + (libres ? 'ok' : 'warn-t') }, libres ? (libres === 1 ? 'Tienes 1 ' + nom + ' libre.' : 'Tienes ' + libres + ' ' + nom + 's libres.') : 'No tienes ' + nom + 's libres: la ruta queda creada y le sumas uno después.'),
          UI.btn('Crear ruta', () => { const r = L.crearRuta(o.de, o.a, o.res); if (r && libres) L.sumarCarreta(r); UI.rerender(); UI.refreshPanel(true); }, { small: true, cls: 'gold' })));
    })));
  };

  // ---------- Nueva ruta (pk-54: fichas en vez de listas desplegables) ----------
  // Tres pasos: de dónde, a dónde y qué lleva. Cada edificio es una ficha con su ícono, lo que guarda y qué tan lejos
  // queda; arriba de todo van los comodines («Cualquier campamento de…», «Cualquier bodega»).
  UI.rutaNueva = function (body) {
    const L = PK.Logi, g = G(), Lb = PK.Libro;
    const mios = f => g.buildings.filter(b => b.owner === 'p' && b.done && f(b));
    const campos = mios(b => L.esCampo(b) && b.type !== 'colonia' && Lb.almacenDe(b) === b);
    const colonias = mios(b => b.type === 'colonia');
    const talleres = mios(b => L.isShop(b) && L.puntoCarreta(b));
    const bodegas = mios(b => L.esBodegaRuta(b));
    const embs = mios(b => b.type === 'embarcadero');
    const resCampos = [...new Set(campos.flatMap(b => (b.def.drop || []).filter(k => L.bodegasRuta(k).length)))].sort((x, y) => D.RES_ORDER.indexOf(x) - D.RES_ORDER.indexOf(y));
    const F = rutaForm, B = v => (L.comodin(v) ? null : g.bById.get(v));
    if (F.de && !L.comodin(F.de) && !B(F.de)) F.de = 0;
    if (F.a && !L.comodin(F.a) && !B(F.a)) F.a = 0;
    const A0 = B(F.de);
    const centro = A0 || null;
    const lejos = b => (centro ? Math.round(Math.hypot(b.cx - centro.cx, b.cy - centro.cy)) + ' casillas' : '');
    const guarda = b => {
      if (L.esCampo(b)) { const inv = Lb.inv(b), ks = Object.keys(inv).filter(k => inv[k] >= 1); return ks.length ? ks.map(k => el('span', { class: 'amt' }, UI.resIcon(k), U.fmt(Math.floor(inv[k])))) : el('span', { class: 'muted' }, 'vacío'); }
      if (L.isShop(b)) { const r = L.recipe(b); return el('span', null, Object.keys(r.in).map(k => UI.resIcon(k)), ' → ', UI.resIcon(L.output(b))); }
      return el('span', { class: 'muted' }, 'bodega');
    };
    const ficha = (v, sel, txt, sub, ico, onclick, extra) => el('button', { class: 'rt-ficha' + (sel ? ' sel' : ''), type: 'button', onclick, 'aria-pressed': sel ? 'true' : 'false' },
      el('span', { class: 'rt-ficha-ico' }, ico), el('span', { class: 'rt-ficha-t' }, el('b', null, txt), sub ? el('span', { class: 'small' }, sub) : '', extra ? el('span', { class: 'small muted' }, extra) : ''));
    const fichaB = (b, sel, onclick, conLejos) => ficha(b.id, sel, b.def.name + ' ' + b.lvl, guarda(b), el('img', { class: 'ico', src: Sp.buildingIcon(b.type, undefined, undefined, b.asp), alt: '' }), onclick, conLejos ? lejos(b) : '');
    const grupo = (titulo, fichas) => (fichas.length ? el('div', { class: 'rt-grupo' }, el('div', { class: 'rt-grupo-t small' }, titulo), el('div', { class: 'rt-fichas' }, fichas)) : '');
    const elegirDe = v => { F.de = F.de === v ? 0 : v; F.a = 0; if (v !== 'campo') F.res = ''; UI.rerender(); };
    const elegirA = v => { F.a = F.a === v ? 0 : v; UI.rerender(); };

    // 1. ¿De dónde?
    const paso1 = el('div', { class: 'rt-paso' }, el('div', { class: 'rt-paso-t' }, el('span', { class: 'rt-num' }, '1'), el('b', null, '¿De dónde sale?')),
      grupo('Comodines', [resCampos.length ? ficha('campo', F.de === 'campo', 'Cualquier campamento', 'el que tenga más', iconoExtremo('campo', F.res || resCampos[0]), () => elegirDe('campo')) : '',
        talleres.length && bodegas.length ? ficha('bodega', F.de === 'bodega', 'Cualquier bodega', 'para llevar a un taller', iconoExtremo('bodega'), () => elegirDe('bodega')) : ''].filter(Boolean)),
      grupo('Campamentos (carromato)', campos.map(b => fichaB(b, F.de === b.id, () => elegirDe(b.id)))),
      grupo('Muelles de colonias (barcaza)', colonias.map(b => fichaB(b, F.de === b.id, () => elegirDe(b.id)))),
      grupo('Talleres (carreta)', talleres.map(b => fichaB(b, F.de === b.id, () => elegirDe(b.id)))),
      grupo('Bodegas (carreta)', bodegas.map(b => fichaB(b, F.de === b.id, () => elegirDe(b.id)))));
    body.append(el('h3', null, 'Nueva ruta'));
    const caja = el('div', { class: 'ruta-nueva rt-armar' }, paso1);
    body.append(caja);
    if (!F.de) { caja.append(el('p', { class: 'small muted' }, 'Elige de dónde sale. Un carromato vacía campamentos; una carreta une talleres y bodegas del pueblo.')); return; }

    // si es «cualquier campamento», primero el recurso
    if (F.de === 'campo') {
      if (!F.res || !resCampos.includes(F.res)) F.res = resCampos[0] || '';
      caja.append(el('div', { class: 'rt-paso' }, el('div', { class: 'rt-paso-t' }, el('span', { class: 'rt-num' }, '·'), el('b', null, '¿De qué campamentos?')),
        el('div', { class: 'rt-chips' }, resCampos.map(k => el('button', { type: 'button', class: 'rt-chip' + (F.res === k ? ' sel' : ''), onclick: () => { F.res = k; F.a = 0; UI.rerender(); } }, UI.resIcon(k), ' ' + D.RES[k].name + ' (' + L.camposDe(k).length + ')')))));
    }
    // 2. ¿A dónde? (solo los destinos que sirven con ese origen)
    const sirve = v => !(L.comodin(F.de) || L.comodin(v) ? L.comodinMalo(F.de, v, F.de === 'campo' ? F.res : null) : L.parMalo(A0, B(v)));
    const dests = { bodega: sirve('bodega'), tall: talleres.filter(b => b.id !== F.de && sirve(b.id)), bods: bodegas.filter(b => b.id !== F.de && sirve(b.id)), embs: embs.filter(b => sirve(b.id)) };
    caja.append(el('div', { class: 'rt-paso' }, el('div', { class: 'rt-paso-t' }, el('span', { class: 'rt-num' }, '2'), el('b', null, '¿A dónde lo lleva?')),
      grupo('Comodín', dests.bodega && F.de !== 'bodega' ? [ficha('bodega', F.a === 'bodega', 'Cualquier bodega', 'la más cercana con lugar', iconoExtremo('bodega'), () => elegirA('bodega'))] : []),
      grupo('Embarcadero', dests.embs.map(b => fichaB(b, F.a === b.id, () => elegirA(b.id), true))),
      grupo('Bodegas', dests.bods.map(b => fichaB(b, F.a === b.id, () => elegirA(b.id), true))),
      grupo('Talleres', dests.tall.map(b => fichaB(b, F.a === b.id, () => elegirA(b.id), true))),
      !dests.bodega && !dests.tall.length && !dests.bods.length && !dests.embs.length ? el('p', { class: 'small warn-t' }, L.comodin(F.de) ? (L.comodinMalo(F.de, 'bodega', F.res) || 'No hay a dónde llevarlo.') : 'No hay a dónde llevar lo de ' + (A0 ? A0.def.name : 'ahí') + '.') : ''));
    if (!F.a) return;

    // 3. ¿Qué lleva?
    const Bd = B(F.a), A = A0;
    const resOps = F.de === 'campo' ? [] : A && L.esCampo(A) ? (A.def.drop || []).filter(k => (Bd ? L.acepta(Bd, k) : L.bodegasRuta(k).length)) : Bd && L.isShop(Bd) ? Object.keys(L.recipe(Bd).in) : A && L.isShop(A) ? [L.output(A)] : [];
    if (F.res && F.de !== 'campo' && !resOps.includes(F.res)) F.res = '';
    if (F.de !== 'campo' && resOps.length > 1) caja.append(el('div', { class: 'rt-paso' }, el('div', { class: 'rt-paso-t' }, el('span', { class: 'rt-num' }, '3'), el('b', null, '¿Qué lleva?')),
      el('div', { class: 'rt-chips' }, [el('button', { type: 'button', class: 'rt-chip' + (!F.res ? ' sel' : ''), onclick: () => { F.res = ''; UI.rerender(); } }, 'Lo que haga falta')].concat(
        resOps.map(k => el('button', { type: 'button', class: 'rt-chip' + (F.res === k ? ' sel' : ''), onclick: () => { F.res = k; UI.rerender(); } }, UI.resIcon(k), ' ' + D.RES[k].name))))));
    const why = L.comodin(F.de) || L.comodin(F.a) ? L.comodinMalo(F.de, F.a, F.res || null) : L.parMalo(A, Bd);
    const prov = { de: F.de, a: F.a, res: F.res || null }, clase = L.claseRuta(prov), libres = L.libres(clase).length;
    caja.append(el('div', { class: 'rt-resumen' },
      el('div', { class: 'ruta-nom' }, iconoExtremo(F.de, F.res), el('b', null, L.nombreExtremo(F.de, F.res)), ' → ', iconoExtremo(F.a, F.res), el('b', null, L.nombreExtremo(F.a, F.res)),
        F.res && F.de !== 'campo' ? el('span', { class: 'small' }, ' · ', UI.resIcon(F.res), ' ' + D.RES[F.res].name.toLowerCase()) : ''),
      why ? el('p', { class: 'small warn-t' }, why) : el('p', { class: 'small muted' }, (clase === 'barcaza' ? 'Barcazas' : clase === 'carromato' ? 'Carromatos' : 'Carretas') + ' libres: ' + libres + (libres ? ' (se le suma uno al crearla).' : '. La ruta queda creada y le sumas uno con + cuando tengas.')),
      el('div', { class: 'row' }, UI.btn('Crear ruta', () => {
        const r = L.crearRuta(F.de, F.a, F.res || null);
        if (!r) return;
        if (L.libres(L.claseRuta(r)).length) L.sumarCarreta(r);
        F.de = F.a = 0; F.res = '';
        UI.rerender(); UI.refreshPanel(true);
      }, { cls: 'gold', disabled: !!why }), UI.btn('Empezar de nuevo', () => { F.de = F.a = 0; F.res = ''; UI.rerender(); }, { small: true }))));
  };
  UI.openLogistics = function () {
    UI.modal('logi', 'Logística', body => {
      const L = PK.Logi, g = G(), st = S();
      const shops = g.buildings.filter(b => b.owner === 'p' && b.done && b.def.recipe);
      const far = shops.filter(b => !L.nearStore(b));
      const sinRuta = L.sinRuta();
      body.append(el('div', { class: 'war-top' },
        el('div', null, el('b', null, 'Carromatos: '), L.carromatos().length + '/' + L.carroMax() + (g.countB('establo') ? '' : ' (construye un Establo de Carromatos)')),
        g.enMar && g.enMar() ? el('div', null, el('b', null, 'Barcazas: '), L.barcazas().length + '/' + L.barcaMax() + (g.countB('embarcadero') ? '' : ' (construye el Embarcadero de colonos)')) : '',
        el('div', null, el('b', null, 'Carretas: '), L.carts().length + '/' + L.cartMax() + (g.countB('cartwright') ? '' : ' (construye una Carretería, Era II)')),
        el('div', { class: sinRuta ? 'warn-t' : '' }, el('b', null, 'Sin ruta: '), String(sinRuta)),
        el('div', null, el('b', null, 'Talleres lejos de un almacén: '), far.length + ' de ' + shops.length),
        el('div', null, el('b', null, 'Cintas: '), st.logi.belts.length)));
      body.append(el('div', { class: 'row' },
        UI.btn('Trazar camino', () => { UI.closeModal(); PK.Logi.tool = 'road'; PK.Input.cancelTool && (PK.Input.roadStart = null); UI.refreshPanel(true); }, { cls: 'gold' }),
        g.enMar && g.enMar() ? '' : UI.btn('Trazar Calzada Real', () => { UI.closeModal(); PK.Logi.tool = 'calzada'; PK.Input.roadStart = null; UI.refreshPanel(true); }, { title: 'Franja de piedra de 2 casillas que usan todos los reinos: carromatos ×3,2, carretas ×2,2, aldeanos ×1,5' }),
        UI.btn('Quitar caminos', () => PK.Despeje.empezar('quitar'), { title: 'Marca una zona y se quitan sus caminos, murallas y Calzada Real (la tuya, o la de otro en tu tierra); vuelve la mitad del material' }),
        UI.btn('Tender cinta', () => { if (!L.beltUnlocked()) { UI.toast(L.beltLockText(), 'warn'); return; } UI.closeModal(); PK.Logi.tool = 'belt'; PK.Logi.beltFrom = null; UI.refreshPanel(true); }, { disabled: !L.beltUnlocked(), title: L.beltUnlocked() ? '' : L.beltLockText() })));

      // ----- Rutas -----
      UI.rutasSugeridas(body);
      body.append(el('h3', null, 'Rutas'));
      if (sinRuta) body.append(el('p', { class: 'small warn-t' }, sinRuta === 1 ? 'Tienes un vehículo parado sin ruta.' : 'Tienes ' + sinRuta + ' vehículos parados sin ruta.', ' Crea una ruta o súmalos con + a una que ya tengas.'));
      const llenos = PK.Libro.campos().filter(b => PK.Libro.campoLleno(b) && !L.rutasDesde(b).some(r => L.cartsDe(r).length));
      if (llenos.length) body.append(el('p', { class: 'small warn-t' }, llenos.length === 1 ? llenos[0].def.name + ' está lleno y ningún carromato lo vacía: sus aldeanos esperan.' : llenos.length + ' campamentos llenos sin carromato: sus aldeanos esperan.'));
      for (const r of st.logi.rutas) body.append(UI.rutaEl(r));
      if (!st.logi.rutas.length) body.append(el('p', { class: 'small muted' }, 'Todavía no tienes rutas. Un carromato lleva lo de un campamento a una bodega del pueblo; una carreta une un taller con una bodega (o con otro taller). Cargan en el origen, llevan al destino y vuelven.'));
      UI.rutaNueva(body);

      body.append(el('h3', null, 'Cómo se mueven las cosas'), el('ul', { class: 'info' },
        el('li', null, 'Cada taller tiene un depósito de entrada y uno de salida. Solo produce con lo que tiene adentro.'),
        el('li', null, 'Si está a 3 casillas o menos de un Almacén o del Centro Urbano, se abastece solo, pero despacio.'),
        el('li', null, 'Lejos de los almacenes lo abastecen las carretas: cada una sigue la ruta que le das. Si en el origen no hay nada que llevar, espera ahí; si el destino está lleno, espera con la carga.'),
        el('li', null, 'Las carretas eligen el camino más rápido, no el más corto: por un camino empedrado van casi tres veces más rápido, aunque den un rodeo.'),
        el('li', null, 'Lo que juntan los campamentos queda en el campamento (hasta su tope) y no sirve para construir: un carromato del Establo lo lleva a una bodega del pueblo o a un taller. Lo que está en cualquier bodega del pueblo sirve en todo el pueblo.'),
        el('li', null, 'Los carromatos salen de tu territorio y van rápido por los caminos, pero no caben por una puerta chica: tu muralla necesita un Gran Portón. Cruzar tierra de otro reino les cuesta cuatro veces más.'),
        el('li', null, 'Las carretas no salen de tu territorio ni van a los campamentos.'),
        el('li', null, 'Las cintas (' + L.beltLockText().replace('Las cintas requieren ', 'requieren ') + ') unen dos edificios y mueven ' + D.BELT.rate + ' unidades por segundo sin que nadie cargue nada.')));
      if (shops.length) {
        body.append(el('h3', null, 'Talleres'));
        for (const b of shops) {
          const r = D.RECIPES[b.def.recipe], cap = L.bufCap(b), out = Object.keys(r.out)[0];
          body.append(el('div', { class: 'work-row' }, el('img', { class: 'ico', src: Sp.buildingIcon(b.type) }), el('b', null, b.def.name + ' ' + b.lvl),
            el('span', { class: 'small muted' }, ' ' + (b.status === 'En reserva' && G().reservaDe(b) ? G().reservaText(G().reservaDe(b)) : b.status || '') + ' · entrada ' + Object.keys(r.in).map(k => Math.floor(b.inb[k] || 0)).join('/') + ' · salida ' + Math.floor(b.outb[out] || 0) + '/' + cap + (L.nearStore(b) ? ' · junto a almacén' : ' · rutas: ' + L.rutasHacia(b).length + ' entran, ' + L.rutasDesde(b).length + ' salen')),
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
  // pk-43 (libro mayor): lo que guarda una bodega del pueblo o un campamento, en su panel.
  UI.stockPanel = function (b) {
    const Lb = PK.Libro, L = PK.Logi;
    if (Lb.esCampo(b)) {
      const tot = Lb.totalCampo(b), cap = Lb.capCampo(b), rs = L.rutasDesde(b), con = rs.some(r => L.cartsDe(r).length);
      const ks = Object.keys(b.inv || {}).filter(k => b.inv[k] >= 1);
      return el('div', { class: 'stock-box' + (tot >= cap - 0.5 ? ' lleno' : '') },
        el('div', { class: 'row' }, el('b', null, 'Guarda: ' + Math.floor(tot) + '/' + cap), el('div', { class: 'bar stock-bar' }, el('div', { class: 'fill' + (tot >= cap - 0.5 ? ' red' : ''), style: { width: Math.min(100, (tot / cap) * 100) + '%' } }))),
        ks.length ? el('div', { class: 'small base-rs' }, ks.map(k => el('span', { class: 'base-res' }, UI.resIcon(k), ' ' + U.fmt(Math.floor(b.inv[k]))))) : '',
        el('p', { class: 'small ' + (con ? 'muted' : 'warn-t') }, con ? 'Lo lleva al pueblo: ' + rs.filter(r => L.cartsDe(r).length).map(r => L.nombreRuta(r)).join(', ') + '.' : (b.type === 'colonia' ? 'Lo que juntan tus colonos no sirve para construir hasta que una barcaza lo lleve a tu isla.' : 'Lo que se junta aquí no sirve para construir hasta que un carromato lo lleve al pueblo.') + (tot >= cap - 0.5 ? ' Está lleno: sus aldeanos esperan.' : '')),
        rs.map(r => UI.rutaEl(r, true)),
        el('div', { class: 'row' }, UI.btn(b.type === 'colonia' ? '+ Ruta de barcaza' : '+ Ruta de carromato', () => {
          const bs = b.type === 'colonia' ? G().buildings.filter(o => o.owner === 'p' && o.done && o.type === 'embarcadero') : Lb.bodegas().concat(G().buildings.filter(o => o.owner === 'p' && o.done && o.type === 'mill' && !L.esCampo(o)));
          const d = bs.filter(o => (b.def.drop || []).some(k => L.acepta(o, k))).sort((x, y) => Math.hypot(x.cx - b.cx, x.cy - b.cy) - Math.hypot(y.cx - b.cx, y.cy - b.cy))[0];
          rutaForm.de = b.id; rutaForm.a = d ? d.id : 0; rutaForm.res = '';
          UI.openLogistics();
        }, { small: true, cls: con ? '' : 'gold' })));
    }
    if (!Lb.esBodega(b)) return '';
    const ks = Object.keys(b.inv || {}).filter(k => b.inv[k] >= 1 && Lb.fisico(k)).sort((x, y) => D.RES_ORDER.indexOf(x) - D.RES_ORDER.indexOf(y));
    if (!ks.length) return el('p', { class: 'small muted' }, 'Bodega vacía. Lo que hay en cualquier bodega del pueblo sirve para construir.');
    return el('div', { class: 'stock-box' }, el('p', { class: 'small' }, el('b', null, 'Guarda aquí'), ' (lo de todas las bodegas sirve en todo el pueblo):'),
      el('div', { class: 'stock-rows' }, ks.map(k => {
        const cap = G().capDe(b, k), v = b.inv[k];
        return el('div', { class: 'stock-row small' }, UI.resIcon(k), el('span', null, U.fmt(Math.floor(v)) + (cap ? '/' + U.fmt(cap) : '')), el('div', { class: 'bar stock-bar' }, el('div', { class: 'fill', style: { width: (cap ? Math.min(100, (v / cap) * 100) : 100) + '%' } })));
      })));
  };
  // Las rutas que salen o llegan a un edificio, para su panel.
  UI.rutasPanel = function (b) {
    const L = PK.Logi;
    if (!L.puntoCarreta(b) || !b.done) return '';
    const rs = L.rutasDesde(b).concat(L.rutasHacia(b));
    return el('div', { class: 'rutas-panel' },
      el('p', { class: 'small' }, el('b', null, 'Rutas de carretas: '), rs.length ? '' : 'ninguna.'),
      rs.map(r => UI.rutaEl(r, true)),
      el('div', { class: 'row' }, UI.btn('+ Ruta desde aquí', () => UI.nuevaRutaDesde(b), { small: true }), UI.btn('+ Ruta hacia aquí', () => UI.nuevaRutaDesde(b, true), { small: true })));
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
