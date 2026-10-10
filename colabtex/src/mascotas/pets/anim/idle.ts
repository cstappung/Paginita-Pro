import type { RigKind } from '../rig/types'
import type { Ctx } from './clip'
import { BOX_IDLE, CAT_IDLE, CAT_SPEED, boxBreathe, boxMood, catBreathe, catLook, catMood } from './cat'
import { A, A1, CW, PECK, ROOST, beak, body, foot, gaze, head, neck, rollBody, root, squash, tail } from './poses'
import {
  Layer,
  TAU,
  Timeline,
  arc,
  backOut,
  clamp,
  easeInOut,
  easeOut,
  env,
  frac,
  hash,
  kf,
  lerp,
  lerpAngle,
  smooth,
  spring,
} from './util'

// Vida en reposo: qué hace la mascota cuando nadie la atiende. Una secuencia determinista de
// acciones (picotear, rascar, acicalarse, caminar…) elegidas al azar con pesos según el ánimo.

export type IdleAct =
  | 'rest'
  | 'walk'
  | 'peck'
  | 'scratch'
  | 'preen'
  | 'stretch'
  | 'flap'
  | 'tilt'
  | 'cluck'
  | 'fluff'
  | 'roost'
  | 'hop'
  | 'flutter'
  | 'peep'
  | 'wiggle'
  | 'plop'
  | 'spin'
  | 'wobble'
  | 'shiver'
  | 'rock'
  | 'knock'
  // Gato
  | 'sit'
  | 'loaf'
  | 'groom'
  | 'lick'
  | 'yawn'
  | 'knead'
  | 'roll'
  | 'chase'
  | 'hunt'
  | 'meow'
  | 'sniff'
  // Caja del gatito
  | 'peek'
  | 'paw'
  | 'duck'
  | 'mew'

export interface IdleItem {
  t0: number
  dur: number
  act: IdleAct
  /** Azar propio (0–1). */
  k: number
  /** Posición y orientación al empezar y al terminar (las cambia `walk`). */
  x0: number
  z0: number
  yaw0: number
  x1: number
  z1: number
  yaw1: number
  /** Caminata: rumbo, giro inicial, tramo recto y giro final (s). */
  heading?: number
  ta?: number
  tw?: number
  /** Ritmo de la caminata (1 = paseo; más = apurada, p. ej. yendo a comer). */
  pace?: number
}

export interface IdleEnv {
  seed: number
  sleeping: boolean
  sad: boolean
  roam: boolean
  growth: number
  /** Atenta a quien la cuida (granos, esponja, juguete): se queda quieta, sin hacer sus cosas. */
  busy?: boolean
  /** Cría (el gatito juega más que el gato). */
  young?: boolean
}

const SPEED: Record<RigKind, number> = { egg: 0, chick: 0.17, hen: 0.2, box: 0, cat: CAT_SPEED }
const RADIUS: Record<RigKind, number> = { egg: 0, chick: 0.24, hen: 0.32, box: 0, cat: 0.32 }
/** Ciclo de paso (s). */
const STEP: Record<RigKind, number> = { egg: 1, chick: 0.42, hen: 0.62, box: 1, cat: 0.56 }

