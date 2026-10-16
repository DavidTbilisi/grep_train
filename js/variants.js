// Variants - turn a generated challenge into a "fix the command" or a
// "predict the output" challenge. Pure (no DOM).
//
// Both are built from mutations: small, realistic mistakes applied to the
// solution (uniq without sort, a missing -i, the wrong column, ...).
//   fix:      the player gets a mutated command that prints the wrong thing
//             and has to repair it
//   predict:  the player sees the real command and picks what it prints;
//             the wrong choices are what the mutated commands print

import { runCommandLine } from "./shell.js";
import { normalize } from "./diagnose.js";
import { generateChallenge, makeRng } from "./generator.js";

const MAX_PREDICT_LINES = 8;

// Rewrite the option letters of the first grep, e.g. "grep -ic x" -> "grep -c x".
// `edit` maps the letters ("ic") to new letters, or null for no change.
function editGrepFlags(cmd, edit) {
  const m = cmd.match(/\bgrep((?: -[A-Za-z]+)*) /);
  if (!m) return null;
  const letters = m[1].replace(/ -/g, "");
  const next = edit(letters);
  if (next === null || next === letters) return null;
  return cmd.replace(m[0], `grep${next ? ` -${next}` : ""} `);
}

const dropFlag = (flag) => (cmd) => editGrepFlags(cmd, (l) => (l.includes(flag) ? l.replace(flag, "") : null));
const addFlag = (flag) => (cmd) => editGrepFlags(cmd, (l) => (l.includes(flag) ? null : flag + l));
const replace = (pattern, replacement) => (cmd) => {
  const next = cmd.replace(pattern, replacement);
  return next === cmd ? null : next;
};

const FLIPPED = { "==": "!=", "!=": "==", ">": "<", "<": ">", ">=": "<", "<=": ">" };

