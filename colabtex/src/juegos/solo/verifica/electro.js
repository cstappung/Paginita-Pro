/* Verificador antitrampas de Electrodle (docs/antitrampas/electro.md).

   El objetivo de cada día sale solo de la fecha de Chile, así que rehacer
   una partida es comprobar, con el mismo motor del juego, que lo que se
   intentó en cada modo termina ese modo justo en el último intento: el
   acierto tiene que ser el objetivo de *esa* fecha y *ese* modo, y un
   desafío perdido tiene que estar perdido de verdad. Los puntos salen de
   ahí (M.puntos), nunca de lo que dice el blob guardado, que el usuario
   puede editar (localStorage y users/<uid>/club/electro).

   - club-electro-puntos: la prueba trae todo el historial; se rehace día
     por día y el total y el tiempo tienen que dar exactamente lo declarado.
   - club-electro-racha: la prueba trae solo el día del récord; se prueba
     que sus modos clásicos se resolvieron de verdad. El largo de la racha
     no se puede probar con un blob del propio usuario: lo acota el nodo
     central `rachasClub` (sube de a uno por día de Chile) en guardaClub.

   El límite honesto: como el objetivo de cualquier fecha es público (es
   una función de la fecha), quien lea motor.js puede fabricar un historial
   «perfecto» desde el estreno. Esto acota el total a lo que haría alguien
   perfecto todos los días desde el estreno, deja fuera lo fácil (un número
   inventado, días inventados, la práctica, el reloj) y queda auditable.
   Cerrar el relleno de días pasados pide un nodo por día (ver el doc). */
import M from '../../../../../juegos/club/electro/motor.js';

export const PRUEBA = 1;

/* El estreno (`alta` del salón y el #1 de numeroElectrodle). Ningún día
   jugado puede ser anterior. */
export const ESTRENO = '2026-10-01';
/* Lo guardado antes de que el juego guardara lo intentado no tiene con qué
   rehacerse: hasta CORTE (exclusive) un día así se acepta con sus puntos
   recalculados desde el número de intentos, como hace `limpia`. Lo más que
   se puede inflar así es «perfecto todos los días» hasta CORTE, lo mismo
   que se puede fabricar con la prueba entera (ver arriba). Va una semana
   por delante del despliegue: alguien con el juego viejo en caché durante
   el cambio no debe quedar sin poder subir su total para siempre. Si el
   despliegue se atrasa, CORTE se corre con él. */
export const CORTE = '2026-10-12';
/* Científico fue del diario hasta el 2 de octubre de 2026 (3f722a8): un
   día de antes puede traerlo; uno de después, no (es práctica). */
const CIEN_HASTA = '2026-10-02';
const TOPE_TIEMPO = 604800000;   // el de soloRanks y el de game.js
const TOPE_MS = 86400000;        // lo que guarda el juego por modo
/* Tiempos humanos. El reloj del juego suma de a un segundo y solo con la
   pestaña a la vista (y pierde hasta 5 s si se recarga), así que un modo
   suelto puede quedar en 0 ms sin trampa; por eso se mira el agregado:
   escribir y elegir un intento lleva más de un segundo, y aquí se pide la
   mitad, y solo con 30 intentos o más. Frena el reloj frenado. */
const MS_POR_INTENTO = 500, MIN_INTENTOS_RELOJ = 30;
/* Suerte imposible: en Componente el primer intento no tiene ninguna pista
   (1 entre ~43; aun llevando la cuenta de la vuelta, en promedio ~1 de cada
   10 días). Acertar a la primera la mitad de los días, con 8 aciertos o
   más, no le pasa a nadie que juegue: es un historial fabricado con el
   objetivo. */
