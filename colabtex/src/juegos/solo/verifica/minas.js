/* Verificador antitrampas de Mina Club (ver docs/antitrampas.md y
   docs/antitrampas/minas.md).

   La prueba es la partida entera: la semilla del reparto de minas y cada
   jugada que cambió algo, con su instante. Se rehace con el mismo motor
   que juega (juegos/club/minas/engine.js, UMD, compartido): el tablero
   tiene que quedar ganado justo en la última jugada y el tiempo declarado
   tiene que ser el de esa jugada. Después, límites de lo que una persona
   puede hacer, todos con margen ancho: aquí un falso positivo (rechazar a
   alguien honesto) es peor que dejar pasar una trampa rara.

   Formato (`v: 1`):
     {v: 1, n: 'easy'|'medium'|'hard', s: semilla uint32, u?: uid,
      e: [código, msJuego, msPared, origen, movs, msGesto,  …]}
   código = casilla·2 (+1 si es bandera); −1 marca una pausa. msJuego son
   los ms del reloj del marcador desde la entrada anterior (sin pausas) y
   msPared los de Date.now: los dos avanzan igual mientras se juega.
   origen son bits: 1 evento sintético (isTrusted falso y sin mando),
   2 mando (tecla sintética de mando.js con un mando conectado), 4 teclado,
   8 táctil; movs, los pointermove entre apretar y soltar; msGesto, lo que
   duró el gesto (−1 si no hubo puntero: teclado, mando). */
import Mina from '../../../../../juegos/club/minas/engine.js';

export const PRUEBA = 1;

// Más entradas que esto no salen jugando: el difícil tiene 480 casillas.
const MAX_ENTRADAS = 30000, CAMPOS = 6;
/* Ritmo humano. Referencias: los récords mundiales del buscaminas
   (principiante ~0,5 s, intermedio ~7 s, experto ~27 s) se hacen a 8–12
   clics por segundo, apuntando cada vez a otra casilla; el récord de clics
   por segundo con dos dedos en un mismo botón («butterfly») ronda los 25.
   Con margen:
   - el promedio de toda la partida no baja de 50 ms por jugada (20/s) si
     hay 3 o más, ni de 66 ms (15/s) si hay 20 o más;
   - diez jugadas seguidas no caben en menos de 250 ms (36/s). Una pareja
     casi simultánea sí puede pasar (dos dedos en una pantalla táctil), por
     eso se miden ventanas y promedios, no intervalos sueltos;
   - tras el primer clic hay que ver qué abrió: la segunda jugada no llega
     antes de 100 ms (un tiempo de reacción visual humano es de 150–250).
   Los datos reales que motivaron esto (una cuenta con 9 ms en fácil,
   15 ms en medio y 29 ms en difícil) caen en todas. */
const RITMO_3 = 50, RITMO_20 = 1000 / 15, VENTANA = 10, VENTANA_MS = 250, REACCION = 100;
/* Regularidad: una persona que despeja un buscaminas va a tirones (mira,
   piensa, despeja en ráfaga); un bot va a ritmo de metrónomo. Con 15 o más
   intervalos sin pausa, un coeficiente de variación por debajo de 0,05 se
   rechaza solo (en las partidas humanas pasa de 0,4). Entre 0,05 y 0,15 se
   rechaza solo junto con gestos instantáneos: más del 80 % de los clics
   con menos de 8 ms entre apretar y soltar (un dedo o un botón físico
   tarda 30–150 ms; el «tap to click» de un panel táctil puede ser muy
   corto, por eso eso solo no basta). */
const CV_MIN = 15, CV_SOLO = .05, CV_JUNTO = .15, GESTO_INSTANTE = 8, GESTOS_INSTANTE = .8;
/* Pensar en pausa: quien esconde la pantalla de pausa con el inspector
   puede mirar el tablero sin que corra el reloj, y despejar a golpes de
   pausa-clic-pausa. Una persona pausa al cambiar de pestaña, alguna vez;
   no una pausa cada tres jugadas. */
