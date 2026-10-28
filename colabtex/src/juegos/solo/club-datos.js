/* Categorías nuevas: las puntuaciones antiguas siguen en su archivo. */
export function categoriaClub(juego, categoria) {
  return typeof categoria === 'string' && (juego === 'minas'
    ? /^club-minas-(easy|medium|hard)$/.test(categoria)
    : juego === 'sortem'
    ? /^club-sortem-(10|20)$/.test(categoria)
    : juego === 'bbtan'
    ? categoria === 'club-bbtan-rondas'
    : juego === 'sopa'
    ? /^club-sopa-(racha|(facil|medio|dificil)-(8|12|15))$/.test(categoria)
    : juego === 'electro'
    ? /^club-electro-(racha|puntos)$/.test(categoria)
    : juego === 'integral'
    ? /^club-integral-(racha|puntos)$/.test(categoria)
    : juego === 'frontera'
    ? /^club-frontera-((torre|palacio|fabrica)-(50|abierto)|victorias)$/.test(categoria)
    // Sudoku Arcade: la racha del diario, el arcade por puntos y el
    // clásico en sus cuatro dificultades (este último, por tiempo).
    : juego === 'sudoku'
    ? /^club-sudoku-(racha|arcade|facil|medio|dificil|experto)$/.test(categoria)
    // FANAL: la travesía (puntos), el sin fin (puntos) y la jornada más
    // lejana a la que se llegó (jornadas completadas).
    : juego === 'fanal'
    ? /^club-fanal-(travesia|sinfin|jornadas)$/.test(categoria)
    // Atasco: una sola tabla, las estrellas juntadas en todos los niveles.
    : juego === 'atasco'
    ? categoria === 'club-atasco-estrellas'
    // ALETEO: una sola tabla, los tubos pasados en el mejor vuelo.
    : juego === 'aleteo'
    ? categoria === 'club-aleteo-vuelo'
    // 2048: el mejor puntaje y la ficha más alta.
    : juego === 'dosmil'
    ? /^club-dosmil-(puntos|ficha)$/.test(categoria)
    // Trigon: una sola tabla, el puntaje de la partida.
    : juego === 'trigon'
    ? categoria === 'club-trigon-puntos'
    // PRO TILES: un top por canción y otro para la mezcla de las ocho.
    : juego === 'protiles'
    ? /^club-protiles-(cristal|medianoche|calle|verano|neon|latido|estrellas|despegue|mezcla)$/.test(categoria)
    // Pokelike: el puntaje de la run y las especies distintas atrapadas en ella.
    : juego === 'pokelike'
    ? /^club-pokelike-(puntos|pokedex)$/.test(categoria)
    // Metro Rush: la mejor carrera de cada modo normal (carrera es el clásico; puro,
    // sinmonedas, city y citypuro, los otros) y la carrera más larga de cada mundo
    // (distancia la Línea 3, citydistancia City; ahí van también los modos fantasma,
    // que ya no tienen tabla de puntos: sus filas viejas se ven, pero no entran nuevas).
    // PRO HERO: una sola tabla, la general por estrellas (juegos/hero.js).
    : juego === 'hero'
    ? categoria === 'club-hero-estrellas'
    // PRO PACMAN: una sola tabla, el puntaje de la partida.
    : juego === 'propac'
    ? categoria === 'club-propac-puntos'
    // PRO DEFENDER: la ronda récord de cada uno de los quince reinos.
    : juego === 'prodefender'
    ? /^club-prodefender-(prado|dunas|glaciar|caldera|vacio|pantano|cumbres|fosa|engranajes|eclipse|necropolis|esporas|espejos|archipielago|noche)$/.test(categoria)
    : juego === 'metrorush'
    ? /^club-metrorush-(carrera|distancia|citydistancia|puro|sinmonedas|city|citypuro)$/.test(categoria)
    : juego === 'tetris'
    ? /^club-tetris-(maraton|sprint|ultra)$/.test(categoria)
    : /^club-snake-(classic|arcade|portals|reloj|espejo|laberinto)-(chico|mediano|grande|gigante)$/.test(categoria));
}
export function resultadoClub(juego, dato) {
  if (!dato || !categoriaClub(juego, dato.categoria) || !Number.isSafeInteger(dato.puntos) || dato.puntos < 1 || dato.puntos > 1e9 ||
    !Number.isSafeInteger(dato.tiempo) || dato.tiempo < 1 || dato.tiempo > 604800000 ||
    typeof dato.partida !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(dato.partida)) return null;
  if (juego === 'minas' && dato.puntos !== 1) return null;
  if (juego === 'sortem' && dato.puntos !== Number(dato.categoria.slice(12))) return null;
  if (dato.categoria === 'club-tetris-sprint' && dato.puntos !== 40) return null;
  /* Sopa libre: los puntos son las palabras de ese tamaño (6, 10 o 13) y
     compite el tiempo; la racha diaria son días, no más de dos años. */
  if (juego === 'sopa' && dato.categoria !== 'club-sopa-racha' && dato.puntos !== {8:6,12:10,15:13}[dato.categoria.split('-').pop()]) return null;
  if (dato.categoria === 'club-sopa-racha' && dato.puntos > 1000) return null;
  /* Electrodle: la racha son días (dos años como mucho) y los puntos, la
     suma de los siete modos diarios (700 por día, a lo más). */
  if (dato.categoria === 'club-electro-racha' && dato.puntos > 1000) return null;
  if (dato.categoria === 'club-electro-puntos' && dato.puntos > 1000000) return null;
  /* Integrodle: lo mismo, con 120 puntos por día a lo más. */
  if (dato.categoria === 'club-integral-racha' && dato.puntos > 1000) return null;
  if (dato.categoria === 'club-integral-puntos' && dato.puntos > 1000000) return null;
  /* Sudoku Arcade: en el clásico compite el tiempo, así que los puntos
     valen 1 fijo (como en Mina Club); la racha son días (dos años como
     mucho) y el arcade, una puntuación con tope 1 000 000. */
  if (juego === 'sudoku' && /^club-sudoku-(facil|medio|dificil|experto)$/.test(dato.categoria) && dato.puntos !== 1) return null;
  if (dato.categoria === 'club-sudoku-racha' && dato.puntos > 1000) return null;
  if (dato.categoria === 'club-sudoku-arcade' && dato.puntos > 1000000) return null;
  /* FANAL: los puntos de una travesía hasta 1 000 000 000 (con el millón
     de antes la tabla se llenó de empates y no entraba nada nuevo); los del
     sin fin, que ya no recibe marcas, hasta 1 000 000; las jornadas, con el
     tope común de 100 000. */
  if (dato.categoria === 'club-fanal-travesia' && dato.puntos > 1000000000) return null;
  if (dato.categoria === 'club-fanal-sinfin' && dato.puntos > 1000000) return null;
  if (dato.categoria === 'club-fanal-jornadas' && dato.puntos > 100000) return null;
  /* Atasco: tres estrellas por nivel; 3000 deja sitio para más pisos
     sin aceptar números absurdos (hoy son 240 niveles, 720 estrellas). */
  if (juego === 'atasco' && dato.puntos > 3000) return null;
  /* ALETEO: tubos de un vuelo, con el tope de su verificador. */
  if (juego === 'aleteo' && dato.puntos > 100000) return null;
  /* 2048: el puntaje, hasta 4 000 000; la ficha, una potencia de 2 hasta 262 144. */
  if (dato.categoria === 'club-dosmil-puntos' && dato.puntos > 4000000) return null;
  if (dato.categoria === 'club-dosmil-ficha' && (dato.puntos > 262144 || (dato.puntos & (dato.puntos - 1)) !== 0)) return null;
  /* Trigon: el puntaje, hasta 1 000 000 (la racha multiplica el bono). */
  if (dato.categoria === 'club-trigon-puntos' && dato.puntos > 1000000) return null;
  /* PRO TILES: notas más bonos de las largas, con el tope de su verificador. */
  if (juego === 'protiles' && dato.puntos > 1000000) return null;
  /* Pokelike: el puntaje (la Ruta Infinita no tiene techo; el de la regla
     es 1 000 000) y las especies de Kanto, 151 como mucho. */
  if (dato.categoria === 'club-pokelike-puntos' && dato.puntos > 1000000) return null;
  if (dato.categoria === 'club-pokelike-pokedex' && dato.puntos > 151) return null;
  /* Metro Rush: una carrera pasa del millón de puntos sin esfuerzo, así que
     su tope es el de la regla (1 000 000 000); la distancia son metros,
     hasta 1 000 000 (mil kilómetros en una carrera). */
  if (/^club-metrorush-(carrera|puro|sinmonedas|fantasma|city|citypuro|cityfantasma)$/.test(dato.categoria) && dato.puntos > 1000000000) return null;   // los puntos de cualquier modo
  if (/^club-metrorush-(city)?distancia$/.test(dato.categoria) && dato.puntos > 1000000) return null;   // la distancia de cada mundo
  /* Frontera: la racha y las victorias son combates; 100 000 es el tope
     de la regla. */
  if (juego === 'frontera' && dato.puntos > 100000) return null;
  /* PRO HERO: doradas·10 000 + todas (hero.js: codificaHero), con la parte
     de todas por debajo de 10 000 y nunca menor que las doradas. */
  if (juego === 'hero' && (dato.puntos % 10000 < Math.floor(dato.puntos / 10000))) return null;
  /* PRO DEFENDER: rondas superadas, y un reino tiene cien. */
  if (juego === 'prodefender' && dato.puntos > 100) return null;
  /* PRO PACMAN: el puntaje, con el tope de su verificador (10 000 000). */
  if (juego === 'propac' && dato.puntos > 10000000) return null;
  return {categoria:dato.categoria,puntos:dato.puntos,tiempo:dato.tiempo,partida:dato.partida};
}
export const mejorClub = (a,b) => !b || a.puntos > b.puntos || a.puntos === b.puntos && a.tiempo < b.tiempo;

