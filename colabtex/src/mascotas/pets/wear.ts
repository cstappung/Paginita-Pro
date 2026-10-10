import * as THREE from 'three'
import { HEN } from './rig/hen'
import { cylinder, extruded, heartShape, lathe, placeMatrix, sphere, starShape, thickSurface, torus, type Place, type V3 } from './rig/kit'
import type { PetRig } from './rig/types'
import { M, MT, NECK, Tailor, at, atH, band, bow, fitTorso, lerp, onTorso, sleeve, tdir, v, wrap } from './tailor'
import { Aura } from './glow'
import { Kit } from './legend'
import { LEGENDS, LEGEND_LIFT, LEGEND_SEAT } from './legend2'
import { tintHex, withTint } from './tint'
import { getAccessory } from '../data/accessories'
import type { SlotId } from '../game/types'

// Ropa y accesorios hechos por código, con el mismo look toon + tinta que las mascotas.
// Cada prenda se calza sobre el modelo: los sombreros sobre una "cabeza" de radio 1 (el enchufe
// del sombrero la escala a cada etapa), la ropa sobre la forma real del torso de la gallina,
// las mangas sobre las alas y el calzado sobre cada pie. Todo cuelga de las articulaciones,
// así se mueve con la mascota sin despegarse.

export interface Outfit {
  hat?: string
  boots?: string
  outfit?: string
  shoes?: string
}

/** Lo que pide la animación del cuadro: objeto en la mano y aura de los bailes legendarios. */
export interface WornFrame {
  prop: string | null
  aura: number
  beam: number
  auraColor: [string, string] | null
}

export interface Worn {
  update(t: number, f: WornFrame): void
  dispose(): void
}

/** Si la prenda de ese espacio es legendaria. */
export const isLegend = (slot: keyof typeof LEGENDS, id?: string) => !!id && id in LEGENDS[slot]

/** Tejido de punto: costillas verticales y una guarda de corazones. */
const knit = (base: string, rib: string, band: string, heart: string) =>
  MT(`knit:${base}`, (g, w, h) => {
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    g.strokeStyle = rib
    g.lineWidth = 3
    for (let x = 0; x < w; x += 16) {
      for (let y = 0; y < h; y += 14) {
        g.beginPath()
        g.moveTo(x + 2, y)
        g.lineTo(x + 8, y + 8)
        g.lineTo(x + 14, y)
        g.stroke()
      }
    }
    g.fillStyle = band
    g.fillRect(0, h * 0.42, w, h * 0.2)
    g.fillStyle = heart
    for (let x = 16; x < w; x += 64) {
      g.beginPath()
      const y = h * 0.52
      g.moveTo(x + 16, y + 10)
      g.bezierCurveTo(x - 4, y - 2, x + 6, y - 16, x + 16, y - 6)
      g.bezierCurveTo(x + 26, y - 16, x + 36, y - 2, x + 16, y + 10)
      g.fill()
    }
  }, 256, 256, [4, 1])

const gingham = (color: string) =>
  MT(`gingham:${color}`, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    g.globalAlpha = 0.55
    g.fillStyle = color
    const s = w / 8
    for (let i = 0; i < 8; i += 2) {
      g.fillRect(i * s, 0, s, h)
      g.fillRect(0, i * s, w, s)
    }
    g.globalAlpha = 1
  }, 256, 256, [2, 2])

const dots = (base: string, dot: string, n = 6, r = 0.18, repeat: [number, number] = [4, 1]) =>
  MT(`dots:${base}:${dot}:${n}:${repeat}`, (g, w, h) => {
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    g.fillStyle = dot
    const s = w / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.beginPath()
        g.arc((i + (j % 2) * 0.5) * s, (j + 0.5) * s, s * r, 0, Math.PI * 2)
        g.fill()
      }
  }, 256, 256, repeat)

/** Rayas diagonales (gorro de fiesta). */
const stripes = (a: string, b: string) =>
  MT(`stripes:${a}:${b}`, (g, w, h) => {
    g.fillStyle = a
    g.fillRect(0, 0, w, h)
    g.fillStyle = b
    for (let i = -8; i < 16; i += 2) {
      g.beginPath()
      g.moveTo(i * 32, 0)
      g.lineTo(i * 32 + 32, 0)
      g.lineTo(i * 32 + 32 + h * 0.6, h)
      g.lineTo(i * 32 + h * 0.6, h)
      g.fill()
    }
    g.fillStyle = '#ffffff'
    for (let i = 0; i < 18; i++) {
      g.beginPath()
      g.arc(((i * 53) % 256) + 10, ((i * 97) % 220) + 18, 6, 0, Math.PI * 2)
      g.fill()
    }
  })

