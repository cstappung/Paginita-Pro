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
      // Producción rebajada un 40 % (antes 80 / +50 / +120 / +300 / +1000, interés 3 % y tesoro de 2500):
      // llenar el mapa de huertos daba más oro del que se podía gastar.
      base: { range: 110, income: 48, incomeMult: 1 },
      paths: [
        { name: 'Cosecha', ups: [
          { name: 'Brotes Fértiles', cost: 500, desc: '+30 por ronda.', apply: s => { s.income += 30; } },
          { name: 'Cosecha Abundante', cost: 1200, desc: '+72 por ronda.', apply: s => { s.income += 72; } },
          { name: 'Geodas', cost: 3000, desc: '+180 por ronda.', apply: s => { s.income += 180; } },
          { name: 'Mina de Diamantes', cost: 12000, desc: '+600 por ronda.', apply: s => { s.income += 600; } }
        ] },
        { name: 'Mercado', ups: [
          { name: 'Abono Mineral', cost: 350, desc: '+25% de producción.', apply: s => { s.incomeMult = 1.25; } },
          { name: 'Gremio Comercial', cost: 800, desc: 'Las mejoras de torres en su área cuestan un 10% menos.', apply: s => { s.discount = 0.1; } },
          { name: 'Interés Compuesto', cost: 2500, desc: 'Al final de ronda gana un 2% de tu dinero (máx. 360).', apply: s => { s.interest = 0.02; } },
          { name: 'Tesoro Estelar', cost: 9000, desc: 'Descuento del 20%. HABILIDAD AUTOMÁTICA: +1500 de oro al instante.', apply: s => { s.discount = 0.2; s.ability = 'treasure'; } }
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
    },

    // ================== SEGUNDA ERA (reinos 6–10, en pruebas) ==================
    // Una defensa nueva por reino; cada reino nuevo vende además solo una parte de las
    // clásicas (levels.js: `torres`), cada vez menos.
    // ---------------------------- Reino 6 · Pantano ----------------------------
    bruja: {
      name: 'Choza de la Bruja', cost: 650, kind: 'frog', size: 17, color: '#7ac85a', targeting: true, realm: 5,
      desc: 'Lanza pociones que CONVIERTEN EN SAPO a los enemigos (no a grandes ni jefes): lentos, sin blindaje, sin camuflaje y sin poderes.',
      base: { range: 135, cd: 3, dmg: 3, radius: 30, frogDur: 2.2, frogAmp: 0, dtype: 'poison' },
      paths: [
        { name: 'Maleficio', ups: [
          { name: 'Verruga Doble', cost: 260, desc: 'El sapo dura 3 s.', apply: s => { s.frogDur = 3; } },
          { name: 'Sapo Torpe', cost: 620, desc: 'Los sapos reciben un 25% más de daño.', apply: s => { s.frogAmp = 0.25; } },
          { name: 'Gran Aquelarre', cost: 1900, desc: 'Más radio y también convierte a los GRANDES (1 s).', apply: s => { s.radius += 18; s.frogBig = 1; s.frogAmp = 0.35; } },
          { name: 'Reina de los Sapos', cost: 7800, desc: 'Sapos de 4.5 s que reciben un 60% más de daño; grandes 2 s.', apply: s => { s.frogDur = 4.5; s.frogAmp = 0.6; s.frogBig = 2; s.radius += 10; } }
        ] },
        { name: 'Pociones', ups: [
          { name: 'Caldero Rápido', cost: 240, desc: 'Lanza un 25% más rápido.', apply: s => { s.cd *= 0.75; } },
          { name: 'Veneno de Mandrágora', cost: 520, desc: 'Las pociones envenenan 8 daño/s durante 3 s.', apply: s => { s.acidDps = 8; s.acidDur = 3; } },
          { name: 'Charco Hechizado', cost: 1600, desc: 'Deja un charco que ralentiza un 40% y daña 20/s.', apply: s => { s.puddleDps = 20; s.puddleSlow = 0.4; s.acidDps = 18; } },
          { name: 'Caldero Hirviente', cost: 7200, desc: '3 pociones por lanzamiento, veneno 60/s y charcos de 60/s.', apply: s => { s.shells = 3; s.acidDps = 60; s.puddleDps = 60; s.cd *= 0.8; } }
        ] }
      ]
    },
    // ---------------------------- Reino 7 · Cumbres ----------------------------
    pararrayos: {
      name: 'Pararrayos de Tormenta', cost: 560, kind: 'rod', size: 16, color: '#9ab4ff', targeting: true, defaultTarget: 'strong', realm: 6,
      desc: 'PROTEGE a las torres de su alcance: nada puede apagarlas, congelarlas, cegarlas ni atraparlas. Además descarga rayos que saltan entre enemigos.',
      base: { range: 115, cd: 2, dmg: 16, jumps: 2, chainRange: 90, protect: true, dtype: 'elec' },
      paths: [
        { name: 'Descarga', ups: [
          { name: 'Punta de Cobre', cost: 280, desc: '+12 daño y +1 salto.', apply: s => { s.dmg += 12; s.jumps += 1; } },
          { name: 'Rayo Doble', cost: 700, desc: '2 rayos por descarga y aturden 0.3 s.', apply: s => { s.strikes = 2; s.stun = 0.3; } },
          { name: 'Rayo Purificador', cost: 2100, desc: '+40 daño y el rayo pasa a ser ARCANO.', apply: s => { s.dmg += 40; s.dtype = 'arcane'; s.armorPierce = 1; } },
          { name: 'Ira del Cielo', cost: 8200, desc: '4 rayos de +160 daño cada 1.2 s, x2 contra jefes.', apply: s => { s.strikes = 4; s.dmg += 160; s.cd = 1.2; s.bossMult = 2; s.jumps += 2; } }
        ] },
        { name: 'Jaula', ups: [
          { name: 'Cable Largo', cost: 220, desc: '+35 alcance de protección.', apply: s => { s.range += 35; } },
          { name: 'Carga Estática', cost: 600, desc: 'Las torres protegidas atacan un 15% más rápido.', apply: s => { s.buffRate = 0.15; } },
          { name: 'Bobina de Tesla', cost: 1800, desc: '+25 alcance; las protegidas hacen un 20% más de daño.', apply: s => { s.range += 25; s.buffDmgMult = 1.2; } },
          { name: 'Jaula de Faraday', cost: 7500, desc: 'Las protegidas atacan un 30% más rápido y hacen un 45% más de daño.', apply: s => { s.buffRate = 0.3; s.buffDmgMult = 1.45; } }
        ] }
      ]
    },
    // ----------------------------- Reino 8 · Fosa -----------------------------
    burbujas: {
      name: 'Cañón de Burbujas', cost: 520, kind: 'bubble', size: 16, color: '#6fd8ff', targeting: true, realm: 7,
      desc: 'Dispara burbujas que ATRAPAN al enemigo (no a grandes ni jefes): queda flotando, quieto y recibe más daño. A los grandes los frena.',
      base: { range: 130, cd: 1.6, dmg: 3, projSpeed: 420, trapDur: 1.3, trapAmp: 0.15, trapR: 0, dtype: 'phys' },
      paths: [
        { name: 'Pompa', ups: [
          { name: 'Pompa Grande', cost: 240, desc: 'Atrapa a todos los que estén cerca del golpe.', apply: s => { s.trapR = 32; } },
          { name: 'Pompa Explosiva', cost: 600, desc: 'Al reventar hace 30 daño en área.', apply: s => { s.popDmg = 30; s.trapAmp = 0.25; } },
          { name: 'Burbuja de Presión', cost: 1800, desc: 'Reventón mucho más fuerte, más radio y atrapa 1.8 s.', apply: s => { s.popDmg = 140; s.trapDur = 1.8; s.trapR = 42; } },
          { name: 'Prisión de Coral', cost: 7600, desc: 'También atrapa GRANDES (1 s). Reventón de 600.', apply: s => { s.trapBig = 1; s.popDmg = 600; s.trapAmp = 0.4; } }
        ] },
        { name: 'Corriente', ups: [
          { name: 'Presión Alta', cost: 200, desc: 'Dispara un 25% más rápido.', apply: s => { s.cd *= 0.75; } },
          { name: 'Agua Salada', cost: 480, desc: 'Las burbujas MOJAN (x1.5 a la electricidad) y +4 daño.', apply: s => { s.wetDur = 4; s.dmg += 4; } },
          { name: 'Ráfaga de Burbujas', cost: 1500, desc: '3 burbujas en abanico y +25 alcance.', apply: s => { s.count = 3; s.range += 25; } },
          { name: 'Géiser Abisal', cost: 7000, desc: '5 burbujas cada 0.5 s, +30 daño.', apply: s => { s.count = 5; s.cd = 0.5; s.dmg += 30; } }
        ] }
      ]
    },
    // --------------------------- Reino 9 · Engranajes ---------------------------
    desintegrador: {
      name: 'Desintegrador', cost: 800, kind: 'disint', size: 17, color: '#ff5a7a', targeting: true, defaultTarget: 'strong', realm: 8,
      desc: 'Un rayo que quita un PORCENTAJE de la vida máxima por segundo: brilla contra los grandes (a los jefes les hace mucho menos).',
      base: { range: 125, dps: 4, pct: 0.035, beams: 1, dtype: 'arcane' },
      paths: [
        { name: 'Fisión', ups: [
          { name: 'Núcleo Inestable', cost: 320, desc: '5% de la vida por segundo.', apply: s => { s.pct = 0.05; } },
          { name: 'Desmaterializar', cost: 900, desc: '7% por segundo y +10 daño/s.', apply: s => { s.pct = 0.07; s.dps += 10; } },
          { name: 'Antimateria', cost: 2600, desc: '9% por segundo y EJECUTA bajo el 10% (no a jefes).', apply: s => { s.pct = 0.09; s.exec = 0.1; } },
          { name: 'Singularidad', cost: 9000, desc: '14% por segundo, +80 daño/s y x3 contra jefes.', apply: s => { s.pct = 0.14; s.dps += 80; s.bossMult = 3; } }
        ] },
        { name: 'Óptica', ups: [
          { name: 'Lente Ancha', cost: 260, desc: '+30 alcance.', apply: s => { s.range += 30; } },
          { name: 'Prisma Doble', cost: 800, desc: '2 rayos a la vez.', apply: s => { s.beams = 2; } },
          { name: 'Detector', cost: 1500, desc: 'Ve CAMUFLADOS y +20 alcance.', apply: s => { s.camo = true; s.range += 20; } },
          { name: 'Red de Rayos', cost: 8000, desc: '4 rayos a la vez y +20 daño/s.', apply: s => { s.beams = 4; s.dps += 20; } }
        ] }
      ]
    },
    // ---------------------------- Reino 10 · Eclipse ----------------------------
    campanario: {
      name: 'Campanario del Ocaso', cost: 700, kind: 'bell', size: 17, color: '#d8b060', realm: 9,
      desc: 'Su campana hace ECO: cada toque repite en los enemigos de su alcance una parte del daño que recibieron en los últimos segundos (incluso camuflados).',
      base: { range: 130, cd: 3.5, eco: 0.22, dmg: 4, dtype: 'arcane' },
      paths: [
        { name: 'Eco', ups: [
          { name: 'Bronce Fino', cost: 300, desc: 'Repite el 32% del daño.', apply: s => { s.eco = 0.32; } },
          { name: 'Resonancia', cost: 820, desc: 'Repite el 45% del daño.', apply: s => { s.eco = 0.45; } },
          { name: 'Campana Mayor', cost: 2400, desc: 'Repite el 60%, +30 alcance.', apply: s => { s.eco = 0.6; s.range += 30; } },
          { name: 'Eco Eterno', cost: 8600, desc: 'Repite el 90% del daño y x2 contra jefes.', apply: s => { s.eco = 0.9; s.bossMult = 2; } }
        ] },
        { name: 'Repique', ups: [
          { name: 'Badajo Ligero', cost: 240, desc: 'Toca un 25% más seguido.', apply: s => { s.cd *= 0.75; } },
          { name: 'Toque Aturdidor', cost: 560, desc: 'Cada toque aturde 0.35 s.', apply: s => { s.stun = 0.35; } },
          { name: 'Toque de Difuntos', cost: 1700, desc: 'Cada toque ROMPE la invulnerabilidad y los escudos regalados.', apply: s => { s.purge = true; s.range += 15; } },
          { name: 'Ángelus', cost: 7200, desc: 'Toca cada 1.4 s y +40 daño por toque.', apply: s => { s.cd = 1.4; s.dmg += 40; } }
        ] }
      ]
    },

    // ============================ HÉROES (uno por reino) ============================
    // Solo en su reino y UNO por partida (engine.js: canPlace). Muy caros, pero con un
    // aura propia y una habilidad automática única desde el principio. A diferencia de
    // las torres, pueden llevar sus DOS caminos al nivel 4, y UNO de ellos al nivel 5
    // (60000 de oro; canUpgrade). Sus mejoras cuestan un 50 % más que antes: con las dos
    // al 4 eran lo más rentable del mapa.
    // `atk` elige el ataque (engine.js: tHero); `aura` es el radio del aura cuando no
    // coincide con el alcance; `abCd` reemplaza la recarga de la habilidad.
    heroeprado: {
      name: 'Sylva, Guardiana del Prado', cost: 2400, kind: 'hero', hero: true, size: 19, color: '#6fdc5a', targeting: true, realm: 0,
      desc: 'HÉROE. Lanza semillas que perforan y ve CAMUFLADOS. Cura 2 ❤ al final de cada ronda. HABILIDAD: Selva Ancestral, raíces que atrapan a todos los enemigos terrestres del mapa.',
      base: { atk: 'proj', range: 165, cd: 0.5, dmg: 6, pierce: 4, projSpeed: 620, count: 2, spread: 0.14, dtype: 'phys', camo: true,
        lifeRegen: 2, ability: 'selva', selvaDur: 3, selvaDps: 15 },
      paths: [
        { name: 'Raíz', ups: [
          { name: 'Raíces Profundas', cost: 2700, desc: 'La Selva atrapa 4.5 s y hace 40 daño/s a los atrapados.', apply: s => { s.selvaDur = 4.5; s.selvaDps = 40; } },
          { name: 'Savia Curativa', cost: 6000, desc: 'Cura 5 ❤ al final de cada ronda.', apply: s => { s.lifeRegen = 5; } },
          { name: 'Bosque Eterno', cost: 13500, desc: 'La Selva se lanza cada 20 s y también frena a los JEFES.', apply: s => { s.abCd = 20; s.selvaBoss = true; s.selvaDps = 90; } },
          { name: 'Corazón del Prado', cost: 36000, desc: 'Selva de 6 s y 300 daño/s. Cura 12 ❤ por ronda.', apply: s => { s.selvaDur = 6; s.selvaDps = 300; s.lifeRegen = 12; } },
          { name: 'Madre Selva', cost: 60000, desc: 'NIVEL 5 (solo un camino). Selva de 1200 daño/s que también atrapa VOLADORES. Cura 20 ❤ por ronda.', apply: s => { s.selvaDps = 1200; s.selvaAir = true; s.lifeRegen = 20; } }
        ] },
        { name: 'Semilla', ups: [
          { name: 'Semillas Duras', cost: 2200, desc: '+6 daño y +2 perforación.', apply: s => { s.dmg += 6; s.pierce += 2; } },
          { name: 'Tres Semillas', cost: 5700, desc: '3 semillas por disparo y un 20% más rápido.', apply: s => { s.count = 3; s.cd *= 0.8; } },
          { name: 'Espinas de Hierro', cost: 13500, desc: '+20 daño, ignora el blindaje y envenena 20 daño/s.', apply: s => { s.dmg += 20; s.armorPierce = 1; s.poisonDps = 20; s.poisonDur = 3; } },
          { name: 'Lluvia de Pétalos', cost: 33000, desc: '7 semillas, +45 daño, +30 alcance, más rápida y x2 contra jefes.', apply: s => { s.count = 7; s.spread = 0.12; s.dmg += 45; s.range += 30; s.cd = 0.3; s.bossMult = 2; } },
          { name: 'Árbol del Mundo', cost: 60000, desc: 'NIVEL 5 (solo un camino). 9 semillas de +160 daño que perforan 6 más, x3 contra jefes.', apply: s => { s.count = 9; s.spread = 0.1; s.dmg += 160; s.pierce += 6; s.bossMult = 3; } }
        ] }
      ]
    },

    heroedunas: {
      name: "Ra'kesh, Faraón de las Arenas", cost: 2800, kind: 'hero', hero: true, size: 19, color: '#ffcf4d', targeting: true, realm: 1,
      desc: 'HÉROE. Arroja soles que explotan en área (alcanzan VOLADORES). Su arena quita 3 de BLINDAJE a todo lo que esté en su alcance. HABILIDAD: Tormenta de Arena, que hace RETROCEDER a los enemigos.',
      base: { atk: 'orb', range: 170, cd: 1.1, dmg: 14, radius: 50, dtype: 'explosive', armorPierce: 0.5,
        shredAura: 3, ability: 'tormenta', stormPush: 160, stormStun: 1, stormR: 340 },
      paths: [
        { name: 'Sol', ups: [
          { name: 'Ojo de Ra', cost: 2700, desc: '+10 daño, +15 radio y detecta CAMUFLADOS.', apply: s => { s.dmg += 10; s.radius += 15; s.camo = true; } },
          { name: 'Doble Sol', cost: 6300, desc: 'Lanza 2 soles y un 20% más rápido.', apply: s => { s.shells = 2; s.cd *= 0.8; } },
          { name: 'Ira de Ra', cost: 15000, desc: '+40 daño, los soles queman 30 daño/s e ignoran el blindaje.', apply: s => { s.dmg += 40; s.burnDps = 30; s.armorPierce = 1; } },
          { name: 'Eclipse', cost: 39000, desc: '3 soles enormes de +130 daño, más rápidos y x2 contra jefes.', apply: s => { s.shells = 3; s.dmg += 130; s.radius += 25; s.cd = 0.6; s.bossMult = 2; } },
          { name: 'Sol Negro', cost: 60000, desc: 'NIVEL 5 (solo un camino). 4 soles de +380 daño que queman 150/s, x3 contra jefes.', apply: s => { s.shells = 4; s.dmg += 380; s.radius += 15; s.burnDps = 150; s.bossMult = 3; } }
        ] },
        { name: 'Arena', ups: [
          { name: 'Arena Abrasiva', cost: 2400, desc: 'Quita 5 de blindaje y +25 alcance.', apply: s => { s.shredAura = 5; s.range += 25; } },
          { name: 'Espejismo', cost: 6000, desc: 'La Tormenta se lanza cada 20 s y empuja más lejos.', apply: s => { s.abCd = 20; s.stormPush = 240; } },
          { name: 'Maldición del Faraón', cost: 14200, desc: 'Los enemigos en su alcance reciben un 25% más de daño.', apply: s => { s.ampAura = 0.25; } },
          { name: 'Tormenta Eterna', cost: 36000, desc: 'La Tormenta cubre todo el mapa, empuja 360 y aturde 2.5 s.', apply: s => { s.stormR = 5000; s.stormPush = 360; s.stormStun = 2.5; } },
          { name: 'Arenas del Tiempo', cost: 60000, desc: 'NIVEL 5 (solo un camino). La arena quita 10 de blindaje, los enemigos en su alcance reciben un 45% más de daño y +40 alcance.', apply: s => { s.shredAura = 10; s.ampAura = 0.45; s.range += 40; } }
        ] }
      ]
    },

    heroeglaciar: {
      name: 'Freya, Reina del Invierno', cost: 3200, kind: 'hero', hero: true, size: 19, color: '#9be7ff', targeting: true, realm: 2,
      desc: 'HÉROE. Lanzas de hielo que ATRAVIESAN en línea y ralentizan; ve CAMUFLADOS. Su aura ralentiza un 20%. HABILIDAD: Invierno Eterno, que ralentiza a todo el mapa y lo vuelve quebradizo.',
      base: { atk: 'lance', range: 200, cd: 1.4, dmg: 22, width: 10, bolts: 1, dtype: 'ice', armorPierce: 0.5, slow: 0.35, slowDur: 2, camo: true,
        slowAura: 0.2, ability: 'invierno', winterDur: 6, winterBrittle: 4, winterDmg: 0 },
      paths: [
        { name: 'Escarcha', ups: [
          { name: 'Aura Gélida', cost: 2700, desc: 'El aura ralentiza un 30% y +25 alcance.', apply: s => { s.slowAura = 0.3; s.range += 25; } },
          { name: 'Corazón de Hielo', cost: 6800, desc: 'El Invierno además CONGELA 2 s a los que no son jefes.', apply: s => { s.winterFreeze = 2; } },
          { name: 'Glaciación', cost: 15000, desc: 'Invierno cada 20 s, dura 9 s y quiebra más (+10 daño por impacto).', apply: s => { s.abCd = 20; s.winterDur = 9; s.winterBrittle = 10; } },
          { name: 'Era Glacial', cost: 39000, desc: 'Aura del 40%. El Invierno inflige 2500 de daño de hielo a todo el mapa.', apply: s => { s.slowAura = 0.4; s.winterDmg = 2500; } },
          { name: 'Invierno sin Fin', cost: 60000, desc: 'NIVEL 5 (solo un camino). El Invierno inflige 9000 de daño de hielo y quiebra +20 por impacto.', apply: s => { s.winterDmg = 9000; s.winterBrittle = 20; } }
        ] },
        { name: 'Lanza', ups: [
          { name: 'Lanza Afilada', cost: 2400, desc: '+18 daño.', apply: s => { s.dmg += 18; } },
          { name: 'Triple Lanza', cost: 6000, desc: '3 lanzas en abanico y un 20% más rápido.', apply: s => { s.bolts = 3; s.cd *= 0.8; } },
          { name: 'Lanza Rúnica', cost: 15000, desc: '+60 daño, ignora el blindaje y CONGELA 0.6 s.', apply: s => { s.dmg += 60; s.armorPierce = 1; s.freeze = 0.6; } },
          { name: 'Juicio Boreal', cost: 37500, desc: '5 lanzas enormes de +220 daño cada 0.8 s, x3 contra jefes.', apply: s => { s.bolts = 5; s.dmg += 220; s.width = 18; s.cd = 0.8; s.bossMult = 3; } },
          { name: 'Lanza de Ymir', cost: 60000, desc: 'NIVEL 5 (solo un camino). 7 lanzas de +650 daño cada 0.7 s, x4 contra jefes.', apply: s => { s.bolts = 7; s.dmg += 650; s.width = 22; s.cd = 0.7; s.bossMult = 4; } }
        ] }
      ]
    },

    heroecaldera: {
      name: 'Vulkar, Señor de la Forja', cost: 3600, kind: 'hero', hero: true, size: 19, color: '#ff7a3a', realm: 3,
      desc: 'HÉROE. Golpea el suelo con su martillo: daña y QUEMA a todo lo que tiene cerca (también voladores). Las torres a su alrededor hacen un 20% más de daño. HABILIDAD: Erupción sobre los enemigos más fuertes.',
      base: { atk: 'slam', range: 95, cd: 1.2, dmg: 16, burnDps: 8, burnDur: 3, dtype: 'fire',
        aura: 150, buffDmgMult: 1.2, ability: 'erupcion', eruptN: 8, eruptDmg: 400 },
      paths: [
        { name: 'Martillo', ups: [
          { name: 'Martillo Ígneo', cost: 2700, desc: '+14 daño y +15 alcance.', apply: s => { s.dmg += 14; s.range += 15; } },
          { name: 'Onda Sísmica', cost: 6800, desc: 'Los golpes aturden 0.5 s y son un 25% más rápidos.', apply: s => { s.stun = 0.5; s.cd *= 0.75; } },
          { name: 'Martillo de Magma', cost: 16500, desc: '+50 daño, ignora el blindaje y quema 30 daño/s.', apply: s => { s.dmg += 50; s.armorPierce = 1; s.burnDps = 30; } },
          { name: 'Furia del Volcán', cost: 40500, desc: '+160 daño, golpes cada 0.6 s, +30 alcance y x2 contra jefes.', apply: s => { s.dmg += 160; s.cd = 0.6; s.range += 30; s.bossMult = 2; } },
          { name: 'Ragnarök', cost: 60000, desc: 'NIVEL 5 (solo un camino). +520 daño, quema 150/s, +20 alcance y x3 contra jefes.', apply: s => { s.dmg += 520; s.burnDps = 150; s.range += 20; s.bossMult = 3; } }
        ] },
        { name: 'Forja', ups: [
          { name: 'Fragua', cost: 2700, desc: 'Las torres cercanas hacen un 35% más de daño y el aura crece.', apply: s => { s.buffDmgMult = 1.35; s.aura = 175; } },
          { name: 'Yunque Eterno', cost: 6800, desc: 'Las torres cercanas además atacan un 20% más rápido.', apply: s => { s.buffRate = 0.2; } },
          { name: 'Lluvia de Magma', cost: 16500, desc: 'Erupción cada 18 s con 14 estallidos.', apply: s => { s.abCd = 18; s.eruptN = 14; } },
          { name: 'Corazón del Volcán', cost: 42000, desc: 'Torres cercanas x1.75 de daño e ignoran el blindaje. Estallidos de 1500.', apply: s => { s.buffDmgMult = 1.75; s.buffArmor = 1; s.eruptDmg = 1500; } },
          { name: 'Forja de los Dioses', cost: 60000, desc: 'NIVEL 5 (solo un camino). Torres cercanas x2.2 de daño y un 35% más rápidas. Estallidos de 4500.', apply: s => { s.buffDmgMult = 2.2; s.buffRate = 0.35; s.eruptDmg = 4500; s.aura = 190; } }
        ] }
      ]
    },

    heroevacio: {
      name: 'Nyx, Tejedora del Vacío', cost: 4000, kind: 'hero', hero: true, size: 19, color: '#c07bff', targeting: true, defaultTarget: 'strong', realm: 4,
      desc: 'HÉROE. Rayos ARCANOS que rebotan entre enemigos; ve CAMUFLADOS. En su alcance los enemigos reciben un 15% más de daño. HABILIDAD: Grieta Temporal, que DEVUELVE a los enemigos hacia el comienzo del camino.',
      base: { atk: 'bolt', range: 175, cd: 0.7, dmg: 12, bounces: 2, dtype: 'arcane', camo: true,
        ampAura: 0.15, ability: 'grieta', riftBack: 0.35, riftBoss: 0.1 },
      paths: [
        { name: 'Tiempo', ups: [
          { name: 'Eco Temporal', cost: 3000, desc: 'La Grieta los devuelve la mitad del camino recorrido.', apply: s => { s.riftBack = 0.5; } },
          { name: 'Paradoja', cost: 7500, desc: 'Grieta cada 24 s; los devueltos quedan aturdidos 1.5 s.', apply: s => { s.abCd = 24; s.riftStun = 1.5; } },
          { name: 'Bucle Eterno', cost: 18000, desc: 'Los devueltos quedan MALDITOS: +40% de daño recibido durante 6 s.', apply: s => { s.riftHex = 0.4; } },
          { name: 'Fin de los Tiempos', cost: 45000, desc: 'La Grieta devuelve el 80% del camino (a los jefes, el 30%).', apply: s => { s.riftBack = 0.8; s.riftBoss = 0.3; } },
          { name: 'Colapso Temporal', cost: 60000, desc: 'NIVEL 5 (solo un camino). La Grieta además inflige 6000 de daño arcano y deja a los devueltos MALDITOS al 80%.', apply: s => { s.riftDmg = 6000; s.riftHex = 0.8; } }
        ] },
        { name: 'Estrellas', ups: [
          { name: 'Polvo Estelar', cost: 2700, desc: '+12 daño y +1 rebote.', apply: s => { s.dmg += 12; s.bounces += 1; } },
          { name: 'Constelación', cost: 6800, desc: 'Un 25% más rápido; en su alcance reciben un 25% más de daño.', apply: s => { s.cd *= 0.75; s.ampAura = 0.25; } },
          { name: 'Agujero Blanco', cost: 16500, desc: '+40 daño, 6 rebotes y EJECUTA bajo el 10% de vida.', apply: s => { s.dmg += 40; s.bounces = 6; s.exec = 0.1; } },
          { name: 'Supernova Oscura', cost: 42000, desc: '+160 daño, dispara cada 0.3 s y x2 contra jefes.', apply: s => { s.dmg += 160; s.cd = 0.3; s.bossMult = 2; } },
          { name: 'Big Bang', cost: 60000, desc: 'NIVEL 5 (solo un camino). +480 daño, 10 rebotes, x3 contra jefes y EJECUTA bajo el 15%.', apply: s => { s.dmg += 480; s.bounces = 10; s.bossMult = 3; s.exec = 0.15; } }
        ] }
      ]
    },

    // ---------------- héroes de la segunda era ----------------
    heroepantano: {
      name: 'Morgana, Bruja de la Ciénaga', cost: 4200, kind: 'hero', hero: true, size: 19, color: '#8ae05a', targeting: true, realm: 5,
      desc: 'HÉROE. Dardos envenenados que perforan y ven CAMUFLADOS. Los enemigos que mueren en su alcance dan un 30% más de oro. HABILIDAD: Ciénaga Voraz, charcos por todo el camino que frenan y envenenan.',
      base: { atk: 'proj', range: 160, cd: 0.55, dmg: 8, pierce: 3, projSpeed: 600, count: 2, spread: 0.16, dtype: 'poison', camo: true, poisonDps: 6, poisonDur: 3,
        goldAura: 1.3, ability: 'cienaga', bogN: 6, bogDps: 30, bogSlow: 0.45, bogDur: 5 },
      paths: [
        { name: 'Ciénaga', ups: [
          { name: 'Fango Espeso', cost: 3000, desc: 'Los charcos frenan un 60% y duran 7 s.', apply: s => { s.bogSlow = 0.6; s.bogDur = 7; } },
          { name: 'Más Pantano', cost: 7200, desc: '10 charcos de 90 daño/s.', apply: s => { s.bogN = 10; s.bogDps = 90; } },
          { name: 'Codicia', cost: 16000, desc: 'Ciénaga cada 22 s; en su alcance dan un 60% más de oro.', apply: s => { s.abCd = 22; s.goldAura = 1.6; } },
          { name: 'Pantano Viviente', cost: 39000, desc: '14 charcos de 400 daño/s que CONVIERTEN EN SAPO a los que no son grandes.', apply: s => { s.bogN = 14; s.bogDps = 400; s.bogFrog = true; } },
          { name: 'Ciénaga Eterna', cost: 60000, desc: 'NIVEL 5 (solo un camino). Charcos de 1500 daño/s que también frenan a los voladores.', apply: s => { s.bogDps = 1500; s.bogAir = true; } }
        ] },
        { name: 'Maleficio', ups: [
          { name: 'Dardo de Espino', cost: 2500, desc: '+8 daño y +2 perforación.', apply: s => { s.dmg += 8; s.pierce += 2; } },
          { name: 'Tres Dardos', cost: 6300, desc: '3 dardos, un 20% más rápida y veneno de 25/s.', apply: s => { s.count = 3; s.cd *= 0.8; s.poisonDps = 25; } },
          { name: 'Hechizo de Sapo', cost: 15500, desc: '+25 daño; cada dardo tiene un 20% de convertir en SAPO.', apply: s => { s.dmg += 25; s.frogChance = 0.2; s.frogDur = 2; } },
          { name: 'Maldición de la Bruja', cost: 37500, desc: '6 dardos de +70 daño, veneno 120/s y x2 contra jefes.', apply: s => { s.count = 6; s.dmg += 70; s.poisonDps = 120; s.bossMult = 2; s.cd = 0.35; } },
          { name: 'Gran Hechicera', cost: 60000, desc: 'NIVEL 5 (solo un camino). +240 daño, veneno 500/s, x3 contra jefes.', apply: s => { s.dmg += 240; s.poisonDps = 500; s.bossMult = 3; } }
        ] }
      ]
    },

    heroecumbres: {
      name: 'Zéfiro, Señor de los Vientos', cost: 4400, kind: 'hero', hero: true, size: 19, color: '#bfe0ff', targeting: true, realm: 6,
      desc: 'HÉROE. Cuchillas de viento que atraviesan a muchos enemigos (también voladores). VIENTO DE COLA: las torres cercanas tienen un 12% más de alcance y velocidad. HABILIDAD: Tempestad, rayos arcanos que saltan por los enemigos más fuertes.',
      base: { atk: 'proj', range: 175, cd: 0.6, dmg: 10, pierce: 8, projSpeed: 700, count: 1, spread: 0.2, dtype: 'phys', spear: true,
        aura: 165, buffRange: 0.12, buffRate: 0.12, ability: 'tempestad', tempN: 14, tempDmg: 500, tempStun: 0.8 },
      paths: [
        { name: 'Tormenta', ups: [
          { name: 'Nubes Negras', cost: 3000, desc: 'Tempestad de 20 rayos de 900.', apply: s => { s.tempN = 20; s.tempDmg = 900; } },
          { name: 'Ojo del Huracán', cost: 7200, desc: 'Tempestad cada 20 s; aturde 1.5 s.', apply: s => { s.abCd = 20; s.tempStun = 1.5; } },
          { name: 'Furia Celeste', cost: 16500, desc: 'Rayos de 3000 y x2 contra jefes.', apply: s => { s.tempDmg = 3000; s.tempBoss = 2; } },
          { name: 'Cielo Partido', cost: 40000, desc: '30 rayos de 9000.', apply: s => { s.tempN = 30; s.tempDmg = 9000; } },
          { name: 'Dios del Trueno', cost: 60000, desc: 'NIVEL 5 (solo un camino). Rayos de 26000, x3 contra jefes.', apply: s => { s.tempDmg = 26000; s.tempBoss = 3; } }
        ] },
        { name: 'Viento', ups: [
          { name: 'Brisa Cortante', cost: 2500, desc: '+10 daño y +4 perforación.', apply: s => { s.dmg += 10; s.pierce += 4; } },
          { name: 'Viento de Cola', cost: 6600, desc: 'Torres cercanas: +20% de alcance y velocidad.', apply: s => { s.buffRange = 0.2; s.buffRate = 0.2; s.aura = 185; } },
          { name: 'Tornado', cost: 15500, desc: '3 cuchillas de +30 daño que ignoran el blindaje.', apply: s => { s.count = 3; s.dmg += 30; s.armorPierce = 1; } },
          { name: 'Ciclón', cost: 37500, desc: '5 cuchillas de +100 daño cada 0.35 s, x2 contra jefes.', apply: s => { s.count = 5; s.dmg += 100; s.cd = 0.35; s.bossMult = 2; } },
          { name: 'Rey de los Cielos', cost: 60000, desc: 'NIVEL 5 (solo un camino). +320 daño; torres cercanas +30% de alcance y velocidad.', apply: s => { s.dmg += 320; s.buffRange = 0.3; s.buffRate = 0.3; } }
        ] }
      ]
    },

    heroefosa: {
      name: 'Nerea, Señora de las Mareas', cost: 4600, kind: 'hero', hero: true, size: 19, color: '#4fc8e8', targeting: true, realm: 7,
      desc: 'HÉROE. Lanza esferas de agua que explotan en área (también voladores) y MOJAN: los mojados reciben x1.5 de electricidad y pierden la inmunidad al fuego. HABILIDAD: Maremoto, una ola que arrastra a todos hacia atrás.',
      base: { atk: 'orb', range: 170, cd: 1.1, dmg: 16, radius: 48, dtype: 'steam', wetDur: 4, ability: 'maremoto', wavePush: 150, waveDmg: 200 },
      paths: [
        { name: 'Marea', ups: [
          { name: 'Resaca', cost: 3000, desc: 'El Maremoto arrastra más y hace 600.', apply: s => { s.wavePush = 220; s.waveDmg = 600; } },
          { name: 'Pleamar', cost: 7200, desc: 'Maremoto cada 20 s; los arrastrados quedan aturdidos 1 s.', apply: s => { s.abCd = 20; s.waveStun = 1; } },
          { name: 'Agua Regia', cost: 16500, desc: 'Los mojados reciben un 20% más de todo.', apply: s => { s.wetAmp = 0.2; s.waveDmg = 2000; } },
          { name: 'Tsunami', cost: 40000, desc: 'Arrastra 330 y hace 8000.', apply: s => { s.wavePush = 330; s.waveDmg = 8000; } },
          { name: 'Diluvio', cost: 60000, desc: 'NIVEL 5 (solo un camino). Maremoto de 25000 y mojados +40% de todo.', apply: s => { s.waveDmg = 25000; s.wetAmp = 0.4; } }
        ] },
        { name: 'Esfera', ups: [
          { name: 'Perla', cost: 2500, desc: '+12 daño, +10 radio y ve CAMUFLADOS.', apply: s => { s.dmg += 12; s.radius += 10; s.camo = true; } },
          { name: 'Doble Ola', cost: 6600, desc: '2 esferas y un 20% más rápida.', apply: s => { s.shells = 2; s.cd *= 0.8; } },
          { name: 'Remolino', cost: 15500, desc: '+45 daño que ignora el blindaje.', apply: s => { s.dmg += 45; s.armorPierce = 1; } },
          { name: 'Abismo', cost: 38000, desc: '3 esferas de +150 daño cada 0.6 s, x2 contra jefes.', apply: s => { s.shells = 3; s.dmg += 150; s.cd = 0.6; s.bossMult = 2; } },
          { name: 'Corazón del Océano', cost: 60000, desc: 'NIVEL 5 (solo un camino). 4 esferas de +420 daño, x3 contra jefes.', apply: s => { s.shells = 4; s.dmg += 420; s.bossMult = 3; } }
        ] }
      ]
    },

    heroeengranaje: {
      name: 'Ada, Ingeniera Jefe', cost: 4800, kind: 'hero', hero: true, size: 19, color: '#ffb84d', targeting: true, defaultTarget: 'strong', realm: 8,
      desc: 'HÉROE. Remacha a los enemigos con clavos que rebotan. Las mejoras de las torres cercanas cuestan un 15% menos. HABILIDAD: Sobrecarga, las torres de su alrededor atacan el doble de rápido 6 s.',
      base: { atk: 'bolt', range: 170, cd: 0.6, dmg: 14, bounces: 2, dtype: 'phys', armorPierce: 0.5,
        aura: 170, heroDiscount: 0.15, ability: 'sobrecarga', overDur: 6 },
      paths: [
        { name: 'Taller', ups: [
          { name: 'Presupuesto', cost: 3000, desc: 'Las mejoras cercanas cuestan un 25% menos.', apply: s => { s.heroDiscount = 0.25; } },
          { name: 'Turbina', cost: 7200, desc: 'Sobrecarga de 9 s cada 24 s.', apply: s => { s.overDur = 9; s.abCd = 24; } },
          { name: 'Gran Taller', cost: 16000, desc: 'Aura más grande; mejoras un 30% más baratas.', apply: s => { s.aura = 210; s.heroDiscount = 0.3; } },
          { name: 'Reactor', cost: 40000, desc: 'Sobrecarga cada 16 s.', apply: s => { s.abCd = 16; } },
          { name: 'Fábrica Perfecta', cost: 60000, desc: 'NIVEL 5 (solo un camino). Sobrecarga de 12 s y mejoras cercanas un 40% más baratas.', apply: s => { s.overDur = 12; s.heroDiscount = 0.4; } }
        ] },
        { name: 'Remaches', ups: [
          { name: 'Clavos de Acero', cost: 2500, desc: '+14 daño y +1 rebote.', apply: s => { s.dmg += 14; s.bounces += 1; } },
          { name: 'Pistola Neumática', cost: 6600, desc: 'Un 30% más rápida y ve CAMUFLADOS.', apply: s => { s.cd *= 0.7; s.camo = true; } },
          { name: 'Remache Térmico', cost: 15500, desc: '+50 daño, ignora el blindaje y 5 rebotes.', apply: s => { s.dmg += 50; s.armorPierce = 1; s.bounces = 5; } },
          { name: 'Martillo Pilón', cost: 38000, desc: '+180 daño cada 0.3 s, x2 contra jefes.', apply: s => { s.dmg += 180; s.cd = 0.3; s.bossMult = 2; } },
          { name: 'Obra Maestra', cost: 60000, desc: 'NIVEL 5 (solo un camino). +520 daño, 9 rebotes, x3 contra jefes.', apply: s => { s.dmg += 520; s.bounces = 9; s.bossMult = 3; } }
        ] }
      ]
    },

    heroeeclipse: {
      name: 'Solenne, la Última Luz', cost: 5000, kind: 'hero', hero: true, size: 19, color: '#ffe6a0', targeting: true, realm: 9,
      desc: 'HÉROE. Rayos de luz ARCANA que atraviesan en línea. Su luz REVELA a los camuflados y anula la invulnerabilidad de los que no son jefes. HABILIDAD: Amanecer, daño arcano a todo el mapa que rompe los escudos.',
      base: { atk: 'lance', range: 185, cd: 1.2, dmg: 26, width: 10, bolts: 1, dtype: 'arcane', camo: true,
        purgeAura: true, ability: 'amanecer', dawnDmg: 600 },
      paths: [
        { name: 'Alba', ups: [
          { name: 'Luz Naciente', cost: 3200, desc: 'Amanecer de 1500 y +25 alcance.', apply: s => { s.dawnDmg = 1500; s.range += 25; } },
          { name: 'Mediodía', cost: 7500, desc: 'Amanecer cada 22 s; los alcanzados quedan aturdidos 1 s.', apply: s => { s.abCd = 22; s.dawnStun = 1; } },
          { name: 'Sol Invicto', cost: 17000, desc: 'Amanecer de 5000 y x2 contra jefes.', apply: s => { s.dawnDmg = 5000; s.dawnBoss = 2; } },
          { name: 'Supernova Blanca', cost: 42000, desc: 'Amanecer de 15000.', apply: s => { s.dawnDmg = 15000; } },
          { name: 'Luz Eterna', cost: 60000, desc: 'NIVEL 5 (solo un camino). Amanecer de 40000, x3 contra jefes.', apply: s => { s.dawnDmg = 40000; s.dawnBoss = 3; } }
        ] },
        { name: 'Rayo', ups: [
          { name: 'Haz Puro', cost: 2600, desc: '+20 daño.', apply: s => { s.dmg += 20; } },
          { name: 'Triple Haz', cost: 6800, desc: '3 haces y un 20% más rápida.', apply: s => { s.bolts = 3; s.cd *= 0.8; } },
          { name: 'Lanza Solar', cost: 16000, desc: '+70 daño y haces más anchos.', apply: s => { s.dmg += 70; s.width = 16; } },
          { name: 'Juicio del Alba', cost: 40000, desc: '5 haces de +240 daño cada 0.7 s, x2 contra jefes.', apply: s => { s.bolts = 5; s.dmg += 240; s.cd = 0.7; s.bossMult = 2; } },
          { name: 'Corona Solar', cost: 60000, desc: 'NIVEL 5 (solo un camino). 7 haces de +700 daño, x3 contra jefes.', apply: s => { s.bolts = 7; s.dmg += 700; s.bossMult = 3; } }
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
    treasure:  { name: 'Tesoro Estelar', cd: 55, color: '#4be3b0', desc: '+1500 de oro.' },
    wardrum:   { name: 'Tambor de Guerra', cd: 34, color: '#e07bff', desc: 'Todas las torres x2 de velocidad 8 s.' },
    inferno:   { name: 'Infierno', cd: 30, color: '#ff5a1f', desc: 'Anillo de fuego de 400 daño/s durante 6 s.' },
    // de los héroes (su recarga baja con mejoras: s.abCd)
    selva:     { name: 'Selva Ancestral', cd: 30, color: '#6fdc5a', desc: 'Raíces que atrapan a todos los enemigos terrestres y los dañan.' },
    tormenta:  { name: 'Tormenta de Arena', cd: 28, color: '#ffcf4d', desc: 'Hace retroceder y aturde a los enemigos cercanos.' },
    invierno:  { name: 'Invierno Eterno', cd: 30, color: '#9be7ff', desc: 'Ralentiza un 60% a todo el mapa y lo vuelve quebradizo.' },
    erupcion:  { name: 'Erupción', cd: 26, color: '#ff7a3a', desc: 'Estallidos de lava sobre los enemigos más fuertes.' },
    grieta:    { name: 'Grieta Temporal', cd: 34, color: '#c07bff', desc: 'Devuelve a los enemigos hacia el comienzo del camino.' },
    cienaga:   { name: 'Ciénaga Voraz', cd: 30, color: '#8ae05a', desc: 'Charcos por todo el camino que frenan y envenenan.' },
    tempestad: { name: 'Tempestad', cd: 28, color: '#bfe0ff', desc: 'Rayos arcanos que saltan por los enemigos más fuertes y los aturden.' },
    maremoto:  { name: 'Maremoto', cd: 30, color: '#4fc8e8', desc: 'Una ola que arrastra hacia atrás a todos los enemigos y los moja.' },
    sobrecarga:{ name: 'Sobrecarga', cd: 30, color: '#ffb84d', desc: 'Las torres alrededor de Ada atacan el doble de rápido unos segundos.' },
    amanecer:  { name: 'Amanecer', cd: 32, color: '#ffe6a0', desc: 'Daño arcano a todo el mapa, rompe escudos y revela camuflados.' }
  };

  PD.TOWER_ORDER = ['espinas', 'escarcha', 'vigia', 'voltaico', 'sembrador', 'mortero', 'dragon', 'prisma', 'colmena', 'totem', 'ancla', 'huerto',
    'bumeran', 'raices', 'sierra', 'acido', 'faro', 'balista', 'forja', 'geiser', 'obelisco', 'segador',
    // al final: las pruebas guardan cada torre por su índice en esta lista
    'heroeprado', 'heroedunas', 'heroeglaciar', 'heroecaldera', 'heroevacio',
    // segunda era (reinos 6–10), también al final por lo mismo
    'bruja', 'pararrayos', 'burbujas', 'desintegrador', 'campanario',
    'heroepantano', 'heroecumbres', 'heroefosa', 'heroeengranaje', 'heroeeclipse'];
  // Defensas disponibles en un reino: las 12 clásicas + las 2 nuevas de cada reino ya alcanzado
  // + el héroe de ESE reino (los héroes no pasan a los reinos siguientes).
  // Los reinos de la segunda era (levels.js: `torres`) venden solo su lista, cada vez más corta.
  // En la tercera era (`heroes: 'todos'`) se elige UNO de los diez héroes (canPlace: uno por partida).
  PD.towersFor = li => {
    const L = PD.LEVELS && PD.LEVELS[li];
    const heroe = id => (L && L.heroes === 'todos') || T[id].realm === li;
    if (L && L.torres) return PD.TOWER_ORDER.filter(id => T[id].hero ? heroe(id) : L.torres.indexOf(id) >= 0);
    return PD.TOWER_ORDER.filter(id => T[id].hero ? T[id].realm === li : (T[id].realm || 0) <= li);
  };
  PD.heroOf = li => PD.TOWER_ORDER.find(id => T[id].hero && T[id].realm === li) || null;
  // los héroes que se pueden poner en un reino (uno solo, o los diez para elegir)
  PD.heroesOf = li => PD.towersFor(li).filter(id => T[id].hero);
  for (const id in T) T[id].id = id;
  PD.TOWERS = T;
})();
