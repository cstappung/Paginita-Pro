import * as THREE from 'three'
import { cylinder, extruded, rng, sphere, thickSurface, torus, type V3 } from './rig/kit'
import { rgba } from './glow'
import { CHROME, GOLD, LEGENDS_1, LEGEND_SEAT as SEAT_1, canvasTex, chickP, facet, gem, henP, henShoeBase, type Kit, type Legend } from './legend'
import { M, NECK, at, atH, band, bow, onTorso, sleeve, tdir, v } from './tailor'
import { tintHex } from './tint'

// Segunda colección legendaria: tres más por clase (sombreros, botas del pollito, ropa y zapatos
// de la gallina). Mismas reglas que la primera: piezas con luz propia, partes que se mueven solas
// y chispas, todo función del reloj (el estudio puede saltar a cualquier instante).

// ---------- Formas ----------

/** Pluma: gota alargada a lo largo de +x. */
function plume(len: number, w: number, depth: number) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.quadraticCurveTo(len * 0.45, w, len, w * 0.15)
  s.quadraticCurveTo(len * 0.5, -w * 0.6, 0, 0)
  return extruded(s, depth, depth * 0.4)
}

/** Hoja: nace en el origen y apunta a +y. */
function leaf(len: number, w: number, depth: number) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.quadraticCurveTo(w, len * 0.45, 0, len)
  s.quadraticCurveTo(-w, len * 0.45, 0, 0)
  return extruded(s, depth, depth * 0.4)
}

/** Rayo en zigzag de alto `h`, centrado. */
function bolt(h: number, depth: number) {
  const pts: [number, number][] = [[0.12, 0.5], [-0.22, 0.02], [0.02, 0.02], [-0.12, -0.5], [0.24, 0.08], [0, 0.08], [0.2, 0.5]]
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x * h, y * h) : s.moveTo(x * h, y * h)))
  s.closePath()
  return extruded(s, depth, depth * 0.3)
}

/** Escudo (emblema del pecho). */
function shield(w: number, h: number, depth: number) {
  const s = new THREE.Shape()
  s.moveTo(-w, h * 0.5)
  s.lineTo(w, h * 0.5)
  s.lineTo(w, 0)
  s.quadraticCurveTo(w * 0.9, -h * 0.35, 0, -h * 0.5)
  s.quadraticCurveTo(-w * 0.9, -h * 0.35, -w, 0)
  s.closePath()
  return extruded(s, depth, depth * 0.35)
}

/** Ala de hada (lóbulo redondeado) a lo largo de +x; `down` = el ala de abajo, más chica y caída. */
function fairyWing(down: boolean) {
  const s = new THREE.Shape()
  if (!down) {
    s.moveTo(0, 0)
    s.bezierCurveTo(0.06, 0.3, 0.36, 0.42, 0.42, 0.24)
    s.bezierCurveTo(0.46, 0.08, 0.2, -0.02, 0, 0)
  } else {
    s.moveTo(0, 0)
    s.bezierCurveTo(0.2, 0.02, 0.32, -0.12, 0.26, -0.24)
    s.bezierCurveTo(0.18, -0.34, 0.04, -0.16, 0, 0)
  }
  return extruded(s, 0.004, 0.002)
}

/** Orientación (para `Place.rot`) de una pieza plana que mira hacia la normal `n`. */
function facing(n: THREE.Vector3, spin = 0): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), n.clone().normalize())
  q.multiply(new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), spin))
  const e = new THREE.Euler().setFromQuaternion(q)
  return [e.x, e.y, e.z]
}

/** Normal del torso de la gallina en un punto (por azimut y ángulo desde el cuello). */
const torsoNormal = (a: number, th: number) => at(a, th, 0.1).sub(at(a, th, 0)).normalize()

// ---------- Texturas ----------

/** Roca volcánica con grietas; `glow` = solo las grietas (mapa emisivo que late). */
const lavaRock = (glow: boolean) =>
  canvasTex(`lava:${glow}`, 128, 128, (g, w, h) => {
    g.fillStyle = glow ? '#000000' : '#33201c'
    g.fillRect(0, 0, w, h)
    const r = rng(17)
    if (!glow)
      for (let i = 0; i < 40; i++) {
        g.fillStyle = rgba(r() < 0.5 ? '#4a2e27' : '#22140f', 0.6)
        g.beginPath()
        g.arc(r() * w, r() * h, 4 + r() * 10, 0, Math.PI * 2)
        g.fill()
      }
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (let i = 0; i < 9; i++) {
      let x = r() * w
      let y = r() * h
      g.strokeStyle = glow ? '#ffd27a' : '#ff6a1a'
      g.lineWidth = glow ? 3.5 : 2.5
      g.beginPath()
      g.moveTo(x, y)
      for (let j = 0; j < 5; j++) {
        x += (r() - 0.5) * 40
        y += (r() - 0.3) * 30
        g.lineTo(x, y)
      }
      g.stroke()
    }
  }, true)

/** Franjas del arcoíris (horizontales, para que suban por la bota). */
const rainbowStripes = () =>
  canvasTex('rainbow', 16, 128, (g, w, h) => {
    const cols = ['#ff5a5a', '#ff9a3d', '#ffe14a', '#6fdc6a', '#4fb3ff', '#9a7bff']
    cols.forEach((c, i) => {
      g.fillStyle = c
      g.fillRect(0, (i / cols.length) * h, w, h / cols.length + 1)
    })
  }, true)

/** Azul tormenta con una franja amarilla en zigzag (botas relámpago). */
const thunderStripe = () =>
  canvasTex('thunder-navy', 128, 64, (g, w, h) => {
    g.fillStyle = '#2b3a8a'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffd92e'
    g.beginPath()
    g.moveTo(0, h * 0.42)
    for (let i = 0; i <= 8; i++) g.lineTo((i / 8) * w, i % 2 ? h * 0.3 : h * 0.5)
    for (let i = 8; i >= 0; i--) g.lineTo((i / 8) * w, i % 2 ? h * 0.48 : h * 0.68)
    g.closePath()
    g.fill()
  }, true)