// ---------- Sombreros (cabeza de radio 1, centro en el origen, frente +z) ----------
// La "cabeza" de cada etapa es distinta (esfera en la gallina, la parte de arriba del cuerpo en
// el pollito y el huevo): los sombreros se apoyan a la altura ≈ 0,6, donde todas miden ≈ 0,85.

type Part = (t: Tailor, j: THREE.Object3D, s: number) => void

const HATS: Record<string, Part> = {
  beanie(t, j, s) {
    const knitMat = MT('beanie', (g, w, h) => {
      g.fillStyle = '#e0463c'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#b8332b'
      g.lineWidth = 6
      for (let x = 0; x < w; x += 22) {
        g.beginPath()
        g.moveTo(x + 11, 0)
        g.lineTo(x + 11, h)
        g.stroke()
      }
    })
    t.local(j, lathe([[1.03, 0.52], [1.0, 0.66], [0.87, 0.86], [0.62, 1.03], [0.3, 1.13], [0, 1.16]], { segments: 40 }), knitMat, { scale: s })
    // Doblez tejido.
    t.local(j, lathe([[0.9, 0.4], [1.08, 0.4], [1.13, 0.5], [1.11, 0.62], [1.0, 0.65]], { segments: 40 }), M('#f4e6d0'), { scale: s })
    // Pompón con textura de lana (varias bolitas).
    for (const [x, y, z, r] of [[0, 1.3, 0, 0.26], [0.13, 1.25, 0.06, 0.17], [-0.12, 1.27, -0.05, 0.17], [0.02, 1.39, -0.1, 0.15]] as const)
      t.local(j, sphere(1, 20, 14), M('#ffffff'), { pos: [x * s, y * s, z * s], scale: r * s }, x === 0 && z === 0 ? 1 : 0.6)
  },
  top(t, j, s) {
    const g = new THREE.Group()
    g.rotation.set(-0.08, 0, -0.16)
    const tilt = (p: Place): Place => {
      const m = new THREE.Matrix4().makeRotationFromEuler(g.rotation).multiply(placeMatrix(p))
      const pos = new THREE.Vector3()
      const q = new THREE.Quaternion()
      const sc = new THREE.Vector3()
      m.decompose(pos, q, sc)
      const e = new THREE.Euler().setFromQuaternion(q)
      return { pos: [pos.x, pos.y, pos.z], rot: [e.x, e.y, e.z], scale: [sc.x, sc.y, sc.z] }
    }
    const black = M('#2b2b33')
    // Ala curvada hacia arriba a los costados.
    t.local(j, thickSurface((u, w) => {
      const a = u * Math.PI * 2
      const r = 0.6 + w * 0.48
      const k = (r - 0.6) / 0.48
      return v(Math.sin(a) * r, 0.62 + 0.12 * k * k * Math.sin(a) ** 2, Math.cos(a) * r * 0.94)
    }, 48, 4, 0.05), black, tilt({ scale: s }))
    t.local(j, lathe([[0.62, 0.6], [0.64, 1.2], [0.69, 1.62], [0, 1.64]], { segments: 40 }), black, tilt({ scale: s }))
    t.local(j, cylinder(0.655, 0.645, 0.2, 40), M('#c0392b'), tilt({ pos: [0, 0.74 * s, 0], scale: s }))
  },
  crown(t, j, s) {
    const gold = M('#f2c230')
    const R = 0.74
    // Aro con cinco puntas (lámina con grosor).
    t.local(j, thickSurface((u, w) => {
      const a = u * Math.PI * 2
      const tri = 1 - Math.abs(((u * 5 + 0.5) % 1) * 2 - 1) // 1 en las puntas (una al frente), 0 en los valles
      const top = 0.3 + 0.32 * tri ** 1.6
      const r = R + 0.06 * w * top
      return v(Math.sin(a) * r, 0.6 + w * top, Math.cos(a) * r)
    }, 100, 6, 0.07), gold, { scale: s })
    t.local(j, torus(R + 0.02, 0.05, 48), M('#e6a817'), { pos: [0, 0.62 * s, 0], rot: [Math.PI / 2, 0, 0], scale: s })
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      // Perlas en las puntas y joyas en el aro.
      t.local(j, sphere(1, 16, 12), M('#fff6e0'), { pos: [Math.sin(a) * (R + 0.04) * s, 1.27 * s, Math.cos(a) * (R + 0.04) * s], scale: 0.08 * s }, 0.6)
      const b = a + Math.PI / 5
      t.local(j, sphere(1, 16, 12), M(i % 2 ? '#3d7de0' : '#e0463c'), {
        pos: [Math.sin(b) * (R + 0.05) * s, 0.76 * s, Math.cos(b) * (R + 0.05) * s],
        rot: [0, b, 0],
        scale: [0.1 * s, 0.1 * s, 0.05 * s],
      }, 0.6)
    }
    // Terciopelo rojo adentro.
    t.local(j, sphere(1, 24, 12), M('#b8332b'), { pos: [0, 0.75 * s, 0], scale: [0.7 * s, 0.38 * s, 0.7 * s] }, 0)
  },
  cowboy(t, j, s) {
    const felt = M('#a9743f')
    // Ala ancha con los costados levantados y el frente apenas caído.
    t.local(j, thickSurface((u, w) => {
      const a = u * Math.PI * 2
      const r = 0.6 + w * 0.9
      const k = (r - 0.6) / 0.9
      return v(Math.sin(a) * r, 0.55 + k * k * (0.42 * Math.sin(a) ** 2 - 0.08 * Math.max(0, Math.cos(a))), Math.cos(a) * r * 0.92)
    }, 64, 8, 0.06), felt, { scale: s })
    // Copa con la hendidura de arriba.
    t.local(j, lathe([[0.64, 0.5], [0.67, 0.9], [0.62, 1.22], [0.42, 1.34], [0.18, 1.24], [0, 1.26]], { segments: 40 }), felt, { scale: [s * 0.94, s, s] })
    t.local(j, cylinder(0.675, 0.67, 0.16, 40), M('#5b3a1e'), { pos: [0, 0.68 * s, 0], scale: [s * 0.95, s, s] })
    t.local(j, extruded(starShape(5, 0.12, 0.055), 0.03), M('#f2c230'), { pos: [0, 0.68 * s, 0.675 * s], scale: s }, 0.5)
  },
  party(t, j, s) {
    const cone = new THREE.ConeGeometry(0.56, 1.45, 40, 1, true).translate(0, 0.725, 0)
    const p: Place = { pos: [0.05 * s, 0.58 * s, 0], rot: [-0.08, 0, -0.22], scale: s }
    t.local(j, cone, stripes('#e85d9a', '#ffd84a'), p)
    // Borde con flecos y pompón en la punta.
    t.local(j, torus(0.57, 0.07, 40), M('#ffffff'), { ...p, rot: [Math.PI / 2 - 0.08, 0, -0.22], pos: [0.05 * s, 0.6 * s, 0] })
    const tip = new THREE.Vector3(0, 1.45, 0).applyEuler(new THREE.Euler(-0.08, 0, -0.22)).multiplyScalar(s).add(new THREE.Vector3(0.05 * s, 0.58 * s, 0))
    for (const [dx, dy, dz, r] of [[0, 0.04, 0, 0.17], [0.1, 0.1, 0.04, 0.12], [-0.09, 0.12, -0.03, 0.12], [0.02, 0.16, 0.08, 0.1]] as const)
      t.local(j, sphere(1, 16, 12), M(r > 0.15 ? '#7a5cff' : '#9d86ff'), { pos: [tip.x + dx * s, tip.y + dy * s, tip.z + dz * s], scale: r * s }, r > 0.15 ? 1 : 0.6)
  },
}

