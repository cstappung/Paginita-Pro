import { Suspense, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { play } from '../audio/sound'
import { getBackground } from '../data/accessories'
import { getStage } from '../data/species'
import { useGame, useLuz } from '../store/gameStore'
import type { StageDef } from '../data/species/types'
import { mood, puesto } from '../game/rules'
import type { ActionId, Pet, PlacedDecor } from '../game/types'
import { getDecor } from '../data/decor'
import { PetView, type PetCue } from '../pets/PetView'
import type { CueId } from '../pets/anim/cues'
import { getPet, setLure } from '../pets/handle'
import { ROOM, clampSpot } from '../game/decor'
import { night } from '../scene/decor'
import { DecorLayer, type DecorRegistry } from './DecorLayer'
import { JUEGO, lejosDe, type JuegoId } from '../game/juegos'

/** Última acción hecha sobre una mascota: se convierte en su animación de reacción. */
export type Reaction = { petId: string; action: ActionId; dance?: string; refused?: boolean; key: number; until: number; cue?: CueId }

const SLOT_W = 1.9
const SLOT_D = 1.6

/** Ordena las mascotas en una cuadrícula que se adapta al ancho de la pantalla. */
function layout(count: number, width: number) {
  const cols = Math.max(1, Math.min(count, width < 560 ? 2 : width < 900 ? 3 : 4))
  const rows = Math.ceil(count / cols)
  return { cols, rows }
}

/**
 * Lo que tiene que entrar en cuadro en primer plano, medido desde el centro de la vista: medio
 * ancho y medio alto. Lo normal es la mascota sola; con muebles lejos (o acomodándolos) se aleja.
 */
export type View = { halfW: number; halfH: number }
const PET_VIEW: View = { halfW: 1.1, halfH: 1.0 }
/** Alto del mueble más alto (la lámpara de pie), para que no se corte arriba. */
const DECOR_TALL = 0.9
/** Inclinación de la cámara de primer plano: cuánto sube en pantalla lo que está más atrás. */
const FOCUS_Y = 0.45
const TILT = { up: 0.979, back: 0.203 }

export function viewFor(items: PlacedDecor[], decorating: boolean): View {
  let { halfW, halfH } = PET_VIEW
  const fit = (x: number, z: number, r: number, tall: number) => {
    halfW = Math.max(halfW, Math.abs(x) + r + 0.06)
    // Arriba: la punta de lo que está atrás. Abajo: la base de lo que está adelante.
    halfH = Math.max(halfH, (tall - FOCUS_Y) * TILT.up - (z - r) * TILT.back + 0.08, FOCUS_Y * TILT.up + (z + r) * TILT.back + 0.08)
  }
  // Acomodando: todo el piso disponible a la vista (y quieto mientras se arrastra).
  if (decorating) {
    fit(ROOM.x, ROOM.zMin, 0, DECOR_TALL)
    fit(ROOM.x, ROOM.zMax, 0, 0)
  }
  for (const o of items) {
    const d = getDecor(o.id)
    if (d) fit(o.x, o.z, d.r, d.flat ? 0 : DECOR_TALL)
  }
  return { halfW, halfH }
}

export function CameraRig({ count, focus, view = PET_VIEW }: { count: number; focus: boolean; view?: View }) {
  const { size, camera, invalidate } = useThree()
  const target = useRef(0)
  const { halfW, halfH } = view
  // El acercamiento cambia de a poco (al abrir la Casa o al poner algo lejos).
  useFrame((_, dt) => {
    const cam = camera as THREE.OrthographicCamera
    const d = target.current - cam.zoom
    if (Math.abs(d) < 0.05) return
    cam.zoom += d * (1 - Math.exp(-Math.min(dt, 0.1) * 8))
    if (Math.abs(target.current - cam.zoom) < 0.05) cam.zoom = target.current
    cam.updateProjectionMatrix()
    invalidate()
  })
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    const { cols, rows } = layout(count, size.width)
    // Los modelos miden ≈ 1 de alto; las filas se alejan hacia atrás (z negativo).
    const zc = focus ? 0 : -((rows - 1) * SLOT_D) / 2
    const zoom = focus
      ? Math.min(size.width / (2 * halfW), size.height / (2 * halfH))
      : Math.min(size.width / (cols * SLOT_W + 0.4), size.height / (1.5 + rows * 1.3))
    // Al cambiar de vista (corral ↔ mascota) o de tamaño, salta; si solo cambian los muebles, se desliza.
    const jump = target.current === 0 || cam.userData.focus !== focus || cam.userData.w !== size.width || cam.userData.h !== size.height
    target.current = zoom
    if (jump) cam.zoom = zoom
    cam.userData = { focus, w: size.width, h: size.height }
    cam.position.set(0, focus ? 1.9 : 2.6, 7 + zc)
    cam.lookAt(0, focus ? FOCUS_Y : 0.4, zc)
    cam.updateProjectionMatrix()
    invalidate()
  }, [size, camera, count, focus, halfW, halfH, invalidate])
  return null
}

/** Burbujita de estado sobre la mascota (qué le pasa de un vistazo). */
function bubbleFor(pet: Pet): string | null {
  const stage = getStage(pet.species, pet.stage)
  if (pet.asleep) return '💤'
  if (pet.stats.energy < 20 && stage.stats.includes('energy')) return '🥱'
  if (mood(pet) !== 'sad') return null
  const worst = stage.stats.reduce((a, b) => (pet.stats[b] < pet.stats[a] ? b : a))
  return { hunger: '🌾', happiness: '😢', energy: '💤', hygiene: '🛁' }[worst]
}

const bubbleTextures = new Map<string, THREE.CanvasTexture>()
export function bubbleTexture(emoji: string) {
  let tex = bubbleTextures.get(emoji)
  if (!tex) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.strokeStyle = '#3a2416'
    g.lineWidth = 6
    g.beginPath()
    g.roundRect(10, 10, 108, 108, 28)
    g.fill()
    g.stroke()
    g.font = '64px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(emoji, 64, 70)
    tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    bubbleTextures.set(emoji, tex)
  }
  return tex
}