type Weights = Partial<Record<IdleAct, number>>
function weights(kind: RigKind, e: IdleEnv): Weights {
  if (e.sleeping || e.busy) return { rest: 1 }
  if (kind === 'egg') {
    const near = clamp((e.growth - 0.3) / 0.6)
    return e.sad
      ? { rest: 3, shiver: 3, wobble: 0.6, knock: 0.3 + near * 2 }
      : { rest: 3, wobble: 2, hop: 1, rock: 1.2, spin: 0.5, shiver: 0.3, knock: 0.4 + near * 3 }
  }
  if (kind === 'box')
    return e.sad ? { rest: 4, wobble: 0.5, mew: 0.6, duck: 0.4 } : { rest: 2.5, peek: 1.6, paw: 1.2, duck: 0.8, wobble: 1.2, mew: 1 }
  if (kind === 'cat') {
    const walk = e.roam ? (e.young ? 2.6 : 2.4) : 0
    if (e.sad) return { rest: 4, loaf: 2, sit: 1.5, walk: walk * 0.25, groom: 0.3 }
    return e.young
      ? { rest: 2, walk, sit: 1, loaf: 0.4, groom: 0.6, lick: 0.4, stretch: 0.6, yawn: 0.4, knead: 0.4, roll: 1, chase: 0.9, hunt: 1.4, meow: 1.1, sniff: 0.8 }
      : { rest: 2.2, walk, sit: 2.2, loaf: 1.3, groom: 1.4, lick: 0.9, stretch: 0.7, yawn: 0.6, knead: 0.5, roll: 0.4, hunt: 0.3, meow: 0.7, sniff: 1 }
  }
  if (kind === 'chick')
    return e.sad
      ? { rest: 5, peck: 0.6, plop: 1.5, walk: e.roam ? 0.6 : 0, tilt: 0.5 }
      : { rest: 2.5, hop: 1.5, tilt: 1.2, flutter: 0.8, peep: 1.2, peck: 1.6, wiggle: 0.8, plop: 0.5, spin: 0.4, walk: e.roam ? 2.4 : 0 }
  return e.sad
    ? { rest: 5, peck: 0.6, roost: 1.4, preen: 0.4, walk: e.roam ? 0.6 : 0 }
    : { rest: 2.6, peck: 2.6, scratch: 1.4, preen: 1.1, stretch: 0.7, flap: 0.5, tilt: 1.2, cluck: 1, fluff: 0.6, roost: 0.35, walk: e.roam ? 3 : 0 }
}

const DUR: Partial<Record<IdleAct, number>> = {
  peck: 2.4,
  scratch: 2.7,
  preen: 2.3,
  stretch: 2.6,
  flap: 1.6,
  tilt: 1.9,
  cluck: 1.5,
  fluff: 1.5,
  roost: 4.5,
  hop: 1.3,
  flutter: 1.3,
  peep: 1.2,
  wiggle: 1.4,
  plop: 3.4,
  spin: 1.4,
  wobble: 2,
  shiver: 1.6,
  rock: 2.4,
  knock: 1.4,
  sit: 6,
  loaf: 7,
  groom: 3.6,
  lick: 3,
  yawn: 2.1,
  knead: 3.2,
  roll: 4,
  chase: 2.8,
  hunt: 2.3,
  meow: 1.5,
  sniff: 2.4,
  peek: 2.5,
  paw: 2.1,
  duck: 2.2,
  mew: 1.3,
}

/** Solo para el estudio: fuerza una acción de reposo (después del primer respiro). */
export const STUDIO_ACT: { act: IdleAct | null } = { act: null }

/** Genera la acción que sigue a `prev`. */
export function nextIdle(kind: RigKind, prev: IdleItem | undefined, idx: number, e: IdleEnv): IdleItem {
  const t0 = prev ? prev.t0 + prev.dur : 0
  const h = (n: number) => hash(e.seed * 7919 + idx * 31 + n)
  const x = prev?.x1 ?? 0
  const z = prev?.z1 ?? 0
  const yaw = prev?.yaw1 ?? 0
  const base = { t0, k: h(9), x0: x, z0: z, yaw0: yaw, x1: x, z1: z, yaw1: yaw }
  if (!prev) return { ...base, dur: 0.6 + h(1), act: 'rest' }

  // Después de una acción, casi siempre un respiro; nunca la misma acción dos veces seguidas.
  const w: Weights = STUDIO_ACT.act ? { [STUDIO_ACT.act]: 1 } : weights(kind, e)
  if (prev.act !== 'rest' && h(2) < 0.65 && !STUDIO_ACT.act) w.rest = (w.rest ?? 0) * 6
  if (prev.act !== 'rest' && !STUDIO_ACT.act) delete w[prev.act]
  const total = Object.values(w).reduce((a, b) => a + b, 0)
  let r = h(3) * total
  let act: IdleAct = 'rest'
  for (const [k, v] of Object.entries(w) as [IdleAct, number][]) {
    if ((r -= v) <= 0) {
      act = k
      break
    }
  }

  if (act === 'rest') return { ...base, dur: (e.sad || e.sleeping || e.busy ? 2 : 0.9) + h(4) * 2.2, act }
  if (act !== 'walk') return { ...base, dur: DUR[act] ?? 2, act }

  // Caminar a un punto nuevo dentro de su lugar y volver a mirar más o menos al frente.
  const R = RADIUS[kind]
  let tx = 0
  let tz = 0
  for (let i = 0; i < 4; i++) {
    const a = h(10 + i) * TAU
    const d = Math.sqrt(h(20 + i)) * R
    tx = Math.cos(a) * d
    tz = Math.sin(a) * d * 0.7
    if (Math.hypot(tx - x, tz - z) > R * 0.45) break
  }
  const dist = Math.hypot(tx - x, tz - z)
  const heading = Math.atan2(tx - x, tz - z)
  const yaw1 = (h(5) - 0.5) * 1.1
  const turn = (a: number, b: number) => Math.abs(lerpAngle(a, b, 1) - a)
  const speed = SPEED[kind] * (e.sad ? 0.6 : 1)
  const ta = 0.15 + turn(yaw, heading) * 0.3
  const tw = dist / speed
  const tc = 0.2 + turn(heading, yaw1) * 0.3
  return { ...base, dur: ta + tw + tc, act, x1: tx, z1: tz, yaw1, heading, ta, tw }
}

