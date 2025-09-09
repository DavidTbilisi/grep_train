// Game Engine - Core game logic and state management

class GrepGameEngine {
  constructor() {
    this.currentLevel = 1;
    this.currentChallenge = 1;
    this.score = 0;
    this.lives = 3;
    this.hints = 2;
    this.defaultLives = 3;
    this.defaultHints = 2;
    this.timer = null;
    this.timeRemaining = 60;
    this.gameStarted = false;
    this.currentFiles = {};
    this.achievements = new Set();
    this.settings = null;
    this.stats = {
      totalCommands: 0,
      correctCommands: 0,
      hintsUsed: 0,
      challengesCompleted: 0,
      fastestTime: Infinity,
      totalPlayTime: 0,
    };
    this.gameStartTime = null;
    this.challengeStartTime = null;
    this.loadLeaderboard();
  }

  // Initialize game
  init() {
    this.displayASCIIArt();
    this.setupEventListeners();
    this.hideLoading();
  }

  // Display ASCII art with typing effect
  displayASCIIArt() {
    const asciiElement = document.getElementById("ascii-logo");
    if (asciiElement) {
      asciiElement.textContent = GAME_DATA.asciiArt;
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Command input enter key
    const commandInput = document.getElementById("command-input");
    if (commandInput) {
      commandInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.executeCommand();
        }
      });
    }

    // Prevent form submission on enter
    document.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && e.target.tagName !== "INPUT") {
        e.preventDefault();
      }
    });
  }

  // Start new game
  startGame() {
    this.resetGame();
    this.applySettings();
    this.gameStarted = true;
    this.gameStartTime = Date.now();
    this.loadLevel(1);
    this.showScreen("game-screen");
  }

  // Apply user settings to game
  applySettings() {
    // Get settings from global gameSettings if available
    if (typeof gameSettings !== "undefined") {
      this.settings = gameSettings;
      this.defaultLives = gameSettings.lives;
      this.defaultHints = gameSettings.hints;
      this.lives = gameSettings.lives;
      this.hints = gameSettings.hints;
    }
  }

  // Reset game state
  resetGame() {
    this.currentLevel = 1;
    this.currentChallenge = 1;
    this.score = 0;
    this.lives = this.defaultLives;
    this.hints = this.defaultHints;
    this.timeRemaining = 60;
    this.stats = {
      totalCommands: 0,
      correctCommands: 0,
      hintsUsed: 0,
      challengesCompleted: 0,
      fastestTime: Infinity,
      totalPlayTime: 0,
    };
    this.updateUI();
  }

  // Load specific level
  loadLevel(levelNumber) {
    const level = GAME_DATA.levels.find((l) => l.id === levelNumber);
    if (!level) {
      this.gameComplete();
      return;
    }

    this.currentLevel = levelNumber;
    // Set current challenge to the ID of the first challenge in this level
    this.currentChallenge = level.challenges[0].id;
    this.loadChallenge(level.challenges[0]);
  }

  // Load specific challenge
  loadChallenge(challenge) {
    this.challengeStartTime = Date.now();
    this.currentFiles = { ...challenge.files };
    this.timeRemaining = challenge.timeLimit;
    this.hints = 10; // Reset hints for each challenge

    // Update UI
    document.getElementById("challenge-title").textContent = challenge.title;
    document.getElementById("challenge-description").textContent =
      challenge.description;

    // Load file tree
    this.updateFileTree();

    // Load first file
    const firstFile = Object.keys(this.currentFiles)[0];
    this.loadFile(firstFile);

    // Clear previous output
    this.clearOutput();

    // Start timer
    this.startTimer();

    // Update UI
    this.updateUI();
  }

  // Update file tree display
  updateFileTree() {
    const treeContent = document.getElementById("file-tree-content");
    if (!treeContent) return;

    treeContent.innerHTML = "";

    Object.keys(this.currentFiles).forEach((filename, index) => {
      const fileItem = document.createElement("div");
      fileItem.className = `file-item ${index === 0 ? "active" : ""}`;
      fileItem.innerHTML = `
                <span class="file-icon">📄</span>
                <span class="file-name">${filename}</span>
            `;
      fileItem.onclick = () => this.loadFile(filename);
      treeContent.appendChild(fileItem);
    });
  }

  // Load file content
  loadFile(filename) {
    const content = this.currentFiles[filename];
    if (!content) return;

    // Update file header
    document.getElementById("current-file").textContent = filename;

    // Update file content with line numbers
    const lines = content.split("\n");
    const numberedContent = lines
      .map(
        (line, index) => `${(index + 1).toString().padStart(3, " ")}  ${line}`
      )
      .join("\n");

    document.getElementById("file-content").textContent = numberedContent;

    // Update active file in tree
    document.querySelectorAll(".file-item").forEach((item) => {
      item.classList.remove("active");
      if (item.querySelector(".file-name").textContent === filename) {
        item.classList.add("active");
      }
    });
  }

  // Execute grep command
  executeCommand() {
    const input = document.getElementById("command-input");
    const command = input.value.trim();

    if (!command) {
      this.addOutput("Please enter a command.", "error");
      return;
    }

    this.stats.totalCommands++;

    // Display command
    this.addOutput(`$ ${command}`, "command");

    // Parse and execute command
    const result = this.parseGrepCommand(command);

    if (result.error) {
      this.addOutput(result.error, "error");
      this.loseLife();
    } else if (result.output) {
      // Display output
      result.output.forEach((line) => {
        this.addOutput(line, "success");
      });

      // Check if correct
      if (this.checkAnswer(result.output)) {
        this.challengeSuccess();
      } else {
        this.addOutput(
          "Output doesn't match expected result. Try again!",
          "warning"
        );
        this.loseLife();
      }
    }

    // Clear input
    input.value = "";
  }

  // Parse grep command and simulate execution
  parseGrepCommand(command) {
    // Basic command parsing (simplified for demo)
    const parts = command.split(/\s+/);

    if (parts[0] !== "grep") {
      return { error: 'Command must start with "grep"' };
    }

    let flags = [];
    let pattern = "";
    let files = [];
    let i = 1;

    // Parse flags
    while (i < parts.length && parts[i].startsWith("-")) {
      flags.push(parts[i]);
      i++;
    }

    // Parse pattern
    if (i < parts.length) {
      pattern = parts[i].replace(/^['"]|['"]$/g, ""); // Remove quotes
      i++;
    }

    // Parse files
    while (i < parts.length) {
      files.push(parts[i]);
      i++;
    }

    if (!pattern) {
      return { error: "Missing search pattern" };
    }

    if (files.length === 0) {
      files = Object.keys(this.currentFiles);
    }

    // Simulate grep execution
    return this.simulateGrep(pattern, flags, files);
  }

  // Simulate grep command execution
  simulateGrep(pattern, flags, files) {
    const output = [];
    const hasLineNumbers = flags.includes("-n");
    const isCaseInsensitive = flags.includes("-i");
    const isInvert = flags.includes("-v");
    const isCount = flags.includes("-c");
    const isWholeWord = flags.includes("-w");
    const isExtendedRegex = flags.includes("-E");
    const isOnlyMatches = flags.includes("-o");
    const showFilename = flags.includes("-H") || files.length > 1;
    const contextAfter = this.getContextFlag(flags, "-A");
    const contextBefore = this.getContextFlag(flags, "-B");
    const contextBoth = this.getContextFlag(flags, "-C");

    files.forEach((filename) => {
      if (!this.currentFiles[filename]) {
        output.push(`grep: ${filename}: No such file or directory`);
        return;
      }

      const content = this.currentFiles[filename];
      const lines = content.split("\n");
      let matches = [];
      let matchCount = 0;

      // Process each line
      lines.forEach((line, index) => {
        let isMatch = false;
        let matchText = line;

        // Create regex pattern
        let regex;
        try {
          let regexPattern;

          if (isWholeWord) {
            // For whole word matching, escape the pattern first, then add word boundaries
            const escapedPattern = pattern.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );
            regexPattern = `\\b${escapedPattern}\\b`;
          } else if (!isExtendedRegex) {
            // Escape special characters for basic regex
            regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          } else {
            // Extended regex - use pattern as-is
            regexPattern = pattern;
          }

          const flags_regex = isCaseInsensitive ? "gi" : "g";
          regex = new RegExp(regexPattern, flags_regex);

          if (isOnlyMatches) {
            const matches_only = line.match(regex);
            if (matches_only) {
              isMatch = true;
              matchText = matches_only.join("\n");
            }
          } else {
            isMatch = regex.test(line);
          }
        } catch (e) {
          return { error: `Invalid regex pattern: ${pattern}` };
        }

        if (isInvert) {
          isMatch = !isMatch;
        }

        if (isMatch) {
          matchCount++;
          if (!isCount) {
            let outputLine = "";

            if (showFilename) {
              outputLine += `${filename}:`;
            }

            if (hasLineNumbers) {
              outputLine += `${index + 1}:`;
            }

            if (isOnlyMatches) {
              outputLine += matchText;
            } else {
              outputLine += line;
            }

            matches.push({ line: outputLine, index });
          }
        }
      });

      if (isCount) {
        let countLine = showFilename
          ? `${filename}:${matchCount}`
          : matchCount.toString();
        output.push(countLine);
      } else {
        // Add context lines if needed
        if (contextBoth || contextAfter || contextBefore) {
          matches.forEach((match) => {
            const lineIndex = match.index;
            const contextStart = Math.max(
              0,
              lineIndex - (contextBoth || contextBefore || 0)
            );
            const contextEnd = Math.min(
              lines.length - 1,
              lineIndex + (contextBoth || contextAfter || 0)
            );

            for (let i = contextStart; i <= contextEnd; i++) {
              if (i !== lineIndex) {
                let contextLine = "";
                if (showFilename) contextLine += `${filename}-`;
                if (hasLineNumbers) contextLine += `${i + 1}-`;
                contextLine += lines[i];
                output.push(contextLine);
              } else {
                output.push(match.line);
              }
            }

            if (match !== matches[matches.length - 1]) {
              output.push("--");
            }
          });
        } else {
          matches.forEach((match) => {
            output.push(match.line);
          });
        }
      }
    });

    return { output };
  }

  // Get context flag value
  getContextFlag(flags, flagName) {
    const flagIndex = flags.findIndex((f) => f.startsWith(flagName));
    if (flagIndex === -1) return 0;

    const flag = flags[flagIndex];
    if (flag === flagName && flagIndex + 1 < flags.length) {
      return parseInt(flags[flagIndex + 1]) || 0;
    }

    const match = flag.match(new RegExp(`${flagName}(\\d+)`));
    return match ? parseInt(match[1]) : 1;
  }

  // Check if answer is correct
  checkAnswer(output) {
    const challenge = this.getCurrentChallenge();
    if (!challenge) return false;

    const expected = challenge.expectedOutput;

    // Normalize output for comparison
    const normalizedOutput = output
      .map((line) => line.trim())
      .filter((line) => line && line !== "--");
    const normalizedExpected = expected.map((line) => line.trim());

    // Debug output
    console.log("Debug - Raw output:", output);
    console.log("Debug - Expected output:", expected);
    console.log("Debug - Normalized output:", normalizedOutput);
    console.log("Debug - Normalized expected:", normalizedExpected);

    if (normalizedOutput.length !== normalizedExpected.length) {
      console.log(
        "Debug - Length mismatch:",
        normalizedOutput.length,
        "vs",
        normalizedExpected.length
      );
      return false;
    }

    const result = normalizedOutput.every(
      (line, index) =>
        line === normalizedExpected[index] ||
        line.endsWith(normalizedExpected[index])
    );

    console.log("Debug - Match result:", result);
    return result;
  }

  // Get current challenge
  getCurrentChallenge() {
    const level = GAME_DATA.levels.find((l) => l.id === this.currentLevel);
    if (!level) {
      console.log("getCurrentChallenge: Level not found", this.currentLevel);
      return null;
    }

    const challenge = level.challenges.find(
      (c) => c.id === this.currentChallenge
    );
    if (!challenge) {
      console.log("getCurrentChallenge: Challenge not found", {
        currentLevel: this.currentLevel,
        currentChallenge: this.currentChallenge,
        availableChallenges: level.challenges.map((c) => c.id),
      });
    }

    return challenge;
  }

  // Challenge success
  challengeSuccess() {
    this.stats.correctCommands++;
    this.stats.challengesCompleted++;

    const challenge = this.getCurrentChallenge();
    const timeBonus = Math.max(0, this.timeRemaining * 10);
    const challengeScore = challenge.points + timeBonus;

    this.score += challengeScore;

    // Track fastest time
    const challengeTime = (Date.now() - this.challengeStartTime) / 1000;
    if (challengeTime < this.stats.fastestTime) {
      this.stats.fastestTime = challengeTime;
    }

    // Check for speed achievement
    if (challengeTime < 30) {
      this.unlockAchievement("speed_demon");
    }

    this.stopTimer();
    this.showSuccessModal(challengeScore, timeBonus);
  }

  // Show success modal
  showSuccessModal(challengeScore, timeBonus) {
    document.getElementById("challenge-score").textContent =
      challengeScore - timeBonus;
    document.getElementById("time-bonus").textContent = timeBonus;
    document.getElementById("total-score").textContent = challengeScore;

    const modal = document.getElementById("success-modal");
    modal.classList.add("active");
  }

  // Close modal and continue
  closeModal() {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.classList.remove("active");
    });

    this.nextChallenge();
  }

  // Next challenge
  nextChallenge() {
    const level = GAME_DATA.levels.find((l) => l.id === this.currentLevel);
    if (!level) {
      console.log("Level not found:", this.currentLevel);
      return;
    }

    const currentChallengeIndex = level.challenges.findIndex(
      (c) => c.id === this.currentChallenge
    );
    console.log(
      "Current challenge index:",
      currentChallengeIndex,
      "Challenge ID:",
      this.currentChallenge
    );

    const nextChallengeIndex = currentChallengeIndex + 1;

    if (nextChallengeIndex < level.challenges.length) {
      const nextChallenge = level.challenges[nextChallengeIndex];
      this.currentChallenge = nextChallenge.id;

      // Reset lives and hints for new challenge
      this.lives = this.defaultLives;
      this.hints = this.defaultHints;

      console.log(
        "Loading next challenge:",
        nextChallenge.id,
        nextChallenge.title
      );
      this.loadChallenge(nextChallenge);
    } else {
      // Level complete
      this.levelComplete();
    }
  }

  // Level complete
  levelComplete() {
    this.currentLevel++;
    if (this.currentLevel <= GAME_DATA.levels.length) {
      this.loadLevel(this.currentLevel);
    } else {
      this.gameComplete();
    }
  }

  // Game complete
  gameComplete() {
    this.stopTimer();
    this.unlockAchievement("grep_master");
    this.saveScore();
    this.showScreen("welcome-screen");
    this.addOutput("🎉 Congratulations! You've mastered grep!", "success");
  }

  // Lose a life
  loseLife() {
    this.lives--;
    this.updateUI();

    if (this.lives <= 0) {
      this.handleOutOfLives();
    }
  }

  // Handle when player runs out of lives
  handleOutOfLives() {
    this.stopTimer();

    if (this.currentLevel <= 1) {
      // If we're at level 1, game over
      this.gameOver();
    } else {
      // Go back one level
      this.goBackOneLevel();
    }
  }

  // Go back one level when out of lives
  goBackOneLevel() {
    this.currentLevel--;
    this.currentChallenge = 1;

    // Reset lives and hints for the previous level
    this.lives = this.defaultLives;
    this.hints = this.defaultHints;

    // Play error sound if enabled
    if (
      this.settings &&
      this.settings.soundEnabled &&
      typeof playErrorSound === "function"
    ) {
      playErrorSound();
    }

    // Show feedback message with visual effects
    const previousLevel = this.currentLevel + 1;
    this.addOutput(
      `💔 Out of lives! Dropping back from Level ${previousLevel} to Level ${this.currentLevel}`,
      "error"
    );
    this.addOutput("🔄 Try again with fresh lives and hints!", "info");
    this.addOutput("📚 Remember: Practice makes perfect!", "info");

    // Add visual shake effect to the game container
    const gameContainer = document.querySelector(".game-content");
    if (gameContainer) {
      gameContainer.style.animation = "shake 0.5s ease-in-out";
      setTimeout(() => {
        gameContainer.style.animation = "";
      }, 500);
    }

    // Load the previous level after a short delay for better UX
    setTimeout(() => {
      this.loadLevel(this.currentLevel);
      this.addOutput(
        "🎮 Level " + this.currentLevel + " - Let's try this again!",
        "success"
      );
    }, 2500);
  }

  // Game over
  gameOver() {
    this.stopTimer();
    this.stats.totalPlayTime = (Date.now() - this.gameStartTime) / 1000;

    document.getElementById("final-score").textContent = this.score;
    document.getElementById("levels-completed").textContent =
      this.currentLevel - 1;

    const modal = document.getElementById("gameover-modal");
    modal.classList.add("active");
  }

  // Restart game
  restartGame() {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.classList.remove("active");
    });
    this.startGame();
  }

  // Get hint
  getHint() {
    if (this.hints <= 0) {
      this.addOutput("No hints remaining!", "warning");
      return;
    }

    const challenge = this.getCurrentChallenge();
    if (!challenge) return;

    this.hints--;
    this.stats.hintsUsed++;

    const hintIndex = 10 - this.hints - 1;
    if (hintIndex < challenge.hints.length) {
      this.addOutput(`💡 Hint: ${challenge.hints[hintIndex]}`, "info");
    }

    this.updateUI();
  }

  // Show solution
  showSolution() {
    const challenge = this.getCurrentChallenge();
    if (!challenge) {
      this.addOutput("❌ No active challenge found!", "error");
      return;
    }

    // Apply current settings if not already applied
    if (!this.settings && typeof gameSettings !== "undefined") {
      this.applySettings();
    }

    // Check if showing solutions is enabled in settings
    if (this.settings && this.settings.showSolution === false) {
      this.addOutput("❌ Solutions are disabled in settings!", "error");
      this.addOutput(
        "💡 Enable 'Show Solutions' in Settings to use this feature.",
        "info"
      );
      return;
    }

    // Show the solution
    this.addOutput(`💡 Solution: ${challenge.correctCommand}`, "info");
    this.addOutput(
      "📝 Study this command and try to understand why it works!",
      "info"
    );

    // Lose a life as penalty for viewing solution
    this.loseLife();
  }

  // Skip challenge
  skipChallenge() {
    this.loseLife();
    this.nextChallenge();
  }

  // Reset challenge
  resetChallenge() {
    const challenge = this.getCurrentChallenge();
    if (challenge) {
      this.clearOutput();
      this.timeRemaining = challenge.timeLimit;
      this.startTimer();
    }
  }

  // Timer functions
  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.timeRemaining--;
      this.updateUI();

      if (this.timeRemaining <= 0) {
        this.stopTimer();
        this.addOutput("⏰ Time's up!", "error");
        this.loseLife();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // UI Functions
  addOutput(text, type = "normal") {
    const output = document.getElementById("output-content");
    if (!output) return;

    const line = document.createElement("div");
    line.className = `output-line ${type}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  clearOutput() {
    const output = document.getElementById("output-content");
    if (output) {
      output.innerHTML = "";
    }
  }

  updateUI() {
    // Update stats in header
    document.getElementById("current-level").textContent = this.currentLevel;
    document.getElementById("current-score").textContent = this.score;

    // Update game stats
    document.getElementById("lives-count").textContent = this.lives;
    document.getElementById("hints-count").textContent = this.hints;
    document.getElementById("timer").textContent = this.timeRemaining;
  }

  showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });

    document.getElementById(screenId).classList.add("active");
  }

  hideLoading() {
    const loading = document.getElementById("loading-overlay");
    if (loading) {
      loading.classList.add("fade-out");
      setTimeout(() => {
        loading.classList.add("hidden");
        loading.style.display = "none";
      }, 800);
    }
  }

  // Achievement system
  unlockAchievement(achievementId) {
    if (this.achievements.has(achievementId)) return;

    this.achievements.add(achievementId);
    const achievement = GAME_DATA.achievements.find(
      (a) => a.id === achievementId
    );

    if (achievement) {
      this.addOutput(
        `🏆 Achievement unlocked: ${achievement.icon} ${achievement.name}`,
        "success"
      );
    }
  }

  // Leaderboard functions
  saveScore() {
    const playerName =
      prompt("Enter your name for the leaderboard:") || "Anonymous";
    const leaderboard = this.getLeaderboard();

    leaderboard.push({
      name: playerName,
      score: this.score,
      level: this.currentLevel,
      date: new Date().toLocaleDateString(),
    });

    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard.splice(10); // Keep only top 10

    localStorage.setItem("grepMasterLeaderboard", JSON.stringify(leaderboard));
  }

  loadLeaderboard() {
    this.updateLeaderboard();
  }

  getLeaderboard() {
    const saved = localStorage.getItem("grepMasterLeaderboard");
    return saved ? JSON.parse(saved) : [];
  }

  updateLeaderboard() {
    const leaderboard = this.getLeaderboard();
    const list = document.getElementById("leaderboard-list");

    if (!list) return;

    if (leaderboard.length === 0) {
      list.innerHTML =
        '<p style="text-align: center; color: #666;">No scores yet. Be the first!</p>';
      return;
    }

    list.innerHTML = leaderboard
      .map(
        (entry, index) => `
            <div class="leaderboard-item">
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-name">${entry.name}</span>
                <span class="leaderboard-score">${entry.score}</span>
            </div>
        `
      )
      .join("");
  }
}

// Global game instance will be created in script.js
