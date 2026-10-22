import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RigBuilder, cylinder, extruded, heartShape, lathe, sphere, torus, type AddOptions } from '../pets/rig/kit'
import { M, MT } from '../pets/tailor'
import { ARBOLES, BANCAS, FAROLES, FUENTE, MACETEROS, PLAZA } from '../game/pueblo'
import { buildDecor } from './decor'

// La plaza del Pueblo, hecha por código con el mismo look toon (trazo de tinta y cel-shading) que
// las mascotas y sus muebles: pileta, árboles, bancas, faroles, maceteros y, al fondo, las casitas
// del barrio. Dónde está cada cosa lo dice game/pueblo.ts (lo mismo con que se choca al caminar).

const box = (w: number, h: number, d: number, r = Math.min(w, h, d) * 0.25) => new RoundedBoxGeometry(w, h, d, 3, r)
type Add = (g: THREE.BufferGeometry, m: THREE.Material, p?: AddOptions) => void

const adoquines = () =>
  MT(
    'plaza-adoquin',
    (g, w, h) => {
      g.fillStyle = '#e9d9bd'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#cdb893'
      g.lineWidth = 4
      const n = 8
      for (let y = 0; y < n; y++) {
        const off = y % 2 ? w / n / 2 : 0
        g.beginPath()
        g.moveTo(0, (y * h) / n)
        g.lineTo(w, (y * h) / n)
        g.stroke()
        for (let x = 0; x <= n; x++) {
          g.beginPath()
          g.moveTo(x * (w / n) + off, (y * h) / n)
          g.lineTo(x * (w / n) + off, ((y + 1) * h) / n)
          g.stroke()
        }
      }
    },
    256,
    256,
    [6, 6],
  )

const pasto = () =>
  MT('plaza-pasto', (g, w, h) => {
    g.fillStyle = '#9fd17a'
    g.fillRect(0, 0, w, h)
    let s = 11
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = ['#8cc46a', '#b3df8c', '#7fb85e'][i % 3]
      g.lineWidth = 2
      const x = r() * w
      const y = r() * h
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + (r() - 0.5) * 6, y - 8 - r() * 6)
      g.stroke()
    }
  }, 256, 256, [10, 10])

function fuente(a: Add) {
  const { x, z } = FUENTE
  a(cylinder(1.45, 1.55, 0.32, 48), M('#d8c4a0'), { pos: [x, 0.16, z] })
  a(torus(1.38, 0.1, 56), M('#efe2c6'), { pos: [x, 0.33, z], rot: [Math.PI / 2, 0, 0] })
  a(cylinder(1.3, 1.3, 0.02, 48), M('#8fd3f4'), { pos: [x, 0.3, z], outline: 0 })
  a(lathe([[0, 0], [0.3, 0], [0.18, 0.2], [0.14, 0.6], [0.2, 0.7], [0, 0.7]]), M('#d8c4a0'), { pos: [x, 0.3, z] })
  a(cylinder(0.55, 0.45, 0.12, 36), M('#efe2c6'), { pos: [x, 1.04, z] })
  a(cylinder(0.5, 0.5, 0.02, 36), M('#8fd3f4'), { pos: [x, 1.1, z], outline: 0 })
  a(sphere(0.14), M('#efe2c6'), { pos: [x, 1.22, z] })
}

function arbol(a: Add, x: number, z: number, k: number, verde: string) {
  a(cylinder(0.11 * k, 0.15 * k, 0.9 * k, 14), M('#8a5a3a'), { pos: [x, 0.45 * k, z] })
  a(sphere(0.62 * k, 24, 16), M(verde), { pos: [x, 1.25 * k, z] })
  a(sphere(0.45 * k, 20, 14), M(verde), { pos: [x - 0.42 * k, 1.0 * k, z + 0.1 * k] })
  a(sphere(0.42 * k, 20, 14), M(verde), { pos: [x + 0.44 * k, 1.05 * k, z + 0.05 * k] })
  // Unas manzanitas.
  for (const [dx, dy, dz] of [[0.25, 1.5, 0.48], [-0.35, 1.2, 0.4], [0.5, 1.0, 0.3]])
    a(sphere(0.06 * k, 12, 8), M('#ef4f4f'), { pos: [x + dx * k, dy * k, z + dz * k], outline: 0.6 })
}

function banca(root: THREE.Group, x: number, z: number, rot: number) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rot
  root.add(g)
  const b = new RigBuilder(g)
  const a: Add = (geo, m, p) => b.add(g, geo, m, p)
  for (const s of [-1, 1]) {
    a(box(0.08, 0.28, 0.32, 0.02), M('#5b4b6b'), { pos: [s * 0.62, 0.14, 0] })
    a(box(0.08, 0.36, 0.06, 0.02), M('#5b4b6b'), { pos: [s * 0.62, 0.46, -0.16] })
  }
  for (const zz of [-0.09, 0.03, 0.15]) a(box(1.46, 0.045, 0.1, 0.015), M('#c98a4b'), { pos: [0, 0.3, zz] })
  for (const yy of [0.47, 0.6]) a(box(1.46, 0.08, 0.04, 0.015), M('#c98a4b'), { pos: [0, yy, -0.17] })
  b.finish()
}

function farol(a: Add, x: number, z: number) {
  a(cylinder(0.12, 0.15, 0.1), M('#3d3550'), { pos: [x, 0.05, z] })
  a(cylinder(0.035, 0.045, 1.5, 12), M('#3d3550'), { pos: [x, 0.8, z] })
  a(cylinder(0.13, 0.08, 0.06, 6), M('#3d3550'), { pos: [x, 1.56, z] })
  a(cylinder(0.11, 0.08, 0.2, 6), M('#fff1b0'), { pos: [x, 1.68, z], outline: 0.6 })
  a(cylinder(0.02, 0.15, 0.1, 6), M('#3d3550'), { pos: [x, 1.83, z] })
}

