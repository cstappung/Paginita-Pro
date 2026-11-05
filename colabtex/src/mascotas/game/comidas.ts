import MM from '../../../../juegos/mascotas/motor.js'
import type { SpeciesId } from './types'

// Las comidas: la común (la de siempre) y dos que llenan más la barra, un poco más caras por
// punto. Los precios y cuánto llenan vienen del motor (los mismos que piden la regla y la
// economía). Las raciones sirven para todas las mascotas: el nombre cambia según quién come.

export type FoodId = 'comida' | 'premium' | 'gourmet'
export const FOODS: readonly FoodId[] = ['comida', 'premium', 'gourmet']

/** Puntos que sube la barra de comida una ración. */
export const FOOD_FILL: Record<FoodId, number> = { comida: MM.LLENA.comida, premium: MM.LLENA.premium, gourmet: MM.LLENA.gourmet }
/** Precio de una ración. */
export const FOOD_COST: Record<FoodId, number> = { comida: MM.PRECIO.comida, premium: MM.PRECIO.comidas.premium, gourmet: MM.PRECIO.comidas.gourmet }

const NOMBRES: Partial<Record<SpeciesId, Record<FoodId, { name: string; icon: string }>>> = {
  chicken: {
    comida: { name: 'Granos', icon: '🌾' },
    premium: { name: 'Maíz dorado', icon: '🌽' },
    gourmet: { name: 'Gusanos de lujo', icon: '🪱' },
  },
  cat: {
    comida: { name: 'Croquetas', icon: '🐟' },
    premium: { name: 'Atún', icon: '🥫' },
    gourmet: { name: 'Salmón gourmet', icon: '🍣' },
  },
}
const CLASE: Record<FoodId, string> = { comida: 'Común', premium: 'Premium', gourmet: 'Gourmet' }

/** Cómo se llama y se ve una comida (para la especie de quien come; sin especie, la de la gallina). */
export function foodInfo(id: FoodId, species?: SpeciesId) {
  const n = NOMBRES[species ?? 'chicken']?.[id] ?? NOMBRES.chicken![id]
  return { ...n, clase: CLASE[id], fill: FOOD_FILL[id], cost: FOOD_COST[id] }
}

/** Las raciones que quedan de cada comida, a partir de lo que manda el cartero (faltantes = 0). */
export function foodStock(comida: number, otras?: Partial<Record<FoodId, number>>): Record<FoodId, number> {
  const n = (v: unknown) => (Number.isFinite(v) ? Math.max(0, Math.floor(v as number)) : 0)
  return { comida: n(comida), premium: n(otras?.premium), gourmet: n(otras?.gourmet) }
}
