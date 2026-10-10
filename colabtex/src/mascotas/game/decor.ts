import { getDecor } from '../data/decor'
import type { Pet, PlacedDecor } from './types'

// Lugar de cada mascota: dónde se pueden poner los muebles (en el piso, alrededor de ella) sin
// taparla ni quedar fuera de cuadro. Lógica pura: se usa igual al arrastrar y al guardar.

/**
 * Piso donde se pueden poner muebles alrededor de la mascota (unidades de la escena, la mascota en
 * el centro). Hacia los lados es casi el cuadro normal (para que en el celular la mascota no se vea
 * chica); hacia atrás y adelante hay harto espacio. La cámara se aleja para que entre lo que se ponga.
 */
export const ROOM = { x: 1.15, zMin: -3.0, zMax: 2.2 }
/** Espacio libre alrededor del centro: ahí pasea la mascota. */
export const CLEAR = 0.45

/** Lleva un punto a un lugar válido para ese objeto: dentro del piso y sin pisar a la mascota. */
export function clampSpot(id: string, x: number, z: number) {
  const d = getDecor(id)
  const r = d?.r ?? 0.2
  // A los costados el objeto queda entero dentro del piso (así la cámara no tiene que alejarse de más).
  const X = ROOM.x - r
  const Z0 = ROOM.zMin + r * 0.3
  const Z1 = ROOM.zMax - r * 0.3
  const inRoom = () => {
    x = Math.min(X, Math.max(-X, x))
    z = Math.min(Z1, Math.max(Z0, z))
  }
  inRoom()
  if (!d?.flat) {
    const min = CLEAR + r
    const dist = Math.hypot(x, z)
    if (dist < min) {
      // Se empuja hacia afuera (o hacia atrás, si estaba justo en el centro).
      const k = dist > 1e-3 ? min / dist : 0
      ;[x, z] = dist > 1e-3 ? [x * k, z * k] : [0, -min]
      inRoom()
      // Si al volver al piso quedó otra vez muy cerca (contra el borde), se corre hacia el costado.
      if (Math.hypot(x, z) < min) x = Math.min(X, Math.sqrt(Math.max(0, min * min - z * z))) * (x < 0 ? -1 : 1)
    }
  }
  return { x, z }
}

/**
 * Lugares preferidos para un objeto nuevo: a los costados primero (atrás, al medio, adelante).
 * Justo detrás de la mascota va al final, porque ahí ella lo tapa.
 */
const SPOTS: [number, number][] = [
  [-0.7, -0.55], [0.7, -0.55], [-0.75, 0.1], [0.75, 0.1], [-0.45, -0.9], [0.45, -0.9],
  [-0.7, 0.42], [0.7, 0.42], [-0.85, -0.95], [0.85, -0.95], [-0.35, 0.45], [0.35, 0.45], [0, -0.9],
]

/** Primer lugar libre para `id` (o el menos encimado, si ya no queda ninguno). */
export function freeSpot(placed: PlacedDecor[], id: string) {
  const r = getDecor(id)?.r ?? 0.2
  if (getDecor(id)?.flat) return { x: 0, z: 0 }
  let best = { x: 0, z: -0.85 }
  let bestGap = -Infinity
  for (const [sx, sz] of SPOTS) {
    const p = clampSpot(id, sx, sz)
    // Distancia al objeto más cercano, descontando los radios (las alfombras no cuentan).
    const gap = Math.min(Infinity, ...placed.filter((o) => !getDecor(o.id)?.flat).map((o) => Math.hypot(o.x - p.x, o.z - p.z) - r - (getDecor(o.id)?.r ?? 0.2)))
    if (gap >= 0) return p
    if (gap > bestGap) (bestGap = gap), (best = p)
  }
  return best
}

/** Pone un objeto en el lugar de la mascota (uno de cada cosa: si ya estaba, solo cambia sus colores). */
export function placeDecor(pet: Pet, id: string, tint = 0, uid?: string): Pet {
  const list = pet.decor ?? []
  if (!getDecor(id)) return pet
  if (list.some((o) => o.id === id)) return { ...pet, decor: list.map((o) => (o.id === id ? { ...o, tint: tint || undefined, uid } : o)) }
  const p = freeSpot(list, id)
  return { ...pet, decor: [...list, { id, x: p.x, z: p.z, rot: 0, ...(tint ? { tint } : {}), ...(uid ? { uid } : {}) }] }
}

export function moveDecor(pet: Pet, id: string, x: number, z: number): Pet {
  const p = clampSpot(id, x, z)
  return { ...pet, decor: (pet.decor ?? []).map((o) => (o.id === id ? { ...o, x: p.x, z: p.z } : o)) }
}

/** Gira un octavo de vuelta. */
export function rotateDecor(pet: Pet, id: string): Pet {
  return { ...pet, decor: (pet.decor ?? []).map((o) => (o.id === id ? { ...o, rot: (o.rot + Math.PI / 4) % (Math.PI * 2) } : o)) }
}

export function removeDecor(pet: Pet, id: string): Pet {
  return { ...pet, decor: (pet.decor ?? []).filter((o) => o.id !== id) }
}