/* Las rachas diarias (Sopa, Sudoku, Electrodle) no se creen al juego: el
   número sale del blob que escribe el propio usuario. La cuenta buena es
   `rachasClub/<uid>/<categoría>` = {dia, n, at}, que las reglas solo dejan
   subir de a uno por día de Chile (como el `diario` de las monedas), y la
   fila de la tabla no puede pasar de `n`.

   `rachaClub(prev, dia, previa)` dice qué escribir hoy: null si ya se
   apuntó (se usa `prev.n`), o el registro nuevo. Si no había registro, la
   racha arranca en 1, o sigue la que ya estaba en la tabla (`previa`, los
   puntos de la fila guardada) + 1: así nadie honesto pierde la racha que
   traía al estrenar esto. La regla acepta lo mismo. */
export const esRachaClub = c => /^club-(sopa|sudoku|electro|integral)-racha$/.test(String(c || ''));
export function rachaClub(prev, dia, previa) {
  if (prev && Number.isInteger(prev.dia) && Number.isInteger(prev.n)) {
    if (dia <= prev.dia) return null;
    return {dia, n: dia === prev.dia + 1 ? prev.n + 1 : 1};
  }
  const antes = Number.isSafeInteger(previa) && previa > 0 ? Math.min(previa, 1000) : 0;
  return {dia, n: antes + 1};
}
