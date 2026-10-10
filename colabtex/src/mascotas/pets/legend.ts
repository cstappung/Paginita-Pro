import * as THREE from 'three'
import { HEN } from './rig/hen'
import { canvasTexture, cylinder, extruded, lathe, placeMatrix, rng, sphere, starShape, thickSurface, toon, torus, type Place, type V3 } from './rig/kit'
import type { PetRig } from './rig/types'
import { Motes, flameTexture, glowSprite, rimMaterial, rgba, type GlowKind, type MoteSpec } from './glow'
import { M, MT, NECK, Tailor, at, atH, band, onTorso, sleeve, tdir, v, wrap } from './tailor'
import { tintHex, tintTexture } from './tint'

// Objetos legendarios: piezas con luz propia, partes que se mueven solas (cristales que orbitan,
// llamas que titilan, propulsores que se encienden al saltar) y chispas alrededor. Se arman con
// las mismas herramientas que la ropa común y suman su animación al cuadro de cada mascota.

/** Lo que una prenda legendaria necesita para armarse y animarse. */
export class Kit {
  readonly t: Tailor
  private ticks: ((t: number, f: Frame) => void)[] = []
  private owned: { dispose(): void }[] = []
  private groups: THREE.Object3D[] = []
  constructor(readonly rig: PetRig) {
    this.t = new Tailor(rig)
  }
  /** Se libera al desvestir. */
  own<T extends { dispose(): void }>(x: T): T {
    this.owned.push(x)
    return x
  }
  /** Grupo animable colgado de `parent`, en su espacio. */
  group(parent: THREE.Object3D, p: Place = {}) {
    const g = new THREE.Group()
    placeMatrix(p).decompose(g.position, g.quaternion, g.scale)
    parent.add(g)
    this.groups.push(g)
    return g
  }
  /** Grupo animable en una articulación, ubicado en el espacio del modelo en reposo. */
  mount(joint: THREE.Object3D, p: Place = {}) {
    const rest = joint.userData.rest as THREE.Matrix4
    const g = new THREE.Group()
    rest.clone().invert().multiply(placeMatrix(p)).decompose(g.position, g.quaternion, g.scale)
    joint.add(g)
    this.groups.push(g)
    return g
  }
  /** Material toon que brilla (emisivo). */
  lit(color: string, glow: string, k: number, map?: THREE.Texture | null, emap?: THREE.Texture | null) {
    const m = this.own(toon(color, map))
    m.emissive.set(tintHex(glow))
    m.emissiveIntensity = k
    m.emissiveMap = tintTexture(emap) ?? null
    return m
  }
  motes(parent: THREE.Object3D, spec: MoteSpec, seed: number) {
    const m = this.own(new Motes({ ...spec, colors: spec.colors.map(tintHex) }, seed))
    parent.add(m.group)
    return m
  }
  sprite(parent: THREE.Object3D, kind: GlowKind, color: string, size: number, pos: V3 = [0, 0, 0], opacity = 1, order = 6) {
    const s = glowSprite(kind, tintHex(color), size, opacity, order)
    s.position.set(...pos)
    parent.add(s)
    this.own(s.material)
    return s
  }
  /** Halo de borde alrededor de una geometría (una malla aparte, sin contorno). */
  rim(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, o: Parameters<typeof rimMaterial>[1], p: Place = {}) {
    const mat = this.own(rimMaterial(tintHex(color), o))
    const g = this.own(geo.clone().applyMatrix4(placeMatrix(p)))
    const mesh = new THREE.Mesh(g, mat)
    mesh.renderOrder = 3
    mesh.frustumCulled = false
    parent.add(mesh)
    return mat
  }
  tick(fn: (t: number, f: Frame) => void) {
    this.ticks.push(fn)
  }
  update(t: number, f: Frame) {
    for (const fn of this.ticks) fn(t, f)
  }
  dispose() {
    for (const g of this.groups) g.removeFromParent()
    for (const x of this.owned) x.dispose()
  }
}

export interface Frame {
  /** Altura del salto (0 en el piso). */
  jump: number
}

/** Tema de color de cada objeto (para el aura): color principal y de acento. */
export interface Legend<A extends unknown[]> {
  color: string
  accent: string
  build: (k: Kit, ...args: A) => void
}

// ---------- Geometrías ----------

/** Tubo que se afina a lo largo de una curva (conos doblados, plumas, cuernos). */
export function taper(pts: THREE.Vector3[], radius: (u: number) => number, tubular = 48, radial = 28) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const P = new THREE.Vector3()
  const q = new THREE.Vector3()
  for (let i = 0; i <= tubular; i++) {
    curve.getPointAt(i / tubular, P)
    const r = Math.max(0.0005, radius(i / tubular))
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j
      q.fromBufferAttribute(pos, k).sub(P).multiplyScalar(r).add(P)
      pos.setXYZ(k, q.x, q.y, q.z)
    }
  }
  return { geo: g, curve }
}

/** Llama: gota alargada que se curva hacia atrás (−z) al subir. Mide 1 de alto. */
export function flame(bend = 0.25, fat = 1) {
  const g = lathe([[0, 0], [0.1 * fat, 0.05], [0.16 * fat, 0.2], [0.14 * fat, 0.42], [0.08 * fat, 0.7], [0.025 * fat, 0.93], [0, 1]], { segments: 20, samples: 24 })
  const p = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - bend * p.getY(i) ** 2)
  g.computeVertexNormals()
  return g
}

/** Caras planas (cada triángulo con su normal): aspecto tallado. */
export function facet(g: THREE.BufferGeometry) {
  const f = g.index ? g.toNonIndexed() : g
  f.deleteAttribute('normal')
  f.computeVertexNormals()
  return f
}

/** Gema facetada (octaedro estirado). */
export const gem = (w: number, h: number, d = w) => new THREE.OctahedronGeometry(1, 0).scale(w, h, d)

/** Media luna. */
export function crescent(r: number) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r, Math.PI * 0.28, Math.PI * 1.72, false)
  s.absarc(r * 0.42, 0, r * 0.78, Math.PI * 1.6, Math.PI * 0.4, true)
  return s
}

// ---------- Texturas ----------

