// Muebles y juguetes para decorar el lugar donde vive cada mascota. La forma 3D de cada uno vive
// en src/scene/decor.ts (mismo id). Salen de regalos (como la ropa) y se pueden poner en el
// lugar de cada mascota; uno de cada cosa por lugar.

export interface DecorDef {
  id: string
  label: string
  emoji: string
  /** Radio de su base en el piso (para no encimarse con la mascota ni con otros). */
  r: number
  /** Va pegado al piso (alfombra): se puede poner debajo de la mascota. */
  flat?: boolean
  /** Da luz (se nota de noche). */
  light?: boolean
  /** Colores (o claves de textura) que no cambian en las variantes: el agua es azul, la paja amarilla… */
  keep?: string[]
  /** Colores principales (para la muestrita del inventario). */
  colors: [string, string]
}

export const DECOR: DecorDef[] = [
  { id: 'rug', label: 'Alfombra', emoji: '🧶', r: 0.5, flat: true, colors: ['#e8705f', '#7cc8a6'] },
  { id: 'bed', label: 'Camita', emoji: '🛏️', r: 0.34, colors: ['#c95f7f', '#ec7f9f'] },
  { id: 'lamp', label: 'Lámpara de pie', emoji: '💡', r: 0.17, light: true, colors: ['#ffe9a8', '#5b4b6b'] },
  { id: 'mushroom', label: 'Lámpara hongo', emoji: '🍄', r: 0.2, light: true, colors: ['#ef5a4f', '#fff2d6'] },
  { id: 'chair', label: 'Silla', emoji: '🪑', r: 0.24, colors: ['#e85d75', '#c98a4b'] },
  { id: 'table', label: 'Mesita de té', emoji: '🍵', r: 0.27, keep: ['#b5703a'], colors: ['#ef7d8e', '#c98a4b'] },
  { id: 'sunflower', label: 'Girasol', emoji: '🌻', r: 0.15, keep: ['#6b4228', '#5aa64a', '#6cbf55', '#ffc72c', '#ffd84d', '#7a4722'], colors: ['#ffd84d', '#d0714a'] },
  { id: 'hay', label: 'Fardo de paja', emoji: '🌾', r: 0.3, keep: ['decor-hay', '#e0b84c'], colors: ['#efc65e', '#a8693a'] },
  { id: 'bowl', label: 'Bebedero', emoji: '💧', r: 0.14, keep: ['#a8e1ff'], colors: ['#4f8fd8', '#a8e1ff'] },
  { id: 'ball', label: 'Pelota de playa', emoji: '🏐', r: 0.14, colors: ['#ef4f4f', '#3d8fe0'] },
  { id: 'duck', label: 'Patito de goma', emoji: '🦆', r: 0.13, keep: ['#ff8c2a'], colors: ['#ffd84a', '#ff8c2a'] },
  { id: 'blocks', label: 'Cubos de juguete', emoji: '🧱', r: 0.17, colors: ['#ef5d5d', '#3d8fe0'] },
  { id: 'house', label: 'Casita', emoji: '🏠', r: 0.42, colors: ['#d9574f', '#8a5a3a'] },
]

export const getDecor = (id: string | undefined) => DECOR.find((d) => d.id === id)
