/* Boxhead — los datos del juego: armas y cuándo se ganan, mejoras,
   enemigos, aspectos y mapas. Puro (UMD en `BoxheadDatos`), así que corre en
   Node y los tests lo recorren sin navegador.

   **Las armas se ganan con el multiplicador**, como en el original: cada
   baja sube el multiplicador en uno y rellena la barra de combo; la barra se
   vacía sola y, si llega a cero, el multiplicador vuelve a ×1. Lo que se
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
    { id: 5, nombre: 'Muro falso', tipo: 'objeto', obj: 'muro', cad: 0.35, ini: 10, caja: 5, max: 30, desbloquea: 25 },
    { id: 6, nombre: 'Cohetes', tipo: 'cohete', d: 110, r: 72, cad: 0.9, ini: 10, caja: 5, max: 30, vel: 380, desbloquea: 30 },
    { id: 7, nombre: 'Cargas', tipo: 'objeto', obj: 'carga', d: 150, r: 96, cad: 0.35, ini: 5, caja: 3, max: 15, desbloquea: 40 }
  ];

  /* Las mejoras caen entre arma y arma: el multiplicador siempre promete algo. */
  const MEJORAS = [
    { m: 8, id: 'pistola-rapida', arma: 0, txt: 'Pistola: disparo rápido', cad: 0.18 },
    { m: 12, id: 'uzi-cargador', arma: 1, txt: 'Uzi: más munición', max: 800, caja: 200 },
    { m: 18, id: 'escopeta-ancha', arma: 2, txt: 'Escopeta: más perdigones', perdigones: 11 },
    { m: 22, id: 'uzi-perfora', arma: 1, txt: 'Uzi: balas más fuertes', d: 14 },
    { m: 28, id: 'barril-grande', arma: 3, txt: 'Barriles: explosión mayor', r: 110 },
    { m: 35, id: 'granada-grande', arma: 4, txt: 'Granadas: explosión mayor', r: 96 },
    { m: 45, id: 'cohete-rapido', arma: 6, txt: 'Cohetes: recarga rápida', cad: 0.45 },
    { m: 50, id: 'escopeta-rapida', arma: 2, txt: 'Escopeta: recarga rápida', cad: 0.45 },
    { m: 60, id: 'carga-grande', arma: 7, txt: 'Cargas: explosión mayor', r: 130 }
  ];

  /* Un arma con las mejoras que ya se tienen aplicadas. */
  function arma(id, mejoras) {
    const base = ARMAS[id];
    if (!base) return null;
    const a = Object.assign({}, base);
    for (const m of MEJORAS) if (m.arma === id && mejoras && mejoras.has(m.id)) {
      for (const k of ['cad', 'max', 'caja', 'perdigones', 'd', 'r']) if (m[k] !== undefined) a[k] = m[k];
    }
    return a;
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
    TS, ARMAS, MEJORAS, arma, premios, duracionCombo, PUNTOS, ENEMIGOS, vidaEnemigo, velEnemigo,
    totalNivel, parteDiablos, maxVivos, ritmoNivel, SKINS, skin, MAPAS, ORDEN_MAPAS, mapaValido,
    cargaMapa, DIRS, dirDe
  };
});
