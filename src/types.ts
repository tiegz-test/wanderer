export interface Habitat {
  id: string
  name: string
  emoji: string
  description: string
  label: string
  particleCount: number
  particleSize: [number, number] // [min, max] px
}

export interface PersonalityTraits {
  curiosity: number   // 0-100: loves learning / disinterested
  warmth: number      // 0-100: expressive / reserved
  energy: number      // 0-100: lively / calm
  openness: number    // 0-100: adventurous / conventional
  creativity: number  // 0-100: imaginative / practical
}

export interface PersonalityFacts {
  userName?: string
  occupation?: string
  interests: string[]
  likedThings: string[]
  dislikedThings: string[]
  recentActivity?: string
  location?: string
  beliefs: string[]
  memories: string[]
}

export interface HistoryEntry {
  question: string
  answer: string
  timestamp: number
}

export interface PersonalityData {
  creatureName: string
  habitatId: string
  totalInteractions: number
  createdAt: number
  lastInteraction: number
  traits: PersonalityTraits
  facts: PersonalityFacts
  history: HistoryEntry[]
  quizProgress?: QuizProgress
}

export type CreatureState = 'wandering' | 'idle' | 'speaking' | 'thinking' | 'happy' | 'reacting'

export type MouthState = 'neutral' | 'happy' | 'thinking' | 'curious'

export interface Position {
  x: number
  y: number
}

export interface ExtractedFacts {
  userName?: string
  occupation?: string
  interests?: string[]
  likedThings?: string[]
  dislikedThings?: string[]
  location?: string
  recentActivity?: string
  memories?: string[]
  traitDeltas?: Partial<PersonalityTraits>
}

export interface QuizCharacterRecord {
  correct: number
  wrong: number
  lastSeen: number
}

export type QuizProgress = Record<string, QuizCharacterRecord>

export interface QuizQuestion {
  character: string
  reading: string
  correctAnswer: string
  distractors: [string, string, string]
  promptType: 'reading' | 'meaning'
  characterType: 'hiragana' | 'kanji'
}
