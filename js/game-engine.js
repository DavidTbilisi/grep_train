// Game Engine - runs challenges and feeds every result into the learner model.
//
// Three modes:
//   course     the 16 hand-written challenges in game-data.js, in order
//   practice   generated challenges; the scheduler picks the skill, difficulty,
//              and kind: write a command, fix a broken one, or predict an output
//   placement  a short test; each pass grants the skills used, so experienced
//              players skip what they already know
//   incident   a multi-step investigation of a generated outage (incidents.js)

import { FILES, LEVELS, ASCII_ART } from "./game-data.js";
import { runCommandLine } from "./shell.js";
import { SKILLS, SKILL_BY_ID, detectSkills } from "./skills.js";
import {
  newLearner,
  loadLearner,
  saveLearner,
  skillState,
  outcomeScore,
  recordResult,
  recordMistake,
  grantPlacement,
  masteredCount,
  dueCount,
} from "./learner.js";
import { pickNext, chooseKind } from "./scheduler.js";
import { generatePlacement, PLACEMENT_STEPS } from "./generator.js";
import { generateVariant } from "./variants.js";
import { checkOutput } from "./diagnose.js";
import { renderSkillMap } from "./skill-map.js";
import { SCENARIOS, buildIncident } from "./incidents.js";
import { renderIncidentList } from "./incident-list.js";
import { playSuccessSound } from "./audio.js";
import { showScreen } from "./ui.js";

const POINTS = 100;
const HINT_COST = 25;
const STRUGGLE_RUNS = 3; // wrong runs before the expected output opens by itself
// Reading a command isn't writing one: predicting alone can't master a skill.
const PREDICT_SCORE_CAP = 0.7;

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

// Why the scheduler picked this practice challenge, shown above its title.
const REASONS = {
  new: (skill) => `New skill: ${skill.name}`,
  learn: (skill) => `Practice: ${skill.name}`,
  review: (skill) => `Review: ${skill.name} (mastered earlier, keeping it fresh)`,
  remediate: (skill, from) =>
    from ? `Back to basics: ${skill.name} (it helps with ${from.name})` : `An easier one: ${skill.name}`,
  stretch: (skill) => `Stretch: everything is mastered, so a harder ${skill.name}`,
  focus: (skill) => `Focus: ${skill.name}`,
};

// Looking around (cat FILE, ls) isn't a wrong answer.
const isExploring = (command) => /^(cat|ls)\b[^|]*$/.test(command);
const percent = (mastery) => `${Math.round(mastery * 100)}%`;
const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked storage: progress lasts for this session only
  }
}

class GrepGameEngine {
  constructor() {
    this.storage = browserStorage();
    this.learner = loadLearner(this.storage, CHALLENGES.map((c) => c.skills));
    this.mode = "course"; // "course" | "practice" | "placement"
    this.challenge = null;
    this.attempt = null; // { hintsUsed, wrong, solutionShown, solved, recorded }
    this.pick = null; // the scheduler's choice behind the current practice challenge
    this.focus = null; // a skill the player chose on the skill map
    this.recent = []; // skills of the latest practice challenges
    this.placement = null; // { step, granted, finished }
    this.incident = null; // { data, step, points, notes, finished }
    this.gameStarted = false;
    this.history = [];
    this.historyPos = 0;
  }

  get courseIndex() {
    return Math.max(0, Math.min(this.learner.course.index || 0, CHALLENGES.length - 1));
  }

  // Files of the current challenge (used by Tab autocomplete).
  get currentFiles() {
    return this.challenge ? this.challenge.files : FILES;
  }

  get score() {
    const course = Object.values(this.learner.course.solved).reduce((sum, points) => sum + points, 0);
    return course + this.learner.practice.points;
  }

  get kind() {
    return this.challenge?.kind || "write";
  }

  // Hints, and wrong picks in a predict challenge, each cost HINT_COST.
  get penalties() {
    return this.attempt.hintsUsed + (this.kind === "predict" ? this.attempt.wrong : 0);
  }

