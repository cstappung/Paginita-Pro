// =====================================================================
//  PRO DEFENDER — Arsenal de defensores
//  Cada torre: 2 caminos de mejora con 4 niveles.
//  Regla: un camino puede llegar a 4, el otro como máximo a 2.
// =====================================================================
(function () {
  const PD = (globalThis.PD = globalThis.PD || {});

  const T = {
    espinas: {
      name: 'Lanzaespinas', cost: 180, kind: 'projectile', size: 16, color: '#5fbf4a', targeting: true,
      desc: 'Dispara espinas que atraviesan a varios enemigos. Barata y versátil.',
      base: { range: 130, cd: 0.75, dmg: 2, pierce: 2, projSpeed: 520, count: 1, spread: 0.18, dtype: 'phys' },
      paths: [
        { name: 'Zarzas', ups: [
          { name: 'Espinas Afiladas', cost: 140, desc: '+1 daño y +1 perforación.', apply: s => { s.dmg += 1; s.pierce += 1; } },
          { name: 'Savia Venenosa', cost: 280, desc: 'Las espinas envenenan: 3 daño/s durante 3 s (ignora blindaje).', apply: s => { s.poisonDps = 3; s.poisonDur = 3; } },
          { name: 'Ráfaga Triple', cost: 650, desc: 'Dispara 3 espinas en abanico y un 15% más rápido.', apply: s => { s.count = 3; s.cd *= 0.85; } },
          { name: 'Tormenta de Zarzas', cost: 4200, desc: 'Lanza 10 espinas en todas direcciones sin parar. Veneno 10/s.', apply: s => { s.radial = true; s.count = 10; s.cd = 0.35; s.dmg += 3; s.pierce += 3; s.poisonDps = 10; } }
        ] },
        { name: 'Precisión', ups: [
          { name: 'Mira Larga', cost: 110, desc: '+40 alcance y espinas más veloces.', apply: s => { s.range += 40; s.projSpeed += 150; } },
          { name: 'Ojo de Halcón', cost: 220, desc: 'Detecta enemigos CAMUFLADOS y dispara un 15% más rápido.', apply: s => { s.camo = true; s.cd *= 0.85; } },
          { name: 'Púa Perforante', cost: 900, desc: '+6 perforación, +2 daño e ignora todo el blindaje.', apply: s => { s.pierce += 6; s.dmg += 2; s.armorPierce = 1; } },
          { name: 'Lanza Ancestral', cost: 5200, desc: 'Lanzas gigantes: +40 daño, +30 perforación y x2 contra jefes.', apply: s => { s.spear = true; s.dmg += 40; s.pierce += 30; s.cd = Math.max(s.cd, 0.9); s.bossMult = 2; s.projSpeed = 950; s.range += 40; } }
        ] }
      ]
    },

    escarcha: {
      name: 'Cañón Gélido', cost: 320, kind: 'pulse', size: 17, color: '#7fd6ff',
      desc: 'Emite pulsos helados que dañan y ralentizan a todo lo que esté cerca, incluso camuflados.',
      base: { range: 90, cd: 1.3, dmg: 1, dtype: 'ice', slow: 0.4, slowDur: 1.5 },
      paths: [
        { name: 'Congelación', ups: [
          { name: 'Escarcha Profunda', cost: 160, desc: 'Ralentiza un 55% y dura más.', apply: s => { s.slow = 0.55; s.slowDur += 0.5; } },
          { name: 'Congelación', cost: 420, desc: '35% de probabilidad de CONGELAR 1 s.', apply: s => { s.freezeChance = 0.35; s.freezeDur = 1; } },
          { name: 'Hielo Quebradizo', cost: 1100, desc: 'Los enemigos helados reciben +3 daño de TODOS los impactos.', apply: s => { s.brittle = 3; s.freezeChance = 0.5; } },
          { name: 'Cero Absoluto', cost: 6000, desc: '+9 daño por pulso. HABILIDAD AUTOMÁTICA: congela a todos los enemigos 4 s.', apply: s => { s.dmg += 9; s.freezeChance = 0.7; s.freezeDur = 1.5; s.ability = 'absolute'; } }
        ] },
        { name: 'Ventisca', ups: [
          { name: 'Ventisca', cost: 130, desc: '+25 alcance.', apply: s => { s.range += 25; } },
          { name: 'Escarcha Cortante', cost: 380, desc: '+3 daño y pulsos un 15% más rápidos.', apply: s => { s.dmg += 3; s.cd *= 0.85; } },
          { name: 'Fragmentos de Hielo', cost: 1300, desc: 'Además dispara esquirlas de hielo (8 daño, perfora 3).', apply: s => { s.shardDmg = 8; s.shardCd = 0.5; } },
          { name: 'Avalancha', cost: 5600, desc: 'Pulsos devastadores: +25 daño, más alcance y rompe blindaje.', apply: s => { s.dmg += 25; s.cd = 0.8; s.range += 20; s.armorPierce = 0.5; if (s.shardDmg) s.shardDmg += 20; } }
        ] }
      ]
    },

    voltaico: {
      name: 'Arco Voltaico', cost: 480, kind: 'chain', size: 17, color: '#ffe14d', targeting: true,
      desc: 'Rayos que saltan entre enemigos. Destruye escudos el doble de rápido.',
      base: { range: 120, cd: 1.0, dmg: 3, dtype: 'elec', jumps: 3, chainRange: 75, shieldMult: 2 },
      paths: [
        { name: 'Sobrecarga', ups: [
          { name: 'Arco Doble', cost: 220, desc: '+2 saltos.', apply: s => { s.jumps += 2; } },
          { name: 'Alto Voltaje', cost: 520, desc: '+3 daño.', apply: s => { s.dmg += 3; } },
          { name: 'Tormenta en Cadena', cost: 1800, desc: '+6 saltos, mayor distancia y aturde 0.3 s.', apply: s => { s.jumps += 6; s.stun = 0.3; s.chainRange += 20; } },
          { name: 'Dios del Trueno', cost: 8000, desc: '+25 daño, +10 saltos y dispara el doble de rápido.', apply: s => { s.dmg += 25; s.jumps += 10; s.cd = 0.5; } }
        ] },
        { name: 'Condensador', ups: [
          { name: 'Condensador', cost: 260, desc: 'Dispara un 20% más rápido.', apply: s => { s.cd *= 0.8; } },
          { name: 'Ionización', cost: 420, desc: 'x4 contra escudos y detecta CAMUFLADOS.', apply: s => { s.shieldMult = 4; s.camo = true; } },
          { name: 'Bobina de Pulso', cost: 1500, desc: 'Cada 4 disparos libera un pulso de 20 daño en todo su alcance.', apply: s => { s.pulseEvery = 4; s.pulseDmg = 20; } },
          { name: 'Juicio Celestial', cost: 7000, desc: '+10 daño, pulso de 80. HABILIDAD AUTOMÁTICA: rayos sobre los 30 enemigos más fuertes.', apply: s => { s.dmg += 10; s.pulseDmg = 80; s.ability = 'judgement'; } }
        ] }
      ]
    },

    mortero: {
      name: 'Mortero de Brea', cost: 540, kind: 'mortar', size: 18, color: '#c46a2b', targeting: true,
      desc: 'Lanza bombas con daño en área. Gran alcance. No alcanza a voladores.',
      base: { range: 210, cd: 1.6, dmg: 4, radius: 45, dtype: 'explosive', armorPierce: 0.5, noFlying: true },
      paths: [
        { name: 'Calibre', ups: [
          { name: 'Pólvora Extra', cost: 220, desc: '+15 radio de explosión.', apply: s => { s.radius += 15; } },
          { name: 'Proyectil Pesado', cost: 560, desc: '+5 daño.', apply: s => { s.dmg += 5; } },
          { name: 'Bombas de Racimo', cost: 1600, desc: 'Cada bomba suelta 4 bombitas extra.', apply: s => { s.cluster = 4; } },
          { name: 'Meteoro', cost: 7500, desc: '+55 daño, radio enorme, aturde. HABILIDAD AUTOMÁTICA: lluvia de meteoros.', apply: s => { s.dmg += 55; s.radius += 40; s.stun = 0.6; s.ability = 'meteors'; } }
        ] },
        { name: 'Brea', ups: [
          { name: 'Brea Pegajosa', cost: 240, desc: 'Ralentiza un 35% durante 2 s.', apply: s => { s.slow = 0.35; s.slowDur = 2; } },
          { name: 'Recarga Rápida', cost: 500, desc: 'Dispara un 25% más rápido.', apply: s => { s.cd *= 0.75; } },
          { name: 'Brea Ardiente', cost: 1400, desc: 'Deja charcos ardientes (6 daño/s, 3 s).', apply: s => { s.puddleDps = 6; s.puddleDur = 3; } },
          { name: 'Volcán de Brea', cost: 6800, desc: '3 bombas por disparo y charcos de 20 daño/s.', apply: s => { s.shells = 3; s.puddleDps = 20; s.cd *= 0.8; } }
        ] }
      ]
    },

    prisma: {
      name: 'Prisma Solar', cost: 680, kind: 'beam', size: 16, color: '#ffb84d', targeting: true,
      desc: 'Rayo continuo de daño ARCANO (ignora blindaje y fases) que se intensifica sobre el mismo objetivo.',
      base: { range: 140, dps: 6, rampMax: 4, rampTime: 3, beams: 1, dtype: 'arcane' },
      paths: [
        { name: 'Concentración', ups: [
          { name: 'Lente Pulida', cost: 300, desc: '+4 daño/s.', apply: s => { s.dps += 4; } },
          { name: 'Concentración', cost: 750, desc: 'El rayo se intensifica hasta x7.', apply: s => { s.rampMax = 7; } },
          { name: 'Desintegrador', cost: 2200, desc: '+8 daño/s y x3 contra jefes.', apply: s => { s.dps += 8; s.bossMult = 3; } },
          { name: 'Rayo del Cenit', cost: 9500, desc: '+100 daño/s. El rayo atraviesa todo lo que hay en su línea.', apply: s => { s.dps += 100; s.line = true; } }
        ] },
        { name: 'Refracción', ups: [
          { name: 'Gran Angular', cost: 260, desc: '+30 alcance.', apply: s => { s.range += 30; } },
          { name: 'Refracción', cost: 900, desc: 'Divide el rayo en 2 objetivos.', apply: s => { s.beams = 2; } },
          { name: 'Espectro Total', cost: 1800, desc: '3 rayos y detecta CAMUFLADOS.', apply: s => { s.beams = 3; s.camo = true; } },
          { name: 'Corona Solar', cost: 9000, desc: '5 rayos, +20 daño/s. HABILIDAD AUTOMÁTICA: Supernova (1500 de daño en área).', apply: s => { s.beams = 5; s.dps += 20; s.ability = 'supernova'; } }
        ] }
      ]
    },

    colmena: {
      name: 'Colmena Mecánica', cost: 720, kind: 'hive', size: 17, color: '#e8c547', targeting: true,
      desc: 'Fabrica drones que patrullan y disparan a cualquier enemigo cercano, incluso voladores.',
      base: { range: 150, drones: 2, droneDmg: 2, droneCd: 0.6, droneRange: 100, dtype: 'phys', pierce: 1 },
      paths: [
        { name: 'Enjambre', ups: [
          { name: 'Larvas Extra', cost: 300, desc: '+1 dron.', apply: s => { s.drones += 1; } },
          { name: 'Enjambre', cost: 700, desc: '+2 drones.', apply: s => { s.drones += 2; } },
          { name: 'Drones Kamikaze', cost: 2000, desc: 'Los drones se lanzan contra los enemigos y explotan (25 daño en área).', apply: s => { s.kamikaze = 25; s.kamiRadius = 55; s.kamiEvery = 5; } },
          { name: 'Reina Colmena', cost: 9000, desc: '+5 drones, +6 daño y explosiones de 120.', apply: s => { s.drones += 5; s.droneDmg += 6; s.kamikaze = 120; s.kamiRadius = 70; } }
        ] },
        { name: 'Tecnología', ups: [
          { name: 'Alas Rápidas', cost: 250, desc: 'Los drones disparan un 25% más rápido.', apply: s => { s.droneCd *= 0.75; } },
          { name: 'Sensores', cost: 320, desc: 'Detectan CAMUFLADOS y +20 alcance de dron.', apply: s => { s.camo = true; s.droneRange += 20; } },
          { name: 'Láser Arcano', cost: 1800, desc: 'Disparos ARCANOS con +3 daño.', apply: s => { s.dtype = 'arcane'; s.droneDmg += 3; } },
          { name: 'Nave Nodriza', cost: 8500, desc: 'Despliega una nave nodriza que lanza misiles explosivos (60 daño).', apply: s => { s.mothership = true; s.droneCd *= 0.8; } }
        ] }
      ]
    },

    ancla: {
      name: 'Ancla Gravitacional', cost: 820, kind: 'gravity', size: 18, color: '#9b6bff',
      desc: 'Genera pulsos de gravedad que hacen RETROCEDER a los enemigos por el camino.',
      base: { range: 100, cd: 4, pull: 45, dmg: 2, dtype: 'phys' },
      paths: [
        { name: 'Distorsión', ups: [
          { name: 'Distorsión', cost: 320, desc: 'Retroceso de 75.', apply: s => { s.pull = 75; } },
          { name: 'Pulso Constante', cost: 650, desc: 'Pulsa cada 3 s.', apply: s => { s.cd = 3; } },
          { name: 'Colapso', cost: 2500, desc: 'Retroceso de 120 y aturde 1 s.', apply: s => { s.pull = 120; s.stun = 1; } },
          { name: 'Horizonte de Sucesos', cost: 9500, desc: '+40 daño, pulsa cada 2 s y ahora afecta a los JEFES.', apply: s => { s.dmg += 40; s.cd = 2; s.bossPull = 0.5; } }
        ] },
        { name: 'Masa', ups: [
          { name: 'Masa Crítica', cost: 300, desc: '+25 alcance.', apply: s => { s.range += 25; } },
          { name: 'Aplastar', cost: 800, desc: '+10 daño, x2 contra blindados.', apply: s => { s.dmg += 10; s.armorMult = 2; } },
          { name: 'Pozo Gravitatorio', cost: 1800, desc: 'Ralentiza un 30% de forma constante en su área.', apply: s => { s.slowAura = 0.3; } },
          { name: 'Agujero Negro', cost: 8000, desc: '+15 daño. HABILIDAD AUTOMÁTICA: crea un agujero negro que absorbe y tritura enemigos.', apply: s => { s.dmg += 15; s.ability = 'blackhole'; } }
        ] }
      ]
    },

    huerto: {
      name: 'Huerto de Cristal', cost: 900, kind: 'farm', size: 18, color: '#4be3b0',
      desc: 'No ataca: cultiva cristales que generan dinero al final de cada ronda.',
      base: { range: 110, income: 80, incomeMult: 1 },
      paths: [
        { name: 'Cosecha', ups: [
          { name: 'Brotes Fértiles', cost: 500, desc: '+50 por ronda.', apply: s => { s.income += 50; } },
          { name: 'Cosecha Abundante', cost: 1200, desc: '+120 por ronda.', apply: s => { s.income += 120; } },
          { name: 'Geodas', cost: 3000, desc: '+300 por ronda.', apply: s => { s.income += 300; } },
          { name: 'Mina de Diamantes', cost: 12000, desc: '+1000 por ronda.', apply: s => { s.income += 1000; } }
        ] },
        { name: 'Mercado', ups: [
          { name: 'Abono Mineral', cost: 350, desc: '+25% de producción.', apply: s => { s.incomeMult = 1.25; } },
          { name: 'Gremio Comercial', cost: 800, desc: 'Las mejoras de torres en su área cuestan un 10% menos.', apply: s => { s.discount = 0.1; } },
          { name: 'Interés Compuesto', cost: 2500, desc: 'Al final de ronda gana un 3% de tu dinero (máx. 600).', apply: s => { s.interest = 0.03; } },
          { name: 'Tesoro Estelar', cost: 9000, desc: 'Descuento del 20%. HABILIDAD AUTOMÁTICA: +2500 de oro al instante.', apply: s => { s.discount = 0.2; s.ability = 'treasure'; } }
        ] }
      ]
    },

    totem: {
      name: 'Tótem del Eco', cost: 760, kind: 'support', size: 16, color: '#e07bff',
      desc: 'Apoyo: acelera un 15% el ataque de las torres cercanas.',
      base: { range: 110, buffRate: 0.15 },
      paths: [
        { name: 'Ritmo', ups: [
          { name: 'Ritmo Tribal', cost: 400, desc: 'Las torres cercanas atacan un 25% más rápido.', apply: s => { s.buffRate = 0.25; } },
          { name: 'Visión Lejana', cost: 700, desc: '+15% de alcance a las torres cercanas.', apply: s => { s.buffRange = 0.15; } },
          { name: 'Ojo Espiritual', cost: 1200, desc: 'Otorga detección de CAMUFLADOS a las torres cercanas.', apply: s => { s.buffCamo = true; } },
          { name: 'Tambor de Guerra', cost: 8000, desc: '+50% velocidad y +2 perforación. HABILIDAD AUTOMÁTICA: todas las torres x2 velocidad 8 s.', apply: s => { s.buffRate = 0.5; s.buffPierce = 2; s.ability = 'wardrum'; } }
        ] },
        { name: 'Resonancia', ups: [
          { name: 'Resonancia', cost: 500, desc: '+1 daño a las torres cercanas.', apply: s => { s.buffDmg = 1; } },
          { name: 'Frecuencia Rompedora', cost: 1500, desc: 'Las torres cercanas ignoran el 50% del blindaje.', apply: s => { s.buffArmor = 0.5; } },
          { name: 'Eco Potente', cost: 2500, desc: '+3 daño a las torres cercanas.', apply: s => { s.buffDmg = 3; } },
          { name: 'Eco Ancestral', cost: 10000, desc: 'Las torres cercanas hacen un 50% más de daño e ignoran el blindaje.', apply: s => { s.buffDmgMult = 1.5; s.buffArmor = 1; } }
        ] }
      ]
    },

    vigia: {
      name: 'Vigía Arcano', cost: 420, kind: 'sniper', size: 15, color: '#7a8cff', targeting: true, defaultTarget: 'strong',
      desc: 'Francotirador de MUY LARGO alcance. Golpe instantáneo y certero, ideal contra enemigos duros.',
      base: { range: 250, cd: 1.8, dmg: 6, dtype: 'phys', armorPierce: 0.3 },
      paths: [
        { name: 'Calibre', ups: [
          { name: 'Bala Pesada', cost: 350, desc: '+6 daño.', apply: s => { s.dmg += 6; } },
          { name: 'Calibre Perforante', cost: 1200, desc: '+15 daño e ignora el blindaje.', apply: s => { s.dmg += 15; s.armorPierce = 1; } },
          { name: 'Rompeescudos', cost: 3000, desc: '+10 daño, +50 alcance, x3 contra escudos y x2 contra jefes.', apply: s => { s.dmg += 10; s.range += 50; s.shieldMult = 3; s.bossMult = 2; } },
          { name: 'Cazagigantes', cost: 9000, desc: '+140 daño, +60 alcance y x3 contra jefes.', apply: s => { s.dmg += 140; s.range += 60; s.bossMult = 3; } }
        ] },
        { name: 'Cadencia', ups: [
          { name: 'Cerrojo Rápido', cost: 300, desc: 'Dispara un 25% más rápido.', apply: s => { s.cd *= 0.75; } },
          { name: 'Visor Nocturno', cost: 400, desc: 'Detecta CAMUFLADOS y +30 alcance.', apply: s => { s.camo = true; s.range += 30; } },
          { name: 'Ametralladora Arcana', cost: 2800, desc: 'Ráfagas ARCANAS: 0.35 s entre disparos, pero −60 alcance.', apply: s => { s.cd = 0.35; s.dtype = 'arcane'; s.range -= 60; } },
          { name: 'Ojo del Vacío', cost: 9500, desc: '0.12 s entre disparos, +40 alcance y cada bala rebota a 2 enemigos más.', apply: s => { s.cd = 0.12; s.bounces = 2; s.range += 40; } }
        ] }
      ]
    },

    sembrador: {
      name: 'Sembrador de Minas', cost: 520, kind: 'mines', size: 16, color: '#d9534f',
      desc: 'Siembra minas en el camino dentro de su alcance. No afectan a voladores.',
      base: { range: 100, cd: 2, maxMines: 10, mineDmg: 8, mineRadius: 32, dtype: 'explosive', armorPierce: 0.5, noFlying: true },
      paths: [
        { name: 'Explosivos', ups: [
          { name: 'Pólvora Negra', cost: 250, desc: '+6 daño por mina.', apply: s => { s.mineDmg += 6; } },
          { name: 'Onda Expansiva', cost: 450, desc: '+15 radio de explosión.', apply: s => { s.mineRadius += 15; } },
          { name: 'Minas de Racimo', cost: 1500, desc: 'Cada mina suelta 3 cargas secundarias.', apply: s => { s.mineCluster = 3; } },
          { name: 'Cabeza Nuclear', cost: 7000, desc: '+140 daño, radio gigante y aturde.', apply: s => { s.mineDmg += 140; s.mineRadius += 45; s.stun = 0.5; } }
        ] },
        { name: 'Producción', ups: [
          { name: 'Siembra Rápida', cost: 200, desc: 'Coloca minas cada 1.4 s.', apply: s => { s.cd = 1.4; } },
          { name: 'Arsenal', cost: 400, desc: 'Hasta 20 minas activas.', apply: s => { s.maxMines = 20; } },
          { name: 'Minas de Cristal', cost: 1200, desc: 'Las explosiones congelan 1 s.', apply: s => { s.mineFreeze = 1; } },
          { name: 'Campo Minado', cost: 6500, desc: 'Una mina cada 0.3 s, hasta 40, +10 daño.', apply: s => { s.cd = 0.3; s.maxMines = 40; s.mineDmg += 10; } }
        ] }
      ]
    },

    dragon: {
      name: 'Lanzallamas Dracónico', cost: 620, kind: 'flame', size: 17, color: '#ff6a2b', targeting: true,
      desc: 'Escupe un cono de fuego que quema a todo lo que toca. Ignora blindaje.',
      base: { range: 90, cd: 0.12, dmg: 0.8, cone: 0.45, burnDps: 2, burnDur: 2, dtype: 'fire' },
      paths: [
        { name: 'Calor', ups: [
          { name: 'Brasas Vivas', cost: 300, desc: 'Quemadura de 5/s durante 3 s.', apply: s => { s.burnDps = 5; s.burnDur = 3; } },
          { name: 'Combustión', cost: 600, desc: '+0.8 daño por llamarada.', apply: s => { s.dmg += 0.8; } },
          { name: 'Llama Azul', cost: 2200, desc: '+2 daño, quemadura 10/s y daña al 50% a inmunes al fuego.', apply: s => { s.dmg += 2; s.burnDps = 10; s.fireFloor = 0.5; } },
          { name: 'Aliento de Dragón', cost: 8500, desc: '+10 daño, cono enorme, quemadura 40/s.', apply: s => { s.dmg += 10; s.cone = 0.8; s.burnDps = 40; s.range += 20; } }
        ] },
        { name: 'Alcance', ups: [
          { name: 'Boquilla Larga', cost: 250, desc: '+25 alcance.', apply: s => { s.range += 25; } },
          { name: 'Abanico', cost: 400, desc: 'Cono mucho más ancho.', apply: s => { s.cone = Math.max(s.cone, 0.75); } },
          { name: 'Napalm', cost: 1700, desc: 'Al morir, los enemigos quemados contagian el fuego.', apply: s => { s.napalm = true; } },
          { name: 'Infierno', cost: 8000, desc: '+15 quemadura. HABILIDAD AUTOMÁTICA: anillo de fuego de 400 daño/s.', apply: s => { s.burnDps += 15; s.ability = 'inferno'; } }
        ] }
      ]
    },

    // =================== DEFENSAS DE REINO (2 nuevas por reino) ===================
    // ---------------------------- Reino 1 · Prado ----------------------------
    bumeran: {
      name: 'Cazador de Bumeranes', cost: 300, kind: 'boomerang', size: 16, color: '#d09a4a', targeting: true, realm: 0,
      desc: 'Lanza un bumerán que golpea a la ida Y a la vuelta. Ideal en curvas cerradas del camino.',
      base: { range: 140, cd: 1.3, dmg: 3, pierce: 6, rangSpeed: 330, count: 1, dtype: 'phys' },
      paths: [
        { name: 'Filo', ups: [
          { name: 'Madera Dura', cost: 160, desc: '+2 daño y +2 perforación.', apply: s => { s.dmg += 2; s.pierce += 2; } },
          { name: 'Doble Bumerán', cost: 420, desc: 'Lanza 2 bumeranes en arcos opuestos.', apply: s => { s.count = 2; } },
          { name: 'Filo de Obsidiana', cost: 1200, desc: '+6 daño, +6 perforación e ignora la mitad del blindaje.', apply: s => { s.dmg += 6; s.pierce += 6; s.armorPierce = 0.5; } },
          { name: 'Gran Chakram', cost: 5400, desc: '3 chakrams gigantes: +35 daño, +25 perforación y x2 contra jefes.', apply: s => { s.count = 3; s.dmg += 35; s.pierce += 25; s.bossMult = 2; s.big = true; } }
        ] },
        { name: 'Viento', ups: [
          { name: 'Brazo Fuerte', cost: 140, desc: '+35 alcance.', apply: s => { s.range += 35; } },
          { name: 'Vuelo Veloz', cost: 330, desc: 'Lanza un 25% más rápido y el bumerán vuela más veloz.', apply: s => { s.cd *= 0.75; s.rangSpeed += 90; } },
          { name: 'Corriente de Aire', cost: 1000, desc: 'Cada golpe EMPUJA al enemigo hacia atrás y +3 perforación.', apply: s => { s.push = 16; s.pierce += 3; } },
          { name: 'Huracán de Hojas', cost: 5600, desc: 'Lanza sin parar (0.45 s), +12 daño y empujes más fuertes.', apply: s => { s.cd = 0.45; s.dmg += 12; s.push = 26; s.rangSpeed += 80; } }
        ] }
      ]
    },

    raices: {
      name: 'Guardabosques', cost: 420, kind: 'barrier', size: 17, color: '#7aa83a', realm: 0,
      desc: 'Hace brotar MURALLAS DE RAÍCES en el camino que detienen a los enemigos terrestres hasta que las rompen. No frena a voladores ni jefes.',
      base: { range: 105, cd: 3.4, maxWalls: 2, wallHp: 14, wallLife: 7, blockCap: 3.5, dtype: 'phys' },
      paths: [
        { name: 'Roble', ups: [
          { name: 'Corteza Gruesa', cost: 220, desc: 'Murallas un 60% más resistentes.', apply: s => { s.wallHp += 9; } },
          { name: 'Raíces Espinosas', cost: 480, desc: 'Los enemigos detenidos sufren 5 daño/s.', apply: s => { s.thornDps = 5; } },
          { name: 'Roble Milenario', cost: 1500, desc: 'Murallas mucho más duras y duraderas. Espinas de 16 daño/s.', apply: s => { s.wallHp += 30; s.wallLife += 3; s.thornDps = 16; s.blockCap += 1; } },
          { name: 'Árbol Guardián', cost: 6500, desc: 'Murallas colosales que también FRENAN A LOS JEFES 1.5 s. Espinas de 70 daño/s.', apply: s => { s.wallHp += 90; s.thornDps = 70; s.bossHold = 1.5; s.blockCap += 1.5; } }
        ] },
        { name: 'Enredadera', ups: [
          { name: 'Brotes Rápidos', cost: 180, desc: 'Las raíces brotan un 30% más rápido.', apply: s => { s.cd *= 0.7; } },
          { name: 'Más Raíces', cost: 420, desc: 'Hasta 4 murallas y +25 alcance.', apply: s => { s.maxWalls = 4; s.range += 25; } },
          { name: 'Savia Pegajosa', cost: 1300, desc: 'Al romperse, la muralla ralentiza un 50% y envenena (8/s) a los cercanos.', apply: s => { s.sap = 8; } },
          { name: 'Bosque Viviente', cost: 6000, desc: 'Hasta 7 murallas que brotan sin parar. Savia de 40/s.', apply: s => { s.maxWalls = 7; s.cd *= 0.5; s.sap = 40; } }
        ] }
      ]
    },

    // ---------------------------- Reino 2 · Dunas ----------------------------
    sierra: {
      name: 'Taller de Sierras', cost: 380, kind: 'saw', size: 17, color: '#b8c0cc', realm: 1,
      desc: 'Lanza sierras que RUEDAN POR EL CAMINO en contra de los enemigos, cortando a todos los que encuentran. No alcanza voladores.',
      base: { range: 115, cd: 2.2, dmg: 4, pierce: 8, sawSpeed: 230, sawDist: 380, saws: 1, dtype: 'phys', noFlying: true },
      paths: [
        { name: 'Acero', ups: [
          { name: 'Dientes Afilados', cost: 180, desc: '+3 daño.', apply: s => { s.dmg += 3; } },
          { name: 'Acero Templado', cost: 450, desc: '+2 daño y +8 perforación.', apply: s => { s.dmg += 2; s.pierce += 8; } },
          { name: 'Sierra de Diamante', cost: 1500, desc: '+10 daño, +10 perforación e ignora el blindaje.', apply: s => { s.dmg += 10; s.pierce += 10; s.armorPierce = 1; } },
          { name: 'Gran Trituradora', cost: 6800, desc: 'Sierras gigantes: +60 daño, +50 perforación, x2 contra jefes.', apply: s => { s.dmg += 60; s.pierce += 50; s.bossMult = 2; s.big = true; } }
        ] },
        { name: 'Línea de Montaje', ups: [
          { name: 'Engranajes', cost: 200, desc: 'Lanza un 25% más rápido.', apply: s => { s.cd *= 0.75; } },
          { name: 'Sierras Dobles', cost: 520, desc: '2 sierras por lanzamiento.', apply: s => { s.saws = 2; } },
          { name: 'Filo Dentado', cost: 1250, desc: 'Los cortes provocan SANGRADO: 6 daño/s durante 3 s.', apply: s => { s.bleed = 6; } },
          { name: 'Tormenta de Acero', cost: 6200, desc: '4 sierras cada segundo que recorren mucho más camino. Sangrado 30/s.', apply: s => { s.saws = 4; s.cd = 1; s.bleed = 30; s.sawDist += 500; } }
        ] }
      ]
    },

    acido: {
      name: 'Alquimista Corrosivo', cost: 460, kind: 'acid', size: 16, color: '#9be04a', targeting: true, realm: 1,
      desc: 'Lanza frascos de ácido que CORROEN: cada carga quita 1 de blindaje y hace que el enemigo reciba más daño de todo.',
      base: { range: 140, cd: 1.6, dmg: 1, radius: 34, corr: 1, corrMax: 3, corrAmp: 0.05, acidDps: 2, acidDur: 3, dtype: 'poison' },
      paths: [
        { name: 'Corrosión', ups: [
          { name: 'Ácido Fuerte', cost: 220, desc: '2 cargas de corrosión por golpe (máx. 5).', apply: s => { s.corr = 2; s.corrMax = 5; } },
          { name: 'Disolvente', cost: 540, desc: 'x3 contra escudos y máximo de 8 cargas.', apply: s => { s.shieldMult = 3; s.corrMax = 8; } },
          { name: 'Fundición', cost: 1600, desc: 'Cada carga aumenta el daño recibido un 9% (antes 5%).', apply: s => { s.corrAmp = 0.09; s.acidDps += 6; } },
          { name: 'Agua Regia', cost: 7000, desc: 'Hasta 15 cargas, +20 daño y ácido de 60 daño/s.', apply: s => { s.corrMax = 15; s.dmg += 20; s.acidDps = 60; s.corrAmp = 0.1; } }
        ] },
        { name: 'Alquimia', ups: [
          { name: 'Frasco Grande', cost: 200, desc: '+15 radio de salpicadura.', apply: s => { s.radius += 15; } },
          { name: 'Destilación Rápida', cost: 460, desc: 'Lanza un 25% más rápido.', apply: s => { s.cd *= 0.75; } },
          { name: 'Transmutación', cost: 1400, desc: 'Los enemigos corroídos dan un 50% más de oro al morir.', apply: s => { s.goldMult = 1.5; } },
          { name: 'Lluvia Ácida', cost: 6500, desc: '3 frascos por lanzamiento que dejan charcos ácidos (25 daño/s).', apply: s => { s.shells = 3; s.radius += 15; s.puddleDps = 25; s.acidDps += 10; } }
        ] }
      ]
    },

    // --------------------------- Reino 3 · Glaciar ---------------------------
    faro: {
      name: 'Faro Boreal', cost: 320, kind: 'beacon', size: 16, color: '#fff1a8', realm: 2,
      desc: 'Su luz REVELA a los enemigos camuflados: cualquier torre puede atacarlos mientras estén iluminados.',
      base: { range: 120 },
      paths: [
        { name: 'Luz', ups: [
          { name: 'Lente Grande', cost: 160, desc: '+30 alcance de luz.', apply: s => { s.range += 30; } },
          { name: 'Luz Boreal', cost: 420, desc: 'Los iluminados se mueven un 15% más lento.', apply: s => { s.slowAura = 0.15; } },
          { name: 'Luz Delatora', cost: 1500, desc: 'Los iluminados reciben un 15% más de daño de todo.', apply: s => { s.lightAmp = 0.15; s.range += 15; } },
          { name: 'Aurora Eterna', cost: 7000, desc: '+50 alcance, +35% de daño recibido, 30% de lentitud y anula las FASES.', apply: s => { s.range += 50; s.lightAmp = 0.35; s.slowAura = 0.3; s.lightPhase = true; } }
        ] },
        { name: 'Destello', ups: [
          { name: 'Destello', cost: 250, desc: 'Cada 3 s un destello inflige 6 de daño arcano a todo lo iluminado.', apply: s => { s.flashDmg = 6; s.flashCd = 3; } },
          { name: 'Ceguera', cost: 600, desc: 'El destello aturde 0.4 s.', apply: s => { s.flashStun = 0.4; } },
          { name: 'Prisma Boreal', cost: 1600, desc: 'Destello de 30 daño cada 2 s.', apply: s => { s.flashDmg = 30; s.flashCd = 2; } },
          { name: 'Estrella Polar', cost: 7500, desc: 'Destello de 120 daño cada 1.4 s, x2 contra jefes.', apply: s => { s.flashDmg = 120; s.flashCd = 1.4; s.flashStun = 0.5; s.bossMult = 2; } }
        ] }
      ]
    },

    balista: {
      name: 'Balista Rúnica', cost: 560, kind: 'rail', size: 17, color: '#8fd0ff', targeting: true, realm: 2,
      desc: 'Dispara un virote que ATRAVIESA en línea recta a todos los enemigos que encuentre a su paso.',
      base: { range: 190, cd: 2.4, dmg: 10, width: 9, bolts: 1, dtype: 'phys', armorPierce: 0.5 },
      paths: [
        { name: 'Perforación', ups: [
          { name: 'Punta de Acero', cost: 260, desc: '+8 daño.', apply: s => { s.dmg += 8; } },
          { name: 'Runas de Escarcha', cost: 560, desc: 'Los virotes ralentizan un 40% durante 2 s.', apply: s => { s.slow = 0.4; s.slowDur = 2; } },
          { name: 'Arpón Pesado', cost: 1700, desc: '+30 daño, ignora el blindaje y EMPUJA hacia atrás.', apply: s => { s.dmg += 30; s.armorPierce = 1; s.push = 30; } },
          { name: 'Lanza del Glaciar', cost: 7500, desc: '+130 daño, virote enorme que CONGELA 1 s y x2.5 contra jefes.', apply: s => { s.dmg += 130; s.width = 20; s.freeze = 1; s.bossMult = 2.5; } }
        ] },
        { name: 'Mecanismo', ups: [
          { name: 'Tensores', cost: 220, desc: 'Dispara un 20% más rápido.', apply: s => { s.cd *= 0.8; } },
          { name: 'Mira Rúnica', cost: 420, desc: 'Detecta CAMUFLADOS y +40 alcance.', apply: s => { s.camo = true; s.range += 40; } },
          { name: 'Triple Virote', cost: 1600, desc: 'Dispara 3 virotes en abanico.', apply: s => { s.bolts = 3; } },
          { name: 'Tormenta de Virotes', cost: 7000, desc: '5 virotes cada 0.6 s y +20 daño.', apply: s => { s.bolts = 5; s.cd = 0.6; s.dmg += 20; } }
        ] }
      ]
    },

    // --------------------------- Reino 4 · Caldera ---------------------------
    forja: {
      name: 'Forja de Gólems', cost: 650, kind: 'barracks', size: 18, color: '#ff7a3a', realm: 3,
      desc: 'Forja gólems de magma que se plantan en el camino, BLOQUEAN a los enemigos y los golpean cuerpo a cuerpo.',
      base: { range: 115, golems: 2, golemHp: 30, golemDmg: 7, golemCd: 7, block: 1, blockCap: 4, dtype: 'phys' },
      paths: [
        { name: 'Forja', ups: [
          { name: 'Acero Fundido', cost: 300, desc: '+5 daño y gólems más resistentes.', apply: s => { s.golemDmg += 5; s.golemHp += 15; } },
          { name: 'Martillos', cost: 720, desc: '+8 daño y sus golpes alcanzan a todos los enemigos que tocan.', apply: s => { s.golemDmg += 8; s.golemSplash = true; } },
          { name: 'Gólem de Obsidiana', cost: 2000, desc: '+20 daño, mucho más vida y bloquea a 2 enemigos a la vez.', apply: s => { s.golemDmg += 20; s.golemHp += 50; s.block = 2; s.armorPierce = 1; } },
          { name: 'Titán de Magma', cost: 8000, desc: '+90 daño, vida enorme, bloquea a 3 y FRENA A LOS JEFES.', apply: s => { s.golemDmg += 90; s.golemHp += 200; s.block = 3; s.bossBlock = 2; s.blockCap += 2; } }
        ] },
        { name: 'Legión', ups: [
          { name: 'Moldes Extra', cost: 350, desc: '+1 gólem.', apply: s => { s.golems += 1; } },
          { name: 'Forja Rápida', cost: 520, desc: 'Los gólems caídos se reforjan el doble de rápido.', apply: s => { s.golemCd *= 0.5; } },
          { name: 'Núcleo Inestable', cost: 1500, desc: 'Al caer, el gólem EXPLOTA (60 daño en área).', apply: s => { s.golemBoom = 60; } },
          { name: 'Legión Ígnea', cost: 7000, desc: '+3 gólems que queman lo que bloquean (25/s). Explosión de 300.', apply: s => { s.golems += 3; s.golemBurn = 25; s.golemBoom = 300; } }
        ] }
      ]
    },

    geiser: {
      name: 'Géiser Hirviente', cost: 500, kind: 'geyser', size: 17, color: '#6fd6e8', targeting: true, realm: 3,
      desc: 'Hace estallar géiseres bajo los enemigos: los LEVANTA (aturde) y los MOJA. Mojados reciben x1.5 de electricidad y pierden la inmunidad al fuego.',
      base: { range: 115, cd: 2.2, dmg: 4, radius: 38, lift: 0.4, wetDur: 4, erupts: 1, dtype: 'steam', noFlying: true },
      paths: [
        { name: 'Presión', ups: [
          { name: 'Alta Presión', cost: 220, desc: '+4 daño y +10 radio.', apply: s => { s.dmg += 4; s.radius += 10; } },
          { name: 'Columna de Agua', cost: 520, desc: 'Levanta durante más tiempo y EMPUJA hacia atrás.', apply: s => { s.lift = 0.7; s.push = 24; } },
          { name: 'Erupción Doble', cost: 1500, desc: '2 géiseres por ataque y +10 daño.', apply: s => { s.erupts = 2; s.dmg += 10; } },
          { name: 'Supergéiser', cost: 7000, desc: '3 géiseres enormes de +80 daño que alcanzan a VOLADORES.', apply: s => { s.erupts = 3; s.dmg += 80; s.radius += 25; s.noFlying = false; } }
        ] },
        { name: 'Vapor', ups: [
          { name: 'Nube de Vapor', cost: 200, desc: 'Deja una nube de vapor (4 daño/s) durante 2.5 s.', apply: s => { s.cloudDps = 4; } },
          { name: 'Agua Salada', cost: 600, desc: 'Mojados reciben x2 de electricidad y un 15% más de todo.', apply: s => { s.wetElec = 2; s.wetAmp = 0.15; } },
          { name: 'Vapor Escaldante', cost: 1400, desc: 'Nubes de 20 daño/s que duran más.', apply: s => { s.cloudDps = 20; s.wetDur = 6; } },
          { name: 'Tormenta de Vapor', cost: 6800, desc: 'Ataca el doble de rápido con nubes de 70 daño/s.', apply: s => { s.cd *= 0.5; s.cloudDps = 70; s.wetDur = 8; } }
        ] }
      ]
    },

    // ---------------------------- Reino 5 · Vacío ----------------------------
    obelisco: {
      name: 'Obelisco de la Maldición', cost: 600, kind: 'hex', size: 16, color: '#b05cff', targeting: true, defaultTarget: 'strong', realm: 4,
      desc: 'MALDICE a varios enemigos: reciben un 25% más de daño de TODAS las torres durante 5 s.',
      base: { range: 140, cd: 2.4, targets: 2, hexAmp: 0.25, hexDur: 5, dmg: 2, dtype: 'arcane' },
      paths: [
        { name: 'Maldición', ups: [
          { name: 'Maldición Profunda', cost: 320, desc: 'Los malditos reciben un 40% más de daño.', apply: s => { s.hexAmp = 0.4; } },
          { name: 'Marca del Vacío', cost: 720, desc: 'Los malditos pierden el CAMUFLAJE y 2 de blindaje.', apply: s => { s.hexReveal = true; s.hexArmor = 2; } },
          { name: 'Condena', cost: 2000, desc: 'Los malditos (no jefes) mueren al instante bajo el 15% de vida.', apply: s => { s.hexExec = 0.15; s.hexAmp = 0.5; } },
          { name: 'Sentencia Final', cost: 8500, desc: '+80% de daño recibido, ejecuta bajo el 25% y maldice a los JEFES por completo.', apply: s => { s.hexAmp = 0.8; s.hexExec = 0.25; s.hexBoss = true; } }
        ] },
        { name: 'Contagio', ups: [
          { name: 'Tres Marcas', cost: 260, desc: 'Maldice a 3 enemigos.', apply: s => { s.targets = 3; } },
          { name: 'Sombra Alargada', cost: 520, desc: '+40 alcance y maldice un 25% más rápido.', apply: s => { s.range += 40; s.cd *= 0.75; } },
          { name: 'Plaga', cost: 1500, desc: 'Al morir, un maldito contagia la maldición a 2 enemigos cercanos.', apply: s => { s.hexSpread = 2; s.targets = 4; } },
          { name: 'Pandemia', cost: 7500, desc: 'Maldice a 8 cada segundo y la maldición quema 40 daño/s.', apply: s => { s.targets = 8; s.cd = 1; s.hexDps = 40; s.hexSpread = 3; } }
        ] }
      ]
    },

    segador: {
      name: 'Segador del Vacío', cost: 700, kind: 'blades', size: 17, color: '#7a4dff', realm: 4,
      desc: 'Guadañas que GIRAN a su alrededor cortando a todo lo que pase cerca, incluso camuflados y voladores. Corto alcance.',
      base: { range: 72, blades: 2, dmg: 4, hitCd: 0.4, spinSpd: 2.6, dtype: 'phys' },
      paths: [
        { name: 'Filo', ups: [
          { name: 'Acero del Vacío', cost: 300, desc: '+5 daño.', apply: s => { s.dmg += 5; } },
          { name: 'Tres Guadañas', cost: 650, desc: '3 guadañas.', apply: s => { s.blades = 3; } },
          { name: 'Filo Arcano', cost: 1800, desc: 'Daño ARCANO (ignora blindaje y fases) y +12 daño.', apply: s => { s.dtype = 'arcane'; s.dmg += 12; } },
          { name: 'Guadaña de la Muerte', cost: 8000, desc: '4 guadañas, +80 daño y EJECUTA a los enemigos bajo el 12% de vida.', apply: s => { s.blades = 4; s.dmg += 80; s.exec = 0.12; s.bossMult = 2; } }
        ] },
        { name: 'Torbellino', ups: [
          { name: 'Giro Rápido', cost: 260, desc: 'Giran un 50% más rápido.', apply: s => { s.spinSpd *= 1.5; s.hitCd *= 0.8; } },
          { name: 'Brazo Largo', cost: 480, desc: '+28 alcance.', apply: s => { s.range += 28; } },
          { name: 'Vórtice', cost: 1500, desc: 'Los cortes ralentizan un 35% y +4 daño.', apply: s => { s.slow = 0.35; s.dmg += 4; } },
          { name: 'Remolino del Vacío', cost: 7500, desc: '6 guadañas que giran el doble de rápido y +20 daño.', apply: s => { s.blades = 6; s.spinSpd *= 2; s.hitCd = 0.18; s.dmg += 20; } }
        ] }
      ]
    }
  };

  PD.ABILITIES = {
    absolute:  { name: 'Cero Absoluto', cd: 26, color: '#9be7ff', desc: 'Congela a todos los enemigos 4 s.' },
    judgement: { name: 'Juicio Celestial', cd: 24, color: '#ffe14d', desc: 'Fulmina a los 30 enemigos más fuertes.' },
    meteors:   { name: 'Lluvia de Meteoros', cd: 28, color: '#ff8a3d', desc: '12 meteoros sobre los enemigos.' },
    supernova: { name: 'Supernova', cd: 28, color: '#ffcf66', desc: '1500 de daño arcano en un área enorme.' },
    blackhole: { name: 'Agujero Negro', cd: 32, color: '#b48cff', desc: 'Absorbe y tritura enemigos 5 s.' },
    treasure:  { name: 'Tesoro Estelar', cd: 55, color: '#4be3b0', desc: '+2500 de oro.' },
    wardrum:   { name: 'Tambor de Guerra', cd: 34, color: '#e07bff', desc: 'Todas las torres x2 de velocidad 8 s.' },
    inferno:   { name: 'Infierno', cd: 30, color: '#ff5a1f', desc: 'Anillo de fuego de 400 daño/s durante 6 s.' }
  };

  PD.TOWER_ORDER = ['espinas', 'escarcha', 'vigia', 'voltaico', 'sembrador', 'mortero', 'dragon', 'prisma', 'colmena', 'totem', 'ancla', 'huerto',
    'bumeran', 'raices', 'sierra', 'acido', 'faro', 'balista', 'forja', 'geiser', 'obelisco', 'segador'];
  // Defensas disponibles en un reino: las 12 clásicas + las 2 nuevas de cada reino ya alcanzado.
  PD.towersFor = li => PD.TOWER_ORDER.filter(id => (T[id].realm || 0) <= li);
  for (const id in T) T[id].id = id;
  PD.TOWERS = T;
})();
