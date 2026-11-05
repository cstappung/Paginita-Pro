// «Vida en el reino», la Fase 3 del plan de la mega actualización (pk-18): árbol de tecnologías 2.0 (V1), cartas de
// era (V2) y estaciones (V3). Las tablas están en js/datos-vida.js. Las ventanas, en js/ui/vida.js.
//
// Todo lo que dan pasa por Vida.bono(k), que suma árbol + cartas + estación con un caché que se invalida al elegir
// algo y al cambiar de estación. La recolección pasa además por Vida.recoleccion, que topa la suma en D.VIDA_TOPE:
// es el margen que el servidor le reconoce (LIM.vida en server/sim.js, regla 4 del plan). Sin conexión rinde lo
// mismo: la estación sale del reloj real (Date.now), así que en vivo, sin conexión y en el servidor es la misma.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const V = (PK.Vida = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k, act) => PK.UI && !G().offline && PK.UI.toast(t, k, act);

  V.init = function (st) {
    st.arbol = st.arbol || {};
    st.arbolBloq = st.arbolBloq || {};
    st.cartas = Object.assign({ tomadas: [] }, st.cartas);
    st.animo = Object.assign({ v: D.ANIMO.base, ev: [], feliz: 0 }, st.animo);
    st.desafios = st.desafios || {};
    st.retos = st.retos || null;
    st.tienda = Object.assign({ tengo: {} }, st.tienda);
    // V7: partidas que ya tenían rangos de escalera reclamados reciben sus cosméticos (sin aviso)
    if (st.quests) for (const q of D.QUESTS) if (q.rango && st.quests[q.id] === 'claimed') for (const tid of D.premiosRango(q)) st.tienda.tengo[tid] = 1;
    cache = null;
    aplicarTienda();
    if (PK.Pase && PK.Pase.aplicar) PK.Pase.aplicar();
  };

  // ---------- Bonos ----------
  let cache = null, cacheEst = -1;
  V.invalidar = () => { cache = null; if (G().invalidateCaps) G().invalidateCaps(); };
  function sumar() {
    const st = S(), o = {}, add = ef => { for (const k in ef || {}) o[k] = (o[k] || 0) + ef[k]; };
    for (const id in st.arbol || {}) if (D.ARBOL[id]) add(D.ARBOL[id].ef);
    for (const c of (st.cartas && st.cartas.tomadas) || []) if (D.CARTAS[c.id]) add(D.CARTAS[c.id].ef);
    add(V.estacionDe().ef);
    // la Maravilla elegida (V6), según su nivel
    const m = G().maravilla && G().maravilla();
    if (m && m.done && D.MARAV && D.MARAV[m.type]) add(D.MARAV[m.type].ef(m.lvl));
    // la tienda: el Escribano del Mayordomo
    if (st.tienda && st.tienda.tengo.cola) add({ cola: 1 });
    // la pista dorada del Pase del Reino (PA3): solo tiempo y comodidad, nada de fuerza ni recolección
    if (PK.Pase && PK.Pase.dorado()) add({ upSpeed: 0.176, researchP: 0.176, cola: 1 });
    return o;
  }
  V.bono = function (k) {
    const st = S();
    if (!st || !st.arbol) return 0;
    const e = V.estacion();
    if (!cache || e !== cacheEst) {
      if (cache && e !== cacheEst && G().invalidateCaps) G().invalidateCaps();
      cache = sumar(); cacheEst = e;
    }
    return cache[k] || 0;
  };
  // Multiplicador de recolección de un recurso (y del tipo de nodo: 'deer', 'berry', 'farm'). Incluye el gatherP del
  // árbol, las cartas y el verano, que por eso no entra por G.perk. Topado entre 0,5 y D.VIDA_TOPE.
  const MINA = { stone: 1, gold: 1, ore: 1, marble: 1, gems: 1 };
  V.recoleccion = function (res, kind) {
    const b = V.bono;
    let s = b('gatherP') + (b('g_' + res) || 0);
    if (MINA[res]) s += b('g_mine');
    if (kind === 'deer') s += b('hunt');
    if (kind === 'berry') s += b('berry');
    if (kind === 'farm') s += b('farm');
    s += V.animoMult() - 1; // el ánimo del pueblo (V4) también va dentro del tope
    return U.clamp(1 + s, 0.5, D.VIDA_TOPE);
  };
  // Lo que suma por G.perk (como los decretos). gatherP queda fuera: va topado en recoleccion.
  V.perk = k => (k === 'gatherP' ? 0 : V.bono(k));

  // ---------- V3. Estaciones ----------
  const DUR = () => D.ESTACION_H * 3600 * 1000;
  V.estacion = (t) => Math.floor((t == null ? Date.now() : t) / DUR()) % 4; // t = 0 es un instante válido: nunca `t || Date.now()`
  V.estacionDe = (t) => D.ESTACIONES[V.estacion(t)];
  V.estacionFalta = () => (DUR() - (Date.now() % DUR())) / 1000; // segundos hasta la próxima
  // De noche (hora real del jugador): entre las 20 y las 6. Opciones → «Sin noche» la apaga (flags.sinNoche).
  V.noche = function () {
    const st = S();
    if (st && st.flags && st.flags.sinNoche) return 0;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    // 0 de día, 1 de noche cerrada, con media hora de crepúsculo a cada lado
    if (h >= 20.5 || h < 5.5) return 1;
    if (h >= 19.5) return h - 19.5;
    if (h < 6.5) return 6.5 - h;
    return 0;
  };
  let estVista = null, tickN = 0;
  V.tick = function () {
    const st = S();
    if (!st || G().offline) return;
    // cada 10 s (el juego llama cada 5): ánimo y desafíos que se miran en el estado
    if (++tickN % 2 === 0) { V.calcAnimo(); V.revisar('tick'); V.revisarRetos(); }
    const e = V.estacion();
    if (estVista === null) { estVista = e; return; }
    if (e !== estVista) {
      estVista = e;
      const E = D.ESTACIONES[e];
      toast(E.icon + ' Llegó la ' + E.name.toLowerCase() + ': ' + E.desc, 'epic');
      G().stat('estaciones', 1);
      if (PK.Render && PK.Render.nuevaEstacion) PK.Render.nuevaEstacion();
    }
  };

  // ---------- V1. Árbol 2.0 ----------
  V.nodoId = id => 'n:' + id;
  V.esNodo = rid => typeof rid === 'string' && rid.startsWith('n:');
  V.costoNodo = function (id) {
    const n = D.ARBOL[id], k = Math.pow(2.1, n.era - 2), r = v => Math.round(v / 10) * 10, c = { food: r(400 * k), wood: r(350 * k), gold: r(200 * k) };
    if (n.era >= 3) { c.stone = r(250 * k); c.planks = r(60 * k / 2.1); }
    if (n.era >= 4) c.books = r(15 * k / 4.41);
    if (n.era >= 5) c.ingots = r(40 * k / 9.26);
    if (n.era >= 7) c.steel = r(20 * k / 40.8);
    return c;
  };
  V.tiempoNodo = id => Math.round(Math.min(240 * Math.pow(1.9, D.ARBOL[id].era - 2), 2 * 86400));
  // 'hecho' | 'curso' | 'bloq' (su par se eligió en esta era) | 'era' | 'lib' | 'ok'
  V.estado = function (id) {
    const st = S(), n = D.ARBOL[id];
    if (st.arbol[id]) return 'hecho';
    if (st.research && st.research.id === V.nodoId(id)) return 'curso';
    if (st.arbolBloq[id] && st.era < st.arbolBloq[id]) return 'bloq';
    if (st.era < n.era) return 'era';
    if (G().techMax() < n.lib) return 'lib';
    return 'ok';
  };
  V.porQueNo = function (id) {
    const st = S(), n = D.ARBOL[id], e = V.estado(id);
    if (e === 'hecho') return 'Ya lo tienes.';
    if (e === 'curso') return 'Ya se está investigando.';
    if (e === 'bloq') return 'Elegiste ' + D.ARBOL[n.ex].name + ': este se abre en la Era ' + U.roman(st.arbolBloq[id]) + '.';
    if (e === 'era') return 'Requiere la Era ' + U.roman(n.era) + '.';
    if (e === 'lib') return 'Requiere la Biblioteca en nivel ' + n.lib + '.';
    if (st.research) return 'Ya hay una investigación en curso.';
    if (!G().countB('library')) return 'Necesitas una Biblioteca.';
    if (!G().canAfford(V.costoNodo(id))) return 'Recursos insuficientes.';
    return null;
  };
  V.investigar = function (id) {
    const why = V.porQueNo(id), st = S(), n = D.ARBOL[id];
    if (why) { toast(why, 'warn'); return false; }
    if (!G().pay(V.costoNodo(id))) return false;
    st.research = { id: V.nodoId(id), lvl: 1, t: 0, total: V.tiempoNodo(id) };
    // el par enfrentado queda cerrado hasta la era siguiente (si se investiga en la misma era del par)
    if (n.ex && !st.arbol[n.ex]) st.arbolBloq[n.ex] = Math.max(st.arbolBloq[n.ex] || 0, Math.max(st.era, n.era) + 1);
    return true;
  };
  V.terminarNodo = function (rid) {
    const id = rid.slice(2), st = S(), n = D.ARBOL[id];
    if (!n) return;
    st.arbol[id] = 1;
    V.invalidar();
    G().stat('nodos', 1);
    G().finished.push(n.name);
    toast('Árbol del reino: ' + n.name + '. ' + n.desc, 'epic');
  };
  V.nombre = rid => (V.esNodo(rid) ? (D.ARBOL[rid.slice(2)] || { name: '?' }).name : null);
  V.contar = rama => Object.keys(D.ARBOL).filter(id => (!rama || D.ARBOL[id].rama === rama) && S().arbol[id]).length;

  // ---------- V2. Cartas de era ----------
  const esReal = e => D.DECREE_ERAS.includes(e); // en las eras de decreto la mano son los decretos
  V.tomada = e => (S().cartas.tomadas || []).find(c => c.era === e) || null;
  // La primera era (de la II a la actual) que todavía no tiene carta.
  V.pendiente = function () {
    const st = S();
    if (!st || !st.cartas) return 0;
    for (let e = 2; e <= st.era; e++) if (!esReal(e) && !V.tomada(e)) return e;
    return 0;
  };
  V.mano = function (era) {
    const st = S(), usadas = new Set(st.cartas.tomadas.map(c => c.id)), libres = Object.keys(D.CARTAS).filter(id => !usadas.has(id));
    const rng = U.rng(U.strHash('cartas:' + era + ':' + (st.created || 0))), out = [];
    // se baraja con semilla fija: la mano no cambia al recargar (aunque se cuente desde las libres de ahora)
    const todas = Object.keys(D.CARTAS).slice();
    for (let i = todas.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [todas[i], todas[j]] = [todas[j], todas[i]]; }
    for (const id of todas) { if (libres.includes(id)) out.push(id); if (out.length >= 3) break; }
    return out;
  };
  V.elegirCarta = function (era, id) {
    const st = S();
    if (!D.CARTAS[id] || V.tomada(era) || esReal(era) || era > st.era || !V.mano(era).includes(id)) return false;
    st.cartas.tomadas.push({ era, id });
    const c = D.CARTAS[id];
    if (c.al && V.CARTA_AL[c.al]) V.CARTA_AL[c.al]();
    V.invalidar();
    G().stat('cartas', 1);
    V.evento('carta');
    toast('Carta de la Era ' + U.roman(era) + ': ' + c.name + '. ' + c.desc, 'epic');
    if (PK.Sfx) PK.Sfx.play('level');
    return true;
  };
  V.CARTA_AL = {
    // +1 rango a cada tipo de tropa: sube su experiencia hasta el rango siguiente
    rango() {
      const xp = S().exp && S().exp.xp;
      if (!xp) return;
      for (const k in D.ARMY) { const r = D.rankOf(xp[k] || 0); if (r < D.RANKS.length - 1) xp[k] = Math.max(xp[k] || 0, D.rankXp(r + 1)); }
    },
    // revela las 2 mazmorras más cercanas que todavía no descubriste
    mazmorras() {
      const [hx, hy] = D.PLAYER_HOME, g = G();
      const ps = W.pois.filter(p => D.DUNGEON[p.kind] && !(g.poiState(p) && g.poiState(p).f)).sort((a, b) => U.dist(a.x, a.y, hx, hy) - U.dist(b.x, b.y, hx, hy)).slice(0, 2);
      for (const p of ps) g.revealAt(p.x + 1, p.y + 1, 4);
    },
  };

  // ---------- V4. Ánimo del pueblo ----------
  const casas = () => G().buildings.filter(b => b.owner === 'p' && b.done && b.type === 'house');
  const juglar = () => !!(PK.Heroes && S().heroes && PK.Heroes.lista().some(h => h.clase === 'juglar' && h.gobierna != null && h.estado === 'libre'));
  // Lo que suma y resta, para la ventana del ánimo: [{txt, v}]
  V.animoPartes = function () {
    const g = G(), st = S(), out = [], cs = casas(), rd = g.rectDist, now = Date.now(), A = D.ANIMO;
    let deco = 0;
    for (const b of g.buildings) {
      if (b.owner !== 'p' || !b.done || !b.def.deco) continue;
      const d = b.def.deco, n = cs.filter(c => rd(b.x, b.y, b.w, b.h, c.x, c.y, c.w, c.h) <= d.r).length;
      if (!n) continue;
      deco += (d.animo + (d.fiesta && g.fiestaMult() > 1 ? d.fiesta : 0) + (b.type === 'escenario' && juglar() ? 3 : 0)) * Math.min(1, n / 2);
    }
    if (deco) out.push({ txt: 'Decoraciones cerca de las casas', v: Math.min(A.decoTope, Math.round(deco)) });
    const tab = g.buildings.find(b => b.owner === 'p' && b.done && b.type === 'tavern');
    if (tab) out.push({ txt: 'Taberna (nivel ' + tab.lvl + ')', v: Math.min(10, 2 * tab.lvl) });
    if (g.fiestaMult() > 1) out.push({ txt: 'Fiesta en el pueblo', v: 10 });
    const tipos = new Set(g.buildings.filter(b => b.owner === 'p' && b.done && !b.def.deco).map(b => b.type)).size;
    if (tipos >= 6) out.push({ txt: 'Variedad de edificios (' + tipos + ' tipos)', v: Math.min(8, Math.floor((tipos - 3) / 3)) });
    if (juglar()) out.push({ txt: 'Un Juglar gobierna', v: 5 });
    if (V.bono('animo')) out.push({ txt: 'Jardines Eternos', v: Math.round(V.bono('animo')) });
    for (const e of st.animo.ev) if (e.hasta > now) out.push({ txt: e.txt, v: e.v });
    if (st.era >= 2 && st.res.food < g.cap('food') * 0.05) out.push({ txt: 'La despensa está vacía', v: -10 });
    const lejos = cs.filter(c => !g.buildings.some(o => o.owner === 'p' && o.done && o.def.drop && rd(c.x, c.y, c.w, c.h, o.x, o.y, o.w, o.h) <= 14)).length;
    if (lejos) out.push({ txt: lejos + (lejos === 1 ? ' casa lejos' : ' casas lejos') + ' de un punto de acopio', v: -Math.min(10, lejos) });
    return out;
  };
  V.calcAnimo = function () {
    const st = S(), now = Date.now(), A = D.ANIMO;
    st.animo.ev = st.animo.ev.filter(e => e.hasta > now);
    const v = U.clamp(Math.round(A.base + V.animoPartes().reduce((a, p) => a + p.v, 0)), 0, 100);
    st.animo.v = v;
    // Día feliz: pasado de 80, como mucho cada 2 horas (solo en vivo, como los eventos)
    if (v >= A.feliz && now - (st.animo.feliz || 0) > A.felizCada && PK.Life && PK.Life.ponerMod) {
      st.animo.feliz = now;
      PK.Life.ponerMod('gather', 1.1, 180);
      G().stat('dias_felices', 1);
      toast('¡Día feliz! El pueblo canta mientras trabaja: +10% de recolección por 3 minutos.', 'epic');
    }
    return v;
  };
  // Un recuerdo que sube o baja el ánimo por un rato (incursiones, eventos)
  V.animoEv = function (v, seg, txt) { const st = S(); if (!st || !st.animo) return; st.animo.ev.push({ v, hasta: Date.now() + seg * 1000, txt }); };
  V.animo = () => (S() && S().animo ? S().animo.v : D.ANIMO.base);
  V.animoMult = function () {
    const v = V.animo(), A = D.ANIMO;
    return v < 50 ? 1 - (A.malo * (50 - v)) / 50 : 1 + (A.bueno * (v - 50)) / 50;
  };

  // ---------- V6. Maravillas 2.0 ----------
  // La Maravilla vieja (4×4) se transforma gratis en una de las cuatro, conservando nivel. Necesita lugar de 5×5.
  V.transformar = function (b, tipo) {
    const g = G();
    if (!b || b.type !== 'wonder' || !D.MARAV[tipo]) return false;
    const why = g.placeWhy(tipo, b.x, b.y, b.id);
    if (why) { toast('La ' + D.BUILD[tipo].name + ' mide 5×5 y no cabe donde está la Maravilla (' + g.placeText(why) + ') Muévela a un lugar con más espacio.', 'warn'); return false; }
    const { x, y, lvl, upg, id } = b;
    g.removeBuilding(b);
    const n = g.addBuilding(tipo, 'p', x, y, true, id, false, lvl);
    n.upg = upg;
    V.invalidar();
    toast('Tu Maravilla ahora es la ' + D.BUILD[tipo].name + '.', 'epic');
    return n;
  };
  V.fase = b => Math.min(6, Math.floor((b.lvl || 1) / 5));

  // ---------- V7. Desafíos ----------
  V.evento = function (tipo, e) { if (S() && S().desafios) V.revisar(tipo, e || {}); };
  V.revisar = function (tipo, e) {
    const st = S();
    for (const d of D.DESAFIOS) {
      if (d.on !== tipo || st.desafios[d.id]) continue;
      let ok = false;
      try { ok = d.ok(st, e || {}); } catch (err) { ok = false; }
      if (ok) cumplir(d);
    }
  };
  function cumplir(d) {
    const st = S(), r = { gems: 4 + st.era, coins: 8 };
    st.desafios[d.id] = Date.now();
    G().stat('desafios', 1);
    G().give(r);
    toast('Desafío cumplido: «' + d.name + '». +' + r.gems + ' gemas y +' + r.coins + ' monedas. Ya puedes usar su título.', 'epic', { label: 'Ver', fn: () => PK.UI.openDesafios && PK.UI.openDesafios() });
    if (PK.Sfx) PK.Sfx.play('level');
  }
  V.cumplidos = () => Object.keys((S() && S().desafios) || {}).length;
  V.titulo = () => {
    const st = S(), t = st && st.flags.titulo;
    if (t && t.indexOf('q:') === 0) { const q = D.QUESTS.find(o => o.id === t.slice(2)); return q && st.quests[q.id] === 'claimed' ? q.title : null; } // V7: rango de escalera
    return t && st.desafios[t] ? D.DESAFIOS.find(d => d.id === t).name : null;
  };

  // Retos del Rey: 3 por semana (se renuevan el lunes), con semilla de la semana y la partida
  const semana = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return U.dayKey(d); };
  V.retos = function () {
    const st = S(), wk = semana();
    if (!st.retos || st.retos.sem !== wk) {
      const rng = U.rng(U.strHash('retos:' + wk + ':' + (st.created || 0))), pool = D.RETOS.slice(), ids = [];
      while (ids.length < 3 && pool.length) ids.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
      const base = {};
      for (const id of ids) { const r = D.RETOS.find(o => o.id === id); base[id] = st.stats[r.k] || 0; }
      st.retos = { sem: wk, ids, base, era: st.era, hechos: {}, cofre: false };
    }
    return st.retos;
  };
  V.retoMeta = (r, era) => (r.esc ? Math.round((r.n * Math.max(1, era - 1)) / 100) * 100 : r.n);
  V.retoProg = function (id) {
    const st = S(), rs = V.retos(), r = D.RETOS.find(o => o.id === id);
    return { r, n: Math.max(0, (st.stats[r.k] || 0) - (rs.base[id] || 0)), meta: V.retoMeta(r, rs.era) };
  };
  V.revisarRetos = function () {
    const st = S();
    if (!st || st.era < 2) return;
    const rs = V.retos();
    for (const id of rs.ids) {
      if (rs.hechos[id]) continue;
      const p = V.retoProg(id);
      if (p.n < p.meta) continue;
      rs.hechos[id] = 1;
      const r = { gold: 300 * st.era, gems: 3 + st.era, coins: 10 };
      G().give(r);
      toast('Reto del Rey cumplido: ' + p.r.name + '. +' + U.fmt(r.gold) + ' de oro, +' + r.gems + ' gemas y +' + r.coins + ' monedas.', 'epic');
    }
    if (!rs.cofre && rs.ids.every(id => rs.hechos[id])) {
      rs.cofre = true;
      const r = { gems: 10 * st.era, coins: 30 };
      G().give(r);
      let obj = '';
      if (PK.Heroes && S().heroes) { const it = PK.Heroes.crearObjeto(0.6 + st.era / 20, 1); PK.Heroes.guardarObjeto ? PK.Heroes.guardarObjeto(it) : S().heroes.inv.push(it); obj = ' y un objeto raro para tus héroes'; }
      toast('¡Cofre real! Cumpliste los 3 Retos del Rey de la semana: +' + r.gems + ' gemas, +' + r.coins + ' monedas' + obj + '.', 'epic');
      if (PK.Sfx) PK.Sfx.play('era');
    }
  };

  // ---------- V8. Tienda del reino ----------
  V.comprar = function (id) {
    const st = S(), it = D.TIENDA.find(o => o.id === id);
    if (!it || it.premio || st.tienda.tengo[id]) return false; // V7: los premios de escalera no se venden
    if (!PK.Platform.spendCoins(it.precio, 'tienda del reino')) { toast('Te faltan monedas del reino (' + it.precio + ').', 'warn'); return false; }
    st.tienda.tengo[id] = 1;
    if (it.t !== 'cola') V.usar(id);
    else V.invalidar();
    toast('Compraste ' + it.name + '.', 'good');
    return true;
  };
  V.usar = function (id) {
    const st = S(), it = D.TIENDA.find(o => o.id === id);
    if (!it || (id && !st.tienda.tengo[id])) return false;
    st.tienda[it.t] = st.tienda[it.t] === id ? null : id; // tocar lo que ya se usa lo saca
    aplicarTienda();
    return true;
  };
  function aplicarTienda() {
    const st = S(), t = st && st.tienda;
    if (!t) return;
    const c = t.color && D.TIENDA.find(o => o.id === t.color);
    if (PK.Sprites && PK.Sprites.colorPropio !== undefined) PK.Sprites.colorPropio(c ? c.col : null);
    const m = t.marco && D.TIENDA.find(o => o.id === t.marco);
    if (typeof document !== 'undefined' && document.documentElement) document.documentElement.style.setProperty('--marco', m ? m.css : 'transparent');
  }
  // Fuegos artificiales al llegar a una era (si los compraste)
  V.fuegos = function () {
    const st = S(), f = st.tienda && st.tienda.fuegos, tc = G().buildings.find(b => b.owner === 'p' && b.type === 'tc');
    if (!f || !tc || !PK.Render || !PK.Render.burst) return;
    const cols = f === 'f_dorados' ? [[255, 220, 110], [255, 190, 60], [255, 245, 200]] : [[232, 184, 74], [220, 80, 90], [90, 170, 230], [120, 200, 110], [200, 120, 220]];
    for (let k = 0; k < 14; k++) setTimeout(() => PK.Render.burst(tc.cx + (Math.random() - 0.5) * 10, tc.cy + (Math.random() - 0.5) * 10, cols[k % cols.length], 34), k * 220);
  };
})();
