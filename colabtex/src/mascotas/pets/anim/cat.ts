import * as THREE from 'three'
import type { JointMix, JointName, PetRig } from '../rig/types'
import type { Clip, Ctx } from './clip'
import type { CueId } from './cues'
import { bubbles, drops, every, fromTop, heart, note, shakeAt, shower, skip, sparkles, zzz } from './effects'
import type { IdleAct, IdleItem } from './idle'
import type { Pose } from './pose'
import { root, squash } from './poses'
import { Layer, P, TAU, arc, backOut, clamp, easeInOut, env, frac, hash, kf, lerp, smooth, spring } from './util'

// Animaciones propias del gato y del gatito (familia 'cat') y de la caja con el gatito ('box').
// Nada de esto viene de la gallina: el gato camina en cuatro patas cruzando las patas, se sienta
// con la cola alrededor, se echa como pancito, se acicala lamiéndose la pata, se estira, bosteza,
// amasa, se revuelca panza arriba, se persigue la cola, caza con el traste meneándose y duerme
// enroscado. Solo los bailes usan la coreografía de la gallina, adaptada a un gato parado en dos
// patas (`catDance`).
//
// Convenciones (además de las de poses.ts): el cuerpo gira en las caderas (rx− = levanta el pecho,
// rx+ = lo baja); `paw` mueve las patas de adelante en el piso (espacio de la raíz) y `arm` las usa
// como brazos (espacio del cuerpo); `ears` echa las orejas atrás o las abre; la cola tiene cuatro
// tramos (`ctail`: levantar, mover de lado, enroscar y la punta).

type IdleClip = (c: Ctx, it: IdleItem) => void

/** Tamaño: el gatito mide ~0,72 del gato (los desplazamientos se escalan con esto). */
const zOf = (rig: PetRig) => (rig.young ? 0.72 : 1)
const size = (c: Ctx) => zOf(c.rig)

// ——— Vocabulario de poses ———

const side = (s: number): 'L' | 'R' => (s > 0 ? 'L' : 'R')
/** Pata de adelante apoyada (espacio de la raíz; `px` hacia afuera). s = 1 izquierda. */
export const paw = (s: number, py = 0, pz = 0, px = 0): Pose => ({ [`paw${side(s)}`]: { py, pz, px: s * px } })
const paws = (py = 0, pz = 0): Pose => P(paw(1, py, pz), paw(-1, py, pz))
/** Pata de adelante como brazo: `follow` (0–1) la despega del piso y la lleva con el cuerpo; el resto, en el espacio del cuerpo. */
export const arm = (s: number, follow: number, py = 0, pz = 0, px = 0, rx = 0): Pose => ({ [`arm${side(s)}`]: { sx: follow, py, pz, px: s * px, rx } })
/** Pata de atrás (espacio de la raíz). */
export const hind = (s: number, py = 0, pz = 0, px = 0): Pose => (s > 0 ? { footL: { py, pz, px } } : { footR: { py, pz, px: -px } })
const hinds = (py = 0, pz = 0): Pose => P(hind(1, py, pz), hind(-1, py, pz))
export const cbody = (rx = 0, rz = 0, ry = 0, py = 0, pz = 0): Pose => ({ body: { rx, rz, ry, py, pz } })
const cneck = (rx = 0, ry = 0, rz = 0): Pose => ({ neck: { rx, ry, rz } })
const chead = (rx = 0, ry = 0, rz = 0): Pose => ({ head: { rx, ry, rz } })
/** Mirar: el giro se reparte entre cuello y cabeza. */
export const look = (ry: number, rx = 0, rz = 0): Pose => ({ neck: { ry: ry * 0.4, rx: rx * 0.4 }, head: { ry: ry * 0.6, rx: rx * 0.6, rz } })
/** Orejas: `back` las echa atrás (− = bien paradas adelante), `out` las abre de lado (de avión), `turn` las gira. */
export const ears = (back = 0, out = 0, turn = 0): Pose => ({ earL: { rx: -back, rz: -out, ry: turn }, earR: { rx: -back, rz: out, ry: -turn } })
const ear = (s: number, back = 0, out = 0): Pose => (s > 0 ? { earL: { rx: -back, rz: -out } } : { earR: { rx: -back, rz: out } })
/** Cola: `up` la levanta, `swing` la lleva de lado, `curl` enrosca la punta (+ hacia adelante) y `tip` mueve la puntita. */
export const ctail = (up = 0, swing = 0, curl = 0, tip = 0): Pose => ({
  tail: { rx: up, ry: swing },
  tail2: { rx: curl * 0.45, ry: swing * 0.7 },
  tail3: { rx: curl * 0.75, ry: swing * 0.5 + tip * 0.35 },
  tail4: { rx: curl, ry: tip },
})
/** Cola esponjada (susto). */
const puff = (k: number): Pose => ({ tail: { sx: 0.7 * k, sz: 0.7 * k } })
/** Boca abierta (0–1,5). */
export const mouth = (k: number): Pose => ({ beak: { pz: 0.045 * Math.min(1, k) + 0.012 * Math.max(0, k - 1), py: -0.006 * k } })

/** Cola apoyada en el piso, rodeando las patas por el lado `s`. */
const eul = (q: THREE.Quaternion) => {
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ')
  return { rx: e.x, ry: e.y, rz: e.z }
}
/** Dirección de cada tramo de la cola en reposo (una S que sube). */
const dirs = (ds: number[][]) => ds.map((d) => new THREE.Vector3(...d).normalize())
const TAIL_DIRS = { cat: dirs([[0, 0.35, -1], [0, 1, -0.55], [0, 1, 0.05], [0, 0.7, 0.6]]), kitten: dirs([[0, 0.6, -1], [0, 1, -0.3], [0, 1, 0.2], [0, 0.6, 0.6]]) }
const wraps = new Map<string, Pose>()
/**
 * Cola apoyada en el piso rodeando las patas por el lado `s`: cada tramo apunta a su rumbo
 * (`heads`, radianes desde atrás hacia adelante) con su pendiente (`slopes`). Se calcula en el
 * espacio del mundo y se pasa al de cada articulación, así queda en el piso aunque el cuerpo esté
 * inclinado (`bodyRx`).
 */
