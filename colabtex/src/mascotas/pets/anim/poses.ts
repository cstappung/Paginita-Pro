import type { Pose } from './pose'
import { rollX, rollZ } from './util'

// Vocabulario de poses de la gallina y el pollito, para escribir clips y coreografías con palabras.
// Convenciones: cuerpo rx+ = se inclina adelante; cabeza rx+ = mira abajo, ry+ = mira a su izquierda (+x);
// pie py+ = levanta, pz+ = adelante.

/**
 * Alas de la gallina como brazos. `spread` las abre hacia los costados (0 = plegadas, 1,5 = en cruz),
 * `lift` sube la punta (+1,8 = hacia arriba, −1,4 = colgando, −2,9 = hacia adelante),
 * `flare` separa el borde de abajo del cuerpo.
 */
export const A = (spreadL: number, liftL = 0, spreadR = spreadL, liftR = liftL, flare = 0, flareR = flare): Pose => ({
  wingL: { ry: -spreadL, rx: liftL, rz: flare },
  wingR: { ry: spreadR, rx: liftR, rz: -flareR },
})

/** Solo un ala (s = 1 izquierda, −1 derecha). */
export const A1 = (s: number, spread: number, lift = 0, flare = 0): Pose =>
  s > 0 ? { wingL: { ry: -spread, rx: lift, rz: flare } } : { wingR: { ry: spread, rx: lift, rz: -flare } }

export const body = (rx = 0, rz = 0, ry = 0, py = 0): Pose => ({ body: { rx, rz, ry, py } })
export const head = (rx = 0, ry = 0, rz = 0): Pose => ({ head: { rx, ry, rz } })
export const neck = (rx = 0, ry = 0, rz = 0): Pose => ({ neck: { rx, ry, rz } })
export const root = (py = 0, ry = 0, px = 0, pz = 0): Pose => ({ root: { py, ry, px, pz } })
export const tail = (rx = 0, ry = 0): Pose => ({ tail: { rx, ry } })
export const beak = (open: number): Pose => ({ beak: { rx: open } })
/** Pie: s = 1 izquierdo, −1 derecho. */
export const foot = (s: number, py = 0, pz = 0, px = 0): Pose => (s > 0 ? { footL: { py, pz, px } } : { footR: { py, pz, px } })
/** Aplastar/estirar todo el personaje conservando el volumen (k > 0 estira). */
export const squash = (k: number, joint: 'root' | 'body' = 'root'): Pose => ({ [joint]: { sy: k, sx: -k * 0.5, sz: -k * 0.5 } })

/** Mirar en una dirección repartiendo el giro entre cuello y cabeza (gallina). */
export const gaze = (ry: number, rx = 0, rz = 0): Pose => ({ neck: { ry: ry * 0.35, rx: rx * 0.3 }, head: { ry: ry * 0.65, rx: rx * 0.7, rz } })

/** Picotear el suelo (gallina): el cuerpo se inclina y el cuello baja hasta `peckTarget`. */
export const PECK: Pose = { body: { rx: 0.42, py: -0.02 }, neck: { rx: 1.05 }, head: { rx: 0.3 }, tail: { rx: 0.25 } }

/** Echada durmiendo / empollando: baja el cuerpo, recoge el cuello. */
export const ROOST: Pose = { body: { py: -0.1, rx: -0.03 }, neck: { rx: 0.25, pz: -0.03 }, head: { rx: 0.1 }, tail: { rx: -0.1 } }

/** Rodar el cuerpo redondo (pollito / huevo). */
export const rollBody = (rz: number, rx: number, R: number): Pose => {
  const a = rollZ(rz, R)
  const b = rollX(rx, R)
  return { body: { rz: a.rz, rx: b.rx, px: a.px, pz: b.pz, py: (a.py ?? 0) + (b.py ?? 0) } }
}

/** Alitas del pollito: `out` las abre (ambas positivas = hacia afuera). */
export const CW = (out: number, outR = out): Pose => ({ wingL: { rz: out }, wingR: { rz: -outR } })
