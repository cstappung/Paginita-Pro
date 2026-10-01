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
     suma de los desafíos diarios (400 por día, a lo más). */
  if (dato.categoria === 'club-electro-racha' && dato.puntos > 1000) return null;
  if (dato.categoria === 'club-electro-puntos' && dato.puntos > 1000000) return null;
  return {categoria:dato.categoria,puntos:dato.puntos,tiempo:dato.tiempo,partida:dato.partida};
}
export const mejorClub = (a,b) => !b || a.puntos > b.puntos || a.puntos === b.puntos && a.tiempo < b.tiempo;
