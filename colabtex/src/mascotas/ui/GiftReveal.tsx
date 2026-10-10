import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getStage } from '../data/species'
import { play } from '../audio/sound'
import type { Item } from '../game/inventory'
import type { SpeciesId } from '../game/types'
import type { Genes } from '../pets/rig'
import { PetView, type PetCue } from '../pets/PetView'
import { RigBuilder, toon } from '../pets/rig/kit'
import { danceSeconds, getDance } from '../data/accessories'
import { buildItemModel, type ItemModel } from './itemModel'
import { swatch } from './swatch'

// Abrir un regalo, en 3D: la caja cae, tiembla cada vez más (si es legendario brilla dorada),
// salta la tapa, las paredes se abren como una flor con una lluvia de papel picado y sale lo que
// trae, girando sobre la caja abierta. Si es un baile, sale una gallina bailándolo.

/** Instantes (s): termina de caer, revienta y queda a la vista. */
const T_LAND = 0.55
const T_POP = 2.0
const T_SHOW = 2.75

const W = 1.1 // ancho de la caja
const H = 0.85 // alto de las paredes
const TH = 0.07 // grosor
const BOXES: [string, string][] = [
  ['#e85d75', '#ffd84a'],
  ['#4f8fd8', '#ffffff'],
  ['#5aa64a', '#ffe27a'],
  ['#ff9a3c', '#7a4fd6'],
  ['#f2c230', '#e8453c'],
]
const LEGEND_BOX: [string, string] = ['#5b3bb5', '#ffcf3a']

export interface Opening {
  item: Item
  legendary: boolean
  /** Cambia en cada regalo. */
  key: number
  /** La caja ya estaba en el escenario (el primero): no cae, empieza a temblar. */
  inPlace: boolean
}

const easeOutBack = (x: number, s = 1.9) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)
function easeOutBounce(x: number) {
  const n = 7.5625
  const d = 2.75
  if (x < 1 / d) return n * x * x
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375
  return n * (x -= 2.625 / d) * x + 0.984375
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

let glowTex: THREE.CanvasTexture | null = null
function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.35, 'rgba(255,255,255,.55)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c)
  glowTex.colorSpace = THREE.SRGBColorSpace
  return glowTex
}

let starTex: THREE.CanvasTexture | null = null
function starTexture() {
  if (starTex) return starTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.translate(32, 32)
  g.beginPath()
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 7 : 28
    const a = (i * Math.PI) / 4
    g.lineTo(Math.sin(a) * r, -Math.cos(a) * r)
  }
  g.closePath()
  g.fillStyle = '#ffffff'
  g.shadowColor = '#fff6c0'
  g.shadowBlur = 8
  g.fill()
  starTex = new THREE.CanvasTexture(c)
  starTex.colorSpace = THREE.SRGBColorSpace
  return starTex
}