const PAUSAS_MIN = 10, JUGADAS_POR_PAUSA = 3;
/* Reloj frenado: performance.now reescrito para que corra más lento da un
   tiempo mejor. Date.now no se toca con eso. En cada intervalo sin pausa
   de por medio, juego/pared ≈ 1; se toma la mediana (una pausa o el
   portátil dormido sin aviso son intervalos sueltos, no la mediana) sobre
   intervalos de 300 ms o más (Firefox con resistFingerprinting redondea
   los dos relojes a 100 ms), y solo con 8 o más de ellos. */
const RATIO_MIN = .6, RATIO_INTERVALO = 300, RATIO_MUESTRAS = 8;

const nivelDe = c => { const m = /^club-minas-(easy|medium|hard)$/.exec(String(c || '')); return m ? m[1] : null; };
const entero = x => Number.isSafeInteger(x);

export function verifica(dato, prueba) {
  const nivel = nivelDe(dato && dato.categoria);
  if (!nivel) return 'Categoría de Mina Club desconocida.';
  if (dato.puntos !== 1) return 'En Mina Club los puntos valen 1.';
  if (!prueba || typeof prueba !== 'object' || prueba.v !== 1) return 'Prueba de Mina Club con un formato desconocido.';
  if (prueba.n !== nivel) return 'La prueba es de otra dificultad.';
  if (!entero(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla de la prueba no es válida.';
  if (prueba.u !== undefined && (typeof prueba.u !== 'string' || prueba.u.length > 128)) return 'La cuenta de la prueba no es válida.';
  const e = prueba.e;
  if (!Array.isArray(e) || !e.length || e.length % CAMPOS || e.length > CAMPOS * MAX_ENTRADAS) return 'La lista de jugadas no es válida.';
  if (!e.every(entero)) return 'La lista de jugadas no es válida.';

  const juego = new Mina.Game(nivel, Mina.azar(prueba.s)), celdas = juego.cells.length;
  let activo = 0, empezo = false, pausas = 0, sinteticas = 0, conPuntero = 0, instantaneos = 0, pausaEntre = false;
  const tiempos = [], ratios = [], intervalos = [];
  for (let k = 0; k < e.length; k += CAMPOS) {
    const c = e[k], a = e[k + 1], w = e[k + 2], o = e[k + 3], mv = e[k + 4], du = e[k + 5];
    if (c < -1 || c >= 2 * celdas) return 'Una jugada cae fuera del tablero.';
    if (a < 0) return 'El reloj de la partida va hacia atrás.';
    if (o < 0 || o > 15 || mv < 0 || mv > 255 || du < -1 || du > 9999) return 'La forma de una jugada no es válida.';
    if (juego.state === 'won' || juego.state === 'lost') return 'Hay jugadas después de terminar la partida.';
    if (!empezo && a) return 'El reloj corrió antes del primer clic.';
    activo += a;
    // Juego/pared en este intervalo, si no lleva una pausa dentro.
    if (empezo && k >= CAMPOS && e[k - CAMPOS] !== -1 && w >= RATIO_INTERVALO) ratios.push(a / w);
    if (c === -1) {
      if (!empezo) return 'Una pausa antes de empezar no existe.';
      pausas++; pausaEntre = true; continue;
    }
    const i = c >> 1;
    if (c & 1) { if (!juego.flag(i)) return 'Una bandera de la prueba no se puede poner.'; }
    else {
      const antes = juego.state;
      if (!juego.open(i).length) return 'Una jugada de la prueba no abre nada.';
      if (antes === 'ready') empezo = true;
    }
    if (o & 1) sinteticas++;
    if (!(o & 6) && du >= 0) { conPuntero++; if (du < GESTO_INSTANTE) instantaneos++; }
    if (empezo) {
      if (tiempos.length && !pausaEntre) intervalos.push(activo - tiempos[tiempos.length - 1]);
      tiempos.push(activo); pausaEntre = false;
    }
  }
  if (juego.state !== 'won') return 'Las jugadas de la prueba no ganan la partida.';
  if (Math.abs(dato.tiempo - Math.max(1, activo)) > 2) return 'El tiempo declarado no es el de la partida.';

  if (sinteticas) return `${sinteticas} jugada${sinteticas > 1 ? 's' : ''} con eventos sintéticos (no de una persona ni de un mando).`;
  const n = tiempos.length, total = n ? tiempos[n - 1] - tiempos[0] : 0;
  if (n >= 2 && tiempos[1] - tiempos[0] < REACCION) return 'La segunda jugada llegó antes de poder ver el tablero.';
  if (n >= 3 && total < RITMO_3 * (n - 1) || n >= 20 && total < RITMO_20 * (n - 1)) return 'Demasiadas jugadas por segundo para una persona.';
  for (let k = 0; k + VENTANA - 1 < n; k++)
    if (tiempos[k + VENTANA - 1] - tiempos[k] < VENTANA_MS) return 'Jugadas demasiado rápidas para una persona.';
  if (intervalos.length >= CV_MIN) {
    const media = intervalos.reduce((x, y) => x + y, 0) / intervalos.length;
    const cv = media > 0 ? Math.sqrt(intervalos.reduce((x, y) => x + (y - media) ** 2, 0) / intervalos.length) / media : 0;
    if (cv < CV_SOLO) return 'Jugadas a ritmo de metrónomo: así no juega una persona.';
    if (cv < CV_JUNTO && conPuntero >= CV_MIN && instantaneos >= GESTOS_INSTANTE * conPuntero) return 'Clics instantáneos y a ritmo constante: así no juega una persona.';
  }
  if (pausas >= PAUSAS_MIN && pausas * JUGADAS_POR_PAUSA >= n) return 'Demasiadas pausas entre jugada y jugada.';
  if (ratios.length >= RATIO_MUESTRAS) {
    ratios.sort((x, y) => x - y);
    const m = ratios.length >> 1, mediana = ratios.length % 2 ? ratios[m] : (ratios[m - 1] + ratios[m]) / 2;
    if (mediana < RATIO_MIN) return 'El reloj de la partida corrió más lento que el real.';
  }
  return null;
}

/* Lo ya guardado sin prueba. Récords mundiales del buscaminas clásico, de
   referencia: principiante (9×9, 10 minas) ~0,5 s, intermedio (16×16, 40)
   ~7 s, experto (30×16, 99) ~27 s. Los tableros de aquí son de ese tamaño
   (10×8, 18×14 y 24×20 = 480 casillas, como el experto) pero el primer
   clic abre siempre un hueco de 3×3, que los hace más fáciles. Simulando
   20 000 repartos por nivel, el 3BV (los clics mínimos sin banderas) del
   0,1 % más fácil es 4, 34 y 117, y su mínimo 1, 26 y 100; un primer clic
   gana el fácil en 1 de cada ~20 000 tableros (y entonces el tiempo es
   ~1 ms, legítimo). A 15 3BV por segundo, más que cualquier récord, salen
   los suelos de abajo con margen. Es un aviso para que lo mire un
   administrador, no un borrado. */
const SUELO = { easy: 250, medium: 2000, hard: 10000 };

export function sospecha(categoria, fila) {
  const nivel = nivelDe(categoria);
  if (!nivel || !fila) return null;
  if (fila.puntos !== 1) return 'En Mina Club los puntos valen siempre 1.';
  if (!Number.isFinite(fila.tiempo) || fila.tiempo < SUELO[nivel])
    return `Tiempo de ${(fila.tiempo / 1000).toFixed(2)} s en ${nivel}: por debajo de lo humano (${SUELO[nivel] / 1000} s)` +
      (nivel === 'easy' ? ', salvo que el primer clic ganara el tablero (1 de cada ~20 000).' : '.');
  return null;
}
