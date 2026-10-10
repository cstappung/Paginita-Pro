import { describe, expect, it } from 'vitest'
import { chickColors, eggColors, henColors } from './plumage'
import { genesDe, semillaDe } from '../../game/look'
import type { Look } from '../../game/types'

/** Canales (0–1) de un "#rrggbb". */
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const light = (hex: string) => {
  const c = rgb(hex)
  return (Math.max(...c) + Math.min(...c)) / 2
}
const look = (o: Partial<Look>): Look => ({ mel: 0.5, pig: 0.8, red: 0.5, contrast: 0, shell: 0.3, blue: 0, ...o })

describe('colores de la mascota', () => {
  it('gallina blanca → pollito amarillo; gallina negra → pollito negro', () => {
    const white = look({ mel: 0.02 })
    const black = look({ mel: 0.98 })
    expect(light(henColors(white).body)).toBeGreaterThan(0.85)
    expect(light(henColors(black).body)).toBeLessThan(0.2)
    expect(light(chickColors(black).body)).toBeLessThan(0.25)
    // Amarillo: rojo y verde altos, azul bajo.
    const [r, g, b] = rgb(chickColors(white).body)
    expect(r).toBeGreaterThan(0.85)
    expect(g).toBeGreaterThan(0.7)
    expect(b).toBeLessThan(0.45)
  })

  it('es un espectro continuo, no una lista de colores', () => {
    // Doscientas adopciones distintas (la semilla sale de cada una).
    const bodies = new Set(Array.from({ length: 200 }, (_, i) => henColors(genesDe('chicken', semillaDe('gallina' + i)) as Look).body))
    expect(bodies.size).toBeGreaterThan(150)
    // Más melanina, más oscura (paso a paso).
    let prev = 1
    for (let m = 0; m <= 1.0001; m += 0.1) {
      const l = light(henColors(look({ mel: m })).body)
      expect(l).toBeLessThanOrEqual(prev + 0.01)
      prev = l
    }
  })

  it('el huevo va de blanco a café, o azul verdoso', () => {
    expect(light(eggColors(look({ shell: 0 })).shell)).toBeGreaterThan(light(eggColors(look({ shell: 1 })).shell))
    const [r, , b] = rgb(eggColors(look({ blue: 0.8, shell: 0 })).shell)
    expect(b).toBeGreaterThan(r)
  })
})