function wrapTail(bodyRx: number, s: number, heads: readonly number[], slopes: readonly number[], young = false): Pose {
  const key = `${bodyRx}:${s}:${heads}:${slopes}:${young}`
  let pose = wraps.get(key)
  if (pose) return pose
  const out: Pose = {}
  let parent = new THREE.Quaternion().setFromEuler(new THREE.Euler(bodyRx, 0, 0, 'YXZ'))
  ;(['tail', 'tail2', 'tail3', 'tail4'] as const).forEach((n, i) => {
    const cur = TAIL_DIRS[young ? 'kitten' : 'cat'][i].clone().applyQuaternion(parent)
    const a = heads[i] * s
    const want = new THREE.Vector3(-Math.sin(a) * Math.cos(slopes[i]), Math.sin(slopes[i]), -Math.cos(a) * Math.cos(slopes[i]))
    const l = parent.clone().invert().multiply(new THREE.Quaternion().setFromUnitVectors(cur, want)).multiply(parent)
    out[n] = eul(l)
    parent = parent.multiply(l)
  })
  wraps.set(key, out)
  return (pose = out)
}
const SIT_TAIL = [[1.5, 2.2, 2.75, 3.1], [-0.85, -0.05, 0, 0.05]] as const
const LOAF_TAIL = [[1.4, 2.1, 2.7, 3.1], [-1.1, -0.4, -0.05, 0]] as const
const CURL_TAIL = [[1.5, 2.3, 3.0, 3.5], [-1.1, -0.4, -0.05, 0]] as const

/** Sentado: ancas al piso, pecho arriba, patas de adelante derechas bajo el pecho y la cola alrededor. */
const SIT = (z: number, s = 1): Pose => P(cbody(-0.68, 0, 0, -0.075 * z), cneck(0.66), chead(0.04), paws(0, -0.1 * z), hinds(0, 0.05 * z), wrapTail(-0.68, s, ...SIT_TAIL, z < 1), ears(-0.05))
/** Echado como pancito: patas recogidas bajo el pecho. */
const LOAF = (z: number, s = 1): Pose => P(cbody(0.02, 0, 0, -0.112 * z), paws(0, -0.04 * z), hinds(0, 0.05 * z), cneck(0.12), wrapTail(0.02, s, ...LOAF_TAIL, z < 1), ears(0.05, 0.08))
/** Enroscado durmiendo: echado, ladeado, la cabeza apoyada de costado y la cola tapándole la nariz. */
const CURL = (z: number): Pose =>
  P(cbody(0.02, 0.16, 0.12, -0.112 * z), paws(0, -0.04 * z), hinds(0, 0.05 * z), wrapTail(0.02, 1, ...CURL_TAIL, z < 1), cneck(0.5, 0.7, 0.15), chead(0.28, 0.35, 0.3), ears(0.2, 0.15))
/** Agazapado (acechando). */
const CROUCH = (z: number): Pose => P(cbody(0.07, 0, 0, -0.06 * z), cneck(-0.1), chead(0.1), ears(-0.2), ctail(-0.25, 0, -0.1))

// ——— Andar ———

const STEP_T = { cat: 0.56, kitten: 0.42 }
export const CAT_SPEED = 0.21

/**
 * Caminar en cuatro patas: al paso las patas van de a una (atrás izquierda, adelante izquierda,
 * atrás derecha, adelante derecha); apurado pasa al trote (diagonales juntas) con más rebote.
 */
function catWalk(c: Ctx, it: IdleItem) {
  const z = size(c)
  const pace = it.pace ?? 1
  const trot = smooth(1.4, 2.2, pace)
  const T = (c.rig.young ? STEP_T.kitten : STEP_T.cat) / Math.sqrt(pace)
  const ta = it.ta!
  const tw = it.tw!
  const moving = smooth(ta - 0.05, ta + 0.12, c.u) * (1 - smooth(ta + tw - 0.12, ta + tw + 0.05, c.u))
  const L = c.L.with(env(c.u, c.dur, 0.1, 0.18))
  const S = (CAT_SPEED * pace * T) / 2
  const ph = c.u / T
  const step = (off: number, lift: number) => {
    const p = frac(ph + off)
    if (p < 0.5) return { y: 0, z: (S / 2 - S * (p / 0.5)) * moving }
    const q = (p - 0.5) / 0.5
    return { y: Math.sin(Math.PI * q) * lift * moving, z: (-S / 2 + S * easeInOut(q)) * moving }
  }
  const lh = step(0, 0.032 * z)
  const lf = step(lerp(0.25, 0.5, trot), 0.045 * z)
  const rh = step(0.5, 0.032 * z)
  const rf = step(lerp(0.75, 0, trot), 0.045 * z)
  L.pose(hind(1, lh.y, lh.z)).pose(hind(-1, rh.y, rh.z)).pose(paw(1, lf.y, lf.z)).pose(paw(-1, rf.y, rf.z))
  const w = TAU * ph
  const bob = lerp(0.005, 0.016, trot) * z
  L.pose(cbody(0.015 * Math.sin(w * 2) * moving, 0.03 * Math.sin(w) * moving, 0.035 * Math.sin(w) * moving, -bob * Math.abs(Math.cos(w)) * moving))
    // La cabeza queda firme mientras el cuerpo se mece (mira adonde va).
    .pose(cneck(0.04 * moving, -0.03 * Math.sin(w) * moving, -0.02 * Math.sin(w) * moving))
    // Cola en alto, contenta, con la punta enroscada; al trote, más baja.
    .pose(ctail((0.32 - 0.3 * trot) * moving, 0.12 * Math.sin(w * 0.5) * moving, 0.35 * moving, 0.25 * Math.sin(w) * moving))
    .pose(ears(0.12 * trot * moving))
}

// ——— Vida de fondo: respirar, mover la cola y las orejas ———

/** Respira, mueve la cola despacio (la puntita sola) y a veces da un tironcito con una oreja. */
export function catBreathe(L: Layer, t: number, sleep: number) {
  const period = lerp(2.4, 4.2, sleep)
  const s = Math.sin((TAU * t) / period)
  const a = lerp(1, 1.6, sleep)
  L.j('body', { sy: 0.012 * s * a, sx: 0.008 * s * a, sz: 0.004 * s * a })
  const awake = L.with(1 - sleep)
  awake.pose(ctail(0.05 * Math.sin((TAU * t) / 5.3), 0.2 * Math.sin((TAU * t) / 4.1), 0.05 * Math.sin((TAU * t) / 3.3), 0.4 * Math.sin((TAU * t) / 1.9)))
  const PER = 2.9
  const n = Math.floor(t / PER)
  const d = t - (n * PER + hash(n * 13 + 5) * 2.2)
  if (d > 0 && d < 0.3) {
    const k = Math.sin((Math.PI * d) / 0.3)
    awake.pose(ear(hash(n * 7 + 1) < 0.5 ? 1 : -1, 0.45 * k, 0.25 * k))
  }
}

/** Mirar alrededor: el gato gira la cabeza suave y las orejas acompañan. */
export const catLook = (ry: number, rx: number, rz: number): Pose => P(look(ry, rx, rz * 0.6), ears(0, 0, ry * 0.25))

