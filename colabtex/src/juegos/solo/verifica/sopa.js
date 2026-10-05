/* Verificador antitrampas de la Sopa de letras (docs/antitrampas/sopa.md).

   La prueba dice de qué sopa se trata (la diaria por su fecha, la libre
   por semilla, tema, dificultad y tamaño) y trae cada selección que
   encontró una palabra con su instante. Se rehace con el motor del juego
   (`SopaMotor.rehace`, el mismo archivo que corre en la pantalla): tiene
   que ser la sopa de la categoría, encontrar todas las palabras, y el
   tiempo declarado no puede ser menor que el de la última palabra.

   Después, la capa anti-bot (hay bots que juegan partidas válidas a
   velocidad inhumana: en las tablas hay sopas de 6 palabras en 0,18 s y
   de 13 en 4,5 s, y filas de 1 ms, que es un script jugando con la
   pestaña oculta, donde el reloj del juego no corre):
   - ritmo: un tiempo total por palabra, la primera no antes de un tiempo
     de reacción, y no cuatro palabras seguidas en menos de lo que cuestan
     tres arrastres;
   - forma del gesto: cada palabra es un arrastre, y la prueba trae su
     duración, cuántos pointermove tuvo y si algún evento fue sintético
     (`isTrusted` falso sin un mando conectado) o llegó con la pestaña
     oculta;
   - regularidad: un ritmo de metrónomo entre palabras, solo como señal
     débil (hay pocas palabras para medirlo).
   Un bot que conoce la sopa (la diaria sale de la fecha, la libre de la
   semilla) y la marca con eventos de verdad a ritmo humano no se
   distingue: ese es el límite honesto. */
import SM from '../../../../../juegos/club/sopa/motor.js';

export const PRUEBA = 1;

/* La sopa salió el 1 de octubre de 2026 (git log de juegos/club/sopa):
   nadie puede llevar más días de racha que los que van desde entonces. */
const LANZAMIENTO = '2026-10-01';

/* Lo mínimo por palabra en promedio: hay que leer la lista, encontrarla
   en la grilla y arrastrar. No hay récords publicados del género; en las
   tablas reales, quien sigue a los bots tarda 4–35 s en las de 6 palabras.
   450 ms por palabra es la de 8×8 en 2,7 s, la de 12×12 en 4,5 s y la de
   15×15 en 5,9 s: por debajo del más rápido que parece humano (4 s en 6
   palabras), y por encima de los bots vistos (0,18 s, 0,93 s; 10 palabras
   en 2,5 s; 13 en 4,5 s). */
const MS_POR_PALABRA = 450;
/* La primera palabra no llega antes de un tiempo de reacción humano
   desde que aparece la sopa (~150 ms ver algo y empezar a moverse; aquí
   además hay que encontrarla y arrastrarla, así que sobra margen). */
const PRIMERA_MS = 150;
/* Cuatro palabras encontradas (cuatro pointerup) en menos de 600 ms son
   tres arrastres completos —llevar el dedo al inicio, arrastrar, soltar—
   de 200 ms cada uno sin pensar nada entre medio: eso es un script. */
const RAFAGA = 4, RAFAGA_MS = 600;
/* Un arrastre «instantáneo»: menos de 40 ms entre apretar y soltar, o
   menos de dos pointermove en medio. Una mano que cruza cuatro o más
   letras tarda 80 ms o más y el navegador da un pointermove por cuadro
   (~16 ms); un script salta del inicio al fin. Que lo sean casi todas
   (75 %, con al menos 4 palabras) rechaza; la mitad es solo una señal
   débil (un arrastre corto y brusco le puede salir a cualquiera). */
const INSTANTANEO_MS = 40, INSTANTANEO_MOV = 2;
/* Ritmo de metrónomo: coeficiente de variación de los intervalos entre
   palabras. Una persona tarda 1 s en una y 20 s en otra (CV ≥ 0,5 es lo
   normal); con 8 o más palabras, menos de 0,15 es una señal débil. */
const CV_MIN = 0.15, CV_PALABRAS = 8;
const F_SINTETICO = 1, F_OCULTA = 4;

/* Cuántos días de racha caben como mucho hasta `fecha`. */
const rachaMaxima = fecha => SM.numeroDia(fecha) - SM.numeroDia(LANZAMIENTO) + 1;

const cv = xs => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return m > 0 ? Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / xs.length) / m : 0;
};

