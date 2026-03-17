import { GoogleGenerativeAI } from '@google/generative-ai'
import type { PersonalityData, Habitat, ExtractedFacts } from './types'

function buildSystemPrompt(personality: PersonalityData, habitat: Habitat): string {
  const traitSummary = (Object.entries(personality.traits) as [string, number][])
    .map(([k, v]) => `${k}: ${v}/100`)
    .join(', ')

  const factsText = [
    personality.facts.userName ? `Name: ${personality.facts.userName}` : null,
    personality.facts.occupation ? `Occupation: ${personality.facts.occupation}` : null,
    personality.facts.interests?.length ? `Interests: ${personality.facts.interests.join(', ')}` : null,
    personality.facts.likedThings?.length ? `Likes: ${personality.facts.likedThings.join(', ')}` : null,
    personality.facts.dislikedThings?.length ? `Dislikes: ${personality.facts.dislikedThings.join(', ')}` : null,
    personality.facts.location ? `Location/context: ${personality.facts.location}` : null,
    personality.facts.recentActivity ? `Recent activity: ${personality.facts.recentActivity}` : null,
    ...(personality.facts.memories || []).map(m => `Memory: ${m}`),
  ].filter(Boolean).join('\n')

  return `You are ${personality.creatureName}, a tiny wandering creature who lives on someone's computer screen in a ${habitat.name} habitat (${habitat.description}).

Your personality traits: ${traitSummary}
Interactions so far: ${personality.totalInteractions}

What you know about the person watching you:
${factsText || '(nothing yet — you just arrived!)'}

You communicate in short, warm, slightly whimsical bursts. You are genuinely curious and caring. You speak in first person as the creature.`
}

async function callGemini(
  apiKey: string,
  systemInstruction: string,
  userMessage: string,
  maxOutputTokens: number
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction,
  })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens },
  })
  return result.response.text().trim()
}

export async function generateQuestion(
  apiKey: string,
  personality: PersonalityData,
  habitat: Habitat
): Promise<string> {
  const recentHistory = personality.history
  const historyText = recentHistory?.length
    ? recentHistory.slice(-5).map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n\n')
    : '(no history yet)'

  const previousQuestions = (recentHistory || []).map(h => h.question).join(' | ')
  const interactionCount = personality.totalInteractions

  let questionGuidance = ''
  if (interactionCount === 0) {
    questionGuidance = 'This is your very first interaction. Introduce yourself briefly and ask their name.'
  } else if (interactionCount < 5) {
    questionGuidance = "You are still getting to know them. Ask something simple and friendly — what they're up to, what they like, etc."
  } else if (interactionCount < 15) {
    questionGuidance = 'You know a little about them. Ask something that builds on what you know, or explore a new topic.'
  } else {
    questionGuidance = 'You know them well. Ask a deeper, more personal or philosophical question. Reference specific things you know about them.'
  }

  return callGemini(
    apiKey,
    buildSystemPrompt(personality, habitat),
    `Generate ONE question to ask the person watching you.

Recent conversation:
${historyText}

Previous questions you've asked (do NOT repeat these):
${previousQuestions || '(none yet)'}

Guidance: ${questionGuidance}

Rules:
- Maximum 25 words
- Warm, curious, slightly whimsical tone
- Build naturally on your knowledge of them
- Reply with ONLY the question, nothing else`,
    80
  )
}

export async function generateReaction(
  apiKey: string,
  personality: PersonalityData,
  habitat: Habitat,
  question: string,
  answer: string
): Promise<string> {
  return callGemini(
    apiKey,
    buildSystemPrompt(personality, habitat),
    `You just asked: "${question}"
The person answered: "${answer}"

Write a SHORT reaction (1-2 sentences, max 30 words) that:
- Shows genuine interest in their specific answer
- Is warm and slightly delighted
- Does NOT ask another question
- Feels natural and alive, not robotic

Reply with ONLY the reaction.`,
    80
  )
}

export async function generateThought(
  apiKey: string,
  personality: PersonalityData,
  habitat: Habitat
): Promise<string> {
  return callGemini(
    apiKey,
    buildSystemPrompt(personality, habitat),
    `You are wandering around your ${habitat.name} habitat, thinking to yourself.

Write ONE brief thought (under 18 words) that:
- Reflects on your habitat, something you noticed, or something you remember about the person
- Is whimsical, poetic, or curious
- Feels like a passing thought, not a question

Reply with ONLY the thought.`,
    50
  )
}

export async function extractFacts(
  apiKey: string,
  question: string,
  answer: string
): Promise<ExtractedFacts> {
  const text = await callGemini(
    apiKey,
    'You are a precise data extractor. Return only valid JSON with no markdown or extra text.',
    `Extract factual information from this Q&A exchange.

Question: "${question}"
Answer: "${answer}"

Return a JSON object with any of these fields that are clearly present in the answer (omit fields with no clear information):
{
  "userName": "their name if mentioned",
  "occupation": "their job/role if mentioned",
  "interests": ["array of hobbies/interests mentioned"],
  "likedThings": ["things they expressed liking"],
  "dislikedThings": ["things they expressed disliking"],
  "location": "location context if mentioned",
  "recentActivity": "what they're doing/did recently",
  "memories": ["memorable facts to remember"],
  "traitDeltas": {
    "curiosity": 0,
    "warmth": 0,
    "energy": 0,
    "openness": 0,
    "creativity": 0
  }
}

For traitDeltas, use -5 to +5 based on what their answer reveals about personality.
Reply with ONLY valid JSON, nothing else.`,
    200
  )

  try {
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(cleaned) as ExtractedFacts
  } catch {
    return {}
  }
}

export async function transcribeAudio(apiKey: string, audioBlob: Blob): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(audioBlob)
  })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'audio/webm', data: base64 } },
        { text: 'Transcribe this audio exactly as spoken. Return only the spoken words, nothing else.' },
      ],
    }],
    generationConfig: { maxOutputTokens: 300 },
  })
  return result.response.text().trim()
}
