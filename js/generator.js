// Generator - endless practice challenges for each skill. Pure (no DOM).
//
// Each challenge gets freshly generated app.log / access.log content from a
// seeded random number generator (same seed, same challenge), and a template
// that writes the task, hints, and solution against that content. As with the
// course, the expected output is computed by running the solution.

import { runCommandLine } from "./shell.js";
import { SKILL_BY_ID } from "./skills.js";

// ---------- Seeded randomness ----------

// mulberry32: small, fast, good enough for games.
function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  const pick = (items) => items[Math.floor(next() * items.length)];
  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return { next, int, pick, shuffle };
}

// ---------- Log files ----------

const USERS = ["alice", "bob", "carol", "dave", "erin"];
const LEVELS = ["ERROR", "WARN", "INFO", "DEBUG"];

// No message contains a level name, and "timeout"/"database" appear in both
// upper and lower case so there's always something for grep -i to find.
const APP_MESSAGES = {
  INFO: [
    (r) => `User ${r.pick(USERS)} logged in`,
    (r) => `User ${r.pick(USERS)} logged out`,
    () => "Database connection established",
    () => "Cache cleared",
    () => "Health check passed",
    (r) => `Job report-${r.int(1, 9)} finished`,
  ],
  DEBUG: [
    (r) => `Cache hit ratio 0.${r.int(50, 99)}`,
    () => "Loading configuration from config.yml",
    (r) => `Session ${r.int(4096, 65535).toString(16)} refreshed`,
  ],
  WARN: [
    (r) => `Slow query took ${r.int(300, 4800)}ms`,
    (r) => `Memory usage at ${r.int(85, 97)}%`,
    () => "Retrying database connection",
    () => "Connection timeout to cache, retrying",
  ],
  ERROR: [
    () => "Timeout calling payment service",
    () => "Database connection lost",
    () => "Request timeout on /api/orders",
    (r) => `Failed to send email to ${r.pick(USERS)}`,
    () => "Disk quota exceeded",
  ],
};

// IPs where none is a prefix of another, so grep IP is exact.
const IPS = ["192.168.1.10", "10.0.0.5", "172.16.0.8", "203.0.113.7", "198.51.100.23", "10.0.0.42"];
const STATUSES = ["200", "401", "404", "500"];

const ROUTES = [
  { method: "GET", path: "/index.html", status: { 200: 5120 }, weight: 4 },
  { method: "GET", path: "/products", status: { 200: 8800 }, weight: 3 },
  { method: "GET", path: "/cart", status: { 200: 3100 }, weight: 2 },
  { method: "GET", path: "/dashboard", status: { 200: 6400 }, weight: 2 },
  { method: "GET", path: "/login", status: { 200: 1840 }, weight: 2 },
  { method: "POST", path: "/login", status: { 200: 950, 401: 230 }, weight: 3 },
  { method: "POST", path: "/checkout", status: { 200: 760, 500: 120 }, weight: 2 },
  { method: "GET", path: "/api/orders", status: { 200: 2700, 500: 160 }, weight: 2 },
  { method: "GET", path: "/admin", status: { 404: 512 }, weight: 1 },
  { method: "GET", path: "/wp-login.php", status: { 404: 512 }, weight: 1 },
  { method: "GET", path: "/old-page", status: { 404: 512 }, weight: 1 },
];
const COLUMNS = { 2: "IP address", 3: "HTTP method", 4: "path", 5: "status code", 6: "size in bytes" };

