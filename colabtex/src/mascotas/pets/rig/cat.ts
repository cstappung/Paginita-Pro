import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Coat } from '../../game/types'
import { Face } from './face'
import { furColors, paintFlank, paintHead, paintTail, type FurColors } from './fur'
import { HEN } from './hen'
import { RigBuilder, canvasTexture, cylinder, joint, lathe, sphere, toon, type V3 } from './kit'
import { blend, ellipsoid, normalAt, smin, spotOn, starMesh, surfaceAlong, type SDF } from './sdf'
import type { JointMix, JointName, PetRig, TorsoSpec } from './types'

// Gatos tiernos en tres etapas: la caja (con el gatito asomado), el gatito y el gato. El cuerpo es
// una sola pieza blanda (pecho, lomo, ancas y cuello fundidos) y la cabeza también (cráneo,
// cachetes y hocico), así no se ven armados por partes. Patitas cortas y gorditas que se estiran
// entre el cuerpo y el piso, orejas grandes que se mueven, ojos de pupila grande, nariz y boca "ω",
// y una cola en cuatro tramos que se curva. Tienen su propia familia de animaciones (anim/cat.ts).
// Los colores salen de la genética del pelaje (fur.ts).

/** Gato atigrado naranjo con pechera (para los que no traen genes). */
export const CLASSIC_COAT: Coat = { brown: 0.05, dilute: 0.1, orange: 1, tabby: 0.75, stripe: 0.2, white: 0.2, point: 0, eye: 0.6, seed: 7 }

// Las coreografías de baile (escritas para la gallina) cacarean: el gato maúlla.
const SWAP_CAT: PetRig['swap'] = { sound: { cluck: 'meow', peep: 'meow' }, fx: { grain: 'kibble', shell: 'card' } }
const SWAP_KITTEN: PetRig['swap'] = { sound: { cluck: 'mew', peep: 'mew', meow: 'mew' }, fx: { grain: 'kibble', shell: 'card' } }

const v3 = (p: THREE.Vector3): V3 => [p.x, p.y, p.z]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// ---------- Proporciones ----------

type Blob = [center: V3, radii: V3]

interface HeadShape {
  c: V3
  cranium: Blob
  /** Cachete del lado +x (el otro en espejo). */
  cheek: Blob
  /** Bolita del hocico del lado +x. */
  muzzle: Blob
  chin: Blob
  ear: { az: number; el: number; size: V3 }
  eye: { az: number; el: number; size: number; pupil: number }
}

interface CatShape {
  /** Piezas del cuerpo (se funden): torso, pecho, cuello y el anca del lado +x. */
  torso: Blob
  chest: Blob
  neckBlob: Blob
  haunch: Blob
  k: number
  /** Centro del cuerpo (desde donde se proyecta la malla y se calza la ropa). */
  center: V3
  head: HeadShape
  /** Pivote del cuerpo (las caderas), del cuello. */
  hip: V3
  neck: V3
  /** Lado +x: hombro y pata de adelante en el piso; cadera y pie de atrás en el piso. */
  shoulder: V3
  paw: V3
  hindHip: V3
  foot: V3
  legR: number
  pawSize: V3
  tail: { base: V3; dirs: V3[]; len: number[]; r: [number, number] }
  hat: number
  shoe: { k: number; ref: V3 }
  height: number
  peck: V3
}

