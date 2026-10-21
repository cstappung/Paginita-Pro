/* Verificador antitrampas de Integrodle (docs/antitrampas/integral.md).

   La integral de cada día sale solo de la fecha de Chile, así que rehacer
   una partida es corregir otra vez, con el mismo motor del juego, lo que
   se escribió cada día: tiene que terminar justo en el último intento (un
   acierto o el sexto fallo), sin intentos repetidos ni ilegibles. Los
   puntos salen de ahí (M.puntosDe con la dificultad de la ficha), nunca
   de lo que dice el blob guardado, que el usuario puede editar
   (localStorage y users/<uid>/club/integral).

   - club-integral-puntos: la prueba trae todo el historial; se rehace día
     por día y el total y el tiempo tienen que dar exactamente lo declarado.
   - club-integral-racha: la prueba trae solo el día del récord, resuelto.
     El largo de la racha lo acota el nodo central `rachasClub` (sube de a
     uno por día de Chile) en guardaClub.

   El límite honesto, como en Electrodle: la integral de cualquier fecha es
   pública (una función de la fecha) y su primitiva está en datos.js, así
   que quien lea el código puede fabricar un historial perfecto. Esto acota
   el total a «perfecto todos los días desde el estreno», deja fuera lo
   fácil (un número inventado, días inventados, la práctica, el reloj, un
   script que despacha eventos) y queda auditable. */
import M from '../../../../../juegos/club/integral/motor.js';

export const PRUEBA = 1;

export const ESTRENO = M.ESTRENO;
const TOPE_TIEMPO = 604800000;   // el de soloRanks y el de juego.js
const TOPE_MS = 86400000;        // lo que guarda el juego por día
/* Tiempos humanos. El reloj del juego suma de a un segundo y solo con la
   pestaña a la vista (y pierde hasta 5 s si se recarga), así que un día
   suelto puede quedar casi en 0 ms sin trampa; por eso se mira el
   agregado, y solo con 20 intentos o más. */
const MS_POR_INTENTO = 500, MIN_INTENTOS_RELOJ = 20;
/* Bots. Cada intento trae su forma: el tiempo visible desde el intento
   anterior (o desde que se abrió la hoja) y las acciones de verdad que lo
   armaron. Umbrales, con holgura:
   - DT_MIN: entre un intento y el siguiente hay que ver la corrección y
     cambiar lo escrito (al menos una tecla y «Revisar»): 250 ms.
   - Al menos una acción de verdad por intento.
   - DIA_MIN: el día entero, desde que se abre hasta el último intento.
     Leer la integral y escribir una primitiva o un valor exacto con el
     teclado (lo más corto, como «ln|x|», son seis teclas más «Revisar»)
     no baja de 3 s, ni sabiéndose la respuesta de memoria.
   - Una sola acción sintética (isTrusted falso sin mando) rechaza: el
     juego no despacha eventos propios, y mando.js marca los suyos.
   - Metrónomo: entre intentos una persona tarda de segundos a minutos;
     con 20 intervalos o más, un coeficiente de variación bajo 0,08 no lo
     da nadie. */
const DT_MIN = 250, DIA_MIN = 3000, CV_MIN = 0.08, CV_N = 20;

const numeroDe = f => M.numeroIntegral(f);
const fechaDe = n => M.fechaDeNumero(n);
const entero = (v, a, b) => Number.isSafeInteger(v) && v >= a && v <= b;
const tiempoDe = ms => Math.min(TOPE_TIEMPO, Math.max(1, ms));

