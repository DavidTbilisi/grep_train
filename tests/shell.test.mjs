// Compares the shell simulator against real bash + GNU coreutils.
// Run with: npm test   (needs bash, grep, awk, sort, ... on PATH)

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommandLine } from "../js/shell.js";
import { FILES, LEVELS } from "../js/game-data.js";

const EXTRA_FILES = {
  "a.txt": "apple pie\nbanana split\nApple tart\ncherry\n",
  "b.txt": "banana bread\napple juice\n",
  "users.csv": "id,name,dept\n1,alice,eng\n2,bob,ops\n3,carol,eng\n",
};
const files = { ...FILES, ...EXTRA_FILES };

const commands = [
  ...LEVELS.flatMap((level) => level.challenges.map((c) => c.solution)),
  ...LEVELS.flatMap((level) => level.challenges.map((c) => c.hints[c.hints.length - 1])),
  "grep -in apple a.txt",
  "grep -w apple a.txt b.txt",
  "grep -c an a.txt b.txt",
  "grep -l apple *.txt",
  "grep -h banana a.txt b.txt",
  "grep -o '[0-9]\\+ms' app.log",
  "grep -oE '[0-9]{3}' access.log",
  "grep 'User \\(alice\\|bob\\)' app.log",
  "grep -C 1 Retrying app.log",
  "grep -A1 -n 401 access.log",
  "grep -B 2 ERROR app.log",
  "grep '^10:30:1' access.log",
  "grep 'html$' access.log",
  "grep '5120$' access.log",
  "grep '[[:digit:]]\\{4\\}ms' app.log",
  "grep -vc INFO app.log",
  "grep -E 'POST /(login|checkout)' access.log",
  "cat a.txt b.txt",
  "cat -n b.txt",
  "head -2 app.log",
  "head -n 1 a.txt b.txt",
  "tail -3 access.log",
  "wc a.txt",
  "wc -w a.txt",
  "wc -l a.txt b.txt",
  "cat app.log | wc -l",
  "cat app.log | wc",
  "sort a.txt",
  "sort -r a.txt",
  "sort -t, -k3 users.csv",
  "sort -k5 -n access.log",
  "sort -k6,6 -rn access.log | head -n 3",
  "awk '{print $3}' app.log | sort -u",
  "awk '{print $3}' app.log | sort | uniq -c | sort -rn",
  "awk '{print $2}' access.log | sort | uniq -d",
  "awk '{print $2}' access.log | sort | uniq -u",
  "cut -d, -f2 users.csv",
  "cut -d, -f1,3 users.csv",
  "cut -d' ' -f2- access.log",
  "cut -c1-8 access.log",
  "awk -F, '{print $2, $3}' users.csv",
  "awk -F, '$3 == \"eng\" {print $2}' users.csv",
  "awk '$5 >= 400' access.log",
  "awk '$5 >= 400 && $3 == \"POST\" {print $1, $4}' access.log",
  "awk '/ERROR/ {print $2 \" - \" $4}' app.log",
  "awk '!/INFO/' app.log",
  "awk '$4 ~ /login/ {print NR\": \"$2}' access.log",
  "awk '{print $NF}' access.log | sort -n | tail -n 1",
  "awk '{print NF}' a.txt",
  "grep ERROR app.log | awk '{print $2}' | cut -d: -f3",
  // awk as a language: totals, averages, arrays, printf, number formatting
  "awk '{s += $6} END {print s}' access.log",
  "awk '{s += $6} END {print s/NR}' access.log",
  "awk '$5 == 200 {s += $6; n++} END {print s, n, s/n}' access.log",
  "awk '$5 == 999 {n++} END {print n}' access.log",
  "awk '$5 == 999 {n++} END {print n+0}' access.log",
  "awk '$6 > max {max = $6} END {print max}' access.log",
  "awk 'NR == 1 || $6 < min {min = $6} END {print min}' access.log",
  "awk '{b[$2] += $6} END {for (ip in b) print ip, b[ip]}' access.log | sort",
  "awk '{n[$5]++} END {for (s in n) print n[s], s}' access.log | sort -rn",
  "awk '{s[$4] += $6; c[$4]++} END {for (p in s) print p, s[p]/c[p]}' access.log | sort",
  "awk '/Slow query/ {s += $NF} END {print s}' app.log",
  "awk '{printf \"%s has %d fields\\n\", $3, NF}' app.log",
  "awk '{s += $6} END {printf \"%.1f %.2f %.0f %e %g\\n\", s/NR, s/7, 2.5, s, s/3}' access.log",
  "awk 'BEGIN {printf \"%5d|%-5d|%05d|%x|%o|%c|%5.1f|%s\\n\", 42, 42, 42, 255, 8, 65, 3.14159, \"ok\"}'",
  "awk 'BEGIN {print 1/3, 2/3, 100/3, 1e6/3, 1e7/3, 0.1+0.2, 123456.5, 4153.125, 0.000012345, -7/2}'",
  "awk 'BEGIN {printf \"%.1f %.1f %.1f %.1f %.2f %.0f %.0f\\n\", 0.25, 0.35, 1234.25, 1234.75, 1.005, 0.5, 1.5}'",
  "awk 'BEGIN {print length(\"hello\"), substr(\"hello\", 2, 3), index(\"hello\", \"l\"), toupper(\"a\") tolower(\"B\"), int(3.9), int(-3.9)}'",
  "awk '{print length}' a.txt",
  "awk 'BEGIN {FS = \",\"; OFS = \" | \"} NR > 1 {print $2, $3}' users.csv",
  "awk -F, 'NR > 1 {print NR - 1 \": \" toupper($2)}' users.csv",
  "awk '$5 == 404 {next} {n++} END {print n}' access.log",
  "awk '{if ($6 > 5000) big++; else small++} END {print big, small}' access.log",
  "awk '{x = ($5 >= 400) ? \"fail\" : \"ok\"; c[x]++} END {for (k in c) print k, c[k]}' access.log | sort",
  "awk 'NR % 5 == 0 {print NR, $1}' access.log",
  "awk '{print $NF - 1, $(NF-1), -$6}' access.log",
  "awk '$3 ~ /^P/ && $5 !~ /^2/' access.log",
  "awk '{i++; j += i} END {print i, j, i * j, j % 7, -i}' access.log",
];

