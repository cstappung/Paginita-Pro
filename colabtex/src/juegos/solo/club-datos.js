/* Categorías nuevas: las puntuaciones antiguas siguen en su archivo. */
export function categoriaClub(juego, categoria) {
  return typeof categoria === 'string' && (juego === 'minas'
    ? /^club-minas-(easy|medium|hard)$/.test(categoria)
    : /^club-snake-(classic|arcade|portals)-(chill|normal|fast)$/.test(categoria));
}
export function resultadoClub(juego, dato) {
  if (!dato || !categoriaClub(juego, dato.categoria) || !Number.isSafeInteger(dato.puntos) || dato.puntos < 1 || dato.puntos > 1e9 ||
    !Number.isSafeInteger(dato.tiempo) || dato.tiempo < 1 || dato.tiempo > 604800000 ||
    typeof dato.partida !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(dato.partida)) return null;
  if (juego === 'minas' && dato.puntos !== 1) return null;
  return {categoria:dato.categoria,puntos:dato.puntos,tiempo:dato.tiempo,partida:dato.partida};
}
export const mejorClub = (a,b) => !b || a.puntos > b.puntos || a.puntos === b.puntos && a.tiempo < b.tiempo;
