/* PRO PACMAN — el motor. Todo lo que decide una partida está aquí (el
   laberinto, los puntos, los fantasmas, el turbo, el pulso, las compuertas,
   las vidas) y nada se dibuja: juego.js lo usa para jugar y el verificador
   antitrampas (colabtex/src/juegos/solo/verifica/propac.js) para rehacer la
   partida desde su semilla y sus jugadas.

   - **Todo es entero y por tics.** 60 tics por segundo; una casilla mide
     U = 8 unidades y cada cuerpo avanza de a una unidad, con su velocidad
     en centésimas de unidad por tic acumuladas en `acc`. Así no hay coma
     flotante que pueda dar distinto en otro navegador, y los cuerpos pasan
     exactamente por el centro de cada casilla, que es donde se gira.
   - **El azar no es del navegador**: mulberry32 con la semilla de la
     partida mezclada con la cuenta (una prueba copiada de otra cuenta
     reparte otro azar y no se rehace).
   - **Una jugada es [Δtics, código, origen]**: 0–3 querer ir arriba,
     izquierda, abajo o derecha; 4 turbo; 5 pulso. `rehace` las aplica en
     su tic y sigue hasta el final.
   - **Versiones** (`E.v`, la `v` de la prueba): la 1 es la primera, más
     rápida y con fantasmas a medias; la 2 baja la velocidad y hace pensar
     a los fantasmas como en el arcade (contadores de la casa, Elroy, el
     error de «arriba», los tiempos de modo por nivel) y saca de la casa
     cazando, no azules, a los que ya fueron comidos. La 1 se queda tal cual
     para que las pruebas guardadas se sigan rehaciendo: **lo que cambie
     cómo se juega necesita una versión nueva**.

   Lo nuevo frente al arcade de siempre:
   - **Racha**: comer puntos seguidos (sin pasar `RACHA_TICS` sin comer)
     sube el multiplicador de los puntos, ×1 a ×5.
   - **Turbo** (Espacio): gasta `TURBO_COSTO` de energía y corre ×1.7 un
     rato; la energía se carga comiendo puntos.
   - **Pulso** (E): las cargas salen en el centro del laberinto; aturde a
     los fantasmas cercanos unos segundos (ni persiguen ni matan).
   - **Compuertas** (`=` en el mapa, desde el segundo laberinto): se abren
     y se cierran cada `COMPUERTA_TICS`, para fantasmas y jugador.
   - **Glitch**, el quinto fantasma (desde el nivel 3): cada tanto se
     congela un segundo y salta a otro lugar del laberinto. */
