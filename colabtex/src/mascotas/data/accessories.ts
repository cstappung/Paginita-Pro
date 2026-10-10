import type { SlotId } from '../game/types'

export interface AccessoryDef {
  id: string
  slot: SlotId
  label: string
  emoji: string
  /** Legendario: brilla, tiene efectos propios y aura. */
  rarity?: 'legendary'
  /** Colores que no cambian en las variantes de color ('all' = siempre con sus colores). Ver pets/tint.ts. */
  keep?: string[] | 'all'
  /** Colores principales (para la muestrita del inventario). Los legendarios usan los de su tema. */
  colors?: [string, string]
}

// Catálogo: la forma 3D de cada uno vive en src/pets/wear.ts (mismo id).
export const HATS: AccessoryDef[] = [
  { id: 'beanie', slot: 'hat', label: 'Gorro de lana', emoji: '🧶', colors: ['#e0463c', '#f4e6d0'] },
  { id: 'top', slot: 'hat', label: 'Sombrero de copa', emoji: '🎩', colors: ['#2b2b33', '#c0392b'] },
  { id: 'crown', slot: 'hat', label: 'Corona', emoji: '👑', colors: ['#f2c230', '#3d7de0'] },
  { id: 'cowboy', slot: 'hat', label: 'Sombrero vaquero', emoji: '🤠', colors: ['#a9743f', '#5b3a1e'] },
  { id: 'party', slot: 'hat', label: 'Gorro de fiesta', emoji: '🎉', colors: ['#e85d9a', '#ffd84a'] },
  { id: 'arcane', slot: 'hat', label: 'Sombrero arcano', emoji: '🔮', rarity: 'legendary' },
  { id: 'phoenix', slot: 'hat', label: 'Corona del fénix', emoji: '🔥', rarity: 'legendary' },
  { id: 'halo', slot: 'hat', label: 'Aureola de ángel', emoji: '😇', rarity: 'legendary' },
  { id: 'storm', slot: 'hat', label: 'Nube de tormenta', emoji: '⛈️', rarity: 'legendary', keep: ['#fff27a', '#ffe23a', '#ffe27a'] },
  { id: 'bloom', slot: 'hat', label: 'Corona del bosque', emoji: '🌼', rarity: 'legendary' },
]

export const BOOTS: AccessoryDef[] = [
  { id: 'rain', slot: 'boots', label: 'Botas de lluvia', emoji: '👢', colors: ['#e8453c', '#ffffff'] },
  { id: 'cowboy', slot: 'boots', label: 'Botas vaqueras', emoji: '🤠', colors: ['#9a5f33', '#d9a35f'] },
  { id: 'snow', slot: 'boots', label: 'Botas de nieve', emoji: '❄️', colors: ['#7fb7e8', '#ffffff'] },
  { id: 'trek', slot: 'boots', label: 'Botas de aventura', emoji: '🥾', colors: ['#5e9a4a', '#e8c25a'] },
  { id: 'star', slot: 'boots', label: 'Botas estrella', emoji: '⭐', colors: ['#8d5fd3', '#ffd84a'] },
  { id: 'rocket', slot: 'boots', label: 'Botas cohete', emoji: '🚀', rarity: 'legendary' },
  { id: 'crystal', slot: 'boots', label: 'Botas de cristal', emoji: '💎', rarity: 'legendary' },
  { id: 'lava', slot: 'boots', label: 'Botas de lava', emoji: '🌋', rarity: 'legendary', keep: 'all' },
  { id: 'rainbow', slot: 'boots', label: 'Botas arcoíris', emoji: '🌈', rarity: 'legendary', keep: 'all' },
  { id: 'thunder', slot: 'boots', label: 'Botas relámpago', emoji: '⚡', rarity: 'legendary' },
]

export const OUTFITS: AccessoryDef[] = [
  { id: 'sweater', slot: 'outfit', label: 'Suéter', emoji: '🧥', colors: ['#d9473f', '#f4e6d0'] },
  { id: 'dress', slot: 'outfit', label: 'Vestido', emoji: '👗', colors: ['#f08ab4', '#d85d95'] },
  { id: 'cape', slot: 'outfit', label: 'Capa de heroína', emoji: '🦸', colors: ['#d9473f', '#f2c230'] },
  { id: 'apron', slot: 'outfit', label: 'Delantal de cocina', emoji: '🍳', colors: ['#e0463c', '#ffffff'] },
  { id: 'tux', slot: 'outfit', label: 'Esmoquin', emoji: '🤵', colors: ['#2b2b33', '#e0463c'] },
  { id: 'royal', slot: 'outfit', label: 'Manto real', emoji: '⚜️', rarity: 'legendary' },
  { id: 'galaxy', slot: 'outfit', label: 'Vestido galaxia', emoji: '🌌', rarity: 'legendary' },
  { id: 'knight', slot: 'outfit', label: 'Armadura de caballero', emoji: '🛡️', rarity: 'legendary' },
  { id: 'sakura', slot: 'outfit', label: 'Kimono sakura', emoji: '🌸', rarity: 'legendary', keep: 'all' },
  { id: 'fairy', slot: 'outfit', label: 'Vestido de hada', emoji: '🧚', rarity: 'legendary' },
]

