import { useState } from 'react'
import { CATALOG, DANCES, SLOT_LABEL, getAccessory, getDance } from '../data/accessories'
import { DECOR, getDecor } from '../data/decor'
import { getStage } from '../data/species'
import { play } from '../audio/sound'
import { isStarter, usedBy, type Item, type ItemKind } from '../game/inventory'
import type { Pet, SlotId } from '../game/types'
import { useGame } from '../store/gameStore'
import { DanceIcon } from './DanceIcon'
import { swatch } from './swatch'
import { useThumb } from './thumbs'

// Inventario: todo lo que se tiene, dibujado tal cual es (con sus colores), y desde ahí se pone:
// la ropa a la mascota, los muebles en su casa y los bailes en la barra de cuidados.

export const KIND_LABEL: Record<ItemKind, string> = { ...SLOT_LABEL, decor: 'Para la casa', dance: 'Baile' }

const KIND_ORDER: ItemKind[] = ['hat', 'outfit', 'shoes', 'boots', 'decor', 'dance']

export type Filter = 'all' | ItemKind
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'hat', label: '🎩 Sombreros' },
  { id: 'outfit', label: '👗 Ropa' },
  { id: 'shoes', label: '👟 Zapatos' },
  { id: 'boots', label: '👢 Botas' },
  { id: 'decor', label: '🛋️ Casa' },
  { id: 'dance', label: '💃 Bailes' },
]

/** Quién puede usar cada prenda. */
const WHO: Record<SlotId, string> = { hat: '', outfit: 'Solo los adultos', shoes: 'Solo los adultos', boots: 'Solo las crías' }

/** Datos de catálogo de un objeto del inventario. */
export function itemDef(item: Item): { label: string; emoji: string; legendary: boolean } | null {
  const d = item.kind === 'decor' ? getDecor(item.id) : item.kind === 'dance' ? getDance(item.id) : getAccessory(item.kind, item.id)
  return d ? { label: d.label, emoji: d.emoji, legendary: 'rarity' in d && d.rarity === 'legendary' } : null
}

/** Orden: por tipo y como el catálogo (lo común primero); las variantes de un mismo objeto juntas. */
export function sortItems(items: Item[]) {
  const order = (i: Item) => {
    const list: { id: string }[] = i.kind === 'decor' ? DECOR : i.kind === 'dance' ? [...DANCES] : CATALOG[i.kind]
    return KIND_ORDER.indexOf(i.kind) * 1000 + list.findIndex((d) => d.id === i.id)
  }
  return [...items].sort((a, b) => order(a) - order(b) || a.tint - b.tint)
}

