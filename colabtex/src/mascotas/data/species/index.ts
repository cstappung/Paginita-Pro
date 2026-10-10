import type { SpeciesId } from '../../game/types'
import { cat } from './cat'
import { chicken } from './chicken'
import type { SpeciesDef, StageDef } from './types'

// Para sumar el perro: crear dog.ts y registrarlo aquí.
export const SPECIES: Partial<Record<SpeciesId, SpeciesDef>> = { chicken, cat }

export const AVAILABLE_SPECIES = Object.values(SPECIES) as SpeciesDef[]

export function getSpecies(id: SpeciesId): SpeciesDef {
  const def = SPECIES[id]
  if (!def) throw new Error(`Especie desconocida: ${id}`)
  return def
}

export function getStage(species: SpeciesId, stage: string): StageDef {
  const def = getSpecies(species).stages.find((s) => s.id === stage)
  if (!def) throw new Error(`Etapa desconocida: ${species}/${stage}`)
  return def
}

export type { SpeciesDef, StageDef }
