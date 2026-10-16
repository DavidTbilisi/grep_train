# 🔍 Grep Master - Terminal Learning Game

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Learn `grep` and the everyday log analysis toolbox by typing real commands against real-looking logs.**

No timers, no lives, no game over. Read the task, type a command, and see what happens.
Practice mode adapts to you: it tracks what you've mastered and picks what you need next.

## 🎮 How to Play

From the menu, pick a mode:

- **practice**: endless generated challenges, chosen for you (see below)
- **course**: the 16 hand-written challenges, in order
- **incidents**: investigate a generated outage step by step: a break-in, a slow checkout, a crash flood, a bandwidth hog. Each answer leads to the next, findings collect in the case notes, and every play has new logs. The screen suggests the next case you have the skills for.
- **placement-test**: 8 questions without hints; each one you pass marks its skills as known so practice skips ahead
- **skills**: your skill map, with mastery, review dates, your most common mistakes, and a button to practise any skill

Then:

1. Read the challenge and the one-line **Learn** tip.
2. Look at the log files on the left (`app.log`, `access.log`).
3. Type a command and press Enter. Any command that prints the right output wins.
4. Stuck? Open **Show expected output**, take a 💡 hint (−25 points), or reveal the solution (0 points).

Your progress is saved in the browser. To move it to another device, open **settings**: *Export file* saves a `.json` file and *Copy code* gives a short text code; *Import file* / *Import code* load either one (replacing the progress there, after a confirmation).

## 🧠 How Practice Adapts

- **22 skills**, each with prerequisites: grep basics, -i, -v, -c, -n, -E, head/tail, wc, pipes, columns, sort | uniq, uniq -c, awk filters, top-N reports, an awk totals track (sums with `END`, averages and maximums, totals per key with arrays), and a regex track (`^`/`$` anchors, `[0-9]` classes, `-w` whole words, `+`/`{n}` repetition, `-o` extraction).
- **Mastery** per skill goes from 0 to 100%. Every result moves it towards how well you did: a clean first-try solve counts most, wrong runs and hints count less, revealing the solution or giving up after trying counts as a miss. Three clean solves in a row master a skill.
- **Credit for what you actually used.** Solve "count the errors" with `grep | wc -l` instead of `grep -c`, and pipes and wc get the credit, not `-c`, so `-c` comes back.
- **Wrong answers are diagnosed**: wrong order, `uniq` without `sort`, lines instead of a count, missing `-i`, inverted `-v`, wrong column, and more. Each one names the fix.
- **Picking the next challenge**: two misses in a row step back to the weakest prerequisite (or an easier version); otherwise reviews that are due come first, then the skill you're learning, then the next new skill whose prerequisites are in place. Difficulty (1-3) rises with mastery.
- **Spaced review**: mastered skills come back after 1, 3, 7, 14, and 30 days.
- **Three kinds of challenge**: *predict* (read a command and pick what it prints; wrong choices are what common mistakes print), *fix* (a nearly-right command with a realistic bug, already in the prompt), and *write* (from scratch). New skills start with predict, struggling turns into fix, fix challenges target your most common mistakes, and familiar skills get a mix. Predicting alone can't master a skill: that takes writing.
- **Fresh logs every time**: practice challenges are generated from a seed, with new `app.log`, `access.log`, and `error.log` (errors with Java-style stack traces) content, so you can't just memorize answers.

**Keys:** `Enter` run · `Tab` autocomplete · `↑`/`↓` command history · `h` hint · `Esc` menu

## 🧰 Supported Commands

Commands can be chained with pipes (`|`), and arguments can use `'single'` and `"double"` quotes.

