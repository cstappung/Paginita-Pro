/* Pokelike — tablas del juego escritas a mano: tipos, movimientos, zonas,
   entrenadores y gimnasio. Las especies vienen aparte, en especies.js
   (generado). Todo es dato puro: el motor (motor.js) decide con esto. */
(function (raiz) {
  // Tabla de tipos moderna (Gen 6+). Por tipo atacante: x2, x½ y x0.
  const TABLA = {
    Normal:    { x2: [], x05: ['Roca', 'Acero'], x0: ['Fantasma'] },
    Fuego:     { x2: ['Planta', 'Hielo', 'Bicho', 'Acero'], x05: ['Fuego', 'Agua', 'Roca', 'Dragón'], x0: [] },
    Agua:      { x2: ['Fuego', 'Tierra', 'Roca'], x05: ['Agua', 'Planta', 'Dragón'], x0: [] },
    Planta:    { x2: ['Agua', 'Tierra', 'Roca'], x05: ['Fuego', 'Planta', 'Veneno', 'Volador', 'Bicho', 'Dragón', 'Acero'], x0: [] },
    'Eléctrico': { x2: ['Agua', 'Volador'], x05: ['Eléctrico', 'Planta', 'Dragón'], x0: ['Tierra'] },
    Hielo:     { x2: ['Planta', 'Tierra', 'Volador', 'Dragón'], x05: ['Fuego', 'Agua', 'Hielo', 'Acero'], x0: [] },
    Lucha:     { x2: ['Normal', 'Hielo', 'Roca', 'Siniestro', 'Acero'], x05: ['Veneno', 'Volador', 'Psíquico', 'Bicho', 'Hada'], x0: ['Fantasma'] },
    Veneno:    { x2: ['Planta', 'Hada'], x05: ['Veneno', 'Tierra', 'Roca', 'Fantasma'], x0: ['Acero'] },
    Tierra:    { x2: ['Fuego', 'Eléctrico', 'Veneno', 'Roca', 'Acero'], x05: ['Planta', 'Bicho'], x0: ['Volador'] },
    Volador:   { x2: ['Planta', 'Lucha', 'Bicho'], x05: ['Eléctrico', 'Roca', 'Acero'], x0: [] },
    'Psíquico': { x2: ['Lucha', 'Veneno'], x05: ['Psíquico', 'Acero'], x0: ['Siniestro'] },
    Bicho:     { x2: ['Planta', 'Psíquico', 'Siniestro'], x05: ['Fuego', 'Lucha', 'Veneno', 'Volador', 'Fantasma', 'Acero', 'Hada'], x0: [] },
    Roca:      { x2: ['Fuego', 'Hielo', 'Volador', 'Bicho'], x05: ['Lucha', 'Tierra', 'Acero'], x0: [] },
    Fantasma:  { x2: ['Psíquico', 'Fantasma'], x05: ['Siniestro'], x0: ['Normal'] },
    'Dragón':  { x2: ['Dragón'], x05: ['Acero'], x0: ['Hada'] },
    Siniestro: { x2: ['Psíquico', 'Fantasma'], x05: ['Lucha', 'Siniestro', 'Hada'], x0: [] },
    Acero:     { x2: ['Hielo', 'Roca', 'Hada'], x05: ['Fuego', 'Agua', 'Eléctrico', 'Acero'], x0: [] },
    Hada:      { x2: ['Lucha', 'Dragón', 'Siniestro'], x05: ['Fuego', 'Veneno', 'Acero'], x0: [] },
  };

  const COLOR_TIPO = {
    Normal: '#a8a77a', Fuego: '#ee8130', Agua: '#6390f0', Planta: '#7ac74c', 'Eléctrico': '#f7d02c',
    Hielo: '#96d9d6', Lucha: '#c22e28', Veneno: '#a33ea1', Tierra: '#e2bf65', Volador: '#a98ff3',
    'Psíquico': '#f95587', Bicho: '#a6b91a', Roca: '#b6a136', Fantasma: '#735797', 'Dragón': '#6f35fc',
    Siniestro: '#705746', Acero: '#b7b7ce', Hada: '#d685ad',
  };

  /* Movimientos simplificados: solo de daño, cuatro escalones por tipo.
     El escalón k se aprende al llegar a NIVEL_ESCALON[k]. Físico o especial
     no depende del movimiento: el Pokémon pega con su mejor stat ofensiva
     (como pokelike), así cualquier especie usa bien los de su tipo. */
  const NIVEL_ESCALON = [1, 12, 25, 40];
  const MOVS = {
    Normal:    [['Placaje', 40, 100], ['Golpe Cabeza', 70, 100], ['Golpe Cuerpo', 85, 100], ['Hiperrayo', 120, 85]],
    Fuego:     [['Ascuas', 40, 100], ['Colmillo Ígneo', 65, 95], ['Lanzallamas', 90, 100], ['Llamarada', 110, 85]],
    Agua:      [['Pistola Agua', 40, 100], ['Rayo Burbuja', 65, 100], ['Surf', 90, 100], ['Hidrobomba', 110, 80]],
    Planta:    [['Látigo Cepa', 45, 100], ['Hoja Afilada', 60, 95], ['Energibola', 90, 100], ['Rayo Solar', 120, 85]],
    'Eléctrico': [['Impactrueno', 40, 100], ['Chispa', 65, 100], ['Rayo', 90, 100], ['Trueno', 110, 75]],
    Hielo:     [['Nieve Polvo', 40, 100], ['Colmillo Hielo', 65, 95], ['Rayo Hielo', 90, 100], ['Ventisca', 110, 75]],
    Lucha:     [['Golpe Karate', 50, 100], ['Patada Baja', 65, 100], ['Sumisión', 80, 90], ['A Bocajarro', 120, 85]],
    Veneno:    [['Picotazo Veneno', 40, 100], ['Ácido', 55, 100], ['Bomba Lodo', 90, 100], ['Lanzamugre', 120, 80]],
    Tierra:    [['Bofetón Lodo', 40, 100], ['Disparo Lodo', 55, 95], ['Excavar', 80, 100], ['Terremoto', 100, 100]],
    Volador:   [['Picotazo', 40, 100], ['Ataque Ala', 60, 100], ['Pico Taladro', 80, 100], ['Pájaro Osado', 120, 90]],
    'Psíquico': [['Confusión', 50, 100], ['Psicorrayo', 65, 100], ['Psíquico', 90, 100], ['Premonición', 120, 85]],
    Bicho:     [['Picadura', 40, 100], ['Doble Ataque', 60, 100], ['Tijera X', 80, 100], ['Zumbido', 90, 100]],
    Roca:      [['Lanzarrocas', 50, 90], ['Tumba Rocas', 60, 95], ['Avalancha', 75, 90], ['Roca Afilada', 100, 80]],
    Fantasma:  [['Lengüetazo', 40, 100], ['Puño Sombra', 60, 100], ['Bola Sombra', 80, 100], ['Golpe Fantasma', 100, 90]],
    'Dragón':  [['Ciclón', 40, 100], ['Dragoaliento', 60, 100], ['Garra Dragón', 80, 100], ['Enfado', 120, 90]],
    Siniestro: [['Mordisco', 50, 100], ['Alarido', 55, 95], ['Triturar', 80, 100], ['Juego Sucio', 95, 100]],
    Acero:     [['Garra Metal', 50, 95], ['Puño Bala', 60, 100], ['Cabeza de Hierro', 80, 100], ['Cola Férrea', 100, 75]],
    Hada:      [['Viento Feérico', 40, 100], ['Beso Drenaje', 50, 100], ['Brillo Mágico', 80, 100], ['Fuerza Lunar', 95, 100]],
  };

  /* Tipo de cobertura: un movimiento extra de otro tipo para especies que lo
     aprenden en los juegos (Charmander y Garra Metal) y que, sin él, no
     tendrían cómo pelear contra su peor rival. */
  const COBERTURA = { 4: 'Acero', 5: 'Acero', 6: 'Acero' };

  const INICIALES = [1, 4, 7];
  const NIVEL_INICIAL = 5;

  /* Kanto en nueve tramos: ocho gimnasios y la Liga. Cada tramo es un mapa.
     - zonas: de arriba abajo; `desde` es la fracción de profundidad del mapa
       (0 = arriba, 1 = jefe) desde la que manda la zona; `nv` el rango de
       niveles (dentro de la zona sube con la profundidad); `p` especies con
       peso. Una especie con nivel de sobra sale ya evolucionada (motor).
     - raros: lo que puede salir en un nodo de captura además de la zona.
     - clases: entrenadores posibles (sprite de Showdown, nombre, especies).
     - jefes: uno en cada gimnasio; cinco seguidos en la Liga. */
  const C = (sprite, clase, p) => ({ sprite, clase, p });
  const TRAMOS = [
    { // 0 · Brock
      zonas: [
        { nombre: 'Ruta 1', desde: 0, nv: [2, 4], p: { 16: 5, 19: 5 } },
        { nombre: 'Ruta 22', desde: 0.25, nv: [3, 6], p: { 19: 3, 21: 3, 29: 2, 32: 2, 56: 2 } },
        { nombre: 'Bosque Verde', desde: 0.45, nv: [5, 8], p: { 10: 3, 13: 3, 11: 2, 14: 2, 16: 2, 25: 1 } },
        { nombre: 'Ruta 2', desde: 0.7, nv: [7, 10], p: { 21: 3, 23: 2, 27: 2, 39: 2, 35: 1, 56: 2 } },
      ],
      raros: { 25: 3, 35: 2, 37: 2, 58: 2, 63: 1, 133: 1, 147: 1 },
      clases: [C('youngster', 'Joven', [19, 21, 23, 27]), C('lass', 'Chica', [16, 29, 39, 35]),
        C('bugcatcher', 'Cazabichos', [10, 13, 11, 14]), C('camper', 'Campista', [32, 56, 27, 74])],
      jefes: [{ nombre: 'Brock', titulo: 'Líder del Gimnasio Plateada', sprite: 'brock', medalla: 'Medalla Roca', color: '#a8a8a8',
        lugar: 'Gimnasio Plateada', equipo: [[74, 12], [95, 13]] }],
    },
    { // 1 · Misty
      zonas: [
        { nombre: 'Ruta 3', desde: 0, nv: [9, 12], p: { 21: 3, 23: 2, 27: 2, 39: 2, 56: 2, 19: 2 } },
        { nombre: 'Mt. Moon', desde: 0.3, nv: [10, 14], p: { 41: 4, 74: 3, 46: 2, 35: 1, 27: 1 } },
        { nombre: 'Ruta 24', desde: 0.65, nv: [12, 17], p: { 43: 3, 69: 3, 63: 2, 48: 2, 16: 2, 54: 1 } },
      ],
      raros: { 35: 2, 63: 2, 147: 1, 133: 1, 104: 2, 138: 1, 140: 1 },
      clases: [C('hiker', 'Montañero', [74, 66, 95, 41]), C('swimmer', 'Nadador', [72, 118, 60, 116]),
        C('lass', 'Chica', [35, 39, 43, 29]), C('youngster', 'Joven', [19, 21, 23, 56])],
      jefes: [{ nombre: 'Misty', titulo: 'Líder del Gimnasio Celeste', sprite: 'misty', medalla: 'Medalla Cascada', color: '#4fa3ff',
        lugar: 'Gimnasio Celeste', equipo: [[120, 17], [54, 16], [121, 18]] }],
    },
    { // 2 · Teniente Surge
      zonas: [
        { nombre: 'Ruta 5', desde: 0, nv: [14, 17], p: { 52: 3, 43: 2, 69: 2, 16: 2, 56: 2 } },
        { nombre: 'Cueva Diglett', desde: 0.3, nv: [15, 19], p: { 50: 5, 51: 1, 74: 2 } },
        { nombre: 'Ruta 11', desde: 0.6, nv: [17, 22], p: { 96: 3, 23: 2, 27: 2, 21: 2, 98: 2, 60: 2 } },
      ],
      raros: { 25: 2, 58: 2, 37: 2, 79: 2, 83: 2, 133: 1, 129: 2 },
      clases: [C('sailor', 'Marinero', [66, 72, 60, 98]), C('gentleman', 'Caballero', [58, 52, 37, 28]),
        C('supernerd', 'Supernecio', [100, 81, 88, 109]), C('camper', 'Campista', [27, 56, 32, 30])],
      jefes: [{ nombre: 'Teniente Surge', titulo: 'Líder del Gimnasio Carmín', sprite: 'ltsurge', medalla: 'Medalla Trueno', color: '#f7d02c',
        lugar: 'Gimnasio Carmín', equipo: [[100, 24], [25, 25], [82, 24], [26, 28]] }],
    },
    { // 3 · Erika
      zonas: [
        { nombre: 'Ruta 9', desde: 0, nv: [20, 23], p: { 19: 2, 21: 2, 23: 2, 27: 2, 100: 2, 22: 1 } },
        { nombre: 'Túnel Roca', desde: 0.3, nv: [21, 25], p: { 41: 3, 74: 3, 66: 3, 95: 1, 104: 2 } },
        { nombre: 'Torre Pokémon', desde: 0.6, nv: [23, 28], p: { 92: 5, 104: 2, 93: 1 } },
      ],
      raros: { 58: 2, 37: 2, 133: 1, 147: 1, 123: 1, 127: 1, 131: 1 },
      clases: [C('picnicker', 'Excursionista', [43, 69, 30, 35]), C('hiker', 'Montañero', [74, 75, 95, 66]),
        C('psychic', 'Médium', [92, 93, 96, 64]), C('pokemaniac', 'Pokémaníaco', [104, 111, 79, 27])],
      jefes: [{ nombre: 'Erika', titulo: 'Líder del Gimnasio Azulona', sprite: 'erika', medalla: 'Medalla Arcoíris', color: '#7ac74c',
        lugar: 'Gimnasio Azulona', equipo: [[114, 31], [70, 32], [44, 31], [71, 34], [45, 35]] }],
    },
    { // 4 · Koga
      zonas: [
        { nombre: 'Ruta 12', desde: 0, nv: [25, 29], p: { 43: 2, 69: 2, 44: 1, 70: 1, 48: 2, 60: 2 } },
        { nombre: 'Ruta 15', desde: 0.3, nv: [27, 31], p: { 84: 3, 49: 2, 33: 2, 30: 2, 17: 2 } },
        { nombre: 'Zona Safari', desde: 0.6, nv: [29, 34], p: { 102: 2, 111: 2, 115: 1, 123: 1, 127: 1, 128: 1, 113: 1, 84: 2, 32: 2 } },
      ],
      raros: { 143: 2, 147: 2, 113: 1, 115: 2, 123: 2, 127: 2, 131: 1 },
      clases: [C('biker', 'Motorista', [109, 88, 89, 110]), C('juggler', 'Malabarista', [96, 97, 100, 109]),
        C('birdkeeper', 'Ornitólogo', [17, 22, 84, 85]), C('fisherman', 'Pescador', [118, 119, 60, 72])],
      jefes: [{ nombre: 'Koga', titulo: 'Líder del Gimnasio Fucsia', sprite: 'koga', medalla: 'Medalla Alma', color: '#a33ea1',
        lugar: 'Gimnasio Fucsia', equipo: [[109, 40], [42, 40], [89, 41], [49, 41], [110, 45]] }],
    },
    { // 5 · Sabrina
      zonas: [
        { nombre: 'Ruta 16', desde: 0, nv: [30, 34], p: { 20: 2, 84: 2, 22: 2, 79: 2 } },
        { nombre: 'Silph S.A.', desde: 0.3, nv: [32, 36], p: { 20: 2, 24: 2, 42: 2, 110: 2, 89: 1, 64: 1, 97: 2 } },
        { nombre: 'Ruta 19', desde: 0.6, nv: [33, 38], p: { 72: 3, 73: 1, 90: 2, 116: 2, 118: 2, 119: 1, 120: 2 } },
      ],
      raros: { 131: 2, 64: 2, 122: 2, 133: 1, 147: 1, 124: 1, 125: 1, 126: 1 },
      clases: [C('psychic', 'Médium', [64, 96, 97, 122]), C('teamrocket', 'Recluta Rocket', [24, 42, 89, 110]),
        C('swimmer', 'Nadador', [72, 73, 90, 119]), C('scientist', 'Científico', [81, 82, 100, 101])],
      jefes: [{ nombre: 'Sabrina', titulo: 'Líder del Gimnasio Azafrán', sprite: 'sabrina', medalla: 'Medalla Pantano', color: '#f95587',
        lugar: 'Gimnasio Azafrán', equipo: [[64, 42], [122, 42], [49, 42], [97, 43], [65, 47]] }],
    },
    { // 6 · Blaine
      zonas: [
        { nombre: 'Islas Espuma', desde: 0, nv: [35, 39], p: { 86: 3, 87: 1, 79: 2, 80: 1, 42: 2, 98: 2, 99: 1 } },
        { nombre: 'Mansión Pokémon', desde: 0.35, nv: [37, 42], p: { 109: 2, 110: 1, 88: 2, 89: 1, 77: 2, 58: 2, 37: 2 } },
        { nombre: 'Isla Canela', desde: 0.7, nv: [39, 44], p: { 78: 2, 126: 2, 59: 1, 38: 1, 124: 1 } },
      ],
      raros: { 131: 2, 138: 2, 140: 2, 142: 1, 147: 1, 148: 1, 133: 1, 144: 1 },
      clases: [C('burglar', 'Ladrón', [58, 37, 77, 126]), C('scientist', 'Científico', [109, 110, 81, 82]),
        C('swimmer', 'Nadador', [86, 87, 117, 121]), C('kindler', 'Pirómano', [58, 77, 126, 5])],
      jefes: [{ nombre: 'Blaine', titulo: 'Líder del Gimnasio Canela', sprite: 'blaine', medalla: 'Medalla Volcán', color: '#ee8130',
        lugar: 'Gimnasio Canela', equipo: [[58, 45], [77, 44], [126, 46], [78, 46], [59, 50]] }],
    },
    { // 7 · Giovanni
      zonas: [
        { nombre: 'Ruta 21', desde: 0, nv: [40, 44], p: { 114: 3, 72: 2, 73: 2, 20: 2, 17: 2 } },
        { nombre: 'Ruta 23', desde: 0.35, nv: [42, 46], p: { 22: 2, 24: 2, 28: 2, 33: 2, 30: 2, 57: 2 } },
        { nombre: 'Ciudad Verde', desde: 0.7, nv: [44, 49], p: { 105: 2, 67: 2, 75: 2, 49: 2, 125: 1, 34: 1, 31: 1 } },
      ],
      raros: { 143: 2, 131: 2, 142: 2, 147: 1, 148: 1, 145: 1, 146: 1, 133: 1 },
      clases: [C('blackbelt', 'Karateka', [56, 57, 66, 67]), C('acetrainer', 'Entrenador Guay', [5, 8, 2, 25]),
        C('acetrainerf', 'Entrenadora Guay', [36, 40, 121, 26]), C('teamrocket', 'Recluta Rocket', [24, 42, 110, 20])],
      jefes: [{ nombre: 'Giovanni', titulo: 'Líder del Gimnasio Verde', sprite: 'giovanni', medalla: 'Medalla Tierra', color: '#e2bf65',
        lugar: 'Gimnasio Verde', equipo: [[111, 48], [51, 47], [105, 48], [31, 49], [34, 49], [112, 53]] }],
    },
    { // 8 · Liga Pokémon: cinco jefes seguidos, sin centro entre ellos
      liga: true,
      zonas: [
        { nombre: 'Calle Victoria', desde: 0, nv: [46, 52], p: { 67: 2, 75: 2, 95: 2, 42: 2, 105: 2, 49: 1, 64: 1 } },
        { nombre: 'Meseta Añil', desde: 0.5, nv: [50, 55], p: { 68: 1, 76: 1, 112: 1, 130: 1, 131: 1 } },
      ],
      raros: { 144: 2, 145: 2, 146: 2, 149: 1, 131: 2, 143: 2, 150: 1 },
      clases: [C('acetrainer', 'Entrenador Guay', [6, 9, 3, 26, 59]), C('acetrainerf', 'Entrenadora Guay', [36, 40, 121, 134, 135, 136]),
        C('veteran', 'Veterano', [112, 68, 130, 76]), C('dragontamer', 'Domadragón', [148, 130, 142, 6])],
      jefes: [
        { nombre: 'Lorelei', titulo: 'Alto Mando', sprite: 'lorelei', lugar: 'Liga Pokémon', equipo: [[87, 51], [91, 50], [80, 51], [124, 52], [131, 53]] },
        { nombre: 'Bruno', titulo: 'Alto Mando', sprite: 'bruno', lugar: 'Liga Pokémon', equipo: [[95, 51], [107, 52], [106, 52], [95, 53], [68, 54]] },
        { nombre: 'Agatha', titulo: 'Alto Mando', sprite: 'agatha', lugar: 'Liga Pokémon', equipo: [[94, 52], [42, 52], [93, 52], [24, 54], [94, 55]] },
        { nombre: 'Lance', titulo: 'Alto Mando', sprite: 'lance', lugar: 'Liga Pokémon', equipo: [[130, 54], [148, 53], [148, 53], [142, 55], [149, 57]] },
        { nombre: 'Azul', titulo: 'Campeón de la Liga', sprite: 'blue', lugar: 'Liga Pokémon', campeon: true,
          // Cierra con el inicial que le gana al tuyo (lo agrega el motor).
          equipo: [[18, 56], [65, 55], [112, 56], [103, 56], [59, 57]], contraInicial: { 1: 6, 4: 9, 7: 3 }, nvInicial: 59 },
      ],
    },
  ];

  const DATOS = { TABLA, COLOR_TIPO, NIVEL_ESCALON, MOVS, COBERTURA, INICIALES, NIVEL_INICIAL, TRAMOS };
  if (typeof module === 'object' && module.exports) module.exports = DATOS;
  else raiz.PokelikeDatos = DATOS;
})(typeof self !== 'undefined' ? self : this);
