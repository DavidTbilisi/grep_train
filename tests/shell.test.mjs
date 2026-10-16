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

const errorCases = ["foo app.log", "grep", "grep x nope.log", "grep x", "head -n x app.log", "grep 'unclosed app.log", "grep x app.log |"];
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