/** La caja: base, cuatro paredes con bisagra abajo y la tapa con moño. */
function buildBox([body, ribbon]: [string, string]) {
  const root = new THREE.Group()
  const mats = { body: toon(body), ribbon: toon(ribbon), inside: toon(new THREE.Color(body).multiplyScalar(0.55)) }
  const meshes: THREE.Mesh[] = []
  const finish = (g: THREE.Object3D, fill: (b: RigBuilder) => void) => {
    const b = new RigBuilder(g)
    fill(b)
    meshes.push(...b.finish())
  }
  const base = new THREE.Group()
  root.add(base)
  finish(base, (b) => {
    b.add(base, new THREE.BoxGeometry(W, TH, W), mats.inside, { pos: [0, TH / 2, 0] })
  })
  const flaps: THREE.Group[] = []
  for (let i = 0; i < 4; i++) {
    const yaw = (i * Math.PI) / 2
    const hinge = new THREE.Group()
    hinge.position.set(Math.sin(yaw) * (W / 2), TH, Math.cos(yaw) * (W / 2))
    hinge.rotation.y = yaw
    const flap = new THREE.Group()
    hinge.add(flap)
    root.add(hinge)
    const w = i % 2 ? W - 2 * TH : W
    finish(flap, (b) => {
      b.add(flap, new THREE.BoxGeometry(w, H, TH), mats.body, { pos: [0, H / 2, -TH / 2] })
      b.add(flap, new THREE.BoxGeometry(0.17, H, 0.02), mats.ribbon, { pos: [0, H / 2, 0.012] })
      b.add(flap, new THREE.BoxGeometry(w * 0.96, H * 0.96, 0.01), mats.inside, { pos: [0, H / 2, -TH - 0.004], outline: 0 })
    })
    flaps.push(flap)
  }
  const lid = new THREE.Group()
  lid.position.y = TH + H
  root.add(lid)
  finish(lid, (b) => {
    const L = W + 0.1
    b.add(lid, new THREE.BoxGeometry(L, 0.18, L), mats.body, { pos: [0, 0.09, 0] })
    b.add(lid, new THREE.BoxGeometry(0.18, 0.2, L + 0.02), mats.ribbon, { pos: [0, 0.09, 0] })
    b.add(lid, new THREE.BoxGeometry(L + 0.02, 0.2, 0.18), mats.ribbon, { pos: [0, 0.09, 0] })
    // Moño: dos lazos, el nudo y dos puntas.
    for (const s of [-1, 1]) {
      b.add(lid, new THREE.TorusGeometry(0.15, 0.055, 10, 22), mats.ribbon, { pos: [s * 0.15, 0.3, 0], rot: [0, s * 0.35, s * -0.5], scale: [1, 1, 0.8] })
      b.add(lid, new THREE.BoxGeometry(0.1, 0.03, 0.3), mats.ribbon, { pos: [s * 0.12, 0.2, 0.18], rot: [0, s * 0.5, 0] })
    }
    b.add(lid, new THREE.SphereGeometry(0.085, 14, 10), mats.ribbon, { pos: [0, 0.28, 0] })
  })
  return {
    root,
    flaps,
    lid,
    mats,
    dispose() {
      for (const m of meshes) m.geometry.dispose()
      for (const m of Object.values(mats)) m.dispose()
    },
  }
}

/** Papel picado: rectangulitos de colores que salen volando y caen girando. */
const CONFETTI = 80
function useConfetti(colors: string[]) {
  return useMemo(() => {
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONFETTI)
    mesh.frustumCulled = false
    const parts = Array.from({ length: CONFETTI }, (_, i) => {
      const c = new THREE.Color(colors[i % colors.length])
      mesh.setColorAt(i, c)
      return { p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }
    })
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const one = new THREE.Vector3(1, 1, 1)
    const zero = new THREE.Vector3(0, 0, 0)
    return {
      mesh,
      burst(y: number) {
        for (const p of parts) {
          const a = Math.random() * Math.PI * 2
          const s = 0.8 + Math.random() * 2.2
          p.p.set((Math.random() - 0.5) * 0.4, y, (Math.random() - 0.5) * 0.4)
          p.v.set(Math.cos(a) * s, 3 + Math.random() * 3.2, Math.sin(a) * s * 0.7 + 0.4)
          p.w.set(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7)
        }
      },
      step(dt: number, live: boolean) {
        parts.forEach((p, i) => {
          if (live) {
            p.v.y -= 7 * dt
            p.v.multiplyScalar(1 - Math.min(0.9, dt * 1.4))
            p.p.addScaledVector(p.v, dt)
            p.r.set(p.r.x + p.w.x * dt, p.r.y + p.w.y * dt, p.r.z + p.w.z * dt)
          }
          const on = live && p.p.y > -0.2
          m.compose(p.p, q.setFromEuler(p.r), on ? one : zero)
          mesh.setMatrixAt(i, m)
        })
        mesh.instanceMatrix.needsUpdate = true
      },
      dispose() {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
        mesh.dispose()
      },
    }
  }, [colors])
}

function Aim() {
  const camera = useThree((s) => s.camera)
  useEffect(() => camera.lookAt(0, 0.42, 0), [camera])
  return null
}