/* Rehace un día: {pts, ms, n, gano, dts} o el motivo. */
function rehazDia(fecha, c, hoyDe) {
  if (c.length !== 3 && c.length !== 4 && c.length !== 6) return `${fecha} no se puede leer`;
  const [, ms, txt] = c;
  if (!entero(ms, 0, TOPE_MS) || typeof txt !== 'string' || txt.length > 6 * (M.X.LARGO_MAX + 1)) return `${fecha} no se puede leer`;
  const intentos = txt.split('\n');
  if (!intentos.length || intentos.length > M.MAX_INTENTOS || !intentos.every(s => s.length > 0 && s.length <= M.X.LARGO_MAX))
    return `${fecha} trae intentos ilegibles`;
  const id = M.objetivoDelDia(fecha);
  if (intentos.some(s => M.revisa(id, s).error)) return `${fecha} trae un intento que no se puede corregir`;
  if (new Set(intentos.map(M.X.canonica)).size !== intentos.length) return `${fecha} repite un intento`;
  /* Termina en el último intento, y no antes. */
  if (M.estado(id, intentos.slice(0, -1)).fin) return `${fecha} sigue después de terminar`;
  const s = M.estado(id, intentos);
  if (!s.fin) return `${fecha} no termina: ni acierta ni gasta los ${M.MAX_INTENTOS} intentos`;
  const n = intentos.length;
  let dts = null;
  if (c.length >= 4) {
    const t = typeof c[3] === 'string' && c[3].length <= 20 * n + 20 ? c[3].split(',').map(x => x.split('.').map(Number)) : null;
    if (!t || t.length !== n || !t.every(x => x.length === 2 && entero(x[0], 0, 3600000) && entero(x[1], 0, 100000)))
      return `${fecha} trae una forma de jugar ilegible`;
    const [u, mc] = c.length === 6 ? [c[4], c[5]] : [0, 0];
    if (!entero(u, 0, 100000) || !entero(mc, 0, 100000)) return `${fecha} trae una forma de jugar ilegible`;
    if (u > 0) return `${fecha} se jugó con ${u} acciones sintéticas (un script, no una persona)`;
    if (t.some(x => x[1] < 1)) return `${fecha} tiene un intento sin ninguna tecla ni toque`;
    dts = t.map(x => x[0]);
    const rapido = dts.findIndex((x, k) => k > 0 && x < DT_MIN);
    if (rapido >= 0) return `${fecha}, intento ${rapido + 1} a ${dts[rapido]} ms del anterior: ningún humano`;
    const suma = dts.reduce((a, b) => a + b, 0);
    if (suma < DIA_MIN) return `${fecha} resuelto en ${suma} ms: ningún humano`;
  } else if (M.numeroDia(hoyDe) - M.numeroDia(fecha) < M.VENTANA) {
    /* Lo reciente tiene que traer la forma; el juego la guarda desde el estreno. */
    return `${fecha} llegó sin la forma de jugar`;
  }
  return { pts: M.puntosDe(n, s.gano, M.ficha(id).d), ms, n, gano: s.gano, dts };
}

/* Lee y rehace la prueba: {f, dias: [{fecha, ...rehecho}]} o el motivo. */
function rehaz(prueba, ahora) {
  if (!prueba || typeof prueba !== 'object' || prueba.v !== 1) return 'La partida llegó sin una prueba que se pueda leer.';
  const {f, d} = prueba;
  if (!M.esFecha(f)) return 'La prueba no dice de qué día es.';
  const hoy = M.diaChile(ahora == null ? new Date() : ahora);
  if (f > hoy) return 'La prueba es de un día que todavía no llega.';
  if (f < ESTRENO) return 'La prueba es de antes del estreno de Integrodle.';
  if (!Array.isArray(d) || !d.length || d.length > 100000) return 'La prueba no trae ningún día.';
  const dias = [];
  let antes = 0;
  for (const fila of d) {
    if (!Array.isArray(fila) || !entero(fila[0], 1, 100000)) return 'Un día de la prueba no se puede leer.';
    if (fila[0] <= antes) return 'La prueba trae días repetidos o desordenados.';
    antes = fila[0];
    const fecha = fechaDe(fila[0]);
    if (fecha > f) return `La prueba trae un día posterior a ella (${fecha}).`;
    const r = rehazDia(fecha, fila, f);
    if (typeof r === 'string') return 'La prueba no cuadra: ' + r + '.';
    dias.push(Object.assign({fecha}, r));
  }
  return {f, dias};
}

