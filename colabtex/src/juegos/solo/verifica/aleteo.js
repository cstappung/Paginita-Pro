/* Verificador antitrampas de ALETEO (ver docs/antitrampas.md y
   docs/antitrampas/aleteo.md).

   Una sola tabla, `club-aleteo-vuelo`: puntos = tubos pasados, tiempo =
   lo que duró el vuelo en tiempo de juego (ticks de 1/60 s). El juego
   manda `{v: 1, s, u, f, n, r}`: la semilla, la cuenta, cada aleteo con su
   tick y su origen, el tick del choque y los ms de reloj. Aquí se vuelve a
   volar con el MISMO motor (`juegos/club/aleteo/motor.js`):

   - el vuelo rehecho tiene que chocar exactamente en el tick `n` y haber
     pasado exactamente los tubos declarados;
   - la cuenta va en la semilla del cielo, así que una prueba copiada de
     otra persona no rehace el mismo vuelo;
   - ningún aleteo sintético (`x`: isTrusted falso sin mando conectado);
   - el reloj real no puede ir más rápido que el del juego (acelerar el
     reloj o saltarse cuadros no sirve).

   El límite honesto: un bot que juegue de verdad, con eventos de verdad,
   saca una prueba válida. Flappy Bird es justamente el juego que un bot
   juega bien. */
import M from '../../../../../juegos/club/aleteo/motor.js';

export const PRUEBA = 1;

const CATEGORIA = 'club-aleteo-vuelo';
const MAX_PUNTOS = 100000;

export function verifica(dato, prueba, ctx) {
  if (!dato || dato.categoria !== CATEGORIA) return 'ALETEO no tiene esa tabla.';
  if (!prueba || typeof prueba !== 'object' || Array.isArray(prueba)) return 'La prueba de ALETEO no tiene la forma esperada.';
  if (prueba.v !== 1) return 'La prueba es de otra versión de ALETEO (recarga la página).';
  const uid = (ctx && ctx.uid) || dato.uid;
  if (typeof prueba.u !== 'string') return 'La prueba no dice de qué cuenta es.';
  if (uid && prueba.u !== uid) return 'La prueba es de una partida de otra cuenta.';
  if (!Number.isSafeInteger(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla del vuelo no es válida.';
  const n = prueba.n;
  if (!Number.isSafeInteger(n) || n < 1) return 'El tick del choque no es válido.';
  const puntos = Number(dato.puntos);
  if (!Number.isSafeInteger(puntos) || puntos < 1 || puntos > MAX_PUNTOS) return 'El puntaje no es válido.';
  if (Number(dato.tiempo) !== M.msDe(n)) return 'El tiempo declarado no es el del vuelo.';
  const r = Number(prueba.r);
  if (!Number.isFinite(r) || r < M.msDe(n) * 0.9) return 'El vuelo duró menos en el reloj que en el juego.';
  const aleteos = M.decodifica(prueba.f);
  if (!aleteos) return 'Los aleteos de la prueba no se pueden leer.';
  if (aleteos.some(a => a[1] === 'x')) return 'El vuelo trae aleteos que no hizo una mano (eventos sintéticos).';
  const res = M.rehace(prueba.s, prueba.u, aleteos, n);
  if (res.error) return res.error;
  if (res.puntos !== puntos) return `El vuelo rehecho pasa ${res.puntos} tubos, no ${puntos}.`;
  return null;
}

export function sospecha(categoria, fila) {
  if (categoria !== CATEGORIA || !fila) return null;
  const p = Number(fila.puntos), t = Number(fila.tiempo);
  if (!Number.isFinite(p) || !Number.isFinite(t)) return null;
  if (p > MAX_PUNTOS) return `${p} tubos: más de lo que la tabla admite.`;
  const min = M.msDe(M.ticksMinimos(p));
  if (p >= 1 && t < min * 0.97) return `${p} tubos en ${(t / 1000).toFixed(1)} s: los tubos avanzan a velocidad fija y no bajan de ${(min / 1000).toFixed(1)} s.`;
  return null;
}
