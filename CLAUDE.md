# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start   # Serve locally at http://localhost:8000 (python -m http.server 8000)
npm run lint    # ESLint on js/*.js (ES6 modules)
npm run deploy  # Deploy to GitHub Pages via gh-pages
```

No build step — the project uses native ES6 modules (`type="module"`) in the browser.

## Architecture

**Grep Master** is a browser-based game teaching the `grep` command through 15 progressive challenges across 5 levels. Code is organized as ES6 modules in `js/` directory, loaded via `<script type="module" src="js/main.js">`.

### Module Responsibilities

| Module | Exports | Role |
|---|---|---|
| `js/game-data.js` | `GAME_DATA` | 15 challenge definitions, levels, achievements, ASCII art |
| `js/game-engine.js` | `GrepGameEngine` | State machine (score, lives, timer), command parsing, achievements |
| `js/terminal-effects.js` | `TerminalEffects`, `terminalEffects` | Matrix rain, typing animations, Web Audio effects |
| `js/ui.js` | `showScreen`, `showTransition`, `showLoading`, `hideLoading` | Screen/modal management |
| `js/audio.js` | `playClickSound`, `playCommandSound`, `playSuccessSound`, `playErrorSound` | Sound effects with `soundEnabled` guard built-in |
| `js/settings.js` | `gameSettings`, `loadSettings`, `saveSettings`, etc. | User preferences (lives, hints, theme, sound) stored in localStorage |
| `js/animations.js` | Animation functions for Tutorial/About/Settings screens | Staggered fade-in animations with requestAnimationFrame |
| `js/main.js` | Entry point | Boots app, wires event listeners, exposes functions to global scope for backward compatibility |

### Data Flow

1. `index.html` loads `<script type="module" src="js/main.js">`
2. `main.js` imports all modules and initializes: `terminalEffects.init()` → `new GrepGameEngine()` → `game.init()`
3. User interactions trigger event listeners in `main.js` → call game methods → engine simulates grep, validates output
4. Engine reads `GAME_DATA` for expected outputs; plays sounds via `audio.js` (respecting `gameSettings.soundEnabled`); saves progress to `settings.js`
5. UI updates via `game-engine.js` → all modules share `gameSettings` object reference for reactive settings

### `grep_practice/` Directory

A standalone practice file tree (not loaded by the game) with real text, code, config, and log files for hands-on shell practice. Includes `grep_practice_guide.sh` with runnable examples.