/** Ajuste de cada etapa a la "cabeza" de radio 1 (ancho, alto, profundidad). */
const HAT_FIT: Record<PetRig['kind'], V3> = { hen: [0.9, 0.92, 0.95], chick: [1.02, 0.95, 1.02], egg: [1, 1, 1], cat: [1, 0.92, 1], box: [1, 0.95, 1] }

/** Altura de asiento (en radios de cabeza) e inclinación hacia atrás de cada sombrero, por etapa. */
const HAT_SEAT: Record<string, Partial<Record<PetRig['kind'], [number, number]>>> = {
  beanie: { hen: [0.06, 0.12], chick: [0.04, 0.08], egg: [0.02, 0.04], cat: [0.1, 0.1] },
  top: { hen: [0.17, 0.12], chick: [0.17, 0.1], egg: [0.12, 0.06], cat: [0.2, 0.12] },
  crown: { hen: [0.1, 0.1], chick: [0.08, 0.08], egg: [0.06, 0.04], cat: [0.14, 0.1] },
  cowboy: { hen: [0.18, 0.14], chick: [0.2, 0.12], egg: [0.14, 0.06], cat: [0.22, 0.14] },
  party: { hen: [0.17, 0.1], chick: [0.15, 0.08], egg: [0.1, 0.04], cat: [0.2, 0.1] },
}

// ---------- Ropa de la gallina (sobre la forma real del torso) ----------

