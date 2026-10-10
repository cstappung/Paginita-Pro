import type { Coat } from '../../game/types'
import { hsl, mix } from './plumage'
import { rng } from './kit'

// Pelaje de los gatos a partir de sus genes (`Coat`), con la lógica de la genética real:
// - Pigmento oscuro: negro, chocolate o canela; diluido sale azul (gris), lila o beige.
// - Naranjo: rojo anaranjado o, diluido, crema. Siempre muestra algo de rayas. A medias, carey:
//   manchas de naranjo y de oscuro mezcladas.
// - Atigrado: el fondo se aclara y quedan rayas (finas, remolinos o manchitas) del color oscuro.
// - Blanco: tapa desde abajo: calcetines y pechera, después esmoquin, después casi todo.
// - Colorpoint (siamés): cuerpo claro y orejas, cara, patas y cola oscuras; ojos azules.
// - Los gatitos tienen los ojos azul grisáceo (como de verdad) y los colores un poco más suaves.
// Los colores son lógica pura; las texturas se pintan en un canvas.

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export interface FurColors {
  /** Color principal del cuerpo (el fondo del atigrado, el crema del siamés…). */
  base: string
  /** Rayas del atigrado (y manchas oscuras del carey). */
  stripe: string
  /** Manchas naranjas o crema (carey) y sus rayas. */
  orange: string
  orangeStripe: string
  white: string
  /** Pancita, un poco más clara. */
  belly: string
  /** Patas, orejas, cara y cola del siamés (sin colorpoint, igual que el fondo). */
  point: string
  /** Hocico. */
  muzzle: string
  nose: string
  innerEar: string
  /** Iris de los ojos. */
  eye: string
  /** Cuánto se ven las rayas (0–1). */
  tabby: number
  /** Cuánto blanco (0–1). */
  white01: number
  /** Cuánto colorpoint (0–1). */
  point01: number
}

/** Color oscuro (eumelanina) según marrón y dilución. */
function eumelanin(c: Coat) {
  const solid = c.brown < 0.5 ? mix(hsl(20, 0.12, 0.13), hsl(18, 0.38, 0.25), c.brown * 2) : mix(hsl(18, 0.38, 0.25), hsl(24, 0.45, 0.42), (c.brown - 0.5) * 2)
  const pale = c.brown < 0.5 ? mix(hsl(212, 0.1, 0.55), hsl(10, 0.1, 0.68), c.brown * 2) : mix(hsl(10, 0.1, 0.68), hsl(28, 0.25, 0.72), (c.brown - 0.5) * 2)
  return mix(mix(solid, hsl(28, 0.3, 0.3), 0.12 * rich(c)), pale, dil(c))
}

/** Dilución continua (sin escalones: cada gato sale un poco distinto). */
const dil = (c: Coat) => clamp01(c.dilute) ** 1.4
/** Variación fina del tono (genes menores, distinta en cada gato). */
const rich = (c: Coat) => (c.seed % 997) / 997

