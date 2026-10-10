import { RigBuilder, canvasTexture, joint, lathe, rng, toon } from './kit'
import type { PetRig } from './types'

// Huevo: más ancho abajo, con pintitas. A medida que se acerca a nacer le aparecen grietas.

export const EGG = {
  colors: { shell: '#f7e6c4', speck: '#d9a86f', crack: '#5a3a22' },
  profile: Array.from({ length: 17 }, (_, i) => {
    const t = (i / 16) * Math.PI
    return [0.375 * Math.sin(t) * (1 + 0.1 * Math.cos(t)), ((1 - Math.cos(t)) / 2) * 0.98] as [number, number]
  }),
}

/** Dibuja la cáscara con pintitas y, según el nivel (0–3), cada vez más grietas en la parte de arriba. */
function drawShell(ctx: CanvasRenderingContext2D, w: number, h: number, level: number, c: EggColors) {
  ctx.fillStyle = c.shell
  ctx.fillRect(0, 0, w, h)
  const rand = rng(11)
  ctx.fillStyle = c.speck
  for (let i = 0; i < 46; i++) {
    const x = rand() * w
    const y = (0.12 + rand() * 0.72) * h
    const r = 5 + rand() * 9
    ctx.beginPath()
    ctx.ellipse(x, y, r * 1.3, r, rand() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  if (level <= 0) return
  // Grietas: zigzag horizontal alrededor del frente (u ≈ 0,5), más largas con cada nivel.
  ctx.strokeStyle = c.crack
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const crack = (u0: number, u1: number, v: number, amp: number, width: number) => {
    ctx.lineWidth = width
    ctx.beginPath()
    const steps = Math.max(3, Math.round((u1 - u0) * 40))
    for (let i = 0; i <= steps; i++) {
      const u = u0 + ((u1 - u0) * i) / steps
      const y = (1 - v + (i % 2 ? amp : -amp)) * h
      if (i === 0) ctx.moveTo(u * w, y)
      else ctx.lineTo(u * w, y)
    }
    ctx.stroke()
  }
  if (level >= 1) crack(0.44, 0.56, 0.66, 0.025, 7)
  if (level >= 2) {
    crack(0.34, 0.66, 0.66, 0.03, 8)
    crack(0.52, 0.6, 0.72, 0.02, 5)
  }
  if (level >= 3) {
    crack(0.18, 0.84, 0.66, 0.035, 9)
    crack(0.36, 0.46, 0.6, 0.02, 5)
    crack(0.6, 0.7, 0.73, 0.02, 5)
  }
}

export type EggColors = typeof EGG.colors

/** `c`: colores de la cáscara (ver plumage.ts); sin ellos, el huevo crema clásico. */
export function buildEgg(c: EggColors = EGG.colors): PetRig {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  drawShell(ctx, canvas.width, canvas.height, 0, c)
  const tex = canvasTexture(1, 1, () => {})
  tex.image = canvas
  tex.needsUpdate = true
  const shell = toon('#ffffff', tex)

  const root = joint('root', null, [0, 0, 0])
  const body = joint('body', root, [0, 0, 0])
  const hatSocket = joint('hat', body, [0, 0.7, 0])
  const b = new RigBuilder(root)
  b.add(body, lathe(EGG.profile, { segments: 48 }), shell)
  b.finish()

  let level = 0
  return {
    kind: 'egg',
    root,
    joints: { root, body },
    materials: [shell],
    legs: [],
    sockets: { hat: { obj: hatSocket, radius: 0.28 }, feet: [], wings: [] },
    hideWithHat: [],
    toes: [],
    height: 1,
    peckTarget: [0, 0, 0.45],
    setProgress: (p: number) => {
      const next = p >= 0.85 ? 3 : p >= 0.6 ? 2 : p >= 0.3 ? 1 : 0
      if (next === level) return
      level = next
      drawShell(ctx, canvas.width, canvas.height, level, c)
      tex.needsUpdate = true
    },
  }
}
