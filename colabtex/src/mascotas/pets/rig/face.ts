import * as THREE from 'three'
import { canvasTexture, extruded, heartShape } from './kit'

// Cara kawaii armada con piezas: ojos-cúpula brillantes (como los de un peluche), cejas, lágrima,
// ojos de corazón, espirales de mareo y cachetes. Todas las variantes se crean una vez y la
// expresión solo cambia qué se ve, así cambiar de cara no cuesta nada.

export type Expression = 'normal' | 'happy' | 'sad' | 'angry' | 'sleep' | 'surprised' | 'love' | 'dizzy'

const EYE_INK = '#2a1810'

export interface FaceSpot {
  /** Punto de la superficie (espacio del modelo) y su normal. */
  pos: THREE.Vector3
  normal: THREE.Vector3
}

export interface FaceSpec {
  eyes: [FaceSpot, FaceSpot]
  eyeSize: number
  blush?: [FaceSpot, FaceSpot]
  blushSize?: number
  /** 0 = los ojos siguen la superficie, 1 = miran al frente. */
  facing?: number
  /** Color del iris (sin él, café cálido). */
  iris?: string
  /** Pupila vertical. */
  slit?: boolean
  /** Pupila redonda grande (radio, fracción del ojo; los gatos tiernos la tienen dilatada). */
  pupil?: number
  /** Alto del ojo respecto del ancho (1,22 = ovalado como el de la gallina). */
  aspect?: number
}

