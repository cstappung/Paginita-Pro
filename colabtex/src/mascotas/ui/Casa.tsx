import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { play } from '../audio/sound'
import { getStage } from '../data/species'
import { desdeEstado, type Adopcion } from '../game/estado'
import { CARINO_ANIMO, puedeCarino } from '../game/pueblo'
import { mood, tick } from '../game/rules'
import type { PlacedDecor, SpeciesId, StageId, Stats } from '../game/types'
import { PetView, type PetCue } from '../pets/PetView'
import { pide } from '../store/red'
import { ropaIds, type Ropa } from '../store/pueblo'
import MM from '../../../../juegos/mascotas/motor.js'
import { DecorLayer, type DecorRegistry } from './DecorLayer'
import { CameraRig, Lighting, Pacer, bubbleTexture, viewFor } from './Scene'

// La casa de la mascota de un vecino: su lugar con los muebles que le puso su dueño, y ella
// paseando. Solo se mira (nada de esto se guarda), salvo el cariño: una vez al día por mascota, le
// sube el ánimo cuando su dueño vuelve a abrir Mascotas (lo aplica su juego, no esta visita).

interface CasaDatos {
  u: string
  nombre: string
  color: string
  c: string
  o: string
  k: string
  at0: number
  e: SpeciesId
  frozen: boolean
  estado: { n: string; e: StageId; g: number; s: Stats; ls: number; z: boolean } | null
  w: Ropa
  d: { id: string; tint: number; x: number; z: number; rot: number }[]
  /** Cariños que recibió en el último día. */
  hoy: number
  /** Cuándo le hice cariño por última vez (reloj de este navegador). */
  mio: number | null
  mia: boolean
}

const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e || 'No se pudo.'))
let llaves = 0

