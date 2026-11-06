/* Antitrampas de los juegos individuales (ver docs/antitrampas.md).

   Un récord del club no se cree: se comprueba. El juego manda, junto al
   resultado, una *prueba* (lo que hace falta para rehacer la partida: la
   semilla, las jugadas con su instante…), y el verificador de ese juego la
   rehace con el mismo motor puro antes de que nada se guarde. Si no cuadra,
   la partida no entra en la tabla, no paga monedas ni da logros, y queda un
   aviso para los administradores (`sospechas/<uid>`).

   La prueba se guarda también (`soloPruebas/<categoría>/<uid>/<partida>`):
   las reglas no dejan escribir una fila de `soloRanks` sin su prueba, así
   que todo récord se puede volver a auditar después, también uno que se
   escribió saltándose esta página (`scripts/auditar-club.cjs`).

   Todo esto corre en el navegador del que juega: quien reescriba el cliente
   puede saltárselo, y un bot puede fabricar una prueba válida jugando él.
   Lo que sí deja fuera es lo fácil —`Club.result` desde la consola, editar
   `localStorage`, acelerar el reloj— y lo que se escriba a mano queda
   auditable y borrable. Es el mismo límite honesto que el resto del sitio. */
import * as minas from './verifica/minas.js';
import * as snake from './verifica/snake.js';
import * as tetris from './verifica/tetris.js';
import * as sortem from './verifica/sortem.js';
import * as bbtan from './verifica/bbtan.js';
import * as sopa from './verifica/sopa.js';
import * as sudoku from './verifica/sudoku.js';
import * as electro from './verifica/electro.js';
import * as integral from './verifica/integral.js';
import * as fanal from './verifica/fanal.js';
import * as atasco from './verifica/atasco.js';
import * as aleteo from './verifica/aleteo.js';
import * as dosmil from './verifica/dosmil.js';
import * as trigon from './verifica/trigon.js';
import * as typerace from './verifica/typerace.js';
import * as protiles from './verifica/protiles.js';
import * as frontera from './verifica/frontera.js';
import * as metrorush from './verifica/metrorush.js';
import * as pokelike from './verifica/pokelike.js';
import * as hero from './verifica/hero.js';
import * as prodefender from './verifica/prodefender.js';
import * as propac from './verifica/propac.js';

export const VERIFICADORES = {minas, snake, tetris, sortem, bbtan, sopa, sudoku, electro, integral, fanal, atasco, aleteo, dosmil, trigon, typerace, protiles, frontera, metrorush, pokelike, hero, prodefender, propac};

/* Lo que ocupa una prueba como texto, como mucho. La regla de
   `soloPruebas` pide lo mismo. */
export const PRUEBA_MAX = 200000;

/* El juego al que pertenece una categoría (`club-tetris-sprint` → tetris). */
export const juegoDeCategoria = c => {
  const m = /^club-([a-z]+)-/.exec(String(c || ''));
  return m && VERIFICADORES[m[1]] ? m[1] : null;
};

/* La prueba en la forma en que se guarda: la que mandó el juego, o la
   compacta que dé su verificador (`guardable`; hoy solo PRO DEFENDER, que
   guarda partidas de cien rondas). Esa es la que se mide contra
   PRUEBA_MAX, se escribe en `soloPruebas` y queda pendiente en
   localStorage; el verificador acepta las dos. Nunca lanza. */
export function pruebaGuardable(juego, prueba) {
  const v = VERIFICADORES[juego];
  if (!v || typeof v.guardable !== 'function' || !prueba || typeof prueba !== 'object') return prueba;
  try { return v.guardable(prueba); } catch { return prueba; }
}

/* La prueba tal como viaja y se guarda: texto JSON, o '' si no hay. */
export function textoPrueba(prueba) {
  if (prueba === undefined || prueba === null) return '';
  try { const t = JSON.stringify(prueba); return typeof t === 'string' ? t : ''; } catch { return null; }
}

/* ¿Vale este resultado? null si sí; el motivo, si no. `ctx` = {uid}: de
   quién es la partida, para que una prueba copiada de otra cuenta no
   valga (los juegos que lo usan meten la cuenta en la prueba). Nunca lanza: un
   verificador que falla también rechaza (con el error como motivo),
   porque aceptar por las dudas es justo el agujero que se quiere cerrar. */
/* Los juegos cuyo puntaje de invitado pasa a la cuenta al iniciar sesión
   (los destacados del salón, `DESTACADOS_INVITADO` en salon-datos.js). Su
   prueba se jugó con la cuenta «invitado», que va en la semilla, así que
   no se puede reescribir con el uid de quien entra: esa prueba vale para
   cualquier dueño, ahora y en cada auditoría. El límite honesto: una prueba
   de invitado ya guardada en `soloPruebas` la podría copiar otra cuenta,
   que empataría con esa marca; nunca la mejoraría. Tetris, Snake, 2048 y
   PRO PACMAN se sumaron en octubre de 2026: también meten la cuenta en la
   prueba (`u`) y en la semilla. */
export const DE_INVITADO = new Set(['bbtan', 'aleteo', 'fanal', 'trigon', 'tetris', 'snake', 'dosmil', 'propac']);
export const UID_INVITADO = 'invitado';

export async function verificaClub(juego, dato, prueba, ctx = {}) {
  const v = VERIFICADORES[juego];
  if (!v) return null;
  if (DE_INVITADO.has(juego) && prueba && typeof prueba === 'object' && prueba.u === UID_INVITADO) ctx = Object.assign({}, ctx, { uid: UID_INVITADO });
  const texto = textoPrueba(pruebaGuardable(juego, prueba));
  if (texto === null) return 'La prueba de la partida no se puede leer.';
  if (texto.length > PRUEBA_MAX) return 'La prueba de la partida es demasiado grande.';
  if (v.PRUEBA > 0 && !texto) return 'La partida llegó sin prueba (¿una versión vieja del juego? recarga la página).';
  try {
    const motivo = await v.verifica(dato, texto ? JSON.parse(texto) : null, ctx || {});
    return motivo ? String(motivo).slice(0, 300) : null;
  } catch (e) {
    return ('No se pudo comprobar la partida: ' + (e && e.message || e)).slice(0, 300);
  }
}

/* Una fila guardada (sin prueba a mano): ¿es inverosímil? Para auditar lo
   que ya está en las tablas. */
export function sospechaFila(categoria, fila) {
  const juego = juegoDeCategoria(categoria);
  if (!juego || !fila) return null;
  try { return VERIFICADORES[juego].sospecha(categoria, fila) || null; }
  catch (e) { return 'error al revisar: ' + (e && e.message || e); }
}
