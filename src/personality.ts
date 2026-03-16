import type { PersonalityData, PersonalityTraits, ExtractedFacts, HistoryEntry } from './types'
import { generateCreatureName } from './habitats'

const STORAGE_KEY = 'wanderer_personality'
const MAX_HISTORY = 30

export function createPersonality(habitatId: string, creatureName?: string): PersonalityData {
  return {
    creatureName: creatureName?.trim() || generateCreatureName(habitatId),
    habitatId,
    totalInteractions: 0,
    createdAt: Date.now(),
    lastInteraction: Date.now(),
    traits: {
      curiosity: 50,
      warmth: 50,
      energy: 50,
      openness: 50,
      creativity: 50,
    },
    facts: {
      interests: [],
      likedThings: [],
      dislikedThings: [],
      beliefs: [],
      memories: [],
    },
    history: [],
  }
}

export function savePersonality(data: PersonalityData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function loadPersonality(): PersonalityData | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersonalityData
  } catch {
    return null
  }
}

export function clearPersonality(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasExistingPersonality(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function addInteraction(
  data: PersonalityData,
  question: string,
  answer: string
): PersonalityData {
  const entry: HistoryEntry = { question, answer, timestamp: Date.now() }
  const history = [...data.history, entry].slice(-MAX_HISTORY)

  return {
    ...data,
    totalInteractions: data.totalInteractions + 1,
    lastInteraction: Date.now(),
    history,
  }
}

export function applyExtractedFacts(
  data: PersonalityData,
  extracted: ExtractedFacts
): PersonalityData {
  const facts = { ...data.facts }
  const traits = { ...data.traits }

  if (extracted.userName) facts.userName = extracted.userName
  if (extracted.occupation) facts.occupation = extracted.occupation
  if (extracted.recentActivity) facts.recentActivity = extracted.recentActivity
  if (extracted.location) facts.location = extracted.location

  if (extracted.interests?.length) {
    facts.interests = unique([...facts.interests, ...extracted.interests]).slice(0, 15)
  }
  if (extracted.likedThings?.length) {
    facts.likedThings = unique([...facts.likedThings, ...extracted.likedThings]).slice(0, 20)
  }
  if (extracted.dislikedThings?.length) {
    facts.dislikedThings = unique([...facts.dislikedThings, ...extracted.dislikedThings]).slice(0, 15)
  }
  if (extracted.memories?.length) {
    facts.memories = unique([...facts.memories, ...extracted.memories]).slice(0, 20)
  }

  // Apply trait deltas (clamp 0-100)
  if (extracted.traitDeltas) {
    for (const [key, delta] of Object.entries(extracted.traitDeltas)) {
      const k = key as keyof PersonalityTraits
      if (typeof delta === 'number') {
        traits[k] = Math.max(0, Math.min(100, traits[k] + delta))
      }
    }
  }

  return { ...data, facts, traits }
}

function unique(arr: string[]): string[] {
  return [...new Set(arr.map(s => s.toLowerCase().trim()))].filter(Boolean)
}

export function traitDescription(traits: PersonalityTraits): string {
  const descriptions: string[] = []

  if (traits.curiosity > 70) descriptions.push('very curious')
  else if (traits.curiosity < 30) descriptions.push('quietly observant')

  if (traits.warmth > 70) descriptions.push('warmly expressive')
  else if (traits.warmth < 30) descriptions.push('thoughtfully reserved')

  if (traits.energy > 70) descriptions.push('lively')
  else if (traits.energy < 30) descriptions.push('calm')

  if (traits.openness > 70) descriptions.push('loves new ideas')
  if (traits.creativity > 70) descriptions.push('imaginative')

  return descriptions.length > 0 ? descriptions.join(', ') : 'balanced and gentle'
}