const CAT: CatShape = {
  torso: [[0, 0.26, -0.04], [0.15, 0.13, 0.235]],
  chest: [[0, 0.28, 0.11], [0.14, 0.14, 0.12]],
  neckBlob: [[0, 0.36, 0.15], [0.105, 0.1, 0.095]],
  haunch: [[0.08, 0.235, -0.15], [0.1, 0.12, 0.115]],
  k: 0.06,
  center: [0, 0.27, -0.02],
  head: {
    c: [0, 0.52, 0.19],
    cranium: [[0, 0.01, 0], [0.18, 0.155, 0.16]],
    cheek: [[0.085, -0.05, 0.04], [0.105, 0.09, 0.1]],
    muzzle: [[0.031, -0.062, 0.132], [0.048, 0.04, 0.04]],
    chin: [[0, -0.092, 0.1], [0.05, 0.035, 0.045]],
    ear: { az: 0.66, el: 0.62, size: [0.085, 0.15, 0.05] },
    eye: { az: 0.43, el: 0.04, size: 0.056, pupil: 0.25 },
  },
  hip: [0, 0.2, -0.15],
  neck: [0, 0.36, 0.15],
  shoulder: [0.065, 0.22, 0.13],
  paw: [0.07, 0, 0.15],
  hindHip: [0.085, 0.2, -0.15],
  foot: [0.085, 0, -0.14],
  legR: 0.047,
  pawSize: [0.056, 0.038, 0.066],
  tail: { base: [0, 0.29, -0.25], dirs: [[0, 0.35, -1], [0, 1, -0.55], [0, 1, 0.05], [0, 0.7, 0.6]], len: [0.11, 0.1, 0.09, 0.07], r: [0.045, 0.032] },
  hat: 0.18,
  shoe: { k: 0.8, ref: [HEN.feet.x, 0, HEN.feet.z] },
  height: 0.8,
  peck: [0, 0, 0.42],
}

const KITTEN: CatShape = {
  torso: [[0, 0.19, -0.03], [0.11, 0.1, 0.165]],
  chest: [[0, 0.2, 0.07], [0.1, 0.1, 0.09]],
  neckBlob: [[0, 0.27, 0.1], [0.08, 0.075, 0.07]],
  haunch: [[0.06, 0.17, -0.1], [0.075, 0.09, 0.085]],
  k: 0.045,
  center: [0, 0.2, -0.01],
  head: {
    c: [0, 0.41, 0.13],
    cranium: [[0, 0.01, 0], [0.17, 0.15, 0.155]],
    cheek: [[0.08, -0.05, 0.035], [0.1, 0.085, 0.095]],
    muzzle: [[0.028, -0.06, 0.124], [0.042, 0.035, 0.035]],
    chin: [[0, -0.086, 0.092], [0.045, 0.03, 0.04]],
    ear: { az: 0.66, el: 0.62, size: [0.082, 0.145, 0.048] },
    eye: { az: 0.42, el: 0.03, size: 0.062, pupil: 0.29 },
  },
  hip: [0, 0.15, -0.1],
  neck: [0, 0.27, 0.1],
  shoulder: [0.05, 0.16, 0.08],
  paw: [0.052, 0, 0.095],
  hindHip: [0.06, 0.15, -0.1],
  foot: [0.062, 0, -0.095],
  legR: 0.036,
  pawSize: [0.044, 0.03, 0.052],
  tail: { base: [0, 0.2, -0.17], dirs: [[0, 0.6, -1], [0, 1, -0.3], [0, 1, 0.2], [0, 0.6, 0.6]], len: [0.07, 0.065, 0.06, 0.05], r: [0.033, 0.025] },
  hat: 0.17,
  shoe: { k: 0.5, ref: [0.14, 0, 0.17] },
  height: 0.62,
  peck: [0, 0, 0.3],
}

const mirror = ([c, r]: Blob): Blob => [[-c[0], c[1], c[2]], r]
const blob = ([c, r]: Blob, at: V3 = [0, 0, 0]) => ellipsoid(add(at, c), r)

function bodySDF(S: CatShape): SDF {
  return blend(S.k, blob(S.torso), blob(S.chest), blob(S.neckBlob), blob(S.haunch), blob(mirror(S.haunch)))
}

function headSDF(H: HeadShape): SDF {
  const skull = blend(0.05, blob(H.cranium, H.c), blob(H.cheek, H.c), blob(mirror(H.cheek), H.c))
  const snout = blend(0.02, blob(H.muzzle, H.c), blob(mirror(H.muzzle), H.c), blob(H.chin, H.c))
  return (x, y, z) => smin(skull(x, y, z), snout(x, y, z), 0.03)
}

