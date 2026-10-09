/* El motor de Trigon: el tablero hexagonal de triángulos, las piezas, dónde
   cabe cada una, las líneas que se borran y los puntos, y nada que se
   dibuje. juego.js lo usa para jugar; más adelante el verificador
   antitrampas lo usará para rehacer la partida desde su semilla y sus
   jugadas, igual que el 2048.

   - **La red es de puntos, no de casillas.** Un punto de la red es (x, y)
     en coordenadas axiales: x avanza a la derecha, y a 60° hacia abajo. Cada
     triángulo es (x, y, d): con d = 0 tiene los vértices (x,y) (x+1,y)
     (x,y+1); con d = 1, (x+1,y) (x,y+1) (x+1,y+1). Así trasladar una pieza
     es sumar (dx, dy) y el tipo de cada triángulo no cambia.
   - **Las líneas son franjas entre dos rectas paralelas de la red**, en tres
     direcciones: y constante, x constante y x + y + d constante. Un
     triángulo está en exactamente una franja de cada dirección.
   - **El tablero es un hexágono de lado LADO**: los triángulos con sus tres
     vértices dentro de |x| ≤ LADO, |y| ≤ LADO, |x + y| ≤ LADO. Son
     6·LADO² triángulos y 2·LADO franjas por dirección.
   - **Los poderes** (🔨 🔄 🔀 💣 💥, tabla PODERES): cerrar líneas puede
     regalar alguno, con más probabilidad cuantas más líneas a la vez. Su
     azar sale del mismo chorro de la partida, y cada uso va al registro con
     su código negativo ([código, a, b, …]), así que también se rehace. La
     partida no termina mientras algún poder pueda destrabarla.
   - **El azar no es del navegador.** Cada tanda de tres piezas sale de su
     propio chorro mulberry32 (`mezcla(base, k)`), con la cuenta dentro de
     la base, para que la partida se pueda rehacer. */
