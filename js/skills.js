// Skills - what a learner can master, what each skill builds on, and how to
// tell from a command line which skills it uses. Pure (no DOM).
//
// The array order is the teaching order: the skill map lists skills in this
// order and the scheduler uses it to break ties.

import { splitPipeline } from "./shell.js";

const SKILLS = [
  {
    id: "grep-basic",
    name: "grep basics",
    requires: [],
    learn: "grep PATTERN FILE prints only the lines of FILE that contain PATTERN.",
  },
  {
    id: "grep-i",
    name: "Ignore case (grep -i)",
    requires: ["grep-basic"],
    learn: "grep is case-sensitive. The -i option makes it ignore case.",
  },
  {
    id: "grep-v",
    name: "Invert match (grep -v)",
    requires: ["grep-basic"],
    learn: "-v inverts the match: grep prints the lines that do NOT contain the pattern.",
  },
  {
    id: "grep-count",
    name: "Count matches (grep -c)",
    requires: ["grep-basic"],
    learn: "-c prints how many lines match instead of the lines themselves.",
  },
  {
    id: "grep-n",
    name: "Line numbers (grep -n)",
    requires: ["grep-basic"],
    learn: "-n puts the line number in front of each match, like 4:...",
  },
  {
    id: "grep-or",
    name: "Either pattern (grep -E 'A|B')",
    requires: ["grep-basic"],
    learn: "With -E, A|B matches A or B. Quote the pattern so the shell leaves the | alone.",
  },
  {
    id: "head-tail",
    name: "First and last lines (head, tail)",
    requires: [],
    learn: "head -n N prints the first N lines, tail -n N the last N. New log entries are at the bottom.",
  },
  {
    id: "wc",
    name: "Count lines (wc -l)",
    requires: [],
    learn: "wc -l counts lines. Fed from a pipe, it prints just the number.",
  },
  {
    id: "pipes",
    name: "Pipes (|)",
    requires: ["grep-basic", "head-tail", "wc"],
    learn: "A pipe sends the output of one command into the next: cmd1 | cmd2.",
  },
  {
    id: "columns",
    name: "Columns (awk, cut)",
    requires: ["grep-basic"],
    learn: "awk '{print $2}' prints the 2nd whitespace-separated column. cut -d' ' -f2 does the same.",
  },
  {
    id: "sort-uniq",
    name: "Distinct values (sort | uniq)",
    requires: ["columns", "pipes"],
    learn: "uniq only drops repeated neighbouring lines, so always sort first: sort | uniq.",
  },
  {
    id: "uniq-count",
    name: "Count each value (uniq -c)",
    requires: ["sort-uniq"],
    learn: "sort | uniq -c puts a count in front of each distinct line: a quick histogram.",
  },
  {
    id: "awk-filter",
    name: "Filter by column (awk)",
    requires: ["columns"],
    learn: "awk '$5 == 404 {print $4}' prints column 4 of the lines whose column 5 is 404.",
  },
  {
    id: "top-n",
    name: "Top-N reports (sort -rn | head)",
    requires: ["uniq-count"],
    learn: "sort -rn puts the biggest numbers first. Add head -n N to keep the top N.",
  },

  // awk totals track
  {
    id: "awk-sum",
    name: "Totals (awk sum + END)",
    requires: ["columns"],
    learn: "awk '{s += $6} END {print s}' adds up column 6 on every line, then prints the total once, at the END.",
  },
  {
    id: "awk-stats",
    name: "Averages and maximums (awk)",
    requires: ["awk-sum", "awk-filter"],
    learn: "An average is a total divided by a count: END {print s/NR}. For a maximum, keep the biggest: $6 > max {max = $6}.",
  },
  {
    id: "awk-group",
    name: "Totals per key (awk arrays)",
    requires: ["awk-sum", "sort-uniq"],
    learn: "Arrays total by key: {b[$2] += $6} END {for (ip in b) print ip, b[ip]}. The for-in order is random, so pipe into sort.",
  },

  // Regex track
  {
    id: "regex-anchors",
    name: "Anchors (^ and $)",
    requires: ["grep-basic"],
    learn: "^ matches the start of a line and $ the end: grep '^ ' finds lines that start with a space.",
  },
  {
    id: "regex-classes",
    name: "Character classes ([0-9])",
    requires: ["grep-basic"],
    learn: "[abc] matches any one of a, b, or c; [0-9] any digit; [^0-9] anything except a digit.",
  },
  {
    id: "grep-w",
    name: "Whole words (grep -w)",
    requires: ["grep-basic"],
    learn: "-w matches whole words only: grep -w in skips the 'in' inside Loading or finished.",
  },
  {
    id: "regex-repeat",
    name: "Repetition (+ and {n})",
    requires: ["regex-classes", "grep-or"],
    learn: "With -E, + means one or more of the thing before it, {3} exactly three, and .* anything at all.",
  },
  {
    id: "grep-o",
    name: "Extract matches (grep -o)",
    requires: ["regex-repeat"],
    learn: "-o prints only the part of each line that matched, one match per line.",
  },
];