// ---------- Materiales ----------

/** Pelaje: cuerpo, cabeza y cola pintados; patas, orejas, nariz y bigotes lisos. */
function furMats(c: Coat, f: FurColors) {
  return {
    body: toon('#ffffff', canvasTexture(512, 512, (g, w, h) => paintFlank(g, w, h, c, f))),
    head: toon('#ffffff', canvasTexture(512, 256, (g, w, h) => paintHead(g, w, h, c, f, true))),
    tail: toon('#ffffff', canvasTexture(512, 64, (g, w, h) => paintTail(g, w, h, c, f))),
    leg: toon(c.white > 0.35 ? f.white : f.point),
    paw: toon(c.white > 0.12 ? f.white : f.point),
    ear: toon(f.point01 ? f.point : c.orange > 0.5 && c.orange < 0.85 ? f.orange : c.white > 0.85 ? f.base : f.point),
    inner: toon(f.innerEar),
    nose: toon(f.nose),
    mouth: toon('#5a2a2a'),
    tongue: toon('#ff8fa3'),
    whisker: toon(f.white01 > 0.3 || !f.point01 ? '#fffaf0' : '#5a4636'),
  }
}
type FurMats = ReturnType<typeof furMats>

// ---------- Piezas ----------

/** Esfera con el frente (+z) en u = 0,5 (como espera `paintHead`). */
const frontSphere = (w = 64, h = 44) => new THREE.SphereGeometry(1, w, h, -Math.PI / 2)
/** Esfera con los polos en el pecho y el anca (como espera `paintFlank`). */
const lengthSphere = (w = 64, h = 48) => new THREE.SphereGeometry(1, w, h, Math.PI / 2).rotateX(Math.PI / 2)

/** Oreja: cono de punta redondeada, aplanado (un poco cóncavo adelante, donde va el rosado). */
const EAR_PROFILE: [number, number][] = [[0, -0.05], [1, 0], [0.82, 0.32], [0.48, 0.7], [0.16, 0.95], [0, 1]]

/** Tramo de cola: tubo que se afina con las puntas redondeadas. UV: u a lo largo (de u0 a u1). */
function tailSegment(len: number, r0: number, r1: number, u0: number, u1: number) {
  const g = lathe([[0, -r0], [r0 * 0.72, -r0 * 0.7], [r0, 0], [lerp(r0, r1, 0.5) * 1.03, len * 0.5], [r1, len], [r1 * 0.72, len + r1 * 0.7], [0, len + r1]], { segments: 20, samples: 24 })
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getY(i)), uv.getX(i))
  return g
}

interface HeadParts {
  earJ: THREE.Object3D[]
  face: Face
  mouth: THREE.Object3D
}

/**
 * Cabeza de gato (cráneo con cachetes y hocico, orejas, ojos, nariz, boca y bigotes) colgada de
 * `head`. Las orejas van en sus propias articulaciones (se mueven) y la boca abierta en `mouthJ`.
 */
