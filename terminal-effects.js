// Terminal Effects - Typing animations and visual effects

class TerminalEffects {
  constructor() {
    this.typingSpeed = 50; // milliseconds per character
    this.cursorBlinkSpeed = 530; // milliseconds
    this.activeTypingElements = new Set();
  }

  // Initialize all terminal effects
  init() {
    this.initTypingAnimations();
    this.initMatrixEffect();
    this.initScanlineEffect();
    this.initGlitchEffects();
  }

  // Initialize typing animations for text elements
  initTypingAnimations() {
    const typingElements = document.querySelectorAll(".typing-text");

    typingElements.forEach((element, index) => {
      const text = element.getAttribute("data-text") || element.textContent;
      element.textContent = "";
      element.style.opacity = "1";

      // Stagger the start times
      setTimeout(() => {
        this.typeText(element, text);
      }, index * 1000);
    });
  }

  // Type text with cursor effect
  typeText(element, text, callback) {
    if (this.activeTypingElements.has(element)) return;

    this.activeTypingElements.add(element);
    element.innerHTML = "";

    let i = 0;
    const cursor = '<span class="typing-cursor">|</span>';

    // Add initial cursor
    element.innerHTML = cursor;

    const typeInterval = setInterval(() => {
      if (i < text.length) {
        element.innerHTML = text.substring(0, i + 1) + cursor;
        i++;
      } else {
        // Typing complete
        clearInterval(typeInterval);

        // Blink cursor a few times then remove
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
          const currentCursor = element.querySelector(".typing-cursor");
          if (currentCursor) {
            currentCursor.style.visibility =
              currentCursor.style.visibility === "hidden"
                ? "visible"
                : "hidden";
          }

          blinkCount++;
          if (blinkCount > 6) {
            clearInterval(blinkInterval);
            element.innerHTML = text;
            this.activeTypingElements.delete(element);
            if (callback) callback();
          }
        }, this.cursorBlinkSpeed);
      }
    }, this.typingSpeed);
  }

  // Command prompt typing effect
  typeCommand(input, command, callback) {
    input.value = "";
    input.focus();

    let i = 0;
    const typeInterval = setInterval(() => {
      if (i < command.length) {
        input.value = command.substring(0, i + 1);
        i++;
      } else {
        clearInterval(typeInterval);
        if (callback) callback();
      }
    }, this.typingSpeed);
  }

  // Terminal output animation
  animateOutput(container, lines, callback) {
    container.innerHTML = "";

    let lineIndex = 0;
    const addLine = () => {
      if (lineIndex < lines.length) {
        const line = document.createElement("div");
        line.className = "output-line";
        line.textContent = lines[lineIndex];
        line.style.opacity = "0";
        line.style.transform = "translateX(-20px)";

        container.appendChild(line);

        // Animate in
        setTimeout(() => {
          line.style.transition = "all 0.3s ease";
          line.style.opacity = "1";
          line.style.transform = "translateX(0)";
        }, 50);

        lineIndex++;
        setTimeout(addLine, 100);
      } else {
        if (callback) callback();
      }
    };

    addLine();
  }

  // Matrix-style background effect
  initMatrixEffect() {
    const canvas = document.createElement("canvas");
    canvas.id = "matrix-canvas";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "-2";
    canvas.style.opacity = "0.05";
    canvas.style.pointerEvents = "none";

    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    // Resize canvas
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Matrix characters
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?grep";
    const charArray = chars.split("");

    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    // Draw matrix
    const drawMatrix = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#00ff41";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    setInterval(drawMatrix, 100);
  }

  // Scanline effect
  initScanlineEffect() {
    const scanline = document.createElement("div");
    scanline.className = "scanline";
    scanline.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background: linear-gradient(90deg, transparent, #00ff41, transparent);
            z-index: 1000;
            pointer-events: none;
            opacity: 0.3;
            animation: scanline 3s linear infinite;
        `;

    // Add scanline animation to CSS
    if (!document.querySelector("#scanline-style")) {
      const style = document.createElement("style");
      style.id = "scanline-style";
      style.textContent = `
                @keyframes scanline {
                    0% { top: -2px; opacity: 0; }
                    10% { opacity: 0.3; }
                    90% { opacity: 0.3; }
                    100% { top: 100vh; opacity: 0; }
                }
            `;
      document.head.appendChild(style);
    }

    document.body.appendChild(scanline);
  }

  // Glitch effects for special moments
  initGlitchEffects() {
    if (!document.querySelector("#glitch-style")) {
      const style = document.createElement("style");
      style.id = "glitch-style";
      style.textContent = `
                .glitch {
                    animation: glitch 0.3s linear infinite;
                }
                
                @keyframes glitch {
                    0% { transform: translate(0); }
                    20% { transform: translate(-2px, 2px); }
                    40% { transform: translate(-2px, -2px); }
                    60% { transform: translate(2px, 2px); }
                    80% { transform: translate(2px, -2px); }
                    100% { transform: translate(0); }
                }
                
                .text-glitch {
                    position: relative;
                }
                
                .text-glitch::before,
                .text-glitch::after {
                    content: attr(data-text);
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }
                
                .text-glitch::before {
                    animation: glitch-1 0.5s linear infinite;
                    color: #ff0040;
                    z-index: -1;
                }
                
                .text-glitch::after {
                    animation: glitch-2 0.5s linear infinite;
                    color: #00ffff;
                    z-index: -2;
                }
                
                @keyframes glitch-1 {
                    0% { transform: translate(0); }
                    20% { transform: translate(-2px, 2px); }
                    40% { transform: translate(-2px, -2px); }
                    60% { transform: translate(2px, 2px); }
                    80% { transform: translate(2px, -2px); }
                    100% { transform: translate(0); }
                }
                
                @keyframes glitch-2 {
                    0% { transform: translate(0); }
                    20% { transform: translate(2px, -2px); }
                    40% { transform: translate(2px, 2px); }
                    60% { transform: translate(-2px, -2px); }
                    80% { transform: translate(-2px, 2px); }
                    100% { transform: translate(0); }
                }
            `;
      document.head.appendChild(style);
    }
  }

  // Apply glitch effect to element
  glitchElement(element, duration = 1000) {
    element.classList.add("glitch");
    setTimeout(() => {
      element.classList.remove("glitch");
    }, duration);
  }

  // Text glitch effect
  glitchText(element, text, duration = 2000) {
    element.classList.add("text-glitch");
    element.setAttribute("data-text", text);

    setTimeout(() => {
      element.classList.remove("text-glitch");
      element.removeAttribute("data-text");
    }, duration);
  }

  // Success particle effect
  createSuccessParticles(container) {
    const particles = [];
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = "success-particle";
      particle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: #00ff41;
                border-radius: 50%;
                pointer-events: none;
                z-index: 1000;
            `;

      const startX = Math.random() * container.offsetWidth;
      const startY = Math.random() * container.offsetHeight;
      const endX = startX + (Math.random() - 0.5) * 200;
      const endY = startY - Math.random() * 100;

      particle.style.left = startX + "px";
      particle.style.top = startY + "px";

      container.appendChild(particle);
      particles.push(particle);

      // Animate particle
      particle.animate(
        [
          {
            transform: "translate(0, 0) scale(1)",
            opacity: 1,
          },
          {
            transform: `translate(${endX - startX}px, ${
              endY - startY
            }px) scale(0)`,
            opacity: 0,
          },
        ],
        {
          duration: 1000 + Math.random() * 500,
          easing: "ease-out",
        }
      ).onfinish = () => {
        particle.remove();
      };
    }
  }

  // Error shake effect
  shakeElement(element, intensity = 10) {
    const originalTransform = element.style.transform;

    element.animate(
      [
        { transform: "translateX(0)" },
        { transform: `translateX(${intensity}px)` },
        { transform: `translateX(-${intensity}px)` },
        { transform: `translateX(${intensity}px)` },
        { transform: `translateX(-${intensity}px)` },
        { transform: "translateX(0)" },
      ],
      {
        duration: 500,
        easing: "ease-in-out",
      }
    ).onfinish = () => {
      element.style.transform = originalTransform;
    };
  }

  // Terminal boot sequence
  playBootSequence(callback) {
    const bootMessages = [
      "Initializing grep environment...",
      "Loading command parser...",
      "Mounting file systems...",
      "Starting game engine...",
      "Ready for grep mastery!",
    ];

    const container = document.createElement("div");
    container.className = "boot-sequence";
    container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-family: 'Fira Code', monospace;
            color: #00ff41;
        `;

    document.body.appendChild(container);

    let messageIndex = 0;
    const showMessage = () => {
      if (messageIndex < bootMessages.length) {
        const message = document.createElement("div");
        message.textContent = bootMessages[messageIndex];
        message.style.opacity = "0";
        message.style.marginBottom = "10px";

        container.appendChild(message);

        // Fade in
        message.animate(
          [
            { opacity: 0, transform: "translateY(20px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: 500,
            fill: "forwards",
          }
        );

        messageIndex++;
        setTimeout(showMessage, 800);
      } else {
        // Boot complete
        setTimeout(() => {
          container.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 500,
          }).onfinish = () => {
            container.remove();
            if (callback) callback();
          };
        }, 1000);
      }
    };

    showMessage();
  }

  // Command highlight effect
  highlightCommand(element) {
    const highlight = document.createElement("div");
    highlight.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 255, 65, 0.2);
            pointer-events: none;
            z-index: 1;
        `;

    element.style.position = "relative";
    element.appendChild(highlight);

    highlight.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], {
      duration: 1000,
    }).onfinish = () => {
      highlight.remove();
    };
  }

  // Progress bar animation
  animateProgressBar(element, progress, duration = 1000) {
    const progressBar = element.querySelector(".progress-fill") || element;

    progressBar.animate([{ width: "0%" }, { width: `${progress}%` }], {
      duration: duration,
      fill: "forwards",
      easing: "ease-out",
    });
  }

  // Cleanup method
  cleanup() {
    this.activeTypingElements.clear();

    // Remove matrix canvas
    const matrixCanvas = document.getElementById("matrix-canvas");
    if (matrixCanvas) {
      matrixCanvas.remove();
    }

    // Remove scanline
    const scanline = document.querySelector(".scanline");
    if (scanline) {
      scanline.remove();
    }
  }
}

// Global terminal effects instance
const terminalEffects = new TerminalEffects();
