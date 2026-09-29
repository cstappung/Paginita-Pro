/* Clue - los bots (los rivales de la práctica).

   Un bot es una cabeza que deduce y un par de reglas para moverse. Solo
   ve lo que ve un jugador de verdad: su mano, lo que le enseñaron
   (`vistas`) y el estado público que devuelve `reducir` (quién pasó y
   quién refutó cada sugerencia, sin la carta). Nunca mira la mesa.

   La deducción es una matriz de dueños posibles por carta: cada carta
   tiene un conjunto de candidatos entre los jugadores y el sobre (un
   bit por dueño). Cada hecho la recorta, y se propaga hasta que nada
   cambia:
   - la mano propia y las cartas que le enseñaron;
   - «no tengo» de quien pasó (no tiene ninguna de las tres);
   - «tengo una de estas tres» de quien refutó sin enseñárselo a él;
   - los tamaños de mano (las 18 cartas se reparten a la redonda);
   - un solo sospechoso, un arma y un lugar en el sobre;
   - cada acusación fallida (esas tres no son el sobre).
   Además, al nivel normal, prueba cada posibilidad restante por
   suposición: si suponerla lleva a una contradicción, se descarta. Eso
   cierra los casos que la propagación sola no ve.

   UMD, como `motor.js`: en Node lee el motor con `require`, en el
   navegador de `globalThis.ClueMotor`. */