function buildHead(b: RigBuilder, head: THREE.Object3D, H: HeadShape, m: FurMats, f: FurColors, kitten: boolean): HeadParts {
  const f0 = headSDF(H)
  const R = 0.45
  b.add(head, starMesh(f0, H.c, R, frontSphere()), m.head)
  const dir = (az: number, el: number) => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  const spot = (az: number, el: number) => spotOn(f0, H.c, R, dir(az, el))

  // Orejas: hundidas en la cabeza, paradas y un poco abiertas hacia afuera.
  const earJ: THREE.Object3D[] = []
  const ear = lathe(EAR_PROFILE, { segments: 28, samples: 20 })
  const [ew, eh, ed] = H.ear.size
  for (const s of [1, -1]) {
    const { pos, normal } = spot(s * H.ear.az, H.ear.el)
    const up = normal.clone().lerp(new THREE.Vector3(0, 1, 0), 0.45).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -s * 0.2, 0)))
    const e = new THREE.Euler().setFromQuaternion(q)
    const base = pos.clone().addScaledVector(normal, -eh * 0.22)
    const j = joint(s > 0 ? 'earL' : 'earR', head, v3(base))
    b.add(j, ear, m.ear, { pos: v3(base), rot: [e.x, e.y, e.z], scale: [ew, eh, ed] })
    const inner = base.clone().add(new THREE.Vector3(0, eh * 0.14, ed * 0.6).applyQuaternion(q))
    b.add(j, ear, m.inner, { pos: v3(inner), rot: [e.x, e.y, e.z], scale: [ew * 0.55, eh * 0.66, ed * 0.4], outline: 0 })
    earJ.push(j)
  }

  // Nariz: triangulito rosado sobre el hocico.
  const nose = spot(0, -0.27)
  const nq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nose.normal)
  const ne = new THREE.Euler().setFromQuaternion(nq)
  const ns = H.cranium[1][0] / 0.18
  b.add(head, sphere(1, 18, 12), m.nose, { pos: v3(nose.pos.clone().addScaledVector(nose.normal, 0.004)), rot: [ne.x, ne.y, ne.z], scale: [0.024 * ns, 0.016 * ns, 0.014 * ns], outline: 0.5 })

  // Boca "ω": dos arquitos bajo la nariz, pegados a la cara.
  const onFace = (az: number, el: number, off = 0.002) => {
    const p = spot(az, el)
    return p.pos.addScaledVector(p.normal, off)
  }
  for (const s of [1, -1]) {
    const pts = [onFace(0, -0.33), onFace(s * 0.07, -0.39), onFace(s * 0.15, -0.35)]
    b.add(head, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.006 * ns, 6), m.mouth, { outline: 0 })
  }
  // Boca abierta (maullar, bostezar): escondida dentro del hocico; se asoma al adelantarla.
  const mp = onFace(0, -0.42, 0)
  const mn = normalAt(f0, mp)
  const mouthJ = joint('beak', head, v3(mp))
  b.add(mouthJ, sphere(1, 18, 12), m.mouth, { pos: v3(mp.clone().addScaledVector(mn, -0.045)), scale: [0.03 * ns, 0.026 * ns, 0.022 * ns], outline: 0.5 })
  b.add(mouthJ, sphere(1, 14, 10), m.tongue, { pos: v3(mp.clone().addScaledVector(mn, -0.031).add(new THREE.Vector3(0, -0.012 * ns, 0))), scale: [0.018 * ns, 0.009 * ns, 0.016 * ns], outline: 0 })

  // Bigotes: tres por lado, desde los cachetes del hocico.
  for (const s of [1, -1])
    for (let i = 0; i < 3; i++) {
      const from = onFace(s * 0.32, -0.3 - i * 0.05, -0.004)
      const to = from.clone().add(new THREE.Vector3(s * 0.14 * ns, (0.025 - i * 0.025) * ns, -0.03 * ns))
      const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.008 * ns, 0.01 * ns))
      b.add(head, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 8, 0.0028 * ns, 5), m.whisker, { outline: 0 })
    }

  const E = H.eye
  const eyes = ([1, -1] as const).map((s) => spot(s * E.az, E.el)) as [ReturnType<typeof spot>, ReturnType<typeof spot>]
  const blush = ([1, -1] as const).map((s) => spot(s * 0.7, -0.24)) as typeof eyes
  const face = new Face({ eyes, eyeSize: E.size, blush, blushSize: E.size * 0.85, facing: 0.5, iris: f.eye, pupil: E.pupil, aspect: kitten ? 1.1 : 1.06 })
  return { earJ, face, mouth: mouthJ }
}

// ---------- Patas apoyadas ----------

const ZERO = (): JointMix => ({ px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0 })

/**
 * Patas de adelante del gato: cuelgan del cuerpo, pero `pawL/pawR` se escriben en el espacio de la
 * raíz (apoyadas en el piso aunque el cuerpo se incline, se siente o se agache) y `armL/armR` las
 * llevan como brazos, en el espacio del cuerpo (`sx` = cuánto siguen al cuerpo).
 */
