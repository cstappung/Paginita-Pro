/* Verificador antitrampas de PRO TILES (ver docs/antitrampas.md y
   docs/antitrampas/protiles.md).

   Nueve tablas: una por canción (`club-protiles-<id>`) y la mezcla de las
   ocho (`club-protiles-mezcla`). puntos = el puntaje de la partida (una
   por nota, más el bono de las largas completadas), tiempo = lo que duró
   en tiempo de juego (pasos de 4 ms). El juego manda `{v: 3, m, s, u, g,
   n, a, w, x?}`: el modo, la semilla, la cuenta, cada nota tocada con su
   tick (y, en las largas, a qué altura se tocó), cada larga soltada, el
   tick final y lo jugado en los dos relojes. Aquí se vuelve a tocar con el
   MISMO motor (`juegos/club/protiles/motor.js`):

   - cada nota tiene que caer cuando su ficha estaba en pantalla, y ninguna
     ficha puede escaparse antes de la última nota;
   - la partida rehecha tiene que llegar viva al tick final y sumar
     exactamente los puntos declarados;
   - la cuenta va en la semilla de los carriles: una prueba copiada de otra
     persona no rehace la misma partida;
   - ningún toque sintético (`x`), y el reloj del juego no puede ir más
     rápido que el del sistema;
   - la mano: un programa toca cada ficha a la misma distancia del borde.

   El límite honesto: un programa que toque con eventos de verdad y una
   mano imitada saca una prueba válida. */
import M from '../../../../../juegos/club/protiles/motor.js';
import { minDesviacion, dosRelojes } from './patrones.js';

export const PRUEBA = 3;

const MAX_PUNTOS = 1000000;
/* Una persona no toca 50 notas seguidas a menos de 0,02 filas de la misma
   altura (con la pantalla bajando a 4–8 filas por segundo, eso es 3–5 ms
   de precisión). Un programa, sí. */
const MANO_V = 50, MANO_SD = 0.02;

const modoDe = c => { const m = /^club-protiles-([a-z]+)$/.exec(String(c || '')); return m && M.MODOS.includes(m[1]) ? m[1] : null; };

export function verifica(dato, prueba, ctx) {
  const modo = dato && modoDe(dato.categoria);
  if (!modo) return 'PRO TILES no tiene esa tabla.';
  if (!prueba || typeof prueba !== 'object' || Array.isArray(prueba)) return 'La prueba de PRO TILES no tiene la forma esperada.';
  /* Versión 3: las canciones de Pixabay adaptadas a piano. Las pruebas de
     las versiones 1 y 2 (guardadas, o pendientes en un navegador) se rehacen
     con las canciones y la regla de entonces. */
  if (!M.PRUEBA_VERSIONES.includes(prueba.v)) return 'La prueba es de otra versión de PRO TILES (recarga la página).';
  if (prueba.m !== modo) return 'La prueba es de otra canción que la tabla.';
  const uid = (ctx && ctx.uid) || dato.uid;
  if (typeof prueba.u !== 'string') return 'La prueba no dice de qué cuenta es.';
  if (uid && prueba.u !== uid) return 'La prueba es de una partida de otra cuenta.';
  if (!Number.isSafeInteger(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla de la partida no es válida.';
  const puntos = Number(dato.puntos), n = prueba.n;
  if (!(Number.isSafeInteger(puntos) && puntos >= 1 && puntos <= MAX_PUNTOS)) return 'El puntaje no es válido.';
  if (!Number.isSafeInteger(n) || n < 0) return 'El tick final no es válido.';
  if (Number(dato.tiempo) !== Math.max(1, n * M.TICK_MS)) return 'El tiempo declarado no es el de la partida.';
  if (prueba.x) return 'La partida trae toques que no hizo una mano (eventos sintéticos).';
  const reloj = dosRelojes(prueba.a, prueba.w);
  if (reloj) return reloj;
  if (Number.isFinite(prueba.a) && n * M.TICK_MS > prueba.a + 1000) return 'La partida duró más en el juego que en el reloj.';
  const acciones = M.decodifica(prueba.g);
  if (!acciones) return 'Las notas de la prueba no se pueden leer.';
  const res = M.rehace(modo, prueba.s, prueba.u, acciones, n, prueba.v);
  if (res.error) return res.error;
  if (res.puntos !== puntos) return `La partida rehecha suma ${res.puntos} puntos, no ${puntos}.`;
  if (minDesviacion(res.desfases, MANO_V) < MANO_SD)
    return `${MANO_V} notas seguidas tocadas a la misma altura de la pantalla: así toca un programa, no una mano.`;
  return null;
}

/* Una fila ya guardada, sin su prueba a mano: solo se puede mirar el tope
   (la pantalla acelera sin techo, así que no hay un tiempo mínimo creíble). */
export function sospecha(categoria, fila) {
  if (!modoDe(categoria) || !fila) return null;
  const p = Number(fila.puntos);
  if (!Number.isFinite(p)) return null;
  return p > MAX_PUNTOS ? `${p} puntos: más de lo que la tabla admite.` : null;
}
