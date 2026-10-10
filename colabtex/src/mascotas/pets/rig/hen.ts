import * as THREE from 'three'
import { Face } from './face'
import {
  RigBuilder,
  canvasTexture,
  capsule,
  cylinder,
  joint,
  lathe,
  rng,
  sphere,
  spotOnEllipsoid,
  teardrop,
  toon,
  type V3,
} from './kit'
import type { PetRig, TorsoSpec } from './types'
import { smoothNormals } from '../../scene/toon'

// Gallina adulta kawaii: cuerpo de pera, cabeza grande, cresta de tres lóbulos, alitas de gota,
// cola en abanico y patitas cortas con dedos. Todo en espacio del modelo (alto ≈ 1).

export const HEN = {
  colors: {
    body: '#f0a046',
    chest: '#ffe0a8',
    feather: '#d9802f',
    wing: '#e48a35',
    wingTip: '#c46a24',
    tail: '#b9581f',
    tailLight: '#d97a2c',
    comb: '#ec4b45',
    beak: '#ffbe3b',
    leg: '#f7a43c',
  },
  /**
   * Torso con forma de bote, como el de una gallina de verdad: pechuga llena y redonda adelante,
   * lomo que sube y se angosta hacia la cola. Es una esfera deformada (ver `henBodyPoint`).
   */
  torso: {
    center: [0, 0.37, -0.03] as V3,
    /** Medio ancho, medio alto hacia arriba / hacia abajo, largo hacia adelante / hacia atrás. */
    rx: 0.27,
    up: 0.2,
    down: 0.225,
    front: 0.29,
    back: 0.4,
    /** Cuánto se angosta (0–1) y cuánto sube la parte de atrás. */
    taper: 0.45,
    lift: 0.15,
    /** Abultamiento de la pechuga (abajo y adelante). */
    breast: 0.05,
    /**
     * Esclavina: el torso sube hacia la cabeza en una joroba suave (dirección `dir`, apertura `cos`),
     * así el pecho fluye hacia el cuello sin bordes, como el plumaje de una gallina de verdad.
     */
    hackle: { dir: [0, 0.78, 0.63] as V3, cos: 0.55, lift: [0, 0.11, 0.045] as V3 },
  },
  /** Cuello corto y grueso: nace ancho en la pechuga y se funde con la cabeza. */
  neck: { base: [0, 0.45, 0.11] as V3, top: [0, 0.665, 0.2] as V3 },
  head: { center: [0, 0.7, 0.215] as V3, radii: [0.142, 0.134, 0.14] as V3 },
  /** Cadera (pivote del torso). */
  hip: [0, 0.25, -0.01] as V3,
  feet: { x: 0.1, z: 0.03 },
}

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Punto del torso para una dirección unitaria `d` desde su centro (espacio del modelo).
 * La ropa usa la misma función, inflada, para calzar justo.
 */
export function henBodyPoint(d: THREE.Vector3, out = new THREE.Vector3()) {
  return bodyPoint(HEN.torso, d, out)
}

/** Punto de un torso cualquiera de la misma familia (la gallina, el gato). */
export function bodyPoint(B: TorsoSpec, d: THREE.Vector3, out = new THREE.Vector3()) {
  const back = Math.max(0, -d.z)
  const front = Math.max(0, d.z)
  const taper = 1 - B.taper * back * back
  const x = d.x * B.rx * taper
  const y = (d.y > 0 ? d.y * B.up : d.y * B.down) * taper + B.lift * back * back
  const z = (d.z > 0 ? d.z * B.front : d.z * B.back) + B.breast * front * sstep(0.35, -0.45, d.y)
  const H = B.hackle
  const k = sstep(H.cos, 1, (d.x * H.dir[0] + d.y * H.dir[1] + d.z * H.dir[2]) / Math.hypot(...H.dir)) ** 1.2
  return out.set(B.center[0] + x + H.lift[0] * k, B.center[1] + y + H.lift[1] * k, B.center[2] + z + H.lift[2] * k)
}