const dir = mkdtempSync(join(tmpdir(), "grep-master-test-"));
for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);

const normalize = (lines) => lines.map((l) => l.trim().replace(/\s+/g, " "));
let failures = 0;

for (const cmd of [...new Set(commands)]) {
  // grep exits 1 when nothing matches, so read stdout regardless of status.
  const expected = spawnSync("bash", ["-c", cmd], {
    cwd: dir,
    env: { ...process.env, LC_ALL: "C" },
    encoding: "utf8",
  }).stdout;
  const result = runCommandLine(cmd, files);
  const got = result.error ? [`ERROR: ${result.error}`] : result.output;
  const want = expected === "" ? [] : expected.replace(/\n$/, "").split("\n");

  if (JSON.stringify(normalize(got)) !== JSON.stringify(normalize(want))) {
    failures++;
    console.log(`FAIL: ${cmd}\n  want: ${JSON.stringify(want)}\n  got:  ${JSON.stringify(got)}`);
  }
}

const errorCases = [
  "foo app.log", "grep", "grep x nope.log", "grep x", "head -n x app.log", "grep 'unclosed app.log", "grep x app.log |",
  "awk '{print $1' app.log", "awk 'BEGIN {print 1/0}'", "awk '{print $1 > \"out\"}' app.log", "awk '{foo(1)}' app.log",
];
for (const cmd of errorCases) {
  if (!runCommandLine(cmd, files).error) {
    failures++;
    console.log(`FAIL: expected an error for: ${cmd}`);
  }
}

rmSync(dir, { recursive: true });
const total = new Set(commands).size + errorCases.length;
console.log(failures ? `\n${failures} of ${total} checks failed` : `All ${total} checks passed`);
process.exit(failures ? 1 : 0);
