import { create } from 'zustand'
import { FPS_DEFAULT, FPS_MAX, FPS_MIN } from '../game/config'
import { play, setMuted } from '../audio/sound'
import { isOwned, priceOf } from '../game/shop'
import { DANCE_BAR, defaultDanceBar, onlyUsable, starterItems, takeFromOthers, toggleDance, type Item } from '../game/inventory'
import { applyAction, equip, tick } from '../game/rules'
import { moveDecor, placeDecor, removeDecor, rotateDecor } from '../game/decor'
import { aEstado, claveEstado, desdeEstado, type Adopcion, type Estado } from '../game/estado'
import type { ActionId, Pet, SlotId, SpeciesId } from '../game/types'
import MM from '../../../../juegos/mascotas/motor.js'
import { pide } from './red'

// El estado del juego dentro de Juegos. No hay guardado local de la partida: lo que vale dinero
// (mascotas, objetos, comida, fondos) lo dice la economía del sitio y llega con `recibe`; el estado
// de cada mascota (etapa, stats, lo que lleva puesto) se guarda en `mascotasEstado` a través del
// cartero, en cada acción y con un respiro (`GUARDA_MS`), nunca en cada tick. Las preferencias que
// importan entre dispositivos (luz, fondo, barra de bailes) van a `users/<uid>/mascotas`; los cuadros
// por segundo y el silencio quedan en este navegador.

/** Respiro entre dos guardados de la misma mascota. */
const GUARDA_MS = 4000
/** Aviso que devuelve `act` cuando no queda comida (la UI ofrece comprar). */
export const SIN_COMIDA = 'SIN_COMIDA'

export interface Datos {
  uid: string
  saldo: number
  parada: boolean
  falta: number
  mascotas: (Omit<Adopcion, 'semilla'> & { estado: Partial<Estado> | null })[]
  objetos: { c: string; kind: Item['kind']; id: string; tint: number; leg: boolean; venta: string }[]
  comida: number
  fondos: string[]
  adopciones: number
  prefs: { luz?: boolean; fondo?: string; barra?: string[] }
}

interface GameState {
  /** Ya llegaron los datos de la cuenta. */
  listo: boolean
  uid: string
  saldo: number
  /** La cuenta tiene un gasto sin fondos: hasta ponerse al día no puede gastar. */
  parada: boolean
  falta: number
  pets: Pet[]
  /** Inventario: lo inicial más lo que salió de regalos (o se compró en el mercado). */
  items: Item[]
  /** Raciones de comida que quedan. */
  comida: number
  /** Fondos comprados (la pradera es gratis). */
  fondos: string[]
  /** Adopciones válidas de la cuenta (la primera es gratis). */
  adopciones: number
  /** Cuadros por segundo de la animación (entre FPS_MIN y FPS_MAX). */
  fps: number
  /** Bailes puestos en la barra de cuidados (uids del inventario). */
  danceBar: string[]
  background: string
  muted: boolean
  /** Luz del cuarto: apagada, duermen más rápido (y la escena se pone de noche). */
  lightsOn: boolean
  recibe: (d: Datos) => void
  setLights: (on: boolean) => void
  setMuted: (m: boolean) => void
  setBackground: (id: string) => void
  /** Compra un fondo. Devuelve null si se pudo, o el motivo. */
  buyBackground: (id: string) => Promise<string | null>
  /** Abre un regalo: devuelve lo que salió, o el motivo si no se pudo. */
  openGift: () => Promise<{ item: Item; legendary: boolean } | string>
  /** Compra raciones de comida. Devuelve null si se pudo, o el motivo. */
  buyFood: (n: number) => Promise<string | null>
  /** Compra la poción eterna para una mascota y se la da. Devuelve null si se pudo, o el motivo. */
  givePotion: (id: string) => Promise<string | null>
  /** Pone o saca un baile de la barra. Devuelve el que salió para hacerle lugar (si salió alguno). */
  toggleDance: (uid: string) => Item | null
  setFps: (fps: number) => void
  /** Adopta una mascota (la primera, gratis). Devuelve su id, o lanza el motivo. */
  adopt: (species: SpeciesId, name: string) => Promise<string>
  rename: (id: string, name: string) => void
  /** Se despide de una mascota (sale de la cuenta y libera su cupo). */
  release: (id: string) => Promise<string | null>
  /** Aplica una acción de cuidado. Devuelve null si se pudo, o el motivo si no. */
  act: (id: string, action: ActionId) => string | null
  /** Pone (un objeto del inventario, por uid) o quita (null) un accesorio. */
  equip: (id: string, slot: SlotId, uid: string | null) => void
  placeDecor: (id: string, uid: string) => void
  moveDecor: (id: string, item: string, x: number, z: number) => void
  rotateDecor: (id: string, item: string) => void
  removeDecor: (id: string, item: string) => void
  /** Avanza el tiempo de todas las mascotas (también al volver a la pestaña). */
  tickAll: (now?: number) => void
  /** Publica en el mercado una mascota o un objeto. Devuelve null si se pudo, o el motivo. */
  sell: (c: string, price: number) => Promise<string | null>
  /** Retira del mercado una oferta propia. */
  withdraw: (offer: string) => Promise<string | null>
}

