/* Verificador antitrampas de Tetris Club (ver docs/antitrampas.md y
   docs/antitrampas/tetris.md).

   La partida del Club avanza en pasos fijos de TM.PASO ms y cada acción
   se aplica al empezar un paso, así que la prueba es la cuenta, la sal de
   la semilla y la lista «en el paso k, tal acción» (TM.grabadora). Aquí
   se rehace con el mismo motor (TM.rehace) y se compara con lo declarado:
   puntos, tiempo y, en Sprint, que de verdad se hicieron las 40 líneas.
   Después, los límites de lo que una mano puede hacer, con margen: un
   falso positivo (rechazarle el récord a alguien honesto) es peor que
   dejar pasar una trampa rara. */
import TM from '../../../../../juegos/club/tetris/motor.js';

export const PRUEBA = 1;

/* Pasos que se aceptan rehacer: seis horas de partida. Una Maratón de
   verdad muere mucho antes (el nivel 20 es caída instantánea), y la
   prueba de una partida así ya no cabe en los 200 000 caracteres. */
const TOPE_PASOS = 6 * 3600 * 1000 / TM.PASO;

/* Piezas por segundo sostenidas en toda la partida. El récord mundial de
   40 líneas (TETR.IO, con DAS y ARR casi nulos) ronda 13–14 s, unas
   7,3–7,7 PPS; aquí el DAS es de 150 ms y el ARR de 45, fijos, así que
   nadie llega ni a eso. 8 deja margen. Solo cuenta con 60 piezas o más:
   en una partida cortísima, machacar la caída unas cuantas veces seguidas
   da cualquier cifra y no le sirve a nadie. */
const PPS_MAX = 8, PPS_PIEZAS = 60;
/* Ráfaga: 40 piezas seguidas en menos de 40/12 s. Los mejores llegan a
   ráfagas de ~10 PPS; 40 piezas sin mover nada no caben en el pozo (se
   llena con ~20), así que machacar la caída tampoco llega aquí. */
const RAFAGA_PIEZAS = 40, RAFAGA_PPS = 12;
/* Acciones que hicieron algo, en cualquier segundo de partida. Mantener
   una flecha repite cada 45 ms (22 por segundo, y solo mientras la pieza
   se pueda mover); con eso más girar y soltar a mano no se pasa de ~35.
   50 en un segundo es un programa. */
const ACCIONES_SEG = 50;
/* Sprint: debajo del récord mundial no hay humano, se mire como se mire. */
const SPRINT_MIN_MS = 12000;
/* Reloj del juego contra el del sistema (`w`, sumado cuadro a cuadro con
   un tope de un segundo por cuadro). El juego no avanza más de 100 ms por
   cuadro, así que un aparato muy lento también va más despacio que la
   pared; pero para quedar por debajo de 0,3 haría falta jugar entero a
   menos de 3 cuadros por segundo, que no se puede. Un reloj frenado a mano
   (el truco de ralentizar `requestAnimationFrame`/`performance.now`) sí. */
const PARED_RAZON = 0.3, PARED_MARGEN_MS = 15000;

/* ---------- capa anti-bot: cómo se tocó ----------
   Un bot puede jugar una partida válida (el motor la rehace sin pegas), así
   que además se mira la forma de las pulsaciones (`k`, TM.registroTeclas).
   Tetris se juega a ráfagas: pensar, mover, girar, soltar; los intervalos
   entre teclas de una persona van de 10 ms (dos dedos casi a la vez) a
   segundos, con un coeficiente de variación (σ/μ) que en partidas reales
   pasa de 0,5. Una tecla de verdad se mantiene apretada decenas de ms
   (teclear rápido: 50–120 ms; el mínimo físico de un teclado ronda los
   20–30 ms). Por eso:
   - Un evento que no es de nadie (`isTrusted` falso y sin mando
     conectado) rechaza solo: no hay forma honesta de producirlo.
   - Las demás señales son blandas y solo rechazan **de a dos**, o una sola
     si es exagerada (un metrónomo perfecto):
       · ritmo de metrónomo: ≥ 40 intervalos (sin contar pausas de más de
         3 s) con σ/μ < 0,12;
       · teclas sin mantener: ≥ 30 pulsaciones soltadas con mediana < 10 ms;
       · reacción imposible: la primera pulsación antes de 100 ms desde que
         empezó la partida (ver la pieza y decidir lleva 150 ms o más).
     Sola rechaza σ/μ < 0,03 con ≥ 60 intervalos: ni el mejor baterista
     toca así de parejo.
   - Más de 10 jugadas sin ninguna pulsación: las jugadas solo salen de
     teclas, del mando o de los botones táctiles. */
