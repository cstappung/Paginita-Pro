import type { SpeciesDef } from './types'

export const chicken: SpeciesDef = {
  id: 'chicken',
  name: 'Gallina',
  adopt: { emoji: '🥚', label: 'Adoptar huevo de gallina' },
  food: 'granos',
  stages: [
    {
      id: 'egg',
      label: 'Huevo',
      emoji: '🥚',
      model: 'egg',
      scale: 0.55,
      slots: ['hat'],
      stats: ['happiness', 'hygiene'],
      actions: ['incubate', 'clean'],
      statLabels: { happiness: 'Calor' },
      needs: { happiness: 'tiene frío' },
      // Llega fresquito: abrigarlo y limpiarlo un par de veces lo hace nacer.
      start: { happiness: 50, hygiene: 70 },
      growthToNext: 10,
    },
    {
      id: 'baby',
      label: 'Pollito',
      emoji: '🐥',
      model: 'chick',
      scale: 0.72,
      slots: ['hat', 'boots'],
      stats: ['hunger', 'happiness', 'energy', 'hygiene'],
      actions: ['feed', 'play', 'sleep', 'clean'],
      growthToNext: 30,
    },
    {
      id: 'adult',
      label: 'Gallina',
      emoji: '🐔',
      model: 'chicken',
      scale: 1,
      slots: ['hat', 'outfit', 'shoes'],
      stats: ['hunger', 'happiness', 'energy', 'hygiene'],
      actions: ['feed', 'play', 'sleep', 'clean', 'dance'],
    },
  ],
}
