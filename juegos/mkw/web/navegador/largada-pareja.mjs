// §250: la LARGADA PAREJA vista desde las pruebas con el juego (prueba-sincro, prueba-relevo, prueba-doce).
//
// Resumen: cada consola anota en su lockstep (estado().largadas) en qué cuadro de lógica corrió el cuadro 0, el primero
// de la cuenta regresiva y el primero con la carrera andando (el «¡YA!»), y a qué hora (el reloj de pared: el mismo en
// todas las pestañas de este PC). La carrera es la misma en todas, así que los cuadros tienen que coincidir; y la hora
// del «¡YA!» casi: a lo más el retraso de la cuenta (6 cuadros = 100 ms) más un poco. Antes de §250 una consola podía
// correr la cuenta sola, segundos antes que otra que estaba trabada armando la pista.
// Como comparar en un osciloscopio de varios canales el flanco de partida de cada motor: el mismo pulso, a la vez.
//
// Uso:  const r = compararLargadas([estadoA, estadoB, …], 1, 200)   (los estado() del lockstep de cada consola,
//       la carrera, el tope en ms) → { cumple, d: { cuadro0, cuenta, ya } ms, detalle }
export function compararLargadas(estados, n, topeMs = 200) {
  const ls = estados.map(e => (e?.largadas || []).find(l => l.carrera === n));
  const letra = i => String.fromCharCode(65 + i);
  if (ls.some(l => !l?.ya)) return { cumple: false, d: null, detalle: `carrera ${n}: falta la largada de ${ls.map((l, i) => l?.ya ? null : letra(i)).filter(Boolean).join(', ')}` };
  const mismo = k => ls.every(l => l[k]?.c === ls[0][k]?.c);
  const horas = k => ls.map(l => k === 't0' ? l.t0 : l[k].t);
  const dif = k => Math.max(...horas(k)) - Math.min(...horas(k));
  const d = { cuadro0: dif('t0'), cuenta: dif('cuenta'), ya: dif('ya') };
  const primero = horas('ya').indexOf(Math.min(...horas('ya')));
  return { cumple: mismo('cuenta') && mismo('ya') && d.ya <= topeMs, d,
    detalle: `carrera ${n}: cuenta en el cuadro ${ls.map(l => l.cuenta.c).join('/')}, ¡YA! en el ${ls.map(l => l.ya.c).join('/')}; ` +
      `diferencia de hora: cuadro 0 ${d.cuadro0.toFixed(0)} ms, cuenta ${d.cuenta.toFixed(0)} ms, ¡YA! ${d.ya.toFixed(0)} ms (tope ${topeMs}; primera ${letra(primero)})` };
}
