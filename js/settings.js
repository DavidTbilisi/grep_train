// User preferences (sound, theme), saved to localStorage on every change.

const SETTINGS_KEY = "grepMasterSettings";

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  theme: "matrix",
};

const THEMES = {
  matrix: ["#00ff41", "#00ccff"],
  amber: ["#ffb000", "#ff8800"],
  blue: ["#00aaff", "#0088cc"],
  purple: ["#aa00ff", "#8800cc"],
};

export const gameSettings = { ...DEFAULT_SETTINGS };

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved) {
      if (typeof saved.soundEnabled === "boolean") gameSettings.soundEnabled = saved.soundEnabled;
      if (saved.theme in THEMES) gameSettings.theme = saved.theme;
    }
  } catch {
    // Corrupt or unavailable storage: keep defaults.
  }
  applyTheme();
  updateSettingsUI();
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(gameSettings));
  } catch {
    // Storage unavailable: settings last for this session only.
  }
}

export function updateSettingsUI() {
  document.getElementById("sound-toggle").checked = gameSettings.soundEnabled;
  document.getElementById("theme-select").value = gameSettings.theme;
}

export function setSound(enabled) {
  gameSettings.soundEnabled = enabled;
  saveSettings();
}

export function setTheme(theme) {
  if (!(theme in THEMES)) return;
  gameSettings.theme = theme;
  applyTheme();
  saveSettings();
}

function applyTheme() {
  const [primary, secondary] = THEMES[gameSettings.theme];
  document.documentElement.style.setProperty("--primary-color", primary);
  document.documentElement.style.setProperty("--secondary-color", secondary);
}