const pad = (n) => String(n).padStart(2, "0");
const clock = (seconds) => `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;

function generateAppLog(r) {
  const count = r.int(13, 17);
  const levels = ["ERROR", "ERROR", "WARN", "WARN", "WARN", "DEBUG", "INFO", "INFO"];
  while (levels.length < count) levels.push(r.pick(["INFO", "INFO", "INFO", "DEBUG", "WARN", "ERROR"]));
  const date = `2024-${pad(r.int(1, 12))}-${pad(r.int(1, 28))}`;
  let time = r.int(8, 15) * 3600 + r.int(0, 59) * 60;
  const entries = r.shuffle(levels).map((level) => {
    time += r.int(1, 9);
    return { time, level, message: r.pick(APP_MESSAGES[level])(r) };
  });
  // Guarantee material for some templates: "timeout" in lower case (grep -i),
  // and slow queries under 1000ms and over 2000ms (regex repeat counts).
  const [warn1, warn2, warn3] = r.shuffle(entries.filter((e) => e.level === "WARN"));
  warn1.message = "Connection timeout to cache, retrying";
  warn2.message = `Slow query took ${r.int(300, 999)}ms`;
  warn3.message = `Slow query took ${r.int(2000, 4800)}ms`;
  return entries.map((e) => `${date} ${clock(e.time)} ${e.level} ${e.message}`).join("\n") + "\n";
}

// Byte counts never contain a status code, so grep 404 only matches statuses.
function bytesFor(r, base) {
  for (;;) {
    const bytes = Math.round(base * (0.9 + r.next() * 0.2));
    if (!/200|401|404|500/.test(String(bytes))) return bytes;
  }
}

function generateAccessLog(r) {
  for (;;) {
    const ips = r.shuffle(IPS).slice(0, 4);
    const ipPool = ips.flatMap((ip, i) => Array(4 - i).fill(ip)); // skewed so one IP leads
    const routePool = ROUTES.flatMap((route) => Array(route.weight).fill(route));
    const count = r.int(13, 18);
    let time = r.int(8, 15) * 3600 + r.int(0, 59) * 60;
    const rows = [];
    for (let i = 0; i < count; i++) {
      const route = r.pick(routePool);
      const status = r.pick(Object.keys(route.status));
      time += r.int(1, 4);
      rows.push({ ip: r.pick(ipPool), route, status, bytes: bytesFor(r, route.status[status]), time });
    }
    // Every status should appear, and one IP should be the clear top visitor.
    const statuses = new Set(rows.map((row) => row.status));
    const perIp = Object.values(rows.reduce((acc, row) => ({ ...acc, [row.ip]: (acc[row.ip] || 0) + 1 }), {}));
    perIp.sort((a, b) => b - a);
    if (STATUSES.every((s) => statuses.has(s)) && perIp[0] > (perIp[1] || 0) && rows.filter((x) => x.status === "404").length >= 2) {
      return rows
        .map((row) => `${clock(row.time)} ${row.ip} ${row.route.method} ${row.route.path} ${row.status} ${row.bytes}`)
        .join("\n") + "\n";
    }
  }
}

// error.log: ERROR entries, each followed by an indented Java-style stack trace.
const TRACES = [
  { message: () => "Timeout calling payment service", frames: ["PaymentClient.charge", "CheckoutService.submit", "HttpServer.handle"] },
  { message: () => "Database connection lost", frames: ["ConnectionPool.borrow", "OrderRepository.save", "CheckoutService.submit"] },
  { message: () => "Request timeout on /api/orders", frames: ["OrderController.list", "HttpServer.handle"] },
  { message: () => "Disk quota exceeded", frames: ["ReportWriter.flush", "ReportJob.run"] },
  { message: (r) => `Failed to send email to ${r.pick(USERS)}`, frames: ["EmailSender.send", "NotificationService.notify", "HttpServer.handle"] },
];

function generateErrorLog(r) {
  const date = `2024-${pad(r.int(1, 12))}-${pad(r.int(1, 28))}`;
  let time = r.int(8, 15) * 3600 + r.int(0, 59) * 60;
  const out = [];
  for (let i = 0, count = r.int(4, 6); i < count; i++) {
    const trace = r.pick(TRACES);
    time += r.int(5, 40);
    out.push(`${date} ${clock(time)} ERROR ${trace.message(r)}`);
    for (const frame of trace.frames.slice(0, r.int(2, trace.frames.length))) {
      out.push(`    at ${frame}(${frame.split(".")[0]}.java:${r.int(12, 260)})`);
    }
  }
  return out.join("\n") + "\n";
}

function generateLogs(r) {
  return { "app.log": generateAppLog(r), "access.log": generateAccessLog(r), "error.log": generateErrorLog(r) };
}

// ---------- Helpers for templates ----------

const lines = (text) => text.replace(/\n$/, "").split("\n");
const column = (text, n) => lines(text).map((line) => line.split(" ")[n - 1]);
const presentLevels = (logs) => LEVELS.filter((level) => column(logs["app.log"], 3).includes(level));
const presentStatuses = (logs) => STATUSES.filter((s) => column(logs["access.log"], 5).includes(s));
const presentPaths = (logs) => [...new Set(column(logs["access.log"], 4))];
const capitalize = (word) => word[0].toUpperCase() + word.slice(1);

// Words that appear in app.log in more than one case (so -i matters).
function mixedCaseWords(logs) {
  const text = logs["app.log"];
  return ["timeout", "database"].filter((word) => text.includes(word) && text.includes(capitalize(word)));
}

// Counts from a `uniq -c` style output, biggest first.
// Last words of app.log lines that also appear elsewhere, so $ matters.
function endingWords(logs, run) {
  const words = new Set(lines(logs["app.log"]).map((line) => line.split(" ").pop()));
  return [...words].filter(
    (w) => /^[a-z]{4,}$/.test(w) && run(`grep ${w} app.log`).length > run(`grep '${w}$' app.log`).length
  );
}

const counts = (output) => output.map((line) => parseInt(line, 10));

// Does a ranked report have a clear cut after the first k rows?
function clearTop(output, k) {
  const c = counts(output);
  return c.length > k ? c[k - 1] > c[k] : c.length >= k;
}

// ---------- Templates ----------
// make(r, logs, run) returns { title, description, files, solution, hints } or
// null when this log doesn't suit the template (another log is generated).

const t = (skills, difficulty, make) => ({ skills, difficulty, make });

const TEMPLATES = [
  // grep-basic
  t(["grep-basic"], 1, (r) => {
    const level = r.pick(LEVELS);
    return {
      title: `Find the ${level} lines`,
      description: `Show every ${level} line in app.log.`,
      files: ["app.log", "access.log"],
      solution: `grep ${level} app.log`,
      hints: ["grep PATTERN FILE prints the matching lines.", `The pattern is ${level}, the file is app.log.`, `grep ${level} app.log`],
    };
  }),
  t(["grep-basic"], 2, (r, logs) => {
    const path = r.pick(presentPaths(logs));
    return {
      title: `Requests for ${path}`,
      description: `Show every request for ${path} in access.log.`,
      files: ["access.log", "app.log"],
      solution: `grep ${path} access.log`,
      hints: ["Search access.log for the path.", `The pattern is ${path}.`, `grep ${path} access.log`],
    };
  }),
  t(["grep-basic"], 3, (r, logs) => {
    const row = r.pick(lines(logs["access.log"])).split(" ");
    const target = `${row[2]} ${row[3]}`;
    return {
      title: "A pattern with a space",
      description: `Show every ${row[2]} request to ${row[3]} in access.log (and no other requests).`,
      files: ["access.log"],
      solution: `grep '${target}' access.log`,
      hints: ["Search for the method and the path together.", "A pattern with a space must be in quotes.", `grep '${target}' access.log`],
    };
  }),

  // grep-i
  t(["grep-i"], 1, (r, logs) => {
    const words = mixedCaseWords(logs);
    if (!words.length) return null;
    const word = r.pick(words);
    return {
      title: "Any case",
      description: `Show every line of app.log that mentions ${word}, whether it's written ${capitalize(word)} or ${word}.`,
      files: ["app.log"],
      solution: `grep -i ${word} app.log`,
      hints: ["grep is case-sensitive by default.", "-i ignores case.", `grep -i ${word} app.log`],
    };
  }),
  t(["grep-i", "grep-count"], 2, (r, logs) => {
    const words = mixedCaseWords(logs);
    if (!words.length) return null;
    const word = r.pick(words);
    return {
      title: "Count, any case",
      description: `How many lines of app.log mention ${word} in any case? Print just the number.`,
      files: ["app.log"],
      solution: `grep -ic ${word} app.log`,
      hints: ["You need two options: ignore case, and count.", "Options can be combined: -ic.", `grep -ic ${word} app.log`],
    };
  }),
  t(["grep-i", "grep-n"], 3, (r, logs) => {
    const words = mixedCaseWords(logs);
    if (!words.length) return null;
    const word = r.pick(words);
    return {
      title: "Where, any case",
      description: `Show every line of app.log that mentions ${word} in any case, with its line number.`,
      files: ["app.log"],
      solution: `grep -in ${word} app.log`,
      hints: ["Ignore case, and number the lines.", "-i and -n combine as -in.", `grep -in ${word} app.log`],
    };
  }),

  // grep-v
  t(["grep-v"], 1, (r, logs) => {
    const level = r.pick(presentLevels(logs));
    return {
      title: `Everything but ${level}`,
      description: `Show every line of app.log except the ${level} lines.`,
      files: ["app.log"],
      solution: `grep -v ${level} app.log`,
      hints: ["You want the opposite of a normal search.", "-v inverts the match.", `grep -v ${level} app.log`],
    };
  }),
  t(["grep-v", "grep-count"], 2, (r, logs) => {
    const level = r.pick(presentLevels(logs));
    return {
      title: `How many aren't ${level}?`,
      description: `How many lines of app.log are NOT ${level} lines? Print just the number.`,
      files: ["app.log"],
      solution: `grep -vc ${level} app.log`,
      hints: ["Invert the match, then count.", "-v and -c combine as -vc.", `grep -vc ${level} app.log`],
    };
  }),
  t(["grep-v", "pipes"], 3, (r, logs) => {
    const [a, b] = r.shuffle(presentLevels(logs));
    return {
      title: "Neither one nor the other",
      description: `Show every line of app.log that is neither ${a} nor ${b}.`,
      files: ["app.log"],
      solution: `grep -v ${a} app.log | grep -v ${b}`,
      hints: ["Remove one level, then remove the other.", `Pipe one grep -v into another.`, `grep -v ${a} app.log | grep -v ${b}`],
    };
  }),

  // grep-count
  t(["grep-count"], 1, (r, logs) => {
    const level = r.pick(presentLevels(logs));
    return {
      title: `Count the ${level} lines`,
      description: `How many ${level} lines are in app.log? Print just the number.`,
      files: ["app.log"],
      solution: `grep -c ${level} app.log`,
      hints: ["grep has an option for counting.", "-c means count.", `grep -c ${level} app.log`],
    };
  }),
  t(["grep-count"], 2, (r, logs) => {
    const status = r.pick(presentStatuses(logs));
    return {
      title: `How many ${status}s?`,
      description: `How many requests in access.log got status ${status}? Print just the number.`,
      files: ["access.log"],
      solution: `grep -c ${status} access.log`,
      hints: ["Count the lines containing the status.", "-c counts matching lines.", `grep -c ${status} access.log`],
    };
  }),
  t(["grep-count"], 3, (r, logs) => {
    const users = USERS.filter((user) => logs["app.log"].includes(`${user} logged in`));
    if (!users.length) return null;
    const user = r.pick(users);
    return {
      title: `${capitalize(user)}'s logins`,
      description: `How many times did ${user} log in? Print just the number.`,
      files: ["app.log"],
      solution: `grep -c '${user} logged in' app.log`,
      hints: ["Count the lines that say the user logged in.", "The pattern has spaces, so quote it.", `grep -c '${user} logged in' app.log`],
    };
  }),

  // grep-n
  t(["grep-n"], 1, (r, logs) => {
    const level = r.pick(presentLevels(logs));
    return {
      title: `Where are the ${level}s?`,
      description: `Show the ${level} lines of app.log with their line numbers.`,
      files: ["app.log"],
      solution: `grep -n ${level} app.log`,
      hints: ["grep has an option for line numbers.", "-n means number.", `grep -n ${level} app.log`],
    };
  }),
  t(["grep-n"], 2, (r, logs) => {
    const path = r.pick(presentPaths(logs));
    return {
      title: `Which lines hit ${path}?`,
      description: `Show the requests for ${path} in access.log, with their line numbers.`,
      files: ["access.log"],
      solution: `grep -n ${path} access.log`,
      hints: ["Search for the path.", "Add -n for line numbers.", `grep -n ${path} access.log`],
    };
  }),
  t(["grep-n", "grep-v"], 3, () => ({
    title: "Failures, by line",
    description: "Show every request in access.log that did NOT get status 200, with its line number.",
    files: ["access.log"],
    solution: "grep -vn 200 access.log",
    hints: ["Invert the match and number the lines.", "-v and -n combine as -vn.", "grep -vn 200 access.log"],
  })),

  // grep-or
  t(["grep-or"], 1, (r, logs) => {
    const [a, b] = r.shuffle(presentLevels(logs));
    return {
      title: "This or that",
      description: `Show every line of app.log that is ${a} or ${b}.`,
      files: ["app.log"],
      solution: `grep -E '${a}|${b}' app.log`,
      hints: ["Use extended regex with -E.", "| means OR inside the pattern. Quote it.", `grep -E '${a}|${b}' app.log`],
    };
  }),
  t(["grep-or"], 2, (r, logs) => {
    const [a, b] = r.shuffle(presentStatuses(logs).filter((s) => s !== "200"));
    return {
      title: "Two kinds of failure",
      description: `Show every request in access.log that got status ${a} or ${b}.`,
      files: ["access.log"],
      solution: `grep -E '${a}|${b}' access.log`,
      hints: ["One grep can match either status.", "Use -E and A|B, in quotes.", `grep -E '${a}|${b}' access.log`],
    };
  }),
  t(["grep-or", "grep-count"], 3, (r, logs) => {
    const [a, b] = r.shuffle(presentLevels(logs));
    return {
      title: "Count both",
      description: `How many lines of app.log are ${a} or ${b}? Print just the number.`,
      files: ["app.log"],
      solution: `grep -cE '${a}|${b}' app.log`,
      hints: ["Match either level, then count.", "-c and -E combine as -cE.", `grep -cE '${a}|${b}' app.log`],
    };
  }),

  // head-tail
  t(["head-tail"], 1, (r) => {
    const n = r.int(2, 5);
    const file = r.pick(["app.log", "access.log"]);
    return {
      title: `The first ${n}`,
      description: `Show only the first ${n} lines of ${file}.`,
      files: [file],
      solution: `head -n ${n} ${file}`,
      hints: ["Use the head tool.", "-n sets how many lines.", `head -n ${n} ${file}`],
    };
  }),
  t(["head-tail"], 2, (r) => {
    const n = r.int(2, 5);
    return {
      title: "The newest requests",
      description: `Show the ${n} most recent requests in access.log. New entries are added at the bottom.`,
      files: ["access.log"],
      solution: `tail -n ${n} access.log`,
      hints: ["The most recent lines are at the end of the file.", "tail -n N shows the last N lines.", `tail -n ${n} access.log`],
    };
  }),
  t(["head-tail", "pipes"], 3, (r) => {
    const k = r.int(3, 9);
    return {
      title: `Just line ${k}`,
      description: `Show only line ${k} of app.log.`,
      files: ["app.log"],
      solution: `head -n ${k} app.log | tail -n 1`,
      hints: [`Take the first ${k} lines...`, "...then keep only the last of those.", `head -n ${k} app.log | tail -n 1`],
    };
  }),

  // wc
  t(["wc"], 1, (r) => {
    const file = r.pick(["app.log", "access.log"]);
    return {
      title: "How long is it?",
      description: `How many lines are in ${file}?`,
      files: [file],
      solution: `wc -l ${file}`,
      hints: ["wc counts things.", "-l counts lines.", `wc -l ${file}`],
    };
  }),
  t(["wc"], 2, () => ({
    title: "Traffic",
    description: "How many requests are in access.log? Each request is one line.",
    files: ["access.log", "app.log"],
    solution: "wc -l access.log",
    hints: ["Counting requests means counting lines.", "wc -l counts lines.", "wc -l access.log"],
  })),
  t(["wc", "pipes"], 3, () => ({
    title: "Both logs together",
    description: "How many lines are there in app.log and access.log together? Print one number.",
    files: ["app.log", "access.log"],
    solution: "cat app.log access.log | wc -l",
    hints: ["wc -l with two files prints three lines. You want one.", "cat both files into a single stream first.", "cat app.log access.log | wc -l"],
  })),

  // pipes
  t(["pipes"], 1, (r, logs) => {
    const level = r.pick(presentLevels(logs));
    return {
      title: "Pipe into wc",
      description: `Count the ${level} lines in app.log by piping grep into wc -l.`,
      files: ["app.log"],
      solution: `grep ${level} app.log | wc -l`,
      hints: [`First grep the ${level} lines.`, "Then | wc -l counts them.", `grep ${level} app.log | wc -l`],
    };
  }),
  t(["pipes", "head-tail"], 2, (r, logs) => {
    const level = r.pick(presentLevels(logs));
    const [tool, which] = r.pick([["head", "first"], ["tail", "most recent"]]);
    return {
      title: `The ${which} ${level}`,
      description: `Show only the ${which} ${level} line in app.log.`,
      files: ["app.log"],
      solution: `grep ${level} app.log | ${tool} -n 1`,
      hints: [`Find all the ${level} lines first.`, `Pipe them into ${tool} to keep one.`, `grep ${level} app.log | ${tool} -n 1`],
    };
  }),
  t(["pipes"], 3, (r, logs, run) => {
    const method = r.pick(["GET", "POST"]);
    const status = r.pick(presentStatuses(logs));
    const solution = `grep ${method} access.log | grep -c ${status}`;
    if (run(solution)[0] === "0") return null;
    return {
      title: "Two filters",
      description: `How many ${method} requests got status ${status}? Print just the number.`,
      files: ["access.log"],
      solution,
      hints: [`Keep the ${method} lines first.`, "Pipe them into a second grep that counts.", solution],
    };
  }),

  // columns
  t(["columns"], 1, (r) => {
    const n = r.pick(Object.keys(COLUMNS));
    return {
      title: "Pick a column",
      description: `Print only the ${COLUMNS[n]} of each request. Columns of access.log: time ip method path status bytes.`,
      files: ["access.log"],
      solution: `awk '{print $${n}}' access.log`,
      hints: ["awk splits each line into columns $1, $2, ...", `The ${COLUMNS[n]} is column ${n}.`, `awk '{print $${n}}' access.log`],
    };
  }),
  t(["columns"], 2, (r) => {
    const [a, b] = r.shuffle(Object.keys(COLUMNS)).slice(0, 2).sort();
    return {
      title: "Two columns",
      description: `Print the ${COLUMNS[a]} and the ${COLUMNS[b]} of each request, separated by a space. Columns: time ip method path status bytes.`,
      files: ["access.log"],
      solution: `awk '{print $${a}, $${b}}' access.log`,
      hints: ["awk can print several columns.", "Separate them with a comma: print $A, $B.", `awk '{print $${a}, $${b}}' access.log`],
    };
  }),
  t(["columns", "pipes"], 3, (r, logs) => {
    const level = r.pick(presentLevels(logs));
    return {
      title: `When did ${level}s happen?`,
      description: `Print only the time (2nd column) of each ${level} line in app.log.`,
      files: ["app.log"],
      solution: `grep ${level} app.log | awk '{print $2}'`,
      hints: [`Start with the ${level} lines.`, "Pipe them into awk to print column 2.", `grep ${level} app.log | awk '{print $2}'`],
    };
  }),

  // sort-uniq
  t(["sort-uniq"], 1, () => ({
    title: "Which levels?",
    description: "List each log level that appears in app.log, once each, in sorted order.",
    files: ["app.log"],
    solution: "awk '{print $3}' app.log | sort | uniq",
    hints: ["The level is column 3.", "sort, then uniq.", "awk '{print $3}' app.log | sort | uniq"],
  })),
  t(["sort-uniq"], 2, (r) => {
    const n = r.pick(["2", "4", "5"]);
    return {
      title: "Distinct values",
      description: `List each distinct ${COLUMNS[n]} in access.log once, in sorted order. Columns: time ip method path status bytes.`,
      files: ["access.log"],
      solution: `awk '{print $${n}}' access.log | sort | uniq`,
      hints: [`Print column ${n}.`, "Pipe into sort, then uniq.", `awk '{print $${n}}' access.log | sort | uniq`],
    };
  }),
  t(["sort-uniq", "pipes"], 3, (r, logs) => {
    const status = r.pick(presentStatuses(logs).filter((s) => s !== "200"));
    return {
      title: `Who got a ${status}?`,
      description: `Which IP addresses got a ${status} response? List each once, sorted.`,
      files: ["access.log"],
      solution: `grep ${status} access.log | awk '{print $2}' | sort | uniq`,
      hints: [`Keep the ${status} lines.`, "Print the IP column, then sort | uniq.", `grep ${status} access.log | awk '{print $2}' | sort | uniq`],
    };
  }),

  // uniq-count
  t(["uniq-count"], 1, () => ({
    title: "Level histogram",
    description: "Count how many lines app.log has for each log level.",
    files: ["app.log"],
    solution: "awk '{print $3}' app.log | sort | uniq -c",
    hints: ["Print the level column (3).", "sort, then uniq -c to count.", "awk '{print $3}' app.log | sort | uniq -c"],
  })),
  t(["uniq-count"], 2, (r) => {
    const n = r.pick(["2", "3", "5"]);
    return {
      title: "Requests per value",
      description: `Count how many requests there are for each ${COLUMNS[n]}. Columns: time ip method path status bytes.`,
      files: ["access.log"],
      solution: `awk '{print $${n}}' access.log | sort | uniq -c`,
      hints: [`Print column ${n}.`, "sort, then uniq -c.", `awk '{print $${n}}' access.log | sort | uniq -c`],
    };
  }),
  t(["uniq-count", "grep-v"], 3, () => ({
    title: "Failures per IP",
    description: "For each IP address, count its requests that did NOT get status 200.",
    files: ["access.log"],
    solution: "grep -v ' 200 ' access.log | awk '{print $2}' | sort | uniq -c",
    hints: ["Drop the 200 lines first (spaces around 200 make it exact).", "Then print the IP, sort, uniq -c.", "grep -v ' 200 ' access.log | awk '{print $2}' | sort | uniq -c"],
  })),

  // awk-filter
  t(["awk-filter"], 1, (r, logs) => {
    const status = r.pick(presentStatuses(logs).filter((s) => s !== "200"));
    return {
      title: "Filter with awk",
      description: `Using awk, show every request in access.log whose status (column 5) is ${status}.`,
      files: ["access.log"],
      solution: `awk '$5 == ${status}' access.log`,
      hints: ["awk 'CONDITION' prints the lines where the condition is true.", "Compare a column with ==.", `awk '$5 == ${status}' access.log`],
    };
  }),
  t(["awk-filter", "columns"], 2, (r, logs) => {
    const status = r.pick(presentStatuses(logs).filter((s) => s !== "200"));
    return {
      title: `Paths that got ${status}`,
      description: `Show the path (column 4) of every request whose status (column 5) is ${status}.`,
      files: ["access.log"],
      solution: `awk '$5 == ${status} {print $4}' access.log`,
      hints: ["Put a condition before the { print } part.", `$5 == ${status} picks the lines; print $4 prints the path.`, `awk '$5 == ${status} {print $4}' access.log`],
    };
  }),
  t(["awk-filter", "columns"], 2, (r, logs) => {
    const sizes = column(logs["access.log"], 6).map(Number).sort((a, b) => a - b);
    const limit = Math.floor(sizes[Math.floor(sizes.length / 2)] / 100) * 100;
    return {
      title: "Big responses",
      description: `Show the path (column 4) of every response bigger than ${limit} bytes (column 6).`,
      files: ["access.log"],
      solution: `awk '$6 > ${limit} {print $4}' access.log`,
      hints: ["grep can't compare numbers, but awk can.", `The condition is $6 > ${limit}.`, `awk '$6 > ${limit} {print $4}' access.log`],
    };
  }),
  t(["awk-filter", "columns"], 3, (r, logs, run) => {
    const method = r.pick(["GET", "POST"]);
    const solution = `awk '$5 >= 400 && $3 == "${method}" {print $2}' access.log`;
    if (!run(solution).length) return null;
    return {
      title: `Failed ${method}s`,
      description: `Show the IP of every ${method} request that failed (status 400 or higher).`,
      files: ["access.log"],
      solution,
      hints: ["Combine two conditions with &&.", `Compare text in quotes: $3 == "${method}".`, solution],
    };
  }),

  // top-n
  t(["top-n"], 1, (r, logs, run) => {
    const solution = "awk '{print $2}' access.log | sort | uniq -c | sort -rn | head -n 1";
    if (!clearTop(run(solution.replace(/ \| head -n 1$/, "")), 1)) return null;
    return {
      title: "Top visitor",
      description: "Which IP made the most requests? Show its count and IP on one line.",
      files: ["access.log"],
      solution,
      hints: ["Start from a uniq -c report of the IP column.", "sort -rn puts the biggest count first; head keeps it.", solution],
    };
  }),
  t(["top-n"], 2, (r, logs, run) => {
    const k = r.int(2, 3);
    const report = "awk '{print $4}' access.log | sort | uniq -c | sort -rn";
    if (!clearTop(run(report), k)) return null;
    const solution = `${report} | head -n ${k}`;
    return {
      title: `Top ${k} paths`,
      description: `Show the ${k} most requested paths with their counts, busiest first.`,
      files: ["access.log"],
      solution,
      hints: ["Count requests per path (column 4) with uniq -c.", `sort -rn, then head -n ${k}.`, solution],
    };
  }),
  t(["top-n", "awk-filter"], 3, (r, logs, run) => {
    const status = r.pick(presentStatuses(logs).filter((s) => s !== "200"));
    const report = `awk '$5 == ${status} {print $2}' access.log | sort | uniq -c | sort -rn`;
    if (!clearTop(run(report), 1)) return null;
    const solution = `${report} | head -n 1`;
    return {
      title: `Most ${status}s`,
      description: `Which IP got the most ${status} responses? Show its count and IP on one line.`,
      files: ["access.log"],
      solution,
      hints: [`Print the IP of the ${status} lines.`, "Then the usual sort | uniq -c | sort -rn | head -n 1.", solution],
    };
  }),
  t(["top-n"], 3, (r, logs) => {
    const sizes = column(logs["access.log"], 6).map(Number).sort((a, b) => b - a);
    if (sizes[0] === sizes[1]) return null;
    return {
      title: "The biggest response",
      description: "Show the full line of the largest response in access.log (bytes are column 6).",
      files: ["access.log"],
      solution: "sort -k6 -rn access.log | head -n 1",
      hints: ["sort -k N sorts by column N.", "Sort column 6 numerically, biggest first, and keep the top line.", "sort -k6 -rn access.log | head -n 1"],
    };
  }),

  // regex-anchors
  t(["regex-anchors"], 1, (r, logs, run) => {
    const words = endingWords(logs, run);
    if (!words.length) return null;
    const word = r.pick(words);
    return {
      title: `Ends with ${word}`,
      description: `Show the lines of app.log that END with the word ${word} (not the ones that just mention it).`,
      files: ["app.log"],
      solution: `grep '${word}$' app.log`,
      hints: ["$ matches the end of a line.", `Put $ right after the word, inside quotes: '${word}$'.`, `grep '${word}$' app.log`],
    };
  }),
  t(["regex-anchors", "grep-count"], 2, (r, logs, run) => {
    // Only when the shortcut grep -c at is wrong (at also appears inside Database).
    if (run("grep -c at error.log")[0] === run("grep -c '^ ' error.log")[0]) return null;
    return {
      title: "Count the stack frames",
      description: "How many stack-trace lines are in error.log? They're the lines that start with a space. Print just the number.",
      files: ["error.log"],
      solution: "grep -c '^ ' error.log",
      hints: ["^ matches the start of a line.", "'^ ' is a line that starts with a space; -c counts.", "grep -c '^ ' error.log"],
    };
  }),
  t(["regex-anchors", "regex-classes"], 3, () => ({
    title: "Just the error lines",
    description: "Show only the first line of each error in error.log: the lines that do NOT start with a space. Use ^ and a character class.",
    files: ["error.log"],
    solution: "grep '^[^ ]' error.log",
    hints: ["^ anchors the pattern to the start of the line.", "[^ ] means any character except a space.", "grep '^[^ ]' error.log"],
  })),

  // regex-classes
  t(["regex-classes"], 1, (r) => {
    const [from, to] = r.pick([["a", "c"], ["b", "d"], ["c", "e"]]);
    return {
      title: `Users ${from} to ${to}`,
      description: `Show the "User ..." lines of app.log about users whose name starts with a letter from ${from} to ${to}.`,
      files: ["app.log"],
      solution: `grep 'User [${from}-${to}]' app.log`,
      hints: [`[${from}-${to}] matches any one letter from ${from} to ${to}.`, "Search for User, a space, then the class.", `grep 'User [${from}-${to}]' app.log`],
    };
  }),
  t(["regex-classes"], 2, () => ({
    title: "Client errors",
    description: "Show every request in access.log that got a 4xx status (any code from 400 to 499).",
    files: ["access.log"],
    solution: "grep ' 4[0-9][0-9] ' access.log",
    hints: ["[0-9] matches any one digit.", "The status has a space on each side: ' 4[0-9][0-9] '.", "grep ' 4[0-9][0-9] ' access.log"],
  })),
  t(["regex-classes"], 3, () => ({
    title: "Every failure",
    description: "Show every request in access.log that failed: status 4xx or 5xx. Use one character class for the first digit.",
    files: ["access.log"],
    solution: "grep ' [45][0-9][0-9] ' access.log",
    hints: ["[45] matches a 4 or a 5.", "Then two digits, with a space on each side.", "grep ' [45][0-9][0-9] ' access.log"],
  })),

  // grep-w
  t(["grep-w"], 1, (r, logs, run) => {
    if (run("grep in app.log").length === run("grep -w in app.log").length) return null;
    return {
      title: "The word in",
      description: "Show the lines of app.log that contain the word in on its own, not inside words like Loading or finished.",
      files: ["app.log"],
      solution: "grep -w in app.log",
      hints: ["grep in also matches the in inside other words.", "-w matches whole words only.", "grep -w in app.log"],
    };
  }),
  t(["grep-w", "grep-count"], 2, (r, logs, run) => {
    if (run("grep -c at error.log")[0] === run("grep -wc at error.log")[0]) return null;
    return {
      title: "The word at",
      description: "How many lines of error.log contain the word at on its own? (The at inside Database doesn't count.) Print just the number.",
      files: ["error.log"],
      solution: "grep -wc at error.log",
      hints: ["Match whole words only, and count.", "-w and -c combine as -wc.", "grep -wc at error.log"],
    };
  }),
  t(["grep-w", "grep-v"], 3, (r, logs, run) => {
    if (run("grep -v in app.log").length === run("grep -vw in app.log").length) return null;
    return {
      title: "Without the word in",
      description: "Show the lines of app.log that do NOT contain the word in on its own. (A line with Loading but no separate in should be shown.)",
      files: ["app.log"],
      solution: "grep -vw in app.log",
      hints: ["Invert the match, and match whole words only.", "-v and -w combine as -vw.", "grep -vw in app.log"],
    };
  }),

  // regex-repeat
  t(["regex-repeat"], 1, (r, logs, run) => {
    if (run("grep java error.log").length === run("grep -E 'java:[0-9]{3}' error.log").length) return null;
    return {
      title: "Three-digit line numbers",
      description: "Show the stack-trace lines in error.log that point at line 100 or higher (a three-digit line number, like PaymentClient.java:123).",
      files: ["error.log"],
      solution: "grep -E 'java:[0-9]{3}' error.log",
      hints: ["With -E, {3} means exactly three of the thing before it.", "[0-9]{3} is three digits; put java: in front.", "grep -E 'java:[0-9]{3}' error.log"],
    };
  }),
  t(["regex-repeat", "regex-classes"], 2, (r, logs, run) => {
    const slow = run("grep ms app.log").length;
    if (!slow || slow === run("grep -E '[0-9]{4}ms' app.log").length) return null;
    return {
      title: "Really slow queries",
      description: "Show the slow queries in app.log that took 1000ms or more: four digits before ms.",
      files: ["app.log"],
      solution: "grep -E '[0-9]{4}ms' app.log",
      hints: ["Use -E and a repeat count.", "[0-9]{4} is four digits.", "grep -E '[0-9]{4}ms' app.log"],
    };
  }),
  t(["regex-repeat", "regex-classes"], 3, (r, logs, run) => {
    const slow = run("grep ms app.log").length;
    if (!slow || slow === run("grep -E '[2-9][0-9]{3}ms' app.log").length) return null;
    return {
      title: "Two seconds or more",
      description: "Show the slow queries in app.log that took 2000ms or more (but under 10000ms).",
      files: ["app.log"],
      solution: "grep -E '[2-9][0-9]{3}ms' app.log",
      hints: ["The first digit is 2 to 9, then three more digits.", "[2-9] then [0-9]{3}, then ms.", "grep -E '[2-9][0-9]{3}ms' app.log"],
    };
  }),

  // grep-o
  t(["grep-o"], 1, () => ({
    title: "Just the durations",
    description: "Print just the duration of each slow query in app.log (like 2300ms), one per line.",
    files: ["app.log"],
    solution: "grep -oE '[0-9]+ms' app.log",
    hints: ["-o prints only the part of the line that matched.", "[0-9]+ is one or more digits; follow it with ms.", "grep -oE '[0-9]+ms' app.log"],
  })),
  t(["grep-o"], 2, () => ({
    title: "Source files",
    description: "Print just the source file name (like PaymentClient.java) from each stack-trace line of error.log.",
    files: ["error.log"],
    solution: "grep -oE '[A-Za-z]+\\.java' error.log",
    hints: ["-o prints only the matching part.", "[A-Za-z]+ is a word; \\. is a literal dot.", "grep -oE '[A-Za-z]+\\.java' error.log"],
  })),
  t(["grep-o", "top-n"], 3, (r, logs, run) => {
    const report = "grep -oE '[A-Za-z]+\\.java' error.log | sort | uniq -c | sort -rn";
    if (!clearTop(run(report), 1)) return null;
    return {
      title: "Most troubled file",
      description: "Which source file (like PaymentClient.java) shows up most often in error.log's stack traces? Show its count and name.",
      files: ["error.log"],
      solution: `${report} | head -n 1`,
      hints: ["Extract the file names with grep -o.", "Then sort | uniq -c | sort -rn | head -n 1.", `${report} | head -n 1`],
    };
  }),
];

