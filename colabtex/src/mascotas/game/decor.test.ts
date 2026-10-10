import { describe, expect, it } from 'vitest'
import { CLEAR, ROOM, clampSpot, freeSpot, moveDecor, placeDecor, removeDecor, rotateDecor } from './decor'
import { createPet } from './rules'

const pet = createPet('chicken', 'Lola', 0, 'a')

describe('decoración', () => {
  it('poner otra variante del mismo objeto le cambia los colores (uno de cada cosa)', () => {
    let p = placeDecor(pet, 'chair', 7)
    p = moveDecor(p, 'chair', 0.8, -0.5)
    p = placeDecor(p, 'chair', 9)
    expect(p.decor).toHaveLength(1)
    expect(p.decor![0]).toMatchObject({ tint: 9, x: 0.8, z: -0.5 })
  })

  it('no deja muebles encima de la mascota ni fuera del piso', () => {
    const c = clampSpot('chair', 0.05, 0.02)
    expect(Math.hypot(c.x, c.z)).toBeGreaterThanOrEqual(CLEAR)
    const out = clampSpot('chair', 5, -5)
    expect(out.x).toBeLessThanOrEqual(ROOM.x)
    expect(out.z).toBeGreaterThanOrEqual(ROOM.zMin)
    // Empujado fuera de la mascota contra el borde de adelante, sigue dentro del piso.
    const edge = clampSpot('house', 0.3, 0.6)
    expect(edge.z).toBeLessThanOrEqual(ROOM.zMax)
    expect(Math.abs(edge.x)).toBeLessThanOrEqual(ROOM.x)
    // La alfombra sí puede ir debajo.
    expect(clampSpot('rug', 0, 0)).toEqual({ x: 0, z: 0 })
  })

  it('busca un lugar libre para cada objeto nuevo', () => {
    const a = freeSpot([], 'house')
    const b = freeSpot([{ id: 'house', ...a, rot: 0 }], 'chair')
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.42 + 0.24)
  })

  it('poner, mover, girar y guardar', () => {
    let p = placeDecor(pet, 'lamp')
    expect(p.decor).toHaveLength(1)
    expect(placeDecor(p, 'lamp').decor).toHaveLength(1)
    p = moveDecor(p, 'lamp', 0.7, -0.4)
    expect(p.decor![0]).toMatchObject({ x: 0.7, z: -0.4 })
    p = rotateDecor(p, 'lamp')
    expect(p.decor![0].rot).toBeCloseTo(Math.PI / 4)
    expect(removeDecor(p, 'lamp').decor).toEqual([])
  })
})
