import { test } from "node:test";
import assert from "node:assert/strict";
import { SKILLS, SKILL_BY_ID, ancestors, detectSkills } from "../js/skills.js";
import { LEVELS } from "../js/game-data.js";

test("prerequisites exist and come earlier in the teaching order (so no cycles)", () => {
  SKILLS.forEach((skill, i) => {
    for (const parent of skill.requires) {
      assert.ok(SKILL_BY_ID[parent], `${skill.id} requires unknown ${parent}`);
      assert.ok(SKILLS.findIndex((s) => s.id === parent) < i, `${parent} should come before ${skill.id}`);
    }
  });
});

test("ancestors are transitive", () => {
  assert.deepEqual(new Set(ancestors("top-n")), new Set(["uniq-count", "sort-uniq", "columns", "pipes", "grep-basic", "head-tail", "wc"]));
  assert.deepEqual(ancestors("grep-basic"), []);
});

const cases = [
  ["grep ERROR app.log", ["grep-basic"]],
  ["grep -ic timeout app.log", ["grep-basic", "grep-i", "grep-count"]],
  ["grep -vn 200 access.log", ["grep-basic", "grep-v", "grep-n"]],
  ["grep -E 'ERROR|WARN' app.log", ["grep-basic", "grep-or"]],
  ["grep 'ERROR\\|WARN' app.log", ["grep-basic", "grep-or"]],
  ["grep -E 'ERR+' app.log", ["grep-basic", "regex-repeat"]],
  ["grep -A 2 -n x f", ["grep-basic", "grep-n"]],
  ["grep 404 access.log | wc -l", ["pipes", "grep-basic", "wc"]],
  ["head -5 app.log", ["head-tail"]],
  ["cut -d' ' -f2 access.log", ["columns"]],
  ["awk '{print $2}' access.log", ["columns"]],
  ["awk '$5 == 404' access.log", ["awk-filter"]],
  ["awk -F, '$3 == \"eng\" {print $2}' u.csv", ["columns", "awk-filter"]],
  ["awk '{print $3}' app.log | sort -u", ["pipes", "columns", "sort-uniq"]],
  ["awk '{print $3}' app.log | sort | uniq -c", ["pipes", "columns", "sort-uniq", "uniq-count"]],
  ["awk '{print $3}' app.log | uniq", ["pipes", "columns"]],
  ["x | sort | uniq -c | sort -rn | head -n 1", ["pipes", "sort-uniq", "uniq-count", "top-n", "head-tail"]],
  ["x | sort | uniq -c | sort -n | tail -n 1", ["pipes", "sort-uniq", "uniq-count", "top-n", "head-tail"]],
  ["grep -oE '[0-9]+ms' app.log", ["grep-basic", "grep-o", "regex-classes", "regex-repeat"]],
  ["grep '[0-9]*ms' app.log", ["grep-basic", "regex-classes", "regex-repeat"]],
  ["grep -E 'java:[0-9]{3}' error.log", ["grep-basic", "regex-classes", "regex-repeat"]],
  ["grep '^ ' error.log", ["grep-basic", "regex-anchors"]],
  ["grep 'connection$' app.log", ["grep-basic", "regex-anchors"]],
  ["grep '^[^ ]' error.log", ["grep-basic", "regex-anchors", "regex-classes"]],
  ["grep -wc at error.log", ["grep-basic", "grep-w", "grep-count"]],
  ["grep 10.0.0.5 access.log", ["grep-basic"]],
  ["grep 'unclosed", []],
];
for (const [command, expected] of cases) {
  test(`detectSkills: ${command}`, () => {
    assert.deepEqual(new Set(detectSkills(command)), new Set(expected));
  });
}

test("every course solution uses the skills it is tagged with", () => {
  for (const challenge of LEVELS.flatMap((level) => level.challenges)) {
    const used = detectSkills(challenge.solution);
    for (const skill of challenge.skills) {
      assert.ok(SKILL_BY_ID[skill], `unknown skill ${skill}`);
      assert.ok(used.includes(skill), `"${challenge.solution}" should use ${skill}`);
    }
  }
});
