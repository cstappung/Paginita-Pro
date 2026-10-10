import type { JointName } from '../rig/types'
import type { JointPose, Pose, PoseMix } from './pose'

// Utilidades para escribir animaciones procedurales: curvas, envolventes y una "capa" que suma
// desplazamientos a la mezcla de poses con un peso.

export const TAU = Math.PI * 2
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Paso suave 0→1 entre a y b. */
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3
export const easeIn = (t: number) => clamp(t) ** 3
export const easeInOut = (t: number) => {
  const x = clamp(t)
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}
/** Rebote al caer: sale de 0, se pasa un poco y vuelve a 1. */
export const backOut = (t: number, k = 1.9) => {
  const x = clamp(t) - 1
  return 1 + (k + 1) * x * x * x + k * x * x
}
/** Resorte amortiguado: arranca en 1 y oscila hacia 0. */
export const spring = (t: number, freq = 3, damp = 5) => (t < 0 ? 0 : Math.exp(-damp * t) * Math.cos(TAU * freq * t))

/** Sube en `fin` segundos, se mantiene y baja en los últimos `fout`. */
export function env(u: number, dur: number, fin = 0.25, fout = 0.3) {
  if (u <= 0 || u >= dur) return 0
  return Math.min(smooth(0, fin, u), 1 - smooth(dur - fout, dur, u))
}

/** Arco de salto 0→1→0 durante [a, b]. */
export function arc(x: number, a: number, b: number) {
  if (x <= a || x >= b) return 0
  const t = (x - a) / (b - a)
  return 4 * t * (1 - t)
}

/** Pulso que decae después de cada golpe (beat entero). */
export const hit = (beat: number, k = 7) => Math.exp(-k * (beat - Math.floor(beat)))
/** 0 en el golpe, 1 a medio camino (rebote al ritmo). */
export const bounce = (beat: number) => Math.abs(Math.sin(Math.PI * beat))
export const frac = (x: number) => x - Math.floor(x)

