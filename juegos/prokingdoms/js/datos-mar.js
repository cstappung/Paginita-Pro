// Tablas del Archipiélago de Bruma (Fase 9, entrega «b», pk-28). Solo las carga el navegador: el servidor nunca ve
// el mapa del mar (la foto del sync no viaja desde el archipiélago), así que sus edificios y recursos no le hacen falta.
//
// Cómo convive con la tierra: la página se recarga en cada travesía, así que al arrancar en el mar `D.aplicarTema('mar')`
// (desde G.init, antes de generar el mapa) cambia las tablas de una vez: nombres de recursos y edificios, eras, costos de
// era y de mejora, qué se puede construir, la Crónica y las diarias. En la tierra no se llama y nada cambia.
// Los recursos de siempre se reutilizan con otro nombre (comida = Pescado, madera = Teca, piedra = Coral) para que todo
// el motor (recolección, bodegas, topes, costos, cálculo sin conexión) siga funcionando igual; lo propio del mar son la
// fibra, el salitre, las especias y sus elaborados (lona, tablazón y pólvora).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;

  // ---------- Recursos ----------
  Object.assign(D.RES, {
    fibra: { name: 'Fibra de palma', mar: true },
    salitre: { name: 'Salitre', mar: true },
    especias: { name: 'Especias', mar: true },
    lona: { name: 'Lona y cordaje', mar: true },
    tablazon: { name: 'Tablazón', mar: true },
    polvora: { name: 'Pólvora', mar: true },
  });
  D.RES_MAR = ['fibra', 'salitre', 'especias', 'lona', 'tablazon', 'polvora'];
  D.RES_ORDER.push(...D.RES_MAR);
  const RAW_MAR = ['food', 'wood', 'stone', 'gold', 'fibra', 'salitre', 'especias'];
  // Qué recursos tiene cada mundo (la barra de arriba, la tienda): en el mar no hay mineral ni lingotes, en la tierra
  // no hay lona ni pólvora. Lo especial (tesoros) vale en los dos.
  D.MAR_BASE = ['food', 'wood', 'stone', 'gold'];
  D.resDelMundo = r => D.RES[r].special || (D.temaActivo === 'mar' ? (D.RES[r].mar || D.MAR_BASE.includes(r)) : !D.RES[r].mar);

  // ---------- Recursos del mapa ----------
  // La teca es un árbol más (kind 'tree', sp 'teca'). El arrecife solo se trabaja con la marea baja (`marea`).
  Object.assign(D.NODES, {
    palma: { name: 'Palmera', res: 'fibra', amount: 90, rate: 0.4, regrow: 2 * 3600, mar: true, soft: true, tool: 'sickle' },
    arrecife: { name: 'Arrecife de coral', res: 'stone', amount: 320, rate: 0.42, regen: 0.08, mar: true, marea: true, tool: 'pick' },
    almeja: { name: 'Banco de almejas', res: 'food', amount: 140, rate: 0.36, regrow: 2.5 * 3600, mar: true, soft: true, tool: 'hand' },
    salitral: { name: 'Salitral', res: 'salitre', amount: 280, rate: 0.3, regen: 0.05, mar: true, tool: 'pick' },
    especia: { name: 'Planta de especias', res: 'especias', amount: 60, rate: 0.12, regrow: 8 * 3600, mar: true, soft: true, tool: 'hand' },
    naufragio: { name: 'Naufragio', res: 'gold', amount: 260, rate: 0.36, mar: true, tool: 'pick' }, // no vuelve: es un tesoro
  });

  // ---------- Edificios propios del mar ----------
  // `agua`: tiene que tocar el agua (como el muelle). `farmRes`: una «granja» que da otra cosa que comida.
  Object.assign(D.BUILD, {
    salinas: { name: 'Salinas', w: 3, h: 3, cost: { wood: 90, stone: 40 }, time: 25, era: 1, walkable: true, flat: true, upT: 0.6, max: e => 1 + e, agua: true, farmRes: 'salitre', mar: true, desc: 'Estanques junto al mar donde el sol deja salitre. Un salinero por salina, sin agotar nada.' },
    velas: { name: 'Taller de Velas', w: 2, h: 2, cost: { wood: 150, fibra: 60 }, time: 40, era: 2, recipe: 'lona', slots: 2, mar: true, desc: 'Teje la fibra de palma en lona y cordaje: los piden los barcos y las mejoras.' },
    astillero: { name: 'Astillero', w: 3, h: 3, cost: { wood: 220, stone: 80, lona: 20 }, time: 60, era: 2, recipe: 'tablazon', slots: 3, agua: true, mar: true, desc: 'Cura la teca con salitre y la convierte en tablazón. Va pegado al agua.' },
    polvorin: { name: 'Polvorín', w: 2, h: 2, cost: { stone: 200, tablazon: 40 }, time: 60, era: 3, recipe: 'polvora', slots: 2, mar: true, desc: 'Mezcla salitre y carbón de teca: pólvora para los cañones y las mejoras altas.' },
    faromar: { name: 'Faro', w: 2, h: 2, cost: { stone: 180, wood: 60 }, time: 45, era: 2, max: e => e, mar: true, desc: 'Ve muy lejos y despeja la bruma a su alrededor.' },
    embarcadero: { name: 'Embarcadero de colonos', w: 3, h: 3, cost: { wood: 260, lona: 30 }, time: 60, era: 2, max: 1, agua: true, mar: true, desc: 'Arma barcos de colonos para fundar colonias en otras islas. Cada nivel par permite una colonia más.' },
    comercio: { name: 'Casa de comercio', w: 3, h: 3, cost: { wood: 200, stone: 120, tablazon: 30 }, time: 60, era: 3, max: 1, mar: true, desc: 'Compra y vende lo de las islas por oro. Las especias se pagan muy bien.' },
    granfaro: { name: 'Gran Faro de la Bruma', w: 4, h: 4, cost: { stone: 3000, tablazon: 800, polvora: 300, especias: 200 }, time: 900, era: 5, max: 1, upT: 2.5, noCap: true, mar: true, desc: 'La Maravilla del archipiélago: cada nivel da prestigio, +3% a todo y monedas.' },
    colonia: { name: 'Muelle de la colonia', w: 2, h: 2, cost: { wood: 80 }, time: 1, era: 1, max: () => 0, drop: RAW_MAR, upT: 0.7, mar: true, desc: 'El acopio de una colonia: acepta todo lo que se junta en su isla.' },
  });
  const recipeStats = base => L => ({ prod: 0.15 * (L - 1), slots: base + Math.floor((L - 1) / 3) });
  Object.assign(D.BSTATS, {
    salinas: L => ({ farm: 0.12 * (L - 1) }),
    velas: recipeStats(2), astillero: recipeStats(3), polvorin: recipeStats(2),
    faromar: L => ({ sight: 12 + 2 * L }),
    embarcadero: L => ({ colonias: 1 + Math.floor((L - 1) / 2) }),
    comercio: L => ({ buy: Math.max(1, 1.2 - 0.02 * L), sell: Math.min(0.85, 0.6 + 0.025 * L) }),
    granfaro: D.BSTATS.wonder,
    colonia: L => ({ gather: 0.1 * (L - 1), carry: L - 1 }),
  });
  D.STAT_LABELS.colonias = ['Colonias', v => String(v)];
  for (const k of ['salinas', 'velas', 'astillero', 'polvorin', 'faromar', 'embarcadero', 'comercio', 'granfaro', 'colonia']) {
    const b = D.BUILD[k];
    if (b.recipe) b.upT = b.upT || 1.1;
    b.sight = b.sight || (b.w >= 3 ? 5 : 4);
  }
  Object.assign(D.RECIPES, {
    lona: { in: { fibra: 3 }, out: { lona: 1 }, time: 6 },
    tablazon: { in: { wood: 2, salitre: 1 }, out: { tablazon: 1 }, time: 8 },
    polvora: { in: { salitre: 2, wood: 1 }, out: { polvora: 1 }, time: 10 },
  });

  // ---------- Islas ----------
  // La isla de casa y cinco islas con un rasgo cada una (world.js las reparte con la semilla). `nodos`: qué crece ahí.
  D.ISLAS = {
    volcan: { name: 'Isla Volcánica', rasgo: 'salitre y roca', icon: 'salitre' },
    coral: { name: 'Isla de Coral', rasgo: 'arrecifes de coral', icon: 'stone' },
    palmas: { name: 'Isla de las Palmeras', rasgo: 'fibra de palma', icon: 'fibra' },
    naufragios: { name: 'Isla de los Naufragios', rasgo: 'tesoros hundidos (oro que no vuelve)', icon: 'gold' },
    especias: { name: 'Isla de las Especias', rasgo: 'especias, raras y valiosas', icon: 'especias' },
  };
  D.ISLAS_ORDEN = ['palmas', 'coral', 'volcan', 'naufragios', 'especias'];
  // Una colonia: el barco lleva colonos y materiales. Cuesta más cada vez, y la travesía tarda según la distancia.
  D.colonia = {
    colonos: 3,
    costo: n => ({ food: 250 * (n + 1), wood: 350 * (n + 1), lona: 30 * (n + 1) }),
    viaje: d => Math.round(60 + d * 4), // segundos
  };

  // ---------- Casa de comercio ----------
  // Precio en oro de una unidad (antes del recargo de compra o el descuento de venta del nivel).
  D.COMERCIO_MAR = { food: 0.8, wood: 0.9, stone: 1.1, fibra: 1.2, salitre: 1.6, lona: 4.5, tablazon: 6, polvora: 9, especias: 14 };

  // ---------- Eras ----------
  D.ERAS_MAR = ['Caleta', 'Puerto', 'Astillero', 'Flota', 'Almirantazgo', 'Señor de los Mares'];
  const eraCostMar = n => ({
    2: { food: 600, wood: 500, fibra: 150 },
    3: { food: 2000, wood: 1800, stone: 600, gold: 400, lona: 150 },
    4: { food: 6000, wood: 5000, stone: 2500, gold: 1500, lona: 400, tablazon: 250 },
    5: { food: 16000, wood: 13000, stone: 7000, gold: 4500, tablazon: 800, polvora: 300, especias: 80 },
    6: { food: 40000, wood: 32000, stone: 18000, gold: 12000, tablazon: 2000, polvora: 900, especias: 300 },
  })[n] || { gold: 1e9 };
  const eraTimeMar = n => ({ 2: 180, 3: 1200, 4: 4800, 5: 10800, 6: 21600 })[n] || 86400;
  const eraReqMar = function (n) {
    if (n === 2) return [{ b: 'tc', lvl: 2, text: 'Fortaleza del Puerto nivel 2' }, { any: ['muelle'], n: 1, text: 'Una Cabaña de pescadores' }, { any: ['lumber', 'mining'], n: 2, text: 'Aserradero de teca y Cantera de coral' }];
    if (n === 3) return [{ any: ['velas'], n: 1, text: 'Un Taller de Velas' }, { any: ['embarcadero'], n: 1, text: 'El Embarcadero de colonos' }, { lvlAny: 3, n: 4, text: '4 edificios en nivel 3 o más' }];
    if (n === 4) return [{ any: ['astillero'], n: 1, text: 'Un Astillero' }, { any: ['colonia'], n: 1, text: 'Una colonia' }, { lvlAny: 5, n: 5, text: '5 edificios en nivel 5 o más' }];
    if (n === 5) return [{ any: ['polvorin'], n: 1, text: 'Un Polvorín' }, { any: ['comercio'], n: 1, text: 'La Casa de comercio' }, { lvlAny: 7, n: 6, text: '6 edificios en nivel 7 o más' }, { pop: 50, text: 'Población de 50' }];
    if (n === 6) return [{ any: ['colonia'], n: 3, text: 'Tres colonias' }, { lvlAny: 9, n: 7, text: '7 edificios en nivel 9 o más' }, { pop: 70, text: 'Población de 70' }];
    return [{ pop: 1e9, text: 'Señor de los Mares es la última era del archipiélago' }];
  };
  const r5 = v => Math.max(5, Math.round(v / 5) * 5);
  // Las mejoras piden lo elaborado del mar a medida que suben (en la tierra: tablones, sillares, lingotes…).
  const upCostMar = function (type, L) {
    const def = D.BUILD[type], base = def.up || def.cost, k = 1.2 * Math.pow(1.85, L - 1), c = {};
    for (const r in base) c[r] = r5(base[r] * k);
    const add = (r, from, a) => { if (L >= from) c[r] = (c[r] || 0) + r5(a * Math.pow(1.8, L - from)); };
    add('fibra', 2, 15); add('lona', 4, 12); add('tablazon', 6, 15); add('polvora', 8, 12); add('especias', 10, 8);
    return c;
  };

  // ---------- Qué cambia de nombre y qué se construye ----------
  D.MAR = {
    nombres: { food: 'Pescado', wood: 'Teca', stone: 'Coral' },
    // edificios de la tierra que en el mar son otra cosa (mismo motor, otro nombre y otro dibujo)
    edificios: {
      tc: { name: 'Fortaleza del Puerto', drop: RAW_MAR, desc: 'El corazón de tu isla: entrena colonos, guarda de todo y avanza de era.' },
      house: { name: 'Cabaña sobre pilotes', desc: 'Da población. Mejórala para que viva más gente.' },
      mill: { name: 'Lonja', desc: 'Acopio de pescado y almejas.' },
      muelle: { name: 'Cabaña de pescadores', era: 1, desc: 'Va pegada al agua. Un pescador saca pescado según el agua que la rodea; con la marea alta rinde más.' },
      lumber: { name: 'Aserradero de teca', drop: ['wood', 'fibra'], desc: 'Acopio de teca y de fibra de palma.' },
      mining: { name: 'Cantera de coral', drop: ['stone', 'gold', 'salitre', 'especias'], desc: 'Acopio de coral, salitre, oro de los naufragios y especias.' },
      granary: { name: 'Ahumadero', desc: 'Aumenta cuánto pescado puedes guardar.' },
      warehouse: { name: 'Bodega del puerto', desc: 'Aumenta cuánto puedes guardar de todo lo demás.' },
      builder: { name: 'Casa del Carpintero de Ribera', desc: '+1 carpintero: podrás mejorar un edificio más a la vez.' },
      tower: { name: 'Torre de vigía de la costa', desc: 'Vigila la costa y ve lejos sobre el agua.' },
    },
    construir: ['house', 'mill', 'muelle', 'lumber', 'mining', 'salinas', 'granary', 'warehouse', 'builder', 'tower', 'faromar', 'velas', 'embarcadero', 'astillero', 'polvorin', 'comercio', 'granfaro'],
  };

  // ---------- Crónica del Mar ----------
  const B = (b, n) => ({ t: 'build', b, n: n || 1 }), LV = (b, lvl) => ({ t: 'level', b, lvl, n: 1 }), LA = (lvl, n) => ({ t: 'level', lvl, n });
  const st = (k, n) => ({ t: 'stat', k, n }), all = (...of) => ({ t: 'all', of }), era = n => ({ t: 'era', n });
  D.QUESTS_MAR = [];
  let prev = null;
  const q = (id, title, desc, req, reward) => { D.QUESTS_MAR.push({ id, branch: 'mar', title, desc, req, reward, pre: prev ? [prev] : [] }); prev = id; };
  q('mar1', 'Redes al agua', 'Construye una Cabaña de pescadores pegada al agua: el pescado no se acaba.', B('muelle'), { wood: 150, coins: 5 });
  q('mar2', 'Teca y palmas', 'Construye un Aserradero de teca cerca del bosque.', B('lumber'), { food: 200 });
  q('mar3', 'Coral con la marea baja', 'Construye una Cantera de coral y junta 150 de coral. Los arrecifes solo se trabajan con la marea baja.', all(B('mining'), st('g_stone', 150)), { wood: 200 });
  q('mar4', 'Sal del mar', 'Construye unas Salinas junto al agua.', B('salinas'), { food: 250, coins: 5 });
  q('mar5', 'Pilotes', 'Ten 4 Cabañas sobre pilotes.', B('house', 4), { wood: 250 });
  q('mar6', 'La Fortaleza crece', 'Sube la Fortaleza del Puerto a nivel 2.', LV('tc', 2), { gold: 100, fibra: 60 });
  q('mar7', 'Hacia el Puerto', 'Avanza a la Era II del archipiélago: Puerto.', era(2), { gold: 200, coins: 20 });
  q('mar8', 'Lona y cordaje', 'Construye un Taller de Velas y teje 30 de lona.', all(B('velas'), st('p_lona', 30)), { fibra: 200, coins: 10 });
  q('mar9', 'Luz en la bruma', 'Levanta un Faro: ve lejos y despeja la bruma.', B('faromar'), { stone: 300 });
  q('mar10', 'Barco de colonos', 'Construye el Embarcadero de colonos.', B('embarcadero'), { lona: 40, coins: 10 });
  q('mar11', 'La primera colonia', 'Funda una colonia en otra isla desde el Embarcadero.', st('colonias', 1), { food: 600, wood: 600, coins: 20 });
  q('mar12', 'Hacia el Astillero', 'Avanza a la Era III: Astillero.', era(3), { gold: 500, coins: 30 });
  q('mar13', 'Tablazón', 'Construye un Astillero y cura 40 de tablazón.', all(B('astillero'), st('p_tablazon', 40)), { salitre: 200, coins: 15 });
  q('mar14', 'Olor a canela', 'Junta 40 especias (solo crecen en la Isla de las Especias).', st('g_especias', 40), { gold: 800, coins: 20 });
  q('mar15', 'Hacia la Flota', 'Avanza a la Era IV: Flota.', era(4), { gold: 1500, coins: 40 });
  q('mar16', 'Pólvora seca', 'Construye un Polvorín y prepara 30 de pólvora.', all(B('polvorin'), st('p_polvora', 30)), { tablazon: 100, coins: 20 });
  q('mar17', 'Mercaderes', 'Abre la Casa de comercio y haz 5 tratos.', all(B('comercio'), st('comercio_mar', 5)), { gold: 1500, coins: 20 });
  q('mar18', 'Hacia el Almirantazgo', 'Avanza a la Era V: Almirantazgo.', era(5), { gold: 4000, coins: 60 });
  q('mar19', 'Tres colonias', 'Funda tres colonias.', st('colonias', 3), { especias: 60, coins: 40 });
  q('mar20', 'El Gran Faro', 'Levanta el Gran Faro de la Bruma.', B('granfaro'), { coins: 100 });
  q('mar21', 'Señor de los Mares', 'Avanza a la Era VI: Señor de los Mares.', era(6), { coins: 150, especias: 200 });
  D.BRANCH_MAR = { id: 'mar', name: 'Crónica del Mar', icon: 'ancla', desc: 'La historia de tu isla: pesca, colonias, especias y el Gran Faro.' };

  const DAILY_MAR = [
    { id: 'dm_food', k: 'g_food', base: 400, text: n => 'Junta ' + U.fmt(n) + ' de pescado' },
    { id: 'dm_wood', k: 'g_wood', base: 350, text: n => 'Tala ' + U.fmt(n) + ' de teca' },
    { id: 'dm_stone', k: 'g_stone', base: 200, text: n => 'Saca ' + U.fmt(n) + ' de coral' },
    { id: 'dm_fibra', k: 'g_fibra', base: 200, text: n => 'Junta ' + U.fmt(n) + ' de fibra de palma' },
    { id: 'dm_salitre', k: 'g_salitre', base: 120, text: n => 'Junta ' + U.fmt(n) + ' de salitre' },
    { id: 'dm_vill', k: 'villagers_trained', base: 4, flat: true, text: n => 'Entrena ' + n + ' colonos' },
    { id: 'dm_upg', k: 'upgrades', base: 2, flat: true, text: n => 'Completa ' + n + ' mejoras de edificios' },
    { id: 'dm_lona', k: 'p_lona', base: 40, era: 2, text: n => 'Teje ' + U.fmt(n) + ' de lona' },
    { id: 'dm_tablazon', k: 'p_tablazon', base: 30, era: 3, text: n => 'Cura ' + U.fmt(n) + ' de tablazón' },
  ];
  const WEEKLY_MAR = [
    { id: 'wm_gather', k: 'g_total', base: 12000, text: n => 'Junta ' + U.fmt(n) + ' recursos en total' },
    { id: 'wm_upg', k: 'upgrades', base: 12, flat: true, text: n => 'Completa ' + n + ' mejoras de edificios' },
    { id: 'wm_vill', k: 'villagers_trained', base: 30, flat: true, text: n => 'Entrena ' + n + ' colonos' },
    { id: 'wm_fibra', k: 'g_fibra', base: 2500, text: n => 'Junta ' + U.fmt(n) + ' de fibra de palma' },
    { id: 'wm_lona', k: 'p_lona', base: 300, era: 2, text: n => 'Teje ' + U.fmt(n) + ' de lona' },
  ];

  // ---------- Aplicar el tema ----------
  // Una sola vez, al arrancar la página en el mar (G.init). Devuelve si cambió algo.
  D.temaActivo = 'tierra';
  D.aplicarTema = function (tema) {
    if (tema !== 'mar' || D.temaActivo === 'mar') return false;
    D.temaActivo = 'mar';
    for (const r in D.MAR.nombres) D.RES[r].name = D.MAR.nombres[r];
    for (const k in D.MAR.edificios) Object.assign(D.BUILD[k], D.MAR.edificios[k]);
    D.BUILD_ORDER = D.MAR.construir.slice();
    D.ERA_NAMES = D.ERAS_MAR.slice();
    D.eraName = n => D.ERAS_MAR[n - 1] || D.ERAS_MAR[D.ERAS_MAR.length - 1];
    D.eraCost = eraCostMar;
    D.eraTime = eraTimeMar;
    D.eraReq = eraReqMar;
    D.upCost = upCostMar;
    D.WONDERS = ['granfaro'];
    D.QUESTS = D.QUESTS_MAR;
    D.BRANCHES = [D.BRANCH_MAR];
    D.DAILY = DAILY_MAR;
    D.WEEKLY = WEEKLY_MAR;
    D.dailyBonus = e => ({ gold: 100 * e, fibra: 40 * e, coins: 6 + 2 * e });
    D.weeklyReward = e => ({ food: 800 * e, wood: 800 * e, stone: 400 * e, gold: 350 * e, fibra: 200 * e, coins: 20 + 5 * e });
    D.VILLAGER = Object.assign({}, D.VILLAGER, { name: 'Colono' });
    return true;
  };
})();
