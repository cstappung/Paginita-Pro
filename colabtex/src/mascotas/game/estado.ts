import { SPECIES } from '../data/species'
import { getDecor } from '../data/decor'
import { START_STATS } from './config'
import type { Item } from './inventory'
import { genesDe } from './look'
import type { Coat, Look, Pet, PlacedDecor, SlotId, SpeciesId, StageId, StatId, Stats } from './types'

// El estado de una mascota tal como se guarda en `mascotasEstado/<uid>/<origen~clave>` (versión 1).
// Puro: el juego lo convierte en `Pet` al recibirlo y de vuelta al guardar. Lo que no se guarda sale
// de otro lado: los genes y la fecha de nacimiento, de la adopción; si tomó la poción, de la
// economía; el id y los colores de lo que lleva puesto, del inventario. Si el formato cambia, se
// migra al leer (aquí), nunca con un guardado local.

export interface Estado {
  v: 1
  /** Nombre. */
  n: string
  /** Etapa. */
  e: StageId
  /** Crecimiento dentro de la etapa. */
  g: number
  s: Stats
  /** Última vez que se pusieron al día los stats (ms). */
  ls: number
  /** Dormida y lo que lleva descansado. */
  z?: boolean
  r?: number
  /** Qué lleva puesto: uid del objeto por espacio. */
  w?: Partial<Record<SlotId, string>>
  /** Muebles: uid, posición y giro en octavos de vuelta (0–7). */
  d?: { i: string; x: number; z: number; rot: number }[]
}

/** Lo que dice la economía de una mascota (ver `mascotasDe` en juegos/monedas.js). */
export interface Adopcion {
  /** Clave de copia (`ma:<origen>~<clave>`): es el id de la mascota. */
  c: string
  o: string
  k: string
  at: number
  e: SpeciesId
  frozen?: boolean
  venta?: string
  /** La semilla de sus genes (la calcula el cartero con el motor). */
  semilla: number[]
}

const OCTAVO = Math.PI / 4
const r2 = (x: number) => Math.round(x * 100) / 100
const r4 = (x: number) => Math.round(x * 10000) / 10000
const STATS: StatId[] = ['hunger', 'happiness', 'energy', 'hygiene']

/** La clave del estado: `<origen>~<clave>` (la copia sin su prefijo). */
export const claveEstado = (c: string) => c.replace(/^ma:/, '')

export function aEstado(p: Pet): Estado {
  const e: Estado = {
    v: 1,
    n: (p.name.trim() || 'Sin nombre').slice(0, 24),
    e: p.stage,
    g: Math.max(0, Math.min(1000, r4(p.growth))),
    s: Object.fromEntries(STATS.map((k) => [k, Math.max(0, Math.min(100, r2(p.stats[k])))])) as Stats,
    ls: p.lastSeen,
  }
  if (p.asleep) {
    e.z = true
    e.r = Math.max(0, Math.min(100, r2(p.rest ?? 0)))
  }
  const w = Object.fromEntries(Object.entries(p.wear ?? {}).filter(([, uid]) => !!uid))
  if (Object.keys(w).length) e.w = w
  const d = (p.decor ?? []).filter((x) => x.uid).slice(0, 13)
  if (d.length) e.d = d.map((x) => ({ i: x.uid!, x: r4(x.x), z: r4(x.z), rot: Math.round(x.rot / OCTAVO) % 8 }))
  return e
}

const etapaValida = (sp: SpeciesId, e: unknown): e is StageId => typeof e === 'string' && !!SPECIES[sp]?.stages.some((s) => s.id === e)

/**
 * Arma la mascota a partir de su adopción y su estado guardado (o null: una recién llegada, como
 * huevo o caja). `items` es el inventario para resolver muebles; lo que no está ahí se descarta.
 */
export function desdeEstado(a: Adopcion, est: Partial<Estado> | null, items: readonly Item[], now: number): Pet {
  const sp = SPECIES[a.e] ? a.e : 'chicken'
  const first = SPECIES[sp]!.stages[0]
  const stage = est && etapaValida(sp, est.e) ? est.e : first.id
  const base: Stats = { hunger: START_STATS, happiness: START_STATS, energy: START_STATS, hygiene: START_STATS, ...(stage === first.id ? first.start : {}) }
  const stats = Object.fromEntries(STATS.map((k) => {
    const v = est?.s?.[k]
    return [k, Number.isFinite(v) ? Math.max(0, Math.min(100, v as number)) : base[k]]
  })) as Stats
  const genes = genesDe(sp, a.semilla)
  const colors = sp === 'cat' ? { coat: genes as Coat } : { look: genes as Look }
  const decor: PlacedDecor[] = []
  for (const x of est?.d ?? []) {
    const it = items.find((i) => i.uid === x.i && i.kind === 'decor')
    if (!it || !getDecor(it.id) || decor.some((o) => o.id === it.id)) continue
    decor.push({ id: it.id, x: +x.x || 0, z: +x.z || 0, rot: ((+x.rot || 0) % 8) * OCTAVO, ...(it.tint ? { tint: it.tint } : {}), uid: it.uid })
  }
  // Lo puesto se conserva aunque la etapa ya no use ese espacio (vuelve a verse si cambia).
  const wear: Partial<Record<SlotId, string>> = {}
  for (const [slot, uid] of Object.entries(est?.w ?? {}) as [SlotId, string][])
    if (['hat', 'boots', 'outfit', 'shoes'].includes(slot) && typeof uid === 'string') wear[slot] = uid
  return {
    id: a.c,
    name: (est?.n || 'Sin nombre').slice(0, 24),
    species: sp,
    stage,
    stats,
    growth: Number.isFinite(est?.g) ? Math.max(0, est!.g as number) : 0,
    ...(est?.z ? { asleep: true, rest: Number.isFinite(est.r) ? (est.r as number) : 0 } : {}),
    bornAt: a.at,
    lastSeen: Number.isFinite(est?.ls) ? Math.min(est!.ls as number, now) : now,
    wear,
    decor,
    ...colors,
    ...(a.frozen ? { frozen: true } : {}),
    ...(a.venta ? { venta: a.venta } : {}),
  }
}
