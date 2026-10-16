import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS, scenarioSkills, buildIncident } from "../js/incidents.js";
import { missingSkills } from "../js/incident-list.js";
import { detectSkills, SKILL_BY_ID } from "../js/skills.js";
import { newLearner, grantPlacement, loadLearner, saveLearner } from "../js/learner.js";
import { runBash, normalizeSpaces } from "./bash.mjs";

test("every scenario builds well-formed steps", () => {
  for (const scenario of SCENARIOS) {
    for (let seed = 1; seed <= 100; seed++) {
      const inc = buildIncident(scenario.id, seed);
      const label = `${scenario.id} seed ${seed}`;
      assert.ok(inc.steps.length >= 4, label);
      assert.ok(inc.intro.length > 20 && inc.outro.length > 20, label);
      for (const step of inc.steps) {
        assert.equal(step.hints.length, 3, label);
        assert.equal(step.hints[2], step.solution, label);
        assert.ok(step.expected.length > 0 && step.expected.length <= 25, `${label}: ${step.solution}`);
        assert.ok(step.note.length > 5 && !step.note.includes("undefined"), `${label}: ${step.note}`);
        assert.ok(!step.solution.includes("undefined"), label);
        for (const skill of step.skills) {
          assert.ok(SKILL_BY_ID[skill], skill);
          assert.ok(detectSkills(step.solution).includes(skill), `${label}: "${step.solution}" should use ${skill}`);
        }
      }
    }
  }
});

test("same seed, same incident", () => {
  for (const scenario of SCENARIOS) {
    assert.deepEqual(buildIncident(scenario.id, 7), buildIncident(scenario.id, 7));
  }
});

test("each step's answer leads to the next", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const breakIn = buildIncident("break-in", seed);
    const attacker = breakIn.steps[1].expected[0].trim().split(/\s+/)[1];
    assert.ok(breakIn.steps[2].solution.includes(attacker), "step 3 follows the IP found in step 2");
    assert.ok(breakIn.steps[3].expected.some((line) => line.includes("POST /login 200")), "the attacker got in");

    const crash = buildIncident("crash-flood", seed);
    const main = crash.steps[1].expected[0].trim().replace(/^\d+ /, "");
    assert.ok(crash.steps[2].solution.includes(main), "step 3 follows the message found in step 2");
    assert.ok(!crash.steps[4].expected.includes(main), "the other errors exclude the main one");

    const hog = buildIncident("bandwidth-hog", seed);
    const ip = hog.steps[2].expected[0].split(" ")[1];
    assert.ok(hog.steps[3].solution.includes(ip));
    assert.match(hog.steps[3].expected[0], /\/export\.csv$/);
  }
});

test("incident answers match real bash", () => {
  const failures = [];
  for (const scenario of SCENARIOS) {
    for (let seed = 1; seed <= 6; seed++) {
      const inc = buildIncident(scenario.id, seed * 101);
      const real = runBash(inc.files, inc.steps.map((s) => s.solution));
      inc.steps.forEach((step, i) => {
        if (JSON.stringify(normalizeSpaces(real[i])) !== JSON.stringify(normalizeSpaces(step.expected))) {
          failures.push(`${scenario.id}: ${step.solution}\n  bash: ${JSON.stringify(real[i])}\n  sim:  ${JSON.stringify(step.expected)}`);
        }
      });
    }
  }
  assert.deepEqual(failures, []);
});

test("readiness: a new player is missing skills; a strong one isn't", () => {
  const learner = newLearner();
  for (const scenario of SCENARIOS) {
    assert.deepEqual(missingSkills(learner, scenario.id), scenarioSkills(scenario.id));
  }
  grantPlacement(learner, SCENARIOS.flatMap((s) => scenarioSkills(s.id)));
  for (const scenario of SCENARIOS) assert.deepEqual(missingSkills(learner, scenario.id), []);
});

test("incident records are saved", () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const learner = newLearner();
  learner.incidents["break-in"] = { completed: 2, best: 450 };
  saveLearner(storage, learner);
  assert.deepEqual(loadLearner(storage).incidents, { "break-in": { completed: 2, best: 450 } });
});