/** Hash determinista 0–1 (para que todo se pueda reproducir con el mismo reloj). */
export function hash(n: number) {
  let t = (Math.imul(n | 0, 0x9e3779b1) ^ 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Interpola un ángulo por el camino corto. */
export function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return a + d * t
}

/**
 * Rodar sobre una base redonda (huevo, pollito): inclinar `angle` alrededor de z (o x) con el
 * pivote abajo, corrigiendo la posición para que la curva apoye en el suelo en vez de hundirse.
 */
export function rollZ(angle: number, radius: number): JointPose {
  return { rz: angle, px: radius * (Math.sin(angle) - angle), py: radius * (1 - Math.cos(angle)) }
}
export function rollX(angle: number, radius: number): JointPose {
  return { rx: angle, pz: radius * (angle - Math.sin(angle)), py: radius * (1 - Math.cos(angle)) }
}

/** Capa de animación: suma poses a la mezcla con un peso. */
export class Layer {
  constructor(
    public mix: PoseMix,
    public w = 1,
  ) {}
  j(name: JointName, v: JointPose) {
    this.mix.addJoint(name, v, this.w)
    return this
  }
  /** Alas: `out` las abre (positivo = hacia afuera en ambos lados) y `swing` las lleva adelante (negativo) o atrás. */
  wings(out: number, swing = 0, outR = out, swingR = swing) {
    this.mix.addJoint('wingL', { rz: out, rx: swing }, this.w)
    this.mix.addJoint('wingR', { rz: -outR, rx: swingR }, this.w)
    return this
  }
  with(w: number) {
    return new Layer(this.mix, this.w * w)
  }
  pose(p: Pose | null | undefined, w = 1) {
    this.mix.add(p, this.w * w)
    return this
  }
  /**
   * Secuencia de poses clave [x, pose]: mezcla las dos que rodean a `x`.
   * 'smooth' = suave, 'snap' = llega rápido y se queda (robot), con un pequeño rebote.
   */
  seq(x: number, keys: readonly (readonly [number, Pose])[], mode: Ease = 'smooth', snap = 0.25) {
    const [i, t] = keyAt(x, keys, mode, snap)
    this.pose(keys[i][1], 1 - t)
    if (t > 0) this.pose(keys[i + 1][1], t)
    return this
  }
}

export type Ease = 'smooth' | 'snap' | 'linear'

function keyAt(x: number, keys: readonly (readonly [number, unknown])[], mode: Ease, snap: number): [number, number] {
  if (x <= keys[0][0]) return [0, 0]
  for (let i = 0; i < keys.length - 1; i++) {
    const x0 = keys[i][0]
    const x1 = keys[i + 1][0]
    if (x < x1) {
      const u = (x - x0) / (x1 - x0)
      const t = mode === 'linear' ? u : mode === 'smooth' ? easeInOut(u) : backOut(Math.min(1, (x - x0) / Math.min(snap, x1 - x0)), 1.2)
      return [i, t]
    }
  }
  return [keys.length - 1, 0]
}

/** Valor interpolado entre claves [x, valor]. */
export function kf(x: number, keys: readonly (readonly [number, number])[], mode: Ease = 'smooth', snap = 0.25) {
  const [i, t] = keyAt(x, keys, mode, snap)
  return t > 0 ? lerp(keys[i][1], keys[i + 1][1], t) : keys[i][1]
}

/** Suma poses (para armar poses clave a partir de piezas). */
export function P(...parts: (Pose | null | undefined | false)[]): Pose {
  const out: Pose = {}
  for (const p of parts) {
    if (!p) continue
    for (const k in p) {
      const name = k as JointName
      const src = p[name]!
      const dst = (out[name] ??= {})
      for (const c in src) {
        const key = c as keyof JointPose
        dst[key] = (dst[key] ?? 0) + src[key]!
      }
    }
  }
  return out
}

/** Pose de alas: `out` abre (positivo hacia afuera en ambos lados), `swing` negativo = adelante. */
export const W = (out: number, swing = 0, outR = out, swingR = swing): Pose => ({
  wingL: { rz: out, rx: swing },
  wingR: { rz: -outR, rx: swingR },
})

/**
 * Secuencia determinista que se va generando a medida que avanza el reloj: cada elemento dura un
 * tiempo y el siguiente depende del anterior. Saltar a cualquier tiempo da siempre el mismo resultado.
 */
export class Timeline<T extends { t0: number; dur: number }> {
  items: T[] = []
  private i = 0
  private made = 0
  constructor(private next: (prev: T | undefined, index: number) => T) {}
  at(t: number): T {
    if (!this.items.length || t < this.items[0].t0) {
      this.made = 0
      this.items = [this.next(undefined, this.made++)]
      this.i = 0
    }
    while (true) {
      const last = this.items[this.items.length - 1]
      if (t < last.t0 + last.dur) break
      this.items.push(this.next(last, this.made++))
      if (this.items.length > 64) {
        this.items.splice(0, 32)
        this.i = Math.max(0, this.i - 32)
      }
    }
    if (this.i >= this.items.length) this.i = this.items.length - 1
    while (this.i > 0 && this.items[this.i].t0 > t) this.i--
    while (this.i < this.items.length - 1 && this.items[this.i].t0 + this.items[this.i].dur <= t) this.i++
    return this.items[this.i]
  }
  /** Elemento anterior al actual (para mezclar transiciones). */
  before(item: T) {
    const k = this.items.indexOf(item)
    return k > 0 ? this.items[k - 1] : undefined
  }
  reset() {
    this.items = []
    this.i = 0
    this.made = 0
  }
  /** Corta el elemento actual en `t` (lo que sigue se genera desde ahí). */
  cut(t: number) {
    const cur = this.at(t)
    cur.dur = Math.max(0.001, t - cur.t0)
    this.items.length = this.items.indexOf(cur) + 1
  }
}
