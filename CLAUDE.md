# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start   # Serve locally at http://localhost:8000 (python -m http.server 8000)
npm test        # node --test "tests/*.test.mjs" (Node 21+): unit tests, plus shell.js and generated challenges vs real bash + GNU coreutils (LC_ALL=C)
npm run lint    # ESLint 9 (eslint.config.js) on js/ and tests/; needs `npm install` first
```

No build step. The project uses native ES6 modules (`type="module"`) in the browser.

Deploy = push to `main`: GitHub Pages (legacy build) serves the repo root of `main`. `.github/workflows/test.yml` runs lint + tests on push/PR (it installs gawk, since the tests compare against GNU tools).

## Architecture

**Grep Master** is a browser-based game teaching `grep` and log analysis tools (head, tail, wc, sort, uniq, cut, awk, and pipes). There is no timer, no lives, and no game over. Hints cost points. Three modes: **course** (16 hand-written challenges across 5 levels), **practice** (adaptive: generated challenges picked per learner), **placement** (a no-hints test that grants skills), and **incidents** (multi-step investigations of a generated outage). No backend: everything runs in the browser and the learner model is saved in localStorage (`grepMasterLearner`, which migrates the old `grepMasterProgress` key).

### Module Responsibilities

| Module | Exports | Role |
|---|---|---|
| `js/awk.js` | `compileAwk`, `AwkError` | Pure. awk interpreter used by shell.js: BEGIN/END, variables, arrays, for-in, if/else, print/printf, a few builtins. Numbers format like gawk (%.6g, round-half-to-even on exact ties). for-in uses insertion order (real awk's is unspecified), so templates always pipe it into sort |
| `js/shell.js` | `runCommandLine`, `TOOLS` | Pure (DOM-free) simulator: quote-aware parsing, pipes, globs, and the tools. Returns `{output}` or `{error}` |
| `js/game-data.js` | `FILES`, `LEVELS`, `ASCII_ART` | Course log files and challenge definitions (`solution`, `hints`, `learn`, `files`, `skills`) |
| `js/skills.js` | `SKILLS`, `SKILL_BY_ID`, `ancestors`, `detectSkills` | Pure. The 22 skills (core log tools, the awk totals track, then the regex track), their prerequisites (array order = teaching order), and which skills a command line uses |
| `js/learner.js` | `loadLearner`, `recordResult`, `outcomeScore`, `grantPlacement`, ... | Pure. Mastery per skill (EWMA, mastered at >= 0.75 after 3 results), spaced review (1/3/7/14/30 days), storage injected |
| `js/scheduler.js` | `pickNext`, `chooseKind` | Pure. Next skill + difficulty: remediate > due review > learning > new > stretch; then the kind (predict when new, fix when remediating, a mix otherwise) |
| `js/generator.js` | `generateChallenge`, `generatePlacement`, `TEMPLATES` | Pure. Seeded generator for app.log, access.log, and error.log (stack traces), and per-skill challenge templates (difficulty 1-3) |
| `js/variants.js` | `generateVariant`, `MUTATIONS`, `makeFix`, `makePredict` | Pure. Realistic mistakes applied to a solution; turn a generated challenge into "fix" (broken command to repair) or "predict" (multiple choice; wrong choices are mutants' outputs). Falls back to "write" |
| `js/diagnose.js` | `checkOutput`, `diagnose` | Pure. Answer comparison and wrong-answer diagnosis (kind, message, skill) |
| `js/incidents.js` | `SCENARIOS`, `buildIncident`, `scenarioSkills` | Pure. Scenarios: `build(r)` generates logs with the incident injected and returns the facts; each step's `make(facts)` returns question, solution, hints, and a `note` for the case notes. Steps are write challenges, so results feed the learner model |
| `js/incident-list.js` | `renderIncidentList`, `missingSkills` | Incidents screen: readiness per scenario and a suggestion |
| `js/skill-map.js` | `renderSkillMap` | Skill map screen |
| `js/game-engine.js` | `GrepGameEngine`, `CHALLENGES` | Course/practice/placement flow, scoring, feeding results into the learner model, command history |
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
- Skill credit comes from `detectSkills(command)`, so every challenge's (and template's) solution must use the skills it is tagged with. The tests enforce this.
- Generator templates return `null` when the generated log doesn't suit them (e.g. a tie for the top visitor); `build` then tries fresh logs. Generated byte counts never contain a status code, and no IP is a prefix of another, so plain `grep` patterns stay exact.
- Keep the learning logic (skills, learner, scheduler, generator, variants, diagnose) DOM-free so it stays testable in Node.
- A mutation in `variants.js` has a `kind` (reuse a `diagnose.js` kind where one fits, so fix challenges can target a player's common mistakes) and is only used when it really changes the output. Predict scores are capped at 0.7, so predicting alone never reaches mastery.

### `grep_practice/` Directory

A standalone practice file tree (not loaded by the game) with real text, code, config, and log files for hands-on shell practice. Includes `grep_practice_guide.sh` with runnable examples.
