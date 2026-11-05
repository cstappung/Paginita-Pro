// El Pase del Reino (Fase 8 del plan de la mega actualización, pk-20): datos y cuentas que comparten el juego y su
// servidor (server/sim.js carga este archivo como util.js, data.js y world.js; functions/prepara.js lo copia).
//
// Dura 2 semanas (D.PASE, contado desde el mismo lunes que colabtex/src/juegos/pase-pk.js: la prueba de monedas
// compara las dos cuentas). 30 niveles de 150 puntos (PP), una pista gratis y una dorada (2.500 monedas de la
// página, compradas por la página de Juegos, nunca por el juego). Los PP los decide el servidor: el cliente informa
// sus estadísticas en cada sync (D.PASE_STATS) y el servidor suma las diferencias con tope por fuente y por día.
// Los premios llegan por el buzón del servidor. Los aspectos son solo visuales: cada tema vuelve una vez al año, en
// la misma quincena (D.CALENDARIO_PASE, por período % 26).
(function () {
  'use strict';
  const PK = window.PK, D = PK.D, U = PK.U;

  D.PASE = { precio: 2500, inicio: Date.UTC(2026, 10, 2, 3, 0, 0), ms: 14 * 86400000, niveles: 30, pp: 150, extraPP: 400, extraMax: 5, diaMax: 700 };
  D.paseDe = t => Math.floor((t - D.PASE.inicio) / D.PASE.ms);
  D.paseInicio = n => D.PASE.inicio + n * D.PASE.ms;
  D.paseNivel = pp => Math.min(D.PASE.niveles, Math.floor(pp / D.PASE.pp));
  // cofres después del nivel 30 (solo pista dorada): uno cada 400 PP, hasta 5
  D.paseExtras = pp => U.clamp(Math.floor((pp - D.PASE.niveles * D.PASE.pp) / D.PASE.extraPP), 0, D.PASE.extraMax);

  // Actividad normal: [PP por vez, tope de PP por día]
  D.PASE_ACT = { upgrades: [5, 150], exp_won: [10, 150], aldeanos: [2, 60] };
  // Retos: 3 diarios (de D.PASE_DIARIOS, con semilla del día) y 10 del pase (de D.PASE_RETOS, semilla del período).
  // k: la estadística, n: cuánto tiene que subir desde que empezó el día o el pase.
  D.PASE_DIARIOS = [
    { id: 'd_mej', k: 'upgrades', n: 5, pp: 50, txt: 'Completa 5 mejoras de edificios' },
    { id: 'd_exp', k: 'exp_won', n: 2, pp: 60, txt: 'Gana 2 expediciones o encargos' },
    { id: 'd_ald', k: 'aldeanos', n: 10, pp: 40, txt: 'Entrena 10 aldeanos' },
    { id: 'd_rec', k: 'g_total', n: 4000, pp: 50, txt: 'Recolecta 4.000 recursos' },
    { id: 'd_ev', k: 'events', n: 2, pp: 50, txt: 'Vive 2 eventos del mapa' },
    { id: 'd_fi', k: 'fiestas', n: 1, pp: 60, txt: 'Haz una fiesta del pueblo' },
    { id: 'd_pi', k: 'floors', n: 3, pp: 70, txt: 'Limpia 3 pisos de mazmorra' },
    { id: 'd_hab', k: 'habilidades', n: 2, pp: 60, txt: 'Usa 2 veces la habilidad de un héroe' },
    { id: 'd_mer', k: 'market_ops', n: 3, pp: 40, txt: 'Compra o vende 3 veces en el Mercado' },
    { id: 'd_ini', k: 'raids_won', n: 1, pp: 80, txt: 'Rechaza una incursión de bandidos' },
  ];
  D.PASE_RETOS = [
    { id: 'p_exp', k: 'exp_won', n: 15, pp: 250, txt: 'Gana 15 expediciones o encargos' },
    { id: 'p_jefes', k: 'bosses_killed', n: 2, pp: 300, txt: 'Derrota a 2 jefes de mazmorra' },
    { id: 'p_rec', k: 'g_total', n: 40000, pp: 200, txt: 'Recolecta 40.000 recursos' },
    { id: 'p_hab', k: 'habilidades', n: 10, pp: 200, txt: 'Usa 10 veces la habilidad de un héroe' },
    { id: 'p_def', k: 'defensa_limpia', n: 2, pp: 250, txt: 'Defiende 2 incursiones sin que te roben nada' },
    { id: 'p_mej', k: 'upgrades', n: 40, pp: 200, txt: 'Completa 40 mejoras de edificios' },
    { id: 'p_pisos', k: 'floors', n: 15, pp: 250, txt: 'Limpia 15 pisos de mazmorra' },
    { id: 'p_ev', k: 'events', n: 10, pp: 150, txt: 'Vive 10 eventos del mapa' },
    { id: 'p_nodos', k: 'nodos', n: 3, pp: 200, txt: 'Investiga 3 nodos del árbol del reino' },
    { id: 'p_decos', k: 'decos', n: 5, pp: 150, txt: 'Construye 5 decoraciones' },
    { id: 'p_fi', k: 'fiestas', n: 5, pp: 200, txt: 'Haz 5 fiestas del pueblo' },
    { id: 'p_enc', k: 'missions_done', n: 8, pp: 200, txt: 'Cumple 8 encargos del tablón' },
    { id: 'p_inc', k: 'raids_won', n: 3, pp: 250, txt: 'Rechaza 3 incursiones de bandidos' },
    { id: 'p_ald', k: 'aldeanos', n: 60, pp: 150, txt: 'Entrena 60 aldeanos' },
  ];
  D.PASE_STATS = [...new Set(Object.keys(D.PASE_ACT).concat(D.PASE_DIARIOS.map(r => r.k), D.PASE_RETOS.map(r => r.k)))];
  const elige = (lista, n, semilla) => {
    const rng = U.rng(U.strHash(semilla)), l = lista.slice(), out = [];
    while (out.length < n && l.length) out.push(l.splice(Math.floor(rng() * l.length), 1)[0]);
    return out;
  };
  D.paseDiarios = (n, dia) => elige(D.PASE_DIARIOS, 3, 'pase-dia:' + n + ':' + dia);
  D.paseRetos = n => elige(D.PASE_RETOS, 10, 'pase:' + n);

  // ---------- Temas y aspectos (PA6, Anexo A11) ----------
  // heroe: la clase que lo usa, su color y el accesorio del retrato. edificio: a qué tipo cambia y el material del
  // techo. tropa: qué tropa y su color. deco: qué decoración se tiñe. barco: para el Archipiélago (Fase 9).
  D.PASE_TEMAS = {
    dragon: { name: 'Del Dragón', col: [176, 48, 32], heroe: { clase: 'paladin', name: 'Escama de Ignivor', col: [150, 40, 30], acc: 'cuernos' }, edificio: { b: 'tavern', name: 'Guarida del Dragón', techo: 'rust' }, tropa: { t: 'spear', name: 'Lanceros de escamas', col: [150, 50, 40] }, deco: { b: 'estatua', name: 'Estatua de dragón', col: [120, 40, 30] }, barco: { name: 'Galera del Dragón' }, efecto: { name: 'Fuego de dragón', col: '#ff7a30' } },
    piratas: { name: 'Piratas de la Bruma', col: [40, 70, 110], heroe: { clase: 'guarda', name: 'Corsaria de la Bruma', col: [40, 60, 100], acc: 'tricornio' }, edificio: { b: 'muelle', name: 'Muelle de pescadores con velas', techo: 'canvasB' }, tropa: { t: 'archer', name: 'Arqueros con sombrero pirata', col: [60, 60, 70] }, deco: { b: 'columna', name: 'Ancla dorada', col: [200, 160, 60] }, barco: { name: 'Bergantín corsario' }, efecto: { name: 'Pólvora de la bruma', col: '#d8dce8' } },
    invierno: { name: 'De Invierno', col: [150, 190, 230], heroe: { clase: 'clerigo', name: 'Dama de la Escarcha', col: [170, 200, 235], acc: 'tiara' }, edificio: { b: 'tc', name: 'Centro Urbano nevado', techo: 'marbleS' }, tropa: { t: 'militia', name: 'Milicia con capas de piel', col: [200, 210, 225] }, deco: { b: 'estatua', name: 'Muñeco de nieve', col: [240, 244, 250] }, barco: { name: 'Rompehielos' }, efecto: { name: 'Escarcha', col: '#bfe6ff' } },
    nomuertos: { name: 'De los No-muertos', col: [90, 60, 120], heroe: { clase: 'hechicero', name: 'Nigromante', col: [70, 50, 100], acc: 'capucha' }, edificio: { b: 'tavern', name: 'Taberna embrujada', techo: 'slate' }, tropa: { t: 'knight', name: 'Caballeros espectrales', col: [120, 140, 150] }, deco: { b: 'jardin', name: 'Calabazas y lápidas', col: [220, 120, 40] }, barco: { name: 'Barco fantasma' }, efecto: { name: 'Llama verde', col: '#7aff8a' } },
    torneo: { name: 'Del Torneo', col: [200, 60, 80], heroe: { clase: 'juglar', name: 'Heraldo del Torneo', col: [190, 50, 70], acc: 'sombrero' }, edificio: { b: 'barracks', name: 'Cuartel con gradas', techo: 'canvasR' }, tropa: { t: 'knight', name: 'Caballeros de justa', col: [190, 50, 70] }, deco: { b: 'estandarte', name: 'Estandartes de justa', col: [200, 60, 80] }, barco: { name: 'Nave del heraldo' }, efecto: { name: 'Confeti', col: '#ffd84a' } },
    arcana: { name: 'Arcana', col: [70, 80, 180], heroe: { clase: 'hechicero', name: 'Archimago Estelar', col: [60, 70, 170], acc: 'estrellas' }, edificio: { b: 'library', name: 'Biblioteca con cúpula de estrellas', techo: 'glaze' }, tropa: { t: 'cleric', name: 'Clérigos de túnica estelar', col: [60, 70, 170] }, deco: { b: 'columna', name: 'Orbe flotante', col: [120, 140, 255] }, barco: { name: 'Nave estelar' }, efecto: { name: 'Polvo de estrellas', col: '#a8b8ff' } },
    cosecha: { name: 'De la Cosecha', col: [200, 150, 50], heroe: { clase: 'ingeniera', name: 'Maestra de los Molinos', col: [190, 140, 50], acc: 'paja' }, edificio: { b: 'mill', name: 'Molino gigante', techo: 'thatch' }, tropa: { t: 'militia', name: 'Milicia de granjeros', col: [170, 130, 60] }, deco: { b: 'frutal', name: 'Espantapájaros', col: [200, 160, 70] }, barco: { name: 'Barcaza de grano' }, efecto: { name: 'Hojas doradas', col: '#f0c040' } },
    gremio: { name: 'Del Gremio', col: [70, 120, 60], heroe: { clase: 'paladin', name: 'Guardián del Roble', col: [60, 110, 50], acc: 'hojas' }, edificio: { b: 'guild', name: 'Salón del Gremio dorado', techo: 'gilt' }, tropa: { t: 'spear', name: 'Lanceros del Roble', col: [60, 110, 50] }, deco: { b: 'frutal', name: 'Árbol del Roble', col: [90, 150, 60] }, barco: { name: 'Carraca del Roble' }, efecto: { name: 'Hojas de roble', col: '#8ad860' } },
    // pk-33: los 18 que faltaban para el año (el calendario sigue las estaciones de Chile: carnaval en febrero,
    // otoño en marzo, primavera en septiembre, lo imperial cerca de las Fiestas Patrias)
    carnaval: { name: 'Del Carnaval', col: [180, 60, 170], heroe: { clase: 'juglar', name: 'Reina del Carnaval', col: [180, 60, 170], acc: 'antifaz' }, edificio: { b: 'house', name: 'Casas de feria', techo: 'canvasA' }, tropa: { t: 'militia', name: 'Comparsa de milicianos', col: [180, 60, 170] }, deco: { b: 'escenario', name: 'Escenario del carnaval', col: [220, 80, 200] }, barco: { name: 'Barca de las máscaras' }, efecto: { name: 'Serpentinas', col: '#ff60e0' } },
    mareas: { name: 'Señores de las Mareas', col: [40, 120, 140], heroe: { clase: 'guarda', name: 'Vigía de las Mareas', col: [40, 120, 140], acc: 'conchas' }, edificio: { b: 'muelle', name: 'Muelle de coral', techo: 'coral' }, tropa: { t: 'spear', name: 'Lanceros del arrecife', col: [40, 120, 140] }, deco: { b: 'fuente', name: 'Fuente de las caracolas', col: [80, 170, 190] }, barco: { name: 'Galeón de coral' }, efecto: { name: 'Espuma', col: '#a0f0ff' } },
    otono: { name: 'Del Otoño', col: [190, 100, 40], heroe: { clase: 'ingeniera', name: 'Guardabosques del Otoño', col: [190, 100, 40], acc: 'bufanda' }, edificio: { b: 'granary', name: 'Granero de cobre', techo: 'cobre' }, tropa: { t: 'archer', name: 'Arqueros de hojarasca', col: [170, 90, 40] }, deco: { b: 'frutal', name: 'Arce rojo', col: [210, 90, 40] }, barco: { name: 'Velero de las hojas' }, efecto: { name: 'Hojas rojas', col: '#e06030' } },
    bosque: { name: 'Del Bosque Encantado', col: [60, 120, 80], heroe: { clase: 'guarda', name: 'Señora del Ciervo Blanco', col: [60, 120, 80], acc: 'cuernos_ciervo' }, edificio: { b: 'lumber', name: 'Cabaña del bosque', techo: 'jade' }, tropa: { t: 'archer', name: 'Arqueros del musgo', col: [50, 110, 60] }, deco: { b: 'estanque', name: 'Estanque de las hadas', col: [90, 170, 140] }, barco: { name: 'Balsa de raíces' }, efecto: { name: 'Luciérnagas', col: '#d0ff70' } },
    mercader: { name: 'De los Mercaderes', col: [60, 140, 120], heroe: { clase: 'juglar', name: 'Gran Mercader', col: [60, 140, 120], acc: 'plumas' }, edificio: { b: 'market', name: 'Mercado de toldos verdes', techo: 'canvasV' }, tropa: { t: 'rider', name: 'Jinetes de caravana', col: [60, 140, 120] }, deco: { b: 'banca', name: 'Banca del cambista', col: [200, 160, 90] }, barco: { name: 'Carraca mercante' }, efecto: { name: 'Lluvia de monedas', col: '#ffd040' } },
    desierto: { name: 'Del Desierto', col: [210, 170, 100], heroe: { clase: 'hechicero', name: 'Visir de las Dunas', col: [200, 160, 90], acc: 'turbante' }, edificio: { b: 'tavern', name: 'Caravasar de adobe', techo: 'arena' }, tropa: { t: 'rider', name: 'Jinetes del desierto', col: [200, 160, 90] }, deco: { b: 'pozo', name: 'Oasis', col: [210, 180, 120] }, barco: { name: 'Dhow de las dunas' }, efecto: { name: 'Tormenta de arena', col: '#e8c890' } },
    luna: { name: 'De la Luna', col: [90, 100, 160], heroe: { clase: 'clerigo', name: 'Sacerdotisa de la Luna', col: [110, 120, 180], acc: 'luna' }, edificio: { b: 'monastery', name: 'Templo lunar', techo: 'hielo' }, tropa: { t: 'cleric', name: 'Clérigos de plata', col: [150, 160, 200] }, deco: { b: 'estatua', name: 'Estatua de la luna', col: [200, 210, 240] }, barco: { name: 'Nave de plata' }, efecto: { name: 'Luz de luna', col: '#d8e0ff' } },
    norte: { name: 'Del Norte', col: [120, 130, 150], heroe: { clase: 'paladin', name: 'Jarl del Norte', col: [120, 130, 150], acc: 'yelmo_alado' }, edificio: { b: 'warehouse', name: 'Salón largo', techo: 'darkwood' }, tropa: { t: 'spear', name: 'Lanceros del fiordo', col: [120, 90, 60] }, deco: { b: 'hoguera', name: 'Fogata del clan', col: [200, 120, 60] }, barco: { name: 'Drakkar' }, efecto: { name: 'Runas heladas', col: '#9ad0ff' } },
    tormenta: { name: 'De la Tormenta', col: [70, 80, 110], heroe: { clase: 'hechicero', name: 'Señor del Trueno', col: [70, 80, 110], acc: 'rayos' }, edificio: { b: 'barracks', name: 'Cuartel de la tormenta', techo: 'obsidiana' }, tropa: { t: 'crossbow', name: 'Ballesteros del trueno', col: [70, 80, 110] }, deco: { b: 'estandarte', name: 'Estandarte del rayo', col: [90, 110, 200] }, barco: { name: 'Nave del trueno' }, efecto: { name: 'Relámpago', col: '#e0f0ff' } },
    cristal: { name: 'De Cristal', col: [140, 200, 230], heroe: { clase: 'clerigo', name: 'Dama de Cristal', col: [140, 200, 230], acc: 'cristales' }, edificio: { b: 'university', name: 'Universidad de cristal', techo: 'hielo' }, tropa: { t: 'mage', name: 'Magos del prisma', col: [120, 180, 230] }, deco: { b: 'columna', name: 'Obelisco de cristal', col: [160, 220, 255] }, barco: { name: 'Nave de cristal' }, efecto: { name: 'Destello prismático', col: '#c0f0ff' } },
    gigantes: { name: 'De los Gigantes', col: [130, 120, 110], heroe: { clase: 'paladin', name: 'Hijo de Ymrok', col: [130, 120, 110], acc: 'casco_piedra' }, edificio: { b: 'masonry', name: 'Cantería de los gigantes', techo: 'rock' }, tropa: { t: 'knight', name: 'Caballeros de piedra', col: [130, 120, 110] }, deco: { b: 'estatua', name: 'Gigante dormido', col: [150, 140, 130] }, barco: { name: 'Arca de piedra' }, efecto: { name: 'Temblor', col: '#c8b090' } },
    abismo: { name: 'Del Abismo', col: [30, 70, 90], heroe: { clase: 'hechicero', name: 'Voz de las Profundidades', col: [30, 70, 90], acc: 'tentaculos' }, edificio: { b: 'library', name: 'Biblioteca sumergida', techo: 'verdigris' }, tropa: { t: 'cleric', name: 'Acólitos del abismo', col: [30, 80, 90] }, deco: { b: 'estanque', name: 'Pozo abisal', col: [40, 90, 110] }, barco: { name: 'Nautilo' }, efecto: { name: 'Tinta abisal', col: '#4060a0' } },
    volcan: { name: 'Del Volcán', col: [200, 70, 30], heroe: { clase: 'ingeniera', name: 'Forjadora del Volcán', col: [200, 70, 30], acc: 'llamas' }, edificio: { b: 'smelter', name: 'Fundición de obsidiana', techo: 'obsidiana' }, tropa: { t: 'crossbow', name: 'Ballesteros de lava', col: [160, 60, 40] }, deco: { b: 'hoguera', name: 'Brasero de lava', col: [230, 90, 30] }, barco: { name: 'Nave de lava' }, efecto: { name: 'Ceniza ardiente', col: '#ff5020' } },
    oriente: { name: 'Del Lejano Oriente', col: [180, 40, 40], heroe: { clase: 'guarda', name: 'Ronin del Viento', col: [180, 40, 40], acc: 'kasa' }, edificio: { b: 'consejo', name: 'Pagoda del consejo', techo: 'jade' }, tropa: { t: 'monk', name: 'Monjes del dragón', col: [180, 40, 40] }, deco: { b: 'farol', name: 'Linterna de piedra', col: [230, 80, 60] }, barco: { name: 'Junco del dragón' }, efecto: { name: 'Linternas de papel', col: '#ff9050' } },
    imperio: { name: 'Imperial', col: [140, 40, 60], heroe: { clase: 'paladin', name: 'Emperatriz', col: [140, 40, 60], acc: 'corona' }, edificio: { b: 'tc', name: 'Palacio imperial', techo: 'purpura' }, tropa: { t: 'knight', name: 'Guardia imperial', col: [140, 40, 60] }, deco: { b: 'arco', name: 'Arco imperial', col: [220, 190, 120] }, barco: { name: 'Galeón imperial' }, efecto: { name: 'Laureles', col: '#e8d070' } },
    primavera: { name: 'De la Primavera', col: [230, 150, 180], heroe: { clase: 'clerigo', name: 'Doncella de los Cerezos', col: [230, 150, 180], acc: 'flores' }, edificio: { b: 'house', name: 'Casas de los cerezos', techo: 'rosa' }, tropa: { t: 'archer', name: 'Arqueros de la primavera', col: [120, 170, 80] }, deco: { b: 'jardin', name: 'Jardín en flor', col: [240, 170, 200] }, barco: { name: 'Velero de los cerezos' }, efecto: { name: 'Pétalos', col: '#ffb0d0' } },
    sol: { name: 'Del Sol Naciente', col: [230, 170, 40], heroe: { clase: 'paladin', name: 'Paladín del Alba', col: [230, 170, 40], acc: 'diadema_sol' }, edificio: { b: 'monastery', name: 'Templo del sol', techo: 'gilt' }, tropa: { t: 'knight', name: 'Caballeros del alba', col: [220, 170, 60] }, deco: { b: 'estatua', name: 'Disco solar', col: [240, 200, 80] }, barco: { name: 'Nave del alba' }, efecto: { name: 'Rayo de sol', col: '#ffe060' } },
    fiesta: { name: 'De la Gran Fiesta', col: [200, 40, 50], heroe: { clase: 'juglar', name: 'Maestro de Ceremonias', col: [200, 40, 50], acc: 'gorro' }, edificio: { b: 'tavern', name: 'Taberna de fiesta', techo: 'canvasR' }, tropa: { t: 'militia', name: 'Milicia de gala', col: [200, 40, 50] }, deco: { b: 'farol', name: 'Faroles de fiesta', col: [255, 200, 80] }, barco: { name: 'Barco de las luces' }, efecto: { name: 'Fuegos artificiales', col: '#ff4060' } },
  };
  // 26 quincenas al año: el tema de cada una vuelve al año siguiente. El período 0 empieza el lunes 2-11-2026, así que
  // el 8 cae a fines de febrero (carnaval), el 10 en marzo (otoño), el 22 cerca del 18 de septiembre y el 23 en primavera.
  D.CALENDARIO_PASE = ['dragon', 'piratas', 'invierno', 'nomuertos', 'torneo', 'arcana', 'cosecha', 'gremio',
    'carnaval', 'mareas', 'otono', 'bosque', 'mercader', 'desierto', 'luna', 'norte', 'tormenta', 'cristal', 'gigantes',
    'abismo', 'volcan', 'oriente', 'imperio', 'primavera', 'sol', 'fiesta'];
  D.paseTemaId = n => D.CALENDARIO_PASE[((n % 26) + 26) % 26] || null;
  D.paseTema = n => D.PASE_TEMAS[D.paseTemaId(n)] || null;
  // los aspectos de un tema: 'tema:heroe', 'tema:edificio', 'tema:tropa', 'tema:deco', 'tema:barco', 'tema:efecto',
  // 'tema:marco', 'tema:estandarte' y 'tema:heroe2' (la variante de color)
  D.aspecto = id => { const [t, k] = String(id).split(':'), T = D.PASE_TEMAS[t]; return T ? { tema: t, tipo: k, T, o: T[k === 'heroe2' ? 'heroe' : k] || null } : null; };

  // ---------- Premios por nivel ----------
  // R: un paquete de comida, madera, piedra y oro de la era (escala ×1,6 por era, como el servidor).
  const R = (era, k) => { const s = 1000 * Math.pow(1.6, Math.max(1, era) - 1) * k, r = v => Math.round(v / 10) * 10; return { food: r(0.3 * s), wood: r(0.3 * s), stone: r(0.2 * s), gold: r(0.2 * s) }; };
  // nivel: 1..30, o 31..35 para los cofres después del 30. pista: 'g' gratis, 'd' dorada.
  D.pasePremio = function (nivel, pista, era, temaId) {
    const t = temaId || 'dragon', rot = (nivel - 6) % 5, o = {};
    const mezcla = x => { for (const k in x) if (k === 'res') o.res = Object.assign(o.res || {}, x.res); else o[k] = (o[k] || 0) + x[k]; };
    if (nivel > D.PASE.niveles) { if (pista === 'd') mezcla({ res: R(era, 3), gemas: 15, esencia: 30 }); o.txt = 'Cofre del pase'; return o; }
    if (pista === 'g') {
      if (nivel === 30) { mezcla({ res: R(era, 5), gemas: 40, esencia: 50, objeto: 2 }); o.txt = 'Cofre grande'; }
      else if (nivel % 5 === 0 && nivel !== 10 && nivel !== 20) { mezcla({ res: R(era, 3), gemas: 10, esencia: 20 }); o.txt = 'Cofre del pase'; }
      else if (nivel === 10) { mezcla({ objeto: 2 }); o.txt = 'Equipo raro'; }
      else if (nivel === 20) { mezcla({ gemas: 30 }); o.txt = '30 gemas'; }
      else if (nivel === 2) { mezcla({ esencia: 20 }); o.txt = '20 de esencia'; }
      else if (nivel === 4) { mezcla({ res: R(era, 2), gemas: 5 }); o.txt = 'Cofre chico'; }
      else if (nivel < 6) { mezcla({ res: R(era, 1) }); o.txt = 'Recursos'; }
      else if (rot === 0) { mezcla({ res: R(era, 1) }); o.txt = 'Recursos'; }
      else if (rot === 1) { mezcla({ esencia: 20 }); o.txt = '20 de esencia'; }
      else if (rot === 2) { mezcla({ gemas: 10 }); o.txt = '10 gemas'; }
      else { mezcla({ res: R(era, 1), pocion: 1 }); o.txt = 'Recursos y una poción'; }
      return o;
    }
    // pista dorada
    const asp = { 1: 'estandarte', 4: 'marco', 5: 'edificio', 10: 'tropa', 15: 'deco', 20: 'efecto', 25: 'heroe2', 30: 'heroe' }[nivel];
    if (asp) o.aspecto = t + ':' + asp;
    if (asp === 'barco' || nivel === 25) o.aspecto2 = t + ':barco';
    if (nivel === 1) o.txt = 'Estandarte del tema';
    else if (nivel === 2) { mezcla({ res: R(era, 3) }); o.txt = 'Recursos ×3'; }
    else if (nivel === 3) { mezcla({ especial: 10 }); o.txt = '10 recursos especiales'; }
    else if (nivel === 4) o.txt = 'Marco de retrato';
    else if (nivel === 5) { mezcla({ res: R(era, 3) }); o.txt = 'Aspecto de edificio y recursos ×3'; }
    else if (nivel === 10) o.txt = 'Aspecto de tropa';
    else if (nivel === 15) { mezcla({ objeto: 3 }); o.txt = 'Equipo épico y decoración del tema'; }
    else if (nivel === 20) o.txt = 'Efecto de habilidad';
    else if (nivel === 25) o.txt = 'Variante del aspecto de héroe y aspecto de barco';
    else if (nivel === 30) { mezcla({ objeto: 3 }); o.txt = 'Aspecto de héroe exclusivo y equipo épico'; }
    else {
      if (rot === 0) { mezcla({ res: R(era, 3) }); o.txt = 'Recursos ×3'; }
      else if (rot === 1) { mezcla({ esencia: nivel > 15 ? 60 : 40 }); o.txt = (nivel > 15 ? 60 : 40) + ' de esencia'; }
      else if (rot === 2) { mezcla({ objeto: 2 }); o.txt = 'Equipo raro'; }
      else { mezcla({ curar: 1, res: R(era, 1) }); o.txt = 'Cura todas las heridas y recursos'; }
      if (nivel > 10 && nivel < 15) mezcla({ gemas: 10 });
      if (nivel > 20 && nivel < 25) mezcla({ especial: 15 });
      if (nivel > 25 && !o.objeto) mezcla({ objeto: 2 });
    }
    return o;
  };
})();
