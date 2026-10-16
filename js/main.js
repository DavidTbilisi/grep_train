// Main Application Entry Point

import { terminalEffects } from "./terminal-effects.js";
import { GrepGameEngine } from "./game-engine.js";
import { loadSettings, updateSettingsUI, setSound, setTheme } from "./settings.js";
import { showScreen, showTransition, hideLoading } from "./ui.js";
import { playClickSound, playCommandSound } from "./audio.js";
import { animateTutorialContent, animateSettingsContent } from "./animations.js";
import { attachCommandAutocomplete } from "./command-autocomplete.js";

let game;

function goTo(screenId, afterShow) {
  showTransition(() => {
    showScreen(screenId);
    if (afterShow) afterShow();
  });
}

function backToMenu() {
  game.stop();
  goTo("welcome-screen");
}

function isSuccessModalOpen() {
  return document.getElementById("success-modal").classList.contains("active");
}

function executeCommand() {
  const input = document.getElementById("command-input");
  if (!input.value.trim()) {
    terminalEffects.shakeElement(input);
    return;
  }
  playCommandSound();
  terminalEffects.highlightCommand(input.parentElement);
  game.executeCommand();
}

// Every button declares what it does with data-action="...".
const ACTIONS = {
  practice: () => showTransition(() => game.startPractice()),
  course: () => showTransition(() => game.startCourse()),
  placement: () => showTransition(() => game.startPlacement()),
  skills: () => goTo("skills-screen", () => game.renderSkills()),
  incidents: () => goTo("incidents-screen", () => game.renderIncidents()),
  incident: (button) => showTransition(() => game.startIncident(button.dataset.scenario)),
  "practice-skill": (button) => showTransition(() => game.startPractice(button.dataset.skill)),
  tutorial: () => goTo("tutorial-screen", animateTutorialContent),
  settings: () => goTo("settings-screen", () => {
    updateSettingsUI();
    animateSettingsContent();
  }),
  menu: backToMenu,
  execute: executeCommand,
  hint: () => game.getHint(),
  solution: () => game.showSolution(),
  prev: () => game.previous(),
  next: () => game.skip(),
  choose: (button) => game.answerChoice(Number(button.dataset.choice)),
  continue: () => {
    if (isSuccessModalOpen()) game.continueAfterSuccess();
  },
  "reset-progress": () => {
    if (confirm("Reset all progress: course, skills, and practice?")) {
      game.resetProgress();
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  terminalEffects.init();
  game = new GrepGameEngine();
  game.init();
  const commandInput = document.getElementById("command-input");
  attachCommandAutocomplete(commandInput, () => game);
  commandInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (isSuccessModalOpen()) ACTIONS.continue();
      else executeCommand();
    }
  });

  document.addEventListener("click", (e) => {
    const button = e.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action !== "execute") playClickSound();
    ACTIONS[button.dataset.action](button);
  });

  document.getElementById("sound-toggle").addEventListener("change", (e) => setSound(e.target.checked));
  document.getElementById("theme-select").addEventListener("change", (e) => setTheme(e.target.value));

  hideLoading();
});

// Keyboard shortcuts (ignored while typing in the command input)
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

  if (isSuccessModalOpen() && (e.key === "Enter" || e.key === "Escape")) {
    e.preventDefault();
    ACTIONS.continue();
  } else if (e.key === "Escape" && !document.getElementById("welcome-screen").classList.contains("active")) {
    backToMenu();
  } else if ((e.key === "h" || e.key === "H") && game && game.gameStarted) {
    game.getHint();
  }
});

// Debug handle for the browser console
window.gameDebug = { game: () => game, effects: () => terminalEffects };
