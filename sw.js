// Service worker: lets Grep Master work offline.
//
// Everything the game needs is cached when the worker installs. Requests go
// to the network first, so a new deploy shows up right away; when the network
// is down (or slower than NETWORK_TIMEOUT_MS), the cached copy is used. Google
// Fonts are cached as they're fetched; without them the game falls back to a
// local monospace font.
//
// When you add a file the game loads, add it to PRECACHE (tests/offline.test.mjs
// checks this).

const CACHE = "grep-master-v1";
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icon.svg",
  "js/animations.js",
  "js/audio.js",
  "js/awk.js",
  "js/command-autocomplete.js",
  "js/diagnose.js",
  "js/game-data.js",
  "js/game-engine.js",
  "js/generator.js",
  "js/incident-list.js",
  "js/incidents.js",
  "js/learner.js",
  "js/main.js",
  "js/progress-io.js",
  "js/progress-ui.js",
  "js/scheduler.js",
  "js/settings.js",
  "js/shell.js",
  "js/skill-map.js",
  "js/skills.js",
  "js/terminal-effects.js",
  "js/ui.js",
  "js/variants.js",
];

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !FONT_HOSTS.includes(url.hostname)) return;
  event.respondWith(networkFirst(request));
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = () => cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then((response) => {
    if (response.ok || response.type === "opaque") cache.put(request, response.clone());
    return response;
  });
  try {
    // A slow network falls back to the cache, if there's anything there.
    return await Promise.race([network, wait(NETWORK_TIMEOUT_MS).then(async () => (await cached()) || network)]);
  } catch {
    const fallback = (await cached()) || (request.mode === "navigate" ? await cache.match("index.html") : undefined);
    return fallback || Response.error();
  }
}