/**
 * Caminata dirigida desde donde terminó `prev` hasta (tx, tz). Con `reach` se detiene antes, a esa
 * distancia y mirando el punto (para picotear algo en el suelo o alcanzar un juguete).
 */
export function walkTo(kind: RigKind, prev: IdleItem, tx: number, tz: number, o: { reach?: number; pace?: number; k?: number } = {}): IdleItem {
  const x = prev.x1
  const z = prev.z1
  const yaw = prev.yaw1
  const reach = o.reach ?? 0
  const d = Math.hypot(tx - x, tz - z)
  const sx = reach && d > 1e-4 ? tx - ((tx - x) / d) * reach : tx
  const sz = reach && d > 1e-4 ? tz - ((tz - z) / d) * reach : tz
  const face = reach && d > 1e-4 ? Math.atan2(tx - sx, tz - sz) : Math.atan2(tx - x, tz - z)
  const base = { t0: prev.t0 + prev.dur, k: o.k ?? 0.5, x0: x, z0: z, yaw0: yaw }
  const dist = Math.hypot(sx - x, sz - z)
  const turn = (a: number, b: number) => Math.abs(lerpAngle(a, b, 1) - a)
  // Ya está ahí: solo se da vuelta para mirar.
  if (dist < 0.03 || !SPEED[kind]) return { ...base, act: 'rest', dur: 0.2 + turn(yaw, face) * 0.15, x1: x, z1: z, yaw1: face }
  const pace = o.pace ?? 1
  const heading = Math.atan2(sx - x, sz - z)
  const ta = 0.08 + turn(yaw, heading) * 0.18
  const tw = dist / (SPEED[kind] * pace)
  const tc = 0.08 + turn(heading, face) * 0.18
  return { ...base, act: 'walk', dur: ta + tw + tc, x1: sx, z1: sz, yaw1: face, heading, ta, tw, pace }
}

/** Dónde está y hacia dónde mira la mascota en el instante `u` de la acción. */
export function roamAt(it: IdleItem, u: number) {
  if (it.act !== 'walk') return { x: it.x0, z: it.z0, yaw: lerpAngle(it.yaw0, it.yaw1, smooth(0, Math.min(0.5, it.dur), u)) }
  const ta = it.ta!
  const tw = it.tw!
  if (u < ta) return { x: it.x0, z: it.z0, yaw: lerpAngle(it.yaw0, it.heading!, easeInOut(u / ta)) }
  if (u < ta + tw) {
    const v = (u - ta) / tw
    return { x: lerp(it.x0, it.x1, v), z: lerp(it.z0, it.z1, v), yaw: it.heading! }
  }
  return { x: it.x1, z: it.z1, yaw: lerpAngle(it.heading!, it.yaw1, easeInOut((u - ta - tw) / (it.dur - ta - tw))) }
}

export function idleTimeline(kind: RigKind, env: () => IdleEnv) {
  return new Timeline<IdleItem>((prev, i) => nextIdle(kind, prev, i, env()))
}

// ——— Capas que siempre están: respirar, mirar alrededor, parpadear ———