// Placement test: each question needs several skills at once. Passing one
// grants every skill used (and what it builds on), so strong players skip ahead.
const PLACEMENT = [
  t(["grep-basic", "grep-count"], 1, (r, logs) => {
    const level = r.pick(presentLevels(logs));
    return {
      title: `How many ${level}s?`,
      description: `How many ${level} lines are in app.log? Print just the number.`,
      files: ["app.log", "access.log"],
      solution: `grep -c ${level} app.log`,
    };
  }),
  t(["grep-i", "grep-n"], 2, (r, logs) => {
    const words = mixedCaseWords(logs);
    if (!words.length) return null;
    const word = r.pick(words);
    return {
      title: "Case and place",
      description: `Show every line of app.log that mentions ${word} in any case, with its line number.`,
      files: ["app.log"],
      solution: `grep -in ${word} app.log`,
    };
  }),
  t(["grep-v", "grep-or"], 2, () => ({
    title: "Cut the noise",
    description: "Show every line of app.log that is neither INFO nor DEBUG.",
    files: ["app.log"],
    solution: "grep -vE 'INFO|DEBUG' app.log",
  })),
  t(["pipes", "head-tail"], 2, (r, logs, run) => {
    const level = r.pick(["ERROR", "WARN"]);
    const solution = `grep ${level} app.log | tail -n 2`;
    if (run(solution).length < 2) return null;
    return {
      title: `Latest ${level}s`,
      description: `Show only the 2 most recent ${level} lines in app.log.`,
      files: ["app.log"],
      solution,
    };
  }),
  t(["columns", "sort-uniq", "uniq-count"], 3, () => ({
    title: "Status report",
    description: "Count how many requests got each status code (column 5 of access.log).",
    files: ["access.log"],
    solution: "awk '{print $5}' access.log | sort | uniq -c",
  })),
  t(["awk-filter", "top-n"], 3, (r, logs, run) => {
    const report = "awk '$5 == 404 {print $2}' access.log | sort | uniq -c | sort -rn";
    if (!clearTop(run(report), 1)) return null;
    return {
      title: "Worst offender",
      description: "Which IP got the most 404 responses? Show its count and IP on one line.",
      files: ["access.log"],
      solution: `${report} | head -n 1`,
    };
  }),
  t(["grep-o", "regex-repeat", "regex-classes"], 3, () => ({
    title: "Just the numbers",
    description: "Print just the duration of each slow query in app.log (like 2300ms), one per line.",
    files: ["app.log"],
    solution: "grep -oE '[0-9]+ms' app.log",
  })),
];

