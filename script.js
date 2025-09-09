// Main Script - Application initialization and event handlers

// Global variables
let game;

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  initializeApp();
});

// Initialize the application
function initializeApp() {
  // Initialize terminal effects
  terminalEffects.init();

  // Initialize game engine
  game = new GrepGameEngine();

  // Play boot sequence (this will handle the loading)
  setTimeout(() => {
    terminalEffects.playBootSequence(() => {
      game.init();

      // Hide loading overlay after boot sequence
      setTimeout(() => {
        hideLoading();

        // Start typing animations for welcome screen
        setTimeout(() => {
          startWelcomeAnimations();
        }, 500);
      }, 500);
    });
  }, 1000);
}

// Welcome screen animations
function startWelcomeAnimations() {
  const typingElements = document.querySelectorAll(".typing-text");

  typingElements.forEach((element, index) => {
    const text = element.getAttribute("data-text");
    if (text) {
      setTimeout(() => {
        terminalEffects.typeText(element, text);
      }, index * 2000);
    }
  });
}

// Navigation functions
function startGame() {
  playClickSound();
  showTransition(() => {
    game.startGame();
  });
}

function showTutorial() {
  playClickSound();
  showTransition(() => {
    showScreen("tutorial-screen");
    animateTutorialContent();
  });
}

function showLeaderboard() {
  playClickSound();
  showTransition(() => {
    game.updateLeaderboard();
    showScreen("leaderboard-screen");
  });
}

function showSettings() {
  playClickSound();
  showTransition(() => {
    showScreen("settings-screen");
    loadSettings();
    animateSettingsContent();
  });
}

function showAbout() {
  playClickSound();
  showTransition(() => {
    showScreen("about-screen");
    animateAboutContent();
  });
}

// Screen management
function showScreen(screenId) {
  // Hide all screens
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  // Show target screen
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add("active");
  }
}

