import * as THREE from 'three'
import { tintHex, tintTexture } from '../tint'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeOutlineGeometry, makeOutlineMaterial, makeToonGradient } from '../../scene/toon'

// Kit para armar personajes y accesorios por código con el look toon (cel-shading + tinta).
// Las piezas se construyen en "espacio del modelo" (alto ≈ 1, suelo en y = 0, frente = +z) y el
// RigBuilder las agrupa por articulación y material: pocas llamadas de dibujo por mascota.

export const INK = '#3a2416'
export const toonGradient = makeToonGradient()
/** Grosor del trazo en unidades de mundo (igual en todas las piezas y etapas). */
export const OUTLINE_WIDTH = 0.014
export const outlineMaterial = makeOutlineMaterial(INK, OUTLINE_WIDTH)

export type V3 = [number, number, number]

/** Material toon. Dentro de un `withTint` (objetos del inventario) toma los colores del objeto. */
export function toon(color: THREE.ColorRepresentation, map?: THREE.Texture | null) {
  return new THREE.MeshToonMaterial({ color: typeof color === 'string' ? tintHex(color) : color, map: tintTexture(map) ?? null, gradientMap: toonGradient })
}

/** Transformación compacta para ubicar piezas: posición, rotación (XYZ) y escala. */
export interface Place {
  pos?: V3
  rot?: V3
  scale?: V3 | number
}

export function placeMatrix(p: Place = {}) {
  const s = p.scale ?? 1
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
    typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s),
  )
}

/** Aplica una ubicación a una geometría (horneada: la iluminación toon queda correcta). */
export function placed<T extends THREE.BufferGeometry>(g: T, p: Place) {
  g.applyMatrix4(placeMatrix(p))
  return g
}

// ---------- Geometrías ----------

/**
 * Sólido de revolución a partir de un perfil [radio, altura] suavizado con Catmull-Rom.
 * El primer y el último punto deberían tener radio 0 para que quede cerrado.
 * La costura queda atrás (u = 0 y 1 en -z, u = 0.5 al frente).
 */
export function lathe(profile: [number, number][], opts: { segments?: number; samples?: number } = {}) {
  const { segments = 40, samples = 48 } = opts
  const curve = new THREE.CatmullRomCurve3(
    profile.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    'centripetal',
  )
  const pts = curve.getSpacedPoints(samples).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y))
  pts[0].x = profile[0][0]
  pts[pts.length - 1].x = profile[profile.length - 1][0]
  return new THREE.LatheGeometry(pts, segments, Math.PI, Math.PI * 2)
}

/** Radio del perfil a una altura dada (interpolación lineal sobre el perfil suavizado). */
export function profileRadius(profile: [number, number][], y: number) {
  const curve = new THREE.CatmullRomCurve3(profile.map(([r, yy]) => new THREE.Vector3(r, yy, 0)), false, 'centripetal')
  const pts = curve.getSpacedPoints(160)
  let best = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) {
      const k = (y - a.y) / (b.y - a.y)
      best = Math.max(best, a.x + (b.x - a.x) * k)
    }
  }
  return best
}

/** Gota: redonda abajo y en punta hacia +y (largo 1). Base para plumas, alas, pétalos. */
export function teardrop(fat = 0.32, tip = 0.04, segments = 24) {
  return lathe(
    [
      [0, 0],
      [fat * 0.75, 0.06],
      [fat, 0.22],
      [fat * 0.82, 0.48],
      [fat * 0.42, 0.78],
      [tip, 0.97],
      [0, 1],
    ],
    { segments, samples: 32 },
  )
}

export const sphere = (r = 1, w = 32, h = 20) => new THREE.SphereGeometry(r, w, h)
export const cylinder = (rTop: number, rBottom: number, h: number, seg = 28) => new THREE.CylinderGeometry(rTop, rBottom, h, seg)
export const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 16)
export const torus = (r: number, tube: number, seg = 40) => new THREE.TorusGeometry(r, tube, 12, seg)

/**
 * Lámina con grosor (cerrada, para que el contorno funcione) a partir de una superficie f(u, v).
 * Sirve para capas, delantales, pañuelos, alas de sombrero…
 */