const leeLocal = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d
  } catch {
    return d
  }
}
const ponLocal = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* sin almacenamiento */
  }
}

/* ---------- guardado del estado de cada mascota ---------- */
const sucias = new Set<string>()
const ultimo = new Map<string, number>()
let reloj = 0
function guarda(id: string) {
  sucias.add(id)
  programa()
}
function programa() {
  if (reloj) return
  const ahora = Date.now()
  const espera = Math.max(0, ...[...sucias].map((id) => (ultimo.get(id) ?? 0) + GUARDA_MS - ahora))
  reloj = window.setTimeout(vacia, espera)
}
function vacia() {
  reloj = 0
  const pets = useGame.getState().pets
  for (const id of [...sucias]) {
    sucias.delete(id)
    const p = pets.find((x) => x.id === id)
    if (!p || p.venta) continue
    ultimo.set(id, Date.now())
    pide('estado', { k: claveEstado(id), estado: aEstado(p) }).catch((e) => console.warn('[mascotas] no se guardó', id, e))
  }
}
/** Guarda ya lo pendiente (al ocultar la pestaña o antes de vender). */
export function guardaYa() {
  window.clearTimeout(reloj)
  reloj = 0
  if (sucias.size) vacia()
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && guardaYa())
  window.addEventListener('pagehide', guardaYa)
}

let prefsReloj = 0
function guardaPrefs() {
  window.clearTimeout(prefsReloj)
  prefsReloj = window.setTimeout(() => {
    const s = useGame.getState()
    pide('prefs', { prefs: { luz: s.lightsOn, fondo: s.background, barra: s.danceBar } }).catch(() => {})
  }, 800)
}

/** Raciones gastadas que el cartero todavía no confirma (para no mostrar comida de más). */
let comiendo = 0
/** El nombre de una mascota que se está adoptando (llega antes que su estado). */
let nombrePendiente = ''

const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e || 'No se pudo.'))

