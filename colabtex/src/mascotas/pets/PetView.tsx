import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { StageDef } from '../data/species/types'
import type { SlotId } from '../game/types'
import { play } from '../audio/sound'
import { useGame } from '../store/gameStore'
import type { Expression } from './rig/face'
import { buildRig, type Genes } from './rig'
import { Animator } from './anim/controller'
import type { CueId } from './anim/cues'
import { hash } from './anim/util'
import type { V3 } from './anim/clip'
import { getLure, registerPet } from './handle'
import { dress, shoeLift, type Worn } from './wear'

const DIRT_COLOR = new THREE.Color('#6b4a2b')
const GLOW_COLOR = new THREE.Color('#ffb347')
/** Tamaño de la sombra en el piso según el modelo. */
const SHADOW = { egg: 0.62, chick: 0.82, hen: 0.9, box: 0.72, cat: 0.82 }
/** Gravedad de los granos lanzados (espacio de la mascota). */
const TOSS_G = -5.5
const noRaycast = () => {}

/** Orden de reacción: cambia `key` para repetir la misma. `t0` fija el instante (estudio). */
export interface PetCue {
  id: CueId
  key: number
  dance?: string
  t0?: number
}

/**
 * Mascota 3D con look 2D: arma el modelo de la etapa, la viste y la anima (reposo, ánimo,
 * reacciones y bailes) con el reloj del juego, cuadro a cuadro según los fps elegidos.
 */
