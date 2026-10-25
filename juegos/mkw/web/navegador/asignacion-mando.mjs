// Todo el mando se puede reasignar: cada control de GameCube sale de las entradas del mando que la persona elija —
// bitácora §111 (pedido del dueño: «mejora la personalización de botones de mando», «que se puedan rebindear todas las
// teclas»).
//
// Resumen: el juego recibe, por puerto, un mando de GameCube (botones A B X Y Z Start, la cruz, el stick, el stick C y
// los gatillos L y R analógicos). Antes, del mando del PC se podían reasignar solo 12 botones y de una sola vez (un
// asistente que los pedía todos); los sticks y los gatillos iban fijos. Ahora hay un MAPA por mando:
//     objetivo (un control de GameCube) → lista de fuentes (entradas físicas del mando del PC)
// Una FUENTE es un texto corto:
//   'b7'        el botón 7 (con su valor analógico si lo tiene: los gatillos dan de 0 a 1)
//   'a2+' 'a2-' la mitad positiva o negativa del eje 2 (de 0 a 1 según cuánto se inclina)
//   'a5+@-1'    lo mismo, pero el eje descansa en −1 (gatillos que el navegador da como eje: −1 suelto, +1 a fondo);
//               el valor va de 0 a 1 entre el reposo y el tope
//   'a9~-0.43'  el eje 9 cuando marca ese valor (± 0,12): las crucetas «hat» de mandos genéricos, que ponen las 8
//               direcciones en un solo eje con un valor cada una (y descansan fuera de −1..1, en 1,28)
// Los OBJETIVOS: los botones (A B X Y Z START y la cruz: arriba abajo izquierda derecha), los gatillos L y R (analógicos:
// el valor más alto de sus fuentes; pasada la mitad cuentan también como botón, como el clic de la GameCube), y cada
// stick en cuatro mitades (stick.der/izq/arr/aba, c.der/izq/arr/aba): el stick = derecha − izquierda, arriba − abajo, y
// después la zona muerta redonda de siempre. Así un stick se puede mover a otro stick, a la cruz o a botones, y la
// cruz a un stick (con botones, el stick va a fondo).
// El mapa POR OMISIÓN da exactamente lo de antes (mismos botones, gatillos, sticks): quien no toca nada no nota nada.
// Como el tablero de una consola de sonido: cada canal de salida (un control del juego) toma la señal de la entrada que
// se le enchufe, y se puede enchufar más de una (la más fuerte gana).
//
// Uso:  mapaPorOmision({ letra }) · migrarPropio(viejo) · valorFuente(g, fuente) · aplicarMapa(g, mapa, zona)
//       base = fotoMando(g); capturada = capturar(base, g)   (la primera entrada nueva: botón o eje, o null)
//       nombreFuente(fuente, tipo, estandar)                  (para mostrarla: «RT», «R2», «Stick izq. →», «Botón 7»)

// Los botones de GameCube (los mismos bits que dolphin/pad.h y controles.mjs)
export const BITS = {
  izquierda: 0x0001, derecha: 0x0002, abajo: 0x0004, arriba: 0x0008,
  Z: 0x0010, R: 0x0020, L: 0x0040, A: 0x0100, B: 0x0200, X: 0x0400, Y: 0x0800, START: 0x1000,
};
// Todo lo que se puede reasignar, en el orden en que lo muestra el panel, con lo que hace en Mario Kart
export const OBJETIVOS = [
  ['A', 'A — acelerar / aceptar'], ['B', 'B — frenar, marcha atrás / volver'], ['R', 'R — derrapar / saltar (gatillo)'],
  ['L', 'L — usar objeto (gatillo)'], ['X', 'X — mirar atrás'], ['Y', 'Y'], ['Z', 'Z'], ['START', 'Start — pausa'],
  ['arriba', 'Cruz ↑ — truco'], ['abajo', 'Cruz ↓'], ['izquierda', 'Cruz ←'], ['derecha', 'Cruz →'],
  ['stick.izq', 'Stick ← (girar)'], ['stick.der', 'Stick → (girar)'], ['stick.arr', 'Stick ↑'], ['stick.aba', 'Stick ↓'],
  ['c.izq', 'Stick C ←'], ['c.der', 'Stick C →'], ['c.arr', 'Stick C ↑'], ['c.aba', 'Stick C ↓'],
];
export const ES_OBJETIVO = new Set(OBJETIVOS.map(([id]) => id));
const GATILLOS = new Set(['L', 'R']);
export const MAX_FUENTES = 3;            // por control (lo de siempre usa hasta 2: Start y L)

