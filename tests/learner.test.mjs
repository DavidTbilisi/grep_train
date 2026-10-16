import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newLearner, skillState, isMastered, isDue, outcomeScore, recordResult, recordMistake,
  grantPlacement, masteredCount, loadLearner, saveLearner, LEARNER_KEY, DAY,
} from "../js/learner.js";

const NOW = 1_700_000_000_000;

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}

test("outcomeScore", () => {
  assert.equal(outcomeScore({ solved: true, solutionShown: false, hintsUsed: 0, wrong: 0 }), 1);
  assert.equal(outcomeScore({ solved: true, solutionShown: false, hintsUsed: 1, wrong: 0 }), 0.75);
  assert.equal(outcomeScore({ solved: true, solutionShown: false, hintsUsed: 0, wrong: 10 }), 0.8);
  assert.equal(outcomeScore({ solved: true, solutionShown: false, hintsUsed: 3, wrong: 4 }), 0.2);
  assert.equal(outcomeScore({ solved: true, solutionShown: true, hintsUsed: 0, wrong: 0 }), 0);
  assert.equal(outcomeScore({ solved: false, solutionShown: false, hintsUsed: 0, wrong: 0 }), 0);
});

test("three clean solves master a skill and schedule a review in a day", () => {
  const learner = newLearner();
  recordResult(learner, ["grep-i"], 1, NOW);
  recordResult(learner, ["grep-i"], 1, NOW);
  assert.ok(!isMastered(skillState(learner, "grep-i")));
  const [change] = recordResult(learner, ["grep-i"], 1, NOW);
  assert.ok(change.newlyMastered);
  assert.equal(skillState(learner, "grep-i").due, NOW + DAY);
  assert.equal(masteredCount(learner), 1);
});

test("solving with hints every time never reaches mastery", () => {
  const learner = newLearner();
  for (let i = 0; i < 20; i++) recordResult(learner, ["grep-i"], 0.75, NOW);
  assert.ok(!isMastered(skillState(learner, "grep-i")));
});

test("a good review stretches the interval; a failure resets it", () => {
  const learner = newLearner();
  for (let i = 0; i < 3; i++) recordResult(learner, ["wc"], 1, NOW);
  const later = NOW + 2 * DAY;
  assert.ok(isDue(skillState(learner, "wc"), later));
  recordResult(learner, ["wc"], 1, later);
  assert.equal(skillState(learner, "wc").step, 1);
  assert.equal(skillState(learner, "wc").due, later + 3 * DAY);

  // Using a mastered skill before it's due doesn't advance the schedule.
  recordResult(learner, ["wc"], 1, later + DAY);
  assert.equal(skillState(learner, "wc").step, 1);

  recordResult(learner, ["wc"], 0, later + 4 * DAY);
  assert.ok(!isMastered(skillState(learner, "wc")));
  assert.equal(skillState(learner, "wc").due, null);
  assert.equal(skillState(learner, "wc").fails, 1);
});

test("mistakes are counted and nudge mastery down", () => {
  const learner = newLearner();
  recordResult(learner, ["sort-uniq"], 1, NOW);
  recordMistake(learner, "sort-uniq", "uniq-unsorted");
  recordMistake(learner, null, "too-many");
  assert.equal(learner.mistakes["uniq-unsorted"], 1);
  assert.equal(learner.mistakes["too-many"], 1);
  assert.ok(Math.abs(skillState(learner, "sort-uniq").mastery - 0.35) < 1e-9);
});

test("placement grants a skill and everything it builds on", () => {
  const learner = newLearner();
  const granted = grantPlacement(learner, ["uniq-count"], NOW);
  assert.deepEqual(new Set(granted), new Set(["grep-basic", "head-tail", "wc", "pipes", "columns", "sort-uniq", "uniq-count"]));
  assert.ok(granted.every((id) => isMastered(skillState(learner, id))));
  assert.equal(skillState(learner, "pipes").due, NOW + 3 * DAY);
  assert.deepEqual(grantPlacement(learner, ["pipes"], NOW), []); // already mastered
});

test("save and load round-trip", () => {
  const storage = fakeStorage();
  const learner = newLearner();
  recordResult(learner, ["grep-basic"], 1, NOW);
  learner.course.index = 4;
  saveLearner(storage, learner);
  const loaded = loadLearner(storage);
  assert.deepEqual(loaded, learner);
});

test("old course progress is migrated into skills", () => {
  const storage = fakeStorage({ grepMasterProgress: JSON.stringify({ index: 3, solved: { 0: 100, 1: 75 } }) });
  const learner = loadLearner(storage, [["grep-basic"], ["grep-i"]], NOW);
  assert.equal(learner.course.index, 3);
  assert.equal(skillState(learner, "grep-basic").mastery, 0.4);
  assert.ok(Math.abs(skillState(learner, "grep-i").mastery - 0.3) < 1e-9);
  assert.equal(storage.getItem("grepMasterProgress"), null);
  assert.ok(storage.getItem(LEARNER_KEY));
});

test("corrupt or missing storage starts fresh", () => {
  assert.deepEqual(loadLearner(fakeStorage({ [LEARNER_KEY]: "{not json" })), newLearner());
  assert.deepEqual(loadLearner(null), newLearner());
  const throwing = { getItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(loadLearner(throwing), newLearner());
});