export function PetView(props: {
  stage: StageDef
  /** Cara según el ánimo (las reacciones ponen la suya encima). */
  expression: Expression
  sleeping?: boolean
  sad?: boolean
  dirt?: number
  cue?: PetCue | null
  hat?: string
  boots?: string
  outfit?: string
  shoes?: string
  /** Reloj fijo (s) para el estudio; si falta, tiempo real. */
  time?: number
  growth?: number
  /** Si suena (solo la mascota seleccionada). */
  voice?: boolean
  /** Si pasea por su lugar (no en la vista de foco del estudio). */
  roam?: boolean
  /** Semilla de sus manías (cada mascota se mueve distinto). */
  seed?: string
  /** Id para que la escena la maneje directo (granos, esponja, juguete). */
  petId?: string
  /** Atenta a quien la cuida: no se pone a pasear. */
  busy?: boolean
  /** Atrapó el juguete. */
  onCatch?: () => void
  /** Genética del color: plumaje o pelaje (sin ella, colores clásicos). */
  look?: Genes
  /** Colores de cada accesorio puesto (semillas del inventario). */
  tints?: Partial<Record<SlotId, number>>
}) {
  const { stage, expression, sleeping = false, sad = false, dirt = 0, cue, time, growth = 0, voice = false, roam = true } = props
  // Los genes son un objeto nuevo en cada guardado: se comparan por valor.
  const lookKey = props.look ? JSON.stringify(props.look) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rig = useMemo(() => buildRig(stage.model, props.look), [stage.model, lookKey])
  const seed = useMemo(() => {
    let h = 7
    for (const ch of props.seed ?? 'pet') h = (h * 31 + ch.charCodeAt(0)) | 0
    return hash(h)
  }, [props.seed])
  const anim = useMemo(() => new Animator(rig, seed, stage.scale), [rig, seed, stage.scale])
  useEffect(() => () => anim.dispose(), [anim])

  const shadow = useRef<THREE.Mesh>(null)
  const space = useRef<THREE.Group>(null)
  const onCatch = useRef(props.onCatch)
  onCatch.current = props.onCatch
  // Lo que la escena le hace cuadro a cuadro (sin pasar por React).
  const live = useRef({ scrubAt: -1, scrubW: 0, lastFoam: 0, lastSound: 0, caught: 0 })

  const { petId } = props
  useEffect(() => {
    if (!petId) return
    const toLocal = (w: THREE.Vector3) => space.current!.worldToLocal(w.clone())
    return registerPet(petId, {
      get object() {
        return rig.root
      },
      throwFood(fromW, toW, eat) {
        if (!space.current) return 0
        const from = toLocal(fromW)
        const to = toLocal(toW)
        to.y = 0
        let land = 0
        const size = 0.095 * (0.5 + 0.5 / stage.scale)
        for (let i = 0; i < 7; i++) {
          // Cada grano cae un poco separado y en su tiempo, como un puñado de verdad.
          const a = Math.random() * Math.PI * 2
          const r = 0.02 + Math.random() * 0.08
          const end = new THREE.Vector3(to.x + Math.cos(a) * r, size * 0.3, to.z + Math.sin(a) * r * 0.7)
          const T = 0.5 + Math.random() * 0.18
          const delay = i * 0.025
          const start = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.04, 0))
          const vel: V3 = [(end.x - start.x) / T, (end.y - start.y) / T - 0.5 * TOSS_G * T, (end.z - start.z) / T]
          anim.fx.emit('grain', start, { vel, gravity: TOSS_G, ground: true, life: T + (eat ? 9 : 4), size, spin: (Math.random() - 0.5) * 14, delay })
          land = Math.max(land, T + delay)
        }
        if (!eat) return land
        const t0 = anim.now + land
        const arrive = anim.goTo(to.x, to.z, t0, { reach: rig.peckTarget[2], pace: 1.9, then: 'eat' })
        return arrive - anim.now + 3.6
      },
      scrub(atW) {
        const l = live.current
        const now = performance.now()
        l.scrubAt = now
        if (!space.current || now - l.lastFoam < 45) return
        l.lastFoam = now
        const p = toLocal(atW)
        const k = 0.5 + 0.5 / stage.scale
        // Espuma pegada donde pasa la esponja (un poco hacia la cámara, para que no la tape el cuerpo).
        p.z += 0.04
        anim.fx.emit('puff', p, { vel: [(Math.random() - 0.5) * 0.12, 0.04, 0.04], life: 0.8 + Math.random() * 0.5, size: (0.13 + Math.random() * 0.09) * k, drag: 2.5 })
        if (Math.random() < 0.5)
          anim.fx.emit('bubble', p, { vel: [(Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.25, 0.12], life: 1 + Math.random() * 0.7, size: (0.06 + Math.random() * 0.07) * k, sway: 0.04 })
        if (now - l.lastSound > 170) {
          l.lastSound = now
          play('scrub')
        }
      },
    })
  }, [petId, rig, anim, stage.scale])
  const start = useRef<number | null>(null)
  const lastKey = useRef<number | null>(null)

  // Ropa y accesorios (se arman en un efecto para que montar/desmontar quede siempre parejo).
  const { hat, boots, outfit, shoes } = props
  const tintKey = JSON.stringify(props.tints ?? {})
  const worn = useRef<Worn | null>(null)
  useLayoutEffect(() => {
    const w = dress(rig, { hat, boots, outfit, shoes }, JSON.parse(tintKey))
    worn.current = w
    return () => {
      w.dispose()
      if (worn.current === w) worn.current = null
    }
  }, [rig, hat, boots, outfit, shoes, tintKey])

  // Suciedad: el color base se tiñe de barro.
  useEffect(() => {
    for (const m of rig.materials) {
      const base = (m.userData.base ??= m.color.clone()) as THREE.Color
      m.color.copy(base).lerp(DIRT_COLOR, Math.min(1, dirt) * 0.65)
    }
  }, [rig, dirt])
  useEffect(() => rig.setProgress?.(growth), [rig, growth])

  // Reacciones: cada `key` nueva se ordena una vez.
  useEffect(() => {
    if (!cue || cue.key === lastKey.current) return
    lastKey.current = cue.key
    anim.cue(cue.id, cue.t0 ?? anim.now, cue.dance)
  }, [anim, cue])

  useFrame(({ clock }) => {
    const fps = useGame.getState().fps
    const scrub = time != null
    let t: number
    if (scrub) t = time
    else {
      start.current ??= clock.elapsedTime
      // Cuadros alineados al reloj de la escena (no al instante en que apareció): así la escena
      // puede dibujar solo cuando cambia el cuadro (ver `Pacer` en ui/Scene.tsx).
      t = (Math.floor(clock.elapsedTime * fps) - Math.floor(start.current * fps)) / fps
    }
    // Esponja: se nota mientras la frotan y se apaga de a poco al soltarla.
    const l = live.current
    const rubbing = performance.now() - l.scrubAt < 160 ? 1 : 0
    l.scrubW += (rubbing - l.scrubW) * (rubbing ? 0.25 : 0.06)
    let lure: V3 | null = null
    const lureW = props.petId ? getLure(props.petId) : null
    if (lureW && space.current) {
      const p = space.current.worldToLocal(lureW.clone())
      lure = [p.x, 0, p.z]
    }
    const out = anim.advance(t, { sleeping, sad, dirt, growth, roam, voice, busy: props.busy, scrub: l.scrubW, lure }, scrub)
    if (out.caught !== l.caught) {
      l.caught = out.caught
      onCatch.current?.()
    }
    rig.face?.update(out.expression ?? expression, out.blink, t)
    for (const m of rig.materials) m.emissive.copy(GLOW_COLOR).multiplyScalar(out.glow * 0.35)
    worn.current?.update(t, out)
    // La sombra sigue al personaje y se achica cuando salta.
    const r = rig.joints.root
    if (shadow.current && r) {
      const lift = Math.max(0, r.position.y)
      shadow.current.position.set(r.position.x, 0.016, r.position.z)
      const k = Math.max(0.55, 1 - lift * 1.4) * SHADOW[rig.kind]
      shadow.current.scale.set(k, k * 0.8, 1)
      ;(shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.18 * Math.max(0.5, 1 - lift * 1.5)
    }
  })

  return (
    <group ref={space} scale={stage.scale}>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.016} raycast={noRaycast}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {/* Los tacones la elevan un poco. */}
      <group position-y={rig.kind === 'hen' || (rig.kind === 'cat' && !rig.young) ? shoeLift(shoes) * (rig.shoeK ?? 1) : 0}>
        <primitive object={rig.root} />
      </group>
      <primitive object={anim.fx.group} />
    </group>
  )
}