export function Casa({ c, onClose, volumen }: { c: string; onClose: () => void; volumen: ReactNode }) {
  const [datos, setDatos] = useState<CasaDatos | null>(null)
  const [error, setError] = useState('')
  const [cue, setCue] = useState<PetCue | null>(null)
  const [corazon, setCorazon] = useState(0)
  const [hecho, setHecho] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const reloj = useRef(0)
  const registry = useRef<DecorRegistry>(new Map())
  const say = (m: string, ms = 3200) => {
    setToast(m)
    window.clearTimeout(reloj.current)
    reloj.current = window.setTimeout(() => setToast(null), ms)
  }

  useEffect(() => {
    let vivo = true
    pide<CasaDatos>('casa', { c }).then(
      (d) => vivo && setDatos(d),
      (e) => vivo && setError(motivo(e)),
    )
    return () => void (vivo = false)
  }, [c])

  const pet = useMemo(() => {
    if (!datos) return null
    const now = Date.now()
    const a: Adopcion = { c: datos.c, o: datos.o, k: datos.k, at: datos.at0, e: datos.e, semilla: MM.semillaGenes(datos.o, datos.k, datos.at0) }
    const est = datos.estado ? { v: 1 as const, n: datos.estado.n, e: datos.estado.e, g: datos.estado.g, s: datos.estado.s, ls: datos.estado.ls, ...(datos.estado.z ? { z: true } : {}) } : null
    return tick(desdeEstado(a, est, [], now), now, false)
  }, [datos])
  const decor = useMemo<PlacedDecor[]>(() => (datos?.d ?? []).map((x) => ({ id: x.id, x: x.x, z: x.z, rot: x.rot * (Math.PI / 4), ...(x.tint ? { tint: x.tint } : {}) })), [datos])
  const view = useMemo(() => viewFor(decor, false), [decor])
  const ropa = useMemo(() => ropaIds(datos?.w ?? {}), [datos])

  const puede = !!datos && !datos.mia && !!datos.estado && !hecho && puedeCarino(datos.mio, Date.now())
  const carino = async () => {
    if (!datos || !pet || !puede || ocupado) return
    setOcupado(true)
    try {
      await pide('carino', { c: datos.c })
      setHecho(true)
      play('care')
      setCue({ id: 'poke', key: ++llaves })
      setCorazon(Date.now())
      window.setTimeout(() => setCorazon(0), 3500)
      say(`❤️ Le hiciste cariño a ${pet.name}: +${CARINO_ANIMO} de ánimo cuando ${datos.nombre} vuelva`)
    } catch (e) {
      play('error')
      say(motivo(e))
    } finally {
      setOcupado(false)
    }
  }

  const hoy = (datos?.hoy ?? 0) + (hecho ? 1 : 0)
  const stage = pet ? getStage(pet.species, pet.stage) : null
  const sad = pet ? mood(pet) === 'sad' : false
  const dirt = pet ? Math.max(0, (60 - pet.stats.hygiene) / 60) : 0

  return (
    <>
      <header className="topbar">
        <button className="icon-btn volver" aria-label="Volver al pueblo" title="Volver al pueblo" onClick={onClose}>
          ←
        </button>
        <h1 className="logo">
          <span aria-hidden>🏠</span> <span className="logo-text">De visita</span>
        </h1>
        {volumen}
      </header>
      {error && (
        <section className="panel">
          <p className="empty">{error}</p>
          <button className="pill-btn" onClick={onClose}>
            ← Volver al pueblo
          </button>
        </section>
      )}
      {!error && !pet && <p className="empty">🚪 Tocando el timbre…</p>}
      {pet && stage && datos && (
        <>
          <div className="stage-wrap">
            <Canvas flat frameloop="demand">
              <OrthographicCamera makeDefault position={[0, 2.6, 7]} near={0.1} far={50} />
              <Pacer full={false} />
              <CameraRig count={1} focus view={view} />
              <Lighting sky="#cfe8f5" ground="#b9dc8f" on />
              <DecorLayer items={decor} selected={null} registry={registry.current} />
              <group onClick={() => !pet.asleep && setCue({ id: 'poke', key: ++llaves })}>
                <Suspense fallback={null}>
                  <PetView
                    stage={stage}
                    expression={sad ? 'sad' : 'normal'}
                    sleeping={!!pet.asleep}
                    sad={sad}
                    dirt={dirt}
                    cue={cue}
                    seed={pet.id}
                    look={pet.look ?? pet.coat}
                    hat={ropa.ids.hat}
                    boots={ropa.ids.boots}
                    outfit={ropa.ids.outfit}
                    shoes={ropa.ids.shoes}
                    tints={ropa.tints}
                  />
                </Suspense>
                {corazon > 0 && (
                  <sprite position={[0.5, stage.scale * 0.95, 0.2]} scale={[0.34, 0.34, 1]} renderOrder={10} raycast={() => {}}>
                    <spriteMaterial map={bubbleTexture('❤️')} depthTest={false} transparent />
                  </sprite>
                )}
              </group>
            </Canvas>
            {toast && (
              <div key={toast} className="toast" role="status">
                {toast}
              </div>
            )}
          </div>
          <section className="panel pb-casa">
            <div className="panel-top">
              <h2 className="pet-name">
                <span translate="no">{pet.name}</span>
                <span className="stage-tag">{stage.label}</span>
              </h2>
            </div>
            <p className="pb-nota">
              {stage.emoji} Vive con <b translate="no">{datos.nombre}</b>
              {pet.frozen ? ' · tomó la poción eterna 🧪' : ''}
              {pet.asleep ? ' · está durmiendo 💤' : ''}
            </p>
            <p className="pb-nota">
              ❤️ {hoy} {hoy === 1 ? 'cariño' : 'cariños'} hoy
            </p>
            {!datos.estado ? (
              <p className="empty">Todavía no tiene casa: su dueño aún no la abre en Mascotas.</p>
            ) : datos.mia ? (
              <p className="empty">Es tuya: los cariños son para las mascotas de los vecinos.</p>
            ) : (
              <button className="care tone-berry" onClick={() => void carino()} disabled={!puede || ocupado}>
                <span className="care-badge" aria-hidden>
                  ❤️
                </span>
                <span className="care-text">
                  <strong>{puede ? 'Hacerle cariño' : 'Ya le hiciste cariño'}</strong>
                  <small>{puede ? `+${CARINO_ANIMO} de ánimo cuando ${datos.nombre} vuelva` : 'Vuelve mañana para otro'}</small>
                </span>
              </button>
            )}
          </section>
        </>
      )}
    </>
  )
}
