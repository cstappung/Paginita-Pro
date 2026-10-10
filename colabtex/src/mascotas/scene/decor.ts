import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RigBuilder, cylinder, extruded, heartShape, lathe, sphere, toon, torus, type AddOptions, type V3 } from '../pets/rig/kit'
import { M, MT } from '../pets/tailor'
import { glowSprite } from '../pets/glow'
import { getDecor } from '../data/decor'
import { tintHex, tintSig, withTint } from '../pets/tint'

// Muebles y juguetes del lugar de cada mascota, hechos por código con el mismo look toon (trazo de
// tinta y cel-shading) que las mascotas. Escala de mascota: una silla le llega al pecho a la gallina.
// Cada pieza se arma con el piso en y = 0 y el frente hacia +z.

/** Oscuridad del cuarto (0 = luz prendida, 1 = de noche); la escribe la iluminación de la escena. */
export const night = { level: 0 }

const box = (w: number, h: number, d: number, r = Math.min(w, h, d) * 0.25) => new RoundedBoxGeometry(w, h, d, 3, r)

/** Materiales que brillan de noche: todas las lámparas (de cualquier color) se prenden juntas. */
const glowing = new Set<THREE.MeshToonMaterial>()
const litCache = new Map<string, THREE.MeshToonMaterial>()
/** Material que brilla de noche (con los colores del objeto, si es una variante). */
function lit(color: string, glow: string, day: number, full: number) {
  const key = `${color}|${glow}${tintSig(color)}`
  let m = litCache.get(key)
  if (!m) {
    m = toon(color)
    m.emissive.set(tintHex(glow))
    m.userData.glow = [day, full]
    litCache.set(key, m)
    glowing.add(m)
  }
  return m
}
const GLOW = {
  shade: () => lit('#ffe9a8', '#ffc861', 0.05, 0.95),
  bulb: () => lit('#fffbe8', '#fff1b0', 0.3, 1.4),
  cap: () => lit('#ef5a4f', '#ff7a5c', 0, 0.75),
  dot: () => lit('#fff8ec', '#ffe6c8', 0.05, 1.1),
  window: () => lit('#ffe9a8', '#ffcf6b', 0.05, 1.1),
}
/** Prende las lámparas según la noche (se llama una vez por cuadro). */
export function glowDecor(level: number) {
  for (const m of glowing) {
    const [day, full] = m.userData.glow as [number, number]
    m.emissiveIntensity = day + (full - day) * level
  }
}

// ---------- Texturas ----------

const rugMat = () =>
  MT('decor-rug', (g, w, h) => {
    const c = w / 2
    const rings = ['#e8705f', '#f7d26b', '#7cc8a6', '#f7d26b', '#e8705f', '#fff4dc']
    rings.forEach((col, i) => {
      g.beginPath()
      g.arc(c, h / 2, c * (1 - i / rings.length), 0, Math.PI * 2)
      g.fillStyle = col
      g.fill()
    })
    // Puntadas blancas entre anillos.
    g.strokeStyle = 'rgba(255,255,255,.8)'
    g.lineWidth = 3
    g.setLineDash([8, 8])
    for (let i = 1; i < rings.length; i++) {
      g.beginPath()
      g.arc(c, h / 2, c * (1 - i / rings.length) + 2, 0, Math.PI * 2)
      g.stroke()
    }
  })

const clothMat = () =>
  MT('decor-cloth', (g, w, h) => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ef7d8e'
    const n = 8
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % 2) g.fillRect((x * w) / n, (y * h) / n, w / n, h / n)
  })

const hayMat = () =>
  MT('decor-hay', (g, w, h) => {
    g.fillStyle = '#efc65e'
    g.fillRect(0, 0, w, h)
    let s = 7
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 140; i++) {
      g.strokeStyle = ['#d9a83f', '#f9df8a', '#c99632'][i % 3]
      g.lineWidth = 2 + r() * 2
      const x = r() * w
      const y = r() * h
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + 30 + r() * 30, y + (r() - 0.5) * 10)
      g.stroke()
    }
  })

const beachMat = () =>
  MT('decor-beach', (g, w, h) => {
    const cols = ['#ef4f4f', '#ffffff', '#3d8fe0', '#ffd23f', '#ffffff', '#4fbf6a']
    cols.forEach((c, i) => {
      g.fillStyle = c
      g.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h)
    })
  })

const plankMat = () =>
  MT('decor-planks', (g, w, h) => {
    g.fillStyle = '#d9574f'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#a83d3a'
    g.lineWidth = 4
    for (let y = h / 6; y < h; y += h / 6) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y)
      g.stroke()
    }
  })

