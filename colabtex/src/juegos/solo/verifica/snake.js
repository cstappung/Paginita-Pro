/* Verificador antitrampas de Snake Club (ver docs/antitrampas.md y
   docs/antitrampas/snake.md).

   La prueba es la partida entera: el modo, el tamaño, la velocidad, la
   semilla y cada giro con el tic en que entró en la cola. Se rehace tic a
   tic con el mismo motor que juega (juegos/club/snake/motor.js, UMD,
   compartido con game.js): tiene que terminar exactamente en el tic que
   dice la prueba, con los puntos declarados, y el tiempo declarado tiene
   que ser el reloj de juego de esa partida (la suma de los intervalos de
   sus tics). Después, verosimilitud, con margen: que no se haya jugado a
   cámara lenta frenando el reloj, y señales de bot.

   En Snake un bot no puede ir más rápido que una persona: el ritmo lo pone
   el juego (un tic cada 55–290 ms) y la prueba se rehace con ese ritmo.
   Lo que un bot sí tiene es reflejos y decisiones perfectas. Se mira:
   - que ningún giro llegue de un evento sintético (isTrusted falso) sin un
     mando conectado: así entra un script que despacha teclas;
   - los reflejos: la fruta nueva aparece al azar en el tic en que se come
     la anterior. Nadie puede girar hacia ella antes del tic siguiente si
     ese tic llega en menos de 100 ms (el tiempo de reacción visual humano
     es de 150–250 ms), salvo por casualidad: un giro que ya tenía pensado.
     La casualidad se mide con la propia partida: la fracción de tics con
     algún giro. Se rechaza si, con 25 o más frutas en ventana corta, la
     mitad o más tienen un giro en ese mismo tic y eso es más del triple de
     la casualidad (y 0,3 por encima). Un bot que va derecho a cada fruta
     lo hace casi siempre; una persona que gira mucho tiene la casualidad
     alta y no cae. Simulando, un bot que va derecho a cada fruta da
     0,87–1,00 contra una casualidad de 0,12–0,32; un robot con 150–400 ms
     de reacción da 0,00–0,11.
   No hace falta un tope de giros por segundo: la cola admite dos por tic y
   el tic lo marca el juego.

   Formato (`v: 1`):
     {v: 1, m: modo, t: tamaño, r: 'chill'|'normal'|'fast', s: semilla uint32,
      n: tics jugados, g: giros con su origen (motor.leeGiros), w: ms de pared jugando,
      p: pausas, u?: uid} */
import Motor from '../../../../../juegos/club/snake/motor.js';
import { rachas } from './patrones.js';

export const PRUEBA = 1;

// Dos millones de tics son más de 30 horas al ritmo más rápido.
const MAX_TICS = 2000000;
/* Cámara lenta: quien envuelve requestAnimationFrame (o performance.now)
   para que el juego reciba la mitad del tiempo juega a la mitad de
   velocidad, y la partida rehecha sale igual de válida. Date.now no cambia
   con eso: el juego suma, fotograma a fotograma, los ms de pared que pasan
   jugando (`w`), con tope de 100 ms por fotograma para que una pestaña
   dormida o un salto del reloj no cuenten. El juego por su parte recorta
   cada fotograma a 60 ms, así que en un aparato honesto, por lento que
   sea, el reloj de juego es al menos el 60 % del de pared (60 de cada
   100). El umbral queda en el 50 %, y solo para partidas de 20 s o más:
   frenar el reloj a menos de la mitad se rechaza; un poco menos no se
   puede distinguir de un aparato lento, y es el límite honesto. */
const RATIO_MIN = .5, PARED_MIN = 20000;
const VENTANA_CORTA = .1, FRUTAS_MIN = 25, REFLEJO_FRACCION = .5, REFLEJO_VECES = 3, REFLEJO_MARGEN = .3;

const categoriaDe = c => {
  const x = /^club-snake-(classic|arcade|portals|reloj|espejo|laberinto)-(chico|mediano|grande|gigante)$/.exec(String(c || ''));
  return x ? { modo: x[1], tam: x[2] } : null;
};
const entero = x => Number.isSafeInteger(x);

/* `ctx.uid` (verificaClub): la prueba tiene que ser de esa cuenta, o una
   prueba copiada de `soloPruebas` valdría para otro. */
