import { useState } from 'react'
import { getStage } from '../data/species'
import type { Item } from '../game/inventory'
import { isStarter, usedBy } from '../game/inventory'
import type { Pet } from '../game/types'
import { play } from '../audio/sound'
import { useGame } from '../store/gameStore'
import { avisa } from '../store/red'
import { ItemThumb, Swatch, itemDef } from './Inventory'

// Vender en el mercado del sitio (la pestaña 🏪 Mercado de Juegos, común con PRODROP). Aquí se
// publica la mascota o el objeto con su precio; comprar, ver las ofertas y los intercambios se hace
// en el mercado. Mientras está a la venta nadie lo usa: la mascota no se cuida ni se viste, y lo que
// llevaba puesto vuelve a tu inventario al publicarla.

/** Lo que se quiere vender. */
export type SellTarget = { kind: 'pet'; pet: Pet } | { kind: 'item'; item: Item }

const PRECIO_MAX = 100000

export function SellDialog({ target, onClose, say }: { target: SellTarget; onClose: () => void; say: (m: string) => void }) {
  const pets = useGame((s) => s.pets)
  const parada = useGame((s) => s.parada)
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const name = target.kind === 'pet' ? target.pet.name : (itemDef(target.item)?.label ?? 'Objeto')
  const by = target.kind === 'item' ? usedBy(pets, target.item) : undefined
  const venta = target.kind === 'pet' ? target.pet.venta : target.item.venta
  const fijo = target.kind === 'item' && isStarter(target.item)
  const c = target.kind === 'pet' ? target.pet.id : target.item.uid
  const p = Math.round(Number(price))
  const valido = p >= 1 && p <= PRECIO_MAX

  const publicar = async () => {
    if (!valido || busy) return
    setBusy(true)
    const err = await useGame.getState().sell(c, p)
    setBusy(false)
    if (err) {
      play('error')
      return say(err)
    }
    play('buy')
    say(`🏪 ${name} quedó a la venta por ${p.toLocaleString('es-CL')} monedas`)
    onClose()
  }
  const retirar = async () => {
    if (!venta || busy) return
    setBusy(true)
    const err = await useGame.getState().withdraw(venta)
    setBusy(false)
    if (err) {
      play('error')
      return say(err)
    }
    play('tap')
    say(`${name} ya no está a la venta`)
    onClose()
  }

  return (
    <div className="modal" role="dialog" aria-label={`Vender ${name}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="confirm sell-dialog">
        <div className="sell-head">
          <span className="sell-thumb">
            {target.kind === 'pet' ? <span className="sell-emoji">{getStage(target.pet.species, target.pet.stage).emoji}</span> : <ItemThumb item={target.item} size={72} />}
          </span>
          <span className="sell-name">
            <strong translate="no">{name}</strong>
            {target.kind === 'pet' ? <small>{getStage(target.pet.species, target.pet.stage).label}{target.pet.frozen ? ' · 🧪 eterna' : ''}</small> : <Swatch item={target.item} />}
            {by && !venta && <small>Lo usa <span translate="no">{by.name}</span></small>}
          </span>
        </div>
        {fijo ? (
          <p>Lo inicial no se vende: todo el mundo lo tiene desde el principio.</p>
        ) : venta ? (
          <p>🏪 Está a la venta en el mercado. Mientras tanto nadie lo puede usar{target.kind === 'pet' ? ' ni cuidar' : ''}.</p>
        ) : parada ? (
          <p>Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes vender.</p>
        ) : (
          <>
            <p>
              🏪 Se publica en el mercado de Juegos, donde cualquiera puede comprarlo.{' '}
              {target.kind === 'pet'
                ? 'Lo que lleva puesto vuelve a tu inventario, y viaja con su etapa, su crecimiento y sus colores.'
                : by
                  ? `Se le saca a ${by.name}.`
                  : ''}
            </p>
            <label className="sell-price">
              <span>Precio</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={PRECIO_MAX}
                step={1}
                placeholder="Monedas"
                value={price}
                autoFocus
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void publicar()}
              />
            </label>
          </>
        )}
        <div className="confirm-buttons">
          <button className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          {venta ? (
            <>
              <button className="pill-btn" onClick={() => avisa('mercado')}>
                Ver el mercado
              </button>
              <button className="primary" disabled={busy} onClick={() => void retirar()}>
                Retirar
              </button>
            </>
          ) : (
            !fijo &&
            !parada && (
              <button className="primary" disabled={!valido || busy} onClick={() => void publicar()}>
                💰 {busy ? 'Publicando…' : 'Publicar en el mercado'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