const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]));

// Every skill that `id` builds on, directly or indirectly.
function ancestors(id) {
  const found = new Set();
  const visit = (skillId) => {
    for (const parent of SKILL_BY_ID[skillId].requires) {
      if (!found.has(parent)) {
        found.add(parent);
        visit(parent);
      }
    }
  };
  visit(id);
  return [...found];
}

// ---------- Which skills does a command use? ----------

// Flags that take a value, per tool (so `-n 3` doesn't read "3" as an operand).
const VALUE_FLAGS = { grep: "ABC", head: "n", tail: "n", sort: "kt", cut: "cdf", awk: "F" };

function scanArgs(tool, args) {
  const flags = new Set();
  const operands = [];
  const takesValue = VALUE_FLAGS[tool] || "";
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-") || arg === "-" || /^-\d+$/.test(arg)) {
      if (!/^-\d+$/.test(arg)) operands.push(arg);
      continue;
    }
    for (let j = 1; j < arg.length; j++) {
      flags.add(arg[j]);
      if (takesValue.includes(arg[j])) {
        if (j === arg.length - 1) i++; // value is the next word
        break;
      }
    }
  }
  return { flags, operands };
}

/**
 * The skills a command line demonstrates, e.g.
 * "grep ERROR app.log | wc -l" -> ["pipes", "grep-basic", "wc"].
 * @returns {string[]}
 */
function detectSkills(command) {
  const stages = splitPipeline(command);
  if (!stages) return [];
  const found = new Set();
  if (stages.length > 1) found.add("pipes");

  stages.forEach(([tool, ...args], i) => {
    const { flags, operands } = scanArgs(tool, args);
    const earlier = stages.slice(0, i).map((stage) => stage[0]);
    const later = stages.slice(i + 1).map((stage) => stage[0]);

    switch (tool) {
      case "grep": {
        found.add("grep-basic");
        if (flags.has("i")) found.add("grep-i");
        if (flags.has("v")) found.add("grep-v");
        if (flags.has("c")) found.add("grep-count");
        if (flags.has("n")) found.add("grep-n");
        if (flags.has("w")) found.add("grep-w");
        if (flags.has("o")) found.add("grep-o");
        const pattern = operands[0] || "";
        if ((flags.has("E") && pattern.includes("|")) || pattern.includes("\\|")) found.add("grep-or");
        if (/^\^|\$$|\|\^|\$\|/.test(pattern)) found.add("regex-anchors");
        if (/\[[^\]]+\]/.test(pattern)) found.add("regex-classes");
        // Quantifiers: + ? {n} in extended regex, \+ \? \{n\} in basic; * in both.
        if (flags.has("E") ? /[+*?]|\{\d/.test(pattern) : /\*|\\[+?{]/.test(pattern)) found.add("regex-repeat");
        break;
      }
      case "head":
      case "tail":
        found.add("head-tail");
        break;
      case "wc":
        found.add("wc");
        break;
      case "cut":
        found.add("columns");
        break;
      case "awk": {
        const program = operands[0] || "";
        const actions = (program.match(/\{[^}]*\}/g) || []).join(" ");
        if (/\$(\d|NF|\()/.test(actions)) found.add("columns");
        // Anything before the first { action } (or a program with no action) is a filter.
        const condition = program.includes("{") ? program.slice(0, program.indexOf("{")) : program;
        if (condition.trim() && !/^\s*(BEGIN|END)\s*$/.test(condition)) found.add("awk-filter");
        const end = program.search(/\bEND\b/);
        if (end !== -1 && /\+=|\+\+/.test(program)) found.add("awk-sum");
        // An average (dividing in END), or a running maximum/minimum (compare, then keep a field).
        const keepsField = /[A-Za-z_]\w*(\[[^\]]*\])?\s*=\s*\$/.test(program);
        if ((end !== -1 && program.slice(end).includes("/")) || (/[<>]\s*[A-Za-z_]\w*/.test(program) && keepsField)) {
          found.add("awk-stats");
        }
        // Arrays: updating a[key], or looping over one.
        if (/[A-Za-z_]\w*\[[^\]]+\]\s*(\+=|\+\+|=(?!=))|\+\+\s*[A-Za-z_]\w*\[|for\s*\(\s*\w+\s+in\s+\w+\s*\)/.test(program)) {
          found.add("awk-group");
        }
        break;
      }
      case "sort":
        if (flags.has("u") || later.includes("uniq")) found.add("sort-uniq");
        if (flags.has("n") && ((flags.has("r") && later.includes("head")) || (!flags.has("r") && later.includes("tail")))) {
          found.add("top-n");
        }
        break;
      case "uniq":
        if (earlier.includes("sort")) found.add("sort-uniq");
        if (flags.has("c")) found.add("uniq-count");
        break;
    }
  });
  return [...found];
}

export { SKILLS, SKILL_BY_ID, ancestors, detectSkills };