function pawSolver(S: CatShape) {
  const B0 = new THREE.Vector3(...S.hip)
  const e = new THREE.Euler(0, 0, 0, 'YXZ')
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const rest = [new THREE.Vector3(...S.paw), new THREE.Vector3(-S.paw[0], S.paw[1], S.paw[2])]
  return (mix: Map<JointName, JointMix>) => {
    const b = mix.get('body') ?? ZERO()
    e.set(b.rx, b.ry, b.rz)
    q.setFromEuler(e).invert()
    ;(['pawL', 'pawR'] as const).forEach((name, i) => {
      let p = mix.get(name)
      if (!p) mix.set(name, (p = ZERO()))
      const a = mix.get(i ? 'armR' : 'armL')
      const follow = Math.min(1, Math.max(0, a?.sx ?? 0))
      // Dónde tiene que quedar (espacio de la raíz) y eso en el espacio del cuerpo.
      v.set(rest[i].x + p.px, rest[i].y + p.py, rest[i].z + p.pz).sub(B0).sub(new THREE.Vector3(b.px, b.py, b.pz)).applyQuaternion(q)
      v.set(v.x / (1 + b.sx), v.y / (1 + b.sy), v.z / (1 + b.sz))
      const local = rest[i].clone().sub(B0)
      // Apoyada: offset hasta el punto del piso; brazo: sigue al cuerpo desde su lugar de reposo.
      p.px = (v.x - local.x) * (1 - follow) + (a?.px ?? 0)
      p.py = (v.y - local.y) * (1 - follow) + (a?.py ?? 0)
      p.pz = (v.z - local.z) * (1 - follow) + (a?.pz ?? 0)
      // La planta queda paralela al piso mientras está apoyada.
      p.rx += -b.rx * (1 - follow) + (a?.rx ?? 0)
      p.rz += -b.rz * (1 - follow) + (a?.rz ?? 0)
    })
  }
}

// ---------- Gato (adulto y gatito) ----------