/* ¿Un reloj frenado o un bot? null si parece humano. */
function inhumano(dias) {
  let ms = 0, intentos = 0;
  const dts = [];
  for (const r of dias) {
    ms += r.ms; intentos += r.n;
    if (r.dts) dts.push(...r.dts.slice(1));
  }
  if (intentos >= MIN_INTENTOS_RELOJ && ms < MS_POR_INTENTO * intentos)
    return `${intentos} intentos en ${Math.round(ms / 1000)} s: ningún humano escribe tan rápido.`;
  if (dts.length >= CV_N) {
    const media = dts.reduce((a, b) => a + b, 0) / dts.length;
    const cv = Math.sqrt(dts.reduce((a, b) => a + (b - media) ** 2, 0) / dts.length) / media;
    if (cv < CV_MIN) return `${dts.length} intentos a ritmo de metrónomo (variación ${cv.toFixed(3)}): eso es un bot.`;
  }
  return null;
}

/* El tercer argumento es el `ctx` de verificaClub ({uid}); las pruebas
   pasan en su lugar una Date (o {ahora}, Date o ms) para fijar el día. */
const ahoraDe = ctx => ctx instanceof Date ? ctx : ctx && ctx.ahora instanceof Date ? ctx.ahora : ctx && Number.isFinite(ctx.ahora) ? new Date(ctx.ahora) : null;
export function verifica(dato, prueba, ctx) {
  const r = rehaz(prueba, ahoraDe(ctx));
  if (typeof r === 'string') return r;
  const {f, dias} = r;
  if (dato.categoria === 'club-integral-racha') {
    if (dias.length !== 1 || dias[0].fecha !== f) return 'La prueba de la racha tiene que ser solo la de ese día.';
    if (!dias[0].gano) return 'La integral de ese día no se resolvió.';
    if (!dias[0].dts) return 'El día de la racha llegó sin la forma de jugar.';
    if (!entero(dato.puntos, 1, numeroDe(f))) return 'La racha es más larga que los días que lleva Integrodle.';
    if (dato.tiempo !== tiempoDe(dias[0].ms)) return 'El tiempo declarado no es el de la partida.';
    return inhumano(dias);
  }
  if (dato.categoria !== 'club-integral-puntos') return 'Categoría desconocida.';
  let pts = 0, ms = 0;
  for (const x of dias) { pts += x.pts; ms += x.ms; }
  if (pts !== dato.puntos) return `Los puntos declarados (${dato.puntos}) no son los de las partidas (${pts}).`;
  if (dato.tiempo !== tiempoDe(ms)) return 'El tiempo declarado no es el de las partidas.';
  return inhumano(dias);
}

/* Lo más que se puede tener a la fecha `hoy`: resolver a la primera todos
   los días, y que todos fueran de tres estrellas. */
export function maximoPuntos(hoy) {
  const n = numeroDe(hoy);
  return n < 1 ? 0 : n * M.puntosDe(1, true, 3);
}

/* Una fila guardada sin prueba: ¿más de lo que permite el calendario? */
export function sospecha(categoria, fila, ctx) {
  const ahora = ahoraDe(ctx);
  const hoy = M.diaChile(ahora == null ? new Date() : ahora);
  const p = fila && fila.puntos, t = fila && fila.tiempo;
  if (!Number.isFinite(p)) return null;
  if (categoria === 'club-integral-racha') {
    if (p > numeroDe(hoy)) return `racha de ${p} días y Integrodle lleva ${numeroDe(hoy)}`;
    return null;
  }
  if (categoria === 'club-integral-puntos') {
    if (p > maximoPuntos(hoy)) return `${p} puntos: más que resolver todo a la primera desde el estreno (${maximoPuntos(hoy)})`;
    /* Hasta 120 puntos por día y al menos 3 s por día: menos de 10 ms por
       punto, sostenido en mil puntos o más, no lo hace nadie. */
    if (p >= 1000 && Number.isFinite(t) && t < p * 10) return `${p} puntos en ${Math.round(t / 1000)} s`;
  }
  return null;
}
