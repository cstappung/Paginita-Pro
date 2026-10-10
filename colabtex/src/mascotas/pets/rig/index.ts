import type * as THREE from 'three'
import { buildChick } from './chick'
import { buildEgg } from './egg'
import { buildHen } from './hen'
import type { PetRig } from './types'
import type { Coat, Look } from '../../game/types'
import { buildBox, buildCat, buildKitten } from './cat'
import { chickColors, eggColors, henColors } from './plumage'

/** Cada modelo con sus colores según la genética (sin ella, los colores clásicos). */
const BUILDERS: Record<string, (genes?: Genes) => PetRig> = {
  egg: (g) => buildEgg(g && eggColors(g as Look)),
  chick: (g) => buildChick(g && chickColors(g as Look)),
  chicken: (g) => buildHen(g && henColors(g as Look)),
  box: (g) => buildBox(g as Coat | undefined),
  kitten: (g) => buildKitten(g as Coat | undefined),
  cat: (g) => buildCat(g as Coat | undefined),
}

/** Genes de color: plumaje (gallinas) o pelaje (gatos). */
export type Genes = Look | Coat

/** Arma el personaje de una etapa (`StageDef.model`). Cada mascota tiene su propia copia. */
export function buildRig(model: string, look?: Genes): PetRig {
  const build = BUILDERS[model]
  if (!build) throw new Error(`Modelo desconocido: ${model}`)
  const rig = build(look)
  // Matriz de cada pieza en reposo (espacio del modelo): la ropa se calza con ella aunque la
  // mascota esté en movimiento cuando se cambia de prenda.
  rig.root.updateMatrixWorld(true)
  rig.root.traverse((o) => (o.userData.rest = (o.userData.restAs as THREE.Matrix4 | undefined) ?? o.matrixWorld.clone()))
  return rig
}

export type { PetRig } from './types'
