import type { JointName, RigKind } from '../rig/types'
import type { Clip, Ctx, V3 } from './clip'
import { TAU, env, hash } from './util'

// Efectos que comparten todas las reacciones (corazones, notas, burbujas, gotas, destellos, zetas)
// y dónde salen en cada familia de mascota.

/** Punto sobre la cabeza (de donde salen corazones, notas y zetas). */
export const TOP: Record<RigKind, [JointName, V3]> = {
  hen: ['head', [0.02, 0.2, 0.02]],
  chick: ['head', [0.05, 0.48, 0.05]],
  egg: ['body', [0, 1.02, 0]],
  box: ['body', [0, 0.95, 0]],
  cat: ['head', [0.03, 0.22, 0]],
}

/** Centro y radio aproximado del cuerpo (burbujas, gotas, chispas). */
export const BODY: Record<RigKind, { c: V3; r: number }> = {
  hen: { c: [0, 0.45, 0.02], r: 0.32 },
  chick: { c: [0, 0.42, 0], r: 0.44 },
  egg: { c: [0, 0.5, 0], r: 0.38 },
  box: { c: [0, 0.38, 0], r: 0.38 },
  cat: { c: [0, 0.36, 0.02], r: 0.3 },
}

/** Dispara `fn` cada `step` segundos entre a y b (una vez por instante). */
export function every(c: Ctx, a: number, b: number, step: number, fn: (i: number) => void) {
  for (let i = 0; a + i * step < b; i++) if (c.at(a + i * step)) fn(i)
}

export const fromTop = (c: Ctx, kind: Parameters<Ctx['emit']>[0], o: Parameters<Ctx['emit']>[2] = {}) => {
  const [j, off] = TOP[c.kind]
  c.emitFrom(j, off, kind, o)
}

export const heart = (c: Ctx, dx = 0) => fromTop(c, 'heart', { vel: [dx, 0.4, 0.05], life: 1.4, size: 0.13, sway: 0.04, drag: 0.6 })
export const note = (c: Ctx, i: number) =>
  fromTop(c, i % 2 ? 'note2' : 'note', { vel: [(i % 2 ? -1 : 1) * 0.15, 0.4, 0.05], life: 1.4, size: 0.12, sway: 0.05, drag: 0.4 })


/** Burbujas alrededor del cuerpo. */
export function bubbles(c: Ctx, a: number, b: number) {
  const { c: p, r } = BODY[c.kind]
  every(c, a, b, 0.11, (i) => {
    const h = (n: number) => hash(i * 7 + n)
    const ang = h(1) * TAU
    c.emit('bubble', [p[0] + Math.cos(ang) * r * 0.9, p[1] + (h(2) - 0.45) * r * 1.6, p[2] + Math.sin(ang) * r * 0.8 + 0.05], {
      vel: [0, 0.12 + h(3) * 0.15, 0],
      life: 0.9 + h(4) * 0.8,
      size: 0.06 + h(5) * 0.08,
      sway: 0.03,
    })
  })
  every(c, a + 0.05, b, 0.6, () => c.sound('bubble'))
}

/** Gotas que salen volando al sacudirse. */
export function drops(c: Ctx, a: number, b: number) {
  const { c: p, r } = BODY[c.kind]
  every(c, a, b, 0.045, (i) => {
    const ang = hash(i * 3 + 1) * TAU
    const dx = Math.cos(ang)
    const dz = Math.sin(ang)
    c.emit('drop', [p[0] + dx * r, p[1] + (hash(i * 3 + 2) - 0.3) * r, p[2] + dz * r * 0.8], {
      vel: [dx * 1.1, 0.7 + hash(i * 3 + 3) * 0.5, dz * 0.8],
      gravity: -5,
      life: 0.7,
      size: 0.07,
    })
  })
}

export function sparkles(c: Ctx, at: number, n = 5) {
  const { c: p, r } = BODY[c.kind]
  if (!c.at(at)) return
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + 0.4
    c.emit('sparkle', [p[0] + Math.cos(ang) * r * 1.1, p[1] + Math.sin(ang * 2) * r * 0.6 + 0.1, p[2] + Math.sin(ang) * r * 0.5 + 0.1], {
      vel: [0, 0.15, 0],
      life: 0.9,
      size: 0.1,
      delay: i * 0.08,
    })
  }
}

export function zzz(c: Ctx, a: number, b: number) {
  every(c, a, b, 0.75, (i) => fromTop(c, 'z', { vel: [0.12, 0.25, 0.04], life: 1.6, size: 0.09 + (i % 2) * 0.03, sway: 0.04 }))
}

/** Sacudón de perro mojado: oscila rápido y se apaga. */
export const shakeAt = (u: number, a: number, b: number) => (u > a && u < b ? Math.sin(TAU * 7 * (u - a)) * env(u - a, b - a, 0.08, 0.25) : 0)


/** Corre un clip como si hubiera empezado `off` segundos antes (para usar solo su final). */
export const skip = (clip: Clip, off: number): Clip => (c) => clip({ ...c, u: c.u + off, prev: c.prev + off, dur: c.dur + off, at: (x) => c.at(x - off) })

/** Lluvia de agua desde arriba (enjuague). */
export function shower(c: Ctx, a: number, b: number) {
  const { c: p, r } = BODY[c.kind]
  every(c, a, b, 0.035, (i) => {
    const h = (n: number) => hash(i * 11 + n)
    c.emit('drop', [p[0] + (h(1) - 0.5) * r * 2.2, p[1] + r * 2.4 + h(2) * 0.3, p[2] + (h(3) - 0.3) * r], {
      vel: [0, -1.6 - h(4), 0],
      gravity: -4,
      life: 0.55,
      size: 0.06 + h(5) * 0.03,
    })
  })
  if (c.at(a)) c.sound('splash')
}