/** Colores del pelaje. `kitten`: más suaves y ojos azul grisáceo. */
export function furColors(c: Coat, kitten = false): FurColors {
  const eu = eumelanin(c)
  const orange = mix(mix(hsl(22, 0.82, 0.5), hsl(32, 0.72, 0.62), rich(c)), hsl(34, 0.6, 0.8), dil(c))
  const orangeStripe = mix(mix(hsl(18, 0.82, 0.36), hsl(24, 0.75, 0.46), rich(c)), hsl(30, 0.55, 0.66), dil(c))
  const full = c.orange >= 0.85
  // Atigrado: el fondo se vuelve "agutí" (pelo con puntas claras) y las rayas quedan del color oscuro.
  const tabby = Math.max(c.tabby, full ? 0.5 : 0)
  const agouti = mix(eu, mix(hsl(32, 0.42, 0.56), hsl(30, 0.12, 0.74), dil(c)), 0.62 * sstep(0.25, 0.6, c.tabby))
  const point01 = sstep(0.4, 0.8, c.point)
  const pale = mix(hsl(38, 0.45, 0.9), eu, 0.1)
  let base = full ? orange : agouti
  if (point01) base = mix(base, pale, point01)
  const soft = (x: string) => (kitten ? mix(x, '#ffffff', 0.08) : x)
  const white = '#f8f4ec'
  // Ojos: cobre → amarillo → verde; azules en siameses y en los casi todo blancos.
  let eye = c.eye < 0.5 ? mix(hsl(28, 0.85, 0.48), hsl(50, 0.85, 0.52), c.eye * 2) : mix(hsl(50, 0.85, 0.52), hsl(100, 0.5, 0.42), (c.eye - 0.5) * 2)
  if (point01 > 0.5 || c.white > 0.9) eye = hsl(205, 0.75, 0.58)
  if (kitten) eye = hsl(205, 0.45, 0.62)
  const point = point01 ? mix(base, kitten ? mix(eu, pale, 0.45) : eu, point01) : base
  // Nariz: rosada en los claros y naranjos, oscura en los negros, gris en los azules.
  const dark = full ? 0 : 1 - dil(c) * 0.6
  const nose = c.white > 0.6 ? '#f29aa4' : mix('#f08a8a', mix(hsl(15, 0.15, 0.2), hsl(212, 0.1, 0.45), dil(c)), dark * (point01 ? 1 : 0.9))
  return {
    base: soft(base),
    stripe: soft(eu),
    orange: soft(orange),
    orangeStripe: soft(orangeStripe),
    white,
    belly: soft(mix(base, white, full ? 0.35 : 0.22)),
    point: soft(point),
    muzzle: c.white > 0.12 ? white : soft(mix(point01 ? point : base, white, 0.35)),
    nose,
    innerEar: '#f6a8b4',
    eye,
    tabby,
    white01: c.white,
    point01,
  }
}

type Ctx = CanvasRenderingContext2D

/** Mancha irregular (varios círculos superpuestos). */
function blob(g: Ctx, r: () => number, x: number, y: number, size: number) {
  g.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2
    const d = size * 0.45 * r()
    g.moveTo(x + Math.cos(a) * d + size * 0.6, y + Math.sin(a) * d)
    g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, size * (0.45 + r() * 0.3), size * (0.35 + r() * 0.3), r() * 3, 0, Math.PI * 2)
  }
  g.fill()
}

/**
 * Pelaje del cuerpo de un gato en cuatro patas. La textura envuelve el torso con los polos en el
 * pecho y en el anca: x da la vuelta (0 y 1 = panza, 0,25 y 0,75 = costados, 0,5 = lomo) e y va
 * del pecho (arriba del canvas) al anca (abajo). Las rayas bajan del lomo por los costados.
 */
