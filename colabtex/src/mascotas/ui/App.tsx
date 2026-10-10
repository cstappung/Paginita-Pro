import { useCallback, useEffect, useRef, useState } from 'react'
import { AVAILABLE_SPECIES, getSpecies, getStage } from '../data/species'
import { BACKGROUNDS, danceSeconds, getDance } from '../data/accessories'
import { play } from '../audio/sound'
import { getDecor } from '../data/decor'
import { DANCE_BAR, FOOD_PRICE, POTION_PRICE, type Item } from '../game/inventory'
import { chickColors, eggColors, henColors } from '../pets/rig/plumage'
import { furColors } from '../pets/rig/fur'
import { SellDialog, type SellTarget } from './Sell'
import { InventoryGrid, applyItem, itemDef, type Filter } from './Inventory'
import { GiftShop } from './GiftShop'
import { DanceIcon } from './DanceIcon'
import { isOwned, priceOf } from '../game/shop'
import { ACTIONS } from '../game/actions'
import { FPS_MAX, FPS_MIN } from '../game/config'
import { hoursToWake, hoursToWakeable, mood, neediest } from '../game/rules'
import type { ActionId, Pet, StatId } from '../game/types'
import type { CueId } from '../pets/anim/cues'
import { SIN_COMIDA, useGame } from '../store/gameStore'
import { avisa, enJuegos } from '../store/red'
import MM from '../../../../juegos/mascotas/motor.js'
import { Scene, type Reaction, type Tool } from './Scene'
import './app.css'

const STAT_LABEL: Record<StatId, string> = {
  hunger: 'Comida',
  happiness: 'Ánimo',
  energy: 'Energía',
  hygiene: 'Higiene',
}
const STAT_EMOJI: Record<StatId, string> = { hunger: '🌾', happiness: '💛', energy: '⚡', hygiene: '🧼' }

const NEED_TEXT: Record<StatId, string> = {
  hunger: 'tiene hambre',
  happiness: 'está aburrido',
  energy: 'tiene sueño',
  hygiene: 'está sucio',
}

/** Cómo se ve cada cuidado: color, ícono, qué se hace y qué stat mejora. */
const CARE: Partial<Record<ActionId, { tone: string; icon: string; hint: string; stat?: StatId }>> = {
  feed: { tone: 'wheat', icon: '🌾', hint: 'Lánzale granos', stat: 'hunger' },
  play: { tone: 'berry', icon: '🐛', hint: 'Juega con el gusanito', stat: 'happiness' },
  clean: { tone: 'sky', icon: '🧽', hint: 'Pásale la esponja', stat: 'hygiene' },
  sleep: { tone: 'night', icon: '🛏️', hint: 'A la camita', stat: 'energy' },
  wake: { tone: 'sun', icon: '☀️', hint: '¡Buen día!' },
  incubate: { tone: 'ember', icon: '🔥', hint: 'Dale calorcito', stat: 'happiness' },
}

/** Acciones que se hacen a mano (con granos, esponja o juguete) en vez de con un solo toque. */
const TOOL_OF: Partial<Record<ActionId, Tool>> = { feed: 'feed', clean: 'clean', play: 'play' }

/** Cuánto hay que frotar (unidades de la escena) para dejarla limpia, según el tamaño. */
const SCRUB_NEED: Record<string, number> = { egg: 3.4, baby: 4.2, adult: 5.4 }
/** Veces que tiene que atrapar el gusanito para que cuente como jugar. */
const CATCHES = 3

const NAMES = ['Pío', 'Coco', 'Lola', 'Pepa', 'Rulo', 'Mota', 'Canela', 'Chispa']

const statLabel = (pet: Pet, k: StatId) => getStage(pet.species, pet.stage).statLabels?.[k] ?? STAT_LABEL[k]

function needText(pet: Pet) {
  const k = neediest(pet)
  if (pet.stats[k] >= 40) return null
  return getStage(pet.species, pet.stage).needs?.[k] ?? NEED_TEXT[k]
}

/** Cómo se ve un cuidado en esta etapa (la caja del gato se acaricia; el gato come croquetas). */
const careOf = (pet: Pet, a: ActionId): { tone?: string; icon?: string; hint?: string; stat?: StatId; label?: string } | undefined => {
  const own = getStage(pet.species, pet.stage).care?.[a]
  const c = CARE[a]
  return c || own ? { ...c, ...own } : undefined
}

function StatBar({ pet, stat }: { pet: Pet; stat: StatId }) {
  const v = Math.round(pet.stats[stat])
  return (
    <div className={`stat stat-${stat}${v < 30 ? ' low' : ''}`}>
      <span className="stat-icon" aria-hidden>
        {STAT_EMOJI[stat]}
      </span>
      <div className="stat-body">
        <span className="stat-name">
          <span className="stat-label">{statLabel(pet, stat)}</span>
          <b>{v}</b>
        </span>
        <div className="bar" role="progressbar" aria-label={statLabel(pet, stat)} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
          <div className="fill" style={{ width: `${v}%` }} />
        </div>
      </div>
    </div>
  )
}

