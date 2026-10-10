import type * as THREE from 'three'
import type { Face } from './face'
import type { FxKind } from '../fx'
import type { SoundId } from '../../audio/sound'

// Esqueleto simple de piezas rígidas: cada articulación es un Object3D y las animaciones suman
// desplazamientos sobre la pose de reposo. Nada se deforma, así ropa, sombreros y ojos nunca se despegan.

export type JointName =
  | 'root' // todo el personaje (camina, salta, se aplasta contra el suelo)
  | 'body' // torso (se inclina, se balancea)
  | 'neck'
  | 'head'
  | 'beak' // mitad inferior del pico (abre y cierra)
  | 'wingL'
  | 'wingR'
  | 'tail'
  | 'footL'
  | 'footR'
  // Gato: patas de adelante (apoyadas en el piso), orejas y cola en cuatro tramos.
  | 'pawL'
  | 'pawR'
  /**
   * Gato, articulaciones de mentira que lee `solve`: llevan la pata de adelante como brazo, con
   * desplazamiento en el espacio del cuerpo; `sx` = cuánto sigue al cuerpo en vez de quedar
   * apoyada en el piso (0–1).
   */
  | 'armL'
  | 'armR'
  | 'earL'
  | 'earR'
  | 'tail2'
  | 'tail3'
  | 'tail4'
  /** Caja del gatito: aleteo de las tapas (rx). */
  | 'flaps'

/** Familia de animación: cada una con sus propias acciones y reacciones. */
export type RigKind = 'egg' | 'chick' | 'hen' | 'box' | 'cat'

/** Desplazamientos de una articulación en la mezcla de poses. */
export type JointMix = Record<'px' | 'py' | 'pz' | 'rx' | 'ry' | 'rz' | 'sx' | 'sy' | 'sz', number>

type V3 = [number, number, number]

/**
 * Forma del torso de los que andan en dos patas (esfera deformada, ver `bodyPoint` en hen.ts).
 * La ropa se calza sobre esta misma forma, así le queda a la gallina y al gato.
 */
export interface TorsoSpec {
  center: V3
  rx: number
  up: number
  down: number
  front: number
  back: number
  taper: number
  lift: number
  breast: number
  hackle: { dir: V3; cos: number; lift: V3 }
}

export interface Leg {
  /** Cadera: cuelga del cuerpo y lo sigue. */
  hip: THREE.Object3D
  /** Tobillo: cuelga del pie. */
  ankle: THREE.Object3D
  /** Canilla: se estira entre cadera y tobillo cada cuadro. */
  shin: THREE.Object3D
  /** Funda que sigue a la pata (mangas): se para en la cadera y gira con la pata. */
  sleeve?: THREE.Object3D
}

export interface HatSocket {
  /** Centro de la "esfera" sobre la que se apoya el sombrero. */
  obj: THREE.Object3D
  /** Radio de esa esfera: los sombreros se diseñan para una cabeza de radio 1. */
  radius: number
}

export interface PetRig {
  kind: RigKind
  root: THREE.Group
  joints: Partial<Record<JointName, THREE.Object3D>>
  face?: Face
  /** Materiales que se ensucian (se tiñen de barro). */
  materials: THREE.MeshToonMaterial[]
  legs: Leg[]
  sockets: {
    hat?: HatSocket
    /** Pies (botas o zapatos). Lado +x primero. */
    feet: THREE.Object3D[]
    /** Torso, para la ropa (mismas coordenadas que el modelo en reposo). */
    outfit?: THREE.Object3D
    /** Alas, para mangas. */
    wings: THREE.Object3D[]
    /** Punta del ala derecha, para objetos en la mano (pañuelo). */
    hand?: THREE.Object3D
  }
  /** Se esconden con sombrero (cresta, copete). */
  hideWithHat: THREE.Object3D[]
  /** Dedos de cada pie: se esconden con calzado cerrado. */
  toes: THREE.Object3D[]
  /** Alto total aproximado (para ubicar burbujas y efectos). */
  height: number
  /** Punto donde pica la comida, en espacio del modelo. */
  peckTarget: [number, number, number]
  /** Torso (si no es el de la gallina): la ropa se calza sobre él. */
  torso?: TorsoSpec
  /** Superficie del torso en la dirección `d` desde su centro (si no es la esfera deformada de `torso`). */
  torsoPoint?: (d: THREE.Vector3) => THREE.Vector3
  /** Cría (gatito): usa las botas y juega más. */
  young?: boolean
  /** Tamaño del calzado respecto del de la gallina (o de las botas del pollito). */
  shoeK?: number
  /** Sonidos y partículas propios (el gato maúlla en vez de cacarear, come croquetas…). */
  swap?: { sound?: Partial<Record<SoundId, SoundId>>; fx?: Partial<Record<FxKind, FxKind>> }
  /**
   * Brazo para las mangas (si no es el ala de la gallina): base del lado izquierdo, giro (x y luego
   * z hacia afuera) y escala de la gota (grosor, largo, alto).
   */
  arm?: { base: [number, number, number]; rx: number; rz: number; sx: number; sy: number; sz: number }
  /**
   * Último ajuste de la pose antes de aplicarla (cambia la mezcla en el lugar): el gato apoya las
   * patas de adelante en el piso aunque el cuerpo se incline, y la caja mueve sus tapas.
   */
  solve?: (mix: Map<JointName, JointMix>) => void
  /** Solo huevo: grietas según el avance (0–1). */
  setProgress?: (p: number) => void
}