/** Burbuja de estado como sprite de la escena (sin DOM, para no pelear con React). */
function Bubble({ emoji, position }: { emoji: string; position: [number, number, number] }) {
  const ref = useRef<THREE.Sprite>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = position[1] + (Math.floor(clock.elapsedTime * 2) % 2) * 0.04
  })
  return (
    <sprite ref={ref} position={position} scale={[0.34, 0.34, 1]} renderOrder={10} raycast={() => {}}>
      <spriteMaterial map={bubbleTexture(emoji)} depthTest={false} transparent />
    </sprite>
  )
}

/** Color de la noche (cuarto a oscuras): cielo, suelo y luz de luna. */
const NIGHT = { sky: new THREE.Color('#1b2140'), ground: new THREE.Color('#2c3550'), moon: new THREE.Color('#9fb2ff') }

/**
 * Cielo, suelo y luces. Con la luz apagada todo se va a azul noche de a poco (como al bajar un
 * dimmer), y la mascota queda iluminada apenas por una luz de luna fría.
 */
export function Lighting({ sky, ground, on }: { sky: string; ground: string; on: boolean }) {
  const scene = useThree((s) => s.scene)
  const amb = useRef<THREE.AmbientLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const floor = useRef<THREE.MeshBasicMaterial>(null)
  const dim = useRef(on ? 0 : 1)
  const c = useRef({ sky: new THREE.Color(), ground: new THREE.Color(), bg: new THREE.Color() })
  useEffect(() => {
    scene.background = c.current.bg
    return () => void (scene.background = null)
  }, [scene])
  useFrame((_, dt) => {
    dim.current += ((on ? 0 : 1) - dim.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 3))
    const d = dim.current
    night.level = d
    const k = c.current
    k.bg.copy(k.sky.set(sky)).lerp(NIGHT.sky, d * 0.92)
    if (floor.current) floor.current.color.copy(k.ground.set(ground)).lerp(NIGHT.ground, d * 0.85)
    if (amb.current) {
      amb.current.intensity = 0.9 - 0.62 * d
      amb.current.color.setRGB(1, 1, 1).lerp(NIGHT.moon, d)
    }
    if (sun.current) {
      sun.current.intensity = 2.4 - 1.65 * d
      sun.current.color.setRGB(1, 1, 1).lerp(NIGHT.moon, d * 0.8)
    }
  })
  return (
    <>
      <ambientLight ref={amb} intensity={0.9} />
      {/* Luz casi frontal: la cara queda iluminada y la sombra toon solo bordea la silueta. */}
      <directionalLight ref={sun} position={[1.5, 4, 6]} intensity={2.4} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial ref={floor} color={ground} />
      </mesh>
    </>
  )
}

/**
 * La animación va a cuadros (12 fps por defecto): no hace falta dibujar la escena 60 veces por
 * segundo. Con `frameloop="demand"` se pide un cuadro solo cuando cambia el cuadro de la animación
 * (ahorra batería en el celular). Con `full` (herramientas, muebles) se dibuja a ritmo completo.
 * Ojo: no se cambia `frameloop` en caliente porque eso reinicia el reloj de la escena.
 */
export function Pacer({ full }: { full: boolean }) {
  const clock = useThree((s) => s.clock)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let raf = 0
    let last = -1
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const fps = useGame.getState().fps
      // Tiempo actual del reloj de la escena (que solo avanza al dibujar).
      const now = clock.elapsedTime + (performance.now() - clock.oldTime) / 1000
      const frame = Math.floor(now * fps)
      if (full || frame !== last) {
        last = frame
        invalidate()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [clock, invalidate, full])
  return null
}

type Transition = { from: StageDef; phase: 'shake' | 'pop' }

let cueKeys = 0

