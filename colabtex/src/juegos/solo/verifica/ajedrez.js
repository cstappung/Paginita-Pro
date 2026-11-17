/* Verificador antitrampas de Ajedrez Club (ver docs/antitrampas.md y
   docs/antitrampas/ajedrez.md).

   Cinco tablas:
   - `club-ajedrez-bot1` … `bot4`: una victoria contra el bot de ese nivel.
     puntos = 1 fijo (compite el tiempo, como en Mina Club); tiempo = los ms
     que pensó el jugador en sus jugadas (lo del bot no cuenta).
   - `club-ajedrez-puzles`: puntos = estrellas de todos los puzles, tiempo =
     la suma de los ms del intento que cuenta en cada uno.

   La prueba de una partida es `{v: 1, u, s, n, c, j, t, a, w}`: cuenta,
   semilla, nivel, color, las jugadas del jugador en UCI y lo que tardó en
   cada una, y lo jugado en los dos relojes. Aquí se vuelve a jugar con el
   MISMO motor (`juegos/club/ajedrez/motor.js`): las jugadas del bot no
   vienen en la prueba, se vuelven a calcular (el bot es determinista y su
   azar sale de la semilla con la cuenta dentro), así que un bot que se
   dejara ganar no se puede inventar. Tiene que terminar en mate al bot, sin
   jugadas de más.

   La de los puzles es `{v: 1, u, n: {id: intento}}`, el mejor intento de
   cada puzle (jugadas aceptadas, errores con su paso, pista y ms de cada
   jugada); cada uno se rehace con `rehacePuzle` y las estrellas salen de
   contar errores y pista, no de lo que diga nadie.

   El límite honesto: un programa (o alguien con un motor de ajedrez al
   lado) juega partidas perfectamente válidas, y los errores de un puzle los
   declara el propio jugador (quien los calle saca tres estrellas, igual
   que quien busque la solución). Lo que sí queda fuera: inventar la
   partida, el tiempo o el bot, copiar la prueba de otra cuenta, acelerar
   el reloj y jugar a ritmo de programa. */
import M from '../../../../../juegos/club/ajedrez/motor.js';
import PZ from '../../../../../juegos/club/ajedrez/puzles.js';
import { rachas, dosRelojes } from './patrones.js';

export const PRUEBA = 1;

const CAT_PUZ = 'club-ajedrez-puzles';
const POR_ID = new Map(PZ.TODOS.map(p => [p.id, p]));
export const MAX_ESTRELLAS = PZ.TODOS.length * 3;
const MAX_JUGADAS = 600;
/* Ninguna persona encadena diez jugadas (que no sean forzadas) en menos de
   180 ms cada una: hay que ver la del bot, elegir y mover la pieza. */
const RAPIDA = 180, RACHA_RAPIDA = 10;
/* Un puzle «instantáneo» es uno con todas sus jugadas por debajo de 250 ms
   desde que se pudo mover. Uno suelto puede ser un mate en 1 a la vista;
   cuatro ya es un programa. */
const INSTANTE = 250, MAX_INSTANTANEOS = 4;
const nivelDe = c => { const m = /^club-ajedrez-bot([1-4])$/.exec(String(c || '')); return m ? +m[1] : 0; };

export async function verifica(dato, prueba, ctx = {}) {
  if (!dato) return 'Ajedrez Club no tiene esa tabla.';
  const nivel = nivelDe(dato.categoria);
  if (!nivel && dato.categoria !== CAT_PUZ) return 'Ajedrez Club no tiene esa tabla.';
  if (!prueba || typeof prueba !== 'object' || Array.isArray(prueba) || prueba.v !== 1) return 'La prueba de Ajedrez Club no tiene la forma esperada (recarga la página).';
  if (ctx.uid && prueba.u !== ctx.uid) return 'La prueba es de otra cuenta.';
  return nivel ? verificaBot(dato, prueba, nivel) : verificaPuzles(dato, prueba);
}