/** Respiración (más lenta y honda al dormir). */
export function breathe(kind: RigKind, L: Layer, t: number, sleep: number) {
  if (kind === 'cat') return catBreathe(L, t, sleep)
  if (kind === 'box') return boxBreathe(L, t, sleep)
  const period = lerp(kind === 'chick' ? 1.6 : 2.8, 4, sleep)
  const s = Math.sin((TAU * t) / period)
  const a = lerp(1, 1.6, sleep)
  if (kind === 'egg') L.j('body', { sy: 0.008 * s, sx: -0.004 * s, sz: -0.004 * s })
  else if (kind === 'chick') L.j('body', { sy: 0.02 * s * a, sx: -0.008 * s * a, sz: -0.008 * s * a })
  else {
    L.j('body', { sy: 0.012 * s * a, sx: 0.006 * s * a, rx: -0.012 * s })
    L.j('tail', { rx: 0.03 * s })
  }
}

interface Look {
  t0: number
  dur: number
  ry: number
  rx: number
  rz: number
}

/** Mirar alrededor: la gallina mueve la cabeza a saltos (como las de verdad); el pollito, suave. */
export class LookAround {
  private tl: Timeline<Look>
  constructor(
    private kind: RigKind,
    seed: number,
  ) {
    this.tl = new Timeline<Look>((prev, i) => {
      const h = (n: number) => hash(seed * 104729 + i * 17 + n)
      const t0 = prev ? prev.t0 + prev.dur : 0
      // A veces vuelve a mirar al frente (a quien la cuida).
      const front = h(1) < 0.35
      return {
        t0,
        dur: kind === 'hen' ? 0.5 + h(2) * 1.8 : kind === 'cat' ? 0.8 + h(2) * 2.4 : 0.9 + h(2) * 2,
        ry: front ? (h(3) - 0.5) * 0.2 : (h(3) - 0.5) * 1.5,
        rx: (h(4) - 0.55) * 0.35,
        rz: kind === 'hen' && h(5) < 0.3 ? (h(6) - 0.5) * 0.6 : (h(6) - 0.5) * 0.15,
      }
    })
  }
  apply(L: Layer, t: number) {
    if (this.kind === 'egg') return
    const cur = this.tl.at(t)
    const prev = this.tl.before(cur) ?? cur
    const blend = this.kind === 'hen' ? 0.09 : this.kind === 'cat' ? 0.28 : 0.35
    const x = smooth(0, blend, t - cur.t0)
    const ry = lerp(prev.ry, cur.ry, x)
    const rx = lerp(prev.rx, cur.rx, x)
    const rz = lerp(prev.rz, cur.rz, x)
    if (this.kind === 'hen') L.pose(gaze(ry, rx, rz))
    else if (this.kind === 'cat') L.pose(catLook(ry, rx, rz))
    else L.j('head', { ry: ry * 0.8, rx: rx * 0.6, rz })
  }
  reset() {
    this.tl.reset()
  }
}

/** Parpadeo (1 = abiertos). A veces doble. */
export function blinkAt(t: number, seed: number) {
  const P = 3.4
  const n = Math.floor(t / P)
  const at = n * P + 0.3 + hash(seed * 31 + n) * 2.6
  const dbl = hash(seed * 37 + n) < 0.22
  const d = t - at
  const shut = (x: number) => (x > 0 && x < 0.15 ? Math.sin((Math.PI * x) / 0.15) : 0)
  return 1 - Math.max(shut(d), dbl ? shut(d - 0.22) : 0)
}

// ——— Ánimo ———

