import { describe, expect, it } from 'vitest'
import { FAINT_ENERGY, GROW_PER_ACTION, GROW_PER_POINT, MAX_OFFLINE_HOURS, START_STATS } from './config'
import { applyAction, createPet, drinkPotion, equip, hoursToWake, hoursToWakeable, mood, puesto, tick } from './rules'
import type { Pet, SlotId } from './types'

const H = 3_600_000
const T0 = 1_000_000

const full = { hunger: START_STATS, happiness: START_STATS, energy: START_STATS, hygiene: START_STATS }
const baby = { ...createPet('chicken', 'Pío', T0, 'a'), stage: 'baby' as const, stats: full }
/** Pone un objeto del catálogo como si fuera del inventario (el uid es el id, para las pruebas). */
const viste = (p: Pet, slot: SlotId, id: string | null) => equip(p, slot, id === null ? null : { uid: `u-${id}`, id })
const lleva = (p: Pet, slot: SlotId) => p.wear?.[slot]?.replace(/^u-/, '')

describe('tick', () => {
  it('baja los stats con el tiempo', () => {
    const after = tick(baby, T0 + 2 * H)
    expect(after.stats.hunger).toBeLessThan(baby.stats.hunger)
    expect(after.lastSeen).toBe(T0 + 2 * H)
  })

  it('descuenta con tope el tiempo con la app cerrada', () => {
    const week = tick(baby, T0 + 168 * H)
    const cap = tick(baby, T0 + MAX_OFFLINE_HOURS * H)
    expect(week.stats).toEqual(cap.stats)
  })

  it('el huevo solo gasta calor e higiene', () => {
    const egg = createPet('chicken', 'Huevito', T0, 'a')
    const after = tick(egg, T0 + H)
    expect(after.stats.hunger).toBe(egg.stats.hunger)
    expect(after.stats.happiness).toBeLessThan(egg.stats.happiness)
  })

  it('si el reloj va para atrás se resincroniza sin tocar los stats', () => {
    const after = tick(baby, T0 - H)
    expect(after.stats).toEqual(baby.stats)
    expect(after.lastSeen).toBe(T0 - H)
  })

  it('el tiempo solo no lo hace crecer', () => {
    const after = tick(baby, T0 + 3 * H)
    expect(after.growth).toBe(0)
    expect(after.stage).toBe('baby')
  })

  it('agotada se queda dormida sola', () => {
    const tired = { ...baby, stats: { ...baby.stats, energy: FAINT_ENERGY + 1 } }
    const after = tick(tired, T0 + 0.5 * H)
    expect(after.asleep).toBe(true)
  })
})

describe('crecimiento por cuidados', () => {
  it('el crecimiento es 1/20 del de la versión suelta', () => {
    expect(GROW_PER_ACTION).toBe(0.05)
    expect(GROW_PER_POINT).toBe(0.005)
  })

  it('el huevo eclosiona abrigándolo y limpiándolo, con paciencia', () => {
    let egg = createPet('chicken', 'Huevito', T0, 'a')
    let n = 0
    // Entre cuidado y cuidado pasa el tiempo: vuelve a tener frío y a ensuciarse.
    while (egg.stage === 'egg' && n < 500) {
      egg = { ...egg, stats: { ...egg.stats, happiness: 40, hygiene: 40 } }
      const r = applyAction(egg, n % 2 ? 'clean' : 'incubate')
      expect(r.ok).toBe(true)
      expect(r.grew).toBeGreaterThan(0)
      egg = r.pet
      n++
    }
    expect(egg.stage).toBe('baby')
    // Antes bastaban 2 cuidados así; con ÷20, unos 39.
    expect(n).toBeGreaterThan(30)
    expect(n).toBeLessThan(60)
  })

  it('alimentarla con hambre la hace crecer (centésimas por cuidado)', () => {
    const r = applyAction({ ...baby, stats: { ...baby.stats, hunger: 50 } }, 'feed')
    // +35 de comida y +3 de ánimo (el pollito cuenta los dos).
    expect(r.grew).toBeCloseTo(GROW_PER_ACTION + 38 * GROW_PER_POINT)
    expect(r.pet.growth).toBeCloseTo(r.grew!)
  })
})