const OUTFITS: Record<string, (t: Tailor, rig: PetRig) => void> = {
  sweater(t, rig) {
    const body = rig.joints.body!
    t.model(body, wrap(NECK + 0.12, 1.78, 0.012), knit('#d9473f', '#b8332b', '#f4e6d0', '#d9473f'))
    // Cuello y elástico del ruedo, tejidos.
    const rib = M('#a82e29')
    t.model(body, band(NECK + 0.13, 0.024, 0.026), rib)
    t.model(body, band(1.76, 0.02, 0.03), rib)
    for (const s of [1, -1]) sleeve(t, rig, s, knit('#d9473f', '#b8332b', '#f4e6d0', '#d9473f'), rib)
  },
  dress(t, rig) {
    const body = rig.joints.body!
    const pink = dots('#f08ab4', '#ffffff', 7, 0.13)
    t.model(body, wrap(NECK + 0.05, 1.5, 0.012), pink)
    // Falda de vuelo: cuelga derecho desde la cintura y se abre en ondas.
    const waist = -0.3
    t.model(body, thickSurface((u, w) => {
      const az = (u - 0.5) * Math.PI * 2
      const top = atH(az, waist, 0.014)
      const out = v(Math.sin(az), 0, Math.cos(az) * 1.05)
      const wave = 0.018 * Math.sin(az * 12) * w
      return top.addScaledVector(out, 0.06 * w + wave).add(v(0, -0.12 * w, 0))
    }, 96, 6, 0.012), pink)
    t.model(body, thickSurface((u, w) => {
      const az = (u - 0.5) * Math.PI * 2
      const top = atH(az, waist, 0.016)
      const out = v(Math.sin(az), 0, Math.cos(az) * 1.05)
      return top.addScaledVector(out, 0.06 + 0.018 * Math.sin(az * 12) + 0.012 * w).add(v(0, -0.12 - 0.02 * w, 0))
    }, 96, 2, 0.014), M('#ffffff'), {}, 0.8)
    // Cinturón con lazo al frente y cuello de encaje.
    const belt = Array.from({ length: 48 }, (_, i) => atH((i / 48) * Math.PI * 2, waist, 0.018))
    t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(belt, true), 96, 0.018, 8, true), M('#d85d95'))
    const front = atH(0, waist, 0.03)
    bow(t, body, front, v(0, 0.1, 1), 0.06, '#d85d95', '#b8447c')
    t.model(body, band(NECK + 0.06, 0.02, 0.022), M('#ffffff'))
    for (const s of [1, -1]) sleeve(t, rig, s, pink, M('#ffffff'), 0.3, 1.35)
  },
  cape(t, rig) {
    const body = rig.joints.body!
    const red = M('#d9473f')
    // Capa: sale del cuello, cubre hombros y espalda y cae hasta media altura, con ondas abajo.
    t.model(body, thickSurface((u, w) => {
      const az = Math.PI + (u - 0.5) * 2 * 2.05
      const top = tdir(az, NECK + 0.1)
      const hem = v(Math.sin(az), -0.12 - 0.05 * Math.cos(u * Math.PI * 9) ** 2, Math.cos(az)).normalize()
      return onTorso(top.lerp(hem, w).normalize(), 0.026 + 0.05 * w * w)
    }, 96, 16, 0.014), red)
    // Forro dorado y cuello alto de heroína.
    t.model(body, thickSurface((u, w) => {
      const a = Math.PI + (u - 0.5) * 2 * 2.6
      return at(a, NECK + 0.05 - 0.18 * w, 0.03 + 0.05 * w)
    }, 64, 4, 0.016), M('#a82e29'))
    t.model(body, band(NECK + 0.07, 0.03, 0.022), M('#f2c230'))
    const clasp = at(0, NECK + 0.09, 0.05)
    const n = at(0, NECK + 0.09, 0.1).sub(at(0, NECK + 0.09, 0))
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), n.normalize()))
    t.model(body, extruded(starShape(5, 0.055, 0.026), 0.02), M('#f2c230'), { pos: [clasp.x, clasp.y, clasp.z], rot: [e.x, e.y, e.z] }, 0.8)
  },
  apron(t, rig) {
    const body = rig.joints.body!
    const check = gingham('#e0463c')
    // Delantal de cuadrillé por delante, con bolsillo, tirantes al cuello y lazo atrás.
    const panel = (u: number, w: number) => at(lerp(-0.85, 0.85, u), lerp(0.62, 1.95, w), 0.016)
    t.model(body, thickSurface(panel, 24, 20, 0.01), check)
    t.model(body, thickSurface((u, w) => at(lerp(-0.4, 0.4, u), lerp(1.45, 1.75, w), 0.03), 12, 6, 0.01), M('#ffffff'), {}, 0.8)
    t.model(body, thickSurface((u, w) => at(lerp(-0.42, 0.42, u), lerp(1.44, 1.48, w), 0.035), 12, 2, 0.008), M('#e0463c'), {}, 0.6)
    for (const s of [1, -1]) {
      const pts = [at(s * 0.82, 0.68, 0.018), at(s * 1.4, 0.45, 0.02), at(s * 2.2, 0.38, 0.02), at(Math.PI * s, 0.36, 0.02)]
      t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011, 6), M('#e0463c'), {}, 0.7)
    }
    const waist = Array.from({ length: 48 }, (_, i) => atH((i / 48) * Math.PI * 2, -0.05, 0.022))
    t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(waist, true), 96, 0.012, 6, true), M('#e0463c'), {}, 0.7)
    const back = atH(Math.PI, -0.05, 0.03)
    bow(t, body, back, v(0, 0.2, -1), 0.055, '#e0463c')
    // Corazoncito bordado en el bolsillo.
    const hp = at(0, 1.6, 0.04)
    const hn = at(0, 1.6, 0.1).sub(at(0, 1.6, 0))
    const he = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), hn.normalize()))
    t.model(body, extruded(heartShape(0.022), 0.008), M('#e0463c'), { pos: [hp.x, hp.y, hp.z], rot: [he.x, he.y, he.z] }, 0.5)
  },
  tux(t, rig) {
    const body = rig.joints.body!
    const black = M('#2b2b33')
    t.model(body, wrap(NECK + 0.04, 1.72, 0.012), black)
    // Pechera blanca y solapas de raso.
    t.model(body, thickSurface((u, w) => at(lerp(-0.5, 0.5, u) * (1 - 0.6 * w), lerp(NECK + 0.03, 1.55, w), 0.02), 16, 16, 0.008), M('#ffffff'))
    for (const s of [1, -1])
      t.model(body, thickSurface((u, w) => at(s * lerp(0.5, 0.82, u) * (1 - 0.7 * w), lerp(NECK + 0.04, 1.42, w), 0.024), 8, 16, 0.008), M('#15151a'), {}, 0.8)
    for (const th of [1.15, 1.32, 1.49]) {
      const p = at(0, th, 0.03)
      t.model(body, sphere(1, 12, 8), M('#2b2b33'), { pos: [p.x, p.y, p.z], scale: 0.013 }, 0.4)
    }
    const knot = at(0, NECK + 0.1, 0.04)
    bow(t, body, knot, at(0, NECK + 0.1, 0.1).sub(at(0, NECK + 0.1, 0)), 0.045, '#e0463c', '#a82e29')
    t.model(body, band(1.72, 0.016, 0.018), M('#15151a'), {}, 0.6)
    for (const s of [1, -1]) sleeve(t, rig, s, black, null)
  },
}

