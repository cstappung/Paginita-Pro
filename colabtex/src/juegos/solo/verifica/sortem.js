/* Verificador antitrampas de sortEm (ver docs/antitrampas.md y
   docs/antitrampas/sortem.md).

   La prueba que manda el juego (`GameState.prueba()` en
   juegos/club/sortem/game.js):

     {v: 1, n: 10|20, s: semilla (uint32), d: Date.now() al empezar,
      w: ms de reloj de pared hasta la jugada ganadora,
      a: 'RRAlLA…'   una letra por tecla que llegó al tablero (L, R, A);
                     minúscula = autorrepetición del teclado (ev.repeat),
      t: [ms…]       instante de cada una, como diferencia con la anterior
                     (la primera, desde la tecla que empezó la partida),
      f: '..m.'      origen: '.' teclado de verdad (isTrusted), 'm' un mando
                     a través de mando.js con un mando conectado, 'u' un
                     evento sintético sin mando (un script),
      k: [ms|-1…]    cuánto se mantuvo apretada cada tecla (-1: no se supo;
                     las autorrepeticiones no tienen)}

   Se rehace con el mismo motor puro que juega la página
   (juegos/club/sortem/motor.js): el reparto sale de la semilla y cada
   letra se aplica igual que en pantalla. La partida tiene que quedar
   ordenada justo en la última tecla, y el tiempo declarado tiene que ser
   el que dan esos instantes (`tiempoDe`). Después vienen los límites
   humanos, todos con holgura: un falso positivo (rechazar a alguien
   honesto) es peor que dejar pasar una trampa rara. */
import Motor from '../../../../../juegos/club/sortem/motor.js';

export const PRUEBA = 1;

/* Tiempo total mínimo, en ms. Las mejores marcas reales que se conocen
   son 3,51 s en el de 10 (el resto, 4–14 s) y 23,6 s en el de 20, más
   una de 10,2 s que nadie más se acerca a hacer. El de 20 pide unas tres
   veces más teclas que el de 10 (un solucionador óptimo: mediana 24
   teclas en el de 10, con repartos de suerte de 16), así que alguien tan
   rápido como la marca de 3,51 s andaría por 10–11 s en el de 20. Pero
   hay repartos de suerte (17 teclas en el de 10, 52 en el de 20) y a ese
   mismo ritmo salen en ~2 s y ~6,5 s: los pisos quedan por debajo, en
   1,5 s y 5 s. Lo que de verdad mide es el ritmo por pulsación (abajo). */
export const MINIMO = { 10: 1500, 20: 5000 };

/* La primera tecla no se aplica antes de 210 ms (la pantalla de inicio
   bloquea la entrada 200 ms al empezar); 150 ms es el tiempo de reacción
   humano más corto y el juego nunca baja de ahí. */
export const PRIMERA = 150;

/* Ritmo de pulsaciones (las teclas apretadas, no las autorrepeticiones de
   una tecla mantenida, que pone el sistema operativo y pueden ir a
   15–33 ms o menos):
   - diez pulsaciones seguidas no caben en menos de 300 ms (33 por
     segundo). Lo más rápido que se mide en golpeteo con dos dedos anda en
     15–20 por segundo, y las ráfagas de los mecanógrafos más rápidos en
     ~25; aquí además hay que decidir qué bloque mover.
   - en toda la partida, 75 ms por pulsación de media como mucho (13 por
     segundo contando la lectura del tablero y las pausas para pensar). La
     marca de 3,51 s, con unas 25–30 teclas, son 120–160 ms por pulsación;
     en el speedcubing, donde además se estudia el cubo 15 s antes de
     empezar, los mejores sostienen 10–13 giros por segundo. */
export const VENTANA = 10, VENTANA_MS = 300, MEDIA_MS = 75;