/** Fieltro de mago: añil con estrellitas y polvo de estrellas. `glow` = solo las estrellas (mapa emisivo). */
const wizardFelt = (glow: boolean) =>
  canvasTex(`wizard:${glow}`, 256, 256, (g, w, h) => {
    g.fillStyle = glow ? '#000000' : '#3a2a8c'
    g.fillRect(0, 0, w, h)
    const r = rng(7)
    if (!glow) {
      // Pliegues suaves del fieltro.
      for (let i = 0; i < 6; i++) {
        g.fillStyle = rgba(i % 2 ? '#2a1d6e' : '#4a38a8', 0.35)
        g.fillRect(i * 44 + r() * 10, 0, 18, h)
      }
    }
    for (let i = 0; i < 70; i++) {
      const x = r() * w
      const y = r() * h
      const big = r() < 0.2
      g.fillStyle = big ? '#fff3a8' : r() < 0.5 ? '#bfe8ff' : '#ffffff'
      if (big) {
        g.save()
        g.translate(x, y)
        g.beginPath()
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2
          const rr = k % 2 ? 2.5 : 7
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
        }
        g.fill()
        g.restore()
      } else {
        g.beginPath()
        g.arc(x, y, 1 + r() * 1.6, 0, Math.PI * 2)
        g.fill()
      }
    }
  }, true)

/** Tira de runas (transparente) para bandas que brillan. */
const runeStrip = () =>
  canvasTex('runestrip', 512, 64, (g, w, h) => {
    g.strokeStyle = '#ffffff'
    g.shadowColor = '#ffffff'
    g.shadowBlur = 6
    g.lineWidth = 5
    g.lineCap = 'round'
    const r = rng(3)
    for (let i = 0; i < 12; i++) {
      const x = (i + 0.5) * (w / 12)
      g.beginPath()
      g.moveTo(x, 14)
      g.lineTo(x, 50)
      const k = r()
      if (k < 0.25) g.moveTo(x - 10, 20), g.lineTo(x + 10, 34)
      else if (k < 0.5) g.moveTo(x - 10, 46), g.lineTo(x, 30), g.lineTo(x + 10, 46)
      else if (k < 0.75) g.moveTo(x + 9, 24), g.arc(x, 24, 9, 0, Math.PI * 2)
      else g.moveTo(x - 10, 14), g.lineTo(x, 26), g.lineTo(x + 10, 14)
      g.stroke()
    }
  }, true)

/** Terciopelo morado con flores de lis doradas. */
const velvet = () =>
  MT('velvet', (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0)
    gr.addColorStop(0, '#5a2386')
    gr.addColorStop(0.5, '#6d2fa0')
    gr.addColorStop(1, '#5a2386')
    g.fillStyle = gr
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#f2c230'
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const x = (i + (j % 2) * 0.5 + 0.25) * (w / 4)
        const y = (j + 0.5) * (h / 4)
        // Flor de lis estilizada: pétalo central, dos laterales y la banda.
        g.beginPath()
        g.ellipse(x, y - 8, 4, 10, 0, 0, Math.PI * 2)
        g.ellipse(x - 8, y - 2, 3, 7, -0.7, 0, Math.PI * 2)
        g.ellipse(x + 8, y - 2, 3, 7, 0.7, 0, Math.PI * 2)
        g.fill()
        g.fillRect(x - 8, y + 2, 16, 3)
        g.beginPath()
        g.ellipse(x, y + 9, 3, 5, 0, 0, Math.PI * 2)
        g.fill()
      }
  }, 256, 256, [5, 2])

/** Armiño: blanco con colitas negras. */
const ermine = () =>
  MT('ermine', (g, w, h) => {
    g.fillStyle = '#fbf8f2'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#1e1e24'
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 6; i++) {
        const x = (i + (j % 2) * 0.5) * (w / 6) + 10
        const y = (j + 0.5) * (h / 3)
        g.beginPath()
        g.moveTo(x, y - 12)
        g.quadraticCurveTo(x + 6, y + 4, x, y + 12)
        g.quadraticCurveTo(x - 6, y + 4, x, y - 12)
        g.fill()
      }
  }, 256, 128, [8, 1])

/** Nebulosa: azul noche con nubes violetas y celestes y muchas estrellas. */
const nebula = (glow: boolean) =>
  canvasTex(`nebula:${glow}`, 512, 256, (g, w, h) => {
    g.fillStyle = glow ? '#000000' : '#151a4a'
    g.fillRect(0, 0, w, h)
    const r = rng(11)
    const cloud = (x: number, y: number, rad: number, color: string, a: number) => {
      for (const dx of [-w, 0, w]) {
        const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, rad)
        gr.addColorStop(0, rgba(color, a))
        gr.addColorStop(1, rgba(color, 0))
        g.fillStyle = gr
        g.fillRect(x + dx - rad, y - rad, rad * 2, rad * 2)
      }
    }
    for (let i = 0; i < 9; i++) cloud(r() * w, r() * h, 50 + r() * 70, ['#8a3ad6', '#3a7be0', '#e05aa8', '#46c4d8'][i % 4], glow ? 0.35 : 0.6)
    for (let i = 0; i < 160; i++) {
      const x = r() * w
      const y = r() * h
      const s = r()
      g.fillStyle = s > 0.9 ? '#fff6c8' : '#ffffff'
      g.beginPath()
      g.arc(x, y, s > 0.93 ? 2.6 : 0.6 + s * 1.2, 0, Math.PI * 2)
      g.fill()
      if (s > 0.96) {
        g.fillRect(x - 7, y - 0.8, 14, 1.6)
        g.fillRect(x - 0.8, y - 7, 1.6, 14)
      }
    }
  }, true)

const texCache = new Map<string, THREE.Texture>()
export function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = false) {
  let t = texCache.get(key)
  if (!t) texCache.set(key, (t = canvasTexture(w, h, draw, repeat)))
  return t
}

export const GOLD = '#f2c230'
export const CHROME = '#d9e0ea'

// ---------- Sombreros (cabeza de radio 1, como los comunes) ----------

