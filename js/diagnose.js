// Diagnose - checks an answer and, when it's wrong, explains the likely
// mistake and which skill it points at. Pure (no DOM).

import { detectSkills } from "./skills.js";

// Compare outputs loosely: ignore extra spaces, and treat "14 access.log"
// (from wc -l FILE) the same as "14" (from cat FILE | wc -l).
function normalize(lines, fileNames) {
  return lines.map((line) => {
    const clean = line.trim().replace(/\s+/g, " ");
    const m = clean.match(/^(\d+) (\S+)$/);
    return m && fileNames.includes(m[2]) ? m[1] : clean;
  });
}

const same = (a, b) => a.length === b.length && a.every((line, i) => line === b[i]);
const sorted = (lines) => [...lines].sort();
const isCount = (lines) => lines.length === 1 && /^\d+$/.test(lines[0]);
const stripLineNumbers = (lines) => lines.map((line) => line.replace(/^\d+[:-]/, ""));
const stripCounts = (lines) => lines.map((line) => line.replace(/^\d+ /, ""));
const isNumericDesc = (lines) => {
  const n = lines.map((line) => parseFloat(line));
  return n.every((x) => !isNaN(x)) && n.every((x, i) => i === 0 || n[i - 1] >= x) && n[0] !== n[n.length - 1];
};

/**
 * Explain why `got` isn't `want`. Both are normalized output lines.
 * `command` is what the player ran, `solution` the model answer.
 * @returns {{ kind: string, message: string, skill: string | null }}
 */
