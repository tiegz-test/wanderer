import type { PersonalityData, Position, CreatureState, MouthState, Habitat, QuizQuestion } from './types'
import { savePersonality, addInteraction, applyExtractedFacts, traitDescription, recordQuizAnswer } from './personality'
import { generateQuestion, generateReaction, generateThought, extractFacts, transcribeAudio, generateQuizQuestion } from './claude'
import { getHabitat } from './habitats'

const WANDER_INTERVAL_MS   = [3000, 7000]    // how often creature picks new wander target
const QUESTION_INTERVAL_MS = [45000, 90000]  // how often it asks a question
const THOUGHT_INTERVAL_MS  = [80000, 160000] // how often it shows a thought
const REACTION_DISPLAY_MS  = 4000            // how long reaction stays visible
const THOUGHT_DISPLAY_MS   = 3500            // how long thought stays visible
const QUIZ_INTERVAL_MS     = [180_000, 300_000] // 3–5 min between quizzes
const QUIZ_FEEDBACK_MS     = 1_800              // how long to show correct/wrong flash
const QUIZ_TIMEOUT_MS      = 12_000             // auto-dismiss if no answer

export class Game {
  private personality: PersonalityData
  private habitat: Habitat
  private apiKey: string

  // DOM elements
  private creatureEl: HTMLElement
  private bodyEl: HTMLElement
  private mouthEl: HTMLElement
  private leftPupilEl: HTMLElement
  private rightPupilEl: HTMLElement
  private bubbleEl: HTMLElement
  private bubbleTextEl: HTMLElement
  private bubbleInputAreaEl: HTMLElement
  private bubbleInputEl: HTMLTextAreaElement
  private bubbleSubmitBtn: HTMLButtonElement
  private bubbleSkipBtn: HTMLButtonElement
  private bubbleMicBtn: HTMLButtonElement
  private bubbleMicStopBtn: HTMLButtonElement
  private bubbleActionsNormalEl: HTMLElement
  private bubbleActionsRecordingEl: HTMLElement
  private bubbleReactionEl: HTMLElement
  private bubbleTailEl: HTMLElement
  private hudNameEl: HTMLElement
  private hudAgeEl: HTMLElement
  private ageInterval: ReturnType<typeof setInterval> | null = null
  private errorToastEl: HTMLElement
  private errorToastTimer: ReturnType<typeof setTimeout> | null = null

  // State
  private state: CreatureState = 'wandering'
  private currentPos: Position = { x: 100, y: 100 }
  private targetPos: Position = { x: 100, y: 100 }
  private wanderTimer: ReturnType<typeof setTimeout> | null = null
  private questionTimer: ReturnType<typeof setTimeout> | null = null
  private thoughtTimer: ReturnType<typeof setTimeout> | null = null
  private isBusy = false
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private isRecording = false
  private quizTimer:     ReturnType<typeof setTimeout> | null = null
  private quizAutoTimer: ReturnType<typeof setTimeout> | null = null
  private quizContainer: HTMLElement = null!
  private activeQuizQ:   QuizQuestion | null = null

  constructor(personality: PersonalityData, apiKey: string) {
    this.personality = personality
    this.apiKey = apiKey
    this.habitat = getHabitat(personality.habitatId)

    this.creatureEl       = document.getElementById('creature')!
    this.bodyEl           = this.creatureEl.querySelector('.creature-body')!
    this.mouthEl          = this.creatureEl.querySelector('.creature-mouth')!
    this.leftPupilEl      = this.creatureEl.querySelector('.left-eye .pupil')!
    this.rightPupilEl     = this.creatureEl.querySelector('.right-eye .pupil')!
    this.bubbleEl         = document.getElementById('speech-bubble')!
    this.bubbleTextEl     = document.getElementById('bubble-text')!
    this.bubbleInputAreaEl = document.getElementById('bubble-input-area')!
    this.bubbleInputEl    = document.getElementById('bubble-input') as HTMLTextAreaElement
    this.bubbleSubmitBtn  = document.getElementById('bubble-submit') as HTMLButtonElement
    this.bubbleSkipBtn            = document.getElementById('bubble-skip') as HTMLButtonElement
    this.bubbleMicBtn             = document.getElementById('bubble-mic') as HTMLButtonElement
    this.bubbleMicStopBtn         = document.getElementById('bubble-mic-stop') as HTMLButtonElement
    this.bubbleActionsNormalEl    = document.getElementById('bubble-actions-normal')!
    this.bubbleActionsRecordingEl = document.getElementById('bubble-actions-recording')!
    this.bubbleReactionEl         = document.getElementById('bubble-reaction')!
    this.bubbleTailEl     = this.bubbleEl.querySelector('.bubble-tail')!
    this.hudNameEl        = document.getElementById('hud-name')!
    this.hudAgeEl         = document.getElementById('hud-age')!
    this.errorToastEl     = document.getElementById('error-toast')!
  }

