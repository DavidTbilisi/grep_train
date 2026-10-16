// Learner model - how well the player knows each skill, and when to review it.
// Pure (no DOM): storage is passed in, so this can be tested in Node.
//
// Mastery is a number from 0 to 1 per skill. Each result moves it part of the
// way towards that result's score (an exponentially weighted average), so
// recent results count most. A skill is mastered at MASTERED or above after
// at least MIN_ATTEMPTS results; three clean solves in a row get there.
// Mastered skills come back for review after 1, 3, 7, 14, then 30 days.

import { SKILLS, SKILL_BY_ID, ancestors } from "./skills.js";

const LEARNER_KEY = "grepMasterLearner";
const OLD_PROGRESS_KEY = "grepMasterProgress"; // v2.0 course-only progress

const RATE = 0.4;
const MASTERED = 0.75;
const MIN_ATTEMPTS = 3;
const UNLOCKED = 0.5; // prerequisites need this much before a skill is suggested
const MISTAKE_PENALTY = 0.05;
const REVIEW_DAYS = [1, 3, 7, 14, 30];
const DAY = 24 * 60 * 60 * 1000;

function newLearner() {
  return {
    version: 3,
    skills: {}, // id -> { mastery, attempts, fails, step, due, lastSeen }
    course: { index: 0, solved: {} }, // course challenge index -> points earned
    practice: { solved: 0, points: 0 },
    mistakes: {}, // diagnosis kind -> count
    placementDone: false,
  };
}

function skillState(learner, id) {
  return learner.skills[id] ?? { mastery: 0, attempts: 0, fails: 0, step: 0, due: null, lastSeen: null };
}

function isMastered(state) {
  return state.mastery >= MASTERED && state.attempts >= MIN_ATTEMPTS;
}

function isUnlocked(learner, id) {
  return SKILL_BY_ID[id].requires.every((parent) => skillState(learner, parent).mastery >= UNLOCKED);
}

function isDue(state, now) {
  return isMastered(state) && state.due !== null && state.due <= now;
}

/**
 * Score one attempt at a challenge, from 0 (gave up or saw the solution) to 1
 * (solved cleanly). Wrong runs cost a little, since some are just exploring.
 */
function outcomeScore({ solved, solutionShown, hintsUsed, wrong }) {
  if (!solved || solutionShown) return 0;
  return Math.max(0.2, 1 - 0.25 * hintsUsed - 0.05 * Math.min(wrong, 4));
}

/**
 * Apply one result to some skills.
 * @returns {{id, before, after, mastered, newlyMastered}[]}
 */
function recordResult(learner, skillIds, score, now = Date.now()) {
  return [...new Set(skillIds)].map((id) => {
    const state = { ...skillState(learner, id) };
    const before = state.mastery;
    const wasMastered = isMastered(state);

    state.mastery = Math.min(1, Math.max(0, state.mastery + RATE * (score - state.mastery)));
    state.attempts++;
    state.fails = score < 0.5 ? state.fails + 1 : 0;
    state.lastSeen = now;

    if (!isMastered(state)) {
      state.step = 0;
      state.due = null;
    } else if (!wasMastered || score < 0.7) {
      state.step = 0;
      state.due = now + REVIEW_DAYS[0] * DAY;
    } else {
      // A good result on a due review moves to the next, longer interval.
      if (state.due !== null && now >= state.due) state.step = Math.min(state.step + 1, REVIEW_DAYS.length - 1);
      state.due = Math.max(state.due ?? 0, now + REVIEW_DAYS[state.step] * DAY);
    }

    learner.skills[id] = state;
    return { id, before, after: state.mastery, mastered: isMastered(state), newlyMastered: !wasMastered && isMastered(state) };
  });
}

// A wrong answer that points at a specific misunderstanding (see diagnose.js).
function recordMistake(learner, skillId, kind) {
  learner.mistakes[kind] = (learner.mistakes[kind] || 0) + 1;
  if (!skillId) return;
  const state = { ...skillState(learner, skillId) };
  state.mastery = Math.max(0, state.mastery - MISTAKE_PENALTY);
  learner.skills[skillId] = state;
}

/**
 * Passing a placement question counts as mastering the skills used and
 * everything they build on. Reviews soon confirm it.
 * @returns {string[]} the skills that were newly granted
 */
function grantPlacement(learner, skillIds, now = Date.now()) {
  const all = new Set(skillIds.flatMap((id) => [id, ...ancestors(id)]));
  const granted = [];
  for (const id of SKILLS.map((s) => s.id).filter((s) => all.has(s))) {
    const state = { ...skillState(learner, id) };
    if (isMastered(state)) continue;
    state.mastery = Math.max(state.mastery, 0.8);
    state.attempts = Math.max(state.attempts, MIN_ATTEMPTS);
    state.fails = 0;
    state.step = 1;
    state.due = now + REVIEW_DAYS[1] * DAY;
    learner.skills[id] = state;
    granted.push(id);
  }
  return granted;
}

function masteredCount(learner) {
  return SKILLS.filter((s) => isMastered(skillState(learner, s.id))).length;
}

function dueCount(learner, now = Date.now()) {
  return SKILLS.filter((s) => isDue(skillState(learner, s.id), now)).length;
}

// ---------- Storage ----------

/**
 * Load the learner from storage (anything with getItem/setItem/removeItem).
 * Old course-only progress is migrated: each solved course challenge counts
 * as a result for its skills (courseSkills[i] lists challenge i's skills).
 */
function loadLearner(storage, courseSkills = [], now = Date.now()) {
  const learner = newLearner();
  if (!storage) return learner;
  try {
    const saved = JSON.parse(storage.getItem(LEARNER_KEY));
    if (saved && typeof saved === "object" && saved.skills) {
      return {
        ...learner,
        ...saved,
        course: { ...learner.course, ...saved.course },
        practice: { ...learner.practice, ...saved.practice },
        mistakes: { ...saved.mistakes },
        version: learner.version,
      };
    }
    const old = JSON.parse(storage.getItem(OLD_PROGRESS_KEY));
    if (old && typeof old === "object") {
      learner.course = { index: old.index || 0, solved: old.solved || {} };
      for (const [index, points] of Object.entries(learner.course.solved)) {
        recordResult(learner, courseSkills[index] || [], points / 100, now);
      }
      saveLearner(storage, learner);
      storage.removeItem(OLD_PROGRESS_KEY);
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return learner;
}

function saveLearner(storage, learner) {
  try {
    storage?.setItem(LEARNER_KEY, JSON.stringify(learner));
  } catch {
    // Storage unavailable (private mode): progress just won't persist.
  }
}

export {
  LEARNER_KEY,
  MASTERED,
  UNLOCKED,
  REVIEW_DAYS,
  DAY,
  newLearner,
  skillState,
  isMastered,
  isUnlocked,
  isDue,
  outcomeScore,
  recordResult,
  recordMistake,
  grantPlacement,
  masteredCount,
  dueCount,
  loadLearner,
  saveLearner,
};
