import { test } from "node:test";
import assert from "node:assert/strict";
import { MUTATIONS, mutants, makeFix, makePredict, generateVariant } from "../js/variants.js";
import { generateChallenge, makeRng } from "../js/generator.js";
import { normalize } from "../js/diagnose.js";
import { runCommandLine } from "../js/shell.js";
import { SKILLS, SKILL_BY_ID } from "../js/skills.js";
import { runBash, normalizeSpaces } from "./bash.mjs";

const apply = (kind, cmd) => MUTATIONS.filter((m) => m.kind === kind).map((m) => m.apply(cmd)).filter(Boolean);

test("mutations make the intended mistakes", () => {
  assert.deepEqual(apply("uniq-unsorted", "awk '{print $2}' f | sort | uniq -c"), ["awk '{print $2}' f | uniq -c"]);
  assert.deepEqual(apply("missing-counts", "x | sort | uniq -c"), ["x | sort | uniq"]);
  assert.deepEqual(apply("order", "x | sort -rn | head -n 1"), ["x | sort -n | head -n 1"]);
  assert.deepEqual(apply("order", "sort -k6 -rn f | head -n 1"), ["sort -k6 -n f | head -n 1"]);
  assert.deepEqual(apply("too-few", "grep -ic timeout f"), ["grep -c timeout f"]);
  assert.deepEqual(apply("inverted", "grep -vn 200 f"), ["grep -n 200 f", null].filter(Boolean));
  assert.deepEqual(apply("inverted", "grep ERROR f"), ["grep -v ERROR f"]);
  assert.deepEqual(apply("empty", "grep -cE 'A|B' f"), ["grep -c 'A|B' f"]);
  assert.deepEqual(apply("wrong-column", "awk '$5 == 404 {print $4}' f"), ["awk '$5 == 404 {print $5}' f"]);
  assert.deepEqual(apply("comparison", "awk '$6 > 900 {print $4}' f"), ["awk '$6 < 900 {print $4}' f"]);
  assert.deepEqual(apply("quoting", "grep 'POST /login' f"), ["grep POST /login f"]);
  assert.deepEqual(apply("quoting", "grep -E 'A|B' f"), []);
  assert.deepEqual(apply("wc-per-file", "cat a b | wc -l"), ["wc -l a b"]);
  assert.deepEqual(apply("empty", "grep -oE '[0-9]+ms' f"), ["grep -o '[0-9]+ms' f"]);
  assert.deepEqual(apply("too-few", "grep -E 'java:[0-9]{3}' f"), ["grep -E 'java:[0-9]{4}' f"]);
  assert.deepEqual(apply("whole-lines", "grep -oE '[0-9]+ms' f"), ["grep -E '[0-9]+ms' f"]);
  assert.deepEqual(apply("too-many", "grep -c '^ ' f"), ["grep -c ' ' f"]);
  assert.deepEqual(apply("too-many", "grep 'lost$' f"), ["grep 'lost' f"]);
  assert.deepEqual(apply("too-many", "grep -wc at f"), ["grep -c at f"]);
  assert.deepEqual(apply("class", "grep 'User [a-c]' f"), ["grep 'User [^a-c]' f"]);
  assert.deepEqual(apply("class", "grep '^[^ ]' f"), ["grep '^[^ ]' f"].slice(1)); // already negated
  for (const m of MUTATIONS) assert.ok(SKILL_BY_ID[m.skill], m.kind);
});

test("mutants only keep mistakes that change the result", () => {
  for (const skill of SKILLS) {
    for (let seed = 1; seed <= 20; seed++) {
      const c = generateChallenge(skill.id, 2, seed);
      const want = normalize(c.expected, Object.keys(c.files)).join("\n");
      for (const { command, result } of mutants(c)) {
        assert.notEqual(command, c.solution);
        if (!result.error) assert.notEqual(normalize(result.output, Object.keys(c.files)).join("\n"), want, command);
      }
    }
  }
});

test("fix challenges start from a broken command and keep the real solution", () => {
  for (const skill of SKILLS) {
    for (const d of [1, 2, 3]) {
      for (let seed = 1; seed <= 15; seed++) {
        const v = generateVariant(skill.id, d, "fix", seed);
        if (v.kind !== "fix") continue;
        assert.notEqual(v.broken, v.solution);
        assert.ok(v.bug.length > 10);
        const broken = runCommandLine(v.broken, v.files);
        const names = Object.keys(v.files);
        assert.ok(broken.error || normalize(broken.output, names).join("\n") !== normalize(v.expected, names).join("\n"));
      }
    }
  }
});

test("fix prefers the player's common mistakes", () => {
  const c = generateChallenge("uniq-count", 1, 1);
  const fix = makeFix(c, makeRng(1), ["uniq-unsorted"]);
  assert.equal(fix.bugKind, "uniq-unsorted");
  assert.equal(makeFix(c, makeRng(1), ["missing-counts"]).bugKind, "missing-counts");
});

test("predict challenges have one right answer among distinct choices", () => {
  for (const skill of SKILLS) {
    for (const d of [1, 2, 3]) {
      for (let seed = 1; seed <= 15; seed++) {
        const v = generateVariant(skill.id, d, "predict", seed);
        if (v.kind !== "predict") continue;
        const names = Object.keys(v.files);
        const keys = v.choices.map((ch) => normalize(ch.output, names).join("\n"));
        assert.ok(v.choices.length >= 3 && v.choices.length <= 4);
        assert.equal(new Set(keys).size, keys.length, "choices must differ");
        assert.equal(v.choices.filter((ch) => ch.correct).length, 1);
        assert.deepEqual(v.choices.find((ch) => ch.correct).output, v.expected);
        assert.ok(v.choices.every((ch) => ch.correct || ch.why.length > 5));
      }
    }
  }
});

test("every skill can be practised as fix and predict at some difficulty", () => {
  for (const skill of SKILLS) {
    for (const kind of ["fix", "predict"]) {
      const found = [1, 2, 3].some((d) => generateVariant(skill.id, d, kind, 1).kind === kind);
      assert.ok(found, `${skill.id} has no ${kind} variant`);
    }
  }
});

test("variants fall back to write when nothing fits, and are reproducible", () => {
  const c = generateVariant("columns", 1, "predict", 1); // column output is too long to predict
  assert.equal(c.kind, "write");
  assert.deepEqual(generateVariant("top-n", 2, "predict", 9), generateVariant("top-n", 2, "predict", 9));
  assert.equal(makePredict({ ...c, expected: Array(20).fill("x") }, makeRng(1)), null);
});

test("wrong choices are what the mistaken commands really print (vs bash)", () => {
  const failures = [];
  for (const skill of SKILLS) {
    for (const d of [1, 2, 3]) {
      const v = generateVariant(skill.id, d, "fix", d * 31);
      const commands = mutants(v).filter((m) => !m.result.error);
      const real = runBash(v.files, commands.map((m) => m.command));
      commands.forEach((m, i) => {
        if (JSON.stringify(normalizeSpaces(real[i])) !== JSON.stringify(normalizeSpaces(m.result.output))) {
          failures.push(`${m.command}\n  bash: ${JSON.stringify(real[i])}\n  sim:  ${JSON.stringify(m.result.output)}`);
        }
      });
    }
  }
  assert.deepEqual(failures, []);
});
