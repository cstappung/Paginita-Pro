// Salón del Consejo (A3 del plan de la mega actualización): cada nivel suma un consejero que maneja solo una
// parte del reino. Se encienden y apagan uno por uno, corren en la misma pasada que el Capataz (PK.Auto.tick,
// también en el cálculo sin conexión) y anotan lo que hicieron para el informe «Mientras no estabas».
// La comodidad es progreso que se desbloquea, no un regalo del principio: sin el Salón no hay consejeros.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const C = (PK.Consejo = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = U.el;

  C.LISTA = [
    { id: 'mayordomo', lvl: 1, name: 'Mayordomo', icon: 'book', cada: 5, desc: 'Lleva una cola de hasta 5 investigaciones, reclama misiones, diarias y semanales, abre el cofre de bienvenida y empieza el avance de era cuando alcanza.' },
    { id: 'cartografo', lvl: 2, name: 'Cartógrafo', icon: 'compass', cada: 15, desc: 'Vuelve a mandar a explorar a los exploradores quietos (primero a tus banderas), repone exploradores y avisa cada lugar nuevo.' },
    { id: 'mariscal', lvl: 3, name: 'Mariscal', icon: 'war', cada: 20, desc: 'Recluta hasta la guarnición que elijas, repite pisos ya limpiados y acepta encargos del tablón cuando la victoria es probable. Nunca deja la defensa bajo el mínimo.' },
    { id: 'tesorero', lvl: 5, name: 'Tesorero', icon: 'market', cada: 30, desc: 'Vende lo que pase del tope que elijas y compra lo que falta para la próxima era, con una reserva de oro y bajo el límite diario del mercado.' },
    { id: 'maestro', lvl: 7, name: 'Maestro mayor', icon: 'hammer', cada: 15, desc: 'Llena la cola de obras con tus reglas: bodegas cuando se llenan, talleres y casas al máximo de la era.' },
    { id: 'gobernador', lvl: 9, name: 'Gobernador', icon: 'crown', cada: 30, desc: 'Cuando las bodegas de comida, madera, piedra y oro pasan del 95%, paga horas extra o hace una fiesta.' },
  ];
  const POR = Object.fromEntries(C.LISTA.map(c => [c.id, c]));
  C.COLA_MAX = 5;
  // Tesorero: el servidor deja mover hasta 20 × scale(era) de oro por día con los mercaderes (LIM.marketDay) y
  // 2 × scale por sync (cada 15 s en línea). El Tesorero usa menos, para que al jugador le quede margen.
  C.MERCADO_DIA = 12;
  C.MERCADO_OP = 1.5;
  const escala = era => 1000 * Math.pow(1.6, era - 1);

  C.init = function (st) {
    st.consejo = Object.assign({ on: {}, cola: [], log: [], t: {}, reclamar: true, avanzar: true, guarnicion: 20, prob: 0.85, defensa: 0.3, vender: 0.9, oroReserva: 0.2, reglas: { almacen: true, talleres: true, casas: true }, dia: null, pois: null }, st.consejo || {});
  };
  C.nivel = () => G().buildings.reduce((m, b) => (b.owner === 'p' && b.done && b.type === 'consejo' ? Math.max(m, b.lvl) : m), 0);
  C.tiene = id => C.nivel() >= POR[id].lvl;
  C.activo = id => C.tiene(id) && S().consejo.on[id] !== false;
  C.resumen = () => { const n = C.LISTA.filter(c => C.tiene(c.id)).length; return n + ' de 6 consejeros' + (n < 6 ? ' · el próximo con el nivel ' + C.LISTA[n].lvl : ''); };

  function anota(id, texto) {
    const log = S().consejo.log;
    log.push({ at: Date.now(), id, t: texto });
    if (log.length > 80) log.splice(0, log.length - 80);
  }
  C.anota = anota;
  // Lo que hacen los consejeros no llena la pantalla de avisos: queda en su registro.
  function callado(fn) {
    const ui = PK.UI;
    if (ui) ui.mute = true;
    try { return fn(); } finally { if (ui) ui.mute = false; }
  }

  C.tick = function (el) {
    const st = S();
    if (!st.consejo || !C.nivel()) return;
    for (const c of C.LISTA) {
      if (!C.activo(c.id)) continue;
      st.consejo.t[c.id] = (st.consejo.t[c.id] || 0) + el;
      if (st.consejo.t[c.id] < c.cada) continue;
      st.consejo.t[c.id] = 0;
      callado(() => HACE[c.id](st, st.consejo));
    }
  };

  // ---------- Lo que hace cada uno ----------
  const sumaCost = c => Object.values(c).reduce((s, v) => s + v, 0);
  const HACE = {
    mayordomo(st, cs) {
      const g = G();
      // la cola de investigación: descarta lo que ya no se puede y empieza lo primero cuando alcanza
      cs.cola = cs.cola.filter(id => D.TECHS[id] && g.lvl(id) < g.techMax());
      if (!st.research && cs.cola.length && g.countB('library')) {
        const id = cs.cola[0], t = D.TECHS[id];
        if (!(t.era && st.era < t.era) && g.canAfford(g.techCost(id, g.lvl(id))) && g.startResearch(id)) {
          cs.cola.shift();
          anota('mayordomo', 'Empezó a investigar ' + t.name + ' ' + U.roman(g.lvl(id) + 1) + '.');
        }
      }
      if (cs.reclamar && PK.Quests.claimableCount()) {
        const n = PK.Quests.claimAll(true);
        if (n) anota('mayordomo', 'Reclamó ' + n + (n === 1 ? ' recompensa' : ' recompensas') + ' del libro.');
      }
      if (st.ret.welcome && g.openWelcome(true)) anota('mayordomo', 'Abrió el cofre de bienvenida.');
      // la era: con los requisitos cumplidos y el costo en bodega, el avance empieza solo
      const n = st.era + 1;
      if (cs.avanzar && !st.eraProg && g.eraChecks(n).every(c => c.ok) && g.canAfford(D.eraCost(n)) && g.startEra()) anota('mayordomo', 'Empezó el avance a la Era ' + U.roman(n) + '.');
    },
    cartografo(st, cs) {
      const g = G();
      let n = 0;
      for (const u of g.units) if (u.owner === 'p' && u.kind === 'scout' && !u.task && !u.inside) { u.task = { t: 'explore' }; u.doneMsg = false; n++; }
      if (n) anota('cartografo', 'Mandó a explorar a ' + (n === 1 ? 'un explorador quieto' : n + ' exploradores quietos') + '.');
      const post = g.buildings.find(b => b.owner === 'p' && b.done && b.type === 'scout');
      if (post && g.scoutCount() + post.queue.length < g.scoutMax() && g.canAfford(D.SCOUT.cost) && st.res.food >= D.SCOUT.cost.food * 3 && g.trainScout(post)) anota('cartografo', 'Pidió un explorador nuevo.');
      const found = st.stats.pois_found || 0;
      if (cs.pois !== null && found > cs.pois) anota('cartografo', 'Tus exploradores encontraron ' + (found - cs.pois === 1 ? 'un lugar nuevo' : found - cs.pois + ' lugares nuevos') + '.');
      cs.pois = found;
    },
    mariscal(st, cs) {
      const g = G(), Soc = PK.Social, Exp = PK.Exp, army = st.war.army;
      if (!g.countB('barracks')) return;
      const enCasa = () => Object.keys(D.ARMY).reduce((s, k) => s + (army[k] || 0), 0);
      const fuera = st.exp.runs.reduce((s, r) => s + Object.values(r.units).reduce((a, b) => a + b, 0), 0);
      // reclutar hasta la guarnición: la mejor tropa disponible, sin vaciar las bodegas (paga solo si tiene el triple)
      const total = enCasa() + fuera + st.war.q.length;
      if (total < cs.guarnicion) {
        const tipo = Object.keys(D.ARMY).filter(k => !Soc.trainWhy(k) && g.canAfford(D.ARMY[k].cost, 3)).sort((a, b) => D.ARMY[b].power - D.ARMY[a].power)[0];
        if (tipo) {
          let n = 0;
          while (n < 5 && enCasa() + fuera + st.war.q.length < cs.guarnicion && !Soc.trainWhy(tipo) && g.canAfford(D.ARMY[tipo].cost, 3)) n += Soc.trainArmy(tipo, 1);
          if (n) anota('mariscal', 'Reclutó ' + n + ' ' + D.ARMY[tipo].name.toLowerCase() + (n === 1 ? '' : 's') + '.');
        }
      }
      // una salida por pasada: pisos ya limpiados que se repusieron, después encargos del tablón
      const objetivos = [];
      for (const p of Exp.sites()) { const site = Exp.site(p.id); if (site.best >= 1) objetivos.push({ poi: p.id, floor: site.best }); }
      for (const m of Exp.board()) objetivos.push({ mission: m.uid });
      const minimo = Math.ceil(cs.defensa * (enCasa() + fuera));
      for (const tg of objetivos) {
        if (Exp.canSend(tg)) continue;
        const pv = Exp.preview(tg);
        if (!pv) continue;
        const units = Exp.recommend(pv.enemy, pv.power), n = Object.values(units).reduce((a, b) => a + b, 0);
        if (!n || enCasa() - n < minimo) continue;
        if (Exp.chance(Exp.powerVs(units, pv.enemy) / Math.max(1, pv.power)) < cs.prob) continue;
        if (Exp.send(tg, units)) { anota('mariscal', 'Mandó ' + n + ' soldados a ' + pv.name + '.'); break; }
      }
    },
    tesorero(st, cs) {
      const g = G(), Soc = PK.Social;
      if (!g.countB('market') || !st.market) return;
      const hoy = U.dayKey();
      if (!cs.dia || cs.dia.k !== hoy) cs.dia = { k: hoy, oro: 0 };
      const sc = escala(st.era), libre = Math.min(C.MERCADO_OP * sc, C.MERCADO_DIA * sc - cs.dia.oro);
      if (libre < 50) return;
      const pool = Soc.tradePool().filter(r => r !== 'gold' && st.market.p[r]);
      // vender lo que pasa del tope elegido (lo más lleno primero)
      const llenos = pool.filter(r => isFinite(g.cap(r)) && st.res[r] > cs.vender * g.cap(r)).sort((a, b) => st.res[b] / g.cap(b) - st.res[a] / g.cap(a));
      for (const r of llenos) {
        let n = Math.floor(st.res[r] - cs.vender * g.cap(r));
        while (n > 0 && Soc.sellPrice(r, n) > libre) n = Math.floor(n / 2);
        if (n < 10) continue;
        const oro = Soc.sellPrice(r, n);
        Soc.sell(r, n); cs.dia.oro += oro;
        anota('tesorero', 'Vendió ' + U.fmt(n) + ' de ' + D.RES[r].name.toLowerCase() + ' por ' + U.fmt(oro) + ' de oro.');
        return;
      }
      // comprar lo que falta para la próxima era, sin bajar de la reserva de oro
      if (st.eraProg) return;
      const meta = D.eraCost(st.era + 1), reserva = cs.oroReserva * g.cap('gold');
      for (const r of Object.keys(meta).filter(k => pool.includes(k))) {
        let n = Math.ceil(meta[r] - (st.res[r] || 0));
        if (n <= 0) continue;
        const tope = Math.min(libre, st.res.gold - reserva);
        while (n > 0 && Soc.buyPrice(r, n) > tope) n = Math.floor(n / 2);
        if (n < 10) continue;
        const oro = Soc.buyPrice(r, n);
        Soc.buy(r, n); cs.dia.oro += oro;
        anota('tesorero', 'Compró ' + U.fmt(n) + ' de ' + D.RES[r].name.toLowerCase() + ' por ' + U.fmt(oro) + ' de oro (para la próxima era).');
        return;
      }
    },
    maestro(st, cs) {
      const g = G(), A = PK.Auto;
      if (st.upq.length >= A.QMAX) return;
      const libres = type => g.buildings.filter(b => b.owner === 'p' && b.done && (typeof type === 'function' ? type(b) : b.type === type) && !b.upg && !b.def.noUp && b.lvl < g.maxLvl(b.type) && !st.upq.includes(b.id)).sort((a, b) => a.lvl - b.lvl);
      const reglas = [];
      if (cs.reglas.almacen) {
        const llena = D.RES_ORDER.filter(r => !D.RES[r].special && isFinite(g.cap(r)) && st.res[r] >= 0.8 * g.cap(r));
        if (llena.includes('food')) reglas.push(['granary', 'la comida pasa del 80% de la bodega']);
        if (llena.some(r => r !== 'food')) reglas.push(['warehouse', 'la bodega pasa del 80%']);
      }
      if (cs.reglas.talleres) reglas.push([b => !!b.def.recipe, 'talleres al máximo de la era']);
      if (cs.reglas.casas) reglas.push(['house', 'casas al máximo de la era']);
      for (const [tipo, por] of reglas) {
        const b = libres(tipo)[0];
        if (!b) continue;
        A.enqueue(b);
        anota('maestro', 'Puso ' + b.def.name + ' ' + b.lvl + '→' + (b.lvl + 1) + ' en la cola de obras (' + por + ').');
        return;
      }
    },
    gobernador(st) {
      const g = G();
      if (!['food', 'wood', 'stone', 'gold'].every(r => st.res[r] >= 0.95 * g.cap(r))) return;
      if (st.eraProg) { const o = g.otInfo('era'); if (o && o.ok && g.overtime('era')) { anota('gobernador', 'Pagó horas extra: el avance de era se adelantó ' + U.fmtTime(o.skip) + '.'); return; } }
      const larga = g.buildings.filter(b => b.owner === 'p' && b.upg).map(b => [b, g.otInfo('up', b)]).filter(([, o]) => o && o.ok).sort((a, b) => (b[0].upg.total - b[0].upg.t) - (a[0].upg.total - a[0].upg.t))[0];
      if (larga && g.overtime('up', larga[0])) { anota('gobernador', 'Pagó horas extra para ' + larga[0].def.name + ' (se adelantó ' + U.fmtTime(larga[1].skip) + ').'); return; }
      const f = g.fiestaInfo();
      if (f && f.ok && g.fiesta()) anota('gobernador', 'Organizó una fiesta: +25% de recolección y talleres por 5 minutos.');
    },
  };
  C.HACE = HACE;

  // ---------- Cola del Mayordomo ----------
  C.encolar = function (id) {
    const cs = S().consejo;
    if (cs.cola.length >= C.COLA_MAX) { PK.UI.toast('La cola del Mayordomo admite ' + C.COLA_MAX + ' investigaciones.', 'warn'); return false; }
    cs.cola.push(id);
    return true;
  };
  C.colaEl = function () {
    const cs = S().consejo;
    return el('div', { class: 'era-box' }, el('b', null, 'Cola del Mayordomo (' + cs.cola.length + '/' + C.COLA_MAX + ')'),
      cs.cola.length ? el('ol', { class: 'info' }, cs.cola.map((id, i) => el('li', null, D.TECHS[id].name + ' ', PK.UI.btn('✕', () => { cs.cola.splice(i, 1); PK.UI.rerender(); }, { small: true, aria: 'Quitar ' + D.TECHS[id].name })))) :
        el('p', { class: 'small muted' }, 'Vacía: toca «+ cola» en una tecnología. El Mayordomo la empieza cuando termine la anterior y alcancen los recursos.'));
  };

  // ---------- Informe al volver ----------
  // Lo que hizo cada consejero desde `desde`: [{name, items: [texto…], mas}] (los textos repetidos se agrupan).
  C.informe = function (desde) {
    const cs = S().consejo;
    if (!cs) return [];
    const out = [];
    for (const c of C.LISTA) {
      const items = cs.log.filter(x => x.id === c.id && x.at >= desde).map(x => x.t);
      if (!items.length) continue;
      const vistos = new Map();
      for (const t of items) { const k = t.replace(/[\d.,]+/g, '#'); vistos.set(k, vistos.has(k) ? { t: vistos.get(k).t, n: vistos.get(k).n + 1 } : { t, n: 1 }); }
      out.push({ name: c.name, items: [...vistos.values()].map(v => (v.n > 1 ? v.t + ' (×' + v.n + ')' : v.t)) });
    }
    return out;
  };

  // ---------- Ventana ----------
  C.open = function () {
    const UI = PK.UI;
    UI.modal('consejo', 'Salón del Consejo', body => {
      const cs = S().consejo, nv = C.nivel(), btn = UI.btn;
      body.append(el('p', { class: 'small' }, nv ? 'Nivel ' + nv + ': ' + C.resumen() + '. Cada consejero se enciende o apaga por separado y anota lo que hizo en el informe «Mientras no estabas».' : 'Construye el Salón del Consejo (Era II) para tener consejeros.'));
      const opt = (val, list, fmt, set) => el('span', { class: 'row' }, list.map(v => btn(fmt(v), () => { set(v); UI.rerender(); }, { small: true, cls: val === v ? 'gold' : '' })));
      for (const c of C.LISTA) {
        const tiene = C.tiene(c.id), on = cs.on[c.id] !== false;
        const box = el('div', { class: 'consejero' + (tiene ? '' : ' off') },
          el('div', { class: 'cj-h' }, el('img', { class: 'ico', src: PK.Sprites.icon(c.icon), alt: '' }), el('b', null, c.name),
            tiene ? el('label', { class: 'chk small' }, el('input', { type: 'checkbox', checked: on, onchange: e => { cs.on[c.id] = e.target.checked; UI.rerender(); } }), ' Activo') : el('span', { class: 'small muted' }, 'Nivel ' + c.lvl + ' del Salón')),
          el('p', { class: 'small' }, c.desc));
        if (tiene) {
          if (c.id === 'mayordomo') box.append(el('label', { class: 'chk small' }, el('input', { type: 'checkbox', checked: cs.reclamar, onchange: e => { cs.reclamar = e.target.checked; } }), ' Reclamar misiones, diarias y semanales'),
            el('label', { class: 'chk small' }, el('input', { type: 'checkbox', checked: cs.avanzar, onchange: e => { cs.avanzar = e.target.checked; } }), ' Empezar el avance de era cuando alcance'),
            el('p', { class: 'small muted' }, 'Cola de investigación: ' + (cs.cola.length ? cs.cola.map(id => D.TECHS[id].name).join(', ') : 'vacía') + ' (se arma en Investigar).'));
          if (c.id === 'mariscal') box.append(
            el('div', { class: 'row small' }, 'Guarnición: ', btn('−', () => { cs.guarnicion = Math.max(0, cs.guarnicion - 5); UI.rerender(); }, { small: true }), el('b', null, String(cs.guarnicion)), btn('+', () => { cs.guarnicion += 5; UI.rerender(); }, { small: true }), ' tropas'),
            el('div', { class: 'row small' }, 'Sale si gana con: ', opt(cs.prob, [0.7, 0.8, 0.85, 0.9, 0.95], v => Math.round(v * 100) + '%', v => { cs.prob = v; })),
            el('div', { class: 'row small' }, 'Deja en casa: ', opt(cs.defensa, [0, 0.2, 0.3, 0.5], v => Math.round(v * 100) + '%', v => { cs.defensa = v; })));
          if (c.id === 'tesorero') box.append(
            el('div', { class: 'row small' }, 'Vende sobre: ', opt(cs.vender, [0.8, 0.9, 0.95], v => Math.round(v * 100) + '%', v => { cs.vender = v; })),
            el('div', { class: 'row small' }, 'Reserva de oro: ', opt(cs.oroReserva, [0.1, 0.2, 0.4], v => Math.round(v * 100) + '%', v => { cs.oroReserva = v; })),
            G().countB('market') ? '' : el('p', { class: 'small warn-t' }, 'Necesita un Mercado.'));
          if (c.id === 'maestro') box.append(el('div', { class: 'row small' }, [['almacen', 'Bodegas al 80%'], ['talleres', 'Talleres'], ['casas', 'Casas']].map(([k, t]) =>
            el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: cs.reglas[k], onchange: e => { cs.reglas[k] = e.target.checked; } }), ' ' + t))));
          const ult = cs.log.filter(x => x.id === c.id).slice(-3).reverse();
          box.append(ult.length ? el('ul', { class: 'info small cj-log' }, ult.map(x => el('li', null, x.t + ' ', el('span', { class: 'muted' }, U.fmtTime((Date.now() - x.at) / 1000) + ' atrás')))) : el('p', { class: 'small muted' }, 'Todavía no hizo nada.'));
        }
        body.append(box);
      }
    }, { wide: true });
  };
})();