export function thickSurface(f: (u: number, v: number) => THREE.Vector3, nu: number, nv: number, thickness: number) {
  const P: THREE.Vector3[][] = []
  for (let i = 0; i <= nu; i++) {
    P.push([])
    for (let j = 0; j <= nv; j++) P[i].push(f(i / nu, j / nv))
  }
  const N: THREE.Vector3[][] = []
  for (let i = 0; i <= nu; i++) {
    N.push([])
    for (let j = 0; j <= nv; j++) {
      const du = P[Math.min(nu, i + 1)][j].clone().sub(P[Math.max(0, i - 1)][j])
      const dv = P[i][Math.min(nv, j + 1)].clone().sub(P[i][Math.max(0, j - 1)])
      N[i].push(du.cross(dv).normalize())
    }
  }
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const h = thickness / 2
  const vid = (side: number, i: number, j: number) => side * (nu + 1) * (nv + 1) + i * (nv + 1) + j
  for (const side of [0, 1]) {
    const k = side === 0 ? h : -h
    for (let i = 0; i <= nu; i++)
      for (let j = 0; j <= nv; j++) {
        const p = P[i][j].clone().addScaledVector(N[i][j], k)
        pos.push(p.x, p.y, p.z)
        uv.push(i / nu, j / nv)
      }
  }
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const a = vid(0, i, j)
      const b = vid(0, i + 1, j)
      const c = vid(0, i + 1, j + 1)
      const d = vid(0, i, j + 1)
      idx.push(a, b, c, a, c, d)
      const a2 = vid(1, i, j)
      const b2 = vid(1, i + 1, j)
      const c2 = vid(1, i + 1, j + 1)
      const d2 = vid(1, i, j + 1)
      idx.push(a2, c2, b2, a2, d2, c2)
    }
  // Bordes: unen la cara de arriba con la de abajo.
  const rim: [number, number][] = []
  for (let i = 0; i < nu; i++) rim.push([i, 0])
  for (let j = 0; j < nv; j++) rim.push([nu, j])
  for (let i = nu; i > 0; i--) rim.push([i, nv])
  for (let j = nv; j > 0; j--) rim.push([0, j])
  for (let r = 0; r < rim.length; r++) {
    const [i0, j0] = rim[r]
    const [i1, j1] = rim[(r + 1) % rim.length]
    const a = vid(0, i0, j0)
    const b = vid(0, i1, j1)
    const c = vid(1, i1, j1)
    const d = vid(1, i0, j0)
    idx.push(a, d, c, a, c, b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Si la superficie quedó al revés (normales hacia adentro), se invierten las caras.
  return g
}

/** Forma 2D extruida con bordes redondeados (corazones, estrellas, moños…), centrada en z. */
export function extruded(shape: THREE.Shape, depth: number, bevel = depth * 0.45) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 24,
  })
  g.translate(0, 0, -depth / 2)
  return g
}

export function heartShape(s = 1) {
  const h = new THREE.Shape()
  h.moveTo(0, -0.9 * s)
  h.bezierCurveTo(-0.35 * s, -0.55 * s, -1 * s, -0.2 * s, -0.95 * s, 0.3 * s)
  h.bezierCurveTo(-0.9 * s, 0.85 * s, -0.25 * s, 0.95 * s, 0, 0.5 * s)
  h.bezierCurveTo(0.25 * s, 0.95 * s, 0.9 * s, 0.85 * s, 0.95 * s, 0.3 * s)
  h.bezierCurveTo(1 * s, -0.2 * s, 0.35 * s, -0.55 * s, 0, -0.9 * s)
  return h
}

export function starShape(points = 5, outer = 1, inner = 0.48) {
  const s = new THREE.Shape()
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2
    const r = i % 2 ? inner : outer
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  return s
}

// ---------- Texturas pintadas en canvas ----------

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat = false) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Generador pseudoaleatorio con semilla (las texturas salen iguales en cada carga). */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- Armado por articulaciones ----------

interface JointBuckets {
  meshes: Map<THREE.Material, THREE.BufferGeometry[]>
  outline: THREE.BufferGeometry[]
}

/** Deja la geometría con los atributos comunes (posición, normal, uv) e indexada, para poder unirla. */
function normalize(g: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', g.getAttribute('position'))
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  out.setAttribute('normal', g.getAttribute('normal'))
  const uv = g.getAttribute('uv') ?? new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2)
  out.setAttribute('uv', uv)
  if (g.index) out.setIndex(g.index)
  else out.setIndex([...Array(g.getAttribute('position').count).keys()])
  return out
}

export interface AddOptions extends Place {
  /** Peso del contorno (0 = sin trazo, 1 = normal). */
  outline?: number
  /** La pieza no proyecta trazo propio pero tampoco se une al resto (p. ej. transparentes). */
  name?: string
}

