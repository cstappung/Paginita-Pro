import { describe, expect, it } from 'vitest'
import { JUEGO, JUEGOS, lejosDe, sorteaJuego } from './juegos'
import { FOOD_COST, FOOD_FILL, FOODS, foodInfo, foodStock } from './comidas'
import { applyAction, createPet } from './rules'

describe('los juegos de «Jugar»', () => {
  it('sale uno al azar y nunca el mismo dos veces seguidas', () => {
    for (const anterior of JUEGOS) for (const r of [0, 0.3, 0.6, 0.999]) expect(sorteaJuego(anterior, () => r) === anterior).toBe(false)
    expect(new Set([0, 0.26, 0.51, 0.76].map((r) => sorteaJuego(null, () => r))).size).toBe(4)
  })

  it('cada juego tiene su cartel', () => {
    for (const j of JUEGOS) expect(JUEGO[j].titulo.length).toBeGreaterThan(5)
  })

  it('un juguete nuevo queda lejos de la última atrapada y dentro del área', () => {
    const area = { x: 0.78, zMin: -0.25, zMax: 0.62 }
    const p = lejosDe(0.1, 0.1, { x: 0.1, z: 0.12 }, 0.36, area)
    expect(Math.hypot(p.x - 0.1, p.z - 0.12)).toBeGreaterThanOrEqual(0.36)
    // Contra el borde: se va para el otro lado.
    const q = lejosDe(0.78, 0.6, { x: 0.76, z: 0.6 }, 0.36, area)
    expect(Math.hypot(q.x - 0.76, q.z - 0.6)).toBeGreaterThanOrEqual(0.36)
    expect(Math.abs(q.x)).toBeLessThanOrEqual(0.78)
    expect(lejosDe(5, 5, null, 0.36, area)).toEqual({ x: 0.78, z: 0.62 })
  })
})

describe('las comidas', () => {
  const baby = { ...createPet('chicken', 'Pío', 0, 'ma:prueba~-Nabcdefgh'), stage: 'baby' as const }

  it('las mejores llenan más la barra, y cuestan más por punto', () => {
    const hambrienta = { ...baby, stats: { ...baby.stats, hunger: 10 } }
    const sube = FOODS.map((f) => applyAction(hambrienta, 'feed', false, FOOD_FILL[f]).pet.stats.hunger - 10)
    expect(sube).toEqual([35, 60, 90])
    expect(FOOD_COST.premium / FOOD_FILL.premium).toBeGreaterThan(FOOD_COST.comida / FOOD_FILL.comida)
    expect(FOOD_COST.gourmet / FOOD_FILL.gourmet).toBeGreaterThan(FOOD_COST.comida / FOOD_FILL.comida)
  })

  it('cada especie la llama a su manera, y lo que falta cuenta como cero', () => {
    expect(foodInfo('premium', 'cat').name).not.toBe(foodInfo('premium', 'chicken').name)
    expect(foodStock(4, { gourmet: 2 })).toEqual({ comida: 4, premium: 0, gourmet: 2 })
  })
})