export const LEGEND_HATS: Record<string, Legend<[THREE.Object3D]>> = {
  /** Sombrero arcano: fieltro estrellado, banda de runas que corren, estrella en la punta y tres cristales que orbitan. */
  arcane: {
    color: '#7a5cff',
    accent: '#5fe3ff',
    build(k, fit) {
      const t = k.t
      const felt = k.lit('#ffffff', '#ffffff', 0.9, wizardFelt(false), wizardFelt(true))
      felt.map!.repeat.set(3, 1)
      // Ala ancha y blanda, que ondula.
      t.local(fit, thickSurface((u, w) => {
        const a = u * Math.PI * 2
        const r = 0.56 + w * 0.74
        return v(Math.sin(a) * r, 0.6 + 0.03 * w - 0.12 * w * w + 0.07 * w * w * Math.sin(3 * a + 0.7), Math.cos(a) * r * 0.95)
      }, 72, 6, 0.05), felt)
      // Copa en cono que se dobla hacia atrás y a un costado.
      const path = [v(0, 0.58, 0), v(0, 1.05, -0.02), v(0.02, 1.5, -0.08), v(0.13, 1.86, -0.22), v(0.32, 2.05, -0.4), v(0.52, 2.06, -0.55)]
      const radius = (u: number) => 0.64 * (1 - u) ** 1.15 * (1 + 0.08 * Math.sin(Math.PI * u))
      const { geo: cone, curve } = taper(path, radius)
      t.local(fit, cone, felt)
      k.rim(fit, cone, '#9b7bff', { power: 1.6, strength: 0.75, grow: 0.09 })
      // Banda dorada con runas celestes que corren alrededor.
      t.local(fit, cylinder(0.6, 0.64, 0.2, 48), M('#e8b923'), { pos: [0, 0.71, 0] })
      const runes = k.own(runeStrip().clone())
      runes.repeat.set(2, 1)
      runes.needsUpdate = true
      const runeMat = k.own(new THREE.MeshBasicMaterial({ map: runes, color: tintHex('#7ff0ff'), transparent: true, depthWrite: false }))
      const ring = k.own(new THREE.CylinderGeometry(0.624, 0.659, 0.15, 48, 1, true).translate(0, 0.71, 0))
      const runeMesh = new THREE.Mesh(ring, runeMat)
      runeMesh.renderOrder = 4
      k.group(fit).add(runeMesh)
      // Gema al frente de la banda.
      const gemMat = k.lit('#7ff0ff', '#3ad8ff', 0.8)
      t.local(fit, gem(0.07, 0.1, 0.05), gemMat, { pos: [0, 0.72, 0.655] }, 0.6)
      const gemGlow = k.sprite(fit, 'soft', '#5fe3ff', 0.42, [0, 0.72, 0.7])
      // Estrella en la punta: flota, gira y destella.
      const tip = curve.getPointAt(1)
      const star = k.group(fit, { pos: [tip.x, tip.y, tip.z] })
      const starMat = k.lit(GOLD, '#ffd84a', 0.55)
      t.local(star, extruded(starShape(5, 0.15, 0.065), 0.05), starMat, { pos: [0.06, 0.12, 0] }, 0.6)
      const flare = k.sprite(star, 'flare', '#ffe27a', 0.75, [0.06, 0.12, -0.02])
      // Tres cristales en órbita inclinada alrededor de la copa.
      const orbit = k.group(fit, { pos: [0, 1.25, -0.05], rot: [0.32, 0, 0.18] })
      const crystals = [0, 1, 2].map((i) => {
        const g = k.group(orbit)
        const color = ['#5fe3ff', '#c48bff', '#ff8be0'][i]
        t.local(g, gem(0.075, 0.15), k.lit(color, color, 0.55), {}, 0.6)
        k.sprite(g, 'soft', color, 0.5, [0, 0, 0], 0.75)
        return g
      })
      const sparks = k.motes(fit, {
        n: 10,
        kind: 'spark',
        colors: ['#ffffff', '#7ff0ff', '#c9b4ff'],
        life: [0.8, 1.5],
        size: [0.2, 0.34],
        from: (r, o) => {
          const a = r(1) * Math.PI * 2
          const d = 0.75 + 0.5 * r(2)
          o.set(Math.sin(a) * d, 0.75 + 1.3 * r(3), Math.cos(a) * d * 0.8)
        },
        vel: (r, o) => o.set(0, 0.1 + 0.15 * r(4), 0),
        twinkle: 0.5,
        spin: 1.5,
      }, 5)
      k.tick((time) => {
        // Estrellas del fieltro que titilan, runas que corren y gema que late.
        felt.emissiveIntensity = 0.75 + 0.35 * Math.sin(time * 3.1) ** 2
        runes.offset.x = -time * 0.08
        runeMat.opacity = 0.75 + 0.25 * Math.sin(time * 4)
        gemMat.emissiveIntensity = 0.6 + 0.4 * Math.sin(time * 4)
        gemGlow.material.opacity = 0.55 + 0.35 * Math.sin(time * 4)
        star.position.set(tip.x, tip.y + 0.04 * Math.sin(time * 2.2), tip.z)
        star.rotation.set(0, time * 1.6, 0.15 * Math.sin(time * 2.2))
        flare.material.rotation = time * 0.6
        flare.scale.setScalar(0.65 + 0.2 * Math.sin(time * 5) ** 2)
        orbit.rotation.y = time * 1.1
        crystals.forEach((g, i) => {
          const a = (i / 3) * Math.PI * 2
          g.position.set(Math.sin(a) * 0.98, 0.06 * Math.sin(time * 2.5 + i * 2), Math.cos(a) * 0.98)
          g.rotation.set(0.2, time * 2.4 + i, 0.15)
        })
        sparks.update(time)
      })
    },
  },
  /** Corona del fénix: aro de oro con gema de fuego y un penacho de llamas vivas que sueltan brasas. */
  phoenix: {
    color: '#ff7a1a',
    accent: '#ffd84a',
    build(k, fit) {
      const t = k.t
      const gold = k.lit(GOLD, '#ff9a1a', 0.18)
      const R = 0.77
      // Aro con un pico al frente y alas de oro que suben hacia atrás.
      t.local(fit, thickSurface((u, w) => {
        const a = u * Math.PI * 2
        const front = Math.max(0, Math.cos(a)) ** 8 * 0.3
        const top = 0.2 + front
        return v(Math.sin(a) * (R + 0.03 * w), 0.57 + w * top, Math.cos(a) * (R + 0.03 * w))
      }, 120, 6, 0.06), gold)
      t.local(fit, torus(R + 0.015, 0.035, 64), M('#d4901a'), { pos: [0, 0.58, 0], rot: [Math.PI / 2, 0, 0] })
      t.local(fit, torus(R + 0.015, 0.025, 64), M('#d4901a'), { pos: [0, 0.77, 0], rot: [Math.PI / 2, 0, 0] }, 0.7)
      // Gema de fuego al frente y dos de ámbar a los costados.
      const fire = k.lit('#ff5a2a', '#ff3b0f', 0.8)
      t.local(fit, gem(0.11, 0.16, 0.06), fire, { pos: [0, 0.79, R + 0.045] }, 0.6)
      const fireGlow = k.sprite(fit, 'soft', '#ff6a1f', 0.6, [0, 0.79, R + 0.1])
      k.rim(fit, sphere(0.13, 20, 14), '#ff7a1a', { power: 1.4, strength: 0.7, grow: 0.06 }, { pos: [0, 0.79, R + 0.04], scale: [1, 1.3, 0.6] })
      for (const s of [1, -1]) {
        const a = s * 0.85
        t.local(fit, sphere(1, 14, 10), k.lit('#ffb02e', '#ff9a1a', 0.5), { pos: [Math.sin(a) * (R + 0.04), 0.68, Math.cos(a) * (R + 0.04)], rot: [0, a, 0], scale: [0.06, 0.06, 0.03] }, 0.6)
      }
      // Llamas: penacho que se abre hacia atrás y dos alitas de fuego a los costados.
      const flameTex = flameTexture('#ff3b0f', '#ff9a1a', '#fff2a8')
      const fireMat = k.lit('#ffffff', '#ffffff', 0.85, flameTex, flameTex)
      const plumes: { g: THREE.Group; rx: number; rz: number; i: number }[] = []
      const crest: [number, number, number, number, number][] = [
        // [rot x (atrás), rot z, alto, gordura, curva]
        [-0.05, 0, 1.15, 1.25, 0.35],
        [-0.55, 0.32, 0.95, 1.1, 0.3],
        [-0.55, -0.32, 0.95, 1.1, 0.3],
        [-1.0, 0.18, 0.85, 1.0, 0.25],
        [-1.0, -0.18, 0.85, 1.0, 0.25],
      ]
      crest.forEach(([rx, rz, h, fat, bend], i) => {
        const g = k.group(fit, { pos: [0, 0.72, -0.05] })
        t.local(g, flame(bend, fat), fireMat, { scale: [h * 0.9, h, h * 0.9] }, 0.55)
        plumes.push({ g, rx, rz, i })
      })
      for (const s of [1, -1]) {
        const g = k.group(fit, { pos: [s * 0.74, 0.66, -0.12] })
        t.local(g, flame(0.4, 1.05), fireMat, { scale: 0.62 }, 0.55)
        plumes.push({ g, rx: -0.75, rz: -s * 1.05, i: plumes.length })
      }
      const halo = k.sprite(fit, 'soft', '#ff8a1f', 2.0, [0, 1.25, -0.45], 0.45, 0)
      const embers = k.motes(fit, {
        n: 14,
        kind: 'ember',
        colors: ['#ff7a1a', '#ffc23a', '#ff4d1f'],
        life: [0.7, 1.3],
        size: [0.12, 0.22],
        from: (r, o) => o.set((r(1) - 0.5) * 0.9, 1.0 + r(2) * 0.6, -0.15 - r(3) * 0.6),
        vel: (r, o) => o.set((r(4) - 0.5) * 0.4, 0, (r(5) - 0.5) * 0.3),
        rise: 1.5,
        grow: 0.3,
      }, 9)
      k.tick((time) => {
        for (const p of plumes) {
          const f = time * 9 + p.i * 1.7
          p.g.rotation.set(p.rx + 0.06 * Math.sin(f * 0.6), 0, p.rz + 0.08 * Math.sin(time * 4.3 + p.i))
          p.g.scale.set(1 - 0.05 * Math.sin(f), 1 + 0.1 * Math.sin(f) + 0.05 * Math.sin(f * 2.7), 1 - 0.05 * Math.sin(f))
        }
        fireMat.emissiveIntensity = 0.8 + 0.12 * Math.sin(time * 13)
        fire.emissiveIntensity = 0.7 + 0.35 * Math.sin(time * 3.5)
        fireGlow.material.opacity = 0.6 + 0.3 * Math.sin(time * 3.5)
        halo.material.opacity = 0.38 + 0.1 * Math.sin(time * 7)
        embers.update(time)
      })
    },
  },
}

