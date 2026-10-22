import type { Pet } from './types'

// El Pueblo (estilo Pet Society): una plaza donde las mascotas de todos salen a pasear, y las casas
// de los vecinos, que se visitan. Lógica pura: dónde se puede caminar, los gestos que se mandan y
// los cariños que dejan las visitas. La escena 3D vive en ui/Pueblo.tsx y scene/plaza.ts; lo que va
// y viene de la base, en el cartero (colabtex/src/juegos/mascotas.js).

/** Piso de la plaza donde se puede caminar (unidades de la escena; una gallina adulta mide ≈ 1). */
export const PLAZA = { xMin: -8, xMax: 8, zMin: -4.6, zMax: 4.4 }

/** Lo que no se puede atravesar: la pileta, los árboles, las bancas, los faroles y los maceteros. */
export interface Obstaculo {
  x: number
  z: number
  r: number
}
export const FUENTE: Obstaculo = { x: 0, z: -0.6, r: 1.45 }
export const ARBOLES: Obstaculo[] = [
  { x: -6.6, z: -3.7, r: 0.55 },
  { x: 6.7, z: -3.5, r: 0.55 },
  { x: -7.1, z: 3.3, r: 0.55 },
  { x: 7.1, z: 3.2, r: 0.55 },
  { x: -3.9, z: -4.3, r: 0.5 },
  { x: 4.1, z: -4.4, r: 0.5 },
]
/** Bancas: x, z y giro (radianes). Para chocar cuentan como dos círculos (es larga). */
export const BANCAS = [
  { x: -3.4, z: 2.3, rot: 0.35 },
  { x: 3.4, z: 2.3, rot: -0.35 },
  { x: -5.2, z: -1.2, rot: Math.PI / 2 },
  { x: 5.2, z: -1.2, rot: -Math.PI / 2 },
]
export const FAROLES: Obstaculo[] = [
  { x: -2.3, z: -2.6, r: 0.18 },
  { x: 2.3, z: -2.6, r: 0.18 },
  { x: -1.9, z: 1.4, r: 0.18 },
  { x: 1.9, z: 1.4, r: 0.18 },
]
export const MACETEROS: Obstaculo[] = [
  { x: -6.2, z: 0.9, r: 0.55 },
  { x: 6.2, z: 0.9, r: 0.55 },
  { x: 0, z: 3.7, r: 0.5 },
]

const bancaCirculos = (b: { x: number; z: number; rot: number }): Obstaculo[] => {
  const dx = Math.cos(b.rot) * 0.42
  const dz = -Math.sin(b.rot) * 0.42
  return [
    { x: b.x - dx, z: b.z - dz, r: 0.36 },
    { x: b.x + dx, z: b.z + dz, r: 0.36 },
  ]
}
export const OBSTACULOS: Obstaculo[] = [FUENTE, ...ARBOLES, ...BANCAS.flatMap(bancaCirculos), ...FAROLES, ...MACETEROS]

/** Margen entre la mascota y lo que no se atraviesa. */
const HOLGURA = 0.3

/**
 * Lleva un punto pedido a uno donde se pueda estar: dentro de la plaza y fuera de los obstáculos
 * (se empuja hacia afuera del que pise). No busca un camino: la mascota cruza en línea recta, y
 * pasar rozando la pileta se ve bien.
 */
export function aPiso(x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: PLAZA.zMax - 0.5 }
  const dentro = () => {
    x = Math.min(PLAZA.xMax, Math.max(PLAZA.xMin, x))
    z = Math.min(PLAZA.zMax, Math.max(PLAZA.zMin, z))
  }
  dentro()
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    let movio = false
    for (const o of OBSTACULOS) {
      const min = o.r + HOLGURA
      const d = Math.hypot(x - o.x, z - o.z)
      if (d >= min) continue
      // Justo en el centro: se sale hacia adelante (hacia la cámara).
      const [ux, uz] = d > 1e-3 ? [(x - o.x) / d, (z - o.z) / d] : [0, 1]
      x = o.x + ux * min
      z = o.z + uz * min
      movio = true
    }
    dentro()
    if (!movio) break
  }
  // Contra el borde, empujar hacia afuera lo devuelve adentro del obstáculo: se corre por el borde.
  for (const o of OBSTACULOS) {
    const min = o.r + HOLGURA
    const dz = z - o.z
    if (Math.hypot(x - o.x, dz) >= min) continue
    const lado = Math.sqrt(Math.max(0, min * min - dz * dz)) + 0.01
    const a = o.x - lado
    const b = o.x + lado
    x = a < PLAZA.xMin ? b : b > PLAZA.xMax ? a : x < o.x ? a : b
  }
  return { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 }
}

