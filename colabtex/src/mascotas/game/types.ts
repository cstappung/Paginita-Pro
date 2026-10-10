export type SpeciesId = 'chicken' | 'dog' | 'cat'
export type StageId = 'egg' | 'baby' | 'adult'
export type StatId = 'hunger' | 'happiness' | 'energy' | 'hygiene'
/** Dónde se pone un accesorio. Las crías usan sombrero y botas; los adultos sombrero, ropa y zapatos. */
export type SlotId = 'hat' | 'boots' | 'outfit' | 'shoes'
export type ActionId = 'feed' | 'play' | 'sleep' | 'wake' | 'clean' | 'incubate' | 'dance'

/** 0–100, más alto = mejor (hambre 100 = lleno, higiene 100 = limpio). */
export type Stats = Record<StatId, number>

export interface Pet {
  id: string
  name: string
  species: SpeciesId
  stage: StageId
  stats: Stats
  /** Puntos de crecimiento de la etapa actual: solo se ganan con cuidados (nunca solos con el tiempo). */
  growth: number
  /** Está durmiendo: recupera energía de a poco hasta despertar sola o hasta que la despierten. */
  asleep?: boolean
  /** Energía recuperada en la siesta actual (al despertar se convierte en crecimiento). */
  rest?: number
  bornAt: number
  /** Última vez que se actualizaron los stats (ms). */
  lastSeen: number
  /**
   * Qué objeto del inventario (uid) lleva en cada espacio: cada objeto, en una sola mascota a la vez.
   * El id del catálogo y los colores salen del inventario al pintarla (`puesto` en rules.ts).
   */
  wear?: Partial<Record<SlotId, string>>
  /** Muebles y juguetes puestos en su lugar. */
  decor?: PlacedDecor[]
  /** Genética del plumaje (colores del huevo, pollito y gallina). Sin ella: la gallina clásica. */
  look?: Look
  /** Genética del pelaje (gatos). */
  coat?: Coat
  /** Tomó la poción eterna: ya no crece y se queda en esta etapa para siempre (lo dice la economía). */
  frozen?: boolean
  /** Está a la venta en el mercado (id de la oferta): mientras tanto no se cuida ni se viste. */
  venta?: string
}

/** Genes del color (todos 0–1, continuos). Ver src/pets/rig/plumage.ts. */
export interface Look {
  /** Melanina: 0 = blanca, 1 = negra. */
  mel: number
  /** Pigmento cálido: 0 = gris azulado, 1 = intenso. */
  pig: number
  /** Tono del pigmento: 0 = dorado, 1 = rojo caoba. */
  red: number
  /** Cola y puntas de ala más oscuras (0 = parejo). */
  contrast: number
  /** Cáscara del huevo: 0 = blanca, 1 = café oscuro. */
  shell: number
  /** Cáscara azul verdosa (0 = no). */
  blue: number
}

/**
 * Genes del pelaje de un gato (0–1, continuos). Ver src/pets/rig/fur.ts. Siguen la genética real:
 * negro / chocolate / canela, diluido (azul, lila, crema), naranjo (ligado al sexo: a medias sale
 * carey), atigrado, manchas blancas y "colorpoint" (siamés).
 */
export interface Coat {
  /** Pigmento oscuro: 0 = negro, 0,5 = chocolate, 1 = canela. */
  brown: number
  /** Dilución: 0 = intenso, 1 = pastel (negro → azul, naranjo → crema). */
  dilute: number
  /** Naranjo: 0 = nada, 1 = todo; entre medio, manchas de carey. */
  orange: number
  /** Atigrado: cuánto se notan las rayas (los naranjos siempre las tienen un poco). */
  tabby: number
  /** Dibujo del atigrado: 0 = rayas finas, 0,5 = clásico (remolinos), 1 = manchitas. */
  stripe: number
  /** Blanco: 0 = nada, poco = calcetines y pechera, medio = esmoquin, mucho = casi todo blanco. */
  white: number
  /** Colorpoint (siamés): cuerpo claro y orejas, cara, patas y cola oscuras. */
  point: number
  /** Ojos: 0 = cobre, 0,5 = amarillo, 1 = verde (azules en siameses y en los muy blancos). */
  eye: number
  /** Semilla de dónde caen las manchas. */
  seed: number
}

/** Objeto de decoración en el lugar de una mascota (posición en el piso y giro). */
export interface PlacedDecor {
  id: string
  x: number
  z: number
  rot: number
  /** Colores del objeto (semilla; 0 o sin valor = originales). */
  tint?: number
  /** Objeto del inventario (uid): cada mueble, en la casa de una sola mascota a la vez. */
  uid?: string
}

export type Mood = 'happy' | 'normal' | 'sad'
