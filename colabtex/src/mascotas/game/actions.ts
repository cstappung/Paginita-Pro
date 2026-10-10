import { WAKE_MIN_ENERGY } from './config'
import type { ActionId, Stats } from './types'

export interface ActionDef {
  label: string
  emoji: string
  /** Cambio en los stats (puede ser negativo). */
  effects: Partial<Stats>
  /** Devuelve un mensaje si la acción no se puede hacer ahora, o null si sí. */
  blocked: (s: Stats) => string | null
  /**
   * Si devuelve true, se hace igual pero sin el premio de crecimiento por acción (p. ej. bailar por
   * gusto ya estando feliz). Lo que suben los stats cuenta igual.
   */
  sinPremio?: (s: Stats) => boolean
  /** false = no da crecimiento al hacerla (dormir lo da al despertar, según lo que descansó). */
  grows?: boolean
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  feed: {
    label: 'Alimentar',
    emoji: '🌾',
    effects: { hunger: 35, happiness: 3, hygiene: -3 },
    blocked: (s) => (s.hunger >= 95 ? 'No tiene hambre' : null),
  },
  play: {
    label: 'Jugar',
    emoji: '🎾',
    effects: { happiness: 25, energy: -15, hunger: -8, hygiene: -5 },
    // Con margen: jugar nunca la deja tan agotada que se duerma sola al rato.
    blocked: (s) => (s.energy < 20 ? 'Está muy cansado' : s.happiness >= 95 ? 'Ya está feliz' : null),
  },
  sleep: {
    // La acuesta: la energía vuelve de a poco mientras duerme (ver tick), no de golpe.
    label: 'Acostar',
    emoji: '🛏️',
    effects: {},
    blocked: (s) => (s.energy >= 90 ? 'No tiene sueño' : null),
    grows: false,
  },
  wake: {
    label: 'Despertar',
    emoji: '☀️',
    effects: {},
    // Agotada se volvería a dormir al instante: hay que dejarla descansar un poco primero.
    blocked: (s) => (s.energy < WAKE_MIN_ENERGY ? 'Está agotada 😵 déjala dormir un poco más' : null),
    grows: false,
  },
  clean: {
    label: 'Bañar',
    emoji: '🛁',
    effects: { hygiene: 50, happiness: 3 },
    blocked: (s) => (s.hygiene >= 95 ? 'Ya está limpio' : null),
  },
  dance: {
    label: 'Bailar',
    emoji: '💃',
    effects: { happiness: 22, energy: -12, hunger: -6, hygiene: -4 },
    // Siempre se puede lucir un baile, aunque ya feliz no da el premio de crecimiento.
    blocked: (s) => (s.energy < 20 ? 'Está muy cansada para bailar' : null),
    sinPremio: (s) => s.happiness >= 95,
  },
  incubate: {
    label: 'Abrigar',
    emoji: '🔥',
    effects: { happiness: 30 },
    blocked: (s) => (s.happiness >= 95 ? 'Ya está calentito' : null),
  },
}
