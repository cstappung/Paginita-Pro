import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { play } from '../audio/sound'
import { getDance } from '../data/accessories'
import { SPECIES, getStage, type StageDef } from '../data/species'
import { genesDe } from '../game/look'
import { puesto } from '../game/rules'
import { DICHO_MAX, DICHO_MS, GESTOS, GESTO_MS, PLAZA, emojiGesto, entrada, aPiso, limpiaDicho, ritmo } from '../game/pueblo'
import type { SlotId, SpeciesId, StageId } from '../game/types'
import { PetView, type PetCue } from '../pets/PetView'
import { SPEED } from '../pets/anim/idle'
import type { RigKind } from '../pets/rig/types'
import type { Genes } from '../pets/rig'
import { buildPlaza } from '../scene/plaza'
import { useGame } from '../store/gameStore'
import { ropaIds, usePueblo, type Paseante } from '../store/pueblo'
import { pide } from '../store/red'
import MM from '../../../../juegos/mascotas/motor.js'
import { Casa } from './Casa'
import { Pacer, bubbleTexture } from './Scene'
import { globo, letreroNombre } from './letreros'

// El Pueblo, estilo Pet Society: una plaza donde tu mascota pasea (tocas el piso y camina hasta
// ahí) y se encuentra con las de los demás que estén paseando ahora. Se saluda con gestos, se baila,
// se dice algo en un globo y, tocando a otra mascota, se visita su casa (ui/Casa.tsx), donde se le
// puede hacer cariño. Nada de esto paga monedas: es para lucir a la mascota criada.

const MODELO: Record<string, RigKind> = { egg: 'egg', chick: 'chick', chicken: 'hen', box: 'box', kitten: 'cat', cat: 'cat' }
const noRaycast = () => {}
let llaves = 0

const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e || 'No se pudo.'))
/** La etapa de una mascota de otro (sin tirar si llega algo raro). */
function etapaDe(e: SpeciesId, et: string): StageDef | null {
  try {
    return getStage(e, et)
  } catch {
    return null
  }
}

interface Gesto {
  em: string
  ea: number
  /** Baile (id del catálogo) si el gesto fue bailar. */
  b: string
  t: string
  ta: number
}

/** Un sprite que muestra una textura sobre la mascota, con alto fijo en unidades de la escena. */
function Cartel({ tex, aspecto, alto, y, visible = true, refSprite }: { tex: THREE.Texture; aspecto: number; alto: number; y: number; visible?: boolean; refSprite?: MutableRefObject<THREE.Sprite | null> }) {
  return (
    <sprite ref={refSprite} position={[0, y, 0]} scale={[alto * aspecto, alto, 1]} renderOrder={10} raycast={noRaycast} visible={visible}>
      <spriteMaterial map={tex} depthTest={false} transparent />
    </sprite>
  )
}

/**
 * Una mascota en la plaza. Las que caminan lo hacen con su propia animación (PetView `walk`); el
 * huevo y la caja no caminan, así que van dando saltitos. `posOut` dice dónde va (la cámara sigue
 * a la propia). Los carteles (nombre, gesto, globo) van en otro grupo que la sigue sin girar con ella.
 */
