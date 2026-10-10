import { getSpecies, getStage } from '../data/species'
import { ACTIONS } from './actions'
import {
  DECAY_PER_HOUR,
  FAINT_ENERGY,
  GROW_PER_ACTION,
  GROW_PER_POINT,
  GRUMPY_BELOW,
  MAX_OFFLINE_HOURS,
  SAD_THRESHOLD,
  SLEEP_DECAY,
  SLEEP_RATE,
  START_STATS,
  WAKE_MIN_ENERGY,
} from './config'
import { getAccessory } from '../data/accessories'
import type { ActionId, Coat, Look, Mood, Pet, SlotId, SpeciesId, StatId, Stats } from './types'
import { genesDe, semillaDe } from './look'

// Lógica pura: sin React, sin reloj propio (siempre recibe `now`). Fácil de testear.
// Los cuidados no dan monedas: en Juegos, las monedas solo entran por el mercado.

const clamp = (n: number) => Math.min(100, Math.max(0, n))
const HOUR = 3_600_000

export function createPet(species: SpeciesId, name: string, now: number, id: string, genes?: Look | Coat): Pet {
  const first = getSpecies(species).stages[0]
  // Cada especie con su genética: plumaje (gallinas) o pelaje (gatos).
  const g = genes ?? genesDe(species, semillaDe(id))
  const colors = species === 'cat' ? { coat: g as Coat } : { look: g as Look }
  return {
    id,
    name,
    species,
    ...colors,
    stage: first.id,
    stats: { hunger: START_STATS, happiness: START_STATS, energy: START_STATS, hygiene: START_STATS, ...first.start },
    growth: 0,
    bornAt: now,
    lastSeen: now,
  }
}

/** Promedio de los stats que importan en la etapa actual. */
export function wellbeing(pet: Pet): number {
  const active = getStage(pet.species, pet.stage).stats
  return active.reduce((sum, k) => sum + pet.stats[k], 0) / active.length
}

export function mood(pet: Pet): Mood {
  const active = getStage(pet.species, pet.stage).stats
  if (active.some((k) => pet.stats[k] < SAD_THRESHOLD)) return 'sad'
  return wellbeing(pet) >= 75 ? 'happy' : 'normal'
}

/** Stat activo más bajo (para que la UI sugiera qué hace falta). */
export function neediest(pet: Pet): StatId {
  const active = getStage(pet.species, pet.stage).stats
  return active.reduce((a, b) => (pet.stats[b] < pet.stats[a] ? b : a))
}

/** Suma crecimiento y pasa de etapa (puede saltar varias si sobra). Con la poción eterna, no crece. */
export function grow(pet: Pet, points: number): Pet {
  if (points <= 0 || pet.frozen) return pet
  let next: Pet = { ...pet, growth: pet.growth + points }
  let stage = getStage(next.species, next.stage)
  const stages = getSpecies(next.species).stages
  while (stage.growthToNext !== undefined && next.growth >= stage.growthToNext) {
    const following = stages[stages.findIndex((s) => s.id === stage.id) + 1]
    if (!following) break
    next = { ...next, stage: following.id, growth: next.growth - stage.growthToNext }
    stage = following
  }
  // En la última etapa no se acumula.
  if (stage.growthToNext === undefined) next.growth = 0
  return next
}

/** Se despierta: lo que descansó se vuelve crecimiento (con premio si durmió de un tirón). */
function wakeUp(pet: Pet, natural: boolean): Pet {
  const rested = pet.rest ?? 0
  const woke: Pet = { ...pet, asleep: undefined, rest: undefined }
  return grow(woke, rested * GROW_PER_POINT + (natural ? GROW_PER_ACTION : 0))
}

/** Horas que le faltan para despertar sola (0 si no duerme). */
export function hoursToWake(pet: Pet, dark: boolean) {
  if (!pet.asleep) return 0
  return Math.max(0, 100 - pet.stats.energy) / (dark ? SLEEP_RATE.dark : SLEEP_RATE.light)
}

/** Horas que faltan para que se la pueda despertar (0 si ya se puede o no duerme). */
export function hoursToWakeable(pet: Pet, dark: boolean) {
  if (!pet.asleep) return 0
  return Math.max(0, WAKE_MIN_ENERGY - pet.stats.energy) / (dark ? SLEEP_RATE.dark : SLEEP_RATE.light)
}

/**
 * Avanza el tiempo: baja los stats, y si duerme recupera energía de a poco (más rápido con la luz
 * apagada) hasta despertar sola. El tiempo NO hace crecer: eso solo pasa con cuidados.
 * El tiempo con la app cerrada se descuenta con tope (MAX_OFFLINE_HOURS).
 */
