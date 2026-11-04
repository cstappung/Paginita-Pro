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
    cache = null;
  };

  // ---------- Bonos ----------
  let cache = null, cacheEst = -1;
  V.invalidar = () => { cache = null; if (G().invalidateCaps) G().invalidateCaps(); };
  function sumar() {
    const st = S(), o = {}, add = ef => { for (const k in ef || {}) o[k] = (o[k] || 0) + ef[k]; };
    for (const id in st.arbol || {}) if (D.ARBOL[id]) add(D.ARBOL[id].ef);
    for (const c of (st.cartas && st.cartas.tomadas) || []) if (D.CARTAS[c.id]) add(D.CARTAS[c.id].ef);
    add(V.estacionDe().ef);
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
    return U.clamp(1 + s, 0.5, D.VIDA_TOPE);
  };
  // Lo que suma por G.perk (como los decretos). gatherP queda fuera: va topado en recoleccion.
  V.perk = k => (k === 'gatherP' ? 0 : V.bono(k));

  // ---------- V3. Estaciones ----------
  const DUR = () => D.ESTACION_H * 3600 * 1000;
  V.estacion = (t) => Math.floor((t || Date.now()) / DUR()) % 4;
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
  let estVista = null;
  V.tick = function () {
    const st = S();
    if (!st || G().offline) return;
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
})();