/** Altura de asiento e inclinación de los sombreros legendarios (como los comunes). */
export const LEGEND_SEAT: Record<string, Partial<Record<PetRig['kind'], [number, number]>>> = {
  arcane: { hen: [0.15, 0.12], chick: [0.15, 0.1], egg: [0.1, 0.06] },
  phoenix: { hen: [0.1, 0.1], chick: [0.08, 0.08], egg: [0.06, 0.04] },
}

// ---------- Botas del pollito ----------

/** Posición en el pie del pollito (igual que las botas comunes). */
export const chickP = (i: number) => {
  const s = i % 2 ? -1 : 1
  return (x: number, y: number, z: number): V3 => [s * 0.14 + x, y, 0.17 + z]
}

export const LEGEND_BOOTS: Record<string, Legend<[number]>> = {
  /** Botas cohete: blancas y rojas, con aletas, ojo de buey que brilla y propulsor que se enciende al saltar. */
  rocket: {
    color: '#ff5a2a',
    accent: '#5fe3ff',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const s = i % 2 ? -1 : 1
      const P = chickP(i)
      const white = M('#f6f4ef')
      const red = M('#e8453c')
      t.model(foot, cylinder(0.066, 0.074, 0.14, 24), white, { pos: P(0, 0.1, -0.02) })
      t.model(foot, sphere(1, 28, 18), white, { pos: P(0, 0.056, 0.08), scale: [0.092, 0.076, 0.13] })
      t.model(foot, cylinder(1, 1, 1, 28), red, { pos: P(0, 0.012, 0.075), scale: [0.098, 0.024, 0.142] })
      t.model(foot, sphere(1, 24, 14), red, { pos: P(0, 0.038, 0.15), scale: [0.078, 0.044, 0.068] }, 0.6)
      // Franja roja y remaches.
      t.model(foot, sphere(1, 28, 10), red, { pos: P(0, 0.07, 0.07), scale: [0.094, 0.012, 0.128] }, 0)
      // Ojo de buey: aro cromado y vidrio que brilla.
      const glass = k.lit('#7ff0ff', '#3ad8ff', 0.8)
      const rot: V3 = [-1.0, 0, 0]
      t.model(foot, torus(0.03, 0.009, 24), M(CHROME), { pos: P(0, 0.112, 0.11), rot }, 0.6)
      t.model(foot, sphere(1, 16, 10), glass, { pos: P(0, 0.112, 0.11), rot, scale: [0.028, 0.028, 0.012] }, 0)
      const port = k.sprite(k.mount(foot, { pos: P(0, 0.12, 0.125) }), 'soft', '#5fe3ff', 0.13, [0, 0, 0], 0.8)
      // Aleta al costado de afuera.
      const fin = new THREE.Shape()
      fin.moveTo(0, 0)
      fin.lineTo(0.085, 0)
      fin.quadraticCurveTo(0.02, 0.03, -0.01, 0.09)
      fin.closePath()
      t.model(foot, extruded(fin, 0.01, 0.004), red, { pos: P(s * 0.09, 0.03, -0.01), rot: [0, (s * Math.PI) / 2, 0] }, 0.7)
      // Propulsor cromado al costado, apuntando abajo y afuera.
      const tilt = s * 0.55
      const nozzle: V3 = P(s * 0.098, 0.075, 0.03)
      t.model(foot, cylinder(0.024, 0.034, 0.05, 20), M(CHROME), { pos: nozzle, rot: [0, 0, tilt] }, 0.7)
      t.model(foot, torus(0.026, 0.008, 20), M('#8a96a8'), { pos: nozzle, rot: [Math.PI / 2, 0, tilt] }, 0.5)
      const jet = k.mount(foot, { pos: [nozzle[0] + Math.sin(tilt) * 0.03, nozzle[1] - Math.cos(tilt) * 0.03, nozzle[2]], rot: [0, 0, tilt] })
      const flameTex = flameTexture('#fffbe0', '#ffb02e', '#ff4d1f')
      const jetMat = k.lit('#ffffff', '#ffffff', 0.95, flameTex, flameTex)
      const fl = k.group(jet, { rot: [Math.PI, 0, 0] })
      k.t.local(fl, flame(0, 0.95), jetMat, { scale: [0.17, 0.2, 0.17] }, 0.4)
      const jetGlow = k.sprite(jet, 'ember', '#ff9a1a', 0.12, [0, -0.04, 0])
      const smoke = k.motes(jet, {
        n: 7,
        kind: 'smoke',
        colors: ['#ffffff', '#ececec'],
        life: [0.7, 1.1],
        size: [0.05, 0.08],
        from: (r, o) => o.set((r(1) - 0.5) * 0.02, -0.06, (r(2) - 0.5) * 0.02),
        vel: (r, o) => o.set((r(3) - 0.5) * 0.08, -0.12, (r(4) - 0.5) * 0.08),
        rise: 0.18,
        grow: 2.6,
        opacity: 0.7,
        order: 4,
      }, 31 + i)
      const sparks = k.motes(jet, {
        n: 6,
        kind: 'ember',
        colors: ['#ffd84a', '#ff7a1a'],
        life: [0.25, 0.45],
        size: [0.03, 0.05],
        from: (r, o) => o.set(0, -0.05, 0),
        vel: (r, o) => o.set((r(1) - 0.5) * 0.4, -0.5 - r(2) * 0.3, (r(3) - 0.5) * 0.4),
      }, 41 + i)
      k.tick((time, f) => {
        // En el piso: llama piloto que titila. Al saltar: chorro largo y chispas.
        const boost = Math.min(1, f.jump / 0.04)
        const flick = 1 + 0.18 * Math.sin(time * 31 + i * 2) + 0.1 * Math.sin(time * 53)
        const len = (0.35 + 1.2 * boost) * flick
        fl.scale.set(0.7 + 0.5 * boost, len, 0.7 + 0.5 * boost)
        jetGlow.scale.setScalar(0.1 + 0.12 * boost)
        jetMat.emissiveIntensity = 0.85 + 0.15 * boost
        glass.emissiveIntensity = 0.6 + 0.3 * Math.sin(time * 3 + i)
        port.material.opacity = 0.55 + 0.3 * Math.sin(time * 3 + i)
        smoke.update(time, 0.45 + 0.55 * boost)
        sparks.update(time, boost)
      })
    },
  },
  /** Botas de cristal: hielo facetado con destellos tornasolados, cristales que brotan y un diamante en la punta. */
  crystal: {
    color: '#7fd8ff',
    accent: '#e3b8ff',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const s = i % 2 ? -1 : 1
      const P = chickP(i)
      const ice = k.lit('#c9efff', '#8fdcff', 0.22)
      const deep = k.lit('#7cc4ef', '#6fb8ff', 0.2)
      t.model(foot, facet(cylinder(0.068, 0.076, 0.14, 7)), ice, { pos: P(0, 0.1, -0.02) })
      t.model(foot, facet(sphere(1, 9, 6)), ice, { pos: P(0, 0.058, 0.08), scale: [0.094, 0.08, 0.135] })
      t.model(foot, facet(cylinder(1, 1, 1, 9)), deep, { pos: P(0, 0.012, 0.075), scale: [0.1, 0.024, 0.145] })
      t.model(foot, facet(sphere(1, 8, 5)), deep, { pos: P(0, 0.038, 0.152), scale: [0.078, 0.042, 0.066] }, 0.6)
      // Cristales que brotan de arriba de la bota, abiertos hacia afuera.
      const shards: [number, number, number, number, number][] = [
        [0.05, 0.115, 0.04, 0.5, 0.06],
        [-0.04, 0.12, 0.02, -0.45, 0.05],
        [0.075, 0.09, 0.1, 0.9, 0.04],
        [0.0, 0.125, -0.02, 0.1, 0.055],
      ]
      for (const [x, y, z, rz, h] of shards)
        t.model(foot, gem(0.018, h, 0.018), k.lit('#e8f8ff', '#b8ecff', 0.4), { pos: P(s * x, y + h * 0.5, z), rot: [0.25, 0, -s * rz] }, 0.5)
      // Diamante en la punta.
      const diamond = k.lit('#ffffff', '#cfe9ff', 0.7)
      t.model(foot, gem(0.028, 0.036, 0.022), diamond, { pos: P(0, 0.1, 0.18), rot: [-0.7, 0, 0] }, 0.5)
      const glint = k.sprite(k.mount(foot, { pos: P(0, 0.11, 0.2) }), 'spark', '#bfe8ff', 0.16)
      const here = k.mount(foot, { pos: P(0, 0, 0.08) })
      const frost = k.motes(here, {
        n: 6,
        kind: 'spark',
        colors: ['#ffffff', '#bfe8ff', '#e3b8ff'],
        life: [0.7, 1.2],
        size: [0.05, 0.08],
        from: (r, o) => o.set((r(1) - 0.5) * 0.24, 0.02 + r(2) * 0.15, (r(3) - 0.3) * 0.22),
        twinkle: 0.6,
        spin: 2,
      }, 51 + i)
      const mist = k.motes(here, {
        n: 5,
        kind: 'smoke',
        colors: ['#e6f7ff'],
        life: [1.4, 2.0],
        size: [0.06, 0.09],
        from: (r, o) => o.set((r(1) - 0.5) * 0.2, 0.01, (r(2) - 0.3) * 0.2),
        vel: (r, o) => o.set((r(3) - 0.5) * 0.06, 0, (r(4) - 0.5) * 0.06),
        rise: 0.03,
        grow: 2,
        opacity: 0.55,
        order: 4,
      }, 61 + i)
      const c = new THREE.Color()
      k.tick((time) => {
        // Tornasol: el brillo recorre celeste, lila y rosa.
        c.setHSL(0.55 + 0.15 * Math.sin(time * 0.9 + i), 0.85, 0.65)
        ice.emissive.copy(c)
        ice.emissiveIntensity = 0.22 + 0.08 * Math.sin(time * 2.1)
        deep.emissive.copy(c)
        diamond.emissiveIntensity = 0.6 + 0.4 * Math.sin(time * 5 + i) ** 2
        const tw = Math.max(0, Math.sin(time * 2.2 + i * 1.3)) ** 6
        glint.scale.setScalar(0.06 + 0.16 * tw)
        glint.material.rotation = time
        frost.update(time)
        mist.update(time)
      })
    },
  },
}

