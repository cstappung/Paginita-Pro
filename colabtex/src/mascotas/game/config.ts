import type { StatId } from './types'

// Ajustes de balance. Todo en un solo lugar para poder afinarlo sin tocar la lógica.

/** Puntos que baja cada stat por hora (con la app abierta o cerrada). */
export const DECAY_PER_HOUR: Record<StatId, number> = {
  hunger: 7,
  happiness: 5,
  energy: 3,
  hygiene: 4,
}

/** Tope de tiempo que se descuenta con la app cerrada: nunca se castiga de más. */
export const MAX_OFFLINE_HOURS = 8

/**
 * Crecimiento: solo con cuidados. Cada acción que de verdad ayuda da 0,05 puntos más 0,005 por cada
 * punto de stat que sube (cuidar cuando hace falta rinde más que insistir cuando ya está bien). Es
 * 1/20 de lo que daba la versión suelta del juego: allá estaba acelerado para probarlo.
 */
export const GROW_PER_ACTION = 0.05
export const GROW_PER_POINT = 0.005

/** Energía que recupera por hora durmiendo, con la luz apagada o prendida. */
export const SLEEP_RATE = { dark: 50, light: 20 }
/** Mientras duerme, el hambre y la higiene bajan más lento (fracción del ritmo normal) y el ánimo no baja. */
export const SLEEP_DECAY = 0.5
/** Si la despiertan con menos energía que esto, se levanta de malas. */
export const GRUMPY_BELOW = 60
/** Con tan poca energía se queda dormida sola donde esté. */
export const FAINT_ENERGY = 4
/** Energía mínima para poder despertarla (con menos se volvería a dormir al instante). */
export const WAKE_MIN_ENERGY = FAINT_ENERGY + 2

/** Por debajo de esto un stat activo cuenta como "mal" y la mascota se pone triste. */
export const SAD_THRESHOLD = 30

export const START_STATS = 80

/** Cuadros por segundo de la animación de las mascotas (12 = estilo dibujo animado, 60 = fluido). */
export const FPS_MIN = 12
export const FPS_MAX = 60
export const FPS_DEFAULT = 12