function Andante(props: {
  stage: StageDef
  genes: Genes
  ids: Partial<Record<SlotId, string>>
  tints: Partial<Record<SlotId, number>>
  seed: string
  spawn: { x: number; z: number }
  target: { x: number; z: number }
  gesto: Gesto
  nombre: string
  dueno: string
  color: string
  posOut?: MutableRefObject<{ x: number; z: number }>
  onPick?: () => void
}) {
  const { stage, gesto } = props
  const kind = MODELO[stage.model] ?? 'hen'
  const velocidad = SPEED[kind] * stage.scale
  const [origen] = useState(props.spawn)
  const rel = useRef({ x: 0, z: 0 })
  const salto = useRef({ x: 0, z: 0, tx: 0, tz: 0, fase: 0 })
  const cuerpo = useRef<THREE.Group>(null)
  const carteles = useRef<THREE.Group>(null)
  const [walk, setWalk] = useState<{ x: number; z: number; key: number; pace: number } | null>(null)
  const [cue, setCue] = useState<PetCue | null>(null)

  const { x: tx, z: tz } = props.target
  useEffect(() => {
    const x = tx - origen.x
    const z = tz - origen.z
    if (velocidad > 0) {
      const d = Math.hypot(x - rel.current.x, z - rel.current.z)
      if (d > 0.04) setWalk({ x, z, key: ++llaves, pace: ritmo(d, velocidad) })
    } else {
      salto.current.tx = x
      salto.current.tz = z
    }
  }, [tx, tz, origen, velocidad])

  // Un gesto nuevo (y reciente: al llegar a la plaza no se repiten los viejos) se actúa.
  useEffect(() => {
    if (!gesto.ea || Date.now() - gesto.ea > GESTO_MS) return
    const baile = gesto.em === 'baile' && gesto.b && stage.actions.includes('dance') && getDance(gesto.b) ? gesto.b : null
    setCue(baile ? { id: 'dance', dance: baile, key: ++llaves } : { id: 'poke', key: ++llaves })
  }, [gesto.ea, gesto.em, gesto.b, stage])

  const emoji = gesto.em === 'baile' ? '🎵' : emojiGesto(gesto.em)
  const nombre = useMemo(() => letreroNombre(props.nombre || 'Sin nombre', props.dueno, props.color), [props.nombre, props.dueno, props.color])
  const dicho = useMemo(() => (gesto.t ? globo(gesto.t) : null), [gesto.t])
  useEffect(() => () => dicho?.tex.dispose(), [dicho])
  const spriteEmoji = useRef<THREE.Sprite | null>(null)
  const spriteDicho = useRef<THREE.Sprite | null>(null)

  const alto = stage.scale * (props.ids.hat && stage.slots.includes('hat') ? 1.45 : 1.15)
  useFrame((_, dt) => {
    const s = salto.current
    let x = rel.current.x
    let z = rel.current.z
    if (velocidad <= 0) {
      // Saltitos hasta el destino.
      const dx = s.tx - s.x
      const dz = s.tz - s.z
      const d = Math.hypot(dx, dz)
      const paso = Math.min(d, 1.1 * Math.min(dt, 0.25))
      if (d > 0.01) {
        s.x += (dx / d) * paso
        s.z += (dz / d) * paso
        s.fase += Math.min(dt, 0.25) * 9
      } else s.fase = 0
      if (cuerpo.current) {
        cuerpo.current.position.set(s.x, d > 0.01 ? Math.abs(Math.sin(s.fase)) * 0.14 : 0, s.z)
        if (d > 0.01) cuerpo.current.rotation.y = Math.atan2(dx, dz)
      }
      x = s.x
      z = s.z
    }
    if (props.posOut) {
      props.posOut.current.x = origen.x + x
      props.posOut.current.z = origen.z + z
    }
    carteles.current?.position.set(origen.x + x, 0, origen.z + z)
    const now = Date.now()
    if (spriteEmoji.current) spriteEmoji.current.visible = !!emoji && now - gesto.ea < GESTO_MS
    if (spriteDicho.current) spriteDicho.current.visible = !!gesto.t && now - gesto.ta < DICHO_MS
  })

  return (
    <>
      <group
        position={[origen.x, 0, origen.z]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (e.delta > 10) return
          if (props.onPick) props.onPick()
          else setCue({ id: 'poke', key: ++llaves })
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <group ref={cuerpo}>
          <Suspense fallback={null}>
            <PetView
              stage={stage}
              expression="happy"
              roam={false}
              walk={walk}
              pos={rel}
              cue={cue}
              seed={props.seed}
              look={props.genes}
              hat={props.ids.hat}
              boots={props.ids.boots}
              outfit={props.ids.outfit}
              shoes={props.ids.shoes}
              tints={props.tints}
            />
          </Suspense>
        </group>
      </group>
      <group ref={carteles}>
        <Cartel tex={nombre.tex} aspecto={nombre.aspecto} alto={props.dueno ? 0.5 : 0.34} y={-0.16} />
        {emoji && <Cartel tex={bubbleTexture(emoji)} aspecto={1} alto={0.46} y={alto + 0.3} refSprite={spriteEmoji} visible={false} />}
        {dicho && <Cartel tex={dicho.tex} aspecto={dicho.aspecto} alto={0.85} y={alto + (emoji ? 1.0 : 0.55)} refSprite={spriteDicho} visible={false} />}
      </group>
    </>
  )
}

/** Inclinación de la cámara de la plaza (desde el piso). */
const ELEVACION = 0.78

/** La cámara sigue a la propia mascota, sin mostrar más allá de la plaza. */
function Seguidor({ objetivo }: { objetivo: MutableRefObject<{ x: number; z: number }> }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const size = useThree((s) => s.size)
  const c = useRef<{ x: number; z: number } | null>(null)
  useFrame((_, dt) => {
    // Unidades de la escena que entran a lo ancho: en el celular, un barrio chico; en grande, la plaza entera.
    const ancho = Math.min(15, Math.max(7.5, size.width / 78))
    const zoom = size.width / ancho
    if (Math.abs(camera.zoom - zoom) > 0.01) {
      camera.zoom = zoom
      camera.updateProjectionMatrix()
    }
    const medio = ancho / 2
    const lx = PLAZA.xMax + 1 - medio
    const x = lx > 0 ? Math.min(lx, Math.max(-lx, objetivo.current.x)) : 0
    // Fondo de piso que entra a lo alto (la cámara mira inclinada): si entra la plaza entera, queda
    // quieta y centrada un poco hacia atrás (asoman las casitas); si no, sigue a la mascota.
    const fondo = size.height / zoom / Math.sin(ELEVACION)
    const lz = (PLAZA.zMax - PLAZA.zMin + 2.4 - fondo) / 2
    const zc = (PLAZA.zMax + PLAZA.zMin) / 2 - 0.4
    const z = lz > 0 ? Math.min(zc + lz, Math.max(zc - lz, objetivo.current.z)) : zc
    if (!c.current) c.current = { x, z }
    const k = 1 - Math.exp(-Math.min(dt, 0.25) * 2.5)
    c.current.x += (x - c.current.x) * k
    c.current.z += (z - c.current.z) * k
    camera.position.set(c.current.x, 20 * Math.sin(ELEVACION), c.current.z + 20 * Math.cos(ELEVACION))
    camera.lookAt(c.current.x, 0, c.current.z)
  })
  return null
}

function Plaza({ onTap }: { onTap: (x: number, z: number) => void }) {
  const plaza = useMemo(() => buildPlaza(), [])
  useEffect(() => {
    plaza.root.traverse((o) => void (o.raycast = noRaycast))
    return () => plaza.dispose()
  }, [plaza])
  useFrame(({ clock }) => plaza.update(clock.elapsedTime))
  return (
    <>
      <primitive object={plaza.root} />
      {/* El piso que se toca para caminar (invisible: la plaza se dibuja arriba). */}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.03}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 10) return
          onTap(e.point.x, e.point.z)
        }}
      >
        <planeGeometry args={[40, 30]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  )
}

