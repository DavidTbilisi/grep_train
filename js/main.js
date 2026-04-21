// Main Application Entry Point

import { terminalEffects } from './terminal-effects.js';
import { GrepGameEngine } from './game-engine.js';
import {
  loadSettings, applyTheme, updateSettingsUI, adjustSetting,
  updateDifficulty, toggleSound, toggleAnimations, updateTheme,
  toggleAutoProgress, toggleShowSolution, resetToDefaults,
  saveSettings, gameSettings, applySettingsToGame
} from './settings.js';
import { showScreen, showTransition, hideLoading } from './ui.js';
import { playClickSound, playCommandSound, playSuccessSound, playErrorSound } from './audio.js';
import {
  animateTutorialContent, animateAboutContent,
  animateSettingsContent, startWelcomeAnimations
} from './animations.js';
import { attachCommandAutocomplete } from './command-autocomplete.js';

let game;

// Initialize application when DOM is loaded
function initializeApp() {
  loadSettings();
  applyTheme();
  terminalEffects.init();
  game = new GrepGameEngine();

  const commandInput = document.getElementById("command-input");
  if (commandInput) {
    attachCommandAutocomplete(commandInput, () => game);
  }

  setTimeout(() => {
    terminalEffects.playBootSequence(() => {
      game.init();

      setTimeout(() => {
        hideLoading();

        setTimeout(() => {
          startWelcomeAnimations();
        }, 500);
      }, 500);
    });
  }, 1000);
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
    updateSettingsUI();
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

// Game control functions
function executeCommand() {
  playCommandSound();

  const input = document.getElementById("command-input");
  const command = input.value.trim();

  if (!command) {
    terminalEffects.shakeElement(input);
    return;
  }

  terminalEffects.highlightCommand(input.parentElement);
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

  if (!game || !game.gameStarted) {
    alert("Start a game first to use the solution feature!");
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

// Setup event listeners when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  initializeApp();

  // Welcome screen buttons
  document.getElementById('btn-start-game').addEventListener('click', startGame);
  document.getElementById('btn-tutorial').addEventListener('click', showTutorial);
  document.getElementById('btn-leaderboard').addEventListener('click', showLeaderboard);
  document.getElementById('btn-settings').addEventListener('click', showSettings);
  document.getElementById('btn-about').addEventListener('click', showAbout);

  // Game screen buttons
  document.getElementById('btn-hint').addEventListener('click', getHint);
  document.getElementById('btn-execute').addEventListener('click', executeCommand);
  document.getElementById('btn-skip').addEventListener('click', skipChallenge);
  document.getElementById('btn-reset').addEventListener('click', resetChallenge);
  document.getElementById('btn-show-solution').addEventListener('click', showSolution);
  document.getElementById('btn-next-challenge').addEventListener('click', nextChallenge);

  // Modal buttons
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-restart-game').addEventListener('click', restartGame);
  document.getElementById('btn-gameover-main-menu')
    .addEventListener('click', () => showScreen('welcome-screen'));

  // Tutorial screen
  document.getElementById('btn-tutorial-back')
    .addEventListener('click', () => showScreen('welcome-screen'));

  // Leaderboard screen
  document.getElementById('btn-leaderboard-back')
    .addEventListener('click', () => showScreen('welcome-screen'));

  // Settings screen
  document.getElementById('btn-adjust-lives-down')
    .addEventListener('click', () => adjustSetting('lives', -1));
  document.getElementById('btn-adjust-lives-up')
    .addEventListener('click', () => adjustSetting('lives', 1));
  document.getElementById('btn-adjust-hints-down')
    .addEventListener('click', () => adjustSetting('hints', -1));
  document.getElementById('btn-adjust-hints-up')
    .addEventListener('click', () => adjustSetting('hints', 1));
  document.getElementById('difficulty-select')
    .addEventListener('change', updateDifficulty);
  document.getElementById('sound-toggle')
    .addEventListener('change', toggleSound);
  document.getElementById('animations-toggle')
    .addEventListener('change', toggleAnimations);
  document.getElementById('theme-select')
    .addEventListener('change', updateTheme);
  document.getElementById('auto-progress-toggle')
    .addEventListener('change', toggleAutoProgress);
  document.getElementById('show-solution-toggle')
    .addEventListener('change', toggleShowSolution);
  document.getElementById('btn-reset-defaults')
    .addEventListener('click', resetToDefaults);
  document.getElementById('btn-save-settings')
    .addEventListener('click', (event) => {
      saveSettings(event);
      if (game && game.gameStarted) game.applySettings();
    });
  document.getElementById('btn-settings-back')
    .addEventListener('click', () => showScreen('welcome-screen'));

  // About screen
  document.getElementById('btn-about-back')
    .addEventListener('click', () => showScreen('welcome-screen'));
});

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    return;
  }

  switch (e.key) {
    case "Escape":
      e.preventDefault();
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

// Prevent right-click context menu
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
});

// Handle visibility change to pause game
document.addEventListener("visibilitychange", function () {
  if (game && game.timer) {
    if (document.hidden) {
      game.stopTimer();
    } else {
      if (game.gameStarted && game.timeRemaining > 0) {
        game.startTimer();
      }
    }
  }
});

// Auto-resize handling
window.addEventListener("resize", function () {
  setTimeout(() => {
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

// Service Worker registration (commented out for now)
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

// Expose functions to global scope for inline onclick handlers (backward compatibility)
window.game = () => game;
window.terminalEffects = terminalEffects;
window.gameSettings = gameSettings;
window.startGame = startGame;
window.showTutorial = showTutorial;
window.showLeaderboard = showLeaderboard;
window.showSettings = showSettings;
window.showAbout = showAbout;
window.executeCommand = executeCommand;
window.getHint = getHint;
window.skipChallenge = skipChallenge;
window.resetChallenge = resetChallenge;
window.showSolution = showSolution;
window.nextChallenge = nextChallenge;
window.closeModal = closeModal;
window.restartGame = restartGame;
window.showScreen = showScreen;
window.adjustSetting = adjustSetting;
window.updateDifficulty = updateDifficulty;
window.toggleSound = toggleSound;
window.toggleAnimations = toggleAnimations;
window.updateTheme = updateTheme;
window.toggleAutoProgress = toggleAutoProgress;
window.toggleShowSolution = toggleShowSolution;
window.resetToDefaults = resetToDefaults;
window.saveSettings = (event) => {
  saveSettings(event);
  if (game && game.gameStarted) game.applySettings();
};

// Debug export
window.gameDebug = {
  game: () => game,
  effects: () => terminalEffects,
  settings: () => gameSettings,
  showScreen,
  playSound: {
    click: playClickSound,
    command: playCommandSound,
    success: playSuccessSound,
    error: playErrorSound,
  },
};