  get pointsAvailable() {
    if (this.attempt.solutionShown) return 0;
    return Math.max(HINT_COST, POINTS - this.penalties * HINT_COST);
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

  save() {
    saveLearner(this.storage, this.learner);
  }

  resetProgress() {
    this.replaceLearner(newLearner());
  }

  // Swap in other progress (a reset, or an import) and forget the session's state.
  replaceLearner(learner) {
    this.learner = learner;
    this.mode = "course";
    this.challenge = null;
    this.recent = [];
    this.focus = null;
    this.save();
    this.updateMenu();
  }

  updateMenu() {
    const solved = Object.keys(this.learner.course.solved).length;
    const due = dueCount(this.learner);
    document.getElementById("course-label").textContent = solved ? "continue-course" : "course";
    document.getElementById("placement-label").textContent = this.learner.placementDone
      ? "retake-placement-test"
      : "placement-test";
    const parts = [`${masteredCount(this.learner)}/${SKILLS.length} skills mastered`];
    if (due) parts.push(`${due} review${due === 1 ? "" : "s"} due`);
    if (solved) parts.push(`course ${solved}/${CHALLENGES.length}`);
    const incidents = Object.keys(this.learner.incidents).length;
    if (incidents) parts.push(`${incidents}/${SCENARIOS.length} incidents solved`);
    if (this.score) parts.push(`${this.score} points`);
    document.getElementById("menu-progress").textContent = parts.join(" · ");
  }

  renderSkills() {
    renderSkillMap(document.getElementById("skills-content"), this.learner);
  }

  renderIncidents() {
    renderIncidentList(document.getElementById("incidents-content"), this.learner);
  }

  // ---------- Starting and stopping ----------

  startCourse() {
    this.mode = "course";
    this.enterGame();
    this.loadCourse(this.courseIndex);
  }

  startPractice(focus = null) {
    const resume = this.mode === "practice" && this.challenge && !this.attempt.solved && this.focus === focus;
    this.mode = "practice";
    this.focus = focus;
    this.enterGame();
    if (resume) this.render();
    else this.nextPractice();
  }

  startPlacement() {
    this.mode = "placement";
    this.placement = { step: 0, granted: [], finished: false };
    this.enterGame();
    this.loadPlacementStep();
  }

  startIncident(id) {
    this.mode = "incident";
    this.incident = { data: buildIncident(id, randomSeed()), step: 0, points: 0, notes: [], finished: false };
    this.enterGame();
    this.loadIncidentStep();
  }

  loadIncidentStep() {
    this.setChallenge(this.incident.data.steps[this.incident.step]);
  }

  // Record what the step found (so later steps can build on it), then move on.
  advanceIncident({ skipped = false } = {}) {
    const inc = this.incident;
    inc.notes.push(skipped ? `${this.challenge.note} (skipped)` : this.challenge.note);
    inc.step++;
    if (inc.step >= inc.data.steps.length) this.finishIncident();
    else this.loadIncidentStep();
  }

  finishIncident() {
    const inc = this.incident;
    const { id, title, steps, outro } = inc.data;
    const record = this.learner.incidents[id] || { completed: 0, best: 0 };
    this.learner.incidents[id] = { completed: record.completed + 1, best: Math.max(record.best, inc.points) };
    inc.finished = true;
    this.save();
    this.showModal({
      title: `📁 Case closed: ${title}`,
      text: `${inc.points} of ${steps.length * POINTS} points`,
      items: inc.notes,
      note: outro,
      solution: null,
    });
  }

  enterGame() {
    this.gameStarted = true;
    showScreen("game-screen");
  }

  stop() {
    this.gameStarted = false;
    this.updateMenu();
  }

  // ---------- Loading challenges ----------

  setChallenge(challenge) {
    this.challenge = challenge;
    this.attempt = { hintsUsed: 0, wrong: 0, solutionShown: false, solved: false, recorded: false, eliminated: [] };
    this.render();
  }

  loadCourse(index) {
    this.learner.course.index = Math.max(0, Math.min(index, CHALLENGES.length - 1));
    this.save();
    this.setChallenge(CHALLENGES[this.learner.course.index]);
  }

  nextPractice({ avoid = null } = {}) {
    this.pick = pickNext(this.learner, { focus: this.focus, recent: this.recent, avoid });
    this.recent = [...this.recent, this.pick.skill].slice(-5);
    const kind = chooseKind(this.pick, this.learner, Math.random());
    // Fix challenges prefer the bugs this player makes most.
    const commonMistakes = Object.entries(this.learner.mistakes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([mistake]) => mistake);
    // Don't reuse the template of the previous challenge on the same skill.
    const previous = this.challenge?.skill === this.pick.skill ? this.challenge.template : null;
    this.setChallenge(generateVariant(this.pick.skill, this.pick.difficulty, kind, randomSeed(), commonMistakes, previous));
  }

  loadPlacementStep() {
    this.setChallenge(generatePlacement(this.placement.step, randomSeed()));
  }

  // Skip / I don't know.
  skip() {
    if (this.mode === "placement") {
      this.finishPlacement();
    } else if (this.mode === "incident") {
      this.giveUp();
      this.advanceIncident({ skipped: true });
    } else if (this.mode === "practice") {
      const tried = this.giveUp();
      this.nextPractice({ avoid: tried ? null : this.challenge.skill });
    } else if (this.courseIndex < CHALLENGES.length - 1) {
      this.giveUp();
      this.loadCourse(this.courseIndex + 1);
    }
  }

  previous() {
    if (this.mode !== "course" || this.courseIndex === 0) return;
    this.giveUp();
    this.loadCourse(this.courseIndex - 1);
  }

  // Leaving a challenge after trying it counts as a failed attempt.
  // Returns whether anything was recorded.
  giveUp() {
    const a = this.attempt;
    if (!a || a.solved || a.recorded || this.mode === "placement") return false;
    if (!a.wrong && !a.hintsUsed && !a.solutionShown) return false;
    recordResult(this.learner, this.challenge.skills, 0);
    a.recorded = true;
    this.save();
    return true;
  }

  // Called from the success modal's Continue button.
  continueAfterSuccess() {
    document.getElementById("success-modal").classList.remove("active");
    if (this.mode === "placement") {
      if (this.placement.finished) {
        this.mode = "practice";
        this.focus = null;
        this.nextPractice();
      } else {
        this.loadPlacementStep();
      }
    } else if (this.mode === "practice") {
      this.nextPractice();
    } else if (this.mode === "incident") {
      if (this.incident.finished) {
        this.gameStarted = false;
        this.updateMenu();
        showScreen("incidents-screen");
        this.renderIncidents();
      } else {
        this.advanceIncident();
      }
    } else if (this.courseIndex < CHALLENGES.length - 1) {
      this.loadCourse(this.courseIndex + 1);
    } else {
      this.gameStarted = false;
      this.updateMenu();
      showScreen("welcome-screen");
    }
  }

  // ---------- Rendering ----------

  render() {
    const c = this.challenge;
    const placement = this.mode === "placement";
    const predict = this.kind === "predict";
    let title = c.title;
    let description = c.description;
    let context;
    if (this.mode === "course") {
      title = `${this.courseIndex + 1}. ${c.title}`;
      context = `Level ${c.levelNumber}: ${c.levelTitle}`;
    } else if (placement) {
      title = `Question ${this.placement.step + 1}/${PLACEMENT_STEPS}: ${c.title}`;
      context = "Placement test: no hints. Press \"I don't know\" to stop here.";
    } else if (this.mode === "incident") {
      const { data, step } = this.incident;
      title = `${step + 1}. ${c.title}`;
      context = `Incident: ${data.title} · step ${step + 1} of ${data.steps.length}`;
    } else {
      const from = this.pick.from && SKILL_BY_ID[this.pick.from];
      context = REASONS[this.pick.reason](SKILL_BY_ID[this.pick.skill], from);
    }
    if (this.kind === "fix") {
      title = `Fix it: ${c.title}`;
      description = `Goal: ${c.description} The command below tries, but it has a bug. It's already in the prompt: fix it and run it.`;
    } else if (predict) {
      title = "What does this command print?";
      description = "Read the command and the file, then pick its output: click a choice, or type its number and press Enter.";
    }

    document.getElementById("challenge-title").textContent = title;
    document.getElementById("challenge-level").textContent = context;
    this.renderIncidentNotes();
    document.getElementById("challenge-description").textContent = description;
    const shown = document.getElementById("challenge-command");
    shown.hidden = this.kind === "write";
    shown.textContent = this.kind === "fix" ? c.broken : c.solution;
    document.getElementById("challenge-learn").textContent = c.learn;
    document.getElementById("challenge-learn").parentElement.hidden = placement;
    document.getElementById("expected-output").textContent = c.expected.join("\n") || "(no output)";
    document.getElementById("expected-details").open = false;
    document.getElementById("expected-details").hidden = placement || predict;
    this.renderChoices();

    this.renderFileTree();
    this.showFile(Object.keys(c.files)[0]);
    this.clearOutput();
    this.addOutput(
      predict ? "Pick the output: type its number and press Enter." : "Type a command and press Enter. Type help to list the tools.",
      "info"
    );
    this.updateUI();
    const input = document.getElementById("command-input");
    input.value = this.kind === "fix" ? c.broken : "";
    input.placeholder = predict
      ? `Type 1-${c.choices.length}, or click a choice`
      : "e.g. grep ERROR app.log | wc -l   (Tab completes, ↑ history)";
    input.focus();
  }

  // Incident mode: the story so far, and what earlier steps found.
  renderIncidentNotes() {
    const box = document.getElementById("incident-notes");
    box.hidden = this.mode !== "incident";
    if (box.hidden) return;
    document.getElementById("incident-intro").textContent = this.incident.data.intro;
    const findings = document.getElementById("incident-findings");
    findings.innerHTML = "";
    for (const note of this.incident.notes) {
      const li = document.createElement("li");
      li.textContent = note;
      findings.appendChild(li);
    }
  }

  // The answer choices of a predict challenge.
  renderChoices() {
    const box = document.getElementById("choices");
    box.innerHTML = "";
    box.hidden = this.kind !== "predict";
    if (box.hidden) return;
    // Long log lines read better as full-width rows than in narrow columns.
    const longest = Math.max(...this.challenge.choices.flatMap((choice) => choice.output.map((line) => line.length)));
    box.classList.toggle("wide", longest > 32);
    this.challenge.choices.forEach((choice, i) => {
      const button = document.createElement("button");
      button.className = "choice";
      button.dataset.action = "choose";
      button.dataset.choice = i;
      const eliminated = this.attempt.eliminated.includes(i);
      button.disabled = eliminated || this.attempt.solved;
      if (eliminated) button.classList.add("wrong");
      if (choice.correct && (this.attempt.solved || this.attempt.solutionShown)) button.classList.add("right");
      const number = document.createElement("span");
      number.className = "choice-number";
      number.textContent = i + 1;
      const output = document.createElement("pre");
      output.textContent = choice.output.join("\n") || "(an empty line)";
      button.append(number, output);
      box.appendChild(button);
    });
  }

  answerChoice(index) {
    const choice = this.challenge.choices?.[index];
    if (!choice || this.attempt.solved || this.attempt.eliminated.includes(index)) return;
    if (choice.correct) {
      this.attempt.solved = true;
      this.renderChoices();
      this.challengeSuccess(this.challenge.solution);
      return;
    }
    this.attempt.eliminated.push(index);
    this.attempt.wrong++;
    this.addOutput(`Not ${index + 1}. ${choice.why}`, "warning");
    this.renderChoices();
    this.updateUI();
  }

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

  updateUI() {
    const c = this.challenge;
    const course = this.mode === "course";
    const placement = this.mode === "placement";
    const solved = course && this.courseIndex in this.learner.course.solved;

    document.getElementById("stat-label").textContent = course ? "Level" : "Mastered";
    document.getElementById("current-level").textContent = course
      ? c.levelNumber
      : `${masteredCount(this.learner)}/${SKILLS.length}`;
    document.getElementById("current-score").textContent = this.score;

    let progress;
    if (course) progress = `Challenge ${this.courseIndex + 1}/${CHALLENGES.length}`;
    else if (placement) progress = `Question ${this.placement.step + 1}/${PLACEMENT_STEPS}`;
    else if (this.mode === "incident") progress = `Step ${this.incident.step + 1}/${this.incident.data.steps.length}`;
    else progress = `${SKILL_BY_ID[c.skill].name}: ${percent(skillState(this.learner, c.skill).mastery)} mastered`;
    document.getElementById("challenge-progress").textContent = progress;

    const points = document.getElementById("challenge-points");
    points.parentElement.hidden = placement;
    points.textContent = solved ? "solved ✓" : `${this.pointsAvailable} pts`;

    document.getElementById("btn-prev").disabled = !course || this.courseIndex === 0;
    const next = document.getElementById("btn-next");
    next.textContent = placement ? "I don't know →" : this.mode === "incident" ? "Skip step →" : "Skip →";
    next.disabled = course && this.courseIndex === CHALLENGES.length - 1;
    document.getElementById("btn-hint").disabled = placement;
    document.getElementById("btn-solution").disabled = placement;
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
    if (this.kind === "predict") {
      const count = this.challenge.choices.length;
      if (/^\d+$/.test(command) && Number(command) >= 1 && Number(command) <= count) {
        this.answerChoice(Number(command) - 1);
      } else {
        this.addOutput(`This one is about reading, not running: pick an answer by its number (1-${count}).`, "warning");
      }
      return;
    }

    const result = runCommandLine(command, this.challenge.files);
    if (result.error) {
      this.addOutput(result.error, "error");
      if (!isExploring(command)) this.wrongAnswer();
      return;
    }

    result.output.forEach((line) => this.addOutput(line));
    if (result.output.length === 0) this.addOutput("(no output)", "dim");
    this.checkAnswer(result.output, command);
  }

  checkAnswer(output, command) {
    const c = this.challenge;
    const check = checkOutput(output, c.expected, Object.keys(c.files), command, c.solution);
    if (check.correct) {
      this.challengeSuccess(command);
      return;
    }
    if (isExploring(command)) return;

    const { kind, message, skill } = check.diagnosis;
    this.addOutput(message, "warning");
    if (this.mode !== "placement" && kind !== "mismatch") {
      recordMistake(this.learner, skill, kind);
      this.save();
    }
    this.wrongAnswer();
  }

  wrongAnswer() {
    this.attempt.wrong++;
    if (this.attempt.wrong === STRUGGLE_RUNS && this.mode !== "placement") {
      document.getElementById("expected-details").open = true;
      this.addOutput("Tip: the expected output is open above. Compare it with yours, or take a 💡 hint.", "info");
    }
  }

  challengeSuccess(command) {
    const c = this.challenge;
    this.attempt.solved = true;
    if (this.mode === "placement") {
      this.placementPassed(command);
      return;
    }

    // Credit the skills the command actually used; a failure counts against
    // the skills the challenge was meant to practise.
    const predict = this.kind === "predict";
    let score = outcomeScore({ ...this.attempt, hintsUsed: this.penalties, wrong: predict ? 0 : this.attempt.wrong });
    if (predict) score = Math.min(score, PREDICT_SCORE_CAP);
    const used = detectSkills(command);
    const changes = recordResult(this.learner, score > 0 && used.length ? used : c.skills, score);
    this.attempt.recorded = true;

    let pointsText;
    if (this.mode === "course") {
      const alreadySolved = this.courseIndex in this.learner.course.solved;
      const earned = alreadySolved ? 0 : this.pointsAvailable;
      if (!alreadySolved) this.learner.course.solved[this.courseIndex] = earned;
      pointsText = alreadySolved ? "Already solved, no new points." : `+${earned} points (total ${this.score})`;
    } else {
      const earned = this.pointsAvailable;
      this.learner.practice.points += earned;
      this.learner.practice.solved++;
      if (this.mode === "incident") this.incident.points += earned;
      pointsText = `+${earned} points (total ${this.score})`;
    }
    this.save();
    this.updateUI();
    playSuccessSound();

    const unused = score > 0 && !predict ? c.skills.filter((id) => !used.includes(id)) : [];
    const isLastCourse = this.mode === "course" && this.courseIndex === CHALLENGES.length - 1;
    let title = this.mode === "incident" ? `🔎 Found it: ${c.note}` : "🎉 Challenge complete!";
    if (changes.some((change) => change.newlyMastered)) title = "⭐ Skill mastered!";
    if (isLastCourse) title = "🏆 You finished every challenge!";

    this.showModal({
      title,
      text: pointsText,
      items: changes.map(
        (ch) => `${SKILL_BY_ID[ch.id].name}: ${percent(ch.before)} → ${percent(ch.after)}${ch.newlyMastered ? "  ★ mastered" : ""}`
      ),
      note: [
        this.kind === "fix" ? `The bug: ${c.bug}` : "",
        unused.length
          ? `This one was about ${unused.map((id) => SKILL_BY_ID[id].name).join(", ")}. Your command didn't use it, so it doesn't count for that yet.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      solution: c.solution,
      solutionLabel: this.kind === "predict" ? "The command:" : "One way to solve it:",
    });
  }

  placementPassed(command) {
    const used = detectSkills(command);
    const granted = grantPlacement(this.learner, used.length ? used : this.challenge.skills);
    this.placement.granted.push(...granted);
    this.placement.step++;
    this.save();
    if (this.placement.step >= PLACEMENT_STEPS) {
      this.finishPlacement();
      return;
    }
    this.showModal({
      title: "✅ Correct!",
      text: `Question ${this.placement.step}/${PLACEMENT_STEPS} done.`,
      items: granted.map((id) => `${SKILL_BY_ID[id].name}: tested out`),
      solution: this.challenge.solution,
    });
  }

  finishPlacement() {
    const { granted } = this.placement;
    this.placement.finished = true;
    this.learner.placementDone = true;
    this.save();
    this.updateUI();
    this.showModal({
      title: "📋 Placement complete",
      text: granted.length
        ? `You tested out of ${granted.length} skill${granted.length === 1 ? "" : "s"}. Practice will start from there, and reviews will check them again in a few days.`
        : "No skills tested out yet, so practice starts from the basics.",
      items: granted.map((id) => SKILL_BY_ID[id].name),
      solution: null,
    });
  }

  showModal({ title, text, items = [], note = "", solution = null, solutionLabel = "One way to solve it:" }) {
    document.getElementById("success-title").textContent = title;
    document.getElementById("success-points").textContent = text;
    const list = document.getElementById("success-skills");
    list.innerHTML = "";
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
    document.getElementById("success-note").textContent = note;
    document.getElementById("success-solution-block").hidden = !solution;
    document.getElementById("success-solution-label").textContent = solutionLabel;
    document.getElementById("success-solution").textContent = solution || "";
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
    if (this.mode === "placement") {
      this.addOutput("No hints in the placement test. Press \"I don't know →\" to stop here.", "warning");
      return;
    }
    if (this.kind === "predict") {
      this.eliminateChoice();
      return;
    }
    const { hints } = this.challenge;
    if (this.attempt.hintsUsed >= hints.length) {
      this.addOutput("No more hints. Try Show Solution.", "warning");
      return;
    }
    this.addOutput(`💡 Hint ${this.attempt.hintsUsed + 1}/${hints.length}: ${hints[this.attempt.hintsUsed]}`, "info");
    this.attempt.hintsUsed++;
    this.updateUI();
  }

  showSolution() {
    if (this.mode === "placement") {
      this.getHint();
      return;
    }
    this.attempt.solutionShown = true;
    if (this.kind === "predict") {
      const answer = this.challenge.choices.findIndex((choice) => choice.correct) + 1;
      this.addOutput(`💡 The answer is ${answer}. Pick it to continue.`, "info");
      this.renderChoices();
    } else {
      this.addOutput(`💡 Solution: ${this.challenge.solution}`, "info");
      this.addOutput("Type it in yourself to finish the challenge.", "info");
    }
    this.updateUI();
  }

  // A predict challenge's hint: rule out one wrong answer, and say why.
  eliminateChoice() {
    const left = this.challenge.choices
      .map((choice, i) => i)
      .filter((i) => !this.challenge.choices[i].correct && !this.attempt.eliminated.includes(i));
    if (left.length <= 1) {
      this.addOutput("No more hints. Try Show Solution.", "warning");
      return;
    }
    const index = left[Math.floor(Math.random() * left.length)];
    this.attempt.eliminated.push(index);
    this.attempt.hintsUsed++;
    this.addOutput(`💡 It's not ${index + 1}. ${this.challenge.choices[index].why}`, "info");
    this.renderChoices();
    this.updateUI();
  }

  // ---------- Output ----------

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
}

export { GrepGameEngine, CHALLENGES };
