import { describe, expect, it } from 'vitest'
import { hueMap, tintHex, withTint } from './tint'

describe('colores de los objetos', () => {
  it('sin semilla quedan los colores originales', () => {
    expect(withTint(0, undefined, () => tintHex('#e85d75'))).toBe('#e85d75')
    expect(tintHex('#e85d75')).toBe('#e85d75')
  })

  it('con semilla cambian, pero no los grises ni lo que se mantiene', () => {
    const out = withTint(12345, ['#a8e1ff'], () => [tintHex('#e85d75'), tintHex('#ffffff'), tintHex('#a8e1ff')])
    expect(out[0]).not.toBe('#e85d75')
    expect(out[1]).toBe('#ffffff')
    expect(out[2]).toBe('#a8e1ff')
  })

  it('distintas semillas dan colores distintos y la misma semilla, el mismo', () => {
    const a = withTint(1, undefined, () => tintHex('#e85d75'))
    const b = withTint(2, undefined, () => tintHex('#e85d75'))
    expect(a).not.toBe(b)
    expect(withTint(1, undefined, () => tintHex('#e85d75'))).toBe(a)
  })

  it('tonos parecidos se mueven parecido (las sombras siguen calzando)', () => {
    for (let seed = 1; seed < 50; seed++) {
      const m = hueMap(seed)
      const d = Math.abs(((m([20, 0.6, 0.5])[0] - m([30, 0.6, 0.5])[0] + 540) % 360) - 180)
      expect(d).toBeLessThan(45)
    }
  })
})
