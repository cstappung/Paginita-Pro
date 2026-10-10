import { getAccessory } from '../data/accessories'
import { getDecor } from '../data/decor'
import type { ItemKind } from '../game/inventory'
import { LEGENDS } from '../pets/legend2'
import { tintHex, withTint } from '../pets/tint'

/** Los dos colores principales de un objeto del inventario con su variante (para la muestrita). */
export function swatch(kind: ItemKind, id: string, tint: number): string[] {
  if (kind === 'dance') return []
  if (kind === 'decor') {
    const d = getDecor(id)
    return d ? withTint(tint, d.keep, () => d.colors.map(tintHex)) : []
  }
  const a = getAccessory(kind, id)
  if (!a) return []
  const legend = (LEGENDS[kind] as Record<string, { color: string; accent: string }>)[id]
  const base = a.colors ?? (legend ? [legend.color, legend.accent] : [])
  return withTint(tint, a.keep, () => base.map(tintHex))
}
