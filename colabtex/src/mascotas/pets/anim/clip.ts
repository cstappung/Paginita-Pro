import type { SoundId } from '../../audio/sound'
import type { EmitOptions, FxKind } from '../fx'
import type { Expression } from '../rig/face'
import type { JointName, PetRig, RigKind } from '../rig/types'
import type { Layer } from './util'

export type V3 = [number, number, number]

/**
 * Lo que recibe cada clip (acción de reposo, reacción a un cuidado o baile) para escribir su pose.
 * Los tiempos son locales al clip; los efectos se ubican en el espacio de la mascota en reposo
 * (se mueven solos con ella cuando camina o gira).
 */
export interface Ctx {
  kind: RigKind
  rig: PetRig
  /** Capa con el peso del clip ya aplicado. */
  L: Layer
  /** Tiempo dentro del clip (s), el del cuadro anterior y su duración. */
  u: number
  prev: number
  dur: number
  /** Número aleatorio fijo de este clip (0–1). */
  k: number
  /** Radio de la base redonda para rodar sin hundirse (huevo / pollito). */
  R: number
  /** Avance del huevo hacia nacer (0–1). */
  growth: number
  /** ¿Pasó el instante `x` en este cuadro? (para disparar sonidos y partículas una sola vez). */
  at(x: number): boolean
  sound(id: SoundId): void
  emit(kind: FxKind, p: V3, o?: EmitOptions): void
  /** Emite desde una articulación (con un desplazamiento en su espacio). */
  emitFrom(joint: JointName | 'hand', off: V3, kind: FxKind, o?: EmitOptions): void
  /** Se come la partícula más cercana a `p` (granos). */
  take(kind: FxKind, p: V3, radius: number): boolean
  face(e: Expression): void
  glow(v: number): void
  /** Objeto en la mano (pañuelo de la cueca). */
  prop(id: string | null): void
  /** Aura legendaria (bailes especiales): nivel del círculo, columna de luz y colores [principal, acento]. */
  aura(level: number, beam?: number, colors?: [string, string]): void
}

export type Clip = (c: Ctx) => void
