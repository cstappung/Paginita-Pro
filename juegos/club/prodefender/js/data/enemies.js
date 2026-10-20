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
    // escalón de abajo (y uno de dos escalones abajo: así cada uno vale ~2,5 veces el anterior y
    // los de arriba caben en el presupuesto). Tanques por tierra (Portador → Titán → Fortaleza → Ciudadela
    // → Leviatán) y globos por el aire (Zepelín → Dirigible → Acorazado Celeste → Arca).
    // Cada escalón tiene su color (azul, rojo, verde/negro, violeta) y su arte (render.js:
    // supertank, blimp) suma púas y calaveras con `rank`, para distinguirlos de un vistazo.
    // `fugaHijos`: al escaparse cuentan su fuga y la MITAD de la de sus hijos (si no, un solo
    // Zepelín perdido eran 18 vidas y un Leviatán, varias partidas).
    fortaleza: {
      name: 'Fortaleza Rodante', hp: 1600, armor: 9, speed: 21, bounty: 120, leak: 40, r: 36,
      color: '#2f6fb8', accent: '#7fd0ff', shape: 'supertank', rank: 1, children: [['titan', 1], ['portador', 2]], big: true, fugaHijos: 0.5,
      desc: 'SUPERTANQUE. Blindaje 9. Al caer libera un Titán de Hierro y 2 Portadores.'
    },
    ciudadela: {
      name: 'Ciudadela de Guerra', hp: 3000, armor: 10, speed: 18, bounty: 220, leak: 70, r: 41,
      color: '#b0302a', accent: '#ffb02a', shape: 'supertank', rank: 2, children: [['fortaleza', 1], ['titan', 1]], big: true, fugaHijos: 0.5,
      desc: 'SUPER SUPERTANQUE. Blindaje 10. Al caer libera una Fortaleza Rodante y un Titán.'
    },
    leviatan: {
      name: 'Leviatán de Acero', hp: 6000, armor: 11, speed: 15, bounty: 400, leak: 120, r: 47,
      color: '#1d2420', accent: '#5aff6a', shape: 'supertank', rank: 3, children: [['ciudadela', 1], ['fortaleza', 1]], big: true, fugaHijos: 0.5,
      desc: 'SUPER SUPER SUPERTANQUE. Blindaje 11. Al caer libera una Ciudadela de Guerra y una Fortaleza.'
    },
    zepelin: {
      name: 'Zepelín de Polillas', hp: 700, armor: 2, speed: 40, bounty: 40, leak: 8, r: 22, flying: true,
      color: '#4fa3e0', accent: '#dff4ff', shape: 'blimp', rank: 0, children: [['alado', 4], ['enjambre', 6]], big: true, fugaHijos: 0.5,
      desc: 'GLOBO VOLADOR. Al reventar suelta 4 Polillas y 6 Abejorros.'
    },
    dirigible: {
      name: 'Gran Dirigible', hp: 1400, armor: 3, speed: 32, bounty: 80, leak: 15, r: 28, flying: true,
      color: '#d8443a', accent: '#ffd84d', shape: 'blimp', rank: 1, children: [['zepelin', 2]], big: true, fugaHijos: 0.5,
      desc: 'SUPERGLOBO. Blindaje 3. Al reventar suelta 2 Zepelines.'
    },
    celeste: {
      name: 'Acorazado Celeste', hp: 3000, armor: 4, speed: 26, bounty: 160, leak: 30, r: 34, flying: true,
      color: '#2e8a4a', accent: '#c8ff5a', shape: 'blimp', rank: 2, children: [['dirigible', 1], ['zepelin', 2]], big: true, fugaHijos: 0.5,
      desc: 'SUPER SUPERGLOBO. Blindaje 4. Al reventar suelta un Gran Dirigible y 2 Zepelines.'
    },
    arca: {
      name: 'Arca de la Tormenta', hp: 6000, armor: 5, speed: 21, bounty: 300, leak: 60, r: 40, flying: true,
      color: '#3a1d5c', accent: '#ff3ad1', shape: 'blimp', rank: 3, children: [['celeste', 1], ['dirigible', 1]], big: true, fugaHijos: 0.5,
      desc: 'SUPER SUPER SUPERGLOBO. Blindaje 5. Al reventar suelta un Acorazado Celeste y un Gran Dirigible.'
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
    },

    // ================= SEGUNDA ERA (reinos 6–10, en pruebas) =================
    // Mecánicas nuevas, cada una con su campo (engine.js las mira solo si existen,
    // así que los cinco primeros reinos se juegan exactamente igual):
    //   hop       salta hacia adelante; en el aire nadie lo toca (usa `burrowed`)
    //   steal     al escaparse se lleva esa parte de tu oro
    //   fogAura   la niebla que lo rodea CAMUFLA a los aliados cercanos
    //   heads     al perder vida le crecen cabezas (enemigos nuevos)
    //   regenFuego se regenera mientras no esté ardiendo
    //   stone     bajo cierta vida se vuelve piedra: inmune y quieto, y se cura
    //   absorb    ese tipo de daño lo CURA en vez de dañarlo
    //   thunder   fulmina (apaga) las torres en las que más oro invertiste
    //   shellHits caparazón: su blindaje se rompe tras recibir tantos golpes
    //   ink       tinta que CIEGA a las torres cercanas (alcance x0.55)
    //   grab      tentáculos que atrapan torres hasta que el jefe pierda vida
    //   adapt     se vuelve resistente al tipo de daño que más recibe
    //   shieldAura da escudo (que no se recarga) a los aliados cercanos
    //   cycle     inmune a una familia de daño que va cambiando
    //   field     campo de fuerza: los aliados cercanos reciben menos daño
    //   cleanse   limpia ralentizaciones, venenos, maldiciones y demás de sus aliados
    //   ward      al morir, los aliados cercanos quedan invulnerables un momento
    //   twins     al bajar de la mitad se parte en dos jefes
    //   silence   reinicia las habilidades de las torres cercanas

    // ---------------------- REINO 6 · PANTANO SOMBRÍO ----------------------
    sapo: {
      name: 'Sapo Saltarín', hp: 34, speed: 50, bounty: 6, leak: 2, r: 12,
      hop: { every: 3.2, dur: 0.55, speed: 4.2 },
      color: '#5c9a3a', accent: '#d8ff6a', shape: 'frog',
      desc: 'SALTA hacia adelante cada pocos segundos: en el aire ninguna torre lo alcanza.'
    },
    duende: {
      name: 'Duende Ladrón', hp: 30, speed: 78, bounty: 14, leak: 1, r: 10, steal: 0.06,
      color: '#3f7a4a', accent: '#ffd84d', shape: 'goblin',
      desc: 'Rápido. Si se ESCAPA se lleva el 6% de tu oro. Si lo atrapas, suelta su botín.'
    },
    bruma: {
      name: 'Bruma de la Ciénaga', hp: 60, speed: 40, bounty: 9, leak: 3, r: 15, fogAura: 80,
      color: '#9aa8a0', shape: 'fog',
      desc: 'Su NIEBLA camufla a los aliados que la rodean. Ella misma no está camuflada.'
    },
    cabezaHidra: {
      name: 'Cabeza de Hidra', hp: 120, armor: 2, speed: 66, bounty: 10, leak: 6, r: 13, minor: true,
      color: '#3a7a5a', shape: 'serpent',
      desc: 'Brota de la Hidra cada vez que pierde una cuarta parte de su vida.'
    },
    hidra: {
      name: 'Hidra del Pantano', hp: 6200, armor: 4, speed: 19, bounty: 800, leak: 9999, r: 44,
      color: '#2f6a4a', accent: '#c8ff5a', shape: 'hydra', boss: true,
      regenFuego: 0.008, heads: { type: 'cabezaHidra', n: 3, at: [0.75, 0.5, 0.25] },
      spawn: { every: 6, type: 'sapo', n: 2 },
      desc: 'JEFE del Pantano. SE REGENERA mientras no arda y le CRECEN CABEZAS al perder vida.'
    },

    // -------------------- REINO 7 · CUMBRES TORMENTOSAS --------------------
    gargola: {
      name: 'Gárgola', hp: 85, armor: 4, speed: 44, bounty: 10, leak: 4, r: 14,
      stone: { below: 0.4, dur: 2.5, heal: 0.35 },
      color: '#8a8f9a', shape: 'gargoyle',
      desc: 'Bajo el 40% de vida se vuelve PIEDRA: 2.5 s inmune y quieta, y recupera vida.'
    },
    tormentoso: {
      name: 'Elemental de Tormenta', hp: 50, speed: 70, bounty: 8, leak: 3, r: 13, flying: true, absorb: 'elec',
      color: '#5a7ad8', accent: '#fff27a', shape: 'stormcloud',
      desc: 'Volador. La ELECTRICIDAD lo cura en vez de dañarlo.'
    },
    reyTrueno: {
      name: 'Rey del Trueno', hp: 5800, shield: 1800, speed: 24, bounty: 800, leak: 9999, r: 42, flying: true,
      color: '#3a4aa8', accent: '#ffe14d', shape: 'thunderbird', boss: true,
      thunder: { every: 8, n: 2, dur: 3 }, spawn: { every: 6, type: 'gargola', n: 2 },
      desc: 'JEFE de las Cumbres. Volador con escudo. FULMINA las torres en las que más invertiste.'
    },

    // ------------------------ REINO 8 · FOSA ABISAL ------------------------
    cangrejo: {
      name: 'Cangrejo Acorazado', hp: 70, armor: 14, speed: 40, bounty: 10, leak: 4, r: 15, shellHits: 6,
      color: '#d0503a', accent: '#ffb08a', shape: 'crab',
      desc: 'CAPARAZÓN de blindaje 14 que se rompe tras 6 golpes. Las torres rápidas lo abren.'
    },
    pulpo: {
      name: 'Pulpo Tintero', hp: 65, speed: 52, bounty: 9, leak: 3, r: 14,
      ink: { every: 5, radius: 95, dur: 3.5 },
      color: '#8a3ac8', shape: 'octopus',
      desc: 'Lanza TINTA que ciega a las torres cercanas: su alcance baja casi a la mitad.'
    },
    kraken: {
      name: 'Kraken Abisal', hp: 8000, armor: 6, speed: 18, bounty: 900, leak: 9999, r: 46,
      color: '#5a2a7a', accent: '#ff7ac8', shape: 'kraken', boss: true,
      grab: { every: 7, n: 2, dur: 8, hp: 0.06 }, spawn: { every: 7, type: 'cangrejo', n: 2 },
      desc: 'JEFE de la Fosa. Sus tentáculos ATRAPAN torres hasta que le quitas un 6% de vida.'
    },

    // -------------------- REINO 9 · CIUDADELA DE ENGRANAJES --------------------
    automata: {
      name: 'Autómata Adaptable', hp: 95, armor: 3, speed: 44, bounty: 11, leak: 4, r: 14,
      adapt: { after: 0.35, res: 0.4, max: 2 },
      color: '#b08a3a', accent: '#5ad1ff', shape: 'robot',
      desc: 'Se ADAPTA: el tipo de daño que más recibe le hace cada vez menos (hasta dos tipos).'
    },
    reparador: {
      name: 'Dron Reparador', hp: 45, speed: 62, bounty: 9, leak: 2, r: 11, flying: true,
      shieldAura: { every: 4, radius: 90, pct: 0.3 },
      color: '#5ad1a8', shape: 'drone',
      desc: 'Volador. Da ESCUDO (30% de su vida) a los aliados cercanos cada 4 s.'
    },
    mecatitan: {
      name: 'Mecatitán', hp: 13000, armor: 8, speed: 17, bounty: 1000, leak: 9999, r: 46,
      color: '#7a6a4a', accent: '#ff5a3a', shape: 'mech', boss: true,
      cycle: { every: 8 }, field: { radius: 120, f: 0.4 }, spawn: { every: 6, type: 'automata', n: 2 },
      desc: 'JEFE de la Ciudadela. Cambia de INMUNIDAD cada 8 s y su CAMPO protege a los cercanos.'
    },

    // ----------------------- REINO 10 · TRONO DEL ECLIPSE -----------------------
    purificador: {
      name: 'Purificador', hp: 80, shield: 30, speed: 46, bounty: 11, leak: 4, r: 13,
      cleanse: { every: 3.5, radius: 95 },
      color: '#e8e0b0', accent: '#ffcf4d', shape: 'lantern',
      desc: 'Cada 3.5 s LIMPIA a sus aliados: quita ralentizaciones, venenos, quemaduras y maldiciones.'
    },
    martir: {
      name: 'Mártir del Ocaso', hp: 70, speed: 54, bounty: 9, leak: 3, r: 12, camo: true,
      ward: { radius: 100, dur: 1.5 },
      color: '#c87ad8', shape: 'angel',
      desc: 'Camuflado. Al morir deja INVULNERABLES 1.5 s a los aliados cercanos.'
    },
    solGemelo: {
      name: 'Sol del Eclipse', hp: 4000, speed: 24, bounty: 500, leak: 9999, r: 36, boss: true,
      resist: { phys: 0.2, explosive: 0.2 },
      color: '#ffb02a', shape: 'sun',
      desc: 'Mitad del Eclipse. Resiste el daño físico y explosivo.'
    },
    lunaGemela: {
      name: 'Luna del Eclipse', hp: 4000, speed: 24, bounty: 500, leak: 9999, r: 36, boss: true,
      resist: { arcane: 0.2, elec: 0.2, fire: 0.2, ice: 0.2 },
      color: '#8ab0ff', shape: 'moon',
      desc: 'Mitad del Eclipse. Resiste la magia: arcano, electricidad, fuego y hielo.'
    },
    eclipse: {
      name: 'Eclipse, Devorador de Soles', hp: 11000, armor: 6, speed: 18, bounty: 1200, leak: 9999, r: 48,
      color: '#1a1030', accent: '#ffcf4d', shape: 'eclipse', boss: true,
      twins: ['solGemelo', 'lunaGemela'], silence: { every: 9, radius: 220 }, spawn: { every: 6, type: 'martir', n: 2 },
      desc: 'JEFE FINAL. SILENCIA las habilidades cercanas y, a la mitad de su vida, se PARTE en el Sol y la Luna.'
    }
  };

  // ---- Valores derivados: fuga total y "amenaza" para generar oleadas ----
  function leakTotal(id) {
    const d = E[id];
    if (d._leak !== undefined) return d._leak;
    let v = d.leak;
    if (d.children) for (const [c, n] of d.children) v += leakTotal(c) * n * (d.fugaHijos || 1);
    return (d._leak = Math.min(Math.ceil(v), 9999));
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
    // segunda era
    if (d.hop) t *= 1.25;
    if (d.fogAura) t *= 1.5;
    if (d.stone) t *= 1.3;
    if (d.absorb) t *= 1.15;
    if (d.shellHits) t *= 1.2;
    if (d.ink) t *= 1.4;
    if (d.adapt) t *= 1.3;
    if (d.shieldAura) t *= 1.5;
    if (d.cleanse) t *= 1.5;
    if (d.ward) t *= 1.4;
    t *= Math.pow(d.speed / 55, 0.6);
    if (d.children) for (const [c, n] of d.children) t += threat(c) * n;
    return (d._threat = t);
  }
  for (const id in E) { E[id].id = id; leakTotal(id); threat(id); }

  PD.ENEMIES = E;
  PD.enemyThreat = threat;
})();