export function tick(pet: Pet, now: number, dark = false): Pet {
  const elapsed = now - pet.lastSeen
  // Reloj atrasado (cambio de hora): se resincroniza sin cobrar ni regalar tiempo.
  if (elapsed < 0) return { ...pet, lastSeen: now }
  if (elapsed === 0) return pet
  let hours = Math.min(elapsed, MAX_OFFLINE_HOURS * HOUR) / HOUR

  const active = getStage(pet.species, pet.stage).stats
  const sleeps = getStage(pet.species, pet.stage).actions.includes('sleep')
  let next: Pet = { ...pet, stats: { ...pet.stats }, lastSeen: now }
  const st = next.stats
  // Por tramos: despierta → (se duerme de cansancio) → duerme → (despierta sola) → …
  for (let guard = 0; hours > 1e-9 && guard < 8; guard++) {
    if (next.asleep) {
      const rate = dark ? SLEEP_RATE.dark : SLEEP_RATE.light
      const h = Math.min(hours, Math.max(0, 100 - st.energy) / rate)
      for (const k of active) if (k === 'hunger' || k === 'hygiene') st[k] = clamp(st[k] - DECAY_PER_HOUR[k] * SLEEP_DECAY * h)
      const before = st.energy
      st.energy = clamp(st.energy + rate * h)
      next.rest = (next.rest ?? 0) + (st.energy - before)
      hours -= h
      if (st.energy >= 100 - 1e-6) next = wakeUp({ ...next, stats: st }, true)
    } else {
      const faint = sleeps && active.includes('energy') ? Math.max(0, (st.energy - FAINT_ENERGY) / DECAY_PER_HOUR.energy) : Infinity
      const h = Math.min(hours, faint)
      for (const k of active) st[k] = clamp(st[k] - DECAY_PER_HOUR[k] * h)
      hours -= h
      // Agotada: se queda dormida sola.
      if (hours > 1e-9) next = { ...next, asleep: true, rest: 0 }
    }
  }
  return { ...next, stats: st }
}

export interface ActionResult {
  pet: Pet
  ok: boolean
  /** Por qué no se pudo (undefined si ok). */
  reason?: string
  /** Crecimiento que ganó con esta acción. */
  grew?: number
}

/**
 * Hace un cuidado. Con la luz apagada (`dark`) solo se la puede acostar: para todo lo demás
 * (incluido despertarla) hay que prender la luz primero.
 */
export function applyAction(pet: Pet, action: ActionId, dark = false): ActionResult {
  const stage = getStage(pet.species, pet.stage)
  const allowed = action === 'wake' ? stage.actions.includes('sleep') : stage.actions.includes(action)
  if (!allowed) return { pet, ok: false, reason: 'No puede hacer eso ahora' }
  if (dark && action !== 'sleep') return { pet, ok: false, reason: 'Está a oscuras: prende la luz 💡' }
  if (pet.asleep && action !== 'wake') return { pet, ok: false, reason: 'Está durmiendo 💤' }
  if (!pet.asleep && action === 'wake') return { pet, ok: false, reason: 'Ya está despierta' }
  const def = ACTIONS[action]
  const reason = def.blocked(pet.stats)
  if (reason) return { pet, ok: false, reason }

  const premio = !def.sinPremio?.(pet.stats)
  const stats: Stats = { ...pet.stats }
  for (const [k, delta] of Object.entries(def.effects) as [StatId, number][]) stats[k] = clamp(stats[k] + delta)

  if (action === 'sleep') return { pet: { ...pet, stats, asleep: true, rest: 0 }, ok: true }
  if (action === 'wake') {
    // Despertarla antes de tiempo la pone de malas (pero lo que durmió igual cuenta).
    if (stats.energy < GRUMPY_BELOW) stats.happiness = clamp(stats.happiness - 8)
    const woke = wakeUp({ ...pet, stats }, false)
    return { pet: woke, ok: true, grew: pet.frozen ? 0 : (pet.rest ?? 0) * GROW_PER_POINT }
  }

  // Crece según cuánto ayudó de verdad (solo los stats que importan en la etapa).
  let gain = 0
  for (const k of stage.stats) gain += Math.max(0, stats[k] - pet.stats[k])
  const grew = def.grows === false || pet.frozen ? 0 : (premio ? GROW_PER_ACTION : 0) + gain * GROW_PER_POINT
  return { pet: grow({ ...pet, stats }, grew), ok: true, grew }
}

/** Poción eterna: se queda en la etapa en que está, para siempre. */
export function drinkPotion(pet: Pet): Pet {
  return pet.frozen ? pet : { ...pet, frozen: true }
}

/**
 * Pone (o quita, con null) un objeto del inventario en un espacio. Solo si la etapa actual admite ese
 * espacio y el objeto existe. La mascota guarda solo qué objeto (uid) lleva: el id del catálogo y
 * sus colores salen del inventario al pintarla (ver `puesto`).
 */
export function equip(pet: Pet, slot: SlotId, item: { uid: string; id: string } | null): Pet {
  if (item !== null && !getStage(pet.species, pet.stage).slots.includes(slot)) return pet
  if (item !== null && !getAccessory(slot, item.id)) return pet
  const wear = { ...pet.wear }
  if (item !== null) wear[slot] = item.uid
  else delete wear[slot]
  return { ...pet, wear }
}

/** Lo que lleva puesto, resuelto contra el inventario: id del catálogo y colores por espacio. */
export function puesto(pet: Pet, items: readonly { uid: string; kind: string; id: string; tint: number }[]) {
  const ids: Partial<Record<SlotId, string>> = {}
  const tints: Partial<Record<SlotId, number>> = {}
  for (const [slot, uid] of Object.entries(pet.wear ?? {}) as [SlotId, string][]) {
    const it = items.find((i) => i.uid === uid && i.kind === slot)
    if (!it) continue
    ids[slot] = it.id
    if (it.tint) tints[slot] = it.tint
  }
  return { ids, tints }
}
