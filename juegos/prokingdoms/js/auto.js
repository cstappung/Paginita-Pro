// Automatización: el Capataz reparte a los aldeanos ociosos según tus prioridades, el Centro Urbano puede
// entrenar sin parar y los Maestros de Obras toman solas las mejoras de una cola. Todo sigue funcionando
// mientras no estás (dentro del cálculo offline).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const A = (PK.Auto = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;

  A.RES = ['food', 'wood', 'stone', 'gold', 'ore', 'marble', 'gems'];
  A.QMAX = 6;
  A.init = function (st) {
    st.auto = Object.assign({ idle: true, work: true, train: false, rebal: true, plan: 'mano', reserve: 0.15, w: { food: 4, wood: 5, stone: 2, gold: 2, ore: 0, marble: 0, gems: 0 }, serie: {} }, st.auto || {});
    if (!st.auto.serie || typeof st.auto.serie !== 'object') st.auto.serie = {};
    st.upq = (st.upq || []).filter(id => G().bById.get(id));
  };

  // Cuántos aldeanos hay en cada recurso (contando granjeros como comida).
  A.counts = function () {
    const c = {};
    let n = 0;
    for (const u of G().units) {
      if (u.owner !== 'p' || u.kind !== 'v' || !u.task) continue;
      const r = u.task.t === 'gather' ? u.task.res : u.task.t === 'farm' ? G().granjaRes(G().bById.get(u.task.b)) : null;
      if (r) { c[r] = (c[r] || 0) + 1; n++; }
    }
    return { c, n };
  };

  // Recurso para ese aldeano: cerca de él y de su punto de acopio, sin amontonarse (G.bestNode).
  function targetFor(u, res, used) {
    const g = G();
    // granjas, muelles y (en el mar) salinas: cada una da lo suyo, y solo las de la isla del aldeano (pk-28)
    const isla = otraIsla(u);
    {
      let best = null, bd = 1e9;
      for (const b of g.buildings) {
        if (b.owner !== 'p' || !g.esGranja(b) || g.granjaRes(b) !== res || !b.done || (b.farmer !== null && g.uById.get(b.farmer))) continue;
        if (isla(b.cx, b.cy)) continue;
        const d = U.dist(u.x, u.y, b.cx, b.cy);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) return { kind: 'building', obj: best };
    }
    const n = g.bestNode(res, u.x, u.y, 'p', { used, max: 100 });
    return n ? { kind: 'node', obj: n } : null;
  }
  A.targetFor = targetFor;

  // En el mar, ¿ese punto está en otra isla que la del aldeano? (en la tierra, nunca)
  function otraIsla(u) {
    if (!G().enMar() || !PK.Arch || !u) return () => false;
    const i = PK.Arch.islaDe(u.x, u.y);
    return (x, y) => PK.Arch.islaDe(x, y) !== i;
  }
  // Un taller con puesto libre y con qué trabajar (insumos y abastecimiento).
  function openShop(u) {
    const g = G(), isla = otraIsla(u);
    for (const b of g.buildings) {
      if (b.owner !== 'p' || !b.done || !b.def.recipe || b.workers.length >= g.slots(b)) continue;
      if (isla(b.cx, b.cy)) continue;
      const rc = D.RECIPES[b.def.recipe];
      if (!g.reserveOk(rc.in, Object.keys(rc.out)[0], b) && !PK.Logi.carts().length) continue;
      if (!PK.Logi.puede(b) || (b.paradoHasta && g.ahora() < b.paradoHasta)) continue; // parado: no volver a mandarlos
      if (!PK.Logi.supplied(b)) continue; // sin abastecimiento no sirve de nada
      const reserved = g.units.filter(o => o.task && o.task.t === 'work' && o.task.b === b.id && !o.inside).length;
      if (b.workers.length + reserved >= g.slots(b)) continue;
      return b;
    }
    return null;
  }
  function assignIdle(u, st) {
    const g = G();
    // primero, puestos libres en talleres que tengan insumos
    if (st.auto.work) {
      const b = openShop(u);
      if (b) { g.command([u], { kind: 'building', obj: b }, true); return true; }
    }
    const w = st.auto.w, sum = A.RES.reduce((s, r) => s + (w[r] || 0), 0);
    if (!sum) return false;
    const { c, n } = A.counts();
    const order = A.RES.filter(r => w[r] > 0).sort((a, b) => (w[b] / sum - (c[b] || 0) / (n + 1)) - (w[a] / sum - (c[a] || 0) / (n + 1)));
    for (const r of order) {
      const t = targetFor(u, r);
      if (t && g.command([u], t, true)) return true;
    }
    return false;
  }

  // Si varios aldeanos llevan rato ociosos es porque se agotó lo que conoces: antes no lo decía nada y la aldea
  // quedaba parada en el Centro Urbano. Avisa (como mucho cada 3 minutos) qué falta y qué hacer.
  let hintT = -1e9;
  function idleHint(g) {
    if (g.offline || !PK.UI) return;
    const idle = g.units.filter(u => u.owner === 'p' && u.kind === 'v' && !u.task && !u.inside && !u.hold && u.idleT > 20).length;
    if (idle < 3 || performance.now() - hintT < 180000) return;
    hintT = performance.now();
    if (g.encierro) { // explorar no sirve de nada: el problema es el patio cerrado (G.checkEncierro)
      PK.UI.toast(idle + ' aldeanos sin trabajo: tu Centro Urbano quedó encerrado por edificios. Mueve o demuele uno de los marcados en rojo.', 'warn',
        g.encierro.puertas.length ? { label: 'Ver edificios', fn: g.verPuertas } : null);
      return;
    }
    const w = S().auto.w, miss = A.RES.filter(r => w[r] > 0 && !A.jobAvailable(r));
    if (!miss.length) return;
    const names = miss.map(r => D.RES[r].name.toLowerCase()).join(', ');
    PK.UI.toast(idle + ' aldeanos sin trabajo: no queda ' + names + ' a su alcance. Explora más lejos (un explorador del Puesto), pon granjas o espera a que rebrote.', 'warn',
      { label: 'Aldeanos', fn: () => PK.UI.openForeman() });
  }

  // ---------- Puestos avanzados guiados y eficiencia (A5 del plan) ----------
  // Campamento que sirve de acopio para cada recurso del mapa.
  A.CAMPO = { wood: 'lumber', stone: 'mining', gold: 'mining', ore: 'mining', marble: 'mining', gems: 'mining', food: 'mill' };
  // Lugar libre donde ese campamento se puede construir, lo más cerca posible de un recurso (o null).
  A.lugarJunto = function (tipo, n) {
    const g = G(), def = D.BUILD[tipo];
    for (let r = 1; r <= 8; r++) for (let y = n.y - r - def.h + 1; y <= n.y + r; y++) for (let x = n.x - r - def.w + 1; x <= n.x + r; x++) {
      if (Math.max(Math.abs(x + def.w / 2 - n.x - 0.5), Math.abs(y + def.h / 2 - n.y - 0.5)) > r + def.w / 2) continue;
      if (g.canPlace(tipo, x, y)) return [x, y];
    }
    return null;
  };
  // Deja el fantasma del campamento ya ubicado y lleva la cámara allí: solo falta confirmar.
  A.proponerCampo = function (tipo, x, y) {
    PK.Input.startPlacing(tipo);
    PK.Render.ghost = { x, y, ok: G().canPlace(tipo, x, y) };
    G().placing.armed = true;
    PK.Render.centerOn(x + 1, y + 1);
    PK.UI.refreshPanel(true);
  };
  // ¿Se acabó ese recurso cerca de los puntos de acopio? Devuelve el más cercano lejos (hasta 70 casillas).
  A.lejos = function (res) {
    const g = G(), drops = g.buildings.filter(b => b.owner === 'p' && b.done && b.def.drop && b.def.drop.includes(res));
    if (!drops.length || drops.some(b => W.nearestNode(res, b.cx, b.cy, 20, 'p'))) return null;
    const tc = drops.find(b => b.type === 'tc') || drops[0], n = W.nearestNode(res, tc.cx, tc.cy, 70, 'p');
    if (!n) return null;
    const d = Math.min(...drops.map(b => U.dist(b.cx, b.cy, n.x, n.y)));
    return { n, d: Math.round(d) };
  };
  const NOMBRE_NODO = { wood: 'un bosque', stone: 'una cantera', gold: 'una mina de oro', ore: 'una veta de hierro', marble: 'una cantera de mármol', gems: 'una veta de gemas' };
  const avisoLejos = {};
  function revisarLejos(g, st) {
    for (const res of ['wood', 'stone', 'gold', 'ore', 'marble', 'gems']) {
      if (!(st.auto.w[res] > 0) || (avisoLejos[res] && performance.now() - avisoLejos[res] < 600000)) continue;
      const lj = A.lejos(res), tipo = A.CAMPO[res];
      if (!lj || !g.isUnlocked(tipo) || g.countAll(tipo) >= g.maxCount(tipo)) continue;
      const p = A.lugarJunto(tipo, lj.n);
      if (!p) continue;
      avisoLejos[res] = performance.now();
      PK.UI.toast('Se acabó ' + D.RES[res].name.toLowerCase() + ' cerca. Hay ' + NOMBRE_NODO[res] + ' a ' + lj.d + ' casillas: ¿construir un ' + D.BUILD[tipo].name + ' allí?', 'warn',
        { label: 'Construir allí', fn: () => A.proponerCampo(tipo, p[0], p[1]) });
      return; // de a uno
    }
  }
  // Eficiencia: cuánto del tiempo los recolectores de cada recurso caminan en vez de recolectar (se mide en vivo,
  // una muestra por segundo con memoria de unos minutos). Más de la mitad caminando: falta un acopio más cerca.
  const efi = {};
  function medir(g) {
    for (const r in efi) { efi[r].walk *= 0.985; efi[r].work *= 0.985; }
    for (const u of g.units) {
      if (u.owner !== 'p' || u.kind !== 'v' || !u.task || u.task.t !== 'gather' || u.inside) continue;
      const e = efi[u.task.res] || (efi[u.task.res] = { walk: 0, work: 0 });
      if (u.mode === 'work') e.work++; else if (u.path && u.path.length) e.walk++;
    }
  }
  A.eficiencia = function (res) {
    const e = efi[res];
    return e && e.walk + e.work >= 15 ? e.walk / (e.walk + e.work) : null;
  };
  // Para el aviso de eficiencia: el recurso donde más trabajan, y un lugar para su campamento.
  A.acopioCerca = function (res) {
    const g = G(), cnt = new Map();
    for (const u of g.units) if (u.owner === 'p' && u.task && u.task.t === 'gather' && u.task.res === res && W.nodes[u.task.node]) cnt.set(u.task.node, (cnt.get(u.task.node) || 0) + 1);
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0], tipo = A.CAMPO[res];
    if (!top || !tipo) return null;
    const p = A.lugarJunto(tipo, W.nodes[top[0]]);
    return p ? { tipo, x: p[0], y: p[1] } : null;
  };

  // los consejeros del Salón del Consejo (js/consejo.js) corren en la misma pasada, también sin conexión
  A.consejo = el => { if (PK.Consejo) PK.Consejo.tick(el); };
  let t = 0, shopT = 0, rebalT = 0, metaT = 0, lejosT = 0;
  A.tick = function (dt) {
    const st = S(), g = G();
    if (!st || !st.auto) return;
    for (const u of g.units) if (u.owner === 'p' && u.kind === 'v') u.idleT = !u.task && !u.inside ? (u.idleT || 0) + dt : 0;
    t += dt;
    if (t < 1) return;
    const el = t; // segundos desde la última pasada (sin conexión llegan de a 60)
    t = 0;
    A.consejo(el);
    if (!g.offline) { medir(g); if ((lejosT += el) >= 30) { lejosT = 0; revisarLejos(g, st); } }
    if (st.auto.idle) {
      idleHint(g);
      let k = 0;
      for (const u of g.units) {
        if (u.owner !== 'p' || u.kind !== 'v' || u.task || u.inside || u.hold || u.idleT < 3 || u.scared > 0) continue;
        if (assignIdle(u, st)) u.idleT = 0;
        if (++k > 12) break; // reparte de a poco para no buscar rutas de golpe
      }
    }
    // A1: cada 20 s mueve hasta 3 aldeanos del Capataz al trabajo más lejos de su objetivo, solo si la diferencia
    // pasa del 8% de la población (para que no vayan y vengan). Corre también en el cálculo sin conexión.
    if (st.auto.plan === 'meta' && (metaT += el) >= 60) { metaT = 0; Object.assign(st.auto.w, A.metaWeights()); }
    if (st.auto.rebal && (rebalT += el) >= 20) { rebalT = 0; A.rebalance(3, 0.08 * A.villagers().length); }
    // «Ocupar los talleres» también con todos ocupados: cada 10 s pasa a un recolector que puso el Capataz (nunca uno
    // que mandaste tú) a un taller con puesto libre. Antes solo usaba ociosos y, sin ociosos, no hacía nada (playtest).
    if (st.auto.work && (shopT += el) >= 10) { // segundos, no pasadas: sin conexión cada pasada trae 60 s
      shopT = 0;
      const b = openShop();
      if (b) {
        let best = null, bd = 1e9;
        for (const u of g.units) {
          if (u.owner !== 'p' || u.kind !== 'v' || u.inside || u.hold || !u.task || u.task.m || u.task.t !== 'gather') continue;
          if (g.enMar() && PK.Arch && PK.Arch.islaDe(u.x, u.y) !== PK.Arch.islaDe(b.cx, b.cy)) continue; // otra isla
          const d = U.dist(u.x, u.y, b.cx, b.cy);
          if (d < bd) { bd = d; best = u; }
        }
        if (best) g.command([best], { kind: 'building', obj: b }, true);
      }
    }
    // talleres parados (sin insumos, en reserva o con el almacén lleno): sus trabajadores salen a recolectar
    if (st.auto.work) {
      for (const b of g.buildings) {
        if (b.owner !== 'p' || !b.def.recipe || !b.workers.length) continue;
        // si una carreta o una cinta ya trae lo que falta, no cuenta como parado
        const coming = b.status === 'Faltan insumos' && (PK.Logi.carts().some(c => c.job && c.job.to === b.id) || st.logi.belts.some(x => x.b === b.id && x.items.length));
        b.stallT = b.status === 'Produciendo' || coming ? 0 : (b.stallT || 0) + el;
        if (b.stallT < 20) continue;
        b.stallT = 0;
        b.paradoHasta = g.ahora() + 90e3; // por un rato nadie vuelve a ocuparlo (ver openShop)
        // los que pusiste tú se quedan: una orden tuya no la deshace el Capataz
        for (const id of b.workers.slice()) { const u = g.uById.get(id); if (u && !(u.task && u.task.m)) { g.release(u); u.task = null; u.mode = 'idle'; } }
      }
    }
    if (st.auto.train) {
      for (const b of g.buildings) {
        if (b.owner !== 'p' || b.type !== 'tc' || !b.done || b.queue.length >= 2) continue;
        const queued = g.buildings.reduce((s, o) => s + (o.owner === 'p' ? o.queue.length : 0), 0);
        // deja un lugar libre para el explorador que permite el Puesto: si no, «entrenar sin parar» se comía toda la población
        const room = g.scoutCount() < g.scoutMax() ? 1 : 0;
        if (g.pop() + queued + room < g.popCap() && st.res.food >= D.VILLAGER.cost.food + 30) g.train(b, 1);
      }
      // …y ese lugar se usa: si falta un explorador y todavía queda mapa a su alcance, el Puesto entrena uno. Sin esto el
      // pueblo podía quedarse con lo que vio al empezar (1% del mapa) y, agotado eso, con todos ociosos (piloto de pk-17).
      const post = g.buildings.find(b => b.owner === 'p' && b.done && b.type === 'scout');
      if (post && !post.queue.length && g.scoutCount() < g.scoutMax() && st.flags.scoutDoneR !== g.exploreRange() && g.pop() < g.popCap() && g.canAfford(D.SCOUT.cost)) g.trainScout(post);
    }
    // cola de obras
    // en orden, pero saltando lo que todavía no se puede pagar: antes la primera obra impagable trababa toda la
    // cola y los maestros quedaban libres aunque las de abajo sí alcanzaran (playtest)
    st.upq = st.upq.filter(id => { const b = g.bById.get(id); return b && b.owner === 'p' && !b.upg && b.lvl < g.maxLvl(b.type) && !b.def.noUp; });
    for (let i = 0; i < st.upq.length && g.buildersBusy() < g.builders();) {
      const b = g.bById.get(st.upq[i]);
      if (!b.done || !g.canAfford(g.upCost(b))) { i++; continue; }
      g.upgrade(b);
      st.upq.splice(i, 1);
    }
    A.serieTick(g, st);
  };

  // ---------- Mejoras en serie ----------
  // Subir 12 casas una por una cansa. Para los tipos de A.SERIE_TIPOS de los que tienes A.SERIE_MIN o más, eliges un nivel
  // (st.auto.serie[tipo]; A.SERIE_ERA = siempre el máximo de la era) y el Capataz los va subiendo, del más bajo al
  // más alto. Tu cola de obras va primero (con algo en ella no empieza nada), deja un maestro libre si tienes más
  // de uno, y con «Meta de era» no gasta lo que la era pide. Corre también sin conexión, como el resto de A.tick.
  A.SERIE_MIN = 1; // era 3: con 2 molinos o 2 granjas no aparecían y el dueño solo podía elegir dos tipos
  A.SERIE_ERA = 99;
  const enSerie = (b, obj) => b.owner === 'p' && !!obj[b.type];
  // Solo lo repetitivo: vivienda y recolección (en el mar, los mismos tipos con otro nombre, más las Salinas).
  // Talleres, bodegas, torres y edificios únicos quedan fuera a propósito: subirlos es una decisión, no un trámite.
  A.SERIE_TIPOS = ['house', 'farm', 'lumber', 'mining', 'mill', 'muelle', 'salinas'];
  A.serieOk = type => A.SERIE_TIPOS.includes(type) && !!D.BUILD[type] && !D.BUILD[type].noUp;
  // Los tipos que califican, con cuántos hay y el rango de niveles: [{type, n, min, max}], los más numerosos primero.
  A.serieTipos = function () {
    const por = {};
    for (const b of G().buildings) {
      if (b.owner !== 'p' || !b.done || !A.serieOk(b.type)) continue;
      const x = por[b.type] || (por[b.type] = { type: b.type, n: 0, min: Infinity, max: 0 });
      x.n++; x.min = Math.min(x.min, b.lvl); x.max = Math.max(x.max, b.lvl);
    }
    return Object.values(por).filter(x => x.n >= A.SERIE_MIN).sort((a, b) => b.n - a.n || a.type.localeCompare(b.type));
  };
  A.serieNivel = type => { const v = (S().auto.serie || {})[type] || 0; return v >= A.SERIE_ERA ? G().maxLvl(type) : Math.min(v, G().maxLvl(type)); };
  A.setSerie = function (type, v) { const s = S().auto.serie; if (v > 0) s[type] = v; else delete s[type]; };
  // ¿Paga sin tocar lo que guarda la meta de era ni lo que pide la próxima obra de tu cola (G.colaNecesita)?
  function cabeMeta(g, st, cost) {
    const cola = g.colaNecesita();
    for (const r in cost) if ((st.res[r] || 0) - cost[r] < (cola[r] || 0)) return false;
    if (st.auto.plan !== 'meta') return true;
    const nec = g.metaNecesita();
    for (const r in cost) if ((st.res[r] || 0) - cost[r] < (nec[r] || 0)) return false;
    return true;
  }
  A.cabeMeta = cost => cabeMeta(G(), S(), cost);
  // La cola de obras es tuya (pedido del dueño, pk-40): las automatizaciones (Mejoras en serie, Maestro mayor) ya no
  // la llenan ni esperan a que se vacíe. Solo ceden el paso si algo de la cola ya se puede pagar (un maestro lo toma
  // en esta misma pasada); lo que espera recursos no las frena.
  A.colaLista = function () {
    const g = G();
    return S().upq.some(id => { const b = g.bById.get(id); return b && b.done && !b.upg && g.canAfford(g.upCost(b)); });
  };
  // Empieza una mejora sin pasar por la cola, en silencio (lo usan las automatizaciones).
  A.mejorarYa = function (b) {
    const g = G(), ui = PK.UI;
    if (ui) ui.mute = true;
    try { return !!g.upgrade(b); } finally { if (ui) ui.mute = false; }
  };
  A.serieTick = function (g, st) {
    const obj = st.auto.serie;
    if (!obj || A.colaLista()) return;
    let tipos = null;
    for (let k = 0; k < 4; k++) {
      const total = g.builders(), busy = g.buildersBusy();
      if (busy >= total) return;
      const enCurso = g.buildings.filter(b => b.upg && enSerie(b, obj)).length;
      if (enCurso >= (total > 1 ? total - 1 : 1)) return;
      if (!tipos) { tipos = new Set(A.serieTipos().map(x => x.type)); if (!tipos.size) return; }
      let mejor = null, mc = 0;
      for (const b of g.buildings) {
        if (!enSerie(b, obj) || !tipos.has(b.type) || !b.done || b.upg || b.lvl >= A.serieNivel(b.type)) continue;
        if (mejor && b.lvl > mejor.lvl) continue;
        const cost = g.upCost(b);
        if (!g.canAfford(cost) || !cabeMeta(g, st, cost)) continue;
        const c = Object.values(cost).reduce((s, v) => s + v, 0);
        if (!mejor || b.lvl < mejor.lvl || c < mc) { mejor = b; mc = c; }
      }
      if (!mejor) return;
      if (!A.mejorarYa(mejor)) return;
      st.auto.serieN = (st.auto.serieN || 0) + 1;
    }
  };

  // ---------- Trabajos ----------
  // Lo que elige el jugador para sus aldeanos, desde el panel (aldeanos elegidos) o desde la ventana Aldeanos.
  // Una orden así queda marcada (task.m): el Capataz no la cambia.
  A.JOBS = {
    food: { name: 'Comida', icon: 'food', hint: 'granjas libres, bayas o caza' },
    wood: { name: 'Madera', icon: 'wood' },
    stone: { name: 'Piedra', icon: 'stone' },
    gold: { name: 'Oro', icon: 'gold' },
    ore: { name: 'Hierro', icon: 'ore' },
    marble: { name: 'Mármol', icon: 'marble' },
    gems: { name: 'Gemas', icon: 'gems' },
    work: { name: 'Talleres', icon: 'tools', hint: 'puestos libres de los talleres' },
    dig: { name: 'Excavar', icon: 'scroll', hint: 'ruinas descubiertas' },
  };
  A.jobOf = function (u) {
    const t = u.task;
    if (!t) return u.inside ? 'work' : 'idle';
    if (t.t === 'gather') return t.res;
    if (t.t === 'farm') return G().granjaRes(G().bById.get(t.b)); // las Salinas del mar dan salitre
    if (t.t === 'work') return 'work';
    if (t.t === 'dig') return 'dig';
    return 'other';
  };
  A.villagers = () => G().units.filter(u => u.owner === 'p' && u.kind === 'v');
  A.jobCounts = function () {
    const c = { idle: 0 };
    for (const u of A.villagers()) { const j = A.jobOf(u); c[j] = (c[j] || 0) + 1; }
    return c;
  };
  // ¿Hay dónde trabajar en eso? (para apagar los botones que no llevan a nada)
  A.jobAvailable = function (job) {
    const g = G();
    if (job === 'work') return g.buildings.some(b => b.owner === 'p' && b.done && b.def.recipe && b.workers.length < g.slots(b) && PK.Logi.supplied(b));
    if (job === 'dig') return W.pois.some(p => p.kind === 'ruin' && g.poiState(p) && g.poiState(p).f && !g.poiState(p).d);
    if (g.buildings.some(b => b.owner === 'p' && g.esGranja(b) && g.granjaRes(b) === job && b.done && (b.farmer === null || !g.uById.get(b.farmer)))) return true;
    const [hx, hy] = D.PLAYER_HOME;
    return !!g.bestNode(job, hx, hy, 'p', { r: 40, max: 100 });
  };
  // Por qué no hay de un recurso: ¿nunca lo viste o se agotó todo lo que conoces? (y cuándo vuelve lo primero).
  A.why = function (res) {
    const now = Date.now();
    let known = 0, soon = Infinity;
    for (const n of W.nodes) {
      if (n.temp || D.NODES[n.kind].res !== res || !W.fog[n.y * W.W + n.x] || !W.canUse(n, 'p')) continue;
      known++;
      if (!n.dead) return { known, alive: true };
      const def = D.NODES[n.kind];
      const left = def.regen ? 3600 / (def.regen * (W.isShared(n) ? 1 : 0.6) * n.max) : def.regrow - (now - n.t) / 1000;
      soon = Math.min(soon, Math.max(60, left));
    }
    return { known, alive: false, soon };
  };
  A.whyText = function (res) {
    const w = A.why(res);
    if (!w.known) return 'no conoces dónde hay: explora';
    if (w.alive) return 'lo que conoces queda lejos o encerrado';
    return 'se agotó lo que conoces (vuelve en aprox. ' + U.fmtTime(w.soon) + '): explora más lejos';
  };
  function jobTarget(u, job, used) {
    const g = G();
    if (job === 'work') {
      let best = null, bd = 1e9;
      for (const b of g.buildings) {
        if (b.owner !== 'p' || !b.done || !b.def.recipe || !PK.Logi.supplied(b)) continue;
        const going = g.units.filter(o => o !== u && o.task && o.task.t === 'work' && o.task.b === b.id && !o.inside).length + (used.get('b' + b.id) || 0);
        if (b.workers.length + going >= g.slots(b)) continue;
        const d = U.dist(u.x, u.y, b.cx, b.cy) - (PK.Logi.nearStore(b) ? 20 : 0);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) used.set('b' + best.id, (used.get('b' + best.id) || 0) + 1);
      return best ? { kind: 'building', obj: best } : null;
    }
    if (job === 'dig') {
      let best = null, bd = 1e9;
      for (const p of W.pois) {
        const ps = g.poiState(p);
        if (p.kind !== 'ruin' || !ps || !ps.f || ps.d) continue;
        const d = U.dist(u.x, u.y, p.x, p.y);
        if (d < bd) { bd = d; best = p; }
      }
      return best ? { kind: 'poi', obj: best } : null;
    }
    const t = targetFor(u, job, used);
    if (t && t.kind === 'node') used.set(t.obj.id, (used.get(t.obj.id) || 0) + 1);
    if (t && t.kind === 'building') used.set('f' + t.obj.id, 1);
    return t;
  }
  // Pone a esos aldeanos en ese trabajo. Devuelve cuántos.
  A.setJob = function (units, job) {
    const used = new Map(), g = G();
    let n = 0;
    for (const u of units) {
      if (u.kind !== 'v' || u.owner !== 'p') continue;
      if (A.jobOf(u) === job && u.task) { n++; continue; }
      const t = jobTarget(u, job, used);
      if (!t) break;
      if (g.command([u], t, false)) n++;
    }
    if (!n) PK.UI.toast(job === 'work' ? 'No hay puestos libres en los talleres.' : job === 'dig' ? 'No hay ruinas descubiertas por excavar.' : 'No conoces ' + A.JOBS[job].name.toLowerCase() + ' a la que puedan llegar. Explora o reclama más tierra.', 'warn');
    return n;
  };
  // +1 en un trabajo: primero un ocioso; si no hay, el que esté en el trabajo con más gente.
  A.addJob = function (job) {
    const vs = A.villagers().filter(u => !(u.scared > 0)), c = A.jobCounts(); // un susto negativo ya pasó
    let u = vs.find(o => A.jobOf(o) === 'idle');
    if (!u) {
      const from = Object.keys(c).filter(k => k !== job && k !== 'idle' && k !== 'other' && c[k] > 0).sort((a, b) => c[b] - c[a])[0];
      u = from && vs.filter(o => A.jobOf(o) === from).sort((a, b) => (a.carry || 0) - (b.carry || 0))[0];
    }
    if (!u) { PK.UI.toast('No tienes aldeanos libres: entrena más en el Centro Urbano.', 'warn'); return false; }
    return A.setJob([u], job) > 0;
  };
  // Reequilibrar al cambiar una prioridad (B5 del plan): el Capataz solo repartía ociosos, así que con todos
  // ocupados subir «Piedra» no movía a nadie (137 en madera, 0 en piedra). Mueve hasta `max` aldeanos que puso
  // él (nunca una orden tuya, task.m) desde lo que está sobre su objetivo (o con la bodega llena) hacia lo que
  // está más abajo. Devuelve cuántos movió.
  // umbral: solo mueve si lo que falta (y lo que sobra) pasa de esa cantidad de aldeanos; el reequilibrio
  // continuo (A1) usa el 8% de la población, para que no vayan y vengan.
  A.rebalance = function (max, umbral) {
    const st = S(), g = G(), w = st.auto.w, sum = A.RES.reduce((s, r) => s + (w[r] || 0), 0);
    if (!sum) return 0;
    const { c, n } = A.counts(), meta = r => ((w[r] || 0) / sum) * n, gap = Math.max(0.5, umbral || 0);
    const ok = {}; // ¿hay dónde trabajar en eso? (se pregunta una vez por recurso)
    let moved = 0;
    for (let k = 0; k < (max || 10); k++) {
      const sobra = r => (g.isFull(r) ? c[r] || 0 : (c[r] || 0) - meta(r));
      const to = A.RES.filter(r => w[r] > 0 && !g.isFull(r) && meta(r) - (c[r] || 0) >= gap && (ok[r] !== undefined ? ok[r] : (ok[r] = A.jobAvailable(r))))
        .sort((a, b) => (meta(b) - (c[b] || 0)) - (meta(a) - (c[a] || 0)))[0];
      if (!to) break;
      const froms = A.RES.filter(r => r !== to && sobra(r) >= Math.max(1, gap)).sort((a, b) => sobra(b) - sobra(a));
      let u = null;
      for (const from of froms) {
        u = A.villagers().filter(o => o.task && !o.task.m && !o.inside && A.jobOf(o) === from).sort((a, b) => (a.carry || 0) - (b.carry || 0))[0];
        if (u) { c[from]--; break; }
      }
      if (!u) break;
      const t = targetFor(u, to);
      if (!t || !g.command([u], t, true)) { ok[to] = false; c[A.jobOf(u)] = (c[A.jobOf(u)] || 0) + 1; continue; }
      c[to] = (c[to] || 0) + 1; moved++;
    }
    return moved;
  };
  // ---------- Planes de prioridades (A2) ----------
  // Listos para elegir; «A mano» es lo de siempre (tocar + o − vuelve a «A mano»). «Meta de era» mira cuánto
  // falta para la próxima era y para la cola de obras, pasado a recursos del mapa, y se recalcula cada minuto.
  A.PLANES = {
    mano: { name: 'A mano', help: 'tú eliges cada prioridad' },
    equilibrado: { name: 'Equilibrado', help: 'un poco de todo', w: { food: 4, wood: 4, stone: 3, gold: 3, ore: 1, marble: 1, gems: 1 } },
    obras: { name: 'Construcción', help: 'madera y piedra', w: { food: 2, wood: 5, stone: 5, gold: 1, ore: 0, marble: 0, gems: 0 } },
    industria: { name: 'Industria', help: 'hierro, mármol y talleres', w: { food: 2, wood: 3, stone: 2, gold: 1, ore: 5, marble: 4, gems: 1 } },
    guerra: { name: 'Guerra', help: 'comida y oro para tropas', w: { food: 5, wood: 2, stone: 1, gold: 5, ore: 2, marble: 0, gems: 0 } },
    tesoro: { name: 'Tesoro', help: 'oro y gemas', w: { food: 2, wood: 2, stone: 1, gold: 5, ore: 0, marble: 1, gems: 5 } },
    meta: { name: 'Meta de era', help: 'lo que falta para la próxima era y la cola de obras' },
  };
  // Cuánto de cada recurso del mapa hace falta para un costo (los productos se pasan a lo que piden sus recetas).
  function crudo(cost, out, k) {
    for (const r in cost) {
      const n = cost[r] * (k || 1);
      if (D.RECIPES[r]) { const rc = D.RECIPES[r]; for (const i in rc.in) crudo({ [i]: rc.in[i] }, out, n / rc.out[r]); }
      else if (A.RES.includes(r)) out[r] = (out[r] || 0) + n;
    }
    return out;
  }
  A.crudo = crudo;
  A.metaWeights = function () {
    // lo que falta de cada cosa del costo, pasado a materia prima; lo que sobra en bodega (más allá de lo que el
    // costo pide directo) cubre parte de lo que piden las recetas
    const st = S(), g = G(), cost = {};
    const suma = c => { for (const r in c) cost[r] = (cost[r] || 0) + c[r]; };
    if (!st.eraProg) suma(D.eraCost(st.era + 1));
    for (const id of st.upq) { const b = g.bById.get(id); if (b) suma(g.upCost(b)); }
    const falta0 = {};
    for (const r in cost) falta0[r] = Math.max(0, cost[r] - (st.res[r] || 0));
    const crudoFalta = crudo(falta0, {}), falta = {};
    for (const r of A.RES) falta[r] = Math.max(0, (crudoFalta[r] || 0) - Math.max(0, (st.res[r] || 0) - (cost[r] || 0)));
    const top = Math.max(...A.RES.map(r => falta[r]));
    if (!top) return Object.assign({}, A.PLANES.equilibrado.w);
    const w = {};
    for (const r of A.RES) w[r] = falta[r] ? Math.max(1, Math.round((5 * falta[r]) / top)) : 0;
    if (!w.food) w.food = 1; // siempre algo de comida: entrenar y las tropas la piden
    return w;
  };
  A.setPlan = function (id) {
    const a = S().auto, p = A.PLANES[id];
    if (!p) return;
    a.plan = id;
    if (p.w) Object.assign(a.w, p.w);
    if (id === 'meta') Object.assign(a.w, A.metaWeights());
    A.rebalance(10);
  };
  // −1: uno de ese trabajo queda ocioso a propósito (el Capataz no lo reparte hasta que le des otra cosa).
  A.removeJob = function (job) {
    const u = A.villagers().filter(o => A.jobOf(o) === job).sort((a, b) => (a.carry || 0) - (b.carry || 0))[0];
    if (!u) return false;
    G().release(u);
    u.mode = 'idle'; u.hold = true;
    return true;
  };
  A.freeIdle = function () { // los ociosos «a propósito» vuelven a quedar en manos del Capataz
    let n = 0;
    for (const u of A.villagers()) if (!u.task && !u.inside) { u.hold = false; u.idleT = 3; n++; }
    return n;
  };

  A.queued = b => S().upq.includes(b.id);
  A.enqueue = function (b) {
    const q = S().upq;
    if (q.includes(b.id)) return;
    if (q.length >= A.QMAX) { PK.UI.toast('La cola de obras admite ' + A.QMAX + ' mejoras.', 'warn'); return; }
    q.push(b.id);
    PK.UI.toast(b.def.name + ' en la cola de obras: un maestro lo tomará cuando haya recursos.', 'info');
  };
  A.dequeue = function (b) { const q = S().upq, i = q.indexOf(b.id); if (i >= 0) q.splice(i, 1); };
})();
