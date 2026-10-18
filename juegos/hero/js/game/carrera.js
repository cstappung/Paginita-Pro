// La carrera de una sala: el puntaje de cada uno a lo largo de la canción.
// session.js la anota, viaja con el resultado (`cv` en la jugada `fin`, motor.js)
// y results.js la dibuja. Puro, para tests/hero.test.cjs.

// Cuántos puntos tiene: el i-ésimo es el puntaje al llegar a (i+1)/CURVA_N de song.endTime
export const CURVA_N = 60;

// Tramos [{s, i, j}]: `s` iba primero desde el punto i hasta antes del j.
// En un empate sigue el que iba; antes del primer punto nadie (todo en 0).
export function lideres(series, n = CURVA_N) {
  const tramos = [];
  let antes = null;
  for (let i = 0; i < n; i++) {
    const vivos = series.filter((x) => i < x.curva.length);
    if (!vivos.length) break;
    const max = Math.max(...vivos.map((x) => x.curva[i]));
    if (max <= 0) continue;
    const top = vivos.filter((x) => x.curva[i] === max);
    const lider = top.includes(antes) ? antes : top[0];
    const ult = tramos[tramos.length - 1];
    if (ult && ult.s === lider && ult.j === i) ult.j = i + 1;
    else tramos.push({ s: lider, i, j: i + 1 });
    antes = lider;
  }
  return tramos;
}
