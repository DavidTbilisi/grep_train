# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start   # Serve locally at http://localhost:8000 (python -m http.server 8000)
npm test        # node tests/shell.test.mjs: compares js/shell.js against real bash + GNU coreutils (LC_ALL=C)
npm run lint    # ESLint on js/*.js (ES6 modules)
npm run deploy  # Deploy to GitHub Pages via gh-pages
```

No build step. The project uses native ES6 modules (`type="module"`) in the browser.

## Architecture

**Grep Master** is a browser-based game teaching `grep` and log analysis tools (head, tail, wc, sort, uniq, cut, awk, and pipes) through 16 challenges across 5 levels. There is no timer, no lives, and no game over. Hints cost points, and progress is saved in localStorage.

### Module Responsibilities

| Module | Exports | Role |
|---|---|---|
| `js/shell.js` | `runCommandLine`, `TOOLS` | Pure (DOM-free) simulator: quote-aware parsing, pipes, globs, and the tools. Returns `{output}` or `{error}` |
| `js/game-data.js` | `FILES`, `LEVELS`, `ASCII_ART` | Shared log files and challenge definitions (`solution`, `hints`, `learn`, `files`) |
| `js/game-engine.js` | `GrepGameEngine`, `CHALLENGES` | Challenge flow, output checking, scoring, progress (`grepMasterProgress` key), command history |
| `js/command-autocomplete.js` | `attachCommandAutocomplete` | Tab completion for commands (also after `\|`), per-tool flags, and file names |
| `js/settings.js` | `gameSettings`, `loadSettings`, `setSound`, `setTheme`, ... | Sound + theme, auto-saved to localStorage |
| `js/terminal-effects.js` | `terminalEffects` | Matrix rain, typing animation, scanline, shake/highlight |
| `js/audio.js` | `play*Sound` | Web Audio effects that respect `gameSettings.soundEnabled` |
| `js/ui.js`, `js/animations.js` | screen switching, transitions, staggered fade-ins | |
| `js/main.js` | Entry point | Boots the app and dispatches every `data-action="..."` button through the `ACTIONS` map |

### Key Conventions

- A challenge's expected output is **computed** by running its `solution` through `shell.js`, so never hand-write expected output. Any command that prints the same output passes. The comparison ignores whitespace differences and treats `14 access.log` the same as `14`.
- Buttons in `index.html` use `data-action` attributes, not inline `onclick`.
- When you add a tool or flag to `shell.js`, add a case to `tests/shell.test.mjs` and run `npm test`.

### `grep_practice/` Directory

A standalone practice file tree (not loaded by the game) with real text, code, config, and log files for hands-on shell practice. Includes `grep_practice_guide.sh` with runnable examples.