function verificaBot(dato, pr, nivel) {
  if (pr.n !== nivel) return 'La partida es de otro nivel del bot que el de esta tabla.';
  if (pr.c !== 'b' && pr.c !== 'n') return 'La prueba no dice con qué color se jugó.';
  if (!Number.isSafeInteger(pr.s)) return 'La semilla de la partida no es válida.';
  if (!Array.isArray(pr.j) || !Array.isArray(pr.t) || !pr.j.length || pr.j.length !== pr.t.length || pr.j.length > MAX_JUGADAS) return 'Las jugadas de la prueba no tienen la forma esperada.';
  let ms = 0;
  for (const t of pr.t) { if (!Number.isSafeInteger(t) || t < 0 || t > 86400000) return 'Un tiempo de la partida está mal formado.'; ms += t; }
  if (dato.puntos !== 1) return 'En las tablas del bot los puntos valen 1: compite el tiempo.';
  if (dato.tiempo !== Math.max(1, ms)) return `El tiempo no cuadra con el de las jugadas (${ms} ms contra ${dato.tiempo} ms).`;
  const relojes = dosRelojes(pr.a, pr.w);
  if (relojes) return relojes;
  if (Math.abs(pr.a - ms) > 2) return 'El reloj de la partida no coincide con la suma de sus jugadas.';
  const forzadas = [];
  const r = M.rehaceBot(nivel, pr.c, M.semillaCuenta(pr.s, pr.u), pr.j, (m, unica) => forzadas.push(unica));
  if (r.error) return r.error;
  if (r.fin !== 'mate' || r.gana !== 'jugador') return r.fin ? 'La partida rehecha no termina con mate al bot.' : 'La partida rehecha no termina.';
  const rapidas = rachas(pr.t, (t, i) => t < RAPIDA && !forzadas[i]);
  if (rapidas.larga >= RACHA_RAPIDA) return `${rapidas.larga} jugadas seguidas en menos de ${RAPIDA} ms cada una: ritmo de programa, no de persona.`;
  return null;
}

function verificaPuzles(dato, pr) {
  const n = pr.n;
  if (!n || typeof n !== 'object' || Array.isArray(n)) return 'La prueba de los puzles no tiene la forma esperada.';
  const ids = Object.keys(n);
  if (!ids.length) return 'La prueba no trae ningún puzle.';
  if (ids.length > PZ.TODOS.length) return 'La prueba trae más puzles de los que tiene el juego.';
  let estrellas = 0, ms = 0, instantaneos = 0;
  for (const id of ids) {
    const pz = POR_ID.get(id);
    if (!pz) return 'La prueba trae un puzle que el juego no tiene.';
    const r = M.rehacePuzle(pz, n[id]);
    if (r.error) return `Un puzle no se puede rehacer: ${r.error}.`;
    estrellas += r.estrellas; ms += r.ms;
    if (n[id].t.every(t => t < INSTANTE)) instantaneos++;
  }
  if (instantaneos >= MAX_INSTANTANEOS) return `${instantaneos} puzles resueltos con todas sus jugadas en menos de ${INSTANTE} ms: ritmo de programa, no de persona.`;
  if (dato.puntos !== estrellas) return `Las estrellas no cuadran: los puzles dan ${estrellas} y se declararon ${dato.puntos}.`;
  if (dato.tiempo !== Math.max(1, ms)) return `El tiempo no cuadra con el de los puzles (${ms} ms contra ${dato.tiempo} ms).`;
  return null;
}

/* Una fila ya guardada, sin su prueba a mano. Un mate al bot necesita al
   menos dos jugadas propias (el mate del loco, jugando con negras), y
   nadie las piensa y mueve en menos de un segundo y medio; un puzle no se
   resuelve en menos de un cuarto de segundo. */
export function sospecha(categoria, fila) {
  if (!fila) return null;
  const p = Number(fila.puntos), t = Number(fila.tiempo);
  if (!Number.isFinite(p) || !Number.isFinite(t)) return null;
  if (nivelDe(categoria)) {
    if (p !== 1) return `${p} puntos: en las tablas del bot valen 1.`;
    return t < 1500 ? `Un mate al bot en ${(t / 1000).toFixed(2)} s: nadie juega tan rápido.` : null;
  }
  if (categoria === CAT_PUZ) {
    if (p > MAX_ESTRELLAS) return `${p} estrellas: más de las ${MAX_ESTRELLAS} que tienen los puzles.`;
    return t < p / 3 * 250 ? `${p} estrellas en ${(t / 1000).toFixed(1)} s: menos de un cuarto de segundo por puzle.` : null;
  }
  return null;
}
