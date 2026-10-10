import { CATALOG, DANCES } from '../data/accessories'
import { DECOR } from '../data/decor'
import MM from '../../../../juegos/mascotas/motor.js'
import type { Pet, SlotId } from './types'

// Inventario de cosméticos: ropa, calzado, sombreros, muebles y bailes. No se compran uno por uno:
// salen de regalos (cada uno trae un objeto con colores; los legendarios salen poco) o del mercado.
// Lo que trae un regalo no se sortea aquí: lo deriva el motor compartido (juegos/mascotas/motor.js)
// de la compra escrita, y llega con los datos de la cuenta. Se puede tener el mismo objeto varias
// veces (en distintos colores; los bailes, repetidos tal cual).

export type ItemKind = SlotId | 'decor' | 'dance'

export interface Item {
  /** Identificador único de este ejemplar: su clave de copia (`ob:…`) o `start-…` si es inicial. */
  uid: string
  kind: ItemKind
  /** Id del catálogo. */
  id: string
  /** Semilla de color (0 = colores originales). Ver pets/tint.ts. */
  tint: number
  /** Legendario (sale del catálogo, pero así no hay que buscarlo). */
  leg?: boolean
  /** Está a la venta en el mercado (id de la oferta): mientras tanto nadie lo usa. */
  venta?: string
}

export const GIFT_PRICE: number = MM.PRECIO.regalo
/** Poción eterna: la mascota deja de crecer y se queda en su etapa para siempre. */
export const POTION_PRICE: number = MM.PRECIO.pocion
/** Una ración de comida: un puñado, una acción de alimentar. */
export const FOOD_PRICE: number = MM.PRECIO.comida
/** Probabilidad de que un regalo traiga un legendario (el motor la lleva en diez milésimas). */
export const LEGENDARY_CHANCE: number = MM.LEGENDARIO / 10000
/** Bailes que caben en la barra de cuidados. */
export const DANCE_BAR = 4

/**
 * Lo que trae todo el mundo desde el principio (con sus colores originales). No se compra, no se
 * guarda en ningún lado y no se puede vender: no tiene clave de copia.
 */
const STARTERS: [ItemKind, string][] = [
  ['hat', 'beanie'],
  ['boots', 'rain'],
  ['outfit', 'sweater'],
  ['shoes', 'sneakers'],
  ...DANCES.filter((d) => d.rarity !== 'legendary').map((d): [ItemKind, string] => ['dance', d.id]),
]

export function starterItems(): Item[] {
  return STARTERS.map(([kind, id]) => ({ uid: `start-${kind}-${id}`, kind, id, tint: 0 }))
}

/** Un objeto inicial (no se vende). */
export const isStarter = (i: Item) => i.uid.startsWith('start-')

/**
 * Todo lo que puede salir de un regalo, en el orden del motor: sus índices no cambian nunca (un test
 * comprueba que este catálogo y `MM.POOL` coinciden).
 */
export function giftPool(): { kind: ItemKind; id: string; legendary: boolean }[] {
  const slots = Object.keys(CATALOG) as SlotId[]
  return [
    ...slots.flatMap((kind) => CATALOG[kind].map((a) => ({ kind: kind as ItemKind, id: a.id, legendary: a.rarity === 'legendary' }))),
    ...DECOR.map((d) => ({ kind: 'decor' as ItemKind, id: d.id, legendary: false })),
    ...DANCES.map((d) => ({ kind: 'dance' as ItemKind, id: d.id, legendary: d.rarity === 'legendary' })),
  ]
}

export const hasItem = (items: Item[], kind: ItemKind, id: string) => items.some((i) => i.kind === kind && i.id === id)

/**
 * Quién tiene puesto (o en su casa) un objeto. Cada objeto del inventario está en una sola mascota
 * a la vez: si tengo un sombrero rojo, lo lleva una; para ponérselo a otra, se lo saco a la primera.
 */
export function usedBy(pets: Pet[], item: Item): Pet | undefined {
  if (item.kind === 'dance') return undefined
  if (item.kind === 'decor') return pets.find((p) => (p.decor ?? []).some((d) => d.uid === item.uid))
  const slot = item.kind
  return pets.find((p) => p.wear?.[slot] === item.uid)
}

/** Le saca un objeto a todas las mascotas menos a `keep` (antes de ponérselo a esa). */
export function takeFromOthers(pets: Pet[], item: Item, keep: string): Pet[] {
  return pets.map((p) => {
    if (p.id === keep) return p
    if (item.kind === 'decor') return (p.decor ?? []).some((d) => d.uid === item.uid) ? { ...p, decor: p.decor!.filter((d) => d.uid !== item.uid) } : p
    if (item.kind === 'dance' || p.wear?.[item.kind] !== item.uid) return p
    return strip(p, item.kind)
  })
}

/** Saca la prenda de un espacio (aunque la etapa ya no lo use). */
export function strip(p: Pet, slot: SlotId): Pet {
  const wear = { ...p.wear }
  delete wear[slot]
  return { ...p, wear }
}

/** Le saca a una mascota todo lo que no está en el inventario usable (vendido, o a la venta). */
export function onlyUsable(p: Pet, items: Item[]): Pet {
  const ok = (uid: string | undefined) => !!uid && items.some((i) => i.uid === uid && !i.venta)
  const wear = Object.fromEntries(Object.entries(p.wear ?? {}).filter(([, uid]) => ok(uid)))
  const decor = (p.decor ?? []).filter((d) => ok(d.uid))
  return { ...p, wear, decor }
}

/** Barra de bailes inicial: los primeros bailes del inventario. */
export function defaultDanceBar(items: Item[]) {
  return items.filter((i) => i.kind === 'dance').slice(0, DANCE_BAR).map((i) => i.uid)
}

/**
 * Pone o saca un baile (por uid) de la barra. Si ya hay uno igual, lo reemplaza; si está llena,
 * sale el más antiguo. Devuelve la barra nueva y el baile que salió (si salió alguno).
 */
export function toggleDance(bar: string[], items: Item[], uid: string): { bar: string[]; out?: Item } {
  const live = bar.filter((u) => items.some((i) => i.uid === u && i.kind === 'dance'))
  if (live.includes(uid)) return { bar: live.filter((u) => u !== uid) }
  const it = items.find((i) => i.uid === uid && i.kind === 'dance')
  if (!it) return { bar: live }
  const same = live.find((u) => items.find((i) => i.uid === u)?.id === it.id)
  if (same) return { bar: live.map((u) => (u === same ? uid : u)) }
  if (live.length < DANCE_BAR) return { bar: [...live, uid] }
  const out = items.find((i) => i.uid === live[0])
  return { bar: [...live.slice(1), uid], out }
}
