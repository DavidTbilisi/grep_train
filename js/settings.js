import { playClickSound } from './audio.js';

const DEFAULT_SETTINGS = {
  lives: 3,
  hints: 2,
  difficulty: "normal",
  soundEnabled: true,
  animationsEnabled: true,
  theme: "matrix",
  autoProgress: false,
  showSolution: true,
};

export let gameSettings = { ...DEFAULT_SETTINGS };

export function loadSettings() {
  const saved = localStorage.getItem("grepMasterSettings");
  if (saved) {
    gameSettings = { ...gameSettings, ...JSON.parse(saved) };
  }
  updateSettingsUI();
}

export function saveSettings(event) {
  localStorage.setItem("grepMasterSettings", JSON.stringify(gameSettings));
  playClickSound();

  const button = event.target;
  const originalText = button.textContent;
  button.textContent = "Saved! ✓";
  button.style.background = "#00ff41";
  button.style.color = "#0a1a20";

  setTimeout(() => {
    button.textContent = originalText;
    button.style.background = "";
    button.style.color = "";
  }, 1500);
}

export function updateSettingsUI() {
  document.getElementById("lives-display").textContent = gameSettings.lives;
  document.getElementById("hints-display").textContent = gameSettings.hints;
  document.getElementById("difficulty-select").value = gameSettings.difficulty;
  document.getElementById("sound-toggle").checked = gameSettings.soundEnabled;
  document.getElementById("animations-toggle").checked =
    gameSettings.animationsEnabled;
  document.getElementById("theme-select").value = gameSettings.theme;
  document.getElementById("auto-progress-toggle").checked =
    gameSettings.autoProgress;
  document.getElementById("show-solution-toggle").checked =
    gameSettings.showSolution;
}

export function adjustSetting(type, delta) {
  playClickSound();

  if (type === "lives") {
    gameSettings.lives = Math.max(1, Math.min(10, gameSettings.lives + delta));
  } else if (type === "hints") {
    gameSettings.hints = Math.max(0, Math.min(5, gameSettings.hints + delta));
  }

  updateSettingsUI();
}

export function updateDifficulty() {
  playClickSound();
  gameSettings.difficulty = document.getElementById("difficulty-select").value;

  switch (gameSettings.difficulty) {
    case "easy":
      gameSettings.lives = Math.max(gameSettings.lives, 5);
      gameSettings.hints = Math.max(gameSettings.hints, 3);
      break;
    case "hard":
      gameSettings.lives = Math.min(gameSettings.lives, 2);
      gameSettings.hints = Math.min(gameSettings.hints, 1);
      break;
    case "expert":
      gameSettings.lives = Math.min(gameSettings.lives, 1);
      gameSettings.hints = 0;
      break;
  }

  updateSettingsUI();
}

export function toggleSound() {
  playClickSound();
  gameSettings.soundEnabled = document.getElementById("sound-toggle").checked;
}

export function toggleAnimations() {
  playClickSound();
  gameSettings.animationsEnabled =
    document.getElementById("animations-toggle").checked;
}

export function updateTheme() {
  playClickSound();
  gameSettings.theme = document.getElementById("theme-select").value;
  applyTheme();
}

export function toggleAutoProgress() {
  playClickSound();
  gameSettings.autoProgress = document.getElementById(
    "auto-progress-toggle"
  ).checked;
}

export function toggleShowSolution() {
  playClickSound();
  gameSettings.showSolution = document.getElementById(
    "show-solution-toggle"
  ).checked;
}

export function applyTheme() {
  const root = document.documentElement;

  switch (gameSettings.theme) {
    case "matrix":
      root.style.setProperty("--primary-color", "#00ff41");
      root.style.setProperty("--secondary-color", "#00ccff");
      break;
    case "amber":
      root.style.setProperty("--primary-color", "#ffb000");
      root.style.setProperty("--secondary-color", "#ff8800");
      break;
    case "blue":
      root.style.setProperty("--primary-color", "#00aaff");
      root.style.setProperty("--secondary-color", "#0088cc");
      break;
    case "purple":
      root.style.setProperty("--primary-color", "#aa00ff");
      root.style.setProperty("--secondary-color", "#8800cc");
      break;
  }
}

export function resetToDefaults() {
  playClickSound();

  if (confirm("Reset all settings to default values?")) {
    gameSettings = { ...DEFAULT_SETTINGS };
    updateSettingsUI();
    applyTheme();
  }
}

export function applySettingsToGame(gameInstance) {
  if (gameInstance) {
    gameInstance.applySettings();
  }
}

export { DEFAULT_SETTINGS };
