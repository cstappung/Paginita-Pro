import { useEffect, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import type { Item } from '../game/inventory'
import { buildItemModel, mannequinFor, visibleBox, type ItemModel } from './itemModel'

// Miniaturas 3D del inventario: cada objeto (con sus colores) se dibuja una vez en un lienzo
// aparte y queda como imagen. Se hacen de a pocas por cuadro para no trabar la app.

const SIZE = 200
/** Giro de tres cuartos: se ve el frente y un costado. */
const YAW = -0.55

const cache = new Map<string, string>()
const queue = new Map<string, Item>()
const listeners = new Set<() => void>()
let version = 0
let timer = 0
let failed = false

let gl: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera } | null = null
function setup() {
  if (gl || failed) return gl
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(1)
    renderer.setSize(SIZE, SIZE, false)
    renderer.setClearColor(0x000000, 0)
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const sun = new THREE.DirectionalLight(0xffffff, 2.4)
    sun.position.set(1.5, 4, 6)
    scene.add(sun)
    // Ortográfica como la escena del juego: el trazo de tinta mide lo mismo.
    const camera = new THREE.OrthographicCamera(-1.02, 1.02, 1.02, -1.02, 0.1, 20)
    camera.position.set(0, 1.4, 5)
    camera.lookAt(0, 0, 0)
    gl = { renderer, scene, camera }
  } catch {
    failed = true
  }
  return gl
}

/** Encuadra la caja (ya girada) en un cuadrado, con un poco de aire. */
function fit(camera: THREE.OrthographicCamera, box: THREE.Box3) {
  camera.updateMatrixWorld()
  const inv = camera.matrixWorldInverse
  const lo = new THREE.Vector2(Infinity, Infinity)
  const hi = new THREE.Vector2(-Infinity, -Infinity)
  const p = new THREE.Vector3()
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv)
    lo.min(new THREE.Vector2(p.x, p.y))
    hi.max(new THREE.Vector2(p.x, p.y))
  }
  const half = Math.max(hi.x - lo.x, hi.y - lo.y) * 0.56 + 0.02
  const cx = (lo.x + hi.x) / 2
  const cy = (lo.y + hi.y) / 2
  camera.left = cx - half
  camera.right = cx + half
  camera.top = cy + half
  camera.bottom = cy - half
  camera.updateProjectionMatrix()
}

export const thumbKey = (i: Item) => `${i.kind}:${i.id}:${i.tint}`

/** Fotografía un modelo (lo deja libre después) y devuelve la imagen, o null sin WebGL. */
export function snapshot(model: ItemModel): string | null {
  const g = setup()
  if (!g) {
    model.dispose()
    return null
  }
  model.root.rotation.y = YAW
  g.scene.add(model.root)
  fit(g.camera, visibleBox(model.root))
  g.renderer.render(g.scene, g.camera)
  const src = g.renderer.domElement.toDataURL('image/png')
  g.scene.remove(model.root)
  model.dispose()
  return src
}

function shoot(item: Item) {
  const model = buildItemModel(item, item.kind === 'dance' || item.kind === 'decor' ? undefined : mannequinFor(item.kind))
  if (!model) return
  const src = snapshot(model)
  if (src) cache.set(thumbKey(item), src)
}

function pump() {
  timer = 0
  const t0 = performance.now()
  for (const [k, item] of queue) {
    queue.delete(k)
    try {
      shoot(item)
    } catch (e) {
      console.warn('miniatura', k, e)
    }
    if (performance.now() - t0 > 20) break
  }
  version++
  for (const l of listeners) l()
  if (queue.size) timer = window.setTimeout(pump, 16)
}

function request(item: Item) {
  const k = thumbKey(item)
  if (item.kind === 'dance' || cache.has(k) || queue.has(k) || failed) return
  queue.set(k, item)
  if (!timer) timer = window.setTimeout(pump, 0)
}

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l))
const instantanea = () => version

/** Imagen del objeto (o null mientras se dibuja, o si no hay WebGL). */
export function useThumb(item: Item | null) {
  useSyncExternalStore(subscribe, instantanea)
  useEffect(() => {
    if (item) request(item)
  }, [item])
  return item ? (cache.get(thumbKey(item)) ?? null) : null
}
