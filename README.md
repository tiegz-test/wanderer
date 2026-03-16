# Wanderer

A passive web game. A tiny AI creature lives on your screen — wandering, wondering, and slowly learning who you are.

## What it does

- **Wanders** around your screen with smooth animations
- **Asks questions** about you every minute or so, building a personality profile over time
- **Reacts** to your answers with genuine curiosity
- **Shows thoughts** occasionally — little observations about its habitat or things it remembers about you
- **Remembers everything** across sessions via localStorage

Powered by Claude (Opus 4.6).

## Setup

```bash
npm install
npm run dev
```

This starts both the Vite frontend (port 5173) and the Express API server (port 3001).

Open `http://localhost:5173`, choose a habitat, enter your [Anthropic API key](https://console.anthropic.com/account/keys), and your creature will appear.

## Habitats

| Habitat | Vibe |
|---------|------|
| 🌲 Forest | Earthy, leafy, grounded |
| 🌊 Ocean | Deep, bubbly, expansive |
| 🌌 Space | Cosmic, quiet, vast |
| 📚 Library | Warm, dusty, curious |
| 🏜️ Desert | Open, dry, contemplative |

## Architecture

```
server.js         — Express backend, Claude API proxy
src/
  main.ts         — App entry, screen routing
  setup.ts        — Setup screen UI
  game.ts         — Game loop, creature behavior, timers
  personality.ts  — Personality data, localStorage persistence
  claude.ts       — API client (question/reaction/thought/extract)
  habitats.ts     — Habitat definitions and creature name generation
  types.ts        — TypeScript interfaces
  styles.css      — All visual styling, animations, habitat themes
```

## Interaction model

1. Every 45–90 seconds, the creature stops and asks a question
2. You type a response; it reacts with a short observation
3. In the background, Claude extracts facts and personality signal from your answer
4. The personality profile builds up over time, making questions more contextual
5. Occasionally the creature shows a passing thought (no response needed)

Click the creature to pet it. Click ⚙ to see what it knows about you.
