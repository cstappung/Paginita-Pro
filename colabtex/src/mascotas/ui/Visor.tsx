import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { getStage } from '../data/species'
import { danceSeconds, getDance } from '../data/accessories'
import type { Item } from '../game/inventory'
import { genesDe } from '../game/look'
import type { SlotId, SpeciesId, StageId } from '../game/types'
import { PetView, type PetCue } from '../pets/PetView'
import { buildItemModel, buildPetModel, mannequinFor, type ItemModel } from './itemModel'
import { swatch } from './swatch'
import { snapshot } from './thumbs'

// El visor: el mismo paquete del juego en `juegos/mascotas/visor.html`, sin juego. La página de
// Juegos lo usa para dos cosas, siempre por postMessage (canal visor-parent / visor-child):
//
// - `fotos`: una lista de objetos o mascotas → una imagen de cada uno (un solo lienzo WebGL que
//   dibuja de a uno y lo guarda como PNG) y sus colores. Así el mercado y el salón muestran cada
//   cosa en 3D sin meter three.js en juegos-app.js.
// - `muestra`: una sola cosa en vivo (el detalle del mercado, la mascota del perfil). Va a 12 fps
//   con `frameloop="demand"`, se pausa cuando la página lo pide (fuera de pantalla, pestaña oculta)
//   y con `prefers-reduced-motion` queda quieta. Las mascotas adultas con baile lo bailan en loop.

const CANAL_PADRE = 'visor-parent'
const CANAL_HIJO = 'visor-child'

interface PedidoMascota {
  e: SpeciesId
  etapa: StageId
  /** Semilla de los genes (la de su adopción). */
  semilla: number[]
  ids?: Partial<Record<SlotId, string>>
  tints?: Partial<Record<SlotId, number>>
  /** Baile en loop (solo bailan los adultos). */
  baile?: string
}
interface Pedido {
  key: string
  item?: Pick<Item, 'kind' | 'id' | 'tint'>
  mascota?: PedidoMascota
}

const manda = (x: Record<string, unknown>) => window.parent !== window && window.parent.postMessage({ canal: CANAL_HIJO, ...x }, location.origin)

function foto(p: Pedido): { src: string | null; colores: string[] } {
  try {
    if (p.item) {
      const it = { uid: p.key, ...p.item } as Item
      const colores = swatch(it.kind, it.id, it.tint)
      if (it.kind === 'dance') return { src: null, colores }
      const m = buildItemModel(it, it.kind === 'decor' ? undefined : mannequinFor(it.kind))
      return { src: m ? snapshot(m) : null, colores }
    }
    if (p.mascota) {
      const m = p.mascota
      return { src: snapshot(buildPetModel(m.e, m.etapa, genesDe(m.e, m.semilla), m.ids, m.tints)), colores: [] }
    }
  } catch (e) {
    console.warn('[visor] foto', p.key, e)
  }
  return { src: null, colores: [] }
}

/** Dibuja a 12 fps mientras no esté en pausa; quieto con movimiento reducido. */
function Pacer({ pausa }: { pausa: boolean }) {
  const clock = useThree((s) => s.clock)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    invalidate()
    if (pausa || quieto) return
    let raf = 0
    let last = -1
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const now = clock.elapsedTime + (performance.now() - clock.oldTime) / 1000
      const frame = Math.floor(now * 12)
      if (frame !== last) {
        last = frame
        invalidate()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [clock, invalidate, pausa])
  return null
}

function Mira({ y }: { y: number }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => camera.lookAt(0, y, 0), [camera, y])
  return null
}

function MascotaViva({ m, k }: { m: PedidoMascota; k: string }) {
  const stage = getStage(m.e, m.etapa)
  const genes = useMemo(() => genesDe(m.e, m.semilla), [m.e, m.semilla])
  const [cue, setCue] = useState<PetCue | null>(null)
  const ultimo = useRef(0)
  const baila = m.etapa === 'adult' && m.baile && getDance(m.baile) ? m.baile : null
  useFrame(({ clock }) => {
    if (!baila) return
    const now = clock.elapsedTime
    const len = danceSeconds(getDance(baila)!) + 0.6
    if (!ultimo.current || now - ultimo.current > len) {
      ultimo.current = now || 0.001
      setCue({ id: 'dance', key: now, dance: baila })
    }
  })
  return (
    <group scale={1.25 / Math.max(0.5, stage.scale)}>
      <PetView stage={stage} expression="happy" cue={cue} roam={false} look={genes} seed={k} hat={m.ids?.hat} boots={m.ids?.boots} outfit={m.ids?.outfit} shoes={m.ids?.shoes} tints={m.tints} />
    </group>
  )
}

function ObjetoVivo({ it }: { it: Pick<Item, 'kind' | 'id' | 'tint'> }) {
  const model = useMemo<ItemModel | null>(() => buildItemModel({ uid: 'visor', ...it } as Item), [it])
  useEffect(() => () => model?.dispose(), [model])
  useFrame(({ clock }) => {
    if (!model) return
    model.root.rotation.y = clock.elapsedTime * 0.8 - 0.5
    model.update(clock.elapsedTime)
  })
  return model ? <primitive object={model.root} position={[0, 0.7, 0]} scale={0.85} /> : null
}

export function Visor() {
  const [muestra, setMuestra] = useState<Pedido | null>(null)
  const [pausa, setPausa] = useState(false)
  useEffect(() => {
    const cola: Pedido[] = []
    let reloj = 0
    // Las fotos se sacan de a pocas por cuadro, para no trabar la página que las pidió.
    const bombea = () => {
      reloj = 0
      const t0 = performance.now()
      while (cola.length && performance.now() - t0 < 24) {
        const p = cola.shift()!
        manda({ tipo: 'foto', key: p.key, ...foto(p) })
      }
      if (cola.length) reloj = window.setTimeout(bombea, 16)
    }
    const oye = (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== location.origin) return
      const x = e.data
      if (!x || x.canal !== CANAL_PADRE) return
      if (x.tipo === 'fotos') {
        for (const p of (x.pedidos ?? []) as Pedido[]) if (p && p.key) cola.push(p)
        if (!reloj) reloj = window.setTimeout(bombea, 0)
      } else if (x.tipo === 'muestra') setMuestra(x.pedido ?? null)
      else if (x.tipo === 'pausa') setPausa(!!x.on)
    }
    window.addEventListener('message', oye)
    manda({ tipo: 'listo' })
    return () => {
      window.removeEventListener('message', oye)
      window.clearTimeout(reloj)
    }
  }, [])
  if (!muestra) return null
  return (
    <Canvas className="visor-lienzo" flat frameloop="demand" dpr={[1, 2]} camera={{ fov: 30, position: [0, 2.2, 6.4] }} gl={{ alpha: true, antialias: true }}>
      <Pacer pausa={pausa} />
      <Mira y={muestra.mascota ? 0.55 : 0.7} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[1.5, 4, 6]} intensity={2.4} />
      {muestra.mascota ? <MascotaViva key={muestra.key} m={muestra.mascota} k={muestra.key} /> : muestra.item ? <ObjetoVivo key={muestra.key} it={muestra.item} /> : null}
    </Canvas>
  )
}