/** Ánimo: triste (orejas gachas, cabeza baja, cola caída) y dormido (enroscado). */
export function catMood(L: Layer, t: number, sad: number, sleep: number, z: number) {
  if (sad > 0) L.with(sad).pose(P(cbody(0.04, 0, 0, -0.03 * z), cneck(0.32), chead(0.15), ears(0.45, 0.35), ctail(-0.55, 0, -0.3)))
  if (sleep > 0) L.with(sleep).pose(CURL(z)).j('head', { rz: 0.03 * Math.sin(t * 1.3) })
}

/** Siguiendo el puntero láser: se agazapa, lo mira fijo, la cola se agita y, de cerca, menea el traste. */
export function catWatch(L: Layer, rel: number, down: number, dist: number, t: number, z: number) {
  const near = clamp(1 - dist / 0.9)
  L.pose(look(rel, down)).pose(ears(-0.2))
  L.with(near).pose(CROUCH(z)).pose(cbody(0, 0, 0.07 * Math.sin(TAU * 4 * t))).pose(ctail(0, 0.3 * Math.sin(TAU * 2.5 * t), 0, 0.6 * Math.sin(TAU * 6 * t)))
}

/** Mientras lo frotan con la esponja: gruñón pero se deja (orejas de avión, encogido, cola que azota). */
export function catScrub(L: Layer, t: number, z: number) {
  L.pose(ears(0.3, 0.55))
    .pose(cbody(0.04, 0.03 * Math.sin(TAU * 0.8 * t), 0, -0.03 * z))
    .j('body', { sy: -0.03, sx: 0.02 })
    .pose(cneck(-0.08))
    .pose(ctail(-0.3, 0.6 * Math.sin(TAU * 1.6 * t), 0, 0.6 * Math.sin(TAU * 3.2 * t)))
}

// ——— Acciones de reposo ———

const flip = (it: IdleItem) => (it.k < 0.5 ? 1 : -1)