export function paintFlank(g: Ctx, w: number, h: number, c: Coat, f: FurColors) {
  const r = rng(c.seed + 1)
  g.fillStyle = f.base
  g.fillRect(0, 0, w, h)
  if (c.orange > 0.05 && c.orange < 0.85) {
    g.fillStyle = f.orange
    const n = Math.round(6 + 26 * c.orange)
    for (let i = 0; i < n; i++) blob(g, r, (0.12 + r() * 0.76) * w, (0.05 + r() * 0.9) * h, (0.05 + r() * 0.09) * w)
  }
  if (f.tabby > 0.12) {
    g.globalAlpha = Math.min(1, 0.25 + f.tabby * 0.8) * (1 - 0.7 * f.point01)
    g.strokeStyle = g.fillStyle = c.orange >= 0.85 ? f.orangeStripe : f.stripe
    g.lineCap = 'round'
    // Raya del lomo, de la nuca a la cola.
    g.lineWidth = w * 0.035
    g.beginPath()
    g.moveTo(w * 0.5, h * 0.12)
    g.lineTo(w * 0.5, h * 0.98)
    g.stroke()
    if (c.stripe < 0.4) {
      // Caballa: rayas finas que bajan del lomo por los costados, onduladas.
      g.lineWidth = h * 0.028
      for (let y = 0.16; y < 0.97; y += 0.075) {
        for (const s of [-1, 1]) {
          g.beginPath()
          for (let k = 0; k <= 1.0001; k += 0.05) {
            const x = 0.5 + s * (0.02 + 0.3 * k)
            const yy = y + 0.02 * Math.sin(k * 9 + y * 30) + 0.03 * k
            if (k === 0) g.moveTo(x * w, yy * h)
            else g.lineTo(x * w, yy * h)
          }
          g.stroke()
        }
      }
    } else if (c.stripe < 0.75) {
      // Clásico: remolino (ojo de buey) en cada costado y tres rayas anchas en el lomo.
      g.lineWidth = h * 0.035
      for (const x of [0.25, 0.75])
        for (const k of [0.3, 0.65, 1]) {
          g.beginPath()
          g.ellipse(x * w, h * 0.62, w * 0.09 * k, h * 0.2 * k, 0, 0, Math.PI * 2)
          g.stroke()
        }
      for (const x of [0.44, 0.56]) {
        g.beginPath()
        g.moveTo(x * w, h * 0.15)
        g.lineTo(x * w, h * 0.95)
        g.stroke()
      }
      // Mariposa en los hombros.
      for (const s of [-1, 1]) {
        g.beginPath()
        g.ellipse((0.5 + s * 0.09) * w, h * 0.28, w * 0.06, h * 0.08, 0, 0, Math.PI * 2)
        g.stroke()
      }
    } else {
      // Manchitas (como un gato de Bengala).
      for (let i = 0; i < 90; i++) {
        const x = 0.18 + r() * 0.64
        const y = 0.1 + r() * 0.88
        g.beginPath()
        g.ellipse(x * w, y * h, w * (0.012 + r() * 0.012), h * (0.018 + r() * 0.016), 0, 0, Math.PI * 2)
        g.fill()
      }
    }
    g.globalAlpha = 1
  }
  // Panza más clara (abajo: los bordes del canvas), con el borde difuso.
  g.fillStyle = f.belly
  g.filter = 'blur(8px)'
  g.fillRect(-20, -20, w * 0.12 + 20, h + 40)
  g.fillRect(w * 0.88, -20, w * 0.12 + 20, h + 40)
  g.filter = 'none'
  const wt = c.white
  if (wt > 0.04) {
    g.fillStyle = f.white
    // Pechera y panza blancas; con más blanco sube por los costados; "van": casi todo blanco.
    const side = 0.04 + 0.2 * sstep(0.04, 0.85, wt)
    for (const flip of [false, true]) {
      g.beginPath()
      const x0 = flip ? w : 0
      g.moveTo(x0, 0)
      for (let y = 0; y <= 1.0001; y += 0.04) {
        const reach = side * (1 - 0.35 * y) + (y < 0.25 ? 0.08 * (1 - y / 0.25) : 0) + 0.025 * Math.sin(y * 17 + c.seed)
        g.lineTo(flip ? w * (1 - reach) : w * reach, y * h)
      }
      g.lineTo(x0, h)
      g.fill()
    }
    // El pecho (arriba) va blanco en cuanto hay un poco de blanco.
    g.fillRect(0, 0, w, h * 0.06 * sstep(0.04, 0.3, wt))
    if (wt > 0.85) {
      g.fillRect(0, 0, w, h)
      g.fillStyle = c.orange >= 0.85 ? f.orange : f.base
      for (let i = 0; i < 3; i++) blob(g, r, (0.4 + r() * 0.2) * w, (0.3 + r() * 0.6) * h, 0.08 * w)
    }
  }
}

