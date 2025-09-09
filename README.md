# 🔍 Grep Master - Terminal Learning Game

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen)](https://your-username.github.io/grep-master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

**Master the art of text searching with grep through interactive challenges in a beautiful terminal environment!**

![Grep Master Screenshot](screenshot.png)

## 🚀 Features

### 🎮 Game Experience

- **Progressive Levels**: 5 levels with increasing difficulty
- **15 Unique Challenges**: From basic pattern matching to advanced regex
- **Real-time Scoring**: Points, lives, hints, and time-based bonuses
- **Achievement System**: Unlock rewards for mastering different skills
- **Leaderboard**: Compete with other grep masters

### 💻 Terminal Aesthetics

- **Authentic Terminal Look**: Matrix-style animations and effects
- **Typing Animations**: Realistic command-line typing experience
- **Sound Effects**: Terminal-inspired audio feedback
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Theme**: Easy on the eyes for extended learning sessions

### 📚 Educational Content

- **Comprehensive Coverage**: All major grep options and use cases
- **Interactive Tutorial**: Learn grep basics before playing
- **Contextual Hints**: Get help when you're stuck
- **Real File Simulations**: Practice with realistic log files and data
- **Progressive Difficulty**: Build skills from basic to advanced

## 🎯 Learning Objectives

By completing Grep Master, you'll master:

- **Basic Pattern Matching**: Simple string searches
- **Case Sensitivity**: Using `-i` for case-insensitive searches
- **Line Numbers & Counting**: `-n`, `-c` options
- **Invert Matching**: `-v` for non-matching lines
- **Word Boundaries**: `-w` for whole word matching
- **Regular Expressions**: Basic and extended regex patterns
- **Context Lines**: `-A`, `-B`, `-C` for surrounding context
- **File Operations**: Multiple files, recursive search
- **Advanced Features**: Output formatting, binary file handling

## 🚀 Quick Start

### Option 1: Play Online

Visit the [live demo](https://your-username.github.io/grep-master) and start playing immediately!

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/grep-master.git

# Navigate to project directory
cd grep-master

# Open in your browser
open index.html
# or
python -m http.server 8000  # For a local server
```

## 🎮 How to Play

1. **Start Game**: Click "start-game" from the main menu
2. **Read Challenge**: Each challenge has a description and objective
3. **Examine Files**: Review the provided files in the file browser
4. **Write Command**: Enter your grep command in the terminal
5. **Execute**: Press Enter or click Execute to run your command
6. **Progress**: Complete challenges to unlock new levels

### Controls

- **Enter**: Execute command
- **H**: Get hint (limited per challenge)
- **R**: Reset current challenge
- **S**: Show solution (costs a life)
- **Escape**: Return to main menu or close modals

## 📁 Project Structure

```
grep-master/
├── index.html              # Main HTML structure
├── styles.css              # Terminal-themed CSS
├── script.js               # Main application logic
├── game-engine.js          # Core game mechanics
├── game-data.js            # Levels, challenges, and content
├── terminal-effects.js     # Animations and visual effects
├── README.md               # Project documentation
└── grep_practice/          # Original practice files
    ├── text_files/
    ├── code_files/
    ├── config_files/
    └── ...
```

## 🏗️ Architecture

### Core Components

**Game Engine** (`game-engine.js`)

- State management (score, lives, progress)
- Command parsing and validation
- Challenge progression logic
- Achievement system

**Terminal Effects** (`terminal-effects.js`)

- Typing animations
- Matrix background effects
- Visual feedback (particles, glitch effects)
- Sound generation

**Game Data** (`game-data.js`)

- 15 carefully crafted challenges
- Progressive difficulty curve
- Realistic file contents
- Achievement definitions

## 🎨 Design Features

### Visual Effects

- **Matrix Rain**: Animated background with grep-themed characters
- **Scanlines**: CRT monitor simulation
- **Glitch Effects**: Error state animations
- **Particle Systems**: Success celebrations
- **Typing Animations**: Realistic terminal text rendering

### Audio Design

- **Web Audio API**: Programmatically generated sounds
- **Terminal-Inspired**: Authentic computer beeps and clicks
- **Contextual Feedback**: Different sounds for success/error/navigation

## 🌟 Challenges Overview

### Level 1: Fundamentals (3 challenges)

- Basic pattern matching
- Case-insensitive search
- Line numbers

### Level 2: Advanced Options (3 challenges)

- Count matches
- Invert matching
- Whole word search

### Level 3: Regular Expressions (3 challenges)

- Number patterns
- Email extraction
- Extended regex

### Level 4: Context & Features (3 challenges)

- Context lines
- Extract matches only
- Multiple file search

### Level 5: Master Level (3 challenges)

- Complex log analysis
- Security auditing
- Advanced pattern extraction

## 🏆 Achievement System

- **First Grep** 🔍: Execute your first command
- **Case Master** 🔤: Master case-insensitive searching
- **Regex Rookie** 📝: Use regular expressions
- **Context King** 📋: Effectively use context lines
- **Speed Demon** ⚡: Complete challenges quickly
- **Perfectionist** 💎: Complete without hints
- **Grep Master** 🏆: Complete all challenges

## 🚀 Deployment to GitHub Pages

1. **Fork this repository**
2. **Enable GitHub Pages**:
   - Go to Settings > Pages
   - Select "Deploy from a branch"
   - Choose "main" branch, "/ (root)" folder
   - Click Save
3. **Access your game**: `https://your-username.github.io/grep-master`

### Custom Domain (Optional)

1. Add a `CNAME` file with your domain
2. Configure DNS settings
3. Enable HTTPS in repository settings

## 🛠️ Customization

### Adding New Challenges

Edit `game-data.js` to add new challenges:

```javascript
{
    id: 16,
    title: "Your Challenge Title",
    description: "Challenge description",
    files: {
        "filename.txt": "file content here"
    },
    correctCommand: "grep 'pattern' filename.txt",
    expectedOutput: ["expected", "output", "lines"],
    hints: ["hint1", "hint2", "hint3"],
    timeLimit: 60,
    points: 300
}
```

### Styling Changes

Modify `styles.css` to customize:

- Color scheme (CSS custom properties)
- Fonts and typography
- Animations and effects
- Responsive breakpoints

### Sound Effects

Update `script.js` audio functions to change:

- Sound frequencies and patterns
- Audio timing and duration
- Success/error sound design

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report Issues**: Found a bug? Open an issue
2. **Suggest Features**: Have ideas? We'd love to hear them
3. **Submit PRs**: Fork, create a feature branch, and submit a pull request
4. **Improve Documentation**: Help others understand the project
5. **Add Challenges**: Create new grep challenges

### Development Setup

```bash
git clone https://github.com/your-username/grep-master.git
cd grep-master
# No build process needed - open index.html in browser
# For development server:
python -m http.server 8000
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **grep community**: For creating such a powerful tool
- **Terminal enthusiasts**: For inspiring the aesthetic
- **Educators**: Who believe in learning by doing
- **Open source contributors**: Making knowledge freely available

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/grep-master/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/grep-master/discussions)
- **Email**: your-email@example.com

---

**Happy grepping! 🔍✨**

_Master the command line, one pattern at a time._