// ---------- Calzado ----------

interface ShoeStyle {
  upper: string
  sole: string
  trim: string
  /** Tacón (alto). */
  heel?: number
  open?: boolean
  laces?: boolean
  strap?: boolean
  bow?: boolean
}
const SHOES: Record<string, ShoeStyle> = {
  sneakers: { upper: '#f4f4f4', sole: '#e0463c', trim: '#3d7de0', laces: true },
  loafers: { upper: '#5b3a1e', sole: '#2b1a0e', trim: '#f2c230', strap: true, heel: 0.012 },
  ballet: { upper: '#f5a3c7', sole: '#e47fae', trim: '#ffffff', bow: true },
  sandals: { upper: '#d9b45a', sole: '#b8903c', trim: '#e0463c', open: true },
  heels: { upper: '#d9473f', sole: '#7a1f1a', trim: '#f2c230', heel: 0.045, bow: true },
}

/** Zapato de gallina sobre el pie `i` (alrededor del tobillo, punta hacia +z). */
function henShoe(t: Tailor, rig: PetRig, i: number, st: ShoeStyle) {
  const foot = rig.sockets.feet[i]
  const fx = (i % 2 ? -1 : 1) * HEN.feet.x
  const z0 = HEN.feet.z
  const h = st.heel ?? 0
  const P = (x: number, y: number, z: number): V3 => [fx + x, y - h, z0 + z]
  // El pie se inclina sobre el tacón: la punta en el piso y el talón arriba.
  const tilt = h ? Math.atan2(h, 0.15) : 0
  if (st.open) {
    t.model(foot, cylinder(1, 1, 1, 24), M(st.sole), { pos: P(0, 0.008, 0.035), scale: [0.06, 0.014, 0.11] })
    for (const z of [0.07, 0.0]) t.model(foot, torus(1, 0.18, 24), M(st.upper), { pos: P(0, 0.02, z), rot: [0, 0, 0], scale: [0.055, 0.03, 0.025] }, 0.7)
    t.model(foot, sphere(1, 12, 8), M(st.trim), { pos: P(0, 0.045, 0.07), scale: 0.016 }, 0.6)
    return
  }
  // Suela, capellada (puntera redonda) y talón.
  t.model(foot, cylinder(1, 1, 1, 28), M(st.sole), { pos: P(0, 0.007 + h * 0.45, 0.025), rot: [tilt, 0, 0], scale: [0.058, 0.014, 0.112] })
  t.model(foot, sphere(1, 28, 18), M(st.upper), { pos: P(0, 0.032 + h * 0.3, 0.05), rot: [tilt, 0, 0], scale: [0.054, 0.04, 0.085] })
  t.model(foot, sphere(1, 24, 16), M(st.upper), { pos: P(0, 0.04 + h * 0.9, -0.025), scale: [0.05, 0.045, 0.05] })
  // Boca del zapato (oscura) donde entra la pata.
  t.model(foot, cylinder(1, 1, 1, 20), M('#3a2416'), { pos: P(0, 0.072 + h * 0.85, -0.01), scale: [0.03, 0.006, 0.034] }, 0)
  if (h) t.model(foot, cylinder(0.012, 0.007, h + 0.02, 12), M(st.sole), { pos: P(0, h / 2 - 0.004, -0.045) }, 0.7)
  if (st.laces)
    for (const k of [0, 1, 2]) t.model(foot, cylinder(0.006, 0.006, 0.05, 8), M(st.trim), { pos: P(0, 0.064 - k * 0.008, 0.035 + k * 0.022), rot: [0.9, 0, Math.PI / 2], scale: 1 }, 0.4)
  if (st.laces) t.model(foot, sphere(1, 16, 10), M(st.trim), { pos: P(0, 0.02, 0.1), scale: [0.05, 0.02, 0.04] }, 0.5)
  if (st.strap) {
    t.model(foot, torus(1, 0.12, 24), M('#3a2416'), { pos: P(0, 0.05, 0.05), rot: [Math.PI / 2 + 0.5, 0, 0], scale: [0.052, 0.04, 0.03] }, 0.6)
    t.model(foot, sphere(1, 12, 8), M(st.trim), { pos: P(0, 0.07, 0.065), scale: [0.012, 0.008, 0.012] }, 0.4)
  }
  if (st.bow) bow(t, foot, v(...P(0, 0.06 + h * 0.4, 0.075)), v(0, 0.7, 1), 0.022, st.trim)
}