function Slot(props: {
  pet: Pet
  position: [number, number, number]
  reaction: Reaction | null
  yaw?: number
  focus?: boolean
  tool?: Tool | null
  /** Avance del baño con esponja (0–1): la suciedad se va borrando mientras la frotan. */
  cleaned?: number
  onCatch?: () => void
  onPick?: () => void
}) {
  const { pet, position, reaction, yaw = 0, focus = false, tool = null, cleaned = 0, onCatch, onPick } = props
  const stage = getStage(pet.species, pet.stage)
  const [cue, setCue] = useState<PetCue | null>(null)

  // Cuando cambia de etapa: la anterior se sacude y luego aparece la nueva con rebote.
  const [seen, setSeen] = useState(pet.stage)
  const [trans, setTrans] = useState<Transition | null>(null)
  if (seen !== pet.stage) {
    setTrans({ from: getStage(pet.species, seen), phase: 'shake' })
    setSeen(pet.stage)
  }
  const phase = trans?.phase
  useEffect(() => {
    if (!phase) return
    const id = window.setTimeout(() => setTrans((t) => (t && t.phase === 'shake' ? { ...t, phase: 'pop' } : null)), phase === 'shake' ? 1500 : 1200)
    return () => window.clearTimeout(id)
  }, [phase])

  // Reacción a la última acción (si sigue vigente al montarse, no se repite después).
  const mine = reaction && reaction.petId === pet.id && reaction.until > Date.now() ? reaction : null
  useEffect(() => {
    if (mine) setCue({ id: mine.cue ?? (mine.refused ? 'refuse' : mine.action === 'dance' ? 'dance' : mine.action), dance: mine.dance, key: ++cueKeys })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.key])
  // El cambio de etapa manda sobre cualquier otra reacción.
  useEffect(() => {
    if (phase) setCue({ id: phase === 'shake' ? 'hatch' : 'appear', key: ++cueKeys })
  }, [phase])

  const shown = trans?.phase === 'shake' ? trans.from : stage
  const items = useGame((s) => s.items)
  const worn = useMemo(() => puesto(pet, items), [pet, items])
  const bubble = trans || tool ? null : bubbleFor(pet)
  const sad = mood(pet) === 'sad'
  const dirt = Math.max(0, (60 - pet.stats.hygiene) / 60) * (tool === 'clean' ? 1 - cleaned : 1)
  return (
    <group
      position={position}
      onClick={(e) => {
        if (onPick) return onPick()
        // En primer plano, tocarla le hace cosquillas (si no se estaba girando ni está dormida ni con algo en la mano).
        if (e.delta < 6 && !trans && !pet.asleep && !tool) setCue({ id: 'poke', key: ++cueKeys })
      }}
      onPointerOver={() => (document.body.style.cursor = tool ? '' : 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <Suspense fallback={null}>
        <group rotation-y={yaw}>
          <PetView
            key={shown.id}
            stage={shown}
            expression={sad ? 'sad' : 'normal'}
            sleeping={!!pet.asleep && !trans}
            dirt={dirt}
            sad={sad}
            cue={cue}
            hat={worn.ids.hat}
            boots={worn.ids.boots}
            outfit={worn.ids.outfit}
            shoes={worn.ids.shoes}
            growth={stage.growthToNext ? Math.min(1, pet.growth / stage.growthToNext) : 0}
            voice={focus}
            seed={pet.id}
            look={pet.look ?? pet.coat}
            tints={worn.tints}
            petId={pet.id}
            busy={!!tool}
            onCatch={onCatch}
          />
        </group>
        {bubble && (
          <Bubble emoji={bubble} position={[0, shown.scale * (worn.ids.hat && shown.slots.includes('hat') ? 1.75 : 1.3), 0]} />
        )}
      </Suspense>
    </group>
  )
}

function Slots(props: {
  pets: Pet[]
  selected: Pet | null
  reaction: Reaction | null
  yaw: number
  tool: Tool | null
  cleaned: number
  onCatch: () => void
  onPick: (id: string) => void
}) {
  const { pets, selected, reaction, yaw, tool, cleaned, onCatch, onPick } = props
  const width = useThree((s) => s.size.width)
  if (selected)
    return <Slot key={selected.id} pet={selected} position={[0, 0, 0]} reaction={reaction} yaw={yaw} focus tool={tool} cleaned={cleaned} onCatch={onCatch} />
  const { cols, rows } = layout(pets.length, width)
  return (
    <>
      {pets.map((pet, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        // La última fila queda centrada aunque tenga menos mascotas.
        const inRow = row === rows - 1 ? pets.length - row * cols : cols
        const x = (col - (inRow - 1) / 2) * SLOT_W
        return <Slot key={pet.id} pet={pet} position={[x, 0, -row * SLOT_D]} reaction={reaction} onPick={() => onPick(pet.id)} />
      })}
    </>
  )
}

// ——— Herramientas: granos, esponja y gusanito ———

/** Captura el puntero para seguir recibiendo el arrastre (si el navegador lo permite). */
function capture(e: PointerEvent<HTMLDivElement>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    /* puntero que ya no existe: se sigue sin capturar */
  }
}

/** Lo que tiene en la mano quien la cuida. */
export type Tool = 'feed' | 'clean' | 'play'

/** Dónde pueden caer los granos o andar el gusanito (alrededor de la mascota en primer plano). */
const AREA = { x: 0.78, zMin: -0.25, zMax: 0.62 }

/** Deja la cámara a mano de los manejadores del DOM. */
function CameraGrab({ cam }: { cam: { current: THREE.Camera | null } }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    cam.current = camera
  }, [cam, camera])
  return null
}

let wormTex: THREE.CanvasTexture | null = null
/** Gusanito de peluche (dibujado a mano, con trazo de tinta como todo lo demás). */
function wormTexture() {
  if (wormTex) return wormTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.lineWidth = 6
  g.strokeStyle = '#3a2416'
  const segs: [number, number, number, string][] = [
    [24, 78, 15, '#8fd14f'],
    [44, 70, 17, '#ffb3c7'],
    [66, 66, 18, '#8fd14f'],
    [92, 56, 24, '#8fd14f'],
  ]
  for (const [x, y, r, fill] of segs) {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fillStyle = fill
    g.fill()
    g.stroke()
  }
  // Cara: ojos grandes con brillo, cachete y sonrisa.
  for (const ex of [86, 100]) {
    g.beginPath()
    g.ellipse(ex, 50, 4.5, 6.5, 0, 0, Math.PI * 2)
    g.fillStyle = '#3a2416'
    g.fill()
    g.beginPath()
    g.arc(ex + 1.5, 47.5, 1.8, 0, Math.PI * 2)
    g.fillStyle = '#fff'
    g.fill()
  }
  g.fillStyle = 'rgba(255,120,150,0.7)'
  g.beginPath()
  g.ellipse(106, 62, 5, 3, 0, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 3.5
  g.beginPath()
  g.arc(94, 61, 5, 0.2, Math.PI - 0.2)
  g.stroke()
  // Antenitas.
  g.lineWidth = 4
  for (const [x0, x1] of [
    [86, 80],
    [98, 104],
  ]) {
    g.beginPath()
    g.moveTo(x0, 36)
    g.quadraticCurveTo(x0, 22, x1, 18)
    g.stroke()
    g.beginPath()
    g.arc(x1, 18, 4, 0, Math.PI * 2)
    g.fillStyle = '#ffd23f'
    g.fill()
    g.stroke()
  }
  wormTex = new THREE.CanvasTexture(c)
  wormTex.colorSpace = THREE.SRGBColorSpace
  return wormTex
}

/**
 * Gusanito colgando de un hilo: va donde se le indique (con un poco de retraso, como si colgara),
 * se menea al moverlo y da un tirón para arriba cuando la mascota lo atrapa.
 */
function Lure({ target, yank }: { target: { current: THREE.Vector3 }; yank: { current: number } }) {
  const sprite = useRef<THREE.Sprite>(null)
  const pos = useRef(target.current.clone())
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#3a2416' }))
    l.frustumCulled = false
    l.raycast = () => {}
    return l
  }, [])
  useEffect(() => () => (line.geometry.dispose(), (line.material as THREE.Material).dispose()), [line])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (yank.current === -1) yank.current = t
    const before = pos.current.clone()
    pos.current.lerp(target.current, 1 - Math.exp(-Math.min(dt, 0.1) * 9))
    const speed = before.distanceTo(pos.current) / Math.max(dt, 1e-3)
    const since = t - yank.current
    const lift = since >= 0 && since < 0.9 ? Math.sin((Math.PI * since) / 0.9) * 0.45 : 0
    const y = 0.11 + Math.abs(Math.sin(t * 5)) * 0.03 + lift
    const s = sprite.current
    if (s) {
      s.position.set(pos.current.x, y, pos.current.z)
      s.material.rotation = Math.sin(t * 9) * Math.min(0.5, 0.08 + speed * 0.25)
      const squish = since >= 0 && since < 0.25 ? 0.75 : 1
      s.scale.set(0.24 / squish, 0.24 * squish, 1)
    }
    const a = line.geometry.attributes.position as THREE.BufferAttribute
    a.setXYZ(0, pos.current.x + 0.03, y + 0.06, pos.current.z)
    a.setXYZ(1, pos.current.x + Math.sin(t * 1.3) * 0.05, 4, pos.current.z)
    a.needsUpdate = true
  })
  return (
    <>
      <primitive object={line} />
      <sprite ref={sprite} renderOrder={6} raycast={() => {}}>
        <spriteMaterial map={wormTexture()} transparent depthWrite={false} />
      </sprite>
    </>
  )
}

