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
  Ci.DIRS = DIRS;
  Ci.NOM_DIR = ['E', 'S', 'W', 'N'];
  const K = () => 1 + (G().bono ? G().bono('belt') : 0); // Cintas reforzadas (árbol): más rápidas todas

  // ---------- Datos ----------
  const red = () => S().logi.red;
  Ci.pieza = k => (S() && S().logi && S().logi.red ? red().t[k] || null : null);
  Ci.piezaEn = (x, y) => (W.inb(x, y) ? Ci.pieza(W.idx(x, y)) : null);
  const kOf = (x, y) => W.idx(x, y);
  const xyOf = k => [k % W.W, (k / W.W) | 0];
  function marcar(k, pz) { W.belt[k] = pz ? pz.n : -1; }
  Ci.nombre = pz => (pz.p === 'k' ? 'Cruce de cintas' : pz.p === 'e' || pz.p === 'x' ? 'Paso elevado' : NIV(pz.n).name) + ' (nivel ' + U.roman(pz.n) + ')';
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
  // Cada pieza tiene un carril (el cruce, dos). Un carril: { k, pz, l (0 o 1), d, len, sig, src, dst, ent }.
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
  function rearmar() {
    carriles = []; porK = new Map();
    const t = red().t;
    for (const ks in t) {
      const k = +ks, pz = t[ks];
      const c0 = { k, pz, l: 0, d: pz.d, len: pz.p === 'e' ? pz.lp || 2 : 1, sig: null, src: null, dst: null, ent: [], motivo: null };
      const cs = [c0];
      if (pz.p === 'k') cs.push({ k, pz, l: 1, d: -1, len: 1, sig: null, src: null, dst: null, ent: [], motivo: null });
      porK.set(k, cs);
      carriles.push(...cs);
    }
    // a quién apunta cada carril
    const destinos = [];
    for (const c of carriles) {
      if (c.l === 1) continue; // el carril de través del cruce toma su dirección de quien entra
      apuntar(c, destinos);
    }
    // el carril de través del cruce: lo alimenta la cinta que entra por un costado
    for (const [c, tk, d] of destinos) {
      const pz = t[tk];
      if (!pz || pz.p !== 'k') continue;
      if (d % 2 !== pz.d % 2) { const cr = porK.get(tk)[1]; if (cr.d < 0) { cr.d = d; apuntar(cr, destinos); } }
    }
    // resolver entradas: cada carril recibe de uno solo (en C1 no hay unidores)
    for (const [c, tk, d] of destinos) {
      const pz = t[tk], cs = porK.get(tk);
      if (!pz || !cs) continue;
      let dest = null;
      if (pz.p === 'k') dest = d % 2 === pz.d % 2 ? (d === pz.d ? cs[0] : null) : (cs[1].d === d ? cs[1] : null);
      else if (pz.p === 'x') dest = c.pz.p === 'e' && c.k === pz.desde ? cs[0] : null;
      else if (d !== OPP(pz.d)) dest = cs[0];
      if (dest) dest.ent.push({ c, d });
      else c.motivo = 'choca con otra cinta que va en contra';
    }
    for (const c of carriles) {
      if (!c.ent.length) continue;
      // la de atrás manda; si no hay, la primera de un costado (una curva)
      c.ent.sort((a, b) => (a.d === c.pz.d ? 0 : 1) - (b.d === c.pz.d ? 0 : 1));
      const gana = c.ent[0];
      gana.c.sig = c;
      c.inD = gana.d;
      for (const o of c.ent.slice(1)) o.c.motivo = 'llega a una cinta que ya tiene entrada: para unir dos cintas hace falta un unidor';
    }
    // bocas de salida: un carril sin quien lo alimente, nacido junto a un edificio
    for (const c of carriles) {
      if (c.ent.length || c.l === 1 || c.pz.p === 'x' || c.pz.p === 'k') continue;
      const [x, y] = xyOf(c.k), d = c.pz.d;
      const prov = [OPP(d), (d + 1) % 4, (d + 3) % 4];
      for (const pd of prov) {
        const b = edificioEn(x + DIRS[pd][0], y + DIRS[pd][1]);
        if (b && b !== c.dst && esFuente(b)) { c.src = b; c.inD = OPP(pd); break; }
      }
    }
    // orden: de abajo hacia arriba (lo que está más cerca del final primero), sin ciclos
    const prof = new Map();
    const hondo = c => {
      if (prof.has(c)) return prof.get(c);
      prof.set(c, -1); // marca: en curso (un ciclo queda en 0)
      const p = c.sig ? Math.max(0, hondo(c.sig)) + 1 : 0;
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
    if (c.pz.p === 'e') { // salta hasta su salida
      const tk = c.pz.hasta;
      if (tk !== undefined && red().t[tk]) destinos.push([c, tk, d]);
      return;
    }
    const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
    if (!W.inb(nx, ny)) return;
    const nk = kOf(nx, ny);
    const b = edificioEn(nx, ny);
    if (b) { c.dst = b; return; }
    if (red().t[nk]) destinos.push([c, nk, d]);
  }
  const itemsDe = c => (c.l === 1 ? c.pz.j : c.pz.i);
  const esFuente = b => L().isShop(b) || PK.Libro.esCampo(b) || L().esBodegaRuta(b);
  Ci.carriles = () => { rearmarSiHace(); return carriles; };
  Ci.carrilesEn = k => { rearmarSiHace(); return porK.get(k) || []; };

  // ---------- Qué entra y qué sale de cada edificio ----------
  // Lo que puede recibir por cinta: un taller sus insumos; una bodega lo que guarda. Un campamento no recibe nada.
  function recibe(b, r) {
    if (L().isShop(b)) return !!L().recipe(b).in[r];
    return L().esBodegaRuta(b) && L().storeAccepts(b, r);
  }
  Ci.recibe = recibe;
  function entregar(c, r) {
    const b = c.dst, g = G();
    if (!recibe(b, r)) { c.motivo = 'Atascada: llega ' + D.RES[r].name.toLowerCase() + ' y ' + b.def.name + ' no lo usa'; c.atasco = true; return false; }
    if (L().isShop(b)) {
      if (!b.inb) b.inb = {};
      if ((b.inb[r] || 0) + 1 > L().bufCap(b)) { c.motivo = b.def.name + ' está lleno de ' + D.RES[r].name.toLowerCase(); return false; }
      b.inb[r] = (b.inb[r] || 0) + 1;
    } else {
      if ((S().res[r] || 0) >= g.cap(r) || PK.Libro.poner(b, r, 1) < 1) { c.motivo = 'Tus bodegas están llenas de ' + D.RES[r].name.toLowerCase(); return false; }
    }
    c.motivo = null; c.atasco = false;
    g.stat('belted', 1);
    return true;
  }
  // Lo que da una boca de salida, por turnos (pz.rr). null: nada por ahora.
  function sacar(c) {
    const b = c.src, pz = c.pz;
    if (L().isShop(b)) {
      const out = L().output(b);
      if (!b.outb) b.outb = {};
      if ((b.outb[out] || 0) >= 1) { b.outb[out] -= 1; return out; }
      return null;
    }
    const lista = opcionesFuente(c);
    for (let i = 0; i < lista.length; i++) {
      const j = ((pz.rr || 0) + i) % lista.length, r = lista[j];
      if (!disponible(b, r)) continue;
      if (PK.Libro.esCampo(b)) { if (PK.Libro.sacarCampo(b, r, 1) < 1) continue; }
      else if (PK.Libro.sacar(b, r, 1) < 1) continue;
      pz.rr = j + 1;
      return r;
    }
    return null;
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
    return (PK.Libro.inv(b)[r] || 0) >= 1 && (S().res[r] || 0) - 1 >= reserva(r);
  }
  // la reserva de los talleres (como las carretas): una bodega no se vacía por debajo de lo que guarda el Capataz
  function reserva(r) {
    const st = S(), rv = st.auto ? st.auto.reserve || 0 : 0;
    return rv * G().cap(r);
  }

  // ---------- Simulación en vivo ----------
  // Cada pieza acepta un ítem cada 1 / ritmo segundos (c.lib): así una de nivel más bajo deja pasar solo su ritmo y
  // las de atrás se llenan (el cuello de botella sale solo). Los ítems avanzan a la velocidad del nivel y, si se
  // frenan, se juntan a JUNTOS casillas uno de otro.
  const JUNTOS = 0.34;
  const vel = c => NIV(c.pz.n).vel * K();
  const cada = c => 1 / (NIV(c.pz.n).rate * K());
  function hayLugar(c) { const it = itemsDe(c); return (c.lib || 0) <= 0 && (!it.length || it[it.length - 1][1] >= JUNTOS); }
  Ci.update = function (dt) {
    const st = S();
    if (!st || !st.logi || !st.logi.red) return;
    rearmarSiHace();
    for (const c of orden) c.lib = (c.lib || 0) - dt;
    for (const c of orden) avanzar(c, dt);
    if (st.logi.avisoCintas && !G().offline) { // partidas viejas: una vez, qué cambió
      delete st.logi.avisoCintas;
      setTimeout(() => toast('Las cintas ahora se arman pieza por pieza, con niveles, cruces y pasos elevados. Las tuyas quedaron en nivel III (rinden igual). Ojo: las carretas ya no cruzan cintas.', 'epic', { label: 'Logística', fn: () => PK.UI.openLogistics() }), 2500);
    }
  };
  function avanzar(c, dt) {
    const it = itemsDe(c);
    if (!it) return;
    const sp = vel(c) * dt;
    for (let i = 0; i < it.length; i++) it[i][1] = Math.min(it[i][1] + sp, i === 0 ? Infinity : it[i - 1][1] - JUNTOS);
    if (it.length && it[0][1] >= c.len) {
      const f = it[0];
      let sale = false;
      if (c.sig) {
        if (hayLugar(c.sig)) {
          const dest = itemsDe(c.sig), lim = dest.length ? dest[dest.length - 1][1] - JUNTOS : Infinity;
          dest.push([f[0], Math.max(0, Math.min(f[1] - c.len, lim))]);
          c.sig.lib = Math.max(0, c.sig.lib || 0) + cada(c.sig);
          sale = true; c.motivo = null;
        }
      } else if (c.dst) sale = entregar(c, f[0]);
      else if (!c.motivo || c.motivo === 'La cinta no llega a ningún lado') c.motivo = 'La cinta no llega a ningún lado';
      if (sale) { it.shift(); c.pz.flujo = (c.pz.flujo || 0) + 1; }
      else f[1] = c.len;
    }
    for (let i = 1; i < it.length; i++) if (it[i][1] > it[i - 1][1] - JUNTOS) it[i][1] = Math.max(0, it[i - 1][1] - JUNTOS);
    // boca de salida: saca a su ritmo
    if (c.src && hayLugar(c)) { const r = sacar(c); if (r) { it.push([r, 0]); c.lib = Math.max(0, c.lib || 0) + cada(c); } }
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
  // Cada boca de salida manda por su cadena lo que deja pasar el nivel más bajo, si el destino lo recibe. Si por esa
  // boca sale algo que el destino no usa, en vivo se atascaría: sin conexión, también (no mueve nada).
  Ci.offline = function (dt) {
    const st = S();
    if (!st || !st.logi || !st.logi.red) return;
    rearmarSiHace();
    for (const c of carriles) {
      if (!c.src) continue;
      let rate = Infinity, x = c, n = 0;
      const vistos = new Set();
      while (x && !vistos.has(x)) { vistos.add(x); rate = Math.min(rate, NIV(x.pz.n).rate); if (!x.sig) break; x = x.sig; n++; }
      const dst = x && x.dst;
      if (!dst || vistos.size > 2000) continue;
      const b = c.src, opc = opcionesFuente(c).filter(r => disponible(b, r));
      if (!opc.length || opc.some(r => !recibe(dst, r))) continue;
      let presu = rate * K() * dt;
      // por turnos: cada recurso disponible recibe su parte
      for (let pasada = 0; pasada < 3 && presu >= 1; pasada++) {
        const vivos = opc.filter(r => disponible(b, r));
        if (!vivos.length) break;
        const parte = presu / vivos.length;
        let movido = 0;
        for (const r of vivos) {
          let m = Math.floor(parte);
          if (L().isShop(b)) m = Math.min(m, Math.floor(b.outb[r] || 0));
          else if (PK.Libro.esCampo(b)) m = Math.min(m, Math.floor(PK.Libro.inv(b)[r] || 0));
          else m = Math.min(m, Math.floor(Math.min(PK.Libro.inv(b)[r] || 0, (st.res[r] || 0) - reserva(r))));
          if (L().isShop(dst)) m = Math.min(m, Math.floor(L().bufCap(dst) - ((dst.inb && dst.inb[r]) || 0)));
          else m = Math.min(m, Math.floor(G().cap(r) - (st.res[r] || 0)));
          if (m < 1) continue;
          if (L().isShop(b)) b.outb[r] -= m; else if (PK.Libro.esCampo(b)) PK.Libro.sacarCampo(b, r, m); else PK.Libro.sacar(b, r, m);
          if (L().isShop(dst)) { if (!dst.inb) dst.inb = {}; dst.inb[r] = (dst.inb[r] || 0) + m; } else PK.Libro.poner(dst, r, m);
          G().stat('belted', m);
          movido += m;
        }
        presu -= movido;
        if (movido < 1) break;
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
    if (pzI && !bI) { // continuar una cinta: solo desde su final
      const cs = Ci.carrilesEn(kOf(s[0], s[1]));
      if (pzI.p === 'c' && cs[0] && !cs[0].sig && !cs[0].dst) sigue = kOf(s[0], s[1]);
    }
    const pzF = !bF && Ci.piezaEn(e[0], e[1]);
    let mejor = null;
    for (const xPrimero of [true, false]) {
      const p = lineaL(s, e, xPrimero);
      if (pzF && p.length > 1) { const [a, b] = [p[p.length - 2], p[p.length - 1]]; p.pop(); dFin = dirDe(a, b); } // termina apuntando a esa cinta
      const r = evaluar(p, dFin, sigue);
      if (!mejor || r.malas.length < mejor.malas.length) mejor = r;
      if (!r.malas.length) break;
    }
    if (mejor) { mejor.bI = bI; mejor.bF = bF; }
    return mejor;
  };
  function bordeHacia(b, hacia) {
    let best = null, bd = Infinity;
    for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
      const borde = (x === b.x - 1 || x === b.x + b.w) !== (y === b.y - 1 || y === b.y + b.h); // sin esquinas
      if (!borde || !(Ci.libre(x, y) || Ci.piezaEn(x, y))) continue;
      const d = U.dist(x + 0.5, y + 0.5, hacia[0], hacia[1]);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
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
    const out = new Set([k]);
    let c = cs[0];
    const atras = new Map();
    for (const x of carriles) if (x.sig) atras.set(x.sig, x);
    for (let x = c.sig, i = 0; x && i < 3000; x = x.sig, i++) { if (out.has(x.k) && x.l === 0) break; out.add(x.k); }
    for (let x = atras.get(c), i = 0; x && i < 3000; x = atras.get(x), i++) { if (out.has(x.k) && x.l === 0) break; out.add(x.k); }
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
    for (const arr of [pz.i, pz.j]) if (arr) for (const [r] of arr) S().res[r] = (S().res[r] || 0) + 1;
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
    for (const ks in red().t) { const pz = red().t[ks]; for (const arr of [pz.i, pz.j]) if (arr) for (const it of arr) if (it[0] === r) n++; }
    return n;
  };
  // ¿Le llega algo a este taller por cinta?
  Ci.alimenta = function (b) {
    rearmarSiHace();
    return carriles.some(c => c.dst === b);
  };
  Ci.bocasDe = function (b) {
    rearmarSiHace();
    return { entran: carriles.filter(c => c.dst === b), salen: carriles.filter(c => c.src === b) };
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
  Ci.dibujar = function (ctx, vis, R, Sp) {
    const st = S();
    if (!st || !st.logi || !st.logi.red) return;
    rearmarSiHace();
    const fase = Math.floor(performance.now() / 110) % 4, t = red().t;
    for (const ks in t) {
      const k = +ks, pz = t[ks], [x, y] = xyOf(k), [px, py] = R.iso(x, y);
      if (!vis(px - 16, py, 32, 16) || !W.fog[k]) continue;
      const cs = porK.get(k) || [];
      let spr;
      if (pz.p === 'k') spr = Sp.beltCruce(pz.d % 2, fase, pz.n);
      else if (pz.p === 'e' || pz.p === 'x') spr = Sp.beltRampa(Ci.NOM_DIR[pz.d], pz.p === 'e', fase, pz.n);
      else {
        const c = cs[0], inD = c && c.inD !== undefined ? c.inD : pz.d;
        spr = Sp.belt(Ci.NOM_DIR[OPP(inD)], Ci.NOM_DIR[pz.d], fase, pz.n);
      }
      ctx.drawImage(spr.c, px - 16, py - (spr.oy || 0));
      if (cs.some(c => c.atasco) && Math.floor(performance.now() / 400) % 2) { ctx.fillStyle = 'rgba(230,60,40,0.45)'; diamante(ctx, R, x, y); }
    }
    // ítems
    for (const c of carriles) {
      const it = itemsDe(c);
      if (!it || !it.length || c.pz.p === 'e') continue;
      for (const [r, q] of it) {
        const [tx, ty] = posItem(c, q), [px, py] = R.iso(tx, ty);
        if (!vis(px - 4, py - 6, 8, 8)) continue;
        item(ctx, Sp, r, px, py - (c.pz.p === 'x' ? Math.max(0, (1 - q * 2)) * D.CINTA.alto : 0));
      }
    }
  };
  function diamante(ctx, R, x, y) {
    const a = R.iso(x, y), b = R.iso(x + 1, y), c = R.iso(x + 1, y + 1), d = R.iso(x, y + 1);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
  }
  function item(ctx, Sp, r, px, py) {
    const col = Sp.CARRY[r] || [200, 200, 200];
    ctx.fillStyle = 'rgba(20,14,10,0.9)'; ctx.fillRect(Math.round(px) - 3, Math.round(py) - 5, 6, 5);
    ctx.fillStyle = Sp.rgb(col); ctx.fillRect(Math.round(px) - 2, Math.round(py) - 4, 4, 3);
  }
  // posición de un ítem en su pieza: de la entrada al centro y del centro a la salida (así dobla en las curvas)
  function posItem(c, q) {
    const [x, y] = xyOf(c.k), d = c.d < 0 ? 0 : c.d, inD = c.inD !== undefined ? c.inD : d;
    const e = [x + 0.5 - DIRS[inD][0] * 0.5, y + 0.5 - DIRS[inD][1] * 0.5], m = [x + 0.5, y + 0.5], s = [x + 0.5 + DIRS[d][0] * 0.5, y + 0.5 + DIRS[d][1] * 0.5];
    const f = Math.max(0, Math.min(1, q));
    return f < 0.5 ? [e[0] + (m[0] - e[0]) * f * 2, e[1] + (m[1] - e[1]) * f * 2] : [m[0] + (s[0] - m[0]) * (f - 0.5) * 2, m[1] + (s[1] - m[1]) * (f - 0.5) * 2];
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
