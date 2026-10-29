/* Verificador antitrampas de Type Race (ver docs/antitrampas.md y
   docs/antitrampas/typerace.md).

   Una tabla por largo, solo en inglés y con palabras al azar:
   `club-typerace-en-<10|25|50|100|200>`; puntos = las ppm de la carrera
   (palabras por minuto, enteras) y tiempo = los ms desde la primera letra
   hasta la meta.

   El juego manda `{v: 1, u, s, e, a, w}`: la cuenta, la semilla, cada
   entrada del campo de texto como [0, lo que decía el campo, ms desde la
   anterior] (o [1, '', ms] al borrar para volver a una palabra mal
   escrita) y lo corrido en los dos relojes. Aquí se vuelve a escribir la
   carrera entera con el MISMO motor (`juegos/typerace/motor.js`):

   - el texto sale de la semilla y de la cuenta (`semillaDe`), así que una
     prueba copiada de otra persona reparte otras palabras y no se rehace;
   - la carrera tiene que llegar a la meta y las ppm y el tiempo tienen que
     salir exactos;
   - ninguna entrada sintética (`x`: isTrusted falso);
   - el reloj del juego y el del sistema tienen que coincidir.

   La mano: nadie teclea más de unos 25 caracteres por segundo de forma
   sostenida (300 ppm) ni mete veinte entradas seguidas a menos de 20 ms. Es
   el límite honesto: un programa que teclee a ritmo de persona, con
   eventos de verdad, saca una prueba válida. */
import M from '../../../../../juegos/typerace/motor.js';
import { rachas, dosRelojes } from './patrones.js';

export const PRUEBA = 1;

const CAT = /^club-typerace-en-(10|25|50|100|200)$/;
const MAX_PPM = 330, MIN_PRECISION = 75, MAX_ENTRADAS = 12000, MAX_CAMPO = 60, MAX_DT = 600000;
const RAFAGA = 20, RAPIDO = 20;

export function verifica(dato, prueba, ctx) {
  const m = dato && CAT.exec(String(dato.categoria));
  if (!m) return 'Type Race no tiene esa tabla.';
  const largo = Number(m[1]);
  if (!prueba || typeof prueba !== 'object' || Array.isArray(prueba)) return 'La prueba de Type Race no tiene la forma esperada.';
  if (prueba.v !== 1) return 'La prueba es de otra versión de Type Race (recarga la página).';
  const uid = (ctx && ctx.uid) || dato.uid;
  if (typeof prueba.u !== 'string') return 'La prueba no dice de qué cuenta es.';
  if (uid && prueba.u !== uid) return 'La prueba es de una carrera de otra cuenta.';
  if (!Number.isSafeInteger(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla de la carrera no es válida.';
  const puntos = Number(dato.puntos), tiempo = Number(dato.tiempo);
  if (!(Number.isSafeInteger(puntos) && puntos >= 1 && puntos <= MAX_PPM)) return 'Las ppm no son válidas.';
  if (!Number.isSafeInteger(tiempo) || tiempo < 1) return 'El tiempo no es válido.';
  const reloj = dosRelojes(prueba.a, prueba.w);
  if (reloj) return reloj;
  const ev = prueba.e;
  if (!Array.isArray(ev) || !ev.length || ev.length > MAX_ENTRADAS) return 'Las entradas de la prueba no se pueden leer.';
  for (const e of ev) {
    if (!Array.isArray(e) || e.length < 3 || e.length > 4) return 'Hay una entrada de la prueba que no se puede leer.';
    if (e[0] !== 0 && e[0] !== 1) return 'Hay una entrada de la prueba que no se puede leer.';
    if (typeof e[1] !== 'string' || e[1].length > MAX_CAMPO || (e[0] === 1 && e[1] !== '')) return 'Hay una entrada de la prueba que no se puede leer.';
    if (!Number.isSafeInteger(e[2]) || e[2] < 0 || e[2] > MAX_DT) return 'Hay una pausa de la prueba que no es válida.';
    if (e.length === 4 && e[3] === 'x') return 'La carrera trae pulsaciones que no hizo una mano (eventos sintéticos).';
  }
  if (ev[0][2] !== 0) return 'La primera entrada de la prueba no puede traer pausa.';
  const res = M.rehace(prueba.s, prueba.u, largo, ev);
  if (res.error) return res.error;
  const c = res.c;
  if (!c) return 'La carrera rehecha no llega a la meta.';
  if (c.ppm !== puntos) return `La carrera rehecha da ${c.ppm} ppm, no ${puntos}.`;
  if (c.ms !== tiempo) return 'El tiempo declarado no es el de la carrera.';
  if (c.prec < MIN_PRECISION) return `La precisión (${c.prec} %) es demasiado baja para clasificar.`;
  if (Number.isFinite(prueba.a) && c.ms > prueba.a + 1000) return 'Las pulsaciones suman más tiempo del que se jugó.';
  return mano(ev, c);
}

function mano(ev, c) {
  if (c.ppm > MAX_PPM) return `${c.ppm} ppm: más de lo que teclea una persona.`;
  const d = ev.filter(e => e[0] === 0 && e[1] !== '').map(e => e[2]);
  if (rachas(d.slice(1), x => x < RAPIDO).larga >= RAFAGA)
    return `${RAFAGA} entradas seguidas a menos de ${RAPIDO} ms: así teclea un programa, no una mano.`;
  return null;
}

/* Una fila ya guardada, sin su prueba a mano: solo se puede mirar el tope. */
export function sospecha(categoria, fila) {
  if (!CAT.test(String(categoria)) || !fila) return null;
  const p = Number(fila.puntos);
  if (!Number.isFinite(p)) return null;
  return p > MAX_PPM ? `${p} ppm: más de lo que teclea una persona.` : null;
}
