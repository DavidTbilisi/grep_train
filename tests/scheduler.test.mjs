import { test } from "node:test";
import assert from "node:assert/strict";
import { pickNext } from "../js/scheduler.js";
import { newLearner, recordResult, grantPlacement, DAY } from "../js/learner.js";
import { SKILLS } from "../js/skills.js";

const NOW = 1_700_000_000_000;

test("a new player starts with grep basics, easy", () => {
  assert.deepEqual(pickNext(newLearner(), { now: NOW }), { skill: "grep-basic", reason: "new", difficulty: 1 });
});

test("difficulty rises with mastery", () => {
  const learner = newLearner();
  recordResult(learner, ["grep-basic"], 1, NOW);
  assert.deepEqual(pickNext(learner, { now: NOW, recent: ["grep-basic"] }), { skill: "grep-basic", reason: "learn", difficulty: 2 });
});

test("after two in a row on one skill, it interleaves another", () => {
  const learner = newLearner();
  recordResult(learner, ["grep-basic"], 1, NOW);
  recordResult(learner, ["grep-basic"], 1, NOW);
  const pick = pickNext(learner, { now: NOW, recent: ["grep-basic", "grep-basic"] });
  assert.notEqual(pick.skill, "grep-basic");
  assert.equal(pick.reason, "new");
});

test("skills stay locked until their prerequisites are halfway there", () => {
  const learner = newLearner();
  const picks = new Set();
  const recent = [];
  for (let i = 0; i < 6; i++) {
    const { skill } = pickNext(learner, { now: NOW, recent });
    picks.add(skill);
    recent.push(skill);
  }
  // Nothing solved yet, so only skills without prerequisites are offered.
  for (const skill of picks) assert.ok(["grep-basic", "head-tail", "wc"].includes(skill), skill);
});

test("due reviews come first", () => {
  const learner = newLearner();
  for (let i = 0; i < 3; i++) recordResult(learner, ["wc"], 1, NOW);
  assert.deepEqual(pickNext(learner, { now: NOW + 2 * DAY }), { skill: "wc", reason: "review", difficulty: 2 });
});

test("two failures in a row step back to the weakest prerequisite", () => {
  const learner = newLearner();
  grantPlacement(learner, ["grep-basic", "head-tail"], NOW);
  recordResult(learner, ["pipes"], 0, NOW);
  recordResult(learner, ["pipes"], 0, NOW);
  assert.deepEqual(pickNext(learner, { now: NOW, recent: ["pipes"] }), {
    skill: "wc", reason: "remediate", difficulty: 1, from: "pipes",
  });
});

test("with no prerequisite to fall back on, it gives an easier one", () => {
  const learner = newLearner();
  recordResult(learner, ["grep-basic"], 0, NOW);
  recordResult(learner, ["grep-basic"], 0, NOW);
  assert.deepEqual(pickNext(learner, { now: NOW, recent: ["grep-basic"] }), { skill: "grep-basic", reason: "remediate", difficulty: 1 });
});

test("a skill skipped without trying is avoided next time", () => {
  const learner = newLearner();
  const pick = pickNext(learner, { now: NOW, recent: ["grep-basic"], avoid: "grep-basic" });
  assert.equal(pick.skill, "head-tail");
});

test("focus practises the chosen skill", () => {
  const pick = pickNext(newLearner(), { now: NOW, focus: "awk-filter" });
  assert.deepEqual(pick, { skill: "awk-filter", reason: "focus", difficulty: 1 });
});

test("when everything is mastered and nothing is due, it stretches", () => {
  const learner = newLearner();
  for (const skill of SKILLS) for (let i = 0; i < 3; i++) recordResult(learner, [skill.id], 1, NOW);
  const pick = pickNext(learner, { now: NOW });
  assert.equal(pick.reason, "stretch");
  assert.equal(pick.difficulty, 3);
});

test("a simulated perfect player masters every skill", () => {
  const learner = newLearner();
  const recent = [];
  let steps = 0;
  while (SKILLS.some((s) => !(learner.skills[s.id]?.mastery >= 0.75 && learner.skills[s.id]?.attempts >= 3))) {
    const { skill } = pickNext(learner, { now: NOW, recent });
    recordResult(learner, [skill], 1, NOW);
    recent.push(skill);
    assert.ok(++steps < 100, "should finish in well under 100 challenges");
  }
  assert.equal(steps, SKILLS.length * 3);
});
