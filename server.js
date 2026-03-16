import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
app.use(express.json())
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))

const PORT = 3001

function buildSystemPrompt(personality, habitat) {
  const traitSummary = Object.entries(personality.traits)
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

// Generate a question for the creature to ask
app.post('/api/question', async (req, res) => {
  const { apiKey, personality, habitat, recentHistory } = req.body
  if (!apiKey) return res.status(400).json({ error: 'API key required' })

  const client = new Anthropic({ apiKey })

  const historyText = recentHistory?.length
    ? recentHistory.slice(-5).map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n\n')
    : '(no history yet)'

  const previousQuestions = (recentHistory || []).map(h => h.question).join(' | ')

  const interactionCount = personality.totalInteractions

  let questionGuidance = ''
  if (interactionCount === 0) {
    questionGuidance = 'This is your very first interaction. Introduce yourself briefly and ask their name.'
  } else if (interactionCount < 5) {
    questionGuidance = 'You are still getting to know them. Ask something simple and friendly — what they\'re up to, what they like, etc.'
  } else if (interactionCount < 15) {
    questionGuidance = 'You know a little about them. Ask something that builds on what you know, or explore a new topic.'
  } else {
    questionGuidance = 'You know them well. Ask a deeper, more personal or philosophical question. Reference specific things you know about them.'
  }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 80,
      system: buildSystemPrompt(personality, habitat),
      messages: [{
        role: 'user',
        content: `Generate ONE question to ask the person watching you.

Recent conversation:
${historyText}

Previous questions you've asked (do NOT repeat these):
${previousQuestions || '(none yet)'}

Guidance: ${questionGuidance}

Rules:
- Maximum 25 words
- Warm, curious, slightly whimsical tone
- Build naturally on your knowledge of them
- Reply with ONLY the question, nothing else`
      }]
    })

    const text = response.content.find(b => b.type === 'text')?.text?.trim() || ''
    res.json({ text })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Generate a reaction to the user's answer
app.post('/api/react', async (req, res) => {
  const { apiKey, personality, habitat, question, answer } = req.body
  if (!apiKey) return res.status(400).json({ error: 'API key required' })

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 80,
      system: buildSystemPrompt(personality, habitat),
      messages: [{
        role: 'user',
        content: `You just asked: "${question}"
The person answered: "${answer}"

Write a SHORT reaction (1-2 sentences, max 30 words) that:
- Shows genuine interest in their specific answer
- Is warm and slightly delighted
- Does NOT ask another question
- Feels natural and alive, not robotic

Reply with ONLY the reaction.`
      }]
    })

    const text = response.content.find(b => b.type === 'text')?.text?.trim() || ''
    res.json({ text })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Generate a random wandering thought
app.post('/api/thought', async (req, res) => {
  const { apiKey, personality, habitat } = req.body
  if (!apiKey) return res.status(400).json({ error: 'API key required' })

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 50,
      system: buildSystemPrompt(personality, habitat),
      messages: [{
        role: 'user',
        content: `You are wandering around your ${habitat.name} habitat, thinking to yourself.

Write ONE brief thought (under 18 words) that:
- Reflects on your habitat, something you noticed, or something you remember about the person
- Is whimsical, poetic, or curious
- Feels like a passing thought, not a question

Reply with ONLY the thought.`
      }]
    })

    const text = response.content.find(b => b.type === 'text')?.text?.trim() || ''
    res.json({ text })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Extract personality updates from an answer
app.post('/api/extract', async (req, res) => {
  const { apiKey, question, answer, currentFacts } = req.body
  if (!apiKey) return res.status(400).json({ error: 'API key required' })

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Extract factual information from this Q&A exchange.

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
Reply with ONLY valid JSON, nothing else.`
      }]
    })

    const text = response.content.find(b => b.type === 'text')?.text?.trim() || '{}'
    try {
      const data = JSON.parse(text)
      res.json(data)
    } catch {
      res.json({})
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Wanderer server running on http://localhost:${PORT}`)
})
