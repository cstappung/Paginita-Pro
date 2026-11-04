// Piloto automático de pruebas (T1 del plan de la mega actualización). Juega como un jugador razonable para
// medir el balance antes y después de un cambio, y para encontrar trabas como las del playtest (pueblo
// encerrado, aldeanos parados). Se carga con ?dev&piloto (velocidad ×10; ?piloto=20 para otra) y con
// ?timelapse (×40, sin guardar). No es parte del juego: main.js lo pide solo con esos parámetros.
//
// Anota en la consola y en window.pkPiloto: el minuto de juego en que llegó a cada era, cuántas veces hubo
// aldeanos ociosos más de 60 s seguidos, cuántas veces se llenaron las bodegas y las batallas ganadas y perdidas.
// pkPiloto.resumen() devuelve la tabla para comparar con la entrega anterior.
(function () {
  'use strict';
  const PK = window.PK, D = PK.D, U = PK.U, W = PK.World;
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const P = (PK.Piloto = { log: [], eras: {}, ociosos: 0, llenos: 0, ganadas: 0, perdidas: 0, obras: 0, mejoras: 0, t0: 0 });
  window.pkPiloto = P;

  // Qué construir en cada era (tipo, cuántos en total). Lo que no alcanza a pagar, lo intenta en la vuelta siguiente.
  const PLAN = {
    1: [['house', 2], ['lumber', 1], ['mining', 1], ['scout', 1], ['mill', 1], ['farm', 2], ['house', 4], ['granary', 1], ['warehouse', 1], ['builder', 1]],
    2: [['sawmill', 1], ['library', 1], ['market', 1], ['house', 7], ['barracks', 1], ['consejo', 1], ['farm', 4], ['builder', 2], ['cartwright', 1], ['lumber', 2]],
    3: [['smelter', 1], ['scriptorium', 1], ['masonry', 1], ['forge', 1], ['house', 10], ['warehouse', 2], ['monastery', 1], ['builder', 3], ['farm', 6], ['mining', 2]],
    4: [['university', 1], ['steelworks', 1], ['house', 13], ['granary', 2], ['builder', 4], ['farm', 8]],
    5: [['workshop', 1], ['house', 16], ['warehouse', 3], ['farm', 10]],
    6: [['wonder', 1], ['house', 19]],
  };
  const RECURSO = { lumber: 'wood', mining: 'stone', mill: 'food' };

  function anota(t) {
    const m = Math.round((G().time - P.t0) / 6) / 10;
    P.log.push('[' + m + ' min] ' + t);
    console.info('[piloto ' + m + ' min] ' + t);
  }

  // Un lugar libre cerca de algo, en tu tierra, sin pegarse a otro edificio (deja calles).
  function lugar(type, cx, cy, rMax) {
    const g = G(), def = D.BUILD[type];
    for (let r = 2; r <= (rMax || 28); r++) for (let y = Math.round(cy) - r; y <= Math.round(cy) + r; y++) for (let x = Math.round(cx) - r; x <= Math.round(cx) + r; x++) {
      if (Math.max(Math.abs(x - Math.round(cx)), Math.abs(y - Math.round(cy))) !== r || !g.canPlace(type, x, y)) continue;
      let pegado = false;
      for (let j = -1; j <= def.h && !pegado; j++) for (let i = -1; i <= def.w; i++) { if (W.inb(x + i, y + j) && W.bAt[W.idx(x + i, y + j)] >= 0) { pegado = true; break; } }
      if (!pegado) return [x, y];
    }
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
      const p = lugar(type, cx, cy);
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
    const g = G(), st = S();
    if (st.research || !g.countB('library')) return;
    const ids = Object.keys(D.TECHS).filter(id => g.lvl(id) < g.techMax() && !(D.TECHS[id].era && st.era < D.TECHS[id].era) && g.canAfford(g.techCost(id, g.lvl(id))));
    ids.sort((a, b) => Object.values(g.techCost(a, g.lvl(a))).reduce((s, v) => s + v, 0) - Object.values(g.techCost(b, g.lvl(b))).reduce((s, v) => s + v, 0));
    if (ids[0]) g.startResearch(ids[0]);
  }
  // Ejército y salidas: lo mismo que el Mariscal del Consejo, con 80% de probabilidad mínima.
  function guerra() {
    const st = S();
    if (!G().countB('barracks')) return;
    PK.Consejo.HACE.mariscal(st, Object.assign({}, st.consejo, { prob: 0.8, guarnicion: 8 * st.era, defensa: 0.2 }));
  }
  function medir() {
    const g = G(), st = S();
    if (st.era > (P.eraVista || 1)) {
      for (let e = (P.eraVista || 1) + 1; e <= st.era; e++) { P.eras[e] = Math.round((g.time - P.t0) / 6) / 10; anota('Llegó a la Era ' + U.roman(e) + '.'); }
      P.eraVista = st.era;
    }
    for (const u of g.units) if (u.owner === 'p' && u.kind === 'v' && !u.task && !u.inside && (u.idleT || 0) > 60 && !u._pilotoOcioso) { u._pilotoOcioso = true; P.ociosos++; }
    for (const u of g.units) if (u._pilotoOcioso && (u.task || u.inside)) u._pilotoOcioso = false;
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
      construir();
      mejorar();
      investigar();
      guerra();
      if (st.ret.welcome) g.openWelcome(true);
    } catch (e) { console.error('piloto', e); } finally { PK.UI.mute = false; }
  }
  P.resumen = () => ({ minutosPorEra: Object.assign({}, P.eras), ociosos60s: P.ociosos, bodegasLlenas: P.llenos, batallas: P.ganadas + ' ganadas / ' + P.perdidas + ' perdidas', obras: P.obras, mejoras: P.mejoras, minutos: Math.round((G().time - P.t0) / 6) / 10 });
  P.start = function (o) {
    o = o || {};
    const st = S();
    G().timeScale = o.escala || 10;
    P.t0 = G().time;
    P.eraVista = st.era;
    Object.assign(st.auto, { idle: true, work: true, train: true, rebal: true });
    PK.Auto.setPlan('meta');
    if (o.timelapse) G().noSave = true;
    anota('Piloto en marcha a ×' + G().timeScale + '.');
    setInterval(paso, 400);
  };
})();
