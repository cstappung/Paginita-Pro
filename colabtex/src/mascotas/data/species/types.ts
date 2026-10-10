import type { ActionId, SlotId, SpeciesId, StageId, StatId, Stats } from '../../game/types'

export interface StageDef {
  id: StageId
  label: string
  /** Emoji de la etapa (tarjetas del corral). */
  emoji: string
  /** Personaje 3D de la etapa (ver src/pets/rig: "egg", "chick", "chicken", "box", "kitten" o "cat"). */
  model: string
  scale: number
  /** Qué accesorios admite esta etapa. */
  slots: SlotId[]
  /** Stats que importan en esta etapa. */
  stats: StatId[]
  actions: ActionId[]
  /** Nombre que se muestra en vez del genérico (el huevo no tiene "felicidad", tiene "calor"). */
  statLabels?: Partial<Record<StatId, string>>
  /** Puntos de crecimiento (ver game/config) para pasar a la siguiente etapa. Sin valor = etapa final. */
  growthToNext?: number
  /** Stats con que empieza al adoptarla (solo la primera etapa; el resto, START_STATS). */
  start?: Partial<Stats>
  /** Textos propios de los cuidados (a la caja no se la abriga: se le hacen mimos). */
  care?: Partial<Record<ActionId, { label?: string; icon?: string; hint?: string }>>
  /** Qué le pasa cuando un stat está bajo, si no es lo de siempre ("tiene frío"). */
  needs?: Partial<Record<StatId, string>>
}

export interface SpeciesDef {
  id: SpeciesId
  name: string
  /** Botón para adoptar (con qué llega: huevo, caja…). */
  adopt: { emoji: string; label: string }
  /** Comida que se le lanza (para los textos). */
  /** Juguete para jugar (lo que se arrastra en la escena). */
  toy?: { name: string; icon: string }
  food: string
  /** Etapas en orden; la primera es con la que se adopta. */
  stages: StageDef[]
}