let laserTex: THREE.CanvasTexture | null = null
function laserTexture() {
  if (laserTex) return laserTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.12, 'rgba(255,90,100,1)')
  r.addColorStop(0.3, 'rgba(255,30,60,0.55)')
  r.addColorStop(1, 'rgba(255,0,40,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  laserTex = new THREE.CanvasTexture(c)
  laserTex.colorSpace = THREE.SRGBColorSpace
  return laserTex
}

/**
 * Puntero láser (el juguete del gato): un punto rojo que brilla en el piso, va rápido adonde se
 * le indique con el temblorcito de una mano y, cuando el gato lo aplasta, se apaga y aparece al lado.
 */
function Laser({ target, yank }: { target: { current: THREE.Vector3 }; yank: { current: number } }) {
  const dot = useRef<THREE.Mesh>(null)
  const pos = useRef(target.current.clone())
  const jump = useRef(new THREE.Vector3())
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (yank.current === -1) {
      yank.current = t
      const a = Math.random() * Math.PI * 2
      jump.current.set(Math.cos(a) * 0.18, 0, Math.sin(a) * 0.12)
    }
    pos.current.lerp(target.current, 1 - Math.exp(-Math.min(dt, 0.1) * 22))
    const since = t - yank.current
    const off = since >= 0 && since < 0.6 ? 1 - since / 0.6 : 0
    const d = dot.current
    if (!d) return
    d.visible = !(since >= 0 && since < 0.22)
    d.position.set(pos.current.x + jump.current.x * off + 0.006 * Math.sin(t * 31), 0.03, pos.current.z + jump.current.z * off + 0.006 * Math.cos(t * 27))
    d.scale.setScalar(0.16 * (1 + 0.12 * Math.sin(t * 18)))
  })
  return (
    <mesh ref={dot} rotation-x={-Math.PI / 2} renderOrder={6} raycast={() => {}}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={laserTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}

let moleTex: THREE.CanvasTexture | null = null
/** Topo asomado de su montoncito de tierra (anclado abajo: crece hacia arriba al asomarse). */
function moleTexture() {
  if (moleTex) return moleTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.lineWidth = 5
  g.strokeStyle = '#3a2416'
  g.lineJoin = 'round'
  // Cuerpo y cabeza.
  g.beginPath()
  g.moveTo(30, 104)
  g.bezierCurveTo(26, 40, 102, 40, 98, 104)
  g.closePath()
  g.fillStyle = '#8a5a3c'
  g.fill()
  g.stroke()
  // Panza clara.
  g.beginPath()
  g.ellipse(64, 92, 20, 16, 0, Math.PI, 0)
  g.fillStyle = '#c9946a'
  g.fill()
  // Ojitos cerrados de gusto y nariz rosada.
  g.lineWidth = 4
  for (const ex of [50, 78]) {
    g.beginPath()
    g.arc(ex, 62, 5, Math.PI * 1.1, Math.PI * 1.9)
    g.stroke()
  }
  g.beginPath()
  g.ellipse(64, 72, 9, 7, 0, 0, Math.PI * 2)
  g.fillStyle = '#ff8fb1'
  g.fill()
  g.stroke()
  // Bigotes.
  g.lineWidth = 2.5
  for (const s of [-1, 1]) {
    for (const dy of [-3, 3]) {
      g.beginPath()
      g.moveTo(64 + s * 12, 74 + dy)
      g.lineTo(64 + s * 30, 70 + dy * 2)
      g.stroke()
    }
  }
  // Manitos rosadas sobre la tierra.
  g.lineWidth = 4
  for (const hx of [44, 84]) {
    g.beginPath()
    g.ellipse(hx, 100, 10, 7, 0, 0, Math.PI * 2)
    g.fillStyle = '#ffb3c7'
    g.fill()
    g.stroke()
  }
  // Montoncito de tierra.
  g.beginPath()
  g.moveTo(8, 124)
  g.quadraticCurveTo(22, 98, 46, 106)
  g.quadraticCurveTo(64, 96, 82, 106)
  g.quadraticCurveTo(106, 98, 120, 124)
  g.closePath()
  g.fillStyle = '#6b4226'
  g.fill()
  g.lineWidth = 5
  g.stroke()
  g.fillStyle = '#4a2c18'
  for (const [x, y] of [[30, 116], [58, 112], [90, 115], [74, 120]]) {
    g.beginPath()
    g.arc(x, y, 3, 0, Math.PI * 2)
    g.fill()
  }
  moleTex = new THREE.CanvasTexture(c)
  moleTex.colorSpace = THREE.SRGBColorSpace
  return moleTex
}

/** Un topo puesto en el pasto: dónde, cuándo asomó y (si lo atraparon) cuándo se escondió. */
export type Topo = { id: number; x: number; z: number; t0: number; fuera: number }

/** Los topos: asoman con un saltito, se mecen esperando y se esconden al atraparlos. */
function Topos({ lista }: { lista: { current: Topo[] } }) {
  const group = useRef<THREE.Group>(null)
  const sprites = useRef(new Map<number, THREE.Sprite>())
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: moleTexture(), transparent: true, depthWrite: false }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const g = group.current
    if (!g) return
    const vivos = new Set<number>()
    for (const m of lista.current) {
      if (m.t0 < 0) m.t0 = t
      if (m.fuera === -1) m.fuera = t
      vivos.add(m.id)
      let s = sprites.current.get(m.id)
      if (!s) {
        s = new THREE.Sprite(mat)
        s.center.set(0.5, 0.05)
        s.renderOrder = 6
        s.raycast = () => {}
        sprites.current.set(m.id, s)
        g.add(s)
      }
      const u = t - m.t0
      // Asoma rápido con un rebote y después respira; al atraparlo se hunde.
      let k = u < 0.25 ? u / 0.25 : 1 + 0.12 * Math.sin(Math.min(1, (u - 0.25) / 0.2) * Math.PI) * Math.max(0, 1 - (u - 0.25) / 0.4)
      if (m.fuera > 0) k *= Math.max(0, 1 - (t - m.fuera) / 0.35)
      const bob = m.fuera > 0 ? 0 : 0.04 * Math.sin(t * 4 + m.id)
      s.position.set(m.x, 0.01, m.z)
      s.scale.set(0.3 * (1 + bob * 0.5), 0.3 * Math.max(0.001, k) * (1 + bob), 1)
      s.visible = k > 0.01
    }
    for (const [id, s] of sprites.current) {
      if (vivos.has(id)) continue
      g.remove(s)
      sprites.current.delete(id)
    }
  })
  return <group ref={group} />
}

