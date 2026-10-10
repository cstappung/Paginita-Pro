import type * as THREE from 'three'

// Acceso directo a una mascota montada (por id), para las interacciones de la escena que pasan
// cuadro a cuadro: lanzarle granos, frotarla con la esponja, mostrarle el juguete. Así el puntero
// no hace re-render de React en cada movimiento.

export interface PetHandle {
  /** Grupo 3D de la mascota (para apuntarle con rayos). */
  object: THREE.Object3D
  /**
   * Lanza un puñado de granos de `from` a `to` (mundo). Si `eat`, la mascota va a comérselos.
   * Devuelve cuántos segundos falta para que termine de comer (aprox.).
   */
  throwFood(from: THREE.Vector3, to: THREE.Vector3, eat: boolean): number
  /** La frotan con la esponja en `at` (mundo): espuma y cara de gusto. */
  scrub(at: THREE.Vector3): void
}

const handles = new Map<string, PetHandle>()

export function registerPet(id: string, h: PetHandle) {
  handles.set(id, h)
  return () => {
    if (handles.get(id) === h) handles.delete(id)
  }
}

export const getPet = (id: string) => handles.get(id)

// El juguete se guarda aparte (por id): si la mascota se vuelve a montar, lo sigue viendo.
const lures = new Map<string, THREE.Vector3>()

/** Juguete que persigue la mascota (mundo), o null para que lo deje. */
export function setLure(id: string, at: THREE.Vector3 | null) {
  if (at) lures.set(id, at.clone())
  else lures.delete(id)
}

export const getLure = (id: string) => lures.get(id) ?? null