const blockMat = (letter: string, bg: string) =>
  MT(`decor-block-${letter}`, (g, w, h) => {
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#ffffff'
    g.lineWidth = 14
    g.strokeRect(18, 18, w - 36, h - 36)
    g.fillStyle = '#ffffff'
    g.font = `900 ${h * 0.58}px Nunito, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(letter, w / 2, h * 0.54)
  })

// ---------- Piezas ----------

type Add = (g: THREE.BufferGeometry, m: THREE.Material, p?: AddOptions) => void
/** Luz que da un objeto de noche (en su espacio). */
export interface DecorLight {
  pos: V3
  color: string
  size: number
}

const WOOD = '#c98a4b'
const INKY = '#3a2416'

const BUILD: Record<string, (a: Add) => DecorLight | void> = {
  rug(a) {
    a(cylinder(1, 1, 0.012, 56), rugMat(), { pos: [0, 0.006, 0], scale: [0.56, 1, 0.42], outline: 0.6 })
  },

  bed(a) {
    a(cylinder(0.25, 0.26, 0.06), M('#c95f7f'), { pos: [0, 0.03, 0], scale: [1, 1, 0.82] })
    a(torus(0.24, 0.085), M('#ec7f9f'), { pos: [0, 0.085, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.82, 0.9] })
    a(sphere(1), M('#fff3e6'), { pos: [0, 0.075, 0], scale: [0.2, 0.045, 0.16] })
    a(extruded(heartShape(0.045), 0.02), M('#fff3e6'), { pos: [0, 0.1, 0.27] })
  },

  lamp(a) {
    a(cylinder(0.11, 0.13, 0.04), M('#5b4b6b'), { pos: [0, 0.02, 0] })
    a(cylinder(0.018, 0.018, 0.72), M('#d9b25f'), { pos: [0, 0.4, 0] })
    a(sphere(0.05), GLOW.bulb(), { pos: [0, 0.72, 0], outline: 0 })
    a(cylinder(0.09, 0.16, 0.2), GLOW.shade(), { pos: [0, 0.84, 0] })
    a(sphere(0.022), M('#d9b25f'), { pos: [0, 0.955, 0] })
    // Cadenita para prenderla.
    a(cylinder(0.004, 0.004, 0.08, 6), M(INKY), { pos: [0.11, 0.7, 0.06], outline: 0 })
    a(sphere(0.016), M('#d9b25f'), { pos: [0.11, 0.655, 0.06] })
    return { pos: [0, 0.72, 0], color: '#ffcf7a', size: 0.9 }
  },

  mushroom(a) {
    a(lathe([[0, 0], [0.085, 0], [0.072, 0.1], [0.062, 0.22], [0.07, 0.27], [0, 0.27]]), M('#fff2d6'))
    a(box(0.05, 0.08, 0.02, 0.01), M('#8a5a3a'), { pos: [0, 0.05, 0.078] })
    a(cylinder(0.2, 0.2, 0.012), M('#f2d6a8'), { pos: [0, 0.262, 0] })
    a(new THREE.SphereGeometry(0.2, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), GLOW.cap(), { pos: [0, 0.262, 0], scale: [1, 0.78, 1] })
    // Lunares sobre el sombrero.
    const dots: [number, number, number][] = [[0, 0.15, 1], [0.6, 0.85, 0.8], [2.2, 0.8, 0.9], [3.6, 0.9, 0.85], [4.8, 0.75, 0.75], [1.4, 1.2, 0.7], [5.6, 1.15, 0.7]]
    for (const [az, el, s] of dots) {
      const n = new THREE.Vector3(Math.sin(el) * Math.sin(az), Math.cos(el), Math.sin(el) * Math.cos(az))
      a(sphere(1, 16, 10), GLOW.dot(), { pos: [n.x * 0.2, 0.262 + n.y * 0.156, n.z * 0.2], scale: [0.035 * s, 0.012, 0.035 * s], rot: [el * Math.cos(az), 0, -el * Math.sin(az)], outline: 0.5 })
    }
    return { pos: [0, 0.32, 0.05], color: '#ff9c86', size: 0.75 }
  },

  chair(a) {
    for (const [x, z] of [[-0.12, -0.11], [0.12, -0.11], [-0.12, 0.11], [0.12, 0.11]]) a(cylinder(0.018, 0.016, 0.3, 12), M(WOOD), { pos: [x, 0.15, z] })
    a(box(0.31, 0.045, 0.29, 0.015), M(WOOD), { pos: [0, 0.31, 0] })
    a(box(0.26, 0.045, 0.24, 0.02), M('#e85d75'), { pos: [0, 0.35, 0.01] })
    for (const x of [-0.12, 0.12]) a(cylinder(0.018, 0.018, 0.33, 12), M(WOOD), { pos: [x, 0.47, -0.12] })
    a(box(0.32, 0.1, 0.035, 0.015), M(WOOD), { pos: [0, 0.6, -0.12] })
    a(box(0.26, 0.035, 0.025, 0.01), M(WOOD), { pos: [0, 0.46, -0.12] })
    a(extruded(heartShape(0.03), 0.012), M('#e85d75'), { pos: [0, 0.6, -0.1] })
  },

  table(a) {
    a(cylinder(0.12, 0.14, 0.03), M(WOOD), { pos: [0, 0.015, 0] })
    a(cylinder(0.032, 0.032, 0.28, 14), M(WOOD), { pos: [0, 0.16, 0] })
    a(cylinder(0.25, 0.25, 0.035), M(WOOD), { pos: [0, 0.3, 0] })
    a(cylinder(0.27, 0.27, 0.012, 40), clothMat(), { pos: [0, 0.323, 0], outline: 0.6 })
    // Tetera y taza.
    a(sphere(0.07), M('#7fc4d8'), { pos: [0.06, 0.385, -0.03], scale: [1, 0.82, 1] })
    a(sphere(0.022), M('#ffffff'), { pos: [0.06, 0.445, -0.03] })
    a(cylinder(0.012, 0.02, 0.08, 10), M('#7fc4d8'), { pos: [0.14, 0.4, -0.03], rot: [0, 0, -0.9] })
    a(torus(0.032, 0.01, 20), M('#7fc4d8'), { pos: [-0.01, 0.39, -0.03] })
    a(cylinder(0.034, 0.026, 0.045, 18), M('#ffffff'), { pos: [-0.1, 0.352, 0.08] })
    a(cylinder(0.028, 0.028, 0.004, 18), M('#b5703a'), { pos: [-0.1, 0.373, 0.08], outline: 0 })
  },

  sunflower(a) {
    a(lathe([[0, 0], [0.085, 0], [0.105, 0.15], [0.12, 0.16], [0.12, 0.19], [0, 0.19]]), M('#d0714a'))
    a(cylinder(0.104, 0.104, 0.01), M('#6b4228'), { pos: [0, 0.188, 0], outline: 0 })
    a(cylinder(0.014, 0.02, 0.46, 10), M('#5aa64a'), { pos: [0, 0.42, 0] })
    for (const s of [-1, 1]) a(sphere(1, 18, 10), M('#6cbf55'), { pos: [s * 0.07, 0.4 + (s > 0 ? 0.06 : 0), 0], rot: [0, 0, s * 0.45], scale: [0.08, 0.018, 0.04] })
    const head: V3 = [0, 0.68, 0.02]
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2
      a(sphere(1, 14, 10), M(i % 2 ? '#ffc72c' : '#ffd84d'), {
        pos: [head[0] + Math.sin(t) * 0.1, head[1] + Math.cos(t) * 0.1, head[2] - 0.006],
        rot: [0, 0, -t],
        scale: [0.036, 0.07, 0.014],
        outline: 0.7,
      })
    }
    a(cylinder(0.072, 0.072, 0.03, 28), M('#7a4722'), { pos: head, rot: [Math.PI / 2, 0, 0] })
    // Carita.
    for (const s of [-1, 1]) a(sphere(0.011, 10, 8), M(INKY), { pos: [s * 0.024, 0.69, 0.04], outline: 0 })
    a(torus(0.016, 0.004, 12), M(INKY), { pos: [0, 0.668, 0.037], outline: 0 })
  },

  hay(a) {
    a(box(0.5, 0.28, 0.32, 0.05), hayMat(), { pos: [0, 0.14, 0] })
    for (const x of [-0.13, 0.13]) a(box(0.03, 0.29, 0.33, 0.012), M('#a8693a'), { pos: [x, 0.14, 0], outline: 0.5 })
    for (const [x, r] of [[-0.05, 0.4], [0.03, -0.3], [0.18, 0.6]]) a(cylinder(0.006, 0.006, 0.12, 6), M('#e0b84c'), { pos: [x, 0.3, 0.02], rot: [0.2, 0, r], outline: 0.4 })
  },

  bowl(a) {
    a(cylinder(0.14, 0.11, 0.07, 32), M('#4f8fd8'), { pos: [0, 0.035, 0] })
    a(torus(0.128, 0.016), M('#6ea8ee'), { pos: [0, 0.07, 0], rot: [Math.PI / 2, 0, 0] })
    a(cylinder(0.118, 0.118, 0.006, 32), M('#a8e1ff'), { pos: [0, 0.071, 0], outline: 0 })
    a(sphere(1, 12, 8), M('#ffffff'), { pos: [-0.04, 0.075, -0.02], scale: [0.03, 0.003, 0.012], outline: 0 })
  },

  ball(a) {
    a(sphere(0.13, 36, 24), beachMat(), { pos: [0, 0.13, 0], rot: [0.5, 0.3, 0.35] })
  },

  duck(a) {
    a(sphere(1), M('#ffd84a'), { pos: [0, 0.075, -0.01], scale: [0.11, 0.075, 0.13] })
    a(sphere(1, 16, 10), M('#ffd84a'), { pos: [0, 0.12, -0.12], rot: [-0.6, 0, 0], scale: [0.04, 0.03, 0.05] })
    for (const s of [-1, 1]) a(sphere(1, 16, 10), M('#ffc533'), { pos: [s * 0.1, 0.085, -0.02], rot: [0.3, 0, s * 0.2], scale: [0.02, 0.04, 0.07] })
    a(sphere(0.068), M('#ffd84a'), { pos: [0, 0.18, 0.06] })
    a(sphere(1, 16, 10), M('#ff8c2a'), { pos: [0, 0.168, 0.13], scale: [0.042, 0.016, 0.035] })
    for (const s of [-1, 1]) a(sphere(0.012, 10, 8), M(INKY), { pos: [s * 0.032, 0.198, 0.115], outline: 0 })
  },

  blocks(a) {
    a(box(0.13, 0.13, 0.13, 0.015), blockMat('A', '#ef5d5d'), { pos: [-0.075, 0.065, 0], rot: [0, 0.2, 0] })
    a(box(0.13, 0.13, 0.13, 0.015), blockMat('B', '#3d8fe0'), { pos: [0.075, 0.065, 0.02], rot: [0, -0.15, 0] })
    a(box(0.13, 0.13, 0.13, 0.015), blockMat('C', '#4fbf6a'), { pos: [0, 0.196, 0.01], rot: [0, 0.45, 0] })
  },

  house(a) {
    // Gallinero sobre patitas, con rampa hasta la puerta.
    for (const [x, z] of [[-0.21, -0.17], [0.21, -0.17], [-0.21, 0.17], [0.21, 0.17]]) a(cylinder(0.025, 0.025, 0.14, 10), M('#8a5a3a'), { pos: [x, 0.07, z] })
    a(box(0.5, 0.36, 0.42, 0.02), plankMat(), { pos: [0, 0.32, 0] })
    const roof = new THREE.Shape()
    roof.moveTo(-0.32, 0)
    roof.lineTo(0.32, 0)
    roof.lineTo(0, 0.25)
    roof.closePath()
    a(extruded(roof, 0.48, 0.02), M('#6e3f33'), { pos: [0, 0.49, 0] })
    a(cylinder(0.05, 0.05, 0.02, 24), GLOW.window(), { pos: [0, 0.57, 0.27], rot: [Math.PI / 2, 0, 0] })
    const door = new THREE.Shape()
    door.moveTo(-0.075, 0)
    door.lineTo(0.075, 0)
    door.lineTo(0.075, 0.12)
    door.absarc(0, 0.12, 0.075, 0, Math.PI, false)
    door.closePath()
    a(extruded(door, 0.012, 0.006), M('#4a2c20'), { pos: [0, 0.155, 0.212] })
    // Marco blanco de las esquinas.
    for (const x of [-0.245, 0.245]) a(box(0.03, 0.37, 0.03, 0.01), M('#fff4e6'), { pos: [x, 0.32, 0.205], outline: 0.6 })
    a(box(0.14, 0.02, 0.26, 0.008), M('#b07a4a'), { pos: [0, 0.075, 0.33], rot: [0.58, 0, 0] })
    for (const z of [0.27, 0.33, 0.39]) a(box(0.14, 0.012, 0.015, 0.005), M('#8a5a3a'), { pos: [0, 0.075 - (z - 0.33) * 0.66 + 0.012, z], rot: [0.58, 0, 0], outline: 0 })
  },
}

/** Un objeto armado: la raíz se mueve por el piso; `body` rebota al ponerlo o elegirlo. */
export interface DecorModel {
  root: THREE.Group
  body: THREE.Group
  light?: DecorLight & { glow: THREE.Sprite }
  dispose(): void
}

/** `tint`: semilla de color del objeto del inventario (sin valor = colores originales). */
export function buildDecor(id: string, tint?: number): DecorModel {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  root.userData.decorId = id
  root.userData.flat = !!getDecor(id)?.flat
  const b = new RigBuilder(body)
  const make = BUILD[id]
  const spec = withTint(tint, getDecor(id)?.keep, () => make?.((g, m, p) => b.add(body, g, m, p)))
  const meshes = b.finish()
  let light: DecorModel['light']
  if (spec) {
    const glow = glowSprite('soft', spec.color, spec.size, 0, 2)
    glow.position.set(...spec.pos)
    glow.raycast = () => {}
    body.add(glow)
    light = { ...spec, glow }
  }
  return {
    root,
    body,
    light,
    dispose() {
      for (const m of meshes) m.geometry.dispose()
      light?.glow.material.dispose()
    },
  }
}