export const CAT_IDLE: Partial<Record<IdleAct, IdleClip>> = {
  walk: catWalk,

  // Se sienta un rato: cola alrededor de las patas, parpadeo lento (cariño de gato) y orejitas.
  sit(c, it) {
    const z = size(c)
    const s = flip(it)
    const w = env(c.u, c.dur, 0.55, 0.6)
    c.L.with(w).pose(SIT(z, s)).pose(ctail(0, 0, 0, 0.3 * Math.sin(TAU * 0.6 * c.u)))
    const blink = 1.6 + it.k * 2
    if (c.u > blink && c.u < blink + 0.7) c.face('happy')
    if (c.at(blink)) c.sound('purr')
  },

  // Pancito: se echa con las patas recogidas, entrecierra los ojos y ronronea.
  loaf(c, it) {
    const z = size(c)
    const w = env(c.u, c.dur, 0.75, 0.7)
    c.L.with(w).pose(LOAF(z, flip(it)))
    if (c.u > 1.2 && c.u < c.dur - 1) c.face('happy')
    if (c.at(1.4)) c.sound('purr')
  },

  // Se acicala: sentado, se lame la pata y se la pasa por la cara y la oreja.
  groom(c, it) {
    const z = size(c)
    const s = flip(it)
    const u = c.u
    const L = c.L.with(env(u, c.dur, 0.45, 0.5))
    L.pose(SIT(z, s))
    // La pata sube a la boca (0,6–2) y la lame.
    const up = env(u - 0.6, 2.7, 0.3, 0.35)
    const lick = env(u - 0.7, 1.3, 0.15, 0.15)
    const wash = env(u - 2.0, 1.2, 0.2, 0.25)
    const circle = TAU * 1.6 * (u - 2.0)
    L.pose(arm(s, up, (0.2 + 0.07 * wash + 0.04 * wash * Math.sin(circle)) * z, (0.3 - 0.04 * wash + 0.03 * wash * Math.cos(circle)) * z, -0.04 * z, -0.9 * up))
      .pose(cneck(0.25 * lick - 0.1 * wash, s * 0.15 * up))
      .pose(chead(0.2 * lick + 0.1 * Math.max(0, Math.sin(TAU * 4 * u)) * lick, s * 0.2 * up, -s * 0.35 * wash))
      .pose(mouth(0.35 * lick * Math.max(0, Math.sin(TAU * 4 * u))))
      .pose(ear(s, 0.4 * wash, 0.2 * wash))
    if (lick > 0.5 || wash > 0.5) c.face('happy')
    every(c, 0.8, 1.9, 0.25, () => c.sound('lick'))
  },

  // Se lame el costado: gira el cuello bien atrás.
  lick(c, it) {
    const s = flip(it)
    const u = c.u
    const w = env(u, c.dur, 0.4, 0.45)
    const lk = Math.max(0, Math.sin(TAU * 3.5 * u))
    c.L.with(w)
      .pose(cbody(0.03, s * 0.08, s * 0.22, -0.02 * size(c)))
      .pose(cneck(0.5 + 0.05 * lk, s * 1.25, s * 0.2))
      .pose(chead(0.35 + 0.08 * lk, s * 0.5, s * 0.3))
      .pose(mouth(0.3 * lk * smooth(0.5, 0.7, u) * (1 - smooth(c.dur - 0.6, c.dur - 0.4, u))))
      .pose(ctail(0.1, -s * 0.4))
    if (u > 0.6 && u < c.dur - 0.5) c.face('happy')
    every(c, 0.7, c.dur - 0.5, 0.29, () => c.sound('lick'))
  },

  // Estirón: primero adelante (pecho al piso, traste arriba, bostezo), después una pata atrás.
  stretch(c, it) {
    const z = size(c)
    const s = flip(it)
    const u = c.u
    const front = env(u - 0.15, 1.45, 0.45, 0.4)
    const back = env(u - 1.6, 1.15, 0.35, 0.35)
    c.L.with(front)
      .pose(cbody(0.3, 0, 0, -0.02 * z))
      .pose(paws(0, 0.12 * z))
      .pose(cneck(-0.5))
      .pose(chead(-0.1))
      .pose(ctail(0.55, 0, 0.45))
      .pose(ears(0.3, 0.1))
      .pose(mouth(1.3 * arc(u, 0.55, 1.3)))
    if (u > 0.5 && u < 1.35) c.face('sleep')
    if (c.at(0.6)) c.sound('yawn')
    c.L.with(back).pose(cbody(-0.08, s * 0.04, 0, 0.012 * z)).pose(hind(s, 0.035 * z, -0.13 * z)).pose(paws(0, -0.02 * z)).pose(cneck(0.12)).pose(ctail(0.25, -s * 0.2))
  },

  // Bostezo enorme con la lengüita, ojos cerrados y orejas atrás.
  yawn(c) {
    const z = size(c)
    const u = c.u
    const w = env(u, c.dur, 0.35, 0.4)
    const open = kf(u, [[0, 0], [0.35, 0.2], [0.7, 1.5], [1.25, 1.5], [1.5, 0]])
    c.L.with(w).pose(SIT(z), 0.6).pose(cneck(-0.3 * smooth(0.3, 0.7, u) * (1 - smooth(1.3, 1.6, u)))).pose(chead(-0.2 * open / 1.5)).pose(ears(0.35 * open / 1.5, 0.15))
    c.L.pose(mouth(open))
    if (u > 0.45 && u < 1.45) c.face('sleep')
    if (c.at(0.4)) c.sound('yawn')
    // Se relame al terminar.
    c.L.pose(mouth(0.35 * arc(u, 1.6, 1.9)))
  },

  // Amasa: pisa alternando las patas de adelante, feliz, con los ojos cerrados.
  knead(c) {
    const z = size(c)
    const u = c.u
    const w = env(u, c.dur, 0.45, 0.5)
    const ph = TAU * 1.7 * u
    const L = c.L.with(w)
    L.pose(cbody(0.06, 0.03 * Math.sin(ph), 0, -0.04 * z)).pose(cneck(0.15)).pose(ears(0.05, 0.25)).pose(ctail(0.1, 0, 0.2))
    L.pose(paw(1, 0.035 * z * Math.max(0, Math.sin(ph)), 0.015 * z)).pose(paw(-1, 0.035 * z * Math.max(0, -Math.sin(ph)), 0.015 * z))
    if (u > 0.4 && u < c.dur - 0.4) c.face('happy')
    if (c.at(0.5)) c.sound('purr')
  },

  // Se tira de costado y se revuelca panza arriba, pataleando el aire.
  roll(c, it) {
    const z = size(c)
    const s = flip(it)
    const u = c.u
    const w = env(u, c.dur, 0.6, 0.7)
    const wig = Math.sin(TAU * 1.4 * u) * env(u - 0.9, c.dur - 1.6, 0.3, 0.3)
    const bat = Math.sin(TAU * 3 * u)
    c.L.with(w)
      .pose(cbody(0, s * (1.3 + 0.25 * wig), 0, -0.07 * z))
      .pose(arm(1, 1, (0.05 + 0.03 * bat) * z, -0.02 * z, 0.02 * z, -0.6))
      .pose(arm(-1, 1, (0.05 - 0.03 * bat) * z, -0.02 * z, 0.02 * z, -0.6))
      .pose(hind(s, 0.13 * z, 0.02 * z, -0.08 * z))
      .pose(hind(-s, 0.02 * z, 0, -0.07 * z))
      .pose(cneck(0.1, -s * 0.2))
      .pose(chead(0, 0, -s * 0.9))
      .pose(ctail(0, s * 0.5 * Math.sin(TAU * 1.2 * u)))
      .pose(ears(0.1, 0.2))
    if (u > 0.5 && u < c.dur - 0.5) c.face('happy')
    if (c.at(0.8)) c.sound('mrrp')
  },

  // Gatito: se persigue la cola dando vueltas y queda mareado.
  chase(c, it) {
    const z = size(c)
    const s = flip(it)
    const u = c.u
    const spin = easeInOut(smooth(0.25, 1.9, u))
    const w = env(u, c.dur, 0.2, 0.35)
    const run = env(u - 0.2, 1.8, 0.15, 0.2)
    const ph = TAU * 4 * u
    c.L.pose(root(0.02 * Math.abs(Math.sin(ph)) * run, spin > 0 && spin < 1 ? -s * TAU * 2 * spin : 0))
    c.L.with(w)
      .pose(cbody(0.05, s * 0.12 * run, s * 0.35 * run, -0.02 * z))
      .pose(look(s * 1.3 * run, 0.25 * run))
      .pose(ctail(0.2, -s * 0.8 * run, 0, s * 0.6 * Math.sin(ph)))
      .pose(paw(1, 0.03 * z * Math.max(0, Math.sin(ph)) * run, 0)).pose(paw(-1, 0.03 * z * Math.max(0, -Math.sin(ph)) * run, 0))
    const dizzy = env(u - 1.95, 0.75, 0.1, 0.2)
    c.L.pose(chead(0, 0.25 * Math.cos(TAU * 1.5 * u) * dizzy, 0.3 * Math.sin(TAU * 1.5 * u) * dizzy))
    c.face(dizzy > 0.3 ? 'dizzy' : 'happy')
  },

  // Gatito: acecha algo imaginario, menea el traste y salta encima.
  hunt(c, it) {
    const z = size(c)
    const s = flip(it)
    const u = c.u
    const crouch = smooth(0.05, 0.35, u) * (1 - smooth(0.95, 1.05, u))
    const wiggle = Math.sin(TAU * 5 * u) * env(u - 0.45, 0.55, 0.1, 0.1)
    const leap = arc(u, 1.0, 1.4)
    const land = smooth(1.35, 1.45, u) * (1 - smooth(1.9, 2.2, u))
    c.L.pose(CROUCH(z), crouch).pose(cbody(0, 0.04 * wiggle, 0.14 * wiggle)).pose(hind(1, 0.012 * z * Math.max(0, wiggle), 0)).pose(hind(-1, 0.012 * z * Math.max(0, -wiggle), 0))
    c.L.pose(ctail(-0.2 * crouch, s * 0.3 * wiggle, 0, 0.8 * Math.sin(TAU * 7 * u) * crouch))
    c.L.pose(root(0.11 * z * leap)).pose(cbody(-0.25 * leap, 0, 0, 0)).pose(arm(1, leap, 0.03 * z, 0.06 * z)).pose(arm(-1, leap, 0.03 * z, 0.06 * z))
    c.L.pose(paws(0, 0.06 * z), land).pose(cneck(0.55 * land)).pose(squash(-0.06 * arc(u, 1.38, 1.6)))
    c.face(u < 1.0 ? 'surprised' : u < 1.6 ? 'happy' : 'normal')
    if (c.at(1.0)) c.sound('mrrp')
  },

  // Maúlla (el gatito, dos veces).
  meow(c) {
    const u = c.u
    const young = c.rig.young
    const w = env(u, c.dur, 0.2, 0.3)
    const o = arc(u, 0.2, 0.6) + (young ? arc(u, 0.75, 1.1) : 0)
    c.L.with(w).pose(cneck(-0.2)).pose(chead(-0.12)).pose(ears(-0.15))
    c.L.pose(mouth(o)).pose(chead(-0.08 * o))
    if (c.at(0.2) || (young && c.at(0.75))) c.sound('meow')
  },

  // Olfatea el piso, moviendo la cabeza y la nariz.
  sniff(c, it) {
    const s = flip(it)
    const u = c.u
    const w = env(u, c.dur, 0.4, 0.45)
    c.L.with(w)
      .pose(cbody(0.06, 0, 0, -0.01 * size(c)))
      .pose(cneck(0.75, s * 0.35 * Math.sin(TAU * 0.4 * u)))
      .pose(chead(0.25 + 0.03 * Math.sin(TAU * 7 * u), 0, 0))
      .pose(ears(-0.15))
      .pose(ctail(0.15, 0, 0.2))
  },
}