function diagnose(got, want, command, solution) {
  const used = new Set(detectSkills(command));
  const needed = new Set(detectSkills(solution));
  const forgot = (skill) => needed.has(skill) && !used.has(skill);
  const result = (kind, message, skill = null) => ({ kind, message, skill });
  const caseTip = forgot("grep-i") ? " grep is case-sensitive: -i ignores case." : "";

  if (got.length === 0) {
    return result("empty", `No output at all. Check the spelling and case of your pattern.${caseTip}`, caseTip ? "grep-i" : null);
  }

  if (isCount(want) && !isCount(got)) {
    if (got.length === Number(want[0])) {
      return result("lines-not-count", `You found the right ${got.length} lines, but the task wants the number. Use grep -c or pipe into wc -l.`, "grep-count");
    }
    return result("lines-not-count", "The task wants a single number. Count with grep -c or | wc -l.", "grep-count");
  }
  if (isCount(got) && !isCount(want)) {
    return result("count-not-lines", `That's a count (${got[0]}), but the task wants the lines themselves.`);
  }
  if (isCount(got) && isCount(want)) {
    if (forgot("grep-i")) return result("wrong-count", `Your count is ${got[0]}: not quite.${caseTip}`, "grep-i");
    if (forgot("grep-v")) return result("wrong-count", `Your count is ${got[0]}: not quite. Should you count the lines that DON'T match (-v)?`, "grep-v");
    return result("wrong-count", `Your count is ${got[0]}: not quite. Check what exactly you're counting.`);
  }

  if (same(stripLineNumbers(got), want) && !same(got, want)) {
    return result("extra-line-numbers", "Right lines, but the task doesn't want line numbers. Drop -n.", "grep-n");
  }
  if (same(got, stripLineNumbers(want))) {
    return result("missing-line-numbers", "Right lines! Now show their line numbers with -n.", "grep-n");
  }
  if (same(stripCounts(got), want) && !same(got, want)) {
    return result("extra-counts", "Right values, but without the counts in front. Drop the -c.", "uniq-count");
  }
  if (same(got, stripCounts(want))) {
    return result("missing-counts", "Right values! Now count each one: sort | uniq -c.", "uniq-count");
  }

  if (same(sorted(got), sorted(want))) {
    if (isNumericDesc(want)) return result("order", "Right lines, wrong order: biggest first is sort -rn.", "top-n");
    return result("order", "Right lines, wrong order. Try sorting them.", "sort-uniq");
  }

  const gotSet = new Set(got);
  const wantSet = new Set(want);
  const sameSet = gotSet.size === wantSet.size && [...gotSet].every((line) => wantSet.has(line));
  if (sameSet && got.length > want.length) {
    if (used.has("sort-uniq") || /\buniq\b/.test(command)) {
      return result("uniq-unsorted", "There are still repeats: uniq only removes repeated lines that are next to each other. sort first, then uniq.", "sort-uniq");
    }
    return result("duplicates", "Right values, but some appear more than once. sort | uniq keeps one of each.", "sort-uniq");
  }

  const overlap = got.filter((line) => wantSet.has(line)).length;
  if (overlap === 0 && (forgot("grep-v") || (used.has("grep-v") && !needed.has("grep-v")))) {
    return result("inverted", "You got exactly the opposite lines. -v flips a match, so add it or remove it.", "grep-v");
  }
  if (overlap === want.length && got.length > want.length) {
    const extra = `You have all ${want.length} right line(s) plus ${got.length - want.length} extra.`;
    if (forgot("grep-w")) return result("too-many", `${extra} -w matches whole words only, not text inside longer words.`, "grep-w");
    if (forgot("regex-anchors")) return result("too-many", `${extra} Anchor the pattern: ^ matches the start of a line, $ the end.`, "regex-anchors");
    return result("too-many", `${extra} Make your filter stricter.`);
  }
  if (overlap === got.length && got.length < want.length) {
    const missing = want.length - got.length;
    if (forgot("grep-i")) return result("too-few", `You're missing ${missing} line(s).${caseTip}`, "grep-i");
    if (forgot("grep-or")) return result("too-few", `You're missing ${missing} line(s). To match either of two patterns: grep -E 'A|B'.`, "grep-or");
    return result("too-few", `You're missing ${missing} line(s). Your filter is too strict.`);
  }

  if (got.length === want.length) {
    if (got.every((line, i) => line !== want[i] && line.includes(want[i]))) {
      if (forgot("grep-o")) return result("whole-lines", "Your lines contain the answer, plus extra text. -o prints only the part that matched.", "grep-o");
      return result("whole-lines", "Your lines contain the answer, plus extra text. Print only the column(s) you need.", "columns");
    }
    if (got.every((line, i) => !line.includes(" ") && !want[i].includes(" "))) {
      return result("wrong-column", "Looks like the wrong column. Columns are counted from 1, split on spaces.", "columns");
    }
    return result("mismatch", "Right number of lines, but some don't match. Compare with the expected output.");
  }
  return result("mismatch", `Not quite: expected ${want.length} line(s), got ${got.length}.`);
}

/**
 * Check a command's output against the expected output.
 * @returns {{ correct: true } | { correct: false, diagnosis }}
 */
function checkOutput(output, expected, fileNames, command, solution) {
  const got = normalize(output, fileNames);
  const want = normalize(expected, fileNames);
  if (same(got, want)) return { correct: true };
  return { correct: false, diagnosis: diagnose(got, want, command, solution) };
}

// Short labels for the skill map's "common mistakes" list.
const MISTAKE_LABELS = {
  empty: "No output (pattern spelling or case)",
  "lines-not-count": "Printed lines instead of a count",
  "count-not-lines": "Printed a count instead of lines",
  "wrong-count": "Counted the wrong thing",
  "extra-line-numbers": "Added -n when not needed",
  "missing-line-numbers": "Forgot -n",
  "extra-counts": "Added counts when not needed",
  "missing-counts": "Forgot uniq -c",
  order: "Right lines, wrong order",
  "uniq-unsorted": "uniq without sort first",
  duplicates: "Left duplicates in",
  inverted: "Inverted match (-v) the wrong way",
  "too-many": "Filter too loose",
  "too-few": "Filter too strict",
  "whole-lines": "Printed whole lines instead of a column",
  "wrong-column": "Picked the wrong column",
  mismatch: "Other",
};

export { normalize, diagnose, checkOutput, MISTAKE_LABELS };