// kind matches a diagnose.js kind where one fits, so a player's common
// mistakes can be turned into fix-the-bug challenges.
const MUTATIONS = [
  {
    kind: "uniq-unsorted",
    skill: "sort-uniq",
    apply: replace(/ \| sort \| uniq/, " | uniq"),
    explain: "uniq only removes repeats that are next to each other, so it needs sort in front of it.",
  },
  {
    kind: "duplicates",
    skill: "sort-uniq",
    apply: replace(/ \| sort \| uniq$/, " | sort"),
    explain: "sort puts repeats next to each other, but it takes uniq to remove them.",
  },
  {
    kind: "missing-counts",
    skill: "uniq-count",
    apply: replace(/uniq -c/, "uniq"),
    explain: "Without -c, uniq lists each value once but doesn't count them.",
  },
  {
    kind: "order",
    skill: "top-n",
    apply: replace(/sort (-k\d+ )?-rn/, "sort $1-n"),
    explain: "sort -n puts the smallest numbers first. Adding -r reverses that, so the biggest comes first.",
  },
  {
    kind: "head-tail",
    skill: "head-tail",
    apply: (cmd) => {
      const m = cmd.match(/\b(head|tail) -n/);
      return m ? cmd.replace(m[0], `${m[1] === "head" ? "tail" : "head"} -n`) : null;
    },
    explain: "head takes lines from the top of its input, tail from the bottom.",
  },
  {
    kind: "too-many",
    skill: "head-tail",
    apply: replace(/ \| (head|tail) -n \d+$/, ""),
    explain: "Without the final head or tail, you get the whole list instead of just a few lines.",
  },
  {
    kind: "too-few",
    skill: "grep-i",
    apply: dropFlag("i"),
    explain: "Without -i, grep is case-sensitive, so it misses lines where the word is capitalized differently.",
  },
  {
    kind: "inverted",
    skill: "grep-v",
    apply: dropFlag("v"),
    explain: "Without -v, grep prints the lines that match instead of the ones that don't.",
  },
  {
    kind: "inverted",
    skill: "grep-v",
    apply: addFlag("v"),
    explain: "-v flips the match: it prints the lines that DON'T contain the pattern.",
  },
  {
    kind: "lines-not-count",
    skill: "grep-count",
    apply: dropFlag("c"),
    explain: "Without -c, grep prints the matching lines instead of counting them.",
  },
  {
    kind: "missing-line-numbers",
    skill: "grep-n",
    apply: dropFlag("n"),
    explain: "Without -n, grep doesn't show line numbers.",
  },
  {
    kind: "empty",
    skill: "grep-or",
    apply: (cmd) => (/'[^']*\|[^']*'/.test(cmd) ? dropFlag("E")(cmd) : null),
    explain: "Without -E, | is an ordinary character, so grep looks for a literal | in each line.",
  },
  {
    kind: "empty",
    skill: "regex-repeat",
    apply: (cmd) => (/'[^']*[+{][^']*'/.test(cmd) ? dropFlag("E")(cmd) : null),
    explain: "Without -E, + and {n} are ordinary characters, so grep looks for them literally.",
  },
  {
    kind: "too-few",
    skill: "regex-repeat",
    apply: replace(/\{(\d)\}/, (m, n) => `{${Number(n) + 1}}`),
    explain: "{n} means exactly n of the thing before it, so the count matters.",
  },
  {
    kind: "whole-lines",
    skill: "grep-o",
    apply: dropFlag("o"),
    explain: "Without -o, grep prints the whole matching line, not just the part that matched.",
  },
  {
    kind: "too-many",
    skill: "grep-w",
    apply: dropFlag("w"),
    explain: "Without -w, the pattern also matches inside longer words.",
  },
  {
    kind: "too-many",
    skill: "regex-anchors",
    apply: replace(/'\^/, "'"),
    explain: "Without ^, the pattern can match anywhere in the line, not just at the start.",
  },
  {
    kind: "too-many",
    skill: "regex-anchors",
    apply: replace(/\$'/, "'"),
    explain: "Without $, the pattern can match anywhere in the line, not just at the end.",
  },
  {
    kind: "class",
    skill: "regex-classes",
    apply: replace(/\[(?!\^)([^\]]+)\]/, "[^$1]"),
    explain: "[^...] means any character EXCEPT the ones listed, the opposite of [...].",
  },
  {
    kind: "lines-not-count",
    skill: "pipes",
    apply: replace(/ \| wc -l$/, ""),
    explain: "Without | wc -l you get the lines themselves, not how many there are.",
  },
  {
    kind: "wc-flag",
    skill: "wc",
    apply: replace(/\bwc -l\b/, "wc -w"),
    explain: "wc -w counts words. Lines are -l.",
  },
  {
    kind: "wc-per-file",
    skill: "wc",
    apply: replace(/^cat (\S+) (\S+) \| wc -l$/, "wc -l $1 $2"),
    explain: "wc -l with two files counts each file separately and adds a total line.",
  },
  {
    kind: "wrong-column",
    skill: "columns",
    apply: (cmd) => {
      const m = cmd.match(/print \$(\d)/);
      if (!m) return null;
      const n = Number(m[1]);
      return cmd.replace(m[0], `print $${n < 6 ? n + 1 : n - 1}`);
    },
    explain: "That's the wrong column. Columns are counted from 1, split on spaces.",
  },
  {
    kind: "comparison",
    skill: "awk-filter",
    apply: (cmd) => {
      const m = cmd.match(/(\$\d+) (==|!=|>=|<=|>|<) /);
      return m ? cmd.replace(m[0], `${m[1]} ${FLIPPED[m[2]]} `) : null;
    },
    explain: "The comparison is the wrong way round: == is equal, != not equal, > bigger, < smaller.",
  },
  {
    kind: "running-total",
    skill: "awk-sum",
    apply: replace(/\} END \{/, "; "),
    explain: "Without END, the print runs on every line, so you get a running total instead of one final number.",
  },
  {
    kind: "assign-not-add",
    skill: "awk-sum",
    apply: replace(/ \+= /, " = "),
    explain: "= replaces the value on every line; += adds to it.",
  },
  {
    kind: "wrong-column",
    skill: "awk-sum",
    apply: (cmd) => {
      const m = cmd.match(/\+= \$(\d)/);
      return m ? cmd.replace(m[0], `+= $${m[1] === "6" ? 5 : Number(m[1]) + 1}`) : null;
    },
    explain: "That adds up the wrong column. Columns are counted from 1, split on spaces.",
  },
  {
    kind: "nr-not-count",
    skill: "awk-stats",
    apply: replace(/\/n(?=[)}\s])/, "/NR"),
    explain: "NR counts every line read, not just the ones that matched, so the average comes out too small.",
  },
  {
    kind: "quoting",
    skill: "grep-basic",
    apply: replace(/\bgrep ((?:-[A-Za-z]+ )?)'([^'|{]+ [^'|{]+)'/, "grep $1$2"),
    explain: "Without quotes, the shell splits the pattern at the space, so grep searches for the first word in a file named after the second.",
  },
];

/**
 * The challenge's solution with each applicable mistake, and what it prints.
 * Only mutations that really change the result are kept.
 */
function mutants(challenge) {
  const names = Object.keys(challenge.files);
  const want = normalize(challenge.expected, names).join("\n");
  return MUTATIONS.flatMap((mutation) => {
    const command = mutation.apply(challenge.solution);
    if (!command || command === challenge.solution) return [];
    const result = runCommandLine(command, challenge.files);
    if (!result.error && normalize(result.output, names).join("\n") === want) return [];
    return [{ mutation, command, result }];
  });
}

/**
 * Fix-the-command: prefer mistakes the player makes often, then mistakes
 * about the challenge's own skills.
 */
function makeFix(challenge, r, preferKinds = []) {
  const options = mutants(challenge);
  if (!options.length) return null;
  const rank = ({ mutation }) =>
    (preferKinds.includes(mutation.kind) ? 0 : 2) + (challenge.skills.includes(mutation.skill) ? 0 : 1);
  const best = Math.min(...options.map(rank));
  const { mutation, command } = r.pick(options.filter((o) => rank(o) === best));
  return { ...challenge, kind: "fix", broken: command, bug: mutation.explain, bugKind: mutation.kind };
}

// Plausible wrong answers when there aren't enough mutations.
function genericWrongs(expected) {
  if (expected.length === 1 && /^\d+$/.test(expected[0].trim())) {
    const n = Number(expected[0].trim());
    return [n + 1, n - 1, n + 2]
      .filter((x) => x >= 0)
      .map((x) => ({ output: [String(x)], why: "Close, but count the matching lines again." }));
  }
  if (expected.length < 2) return [];
  return [
    { output: [...expected].reverse(), why: "Right lines, wrong order." },
    { output: expected.slice(0, -1), why: "One line short." },
    { output: expected.slice(1), why: "One line short." },
  ];
}

/** Predict-the-output: 3 or 4 choices, exactly one of them right. */
function makePredict(challenge, r) {
  if (challenge.expected.length > MAX_PREDICT_LINES) return null;
  const names = Object.keys(challenge.files);
  const key = (lines) => normalize(lines, names).join("\n");
  const seen = new Set([key(challenge.expected)]);
  const wrongs = [];
  const add = (output, why) => {
    if (wrongs.length >= 3 || !output.length || output.length > MAX_PREDICT_LINES || seen.has(key(output))) return;
    seen.add(key(output));
    wrongs.push({ output, correct: false, why });
  };

  for (const { mutation, command, result } of r.shuffle(mutants(challenge))) {
    if (!result.error) add(result.output, `That's what ${command} prints. ${mutation.explain}`);
  }
  for (const wrong of genericWrongs(challenge.expected)) add(wrong.output, wrong.why);
  if (wrongs.length < 2) return null;

  const choices = r.shuffle([{ output: challenge.expected, correct: true, why: "" }, ...wrongs]);
  return { ...challenge, kind: "predict", choices };
}

/**
 * A practice challenge of the given kind ("write", "fix", or "predict").
 * Falls back to a plain write challenge if no variant fits.
 */
function generateVariant(skill, difficulty, kind, seed, preferKinds = []) {
  if (kind !== "write") {
    for (let i = 0; i < 20; i++) {
      const s = (seed + i * 7919) >>> 0;
      const challenge = generateChallenge(skill, difficulty, s);
      const r = makeRng(s ^ 0x9e3779b9);
      const variant = kind === "fix" ? makeFix(challenge, r, preferKinds) : makePredict(challenge, r);
      if (variant) return variant;
    }
  }
  return { ...generateChallenge(skill, difficulty, seed), kind: "write" };
}

export { MUTATIONS, mutants, makeFix, makePredict, generateVariant };