describe('dormir', () => {
  const tired = { ...baby, stats: { ...baby.stats, energy: 20 } }

  it('acostarla no repone la energía de golpe', () => {
    const r = applyAction(tired, 'sleep')
    expect(r.ok).toBe(true)
    expect(r.pet.asleep).toBe(true)
    expect(r.pet.stats.energy).toBe(20)
  })

  it('recupera de a poco, más rápido con la luz apagada', () => {
    const asleep = applyAction(tired, 'sleep').pet
    const light = tick(asleep, T0 + H, false)
    const dark = tick(asleep, T0 + H, true)
    expect(light.stats.energy).toBeGreaterThan(20)
    expect(light.stats.energy).toBeLessThan(100)
    expect(dark.stats.energy).toBeGreaterThan(light.stats.energy)
    expect(hoursToWake(asleep, true)).toBeLessThan(hoursToWake(asleep, false))
  })

  it('despierta sola cuando está lista y lo descansado la hace crecer', () => {
    const asleep = applyAction(tired, 'sleep').pet
    const after = tick(asleep, T0 + (hoursToWake(asleep, true) + 0.01) * H, true)
    expect(after.asleep).toBeFalsy()
    expect(after.stats.energy).toBeGreaterThan(99)
    // Lo descansado (80 puntos de energía) más el premio por dormir de un tirón, ÷20.
    expect(after.growth).toBeCloseTo(80 * GROW_PER_POINT + GROW_PER_ACTION, 1)
  })

  it('mientras duerme no se puede hacer otra cosa', () => {
    const asleep = applyAction(tired, 'sleep').pet
    expect(applyAction(asleep, 'feed').ok).toBe(false)
    expect(applyAction(baby, 'wake').ok).toBe(false)
  })

  it('despertarla antes de tiempo la pone de malas', () => {
    const asleep = applyAction(tired, 'sleep').pet
    const r = applyAction(asleep, 'wake')
    expect(r.ok).toBe(true)
    expect(r.pet.asleep).toBeFalsy()
    expect(r.pet.stats.happiness).toBeLessThan(tired.stats.happiness)
  })

  it('agotada no se la puede despertar todavía', () => {
    const asleep = applyAction({ ...baby, stats: { ...baby.stats, energy: 2 } }, 'sleep').pet
    expect(applyAction(asleep, 'wake').ok).toBe(false)
  })

  it('al rato de quedarse dormida de cansancio ya se la puede despertar', () => {
    const fainted = tick({ ...baby, stats: { ...baby.stats, energy: FAINT_ENERGY } }, T0 + 60_000)
    expect(fainted.asleep).toBe(true)
    const later = tick(fainted, fainted.lastSeen + (hoursToWakeable(fainted, false) + 0.01) * H)
    expect(later.asleep).toBe(true)
    expect(applyAction(later, 'wake').ok).toBe(true)
  })

  it('jugar no la deja tan agotada como para dormirse sola', () => {
    for (let energy = 0; energy <= 100; energy++) {
      const r = applyAction({ ...baby, stats: { ...baby.stats, happiness: 50, energy } }, 'play')
      if (r.ok) expect(r.pet.stats.energy).toBeGreaterThan(FAINT_ENERGY)
    }
  })

  it('a oscuras solo se la puede acostar', () => {
    const hungry = { ...baby, stats: { ...baby.stats, hunger: 20, energy: 50 } }
    expect(applyAction(hungry, 'feed', true).ok).toBe(false)
    expect(applyAction(hungry, 'play', true).ok).toBe(false)
    expect(applyAction(hungry, 'clean', true).ok).toBe(false)
    expect(applyAction(hungry, 'sleep', true).ok).toBe(true)
    const asleep = applyAction(hungry, 'sleep', true).pet
    expect(applyAction(asleep, 'wake', true).ok).toBe(false)
    expect(applyAction(asleep, 'wake', false).ok).toBe(true)
  })

  it('con la poción eterna se queda en su etapa para siempre', () => {
    let egg = drinkPotion(createPet('chicken', 'Huevito', T0, 'a'))
    for (let i = 0; i < 20; i++) {
      const r = applyAction({ ...egg, stats: { ...egg.stats, happiness: 10, hygiene: 10 } }, i % 2 ? 'incubate' : 'clean')
      expect(r.ok).toBe(true)
      egg = r.pet
    }
    expect(egg.stage).toBe('egg')
    expect(egg.growth).toBe(0)
  })

  it('el huevo no duerme', () => {
    const egg = createPet('chicken', 'Huevito', T0, 'a')
    expect(applyAction(egg, 'sleep').ok).toBe(false)
    expect(tick(egg, T0 + 24 * H).asleep).toBeFalsy()
  })
})

