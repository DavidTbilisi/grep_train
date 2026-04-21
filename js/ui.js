// Screen management
export function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add("active");
  }
}

// Transition effect
export function showTransition(callback) {
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

// Loading screen management
export function showLoading() {
  const loading = document.getElementById("loading-overlay");
  if (loading) {
    loading.classList.remove("hidden", "fade-out");
    loading.style.display = "flex";
  }
}

export function hideLoading() {
  const loading = document.getElementById("loading-overlay");
  if (loading) {
    loading.classList.add("fade-out");
    setTimeout(() => {
      loading.classList.add("hidden");
      loading.style.display = "none";
    }, 800);
  }
}