interface BootStyle {
  body: string
  cuff: string
  sole: string
  heel?: boolean
  fur?: boolean
  laces?: boolean
  star?: boolean
}
const BOOTS: Record<string, BootStyle> = {
  rain: { body: '#e8453c', cuff: '#ffffff', sole: '#8c2420' },
  cowboy: { body: '#9a5f33', cuff: '#d9a35f', sole: '#3a2416', heel: true, star: true },
  snow: { body: '#7fb7e8', cuff: '#ffffff', sole: '#ffffff', fur: true },
  trek: { body: '#5e9a4a', cuff: '#e8c25a', sole: '#3a3a3a', laces: true },
  star: { body: '#8d5fd3', cuff: '#ffd84a', sole: '#ffd84a', star: true },
}

/**
 * Bota de pollito. El pie queda casi todo bajo la panza, así que la bota es gordita y asoma la
 * punta por delante: ahí van los detalles (cordones, estrella, brillo).
 */
function chickBoot(t: Tailor, rig: PetRig, i: number, st: BootStyle) {
  const foot = rig.sockets.feet[i]
  const s = i % 2 ? -1 : 1
  const P = (x: number, y: number, z: number): V3 => [s * 0.14 + x, y, 0.17 + z]
  const body = M(st.body)
  // Caña (dentro del cuerpo), capellada redonda y suela que sobresale un poco.
  t.model(foot, cylinder(0.066, 0.074, 0.14, 24), body, { pos: P(0, 0.1, -0.02) })
  t.model(foot, sphere(1, 28, 18), body, { pos: P(0, 0.056, 0.08), scale: [0.09, 0.075, 0.13] })
  t.model(foot, cylinder(1, 1, 1, 28), M(st.sole), { pos: P(0, 0.012, 0.075), scale: [0.096, 0.024, 0.14] })
  // Puntera reforzada.
  t.model(foot, sphere(1, 24, 14), M(st.sole), { pos: P(0, 0.036, 0.15), scale: [0.075, 0.04, 0.065] }, 0.6)
  if (st.heel) t.model(foot, cylinder(0.045, 0.04, 0.04, 16), M(st.sole), { pos: P(0, 0.02, -0.04) }, 0.7)
  if (st.fur)
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2
      t.model(foot, sphere(1, 12, 8), M(st.cuff), { pos: P(Math.sin(a) * 0.08, 0.1 + 0.012 * (k % 2), 0.03 + Math.cos(a) * 0.09), scale: 0.032 }, 0.6)
    }
  if (st.laces)
    for (const k of [0, 1, 2]) {
      const y = 0.118 - k * 0.018
      const z = 0.1 + k * 0.03
      t.model(foot, cylinder(0.007, 0.007, 0.075, 8), M(st.cuff), { pos: P(0, y, z), rot: [0.5 + k * 0.2, 0, Math.PI / 2] }, 0.4)
    }
  if (st.star) t.model(foot, extruded(starShape(5, 0.034, 0.016), 0.01), M(st.cuff), { pos: P(0, 0.085, 0.185), rot: [-0.5, 0, 0] }, 0.6)
  if (!st.laces && !st.star && !st.fur) {
    // Botas de lluvia: banda blanca y brillo de goma.
    t.model(foot, sphere(1, 12, 8), M('#ffffff'), { pos: P(-s * 0.035, 0.09, 0.17), rot: [-0.6, 0, 0], scale: [0.012, 0.02, 0.006] }, 0)
    t.model(foot, sphere(1, 24, 12), M(st.cuff), { pos: P(0, 0.056, 0.08), scale: [0.092, 0.013, 0.132] }, 0)
  }
}