describe('applyAction', () => {
  it('alimentar sube el hambre y no da monedas', () => {
    const hungry = { ...baby, stats: { ...baby.stats, hunger: 20 } }
    const r = applyAction(hungry, 'feed')
    expect(r.ok).toBe(true)
    expect(r.pet.stats.hunger).toBe(55)
    expect('coins' in r).toBe(false)
  })

  it('no deja alimentar si está lleno', () => {
    const full = { ...baby, stats: { ...baby.stats, hunger: 100 } }
    const r = applyAction(full, 'feed')
    expect(r.ok).toBe(false)
  })

  it('los stats no pasan de 100 ni bajan de 0', () => {
    expect(applyAction({ ...baby, stats: { ...baby.stats, hunger: 80 } }, 'feed').pet.stats.hunger).toBe(100)
    const tired = { ...baby, stats: { ...baby.stats, energy: 20, hunger: 3 } }
    expect(applyAction(tired, 'play').pet.stats.hunger).toBe(0)
  })

  it('ya feliz igual baila, pero sin el premio de crecimiento (sinPremio)', () => {
    const happy = { ...baby, stage: 'adult' as const, growth: 0, stats: { ...baby.stats, happiness: 100, energy: 80 } }
    const r = applyAction(happy, 'dance')
    expect(r.ok).toBe(true)
    expect(r.grew).toBe(0)
    expect(r.pet.stats.energy).toBeLessThan(80)
    const meh = { ...happy, stats: { ...happy.stats, happiness: 50 } }
    expect(applyAction(meh, 'dance').grew).toBeCloseTo(GROW_PER_ACTION + 22 * GROW_PER_POINT)
  })

  it('el huevo no puede jugar', () => {
    const egg = createPet('chicken', 'Huevito', T0, 'a')
    expect(applyAction(egg, 'play').ok).toBe(false)
  })
})

describe('mood', () => {
  it('se pone triste cuando un stat está muy bajo', () => {
    expect(mood(baby)).toBe('happy')
    expect(mood({ ...baby, stats: { ...baby.stats, hunger: 10 } })).toBe('sad')
  })
})

describe('equip', () => {
  const egg = createPet('chicken', 'Huevito', T0, 'e')

  it('el huevo puede usar sombrero pero no botas', () => {
    expect(lleva(viste(egg, 'hat', 'crown'), 'hat')).toBe('crown')
    expect(lleva(viste(egg, 'boots', 'rain'), 'boots')).toBeUndefined()
  })

  it('el pollito usa sombrero y botas', () => {
    const dressed = viste(viste(baby, 'hat', 'top'), 'boots', 'snow')
    expect(lleva(dressed, 'hat')).toBe('top')
    expect(lleva(dressed, 'boots')).toBe('snow')
  })

  it('rechaza accesorios que no existen y permite quitarlos', () => {
    expect(viste(baby, 'hat', 'inventado')).toBe(baby)
    const withHat = viste(baby, 'hat', 'party')
    expect(lleva(viste(withHat, 'hat', null), 'hat')).toBeUndefined()
  })

  it('lo puesto se pinta con el id y los colores del inventario', () => {
    const p = equip(baby, 'hat', { uid: 'ob:x~k', id: 'crown' })
    const items = [{ uid: 'ob:x~k', kind: 'hat', id: 'crown', tint: 77 }]
    expect(puesto(p, items)).toEqual({ ids: { hat: 'crown' }, tints: { hat: 77 } })
    // Si el objeto ya no está en el inventario (se vendió), no se pinta.
    expect(puesto(p, [])).toEqual({ ids: {}, tints: {} })
  })
})

describe('fase 4: ropa, zapatos y bailes', () => {
  const adult = { ...createPet('chicken', 'Clota', T0, 'ad'), stage: 'adult' as const }

  it('solo la adulta usa ropa y zapatos', () => {
    expect(lleva(viste(baby, 'outfit', 'dress'), 'outfit')).toBeUndefined()
    expect(lleva(viste(baby, 'shoes', 'heels'), 'shoes')).toBeUndefined()
    const dressed = viste(viste(adult, 'outfit', 'dress'), 'shoes', 'heels')
    expect(lleva(dressed, 'outfit')).toBe('dress')
    expect(lleva(dressed, 'shoes')).toBe('heels')
  })

  it('bailar sube la felicidad y gasta energía', () => {
    const r = applyAction({ ...adult, stats: { ...adult.stats, happiness: 50 } }, 'dance')
    expect(r.ok).toBe(true)
    expect(r.pet.stats.happiness).toBeGreaterThan(50)
    expect(r.pet.stats.energy).toBeLessThan(adult.stats.energy)
  })

  it('no baila si está agotada', () => {
    const r = applyAction({ ...adult, stats: { ...adult.stats, energy: 10, happiness: 40 } }, 'dance')
    expect(r.ok).toBe(false)
  })
})

describe('gato', () => {
  it('llega en una caja con su pelaje y crece a gatito con mimos y limpieza', () => {
    let box = createPet('cat', 'Michi', T0, 'c')
    expect(box.coat).toBeDefined()
    expect(box.look).toBeUndefined()
    for (let i = 0; i < 200 && box.stage === 'egg'; i++)
      box = applyAction({ ...box, stats: { ...box.stats, happiness: 40, hygiene: 40 } }, i % 2 ? 'clean' : 'incubate').pet
    expect(box.stage).toBe('baby')
  })

  it('usa la misma ropa que la gallina en cada etapa', () => {
    const cat = { ...createPet('cat', 'Michi', T0, 'c'), stage: 'adult' as const }
    expect(lleva(viste(cat, 'outfit', 'tux'), 'outfit')).toBe('tux')
    expect(lleva(viste(cat, 'boots', 'rain'), 'boots')).toBeUndefined()
  })
})