/** Brillo que barre la armadura (banda diagonal en negro: solo emisivo). */
const armorShine = () =>
  canvasTex('armor-shine', 256, 64, (g, w, h) => {
    g.fillStyle = '#000000'
    g.fillRect(0, 0, w, h)
    const gr = g.createLinearGradient(40, 0, 110, 0)
    gr.addColorStop(0, 'rgba(255,255,255,0)')
    gr.addColorStop(0.5, 'rgba(255,255,255,0.9)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.save()
    g.transform(1, 0, -0.5, 1, 0, 0)
    g.fillRect(40, 0, 90, h)
    g.restore()
  }, true)

/** Seda rosada con flores de cerezo. */
const sakuraSilk = () =>
  canvasTex('sakura', 256, 256, (g, w, h) => {
    g.fillStyle = '#ffc9df'
    g.fillRect(0, 0, w, h)
    const r = rng(23)
    const flower = (x: number, y: number, s: number, fill: string) => {
      g.fillStyle = fill
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + s
        g.beginPath()
        g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 4.2, a, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#ff6f9f'
      g.beginPath()
      g.arc(x, y, 2.6, 0, Math.PI * 2)
      g.fill()
    }
    for (let i = 0; i < 22; i++) flower(r() * w, r() * h, r() * 6, r() < 0.5 ? '#ffffff' : '#ffe6f0')
    for (let i = 0; i < 30; i++) {
      g.fillStyle = rgba('#ff8fb8', 0.5)
      g.beginPath()
      g.ellipse(r() * w, r() * h, 3, 2, r() * 6, 0, Math.PI * 2)
      g.fill()
    }
  }, true)

/** Escamas de dragón. */
const dragonScales = () =>
  canvasTex('dragon', 64, 64, (g, w, h) => {
    g.fillStyle = '#4fb85a'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#2f7a38'
    g.lineWidth = 2.5
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 5; i++) {
        const x = (i + (j % 2) * 0.5) * (w / 4)
        const y = j * (h / 4)
        g.fillStyle = (i + j) % 3 ? '#5cc867' : '#6fd477'
        g.beginPath()
        g.arc(x, y, w / 8, 0, Math.PI)
        g.fill()
        g.stroke()
      }
  }, true)

/** Baldosas de pista de baile (cada una de un color). */
const discoTiles = () =>
  canvasTex('disco-tiles', 128, 32, (g, w, h) => {
    const cols = ['#ff5ad1', '#7ff0ff', '#ffe14a', '#8a6bff', '#5fff9a', '#ff8a3d', '#4fb3ff', '#ff5a6a']
    for (let i = 0; i < 8; i++) {
      g.fillStyle = cols[i]
      g.fillRect((i / 8) * w, 0, w / 8, h)
      g.fillStyle = 'rgba(255,255,255,0.45)'
      g.fillRect((i / 8) * w + 3, 3, w / 8 - 10, 5)
    }
    g.fillStyle = '#1a1a28'
    for (let i = 0; i <= 8; i++) g.fillRect((i / 8) * w - 1.5, 0, 3, h)
  }, true)

/** Escarcha plateada (purpurina). */
const glitter = () =>
  canvasTex('glitter', 64, 64, (g, w, h) => {
    g.fillStyle = '#c9ccd8'
    g.fillRect(0, 0, w, h)
    const r = rng(5)
    for (let i = 0; i < 220; i++) {
      g.fillStyle = r() < 0.5 ? '#ffffff' : r() < 0.5 ? '#8f93a8' : '#ffe9ff'
      g.fillRect(r() * w, r() * h, 2, 2)
    }
  }, true)

// ---------- Sombreros (cabeza de radio 1) ----------

