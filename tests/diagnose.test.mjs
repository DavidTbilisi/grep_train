import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOutput, diagnose } from "../js/diagnose.js";

test("checkOutput ignores spacing and a trailing file name after a count", () => {
  assert.ok(checkOutput(["14 access.log"], ["14"], ["access.log"], "wc -l access.log", "cat access.log | wc -l").correct);
  assert.ok(checkOutput(["      3 a"], ["3 a"], [], "x", "y").correct);
  assert.ok(!checkOutput(["14 other"], ["14"], ["access.log"], "x", "y").correct);
});

const cases = [
  // [name, got, want, command, solution, kind, skill]
  ["no output, case", [], ["a Timeout"], "grep timeout f", "grep -i timeout f", "empty", "grep-i"],
  ["no output", [], ["a"], "grep x f", "grep a f", "empty", null],
  ["lines instead of count", ["a", "b", "c"], ["3"], "grep E f", "grep -c E f", "lines-not-count", "grep-count"],
  ["count instead of lines", ["2"], ["a", "b"], "grep -c E f", "grep E f", "count-not-lines", null],
  ["wrong count, case", ["1"], ["2"], "grep -c timeout f", "grep -ic timeout f", "wrong-count", "grep-i"],
  ["wrong count, invert", ["3"], ["9"], "grep -c INFO f", "grep -vc INFO f", "wrong-count", "grep-v"],
  ["extra -n", ["4:a", "7:b"], ["a", "b"], "grep -n x f", "grep x f", "extra-line-numbers", "grep-n"],
  ["missing -n", ["a", "b"], ["4:a", "7:b"], "grep x f", "grep -n x f", "missing-line-numbers", "grep-n"],
  ["extra counts", ["2 a", "1 b"], ["a", "b"], "sort | uniq -c", "sort | uniq", "extra-counts", "uniq-count"],
  ["missing counts", ["a", "b"], ["2 a", "1 b"], "sort | uniq", "sort | uniq -c", "missing-counts", "uniq-count"],
  ["wrong order", ["b", "a"], ["a", "b"], "x", "x | sort", "order", "sort-uniq"],
  ["ascending instead of descending", ["1 b", "3 a"], ["3 a", "1 b"], "x | sort -n", "x | sort -rn", "order", "top-n"],
  ["uniq without sort", ["a", "b", "a"], ["a", "b"], "awk '{print $2}' f | uniq", "awk '{print $2}' f | sort | uniq", "uniq-unsorted", "sort-uniq"],
  ["duplicates", ["a", "b", "a"], ["a", "b"], "awk '{print $2}' f", "awk '{print $2}' f | sort -u", "duplicates", "sort-uniq"],
  ["inverted", ["x DEBUG"], ["y INFO", "z WARN"], "grep DEBUG f", "grep -v DEBUG f", "inverted", "grep-v"],
  ["too many", ["a", "b", "c"], ["a", "c"], "grep x f", "grep y f", "too-many", null],
  ["too few, case", ["a timeout"], ["a timeout", "b Timeout"], "grep timeout f", "grep -i timeout f", "too-few", "grep-i"],
  ["too few, either pattern", ["a ERROR"], ["a ERROR", "b WARN"], "grep ERROR f", "grep -E 'ERROR|WARN' f", "too-few", "grep-or"],
  ["whole lines", ["10:01 1.2.3.4 GET", "10:02 5.6.7.8 GET"], ["1.2.3.4", "5.6.7.8"], "grep GET f", "awk '{print $2}' f", "whole-lines", "columns"],
  ["wrong column", ["GET", "POST"], ["1.2.3.4", "5.6.7.8"], "awk '{print $3}' f", "awk '{print $2}' f", "wrong-column", "columns"],
  ["other", ["q", "r", "s"], ["a", "b"], "x", "y", "mismatch", null],
];
for (const [name, got, want, command, solution, kind, skill] of cases) {
  test(`diagnose: ${name}`, () => {
    const d = diagnose(got, want, command, solution);
    assert.equal(d.kind, kind);
    assert.equal(d.skill, skill);
    assert.ok(d.message.length > 10);
  });
}