const SUERTE_MIN = 8, SUERTE_FRAC = 0.5;
/* Bots. Cada intento de los últimos M.VENTANA días trae su forma: el
   tiempo visible desde el intento anterior (o desde que se abrió el modo)
   y las acciones de verdad que lo armaron. Umbrales, con holgura:
   - DT_MIN: entre un intento y el siguiente hay que ver la respuesta
     anterior y hacer algo (escribir y elegir, cambiar un color, marcar una
     ficha). El tiempo de reacción humano a algo visto ronda los 200–250 ms;
     150 ms ya es de un bot.
   - Al menos una acción de verdad por intento: no hay forma de intentar sin
     tocar una tecla, la pantalla o el ratón (o el mando).
   - MODO_MIN: un modo entero, desde que se abre hasta el acierto. Escribir
     el nombre de memoria y elegirlo son al menos un par de teclas y un
     Intro; medio segundo es más rápido que cualquier mecanógrafo. En
     Conexiones hay al menos 20 toques (cuatro fichas y «Enviar», cuatro
     veces): a 13 toques por segundo, que es el récord de clics, 1,5 s.
   - Una sola acción sintética (isTrusted falso sin mando) rechaza: el
     juego no despacha eventos propios, y mando.js marca los suyos.
   - Metrónomo: entre intentos de adivinar una persona tarda de un par de
     segundos a varios minutos (lee la pista, piensa); con 20 intervalos o
     más, un coeficiente de variación bajo 0,08 no lo da nadie. */
const DT_MIN = 150, MODO_MIN = {conx: 1500}, MODO_MIN_DEF = 500, CV_MIN = 0.08, CV_N = 20;

const numeroDe = f => M.numeroDia(f) - M.numeroDia(ESTRENO) + 1;
const fechaDe = n => new Date((M.numeroDia(ESTRENO) + n - 1) * 864e5).toISOString().slice(0, 10);
const entero = (v, a, b) => Number.isSafeInteger(v) && v >= a && v <= b;
const tiempoDe = ms => Math.min(TOPE_TIEMPO, Math.max(1, ms));

/* Rehace un modo de un día: {pts, ms, n, gano, respaldado} o el motivo. */
function rehazModo(modo, fecha, c, hoyDe) {
  if (!Array.isArray(c) || !entero(c[0], 0, TOPE_MS)) return `un modo de ${fecha} no se puede leer`;
  const ms = c[0];
  if (c.length === 3 && typeof c[1] === 'number') {
    /* Lo de antes de la prueba: solo el número de intentos. */
    if (fecha >= CORTE) return `${fecha}: ${M.MODO[modo].nombre} sin lo intentado`;
    const [, n, g] = c;
    if (!entero(n, 1, 999) || (g !== 0 && g !== 1) || (!M.MODO[modo].reto && g !== 1)) return `${fecha}: ${M.MODO[modo].nombre} no cuadra`;
    return { pts: M.puntos(modo, n, !!g), ms, n, gano: !!g, respaldado: false };
  }
  if (c.length < 2 || c.length > 5 || c.length === 4 || typeof c[1] !== 'string') return `un modo de ${fecha} no se puede leer`;
  const intentos = M.decodificaIntentos(modo, c[1]);
  if (!intentos || !intentos.length || intentos.length > 999) return `${fecha}: ${M.MODO[modo].nombre} no se puede leer`;
  if (!intentos.every(x => M.valida(modo, x))) return `${fecha}: ${M.MODO[modo].nombre} trae un intento imposible`;
  if (new Set(intentos).size !== intentos.length) return `${fecha}: ${M.MODO[modo].nombre} repite un intento`;
  const obj = M.objetivoDelDia(modo, fecha);
  /* Termina en el último intento, y no antes: nada se juega después de
     acertar o de perder. */
  if (M.estado(modo, obj, intentos.slice(0, -1)).fin) return `${fecha}: ${M.MODO[modo].nombre} sigue después de terminar`;
  const s = M.estado(modo, obj, intentos);
  if (!s.fin) return `${fecha}: ${M.MODO[modo].nombre} no acierta el objetivo del día`;
  const n = intentos.length;
  /* La forma: obligatoria en lo reciente desde CORTE (antes no se guardaba). */
  let dts = null;
  if (c.length >= 3) {
    const t = typeof c[2] === 'string' && c[2].length <= 20 * n + 20 ? c[2].split(',').map(x => x.split('.').map(Number)) : null;
    if (!t || t.length !== n || !t.every(x => x.length === 2 && entero(x[0], 0, 3600000) && entero(x[1], 0, 100000)))
      return `${fecha}: ${M.MODO[modo].nombre} trae una forma de jugar ilegible`;
    const [u, mc] = c.length === 5 ? [c[3], c[4]] : [0, 0];
    if (!entero(u, 0, 100000) || !entero(mc, 0, 100000)) return `${fecha}: ${M.MODO[modo].nombre} trae una forma de jugar ilegible`;
    if (u > 0) return `${fecha}: ${M.MODO[modo].nombre} se jugó con ${u} acciones sintéticas (un script, no una persona)`;
    if (t.some(x => x[1] < 1)) return `${fecha}: ${M.MODO[modo].nombre} tiene un intento sin ninguna tecla ni toque`;
    dts = t.map(x => x[0]);
    const rapido = dts.findIndex(x => x < DT_MIN);
    if (rapido >= 0) return `${fecha}: ${M.MODO[modo].nombre}, intento ${rapido + 1} a ${dts[rapido]} ms del anterior: ningún humano`;
    const suma = dts.reduce((a, b) => a + b, 0);
    if (suma < (MODO_MIN[modo] || MODO_MIN_DEF)) return `${fecha}: ${M.MODO[modo].nombre} resuelto en ${suma} ms: ningún humano`;
  } else if (fecha >= CORTE && M.numeroDia(hoyDe) - M.numeroDia(fecha) < M.VENTANA) {
    return `${fecha}: ${M.MODO[modo].nombre} llegó sin la forma de jugar`;
  }
  return { pts: M.puntos(modo, n, s.gano), ms, n, gano: s.gano, respaldado: true, dts };
}