export const LEGEND_HATS_2: Record<string, Legend<[THREE.Object3D]>> = {
  /** Aureola de ángel: anillo de oro que flota y se mece, y dos alitas a los costados que aletean. */
  halo: {
    color: '#ffe27a',
    accent: '#ffffff',
    build(k, fit) {
      const t = k.t
      const gold = k.lit(GOLD, '#ffe27a', 0.7)
      const ring = k.group(fit, { pos: [0, 1.55, -0.12] })
      const hoop = torus(0.55, 0.075, 64).rotateX(Math.PI / 2)
      t.local(ring, hoop, gold, {}, 0.6)
      k.rim(ring, hoop, '#fff3a8', { power: 1.3, strength: 0.85, grow: 0.07 })
      const shine = k.sprite(ring, 'soft', '#ffe9a0', 2.2, [0, 0, 0], 0.45, 0)
      const feather = M('#ffffff')
      const wings = [1, -1].map((s) => {
        const g = k.group(fit, { pos: [s * 0.82, 0.3, -0.3] })
        ;[[0.95, 0.95], [0.8, 0.5], [0.62, 0.1]].forEach(([len, a]) => t.local(g, plume(len, 0.26, 0.06), feather, { rot: [0, s > 0 ? 0 : Math.PI, a] }, 0.6))
        return { g, s }
      })
      const down = k.motes(fit, {
        n: 8,
        kind: 'spark',
        colors: ['#ffffff', '#fff3a8'],
        life: [1.2, 2],
        size: [0.16, 0.26],
        from: (r, o) => o.set((r(1) - 0.5) * 1.4, 1.2 + r(2) * 0.5, (r(3) - 0.5) * 0.8),
        vel: (r, o) => o.set((r(4) - 0.5) * 0.1, -0.35, 0),
        twinkle: 0.5,
        spin: 1,
      }, 101)
      k.tick((time) => {
        ring.position.y = 1.55 + 0.07 * Math.sin(time * 2)
        ring.rotation.set(0.22 + 0.06 * Math.sin(time * 1.3), 0, 0.08 * Math.sin(time * 1.7))
        gold.emissiveIntensity = 0.6 + 0.25 * Math.sin(time * 2.4) ** 2
        shine.material.opacity = 0.35 + 0.15 * Math.sin(time * 2.4)
        // Aletean a ratos (rápido y luego planean).
        const beat = (time * 0.8) % 2
        const flap = beat < 0.9 ? Math.sin(beat * Math.PI * 6) : 0.15 * Math.sin(time * 2)
        for (const { g, s } of wings) g.rotation.set(0, s * 0.5, s * (0.1 + 0.4 * flap))
        down.update(time)
      })
    },
  },
  /** Nube de tormenta: una nubecita con cara que flota sobre la cabeza, llueve y suelta rayos. */
  storm: {
    color: '#7f9cff',
    accent: '#fff27a',
    build(k, fit) {
      const t = k.t
      const cloud = k.group(fit, { pos: [0, 1.8, -0.05], scale: 1.25 })
      const light = k.lit('#f6f8ff', '#fff6b0', 0.02)
      const dark = k.lit('#b9c4de', '#fff6b0', 0.02)
      const puffs: [number, number, number, number][] = [
        [0, 0.14, 0, 0.42], [0.42, 0.02, 0.02, 0.33], [-0.42, 0.04, 0, 0.34], [0.2, 0.3, -0.05, 0.3],
        [-0.22, 0.28, 0.02, 0.28], [0.66, -0.1, 0, 0.22], [-0.66, -0.08, 0, 0.22],
        [0.22, -0.12, 0.08, 0.3], [-0.22, -0.12, 0.06, 0.3], [0.05, -0.12, -0.22, 0.3],
      ]
      for (const [x, y, z, r] of puffs) t.local(cloud, sphere(1, 22, 16), y < -0.05 ? dark : light, { pos: [x, y, z], scale: [r, r * 0.85, r] })
      // Carita: ojos y cachetes.
      for (const s of [1, -1]) {
        t.local(cloud, sphere(1, 12, 10), M('#3a2416'), { pos: [s * 0.13, 0.12, 0.4], scale: [0.045, 0.065, 0.03] }, 0)
        t.local(cloud, sphere(1, 12, 10), M('#ffb3c7'), { pos: [s * 0.24, 0.02, 0.37], scale: [0.06, 0.035, 0.02] }, 0)
      }
      const zap = k.group(cloud, { pos: [0.1, -0.62, 0.42] })
      const boltMat = k.lit('#fff27a', '#ffe23a', 1)
      t.local(zap, bolt(0.75, 0.06), boltMat, {}, 0.6)
      const flash = k.sprite(zap, 'flare', '#fff6b0', 1.2, [0, 0.1, 0.05], 0, 7)
      const rain = k.motes(cloud, {
        n: 14,
        kind: 'drop',
        colors: ['#6fbaff', '#9fd2ff'],
        life: [0.45, 0.65],
        size: [0.34, 0.46],
        from: (r, o) => o.set((r(1) - 0.5) * 1.2, -0.25, 0.1 + r(2) * 0.35),
        vel: (_, o) => o.set(0, -2.2, 0),
        opacity: 0.85,
      }, 111)
      k.tick((time) => {
        cloud.position.y = 1.8 + 0.05 * Math.sin(time * 1.6)
        cloud.rotation.y = 0.15 * Math.sin(time * 0.7)
        // Rayo cada 3,2 s: dos fogonazos seguidos, en un lugar distinto cada vez.
        const P = 3.2
        const n = Math.floor(time / P)
        const ph = time - n * P
        const on = ph < 0.1 || (ph > 0.2 && ph < 0.28)
        zap.visible = on
        zap.position.x = ((n * 0.618) % 1) * 0.6 - 0.3
        zap.rotation.z = (((n * 0.377) % 1) - 0.5) * 0.6
        flash.material.opacity = on ? 0.9 : 0
        light.emissiveIntensity = dark.emissiveIntensity = on ? 0.55 : 0.02
        rain.update(time)
      })
    },
  },
  /** Corona del bosque: enredadera con hojas y flores que respiran, y luciérnagas alrededor. */
  bloom: {
    color: '#7fdc6a',
    accent: '#ff9ad5',
    build(k, fit) {
      const t = k.t
      const R = 0.8
      const Y = 0.62
      // Dos tallos trenzados alrededor de la cabeza.
      for (const [ph, col] of [[0, '#5fae45'], [Math.PI, '#3f8a35']] as const) {
        const pts = Array.from({ length: 64 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2
          return v(Math.sin(a) * (R + 0.03 * Math.sin(7 * a + ph)), Y + 0.045 * Math.sin(7 * a + ph), Math.cos(a) * (R + 0.03 * Math.sin(7 * a + ph)))
        })
        t.local(fit, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, 0.045, 8, true), M(col), {}, 0.7)
      }
      // Hojas que salen hacia afuera y arriba.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.2
        const g = leaf(0.3, 0.12, 0.03).rotateX(0.75).rotateY(a).translate(Math.sin(a) * R, Y + 0.02, Math.cos(a) * R)
        t.local(fit, g, M(i % 2 ? '#6fc24f' : '#8fd65a'), {}, 0.6)
      }
      // Flores (al frente y a los lados), cada una en su grupo para abrirse y girar.
      const petalCols = ['#ff9ad5', '#fff0f6', '#c9a0ff', '#ffb36b', '#ff9ad5']
      const flowers = [-1.3, -0.65, 0, 0.65, 1.3].map((a, i) => {
        const g = k.group(fit, { pos: [Math.sin(a) * (R + 0.04), Y + 0.1, Math.cos(a) * (R + 0.04)] })
        g.rotation.order = 'YXZ'
        g.rotation.set(-0.45, a, 0)
        const head = k.group(g)
        const mat = k.lit(petalCols[i], petalCols[i], 0.12)
        for (let j = 0; j < 5; j++) t.local(head, sphere(1, 14, 10).scale(0.09, 0.16, 0.035).translate(0, 0.15, 0).rotateZ((j / 5) * Math.PI * 2), mat, {}, 0.5)
        t.local(head, sphere(1, 14, 10), k.lit('#ffd23f', '#ffb000', 0.35), { scale: [0.085, 0.085, 0.06], pos: [0, 0, 0.025] }, 0.5)
        return { head, i }
      })
      const flies = k.motes(fit, {
        n: 8,
        kind: 'soft',
        colors: ['#eaff7a', '#c8ff6a', '#fff9a8'],
        life: [1.8, 2.8],
        size: [0.16, 0.26],
        from: (r, o) => {
          const a = r(1) * Math.PI * 2
          const d = 1.0 + 0.4 * r(2)
          o.set(Math.sin(a) * d, 0.55 + r(3) * 0.9, Math.cos(a) * d)
        },
        vel: (r, o) => o.set((r(4) - 0.5) * 0.25, 0.05 + 0.1 * r(5), (r(6) - 0.5) * 0.25),
        twinkle: 0.8,
      }, 121)
      k.tick((time) => {
        for (const { head, i } of flowers) {
          head.scale.setScalar(0.9 + 0.12 * Math.sin(time * 1.6 + i * 1.3))
          head.rotation.z = time * 0.4 * (i % 2 ? 1 : -1)
        }
        flies.update(time)
      })
    },
  },
}

