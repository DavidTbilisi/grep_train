// Scheduler - picks which skill to practise next, and how hard. Pure (no DOM).
//
// In order of priority:
//   1. remediate: the last skill failed twice in a row, so step back to its
//      weakest prerequisite (or an easier version of the same skill)
//   2. review:    a mastered skill whose review date has come
//   3. learn:     the weakest skill already started, then the next new skill
//                 whose prerequisites are in place (teaching order)
//   4. stretch:   everything is mastered, so harder versions of the skill
//                 whose review is nearest
//
// chooseKind then decides whether the challenge is predict, fix, or write.

import { SKILLS, SKILL_BY_ID } from "./skills.js";
import { skillState, isMastered, isUnlocked, isDue } from "./learner.js";

// Harder challenges as mastery grows: three clean solves go 1 -> 2 -> 3.
function difficultyFor(state) {
  if (state.mastery < 0.3) return 1;
  if (state.mastery < 0.6) return 2;
  return 3;
}

/**
 * @param learner  see learner.js
 * @param options.now     current time in ms
 * @param options.focus   a skill id the player chose to practise, or null
 * @param options.recent  skill ids of the latest practice challenges, oldest first
 * @param options.avoid   a skill the player just skipped without trying, or null
 * @returns {{ skill: string, reason: string, difficulty: number, from?: string }}
 */
function pickNext(learner, { now = Date.now(), focus = null, recent = [], avoid = null } = {}) {
  const state = (id) => skillState(learner, id);
  const last = recent[recent.length - 1];
  // Drop the skipped skill from a list, unless it's the only option.
  const notAvoided = (ids) => (ids.length > 1 ? ids.filter((id) => id !== avoid) : ids);

  if (last && last !== avoid && state(last).fails >= 2) {
    const weakParent = SKILL_BY_ID[last].requires
      .filter((id) => !isMastered(state(id)))
      .sort((a, b) => state(a).mastery - state(b).mastery)[0];
    if (weakParent && !focus) return { skill: weakParent, reason: "remediate", difficulty: 1, from: last };
    return { skill: last, reason: "remediate", difficulty: 1 };
  }

  if (focus) return { skill: focus, reason: "focus", difficulty: difficultyFor(state(focus)) };

  const due = notAvoided(SKILLS.map((s) => s.id).filter((id) => isDue(state(id), now)));
  due.sort((a, b) => state(a).due - state(b).due);
  if (due.length) return { skill: due[0], reason: "review", difficulty: 2 };

  const order = (id) => SKILLS.findIndex((s) => s.id === id);
  const candidates = notAvoided(SKILLS.map((s) => s.id).filter((id) => !isMastered(state(id)) && isUnlocked(learner, id)));
  candidates.sort((a, b) => {
    const startedA = state(a).attempts > 0 ? 0 : 1;
    const startedB = state(b).attempts > 0 ? 0 : 1;
    return startedA - startedB || state(a).mastery - state(b).mastery || order(a) - order(b);
  });
  if (candidates.length) {
    // Interleave: after two in a row on one skill, switch if there's another.
    const repeated = recent.length >= 2 && recent.slice(-2).every((id) => id === candidates[0]);
    const skill = repeated && candidates.length > 1 ? candidates[1] : candidates[0];
    return { skill, reason: state(skill).attempts ? "learn" : "new", difficulty: difficultyFor(state(skill)) };
  }

  const mastered = SKILLS.map((s) => s.id).filter((id) => isMastered(state(id)));
  mastered.sort((a, b) => (state(a).due ?? Infinity) - (state(b).due ?? Infinity));
  const pool = mastered.filter((id) => id !== last && id !== avoid);
  return { skill: pool[0] || mastered[0] || SKILLS[0].id, reason: "stretch", difficulty: 3 };
}

/**
 * How to present the picked skill: "predict" (read a command, pick its
 * output), "fix" (repair a nearly-right command), or "write" (from scratch).
 * Read first when a skill is new, fix when struggling (a nearly-right command
 * is a scaffold), and a mix once it's familiar. `roll` is random in [0, 1).
 */
function chooseKind(pick, learner, roll) {
  if (pick.reason === "remediate") return "fix";
  if (skillState(learner, pick.skill).attempts === 0) return "predict";
  if (pick.reason === "review") return roll < 1 / 3 ? "predict" : roll < 2 / 3 ? "fix" : "write";
  if (pick.reason === "stretch") return roll < 0.5 ? "fix" : "write";
  return roll < 0.25 ? "fix" : "write";
}

export { pickNext, difficultyFor, chooseKind };