(function (raiz, fabrica) {
  const M = typeof module === "object" && module.exports ? require("./motor.js") : raiz.ClueMotor;
  const B = fabrica(M);
  if (typeof module === "object" && module.exports) module.exports = B;
  else raiz.ClueBots = B;
})(typeof globalThis !== "undefined" ? globalThis : this, function (M) {
  "use strict";

  const NS = M.NS, NA = M.NA, NL = M.NL, NC = M.NC;
  const RANGOS = [[0, NS], [NS, NS + NA], [NS + NA, NC]];   // sospechosos, armas, lugares
  const bits = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
  const azar = a => a[Math.floor(Math.random() * a.length)];

  /* Distancia (en casillas de pasillo) de cada casilla a las puertas de
     una sala, sin contar fichas: sirve para acercarse cuando no se llega. */
  const distPuertas = new Map();
  function distanciasA(l) {
    if (distPuertas.has(l)) return distPuertas.get(l);
    const d = new Map(), cola = [];
    for (const p of M.PUERTAS_DE[l]) { d.set(p, 0); cola.push(p); }
    for (let i = 0; i < cola.length; i++) {
      const p = cola[i];
      for (const q of M.vecinos(p)) {
        if (!M.esPasillo(q) || d.has(q)) continue;
        d.set(q, d.get(p) + 1); cola.push(q);
      }
    }
    distPuertas.set(l, d);
    return d;
  }

  /* `mm`: máscara de dueños posibles por carta. Devuelve false si los
     hechos se contradicen. `ctx`: {n, E, tam, cons, acc}. Modifica `mm`. */
  function propaga(mm, ctx) {
    const { n, E, tam, cons, acc } = ctx;
    let cambio = true;
    const fija = (c, v) => { if (mm[c] !== v) { mm[c] = v; cambio = true; } };
    const quita = (c, b) => { if (mm[c] & b) { mm[c] &= ~b; cambio = true; } };
    while (cambio) {
      cambio = false;
      for (let c = 0; c < NC; c++) if (!mm[c]) return false;
      /* Cada jugador: si ya tiene todas las suyas no hay más, y si solo
         le caben exactamente las que faltan, son suyas. */
      for (let p = 0; p < n; p++) {
        if (tam[p] === null) continue;
        const b = 1 << p;
        let seguras = 0, posibles = 0;
        for (let c = 0; c < NC; c++) { if (mm[c] === b) seguras++; if (mm[c] & b) posibles++; }
        if (seguras > tam[p] || posibles < tam[p]) return false;
        if (seguras === tam[p]) { for (let c = 0; c < NC; c++) if (mm[c] !== b) quita(c, b); }
        else if (posibles === tam[p]) { for (let c = 0; c < NC; c++) if (mm[c] & b) fija(c, b); }
      }
      /* El sobre: uno de cada tipo. */
      for (const [a, z] of RANGOS) {
        let cand = 0, ultimo = -1, seguras = 0;
        for (let c = a; c < z; c++) { if (mm[c] & E) { cand++; ultimo = c; } if (mm[c] === E) seguras++; }
        if (!cand || seguras > 1) return false;
        if (cand === 1) fija(ultimo, E);
        if (seguras === 1) for (let c = a; c < z; c++) if (mm[c] !== E) quita(c, E);
      }
      for (const k of cons) {
        let cuantas = 0, ultima = -1;
        for (const c of k.cartas) if (mm[c] & k.b) { cuantas++; ultima = c; }
        if (!cuantas) return false;
        if (cuantas === 1) fija(ultima, k.b);
      }
      for (const t of acc) {
        const seguras = t.filter(c => mm[c] === E);
        if (seguras.length === 3) return false;
        if (seguras.length === 2) for (const c of t) if (mm[c] !== E) quita(c, E);
      }
    }
    for (let c = 0; c < NC; c++) if (!mm[c]) return false;
    return true;
  }

  /* Por suposición: para cada dueño posible de cada carta, suponerlo y
     propagar; si revienta, ese dueño no es. Repite hasta que no cae más. */
  function profundiza(mm, ctx) {
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (let c = 0; c < NC; c++) {
        if (bits(mm[c]) < 2) continue;
        for (let p = 0; p <= ctx.n; p++) {
          const b = 1 << p;
          if (!(mm[c] & b) || bits(mm[c]) < 2) continue;
          const prueba = mm.slice();
          prueba[c] = b;
          if (!propaga(prueba, ctx)) {
            mm[c] &= ~b;
            if (!propaga(mm, ctx)) return false;
            cambio = true;
          }
        }
      }
    }
    return true;
  }

  function crear(op) {
    op = op || {};
    const uid = op.uid;
    const uids = (op.jugadores || []).slice();
    if (!uids.includes(uid)) uids.push(uid);
    const n = uids.length, yo = uids.indexOf(uid);
    const facil = op.nivel === "facil";
    const E = 1 << n, TODO = (1 << (n + 1)) - 1;
    const mano = (op.mano || []).slice();
    const idx = u => uids.indexOf(u);

    /* Lo que se sabe solo por la mano: la base sobre la que se rehace todo. */
    const base = new Array(NC).fill(TODO);
    for (let c = 0; c < NC; c++) base[c] = mano.includes(c) ? 1 << yo : TODO & ~(1 << yo);
    let m = base.slice();
    let firma = "";
    const mostradas = {};                       // uid -> Set de cartas que ya le enseñé

    function tamanos(est) {
      const mesa = est.cr && est.cr.mesa && est.cr.mesa.length ? est.cr.mesa : (est.jugadores || []).map(j => j.uid);
      const k = mesa.length, t = uids.map(() => 0);
      for (let j = 0; j < NC - 3; j++) { const i = idx(mesa[j % k]); if (i >= 0) t[i]++; }
      /* Si no cuadra ni con la mano propia, más vale no fiarse de esto. */
      if (!mesa.includes(uid) || t[yo] !== mano.length) return uids.map(() => null);
      return t;
    }

    function observa(est, vistas) {
      vistas = vistas || {};
      const sugs = est.sugerencias || [], accs = est.acusaciones || [];
      let f = sugs.length + "|" + accs.length + "|" + Object.keys(vistas).length;
      for (const s of sugs) f += "," + s.pasaron.length + (s.mostro ? "m" : "");
      if (f === firma) return;
      const ctx = { n, E, tam: tamanos(est), cons: [], acc: [] };
      const mm = base.slice();
      for (const s of sugs) {
        const cartas = [M.cartaS(s.s), M.cartaA(s.a), M.cartaL(s.l)];
        for (const u of s.pasaron) {
          const i = idx(u);
          if (i >= 0) for (const c of cartas) mm[c] &= ~(1 << i);
        }
        const i = idx(s.mostro);
        if (!s.mostro || i < 0 || i === yo) continue;
        const vista = vistas[s.k];
        if (Number.isInteger(vista) && cartas.includes(vista)) mm[vista] = 1 << i;
        else ctx.cons.push({ b: 1 << i, cartas });
      }
      for (const a of accs) if (!a.ok) ctx.acc.push([M.cartaS(a.s), M.cartaA(a.a), M.cartaL(a.l)]);
      if (!propaga(mm, ctx)) return;            // hechos incoherentes: se queda con lo anterior
      firma = f;
      if (!facil) {
        const copia = mm.slice();
        if (profundiza(copia, ctx)) mm.splice(0, NC, ...copia);
      }
      m = mm;
    }

    /* Cartas de un tipo que aún pueden estar en el sobre. */
    const candidatas = t => { const [a, z] = RANGOS[t], r = []; for (let c = a; c < z; c++) if (m[c] & E) r.push(c); return r; };
    const sobreSeguro = () => {
      const c = [0, 1, 2].map(candidatas);
      return c.every(x => x.length === 1) ? c.map(x => x[0]) : null;
    };

    const vecesPedida = (est, c) => {
      let v = 0;
      for (const s of est.sugerencias || []) {
        if (s.uid === uid && (M.cartaS(s.s) === c || M.cartaA(s.a) === c || M.cartaL(s.l) === c)) v++;
      }
      return v;
    };
    const visitas = (est, l) => (est.sugerencias || []).filter(s => s.uid === uid && s.l === l).length;

    /* Qué carta de ese tipo nombrar al sugerir. */
    function elegirCarta(est, t) {
      const [a, z] = RANGOS[t];
      const todas = Array.from({ length: z - a }, (_, i) => a + i);
      if (facil && Math.random() < 0.6) return azar(todas);
      const cand = candidatas(t);
      if (!cand.length) return azar(todas);
      if (cand.length === 1) {
        /* Ya resuelto: nombrar una carta mía no delata nada y solo
           enseña lo que hay en las otras dos. */
        const mias = todas.filter(c => mano.includes(c));
        return mias.length ? azar(mias) : cand[0];
      }
      let mejor = [], top = null;
      for (const c of cand) {
        const clave = [-vecesPedida(est, c), bits(m[c])];
        if (!top || clave[0] > top[0] || (clave[0] === top[0] && clave[1] > top[1])) { top = clave; mejor = [c]; }
        else if (clave[0] === top[0] && clave[1] === top[1]) mejor.push(c);
      }
      return azar(mejor);
    }

    /* Cuánto vale sugerir desde una sala. */
    function valorSala(est, l) {
      const mk = m[NS + NA + l];
      const varias = candidatas(2).length > 1;
      let v;
      if (mk & E) v = 3;
      else if (mk === 1 << yo) v = 1 + (candidatas(0).length > 1 ? 0.3 : 0) + (candidatas(1).length > 1 ? 0.3 : 0);
      else v = 0.5;
      if (varias) v /= 1 + 0.35 * visitas(est, l);
      return facil ? v * (0.4 + Math.random() * 1.2) : v;
    }

    function decide(est, vistas) {
      const paso = est.paso;
      observa(est, vistas);
      const f = est.jugadores.findIndex(j => j.uid === uid);
      if (paso !== "inicio" && paso !== "accion" && paso !== "tras") return { t: "pasa" };

      const sobre = sobreSeguro();
      if (sobre) return { t: "acusa", s: sobre[0], a: sobre[1] - NS, l: sobre[2] - NS - NA };
      if (facil && Math.random() < 0.5) {
        const c = [0, 1, 2].map(candidatas);
        if (c[0].length * c[1].length * c[2].length <= 2) {
          const [s, a, l] = c.map(azar);
          return { t: "acusa", s, a: a - NS, l: l - NS - NA };
        }
      }
      if (paso === "tras") return { t: "pasa" };

      const sugiere = () => ({ t: "sugiere", s: elegirCarta(est, 0), a: elegirCarta(est, 1) - NS });
      if (paso === "accion") return est.puedeSugerir ? sugiere() : { t: "pasa" };

      /* paso "inicio": moverse (o sugerir si ya lo trajeron a una sala buena). */
      const dado = est.dados ? est.dados[0] + est.dados[1] : 0;
      const donde = est.fichas[f];
      const lejos = M.alcance(est.fichas, f, 300);
      const opciones = [];
      for (const [l, inf] of lejos.salas) {
        const turnos = inf.d <= dado ? 1 : 1 + Math.ceil((inf.d - dado) / 7);
        opciones.push({ l, d: inf.d, puntos: valorSala(est, l) / turnos });
      }
      const q = M.enSala(donde) ? M.pasadizoDe(M.salaDe(donde)) : null;
      if (q) opciones.push({ l: q.a, d: 0, pas: true, puntos: valorSala(est, q.a) * 1.05 });
      opciones.sort((x, y) => y.puntos - x.puntos || x.d - y.d);

      if (est.puedeSugerir) {
        const aqui = valorSala(est, M.salaDe(donde));
        if (!opciones.length || aqui >= opciones[0].puntos) return sugiere();
      }
      let ir = opciones[0];
      if (facil && Math.random() < 0.2) {
        const alcanzables = opciones.filter(o => o.pas || o.d <= dado);
        if (alcanzables.length) ir = azar(alcanzables);
      }
      if (ir && ir.pas) return { t: "mueve", a: M.SALA + ir.l, v: "pasadizo" };
      if (ir && ir.d <= dado) return { t: "mueve", a: M.SALA + ir.l, v: "dado" };
      const cerca = M.alcance(est.fichas, f, dado);
      if (ir && cerca.casillas.size) {
        const d = distanciasA(ir.l);
        let mejor = [], top = Infinity;
        for (const p of cerca.casillas.keys()) {
          const x = d.has(p) ? d.get(p) : 9999;
          if (x < top) { top = x; mejor = [p]; } else if (x === top) mejor.push(p);
        }
        if (mejor.length) return { t: "mueve", a: azar(mejor), v: "dado" };
      }
      const alguna = opciones.find(o => o.pas || o.d <= dado);
      if (alguna) return alguna.pas ? { t: "mueve", a: M.SALA + alguna.l, v: "pasadizo" } : { t: "mueve", a: M.SALA + alguna.l, v: "dado" };
      return { t: "pasa" };
    }

    /* Qué carta enseñar: una que ya le haya enseñado a ese mismo jugador
       (así no le cuenta nada nuevo); si no, la que más gente ya ha visto. */
    function refuta(sug) {
      const pedidas = [M.cartaS(sug.s), M.cartaA(sug.a), M.cartaL(sug.l)];
      const mias = pedidas.filter(c => mano.includes(c));
      if (!mias.length) return null;
      const a = mostradas[sug.uid] || (mostradas[sug.uid] = new Set());
      const ya = mias.filter(c => a.has(c));
      let c;
      if (ya.length) c = ya[0];
      else if (facil) c = azar(mias);
      else {
        const vistaPor = x => Object.values(mostradas).filter(s => s.has(x)).length;
        const top = Math.max(...mias.map(vistaPor));
        c = azar(mias.filter(x => vistaPor(x) === top));
      }
      a.add(c);
      return c;
    }

    return {
      uid, nivel: facil ? "facil" : "normal",
      observa, decide, refuta,
      /* Para las pruebas y para depurar: lo que cree saber. */
      sabe: () => ({ sobre: sobreSeguro(), dueños: m.slice(), E })
    };
  }

  return { crear };
});