function buildFeline(coat: Coat, S: CatShape, kitten: boolean): PetRig {
  const f = furColors(coat, kitten)
  const m = furMats(coat, f)
  const side = (i: number) => (i % 2 ? -1 : 1)
  const mx = (p: V3, i: number): V3 => [side(i) * p[0], p[1], p[2]]

  const root = joint('root', null, [0, 0, 0])
  const body = joint('body', root, S.hip)
  const neck = joint('neck', body, S.neck)
  const head = joint('head', neck, S.head.c)
  const hatSocket = joint('hat', head, add(S.head.c, [0, 0.01, -0.01]))
  const outfit = joint('outfit', body, [0, 0, 0])
  const paws = [0, 1].map((i) => joint(i ? 'pawR' : 'pawL', body, mx(S.paw, i)))
  const feet = [0, 1].map((i) => joint(i ? 'footR' : 'footL', root, mx(S.foot, i)))
  const toes = [...feet, ...paws].map((p, i) => joint(`toes${i}`, p, mx(i < 2 ? S.foot : S.paw, i)))
  const shoulders = [0, 1].map((i) => joint('shoulder', body, mx(S.shoulder, i)))
  const hips = [0, 1].map((i) => joint('hip', body, mx(S.hindHip, i)))
  const ankleUp = S.pawSize[1] * 1.1
  const frontAnkles = paws.map((p, i) => joint('ankle', p, add(mx(S.paw, i), [0, ankleUp, 0])))
  const hindAnkles = feet.map((p, i) => joint('ankle', p, add(mx(S.foot, i), [0, ankleUp, 0])))
  const shins = [0, 1, 2, 3].map((i) => joint(`shin${i}`, root, [0, 0, 0]))
  const sleeves = [0, 1].map((i) => joint(i ? 'sleeveR' : 'sleeveL', root, mx(S.shoulder, i)))
  // Calzado: un enchufe por pata que hace de pie de gallina (o de pollito para las botas), achicado.
  const shoe = (parent: THREE.Object3D, i: number, p: V3) => {
    const j = joint(`shoe${i}`, parent, [p[0], 0, p[2] - S.pawSize[2] * 0.3])
    j.scale.setScalar(S.shoe.k)
    j.userData.restAs = new THREE.Matrix4().makeTranslation(side(i) * S.shoe.ref[0], 0, S.shoe.ref[2])
    return j
  }
  const shoes = [shoe(feet[0], 0, mx(S.foot, 0)), shoe(feet[1], 1, mx(S.foot, 1)), shoe(paws[0], 2, mx(S.paw, 0)), shoe(paws[1], 3, mx(S.paw, 1))]

  const b = new RigBuilder(root)
  const fBody = bodySDF(S)
  b.add(body, starMesh(fBody, S.center, 0.6, lengthSphere()), m.body)
  const hp = buildHead(b, head, S.head, m, f, kitten)

  // Patitas: cilindros gorditos que se estiran entre el cuerpo y la patita, y la patita (un poroto).
  for (const s of shins) b.add(s, cylinder(S.legR, S.legR * 1.04, 1, 18).translate(0, 0.5, 0), m.leg, { outline: 0.8 })
  toes.forEach((t, i) => {
    const p = mx(i < 2 ? S.foot : S.paw, i)
    b.add(t, sphere(1, 22, 14), m.paw, { pos: [p[0], S.pawSize[1] * 0.9, p[2] + S.pawSize[2] * 0.2], scale: S.pawSize })
  })
  const hand = joint('hand', paws[1], add(mx(S.paw, 1), [0, S.pawSize[1], S.pawSize[2]]))

  // Cola: cuatro tramos encadenados (se curva y se mueve de a poco hasta la punta).
  const T = S.tail
  const total = T.len.reduce((a, x) => a + x, 0)
  const tails: THREE.Object3D[] = []
  let at = new THREE.Vector3(...T.base)
  let parent: THREE.Object3D = body
  let acc = 0
  T.dirs.forEach((d, i) => {
    const j = joint(i ? `tail${i + 1}` : 'tail', parent, v3(at))
    const dir = new THREE.Vector3(...d).normalize()
    const r0 = lerp(T.r[0], T.r[1], acc / total)
    const r1 = lerp(T.r[0], T.r[1], (acc + T.len[i]) / total)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const e = new THREE.Euler().setFromQuaternion(q)
    b.add(j, tailSegment(T.len[i], r0, r1, acc / total, (acc + T.len[i]) / total), m.tail, { pos: v3(at), rot: [e.x, e.y, e.z], outline: i ? 0.9 : 1 })
    acc += T.len[i]
    at = at.clone().addScaledVector(dir, T.len[i])
    tails.push(j)
    parent = j
  })
  b.finish()

  root.updateMatrixWorld(true)
  hp.face.group.applyMatrix4(head.matrixWorld.clone().invert())
  head.add(hp.face.group)

  // Torso para la ropa: la misma superficie del cuerpo, con el polo del escote hacia el cuello.
  const torso: TorsoSpec = {
    center: S.center,
    rx: S.torso[1][0],
    up: S.torso[1][1],
    down: S.torso[1][1],
    front: S.torso[1][2],
    back: S.torso[1][2],
    taper: 0,
    lift: 0,
    breast: 0,
    hackle: { dir: [0, 0.62, 0.78], cos: 0.7, lift: [0, 0, 0] },
  }
  const legLen = S.shoulder[1] - ankleUp
  return {
    kind: 'cat',
    young: kitten,
    root,
    joints: {
      root,
      body,
      neck,
      head,
      beak: hp.mouth,
      earL: hp.earJ[0],
      earR: hp.earJ[1],
      tail: tails[0],
      tail2: tails[1],
      tail3: tails[2],
      tail4: tails[3],
      pawL: paws[0],
      pawR: paws[1],
      footL: feet[0],
      footR: feet[1],
    },
    face: hp.face,
    materials: Object.values(m),
    legs: [
      { hip: hips[0], ankle: hindAnkles[0], shin: shins[0] },
      { hip: hips[1], ankle: hindAnkles[1], shin: shins[1] },
      { hip: shoulders[0], ankle: frontAnkles[0], shin: shins[2], sleeve: sleeves[0] },
      { hip: shoulders[1], ankle: frontAnkles[1], shin: shins[3], sleeve: sleeves[1] },
    ],
    sockets: { hat: { obj: hatSocket, radius: S.hat }, feet: shoes, outfit: kitten ? undefined : outfit, wings: sleeves, hand },
    hideWithHat: hp.earJ,
    toes,
    height: S.height,
    peckTarget: S.peck,
    swap: kitten ? SWAP_KITTEN : SWAP_CAT,
    torso,
    torsoPoint: (d) => surfaceAlong(fBody, S.center, d.clone().normalize(), 0.6),
    shoeK: S.shoe.k,
    // Mangas: funda sobre la pata (cilindro de radio legR), que cuelga recta del hombro.
    arm: { base: S.shoulder, rx: Math.PI, rz: 0, sx: (S.legR + 0.004) / 0.32, sy: legLen, sz: (S.legR + 0.004) / 0.33 },
    solve: pawSolver(S),
  }
}

