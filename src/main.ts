import './styles.css'
import { initSetupScreen } from './setup'
import { Game } from './game'
import {
  createPersonality,
  savePersonality,
  loadPersonality,
  clearPersonality,
  hasExistingPersonality,
} from './personality'

const API_KEY_STORAGE = 'wanderer_api_key'

function showScreen(id: string): void {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(id)?.classList.add('active')
}

let currentGame: Game | null = null

function startGame(personality = loadPersonality()!, apiKey: string): void {
  currentGame = new Game(personality, apiKey)

  showScreen('game-screen')
  requestAnimationFrame(() => currentGame!.start())

  // Settings panel
  const settingsBtn  = document.getElementById('settings-btn')!
  const infoPanel    = document.getElementById('info-panel')!
  const closeInfoBtn = document.getElementById('close-info-btn')!
  const resetBtn     = document.getElementById('reset-btn')!

  settingsBtn.addEventListener('click', () => {
    if (infoPanel.classList.contains('hidden')) {
      currentGame!.showInfoPanel()
    } else {
      currentGame!.hideInfoPanel()
    }
  })

  closeInfoBtn.addEventListener('click', () => currentGame!.hideInfoPanel())

  resetBtn.addEventListener('click', () => {
    if (confirm('This will delete all memories and start fresh. Are you sure?')) {
      currentGame!.stop()
      clearPersonality()
      localStorage.removeItem(API_KEY_STORAGE)
      location.reload()
    }
  })
}

// Check for existing save
if (hasExistingPersonality()) {
  const saved = loadPersonality()
  const storedKey = localStorage.getItem(API_KEY_STORAGE)

  if (saved && storedKey) {
    // Resume immediately
    startGame(saved, storedKey)
  } else {
    // Need API key again
    showScreen('setup-screen')
    initSetupScreen((habitatId, creatureName, apiKey) => {
      const personality = saved || createPersonality(habitatId, creatureName)
      localStorage.setItem(API_KEY_STORAGE, apiKey)
      savePersonality(personality)
      startGame(personality, apiKey)
    })
  }
} else {
  showScreen('setup-screen')
  initSetupScreen((habitatId, creatureName, apiKey) => {
    const personality = createPersonality(habitatId, creatureName)
    localStorage.setItem(API_KEY_STORAGE, apiKey)
    savePersonality(personality)
    startGame(personality, apiKey)
  })
}