/** Cabeza (esfera con el frente en u = 0,5): "M" del atigrado, máscara del siamés y lista blanca. */
export function paintHead(g: Ctx, w: number, h: number, c: Coat, f: FurColors, muzzle = false) {
  const r = rng(c.seed + 7)
  g.fillStyle = f.base
  g.fillRect(0, 0, w, h)
  // Carey: media cara de cada color a veces (como los carey de verdad), o manchas.
  if (c.orange > 0.05 && c.orange < 0.85) {
    g.fillStyle = f.orange
    if (r() < 0.4) g.fillRect(r() < 0.5 ? 0 : w * 0.5, 0, w * 0.5, h)
    else for (let i = 0; i < 6; i++) blob(g, r, r() * w, r() * h, 0.12 * w)
  }
  if (f.tabby > 0.12) {
    g.globalAlpha = Math.min(1, 0.3 + f.tabby * 0.8) * (1 - 0.8 * f.point01)
    g.strokeStyle = c.orange >= 0.85 ? f.orangeStripe : f.stripe
    g.lineCap = 'round'
    g.lineWidth = w * 0.012
    // La "M" de la frente.
    for (const [x0, y0, x1, y1] of [
      [0.47, 0.18, 0.475, 0.34],
      [0.5, 0.15, 0.5, 0.33],
      [0.53, 0.18, 0.525, 0.34],
      [0.445, 0.25, 0.465, 0.35],
      [0.555, 0.25, 0.535, 0.35],
    ]) {
      g.beginPath()
      g.moveTo(x0 * w, y0 * h)
      g.lineTo(x1 * w, y1 * h)
      g.stroke()
    }
    // Rayas de las mejillas y de la nuca.
    for (const s of [-1, 1])
      for (const dy of [0, 0.07]) {
        g.beginPath()
        g.moveTo((0.5 + s * 0.11) * w, (0.5 + dy) * h)
        g.quadraticCurveTo((0.5 + s * 0.17) * w, (0.47 + dy) * h, (0.5 + s * 0.22) * w, (0.5 + dy) * h)
        g.stroke()
      }
    for (let u = 0.02; u < 0.3; u += 0.06)
      for (const x of [u, 1 - u]) {
        g.beginPath()
        g.moveTo(x * w, 0.05 * h)
        g.lineTo(x * w, 0.5 * h)
        g.stroke()
      }
    g.globalAlpha = 1
  }
  // Máscara del siamés.
  if (f.point01) {
    const m = g.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, w * 0.16)
    m.addColorStop(0, f.point)
    m.addColorStop(0.55, f.point)
    m.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = m
    g.fillRect(0, 0, w, h)
  }
  // Hocico claro (dos bolitas bajo la nariz y el mentón), con el borde suave.
  if (muzzle) {
    g.fillStyle = f.muzzle
    g.filter = 'blur(3px)'
    for (const dx of [-0.032, 0.032]) {
      g.beginPath()
      g.ellipse((0.5 + dx) * w, h * 0.64, w * 0.048, h * 0.085, 0, 0, Math.PI * 2)
      g.fill()
    }
    g.beginPath()
    g.ellipse(w * 0.5, h * 0.71, w * 0.04, h * 0.06, 0, 0, Math.PI * 2)
    g.fill()
    g.filter = 'none'
  }
  // Lista blanca entre los ojos (en los que tienen bastante blanco).
  if (c.white > 0.3) {
    g.fillStyle = f.white
    const k = sstep(0.3, 0.9, c.white)
    g.beginPath()
    g.moveTo((0.5 - 0.01 - 0.02 * k) * w, (0.32 - 0.2 * k) * h)
    g.lineTo((0.5 + 0.01 + 0.02 * k) * w, (0.32 - 0.2 * k) * h)
    g.lineTo((0.5 + 0.05 + 0.08 * k) * w, h * 0.75)
    g.lineTo((0.5 - 0.05 - 0.08 * k) * w, h * 0.75)
    g.fill()
    g.fillRect(0, h * (0.78 - 0.1 * k), w, h)
  }
}

/** Cola (u a lo largo, de la base a la punta): anillos del atigrado y punta oscura o blanca. */
export function paintTail(g: Ctx, w: number, h: number, c: Coat, f: FurColors) {
  g.fillStyle = f.point01 ? f.point : f.base
  g.fillRect(0, 0, w, h)
  if (c.orange > 0.05 && c.orange < 0.85) {
    g.fillStyle = f.orange
    g.fillRect(w * 0.25, 0, w * 0.3, h)
  }
  if (f.tabby > 0.12) {
    g.globalAlpha = Math.min(1, 0.3 + f.tabby * 0.8) * (1 - 0.8 * f.point01)
    g.fillStyle = c.orange >= 0.85 ? f.orangeStripe : f.stripe
    for (let u = 0.12; u < 1; u += 0.13) g.fillRect(u * w, 0, w * 0.05, h)
    g.fillRect(w * 0.9, 0, w * 0.1, h)
    g.globalAlpha = 1
  }
  if (c.white > 0.6 && c.white < 0.85) {
    g.fillStyle = f.white
    g.fillRect(w * 0.88, 0, w * 0.12, h)
  }
}
