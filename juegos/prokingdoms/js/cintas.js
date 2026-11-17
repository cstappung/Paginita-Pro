// Red de cintas (pk-58, Fase C1 de PLAN-CINTAS.md, pedido del dueño): las cintas son piezas sobre casillas, no
// uniones entre dos edificios.
//  - Cada pieza (st.logi.red.t[k]) tiene tipo p ('c' cinta, 'k' cruce, 'e' entrada de paso elevado, 'x' su salida),
//    dirección de salida d (0 E, 1 S, 2 O, 3 N) y nivel n (1..5, D.CINTA.niv).
//  - Una cinta que apunta a un edificio es su boca de ENTRADA; una que nace junto a un edificio (sin otra cinta que la
//    alimente) es su boca de SALIDA. Un taller saca lo que hace; un campamento, todo lo que guarda (mezclado); una
//    bodega, lo que elijas en la boca (pz.f).
//  - Cada ítem lleva su recurso: una cinta lleva cosas mezcladas. Si al destino le llega algo que no usa, la cinta se
//    ATASCA (decisión 1 del dueño) y lo dice.
//  - Cada pieza mueve ítems a la velocidad de su nivel: una de nivel más bajo hace cuello de botella sola.
//  - El cruce deja pasar dos cintas que se cruzan sin tocarse. El paso elevado salta 1 a 4 casillas: por debajo pasan
//    carretas y carromatos, que no cruzan cintas (decisión 3); los aldeanos caminan por encima.
//  - Solo en tu tierra (decisión 6). Mejorar es al instante, con recursos (sin tiempo).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const Ci = (PK.Cintas = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const L = () => PK.Logi;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const OPP = d => (d + 2) % 4;
  const NIV = n => D.CINTA.niv[n - 1];
  // pk-67: un ítem lleva hasta PILA unidades ([recurso, posición, cantidad]; sin cantidad, 1: partidas de antes)
  const PILA = () => D.CINTA.pila || 1;
  const cantDe = it => it[2] || 1;
  Ci.porMin = n => NIV(n).rate * 60 * PILA(); // unidades por minuto de un nivel (sin el bono del árbol)
  Ci.DIRS = DIRS;
  Ci.NOM_DIR = ['E', 'S', 'W', 'N'];
  // Cintas reforzadas (árbol): más rápidas todas. Una vez por instante del juego: G.bono mira la estación y se pedía
  // miles de veces por tick (velocidad y ritmo de cada carril), un tercio del tiempo de la red grande (pk-60).
  let kT = -1, kV = 1;
  const K = () => { const g = G(), t = g.time; if (t !== kT || t === undefined) { kT = t; kV = 1 + (g.bono ? g.bono('belt') : 0); } return kV; };

  // ---------- Datos ----------
  const red = () => S().logi.red;
  Ci.pieza = k => (S() && S().logi && S().logi.red ? red().t[k] || null : null);
  Ci.piezaEn = (x, y) => (W.inb(x, y) ? Ci.pieza(W.idx(x, y)) : null);
  const kOf = (x, y) => W.idx(x, y);
  const xyOf = k => [k % W.W, (k / W.W) | 0];
  function marcar(k, pz) { W.belt[k] = pz ? pz.n : -1; }
  Ci.nombre = pz => (pz.p === 'k' ? 'Cruce de cintas' : pz.p === 'e' || pz.p === 'x' ? 'Paso elevado' : D.CINTA.nodoNombre[pz.p] || NIV(pz.n).name) + ' (nivel ' + U.roman(pz.n) + ')';
  Ci.maxNivel = () => Math.min(D.CINTA.maxFase, D.CINTA.niv.filter(v => S().era >= v.era).length);
  Ci.desbloqueado = () => S().era >= D.CINTA.niv[0].era;
  Ci.lockText = () => 'Las cintas se construyen desde la Era ' + U.roman(D.CINTA.niv[0].era) + '.';
  // costo de pasar una pieza del nivel a al b (a < b), y de construirla de cero en nivel b
  Ci.costoSubir = function (a, b, veces) {
    const c = {};
    for (let n = a + 1; n <= b; n++) for (const r in NIV(n).cost) c[r] = (c[r] || 0) + NIV(n).cost[r] * (veces || 1);
    return c;
  };
  const suma = (a, b) => { for (const r in b) a[r] = (a[r] || 0) + b[r]; return a; };
  function costoPieza(pz) { // lo que costó (para devolver la mitad)
    const c = Ci.costoSubir(0, pz.n);
    if (pz.p === 'k') suma(c, D.CINTA.cruce);
    if (pz.p === 'e') suma(c, D.CINTA.paso);
    if (D.CINTA.nodos[pz.p]) suma(c, D.CINTA.nodos[pz.p]);
    return c;
  }

  // ---------- Dónde se puede ----------
  Ci.libre = function (x, y) {
    if (!W.inb(x, y)) return false;
    const k = kOf(x, y);
    return !!W.fog[k] && W.terrain[k] !== 4 && W.bAt[k] < 0 && W.belt[k] < 0 && W.poiAt[k] < 0 && W.block[k] !== 1 && !W.wall[k] &&
      !W.road[k] && !(W.autopista && W.autopista[k]) && W.ownerAt(x, y) === 'p' && !enPaso(k);
  };
  Ci.porQue = function (x, y) {
    if (!W.inb(x, y)) return 'fuera del mapa';
    const k = kOf(x, y);
    if (W.ownerAt(x, y) !== 'p') return 'solo en tu tierra';
    if (!W.fog[k]) return 'sin explorar';
    if (W.terrain[k] === 4) return 'agua';
    if (W.road[k] || (W.autopista && W.autopista[k])) return 'hay camino: cruza con un paso elevado';
    if (W.bAt[k] >= 0) return 'hay un edificio';
    if (W.belt[k] >= 0) return 'ya hay cinta';
    if (W.wall[k]) return 'hay muralla';
    if (enPaso(k)) return 'es la entrada o salida de un paso elevado';
    return 'ocupado';
  };
  function enPaso(k) { const pz = red() && red().t[k]; return !!pz && (pz.p === 'e' || pz.p === 'x'); }

  // ---------- La red armada: carriles ----------
  // Cada pieza tiene un carril (el cruce, dos). Un carril: { k, pz, l (0 o 1), d, len, outs, ent, src, sig, dst }.
  // outs: a dónde puede pasar lo que llega a su final ({ c: carril } o { b: edificio }, con su dirección d). Una cinta
  // tiene una salida; el divisor y el clasificador (C2), hasta tres (adelante y los costados). ent: quién le entrega;
  // el unidor recibe de hasta tres, los demás de uno. sig/dst: la primera salida a un carril o a un edificio.
  const NODO = { u: 1, v: 1, s: 1 };
  Ci.NODO = NODO;
  // pk-67: las herramientas del menú de cintas (PK.Logi.tool) que se usan tocando una pieza, y todas las del menú
  Ci.HERR_PIEZA = { cnodo: 1, csubir: 1, cgirar: 1, cquitar: 1, cmolde: 1 };
  Ci.HERR = Object.assign({ cinta: 1, paso: 1, copiar: 1 }, Ci.HERR_PIEZA);
  let carriles = [], porK = new Map(), orden = [], clave = '';
  Ci.version = 0;
  function rearmarSiHace() {
    const g = G(), bs = g.buildings;
    let h = 0;
    for (const b of bs) if (b.owner === 'p') h = (h * 31 + b.id * 7 + (b.done ? 1 : 0)) | 0;
    const key = Ci.version + '|' + bs.length + '|' + h;
    if (key !== clave) { clave = key; rearmar(); }
  }
  Ci.rearmar = () => { clave = ''; rearmarSiHace(); };
  function edificioEn(x, y) {
    if (!W.inb(x, y)) return null;
    const id = W.bAt[kOf(x, y)];
    if (id < 0) return null;
    const b = G().bById.get(id);
    return b && b.owner === 'p' && b.done ? b : null;
  }
  const nuevo = (k, pz, l, d, len) => ({ k, pz, l, d, len, outs: [], ent: [], src: null, sig: null, dst: null, motivo: null });
  let armado = 0; // sube con cada rearmar (el dibujo arma su lista de nuevo)
  function rearmar() {
    armado++;
    carriles = []; porK = new Map();
    const t = red().t;
    for (const ks in t) {
      const k = +ks, pz = t[ks];
      const cs = [nuevo(k, pz, 0, pz.d, pz.p === 'e' ? pz.lp || 2 : 1)];
      if (pz.p === 'k') cs.push(nuevo(k, pz, 1, -1, 1));
      porK.set(k, cs);
      carriles.push(...cs);
    }
    const destinos = [];
    for (const c of carriles) if (c.l === 0) apuntar(c, destinos); // el carril de través del cruce toma su dirección de quien entra
    for (const [, tk, d] of destinos) {
      const pz = t[tk];
      if (pz && pz.p === 'k' && d % 2 !== pz.d % 2) { const cr = porK.get(tk)[1]; if (cr.d < 0) { cr.d = d; apuntar(cr, destinos); } }
    }
    // a quién entrega cada carril
    for (const [c, tk, d] of destinos) {
      const pz = t[tk], cs = porK.get(tk);
      if (!pz || !cs) continue;
      let dest = null;
      if (pz.p === 'k') dest = d % 2 === pz.d % 2 ? (d === pz.d ? cs[0] : null) : (cs[1].d === d ? cs[1] : null);
      else if (pz.p === 'x') dest = c.pz.p === 'e' && c.k === pz.desde ? cs[0] : null;
      else if (d !== OPP(pz.d)) dest = cs[0];
      if (dest) dest.ent.push({ c, d });
      else if (!NODO[c.pz.p]) c.motivo = 'choca con otra cinta que va en contra'; // un costado del divisor que da a quien le entrega: nada
    }
    for (const c of carriles) {
      if (!c.ent.length) continue;
      c.ent.sort((a, b) => (a.d === c.pz.d ? 0 : 1) - (b.d === c.pz.d ? 0 : 1)); // la de atrás primero
      c.inD = c.ent[0].d;
      if (c.pz.p === 'u') { for (const o of c.ent) o.c.outs.push({ c, d: o.d }); continue; }
      c.ent[0].c.outs.push({ c, d: c.ent[0].d });
      for (const o of c.ent.slice(1)) o.c.motivo = NODO[c.pz.p] ? 'llega a un ' + (c.pz.p === 's' ? 'clasificador' : 'divisor') + ' que ya tiene entrada' : 'llega a una cinta que ya tiene entrada: para unir dos cintas pon un unidor';
      c.ent = [c.ent[0]];
    }
    for (const c of carriles) { // primero los edificios que tiene adelante, después los carriles (por dirección)
      c.outs.sort((a, b) => ((a.d - c.d + 4) % 4) - ((b.d - c.d + 4) % 4));
      const oc = c.outs.find(o => o.c), ob = c.outs.find(o => o.b);
      c.sig = oc ? oc.c : null; c.dst = ob ? ob.b : null;
    }
    // bocas de salida: un carril sin quien lo alimente, nacido junto a un edificio (atrás o a un costado)
    for (const c of carriles) {
      if (c.ent.length || c.l === 1 || c.pz.p === 'x' || c.pz.p === 'k' || c.pz.p === 'u') continue;
      const [x, y] = xyOf(c.k), d = c.pz.d;
      for (const pd of [OPP(d), (d + 1) % 4, (d + 3) % 4]) {
        const b = edificioEn(x + DIRS[pd][0], y + DIRS[pd][1]);
        if (b && !c.outs.some(o => o.b === b) && esFuente(b)) { c.src = b; c.inD = OPP(pd); break; }
      }
    }
    // orden: lo más cerca del final primero (sin ciclos: uno queda en 0)
    const prof = new Map();
    const hondo = c => {
      if (prof.has(c)) return Math.max(0, prof.get(c));
      prof.set(c, -1);
      let p = 0;
      for (const o of c.outs) if (o.c) p = Math.max(p, hondo(o.c) + 1);
      prof.set(c, p);
      return p;
    };
    for (const c of carriles) hondo(c);
    orden = carriles.slice().sort((a, b) => prof.get(a) - prof.get(b));
    for (const c of carriles) { if (!c.pz.i) c.pz.i = []; if (c.l === 1 && !c.pz.j) c.pz.j = []; }
  }
  function apuntar(c, destinos) {
    const [x, y] = xyOf(c.k), d = c.d;
    if (d < 0) return;
    if (c.pz.p === 'e') { const tk = c.pz.hasta; if (tk !== undefined && red().t[tk]) destinos.push([c, tk, d]); return; } // salta hasta su salida
    const dirs = c.pz.p === 'v' || c.pz.p === 's' ? [d, (d + 1) % 4, (d + 3) % 4] : [d];
    for (const od of dirs) {
      const nx = x + DIRS[od][0], ny = y + DIRS[od][1];
      if (!W.inb(nx, ny)) continue;
      const b = edificioEn(nx, ny);
      if (b) { c.outs.push({ b, d: od }); continue; }
      if (red().t[kOf(nx, ny)]) destinos.push([c, kOf(nx, ny), od]);
    }
  }
  const itemsDe = c => (c.l === 1 ? c.pz.j : c.pz.i);
  const esFuente = b => L().isShop(b) || PK.Libro.esCampo(b) || L().esBodegaRuta(b);
  Ci.carriles = () => { rearmarSiHace(); return carriles; };
  Ci.carrilesEn = k => { rearmarSiHace(); return porK.get(k) || []; };
  // Filtro de una salida del clasificador: un recurso, '*' (lo que sobre) o '' (nada). Sin elegir: adelante «lo que
  // sobre» y los costados cerrados (se porta como una cinta hasta que lo configuras).
  Ci.filtro = (pz, d) => (pz.f2 && pz.f2[d] !== undefined ? pz.f2[d] : d === pz.d ? '*' : '');

  // ---------- Qué entra y qué sale de cada edificio ----------
  // Lo que puede recibir por cinta: un taller sus insumos; una bodega lo que guarda. Un campamento no recibe nada.
  function recibe(b, r) {
    if (L().isShop(b)) return !!L().recipe(b).in[r];
    return L().esBodegaRuta(b) && L().storeAccepts(b, r);
  }
  Ci.recibe = recibe;
  function lugarEn(b, r) {
    if (L().isShop(b)) return L().bufCap(b) - ((b.inb && b.inb[r]) || 0);
    return G().cap(r) - (S().res[r] || 0);
  }
  // cuántas unidades entregó (puede ser parte del paquete, si no hay lugar para todo), o 'no' (no lo usa).
  // deBodega (pk-70): el paquete salió de una bodega del pueblo; a otra bodega siempre vuelve (ya contaba en el tope:
  // con el pueblo lleno, o sobre el tope por un premio, la cinta de bodega a bodega se llenaba con 3 paquetes y paraba)
  function entregar(b, r, cant, deBodega) {
    if (!recibe(b, r)) return 'no';
    const tienda = L().isShop(b), extra = deBodega && !tienda ? cant : 0;
    let m = Math.min(cant, Math.floor(Math.max(0, lugarEn(b, r)) + extra));
    if (cant < 1 && Math.max(0, lugarEn(b, r)) + extra >= cant) m = cant; // pk-77: el resto de un paquete que no llega a 1 entra (si no, esperaba para siempre)
    if (m <= 0) return 0;
    if (tienda) { if (!b.inb) b.inb = {}; b.inb[r] = (b.inb[r] || 0) + m; }
    else m = PK.Libro.poner(b, r, m, extra);
    if (m > 0) G().stat('belted', m);
    return Math.max(0, m);
  }
  // Lo que da una boca de salida, por turnos (pz.rr): [recurso, cantidad] (un paquete de PILA). null: nada.
  // pk-75 (pedido del dueño): solo sale un paquete lleno. Antes salía lo que hubiera (de 1 a PILA) y una boca que
  // goteaba de a 1 ocupaba la cinta igual que una de 16: se saturaba moviendo poco. Lo que va de a poco espera.
  function sacar(c) {
    const b = c.src, pz = c.pz, acepta = aceptaAbajo(c);
    if (c.motivo && c.motivo.startsWith('No sale nada')) c.motivo = null; // se vuelve a ver en cada intento
    if (L().isShop(b)) {
      const out = L().output(b);
      if (!acepta.has(out)) { c.motivo = nadieRecibe([out]); return null; } // nadie adelante lo recibe: no sale (se trabaría)
      if (!b.outb) b.outb = {};
      if ((b.outb[out] || 0) < PILA()) return null;
      b.outb[out] -= PILA();
      return [out, PILA()];
    }
    const lista = opcionesFuente(c);
    if (lista.length && !lista.some(r => acepta.has(r))) { c.motivo = nadieRecibe(lista); return null; }
    for (let i = 0; i < lista.length; i++) {
      const j = ((pz.rr || 0) + i) % lista.length, r = lista[j];
      if (!acepta.has(r) || !disponible(b, r)) continue; // pk-70: solo lo que alguien de adelante recibe
      if (hayDe(b, r) < PILA()) continue;
      if (!PK.Libro.esCampo(b) && (S().res[r] || 0) < PILA()) continue; // pk-77: Lb.sacar da hasta el total del pueblo (antes de conciliar puede ser menos que el estante)
      const n = PK.Libro.esCampo(b) ? PK.Libro.sacarCampo(b, r, PILA()) : PK.Libro.sacar(b, r, PILA());
      if (n < 1) continue;
      pz.rr = j + 1;
      return PK.Libro.esCampo(b) ? [r, n] : [r, n, 1]; // 1: salió de una bodega del pueblo
    }
    return null;
  }
  const nadieRecibe = rs => 'No sale nada: adelante nadie recibe ' + rs.map(r => D.RES[r].name.toLowerCase()).join(', ');
  // pk-70: qué recursos recibe alguien siguiendo esa cinta (talleres: sus insumos; bodegas: lo que guardan; un
  // clasificador deja pasar lo de su filtro y todo por «lo que sobre»). Se arma de nuevo con cada rearmar.
  let aceptaMemo = new Map(), aceptaArm = -1;
  function aceptaAbajo(c) {
    if (aceptaArm !== armado) { aceptaArm = armado; aceptaMemo = new Map(); }
    let s = aceptaMemo.get(c);
    if (s) return s;
    s = new Set();
    aceptaMemo.set(c, s); // ciclos: lo que se sepa hasta ahí
    for (const o of c.outs) {
      const rs = o.b ? D.RES_ORDER.filter(r => recibe(o.b, r)) : [...aceptaAbajo(o.c)];
      for (const r of rs) if (c.pz.p !== 's' || Ci.filtro(c.pz, o.d) === r || Ci.filtro(c.pz, o.d) === '*') s.add(r);
    }
    return s;
  }
  Ci.aceptaAbajo = k => { rearmarSiHace(); const c = (porK.get(k) || [])[0]; return c ? aceptaAbajo(c) : new Set(); };
  // cuánto puede dar de eso (lo que hay en sus estantes; pk-73: sin mirar la reserva de los talleres)
  function hayDe(b, r) {
    return PK.Libro.inv(b)[r] || 0;
  }
  // qué puede salir por esa boca: lo que hace el taller, lo que junta el campamento, lo elegido en la bodega
  function opcionesFuente(c) {
    const b = c.src;
    if (L().isShop(b)) return [L().output(b)];
    if (PK.Libro.esCampo(b)) return (b.def.drop || []).slice();
    return (c.pz.f || []).filter(r => L().storeAccepts(b, r));
  }
  Ci.opcionesFuente = opcionesFuente;
  function disponible(b, r) {
    if (L().isShop(b)) return ((b.outb && b.outb[r]) || 0) >= 1;
    if (PK.Libro.esCampo(b)) return (PK.Libro.inv(b)[r] || 0) >= 1;
    // pk-72 (pedido del dueño): de los estantes de esa bodega (cada una tiene su inventario). pk-71 la había hecho
    // sacar del pueblo entero: se volvió atrás. pk-73 (pedido del dueño): sin mirar la reserva de los talleres, porque
    // el taller ya se para solo cuando el pueblo está bajo la reserva; la cinta no tiene que frenar además.
    return (PK.Libro.inv(b)[r] || 0) >= 1;
  }
  Ci.puedeSacar = (b, r) => disponible(b, r);
  // pk-72: por qué una boca no saca ese recurso, en palabras (null si sale). Para el panel de la bodega y de la pieza.
  Ci.porQueNoSale = function (c, r) {
    const b = c.src, nom = D.RES[r].name.toLowerCase();
    if (!b) return null;
    if (!aceptaAbajo(c).has(r)) return 'adelante nadie recibe ' + nom + ' (la cinta no llega a un taller que lo use ni a una bodega)';
    if (L().isShop(b) || PK.Libro.esCampo(b)) return disponible(b, r) ? null : b.def.name + ' no tiene ' + nom + ' para dar';
    if ((PK.Libro.inv(b)[r] || 0) < 1) return b.def.name + ' no tiene ' + nom + ' en sus estantes (lo guardan otras bodegas)';
    if (hayDe(b, r) < PILA()) return 'espera juntar ' + PILA() + ' para mandar un paquete lleno (tiene ' + Math.floor(hayDe(b, r)) + ')';
    return null;
  };

  // ---------- Simulación en vivo ----------
  // Cada pieza acepta un ítem cada 1 / ritmo segundos (c.lib): así una de nivel más bajo deja pasar solo su ritmo y
  // las de atrás se llenan (el cuello de botella sale solo). Los ítems avanzan a la velocidad del nivel y, si se
  // frenan, se juntan a JUNTOS casillas uno de otro. Un gap entre ítems no alcanzaba: una pieza de una casilla se
  // vaciaba antes de medirlo y una de nivel I dejaba pasar 165 en 2 minutos.
  const JUNTOS = 0.34;
  const vel = c => NIV(c.pz.n).vel * K();
  const cada = c => 1 / (NIV(c.pz.n).rate * K());
  // lo que sobró del paso anterior cuenta (hasta un paso), si no el ritmo cae por redondeo: 3/s con pasos de 0,1 s
  // daba 2,5/s
  let pasoDt = 0.1;
  const credito = c => Math.max(c.lib || 0, -pasoDt);
  // pk-60: el último puede estar hasta un tick antes de dejar lugar: el nuevo entra detrás, en negativo (fuera de la
  // pieza), a JUNTOS justo. Esperar al tick siguiente dejaba el nivel V (3,2 casillas/s, 0,32 por tick) en 5/s y no 8.
  const tolera = c => vel(c) * pasoDt + 1e-9;
  function hayLugar(c) { const it = itemsDe(c); return (c.lib || 0) <= 0 && (!it.length || it[it.length - 1][1] >= JUNTOS - tolera(c)); }
  const detras = it => (it.length ? Math.min(0, it[it.length - 1][1] - JUNTOS) : 0);
  // el unidor toma por turnos: si al que le toca tiene algo listo, los demás esperan
  // pk-77: y solo si lo de su punta puede ir a ese unidor. Un divisor salta la rama que no lo recibe (pk-72) y un
  // clasificador la que su filtro cierra: con su turno «listo» para siempre, la otra entrada del unidor quedaba parada.
  function listo(l, dest) {
    const it = itemsDe(l);
    if (!(it.length > 0 && it[0][1] >= l.len - 1e-6)) return false;
    const r = it[0][0];
    return l.outs.some(o => o.c === dest && (l.pz.p !== 's' || Ci.filtro(l.pz, o.d) === r || Ci.filtro(l.pz, o.d) === '*') && (l.outs.length === 1 || aceptaAbajo(dest).has(r)));
  }
  function hayLugarDesde(dest, src) {
    if (!hayLugar(dest)) return false;
    if (dest.pz.p === 'u' && dest.ent.length > 1) {
      const tur = dest.ent[(dest.turno || 0) % dest.ent.length].c;
      if (tur !== src && listo(tur, dest)) return false;
    }
    return true;
  }
  Ci.update = function (dt) {
    const st = S();
    if (!st || !st.logi || !st.logi.red) return;
    rearmarSiHace();
    pasoDt = dt;
    for (const c of orden) c.lib = (c.lib || 0) - dt;
    for (const c of orden) avanzar(c, dt);
    if (st.logi.avisoCintas && !G().offline) { // partidas viejas: una vez, qué cambió
      delete st.logi.avisoCintas;
      setTimeout(() => toast('Las cintas ahora se arman pieza por pieza, con niveles, cruces y pasos elevados. Las tuyas quedaron en nivel III (rinden igual). Ojo: las carretas ya no cruzan cintas.', 'epic', { label: 'Logística', fn: () => PK.UI.openLogistics() }), 2500);
    }
  };
  // Pasa el ítem del final a una de las salidas. true si salió.
  function salir(c, it0) {
    const r = it0[0];
    if (!c.outs.length) { if (!c.motivo || c.motivo === SIN) c.motivo = SIN; return false; }
    let grupos = [c.outs];
    if (c.pz.p === 's') {
      // pk-69 (reporte del dueño): primero las salidas de ese recurso; si están llenas o trabadas, sigue por «lo que
      // sobre». Antes «lo que sobre» solo tomaba lo que no tenía salida propia: con la madera a la derecha atascada,
      // la madera frenaba todo el clasificador en vez de seguir derecho.
      const propias = c.outs.filter(o => Ci.filtro(c.pz, o.d) === r), sobra = c.outs.filter(o => Ci.filtro(c.pz, o.d) === '*');
      grupos = [propias, sobra].filter(g => g.length);
      if (!grupos.length) return devolver(c, it0, 'el clasificador no tiene salida para ' + D.RES[r].name.toLowerCase());
    }
    let noUsa = null, lleno = null;
    for (const elig of grupos) {
      const n = elig.length, ini = (c.rr || 0) % n;
      for (let i = 0; i < n; i++) {
        const o = elig[(ini + i) % n], cant = cantDe(it0);
        if (o.c) {
          // pk-72 (reporte del dueño): un divisor solo manda a una rama donde alguien lo recibe. Antes repartía por turnos
          // sin mirar: la piedra entraba a la rama del aserradero, quedaba en su punta y trababa todo lo de atrás
          // pk-77: en el clasificador también con una sola salida propia (su grupo tiene una): la madera filtrada a una
          // rama sin aserradero volvía al pueblo en la punta en vez de seguir por «lo que sobre», y sin conexión iba por ahí
          if ((n > 1 || c.pz.p === 's') && !aceptaAbajo(o.c).has(r)) { noUsa = noUsa || o.c; continue; }
          if (!hayLugarDesde(o.c, c)) continue;
          const dest = itemsDe(o.c), lim = dest.length ? dest[dest.length - 1][1] - JUNTOS : Infinity;
          dest.push(it0[3] ? [r, Math.min(Math.max(0, itemsDe(c)[0][1] - c.len), lim), cant, 1] : [r, Math.min(Math.max(0, itemsDe(c)[0][1] - c.len), lim), cant]);
          o.c.lib = credito(o.c) + cada(o.c);
          c.pz.flujo = (c.pz.flujo || 0) + cant;
          if (o.c.pz.p === 'u') o.c.turno = (o.c.ent.findIndex(e => e.c === c) + 1) % Math.max(1, o.c.ent.length);
        } else {
          const e = entregar(o.b, r, cant, !!it0[3]);
          if (e === 'no') { noUsa = noUsa || o.b; continue; }
          if (e > 0) c.pz.flujo = (c.pz.flujo || 0) + e;
          if (e < cant) { it0[2] = cant - e; lleno = lleno || o.b; continue; } // lo que no entró espera en la punta (o prueba la otra salida)
        }
        c.rr = (ini + i + 1) % n; c.motivo = null; c.atasco = false;
        return true;
      }
    }
    const todas = grupos.flat();
    if (noUsa && !lleno && todas.every(o => o.b && !recibe(o.b, r))) return devolver(c, it0, 'llegó ' + D.RES[r].name.toLowerCase() + ' y ' + noUsa.def.name + ' no lo usa');
    if (noUsa && !lleno && todas.every(o => o.b ? !recibe(o.b, r) : !aceptaAbajo(o.c).has(r))) return devolver(c, it0, 'ninguna salida de aquí recibe ' + D.RES[r].name.toLowerCase());
    else if (lleno) c.motivo = (L().isShop(lleno) ? lleno.def.name + ' está lleno de ' : 'Tus bodegas están llenas de ') + D.RES[r].name.toLowerCase();
    return false;
  }
  // pk-72: lo que llega a una punta y nadie puede recibir nunca vuelve al pueblo (como al quitar una pieza). Antes
  // quedaba ahí y trababa la cinta para siempre: las partidas con un divisor que repartía a ciegas quedaban con la red
  // llena y la boca sin lugar para sacar nada. El motivo queda a la vista en el panel de la pieza.
  function devolver(c, it0, porque) {
    const r = it0[0];
    S().res[r] = (S().res[r] || 0) + cantDe(it0);
    c.motivo = 'Volvió al pueblo: ' + porque; c.atasco = false;
    return true;
  }
  const SIN = 'La cinta no llega a ningún lado';
  function avanzar(c, dt) {
    const it = itemsDe(c);
    if (!it) return;
    if (!c.outs.length && !c.motivo) c.motivo = SIN; // pk-70: aunque no llegue nada (la boca ya no saca lo que nadie recibe)
    const sp = vel(c) * dt;
    for (let i = 0; i < it.length; i++) it[i][1] = Math.min(it[i][1] + sp, i === 0 ? Infinity : it[i - 1][1] - JUNTOS);
    if (it.length && it[0][1] >= c.len) {
      if (salir(c, it[0])) it.shift();
      else it[0][1] = c.len;
    }
    for (let i = 1; i < it.length; i++) if (it[i][1] > it[i - 1][1] - JUNTOS) it[i][1] = it[i - 1][1] - JUNTOS;
    // boca de salida: saca a su ritmo
    if (c.src && hayLugar(c)) { const s2 = sacar(c); if (s2) { it.push(s2[2] ? [s2[0], detras(it), s2[1], 1] : [s2[0], detras(it), s2[1]]); c.lib = credito(c) + cada(c); } }
  }
  // Ítems por minuto que pasan (medido cada 10 s; pz.flujo cuenta los que salen de la pieza)
  let medT = 0;
  Ci.medir = function (dt) {
    medT += dt;
    if (medT < 10) return;
    const t = red() ? red().t : {};
    for (const ks in t) { const pz = t[ks]; pz.pm = Math.round(((pz.flujo || 0) * 60) / medT); pz.flujo = 0; }
    medT = 0;
  };

  // ---------- Sin conexión: el caudal de la red ----------
  // 1) qué recursos recibe algo río abajo de cada carril; 2) lo que ofrece cada boca (por turnos, hasta su nivel);
  // 3) de arriba hacia abajo, cada carril deja pasar hasta su nivel y reparte: el divisor en partes iguales entre las
  // salidas que llevan a alguien que lo recibe, el clasificador según sus filtros; 4) cada destino toma lo que le
  // cabe; 5) de las bocas sale exactamente lo que se entregó (nada se pierde ni aparece). Una boca que daría algo que
  // nadie recibe no manda nada: en vivo se atascaría.
  function recursosDe(b) { return L().isShop(b) ? Object.keys(L().recipe(b).in) : D.RES_ORDER.filter(r => recibe(b, r)); }
  Ci.offline = function (dt) {
    const st = S();
    if (!st || !st.logi || !st.logi.red) return;
    rearmarSiHace();
    const k0 = K(), acc = new Map();
    const pasaFiltro = (c, o, r) => c.pz.p !== 's' || Ci.filtro(c.pz, o.d) === r || Ci.filtro(c.pz, o.d) === '*'; // pk-69: lo que no cabe en su salida, por «lo que sobre»
    const accDe = c => {
      if (acc.has(c)) return acc.get(c);
      const s = new Set();
      acc.set(c, s); // ciclos: lo que se sepa hasta ahí
      for (const o of c.outs) for (const r of (o.b ? recursosDe(o.b) : accDe(o.c))) if (pasaFiltro(c, o, r)) s.add(r);
      return s;
    };
    // pk-77: el flujo va por clave: el recurso, y «recurso|b» para lo que salió de una bodega del pueblo. Antes iba
    // solo por recurso: el margen sobre el tope de lo que sale de bodegas (pk-70) dejaba pasar también la madera de un
    // campamento, y lo entregado se descontaba a todas las bocas de ese recurso por igual (una que no entregó nada
    // perdía stock y otra que entregó, menos).
    const flujo = new Map(), ofertas = [], resDe = key => key.split('|')[0];
    const sumar = (c, r, n) => { let f = flujo.get(c); if (!f) flujo.set(c, (f = {})); f[r] = (f[r] || 0) + n; };
    for (const c of carriles) {
      if (!c.src) continue;
      const b = c.src, a = accDe(c), opc = opcionesFuente(c).filter(r => disponible(b, r) && a.has(r)); // pk-70: lo que nadie recibe no sale (como en vivo)
      if (!opc.length) continue;
      let presu = NIV(c.pz.n).rate * PILA() * k0 * dt;
      const quedan = {};
      for (const r of opc) quedan[r] = L().isShop(b) ? b.outb[r] || 0 : PK.Libro.inv(b)[r] || 0;
      for (let pasada = 0; pasada < 3 && presu > 0.01; pasada++) {
        const vivos = opc.filter(r => quedan[r] > 0.01);
        if (!vivos.length) break;
        const parte = presu / vivos.length;
        const deB = !L().isShop(b) && !PK.Libro.esCampo(b);
        for (const r of vivos) { const m = Math.min(parte, quedan[r]), key = deB ? r + '|b' : r; quedan[r] -= m; presu -= m; sumar(c, key, m); ofertas.push({ c, b, r, key, n: m }); }
      }
    }
    const entregas = [], pend = new Map();
    const repartir = (outs, key, n) => { const r = resDe(key); for (const o of outs) { const m = n / outs.length; if (o.b) { entregas.push({ b: o.b, r, key, n: m }); pend.set(o.b.id + r, (pend.get(o.b.id + r) || 0) + m); } else sumar(o.c, key, m); } };
    // cuánto más puede tomar una salida en este paso: una cinta, lo que le falta para su tope; un edificio, su lugar
    // (y lo que acepta lo que tiene adelante, hasta un edificio: una cinta que termina en un taller lleno no toma nada)
    const capOut = (o, r, vistos) => {
      if (o.b) return Math.max(0, lugarEn(o.b, r) - (pend.get(o.b.id + r) || 0));
      const c2 = o.c;
      vistos = vistos || new Set();
      if (vistos.has(c2)) return 0; // ciclos y ramas que se juntan: cada cinta cuenta una vez
      vistos.add(c2);
      const f2 = flujo.get(c2), va = f2 ? Object.values(f2).reduce((a, b) => a + b, 0) : 0;
      const propio = Math.max(0, NIV(c2.pz.n).rate * PILA() * k0 * dt - va);
      const adelante = c2.outs.filter(x => pasaFiltro(c2, x, r) && (x.b ? recibe(x.b, r) : accDe(x.c).has(r))).reduce((a, x) => a + capOut(x, r, vistos), 0);
      return Math.min(propio, adelante);
    };
    for (let i = orden.length - 1; i >= 0; i--) {
      const c = orden[i], f = flujo.get(c);
      if (!f) continue;
      const cap = NIV(c.pz.n).rate * PILA() * k0 * dt, tot = Object.values(f).reduce((a, b) => a + b, 0), esc = tot > cap ? cap / tot : 1;
      for (const key in f) {
        const r = resDe(key), n = f[key] * esc, ok = o => (o.b ? recibe(o.b, r) : accDe(o.c).has(r));
        if (n <= 0) continue;
        if (c.pz.p === 's') { // pk-69: primero su salida, hasta lo que da; el resto por «lo que sobre»
          const propias = c.outs.filter(o => Ci.filtro(c.pz, o.d) === r && ok(o)), sobra = c.outs.filter(o => Ci.filtro(c.pz, o.d) === '*' && ok(o));
          let resto = n;
          if (propias.length) { const vs = new Set([c]), va = Math.min(resto, propias.reduce((a, o) => a + capOut(o, r, vs), 0)); repartir(propias, key, va); resto -= va; }
          if (resto > 1e-9 && sobra.length) repartir(sobra, key, resto);
          continue;
        }
        const elig = c.outs.filter(o => pasaFiltro(c, o, r) && ok(o));
        if (elig.length) repartir(elig, key, n);
      }
    }
    const dado = {}, deBod = {}; // pk-70: lo que sale de bodegas vuelve a otra bodega aunque el pueblo esté lleno
    for (const o of ofertas) if (o.key !== o.r) deBod[o.key] = (deBod[o.key] || 0) + o.n;
    for (const e of entregas) {
      const tienda = L().isShop(e.b), extra = tienda ? 0 : Math.max(0, deBod[e.key] || 0);
      let m = Math.floor(Math.min(e.n, Math.max(0, lugarEn(e.b, e.r)) + extra));
      if (m < 1) continue;
      if (tienda) { if (!e.b.inb) e.b.inb = {}; e.b.inb[e.r] = (e.b.inb[e.r] || 0) + m; }
      else { m = PK.Libro.poner(e.b, e.r, m, extra); if (e.key !== e.r) deBod[e.key] = Math.max(0, (deBod[e.key] || 0) - m); }
      if (m > 0) { dado[e.key] = (dado[e.key] || 0) + m; G().stat('belted', m); }
    }
    for (const key in dado) {
      const r = resDe(key), os = ofertas.filter(o => o.key === key), tot = os.reduce((a, o) => a + o.n, 0), fr = tot > 0 ? Math.min(1, dado[key] / tot) : 0;
      for (const o of os) {
        const m = o.n * fr;
        if (L().isShop(o.b)) o.b.outb[r] -= m; else if (PK.Libro.esCampo(o.b)) PK.Libro.sacarCampo(o.b, r, m); else PK.Libro.sacar(o.b, r, m);
      }
    }
  };

  // ---------- Construir ----------
  // Plan de una cinta de (sx,sy) a (ex,ey): en L (primero en x o primero en y, la que se pueda). Si empieza en un
  // edificio, nace en su borde; si termina en uno, la última pieza apunta a él. Si empieza en el final de una cinta,
  // la continúa. Si cruza en recto una cinta que va de través, ahí pone un cruce.
  Ci.plan = function (sx, sy, ex, ey) {
    const bI = edificioEn(sx, sy), bF = edificioEn(ex, ey);
    let s = [sx, sy], e = [ex, ey], dFin = null, sigue = null;
    if (bI) s = bordeHacia(bI, bF ? [bF.cx, bF.cy] : [ex + 0.5, ey + 0.5]);
    if (bF) { e = bordeHacia(bF, s ? [s[0] + 0.5, s[1] + 0.5] : [sx, sy]); if (e) dFin = haciaEdificio(e, bF); }
    if (!s || !e) return null;
    const pzI = Ci.piezaEn(s[0], s[1]);
    let dividir = null;
    if (pzI && !bI) {
      const kS = kOf(s[0], s[1]), cs = Ci.carrilesEn(kS);
      if (pzI.p === 'c' && cs[0] && !cs[0].outs.length) sigue = kS; // continuar una cinta desde su final
      else if (pzI.p === 'c' || pzI.p === 'v' || pzI.p === 's') { // C2: salir del costado de una cinta pone un divisor
        let best = null, bd = Infinity;
        for (const dd of [(pzI.d + 1) % 4, (pzI.d + 3) % 4, pzI.d]) {
          const nx = s[0] + DIRS[dd][0], ny = s[1] + DIRS[dd][1];
          if (!Ci.libre(nx, ny)) continue;
          const dist = U.dist(nx, ny, e[0], e[1]);
          if (dist < bd) { bd = dist; best = [nx, ny]; }
        }
        if (best) { dividir = kS; s = best; }
      }
    }
    const pzF = !bF && Ci.piezaEn(e[0], e[1]), kF = pzF ? kOf(e[0], e[1]) : null;
    let mejor = null;
    for (const xPrimero of [true, false]) {
      const p = lineaL(s, e, xPrimero);
      let unir = null, malaFin = null;
      if (pzF && p.length > 1) { // termina apuntando a esa cinta; si ya recibe de otra, ahí va un unidor (C2)
        const [a, b] = [p[p.length - 2], p[p.length - 1]];
        p.pop(); dFin = dirDe(a, b);
        const c0 = Ci.carrilesEn(kF)[0], tiene = c0 && (c0.ent.length || c0.src);
        if (dFin === OPP(pzF.d)) malaFin = 'llegaría de frente a esa cinta';
        else if (pzF.p === 'c' && tiene) unir = kF;
        else if (pzF.p !== 'c' && pzF.p !== 'u' && tiene) malaFin = 'esa pieza ya recibe de otra cinta';
      }
      const r = evaluar(p, dFin, sigue);
      if (malaFin) r.malas.push({ x: e[0], y: e[1], k: kF, why: malaFin });
      r.unir = unir; r.dividir = dividir;
      r.extra = [unir, dividir].filter(k => k !== null).map(k => ({ x: k % W.W, y: (k / W.W) | 0, k, cruce: true }));
      if (!mejor || r.malas.length < mejor.malas.length) mejor = r;
      if (!r.malas.length) break;
    }
    if (mejor) { mejor.bI = bI; mejor.bF = bF; }
    return mejor;
  };
  // pk-67 (pedido del dueño): primero un borde libre, así de un edificio salen (o le llegan) varias cintas; antes
  // tomaba el borde más cercano aunque ya tuviera una cinta y la segunda chocaba con la primera
  function bordeHacia(b, hacia) {
    let best = null, bd = Infinity, ocup = null, od = Infinity;
    for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
      const borde = (x === b.x - 1 || x === b.x + b.w) !== (y === b.y - 1 || y === b.y + b.h); // sin esquinas
      if (!borde) continue;
      const d = U.dist(x + 0.5, y + 0.5, hacia[0], hacia[1]);
      if (Ci.libre(x, y)) { if (d < bd) { bd = d; best = [x, y]; } }
      else if (Ci.piezaEn(x, y) && d < od) { od = d; ocup = [x, y]; }
    }
    return best || ocup;
  }
  function haciaEdificio(t, b) {
    if (t[0] < b.x) return 0; if (t[0] >= b.x + b.w) return 2; if (t[1] < b.y) return 1; return 3;
  }
  const dirDe = (a, b) => (b[0] > a[0] ? 0 : b[0] < a[0] ? 2 : b[1] > a[1] ? 1 : 3);
  function lineaL(s, e, xPrimero) {
    const out = [[s[0], s[1]]];
    let [x, y] = s;
    const pasoX = () => { while (x !== e[0]) { x += Math.sign(e[0] - x); out.push([x, y]); } };
    const pasoY = () => { while (y !== e[1]) { y += Math.sign(e[1] - y); out.push([x, y]); } };
    if (xPrimero) { pasoX(); pasoY(); } else { pasoY(); pasoX(); }
    return out;
  }
  function evaluar(p, dFin, sigue) {
    const tiles = [], malas = [];
    for (let i = 0; i < p.length; i++) {
      const [x, y] = p[i], k = kOf(x, y);
      const d = i < p.length - 1 ? dirDe(p[i], p[i + 1]) : dFin !== null ? dFin : i > 0 ? dirDe(p[i - 1], p[i]) : 0;
      const pz = Ci.piezaEn(x, y);
      if (i === 0 && sigue === k) { tiles.push({ x, y, k, d, sigue: true }); continue; }
      if (pz) {
        // cruzar en recto una cinta que va de través: cruce
        const recto = i > 0 && i < p.length - 1 && dirDe(p[i - 1], p[i]) === d;
        if (pz.p === 'c' && recto && pz.d % 2 !== d % 2) { tiles.push({ x, y, k, d, cruce: true }); continue; }
        malas.push({ x, y, k, why: pz.p === 'k' ? 'ya es un cruce' : 'ya hay cinta (solo se cruza en recto y de través)' });
        tiles.push({ x, y, k, d, mala: true });
        continue;
      }
      if (!Ci.libre(x, y)) { malas.push({ x, y, k, why: Ci.porQue(x, y) }); tiles.push({ x, y, k, d, mala: true }); continue; }
      tiles.push({ x, y, k, d });
    }
    return { tiles, malas };
  }
  Ci.costoPlan = function (plan, n) {
    const c = {};
    for (const t of plan.tiles) {
      if (t.mala || t.sigue) continue;
      if (t.cruce) suma(c, D.CINTA.cruce);
      else suma(c, Ci.costoSubir(0, n));
    }
    const t = red().t;
    if (plan.unir !== null && plan.unir !== undefined && t[plan.unir] && t[plan.unir].p === 'c') suma(c, D.CINTA.nodos.u);
    if (plan.dividir !== null && plan.dividir !== undefined && t[plan.dividir] && t[plan.dividir].p === 'c') suma(c, D.CINTA.nodos.v);
    return c;
  };
  Ci.trazar = function (plan, n) {
    if (!Ci.desbloqueado()) { toast(Ci.lockText(), 'warn'); return 0; }
    if (!plan || !plan.tiles.length) return 0;
    if (plan.malas.length) { const m = plan.malas[0]; toast('Ahí no se puede: ' + m.why + '.', 'warn'); return 0; }
    n = Math.min(n || 1, Ci.maxNivel());
    if (!G().pay(Ci.costoPlan(plan, n))) { toast('Faltan recursos para esa cinta.', 'warn'); return 0; }
    const t = red().t;
    let cuantas = 0;
    for (const ti of plan.tiles) {
      if (ti.sigue) { t[ti.k].d = ti.d; continue; }
      if (ti.cruce) { t[ti.k].p = 'k'; t[ti.k].j = []; cuantas++; continue; }
      t[ti.k] = { p: 'c', d: ti.d, n, i: [] };
      marcar(ti.k, t[ti.k]);
      cuantas++;
    }
    if (plan.unir !== null && plan.unir !== undefined && t[plan.unir] && t[plan.unir].p === 'c') t[plan.unir].p = 'u'; // C2
    if (plan.dividir !== null && plan.dividir !== undefined && t[plan.dividir] && t[plan.dividir].p === 'c') t[plan.dividir].p = 'v';
    cambio();
    if (PK.Sfx) PK.Sfx.play('build');
    G().stat('belts', 1);
    return cuantas;
  };
  function cambio() { Ci.version++; W.beltVer = (W.beltVer || 0) + 1; clave = ''; }
  Ci.cambio = cambio;

  // Paso elevado: entrada y salida en línea, a 2..5 casillas (por debajo quedan 1 a 4 libres).
  Ci.planPaso = function (sx, sy, ex, ey) {
    const dx = ex - sx, dy = ey - sy, dist = Math.abs(dx) + Math.abs(dy);
    if ((dx && dy) || !dist) return { ok: false, why: 'La entrada y la salida van en la misma fila o columna.', tiles: [[sx, sy], [ex, ey]] };
    if (dist < 2 || dist > D.CINTA.pasoMax) return { ok: false, why: 'El paso elevado salta de 1 a ' + (D.CINTA.pasoMax - 1) + ' casillas (entrada y salida a 2..' + D.CINTA.pasoMax + ' de distancia).', tiles: [[sx, sy], [ex, ey]] };
    const d = dirDe([sx, sy], [ex, ey]);
    for (const [x, y] of [[sx, sy], [ex, ey]]) if (!Ci.libre(x, y)) return { ok: false, why: 'Ahí no se puede: ' + Ci.porQue(x, y) + '.', tiles: [[sx, sy], [ex, ey]], d };
    for (let i = 1; i < dist; i++) { const x = sx + DIRS[d][0] * i, y = sy + DIRS[d][1] * i; if (!W.inb(x, y) || W.ownerAt(x, y) !== 'p') return { ok: false, why: 'Todo el paso tiene que quedar en tu tierra.', tiles: [[sx, sy], [ex, ey]], d }; }
    return { ok: true, d, dist, tiles: [[sx, sy], [ex, ey]] };
  };
  Ci.costoPaso = n => suma(Ci.costoSubir(0, n, 2), D.CINTA.paso);
  Ci.ponerPaso = function (sx, sy, ex, ey, n) {
    if (!Ci.desbloqueado()) { toast(Ci.lockText(), 'warn'); return false; }
    const p = Ci.planPaso(sx, sy, ex, ey);
    if (!p.ok) { toast(p.why, 'warn'); return false; }
    n = Math.min(n || 1, Ci.maxNivel());
    if (!G().pay(Ci.costoPaso(n))) { toast('Faltan recursos para el paso elevado.', 'warn'); return false; }
    const t = red().t, ke = kOf(sx, sy), kx = kOf(ex, ey);
    t[ke] = { p: 'e', d: p.d, n, i: [], hasta: kx, lp: p.dist };
    t[kx] = { p: 'x', d: p.d, n, i: [], desde: ke };
    marcar(ke, t[ke]); marcar(kx, t[kx]);
    cambio();
    if (PK.Sfx) PK.Sfx.play('build');
    return true;
  };

  // ---------- Copiar (C3) ----------
  // Un molde es la red conectada a una pieza (vecinas que se tocan y los dos extremos de cada paso elevado), en
  // casillas relativas a esa pieza. Se estampa en otro lado, girado de a 90°, y se paga como nuevo (sin lo que lleva).
  const MOLDE_MAX = 400;
  Ci.molde = function (k0) {
    const t = red().t;
    if (!t[k0]) return null;
    const [x0, y0] = xyOf(k0), vistos = new Set([k0]), cola = [k0], piezas = [];
    while (cola.length && vistos.size <= MOLDE_MAX) {
      const k = cola.shift(), pz = t[k], [x, y] = xyOf(k);
      const m = { dx: x - x0, dy: y - y0, p: pz.p, d: pz.d, n: pz.n };
      if (pz.f) m.f = pz.f.slice();
      if (pz.f2) m.f2 = Object.assign({}, pz.f2);
      if (pz.p === 'e') { const [hx, hy] = xyOf(pz.hasta); m.hasta = [hx - x0, hy - y0]; m.lp = pz.lp; }
      if (pz.p === 'x') { const [hx, hy] = xyOf(pz.desde); m.desde = [hx - x0, hy - y0]; }
      piezas.push(m);
      const vec = DIRS.map(([a, b]) => (W.inb(x + a, y + b) ? kOf(x + a, y + b) : -1));
      if (pz.p === 'e') vec.push(pz.hasta);
      if (pz.p === 'x') vec.push(pz.desde);
      for (const v of vec) if (v >= 0 && t[v] && !vistos.has(v)) { vistos.add(v); cola.push(v); }
    }
    return { piezas: piezas.slice(0, MOLDE_MAX), corto: vistos.size > MOLDE_MAX };
  };
  const rotar = ([dx, dy], r) => { for (let i = 0; i < r; i++) [dx, dy] = [-dy, dx]; return [dx, dy]; };
  Ci.costoMolde = function (molde) {
    const c = {};
    for (const m of molde.piezas) suma(c, costoPieza(m));
    return c;
  };
  // dónde quedaría el molde con su pieza de origen en (x, y), girado rot cuartos de vuelta (a la derecha)
  Ci.planCopia = function (molde, x, y, rot) {
    rot = ((rot || 0) % 4 + 4) % 4;
    const tiles = [], malas = [], piezas = [];
    for (const m of molde.piezas) {
      const [dx, dy] = rotar([m.dx, m.dy], rot), tx = x + dx, ty = y + dy, d = (m.d + rot) % 4;
      const pz = { p: m.p, d, n: m.n };
      if (m.f) pz.f = m.f.slice();
      if (m.f2) { pz.f2 = {}; for (const q in m.f2) pz.f2[(+q + rot) % 4] = m.f2[q]; }
      if (m.hasta) { const [a, b] = rotar(m.hasta, rot); pz.hasta = [x + a, y + b]; pz.lp = m.lp; }
      if (m.desde) { const [a, b] = rotar(m.desde, rot); pz.desde = [x + a, y + b]; }
      let why = W.inb(tx, ty) ? (Ci.libre(tx, ty) ? null : Ci.porQue(tx, ty)) : 'fuera del mapa';
      if (!why && pz.hasta) for (let i = 1; i < pz.lp; i++) { const a = tx + DIRS[d][0] * i, b = ty + DIRS[d][1] * i; if (!W.inb(a, b) || W.ownerAt(a, b) !== 'p') { why = 'todo el paso tiene que quedar en tu tierra'; break; } }
      const ti = { x: tx, y: ty, d, mala: !!why, cruce: m.p === 'k' };
      tiles.push(ti); piezas.push([tx, ty, pz]);
      if (why) malas.push({ x: tx, y: ty, why });
    }
    return { tiles, malas, piezas, costo: Ci.costoMolde(molde), rot };
  };
  Ci.estampar = function (plan) {
    if (!Ci.desbloqueado()) { toast(Ci.lockText(), 'warn'); return 0; }
    if (!plan || !plan.piezas.length) return 0;
    if (plan.malas.length) { const m = plan.malas[0]; toast('Ahí no se puede: ' + m.why + '.', 'warn'); return 0; }
    const alto = plan.piezas.reduce((a, [, , pz]) => Math.max(a, pz.n), 0);
    if (alto > Ci.maxNivel()) { toast('Ese molde tiene piezas de nivel ' + U.roman(alto) + ': se habilita en la Era ' + U.roman(NIV(alto).era) + '.', 'warn'); return 0; }
    if (!G().pay(plan.costo)) { toast('Faltan recursos para copiarla.', 'warn'); return 0; }
    const t = red().t;
    for (const [x, y, m] of plan.piezas) {
      const k = kOf(x, y), pz = { p: m.p, d: m.d, n: m.n, i: [] };
      if (m.p === 'k') pz.j = [];
      if (m.f) pz.f = m.f;
      if (m.f2) pz.f2 = m.f2;
      if (m.hasta) { pz.hasta = kOf(m.hasta[0], m.hasta[1]); pz.lp = m.lp; }
      if (m.desde) pz.desde = kOf(m.desde[0], m.desde[1]);
      t[k] = pz;
      marcar(k, pz);
    }
    cambio();
    if (PK.Sfx) PK.Sfx.play('build');
    G().stat('belts', 1);
    return plan.piezas.length;
  };

  // ---------- Mejorar, girar, quitar ----------
  Ci.subir = function (ks, n) {
    const t = red().t, lista = ks.filter(k => t[k] && t[k].n < n);
    if (!lista.length) return 0;
    if (n > Ci.maxNivel()) { toast('El nivel ' + U.roman(n) + ' se habilita en la Era ' + U.roman(NIV(n).era) + '.', 'warn'); return 0; }
    const c = {};
    for (const k of lista) suma(c, Ci.costoSubir(t[k].n, n));
    if (!G().pay(c)) { toast('Faltan recursos para mejorar ' + (lista.length === 1 ? 'esa pieza' : 'esas ' + lista.length + ' piezas') + '.', 'warn'); return 0; }
    for (const k of lista) { t[k].n = n; marcar(k, t[k]); }
    cambio();
    if (PK.Sfx) PK.Sfx.play('build');
    return lista.length;
  };
  Ci.costoSubirLista = function (ks, n) {
    const t = red().t, c = {};
    for (const k of ks) if (t[k] && t[k].n < n) suma(c, Ci.costoSubir(t[k].n, n));
    return c;
  };
  // El tramo de una pieza: todas las piezas unidas antes y después (hasta un edificio, un final o un cruce de través)
  Ci.tramo = function (k) {
    rearmarSiHace();
    const cs = porK.get(k);
    if (!cs) return [];
    // de pieza en pieza hacia adelante y hacia atrás; los unidores, divisores y clasificadores cortan el tramo
    const out = new Set([k]), cola = [cs[0]], vistos = new Set([cs[0]]);
    while (cola.length && out.size < 3000) {
      const c = cola.shift();
      if (NODO[c.pz.p] && c !== cs[0]) continue;
      for (const v of c.outs.filter(o => o.c).map(o => o.c).concat(c.ent.map(e => e.c))) {
        if (vistos.has(v)) continue;
        vistos.add(v); out.add(v.k);
        if (!NODO[v.pz.p]) cola.push(v);
      }
    }
    return [...out];
  };
  Ci.girar = function (k) {
    const pz = red().t[k];
    if (!pz || pz.p === 'e' || pz.p === 'x') return false;
    devolverItems(pz);
    pz.d = (pz.d + 1) % 4;
    cambio();
    return true;
  };
  function devolverItems(pz) { // la carga nunca se pierde: vuelve al pueblo
    for (const arr of [pz.i, pz.j]) if (arr) for (const it of arr) S().res[it[0]] = (S().res[it[0]] || 0) + cantDe(it);
    pz.i = []; if (pz.j) pz.j = [];
  }
  Ci.quitar = function (k, sinDevolver) {
    const t = red().t, pz = t[k];
    if (!pz) return false;
    const otros = pz.p === 'e' ? [pz.hasta] : pz.p === 'x' ? [pz.desde] : [];
    for (const kk of [k].concat(otros)) {
      const q = t[kk];
      if (!q) continue;
      devolverItems(q);
      if (!sinDevolver) G().give(costoPieza(q), 0.5);
      delete t[kk];
      marcar(kk, null);
    }
    cambio();
    return true;
  };
  Ci.quitables = (x0, y0, x1, y1) => {
    const out = [];
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (Ci.piezaEn(x, y)) out.push([x, y]);
    return out;
  };
  // Si una casilla deja de ser tuya, la pieza se quita (como hoy: sin devolver; lo de encima vuelve al pueblo)
  Ci.onTerritory = function () {
    const st = S();
    if (!st || !st.logi || !st.logi.red) return;
    for (const ks in red().t) { const [x, y] = xyOf(+ks); if (W.ownerAt(x, y) !== 'p') Ci.quitar(+ks, true); }
  };
  // Lo que va arriba de las cintas (para la foto del servidor, como lo de los carromatos)
  Ci.enCinta = function (r) {
    const st = S();
    if (!st || !st.logi || !st.logi.red) return 0;
    let n = 0;
    for (const ks in red().t) { const pz = red().t[ks]; for (const arr of [pz.i, pz.j]) if (arr) for (const it of arr) if (it[0] === r) n += cantDe(it); }
    return n;
  };
  // ¿Le llega algo a este taller por cinta?
  Ci.alimenta = function (b) {
    rearmarSiHace();
    return carriles.some(c => c.outs.some(o => o.b === b));
  };
  // pk-75: una boca se lleva lo que hace este taller (el reparto directo a la bodega cercana le deja un paquete)
  // (memo por armado: L.direct lo pregunta en cada cuadro por cada taller junto a una bodega)
  let sacaMemo = new Map(), sacaArm = -1;
  Ci.sacaDe = function (b) {
    rearmarSiHace();
    if (sacaArm !== armado) { sacaArm = armado; sacaMemo = new Map(); }
    let v = sacaMemo.get(b.id);
    if (v === undefined) {
      const out = L().output(b);
      sacaMemo.set(b.id, (v = carriles.some(c => c.src === b && aceptaAbajo(c).has(out))));
    }
    return v;
  };
  Ci.bocasDe = function (b) {
    rearmarSiHace();
    return { entran: carriles.filter(c => c.outs.some(o => o.b === b)), salen: carriles.filter(c => c.src === b) };
  };
  // C2: convertir una pieza en cinta, unidor, divisor o clasificador (paga la pieza nueva; vuelve la mitad de la vieja)
  // Qué puede llegar a una pieza: lo que va encima de ella y de las de antes, y lo que sacan las bocas de más atrás
  // (para que el panel del clasificador ofrezca primero lo que de verdad pasa por ahí).
  Ci.llegan = function (k) {
    rearmarSiHace();
    const vistos = new Set(), pila = (porK.get(k) || []).slice(), out = new Set();
    while (pila.length) {
      const c = pila.pop();
      if (vistos.has(c)) continue;
      vistos.add(c);
      for (const [r] of itemsDe(c) || []) out.add(r);
      if (c.src) for (const r of opcionesFuente(c)) out.add(r);
      for (const o of c.ent) pila.push(o.c);
    }
    return [...out];
  };
  Ci.convertir = function (k, p) {
    const pz = red().t[k];
    if (!pz || !(pz.p === 'c' || NODO[pz.p]) || pz.p === p) return false;
    const c = D.CINTA.nodos[p] || {};
    if (!G().pay(c)) { toast('Faltan recursos para el ' + (D.CINTA.nodoNombre[p] || 'cambio').toLowerCase() + '.', 'warn'); return false; }
    if (D.CINTA.nodos[pz.p]) G().give(D.CINTA.nodos[pz.p], 0.5);
    pz.p = p;
    if (p !== 's') delete pz.f2;
    cambio();
    if (PK.Sfx) PK.Sfx.play('build');
    return true;
  };
  Ci.ponerFiltro = function (k, d, v) {
    const pz = red().t[k];
    if (!pz || pz.p !== 's') return;
    pz.f2 = pz.f2 || {};
    pz.f2[d] = v;
    cambio();
  };
  // Por qué no rinde más: el carril más lento de la cadena (de la boca de salida a la de entrada) o un atasco.
  Ci.diagnostico = function (k) {
    rearmarSiHace();
    const cs = porK.get(k);
    if (!cs) return null;
    const atras = new Map();
    for (const x of carriles) if (x.sig) atras.set(x.sig, x);
    const out = [];
    for (const c of cs) {
      let ini = c;
      for (let i = 0; atras.get(ini) && i < 3000; i++) ini = atras.get(ini);
      let min = null, fin = ini, dist = 0, pasoMin = 0;
      for (let x = ini, i = 0; x && i < 3000; x = x.sig, i++) {
        if (!min || NIV(x.pz.n).rate < NIV(min.pz.n).rate) { min = x; pasoMin = i; }
        fin = x;
        if (x === c) dist = i;
      }
      out.push({ c, ini, fin, min, dentro: pasoMin - dist, atasco: fin.motivo || (c.motivo && c.motivo !== 'La cinta no llega a ningún lado' ? c.motivo : null) });
    }
    return out;
  };

  // ---------- Partidas viejas: las cintas de antes pasan a piezas de nivel III (decisión 4) ----------
  Ci.init = function (st) {
    W.belt.fill(-1);
    if (!st.logi.red) st.logi.red = { v: 1, t: {} };
    const t = st.logi.red.t;
    if (st.logi.belts && st.logi.belts.length) {
      const g = G();
      for (const bl of st.logi.belts) {
        const a = g.bById.get(bl.a), b = g.bById.get(bl.b), p = bl.path || [];
        for (let i = 0; i < p.length; i++) {
          const k = kOf(p[i][0], p[i][1]);
          if (t[k]) continue;
          const d = i < p.length - 1 ? dirDe(p[i], p[i + 1]) : b ? haciaEdificio(p[i], b) : 0;
          t[k] = { p: 'c', d, n: 3, i: [] };
          if (i === 0 && a && !L().isShop(a) && L().isStore(a)) t[k].f = bl.res ? [bl.res] : b && L().isShop(b) ? Object.keys(L().recipe(b).in) : [];
        }
        for (const it of bl.items || []) { // lo que iba encima sigue en su lugar
          const i = Math.min(p.length - 1, Math.floor(it.p)), k = p[i] && kOf(p[i][0], p[i][1]);
          if (t[k]) t[k].i.push([it.r, Math.min(0.99, it.p - i)]);
        }
      }
      for (const ks in t) t[ks].i.sort((x, y) => y[1] - x[1]);
      st.logi.belts = [];
      st.logi.avisoCintas = 1;
    }
    for (const ks in t) marcar(+ks, t[ks]);
    cambio();
  };

  // ---------- Dibujo ----------
  // Llamado desde render.js (capa del suelo): piezas, rampas, ítems. El tablero del paso elevado va en la lista
  // ordenada (Ci.elevados) para que lo que pasa por debajo quede debajo.
  // pk-60 (C3): lo que no cambia entre cuadros se arma una vez por rearmar: posición en pantalla, qué sprite (por
  // fase de la animación) y, por carril, los tres puntos por donde pasan sus ítems. Con 1.000 piezas de nivel V el
  // dibujo bajaba los cuadros a la mitad en un celular: armaba la clave del sprite y arreglos nuevos por pieza e ítem.
  let dib = [], dibArmado = -1, bocasL = [];
  function armarDib(R, Sp) {
    dibArmado = armado; dib = []; bocasL = [];
    const t = red().t;
    for (const ks in t) {
      const k = +ks, pz = t[ks], [x, y] = xyOf(k), [px, py] = R.iso(x, y), cs = porK.get(k) || [];
      let elegir;
      if (pz.p === 'k') elegir = f => Sp.beltCruce(pz.d % 2, f, pz.n);
      else if (NODO[pz.p]) { // C2: bandas hacia cada lado conectado
        const c = cs[0];
        let mask = 1 << pz.d;
        if (c) { for (const o of c.outs) mask |= 1 << o.d; for (const e of c.ent) mask |= 1 << OPP(e.d); if (c.src) mask |= 1 << OPP(c.inD); }
        elegir = f => Sp.beltNodo(pz.p, mask, pz.d, f, pz.n);
      } else if (pz.p === 'e' || pz.p === 'x') elegir = f => Sp.beltRampa(Ci.NOM_DIR[pz.d], pz.p === 'e', f, pz.n);
      else {
        const c = cs[0], inD = c && c.inD !== undefined ? c.inD : pz.d;
        elegir = f => Sp.belt(Ci.NOM_DIR[OPP(inD)], Ci.NOM_DIR[pz.d], f, pz.n);
      }
      dib.push({ k, x, y, px, py, cs, elegir, spr: [null, null, null, null] });
    }
    for (const c of carriles) {
      const [x, y] = xyOf(c.k), d = c.d < 0 ? 0 : c.d, inD = c.inD !== undefined ? c.inD : d;
      c.pts = [x + 0.5 - DIRS[inD][0] * 0.5, y + 0.5 - DIRS[inD][1] * 0.5, x + 0.5, y + 0.5, x + 0.5 + DIRS[d][0] * 0.5, y + 0.5 + DIRS[d][1] * 0.5];
      const [px, py] = R.iso(x, y);
      c.px = px; c.py = py;
      // pk-67: las bocas (tolva donde entrega, compuerta donde saca), con la profundidad para ordenarlas con el edificio
      const boca = (b, bd, ent) => {
        const atras = bd >= 2; // el edificio queda detrás de la cinta: la boca va delante de su pared
        bocasL.push({ k: c.k, x, y, b, bd, ent, n: c.pz.n, px, py, d: atras ? Math.max(x + y + 0.55, b.x + b.y + (b.w + b.h) / 2 + 0.02) : x + y + 0.4 });
      };
      for (const o of c.outs) if (o.b) boca(o.b, o.d, true);
      if (c.src) boca(c.src, OPP(c.inD), false);
    }
  }
  // pk-67: las bocas, como ítems del dibujo ordenado por profundidad
  Ci.bocas = function (R, Sp, seen) {
    const st = S(), out = [];
    if (!st || !st.logi || !st.logi.red) return out;
    rearmarSiHace();
    if (dibArmado !== armado) armarDib(R, Sp);
    for (const e of bocasL) {
      if (!seen(e.x, e.y)) continue;
      const spr = Sp.beltBoca(e.bd, e.ent, e.n);
      out.push({ d: e.d, k: 'puente', o: { k: e.k }, spr, x: Math.round(e.px - spr.ox), y: Math.round(e.py - spr.oy) });
    }
    return out;
  };
  Ci.dibujar = function (ctx, vis, R, Sp) {
    const st = S();
    if (!st || !st.logi || !st.logi.red) return;
    rearmarSiHace();
    if (dibArmado !== armado) armarDib(R, Sp);
    const ahora = performance.now(), fase = Math.floor(ahora / 110) % 4, parpadeo = Math.floor(ahora / 400) % 2;
    for (const e of dib) {
      if (!vis(e.px - 16, e.py, 32, 16) || !W.fog[e.k]) continue;
      const spr = e.spr[fase] || (e.spr[fase] = e.elegir(fase));
      ctx.drawImage(spr.c, e.px - 16, e.py - (spr.oy || 0));
      if (parpadeo && e.cs.some(c => c.atasco)) { ctx.fillStyle = 'rgba(230,60,40,0.45)'; diamante(ctx, R, e.x, e.y); }
      if (Ci.verFlujo) { ctx.fillStyle = colorFlujo(e.cs); diamante(ctx, R, e.x, e.y); } // C2: «Ver flujo»
    }
    // ítems: de la entrada al centro y del centro a la salida (así doblan en las curvas); se descarta el carril entero
    // si su casilla no se ve, y no se crean arreglos por ítem
    const off = W.H * 16;
    let nI = 0;
    for (const c of carriles) {
      const it = itemsDe(c);
      if (!it || !it.length || c.pz.p === 'e' || !c.pts) continue;
      if (!vis(c.px - 20, c.py - 16, 40, 34) || !W.fog[c.k]) continue;
      const p = c.pts, alto = c.pz.p === 'x';
      for (let i = 0; i < it.length; i++) {
        const q = it[i][1], f = q < 0 ? 0 : q > 1 ? 1 : q;
        let tx, ty;
        if (f < 0.5) { tx = p[0] + (p[2] - p[0]) * f * 2; ty = p[1] + (p[3] - p[1]) * f * 2; }
        else { tx = p[2] + (p[4] - p[2]) * (f - 0.5) * 2; ty = p[3] + (p[5] - p[3]) * (f - 0.5) * 2; }
        const px = (tx - ty) * 16 + off, py = (tx + ty) * 8; // lo mismo que R.iso, sin crear un arreglo
        if (nI >= bufX.length) { const nx = new Float32Array(bufX.length * 2), ny = new Float32Array(bufX.length * 2); nx.set(bufX); ny.set(bufY); bufX = nx; bufY = ny; }
        bufX[nI] = Math.round(px); bufY[nI] = Math.round(py - (alto ? Math.max(0, 1 - q * 2) * D.CINTA.alto : 0)); bufR[nI] = it[i][0]; nI++;
      }
    }
    // todos los ítems en dos pasadas (el fondo oscuro y un trazo por recurso): con miles de ítems, dos fillRect y dos
    // fillStyle por ítem eran casi la mitad del dibujo de la red
    if (!nI) return;
    ctx.fillStyle = 'rgba(20,14,10,0.9)'; ctx.beginPath();
    for (let i = 0; i < nI; i++) ctx.rect(bufX[i] - 3, bufY[i] - 5, 6, 5);
    ctx.fill();
    const grupos = new Map();
    for (let i = 0; i < nI; i++) { const g = grupos.get(bufR[i]); if (g) g.push(i); else grupos.set(bufR[i], [i]); }
    for (const [r, idx] of grupos) {
      ctx.fillStyle = COL[r] || (COL[r] = Sp.rgb(Sp.CARRY[r] || [200, 200, 200])); ctx.beginPath();
      for (const i of idx) ctx.rect(bufX[i] - 2, bufY[i] - 4, 4, 3);
      ctx.fill();
    }
    bufR.length = 0;
  };
  let bufX = new Float32Array(256), bufY = new Float32Array(256);
  const bufR = [];
  // «Ver flujo» (C2): gris vacía, verde corre con lugar, amarillo a tope (llena porque adelante se llevan menos, o casi al
  // máximo de su nivel: es normal), rojo solo lo que hay que arreglar: atascada o frenada por una pieza de menos nivel.
  Ci.verFlujo = false;
  function estado(c) {
    const it = itemsDe(c) || [], cap = NIV(c.pz.n).rate * 60 * PILA() * K(), lleno = it.length >= Math.floor(c.len / JUNTOS) && it.length > 1;
    if (c.atasco || (lleno && c.sig && c.sig.pz.n < c.pz.n)) return 3;
    if (lleno || (c.pz.pm || 0) >= cap * 0.8) return 2;
    return (c.pz.pm || 0) > 0 || it.length ? 1 : 0;
  }
  Ci.estadoFlujo = cs => cs.reduce((p, c) => Math.max(p, estado(c)), 0);
  function colorFlujo(cs) { return ['rgba(150,150,150,0.35)', 'rgba(80,200,90,0.45)', 'rgba(240,200,60,0.55)', 'rgba(230,60,40,0.55)'][Ci.estadoFlujo(cs)]; }
  function diamante(ctx, R, x, y) {
    const a = R.iso(x, y), b = R.iso(x + 1, y), c = R.iso(x + 1, y + 1), d = R.iso(x, y + 1);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
  }
  const COL = {};
  function item(ctx, Sp, r, px, py) {
    const col = COL[r] || (COL[r] = Sp.rgb(Sp.CARRY[r] || [200, 200, 200])), x = Math.round(px), y = Math.round(py);
    ctx.fillStyle = 'rgba(20,14,10,0.9)'; ctx.fillRect(x - 3, y - 5, 6, 5);
    ctx.fillStyle = col; ctx.fillRect(x - 2, y - 4, 4, 3);
  }
  // El tablero de los pasos elevados, como ítems ordenados por profundidad (con lo que viaja arriba).
  Ci.elevados = function (R, Sp, seen) {
    const st = S(), out = [];
    if (!st || !st.logi || !st.logi.red) return out;
    rearmarSiHace();
    for (const c of carriles) {
      if (c.pz.p !== 'e') continue;
      const [x0, y0] = xyOf(c.k), d = c.pz.d, n = c.pz.lp || 2;
      for (let i = 1; i < n; i++) {
        const x = x0 + DIRS[d][0] * i, y = y0 + DIRS[d][1] * i;
        if (!seen(x, y)) continue;
        const spr = Sp.beltPuente(d % 2, c.pz.n), [px, py] = R.iso(x, y);
        const lo = i - 0.5, hi = i === n - 1 ? n + 1 : i + 0.5, its = itemsDe(c).filter(([, q]) => q >= lo && q < hi);
        out.push({ d: x + y + 0.9, k: 'puente', o: { k: c.k }, spr, x: Math.round(px - 16), y: Math.round(py - D.CINTA.alto), after: ctx2 => {
          for (const [r, q] of its) { const tx = x0 + 0.5 + DIRS[d][0] * q, ty = y0 + 0.5 + DIRS[d][1] * q, [ix, iy] = R.iso(tx, ty); item(ctx2, Sp, r, ix, iy - D.CINTA.alto); }
        } });
      }
      // lo que sube por la rampa de entrada
      const [px0, py0] = R.iso(x0, y0);
      if (seen(x0, y0)) out.push({ d: x0 + y0 + 0.9, k: 'puente', o: { k: c.k }, spr: { c: vacio() }, x: px0, y: py0, after: ctx2 => {
        for (const [r, q] of itemsDe(c)) { if (q >= 0.5) continue; const [ix, iy] = R.iso(x0 + 0.5 + DIRS[d][0] * q, y0 + 0.5 + DIRS[d][1] * q); item(ctx2, Sp, r, ix, iy - Math.max(0, q) * 2 * D.CINTA.alto); }
      } });
    }
    return out;
  };
  let vacioC = null;
  function vacio() { if (!vacioC) { vacioC = document.createElement('canvas'); vacioC.width = vacioC.height = 1; } return vacioC; }
})();
