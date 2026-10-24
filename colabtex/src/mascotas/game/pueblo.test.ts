import { describe, expect, it } from 'vitest'
import { CARINO_ANIMO, CARINO_CADA_MS, OBSTACULOS, PLAZA, aPiso, conCarino, entrada, limpiaDicho, nuevosCarinos, puedeCarino, ritmo } from './pueblo'
import { createPet } from './rules'

const libre = (p: { x: number; z: number }) => OBSTACULOS.every((o) => Math.hypot(p.x - o.x, p.z - o.z) >= o.r + 0.29)
const dentro = (p: { x: number; z: number }) => p.x >= PLAZA.xMin && p.x <= PLAZA.xMax && p.z >= PLAZA.zMin && p.z <= PLAZA.zMax

describe('la plaza', () => {
  it('un punto libre queda donde está', () => {
    expect(aPiso(-1.5, 3)).toEqual({ x: -1.5, z: 3 })
  })
  it('nadie se mete en la pileta ni sale de la plaza', () => {
    for (let x = -12; x <= 12; x += 0.37)
      for (let z = -8; z <= 8; z += 0.41) {
        const p = aPiso(x, z)
        expect(dentro(p)).toBe(true)
        expect(libre(p)).toBe(true)
      }
  })
  it('el centro exacto de la pileta sale hacia adelante', () => {
    const p = aPiso(0, -0.6)
    expect(p.z).toBeGreaterThan(-0.6)
    expect(libre(p)).toBe(true)
  })
  it('un punto roto cae en la entrada', () => {
    expect(dentro(aPiso(NaN, 2))).toBe(true)
  })
  it('se entra delante de la pileta', () => {
    for (const r of [0, 0.3, 0.5, 0.99]) {
      const p = entrada(r)
      expect(libre(p)).toBe(true)
      expect(p.z).toBeGreaterThan(2)
    }
  })
  it('las caminatas largas se apuran, sin pasar de un trote', () => {
    expect(ritmo(0.5, 0.2)).toBe(1.6)
    expect(ritmo(3, 0.2)).toBeGreaterThan(ritmo(2, 0.2))
    expect(ritmo(40, 0.2)).toBe(4.5)
    expect(ritmo(3, 0)).toBe(1)
  })
  it('lo que se dice es una línea corta', () => {
    expect(limpiaDicho('  hola\n   vecina  ')).toBe('hola vecina')
    expect(limpiaDicho('x'.repeat(200))).toHaveLength(60)
  })
})

describe('cariños', () => {
  const ahora = 1_800_000_000_000
  const c = (u: string, at: number) => ({ k: 'abcdef~12345678', u, nombre: u, at })
  it('solo los que no se aplicaron, del más viejo al más nuevo', () => {
    const l = [c('b', ahora - 10), c('a', ahora - 500), c('z', ahora - 900)]
    expect(nuevosCarinos(l, ahora - 600, ahora).map((x) => x.u)).toEqual(['a', 'b'])
  })
  it('la primera vez solo cuenta el último día', () => {
    const l = [c('a', ahora - 3 * 86400_000), c('b', ahora - 3600_000)]
    expect(nuevosCarinos(l, undefined, ahora).map((x) => x.u)).toEqual(['b'])
  })
  it('no aplica cariños con la hora en el futuro', () => {
    expect(nuevosCarinos([c('a', ahora + 3600_000)], 0, ahora)).toHaveLength(0)
  })
  it('suben el ánimo sin pasar de 100', () => {
    const p = createPet('chicken', 'Lola', 0, 'a')
    const baja = { ...p, stats: { ...p.stats, happiness: 50 } }
    expect(conCarino(baja, 2).stats.happiness).toBe(50 + 2 * CARINO_ANIMO)
    expect(conCarino(baja, 20).stats.happiness).toBe(100)
    expect(conCarino(baja, 0)).toBe(baja)
  })
  it('una vez al día por visita', () => {
    expect(puedeCarino(null, ahora)).toBe(true)
    expect(puedeCarino(ahora - 3600_000, ahora)).toBe(false)
    expect(puedeCarino(ahora - CARINO_CADA_MS, ahora)).toBe(true)
  })
})
