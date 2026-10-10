import * as THREE from 'three'
import type { Item } from '../game/inventory'
import type { SlotId } from '../game/types'
import { buildRig, type PetRig } from '../pets/rig'
import { dress } from '../pets/wear'
import { buildDecor } from '../scene/decor'

// Modelo 3D de un objeto del inventario "tal cual es", para las miniaturas y el regalo.
// Los muebles se arman igual que en la escena. La ropa y el calzado se calzan sobre un maniquí
// invisible (la gallina o el pollito sin mostrar su cuerpo): así queda con la forma con que se
// lleva puesta. Los bailes no tienen objeto (ver DanceIcon).

/** Sobre qué cuerpo se calza cada prenda. */
const MANNEQUIN: Record<SlotId, string> = { hat: 'chicken', outfit: 'chicken', shoes: 'chicken', boots: 'chick' }

export interface ItemModel {
  /** Centrado en el origen y escalado para caber en una esfera de radio 1. */
  root: THREE.Group
  /** Anima los efectos de los legendarios (destellos, brillos). */
  update(t: number): void
  dispose(): void
}

/** Caja de lo que se ve (sin lo escondido ni los brillos). */
export function visibleBox(obj: THREE.Object3D) {
  obj.updateWorldMatrix(true, true)
  const box = new THREE.Box3()
  const tmp = new THREE.Box3()
  obj.traverseVisible((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry) return
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    box.union(tmp.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld))
  })
  return box
}

/** Centra el contenido y lo deja dentro de una esfera de radio 1. */
function frame(content: THREE.Object3D) {
  const root = new THREE.Group()
  const pivot = new THREE.Group()
  pivot.add(content)
  root.add(pivot)
  const box = visibleBox(pivot)
  if (box.isEmpty()) return root
  const s = box.getBoundingSphere(new THREE.Sphere())
  pivot.position.copy(s.center).negate()
  root.scale.setScalar(1 / Math.max(0.05, s.radius))
  return root
}

/** Arma el modelo. `rig`: maniquí ya armado para reutilizar (las miniaturas lo comparten). */
export function buildItemModel(item: Item, rig?: PetRig): ItemModel | null {
  if (item.kind === 'dance') return null
  if (item.kind === 'decor') {
    const d = buildDecor(item.id, item.tint)
    d.root.userData.decorId = undefined
    const root = frame(d.root)
    return { root, update() {}, dispose: () => (d.root.removeFromParent(), d.dispose()) }
  }
  const slot = item.kind
  const own = !rig
  const r = rig ?? buildRig(MANNEQUIN[slot])
  // El cuerpo del maniquí se esconde: solo queda la prenda.
  const body: [THREE.Object3D, boolean][] = []
  r.root.traverse((o) => body.push([o, o.visible]))
  const worn = dress(r, { [slot]: item.id }, { [slot]: item.tint })
  for (const [o] of body) if ((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite || (o as THREE.Points).isPoints) o.visible = false
  // El aura de los legendarios va en el piso junto al personaje: acá no se usa.
  const holder = new THREE.Group()
  holder.add(r.root)
  const quiet = { prop: null, aura: 0, beam: 0, auraColor: null }
  const update = (t: number) => {
    worn.update(t, quiet)
    for (const c of holder.children) if (c !== r.root) c.visible = false
  }
  update(0.8)
  const root = frame(holder)
  return {
    root,
    update,
    dispose() {
      worn.dispose()
      for (const [o, v] of body) o.visible = v
      r.root.removeFromParent()
      if (own) r.root.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.dispose())
    },
  }
}

const mannequins = new Map<string, PetRig>()
/** Maniquí compartido para las miniaturas (se viste, se fotografía y se desviste al tiro). */
export function mannequinFor(slot: SlotId) {
  const model = MANNEQUIN[slot]
  let r = mannequins.get(model)
  if (!r) mannequins.set(model, (r = buildRig(model)))
  return r
}