/** Disco abombado con UV planas: se pinta como una imagen 2D sobre una cúpula. */
function makeDome(depth: number, rings = 8, seg = 40) {
  const positions: number[] = [0, 0, depth]
  const uvs: number[] = [0.5, 0.5]
  const indices: number[] = []
  for (let r = 1; r <= rings; r++) {
    const rad = r / rings
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2
      const x = Math.cos(a) * rad
      const y = Math.sin(a) * rad
      positions.push(x, y, Math.sqrt(Math.max(0, 1 - rad * rad)) * depth)
      uvs.push(0.5 + x / 2, 0.5 + y / 2)
    }
  }
  for (let s = 0; s < seg; s++) indices.push(0, 1 + s, 1 + ((s + 1) % seg))
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * seg
    const a1 = 1 + r * seg
    for (let s = 0; s < seg; s++) {
      const s1 = (s + 1) % seg
      indices.push(a0 + s, a1 + s, a1 + s1, a0 + s, a1 + s1, a0 + s1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Ojo estilo anime: fondo tinta, iris cálido abajo, brillo grande arriba y uno chico abajo. */
function eyeTexture(small = false, color?: string, slit = false, pupil = 0) {
  return canvasTexture(256, 256, (ctx, s) => {
    ctx.fillStyle = EYE_INK
    ctx.fillRect(0, 0, s, s)
    if (color && pupil) {
      // Ojo de gato tierno: iris de color con aro oscuro, más claro abajo, pupila grande y brillante.
      const iris = ctx.createRadialGradient(s * 0.5, s * 0.72, s * 0.04, s * 0.5, s * 0.55, s * 0.47)
      iris.addColorStop(0, '#fffbe8')
      iris.addColorStop(0.3, color)
      iris.addColorStop(0.78, color)
      iris.addColorStop(1, EYE_INK)
      ctx.fillStyle = iris
      ctx.beginPath()
      ctx.arc(s * 0.5, s * 0.5, s * 0.46, 0, Math.PI * 2)
      ctx.fill()
      const p = s * (small ? pupil * 0.6 : pupil)
      const g = ctx.createRadialGradient(s * 0.5, s * 0.46, p * 0.2, s * 0.5, s * 0.48, p)
      g.addColorStop(0, '#120a06')
      g.addColorStop(0.85, EYE_INK)
      g.addColorStop(1, 'rgba(42,24,16,0.6)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(s * 0.5, s * 0.48, p * 0.92, p, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.ellipse(s * 0.66, s * 0.3, s * (small ? 0.1 : 0.15), s * (small ? 0.09 : 0.13), -0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s * 0.34, s * 0.68, s * (small ? 0.045 : 0.065), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.arc(s * 0.46, s * 0.22, s * 0.035, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      return
    }
    if (color) {
      // Iris de color que llena casi todo el ojo, más claro abajo, con pupila (vertical en los gatos).
      const iris = ctx.createRadialGradient(s * 0.5, s * 0.78, s * 0.05, s * 0.5, s * 0.6, s * 0.5)
      iris.addColorStop(0, '#ffffff')
      iris.addColorStop(0.18, color)
      iris.addColorStop(0.8, color)
      iris.addColorStop(1, EYE_INK)
      ctx.fillStyle = iris
      ctx.beginPath()
      ctx.arc(s * 0.5, s * 0.5, s * 0.44, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = EYE_INK
      ctx.beginPath()
      if (slit) ctx.ellipse(s * 0.5, s * 0.52, s * (small ? 0.05 : 0.08), s * 0.3, 0, 0, Math.PI * 2)
      else ctx.arc(s * 0.5, s * 0.52, s * 0.2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      const iris = ctx.createRadialGradient(s * 0.5, s * 0.9, s * 0.04, s * 0.5, s * 0.82, s * 0.52)
      iris.addColorStop(0, '#b26a34')
      iris.addColorStop(0.5, '#6a381b')
      iris.addColorStop(1, 'rgba(42,24,16,0)')
      ctx.fillStyle = iris
      ctx.fillRect(0, 0, s, s)
    }
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    if (small) ctx.ellipse(s * 0.62, s * 0.36, s * 0.11, s * 0.1, -0.5, 0, Math.PI * 2)
    else ctx.ellipse(s * 0.63, s * 0.33, s * 0.18, s * 0.155, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(s * 0.36, s * 0.67, s * (small ? 0.05 : 0.075), 0, Math.PI * 2)
    ctx.fill()
  })
}

function blushTexture() {
  return canvasTexture(128, 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,110,130,0.9)')
    g.addColorStop(0.5, 'rgba(255,125,145,0.6)')
    g.addColorStop(1, 'rgba(255,140,160,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    // Tres rayitas de rubor, típicas del estilo.
    ctx.strokeStyle = 'rgba(214,70,96,0.75)'
    ctx.lineWidth = s * 0.045
    ctx.lineCap = 'round'
    for (const dx of [-0.17, 0, 0.17]) {
      ctx.beginPath()
      ctx.moveTo(s * (0.5 + dx + 0.06), s * 0.4)
      ctx.lineTo(s * (0.5 + dx - 0.06), s * 0.6)
      ctx.stroke()
    }
  })
}

function spiralTexture() {
  return canvasTexture(256, 256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = EYE_INK
    ctx.lineWidth = s * 0.07
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let a = 0; a < Math.PI * 6; a += 0.1) {
      const r = (a / (Math.PI * 6)) * s * 0.42
      const x = s / 2 + Math.cos(a) * r
      const y = s / 2 + Math.sin(a) * r
      if (a === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  })
}

let shared: ReturnType<typeof createShared> | null = null
function createShared() {
  const basic = (o: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ toneMapped: false, ...o })
  return {
    dome: makeDome(0.5),
    flatDisc: new THREE.CircleGeometry(1, 32),
    eye: basic({ map: eyeTexture() }),
    eyeSmall: basic({ map: eyeTexture(true) }),
    spiral: basic({ map: spiralTexture(), transparent: true }),
    ink: basic({ color: EYE_INK }),
    tear: basic({ color: '#8fd3ff' }),
    heart: basic({ color: '#ff4f7a' }),
    blushTex: blushTexture(),
    arc: new THREE.TorusGeometry(0.75, 0.17, 8, 24, Math.PI),
    brow: new THREE.CapsuleGeometry(0.13, 0.9, 4, 8),
    tearGeo: new THREE.SphereGeometry(1, 16, 12),
    heartGeo: extruded(heartShape(1), 0.2, 0.08),
  }
}
const getShared = () => (shared ??= createShared())

/** Ojos de color (uno por color de iris, compartidos). */
const colored = new Map<string, { eye: THREE.MeshBasicMaterial; eyeSmall: THREE.MeshBasicMaterial }>()
function eyeMats(iris: string, slit: boolean, pupil = 0) {
  const key = `${iris}:${slit ? 'slit' : ''}:${pupil}`
  let m = colored.get(key)
  if (!m) {
    const basic = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ toneMapped: false, map })
    colored.set(key, (m = { eye: basic(eyeTexture(false, iris, slit, pupil)), eyeSmall: basic(eyeTexture(true, iris, slit, pupil)) }))
  }
  return m
}

interface EyeParts {
  open: THREE.Group
  openMesh: THREE.Mesh
  happy: THREE.Mesh
  sleep: THREE.Mesh
  browAngry: THREE.Mesh
  browSad: THREE.Mesh
  browUp: THREE.Mesh
  tear: THREE.Mesh | null
  love: THREE.Mesh
  dizzy: THREE.Mesh
}

/** Cara armada y lista para colgar de la cabeza. `update` se llama cada cuadro. */
export class Face {
  readonly group = new THREE.Group()
  private eyes: EyeParts[] = []
  private blush: THREE.Mesh[] = []
  private blushMat: THREE.MeshBasicMaterial
  private size: number
  private aspect: number
  private mats: { eye: THREE.MeshBasicMaterial; eyeSmall: THREE.MeshBasicMaterial }

  constructor(spec: FaceSpec) {
    const s = getShared()
    this.size = spec.eyeSize
    this.aspect = spec.aspect ?? 1.22
    this.mats = spec.iris ? eyeMats(spec.iris, !!spec.slit, spec.pupil) : s
    const facing = spec.facing ?? 0.4
    const size = spec.eyeSize
    spec.eyes.forEach((spot, i) => {
      const side = i === 0 ? 1 : -1
      const g = new THREE.Group()
      const n = spot.normal.clone().lerp(new THREE.Vector3(0, 0, 1), facing).normalize()
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
      // Apoyada sobre la superficie (si se hunde, la cabeza la corta y se ve enojada).
      g.position.copy(spot.pos).addScaledVector(spot.normal, size * 0.08)
      const open = new THREE.Group()
      const openMesh = new THREE.Mesh(s.dome, this.mats.eye)
      openMesh.scale.set(size, size * this.aspect, size)
      open.add(openMesh)
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
        const m = new THREE.Mesh(geo, mat)
        g.add(m)
        return m
      }
      const happy = mk(s.arc, s.ink)
      happy.position.set(0, -size * 0.2, size * 0.18)
      happy.scale.set(size * 0.95, size, size)
      const sleep = mk(s.arc, s.ink)
      sleep.position.set(0, size * 0.15, size * 0.18)
      sleep.rotation.z = Math.PI
      sleep.scale.set(size * 0.95, size * 0.5, size)
      const browAngry = mk(s.brow, s.ink)
      browAngry.position.set(side * size * 0.05, size * 1.25, size * 0.2)
      browAngry.rotation.z = Math.PI / 2 + side * 0.5
      browAngry.scale.setScalar(size * 1.1)
      const browSad = mk(s.brow, s.ink)
      browSad.position.set(-side * size * 0.05, size * 1.5, size * 0.2)
      browSad.rotation.z = Math.PI / 2 - side * 0.38
      browSad.scale.setScalar(size)
      const browUp = mk(s.arc, s.ink)
      browUp.position.set(0, size * 1.55, size * 0.2)
      browUp.scale.set(size * 0.8, size * 0.5, size)
      // Una sola lágrima, en el ojo derecho de la mascota.
      const tear = side === -1 ? mk(s.tearGeo, s.tear) : null
      tear?.scale.set(size * 0.24, size * 0.34, size * 0.16)
      tear?.position.set(-side * size * 0.75, -size * 1.1, size * 0.3)
      const love = mk(s.heartGeo, s.heart)
      love.scale.setScalar(size * 1.05)
      love.position.z = size * 0.25
      const dizzy = mk(s.flatDisc, s.spiral)
      dizzy.scale.setScalar(size * 1.05)
      dizzy.position.z = size * 0.32
      g.add(open)
      this.group.add(g)
      this.eyes.push({ open, openMesh, happy, sleep, browAngry, browSad, browUp, tear, love, dizzy })
    })
    this.blushMat = new THREE.MeshBasicMaterial({
      map: s.blushTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      toneMapped: false,
    })
    for (const spot of spec.blush ?? []) {
      const m = new THREE.Mesh(s.flatDisc, this.blushMat)
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spot.normal)
      m.position.copy(spot.pos).addScaledVector(spot.normal, 0.006)
      const bs = spec.blushSize ?? spec.eyeSize
      m.scale.set(bs * 1.25, bs * 0.85, 1)
      this.blush.push(m)
      this.group.add(m)
    }
  }

  /**
   * @param blink 1 = ojos abiertos, 0 = cerrados.
   * @param t reloj (s) para lo que se mueve solo (espirales, latido del corazón).
   */
  update(expr: Expression, blink: number, t: number) {
    const s = getShared()
    for (const e of this.eyes) {
      const open = expr === 'normal' || expr === 'sad' || expr === 'angry' || expr === 'surprised'
      e.open.visible = open
      e.open.scale.y = expr === 'surprised' ? 1 : Math.max(0.08, blink)
      const k = expr === 'surprised' ? 1.08 : expr === 'sad' ? 0.92 : expr === 'angry' ? 0.85 : 1
      e.openMesh.scale.set(this.size * k, this.size * (expr === 'surprised' ? 1.08 : this.aspect) * k, this.size)
      e.openMesh.material = expr === 'surprised' ? this.mats.eyeSmall : this.mats.eye
      e.happy.visible = expr === 'happy'
      e.sleep.visible = expr === 'sleep'
      e.browAngry.visible = expr === 'angry'
      e.browSad.visible = expr === 'sad'
      e.browUp.visible = expr === 'surprised'
      if (e.tear) {
        e.tear.visible = expr === 'sad'
        e.tear.position.y = -this.size * (1.05 + ((t * 0.6) % 1) * 0.5)
      }
      e.love.visible = expr === 'love'
      e.love.scale.setScalar(this.size * (1.05 + Math.abs(Math.sin(t * 7)) * 0.18))
      e.dizzy.visible = expr === 'dizzy'
      e.dizzy.rotation.z = -t * 9
    }
    this.blushMat.opacity =
      expr === 'happy' || expr === 'love' ? 1 : expr === 'sad' ? 0.3 : expr === 'angry' ? 0.45 : expr === 'sleep' ? 0.55 : 0.8
  }
}
