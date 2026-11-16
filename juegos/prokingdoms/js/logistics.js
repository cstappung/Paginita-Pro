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
    L.tool = null; L.beltFrom = null; caminosRevisados = false;
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
  // pk-54: también las rutas comodín que lo pueden usar («cualquier campamento de madera», «cualquier bodega»)
  L.rutasHacia = b => S().logi.rutas.filter(r => r.a === b.id || (r.a === 'bodega' && L.esBodegaRuta(b) && (!r.res || acepta(b, r.res))));
  L.rutasDesde = b => S().logi.rutas.filter(r => r.de === b.id || (r.de === 'campo' && L.camposRuta(r).includes(b)) || (r.de === 'bodega' && L.esBodegaRuta(b)));
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
  // ---- Extremos comodín (pk-54, pedido del dueño) ----
  // r.de puede ser 'campo' (cualquier campamento que junte r.res: cada carromato va al que tiene más, descontando lo
  // que ya van a buscar los otros de la ruta) o 'bodega' (cualquier bodega: la más cercana al taller de destino).
  // r.a puede ser 'bodega' (la bodega más cercana con lugar para lo que lleva). Cada vehículo elige sus extremos al
  // empezar el viaje (u.rDe, u.rA) y los suelta al descargar. Sigue sin haber modo automático: la ruta la armas tú.
  L.comodin = v => typeof v === 'string';
  L.esBodegaRuta = b => !!(b && b.owner === 'p' && b.done && L.puntoCarreta(b) && !L.isShop(b) && PK.Libro.almacenDe(b) === b);
  L.bodegasRuta = res => G().buildings.filter(b => L.esBodegaRuta(b) && (!res || acepta(b, res)));
  // los campamentos de tu isla que juntan ese recurso (las colonias van por barcaza)
  // pk-55: «cualquier campamento minero» (r.tipo) trae de todo lo que junta ese tipo de campamento, en carga mezclada;
  // r.res, si está, solo eso. Las rutas de pk-54 (r.res sin tipo) siguen yendo por recurso.
  L.TIPOS_CAMPO = ['lumber', 'mining', 'mill'];
  L.tipoDeRes = res => L.TIPOS_CAMPO.find(t => (D.BUILD[t].drop || []).includes(res)) || null;
  L.camposDe = (res, tipo) => (res || tipo ? PK.Libro.campos().filter(b => b.type !== 'colonia' && PK.Libro.almacenDe(b) === b && (!tipo || b.type === tipo) && (!res || (b.def.drop || []).includes(res))) : []);
  L.camposRuta = r => L.camposDe(r.res, r.tipo);
  const stockCampo = (b, res) => (PK.Libro.inv(b)[res] || 0);
  // lo que guarda un campamento de lo que trae la ruta (y recibe su destino, si es un edificio fijo)
  function stockRuta(b, r) {
    const B = L.comodin(r.a) ? null : G().bById.get(r.a);
    return (r.res ? [r.res] : b.def.drop || []).reduce((n, k) => n + (!B || acepta(B, k) ? stockCampo(b, k) : 0), 0);
  }
  // pk-55: un vehículo puede llevar varias cosas a la vez: u.carga = { recurso: cantidad } (solo si son dos o más).
  // u.carry es el total y u.carryRes lo que más lleva (el dibujo, los textos y el servidor miran ese).
  L.cargaDe = u => (u.carga ? u.carga : u.carry > 0 && u.carryRes ? { [u.carryRes]: u.carry } : {});
  function fijarCarga(u, c) {
    let tot = 0, main = null;
    for (const k in c) { if (!(c[k] >= 0.5)) { delete c[k]; continue; } tot += c[k]; if (!main || c[k] > c[main]) main = k; }
    u.carry = tot; u.carryRes = main; u.carga = Object.keys(c).length > 1 ? c : null;
  }
  const nombresCarga = c => { const ks = Object.keys(c).sort((x, y) => c[y] - c[x]).map(k => D.RES[k].name.toLowerCase()); return ks.length > 1 ? ks.slice(0, -1).join(', ') + ' y ' + ks[ks.length - 1] : ks[0] || 'nada'; };
  L.nombresCarga = nombresCarga;
  // Qué buscar en el destino: lo que lleva, lo de la ruta, lo que hace el taller o lo que guarda el campamento.
  function listaPara(u, r, from) {
    if (u && u.carry > 0.5) return Object.keys(L.cargaDe(u));
    if (r.res) return [r.res];
    if (from && L.isShop(from)) return [L.output(from)];
    if (from && L.esCampo(from)) { const ds = from.def.drop || [], hay = ds.filter(k => stockCampo(from, k) >= 1); return hay.length ? hay : ds; }
    return [];
  }
  // El campamento con más de ese recurso, menos lo que ya van a buscar los otros vehículos de la ruta (para que no
  // vayan todos al mismo). excl: uno al que no se llegó hace poco.
  // sinReserva: para la muestra (tiempos, «Ver», sin conexión), solo cuánto guarda cada uno.
  function mejorCampo(r, u, excl, sinReserva) {
    const cap = L.capDe('carromato'), yendo = new Map();
    if (!sinReserva) for (const o of G().units) if (o !== u && o.ruta === r.id && !(o.carry > 0.5) && o.rDe) yendo.set(o.rDe, (yendo.get(o.rDe) || 0) + cap);
    let best = null, bs = -Infinity;
    for (const b of L.camposRuta(r)) {
      if (b.id === excl) continue;
      const sc = stockRuta(b, r) - (yendo.get(b.id) || 0) - (u ? U.dist(u.x, u.y, b.cx, b.cy) * 0.01 : 0); // a igual stock, el más cercano
      if (sc > bs) { bs = sc; best = b; }
    }
    return best;
  }
  const cercana = (lista, x, y) => lista.reduce((m, b) => (!m || U.dist(x, y, b.cx, b.cy) < U.dist(x, y, m.cx, m.cy) ? b : m), null);
  // La bodega que recibe más de lo que lleva (con lugar vale doble) y, entre esas, la más cercana: todas llenas, la más
  // cercana, y espera. res: un recurso, una lista (pk-55, carga mezclada) o nada (cualquiera).
  function mejorBodega(res, x, y) {
    const lista = (Array.isArray(res) ? res : [res]).filter(Boolean);
    const pts = b => lista.reduce((n, k) => n + (acepta(b, k) ? (PK.Libro.lugar(b, k) >= 1 ? 2 : 1) : 0), 0);
    let best = null, bp = 0, bd = Infinity;
    for (const b of L.bodegasRuta()) {
      const p = pts(b), d = U.dist(x, y, b.cx, b.cy);
      if (lista.length && p < 1) continue;
      if (p > bp || (p === bp && d < bd)) { best = b; bp = p; bd = d; }
    }
    return best;
  }
  // Los extremos de esta ruta para este vehículo (los elige si hace falta).
  L.extremos = function (u, r) {
    const g = G();
    let from = L.comodin(r.de) ? g.bById.get(u.rDe) : g.bById.get(r.de), to = L.comodin(r.a) ? g.bById.get(u.rA) : g.bById.get(r.a);
    if (r.de === 'campo' && !(from && L.camposRuta(r).includes(from))) { from = mejorCampo(r, u, u.rExcl && u.rExclT > g.ahora() ? u.rExcl : null); u.rDe = from ? from.id : null; }
    if (r.a === 'bodega' && !(to && L.esBodegaRuta(to))) { const o = from || u; to = mejorBodega(listaPara(u, r, from), o.cx !== undefined ? o.cx : o.x, o.cy !== undefined ? o.cy : o.y); u.rA = to ? to.id : null; }
    if (r.de === 'bodega' && !(from && L.esBodegaRuta(from))) { from = to ? cercana(L.bodegasRuta(), to.cx, to.cy) : null; u.rDe = from ? from.id : null; }
    return { from, to };
  };
  // Unos extremos de muestra (para los tiempos, «Ver» y el cálculo sin conexión): el campamento con más y la bodega
  // más cercana a él.
  L.extremosRep = function (r) {
    const g = G();
    let from = L.comodin(r.de) ? null : g.bById.get(r.de), to = L.comodin(r.a) ? null : g.bById.get(r.a);
    if (r.de === 'campo') from = mejorCampo(r, null, null, true);
    if (r.a === 'bodega' && from) to = mejorBodega(listaPara(null, r, from), from.cx, from.cy);
    if (r.de === 'bodega' && to) from = cercana(L.bodegasRuta(), to.cx, to.cy);
    return { from, to };
  };
  // Nombre de un extremo, para la ventana y el panel.
  L.TIPO_NOMBRE = { lumber: 'Cualquier campamento maderero', mining: 'Cualquier campamento minero', mill: 'Cualquier Molino de afuera' };
  L.TIPO_PLURAL = { lumber: 'campamentos madereros', mining: 'campamentos mineros', mill: 'Molinos fuera de tu tierra' };
  L.nombreExtremo = function (v, res, tipo) {
    if (v === 'campo' && tipo) return L.TIPO_NOMBRE[tipo] + (res && (D.BUILD[tipo].drop || []).length > 1 ? ' (solo ' + D.RES[res].name.toLowerCase() + ')' : '');
    if (v === 'campo') return 'Cualquier campamento' + (res ? ' de ' + D.RES[res].name.toLowerCase() : '');
    if (v === 'bodega') return 'Cualquier bodega';
    const b = G().bById.get(v);
    return b ? b.def.name : '?';
  };
  L.nombreRuta = r => L.nombreExtremo(r.de, r.res, r.tipo) + ' → ' + L.nombreExtremo(r.a, r.res) + (r.res && r.de !== 'campo' ? ' (' + D.RES[r.res].name.toLowerCase() + ')' : '');
  // Una ruta que sale de un campamento es de carromatos; las demás, de carretas.
  L.claseRuta = r => { if (r.de === 'campo') return 'carromato'; if (r.de === 'bodega') return 'cart'; const a = G().bById.get(r.de); return a && a.type === 'colonia' ? 'barcaza' : a && L.esCampo(a) ? 'carromato' : 'cart'; };
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
  // pk-54: rutas con un extremo comodín
  L.comodinMalo = function (de, a, res, tipo) {
    const g = G(), A = L.comodin(de) ? null : g.bById.get(de), B = L.comodin(a) ? null : g.bById.get(a);
    if (de === 'campo') {
      if (!res && !tipo) return 'Elige de qué campamentos.';
      const cs = L.camposDe(res, tipo), que = res ? D.RES[res].name.toLowerCase() : null;
      if (!cs.length) return res ? 'No tienes ' + (tipo ? L.TIPO_PLURAL[tipo] : 'campamentos') + ' terminados que junten ' + que + '.' : 'No tienes ' + L.TIPO_PLURAL[tipo] + ' terminados.';
      const lista = res ? [res] : [...new Set(cs.flatMap(b => b.def.drop || []))];
      if (a === 'bodega') return lista.some(k => L.bodegasRuta(k).length) ? null : 'No tienes una bodega que reciba ' + (que || 'lo que juntan') + '.';
      if (!B) return 'Elige el destino.';
      if (!L.puntoCarreta(B)) return 'Un carromato lleva lo del campamento a una bodega del pueblo o a un taller.';
      return lista.some(k => acepta(B, k)) ? null : B.def.name + ' no recibe ' + (que || 'nada de lo que juntan') + '.';
    }
    if (de === 'bodega') {
      if (!B) return 'Elige el taller de destino.';
      if (!L.isShop(B)) return 'Desde «cualquier bodega» la carreta lleva a un taller.';
      return L.bodegasRuta().length ? null : 'No tienes bodegas.';
    }
    if (a === 'bodega') {
      if (!A) return 'Elige el origen.';
      if (A.type === 'colonia') return 'Una barcaza lleva lo del Muelle de la colonia al Embarcadero de colonos de tu isla.';
      if (PK.Libro.almacenDe(A) !== A) return 'Lo que junta ' + A.def.name + ' se guarda en el Muelle de la colonia: la barcaza sale de ahí.';
      if (L.esCampo(A)) return (A.def.drop || []).some(k => L.bodegasRuta(k).length) ? null : 'No tienes una bodega que reciba lo que junta ' + A.def.name + '.';
      if (L.isShop(A)) return L.bodegasRuta(L.output(A)).length ? null : 'No tienes una bodega que reciba ' + D.RES[L.output(A)].name.toLowerCase() + '.';
      return 'Entre dos bodegas no hace falta: lo que hay en una ya sirve en todo el pueblo.';
    }
    return null;
  };
  L.rutaMala = function (r) {
    if (L.comodin(r.de) || L.comodin(r.a)) {
      const why = L.comodinMalo(r.de, r.a, r.res, r.tipo);
      if (why) return why;
      for (const v of [r.de, r.a]) if (!L.comodin(v)) { const b = G().bById.get(v); if (!b) return 'El ' + (v === r.de ? 'origen' : 'destino') + ' ya no existe: cambia la ruta.'; if (!b.done) return b.def.name + ' todavía está en obra.'; }
      return null;
    }
    const g = G(), a = g.bById.get(r.de), b = g.bById.get(r.a);
    if (!a || !b) return 'El ' + (!a ? 'origen' : 'destino') + ' ya no existe: cambia la ruta.';
    if (!a.done || !b.done) return (!a.done ? a : b).def.name + ' todavía está en obra.';
    return L.parMalo(a, b);
  };
  L.crearRuta = function (de, a, res, tipo) {
    const g = G(), A = L.comodin(de) ? null : g.bById.get(de), B = L.comodin(a) ? null : g.bById.get(a);
    if (de !== 'campo') tipo = null;
    const why = L.comodin(de) || L.comodin(a) ? L.comodinMalo(de, a, res, tipo) : L.parMalo(A, B);
    if (why) { toast(why, 'warn'); return null; }
    if (res && B && !acepta(B, res)) { toast(B.def.name + ' no recibe ' + D.RES[res].name.toLowerCase() + '.', 'warn'); return null; }
    const st = S(), r = { id: st.logi.nextRuta++, de, a, res: res || null };
    if (tipo) r.tipo = tipo;
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
    u.ruta = id || null; u.job = null; u.path = []; u.espera = 0; u.wait = 0; u.rDe = u.rA = null;
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
    const { from: a, to: b } = L.extremosRep(r);
    if (!a || !b) return null;
    const k = L.claseRuta(r), perfil = L.PERFIL_DE[k], i = L.camino(a, b, perfil, forzar), v = L.camino(b, a, perfil, forzar);
    if (!i || !v) return null;
    if (!i.ok || !v.ok) return { ok: false };
    const sp = velocidad(perfil), ida = i.costo / sp, vuelta = v.costo / sp, ciclo = ida + vuelta + 1.2 + 1;
    return { ok: true, ida, vuelta, ciclo, ritmo: (L.cartsDe(r).length * L.capDe(k) * 60) / ciclo };
  };

  // ---------- Rutas recomendadas (pk-54, pedido del dueño) ----------
  // Lo que conviene armar ahora: campamentos que nadie vacía, talleres lejos de una bodega sin quien les traiga o les
  // saque, colonias sin barcaza, y caminos para empedrar en las rutas que más andan fuera del camino. Cada una:
  // { id, tipo: 'ruta' | 'camino', de, a, res, txt, por, ruta? , tiles? }. Solo sugiere: la ruta la creas tú.
  L.sugerencias = function () {
    const g = G(), st = S(), out = [], rutas = st.logi.rutas;
    const conCarros = r => L.cartsDe(r).length > 0;
    const yaEsta = (de, a, res, tipo) => rutas.some(r => r.de === de && r.a === a && (r.res || null) === (res || null) && (r.tipo || null) === (tipo || null));
    const vaciado = b => L.rutasDesde(b).some(conCarros);
    // 1) campamentos sin carromato, por tipo (pk-55): con dos o más, «cualquier campamento minero» (trae de todo)
    const porTipo = {};
    for (const b of PK.Libro.campos()) {
      if (!L.TIPOS_CAMPO.includes(b.type) || PK.Libro.almacenDe(b) !== b || vaciado(b)) continue;
      if (!(b.def.drop || []).some(k => L.bodegasRuta(k).length)) continue;
      (porTipo[b.type] = porTipo[b.type] || []).push(b);
    }
    for (const t in porTipo) {
      const cs = porTipo[t], tot = cs.reduce((n, b) => n + PK.Libro.totalCampo(b), 0), varios = (D.BUILD[t].drop || []).length > 1;
      if (cs.length >= 2 && !yaEsta('campo', 'bodega', null, t)) out.push({ id: 'c:' + t, tipo: 'ruta', de: 'campo', a: 'bodega', res: null, ctipo: t, txt: L.nombreExtremo('campo', null, t) + ' → Cualquier bodega', por: cs.length + ' ' + L.TIPO_PLURAL[t] + ' sin carromato (guardan ' + U.fmt(Math.floor(tot)) + '). Cada viaje va al que tiene más' + (varios ? ' y trae de todo lo que junten, mezclado.' : '.'), peso: 60 + tot / 50 });
      else if (cs.length === 1 && !yaEsta(cs[0].id, 'bodega', null)) out.push({ id: 'c1:' + cs[0].id, tipo: 'ruta', de: cs[0].id, a: 'bodega', res: null, txt: cs[0].def.name + ' → Cualquier bodega', por: 'Nadie lo vacía' + (PK.Libro.campoLleno(cs[0]) ? ' y está lleno: sus aldeanos esperan.' : ' (guarda ' + U.fmt(Math.floor(PK.Libro.totalCampo(cs[0]))) + ').'), peso: 50 + PK.Libro.totalCampo(cs[0]) / 50 + (PK.Libro.campoLleno(cs[0]) ? 30 : 0) });
    }
    // 2) talleres lejos de una bodega: que alguien les traiga y les saque
    for (const b of g.buildings) {
      if (b.owner !== 'p' || !b.done || !L.isShop(b) || L.nearStore(b) || PK.Libro.almacenDe(b) !== b) continue;
      if (!L.supplied(b) && !L.rutasHacia(b).length && !st.logi.belts.some(bl => bl.b === b.id)) out.push({ id: 'i:' + b.id, tipo: 'ruta', de: 'bodega', a: b.id, res: null, txt: 'Cualquier bodega → ' + b.def.name, por: 'Está lejos de las bodegas y nadie le trae insumos: no produce.', peso: 45 });
      const outR = L.output(b);
      if (!L.rutasDesde(b).length && !st.logi.belts.some(bl => bl.a === b.id) && L.bodegasRuta(outR).length) out.push({ id: 'o:' + b.id, tipo: 'ruta', de: b.id, a: 'bodega', res: null, txt: b.def.name + ' → Cualquier bodega', por: 'Nadie saca lo que hace (' + D.RES[outR].name.toLowerCase() + ')' + ((b.outb && b.outb[outR] >= L.bufCap(b) - 1) ? ': su depósito está lleno y paró.' : '.'), peso: 40 + ((b.outb && b.outb[outR]) || 0) / 20 });
    }
    // 3) colonias sin barcaza
    for (const b of PK.Libro.campos()) {
      if (b.type !== 'colonia' || vaciado(b)) continue;
      const emb = cercana(g.buildings.filter(o => o.owner === 'p' && o.done && o.type === 'embarcadero'), b.cx, b.cy);
      if (emb && !yaEsta(b.id, emb.id, null)) out.push({ id: 'm:' + b.id, tipo: 'ruta', de: b.id, a: emb.id, res: null, txt: b.def.name + ' → ' + emb.def.name, por: 'Lo que juntan tus colonos no llega a tu isla sin una barcaza.', peso: 55 });
    }
    // 4) caminos: en las rutas con vehículos, lo que andan fuera del camino dentro de tu tierra
    for (const r of rutas) {
      if (!conCarros(r) || L.claseRuta(r) === 'barcaza' || L.rutaMala(r)) continue;
      const { from, to } = L.extremosRep(r);
      if (!from || !to) continue;
      const e = L.camino(from, to, L.PERFIL_DE[L.claseRuta(r)]);
      if (!e || !e.ok) continue;
      const tiles = e.path.filter(([x, y]) => L.roadAllowed(x, y) && !W.road[W.idx(x, y)] && !(W.autopista && W.autopista[W.idx(x, y)]));
      if (tiles.length >= 5) out.push({ id: 'r:' + r.id, tipo: 'camino', ruta: r.id, tiles, txt: 'Empedrar ' + L.nombreRuta(r), por: tiles.length + ' casillas de tu tierra sin camino: por camino van casi tres veces más rápido.', peso: 20 + tiles.length / 2 });
    }
    return out.sort((x, y) => y.peso - x.peso).slice(0, 5);
  };
  L.costoCamino = n => { const c = {}; for (const r in D.ROAD.cost) c[r] = D.ROAD.cost[r] * n; return c; };

  L.capDe = kind => (kind === 'carromato' ? L.carroCap() : kind === 'barcaza' ? L.barcaCap() : L.cartCap());
  // Lo que ya viene en camino a un edificio (para no llevarle de más).
  function inbound(b, res) {
    let n = 0;
    for (const u of G().units) if (L.esVehiculo(u) && u.job && u.job.to === b.id) n += u.job.carga ? u.job.carga[res] || 0 : u.job.res === res ? u.job.n : 0;
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
  // pk-55: de un campamento sin recurso fijo, de todo lo que el destino recibe, lo que más hay primero, hasta llenar.
  function queCargarVarios(from, to, cap, contar) {
    const inv = from.inv || {}, out = [];
    const cands = Object.keys(inv).filter(k => acepta(to, k)).map(k => ({ res: k, n: Math.min(hay(from, to, k), necesita(to, k, contar)) })).filter(o => o.n >= 1).sort((x, y) => y.n - x.n);
    let resto = cap;
    for (const o of cands) { const n = Math.floor(Math.min(o.n, resto)); if (n >= 1) { out.push({ res: o.res, n }); resto -= n; } if (resto < 1) break; }
    return out;
  }
  L.queCargarVarios = queCargarVarios;

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
    const { from, to } = L.extremos(u, r), lleva = u.carry > 0.5;
    if (!from || !to) { u.job = null; u.estado = 'Buscando ' + (!from ? 'de dónde cargar' : 'dónde descargar') + '…'; u.mode = 'idle'; u.wait = 3; if (lleva && !to) dropCargo(u); return; }
    const tgt = lleva ? to : from, desde = lleva ? from : to;
    u.job = { ruta: r.id, from: from.id, to: to.id, res: (lleva && u.carryRes) || r.res, n: lleva ? u.carry : 0, carga: lleva && u.carga ? u.carga : undefined, phase: lleva ? 'back' : 'go' };
    const llego = u.kind === 'barcaza' ? (pt => !!pt && U.dist(u.x, u.y, pt[0] + 0.5, pt[1] + 0.5) < 1.9)(L.atracadero(tgt)) : Un.nearRect(u, tgt.x, tgt.y, tgt.x + tgt.w - 1, tgt.y + tgt.h - 1, 1.2);
    if (!llego) {
      u.estado = lleva ? 'Lleva ' + nombresCarga(L.cargaDe(u)) + ' a ' + to.def.name : 'Va a cargar a ' + from.def.name;
      if (!ir(u, desde, tgt)) {
        if (L.comodin(lleva ? r.a : r.de)) { if (lleva) u.rA = null; else { u.rExcl = from.id; u.rExclT = G().ahora() + 60; u.rDe = null; } } // pk-54: probar con otro
        u.estado = 'Sin camino hasta ' + tgt.def.name + (u.kind === 'barcaza' ? ' (necesita agua libre cerca de los dos muelles)' : u.kind === 'carromato' ? ' (los carromatos solo cruzan tu muralla por un Gran Portón)' : ' (las carretas no salen de tu territorio)'); u.mode = 'idle'; u.wait = 4; }
      return;
    }
    if (lleva) descargar(u, to); else cargar(u, r, from, to);
  };
  function cargar(u, r, from, to) {
    const cap = L.capDe(u.kind);
    if (!r.res && L.esCampo(from)) { cargarVarios(u, r, from, to, cap); return; }
    const q = queCargar(r, from, to, cap, true);
    // pk-54: «cualquier campamento»: si aquí hay poco y otro tiene al menos media carga, va a ese
    if (r.de === 'campo' && (!q || q.n < cap * 0.5)) {
      const otro = mejorCampo(r, u, from.id);
      if (otro && stockRuta(otro, r) >= cap * 0.5 && stockRuta(otro, r) > (q ? q.n : 0)) { u.rDe = otro.id; u.wait = 0.3; u.estado = 'Va a ' + otro.def.name + ', que tiene más'; return; }
    }
    const lleno = q ? Math.min(cap, q.need) : 0;
    u.mode = 'idle';
    if (q && q.n >= 1 && (q.n >= lleno - 0.5 || q.n >= cap * 0.5 || (u.espera || 0) >= 60)) {
      const n = take(from, q.res, q.n);
      if (n >= 1) {
        u.carry = n; u.carryRes = q.res; u.espera = 0; u.wait = 0.6;
        if (r.a === 'bodega') { const d = mejorBodega(q.res, from.cx, from.cy); u.rA = d ? d.id : null; } // la más cercana con lugar
        u.estado = 'Cargando ' + D.RES[q.res].name.toLowerCase();
        return;
      }
    }
    u.espera = (u.espera || 0) + 3; u.wait = 3;
    u.estado = !q && L.esCampo(from) ? 'Esperando carga: ' + from.def.name + ' está vacío' : !q || q.need < 1 ? to.def.name + ' no necesita nada por ahora: espera en el origen' : q.n >= 1 ? 'Esperando carga (' + q.n + ' de ' + Math.floor(lleno) + ')' : 'Esperando carga: no hay ' + D.RES[q.res].name.toLowerCase() + (L.isShop(from) ? '' : ' (o lo guarda la reserva)');
  }
  // pk-55: carga mezclada desde un campamento
  function cargarVarios(u, r, from, to, cap) {
    const lista = queCargarVarios(from, to, cap, true), tot = lista.reduce((n, o) => n + o.n, 0);
    if (r.de === 'campo' && tot < cap * 0.5) {
      const otro = mejorCampo(r, u, from.id), so = otro ? stockRuta(otro, r) : 0;
      if (otro && so >= cap * 0.5 && so > tot) { u.rDe = otro.id; u.wait = 0.3; u.estado = 'Va a ' + otro.def.name + ', que tiene más'; return; }
    }
    let falta = 0;
    for (const k of Object.keys(from.inv || {})) if (acepta(to, k)) falta += necesita(to, k, true);
    const lleno = Math.min(cap, falta);
    u.mode = 'idle';
    if (tot >= 1 && (tot >= lleno - 0.5 || tot >= cap * 0.5 || (u.espera || 0) >= 60)) {
      const c = {};
      for (const o of lista) { const n = take(from, o.res, o.n); if (n > 0) c[o.res] = (c[o.res] || 0) + n; }
      fijarCarga(u, c);
      if (u.carry >= 1) {
        u.espera = 0; u.wait = 0.6;
        if (r.a === 'bodega') { const d = mejorBodega(Object.keys(c), from.cx, from.cy); u.rA = d ? d.id : null; }
        u.estado = 'Cargando ' + nombresCarga(c);
        return;
      }
    }
    u.espera = (u.espera || 0) + 3; u.wait = 3;
    const vacio = !Object.keys(from.inv || {}).some(k => from.inv[k] >= 1);
    u.estado = vacio ? 'Esperando carga: ' + from.def.name + ' está vacío' : tot < 1 ? to.def.name + ' no necesita nada de lo que hay: espera en el origen' : 'Esperando carga (' + Math.floor(tot) + ' de ' + Math.floor(lleno) + ')';
  }
  function descargar(u, to) {
    const g = G(), c = Object.assign({}, L.cargaDe(u));
    let i = 0;
    for (const k in c) {
      if (!acepta(to, k)) continue;
      const n = put(to, k, c[k]);
      if (n > 0) {
        if (PK.Render.float && !g.offline) PK.Render.float(to.cx, to.cy - 0.6 * i++, '+' + Math.floor(n), k);
        g.stat('hauled', n);
      }
      c[k] -= n;
    }
    fijarCarga(u, c);
    if (u.carry > 0.5) {
      const r = L.rutaDe(u), resto = Object.keys(c), recibe = resto.some(k => acepta(to, k));
      if (r && r.a === 'bodega') { const d = mejorBodega(resto, to.cx, to.cy); if (d && d !== to && resto.some(k => acepta(d, k) && PK.Libro.lugar(d, k) >= 1)) { u.rA = d.id; u.wait = 0.3; u.estado = to.def.name + (recibe ? ' está lleno' : ' no recibe ' + nombresCarga(c)) + ': va a ' + d.def.name; return; } } // pk-54
      if (recibe) { u.estado = to.def.name + ' está lleno: espera para descargar'; u.mode = 'idle'; u.wait = 3; return; }
      dropCargo(u); // lo que ese destino no recibe (cambiaron la ruta) vuelve a la bodega
    }
    u.carry = 0; u.carryRes = null; u.carga = null; u.wait = 0.6; u.estado = 'Descargando';
    u.rDe = u.rA = null; // pk-54: el próximo viaje vuelve a elegir (el campamento con más)
  }
  // Lo que llevaba vuelve entero a la bodega (aunque esté llena: es tuyo, no una cosecha).
  function dropCargo(u) {
    const c = L.cargaDe(u);
    for (const k in c) if (c[k] > 0) S().res[k] = (S().res[k] || 0) + c[k];
    u.carry = 0; u.carryRes = null; u.carga = null;
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
    // pk-55 (pedido del dueño): los caminos, solo en tu tierra. Afuera va la Calzada Real.
    return W.fog[k] && W.terrain[k] !== 4 && W.bAt[k] < 0 && W.poiAt[k] < 0 && o === 'p' && !(W.block[k] && W.block[k] !== 1);
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
    revisarCaminos();
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
      for (let k = 0; k < 8 && budget >= 1; k++) {
        const { from, to } = L.extremosRep(r); // pk-54: con comodín, cada tanda sale del campamento que más tiene
        if (!from || !to) break;
        // pk-55: de un campamento sin recurso fijo, de todo (carga mezclada)
        const lista = !r.res && L.esCampo(from) ? queCargarVarios(from, to, budget, false) : (q => (q && q.n >= 1 ? [q] : []))(queCargar(r, from, to, budget, false));
        if (!lista.length) break;
        let movido = 0;
        for (const q of lista) {
          const m = take(from, q.res, q.n);
          const puesto = put(to, q.res, m);
          if (puesto < m) { if (L.isShop(from)) from.outb[q.res] += m - puesto; else if (L.esCampo(from)) PK.Libro.inv(from)[q.res] = (PK.Libro.inv(from)[q.res] || 0) + m - puesto; else st.res[q.res] += m - puesto; }
          if (puesto > 0) g.stat('hauled', puesto);
          movido += puesto;
        }
        budget -= Math.max(1, movido);
        if (movido < 1) break;
      }
    }
  };

  // Si una parcela cambia de dueño, las cintas que pasaban por ahí se cortan.
  L.onTerritory = function () {
    const st = S();
    if (!st.logi) return;
    for (const bl of st.logi.belts.slice()) if (bl.path.some(([x, y]) => W.ownerAt(x, y) !== 'p')) { markBelt(bl, false); st.logi.belts.splice(st.logi.belts.indexOf(bl), 1); }
    for (let i = 0; i < W.road.length; i++) if (W.road[i]) { const o = W.ownerAt(i % W.W, Math.floor(i / W.W)); if (o !== 'p') W.road[i] = 0; }
    W.roadVer++;
  };
  // pk-55: los caminos que quedaron fuera de tu tierra (de antes, cuando se podía en tierra de nadie) se quitan una vez,
  // devolviendo la mitad, como «Quitar caminos».
  let caminosRevisados = false;
  function revisarCaminos() {
    if (caminosRevisados || !W.terr) return;
    caminosRevisados = true;
    let n = 0;
    for (let i = 0; i < W.road.length; i++) if (W.road[i] && W.ownerAt(i % W.W, Math.floor(i / W.W)) !== 'p') { W.road[i] = 0; n++; }
    if (!n) return;
    W.roadVer++;
    const c = {}; for (const r in D.ROAD.cost) c[r] = D.ROAD.cost[r] * n;
    G().give(c, 0.5);
    if (!G().offline) setTimeout(() => toast('Los caminos ahora van solo dentro de tu tierra: se quitaron ' + n + ' casillas de afuera y te devolvimos la mitad. Afuera usa la Calzada Real.', 'info'), 1500);
  }
  L.revisarCaminos = revisarCaminos;
  // Al demoler un edificio, sus cintas se desarman (se devuelve la mitad).
  L.onRemove = function (b) {
    const st = S();
    if (!st || !st.logi) return;
    for (const bl of st.logi.belts.slice()) if (bl.a === b.id || bl.b === b.id) L.removeBelt(bl);
    if (b.inb) for (const k in b.inb) st.res[k] += Math.floor(b.inb[k]);
    if (b.outb) for (const k in b.outb) st.res[k] += Math.floor(b.outb[k]);
  };
})();
