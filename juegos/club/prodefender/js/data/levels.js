// =====================================================================
//  PRO DEFENDER — Mapas y generación de las 100 rondas de cada nivel
//  Mundo lógico: 1000 x 640. Un punto con tercer valor 1 = portal (salto).
// =====================================================================
(function () {
  const PD = (globalThis.PD = globalThis.PD || {});
  PD.W = 1000; PD.H = 640;
  PD.UNLOCK_ROUND = 50;   // completar esta ronda desbloquea el siguiente nivel
  PD.MAX_ROUND = 100;

  PD.LEVELS = [
    {
      name: 'Prado Esmeralda', short: 'Prado',
      subtitle: 'Colinas verdes donde despierta el enjambre.',
      diff: 1.0, lives: 150, cash: 650, seed: 1013, stars: 1,
      theme: { bg1: '#3e8f3a', bg2: '#2f7a33', path: '#c9a86a', pathEdge: '#8f7140', deco: 'grass', accent: '#9be36a' },
      paths: [[[-30, 110], [230, 110], [230, 310], [100, 310], [100, 530], [430, 530], [430, 190], [650, 190], [650, 460], [870, 460], [870, 120], [1030, 120]]],
      obstacles: [{ x: 540, y: 330, r: 48, kind: 'lake' }, { x: 300, y: 420, r: 26, kind: 'rock' }, { x: 760, y: 300, r: 22, kind: 'rock' }, { x: 950, y: 560, r: 40, kind: 'lake' }],
      boss: 'reyEscarabajo',
      pool: [['brote', 1, 1], ['veloz', 3, 1], ['robusto', 5, 1], ['musgo', 7, 1.2], ['alado', 8, 1], ['escudero', 9, 1], ['enjambre', 10, 1.2],
        ['sombra', 12, 1], ['chaman', 14, 1.2], ['blindado', 15, 1], ['divisor', 18, 1], ['portador', 30, 0.8], ['zepelin', 38, 0.8], ['titan', 56, 0.7],
        ['fortaleza', 66, 0.8], ['dirigible', 70, 0.8], ['ciudadela', 82, 0.8], ['celeste', 85, 0.8], ['leviatan', 94, 0.9], ['arca', 96, 0.9]]
    },
    {
      name: 'Dunas de Ámbar', short: 'Dunas',
      subtitle: 'Bajo la arena acecha algo enorme.',
      diff: 1.12, lives: 130, cash: 650, seed: 2027, stars: 2,
      theme: { bg1: '#d9b26a', bg2: '#c99a52', path: '#9c6b3b', pathEdge: '#6e4825', deco: 'sand', accent: '#ffd38a' },
      paths: [[[-30, 560], [160, 560], [160, 120], [340, 120], [340, 520], [520, 520], [520, 120], [700, 120], [700, 520], [860, 520], [860, 300], [1030, 300]]],
      obstacles: [{ x: 430, y: 320, r: 40, kind: 'oasis' }, { x: 610, y: 330, r: 30, kind: 'rock' }, { x: 940, y: 120, r: 46, kind: 'oasis' }, { x: 60, y: 300, r: 28, kind: 'rock' }],
      boss: 'gusano',
      pool: [['brote', 1, 1], ['veloz', 2, 1], ['robusto', 4, 1], ['excavador', 6, 1.3], ['alado', 7, 1], ['escudero', 9, 1], ['escorpion', 11, 1.3],
        ['sombra', 12, 1], ['blindado', 14, 1], ['espejismo', 17, 1.3], ['divisor', 18, 1], ['musgo', 21, 0.8], ['enjambre', 22, 0.8], ['chaman', 25, 0.8],
        ['portador', 27, 0.8], ['zepelin', 36, 0.8], ['titan', 54, 0.7],
        ['fortaleza', 64, 0.8], ['dirigible', 68, 0.8], ['ciudadela', 80, 0.8], ['celeste', 83, 0.8], ['leviatan', 93, 0.9], ['arca', 95, 0.9]]
    },
    {
      name: 'Glaciar Cristal', short: 'Glaciar',
      subtitle: 'El hielo eterno guarda criaturas que el frío no detiene.',
      diff: 1.25, lives: 110, cash: 700, seed: 3041, stars: 3,
      theme: { bg1: '#cfe8f7', bg2: '#a9d2ee', path: '#6f93b5', pathEdge: '#47698c', deco: 'ice', accent: '#ffffff' },
      paths: [[[-30, 330], [780, 330], [780, 90], [570, 90], [570, 580], [300, 580], [300, 160], [120, 160], [120, -30]]],
      obstacles: [{ x: 430, y: 200, r: 42, kind: 'ice' }, { x: 900, y: 500, r: 50, kind: 'ice' }, { x: 160, y: 500, r: 36, kind: 'ice' }, { x: 680, y: 450, r: 24, kind: 'rock' }],
      boss: 'coloso',
      pool: [['brote', 1, 1], ['veloz', 2, 1], ['robusto', 4, 1], ['cristal', 5, 1.3], ['alado', 7, 1], ['escudero', 8, 1], ['golem', 10, 1.3],
        ['sombra', 11, 1], ['blindado', 12, 1], ['yeti', 15, 1.3], ['divisor', 17, 1], ['excavador', 20, 0.8], ['escorpion', 23, 0.8], ['portador', 25, 0.8],
        ['musgo', 26, 0.7], ['espejismo', 28, 0.8], ['chaman', 33, 0.7], ['zepelin', 35, 0.8], ['titan', 52, 0.7],
        ['fortaleza', 62, 0.8], ['dirigible', 66, 0.8], ['ciudadela', 78, 0.8], ['celeste', 82, 0.8], ['leviatan', 92, 0.9], ['arca', 94, 0.9]]
    },
    {
      name: 'Caldera Volcánica', short: 'Caldera',
      subtitle: 'Dos ríos de lava, dos caminos, cero descanso.',
      diff: 1.4, lives: 90, cash: 750, seed: 4057, stars: 4,
      theme: { bg1: '#4a2a24', bg2: '#38201c', path: '#7a5a4a', pathEdge: '#2a1712', deco: 'lava', accent: '#ff7a2f' },
      paths: [
        [[-30, 130], [260, 130], [260, 320], [700, 320], [700, 520], [1030, 520]],
        [[-30, 560], [200, 560], [200, 440], [480, 440], [480, 320], [700, 320], [700, 520], [1030, 520]]
      ],
      obstacles: [{ x: 500, y: 150, r: 55, kind: 'lava' }, { x: 870, y: 260, r: 50, kind: 'lava' }, { x: 380, y: 580, r: 32, kind: 'lava' }, { x: 100, y: 330, r: 28, kind: 'rock' }],
      boss: 'fenix',
      pool: [['brote', 1, 1], ['veloz', 2, 1], ['salamandra', 4, 1.3], ['robusto', 5, 1], ['alado', 6, 1], ['ave', 7, 1.3], ['escudero', 8, 1],
        ['magma', 9, 1.3], ['sombra', 10, 1], ['blindado', 12, 1], ['heraldo', 14, 1.3], ['divisor', 16, 1], ['golem', 20, 0.8], ['cristal', 22, 0.8],
        ['portador', 24, 0.8], ['excavador', 25, 0.7], ['yeti', 27, 0.7], ['escorpion', 30, 0.7], ['chaman', 33, 0.7], ['enjambre', 35, 0.7], ['zepelin', 33, 0.8], ['titan', 50, 0.7],
        ['fortaleza', 60, 0.8], ['dirigible', 64, 0.8], ['ciudadela', 76, 0.8], ['celeste', 80, 0.8], ['leviatan', 91, 0.9], ['arca', 93, 0.9]]
    },
    {
      name: 'Nexo del Vacío', short: 'Vacío',
      subtitle: 'La realidad se pliega. Los portales no perdonan.',
      diff: 1.42, lives: 100, cash: 850, seed: 5081, stars: 5,
      theme: { bg1: '#1b1430', bg2: '#120d22', path: '#3b2d63', pathEdge: '#8a6bff', deco: 'void', accent: '#c9a7ff' },
      paths: [
        [[-30, 160], [320, 160], [320, 470], [470, 470], [600, 140, 1], [880, 140], [880, 500], [1030, 500]],
        [[-30, 560], [150, 560], [150, 300], [470, 300], [600, 330, 1], [880, 330], [880, 500], [1030, 500]]
      ],
      obstacles: [{ x: 720, y: 420, r: 40, kind: 'rift' }, { x: 220, y: 420, r: 30, kind: 'rift' }, { x: 470, y: 600, r: 26, kind: 'rift' }, { x: 960, y: 260, r: 30, kind: 'rift' }],
      boss: 'devorador',
      pool: [['brote', 1, 1], ['veloz', 2, 1], ['robusto', 3, 1], ['espectro', 5, 1.3], ['alado', 6, 1], ['escudero', 8, 1], ['fractal', 10, 1.3],
        ['sombra', 11, 1], ['magnetita', 13, 1.3], ['blindado', 14, 1], ['saboteador', 18, 1.3], ['divisor', 20, 1], ['salamandra', 22, 0.8],
        ['cristal', 24, 0.8], ['excavador', 26, 0.7], ['portador', 27, 0.8], ['heraldo', 28, 0.8], ['golem', 30, 0.7], ['espejismo', 32, 0.7],
        ['magma', 34, 0.7], ['yeti', 36, 0.7], ['chaman', 38, 0.7], ['ave', 40, 0.7], ['zepelin', 32, 0.8], ['titan', 54, 0.7], ['fortaleza', 58, 0.8], ['dirigible', 62, 0.8],
        ['colosoVacio', 70, 0.7], ['ciudadela', 75, 0.8], ['celeste', 78, 0.8], ['leviatan', 90, 0.9], ['arca', 92, 0.9]]
    },

    // ======================= SEGUNDA ERA: reinos 6–10 ========================
    // `abre`: el día de Chile en que se abre a todos, uno por día (PD.abierto). Antes
    // de ese día solo lo juegan los administradores de Juegos (main.js: puedeJugar),
    // el resto lo ve como «Próximamente», y no guarda récords ni paga monedas. Ya
    // abierto se juega sin pasar por la ronda 50 del anterior, con su tabla y sus
    // monedas (100 por ronda, como el Vacío).
    // `torres`: lo que vende la tienda (además del héroe del reino), cada vez menos de
    // las clásicas. `musica`: qué tema de audio.js suena (los cinco primeros).
    // Mapas más difíciles: caminos más cortos, varias entradas, cruces y portales.
    {
      name: 'Pantano Sombrío', short: 'Pantano', abre: '2026-10-22', musica: 0,
      subtitle: 'Dos caminos que se cruzan entre la niebla. Algo se mueve bajo el agua.',
      diff: 1.7, lives: 100, cash: 850, seed: 6091, stars: 5,
      theme: { bg1: '#2f4a32', bg2: '#243a28', path: '#6a5a3a', pathEdge: '#2a2418', deco: 'swamp', accent: '#c8ff5a' },
      paths: [
        [[-30, 130], [420, 130], [420, 520], [760, 520], [760, 250], [1030, 250]],
        [[-30, 510], [250, 510], [250, 300], [600, 300], [600, 90], [860, 90], [860, 420], [1030, 420]]
      ],
      obstacles: [{ x: 120, y: 330, r: 42, kind: 'bog' }, { x: 560, y: 430, r: 34, kind: 'bog' }, { x: 940, y: 560, r: 40, kind: 'bog' }, { x: 700, y: 180, r: 26, kind: 'rock' }],
      torres: ['espinas', 'escarcha', 'vigia', 'voltaico', 'mortero', 'dragon', 'prisma', 'totem', 'huerto', 'bumeran', 'acido', 'faro', 'balista', 'geiser', 'obelisco', 'bruja'],
      boss: 'hidra',
      pool: [['brote', 1, 1], ['veloz', 2, 1], ['robusto', 3, 1], ['sapo', 4, 1.3], ['alado', 6, 1], ['escudero', 7, 1], ['duende', 8, 1.3],
        ['sombra', 10, 1], ['bruma', 12, 1.2], ['blindado', 13, 1], ['divisor', 15, 1], ['musgo', 17, 0.8], ['chaman', 19, 0.8], ['escorpion', 22, 0.7],
        ['espejismo', 24, 0.7], ['portador', 26, 0.8], ['zepelin', 32, 0.8], ['titan', 50, 0.7], ['fortaleza', 58, 0.8], ['dirigible', 62, 0.8],
        ['ciudadela', 74, 0.8], ['celeste', 78, 0.8], ['leviatan', 89, 0.9], ['arca', 91, 0.9]]
    },
    {
      name: 'Cumbres Tormentosas', short: 'Cumbres', abre: '2026-10-23', musica: 2,
      subtitle: 'Los rayos caen sobre tus mejores torres. El cielo no está de tu lado.',
      diff: 1.9, lives: 90, cash: 900, seed: 7103, stars: 5,
      theme: { bg1: '#5a6478', bg2: '#454e60', path: '#8a8a92', pathEdge: '#2e323c', deco: 'storm', accent: '#ffe14d' },
      paths: [
        [[120, -30], [120, 250], [400, 250], [400, 90], [650, 90], [650, 400], [300, 400], [300, 560], [1030, 560]],
        [[880, -30], [880, 240], [650, 240], [650, 400], [300, 400], [300, 560], [1030, 560]]
      ],
      obstacles: [{ x: 520, y: 330, r: 38, kind: 'rock' }, { x: 160, y: 470, r: 44, kind: 'cloud' }, { x: 830, y: 400, r: 46, kind: 'cloud' }, { x: 260, y: 120, r: 26, kind: 'rock' }],
      torres: ['espinas', 'vigia', 'voltaico', 'mortero', 'dragon', 'prisma', 'totem', 'huerto', 'acido', 'faro', 'balista', 'obelisco', 'bruja', 'pararrayos'],
      boss: 'reyTrueno',
      pool: [['brote', 1, 1], ['veloz', 2, 1], ['alado', 3, 1], ['robusto', 4, 1], ['gargola', 5, 1.3], ['escudero', 7, 1], ['tormentoso', 8, 1.3],
        ['enjambre', 10, 0.9], ['sombra', 11, 1], ['blindado', 13, 1], ['ave', 15, 0.8], ['divisor', 16, 1], ['golem', 18, 0.7], ['sapo', 20, 0.7],
        ['heraldo', 22, 0.7], ['cristal', 24, 0.7], ['portador', 26, 0.8], ['zepelin', 30, 0.9], ['duende', 34, 0.6], ['titan', 50, 0.7],
        ['fortaleza', 58, 0.8], ['dirigible', 60, 0.9], ['ciudadela', 74, 0.8], ['celeste', 76, 0.9], ['leviatan', 89, 0.9], ['arca', 90, 0.9]]
    },
    {
      name: 'Fosa Abisal', short: 'Fosa', abre: '2026-10-24', musica: 4,
      subtitle: 'Remolinos que tragan y escupen. En la oscuridad, la tinta ciega.',
      diff: 2.2, lives: 90, cash: 900, seed: 8117, stars: 5,
      theme: { bg1: '#0f3a52', bg2: '#0a2a3e', path: '#3a6a7a', pathEdge: '#0a1a24', deco: 'abyss', accent: '#6fd8ff' },
      paths: [
        [[-30, 110], [320, 110], [320, 320], [140, 320], [140, 540], [430, 540], [620, 140, 1], [900, 140], [900, 420], [1030, 420]],
        [[520, -30], [520, 250], [760, 250], [760, 560], [580, 560], [900, 300, 1], [900, 420], [1030, 420]]
      ],
      obstacles: [{ x: 640, y: 420, r: 36, kind: 'coral' }, { x: 240, y: 430, r: 30, kind: 'coral' }, { x: 960, y: 580, r: 34, kind: 'coral' }, { x: 420, y: 230, r: 30, kind: 'rock' }],
      torres: ['espinas', 'escarcha', 'vigia', 'mortero', 'prisma', 'totem', 'huerto', 'sierra', 'balista', 'geiser', 'forja', 'pararrayos', 'burbujas'],
      boss: 'kraken',
      pool: [['brote', 1, 1], ['veloz', 2, 1], ['robusto', 3, 1], ['cangrejo', 5, 1.3], ['alado', 6, 1], ['escudero', 7, 1], ['pulpo', 9, 1.3],
        ['sombra', 10, 1], ['blindado', 12, 1], ['magnetita', 14, 0.8], ['divisor', 15, 1], ['excavador', 17, 0.8], ['espectro', 19, 0.7],
        ['salamandra', 21, 0.7], ['bruma', 23, 0.7], ['gargola', 25, 0.7], ['portador', 27, 0.8], ['zepelin', 32, 0.8], ['titan', 50, 0.7],
        ['fortaleza', 58, 0.8], ['dirigible', 62, 0.8], ['ciudadela', 74, 0.8], ['celeste', 78, 0.8], ['leviatan', 89, 0.9], ['arca', 91, 0.9]]
    },
    {
      name: 'Ciudadela de Engranajes', short: 'Engranajes', abre: '2026-10-25', musica: 3,
      subtitle: 'Tres puertas, una sola salida. Las máquinas aprenden de cada golpe.',
      diff: 2.45, lives: 80, cash: 950, seed: 9127, stars: 5,
      theme: { bg1: '#4a3f36', bg2: '#3a3029', path: '#7a6a5a', pathEdge: '#2a221a', deco: 'gear', accent: '#ffb84d' },
      paths: [
        [[-30, 320], [260, 320], [260, 200], [520, 200], [520, 440], [760, 440], [760, 320], [1030, 320]],
        [[400, -30], [400, 90], [640, 90], [640, 200], [520, 200], [520, 440], [760, 440], [760, 320], [1030, 320]],
        [[340, 670], [340, 560], [640, 560], [640, 440], [760, 440], [760, 320], [1030, 320]]
      ],
      obstacles: [{ x: 120, y: 160, r: 40, kind: 'gearpit' }, { x: 900, y: 520, r: 46, kind: 'gearpit' }, { x: 390, y: 330, r: 30, kind: 'gearpit' }, { x: 880, y: 140, r: 30, kind: 'reactor' }],
      torres: ['espinas', 'vigia', 'voltaico', 'mortero', 'dragon', 'prisma', 'huerto', 'acido', 'balista', 'obelisco', 'burbujas', 'desintegrador'],
      boss: 'mecatitan',
      pool: [['brote', 1, 1], ['veloz', 2, 1], ['robusto', 3, 1], ['escudero', 4, 1], ['automata', 5, 1.3], ['alado', 6, 1], ['blindado', 8, 1],
        ['reparador', 9, 1.3], ['sombra', 10, 1], ['saboteador', 13, 0.8], ['magnetita', 15, 0.8], ['divisor', 16, 1], ['cangrejo', 18, 0.8],
        ['tormentoso', 20, 0.7], ['gargola', 22, 0.7], ['pulpo', 24, 0.7], ['portador', 25, 0.8], ['zepelin', 30, 0.8], ['titan', 48, 0.7],
        ['fortaleza', 56, 0.8], ['dirigible', 60, 0.8], ['colosoVacio', 68, 0.6], ['ciudadela', 72, 0.8], ['celeste', 76, 0.8], ['leviatan', 88, 0.9], ['arca', 90, 0.9]]
    },
    {
      name: 'Trono del Eclipse', short: 'Eclipse', abre: '2026-10-26', musica: 4,
      subtitle: 'Tres frentes, un portal y el sol apagándose. El final de todo.',
      diff: 2.25, lives: 80, cash: 1000, seed: 10133, stars: 5,
      theme: { bg1: '#2a1a2e', bg2: '#1c1020', path: '#5a3a4a', pathEdge: '#ffcf4d', deco: 'eclipse', accent: '#ffcf4d' },
      paths: [
        [[-30, 90], [480, 90], [480, 300], [300, 300], [300, 560], [1030, 560]],
        [[1030, 80], [720, 80], [720, 300], [480, 300], [300, 300], [300, 560], [1030, 560]],
        [[-30, 430], [160, 430], [160, 200], [620, 440, 1], [860, 440], [860, 560], [1030, 560]]
      ],
      obstacles: [{ x: 600, y: 190, r: 46, kind: 'altar' }, { x: 120, y: 560, r: 34, kind: 'rift' }, { x: 900, y: 300, r: 40, kind: 'altar' }, { x: 420, y: 440, r: 28, kind: 'shard' }],
      torres: ['espinas', 'vigia', 'mortero', 'prisma', 'totem', 'faro', 'balista', 'obelisco', 'segador', 'desintegrador', 'campanario'],
      boss: 'eclipse',
      pool: [['brote', 1, 1], ['veloz', 2, 1], ['robusto', 3, 1], ['sombra', 4, 1], ['purificador', 5, 1.3], ['alado', 6, 1], ['escudero', 7, 1],
        ['martir', 9, 1.3], ['blindado', 10, 1], ['espectro', 12, 0.9], ['divisor', 13, 1], ['fractal', 15, 0.8], ['automata', 17, 0.8],
        ['reparador', 19, 0.8], ['sapo', 21, 0.7], ['bruma', 23, 0.7], ['cangrejo', 25, 0.7], ['portador', 26, 0.8], ['gargola', 27, 0.7],
        ['pulpo', 29, 0.7], ['zepelin', 31, 0.8], ['titan', 46, 0.7], ['fortaleza', 54, 0.8], ['dirigible', 58, 0.8], ['colosoVacio', 64, 0.7],
        ['ciudadela', 70, 0.8], ['celeste', 74, 0.8], ['leviatan', 86, 0.9], ['arca', 88, 0.9]]
    }
  ];
  // Los reinos de siempre, que se abren uno tras otro con la ronda 50 (los de `abre`
  // vienen después).
  PD.PUBLIC_LEVELS = PD.LEVELS.filter(L => !L.abre).length;
  // El día de Chile (AAAA-MM-DD) de ahora: los reinos nuevos se abren a medianoche de allá.
  PD.diaChile = () => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  };
  // ¿Está abierto a todos el reino li? (los cinco primeros, siempre)
  PD.abierto = (li, dia) => !PD.LEVELS[li].abre || PD.LEVELS[li].abre <= (dia || PD.diaChile());

  // ---------------------- Curvas de dificultad -------------------------
  // Presión temprana más alta: desde las primeras rondas hay que pensar dónde y qué colocar.
  const ANCHORS = [[1, 44], [5, 120], [10, 260], [20, 600], [30, 1150], [40, 1900], [50, 2950], [60, 4700], [70, 7500], [80, 12500], [90, 19500], [100, 30000]];
  PD.budget = function (L, r) {
    let a = ANCHORS[0], b = ANCHORS[ANCHORS.length - 1];
    for (let i = 0; i < ANCHORS.length - 1; i++) {
      if (r >= ANCHORS[i][0] && r <= ANCHORS[i + 1][0]) { a = ANCHORS[i]; b = ANCHORS[i + 1]; break; }
    }
    const t = (r - a[0]) / (b[0] - a[0] || 1);
    // Los reinos difíciles empiezan suaves y endurecen su curva hasta la ronda 50.
    const diff = 1 + (L.diff - 1) * (0.15 + 0.85 * Math.min(1, r / 60));
    return Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * t) * diff * PD.growth(r) * PD.lateEase(r);
  };
  // Desde la 52 el presupuesto baja de a poco (hasta la mitad en la 82): las rondas altas
  // son de tanques y globos blindados, que cuestan más de lo que mide enemyThreat.
  PD.lateEase = function (r) { return 1 - 0.5 * Math.max(0, Math.min(1, (r - 52) / 30)); };
  // Crecimiento de la partida: más enemigos y más oro según avanzan las rondas.
  PD.growth = function (r) { const k = Math.max(0, r - 50); return (1 + 3 * (0.06 * r + 0.0007 * r * r + 0.0016 * k * k)) * PD.lateMult(r); };
  // Las torres al máximo (nivel 4) disparan el daño desde la ronda ~45: los enemigos responden.
  PD.lateMult = function (r) { return 1 + 0.045 * Math.max(0, r - 43); };
  PD.hpMult = function (L, r) {
    // enemigos más duros desde el principio (x1.8 en la 20, x8 en la 50, x14 en la 70, x30 en la 100).
    // Desde la 50 la vida de cada enemigo sube más despacio que antes (x356 en la 100) y el
    // presupuesto de la ronda se gasta en enemigos MÁS GRANDES (tanques y globos que se abren
    // en otros), no en los mismos chicos con cincuenta veces más vida.
    const k = 0.03 * (Math.min(r, 20) - 1) + 0.046 * Math.max(0, Math.min(r, 50) - 20) + 0.015 * Math.max(0, r - 50);
    return Math.exp(k) * Math.sqrt(PD.lateMult(r));
  };
  // Vida extra sobre la curva de arriba, aplicada al aparecer (engine.js: spawn), así que
  // no cambia cuántos enemigos salen (buildRounds cuenta con hpMult). Con la vida de antes
  // el spam de torres en la salida los borraba nada más aparecer. Sube poco a poco para no
  // romper el comienzo, cuando aún no hay oro: x1 hasta la ronda 3, x2 desde la 25.
  // Los jefes reciben la mitad del extra (x1.5).
  PD.hpBoost = function (r, boss) { const k = Math.min(1, Math.max(0, r - 3) / 22); return 1 + k * (boss ? 0.5 : 1); };
  PD.speedMult = function (r) { return 1 + Math.max(0, r - 80) * 0.01; };
  // Oro por muerte: alto al principio y decreciente con la cantidad de enemigos,
  // para que la dificultad no se compense sola. El grueso del oro llega con el bono de ronda.
  PD.incomeMult = function (r) { return 1.7 / Math.sqrt(PD.growth(r)); };
  PD.roundBonus = function (r) { return Math.round(150 + 12 * r + 1.0 * r * r); };
  PD.BOSS_SCALE = { 1: 0.09, 2: 0.8, 3: 2.6, 4: 6 };
  // crecimiento de la vida de los jefes (rondas 25, 50, 75 y 100) acorde a la economía
  PD.BOSS_GROW = { 1: 1, 2: 1, 3: 2.4, 4: 6 };
  PD.BOSS_LEAK = { 1: 25, 2: 9999, 3: 9999, 4: 9999 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  PD.rng = mulberry32;

  const SPECIALS = [
    { name: 'Horda', desc: 'Una marea de un único tipo de enemigo.', mono: true },
    { name: 'Estampida', desc: 'Solo enemigos rápidos, muy juntos.', filter: d => d.speed >= 70, tight: 0.5, mod: 'fast', modDesc: 'Los grandes llegan ACELERADOS.' },
    { name: 'Asalto Aéreo', desc: 'El cielo se llena de voladores.', filter: d => d.flying },
    { name: 'Noche de Sombras', desc: 'Casi todos llegan camuflados.', filter: d => d.camo, mod: 'camo', modDesc: 'Los grandes llegan CAMUFLADOS.' },
    { name: 'Muralla de Acero', desc: 'Enemigos blindados y resistentes.', filter: d => (d.armor || 0) >= 2 || d.hp >= 30 }
  ];

  function pickWeighted(rng, items) {
    let tot = 0; for (const it of items) tot += it.w;
    if (tot <= 0) return items[0];
    let x = rng() * tot;
    for (const it of items) { x -= it.w; if (x <= 0) return it; }
    return items[items.length - 1];
  }

  PD.buildRounds = function (li) {
    const L = PD.LEVELS[li];
    if (L._rounds) return L._rounds;
    const rng = mulberry32(L.seed);
    const E = PD.ENEMIES;
    const rounds = [];
    for (let r = 1; r <= PD.MAX_ROUND; r++) {
      const hpM = PD.hpMult(L, r);
      let budget = PD.budget(L, r);
      const round = { groups: [], special: null, boss: null };
      const unlocked = L.pool.filter(p => p[1] <= r);
      const newcomers = L.pool.filter(p => p[1] === r && p[1] > 1);
      const multiPath = L.paths.length > 1;

      const bossRound = r % 25 === 0;
      if (bossRound) {
        round.boss = { type: L.boss, tier: r / 25 };
        budget *= 0.55;
      }

      let special = null;
      if (r % 10 === 0 && r % 25 !== 0 && r >= 10) {
        special = SPECIALS[(Math.floor(r / 10) + li) % SPECIALS.length];
        const ok = unlocked.filter(p => !special.filter || special.filter(E[p[0]]));
        if (ok.length === 0) special = SPECIALS[0];
        // Desde la 55 las especiales también admiten a los grandes (si no, eran mil chicos
        // reforzados): en Estampida y Noche de Sombras llegan acelerados o camuflados.
        const late = r >= 55 && !special.mono;
        round.special = { name: special.name, desc: special.desc + (late && special.modDesc ? ' ' + special.modDesc : '') };
        if (late && special.mod) special = { ...special, filter: (f => d => f(d) || d.big)(special.filter), late: true };
      }

      // más grupos = rondas mixtas que exigen combinar defensas
      let nGroups = r <= 2 ? 1 : Math.min(7, 2 + Math.floor(r / 14) + (rng() < 0.4 ? 1 : 0));
      if (special && special.mono) nGroups = 1;
      else if (r >= 70) nGroups = Math.min(nGroups, 5);   // tarde: menos grupos y más grandes (caben los grandes)
      if (newcomers.length && !special && r > 3) nGroups = Math.max(2, nGroups);
      const maxN = r < 20 ? 60 : r < 50 ? 110 : 160;
      // cuántos de un tipo por grupo, idealmente (desde la ronda 20). Baja desde la 55 hasta 5
      // en la 100: los grupos tardíos son de pocos grandes, no de cientos de chicos.
      const ideal = r < 40 ? 30 : r < 55 ? 24 : Math.max(5, 24 - (r - 55) * 0.42);
      const used = {};
      const gs = [];

      for (let g = 0; g < nGroups; g++) {
        let share = budget / nGroups * (0.75 + rng() * 0.5);
        let choice = null;
        // el que debuta abre la ronda, si cabe al menos uno en su parte (un Leviatán no cabe
        // en la ronda en que se desbloquea: salía igual y valía varias veces su presupuesto)
        if (g === 0 && newcomers.length && !special && share * 0.6 / (PD.enemyThreat(newcomers[0][0]) * hpM) >= 0.6) {
          choice = newcomers[0][0];
          share *= 0.6;
        } else {
          const cands = [];
          for (const p of unlocked) {
            const d = E[p[0]];
            if (special && special.filter && !special.filter(d)) continue;
            const unit = PD.enemyThreat(p[0]) * hpM;
            const n = share / unit;
            // Preferir el tipo que sale en unas decenas (como los zepelines de Bloons): con el
            // presupuesto de las rondas altas, un enemigo débil saldría por miles, se recortaba a
            // maxN y la ronda perdía casi todo su presupuesto (cientos de Sombras y ningún pesado).
            // (desde la ronda 20: el comienzo queda como lo diseñó el dueño)
            let fit = 1;
            if (n < 1) fit = 0.02 * n;
            else if (r < 20) { if (n < 4) fit = n / 4; else if (n > maxN) fit = Math.pow(maxN / n, 2); }
            else {
              fit = Math.exp(-1.3 * Math.abs(Math.log(n / ideal)));
              if (n < 4) fit *= n / 4;
              if (n > maxN) fit *= Math.pow(maxN / n, 2);
            }
            const fresh = r - p[1] < 8 ? 1.6 : 1;
            const grande = d.big && r >= 45 ? 1 + (r - 45) / 12 : 1;   // los grandes, cada vez más frecuentes
            const repeat = used[p[0]] && !(special && special.mono) ? 0.25 : 1;   // variedad dentro de la ronda
            cands.push({ id: p[0], w: p[2] * fit * fresh * repeat * grande });
          }
          if (!cands.length) cands.push({ id: unlocked[0][0], w: 1 });
          choice = pickWeighted(rng, cands).id;
          // si de ese tipo no cabe ni uno, el que más pesa de los que sí caben
          const cabe = id => share / (PD.enemyThreat(id) * hpM) >= 0.6;
          if (!cabe(choice)) { const ok = cands.filter(c => cabe(c.id)).sort((a, b) => b.w - a.w); if (ok.length) choice = ok[0].id; }
        }
        used[choice] = true;
        const unit = PD.enemyThreat(choice) * hpM;
        let n = Math.round(share / unit);
        const swarm = choice === 'enjambre', cap = swarm ? maxN * 1.6 : maxN;
        // Si el grupo no cabe (rondas especiales de solo débiles), salen REFORZADOS en vez de
        // perder el presupuesto: más vida cada uno, hasta x6.
        const hpX = n > cap ? Math.min(6, n / cap) : 1;
        n = Math.max(1, Math.min(cap, n));
        const d = E[choice];
        let duration = Math.min(20, 2.5 + n * 0.22) * (d.speed > 90 ? 0.7 : 1) * (special && special.tight ? special.tight : 1);
        if (r <= 4) duration = Math.max(duration, n * 0.55);
        const interval = Math.max(0.07, duration / n);
        const path = multiPath ? (rng() < 0.4 ? -1 : (g % 2)) : 0;
        gs.push({ type: choice, n, interval, path, duration, unit: unit * hpX, hpX });
      }
      // Orden de salida: de los más débiles a los más duros, con el jefe como final de la ronda.
      gs.sort((a, b) => a.unit - b.unit);
      let start = 0.5, grandes = 0;
      for (const g of gs) {
        const grp = { type: g.type, n: g.n, interval: g.interval, start, path: g.path, hpX: Math.round(g.hpX * 100) / 100 };
        // uno de cada dos grupos grandes (todos camuflados y blindados a la vez era demasiado)
        if (special && special.late && special.mod && E[g.type].big && ++grandes % 2 === 1) grp.mod = special.mod;
        round.groups.push(grp);
        start += g.duration * (0.45 + rng() * 0.35) + 0.8;
      }
      if (bossRound) {
        const last = gs[gs.length - 1];
        const bossStart = gs.length ? round.groups[round.groups.length - 1].start + last.duration * 0.6 + 2 : 3;
        round.groups.push({ type: L.boss, n: 1, interval: 1, start: bossStart, path: 0, bossTier: round.boss.tier });
      }
      rounds.push(round);
    }
    L._rounds = rounds;
    return rounds;
  };
})();
