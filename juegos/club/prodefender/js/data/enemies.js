// =====================================================================
//  PRO DEFENDER — Bestiario de atacantes
//  hp/escudo base a multiplicador 1; el motor los escala por ronda.
// =====================================================================
(function () {
  const PD = (globalThis.PD = globalThis.PD || {});

  const E = {
    // ------------------------- COMUNES -------------------------------
    brote: {
      name: 'Brotito', hp: 4, speed: 55, bounty: 2, leak: 1, r: 9,
      color: '#7bd35a', shape: 'sprout',
      desc: 'La criatura más común. Débil, pero llega en grandes números.'
    },
    veloz: {
      name: 'Chispa', hp: 3, speed: 115, bounty: 2, leak: 1, r: 8,
      color: '#ffd23f', shape: 'spark',
      desc: 'Muy rápida. Atraviesa defensas lentas antes de que reaccionen.'
    },
    robusto: {
      name: 'Tortugón', hp: 16, speed: 42, bounty: 4, leak: 2, r: 13,
      color: '#a0703a', shape: 'shell',
      desc: 'Lento y resistente. Absorbe muchos disparos.'
    },
    alado: {
      name: 'Polilla', hp: 8, speed: 80, bounty: 3, leak: 1, r: 10, flying: true,
      color: '#c9a7ff', shape: 'moth',
      desc: 'VOLADORA: morteros y minas no pueden alcanzarla.'
    },
    escudero: {
      name: 'Portaescudos', hp: 10, shield: 16, speed: 52, bounty: 5, leak: 2, r: 12,
      color: '#4fa3ff', shape: 'knight',
      desc: 'ESCUDO regenerable: si deja de recibir daño 3 s, se recarga. La electricidad lo destruye el doble de rápido.'
    },
    sombra: {
      name: 'Sombra', hp: 9, speed: 72, bounty: 4, leak: 2, r: 10, camo: true,
      color: '#6b4a9e', shape: 'ghost',
      desc: 'CAMUFLADA: solo torres con detección pueden apuntarle.'
    },
    blindado: {
      name: 'Acorazado', hp: 22, armor: 3, speed: 46, bounty: 6, leak: 3, r: 13,
      color: '#8f9aa6', shape: 'hex',
      desc: 'BLINDAJE 3: resta daño a cada impacto. Usa golpes fuertes, fuego o daño arcano.'
    },
    divisor: {
      name: 'Gelatina', hp: 14, speed: 50, bounty: 3, leak: 1, r: 13,
      color: '#ff6fb5', shape: 'jelly', children: [['gelatinita', 3]],
      desc: 'Al morir se divide en 3 gelatinitas veloces.'
    },
    gelatinita: {
      name: 'Gelatinita', hp: 5, speed: 78, bounty: 1, leak: 1, r: 7,
      color: '#ff9fd0', shape: 'jelly', minor: true,
      desc: 'Fragmento de gelatina.'
    },
    portador: {
      name: 'Portador', hp: 260, armor: 2, speed: 32, bounty: 30, leak: 10, r: 24,
      color: '#5d6b7a', shape: 'carrier', children: [['robusto', 3], ['blindado', 3]], big: true,
      desc: 'Nave blindada que libera 3 Tortugones y 3 Acorazados al ser destruida.'
    },
    titan: {
      name: 'Titán de Hierro', hp: 1400, armor: 8, speed: 24, bounty: 120, leak: 40, r: 32,
      color: '#3c4652', shape: 'titan', children: [['portador', 2]], big: true,
      desc: 'Fortaleza ambulante con blindaje 8. Lleva 2 Portadores en su interior.'
    },

    // --------- LA ESCALERA DE LOS GRANDES (rondas altas, todos los reinos) ---------
    // Como los dirigibles de Bloons: en vez de cientos de enemigos chicos inflados,
    // las rondas altas mandan pocos enemigos enormes que al caer sueltan a los del
    // escalón de abajo. Tanques por tierra (Portador → Titán → Fortaleza → Ciudadela
    // → Leviatán) y globos por el aire (Zepelín → Dirigible → Acorazado Celeste → Arca).
    fortaleza: {
      name: 'Fortaleza Rodante', hp: 4500, armor: 10, speed: 21, bounty: 260, leak: 60, r: 36,
      color: '#56606c', shape: 'supertank', rank: 1, children: [['titan', 2]], big: true,
      desc: 'SUPERTANQUE. Blindaje 10. Al caer libera 2 Titanes de Hierro.'
    },
    ciudadela: {
      name: 'Ciudadela de Guerra', hp: 14000, armor: 12, speed: 18, bounty: 520, leak: 120, r: 41,
      color: '#3f4a5a', shape: 'supertank', rank: 2, children: [['fortaleza', 2]], big: true,
      desc: 'SUPER SUPERTANQUE. Blindaje 12. Al caer libera 2 Fortalezas Rodantes.'
    },
    leviatan: {
      name: 'Leviatán de Acero', hp: 42000, armor: 14, speed: 15, bounty: 1100, leak: 250, r: 47,
      color: '#2a3140', shape: 'supertank', rank: 3, children: [['ciudadela', 2]], big: true,
      desc: 'SUPER SUPER SUPERTANQUE. Blindaje 14. Al caer libera 2 Ciudadelas de Guerra.'
    },
    zepelin: {
      name: 'Zepelín de Polillas', hp: 700, armor: 2, speed: 40, bounty: 40, leak: 8, r: 22, flying: true,
      color: '#b993dc', shape: 'blimp', rank: 0, children: [['alado', 4], ['enjambre', 6]], big: true,
      desc: 'GLOBO VOLADOR. Al reventar suelta 4 Polillas y 6 Abejorros.'
    },
    dirigible: {
      name: 'Gran Dirigible', hp: 2600, armor: 4, speed: 32, bounty: 150, leak: 20, r: 28, flying: true,
      color: '#9a72cc', shape: 'blimp', rank: 1, children: [['zepelin', 3]], big: true,
      desc: 'SUPERGLOBO. Blindaje 4. Al reventar suelta 3 Zepelines.'
    },
    celeste: {
      name: 'Acorazado Celeste', hp: 9000, armor: 6, speed: 26, bounty: 380, leak: 50, r: 34, flying: true,
      color: '#7354b0', shape: 'blimp', rank: 2, children: [['dirigible', 2]], big: true,
      desc: 'SUPER SUPERGLOBO. Blindaje 6. Al reventar suelta 2 Grandes Dirigibles.'
    },
    arca: {
      name: 'Arca de la Tormenta', hp: 30000, armor: 8, speed: 21, bounty: 900, leak: 120, r: 40, flying: true,
      color: '#4a3584', shape: 'blimp', rank: 3, children: [['celeste', 2]], big: true,
      desc: 'SUPER SUPER SUPERGLOBO. Blindaje 8. Al reventar suelta 2 Acorazados Celestes.'
    },

    // ------------------- NIVEL 1 · PRADO ESMERALDA -------------------
    musgo: {
      name: 'Musgo Vivo', hp: 28, speed: 48, bounty: 5, leak: 2, r: 12, regen: 0.05,
      color: '#3fa34d', shape: 'moss',
      desc: 'REGENERA el 5% de su vida por segundo. Hay que eliminarlo rápido.'
    },
    chaman: {
      name: 'Chamán del Bosque', hp: 40, speed: 44, bounty: 8, leak: 3, r: 13,
      heal: { every: 3, radius: 85, pct: 0.15 },
      color: '#2e8b57', shape: 'mask',
      desc: 'Cada 3 s CURA un 15% a los aliados cercanos.'
    },
    enjambre: {
      name: 'Abejorro', hp: 3, speed: 105, bounty: 1, leak: 1, r: 6, flying: true,
      color: '#ffb000', shape: 'bee',
      desc: 'Voladores diminutos que llegan en enjambres enormes.'
    },
    reyEscarabajo: {
      name: 'Rey Escarabajo', hp: 3200, armor: 5, speed: 22, bounty: 400, leak: 9999, r: 38,
      color: '#3b8d2f', shape: 'beetle', boss: true,
      spawn: { every: 4, type: 'blindado', n: 2 },
      desc: 'JEFE del Prado. Blindaje 5. Invoca Acorazados sin parar.'
    },

    // --------------------- NIVEL 2 · DUNAS DE ÁMBAR ------------------
    excavador: {
      name: 'Topo Excavador', hp: 30, speed: 50, bounty: 6, leak: 3, r: 12,
      burrow: { every: 3.5, dur: 1.6, speed: 1.8 },
      color: '#b07b4f', shape: 'mole',
      desc: 'Se ENTIERRA periódicamente: bajo tierra es intocable y avanza más rápido.'
    },
    escorpion: {
      name: 'Escorpión de Ámbar', hp: 34, armor: 2, speed: 58, bounty: 7, leak: 3, r: 13,
      enrage: { below: 0.5, mult: 1.8 },
      color: '#e09a2e', shape: 'scorpion',
      desc: 'Bajo el 50% de vida entra en FURIA y corre un 80% más rápido.'
    },
    espejismo: {
      name: 'Espejismo', hp: 22, speed: 64, bounty: 6, leak: 2, r: 11, camo: true,
      blink: { dist: 110 },
      color: '#f3d9a4', shape: 'mirage',
      desc: 'Camuflado. Al recibir el primer golpe se TELETRANSPORTA hacia adelante.'
    },
    gusano: {
      name: 'Gusano Colosal', hp: 4200, armor: 3, speed: 20, bounty: 450, leak: 9999, r: 40,
      color: '#c4874a', shape: 'worm', boss: true,
      burrow: { every: 5, dur: 2.2, speed: 2.2 },
      spawn: { every: 6, type: 'excavador', n: 3 },
      desc: 'JEFE de las Dunas. Se sumerge en la arena y escupe Topos Excavadores.'
    },

    // ---------------------- NIVEL 3 · GLACIAR CRISTAL ----------------
    golem: {
      name: 'Gólem de Escarcha', hp: 60, armor: 3, speed: 38, bounty: 8, leak: 4, r: 15,
      resist: { ice: 0, fire: 1.6 }, slowImmune: true, freezeImmune: true,
      color: '#a8d8ff', shape: 'golem',
      desc: 'Inmune al hielo y a ralentizaciones. Muy débil al fuego (x1.6).'
    },
    cristal: {
      name: 'Espíritu de Cristal', hp: 30, speed: 60, bounty: 7, leak: 3, r: 11,
      resist: { phys: 0.1 },
      color: '#d6f6ff', shape: 'crystal',
      desc: 'Casi INMUNE al daño físico (10%). Usa fuego, hielo, electricidad o arcano.'
    },
    yeti: {
      name: 'Yeti', hp: 90, armor: 1, speed: 44, bounty: 10, leak: 4, r: 16,
      deathFreeze: { radius: 110, dur: 2.5 },
      color: '#eef4ff', shape: 'yeti',
      desc: 'Al morir suelta una ventisca que CONGELA las torres cercanas 2.5 s.'
    },
    coloso: {
      name: 'Coloso Glacial', hp: 5200, armor: 8, speed: 18, bounty: 500, leak: 9999, r: 42,
      color: '#7fc4ff', shape: 'golem', boss: true,
      resist: { ice: 0, fire: 1.4 },
      sabotage: { every: 7, radius: 150, dur: 2 },
      desc: 'JEFE del Glaciar. Blindaje 8, inmune al hielo. Emite ondas que congelan torres.'
    },

    // --------------------- NIVEL 4 · CALDERA VOLCÁNICA ---------------
    salamandra: {
      name: 'Salamandra Ígnea', hp: 40, speed: 72, bounty: 7, leak: 3, r: 11,
      resist: { fire: 0, ice: 0.5 }, slowImmune: true,
      color: '#ff5a1f', shape: 'lizard',
      desc: 'Inmune al fuego y a ralentizaciones, resiste el hielo.'
    },
    magma: {
      name: 'Roca Fundida', hp: 70, armor: 4, speed: 40, bounty: 6, leak: 3, r: 15,
      resist: { fire: 0 }, children: [['brasa', 3]],
      color: '#8a2b0e', shape: 'rock',
      desc: 'Blindaje 4, inmune al fuego. Al romperse libera 3 Brasas veloces.'
    },
    brasa: {
      name: 'Brasa', hp: 10, speed: 95, bounty: 2, leak: 1, r: 7, minor: true,
      resist: { fire: 0 },
      color: '#ffa53b', shape: 'ember',
      desc: 'Chispa ardiente, rápida e inmune al fuego.'
    },
    heraldo: {
      name: 'Heraldo de Ceniza', hp: 55, speed: 52, bounty: 9, leak: 4, r: 13,
      haste: { radius: 85, mult: 1.45 },
      color: '#ff3d6e', shape: 'herald',
      desc: 'AURA: acelera un 45% a los aliados cercanos.'
    },
    ave: {
      name: 'Ave de Ceniza', hp: 26, speed: 90, bounty: 5, leak: 2, r: 11, flying: true,
      resist: { fire: 0 },
      color: '#ff7b54', shape: 'bird',
      desc: 'Voladora e inmune al fuego.'
    },
    fenix: {
      name: 'Fénix Infernal', hp: 4600, speed: 26, bounty: 550, leak: 9999, r: 40, flying: true,
      color: '#ff4500', shape: 'phoenix', boss: true,
      resist: { fire: 0 }, revive: true,
      spawn: { every: 5, type: 'ave', n: 3 },
      desc: 'JEFE de la Caldera. Volador, inmune al fuego y RENACE una vez de sus cenizas.'
    },

    // ----------------------- NIVEL 5 · NEXO DEL VACÍO ----------------
    espectro: {
      name: 'Espectro', hp: 40, speed: 60, bounty: 8, leak: 4, r: 12,
      phase: { every: 5, dur: 2 },
      color: '#8a7dff', shape: 'wisp',
      desc: 'Entra en FASE: durante 2 s solo el daño arcano le afecta.'
    },
    saboteador: {
      name: 'Saboteador', hp: 75, armor: 2, speed: 48, bounty: 10, leak: 5, r: 13,
      sabotage: { every: 6, radius: 100, dur: 2.5 },
      color: '#5b4a8f', shape: 'eye',
      desc: 'Cada 6 s DESACTIVA las torres cercanas durante 2.5 s.'
    },
    magnetita: {
      name: 'Magnetita', hp: 55, armor: 6, speed: 44, bounty: 8, leak: 4, r: 13,
      resist: { elec: 0 },
      color: '#4b5b7a', shape: 'magnet',
      desc: 'Blindaje 6 e INMUNE a la electricidad.'
    },
    fractal: {
      name: 'Fractal', hp: 40, speed: 50, bounty: 4, leak: 1, r: 14,
      children: [['fractal2', 2]],
      color: '#c06bff', shape: 'star',
      desc: 'Se divide en 2 fractales menores... que a su vez se vuelven a dividir.'
    },
    fractal2: {
      name: 'Fractal Medio', hp: 18, speed: 60, bounty: 2, leak: 1, r: 10, minor: true,
      children: [['fractal3', 2]],
      color: '#d18bff', shape: 'star', desc: 'Fragmento fractal.'
    },
    fractal3: {
      name: 'Fractal Menor', hp: 8, speed: 72, bounty: 1, leak: 1, r: 7, minor: true,
      color: '#e2b0ff', shape: 'star', desc: 'El fragmento más pequeño.'
    },
    colosoVacio: {
      name: 'Coloso del Vacío', hp: 4500, armor: 10, speed: 22, bounty: 200, leak: 60, r: 34,
      camo: true, regen: 0.01, big: true,
      children: [['saboteador', 4], ['espectro', 4]],
      color: '#2b1d4f', shape: 'voidtitan',
      desc: 'Camuflado, blindaje 10, se regenera. Libera Saboteadores y Espectros.'
    },
    devorador: {
      name: 'Devorador del Vacío', hp: 6000, armor: 6, speed: 20, bounty: 700, leak: 9999, r: 44,
      color: '#3a1670', shape: 'voidboss', boss: true, camo: true,
      teleport: { every: 9, dist: 100 },
      sabotage: { every: 8, radius: 140, dur: 2 },
      spawn: { every: 5, type: 'espectro', n: 2 },
      desc: 'JEFE FINAL. Camuflado, se teletransporta, apaga torres e invoca Espectros.'
    }
  };

  // ---- Valores derivados: fuga total y "amenaza" para generar oleadas ----
  function leakTotal(id) {
    const d = E[id];
    if (d._leak !== undefined) return d._leak;
    let v = d.leak;
    if (d.children) for (const [c, n] of d.children) v += leakTotal(c) * n;
    return (d._leak = Math.min(v, 9999));
  }
  function threat(id) {
    const d = E[id];
    if (d._threat !== undefined) return d._threat;
    let t = d.hp + (d.shield || 0) * 1.2;
    t *= 1 + (d.armor || 0) * 0.12;
    if (d.camo) t *= 1.25;
    if (d.flying) t *= 1.1;
    if (d.regen) t *= 1 + d.regen * 8;
    if (d.burrow) t *= 1.2;
    if (d.phase) t *= 1.3;
    if (d.heal) t *= 1.5;
    if (d.haste) t *= 1.4;
    if (d.sabotage) t *= 1.5;
    if (d.enrage) t *= 1.15;
    if (d.blink) t *= 1.2;
    if (d.deathFreeze) t *= 1.2;
    if (d.resist) for (const k in d.resist) if (d.resist[k] < 0.5) t *= 1.15;
    if (d.slowImmune) t *= 1.08;
    t *= Math.pow(d.speed / 55, 0.6);
    if (d.children) for (const [c, n] of d.children) t += threat(c) * n;
    return (d._threat = t);
  }
  for (const id in E) { E[id].id = id; leakTotal(id); threat(id); }

  PD.ENEMIES = E;
  PD.enemyThreat = threat;
})();