// ---- las fuentes ----
// ¿la fuente está «apretada»? Un botón: lo que dice el navegador (pressed; un gatillo cuenta desde que lo toca, como
// antes); un eje: pasada la mitad
export function activa(g, f) {
  const m = RE_FUENTE.exec(f || '');
  if (m && m[1] !== undefined) { const b = g?.buttons?.[+m[1]]; return !!b && (typeof b === 'object' ? !!b.pressed : !!+b); }
  return valorFuente(g, f) >= 0.5;
}
const RE_FUENTE = /^(?:b(\d{1,2})|a(\d{1,2})([+-])(?:@(-?\d(?:\.\d{1,2})?))?|a(\d{1,2})~(-?\d(?:\.\d{1,2})?))$/;
export const fuenteValida = f => typeof f === 'string' && RE_FUENTE.test(f);
// cuánto marca una fuente en este mando, de 0 a 1 (un botón: su valor —los gatillos son analógicos—)
export function valorFuente(g, f) {
  const m = RE_FUENTE.exec(f || '');
  if (!m || !g) return 0;
  if (m[1] !== undefined) {
    const b = g.buttons?.[+m[1]];
    if (!b) return 0;
    if (typeof b !== 'object') return +b ? 1 : 0;
    return Number.isFinite(b.value) ? Math.min(1, Math.max(0, b.value)) : b.pressed ? 1 : 0;
  }
  if (m[2] !== undefined) {
    const v = g.axes?.[+m[2]];
    if (!Number.isFinite(v)) return 0;
    const s = m[3] === '+' ? 1 : -1, r = m[4] !== undefined ? +m[4] : 0;
    const lleno = 1 - s * r;                                // (del reposo al tope)
    return lleno > 0 ? Math.min(1, Math.max(0, (s * (v - r)) / lleno)) : 0;
  }
  const v = g.axes?.[+m[5]];
  return Number.isFinite(v) && Math.abs(v - +m[6]) < 0.12 ? 1 : 0;
}

// ---- el mapa por omisión: lo de antes, exacto (controles.mjs hasta §110) ----
// Mapeo "standard" del navegador: 0 abajo · 1 derecha · 2 izquierda · 3 arriba · 4 LB · 5 RB · 6 LT · 7 RT · 8 Back ·
// 9 Start · 12-15 la cruz; ejes 0/1 el stick izquierdo (+y = abajo), 2/3 el derecho. Con la disposición «por letra»
// (Nintendo: la A a la derecha) se cruzan A↔B y X↔Y.
export function mapaPorOmision({ letra = false } = {}) {
  return {
    A: [letra ? 'b1' : 'b0'], B: [letra ? 'b0' : 'b1'], X: [letra ? 'b3' : 'b2'], Y: [letra ? 'b2' : 'b3'],
    Z: ['b5'], START: ['b9', 'b8'], L: ['b6', 'b4'], R: ['b7'],
    arriba: ['b12'], abajo: ['b13'], izquierda: ['b14'], derecha: ['b15'],
    'stick.izq': ['a0-'], 'stick.der': ['a0+'], 'stick.arr': ['a1-'], 'stick.aba': ['a1+'],
    'c.izq': ['a2-'], 'c.der': ['a2+'], 'c.arr': ['a3-'], 'c.aba': ['a3+'],
  };
}
// Un mapa guardado, revisado: solo objetivos y fuentes conocidos, sin repetidos, a lo más MAX_FUENTES; lo que falta,
// vacío (un control sin fuente = no se usa: la persona lo vació a propósito)
export function revisarMapa(m) {
  const r = {};
  for (const [id] of OBJETIVOS) {
    const l = Array.isArray(m?.[id]) ? m[id] : [];
    r[id] = [...new Set(l.filter(fuenteValida))].slice(0, MAX_FUENTES);
  }
  return r;
}
// La asignación vieja (el asistente de §57: botón de GameCube → número de botón del mando): los botones que asignó, y
// los sticks como siempre (aquel asistente no los tocaba)
export function migrarPropio(viejo) {
  const m = mapaPorOmision();
  for (const id of Object.keys(BITS)) m[id] = Number.isInteger(viejo?.[id]) ? ['b' + viejo[id]] : [];
  return revisarMapa(m);
}

