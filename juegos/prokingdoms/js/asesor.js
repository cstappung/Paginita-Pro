// Panel Asesor, «¿Qué me frena?» (A6 del plan de la mega actualización). Una lista ordenada de reglas: cada una
// mira una traba conocida del reino y, si la encuentra, devuelve un problema con botones que lo arreglan.
// PK.Asesor.problemas() → [{ id, prioridad, texto, acciones: [{ label, fn }] }], lo más grave primero.
// Lo usan el botón «?» de la barra (junto a la era) y el informe al volver.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const As = (PK.Asesor = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = U.el;
  const nombre = r => D.RES[r].name.toLowerCase();
  const cerrarY = fn => () => { PK.UI.closeModal(); fn(); };

  const REGLAS = [
    // la próxima era pide más de lo que cabe en las bodegas: no se junta nunca sin agrandarlas antes (prueba de ritmo:
    // la Era V pide 19.600 de comida y un Granero común guarda 10.000; la barra quedaba quieta sin decir por qué)
    () => {
      const g = G(), st = S();
      if (st.eraProg) return null;
      const n = st.era + 1, cost = D.eraCost(n), r = Object.keys(cost).find(k => D.RES[k] && isFinite(g.cap(k)) && cost[k] > g.cap(k));
      if (!r) return null;
      const alm = r === 'food' ? 'granary' : 'warehouse';
      return { id: 'eracap', prioridad: 72, texto: 'La Era ' + U.roman(n) + ' pide ' + U.fmt(cost[r]) + ' de ' + nombre(r) + ' y tus bodegas guardan ' + U.fmt(g.cap(r)) + ': mejora ' + (D.BUILD[alm] ? 'el ' + D.BUILD[alm].name + ' o ' : '') + 'el Centro Urbano.', acciones: [{ label: 'Obras', fn: cerrarY(() => PK.UI.openWorks()) }] };
    },
    // el patio del Centro Urbano cerrado por edificios (B2): lo más grave, nadie sale a trabajar
    () => {
      const e = G().encierro;
      return e && { id: 'encierro', prioridad: 100, texto: 'Tu Centro Urbano está encerrado por edificios: tus aldeanos no llegan a los recursos.', acciones: e.puertas.length ? [{ label: 'Ver edificios', fn: cerrarY(() => G().verPuertas()) }] : [] };
    },
    // se puede avanzar de era y no se avanzó
    () => {
      const g = G(), st = S();
      if (st.eraProg) return null;
      const n = st.era + 1;
      if (!g.eraChecks(n).every(c => c.ok) || !g.canAfford(D.eraCost(n))) return null;
      return { id: 'era', prioridad: 90, texto: '¡Ya puedes avanzar a la Era ' + U.roman(n) + '!', acciones: [{ label: 'Avanzar', fn: () => { g.startEra(); } }] };
    },
    // talleres parados por la reserva (B4)
    () => {
      const g = G(), b = g.buildings.find(o => o.owner === 'p' && o.done && o.def.recipe && g.reservaDe(o) && !g.reservaDe(o).meta && PK.Logi.supplied(o)); // la de la meta de era es a propósito
      if (!b) return null;
      const r = g.reservaDe(b), st = S(), menos = [0.5, 0.3, 0.15, 0].find(v => v < st.auto.reserve);
      return { id: 'reserva', prioridad: 70, texto: 'Taller parado: ' + b.def.name + ', falta ' + nombre(r.res) + ' (reserva ' + Math.round(st.auto.reserve * 100) + '%).',
        acciones: [{ label: 'Producir igual', fn: () => { g.setSinReserva(b, true); } }].concat(menos !== undefined ? [{ label: 'Bajar reserva a ' + Math.round(menos * 100) + '%', fn: () => { st.auto.reserve = menos; } }] : []) };
    },
    // la meta de era pide un recurso del mapa que nadie junta
    () => {
      const g = G(), st = S(), A = PK.Auto;
      if (st.eraProg) return null;
      const cost = D.eraCost(st.era + 1), c = A.jobCounts();
      for (const r of ['stone', 'wood', 'food', 'gold', 'ore', 'marble', 'gems', 'fibra', 'salitre', 'especias']) {
        if (!cost[r] || (st.res[r] || 0) >= cost[r] || c[r] || !A.jobAvailable(r)) continue;
        return { id: 'meta_' + r, prioridad: 65, texto: '0 aldeanos en ' + nombre(r) + ' y la meta de era pide ' + U.fmt(cost[r]) + '.',
          acciones: [{ label: 'Mandar 10', fn: () => { for (let i = 0; i < 10; i++) if (!A.addJob(r)) break; } }] };
      }
      return null;
    },
    // un encuentro en el camino (aventura.js) espera tu decisión
    () => {
      const r = PK.Aventura && S().exp.runs.find(o => o.enc);
      return r && { id: 'encuentro', prioridad: 61, texto: 'Tus tropas se cruzaron con algo en el camino: decide qué hacer.', acciones: [{ label: 'Decidir', fn: cerrarY(() => PK.Aventura.open(r.id)) }] };
    },
    // mapas del tesoro sin buscar
    () => {
      const ms = (S().mapas || []).filter(m => !m.heroe);
      return ms.length > 0 && { id: 'mapas', prioridad: 32, texto: (ms.length === 1 ? 'Tienes un mapa del tesoro' : 'Tienes ' + ms.length + ' mapas del tesoro') + ' sin buscar.', acciones: [{ label: 'Ver mapas', fn: cerrarY(() => PK.Aventura.openMapas()) }] };
    },
    // una incursión espera que elijas la sala (si no, el capitán elige solo)
    () => {
      const r = PK.Inc && S().exp.runs.find(o => o.phase === 'sala');
      return r && { id: 'sala', prioridad: 62, texto: 'Tus tropas esperan en el piso ' + r.inc.piso + ': elige el camino.', acciones: [{ label: 'Elegir sala', fn: cerrarY(() => PK.Inc.open(r.id)) }] };
    },
    // aldeanos sin nada que hacer
    () => {
      const vs = PK.Auto.villagers().filter(u => !u.task && !u.inside && !u.hold && (u.idleT || 0) > 10);
      return vs.length >= 3 && { id: 'ociosos', prioridad: 60, texto: vs.length + ' aldeanos ociosos.', acciones: [{ label: 'Repartir', fn: () => { PK.Auto.freeIdle(); } }, { label: 'Aldeanos', fn: cerrarY(() => PK.UI.openForeman()) }] };
    },
    // bodegas llenas: vender o hacer una fiesta
    () => {
      const g = G(), st = S(), mercado = g.countB('market');
      const llenas = ['gold', 'food', 'wood', 'stone', 'ore', 'fibra', 'salitre'].filter(r => D.RES[r] && isFinite(g.cap(r)) && st.res[r] >= g.cap(r) * 0.98);
      if (!llenas.length) return null;
      const r = llenas[0], acc = [], fi = g.fiestaInfo();
      if (r !== 'gold' && mercado) acc.push({ label: 'Vender 1.000', fn: () => { PK.Social.sell(r, Math.min(1000, Math.floor(st.res[r]))); } });
      if (fi && fi.ok) acc.push({ label: 'Fiesta', fn: () => { g.fiesta(); } });
      const alm = r === 'food' ? 'granary' : 'warehouse';
      acc.push({ label: 'Mejorar ' + D.BUILD[alm].name, fn: cerrarY(() => PK.UI.openWorks()) });
      return { id: 'lleno', prioridad: 50, texto: 'Bodega ' + (r === 'gold' ? 'de oro' : 'de ' + nombre(r)) + ' llena' + (llenas.length > 1 ? ' (y ' + (llenas.length - 1) + ' más)' : '') + ': tus aldeanos esperan.', acciones: acc };
    },
    // maestros de obras sin trabajo
    () => {
      const g = G(), libres = g.builders() - g.buildersBusy();
      if (libres < 1 || !g.buildings.some(b => b.owner === 'p' && g.canUpgrade(b).ok)) return null;
      return { id: 'maestros', prioridad: 45, texto: (libres === 1 ? 'Un maestro de obras libre' : libres + ' maestros de obras libres') + ' y hay mejoras que puedes pagar.', acciones: [{ label: 'Elegir obra', fn: cerrarY(() => PK.UI.openWorks()) }] };
    },
    // población al tope
    () => {
      const g = G();
      if (g.pop() < g.popCap()) return null;
      return { id: 'casas', prioridad: 40, texto: 'Población al máximo (' + g.popCap() + '): no puedes entrenar más aldeanos.', acciones: [{ label: 'Construir casa', fn: cerrarY(() => PK.Input.startPlacing('house')) }] };
    },
    // el explorador terminó su alcance
    () => {
      const g = G(), st = S(), post = g.buildings.find(b => b.owner === 'p' && b.done && b.type === 'scout');
      if (!post || st.flags.scoutDoneR !== g.exploreRange()) return null;
      return { id: 'alcance', prioridad: 35, texto: 'Tu explorador terminó su área (' + U.fmt(g.exploreArea()) + ' casillas).', acciones: [{ label: 'Mejorar Puesto', fn: cerrarY(() => PK.UI.selectBuilding(post)) }] };
    },
    // la Biblioteca sin investigar
    () => {
      const g = G(), st = S();
      if (!g.countB('library') || st.research || Object.keys(D.TECHS).every(id => g.lvl(id) >= g.techMax())) return null;
      return { id: 'investigar', prioridad: 30, texto: 'La Biblioteca no está investigando nada.', acciones: [{ label: 'Investigar', fn: cerrarY(() => PK.UI.openResearch()) }] };
    },
    // héroes (H1): talento por elegir, candidatos que puedes pagar, héroes en casa sin gobernar nada
    () => {
      const H = PK.Heroes, h = H && H.lista().find(x => H.talentosPendientes(x));
      return h && { id: 'talento', prioridad: 42, texto: h.nombre + ' puede elegir un talento.', acciones: [{ label: 'Elegir', fn: cerrarY(() => H.open('heroes', h.id)) }] };
    },
    () => {
      const H = PK.Heroes;
      if (!H || !H.taberna() || H.lista().length >= H.max() || !H.candidatos().some(c => !H.porQueNo(c))) return null;
      return { id: 'taberna', prioridad: 38, texto: H.lista().length ? 'Hay un héroe que puedes reclutar en la Taberna.' : '¡Tu primer héroe te espera en la Taberna!', acciones: [{ label: 'Ver candidatos', fn: cerrarY(() => H.open('taberna')) }] };
    },
    () => {
      const H = PK.Heroes, h = H && H.libres().find(x => x.gobierna == null && G().buildings.some(b => H.puedeGobernar(x, b) && !H.gobernanteDe(b)));
      return h && { id: 'gobernar', prioridad: 28, texto: h.nombre + ' está en casa sin gobernar nada (' + H.CLASES[h.clase].pasTxt + ').', acciones: [{ label: 'Asignar', fn: cerrarY(() => H.open('heroes', h.id)) }] };
    },
    // recompensas sin reclamar
    () => {
      const n = PK.Quests.claimableCount();
      return n > 0 && { id: 'reclamar', prioridad: 25, texto: n + (n === 1 ? ' recompensa lista' : ' recompensas listas') + ' en el Libro de Misiones.', acciones: [{ label: 'Reclamar', fn: () => { PK.Quests.claimAll(); } }] };
    },
  ];
  As.REGLAS = REGLAS;
  As.problemas = function () {
    const out = [];
    for (const r of REGLAS) { try { const p = r(); if (p) out.push(p); } catch (e) { console.warn('asesor', e); } }
    return out.sort((a, b) => b.prioridad - a.prioridad);
  };

  // Ventana: los 3 más importantes con sus botones (y el resto, plegado).
  As.open = function () {
    const UI = PK.UI;
    UI.modal('asesor', '¿Qué me frena?', body => {
      const ps = As.problemas();
      if (!ps.length) { body.append(el('p', null, 'Nada te frena ahora: tu reino marcha bien.'), el('p', { class: 'small muted' }, 'Si quieres más, mira la meta de la próxima era o el Libro de Misiones.')); return; }
      const fila = p => el('div', { class: 'asesor-row' + (p.prioridad >= 70 ? ' grave' : '') }, el('span', null, p.texto),
        el('span', { class: 'row' }, p.acciones.map(a => UI.btn(a.label, () => { a.fn(); UI.rerender(); UI.refreshPanel(true); }, { small: true, cls: 'gold' }))));
      body.append(el('div', null, ps.slice(0, 3).map(fila)));
      if (ps.length > 3) body.append(el('details', null, el('summary', { class: 'small' }, 'Otras ' + (ps.length - 3) + ' cosas'), ps.slice(3).map(fila)));
    });
  };
  // Para el botón de la barra: cuántos problemas importantes hay (se recalcula cada 3 s).
  let cuenta = 0, t = 99;
  As.cuenta = function (dt) {
    if ((t += dt) < 3) return cuenta;
    t = 0;
    cuenta = As.problemas().filter(p => p.prioridad >= 45).length;
    return cuenta;
  };
})();
