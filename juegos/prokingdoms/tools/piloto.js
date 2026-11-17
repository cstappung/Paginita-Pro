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
    1: [['house', 2], ['lumber', 1], ['establo', 1], ['mining', 1], ['scout', 1], ['mill', 1], ['farm', 2], ['house', 4], ['granary', 1], ['warehouse', 1], ['builder', 1]],
    2: [['sawmill', 1], ['barracks', 1], ['tavern', 1], ['library', 1], ['market', 1], ['house', 7], ['barracks', 1], ['tavern', 1], ['consejo', 1], ['farm', 4], ['builder', 2], ['cartwright', 1], ['lumber', 2], ['muelle', 1], ['farol', 2], ['pozo', 1], ['fuente', 1]],
    3: [['establo', 2], ['estatua', 1], ['banca', 2], ['smelter', 1], ['scriptorium', 1], ['masonry', 1], ['forge', 1], ['house', 10], ['warehouse', 2], ['monastery', 1], ['builder', 3], ['farm', 6], ['mining', 2], ['masonry', 2], ['mining', 3]],
    4: [['university', 1], ['steelworks', 1], ['masonry', 3], ['mining', 4], ['house', 13], ['granary', 2], ['builder', 4], ['farm', 8], ['smelter', 2]],
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
  // pk-42: un lugar en tu tierra para un campamento con ese recurso en su radio, junto al más cercano al Centro Urbano
  // que no quede ya en el radio de otro campamento igual (dos en el mismo bosque se pelean los mismos árboles). Prueba
  // los 10 más cercanos: a veces tu tierra no llega.
  function lugarPara(type, res, tc) {
    const g = G(), mios = g.buildings.filter(b => b.owner === 'p' && b.type === type), cand = [];
    for (const n of W.nodes) {
      if (n.dead || n.temp || D.NODES[n.kind].res !== res || !W.fog[n.y * W.W + n.x] || !W.canUse(n, 'p')) continue;
      const d = U.dist(tc.cx, tc.cy, n.x, n.y);
      if (d > 60 || mios.some(b => (!b.extrae || b.extrae === res) && U.dist(b.cx, b.cy, n.x, n.y) <= g.BASES[type].r(b.lvl))) continue;
      cand.push([d, n]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, n] of cand.slice(0, 10)) { const pl = PK.Auto.lugarJunto(type, n); if (pl) return pl; }
    return null;
  }
  // pk-42: cada aldeano trabaja para un edificio y solo dentro de su radio. Como haría un jugador: muda el campamento
  // que se quedó sin nada, pone uno junto a lo que pide el plan y nadie alcanza, y otro si sobran ociosos sin puesto.
  const MINERAL = ['stone', 'gold', 'ore', 'marble', 'gems'];
  function campoExtra() {
    const g = G(), st = S(), A = PK.Auto, tc = g.buildings.find(b => b.owner === 'p' && b.type === 'tc');
    if (!tc) return false;
    P.movido = P.movido || {};
    const w = st.auto.w || {};
    // 1) un campamento sin nada vivo en su radio: a otro lugar (cada uno, como mucho cada 20 min de juego)
    for (const b of g.buildings) {
      if (!g.esBase(b) || b.type === 'tc' || g.time - (P.movido[b.id] || -1e9) < 1200) continue;
      const rr = g.recursosEnRadio(b);
      if (Object.keys(rr).some(k => rr[k].vivos && (!b.extrae || b.extrae === k))) continue;
      const res = b.type === 'lumber' ? 'wood' : b.type === 'mill' ? 'food' : b.extrae || MINERAL.slice().sort((x, y) => (w[y] || 0) - (w[x] || 0))[0];
      const pl = lugarPara(b.type, res, tc);
      P.movido[b.id] = g.time;
      if (pl && g.canAfford(g.moveCost(b)) && g.moveBuilding(b, pl[0], pl[1])) { P.mudanzas = (P.mudanzas || 0) + 1; return true; }
    }
    if (g.buildings.some(b => b.owner === 'p' && !b.done && g.BASES[b.type])) return false; // de a uno
    // 2) lo que el plan pide y ningún edificio de trabajo alcanza (o no tiene puestos)
    const pide = A.RES.filter(r => (w[r] || 0) > 0 && A.CAMPO[r] && !A.jobAvailable(r)).sort((x, y) => (w[y] || 0) - (w[x] || 0));
    // 3) ociosos de sobra: el recurso con menos gente según las prioridades
    const idle = g.units.filter(u => u.owner === 'p' && u.kind === 'v' && !u.task && !u.inside && !u.hold).length;
    // (puestos libres que sirven: en edificios con algo vivo en su radio)
    const utiles = g.buildings.reduce((n, b) => { if (!g.esBase(b) || g.libresBase(b) <= 0) return n; const rr = g.recursosEnRadio(b); return Object.keys(rr).some(k => rr[k].vivos) ? n + g.libresBase(b) : n; }, 0);
    if (idle >= 6 && utiles < idle) { const cnt = A.counts().c; pide.push(...['wood', 'stone', 'food', 'gold'].sort((a, b) => (cnt[a] || 0) / Math.max(1, w[a] || 1) - (cnt[b] || 0) / Math.max(1, w[b] || 1))); }
    for (const res of pide) {
      const type = A.CAMPO[res];
      if (!g.isUnlocked(type) || !g.canAfford(g.buildCost(type))) continue;
      const pl = lugarPara(type, res, tc);
      if (pl && g.place(type, pl[0], pl[1])) {
        P.obras++;
        const b = g.buildings[g.buildings.length - 1];
        if (b && b.type === 'mining' && res !== 'stone') b.extrae = res;
        return true;
      }
    }
    return false;
  }
  // pk-43: cada campamento con algo adentro necesita un carromato que lo lleve al pueblo. Como un jugador: una ruta del
  // campamento a la bodega más cercana que lo reciba, con un carromato libre; si no hay libres, arma otro.
  function carromatos() {
    const g = G(), L = PK.Logi, Lb = PK.Libro;
    for (const b of Lb.campos()) {
      if (conCinta(b) && Lb.totalCampo(b) < Lb.capCampo(b) * 0.5) continue; // pk-60: lo vacía su cinta (si no da abasto, carromatos también)
      const rs = L.rutasDesde(b);
      const llevan = rs.reduce((n, r) => n + L.cartsDe(r).length, 0);
      const quiere = Lb.totalCampo(b) > Lb.capCampo(b) * 0.6 ? 2 : 1;
      if (llevan >= quiere) continue;
      let r = rs.find(o => !L.rutaMala(o));
      if (!r) {
        const dests = g.buildings.filter(o => o.owner === 'p' && o.done && L.puntoCarreta(o) && !L.isShop(o) && (b.def.drop || []).some(k => L.acepta(o, k)));
        const d = dests.sort((x, y) => U.dist(x.cx, x.cy, b.cx, b.cy) - U.dist(y.cx, y.cy, b.cx, b.cy))[0];
        if (!d) continue;
        PK.UI.mute = true;
        r = L.crearRuta(b.id, d.id, null);
        if (!r) continue;
      }
      if (L.libres('carromato').length) { L.sumarCarreta(r); continue; }
      const est = g.buildings.find(o => o.owner === 'p' && o.done && o.type === 'establo' && !o.queue.length);
      if (est && L.carromatos().length < L.carroMax() && g.canAfford(D.carromatoCost(S().era))) L.trainCarro(est);
      else if (L.carromatos().length >= L.carroMax()) { // sin lugar: mejora un establo o pone otro
        const ests = g.buildings.filter(o => o.owner === 'p' && o.done && o.type === 'establo' && !o.upg && g.canUpgrade(o).ok).sort((x, y) => x.lvl - y.lvl);
        if (ests.length) g.upgrade(ests[0]);
        else if (g.countAll('establo') < g.maxCount('establo') && g.canAfford(g.buildCost('establo'))) { const tc = g.buildings.find(o => o.owner === 'p' && o.type === 'tc'); const pl = tc && lugar('establo', tc.cx, tc.cy); if (pl) g.place('establo', pl[0], pl[1]); }
      }
      return; // de a uno por paso
    }
  }
  // pk-60 (C3): cintas como un jugador. Desde la Era III une cada campamento con la bodega más cercana que reciba lo
  // que junta (si queda cerca y el trazo es limpio) y ese campamento deja de pedir carromatos; con lo que sobra, sube
  // tramos al nivel más alto. Con ?sincintas no las usa (para medir el ritmo antes y después).
  const SIN_CINTAS = /[?&]sincintas\b/.test(location.search);
  P.cintas = 0; P.cintasSubidas = 0;
  const conCinta = b => !!(PK.Cintas && S().logi.red && PK.Cintas.bocasDe(b).salen.length);
  function cintas() {
    const g = G(), Ci = PK.Cintas, L = PK.Logi, Lb = PK.Libro;
    if (SIN_CINTAS || !Ci || !Ci.desbloqueado() || g.time < (P._cintaT || 0)) return false;
    P._cintaT = g.time + 30;
    P._cintaNo = P._cintaNo || {};
    const n = Ci.maxNivel();
    for (const b of Lb.campos()) {
      if (conCinta(b) || (P._cintaNo[b.id] || 0) > g.time) continue;
      const dests = g.buildings.filter(o => o.owner === 'p' && o.done && !L.isShop(o) && L.puntoCarreta(o) && (b.def.drop || []).some(k => L.acepta(o, k)) && U.dist(o.cx, o.cy, b.cx, b.cy) < 22)
        .sort((x, y) => U.dist(x.cx, x.cy, b.cx, b.cy) - U.dist(y.cx, y.cy, b.cx, b.cy));
      let hecho = false;
      for (const d of dests.slice(0, 3)) {
        const p = Ci.plan(b.x, b.y, d.x, d.y);
        if (!p || p.malas.length || p.bF !== d || p.tiles.length > 26 || p.unir !== null && p.unir !== undefined) continue;
        if (!g.canAfford(Ci.costoPlan(p, n))) return false; // junta para la próxima
        if (Ci.trazar(p, n)) { P.cintas++; anota('Cinta de ' + p.tiles.length + ' casillas (nivel ' + U.roman(n) + '): ' + b.def.name + ' → ' + d.def.name + '.'); hecho = true; }
        break;
      }
      if (hecho) return true;
      P._cintaNo[b.id] = g.time + 600; // sin trazo limpio: lo vuelve a probar en 10 min
    }
    // subir: un tramo por vez, si le sobra el doble de lo que cuesta
    for (const c of Ci.carriles()) {
      if (c.pz.n >= n) continue;
      const tr = Ci.tramo(c.k), costo = Ci.costoSubirLista(tr, n), doble = {};
      for (const r in costo) doble[r] = costo[r] * 2;
      if (!g.canAfford(doble)) continue;
      const m = Ci.subir(tr, n);
      if (m) { P.cintasSubidas += m; anota('Subió ' + m + ' piezas de cinta a nivel ' + U.roman(n) + '.'); return true; }
    }
    return false;
  }
  function construir() {
    const g = G(), st = S(), tc = g.buildings.find(b => b.owner === 'p' && b.type === 'tc');
    if (!tc) return false;
    for (let e = 1; e <= Math.min(st.era, 6); e++) for (const [type, n] of PLAN[e]) {
      if (g.countAll(type) >= n || !g.isUnlocked(type) || g.countAll(type) >= g.maxCount(type) || !g.canAfford(g.buildCost(type))) continue;
      let cx = tc.cx, cy = tc.cy;
      if (RECURSO[type]) { const pl = lugarPara(type, RECURSO[type], tc); if (pl && g.place(type, pl[0], pl[1])) { P.obras++; return true; } continue; } // pk-42: con algo en su radio o nada
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
    // con las metas de la era cumplidas, junta para el avance: mejorar se comía la piedra de la Era V una y otra vez
    // (salvo las bodegas, si el costo de la era no cabe en ellas: sin eso el ahorro se trababa para siempre)
    const sig = S().era + 1, costo = D.eraCost(sig);
    const noCabe = Object.keys(costo).filter(r => isFinite(g.cap(r)) && costo[r] > g.cap(r));
    const juntar = !S().eraProg && g.eraChecks(sig).every(c => c.ok) && !g.canAfford(costo);
    if (juntar && !noCabe.length) return;
    const bodega = new Set(noCabe.length ? ['tc', ...(noCabe.includes('food') ? ['granary'] : []), ...(noCabe.some(r => r !== 'food') ? ['warehouse'] : [])] : []);
    while (g.buildersBusy() < g.builders()) {
      const ok = g.buildings.filter(b => b.owner === 'p' && g.canUpgrade(b).ok && (!juntar || bodega.has(b.type)));
      if (!ok.length) return;
      const suma = b => Object.values(g.upCost(b)).reduce((s, v) => s + v, 0) * (b.type === 'tc' ? 0.3 : 1);
      // si la próxima era pide «N edificios en nivel L», primero los que ya están más cerca de L (como haría alguien
      // que mira la meta); si no, la más barata. Repartir las mejoras dejó al piloto 11 h en la Era IV sin ninguno en 7.
      const n = S().era + 1, chk = g.eraChecks(n), meta = D.eraReq(n).find((r, i) => r.lvlAny && !chk[i].ok);
      const L = meta ? meta.lvlAny : 0;
      ok.sort((a, b) => (L ? (b.lvl < L) - (a.lvl < L) || (a.lvl < L && b.lvl < L ? b.lvl - a.lvl : 0) : 0) || suma(a) - suma(b));
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
    mazmorras(); // antes que el Mariscal: si no, el ejército siempre estaba afuera en encargos y nunca iba por un jefe
    PK.Consejo.HACE.mariscal(st, Object.assign({}, st.consejo, { prob: 0.8, guarnicion: 14 * st.era, defensa: 0.2 }));
    campana();
  }
  // Primeras visitas a las mazmorras (el Mariscal solo repite bloques limpios): el próximo bloque de 5 pisos de la
  // que tenga mejor probabilidad, si llega al 80%. Sin esto el piloto nunca vio un jefe y no se podía medir el ritmo.
  function mazmorras() {
    const E = PK.Exp, B5 = PK.Inc ? PK.Inc.BLOQUE : 5;
    if ((S().exp.runs || []).some(r => r.target && r.target.poi !== undefined)) return; // una a la vez
    let mejor = null;
    for (const p of E.sites()) {
      const site = E.site(p.id), tg = { poi: p.id, floor: Math.floor((site.best || 0) / B5) * B5 + 1 };
      if (D.DUNGEON[p.kind] && tg.floor > D.DUNGEON[p.kind].floors) continue;
      if (E.canSend(tg)) continue;
      const fin = E.preview(tg); // la fuerza del bloque ya es la de su jefe (Exp.preview)
      if (!fin) continue;
      const units = E.recommend(fin.enemy, fin.power), h = PK.Heroes ? PK.Heroes.mejorPara(fin.enemy) : null;
      const ch = E.chance(E.powerVs(units, fin.enemy, h && h.id) / Math.max(1, fin.power));
      if (ch >= 0.8 && (!mejor || ch > mejor.ch)) mejor = { tg, units, h, ch, name: fin.name };
    }
    if (mejor && E.send(mejor.tg, mejor.units, mejor.h && mejor.h.id)) anota('Mazmorra: entró a ' + mejor.name + '.');
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
    // lo que está lleno y la próxima era no pide (o ya tiene de sobra), se vende: lo que sugiere el Asesor
    const costo = st.eraProg ? {} : D.eraCost(st.era + 1);
    // pk-55: también compra lo que le falta para la era cuando le sobra oro. Con el oro pasado del tope (premios), los
    // carromatos que traen oro esperan sin descargar, el campamento minero se llena y la piedra deja de entrar: el
    // piloto quedaba en la Era III con 32.000 de oro y 267 de piedra, sin comprar porque «tenía más de 150».
    for (const r of ['wood', 'stone']) if (st.res[r] < Math.max(150, (costo[r] || 0) * 1.05) && st.res.gold > 1500 && PK.Social.buyPrice(r, 300) < st.res.gold - 1000) PK.Social.buy(r, 300);
    for (const r of ['food', 'wood', 'stone', 'marble', 'planks', 'blocks', 'books']) {
      if (!D.RES[r] || st.res[r] < g.cap(r) * 0.95 || st.res[r] - 1000 < (costo[r] || 0) * 1.1) continue;
      if (PK.Social.sell(r, 1000)) { P.ventas = (P.ventas || 0) + 1; break; }
    }
  }
  // pk-55 (plan de guerra, G1): la frontera. Los reinos nacen separados por 2 a 4 parcelas libres, así que primero
  // reclama las que lo acercan al vecino más cercano (solo si le sobra cuatro veces el costo: no debe mover el ritmo
  // de las eras) y, cuando lo toca, lanza una campaña contra su parcela más débil si llega con 1,25 veces la defensa.
  // Así el time-lapse ejercita los asedios y el vigía de invariantes los cubre.
  function frontera() {
    const T = PK.Terr, st = S(), g = G();
    if (st.era < D.TERR.minEra || !g.countB('barracks') || st.terr.camps.length || g.time - (P._terrT || -1e9) < 600) return;
    let mejor = null;
    for (const b of D.BOTS) { if (b.human) continue; const c = T.caminoA(b.slot); if (c && (!mejor || c.n < mejor.c.n)) mejor = { b, c }; }
    if (!mejor) return;
    P._terrT = g.time;
    if (mejor.c.n > 0) {
      const k = mejor.c.camino[0], costo = T.claimCost();
      if (!T.canClaim(k) && Object.keys(costo).every(r => st.res[r] >= costo[r] * 4)) { T.claim(k); P.parcelas = (P.parcelas || 0) + 1; anota('Reclamó una parcela hacia ' + mejor.b.realm + ' (faltan ' + (mejor.c.n - 1) + ').'); }
      return;
    }
    const fuerza = PK.Social.power(st.war.army);
    let obj = null;
    for (let k = 0; k < W.terr.length; k++) if (W.terr[k] === mejor.b.slot + 1 && !T.canAttack(k)) { const d = T.defenseOf(k, mejor.b.slot); if (!obj || d < obj.d) obj = { k, d }; }
    if (!obj || fuerza < obj.d * 1.25 || !g.canAfford(T.campaignCost(obj.k))) return;
    if (T.attack(obj.k, Object.assign({}, st.war.army))) { P.campanas = (P.campanas || 0) + 1; anota('Campaña contra ' + mejor.b.realm + ': fuerza ' + Math.round(fuerza) + ' contra aprox. ' + Math.round(obj.d) + '.'); }
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
      carromatos();
      cintas() || campoExtra() || construir();
      mejorar();
      investigar();
      heroes();
      guerra();
      frontera();
      if (st.ret.welcome) g.openWelcome(true);
    } catch (e) { console.error('piloto', e); } finally { PK.UI.mute = false; }
  }
  P.resumen = () => ({ minutosPorEra: Object.assign({}, P.eras), capitulos: Object.assign({}, P.caps), mudanzas: P.mudanzas || 0, ociosos: Math.round((100 * (P._oc || 0)) / Math.max(1, P._ocN || 0)) + '%', bodegasLlenas: P.llenos, batallas: P.ganadas + ' ganadas / ' + P.perdidas + ' perdidas', obras: P.obras, mejoras: P.mejoras, heroes: P.heroes || 0, cintas: P.cintas + ' trazadas, ' + P.cintasSubidas + ' piezas subidas', nivelHeroe: (S().stats.hero_lvl || 0), objetos: (S().stats.items_found || 0), parcelas: P.parcelas || 0, campanas: P.campanas || 0, conquistas: (S().stats.conquests || 0), minutos: Math.round((G().time - P.t0) / 6) / 10 });
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
