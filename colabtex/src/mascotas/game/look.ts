import MM from '../../../../juegos/mascotas/motor.js'
import type { Coat, Look, SpeciesId } from './types'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// Genética del color de cada mascota nueva (los colores que salen de ella: src/pets/rig/plumage.ts).
// No hay Math.random: los genes salen de la adopción (`MM.semillaGenes(origen, clave, at)`), así
// cualquiera que mire la mascota la ve igual, y no cambia cuando pasa a otro dueño.

/** Genes al azar (`rand` devuelve 0–1). Reparte en todo el espectro, algo cargado a tonos cálidos. */
export function randomLook(rand: () => number): Look {
  const mel = rand()
  const pig = 1 - rand() ** 2
  const blue = rand() < 0.15 ? 0.45 + rand() * 0.55 : 0
  return {
    mel,
    pig,
    red: rand(),
    contrast: rand() ** 1.6,
    // Las gallinas oscuras o rojizas tienden a poner huevos más oscuros.
    shell: clamp01(0.6 * rand() + 0.45 * pig * sstep(0.1, 0.55, mel)),
    blue,
  }
}

/**
 * Pelaje al azar con frecuencias parecidas a las reales: la mayoría negros o atigrados, algunos
 * naranjos, carey, con blanco, diluidos (grises y cremas), chocolates y unos pocos siameses.
 * Todo continuo: cada gato sale distinto.
 */
export function randomCoat(rand: () => number): Coat {
  const o = rand()
  return {
    brown: rand() < 0.78 ? rand() * 0.15 : 0.3 + rand() * 0.7,
    dilute: rand() < 0.7 ? rand() * 0.25 : 0.5 + rand() * 0.5,
    orange: o < 0.5 ? 0 : o < 0.72 ? 0.25 + ((o - 0.5) / 0.22) * 0.5 : 0.85 + rand() * 0.15,
    tabby: rand() < 0.5 ? 0.55 + rand() * 0.45 : rand() * 0.25,
    stripe: rand(),
    white: rand() < 0.45 ? 0 : rand() ** 1.3,
    point: rand() < 0.12 ? 0.6 + rand() * 0.4 : 0,
    eye: rand(),
    seed: Math.floor(rand() * 1e6),
  }
}

/** Los genes de una mascota a partir de una semilla de cuatro palabras (la de su adopción). */
export function genesDe(species: SpeciesId, semilla: readonly number[]): Look | Coat {
  const r = MM.generador(semilla).real
  return species === 'cat' ? randomCoat(r) : randomLook(r)
}

/** Semilla para algo que no tiene adopción (pruebas, maniquíes): sale de un texto. */
export const semillaDe = (texto: string): number[] => MM.sha256('mascota-genes:' + texto).slice(0, 4)
