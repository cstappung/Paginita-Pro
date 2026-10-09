/* Verificador antitrampas de Trigon (ver docs/antitrampas.md y
   docs/antitrampas/trigon.md).

   Una tabla: `club-trigon-puntos`, puntos = el puntaje de la partida,
   tiempo = los ms jugados (sin pausas) hasta la última jugada.

   El juego manda `{v: 1, s, u, j, a, w, fin}`: la semilla, la cuenta, cada
   jugada como [pieza, dx, dy, origen, ms desde la anterior] (o
   [-1, casilla, 0, origen, ms] para un martillazo, que el motor solo acepta
   si había un martillo ganado) y lo jugado en los dos relojes. Aquí se vuelve a jugar con el MISMO motor
   (`juegos/club/trigon/motor.js`):

   - cada pieza tiene que caber donde se soltó en el tablero rehecho, y el
     puntaje tiene que salir exacto;
   - la cuenta va en la semilla de las piezas, así que una prueba copiada de
     otra persona reparte otras manos y no se puede rehacer;
   - ninguna jugada sintética (`x`: isTrusted falso);
   - el reloj del juego y el del sistema tienen que coincidir.

   La mano: soltar una pieza es arrastrarla hasta su sitio, y con teclado es
   elegirla, moverla y confirmar. Ninguna persona baja de unos 200 ms por
   jugada de forma sostenida. Se rechaza una racha de `RAFAGA` jugadas
   seguidas a menos de `RAPIDO` ms, o `VENTANA` jugadas seguidas que duren
   en total menos de `VENTANA_MS`.

   El límite honesto: un programa que juegue a ritmo de persona, con
   eventos de verdad, saca una prueba válida. */
import M from '../../../../../juegos/club/trigon/motor.js';
import { rachas, dosRelojes } from './patrones.js';

export const PRUEBA = 1;

const CAT = 'club-trigon-puntos';
const MAX_PUNTOS = 1000000, MAX_JUGADAS = 20000;
const RAFAGA = 15, RAPIDO = 120, VENTANA = 50, VENTANA_MS = 10000;

export function verifica(dato, prueba, ctx) {
  if (!dato || dato.categoria !== CAT) return 'Trigon no tiene esa tabla.';
  if (!prueba || typeof prueba !== 'object' || Array.isArray(prueba)) return 'La prueba de Trigon no tiene la forma esperada.';
  if (prueba.v !== 1) return 'La prueba es de otra versión de Trigon (recarga la página).';
  const uid = (ctx && ctx.uid) || dato.uid;
  if (typeof prueba.u !== 'string') return 'La prueba no dice de qué cuenta es.';
  if (uid && prueba.u !== uid) return 'La prueba es de una partida de otra cuenta.';
  if (!Number.isSafeInteger(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla de la partida no es válida.';
  const puntos = Number(dato.puntos), tiempo = Number(dato.tiempo);
  if (!(Number.isSafeInteger(puntos) && puntos >= 1 && puntos <= MAX_PUNTOS)) return 'El puntaje no es válido.';
  if (!Number.isFinite(tiempo) || tiempo < 0) return 'El tiempo no es válido.';
  const reloj = dosRelojes(prueba.a, prueba.w);
  if (reloj) return reloj;
  const jugadas = prueba.j;
  if (!Array.isArray(jugadas) || !jugadas.length || jugadas.length > MAX_JUGADAS) return 'Las jugadas de la prueba no se pueden leer.';
  if (jugadas.some(j => !Array.isArray(j) || j.length !== 5)) return 'Las jugadas de la prueba no traen origen y tiempo.';
  if (jugadas.some(j => j[3] === 'x')) return 'La partida trae jugadas que no hizo una mano (eventos sintéticos).';
  const res = M.rehace(prueba.s, prueba.u, jugadas);
  if (res.error) return res.error;
  if (Number.isFinite(prueba.a) && res.ms > prueba.a + 1000) return 'Las jugadas suman más tiempo del que se jugó.';
  if (prueba.fin && !res.E.fin) return 'La partida dice que terminó, pero al rehacerla todavía caben piezas.';
  if (res.E.puntos !== puntos) return `La partida rehecha suma ${res.E.puntos} puntos, no ${puntos}.`;
  if (tiempo !== res.ms) return 'El tiempo declarado no es el de la partida.';
  return mano(jugadas);
}

function mano(jugadas) {
  const d = jugadas.map(j => j[4]);
  if (rachas(d, x => x < RAPIDO).larga >= RAFAGA)
    return `${RAFAGA} piezas seguidas a menos de ${RAPIDO} ms cada una: así juega un programa, no una mano.`;
  let s = 0;
  for (let i = 0; i < d.length; i++) {
    s += d[i];
    if (i >= VENTANA) s -= d[i - VENTANA];
    if (i >= VENTANA - 1 && s < VENTANA_MS)
      return `${VENTANA} piezas seguidas en ${(s / 1000).toFixed(1)} s: así juega un programa, no una mano.`;
  }
  return null;
}

/* Una fila ya guardada, sin su prueba a mano: solo se puede mirar el tope.
   (El puntaje por jugada no tiene techo fijo, porque la racha multiplica el
   bono, así que no hay un mínimo de tiempo creíble que exigir.) */
export function sospecha(categoria, fila) {
  if (categoria !== CAT || !fila) return null;
  const p = Number(fila.puntos);
  if (!Number.isFinite(p)) return null;
  return p > MAX_PUNTOS ? `${p} puntos: más de lo que la tabla admite.` : null;
}
