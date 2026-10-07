/* Verificador antitrampas de Sudoku Arcade (docs/antitrampas/sudoku.md).

   La prueba dice qué sudoku era (el diario por su fecha; el clásico por
   semilla y dificultad; el arcade por semilla) y trae cada cambio del
   tablero —o, en el arcade, cada número intentado— con su instante. Se
   rehace con el motor del juego (`SudokuMotor.rehace`, el mismo archivo
   que corre en la pantalla):
   - diario y clásico: el tablero tiene que terminar resuelto, cada pista
     tiene que haber sumado sus 30 s, y el tiempo declarado no puede ser
     menor que el de la última jugada;
   - arcade: los puntos se recalculan con las mismas reglas (combo,
     unidades, vidas, bonos de tiempo y de vidas) y tienen que dar justo lo
     declarado; la partida tiene que haber terminado (resuelta o sin vidas).
   Después, la capa anti-bot. Hay bots que juegan partidas válidas a
   velocidad inhumana (en las tablas: un experto en 90 s y un arcade de
   30 266 puntos en 105 s, contra 584 s del siguiente), así que una
   partida que el motor acepta no basta:
   - ritmo: pisos de tiempo por dificultad, la primera jugada no antes de
     un tiempo de reacción, y nada de diez celdas resueltas en un segundo;
   - forma de cada jugada: si el evento que la hizo fue sintético
     (`isTrusted` falso sin un mando conectado), si llegó con la pestaña
     oculta, y cuántos ms pasaron desde la entrada anterior (elegir la
     celda y escribir el número son dos gestos; un script los hace a la vez);
   - regularidad: un ritmo de metrónomo entre jugadas.
   Los pisos de tiempo quedan holgados a propósito (un falso positivo es
   peor que una trampa rara): el experto en 90 s o el arcade en 105 s
   caen por la forma de las jugadas, no por el reloj. Un bot que escribe
   con eventos de verdad, de a una celda, con pausas irregulares de
   persona, no se distingue: ese es el límite honesto. */
import SM from '../../../../../juegos/club/sudoku/motor.js';
import { rachas, dosRelojes } from './patrones.js';

export const PRUEBA = 1;

/* El sudoku salió el 4 de octubre de 2026 (git log de juegos/club/sudoku):
   nadie puede llevar más días de racha que los que van desde entonces. */
const LANZAMIENTO = '2026-10-04';

/* El tiempo más corto creíble para resolver un sudoku entero de cada
   dificultad, sin pistas. Las marcas de los mejores del mundo en sudokus
   clásicos fáciles rondan el minuto, y los difíciles (con X-Wing y
   compañía) varios minutos; además, solo escribir 45–55 cifras con ratón
   (celda + número) cuesta 20 s o más. Estos pisos quedan muy por debajo de
   todo eso, para que nadie honesto quede cerca: los cruza un programa. */
const PISO = {facil: 20000, medio: 30000, dificil: 45000, experto: 60000};
/* Diez celdas tomando su valor final en menos de 1,2 s son 120 ms por
   celda, cada una con su clic (o sus flechas) y su número: más de quince
   teclas por segundo sostenidas, que nadie hace. Se miran los valores
   *finales*, no cada pulsación: dejar apretada una tecla (la repetición
   del teclado pone y quita el número cada 30 ms) es algo que pasa jugando
   y no debe contar. */
const RAFAGA = 10, RAFAGA_MS = 1200;
/* La primera jugada no llega antes de un tiempo de reacción humano desde
   que aparece el tablero (~150 ms solo ver y moverse; aquí además hay que
   leer el sudoku, así que el margen es enorme). */
const PRIMERA_MS = 150;
/* Metrónomo: el coeficiente de variación de los intervalos entre jugadas.
   Una persona pone una celda en 1 s y la siguiente en 40 (CV ≥ 0,7 es lo
   normal). Con 20 intervalos o más, menos de 0,05 basta para rechazar;
   menos de 0,15 es una señal débil. */
const CV_FIJO = 0.05, CV_DEBIL = 0.15, CV_INTERVALOS = 20;
/* Entrada «pegada»: menos de GAP_MS desde la entrada anterior (el clic en
   la celda o la flecha) hasta la que escribe. Elegir la celda y escribir
   son dos gestos: con ratón hay que llevarlo al teclado de la pantalla,
   con teclado son dos teclas. Dos teclas casi a la vez pasan (un rollover
   de 10–30 ms), así que una sola no dice nada: con 15 jugadas o más, el
   90 % pegadas rechaza y el 60 % es señal débil. */
