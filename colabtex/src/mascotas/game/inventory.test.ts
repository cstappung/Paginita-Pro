import { describe, expect, it } from 'vitest'
import MM from '../../../../juegos/mascotas/motor.js'
import { DANCE_BAR, FOOD_PRICE, GIFT_PRICE, LEGENDARY_CHANCE, POTION_PRICE, defaultDanceBar, giftPool, isStarter, onlyUsable, starterItems, takeFromOthers, toggleDance, usedBy } from './inventory'
import { createPet, equip } from './rules'
import { placeDecor } from './decor'

describe('inventario y regalos', () => {
  it('se parte con lo básico, igual que dice el motor', () => {
    const items = starterItems()
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual(expect.arrayContaining(['hat:beanie', 'boots:rain', 'outfit:sweater', 'shoes:sneakers', 'dance:salsa']))
    expect(items.every((i) => i.tint === 0 && isStarter(i))).toBe(true)
    expect(items).toEqual(MM.INICIALES)
  })

  it('los precios nuevos', () => {
    expect([GIFT_PRICE, POTION_PRICE, FOOD_PRICE, MM.PRECIO.adopcion, MM.MAX_MASCOTAS]).toEqual([500, 1000, 20, 1000, 6])
    expect(LEGENDARY_CHANCE).toBe(0.06)
  })

  it('el catálogo del juego y el del motor son el mismo, en el mismo orden', () => {
    expect(giftPool().map((p) => [p.kind, p.id, p.legendary])).toEqual(MM.POOL.map((p: { kind: string; id: string; leg: boolean }) => [p.kind, p.id, p.leg]))
  })

  it('un regalo se deriva: el mismo (uid, clave, hora) da siempre lo mismo', () => {
    const a = MM.regalo('uidPrueba1', '-Nabcdefgh', 1791600000000)
    expect(MM.regalo('uidPrueba1', '-Nabcdefgh', 1791600000000)).toEqual(a)
    expect(MM.regalo('uidPrueba1', '-Nabcdefgh', 1791600000001)).not.toBe(a)
    if (a.kind === 'dance') expect(a.tint).toBe(0)
    else expect(a.tint).toBeGreaterThan(0)
  })

  it('los legendarios salen poco (6 %), y salen de todo el catálogo', () => {
    let legend = 0
    const vistos = new Set<string>()
    const n = 20000
    for (let i = 0; i < n; i++) {
      const r = MM.regalo('uidPrueba1', 'clave' + i, 1791600000000 + i)
      if (r.leg) legend++
      vistos.add(r.kind + ':' + r.id)
    }
    expect(legend / n).toBeGreaterThan(0.05)
    expect(legend / n).toBeLessThan(0.07)
    expect(vistos.size).toBe(MM.POOL.length)
  })

  it('barra de bailes: poner, sacar, reemplazar el igual y sacar el más antiguo si está llena', () => {
    const items = [...starterItems(), { uid: 'x', kind: 'dance' as const, id: 'salsa', tint: 0 }, { uid: 'm', kind: 'dance' as const, id: 'moonwalk', tint: 0 }]
    let bar = defaultDanceBar(items)
    expect(bar).toHaveLength(DANCE_BAR)
    expect(toggleDance(bar, items, bar[1]).bar).toHaveLength(DANCE_BAR - 1)
    // Otra salsa reemplaza a la que estaba, en su lugar.
    expect(toggleDance(bar, items, 'x').bar[0]).toBe('x')
    const r = toggleDance(bar, items, 'm')
    expect(r.out?.uid).toBe(bar[0])
    bar = r.bar
    expect(bar).toContain('m')
    expect(bar).toHaveLength(DANCE_BAR)
  })
})

describe('cada objeto en una sola mascota', () => {
  const hat = { uid: 'h1', kind: 'hat' as const, id: 'crown', tint: 5 }
  const rug = { uid: 'r1', kind: 'decor' as const, id: 'rug', tint: 0 }

  it('ponérselo a otra se lo saca a la primera', () => {
    let a = equip(createPet('chicken', 'A', 0, 'a'), 'hat', hat)
    let b = createPet('cat', 'B', 0, 'b')
    expect(usedBy([a, b], hat)?.id).toBe('a')
    ;[a, b] = takeFromOthers([a, b], hat, 'b')
    b = equip(b, 'hat', hat)
    expect(a.wear?.hat).toBeUndefined()
    expect(usedBy([a, b], hat)?.id).toBe('b')
  })

  it('los muebles también (compartidos entre gallinas y gatos)', () => {
    const a = placeDecor(createPet('chicken', 'A', 0, 'a'), 'rug', 0, 'r1')
    const [a2] = takeFromOthers([a, createPet('cat', 'B', 0, 'b')], rug, 'b')
    expect(a2.decor).toEqual([])
  })

  it('lo vendido o puesto a la venta deja de llevarse', () => {
    const a = placeDecor(equip(createPet('chicken', 'A', 0, 'a'), 'hat', hat), 'rug', 0, 'r1')
    const sinVenta = onlyUsable(a, [hat, rug])
    expect(sinVenta.wear?.hat).toBe('h1')
    const conVenta = onlyUsable(a, [{ ...hat, venta: 'oferta1' }])
    expect(conVenta.wear?.hat).toBeUndefined()
    expect(conVenta.decor).toEqual([])
  })
})
