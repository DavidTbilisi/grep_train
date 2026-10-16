import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serialize, parseProgress, cleanLearner, encodeCode, decodeCode, describeProgress, progressFileName, ImportError,
} from "../js/progress-io.js";
import { newLearner, recordResult, grantPlacement, DAY } from "../js/learner.js";

const NOW = 1_760_000_000_000;

function sampleLearner() {
  const learner = newLearner();
  recordResult(learner, ["grep-basic"], 1, NOW);
  grantPlacement(learner, ["uniq-count"], NOW);
  recordResult(learner, ["awk-sum"], 0.75, NOW + DAY);
  learner.course = { index: 4, solved: { 0: 100, 1: 75, 3: 25 } };
  learner.practice = { solved: 12, points: 950 };
  learner.mistakes = { "uniq-unsorted": 2, order: 1 };
  learner.placementDone = true;
  learner.incidents = { "break-in": { completed: 2, best: 450 } };
  return learner;
}

test("a file round-trips exactly", () => {
  const learner = sampleLearner();
  const text = serialize(learner, NOW);
  assert.equal(JSON.parse(text).app, "grep-master");
  assert.deepEqual(parseProgress(text), learner);
  assert.equal(progressFileName(NOW), "grep-master-progress-2025-10-09.json");
});

test("a code round-trips exactly, with or without compression", async () => {
  const learner = sampleLearner();
  const code = await encodeCode(learner, NOW);
  assert.match(code, /^GM1:[A-Za-z0-9_-]+$/);
  assert.ok(code.length < 1500, `code is ${code.length} characters`);
  assert.deepEqual(await decodeCode(code), learner);
  // Pasting often adds line breaks or spaces.
  assert.deepEqual(await decodeCode(`  ${code.slice(0, 50)}\n${code.slice(50)}  `), learner);

  const saved = globalThis.CompressionStream;
  globalThis.CompressionStream = undefined;
  try {
    const plain = await encodeCode(learner, NOW);
    assert.match(plain, /^GM1p:/);
    assert.deepEqual(await decodeCode(plain), learner);
  } finally {
    globalThis.CompressionStream = saved;
  }
});

test("bad input gets a friendly ImportError", async () => {
  const cases = [
    () => parseProgress("not json"),
    () => parseProgress("{}"),
    () => parseProgress(JSON.stringify({ app: "something-else", format: 1, learner: {} })),
    () => parseProgress(JSON.stringify({ app: "grep-master", format: 1 })),
  ];
  for (const fn of cases) assert.throws(fn, ImportError);
  assert.throws(() => parseProgress(JSON.stringify({ app: "grep-master", format: 2, learner: {} })), /newer version/);
  for (const code of ["", "hello", "GM1:!!!", "GM1:AAAAAAAAAAAAAAAAAAAA", "GM1p:e30"]) {
    await assert.rejects(() => decodeCode(code), ImportError, code);
  }
});

test("imported data is cleaned field by field", () => {
  const learner = cleanLearner({
    skills: {
      "grep-basic": { mastery: 7, attempts: -3, fails: 2.7, step: 99, due: "tomorrow", lastSeen: NOW },
      "grep-i": "nonsense",
      "not-a-skill": { mastery: 1, attempts: 5 },
    },
    course: { index: 9999, solved: { 0: 100, 1: 500, abc: 50, 2: "x" } },
    practice: { solved: "many", points: 1e12 },
    mistakes: { order: 3, "<script>": 1, bad: NaN },
    placementDone: "yes",
    incidents: { "break-in": { completed: 1, best: 300 }, "made-up": { completed: 5, best: 9 } },
    extra: "dropped",
  });
  assert.deepEqual(learner.skills, {
    "grep-basic": { mastery: 1, attempts: 0, fails: 2, step: 4, due: null, lastSeen: NOW },
  });
  assert.deepEqual(learner.course, { index: 1000, solved: { 0: 100, 1: 100 } });
  assert.deepEqual(learner.practice, { solved: 0, points: 1e9 });
  assert.deepEqual(learner.mistakes, { order: 3 });
  assert.equal(learner.placementDone, false);
  assert.deepEqual(learner.incidents, { "break-in": { completed: 1, best: 300 } });
  assert.equal("extra" in learner, false);
  assert.deepEqual(cleanLearner(null), newLearner());
});

test("describeProgress summarizes for the confirmation", () => {
  assert.equal(describeProgress(newLearner()), "0/22 skills mastered, 0 points");
  assert.equal(
    describeProgress(sampleLearner()),
    "7/22 skills mastered, 3 course challenges, 1 incident, 1150 points"
  );
});
