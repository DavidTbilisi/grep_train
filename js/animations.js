import { terminalEffects } from './terminal-effects.js';

export function startWelcomeAnimations() {
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

export function animateTutorialContent() {
  const sections = document.querySelectorAll(
    ".tutorial-section h3, .tutorial-section p, .option"
  );

  sections.forEach((section, index) => {
    section.style.opacity = "0";
    section.style.transform = "translateY(20px)";

    setTimeout(() => {
      requestAnimationFrame(() => {
        section.style.transition = "all 0.5s ease";
        section.style.opacity = "1";
        section.style.transform = "translateY(0)";
      });
    }, index * 100);
  });
}

export function animateAboutContent() {
  const elements = document.querySelectorAll(
    ".about-content h2, .about-content h3, .about-content p, .about-content li"
  );

  elements.forEach((element, index) => {
    element.style.opacity = "0";
    element.style.transform = "translateX(-20px)";

    setTimeout(() => {
      requestAnimationFrame(() => {
        element.style.transition = "all 0.4s ease";
        element.style.opacity = "1";
        element.style.transform = "translateX(0)";
      });
    }, index * 50);
  });
}

export function animateSettingsContent() {
  const sections = document.querySelectorAll(".settings-section");

  sections.forEach((section, index) => {
    section.style.opacity = "0";
    section.style.transform = "translateY(30px)";

    setTimeout(() => {
      requestAnimationFrame(() => {
        section.style.transition = "all 0.6s ease";
        section.style.opacity = "1";
        section.style.transform = "translateY(0)";
      });
    }, index * 200);
  });
}