/** Botón grande de cuidado: ícono en medallón, nombre, qué se hace y cómo va el stat que mejora. */
function CareButton(props: { pet: Pet; action: ActionId; onClick: () => void; label?: string; hint?: string; disabled?: boolean }) {
  const { pet, action, onClick, disabled } = props
  const c = careOf(pet, action)
  const label = props.label ?? c?.label
  const v = c?.stat ? Math.round(pet.stats[c.stat]) : null
  const need = v != null && v < 35
  return (
    <button className={`care tone-${c?.tone ?? 'wheat'}${need ? ' need' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="care-badge" aria-hidden>
        {c?.icon ?? ACTIONS[action].emoji}
        {need && <span className="care-alert">!</span>}
      </span>
      <span className="care-text">
        <strong>{label ?? ACTIONS[action].label}</strong>
        <small>{props.hint ?? c?.hint}</small>
      </span>
      {v != null && (
        <span className="care-meter" aria-hidden>
          <span style={{ width: `${v}%` }} />
        </span>
      )}
    </button>
  )
}

/** Botón grande para prender o apagar la luz del cuarto. */
function LightButton({ hint }: { hint?: string }) {
  const lightsOn = useGame((s) => s.lightsOn)
  const setLights = useGame((s) => s.setLights)
  return (
    <button className={`care tone-${lightsOn ? 'night' : 'sun'}`} onClick={() => (setLights(!lightsOn), play('tap'))}>
      <span className="care-badge" aria-hidden>
        {lightsOn ? '🌙' : '💡'}
      </span>
      <span className="care-text">
        <strong>{lightsOn ? 'Apagar la luz' : 'Prender la luz'}</strong>
        <small>{hint ?? (lightsOn ? 'Para que descanse' : 'Para seguir cuidándola')}</small>
      </span>
    </button>
  )
}

/** Crecimiento ganado, sin redondear a 0 (un cuidado da centésimas). */
const fmtCrece = (n: number) => n.toLocaleString('es-CL', { minimumFractionDigits: n < 1 ? 2 : 0, maximumFractionDigits: 2 })

/** El control de volumen del sitio (juegos/audio/volumen.js) dibujado en la barra de arriba. */
function Volumen() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const w = window as unknown as { VolumenJuego?: { control: (el: HTMLElement) => HTMLElement } }
    const el = ref.current && w.VolumenJuego ? w.VolumenJuego.control(ref.current) : null
    return () => el?.remove()
  }, [])
  return <span className="vol-slot" ref={ref} />
}

/** Sin comida no se puede alimentar: se compran raciones (una ración = un puñado). */
function FoodDialog({ onClose, say }: { onClose: () => void; say: (m: string) => void }) {
  const saldo = useGame((s) => s.saldo)
  const comida = useGame((s) => s.comida)
  const [busy, setBusy] = useState(false)
  const compra = async (n: number) => {
    setBusy(true)
    const err = await useGame.getState().buyFood(n)
    setBusy(false)
    if (err) return play('error'), say(err)
    say(`🌾 Compraste ${n} ${n === 1 ? 'ración' : 'raciones'} de comida`)
    onClose()
  }
  return (
    <div className="modal" role="dialog" aria-label="Comprar comida" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="confirm food-dialog">
        <p>
          🌾 {comida ? `Te quedan ${comida} ${comida === 1 ? 'ración' : 'raciones'}.` : 'No te queda comida.'} Cada ración es un puñado y cuesta 💰 {FOOD_PRICE}. Sirve para
          todas tus mascotas.
        </p>
        <div className="confirm-buttons food-buttons">
          {[1, 5, 10, 25].map((n) => (
            <button key={n} className="primary" disabled={busy || saldo < n * FOOD_PRICE} onClick={() => void compra(n)}>
              ×{n} · 💰 {n * FOOD_PRICE}
            </button>
          ))}
        </div>
        <div className="confirm-buttons">
          <button className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

/** "en ~25 min" / "en ~1,5 h" a partir de horas. */
function inTime(hours: number) {
  const m = Math.ceil(hours * 60)
  return m >= 90 ? `${String(Math.round(m / 6) / 10).replace('.', ',')} h` : `${Math.max(1, m)} min`
}

/** Con la luz apagada solo se puede acostarla o volver a prender la luz. */
function NightCard({ pet, onAction }: { pet: Pet; onAction: (a: ActionId) => void }) {
  const stage = getStage(pet.species, pet.stage)
  const sleeps = stage.actions.includes('sleep')
  const canSleep = sleeps && !pet.asleep && !ACTIONS.sleep.blocked(pet.stats)
  return (
    <div className="sleeping night">
      <p>
        {pet.asleep ? (
          <>
            💤 <strong>{pet.name}</strong> duerme a oscuras. Despierta sola en ~{inTime(hoursToWake(pet, true))}.
            <small> Prende la luz si quieres despertarla antes.</small>
          </>
        ) : canSleep ? (
          <>
            🌙 Está a oscuras. <strong>{pet.name}</strong> puede irse a dormir.
            <small> Para cuidarla, jugar o vestirla, prende la luz.</small>
          </>
        ) : sleeps ? (
          <>
            ☀️ <strong>{pet.name}</strong> ya descansó y despertó con toda la energía.
            <small> Prende la luz para seguir cuidándola.</small>
          </>
        ) : (
          <>
            🌙 Está a oscuras. <small> Prende la luz para cuidar a {pet.name}.</small>
          </>
        )}
      </p>
      <div className="actions">
        {canSleep && <CareButton pet={pet} action="sleep" onClick={() => onAction('sleep')} />}
        <LightButton />
      </div>
    </div>
  )
}

/** Pregunta con sí/no dentro de la app (los cuadros del navegador no funcionan en todas partes). */
export interface Ask {
  text: string
  yes: string
  onYes: () => void
  danger?: boolean
}

function ConfirmDialog({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  return (
    <div className="modal" role="alertdialog" aria-label={ask.text} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="confirm">
        <p>{ask.text}</p>
        <div className="confirm-buttons">
          <button className="pill-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className={ask.danger ? 'pill-btn danger solid' : 'primary'}
            autoFocus
            onClick={() => {
              onClose()
              ask.onYes()
            }}
          >
            {ask.yes}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Bailes puestos en la barra de cuidados (se eligen desde el inventario). */
function DanceBar({ onDance, onMore }: { onDance: (id: string) => void; onMore: () => void }) {
  const items = useGame((s) => s.items)
  const bar = useGame((s) => s.danceBar)
  const dances = bar.map((uid) => items.find((i) => i.uid === uid && i.kind === 'dance')).filter((i): i is Item => !!i)
  return (
    <div className="dances">
      <span className="dances-title">💃 Bailes</span>
      <div className="dance-bar">
        {Array.from({ length: DANCE_BAR }, (_, i) => {
          const d = dances[i]
          const def = d && getDance(d.id)
          return def ? (
            <button key={d.uid} className={`dance-slot${def.rarity ? ' legendary' : ''}`} onClick={() => onDance(d.id)}>
              <DanceIcon id={d.id} size={40} />
              <span>{def.label}</span>
            </button>
          ) : (
            <button key={`empty${i}`} className="dance-slot empty" onClick={onMore} title="Elegir bailes en el inventario">
              <span className="dance-plus">＋</span>
              <span>Elegir</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PetDetail(props: {
  pet: Pet
  onBack: () => void
  onAction: (a: ActionId, dance?: string) => void
  onCare: (a: ActionId) => void
  say: (m: string) => void
  onPotion: () => void
  confirm: (a: Ask) => void
  sell: (t: SellTarget) => void
}) {
  const { pet, onBack, onAction, onCare, say } = props
  const [tab, setTab] = useState<'care' | 'inventory'>('care')
  const [filter, setFilter] = useState<Filter>('all')
  const lightsOn = useGame((s) => s.lightsOn)
  const rename = useGame((s) => s.rename)
  const stage = getStage(pet.species, pet.stage)
  const stages = getSpecies(pet.species).stages
  const next = stages[stages.findIndex((s) => s.id === stage.id) + 1]
  const progress = stage.growthToNext ? Math.min(100, (pet.growth / stage.growthToNext) * 100) : 100

  // "+N 🌱" cuando un cuidado la hace crecer (se ve que el cariño cuenta).
  const [pop, setPop] = useState<{ n: number; key: number } | null>(null)
  const last = useRef({ id: pet.id, stage: pet.stage, growth: pet.growth })
  useEffect(() => {
    const l = last.current
    if (l.id === pet.id && l.stage === pet.stage && pet.growth > l.growth + 0.001) setPop({ n: pet.growth - l.growth, key: Date.now() })
    last.current = { id: pet.id, stage: pet.stage, growth: pet.growth }
  }, [pet.id, pet.stage, pet.growth])
  useEffect(() => {
    if (!pop) return
    const id = window.setTimeout(() => setPop(null), 1400)
    return () => window.clearTimeout(id)
  }, [pop])

  return (
    <section className="panel">
      <div className="panel-top">
        <button className="pill-btn" onClick={onBack} aria-label="Volver al corral">
          ←<span className="back-label"> Corral</span>
        </button>
        <h2 className="pet-name">
          <input
            aria-label="Nombre"
            defaultValue={pet.name}
            maxLength={14}
            onBlur={(e) => rename(pet.id, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span className="stage-tag">{stage.label}</span>
        </h2>
        <div className="panel-actions">
          <button className="pill-btn sell" onClick={() => props.sell({ kind: 'pet', pet })} title={pet.venta ? 'Está a la venta' : 'Vender en el mercado'}>
            {pet.venta ? '🏪' : '💰'}
            <span className="back-label">{pet.venta ? ' En venta' : ' Vender'}</span>
          </button>
          {!pet.venta && (
            <button
              className="pill-btn danger"
              onClick={() =>
                props.confirm({
                  text: `¿Despedirte de ${pet.name}? Se va para siempre y libera su lugar en tu corral. No se puede deshacer.`,
                  yes: 'Despedir',
                  danger: true,
                  onYes: async () => {
                    const err = await useGame.getState().release(pet.id)
                    if (err) return play('error'), say(err)
                    onBack()
                  },
                })
              }
            >
              Despedir
            </button>
          )}
        </div>
      </div>

      <div className="stats">
        {stage.stats.map((k) => (
          <StatBar key={k} pet={pet} stat={k} />
        ))}
        {pet.frozen ? (
          <div className="stat stat-grow frozen">
            <span className="stat-icon" aria-hidden>
              🧪
            </span>
            <span className="stat-name">
              Poción eterna <small className="hint">· se queda {stage.label.toLowerCase()} para siempre</small>
            </span>
          </div>
        ) : next && (
          <div className="stat stat-grow">
            <span className="stat-icon" aria-hidden>
              🌱
            </span>
            <div className="stat-body">
              <span className="stat-name">
                Crece a {next.label.toLowerCase()} <small className="hint">· con cada cuidado</small>
                <button className="potion-btn" onClick={props.onPotion} title="Poción eterna: deja de crecer para siempre">
                  🧪
                </button>
                {pop && (
                  <span key={pop.key} className="grow-pop">
                    +{fmtCrece(pop.n)} 🌱
                  </span>
                )}
              </span>
              <div className="bar">
                <div className="fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {pet.venta ? (
        <div className="sleeping on-sale">
          <p>
            🏪 <strong translate="no">{pet.name}</strong> está a la venta en el mercado. Mientras tanto no se la puede cuidar ni vestir.
          </p>
          <div className="actions">
            <button className="care tone-sun" onClick={() => props.sell({ kind: 'pet', pet })}>
              <span className="care-badge" aria-hidden>
                🏪
              </span>
              <span className="care-text">
                <strong>Retirar del mercado</strong>
                <small>Vuelve a tu corral para cuidarla</small>
              </span>
            </button>
          </div>
        </div>
      ) : !lightsOn ? null : (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'care'} className={tab === 'care' ? 'on' : ''} onClick={() => setTab('care')}>
            💗 Cuidados
          </button>
          <button role="tab" aria-selected={tab === 'inventory'} className={tab === 'inventory' ? 'on' : ''} onClick={() => setTab('inventory')}>
            🎒 Inventario
          </button>
        </div>
      )}

      {pet.venta ? null : !lightsOn ? (
        <NightCard pet={pet} onAction={onAction} />
      ) : tab === 'care' && pet.asleep ? (
        <div className="sleeping">
          <p>
            💤 <strong>{pet.name}</strong> está durmiendo.{' '}
            {hoursToWake(pet, false) * 60 <= 1 ? 'Ya casi despierta.' : `Despierta sola en ~${inTime(hoursToWake(pet, false))}.`}
            <small> Con la luz apagada descansa más rápido.</small>
          </p>
          <div className="actions">
            <LightButton />
            {(() => {
              // Agotada: todavía no se puede despertar; se avisa cuánto falta en vez de un botón que no responde.
              const wait = hoursToWakeable(pet, false)
              return (
                <CareButton
                  pet={pet}
                  action="wake"
                  onClick={() => onAction('wake')}
                  hint={wait > 0 ? `Muy cansada · podrás en ~${inTime(wait)}` : undefined}
                  disabled={wait > 0}
                />
              )
            })()}
          </div>
        </div>
      ) : tab === 'care' ? (
        <div className="actions">
          {stage.actions
            .filter((a) => a !== 'dance')
            .map((a) => (
              <CareButton key={a} pet={pet} action={a} onClick={() => onCare(a)} />
            ))}
          {stage.actions.includes('dance') && (
            <DanceBar onDance={(id) => onAction('dance', id)} onMore={() => (setFilter('dance'), setTab('inventory'))} />
          )}
        </div>
      ) : (
        <InventoryGrid
          pet={pet}
          filter={filter}
          setFilter={setFilter}
          onPick={(item) => {
            const m = applyItem(pet, item)
            if (m) say(m)
          }}
          onSell={(item) => props.sell({ kind: 'item', item })}
        />
      )}
    </section>
  )
}

type Species = (typeof AVAILABLE_SPECIES)[number]

function Corral(props: { pets: Pet[]; onPick: (id: string) => void; onAdopt: (species: Species, name: string) => Promise<boolean> }) {
  const { pets, onPick, onAdopt } = props
  const [adopting, setAdopting] = useState<Species | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const adopciones = useGame((s) => s.adopciones)
  const saldo = useGame((s) => s.saldo)
  const lleno = pets.length >= MM.MAX_MASCOTAS
  const precio = adopciones === 0 ? 0 : MM.PRECIO.adopcion

  const start = (sp: Species) => {
    setName(NAMES[pets.length % NAMES.length])
    setAdopting(sp)
  }
  const confirm = async () => {
    if (!adopting || busy) return
    setBusy(true)
    const ok = await onAdopt(adopting, name)
    setBusy(false)
    if (ok) setAdopting(null)
  }

  return (
    <section className="panel">
      {pets.length === 0 && (
        <p className="empty">{adopciones === 0 ? 'Tu corral está vacío. ¡Adopta tu primera mascota: la primera es gratis!' : 'Tu corral está vacío. Adopta otra mascota o cómprala en el mercado.'}</p>
      )}
      <div className="pet-list">
        {pets.map((p) => {
          const need = needText(p)
          const m = p.asleep ? 'asleep' : mood(p)
          return (
            <button key={p.id} className={`pet-card mood-${m}`} onClick={() => onPick(p.id)}>
              <span className="pet-card-icon" aria-hidden style={petColor(p) ? { boxShadow: `inset 0 -7px 0 ${petColor(p)}` } : undefined}>
                {getStage(p.species, p.stage).emoji}
              </span>
              <span className="pet-card-text">
                <strong translate="no">{p.name}</strong>
                <span>{getStage(p.species, p.stage).label}</span>
                <span className="mood">
                  {p.venta ? '🏪 En venta' : p.asleep ? 'Durmiendo 💤' : need ? <><span translate="no">{p.name}</span> {need}</> : m === 'happy' ? 'Feliz ✨' : 'Tranquilo'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {adopting ? (
        <form
          className="adopt-form"
          onSubmit={(e) => {
            e.preventDefault()
            void confirm()
          }}
        >
          <label>
            ¿Cómo se llamará tu {adopting.name.toLowerCase()}?
            <input autoFocus value={name} maxLength={14} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="adopt-buttons">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Adoptando…' : precio ? `Adoptar · 💰 ${precio.toLocaleString('es-CL')}` : 'Adoptar · gratis'}
            </button>
            <button type="button" className="pill-btn" onClick={() => setAdopting(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="adopt">
          {lleno ? (
            <p className="hint">Tu corral está lleno ({MM.MAX_MASCOTAS} mascotas). Para adoptar otra, vende o despide a una.</p>
          ) : (
            <>
              {AVAILABLE_SPECIES.map((sp) => (
                <button key={sp.id} className="primary" disabled={saldo < precio} onClick={() => start(sp)}>
                  {sp.adopt.emoji} {sp.adopt.label}
                </button>
              ))}
              <p className="hint">
                {precio ? `Adoptar cuesta 💰 ${precio.toLocaleString('es-CL')}` : 'La primera adopción es gratis'} · {pets.length} de {MM.MAX_MASCOTAS} en tu corral
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

/** Color del plumaje de una mascota en su etapa (para la tarjeta del corral). */
function petColor(p: Pet) {
  if (p.coat) return furColors(p.coat, p.stage !== 'adult').base
  if (!p.look) return undefined
  return p.stage === 'egg' ? eggColors(p.look).shell : p.stage === 'baby' ? chickColors(p.look).body : henColors(p.look).body
}

/** Cartel sobre la escena mientras se usa una herramienta: qué hacer, cómo va y para terminar. */
function ToolBanner(props: { tool: Tool; pet: Pet; cleaned: number; caught: number; handfuls: number; onDone: () => void }) {
  const { tool, pet, cleaned, caught, handfuls, onDone } = props
  const comida = useGame((s) => s.comida)
  return (
    <div className={`tool-banner tool-${tool}`} role="status">
      <span className="tool-icon" aria-hidden>
        {tool === 'feed' ? (careOf(pet, 'feed')?.icon ?? '🌾') : tool === 'clean' ? '🧽' : (getSpecies(pet.species).toy?.icon ?? '🐛')}
      </span>
      <div className="tool-text">
        {tool === 'feed' && (
          <>
            <strong>Toca el suelo para lanzarle {getSpecies(pet.species).food}</strong>
            <small>
              {handfuls ? `${handfuls} ${handfuls === 1 ? 'puñado' : 'puñados'} · ¡a comer!` : `${pet.name} está atento…`} · quedan {comida}{' '}
              {comida === 1 ? 'ración' : 'raciones'}
            </small>
          </>
        )}
        {tool === 'clean' && (
          <>
            <strong>Frota a {pet.name} con la esponja</strong>
            <span className="tool-progress">
              <span style={{ width: `${Math.round(cleaned * 100)}%` }} />
            </span>
          </>
        )}
        {tool === 'play' && (
          <>
            <strong>Mueve {getSpecies(pet.species).toy?.name ?? 'el gusanito'}… ¡que lo atrape!</strong>
            <span className="tool-dots" aria-label={`${caught} de ${CATCHES}`}>
              {Array.from({ length: CATCHES }, (_, i) => (
                <span key={i} className={i < caught ? 'on' : ''} />
              ))}
              <small>{caught === 0 ? 'Déjalo quieto cerca para que salte' : 'Muévelo a otro lado'}</small>
            </span>
          </>
        )}
      </div>
      <button className="tool-done" onClick={onDone}>
        Listo
      </button>
    </div>
  )
}

export function App() {
  const listo = useGame((s) => s.listo)
  const pets = useGame((s) => s.pets)
  const coins = useGame((s) => s.saldo)
  const comida = useGame((s) => s.comida)
  const adopt = useGame((s) => s.adopt)
  const act = useGame((s) => s.act)
  const tickAll = useGame((s) => s.tickAll)
  const fps = useGame((s) => s.fps)
  const setFps = useGame((s) => s.setFps)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [gifts, setGifts] = useState(false)
  const [food, setFood] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)
  const muted = useGame((s) => s.muted)
  const setMuted = useGame((s) => s.setMuted)
  const owned = useGame((s) => s.fondos)
  const background = useGame((s) => s.background)
  const setBackground = useGame((s) => s.setBackground)
  const lightsOn = useGame((s) => s.lightsOn)
  const setLights = useGame((s) => s.setLights)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>(0)

  // Herramienta en la mano (granos, esponja, gusanito) y cómo va.
  const [tool, setTool] = useState<Tool | null>(null)
  const [cleaned, setCleaned] = useState(0)
  const [caught, setCaught] = useState(0)
  const [handfuls, setHandfuls] = useState(0)
  const scrubbed = useRef(0)
  const caughtRef = useRef(0)

  // Acomodando muebles (botón ✋ en la escena) y cuál está elegido.
  const [editing, setEditing] = useState(false)
  const [decorSel, setDecorSel] = useState<string | null>(null)
  // Vender (el mercado todavía no existe: solo el botón y el aviso).
  const [selling, setSelling] = useState<SellTarget | null>(null)

  // El tiempo avanza con la app abierta y se pone al día al volver a la pestaña.
  useEffect(() => {
    const id = window.setInterval(() => tickAll(), 10_000)
    const onVisible = () => document.visibilityState === 'visible' && tickAll()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tickAll])

  const say = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  const selected = pets.find((p) => p.id === selectedId) ?? null
  // Al cambiar de mascota, si se duerme o si se apaga la luz, se guarda lo que había en la mano.
  const activeTool = selected && !selected.asleep && lightsOn ? tool : null
  useEffect(() => {
    setTool(null)
    setDecorSel(null)
    setEditing(false)
  }, [selectedId])
  const hasDecor = !!selected?.decor?.length
  const decorating = editing && !!selected && lightsOn && !activeTool && hasDecor
  useEffect(() => {
    if (!decorating) setDecorSel(null)
  }, [decorating])
  useEffect(() => {
    if (!hasDecor || !lightsOn || activeTool) setEditing(false)
  }, [hasDecor, lightsOn, activeTool])
  useEffect(() => {
    if (selected?.asleep || !lightsOn) setTool(null)
  }, [selected?.asleep, lightsOn])

  // Avisa cuando se duerme o despierta sola (no al acostarla o despertarla con el botón).
  const byHand = useRef<ActionId | null>(null)
  const wasAsleep = useRef<{ id: string; asleep: boolean } | null>(null)
  useEffect(() => {
    const prev = wasAsleep.current
    wasAsleep.current = selected ? { id: selected.id, asleep: !!selected.asleep } : null
    if (!selected || !prev || prev.id !== selected.id || prev.asleep === !!selected.asleep) return
    const mine = byHand.current
    byHand.current = null
    if (selected.asleep && mine !== 'sleep') {
      play('error')
      say(`¡${selected.name} se quedó dormida de cansancio! 😴`)
    } else if (!selected.asleep && mine !== 'wake') {
      play('grow')
      say(lightsOn ? `¡${selected.name} despertó con toda la energía! ☀️` : `${selected.name} despertó ☀️ Prende la luz para cuidarla`)
    }
  }, [selected, lightsOn, say])

  /**
   * Hace un cuidado. `cue` cambia la reacción (p. ej. el final del baño tras la esponja) y
   * `react: false` la omite (los granos lanzados ya la hacen caminar a comer). Devuelve si se pudo.
   */
  const perform = (action: ActionId, o: { dance?: string; cue?: CueId; react?: boolean } = {}) => {
    const pet = useGame.getState().pets.find((p) => p.id === selectedId)
    if (!pet) return false
    const before = pet.stage
    const error = act(pet.id, action)
    if (error === SIN_COMIDA) {
      play('error')
      setTool(null)
      setFood(true)
      return false
    }
    if (error) {
      play('error')
      // Dormida no se niega con la cabeza: solo se avisa.
      if (!pet.asleep) setReaction({ petId: pet.id, action, refused: true, key: Date.now(), until: Date.now() + 1500 })
      say(error)
      return false
    }
    if (action === 'sleep' || action === 'wake') byHand.current = action
    play(action === 'dance' ? 'dance' : 'care')
    // La mascota reacciona con su animación (o el baile elegido).
    const d = o.dance ? getDance(o.dance) : undefined
    const duration = (d ? danceSeconds(d) + 0.5 : 4.5) * 1000
    if (action === 'sleep') say(`${pet.name} se acostó. ${lightsOn ? 'Apaga la luz para que descanse mejor 🌙' : 'Dulces sueños 🌙'}`)
    if (o.react !== false) setReaction({ petId: pet.id, action, dance: d?.id, cue: o.cue, key: Date.now(), until: Date.now() + duration })
    const after = useGame.getState().pets.find((p) => p.id === pet.id)
    if (after && after.stage !== before) {
      play('grow')
      say(`¡${after.name} creció! Ahora es ${getStage(after.species, after.stage).label.toLowerCase()} 🎉`)
    }
    return true
  }

  const onAction = (action: ActionId, dance?: string) => void perform(action, { dance })

  /** Botón de cuidado: los que se hacen a mano abren su herramienta (si hace falta hacerlos). */
  const onCare = (action: ActionId) => {
    const t = TOOL_OF[action]
    if (!t || !selected) return onAction(action)
    if (tool === t) return setTool(null)
    // Sin comida, antes de sacar el saco se ofrece comprar.
    if (action === 'feed' && useGame.getState().comida < 1 && !ACTIONS.feed.blocked(selected.stats)) return play('error'), setFood(true)
    tickAll()
    const fresh = useGame.getState().pets.find((p) => p.id === selected.id)
    // Si no hace falta (no tiene hambre, ya está limpia…), se niega como siempre.
    if (!fresh || ACTIONS[action].blocked(fresh.stats)) return onAction(action)
    play('tap')
    scrubbed.current = 0
    caughtRef.current = 0
    setCleaned(0)
    setCaught(0)
    setHandfuls(0)
    setTool(t)
  }

  const onThrow = () => {
    const pet = selected
    if (!pet) return null
    const ok = perform('feed', { react: false })
    if (!ok) {
      setTool(null)
      return false
    }
    setHandfuls((n) => n + 1)
    const after = useGame.getState().pets.find((p) => p.id === pet.id)
    if (after && ACTIONS.feed.blocked(after.stats)) {
      window.setTimeout(() => {
        setTool((t) => (t === 'feed' ? null : t))
        say(`¡${pet.name} quedó satisfecho! 😋`)
      }, 900)
    }
    return true
  }

  const onScrub = (d: number) => {
    if (!selected || tool !== 'clean') return
    const need = SCRUB_NEED[selected.stage] ?? 3.5
    const before = scrubbed.current
    scrubbed.current = Math.min(1, before + d / need)
    if (Math.floor(scrubbed.current * 50) !== Math.floor(before * 50)) setCleaned(scrubbed.current)
    if (before < 1 && scrubbed.current >= 1) {
      setTool(null)
      if (perform('clean', { cue: 'rinse' })) say(`¡${selected.name} quedó reluciente! ✨`)
    }
  }

  const onCatch = () => {
    if (tool !== 'play' || caughtRef.current >= CATCHES) return
    caughtRef.current++
    setCaught(caughtRef.current)
    if (caughtRef.current >= CATCHES) {
      // Deja que termine de sacudir el gusanito y celebra.
      window.setTimeout(() => {
        setTool(null)
        if (perform('play')) say('¡Lo atrapó tres veces! 🎉')
      }, 1100)
    }
  }

  /** Poción eterna: se compra para esta mascota y se le derrama encima en el acto. */
  const onPotion = () => {
    const pet = selected
    if (!pet || pet.frozen) return
    const st = useGame.getState()
    const label = getStage(pet.species, pet.stage).label.toLowerCase()
    if (st.saldo < POTION_PRICE) {
      play('error')
      return say(`La poción eterna cuesta 💰 ${POTION_PRICE.toLocaleString('es-CL')}: te faltan ${(POTION_PRICE - st.saldo).toLocaleString('es-CL')}`)
    }
    setGifts(false)
    setAsk({
      text: `¿Comprar una poción eterna por 💰 ${POTION_PRICE.toLocaleString('es-CL')} y dársela a ${pet.name}? Se quedará ${label} para siempre. No se puede deshacer.`,
      yes: '🧪 Comprar y dársela',
      onYes: async () => {
        const err = await useGame.getState().givePotion(pet.id)
        if (err) {
          play('error')
          return say(err)
        }
        setTool(null)
        setReaction({ petId: pet.id, action: 'clean', cue: 'potion', key: Date.now(), until: Date.now() + 3300 })
        window.setTimeout(() => say(`🧪 ${pet.name} se quedará ${label} para siempre`), 1800)
      },
    })
  }

  const onAdopt = async (species: Species, name: string) => {
    try {
      const id = await adopt(species.id, name)
      play('grow')
      setSelectedId(id)
      return true
    } catch (e) {
      play('error')
      say(e instanceof Error ? e.message : 'No se pudo adoptar')
      return false
    }
  }

  if (!listo)
    return (
      <div className="app cargando">
        <p>{enJuegos ? '🐣 Cargando tu corral…' : '🐣 Mascotas se juega dentro de Juegos.'}</p>
        {!enJuegos && (
          <a className="primary" href="../../juegos.html#mascotas">
            Ir a Juegos
          </a>
        )}
      </div>
    )

  return (
    <div className={`app${selected ? ' focus' : ''}`}>
      <header className="topbar">
        <button className="icon-btn volver" aria-label="Volver a Juegos" title="Volver a Juegos" onClick={() => avisa('volver')}>
          ←
        </button>
        <h1 className="logo">
          <span aria-hidden>🐣</span> <span className="logo-text">Mascotas</span>
        </h1>
        <Volumen />
        <div className="top-right">
          <button
            className="icon-btn"
            aria-label={lightsOn ? 'Apagar la luz' : 'Prender la luz'}
            title={lightsOn ? 'Apagar la luz' : 'Prender la luz'}
            onClick={() => setLights(!lightsOn)}
          >
            {lightsOn ? '💡' : '🌙'}
          </button>
          <button className="icon-btn" aria-label="Regalos" title="Regalos y pociones" onClick={() => setGifts(true)}>
            🎁
          </button>
          <button className="icon-btn" aria-label="Mercado" title="Mercado: comprar y vender mascotas y objetos" onClick={() => avisa('mercado')}>
            🏪
          </button>
          <button
            className={`icon-btn${settingsOpen ? ' on' : ''}`}
            aria-label="Ajustes"
            title="Ajustes"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            ⚙️
          </button>
          <span className="coins" title={`Tus monedas del sitio · comida: ${comida} ${comida === 1 ? 'ración' : 'raciones'}`}>
            <span className="coin" aria-hidden />
            {coins.toLocaleString('es-CL')}
          </span>
        </div>
      </header>

      {settingsOpen && (
        <section className="panel settings">
          <label>
            <span>
              Animación: <strong>{fps} fps</strong>
              <small>{fps <= 15 ? ' (estilo dibujo animado)' : fps >= 55 ? ' (muy fluido)' : ''}</small>
            </span>
            <input type="range" min={FPS_MIN} max={FPS_MAX} step={6} value={fps} onChange={(e) => setFps(Number(e.target.value))} />
          </label>
          <label className="row">
            <span>Sonido</span>
            <button className={`chip${muted ? '' : ' on'}`} onClick={() => setMuted(!muted)}>
              {muted ? '🔇 Silencio' : '🔊 Activado'}
            </button>
          </label>
          <div>
            <span>Fondo</span>
            <div className="chips">
              {BACKGROUNDS.map((b) => {
                const have = isOwned(owned, b.id)
                return (
                  <button
                    key={b.id}
                    className={`chip${background === b.id ? ' on' : ''}`}
                    onClick={async () => {
                      if (!have) {
                        const err = await useGame.getState().buyBackground(b.id)
                        if (err) return play('error'), say(err)
                      }
                      setBackground(b.id)
                    }}
                  >
                    {b.emoji} {b.label}
                    {!have && <span className="price">🔒 {priceOf(b.id)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {gifts && <GiftShop onClose={() => setGifts(false)} say={say} pet={selected} onPotion={onPotion} />}
      {food && <FoodDialog onClose={() => setFood(false)} say={say} />}
      {ask && <ConfirmDialog ask={ask} onClose={() => setAsk(null)} />}
      {selling && <SellDialog target={selling} onClose={() => setSelling(null)} say={say} />}

      <div className="stage-wrap">
        <Scene
          pets={pets}
          selected={selected}
          reaction={reaction}
          onPick={setSelectedId}
          tool={activeTool}
          cleaned={cleaned}
          onThrow={onThrow}
          onScrub={onScrub}
          onCatch={onCatch}
          decorating={decorating}
          decorSel={decorSel}
          onDecorSel={setDecorSel}
          onDecorStored={(id) => say(`📦 ${getDecor(id)?.label ?? 'Listo'} volvió al inventario`)}
        />
        {selected && lightsOn && !activeTool && hasDecor && (
          <button
            className={`edit-btn${decorating ? ' on' : ''}`}
            onClick={() => {
              play('tap')
              setEditing((e) => !e)
            }}
          >
            {decorating ? '✓ Listo' : '✋ Mover muebles'}
          </button>
        )}
        {activeTool && selected && (
          <ToolBanner tool={activeTool} pet={selected} cleaned={cleaned} caught={caught} handfuls={handfuls} onDone={() => setTool(null)} />
        )}
        {toast && (
          <div key={toast} className="toast" role="status">
            {toast}
          </div>
        )}
      </div>

      {selected ? (
        <PetDetail
          pet={selected}
          onBack={() => setSelectedId(null)}
          onAction={onAction}
          onCare={onCare}
          say={say}
          onPotion={onPotion}
          confirm={setAsk}
          sell={setSelling}
        />
      ) : (
        <Corral pets={pets} onPick={setSelectedId} onAdopt={onAdopt} />
      )}

    </div>
  )
}