const GAP_MS = 40, GAP_FIJO = 0.9, GAP_DEBIL = 0.6, GAP_JUGADAS = 15;
const F_SINTETICO = 1, F_OCULTA = 4;
const cv = xs => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return m > 0 ? Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / xs.length) / m : 0;
};

const rachaMaxima = fecha => SM.numeroDia(fecha) - SM.numeroDia(LANZAMIENTO) + 1;
/* El arcade más alto posible, con margen: 64 celdas vacías (17 pistas, el
   mínimo de un sudoku de solución única), las 27 unidades cerradas, nueve
   triples, todo a ×4, más el bono de tiempo entero y las tres vidas. */
const MAX_ARCADE = 4 * (SM.PUNTOS.acierto * 64 + SM.PUNTOS.unidad * 27 + SM.PUNTOS.triple * 9) +
  SM.REFERENCIA.medio * SM.PUNTOS.porSegundo + SM.VIDAS_ARCADE * SM.PUNTOS.vida;

/* El orden de lectura. Una persona resuelve por donde ve una deducción:
   salta de una caja a otra, sigue un número por el tablero, vuelve atrás.
   Un programa que ya tiene la solución la escribe celda por celda, de
   izquierda a derecha y de arriba abajo. Se mira el orden en que cada
   celda recibe su valor correcto: la racha más larga de índices
   crecientes y la fracción de pasos que avanzan. Calibrado con las tablas:
   las personas no pasan de 6 seguidas ni del 56 %; el bot del experto en
   90 s escribe 43 seguidas (100 %). Un orden aleatorio da un 50 %, y 20
   seguidas al azar tienen una probabilidad de 1/20! ≈ 4·10⁻¹⁹. */
const ORDEN_RACHA = 20, ORDEN_FRACCION = 0.75, ORDEN_CELDAS = 30;

export function ordenLectura(sudoku, j) {
  const orden = [];
  for (let k = 0; k + 1 < j.length; k += 5) {
    const i = j[k], v = j[k + 1];
    if (v >= 1 && v <= 9 && v === sudoku.solucion[i]) orden.push(i);
  }
  const pasos = orden.slice(1).map((x, k) => x > orden[k]);
  return {
    celdas: orden.length,
    racha: orden.length ? rachas(pasos, x => x).larga + 1 : 0,
    fraccion: pasos.length ? pasos.filter(Boolean).length / pasos.length : 0,
  };
}

function ritmoHumano(r, dif, tiempo, j) {
  const acc = r.acciones;
  if (acc.some(a => a.f & F_SINTETICO)) return 'Hay jugadas hechas con eventos sintéticos (un script, no el teclado ni el ratón).';
  if (acc.filter(a => a.f & F_OCULTA).length >= 2) return 'Hay jugadas hechas con la pestaña oculta: eso no lo hace una persona.';
  if (acc.length && acc[0].t < PRIMERA_MS) return 'La primera jugada llegó antes de que una persona alcance a reaccionar.';
  /* El piso se reparte entre las celdas que resolvió la persona: si pidió
     pistas o perdió el arcade a la mitad, se le exige solo su parte. El
     tiempo de las pistas (30 s cada una) no cuenta como tiempo pensando. */
  const vacias = r.sudoku.pistas.filter(v => !v).length || 1;
  const piso = PISO[dif] * r.finales.length / vacias;
  const pensando = tiempo - r.pistas * SM.PENALIZA_PISTA;
  if (pensando < piso) return `Resolver ${r.finales.length} celdas en ${(pensando / 1000).toFixed(1)} s no es humano.`;
  for (let k = RAFAGA - 1; k < r.finales.length; k++)
    if (r.finales[k] - r.finales[k - RAFAGA + 1] < RAFAGA_MS) return `${RAFAGA} celdas resueltas en menos de ${(RAFAGA_MS / 1000).toFixed(1)} s: demasiado rápido para una persona.`;
  const intervalos = acc.slice(1).map(a => a.dt), variacion = intervalos.length >= CV_INTERVALOS ? cv(intervalos) : Infinity;
  if (variacion < CV_FIJO) return 'Las jugadas llegan a ritmo de metrónomo: eso es un script.';
  const pegadas = acc.length >= GAP_JUGADAS ? acc.filter(a => a.g < GAP_MS).length / acc.length : 0;
  if (pegadas >= GAP_FIJO) return 'Casi todas las jugadas eligen la celda y escriben a la vez: eso es un script.';
  if ((variacion < CV_DEBIL ? 1 : 0) + (pegadas >= GAP_DEBIL ? 1 : 0) >= 2) return 'Ritmo de metrónomo y celda y número a la vez: parece un script.';
  const o = ordenLectura(r.sudoku, j);
  if (o.racha >= ORDEN_RACHA) return `${o.racha} celdas seguidas resueltas en orden de lectura, de izquierda a derecha: así escribe la solución un programa.`;
  if (o.celdas >= ORDEN_CELDAS && o.fraccion >= ORDEN_FRACCION) return `El ${Math.round(o.fraccion * 100)} % de las celdas se resolvió avanzando en orden de lectura: ninguna deducción sigue ese orden.`;
  return null;
}

