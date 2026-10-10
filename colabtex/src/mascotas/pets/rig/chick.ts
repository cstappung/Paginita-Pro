import * as THREE from 'three'
import { Face } from './face'
import { RigBuilder, canvasTexture, capsule, joint, lathe, rng, spotOnLathe, teardrop, toon } from './kit'
import type { PetRig } from './types'

// Pollito: una bolita amarilla con copete, alitas y patitas. La "cabeza" es el mismo cuerpo:
// la cara gira alrededor del eje vertical deslizándose sobre la superficie (por eso el cuerpo es redondo).

export const CHICK = {
  colors: {
    body: '#ffd447',
    belly: '#fff1a6',
    fluff: '#f7c234',
    wing: '#f9bd2c',
    beak: '#ff9f2e',
    feet: '#ff9330',
  },
  body: [
    [0, 0.03],
    [0.2, 0.048],
    [0.35, 0.12],
    [0.44, 0.26],
    [0.462, 0.4],
    [0.435, 0.54],
    [0.365, 0.67],
    [0.255, 0.77],
    [0.12, 0.832],
    [0, 0.848],
  ] as [number, number][],
  feet: { x: 0.14, z: 0.17 },
}

function bodyTexture(c: ChickColors) {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = c.body
    ctx.fillRect(0, 0, w, h)
    // Pancita clara al frente.
    ctx.fillStyle = c.belly
    ctx.beginPath()
    ctx.ellipse(w * 0.5, h * 0.72, w * 0.14, h * 0.2, 0, 0, Math.PI * 2)
    ctx.fill()
    // Pelusa: piquitos más oscuros repartidos en la espalda.
    const rand = rng(3)
    ctx.strokeStyle = c.fluff
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    for (let i = 0; i < 40; i++) {
      const u = rand()
      if (Math.abs(u - 0.5) < 0.22) continue
      const x = u * w
      const y = (0.25 + rand() * 0.5) * h
      ctx.beginPath()
      ctx.moveTo(x - 9, y)
      ctx.lineTo(x, y + 9)
      ctx.lineTo(x + 9, y)
      ctx.stroke()
    }
  })
}

export type ChickColors = typeof CHICK.colors

/** `c`: colores del plumón (ver plumage.ts); sin ellos, el pollito amarillo clásico. */
export function buildChick(c: ChickColors = CHICK.colors): PetRig {
  const mats = {
    body: toon('#ffffff', bodyTexture(c)),
    fluff: toon(c.fluff),
    wing: toon(c.wing),
    beak: toon(c.beak),
    feet: toon(c.feet),
  }
  const P = CHICK.body
  const root = joint('root', null, [0, 0, 0])
  const body = joint('body', root, [0, 0.04, 0])
  const head = joint('head', body, [0, 0.45, 0])
  const beak = joint('beak', head, [0, 0.455, 0.43])
  const tuft = joint('tuft', head, [0, 0.83, 0])
  const hatSocket = joint('hat', head, [0, 0.48, 0])
  const wingL = joint('wingL', body, [0.42, 0.45, -0.02])
  const wingR = joint('wingR', body, [-0.42, 0.45, -0.02])
  // Punta del ala derecha: ahí toma el pañuelo de la cueca.
  const hand = joint('hand', wingR, [-0.39, 0.31, -0.1])
  const feet = [1, -1].map((s) => joint(s > 0 ? 'footL' : 'footR', root, [s * CHICK.feet.x, 0, CHICK.feet.z]))
  const toes = feet.map((f, i) => joint(`toes${i}`, f, [(i ? -1 : 1) * CHICK.feet.x, 0, CHICK.feet.z]))

  const b = new RigBuilder(root)
  b.add(body, lathe(P, { segments: 48 }), mats.body)

  // Pico chiquito: arriba fijo a la "cabeza", abajo abre.
  const beakGeo = lathe(
    [
      [0, 0],
      [0.05, 0.006],
      [0.046, 0.03],
      [0.026, 0.058],
      [0, 0.075],
    ],
    { segments: 20, samples: 16 },
  )
  b.add(head, beakGeo, mats.beak, { pos: [0, 0.468, 0.418], rot: [Math.PI / 2 - 0.1, 0, 0], scale: [1.1, 1, 0.6], outline: 0.8 })
  b.add(beak, beakGeo, mats.beak, { pos: [0, 0.448, 0.42], rot: [Math.PI / 2 + 0.25, 0, 0], scale: [0.8, 0.7, 0.45], outline: 0.8 })

  // Copete de tres plumitas.
  for (const [rz, len, dx] of [
    [0.55, 0.11, 0.025],
    [0, 0.15, 0],
    [-0.55, 0.11, -0.025],
  ] as const)
    b.add(tuft, teardrop(0.34), mats.fluff, { pos: [dx, 0.815, 0.02], rot: [-0.15, 0, rz], scale: [0.11 * len * 3, len, 0.09 * len * 3], outline: 0.8 })

  // Alitas.
  for (const [s, w] of [
    [1, wingL],
    [-1, wingR],
  ] as const)
    b.add(w, teardrop(0.36), mats.wing, { pos: [s * 0.465, 0.52, 0.03], rot: [-2.6, 0, s * 0.3], scale: [0.14, 0.26, 0.44] })

  // Patitas: tres dedos al frente.
  feet.forEach((f, i) => {
    const fx = (i ? -1 : 1) * CHICK.feet.x
    for (const [spread, len] of [
      [-0.5, 0.055],
      [0, 0.07],
      [0.5, 0.055],
    ] as const) {
      const r = 0.022
      const dir = new THREE.Vector3(Math.sin(spread), 0, Math.cos(spread))
      const mid = new THREE.Vector3(fx, r, CHICK.feet.z).addScaledVector(dir, len / 2 + 0.005)
      b.add(toes[i], capsule(r, len), mats.feet, { pos: [mid.x, mid.y, mid.z], rot: [Math.PI / 2, 0, -spread], outline: 0.8 })
    }
  })
  b.finish()

  const at = (y: number, az: number) => spotOnLathe(P, y, az)
  const face = new Face({
    eyes: [at(0.565, 0.36), at(0.565, -0.36)],
    eyeSize: 0.07,
    blush: [at(0.45, 0.7), at(0.45, -0.7)],
    blushSize: 0.075,
    facing: 0.5,
  })
  root.updateMatrixWorld(true)
  face.group.applyMatrix4(head.matrixWorld.clone().invert())
  head.add(face.group)

  return {
    kind: 'chick',
    root,
    joints: { root, body, head, beak, wingL, wingR, footL: feet[0], footR: feet[1] },
    face,
    materials: Object.values(mats),
    legs: [],
    sockets: { hat: { obj: hatSocket, radius: 0.37 }, feet, wings: [wingL, wingR], hand },
    hideWithHat: [tuft],
    toes,
    height: 0.9,
    peckTarget: [0, 0, 0.5],
  }
}
