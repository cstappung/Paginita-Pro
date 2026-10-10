import * as THREE from 'three'
import { HEN, bodyPoint } from './rig/hen'
import { RigBuilder, canvasTexture, lathe, placeMatrix, profileRadius, sphere, thickSurface, toon, type Place, type V3 } from './rig/kit'
import type { PetRig, TorsoSpec } from './rig/types'
import { tintSig, tinting, untinted } from './tint'

// Herramientas de sastrería compartidas por la ropa común y la legendaria: materiales, el armado
// por articulación y cómo calzar prendas sobre el torso y las alas de la gallina.

// ---------- Materiales y texturas (compartidos entre mascotas) ----------

export const matCache = new Map<string, THREE.MeshToonMaterial>()
// Las cachés llevan la firma de color activa (objetos del inventario con colores propios).
export function M(color: string) {
  const key = color + tintSig(color)
  let m = matCache.get(key)
  if (!m) matCache.set(key, (m = toon(color)))
  return m
}
const texBase = new Map<string, THREE.Texture>()
export function MT(key: string, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256, repeat?: [number, number]) {
  const k = key + tintSig(key)
  let m = matCache.get(k)
  if (!m) {
    let tex = texBase.get(key)
    if (!tex) {
      texBase.set(key, (tex = canvasTexture(w, h, draw, !!repeat)))
      if (repeat) tex.repeat.set(...repeat)
    }
    const t = tex
    // Si esa textura se mantiene (p. ej. la paja), va con sus colores aunque el resto cambie.
    matCache.set(k, (m = tinting(key) ? toon('#ffffff', t) : untinted(() => toon('#ffffff', t))))
  }
  return m
}

// ---------- Armado ----------

export const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

/** Junta las piezas por articulación y material (pocas llamadas de dibujo) y sabe quitarlas. */
export class Tailor {
  private b: RigBuilder
  constructor(rig: PetRig) {
    this.b = new RigBuilder(rig.root)
  }
  /** Pieza en el espacio de la articulación. */
  local(joint: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, place: Place = {}, outline = 1) {
    this.b.addLocal(joint, geo, mat, { ...place, outline })
  }
  /** Pieza en el espacio del modelo en reposo (se pasa al de la articulación). */
  model(joint: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, place: Place = {}, outline = 1) {
    const rest = joint.userData.rest as THREE.Matrix4
    geo.applyMatrix4(placeMatrix(place)).applyMatrix4(rest.clone().invert())
    this.b.addLocal(joint, geo, mat, { outline })
  }
  finish() {
    return this.b.finish()
  }
}

// ---------- Torso de la gallina ----------

// Torso sobre el que se cose: el de la gallina, o el del modelo que se está vistiendo (el gato).
let T: TorsoSpec = HEN.torso
let NA = Math.atan2(T.hackle.dir[2], T.hackle.dir[1])
let center = v(...T.center)
let surface: ((d: THREE.Vector3) => THREE.Vector3) | undefined
/**
 * Elige el torso sobre el que se calzan las prendas (lo llama `dress`). `point` da la superficie
 * si no es la esfera deformada de `spec` (el gato: cuerpo de una pieza con ancas y pecho).
 */
export function fitTorso(spec: TorsoSpec = HEN.torso, point?: (d: THREE.Vector3) => THREE.Vector3) {
  T = spec
  NA = Math.atan2(T.hackle.dir[2], T.hackle.dir[1])
  center = v(...T.center)
  surface = point
}
const henBodyPoint = (d: THREE.Vector3) => (surface ? surface(d) : bodyPoint(T, d))

/**
 * Dirección desde el centro del torso con el polo en la esclavina (donde nace el cuello):
 * `th` = 0 en el cuello y π en la cola de abajo; `a` = 0 al frente.
 */
export function tdir(a: number, th: number) {
  const x = Math.sin(a) * Math.sin(th)
  const y = Math.cos(th)
  const z = Math.cos(a) * Math.sin(th)
  return v(x, y * Math.cos(NA) - z * Math.sin(NA), y * Math.sin(NA) + z * Math.cos(NA))
}

/** Punto del torso en la dirección `d`, separado `off` hacia afuera. */
export function onTorso(d: THREE.Vector3, off: number) {
  d = d.clone().normalize()
  const p = henBodyPoint(d)
  const t1 = Math.abs(d.y) < 0.9 ? v(0, 1, 0).cross(d).normalize() : v(1, 0, 0).cross(d).normalize()
  const t2 = d.clone().cross(t1)
  const e = 2e-3
  const p1 = henBodyPoint(d.clone().addScaledVector(t1, e).normalize()).sub(p)
  const p2 = henBodyPoint(d.clone().addScaledVector(t2, e).normalize()).sub(p)
  const n = p1.cross(p2).normalize()
  if (n.dot(p.clone().sub(center)) < 0) n.negate()
  return p.addScaledVector(n, off)
}
export const at = (a: number, th: number, off: number) => onTorso(tdir(a, th), off)
/** Punto del torso por azimut alrededor del eje vertical y elevación (para lo que cuelga derecho). */
export const atH = (az: number, el: number, off: number) => onTorso(v(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)), off)

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Prenda que envuelve el torso entre el escote (th0) y el ruedo (th1). */
export function wrap(th0: number, th1: number, off: number, a0 = -Math.PI, a1 = Math.PI, thick = 0.01) {
  return thickSurface((u, w) => at(lerp(a0, a1, u), lerp(th0, th1, w), off), 72, 18, thick)
}