// ---------- Ropa de la gallina ----------

export const LEGEND_OUTFITS: Record<string, Legend<[]>> = {
  /** Manto real: terciopelo con flores de lis, armiño, cadena de oro y un broche con gema viva. */
  royal: {
    color: '#b46bff',
    accent: GOLD,
    build(k) {
      const { t, rig } = k
      const body = rig.joints.body!
      const vel = velvet()
      // Manto: nace en los hombros, cubre la espalda y cae amplio, abriéndose hacia abajo.
      const mantle = (u: number, w: number, extra = 0) => {
        const az = Math.PI + (u - 0.5) * 2 * 2.15
        const top = tdir(az, NECK + 0.12)
        const hem = v(Math.sin(az) * 1.05, -0.32 - 0.04 * Math.cos(u * Math.PI * 7) ** 2, Math.cos(az)).normalize()
        return onTorso(top.lerp(hem, w).normalize(), 0.03 + 0.085 * w * w + extra)
      }
      t.model(body, thickSurface((u, w) => mantle(u, w), 110, 20, 0.016), vel)
      // Ruedo de armiño y galón dorado.
      const hem = Array.from({ length: 60 }, (_, j) => mantle(j / 59, 1, 0.012))
      t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem), 120, 0.03, 10), ermine())
      const trim = Array.from({ length: 60 }, (_, j) => mantle(j / 59, 0.9, 0.022))
      const goldLit = k.lit(GOLD, '#ffb020', 0.2)
      t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trim), 120, 0.009, 8), goldLit, {}, 0.5)
      // Esclavina de armiño sobre los hombros.
      t.model(body, thickSurface((u, w) => at(Math.PI + (u - 0.5) * 2 * 2.75, NECK - 0.02 + 0.3 * w, 0.045 + 0.02 * w), 80, 6, 0.02), ermine())
      t.model(body, band(NECK - 0.01, 0.05, 0.028), ermine(), {}, 0.8)
      // Cadena de oro de hombro a hombro y broche con gema.
      const a = at(0.95, NECK + 0.3, 0.05)
      const b = at(-0.95, NECK + 0.3, 0.05)
      const mid = at(0, NECK + 0.38, 0.06)
      const chain = new THREE.CatmullRomCurve3([a, at(0.5, NECK + 0.36, 0.055), mid, at(-0.5, NECK + 0.36, 0.055), b])
      for (let j = 0; j <= 18; j++) {
        const p = chain.getPointAt(j / 18)
        const tan = chain.getTangentAt(j / 18)
        const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(v(1, 0, 0), tan))
        t.model(body, torus(0.012, 0.004, 12), M(GOLD), { pos: [p.x, p.y, p.z], rot: [e.x + (j % 2) * Math.PI / 2, e.y, e.z] }, 0.3)
      }
      const n = at(0, NECK + 0.38, 0.1).sub(at(0, NECK + 0.38, 0)).normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), n)
      const e = new THREE.Euler().setFromQuaternion(q)
      const bp = mid.clone().addScaledVector(n, 0.012)
      t.model(body, extruded(starShape(8, 0.05, 0.036), 0.014), goldLit, { pos: [bp.x, bp.y, bp.z], rot: [e.x, e.y, e.z] }, 0.6)
      const jewel = k.lit('#c04bff', '#b030ff', 0.8)
      const jp = mid.clone().addScaledVector(n, 0.03)
      t.model(body, gem(0.026, 0.032, 0.016), jewel, { pos: [jp.x, jp.y, jp.z], rot: [e.x, e.y, e.z] }, 0.5)
      const brooch = k.mount(body, { pos: [jp.x + n.x * 0.02, jp.y + n.y * 0.02, jp.z + n.z * 0.02] })
      const bGlow = k.sprite(brooch, 'flare', '#d58bff', 0.2)
      // Brillitos dorados sobre el manto.
      const spots = Array.from({ length: 40 }, (_, j) => mantle(((j * 37) % 40) / 40, 0.2 + 0.75 * (((j * 13) % 40) / 40), 0.03))
      const glitterRoot = k.mount(body)
      const glitter = k.motes(glitterRoot, {
        n: 9,
        kind: 'spark',
        colors: ['#fff3a8', '#ffffff', '#ffd84a'],
        life: [0.6, 1.1],
        size: [0.05, 0.09],
        from: (r, o) => o.copy(spots[Math.floor(r(1) * spots.length)]),
        twinkle: 0.4,
        spin: 1.5,
      }, 71)
      k.tick((time) => {
        jewel.emissiveIntensity = 0.65 + 0.35 * Math.sin(time * 3)
        bGlow.material.opacity = 0.7 + 0.3 * Math.sin(time * 3)
        bGlow.material.rotation = time * 0.5
        bGlow.scale.setScalar(0.17 + 0.05 * Math.sin(time * 3))
        goldLit.emissiveIntensity = 0.15 + 0.15 * Math.sin(time * 2) ** 2
        glitter.update(time)
      })
    },
  },
  /** Vestido galaxia: tela de nebulosa que fluye y brilla, falda larga, anillo de astros y broche de luna. */
  galaxy: {
    color: '#6a5cff',
    accent: '#ff8be0',
    build(k) {
      const { t, rig } = k
      const body = rig.joints.body!
      const map = k.own(nebula(false).clone())
      const emap = k.own(nebula(true).clone())
      for (const x of [map, emap]) {
        x.repeat.set(2, 1)
        x.needsUpdate = true
      }
      const cloth = k.lit('#ffffff', '#ffffff', 0.55, map, emap)
      // Corpiño: del cuello baja hasta pasar la cintura en todo el contorno (también en la
      // espalda, donde el eje del cuello inclinado dejaba el lomo al aire).
      const waist = -0.3
      const bodice = (u: number, w: number) => {
        const az = (u - 0.5) * Math.PI * 2
        const d0 = tdir(az, NECK + 0.05)
        const el = waist - 0.06
        const d1 = v(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
        return onTorso(d0.lerp(d1, w).normalize(), 0.012)
      }
      t.model(body, thickSurface(bodice, 96, 18, 0.01), cloth)
      // Falda larga que cae derecha y se abre en ondas suaves.
      const skirt = (u: number, w: number, extra = 0) => {
        const az = (u - 0.5) * Math.PI * 2
        const top = atH(az, waist, 0.014)
        const out = v(Math.sin(az), 0, Math.cos(az) * 1.05)
        const wave = 0.022 * Math.sin(az * 9) * w
        return top.addScaledVector(out, 0.03 * w + 0.07 * w * w + wave + extra).add(v(0, -0.19 * w, 0))
      }
      t.model(body, thickSurface((u, w) => skirt(u, w), 110, 10, 0.012), cloth)
      // Ruedo de luz y cinturón plateado.
      const hemPts = Array.from({ length: 96 }, (_, j) => skirt(j / 96, 1, 0.006))
      const hemMat = k.lit('#e9e4ff', '#b9a8ff', 0.6)
      t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPts, true), 192, 0.011, 8, true), hemMat, {}, 0.6)
      const belt = Array.from({ length: 48 }, (_, j) => atH((j / 48) * Math.PI * 2, waist, 0.02))
      t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(belt, true), 96, 0.014, 8, true), M('#dfe6f5'), {}, 0.7)
      t.model(body, band(NECK + 0.06, 0.02, 0.018), hemMat, {}, 0.7)
      // Broche de luna en el pecho.
      const mp = at(0, NECK + 0.32, 0.03)
      const mn = at(0, NECK + 0.32, 0.1).sub(at(0, NECK + 0.32, 0)).normalize()
      const me = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), mn))
      const moon = k.lit('#fff3c4', '#ffe27a', 0.6)
      t.model(body, extruded(crescent(0.04), 0.012), moon, { pos: [mp.x, mp.y, mp.z], rot: [me.x, me.y, me.z + 0.4] }, 0.6)
      const moonGlow = k.sprite(k.mount(body, { pos: [mp.x + mn.x * 0.02, mp.y + mn.y * 0.02, mp.z + mn.z * 0.02] }), 'soft', '#fff0a8', 0.16, [0, 0, 0], 0.7)
      for (const s of [1, -1]) sleeve(t, rig, s, cloth, hemMat, 0.34, 1.3)
      // Anillo de astros que orbitan la cintura.
      let cx = 0
      let cy = 0
      let cz = 0
      let rad = 0
      for (let j = 0; j < 24; j++) {
        const p = atH((j / 24) * Math.PI * 2, waist, 0)
        cx += p.x / 24
        cy += p.y / 24
        cz += p.z / 24
      }
      for (let j = 0; j < 24; j++) rad = Math.max(rad, Math.hypot(atH((j / 24) * Math.PI * 2, waist, 0).x - cx, atH((j / 24) * Math.PI * 2, waist, 0).z - cz))
      const ring = k.mount(body, { pos: [cx, cy - 0.06, cz], rot: [0.18, 0, -0.08] })
      const orbs = ['#ff8be0', '#7ff0ff', '#fff3a8', '#b9a8ff', '#7fffc4'].map((color, j) => {
        const g = k.group(ring)
        t.local(g, sphere(1, 16, 12), k.lit(color, color, 0.75), { scale: 0.018 }, 0.4)
        k.sprite(g, 'soft', color, 0.11, [0, 0, 0], 0.85)
        return { g, j }
      })
      const R = rad + 0.11
      const dustRoot = k.mount(body)
      const dust = k.motes(dustRoot, {
        n: 12,
        kind: 'spark',
        colors: ['#ffffff', '#ff8be0', '#7ff0ff', '#fff3a8'],
        life: [0.9, 1.6],
        size: [0.04, 0.075],
        from: (r, o) => o.copy(skirt(r(1), 0.3 + 0.7 * r(2), 0.02)),
        vel: (r, o) => o.set((r(3) - 0.5) * 0.03, -0.05 - 0.04 * r(4), (r(5) - 0.5) * 0.03),
        twinkle: 0.5,
        spin: 2,
      }, 81)
      k.tick((time) => {
        // La tela fluye despacio y las estrellas titilan.
        map.offset.x = emap.offset.x = time * 0.015
        map.offset.y = emap.offset.y = Math.sin(time * 0.3) * 0.03
        cloth.emissiveIntensity = 0.5 + 0.15 * Math.sin(time * 2.6)
        hemMat.emissiveIntensity = 0.5 + 0.25 * Math.sin(time * 2)
        moon.emissiveIntensity = 0.5 + 0.2 * Math.sin(time * 1.7)
        moonGlow.material.opacity = 0.55 + 0.25 * Math.sin(time * 1.7)
        ring.rotation.y = 0
        for (const { g, j } of orbs) {
          const a = time * 0.9 + (j / orbs.length) * Math.PI * 2
          g.position.set(Math.sin(a) * R, 0.012 * Math.sin(time * 3 + j * 2), Math.cos(a) * R * 1.05)
        }
        dust.update(time)
      })
    },
  },
}