let ballTex: THREE.CanvasTexture | null = null
/** Pelota de playa de gajos, con su trazo de tinta. */
function ballTexture() {
  if (ballTex) return ballTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const colores = ['#ff6b6b', '#fff', '#4fb3ec', '#fff', '#ffd23f', '#fff']
  for (let i = 0; i < 6; i++) {
    g.beginPath()
    g.moveTo(64, 64)
    g.arc(64, 64, 54, (i * Math.PI) / 3 - Math.PI / 2, ((i + 1) * Math.PI) / 3 - Math.PI / 2)
    g.closePath()
    g.fillStyle = colores[i]
    g.fill()
  }
  g.beginPath()
  g.arc(64, 64, 12, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
  g.lineWidth = 6
  g.strokeStyle = '#3a2416'
  g.beginPath()
  g.arc(64, 64, 54, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.75)'
  g.beginPath()
  g.ellipse(46, 40, 12, 7, -0.6, 0, Math.PI * 2)
  g.fill()
  ballTex = new THREE.CanvasTexture(c)
  ballTex.colorSpace = THREE.SRGBColorSpace
  return ballTex
}

/** Un lanzamiento: desde dónde, hasta dónde, cuándo salió y si ya la tomó la mascota. */
export type Tiro = { from: THREE.Vector3; to: THREE.Vector3; t0: number; tomada: number }
const VUELO = 0.55

/** La pelota: vuela en arco hasta donde se tocó, da unos botes y desaparece cuando la atrapan. */
function Pelota({ tiro }: { tiro: { current: Tiro | null } }) {
  const sprite = useRef<THREE.Sprite>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const s = sprite.current
    const b = tiro.current
    if (!s) return
    if (!b) return void (s.visible = false)
    if (b.t0 < 0) b.t0 = t
    if (b.tomada === -1) b.tomada = t
    const u = t - b.t0
    const r = 0.075
    let x: number, y: number, z: number
    if (u < VUELO) {
      const f = u / VUELO
      x = THREE.MathUtils.lerp(b.from.x, b.to.x, f)
      z = THREE.MathUtils.lerp(b.from.z, b.to.z, f)
      y = THREE.MathUtils.lerp(b.from.y, r, f) + Math.sin(f * Math.PI) * 0.7
    } else {
      // Botes que se apagan.
      const v = u - VUELO
      x = b.to.x
      z = b.to.z
      y = r + Math.abs(Math.sin(v * 9)) * 0.12 * Math.exp(-v * 3.2)
    }
    const fuera = b.tomada > 0 ? Math.max(0, 1 - (t - b.tomada) / 0.25) : 1
    s.visible = fuera > 0.01
    s.position.set(x, y, z)
    s.scale.setScalar(r * 2 * fuera)
    s.material.rotation = -u * 6
  })
  return (
    <sprite ref={sprite} renderOrder={6} raycast={() => {}} visible={false}>
      <spriteMaterial map={ballTexture()} transparent depthWrite={false} />
    </sprite>
  )
}

/** Cuántos topos puede haber esperando a la vez. */
const MAX_TOPOS = 3
/** Distancia mínima entre un juguete nuevo y la última atrapada (si no, no salta). */
const LEJOS = 0.36

