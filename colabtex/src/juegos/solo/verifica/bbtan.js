/* Verificador antitrampas de BBTAN (ver docs/antitrampas.md y
   docs/antitrampas/bbtan.md).

   La tabla `club-bbtan-rondas` es la ronda más alta alcanzada (y paga
   monedas por cada ronda hasta el récord), así que lo que hay que comprobar
   es que esa ronda se alcanzó. La prueba es `{v: 1, s, u, t, h}`: la
   semilla, la cuenta, cada tiro como «ángulo.Δms[.tick en que se recogió]»
   (ver `codifica` en el motor) y, en `h`, cómo se apuntó cada uno (ver
   `gestos` más abajo). Con eso se rehace la partida entera con el mismo
   motor que la jugó (juegos/club/bbtan/motor.js: tiempo fijo, azar con
   semilla y solo aritmética que IEEE redondea igual en todas partes, así que
   la repetición es exacta también en Node) y la ronda a la que llega tiene
   que ser la declarada. Inventar un número, editar la partida guardada o
   tocar el estado desde la consola ya no basta: hay que presentar una
   partida que el motor acepte. */
import M from '../../../../../juegos/club/bbtan/motor.js';

export const PRUEBA = 1;

/* Lo menos que tarda un tiro en tiempo jugado: el juego corre a ×4 como
   mucho (`PACE_MAX`, ni el botón de velocidad ni la aceleración sola pasan
   de ahí) y cada tick son 1/60 s de juego, o sea 1000/240 ms de reloj.
   Después el tablero tarda 0,4 s en bajar antes de poder lanzar otra vez.
   El reloj (`activo`) y la física avanzan con el mismo `dt` de cada cuadro,
   así que esto lo cumple cualquier partida jugada en el juego, con
   cualquier pantalla: la holgura (3 % y 25 ms) solo cubre el redondeo a
   milisegundos de los instantes. Una prueba fabricada con instantes
   inventados, en cambio, tiene que respetarlo tiro a tiro. */
const MS_TICK = 1000 * M.TICK / M.PACE_MAX;
const BAJADA_MS = 400;
const FACTOR = .97, HOLGURA_MS = 25;
const minimoTras = ticks => (ticks * MS_TICK + BAJADA_MS) * FACTOR - HOLGURA_MS;

/* Cada tanto, ceder el hilo: una partida de 400 rondas son unos segundos
   de física, y en el navegador eso corre en la página de Juegos. */
const cede = () => new Promise(r => setTimeout(r, 0));

/* `ctx.uid` (o `dato.uid`), si la página lo pasa: la prueba tiene que ser
   de esa cuenta. La cuenta entra en la semilla de las filas, así que una
   prueba copiada de otra persona y re-etiquetada no rehace la misma
   partida; sin el uid del lado del verificador, lo que se puede comprobar
   es que la prueba sea coherente consigo misma. */
export async function verifica(dato, prueba, ctx) {
  if (!dato || dato.categoria !== 'club-bbtan-rondas') return 'Categoría desconocida para BBTAN.';
  if (!prueba || typeof prueba !== 'object' || prueba.v !== 1) return 'La prueba no tiene el formato de BBTAN.';
  if (!Number.isInteger(prueba.s) || prueba.s < 0 || prueba.s > 4294967295 || typeof prueba.u !== 'string' || prueba.u.length > 128 || typeof prueba.t !== 'string')
    return 'La prueba de la partida está incompleta.';
  const uid = (ctx && ctx.uid) || dato.uid;
  if (uid && prueba.u !== uid) return 'La prueba es de una partida de otra cuenta.';
  const puntos = dato.puntos;
  if (!Number.isSafeInteger(puntos) || puntos < 2) return 'Una partida de BBTAN se reporta desde la ronda 2.';
  const tiros = M.decodifica(prueba.t);
  if (!tiros) return 'Los tiros de la prueba no se pueden leer.';
  // Terminada, la ronda es la del último tiro; dejada a medias, la siguiente.
  const N = tiros.length;
  if (N !== puntos && N !== puntos - 1) return `La prueba trae ${N} tiros, que no llevan a la ronda ${puntos}.`;
  for (let i = 0, prev = 0; i < N; i++) {
    if (tiros[i][1] < prev) return 'Los instantes de los tiros van hacia atrás.';
    prev = tiros[i][1];
  }
  const gestos = leeGestos(prueba.h, N);
  if (!gestos) return 'La prueba no dice cómo se apuntaron los tiros.';
  const bot = pareceBot(tiros, gestos);
  if (bot) return bot;
  const E = M.nueva(prueba.s, prueba.u);
  let desde = Date.now();
  for (let i = 0; i < N; i++) {
    const ticks = M.juegaTiro(E, tiros[i]);
    if (typeof ticks === 'string') return `Tiro ${i + 1}: ${ticks}`;
    const sigue = i + 1 < N ? tiros[i + 1][1] : dato.tiempo;
    if (sigue - tiros[i][1] < minimoTras(ticks))
      return `Tras el tiro ${i + 1} pasó menos tiempo del que tardan las bolas en volver y el tablero en bajar.`;
    if (Date.now() - desde > 40) { await cede(); desde = Date.now(); }
  }
  if (E.round !== puntos) return `La partida rehecha llega a la ronda ${E.round}, no a la ${puntos}.`;
  return null;
}