/* Lee y rehace la prueba: {f, dias: [{fecha, modos: {modo: rehecho}}]} o
   el motivo. */
function rehaz(prueba, ahora) {
  if (!prueba || typeof prueba !== 'object' || prueba.v !== 1) return 'La partida llegó sin una prueba que se pueda leer.';
  const {f, m, d} = prueba;
  if (!M.esFecha(f)) return 'La prueba no dice de qué día es.';
  const hoy = M.diaChile(ahora == null ? new Date() : ahora);
  if (f > hoy) return 'La prueba es de un día que todavía no llega.';
  if (f < ESTRENO) return 'La prueba es de antes del estreno de Electrodle.';
  if (!Array.isArray(m) || !m.length || m.length > M.IDS_MODOS.length || new Set(m).size !== m.length ||
    !m.every(x => typeof x === 'string' && M.MODO[x])) return 'La prueba trae modos que no existen.';
  if (!Array.isArray(d) || !d.length) return 'La prueba no trae ningún día.';
  const dias = [];
  let antes = 0;
  for (const fila of d) {
    if (!Array.isArray(fila) || fila.length !== m.length + 1 || !entero(fila[0], 1, 100000)) return 'Un día de la prueba no se puede leer.';
    if (fila[0] <= antes) return 'La prueba trae días repetidos o desordenados.';
    antes = fila[0];
    const fecha = fechaDe(fila[0]);
    if (fecha > f) return `La prueba trae un día posterior a ella (${fecha}).`;
    const modos = {};
    for (let k = 0; k < m.length; k++) {
      const c = fila[k + 1];
      if (c === 0) continue;
      const modo = m[k];
      if (M.MODO[modo].practica && fecha > CIEN_HASTA) return `${fecha}: ${M.MODO[modo].nombre} es de práctica y no suma.`;
      const r = rehazModo(modo, fecha, c, f);
      if (typeof r === 'string') return 'La prueba no cuadra: ' + r + '.';
      modos[modo] = r;
    }
    if (!Object.keys(modos).length) return 'La prueba trae un día vacío.';
    dias.push({fecha, modos});
  }
  return {f, dias};
}

/* ¿Un reloj frenado o un historial fabricado? null si parece humano. */
function inhumano(dias) {
  let ms = 0, intentos = 0, compDias = 0, primera = 0;
  const dts = [];
  for (const {modos} of dias) for (const [modo, r] of Object.entries(modos)) {
    if (!r.respaldado) continue;
    ms += r.ms; intentos += r.n;
    if (r.dts) dts.push(...r.dts);
    if (modo === 'comp') { compDias++; if (r.n === 1) primera++; }
  }
  if (intentos >= MIN_INTENTOS_RELOJ && ms < MS_POR_INTENTO * intentos)
    return `${intentos} intentos en ${Math.round(ms / 1000)} s: ningún humano escribe tan rápido.`;
  if (primera >= SUERTE_MIN && primera >= SUERTE_FRAC * compDias)
    return `Componente a la primera ${primera} de ${compDias} días: eso no es suerte.`;
  if (dts.length >= CV_N) {
    const media = dts.reduce((a, b) => a + b, 0) / dts.length;
    const cv = Math.sqrt(dts.reduce((a, b) => a + (b - media) ** 2, 0) / dts.length) / media;
    if (cv < CV_MIN) return `${dts.length} intentos a ritmo de metrónomo (variación ${cv.toFixed(3)}): eso es un bot.`;
  }
  return null;
}