export function moodLayers(kind: RigKind, L: Layer, t: number, sad: number, sleep: number, young = false) {
  if (kind === 'cat') return catMood(L, t, sad, sleep, young ? 0.72 : 1)
  if (kind === 'box') return boxMood(L, sad, sleep)
  if (sad > 0) {
    const S = L.with(sad)
    if (kind === 'hen') S.pose(neck(0.25)).pose(head(0.32)).pose(body(0.08)).pose(A(0.05, -0.18, 0.05, -0.18, 0.06)).pose(tail(-0.35))
    else if (kind === 'chick') S.j('head', { rx: 0.35 }).j('body', { sy: -0.04, sx: 0.02, sz: 0.02 }).pose(CW(-0.08))
    else S.j('body', { sy: -0.025, sx: 0.012, sz: 0.012 })
  }
  if (sleep > 0) {
    const S = L.with(sleep)
    if (kind === 'hen') S.pose(ROOST).pose(neck(0.3)).pose(head(0.35, 0, 0.12)).pose(A(0, 0, 0, 0, -0.03))
    else if (kind === 'chick')
      S.j('body', { py: -0.04, sy: -0.09, sx: 0.05, sz: 0.05 }).j('head', { rx: 0.32, rz: 0.15 + 0.03 * Math.sin(t * 1.5) })
  }
}

// ——— Acciones ———

type IdleClip = (c: Ctx, it: IdleItem) => void

/** Andar de la gallina: pasos con el pie apoyado quieto en el suelo y la cabeza "estabilizada". */
function henWalk(c: Ctx, it: IdleItem) {
  // Apurada da pasos más cortos y seguidos (no solo más largos).
  const pace = it.pace ?? 1
  const T = STEP.hen / Math.sqrt(pace)
  const ta = it.ta!
  const tw = it.tw!
  const moving = smooth(ta - 0.05, ta + 0.12, c.u) * (1 - smooth(ta + tw - 0.12, ta + tw + 0.05, c.u))
  const stepping = env(c.u, c.dur, 0.12, 0.2)
  const S = (SPEED.hen * pace * T) / 2
  const ph = c.u / T
  for (const [s, off] of [
    [1, 0],
    [-1, 0.5],
  ] as const) {
    const p = frac(ph + off)
    let z: number
    let y = 0
    if (p < 0.5) z = S / 2 - S * (p / 0.5)
    else {
      const q = (p - 0.5) / 0.5
      z = -S / 2 + S * easeInOut(q)
      y = Math.sin(Math.PI * q) * lerp(0.035, 0.06, moving)
    }
    c.L.with(stepping).pose(foot(s, y, z * moving))
  }
  // Cabeza: queda fija en el aire mientras el cuerpo avanza y luego se adelanta de golpe.
  const q = frac(ph * 2)
  const a = S * 0.38 * moving
  const hz = q < 0.7 ? a - 2 * a * (q / 0.7) : -a + 2 * a * easeOut((q - 0.7) / 0.3)
  c.L.with(stepping)
    .j('head', { pz: hz, py: -Math.abs(hz) * 0.3 })
    .pose(body(0.06 * moving, 0.045 * Math.sin(TAU * ph), 0.03 * Math.sin(TAU * ph), -0.008 * Math.abs(Math.cos(TAU * ph))))
    .pose(tail(0, -0.12 * Math.sin(TAU * ph)))
    .pose(A(0, 0, 0, 0, 0.03))
}

/** Andar del pollito: bamboleo de lado a lado con saltitos. */
function chickWalk(c: Ctx, it: IdleItem) {
  const pace = it.pace ?? 1
  const T = STEP.chick / Math.sqrt(pace)
  const ta = it.ta!
  const tw = it.tw!
  const moving = smooth(ta - 0.05, ta + 0.1, c.u) * (1 - smooth(ta + tw - 0.1, ta + tw + 0.05, c.u))
  const stepping = env(c.u, c.dur, 0.1, 0.15)
  const S = (SPEED.chick * pace * T) / 2
  const ph = c.u / T
  const L = c.L.with(stepping)
  for (const [s, off] of [
    [1, 0],
    [-1, 0.5],
  ] as const) {
    const p = frac(ph + off)
    const z = p < 0.5 ? S / 2 - S * (p / 0.5) : -S / 2 + S * easeInOut((p - 0.5) / 0.5)
    const y = p < 0.5 ? 0 : Math.sin((Math.PI * (p - 0.5)) / 0.5) * 0.04
    L.pose(foot(s, y, z * moving))
  }
  const sw = Math.sin(TAU * ph)
  L.pose(rollBody(0.11 * sw, 0.05 * moving, c.R))
    .pose(root(0.018 * Math.abs(Math.cos(TAU * ph))))
    .j('head', { rz: -0.06 * sw })
    .pose(CW(0.08 + 0.06 * Math.abs(sw)))
}

