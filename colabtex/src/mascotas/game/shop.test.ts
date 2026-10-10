import { describe, expect, it } from 'vitest'
import { isOwned, priceOf } from './shop'

describe('tienda de fondos', () => {
  it('lo gratis cuenta como propio', () => {
    expect(isOwned([], 'meadow')).toBe(true)
    expect(isOwned([], 'sunset')).toBe(false)
    expect(isOwned(['sunset'], 'sunset')).toBe(true)
  })

  it('los precios son los del motor (y de la regla), sin cambios', () => {
    expect(['meadow', 'sunset', 'night', 'beach', 'snow'].map(priceOf)).toEqual([0, 10, 15, 20, 25])
    expect(priceOf('nada')).toBe(null)
  })
})