function Show({ opening, look, species = 'chicken', onPop, onShown, skip }: { opening: Opening | null; look?: Genes; species?: SpeciesId; onPop: () => void; onShown: () => void; skip: { current: number } }) {
  const item = opening?.item ?? null
  const legendary = !!opening?.legendary
  // Una caja nueva por regalo (colores al azar; morada con dorado si es legendario). La primera ya
  // estaba esperando: conserva sus colores.
  const last = useRef<[string, string] | null>(null)
  const colors = useMemo(() => {
    const keep = opening?.inPlace && !legendary && last.current
    return (last.current = keep || (legendary ? LEGEND_BOX : BOXES[Math.floor(Math.random() * BOXES.length)]))
  }, [legendary, opening?.key, opening?.inPlace])
  const box = useMemo(() => buildBox(colors), [colors])
  useEffect(() => () => box.dispose(), [box])
  const model = useMemo<ItemModel | null>(() => (item ? buildItemModel(item) : null), [item])
  useEffect(() => () => model?.dispose(), [model])
  const confettiColors = useMemo(() => {
    const own = item ? swatch(item.kind, item.id, item.tint) : []
    return [...own, ...own, legendary ? '#ffcf3a' : '#ff7ac8', '#ffffff', '#ffd84a', '#7fd3c7', colors[0]]
  }, [item, legendary, colors])
  const confetti = useConfetti(confettiColors)
  useEffect(() => () => confetti.dispose(), [confetti])

  const glow = useRef<THREE.Sprite>(null)
  const show = useRef<THREE.Group>(null)
  const stars = useRef<THREE.Group>(null)
  const t0 = useRef<number | null>(null)
  const fired = useRef({ pop: false, shown: false, knock: 0, dance: 0 })
  const [cue, setCue] = useState<PetCue | null>(null)
  const ribbonBase = useMemo(() => box.mats.ribbon.color.clone(), [box])

  useEffect(() => {
    t0.current = null
    fired.current = { pop: false, shown: false, knock: 0, dance: 0 }
    setCue(null)
  }, [opening?.key, setCue])

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const now = clock.elapsedTime
    const f = fired.current
    const { root, flaps, lid } = box
    // Sin regalo: la caja espera meciéndose.
    if (!opening) {
      root.position.set(0, Math.abs(Math.sin(now * 2.2)) * 0.05, 0)
      root.rotation.set(0, Math.sin(now * 0.7) * 0.25, Math.sin(now * 4.4) * 0.02)
      lid.position.set(0, TH + H, 0)
      lid.rotation.set(0, 0, 0)
      for (const fl of flaps) fl.rotation.x = 0
      if (glow.current) glow.current.visible = false
      if (show.current) show.current.visible = false
      if (stars.current) stars.current.visible = false
      confetti.step(dt, false)
      return
    }
    if (t0.current == null) t0.current = now - (opening.inPlace ? T_LAND : 0)
    // Tocar el escenario adelanta hasta el estallido.
    if (skip.current) {
      skip.current = 0
      const T = now - t0.current
      if (T < T_POP - 0.15) t0.current = now - (T_POP - 0.15)
    }
    const T = now - t0.current

    // Cae (con rebote) y tiembla cada vez más; da saltitos.
    const drop = clamp01(T / T_LAND)
    let y = (1 - easeOutBounce(drop)) * 3
    const s = clamp01((T - T_LAND) / (T_POP - T_LAND))
    const amp = T > T_LAND && T < T_POP ? 0.02 + 0.16 * s * s : 0
    for (const at of [1.05, 1.5, 1.8]) {
      const u = (T - at) / 0.2
      if (u > 0 && u < 1) y += Math.sin(u * Math.PI) * 0.1 * (1 + s)
      if (T >= at && f.knock < at) {
        f.knock = at
        play('knock')
      }
    }
    root.position.set(0, y, 0)
    root.rotation.set(Math.sin(T * 31 + 1) * amp * 0.5, Math.sin(T * 3) * 0.15 * (1 - s), Math.sin(T * 38) * amp)
    // El legendario se va poniendo dorado y brilla por las rendijas.
    if (legendary) box.mats.ribbon.color.copy(ribbonBase).lerp(new THREE.Color('#fff6c0'), T < T_POP ? s * Math.abs(Math.sin(T * 12)) * 0.6 : 0)

    // Revienta: la tapa sale volando y las paredes se abren.
    const p = T - T_POP
    if (p >= 0 && !f.pop) {
      f.pop = true
      confetti.burst(TH + H)
      play('pop')
      play(legendary ? 'magic' : 'boing')
      onPop()
    }
    if (p < 0) {
      lid.position.set(0, TH + H + amp * 0.4 * Math.abs(Math.sin(T * 26)), 0)
      lid.rotation.set(0, 0, 0)
      for (const fl of flaps) fl.rotation.x = 0
    } else {
      lid.position.set(1.2 * p, TH + H + 5 * p - 4.5 * p * p, 0.9 * p)
      lid.rotation.set(-3 * p, 2 * p, -5 * p)
      lid.visible = p < 1.6
      const open = easeOutBounce(clamp01(p / 0.75))
      for (const fl of flaps) fl.rotation.x = open * (Math.PI / 2 - 0.02)
    }
    confetti.step(dt, p >= 0)

    // Resplandor: por las rendijas mientras tiembla, un fogonazo al abrirse y después suave.
    if (glow.current) {
      const g = glow.current
      g.visible = T > T_LAND
      const m = g.material
      m.color.set(legendary ? '#ffd65a' : '#ffffff')
      if (p < 0) {
        g.position.set(0, TH + H, 0)
        g.scale.setScalar(1.2 + s * 0.8)
        m.opacity = s * 0.55 * (0.7 + 0.3 * Math.sin(T * 20))
      } else {
        const k = clamp01(p / 0.5)
        g.position.set(0, 1.0, 0)
        g.scale.setScalar(1.6 + 3.2 * Math.sin(Math.min(1, k) * Math.PI * 0.5))
        m.opacity = p < 0.5 ? 1 - k * 0.6 : 0.4 * (legendary ? 1 : 0.6)
      }
    }

    // Sale lo que trae: crece con rebote girando rápido y después gira despacio.
    if (show.current) {
      const g = show.current
      const u = clamp01((p - 0.1) / 0.7)
      g.visible = p > 0.1
      const k = Math.max(0.01, easeOutBack(u))
      if (item?.kind === 'dance') {
        g.position.set(0, TH, 0)
        g.scale.setScalar(k * 1.3)
        g.rotation.y = (1 - u) * (1 - u) * Math.PI * 4
      } else {
        g.position.set(0, 0.5 + 0.75 * u + (u >= 1 ? Math.sin((p - 0.8) * 2) * 0.05 : 0), 0)
        g.scale.setScalar(k * 0.8)
        g.rotation.y = (1 - u) * (1 - u) * Math.PI * 6 + p * 0.7 - 0.5
      }
    }
    model?.update(now)
    if (stars.current) {
      stars.current.visible = legendary && p > 0.3
      stars.current.children.forEach((c, i) => {
        const a = now * 0.9 + (i * Math.PI * 2) / stars.current!.children.length
        c.position.set(Math.cos(a) * 0.95, 1.2 + Math.sin(now * 2 + i) * 0.35, Math.sin(a) * 0.95)
        c.scale.setScalar(0.12 + 0.08 * Math.abs(Math.sin(now * 4 + i * 1.7)))
      })
    }
    if (T >= T_SHOW && !f.shown) {
      f.shown = true
      onShown()
    }
    // El baile se repite mientras se muestra.
    if (item?.kind === 'dance' && p > 0.6) {
      const d = getDance(item.id)
      const len = d ? danceSeconds(d) + 1.2 : 8
      if (!f.dance || now - f.dance > len) {
        f.dance = now
        setCue({ id: 'dance', key: now, dance: item.id })
      }
    }
  })

  return (
    <>
      <primitive object={box.root} />
      <primitive object={confetti.mesh} />
      <sprite ref={glow} renderOrder={5}>
        <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <group ref={show} visible={false}>
        {item?.kind === 'dance' ? (
          <PetView stage={getStage(species, 'adult')} expression="happy" cue={cue} roam={false} look={look} />
        ) : (
          model && <primitive object={model.root} />
        )}
      </group>
      <group ref={stars} visible={false}>
        {Array.from({ length: 7 }, (_, i) => (
          <sprite key={i}>
            <spriteMaterial map={starTexture()} color="#ffe27a" transparent depthWrite={false} />
          </sprite>
        ))}
      </group>
    </>
  )
}

/** Escenario 3D del regalo. */
export function GiftReveal(props: { opening: Opening | null; look?: Genes; species?: SpeciesId; onPop: () => void; onShown: () => void; skip: { current: number } }) {
  return (
    <Canvas flat dpr={[1, 2]} camera={{ fov: 30, position: [0, 2.4, 6.2] }} gl={{ alpha: true, antialias: true }}>
      <Aim />
      <ambientLight intensity={0.9} />
      <directionalLight position={[1.5, 4, 6]} intensity={2.4} />
      <Show {...props} />
    </Canvas>
  )
}
