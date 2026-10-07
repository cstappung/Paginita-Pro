/* Verificador antitrampas del 2048 (ver docs/antitrampas.md y
   docs/antitrampas/dosmil.md).

   Dos tablas:
   - `club-dosmil-puntos`: puntos = el puntaje de la partida, tiempo = los
     ms jugados (sin pausas) hasta la última jugada;
   - `club-dosmil-ficha`: puntos = la ficha más alta (2048, 4096…),
     tiempo = en qué ms se llegó a ella por primera vez.

   El juego manda `{v: 1, s, u, f, a, w, fin}`: la semilla, la cuenta,
   cada jugada con su dirección, su origen y los ms desde la anterior, y lo
   jugado en los dos relojes. Aquí se vuelve a jugar con el MISMO motor
   (`juegos/club/dosmil/motor.js`):

   - cada jugada tiene que mover algo en el tablero rehecho, y el puntaje y
     la ficha tienen que salir exactos;
   - la cuenta va en la semilla de las fichas nuevas, así que una prueba
     copiada de otra persona no rehace el mismo tablero;
   - ninguna jugada sintética (`x`: isTrusted falso sin mando conectado);
   - el reloj del juego y el del sistema tienen que coincidir.

   La mano: un programa juega el 2048 de corrido, una jugada cada pocos
   milisegundos y sin parar. Una persona que machaca dos teclas no baja de
   unos 80 ms entre jugadas, y piensa de vez en cuando. Se rechaza una racha
   de `RAFAGA` jugadas seguidas a menos de `RAPIDO` ms, o `VENTANA` jugadas
   seguidas que duren en total menos de `VENTANA_MS`.

   El límite honesto: un programa que juegue a ritmo de persona, con
   eventos de verdad, saca una prueba válida. */
import M from '../../../../../juegos/club/dosmil/motor.js';
import { rachas, dosRelojes } from './patrones.js';

export const PRUEBA = 1;

const CAT_PUNTOS = 'club-dosmil-puntos', CAT_FICHA = 'club-dosmil-ficha';
const MAX_PUNTOS = 4000000, MAX_FICHA = 262144;
const RAFAGA = 30, RAPIDO = 40, VENTANA = 100, VENTANA_MS = 5000;

const potencia = n => Number.isSafeInteger(n) && n >= 4 && n <= MAX_FICHA && (n & (n - 1)) === 0;

export function verifica(dato, prueba, ctx) {
  if (!dato || (dato.categoria !== CAT_PUNTOS && dato.categoria !== CAT_FICHA)) return 'El 2048 no tiene esa tabla.';
  if (!prueba || typeof prueba !== 'object' || Array.isArray(prueba)) return 'La prueba del 2048 no tiene la forma esperada.';
  if (prueba.v !== 1) return 'La prueba es de otra versión del 2048 (recarga la página).';
  const uid = (ctx && ctx.uid) || dato.uid;
  if (typeof prueba.u !== 'string') return 'La prueba no dice de qué cuenta es.';
  if (uid && prueba.u !== uid) return 'La prueba es de una partida de otra cuenta.';
  if (!Number.isSafeInteger(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla de la partida no es válida.';
  const puntos = Number(dato.puntos), tiempo = Number(dato.tiempo);
  const ficha = dato.categoria === CAT_FICHA;
  if (ficha ? !potencia(puntos) : !(Number.isSafeInteger(puntos) && puntos >= 1 && puntos <= MAX_PUNTOS)) return 'El puntaje no es válido.';
  if (!Number.isFinite(tiempo) || tiempo < 0) return 'El tiempo no es válido.';
  const reloj = dosRelojes(prueba.a, prueba.w);
  if (reloj) return reloj;
  const jugadas = M.decodifica(prueba.f);
  if (!jugadas || !jugadas.length) return 'Las jugadas de la prueba no se pueden leer.';
  if (jugadas.some(j => j[1] === 'x')) return 'La partida trae jugadas que no hizo una mano (eventos sintéticos).';
  const total = jugadas.reduce((s, j) => s + j[2], 0);
  if (Number.isFinite(prueba.a) && total > prueba.a + 1000) return 'Las jugadas suman más tiempo del que se jugó.';
  const res = M.rehace(prueba.s, prueba.u, jugadas);
  if (res.error) return res.error;
  if (prueba.fin && res.vivo) return 'La partida dice que terminó, pero al rehacerla todavía quedan jugadas.';
  if (ficha) {
    if (res.ficha !== puntos) return `La partida rehecha llega a la ficha ${res.ficha}, no a ${puntos}.`;
    if (tiempo !== res.tFicha) return 'El tiempo declarado no es el de la partida.';
  } else {
    if (res.puntos !== puntos) return `La partida rehecha suma ${res.puntos} puntos, no ${puntos}.`;
    if (tiempo !== res.ms) return 'El tiempo declarado no es el de la partida.';
  }
  return mano(jugadas);
}

function mano(jugadas) {
  const d = jugadas.map(j => j[2]);
  if (rachas(d, x => x < RAPIDO).larga >= RAFAGA)
    return `${RAFAGA} jugadas seguidas a menos de ${RAPIDO} ms cada una: así juega un programa, no una mano.`;
  let s = 0;
  for (let i = 0; i < d.length; i++) {
    s += d[i];
    if (i >= VENTANA) s -= d[i - VENTANA];
    if (i >= VENTANA - 1 && s < VENTANA_MS)
      return `${VENTANA} jugadas seguidas en ${(s / 1000).toFixed(1)} s: así juega un programa, no una mano.`;
  }
  return null;
}

export function sospecha(categoria, fila) {
  if ((categoria !== CAT_PUNTOS && categoria !== CAT_FICHA) || !fila) return null;
  const p = Number(fila.puntos), t = Number(fila.tiempo);
  if (!Number.isFinite(p) || !Number.isFinite(t)) return null;
  if (categoria === CAT_PUNTOS) return p > MAX_PUNTOS ? `${p} puntos: más de lo que la tabla admite.` : null;
  if (!potencia(p)) return `La ficha ${p} no existe en el 2048.`;
  const min = M.jugadasMinimas(p) * (VENTANA_MS / VENTANA);
  if (t < min) return `La ficha ${p} en ${(t / 1000).toFixed(1)} s: pide al menos ${M.jugadasMinimas(p)} jugadas, y a ritmo de mano no baja de ${(min / 1000).toFixed(1)} s.`;
  return null;
}
