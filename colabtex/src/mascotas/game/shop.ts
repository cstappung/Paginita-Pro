import { BACKGROUNDS } from '../data/accessories'
import MM from '../../../../juegos/mascotas/motor.js'

// Tienda directa: solo los fondos de la escena. Se compran una vez por cuenta y quedan en la
// economía del sitio (`mascotas/c`, k = `fondo-<id>`); la pradera es gratis. Los cosméticos salen
// de regalos o del mercado.

/** Lo que cuesta un fondo (0 la pradera, null si no existe). Los precios son los del motor, que son los de la regla. */
export function priceOf(id: string): number | null {
  if (!BACKGROUNDS.some((b) => b.id === id)) return null
  return id === 'meadow' ? 0 : ((MM.PRECIO.fondos as Record<string, number>)[id] ?? null)
}

/** Si un fondo se puede usar: el gratis siempre, el resto si se compró. */
export function isOwned(owned: readonly string[], id: string) {
  return priceOf(id) === 0 || owned.includes(id)
}