/* `ctx.ahora` (opcional) es el instante contra el que se mira la fecha del
   diario: por omisión, ahora. La auditoría de una prueba guardada debería
   pasar el `at` con que se escribió (docs/antitrampas/sudoku.md). */
export function verifica(dato, prueba, ctx) {
  if (!prueba || typeof prueba !== 'object') return 'La partida llegó sin prueba.';
  const cat = dato.categoria.slice('club-sudoku-'.length);
  const modo = cat === 'racha' ? 'd' : cat === 'arcade' ? 'a' : 'c';
  if (prueba.m !== modo) return 'La prueba es de otro modo de juego.';
  if (modo === 'c' && prueba.d !== cat) return 'La prueba es de otra dificultad.';
  if (modo === 'd') {
    const hoy = SM.diaChile(new Date(ctx && Number.isFinite(ctx.ahora) ? ctx.ahora : Date.now()));
    if (prueba.f !== hoy && prueba.f !== SM.diaAnterior(hoy)) return 'La prueba no es el sudoku diario de hoy.';
    if (dato.puntos > rachaMaxima(prueba.f)) return `Una racha de ${dato.puntos} días no cabe: el sudoku existe desde el ${LANZAMIENTO}.`;
  }
  const reloj = dosRelojes(prueba.a, prueba.w);  // desde sudoku-4
  if (reloj) return reloj;
  const r = SM.rehace(prueba);
  if (r.error) return r.error;
  if (dato.tiempo < r.fin) return 'El tiempo declarado es menor que el de las jugadas.';
  if (modo === 'a') {
    if (!r.gana && !r.pierde) return 'La partida de la prueba no terminó.';
    const puntos = SM.puntosFinalArcade(r.puntos, r.gana, r.vidas, dato.tiempo);
    if (puntos !== dato.puntos) return `Los puntos no cuadran: la partida da ${puntos}, no ${dato.puntos}.`;
  } else if (!r.resuelto) return 'La prueba no deja el sudoku resuelto.';
  return ritmoHumano(r, modo === 'c' ? cat : 'medio', dato.tiempo, prueba.j);
}

/* Para revisar a mano lo ya guardado sin prueba, el doble de los pisos:
   sin la forma de las jugadas no hay otra señal que el reloj, y la
   auditoría solo lista (decide una persona). En las tablas, el experto en
   90 s y el arcade en 105 s (contra 584 s del siguiente) caen aquí. Un
   arcade de 20 000 puntos o más es un tablero casi entero con combo alto. */
const PISO_REVISAR = {facil: 40000, medio: 60000, dificil: 90000, experto: 120000};
const ARCADE_REVISAR = {puntos: 20000, tiempo: 150000};

/* Una fila guardada sin prueba: los pisos para revisar (sin saber cuántas
   pistas pidió, se exige el piso entero: una pista suma 30 s, así que solo
   puede subir el tiempo), la racha contra el lanzamiento y el arcade
   contra el máximo posible y contra el reloj. */
export function sospecha(categoria, fila) {
  const cat = categoria.slice('club-sudoku-'.length);
  if (cat === 'racha') {
    if (fila.puntos > rachaMaxima(SM.diaChile())) return `racha de ${fila.puntos} días: el sudoku existe desde el ${LANZAMIENTO}`;
    if (fila.tiempo < PISO_REVISAR.medio) return `el diario en ${(fila.tiempo / 1000).toFixed(1)} s (revisar)`;
    return null;
  }
  if (cat === 'arcade') {
    if (fila.puntos > MAX_ARCADE) return `${fila.puntos} puntos: el arcade no da más de ${MAX_ARCADE}`;
    if (fila.puntos >= ARCADE_REVISAR.puntos && fila.tiempo < ARCADE_REVISAR.tiempo) return `${fila.puntos} puntos en ${(fila.tiempo / 1000).toFixed(0)} s (revisar)`;
    return null;
  }
  if (PISO_REVISAR[cat] && fila.tiempo < PISO_REVISAR[cat]) return `un sudoku ${cat} en ${(fila.tiempo / 1000).toFixed(1)} s (revisar)`;
  return null;
}