/** Gato adulto. */
export const buildCat = (coat: Coat = CLASSIC_COAT) => buildFeline(coat, CAT, false)

/** Gatito: cabezón, patitas cortas y cola chica. */
export const buildKitten = (coat: Coat = CLASSIC_COAT) => buildFeline(coat, KITTEN, true)

// ---------- Caja (con el gatito asomado) ----------

const BOX = { w: 0.66, h: 0.5, d: 0.58 }

function cardboard() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#c99257'
    g.fillRect(0, 0, w, h)
    // Fibras y bordes más oscuros.
    g.strokeStyle = 'rgba(120,72,30,0.18)'
    g.lineWidth = 2
    for (let y = 8; y < h; y += 11) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y + 3)
      g.stroke()
    }
    g.strokeStyle = 'rgba(110,64,26,0.45)'
    g.lineWidth = 10
    g.strokeRect(5, 5, w - 10, h - 10)
    // Huellita con corazón al centro.
    g.fillStyle = '#7a4a24'
    g.beginPath()
    g.ellipse(w * 0.5, h * 0.58, 30, 25, 0, 0, Math.PI * 2)
    g.fill()
    for (const [x, y] of [
      [-34, -30],
      [-12, -46],
      [12, -46],
      [34, -30],
    ]) {
      g.beginPath()
      g.ellipse(w * 0.5 + x, h * 0.58 + y, 11, 13, x * 0.01, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#ff8fa3'
    g.beginPath()
    const cx = w * 0.5
    const cy = h * 0.6
    g.moveTo(cx, cy + 12)
    g.bezierCurveTo(cx - 18, cy, cx - 12, cy - 16, cx, cy - 6)
    g.bezierCurveTo(cx + 12, cy - 16, cx + 18, cy, cx, cy + 12)
    g.fill()
    // Cinta adhesiva.
    g.fillStyle = 'rgba(240,214,160,0.85)'
    g.fillRect(w * 0.42, 0, w * 0.16, h * 0.16)
  })
}

/** La cabeza del gatito dentro de la caja (algo más chica que la del gatito suelto). */
const BOX_HEAD: HeadShape = {
  ...KITTEN.head,
  c: [0, 0.6, 0.02],
  ear: { ...KITTEN.head.ear, size: [0.075, 0.13, 0.044] },
  eye: { ...KITTEN.head.eye, size: 0.058 },
}