| Command | Options |
|---|---|
| `grep PATTERN FILE` | `-i -v -c -n -w -o -l -h -H -E -A N -B N -C N` (basic and extended regex) |
| `cat` | `-n` |
| `head`, `tail` | `-n N`, `-N` |
| `wc` | `-l -w -c` |
| `sort` | `-n -r -u -k N[,M] -t SEP` |
| `uniq` | `-c -d -u` |
| `cut` | `-d SEP -f LIST`, `-c LIST` |
| `awk` | `-F SEP`; a real (small) interpreter: patterns, `BEGIN`/`END`, variables, arrays, `for (k in a)`, `if`/`else`, `print`/`printf`, `length substr index tolower toupper int sprintf`. Numbers print exactly like gawk |
| `ls`, `help`, `clear` | |

## 🌟 Challenges (16)

1. **Finding lines with grep:** basic search, `-i`, `-v`
2. **Useful grep options:** `-c`, `-n`, `-E 'A|B'`
3. **Reading logs:** `head`, `tail`, `wc -l`
4. **Pipes:** `grep | wc -l`, `grep | tail`, picking a column with `awk`/`cut`
5. **Log analysis:** `sort | uniq`, `uniq -c` histograms, filtering with `awk`, top-N reports

## 🚀 Running Locally

```bash
npm install     # dev tools (ESLint) only; the game itself has no dependencies
npm run start   # http://localhost:8000
npm test        # unit tests + the shell simulator and generated challenges vs real bash (Node 21+)
npm run lint    # ESLint
```

There's no build step. The game is plain HTML/CSS and native ES modules.

**Deploying:** push to `main`. GitHub Pages serves the repository root of `main` directly, and GitHub Actions runs lint and tests on every push and pull request.

## 📁 Project Structure

```
index.html              # Screens: menu, game, cheat sheet, settings
styles.css
js/
├── main.js             # Entry point, wires data-action buttons and keyboard shortcuts
├── game-engine.js      # Course / practice / placement flow, scoring
├── game-data.js        # Course log files, levels, challenges (solution + hints + skills)
├── shell.js            # Pure simulator for grep/cat/head/tail/wc/sort/uniq/cut/awk with pipes
├── awk.js              # The awk interpreter (tokenizer, parser, gawk-compatible number formatting)
├── skills.js           # Skill graph + which skills a command uses
├── learner.js          # Mastery model, spaced review, saved progress
├── scheduler.js        # Picks the next skill and difficulty
├── generator.js        # Seeded log generator + challenge templates per skill
├── variants.js         # Fix-the-command and predict-the-output challenges, built from realistic mistakes
├── diagnose.js         # Answer checking and wrong-answer diagnosis
├── incidents.js        # Incident scenarios: story, generated logs with the incident injected, steps
├── incident-list.js    # Incidents screen
├── skill-map.js        # Skill map screen
├── progress-io.js      # Export/import format: files, codes, validation
├── progress-ui.js      # Settings buttons for export/import
├── command-autocomplete.js
├── settings.js         # Sound + theme
├── terminal-effects.js # Matrix rain, typing, scanline
├── animations.js, audio.js, ui.js
tests/                  # node --test: simulator and generator vs real bash, learner, scheduler, diagnosis
grep_practice/          # Standalone files for practicing in a real shell
```

## 🛠️ Adding a Challenge

Add an entry to a level in `js/game-data.js`. You don't write the expected output by hand: it's computed by running `solution` through the simulator. `skills` lists the skill ids from `js/skills.js` it practises.

```javascript
{
  title: "Server errors",
  description: "Show every request that returned a 5xx status.",
  learn: "awk can compare columns numerically: $5 >= 500.",
  files: ["access.log"],
  solution: "awk '$5 >= 500' access.log",
  skills: ["awk-filter"],
  hints: ["Filter on column 5.", "Use >= 500.", "awk '$5 >= 500' access.log"],
},
```

Then run `npm test` to check that the simulator agrees with real bash.

For practice mode, add a template to `TEMPLATES` in `js/generator.js` instead: a function that writes the task, hints, and solution against freshly generated logs. The tests check every template over many seeds, including against real bash.

## 📄 License

MIT
