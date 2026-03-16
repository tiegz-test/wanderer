import type { PersonalityData, Habitat, ExtractedFacts } from './types'

const API_BASE = '/api'

async function post<T>(endpoint: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

export async function generateQuestion(
  apiKey: string,
  personality: PersonalityData,
  habitat: Habitat
): Promise<string> {
  const { text } = await post<{ text: string }>('/question', {
    apiKey,
    personality,
    habitat,
    recentHistory: personality.history,
  })
  return text
}

export async function generateReaction(
  apiKey: string,
  personality: PersonalityData,
  habitat: Habitat,
  question: string,
  answer: string
): Promise<string> {
  const { text } = await post<{ text: string }>('/react', {
    apiKey,
    personality,
    habitat,
    question,
    answer,
  })
  return text
}

export async function generateThought(
  apiKey: string,
  personality: PersonalityData,
  habitat: Habitat
): Promise<string> {
  const { text } = await post<{ text: string }>('/thought', {
    apiKey,
    personality,
    habitat,
  })
  return text
}

export async function extractFacts(
  apiKey: string,
  question: string,
  answer: string
): Promise<ExtractedFacts> {
  const data = await post<ExtractedFacts>('/extract', {
    apiKey,
    question,
    answer,
  })
  return data
}