// ---- de las fuentes a un mando de GameCube ----
// stick del navegador (−1..1, +y = abajo) → GameCube (−128..127, +y = arriba), zona muerta redonda (como controles.mjs)
function aStickGC(x, y, zona) {
  const r = Math.hypot(x, y);
  if (r < zona) return [0, 0];
  const k = Math.min(1, (r - zona) / (1 - zona)) / r;
  return [Math.round(x * k * 127), Math.round(-y * k * 127)];
}
const maximo = (g, l) => (l || []).reduce((v, f) => Math.max(v, valorFuente(g, f)), 0);
export function aplicarMapa(g, mapa, zona = 0.15) {
  let botones = 0;
  for (const [id, bit] of Object.entries(BITS)) if (!GATILLOS.has(id) && (mapa[id] || []).some(f => activa(g, f))) botones |= bit;
  // gatillos: analógicos (0..255); pasada la mitad, también el botón (el clic de la GameCube)
  const gl = Math.round(255 * maximo(g, mapa.L)), gr = Math.round(255 * maximo(g, mapa.R));
  if (gl > 128) botones |= BITS.L;
  if (gr > 128) botones |= BITS.R;
  const eje = (mas, menos) => maximo(g, mapa[mas]) - maximo(g, mapa[menos]);
  const [sx, sy] = aStickGC(eje('stick.der', 'stick.izq'), eje('stick.aba', 'stick.arr'), zona);
  const [cx, cy] = aStickGC(eje('c.der', 'c.izq'), eje('c.aba', 'c.arr'), zona);
  return { botones, sx, sy, cx, cy, gl, gr };
}

// ---- capturar la próxima entrada (para reasignar un control) ----
// La foto de cómo está el mando al empezar: lo que ya estaba apretado o inclinado (un stick que se va solo, un gatillo
// que el navegador da como eje en −1) no cuenta como «lo que apretó la persona».
export function fotoMando(g) {
  return { botones: (g?.buttons || []).map(b => (b && typeof b === 'object' ? !!b.pressed || (b.value || 0) > 0.5 : !!b)),
           ejes: (g?.axes || []).map(v => (Number.isFinite(v) ? v : 0)) };
}
// La primera entrada nueva desde la foto: un botón que se apretó, o un eje que se movió más de 0,6 desde donde estaba
// (y quedó lejos del centro). El eje que descansa en un extremo (−1: un gatillo) queda con su reposo; el que descansa
// fuera de −1..1 es una cruceta «hat»: se guarda el valor exacto. Devuelve la fuente, o null si todavía nada.
export function capturar(base, g) {
  if (!base || !g) return null;
  const bs = g.buttons || [];
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i], ap = b && typeof b === 'object' ? !!b.pressed || (b.value || 0) > 0.5 : !!b;
    if (ap && !base.botones[i]) return 'b' + i;
  }
  const es = g.axes || [];
  for (let i = 0; i < es.length; i++) {
    const v = es[i], r = base.ejes[i] ?? 0;
    if (!Number.isFinite(v) || Math.abs(v - r) < 0.6) continue;
    if (Math.abs(r) > 1.05) return `a${i}~${redondea(v)}`;                       // hat: descansa fuera de −1..1
    if (Math.abs(v) < 0.5) continue;                                            // (pasó por el centro: todavía no)
    const s = v > 0 ? '+' : '-';
    return Math.abs(r) > 0.8 && Math.sign(r) !== Math.sign(v) ? `a${i}${s}@${redondea(r)}` : `a${i}${s}`;
  }
  return null;
}
const redondea = v => String(Math.round(v * 100) / 100);