// ——— Reacciones ———

/** Croquetas que caen delante (cuando el estudio las pide; en el juego ya están en el piso). */
function kibbleRain(c: Ctx) {
  const T = c.rig.peckTarget
  if (!c.at(0.05)) return
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + c.k * 3
    const r = 0.03 + hash(i * 13 + Math.floor(c.k * 1000)) * 0.06
    c.emit('grain', [T[0] + Math.cos(a) * r, 0.5 + i * 0.05, T[2] + Math.sin(a) * r * 0.6], {
      vel: [0, -0.2, 0],
      gravity: -4,
      ground: true,
      life: 3.4 - i * 0.05,
      size: 0.065,
      delay: i * 0.06,
      spin: (i % 2 ? 1 : -1) * 4,
    })
  }
}

const BITES = [0.75, 1.3, 1.85, 2.4]

/** Comer: agacha la cabeza al plato, mastica de lado (como los gatos), se relame y ronronea. */
function catFeed(rain: boolean): Clip {
  return (c) => {
    if (rain) kibbleRain(c)
    const z = size(c)
    const u = c.u
    const down = smooth(0.25, 0.6, u) * (1 - smooth(2.75, 3.05, u))
    let chew = 0
    for (const t0 of BITES) {
      chew = Math.max(chew, arc(u, t0, t0 + 0.45))
      if (c.at(t0 + 0.05)) {
        c.take('grain', c.rig.peckTarget, 0.25)
        c.sound('crunch')
      }
    }
    const side = Math.sin(TAU * 2.2 * u)
    c.L.pose(CROUCH(z), 0.6 * down)
      .pose(cneck(0.95 * down, 0.08 * side * down))
      .pose(chead((0.2 - 0.12 * chew) * down, 0, 0.22 * chew * Math.sign(side) * down))
      .pose(mouth(0.35 * chew * Math.abs(Math.sin(TAU * 3 * u))))
      .pose(ears(-0.1 * down, 0.1 * down))
      .pose(ctail(0.2 * down, 0, 0.3 * down))
    // Al final: se sienta, se relame y suelta un corazón.
    const done = smooth(2.9, 3.2, u)
    c.L.pose(SIT(z), 0.5 * done).pose(mouth(0.4 * (arc(u, 3.05, 3.25) + arc(u, 3.3, 3.5))))
    if (c.at(3.05)) c.sound('purr')
    if (c.at(3.15)) heart(c)
    if (u > 2.9) c.face('happy')
  }
}

/** Celebración después de jugar: saltito de lado con el lomo arqueado, se revuelca y maúlla. */
const catPlay: Clip = (c) => {
  const z = size(c)
  const u = c.u
  const s = c.k < 0.5 ? 1 : -1
  c.face('happy')
  // Saltito "de cangrejo": de costado, lomo arqueado y cola esponjada.
  const hop = arc(u, 0.2, 0.75)
  c.L.pose(root(0.12 * z * hop, s * 0.6 * hop))
    .pose(cbody(0, s * 0.15 * hop, 0, 0.02 * z * hop))
    .j('body', { sy: 0.1 * hop })
    .pose(ctail(0.7 * hop, 0, 0.3 * hop))
    .pose(puff(hop))
    .pose(squash(-0.08 * arc(u, 0.05, 0.22) - 0.08 * arc(u, 0.72, 0.9)))
  // Se tira panza arriba y patalea.
  const flop = env(u - 1.0, 1.9, 0.35, 0.4)
  const bat = Math.sin(TAU * 3.2 * u)
  c.L.with(flop)
    .pose(cbody(0, s * 1.35, 0, -0.07 * z))
    .pose(arm(1, 1, (0.05 + 0.035 * bat) * z, -0.02 * z, 0.02 * z, -0.6))
    .pose(arm(-1, 1, (0.05 - 0.035 * bat) * z, -0.02 * z, 0.02 * z, -0.6))
    .pose(hind(s, 0.12 * z, 0, -0.08 * z))
    .pose(hind(-s, 0.02 * z, 0, -0.07 * z))
    .pose(chead(0, 0, -s * 0.9))
  if (c.at(0.2)) c.sound('mrrp')
  if (c.at(2.7)) c.sound('meow')
  every(c, 0.5, 3, 0.7, (i) => note(c, i))
}

/**
 * Se abalanza sobre el puntero: agazapado menea el traste, salta con las patas adelante y lo
 * aplasta (en `POUNCE_BITE`); después levanta una pata para ver si lo atrapó.
 */
const catPounce: Clip = (c) => {
  const z = size(c)
  const u = c.u
  const s = c.k < 0.5 ? 1 : -1
  const crouch = smooth(0, 0.12, u) * (1 - smooth(0.24, 0.3, u))
  const wiggle = Math.sin(TAU * 9 * u) * crouch
  const leap = arc(u, 0.26, 0.5)
  const slam = smooth(0.4, 0.46, u) * (1 - smooth(0.85, 1.1, u))
  c.L.pose(CROUCH(z), crouch).pose(cbody(0, 0, 0.12 * wiggle)).pose(ctail(0, 0.3 * wiggle, 0, 0.6 * wiggle))
  c.L.pose(root(0.1 * z * leap)).pose(cbody(-0.3 * leap)).pose(arm(1, leap, 0.04 * z, 0.06 * z)).pose(arm(-1, leap, 0.04 * z, 0.06 * z)).pose(ears(-0.2 * leap))
  // Aplasta: las dos patas adelante en el piso, la cabeza mirando entre ellas.
  c.L.pose(paws(0, 0.07 * z), slam).pose(cbody(0.12 * slam, 0, 0, -0.03 * z * slam)).pose(cneck(0.6 * slam)).pose(squash(-0.07 * arc(u, 0.44, 0.62)))
  // Levanta una pata y espía abajo (¿lo atrapé?).
  const peek = env(u - 0.85, 0.6, 0.15, 0.2)
  c.L.pose(paw(s, 0.05 * z * peek, 0.07 * z)).pose(chead(0.25 * peek, -s * 0.2 * peek, s * 0.35 * peek)).pose(ears(-0.2 * peek))
  if (c.at(0.26)) c.sound('mrrp')
  if (c.at(1.25)) heart(c)
  c.face(u < 0.3 ? 'surprised' : u < 0.85 ? 'normal' : 'happy')
}

