import { create } from 'zustand'
import { starterItems } from '../game/inventory'
import type { SlotId, SpeciesId, StageId } from '../game/types'
import { al } from './red'

// Lo que el cartero cuenta del Pueblo: quiénes pasean ahora por la plaza (ya revisados contra la
// economía: la mascota es de quien pasea y la ropa, de su dueño). Las horas ya vienen en el reloj
// de este navegador.

/** Lo que lleva puesto: objeto de regalos ({id, tint}) o inicial ({s: uid}). */
export type Ropa = Partial<Record<'hat' | 'boots' | 'outfit' | 'shoes', { id: string; tint: number } | { s: string }>>

export interface Paseante {
  u: string
  nombre: string
  color: string
  /** La mascota (clave de copia) y su adopción (para los genes). */
  c: string
  o: string
  k: string
  at0: number
  e: SpeciesId
  /** Nombre y etapa (vacíos mientras se lee su estado). */
  n: string
  et: StageId | ''
  w: Ropa
  x: number
  z: number
  /** Último gesto y cuándo; `b` es el baile si el gesto fue bailar. */
  em: string
  ea: number
  b: string
  /** Lo último que dijo y cuándo. */
  t: string
  ta: number
}

/** `aviso`: por qué la plaza no funciona (las reglas sin publicar), o vacío. */
export const usePueblo = create<{ paseantes: Paseante[]; aviso: string }>()(() => ({ paseantes: [], aviso: '' }))

al('plaza', (x: { lista: Paseante[]; aviso?: string }) =>
  usePueblo.setState({ paseantes: Array.isArray(x.lista) ? x.lista : [], aviso: typeof x.aviso === 'string' ? x.aviso : '' }),
)

const ARRANQUES = starterItems()
/** Lo que lleva puesto otra mascota, en ids del catálogo y colores (para PetView). */
export function ropaIds(w: Ropa) {
  const ids: Partial<Record<SlotId, string>> = {}
  const tints: Partial<Record<SlotId, number>> = {}
  for (const [slot, v] of Object.entries(w ?? {}) as [SlotId, Ropa[SlotId]][]) {
    if (!v) continue
    if ('s' in v) {
      const it = ARRANQUES.find((i) => i.uid === v.s && i.kind === slot)
      if (it) ids[slot] = it.id
    } else if (typeof v.id === 'string') {
      ids[slot] = v.id
      if (v.tint) tints[slot] = v.tint
    }
  }
  return { ids, tints }
}