(function (root) {
  'use strict';
  const U = 8, C = 4, TPS = 60;
  const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];   // arriba, izquierda, abajo, derecha
  const OPUESTA = [2, 3, 0, 1];
  const PARED = 0, LIBRE = 1, PUERTA = 2, CASA = 3, TUNEL = 4, COMPUERTA = 5;
  const RACHA_TICS = 36, RACHA_PASO = 12, RACHA_MAX = 5;
  const TURBO_COSTO = 35, TURBO_TICS = 50, ENERGIA_PUNTO = 3;
  const PULSO_RADIO = 6 * U, PULSO_TICS = 180, PULSOS_MAX = 2;
  const COMPUERTA_TICS = 480, AVISO_TICS = 60;
  const GLITCH_CADA = 720;
  const ITEM_TICS = 600, ITEM_EN = [50, 130];
  const VIDAS = 3, VIDAS_MAX = 5, VIDA_PRIMERA = 10000, VIDA_CADA = 25000;
  const MAX_TICS = 60 * 60 * 90;     // hora y media de juego como mucho
  /* Disperso y caza, alternados (los pares dispersan); el último no acaba. */
  const MODOS = [420, 1200, 420, 1200, 300, 1200, 300, Infinity];
  const SALIDA = [0, 60, 240, 420, 600];
  const PRUEBA_V = 2, PRUEBA_VERSIONES = [1, 2];

  /* v2: los tiempos de disperso/caza del arcade por nivel (1, 2–4, 5+). */
  const MODOS_V2 = [
    [420, 1200, 420, 1200, 300, 1200, 300, Infinity],
    [420, 1200, 420, 1200, 300, 61980, 1, Infinity],
    [300, 1200, 300, 1200, 300, 62220, 1, Infinity]];
  /* v2: velocidades por nivel (1, 2–4, 5+) = las del arcade × 1,06; un
     punto intermedio entre la v1 (que en este laberinto más chico cruzaba
     la pantalla mucho más rápido) y el original. [jugador, jugador con
     fantasmas azules, fantasma, fantasma azul, fantasma en el túnel]. */
  const VEL_V2 = [[85, 95, 80, 53, 42], [95, 100, 90, 58, 48], [106, 106, 100, 64, 53]];
  /* v2: puntos que el jugador come antes de que salga cada fantasma (Rayo
     empieza fuera). El contador de la casa del arcade, a la escala de estos
     laberintos (~150–180 puntos frente a 244). */
  const CASA_PUNTOS = [[0, 0, 18, 36, 12], [0, 0, 0, 30, 12], [0, 0, 0, 0, 12]];
  /* Tras perder una vida cuenta un contador común: sale Eco con 4, Rebote
     con 10, Tímido con 20 (7, 17 y 32 en el arcade). */
  const CASA_GLOBAL = [0, 4, 10, 20, 26];
  const CASA_ESPERA = [240, 180];   // sin comer este rato, sale el siguiente (niveles 1–4, 5+)
  const CASA_HUECO = 30;            // tics mínimos entre dos salidas

  /* `#` pared, `.` punto, `o` núcleo de poder, ` ` pasillo vacío, `-` la
     puerta de la casa, `G` la casa, `P` donde empieza el jugador, `F` donde
     salen las cargas y los chips, `T` el túnel que da la vuelta y `=` una
     compuerta. Cada mapa tiene 19 columnas y 21 filas. */
  const MAPAS = [
    { nombre: 'Neón', color: '#2de2ff', brillo: '#b44dff', filas: [
      '###################',
      '#........#........#',
      '#o##.###.#.###.##o#',
      '#.................#',
      '#.##.#.#####.#.##.#',
      '#....#...#...#....#',
      '####.### # ###.####',
      '####.#       #.####',
      '####.# ##-## #.####',
      'T    . #GGG# .    T',
      '####.# ##### #.####',
      '####.#   F   #.####',
      '####.# ##### #.####',
      '#........#........#',
      '#.##.###.#.###.##.#',
      '#o.#.....P.....#.o#',
      '##.#.#.#####.#.#.##',
      '#....#...#...#....#',
      '#.######.#.######.#',
      '#.................#',
      '###################'] },
    { nombre: 'Circuito', color: '#ff3df0', brillo: '#ffd23d', filas: [
      '###################',
      '#o...#.......#...o#',
      '#.##.#.#####.#.##.#',
      '#.................#',
      '#.##.####=####.##.#',
      '#....#.......#....#',
      '####.#.##-##.#.####',
      '####.#.#GGG#.#.####',
      'T   ...#####...   T',
      '####.#...F...#.####',
      '####.#.##=##.#.####',
      '#.................#',
      '#.##.###.#.###.##.#',
      '#o.#.....P.....#.o#',
      '##.#.#.#####.#.#.##',
      '#....#...#...#....#',
      '#.######.#.######.#',
      '#........=........#',
      '#.##.##.###.##.##.#',
      '#.................#',
      '###################'] },
    { nombre: 'Reactor', color: '#39ff7a', brillo: '#ff7a2f', filas: [
      '###################',
      '#o.......#.......o#',
      '#.#.####.#.####.#.#',
      '#.#.............#.#',
      '#...##.##=##.##...#',
      '###.#...#.#...#.###',
      '###.#.#.....#.#.###',
      '###.#. ##-## .#.###',
      'T...#. #GGG# .#...T',
      '###.#. ##### .#.###',
      '###.#=   F   =#.###',
      '###.#.#######.#.###',
      '#........#........#',
      '#.###.##.#.##.###.#',
      '#o..#....P....#..o#',
      '###.#.#.###.#.#.###',
      '#.....#.....#.....#',
      '#.###.#.###.#.###.#',
      '#...#...###...#...#',
      '#.................#',
      '###################'] }
  ];

  function rng(a) {
    a >>>= 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashTexto(t) {
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mezcla(a, b) {
    let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ b;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }

  /* El mapa leído: tipos de casilla, puntos, y los sitios con nombre. */
  function leeMapa(i) {
    const M = MAPAS[i % MAPAS.length], ancho = M.filas[0].length, alto = M.filas.length;
    const tipo = new Uint8Array(ancho * alto), comida = new Uint8Array(ancho * alto);
    const casa = [];
    let pac = null, puerta = null, item = null, compuertas = 0, total = 0;
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
      const c = M.filas[y][x], k = y * ancho + x;
      tipo[k] = c === '#' ? PARED : c === '-' ? PUERTA : c === 'G' ? CASA : c === 'T' ? TUNEL : c === '=' ? COMPUERTA : LIBRE;
      if (c === '.') { comida[k] = 1; total++; }
      if (c === 'o') { comida[k] = 2; total++; }
      if (c === 'P') pac = [x, y];
      if (c === '-') puerta = [x, y];
      if (c === 'F') item = [x, y];
      if (c === 'G') casa.push([x, y]);
      if (c === '=') compuertas++;
    }
    return { i: i % MAPAS.length, nombre: M.nombre, color: M.color, brillo: M.brillo, ancho, alto, tipo, comida, total, pac, puerta, item, casa, compuertas };
  }

  const centro = t => t * U + C;
  const casilla = v => Math.floor(v / U);
  const enCentro = b => b.x % U === C && b.y % U === C;

  function abiertas(E) { return Math.floor(E.compT / COMPUERTA_TICS) % 2 === 0; }
  /* ¿Se cierran (o se abren) dentro de poco? Para el aviso en pantalla. */
  function avisoCompuertas(E) { return E.mapa.compuertas > 0 && COMPUERTA_TICS - (E.compT % COMPUERTA_TICS) <= AVISO_TICS; }
  function tipoEn(E, tx, ty) {
    const m = E.mapa;
    if (ty < 0 || ty >= m.alto) return PARED;
    tx = ((tx % m.ancho) + m.ancho) % m.ancho;
    return m.tipo[ty * m.ancho + tx];
  }
  /* ¿Puede este cuerpo entrar en esa casilla? La casa y su puerta solo son
     de los fantasmas que salen o vuelven; las compuertas, de todos si están
     abiertas. */
  function libre(E, tx, ty, b) {
    const t = tipoEn(E, tx, ty);
    if (t === PARED) return false;
    if (t === PUERTA || t === CASA) return !!b.fantasma && (b.estado === 'sale' || b.estado === 'ojos' || b.estado === 'casa');
    if (t === COMPUERTA) return abiertas(E);
    return true;
  }

  function nueva(semilla, uid, v) {
    const s = semilla >>> 0;
    v = v == null ? PRUEBA_V : v;
    if (!PRUEBA_VERSIONES.includes(v)) throw new Error('versión desconocida: ' + v);
    const E = {
      v, s, u: String(uid || ''), rnd: rng(mezcla(s, hashTexto(String(uid || '')))),
      tick: 0, nivel: 0, puntos: 0, vidas: VIDAS, vidaSig: VIDA_PRIMERA,
      estado: 'jugando', congelado: 0, ev: [],
      racha: 0, rachaT: 0, mejorRacha: 0, energia: 0, turboT: 0, pulsos: 0,
      fantasmasComidos: 0, puntosComidos: 0, glitches: 0
    };
    cargaNivel(E, 1);
    return E;
  }

  function cargaNivel(E, n) {
    E.nivel = n;
    E.mapa = leeMapa(n - 1);
    E.restantes = E.mapa.total;
    E.comidosNivel = 0;
    E.items = 0;
    E.item = null;
    E.compT = 0;
    E.estado = 'jugando';
    E.casaPuntos = [0, 0, 0, 0, 0];
    colocaCuerpos(E);
    E.congelado = 90;   // «¡Listo!»
    E.ev.push({ k: 'nivel', n });
  }

  function colocaCuerpos(E, trasMuerte) {
    const m = E.mapa;
    E.pac = { x: centro(m.pac[0]), y: centro(m.pac[1]), dir: 1, quiere: -1, acc: 0 };
    const n = E.nivel >= 3 ? 5 : 4, sobre = [m.puerta[0], m.puerta[1] - 1];
    E.fantasmas = [];
    for (let i = 0; i < n; i++) {
      const c = i === 0 ? sobre : m.casa[(i - 1) % m.casa.length];
      E.fantasmas.push({ id: i, fantasma: true, x: centro(c[0]), y: centro(c[1]), dir: 1, acc: 0,
        estado: i === 0 ? modoActual(E, true) : 'casa', sale: E.tick + SALIDA[i], aturT: 0, antes: '', invertir: false, glitchT: 0, aviso: 0 });
    }
    E.modoIdx = 0; E.modoT = 0; E.miedoT = 0; E.comidos = 0;
    E.turboT = 0; E.racha = 0; E.rachaT = 0;
    // v2: tras una muerte salen por el contador común y Rayo no vuelve a
    // ser Elroy hasta que salga Tímido, como en el arcade.
    E.sinComer = 0; E.casaHueco = CASA_HUECO;
    E.casaGlobal = trasMuerte ? 0 : -1; E.elroyPausa = !!trasMuerte;
  }
  /* v2: el tramo de nivel (0: el 1; 1: del 2 al 4; 2: del 5 en adelante). */
  const tramo = E => E.nivel <= 1 ? 0 : E.nivel <= 4 ? 1 : 2;
  const modos = E => E.v >= 2 ? MODOS_V2[tramo(E)] : MODOS;
  /* v2: puntos que quedan cuando Rayo se vuelve Elroy (corre más y caza
     también en disperso); con la mitad, Elroy 2. */
  const elroyDesde = E => E.nivel <= 1 ? 12 : E.nivel === 2 ? 18 : E.nivel <= 5 ? 24 : E.nivel <= 8 ? 30 : 36;
  function elroy(E) {
    if (E.v < 2 || E.elroyPausa) return 0;
    const n = elroyDesde(E);
    return E.restantes <= n >> 1 ? 2 : E.restantes <= n ? 1 : 0;
  }
  function modoActual(E, inicio) {
    const i = inicio ? 0 : E.modoIdx;
    return i % 2 === 0 ? 'disperso' : 'caza';
  }

  // --------------------------------- velocidades ---------------------------------
  const velPac = E => {
    const base = E.v >= 2 ? VEL_V2[tramo(E)][E.miedoT > 0 ? 1 : 0] : 100 + Math.min(20, 2 * (E.nivel - 1));
    return E.turboT > 0 ? Math.round(base * 1.7) : base;
  };
  function velFantasma(E, g) {
    if (E.v >= 2) return velFantasmaV2(E, g);
    if (g.estado === 'ojos') return 200;
    if (g.estado === 'aturdido' || g.estado === 'casa' || g.aviso > 0) return 0;
    if (g.estado === 'miedo') return 55;
    if (tipoEn(E, casilla(g.x), casilla(g.y)) === TUNEL) return 50;
    if (g.estado === 'sale') return 70;
    const base = 92 + Math.min(22, 3 * (E.nivel - 1));
    // Rayo acelera cuando quedan pocos puntos, como en el arcade.
    return g.id === 0 && E.restantes <= 20 ? base + 6 : base;
  }
  function velFantasmaV2(E, g) {
    const V = VEL_V2[tramo(E)];
    if (g.estado === 'ojos') return 180;
    if (g.estado === 'aturdido' || g.estado === 'casa' || g.aviso > 0) return 0;
    if (g.estado === 'miedo') return V[3];
    if (tipoEn(E, casilla(g.x), casilla(g.y)) === TUNEL) return V[4];
    if (g.estado === 'sale') return 55;
    // Elroy: +5 y +10, como Blinky en el arcade.
    return g.id === 0 ? V[2] + 5 * elroy(E) : V[2];
  }
  const miedoNivel = n => Math.max(120, 420 - 40 * (n - 1));
  const valorChip = n => Math.min(5000, 100 * n * (n + 1) / 2 | 0);

  // ----------------------------------- entrada -----------------------------------
  function entrada(E, c) {
    if (E.estado !== 'jugando') return false;
    if (c >= 0 && c <= 3) { E.pac.quiere = c; return true; }
    if (c === 4) {
      if (E.congelado > 0 || E.turboT > 0 || E.energia < TURBO_COSTO) return false;
      E.energia -= TURBO_COSTO; E.turboT = TURBO_TICS; E.ev.push({ k: 'turbo' });
      return true;
    }
    if (c === 5) {
      if (E.congelado > 0 || E.pulsos < 1) return false;
      E.pulsos--;
      let n = 0;
      for (const g of E.fantasmas) {
        if (!(g.estado === 'caza' || g.estado === 'disperso' || g.estado === 'miedo')) continue;
        if (Math.abs(g.x - E.pac.x) > PULSO_RADIO || Math.abs(g.y - E.pac.y) > PULSO_RADIO) continue;
        g.antes = g.estado; g.estado = 'aturdido'; g.aturT = PULSO_TICS; n++;
      }
      suma(E, 100 * n);
      E.ev.push({ k: 'pulso', n, x: E.pac.x, y: E.pac.y });
      return true;
    }
    return false;
  }

  function suma(E, p) {
    if (!(p > 0)) return;
    E.puntos += p;
    while (E.puntos >= E.vidaSig) {
      E.vidaSig += VIDA_CADA;
      if (E.vidas < VIDAS_MAX) { E.vidas++; E.ev.push({ k: 'vida' }); }
    }
  }

  // ------------------------------------- tic -------------------------------------
  function paso(E) {
    if (E.estado === 'fin') return;
    E.tick++;
    if (E.congelado > 0) {
      E.congelado--;
      if (E.congelado > 0) return;
      if (E.estado === 'muere') {
        if (E.vidas > 0) { E.estado = 'jugando'; colocaCuerpos(E, true); E.congelado = 60; E.ev.push({ k: 'listo' }); }
        else { E.estado = 'fin'; E.ev.push({ k: 'fin' }); }
        return;
      }
      if (E.estado === 'nivel') { cargaNivel(E, E.nivel + 1); return; }
      return;
    }
    if (E.mapa.compuertas) {
      const antes = abiertas(E);
      E.compT++;
      if (abiertas(E) !== antes) E.ev.push({ k: abiertas(E) ? 'abre' : 'cierra' });
    }
    if (E.miedoT > 0) {
      E.miedoT--;
      if (E.miedoT === 0) for (const g of E.fantasmas) if (g.estado === 'miedo') g.estado = modoActual(E);
    } else if (++E.modoT >= modos(E)[E.modoIdx]) {
      E.modoIdx++; E.modoT = 0;
      for (const g of E.fantasmas) if (g.estado === 'caza' || g.estado === 'disperso') { g.estado = modoActual(E); g.invertir = true; }
    }
    if (E.rachaT > 0 && --E.rachaT === 0) E.racha = 0;
    if (E.turboT > 0) E.turboT--;
    if (E.item && --E.item.t <= 0) E.item = null;

    mueve(E, E.pac, velPac(E));
    if (choque(E)) return;
    if (E.v >= 2) salidaCasa(E);
    for (const g of E.fantasmas) {
      if (E.v < 2 && g.estado === 'casa' && E.tick >= g.sale) g.estado = 'sale';
      if (g.estado === 'aturdido' && --g.aturT <= 0) g.estado = g.antes === 'miedo' && E.miedoT > 0 ? 'miedo' : modoActual(E);
      if (g.id === 4) glitch(E, g);
      mueve(E, g, velFantasma(E, g));
    }
    if (choque(E)) return;
    if (E.restantes === 0) { E.estado = 'nivel'; E.congelado = 150; E.ev.push({ k: 'limpio', n: E.nivel }); }
  }

  /* v2: quién sale de la casa, como en el arcade. Solo cuenta el primero que
     espera (Eco, Rebote, Tímido, Glitch): sale cuando el jugador comió sus
     puntos de la casa (o, tras una muerte, los del contador común), o
     cuando el jugador pasa un rato sin comer. `come` suma los contadores. */
  function salidaCasa(E) {
    E.sinComer++;
    if (E.casaHueco < CASA_HUECO) { E.casaHueco++; return; }
    const g = E.fantasmas.find(f => f.estado === 'casa');
    if (!g) return;
    const listo = E.casaGlobal >= 0 ? E.casaGlobal >= CASA_GLOBAL[g.id] : E.casaPuntos[g.id] >= CASA_PUNTOS[tramo(E)][g.id];
    if (!listo && E.sinComer < CASA_ESPERA[E.nivel >= 5 ? 1 : 0]) return;
    if (!listo) E.sinComer = 0;
    g.estado = 'sale'; E.casaHueco = 0;
    if (g.id === 3) { E.elroyPausa = false; if (E.casaGlobal >= 0) E.casaGlobal = -1; }
  }

  /* Glitch se congela AVISO un segundo (parpadea en pantalla) y salta a una
     casilla de pasillo lejos del jugador. */
  function glitch(E, g) {
    if (!(g.estado === 'caza' || g.estado === 'disperso')) { g.aviso = 0; return; }
    if (g.aviso > 0) {
      if (--g.aviso > 0) return;
      const m = E.mapa, px = casilla(E.pac.x), py = casilla(E.pac.y), op = [];
      for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
        if (m.tipo[y * m.ancho + x] !== LIBRE) continue;
        if (Math.abs(x - px) + Math.abs(y - py) < 8) continue;
        op.push([x, y]);
      }
      if (op.length) {
        const [x, y] = op[Math.floor(E.rnd() * op.length)];
        E.ev.push({ k: 'glitch', x0: g.x, y0: g.y, x: centro(x), y: centro(y) });
        g.x = centro(x); g.y = centro(y); g.acc = 0;
        g.dir = Math.floor(E.rnd() * 4);
        E.glitches++;
      }
      g.glitchT = 0;
      return;
    }
    if (++g.glitchT >= GLITCH_CADA) { g.aviso = AVISO_TICS; E.ev.push({ k: 'glitch-aviso' }); }
  }

  function mueve(E, b, v) {
    if (!v) return;
    b.acc += v;
    while (b.acc >= 100) {
      b.acc -= 100;
      if (b.fantasma) unPasoFantasma(E, b); else unPasoPac(E, b);
    }
  }
  function avanza(E, b) {
    const [dx, dy] = DIRS[b.dir], W = E.mapa.ancho * U;
    b.x += dx; b.y += dy;
    if (b.x < 0) b.x += W; else if (b.x >= W) b.x -= W;
  }
  function unPasoPac(E, p) {
    if (enCentro(p)) {
      const tx = casilla(p.x), ty = casilla(p.y);
      if (p.quiere >= 0 && libre(E, tx + DIRS[p.quiere][0], ty + DIRS[p.quiere][1], p)) { p.dir = p.quiere; p.quiere = -1; }
      if (!libre(E, tx + DIRS[p.dir][0], ty + DIRS[p.dir][1], p)) return;
    } else if (p.quiere === OPUESTA[p.dir]) { p.dir = p.quiere; p.quiere = -1; }
    avanza(E, p);
    come(E);
  }

  function come(E) {
    const m = E.mapa, p = E.pac, tx = casilla(p.x), ty = casilla(p.y), k = ty * m.ancho + tx;
    const c = m.comida[k];
    if (c) {
      m.comida[k] = 0; E.restantes--; E.comidosNivel++; E.puntosComidos++;
      E.racha++; E.rachaT = RACHA_TICS; E.mejorRacha = Math.max(E.mejorRacha, E.racha);
      E.energia = Math.min(100, E.energia + ENERGIA_PUNTO);
      if (E.v >= 2) {
        E.sinComer = 0;
        const g = E.fantasmas.find(f => f.estado === 'casa');
        if (E.casaGlobal >= 0) E.casaGlobal++; else if (g) E.casaPuntos[g.id]++;
      }
      if (c === 1) { suma(E, 10 * multiplicador(E)); E.ev.push({ k: 'punto' }); }
      else {
        suma(E, 50);
        E.miedoT = miedoNivel(E.nivel); E.comidos = 0;
        for (const g of E.fantasmas) {
          if (g.estado === 'caza' || g.estado === 'disperso' || g.estado === 'miedo') { if (g.estado !== 'miedo') g.invertir = true; g.estado = 'miedo'; }
          // v2: el que ya fue comido sale cazando; con un núcleo nuevo, se vuelve a asustar.
          if (g.estado !== 'ojos') g.comido = false;
        }
        E.ev.push({ k: 'poder' });
      }
      if (E.items < ITEM_EN.length && E.comidosNivel >= ITEM_EN[E.items]) {
        E.item = { tipo: E.items === 0 ? 'pulso' : 'chip', t: ITEM_TICS, x: m.item[0], y: m.item[1] };
        E.items++;
        E.ev.push({ k: 'item', tipo: E.item.tipo });
      }
    }
    if (E.item && tx === E.item.x && ty === E.item.y) {
      if (E.item.tipo === 'pulso') { E.pulsos = Math.min(PULSOS_MAX, E.pulsos + 1); E.ev.push({ k: 'carga' }); }
      else { const v = valorChip(E.nivel); suma(E, v); E.ev.push({ k: 'chip', v, x: p.x, y: p.y }); }
      E.item = null;
    }
  }
  const multiplicador = E => Math.min(RACHA_MAX, 1 + Math.floor(Math.max(0, E.racha - 1) / RACHA_PASO));

  /* A dónde quiere ir cada fantasma (en casillas). */
  function objetivo(E, g) {
    const m = E.mapa, p = E.pac, px = casilla(p.x), py = casilla(p.y), [dx, dy] = DIRS[p.dir];
    if (g.estado === 'ojos') return m.casa[Math.floor(m.casa.length / 2)];
    if (g.estado === 'sale') return [m.puerta[0], m.puerta[1] - 1];
    // v2: Elroy no se va a su rincón, sigue cazando.
    if (g.estado === 'disperso' && !(g.id === 0 && elroy(E))) return [[m.ancho - 2, -2], [1, -2], [m.ancho - 1, m.alto + 1], [0, m.alto + 1], [Math.floor(m.ancho / 2), m.alto + 2]][g.id];
    // v2: el error de «arriba» del arcade: mirando hacia arriba, lo de
    // «n casillas delante» también va n casillas a la izquierda.
    const ix = E.v >= 2 && p.dir === 0 ? -1 : 0;
    switch (g.id) {
      case 1: return [px + 4 * (dx + ix), py + 4 * dy];
      case 2: {
        const r = E.fantasmas[0], ax = px + 2 * (dx + ix), ay = py + 2 * dy;
        return [2 * ax - casilla(r.x), 2 * ay - casilla(r.y)];
      }
      case 3: {
        const gx = casilla(g.x), gy = casilla(g.y);
        return (gx - px) * (gx - px) + (gy - py) * (gy - py) > 64 ? [px, py] : [0, m.alto + 1];
      }
      default: return [px, py];
    }
  }
  /* Distancias (en casillas) hasta `obj` por donde este fantasma puede
     pasar ahora. Los ojos y el que sale de la casa van por el camino más
     corto: con la regla de la recta de siempre, unos ojos junto a la casa
     podían quedar rebotando entre dos casillas para siempre. */
  function distancias(E, g, obj) {
    const m = E.mapa, W = m.ancho, d = new Int16Array(W * m.alto).fill(-1);
    const k0 = obj[1] * W + obj[0];
    if (obj[1] < 0 || obj[1] >= m.alto || !libre(E, obj[0], obj[1], g)) return null;
    d[k0] = 0;
    const q = [k0];
    for (let i = 0; i < q.length; i++) {
      const k = q[i], x = k % W, y = (k - x) / W;
      for (const [dx, dy] of DIRS) {
        const nx = (x + dx + W) % W, ny = y + dy;
        if (ny < 0 || ny >= m.alto) continue;
        const nk = ny * W + nx;
        if (d[nk] >= 0 || !libre(E, nx, ny, g)) continue;
        d[nk] = d[k] + 1; q.push(nk);
      }
    }
    return d;
  }

  // El índice de la casilla vecina en esa dirección (las de `op` siempre están dentro del mapa).
  const vecina = (m, tx, ty, d) => (ty + DIRS[d][1]) * m.ancho + ((tx + DIRS[d][0] + m.ancho) % m.ancho);

  function unPasoFantasma(E, g) {
    if (g.invertir) { g.invertir = false; g.dir = OPUESTA[g.dir]; }
    if (enCentro(g)) {
      const tx = casilla(g.x), ty = casilla(g.y), m = E.mapa;
      // Los ojos llegaron a la casa: vuelven a salir.
      if (g.estado === 'ojos') {
        const c = m.casa[Math.floor(m.casa.length / 2)];
        if (tx === c[0] && ty === c[1]) { g.estado = 'sale'; }
      }
      if (g.estado === 'sale' && tx === m.puerta[0] && ty === m.puerta[1] - 1) { g.estado = E.miedoT > 0 && !(E.v >= 2 && g.comido) ? 'miedo' : modoActual(E); g.dir = 1; }
      const op = [];
      for (let d = 0; d < 4; d++) {
        if (d === OPUESTA[g.dir] && g.estado !== 'sale' && g.estado !== 'ojos') continue;
        // Fuera de la casa nadie vuelve a entrar por la puerta, salvo los ojos.
        const t = tipoEn(E, tx + DIRS[d][0], ty + DIRS[d][1]);
        if ((t === PUERTA || t === CASA) && g.estado !== 'ojos' && g.estado !== 'sale') continue;
        if (libre(E, tx + DIRS[d][0], ty + DIRS[d][1], g)) op.push(d);
      }
      const corto = (g.estado === 'ojos' || g.estado === 'sale') && op.length ? distancias(E, g, objetivo(E, g)) : null;
      if (!op.length) { if (libre(E, tx + DIRS[OPUESTA[g.dir]][0], ty + DIRS[OPUESTA[g.dir]][1], g)) g.dir = OPUESTA[g.dir]; else return; }
      else if (corto && op.some(d => corto[vecina(m, tx, ty, d)] >= 0)) {
        let mejor = Infinity;
        for (const d of op) { const v = corto[vecina(m, tx, ty, d)]; if (v >= 0 && v < mejor) { mejor = v; g.dir = d; } }
      }
      else if (g.estado === 'miedo') g.dir = op[Math.floor(E.rnd() * op.length)];
      else {
        const [ox, oy] = objetivo(E, g);
        let mejor = Infinity;
        for (const d of op) {
          const nx = tx + DIRS[d][0], ny = ty + DIRS[d][1], v = (nx - ox) * (nx - ox) + (ny - oy) * (ny - oy);
          if (v < mejor) { mejor = v; g.dir = d; }
        }
      }
    }
    avanza(E, g);
  }

  /* ¿Se tocan? Lo que pasa depende del fantasma. Devuelve true si el
     jugador murió (el tic termina ahí). */
  function choque(E) {
    const p = E.pac;
    for (const g of E.fantasmas) {
      let dx = Math.abs(g.x - p.x);
      dx = Math.min(dx, E.mapa.ancho * U - dx);
      if (dx >= 6 || Math.abs(g.y - p.y) >= 6) continue;
      if (g.estado === 'miedo') {
        const v = 200 * Math.pow(2, Math.min(4, E.comidos));
        E.comidos++; E.fantasmasComidos++;
        suma(E, v);
        g.estado = 'ojos'; g.comido = true;
        E.congelado = 24;
        E.ev.push({ k: 'come', v, x: g.x, y: g.y, id: g.id });
      } else if (g.estado === 'caza' || g.estado === 'disperso' || g.estado === 'sale') {
        E.vidas--; E.estado = 'muere'; E.congelado = 100; E.turboT = 0; E.racha = 0; E.rachaT = 0;
        E.ev.push({ k: 'muere', id: g.id });
        return true;
      }
    }
    return false;
  }

  const tiempoMs = E => Math.max(1, Math.round(E.tick * 1000 / TPS));

  /* Rehace una partida: `jugadas` = [[Δtics, código, origen], …] desde el
     tic 0, y `n` el tic en que terminó. Devuelve {E} o {error}. `mira(E, j)`,
     si viene, ve el estado justo antes de cada jugada (el verificador mira
     ahí cómo se jugó). */
  function rehace(semilla, uid, jugadas, n, mira, v) {
    if (!Array.isArray(jugadas)) return { error: 'Las jugadas de la prueba no se pueden leer.' };
    if (!Number.isSafeInteger(n) || n < 1 || n > MAX_TICS) return { error: 'La duración de la prueba no es válida.' };
    if (v != null && !PRUEBA_VERSIONES.includes(v)) return { error: 'La prueba es de otra versión de PRO PACMAN (recarga la página).' };
    const E = nueva(semilla, uid, v);
    let t = 0;
    for (const j of jugadas) {
      if (!Array.isArray(j) || !Number.isSafeInteger(j[0]) || j[0] < 0 || !Number.isSafeInteger(j[1]) || j[1] < 0 || j[1] > 5)
        return { error: 'Una jugada de la prueba no tiene la forma esperada.' };
      t += j[0];
      if (t > n) return { error: 'Hay jugadas después del final de la partida.' };
      while (E.tick < t) { if (E.estado === 'fin') return { error: 'Hay jugadas después del final de la partida.' }; paso(E); E.ev.length = 0; }
      if (mira) mira(E, j);
      entrada(E, j[1]);
    }
    while (E.tick < n && E.estado !== 'fin') { paso(E); E.ev.length = 0; }
    return { E };
  }

  /* La prueba lleva las jugadas en texto: «origen código Δtics(base 36)»
     separadas por comas, p. ej. `k3c,t012`. Origen: k teclado, t toque,
     r ratón, m mando, x sintético. */
  function codifica(jugadas) {
    return jugadas.map(([d, c, o]) => (o || 'x') + c + d.toString(36)).join(',');
  }
  function decodifica(f) {
    if (typeof f !== 'string' || f.length > 190000) return null;
    if (!f) return [];
    const out = [];
    for (const p of f.split(',')) {
      const m = /^([rtkmx])([0-5])([0-9a-z]{1,6})$/.exec(p);
      if (!m) return null;
      out.push([parseInt(m[3], 36), +m[2], m[1]]);
    }
    return out;
  }

  const api = { U, C, TPS, DIRS, OPUESTA, PARED, LIBRE, PUERTA, CASA, TUNEL, COMPUERTA, MAPAS, MODOS, PRUEBA_V, PRUEBA_VERSIONES,
    RACHA_TICS, RACHA_MAX, TURBO_COSTO, TURBO_TICS, PULSO_RADIO, PULSO_TICS, PULSOS_MAX, COMPUERTA_TICS, AVISO_TICS,
    GLITCH_CADA, ITEM_TICS, VIDAS, VIDAS_MAX, MAX_TICS,
    leeMapa, nueva, entrada, paso, rehace, codifica, decodifica, abiertas, enCentro, elroy, objetivo, avisoCompuertas, tipoEn, libre, multiplicador, valorChip, miedoNivel, tiempoMs, casilla, centro };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PropacMotor = api;
})(this);