/** Altura de asiento e inclinación (como los demás sombreros). */
export const LEGEND_SEAT_2: Record<string, Partial<Record<'hen' | 'chick' | 'egg' | 'cat', [number, number]>>> = {
  halo: { hen: [0, 0.05], chick: [0, 0.04], egg: [0, 0.02] },
  storm: { hen: [0, 0.04], chick: [0, 0.03], egg: [0, 0.02] },
  bloom: { hen: [0.05, 0.12], chick: [0.05, 0.1], egg: [0.03, 0.06] },
}

// ---------- Botas del pollito ----------

/** Bota base del pollito (caña, empeine, suela y punta), como las legendarias de la primera tanda. */
function chickBootBase(k: Kit, i: number, upper: THREE.Material, sole: THREE.Material, toe = upper) {
  const { t, rig } = k
  const foot = rig.sockets.feet[i]
  const P = chickP(i)
  t.model(foot, cylinder(0.066, 0.074, 0.14, 24), upper, { pos: P(0, 0.1, -0.02) })
  t.model(foot, sphere(1, 28, 18), upper, { pos: P(0, 0.056, 0.08), scale: [0.092, 0.076, 0.13] })
  t.model(foot, cylinder(1, 1, 1, 28), sole, { pos: P(0, 0.012, 0.075), scale: [0.098, 0.024, 0.142] })
  t.model(foot, sphere(1, 24, 14), toe, { pos: P(0, 0.038, 0.15), scale: [0.078, 0.044, 0.068] }, 0.6)
}

export const LEGEND_BOOTS_2: Record<string, Legend<[number]>> = {
  /** Botas de lava: roca volcánica con grietas que laten, suela al rojo, brasas y humo. */
  lava: {
    color: '#ff5a1a',
    accent: '#ffb02e',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const P = chickP(i)
      const map = k.own(lavaRock(false).clone())
      const emap = k.own(lavaRock(true).clone())
      for (const x of [map, emap]) {
        x.repeat.set(2, 1)
        x.needsUpdate = true
      }
      const rock = k.lit('#ffffff', '#ff7a1a', 0.8, map, emap)
      const hot = k.lit('#ff6a1a', '#ff4d0f', 0.75)
      chickBootBase(k, i, rock, hot, rock)
      // Borde de piedras sueltas arriba de la caña.
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2
        t.model(foot, facet(gem(0.026, 0.03, 0.026)), M('#3b2622'), { pos: P(Math.sin(a) * 0.07, 0.175, -0.02 + Math.cos(a) * 0.07), rot: [0.3 * j, a, 0.2] }, 0.5)
      }
      const here = k.mount(foot, { pos: P(0, 0.18, -0.02) })
      const embers = k.motes(here, {
        n: 7,
        kind: 'ember',
        colors: ['#ff7a1a', '#ffc23a', '#ff4d1f'],
        life: [0.6, 1.1],
        size: [0.04, 0.07],
        from: (r, o) => o.set((r(1) - 0.5) * 0.12, 0, (r(2) - 0.5) * 0.12),
        vel: (r, o) => o.set((r(3) - 0.5) * 0.08, 0, (r(4) - 0.5) * 0.08),
        rise: 0.35,
        grow: 0.4,
      }, 131 + i)
      const smoke = k.motes(here, {
        n: 4,
        kind: 'smoke',
        colors: ['#8a7f7a'],
        life: [1.2, 1.8],
        size: [0.06, 0.09],
        from: (r, o) => o.set((r(1) - 0.5) * 0.08, 0.02, (r(2) - 0.5) * 0.08),
        rise: 0.2,
        grow: 2.4,
        opacity: 0.5,
        order: 4,
      }, 141 + i)
      const glow = k.sprite(k.mount(foot, { pos: P(0, 0.01, 0.07) }), 'soft', '#ff6a1a', 0.32, [0, 0, 0], 0.6, 0)
      k.tick((time) => {
        const pulse = 0.5 + 0.5 * Math.sin(time * 2.2 + i)
        rock.emissiveIntensity = 0.55 + 0.45 * pulse
        hot.emissiveIntensity = 0.6 + 0.3 * pulse
        glow.material.opacity = 0.4 + 0.3 * pulse
        map.offset.y = emap.offset.y = -time * 0.03
        embers.update(time)
        smoke.update(time)
      })
    },
  },
  /** Botas arcoíris: franjas que suben por la caña, puños de nube que se mecen y estela de estrellitas. */
  rainbow: {
    color: '#ff7ad9',
    accent: '#7ff0ff',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const P = chickP(i)
      const map = k.own(rainbowStripes().clone())
      map.repeat.set(1, 1.5)
      map.needsUpdate = true
      const stripes = k.lit('#ffffff', '#ffffff', 0.18, map, map)
      chickBootBase(k, i, stripes, M('#ffffff'), M('#ffffff'))
      // Puño de nube: bolitas blancas alrededor de la boca de la caña.
      const cuff = k.mount(foot, { pos: P(0, 0.175, -0.02) })
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * Math.PI * 2
        t.local(cuff, sphere(1, 14, 10), M('#ffffff'), { pos: [Math.sin(a) * 0.065, 0.005 * (j % 2), Math.cos(a) * 0.065], scale: 0.032 + 0.006 * (j % 3) }, 0.6)
      }
      const trail = k.motes(k.mount(foot, { pos: P(0, 0.03, -0.04) }), {
        n: 8,
        kind: 'star',
        colors: ['#ff5a5a', '#ffe14a', '#6fdc6a', '#4fb3ff', '#9a7bff', '#ff9a3d'],
        life: [0.5, 0.8],
        size: [0.04, 0.07],
        from: (r, o) => o.set((r(1) - 0.5) * 0.1, r(2) * 0.05, 0),
        vel: (r, o) => o.set((r(3) - 0.5) * 0.06, 0.05, -0.18 - 0.12 * r(4)),
        twinkle: 0.4,
        spin: 2.5,
      }, 151 + i)
      k.tick((time, f) => {
        map.offset.y = -time * 0.25
        cuff.position.y = (cuff.userData.y ??= cuff.position.y) + 0.006 * Math.sin(time * 3 + i)
        cuff.rotation.y = time * 0.5
        stripes.emissiveIntensity = 0.15 + 0.1 * Math.sin(time * 2)
        trail.update(time, 0.6 + 0.4 * Math.min(1, f.jump / 0.04))
      })
    },
  },
  /** Botas relámpago: azul tormenta con zigzag amarillo, rayos a los costados que chisporrotean y chispazos al saltar. */
  thunder: {
    color: '#ffe23a',
    accent: '#5fc8ff',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const s = i % 2 ? -1 : 1
      const P = chickP(i)
      const map = k.own(thunderStripe().clone())
      map.repeat.set(2, 1)
      map.needsUpdate = true
      chickBootBase(k, i, k.lit('#ffffff', '#ffe23a', 0.12, map), M('#1a1a2a'))
      const zapMat = k.lit('#dff8ff', '#5fc8ff', 0.9)
      t.model(foot, bolt(0.09, 0.012), zapMat, { pos: P(s * 0.075, 0.1, -0.02), rot: [0, (s * Math.PI) / 2, 0.15 * s] }, 0.5)
      t.model(foot, bolt(0.06, 0.01), zapMat, { pos: P(s * 0.085, 0.055, 0.07), rot: [0, (s * Math.PI) / 2, -0.2 * s] }, 0.5)
      const here = k.mount(foot, { pos: P(0, 0.08, 0.04) })
      const arcs = k.motes(here, {
        n: 8,
        kind: 'spark',
        colors: ['#ffffff', '#7fdcff', '#fff27a'],
        life: [0.12, 0.25],
        size: [0.05, 0.09],
        from: (r, o) => {
          const a = r(1) * Math.PI * 2
          o.set(Math.sin(a) * 0.1, (r(2) - 0.5) * 0.14, Math.cos(a) * 0.12)
        },
        spin: 8,
      }, 161 + i)
      const zap = k.sprite(here, 'flare', '#7fdcff', 0.3, [s * 0.05, 0, 0], 0, 7)
      k.tick((time, f) => {
        const boost = Math.min(1, f.jump / 0.04)
        // Parpadeo eléctrico (a saltos, no suave).
        const flick = Math.sin(time * 47 + i * 3) > 0.2 ? 1 : 0.4
        zapMat.emissiveIntensity = 0.5 + 0.5 * flick
        const ph = (time + i * 0.7) % 2.2
        zap.material.opacity = Math.max(boost * 0.8, ph < 0.08 ? 0.9 : 0)
        zap.material.rotation = time * 9
        arcs.update(time, 0.35 + 0.65 * boost)
      })
    },
  },
}