(function (root) {
  'use strict';
  const LADO = 4;
  const H = Math.sqrt(3) / 2;
  const MANO = 3;

  /* Los poderes: cuántos se guardan como mucho y la probabilidad de ganar
     uno al cerrar n líneas de una vez. Para equilibrar el juego, se toca
     solo esta tabla. El código es el que llevan en el registro.
     - martillo: rompe un triángulo ocupado.
     - girar: gira 60° una pieza de la mano.
     - cambio: descarta la mano y reparte otra.
     - bomba: rompe los triángulos alrededor de un punto de la red.
     - vida (segunda oportunidad): solo si no cabe nada; borra la mitad de
       abajo del tablero. Muy rara a propósito: infla los puntajes. */
  const PODERES = {
    martillo: { codigo: -1, max: 3, chance: n => Math.min(0.5, 0.1 + 0.1 * n) },
    girar: { codigo: -2, max: 3, chance: n => Math.min(0.35, 0.1 + 0.05 * n) },
    cambio: { codigo: -3, max: 2, chance: n => Math.min(0.3, 0.05 + 0.05 * n) },
    bomba: { codigo: -4, max: 2, chance: n => Math.min(0.25, 0.05 * n) },
    vida: { codigo: -5, max: 1, chance: n => n >= 3 ? 0.1 : n === 2 ? 0.05 : 0.01 }
  };
  const ORDEN_PODERES = Object.keys(PODERES);
  const PODER_DE_CODIGO = Object.fromEntries(ORDEN_PODERES.map(k => [PODERES[k].codigo, k]));

  function rng(a) {
    a >>>= 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mezcla(s, n) {
    let h = Math.imul((s ^ Math.imul(n | 0, 0x9E3779B1)) >>> 0, 0x85EBCA6B);
    h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
    return h >>> 0;
  }
  function hashTexto(t) {
    let h = 0x811C9DC5;
    for (const ch of String(t)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  /* ---------- Geometría ---------- */
  const clave = (x, y, d) => x + ',' + y + ',' + d;
  const vertices = (x, y, d) => d ? [[x + 1, y], [x, y + 1], [x + 1, y + 1]] : [[x, y], [x + 1, y], [x, y + 1]];
  const plano = (x, y) => [x + y / 2, y * H];
  const dentro = ([x, y]) => Math.abs(x) <= LADO && Math.abs(y) <= LADO && Math.abs(x + y) <= LADO;

  // El triángulo que tiene esos tres vértices: su centro por tres es (3x+1, 3y+1) si d = 0 y (3x+2, 3y+2) si d = 1.
  function desdeVertices(v) {
    const sx = v[0][0] + v[1][0] + v[2][0], sy = v[0][1] + v[1][1] + v[2][1];
    const d = ((sx % 3) + 3) % 3 === 1 ? 0 : 1, o = d ? 2 : 1;
    return [(sx - o) / 3, (sy - o) / 3, d];
  }

  const CELDAS = [], INDICE = new Map();
  for (let y = -LADO; y < LADO; y++)
    for (let x = -LADO; x <= LADO; x++)
      for (const d of [0, 1])
        if (vertices(x, y, d).every(dentro)) { INDICE.set(clave(x, y, d), CELDAS.length); CELDAS.push({ x, y, d }); }

  const franjas = c => ['y' + c.y, 'x' + c.x, 's' + (c.x + c.y + c.d)];
  const LINEAS = (() => {
    const m = new Map();
    CELDAS.forEach((c, i) => franjas(c).forEach(k => { if (!m.has(k)) m.set(k, []); m.get(k).push(i); }));
    return [...m.values()];
  })();
  const LINEAS_DE = CELDAS.map(() => []);
  LINEAS.forEach((l, j) => l.forEach(i => LINEAS_DE[i].push(j)));

  /* ---------- Piezas ----------
     Cada forma se escribe una vez y salen todas sus orientaciones: seis
     giros de 60° y su espejo, sin repetir. La pieza que llega a la mano
     viene ya orientada; el jugador no la gira. */
  const FORMAS = [
    { id: 'uno', peso: 2, t: [[0, 0, 0]] },
    { id: 'rombo', peso: 3, t: [[0, 0, 0], [0, 0, 1]] },
    { id: 'tres', peso: 3, t: [[0, 0, 0], [0, 0, 1], [1, 0, 0]] },
    { id: 'barra', peso: 2, t: [[0, 0, 0], [0, 0, 1], [1, 0, 0], [1, 0, 1]] },
    { id: 'triangulo', peso: 2, t: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]] },
    { id: 'gancho', peso: 2, t: [[0, 0, 0], [0, 0, 1], [1, 0, 0], [1, -1, 1]] },
    { id: 'trapecio', peso: 1, t: [[0, 0, 0], [0, 0, 1], [1, 0, 0], [1, 0, 1], [2, 0, 0]] },
    { id: 'hexagono', peso: 1, t: [[0, 0, 0], [-1, 0, 0], [0, -1, 0], [-1, 0, 1], [0, -1, 1], [-1, -1, 1]] }
  ];

  const transforma = (t, f) => desdeVertices(vertices(...t).map(f));
  const gira = t => transforma(t, ([x, y]) => [-y, x + y]);
  const espeja = t => transforma(t, ([x, y]) => [y, x]);
  function normaliza(ts) {
    const mx = Math.min(...ts.map(t => t[0])), my = Math.min(...ts.map(t => t[1]));
    return ts.map(([x, y, d]) => [x - mx, y - my, d]).sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]);
  }
  function orientaciones(ts) {
    const vistas = new Map();
    for (const base of [ts, ts.map(espeja)]) {
      let actual = base;
      for (let g = 0; g < 6; g++) {
        const n = normaliza(actual), k = JSON.stringify(n);
        if (!vistas.has(k)) vistas.set(k, n);
        actual = actual.map(gira);
      }
    }
    return [...vistas.values()];
  }
  FORMAS.forEach(f => { f.orient = orientaciones(f.t); });
  const PESO_TOTAL = FORMAS.reduce((s, f) => s + f.peso, 0);

  const celdasDe = p => FORMAS[p.f].orient[p.o];

  /* Una tanda nueva. Si ninguna de las tres piezas cabe en el tablero, se
     vuelve a sacar del mismo chorro hasta INTENTOS veces: perder porque la
     mano recién repartida es imposible se siente como trampa, no como
     derrota. Sigue siendo determinista: el mismo chorro da los mismos
     reintentos. */
  const INTENTOS = 4;
  function reparte(E) {
    const r = rng(mezcla(E.base, ++E.k));
    for (let intento = 0; intento < INTENTOS; intento++) {
      E.mano = [];
      for (let i = 0; i < MANO; i++) {
        let n = r() * PESO_TOTAL, f = 0;
        while (n >= FORMAS[f].peso) { n -= FORMAS[f].peso; f++; }
        E.mano.push({ f, o: Math.floor(r() * FORMAS[f].orient.length) });
      }
      if (puedeJugar(E)) return;
    }
  }

  function nueva(semilla, u) {
    const E = { semilla: semilla >>> 0, u: String(u || ''), t: new Array(CELDAS.length).fill(0), k: 0,
      puntos: 0, lineas: 0, jugadas: 0, racha: 0, mejorRacha: 0, poderes: Object.fromEntries(ORDEN_PODERES.map(k => [k, 0])), fin: false, mano: [], registro: [] };
    E.base = mezcla(E.semilla, hashTexto(E.u));
    reparte(E);
    return E;
  }

  /* Las casillas del tablero que ocuparía la pieza movida (dx, dy), o null
     si alguna cae fuera o sobre otra ficha. */
  function destino(E, p, dx, dy) {
    const out = [];
    for (const [x, y, d] of celdasDe(p)) {
      const i = INDICE.get(clave(x + dx, y + dy, d));
      if (i === undefined || E.t[i]) return null;
      out.push(i);
    }
    return out;
  }

  // Las casillas que cubriría la pieza movida (dx, dy) sin mirar si están libres, o null si se sale del hexágono.
  function cubre(p, dx, dy) {
    const out = [];
    for (const [x, y, d] of celdasDe(p)) {
      const i = INDICE.get(clave(x + dx, y + dy, d));
      if (i === undefined) return null;
      out.push(i);
    }
    return out;
  }

  // Las líneas que quedarían completas si se llenan esas casillas.
  function lineasQueCierra(E, casillas) {
    const llenas = new Set(casillas), cerradas = new Set();
    for (const i of casillas)
      for (const j of LINEAS_DE[i])
        if (!cerradas.has(j) && LINEAS[j].every(c => E.t[c] || llenas.has(c))) cerradas.add(j);
    return [...cerradas];
  }

  function cabe(E, p) {
    const [x0, y0, d0] = celdasDe(p)[0];
    return CELDAS.some(c => c.d === d0 && destino(E, p, c.x - x0, c.y - y0));
  }
  const puedeJugar = E => E.mano.some(p => p && cabe(E, p));

  // La misma pieza girada 60° (otra de las orientaciones de su forma).
  function girada(p) {
    const f = FORMAS[p.f], k = JSON.stringify(normaliza(f.orient[p.o].map(gira)));
    return { f: p.f, o: f.orient.findIndex(o => JSON.stringify(o) === k) };
  }
  // ¿Alguna pieza de la mano cabe girándola una o más veces?
  const cabeGirando = E => E.mano.some(p => {
    for (let q = p, g = 0; q && g < 5; g++) { q = girada(q); if (cabe(E, q)) return true; }
    return false;
  });
  // ¿Algún poder guardado puede destrabar una partida en la que no cabe nada?
  const rescate = E => {
    const P = E.poderes;
    return P.martillo > 0 || P.bomba > 0 || P.cambio > 0 || P.vida > 0 || (P.girar > 0 && cabeGirando(E));
  };
  // La partida termina cuando ninguna pieza cabe y ningún poder puede hacer sitio.
  const termino = E => !puedeJugar(E) && !rescate(E);

  // Los triángulos del tablero que tocan el punto (x, y) de la red: seis en el interior, menos en el borde.
  function alrededor(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return [];
    return [[x, y, 0], [x - 1, y, 0], [x, y - 1, 0], [x - 1, y, 1], [x, y - 1, 1], [x - 1, y - 1, 1]]
      .map(([a, b, d]) => INDICE.get(clave(a, b, d))).filter(i => i !== undefined);
  }
  // La mitad de abajo del tablero, que borra la segunda oportunidad.
  const MITAD = CELDAS.map((c, i) => c.y >= 0 ? i : -1).filter(i => i >= 0);

  // 20, 60, 120, 200… por cerrar 1, 2, 3, 4 líneas de una vez, y la racha lo multiplica.
  const bonoLineas = n => 10 * n * (n + 1);

  /* Una jugada: la pieza `slot` de la mano movida (dx, dy). Devuelve null si
     no se puede; si se puede, {casillas, borradas, lineas, suma, reparte}.
     `extra` = [origen, dms], si viene, queda en el registro con la jugada. */
  function coloca(E, slot, dx, dy, extra) {
    if (E.fin) return null;
    const p = E.mano[slot];
    if (!p) return null;
    const casillas = destino(E, p, dx, dy);
    if (!casillas) return null;
    const cerradas = lineasQueCierra(E, casillas);
    for (const i of casillas) E.t[i] = p.f + 1;
    const borradas = new Set();
    for (const j of cerradas) LINEAS[j].forEach(c => borradas.add(c));
    const n = cerradas.length;
    for (const i of borradas) E.t[i] = 0;
    E.racha = n ? E.racha + 1 : 0;
    E.mejorRacha = Math.max(E.mejorRacha, E.racha);
    E.registro.push(extra ? [slot, dx, dy, extra[0], extra[1]] : [slot, dx, dy]);
    const suma = casillas.length + bonoLineas(n) * Math.max(1, E.racha);
    E.puntos += suma; E.lineas += n; E.jugadas++;
    // Cada poder tira su dado del mismo chorro, siempre en el mismo orden (aunque ya esté lleno), para que la partida se rehaga igual.
    const ganados = [];
    if (n) {
      const r = rng(mezcla(E.base ^ 0x4D41, E.jugadas));
      for (const k of ORDEN_PODERES) if (r() < PODERES[k].chance(n) && E.poderes[k] < PODERES[k].max) { E.poderes[k]++; ganados.push(k); }
    }
    E.mano[slot] = null;
    const nuevaMano = E.mano.every(m => !m);
    if (nuevaMano) reparte(E);
    E.fin = termino(E);
    return { casillas, borradas: [...borradas], lineas: n, suma, reparte: nuevaMano, ganados };
  }

  /* Usa un poder. `codigo` es el de PODERES; `a` y `b` dicen dónde: la
     casilla (martillo), la pieza de la mano (girar) o el punto de la red
     (bomba); 0 y 0 si no hace falta. No suma puntos ni corta la racha.
     Devuelve null si no se puede; si se puede, {poder, borradas, valores}
     (los triángulos rotos y su color), {poder, slot} o {poder, reparte}. */
  function usa(E, codigo, a, b, extra) {
    const k = PODER_DE_CODIGO[codigo];
    if (!k || E.fin || E.poderes[k] < 1 || !Number.isInteger(a) || !Number.isInteger(b)) return null;
    let res;
    if (k === 'martillo') {
      if (a < 0 || a >= CELDAS.length || !E.t[a]) return null;
      res = { borradas: [a] };
    } else if (k === 'bomba') {
      const ocupadas = alrededor(a, b).filter(i => E.t[i]);
      if (!ocupadas.length) return null;
      res = { borradas: ocupadas };
    } else if (k === 'vida') {
      if (puedeJugar(E)) return null;
      res = { borradas: MITAD.filter(i => E.t[i]) };
    } else if (k === 'girar') {
      if (!E.mano[a]) return null;
      E.mano[a] = girada(E.mano[a]);
      res = { slot: a };
    } else {
      reparte(E);
      res = { reparte: true };
    }
    if (res.borradas) { res.valores = res.borradas.map(i => E.t[i]); for (const i of res.borradas) E.t[i] = 0; }
    E.poderes[k]--;
    E.registro.push(extra ? [codigo, a, b, extra[0], extra[1]] : [codigo, a, b]);
    E.fin = termino(E);
    return Object.assign({ poder: k }, res);
  }

  /* Rehace una partida desde su semilla y sus jugadas. Cada jugada es
     [slot, dx, dy] y, desde la fase 3, [slot, dx, dy, origen, dms]: con qué
     se jugó (r ratón, t dedo, k teclado, m mando, x sintética) y los ms
     jugados desde la anterior. Sirve para retomar la partida guardada en el
     navegador y para que el verificador antitrampas
     (colabtex/src/juegos/solo/verifica/trigon.js) compruebe el puntaje.
     `ms` es la suma de los dms: el tiempo de la partida hasta su última
     jugada. */
  const ORIGENES = 'rtkmx';
  function rehace(semilla, u, jugadas) {
    const E = nueva(semilla, u);
    if (!Array.isArray(jugadas)) return { error: 'La partida no trae jugadas.' };
    let ms = 0;
    for (const j of jugadas) {
      if (!Array.isArray(j) || (j.length !== 3 && j.length !== 5) || !j.slice(0, 3).every(Number.isInteger)) return { error: 'Una jugada de la partida está mal formada.' };
      if (j.length === 5) {
        if (typeof j[3] !== 'string' || j[3].length !== 1 || !ORIGENES.includes(j[3]) || !Number.isSafeInteger(j[4]) || j[4] < 0) return { error: 'Una jugada de la partida está mal formada.' };
        ms += j[4];
      }
      const extra = j.length === 5 ? [j[3], j[4]] : null;
      if (j[0] < 0 ? !usa(E, j[0], j[1], j[2], extra) : !coloca(E, j[0], j[1], j[2], extra)) return { error: 'Una jugada de la partida no se puede hacer en el tablero rehecho.' };
    }
    return { E, ms };
  }

  const api = { LADO, H, MANO, CELDAS, LINEAS, FORMAS, vertices, plano, celdasDe, nueva, destino, cubre,
    lineasQueCierra, cabe, puedeJugar, coloca, bonoLineas, rehace, usa, girada, alrededor, PODERES, ORDEN_PODERES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrigonMotor = api;
})(this);
