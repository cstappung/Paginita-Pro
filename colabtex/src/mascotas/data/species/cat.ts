import type { SpeciesDef } from './types'

// Gato: llega en una caja (con el gatito asomado). Mimos y limpieza la abren y sale el gatito;
// con cuidados crece a gato. Mismas etapas, cuidados y espacios de ropa que la gallina; juega
// con un puntero láser.
const FEED = { icon: '🐟', hint: 'Lánzale croquetas' }
const PLAY = { icon: '🔴', hint: 'Juega con el láser' }

export const cat: SpeciesDef = {
  id: 'cat',
  name: 'Gato',
  adopt: { emoji: '📦', label: 'Adoptar caja con gatito' },
  food: 'croquetas',
  toy: { name: 'el láser', icon: '🔴' },
  stages: [
    {
      id: 'egg',
      label: 'Caja',
      emoji: '📦',
      model: 'box',
      scale: 0.6,
      slots: ['hat'],
      stats: ['happiness', 'hygiene'],
      actions: ['incubate', 'clean'],
      statLabels: { happiness: 'Cariño' },
      care: { incubate: { label: 'Mimos', icon: '🤲', hint: 'Hazle cariño' }, clean: { label: 'Limpiar', hint: 'Sácale el polvo' } },
      needs: { happiness: 'quiere mimos', hygiene: 'está polvoriento' },
      start: { happiness: 50, hygiene: 70 },
      growthToNext: 10,
    },
    {
      id: 'baby',
      label: 'Gatito',
      emoji: '🐱',
      model: 'kitten',
      scale: 1.1,
      slots: ['hat', 'boots'],
      stats: ['hunger', 'happiness', 'energy', 'hygiene'],
      actions: ['feed', 'play', 'sleep', 'clean'],
      care: { feed: FEED, play: PLAY },
      growthToNext: 30,
    },
    {
      id: 'adult',
      label: 'Gato',
      emoji: '🐈',
      model: 'cat',
      scale: 1.2,
      slots: ['hat', 'outfit', 'shoes'],
      stats: ['hunger', 'happiness', 'energy', 'hygiene'],
      actions: ['feed', 'play', 'sleep', 'clean', 'dance'],
      care: { feed: FEED, play: PLAY },
    },
  ],
}
