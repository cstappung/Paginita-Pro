/* Verificador antitrampas de tetris (ver docs/antitrampas.md).

   Aún sin implementar: acepta todo lo que ya pasó por resultadoClub.
   Cuando el juego emita su prueba, PRUEBA sube a 1 y verifica() la
   rehace con el motor del juego. */
export const PRUEBA = 0;

/* Un resultado recién jugado y la prueba que mandó el juego. Devuelve
   null si vale, o el motivo (una frase corta en castellano) si no. Puede
   devolver una promesa. */
export function verifica(dato, prueba) { return null; }

/* Una fila ya guardada en soloRanks ({nombre, puntos, tiempo, partida}),
   sin prueba: null si es verosímil, o el motivo si ningún humano la hace. */
export function sospecha(categoria, fila) { return null; }
