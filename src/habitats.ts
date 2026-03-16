import type { Habitat } from './types'

export const HABITATS: Habitat[] = [
  {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    label: 'Forest',
    description: 'a quiet, dappled woodland',
    particleCount: 18,
    particleSize: [4, 10],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    label: 'Ocean',
    description: 'a deep, shimmering sea',
    particleCount: 22,
    particleSize: [4, 12],
  },
  {
    id: 'space',
    name: 'Space',
    emoji: '🌌',
    label: 'Space',
    description: 'the vast, silent cosmos',
    particleCount: 50,
    particleSize: [1, 4],
  },
  {
    id: 'library',
    name: 'Library',
    emoji: '📚',
    label: 'Library',
    description: 'a warm, ancient library',
    particleCount: 20,
    particleSize: [2, 6],
  },
  {
    id: 'desert',
    name: 'Desert',
    emoji: '🏜️',
    label: 'Desert',
    description: 'a wide, sun-baked desert',
    particleCount: 25,
    particleSize: [2, 7],
  },
]

export function getHabitat(id: string): Habitat {
  return HABITATS.find(h => h.id === id) ?? HABITATS[0]
}

const CREATURE_NAMES: Record<string, string[]> = {
  forest: ['Mossby', 'Fern', 'Briar', 'Clover', 'Pippin'],
  ocean:  ['Ripple', 'Coraly', 'Bloop', 'Wavelet', 'Pearly'],
  space:  ['Quasar', 'Nebby', 'Lumix', 'Stardot', 'Cosmo'],
  library: ['Dusty', 'Scribble', 'Pagey', 'Inkwell', 'Folio'],
  desert: ['Dune', 'Sablo', 'Mirage', 'Pebble', 'Zephyr'],
}

export function generateCreatureName(habitatId: string): string {
  const names = CREATURE_NAMES[habitatId] ?? CREATURE_NAMES['forest']
  return names[Math.floor(Math.random() * names.length)]
}
