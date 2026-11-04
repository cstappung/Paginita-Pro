// Piloto automático de pruebas (T1 del plan de la mega actualización). Juega como un jugador razonable para
// medir el balance antes y después de un cambio, y para encontrar trabas como las del playtest (pueblo
// encerrado, aldeanos parados). Se carga con ?dev&piloto (velocidad ×10; ?piloto=20 para otra) y con
// ?timelapse (×40). Nunca guarda: adelanta el reloj (ver start). No es parte del juego: main.js lo pide solo con esos parámetros.
//
// Anota en la consola y en window.pkPiloto: el minuto de juego en que llegó a cada era, qué parte de los
// aldeanos estuvo ociosa (promedio), los héroes reclutados, cuántas veces se llenaron las bodegas y las batallas ganadas y perdidas.
// pkPiloto.resumen() devuelve la tabla para comparar con la entrega anterior.
(function () {
  'use strict';
  const PK = window.PK, D = PK.D, U = PK.U, W = PK.World;
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const P = (PK.Piloto = { log: [], eras: {}, ociosos: 0, llenos: 0, ganadas: 0, perdidas: 0, obras: 0, mejoras: 0, t0: 0, caps: {} });
  window.pkPiloto = P;

  // Qué construir en cada era (tipo, cuántos en total). Lo que no alcanza a pagar, lo intenta en la vuelta siguiente.
  const PLAN = {
    1: [['house', 2], ['lumber', 1], ['mining', 1], ['scout', 1], ['mill', 1], ['farm', 2], ['house', 4], ['granary', 1], ['warehouse', 1], ['builder', 1]],
    2: [['sawmill', 1], ['library', 1], ['market', 1], ['house', 7], ['barracks', 1], ['tavern', 1], ['consejo', 1], ['farm', 4], ['builder', 2], ['cartwright', 1], ['lumber', 2], ['muelle', 1], ['farol', 2], ['pozo', 1], ['fuente', 1]],
    3: [['estatua', 1], ['banca', 2], ['smelter', 1], ['scriptorium', 1], ['masonry', 1], ['forge', 1], ['house', 10], ['warehouse', 2], ['monastery', 1], ['builder', 3], ['farm', 6], ['mining', 2]],
    4: [['university', 1], ['steelworks', 1], ['house', 13], ['granary', 2], ['builder', 4], ['farm', 8]],
    5: [['workshop', 1], ['house', 16], ['warehouse', 3], ['farm', 10]],
    6: [['m_jardines', 1], ['house', 19]],
  };
  const RECURSO = { lumber: 'wood', mining: 'stone', mill: 'food' };
  // las decoraciones van junto a las casas (dan ánimo a las que tienen a su alcance); el muelle, a la orilla
  const JUNTO_CASAS = new Set(D.DECOS || []);

  function anota(t) {
    const m = Math.round((G().time - P.t0) / 6) / 10;
    P.log.push('[' + m + ' min] ' + t);
    console.info('[piloto ' + m + ' min] ' + t);
  }

  // Un lugar libre cerca de algo, en tu tierra, sin pegarse a otro edificio (deja calles).
  function lugar(type, cx, cy, rMax) {
    const g = G(), def = D.BUILD[type];
    for (let r = 2; r <= (rMax || 28); r++) for (let y = Math.round(cy) - r; y <= Math.round(cy) + r; y++) for (let x = Math.round(cx) - r; x <= Math.round(cx) + r; x++) {
      if (Math.max(Math.abs(x - Math.round(cx)), Math.abs(y - Math.round(cy))) !== r) continue;
      // lo barato primero: canPlace llama a G.encierra (un relleno de hasta 3.000 casillas) y con las decoraciones
      // el piloto probaba miles de lugares por vuelta y colgaba la página
      let pegado = false;
      for (let j = -1; j <= def.h && !pegado; j++) for (let i = -1; i <= def.w; i++) { if (W.inb(x + i, y + j) && W.bAt[W.idx(x + i, y + j)] >= 0) { pegado = true; break; } }
      if (!pegado && g.canPlace(type, x, y)) return [x, y];
    }
    return null;
  }
  // Talleres: pegados (D.NEAR_STORE) a un Almacén o al Centro Urbano, o no se abastecen y nadie trabaja ahí.
  function lugarTaller(type) {
    const g = G(), def = D.BUILD[type], N = D.NEAR_STORE;
    for (const o of g.buildings.filter(b => b.owner === 'p' && b.done && (b.type === 'tc' || b.type === 'warehouse'))) {
      for (let y = o.y - N - def.h; y <= o.y + o.h + N; y++) for (let x = o.x - N - def.w; x <= o.x + o.w + N; x++) {
        const dx = Math.max(o.x - (x + def.w), 0, x - (o.x + o.w)), dy = Math.max(o.y - (y + def.h), 0, y - (o.y + o.h));
        if (Math.max(dx, dy) <= N && Math.max(dx, dy) >= 1 && g.canPlace(type, x, y)) return [x, y];
      }
    }
    return null;
  }
  // Un lugar en la orilla, en tu tierra, lo más cerca posible del Centro Urbano
  function orilla(tc) {
    const g = G();
    for (let r = 3; r <= 30; r++) for (let y = Math.round(tc.cy) - r; y <= Math.round(tc.cy) + r; y++) for (let x = Math.round(tc.cx) - r; x <= Math.round(tc.cx) + r; x++)
      if (Math.max(Math.abs(x - Math.round(tc.cx)), Math.abs(y - Math.round(tc.cy))) === r && g.canPlace('muelle', x, y)) return [x, y];
    return null;
  }
  function construir() {
    const g = G(), st = S(), tc = g.buildings.find(b => b.owner === 'p' && b.type === 'tc');
    if (!tc) return false;
    for (let e = 1; e <= Math.min(st.era, 6); e++) for (const [type, n] of PLAN[e]) {
      if (g.countAll(type) >= n || !g.isUnlocked(type) || g.countAll(type) >= g.maxCount(type) || !g.canAfford(g.buildCost(type))) continue;
      let cx = tc.cx, cy = tc.cy;
      if (RECURSO[type] && RECURSO[type] !== 'food') { const nd = W.nearestNode(RECURSO[type], tc.cx, tc.cy, 40, 'p'); if (nd) { const p = PK.Auto.lugarJunto(type, nd); if (p && g.place(type, p[0], p[1])) { P.obras++; return true; } cx = nd.x; cy = nd.y; } }
      if (type === 'farm') { const m = g.buildings.find(b => b.owner === 'p' && b.type === 'mill'); if (m) { cx = m.cx; cy = m.cy; } }
      if (JUNTO_CASAS.has(type)) { const hs = g.buildings.filter(b => b.owner === 'p' && b.type === 'house'); const h = hs[(g.countAll(type) * 3) % Math.max(1, hs.length)]; if (h) { cx = h.cx; cy = h.cy; } }
      if (type === 'muelle') { const p = orilla(tc); if (p && g.place(type, p[0], p[1])) { P.obras++; return true; } continue; }
      const p = D.BUILD[type].recipe ? lugarTaller(type) || lugar(type, cx, cy) : lugar(type, cx, cy);
      if (p && g.place(type, p[0], p[1])) { P.obras++; return true; }
    }
    return false;
  }
  // Mantiene ocupados a los maestros de obras: la mejora más barata que se puede pagar (el Centro Urbano primero).
  function mejorar() {
    const g = G();
    while (g.buildersBusy() < g.builders()) {
      const ok = g.buildings.filter(b => b.owner === 'p' && g.canUpgrade(b).ok);
      if (!ok.length) return;
      const suma = b => Object.values(g.upCost(b)).reduce((s, v) => s + v, 0) * (b.type === 'tc' ? 0.3 : 1);
      ok.sort((a, b) => suma(a) - suma(b));
      if (!g.upgrade(ok[0])) return;
      P.mejoras++;
    }
  }
  function investigar() {
    const g = G(), st = S(), V = PK.Vida;
    if (st.research || !g.countB('library')) return;
    // primero el árbol 2.0 (Fase 3): el nodo más barato que se pueda; de un par enfrentado, el primero que aparezca
    if (V) {
      const ns = Object.keys(D.ARBOL).filter(id => !V.porQueNo(id)).sort((a, b) => D.ARBOL[a].era - D.ARBOL[b].era);
      if (ns[0] && V.investigar(ns[0])) { anota('Árbol: ' + D.ARBOL[ns[0]].name + '.'); return; }
    }
    const ids = Object.keys(D.TECHS).filter(id => g.lvl(id) < g.techMax() && !(D.TECHS[id].era && st.era < D.TECHS[id].era) && g.canAfford(g.techCost(id, g.lvl(id))));
    ids.sort((a, b) => Object.values(g.techCost(a, g.lvl(a))).reduce((s, v) => s + v, 0) - Object.values(g.techCost(b, g.lvl(b))).reduce((s, v) => s + v, 0));
    if (ids[0]) g.startResearch(ids[0]);
  }
  // Ejército y salidas: lo mismo que el Mariscal del Consejo, con 80% de probabilidad mínima.
  function guerra() {
    const st = S();
    if (!G().countB('barracks')) return;
    PK.Consejo.HACE.mariscal(st, Object.assign({}, st.consejo, { prob: 0.8, guarnicion: 8 * st.era, defensa: 0.2 }));
    campana();
  }
  // Campaña (H5): ataca el lugar del capítulo con 80% de probabilidad, elige siempre la primera opción y cierra
  // las escenas (en vivo se abren solas y taparían todo).
  function campana() {
    const C = PK.Campana, st = S(), E = PK.Exp;
    if (!C || !st.campana) return;
    const k = PK.UI.modalKey();
    if (k === 'escena') PK.UI.closeModal();
    if (k === 'antes') { const n = C.actual(); if (n) C.antes(n, 1); PK.UI.closeModal(); }
    if (st.campana.pend) { const n = st.campana.pend; if (C.elegir(n, 0)) anota('Capítulo ' + U.roman(n) + ': eligió «' + C.cap(n).eleccion.ops[0].label + '».'); if (PK.UI.modalKey() === 'eleccion') PK.UI.closeModal(); }
    const n = C.actual(), tg = { cap: n };
    if (!n || !C.lugar(n) || E.canSend(tg)) return;
    const pv = E.preview(tg), units = E.recommend(pv.enemy, pv.power), h = PK.Heroes ? PK.Heroes.mejorPara(pv.enemy) : null;
    if (E.chance(E.powerVs(units, pv.enemy, h && h.id) / Math.max(1, pv.power)) < 0.8) return;
    if (E.send(tg, units, h && h.id)) anota('Capítulo ' + U.roman(n) + ': atacó ' + pv.name + '.');
  }
  // Héroes: recluta al que pueda pagar, elige siempre el primer talento, lo pone a gobernar y le pone lo mejor.
  function heroes() {
    const H = PK.Heroes;
    if (!H || !H.taberna()) return;
    for (const c of H.candidatos()) if (!H.porQueNo(c) && H.contratar(c.i)) { anota('Reclutó a un ' + H.CLASES[c.clase].name + '.'); P.heroes = (P.heroes || 0) + 1; break; }
    for (const h of H.lista()) {
      while (H.talentosPendientes(h)) H.elegirTalento(h, 0);
      if (h.gobierna == null) { const b = G().buildings.find(o => H.puedeGobernar(h, o) && !H.gobernanteDe(o)); if (b) H.gobernar(h, b); }
      for (const rn in H.RANURAS) { const it = S().heroes.inv.filter(o => o.t === rn && !H.equipadoPor(o)).sort((a, b) => b.r - a.r)[0], cur = S().heroes.inv.find(o => o.id === h.equipo[rn]); if (it && (!cur || it.r > cur.r)) H.equipar(h, it.id); }
    }
  }
  // Cartas de era (Fase 3): la primera de la mano. Exploradores: los que permita el Puesto (sin ellos no ve más
  // que el 1% del mapa del principio y, agotado eso, el pueblo se queda ocioso). Mercado: compra madera y piedra
  // cuando se acaban y sobra oro, como haría un jugador.
  function cartas() {
    const V = PK.Vida, e = V && V.pendiente();
    if (!e) return;
    const id = V.mano(e)[0];
    if (V.elegirCarta(e, id)) anota('Carta de la Era ' + U.roman(e) + ': ' + D.CARTAS[id].name + '.');
    if (PK.UI.modalKey() === 'cartas') PK.UI.closeModal();
  }
  function exploradores() {
    const g = G(), post = g.buildings.find(b => b.owner === 'p' && b.done && b.type === 'scout');
    if (post && !post.queue.length && g.scoutCount() < g.scoutMax() && g.canAfford(D.SCOUT.cost)) g.trainScout(post);
  }
  function mercado() {
    const g = G(), st = S();
    if (!g.countB('market')) return;
    for (const r of ['wood', 'stone']) if (st.res[r] < 150 && st.res.gold > 1500 && PK.Social.buyPrice(r, 300) < st.res.gold - 1000) PK.Social.buy(r, 300);
  }
  function medir() {
    const g = G(), st = S();
    if (st.campana) for (const c in st.campana.hechos) if (!P.caps[c]) { P.caps[c] = Math.round((g.time - P.t0) / 6) / 10; anota('Cerró el capítulo ' + U.roman(+c) + '.'); }
    if (st.era > (P.eraVista || 1)) {
      for (let e = (P.eraVista || 1) + 1; e <= st.era; e++) { P.eras[e] = Math.round((g.time - P.t0) / 6) / 10; anota('Llegó a la Era ' + U.roman(e) + '.'); }
      P.eraVista = st.era;
    }
    // ociosos: qué parte de los aldeanos está sin hacer nada, en promedio (a ×40 un mismo aldeano entraba y salía
    // del «más de 60 s» muchas veces por minuto y la cuenta se inflaba)
    const vs = g.units.filter(u => u.owner === 'p' && u.kind === 'v');
    if (vs.length) { P._oc = (P._oc || 0) + vs.filter(u => !u.task && !u.inside && (u.idleT || 0) > 10).length / vs.length; P._ocN = (P._ocN || 0) + 1; }
    const llenos = ['food', 'wood', 'stone', 'gold'].filter(r => st.res[r] >= g.cap(r) - 1).length;
    if (llenos && !P._lleno) P.llenos++;
    P._lleno = llenos > 0;
    P._vistos = P._vistos || new Set();
    for (const r of st.war.reports || []) if (!P._vistos.has(r.id)) { P._vistos.add(r.id); if (r.won) P.ganadas++; else P.perdidas++; }
    if (g.encierro && !P._enc) { P._enc = true; anota('¡Pueblo encerrado!'); }
  }
  function paso() {
    const g = G(), st = S();
    if (!st) return;
    try {
      PK.UI.mute = true;
      medir();
      if (g.decreePending()) g.chooseDecree('harvest');
      PK.Quests.claimAll(true);
      if (!st.eraProg && g.eraChecks(st.era + 1).every(c => c.ok) && g.canAfford(D.eraCost(st.era + 1))) g.startEra();
      cartas();
      exploradores();
      mercado();
      construir();
      mejorar();
      investigar();
      heroes();
      guerra();
      if (st.ret.welcome) g.openWelcome(true);
    } catch (e) { console.error('piloto', e); } finally { PK.UI.mute = false; }
  }
  P.resumen = () => ({ minutosPorEra: Object.assign({}, P.eras), capitulos: Object.assign({}, P.caps), ociosos: Math.round((100 * (P._oc || 0)) / Math.max(1, P._ocN || 0)) + '%', bodegasLlenas: P.llenos, batallas: P.ganadas + ' ganadas / ' + P.perdidas + ' perdidas', obras: P.obras, mejoras: P.mejoras, heroes: P.heroes || 0, nivelHeroe: (S().stats.hero_lvl || 0), objetos: (S().stats.items_found || 0), minutos: Math.round((G().time - P.t0) / 6) / 10 });
  P.start = function (o) {
    o = o || {};
    const st = S();
    G().timeScale = o.escala || 10;
    P.t0 = G().time;
    P.eraVista = st.era;
    Object.assign(st.auto, { idle: true, work: true, train: true, rebal: true });
    PK.Auto.setPlan('meta');
    // El reloj del juego corre a la velocidad del piloto. Rebrotes, regeneración de minas, heridas, fiestas, estaciones
    // y todo lo que va por Date.now() iban a velocidad real: a ×40 el pueblo talaba 40 veces más rápido de lo que el
    // bosque rebrotaba y en 2 horas de juego se quedaba sin nada (el «83% ociosos» de pk-17, igual en pk-16). Por eso la
    // partida del piloto no se guarda: quedaría con fechas en el futuro.
    if (!PK.relojReal) {
      const real = Date.now.bind(Date);
      let lr = real(), virt = lr;
      PK.relojReal = real;
      Date.now = () => { const r = real(); virt += (r - lr) * G().timeScale; lr = r; return Math.floor(virt); };
    }
    G().noSave = true;
    anota('Piloto en marcha a ×' + G().timeScale + '.');
    setInterval(paso, 400);
  };
})();