/**
 * Junta piezas por articulación y material. Las piezas se dan en espacio del modelo (pose de
 * reposo) y se convierten al espacio local de la articulación; al final cada articulación tiene
 * una malla por material + una malla de contorno.
 */
export class RigBuilder {
  private joints = new Map<THREE.Object3D, JointBuckets>()
  private inverse = new Map<THREE.Object3D, THREE.Matrix4>()
  constructor(private root: THREE.Object3D) {
    root.updateMatrixWorld(true)
  }

  add(joint: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, opts: AddOptions = {}) {
    let inv = this.inverse.get(joint)
    if (!inv) {
      const rootInv = this.root.matrixWorld.clone().invert()
      inv = rootInv.multiply(joint.matrixWorld).invert()
      this.inverse.set(joint, inv)
    }
    this.put(joint, geometry, material, opts, inv)
  }

  /** Igual que add, pero la geometría ya viene en el espacio local de la articulación. */
  addLocal(joint: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, opts: AddOptions = {}) {
    this.put(joint, geometry, material, opts)
  }

  private put(joint: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, opts: AddOptions, inv?: THREE.Matrix4) {
    const g = geometry.clone()
    g.applyMatrix4(placeMatrix(opts))
    if (inv) g.applyMatrix4(inv)
    let b = this.joints.get(joint)
    if (!b) this.joints.set(joint, (b = { meshes: new Map(), outline: [] }))
    const list = b.meshes.get(material) ?? []
    list.push(normalize(g))
    b.meshes.set(material, list)
    const w = opts.outline ?? 1
    if (w > 0) {
      const o = makeOutlineGeometry(g)
      const s = o.getAttribute('outlineScale') as THREE.BufferAttribute
      for (let i = 0; i < s.count; i++) s.setX(i, s.getX(i) * w)
      b.outline.push(o)
    }
  }

  /** Crea las mallas y las cuelga de sus articulaciones. Devuelve las mallas (para poder quitarlas). */
  finish() {
    const out: THREE.Mesh[] = []
    for (const [joint, b] of this.joints) {
      for (const [mat, geos] of b.meshes) {
        const mesh = new THREE.Mesh(mergeGeometries(geos), mat)
        mesh.frustumCulled = false
        joint.add(mesh)
        out.push(mesh)
      }
      if (b.outline.length) {
        const o = new THREE.Mesh(mergeGeometries(b.outline), outlineMaterial)
        o.frustumCulled = false
        joint.add(o)
        out.push(o)
      }
    }
    this.joints.clear()
    return out
  }
}

/** Crea una articulación vacía en una posición del modelo, colgando de `parent` (posiciones absolutas). */
export function joint(name: string, parent: THREE.Object3D | null, worldPos: V3) {
  const j = new THREE.Group()
  j.name = name
  j.rotation.order = 'YXZ'
  if (parent) {
    parent.updateMatrixWorld(true)
    const local = parent.worldToLocal(new THREE.Vector3(...worldPos))
    j.position.copy(local)
    parent.add(j)
  } else j.position.set(...worldPos)
  // Al día desde ya: se pueden colgar piezas de ella aunque se cree después del RigBuilder.
  j.updateMatrixWorld(true)
  return j
}

// ---------- Puntos sobre superficies (para ubicar ojos, cachetes, picos) ----------

/** Punto de un elipsoide: az = giro desde el frente (+x a la izquierda de la mascota), el = elevación. */
export function spotOnEllipsoid(center: V3, radii: V3, az: number, el: number) {
  const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  const pos = new THREE.Vector3(center[0] + d.x * radii[0], center[1] + d.y * radii[1], center[2] + d.z * radii[2])
  const normal = new THREE.Vector3(d.x / radii[0], d.y / radii[1], d.z / radii[2]).normalize()
  return { pos, normal }
}

/** Punto de un sólido de revolución a la altura y, girado az desde el frente. */
export function spotOnLathe(profile: [number, number][], y: number, az: number, scaleZ = 1, offset: V3 = [0, 0, 0]) {
  const r = profileRadius(profile, y)
  const dy = 0.01
  const slope = (profileRadius(profile, y + dy) - profileRadius(profile, y - dy)) / (2 * dy)
  const pos = new THREE.Vector3(Math.sin(az) * r + offset[0], y + offset[1], Math.cos(az) * r * scaleZ + offset[2])
  const normal = new THREE.Vector3(Math.sin(az), -slope, Math.cos(az) / scaleZ).normalize()
  return { pos, normal }
}
