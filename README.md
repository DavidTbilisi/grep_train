# 🔍 Grep Master - Terminal Learning Game

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Learn `grep` and the everyday log analysis toolbox by typing real commands against real-looking logs.**

No timers, no lives, no game over. Read the task, type a command, and see what happens.

## 🎮 How to Play

1. Read the challenge and the one-line **Learn** tip.
2. Look at the log files on the left (`app.log`, `access.log`).
3. Type a command and press Enter. Any command that prints the right output wins.
4. Stuck? Open **Show expected output**, take a 💡 hint (−25 points), or reveal the solution (0 points).

Your progress is saved in the browser, so **continue** picks up where you left off.

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
| `awk` | `-F SEP`, programs like `'{print $1, $NF}'`, `'/re/'`, `'$5 == 404 {print $4}'`, `&&`, `\|\|` |
| `ls`, `help`, `clear` | |

## 🌟 Challenges (16)

1. **Finding lines with grep:** basic search, `-i`, `-v`
2. **Useful grep options:** `-c`, `-n`, `-E 'A|B'`
3. **Reading logs:** `head`, `tail`, `wc -l`
4. **Pipes:** `grep | wc -l`, `grep | tail`, picking a column with `awk`/`cut`
5. **Log analysis:** `sort | uniq`, `uniq -c` histograms, filtering with `awk`, top-N reports

## 🚀 Running Locally

```bash
npm run start   # http://localhost:8000
npm test        # compares the shell simulator against real bash + GNU tools
npm run deploy  # publish to GitHub Pages
```

There's no build step. The game is plain HTML/CSS and native ES modules.

## 📁 Project Structure

```
index.html              # Screens: menu, game, cheat sheet, settings
styles.css
js/
├── main.js             # Entry point, wires data-action buttons and keyboard shortcuts
├── game-engine.js      # Challenge flow, scoring, saved progress
├── game-data.js        # Log files, levels, challenges (solution + hints)
├── shell.js            # Pure simulator for grep/cat/head/tail/wc/sort/uniq/cut/awk with pipes
├── command-autocomplete.js
├── settings.js         # Sound + theme
├── terminal-effects.js # Matrix rain, typing, scanline
├── animations.js, audio.js, ui.js
tests/shell.test.mjs    # Simulator vs real bash
grep_practice/          # Standalone files for practicing in a real shell
```

## 🛠️ Adding a Challenge

Add an entry to a level in `js/game-data.js`. You don't write the expected output by hand: it's computed by running `solution` through the simulator.

```javascript
{
  title: "Server errors",
  description: "Show every request that returned a 5xx status.",
  learn: "awk can compare columns numerically: $5 >= 500.",
  files: ["access.log"],
  solution: "awk '$5 >= 500' access.log",
  hints: ["Filter on column 5.", "Use >= 500.", "awk '$5 >= 500' access.log"],
},
```

Then run `npm test` to check that the simulator agrees with real bash.

## 📄 License

MIT
