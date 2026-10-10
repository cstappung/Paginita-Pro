import * as THREE from 'three'
import type { V3 } from './kit'

// Formas blandas que se funden entre sí (campos de distancia con unión suave): el cuerpo del gato
// es una sola pieza (pecho, ancas, lomo y cuello) y su cabeza también (cráneo, cachetes y hocico),
// sin costuras ni bordes donde se juntan. La malla se arma proyectando una esfera desde un centro
// hasta la superficie, así conserva las UV de la esfera para pintar el pelaje.

export type SDF = (x: number, y: number, z: number) => number

/** Elipsoide (distancia aproximada, buena cerca de la superficie). */
export function ellipsoid(c: V3, r: V3): SDF {
  const [cx, cy, cz] = c
  const [rx, ry, rz] = r
  return (x, y, z) => {
    const a = (x - cx) / rx
    const b = (y - cy) / ry
    const d = (z - cz) / rz
    const k0 = Math.hypot(a, b, d)
    if (k0 < 1e-6) return -Math.min(rx, ry, rz)
    const k1 = Math.hypot(a / rx, b / ry, d / rz)
    return (k0 * (k0 - 1)) / k1
  }
}

/** Mínimo suave: une dos formas con un empalme redondeado de tamaño `k`. */
export function smin(a: number, b: number, k: number) {
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k))
  return b + (a - b) * h - k * h * (1 - h)
}

/** Unión suave de varias formas. */
export function blend(k: number, ...parts: SDF[]): SDF {
  return (x, y, z) => {
    let d = parts[0](x, y, z)
    for (let i = 1; i < parts.length; i++) d = smin(d, parts[i](x, y, z), k)
    return d
  }
}

/** Punto de la superficie en la dirección `d` (unitaria) desde `c` (que tiene que estar adentro). */
export function surfaceAlong(f: SDF, c: V3, d: THREE.Vector3, rMax: number, out = new THREE.Vector3()) {
  let lo = 0
  let hi = rMax
  for (let i = 0; i < 26; i++) {
    const m = (lo + hi) / 2
    if (f(c[0] + d.x * m, c[1] + d.y * m, c[2] + d.z * m) < 0) lo = m
    else hi = m
  }
  const r = (lo + hi) / 2
  return out.set(c[0] + d.x * r, c[1] + d.y * r, c[2] + d.z * r)
}

/** Normal de la superficie (gradiente del campo). */
export function normalAt(f: SDF, p: THREE.Vector3, out = new THREE.Vector3()) {
  const e = 1e-3
  return out
    .set(
      f(p.x + e, p.y, p.z) - f(p.x - e, p.y, p.z),
      f(p.x, p.y + e, p.z) - f(p.x, p.y - e, p.z),
      f(p.x, p.y, p.z + e) - f(p.x, p.y, p.z - e),
    )
    .normalize()
}

/**
 * Malla de la forma: cada vértice de `sphere` (centrada en el origen, radio 1) se lleva a la
 * superficie en su dirección desde `c`. Las normales salen del campo (sombreado suave).
 */
export function starMesh(f: SDF, c: V3, rMax: number, sphere: THREE.BufferGeometry) {
  const pos = sphere.getAttribute('position')
  const nor = sphere.getAttribute('normal')
  const d = new THREE.Vector3()
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize()
    surfaceAlong(f, c, d, rMax, p)
    pos.setXYZ(i, p.x, p.y, p.z)
    normalAt(f, p, n)
    nor.setXYZ(i, n.x, n.y, n.z)
  }
  pos.needsUpdate = true
  nor.needsUpdate = true
  sphere.computeBoundingSphere()
  return sphere
}

/** Punto de la superficie y su normal en una dirección (para ubicar ojos, orejas, nariz). */
export function spotOn(f: SDF, c: V3, rMax: number, d: THREE.Vector3) {
  const pos = surfaceAlong(f, c, d.clone().normalize(), rMax)
  return { pos, normal: normalAt(f, pos) }
}
