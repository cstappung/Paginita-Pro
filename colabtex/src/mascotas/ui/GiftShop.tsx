import { useRef, useState } from 'react'
import { play } from '../audio/sound'
import { GIFT_PRICE, LEGENDARY_CHANCE, POTION_PRICE, giftPool } from '../game/inventory'
import { getDance } from '../data/accessories'
import type { Pet } from '../game/types'
import { useGame } from '../store/gameStore'
import { GiftReveal, type Opening } from './GiftReveal'
import { DanceIcon } from './DanceIcon'
import { KIND_LABEL, Swatch, applyItem, itemDef, itemState } from './Inventory'

const USE_LABEL = { dance: 'A la barra de bailes', decor: 'Ponerlo en la casa', wear: 'Ponérselo' }

/** Regalos (la forma de conseguir cosméticos) y la poción eterna. Se pagan con las monedas del sitio. */
export function GiftShop({ onClose, say, pet, onPotion }: { onClose: () => void; say: (m: string) => void; pet: Pet | null; onPotion: () => void }) {
  const coins = useGame((s) => s.saldo)
  const items = useGame((s) => s.items)
  const danceBar = useGame((s) => s.danceBar)
  const pets = useGame((s) => s.pets)
  const [opening, setOpening] = useState<Opening | null>(null)
  const [phase, setPhase] = useState<'idle' | 'opening' | 'popped' | 'shown'>('idle')
  // Esperando que la compra llegue a la base (lo que trae sale de ahí).
  const [paying, setPaying] = useState(false)
  const skip = useRef(0)

  const open = async () => {
    if (phase === 'opening' || phase === 'popped') return void (skip.current = 1)
    if (paying) return
    setPaying(true)
    play('tap')
    const r = await useGame.getState().openGift()
    setPaying(false)
    if (typeof r === 'string') {
      play('error')
      return say(r)
    }
    setOpening({ ...r, key: Date.now(), inPlace: phase === 'idle' })
    setPhase('opening')
  }
  const kinds = new Set(items.map((i) => `${i.kind}:${i.id}`)).size
  const got = phase === 'shown' ? opening : null
  const def = got && itemDef(got.item)
  const state = got && pet ? itemState(pet, got.item, danceBar, pets) : null
  // El baile lo muestra una mascota tuya (de la especie de la que estás mirando).
  const dancer = pet ?? pets.find((p) => p.stage === 'adult') ?? pets[0]
  return (
    <div className="modal" role="dialog" aria-label="Regalos" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gift-shop">
        <div className="mg-head">
          <span>🎁 Regalos</span>
          <button className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div
          className={`gift-stage ${phase}${opening?.legendary && phase !== 'idle' && phase !== 'opening' ? ' legendary' : ''}`}
          onClick={() => (phase === 'idle' ? void open() : phase === 'opening' && (skip.current = 1))}
        >
          <span className="gift-rays" aria-hidden />
          <GiftReveal opening={opening} species={dancer?.species} look={dancer?.look ?? dancer?.coat} skip={skip} onPop={() => setPhase('popped')} onShown={() => setPhase('shown')} />
          {phase === 'idle' && <span className="gift-tap">{paying ? 'Pagando…' : 'Toca la caja para abrirla'}</span>}
          {got && def && (
            <div className="gift-result">
              {got.legendary && <b className="gift-legend">★ Legendario</b>}
              <span className="gift-name">
                {got.item.kind === 'dance' && <DanceIcon id={got.item.id} size={34} />}
                <strong>{def.label}</strong>
              </span>
              <span className="gift-kind">
                {KIND_LABEL[got.item.kind]}
                {got.item.kind === 'dance' && ` · ${getDance(got.item.id)?.bpm ?? ''} bpm`}
              </span>
              <Swatch item={got.item} />
            </div>
          )}
        </div>
        <div className="gift-buttons">
          <button className="primary" onClick={() => void open()} disabled={paying || phase === 'opening' || phase === 'popped'}>
            {paying ? 'Pagando…' : phase === 'idle' ? 'Abrir regalo' : 'Abrir otro'} · 💰 {GIFT_PRICE}
          </button>
          {got && pet && state && state.can && !state.on && (
            <button
              className="pill-btn"
              onClick={() => {
                const m = applyItem(pet, got.item)
                if (m) say(m)
              }}
            >
              {got.item.kind === 'dance' ? USE_LABEL.dance : got.item.kind === 'decor' ? USE_LABEL.decor : USE_LABEL.wear}
            </button>
          )}
          {got && state?.on && <span className="hint">✓ {got.item.kind === 'dance' ? 'En la barra' : got.item.kind === 'decor' ? 'En la casa' : 'Puesto'}</span>}
        </div>
        <p className="hint">
          Trae ropa, calzado, sombreros, cosas para la casa o bailes, en colores al azar. Legendario: {Math.round(LEGENDARY_CHANCE * 100)} %. Tienes {coins.toLocaleString('es-CL')} monedas.
        </p>
        <div className="potion-row">
          <span className="potion-icon" aria-hidden>
            🧪
          </span>
          <span className="potion-text">
            <strong>Poción eterna</strong>
            <small>
              Tu mascota deja de crecer y se queda así para siempre (también el huevo). Se compra para una mascota y se le da al tiro.
              {!pet && ' Ábrela desde la ficha de una mascota (🧪 junto al crecimiento).'}
            </small>
          </span>
          {pet && !pet.frozen && (
            <button className="pill-btn" onClick={onPotion}>
              💰 {POTION_PRICE}
            </button>
          )}
        </div>
        <p className="hint">
          Colección: {kinds} de {giftPool().length} objetos distintos · {items.length} en total.
        </p>
      </div>
    </div>
  )
}