// ---- cambiar un mapa ----
// poner(mapa, objetivo, fuente, { sumar }) → { mapa, quitadoDe }: la fuente queda en ese control (sola, o sumada a las
// que tenía) y se quita de cualquier otro (una tecla, un control: si no, apretar un botón haría dos cosas sin querer)
export function poner(mapa, objetivo, fuente, { sumar = false } = {}) {
  if (!ES_OBJETIVO.has(objetivo) || !fuenteValida(fuente)) return { mapa, quitadoDe: [] };
  const m = revisarMapa(mapa), quitadoDe = [];
  for (const [id] of OBJETIVOS) if (id !== objetivo && m[id].includes(fuente)) { m[id] = m[id].filter(f => f !== fuente); quitadoDe.push(id); }
  m[objetivo] = sumar ? [...m[objetivo].filter(f => f !== fuente), fuente].slice(-MAX_FUENTES) : [fuente];
  return { mapa: m, quitadoDe };
}

// ---- el perfil de un mando: su MODELO, no su nombre entero ----
// El nombre que da el navegador cambia entre USB y Bluetooth (otro texto alrededor) y entre Chrome y Firefox, pero el
// fabricante y el producto (dos números de 4 cifras hexadecimales) son los del modelo: la asignación se guarda con eso
// (dos mandos iguales comparten asignación). Si el mando no tiene mapeo «standard», el perfil es aparte (sus botones
// están en otros lugares). Sin números en el nombre: el nombre entero.
export function clavePerfil(id = '', mapping = 'standard') {
  const m = /Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})/i.exec(id) || /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i.exec(id);
  const base = m ? `${m[1].toLowerCase().padStart(4, '0')}:${m[2].toLowerCase().padStart(4, '0')}` : String(id);
  return mapping === 'standard' ? base : base + '·libre';
}

// ---- nombres para mostrar ----
// Los botones del mapeo "standard" con la letra de cada familia (como juegos/audio/mando.js)
const NOMBRES = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→', 'Xbox'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS', 'Panel'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', '↑', '↓', '←', '→', 'Home', 'Captura'],
  generico: ['Abajo', 'Derecha', 'Izquierda', 'Arriba', 'L1', 'R1', 'L2', 'R2', 'Select', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Guía'],
};
const EJES = ['Stick izq. ', 'Stick izq. ', 'Stick der. ', 'Stick der. '];
export function nombreFuente(f, tipo = 'generico', estandar = true) {
  const m = RE_FUENTE.exec(f || '');
  if (!m) return '—';
  if (m[1] !== undefined) {
    const i = +m[1], n = (NOMBRES[tipo] || NOMBRES.generico)[i];
    return estandar && n ? (i >= 12 && i <= 15 ? 'Cruz ' + n : n) : `Botón ${i}`;
  }
  if (m[2] !== undefined) {
    const i = +m[2], s = m[3];
    if (estandar && i < 4) return EJES[i] + (i % 2 === 0 ? (s === '+' ? '→' : '←') : (s === '+' ? '↓' : '↑'));
    return `Eje ${i}${s === '+' ? '+' : '−'}${m[4] !== undefined ? ' (gatillo)' : ''}`;
  }
  return `Cruceta (eje ${m[5]} = ${m[6]})`;
}