// ---------- Zapatos de la gallina ----------

export const henP = (i: number) => {
  const fx = (i % 2 ? -1 : 1) * HEN.feet.x
  return (x: number, y: number, z: number): V3 => [fx + x, y, HEN.feet.z + z]
}

/** Base de zapato de gallina (suela, capellada, talón y boca). */
export function henShoeBase(k: Kit, i: number, upper: THREE.Material, sole: THREE.Material) {
  const { t, rig } = k
  const foot = rig.sockets.feet[i]
  const P = henP(i)
  t.model(foot, cylinder(1, 1, 1, 28), sole, { pos: P(0, 0.008, 0.025), scale: [0.06, 0.016, 0.114] })
  t.model(foot, sphere(1, 28, 18), upper, { pos: P(0, 0.033, 0.05), scale: [0.055, 0.04, 0.086] })
  t.model(foot, sphere(1, 24, 16), upper, { pos: P(0, 0.042, -0.025), scale: [0.051, 0.046, 0.05] })
  t.model(foot, cylinder(1, 1, 1, 20), M('#3a2416'), { pos: P(0, 0.074, -0.01), scale: [0.03, 0.006, 0.034] }, 0)
}

export const LEGEND_SHOES: Record<string, Legend<[number]>> = {
  /** Zapatos alados: de oro, con alitas blancas en los tobillos que aletean. */
  winged: {
    color: '#ffd84a',
    accent: '#ffffff',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const P = henP(i)
      const s = i % 2 ? -1 : 1
      const gold = k.lit(GOLD, '#ffb020', 0.25)
      henShoeBase(k, i, gold, M('#c98e12'))
      t.model(foot, torus(1, 0.14, 24), M('#fff6e0'), { pos: P(0, 0.06, -0.02), rot: [Math.PI / 2, 0, 0], scale: [0.05, 0.05, 0.03] }, 0.5)
      // Alita: tres plumas en abanico, en un grupo que aletea.
      const wing = k.mount(foot, { pos: P(s * 0.05, 0.06, -0.025) })
      const feather = (len: number) => {
        const sh = new THREE.Shape()
        sh.moveTo(0, 0)
        sh.quadraticCurveTo(len * 0.5, 0.022, len, 0.004)
        sh.quadraticCurveTo(len * 0.55, -0.012, 0, 0)
        return extruded(sh, 0.006, 0.002)
      }
      const fm = M('#ffffff')
      ;[[0.09, 0.55], [0.075, 0.25], [0.06, -0.05]].forEach(([len, a]) => t.local(wing, feather(len), fm, { rot: [0, s > 0 ? 0 : Math.PI, a] }, 0.5))
      const shine = k.sprite(wing, 'spark', '#fff3a8', 0.08, [s * 0.04, 0.03, 0])
      k.tick((time) => {
        // Aletea rápido unos instantes y descansa.
        const beat = (time * 1.3 + i * 0.4) % 2
        const flap = beat < 0.8 ? Math.sin(beat * Math.PI * 7.5) : 0.2 * Math.sin(time * 2)
        wing.rotation.set(0, s * (0.3 + 0.55 * flap), 0)
        shine.material.opacity = 0.5 + 0.5 * Math.sin(time * 4 + i)
        shine.material.rotation = time * 1.4
        gold.emissiveIntensity = 0.2 + 0.12 * Math.sin(time * 2.5)
      })
    },
  },
  /** Zapatillas cometa: azul noche con suela de neón que cambia de color y una estela de chispas. */
  comet: {
    color: '#3ad8ff',
    accent: '#ff5ad1',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const P = henP(i)
      const neon = k.lit('#7ff0ff', '#3ad8ff', 0.95)
      henShoeBase(k, i, M('#1e2a5a'), neon)
      // Rayo de neón al costado y cordones claros.
      for (const s of [1, -1]) {
        const bolt = new THREE.Shape()
        bolt.moveTo(-0.03, 0.012)
        bolt.lineTo(0.0, 0.004)
        bolt.lineTo(-0.004, -0.004)
        bolt.lineTo(0.03, -0.012)
        bolt.lineTo(0.004, 0.0)
        bolt.lineTo(0.008, 0.008)
        bolt.closePath()
        t.model(foot, extruded(bolt, 0.004, 0.0015), neon, { pos: P(s * 0.054, 0.034, 0.03), rot: [0, (s * Math.PI) / 2, 0] }, 0.3)
      }
      for (const j of [0, 1, 2]) t.model(foot, cylinder(0.005, 0.005, 0.048, 8), M('#ffffff'), { pos: P(0, 0.066 - j * 0.008, 0.035 + j * 0.02), rot: [0.9, 0, Math.PI / 2] }, 0.3)
      const tail = k.mount(foot, { pos: P(0, 0.02, -0.06) })
      const trail = k.motes(tail, {
        n: 9,
        kind: 'spark',
        colors: ['#7ff0ff', '#ff8be0', '#ffffff'],
        life: [0.35, 0.6],
        size: [0.03, 0.06],
        from: (r, o) => o.set((r(1) - 0.5) * 0.06, r(2) * 0.04, 0),
        vel: (r, o) => o.set((r(3) - 0.5) * 0.05, 0.03, -0.25 - 0.2 * r(4)),
        twinkle: 0.4,
        spin: 3,
      }, 91 + i)
      const c = new THREE.Color()
      k.tick((time) => {
        c.setHSL((time * 0.12 + i * 0.1) % 1, 1, 0.6)
        neon.color.copy(c)
        neon.emissive.copy(c)
        trail.update(time)
      })
    },
  },
}

/** Primera colección legendaria, por espacio (la completa está en legend2.ts). */
export const LEGENDS_1 = { hat: LEGEND_HATS, boots: LEGEND_BOOTS, outfit: LEGEND_OUTFITS, shoes: LEGEND_SHOES }
