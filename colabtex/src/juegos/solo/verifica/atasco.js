/* Verificador antitrampas de Atasco (ver docs/antitrampas.md y
   docs/antitrampas/atasco.md).

   La tabla es una sola, `club-atasco-estrellas`: puntos = estrellas de
   todos los niveles, tiempo = suma de los ms del intento que cuenta en
   cada uno. El progreso del que salían (localStorage y la cuenta) se
   puede editar a mano, así que el número ya no se cree: el juego manda
   `{v: 1, n: {nivel: prueba}}`, la partida que ganó cada nivel (vehículo,
   destino, instante y forma del gesto de cada movida), y aquí se vuelve
   a jugar cada una con el MISMO motor del juego
   (`juegos/club/atasco/motor.js`):

   - cada movida tiene que ser legal y el auto rojo tiene que salir, sin
     movidas de más después de salir;
   - las estrellas salen de contar las movidas contra el mínimo del nivel
     (niveles.js), no de lo que diga nadie;
   - el nivel tiene que haber estado abierto según las OTRAS pruebas (el
     piso, con la mitad de las estrellas del anterior; el nivel, con el
     anterior ganado): editar el progreso para abrir el último piso no
     sirve, porque lo que abre se cuenta igual que lo que suma;
   - que la haya hecho una mano y no un guion (un bot que usa el
     solucionador saca partidas perfectamente válidas): ningún evento
     sintético (isTrusted falso) salvo las teclas de un mando conectado,
     reacción de 150 ms al abrir el nivel, 40 ms como mínimo entre dos
     movidas y 1,2 s por cada diez seguidas, gestos que no sean
     instantáneos y un ritmo que no sea de metrónomo (los umbrales y su
     porqué, en motor.js);
   - el tiempo de cada nivel es el instante de su última movida, y la suma
     tiene que dar exacto el tiempo declarado.

   Una prueba que no se puede rehacer rechaza el resultado entero: el
   juego no cuenta las que no valen (usa la misma función para saberlo)
   y no las manda, con una excepción a propósito: un nivel recién ganado
   «sin mano» (eventos sintéticos, ritmo de guion) se manda una vez con su
   prueba, para que se rechace aquí y quede el aviso a los administradores.
   Una persona a la que eso le pase por error solo pierde ese envío: sus
   resultados siguientes no llevan esa prueba, y al volver a ganar el
   nivel la reemplaza. */
import M from '../../../../../juegos/club/atasco/motor.js';
import N from '../../../../../juegos/club/atasco/niveles.js';

export const PRUEBA = 1;

const CATEGORIA = 'club-atasco-estrellas';
const NIVELES = N.pisos.flatMap(p => p.niveles);
const MAX_ESTRELLAS = NIVELES.length * 3;

const nombreNivel = k => (/^\d+$/.test(k) ? 'El nivel ' + (Number(k) + 1) : 'Un nivel que no existe');

/* Un resultado recién jugado y la prueba que mandó el juego. Devuelve
   null si vale, o el motivo (una frase corta en castellano) si no. */
export function verifica(dato, prueba) {
  if (!dato || dato.categoria !== CATEGORIA) return 'Atasco no tiene esa tabla.';
  if (!prueba || typeof prueba !== 'object' || Array.isArray(prueba)) return 'La prueba de Atasco no tiene la forma esperada.';
  if (prueba.v !== M.PRUEBA_VERSION) return 'La prueba es de otra versión de Atasco (recarga la página).';
  const n = prueba.n;
  if (!n || typeof n !== 'object' || Array.isArray(n) || !Object.keys(n).length) return 'La prueba de Atasco no trae ningún nivel.';
  if (Object.keys(n).length > NIVELES.length) return 'La prueba trae más niveles de los que tiene el juego.';
  const r = M.resumenPruebas(n, N.pisos);
  const mal = Object.keys(r.errores);
  if (mal.length) return `${nombreNivel(mal[0])} no se puede rehacer: ${r.errores[mal[0]]}.`;
  if (dato.puntos !== r.estrellas)
    return `Las estrellas no cuadran: las partidas dan ${r.estrellas} y se declararon ${dato.puntos}.`;
  if (dato.tiempo !== r.tiempo)
    return `El tiempo no cuadra con los instantes de las movidas (${r.tiempo} ms contra ${dato.tiempo} ms).`;
  return null;
}

/* Lo menos que tarda alguien en juntar `e` estrellas: hace falta ganar
   ceil(e/3) niveles, cada uno con al menos su mínimo de movidas, y el
   reloj de un nivel corre desde la primera movida hasta la última, o sea
   (movidas − 1) intervalos. Se toman los niveles más cortos (sin mirar el
   orden de los pisos, que solo haría la cota más alta) y 50 ms por
   intervalo: muy por debajo de una mano (y del GAP_MIN de las pruebas),
   porque las filas viejas se fechaban al atender el evento y un tirón
   del navegador podía juntar dos movidas. Ganar los 240 niveles así daría
   unos 4 minutos; quien los ganó de verdad lleva horas. */
const GAP_SOSPECHA = 50;
const COSTOS = NIVELES.map(([, o]) => Math.max(0, o - 1) * GAP_SOSPECHA).sort((a, b) => a - b);
function tiempoMinimo(e) {
  let t = 0;
  for (let k = 0; k < Math.ceil(e / 3) && k < COSTOS.length; k++) t += COSTOS[k];
  return t;
}

/* Una fila ya guardada en soloRanks ({nombre, puntos, tiempo, partida}),
   sin prueba: null si es verosímil, o el motivo si ningún humano la hace. */
export function sospecha(categoria, fila) {
  if (categoria !== CATEGORIA || !fila) return null;
  const e = Number(fila.puntos), t = Number(fila.tiempo);
  if (!Number.isFinite(e) || !Number.isFinite(t)) return null;
  if (e > MAX_ESTRELLAS) return `${e} estrellas, y el juego tiene ${MAX_ESTRELLAS}.`;
  const min = tiempoMinimo(e);
  if (e >= 1 && t < min) return `${e} estrellas en ${(t / 1000).toFixed(1)} s: ni moviendo a 20 por segundo bajan de ${(min / 1000).toFixed(1)} s.`;
  return null;
}