/** Cuánto eleva el calzado a la gallina. */
export const shoeLift = (shoes?: string) => (shoes && SHOES[shoes]?.heel) || (shoes && shoes in LEGENDS.shoes ? (LEGEND_LIFT[shoes] ?? 0.008) : 0)

// ---------- Pañuelo de cueca ----------

/** Pañuelo cuadrado tomado de una punta (en el origen): cuelga en rombo, con ondas. */
function panuelo() {
  const a = 0.105
  return thickSurface((u, w) => {
    const x = (u - w) * a
    const y = -(u + w) * a
    // La punta tomada queda lisa; el resto ondea y se curva un poco hacia atrás.
    const k = (u + w) / 2
    return v(x, y, 0.024 * Math.sin(u * 6 + w * 3) * k - 0.03 * k * k)
  }, 12, 12, 0.005)
}

// ---------- Vestir ----------

/** Viste al personaje con lo que tenga puesto. Devuelve cómo animarlo y cómo sacárselo. */
/** `tints`: semilla de color de cada prenda (ver tint.ts; sin valor = colores originales). */
export function dress(rig: PetRig, o: Outfit, tints: Partial<Record<SlotId, number>> = {}): Worn {
  /** Arma una prenda con sus colores (lo que el catálogo marca como fijo no cambia). */
  const dyed = (slot: SlotId, build: () => void) => withTint(tints[slot], getAccessory(slot, o[slot])?.keep, build)
  // La ropa se cose sobre el torso de este modelo (gallina o gato).
  fitTorso(rig.torso, rig.torsoPoint)
  const t = new Tailor(rig)
  const kit = new Kit(rig)
  const hidden: THREE.Object3D[] = []
  const hide = (list: THREE.Object3D[]) => {
    for (const x of list) if (x.visible) (x.visible = false), hidden.push(x)
  }
  /** Colores de las prendas legendarias puestas (la ropa manda sobre el sombrero y el calzado). */
  const themes: [string, string][] = []
  const legend = <A extends unknown[]>(l: { color: string; accent: string; build: (k: Kit, ...a: A) => void }, ...a: A) => {
    l.build(kit, ...a)
    themes.push([tintHex(l.color), tintHex(l.accent)])
  }

  const hatId = o.hat
  const hat = hatId && HATS[hatId]
  const legendHat = hatId && LEGENDS.hat[hatId]
  let fit: THREE.Group | null = null
  if ((hat || legendHat) && rig.sockets.hat) {
    const { obj, radius } = rig.sockets.hat
    // Grupo intermedio con el ajuste de la etapa (se dibuja como cualquier pieza).
    fit = new THREE.Group()
    fit.scale.set(...HAT_FIT[rig.kind])
    // Cada sombrero se asienta a su altura y un poco echado hacia atrás (que se vean los ojos).
    // Sin asiento propio, el gato usa el del pollito (cabeza redonda y grande) y la caja el del huevo.
    const seat: Partial<Record<PetRig['kind'], [number, number]>> | undefined = (legendHat ? LEGEND_SEAT : HAT_SEAT)[hatId!]
    const [lift, back] = seat?.[rig.kind] ?? seat?.[rig.kind === 'cat' ? 'chick' : 'egg'] ?? [0, 0]
    fit.position.y = lift * radius * fit.scale.y
    fit.rotation.x = -back
    obj.add(fit)
    const f = fit
    dyed('hat', () => {
      if (hat) {
        f.updateMatrixWorld(true)
        hat(t, f, radius)
      } else if (legendHat) {
        // Los legendarios se arman en radios de cabeza: un grupo más los lleva al tamaño real.
        const head = new THREE.Group()
        head.scale.setScalar(radius)
        f.add(head)
        f.updateMatrixWorld(true)
        legend(legendHat, head)
      }
    })
    hide(rig.hideWithHat)
  }
  // Ropa y zapatos: la gallina y el gato grande; botas: el pollito y el gatito.
  const grown = rig.kind === 'hen' || (rig.kind === 'cat' && !rig.young)
  if (grown) {
    const outfit = o.outfit && OUTFITS[o.outfit]
    const legendOutfit = o.outfit && LEGENDS.outfit[o.outfit]
    dyed('outfit', () => {
      if (outfit) outfit(t, rig)
      else if (legendOutfit) {
        legend(legendOutfit)
        themes.unshift(themes.pop()!)
      }
    })
    const shoe = o.shoes && SHOES[o.shoes]
    const legendShoe = o.shoes && LEGENDS.shoes[o.shoes]
    dyed('shoes', () => {
      if (shoe) {
        // Uno por pie (el gato lleva cuatro).
        for (const i of rig.sockets.feet.keys()) henShoe(t, rig, i, shoe)
        if (!shoe.open) hide(rig.toes)
      } else if (legendShoe) {
        legend(legendShoe, 0)
        for (const i of rig.sockets.feet.keys()) if (i) legendShoe.build(kit, i)
        hide(rig.toes)
      }
    })
  }
  if (rig.kind === 'chick' || (rig.kind === 'cat' && rig.young)) {
    const boot = o.boots && BOOTS[o.boots]
    const legendBoot = o.boots && LEGENDS.boots[o.boots]
    dyed('boots', () => {
      if (boot) {
        for (const i of rig.sockets.feet.keys()) chickBoot(t, rig, i, boot)
        hide(rig.toes)
      } else if (legendBoot) {
        legend(legendBoot, 0)
        for (const i of rig.sockets.feet.keys()) if (i) legendBoot.build(kit, i)
        hide(rig.toes)
      }
    })
  }
  const meshes = [...t.finish(), ...kit.t.finish()]

  // Pañuelo: en la punta del ala, colgando hacia abajo y flameando.
  let cloth: THREE.Group | null = null
  if (rig.sockets.hand) {
    cloth = new THREE.Group()
    const ct = new Tailor(rig)
    ct.local(cloth, panuelo(), M('#ffffff'))
    rig.sockets.hand.add(cloth)
    const cm = ct.finish()
    meshes.push(...cm)
    cloth.visible = false
  }
  const q = new THREE.Quaternion()
  const sway = new THREE.Euler(0, 0, 0, 'YXZ')
  const rootQ = new THREE.Quaternion()

  // Aura: la tienen las prendas legendarias (suave) y la encienden los bailes legendarios.
  // Va al lado del personaje (no dentro: la raíz salta, gira y se aplasta) y lo sigue por el piso.
  const aura = new Aura(rig.kind, rig.height)
  const floor = 0.004 - (grown ? shoeLift(o.shoes) * (rig.shoeK ?? 1) : 0)
  const theme = themes[0] ?? null
  /** Aura de reposo: más intensa cuantas más legendarias lleve. */
  const rest = themes.length ? Math.min(0.85, 0.4 + 0.15 * themes.length) : 0
  const root = rig.root

  return {
    update(time, f) {
      kit.update(time, { jump: Math.max(0, root.position.y) })
      const color = f.auraColor ?? theme
      const level = Math.max(rest, f.aura)
      if (root.parent && aura.group.parent !== root.parent) root.parent.add(aura.group)
      if (color) aura.update(time, level, f.beam, color[0], color[1], root.position.x, root.position.z, floor)
      else aura.group.visible = false
      if (!cloth) return
      cloth.visible = f.prop === 'panuelo'
      if (!cloth.visible) return
      // Cuelga con la gravedad (independiente del ala) y flamea.
      cloth.parent!.updateWorldMatrix(true, false)
      cloth.parent!.getWorldQuaternion(q).invert()
      rig.root.getWorldQuaternion(rootQ)
      // Lo revolea: gira sobre la punta y se bambolea.
      sway.set(0.3 * Math.sin(time * 9), time * 7, 0.25 * Math.sin(time * 7 + 1))
      cloth.quaternion.copy(q).multiply(rootQ).multiply(new THREE.Quaternion().setFromEuler(sway))
    },
    dispose() {
      for (const m of meshes) {
        m.removeFromParent()
        m.geometry.dispose()
      }
      kit.dispose()
      aura.dispose()
      cloth?.removeFromParent()
      fit?.removeFromParent()
      for (const x of hidden) x.visible = true
    },
  }
}