const CV_MIN = 0.12, CV_INTERVALOS = 40, CV_METRONOMO = 0.03, CV_METRONOMO_N = 60, PAUSA_MS = 3000;
const MANTIENE_MIN = 10, MANTIENE_N = 30, REACCION_MIN = 100;

function antibot(r, k) {
  const pul = TM.leeTeclasPrueba(k === undefined ? null : k);
  if (!pul) return 'La prueba no trae las pulsaciones de la partida.';
  if (pul.some(p => p.o === 'X')) return 'La partida se jugó con eventos de teclado que no vienen ni del teclado ni de un mando (un script).';
  const acciones = r.jugadas.filter(j => j[1] !== 'S').length;
  if (acciones > 10 && !pul.length) return 'La partida tiene jugadas pero ninguna pulsación.';
  const señales = [];
  const iv = pul.slice(1).map(p => p.d).filter(d => d <= PAUSA_MS);
  if (iv.length >= CV_INTERVALOS) {
    const m = iv.reduce((a, b) => a + b, 0) / iv.length;
    const cv = m > 0 ? Math.sqrt(iv.reduce((a, b) => a + (b - m) ** 2, 0) / iv.length) / m : 0;
    if (cv < CV_METRONOMO && iv.length >= CV_METRONOMO_N) return 'Las teclas se pulsaron a ritmo de metrónomo, como un programa.';
    if (cv < CV_MIN) señales.push('ritmo de metrónomo');
  }
  const h = pul.map(p => p.h).filter(x => x !== null).sort((a, b) => a - b);
  if (h.length >= MANTIENE_N && h[h.length >> 1] < MANTIENE_MIN) señales.push('teclas sin mantener');
  if (pul.length && pul[0].d < REACCION_MIN) señales.push('primera tecla antes de poder reaccionar');
  if (señales.length >= 2) return 'La forma de jugar es la de un programa (' + señales.join(', ') + ').';
  return null;
}

const modoDe = c => (/^club-tetris-(maraton|sprint|ultra)$/.exec(String(c || '')) || [])[1] || null;

/* Lo que una persona puede hacer dentro de una partida que sí existió. */
function humano(r) {
  const T = r.pasos * TM.PASO;
  const f = r.fijas;
  if (f.length >= PPS_PIEZAS && f.length / (T / 1000) > PPS_MAX)
    return `${(f.length / (T / 1000)).toFixed(1)} piezas por segundo en toda la partida: más que el récord del mundo.`;
  const rafaga = Math.ceil(RAFAGA_PIEZAS / RAFAGA_PPS * 1000 / TM.PASO);
  for (let i = RAFAGA_PIEZAS - 1; i < f.length; i++)
    if (f[i] - f[i - RAFAGA_PIEZAS + 1] < rafaga) return `${RAFAGA_PIEZAS} piezas en menos de ${(rafaga * TM.PASO / 1000).toFixed(1)} s.`;
  const seg = 1000 / TM.PASO;
  const acc = r.jugadas.filter(j => j[1] !== 'B' && j[1] !== 'S').map(j => j[0]);
  for (let i = ACCIONES_SEG; i < acc.length; i++)
    if (acc[i] - acc[i - ACCIONES_SEG] < seg) return `Más de ${ACCIONES_SEG} jugadas en un segundo.`;
  return null;
}