// ---------- Ropa de la gallina ----------

/** Corpiño que cubre el torso del cuello hasta pasar la cintura (también la espalda). */
const bodiceAt = (waist: number, off: number) => (u: number, w: number) => {
  const az = (u - 0.5) * Math.PI * 2
  const d0 = tdir(az, NECK + 0.05)
  const el = waist - 0.06
  const d1 = v(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  return onTorso(d0.lerp(d1, w).normalize(), off)
}

/** Falda que cae derecha desde la cintura y se abre. */
const skirtAt = (waist: number, drop: number, flare: number, waves = 9) => (u: number, w: number, extra = 0) => {
  const az = (u - 0.5) * Math.PI * 2
  const top = atH(az, waist, 0.014)
  const out = v(Math.sin(az), 0, Math.cos(az) * 1.05)
  return top.addScaledVector(out, flare * (0.4 * w + w * w) + 0.02 * Math.sin(az * waves) * w + extra).add(v(0, -drop * w, 0))
}

export const LEGEND_OUTFITS_2: Record<string, Legend<[]>> = {
  /** Armadura de caballero: coraza plateada con un brillo que la recorre, escarcelas, hombreras, escudo con gema y capa roja. */
  knight: {
    color: '#9fb8ff',
    accent: GOLD,
    build(k) {
      const { t, rig } = k
      const body = rig.joints.body!
      const shine = k.own(armorShine().clone())
      shine.repeat.set(1, 1)
      shine.needsUpdate = true
      const steel = k.lit('#b4c0d4', '#ffffff', 0.85, null, shine)
      const seam = M('#7d8aa3')
      const gold = k.lit(GOLD, '#ffb020', 0.2)
      const waist = -0.28
      // Capa por detrás (primero, así la coraza queda encima en los hombros).
      const cape = (u: number, w: number) => {
        const az = Math.PI + (u - 0.5) * 2 * 1.7
        const top = tdir(az, NECK + 0.14)
        const hem = v(Math.sin(az) * 1.05, -0.3 - 0.03 * Math.cos(u * Math.PI * 5) ** 2, Math.cos(az)).normalize()
        return onTorso(top.lerp(hem, w).normalize(), 0.035 + 0.07 * w * w)
      }
      t.model(body, thickSurface(cape, 80, 16, 0.014), M('#c8323a'))
      // Coraza: cubre del cuello a la cintura todo alrededor.
      t.model(body, thickSurface(bodiceAt(waist, 0.026), 96, 18, 0.018), steel)
      t.model(body, band(NECK + 0.05, 0.034, 0.016), gold, {}, 0.6)
      const beltPts = Array.from({ length: 48 }, (_, j) => atH((j / 48) * Math.PI * 2, waist - 0.05, 0.036))
      t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beltPts, true), 96, 0.016, 8, true), gold, {}, 0.6)
      // Escarcelas: dos aros de placas que bajan de la cintura.
      const lame = skirtAt(waist - 0.04, 0.075, 0.02, 6)
      t.model(body, thickSurface((u, w) => lame(u, w, 0.03), 96, 4, 0.014), steel)
      const lame2 = skirtAt(waist - 0.11, 0.07, 0.025, 6)
      t.model(body, thickSurface((u, w) => lame2(u, w, 0.042), 96, 4, 0.014), steel)
      // Junturas de las placas de la coraza.
      for (const th of [NECK + 0.3, NECK + 0.62]) t.model(body, band(th, 0.04, 0.007, -2.2, 2.2), seam, {}, 0)
      // Hombreras.
      for (const s of [1, -1]) sleeve(t, rig, s, steel, gold, 0.2, 1.5)
      // Escudo en el pecho: borde de oro, esmalte azul, cruz dorada y gema que late.
      const th = NECK + 0.42
      const n = torsoNormal(0, th)
      const p = at(0, th, 0.05)
      const rot = facing(n)
      t.model(body, shield(0.07, 0.15, 0.012), gold, { pos: [p.x, p.y, p.z], rot }, 0.6)
      const p2 = p.clone().addScaledVector(n, 0.012)
      t.model(body, shield(0.055, 0.12, 0.012), M('#2f5fd0'), { pos: [p2.x, p2.y, p2.z], rot }, 0)
      const p3 = p2.clone().addScaledVector(n, 0.01)
      const jewel = k.lit('#7fd8ff', '#3ab0ff', 0.9)
      t.model(body, gem(0.022, 0.03, 0.012), jewel, { pos: [p3.x, p3.y + 0.01, p3.z], rot }, 0.5)
      const jGlow = k.sprite(k.mount(body, { pos: [p3.x + n.x * 0.02, p3.y + 0.01 + n.y * 0.02, p3.z + n.z * 0.02] }), 'flare', '#7fd8ff', 0.16)
      const glints = k.motes(k.mount(body), {
        n: 6,
        kind: 'spark',
        colors: ['#ffffff', '#e6efff'],
        life: [0.5, 0.9],
        size: [0.05, 0.08],
        from: (r, o) => o.copy(bodiceAt(waist, 0.04)(r(1), 0.15 + 0.7 * r(2))),
        twinkle: 0.3,
        spin: 2,
      }, 171)
      k.tick((time) => {
        // Un destello barre la coraza cada tanto.
        shine.offset.x = -((time * 0.45) % 2.4) + 0.7
        jewel.emissiveIntensity = 0.7 + 0.3 * Math.sin(time * 3)
        jGlow.material.opacity = 0.6 + 0.35 * Math.sin(time * 3)
        jGlow.material.rotation = time * 0.6
        gold.emissiveIntensity = 0.15 + 0.12 * Math.sin(time * 2) ** 2
        glints.update(time)
      })
    },
  },
  /** Kimono sakura: seda con flores de cerezo, cuello cruzado, obi rojo con moño atrás y pétalos que caen. */
  sakura: {
    color: '#ff9ac8',
    accent: '#ffe0f0',
    build(k) {
      const { t, rig } = k
      const body = rig.joints.body!
      const map = k.own(sakuraSilk().clone())
      map.repeat.set(3, 1.5)
      map.needsUpdate = true
      const silk = k.lit('#ffffff', '#ffd6e8', 0.12, map)
      const waist = -0.26
      t.model(body, thickSurface(bodiceAt(waist, 0.012), 96, 18, 0.01), silk)
      const skirt = skirtAt(waist, 0.22, 0.04, 5)
      t.model(body, thickSurface((u, w) => skirt(u, w), 110, 10, 0.012), silk)
      const red = M('#d8344c')
      const hemPts = Array.from({ length: 96 }, (_, j) => skirt(j / 96, 1, 0.006))
      t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPts, true), 192, 0.012, 8, true), red, {}, 0.6)
      // Cuello cruzado: una franja blanca y otra roja que bajan de los hombros y se cruzan en el pecho.
      const collar = (s: number, off: number) =>
        new THREE.CatmullRomCurve3([at(s * 1.25, NECK + 0.02, off), at(s * 0.7, NECK + 0.12, off), at(s * 0.15, NECK + 0.3, off + 0.004), at(-s * 0.25, NECK + 0.48, off + 0.008), at(-s * 0.45, NECK + 0.6, off + 0.008)])
      t.model(body, new THREE.TubeGeometry(collar(1, 0.02), 40, 0.017, 8), red, {}, 0.6)
      t.model(body, new THREE.TubeGeometry(collar(-1, 0.03), 40, 0.017, 8), M('#fff6fa'), {}, 0.6)
      // Obi ancho con un cordón dorado y moño grande en la espalda.
      t.model(body, thickSurface((u, w) => atH((u - 0.5) * Math.PI * 2, waist + 0.05 - w * 0.11, 0.024), 96, 4, 0.012), red)
      const cord = k.lit(GOLD, '#ffb020', 0.25)
      const cordPts = Array.from({ length: 48 }, (_, j) => atH((j / 48) * Math.PI * 2, waist - 0.005, 0.04))
      t.model(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts, true), 96, 0.008, 8, true), cord, {}, 0.4)
      const back = atH(Math.PI, waist, 0.06)
      bow(t, body, back, atH(Math.PI, waist, 0.2).sub(atH(Math.PI, waist, 0)), 0.11, '#d8344c', GOLD)
      for (const s of [1, -1]) sleeve(t, rig, s, silk, red, 0.48, 1.65)
      const petals = k.motes(k.mount(body), {
        n: 10,
        kind: 'petal',
        colors: ['#ffb8d6', '#ffd6e8', '#ff9ac8'],
        life: [2, 3],
        size: [0.05, 0.08],
        from: (r, o) => o.set((r(1) - 0.5) * 0.9, 0.75 + r(2) * 0.25, (r(3) - 0.5) * 0.7),
        vel: (r, o) => o.set(0.06 + 0.06 * r(4), -0.28 - 0.1 * r(5), (r(6) - 0.5) * 0.1),
        spin: 2.5,
      }, 181)
      k.tick((time) => {
        cord.emissiveIntensity = 0.2 + 0.15 * Math.sin(time * 2.2) ** 2
        silk.emissiveIntensity = 0.1 + 0.05 * Math.sin(time * 1.5)
        petals.update(time)
      })
    },
  },
  /** Vestido de hada: corpiño verde, falda de hojas, alas transparentes que aletean y polen dorado. */
  fairy: {
    color: '#7fffc4',
    accent: '#ffe27a',
    build(k) {
      const { t, rig } = k
      const body = rig.joints.body!
      const waist = -0.25
      const green = k.lit('#7fd68a', '#9effb0', 0.12)
      t.model(body, thickSurface(bodiceAt(waist, 0.012), 96, 18, 0.01), green)
      t.model(body, band(NECK + 0.05, 0.02, 0.016), M('#3f9a45'), {}, 0.7)
      for (const s of [1, -1]) sleeve(t, rig, s, green, M('#3f9a45'), 0.3, 1.25)
      // Falda de hojas: dos vueltas, cayendo hacia afuera.
      for (let ring = 0; ring < 2; ring++)
        for (let j = 0; j < 12; j++) {
          const az = ((j + ring * 0.5) / 12) * Math.PI * 2
          const base = atH(az, waist - ring * 0.04, 0.016 + ring * 0.008)
          const g = leaf(0.2 - ring * 0.03, 0.08, 0.008).rotateZ(Math.PI).rotateX(-0.35 - ring * 0.15).rotateY(az).translate(base.x, base.y, base.z)
          t.model(body, g, M((j + ring) % 2 ? '#5fbf5a' : '#8fdc6a'), {}, 0.6)
        }
      // Alas: dos pares, transparentes con borde de tinta, que aletean desde la espalda.
      const wingMat = k.own(new THREE.MeshBasicMaterial({ color: tintHex('#bff8e6'), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }))
      const root = at(Math.PI, NECK + 0.62, 0.02)
      const hinge = k.mount(body, { pos: [root.x, root.y, root.z] })
      const wings = [1, -1].map((s) => {
        const g = k.group(hinge)
        for (const down of [false, true]) {
          const wg = k.group(g, { rot: [0, s > 0 ? 0 : Math.PI, down ? -0.3 : 0.12] })
          t.local(wg, fairyWing(down).scale(down ? 0.75 : 0.9, down ? 0.75 : 0.9, 1), wingMat, {}, 0.4)
        }
        k.sprite(g, 'soft', '#bfffe6', 0.5, [s * 0.22, 0.12, -0.02], 0.35, 0)
        return { g, s }
      })
      const pollen = k.motes(hinge, {
        n: 9,
        kind: 'spark',
        colors: ['#fff3a8', '#ffe27a', '#ffffff'],
        life: [1, 1.6],
        size: [0.04, 0.07],
        from: (r, o) => o.set((r(1) - 0.5) * 0.8, 0.05 + r(2) * 0.3, -0.05 - r(3) * 0.15),
        vel: (r, o) => o.set((r(4) - 0.5) * 0.06, -0.12, 0),
        twinkle: 0.5,
        spin: 1.5,
      }, 191)
      k.tick((time) => {
        // Aleteo rápido y suave, con un tornasol que recorre verde, celeste y lila.
        const flap = 0.5 + 0.5 * Math.sin(time * 13)
        for (const { g, s } of wings) g.rotation.set(0, s * (0.3 + 0.4 * flap), 0)
        wingMat.color.setHSL(0.44 + 0.1 * Math.sin(time * 0.8), 0.75, 0.82)
        wingMat.opacity = 0.5 + 0.1 * Math.sin(time * 2)
        green.emissiveIntensity = 0.1 + 0.06 * Math.sin(time * 1.8)
        pollen.update(time)
      })
    },
  },
}