/** Muestrita de los colores de una variante. */
export function Swatch({ item }: { item: Item }) {
  const cols = swatch(item.kind, item.id, item.tint)
  if (!cols.length) return null
  return (
    <span className="swatch" aria-hidden>
      {cols.map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </span>
  )
}

/** El objeto dibujado (o el ícono del baile). */
export function ItemThumb({ item, size = 64 }: { item: Item; size?: number }) {
  const src = useThumb(item.kind === 'dance' ? null : item)
  if (item.kind === 'dance') return <DanceIcon id={item.id} size={size} />
  return src ? <img src={src} width={size} height={size} alt="" draggable={false} /> : <span className="thumb-wait" style={{ width: size, height: size }} />
}

/**
 * Si el objeto está puesto en esta mascota, si lo usa otra (cada objeto va en una sola a la vez) y
 * si esta etapa lo puede usar.
 */
export function itemState(pet: Pet, item: Item, danceBar: string[], pets: Pet[]) {
  // Lo que está a la venta no lo usa nadie (y una mascota a la venta no se viste).
  if (item.venta) return { on: false, can: false, why: 'En venta', by: undefined }
  if (pet.venta && item.kind !== 'dance') return { on: false, can: false, why: 'Está a la venta', by: undefined }
  if (item.kind === 'dance') return { on: danceBar.includes(item.uid), can: true, why: '', by: undefined }
  const by = usedBy(pets, item)
  const on = by?.id === pet.id
  if (item.kind === 'decor') return { on, can: true, why: '', by }
  const slot = item.kind
  return { on, can: getStage(pet.species, pet.stage).slots.includes(slot), why: WHO[slot], by }
}

/**
 * Pone o saca un objeto del inventario: la ropa en la mascota, el mueble en su casa, el baile en
 * la barra. Si lo tenía otra mascota, se lo pasa. Devuelve el aviso para mostrar (si hay).
 */
export function applyItem(pet: Pet, item: Item): string | null {
  const st = useGame.getState()
  const { on, can, why, by } = itemState(pet, item, st.danceBar, st.pets)
  const d = itemDef(item)
  if (!d) return null
  if (!can) {
    play('error')
    if (item.venta) return `${d.label} está a la venta: retíralo del mercado para usarlo`
    if (pet.venta) return `${pet.name} está a la venta: retírala del mercado para vestirla`
    return `${why} pueden usar ${d.label.toLowerCase()}`
  }
  if (item.kind === 'dance') {
    const out = st.toggleDance(item.uid)
    play(on ? 'tap' : 'pop')
    if (on) return null
    const dances = getStage(pet.species, pet.stage).actions.includes('dance')
    if (out) return `${d.label} entró a la barra de bailes (salió ${itemDef(out)?.label ?? 'otro'})`
    return dances ? `${d.label} está en la barra de bailes 💃` : `${d.label} está en la barra (bailan los adultos)`
  }
  const from = by && !on ? by : undefined
  if (item.kind === 'decor') {
    if (on) {
      st.removeDecor(pet.id, item.id)
      play('tap')
      return `📦 ${d.label} volvió al inventario`
    }
    st.placeDecor(pet.id, item.uid)
    play('pop')
    return from ? `🏠 ${d.label} se mudó de la casa de ${from.name}` : `🏠 ${d.label} está en la casa · ✋ para moverlo`
  }
  st.equip(pet.id, item.kind, on ? null : item.uid)
  play(on ? 'tap' : 'pop')
  return from ? `Se lo pasaste a ${pet.name} (lo tenía ${from.name})` : null
}

/** Grilla de objetos: toca uno para ponerlo o sacarlo. */
export function InventoryGrid(props: {
  pet: Pet
  filter: Filter
  setFilter?: (f: Filter) => void
  /** Solo un tipo (la pestaña Casa). */
  only?: ItemKind
  onPick: (item: Item) => void
  /** Objeto marcado (el mueble elegido en la escena). */
  picked?: (item: Item) => boolean
  /** Vender: con esto aparece el botón 💰 y, prendido, tocar un objeto lo ofrece en el mercado. */
  onSell?: (item: Item) => void
}) {
  const { pet, only } = props
  const items = useGame((s) => s.items)
  const danceBar = useGame((s) => s.danceBar)
  const pets = useGame((s) => s.pets)
  const [selling, setSelling] = useState(false)
  const onPick = selling && props.onSell ? props.onSell : props.onPick
  const filter = only ?? props.filter
  const kinds = new Set(items.map((i) => i.kind))
  const list = sortItems(filter === 'all' ? items : items.filter((i) => i.kind === filter))
  return (
    <div className="inventory">
      {!only && props.setFilter && (
        <div className="chips inv-filters" role="tablist">
          {FILTERS.filter((f) => f.id === 'all' || kinds.has(f.id)).map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={`chip${filter === f.id ? ' on' : ''}`} onClick={() => props.setFilter!(f.id)}>
              {f.label}
            </button>
          ))}
          {props.onSell && (
            <button className={`chip sell-chip${selling ? ' on' : ''}`} onClick={() => setSelling((x) => !x)} aria-pressed={selling}>
              💰 Vender
            </button>
          )}
        </div>
      )}
      {selling && <p className="hint sell-hint">💰 Toca lo que quieras vender. Lo inicial (gorro, botas, suéter, zapatillas y los bailes básicos) no se vende.</p>}
      {list.length ? (
        <div className={`inv-grid${selling ? ' selling' : ''}`}>
          {list.map((item) => {
            const d = itemDef(item)
            if (!d) return null
            const s = itemState(pet, item, danceBar, pets)
            const other = s.by && !s.on ? s.by : undefined
            const picked = props.picked?.(item)
            // Los iniciales no se venden: no tienen copia en la economía.
            const fijo = selling && isStarter(item)
            return (
              <button
                key={item.uid}
                className={`inv-cell${s.on ? ' on' : ''}${picked ? ' picked' : ''}${d.legendary ? ' legendary' : ''}${s.can && !fijo ? '' : ' off'}`}
                onClick={() => (fijo ? (play('error'), undefined) : onPick(item))}
                title={`${d.label}${d.legendary ? ' · Legendario' : ''}`}
              >
                <span className="inv-thumb">
                  <ItemThumb item={item} />
                </span>
                <span className="inv-name">{d.label}</span>
                {s.on && <span className="inv-badge">{item.kind === 'dance' ? 'En la barra' : item.kind === 'decor' ? 'En la casa' : 'Puesto'}</span>}
                {fijo ? <span className="inv-who">Inicial · no se vende</span> : !s.can && <span className="inv-who">{s.why}</span>}
                {other && <span className="inv-badge other">Lo usa {other.name}</span>}
                {d.legendary && (
                  <span className="inv-star" aria-label="Legendario">
                    ★
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="hint">{filter === 'decor' ? 'Todavía no tienes cosas para la casa.' : 'Todavía no tienes de esto.'} Ábrelas en 🎁 regalos.</p>
      )}
    </div>
  )
}