/* Regularidad (bots de ritmo fijo). Con 15 intervalos o más entre
   pulsaciones de teclado:
   - un coeficiente de variación por debajo de 0,05 es un metrónomo: una
     persona que resuelve un rompecabezas alterna ráfagas con pausas para
     pensar (en las partidas humanas el CV pasa holgadamente de 0,5).
     Eso solo ya rechaza.
   - lo demás solo rechaza junto, y siempre con una señal de las teclas
     mismas: o casi ninguna se soltó (sin keyup en más del 70 % de las
     pulsaciones: un teclado de verdad siempre suelta, un script que solo
     manda keydown no), o todas duran lo mismo (CV < 0,05) o casi nada
     (mediana < 8 ms: un dedo tarda bastante más en soltar). Eso, más un
     ritmo parejo (CV < 0,15) o más de 10 pulsaciones por segundo de media
     en toda la partida, rechaza. Ritmo parejo y rapidez solos no: una
     persona muy rápida y constante podría juntar las dos. */
export const REGULAR_MIN = 15, CV_BOT = 0.05, CV_SOSPECHA = 0.15;

/* Para lo que ya está guardado sin prueba: marcas que piden revisión a
   mano. La de 10 deja pasar la mejor real (3,51 s); la de 20 marca la de
   10,2 s, que es menos de la mitad de todas las demás. */
export const SOSPECHA = { 10: 2500, 20: 12000 };

const LIMITE_ACCIONES = 20000;

function cv(xs) {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  if (m <= 0) return 0;
  const v = xs.reduce((s, x) => s + (x - m) * (x - m), 0) / xs.length;
  return Math.sqrt(v) / m;
}
function mediana(xs) {
  const o = xs.slice().sort((x, y) => x - y);
  return o.length ? o[o.length >> 1] : 0;
}
const entero = x => Number.isSafeInteger(x) && x >= 0;