function macetero(a: Add, x: number, z: number, r: number, flores: string[]) {
  a(cylinder(r, r * 0.9, 0.3, 32), M('#c9774f'), { pos: [x, 0.15, z] })
  a(cylinder(r * 0.92, r * 0.92, 0.02, 32), M('#6b4228'), { pos: [x, 0.3, z], outline: 0 })
  for (let i = 0; i < 9; i++) {
    const t = (i / 9) * Math.PI * 2
    const rr = i % 3 === 0 ? 0 : r * 0.55
    const fx = x + Math.cos(t) * rr
    const fz = z + Math.sin(t) * rr
    a(cylinder(0.012, 0.012, 0.2, 6), M('#5aa64a'), { pos: [fx, 0.4, fz], outline: 0 })
    a(sphere(0.08, 14, 10), M(flores[i % flores.length]), { pos: [fx, 0.52, fz], scale: [1, 0.7, 1] })
    a(sphere(0.03, 10, 8), M('#ffd84d'), { pos: [fx, 0.56, fz], outline: 0 })
  }
}

function cartel(a: Add) {
  // El letrero del pueblo, al fondo a la izquierda de la pileta.
  const x = -1.6
  const z = PLAZA.zMin - 0.5
  for (const s of [-1, 1]) a(cylinder(0.04, 0.05, 1.2, 10), M('#8a5a3a'), { pos: [x + s * 0.55, 0.6, z] })
  a(box(1.4, 0.5, 0.08, 0.04), M('#f3deaa'), { pos: [x, 1.05, z] })
  a(extruded(heartShape(0.11), 0.04), M('#ef4f6f'), { pos: [x, 1.05, z + 0.05] })
}

/** Una plaza armada: la raíz va a la escena; `update` mueve el agua (reloj de la escena). */
export interface PlazaModel {
  root: THREE.Group
  update(t: number): void
  dispose(): void
}

export function buildPlaza(): PlazaModel {
  const root = new THREE.Group()
  const b = new RigBuilder(root)
  const a: Add = (g, m, p) => b.add(root, g, m, p)

  // Pasto hasta el horizonte y el piso de adoquines: el círculo de la pileta y la cruz de caminos.
  a(new THREE.PlaneGeometry(60, 40), pasto(), { rot: [-Math.PI / 2, 0, 0], pos: [0, -0.005, 0], outline: 0 })
  a(cylinder(3.6, 3.6, 0.02, 64), adoquines(), { pos: [FUENTE.x, 0.01, FUENTE.z], outline: 0.4 })
  a(box(17.2, 0.02, 1.6, 0.01), adoquines(), { pos: [0, 0.008, FUENTE.z], outline: 0.4 })
  a(box(1.6, 0.02, 10.6, 0.01), adoquines(), { pos: [0, 0.008, -0.2], outline: 0.4 })

  fuente(a)
  ARBOLES.forEach((o, i) => arbol(a, o.x, o.z, 1 + (i % 3) * 0.12, ['#6cbf55', '#58a948', '#7fcf63'][i % 3]))
  FAROLES.forEach((o) => farol(a, o.x, o.z))
  MACETEROS.forEach((o, i) => macetero(a, o.x, o.z, o.r, [['#ef5a8f', '#ffffff'], ['#a77fe0', '#ffd84d'], ['#ef4f4f', '#ff9c5a']][i % 3]))
  cartel(a)
  // Seto bajo a los costados.
  for (const s of [-1, 1])
    for (let zz = PLAZA.zMin; zz <= PLAZA.zMax; zz += 0.9) a(sphere(0.5, 18, 12), M('#5fae4f'), { pos: [s * (PLAZA.xMax + 0.9), 0.35, zz], scale: [1, 0.75, 1] })
  b.finish()

  BANCAS.forEach((o) => banca(root, o.x, o.z, o.rot))

  // Las casitas del barrio, al fondo: el mismo gallinero de los muebles, en grande.
  const casas: { dispose(): void }[] = []
  const filas = [-6.8, -4.5, 3.1, 5.4, 7.6]
  filas.forEach((x, i) => {
    const m = buildDecor('house', i ? i * 7919 : undefined)
    m.root.position.set(x, 0, PLAZA.zMin - 1.5 - (i % 2) * 0.4)
    m.root.scale.setScalar(2.6)
    root.add(m.root)
    casas.push(m)
  })

  // El chorrito de agua: gotas que suben y caen.
  const gotas: THREE.Mesh[] = []
  const gotaMat = M('#bfe8ff')
  const gotaGeo = sphere(0.05, 10, 8)
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(gotaGeo, gotaMat)
    m.raycast = () => {}
    root.add(m)
    gotas.push(m)
  }

  return {
    root,
    update(t) {
      gotas.forEach((m, i) => {
        const u = (t * 0.9 + i / gotas.length) % 1
        const ang = (i / gotas.length) * Math.PI * 2
        const r = 0.08 + u * 0.42
        m.position.set(FUENTE.x + Math.cos(ang) * r, 1.3 + u * 0.6 - u * u * 1.1, FUENTE.z + Math.sin(ang) * r)
      })
    },
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh && m.geometry !== gotaGeo) m.geometry.dispose()
      })
      gotaGeo.dispose()
      for (const c of casas) c.dispose()
    },
  }
}