export const useGame = create<GameState>()((set, get) => ({
  listo: false,
  uid: '',
  saldo: 0,
  parada: false,
  falta: 0,
  pets: [],
  items: starterItems(),
  comida: 0,
  fondos: [],
  adopciones: 0,
  fps: Math.min(FPS_MAX, Math.max(FPS_MIN, Number(leeLocal('mascotas.fps', String(FPS_DEFAULT))) || FPS_DEFAULT)),
  danceBar: defaultDanceBar(starterItems()),
  background: 'meadow',
  muted: leeLocal('mascotas.mudo', '0') === '1',
  lightsOn: true,

  recibe: (d) => {
    const now = Date.now()
    const items: Item[] = [
      ...starterItems(),
      ...d.objetos.map((o) => ({ uid: o.c, kind: o.kind, id: o.id, tint: o.tint, ...(o.leg ? { leg: true } : {}), ...(o.venta ? { venta: o.venta } : {}) })),
    ]
    const antes = get()
    const pets = d.mascotas.map((m) => {
      const local = antes.pets.find((p) => p.id === m.c)
      const ls = Number.isFinite(m.estado?.ls) ? (m.estado!.ls as number) : -1
      const a: Adopcion = { ...m, semilla: MM.semillaGenes(m.o, m.k, m.at) }
      let p = local && (local.lastSeen >= ls || sucias.has(m.c)) ? local : desdeEstado(a, m.estado, items, now)
      if (!m.estado && !local && nombrePendiente) p = { ...p, name: nombrePendiente }
      p = { ...p, frozen: m.frozen || undefined, venta: m.venta || undefined }
      // Lo vendido o puesto a la venta ya no lo lleva nadie.
      const limpia = onlyUsable(p, items)
      const cambio = JSON.stringify([limpia.wear, limpia.decor]) !== JSON.stringify([p.wear, p.decor])
      if (!m.venta && (!m.estado || cambio)) guarda(m.c)
      return limpia
    })
    const barra = (d.prefs.barra ?? defaultDanceBar(items)).filter((u) => items.some((i) => i.uid === u && i.kind === 'dance' && !i.venta)).slice(0, DANCE_BAR)
    const fondos = d.fondos ?? []
    const fondo = d.prefs.fondo && isOwned(fondos, d.prefs.fondo) ? d.prefs.fondo : antes.listo ? antes.background : 'meadow'
    set({
      listo: true,
      uid: d.uid,
      saldo: d.saldo,
      parada: d.parada,
      falta: d.falta,
      pets,
      items,
      comida: Math.max(0, d.comida - comiendo),
      fondos,
      adopciones: d.adopciones,
      danceBar: barra.length || d.prefs.barra ? barra : defaultDanceBar(items),
      background: antes.listo ? antes.background : fondo,
      lightsOn: antes.listo ? antes.lightsOn : d.prefs.luz !== false,
    })
  },

  // Antes de cambiar la luz se cierra el tramo de tiempo con la luz que había.
  setLights: (on) => {
    get().tickAll()
    for (const p of get().pets) guarda(p.id)
    set({ lightsOn: on })
    guardaPrefs()
  },
  setMuted: (muted) => {
    setMuted(muted)
    ponLocal('mascotas.mudo', muted ? '1' : '0')
    set({ muted })
  },
  setBackground: (id) => {
    if (!isOwned(get().fondos, id)) return
    set({ background: id })
    guardaPrefs()
  },
  buyBackground: async (id) => {
    const p = priceOf(id)
    if (p === null) return 'No existe ese fondo'
    if (isOwned(get().fondos, id)) return null
    if (get().saldo < p) return `Te faltan ${p - get().saldo} monedas`
    try {
      await pide('fondo', { id })
      set((s) => ({ fondos: [...s.fondos, id] }))
      play('buy')
      return null
    } catch (e) {
      return motivo(e)
    }
  },
  openGift: async () => {
    if (get().saldo < MM.PRECIO.regalo) return `Te faltan ${MM.PRECIO.regalo - get().saldo} monedas`
    try {
      const r = await pide<{ c: string; kind: Item['kind']; id: string; tint: number; leg: boolean }>('regalo')
      const item: Item = { uid: r.c, kind: r.kind, id: r.id, tint: r.tint, ...(r.leg ? { leg: true } : {}) }
      set((s) => ({ items: s.items.some((i) => i.uid === item.uid) ? s.items : [...s.items, item] }))
      return { item, legendary: r.leg }
    } catch (e) {
      return motivo(e)
    }
  },
  buyFood: async (n) => {
    const p = MM.PRECIO.comida * n
    if (get().saldo < p) return `Te faltan ${p - get().saldo} monedas`
    try {
      await pide('comida', { n })
      set((s) => ({ comida: s.comida + n }))
      play('buy')
      return null
    } catch (e) {
      return motivo(e)
    }
  },
  givePotion: async (id) => {
    const pet = get().pets.find((p) => p.id === id)
    if (!pet) return 'No existe esa mascota'
    if (pet.frozen) return 'Ya tomó la poción'
    if (pet.venta) return 'Está a la venta: retírala del mercado primero'
    if (get().saldo < MM.PRECIO.pocion) return `La poción eterna cuesta 💰 ${MM.PRECIO.pocion}: te faltan ${MM.PRECIO.pocion - get().saldo}`
    try {
      get().tickAll()
      guarda(id)
      guardaYa()
      await pide('pocion', { m: id })
      set((s) => ({ pets: s.pets.map((p) => (p.id === id ? { ...p, frozen: true } : p)) }))
      return null
    } catch (e) {
      return motivo(e)
    }
  },
  toggleDance: (uid) => {
    const usable = get().items.filter((i) => !i.venta)
    const r = toggleDance(get().danceBar, usable, uid)
    set({ danceBar: r.bar })
    guardaPrefs()
    return r.out ?? null
  },
  setFps: (fps) => {
    const v = Math.min(FPS_MAX, Math.max(FPS_MIN, Math.round(fps)))
    ponLocal('mascotas.fps', String(v))
    set({ fps: v })
  },

  adopt: async (species, name) => {
    nombrePendiente = name.trim() || 'Sin nombre'
    try {
      const r = await pide<{ c: string }>('adoptar', { e: species })
      // Llega antes o después que los datos: en los dos casos se queda con el nombre elegido.
      get().rename(r.c, nombrePendiente)
      return r.c
    } finally {
      nombrePendiente = ''
    }
  },

  rename: (id, name) => {
    const n = name.trim().slice(0, 24)
    if (!n) return
    set((s) => ({ pets: s.pets.map((p) => (p.id === id ? { ...p, name: n } : p)) }))
    guarda(id)
  },

  release: async (id) => {
    const pet = get().pets.find((p) => p.id === id)
    if (!pet) return 'No existe esa mascota'
    if (pet.venta) return 'Está a la venta: retírala del mercado primero'
    try {
      sucias.delete(id)
      await pide('adios', { m: id })
      set((s) => ({ pets: s.pets.filter((p) => p.id !== id) }))
      return null
    } catch (e) {
      return motivo(e)
    }
  },

  act: (id, action) => {
    const pet = get().pets.find((p) => p.id === id)
    if (!pet) return 'No existe esa mascota'
    if (pet.venta) return 'Está a la venta: retírala del mercado para cuidarla'
    if (action === 'feed' && get().comida < 1) return SIN_COMIDA
    // Primero se pone al día el tiempo, para que la acción actúe sobre los stats reales.
    const dark = !get().lightsOn
    const fresh = tick(pet, Date.now(), dark)
    const result = applyAction(fresh, action, dark)
    if (!result.ok) return result.reason ?? 'No se pudo'
    set((s) => ({ pets: s.pets.map((p) => (p.id === id ? result.pet : p)), comida: action === 'feed' ? s.comida - 1 : s.comida }))
    guarda(id)
    if (action === 'feed') {
      comiendo++
      pide('comer', { n: 1 })
        .catch((e) => console.warn('[mascotas] no se anotó la ración', e))
        .finally(() => void (comiendo = Math.max(0, comiendo - 1)))
    }
    return null
  },

  // Cada objeto en una sola mascota a la vez: ponérselo a una se lo saca a la otra.
  equip: (id, slot, uid) => {
    const s = get()
    const it = uid === null ? null : s.items.find((i) => i.uid === uid && i.kind === slot && !i.venta)
    if (uid !== null && !it) return
    if (s.pets.find((p) => p.id === id)?.venta) return
    const pets = it ? takeFromOthers(s.pets, it, id) : s.pets
    set({ pets: pets.map((p) => (p.id === id ? equip(p, slot, it ?? null) : p)) })
    for (const p of pets) if (p !== s.pets.find((q) => q.id === p.id) || p.id === id) guarda(p.id)
  },

  placeDecor: (id, uid) => {
    const s = get()
    const it = s.items.find((i) => i.uid === uid && i.kind === 'decor' && !i.venta)
    if (!it || s.pets.find((p) => p.id === id)?.venta) return
    const pets = takeFromOthers(s.pets, it, id)
    set({ pets: pets.map((p) => (p.id === id ? placeDecor(p, it.id, it.tint, it.uid) : p)) })
    for (const p of pets) if (p !== s.pets.find((q) => q.id === p.id) || p.id === id) guarda(p.id)
  },
  moveDecor: (id, item, x, z) => {
    set((s) => ({ pets: s.pets.map((p) => (p.id === id ? moveDecor(p, item, x, z) : p)) }))
    guarda(id)
  },
  rotateDecor: (id, item) => {
    set((s) => ({ pets: s.pets.map((p) => (p.id === id ? rotateDecor(p, item) : p)) }))
    guarda(id)
  },
  removeDecor: (id, item) => {
    set((s) => ({ pets: s.pets.map((p) => (p.id === id ? removeDecor(p, item) : p)) }))
    guarda(id)
  },

  tickAll: (now = Date.now()) => set((s) => ({ pets: s.pets.map((p) => tick(p, now, !s.lightsOn)) })),

  sell: async (c, price) => {
    const s = get()
    const p = Math.round(price)
    if (!(p >= 1 && p <= 100000)) return 'El precio va de 1 a 100.000 monedas'
    const pet = s.pets.find((x) => x.id === c)
    const item = s.items.find((i) => i.uid === c)
    if (!pet && (!item || item.uid.startsWith('start-'))) return 'Eso no se puede vender'
    if ((pet ?? item)!.venta) return 'Ya está a la venta'
    // Lo que se vende deja de usarse: la mascota se saca lo puesto (vuelve a tu inventario) y el
    // objeto sale de la mascota que lo llevaba.
    if (pet) {
      set((st) => ({ pets: st.pets.map((x) => (x.id === c ? { ...x, wear: {}, decor: [] } : x)), danceBar: st.danceBar }))
      guarda(c)
    } else if (item) {
      const pets = takeFromOthers(s.pets, item, '')
      set({ pets, danceBar: s.danceBar.filter((u) => u !== c) })
      for (const x of pets) if (x !== s.pets.find((q) => q.id === x.id)) guarda(x.id)
    }
    guardaYa()
    try {
      const id = await pide<string>('vender', { c, p })
      set((st) => ({
        pets: st.pets.map((x) => (x.id === c ? { ...x, venta: id } : x)),
        items: st.items.map((i) => (i.uid === c ? { ...i, venta: id } : i)),
      }))
      return null
    } catch (e) {
      return motivo(e)
    }
  },
  withdraw: async (offer) => {
    try {
      await pide('retirar', { id: offer })
      set((st) => ({
        pets: st.pets.map((x) => (x.venta === offer ? { ...x, venta: undefined } : x)),
        items: st.items.map((i) => (i.venta === offer ? { ...i, venta: undefined } : i)),
      }))
      return null
    } catch (e) {
      return motivo(e)
    }
  },
}))

setMuted(useGame.getState().muted)