export const SHOES: AccessoryDef[] = [
  { id: 'sneakers', slot: 'shoes', label: 'Zapatillas', emoji: '👟', colors: ['#e0463c', '#3d7de0'] },
  { id: 'loafers', slot: 'shoes', label: 'Mocasines', emoji: '👞', colors: ['#5b3a1e', '#f2c230'] },
  { id: 'ballet', slot: 'shoes', label: 'Bailarinas', emoji: '🥿', colors: ['#f5a3c7', '#e47fae'] },
  { id: 'sandals', slot: 'shoes', label: 'Sandalias', emoji: '👡', colors: ['#d9b45a', '#e0463c'] },
  { id: 'heels', slot: 'shoes', label: 'Tacones', emoji: '👠', colors: ['#d9473f', '#f2c230'] },
  { id: 'winged', slot: 'shoes', label: 'Zapatos alados', emoji: '🕊️', rarity: 'legendary' },
  { id: 'comet', slot: 'shoes', label: 'Zapatillas cometa', emoji: '☄️', rarity: 'legendary' },
  { id: 'skates', slot: 'shoes', label: 'Patines de hielo', emoji: '⛸️', rarity: 'legendary' },
  { id: 'dragon', slot: 'shoes', label: 'Pantuflas de dragón', emoji: '🐉', rarity: 'legendary' },
  { id: 'disco', slot: 'shoes', label: 'Plataformas disco', emoji: '🕺', rarity: 'legendary' },
]

export const CATALOG: Record<SlotId, AccessoryDef[]> = { hat: HATS, boots: BOOTS, outfit: OUTFITS, shoes: SHOES }

export const SLOT_LABEL: Record<SlotId, string> = { hat: 'Sombrero', boots: 'Botas', outfit: 'Ropa', shoes: 'Zapatos' }

/**
 * Bailes de los adultos. La coreografía está en src/pets/anim/dances.ts y la música en
 * src/audio/music.ts (mismo id). `beats` golpes a `bpm`; `steps` subdivisiones por golpe (3 = 6/8).
 * Los legendarios salen en regalos (y encienden el aura de la mascota al bailar).
 */
const DANCE_LIST = [
  { id: 'salsa', label: 'Salsa', emoji: '💃', bpm: 104, beats: 16, steps: 2 },
  { id: 'spin', label: 'Giro', emoji: '🌀', bpm: 120, beats: 16, steps: 2 },
  { id: 'robot', label: 'Robot', emoji: '🤖', bpm: 100, beats: 16, steps: 2 },
  { id: 'disco', label: 'Disco', emoji: '🕺', bpm: 116, beats: 16, steps: 2 },
  { id: 'conga', label: 'Pollo loco', emoji: '🐔', bpm: 132, beats: 24, steps: 2 },
  { id: 'cueca', label: 'Cueca', emoji: '🧣', bpm: 92, beats: 16, steps: 3 },
  { id: 'moonwalk', label: 'Paso lunar', emoji: '🌙', bpm: 108, beats: 24, steps: 2, rarity: 'legendary' },
  { id: 'cosmic', label: 'Danza cósmica', emoji: '✨', bpm: 96, beats: 24, steps: 2, rarity: 'legendary' },
] as const
export type DanceId = (typeof DANCE_LIST)[number]['id']
export interface DanceDef {
  id: DanceId
  label: string
  emoji: string
  bpm: number
  beats: number
  steps: number
  rarity?: 'legendary'
}
export const DANCES: readonly DanceDef[] = DANCE_LIST

export const getDance = (id: string | undefined) => DANCES.find((d) => d.id === id)
/** Duración del baile en segundos. */
export const danceSeconds = (d: DanceDef) => (d.beats * 60) / d.bpm

export function getAccessory(slot: SlotId, id: string | undefined) {
  return id ? CATALOG[slot].find((a) => a.id === id) : undefined
}

/** Fondos de la escena (cielo y suelo). Se compran una vez por cuenta (precio en el motor compartido). */
export const BACKGROUNDS = [
  { id: 'meadow', label: 'Pradera', emoji: '🌿', sky: '#cfe8f5', ground: '#b9dc8f' },
  { id: 'sunset', label: 'Atardecer', emoji: '🌇', sky: '#f9c9a0', ground: '#c9d98a' },
  { id: 'beach', label: 'Playa', emoji: '🏖️', sky: '#bfe9f5', ground: '#f3deaa' },
  { id: 'snow', label: 'Nieve', emoji: '⛄', sky: '#dfeaf5', ground: '#f4f8fb' },
  { id: 'night', label: 'Noche', emoji: '🌙', sky: '#27345c', ground: '#4a6b4a' },
] as const

export const getBackground = (id: string | undefined) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0]