/** Dónde aparece quien llega a la plaza: delante de la pileta, un poco al azar (`r` entre 0 y 1). */
export const entrada = (r: number) => aPiso(-3 + 6 * r, 3.2)

/**
 * Qué tan apurado camina para cruzar `dist` (unidades de la escena) a `velocidad` (unidades por
 * segundo a paso normal): las caminatas largas se apuran para no tardar una eternidad, sin
 * pasar de un trote.
 */
export function ritmo(dist: number, velocidad: number) {
  if (!(velocidad > 0)) return 1
  return Math.min(4.5, Math.max(1.6, dist / (velocidad * 3.2)))
}

/** Los gestos de la plaza. El id es lo que se guarda (corto, a prueba de reglas). */
export const GESTOS = [
  { id: 'hola', emoji: '👋', label: 'Saludar' },
  { id: 'amor', emoji: '❤️', label: 'Corazón' },
  { id: 'risa', emoji: '😂', label: 'Risa' },
  { id: 'wow', emoji: '😮', label: '¡Wow!' },
  { id: 'pena', emoji: '😢', label: 'Pena' },
  { id: 'fiesta', emoji: '🎉', label: 'Fiesta' },
  { id: 'zzz', emoji: '💤', label: 'Sueño' },
  { id: 'rico', emoji: '🍰', label: '¡Qué rico!' },
] as const
export type GestoId = (typeof GESTOS)[number]['id'] | 'baile'
export const emojiGesto = (id: string | undefined) => GESTOS.find((g) => g.id === id)?.emoji ?? null

/** Cuánto se ve un gesto o lo que se dijo sobre la mascota. */
export const GESTO_MS = 5000
export const DICHO_MS = 7000
/** Largo máximo de lo que se dice en la plaza. */
export const DICHO_MAX = 60

/** Limpia lo que alguien escribe para decirlo en la plaza (una línea, sin espacios de sobra). */
export const limpiaDicho = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, DICHO_MAX)

// ——— Cariños ———
// Una visita puede hacerle cariño a la mascota de un vecino una vez al día. La dueña lo nota la
// próxima vez que abre Mascotas: sube el ánimo y aparece quién fue. Se aplica una vez por cariño
// (`visto` es la hora del último aplicado).

/** Ánimo que sube cada cariño. */
export const CARINO_ANIMO = 8
/** Cada cuánto puede volver a hacerle cariño la misma visita (lo exige también la regla). */
export const CARINO_CADA_MS = 20 * 3600 * 1000
/** Sin `visto` (primera vez): solo cuentan los cariños del último día. */
export const CARINO_VENTANA_MS = 24 * 3600 * 1000

export interface Carino {
  /** Clave del estado de la mascota (`<origen>~<clave>`). */
  k: string
  /** Quién lo hizo. */
  u: string
  nombre: string
  at: number
}

/** Los cariños que todavía no se aplicaron, del más viejo al más nuevo. */
export function nuevosCarinos(lista: readonly Carino[], visto: number | null | undefined, now: number) {
  const desde = Number.isFinite(visto) ? (visto as number) : now - CARINO_VENTANA_MS
  return lista.filter((c) => Number.isFinite(c.at) && c.at > desde && c.at <= now + 60_000).sort((a, b) => a.at - b.at || (a.u < b.u ? -1 : 1))
}

/** La mascota después de `n` cariños: más ánimo (dormida también: se lo encuentra al despertar). */
export function conCarino(p: Pet, n: number): Pet {
  if (n <= 0) return p
  return { ...p, stats: { ...p.stats, happiness: Math.min(100, p.stats.happiness + CARINO_ANIMO * n) } }
}

/** ¿Puede esta visita hacerle cariño otra vez? `ultimo` es la hora de su último cariño a esa mascota. */
export const puedeCarino = (ultimo: number | null | undefined, now: number) => !Number.isFinite(ultimo) || now - (ultimo as number) >= CARINO_CADA_MS
