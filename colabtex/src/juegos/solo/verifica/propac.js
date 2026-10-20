/* Verificador antitrampas de PRO PACMAN (ver docs/antitrampas.md y
   docs/antitrampas/propac.md).

   Una sola tabla, `club-propac-puntos`: puntos = el puntaje de la partida,
   tiempo = lo que duró en tiempo de juego (tics de 1/60 s). El juego manda
   `{v: 1, s, u, j, n, r, a, w}`: la semilla, la cuenta, cada jugada con su
   Δtics, código y origen (`j`, el texto de `codifica`), el tic final, los
   ms de reloj y lo jugado sin pausas en los dos relojes. Aquí se vuelve a
   jugar con el MISMO motor (`juegos/club/propac/motor.js`):

   - la partida rehecha tiene que llegar al tic `n` con exactamente los
     puntos declarados;
   - la cuenta va en la semilla del azar, así que una prueba copiada de otra
     persona no rehace la misma partida;
   - ninguna jugada sintética (`x`: isTrusted falso sin mando conectado);
   - el reloj real no puede ir más rápido que el del juego, y los dos
     relojes del navegador tienen que coincidir (`dosRelojes`);
   - la mano: un programa gira justo en el tic en que el jugador pisa el
     centro de la casilla; una persona aprieta antes (el giro queda
     guardado) o después, casi nunca en ese tic exacto. Muchos giros
     seguidos en el centro, con el jugador en marcha, delatan un programa.

   El límite honesto: un bot que apriete un tic antes del centro, con
   eventos de verdad, saca una prueba válida. */
import M from '../../../../../juegos/club/propac/motor.js';
import { rachas, dosRelojes } from './patrones.js';

export const PRUEBA = 1;

const CATEGORIA = 'club-propac-puntos';
export const MAX_PUNTOS = 10000000;
/* Giros seguidos en el tic exacto del centro. Una persona acierta ese tic
   más o menos una vez de cada ocho; doce seguidas no le pasan nunca. */
export const GIROS_CENTRO = 12;
/* Lo más que da el laberinto: unos 40 000 puntos por nivel en no menos de
   ~25 s de juego. Por encima, la fila es inverosímil. */
const PUNTOS_SEGUNDO = 1600;

const msDe = n => Math.max(1, Math.round(n * 1000 / M.TPS));

export function verifica(dato, prueba, ctx) {
  if (!dato || dato.categoria !== CATEGORIA) return 'PRO PACMAN no tiene esa tabla.';
  if (!prueba || typeof prueba !== 'object' || Array.isArray(prueba)) return 'La prueba de PRO PACMAN no tiene la forma esperada.';
  if (prueba.v !== 1) return 'La prueba es de otra versión de PRO PACMAN (recarga la página).';
  const uid = (ctx && ctx.uid) || dato.uid;
  if (typeof prueba.u !== 'string') return 'La prueba no dice de qué cuenta es.';
  if (uid && prueba.u !== uid) return 'La prueba es de una partida de otra cuenta.';
  if (!Number.isSafeInteger(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla de la partida no es válida.';
  const n = prueba.n;
  if (!Number.isSafeInteger(n) || n < 1 || n > M.MAX_TICS) return 'El final de la partida no es válido.';
  const puntos = Number(dato.puntos);
  if (!Number.isSafeInteger(puntos) || puntos < 1 || puntos > MAX_PUNTOS) return 'El puntaje no es válido.';
  if (Number(dato.tiempo) !== msDe(n)) return 'El tiempo declarado no es el de la partida.';
  const r = Number(prueba.r);
  if (!Number.isFinite(r) || r < msDe(n) * 0.9) return 'La partida duró menos en el reloj que en el juego.';
  const reloj = dosRelojes(prueba.a, prueba.w);
  if (reloj) return reloj;
  const jugadas = M.decodifica(prueba.j);
  if (!jugadas) return 'Las jugadas de la prueba no se pueden leer.';
  if (jugadas.some(j => j[2] === 'x')) return 'La partida trae jugadas que no hizo una mano (eventos sintéticos).';
  const giros = [];
  const res = M.rehace(prueba.s, prueba.u, jugadas, n, (E, j) => giros.push(...giro(E, j[1])));
  if (res.error) return res.error;
  if (res.E.tick !== n) return 'La partida rehecha termina antes de lo que dice la prueba.';
  if (res.E.puntos !== puntos) return `La partida rehecha hace ${res.E.puntos} puntos, no ${puntos}.`;
  if (rachas(giros, x => x).larga >= GIROS_CENTRO)
    return `${GIROS_CENTRO} giros seguidos en el tic exacto en que el jugador pisa el centro de la casilla: así gira un programa, no una mano.`;
  return null;
}

/* Un giro «en marcha»: una dirección perpendicular a la que se lleva,
   pedida mientras el jugador avanza (parado contra una pared, todo pasa en
   el centro y no dice nada). Devuelve [enCentro] o []. */
function giro(E, c) {
  if (c > 3 || E.estado !== 'jugando' || E.congelado > 0) return [];
  const p = E.pac;
  if (c === p.dir || c === M.OPUESTA[p.dir]) return [];
  const centro = M.enCentro(p);
  if (centro && !M.libre(E, M.casilla(p.x) + M.DIRS[p.dir][0], M.casilla(p.y) + M.DIRS[p.dir][1], p)) return [];
  return [centro];
}

export function sospecha(categoria, fila) {
  if (categoria !== CATEGORIA || !fila) return null;
  const p = Number(fila.puntos), t = Number(fila.tiempo);
  if (!Number.isFinite(p) || !Number.isFinite(t)) return null;
  if (p > MAX_PUNTOS) return `${p} puntos: más de lo que la tabla admite.`;
  if (p > 20000 && t > 0 && p / (t / 1000) > PUNTOS_SEGUNDO)
    return `${p} puntos en ${(t / 1000).toFixed(1)} s: el laberinto no da más de ${PUNTOS_SEGUNDO} por segundo.`;
  return null;
}