/* Los gestos: uno por tiro, «<origen><espera>.<cambios>.<duración>» con
   los números en base 36 y en ms de reloj. El origen es r (ratón o lápiz), t
   (dedo), k (teclado), m (mando conectado) o x (un evento sintético sin
   mando: lo que despacha un script con dispatchEvent, isTrusted = false).
   La espera va desde que el tablero quedó quieto hasta el disparo; los
   cambios, cuántas veces se movió el ángulo; la duración, desde el primer
   cambio hasta el disparo. */
function leeGestos(h, N) {
  if (typeof h !== 'string') return null;
  const partes = N ? h.split(',') : (h ? null : []);
  if (!partes || partes.length !== N) return null;
  const out = [];
  for (const g of partes) {
    const m = /^([rtkmx])([0-9a-z]{1,7})\.([0-9a-z]{1,6})\.([0-9a-z]{1,7})$/.exec(g);
    if (!m) return null;
    out.push({ o: m[1], espera: parseInt(m[2], 36), n: parseInt(m[3], 36), dur: parseInt(m[4], 36) });
  }
  return out;
}

/* ¿Lo jugó una persona? Dos reglas duras, que una partida jugada a mano
   en el juego cumple siempre:
   - ningún tiro hecho (ni apuntado) con eventos sintéticos sin mando;
   - el ángulo solo cambia apuntando: un tiro con otro ángulo que el
     anterior y cero cambios es un estado tocado desde fuera.
   Y tres señales de robot, que solo rechazan juntas (dos de tres) y con al
   menos 15 tiros apuntados (sin contar los de mando, que apunta a saltos
   de la cruceta):
   A. Apuntar instantáneo: en el 60 % o más de los tiros apuntados, menos
      de 40 ms entre el primer cambio de ángulo y el disparo. Un clic sin
      mover el ratón ya dura 60–120 ms entre bajar y soltar, un toque en el
      teléfono parecido, y con teclado hay que soltar la flecha y pulsar
      espacio.
   B. Reacción inhumana: la mediana de la espera (desde que el tablero
      queda quieto hasta el disparo) bajo 150 ms. Es el tiempo de reacción
      simple de una persona, sin contar mirar el tablero nuevo y decidir.
   C. Metrónomo: el coeficiente de variación de esas esperas bajo 0,08. Las
      personas varían mucho de un tiro a otro (en las pruebas con ruido
      realista, más de 0,3).
   Una sola señal no basta: alguien que machaca el espacio sin apuntar o
   que toca muy rápido no debe quedar fuera por eso. */
const MIN_APUNTADOS = 15, INSTANTE_MS = 40, FRAC_INSTANTE = .6, REACCION_MS = 150, CV_MIN = .08;
function pareceBot(tiros, gestos) {
  for (let i = 0; i < tiros.length; i++) {
    if (gestos[i].o === 'x') return `El tiro ${i + 1} lo hizo un script (eventos sintéticos, sin mando conectado).`;
    const antes = i ? tiros[i - 1][0] : M.ANG_INICIAL;
    if (tiros[i][0] !== antes && gestos[i].n === 0) return `El tiro ${i + 1} cambió de ángulo sin que nadie apuntara.`;
  }
  const apuntados = gestos.filter(g => g.n > 0 && g.o !== 'm');
  if (apuntados.length < MIN_APUNTADOS) return null;
  const esperas = apuntados.map(g => g.espera).sort((a, b) => a - b);
  const mediana = esperas[esperas.length >> 1];
  const media = esperas.reduce((a, b) => a + b, 0) / esperas.length;
  const cv = media > 0 ? Math.sqrt(esperas.reduce((a, b) => a + (b - media) * (b - media), 0) / esperas.length) / media : 0;
  const senales = [
    apuntados.filter(g => g.dur < INSTANTE_MS).length >= FRAC_INSTANTE * apuntados.length && 'apunta al instante',
    mediana < REACCION_MS && `reacciona en ${mediana} ms`,
    cv < CV_MIN && 'dispara con ritmo de metrónomo',
  ].filter(Boolean);
  return senales.length >= 2 ? `Los tiros no parecen de una persona: ${senales.join(', ')}.` : null;
}

/* Una fila guardada sin prueba. Dos umbrales:
   - Imposible: cada ronda pasada tarda al menos lo que baja el tablero
     (0,4 s), haga lo que haga quien juega.
   - Inverosímil: con 30 rondas o más, menos de 0,9 s por ronda de media.
     Un robot que apunta sin pensar, nunca recoge antes y juega a ×4 desde
     el primer cuadro (lo que el juego no permite: arranca a ×1, o ×3 con el
     botón) promedia 2 s por ronda en sus primeras 30 y 2,8 s en 120
     (medido con el motor); 0,9 s deja más del doble de margen. */
export function sospecha(categoria, fila) {
  if (categoria !== 'club-bbtan-rondas' || !fila) return null;
  const puntos = +fila.puntos, tiempo = +fila.tiempo;
  if (!Number.isSafeInteger(puntos) || puntos < 1) return 'La ronda guardada no es un número válido.';
  if (!(tiempo > 0)) return 'El tiempo guardado no es válido.';
  const pasadas = puntos - 1;
  if (pasadas > 0 && tiempo < pasadas * BAJADA_MS * FACTOR)
    return `${puntos} rondas en ${(tiempo / 1000).toFixed(1)} s: solo bajar el tablero tarda 0,4 s por ronda.`;
  if (pasadas >= 30 && tiempo < pasadas * 900)
    return `${puntos} rondas a ${(tiempo / pasadas / 1000).toFixed(2)} s por ronda: más rápido de lo que vuelven las bolas.`;
  return null;
}
