import * as THREE from 'three'
import { hash } from './anim/util'
import type { V3 } from './rig/kit'

// Efectos de los objetos legendarios: texturas de luz, halos, chispas que flotan alrededor y el
// aura mágica en el piso. Todo es función pura del reloj de la animación (sin azar ni estado), así
// el estudio puede saltar a cualquier instante y ver exactamente lo mismo. Los sprites no reciben
// luz: brillan igual con la luz apagada.

// ---------- Texturas ----------

export type GlowKind = 'soft' | 'spark' | 'star' | 'ember' | 'smoke' | 'ring' | 'flare' | 'petal' | 'drop'

const texCache = new Map<string, THREE.Texture>()

function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  let t = texCache.get(key)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = c.height = size
    draw(c.getContext('2d')!, size)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    texCache.set(key, t)
  }
  return t
}

function radial(g: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r)
  for (const [k, c] of stops) gr.addColorStop(k, c)
  g.fillStyle = gr
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}

/** `#rrggbb` con transparencia. */
export function rgba(hex: string, a: number) {
  const c = new THREE.Color(hex)
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`
}

/** Destello de cuatro puntas (rayos finos que se afinan). */
function rays(g: CanvasRenderingContext2D, c: number, len: number, width: number, color: string, n = 4, rot = 0) {
  g.fillStyle = color
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    g.beginPath()
    g.moveTo(c + Math.cos(a) * len, c + Math.sin(a) * len)
    g.lineTo(c + Math.cos(a + Math.PI / 2) * width, c + Math.sin(a + Math.PI / 2) * width)
    g.lineTo(c, c)
    g.lineTo(c + Math.cos(a - Math.PI / 2) * width, c + Math.sin(a - Math.PI / 2) * width)
    g.closePath()
    g.fill()
  }
}

/** Textura de luz de un color: centro blanco, halo del color y borde transparente. */
export function glowTexture(kind: GlowKind, color: string) {
  return canvasTex(`${kind}:${color}`, 128, (g, s) => {
    const c = s / 2
    switch (kind) {
      case 'soft':
        radial(g, c, c, c, [[0, rgba('#ffffff', 0.95)], [0.18, rgba(color, 0.8)], [0.5, rgba(color, 0.28)], [1, rgba(color, 0)]])
        break
      case 'ember':
        radial(g, c, c, c, [[0, rgba('#ffffff', 1)], [0.2, rgba('#fff3c4', 0.95)], [0.42, rgba(color, 0.7)], [1, rgba(color, 0)]])
        break
      case 'spark':
        radial(g, c, c, c * 0.7, [[0, rgba(color, 0.55)], [1, rgba(color, 0)]])
        rays(g, c, c * 0.98, c * 0.13, rgba(color, 0.9))
        rays(g, c, c * 0.5, c * 0.08, rgba(color, 0.7), 4, Math.PI / 4)
        rays(g, c, c * 0.7, c * 0.06, '#ffffff')
        radial(g, c, c, c * 0.22, [[0, '#ffffff'], [0.6, rgba('#ffffff', 0.8)], [1, rgba('#ffffff', 0)]])
        break
      case 'star': {
        radial(g, c, c, c, [[0, rgba(color, 0.6)], [0.6, rgba(color, 0.15)], [1, rgba(color, 0)]])
        g.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2
          const r = (i % 2 ? 0.2 : 0.5) * s
          g.lineTo(c + Math.cos(a) * r, c + 4 + Math.sin(a) * r)
        }
        g.closePath()
        g.fillStyle = color
        g.fill()
        g.lineWidth = 6
        g.strokeStyle = rgba('#ffffff', 0.9)
        g.stroke()
        radial(g, c, c + 4, c * 0.25, [[0, '#ffffff'], [1, rgba('#ffffff', 0)]])
        break
      }
      case 'smoke':
        for (const [x, y, r] of [[0.5, 0.55, 0.36], [0.34, 0.48, 0.26], [0.66, 0.46, 0.27], [0.5, 0.34, 0.26]])
          radial(g, x * s, y * s, r * s, [[0, rgba(color, 0.55)], [0.7, rgba(color, 0.25)], [1, rgba(color, 0)]])
        break
      case 'ring':
        radial(g, c, c, c, [[0, rgba(color, 0)], [0.62, rgba(color, 0)], [0.8, rgba('#ffffff', 0.9)], [0.86, rgba(color, 0.7)], [1, rgba(color, 0)]])
        break
      case 'flare':
        radial(g, c, c, c, [[0, rgba('#ffffff', 1)], [0.1, rgba(color, 0.9)], [0.35, rgba(color, 0.25)], [1, rgba(color, 0)]])
        rays(g, c, c, c * 0.05, rgba('#ffffff', 0.8), 6, 0.3)
        break
      case 'petal': {
        // Pétalo de cerezo: gota con muesca en la punta, con trazo de tinta suave.
        g.beginPath()
        g.moveTo(c, s * 0.9)
        g.bezierCurveTo(s * 0.12, s * 0.62, s * 0.2, s * 0.18, c - s * 0.08, s * 0.12)
        g.lineTo(c, s * 0.22)
        g.lineTo(c + s * 0.08, s * 0.12)
        g.bezierCurveTo(s * 0.8, s * 0.18, s * 0.88, s * 0.62, c, s * 0.9)
        g.fillStyle = color
        g.fill()
        g.lineWidth = 5
        g.strokeStyle = rgba('#b0306a', 0.7)
        g.stroke()
        g.fillStyle = rgba('#ffffff', 0.55)
        g.beginPath()
        g.ellipse(c - s * 0.1, s * 0.42, s * 0.07, s * 0.16, -0.3, 0, Math.PI * 2)
        g.fill()
        break
      }
      case 'drop': {
        // Gota de lluvia alargada (cae vertical).
        const gr = g.createLinearGradient(0, s * 0.05, 0, s * 0.95)
        gr.addColorStop(0, rgba(color, 0))
        gr.addColorStop(0.7, rgba(color, 0.9))
        gr.addColorStop(1, rgba('#ffffff', 1))
        g.fillStyle = gr
        g.beginPath()
        g.ellipse(c, c, s * 0.07, s * 0.45, 0, 0, Math.PI * 2)
        g.fill()
        break
      }
    }
  })
}

/** Círculo mágico de runas (para el aura del piso). */
export function runeTexture(color: string, inner = false) {
  return canvasTex(`rune:${color}:${inner}`, 512, (g, s) => {
    const c = s / 2
    g.translate(c, c)
    g.shadowColor = color
    g.shadowBlur = 14
    g.strokeStyle = rgba('#ffffff', 0.95)
    g.fillStyle = rgba('#ffffff', 0.95)
    g.lineCap = 'round'
    const ring = (r: number, w: number) => {
      g.lineWidth = w
      g.beginPath()
      g.arc(0, 0, r, 0, Math.PI * 2)
      g.stroke()
    }
    if (!inner) {
      ring(c * 0.94, 7)
      ring(c * 0.8, 3)
      // Runas entre los dos aros.
      const N = 18
      g.lineWidth = 4
      for (let i = 0; i < N; i++) {
        g.save()
        g.rotate((i / N) * Math.PI * 2)
        g.translate(0, -c * 0.87)
        const k = hash(i * 7 + 3)
        g.beginPath()
        g.moveTo(0, -12)
        g.lineTo(0, 12)
        if (k < 0.33) g.moveTo(-8, -6), g.lineTo(8, 4)
        else if (k < 0.66) g.moveTo(-8, 8), g.lineTo(0, -2), g.lineTo(8, 8)
        else g.moveTo(-8, -12), g.lineTo(0, -4), g.lineTo(8, -12)
        if (hash(i * 13 + 5) > 0.5) g.moveTo(5, 2), g.arc(0, 2, 5, 0, Math.PI * 2)
        g.stroke()
        g.restore()
      }
      // Puntitos sobre el aro de afuera.
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2
        g.beginPath()
        g.arc(Math.cos(a) * c * 0.725, Math.sin(a) * c * 0.725, i % 3 ? 2.5 : 5, 0, Math.PI * 2)
        g.fill()
      }
    } else {
      // Estrella de siete puntas entrelazada y aros chicos.
      ring(c * 0.62, 4)
      g.lineWidth = 4
      g.beginPath()
      for (let i = 0; i <= 7; i++) {
        const a = ((i * 3) / 7) * Math.PI * 2 - Math.PI / 2
        g.lineTo(Math.cos(a) * c * 0.6, Math.sin(a) * c * 0.6)
      }
      g.stroke()
      ring(c * 0.26, 3)
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2
        g.beginPath()
        g.arc(Math.cos(a) * c * 0.62, Math.sin(a) * c * 0.62, 9, 0, Math.PI * 2)
        g.stroke()
      }
    }
  })
}

/** Degradé de llama (base del color, punta clara) para mapas emisivos. */
export function flameTexture(base: string, mid: string, tip: string) {
  return canvasTex(`flame:${base}:${mid}:${tip}`, 64, (g, s) => {
    const gr = g.createLinearGradient(0, s, 0, 0)
    gr.addColorStop(0, base)
    gr.addColorStop(0.45, mid)
    gr.addColorStop(1, tip)
    g.fillStyle = gr
    g.fillRect(0, 0, s, s)
  })
}

// ---------- Brillo de borde ----------

/**
 * Halo de borde: una copia inflada de la pieza que se ve solo por fuera de su silueta y se
 * desvanece hacia afuera. Ideal para gemas, orbes y bordes mágicos.
 */
export function rimMaterial(color: string, o: { power?: number; strength?: number; grow?: number } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: o.power ?? 2 },
      uStrength: { value: o.strength ?? 0.8 },
      uGrow: { value: o.grow ?? 0.1 },
    },
    vertexShader: /* glsl */ `
      uniform float uGrow;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position + normal * uGrow, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uStrength;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float k = pow(clamp(-dot(normalize(vN), vV), 0.0, 1.0), uPower) * uStrength;
        gl_FragColor = vec4(uColor, k);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  })
}