export function Scene(props: {
  pets: Pet[]
  selected: Pet | null
  reaction: Reaction | null
  onPick: (id: string) => void
  tool?: Tool | null
  /** Avance del baño con esponja (0–1). */
  cleaned?: number
  /** Lanzar un puñado: devuelve si se lo va a comer (o null si no se puede lanzar ahora). */
  onThrow?: () => boolean | null
  /** La frotaron con la esponja (distancia recorrida sobre ella, en unidades de la escena). */
  onScrub?: (d: number) => void
  onCatch?: () => void
  /** El juego de «Jugar» que salió (ver game/juegos.ts). */
  juego?: JuegoId
  /** Acomodando los muebles: se pueden tocar y arrastrar. */
  decorating?: boolean
  decorSel?: string | null
  onDecorSel?: (id: string | null) => void
  /** Se guardó un mueble en el inventario desde el menú flotante. */
  onDecorStored?: (id: string) => void
}) {
  const { tool = null, selected } = props
  const decorating = !!props.decorating && !!selected && !tool
  // Girar la mascota seleccionada arrastrando (la cámara y la luz quedan fijas, así el toon se ve igual).
  const bg = getBackground(useGame((s) => s.background))
  const lightsOn = useLuz(selected?.id)
  const [yaw, setYaw] = useState(0)
  const drag = useRef<{ x: number; yaw: number; moved: boolean } | null>(null)
  const id = selected?.id
  useEffect(() => setYaw(0), [id, tool])
  // Primer plano: la mascota y sus muebles (con la Casa abierta, todo el piso disponible).
  const decorItems = selected?.decor
  const view = useMemo(() => viewFor(decorItems ?? [], decorating), [decorItems, decorating])

  const wrap = useRef<HTMLDivElement>(null)
  const cam = useRef<THREE.Camera | null>(null)
  const ray = useRef(new THREE.Raycaster())
  const cursor = useRef<HTMLDivElement>(null)
  const sack = useRef<HTMLDivElement>(null)
  const rub = useRef<{ on: boolean; last: THREE.Vector3 | null }>({ on: false, last: null })
  const feedBusy = useRef(0)
  const lure = useRef(new THREE.Vector3(0.45, 0, 0.4))
  const decor = useRef<DecorRegistry>(new Map())
  const carry = useRef<{ id: string; off: THREE.Vector3; moved: boolean } | null>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuFor = decorating ? (props.decorSel ?? null) : null
  const yank = useRef(-9)
  const juego: JuegoId = props.juego ?? (selected?.species === 'cat' ? 'laser' : 'gusano')
  const tocando = JUEGO[juego].tocando
  const topos = useRef<Topo[]>([])
  const tiro = useRef<Tiro | null>(null)
  const ultima = useRef<{ x: number; z: number } | null>(null)
  const topoId = useRef(0)
  const aterriza = useRef(0)

  // El juguete: el gusanito y el láser aparecen a un lado para que los vea; los topos y la pelota
  // esperan a que se toque el pasto. Al guardarlo, lo deja de perseguir.
  useEffect(() => {
    if (tool !== 'play' || !id) return
    topos.current = []
    tiro.current = null
    ultima.current = null
    if (!tocando) {
      lure.current.set(0.5, 0, 0.42)
      setLure(id, lure.current)
    } else setLure(id, null)
    return () => {
      window.clearTimeout(aterriza.current)
      setLure(id, null)
    }
  }, [tool, id, tocando])

  /** Persigue el primer topo que sigue asomado (o nada). */
  const siguienteTopo = () => {
    if (!id) return
    const m = topos.current.find((x) => x.fuera === 0)
    if (m) {
      lure.current.set(m.x, 0, m.z)
      setLure(id, lure.current)
    } else setLure(id, null)
  }

  /** Pone un topo o lanza la pelota donde se tocó. */
  const ponJuguete = (x: number, y: number) => {
    if (!id) return
    const f = floorAt(x, y)
    const lejos = [ultima.current, ...(juego === 'topos' ? topos.current.filter((m) => m.fuera === 0) : [])].filter(Boolean) as { x: number; z: number }[]
    let p = { x: f.x, z: f.z }
    for (let i = 0; i < 2; i++) for (const q of lejos) p = lejosDe(p.x, p.z, q, LEJOS, AREA)
    if (juego === 'topos') {
      if (topos.current.filter((m) => m.fuera === 0).length >= MAX_TOPOS) return play('error')
      topos.current = [...topos.current, { id: ++topoId.current, x: p.x, z: p.z, t0: -1, fuera: 0 }]
      play('pop')
      if (topos.current.filter((m) => m.fuera === 0).length === 1) siguienteTopo()
      return
    }
    // La pelota sale desde abajo, del lado de quien la lanza, y la persigue cuando cae.
    const to = new THREE.Vector3(p.x, 0, p.z)
    const from = aim(x, wrap.current!.getBoundingClientRect().height - 10).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), new THREE.Vector3()) ?? new THREE.Vector3(0, 0.5, 1.2)
    tiro.current = { from, to, t0: -1, tomada: 0 }
    play('toss')
    setLure(id, null)
    window.clearTimeout(aterriza.current)
    aterriza.current = window.setTimeout(() => {
      lure.current.copy(to)
      setLure(id, lure.current)
    }, VUELO * 900)
  }

  /** Rayo desde la cámara por un punto de la pantalla (px relativos al cuadro). */
  const aim = (x: number, y: number) => {
    const r = wrap.current!.getBoundingClientRect()
    ray.current.setFromCamera(new THREE.Vector2((x / r.width) * 2 - 1, 1 - (y / r.height) * 2), cam.current!)
    return ray.current.ray
  }
  /** Punto del suelo bajo el puntero, dentro del área de juego. */
  const floorAt = (x: number, y: number) => {
    const p = aim(x, y).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3())
    // Apuntando por encima del horizonte: lo más al fondo posible.
    if (!p) return new THREE.Vector3(0, 0, AREA.zMin)
    p.x = THREE.MathUtils.clamp(p.x, -AREA.x, AREA.x)
    p.z = THREE.MathUtils.clamp(p.z, AREA.zMin, AREA.zMax)
    return p
  }
  /**
   * Objeto de decoración bajo el puntero (o null). Con el dedo cuesta acertarle a lo chico: si no
   * toca ninguno, vale el más cercano en pantalla (hasta `near` px de su centro).
   */
  const decorAt = (x: number, y: number, near = 0) => {
    aim(x, y)
    const hit = ray.current.intersectObjects([...decor.current.values()], true).find((i) => (i.object as THREE.Mesh).isMesh)
    let o: THREE.Object3D | null = hit?.object ?? null
    while (o && !o.userData.decorId) o = o.parent
    if (o || !near) return o as THREE.Group | null
    const r = wrap.current!.getBoundingClientRect()
    let best: THREE.Group | null = null
    let bestD = near
    for (const g of decor.current.values()) {
      if (g.userData.flat) continue
      const p = new THREE.Vector3(g.position.x, 0.15, g.position.z).project(cam.current!)
      const d = Math.hypot(((p.x + 1) / 2) * r.width - x, ((1 - p.y) / 2) * r.height - y)
      if (d < bestD) (bestD = d), (best = g)
    }
    return best
  }
  const groundAt = (x: number, y: number) => aim(x, y).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3())
  const local = (e: PointerEvent<HTMLDivElement>) => {
    const r = wrap.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  const throwFood = (x: number, y: number) => {
    const h = id ? getPet(id) : undefined
    if (!h || !wrap.current) return
    const bag = sack.current
    if (performance.now() < feedBusy.current) {
      // Todavía está comiendo: el saco se sacude ("espera").
      bag?.classList.remove('nope')
      void bag?.offsetWidth
      bag?.classList.add('nope')
      return
    }
    const eat = props.onThrow?.()
    if (eat == null) return
    const to = floorAt(x, y)
    // Los granos salen de la boca del saco, justo sobre el suelo.
    const r = wrap.current.getBoundingClientRect()
    const mouth = bag ? bag.getBoundingClientRect() : null
    const mx = mouth ? mouth.left + mouth.width / 2 - r.left : r.width / 2
    const my = mouth ? mouth.top + mouth.height * 0.2 - r.top : r.height - 60
    const from = aim(mx, my).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14), new THREE.Vector3()) ?? new THREE.Vector3(0, 0.2, 1.5)
    play('toss')
    const busy = h.throwFood(from, to, eat)
    window.setTimeout(() => play('patter'), 560)
    feedBusy.current = performance.now() + (eat ? busy : 0.6) * 1000
    bag?.classList.remove('toss')
    void bag?.offsetWidth
    bag?.classList.add('toss')
  }

  const scrubAt = (x: number, y: number) => {
    const h = id ? getPet(id) : undefined
    if (!h) return
    aim(x, y)
    const hit = ray.current.intersectObject(h.object, true).find((i) => (i.object as THREE.Mesh).isMesh && i.object.visible)
    const r = rub.current
    cursor.current?.classList.toggle('rubbing', !!hit)
    if (!hit) {
      r.last = null
      return
    }
    if (r.last) props.onScrub?.(Math.min(0.25, r.last.distanceTo(hit.point)))
    r.last = hit.point.clone()
    h.scrub(hit.point)
  }

  const moveCursor = (x: number, y: number) => {
    const c = cursor.current
    if (c) c.style.transform = `translate(${x}px, ${y}px)`
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (tool) {
      const [x, y] = local(e)
      moveCursor(x, y)
      if (tool === 'feed') throwFood(x, y)
      else if (tool === 'clean') {
        rub.current = { on: true, last: null }
        capture(e)
        scrubAt(x, y)
      } else if (tool === 'play' && id) {
        if (tocando) return ponJuguete(x, y)
        lure.current.copy(floorAt(x, y))
        setLure(id, lure.current)
        capture(e)
      }
      return
    }
    if (!selected) return
    if (decorating) {
      const [x, y] = local(e)
      const g = decorAt(x, y, e.pointerType === 'mouse' ? 0 : 36)
      if (g) {
        const p = groundAt(x, y) ?? g.position.clone()
        carry.current = { id: g.userData.decorId, off: g.position.clone().sub(p).setY(0), moved: false }
        props.onDecorSel?.(g.userData.decorId)
        play('tap')
        capture(e)
        return
      }
      props.onDecorSel?.(null)
    }
    drag.current = { x: e.clientX, yaw, moved: false }
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (tool) {
      const [x, y] = local(e)
      moveCursor(x, y)
      // Con mouse el gusanito sigue al puntero aunque no se apriete; con el dedo, mientras lo arrastra.
      if (tool === 'play' && id && !tocando && (e.pointerType === 'mouse' || e.buttons)) {
        lure.current.copy(floorAt(x, y))
        setLure(id, lure.current)
      }
      if (tool === 'clean' && (rub.current.on || (e.pointerType === 'mouse' && e.buttons & 1))) scrubAt(x, y)
      return
    }
    const c = carry.current
    if (c) {
      const g = decor.current.get(c.id)
      const p = groundAt(...local(e))
      if (!g || !p) return
      p.add(c.off)
      const at = clampSpot(c.id, p.x, p.z)
      if (!c.moved && Math.hypot(at.x - g.position.x, at.z - g.position.z) < 0.01) return
      c.moved = true
      g.userData.dragging = true
      g.position.set(at.x, 0, at.z)
      return
    }
    if (decorating && e.pointerType === 'mouse' && !e.buttons) {
      wrap.current!.style.cursor = decorAt(...local(e)) ? 'grab' : ''
    }
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    // Se captura el puntero recién al arrastrar: un toque simple tiene que llegar a la mascota.
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true
      capture(e)
    }
    if (d.moved) setYaw(d.yaw + dx * 0.012)
  }
  const onUp = () => {
    const c = carry.current
    carry.current = null
    if (c && selected) {
      const g = decor.current.get(c.id)
      if (g && c.moved) {
        g.userData.dragging = false
        useGame.getState().moveDecor(selected.id, c.id, g.position.x, g.position.z)
        play('pop')
      }
    }
    drag.current = null
    rub.current = { on: false, last: null }
    cursor.current?.classList.remove('rubbing')
  }

  const onCatch = () => {
    play(juego === 'laser' ? 'pop' : juego === 'pelota' ? 'boing' : 'squeak')
    yank.current = -1
    ultima.current = { x: lure.current.x, z: lure.current.z }
    if (juego === 'topos') {
      // El topo atrapado se esconde y la mascota va por el siguiente.
      const m = topos.current.find((x) => x.fuera === 0)
      if (m) {
        m.fuera = -1
        ultima.current = { x: m.x, z: m.z }
        window.setTimeout(() => (topos.current = topos.current.filter((x) => x !== m)), 700)
      }
      siguienteTopo()
    } else if (juego === 'pelota') {
      if (tiro.current) tiro.current.tomada = -1
      if (id) setLure(id, null)
    }
    props.onCatch?.()
  }

  return (
    <div
      ref={wrap}
      className={`scene${selected && !tool ? ' rotatable' : ''}${tool ? ` tool tool-${tool}` : ''}${tool === 'play' ? ` juego-${juego}` : ''}${decorating ? ' decorating' : ''}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => cursor.current?.classList.remove('rubbing')}
      onDoubleClick={() => !tool && setYaw(0)}
    >
      <Canvas flat frameloop="demand">
        <Pacer full={!!tool || decorating} />
        <OrthographicCamera makeDefault position={[0, 2.6, 7]} near={0.1} far={50} />
        <CameraGrab cam={cam} />
        <CameraRig count={selected ? 1 : props.pets.length} focus={!!selected} view={view} />
        <Lighting sky={bg.sky} ground={bg.ground} on={lightsOn} />
        <Slots pets={props.pets} selected={selected} reaction={props.reaction} onPick={props.onPick} yaw={yaw} tool={tool} cleaned={props.cleaned ?? 0} onCatch={onCatch} />
        {tool === 'play' && juego === 'laser' && <Laser target={lure} yank={yank} />}
        {tool === 'play' && juego === 'gusano' && <Lure target={lure} yank={yank} />}
        {tool === 'play' && juego === 'topos' && <Topos lista={topos} />}
        {tool === 'play' && juego === 'pelota' && <Pelota tiro={tiro} />}
        {selected && <DecorLayer items={selected.decor ?? []} selected={decorating ? (props.decorSel ?? null) : null} registry={decor.current} />}
        {menuFor && <FollowMenu el={menu} registry={decor.current} id={menuFor} />}
      </Canvas>
      {menuFor && selected && (
        <div ref={menu} className="decor-menu" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <button
            aria-label="Girar"
            onClick={() => {
              useGame.getState().rotateDecor(selected.id, menuFor)
              play('tap')
            }}
          >
            ↻<small>Girar</small>
          </button>
          <button
            aria-label="Guardar en el inventario"
            onClick={() => {
              useGame.getState().removeDecor(selected.id, menuFor)
              props.onDecorSel?.(null)
              props.onDecorStored?.(menuFor)
              play('pop')
            }}
          >
            📦<small>Guardar</small>
          </button>
        </div>
      )}
      {selected && !tool && <span className="rotate-hint">{decorating ? '✋ Arrastra los muebles' : '↔ Arrastra para girar'}</span>}
      {tool === 'feed' && (
        <div ref={sack} className="seed-sack" aria-hidden>
          <SackIcon />
        </div>
      )}
      {tool === 'clean' && (
        <div ref={cursor} className="sponge-cursor" aria-hidden>
          <SpongeIcon />
        </div>
      )}
    </div>
  )
}

/** Lleva el menú del mueble elegido justo encima de él (en pantalla), cuadro a cuadro. */
function FollowMenu({ el, registry, id }: { el: { current: HTMLDivElement | null }; registry: DecorRegistry; id: string }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const p = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const g = registry.get(id)
    const d = el.current
    if (!d) return
    if (!g) return void (d.style.visibility = 'hidden')
    const body = g.children[0]
    p.set(0, (g.userData.top ?? 0.3) + (body?.position.y ?? 0) + 0.3, 0)
    g.localToWorld(p).project(camera)
    const w = d.offsetWidth
    const x = Math.min(size.width - w / 2 - 6, Math.max(w / 2 + 6, ((p.x + 1) / 2) * size.width))
    const y = Math.max(d.offsetHeight + 6, ((1 - p.y) / 2) * size.height)
    d.style.transform = `translate(${x - w / 2}px, ${y - d.offsetHeight}px)`
    d.style.visibility = g.userData.dragging ? 'hidden' : 'visible'
  })
  return null
}

/** Saco de granos (de donde salen los puñados). */
function SackIcon() {
  return (
    <svg viewBox="0 0 96 96" width="84" height="84">
      <g stroke="#3a2416" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M22 40 Q14 70 22 84 Q48 94 74 84 Q82 70 74 40 Z" fill="#d9a066" />
        <path d="M30 52 Q48 58 66 52" fill="none" opacity=".45" />
        <ellipse cx="48" cy="38" rx="28" ry="10" fill="#b97a43" />
        <ellipse cx="48" cy="36" rx="22" ry="6.5" fill="#f2c14e" />
        <g fill="#f7d774" strokeWidth="3">
          <ellipse cx="40" cy="30" rx="5" ry="3.6" transform="rotate(-25 40 30)" />
          <ellipse cx="52" cy="27" rx="5" ry="3.6" transform="rotate(20 52 27)" />
          <ellipse cx="60" cy="33" rx="5" ry="3.6" transform="rotate(-10 60 33)" />
        </g>
        <path d="M36 66 l6 6 M54 64 l-4 8" fill="none" opacity=".4" />
      </g>
    </svg>
  )
}

/** Esponja con su capa verde para fregar y algo de espuma. */
function SpongeIcon() {
  return (
    <svg viewBox="0 0 96 96" width="72" height="72">
      <g stroke="#3a2416" strokeWidth="4" strokeLinejoin="round">
        <rect x="14" y="30" width="68" height="40" rx="12" fill="#ffd54a" />
        <path d="M14 56 h68 v2 q0 12 -12 12 h-44 q-12 0 -12 -12 Z" fill="#5fb36b" />
        <g fill="#e8b92c" stroke="none">
          <circle cx="30" cy="42" r="3.5" />
          <circle cx="46" cy="38" r="2.5" />
          <circle cx="62" cy="44" r="3.5" />
          <circle cx="40" cy="49" r="2.5" />
          <circle cx="70" cy="37" r="2.5" />
        </g>
        <g fill="#fff" strokeWidth="3">
          <circle cx="24" cy="28" r="7" />
          <circle cx="34" cy="24" r="5" />
          <circle cx="74" cy="30" r="6" />
        </g>
      </g>
    </svg>
  )
}