/** Baño: mojado y gruñón (orejas atrás, encogido), se sacude entero y después se acicala orgulloso. */
const catClean: Clip = (c) => {
  const z = size(c)
  const u = c.u
  bubbles(c, 0.05, 1.9)
  const wet = smooth(0.1, 0.5, u) * (1 - smooth(1.95, 2.15, u))
  c.L.pose(P(cbody(0.04, 0, 0, -0.04 * z), cneck(0.2), ears(0.5, 0.45), ctail(-0.6, 0.4 * Math.sin(TAU * 1.5 * u))), wet).j('body', { sy: -0.05 * wet, sx: -0.03 * wet, sz: -0.02 * wet })
  if (u < 2) c.face('sad')
  // Sacudón de gato: empieza en la cabeza y recorre el cuerpo hasta la cola.
  const s = shakeAt(u, 2.0, 2.85)
  const s2 = shakeAt(u - 0.08, 2.0, 2.85)
  c.L.pose(chead(0, 0.6 * s, 0.35 * s)).pose(cbody(0, 0.18 * s2, 0.12 * s2)).pose(ears(0.2 * Math.abs(s), 0.5 * Math.abs(s))).pose(ctail(0.2 * Math.abs(s2), 0.6 * s2))
  if (c.at(2.0)) c.sound('splash')
  drops(c, 2.05, 2.7)
  if (u >= 2 && u < 2.85) c.face('dizzy')
  // Esponjado y se lame la pata, conforme.
  const after = smooth(2.85, 3.1, u)
  c.L.j('body', { sx: 0.05 * after * (1 - smooth(3.5, 3.8, u)), sz: 0.04 * after })
  c.L.pose(SIT(z), after * 0.8).pose(arm(1, 0.8 * env(u - 2.95, 0.8, 0.2, 0.2), 0.2 * z, 0.3 * z, -0.04 * z, -0.9)).pose(mouth(0.3 * arc(u, 3.15, 3.35)))
  sparkles(c, 2.95)
  if (u > 2.9) c.face('happy')
}

/** Acostarlo: bosteza, da una vuelta en el lugar, se echa y se enrosca (termina como el dormir de catMood). */
const catSleep: Clip = (c) => {
  const z = size(c)
  const u = c.u
  const yawn = kf(u, [[0, 0], [0.15, 0.3], [0.45, 1.4], [0.8, 1.4], [1.0, 0]])
  c.L.pose(mouth(yawn)).pose(chead(-0.15 * yawn)).pose(ears(0.25 * yawn))
  if (c.at(0.2)) c.sound('yawn')
  // Vuelta en el lugar (los gatos giran antes de echarse).
  const turn = smooth(0.9, 1.9, u)
  c.L.pose(root(0, turn > 0 && turn < 1 ? TAU * easeInOut(turn) : 0))
  const ph = TAU * 4 * u
  const stepping = arc(u, 0.9, 1.9)
  c.L.pose(paw(1, 0.025 * z * Math.max(0, Math.sin(ph)) * stepping)).pose(paw(-1, 0.025 * z * Math.max(0, -Math.sin(ph)) * stepping))
  // Se echa y se enrosca.
  const down = smooth(1.8, 2.5, u)
  c.L.pose(CURL(z), down)
  zzz(c, 2.4, 3.2)
  if (u > 0.2 && u < 0.85) c.face('sleep')
  if (u > 2.0) c.face('sleep')
}

/** Despertar: levanta la cabeza, bosteza enorme, se estira adelante y sacude la cabeza. */
const catWake: Clip = (c) => {
  const z = size(c)
  const u = c.u
  const curl = 1 - smooth(0.3, 1.2, u)
  c.L.pose(CURL(z), curl)
  const yawn = kf(u, [[0.3, 0], [0.55, 1.4], [0.95, 1.4], [1.15, 0]])
  c.L.pose(mouth(yawn)).pose(cneck(-0.25 * yawn / 1.4)).pose(ears(0.3 * yawn / 1.4))
  if (c.at(0.4)) c.sound('yawn')
  const st = env(u - 1.1, 1.0, 0.3, 0.35)
  c.L.pose(cbody(0.3 * st, 0, 0, -0.02 * z * st)).pose(paws(0, 0.12 * z * st)).pose(cneck(-0.45 * st)).pose(ctail(0.55 * st, 0, 0.4 * st))
  const s = shakeAt(u, 2.15, 2.6)
  c.L.pose(chead(0, 0.55 * s, 0.3 * s)).pose(ears(0, 0.5 * Math.abs(s)))
  if (c.at(2.65)) {
    c.sound('mrrp')
    fromTop(c, 'sparkle', { vel: [0.15, 0.4, 0.05], life: 0.7, size: 0.08 })
  }
  c.face(u < 0.35 ? 'sleep' : u < 1.15 ? 'sleep' : u < 2.6 ? 'normal' : 'happy')
}

/** Lo tocan: susto de gato (lomo arqueado, cola esponjada, salto de costado) y después se mimosea. */
const catPoke: Clip = (c) => {
  const z = size(c)
  const u = c.u
  const s = c.k < 0.5 ? 1 : -1
  const fright = env(u, 0.8, 0.04, 0.3)
  const jump = arc(u, 0.02, 0.3)
  c.L.pose(root(0.07 * z * jump, s * 0.35 * fright))
    .j('body', { sy: 0.14 * fright, sz: -0.05 * fright })
    .pose(cbody(0, 0, 0, 0.025 * z * fright))
    .pose(ctail(0.9 * fright, 0, -0.2 * fright))
    .pose(puff(fright))
    .pose(ears(0.5 * fright, 0.2 * fright))
    .pose(cneck(-0.1 * fright))
  // Se le pasa: frota la cabeza como pidiendo mimos.
  const rub = env(u - 0.75, 0.6, 0.15, 0.2)
  c.L.pose(chead(0, 0, 0.3 * Math.sin(TAU * 1.8 * u) * rub)).pose(ears(0, 0.2 * rub))
  if (c.at(0.02)) c.sound('mrrp')
  if (c.at(0.85)) heart(c)
  c.face(u < 0.6 ? 'surprised' : 'happy')
}

/** No quiere: da vuelta la cara con la nariz arriba, orejas de lado y golpes de cola. */
const catRefuse: Clip = (c) => {
  const z = size(c)
  const u = c.u
  const s = c.k < 0.5 ? 1 : -1
  const e = env(u, 1.5, 0.15, 0.35)
  c.L.with(e).pose(SIT(z), 0.6).pose(cneck(-0.25, s * 0.9)).pose(chead(-0.3, s * 0.35, s * 0.1)).pose(ears(0.25, 0.45))
  // Golpes de cola contra el piso.
  c.L.pose(ctail(-0.3 * e, 0, 0, 0.9 * Math.sin(TAU * 3 * u) * arc(u, 0.4, 1.4)))
  if (c.at(0.1)) c.sound('mrrp')
  c.face('angry')
}

