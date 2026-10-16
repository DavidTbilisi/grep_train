// Terminal Effects - typing animation, matrix rain, scanline, and input feedback

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

}

export { TerminalEffects };
export const terminalEffects = new TerminalEffects();