/** Esfera deformada con la forma del torso (UV de esfera: u = 0,5 al frente). `inflate` la agranda hacia afuera. */
export function henBodyGeometry(inflate = 0, w = 64, h = 44, B: TorsoSpec = HEN.torso) {
  const g = new THREE.SphereGeometry(1, w, h, -Math.PI / 2)
  const pos = g.getAttribute('position')
  const d = new THREE.Vector3()
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize()
    bodyPoint(B, d, p)
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  smoothNormals(g)
  if (inflate) {
    const n = g.getAttribute('normal')
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + n.getX(i) * inflate, pos.getY(i) + n.getY(i) * inflate, pos.getZ(i) + n.getZ(i) * inflate)
  }
  return g
}

/** Plumaje: pechera clara al frente con borde en escamas y plumitas sueltas en lomo y costados. */
function bodyTexture(c: HenColors) {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = c.body
    ctx.fillRect(0, 0, w, h)
    const rand = rng(7)
    // Plumitas (escamas) en la espalda y los costados.
    ctx.strokeStyle = c.feather
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    for (let i = 0; i < 70; i++) {
      const u = rand()
      if (Math.abs(u - 0.5) < 0.2) continue
      const v = 0.25 + rand() * 0.55
      const x = u * w
      const y = (1 - v) * h
      ctx.beginPath()
      ctx.arc(x, y, 14, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.stroke()
    }
    // Pechera: óvalo claro al frente (u = 0,5) con el borde de abajo festoneado.
    ctx.fillStyle = c.chest
    const cx = w * 0.5
    const half = w * 0.078
    const cy = h * 0.56
    const ry = h * 0.17
    ctx.beginPath()
    ctx.ellipse(cx, cy, half, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    for (let i = -2; i <= 2; i++) {
      const x = cx + i * half * 0.42
      const y = cy + Math.sqrt(Math.max(0, 1 - (i * 0.42) ** 2)) * ry
      ctx.beginPath()
      ctx.arc(x, y - 6, half * 0.26, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

/** Ala plegada: apunta hacia atrás, casi horizontal, siguiendo el lomo. */
const WING_RX = -1.78

export type HenColors = typeof HEN.colors

/** `c`: colores del plumaje (ver plumage.ts); sin ellos, la gallina clásica. */
export function buildHen(c: HenColors = HEN.colors): PetRig {
  const mats = {
    body: toon('#ffffff', bodyTexture(c)),
    head: toon(c.body),
    wing: toon(c.wing),
    wingTip: toon(c.wingTip),
    tail: toon(c.tail),
    tailLight: toon(c.tailLight),
    comb: toon(c.comb),
    beak: toon(c.beak),
    leg: toon(c.leg),
  }

  const { center: hc, radii: hr } = HEN.head
  // Las piezas de la cara se diseñaron para una cabeza de radio 0,16: se escalan a la actual.
  const K = hr[1] / 0.156
  const at = (dx: number, dy: number, dz: number): V3 => [hc[0] + dx * K, hc[1] + dy * K, hc[2] + dz * K]
  const sc = (x: number, y: number, z: number): V3 => [x * K, y * K, z * K]
  const root = joint('root', null, [0, 0, 0])
  const body = joint('body', root, HEN.hip)
  const neck = joint('neck', body, HEN.neck.base)
  const head = joint('head', neck, hc)
  const beak = joint('beak', head, at(0, -0.042, 0.134))
  const comb = joint('comb', head, at(0, 0.15, 0))
  const shoulder: V3 = [0.22, 0.44, 0.1]
  const wingL = joint('wingL', body, shoulder)
  const wingR = joint('wingR', body, [-shoulder[0], shoulder[1], shoulder[2]])
  const hand = joint('hand', wingR, [-0.27, 0.36, -0.25])
  const tail = joint('tail', body, [0, 0.53, -0.37])
  const outfit = joint('outfit', body, [0, 0, 0])
  const hatSocket = joint('hat', head, HEN.head.center)
  const feet = [1, -1].map((s) => joint(s > 0 ? 'footL' : 'footR', root, [s * HEN.feet.x, 0, HEN.feet.z]))
  const toes = feet.map((f, i) => joint(`toes${i}`, f, [(i ? -1 : 1) * HEN.feet.x, 0, HEN.feet.z]))
  const hips = [1, -1].map((s) => joint('hip', body, [s * 0.095, 0.22, 0.0]))
  const ankles = feet.map((f, i) => joint('ankle', f, [(i ? -1 : 1) * HEN.feet.x, 0.03, HEN.feet.z]))
  const shins = [0, 1].map((i) => joint(`shin${i}`, root, [0, 0, 0]))

  const b = new RigBuilder(root)

  // Torso.
  b.add(body, henBodyGeometry(), mats.body)

  // Cuello: tramo corto y redondeado entre la esclavina del torso y la cabeza (es lo que se dobla al picotear).
  {
    const { base, top } = HEN.neck
    const v = new THREE.Vector3(...top).sub(new THREE.Vector3(...base))
    const L = v.length()
    const geo = lathe(
      [
        [0, 0],
        [0.07, -0.04],
        [0.125, 0.04],
        [0.13, 0.35 * L],
        [0.122, 0.75 * L],
        [0.1, 1.05 * L],
        [0, 1.2 * L],
      ],
      { segments: 32, samples: 24 },
    )
    b.add(neck, geo, mats.head, { pos: base, rot: [Math.atan2(v.z, v.y), 0, 0], scale: [1, 1, 0.92] })
  }

  // Cabeza.
  b.add(head, sphere(1, 40, 28), mats.head, { pos: hc, scale: hr })

  // Pico: mitad de arriba fija a la cabeza, la de abajo en su propia articulación.
  const beakProfile: [number, number][] = [
    [0, 0],
    [0.052, 0.006],
    [0.05, 0.035],
    [0.033, 0.068],
    [0.012, 0.092],
    [0, 0.1],
  ]
  const beakGeo = lathe(beakProfile, { segments: 24, samples: 20 })
  b.add(head, beakGeo, mats.beak, { pos: at(0, -0.02, 0.128), rot: [Math.PI / 2 - 0.12, 0, 0], scale: sc(1.15, 1, 0.63), outline: 0.8 })
  b.add(beak, beakGeo, mats.beak, { pos: at(0, -0.043, 0.131), rot: [Math.PI / 2 + 0.22, 0, 0], scale: sc(0.84, 0.65, 0.5), outline: 0.8 })

  // Cresta de tres lóbulos (se esconde con sombrero).
  for (const [y, z, rx, k] of [
    [0.148, 0.07, 0.75, 0.82],
    [0.178, 0.0, 0.2, 1],
    [0.162, -0.07, -0.4, 0.88],
  ] as const)
    b.add(comb, sphere(1, 24, 16), mats.comb, { pos: at(0, y, z), rot: [rx, 0, 0], scale: sc(0.032 * k, 0.058 * k, 0.047 * k) })

  // Barbilla (dos gotitas rojas bajo el pico).
  for (const s of [1, -1])
    b.add(head, teardrop(0.42), mats.comb, { pos: at(s * 0.015, -0.112, 0.118), rot: [0.1, 0, -s * 0.12], scale: sc(0.03, 0.052, 0.027), outline: 0.8 })

  // Alas: gotas aplanadas pegadas al costado, con la punta hacia atrás y abajo.
  for (const [s, w] of [
    [1, wingL],
    [-1, wingR],
  ] as const) {
    const base: V3 = [s * 0.232, 0.42, 0.085]
    // Inclinada hacia adentro arriba (abrazando el lomo): giro en z aplicado después del de x.
    const wingRot = (rx: number) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s * 0.24)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)))
      return new THREE.Euler().setFromQuaternion(q)
    }
    const r0 = wingRot(WING_RX)
    b.add(w, teardrop(0.34), mats.wing, { pos: base, rot: [r0.x, r0.y, r0.z], scale: [0.09, 0.37, 0.46] })
    // Plumas de la punta, más oscuras: siguen el eje del ala y asoman un poco por detrás.
    for (const [drx, k] of [
      [0.16, 1],
      [-0.12, 0.85],
    ] as const) {
      const rot = wingRot(WING_RX + drx)
      const dir = new THREE.Vector3(0, 1, 0).applyEuler(rot)
      const p = new THREE.Vector3(...base).addScaledVector(dir, 0.16).add(new THREE.Vector3(s * 0.022, 0, 0))
      b.add(w, teardrop(0.3), mats.wingTip, { pos: [p.x, p.y, p.z], rot: [rot.x, rot.y, rot.z], scale: [0.06 * k, 0.2 * k, 0.2 * k], outline: 0.7 })
    }
  }

  // Cola en abanico vertical (se ve ancha de perfil, como en las gallinas de verdad).
  const fan = [-0.15, -0.5, -0.85, -1.2]
  fan.forEach((rx, i) => {
    const len = [0.3, 0.34, 0.3, 0.24][i]
    const side = i % 2 ? 1 : -1
    b.add(tail, teardrop(0.3), i % 2 ? mats.tailLight : mats.tail, {
      pos: [side * 0.012, 0.52 - i * 0.012, -0.35],
      rot: [rx, 0, side * 0.08],
      scale: [0.09, len, 0.21 * (len / 0.3)],
    })
  })

  // Patas: tobillo + 3 dedos al frente + 1 atrás. La canilla se estira por IK.
  feet.forEach((f, i) => {
    const s = i ? -1 : 1
    const fx = s * HEN.feet.x
    b.add(f, sphere(1, 16, 12), mats.leg, { pos: [fx, 0.026, HEN.feet.z], scale: 0.03 })
    for (const [spread, len] of [
      [-0.55, 0.07],
      [0, 0.085],
      [0.55, 0.07],
      [Math.PI, 0.04],
    ] as const) {
      const r = 0.017
      const dir = new THREE.Vector3(Math.sin(spread), 0, Math.cos(spread))
      const mid = new THREE.Vector3(fx, r, HEN.feet.z).addScaledVector(dir, len / 2 + 0.01)
      b.add(toes[i], capsule(r, len), mats.leg, { pos: [mid.x, mid.y, mid.z], rot: [Math.PI / 2, 0, -spread], outline: 0.8 })
    }
  })
  for (const sh of shins) b.add(sh, cylinder(0.022, 0.024, 1, 14).translate(0, 0.5, 0), mats.leg, { outline: 0.8 })

  b.finish()

  // Cara.
  const eyes = ([1, -1] as const).map((s) => spotOnEllipsoid(hc, hr, s * 0.44, 0.08)) as [ReturnType<typeof spotOnEllipsoid>, ReturnType<typeof spotOnEllipsoid>]
  const blush = ([1, -1] as const).map((s) => spotOnEllipsoid(hc, hr, s * 0.86, -0.2)) as typeof eyes
  const face = new Face({ eyes, eyeSize: 0.043, blush, blushSize: 0.046, facing: 0.35 })
  // Las piezas de la cara están en espacio del modelo: se pasan al de la cabeza.
  root.updateMatrixWorld(true)
  face.group.applyMatrix4(head.matrixWorld.clone().invert())
  head.add(face.group)

  return {
    kind: 'hen',
    root,
    joints: { root, body, neck, head, beak, wingL, wingR, tail, footL: feet[0], footR: feet[1] },
    face,
    materials: Object.values(mats),
    legs: [0, 1].map((i) => ({ hip: hips[i], ankle: ankles[i], shin: shins[i] })),
    sockets: { hat: { obj: hatSocket, radius: 0.15 }, feet, outfit, wings: [wingL, wingR], hand },
    hideWithHat: [comb],
    toes,
    height: 1.05,
    peckTarget: [0, 0, 0.42],
  }
}
