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
    for (const e of p.etapas) hechas[e.id] = Object.assign({}, e, { dur: e.dur + (hechas[e.id] ? hechas[e.id].dur : 0) }); // G4: una etapa puede venir en tramos
    const NA = { tactica: 'cambio de táctica', refuerzo: 'llegaron refuerzos', salida: 'salida de la guarnición', retirada: 'retirada', rendir: 'la parcela se rindió' };
    return el('div', { class: 'bt-etapas' },
      A.etapas.map((id, i) => {
        const e = hechas[id];
        const txt = !e ? 'no se llegó' : e.r < 1 ? 'sin defensas' : e.rota ? 'aquí se quebró el ataque (' + Math.round(e.f1 * 100) + ' %)' : D.asedioSuerte(e.suerte) + ' · ' + U.fmtTime(e.dur);
        return el('div', { class: 'bt-et' + (!e ? ' no' : e.rota ? ' rota' : ' ok') }, el('b', null, (i + 1) + '. ' + A.nombres[id]), el('span', { class: 'small' }, ' ' + txt));
      }),
      p.acc && p.acc.length ? el('div', { class: 'small' }, 'Decisiones: ' + p.acc.map(x => NA[x.tipo] + ' (' + U.fmtTime(x.t) + ')').join(', ') + '.') : null,
      PK.Frente ? el('div', { class: 'row' }, UI.btn('Ver de nuevo', () => { UI.closeModal(); if (PK.Terr.mode) PK.Terr.toggle(false); PK.Terr.verRepeticion(b); }, { small: true, title: 'Repite la batalla en el mapa, acelerada' })) : null);
  }
  UI.frenteEl = function (f) {
    const T = PK.Terr, e = T.estado(f), n = T.nombreFrente(f), A = D.ASEDIO;
    const cp = f.mio === 'atk' ? PK.Game.state.terr.camps.find(c => 'c' + c.k === f.id) : null, ref = cp && cp.ref;
    return el('div', { class: 'battle' },
      el('b', null, n.titulo, el('span', { translate: 'no' }, n.otro)), el('span', { class: 'small' }, ' · etapa ' + (e.etapa + 1) + ' de 3: ' + A.nombres[e.id] + (f.plan.parcial ? ' · esta etapa termina en ' + U.fmtTime(e.queda) : ' · quedan aprox. ' + U.fmtTime(e.quedaTotal))),
      el('div', { class: 'g-row' }, el('span', { class: 'small', style: { minWidth: '120px' } }, f.mio === 'atk' ? 'Tu ímpetu' : f.mio === 'ver' ? 'Ímpetu del ataque' : 'Su ímpetu'), el('div', { class: 'bar thin' }, el('div', { class: 'fill ' + (f.mio === 'atk' ? 'green' : 'red'), style: { width: Math.round(e.impetu * 100) + '%' } }), el('span', null, Math.round(e.impetu * 100) + ' %'))),
      el('div', { class: 'g-row' }, el('span', { class: 'small', style: { minWidth: '120px' } }, f.mio === 'atk' ? 'Su resistencia' : f.mio === 'ver' ? 'Resistencia' : 'Tu resistencia'), el('div', { class: 'bar thin' }, el('div', { class: 'fill ' + (f.mio === 'atk' ? 'red' : 'green'), style: { width: Math.round(e.resistencia * 100) + '%' } }), el('span', null, Math.round(e.resistencia * 100) + ' %'))),
      f.plan.tac && D.ASEDIO.tacticas[f.plan.tac] ? el('p', { class: 'small' }, 'Táctica del atacante: ', el('b', null, D.ASEDIO.tacticas[f.plan.tac].nombre), '.') : null,
      ref ? el('p', { class: 'small' }, ref.ok ? 'Los refuerzos ya pelean.' : 'Refuerzos en camino: llegan en ' + U.fmtTime(Math.max(0, (ref.llega - Date.now()) / 1000)) + '.') : null,
      el('div', { class: 'row' }, UI.btn('Ver la batalla', () => { UI.closeModal(); if (T.mode) T.toggle(false); T.verFrente(f.id); }, { small: true, cls: 'gold' }),
        T.acciones(f).map(a => UI.btn(a.txt, () => UI.accionAsedio(f, a), { small: true, cls: a.peligro ? 'danger' : '', title: a.title }))));
  };
  // G4: una decisión del asedio. Las que no tienen vuelta atrás se confirman; los refuerzos abren el selector de tropas.
  UI.accionAsedio = function (f, a) {
    const T = PK.Terr;
    if (a.tipo === 'refuerzo') {
      UI.modal('refuerzo', 'Refuerzos para el asedio', body => {
        const w = PK.Game.state.war, pk = armyPicker(w, 'rf-');
        body.append(el('p', null, a.title), el('p', { class: 'small' }, 'Pelean con su oficio: jinetes y caballeros rinden más en la frontera, catapultas y ballesteros contra las defensas, lanceros, monjes y clérigos en el estandarte.'),
          el('div', { class: 'row' }, pk.box),
          el('div', { class: 'row' }, UI.btn('Enviar', () => { if (T.accion(f.id, a, pk.read())) UI.closeModal(); }, { cls: 'gold' }), UI.btn('Cancelar', () => UI.closeModal(), { small: true })));
      });
      return;
    }
    if (a.peligro && !confirm(a.txt + ': ' + a.title + '\n\n¿Seguro?')) return;
    T.accion(f.id, a);
  };
  // G8: qué tropas llevar según la etapa que más pesa en la defensa de esa parcela (lo que dice el Mariscal)
  UI.mezclaSugerida = function (parts) {
    const A = D.ASEDIO, peso = A.etapas.map(id => A.partes[id].reduce((s, k) => s + (parts[k] || 0), 0)), i = peso.indexOf(Math.max(...peso));
    const quien = [['caballeros y jinetes', 'rider'], [parts.walls > 0 ? 'arietes, catapultas y ballesteros' : 'catapultas y ballesteros (sin murallas, el ariete no rinde)', 'catapult'], ['lanceros, monjes y clérigos', 'spear']][i];
    return 'lo más duro es ' + A.nombres[A.etapas[i]].toLowerCase() + ' (' + Math.round((peso[i] / Math.max(1, parts.total)) * 100) + ' % de su defensa): lleva ' + quien[0] + '.';
  };
  // G7: la Ciudadela del mundo, que sitian los gremios
  UI.openCiudadela = function () {
    UI.modal('ciud', D.CIUDADELA.nombre, body => {
      const M = PK.Mundo, st = PK.Game.state, C = D.CIUDADELA, z = PK.Fort.ciudadela(), c = M && M.ciud;
      const add = (...a) => body.append(...a.filter(Boolean));
      add(el('p', null, 'Una fortaleza enorme en tierra de todos. Cada semana los gremios la sitian: cada miembro manda una campaña al día y su fuerza se suma al ímpetu de su gremio. El lunes la ocupa el gremio con más ímpetu: su estandarte ondea aquí toda la semana y sus miembros le venden al Mercado con un ' + Math.round(C.bono * 100) + ' % más de oro.'));
      if (!PK.Net || !PK.Net.online) { add(el('p', { class: 'small warn-t' }, 'La Ciudadela solo se disputa en el mundo compartido (en línea).')); return; }
      if (!c) { add(el('p', { class: 'small muted' }, 'Cargando…')); return; }
      add(el('p', null, c.gname ? el('span', null, 'Esta semana la ocupa ', el('b', { translate: 'no' }, c.gname), M.ciudMia() ? ' (¡tu gremio!).' : '.') : 'Nadie la ocupa todavía.'),
        el('p', { class: 'small muted' }, 'El asedio de esta semana termina en ' + U.fmtTime(Math.max(0, (c.fin - Date.now()) / 1000)) + '.'),
        c.top.length ? el('ol', { class: 'rank' }, c.top.map(t => el('li', { class: st.guild && st.guild.id === t.gid ? 'me' : '' }, el('span', { translate: 'no' }, t.name), el('span', null, U.fmt(t.imp) + ' de ímpetu')))) : el('p', { class: 'small' }, 'Ningún gremio mandó tropas esta semana.'));
      const hoy = D.semana(Date.now()) + ':' + new Date().toISOString().slice(0, 10);
      const why = !st.guild || !st.guild.joined ? 'Únete a un gremio para sitiarla.' : st.era < C.era ? 'Sitiarla requiere la Era ' + U.roman(C.era) + '.' : M.hoy === hoy ? 'Ya mandaste tu campaña de hoy.' : null;
      if (why) { add(el('p', { class: 'small warn-t' }, why)); }
      else {
        const pk = armyPicker(st.war, 'cd-');
        add(el('p', { class: 'small' }, 'Pierdes el ' + Math.round(C.bajas * 100) + ' % de las tropas que mandes.'), el('div', { class: 'row' }, pk.box),
          el('div', { class: 'row' }, UI.btn('Mandar campaña', async () => { if (await M.sitiarCiudadela(pk.read())) UI.rerender(); }, { cls: 'gold' })));
      }
      if (z) add(el('div', { class: 'row' }, UI.btn('Ver en el mapa', () => { UI.closeModal(); PK.Render.centerOn(z.cx, z.cy); }, { small: true })));
    });
  };
  // G7: el diario de guerra del mundo (lo que contó el servidor)
  function diarioEl() {
    const M = PK.Mundo, lista = (M && M.diario) || [];
    if (!PK.Net || !PK.Net.online || !lista.length) return null;
    return el('div', null, el('h3', null, 'Diario de guerra del mundo'),
      lista.slice(0, 10).map(e => el('div', { class: 'raid-row' },
        el('span', { class: 'small' }, el('b', { translate: 'no' }, e.deN), e.gano ? ' tomó una parcela de ' : ' no pudo con ', el('b', { translate: 'no' }, e.aN), ' · hace ' + U.fmtTime(Math.max(0, (Date.now() - e.at) / 1000))),
        e.plan && PK.Frente ? UI.btn('Ver', () => { UI.closeModal(); if (PK.Terr.mode) PK.Terr.toggle(false); PK.Terr.verRepeticion({ k: e.k, rep: { plan: e.plan, units: e.units, lado: e.lado || 0, de: e.de, a: e.a } }); }, { small: true }) : null)));
  }
  // G6: la ventana de una fortaleza
  UI.openFort = function (id) {
    UI.modal('fort', 'Fortaleza', body => {
      const F = PK.Fort, T = PK.Terr, o = F.lista()[id], e = F.de(id), st = PK.Game.state, fo = F.ensure(), C = D.FORT;
      const add = (...a) => body.append(...a.filter(Boolean));
      add(el('p', null, el('b', null, o.nombre), ' · nivel ' + e.lvl + ' · ' + (e.mia ? 'es tuya' : 'en manos de ' + D.ENEMY[o.enemigo].name.toLowerCase())));
      const fr = T.frentes().find(f => f.fort && f.fort.id === id);
      if (fr) { add(UI.frenteEl(fr)); return; }
      if (e.mia) {
        add(el('p', { class: 'small' }, 'Tributo: ' + U.fmt(C.tributo(st.era, e.lvl)) + ' de oro por día. Cada ' + C.contra[0] + ' a ' + C.contra[1] + ' días una hueste viene a recuperarla y la defiendes con sus muros y tu ejército en casa (' + U.fmt(F.defensa(id).total) + ' de defensa ahora). Si la pierdes, vuelve un nivel más fuerte.'),
          fo.asalto && fo.asalto.id === id ? el('div', { class: 'alert' }, 'Una hueste viene en camino: llega en ' + U.fmtTime(Math.max(0, (fo.asalto.at - Date.now()) / 1000)) + ' con una fuerza de aprox. ' + U.fmt(fo.asalto.power) + '.') : el('p', { class: 'small muted' }, 'Próximo intento de recuperarla: en ' + U.fmtTime(Math.max(0, (e.prox - Date.now()) / 1000)) + '.'),
          el('h3', null, e.bono ? 'Bono elegido' : 'Elige su bono'),
          el('div', { class: 'row' }, Object.keys(C.bonos).map(b => UI.btn(C.bonos[b].nombre, () => { F.elegirBono(id, b); UI.rerender(); }, { small: true, cls: e.bono === b ? 'gold' : '', title: C.bonos[b].txt }))),
          e.bono ? el('p', { class: 'small' }, C.bonos[e.bono].txt + ' Puedes cambiarlo cuando quieras.') : el('p', { class: 'small warn-t' }, 'Todavía no elegiste: la fortaleza no da bono hasta que elijas.'));
      } else {
        const why = F.puedeSitiar(id), w = st.war, fz = F.fuerza(id);
        add(el('p', { class: 'small' }, D.ENEMY[o.enemigo].desc),
          el('p', { class: 'small' }, 'Fuerza de la guarnición: aprox. ' + U.fmt(fz) + '. Tu ejército en casa vale ' + U.fmt(F.fuerzaContra(id, w.army)) + ' contra ' + D.ENEMY[o.enemigo].name.toLowerCase() + '.'),
          el('div', { class: 'row' }, el('b', null, 'Botín si la tomas: '), UI.costEl(C.botin(st.era, e.lvl), 1, true)),
          el('p', { class: 'small' }, 'Es un asedio de tres etapas (la empalizada, la torre del homenaje y el estandarte), como una conquista, pero contra monstruos: cuentan los bonos de tus tropas contra ese enemigo. No cuesta recursos, solo las tropas que caigan. Tomada, te da un tributo diario y un bono a elección.'));
        if (fo.sitio) add(el('p', { class: 'small muted' }, fo.sitio.phase === 'go' ? 'Tus tropas marchan a ' + F.lista()[fo.sitio.id].nombre + ': llegan en ' + U.fmtTime(Math.max(0, (fo.sitio.arrive - Date.now()) / 1000)) + '.' : 'Tus tropas vuelven del sitio.'));
        if (why) { add(el('p', { class: 'small warn-t' }, why)); }
        else {
          const pk = armyPicker(w, 'ft-');
          add(el('div', { class: 'row' }, pk.box), el('div', { class: 'row' }, UI.btn('Sitiar', () => { if (F.sitiar(id, pk.read())) UI.closeModal(); else UI.rerender(); }, { cls: 'danger' })));
        }
      }
      add(el('div', { class: 'row' }, UI.btn('Ver en el mapa', () => { UI.closeModal(); if (T.mode) T.toggle(false); PK.Render.centerOn(o.cx, o.cy); }, { small: true })));
    });
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
        el('li', null, 'Una de cada cuatro parcelas es una comarca (en el mapa de territorio se ve su ícono): ' + Object.keys(D.COMARCAS).map(c => D.COMARCAS[c].icono + ' ' + D.COMARCAS[c].nombre).join(', ') + '. Toca la parcela para ver qué da. El Fuerte fronterizo defiende todo lo que tenga a 2 parcelas.'),
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
      // G3: asedios entre jugadores que no son campañas tuyas (te asedian a ti, o los ves de lejos)
      const ajenos = T.frentes().filter(f => f.id[0] === 'r');
      if (ajenos.length) {
        body.append(el('h3', null, 'Asedios en el mundo'));
        for (const f of ajenos) body.append(UI.frenteEl(f));
      }
      if (tr.threats.length) {
        body.append(el('h3', null, 'Amenazas'));
        for (const th of tr.threats) {
          const f = th.plan ? T.frente('t' + th.k) : null;
          body.append(f ? UI.frenteEl(f) : el('div', { class: 'alert' }, T.realmOf(th.slot).realm + ' prepara un ataque a tu frontera (fuerza aprox. ' + th.power + '). ',
            UI.btn('Pagar tributo', () => T.pagarTributo(th), { small: true, title: 'Su hueste se vuelve sin pelear' }), ' ', UI.costEl({ gold: T.tributoDe(th) })));
        }
      }
      const dg = diarioEl(); if (dg) body.append(dg);
      if (PK.Net && PK.Net.online && PK.Fort && PK.Fort.ciudadela()) body.append(el('div', { class: 'row' }, UI.btn(PK.Fort.tituloCiudadela(), () => UI.openCiudadela(), { small: true, cls: 'gold' })));
      // G6: las fortalezas que ya viste
      const forts = PK.Fort ? PK.Fort.lista().filter(o => T.explored(o.k)) : [];
      if (forts.length) {
        body.append(el('h3', null, 'Fortalezas'));
        for (const o of forts) body.append(el('div', { class: 'raid-row' }, el('b', null, o.nombre), el('span', { class: 'small muted' }, ' ' + PK.Fort.titulo(o).split(' · ').slice(1).join(' · ')), UI.btn('Abrir', () => UI.openFort(o.id), { small: true })));
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
      const cm = T.comarca(k); // G5
      if (cm) add(el('div', { class: 'comarca' }, el('b', null, cm.icono + ' Comarca: ' + cm.nombre), el('span', { class: 'small' }, ' · ' + cm.txt + ' Conquistarla da un 50 % más de botín.')));
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
      if (st.flags.guiaGuerra === 2) { st.flags.guiaGuerra = 3; UI.toast('Tobías: «Eso es: su defensa y de dónde sale. Si la etapa más dura son las defensas, lleve catapultas; si es el estandarte, lanceros.»', 'info'); } // G8
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
      const pk = armyPicker(w, 'cq-'), TA = D.ASEDIO.tacticas;
      const tacSel = el('select', { id: 'cq-tac', title: 'Se puede cambiar una vez durante el asedio' }, el('option', { value: '' }, 'Sin táctica: ritmo normal'), Object.keys(TA).map(t => el('option', { value: t }, TA[t].nombre + ': ' + TA[t].txt)));
      add(el('div', { class: 'row' }, pk.box),
        el('div', { class: 'row' }, el('b', null, 'Táctica: '), tacSel),
        PK.Consejo && PK.Consejo.activo('mariscal') ? el('p', { class: 'small good-t' }, 'El Mariscal: ' + UI.mezclaSugerida(T.defenseParts(k, slot))) : null,
        el('p', { class: 'small' }, 'Cada tropa tiene su oficio: jinetes y caballeros rinden más en la frontera; catapultas, ballesteros, arietes (si hay murallas) y torres de asedio contra las defensas (los arqueros, menos); lanceros, monjes y clérigos en el estandarte. Durante el asedio puedes cambiar de táctica, mandar refuerzos o retirarte.'),
        el('div', { class: 'row' }, UI.btn('Lanzar campaña', () => { if (T.attack(k, pk.read(), tacSel.value || null)) UI.closeModal(); else UI.rerender(); }, { cls: 'danger' }), UI.btn('Ver en el mapa', () => { UI.closeModal(); PK.Render.centerOn(cx, cy); }, { small: true })));
    });
  };

  // ---------- Logística ----------
  // pk-41: las carretas siguen rutas que eliges tú (origen, destino y, si quieres, un recurso). Sin ruta quedan paradas.
  const rutaForm = { de: 0, a: 0, res: '', tipo: '' };
  UI.nuevaRutaDesde = function (b, comoDestino) {
    if (comoDestino) rutaForm.a = b.id; else rutaForm.de = b.id;
    UI.openLogistics();
  };
  // pk-54: ícono de un extremo de ruta (un edificio, «cualquier campamento» o «cualquier bodega»)
  const iconoExtremo = (v, res, tipo) => {
    const L = PK.Logi;
    if (v === 'campo') return el('span', { class: 'rt-comodin' }, el('img', { class: 'ico', src: Sp.buildingIcon(tipo || L.tipoDeRes(res) || 'mining'), alt: '' }), res ? UI.resIcon(res) : el('b', { class: 'rt-asterisco' }, '*'));
    if (v === 'bodega') return el('span', { class: 'rt-comodin' }, el('img', { class: 'ico', src: Sp.buildingIcon('warehouse'), alt: '' }), el('b', { class: 'rt-asterisco' }, '*'));
    if (L.esTallerComodin(v)) return el('span', { class: 'rt-comodin' }, el('img', { class: 'ico', src: Sp.buildingIcon(L.tipoTaller(v)), alt: '' }), el('b', { class: 'rt-asterisco' }, '*'));
    const b = G().bById.get(v);
    return b ? el('img', { class: 'ico', src: Sp.buildingIcon(b.type, undefined, undefined, b.asp), alt: '' }) : '';
  };
  UI.rutaEl = function (r, compacto) {
    const L = PK.Logi, g = G(), cs = L.cartsDe(r), mala = L.rutaMala(r), rep = L.extremosRep(r), a = rep.from, b = rep.to;
    const T = mala ? null : L.tiempos(r, true);
    const clase = L.claseRuta(r), carro = clase !== 'cart', nom = clase === 'barcaza' ? 'Barcazas' : carro ? 'Carromatos' : 'Carretas';
    const estado = mala || (!T ? 'Calculando el camino…' : !T.ok ? (carro ? 'No hay camino: si tu muralla rodea el destino, necesitas un Gran Portón (los carromatos no caben por una puerta chica). Las cintas también les cortan el paso: déjales un hueco o usa un paso elevado.' : 'No hay camino: las carretas no salen de tu territorio ni cruzan cintas. Une los dos edificios por tierra tuya, dejando un hueco en las cintas o con un paso elevado.') : !cs.length ? (carro ? 'Sin carromatos: súmale uno con +.' : 'Sin carretas: súmale una con +.') : cs[0].estado || '');
    const malo = mala || (T && !T.ok) || !cs.length;
    return el('div', { class: 'ruta-row' + (malo ? ' mala' : '') + (carro ? ' carro' : '') },
      el('div', { class: 'ruta-nom' }, iconoExtremo(r.de, r.res, r.tipo), el('b', null, L.nombreExtremo(r.de, r.res, r.tipo)), ' → ',
        iconoExtremo(r.a, r.res), el('b', null, L.nombreExtremo(r.a, r.res)),
        r.res ? (r.de === 'campo' ? '' : el('span', { class: 'small' }, ' · ', UI.resIcon(r.res), ' ' + D.RES[r.res].name.toLowerCase())) : el('span', { class: 'small muted' }, r.de === 'campo' ? ' · de todo lo que junten' : ' · lo que haga falta'),
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
        el('div', { class: 'rt-sug-t' }, iconoExtremo(o.de, o.res, o.ctipo), el('span', null, '→'), iconoExtremo(o.a, o.res), el('b', null, o.txt)),
        el('p', { class: 'small muted' }, o.por),
        el('div', { class: 'row' }, el('span', { class: 'small ' + (libres ? 'ok' : 'warn-t') }, libres ? (libres === 1 ? 'Tienes 1 ' + nom + ' libre.' : 'Tienes ' + libres + ' ' + nom + 's libres.') : 'No tienes ' + nom + 's libres: la ruta queda creada y le sumas uno después.'),
          UI.btn('Crear ruta', () => { const r = L.crearRuta(o.de, o.a, o.res, o.ctipo); if (r && libres) L.sumarCarreta(r); UI.rerender(); UI.refreshPanel(true); }, { small: true, cls: 'gold' })));
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
    // pk-55: los tipos de campamento que tienes (y cuyo botín alguna bodega recibe)
    const dropsDe = t => (D.BUILD[t].drop || []).filter(k => L.bodegasRuta(k).length);
    const tiposCampos = L.TIPOS_CAMPO.filter(t => L.camposDe(null, t).length && dropsDe(t).length);
    // pk-57: los tipos de taller de los que tienes dos o más («Cualquier Aserradero»)
    const tiposTaller = [...new Set(talleres.map(b => b.type))].filter(t => L.talleresDe(t).length >= 2);
    const nomT = t => 'Cualquier ' + D.BUILD[t].name;
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
    const elegirDe = v => { F.de = F.de === v ? 0 : v; F.a = 0; if (v !== 'campo') F.res = F.tipo = ''; UI.rerender(); };
    const elegirA = v => { F.a = F.a === v ? 0 : v; UI.rerender(); };

    // 1. ¿De dónde?
    const paso1 = el('div', { class: 'rt-paso' }, el('div', { class: 'rt-paso-t' }, el('span', { class: 'rt-num' }, '1'), el('b', null, '¿De dónde sale?')),
      grupo('Comodines', [tiposCampos.length ? ficha('campo', F.de === 'campo', 'Cualquier campamento', 'el que tenga más; trae de todo', iconoExtremo('campo', null, F.tipo || tiposCampos[0]), () => elegirDe('campo')) : '',
        talleres.length && bodegas.length ? ficha('bodega', F.de === 'bodega', 'Cualquier bodega', 'para llevar a un taller', iconoExtremo('bodega'), () => elegirDe('bodega')) : ''].concat(
        tiposTaller.map(t => ficha('taller:' + t, F.de === 'taller:' + t, nomT(t), 'el que tenga más hecho', iconoExtremo('taller:' + t), () => elegirDe('taller:' + t)))).filter(Boolean)),
      grupo('Campamentos (carromato)', campos.map(b => fichaB(b, F.de === b.id, () => elegirDe(b.id)))),
      grupo('Muelles de colonias (barcaza)', colonias.map(b => fichaB(b, F.de === b.id, () => elegirDe(b.id)))),
      grupo('Talleres (carreta)', talleres.map(b => fichaB(b, F.de === b.id, () => elegirDe(b.id)))),
      grupo('Bodegas (carreta)', bodegas.map(b => fichaB(b, F.de === b.id, () => elegirDe(b.id)))));
    body.append(el('h3', null, 'Nueva ruta'));
    const caja = el('div', { class: 'ruta-nueva rt-armar' }, paso1);
    body.append(caja);
    if (!F.de) { caja.append(el('p', { class: 'small muted' }, 'Elige de dónde sale. Un carromato vacía campamentos; una carreta une talleres y bodegas del pueblo.')); return; }

    // si es «cualquier campamento», primero de qué tipo; con varios recursos (el minero), todo o solo uno (pk-55)
    if (F.de === 'campo') {
      if (!F.tipo || !tiposCampos.includes(F.tipo)) F.tipo = tiposCampos[0] || '';
      const ds = F.tipo ? dropsDe(F.tipo) : [];
      if (F.res && !ds.includes(F.res)) F.res = '';
      const TIPO_CORTO = { lumber: 'Madereros', mining: 'Mineros', mill: 'Molinos de afuera' };
      caja.append(el('div', { class: 'rt-paso' }, el('div', { class: 'rt-paso-t' }, el('span', { class: 'rt-num' }, '·'), el('b', null, '¿De qué campamentos?')),
        el('div', { class: 'rt-chips' }, tiposCampos.map(t => el('button', { type: 'button', class: 'rt-chip' + (F.tipo === t ? ' sel' : ''), onclick: () => { F.tipo = t; F.res = ''; F.a = 0; UI.rerender(); } }, el('img', { class: 'ico', src: Sp.buildingIcon(t), alt: '' }), ' ' + TIPO_CORTO[t] + ' (' + L.camposDe(null, t).length + ')'))),
        ds.length > 1 ? el('div', { class: 'rt-chips' }, [el('button', { type: 'button', class: 'rt-chip' + (!F.res ? ' sel' : ''), onclick: () => { F.res = ''; F.a = 0; UI.rerender(); } }, ds.map(k => UI.resIcon(k)), ' Todo lo que junten')].concat(
          ds.map(k => el('button', { type: 'button', class: 'rt-chip' + (F.res === k ? ' sel' : ''), onclick: () => { F.res = k; F.a = 0; UI.rerender(); } }, UI.resIcon(k), ' Solo ' + D.RES[k].name.toLowerCase())))) : '',
        ds.length > 1 && !F.res ? el('p', { class: 'small muted' }, 'Cada carromato carga de todo a la vez (lo que más haya primero) y lo deja en una bodega que lo reciba.') : ''));
    }
    // 2. ¿A dónde? (solo los destinos que sirven con ese origen)
    const sirve = v => !(L.comodin(F.de) || L.comodin(v) ? L.comodinMalo(F.de, v, F.de === 'campo' ? F.res || null : null, F.de === 'campo' ? F.tipo : null) : L.parMalo(A0, B(v)));
    const dests = { bodega: sirve('bodega'), tipos: tiposTaller.filter(t => 'taller:' + t !== F.de && sirve('taller:' + t)), tall: talleres.filter(b => b.id !== F.de && sirve(b.id)), bods: bodegas.filter(b => b.id !== F.de && sirve(b.id)), embs: embs.filter(b => sirve(b.id)) };
    caja.append(el('div', { class: 'rt-paso' }, el('div', { class: 'rt-paso-t' }, el('span', { class: 'rt-num' }, '2'), el('b', null, '¿A dónde lo lleva?')),
      grupo('Comodines', (dests.bodega && F.de !== 'bodega' ? [ficha('bodega', F.a === 'bodega', 'Cualquier bodega', 'la más cercana con lugar', iconoExtremo('bodega'), () => elegirA('bodega'))] : []).concat(
        dests.tipos.map(t => ficha('taller:' + t, F.a === 'taller:' + t, nomT(t), 'el que tenga menos', iconoExtremo('taller:' + t), () => elegirA('taller:' + t))))),
      grupo('Embarcadero', dests.embs.map(b => fichaB(b, F.a === b.id, () => elegirA(b.id), true))),
      grupo('Bodegas', dests.bods.map(b => fichaB(b, F.a === b.id, () => elegirA(b.id), true))),
      grupo('Talleres', dests.tall.map(b => fichaB(b, F.a === b.id, () => elegirA(b.id), true))),
      !dests.bodega && !dests.tipos.length && !dests.tall.length && !dests.bods.length && !dests.embs.length ? el('p', { class: 'small warn-t' }, L.comodin(F.de) ? (L.comodinMalo(F.de, 'bodega', F.res || null, F.tipo || null) || 'No hay a dónde llevarlo.') : 'No hay a dónde llevar lo de ' + (A0 ? A0.def.name : 'ahí') + '.') : ''));
    if (!F.a) return;

    // 3. ¿Qué lleva?
    const muestra = v => (L.esTallerComodin(v) ? L.talleresDe(L.tipoTaller(v))[0] || null : B(v)); // pk-57
    const Bd = muestra(F.a), A = A0 || muestra(F.de);
    const resOps = F.de === 'campo' ? [] : A && L.esCampo(A) ? (A.def.drop || []).filter(k => (Bd ? L.acepta(Bd, k) : L.bodegasRuta(k).length)) : Bd && L.isShop(Bd) ? Object.keys(L.recipe(Bd).in) : A && L.isShop(A) ? [L.output(A)] : [];
    if (F.res && F.de !== 'campo' && !resOps.includes(F.res)) F.res = '';
    if (F.de !== 'campo' && resOps.length > 1) caja.append(el('div', { class: 'rt-paso' }, el('div', { class: 'rt-paso-t' }, el('span', { class: 'rt-num' }, '3'), el('b', null, '¿Qué lleva?')),
      el('div', { class: 'rt-chips' }, [el('button', { type: 'button', class: 'rt-chip' + (!F.res ? ' sel' : ''), onclick: () => { F.res = ''; UI.rerender(); } }, 'Lo que haga falta')].concat(
        resOps.map(k => el('button', { type: 'button', class: 'rt-chip' + (F.res === k ? ' sel' : ''), onclick: () => { F.res = k; UI.rerender(); } }, UI.resIcon(k), ' ' + D.RES[k].name))))));
    const tipoF = F.de === 'campo' ? F.tipo || null : null;
    const why = L.comodin(F.de) || L.comodin(F.a) ? L.comodinMalo(F.de, F.a, F.res || null, tipoF) : L.parMalo(A, Bd);
    const prov = { de: F.de, a: F.a, res: F.res || null, tipo: tipoF }, clase = L.claseRuta(prov), libres = L.libres(clase).length;
    caja.append(el('div', { class: 'rt-resumen' },
      el('div', { class: 'ruta-nom' }, iconoExtremo(F.de, F.res, tipoF), el('b', null, L.nombreExtremo(F.de, F.res, tipoF)), ' → ', iconoExtremo(F.a, F.res), el('b', null, L.nombreExtremo(F.a, F.res)),
        F.res && F.de !== 'campo' ? el('span', { class: 'small' }, ' · ', UI.resIcon(F.res), ' ' + D.RES[F.res].name.toLowerCase()) : F.de === 'campo' && !F.res ? el('span', { class: 'small muted' }, ' · de todo lo que junten') : ''),
      why ? el('p', { class: 'small warn-t' }, why) : el('p', { class: 'small muted' }, (clase === 'barcaza' ? 'Barcazas' : clase === 'carromato' ? 'Carromatos' : 'Carretas') + ' libres: ' + libres + (libres ? ' (se le suma uno al crearla).' : '. La ruta queda creada y le sumas uno con + cuando tengas.')),
      el('div', { class: 'row' }, UI.btn('Crear ruta', () => {
        const r = L.crearRuta(F.de, F.a, F.res || null, tipoF);
        if (!r) return;
        if (L.libres(L.claseRuta(r)).length) L.sumarCarreta(r);
        F.de = F.a = 0; F.res = F.tipo = '';
        UI.rerender(); UI.refreshPanel(true);
      }, { cls: 'gold', disabled: !!why }), UI.btn('Empezar de nuevo', () => { F.de = F.a = 0; F.res = F.tipo = ''; UI.rerender(); }, { small: true }))));
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
        el('div', null, el('b', null, 'Cintas: '), Object.keys((st.logi.red && st.logi.red.t) || {}).length + ' casillas')));
      body.append(el('div', { class: 'row' },
        UI.btn('Trazar camino', () => { UI.closeModal(); PK.Logi.tool = 'road'; PK.Input.cancelTool && (PK.Input.roadStart = null); UI.refreshPanel(true); }, { cls: 'gold' }),
        g.enMar && g.enMar() ? '' : UI.btn('Trazar Calzada Real', () => { UI.closeModal(); PK.Logi.tool = 'calzada'; PK.Input.roadStart = null; UI.refreshPanel(true); }, { title: 'Franja de piedra de 2 casillas que usan todos los reinos: carromatos ×3,2, carretas ×2,2, aldeanos ×1,5' }),
        UI.btn('Quitar caminos', () => PK.Despeje.empezar('quitar'), { title: 'Marca una zona y se quitan sus caminos, murallas y Calzada Real (la tuya, o la de otro en tu tierra); vuelve la mitad del material' }),
        UI.btn('Trazar cinta', () => { if (!L.beltUnlocked()) { UI.toast(L.beltLockText(), 'warn'); return; } UI.closeModal(); PK.Logi.tool = 'cinta'; PK.Input.roadStart = null; UI.refreshPanel(true); }, { disabled: !L.beltUnlocked(), title: L.beltUnlocked() ? 'Piezas de cinta con nivel, bocas en los edificios, cruces y pasos elevados' : L.beltLockText() }),
        UI.btn('Paso elevado', () => { if (!L.beltUnlocked()) { UI.toast(L.beltLockText(), 'warn'); return; } UI.closeModal(); PK.Logi.tool = 'paso'; PK.Input.roadStart = null; UI.refreshPanel(true); }, { disabled: !L.beltUnlocked(), title: 'La cinta pasa por arriba: por debajo cruzan carretas, carromatos, caminos y otras cintas' }),
        Object.keys((st.logi.red && st.logi.red.t) || {}).length ? UI.btn(PK.Cintas.verFlujo ? 'Ocultar flujo' : 'Ver flujo', () => { PK.Cintas.verFlujo = !PK.Cintas.verFlujo; UI.closeModal(); UI.refreshPanel(true); }, { title: 'Colorea cada pieza: gris vacía, verde corre con lugar, amarillo a tope, rojo atascada o frenada por una pieza de menos nivel' }) : ''));

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
        el('li', null, 'Las cintas (desde la Era ' + U.roman(D.CINTA.niv[0].era) + ') se arman pieza por pieza. Una cinta que nace junto a un edificio saca de él (un taller, lo que hace; un campamento, todo lo que junta, mezclado; una bodega, lo que elijas) y una que apunta a un edificio le entrega.'),
        el('li', null, 'Cada pieza tiene su nivel (I ' + D.CINTA.niv[0].rate * 60 + '/min, II ' + D.CINTA.niv[1].rate * 60 + ', III ' + D.CINTA.niv[2].rate * 60 + '): una de nivel más bajo frena toda la cinta. Mejorar es al instante, con recursos.'),
        el('li', null, 'Si a un edificio le llega algo que no usa, la cinta se atasca y te avisa. Dos cintas se cruzan sin mezclarse en un cruce; las carretas no cruzan cintas: pasan bajo un paso elevado.'),
        el('li', null, 'Para armar la red: un unidor junta hasta 3 cintas en una, un divisor reparte una en hasta 3 y un clasificador separa por recurso (piedra a un lado, hierro a otro, lo que sobre al Almacén). Sale una rama si empiezas a trazar en medio de una cinta; se unen si terminas sobre una que ya recibe. Cualquier pieza se convierte desde su panel.')));
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
      // pk-58: cintas atascadas o sin destino
      const Ci = PK.Cintas, malas = Ci.carriles().filter(c => c.atasco || (c.motivo && !c.sig && !c.dst && (c.pz.i || []).length));
      if (malas.length) {
        body.append(el('h3', null, 'Cintas con problemas'));
        for (const c of malas.slice(0, 8)) body.append(el('div', { class: 'work-row' }, el('span', { class: 'small warn-t' }, c.motivo),
          UI.btn('Ver', () => { UI.closeModal(); g.sel = { type: 'belt', id: c.k }; PK.Render.centerOn((c.k % W.W) + 0.5, ((c.k / W.W) | 0) + 0.5); UI.refreshPanel(true); }, { small: true })));
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
        el('div', null, el('b', null, 'Maestros de Obras: '), g.buildersBusy() + ' ocupados de ' + g.builders(), g.builders() < 5 ? el('span', { class: 'muted small' }, ' · para tener otro, construye: ' + D.BUILD.builder.name) : null),
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
