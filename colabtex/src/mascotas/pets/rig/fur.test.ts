import { describe, expect, it } from 'vitest'
import { randomCoat } from '../../game/look'
import { seeded } from '../tint'
import { furColors } from './fur'
import type { Coat } from '../../game/types'

const coat = (o: Partial<Coat>): Coat => ({ brown: 0, dilute: 0, orange: 0, tabby: 0, stripe: 0, white: 0, point: 0, eye: 0.5, seed: 1, ...o })
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const light = (hex: string) => rgb(hex).reduce((a, b) => a + b, 0) / 3

describe('pelaje del gato', () => {
  it('negro sólido es oscuro y el diluido sale gris claro', () => {
    expect(light(furColors(coat({})).base)).toBeLessThan(50)
    const blue = rgb(furColors(coat({ dilute: 1 })).base)
    expect(light(furColors(coat({ dilute: 1 })).base)).toBeGreaterThan(110)
    // Gris azulado: el azul pesa un poco más que el rojo.
    expect(blue[2]).toBeGreaterThanOrEqual(blue[0])
  })

  it('el naranjo es cálido y, diluido, crema', () => {
    const [r, , b] = rgb(furColors(coat({ orange: 1 })).base)
    expect(r).toBeGreaterThan(b + 80)
    expect(light(furColors(coat({ orange: 1, dilute: 1 })).base)).toBeGreaterThan(light(furColors(coat({ orange: 1 })).base))
    // Los naranjos siempre muestran rayas.
    expect(furColors(coat({ orange: 1 })).tabby).toBeGreaterThan(0)
  })

  it('siameses y gatitos tienen los ojos azules', () => {
    const blue = (hex: string) => rgb(hex)[2] > rgb(hex)[0]
    expect(blue(furColors(coat({ point: 1, eye: 0 })).eye)).toBe(true)
    expect(blue(furColors(coat({ eye: 0 }), true).eye)).toBe(true)
    expect(blue(furColors(coat({ eye: 0 })).eye)).toBe(false)
    // El siamés tiene el cuerpo claro y las puntas oscuras.
    const s = furColors(coat({ point: 1 }))
    expect(light(s.base)).toBeGreaterThan(light(s.point) + 80)
  })

  it('los genes al azar cubren todo el espectro', () => {
    const r = seeded(9)
    const coats = Array.from({ length: 400 }, () => randomCoat(r))
    expect(coats.some((c) => c.orange >= 0.85)).toBe(true)
    expect(coats.some((c) => c.orange > 0.2 && c.orange < 0.8)).toBe(true)
    expect(coats.some((c) => c.point > 0.5)).toBe(true)
    expect(coats.some((c) => c.white > 0.85)).toBe(true)
    expect(coats.some((c) => c.dilute > 0.5)).toBe(true)
    // Ninguno igual a otro.
    expect(new Set(coats.map((c) => furColors(c).base)).size).toBeGreaterThan(300)
  })
})
