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
    }
  ];

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