// ---------- Zapatos de la gallina ----------

export const LEGEND_SHOES_2: Record<string, Legend<[number]>> = {
  /** Patines de hielo: botín blanco con cordones y una cuchilla de hielo que brilla, dejando escarcha. */
  skates: {
    color: '#bfe8ff',
    accent: '#ffffff',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const P = henP(i)
      henShoeBase(k, i, M('#ffffff'), M('#e8eef5'))
      t.model(foot, cylinder(0.05, 0.053, 0.06, 20), M('#ffffff'), { pos: P(0, 0.09, -0.02) })
      t.model(foot, torus(0.05, 0.012, 24), M('#bfe8ff'), { pos: P(0, 0.12, -0.02), rot: [Math.PI / 2, 0, 0] }, 0.6)
      for (const j of [0, 1, 2]) t.model(foot, cylinder(0.004, 0.004, 0.044, 8), M('#7fb8e0'), { pos: P(0, 0.07 - j * 0.008, 0.035 + j * 0.018), rot: [0.9, 0, Math.PI / 2] }, 0.3)
      // Soportes cromados y cuchilla (con la puntita curvada adelante).
      for (const z of [0.07, -0.03]) t.model(foot, cylinder(0.008, 0.01, 0.022, 10), M(CHROME), { pos: P(0, -0.008, z) }, 0.4)
      const blade = new THREE.Shape()
      blade.moveTo(-0.075, 0.008)
      blade.lineTo(0.08, 0.008)
      blade.quadraticCurveTo(0.12, 0.006, 0.112, -0.016)
      blade.lineTo(-0.075, -0.016)
      blade.closePath()
      const ice = k.lit('#8fd8ff', '#3ab8ff', 0.7)
      const bladeGeo = extruded(blade, 0.01, 0.002)
      t.model(foot, bladeGeo, ice, { pos: P(0, -0.022, 0.02), rot: [0, -Math.PI / 2, 0] }, 0.5)
      const glint = k.sprite(k.mount(foot, { pos: P(0, -0.025, 0.1) }), 'spark', '#bfe8ff', 0.12)
      const frost = k.motes(k.mount(foot, { pos: P(0, -0.03, -0.05) }), {
        n: 7,
        kind: 'spark',
        colors: ['#ffffff', '#bfe8ff'],
        life: [0.5, 0.9],
        size: [0.03, 0.06],
        from: (r, o) => o.set((r(1) - 0.5) * 0.04, 0, r(2) * 0.04),
        vel: (r, o) => o.set((r(3) - 0.5) * 0.1, 0.04, -0.15 - 0.1 * r(4)),
        twinkle: 0.5,
        spin: 2,
      }, 201 + i)
      k.tick((time) => {
        ice.emissiveIntensity = 0.5 + 0.25 * Math.sin(time * 2.5 + i)
        const tw = Math.max(0, Math.sin(time * 1.9 + i * 1.7)) ** 8
        glint.scale.setScalar(0.04 + 0.14 * tw)
        glint.material.rotation = time
        frost.update(time)
      })
    },
  },
  /** Pantuflas de dragón: escamas verdes, ojitos amarillos, garras, cresta de púas y humito por la nariz. */
  dragon: {
    color: '#5fd068',
    accent: '#ff8a3d',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const P = henP(i)
      const map = k.own(dragonScales().clone())
      map.repeat.set(4, 3)
      map.needsUpdate = true
      henShoeBase(k, i, k.lit('#ffffff', '#3aff7a', 0.05, map), M('#2f5a2a'))
      // Garras al frente.
      for (const dx of [-0.026, 0, 0.026]) t.model(foot, cylinder(0, 0.011, 0.034, 10), M('#fff4dc'), { pos: P(dx, 0.014, 0.142), rot: [Math.PI / 2, 0, 0] }, 0.5)
      // Ojitos (amarillos con pupila de rendija) y cuernitos.
      const eye = k.lit('#ffe23a', '#ffd000', 0.7)
      for (const s of [1, -1]) {
        t.model(foot, sphere(1, 14, 10), eye, { pos: P(s * 0.024, 0.066, 0.085), scale: [0.016, 0.014, 0.012] }, 0.5)
        t.model(foot, sphere(1, 10, 8), M('#1a1a1a'), { pos: P(s * 0.024, 0.066, 0.096), scale: [0.004, 0.011, 0.004] }, 0)
        t.model(foot, cylinder(0, 0.008, 0.03, 10), M('#fff4dc'), { pos: P(s * 0.03, 0.085, 0.06), rot: [-0.5, 0, -s * 0.4] }, 0.5)
      }
      // Cresta de púas por el talón.
      const spike = M('#ff8a3d')
      ;[[0.075, -0.035, 0.026], [0.06, -0.06, 0.022], [0.04, -0.075, 0.018]].forEach(([y, z, h]) =>
        t.model(foot, cylinder(0, h * 0.45, h, 10), spike, { pos: P(0, y, z), rot: [-0.7, 0, 0] }, 0.5),
      )
      const nose = k.mount(foot, { pos: P(0, 0.045, 0.14) })
      const smoke = k.motes(nose, {
        n: 5,
        kind: 'smoke',
        colors: ['#e8e2d8'],
        life: [0.9, 1.3],
        size: [0.03, 0.05],
        from: (r, o) => o.set((r(1) - 0.5) * 0.02, 0, 0),
        vel: (r, o) => o.set((r(2) - 0.5) * 0.04, 0.03, 0.08),
        rise: 0.12,
        grow: 2.6,
        opacity: 0.6,
        order: 4,
      }, 211 + i)
      const embers = k.motes(nose, {
        n: 3,
        kind: 'ember',
        colors: ['#ff8a3d', '#ffc23a'],
        life: [0.3, 0.5],
        size: [0.025, 0.04],
        from: (_, o) => o.set(0, 0, 0),
        vel: (r, o) => o.set((r(1) - 0.5) * 0.1, 0.05, 0.2),
      }, 221 + i)
      k.tick((time) => {
        // Resopla cada tanto: humo y alguna chispa.
        const ph = (time * 0.5 + i * 0.37) % 1
        const puff = ph < 0.3 ? 1 : 0.15
        smoke.update(time, puff)
        embers.update(time, ph < 0.12 ? 1 : 0)
        eye.emissiveIntensity = 0.6 + 0.3 * Math.sin(time * 3 + i)
      })
    },
  },
  /** Plataformas disco: suela alta de baldosas de colores que corren, capellada de purpurina y una bola de espejos. */
  disco: {
    color: '#ff5ad1',
    accent: '#7ff0ff',
    build(k, i) {
      const { t, rig } = k
      const foot = rig.sockets.feet[i]
      const P = henP(i)
      const tiles = k.own(discoTiles().clone())
      tiles.repeat.set(2, 1)
      tiles.needsUpdate = true
      const floor = k.lit('#ffffff', '#ffffff', 0.85, tiles, tiles)
      t.model(foot, cylinder(1, 1, 1, 32), floor, { pos: P(0, -0.0175, 0.025), scale: [0.064, 0.035, 0.118] })
      const sparkle = k.own(glitter().clone())
      sparkle.repeat.set(3, 2)
      sparkle.needsUpdate = true
      henShoeBase(k, i, k.lit('#ffffff', '#ffffff', 0.12, sparkle), M('#2a2a3a'))
      // Bolita de espejos en la punta.
      const ball = k.group(k.mount(foot, { pos: P(0, 0.07, 0.11) }))
      t.local(ball, facet(sphere(0.02, 10, 6)), k.lit('#e8eef8', '#ffffff', 0.3, sparkle), {}, 0.4)
      const flare = k.sprite(ball, 'spark', '#ffffff', 0.09, [0.01, 0.01, 0.02])
      const lights = k.motes(k.mount(foot, { pos: P(0, 0.02, 0.03) }), {
        n: 7,
        kind: 'star',
        colors: ['#ff5ad1', '#7ff0ff', '#ffe14a', '#8a6bff'],
        life: [0.6, 1],
        size: [0.03, 0.06],
        from: (r, o) => {
          const a = r(1) * Math.PI * 2
          o.set(Math.sin(a) * 0.1, r(2) * 0.08, Math.cos(a) * 0.14)
        },
        twinkle: 0.6,
        spin: 3,
      }, 231 + i)
      k.tick((time) => {
        // Las baldosas avanzan a saltos, al ritmo.
        tiles.offset.x = Math.floor(time * 4) / 8
        floor.emissiveIntensity = 0.7 + 0.25 * (Math.floor(time * 4) % 2)
        ball.rotation.y = time * 2
        flare.material.opacity = Math.max(0, Math.sin(time * 6 + i)) ** 4
        flare.material.rotation = time
        lights.update(time)
      })
    },
  },
}

/** Cuánto levantan a la gallina los zapatos legendarios (cuchilla, plataforma). */
export const LEGEND_LIFT: Record<string, number> = { skates: 0.03, disco: 0.035 }

// ---------- Colección completa ----------

/** Toda la colección legendaria, por espacio. */
export const LEGENDS = {
  hat: { ...LEGENDS_1.hat, ...LEGEND_HATS_2 },
  boots: { ...LEGENDS_1.boots, ...LEGEND_BOOTS_2 },
  outfit: { ...LEGENDS_1.outfit, ...LEGEND_OUTFITS_2 },
  shoes: { ...LEGENDS_1.shoes, ...LEGEND_SHOES_2 },
}

export const LEGEND_SEAT = { ...SEAT_1, ...LEGEND_SEAT_2 }