/** Cordón o costura que rodea el torso a una altura del eje del cuello. */
export function band(th: number, off: number, r: number, a0 = -Math.PI, a1 = Math.PI) {
  const closed = a1 - a0 >= Math.PI * 2 - 1e-6
  const pts = Array.from({ length: 48 }, (_, i) => at(lerp(a0, a1, i / (closed ? 48 : 47)), th, off))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), 96, r, 10, closed)
}

/** Lazo (dos orejas y un nudo) mirando hacia +z. */
export function bow(t: Tailor, j: THREE.Object3D, pos: THREE.Vector3, normal: THREE.Vector3, size: number, color: string, knot = color) {
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), normal.clone().normalize())
  const e = new THREE.Euler().setFromQuaternion(q)
  const loop = (s: number) => {
    const g = lathe([[0, 0], [0.42, 0.18], [0.5, 0.55], [0.3, 0.9], [0, 1]], { segments: 20 })
    g.scale(1, 1, 0.45)
    g.rotateZ(-s * (Math.PI / 2 + 0.2))
    return g
  }
  for (const s of [1, -1]) t.model(j, loop(s), M(color), { pos: [pos.x, pos.y, pos.z], rot: [e.x, e.y, e.z], scale: size })
  t.model(j, sphere(1, 16, 12), M(knot), { pos: [pos.x, pos.y, pos.z], rot: [e.x, e.y, e.z], scale: [size * 0.28, size * 0.3, size * 0.2] }, 0.7)
}

/** Perfil de la gota del ala (igual que en el modelo) y su radio a cada largo. */
const WING_PROFILE: [number, number][] = [[0, 0], [0.255, 0.06], [0.34, 0.22], [0.279, 0.48], [0.143, 0.78], [0.04, 0.97], [0, 1]]
const wingRadius = (() => {
  const cache = new Map<number, number>()
  return (y: number) => {
    const k = Math.round(y * 200)
    let r = cache.get(k)
    if (r === undefined) cache.set(k, (r = profileRadius(WING_PROFILE, k / 200)))
    return r
  }
})()

/**
 * Manga sobre el ala de la gallina (s = 1 izquierda). Es una funda que cubre solo la cara de
 * afuera del ala (y apenas dobla por el borde), así nunca entra en el cuerpo al aletear o girar.
 */
export function sleeve(t: Tailor, rig: PetRig, s: number, mat: THREE.Material, cuff: THREE.Material | null, len = 0.5, puff = 1) {
  const wing = rig.sockets.wings[s > 0 ? 0 : 1]
  // El ala de la gallina, o el brazo que traiga el modelo (el gato).
  const arm = rig.arm ?? { base: [0.232, 0.42, 0.085] as V3, rx: -1.78, rz: 0.24, sx: 0.09, sy: 0.37, sz: 0.46 }
  const base: V3 = [s * arm.base[0], arm.base[1], arm.base[2]]
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s * arm.rz)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(arm.rx, 0, 0)))
  const e = new THREE.Euler().setFromQuaternion(q)
  const rot: V3 = [e.x, e.y, e.z]
  // Escala del ala: fina hacia afuera (x), larga (y) y alta (z).
  const SX = arm.sx
  const SY = arm.sy
  const SZ = arm.sz
  const A = Math.PI / 2 + 0.32
  /** Punto de la funda: φ recorre la cara externa de borde a borde, y a lo largo del ala. */
  const shell = (phi: number, y: number, off: number) => {
    const bulge = 1 + (puff - 1) * Math.sin(Math.PI * Math.min(1, y / len))
    const r = wingRadius(y) * bulge
    const c = Math.cos(phi)
    // Por fuera se separa un poco más; por el borde casi pegada (para no tocar el cuerpo).
    return v(s * (c * r * SX * 1.18 + Math.max(0, c) * off), y * SY, Math.sin(phi) * (r * SZ * 1.04 + off * 0.6))
  }
  const ph = (u: number) => lerp(-A, A, s > 0 ? u : 1 - u)
  t.model(wing, thickSurface((u, w) => shell(ph(u), lerp(0.004, len, w), 0.01), 28, 14, 0.008), mat, { pos: base, rot })
  if (cuff) {
    const pts = Array.from({ length: 25 }, (_, i) => shell(lerp(-A, A, i / 24), len, 0.016))
    t.model(wing, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.014, 8), cuff, { pos: base, rot }, 0.8)
  }
}

/** Ángulo (desde el cuello) del escote y del ruedo según la prenda. */
export const NECK = 0.42

