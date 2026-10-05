/* Boxhead — los datos del juego: armas y cuándo se ganan, mejoras,
   enemigos, aspectos y mapas. Puro (UMD en `BoxheadDatos`), así que corre en
   Node y los tests lo recorren sin navegador.

   **Las armas se ganan con el multiplicador**, como en el original: cada
   baja sube el multiplicador en uno y rellena la barra de combo; la barra se
   vacía sola y, cada vez que llega a cero, el multiplicador baja uno y la
   barra se rellena a medias (`bajadaCombo`), hasta volver a ×1. Lo que se
   desbloquea no se pierde: cuenta el multiplicador más alto alcanzado.
   En el modo versus se empieza con todo.

   Los ids de arma no se renumeran: viajan en los golpes de la malla. */
(function (raiz, fab) {
  if (typeof module === 'object' && module.exports) module.exports = fab();
  else raiz.BoxheadDatos = fab();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TS = 32;

  /* d: daño por impacto · cad: segundos entre disparos · ini: munición al
     ganarla · caja: lo que da una caja de munición · max: tope · alc:
     alcance de la bala · r: radio de explosión · tipo: cómo dispara. */
  const ARMAS = [
    { id: 0, nombre: 'Pistola', tipo: 'bala', d: 12, cad: 0.32, ini: Infinity, caja: 0, max: Infinity, alc: 360, desbloquea: 1 },
    { id: 1, nombre: 'Uzi', tipo: 'bala', d: 9, cad: 0.08, ini: 150, caja: 100, max: 400, alc: 340, desv: 0.06, desbloquea: 5 },
    { id: 2, nombre: 'Escopeta', tipo: 'perdigon', d: 9, cad: 0.75, ini: 25, caja: 15, max: 60, alc: 220, perdigones: 7, abre: 0.42, desbloquea: 10 },
    { id: 3, nombre: 'Barriles', tipo: 'objeto', obj: 'barril', d: 120, r: 84, cad: 0.4, ini: 5, caja: 3, max: 15, desbloquea: 15 },
    { id: 4, nombre: 'Granadas', tipo: 'granada', d: 90, r: 70, cad: 0.6, ini: 10, caja: 5, max: 30, desbloquea: 20 },
    { id: 5, nombre: 'Muro falso', tipo: 'objeto', obj: 'muro', vida: 160, cad: 0.35, ini: 10, caja: 5, max: 30, desbloquea: 25 },
    { id: 6, nombre: 'Cohetes', tipo: 'cohete', d: 110, r: 72, cad: 0.9, ini: 10, caja: 5, max: 30, vel: 380, desbloquea: 30 },
    { id: 7, nombre: 'Cargas', tipo: 'objeto', obj: 'carga', d: 150, r: 96, cad: 0.35, ini: 5, caja: 3, max: 15, desbloquea: 40 }
  ];

  /* **Cada nivel de multiplicador que no trae arma trae una mejora**, y van
     rotando entre las armas ya ganadas (en orden de id, la última recién
     ganada entra en la rueda sola). Cada arma tiene su lista de mejoras
     (`PASOS`), que recorre en ciclo: más daño, más cadencia, más
     perdigones o más dispersión en la escopeta, explosiones mayores…
     Son multiplicativas y acumulativas, con un tope por estadística; una
     que ya llegó al tope se salta, y un arma con todo al tope sale de la
     rueda. Cada mejora guarda el valor *absoluto* que deja, así `arma()`
     solo tiene que aplicarlas en orden. Se generan una vez, al cargar:
     todos los navegadores sacan la misma lista. */
  const PASOS = {
    0: [['d', 1.15, 'más daño'], ['cad', 0.88, 'disparo más rápido'], ['alc', 1.1, 'más alcance']],
    1: [['d', 1.12, 'más daño'], ['cad', 0.9, 'más cadencia'], ['desv', 0.8, 'más precisión'], ['max', 1.25, 'más munición']],
    2: [['d', 1.12, 'más daño'], ['perdigones', 1, 'más perdigones'], ['cad', 0.88, 'recarga más rápida'], ['abre', 1.12, 'más dispersión'], ['alc', 1.1, 'más alcance']],
    3: [['r', 1.12, 'explosión mayor'], ['d', 1.15, 'más daño'], ['max', 1.3, 'más munición']],
    4: [['r', 1.1, 'explosión mayor'], ['d', 1.15, 'más daño'], ['cad', 0.88, 'lanzamiento más rápido'], ['max', 1.3, 'más munición']],
    5: [['vida', 1.3, 'muros más resistentes'], ['max', 1.3, 'más munición']],
    6: [['d', 1.15, 'más daño'], ['r', 1.1, 'explosión mayor'], ['cad', 0.88, 'recarga más rápida'], ['vel', 1.15, 'cohetes más rápidos']],
    7: [['d', 1.15, 'más daño'], ['r', 1.1, 'explosión mayor'], ['max', 1.3, 'más munición']]
  };
  /* Topes: cad como mucho baja a un tercio, d hasta ×4 (y 500), r 200… */
  function tope(a, k) {
    const b = ARMAS[a.id];
    switch (k) {
      case 'd': return Math.min(b.d * 4, 500);
      case 'cad': return Math.max(b.cad / 3, 0.04);
      case 'alc': return 640;
      case 'desv': return 0.012;
      case 'perdigones': return 16;
      case 'abre': return 1.1;
      case 'r': return 200;
      case 'vel': return 900;
      case 'max': return b.max * 5;
      case 'vida': return 1200;
    }
    return Infinity;
  }
  const baja = k => k === 'cad' || k === 'desv';
  const MULTI_MEJORAS = 200;
  function generaMejoras() {
    const out = [], est = {}, ciclo = {}, armasEn = new Set(ARMAS.map(a => a.desbloquea));
    for (const a of ARMAS) { est[a.id] = Object.assign({}, a); ciclo[a.id] = 0; }
    let cursor = -1;
    for (let m = 2; m <= MULTI_MEJORAS; m++) {
      if (armasEn.has(m)) continue;
      const libres = ARMAS.filter(a => a.desbloquea < m).map(a => a.id);
      let hecho = false;
      for (let intento = 0; intento < libres.length && !hecho; intento++) {
        const i = libres.find(x => x > cursor);
        const id = i === undefined ? libres[0] : i;
        cursor = id;
        const a = est[id], lista = PASOS[id];
        for (let j = 0; j < lista.length && !hecho; j++) {
          const [k, f, txt] = lista[(ciclo[id] + j) % lista.length];
          const lim = tope(a, k), antes = a[k];
          let v = k === 'perdigones' ? antes + 1 : antes * f;
          v = baja(k) ? Math.max(v, lim) : Math.min(v, lim);
          if (k === 'perdigones' || k === 'max' || k === 'vida' || k === 'd' || k === 'alc' || k === 'vel' || k === 'r') v = Math.round(v);
          else v = Math.round(v * 1000) / 1000;
          if (v === antes) continue;
          ciclo[id] = (ciclo[id] + j + 1) % lista.length;
          a[k] = v;
          const valores = { [k]: v };
          if (k === 'max' && a.caja) { a.caja = Math.round(a.caja * f); valores.caja = a.caja; }
          out.push(Object.assign({ m, id: 'm' + m, arma: id, k, txt: a.nombre + ': ' + txt }, valores));
          hecho = true;
        }
      }
    }
    return out;
  }
  const MEJORAS = generaMejoras();
  const CAMPOS = ['d', 'cad', 'alc', 'desv', 'perdigones', 'abre', 'r', 'vel', 'max', 'caja', 'vida'];

  /* Un arma con las mejoras que ya se tienen aplicadas. */
  function arma(id, mejoras) {
    const base = ARMAS[id];
    if (!base) return null;
    const a = Object.assign({}, base);
    if (mejoras && mejoras.size) for (const m of MEJORAS) if (m.arma === id && mejoras.has(m.id)) {
      for (const k of CAMPOS) if (m[k] !== undefined) a[k] = m[k];
    }
    return a;
  }

  /* Cuántas mejoras tiene cada arma (para el inventario). */
  function nivelArma(id, mejoras) {
    let n = 0;
    if (mejoras) for (const m of MEJORAS) if (m.arma === id && mejoras.has(m.id)) n++;
    return n;
  }

  /* Lo que se gana al llegar a `mul` por primera vez. */
  function premios(antes, ahora) {
    const out = [];
    for (const a of ARMAS) if (a.desbloquea > antes && a.desbloquea <= ahora) out.push({ arma: a.id, txt: '¡Nueva arma! ' + a.nombre });
    for (const m of MEJORAS) if (m.m > antes && m.m <= ahora) out.push({ mejora: m.id, txt: m.txt });
    return out;
  }

  /* El combo: cuánto dura la barra llena con este multiplicador. */
  const duracionCombo = mul => Math.max(1.6, 4 - mul * 0.04);
  /* Al vaciarse, el multiplicador baja uno y la barra vuelve a la mitad. */
  const bajadaCombo = mul => duracionCombo(mul) * 0.5;
  const PUNTOS = [10, 20];   // zombi, diablo (× multiplicador)

  /* ---------- enemigos ---------- */
  const ENEMIGOS = [
    { id: 0, nombre: 'Zombi', vida: 40, vel: 46, golpe: 9, radio: 11 },
    { id: 1, nombre: 'Diablo', vida: 110, vel: 58, golpe: 12, radio: 12, fuego: 14, cadFuego: 2.6, alcFuego: 320 }
  ];
  const vidaEnemigo = (k, n) => Math.round(ENEMIGOS[k].vida * (1 + 0.1 * (n - 1)));
  const velEnemigo = (k, n) => Math.min(ENEMIGOS[k].vel + 1.6 * (n - 1), k ? 88 : 80);
  /* Cuántos trae el nivel n y qué parte son diablos (desde el 3). */
  const totalNivel = n => Math.min(14 + 6 * (n - 1), 160);
  const parteDiablos = n => n < 3 ? 0 : Math.min(0.45, 0.08 * (n - 2));
  /* Cuántos caben a la vez, para que el nivel 20 no sea una alfombra. */
  const maxVivos = (n, jug) => Math.min(14 + 3 * jug + 2 * n, 60);
  const ritmoNivel = n => Math.max(0.22, 1.1 - 0.06 * (n - 1));

  /* ---------- aspectos ---------- */
  const SKINS = [
    { id: 'bambo', nombre: 'Bambo', piel: '#f2d2a9', camisa: '#f4f4f4', pantalon: '#3b5b9c', pelo: '#4a2e1b', extra: 'pelo' },
    { id: 'jon', nombre: 'Jon', piel: '#e9c08e', camisa: '#2f6fd6', pantalon: '#2b2b2b', pelo: '#1b1b1b', extra: 'pelo' },
    { id: 'soldado', nombre: 'Soldado', piel: '#d9b083', camisa: '#4f6b32', pantalon: '#3a4a26', pelo: '#3f5528', extra: 'casco' },
    { id: 'medico', nombre: 'Médico', piel: '#f0cfa8', camisa: '#e9f1f1', pantalon: '#6cb6b0', pelo: '#7a4a24', extra: 'gorro' },
    { id: 'ninja', nombre: 'Ninja', piel: '#e6c39a', camisa: '#1d1d24', pantalon: '#1d1d24', pelo: '#1d1d24', extra: 'mascara' },
    { id: 'policia', nombre: 'Policía', piel: '#c99a6c', camisa: '#21386b', pantalon: '#18264a', pelo: '#111', extra: 'gorra' },
    { id: 'payaso', nombre: 'Payaso', piel: '#fafafa', camisa: '#e23b3b', pantalon: '#f3c623', pelo: '#ff7a00', extra: 'nariz' },
    { id: 'robot', nombre: 'Robot', piel: '#b8c2cc', camisa: '#7d8a96', pantalon: '#55606b', pelo: '#e33', extra: 'antena' }
  ];
  const skin = id => SKINS.find(s => s.id === id) || SKINS[0];

  /* ---------- mapas ----------
     `#` muro, `.` suelo, `c` caja fija (también sólida, más baja), `S` por
     donde entran los enemigos, `P` donde aparecen los jugadores. Las filas
     se rellenan con muro hasta la más larga y el borde siempre es muro. */
  const MAPAS = {
    patio: {
      nombre: 'Patio', suelo: ['#bfb79b', '#b3ab8e'], muro: ['#8c8c8c', '#6b6b6b', '#5a5a5a'],
      filas: [
        '################################',
        '#S............SS..............S#',
        '#..............................#',
        '#...####..............####.....#',
        '#...#.........cc.........#.....#',
        '#...#....................#.....#',
        '#..............................#',
        '#.........#####..#####.........#',
        '#.........#..........#.........#',
        '#..cc.....#..........#.....cc..#',
        'S.........#...P..P...#.........S',
        'S.........#...P..P...#.........S',
        '#..cc.....#..........#.....cc..#',
        '#.........#..........#.........#',
        '#.........#####..#####.........#',
        '#..............................#',
        '#...#....................#.....#',
        '#...#.........cc.........#.....#',
        '#...####..............####.....#',
        '#..............................#',
        '#S............SS..............S#',
        '################################'
      ]
    },
    sotano: {
      nombre: 'Sótano', suelo: ['#8d8478', '#847b70'], muro: ['#7a5a43', '#5c4332', '#4a3528'],
      filas: [
        '##################################',
        '#S.......#...........#..........S#',
        '#........#...........#...........#',
        '#........#....c.c....#...........#',
        '#..............................cc#',
        '#........#...........#...........#',
        '####.#####...........#####.#######',
        '#........#....#.#....#...........#',
        '#..cc....#...........#.....cc....#',
        'S...........P.....P..............S',
        'S...........P.....P..............S',
        '#..cc....#...........#.....cc....#',
        '#........#....#.#....#...........#',
        '####.#####...........#####.#######',
        '#........#...........#...........#',
        '#cc..............................#',
        '#........#....c.c....#...........#',
        '#........#...........#...........#',
        '#S.......#...........#..........S#',
        '##################################'
      ]
    },
    cruce: {
      nombre: 'Cruce', suelo: ['#7d7d7d', '#737373'], muro: ['#a35a43', '#7d4231', '#653426'],
      filas: [
        '##############SS##############',
        '#.........#........#.........#',
        '#..####...#........#...####..#',
        '#..####...#...cc...#...####..#',
        '#..####......................#',
        '#.........#........#.........#',
        '####..#####........#####..####',
        'S............P..P............S',
        'S............P..P............S',
        '####..#####........#####..####',
        '#.........#........#.........#',
        '#..####......................#',
        '#..####...#...cc...#...####..#',
        '#..####...#........#...####..#',
        '#.........#........#.........#',
        '##############SS##############'
      ]
    },
    fortaleza: {
      nombre: 'Fortaleza', suelo: ['#a7b48c', '#9caa80'], muro: ['#9a9a88', '#76766a', '#5f5f55'],
      filas: [
        '####################################',
        '#S................................S#',
        '#..................................#',
        '#....############....##########....#',
        '#....#..........#....#........#....#',
        '#....#..cc..........P....cc...#....#',
        '#....#..........#....#........#....#',
        '#....####..######....####..####....#',
        '#..................................#',
        'S.................PP...............S',
        'S.................PP...............S',
        '#..................................#',
        '#....####..######....####..####....#',
        '#....#..........#....#........#....#',
        '#....#..cc..........P....cc...#....#',
        '#....#..........#....#........#....#',
        '#....############....##########....#',
        '#..................................#',
        '#S................................S#',
        '####################################'
      ]
    },
    laberinto: {
      nombre: 'Laberinto', suelo: ['#9fb0bf', '#94a5b4'], muro: ['#5d6d7e', '#465464', '#37424f'],
      filas: [
        '################################',
        '#S.....#.........#............S#',
        '#......#...###...#....####.....#',
        '#..##......#.........#.........#',
        '#..#.......#....cc...#....##...#',
        '#..#...#####.........#.....#...#',
        '#......#.......####........#...#',
        '###..###..P.P..#.......#####...#',
        'S.........P.P..#...............S',
        '#....cc........#.......cc......#',
        '#........####......####........#',
        '#..............#...............#',
        'S......#####...#....P.P...#....S',
        '#..........#...#....P.P...#....#',
        '#...##.....#..........#####....#',
        '#....#.........cc..............#',
        '#S...#.....####........#......S#',
        '################################'
      ]
    }
  };
  const ORDEN_MAPAS = ['patio', 'sotano', 'cruce', 'fortaleza', 'laberinto'];
  const mapaValido = m => (MAPAS[m] ? m : 'patio');

  /* El mapa listo para jugar: rejilla de sólidos y los puntos marcados. */
  function cargaMapa(id) {
    const M = MAPAS[mapaValido(id)];
    const ancho = Math.max(...M.filas.map(f => f.length)), alto = M.filas.length;
    const celdas = [], spawnsE = [], spawnsP = [];
    for (let y = 0; y < alto; y++) {
      const fila = M.filas[y].padEnd(ancho, '#');
      for (let x = 0; x < ancho; x++) {
        let c = fila[x];
        const borde = x === 0 || y === 0 || x === ancho - 1 || y === alto - 1;
        if (c === 'S') spawnsE.push({ x: x * TS + TS / 2, y: y * TS + TS / 2, tx: x, ty: y });
        if (c === 'P') spawnsP.push({ x: x * TS + TS / 2, y: y * TS + TS / 2 });
        if (borde && c !== 'S') c = '#';
        celdas.push(c === '#' ? 1 : c === 'c' ? 2 : 0);
      }
    }
    return { id: mapaValido(id), nombre: M.nombre, suelo: M.suelo, muro: M.muro, ancho, alto, celdas, spawnsE, spawnsP };
  }

  /* Las 8 direcciones, como en el original: 0 = este y en sentido horario. */
  const DIRS = [];
  for (let i = 0; i < 8; i++) DIRS.push([Math.round(Math.cos(i * Math.PI / 4) * 1e6) / 1e6, Math.round(Math.sin(i * Math.PI / 4) * 1e6) / 1e6]);
  const dirDe = (dx, dy) => (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;

  return {
    TS, ARMAS, MEJORAS, PASOS, arma, nivelArma, premios, duracionCombo, bajadaCombo, PUNTOS, ENEMIGOS, vidaEnemigo, velEnemigo,
    totalNivel, parteDiablos, maxVivos, ritmoNivel, SKINS, skin, MAPAS, ORDEN_MAPAS, mapaValido,
    cargaMapa, DIRS, dirDe
  };
});
