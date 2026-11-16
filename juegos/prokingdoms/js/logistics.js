// Logística, al estilo de una fábrica: cada taller tiene un depósito de entrada (insumos) y uno de salida
// (productos). Nadie los llena por arte de magia:
//  - Si el taller está a 3 casillas o menos de un almacén, se abastece y descarga solo (pero despacio).
//  - Las carretas (Carretería) llevan insumos desde los almacenes o desde otro taller, y sacan lo producido
//    hacia el taller que lo necesita o al almacén. Así se arman cadenas: madera → tablones → herramientas.
//  - Los caminos aceleran a todos; las carretas fuera del camino van lentas.
//  - Muy avanzado: cintas transportadoras que unen dos edificios y mueven todo solas, rapidísimo.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const L = (PK.Logi = { tool: null, beltFrom: null });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);

  // Qué guarda cada almacén. El Centro Urbano y el Almacén reciben de todo.
  const STORE = { tc: null, warehouse: null, granary: ['food'], mill: ['food'], lumber: ['wood'], mining: ['stone', 'gold', 'ore', 'marble', 'gems'] };
  L.isStore = b => b.def && Object.prototype.hasOwnProperty.call(STORE, b.type);
  L.storeAccepts = (b, res) => L.isStore(b) && (!STORE[b.type] || STORE[b.type].includes(res));
  L.isShop = b => !!(b.def && b.def.recipe);

  L.init = function (st) {
    const viejo = !!st.logi && !st.logi.rutas; // partida de antes de las rutas (pk-41)
    st.logi = Object.assign({ belts: [], nextBelt: 1, roads: [], rutas: [], nextRuta: 1 }, st.logi || {});
    if (!st.logi.rutas) st.logi.rutas = [];
    if (viejo) {
      const cs = L.carts();
      for (const u of cs) { dropCargo(u); u.job = null; u.ruta = null; }
      if (cs.length) st.logi.avisoRutas = 1;
    }
    for (const u of L.carts()) if (u.ruta && !st.logi.rutas.some(r => r.id === u.ruta)) u.ruta = null;
    caminos.clear();
    for (const i of st.logi.roads) W.road[i] = 1;
    for (const bl of st.logi.belts) markBelt(bl, true);
    W.roadVer++;
    L.tool = null; L.beltFrom = null;
  };
  L.save = function (st) {
    const roads = [];
    for (let i = 0; i < W.road.length; i++) if (W.road[i]) roads.push(i);
    st.logi.roads = roads;
  };

  // ---------- Depósitos de los talleres ----------
  L.bufCap = b => D.BUF * Math.max(1, G().slots(b));
  L.recipe = b => D.RECIPES[b.def.recipe];
  L.output = b => Object.keys(L.recipe(b).out)[0];
  function ensure(b) { if (!b.inb) b.inb = {}; if (!b.outb) b.outb = {}; }
  L.need = function (b, res) { ensure(b); return Math.max(0, L.bufCap(b) - (b.inb[res] || 0)); };

  // Producir: solo con lo que hay en el depósito de entrada, y solo si queda lugar en el de salida.
  L.produce = function (b, dt) {
    ensure(b);
    const g = G(), r = L.recipe(b), out = L.output(b), cap = L.bufCap(b), n = b.workers.length;
    if (L.nearStore(b)) L.direct(b, dt);
    // La reserva manda (pedido del dueño, pk-40): con la bodega bajo el mínimo el taller no produce, aunque le quede
    // insumo en su depósito de entrada o una carreta se lo traiga. Antes solo dejaba de pedir y seguía gastando lo
    // que tenía: no paraba nunca de verdad. «Producir igual» (b.sinReserva) lo salta, como siempre.
    if (g.reservaDe(b)) { b.status = 'En reserva'; b.prodAcc = Math.min(b.prodAcc, 1); return; }
    if (!n) { b.status = 'Sin trabajadores'; return; }
    b.prodAcc += (dt * n * g.prodMult(b.def.recipe, b)) / r.time;
    b.status = 'Produciendo';
    let guard = 0;
    while (b.prodAcc >= 1 && guard++ < 100000) {
      if ((b.outb[out] || 0) + r.out[out] > cap) { b.status = 'Depósito de salida lleno'; b.prodAcc = Math.min(b.prodAcc, 1); break; }
      let ok = true;
      for (const k in r.in) if ((b.inb[k] || 0) < r.in[k]) { ok = false; break; }
      if (!ok) { b.status = 'Faltan insumos'; b.prodAcc = Math.min(b.prodAcc, 1); break; }
      b.prodAcc -= 1;
      for (const k in r.in) b.inb[k] -= r.in[k];
      for (const k in r.out) { b.outb[k] = (b.outb[k] || 0) + r.out[k]; g.stat('p_' + k, r.out[k]); g.stat('p_total', r.out[k]); }
    }
  };

  // ¿Puede producir ahora? (ni frenado por la reserva ni con la salida llena). El Capataz no manda gente a uno que
  // no puede: los soltaba por «parado» y a los 3 s los volvía a mandar, en bucle (auto.js).
  L.puede = function (b) {
    ensure(b);
    const r = L.recipe(b), out = L.output(b);
    return !G().reservaDe(b) && (b.outb[out] || 0) + r.out[out] <= L.bufCap(b);
  };
  // ¿Le llega algo a este taller? (junto a un almacén, con carretas o con una cinta que lo alimenta).
  // Sin eso no recibe insumos: no se le asignan trabajadores (antes aceptaba y prometía «≈30 por minuto»).
  L.supplied = b => !!(L.nearStore(b) || S().logi.belts.some(bl => bl.b === b.id) || L.rutasHacia(b).some(r => L.cartsDe(r).length));
  L.rutasHacia = b => S().logi.rutas.filter(r => r.a === b.id);
  L.rutasDesde = b => S().logi.rutas.filter(r => r.de === b.id);
  // Almacén cercano: el taller se abastece y descarga solo, a un ritmo moderado.
  L.nearStore = function (b) {
    if (b._nsT === G().time) return b._ns;
    b._nsT = G().time;
    b._ns = null;
    for (const o of G().buildings) {
      if (o.owner !== b.owner || !o.done || !L.isStore(o)) continue;
      const dx = Math.max(o.x - (b.x + b.w), 0, b.x - (o.x + o.w)), dy = Math.max(o.y - (b.y + b.h), 0, b.y - (o.y + o.h));
      if (Math.max(dx, dy) <= D.NEAR_STORE && (!STORE[o.type] || o.type === 'tc' || o.type === 'warehouse')) { b._ns = o; break; }
    }
    return b._ns;
  };
  L.directRate = b => 2 + b.lvl;
  L.direct = function (b, dt) {
    const g = G(), st = S(), r = L.recipe(b), out = L.output(b);
    let budget = L.directRate(b) * dt;
    for (const k in r.in) {
      const want = Math.min(L.need(b, k), budget);
      if (want <= 0) continue;
      const avail = Math.max(0, st.res[k] - reserveOf(k, out, b));
      const n = Math.min(want, avail);
      if (n > 0) { st.res[k] -= n; b.inb[k] = (b.inb[k] || 0) + n; budget -= n; }
    }
    const have = b.outb[out] || 0;
    if (have > 0) { const n = Math.min(have, L.directRate(b) * dt, Math.max(0, g.cap(out) - st.res[out])); b.outb[out] -= n; st.res[out] += n; }
  };
  // Reserva que fija el Capataz: los talleres no vacían la bodega de lo que hace falta para construir.
  // Un taller con «Producir igual» (b.sinReserva) no respeta la reserva.
  function reserveOf(res, out, b) {
    const st = S(), g = G();
    if (b && b.sinReserva) return 0;
    const rm = b && PK.Game.reservaDe(b); // la meta de era guarda el insumo entero (G.reservaDe)
    if (rm && (rm.meta || rm.cola) && rm.res === res) return Infinity; // y la cola de obras (G.colaNecesita)
    if (out && g.metaPide(out)) return 0; // la meta pide lo que hace este taller
    let rv = st.auto ? st.auto.reserve || 0 : 0;
    if (out && st.res[out] < 0.05 * g.cap(out)) rv /= 3;
    return rv * g.cap(res);
  }

  // ---------- Carretas (pk-41, plan de logística L1) ----------
  // Cada carreta sigue una RUTA que elige el jugador: un origen y un destino (y, si quiere, un recurso). Va al origen,
  // carga, lo lleva y vuelve. Si en el origen no hay nada que llevar, espera ahí; si el destino está lleno, espera con
  // la carga hasta que quepa. No hay modo automático (decisión 2 del dueño): una carreta sin ruta queda parada en la
  // Carretería. Las carretas son del pueblo: no salen de tu territorio y no van a los campamentos (decisión 3).
  L.cartMax = () => G().buildings.reduce((s, b) => s + (b.owner === 'p' && b.done && b.type === 'cartwright' ? G().bst(b).carts : 0), 0);
  const beltK = () => 1 + (G().bono ? G().bono('belt') : 0); // Cintas reforzadas (árbol 2.0)
  L.cartCap = () => Math.round(G().buildings.reduce((m, b) => Math.max(m, b.owner === 'p' && b.done && b.type === 'cartwright' ? G().bst(b).cartCap : 0), D.CART.cap) * (1 + (G().best('beasthouse', 'cartBoost') + G().best('faro', 'cartBoost') + (G().bono ? G().bono('cartCap') : 0))));
  L.cartSpeed = () => G().buildings.reduce((m, b) => Math.max(m, b.owner === 'p' && b.done && b.type === 'cartwright' ? G().bst(b).cartSpeed : 0), 0) + (G().best('beasthouse', 'cartBoost') + G().best('faro', 'cartBoost'));
  L.carts = () => G().units.filter(u => u.owner === 'p' && u.kind === 'cart');
  // ---------- Carromatos (pk-43, plan de logística L3) ----------
  // Los arma el Establo de Carromatos. Vacían los campamentos (dentro y fuera de tu tierra) hacia una bodega del pueblo
  // o un taller que use lo que juntan. No pasan por puertas chicas: solo por el Gran Portón.
  const establos = () => G().buildings.filter(b => b.owner === 'p' && b.done && b.type === 'establo');
  L.carroMax = () => establos().reduce((s2, b) => s2 + G().bst(b).carromatos, 0);
  const boostCarro = () => G().best('beasthouse', 'cartBoost') + G().best('faro', 'cartBoost');
  L.carroCap = () => Math.round(establos().reduce((m, b) => Math.max(m, G().bst(b).carroCap), D.CARROMATO.cap) * (1 + boostCarro() + (G().bono ? G().bono('cartCap') : 0)));
  L.carroSpeed = () => establos().reduce((m, b) => Math.max(m, G().bst(b).carroSpeed), 0) + boostCarro();
  L.carromatos = () => G().units.filter(u => u.owner === 'p' && u.kind === 'carromato');
  L.vehiculos = () => G().units.filter(u => u.owner === 'p' && (u.kind === 'cart' || u.kind === 'carromato' || u.kind === 'barcaza'));
  L.esVehiculo = u => !!u && (u.kind === 'cart' || u.kind === 'carromato' || u.kind === 'barcaza');
  // ---------- Barcazas (pk-46, plan de logística L6: el mar) ----------
  // Las arma el Embarcadero de colonos. Traen lo que guarda el Muelle de una colonia hasta el Embarcadero de casa, que
  // lo descarga en el pueblo. Solo navegan: el viento las apura o las frena y con tormenta tardan 1,4 veces.
  const embarcaderos = () => G().buildings.filter(b => b.owner === 'p' && b.done && b.type === 'embarcadero');
  L.barcazas = () => G().units.filter(u => u.owner === 'p' && u.kind === 'barcaza');
  L.barcaMax = () => embarcaderos().reduce((s2, b) => s2 + (G().bst(b).barcazas || 0), 0);
  L.barcaCap = () => Math.round(embarcaderos().reduce((m, b) => Math.max(m, G().bst(b).barcaCap || 0), D.BARCAZA ? D.BARCAZA.cap : 300) * (1 + (G().bono ? G().bono('cartCap') : 0)));
  // el mar a la hora del juego (G.ahora: sin conexión es el reloj simulado, así da lo mismo que en vivo)
  L.marMult = function () {
    const t = G().ahora ? G().ahora() : Date.now(), v = D.vientoMar ? D.vientoMar(t) : 0.5;
    return (0.8 + 0.4 * v) / (D.tormenta && D.tormenta(t) ? (D.TORMENTA ? D.TORMENTA.viaje : 1.4) : 1);
  };
  L.trainBarca = function (b) {
    if (L.barcazas().length + embarcaderos().reduce((s2, o) => s2 + o.queue.filter(q => q === 'barcaza').length, 0) >= L.barcaMax()) { toast('Mejora el Embarcadero para tener más barcazas.', 'warn'); return; }
    if (!G().pay(D.BARCAZA.cost)) { toast('Recursos insuficientes.', 'warn'); return; }
    b.queue.push('barcaza');
  };
  // Dónde atraca una barcaza para un edificio: la casilla de agua libre más cercana (hasta 16 casillas). El Muelle de una
  // colonia suele quedar tierra adentro, en la playa: la barcaza para en el agua frente a él.
  L.atracadero = function (b) {
    const k = G().blockVer + ':' + b.x + ',' + b.y;
    if (b._atr && b._atrK === k) return b._atr;
    b._atrK = k; b._atr = aguaCerca(b, 16);
    return b._atr;
  };
  // nace en el agua junto al Embarcadero
  function aguaCerca(b, R) {
    let best = null, bd = 1e9;
    for (let y = b.y - R; y < b.y + b.h + R; y++) for (let x = b.x - R; x < b.x + b.w + R; x++) {
      if (!W.inb(x, y)) continue;
      const k = W.idx(x, y);
      if (W.terrain[k] !== 4 || W.bAt[k] >= 0) continue;
      const d = U.dist(x + 0.5, y + 0.5, b.cx, b.cy);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  L.updateEmbarcadero = function (b, dt) {
    if (!b.queue.length || b.queue[0] !== 'barcaza') { if (!b.queue.length) b.qt = 0; return; }
    b.status = 'Armando una barcaza';
    b.qt += dt;
    if (b.qt < D.BARCAZA.time) return;
    b.qt = 0; b.queue.shift(); b.status = '';
    const p = L.atracadero(b);
    if (!p) { toast('No hay agua libre junto al Embarcadero para botar la barcaza.', 'warn'); G().give(D.BARCAZA.cost); return; }
    const u = G().addUnit({ owner: 'p', x: p[0] + 0.5, y: p[1] + 0.5, kind: 'barcaza' });
    G().stat('barcazas', 1);
    primeraRuta(u);
  };
  // Navega por su camino de agua (sin choques: va sola por el mar).
  L.barca = function (u, dt) {
    if (u.path && u.path.length) {
      let left = velocidad('barcaza') * dt;
      while (left > 0 && u.path.length) {
        const [tx, ty] = u.path[0], dx = tx + 0.5 - u.x, dy = ty + 0.5 - u.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.05) u.flip = dx < 0;
        if (d <= left) { u.x = tx + 0.5; u.y = ty + 0.5; u.path.shift(); left -= d; } else { u.x += (dx / d) * left; u.y += (dy / d) * left; left = 0; }
      }
      u.mode = 'walk';
      return;
    }
    L.cart(u, dt);
  };
  L.trainCarro = function (b) {
    if (L.carromatos().length + establos().reduce((s2, o) => s2 + o.queue.length, 0) >= L.carroMax()) { toast('Mejora el Establo (o construye otro) para tener más carromatos.', 'warn'); return; }
    if (!G().pay(D.carromatoCost(S().era))) { toast('Recursos insuficientes.', 'warn'); return; }
    b.queue.push('carromato');
  };
  L.updateEstablo = function (b, dt) {
    const st = S();
    // el primer establo trae un carromato de regalo: sin él, el primer campamento de la Era I se llenaba y nada llegaba
    if (!st.flags.carroGratis) {
      st.flags.carroGratis = 1;
      const u = G().spawnUnit(b, 'carromato');
      if (u) { primeraRuta(u); if (!G().offline) toast('¡Tu ' + D.BUILD.establo.name + ' trae un carromato de regalo! Dale una ruta: de un campamento a tu ' + D.BUILD.tc.name + ' o a un ' + D.BUILD.warehouse.name + '.', 'epic', { label: 'Rutas', fn: () => PK.UI.openLogistics() }); }
    }
    if (!b.queue.length) { b.status = ''; b.qt = 0; return; }
    b.status = 'Armando carromatos';
    b.qt += dt;
    if (b.qt >= D.CARROMATO.time) {
      b.qt = 0; b.queue.shift();
      const u = G().spawnUnit(b, 'carromato');
      G().stat('carromatos', 1);
      if (u) primeraRuta(u);
    }
  };
  // un vehículo nuevo nace sin ruta: se le ofrece la primera de su clase que tenga lugar
  function primeraRuta(u) {
    const r = S().logi.rutas.find(o => L.claseRuta(o) === u.kind && !L.rutaMala(o) && !L.cartsDe(o).length);
    if (r) u.ruta = r.id;
  }
  L.trainCart = function (b) {
    if (L.carts().length + (b.queue ? b.queue.length : 0) >= L.cartMax()) { toast('Mejora la Carretería para tener más carretas.', 'warn'); return; }
    if (!G().pay(D.CART.cost)) { toast('Recursos insuficientes.', 'warn'); return; }
    b.queue.push('cart');
  };
  L.updateCartwright = function (b, dt) {
    if (!b.queue.length) { b.status = ''; b.qt = 0; return; }
    b.status = 'Armando carretas';
    b.qt += dt;
    if (b.qt >= D.CART.time) {
      b.qt = 0; b.queue.shift();
      const u = G().spawnUnit(b, 'cart');
      G().stat('carts', 1);
      // una carreta nueva nace sin ruta: se le ofrece la primera ruta que tenga lugar
      if (u) primeraRuta(u);
    }
  };

  // ---------- Perfiles de viaje y caminos por tiempo ----------
  // Cuánto rinde cada casilla según quién viaja. step() en entities.js usa lo mismo, así el tiempo que estima la
  // ruta es el que de verdad tarda.
  const rk = () => (G().bono ? G().bono('road') : 0); // Caminos empedrados, Caravaneros (árbol 2.0)
  L.PERFIL_DE = { cart: 'carreta', carromato: 'carromato', barcaza: 'barcaza' };
  L.factor = function (perfil, k) {
    const road = W.road[k] === 1, cz = W.autopista[k] > 0; // L5: la Calzada Real
    if (perfil === 'carreta') return cz ? Math.max(D.AUTOPISTA.carreta, 1 + (D.ROAD.cart - 1) * (1 + rk())) : road ? 1 + (D.ROAD.cart - 1) * (1 + rk()) : D.CART.offRoad;
    if (perfil === 'barcaza') return 1; // el viento y la tormenta van aparte (L.marMult): cambian con la hora
    if (perfil === 'carromato') {
      const C = D.CARROMATO, f = cz ? C.highway : road ? 1 + (C.road - 1) * (1 + rk()) : C.offRoad;
      const o = W.ownerAt(k % W.W, (k / W.W) | 0);
      return o && o !== 'p' ? f / C.ajeno : f; // tierra ajena sin muralla: se cruza, pero cuesta ×4 (decisión 5)
    }
    return cz ? Math.max(D.AUTOPISTA.aldeano, 1 + (D.ROAD.walk - 1) * (1 + rk())) : road ? 1 + (D.ROAD.walk - 1) * (1 + rk()) : 1;
  };
  L.factorUnidad = function (u) {
    const p = L.PERFIL_DE[u.kind], k = W.idx(Math.floor(u.x), Math.floor(u.y));
    if (p) return L.factor(p, k);
    const road = W.road[k] === 1, r = road && u.owner === 'p' ? rk() : 0;
    if (W.autopista[k]) return Math.max(D.AUTOPISTA.aldeano, road ? 1 + (D.ROAD.walk - 1) * (1 + r) : 1); // L5
    return road ? 1 + (D.ROAD.walk - 1) * (1 + r) : 1;
  };
  // ¿Por dónde puede pasar? La carreta, por lo libre de tu territorio (las puertas de tu muralla también).
  // El carromato sale de tu tierra, pero no cabe por una puerta chica (W.wall 2): solo por el Gran Portón (3).
  function pasa(perfil, k) {
    if (perfil === 'barcaza') return W.terrain[k] === 4 && W.bAt[k] < 0; // solo agua
    if (W.block[k] !== 0 || W.terrain[k] === 4 || W.wallOwner[k]) return false; // L4: tampoco por una puerta ajena
    const x = k % W.W, y = (k / W.W) | 0;
    if (perfil === 'carreta') return W.ownerAt(x, y) === 'p';
    if (perfil === 'carromato') return W.wall[k] !== 2;
    return true;
  }
  const verMapa = () => W.roadVer + '|' + G().blockVer + '|' + (W.terrVer || 0) + '|' + (W.apVer || 0) + '|' + rk();
  const tablas = {};
  L.tabla = function (perfil) {
    const v = verMapa();
    let t = tablas[perfil];
    if (t && t.ver === v) return t;
    if (!t) t = tablas[perfil] = { ver: '', costo: new Float32Array(W.W * W.H), min: 1 };
    let min = Infinity;
    for (let k = 0; k < t.costo.length; k++) {
      if (!pasa(perfil, k)) { t.costo[k] = Infinity; continue; }
      const c = 1 / L.factor(perfil, k);
      t.costo[k] = c;
      if (c < min) min = c;
    }
    t.min = isFinite(min) ? min : 1;
    t.ver = v;
    return t;
  };
  // Camino guardado de un edificio a otro: se calcula una vez y sirve hasta que cambie algo del mapa (un camino nuevo,
  // un edificio, una muralla, tu territorio). Si el mapa cambió, se recalculan a lo más 2 por paso del juego: los demás
  // usan el viejo hasta que les toque (el de este A* explora mucho más que el de los aldeanos).
  const caminos = new Map();
  let presupuesto = 2;
  L.camino = function (a, b, perfil, forzar) {
    const key = a.id + '>' + b.id + ':' + perfil, t = L.tabla(perfil), e = caminos.get(key);
    if (e && e.ver === t.ver) return e;
    if (!forzar && !G().offline && presupuesto <= 0) return e || null;
    presupuesto--;
    if (caminos.size > 400) caminos.clear();
    // pk-43: se prueban las casillas libres alrededor del origen, de la más cercana al destino a la más lejana (hasta
    // 6): un campamento en medio del bosque solía salir por un hueco encerrado entre árboles y «no había camino».
    const borde = [];
    let goal = { x0: b.x, y0: b.y, x1: b.x + b.w - 1, y1: b.y + b.h - 1, adj: true };
    if (perfil === 'barcaza') { // de atracadero a atracadero (el agua más cercana a cada muelle)
      const pa = L.atracadero(a), pb = L.atracadero(b);
      if (pa) borde.push(pa);
      if (pb) goal = { x0: pb[0] - 1, y0: pb[1] - 1, x1: pb[0] + 1, y1: pb[1] + 1 };
    } else {
      for (let y = a.y - 1; y <= a.y + a.h; y++) for (let x = a.x - 1; x <= a.x + a.w; x++) {
        if (x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) continue;
        if (W.inb(x, y) && t.costo[W.idx(x, y)] < Infinity) borde.push([x, y]);
      }
      borde.sort((p, q) => U.dist(p[0], p[1], b.cx, b.cy) - U.dist(q[0], q[1], b.cx, b.cy));
    }
    let s = borde[0] || [a.x, a.y], r = { path: [], ok: false, seg: 0 };
    for (const c of borde.slice(0, 6)) { const rr = W.rutaCosto(c[0], c[1], goal, t.costo, t.min); if (rr.ok) { s = c; r = rr; break; } }
    const sOk = r.ok;
    const ne = { ver: t.ver, ok: sOk && r.ok, path: sOk ? [s].concat(r.path) : [], costo: r.seg + (sOk ? t.costo[W.idx(s[0], s[1])] : 0) };
    caminos.set(key, ne);
    return ne;
  };
  const velocidad = perfil => (perfil === 'carreta' ? D.CART.speed * (1 + L.cartSpeed()) : perfil === 'carromato' ? D.CARROMATO.speed * (1 + L.carroSpeed()) : perfil === 'barcaza' ? (D.BARCAZA ? D.BARCAZA.speed : 1.5) * L.marMult() : 1.3);
  L.velocidad = velocidad;
  // Pone a la unidad en camino hacia un edificio: por el camino guardado si está junto a su comienzo, o con uno de una
  // sola vez desde donde está (al salir de la Carretería, al cambiar de ruta). false: no hay por dónde.
  function ir(u, desde, hacia) {
    const perfil = L.PERFIL_DE[u.kind] || 'carreta';
    const e = desde ? L.camino(desde, hacia, perfil) : null;
    if (e && e.ok && e.path.length && U.dist(u.x, u.y, e.path[0][0] + 0.5, e.path[0][1] + 0.5) < 1.8) { u.path = e.path.slice(); return true; }
    if (desde && e === null) { u.wait = 0.2; return true; } // le toca calcular en el próximo paso
    const t = L.tabla(perfil), pb = perfil === 'barcaza' ? L.atracadero(hacia) : null;
    if (perfil === 'barcaza' && !pb) return false;
    const r = W.rutaCosto(Math.floor(u.x), Math.floor(u.y), pb ? { x0: pb[0] - 1, y0: pb[1] - 1, x1: pb[0] + 1, y1: pb[1] + 1 } : { x0: hacia.x, y0: hacia.y, x1: hacia.x + hacia.w - 1, y1: hacia.y + hacia.h - 1, adj: true }, t.costo, t.min, 30000);
    if (!r.ok) return false;
    u.path = r.path;
    return true;
  }
  L.ir = ir;

  // ---------- Rutas ----------
  // Los campamentos son del carromato (decisión 3 del dueño), y el Molino fuera de tu tierra también (decisión 4).
  L.esCampo = b => PK.Libro.tipoCampo(b); // una sola regla: la del libro mayor (incluye la colonia y el molino de una isla)
  // ¿Puede ser un extremo de una ruta de carreta? Un taller o una bodega del pueblo.
  L.puntoCarreta = b => !!(b && b.owner === 'p' && !L.esCampo(b) && (L.isShop(b) || L.isStore(b)));
  L.rutaDe = u => (u.ruta ? S().logi.rutas.find(r => r.id === u.ruta) || null : null);
  // Una ruta que sale de un campamento es de carromatos; las demás, de carretas.
  L.claseRuta = r => { const a = G().bById.get(r.de); return a && a.type === 'colonia' ? 'barcaza' : a && L.esCampo(a) ? 'carromato' : 'cart'; };
  L.cartsDe = r => { const k = L.claseRuta(r); return G().units.filter(u => u.owner === 'p' && u.kind === k && u.ruta === r.id); };
  L.libres = kind => (kind === 'carromato' ? L.carromatos() : kind === 'barcaza' ? L.barcazas() : L.carts()).filter(u => !L.rutaDe(u));
  // Por qué una ruta no sirve (texto), o null si está bien.
  L.parMalo = function (a, b) {
    if (!a || !b) return 'Elige el origen y el destino.';
    if (a === b) return 'El origen y el destino son el mismo edificio.';
    if (a.type === 'colonia') return b.type === 'embarcadero' ? null : 'Una barcaza lleva lo del Muelle de la colonia al Embarcadero de colonos de tu isla.';
    if (b.type === 'embarcadero') return 'Al Embarcadero solo llegan barcazas desde el Muelle de una colonia.';
    for (const x of [a, b]) if (PK.Libro.almacenDe(x) !== x) return 'Lo que junta ' + x.def.name + ' se guarda en el Muelle de la colonia: la barcaza sale de ahí.';
    if (L.esCampo(b)) return 'Un campamento no recibe nada: es de donde sale un carromato. Elígelo como origen.';
    if (L.esCampo(a)) { // ruta de carromato
      if (!L.puntoCarreta(b)) return 'Un carromato lleva lo del campamento a una bodega del pueblo (Centro Urbano, Almacén, Granero, Molino) o a un taller.';
      const da = a.def.drop || [];
      if (!da.some(r => acepta(b, r))) return b.def.name + ' no usa nada de lo que junta ' + a.def.name + '.';
      return null;
    }
    if (!L.puntoCarreta(a) || !L.puntoCarreta(b)) return 'Una carreta une talleres y bodegas del pueblo (Centro Urbano, Almacén, Granero, Molino).';
    if (!L.isShop(a) && !L.isShop(b)) return 'Entre dos bodegas no hace falta: lo que hay en una ya sirve en todo el pueblo. Une una bodega con un taller.';
    return null;
  };
  L.rutaMala = function (r) {
    const g = G(), a = g.bById.get(r.de), b = g.bById.get(r.a);
    if (!a || !b) return 'El ' + (!a ? 'origen' : 'destino') + ' ya no existe: cambia la ruta.';
    if (!a.done || !b.done) return (!a.done ? a : b).def.name + ' todavía está en obra.';
    return L.parMalo(a, b);
  };
  L.crearRuta = function (de, a, res) {
    const g = G(), A = g.bById.get(de), B = g.bById.get(a), why = L.parMalo(A, B);
    if (why) { toast(why, 'warn'); return null; }
    if (res && !acepta(B, res)) { toast(B.def.name + ' no recibe ' + D.RES[res].name.toLowerCase() + '.', 'warn'); return null; }
    const st = S(), r = { id: st.logi.nextRuta++, de, a, res: res || null };
    st.logi.rutas.push(r);
    G().stat('rutas', 1);
    return r;
  };
  L.borrarRuta = function (id) {
    const st = S(), r = st.logi.rutas.find(o => o.id === id);
    if (!r) return;
    for (const u of L.cartsDe(r)) L.asignar(u, null);
    st.logi.rutas.splice(st.logi.rutas.indexOf(r), 1);
  };
  // Cambia la ruta de una carreta. Lo que llevaba vuelve entero a donde corresponde (nunca se pierde).
  L.asignar = function (u, id) {
    if (u.ruta === id) return;
    dropCargo(u);
    u.ruta = id || null; u.job = null; u.path = []; u.espera = 0; u.wait = 0;
  };
  L.sumarCarreta = function (r) {
    const k = L.claseRuta(r), A = G().bById.get(r.de);
    const libre = L.libres(k).sort((x, y) => (A ? U.dist(x.x, x.y, A.cx, A.cy) - U.dist(y.x, y.y, A.cx, A.cy) : 0))[0];
    if (!libre) {
      if (k === 'barcaza') toast(L.barcazas().length ? 'Todas tus barcazas ya tienen ruta: arma otra en el Embarcadero o saca una de otra ruta.' : 'No tienes barcazas: ármalas en el Embarcadero de colonos.', 'warn');
      else if (k === 'carromato') toast(L.carromatos().length ? 'Todos tus carromatos ya tienen ruta: arma otro en el Establo o saca uno de otra ruta.' : 'No tienes carromatos: construye un Establo de Carromatos (el primero trae uno de regalo).', 'warn');
      else toast(L.carts().length ? 'Todas tus carretas ya tienen ruta: arma otra en la Carretería o saca una de otra ruta.' : 'No tienes carretas: ármalas en la Carretería (Era II).', 'warn');
      return false;
    }
    L.asignar(libre, r.id);
    return true;
  };
  L.quitarCarreta = function (r) {
    const cs = L.cartsDe(r).sort((x, y) => (x.carry || 0) - (y.carry || 0));
    if (!cs.length) return false;
    L.asignar(cs[0], null);
    return true;
  };
  // Ida, vuelta (en segundos) y cuánto mueve por minuto con las carretas que tiene. null si aún no hay camino.
  L.tiempos = function (r, forzar) {
    const g = G(), a = g.bById.get(r.de), b = g.bById.get(r.a);
    if (!a || !b) return null;
    const k = L.claseRuta(r), perfil = L.PERFIL_DE[k], i = L.camino(a, b, perfil, forzar), v = L.camino(b, a, perfil, forzar);
    if (!i || !v) return null;
    if (!i.ok || !v.ok) return { ok: false };
    const sp = velocidad(perfil), ida = i.costo / sp, vuelta = v.costo / sp, ciclo = ida + vuelta + 1.2 + 1;
    return { ok: true, ida, vuelta, ciclo, ritmo: (L.cartsDe(r).length * L.capDe(k) * 60) / ciclo };
  };

  L.capDe = kind => (kind === 'carromato' ? L.carroCap() : kind === 'barcaza' ? L.barcaCap() : L.cartCap());
  // Lo que ya viene en camino a un edificio (para no llevarle de más).
  function inbound(b, res) {
    let n = 0;
    for (const u of G().units) if (L.esVehiculo(u) && u.job && u.job.to === b.id && u.job.res === res) n += u.job.n;
    return n;
  }
  function acepta(b, res) { return b.type === 'embarcadero' ? PK.Libro.fisico(res) : L.isShop(b) ? !!L.recipe(b).in[res] : L.storeAccepts(b, res); }
  L.acepta = acepta;
  function necesita(b, res, contar) {
    if (L.isShop(b)) return Math.max(0, L.need(b, res) - (contar ? inbound(b, res) : 0));
    return Math.max(0, G().cap(res) - (S().res[res] || 0));
  }
  function hay(from, to, res) {
    if (L.isShop(from)) { ensure(from); return from.outb[res] || 0; }
    if (L.esCampo(from)) return (from.inv && from.inv[res]) || 0;
    return Math.max(0, (S().res[res] || 0) - (L.isShop(to) ? reserveOf(res, L.output(to), to) : 0));
  }
  // Qué conviene cargar en el origen para ese destino: { res, n, need }, o null si nada sirve.
  function queCargar(r, from, to, cap, contar) {
    const cands = r.res ? [r.res] : L.isShop(from) ? [L.output(from)] : L.esCampo(from) ? Object.keys(from.inv || {}) : L.isShop(to) ? Object.keys(L.recipe(to).in) : [];
    let best = null;
    for (const res of cands) {
      if (!acepta(to, res) || (!L.isShop(from) && !L.esCampo(from) && !L.storeAccepts(from, res))) continue;
      const need = necesita(to, res, contar), n = Math.floor(Math.min(cap, hay(from, to, res), need));
      if (!best || n > best.n || (n === best.n && need > best.need)) best = { res, n, need };
    }
    return best;
  }
  L.queCargar = queCargar;

  // pk-43: un campamento da de lo suyo; una bodega, de esa bodega (libro mayor)
  function take(b, res, n) {
    if (L.isShop(b)) { ensure(b); const k = Math.min(n, b.outb[res] || 0); b.outb[res] -= k; return k; }
    if (L.esCampo(b)) return PK.Libro.sacarCampo(b, res, n);
    return PK.Libro.sacar(b, res, n);
  }
  // Un taller recibe hasta llenar su depósito de entrada; una bodega, hasta el tope del pueblo (y en ella lo que cabe).
  function put(b, res, n) {
    if (L.isShop(b)) { ensure(b); const k = Math.min(n, Math.max(0, L.bufCap(b) - (b.inb[res] || 0))); b.inb[res] = (b.inb[res] || 0) + k; return k; }
    return PK.Libro.poner(b, res, n);
  }

  // Cerebro de una carreta.
  L.cart = function (u, dt) {
    const g = G(), Un = PK.Units;
    if (u.wait > 0) { u.wait -= dt; u.mode = 'idle'; return; }
    const r = L.rutaDe(u);
    if (!r) { u.job = null; u.estado = 'Sin ruta: elige a dónde va'; dropCargo(u); parkCart(u); return; }
    const why = L.rutaMala(r);
    if (why) { u.job = null; u.estado = why; u.mode = 'idle'; u.wait = 3; return; }
    const from = g.bById.get(r.de), to = g.bById.get(r.a), lleva = u.carry > 0.5;
    const tgt = lleva ? to : from, desde = lleva ? from : to;
    u.job = { ruta: r.id, from: r.de, to: r.a, res: (lleva && u.carryRes) || r.res, n: lleva ? u.carry : 0, phase: lleva ? 'back' : 'go' };
    const llego = u.kind === 'barcaza' ? (pt => !!pt && U.dist(u.x, u.y, pt[0] + 0.5, pt[1] + 0.5) < 1.9)(L.atracadero(tgt)) : Un.nearRect(u, tgt.x, tgt.y, tgt.x + tgt.w - 1, tgt.y + tgt.h - 1, 1.2);
    if (!llego) {
      u.estado = lleva ? 'Lleva ' + D.RES[u.carryRes].name.toLowerCase() + ' a ' + to.def.name : 'Va a cargar a ' + from.def.name;
      if (!ir(u, desde, tgt)) { u.estado = 'Sin camino hasta ' + tgt.def.name + (u.kind === 'barcaza' ? ' (necesita agua libre cerca de los dos muelles)' : u.kind === 'carromato' ? ' (los carromatos solo cruzan tu muralla por un Gran Portón)' : ' (las carretas no salen de tu territorio)'); u.mode = 'idle'; u.wait = 4; }
      return;
    }
    if (lleva) descargar(u, to); else cargar(u, r, from, to);
  };
  function cargar(u, r, from, to) {
    const cap = L.capDe(u.kind), q = queCargar(r, from, to, cap, true);
    const lleno = q ? Math.min(cap, q.need) : 0;
    u.mode = 'idle';
    if (q && q.n >= 1 && (q.n >= lleno - 0.5 || q.n >= cap * 0.5 || (u.espera || 0) >= 60)) {
      const n = take(from, q.res, q.n);
      if (n >= 1) {
        u.carry = n; u.carryRes = q.res; u.espera = 0; u.wait = 0.6;
        u.estado = 'Cargando ' + D.RES[q.res].name.toLowerCase();
        return;
      }
    }
    u.espera = (u.espera || 0) + 3; u.wait = 3;
    u.estado = !q && L.esCampo(from) ? 'Esperando carga: ' + from.def.name + ' está vacío' : !q || q.need < 1 ? to.def.name + ' no necesita nada por ahora: espera en el origen' : q.n >= 1 ? 'Esperando carga (' + q.n + ' de ' + Math.floor(lleno) + ')' : 'Esperando carga: no hay ' + D.RES[q.res].name.toLowerCase() + (L.isShop(from) ? '' : ' (o lo guarda la reserva)');
  }
  function descargar(u, to) {
    const g = G();
    if (!acepta(to, u.carryRes)) { dropCargo(u); return; } // cambiaron la ruta: vuelve a la bodega
    const n = put(to, u.carryRes, u.carry);
    if (n > 0) {
      if (PK.Render.float && !g.offline) PK.Render.float(to.cx, to.cy, '+' + Math.floor(n), u.carryRes);
      g.stat('hauled', n);
    }
    u.carry -= n;
    if (u.carry > 0.5) { u.estado = to.def.name + ' está lleno: espera para descargar'; u.mode = 'idle'; u.wait = 3; return; }
    u.carry = 0; u.carryRes = null; u.wait = 0.6; u.estado = 'Descargando';
  }
  // Lo que llevaba vuelve entero a la bodega (aunque esté llena: es tuyo, no una cosecha).
  function dropCargo(u) {
    if (u.carry > 0 && u.carryRes) S().res[u.carryRes] = (S().res[u.carryRes] || 0) + u.carry;
    u.carry = 0; u.carryRes = null;
  }
  // Sin ruta, esperan junto a la Carretería.
  function parkCart(u) {
    if (u.kind === 'barcaza') { u.mode = 'idle'; u.wait = 4; return; } // fondeada donde está
    const home = G().buildings.find(b => b.owner === 'p' && b.type === (u.kind === 'carromato' ? 'establo' : 'cartwright') && b.done);
    if (home && U.dist(u.x, u.y, home.cx, home.cy) > 4) PK.Units.pathTo(u, PK.Units.rectGoal(home, true));
    u.mode = 'idle';
    u.wait = 4;
  }
  // Partidas de antes de pk-41: las carretas no tenían ruta. Quedan paradas (sin modo automático, decisión 1 del dueño)
  // y un aviso pide definir a dónde van.
  L.avisoPendiente = () => !!(S().logi && S().logi.avisoRutas);
  L.avisoVisto = () => { S().logi.avisoRutas = 0; };
  L.sinRuta = () => L.vehiculos().filter(u => !L.rutaDe(u)).length;

  // ---------- Caminos ----------
  L.roadAllowed = function (x, y) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y), o = W.ownerAt(x, y);
    return W.fog[k] && W.terrain[k] !== 4 && W.bAt[k] < 0 && W.poiAt[k] < 0 && (!o || o === 'p') && !(W.block[k] && W.block[k] !== 1);
  };
  // Traza un camino entre dos casillas por donde se pueda (rodeando lo que estorba).
  L.roadPlan = function (x0, y0, x1, y1) {
    const path = [[x0, y0]];
    let x = x0, y = y0, guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 400) {
      const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
      // primero en diagonal "escalonada": alterna ejes para que el camino quede parejo
      if (dx && (!dy || Math.abs(x1 - x) >= Math.abs(y1 - y))) x += dx; else y += dy;
      path.push([x, y]);
    }
    return path.filter(([a, b]) => L.roadAllowed(a, b) && !W.road[W.idx(a, b)]);
  };
  L.buildRoad = function (tiles) {
    if (!tiles.length) return 0;
    const cost = {};
    for (const r in D.ROAD.cost) cost[r] = D.ROAD.cost[r] * tiles.length;
    if (!G().pay(cost)) { toast('Faltan recursos para ' + tiles.length + ' casillas de camino.', 'warn'); return 0; }
    for (const [x, y] of tiles) {
      const k = W.idx(x, y);
      if (W.block[k] === 1 && W.nodeAt[k] >= 0) { const n = W.nodes[W.nodeAt[k]]; if (n && W.soft(n)) W.depleteNode(n); else continue; }
      W.road[k] = 1;
    }
    W.roadVer++;
    G().stat('roads', tiles.length);
    if (PK.Sfx) PK.Sfx.play('build');
    return tiles.length;
  };
  L.removeRoad = function (x, y) {
    const k = W.idx(x, y);
    if (!W.road[k]) return;
    W.road[k] = 0; W.roadVer++;
    G().give(D.ROAD.cost, 0.5);
  };
  L.onRoad = (x, y) => W.road[W.idx(Math.floor(x), Math.floor(y))] === 1;

  // ---------- Cintas transportadoras ----------
  L.beltUnlocked = () => S().era >= D.BELT.era && G().levelCount(D.BELT.need.lvl, D.BELT.need.b) > 0;
  L.beltLockText = () => 'Las cintas requieren la Era ' + U.roman(D.BELT.era) + ' y un ' + D.BUILD[D.BELT.need.b].name + ' de nivel ' + D.BELT.need.lvl + '.';
  function markBelt(bl, on) {
    for (const [x, y] of bl.path) W.belt[W.idx(x, y)] = on ? bl.id : -1;
  }
  const canBelt = (x, y) => {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y), o = W.ownerAt(x, y);
    return W.fog[k] && W.terrain[k] !== 4 && W.bAt[k] < 0 && W.belt[k] < 0 && W.poiAt[k] < 0 && W.block[k] !== 1 && o === 'p';
  };
  // Ruta de la cinta: de una casilla junto a A hasta una casilla junto a B, por casillas libres propias.
  L.beltPlan = function (a, b) {
    const starts = [];
    for (let y = a.y - 1; y <= a.y + a.h; y++) for (let x = a.x - 1; x <= a.x + a.w; x++) {
      const edge = x === a.x - 1 || x === a.x + a.w || y === a.y - 1 || y === a.y + a.h;
      if (edge && !((x === a.x - 1 || x === a.x + a.w) && (y === a.y - 1 || y === a.y + a.h)) && canBelt(x, y)) starts.push([x, y]);
    }
    starts.sort((p, q) => U.dist(p[0], p[1], b.cx, b.cy) - U.dist(q[0], q[1], b.cx, b.cy));
    for (const s of starts.slice(0, 4)) {
      const path = bfs(s, b);
      if (path) return path;
    }
    return null;
  };
  // Búsqueda en anchura por casillas de cinta (4 direcciones: las cintas no van en diagonal).
  function bfs(s, b) {
    const prev = new Map(), q = [s], key = (x, y) => y * W.W + x;
    prev.set(key(s[0], s[1]), -1);
    const goal = (x, y) => (x === b.x - 1 || x === b.x + b.w) && y >= b.y && y < b.y + b.h || (y === b.y - 1 || y === b.y + b.h) && x >= b.x && x < b.x + b.w;
    for (let qi = 0; qi < q.length && qi < 6000; qi++) {
      const [x, y] = q[qi];
      if (goal(x, y)) {
        const out = [];
        let k = key(x, y);
        while (k !== -1) { out.push([k % W.W, Math.floor(k / W.W)]); k = prev.get(k); }
        return out.reverse();
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = key(nx, ny);
        if (prev.has(nk) || !(canBelt(nx, ny) || goal(nx, ny) && canBelt(nx, ny))) continue;
        prev.set(nk, key(x, y));
        q.push([nx, ny]);
      }
    }
    return null;
  }
  L.beltCost = n => { const c = {}; for (const r in D.BELT.cost) c[r] = D.BELT.cost[r] * n; return c; };
  L.buildBelt = function (a, b) {
    if (!L.beltUnlocked()) { toast(L.beltLockText(), 'warn'); return null; }
    if (a === b) return null;
    const path = L.beltPlan(a, b);
    if (!path) { toast('No hay por dónde pasar la cinta (tiene que ir por tu territorio, sin cruzar edificios).', 'warn'); return null; }
    if (!G().pay(L.beltCost(path.length))) { toast('Faltan recursos: cada casilla de cinta cuesta ' + D.BELT.cost.steel + ' acero y ' + D.BELT.cost.machinery + ' maquinaria (' + path.length + ' casillas).', 'warn'); return null; }
    const st = S(), bl = { id: st.logi.nextBelt++, a: a.id, b: b.id, res: null, path, items: [], acc: 0 };
    st.logi.belts.push(bl);
    markBelt(bl, true);
    G().stat('belts', 1);
    if (PK.Sfx) PK.Sfx.play('level');
    toast('Cinta de ' + path.length + ' casillas lista: ' + a.def.name + ' → ' + b.def.name + '.', 'good');
    return bl;
  };
  L.removeBelt = function (bl) {
    const st = S();
    markBelt(bl, false);
    st.logi.belts.splice(st.logi.belts.indexOf(bl), 1);
    G().give(L.beltCost(bl.path.length), 0.5);
  };
  L.beltAt = (x, y) => { const id = W.belt[W.idx(x, y)]; return id >= 0 ? S().logi.belts.find(b => b.id === id) : null; };

  // Qué lleva la cinta: lo que produce el origen, o el insumo que más le falta al destino.
  function beltRes(bl, a, b) {
    if (bl.res) return bl.res;
    if (L.isShop(a)) return L.output(a);
    if (L.isShop(b)) {
      const r = L.recipe(b);
      let best = null, bn = 0;
      for (const k in r.in) { const n = L.need(b, k); if (n > bn && L.storeAccepts(a, k) && S().res[k] > reserveOf(k, L.output(b), b)) { bn = n; best = k; } }
      return best;
    }
    return null;
  }
  function beltTick(bl, dt) {
    const g = G(), a = g.bById.get(bl.a), b = g.bById.get(bl.b);
    if (!a || !b || !a.done || !b.done) return;
    const len = bl.path.length, sp = D.BELT.speed;
    // avanzar y entregar
    for (let i = bl.items.length - 1; i >= 0; i--) {
      const it = bl.items[i], ahead = bl.items[i + 1];
      it.p = Math.min(it.p + sp * dt, ahead ? ahead.p - 0.34 : len);
      if (it.p >= len - 0.01 && !ahead) {
        if (L.isShop(b) && L.need(b, it.r) < 1) continue; // destino lleno: la cinta se detiene
        if (!L.isShop(b) && S().res[it.r] >= g.cap(it.r)) continue;
        put(b, it.r, 1);
        bl.items.pop();
        g.stat('belted', 1);
      }
    }
    // cargar
    bl.acc = Math.min(1, bl.acc + dt * D.BELT.rate * beltK());
    const res = beltRes(bl, a, b);
    if (!res || bl.acc < 1 || (bl.items.length && bl.items[0].p < 0.34)) return;
    if (L.isShop(b) && L.need(b, res) - bl.items.length < 1) return;
    let ok = false;
    if (L.isShop(a)) { ensure(a); if ((a.outb[res] || 0) >= 1) { a.outb[res] -= 1; ok = true; } }
    else if (S().res[res] - 1 >= (L.isShop(b) ? reserveOf(res, L.output(b), b) : 0)) { S().res[res] -= 1; ok = true; }
    if (ok) { bl.acc = 0; bl.items.unshift({ p: 0, r: res }); }
  }

  // ---------- Bucle ----------
  L.update = function (dt) {
    const st = S();
    if (!st || !st.logi) return;
    presupuesto = 2; // caminos que se pueden recalcular en este paso
    for (const bl of st.logi.belts) beltTick(bl, dt);
  };
  // Sin ti, las carretas no se mueven de verdad: se calcula cuánto habrían llevado según cuántas hay.
  L.offline = function (dt) {
    const g = G(), st = S();
    for (const bl of st.logi.belts) {
      const a = g.bById.get(bl.a), b = g.bById.get(bl.b);
      if (!a || !b) continue;
      let n = D.BELT.rate * beltK() * dt;
      const res = beltRes(bl, a, b);
      if (!res) continue;
      if (L.isShop(b)) n = Math.min(n, L.need(b, res));
      // como en vivo (beltTick): de la bodega a un taller, nunca por debajo de la reserva. Sin esto, al volver
      // la bodega estaba vacía aunque el taller respetara la reserva.
      if (L.isShop(b) && !L.isShop(a)) n = Math.min(n, Math.max(0, S().res[res] - reserveOf(res, L.output(b), b)));
      // a una bodega, solo lo que cabe (como beltTick): lo que no cabía salía del taller y se perdía
      if (!L.isShop(b)) n = Math.min(n, Math.max(0, g.cap(res) - (S().res[res] || 0)));
      if (n <= 0) continue;
      n = take(a, res, n);
      if (n > 0) put(b, res, n);
    }
    // las rutas (pk-41): cada una mueve lo que harían sus carretas en ese tiempo, con la ida y la vuelta de su camino
    // guardado. Las mismas reglas que en vivo: lo que hay en el origen (menos la reserva) y el lugar en el destino.
    for (const r of st.logi.rutas) {
      const n = L.cartsDe(r).length;
      if (!n || L.rutaMala(r)) continue;
      const T = L.tiempos(r, true);
      if (!T || !T.ok) continue;
      let budget = (n * L.capDe(L.claseRuta(r)) * dt) / T.ciclo;
      const from = g.bById.get(r.de), to = g.bById.get(r.a);
      for (let k = 0; k < 4 && budget >= 1; k++) {
        const q = queCargar(r, from, to, budget, false);
        if (!q || q.n < 1) break;
        const m = take(from, q.res, q.n);
        const puesto = put(to, q.res, m);
        if (puesto < m) { if (L.isShop(from)) from.outb[q.res] += m - puesto; else if (L.esCampo(from)) PK.Libro.inv(from)[q.res] = (PK.Libro.inv(from)[q.res] || 0) + m - puesto; else st.res[q.res] += m - puesto; }
        if (puesto > 0) g.stat('hauled', puesto);
        budget -= Math.max(1, puesto);
        if (puesto < 1) break;
      }
    }
  };

  // Si una parcela cambia de dueño, las cintas que pasaban por ahí se cortan.
  L.onTerritory = function () {
    const st = S();
    if (!st.logi) return;
    for (const bl of st.logi.belts.slice()) if (bl.path.some(([x, y]) => W.ownerAt(x, y) !== 'p')) { markBelt(bl, false); st.logi.belts.splice(st.logi.belts.indexOf(bl), 1); }
    for (let i = 0; i < W.road.length; i++) if (W.road[i]) { const o = W.ownerAt(i % W.W, Math.floor(i / W.W)); if (o && o !== 'p') W.road[i] = 0; }
    W.roadVer++;
  };
  // Al demoler un edificio, sus cintas se desarman (se devuelve la mitad).
  L.onRemove = function (b) {
    const st = S();
    if (!st || !st.logi) return;
    for (const bl of st.logi.belts.slice()) if (bl.a === b.id || bl.b === b.id) L.removeBelt(bl);
    if (b.inb) for (const k in b.inb) st.res[k] += Math.floor(b.inb[k]);
    if (b.outb) for (const k in b.outb) st.res[k] += Math.floor(b.outb[k]);
  };
})();