const HEN: Partial<Record<IdleAct, IdleClip>> = {
  walk: henWalk,
  peck(c, it) {
    const n = 2 + Math.floor(it.k * 2.5)
    let dip = 0
    for (let i = 0; i < n; i++) {
      const t0 = 0.5 + i * 0.4
      if (c.u > t0 && c.u < t0 + 0.2) dip = Math.sin((Math.PI * (c.u - t0)) / 0.2)
      if (c.at(t0 + 0.1)) c.sound('peck')
    }
    c.L.with(env(c.u, c.dur, 0.35, 0.45)).pose(PECK, 0.62 + 0.38 * dip).pose(head(0, (it.k - 0.5) * 0.4))
  },
  scratch(c, it) {
    const s = it.k < 0.5 ? 1 : -1
    const L = c.L.with(env(c.u, c.dur, 0.25, 0.4))
    L.pose(body(-0.04, -s * 0.05)).pose(gaze(s * 0.25, 0.3))
    for (const t0 of [0.25, 0.95]) {
      const x = c.u - t0
      if (x < 0 || x > 0.65) continue
      L.pose(foot(s, arc(x, 0, 0.25) * 0.06, kf(x, [[0, 0], [0.18, 0.04], [0.45, -0.13], [0.65, 0]])))
      if (c.at(t0 + 0.4)) {
        c.sound('peck')
        c.emit('puff', [s * 0.1, 0.03, -0.12], { vel: [s * 0.05, 0.12, -0.25], life: 0.6, size: 0.09, drag: 2 })
      }
    }
    // Mira lo que desenterró y le da un picotazo.
    const look = env(c.u - 1.7, 1.0, 0.25, 0.35)
    L.pose(PECK, look * (0.55 + 0.45 * arc(c.u, 2.05, 2.3)))
    if (c.at(2.17)) c.sound('peck')
  },
  preen(c, it) {
    const s = it.k < 0.5 ? 1 : -1
    const w = env(c.u, c.dur, 0.35, 0.4)
    const nib = c.u > 0.5 && c.u < 1.8 ? Math.sin(c.u * 34) * 0.5 + 0.5 : 0
    c.L.with(w)
      .pose(neck(0.25, s * 0.95))
      .pose(head(0.55 + nib * 0.12, s * 1.1, s * 0.2))
      .pose(A1(s, 0.15, 0.1, 0.22))
      .pose(body(0, s * 0.06))
      .j('head', { pz: -nib * 0.012 })
  },
  stretch(c, it) {
    const s = it.k < 0.5 ? 1 : -1
    const w = env(c.u, c.dur, 0.5, 0.5)
    c.L.with(w)
      .pose(A1(s, 0.65, -0.55, 0.25))
      .pose(foot(s, 0.05, -0.14))
      .pose(body(0.14, s * 0.05))
      .pose(gaze(-s * 0.2, -0.2))
      .pose(tail(0.1, -s * 0.2))
  },
  flap(c) {
    const w = env(c.u, c.dur, 0.2, 0.35)
    const f = c.u > 0.2 && c.u < 1.2 ? Math.sin(TAU * 3.2 * (c.u - 0.2)) : 0
    c.L.with(w)
      .pose(A(1.25, 0.25 + 0.55 * f, 1.25, 0.25 + 0.55 * f, 0.2))
      .pose(body(-0.18))
      .pose(root(arc(c.u, 0.35, 0.95) * 0.07))
      .pose(head(-0.2))
      .pose(tail(0.25))
  },
  tilt(c, it) {
    const s = it.k < 0.5 ? 1 : -1
    // Ladea la cabeza de golpe, mira un rato y la ladea al otro lado.
    const a = kf(c.u, [[0, 0], [0.12, s], [0.9, s], [1.0, -s * 0.7], [1.6, -s * 0.7], [1.75, 0]], 'snap', 0.1)
    c.L.pose(head(-0.08 * Math.abs(a), a * 0.25, a * 0.45)).pose(neck(0, a * 0.12))
  },
  cluck(c) {
    const L = c.L.with(env(c.u, c.dur, 0.15, 0.25))
    let open = 0
    for (const t0 of [0.2, 0.55, 0.9]) open = Math.max(open, arc(c.u, t0, t0 + 0.16))
    if (c.at(0.2)) c.sound('cluck')
    L.pose(beak(open * 0.3)).j('head', { pz: open * 0.02, rx: -open * 0.1 }).j('body', { sy: open * 0.02 })
  },
  fluff(c) {
    const L = c.L.with(env(c.u, c.dur, 0.15, 0.3))
    const shake = c.u > 0.25 ? Math.exp(-4 * (c.u - 0.25)) * Math.sin(TAU * 9 * (c.u - 0.25)) : 0
    const puff = env(c.u, c.dur, 0.2, 0.5)
    L.j('body', { sx: 0.07 * puff, sz: 0.05 * puff, ry: 0.09 * shake })
      .pose(A(0, 0, 0, 0, 0.15 * puff))
      .pose(tail(0.15 * puff, 0.3 * shake))
      .pose(gaze(-0.5 * shake))
  },
  roost(c) {
    const w = env(c.u, c.dur, 0.6, 0.6)
    c.L.with(w).pose(ROOST)
    if (c.u > 1.2 && c.u < c.dur - 0.9) c.face('happy')
  },
}