export function verifica(dato, prueba, ctx) {
  const cat = categoriaDe(dato && dato.categoria);
  if (!cat) return 'Categoría de Snake Club desconocida.';
  if (!prueba || typeof prueba !== 'object' || prueba.v !== 1) return 'Prueba de Snake Club con un formato desconocido.';
  if (prueba.m !== cat.modo || prueba.t !== cat.tam) return 'La prueba es de otro modo o tamaño.';
  if (ctx && ctx.uid && prueba.u !== ctx.uid) return 'La prueba es de una partida de otra cuenta.';
  if (!Object.prototype.hasOwnProperty.call(Motor.SPEED_MULT, prueba.r)) return 'La velocidad de la prueba no es válida.';
  if (!entero(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla de la prueba no es válida.';
  if (!entero(prueba.n) || prueba.n < 1 || prueba.n > MAX_TICS) return 'La duración de la prueba no es válida.';
  if (prueba.w !== undefined && (!entero(prueba.w) || prueba.w < 0)) return 'El reloj de la prueba no es válido.';
  if (prueba.p !== undefined && (!entero(prueba.p) || prueba.p < 0)) return 'Las pausas de la prueba no son válidas.';
  if (prueba.u !== undefined && (typeof prueba.u !== 'string' || prueba.u.length > 128)) return 'La cuenta de la prueba no es válida.';
  const giros = Motor.leeGiros(prueba.g);
  if (!giros) return 'Los giros de la prueba no se pueden leer.';

  const sinteticos = giros.filter(x => x.marcas.includes('X')).length;
  const juego = Motor.crear({ mode: cat.modo, size: cat.tam, speed: prueba.r, semilla: prueba.s });
  let j = 0, comida = -1, cortas = 0, reflejos = 0, ticsConGiro = 0;
  /* Cada fruta: ¿se llegó por el camino más corto posible, sin un solo tic
     de más? (`null` corta la racha: portales, nivel o espejo cambian el
     tablero y la cuenta de antes ya no vale). */
  const envuelve = cat.modo === 'portals' || cat.modo === 'laberinto';
  const dist = (a, b) => {
    let dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    if (envuelve) { dx = Math.min(dx, juego.COLS - dx); dy = Math.min(dy, juego.ROWS - dy); }
    return dx + dy;
  };
  const aFruta = () => juego.fruit ? dist(juego.snake[0], juego.fruit) : -1;
  const camino = [];
  let f0 = juego.ticks, d0 = aFruta();
  for (;;) {
    if (j < giros.length && giros[j].tic === juego.ticks) {
      ticsConGiro++;
      if (comida === juego.ticks) reflejos++;
    }
    comida = -1;
    while (j < giros.length && giros[j].tic === juego.ticks) {
      if (!juego.enqueue(giros[j].nombre)) return 'Un giro de la prueba no se puede hacer.';
      j++;
    }
    if (juego.state !== 'playing' || juego.ticks >= prueba.n) break;
    juego.tick();
    // Una fruta comida con el tic siguiente a menos de 100 ms.
    if (juego.state === 'playing' && juego.ev.some(x => x.k === 'come') && juego.interval() <= VENTANA_CORTA) { comida = juego.ticks; cortas++; }
    if (juego.ev.some(x => x.k === 'come')) {
      if (d0 > 0) camino.push(juego.ticks - f0 === d0);
      f0 = juego.ticks; d0 = aFruta();
    }
    if (juego.ev.some(x => x.k === 'portales' || x.k === 'nivel' || x.k === 'espejo')) camino.push(null);
    juego.ev.length = 0;
  }
  if (j < giros.length) return 'Hay giros después del final de la partida.';
  if (juego.state !== 'over' || juego.ticks !== prueba.n) return 'Las jugadas de la prueba no terminan la partida donde dice.';
  if (juego.score !== dato.puntos) return 'Los puntos declarados no son los de la partida.';
  const ms = Math.round(juego.gameTime * 1000);
  if (Math.abs(dato.tiempo - Math.max(1, ms)) > 1) return 'El tiempo declarado no es el de la partida.';
  if (prueba.w >= PARED_MIN && ms < RATIO_MIN * prueba.w) return 'La partida se jugó con el reloj frenado.';
  if (sinteticos) return `${sinteticos} giro${sinteticos > 1 ? 's' : ''} con eventos sintéticos (no de una persona ni de un mando).`;
  const azar = ticsConGiro / juego.ticks, fraccion = cortas ? reflejos / cortas : 0;
  if (cortas >= FRUTAS_MIN && fraccion >= REFLEJO_FRACCION && fraccion >= REFLEJO_VECES * azar && fraccion >= azar + REFLEJO_MARGEN)
    return `Giró hacia la fruta nueva antes de poder verla en ${reflejos} de ${cortas} frutas: reflejos de bot.`;
  return camino_(camino);
}

/* El camino. Un bot va a cada fruta por el camino más corto, sin un tic de
   más: esperar al último instante de la ventana y girar justo ahí, fruta
   tras fruta. Una persona también llega derecho a veces, pero no doce
   frutas seguidas ni ocho de cada diez. Calibrado con las partidas de la
   tabla: las personas no pasan de 5 seguidas ni del 38 %; un bot que va
   derecho a la fruta hace rachas de 14 a 23 y el 88–100 %. */
const RACHA_CAMINO = 12, FRACCION_CAMINO = .8, FRUTAS_CAMINO = 20;
function camino_(camino) {
  const { larga } = rachas(camino, x => x === true);
  if (larga >= RACHA_CAMINO) return `${larga} frutas seguidas por el camino más corto, sin un solo paso de más: así juega un programa.`;
  const n = camino.filter(x => x !== null).length, ok = camino.filter(x => x === true).length;
  if (n >= FRUTAS_CAMINO && ok / n >= FRACCION_CAMINO) return `${ok} de ${n} frutas por el camino más corto: así juega un programa.`;
  return null;
}

/* Lo ya guardado sin prueba. Snake no tiene récords mundiales que sirvan
   (cada versión puntúa distinto), así que el tope es el del propio juego:
   llenar el tablero entero. Los puntos por fruta, al ritmo rápido (×3):
   clásico y portales 30; espejo 45 (15 base al revés); contrarreloj 30 más
   el reloj dorado (90, uno cada 5 frutas como mucho); arcade 108 (combo
   ×5 con puntos dobles) más la dorada (300, una cada 4); laberinto 30 más
   el premio de nivel (75·nivel, cada 6 frutas). Con eso:
   - una marca por encima de lo que da el tablero lleno es imposible;
   - cada fruta pide al menos un tic (55 ms al ritmo más rápido), y la
     siguiente fruta sale al azar a ~(ancho+alto)/3 casillas: promediar
     menos de dos tics por fruta en 20 o más es imposible en la práctica;
   - los puntos van de a 10 (clásico, portales, contrarreloj), de a 5
     (espejo, laberinto) o pares (arcade): otra cosa no sale jugando. */
const POR_FRUTA = { classic: 30, portals: 30, espejo: 45, reloj: 48, arcade: 183, laberinto: 30 };
const PASO = { classic: 10, portals: 10, reloj: 10, espejo: 5, laberinto: 5, arcade: 2 };
const maxPuntos = (modo, frutas) => {
  let p = POR_FRUTA[modo] * frutas;
  if (modo === 'laberinto') for (let nivel = 2; nivel <= 1 + Math.floor(frutas / 6); nivel++) p += 75 * nivel;
  return p;
};

export function sospecha(categoria, fila) {
  const cat = categoriaDe(categoria);
  if (!cat || !fila) return null;
  const { cols, rows } = Motor.SIZES[cat.tam], frutasMax = cols * rows - 5;
  const p = fila.puntos, t = fila.tiempo;
  if (!Number.isSafeInteger(p) || p < 1) return 'Puntos que no son un número entero positivo.';
  if (p % PASO[cat.modo]) return `En ${cat.modo} los puntos van de a ${PASO[cat.modo]}: ${p} no sale jugando.`;
  if (p > maxPuntos(cat.modo, frutasMax)) return `${p} puntos: más de lo que da llenar el tablero ${cat.tam} entero.`;
  let frutas = 1;
  while (maxPuntos(cat.modo, frutas) < p) frutas++;
  const minimo = frutas * (frutas >= 20 ? 2 : 1) * 55;
  if (!Number.isFinite(t) || t < minimo) return `${p} puntos en ${(t / 1000).toFixed(1)} s: hacen falta al menos ${frutas} frutas y ${(minimo / 1000).toFixed(1)} s.`;
  return null;
}