// ---------- Chispas que flotan ----------

export interface MoteSpec {
  n: number
  kind: GlowKind
  colors: string[]
  /** Vida de cada chispa (s), mín–máx. */
  life: [number, number]
  size: [number, number]
  /** Dónde nace. `r(k)` da números fijos (0–1) para cada chispa y cada vida. */
  from: (r: (k: number) => number, out: THREE.Vector3) => void
  /** Velocidad (en el espacio del grupo). */
  vel?: (r: (k: number) => number, out: THREE.Vector3) => void
  /** Sube en el mundo (aunque el grupo esté girado), en unidades del grupo por segundo. */
  rise?: number
  /** Aceleración constante (espacio del grupo). */
  acc?: V3
  /** Titila (0 = nada). */
  twinkle?: number
  /** Tamaño al final de la vida respecto del inicial. */
  grow?: number
  spin?: number
  opacity?: number
  /** Orden de dibujo (más alto = encima). */
  order?: number
}

/** Chispas deterministas: cada una nace, vive y renace en un ciclo propio que depende solo de t. */
export class Motes {
  readonly group = new THREE.Group()
  private sprites: THREE.Sprite[] = []
  private q = new THREE.Quaternion()
  private up = new THREE.Vector3()
  private p = new THREE.Vector3()
  private vel = new THREE.Vector3()
  private sc = new THREE.Vector3()