function ritmoHumano(r, tiempo) {
  const {tiempos, gestos} = r, palabras = tiempos.length;
  /* Señales fuertes: cada una basta. */
  if (gestos.some(g => g.f & F_SINTETICO)) return 'Hay jugadas hechas con eventos sintéticos (un script, no el ratón ni el dedo).';
  if (gestos.filter(g => g.f & F_OCULTA).length >= 2) return 'Hay palabras marcadas con la pestaña oculta: eso no lo hace una persona.';
  if (tiempo < palabras * MS_POR_PALABRA) return `Encontrar ${palabras} palabras en ${(tiempo / 1000).toFixed(1)} s no es humano.`;
  if (tiempos[0] < PRIMERA_MS) return 'La primera palabra llegó antes de que una persona alcance a reaccionar.';
  for (let k = RAFAGA - 1; k < palabras; k++)
    if (tiempos[k] - tiempos[k - RAFAGA + 1] < RAFAGA_MS) return `${RAFAGA} palabras marcadas en menos de ${RAFAGA_MS} ms: demasiado rápido para una persona.`;
  const instantaneos = gestos.filter(g => g.dur < INSTANTANEO_MS || g.mov < INSTANTANEO_MOV).length / palabras;
  if (palabras >= 4 && instantaneos >= 0.75) return 'Casi todas las palabras se marcaron sin arrastrar (de un salto): eso es un script.';
  /* Señales débiles: solo juntas. */
  const intervalos = tiempos.map((t, k) => t - (k ? tiempos[k - 1] : 0));
  const debiles = (instantaneos >= 0.5 ? 1 : 0) + (palabras >= CV_PALABRAS && cv(intervalos) < CV_MIN ? 1 : 0);
  if (debiles >= 2) return 'Ritmo de metrónomo y arrastres de un salto: parece un script.';
  return null;
}

/* `ctx.ahora` (opcional) es el instante contra el que se mira la fecha de
   la diaria: por omisión, ahora. La auditoría de una prueba guardada
   debería pasar el `at` con que se escribió (docs/antitrampas/sopa.md). */
export function verifica(dato, prueba, ctx) {
  if (!prueba || typeof prueba !== 'object') return 'La partida llegó sin prueba.';
  const racha = dato.categoria === 'club-sopa-racha';
  if (racha ? prueba.m !== 'd' : prueba.m !== 'l') return 'La prueba es de otro modo de juego.';
  if (!racha) {
    const m = /^club-sopa-(facil|medio|dificil)-(8|12|15)$/.exec(dato.categoria);
    if (!m || prueba.d !== m[1] || prueba.n !== +m[2]) return 'La prueba es de otra dificultad o de otro tamaño.';
  } else {
    const hoy = SM.diaChile(new Date(ctx && Number.isFinite(ctx.ahora) ? ctx.ahora : Date.now()));
    if (prueba.f !== hoy && prueba.f !== SM.diaAnterior(hoy)) return 'La prueba no es la sopa diaria de hoy.';
    if (dato.puntos > rachaMaxima(prueba.f)) return `Una racha de ${dato.puntos} días no cabe: la sopa existe desde el ${LANZAMIENTO}.`;
  }
  const r = SM.rehace(prueba);
  if (r.error) return r.error;
  const n = r.sopa.palabras.length;
  if (r.encontradas !== n) return 'La prueba no encuentra todas las palabras.';
  if (!racha && dato.puntos !== n) return 'Los puntos no son las palabras de esa sopa.';
  const fin = r.tiempos[n - 1];
  if (dato.tiempo < fin) return 'El tiempo declarado es menor que el de las jugadas.';
  return ritmoHumano(r, dato.tiempo);
}

/* Una fila guardada sin prueba: el mismo piso de tiempo por palabra, y
   para la racha, los días que van desde el lanzamiento. */
export function sospecha(categoria, fila) {
  if (categoria === 'club-sopa-racha') {
    if (fila.puntos > rachaMaxima(SM.diaChile())) return `racha de ${fila.puntos} días: la sopa existe desde el ${LANZAMIENTO}`;
    if (fila.tiempo < SM.TAMANOS[SM.DIARIA.tam] * MS_POR_PALABRA) return `la diaria en ${(fila.tiempo / 1000).toFixed(1)} s`;
    return null;
  }
  const m = /-(8|12|15)$/.exec(categoria);
  const palabras = m ? SM.TAMANOS[m[1]] : 0;
  if (palabras && fila.tiempo < palabras * MS_POR_PALABRA) return `${palabras} palabras en ${(fila.tiempo / 1000).toFixed(1)} s`;
  return null;
}
