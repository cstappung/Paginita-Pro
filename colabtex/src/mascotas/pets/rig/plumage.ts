import type { Look } from '../../game/types'
import type { ChickColors } from './chick'
import type { EggColors } from './egg'
import type { HenColors } from './hen'

// Colores de cada mascota según su "genética" (ver `Look`). Es continua: no hay una lista de razas,
// cualquier punto entre blanca y negra, de gris azulado a dorada o roja caoba, es posible. De los
// mismos genes sale todo, con la lógica de las gallinas de verdad:
// - Gallina clara (blanca, crema, dorada) → pollito amarillo.
// - Gallina roja o café → pollito ante, más tostado cuanto más oscura.
// - Gallina gris azulada → pollito gris.
// - Gallina negra → pollito negro con la pancita clara, y patas y pico oscuros.
// - El huevo va de blanco a café oscuro (las gallinas oscuras y rojizas tienden a poner huevos más
//   oscuros) y algunas ponen huevos azul verdoso, como la araucana.
// Lógica pura (sin three.js) para poder testearla.

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
/** Mezcla de tonos (grados) por el camino corto. */
function lerpHue(a: number, b: number, t: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180
  return (a + d * t + 360) % 360
}

/** HSL (tono en grados, s y l 0–1, en sRGB) a "#rrggbb". */
export function hsl(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360
  s = clamp01(s)
  l = clamp01(l)
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (x: number) =>
    Math.round(clamp01(x) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

/** Mezcla dos "#rrggbb" en RGB: el paso intermedio es gris (mezclar en HSL pasaría por verdes o lilas). */
export function mix(a: string, b: string, t: number) {
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16)
  const hex = (x: number) => Math.round(x).toString(16).padStart(2, '0')
  return `#${[1, 3, 5].map((i) => hex(lerp(c(a, i), c(b, i), clamp01(t)))).join('')}`
}

/** Gris azulado de la misma luz (gallinas "azules" y lavanda, pollitos grises). */
const cool = (l: number) => hsl(215, 0.1, l)

export function henColors(g: Look): HenColors {
  const l = lerp(0.93, 0.12, g.mel ** 0.9)
  // Pigmento: las muy claras quedan crema y las muy oscuras casi sin color (negras).
  const s = lerp(0.05, 0.78, g.pig) * (1 - 0.55 * g.mel * g.mel) * (0.35 + 0.65 * sstep(0, 0.3, g.mel))
  const h = lerp(44, 14, g.red)
  // Sin pigmento cálido, el plumaje tira a gris azulado.
  const grey = (1 - sstep(0.05, 0.35, g.pig)) * 0.85
  const tone = (dh: number, ss: number, ll: number) => mix(hsl(h + dh, ss, ll), cool(ll), grey)
  // Pechera más clara (en las negras casi no se nota).
  const chestL = l + (1 - l) * lerp(0.45, 0.1, g.mel)
  // Cola y puntas de ala: más oscuras según el contraste (blanca con cola negra = patrón colombiano).
  const tailL = lerp(l - 0.12, 0.1, g.contrast * 0.85)
  const tailS = s * lerp(1, 0.35, g.contrast)
  const dark = sstep(0.55, 0.95, g.mel)
  return {
    body: tone(0, s, l),
    chest: tone(4, s * 0.75, chestL),
    feather: tone(-3, s + 0.04, l - 0.07),
    wing: tone(-2, s + 0.02, l - 0.045),
    wingTip: tone(-4, (s + tailS) / 2, (l - 0.1 + tailL) / 2),
    tail: tone(-6, tailS, tailL),
    tailLight: tone(-3, (s + tailS) / 2, (l - 0.05 + tailL) / 2),
    comb: hsl(lerpHue(358, 7, g.red), 0.78, lerp(0.6, 0.5, dark)),
    // Pico y patas: amarillos en las claras, color cuerno y pizarra en las negras.
    beak: mix(hsl(42, 0.95, 0.62), hsl(30, 0.15, 0.32), dark),
    leg: mix(hsl(36, 0.92, 0.6), hsl(220, 0.08, 0.36), dark),
  }
}

export function chickColors(g: Look): ChickColors {
  // Base: amarillo pollito.
  let h = 48
  let s = 0.95
  let l = 0.63
  // Rojas y cafés: pollito ante, más tostado cuanto más oscura y pigmentada.
  const brown = g.pig * sstep(0.3, 0.75, g.mel)
  h = lerp(h, lerp(40, 28, g.red), brown)
  s = lerp(s, 0.62, brown)
  l = lerp(l, 0.47, brown)
  // Negras: pollito negro (con la pancita clara).
  const black = sstep(0.62, 0.92, g.mel)
  l = lerp(l, 0.16, black)
  s = lerp(s, 0.14, black)
  // Grises azuladas: pollito gris.
  const grey = (1 - sstep(0.05, 0.35, g.pig)) * sstep(0.25, 0.6, g.mel) * (1 - black)
  const tone = (dh: number, ss: number, ll: number) => mix(hsl(h + dh, ss, ll), cool(lerp(ll, 0.6, 0.4)), grey)
  const dark = sstep(0.55, 0.95, g.mel)
  return {
    body: tone(0, s, l),
    belly: tone(4, s * 0.8, lerp(l + (1 - l) * 0.55, 0.7, black)),
    fluff: tone(-6, s, l - 0.07),
    wing: tone(-8, s, l - 0.06),
    beak: mix(hsl(32, 0.95, 0.58), hsl(30, 0.2, 0.35), dark),
    feet: mix(hsl(30, 0.95, 0.6), hsl(220, 0.1, 0.4), dark),
  }
}

export function eggColors(g: Look): EggColors {
  // De blanco a café oscuro…
  let h = lerp(40, 22, g.shell)
  let s = lerp(0.35, 0.5, g.shell)
  let l = lerp(0.95, 0.42, g.shell ** 1.15)
  // …y azul verdoso (araucana); si además es oscuro, sale verde oliva.
  if (g.blue) {
    h = lerpHue(170, 75, g.shell * 0.8)
    s = lerp(0.32, 0.38, g.blue)
    l = lerp(0.84, 0.6, g.shell * 0.7) - g.blue * 0.04
  }
  return {
    shell: hsl(h, s, l),
    speck: hsl(h - 8, s + 0.15, l - 0.2),
    crack: '#5a3a22',
  }
}
