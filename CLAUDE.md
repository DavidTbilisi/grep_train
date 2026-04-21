# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start   # Serve locally at http://localhost:8000 (python -m http.server 8000)
npm run lint    # ESLint on all root *.js files
npm run deploy  # Deploy to GitHub Pages via gh-pages
```

No build step — the project runs as plain HTML/CSS/JS directly in the browser.

## Architecture

**Grep Master** is a browser-based game teaching the `grep` command through 15 progressive challenges across 5 levels. All JS files are loaded as plain `<script>` tags in `index.html` — no bundler.

### Module Responsibilities

| File | Role |
|---|---|
| `script.js` | App entry point — boots, wires DOM events, delegates to `game` instance |
| `game-engine.js` | `GrepGameEngine` class — state machine (score, lives, timer), command parsing/validation, achievements, leaderboard |
| `game-data.js` | `GAME_DATA` — 15 challenge definitions with `expectedOutput` arrays, level configs, achievement metadata |
| `terminal-effects.js` | `terminalEffects` singleton — Matrix rain, typing animations, Web Audio API sounds |

### Data Flow

`index.html` → `script.js:initializeApp()` → `terminalEffects.init()` + `new GrepGameEngine(GAME_DATA)` → `game.init()`.

User types a grep command → `script.js` forwards to `GrepGameEngine` → engine simulates grep execution in-browser, compares output against `GAME_DATA[challenge].expectedOutput`, updates score/lives/progression.

### `grep_practice/` Directory

A standalone practice file tree (not loaded by the game) with real text, code, config, and log files for hands-on shell practice. Includes `grep_practice_guide.sh` with runnable examples.