/** Está por crecer: se estira alto, tiembla de emoción y brilla. */
const catHatch: Clip = (c) => {
  const u = c.u
  const k = 0.3 + 0.7 * smooth(0, 1.3, u)
  c.glow(0.9 * smooth(0.2, 1.4, u))
  c.L.pose(root(0.04 * k * Math.abs(Math.sin(TAU * 3 * u)), 0.1 * k * Math.sin(TAU * 5 * u)))
    .j('body', { sy: 0.06 * k * Math.sin(TAU * 7 * u) + 0.12 * smooth(1.15, 1.5, u) })
    .pose(ctail(0.6 * k, 0, 0.3, 0.6 * Math.sin(TAU * 6 * u)))
    .pose(ears(-0.2 * k))
  for (const t of [0.05, 0.6, 1.1]) if (c.at(t)) c.sound('meow')
  every(c, 0.3, 1.5, 0.3, () => sparkles(c, c.u, 3))
  c.face(u < 0.8 ? 'surprised' : 'happy')
}

/** Aparece (nuevo o recién crecido): crece con rebote, pedacitos de cartón o estrellas, y maúlla. */
const catAppear: Clip = (c) => {
  const u = c.u
  const g = u < 0.55 ? backOut(u / 0.55, 2.4) - 1 : 0
  c.L.j('root', { sx: g, sy: g, sz: g })
  if (c.at(0.0001)) {
    c.sound('pop')
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.3
      const p: [number, number, number] = [Math.cos(a) * 0.22, 0.3, Math.sin(a) * 0.18 + 0.05]
      if (c.rig.young) c.emit('shell', p, { vel: [Math.cos(a) * 1.0, 1.4, Math.sin(a) * 0.7], gravity: -5, ground: true, life: 1.4, size: 0.12, spin: (i % 2 ? 1 : -1) * 6 })
      else c.emit('star', p, { vel: [Math.cos(a) * 0.8, 0.9, Math.sin(a) * 0.5], drag: 2, life: 1, size: 0.12, spin: 3 })
    }
  }
  if (c.at(0.55)) c.sound('meow')
  const z = size(c)
  c.L.pose(SIT(z), arc(u, 0.4, 1.4)).pose(mouth(arc(u, 0.55, 0.85))).pose(ears(-0.2 * arc(u, 0.4, 1.2)))
  c.face(u < 0.5 ? 'surprised' : 'happy')
}

export const CAT_CUES: Partial<Record<CueId, Clip>> = {
  feed: catFeed(true),
  eat: catFeed(false),
  play: catPlay,
  pounce: catPounce,
  clean: catClean,
  rinse: (c) => {
    shower(c, 0, 0.55)
    skip(catClean, 1.35)(c)
  },
  sleep: catSleep,
  wake: catWake,
  poke: catPoke,
  refuse: catRefuse,
  hatch: catHatch,
  appear: catAppear,
}

// ——— Bailes: la coreografía de la gallina, bailada por un gato parado en dos patas ———

/**
 * Pasa una pose de baile de la gallina (`src`, ya con su peso) al gato: se para en dos patas con
 * las patitas de adelante como brazos; las alas mueven esos brazos, los pies de la gallina las
 * patas de atrás, y el resto (cuerpo, cuello, cabeza, cola, saltos y vueltas) se copia suavizado.
 */
export function catDance(src: Map<JointName, JointMix>, L: Layer, w: number, rig: PetRig) {
  const z = zOf(rig)
  L.with(w).pose(P(cbody(-0.95, 0, 0, -0.03 * z), cneck(0.82), chead(0.04), arm(1, 1, 0.04 * z), arm(-1, 1, 0.04 * z), ctail(-0.45, 0, 0.2), ears(-0.1)))
  for (const [name, v] of src) {
    switch (name) {
      case 'root':
      case 'neck':
      case 'head':
      case 'footL':
      case 'footR':
        L.j(name, v)
        break
      case 'body':
        L.j('body', { ...v, rx: v.rx * 0.6, rz: v.rz * 0.8 })
        break
      case 'beak':
        L.pose(mouth(clamp(v.rx / 0.3, 0, 1.4)))
        break
      case 'tail':
        L.pose(ctail(v.rx * 0.6, v.ry, 0, v.ry * 0.6))
        break
      case 'wingL':
      case 'wingR': {
        const s = name === 'wingL' ? 1 : -1
        const spread = -s * v.ry
        const lift = clamp(v.rx / 1.8, -0.7, 1.2)
        const flare = s * v.rz
        L.pose(arm(s, 0, (0.05 * lift + 0.02 * Math.abs(spread)) * z, 0.09 * lift * z, (0.06 * spread + 0.03 * flare) * z, -0.5 * lift))
        break
      }
    }
  }
}

// ——— Caja ———

const BOX_HW = 0.33
/** La caja se ladea apoyada en un borde de abajo (no rueda como el huevo). */
const tilt = (a: number): Pose => {
  const e = a > 0 ? -BOX_HW : BOX_HW
  return { body: { rz: a, px: e * (1 - Math.cos(a)), py: -e * Math.sin(a) } }
}
const peekUp = (y: number, rx = 0, ry = 0, rz = 0): Pose => ({ head: { py: y, rx, ry, rz } })
const rimPaw = (s: number, py = 0, pz = 0, rx = 0): Pose => (s > 0 ? { wingL: { py, pz, rx } } : { wingR: { py, pz, rx } })
const flaps = (a: number): Pose => ({ flaps: { rx: a } })

export const BOX_IDLE: Partial<Record<IdleAct, IdleClip>> = {
  // Se asoma más, mira a los lados con las orejas paradas y vuelve a bajar.
  peek(c, it) {
    const s = flip(it)
    const u = c.u
    const up = env(u, c.dur, 0.35, 0.45)
    const look = kf(u, [[0, 0], [0.5, s], [1.2, s], [1.5, -s * 0.8], [2.0, -s * 0.8], [2.3, 0]])
    c.L.pose(peekUp(0.06 * up, -0.1 * up, 0.5 * look)).pose(ears(-0.2 * up, 0, 0.2 * look))
  },
  // Saca una patita por el borde y saluda.
  paw(c, it) {
    const s = flip(it)
    const u = c.u
    const e = env(u, c.dur, 0.3, 0.35)
    c.L.pose(rimPaw(s, 0.06 * e + 0.025 * Math.sin(TAU * 3 * u) * e, 0.03 * e, -0.5 * e)).pose(peekUp(0.02 * e, 0, 0, s * 0.18 * e))
    if (u > 0.4 && u < c.dur - 0.4) c.face('happy')
  },
  // Se esconde de golpe y vuelve a salir asomando primero las orejas.
  duck(c) {
    const u = c.u
    const down = smooth(0.1, 0.25, u) * (1 - smooth(1.1, 1.6, u))
    const pop = u > 1.35 ? 0.03 * spring(u - 1.35, 2.5, 5) : 0
    c.L.pose(peekUp(-0.16 * down + pop)).pose(ears(0.3 * down)).pose(flaps(0.25 * arc(u, 0.1, 0.5) + 0.2 * arc(u, 1.2, 1.6)))
    c.L.pose(tilt(0.03 * Math.sin(TAU * 4 * u) * arc(u, 0.15, 0.6)))
    c.face(u > 1.2 && u < 1.6 ? 'surprised' : 'normal')
  },
  // La caja se mece: el gatito se mueve adentro.
  wobble(c, it) {
    const s = flip(it)
    const a = c.u < 0.15 ? 0 : s * 0.09 * spring(c.u - 0.15, 1.3, 2.2)
    c.L.pose(tilt(a * (1 - smooth(c.dur - 0.3, c.dur, c.u)))).pose(peekUp(0, 0, 0, -a * 1.5)).pose(flaps(a * 0.8))
  },
  mew(c) {
    const u = c.u
    const o = arc(u, 0.15, 0.5)
    c.L.with(env(u, c.dur, 0.15, 0.25)).pose(peekUp(0.03, -0.25)).pose(ears(-0.2))
    c.L.pose(mouth(o * 1.1))
    if (c.at(0.15)) c.sound('mew')
  },
}

