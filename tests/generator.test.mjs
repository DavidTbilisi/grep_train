import { test } from "node:test";
import assert from "node:assert/strict";
import { generateChallenge, generateFromTemplate, generatePlacement, PLACEMENT_STEPS, TEMPLATES } from "../js/generator.js";
import { SKILLS, detectSkills } from "../js/skills.js";
import { runBash, normalizeSpaces } from "./bash.mjs";

const DIFFICULTIES = [1, 2, 3];

test("every skill has templates at every difficulty", () => {
  for (const skill of SKILLS) {
    for (const d of DIFFICULTIES) {
      assert.ok(TEMPLATES.some((t) => t.skills[0] === skill.id && t.difficulty === d), `${skill.id} d${d}`);
    }
  }
});

test("same seed, same challenge", () => {
  assert.deepEqual(generateChallenge("top-n", 2, 42), generateChallenge("top-n", 2, 42));
  assert.notDeepEqual(generateChallenge("top-n", 2, 42), generateChallenge("top-n", 2, 43));
});

test("generated challenges are well-formed and use their skills", () => {
  for (const skill of SKILLS) {
    for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 60; seed++) {
        const c = generateChallenge(skill.id, d, seed);
        const label = `${skill.id} d${d} seed ${seed}: ${c.solution}`;
        assert.equal(c.skill, skill.id);
        assert.equal(c.hints.length, 3, label);
        assert.equal(c.hints[2], c.solution, label);
        assert.ok(c.expected.length > 0 && c.expected.length <= 25, label);
        assert.ok(!c.solution.includes("undefined"), label);
        assert.ok(Object.keys(c.files).length > 0, label);
        const used = detectSkills(c.solution);
        for (const s of c.skills) assert.ok(used.includes(s), `${label} should use ${s}`);
      }
    }
  }
});

test("placement questions are well-formed and use their skills", () => {
  for (let step = 0; step < PLACEMENT_STEPS; step++) {
    for (let seed = 1; seed <= 30; seed++) {
      const c = generatePlacement(step, seed);
      assert.deepEqual(c.hints, []);
      assert.ok(c.expected.length > 0);
      const used = detectSkills(c.solution);
      for (const s of c.skills) assert.ok(used.includes(s), `${c.solution} should use ${s}`);
    }
  }
});

test("every template works, uses its skills, and avoids repeats", () => {
  for (const template of TEMPLATES) {
    for (let seed = 1; seed <= 25; seed++) {
      const c = generateFromTemplate(template.id, seed);
      const label = `template ${template.id} (${template.skills[0]} d${template.difficulty}) seed ${seed}: ${c.solution}`;
      assert.equal(c.template, template.id);
      assert.equal(c.hints[2], c.solution, label);
      const used = detectSkills(c.solution);
      for (const s of template.skills) assert.ok(used.includes(s), `${label} should use ${s}`);
    }
  }
  // Avoiding the last two templates cycles through all three of a level.
  for (const skill of SKILLS) {
    for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 10; seed++) {
        const used = [];
        for (let i = 0; i < 3; i++) used.push(generateChallenge(skill.id, d, seed * 31 + i, used.slice(-2)).template);
        assert.equal(new Set(used).size, 3, `${skill.id} d${d}: ${used}`);
      }
    }
  }
});

test("generated expected output matches real bash", () => {
  const challenges = [];
  for (const template of TEMPLATES) {
    for (let seed = 1; seed <= 3; seed++) challenges.push(generateFromTemplate(template.id, seed * 7919));
  }
  for (let step = 0; step < PLACEMENT_STEPS; step++) challenges.push(generatePlacement(step, step + 1));

  const failures = [];
  for (const c of challenges) {
    const [real] = runBash(c.files, [c.solution]);
    if (JSON.stringify(normalizeSpaces(real)) !== JSON.stringify(normalizeSpaces(c.expected))) {
      failures.push(`${c.solution} (seed ${c.seed})\n  bash: ${JSON.stringify(real)}\n  sim:  ${JSON.stringify(c.expected)}`);
    }
  }
  assert.deepEqual(failures, []);
});
