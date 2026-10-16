// Staggered fade-in animations for the Cheat Sheet and Settings screens.

function staggerIn(elements, { transform, transition, delay }) {
  elements.forEach((element, index) => {
    element.style.opacity = "0";
    element.style.transform = transform;

    setTimeout(() => {
      requestAnimationFrame(() => {
        element.style.transition = transition;
        element.style.opacity = "1";
        element.style.transform = "none";
      });
    }, index * delay);
  });
}

export function animateTutorialContent() {
  staggerIn(document.querySelectorAll(".tutorial-section h3, .tutorial-section p, .option"), {
    transform: "translateY(20px)",
    transition: "all 0.5s ease",
    delay: 60,
  });
}

export function animateSettingsContent() {
  staggerIn(document.querySelectorAll(".settings-section"), {
    transform: "translateY(30px)",
    transition: "all 0.6s ease",
    delay: 200,
  });
}