/* El tercer argumento es el `ctx` de verificaClub ({uid}); las pruebas
   pasan en su lugar una Date (o {ahora}, Date o ms) para fijar el día. Sin ella
   manda el reloj. */
const ahoraDe = ctx => ctx instanceof Date ? ctx : ctx && ctx.ahora instanceof Date ? ctx.ahora : ctx && Number.isFinite(ctx.ahora) ? new Date(ctx.ahora) : null;
export function verifica(dato, prueba, ctx) {
  const r = rehaz(prueba, ahoraDe(ctx));
  if (typeof r === 'string') return r;
  const {f, dias} = r;
  if (dato.categoria === 'club-electro-racha') {
    /* La racha: solo el día del récord, y con los clásicos resueltos de
       verdad, con lo intentado. */
    if (dias.length !== 1 || dias[0].fecha !== f) return 'La prueba de la racha tiene que ser solo la de ese día.';
    const {modos} = dias[0];
    for (const modo of M.CLASICOS) {
      const x = modos[modo];
      if (!x || !x.gano) return `El día no está completo: falta ${M.MODO[modo].nombre}.`;
      if (!x.respaldado) return `${M.MODO[modo].nombre} de hoy llegó sin lo intentado.`;
    }
    if (dato.puntos > numeroDe(f)) return 'La racha es más larga que los días que lleva Electrodle.';
    const ms = Object.values(modos).reduce((t, x) => t + x.ms, 0);
    if (dato.tiempo !== tiempoDe(ms)) return 'El tiempo declarado no es el de la partida.';
    return inhumano(dias);
  }
  if (dato.categoria !== 'club-electro-puntos') return 'Categoría desconocida.';
  let pts = 0, ms = 0;
  for (const {modos} of dias) for (const x of Object.values(modos)) { pts += x.pts; ms += x.ms; }
  if (pts !== dato.puntos) return `Los puntos declarados (${dato.puntos}) no son los de las partidas (${pts}).`;
  if (dato.tiempo !== tiempoDe(ms)) return 'El tiempo declarado no es el de las partidas.';
  return inhumano(dias);
}

/* Lo más que se puede tener a la fecha `hoy`: 100 por modo del diario y por
   día (siete modos el estreno y el día siguiente, cuando Científico todavía
   era del diario; seis desde entonces). */
export function maximoPuntos(hoy) {
  const n = numeroDe(hoy);
  if (n < 1) return 0;
  const conCien = Math.min(n, numeroDe(CIEN_HASTA));
  return conCien * 700 + (n - conCien) * 600;
}

/* Una fila guardada sin prueba: ¿más de lo que permite el calendario? */
export function sospecha(categoria, fila, ctx) {
  const ahora = ahoraDe(ctx);
  const hoy = M.diaChile(ahora == null ? new Date() : ahora);
  const p = fila && fila.puntos, t = fila && fila.tiempo;
  if (!Number.isFinite(p)) return null;
  if (categoria === 'club-electro-racha') {
    if (p > numeroDe(hoy)) return `racha de ${p} días y Electrodle lleva ${numeroDe(hoy)}`;
    return null;
  }
  if (categoria === 'club-electro-puntos') {
    if (p > maximoPuntos(hoy)) return `${p} puntos: más que acertar todo a la primera desde el estreno (${maximoPuntos(hoy)})`;
    /* Cada 100 puntos son un modo resuelto: menos de medio segundo por
       modo, sostenido en diez modos o más, no lo hace nadie. */
    if (p >= 1000 && Number.isFinite(t) && t < p * 5) return `${p} puntos en ${Math.round(t / 1000)} s`;
  }
  return null;
}