export function verifica(dato, p) {
  const n = Number(String(dato && dato.categoria).slice(12));
  if (!Motor.MODOS.includes(n) || dato.puntos !== n) return 'La categoría o los puntos no son de sortEm.';
  if (!p || typeof p !== 'object') return 'La partida llegó sin prueba.';
  if (p.v !== 1) return 'La prueba es de una versión desconocida del juego.';
  if (p.n !== n) return 'La prueba es de otro modo de juego.';
  if (!entero(p.s) || p.s > 0xFFFFFFFF) return 'La prueba no trae el reparto.';
  const {a, t, f, k} = p;
  if (typeof a !== 'string' || !/^[LRAlra]+$/.test(a) || a.length > LIMITE_ACCIONES) return 'Las jugadas de la prueba no se pueden leer.';
  const L = a.length;
  if (!Array.isArray(t) || t.length !== L || !t.every(entero)) return 'Los instantes de la prueba no se pueden leer.';
  if (typeof f !== 'string' || f.length !== L || !/^[.mu]*$/.test(f)) return 'La prueba no dice de dónde vino cada tecla.';
  if (!Array.isArray(k) || k.length !== L || !k.every(x => Number.isSafeInteger(x) && x >= -1)) return 'La prueba no trae las pulsaciones.';
  if (!entero(p.w)) return 'La prueba no trae el reloj.';

  /* 1. Rehacer la partida. */
  const {ganaEn, despues} = Motor.repite(n, p.s, a.toUpperCase());
  if (ganaEn < 0) return 'Con esas jugadas los números no quedan ordenados.';
  if (despues > 0 || ganaEn !== L - 1) return 'La prueba sigue jugando después de ordenar.';

  /* 2. El tiempo: el de las teclas (o el del reloj de pared, si vio
     claramente más; ver tiempoDe en el motor). */
  let T = 0;
  for (const x of t) T += x;
  if (!Number.isSafeInteger(T)) return 'Los instantes de la prueba no se pueden leer.';
  if (dato.tiempo !== Motor.tiempoDe(T, p.w)) return 'El tiempo declarado no es el de la partida.';

  /* 3. El origen: una tecla sintética sin mando conectado es un script. */
  const u = f.indexOf('u');
  if (u >= 0) return 'Hay teclas simuladas por un script (no vienen del teclado ni de un mando).';

  /* 4. Lo humano. */
  if (t[0] < PRIMERA) return 'La primera jugada llegó antes de lo que tarda una persona en reaccionar.';
  if (T < MINIMO[n]) return 'Tiempo imposible para una persona (' + (T / 1000).toFixed(2) + ' s).';

  /* Las pulsaciones: todo menos las autorrepeticiones verosímiles. Una
     minúscula solo puede repetir la tecla de justo antes (el sistema
     operativo repite la última tecla apretada); si no, cuenta como
     pulsación, para que marcar todo como «repetición» no sirva de
     escondite. La primera puede ser una repetición de la tecla que empezó
     la partida, que llegó durante la transición. */
  const inst = [];
  let c = 0;
  for (let i = 0; i < L; i++) inst.push(c += t[i]);
  const pulsa = [];
  for (let i = 0; i < L; i++) {
    const ch = a[i];
    const repite = ch !== ch.toUpperCase() && (i === 0 || a[i - 1].toUpperCase() === ch.toUpperCase());
    if (!repite) pulsa.push(i);
  }
  for (let j = 0; j + VENTANA - 1 < pulsa.length; j++) {
    if (inst[pulsa[j + VENTANA - 1]] - inst[pulsa[j]] < VENTANA_MS) return 'Teclas demasiado rápidas para una persona (' + VENTANA + ' en menos de ' + VENTANA_MS + ' ms).';
  }
  if (pulsa.length && T / pulsa.length < MEDIA_MS) return 'Ritmo de teclas imposible para una persona en toda la partida.';

  /* 5. Regularidad: intervalos entre pulsaciones seguidas. Las del mando
     cuentan igual: sortEm no le da teclas propias al mando (mando.js lo
     deja de cursor), y un script puede marcar sus eventos `__mando` con un
     mando enchufado, así que su ritmo se mira como el del teclado. */
  const intervalos = [];
  for (let j = 1; j < pulsa.length; j++) intervalos.push(inst[pulsa[j]] - inst[pulsa[j - 1]]);
  if (intervalos.length >= REGULAR_MIN) {
    const cvi = cv(intervalos);
    if (cvi < CV_BOT) return 'Teclas a ritmo de metrónomo: no parece una persona.';
    const senales = [];
    const holds = pulsa.map(i => k[i]);
    const sabidas = holds.filter(x => x >= 0);
    if (holds.length >= REGULAR_MIN && sabidas.length < holds.length * 0.3) senales.push('teclas que nunca se sueltan');
    else if (sabidas.length >= REGULAR_MIN && (cv(sabidas) < CV_BOT || mediana(sabidas) < 8)) senales.push('pulsaciones de duración mecánica');
    if (senales.length && cvi < CV_SOSPECHA) senales.push('ritmo demasiado parejo');
    if (senales.length && T / pulsa.length < 100) senales.push('más de 10 teclas por segundo');
    if (senales.length >= 2) return 'La partida parece jugada por un programa: ' + senales.join(', ') + '.';
  }
  return null;
}

/* Una fila ya guardada en soloRanks ({nombre, puntos, tiempo, partida}),
   sin prueba: null si es verosímil, o el motivo si pide revisión. */
export function sospecha(categoria, fila) {
  const n = Number(String(categoria).slice(12));
  if (!Motor.MODOS.includes(n) || !fila) return null;
  if (fila.puntos !== n) return 'los puntos no son los del modo (' + fila.puntos + ' en vez de ' + n + ')';
  if (!(fila.tiempo >= SOSPECHA[n])) return 'ordenar ' + n + ' números en ' + (Number(fila.tiempo) / 1000).toFixed(2) + ' s es inverosímil (la mejor marca humana conocida del de 10 es 3,51 s y las del de 20 pasan de 23 s)';
  return null;
}
