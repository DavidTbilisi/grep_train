// Game Engine - challenge flow, scoring, and saved progress.

import { FILES, LEVELS, ASCII_ART } from "./game-data.js";
import { runCommandLine } from "./shell.js";
import { playSuccessSound } from "./audio.js";
import { showScreen } from "./ui.js";

const POINTS = 100;
const HINT_COST = 25;
const PROGRESS_KEY = "grepMasterProgress";

// One flat list, each challenge knowing its level and expected output.
const CHALLENGES = LEVELS.flatMap((level, levelIndex) =>
  level.challenges.map((challenge) => {
    const files = Object.fromEntries(challenge.files.map((name) => [name, FILES[name]]));
    return {
      ...challenge,
      files,
      levelNumber: levelIndex + 1,
      levelTitle: level.title,
      expected: runCommandLine(challenge.solution, files).output,
    };
  })
);

const HELP = [
  "Available commands (combine them with |):",
  "  grep PATTERN FILE   lines matching PATTERN  (-i -v -c -n -w -o -E -A -B -C)",
  "  cat FILE            print a whole file",
  "  head -n N FILE      first N lines",
  "  tail -n N FILE      last N lines",
  "  wc -l FILE          count lines",
  "  sort                sort lines  (-n numeric, -r reverse, -u unique, -k N column)",
  "  uniq                drop repeated lines  (-c count them)",
  "  cut -d' ' -f N      pick column N",
  "  awk '{print $N}'    pick column N  (filter: awk '$5 == 404')",
  "  ls / clear / help",
];

// Compare outputs loosely: ignore extra spaces, and treat "14 access.log"
// (from wc -l FILE) the same as "14" (from cat FILE | wc -l).
function normalize(lines, fileNames) {
  return lines.map((line) => {
    const clean = line.trim().replace(/\s+/g, " ");
    const m = clean.match(/^(\d+) (\S+)$/);
    return m && fileNames.includes(m[2]) ? m[1] : clean;
  });
}

class GrepGameEngine {
  constructor() {
    this.index = 0;
    this.solved = {}; // challenge index -> points earned
    this.hintsUsed = 0;
    this.solutionShown = false;
    this.gameStarted = false;
    this.history = [];
    this.historyPos = 0;
    this.loadProgress();
  }

  get challenge() {
    return CHALLENGES[this.index];
  }

  // Files of the current challenge (used by Tab autocomplete).
  get currentFiles() {
    return this.challenge.files;
  }

  get score() {
    return Object.values(this.solved).reduce((sum, points) => sum + points, 0);
  }

  get pointsAvailable() {
    if (this.solutionShown) return 0;
    return Math.max(HINT_COST, POINTS - this.hintsUsed * HINT_COST);
  }