const CHICK: Partial<Record<IdleAct, IdleClip>> = {
  walk: chickWalk,
  hop(c, it) {
    const n = it.k < 0.5 ? 1 : 2
    let y = 0
    let sq = 0
    for (let i = 0; i < n; i++) {
      const t0 = 0.25 + i * 0.5
      y += arc(c.u, t0, t0 + 0.38)
      sq += -0.14 * arc(c.u, t0 - 0.15, t0) + 0.1 * arc(c.u, t0, t0 + 0.2) - 0.12 * arc(c.u, t0 + 0.36, t0 + 0.5)
    }
    c.L.pose(root(y * 0.13)).pose(squash(sq)).pose(CW(y * 0.4))
  },
  tilt(c, it) {
    const s = it.k < 0.5 ? 1 : -1
    const w = env(c.u, c.dur, 0.3, 0.35)
    c.L.with(w).j('head', { rz: s * 0.38, ry: s * 0.2 }).pose(rollBody(s * 0.06, 0, c.R))
  },
  flutter(c) {
    const w = env(c.u, c.dur, 0.1, 0.25)
    const f = Math.sin(TAU * 7 * c.u)
    c.L.with(w).pose(CW(0.55 + 0.45 * f)).pose(root(arc(c.u, 0.2, 1.0) * 0.06)).j('head', { rx: -0.2 })
  },
  peep(c) {
    let open = 0
    for (const t0 of [0.15, 0.45]) open = Math.max(open, arc(c.u, t0, t0 + 0.14))
    if (c.at(0.15)) c.sound('peep')
    c.L.with(env(c.u, c.dur, 0.15, 0.25))
      .pose(beak(open * 0.4))
      .j('head', { rx: -0.18 })
      .pose(squash(open * 0.06))
      .pose(CW(open * 0.2))
  },
  peck(c) {
    let dip = 0
    for (const t0 of [0.5, 0.95]) {
      if (c.u > t0 && c.u < t0 + 0.2) dip = Math.sin((Math.PI * (c.u - t0)) / 0.2)
      if (c.at(t0 + 0.1)) c.sound('peck')
    }
    const w = env(c.u, c.dur, 0.3, 0.4)
    c.L.with(w).pose(rollBody(0, 0.32 + 0.15 * dip, c.R)).j('head', { rx: 0.25 + 0.15 * dip })
  },
  wiggle(c) {
    const w = env(c.u, c.dur, 0.15, 0.3)
    const s = Math.sin(TAU * 3 * c.u)
    c.L.with(w).pose(rollBody(0.15 * s, 0, c.R)).pose(CW(0.2 + 0.2 * Math.abs(s))).j('head', { rz: -0.1 * s })
    c.face('happy')
  },
  plop(c) {
    // Se sienta de golpe (rebota un poquito), descansa y se para.
    const down = smooth(0.1, 0.3, c.u) * (1 - smooth(c.dur - 0.5, c.dur - 0.1, c.u))
    const bump = c.u > 0.3 ? spring(c.u - 0.3, 4, 7) : 0
    c.L.j('body', { py: -0.05 * down, sy: -0.1 * down - 0.04 * bump, sx: 0.06 * down + 0.03 * bump, sz: 0.06 * down }).j('head', { rx: 0.08 * down })
    if (c.u > 0.6 && c.u < c.dur - 0.6) c.face('happy')
  },
  spin(c) {
    const air = arc(c.u, 0.3, 0.95)
    const turn = smooth(0.3, 0.95, c.u)
    c.L.pose(root(air * 0.15, turn < 1 ? TAU * turn : 0))
      .pose(squash(-0.14 * arc(c.u, 0.1, 0.3) + 0.1 * air - 0.12 * arc(c.u, 0.93, 1.15)))
      .pose(CW(air * 0.5))
  },
}

