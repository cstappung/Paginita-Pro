import * as THREE from 'three'
import { INK } from './rig/kit'

// Partículas dibujadas a mano (corazones, notas, zetas, granos, burbujas, gotas, chispas…).
// Son sprites con textura de canvas, con trazo de tinta para que combinen con el look toon.

export type FxKind = 'heart' | 'note' | 'note2' | 'z' | 'grain' | 'bubble' | 'drop' | 'sparkle' | 'star' | 'puff' | 'fly' | 'shell' | 'potion' | 'pdrop' | 'kibble' | 'card'

const S = 128

function draw(kind: FxKind, g: CanvasRenderingContext2D) {
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.strokeStyle = INK
  g.lineWidth = 9
  const fillStroke = (fill: string) => {
    g.fillStyle = fill
    g.fill()
    g.stroke()
  }
  switch (kind) {
    case 'heart': {
      g.beginPath()
      g.moveTo(64, 108)
      g.bezierCurveTo(30, 84, 10, 62, 16, 40)
      g.bezierCurveTo(22, 16, 54, 14, 64, 38)
      g.bezierCurveTo(74, 14, 106, 16, 112, 40)
      g.bezierCurveTo(118, 62, 98, 84, 64, 108)
      g.closePath()
      fillStroke('#ff6f91')
      g.fillStyle = '#ffd0dc'
      g.beginPath()
      g.ellipse(40, 40, 9, 6, -0.6, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'note':
    case 'note2': {
      const fill = kind === 'note' ? '#7a5cff' : '#ff8a3d'
      g.fillStyle = fill
      if (kind === 'note') {
        g.beginPath()
        g.ellipse(46, 96, 22, 16, -0.4, 0, Math.PI * 2)
        fillStroke(fill)
        g.beginPath()
        g.moveTo(64, 92)
        g.lineTo(64, 18)
        g.quadraticCurveTo(84, 30, 98, 52)
        g.lineWidth = 10
        g.stroke()
      } else {
        for (const x of [34, 88]) {
          g.beginPath()
          g.ellipse(x, 98, 18, 13, -0.4, 0, Math.PI * 2)
          fillStroke(fill)
        }
        g.lineWidth = 9
        g.beginPath()
        g.moveTo(50, 96)
        g.lineTo(50, 24)
        g.lineTo(104, 14)
        g.lineTo(104, 92)
        g.stroke()
        g.lineWidth = 12
        g.beginPath()
        g.moveTo(50, 28)
        g.lineTo(104, 18)
        g.stroke()
      }
      break
    }
    case 'z': {
      g.font = '900 104px system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.lineWidth = 12
      g.strokeText('Z', 64, 68)
      g.fillStyle = '#8fc7ff'
      g.fillText('Z', 64, 68)
      break
    }
    case 'grain': {
      g.beginPath()
      g.ellipse(64, 64, 34, 24, 0.5, 0, Math.PI * 2)
      fillStroke('#f2c14e')
      g.fillStyle = '#fff1b8'
      g.beginPath()
      g.ellipse(52, 54, 10, 6, 0.5, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'kibble': {
      // Croqueta de pescadito.
      g.beginPath()
      g.moveTo(22, 64)
      g.quadraticCurveTo(52, 30, 88, 56)
      g.lineTo(108, 40)
      g.lineTo(104, 88)
      g.lineTo(88, 72)
      g.quadraticCurveTo(52, 98, 22, 64)
      g.closePath()
      fillStroke('#c47a3a')
      g.fillStyle = '#3a2416'
      g.beginPath()
      g.arc(40, 60, 5, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'card': {
      // Pedazo de cartón con un trozo de cinta.
      g.beginPath()
      for (const [x, y] of [
        [18, 34],
        [96, 22],
        [110, 90],
        [58, 106],
        [26, 92],
      ])
        g.lineTo(x, y)
      g.closePath()
      fillStroke('#c8955a')
      g.fillStyle = '#e8c58c'
      g.fillRect(50, 26, 18, 76)
      break
    }
    case 'bubble': {
      g.lineWidth = 6
      g.beginPath()
      g.arc(64, 64, 52, 0, Math.PI * 2)
      g.fillStyle = 'rgba(190,232,255,0.45)'
      g.fill()
      g.strokeStyle = '#5aa9d6'
      g.stroke()
      g.fillStyle = '#fff'
      g.beginPath()
      g.ellipse(44, 42, 14, 9, -0.7, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'drop': {
      g.beginPath()
      g.moveTo(64, 10)
      g.bezierCurveTo(70, 40, 100, 62, 100, 84)
      g.arc(64, 84, 36, 0, Math.PI)
      g.bezierCurveTo(28, 62, 58, 40, 64, 10)
      fillStroke('#6cc4f5')
      g.fillStyle = '#e6f7ff'
      g.beginPath()
      g.ellipse(50, 84, 8, 12, 0.3, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'potion': {
      // Frasco redondo de la poción eterna: líquido morado brillante, cuello y corcho.
      g.lineWidth = 5
      g.beginPath()
      g.arc(64, 80, 36, 0, Math.PI * 2)
      g.fillStyle = 'rgba(235,245,255,0.9)'
      g.fill()
      g.save()
      g.beginPath()
      g.arc(64, 80, 33, 0, Math.PI * 2)
      g.clip()
      g.fillStyle = '#9b5cff'
      g.fillRect(20, 72, 88, 60)
      g.fillStyle = '#c79bff'
      g.fillRect(20, 70, 88, 8)
      g.restore()
      g.beginPath()
      g.arc(64, 80, 36, 0, Math.PI * 2)
      g.stroke()
      g.beginPath()
      g.rect(52, 22, 24, 26)
      fillStroke('rgba(235,245,255,0.9)')
      g.beginPath()
      g.rect(48, 10, 32, 15)
      fillStroke('#c98a4b')
      g.fillStyle = '#fff'
      g.beginPath()
      g.ellipse(48, 68, 7, 12, 0.5, 0, Math.PI * 2)
      g.fill()
      for (const [x, y] of [[78, 96], [56, 104], [70, 86]]) {
        g.beginPath()
        g.arc(x, y, 4, 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'pdrop': {
      g.beginPath()
      g.moveTo(64, 10)
      g.bezierCurveTo(70, 40, 100, 62, 100, 84)
      g.arc(64, 84, 36, 0, Math.PI)
      g.bezierCurveTo(28, 62, 58, 40, 64, 10)
      fillStroke('#a46bff')
      g.fillStyle = '#efe2ff'
      g.beginPath()
      g.ellipse(50, 84, 8, 12, 0.3, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'sparkle': {
      g.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 ? 16 : 56
        g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r)
      }
      g.closePath()
      g.lineWidth = 7
      fillStroke('#fff27a')
      break
    }
    case 'star': {
      g.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 ? 24 : 54
        g.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r)
      }
      g.closePath()
      fillStroke('#ffd23f')
      break
    }
    case 'puff': {
      g.lineWidth = 7
      g.beginPath()
      for (const [x, y, r] of [
        [44, 72, 30],
        [80, 70, 32],
        [62, 48, 30],
      ])
        g.moveTo(x + r, y), g.arc(x, y, r, 0, Math.PI * 2)
      g.strokeStyle = '#d8cbb8'
      g.stroke()
      g.fillStyle = '#fffaf0'
      g.fill()
      break
    }
    case 'fly': {
      g.fillStyle = 'rgba(220,240,255,0.9)'
      g.lineWidth = 5
      for (const s of [-1, 1]) {
        g.beginPath()
        g.ellipse(64 + s * 22, 46, 20, 12, s * 0.5, 0, Math.PI * 2)
        g.fill()
        g.stroke()
      }
      g.beginPath()
      g.arc(64, 70, 22, 0, Math.PI * 2)
      g.fillStyle = '#3b3b45'
      g.fill()
      break
    }
    case 'shell': {
      g.beginPath()
      g.moveTo(20, 80)
      for (const [x, y] of [
        [36, 40],
        [52, 64],
        [70, 28],
        [86, 60],
        [108, 44],
        [102, 96],
        [30, 104],
      ])
        g.lineTo(x, y)
      g.closePath()
      fillStroke('#f7e6c4')
      break
    }
  }
}

const textures = new Map<FxKind, THREE.Texture>()
function texture(kind: FxKind) {
  let t = textures.get(kind)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = c.height = S
    draw(kind, c.getContext('2d')!)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    textures.set(kind, t)
  }
  return t
}

export interface EmitOptions {
  vel?: [number, number, number]
  life?: number
  size?: number
  /** Aceleración vertical (negativa = cae). */
  gravity?: number
  /** Frena el movimiento (0 = nada, 3 = mucho). */
  drag?: number
  /** Se queda apoyada al tocar el suelo. */
  ground?: boolean
  /** Bamboleo lateral (corazones, notas, zetas). */
  sway?: number
  spin?: number
  delay?: number
  /** Da vueltas alrededor del punto de origen con este radio (moscas). */
  orbit?: number
}

interface Particle {
  sprite: THREE.Sprite
  mat: THREE.SpriteMaterial
  kind: FxKind
  age: number
  life: number
  size: number
  vel: THREE.Vector3
  gravity: number
  drag: number
  ground: boolean
  sway: number
  spin: number
  phase: number
  orbit: number
  base: THREE.Vector3
}

/** Sistema de partículas de una mascota (en el espacio de la mascota, ya escalado). */
export class Fx {
  readonly group = new THREE.Group()
  /** Partículas propias de la especie (el gato come croquetas en vez de granos…). */
  swap: Partial<Record<FxKind, FxKind>> = {}
  private live: Particle[] = []
  private pool: Particle[] = []

  emit(kind: FxKind, pos: THREE.Vector3 | [number, number, number], o: EmitOptions = {}) {
    kind = this.swap[kind] ?? kind
    if (this.live.length > 120) return
    const p =
      this.pool.pop() ??
      (() => {
        const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false })
        const sprite = new THREE.Sprite(mat)
        sprite.renderOrder = 5
        // Las partículas no cuentan al apuntar (la esponja frota la mascota, no la espuma).
        sprite.raycast = () => {}
        return { sprite, mat, vel: new THREE.Vector3(), base: new THREE.Vector3() } as Particle
      })()
    p.kind = kind
    p.mat.map = texture(kind)
    p.mat.rotation = 0
    p.mat.opacity = 1
    p.mat.needsUpdate = true
    p.age = -(o.delay ?? 0)
    p.life = o.life ?? 1.2
    p.size = o.size ?? 0.12
    p.vel.set(...(o.vel ?? [0, 0.3, 0]))
    p.gravity = o.gravity ?? 0
    p.drag = o.drag ?? 0
    p.ground = o.ground ?? false
    p.sway = o.sway ?? 0
    p.spin = o.spin ?? 0
    p.phase = Math.random() * 6.28
    p.orbit = o.orbit ?? 0
    if (Array.isArray(pos)) p.base.set(...pos)
    else p.base.copy(pos)
    p.sprite.position.copy(p.base)
    p.sprite.visible = p.age >= 0
    p.sprite.scale.setScalar(0.001)
    this.group.add(p.sprite)
    this.live.push(p)
    return p
  }

  /** Quita las partículas de un tipo (p. ej. los granos que ya se comió). */
  take(kind: FxKind, near: THREE.Vector3, radius: number) {
    kind = this.swap[kind] ?? kind
    let best: Particle | null = null
    let bd = radius
    for (const p of this.live) {
      if (p.kind !== kind || p.age < 0) continue
      const d = p.base.distanceTo(near)
      if (d < bd) (bd = d), (best = p)
    }
    if (best) best.life = Math.min(best.life, best.age + 0.08)
    return !!best
  }

  update(dt: number) {
    dt = Math.min(dt, 0.1)
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]
      p.age += dt
      if (p.age < 0) continue
      if (p.age >= p.life) {
        this.group.remove(p.sprite)
        this.live.splice(i, 1)
        this.pool.push(p)
        continue
      }
      p.sprite.visible = true
      p.vel.y += p.gravity * dt
      if (p.drag) p.vel.multiplyScalar(Math.exp(-p.drag * dt))
      p.base.addScaledVector(p.vel, dt)
      if (p.ground && p.base.y < p.size * 0.3) {
        p.base.y = p.size * 0.3
        p.vel.set(0, 0, 0)
      }
      const t = p.age / p.life
      const sway = p.sway ? Math.sin(p.age * 5 + p.phase) * p.sway : 0
      if (p.orbit) {
        // Vuelo de mosca: elipse irregular alrededor del origen, con zigzag vertical.
        const a = p.age * 3.2 + p.phase
        p.sprite.position.set(
          p.base.x + Math.cos(a) * p.orbit,
          p.base.y + Math.sin(a * 2.3) * p.orbit * 0.25,
          p.base.z + Math.sin(a) * p.orbit * 0.7,
        )
      } else p.sprite.position.set(p.base.x + sway, p.base.y, p.base.z)
      // Aparece con un pop y se desvanece al final.
      const pop = Math.min(1, p.age / 0.12)
      const k = p.kind === 'sparkle' ? 0.6 + 0.4 * Math.abs(Math.sin(p.age * 14)) : 1
      p.sprite.scale.setScalar(p.size * (0.4 + 0.6 * pop) * (p.kind === 'bubble' && t > 0.92 ? 1.3 : 1) * k)
      p.mat.opacity = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1
      if (p.spin) p.mat.rotation += p.spin * dt
      else if (p.sway) p.mat.rotation = -sway * 2
    }
  }

  clear() {
    for (const p of this.live) {
      this.group.remove(p.sprite)
      this.pool.push(p)
    }
    this.live = []
  }

  dispose() {
    this.clear()
    for (const p of this.pool) p.mat.dispose()
    this.pool = []
  }
}
