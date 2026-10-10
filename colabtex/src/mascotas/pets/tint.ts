import * as THREE from 'three'

// Colores de los objetos del inventario. Cada objeto tiene una semilla de color: 0 = sus colores
// originales; cualquier otra = un cambio de tonos al azar pero continuo (tonos parecidos se mueven
// parecido, así las sombras y brillos de una misma pieza siguen calzando, y tonos distintos cambian
// por separado: un gorro rojo con pompón amarillo puede salir verde con pompón morado). Grises,
// blancos y negros quedan igual. Lo que tiene que ser de su color (el agua, la paja, el té…) se
// marca en el catálogo (`keep`) y no cambia.
//
// Se aplica mientras se arma el objeto: `withTint(semilla, keep, () => armar())`. Los materiales
// (`toon`, `M`, `MT`, brillos) consultan el contexto activo con `tintHex` / `tintTexture`.

type HSL = [number, number, number]
interface Ctx {
  seed: number
  keep: Set<string>
  map: (c: HSL) => HSL
  /** Tono nuevo para cada grado (para recolorear texturas píxel a píxel). */
  lut: Float32Array
}

let ctx: Ctx | null = null

/** Con menos saturación que esto es un gris (no se toca). */
const NEUTRAL = 0.12

/** Generador con semilla (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** El cambio de colores de una semilla: tono continuo al azar, algo de saturación y de luz. */
export function hueMap(seed: number): (c: HSL) => HSL {
  const r = seeded(seed)
  const a0 = r() * 360
  const a1 = (40 + r() * 80) * (r() < 0.5 ? -1 : 1)
  const p1 = r() * Math.PI * 2
  const a2 = r() * 55
  const p2 = r() * Math.PI * 2
  const sMul = 0.8 + r() * 0.35
  const lShift = (r() - 0.5) * 0.14
  return ([h, s, l]) => {
    const rad = (h * Math.PI) / 180
    const h2 = h + a0 + a1 * Math.sin(rad + p1) + a2 * Math.sin(2 * rad + p2)
    return [((h2 % 360) + 360) % 360, Math.min(1, s * sMul), Math.min(1, Math.max(0, l + lShift * 4 * l * (1 - l)))]
  }
}

/** Arma algo con los colores de `seed` (0 o sin valor = originales). `keep`: colores (o claves de textura) que no cambian; 'all' = nada cambia. */
export function withTint<T>(seed: number | undefined, keep: readonly string[] | 'all' | undefined, build: () => T): T {
  const prev = ctx
  if (!seed || keep === 'all') ctx = null
  else {
    const map = hueMap(seed)
    const lut = new Float32Array(360)
    for (let h = 0; h < 360; h++) lut[h] = map([h, 0.5, 0.5])[0]
    ctx = { seed, keep: new Set(keep?.map((k) => k.toLowerCase())), map, lut }
  }
  try {
    return build()
  } finally {
    ctx = prev
  }
}

/** Arma algo sin cambiar colores (dentro de un `withTint`). */
export function untinted<T>(build: () => T): T {
  return withTint(0, undefined, build)
}

/** ¿Se cambia este color o textura (por su clave) en el contexto activo? */
export const tinting = (key?: string) => !!ctx && !(key && ctx.keep.has(key.toLowerCase()))

/** Firma del contexto para las cachés de materiales ('' = colores originales). */
export const tintSig = (key?: string) => (tinting(key) ? `~${ctx!.seed}` : '')

const tmp = new THREE.Color()

/** Color ("#rrggbb") con el cambio activo (o igual, si no hay o es un color que se mantiene). */
export function tintHex(color: string): string {
  if (!tinting(color)) return color
  return `#${shift(tmp.set(color)).getHexString()}`
}

function shift(c: THREE.Color) {
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl, THREE.SRGBColorSpace)
  if (hsl.s < NEUTRAL) return c
  const [h, s, l] = ctx!.map([hsl.h * 360, hsl.s, hsl.l])
  return c.setHSL(h / 360, s, l, THREE.SRGBColorSpace)
}

const texCache = new Map<string, THREE.Texture>()

/** Textura dibujada en un canvas, recoloreada píxel a píxel con el cambio activo. */
export function tintTexture<T extends THREE.Texture | null | undefined>(tex: T): T {
  if (!tex || !ctx || !(tex.image instanceof HTMLCanvasElement)) return tex
  const key = `${tex.uuid}~${ctx.seed}`
  let out = texCache.get(key)
  if (!out) {
    const src = tex.image as HTMLCanvasElement
    const canvas = document.createElement('canvas')
    canvas.width = src.width
    canvas.height = src.height
    const g = canvas.getContext('2d')!
    g.drawImage(src, 0, 0)
    const img = g.getImageData(0, 0, canvas.width, canvas.height)
    recolor(img.data, ctx)
    g.putImageData(img, 0, 0)
    out = tex.clone()
    out.source = new THREE.Source(canvas)
    out.needsUpdate = true
    texCache.set(key, out)
  }
  return out as T
}

/** Cambia los tonos de los píxeles (RGBA, sRGB). */
function recolor(d: Uint8ClampedArray, c: Ctx) {
  const [, sMulProbe] = c.map([0, 0.5, 0.5])
  const sMul = sMulProbe / 0.5
  const [, , lProbe] = c.map([0, 0.5, 0.5])
  const lShift = lProbe - 0.5
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const r = d[i] / 255
    const gg = d[i + 1] / 255
    const b = d[i + 2] / 255
    const max = Math.max(r, gg, b)
    const min = Math.min(r, gg, b)
    const l = (max + min) / 2
    const dd = max - min
    if (dd < 1e-3) continue
    const s = dd / (1 - Math.abs(2 * l - 1))
    if (s < NEUTRAL) continue
    let h = max === r ? ((gg - b) / dd) % 6 : max === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4
    h = (h * 60 + 360) % 360
    const h2 = c.lut[Math.floor(h) % 360]
    const s2 = Math.min(1, s * sMul)
    const l2 = Math.min(1, Math.max(0, l + lShift * 4 * l * (1 - l)))
    // HSL → RGB
    const a = s2 * Math.min(l2, 1 - l2)
    const f = (n: number) => {
      const k = (n + h2 / 30) % 12
      return l2 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    }
    d[i] = f(0) * 255
    d[i + 1] = f(8) * 255
    d[i + 2] = f(4) * 255
  }
}