  init() {
    document.getElementById("ascii-logo").textContent = ASCII_ART;
    const input = document.getElementById("command-input");
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        this.browseHistory(e.key === "ArrowUp" ? -1 : 1);
      }
    });
    this.updateMenu();
  }

  // ---------- Progress ----------

  loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (saved) {
        this.index = Math.min(saved.index || 0, CHALLENGES.length - 1);
        this.solved = saved.solved || {};
      }
    } catch {
      // Corrupt or unavailable storage: start fresh.
    }
  }

  saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ index: this.index, solved: this.solved }));
    } catch {
      // Storage unavailable (private mode): progress just won't persist.
    }
  }

  resetProgress() {
    this.index = 0;
    this.solved = {};
    this.saveProgress();
    this.updateMenu();
  }

  updateMenu() {
    const solvedCount = Object.keys(this.solved).length;
    const label = document.getElementById("start-label");
    if (label) label.textContent = solvedCount ? "continue" : "start-game";
    const progress = document.getElementById("menu-progress");
    if (progress) {
      progress.textContent = solvedCount
        ? `${solvedCount}/${CHALLENGES.length} challenges solved · ${this.score} points`
        : "";
    }
  }

  // ---------- Flow ----------

  startGame() {
    this.gameStarted = true;
    showScreen("game-screen");
    this.loadChallenge(this.index);
  }

  loadChallenge(index) {
    this.index = Math.max(0, Math.min(index, CHALLENGES.length - 1));
    this.hintsUsed = 0;
    this.solutionShown = false;
    this.saveProgress();

    const c = this.challenge;
    document.getElementById("challenge-title").textContent = `${this.index + 1}. ${c.title}`;
    document.getElementById("challenge-level").textContent = `Level ${c.levelNumber}: ${c.levelTitle}`;
    document.getElementById("challenge-description").textContent = c.description;
    document.getElementById("challenge-learn").textContent = c.learn;
    document.getElementById("expected-output").textContent = c.expected.join("\n") || "(no output)";
    document.getElementById("expected-details").open = false;

    this.renderFileTree();
    this.showFile(Object.keys(c.files)[0]);
    this.clearOutput();
    this.addOutput("Type a command and press Enter. Type help to list the tools.", "info");
    this.updateUI();
    document.getElementById("command-input").focus();
  }

  nextChallenge() {
    if (this.index < CHALLENGES.length - 1) this.loadChallenge(this.index + 1);
  }

  previousChallenge() {
    if (this.index > 0) this.loadChallenge(this.index - 1);
  }

  // Called from the success modal's Continue button.
  continueAfterSuccess() {
    document.getElementById("success-modal").classList.remove("active");
    if (this.index < CHALLENGES.length - 1) {
      this.nextChallenge();
    } else {
      this.gameStarted = false;
      this.updateMenu();
      showScreen("welcome-screen");
    }
  }

  // ---------- Files ----------

  renderFileTree() {
    const tree = document.getElementById("file-tree-content");
    tree.innerHTML = "";
    for (const name of Object.keys(this.challenge.files)) {
      const item = document.createElement("div");
      item.className = "file-item";
      item.dataset.file = name;
      item.innerHTML = `<span class="file-icon">📄</span><span class="file-name"></span>`;
      item.querySelector(".file-name").textContent = name;
      item.addEventListener("click", () => this.showFile(name));
      tree.appendChild(item);
    }
  }

  showFile(name) {
    const lines = this.challenge.files[name].replace(/\n$/, "").split("\n");
    document.getElementById("current-file").textContent = name;
    document.getElementById("file-content").textContent = lines
      .map((line, i) => `${String(i + 1).padStart(3)}  ${line}`)
      .join("\n");
    document.querySelectorAll(".file-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.file === name);
    });
  }

  // ---------- Commands ----------

  executeCommand() {
    const input = document.getElementById("command-input");
    const command = input.value.trim();
    input.value = "";
    if (!command) return;

    this.history.push(command);
    this.historyPos = this.history.length;
    this.addOutput(`$ ${command}`, "command");

    if (command === "clear") {
      this.clearOutput();
      return;
    }
    if (command === "help") {
      HELP.forEach((line) => this.addOutput(line, "info"));
      return;
    }

    const result = runCommandLine(command, this.challenge.files);
    if (result.error) {
      this.addOutput(result.error, "error");
      return;
    }

    result.output.forEach((line) => this.addOutput(line));
    if (result.output.length === 0) this.addOutput("(no output)", "dim");
    this.checkAnswer(result.output);
  }

  checkAnswer(output) {
    const names = Object.keys(this.challenge.files);
    const got = normalize(output, names);
    const want = normalize(this.challenge.expected, names);

    if (got.length === want.length && got.every((line, i) => line === want[i])) {
      this.challengeSuccess();
    } else if (got.length !== want.length) {
      this.addOutput(`Not quite: expected ${want.length} line(s), got ${got.length}.`, "warning");
    } else {
      this.addOutput("Close: right number of lines, but some don't match.", "warning");
    }
  }

  challengeSuccess() {
    const alreadySolved = this.index in this.solved;
    const earned = alreadySolved ? 0 : this.pointsAvailable;
    if (!alreadySolved) this.solved[this.index] = earned;
    this.saveProgress();
    this.updateUI();
    playSuccessSound();

    const isLast = this.index === CHALLENGES.length - 1;
    document.getElementById("success-title").textContent = isLast
      ? "🏆 You finished every challenge!"
      : "🎉 Challenge complete!";
    document.getElementById("success-points").textContent = alreadySolved
      ? "Already solved, no new points."
      : `+${earned} points (total ${this.score})`;
    document.getElementById("success-solution").textContent = this.challenge.solution;
    document.getElementById("success-modal").classList.add("active");
    // Release focus so Enter/Escape reach the global handler and close the modal.
    document.activeElement.blur();
  }

  browseHistory(direction) {
    if (!this.history.length) return;
    this.historyPos = Math.max(0, Math.min(this.history.length, this.historyPos + direction));
    document.getElementById("command-input").value = this.history[this.historyPos] ?? "";
  }

  // ---------- Help ----------

  getHint() {
    const { hints } = this.challenge;
    if (this.hintsUsed >= hints.length) {
      this.addOutput("No more hints. Try Show Solution.", "warning");
      return;
    }
    this.addOutput(`💡 Hint ${this.hintsUsed + 1}/${hints.length}: ${hints[this.hintsUsed]}`, "info");
    this.hintsUsed++;
    this.updateUI();
  }

  showSolution() {
    this.solutionShown = true;
    this.addOutput(`💡 Solution: ${this.challenge.solution}`, "info");
    this.addOutput("Type it in yourself to finish the challenge.", "info");
    this.updateUI();
  }

  // ---------- UI ----------

  addOutput(text, type = "") {
    const output = document.getElementById("output-content");
    const line = document.createElement("div");
    line.className = `output-line ${type}`;
    line.textContent = text;
    output.appendChild(line);
    output.parentElement.scrollTop = output.parentElement.scrollHeight;
  }

  clearOutput() {
    document.getElementById("output-content").innerHTML = "";
  }

  updateUI() {
    const solved = this.index in this.solved;
    document.getElementById("current-level").textContent = this.challenge.levelNumber;
    document.getElementById("current-score").textContent = this.score;
    document.getElementById("challenge-progress").textContent = `${this.index + 1}/${CHALLENGES.length}`;
    document.getElementById("challenge-points").textContent = solved
      ? "solved ✓"
      : `${this.pointsAvailable} pts`;
    document.getElementById("btn-prev").disabled = this.index === 0;
    document.getElementById("btn-next").disabled = this.index === CHALLENGES.length - 1;
  }
}

export { GrepGameEngine, CHALLENGES };