export function verifica(dato, prueba, ctx) {
  const modo = modoDe(dato && dato.categoria);
  if (!modo) return 'La categoría no es de Tetris Club.';
  if (!prueba || typeof prueba !== 'object') return 'La partida llegó sin prueba.';
  if (prueba.v !== 1) return 'La prueba no es de esta versión del juego (recarga la página).';
  if (prueba.m !== modo) return 'La prueba es de otro modo de juego.';
  /* Si la página dice quién juega, la prueba tiene que ser de esa cuenta
     (la semilla sale de ella: no se puede cambiar sin cambiar la partida). */
  if (ctx && ctx.uid && prueba.u !== ctx.uid) return 'La prueba es de la partida de otra cuenta.';
  const r = TM.rehace(prueba, TOPE_PASOS);
  if (r.error) return r.error;
  const tiempo = Math.max(1, Math.round(r.tiempo));
  if (modo === 'sprint') {
    if (!r.gano || r.lineas < TM.SPRINT) return `La partida hizo ${r.lineas} líneas, no ${TM.SPRINT}.`;
    if (dato.puntos !== TM.SPRINT) return 'Los puntos del Sprint no son los de la partida.';
  } else if (dato.puntos !== r.puntos) return `La partida hizo ${r.puntos} puntos, no ${dato.puntos}.`;
  if (dato.tiempo !== tiempo) return 'El tiempo no es el de la partida.';
  if (modo === 'sprint' && tiempo < SPRINT_MIN_MS) return 'Un Sprint así de rápido no lo hace nadie.';
  const motivo = humano(r) || antibot(r, prueba.k);
  if (motivo) return motivo;
  const T = r.pasos * TM.PASO, w = prueba.w;
  if (Number.isFinite(w) && w > 0 && T < PARED_RAZON * w && w - T > PARED_MARGEN_MS)
    return 'El reloj del juego iba mucho más lento que el real.';
  return null;
}

/* Lo más que se puede sumar en `ms` jugando a `pps`: cada diez piezas un
   Tetris en cadena (B2B, 1200 × nivel), el nivel subiendo cada diez
   líneas hasta el 20, y cada pieza soltada desde arriba (2 por fila).
   Es una cota generosa, no una partida real: nadie encadena solo Tetris. */
function cotaPuntos(ms, pps) {
  const piezas = Math.floor(ms / 1000 * pps);
  let puntos = piezas * 2 * TM.H, lineas = 0;
  for (let i = 10; i <= piezas; i += 10) {
    const nivel = Math.min(20, 1 + Math.floor(lineas / 10));
    puntos += 1200 * nivel + 3000 * nivel / 10; /* y un pozo limpio de vez en cuando */
    lineas += 4;
  }
  return puntos;
}

/* Filas ya guardadas, sin prueba. Sprint: debajo del récord mundial.
   Maratón y Ultra: más puntos de los que caben en ese tiempo jugando a
   6 piezas por segundo sin parar (los mejores sostienen 4–5 en partidas
   de dos minutos), con la mitad más de margen. */
export function sospecha(categoria, fila) {
  const modo = modoDe(categoria);
  if (!modo || !fila) return null;
  const t = Number(fila.tiempo), p = Number(fila.puntos);
  if (modo === 'sprint') {
    if (p !== TM.SPRINT) return `Un Sprint vale ${TM.SPRINT} puntos, no ${p}.`;
    if (t < SPRINT_MIN_MS) return `40 líneas en ${(t / 1000).toFixed(2)} s: por debajo del récord mundial.`;
    return null;
  }
  if (modo === 'ultra' && t > TM.ULTRA_MS) return 'Ultra dura dos minutos.';
  const cota = Math.round(cotaPuntos(modo === 'ultra' ? Math.min(t, TM.ULTRA_MS) : t, 6) * 1.5);
  if (p > cota) return `${p} puntos en ${Math.round(t / 1000)} s: más de lo que cabe (${cota}).`;
  return null;
}