const EGG: Partial<Record<IdleAct, IdleClip>> = {
  wobble(c, it) {
    const s = it.k < 0.5 ? 1 : -1
    const a = c.u < 0.15 ? 0 : s * 0.2 * spring(c.u - 0.15, 1.3, 2.2)
    c.L.pose(rollBody(a * (1 - smooth(c.dur - 0.3, c.dur, c.u)), 0, c.R))
  },
  hop(c) {
    const air = arc(c.u, 0.35, 0.8)
    const sq = -0.12 * arc(c.u, 0.12, 0.35) + 0.08 * air - 0.1 * arc(c.u, 0.78, 1.0)
    c.L.pose(root(air * 0.12)).pose(squash(sq, 'body'))
    if (c.at(0.8)) c.sound('pop')
  },
  shiver(c) {
    const w = env(c.u, c.dur, 0.15, 0.3)
    c.L.with(w).pose(rollBody(0.035 * Math.sin(TAU * 13 * c.u), 0, c.R)).j('body', { sy: -0.02, sx: 0.01, sz: 0.01 })
  },
  rock(c) {
    const w = env(c.u, c.dur, 0.2, 0.3)
    c.L.with(w).pose(rollBody(0, 0.14 * Math.sin((TAU * c.u) / c.dur), c.R))
  },
  spin(c) {
    const air = arc(c.u, 0.25, 1.25)
    const turn = easeInOut(smooth(0.25, 1.25, c.u))
    c.L.pose(root(air * 0.06, turn < 1 ? TAU * turn : 0)).pose(squash(-0.08 * arc(c.u, 0.05, 0.25) - 0.08 * arc(c.u, 1.2, 1.45), 'body'))
  },
  knock(c, it) {
    // Golpecitos desde adentro: dos tirones secos.
    const s = it.k < 0.5 ? 1 : -1
    let p = 0
    for (const t0 of [0.25, 0.55]) {
      p += c.u > t0 ? Math.exp(-14 * (c.u - t0)) * Math.sin(TAU * 6 * (c.u - t0)) : 0
      if (c.at(t0)) {
        c.sound('knock')
        if (c.growth > 0.6) c.emit('sparkle', [s * 0.12, 0.7, 0.2], { vel: [s * 0.2, 0.3, 0.1], life: 0.5, size: 0.08 })
      }
    }
    c.L.pose(rollBody(s * 0.07 * p, 0, c.R)).j('body', { sy: 0.03 * Math.abs(p) })
  },
}

export const IDLE_CLIPS: Record<RigKind, Partial<Record<IdleAct, IdleClip>>> = { hen: HEN, chick: CHICK, egg: EGG, cat: CAT_IDLE, box: BOX_IDLE }

/** Cuánto mira alrededor durante cada acción (las que mueven la cabeza la apagan). */
export const LOOK: Partial<Record<IdleAct, number>> = {
  peck: 0.15,
  scratch: 0.2,
  preen: 0,
  stretch: 0.3,
  flap: 0.3,
  tilt: 0.2,
  cluck: 0.6,
  fluff: 0.2,
  peep: 0.4,
  walk: 0.4,
  sit: 0.8,
  loaf: 0.5,
  groom: 0,
  lick: 0,
  yawn: 0.1,
  knead: 0.5,
  roll: 0,
  chase: 0,
  hunt: 0,
  meow: 0.3,
  sniff: 0,
  peek: 0,
  paw: 0.5,
  duck: 0,
  mew: 0.3,
}

export { backOut }