  start(): void {
    this.applyHabitatTheme()
    this.spawnParticles()
    this.updateHUD()

    // Start creature in center-ish area
    this.currentPos = this.randomSafePos()
    this.applyPosition(this.currentPos, false)

    // Wire up buttons
    this.bubbleSubmitBtn.addEventListener('click', () => this.submitAnswer())
    this.bubbleSkipBtn.addEventListener('click', () => this.skipQuestion())
    this.bubbleMicBtn.addEventListener('click', () => this.startRecording())
    this.bubbleMicStopBtn.addEventListener('click', () => this.stopRecording())
    this.bubbleInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.submitAnswer()
      }
    })

    // Creature click = jump to pet
    this.creatureEl.addEventListener('click', () => this.petCreature())

    // Track cursor for eye direction
    document.addEventListener('mousemove', (e) => this.trackEyes(e))

    this.quizContainer = document.getElementById('quiz-bubbles')!
    this.scheduleWander()
    this.scheduleQuestion()
    this.scheduleThought()
    this.scheduleQuiz()
    this.ageInterval = setInterval(() => this.updateHUD(), 60_000)
  }

  stop(): void {
    if (this.wanderTimer)   clearTimeout(this.wanderTimer)
    if (this.questionTimer) clearTimeout(this.questionTimer)
    if (this.thoughtTimer)  clearTimeout(this.thoughtTimer)
    if (this.quizTimer)     clearTimeout(this.quizTimer)
    if (this.quizAutoTimer) clearTimeout(this.quizAutoTimer)
    if (this.ageInterval)   clearInterval(this.ageInterval)
  }

  private applyHabitatTheme(): void {
    const bg = document.getElementById('habitat-bg')!
    const gameScreen = document.getElementById('game-screen')!

    bg.className = `habitat-bg ${this.habitat.id}`
    gameScreen.className = `screen active habitat-${this.habitat.id}`
  }

  private spawnParticles(): void {
    const container = document.getElementById('particles')!
    container.innerHTML = ''

    for (let i = 0; i < this.habitat.particleCount; i++) {
      const el = document.createElement('div')
      el.className = 'particle'

      const [minS, maxS] = this.habitat.particleSize
      const size = minS + Math.random() * (maxS - minS)
      el.style.width  = `${size}px`
      el.style.height = `${size}px`
      el.style.left   = `${Math.random() * 100}%`
      el.style.bottom = `${Math.random() * 80}%`

      const duration = 6 + Math.random() * 14
      const delay = Math.random() * 12
      el.style.animationDuration = `${duration}s`
      el.style.animationDelay    = `${delay}s`

      container.appendChild(el)
    }
  }

  private randomSafePos(): Position {
    const margin = 80
    const maxX = window.innerWidth  - margin - 70
    const maxY = window.innerHeight - margin - 80
    return {
      x: margin + Math.random() * (maxX - margin),
      y: margin + Math.random() * (maxY - margin),
    }
  }

  private applyPosition(pos: Position, animate = true): void {
    if (!animate) {
      this.creatureEl.style.transition = 'none'
      requestAnimationFrame(() => {
        this.creatureEl.style.left = `${pos.x}px`
        this.creatureEl.style.top  = `${pos.y}px`
        requestAnimationFrame(() => {
          this.creatureEl.style.transition = ''
        })
      })
    } else {
      const dx = pos.x - this.currentPos.x
      this.setLeanDir(dx)
      this.creatureEl.style.left = `${pos.x}px`
      this.creatureEl.style.top  = `${pos.y}px`
    }
    this.currentPos = pos
  }

  private setLeanDir(dx: number): void {
    this.creatureEl.classList.remove('moving-right', 'moving-left')
    if (dx > 20)       this.creatureEl.classList.add('moving-right')
    else if (dx < -20) this.creatureEl.classList.add('moving-left')
    setTimeout(() => {
      this.creatureEl.classList.remove('moving-right', 'moving-left')
    }, 3200)
  }

  private scheduleWander(): void {
    const delay = rand(WANDER_INTERVAL_MS[0], WANDER_INTERVAL_MS[1])
    this.wanderTimer = setTimeout(() => {
      if (!this.isBusy) {
        this.targetPos = this.randomSafePos()
        this.applyPosition(this.targetPos)
      }
      this.scheduleWander()
    }, delay)
  }

  private scheduleQuestion(): void {
    const delay = rand(QUESTION_INTERVAL_MS[0], QUESTION_INTERVAL_MS[1])
    this.questionTimer = setTimeout(async () => {
      if (!this.isBusy) {
        await this.askQuestion()
      }
      this.scheduleQuestion()
    }, delay)
  }

  private scheduleThought(): void {
    const delay = rand(THOUGHT_INTERVAL_MS[0], THOUGHT_INTERVAL_MS[1])
    this.thoughtTimer = setTimeout(async () => {
      if (!this.isBusy) {
        await this.showThought()
      }
      this.scheduleThought()
    }, delay)
  }

  private setState(s: CreatureState): void {
    this.state = s
    this.creatureEl.className = `creature ${s}`
    if (s === 'speaking' || s === 'thinking') {
      this.creatureEl.classList.add('speaking')
    }
  }

  private setMouth(m: MouthState): void {
    this.mouthEl.className = `creature-mouth ${m}`
  }

  private trackEyes(e: MouseEvent): void {
    const rect = this.creatureEl.getBoundingClientRect()
    const cx   = rect.left + rect.width / 2
    const cy   = rect.top  + rect.height / 2
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx)
    const r = 3.5
    const tx = Math.cos(angle) * r
    const ty = Math.sin(angle) * r
    this.leftPupilEl.style.transform  = `translate(${tx}px, ${ty}px)`
    this.rightPupilEl.style.transform = `translate(${tx}px, ${ty}px)`
  }

  private showBubble(text: string, type: 'question' | 'thought' = 'question'): void {
    this.bubbleTextEl.textContent = text
    this.bubbleEl.classList.remove('hidden', 'thought')

    if (type === 'thought') {
      this.bubbleEl.classList.add('thought')
      this.bubbleInputAreaEl.classList.add('hidden')
      this.bubbleReactionEl.classList.add('hidden')
    } else {
      this.bubbleInputAreaEl.classList.remove('hidden')
      this.bubbleReactionEl.classList.add('hidden')
      this.bubbleInputEl.value = ''
    }

    this.positionBubble()
  }

  private positionBubble(): void {
    const rect    = this.creatureEl.getBoundingClientRect()
    const bWidth  = 300
    const bHeight = 140

    let left = rect.left + rect.width / 2 - bWidth / 2
    let top  = rect.top - bHeight - 20

    let tailOnTop = false

    if (top < 60) {
      top = rect.bottom + 20
      tailOnTop = true
    }

    left = Math.max(10, Math.min(window.innerWidth - bWidth - 10, left))

    this.bubbleEl.style.left = `${left}px`
    this.bubbleEl.style.top  = `${top}px`
    this.bubbleTailEl.className = tailOnTop ? 'bubble-tail tail-top' : 'bubble-tail'
  }

  private hideBubble(): void {
    this.bubbleEl.classList.add('hidden')
  }

  async askQuestion(): Promise<void> {
    this.isBusy = true
    this.setState('thinking')
    this.setMouth('thinking')

    // Show thinking indicator
    this.bubbleEl.classList.remove('hidden', 'thought')
    this.bubbleInputAreaEl.classList.add('hidden')
    this.bubbleReactionEl.classList.add('hidden')
    this.bubbleTextEl.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>'
    this.positionBubble()

    let question: string
    try {
      question = await generateQuestion(this.apiKey, this.personality, this.habitat)
    } catch (err) {
      this.showError(err)
      this.hideBubble()
      this.setState('wandering')
      this.isBusy = false
      return
    }

    this.setState('speaking')
    this.setMouth('curious')
    this.showBubble(question, 'question')
    this.bubbleSubmitBtn.disabled = false

    // Focus input after a brief delay
    setTimeout(() => this.bubbleInputEl.focus(), 100)
  }

  async submitAnswer(): Promise<void> {
    const answer = this.bubbleInputEl.value.trim()
    if (!answer) return

    this.bubbleSubmitBtn.disabled = true
    this.bubbleInputAreaEl.classList.add('hidden')

    const question = this.bubbleTextEl.textContent || ''

    // Show thinking
    this.bubbleReactionEl.classList.remove('hidden')
    this.bubbleReactionEl.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>'

    // Update personality immediately
    this.personality = addInteraction(this.personality, question, answer)
    savePersonality(this.personality)

    // Get reaction + extract facts in parallel
    try {
      const [reaction, extracted] = await Promise.all([
        generateReaction(this.apiKey, this.personality, this.habitat, question, answer),
        extractFacts(this.apiKey, question, answer),
      ])

      this.personality = applyExtractedFacts(this.personality, extracted)
      savePersonality(this.personality)
      this.updateHUD()

      this.setState('happy')
      this.setMouth('happy')
      this.bubbleReactionEl.textContent = reaction
    } catch (err) {
      this.showError(err)
      this.bubbleReactionEl.textContent = '...'
    }

    setTimeout(() => {
      this.hideBubble()
      this.setState('wandering')
      this.setMouth('neutral')
      this.isBusy = false
    }, REACTION_DISPLAY_MS)
  }

  skipQuestion(): void {
    if (this.isRecording) {
      this.mediaRecorder?.stream.getTracks().forEach(t => t.stop())
      this.mediaRecorder?.stop()
      this.isRecording = false
    }
    this.resetRecordingUI()
    this.hideBubble()
    this.setState('wandering')
    this.setMouth('neutral')
    this.isBusy = false
  }

  private async startRecording(): Promise<void> {
    if (!window.MediaRecorder) {
      this.showError(new Error('Your browser does not support audio recording.'))
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      this.showError(new Error('Microphone access denied. Please allow mic access and try again.'))
      return
    }
    this.audioChunks = []
    this.isRecording = true
    this.bubbleActionsNormalEl.classList.add('hidden')
    this.bubbleActionsRecordingEl.classList.remove('hidden')
    this.bubbleInputEl.disabled = true

    this.mediaRecorder = new MediaRecorder(stream)
    this.mediaRecorder.addEventListener('dataavailable', (e: BlobEvent) => {
      if (e.data.size > 0) this.audioChunks.push(e.data)
    })
    this.mediaRecorder.start()
  }

  private async stopRecording(): Promise<void> {
    if (!this.mediaRecorder || !this.isRecording) return

    this.mediaRecorder.stream.getTracks().forEach(t => t.stop())
    await new Promise<void>(resolve => {
      this.mediaRecorder!.addEventListener('stop', () => resolve(), { once: true })
      this.mediaRecorder!.stop()
    })
    this.isRecording = false

    if (this.audioChunks.length === 0) {
      this.resetRecordingUI()
      this.showError(new Error('No audio was recorded. Please try again.'))
      return
    }

    const spinner = document.createElement('div')
    spinner.id = 'mic-transcribing-spinner'
    spinner.className = 'mic-transcribing-spinner'
    spinner.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>'
    this.bubbleInputAreaEl.appendChild(spinner)

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
    try {
      const text = await transcribeAudio(this.apiKey, audioBlob)
      this.bubbleInputEl.value = text
    } catch (err) {
      this.showError(err)
    }

    this.resetRecordingUI()
    this.bubbleInputEl.focus()
  }

  private resetRecordingUI(): void {
    document.getElementById('mic-transcribing-spinner')?.remove()
    this.bubbleActionsRecordingEl.classList.add('hidden')
    this.bubbleActionsNormalEl.classList.remove('hidden')
    this.bubbleInputEl.disabled = false
    this.bubbleInputEl.placeholder = 'type anything...'
    this.mediaRecorder = null
    this.audioChunks = []
  }

  private async showThought(): Promise<void> {
    this.isBusy = true
    this.setState('thinking')
    this.setMouth('thinking')

    let thought: string
    try {
      thought = await generateThought(this.apiKey, this.personality, this.habitat)
    } catch (err) {
      this.showError(err)
      this.setState('wandering')
      this.isBusy = false
      return
    }

    this.setState('idle')
    this.showBubble(thought, 'thought')

    setTimeout(() => {
      this.hideBubble()
      this.setState('wandering')
      this.setMouth('neutral')
      this.isBusy = false
    }, THOUGHT_DISPLAY_MS)
  }

  private petCreature(): void {
    if (this.activeQuizQ) { this.dismissQuiz(); return }
    if (this.isBusy) return
    this.setState('happy')
    this.setMouth('happy')
    setTimeout(() => {
      this.setState('wandering')
      this.setMouth('neutral')
    }, 1500)
  }

  private updateHUD(): void {
    this.hudNameEl.textContent = this.personality.creatureName
    this.hudAgeEl.textContent  = formatAge(this.personality.createdAt)

    const traits = this.personality.traits
    const traitKeys = ['curiosity', 'warmth', 'energy', 'openness', 'creativity'] as const
    for (const key of traitKeys) {
      const el = document.getElementById(`trait-${key}`)
      if (el) {
        const fill = (traits[key] / 100).toFixed(2)
        el.style.setProperty('--fill', fill)
      }
    }
  }

  showInfoPanel(): void {
    const panel  = document.getElementById('info-panel')!
    const content = document.getElementById('info-content')!
    const p = this.personality

    const sections: Array<[string, string]> = []

    sections.push(['creature', `${p.creatureName} · ${this.habitat.emoji} ${this.habitat.label}`])

    const traitDesc = traitDescription(p.traits)
    sections.push(['personality', `${traitDesc}`])

    sections.push(['interactions', `${p.totalInteractions} conversations`])

    if (p.facts.userName)   sections.push(['name',       p.facts.userName])
    if (p.facts.occupation) sections.push(['occupation', p.facts.occupation])
    if (p.facts.interests.length)    sections.push(['interests', p.facts.interests.join(', ')])
    if (p.facts.likedThings.length)  sections.push(['likes',     p.facts.likedThings.slice(0,5).join(', ')])
    if (p.facts.memories.length)     sections.push(['memories',  p.facts.memories.slice(0,3).join(' · ')])

    content.innerHTML = sections.map(([label, val]) => `
      <div class="info-section">
        <div class="info-section-label">${label}</div>
        <div class="info-fact">${val}</div>
      </div>
    `).join('')

    panel.classList.remove('hidden')
  }

  hideInfoPanel(): void {
    document.getElementById('info-panel')!.classList.add('hidden')
  }

  private showError(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err)
    this.errorToastEl.textContent = `⚠ ${msg}`
    this.errorToastEl.classList.remove('hidden')
    if (this.errorToastTimer) clearTimeout(this.errorToastTimer)
    this.errorToastTimer = setTimeout(() => {
      this.errorToastEl.classList.add('hidden')
    }, 6000)
  }

  // ─── Quiz ──────────────────────────────────────────────────────────────

  private scheduleQuiz(): void {
    const delay = rand(QUIZ_INTERVAL_MS[0], QUIZ_INTERVAL_MS[1])
    this.quizTimer = setTimeout(async () => {
      if (!this.isBusy) await this.runQuiz()
      this.scheduleQuiz()
    }, delay)
  }

  private async runQuiz(): Promise<void> {
    this.isBusy = true
    this.setState('thinking')
    this.setMouth('thinking')

    this.bubbleEl.classList.remove('hidden', 'thought')
    this.bubbleInputAreaEl.classList.add('hidden')
    this.bubbleReactionEl.classList.add('hidden')
    this.bubbleTextEl.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>'
    this.positionBubble()

    let question: QuizQuestion
    try {
      question = await generateQuizQuestion(this.apiKey, this.personality.quizProgress ?? {})
    } catch (err) {
      this.showError(err)
      this.hideBubble()
      this.setState('wandering')
      this.isBusy = false
      return
    }

    this.activeQuizQ = question

    const promptText = question.promptType === 'reading'
      ? 'What sound does this make?'
      : 'What does this mean?'

    this.bubbleTextEl.innerHTML =
      `<span class="quiz-character">${question.character}</span>` +
      `<span class="quiz-prompt">${promptText}</span>`
    this.setState('speaking')
    this.setMouth('curious')
    this.positionBubble()

    this.spawnAnswerBubbles(question)

    this.quizAutoTimer = setTimeout(() => {
      if (this.activeQuizQ) this.dismissQuiz()
    }, QUIZ_TIMEOUT_MS)
  }

  private spawnAnswerBubbles(question: QuizQuestion): void {
    this.quizContainer.innerHTML = ''
    const allOptions = shuffle([question.correctAnswer, ...question.distractors])

    const margin = 80
    const halfW = window.innerWidth / 2
    const halfH = window.innerHeight / 2
    const quadrants = [
      { minX: margin,     maxX: halfW - 80,                  minY: margin + 60, maxY: halfH - 50 },
      { minX: halfW + 20, maxX: window.innerWidth - margin,  minY: margin + 60, maxY: halfH - 50 },
      { minX: margin,     maxX: halfW - 80,                  minY: halfH + 20,  maxY: window.innerHeight - margin },
      { minX: halfW + 20, maxX: window.innerWidth - margin,  minY: halfH + 20,  maxY: window.innerHeight - margin },
    ]

    allOptions.forEach((option, i) => {
      const q = quadrants[i]
      const x = q.minX + Math.random() * Math.max(0, q.maxX - q.minX)
      const y = q.minY + Math.random() * Math.max(0, q.maxY - q.minY)

      const el = document.createElement('button')
      el.className = 'quiz-bubble'
      el.textContent = option
      el.style.left = `${x}px`
      el.style.top  = `${y}px`
      el.style.animationDelay = `${i * 0.4}s`
      el.addEventListener('click', () => this.handleQuizAnswer(option, question, el))
      this.quizContainer.appendChild(el)
    })
  }

  private handleQuizAnswer(
    chosen: string,
    question: QuizQuestion,
    chosenEl: HTMLButtonElement
  ): void {
    if (!this.activeQuizQ) return
    if (this.quizAutoTimer) { clearTimeout(this.quizAutoTimer); this.quizAutoTimer = null }

    this.quizContainer.querySelectorAll('.quiz-bubble').forEach(b => {
      (b as HTMLButtonElement).disabled = true
    })

    const isCorrect = chosen === question.correctAnswer

    this.personality = recordQuizAnswer(this.personality, question.character, isCorrect)
    savePersonality(this.personality)

    if (isCorrect) {
      chosenEl.classList.add('quiz-bubble--correct')
      this.setState('happy')
      this.setMouth('happy')
      this.bubbleTextEl.innerHTML =
        `<span class="quiz-character">${question.character}</span>` +
        `<span class="quiz-prompt quiz-prompt--success">Correct! ✓</span>`
    } else {
      chosenEl.classList.add('quiz-bubble--wrong')
      this.setState('reacting')
      this.quizContainer.querySelectorAll('.quiz-bubble').forEach(b => {
        if (b.textContent === question.correctAnswer) b.classList.add('quiz-bubble--correct')
      })
      this.bubbleTextEl.innerHTML =
        `<span class="quiz-character">${question.character}</span>` +
        `<span class="quiz-prompt quiz-prompt--fail">It's <strong>${question.correctAnswer}</strong></span>`
    }

    setTimeout(() => this.dismissQuiz(), QUIZ_FEEDBACK_MS)
  }

  private dismissQuiz(): void {
    this.activeQuizQ = null
    if (this.quizAutoTimer) { clearTimeout(this.quizAutoTimer); this.quizAutoTimer = null }
    this.quizContainer.querySelectorAll('.quiz-bubble').forEach(b => b.classList.add('quiz-bubble--dismissed'))
    setTimeout(() => { this.quizContainer.innerHTML = '' }, 350)
    this.hideBubble()
    this.setState('wandering')
    this.setMouth('neutral')
    this.isBusy = false
  }
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatAge(createdAt: number): string {
  const ms = Date.now() - createdAt
  const minutes = Math.floor(ms / 60_000)
  const hours   = Math.floor(ms / 3_600_000)
  const days    = Math.floor(ms / 86_400_000)
  const months  = Math.floor(days / 30.44)
  const years   = Math.floor(days / 365.25)

  if (minutes < 60)  return `${minutes}m old`
  if (hours   < 24)  return `${hours}h old`
  if (days    < 30)  return `${days}d old`
  if (months  < 12)  return `${months}mo old`
  return `${years}y old`
}
