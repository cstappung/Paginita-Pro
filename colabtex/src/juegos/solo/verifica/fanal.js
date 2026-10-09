/* Verificador antitrampas de FANAL (docs/antitrampas/fanal.md).

   FANAL es un Space Invaders en tiempo real con la música llevando el
   compás: no se rehace cuadro a cuadro. La prueba es el registro de cada
   jornada (tiros, lo que tocó cada bala y con qué tiro, golpes, poderes,
   pulsos de la música, reloj de juego y reloj real, entradas sintéticas),
   encadenado con un hash, más las mejoras compradas en el taller antes de
   cada jornada. `FanalPrueba.rehace` —el mismo archivo que usa
   el juego para anotar, así no divergen— recalcula con el motor los puntos
   exactos de cada jornada y comprueba que pudo jugarse así; aquí solo se
   compara con lo declarado. */
import FP from '../../../../../juegos/club/fanal/prueba.js';
import FM from '../../../../../juegos/club/fanal/motor.js';

export const PRUEBA = 4;

const TOPE = 1000000;   // el de resultadoClub para los puntos

/* `ctx.uid`, si la página lo pasa: la prueba lleva la cuenta en la que se
   jugó, y la de otra persona (copiada de soloPruebas, que se lee con
   sesión) no vale. Sin ctx no se puede comprobar (ver la doc). */
export function verifica(dato, prueba, ctx) {
  if (!prueba || typeof prueba !== 'object') return 'La partida llegó sin prueba.';
  const cat = dato && dato.categoria;
  if (ctx && ctx.uid && prueba.u && prueba.u !== ctx.uid) return 'La prueba es de otra cuenta.';
  const r = FP.rehace(prueba);
  if (r.motivo) return 'La partida no cuadra: ' + r.motivo + '.';
  // Desde la versión 4 hay un solo modo: la travesía, siempre desde la
  // jornada 1, que después del Sol sigue sin fin. La tabla «sin fin» quedó
  // con las marcas de antes y ya no recibe ninguna.
  if (prueba.m !== 't' || prueba.k !== 0) return 'La prueba no empieza en la jornada 1.';
  if (cat === 'club-fanal-jornadas') {
    if (dato.puntos !== r.completadas) return 'Las jornadas declaradas (' + dato.puntos + ') no son las de la partida (' + r.completadas + ').';
  } else if (cat === 'club-fanal-travesia') {
    if (dato.puntos !== Math.min(TOPE, r.puntos)) return 'Los puntos declarados (' + dato.puntos + ') no son los de la partida (' + r.puntos + ').';
  } else return 'Categoría desconocida.';
  // El tiempo declarado es el de juego: la suma del de cada jornada (una
  // travesía retomada lleva en su prueba todas las anteriores).
  if (Math.abs(dato.tiempo - Math.max(1, r.tiempo)) > 2) return 'El tiempo declarado no es el de la partida.';
  return null;
}

/* Lo humano, para filas ya guardadas sin prueba. Referencias (datos reales
   de la tabla, de antes de la segunda parte): la travesía honesta hasta el
   Alba tardaba 500–800 s de juego e hacía 64 000–124 000 puntos, es decir
   40–60 s por jornada y unos 100–250 puntos por segundo. Con las mejoras
   el arma crece, pero los augurios también: los umbrales de aquí son
   varias veces más generosos y solo marcan lo que ninguna persona hace.
   La travesía no tiene techo de puntos (sigue sin fin): se mira el ritmo. */
const S_POR_JORNADA = 8;        // s de juego por jornada como mínimo (las honestas: 30–60)
const PPS_SINFIN = 5000;        // puntos por segundo en el sin fin (con el arma llena, un bot de Chromium hizo 3400)
const PPS_TRAVESIA = 5000;      // en la travesía (pasado el Sol, con el arma llena, un bot de Chromium hizo 3400)

export function sospecha(categoria, fila) {
  const p = fila && fila.puntos, t = (fila && fila.tiempo || 0) / 1000;
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return 'fila sin puntos o sin tiempo';
  if (categoria === 'club-fanal-jornadas') {
    // Las filas de antes de la versión 4 pudieron seguir desde el punto de
    // control de un acto (o del sin fin); se les da ese margen.
    const desde = Math.max(...Object.values(FM.INICIO_ACTO).filter(j => j <= p));
    const min = (p - desde + 1) * S_POR_JORNADA + (p >= FM.JORNADA_ALBA && desde <= FM.JORNADA_ALBA ? 60 : 0);
    if (t < min) return p > FM.JORNADAS_HISTORIA ? (p - desde + 1) + ' jornadas del sin fin en ' + t.toFixed(1) + ' s' : 'jornada ' + p + ' en ' + t.toFixed(1) + ' s';
    return null;
  }
  if (categoria === 'club-fanal-sinfin') {
    if (p / t > PPS_SINFIN) return Math.round(p / t) + ' puntos por segundo en el sin fin';
    return null;
  }
  if (categoria === 'club-fanal-travesia') {
    if (p / t > PPS_TRAVESIA && p > 20000) return Math.round(p / t) + ' puntos por segundo en una travesía';
    return null;
  }
  return null;
}