  constructor(
    private spec: MoteSpec,
    private seed = 1,
  ) {
    for (let i = 0; i < spec.n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: glowTexture(spec.kind, spec.colors[i % spec.colors.length]),
        transparent: true,
        depthWrite: false,
      })
      const s = new THREE.Sprite(mat)
      s.renderOrder = spec.order ?? 6
      s.frustumCulled = false
      this.sprites.push(s)
      this.group.add(s)
    }
  }

  update(t: number, level = 1) {
    const sp = this.spec
    this.group.visible = level > 0.01
    if (!this.group.visible) return
    if (sp.rise) {
      this.group.updateWorldMatrix(true, false)
      this.group.matrixWorld.decompose(this.p, this.q, this.sc)
      this.up.set(0, 1, 0).applyQuaternion(this.q.invert()).normalize()
    }
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i]
      const base = this.seed * 977 + i * 131
      const life = sp.life[0] + (sp.life[1] - sp.life[0]) * hash(base + 1)
      const x = t / life + hash(base + 2)
      const cycle = Math.floor(x)
      const a = x - cycle
      const r = (k: number) => hash(base + cycle * 7919 + k * 31)
      sp.from(r, this.p)
      if (sp.vel) {
        sp.vel(r, this.vel)
        this.p.addScaledVector(this.vel, a * life)
      }
      if (sp.acc) this.p.add(this.vel.set(...sp.acc).multiplyScalar(0.5 * (a * life) ** 2))
      if (sp.rise) this.p.addScaledVector(this.up, sp.rise * a * life)
      s.position.copy(this.p)
      const tw = sp.twinkle ? 1 - sp.twinkle * (0.5 + 0.5 * Math.sin(t * 13 + i * 2.3)) : 1
      const size = (sp.size[0] + (sp.size[1] - sp.size[0]) * r(5)) * (1 + ((sp.grow ?? 1) - 1) * a) * tw
      s.scale.setScalar(size * Math.min(1, a / 0.12))
      const m = s.material
      m.opacity = (sp.opacity ?? 1) * level * Math.min(1, a / 0.15) * (a > 0.6 ? 1 - (a - 0.6) / 0.4 : 1)
      m.rotation = sp.spin ? (r(6) * 6 + t * sp.spin * (r(7) > 0.5 ? 1 : -1)) : 0
    }
  }

  dispose() {
    this.group.removeFromParent()
    for (const s of this.sprites) s.material.dispose()
  }
}

