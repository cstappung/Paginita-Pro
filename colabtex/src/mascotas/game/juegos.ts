// Los juegos de «Jugar»: cada vez sale uno al azar (nunca el mismo dos veces seguidas), así
// no es siempre el gusanito. Todos son atrapar algo tres veces: la mascota lo persigue y se
// abalanza cuando lo tiene quieto cerca (ver `hunt` en pets/anim/controller.ts).
//
// - gusano: el gusanito colgando de un hilo; se mueve con el puntero (o arrastrando el dedo).
// - laser:  el puntito rojo en el piso; igual, pero rápido.
// - topos:  tocas el pasto y asoma un topo; la mascota va a cazarlo (puedes dejar varios).
// - pelota: tocas el pasto y le lanzas la pelota adonde tocaste.

export type JuegoId = 'gusano' | 'laser' | 'topos' | 'pelota'
export const JUEGOS: readonly JuegoId[] = ['gusano', 'laser', 'topos', 'pelota']

export interface JuegoDef {
  icon: string
  label: string
  /** Qué hacer (el cartel de arriba). */
  titulo: string
  /** Pista antes de la primera atrapada y después. */
  antes: string
  despues: string
  /** El juguete se pone tocando el suelo (no sigue al puntero). */
  tocando: boolean
  /** Cómo se celebra al terminar. */
  fin: string
}

export const JUEGO: Record<JuegoId, JuegoDef> = {
  gusano: {
    icon: '🐛',
    label: 'El gusanito',
    titulo: 'Mueve el gusanito… ¡que lo atrape!',
    antes: 'Déjalo quieto cerca para que salte',
    despues: 'Muévelo a otro lado',
    tocando: false,
    fin: '¡Atrapó el gusanito tres veces! 🎉',
  },
  laser: {
    icon: '🔴',
    label: 'El láser',
    titulo: 'Mueve el láser… ¡que lo cace!',
    antes: 'Déjalo quieto cerca para que salte',
    despues: 'Muévelo a otro lado',
    tocando: false,
    fin: '¡Cazó el láser tres veces! 🎉',
  },
  topos: {
    icon: '🐹',
    label: 'Caza topos',
    titulo: 'Toca el pasto para sacar un topo',
    antes: 'Asoma un topo donde toques',
    despues: 'Saca otro en otro lado',
    tocando: true,
    fin: '¡Atrapó tres topos! 🎉',
  },
  pelota: {
    icon: '⚽',
    label: 'La pelota',
    titulo: 'Toca el pasto para lanzarle la pelota',
    antes: 'Va a buscarla adonde la lances',
    despues: '¡Lánzala otra vez, a otro lado!',
    tocando: true,
    fin: '¡Trajo la pelota tres veces! 🎉',
  },
}

/** Un juego al azar, distinto del anterior (si lo hubo). `rnd` es inyectable para las pruebas. */
export function sorteaJuego(anterior?: JuegoId | null, rnd: () => number = Math.random): JuegoId {
  const l = JUEGOS.filter((j) => j !== anterior)
  return l[Math.min(l.length - 1, Math.floor(rnd() * l.length))]
}

/**
 * Dónde dejar un juguete puesto tocando el suelo: al menos `min` lejos de donde atrapó el último
 * (si no, la mascota no se volvería a abalanzar) y dentro del área `[-ax, ax] × [z0, z1]`.
 */
export function lejosDe(x: number, z: number, de: { x: number; z: number } | null, min: number, area: { x: number; zMin: number; zMax: number }) {
  const acota = (p: { x: number; z: number }) => ({
    x: Math.min(area.x, Math.max(-area.x, p.x)),
    z: Math.min(area.zMax, Math.max(area.zMin, p.z)),
  })
  let p = acota({ x, z })
  if (!de) return p
  const d = Math.hypot(p.x - de.x, p.z - de.z)
  if (d >= min) return p
  // Se empuja en la dirección en que estaba (o hacia un lado); si el borde lo devuelve, al otro.
  const ang = d > 1e-3 ? Math.atan2(p.z - de.z, p.x - de.x) : 0
  for (const a of [ang, ang + Math.PI, ang + Math.PI / 2, ang - Math.PI / 2]) {
    const q = acota({ x: de.x + Math.cos(a) * min * 1.05, z: de.z + Math.sin(a) * min * 1.05 })
    if (Math.hypot(q.x - de.x, q.z - de.z) >= min) return q
  }
  return p
}
