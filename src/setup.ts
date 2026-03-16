import { HABITATS } from './habitats'

export function initSetupScreen(onComplete: (habitatId: string, creatureName: string, apiKey: string) => void): void {
  const grid = document.getElementById('habitat-grid')!
  let selectedHabitatId = ''

  // Render habitat cards
  for (const habitat of HABITATS) {
    const card = document.createElement('div')
    card.className = 'habitat-card'
    card.dataset.id = habitat.id
    card.innerHTML = `<span class="habitat-emoji">${habitat.emoji}</span><span class="habitat-label">${habitat.label}</span>`
    card.addEventListener('click', () => {
      grid.querySelectorAll('.habitat-card').forEach(c => c.classList.remove('selected'))
      card.classList.add('selected')
      selectedHabitatId = habitat.id
    })
    grid.appendChild(card)
  }

  // Select first by default
  const first = grid.querySelector('.habitat-card') as HTMLElement
  if (first) {
    first.classList.add('selected')
    selectedHabitatId = HABITATS[0].id
  }

  const beginBtn  = document.getElementById('begin-btn') as HTMLButtonElement
  const errorEl   = document.getElementById('setup-error')!
  const apiKeyEl  = document.getElementById('api-key') as HTMLInputElement
  const nameEl    = document.getElementById('creature-name') as HTMLInputElement

  beginBtn.addEventListener('click', () => {
    const apiKey = apiKeyEl.value.trim()
    const creatureName = nameEl.value.trim()

    if (!selectedHabitatId) {
      showError(errorEl, 'Please choose a habitat.')
      return
    }
    if (!apiKey) {
      showError(errorEl, 'Please enter your Anthropic API key.')
      return
    }
    if (!apiKey.startsWith('sk-ant-')) {
      showError(errorEl, 'That doesn\'t look like an Anthropic API key (should start with sk-ant-).')
      return
    }

    showError(errorEl, '')
    beginBtn.disabled = true
    beginBtn.textContent = 'Creating your wanderer...'

    onComplete(selectedHabitatId, creatureName, apiKey)
  })
}

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg
}