/** Sprite de luz suelto (halo detrás de una gema, resplandor). */
export function glowSprite(kind: GlowKind, color: string, size: number, opacity = 1, order = 6) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(kind, color), transparent: true, depthWrite: false, opacity }))
  s.scale.setScalar(size)
  s.renderOrder = order
  s.frustumCulled = false
  return s
}

// ---------- Aura ----------

/** Radio del círculo mágico según la etapa (unidades del modelo). */
const AURA_R = { egg: 0.5, chick: 0.62, hen: 0.66, box: 0.52, cat: 0.6 }

/**
 * Aura de leyenda: círculo de runas que gira en el piso, resplandor detrás y luces que suben.
 * Se prende con un objeto legendario puesto o durante un baile legendario.
 */
export class Aura {
  readonly group = new THREE.Group()
  private outer: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private inner: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private halo: THREE.Sprite
  private beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>
  private motes: Motes[] = []
  private color = ''
  private r: number

  constructor(
    kind: keyof typeof AURA_R,
    private height: number,
  ) {
    const r = (this.r = AURA_R[kind])
    const plane = (size: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 }),
      )
      m.renderOrder = 1
      return m
    }
    this.outer = plane(r * 2)
    this.inner = plane(r * 1.25)
    this.inner.position.y = 0.002
    this.halo = glowSprite('soft', '#ffffff', height * 2.2, 0, 0)
    this.halo.position.set(0, height * 0.5, -0.3)
    // Columna de luz (solo en los bailes): un tubo abierto con degradé hacia arriba.
    const beamTex = canvasTex('beam', 64, (g, s) => {
      const gr = g.createLinearGradient(0, s, 0, 0)
      gr.addColorStop(0, 'rgba(255,255,255,0.85)')
      gr.addColorStop(0.35, 'rgba(255,255,255,0.3)')
      gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr
      g.fillRect(0, 0, s, s)
    })
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.78, r * 0.92, height * 2.6, 40, 1, true).translate(0, height * 1.3, 0),
      new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
    )
    this.beam.renderOrder = 2
    this.group.add(this.outer, this.inner, this.halo, this.beam)
  }

  private setColor(color: string, accent: string) {
    if (color === this.color) return
    this.color = color
    this.outer.material.map = runeTexture(color)
    this.inner.material.map = runeTexture(accent, true)
    this.outer.material.color.set(color).lerp(new THREE.Color('#ffffff'), 0.35)
    this.inner.material.color.set(accent).lerp(new THREE.Color('#ffffff'), 0.35)
    this.outer.material.needsUpdate = this.inner.material.needsUpdate = true
    this.halo.material.map = glowTexture('soft', color)
    this.halo.material.needsUpdate = true
    this.beam.material.color.set(color).lerp(new THREE.Color('#ffffff'), 0.5)
    for (const m of this.motes) m.dispose()
    const r = this.r
    const h = this.height
    // Luces que suben desde el círculo y chispas que titilan alrededor.
    this.motes = [
      new Motes({
        n: 16,
        kind: 'ember',
        colors: [color, accent],
        life: [1.6, 2.6],
        size: [0.05, 0.09],
        from: (q, o) => {
          const a = q(1) * Math.PI * 2
          const d = r * (0.55 + 0.4 * q(2))
          o.set(Math.cos(a) * d, 0.02, Math.sin(a) * d)
        },
        vel: (q, o) => o.set((q(3) - 0.5) * 0.05, 0, (q(4) - 0.5) * 0.05),
        rise: h * 0.55,
        grow: 0.4,
      }, 11),
      new Motes({
        n: 7,
        kind: 'spark',
        colors: ['#ffffff', accent],
        life: [0.9, 1.5],
        size: [0.08, 0.13],
        from: (q, o) => {
          const a = q(1) * Math.PI * 2
          const d = r * (0.75 + 0.3 * q(2))
          o.set(Math.cos(a) * d, h * (0.2 + 0.8 * q(3)), Math.sin(a) * d * 0.7)
        },
        twinkle: 0.5,
        spin: 1.2,
      }, 23),
    ]
    for (const m of this.motes) this.group.add(m.group)
  }

  /**
   * `level` 0–1 (se prende/apaga suave), `beam` 0–1 (columna de luz), `pos` dónde está parada
   * la mascota (x, z) y `floor` la altura del piso en el espacio del grupo.
   */
  update(t: number, level: number, beam: number, color: string, accent: string, x: number, z: number, floor: number) {
    this.group.visible = level > 0.01
    if (!this.group.visible) return
    this.setColor(color, accent)
    this.group.position.set(x, floor, z)
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4)
    this.outer.rotation.y = t * 0.35
    this.inner.rotation.y = -t * 0.6
    const k = level * (0.75 + 0.25 * pulse)
    this.outer.material.opacity = 0.8 * k
    this.inner.material.opacity = 0.7 * k
    this.outer.scale.setScalar(1 + 0.03 * pulse)
    this.halo.material.opacity = level * (0.4 + 0.15 * pulse) + beam * 0.25
    this.halo.scale.setScalar(this.height * (2 + 0.2 * pulse + 0.5 * beam))
    this.beam.visible = beam > 0.01
    this.beam.material.opacity = beam * (0.32 + 0.12 * pulse)
    this.beam.rotation.y = t * 0.5
    for (const m of this.motes) m.update(t, level)
  }

  dispose() {
    this.group.removeFromParent()
    for (const m of this.motes) m.dispose()
    for (const o of [this.outer, this.inner, this.beam]) {
      o.geometry.dispose()
      o.material.dispose()
    }
    this.halo.material.dispose()
  }
}
