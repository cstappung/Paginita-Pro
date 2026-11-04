// Datos de diseño: recursos, edificios y sus niveles, eras, tecnologías, zonas, exploración, reinos y misiones.
// Casi todo el balance del juego se ajusta aquí.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U;
  const D = (PK.D = {});

  D.SEED = 20261027;          // misma semilla para todos: el mundo compartido es idéntico
  D.MAPV = 4;                 // versión del mapa: si cambia, el servidor reinicia los recursos compartidos
  D.SAVE_V = 4;
  // Reiniciar el mundo del servidor: al subir MUNDO_VER, el servidor (server/sim.js al cargar) borra jugadores,
  // mundos, gremios, ofertas y partidas guardadas, y anota la versión nueva. Se sube junto con SAVE_V (que
  // descarta las partidas locales) y se despliega la función a mano.
  D.MUNDO_VER = 2;
  // Versión de protocolo: el cliente la manda en POST /api/join y el servidor rechaza otra con 426 («El servidor
  // se está actualizando»). Súbela cuando cambie algo que ven los dos lados (mapa, rutas, límites), porque
  // GitHub Pages publica al hacer merge y la Cloud Function se despliega a mano.
  D.PROTO = 7;
  // Lo que dice el cartel al entrar después de un reinicio (una partida guardada de otra SAVE_V). Actualízalo en
  // cada entrega que reinicie.
  D.NOVEDADES = { ver: 'pk-17', items: [
    'Héroes: recluta en la Taberna, súbelos de nivel, equípalos y llévalos a la batalla.',
    'Mazmorras 2.0: incursiones de 5 pisos con salas a elegir, jefes y afijos semanales.',
    'La Crónica del Reino: una campaña con un capítulo por era, escenas, batallas únicas y decisiones.',
    'Tres mazmorras nuevas (Pantano de las Brujas, Fortaleza de los Gigantes y Templo Hundido) con sus enemigos y estructuras de Leyenda.',
    '12 lugares legendarios que se investigan con un héroe, mapas del tesoro, encuentros en el camino y eventos con decisiones.',
    'El Salón del Consejo, el Asesor y un Capataz más listo.',
  ] };
  D.OFFLINE_CAP = 12 * 3600;  // los aldeanos trabajan hasta 12h sin ti (las obras y estudios no tienen tope)

  D.RES = {
    food: { name: 'Comida' },
    wood: { name: 'Madera' },
    stone: { name: 'Piedra' },
    gold: { name: 'Oro' },
    ore: { name: 'Hierro bruto' },
    marble: { name: 'Mármol' },
    gems: { name: 'Gemas' },
    planks: { name: 'Tablones' },
    blocks: { name: 'Sillares' },
    ingots: { name: 'Lingotes' },
    tools: { name: 'Herramientas' },
    books: { name: 'Libros' },
    steel: { name: 'Acero' },
    machinery: { name: 'Maquinaria' },
  };
  D.RES_ORDER = ['food', 'wood', 'stone', 'gold', 'ore', 'marble', 'gems', 'planks', 'blocks', 'ingots', 'tools', 'books', 'steel', 'machinery'];
  D.RES_RAW = ['food', 'wood', 'stone', 'gold', 'ore', 'marble', 'gems'];
  D.RES_START = ['food', 'wood', 'stone', 'gold']; // los demás aparecen en la barra cuando los consigues

  // Recursos del mapa. regrow: segundos hasta rebrotar; regen: fracción del máximo que vuelve por hora.
  D.NODES = {
    // Balance (beta, nov. 2026): la madera costaba mucho más que la comida. Todo pide madera (casas, campamentos,
    // granjas, tablones, fundición, eras) y cada árbol se agota rápido, mientras la caza rendía 1,5 veces la tala.
    // Por eso la tala es más rápida, los árboles rebrotan antes y la caza rinde un poco menos. Los montos (amount)
    // no se tocan: el servidor del mundo compartido los usa para las zonas comunes.
    tree: { name: 'Árbol', res: 'wood', amount: 100, rate: 0.5, regrow: 2.5 * 3600 },
    berry: { name: 'Arbusto de bayas', res: 'food', amount: 150, rate: 0.34, regrow: 3 * 3600 },
    deer: { name: 'Ciervo', res: 'food', amount: 140, rate: 0.5, regrow: 6 * 3600, hunt: true },
    stone: { name: 'Mina de piedra', res: 'stone', amount: 350, rate: 0.36, regen: 0.05 },
    gold: { name: 'Mina de oro', res: 'gold', amount: 400, rate: 0.38, regen: 0.04 },
    ore: { name: 'Veta de hierro', res: 'ore', amount: 400, rate: 0.33, regen: 0.04 },
    marble: { name: 'Cantera de mármol', res: 'marble', amount: 500, rate: 0.22, regen: 0.03 },
    gems: { name: 'Veta de gemas', res: 'gems', amount: 160, rate: 0.12, regen: 0.02 },
  };
  D.FARM_RATE = 0.32;
  D.VILLAGER = { cost: { food: 50 }, time: 14 };
  D.SCOUT = { cost: { food: 80, gold: 20 }, time: 25 };
  D.SIGHT = { scout: 5 };

  // ---------- Edificios ----------
  // cost/time: construcción inicial (se levanta sola, ver game.js updateBuildings). up: costo base de las mejoras (si no, cost).
  // upT: factor del tiempo de mejora. max: cuántos puedes tener (número o función de la era).
  // drop: recursos que acepta como punto de acopio. recipe: producción con trabajadores dentro.
  const ALLRAW = ['food', 'wood', 'stone', 'gold', 'ore', 'marble', 'gems'];
  D.BUILD = {
    tc: { name: 'Centro Urbano', w: 4, h: 4, cost: { wood: 275, stone: 100 }, time: 150, era: 1, drop: ALLRAW, upT: 1.6, trains: 'villager', desc: 'Corazón del reino: entrena aldeanos, guarda de todo, acepta todos los recursos y avanza de era.' },
    house: { name: 'Casa', w: 2, h: 2, cost: { wood: 30 }, time: 18, era: 1, upT: 0.5, desc: 'Da población. Mejórala para que viva más gente.' },
    lumber: { name: 'Campamento Maderero', w: 2, h: 2, cost: { wood: 80 }, time: 20, era: 1, drop: ['wood'], upT: 0.7, desc: 'Acopio de madera. Quien descarga aquí trabaja más rápido según su nivel.' },
    mining: { name: 'Campamento Minero', w: 2, h: 2, cost: { wood: 80 }, time: 20, era: 1, drop: ['stone', 'gold', 'ore', 'marble', 'gems'], upT: 0.7, desc: 'Acopio de piedra, oro, hierro, mármol y gemas.' },
    mill: { name: 'Molino', w: 2, h: 2, cost: { wood: 80 }, time: 20, era: 1, drop: ['food'], upT: 0.7, desc: 'Acopio de comida (bayas, caza y granjas).' },
    farm: { name: 'Granja', w: 3, h: 3, cost: { wood: 50 }, time: 15, era: 1, walkable: true, flat: true, upT: 0.6, desc: 'Comida inagotable, más lenta que las bayas. Un granjero por granja.' },
    granary: { name: 'Granero', w: 2, h: 2, cost: { wood: 120, stone: 30 }, time: 25, era: 1, upT: 0.8, max: e => 1 + e, desc: 'Aumenta cuánta comida puedes guardar.' },
    warehouse: { name: 'Almacén', w: 3, h: 3, cost: { wood: 150, stone: 50 }, time: 30, era: 1, upT: 0.8, max: e => 1 + e, desc: 'Aumenta cuánto puedes guardar de todo lo demás.' },
    builder: { name: 'Casa del Maestro de Obras', w: 2, h: 2, cost: { wood: 150, stone: 80, gold: 60 }, time: 30, era: 1, noUp: true, max: 4, desc: '+1 Maestro de Obras: podrás mejorar un edificio más a la vez.' },
    scout: { name: 'Puesto de Exploradores', w: 2, h: 2, cost: { wood: 100, food: 50 }, time: 25, era: 1, max: 1, trains: 'scout', upT: 0.9, desc: 'Entrena exploradores que revelan el mapa. Su nivel define hasta dónde pueden llegar.' },
    cartwright: { name: 'Carretería', w: 3, h: 3, cost: { wood: 250, stone: 100 }, time: 45, era: 2, max: 2, upT: 0.9, desc: 'Construye carretas que llevan insumos a los talleres y sacan lo que producen. Con caminos van mucho más rápido.' },
    tower: { name: 'Torre de Vigía', w: 1, h: 1, cost: { stone: 100, wood: 25 }, time: 30, era: 1, upT: 0.8, max: e => 2 + e * 2, desc: 'Defiende tu reino y ve muy lejos en la niebla.' },
    market: { name: 'Mercado', w: 3, h: 3, cost: { wood: 175 }, time: 45, era: 2, max: 1, desc: 'Compra y vende recursos. Con más nivel, mejores precios.' },
    sawmill: { name: 'Aserradero', w: 3, h: 3, cost: { wood: 150, stone: 50 }, time: 40, era: 2, recipe: 'planks', slots: 3, desc: 'Convierte madera en tablones.' },
    library: { name: 'Biblioteca', w: 3, h: 3, cost: { wood: 150, stone: 100 }, time: 50, era: 2, max: 1, desc: 'Permite investigar. Su nivel es el nivel máximo de las tecnologías.' },
    barracks: { name: 'Cuartel', w: 3, h: 3, cost: { wood: 175 }, time: 40, era: 2, max: 2, desc: 'Entrena tropas. Cada nivel desbloquea tropas y entrena más rápido. Termina tu tregua de novato.' },
    consejo: { name: 'Salón del Consejo', w: 3, h: 3, cost: { wood: 300, stone: 200, gold: 120 }, time: 60, era: 2, max: 1, desc: 'Cada nivel suma un consejero que maneja solo una parte del reino (investigación, exploración, ejército, comercio, obras y fiestas). Se encienden y apagan uno por uno.' },
    guild: { name: 'Salón del Gremio', w: 3, h: 3, cost: { wood: 200, stone: 150, gold: 50 }, time: 60, era: 2, max: 1, desc: 'Únete a un gremio. Cada nivel da recolección extra mientras seas miembro.' },
    masonry: { name: 'Cantería', w: 2, h: 2, cost: { wood: 150, planks: 40 }, time: 40, era: 3, recipe: 'blocks', slots: 2, desc: 'Talla piedra en sillares.' },
    smelter: { name: 'Fundición', w: 3, h: 3, cost: { stone: 250, planks: 80 }, time: 60, era: 3, recipe: 'ingots', slots: 3, desc: 'Funde hierro bruto con madera en lingotes.' },
    forge: { name: 'Herrería', w: 2, h: 2, cost: { stone: 150, planks: 60, ingots: 10 }, time: 60, era: 3, recipe: 'tools', slots: 2, desc: 'Forja herramientas con tablones y lingotes.' },
    scriptorium: { name: 'Taller de Copistas', w: 2, h: 2, cost: { wood: 200, planks: 60, gold: 80 }, time: 50, era: 3, recipe: 'books', slots: 2, desc: 'Copia libros con tablones y oro. Hacen falta para las mejoras altas.' },
    monastery: { name: 'Monasterio', w: 3, h: 3, cost: { stone: 400, planks: 100, gold: 200 }, time: 90, era: 3, max: 1, desc: 'Guarda las reliquias que encuentres explorando. Cada reliquia da oro sin parar.' },
    university: { name: 'Universidad', w: 3, h: 3, cost: { blocks: 250, planks: 200, gold: 400, marble: 60 }, time: 120, era: 4, max: 2, desc: 'Acelera todas las investigaciones.' },
    steelworks: { name: 'Acería', w: 3, h: 3, cost: { blocks: 200, ingots: 120, marble: 40 }, time: 120, era: 4, recipe: 'steel', slots: 3, desc: 'Convierte lingotes y carbón de madera en acero.' },
    workshop: { name: 'Taller de Ingeniería', w: 3, h: 3, cost: { blocks: 400, steel: 60, tools: 60 }, time: 150, era: 5, recipe: 'machinery', slots: 3, desc: 'Arma maquinaria con acero, tablones y herramientas.' },
    wonder: { name: 'Maravilla', w: 4, h: 4, cost: { blocks: 3000, marble: 1500, gems: 300, steel: 400, machinery: 150 }, time: 900, era: 6, max: 1, upT: 2.5, noCap: true, desc: 'Obra sin fin: cada nivel da prestigio, +3% a todo y monedas.' },
  };
  D.BUILD_ORDER = ['house', 'lumber', 'mining', 'mill', 'farm', 'granary', 'warehouse', 'builder', 'scout', 'tower', 'market', 'sawmill', 'cartwright', 'library', 'barracks', 'consejo', 'guild', 'masonry', 'smelter', 'forge', 'scriptorium', 'monastery', 'university', 'steelworks', 'workshop', 'wonder', 'tc'];
  for (const k in D.BUILD) {
    const b = D.BUILD[k];
    if (b.recipe) b.upT = b.upT || 1.1;
    b.sight = b.sight || (b.w >= 3 ? 5 : 4);
  }

  D.RECIPES = {
    planks: { in: { wood: 2 }, out: { planks: 1 }, time: 4 },
    blocks: { in: { stone: 3 }, out: { blocks: 1 }, time: 6 },
    ingots: { in: { ore: 2, wood: 1 }, out: { ingots: 1 }, time: 8 },
    tools: { in: { planks: 1, ingots: 1 }, out: { tools: 1 }, time: 10 },
    books: { in: { planks: 1, gold: 2 }, out: { books: 1 }, time: 12 },
    steel: { in: { ingots: 2, wood: 3 }, out: { steel: 1 }, time: 14 },
    machinery: { in: { steel: 1, planks: 2, tools: 1 }, out: { machinery: 1 }, time: 20 },
  };

  // ---------- Niveles ----------
  // Cada edificio sube de nivel por separado con un Maestro de Obras. Las primeras mejoras duran segundos,
  // las siguientes minutos, luego horas y al final días: progreso rápido al inicio y cada vez más lento.
  D.maxLevel = (type, era) => (D.BUILD[type].noUp ? 1 : D.BUILD[type].noCap ? 9999 : 3 + 2 * (era - 1));
  const UP_T = [0, 20, 60, 180, 540, 1500, 3600, 7200, 14400, 28800, 57600, 86400, 129600, 172800];
  D.upTime = function (type, L) {
    const t = L < UP_T.length ? UP_T[L] : UP_T[UP_T.length - 1] * Math.pow(1.25, L - UP_T.length + 1);
    return Math.round(Math.min(t, 7 * 86400) * (D.BUILD[type].upT || 1));
  };
  const r5 = v => Math.max(5, Math.round(v / 5) * 5);
  // Costo de pasar del nivel L al L+1: crece x1,85 por nivel y pide materiales nuevos al subir.
  D.upCost = function (type, L) {
    const def = D.BUILD[type], base = def.up || def.cost, k = 1.2 * Math.pow(1.85, L - 1), c = {};
    for (const r in base) c[r] = r5(base[r] * k);
    const add = (r, from, a) => { if (L >= from) c[r] = (c[r] || 0) + r5(a * Math.pow(1.8, L - from)); };
    add('planks', 3, 20); add('blocks', 5, 25); add('ingots', 7, 20); add('tools', 7, 10);
    add('books', 9, 15); add('marble', 9, 50); add('steel', 12, 15); add('machinery', 15, 10); add('gems', 15, 20);
    return c;
  };
  // Costo de construir otro edificio del mismo tipo (las casas del maestro suben mucho).
  D.buildCost = function (type, have) {
    const c = Object.assign({}, D.BUILD[type].cost);
    const m = type === 'tc' ? Math.pow(2, have) : type === 'builder' ? Math.pow(4, have) : 1;
    if (m !== 1) for (const r in c) c[r] = Math.round(c[r] * m);
    return c;
  };

  const capR = v => Math.round(v / 50) * 50;
  const recipeStats = base => L => ({ prod: 0.15 * (L - 1), slots: base + Math.floor((L - 1) / 3) });
  const campStats = L => ({ gather: 0.1 * (L - 1), carry: L - 1 });
  // Efecto de cada edificio según su nivel.
  D.BSTATS = {
    // cap 800 (era 600): en la Era I se pasaba más tiempo con el almacén lleno que juntando (playtest)
    tc: L => ({ pop: 5 + 3 * (L - 1), cap: capR(800 * Math.pow(1.55, L - 1)), train: 0.12 * (L - 1), defense: 25 + 20 * (L - 1), sight: 9 + L }),
    house: L => ({ pop: 5 + 2 * (L - 1) }),
    lumber: campStats, mining: campStats, mill: campStats,
    farm: L => ({ farm: 0.12 * (L - 1) }),
    granary: L => ({ capFood: capR(1200 * Math.pow(1.6, L - 1)) }),
    warehouse: L => ({ capGoods: capR(1000 * Math.pow(1.6, L - 1)) }),
    builder: () => ({ builders: 1 }),
    scout: L => ({ scouts: 1 + Math.floor((L - 1) / 2), range: 18 + 7 * (L - 1), scoutSpeed: 0.06 * (L - 1) }),
    tower: L => ({ defense: Math.round(30 * (1 + 0.4 * (L - 1))), sight: 7 + L }),
    cartwright: L => ({ carts: 1 + L, cartCap: D.CART.cap + 5 * (L - 1), cartSpeed: 0.06 * (L - 1) }),
    market: L => ({ buy: Math.max(0.9, 1.08 - 0.02 * L), sell: Math.min(0.95, 0.68 + 0.03 * L) }),
    sawmill: recipeStats(3), masonry: recipeStats(2), smelter: recipeStats(3), forge: recipeStats(2),
    scriptorium: recipeStats(2), steelworks: recipeStats(3), workshop: recipeStats(3),
    library: L => ({ techMax: L, research: 0.08 * (L - 1) }),
    university: L => ({ research: 0.2 * L }),
    barracks: L => ({ armyTrain: 0.15 * (L - 1) }),
    guild: L => ({ guildBonus: 0.02 * L }),
    consejo: L => ({ consejeros: [1, 2, 3, 5, 7, 9].filter(n => n <= L).length }),
    monastery: L => ({ relics: L, relicGold: 1.5 * (1 + 0.2 * (L - 1)) }),
    wonder: L => ({ prestige: L, allBonus: 0.03 * L }),
  };
  const pct = v => '+' + Math.round(v * 100) + '%';
  D.STAT_LABELS = {
    pop: ['Población', v => '+' + v], cap: ['Capacidad (todo)', v => U.fmt(v)], capFood: ['Capacidad de comida', v => U.fmt(v)], capGoods: ['Capacidad de bienes', v => U.fmt(v)],
    train: ['Velocidad de entrenamiento', pct], defense: ['Defensa', v => String(v)], sight: ['Visión', v => v + ' casillas'],
    gather: ['Ritmo de quien descarga aquí', pct], carry: ['Carga extra', v => '+' + v], farm: ['Rendimiento', pct],
    builders: ['Maestros de Obras', v => '+' + v], scouts: ['Exploradores (máx.)', v => String(v)], range: ['Alcance de exploración', v => v + ' casillas'], scoutSpeed: ['Velocidad de exploradores', pct],
    buy: ['Precio de compra', v => Math.round(v * 100) + '%'], sell: ['Precio de venta', v => Math.round(v * 100) + '%'],
    prod: ['Producción', pct], slots: ['Puestos de trabajo', v => String(v)],
    techMax: ['Nivel máx. de tecnologías', v => String(v)], research: ['Velocidad de investigación', pct], armyTrain: ['Velocidad de entrenamiento', pct],
    consejeros: ['Consejeros', v => v + ' de 6'], guildBonus: ['Recolección (en gremio)', pct], relics: ['Reliquias', v => String(v)], relicGold: ['Oro por reliquia/min', v => v.toFixed(1)],
    prestige: ['Prestigio', v => String(v)], allBonus: ['Bono a todo', pct],
    carts: ['Carretas', v => String(v)], cartCap: ['Carga por carreta', v => String(v)], cartSpeed: ['Velocidad de carretas', pct],
  };

  // ---------- Eras ----------
  // La era desbloquea edificios nuevos y sube el nivel máximo de todos (+2 por era). No da bonos por sí sola:
  // cada edificio mejora por su cuenta.
  D.ERA_NAMES = ['Campamento', 'Aldea', 'Villa', 'Pueblo', 'Ciudad', 'Señorío', 'Reino', 'Imperio', 'Gran Imperio', 'Leyenda'];
  D.eraName = n => (n <= 10 ? D.ERA_NAMES[n - 1] : 'Leyenda ' + U.roman(n - 9));
  D.eraCost = function (n) {
    if (n === 2) return { food: 400, wood: 300 };
    if (n === 3) return { food: 1500, wood: 1000, gold: 300, planks: 150 };
    if (n === 4) return { food: 5000, wood: 3500, stone: 1500, gold: 1000, ingots: 200, books: 40 };
    const k = Math.pow(2.8, n - 4), r = v => Math.round(v / 10) * 10;
    const c = { food: r(7000 * k), wood: r(4500 * k), stone: r(2500 * k), gold: r(1600 * k), blocks: r(300 * k), ingots: r(250 * k), books: r(60 * k), marble: r(150 * k) };
    if (n >= 6) { c.steel = r(40 * k / 2.8); c.gems = r(20 * k / 2.8); }
    if (n >= 7) c.machinery = r(15 * k / 7.84);
    return c;
  };
  D.eraTime = n => (n === 2 ? 120 : n === 3 ? 900 : n === 4 ? 3600 : Math.min(7200 * Math.pow(1.6, n - 5), 3 * 86400));
  D.eraReq = function (n) {
    if (n === 2) return [{ b: 'tc', lvl: 2, text: 'Centro Urbano nivel 2' }, { any: ['lumber', 'mining', 'mill'], n: 2, text: '2 de: Campamento Maderero, Campamento Minero, Molino' }, { any: ['scout'], n: 1, text: 'Puesto de Exploradores' }];
    if (n === 3) return [{ any: ['sawmill'], n: 1, text: 'Un Aserradero' }, { any: ['market', 'library'], n: 1, text: 'Un Mercado o una Biblioteca' }, { lvlAny: 3, n: 4, text: '4 edificios en nivel 3 o más' }];
    if (n === 4) return [{ any: ['smelter'], n: 1, text: 'Una Fundición' }, { any: ['scriptorium'], n: 1, text: 'Un Taller de Copistas' }, { lvlAny: 5, n: 5, text: '5 edificios en nivel 5 o más' }];
    const need = [{ lvlAny: 2 * n - 3, n: n + 1, text: (n + 1) + ' edificios en nivel ' + (2 * n - 3) + ' o más' }, { pop: 30 + n * 10, text: 'Población de ' + (30 + n * 10) }];
    if (n === 5) need.unshift({ any: ['university'], n: 1, text: 'Una Universidad' }, { any: ['steelworks'], n: 1, text: 'Una Acería' });
    if (n === 6) need.unshift({ any: ['workshop'], n: 1, text: 'Un Taller de Ingeniería' });
    return need;
  };
  D.maxPop = era => 50 + era * 40;

  // Decretos reales: en la Era VII y en la X el reino se especializa (para siempre) en una de cuatro ramas.
  D.DECREES = {
    harvest: { name: 'Decreto de la Abundancia', desc: '+15% de recolección y de granjas.', perk: { gatherP: 0.15 } },
    crafts: { name: 'Decreto de los Gremios', desc: '+20% de producción en todos los talleres.', perk: { craftP: 0.2 } },
    sword: { name: 'Decreto de la Espada', desc: '+20% de fuerza del ejército y expediciones 15% más rápidas.', perk: { armyPower: 0.2, expSpeed: 0.15 } },
    lore: { name: 'Decreto del Saber', desc: '+25% de investigación y mejoras de edificios 10% más rápidas.', perk: { researchP: 0.25, upgradeP: 0.1 } },
  };
  D.DECREE_ERAS = [7, 10];
  // Dominar la era: todos tus edificios al nivel máximo de la era actual. Una meta alcanzable en cada era.
  D.masteryReward = era => ({ gold: Math.round(500 * Math.pow(1.8, era - 1)), gems: 10 * era, coins: 15 * era });
  // Mejoras permanentes (decretos, rangos de misiones y estructuras de Leyendas nuevas)
  D.PERK_NAMES = { gatherP: 'recolección', craftP: 'producción de talleres', researchP: 'investigación', upgradeP: 'velocidad de mejoras', armyPower: 'fuerza del ejército', expSpeed: 'velocidad de expediciones' };
  D.perkText = p => Object.keys(p).map(k => '+' + Math.round(p[k] * 100) + '% de ' + D.PERK_NAMES[k]).join(', ');

  // Tecnologías por niveles: cada nivel cuesta 1,75x y tarda 1,85x más. El nivel máximo lo da la Biblioteca.
  D.TECHS = {
    axes: { name: 'Hachas afiladas', desc: '+15% velocidad de tala por nivel', base: { wood: 100, food: 50 } },
    harvest: { name: 'Cosecha eficiente', desc: '+15% comida de bayas y granjas por nivel', base: { food: 100, wood: 50 } },
    hunting: { name: 'Arcos de caza', desc: '+20% rendimiento de la caza por nivel', base: { wood: 120, gold: 30 } },
    picks: { name: 'Picos templados', desc: '+15% minería (piedra, oro, hierro, mármol, gemas) por nivel', base: { wood: 100, stone: 50 } },
    carts: { name: 'Carretillas', desc: '+3 de capacidad de carga por nivel', base: { wood: 150, food: 150 } },
    boots: { name: 'Botas de cuero', desc: '+8% velocidad de los aldeanos por nivel', base: { food: 150, gold: 30 } },
    architecture: { name: 'Arquitectura', desc: '+20% velocidad de construcción por nivel', base: { wood: 150, stone: 100 } },
    engineering: { name: 'Ingeniería', desc: '-5% tiempo de mejora de edificios por nivel (máx. -50%)', base: { stone: 200, gold: 120 } },
    storage: { name: 'Bodegas selladas', desc: '+8% capacidad de almacenamiento por nivel', base: { wood: 200, stone: 150 } },
    cartography: { name: 'Cartografía', desc: '+4 casillas de alcance y +10% velocidad de exploradores por nivel', base: { food: 150, gold: 60 } },
    saws: { name: 'Sierras dentadas', desc: '+20% producción de Aserradero, Cantería y Copistas', base: { wood: 200, gold: 50 } },
    furnaces: { name: 'Hornos de tiro', desc: '+20% producción de Fundición, Herrería, Acería y Taller', base: { stone: 200, gold: 100 }, era: 3 },
    faith: { name: 'Fe', desc: '+25% oro de las reliquias por nivel', base: { gold: 200, books: 10 }, era: 3 },
    tactics: { name: 'Tácticas', desc: '+15% fuerza del ejército por nivel', base: { food: 200, gold: 100 } },
    walls: { name: 'Fortificación', desc: '+20% defensa de torres y Centro Urbano por nivel', base: { stone: 250, gold: 50 } },
  };

  // ---------- Exploración ----------
  // Puntos de interés escondidos en la niebla. Son iguales para todos, pero cada jugador los descubre por su cuenta.
  D.POI = {
    chest: { name: 'Cofre abandonado', w: 1, h: 1, desc: 'Un explorador lo abre al encontrarlo.' },
    ruin: { name: 'Ruinas antiguas', w: 2, h: 2, work: 90, desc: 'Envía aldeanos a excavarlas. Esconden tesoros y saber antiguo.' },
    camp: { name: 'Campamento de bandidos', w: 3, h: 3, desc: 'Bloquea el paso. Atácalo desde el Cuartel para quedarte con su botín.' },
    relic: { name: 'Santuario con reliquia', w: 1, h: 1, desc: 'Llévala a tu Monasterio: dará oro para siempre.' },
    watch: { name: 'Atalaya en ruinas', w: 1, h: 1, reveal: 13, desc: 'Desde lo alto se ve una gran parte del mapa.' },
  };
  // Recompensa según la distancia a tu hogar: más lejos, mejor.
  D.poiTier = d => U.clamp(Math.floor((d - 10) / 12), 0, 6);
  D.chestReward = t => {
    const k = Math.pow(1.9, t), r = v => Math.round(v * k / 10) * 10;
    const c = { food: r(150), wood: r(150), gold: r(80) };
    if (t >= 2) c.stone = r(120);
    if (t >= 3) c.planks = r(40);
    if (t >= 4) c.gems = r(6);
    if (t >= 5) c.books = r(5);
    return c;
  };
  D.ruinReward = t => {
    const k = Math.pow(2, t), r = v => Math.round(v * k / 10) * 10;
    const c = { gold: r(200), stone: r(250) };
    if (t >= 1) c.planks = r(60);
    if (t >= 2) c.books = r(8);
    if (t >= 3) c.marble = r(60);
    if (t >= 4) c.gems = r(15);
    return Object.assign(c, { coins: 3 + t * 2 });
  };
  D.campPower = t => Math.round(45 * Math.pow(1.75, t));
  D.campLoot = t => {
    const k = Math.pow(2.1, t), r = v => Math.round(v * k / 10) * 10;
    const c = { food: r(300), wood: r(300), gold: r(200) };
    if (t >= 2) c.ingots = r(20);
    if (t >= 3) c.tools = r(10);
    if (t >= 4) c.gems = r(10);
    return Object.assign(c, { coins: 5 + t * 3 });
  };

  // ---------- Mundo ----------
  // Mundo grande: 16 reinos en una grilla de 4x4 provincias de 64x64 casillas, así cada reino tiene de 2 a 4
  // vecinos. Las zonas comunes quedan entre vecinos: grandes en los cruces (las comparten 4 reinos) y chicas
  // en el medio de cada frontera (las comparten 2). Todo sale de la semilla: es idéntico para todos.
  D.MAP = 256; D.GRID = 4; D.PROV = 64;
  D.CHUNK = 16;   // el mapa se dibuja y se recorre por trozos de 16x16 (solo lo que está a la vista)
  D.PARCEL = 8;   // el territorio se gana y se pierde por parcelas de 8x8 casillas
  const wrng = U.rng(D.SEED + 404);
  const ZBASE = { tree: 'Bosque', berry: 'Pradera', deer: 'Coto de Caza', stone: 'Cantera', gold: 'Valle Dorado', ore: 'Veta Roja', marble: 'Mármol Blanco', gems: 'Gruta de Gemas' };
  const ZSUF = ['del Norte', 'del Sur', 'de los Reyes', 'del Cuervo', 'de Plata', 'del Alba', 'de la Niebla', 'del Lobo', 'de Hierro', 'del Ocaso', 'de los Monjes', 'del Río', 'de las Ánimas', 'del Halcón', 'del Rey Muerto', 'de Ámbar', 'de la Bruma', 'del Roble', 'de Fuego', 'del Viento', 'de las Brujas', 'del Trueno', 'del Oso', 'de la Luna', 'del Ciervo Blanco', 'de los Gigantes', 'del Este', 'del Oeste', 'de las Campanas', 'del Juglar', 'de la Reina', 'del Ermitaño', 'de los Pinos'];
  const ZR = { tree: 11, berry: 5, deer: 6, stone: 3.4, gold: 3.2, ore: 3.2, marble: 3.2, gems: 2.4 };
  const ZR_EDGE = { tree: 6, berry: 3.5, deer: 4.5, stone: 2.6, gold: 2.4, ore: 2.4 };
  const jit = a => (wrng() - 0.5) * 2 * a;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(wrng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const homes = [];
  for (let gy = 0; gy < D.GRID; gy++) for (let gx = 0; gx < D.GRID; gx++) homes.push([Math.round(gx * D.PROV + D.PROV / 2 + jit(5)), Math.round(gy * D.PROV + D.PROV / 2 + jit(5))]);
  D.ZONES = [];
  let sfx = 0;
  const zname = type => ZBASE[type] + ' ' + ZSUF[sfx++ % ZSUF.length];
  const cross = shuffle(['tree', 'gold', 'stone', 'ore', 'berry', 'deer', 'marble', 'gems', 'tree']);
  for (let gy = 1; gy < D.GRID; gy++) for (let gx = 1; gx < D.GRID; gx++) {
    const type = cross[(gy - 1) * 3 + gx - 1];
    D.ZONES.push({ id: 'z' + D.ZONES.length, name: zname(type), type, cx: Math.round(gx * D.PROV + jit(3)), cy: Math.round(gy * D.PROV + jit(3)), r: ZR[type] });
  }
  const edgeTypes = ['tree', 'stone', 'gold', 'berry', 'deer', 'ore'];
  let et = 0;
  for (let gy = 0; gy < D.GRID; gy++) for (let gx = 0; gx < D.GRID; gx++) {
    const a = homes[gy * D.GRID + gx];
    for (const [nx, ny] of [[gx + 1, gy], [gx, gy + 1]]) {
      if (nx >= D.GRID || ny >= D.GRID) continue;
      const b = homes[ny * D.GRID + nx], type = edgeTypes[et++ % edgeTypes.length];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, side = nx > gx ? [0, 1] : [1, 0], off = jit(8);
      D.ZONES.push({ id: 'z' + D.ZONES.length, name: zname(type), type, cx: Math.round(mx + side[0] * off), cy: Math.round(my + side[1] * off), r: ZR_EDGE[type] });
    }
  }
  D.LAKES = [];
  for (let k = 0, tries = 0; k < 34 && tries < 2000; tries++) {
    const x = 6 + wrng() * (D.MAP - 12), y = 6 + wrng() * (D.MAP - 12), r = 3 + wrng() * 5;
    if (homes.some(h => Math.hypot(h[0] - x, h[1] - y) < 17 + r)) continue;
    if (D.ZONES.some(z => Math.hypot(z.cx - x, z.cy - y) < z.r + r + 5)) continue;
    D.LAKES.push({ x: Math.round(x), y: Math.round(y), r: Math.round(r * 10) / 10 });
    k++;
  }

  // Cada mundo tiene 16 casillas de reino. La tuya es "p"; las demás ("b" + número de casilla) las ocupa
  // otro jugador real (en línea) o un reino simulado. El orden por casilla mantiene el mapa idéntico para todos.
  const BOT_NAMES = ['Aurelio', 'Brunilda', 'Tomás', 'Ingrid', 'Rodrigo', 'Elvira', 'Gunnar', 'Ximena', 'Lotario', 'Urraca', 'Fadrique', 'Sigrid', 'Nuño', 'Berenguela', 'Teobaldo', 'Jimena'];
  const REALM_KIND = ['Valle', 'Marca', 'Señorío', 'Fiordo', 'Condado', 'Feudo', 'Baronía', 'Ducado'];
  const COLORS = [[52, 98, 196], [178, 52, 46], [62, 140, 58], [128, 70, 162], [214, 138, 36], [36, 150, 160], [196, 70, 130], [110, 110, 40], [90, 60, 40], [40, 70, 120], [170, 110, 90], [70, 160, 110], [150, 40, 80], [60, 60, 70], [200, 180, 60], [100, 140, 200]];
  D.REALM_SLOTS = homes.map((home, i) => {
    const near = D.ZONES.slice().sort((a, b) => Math.hypot(a.cx - home[0], a.cy - home[1]) - Math.hypot(b.cx - home[0], b.cy - home[1]));
    return { home, color: COLORS[i], bot: { name: BOT_NAMES[i], realm: REALM_KIND[i % REALM_KIND.length] + ' de ' + BOT_NAMES[i], zones: [near[0].id, near[1].id], strength: Math.round((0.8 + wrng() * 0.45) * 100) / 100 } };
  });
  D.START_REVEAL = 11;
  // humans: { casilla: { id, name } } con los jugadores reales del mundo (además de ti).
  D.setupRealms = function (mySlot, humans) {
    D.MY_SLOT = mySlot;
    const mine = D.REALM_SLOTS[mySlot] || D.REALM_SLOTS[0];
    D.PLAYER_HOME = mine.home;
    D.PLAYER_COLOR = mine.color;
    D.BOTS = [];
    D.REALM_SLOTS.forEach((s, i) => {
      if (i === mySlot) return;
      const h = humans && humans[i];
      D.BOTS.push({
        id: 'b' + i, slot: i, home: s.home, color: s.color, zones: s.bot.zones, strength: s.bot.strength, pers: h ? null : s.bot.pers,
        human: !!h, pid: h ? h.id : null, name: h ? h.name : s.bot.name, realm: h ? 'Reino de ' + h.name : s.bot.realm,
      });
    });
  };
  D.ownerOfSlot = i => (i === D.MY_SLOT ? 'p' : 'b' + i);
  D.slotOfOwner = o => (o === 'p' ? D.MY_SLOT : o && o[0] === 'b' ? +o.slice(1) : -1);
  D.setupRealms(0, null);

  // ---------- Diplomacia (Fase 5, S1, pk-23) ----------
  // Cada reino simulado tiene una personalidad, sembrada por casilla con su propio generador (no toca `wrng`, así el
  // mapa no cambia): cuatro de cada una por mundo. La relación (−100 a +100), los pactos y los eventos los decide
  // server/sim.js; estas tablas las leen los dos lados. Sin servidor, la diplomacia dice «Requiere conexión».
  D.PERSONALIDADES = {
    comerciante: { name: 'Comerciante', desc: 'Le gustan los regalos y los tratados. Casi nunca saquea.', base: 15, regalo: 1.3, saq: 1.8, peso: 0.5, deriva: 1,
      umbral: { comercio: 5, noAgresion: 25, alianza: 55, paz: -60 } },
    conquistador: { name: 'Conquistador', desc: 'Saquea seguido y exige tributo. Solo pacta con quien se gana su respeto.', base: -15, regalo: 0.8, saq: 0.6, peso: 3, deriva: 1.5,
      umbral: { comercio: 30, noAgresion: 45, alianza: 75, paz: -30 } },
    sabio: { name: 'Sabio', desc: 'Paciente: su relación se mueve despacio y aprecia los libros y las gemas.', base: 5, regalo: 1, gustos: ['books', 'gems'], saq: 1.2, peso: 1, deriva: 0.5,
      umbral: { comercio: 15, noAgresion: 20, alianza: 50, paz: -60 } },
    ermitano: { name: 'Ermitaño', desc: 'Quiere que lo dejen en paz: rara vez saquea y casi nunca se alía.', base: 0, regalo: 0.6, saq: 2.5, peso: 0.3, deriva: 0.7,
      umbral: { comercio: 35, noAgresion: 10, alianza: 85, paz: -70 } },
  };
  D.PERS_ORDEN = ['comerciante', 'conquistador', 'sabio', 'ermitano'];
  {
    const r = U.rng(D.SEED + 4243), lista = D.REALM_SLOTS.map((s, i) => D.PERS_ORDEN[i % 4]);
    for (let i = lista.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [lista[i], lista[j]] = [lista[j], lista[i]]; }
    D.REALM_SLOTS.forEach((s, i) => { s.bot.pers = lista[i]; });
    D.setupRealms(0, null);
  }
  D.DIPLO = {
    era: 2,                  // la diplomacia se abre en la Era II
    regaloRes: ['food', 'wood', 'stone', 'gold', 'books', 'gems'],
    regalosDia: 3,           // regalos por día a un mismo reino
    regaloMax: 12,           // lo más que sube la relación un regalo
    maxAliados: 3,
    rompe: 20,               // un pacto se rompe solo si la relación cae este tanto bajo su umbral
    tratado: { buy: 0.9 },   // un tratado de comercio (con quien sea) abarata un 10% las compras del Mercado
    rival: { saq: 0.5, peso: 3, premio: 1.5, conquista: 0.75 }, // un rival saquea más, pero rechazarlo paga más y conquistarlo cuesta menos
    accionesDia: 30,         // propuestas, regalos y respuestas por día (servidor)
    ayuda: { base: 0.12, fuerza: 0.12, boda: 1.5, favor: 2 }, // lo que suma cada aliado a tu defensa contra un saqueo
  };
  D.PACTOS = {
    comercio: { name: 'Tratado de comercio', desc: 'Compras un 10% más barato en el Mercado mientras dure.' },
    noAgresion: { name: 'Pacto de no agresión', desc: 'No te saquea y ninguno puede conquistar las parcelas del otro.' },
    alianza: { name: 'Alianza', desc: 'Incluye la no agresión. Te ayuda contra los saqueos y a veces te manda tropas.' },
    rival: { name: 'Rivalidad', desc: 'Rompe los pactos. Te saquea más, pero rechazarlo paga más y conquistar sus parcelas cuesta menos.' },
  };
  D.diploEscala = era => 300 * Math.pow(1.6, era - 1);
  // Cuánto sube la relación un regalo de `valor` (en oro, al precio del Mercado).
  D.regaloRel = function (valor, era, pers, res) {
    const P = D.PERSONALIDADES[pers] || D.PERSONALIDADES.sabio, gusto = P.gustos && P.gustos.includes(res) ? 1.5 : 1;
    return U.clamp(Math.round((10 * valor / D.diploEscala(era)) * P.regalo * gusto * 10) / 10, 0, D.DIPLO.regaloMax);
  };
  D.relNombre = r => (r <= -60 ? 'Hostil' : r <= -20 ? 'Frío' : r < 20 ? 'Neutral' : r < 60 ? 'Amistoso' : 'Leal');
  // ¿Acepta un reino simulado este pacto? e = { rel, pacto, tratado }. Devuelve null o el motivo.
  D.diploAcepta = function (pers, e, pacto, aliados) {
    const P = D.PERSONALIDADES[pers], u = P && P.umbral[pacto];
    if (!P) return 'Ese reino no responde.';
    if (pacto === 'rival' || pacto === 'romper') return null;
    if (pacto === 'paz') return e.pacto !== 'rival' ? 'No están en rivalidad.' : e.rel < u ? 'Todavía no quiere la paz (relación ' + Math.round(e.rel) + ', pide ' + u + ').' : null;
    if (e.pacto === 'rival') return 'Primero hagan las paces.';
    if (pacto === 'comercio' && e.tratado) return 'Ya tienen un tratado de comercio.';
    if (pacto === 'noAgresion' && (e.pacto === 'noAgresion' || e.pacto === 'alianza')) return 'Ya tienen un pacto de no agresión.';
    if (pacto === 'alianza' && e.pacto === 'alianza') return 'Ya son aliados.';
    if (pacto === 'alianza' && aliados >= D.DIPLO.maxAliados) return 'Ya tienes ' + D.DIPLO.maxAliados + ' aliados.';
    if (e.rel < u) return P.name + ': pide una relación de ' + u + ' (tienes ' + Math.round(e.rel) + ').';
    return null;
  };
  // Ultimátum de un Conquistador: lo que pide para no mandar una partida enseguida.
  D.ultimatumPide = era => ({ gold: Math.round(250 * Math.pow(1.8, era - 1) * 0.3) });

  // ---------- Mundo vivo (Fase 5, S2 a S5, pk-24) ----------
  // Semana UTC que empieza el lunes (el 1-1-1970 fue jueves): jefe del gremio y títulos semanales.
  D.semana = t => Math.floor(((t === undefined ? Date.now() : t) / 864e5 + 3) / 7);
  // S2. Caravanas: van de tu Centro Urbano a un reino con tratado de comercio, venden y vuelven con oro. Las decide
  // el servidor (salida, llegada, asalto); el cliente solo las dibuja con la carreta.
  D.CARAVANA = { era: 2, max: 2, dia: 6, riesgo: 0.08, riesgoDist: 1 / 600, escolta: 0.35, faro: 0.5, asalto: 0.6, socio: 0.25 };
  D.caravanaOro = (era, dist) => Math.round(D.diploEscala(era) * 0.35 * (1 + dist / 80));
  D.caravanaIda = dist => Math.round(60 + dist * 3);        // segundos de ida (y otros tantos de vuelta)
  D.caravanaEscolta = era => ({ food: Math.round(D.diploEscala(era) * 0.12), gold: Math.round(D.diploEscala(era) * 0.08) });
  D.caravanaRiesgo = (dist, escolta, faro) => Math.min(0.6, (D.CARAVANA.riesgo + dist * D.CARAVANA.riesgoDist) * (escolta ? D.CARAVANA.escolta : 1) * (faro ? D.CARAVANA.faro : 1));
  D.distReinos = (a, b) => { const x = D.REALM_SLOTS[a].home, y = D.REALM_SLOTS[b].home; return Math.hypot(x[0] - y[0], x[1] - y[1]); };
  // S3. Jefe semanal del gremio: uno distinto cada semana, con vida compartida. Cada miembro lo ataca hasta 3 veces
  // al día con su ejército (el servidor valida la fuerza como en la conquista); los miembros simulados también pegan.
  D.JEFES_GREMIO = [
    { id: 'leviatan', name: 'El Leviatán del Lago Grande', desc: 'Una serpiente de agua que hunde barcas y puentes.' },
    { id: 'coloso', name: 'El Coloso de Ceniza', desc: 'Un gigante de piedra caliente que baja del volcán.' },
    { id: 'hidra', name: 'La Hidra del Pantano', desc: 'Cada cabeza que cae vuelve a crecer… casi siempre.' },
    { id: 'liche', name: 'El Rey Liche', desc: 'Un rey muerto con un ejército que no se cansa.' },
    { id: 'grifo', name: 'La Reina Grifo', desc: 'Caza caravanas desde las cumbres.' },
  ];
  D.jefeGremioDe = sem => D.JEFES_GREMIO[((sem % D.JEFES_GREMIO.length) + D.JEFES_GREMIO.length) % D.JEFES_GREMIO.length];
  D.JEFE_GREMIO = { ataquesDia: 3, golpe: 3, bajas: 0.1, npc: 0.4, tramos: [0.25, 0.5, 0.75, 1] };
  D.jefeGremioVida = (era, miembros) => Math.round(3000 * Math.pow(1.7, Math.max(1, era) - 1) * (2 + miembros));
  // Premio de cada tramo (al llegar a ese % de daño total), para cada miembro que pegó esa semana.
  D.jefeGremioPremio = (tramo, era) => ({ gold: Math.round(D.diploEscala(era) * 0.3 * tramo), gems: era * tramo, coins: 5 * tramo });
  // S4. Visitas: una vista de solo lectura del reino de otro jugador. Un «me gusta» y un regalo por día y por reino.
  D.visitaRegalo = era => ({ gold: Math.round(D.diploEscala(era) * 0.15) });
  // ---------- El Nuevo Mundo (Fase 9, pk-25: motor de dos mundos, el Galeón y la travesía) ----------
  // Las piezas del Galeón del Alba las dan los capítulos 6 a 9 de la Crónica (D.CAPITULOS[n].galeon); con las cuatro
  // y la Crónica completa (capítulo 10) se puede zarpar. Mientras tanto, la ventana muestra lo que falta.
  D.GALEON = {
    aparece: 6, ultimo: 10,
    piezas: [
      { id: 'casco', name: 'Casco', cap: 6 }, { id: 'timon', name: 'Timón', cap: 7 },
      { id: 'velas', name: 'Velas', cap: 8 }, { id: 'brujula', name: 'Brújula de la bruma', cap: 9 },
    ],
  };
  D.TEMAS = {
    tierra: { name: 'El Reino', mundo: 'Tu reino' },
    mar: { name: 'Archipiélago de Bruma', mundo: 'Archipiélago de Bruma', inicio: { food: 300, wood: 300, stone: 150, gold: 120 } },
  };
  // S5. Rankings: categorías y el título semanal del primero de cada una.
  D.RANKINGS = {
    era: { name: 'Era', titulo: 'Monarca de la Semana' },
    maravilla: { name: 'Maravilla', titulo: 'Gran Arquitecto' },
    piso: { name: 'Piso más profundo', titulo: 'Señor de las Profundidades' },
    defensas: { name: 'Defensas ganadas', titulo: 'Muralla Viva' },
    jefes: { name: 'Jefes de gremio', titulo: 'Cazador de Leviatanes' },
    visitas: { name: 'Más visitados', titulo: 'Reino más Querido' },
  };

  // ---------- Territorio ----------
  // Cada reino parte con las parcelas alrededor de su hogar. Las parcelas libres vecinas se reclaman pagando;
  // las de otro reino solo se toman por la fuerza. Conquistar es caro pero vale la pena: la campaña se paga
  // aunque se pierda, el ganador se lleva botín de guerra, defender sigue siendo más fácil y el núcleo de
  // cada reino es intocable.
  D.TERR = {
    startR: 2.6,        // radio inicial, en parcelas
    core: 1,            // parcelas a esta distancia del hogar (o menos) no se pueden conquistar
    maxBase: 6, maxPerEra: 4,
    shieldWin: 12 * 3600, shieldLoss: 24 * 3600,  // tregua para el defensor después de un ataque
    retake: 48 * 3600,  // durante este tiempo, recuperar una parcela perdida cuesta la mitad (contra un jugador, es revancha)
    minEra: 3,          // conquistar requiere la Era III
  };
  D.maxParcels = (start, era) => start + D.TERR.maxBase + D.TERR.maxPerEra * era;
  D.claimCost = function (extra, era) {
    const k = Math.pow(1.32, extra), r = v => Math.round(v * k / 10) * 10;
    const c = { gold: r(120), food: r(160) };
    if (era >= 2) c.stone = r(80);
    if (extra >= 6) c.planks = r(25);
    return c;
  };
  // Defensa de una parcela: un piso según la era, las torres y Centros Urbanos cerca y la guarnición. Jugar
  // en casa multiplica x1,5 y cada parcela propia alrededor suma 25%: lo profundo es casi imposible de tomar.
  D.parcelDefense = o => D.parcelDefenseParts(o).total; // { era, px, py, towers: [[x, y, def]], army, walls, around, mult }
  // La misma cuenta, separada por origen (para el resumen de cada batalla). Los multiplicadores se reparten en
  // orden: lo que suma cada uno es lo que agrega sobre lo anterior.
  D.parcelDefenseParts = function (o) {
    const cx = (o.px + 0.5) * D.PARCEL, cy = (o.py + 0.5) * D.PARCEL;
    const p = { era: 120 * Math.pow(1.7, o.era - 1), towers: 0, troops: o.army || 0, walls: 0, home: 0, around: 0 };
    for (const t of o.towers || []) { const dist = Math.hypot(t[0] - cx, t[1] - cy); if (dist < 18) p.towers += t[2] * (dist < 9 ? 1 : 0.5); }
    let d = p.era + p.towers + p.troops;
    p.walls = d * 0.2 * (o.walls || 0); d += p.walls;
    p.home = d * 0.5; d += p.home;
    p.around = d * 0.25 * (o.around || 0); d += p.around;
    const extra = d * ((o.mult || 1) - 1); // murallas que encierran la parcela, Torre del Dragón
    p.walls += extra; d += extra;
    for (const k in p) p[k] = Math.round(p[k]);
    p.total = Math.round(d);
    return p;
  };
  // Resumen de una batalla por una parcela: de dónde salió la defensa y la causa principal en una frase.
  // b: { role: 'atk' | 'def', won (del que mira), atk, def, parts }
  D.DEF_PARTS = { troops: ['tropas', 1], towers: ['torres', 1], walls: ['murallas', 1], home: ['bono de local', 0], around: ['parcelas vecinas', 1], era: ['milicia de la era', 0] };
  D.scaleParts = function (parts, total) {
    const out = {}, sum = Math.max(1, parts.total || 0);
    for (const k in D.DEF_PARTS) out[k] = Math.round((parts[k] || 0) * total / sum);
    out.total = Math.round(total);
    return out;
  };
  D.battleCause = function (b) {
    const parts = b.parts || {}, keys = Object.keys(D.DEF_PARTS), sum = Math.max(1, keys.reduce((s, k) => s + (parts[k] || 0), 0));
    const top = keys.map(k => ({ k, v: (parts[k] || 0) / sum })).sort((x, y) => y.v - x.v);
    const pct = v => Math.round(v * 100) + ' %', mine = b.role === 'def';
    const poss = k => { const pl = D.DEF_PARTS[k][1]; return (mine ? (pl ? 'tus ' : 'tu ') : (pl ? 'sus ' : 'su ')) + D.DEF_PARTS[k][0]; };
    let who, share, plural;
    if (top[0].v < 0.5 && top[1].v > 0) {
      const a = top[0].k, c = top[1].k;
      who = poss(a) + ' y ' + (D.DEF_PARTS[a][1] && D.DEF_PARTS[c][1] ? D.DEF_PARTS[c][0] : poss(c));
      share = top[0].v + top[1].v; plural = true;
    } else { who = poss(top[0].k); share = top[0].v; plural = !!D.DEF_PARTS[top[0].k][1]; }
    const sumo = plural ? 'sumaron' : 'sumó', ratio = b.atk / Math.max(1, b.def);
    const times = r => r.toFixed(1).replace('.', ',');
    if (b.role === 'atk') {
      if (b.won) return 'Ganaste' + (ratio < 1.15 ? ' por poco' : '') + ': llegaste con ' + times(ratio) + ' veces su defensa. Lo más duro: ' + who + ' (' + pct(share) + ').';
      return 'Perdiste' + (ratio >= 0.9 ? ' por poco' : '') + ': ' + who + ' ' + sumo + ' el ' + pct(share) + ' de la defensa.';
    }
    if (b.won) return 'Resististe: ' + who + ' ' + sumo + ' el ' + pct(share) + ' de la defensa.';
    const weak = top.filter(o => o.k === 'towers' || o.k === 'walls' || o.k === 'troops').sort((x, y) => x.v - y.v)[0];
    return 'Perdiste la parcela: llegaron con ' + times(ratio) + ' veces tu defensa. Lo que más pesó: ' + who + ' (' + pct(share) + '); con más ' + D.DEF_PARTS[weak.k][0] + ' habrías aguantado mejor.';
  };
  // La campaña se paga aunque se pierda. Cada conquista reciente encarece la siguiente.
  D.conquestCost = function (era, recent) {
    const k = Math.pow(1.6, era - 1) * (1 + 0.5 * recent), r = v => Math.round(v * k / 10) * 10;
    return { gold: r(600), food: r(900), wood: r(400) };
  };
  // Pérdidas del atacante: moderadas si gana (menos cuanto más fuerte llega), grandes si pierde.
  D.conquestLoss = (won, ratio) => (won ? U.clamp(0.3 - 0.12 * (ratio - 1), 0.12, 0.3) : U.clamp(0.7 + 0.1 * Math.random(), 0.7, 0.8));
  // Botín de guerra al ganar: los graneros y el tesoro de la parcela tomada (no sale de la bodega del defensor).
  D.conquestLoot = function (era) {
    const k = Math.pow(1.6, era - 1), r = v => Math.round(v * k / 10) * 10;
    return { gold: r(450), food: r(700), wood: r(500), stone: r(300), gems: 3 + era };
  };
  // Poder de un reino para el emparejamiento: los muy avanzados no pueden atacar a los que recién empiezan.
  D.realmScore = (era, levels, pop) => era * 100 + levels * 2 + pop;
  // revenge: quien te quitó una parcela no se esconde detrás de su tregua ni de la diferencia de poder.
  D.canConquer = function (a, b, revenge) { // a, b: { era, score, newbie, shield, pacto }
    if (a.era < D.TERR.minEra) return 'Conquistar requiere la Era ' + U.roman(D.TERR.minEra) + '.';
    if (b.pacto === 'noAgresion' || b.pacto === 'alianza') return 'Tienes ' + (b.pacto === 'alianza' ? 'una alianza' : 'un pacto de no agresión') + ' con ese reino.';
    if (revenge) return null;
    if (b.newbie) return 'Ese reino está en tregua de novato.';
    if (b.shield) return 'Ese reino rechazó o sufrió un ataque hace poco y está en tregua.';
    if (a.era - b.era >= 2) return 'Ese reino está muy por debajo de ti: no puedes atacarlo.';
    if (b.score < a.score * 0.5) return 'Ese reino es mucho más débil que el tuyo: no puedes atacarlo.';
    return null;
  };

  // ---------- Logística ----------
  // Caminos (aceleran a todos), carretas (llevan insumos y productos entre almacenes y talleres) y, ya muy
  // avanzado, cintas transportadoras que unen dos edificios y mueven todo sin que nadie lo cargue.
  D.ROAD = { cost: { stone: 3 }, era: 1, walk: 1.4, cart: 1.8 };
  D.CART = { cost: { wood: 80, gold: 10 }, time: 20, speed: 1.3, offRoad: 0.65, cap: 20 };
  D.BELT = { cost: { steel: 3, machinery: 1 }, era: 5, need: { b: 'workshop', lvl: 3 }, speed: 2.4, rate: 3 };
  D.BUF = 30;          // capacidad de los depósitos de un taller, por puesto de trabajo
  D.NEAR_STORE = 3;    // un taller a esta distancia de un almacén se abastece solo, sin carretas

  // Gremio
  D.GUILD_NAME = 'Gremio del Roble';
  D.GUILD_MEMBERS = ['Aldric', 'Mirela', 'Osvaldo', 'Leonor', 'Bertrán', 'Sancha'];
  D.GUILD_STAGE_NAMES = ['Empalizada del Gremio', 'Puente de Piedra', 'Gran Lonja', 'Faro del Río', 'Torre del Reloj', 'Catedral del Roble', 'Puerto Real', 'Gran Biblioteca', 'Coliseo', 'Maravilla del Roble'];
  D.guildStage = function (s) {
    const k = Math.pow(2.1, s), r = v => Math.round(v / 10) * 10;
    const cost = { wood: r(3000 * k), stone: r(2000 * k), gold: r(800 * k) };
    if (s >= 1) cost.planks = r(300 * k);
    if (s >= 3) { cost.blocks = r(150 * k); cost.ingots = r(120 * k); }
    if (s >= 5) { cost.tools = r(60 * k); cost.marble = r(80 * k); }
    // una etapa de cada tres pide un recurso que solo sale de ciertas zonas: casi siempre hay que pedirlo a otro
    let zone = null;
    if (s % 3 === 2) {
      zone = D.GUILD_ZONE_RES[Math.floor(s / 3) % D.GUILD_ZONE_RES.length];
      cost[zone.res] = (cost[zone.res] || 0) + r(zone.base * k);
    }
    const name = s < D.GUILD_STAGE_NAMES.length ? D.GUILD_STAGE_NAMES[s] : 'Maravilla ' + U.roman(s - D.GUILD_STAGE_NAMES.length + 2);
    return { name, cost, zoneRes: zone ? zone.res : null };
  };
  D.GUILD_ZONE_RES = [{ res: 'marble', base: 100 }, { res: 'gems', base: 8 }];
  // Dónde se consigue un recurso de zona: su zona común (la comparten 4 reinos) y vetas sueltas lejos de los pueblos.
  D.zoneResWhere = function (res) {
    const z = D.ZONES.filter(o => o.type === res).map(o => o.name);
    return (z.length ? 'Solo sale de ' + z.join(' y ') + ' (zona común)' : 'Solo sale de ciertas zonas') + ' y de vetas sueltas lejos de los pueblos.';
  };
  // Eventos del gremio: una meta común con plazo (48 h). Todos aportan el mismo recurso; si se llega a la
  // meta, cada uno recibe monedas y gemas según su parte (con la mitad de la meta hay un premio consuelo).
  D.GUILD_EVENTS = [
    { res: 'food', name: 'Feria de la cosecha', base: 1500 },
    { res: 'wood', name: 'Gran tala', base: 1500 },
    { res: 'stone', name: 'Cantera común', base: 900 },
    { res: 'gold', name: 'Tesoro del gremio', base: 600 },
    { res: 'planks', name: 'Astillero del gremio', base: 300 },
  ];
  D.GUILD_EVENT_HOURS = 48;
  D.newGuildEvent = function (stage, members, seed) {
    const e = D.GUILD_EVENTS[Math.abs(seed) % D.GUILD_EVENTS.length];
    return { res: e.res, name: e.name, goal: Math.round((e.base * (1 + 0.4 * stage) * Math.max(4, members)) / 10) * 10, prog: 0, contrib: {}, ends: Date.now() + D.GUILD_EVENT_HOURS * 3600e3, done: false };
  };
  D.guildEventReward = function (share, ratio, stage, top) {
    if (ratio < 0.5 || share <= 0) return null;
    const full = ratio >= 1, rw = { coins: Math.round((full ? 12 + 4 * stage : 4) + share * (full ? 60 : 15)), gems: full ? Math.round(3 + share * 25) : 0 };
    if (top) { const t = D.guildEventTop(stage, full); rw.coins += t.coins; rw.gems += t.gems; rw.top = true; }
    return rw;
  };
  // Premio extra para quien más aportó al evento (el doble si se cumplió la meta). Va con medalla y mención en el chat.
  D.guildEventTop = (stage, full) => ({ coins: (full ? 2 : 1) * (8 + 2 * stage), gems: full ? 4 + stage : 1 });
  // Quién más aportó: la clave del aporte mayor (en un empate gana el que aparece primero).
  D.eventTopKey = contrib => Object.keys(contrib || {}).reduce((best, k) => (contrib[k] > 0 && (!best || contrib[k] > contrib[best]) ? k : best), null);
  // Ayudas: cada compañero que ayuda descuenta un 3% (mínimo 1 minuto) de una mejora en curso. Hasta 5
  // ayudas por pedido; quien ayuda gana 2 monedas y un poco de oro y comida según su era (hasta 20 al día).
  // Los pedidos duran 18 h (ayudas asíncronas: los compañeros ayudan cuando entran). Al primer pedido de cada
  // jugador siempre lo ayuda un miembro simulado a los pocos minutos (firstHelp: entre a y b segundos).
  D.GUILD_HELP = { cut: 0.03, min: 60, max: 5, daily: 20, ttl: 18 * 3600, coins: 2, firstHelp: [120, 300] };
  D.GUILD_APPRENTICE = 'Aprendiz del gremio'; // el ayudante simulado de los gremios que no tienen miembros simulados
  // Tablón "Necesito…": cada miembro pide un recurso (un pedido a la vez) y los demás se lo mandan desde su
  // bodega. Mandar al menos un cuarto del pedido (o completarlo) da unas monedas, hasta 5 veces al día.
  D.GUILD_NEED = { ttl: 24 * 3600, value: 400, min: 0.25, coins: 3, daily: 5 };
  D.MARKET_BASE = { food: 100, wood: 100, stone: 130, ore: 140, marble: 320, gems: 1500, planks: 260, blocks: 450, ingots: 650, tools: 1600, books: 900, steel: 1800, machinery: 5000 };
  D.NEED_RES = Object.keys(D.MARKET_BASE);
  // Cuánto se pide: lo que valen unos 400 de oro por era en el mercado.
  D.needAmount = (res, era) => Math.max(10, Math.round((D.GUILD_NEED.value * Math.max(1, era) * 100) / (D.MARKET_BASE[res] || 100) / 10) * 10);
  D.needRewardable = (sent, need) => sent >= need.n * D.GUILD_NEED.min || need.got + sent >= need.n;
  D.helpCut = total => Math.max(D.GUILD_HELP.min, total * D.GUILD_HELP.cut);
  D.helpReward = era => ({ gold: 25 * era, food: 40 * era });
  D.GUILD_HELP_WANTS = ['Herrería nivel 4', 'Granja nivel 6', 'Aserradero nivel 5', 'Muralla del puerto', 'Biblioteca nivel 3', 'Cantera nivel 5', 'Molino nivel 4', 'Cuartel nivel 3'];
  // Plaza del mundo: frases rápidas y lo que dicen los reinos simulados.
  D.QUICK_SAY = ['¡Hola, vecinos!', '¿Alguien comercia piedra?', '¡Busco aliados!', '¡Cuidado con los lobos!', 'Ofrezco madera por oro', '¡Buena partida!'];
  D.WORLD_CHAT = ['Se vende madera barata en el tablón.', '¿Quién está juntando para la zona común del norte?', 'Mis exploradores vieron una cripta al este.',
    'Busco gremio activo.', 'Los lobos no me dejan en paz.', '¡Llegué a la Era III!', 'Cambio piedra por comida.', 'Cuidado: la cantera común se está agotando.'];
  D.GUILD_CHAT = [
    '¿Alguien tiene piedra de sobra? La Cantera Gris está casi vacía.',
    'Acabo de aportar madera al proyecto. ¡Vamos que se puede!',
    'Cuidado con Brunilda, anda saqueando caravanas.',
    'El ' + ((D.ZONES.find(z => z.type === 'tree') || {}).name || 'bosque común') + ' rebrota lento, no talen todo de una vez.',
    'Vendo tablones baratos en el mercado.',
    'Mi explorador encontró unas ruinas al norte. ¡Tenían libros!',
    'Mis aldeanos trabajaron toda la noche, ¡qué alegría volver!',
    'Recuerden: la Gruta de Gemas se regenera muy lento.',
    'Hoy subo el almacén, que ya no me cabe nada.',
    'Construí torres, que vengan si se atreven.',
    'Dos maestros de obras cambian todo, se los juro.',
    'Hay un campamento de bandidos cerca del coto de caza, ojo.',
  ];

  // ---------- Recursos especiales ----------
  // Solo salen de las mazmorras (cuevas, guaridas, catacumbas, cráteres y nidos) y de los encargos del
  // Cuartel. No se venden ni ocupan bodega: se gastan en las estructuras de las Leyendas.
  D.SPECIAL = ['crystal', 'hide', 'lore', 'starIron', 'scale', 'herbs', 'titanBone', 'pearls'];
  Object.assign(D.RES, {
    crystal: { name: 'Cristal de cueva', special: true },
    hide: { name: 'Pieles raras', special: true },
    lore: { name: 'Pergaminos arcanos', special: true },
    starIron: { name: 'Hierro estelar', special: true },
    scale: { name: 'Escamas de dragón', special: true },
    // H4 (pk-17): de las mazmorras nuevas
    herbs: { name: 'Hierbas raras', special: true },
    titanBone: { name: 'Hueso de titán', special: true },
    pearls: { name: 'Perlas abisales', special: true },
  });
  D.RES_ORDER.push(...D.SPECIAL);

  // ---------- Ejército ----------
  // Cada mazmorra tiene su tipo de enemigo y cada tropa rinde distinto contra cada uno: armar la
  // compañía correcta importa más que mandar muchas tropas.
  D.ENEMY = {
    beast: { name: 'Bestias', desc: 'Lobos gigantes, osos y jabalíes. Los lanceros los frenan y los ballesteros los tumban.' },
    bandit: { name: 'Bandidos', desc: 'Forajidos armados. Arqueros, caballeros y jinetes los dispersan.' },
    undead: { name: 'No-muertos', desc: 'Esqueletos y espectros. Los clérigos y los monjes los deshacen.' },
    golem: { name: 'Gólems', desc: 'Piedra y cristal vivos. Las flechas rebotan: hace falta catapulta, caballería, virotes o magia.' },
    dragon: { name: 'Dragón', desc: 'Vuela y escupe fuego. Arqueros y lanceros, y clérigos para sobrevivir.' },
    // H4 (pk-17); las tropas que les responden mejor llegaron en pk-21 (Jinete, Ballestero, Monje, Mago).
    arcane: { name: 'Arcanos', desc: 'Brujas que maldicen (tus tropas se frenan) y fuegos fatuos. Jinetes, monjes, caballeros y clérigos los deshacen.' },
    giant: { name: 'Gigantes', desc: 'Lentos y con mucha vida; su golpe alcanza a varios. Ballesteros y catapultas de lejos, y dispérsate.' },
    abyss: { name: 'Abisales', desc: 'Tentáculos que agarran y sirenas que cantan. Magos de batalla, arqueros y clérigos.' },
  };
  // vs: multiplicador contra cada tipo de enemigo. heal: cuánto reduce las bajas cada unidad (clérigos).
  D.ARMY = {
    militia: { name: 'Miliciano', role: 'Barato y sin especialidad.', cost: { food: 40, gold: 15 }, time: 15, power: 5, era: 2, lvl: 1, vs: {} },
    spear: { name: 'Lancero', role: 'x2 contra bestias y x1,5 contra dragones.', cost: { food: 50, wood: 30, gold: 15 }, time: 18, power: 6, era: 2, lvl: 2, vs: { beast: 2, dragon: 1.5 } },
    archer: { name: 'Arquero', role: 'x1,6 contra bandidos, x1,5 contra dragones y abisales, x1,4 contra gigantes; la mitad contra gólems.', cost: { wood: 30, gold: 30 }, time: 18, power: 6, era: 2, lvl: 3, vs: { bandit: 1.6, dragon: 1.5, golem: 0.5, giant: 1.4, abyss: 1.5 } },
    knight: { name: 'Caballero', role: 'x1,5 contra bandidos y arcanos, x1,4 contra gólems y x1,3 contra no-muertos.', cost: { food: 60, gold: 60, ingots: 2 }, time: 30, power: 16, era: 3, lvl: 4, vs: { bandit: 1.5, golem: 1.4, undead: 1.3, arcane: 1.5 } },
    cleric: { name: 'Clérigo', role: 'x3 contra no-muertos, x1,6 contra arcanos y x1,5 contra abisales. Cada clérigo reduce las bajas un 3% (máx. 45%).', cost: { food: 40, gold: 50, books: 1 }, time: 25, power: 4, era: 3, lvl: 5, vs: { undead: 3, arcane: 1.6, abyss: 1.5 }, heal: 0.03 },
    // Fase 4 (pk-21): las tropas que el plan dejó para Combate 2.0 (H4). Cada enemigo tiene al menos dos respuestas.
    rider: { name: 'Jinete', role: 'Rápido y flanquea: va por los tiradores. x1,5 contra arcanos, x1,3 contra bandidos.', cost: { food: 90, gold: 50, ingots: 1 }, time: 28, power: 14, era: 3, lvl: 5, vs: { arcane: 1.5, bandit: 1.3 } },
    crossbow: { name: 'Ballestero', role: 'Tirador pesado y lento. x2 contra gigantes, x1,4 contra bestias y x1,3 contra gólems.', cost: { wood: 70, gold: 55, ingots: 1 }, time: 30, power: 12, era: 4, lvl: 6, vs: { giant: 2, beast: 1.4, golem: 1.3 } },
    monk: { name: 'Monje guerrero', role: 'Pelea de cerca y cura un poco a los de al lado. x1,5 contra arcanos y no-muertos; reduce las bajas un 1,5% cada uno.', cost: { food: 70, gold: 45, books: 1 }, time: 26, power: 10, era: 5, lvl: 7, vs: { arcane: 1.5, undead: 1.5 }, heal: 0.015 },
    mage: { name: 'Mago de batalla', role: 'Daño en área desde lejos. x2 contra abisales y x1,4 contra gólems.', cost: { food: 60, gold: 160, books: 3 }, time: 45, power: 34, era: 6, lvl: 8, vs: { abyss: 2, golem: 1.4 } },
    catapult: { name: 'Catapulta', role: 'x2 contra gólems y x1,8 contra gigantes; la mitad contra bestias.', cost: { wood: 200, gold: 120, machinery: 2 }, time: 60, power: 60, era: 5, lvl: 7, vs: { golem: 2, beast: 0.5, giant: 1.8 } },
  };
  // Partidas de saqueo de los reinos simulados (C6, pk-22; las decide server/sim.js): tope por recurso de una
  // derrota y el tributo que las hace volver.
  D.saqTope = era => Math.round(250 * Math.pow(1.8, era - 1));
  D.saqTributo = era => { const t = D.saqTope(era); return { food: Math.round(t * 0.4), gold: Math.round(t * 0.3) }; };
  // Veteranía: cada tipo de tropa junta experiencia en las expediciones (y en la Arena). +4% de fuerza por rango.
  D.RANKS = ['Recluta', 'Soldado', 'Curtido', 'Veterano', 'Sargento', 'Élite', 'Campeón', 'Héroe', 'Leyenda', 'Mito', 'Inmortal'];
  D.rankOf = xp => Math.min(D.RANKS.length - 1, Math.floor(Math.log2(1 + (xp || 0) / 40)));
  D.rankXp = r => 40 * (Math.pow(2, r) - 1);

  // ---------- Mazmorras ----------
  // Se descubren explorando. Cada una tiene pisos: cada piso es más duro y da más. Los pisos ya limpiados
  // se pueden repetir para juntar recursos especiales, pero la mazmorra necesita un rato para reponerse.
  D.DUNGEON = {
    cave: { name: 'Cueva de Cristal', enemy: { golem: 0.6, beast: 0.4 }, loot: 'crystal', extra: { gems: 4 }, era: 2, base: 70, floors: 12, rest: 40 * 60, desc: 'Túneles que brillan. Gólems de cristal y fieras que anidan en la oscuridad.' },
    lair: { name: 'Guarida de Bestias', enemy: { beast: 1 }, loot: 'hide', extra: { food: 150 }, era: 2, base: 60, floors: 12, rest: 30 * 60, desc: 'Huesos en la entrada y gruñidos adentro. Pieles raras para quien se atreva.' },
    crypt: { name: 'Catacumbas', enemy: { undead: 0.8, bandit: 0.2 }, loot: 'lore', extra: { books: 3 }, era: 3, base: 160, floors: 15, rest: 60 * 60, desc: 'Criptas olvidadas con pergaminos arcanos. Los muertos no descansan.' },
    crater: { name: 'Cráter Estelar', enemy: { golem: 0.5, bandit: 0.5 }, loot: 'starIron', extra: { ingots: 8 }, era: 4, base: 420, floors: 15, rest: 90 * 60, desc: 'Aquí cayó una estrella. Su hierro atrae ladrones y despierta a la piedra.' },
    nest: { name: 'Nido del Dragón', enemy: { dragon: 1 }, loot: 'scale', extra: { gold: 400 }, era: 5, base: 1400, floors: 10, rest: 3 * 3600, desc: 'Montañas de oro y un dragón que no comparte. Escamas para la Torre del Dragón.' },
    // H4 (pk-17)
    swamp: { name: 'Pantano de las Brujas', enemy: { arcane: 0.75, beast: 0.25 }, loot: 'herbs', extra: { food: 400 }, era: 3, base: 240, floors: 15, rest: 60 * 60, desc: 'Niebla verde, luces que flotan y una choza sobre patas. Hierbas raras para el Herbolario.' },
    giants: { name: 'Fortaleza de los Gigantes', enemy: { giant: 0.8, golem: 0.2 }, loot: 'titanBone', extra: { stone: 900 }, era: 6, base: 2600, floors: 15, rest: 2 * 3600, desc: 'Murallas que hizo alguien diez veces más alto. Hueso de titán para la Forja de Titanes.' },
    temple: { name: 'Templo Hundido', enemy: { abyss: 0.8, undead: 0.2 }, loot: 'pearls', extra: { gems: 10 }, era: 8, base: 7000, floors: 15, rest: 3 * 3600, desc: 'Un templo a medias bajo el lago. Algo canta allá abajo. Perlas abisales para el Faro.' },
  };
  D.dungeonPower = (kind, floor) => Math.round(D.DUNGEON[kind].base * Math.pow(1.38, floor - 1));
  D.dungeonLoot = function (kind, floor, first) {
    const d = D.DUNGEON[kind], k = Math.pow(1.3, floor - 1), out = {};
    out[d.loot] = Math.max(1, Math.round((first ? 10 : 6) * k));
    for (const r in d.extra) out[r] = Math.round(d.extra[r] * k);
    out.gold = (out.gold || 0) + Math.round(40 * k);
    if (first) out.coins = 2 + floor;
    return out;
  };
  // Encargos del tablón del Cuartel: no están en el mapa, duran un rato fijo y se renuevan cada 4 horas.
  D.MISSIONS = [
    { id: 'escort', name: 'Escoltar una caravana', enemy: { bandit: 1 }, base: 50, time: 20 * 60, era: 2, loot: { gold: 250 }, sp: 'lore', spN: 2, desc: 'Un mercader paga bien si su carga llega entera.' },
    { id: 'bear', name: 'El oso de la colina', enemy: { beast: 1 }, base: 70, time: 15 * 60, era: 2, loot: { food: 300 }, sp: 'hide', spN: 4, desc: 'Un oso enorme asusta a los leñadores.' },
    { id: 'smugglers', name: 'Contrabandistas de cristal', enemy: { bandit: 0.7, beast: 0.3 }, base: 90, time: 25 * 60, era: 2, loot: { gold: 200 }, sp: 'crystal', spN: 4, desc: 'Sacan cristal de una cueva cercana y lo venden lejos.' },
    { id: 'wolves', name: 'La manada del barranco', enemy: { beast: 1 }, base: 110, time: 25 * 60, era: 2, loot: { wood: 300 }, sp: 'hide', spN: 5, desc: 'Lobos grises bajan cada noche al camino.' },
    { id: 'haunt', name: 'El molino embrujado', enemy: { undead: 1 }, base: 120, time: 25 * 60, era: 3, loot: { gold: 300 }, sp: 'lore', spN: 3, desc: 'Nadie muele desde que volvió el antiguo molinero.' },
    { id: 'golem', name: 'Gólem en la cantera', enemy: { golem: 1 }, base: 150, time: 30 * 60, era: 3, loot: { stone: 600 }, sp: 'crystal', spN: 5, desc: 'Las rocas de la cantera se pusieron de pie.' },
    { id: 'pilgrims', name: 'Proteger peregrinos', enemy: { undead: 0.5, bandit: 0.5 }, base: 100, time: 20 * 60, era: 3, loot: { gold: 250, books: 5 }, sp: 'lore', spN: 2, desc: 'El camino al santuario cruza un cementerio y un bosque de forajidos.' },
    { id: 'meteor', name: 'Cayó una estrella', enemy: { golem: 0.5, bandit: 0.5 }, base: 300, time: 45 * 60, era: 4, loot: { ingots: 40 }, sp: 'starIron', spN: 4, desc: 'Todos vieron caer la luz. Hay que llegar primero.' },
    { id: 'wyvern', name: 'Cría de dragón', enemy: { dragon: 1 }, base: 900, time: 60 * 60, era: 5, loot: { gold: 1500 }, sp: 'scale', spN: 3, desc: 'Un dragón joven se instaló en el campanario.' },
  ];
  D.missionScale = era => Math.pow(1.7, Math.max(0, era - 2));
  // Bendiciones de la Fuente de los Deseos (una por día; se elige entre tres).
  D.WISHES = [
    { k: 'harvest', name: 'Cosecha abundante', desc: 'más recolección de todos los aldeanos' },
    { k: 'craft', name: 'Manos de oro', desc: 'más producción en todos los talleres' },
    { k: 'build', name: 'Constructores incansables', desc: 'obras más rápidas' },
    { k: 'army', name: 'Valor', desc: 'más fuerza en expediciones y defensa' },
    { k: 'fortune', name: 'Lluvia de monedas', desc: 'oro al instante', instant: true },
  ];

  // ---------- Murallas ----------
  // Se trazan casilla por casilla en tu territorio. Las puertas dejan pasar a tu gente, no a los lobos ni a
  // los enemigos. Las parcelas encerradas por murallas (también valen edificios y agua) se defienden mucho
  // mejor. Todas las murallas suben de material juntas.
  D.WALL = {
    tiers: [
      { name: 'Empalizada', cost: { wood: 8 }, era: 1, bonus: 0.3 },
      { name: 'Muro de piedra', cost: { stone: 10 }, era: 2, bonus: 0.6, up: { stone: 12, gold: 2 } },
      { name: 'Muralla de sillares', cost: { blocks: 4 }, era: 3, bonus: 1.0, up: { blocks: 5, gold: 4 } },
      { name: 'Bastión', cost: { blocks: 6, steel: 1 }, era: 5, bonus: 1.6, up: { blocks: 6, steel: 1, gold: 8 } },
    ],
    gate: { wood: 40, stone: 20 },
  };

  // ---------- Estructuras de las Leyendas ----------
  // Únicas. Se desbloquean con las misiones de la rama Leyendas y piden recursos especiales.
  Object.assign(D.BUILD, {
    tavern: { name: 'Taberna', w: 3, h: 3, cost: { wood: 300, stone: 120, gold: 80 }, time: 60, era: 2, max: 1, lock: 'tavern', desc: 'Los parroquianos traen rumores: más encargos en el Cuartel y expediciones más rápidas.' },
    wishwell: { name: 'Fuente de los Deseos', w: 2, h: 2, cost: { stone: 250, gold: 100, crystal: 15 }, time: 60, era: 2, max: 1, lock: 'wishwell', desc: 'Un deseo al día: elige una bendición entre tres. Con más nivel, duran más y rinden más.' },
    arena: { name: 'Arena de Entrenamiento', w: 3, h: 3, cost: { wood: 400, stone: 300, hide: 10 }, time: 90, era: 2, max: 1, lock: 'arena', desc: 'Tus tropas en casa ganan experiencia solas y pelean mejor.' },
    beasthouse: { name: 'Casa de Fieras', w: 3, h: 3, cost: { wood: 500, planks: 120, hide: 40 }, time: 120, era: 3, max: 1, lock: 'beasthouse', desc: 'Bueyes y mulas domados: carretas más rápidas y con más carga. Los lobos no se acercan a sus alrededores.' },
    observatory: { name: 'Observatorio', w: 2, h: 2, cost: { stone: 500, planks: 150, crystal: 20, lore: 5 }, time: 120, era: 3, max: 1, lock: 'observatory', desc: 'Marca en el mapa las mazmorras cercanas, anuncia lobos y eventos, y acelera la investigación.' },
    sanctum: { name: 'Santuario de Cristal', w: 3, h: 3, cost: { blocks: 200, marble: 80, crystal: 60 }, time: 180, era: 3, max: 1, lock: 'sanctum', desc: 'La luz de los cristales: más producción en todos los talleres.' },
    runeforge: { name: 'Fragua Rúnica', w: 3, h: 3, cost: { blocks: 300, ingots: 150, starIron: 20, lore: 15 }, time: 240, era: 4, max: 1, lock: 'runeforge', desc: 'Armas con runas: más fuerza para todo el ejército y más experiencia en cada expedición.' },
    dragontower: { name: 'Torre del Dragón', w: 2, h: 2, cost: { blocks: 800, steel: 150, scale: 20, crystal: 50 }, time: 600, era: 5, max: 1, lock: 'dragontower', desc: 'Un dragón domado vigila el reino: más defensa en todas tus parcelas y una vista enorme.' },
  });
  // Las tres últimas llegan tarde (Eras VIII, X y XII) para que siempre haya algo nuevo que perseguir.
  Object.assign(D.BUILD, {
    gardens: { name: 'Jardines Colgantes', w: 3, h: 3, cost: { blocks: 1500, marble: 600, gems: 120, crystal: 120 }, time: 900, era: 8, max: 1, lock: 'gardens', desc: 'Terrazas de flores sobre el reino: más recolección de todo.' },
    archive: { name: 'Gran Archivo', w: 3, h: 3, cost: { blocks: 3000, books: 1200, marble: 900, lore: 60 }, time: 1200, era: 10, max: 1, lock: 'archive', desc: 'Toda la memoria del reino: investigación y mejoras de edificios más rápidas.' },
    colossus: { name: 'Coloso del Reino', w: 2, h: 2, cost: { steel: 1500, machinery: 400, starIron: 80, scale: 60 }, time: 1800, era: 12, max: 1, lock: 'colossus', desc: 'Una estatua gigante con la antorcha del reino: más fuerza del ejército y más producción.' },
  });
  // H4 (pk-17): una por mazmorra nueva
  Object.assign(D.BUILD, {
    herbolario: { name: 'Herbolario', w: 2, h: 2, cost: { wood: 900, planks: 200, herbs: 30 }, time: 180, era: 3, max: 1, lock: 'herbolario', desc: 'Ungüentos y pociones: los héroes se curan antes y cada incursión lleva pociones que salvan a parte de los caídos.' },
    titanforge: { name: 'Forja de Titanes', w: 3, h: 3, cost: { blocks: 1200, steel: 300, titanBone: 30 }, time: 900, era: 6, max: 1, lock: 'titanforge', desc: 'Un yunque de hueso de titán: al mejorar el equipo de un héroe, a veces sube de rareza. Más fuerza del ejército.' },
    faro: { name: 'Faro Abisal', w: 2, h: 2, cost: { blocks: 2500, marble: 800, pearls: 30 }, time: 1200, era: 8, max: 1, lock: 'faro', desc: 'Una luz que ve por encima de la niebla: visión enorme, expediciones más rápidas y carretas más seguras.' },
  });
  D.LEGEND_B = ['tavern', 'wishwell', 'arena', 'beasthouse', 'observatory', 'sanctum', 'runeforge', 'dragontower', 'herbolario', 'titanforge', 'faro', 'gardens', 'archive', 'colossus'];
  D.BUILD_ORDER.splice(D.BUILD_ORDER.indexOf('wonder'), 0, ...D.LEGEND_B);
  for (const k of D.LEGEND_B) { const b = D.BUILD[k]; b.sight = b.w >= 3 ? 5 : 4; b.upT = 1.2; }
  Object.assign(D.BSTATS, {
    tavern: L => ({ missions: 1 + Math.floor(L / 3), expSpeed: Math.min(0.4, 0.05 * L) }),
    wishwell: L => ({ wishTime: 3600 + 1200 * (L - 1), wishPower: 0.25 + 0.05 * (L - 1) }),
    arena: L => ({ armyXp: 8 * L, armyPower: 0.02 * L }),
    beasthouse: L => ({ cartBoost: 0.08 * L, wolfWard: 10 + 2 * L }),
    observatory: L => ({ research: 0.05 * L, scan: 30 + 10 * L, sight: 12 + L }),
    gardens: L => ({ gatherP: Math.min(0.4, 0.03 * L) }),
    archive: L => ({ researchP: Math.min(0.6, 0.05 * L), upgradeP: Math.min(0.2, 0.015 * L) }),
    colossus: L => ({ armyPower: 0.05 * L, craftP: Math.min(0.4, 0.03 * L) }),
    sanctum: L => ({ shrineProd: 0.05 * L }),
    runeforge: L => ({ armyPower: 0.05 * L, xpBoost: 0.1 * L }),
    dragontower: L => ({ terrDef: 0.1 * L, sight: 16 + L }),
    herbolario: L => ({ heridaP: Math.min(0.5, 0.3 + 0.02 * (L - 1)), pociones: Math.min(0.4, 0.1 + 0.02 * (L - 1)) }),
    titanforge: L => ({ armyPower: 0.03 * L, rareza: Math.min(0.5, 0.15 + 0.03 * (L - 1)) }),
    faro: L => ({ sight: 22 + L, expSpeed: Math.min(0.3, 0.05 + 0.01 * L), cartBoost: 0.04 * L }),
  });
  Object.assign(D.STAT_LABELS, {
    missions: ['Encargos extra en el tablón', v => '+' + v], expSpeed: ['Velocidad de expediciones', pct],
    wishTime: ['Duración de cada deseo', v => U.fmtTime(v)], wishPower: ['Fuerza del deseo', pct],
    armyXp: ['Experiencia por hora (tropas en casa)', v => '+' + v], armyPower: ['Fuerza del ejército', pct],
    gatherP: ['Recolección', pct], craftP: ['Producción de talleres', pct], researchP: ['Investigación', pct], upgradeP: ['Velocidad de mejoras', pct],
    cartBoost: ['Velocidad y carga de carretas', pct], wolfWard: ['Radio sin lobos', v => v + ' casillas'],
    scan: ['Radio de búsqueda de mazmorras', v => v + ' casillas'], shrineProd: ['Producción de talleres', pct],
    xpBoost: ['Experiencia extra', pct], terrDef: ['Defensa de tus parcelas', pct],
    heridaP: ['Héroes heridos: menos descanso', pct], pociones: ['Caídos que salvan las pociones (incursiones)', pct], rareza: ['Mejora que sube de rareza', pct],
  });

  // ---------- Fase 3, segunda parte (pk-19): muelle, decoraciones y Maravillas 2.0 ----------
  // Van aquí (y no en datos-vida.js) porque el servidor descarta de la foto los tipos de edificio que no conoce.
  // Muelle (V9): una granja en el agua. Un pescador, rinde según el agua que lo rodea (G.aguaMuelle) y no crea nodos.
  // Decoraciones (V5): no suben de nivel; dan ánimo a las casas a menos de `r` casillas (vida.js). Las Maravillas
  // (V6) son 4 y se elige una: el grupo D.MARAVILLAS comparte el tope de 1 (G.maravilla). La «wonder» de 4×4 queda
  // para las partidas que ya la tenían, sin construirse más: en su panel se transforma gratis en una de las 4.
  Object.assign(D.BUILD, {
    muelle: { name: 'Muelle de pesca', w: 2, h: 2, cost: { wood: 140, stone: 30 }, time: 30, era: 2, walkable: true, upT: 0.6, max: e => 1 + e, desc: 'Va pegado al agua. Un pescador saca comida según cuánta agua lo rodea, sin agotar nada.' },
    farol: { name: 'Farol', w: 1, h: 1, cost: { wood: 40, stone: 20 }, time: 8, era: 1, deco: { animo: 1, r: 3 }, max: e => 4 + 2 * e, desc: 'Ilumina la calle: +1 de ánimo a las casas cercanas.' },
    banca: { name: 'Banca', w: 1, h: 1, cost: { wood: 30 }, time: 6, era: 1, deco: { animo: 1, r: 3 }, max: e => 3 + 2 * e, desc: 'Para sentarse a mirar el pueblo: +1 de ánimo cerca.' },
    pozo: { name: 'Pozo', w: 1, h: 1, cost: { stone: 80, wood: 20 }, time: 12, era: 1, deco: { animo: 2, r: 4 }, max: e => 1 + e, desc: 'Agua fresca para el barrio: +2 de ánimo cerca.' },
    frutal: { name: 'Árbol frutal', w: 1, h: 1, cost: { wood: 40, food: 40 }, time: 10, era: 1, deco: { animo: 1, r: 3, comida: 0.04 }, max: e => 2 + 2 * e, desc: 'Sombra y fruta: +1 de ánimo cerca y un poco de comida sin aldeanos.' },
    estandarte: { name: 'Estandarte del reino', w: 1, h: 1, cost: { wood: 60, gold: 80 }, time: 10, era: 2, deco: { animo: 2, r: 4 }, max: e => 1 + e, desc: 'Los colores del reino: +2 de ánimo cerca.' },
    hoguera: { name: 'Hoguera de fiesta', w: 1, h: 1, cost: { wood: 120 }, time: 10, era: 2, deco: { animo: 2, r: 4, fiesta: 4 }, max: e => 1 + Math.floor(e / 2), desc: '+2 de ánimo cerca, y +4 más mientras hay fiesta.' },
    fuente: { name: 'Fuente', w: 2, h: 2, cost: { stone: 200, gold: 60 }, time: 20, era: 2, deco: { animo: 2, r: 5 }, max: e => 1 + Math.floor(e / 2), desc: '+2 de ánimo cerca. Una casa a su lado vive con una persona más.' },
    jardin: { name: 'Jardín de flores', w: 2, h: 2, cost: { wood: 60, food: 60 }, time: 15, era: 2, walkable: true, flat: true, deco: { animo: 2, r: 4 }, max: e => 1 + e, desc: '+2 de ánimo cerca.' },
    plaza: { name: 'Plaza adoquinada', w: 2, h: 2, cost: { stone: 250 }, time: 20, era: 2, walkable: true, flat: true, deco: { animo: 1, r: 5 }, max: e => 1 + Math.floor(e / 2), desc: '+1 de ánimo cerca. Las casas a su lado viven con una persona más.' },
    estanque: { name: 'Estanque con peces', w: 2, h: 2, cost: { stone: 120, food: 40 }, time: 20, era: 2, deco: { animo: 2, r: 4 }, max: e => 1 + Math.floor(e / 3), desc: '+2 de ánimo cerca.' },
    estatua: { name: 'Estatua del fundador', w: 1, h: 1, cost: { stone: 300, gold: 150 }, time: 25, era: 3, deco: { animo: 3, r: 5 }, max: 2, desc: 'El primero de tu linaje, en piedra: +3 de ánimo cerca.' },
    glorieta: { name: 'Glorieta', w: 2, h: 2, cost: { wood: 200, planks: 40 }, time: 25, era: 3, deco: { animo: 2, r: 4 }, max: e => Math.floor(e / 2), desc: 'Música los domingos: +2 de ánimo cerca.' },
    escenario: { name: 'Escenario del juglar', w: 2, h: 2, cost: { wood: 300, gold: 200, planks: 60 }, time: 30, era: 3, deco: { animo: 3, r: 5 }, max: 1, desc: '+3 de ánimo cerca, y +3 más si un Juglar gobierna la Taberna o el Centro Urbano.' },
    columna: { name: 'Columna conmemorativa', w: 1, h: 1, cost: { stone: 400, marble: 50 }, time: 30, era: 3, deco: { animo: 3, r: 5 }, max: 3, logro: 'columna', desc: 'Recuerda a un jefe vencido: +3 de ánimo cerca. Pide un trofeo de jefe por cada una.' },
    arco: { name: 'Arco de triunfo', w: 2, h: 2, cost: { stone: 800, marble: 200, gold: 500 }, time: 60, era: 4, walkable: true, deco: { animo: 5, r: 6 }, max: 1, logro: 'arco', desc: 'Solo por logros (10 desafíos cumplidos): +5 de ánimo cerca.' },
    m_faro: { name: 'Gran Faro', w: 5, h: 5, cost: { blocks: 3000, marble: 1500, gems: 300, steel: 400, machinery: 150 }, time: 900, era: 6, max: 1, upT: 2.5, noCap: true, marav: true, desc: 'Comercio y visión: ve muy lejos, vende más caro en el Mercado. Cada nivel da prestigio, +3% a todo y monedas.' },
    m_coloso: { name: 'Coloso de Bronce', w: 5, h: 5, cost: { blocks: 3000, marble: 1500, gems: 300, steel: 400, machinery: 150 }, time: 900, era: 6, max: 1, upT: 2.5, noCap: true, marav: true, desc: 'Ejército: más fuerza contra monstruos y torres que pegan más fuerte a los bandidos. Cada nivel da prestigio, +3% a todo y monedas.' },
    m_jardines: { name: 'Jardines Eternos', w: 5, h: 5, cost: { blocks: 3000, marble: 1500, gems: 300, steel: 400, machinery: 150 }, time: 900, era: 6, max: 1, upT: 2.5, noCap: true, marav: true, desc: 'Recolección y ánimo. Cada nivel da prestigio, +3% a todo y monedas.' },
    m_catedral: { name: 'Gran Catedral', w: 5, h: 5, cost: { blocks: 3000, marble: 1500, gems: 300, steel: 400, machinery: 150 }, time: 900, era: 6, max: 1, upT: 2.5, noCap: true, marav: true, desc: 'Investigación y reliquias. Cada nivel da prestigio, +3% a todo y monedas.' },
  });
  D.DECOS = Object.keys(D.BUILD).filter(k => D.BUILD[k].deco);
  D.MARAVILLAS = ['m_faro', 'm_coloso', 'm_jardines', 'm_catedral'];
  D.WONDERS = ['wonder'].concat(D.MARAVILLAS); // todo lo que cuenta como «la Maravilla» (bono a todo, monedas, misión)
  for (const k of D.DECOS) Object.assign(D.BUILD[k], { noUp: true, sight: 3 });
  D.BUILD.wonder.retirada = true; // ya no se construye: se transforma (G.transformarMaravilla)
  D.BUILD_ORDER.splice(D.BUILD_ORDER.indexOf('wonder'), 1, ...D.MARAVILLAS);
  D.BUILD_ORDER.splice(D.BUILD_ORDER.indexOf('sawmill'), 0, 'muelle');
  D.BUILD_ORDER.push(...D.DECOS);
  for (const k of ['muelle'].concat(D.MARAVILLAS)) D.BUILD[k].sight = 5;
  D.BSTATS.muelle = L => ({ farm: 0.12 * (L - 1) });
  for (const k of D.MARAVILLAS) D.BSTATS[k] = D.BSTATS.wonder;

  // Mazmorras como puntos de interés del mapa (se ubican aparte, sin mover nada de lo que ya existía).
  Object.assign(D.POI, {
    cave: { name: D.DUNGEON.cave.name, w: 2, h: 2, dungeon: true, desc: D.DUNGEON.cave.desc },
    lair: { name: D.DUNGEON.lair.name, w: 2, h: 2, dungeon: true, desc: D.DUNGEON.lair.desc },
    crypt: { name: D.DUNGEON.crypt.name, w: 2, h: 2, dungeon: true, desc: D.DUNGEON.crypt.desc },
    crater: { name: D.DUNGEON.crater.name, w: 3, h: 3, dungeon: true, desc: D.DUNGEON.crater.desc },
    nest: { name: D.DUNGEON.nest.name, w: 3, h: 3, dungeon: true, desc: D.DUNGEON.nest.desc },
    swamp: { name: D.DUNGEON.swamp.name, w: 3, h: 3, dungeon: true, desc: D.DUNGEON.swamp.desc },
    giants: { name: D.DUNGEON.giants.name, w: 3, h: 3, dungeon: true, desc: D.DUNGEON.giants.desc },
    temple: { name: D.DUNGEON.temple.name, w: 3, h: 3, dungeon: true, desc: D.DUNGEON.temple.desc },
  });

  // ---------- Lugares legendarios (H6, pk-17) ----------
  // Maravillas naturales del mapa. Cada una está 3 veces en el mundo compartido (así todos tienen alguna cerca) y
  // se ubica en world.js. Se descubren explorando y se activan mandando a un héroe a investigarlas (leyendas.js):
  // un bono pequeño para siempre (no se suma dos veces la misma), una página de historia y una casilla en el Álbum.
  D.POI.legend = { name: 'Lugar legendario', w: 2, h: 2, desc: 'Una maravilla del mundo. Manda a un héroe a investigarla.' };
  D.LEYENDAS = [
    { id: 'cascada', name: 'Cascada del Alba', bono: '+5% de comida', agua: true, historia: 'Dicen que el primer rey se bañó aquí antes de la coronación, y que desde entonces el agua sale tibia al amanecer. Los campesinos riegan con ella y juran que el trigo crece más rápido.' },
    { id: 'arbol', name: 'Árbol Madre', bono: '+5% de madera; los árboles rebrotan un 10% antes', historia: 'Un tronco que no abrazan diez hombres. Los leñadores le dejan pan en las raíces antes de entrar al bosque, y el bosque, agradecido, vuelve a crecer.' },
    { id: 'circulo', name: 'Círculo de Piedras', bono: '+5% de investigación', historia: 'Doce piedras en ronda, más viejas que cualquier reino. En la noche más larga del año, la sombra de la del centro apunta a una estrella que nadie ha sabido nombrar.' },
    { id: 'dragones', name: 'Cementerio de Dragones', bono: '+10% de fuerza contra dragones', historia: 'Costillas como arcos de catedral. Aquí vinieron a morir los dragones viejos, y aquí aprendieron los cazadores dónde no tienen escamas.' },
    { id: 'faro', name: 'Faro Abandonado', bono: '+3 de visión de tus torres', agua: true, historia: 'Nadie recuerda qué barcos guiaba. La lámpara está rota, pero desde arriba se ve hasta donde termina el lago, y a veces más allá.' },
    { id: 'mina', name: 'Mina de los Enanos', bono: '+5% de minería', historia: 'Túneles bajitos y perfectos, con escaleras talladas para pies chicos. Los enanos se fueron, pero dejaron marcas en la roca que muestran dónde está la veta.' },
    { id: 'estatua', name: 'Estatua del Rey Olvidado', bono: '+5% de oro', historia: 'Un rey de piedra con la cara gastada por la lluvia. Su nombre está borrado; su tesoro, no del todo. El pueblo dice que trae suerte a los comerciantes.' },
    { id: 'pozo', name: 'Pozo de los Deseos Antiguo', bono: 'un deseo extra cada 3 días (Fuente de los Deseos)', historia: 'Más hondo que cualquier cuerda. Si tiras una moneda no se oye el fondo, pero a veces, días después, se oye una risa.' },
    { id: 'campo', name: 'Campo de Batalla Antiguo', bono: '+10% de experiencia de tus tropas', historia: 'Puntas de flecha oxidadas, cascos sin dueño. Los veteranos traen a los reclutas aquí para que entiendan, en silencio, lo que es una batalla.' },
    { id: 'biblioteca', name: 'Biblioteca Hundida', bono: '+10 libros por día', historia: 'Un edificio tragado por la tierra hasta el segundo piso. Los libros de arriba se secaron; los de abajo cuentan historias que el agua todavía no termina de borrar.' },
    { id: 'colmena', name: 'Colmena Gigante', bono: 'las fiestas del pueblo cuestan un 20% menos', historia: 'Abejas del tamaño de un pulgar y miel que no se acaba. Con ella se endulza cualquier fiesta: el pueblo ya no necesita vaciar las bodegas para celebrar.' },
    { id: 'puerta', name: 'Puerta de las Estrellas', bono: 'las mazmorras se reponen un 15% antes', historia: 'Un arco de piedra negra en medio de la nada. De noche, entre sus columnas se ven estrellas que no están en el cielo.' },
  ];

  // ---------- Campaña: «La Crónica del Reino» (H5, pk-17; guion en el Anexo A4 del plan) ----------
  // Un capítulo por era, de la II a la XI. Cada uno: una escena al empezar (D.ESCENAS, con retratos dibujados como
  // los de los héroes), sus misiones en la rama Crónica, un lugar único en el mapa con una batalla y su jefe, y
  // una elección al ganarla que cambia el premio. La lógica está en campana.js.
  D.PERSONAJES = {
    forastero: { name: 'El Forastero de la Capa', clase: 'hechicero', semilla: 4242 },
    valdes: { name: 'Tuerto Valdés', clase: 'guarda', semilla: 66 },
    rey: { name: 'El Rey Bandido', clase: 'juglar', semilla: 1313 },
    brunilda: { name: 'La reina Brunilda', clase: 'paladin', semilla: 777, mujer: true },
    ceniza: { name: 'Hermana Ceniza, de la Orden del Cráter', clase: 'ingeniera', semilla: 909, mujer: true },
    capitana: { name: 'La capitana del Galeón', clase: 'guarda', semilla: 5150, mujer: true },
  };
  D.ESCENAS = {
    c1a: { quien: 'forastero', lineas: ['Buenas noches, señor del pueblo. Vengo del norte y traigo malas noticias.', 'Algo se mueve más allá de las montañas: los bandidos se juntan y las bestias bajan de los cerros.', 'Si quieres resistir, vas a necesitar héroes. Y una taberna donde encontrarlos.'] },
    c1b: { quien: 'valdes', lineas: ['Está bien, está bien… me rindo. Pero no fui yo quien juntó a las bandas.', 'Hay un tipo que se hace llamar Rey. Tiene una fortaleza al otro lado del bosque.'] },
    c2a: { quien: 'forastero', lineas: ['El Rey Bandido unió a los campamentos bajo una sola bandera.', 'Toma tres de sus campamentos y su fortaleza quedará sola. Entonces será tu turno.'] },
    c2b: { quien: 'rey', lineas: ['Bien peleado. Nadie había llegado hasta mi trono.', 'Ahora decide: ¿una canción para tu corte, o mi cabeza y todo mi oro?'] },
    c3a: { quien: 'brunilda', lineas: ['Soy Brunilda, reina de las tierras del este. Tu frontera pisa la mía.', 'Puedo ser tu aliada o tu peor vecina. Elige bien cómo me respondes.'] },
    c3b: { quien: 'brunilda', lineas: ['Que así sea. Las crónicas de los dos reinos recordarán este día.'] },
    c4a: { quien: 'ceniza', lineas: ['El hierro que cayó del cielo es sagrado. La Orden lo cuida desde hace siglos.', 'No te metas en el Cráter… o el Heraldo te enseñará por qué.'] },
    c4b: { quien: 'forastero', lineas: ['El Heraldo cayó. La Orden no te lo va a perdonar fácilmente.', 'Pero ahora sabemos qué buscaban: estrellas. Y algo que duerme en el Nido.'] },
    c5a: { quien: 'forastero', lineas: ['Un reino de verdad deja algo que dure más que sus reyes.', 'Levanta una Maravilla. Y vigila: la Orden no quiere que la termines.'] },
    c5b: { quien: 'ceniza', lineas: ['Tu Maravilla sigue en pie. Quizás nos equivocamos contigo.'] },
    c6a: { quien: 'forastero', lineas: ['¿Sentiste el temblor? Las montañas se están despertando.', 'Busca el Cementerio de Dragones: ahí aprendieron los antiguos dónde golpear.', 'Y otra cosa… en la orilla del lago grande encalló un barco que nadie ha visto antes.'] },
    c6b: { quien: 'capitana', lineas: ['Este es el Galeón del Alba. Venimos de las islas más allá de la bruma.', 'El casco está roto. Si nos ayudas a repararlo, algún día te llevaremos allá.'] },
    c7a: { quien: 'capitana', lineas: ['El timón del Galeón se hundió con el templo del lago.', 'Allá abajo canta algo. No escuches la canción.'] },
    c7b: { quien: 'capitana', lineas: ['¡El timón! Con esto, el Galeón vuelve a tener rumbo.'] },
    c8a: { quien: 'brunilda', lineas: ['Ignivor despertó. Ningún reino puede contra él a solas.', 'Junta aliados: tratos, regalos, promesas. Los vamos a necesitar a todos.'] },
    c8b: { quien: 'capitana', lineas: ['Tus aliados mandaron velas nuevas para el Galeón. Ya casi está listo.'] },
    c9a: { quien: 'forastero', lineas: ['Ha llegado la hora. Ignivor el Antiguo espera en su cumbre.', 'Lleva a todos tus héroes. Y si cae, guarda una de sus escamas: la vamos a necesitar.'] },
    c9b: { quien: 'forastero', lineas: ['Con su escama se forja una brújula que atraviesa la bruma.', 'Tu reino ya no tiene miedo. Solo le falta una corona.'] },
    c10a: { quien: 'forastero', lineas: ['Todos los caminos del reino llevan hoy a tu Centro Urbano.', 'Cuando termines lo que empezaste, el pueblo te va a coronar.'] },
    c10b: { quien: 'capitana', lineas: ['¡Larga vida a la Leyenda del Reino!', 'El Galeón del Alba está listo. Cuando quieras, zarpamos hacia las islas.'] },
  };
  // lugar: el sitio único del capítulo (aparece cerca de tu reino al empezar el capítulo). k: fuerza relativa a la
  // de la era (D.capPower). jefe: tabla JEFE de batalla.js. eleccion: al ganar; antes: se elige al aparecer el lugar
  // (el capítulo III se puede cerrar pagando, sin pelear).
  D.capPower = (era, k) => Math.round(90 * Math.pow(1.85, era - 2) * (k || 1));
  D.CAPITULOS = [
    { era: 2, titulo: 'El forastero de la capa', ini: 'c1a', fin: 'c1b', lugar: { name: 'Guarida de Tuerto Valdés', enemy: { bandit: 1 }, k: 1, jefe: 'valdes', terreno: 'camp' }, premio: { gold: 300, coins: 15 },
      eleccion: { txt: 'La banda de Valdés se rindió.', ops: [{ label: 'Reclutarlos', txt: '+10 milicianos', militia: 10 }, { label: 'Repartir su botín', txt: 'oro para el pueblo', res: { gold: 400, food: 300 } }] } },
    { era: 3, titulo: 'El Rey Bandido', ini: 'c2a', fin: 'c2b', lugar: { name: 'Fortaleza Bandida', enemy: { bandit: 1 }, k: 1.2, jefe: 'reybandido', terreno: 'camp' }, premio: { gold: 800, coins: 25 },
      eleccion: { txt: 'El Rey Bandido está de rodillas.', ops: [{ label: 'Perdonarlo', txt: 'se une como héroe Juglar', heroe: 'rey' }, { label: 'Quedarte con su tesoro', txt: 'oro y gemas', res: { gold: 2500, gems: 30 } }] } },
    { era: 4, titulo: 'La reina Brunilda', ini: 'c3a', fin: 'c3b', lugar: { name: 'Campamento de Brunilda', enemy: { bandit: 0.6, golem: 0.4 }, k: 1.2, jefe: 'brunilda', terreno: 'campo' }, premio: { gold: 1500, coins: 30 },
      antes: { txt: 'Brunilda acampa en tu frontera. ¿Tratado o batalla?', ops: [{ label: 'Firmar un tratado', txt: 'pagas tributo y quedan en paz para siempre', costo: { gold: 3000, gems: 40 }, cierra: true, rel: 'paz' }, { label: 'Defender la frontera', txt: 'una batalla contra su guardia', rel: 'guerra' }] } },
    { era: 5, titulo: 'La estrella caída', ini: 'c4a', fin: 'c4b', lugar: { name: 'Santuario de la Orden', enemy: { golem: 0.6, bandit: 0.4 }, k: 1.2, jefe: 'crater', terreno: 'crater' }, premio: { starIron: 20, coins: 35 },
      eleccion: { txt: 'El hierro estelar del santuario es tuyo.', ops: [{ label: 'Devolverlo a la Orden', txt: 'te enseñan su saber', res: { lore: 25, books: 300 } }, { label: 'Quedártelo', txt: 'más hierro estelar', res: { starIron: 30 } }] } },
    { era: 6, titulo: 'La Maravilla', ini: 'c5a', fin: 'c5b', lugar: { name: 'Taller de los saboteadores', enemy: { bandit: 0.5, arcane: 0.5 }, k: 1.2, jefe: 'swamp', terreno: 'campo' }, premio: { gold: 6000, coins: 40 },
      eleccion: { txt: 'Atrapaste a los saboteadores de la Orden.', ops: [{ label: 'Darles trabajo', txt: 'ayudan en tu Maravilla: +3% de producción para siempre', perk: { craftP: 0.03 } }, { label: 'Expulsarlos', txt: 'confiscas sus herramientas', res: { tools: 400, machinery: 60 } }] } },
    { era: 7, titulo: 'El despertar', ini: 'c6a', fin: 'c6b', lugar: { name: 'Paso de las Cenizas', enemy: { dragon: 1 }, k: 1.1, jefe: 'cria', terreno: 'nest' }, premio: { scale: 20, coins: 45 }, galeon: 'casco',
      eleccion: { txt: 'La cría de dragón está vencida.', ops: [{ label: 'Dejarla ir', txt: '+3% de fuerza del ejército para siempre', perk: { armyPower: 0.03 } }, { label: 'Llevarte sus escamas', txt: 'escamas de dragón', res: { scale: 40 } }] } },
    { era: 8, titulo: 'Las aguas oscuras', ini: 'c7a', fin: 'c7b', lugar: { name: 'Santuario del Timón', enemy: { abyss: 0.8, undead: 0.2 }, k: 1.1, jefe: 'temple', terreno: 'temple' }, premio: { pearls: 20, coins: 50 }, galeon: 'timon',
      eleccion: { txt: 'Bajo el timón brillan perlas.', ops: [{ label: 'Para el Galeón', txt: 'adornan su mascarón: +5% de velocidad de expediciones', perk: { expSpeed: 0.05 } }, { label: 'Para tus bodegas', txt: 'perlas abisales y gemas', res: { pearls: 30, gems: 80 } }] } },
    { era: 9, titulo: 'La alianza', ini: 'c8a', fin: 'c8b', lugar: { name: 'Bastión de la Orden', enemy: { arcane: 0.5, giant: 0.5 }, k: 1.2, jefe: 'giants', terreno: 'giants' }, premio: { gold: 40000, coins: 55 }, galeon: 'velas',
      eleccion: { txt: 'Tus aliados esperan un gesto.', ops: [{ label: 'Un banquete', txt: '+3% de recolección para siempre', perk: { gatherP: 0.03 } }, { label: 'Un tratado de armas', txt: 'acero y maquinaria', res: { steel: 1500, machinery: 300 } }] } },
    { era: 10, titulo: 'Ignivor', ini: 'c9a', fin: 'c9b', lugar: { name: 'La Cumbre de Ignivor', enemy: { dragon: 1 }, k: 1.15, jefe: 'nest', terreno: 'nest' }, premio: { scale: 60, coins: 80 }, galeon: 'brujula',
      eleccion: { txt: 'Ignivor cayó. Su tesoro brilla en la cumbre.', ops: [{ label: 'Forjar la brújula', txt: '+5% de fuerza del ejército para siempre', perk: { armyPower: 0.05 } }, { label: 'El tesoro del dragón', txt: 'oro y escamas', res: { gold: 120000, scale: 60 } }] } },
    { era: 11, titulo: 'La leyenda', ini: 'c10a', fin: 'c10b', lugar: null, premio: { gems: 500, coins: 150 } },
  ];

  // ---------- Libro de misiones ----------
  D.BRANCHES = [
    { id: 'main', name: 'Crónica', icon: 'book', desc: 'La historia de tu reino: haz crecer tu pueblo y avanza de era.' },
    { id: 'build', name: 'Obras', icon: 'hammer', desc: 'Mejora tus edificios uno por uno y reúne una cuadrilla de maestros de obras.' },
    { id: 'explore', name: 'Exploración', icon: 'compass', desc: 'Descubre el mapa: tesoros, ruinas, reliquias, bandidos y otros reinos.' },
    { id: 'eco', name: 'Economía', icon: 'food', desc: 'Recolección y aprovechamiento de las zonas comunes.' },
    { id: 'ind', name: 'Industria', icon: 'tools', desc: 'Cadenas de producción: de la materia prima a la maquinaria.' },
    { id: 'trade', name: 'Comercio', icon: 'market', desc: 'Mercado y tratos con otros reinos.' },
    { id: 'guild', name: 'Gremio', icon: 'guild', desc: 'Obras colectivas con otros jugadores.' },
    { id: 'war', name: 'Guerra', icon: 'war', desc: 'Ejército, murallas, conquista y expediciones.' },
    { id: 'legend', name: 'Leyendas', icon: 'crystal', desc: 'Encargos secundarios: cada cadena desbloquea una estructura única, divertida y útil.' },
  ];

  const Q = (D.QUESTS = []);
  const q = (id, branch, title, desc, req, reward, pre) => Q.push({ id, branch, title, desc, req, reward, pre: pre || [] });
  const all = (...of) => ({ t: 'all', of });
  const B = (b, n) => ({ t: 'build', b, n: n || 1 });
  const LV = (b, lvl, n) => ({ t: 'level', b, lvl, n: n || 1 });
  const LA = (lvl, n) => ({ t: 'level', lvl, n });
  const st = (k, n) => ({ t: 'stat', k, n });
  let prev;

  // V7: escaleras de hasta 4 rangos visibles (antes llegaban a 10 peldaños casi iguales). Los ids no cambian: los
  // peldaños intermedios salen de la lista, pero lo que daban (recursos y mejora permanente) se paga al reclamar el
  // rango visible que los absorbe, salvo que esa partida ya los hubiera reclamado (quests.js, Q.claim). Así ninguna
  // partida guardada pierde ni cobra dos veces. Cada rango da su título; el II y el IV, un cosmético (D.ESCALERAS).
  D.ESCALERAS = {};
  const visibles = L => (L <= 4 ? [...Array(L).keys()] : [0, 1, 2, 3].map(j => Math.round((j * (L - 1)) / 3)));
  function escalera(pref, branch, nombre, ns, desc, req, premio, inicio) {
    const vis = visibles(ns.length);
    let pre = inicio, absorbe = [];
    D.ESCALERAS[pref] = { nombre, ids: [] };
    ns.forEach((n, i) => {
      const id = pref + i;
      if (!vis.includes(i)) { absorbe.push({ id, reward: premio(n, i) }); return; }
      const k = vis.indexOf(i);
      q(id, branch, nombre + ' ' + U.roman(k + 1), desc(n), req(n), premio(n, i), [pre]);
      const qq = Q[Q.length - 1];
      qq.rango = { esc: pref, k, de: vis.length };
      if (absorbe.length) qq.absorbe = absorbe;
      absorbe = [];
      pre = id;
      D.ESCALERAS[pref].ids.push(id);
    });
    return pre;
  }

  // Crónica (rama principal, hace de tutorial)
  q('m1', 'main', 'El primer fuego', 'Entrena aldeanos en el Centro Urbano hasta tener 5. Selecciona el Centro Urbano y pulsa "Aldeano".', { t: 'villagers', n: 5 }, { food: 100 });
  q('m2', 'main', 'Techo para todos', 'Construye 2 casas: pulsa Construir (tecla C), elige Casa y ubícala. Se levantan solas, sin aldeanos.', B('house', 2), { wood: 80 }, ['m1']);
  q('m3', 'main', 'Mejorar es crecer', 'Mejora el Centro Urbano a nivel 2. Selecciónalo y pulsa "Mejorar": lo hace tu Maestro de Obras.', LV('tc', 2), { stone: 80, gold: 40 }, ['m2']);
  q('m4', 'main', 'Ojos en la niebla', 'Construye un Puesto de Exploradores y entrena un explorador. Él solo irá revelando el mapa.', all(B('scout'), st('scouts_trained', 1)), { food: 150, coins: 5 }, ['m3']);
  q('m5', 'main', 'Puntos de acopio', 'Construye un Campamento Maderero y uno Minero cerca de los recursos para acortar los viajes.', all(B('lumber'), B('mining')), { wood: 150 }, ['m4']);
  q('m6', 'main', 'Pan de cada día', 'Construye un Molino y 2 Granjas.', all(B('mill'), B('farm', 2)), { food: 200 }, ['m5']);
  q('m7', 'main', 'Una aldea que crece', 'Alcanza 12 aldeanos.', { t: 'villagers', n: 12 }, { food: 200, wood: 150 }, ['m6']);
  q('m8', 'main', 'Hacia la Aldea', 'Avanza a la Era II desde el Centro Urbano.', { t: 'era', n: 2 }, { gold: 150, coins: 20 }, ['m7']);
  const pops = [0, 0, 0, 20, 30, 45, 60, 80, 100, 130, 160, 200, 240, 280];
  prev = 'm8';
  for (let e = 3; e <= 13; e++) {
    const p = pops[e] || 40 * e;
    q('mp' + e, 'main', 'Población de ' + p, 'Alcanza ' + p + ' aldeanos.', { t: 'villagers', n: p }, { food: Math.round(150 * Math.pow(2, e - 2)), coins: 5 * e }, [prev]);
    q('me' + e, 'main', 'Hacia ' + D.eraName(e), 'Avanza a la Era ' + U.roman(e) + ': ' + D.eraName(e) + '.', { t: 'era', n: e }, { gold: Math.round(200 * Math.pow(2.4, e - 2)), coins: 20 * e }, ['mp' + e]);
    prev = 'me' + e;
  }

  // Obras
  q('b1', 'build', 'Primera mejora', 'Mejora cualquier edificio una vez.', st('upgrades', 1), { wood: 100 });
  q('b2', 'build', 'Casas mejores', 'Sube una Casa a nivel 3: más población sin ocupar más terreno.', LV('house', 3), { wood: 150 }, ['b1']);
  q('b3', 'build', 'Un segundo maestro', 'Construye una Casa del Maestro de Obras: podrás mejorar dos edificios a la vez.', B('builder'), { gold: 100, coins: 5 }, ['b1']);
  q('b4', 'build', 'Bodegas', 'Construye un Granero y un Almacén para guardar más recursos.', all(B('granary'), B('warehouse')), { stone: 150 }, ['b1']);
  q('b5', 'build', 'Pueblo sólido', 'Ten 5 edificios en nivel 3 o más.', LA(3, 5), { gold: 150, coins: 10 }, ['b2', 'b4']);
  q('b6', 'build', 'Cuadrilla', 'Ten 3 Casas del Maestro de Obras (4 maestros).', B('builder', 3), { coins: 15 }, ['b3']);
  q('b7', 'build', 'Obra maestra', 'Sube cualquier edificio a nivel 7.', LA(7, 1), { coins: 20, tools: 30 }, ['b5']);
  q('b9', 'build', 'El primer consejero', 'Construye un Salón del Consejo (Era II): su Mayordomo investiga en cola y reclama tus misiones.', B('consejo'), { gold: 200, books: 10, coins: 10 }, ['b3']);
  q('b10', 'build', 'Un consejo completo', 'Sube el Salón del Consejo a nivel 9: con el Gobernador, los seis consejeros trabajan para ti.', LV('consejo', 9), { coins: 40, gems: 30 }, ['b9']);
  q('b8', 'build', 'Cuadrilla completa', 'Ten las 4 Casas del Maestro de Obras (5 maestros).', B('builder', 4), { coins: 30 }, ['b6']);
  escalera('bt', 'build', 'Constructor Incansable', [10, 30, 75, 180, 400, 900, 2000, 4500], n => 'Completa ' + U.fmt(n) + ' mejoras de edificios.', n => st('upgrades', n), (n, i) => ({ coins: 10 * (i + 1), stone: Math.round(400 * Math.pow(2.2, i)) }), 'b7');
  escalera('bl', 'build', 'Altura', [9, 11, 13, 15, 18, 21, 25], n => 'Sube un edificio a nivel ' + n + '.', n => LA(n, 1), (n, i) => ({ coins: 15 * (i + 1), gold: Math.round(500 * Math.pow(2.3, i)) }), 'b7');

  // Exploración
  q('x1', 'explore', 'Más allá del humo', 'Revela 900 casillas del mapa con tu explorador.', { t: 'explored', n: 900 }, { food: 150, gold: 50 });
  q('x2', 'explore', 'Tesoro perdido', 'Encuentra un cofre abandonado.', st('chests', 1), { wood: 150 }, ['x1']);
  q('x3', 'explore', 'Ojos de piedra', 'Encuentra una atalaya en ruinas: desde ella se ve muy lejos.', st('watch_found', 1), { stone: 150 }, ['x1']);
  q('x4', 'explore', 'Piedras que hablan', 'Excava unas ruinas antiguas con tus aldeanos.', st('ruins_done', 1), { gold: 200, coins: 10 }, ['x2']);
  q('x5', 'explore', 'Vecinos', 'Descubre el pueblo de otro reino.', st('realms_seen', 1), { gold: 100 }, ['x3']);
  q('x6', 'explore', 'Limpiar el camino', 'Derrota un campamento de bandidos con tus tropas.', st('camps_cleared', 1), { coins: 15, gold: 200 }, ['x5']);
  q('x7', 'explore', 'Reliquia sagrada', 'Lleva una reliquia a tu Monasterio.', st('relics', 1), { coins: 20 }, ['x4']);
  q('x8', 'explore', 'Cartógrafo', 'Revela 4.000 casillas del mapa.', { t: 'explored', n: 4000 }, { coins: 20, books: 20 }, ['x6', 'x7']);
  escalera('xt', 'explore', 'Atlas', [6000, 8000, 10000, 12000, 14000, 16000], n => 'Revela ' + U.fmt(n) + ' casillas del mapa.', n => ({ t: 'explored', n }), (n, i) => ({ coins: 15 * (i + 1), gems: 10 * (i + 1) }), 'x8');
  escalera('xc', 'explore', 'Azote de Bandidos', [3, 6, 10, 16, 24], n => 'Derrota ' + n + ' campamentos de bandidos.', n => st('camps_cleared', n), (n, i) => ({ coins: 20 * (i + 1), gold: Math.round(400 * Math.pow(2, i)) }), 'x6');
  escalera('xr', 'explore', 'Custodio', [3, 5, 8], n => 'Guarda ' + n + ' reliquias en tu Monasterio.', n => st('relics', n), (n, i) => ({ coins: 25 * (i + 1) }), 'x7');

  // Economía
  q('e1', 'eco', 'Leñadores', 'Recolecta 300 de madera.', st('g_wood', 300), { food: 60 });
  q('e2', 'eco', 'Recolectores', 'Recolecta 300 de comida.', st('g_food', 300), { wood: 60 });
  q('e3', 'eco', 'Al bosque común', 'Recolecta 300 de madera en un bosque común (una zona compartida con tus vecinos; primero tienes que descubrirla).', st('z_tree', 300), { wood: 150, coins: 5 }, ['e1']);
  q('e4', 'eco', 'Fiebre del oro', 'Recolecta 200 de oro.', st('g_gold', 200), { food: 150 }, ['e1']);
  q('e5', 'eco', 'Picapedreros', 'Recolecta 300 de piedra.', st('g_stone', 300), { wood: 150 }, ['e1']);
  q('e6', 'eco', 'Cazadores', 'Caza 300 de comida (los ciervos rinden mucho, pero tardan en volver).', st('hunt', 300), { wood: 150 }, ['e2']);
  q('e7', 'eco', 'Campos dorados', 'Ten 6 granjas.', B('farm', 6), { wood: 200 }, ['e2']);
  q('e8', 'eco', 'Hierro en las venas', 'Recolecta 300 de hierro bruto (la Veta Roja es una zona común).', st('g_ore', 300), { gold: 100 }, ['e4', 'e5']);
  q('e9', 'eco', 'Mármol blanco', 'Recolecta 200 de mármol.', st('g_marble', 200), { gold: 200, coins: 10 }, ['e8']);
  q('e10', 'eco', 'Brillo en la roca', 'Recolecta 50 gemas.', st('g_gems', 50), { coins: 15 }, ['e9']);
  q('e12', 'eco', 'Fiesta en el pueblo', 'Desde la Era II, el Centro Urbano organiza fiestas: gasta lo que te sobra y tu gente recolecta y produce un 25% más durante 5 minutos.', st('fiestas', 1), { coins: 5, gold: 100 }, ['e3']);
  q('e11', 'eco', 'Bien común', 'Recolecta 2.000 recursos en zonas comunes.', st('g_common', 2000), { coins: 10, food: 300 }, ['e3']);
  escalera('et', 'eco', 'Gran Recolector', [5e3, 25e3, 1e5, 5e5, 2e6, 1e7, 5e7, 2.5e8, 1e9, 5e9], n => 'Recolecta ' + U.fmt(n) + ' recursos en total.', n => st('g_total', n), (n, i) => ({ coins: 10 * (i + 1), gold: Math.round(n * 0.03) }), 'e8');

  // Industria
  q('i1', 'ind', 'La sierra canta', 'Construye un Aserradero (Era II) a 3 casillas o menos de un Almacén o del Centro Urbano: así se abastece solo. Después asígnale aldeanos (Aldeanos → Talleres). Sus tablones piden la Cantería, la Fundición y la investigación.', B('sawmill'), { wood: 200 });
  q('i1c', 'ind', 'Ruedas en el camino', 'Construye una Carretería (Era II) y arma una carreta. Las carretas llevan madera a los talleres alejados y sacan lo que producen, por ejemplo tablones de un Aserradero a otro taller. Con caminos van más rápido.', all(B('cartwright'), st('carts', 1)), { wood: 250, gold: 100 }, ['i1']);
  q('i2', 'ind', 'Tablón a tablón', 'Produce 100 tablones.', st('p_planks', 100), { gold: 100 }, ['i1']);
  q('i3', 'ind', 'Fuego y metal', 'Construye una Fundición (Era III).', B('smelter'), { ore: 200, coins: 10 }, ['i2']);
  q('i4', 'ind', 'Lingotes', 'Produce 50 lingotes de hierro.', st('p_ingots', 50), { gold: 300 }, ['i3']);
  q('i5', 'ind', 'Sillares', 'Construye una Cantería y produce 50 sillares.', all(B('masonry'), st('p_blocks', 50)), { stone: 400 }, ['i2']);
  q('i6', 'ind', 'Manos expertas', 'Construye una Herrería y produce 25 herramientas.', all(B('forge'), st('p_tools', 25)), { gold: 500, coins: 15 }, ['i4']);
  q('i7', 'ind', 'Tinta y pergamino', 'Construye un Taller de Copistas y produce 20 libros.', all(B('scriptorium'), st('p_books', 20)), { gold: 400, coins: 10 }, ['i2']);
  q('i8', 'ind', 'Acero templado', 'Construye una Acería (Era IV) y produce 30 de acero.', all(B('steelworks'), st('p_steel', 30)), { coins: 20, ingots: 100 }, ['i6']);
  q('i9', 'ind', 'Engranajes', 'Construye un Taller de Ingeniería (Era V) y produce 10 de maquinaria.', all(B('workshop'), st('p_machinery', 10)), { coins: 30, steel: 50 }, ['i8']);
  q('i10', 'ind', 'Talleres de primera', 'Ten 3 edificios de producción en nivel 5 o más.', { t: 'level', lvl: 5, n: 3, recipe: true }, { coins: 20, tools: 50 }, ['i6']);
  escalera('it', 'ind', 'Maestro Artesano', [1e3, 1e4, 1e5, 1e6, 1e7, 1e8], n => 'Produce ' + U.fmt(n) + ' bienes elaborados.', n => st('p_total', n), (n, i) => ({ coins: 15 * (i + 1), tools: Math.round(n * 0.02) }), 'i9');

  // Comercio
  q('t1', 'trade', 'Plaza de mercado', 'Construye un Mercado (Era II).', B('market'), { gold: 100 });
  q('t2', 'trade', 'Primer trato', 'Compra o vende en el mercado.', st('market_ops', 1), { gold: 50 }, ['t1']);
  q('t3', 'trade', 'Palabra de comerciante', 'Acepta 3 ofertas del tablón de otros reinos.', st('trades_accepted', 3), { gold: 200, coins: 10 }, ['t2']);
  q('t4', 'trade', 'Tu propia oferta', 'Publica una oferta en el tablón y espera a que otro reino la acepte.', st('offers_filled', 1), { gold: 150 }, ['t2']);
  q('t5', 'trade', 'Regateo', 'Sube el Mercado a nivel 4: mejores precios.', LV('market', 4), { gold: 300 }, ['t2']);
  q('t6', 'trade', 'Mercader', 'Mueve 5.000 de oro en el comercio.', st('gold_volume', 5000), { coins: 15 }, ['t3', 't4']);
  escalera('tt', 'trade', 'Magnate', [25e3, 1e5, 5e5, 2e6, 1e7, 5e7], n => 'Mueve ' + U.fmt(n) + ' de oro en el comercio.', n => st('gold_volume', n), (n, i) => ({ coins: 15 * (i + 1), gold: Math.round(n * 0.05) }), 't6');

  // Gremio
  q('g1', 'guild', 'Salón del Gremio', 'Construye el Salón del Gremio (Era II).', B('guild'), { stone: 150 });
  q('g2', 'guild', 'Juramento', 'Únete a un gremio.', { t: 'flag', k: 'guildJoined' }, { gold: 100, coins: 10 }, ['g1']);
  q('g3', 'guild', 'Primer aporte', 'Aporta 500 recursos al proyecto del gremio.', st('contrib', 500), { food: 300 }, ['g2']);
  q('g4', 'guild', 'Obra común', 'Completa una etapa del proyecto del gremio junto a tus compañeros.', st('guild_stages', 1), { coins: 25 }, ['g3']);
  escalera('gt', 'guild', 'Pilar del Gremio', [5e3, 25e3, 1e5, 5e5, 2e6, 1e7], n => 'Aporta ' + U.fmt(n) + ' recursos al gremio.', n => st('contrib', n), (n, i) => ({ coins: 20 * (i + 1) }), 'g4');

  // Guerra
  q('w1', 'war', 'A las armas', 'Construye un Cuartel (Era II). Ojo: termina tu tregua de novato.', B('barracks'), { food: 150 });
  q('w2', 'war', 'Milicia', 'Entrena 5 unidades militares.', st('trained_army', 5), { gold: 100 }, ['w1']);
  q('w3', 'war', 'Vigías', 'Ten 2 Torres de Vigía.', B('tower', 2), { stone: 200 }, ['w1']);
  q('w4', 'war', 'Conquistador', 'Conquista una parcela de otro reino (Era III, menú Territorio).', st('conquests', 1), { coins: 15 }, ['w2']);
  q('w5', 'war', 'Muralla viviente', 'Defiéndete con éxito de un ataque.', st('defenses_won', 1), { coins: 15, stone: 300 }, ['w3']);
  q('w6', 'war', 'Torres altas', 'Sube una Torre de Vigía a nivel 5.', LV('tower', 5), { coins: 15, stone: 500 }, ['w3']);
  q('w7', 'war', 'Primera empalizada', 'Levanta 20 casillas de muralla (Cuartel → Defensa).', st('walls_built', 20), { wood: 300 });
  q('w8', 'war', 'Recinto cerrado', 'Encierra 4 parcelas con murallas, edificios o agua. Deja una puerta para tu gente.', { t: 'walled', n: 4 }, { coins: 15, stone: 400 }, ['w7']);
  q('w9', 'war', 'Muros de piedra', 'Mejora tus murallas a Muro de piedra.', { t: 'wallTier', n: 2 }, { coins: 10, gold: 300 }, ['w8']);
  q('w11', 'war', 'Guardia del pueblo', 'Rechaza una incursión de bandidos. Desde la Era II llegan cada tanto: el cuerno avisa, y tus Torres, tu Centro Urbano y las tropas del Cuartel los frenan.', st('raids_won', 1), { gold: 200, coins: 10 });
  q('w12', 'war', 'Azote de forajidos', 'Rechaza 5 incursiones de bandidos.', st('raids_won', 5), { coins: 20, gold: 600 }, ['w11']);
  q('w10', 'war', 'A la aventura', 'Gana una expedición en una mazmorra o un encargo del tablón.', st('exp_won', 1), { gold: 200, coins: 10 }, ['w2']);
  escalera('wt', 'war', 'Señor de la Guerra', [5, 15, 40, 100, 250, 600], n => 'Gana ' + n + ' expediciones o encargos.', n => st('exp_won', n), (n, i) => ({ coins: 20 * (i + 1), gold: 300 * Math.pow(2, i) }), 'w10');

  // Campaña «La Crónica del Reino» (H5): un capítulo por era. { t: 'cap', n }: el capítulo n está cerrado (campana.js).
  const CAPQ = [
    [['c1_1', 'Una taberna para el viajero', 'El Forastero de la Capa necesita un lugar donde contar su historia. Construye la Taberna.', B('tavern')], ['c1_2', 'Primer héroe', 'Recluta a un héroe en la Taberna.', st('heroes_hired', 1)]],
    [['c2_1', 'Rompe sus alianzas', 'Destruye 3 campamentos de bandidos.', st('camps_cleared', 3)]],
    [['c3_1', 'Muros para la frontera', 'Brunilda mira tus murallas: levanta 20 tramos de muralla.', st('walls_built', 20)]],
    [['c4_1', 'Bajo el Cráter', 'Llega al piso 5 de un Cráter Estelar y vence al Heraldo.', st('floor_crater', 5)]],
    [['c5_1', 'Una obra para la historia', 'Construye la Maravilla.', B('wonder')]],
    [['c6_1', 'Huesos de dragón', 'Investiga un Cementerio de Dragones (un lugar legendario) con un héroe.', { t: 'flag', k: 'ley_dragones' }]],
    [['c7_1', 'Lo que guarda el lago', 'Llega al piso 5 de un Templo Hundido.', st('floor_temple', 5)]],
    [['c8_1', 'Tratos de amistad', 'Cierra 3 tratos con otros reinos en el Mercado.', st('trades_accepted', 3)], ['c8_2', 'Manos amigas', 'Ayuda 3 veces a tu gremio.', st('guild_helps', 3)]],
    [['c9_1', 'El camino al Nido', 'Llega al piso 5 de un Nido del Dragón.', st('floor_nest', 5)]],
    [['c10_1', 'Las maravillas del reino', 'Investiga 6 lugares legendarios distintos.', st('legends', 6)]],
  ];
  let capPrev = 'm8';
  D.CAPITULOS.forEach((c, i) => {
    const n = i + 1;
    CAPQ[i].forEach(([id, title, desc, req], j) => { q(id, 'main', 'Cap. ' + U.roman(n) + ' · ' + title, desc, j === 0 ? all({ t: 'era', n: c.era }, req) : req, { gold: Math.round(200 * Math.pow(1.7, c.era - 2)), coins: 5 + 2 * n }, [capPrev]); capPrev = id; });
    const fin = c.lugar ? 'Vence en ' + c.lugar.name + ' (Cuartel → Atacar, o tócalo en el mapa).' : 'Cumple lo que pide el capítulo y el pueblo te corona.';
    q('c' + n + '_fin', 'main', 'Cap. ' + U.roman(n) + ' · ' + c.titulo, fin, { t: 'cap', n }, Object.assign({}, c.premio), [capPrev]);
    Q[Q.length - 1].cap = n;
    capPrev = 'c' + n + '_fin';
  });

  // Leyendas: cadenas secundarias que desbloquean estructuras únicas.
  const ql = (id, title, desc, req, reward, pre, unlock) => { q(id, 'legend', title, desc, req, reward, pre); if (unlock) Q[Q.length - 1].unlock = unlock; };
  ql('l1', 'El forastero de la capa', 'Un viajero llega con historias de cuevas que brillan y guaridas de fieras. Construye un Cuartel para que tus soldados lo escuchen.', B('barracks'), { gold: 150 }, [], 'tavern');
  ql('l2', 'Una jarra para el viajero', 'Construye la Taberna. Desde ahí llegan los rumores y los encargos.', B('tavern'), { crystal: 5, gold: 200 }, ['l1']);
  // Héroes (H1 del plan): la Taberna recibe tres candidatos por día.
  ql('lh1', 'Un héroe en la taberna', 'Recluta a tu primer héroe en la Taberna (menú Héroes). Llévalo de expedición: sube la fuerza de la compañía y usa su habilidad en la batalla.', st('heroes_hired', 1), { gold: 200, crystal: 5 }, ['l2']);
  ql('lh2', 'Forjado en batalla', 'Sube a un héroe al nivel 10 y elígele un talento.', st('hero_lvl', 10), { coins: 20, lore: 3 }, ['lh1']);
  ql('lh3', 'Botín de leyenda', 'Encuentra 5 objetos de equipo en expediciones con un héroe.', st('items_found', 5), { coins: 15, hide: 10 }, ['lh1']);
  ql('lh4', 'La mesa redonda', 'Ten 4 héroes en tu reino (la Taberna en nivel 6).', st('heroes_hired', 4), { coins: 30, crystal: 20 }, ['lh2']);
  // Aventura (H2, H7): encuentros en el camino de las expediciones con héroe y mapas del tesoro.
  ql('la1', 'Caminos peligrosos', 'Resuelve 3 encuentros en el camino (salen en las expediciones con un héroe).', st('encounters', 3), { gold: 300, coins: 10 }, ['lh1']);
  ql('la2', 'La X marca el lugar', 'Desentierra un tesoro de un mapa (salen de las ruinas, de los encuentros y del Mercader de mapas).', st('treasures', 1), { gems: 10, coins: 15 }, ['la1']);
  // Mazmorras 2.0 (H3): incursiones de 5 pisos con un jefe al final.
  ql('lj1', 'El guardián del piso', 'Vence al jefe de una mazmorra: el último piso de una incursión (Cuartel → Atacar).', st('bosses_killed', 1), { coins: 25, crystal: 15 }, ['l3']);
  ql('lj2', 'Sala de trofeos', 'Vence a 5 jefes de mazmorra.', st('bosses_killed', 5), { coins: 40, lore: 10 }, ['lj1']);
  ql('l3', 'Bajo tierra', 'Gana tu primera expedición en una mazmorra (Cuartel → Atacar).', st('exp_won', 1), { hide: 5, coins: 10 }, ['l2']);
  ql('l4', 'Ecos en la piedra', 'Descubre 3 mazmorras explorando el mapa.', st('dungeons_found', 3), { gold: 300 }, ['l2']);
  ql('l5', 'Un deseo de cristal', 'Junta 30 cristales de cueva.', st('sp_crystal', 30), { coins: 15 }, ['l3'], 'wishwell');
  ql('l6', 'Monedas al agua', 'Construye la Fuente de los Deseos y pide tu primer deseo.', all(B('wishwell'), st('wishes', 1)), { crystal: 10 }, ['l5']);
  ql('l7', 'Sangre en la arena', 'Gana 5 expediciones o encargos.', st('exp_won', 5), { gold: 400 }, ['l3'], 'arena');
  ql('l8', 'El clamor del público', 'Construye la Arena de Entrenamiento.', B('arena'), { hide: 15 }, ['l7']);
  ql('l9', 'Cazador de fieras', 'Junta 40 pieles raras.', st('sp_hide', 40), { coins: 15 }, ['l3'], 'beasthouse');
  ql('l10', 'Domar lo salvaje', 'Construye la Casa de Fieras (Era III).', B('beasthouse'), { gold: 600 }, ['l9']);
  ql('l11', 'Mapas de estrellas', 'Llega a la Era III y descubre 6 mazmorras.', all({ t: 'era', n: 3 }, st('dungeons_found', 6)), { lore: 5 }, ['l4'], 'observatory');
  ql('l12', 'Ojos en el cielo', 'Construye el Observatorio.', B('observatory'), { crystal: 15, coins: 15 }, ['l11']);
  ql('l13', 'Corazón de cristal', 'Llega al piso 5 de una Cueva de Cristal.', st('floor_cave', 5), { crystal: 20 }, ['l6'], 'sanctum');
  ql('l14', 'La luz del santuario', 'Construye el Santuario de Cristal.', B('sanctum'), { coins: 20 }, ['l13']);
  ql('l15', 'Metal caído del cielo', 'Junta 20 de hierro estelar en los Cráteres Estelares (Era IV).', st('sp_starIron', 20), { coins: 20 }, ['l8', 'l12'], 'runeforge');
  ql('l16', 'Runas en el yunque', 'Construye la Fragua Rúnica.', B('runeforge'), { starIron: 5, lore: 10 }, ['l15']);
  ql('l17', 'Despertar al dragón', 'Llega al piso 3 de un Nido del Dragón (Era V).', st('floor_nest', 3), { coins: 30 }, ['l16', 'l10'], 'dragontower');
  ql('l18', 'Jinete de dragón', 'Construye la Torre del Dragón.', B('dragontower'), { coins: 50, scale: 5 }, ['l17']);
  // H4 (pk-17): las tres mazmorras nuevas
  ql('lp1', 'Luces en el pantano', 'Llega al piso 5 de un Pantano de las Brujas (Era III) y vence a su bruja.', st('floor_swamp', 5), { herbs: 10, coins: 20 }, ['l3'], 'herbolario');
  ql('lp2', 'Manos verdes', 'Construye el Herbolario.', B('herbolario'), { coins: 25, herbs: 10 }, ['lp1']);
  ql('lg1', 'Pisadas de gigante', 'Llega al piso 5 de una Fortaleza de los Gigantes (Era VI).', st('floor_giants', 5), { titanBone: 10, coins: 30 }, ['lp1'], 'titanforge');
  ql('lg2', 'El yunque de hueso', 'Construye la Forja de Titanes.', B('titanforge'), { coins: 50, titanBone: 10 }, ['lg1']);
  ql('lt1', 'Lo que canta bajo el lago', 'Llega al piso 5 de un Templo Hundido (Era VIII).', st('floor_temple', 5), { pearls: 10, coins: 40 }, ['lg1'], 'faro');
  ql('lt2', 'Una luz sobre la niebla', 'Levanta el Faro Abisal.', B('faro'), { coins: 70, pearls: 10 }, ['lt1']);
  // H6 (pk-17): lugares legendarios
  ql('lw1', 'Maravillas del mundo', 'Descubre un lugar legendario explorando y manda a un héroe a investigarlo.', st('legends', 1), { gems: 15, coins: 15 }, ['lh1']);
  ql('lw2', 'Cronista de maravillas', 'Investiga 6 lugares legendarios distintos.', st('legends', 6), { coins: 40, lore: 10 }, ['lw1']);
  ql('lw3', 'Las doce maravillas', 'Investiga las 12 maravillas del mundo.', st('legends', 12), { coins: 100, gems: 60 }, ['lw2']);
  escalera('lf', 'legend', 'Espeleólogo', [3, 6, 9, 12], n => 'Llega al piso ' + n + ' de cualquier mazmorra.', n => st('floor_max', n), (n, i) => ({ coins: 15 * (i + 1), crystal: 10 * (i + 1) }), 'l14');

  ql('l19', 'Semillas de Oriente', 'Un mercader trae semillas que solo crecen en lo alto. Llega a la Era VIII.', { t: 'era', n: 8 }, { gems: 40, coins: 30 }, ['l18'], 'gardens');
  ql('l20', 'Un jardín en el cielo', 'Construye los Jardines Colgantes.', B('gardens'), { coins: 60, crystal: 40 }, ['l19']);
  ql('l21', 'La memoria del reino', 'Llega a la Era X y reúne 60 de saber antiguo en las mazmorras.', all({ t: 'era', n: 10 }, st('sp_lore', 60)), { coins: 40 }, ['l20'], 'archive');
  ql('l22', 'Los guardianes del saber', 'Construye el Gran Archivo.', B('archive'), { coins: 80, lore: 20 }, ['l21']);
  ql('l23', 'El gigante dormido', 'Llega a la Era XII y al piso 12 de cualquier mazmorra.', all({ t: 'era', n: 12 }, st('floor_max', 12)), { coins: 60 }, ['l22'], 'colossus');
  ql('l24', 'La antorcha del reino', 'Levanta el Coloso del Reino.', B('colossus'), { coins: 120, scale: 20 }, ['l23']);

  // V7: el color de cada escalera. El rango II da su estandarte (color del reino) y el último, su marco de retrato
  // (datos-vida.js los suma a D.TIENDA como premios, sin precio).
  const ESC_COL = { bt: [150, 96, 52], bl: [120, 132, 150], xt: [52, 120, 140], xc: [140, 60, 40], xr: [210, 200, 160], et: [96, 140, 56], it: [80, 80, 96], tt: [200, 160, 60], gt: [70, 90, 160], wt: [150, 36, 36], lf: [96, 60, 140] };
  for (const k in D.ESCALERAS) D.ESCALERAS[k].col = ESC_COL[k] || [150, 150, 150];
  D.premiosRango = q => {
    if (!q.rango) return [];
    const { esc, k, de } = q.rango, out = [];
    if (k === 1) out.push('esc_' + esc + '_c');
    if (k === de - 1 && de >= 3) out.push('esc_' + esc + '_m');
    return out;
  };

  // Algunos rangos dan una mejora permanente además de recursos: un hito de mecánica, no solo un número.
  const PERKS = {
    bt2: { upgradeP: 0.03 }, bt5: { upgradeP: 0.04 }, bl2: { craftP: 0.04 }, bl4: { researchP: 0.05 },
    et2: { gatherP: 0.03 }, et5: { gatherP: 0.05 }, wt2: { armyPower: 0.04 }, wt4: { armyPower: 0.06 }, xt2: { expSpeed: 0.05 }, xt4: { expSpeed: 0.05 },
  };
  for (const id in PERKS) {
    const qq = Q.find(o => o.id === id);
    if (qq) { qq.perk = PERKS[id]; continue; }
    for (const o of Q) for (const a of o.absorbe || []) if (a.id === id) a.perk = PERKS[id]; // un peldaño absorbido (V7)
  }

  // Misiones diarias (3 al día, escaladas por era)
  D.DAILY = [
    { id: 'd_wood', k: 'g_wood', base: 400, text: n => 'Recolecta ' + U.fmt(n) + ' de madera' },
    { id: 'd_food', k: 'g_food', base: 400, text: n => 'Recolecta ' + U.fmt(n) + ' de comida' },
    { id: 'd_stone', k: 'g_stone', base: 250, text: n => 'Recolecta ' + U.fmt(n) + ' de piedra' },
    { id: 'd_gold', k: 'g_gold', base: 200, text: n => 'Recolecta ' + U.fmt(n) + ' de oro' },
    { id: 'd_common', k: 'g_common', base: 400, text: n => 'Recolecta ' + U.fmt(n) + ' en zonas comunes' },
    { id: 'd_vill', k: 'villagers_trained', base: 4, flat: true, text: n => 'Entrena ' + n + ' aldeanos' },
    { id: 'd_upg', k: 'upgrades', base: 2, flat: true, text: n => 'Completa ' + n + ' mejoras de edificios' },
    { id: 'd_explore', k: 'explored', base: 150, flat: true, needB: 'scout', text: n => 'Revela ' + n + ' casillas del mapa' },
    { id: 'd_planks', k: 'p_planks', base: 120, era: 2, text: n => 'Produce ' + U.fmt(n) + ' tablones' },
    { id: 'd_market', k: 'market_ops', base: 3, flat: true, era: 2, needB: 'market', text: n => 'Haz ' + n + ' operaciones en el mercado' },
    { id: 'd_contrib', k: 'contrib', base: 600, era: 2, needFlag: 'guildJoined', text: n => 'Aporta ' + U.fmt(n) + ' al gremio' },
    { id: 'd_ingots', k: 'p_ingots', base: 40, era: 3, text: n => 'Produce ' + U.fmt(n) + ' lingotes' },
    { id: 'd_books', k: 'p_books', base: 15, era: 3, needB: 'scriptorium', text: n => 'Produce ' + U.fmt(n) + ' libros' },
    { id: 'd_army', k: 'trained_army', base: 5, flat: true, era: 2, needB: 'barracks', text: n => 'Entrena ' + n + ' tropas' },
    { id: 'd_exp', k: 'exp_won', base: 2, flat: true, era: 2, needB: 'barracks', text: n => 'Gana ' + n + ' expediciones o encargos' },
  ];
  // Completar las 3 diarias del día da un premio extra.
  D.dailyBonus = era => ({ gold: 120 * era, gems: 2 + era, coins: 6 + 2 * era });

  // Misiones semanales: 3 por semana (se renuevan el lunes), metas grandes y premios que valen la pena.
  D.WEEKLY = [
    { id: 'w_gather', k: 'g_total', base: 15000, text: n => 'Recolecta ' + U.fmt(n) + ' recursos en total' },
    { id: 'w_upg', k: 'upgrades', base: 12, flat: true, text: n => 'Completa ' + n + ' mejoras de edificios' },
    // 20 se cumplía en los primeros minutos de una partida nueva (playtest): una semanal tiene que durar días
    { id: 'w_vill', k: 'villagers_trained', base: 40, flat: true, text: n => 'Entrena ' + n + ' aldeanos' },
    { id: 'w_explore', k: 'explored', base: 900, flat: true, needB: 'scout', text: n => 'Revela ' + n + ' casillas del mapa' },
    { id: 'w_common', k: 'g_common', base: 3000, text: n => 'Recolecta ' + U.fmt(n) + ' en zonas comunes' },
    { id: 'w_market', k: 'market_ops', base: 15, flat: true, era: 2, needB: 'market', text: n => 'Haz ' + n + ' operaciones en el mercado' },
    { id: 'w_contrib', k: 'contrib', base: 5000, era: 2, needFlag: 'guildJoined', text: n => 'Aporta ' + U.fmt(n) + ' al gremio' },
    { id: 'w_exp', k: 'exp_won', base: 10, flat: true, era: 2, needB: 'barracks', text: n => 'Gana ' + n + ' expediciones o encargos' },
    { id: 'w_helps', k: 'guild_helps', base: 10, flat: true, era: 2, needFlag: 'guildJoined', text: n => 'Ayuda ' + n + ' veces a compañeros del gremio' },
    { id: 'w_event', k: 'guild_event', base: 3000, era: 2, needFlag: 'guildJoined', text: n => 'Aporta ' + U.fmt(n) + ' al evento del gremio' },
    { id: 'w_planks', k: 'p_planks', base: 900, era: 2, text: n => 'Produce ' + U.fmt(n) + ' tablones' },
    { id: 'w_ingots', k: 'p_ingots', base: 300, era: 3, text: n => 'Produce ' + U.fmt(n) + ' lingotes' },
  ];
  D.weeklyReward = era => ({ food: 900 * era, wood: 900 * era, stone: 500 * era, gold: 400 * era, gems: 5 + 2 * era, coins: 20 + 5 * era });
  // Racha: un escudo gratis por semana cubre un día perdido; sin escudo, la racha se repara con monedas ese mismo día.
  D.streakRepairCost = n => Math.min(60, 10 + 2 * n);
  // Cofre de bienvenida: al volver tras 10 min o más, crece con las horas fuera (tope 12) y trae una tirada al
  // azar. Solo recursos y gemas del juego.
  D.WELCOME_MIN = 600;
  D.WELCOME_ROLLS = [
    { p: 0.68, name: 'Cofre de bienvenida', mult: 1, gems: 0 },
    { p: 0.22, name: 'Cofre bien cargado', mult: 1.6, gems: 2 },
    { p: 0.08, name: 'Cofre dorado', mult: 2.5, gems: 5 },
    { p: 0.02, name: 'Botín legendario', mult: 4, gems: 12 },
  ];
  D.welcomeChest = (hours, era, r) => {
    let roll = D.WELCOME_ROLLS[0], acc = 0;
    for (const x of D.WELCOME_ROLLS) { acc += x.p; if (r < acc) { roll = x; break; } }
    const h = U.clamp(hours, 0, 12), k = Math.pow(h, 0.75) * era * roll.mult, n = v => Math.max(10, Math.round((v * k) / 10) * 10);
    const reward = { food: n(90), wood: n(90), stone: n(45), gold: n(30) };
    const gems = Math.floor(h / 4) + roll.gems * Math.ceil(era / 2);
    if (gems) reward.gems = gems;
    return { name: roll.name, tier: D.WELCOME_ROLLS.indexOf(roll), hours: h, reward };
  };
  // Aviso de "ya casi": desde esta hora, una vez al día, si falta poco para la racha o las diarias.
  D.ALMOST_HOUR = 20;
  // Cofre de racha: el cofre crece hasta el día 7 y además hay hitos con premios especiales.
  D.STREAK_MILESTONES = [
    { day: 3, name: 'Bolsa del viajero', reward: { gems: 6, coins: 15 } },
    { day: 7, name: 'Cofre del mercader', reward: { gems: 15, crystal: 10, coins: 40 } },
    { day: 14, name: 'Arcón real', reward: { gems: 30, crystal: 20, hide: 15, coins: 80 } },
    { day: 30, name: 'Tesoro de la corona', reward: { gems: 60, lore: 15, starIron: 5, coins: 200 } },
  ];
})();