export function buildBox(coat: Coat = CLASSIC_COAT): PetRig {
  const f = furColors(coat, true)
  const m = furMats(coat, f)
  const card = toon('#ffffff', cardboard())
  const flapMat = toon('#c08a50')
  const root = joint('root', null, [0, 0, 0])
  const body = joint('body', root, [0, 0, 0])
  // El gatito sube un poco a medida que se acerca a salir (`peek`); `head` lo anima.
  const peek = joint('peek', body, [0, 0, 0])
  const head = joint('head', peek, [0, BOX.h - 0.02, 0.02])
  const hatSocket = joint('hat', head, add(BOX_HEAD.c, [0, 0.01, -0.01]))
  // Patitas agarradas del borde (se asoman, saludan).
  const rim = [1, -1].map((s) => joint(s > 0 ? 'wingL' : 'wingR', peek, [s * 0.12, BOX.h + 0.02, BOX.d / 2 - 0.03]))
  const flaps = [0, 1, 2, 3].map((i) => {
    const yaw = (i * Math.PI) / 2
    const half = i % 2 ? BOX.w / 2 : BOX.d / 2
    const j = joint(`flap${i}`, body, [Math.sin(yaw) * half, BOX.h, Math.cos(yaw) * half])
    j.rotation.y = yaw
    return j
  })

  const b = new RigBuilder(root)
  b.add(body, new RoundedBoxGeometry(BOX.w, BOX.h, BOX.d, 3, 0.04), card, { pos: [0, BOX.h / 2, 0] })
  flaps.forEach((j, i) => {
    const len = i % 2 ? BOX.d * 0.42 : BOX.w * 0.4
    const wide = i % 2 ? BOX.d - 0.04 : BOX.w - 0.04
    j.updateMatrixWorld(true)
    const p = new THREE.Vector3(0, 0, len / 2).applyMatrix4(j.matrixWorld)
    b.add(j, new THREE.BoxGeometry(i % 2 ? len : wide, 0.014, i % 2 ? wide : len), flapMat, { pos: v3(p) })
  })
  const hp = buildHead(b, head, BOX_HEAD, m, f, true)
  rim.forEach((r, i) => {
    const s = i ? -1 : 1
    b.add(r, sphere(1, 18, 12), m.paw, { pos: [s * 0.12, BOX.h + 0.025, BOX.d / 2 - 0.02], scale: [0.05, 0.034, 0.055] })
  })
  b.finish()
  root.updateMatrixWorld(true)
  hp.face.group.applyMatrix4(head.matrixWorld.clone().invert())
  head.add(hp.face.group)

  // Tapas: el avance (0–1) las va abriendo; las animaciones les suman un aleteo (`flaps`).
  const base = [0, 0, 0, 0]
  const open = (p: number) => {
    // Al principio casi cerradas (solo asoman orejas y ojos); al final, abiertas del todo. La de
    // adelante ya está abierta (se ve la carita) y la de atrás queda parada como respaldo.
    base.splice(0, 4, lerp(0.55, 0.95, p), lerp(-0.95, 0.85, p), lerp(-1.35, 0.2, p), lerp(-0.95, 0.85, p))
    for (const [i, j] of flaps.entries()) j.rotation.x = base[i]
    peek.position.y = lerp(-0.02, 0.05, p)
  }
  open(0)
  return {
    kind: 'box',
    young: true,
    root,
    joints: { root, body, head, beak: hp.mouth, earL: hp.earJ[0], earR: hp.earJ[1], wingL: rim[0], wingR: rim[1] },
    face: hp.face,
    materials: [card, flapMat, ...Object.values(m)],
    legs: [],
    sockets: { hat: { obj: hatSocket, radius: BOX_HEAD.cranium[1][0] }, feet: [], wings: [] },
    hideWithHat: hp.earJ,
    toes: [],
    height: 0.82,
    peckTarget: [0, 0, 0.45],
    swap: SWAP_KITTEN,
    setProgress: open,
    solve(mix) {
      const fl = mix.get('flaps')?.rx ?? 0
      flaps.forEach((j, i) => (j.rotation.x = base[i] + fl * (i === 2 ? 0.4 : i === 0 ? -0.6 : 1) * (1 + 0.15 * i)))
    },
  }
}