// ---------- Building challenges ----------

function templatesFor(skill, difficulty) {
  const own = TEMPLATES.filter((tpl) => tpl.skills[0] === skill);
  const exact = own.filter((tpl) => tpl.difficulty === difficulty);
  if (exact.length) return exact;
  const easier = own.filter((tpl) => tpl.difficulty < difficulty);
  return easier.length ? easier : own;
}

// Try templates on fresh logs until one produces a sensible challenge.
function build(templates, seed, extra) {
  const r = makeRng(seed);
  for (let tries = 0; tries < 50; tries++) {
    const logs = generateLogs(r);
    const run = (cmd) => {
      const result = runCommandLine(cmd, logs);
      if (result.error) throw new Error(`Generator solution failed: ${cmd}: ${result.error}`);
      return result.output;
    };
    const template = r.pick(templates);
    const made = template.make(r, logs, run);
    if (!made) continue;
    const expected = run(made.solution);
    if (!expected.length || (expected.length === 1 && expected[0] === "0") || expected.length > 25) continue;

    const primary = SKILL_BY_ID[template.skills[0]];
    return {
      ...made,
      files: Object.fromEntries(made.files.map((name) => [name, logs[name]])),
      learn: primary.learn,
      skills: template.skills,
      difficulty: template.difficulty,
      expected,
      seed,
      ...extra,
    };
  }
  throw new Error(`Could not generate a challenge for ${templates[0].skills[0]} (seed ${seed})`);
}

/** A practice challenge for `skill` at `difficulty` (1-3). Same seed, same challenge. */
function generateChallenge(skill, difficulty, seed) {
  return build(templatesFor(skill, difficulty), seed, { skill });
}

/** Placement question number `step` (0-based). */
function generatePlacement(step, seed) {
  return build([PLACEMENT[step]], seed, { skill: PLACEMENT[step].skills[0], hints: [] });
}

const PLACEMENT_STEPS = PLACEMENT.length;

export { generateChallenge, generatePlacement, generateLogs, makeRng, PLACEMENT_STEPS, TEMPLATES };