/** Marquita donde se tocó (adónde va). */
function Destino({ p }: { p: { x: number; z: number; key: number } | null }) {
  const ref = useRef<THREE.Mesh>(null)
  const t0 = useRef(0)
  useEffect(() => void (t0.current = performance.now()), [p?.key])
  useFrame(() => {
    if (!ref.current) return
    const u = (performance.now() - t0.current) / 900
    ref.current.visible = !!p && u < 1
    ref.current.scale.setScalar(0.4 + u * 0.5)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u)
  })
  if (!p) return null
  return (
    <mesh ref={ref} position={[p.x, 0.04, p.z]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
      <ringGeometry args={[0.32, 0.42, 32]} />
      <meshBasicMaterial color="#ff8a3d" transparent depthWrite={false} />
    </mesh>
  )
}

const VACIO: Gesto = { em: '', ea: 0, b: '', t: '', ta: 0 }

interface VecinoLista {
  u: string
  nombre: string
  color: string
  foto: string
  mascotas: { c: string; e: SpeciesId }[]
}

/** La libreta de vecinos (como la barra de amigos de Pet Society): todas las cuentas con mascotas. */
function Vecinos({ onVisit, onClose }: { onVisit: (c: string) => void; onClose: () => void }) {
  const [lista, setLista] = useState<VecinoLista[] | null>(null)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [suyas, setSuyas] = useState<Record<string, { c: string; e: SpeciesId; n: string; et: StageId | '' }[]>>({})
  const [q, setQ] = useState('')
  useEffect(() => {
    pide<VecinoLista[]>('vecinos').then(setLista, (e) => setError(motivo(e)))
  }, [])
  const abre = (u: string) => {
    setAbierto((a) => (a === u ? null : u))
    if (suyas[u]) return
    pide<{ c: string; e: SpeciesId; n: string; et: StageId | '' }[]>('vecino', { u }).then(
      (xs) => setSuyas((s) => ({ ...s, [u]: xs })),
      (e) => setError(motivo(e)),
    )
  }
  const filtro = q.trim().toLocaleLowerCase('es')
  const vistos = (lista ?? []).filter((v) => !filtro || v.nombre.toLocaleLowerCase('es').includes(filtro))
  return (
    <div className="modal" role="dialog" aria-label="Vecinos" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="confirm pb-vecinos">
        <div className="panel-top">
          <h2>👥 Vecinos</h2>
          <button className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <p className="pb-nota">Visita la casa de sus mascotas y hazles cariño: una vez al día cada una, y su dueño lo ve al volver.</p>
        <input className="pb-buscar" type="search" placeholder="Buscar vecino…" value={q} onChange={(e) => setQ(e.target.value)} />
        {error && <p className="empty">{error}</p>}
        {!lista && !error && <p className="empty">Tocando timbres…</p>}
        {lista && !vistos.length && <p className="empty">{lista.length ? 'Nadie con ese nombre.' : 'Todavía nadie más tiene mascotas.'}</p>}
        <ul className="pb-lista">
          {vistos.map((v) => (
            <li key={v.u}>
              <button className={`pb-vecino${abierto === v.u ? ' on' : ''}`} onClick={() => abre(v.u)} aria-expanded={abierto === v.u}>
                <span className="pb-avatar" style={{ borderColor: v.color, background: v.foto ? undefined : v.color }}>
                  {v.foto ? <img src={v.foto} alt="" draggable={false} /> : <b>{(v.nombre[0] || '?').toUpperCase()}</b>}
                </span>
                <span className="pb-vecino-tx" translate="no">
                  <strong>{v.nombre}</strong>
                </span>
                <small>
                  {v.mascotas.map((m) => SPECIES[m.e]?.stages.at(-1)?.emoji ?? '🐾').join('')}
                </small>
              </button>
              {abierto === v.u && (
                <div className="pb-suyas">
                  {!suyas[v.u] && <span className="empty">Mirando por la ventana…</span>}
                  {suyas[v.u]?.map((m) => {
                    const st = m.et ? etapaDe(m.e, m.et) : null
                    return (
                      <button key={m.c} className="pet-card" onClick={() => onVisit(m.c)}>
                        <span className="pet-card-icon">{st?.emoji ?? SPECIES[m.e]?.stages.at(-1)?.emoji ?? '🐾'}</span>
                        <span className="pet-card-text">
                          <strong translate="no">{m.n || 'Sin nombre'}</strong>
                          <span>{st ? st.label : 'Sin casa todavía'} · 🏠 Visitar</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function Pueblo({ onClose, inicial, volumen }: { onClose: () => void; inicial: string | null; volumen: ReactNode }) {
  const pets = useGame((s) => s.pets)
  const items = useGame((s) => s.items)
  const paseantes = usePueblo((s) => s.paseantes)
  const aviso = usePueblo((s) => s.aviso)
  const libres = pets.filter((p) => !p.venta)
  const [miaId, setMiaId] = useState<string | null>(() => (libres.find((p) => p.id === inicial) ?? libres[0])?.id ?? null)
  const mia = libres.find((p) => p.id === miaId) ?? libres[0] ?? null
  const [spawn, setSpawn] = useState(() => entrada(Math.random()))
  const [target, setTarget] = useState<{ x: number; z: number; key: number }>(() => ({ ...spawn, key: 0 }))
  const yo = useRef({ ...spawn })
  const [gesto, setGesto] = useState<Gesto>(VACIO)
  const [sel, setSel] = useState<string | null>(null)
  const [visita, setVisita] = useState<string | null>(null)
  const [vecinos, setVecinos] = useState(false)
  const [dicho, setDicho] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const toastReloj = useRef(0)
  const say = (m: string, ms = 2600) => {
    setToast(m)
    window.clearTimeout(toastReloj.current)
    toastReloj.current = window.setTimeout(() => setToast(null), ms)
  }

  // Entrar y salir de la plaza (el cartero escucha a los demás solo mientras tanto).
  useEffect(() => {
    pide('plaza', { on: true }).catch((e) => say(motivo(e), 5000))
    return () => {
      pide('plaza', { on: false }).catch(() => {})
      usePueblo.setState({ paseantes: [], aviso: '' })
    }
  }, [])
  // Dónde está la propia (y quién es): se publica al cambiar.
  const miaC = mia?.id
  useEffect(() => {
    if (!miaC) return
    pide('plazaPon', { m: miaC, x: target.x, z: target.z }).catch((e) => say(motivo(e), 5000))
  }, [miaC, target])

  const stage = mia ? getStage(mia.species, mia.stage) : null
  const worn = useMemo(() => (mia ? puesto(mia, items) : { ids: {}, tints: {} }), [mia, items])
  const bailes = useMemo(() => {
    const vistos = new Set<string>()
    return items.filter((i) => i.kind === 'dance' && !i.venta && getDance(i.id) && !vistos.has(i.id) && vistos.add(i.id))
  }, [items])
  const baila = !!stage?.actions.includes('dance')

  const camina = (x: number, z: number) => {
    if (!mia) return
    const p = aPiso(x, z)
    play('tap')
    setSel(null)
    setTarget({ ...p, key: Date.now() })
  }
  const gesticula = (em: string, baile?: { uid: string; id: string }) => {
    if (!mia) return
    setGesto((g) => ({ ...g, em, ea: Date.now(), b: baile?.id ?? '' }))
    play(baile ? 'dance' : 'pop')
    pide('plazaPon', { m: mia.id, x: target.x, z: target.z, em, ...(baile ? { b: baile.uid } : {}) }).catch((e) => say(motivo(e)))
  }
  const decir = () => {
    const t = limpiaDicho(dicho)
    if (!t || !mia) return
    setGesto((g) => ({ ...g, t, ta: Date.now() }))
    setDicho('')
    play('pop')
    pide('plazaPon', { m: mia.id, x: target.x, z: target.z, t }).catch((e) => say(motivo(e)))
  }
  const cambia = (id: string) => {
    // La nueva sale desde donde estaba la otra.
    const p = aPiso(yo.current.x, yo.current.z)
    setSpawn(p)
    setTarget({ ...p, key: Date.now() })
    setMiaId(id)
  }

  const otros = paseantes.filter((p) => p.et && etapaDe(p.e, p.et))
  const elegido = otros.find((p) => p.u === sel) ?? null

  if (visita)
    return (
      <div className="app pueblo">
        <Casa c={visita} onClose={() => setVisita(null)} volumen={volumen} />
      </div>
    )

  return (
    <div className="app pueblo">
      <header className="topbar">
        <button className="icon-btn volver" aria-label="Volver al corral" title="Volver al corral" onClick={onClose}>
          ←
        </button>
        <h1 className="logo">
          <span aria-hidden>🏘️</span> <span className="logo-text">Pueblo</span>
        </h1>
        {volumen}
        <div className="top-right">
          <button className="pill-btn pb-vecinos-btn" onClick={() => setVecinos(true)}>
            👥 Vecinos
          </button>
        </div>
      </header>

      {vecinos && (
        <Vecinos
          onClose={() => setVecinos(false)}
          onVisit={(c) => {
            setVecinos(false)
            setVisita(c)
          }}
        />
      )}

      {!mia || !stage ? (
        <section className="panel">
          <p className="empty">{pets.length ? 'Tus mascotas están a la venta: retira una del mercado para salir a pasear.' : 'Adopta una mascota en el corral para salir a pasear por el pueblo.'}</p>
          <button className="pill-btn" onClick={() => setVecinos(true)}>
            👥 Visitar a los vecinos
          </button>
        </section>
      ) : (
        <>
          <div className="stage-wrap pb-plaza">
            <Canvas flat frameloop="demand" dpr={[1, 2]}>
              <color attach="background" args={['#cfe8f5']} />
              <OrthographicCamera makeDefault position={[0, 9, 13]} near={0.1} far={80} />
              <Pacer full={false} />
              <Seguidor objetivo={yo} />
              <ambientLight intensity={0.9} />
              <directionalLight position={[1.5, 4, 6]} intensity={2.4} />
              <Plaza onTap={camina} />
              <Destino p={target.key ? target : null} />
              <Andante
                key={mia.id + mia.stage}
                stage={stage}
                genes={(mia.look ?? mia.coat)!}
                ids={worn.ids}
                tints={worn.tints}
                seed={mia.id}
                spawn={spawn}
                target={target}
                gesto={gesto}
                nombre={mia.name}
                dueno=""
                color="#ff8a3d"
                posOut={yo}
              />
              {otros.map((p) => (
                <Otro key={p.u + p.c + p.et} p={p} onPick={() => (play('tap'), setSel(p.u))} />
              ))}
            </Canvas>
            <div className="pb-cuantos" aria-live="polite">
              {aviso || (otros.length ? `👥 ${otros.length} ${otros.length === 1 ? 'vecino paseando' : 'vecinos paseando'}` : 'Toca el piso para caminar')}
            </div>
            {elegido && (
              <div className="pb-ficha" role="dialog" aria-label={`La mascota de ${elegido.nombre}`}>
                <span className="pb-ficha-tx">
                  <strong translate="no">{elegido.n || 'Sin nombre'}</strong>
                  <small>
                    {etapaDe(elegido.e, elegido.et)?.label} de <b translate="no">{elegido.nombre}</b>
                  </small>
                </span>
                <button className="pill-btn" onClick={() => gesticula('hola')}>
                  👋
                </button>
                <button className="pill-btn" onClick={() => setVisita(elegido.c)}>
                  🏠 Visitar
                </button>
                <button className="ghost" aria-label="Cerrar" onClick={() => setSel(null)}>
                  ✕
                </button>
              </div>
            )}
            {toast && (
              <div key={toast} className="toast" role="status">
                {toast}
              </div>
            )}
          </div>

          <section className="panel pb-panel">
            {libres.length > 1 && (
              <div className="chips pb-quien" role="group" aria-label="Quién sale a pasear">
                {libres.map((p) => (
                  <button key={p.id} className={`chip${p.id === mia.id ? ' on' : ''}`} onClick={() => p.id !== mia.id && cambia(p.id)} translate="no">
                    {getStage(p.species, p.stage).emoji} {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="pb-gestos" role="group" aria-label="Gestos">
              {GESTOS.map((g) => (
                <button key={g.id} className="pb-gesto" title={g.label} aria-label={g.label} onClick={() => gesticula(g.id)}>
                  {g.emoji}
                </button>
              ))}
            </div>
            {baila && bailes.length > 0 && (
              <div className="pb-bailes" role="group" aria-label="Bailar">
                {bailes.map((b) => {
                  const d = getDance(b.id)!
                  return (
                    <button key={b.uid} className={`chip${d.rarity === 'legendary' ? ' legendary' : ''}`} onClick={() => gesticula('baile', { uid: b.uid, id: b.id })}>
                      {d.emoji} {d.label}
                    </button>
                  )
                })}
              </div>
            )}
            <form
              className="pb-decir"
              onSubmit={(e) => {
                e.preventDefault()
                decir()
              }}
            >
              <input value={dicho} maxLength={DICHO_MAX} placeholder={`Que ${mia.name} diga algo…`} onChange={(e) => setDicho(e.target.value)} aria-label="Decir algo en la plaza" />
              <button className="pill-btn" type="submit" disabled={!limpiaDicho(dicho)}>
                💬 Decir
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  )
}

/** La mascota de otro en la plaza. */
function Otro({ p, onPick }: { p: Paseante; onPick: () => void }) {
  const stage = etapaDe(p.e, p.et)!
  const genes = useMemo(() => genesDe(p.e, MM.semillaGenes(p.o, p.k, p.at0)), [p.e, p.o, p.k, p.at0])
  const ropa = useMemo(() => ropaIds(p.w), [p.w])
  // La posición de llegada: donde estaba al aparecer.
  const [spawn] = useState(() => ({ x: p.x, z: p.z }))
  const target = useMemo(() => ({ x: p.x, z: p.z }), [p.x, p.z])
  const gesto = useMemo<Gesto>(() => ({ em: p.em, ea: p.ea, b: p.b, t: p.t, ta: p.ta }), [p.em, p.ea, p.b, p.t, p.ta])
  return (
    <Andante
      stage={stage}
      genes={genes}
      ids={ropa.ids}
      tints={ropa.tints}
      seed={p.c}
      spawn={spawn}
      target={target}
      gesto={gesto}
      nombre={p.n}
      dueno={p.nombre}
      color={p.color}
      onPick={onPick}
    />
  )
}
