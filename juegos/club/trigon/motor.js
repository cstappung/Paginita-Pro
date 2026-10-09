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
   - **El azar no es del navegador.** Cada tanda de tres piezas sale de su
     propio chorro mulberry32 (`mezcla(base, k)`), con la cuenta dentro de
     la base, para que la partida se pueda rehacer. */
(function (root) {
  'use strict';
  const LADO = 4;
  const H = Math.sqrt(3) / 2;
  const MANO = 3;

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
      puntos: 0, lineas: 0, jugadas: 0, racha: 0, mejorRacha: 0, fin: false, mano: [], registro: [] };
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
    E.mano[slot] = null;
    const nuevaMano = E.mano.every(m => !m);
    if (nuevaMano) reparte(E);
    if (!puedeJugar(E)) E.fin = true;
    return { casillas, borradas: [...borradas], lineas: n, suma, reparte: nuevaMano };
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
      if (!coloca(E, j[0], j[1], j[2], j.length === 5 ? [j[3], j[4]] : null)) return { error: 'Una jugada de la partida no se puede hacer en el tablero rehecho.' };
    }
    return { E, ms };
  }

  const api = { LADO, H, MANO, CELDAS, LINEAS, FORMAS, vertices, plano, celdasDe, nueva, destino, cubre,
    lineasQueCierra, cabe, puedeJugar, coloca, bonoLineas, rehace };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrigonMotor = api;
})(this);
