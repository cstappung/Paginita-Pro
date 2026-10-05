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
    // Metro Rush: la mejor carrera (puntos) y la carrera más larga (metros).
    : juego === 'metrorush'
    ? /^club-metrorush-(carrera|distancia)$/.test(categoria)
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
  /* Sudoku Arcade: en el clásico compite el tiempo, así que los puntos
     valen 1 fijo (como en Mina Club); la racha son días (dos años como
     mucho) y el arcade, una puntuación con tope 1 000 000. */
  if (juego === 'sudoku' && /^club-sudoku-(facil|medio|dificil|experto)$/.test(dato.categoria) && dato.puntos !== 1) return null;
  if (dato.categoria === 'club-sudoku-racha' && dato.puntos > 1000) return null;
  if (dato.categoria === 'club-sudoku-arcade' && dato.puntos > 1000000) return null;
  /* FANAL: los puntos de una travesía (o del sin fin) con tope 1 000 000,
     como el arcade del sudoku; las jornadas, con el tope común de 100 000. */
  if (juego === 'fanal' && dato.categoria !== 'club-fanal-jornadas' && dato.puntos > 1000000) return null;
  if (dato.categoria === 'club-fanal-jornadas' && dato.puntos > 100000) return null;
  /* Atasco: tres estrellas por nivel; 3000 deja sitio para más pisos
     sin aceptar números absurdos (hoy son 240 niveles, 720 estrellas). */
  if (juego === 'atasco' && dato.puntos > 3000) return null;
  /* Metro Rush: una carrera pasa del millón de puntos sin esfuerzo, así que
     su tope es el de la regla (1 000 000 000); la distancia son metros,
     hasta 1 000 000 (mil kilómetros en una carrera). */
  if (dato.categoria === 'club-metrorush-carrera' && dato.puntos > 1000000000) return null;
  if (dato.categoria === 'club-metrorush-distancia' && dato.puntos > 1000000) return null;
  /* Frontera: la racha y las victorias son combates; 100 000 es el tope
     de la regla. */
  if (juego === 'frontera' && dato.puntos > 100000) return null;
  return {categoria:dato.categoria,puntos:dato.puntos,tiempo:dato.tiempo,partida:dato.partida};
}
export const mejorClub = (a,b) => !b || a.puntos > b.puntos || a.puntos === b.puntos && a.tiempo < b.tiempo;