/** Respira (la cabecita sube y baja apenas) y mueve una oreja de vez en cuando. */
export function boxBreathe(L: Layer, t: number, sleep: number) {
  const s = Math.sin((TAU * t) / lerp(1.8, 3.6, sleep))
  L.pose(peekUp(0.004 * s, 0.02 * s))
  const PER = 3.3
  const n = Math.floor(t / PER)
  const d = t - (n * PER + hash(n * 17 + 3) * 2.4)
  if (d > 0 && d < 0.3) L.with(1 - sleep).pose(ear(hash(n * 5 + 2) < 0.5 ? 1 : -1, 0.4 * Math.sin((Math.PI * d) / 0.3)))
}

export function boxMood(L: Layer, sad: number, sleep: number) {
  if (sad > 0) L.with(sad).pose(peekUp(-0.04, 0.18)).pose(ears(0.45, 0.3))
  if (sleep > 0) L.with(sleep).pose(peekUp(-0.07, 0.25, 0, 0.2)).pose(ears(0.25, 0.15))
}

const boxIncubate: Clip = (c) => {
  // Mimos: sube la cabecita y la frota contra la mano, ronroneando.
  const u = c.u
  const e = env(u, 3.2, 0.4, 0.5)
  c.glow(0.45 * e)
  c.L.pose(peekUp(0.05 * e, -0.15 * e, 0.15 * Math.sin(TAU * 0.9 * u) * e, 0.3 * Math.sin(TAU * 1.2 * u) * e)).pose(ears(0.1 * e, 0.25 * e))
  if (u > 0.3) c.face('happy')
  if (c.at(0.3)) c.sound('purr')
  every(c, 0.6, 2.7, 0.7, (i) => heart(c, (i % 2 ? -1 : 1) * 0.12))
}

const boxClean: Clip = (c) => {
  // Le sacan el polvo: entrecierra los ojos, estornuda, se sacude y queda brillando.
  const u = c.u
  bubbles(c, 0.05, 1.8)
  const squint = smooth(0.1, 0.4, u) * (1 - smooth(1.7, 1.9, u))
  c.L.pose(peekUp(-0.02 * squint)).pose(ears(0.35 * squint, 0.2 * squint))
  if (u < 1.8) c.face('happy')
  const sneeze = arc(u, 1.85, 2.05)
  c.L.pose(peekUp(0.03 * sneeze, 0.35 * sneeze)).pose(mouth(0.8 * sneeze))
  if (c.at(1.9)) c.sound('mew')
  const s = shakeAt(u, 2.1, 2.8)
  c.L.pose(peekUp(0, 0, 0.5 * s, 0.25 * s)).pose(ears(0, 0.5 * Math.abs(s))).pose(tilt(0.03 * s)).pose(flaps(0.3 * s))
  drops(c, 2.15, 2.7)
  if (u > 2.1 && u < 2.8) c.face('dizzy')
  sparkles(c, 2.95, 6)
  if (u > 2.85) c.face('happy')
}

const boxPoke: Clip = (c) => {
  const u = c.u
  const down = smooth(0, 0.08, u) * (1 - smooth(0.55, 0.85, u))
  c.L.pose(peekUp(-0.15 * down + (u > 0.8 ? 0.025 * spring(u - 0.8, 2.5, 5) : 0))).pose(ears(0.4 * down)).pose(root(0.04 * arc(u, 0.02, 0.25))).pose(flaps(0.3 * arc(u, 0, 0.3)))
  if (c.at(0.02)) c.sound('knock')
  if (c.at(0.85)) c.sound('mew')
  c.face(u < 0.85 ? 'surprised' : 'happy')
  if (c.at(0.95)) heart(c)
}

const boxRefuse: Clip = (c) => {
  const u = c.u
  const e = env(u, 1.5, 0.12, 0.35)
  c.L.pose(peekUp(-0.02 * e, -0.15 * e, 0.8 * e)).pose(ears(0.35 * e, 0.4 * e)).pose(tilt(0.03 * Math.sin(TAU * 2.6 * u) * e))
  c.face('angry')
}

const boxHatch: Clip = (c) => {
  // Cada vez más fuerte: la caja salta, las tapas aletean y el gatito empuja para salir.
  const u = c.u
  const k = 0.3 + 0.7 * smooth(0, 1.3, u)
  c.L.pose(tilt(0.08 * k * Math.sin(TAU * 6 * u))).pose(root(0.04 * k * Math.abs(Math.sin(TAU * 3 * u)))).pose(flaps(0.5 * k * Math.sin(TAU * 8 * u) + 0.4 * smooth(1.1, 1.5, u)))
  c.L.pose(peekUp(0.05 * k + 0.08 * smooth(1.2, 1.5, u), -0.2 * k)).pose(ears(-0.25 * k))
  for (const t of [0.1, 0.45, 0.75, 1.0, 1.2, 1.38]) if (c.at(t)) c.sound(t > 1.1 ? 'mew' : 'knock')
  every(c, 0.6, 1.5, 0.3, () => sparkles(c, c.u, 2))
  c.face(u < 1.1 ? 'surprised' : 'happy')
}

export const BOX_CUES: Partial<Record<CueId, Clip>> = {
  incubate: boxIncubate,
  clean: boxClean,
  rinse: (c) => {
    shower(c, 0, 0.6)
    skip(boxClean, 1.6)(c)
  },
  poke: boxPoke,
  refuse: boxRefuse,
  hatch: boxHatch,
}

/** Mientras le sacan el polvo con la esponja: cierra los ojos contento y ronronea. */
export function boxScrub(L: Layer, t: number) {
  L.pose(peekUp(0.015, -0.1, 0, 0.12 * Math.sin(TAU * 1.2 * t))).pose(ears(0.15, 0.2))
}