// Transition effect
function showTransition(callback) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 255, 65, 0.1);
        z-index: 1500;
        pointer-events: none;
    `;

  document.body.appendChild(overlay);

  overlay.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], {
    duration: 300,
  }).onfinish = () => {
    overlay.remove();
    if (callback) callback();
  };
}

// Game control functions
function executeCommand() {
  playCommandSound();

  const input = document.getElementById("command-input");
  const command = input.value.trim();

  if (!command) {
    terminalEffects.shakeElement(input);
    return;
  }

  // Highlight command input
  terminalEffects.highlightCommand(input.parentElement);

  // Execute through game engine
  game.executeCommand();
}

function getHint() {
  playClickSound();
  game.getHint();
}

function skipChallenge() {
  playClickSound();
  if (
    confirm(
      "Are you sure you want to skip this challenge? You will lose a life."
    )
  ) {
    game.skipChallenge();
  }
}

function resetChallenge() {
  playClickSound();
  game.resetChallenge();
}

function showSolution() {
  playClickSound();

  // Check if game is running
  if (!game || !game.gameStarted) {
    alert("Start a game first to use the solution feature!");
    return;
  }

  // Check if solutions are enabled in settings
  if (gameSettings && gameSettings.showSolution === false) {
    alert(
      "Solutions are disabled in settings! Enable 'Show Solutions' in the Settings menu to use this feature."
    );
    return;
  }

  if (
    confirm("Are you sure you want to see the solution? You will lose a life.")
  ) {
    game.showSolution();
  }
}

function nextChallenge() {
  playClickSound();
  game.nextChallenge();
}

function closeModal() {
  playClickSound();

  // Success particle effect
  const modal = document.querySelector(".modal.active");
  if (modal && modal.id === "success-modal") {
    terminalEffects.createSuccessParticles(modal);
  }

  setTimeout(() => {
    game.closeModal();
  }, 500);
}

function restartGame() {
  playClickSound();
  game.restartGame();
}

// Tutorial animations
function animateTutorialContent() {
  const sections = document.querySelectorAll(
    ".tutorial-section h3, .tutorial-section p, .option"
  );

  sections.forEach((section, index) => {
    section.style.opacity = "0";
    section.style.transform = "translateY(20px)";

    setTimeout(() => {
      section.style.transition = "all 0.5s ease";
      section.style.opacity = "1";
      section.style.transform = "translateY(0)";
    }, index * 100);
  });
}

// About screen animations
function animateAboutContent() {
  const elements = document.querySelectorAll(
    ".about-content h2, .about-content h3, .about-content p, .about-content li"
  );

  elements.forEach((element, index) => {
    element.style.opacity = "0";
    element.style.transform = "translateX(-20px)";

    setTimeout(() => {
      element.style.transition = "all 0.4s ease";
      element.style.opacity = "1";
      element.style.transform = "translateX(0)";
    }, index * 50);
  });
}

// Loading screen management
function showLoading() {
  const loading = document.getElementById("loading-overlay");
  if (loading) {
    loading.classList.remove("hidden", "fade-out");
    loading.style.display = "flex";
  }
}

function hideLoading() {
  const loading = document.getElementById("loading-overlay");
  console.log("hideLoading called, loading element:", loading);
  if (loading) {
    loading.classList.add("fade-out");
    console.log("Added fade-out class");
    // Wait for transition to complete before hiding completely
    setTimeout(() => {
      loading.classList.add("hidden");
      loading.style.display = "none";
      console.log("Loading overlay hidden");
    }, 800); // Match the CSS transition duration
  }
}

// Sound effects (using Web Audio API)
function createAudioContext() {
  if (!window.audioContext) {
    window.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
  }
  return window.audioContext;
}

function playClickSound() {
  try {
    const audioContext = createAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      400,
      audioContext.currentTime + 0.1
    );

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.1
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    // Fallback for browsers without Web Audio API support
    console.log("Click sound (audio not supported)");
  }
}

function playCommandSound() {
  try {
    const audioContext = createAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(
      800,
      audioContext.currentTime + 0.05
    );

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.05
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.05);
  } catch (e) {
    console.log("Command sound (audio not supported)");
  }
}

function playSuccessSound() {
  try {
    const audioContext = createAudioContext();

    // Play a sequence of notes
    const frequencies = [523.25, 659.25, 783.99]; // C, E, G

    frequencies.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(
        freq,
        audioContext.currentTime + index * 0.1
      );

      gainNode.gain.setValueAtTime(0, audioContext.currentTime + index * 0.1);
      gainNode.gain.linearRampToValueAtTime(
        0.1,
        audioContext.currentTime + index * 0.1 + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + index * 0.1 + 0.2
      );

      oscillator.start(audioContext.currentTime + index * 0.1);
      oscillator.stop(audioContext.currentTime + index * 0.1 + 0.2);
    });
  } catch (e) {
    console.log("Success sound (audio not supported)");
  }
}

function playErrorSound() {
  try {
    const audioContext = createAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(
      100,
      audioContext.currentTime + 0.3
    );

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log("Error sound (audio not supported)");
  }
}

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  // Don't interfere with input fields
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    return;
  }

  switch (e.key) {
    case "Escape":
      e.preventDefault();
      // Close modals or return to welcome screen
      if (document.querySelector(".modal.active")) {
        closeModal();
      } else if (
        !document.getElementById("welcome-screen").classList.contains("active")
      ) {
        showScreen("welcome-screen");
      }
      break;

    case "h":
    case "H":
      e.preventDefault();
      if (game && game.gameStarted) {
        getHint();
      }
      break;

    case "r":
    case "R":
      e.preventDefault();
      if (game && game.gameStarted) {
        resetChallenge();
      }
      break;

    case "s":
    case "S":
      e.preventDefault();
      if (game && game.gameStarted) {
        showSolution();
      }
      break;
  }
});

// Prevent right-click context menu for a more terminal-like experience
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
});

// Handle visibility change to pause game when tab is not active
document.addEventListener("visibilitychange", function () {
  if (game && game.timer) {
    if (document.hidden) {
      // Tab is hidden, pause timer
      game.stopTimer();
    } else {
      // Tab is visible again, resume timer
      if (game.gameStarted && game.timeRemaining > 0) {
        game.startTimer();
      }
    }
  }
});

// Auto-resize handling
window.addEventListener("resize", function () {
  // Update any responsive elements
  setTimeout(() => {
    // Trigger any necessary recalculations
    if (game) {
      game.updateUI();
    }
  }, 100);
});

// Performance monitoring
if ("performance" in window) {
  window.addEventListener("load", function () {
    setTimeout(() => {
      const loadTime =
        performance.timing.loadEventEnd - performance.timing.navigationStart;
      console.log(`App loaded in ${loadTime}ms`);
    }, 0);
  });
}

// Service Worker registration for PWA support (optional)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    // Uncomment if you want PWA support
    // navigator.serviceWorker.register('/sw.js').then(function(registration) {
    //     console.log('ServiceWorker registration successful');
    // }).catch(function(err) {
    //     console.log('ServiceWorker registration failed');
    // });
  });
}

// Settings System
let gameSettings = {
  lives: 3,
  hints: 2,
  difficulty: "normal",
  soundEnabled: true,
  animationsEnabled: true,
  theme: "matrix",
  autoProgress: false,
  showSolution: true,
};

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem("grepMasterSettings");
  if (saved) {
    gameSettings = { ...gameSettings, ...JSON.parse(saved) };
  }
  updateSettingsUI();
}

// Save settings to localStorage
function saveSettings() {
  localStorage.setItem("grepMasterSettings", JSON.stringify(gameSettings));
  playClickSound();

  // Show confirmation
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

  // Apply settings to current game if running
  if (game && game.gameStarted) {
    applySettingsToGame();
  }
}

// Update settings UI elements
function updateSettingsUI() {
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

// Adjust numeric settings
function adjustSetting(type, delta) {
  playClickSound();

  if (type === "lives") {
    gameSettings.lives = Math.max(1, Math.min(10, gameSettings.lives + delta));
  } else if (type === "hints") {
    gameSettings.hints = Math.max(0, Math.min(5, gameSettings.hints + delta));
  }

  updateSettingsUI();
}

// Update difficulty setting
function updateDifficulty() {
  playClickSound();
  gameSettings.difficulty = document.getElementById("difficulty-select").value;

  // Adjust other settings based on difficulty
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

// Toggle settings
function toggleSound() {
  playClickSound();
  gameSettings.soundEnabled = document.getElementById("sound-toggle").checked;
}

function toggleAnimations() {
  playClickSound();
  gameSettings.animationsEnabled =
    document.getElementById("animations-toggle").checked;
}

function updateTheme() {
  playClickSound();
  gameSettings.theme = document.getElementById("theme-select").value;
  applyTheme();
}

function toggleAutoProgress() {
  playClickSound();
  gameSettings.autoProgress = document.getElementById(
    "auto-progress-toggle"
  ).checked;
}

function toggleShowSolution() {
  playClickSound();
  gameSettings.showSolution = document.getElementById(
    "show-solution-toggle"
  ).checked;

  // Apply to running game immediately
  if (game && game.gameStarted) {
    applySettingsToGame();
  }
}

// Apply theme
function applyTheme() {
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

// Reset to defaults
function resetToDefaults() {
  playClickSound();

  if (confirm("Reset all settings to default values?")) {
    gameSettings = {
      lives: 3,
      hints: 2,
      difficulty: "normal",
      soundEnabled: true,
      animationsEnabled: true,
      theme: "matrix",
      autoProgress: false,
      showSolution: true,
    };
    updateSettingsUI();
    applyTheme();
  }
}

// Apply settings to running game
function applySettingsToGame() {
  if (game) {
    // Don't change lives/hints mid-challenge, only for new challenges
    game.defaultLives = gameSettings.lives;
    game.defaultHints = gameSettings.hints;
    game.settings = gameSettings;

    // Apply settings immediately
    game.applySettings();
  }
}

// Settings screen animations
function animateSettingsContent() {
  const sections = document.querySelectorAll(".settings-section");

  sections.forEach((section, index) => {
    section.style.opacity = "0";
    section.style.transform = "translateY(30px)";

    setTimeout(() => {
      section.style.transition = "all 0.6s ease";
      section.style.opacity = "1";
      section.style.transform = "translateY(0)";
    }, index * 200);
  });
}

// Initialize settings on app load
document.addEventListener("DOMContentLoaded", function () {
  loadSettings();
  applyTheme();

  // Ensure settings are available globally
  window.gameSettings = gameSettings;
});

// Export for debugging
window.gameDebug = {
  game: () => game,
  effects: () => terminalEffects,
  settings: () => gameSettings,
  showScreen: showScreen,
  playSound: {
    click: playClickSound,
    command: playCommandSound,
    success: playSuccessSound,
    error: playErrorSound,
  },
};
