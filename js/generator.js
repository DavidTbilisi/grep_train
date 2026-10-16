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
const presentIps = (logs) => [...new Set(column(logs["access.log"], 2))];
const presentUsers = (logs) => USERS.filter((user) => logs["app.log"].includes(`User ${user} `));

// Words that appear in app.log in more than one case (so -i matters).
function mixedCaseWords(logs) {
  const text = logs["app.log"];
  return ["timeout", "database", "retrying", "connection", "cache"].filter(
    (word) => text.includes(word) && text.includes(capitalize(word))
  );
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

  // awk-sum
  t(["awk-sum"], 1, () => ({
    title: "Total traffic",
    description: "How many bytes did the server send in total? Bytes are column 6 of access.log. Print just the number.",
    files: ["access.log"],
    solution: "awk '{s += $6} END {print s}' access.log",
    hints: ["Add column 6 to a variable on every line: {s += $6}.", "Print it once, after the last line, in an END block.", "awk '{s += $6} END {print s}' access.log"],
  })),
  t(["awk-sum", "awk-filter"], 2, (r, logs) => {
    const status = r.pick(presentStatuses(logs));
    return {
      title: `Bytes for ${status}s`,
      description: `How many bytes did the responses with status ${status} add up to? Print just the number.`,
      files: ["access.log"],
      solution: `awk '$5 == ${status} {s += $6} END {print s}' access.log`,
      hints: ["Only add up the lines that match a condition.", `Put $5 == ${status} before the { s += $6 } part.`, `awk '$5 == ${status} {s += $6} END {print s}' access.log`],
    };
  }),
  t(["awk-sum", "awk-filter"], 3, () => ({
    title: "Time lost to slow queries",
    description: "What's the total time of all the slow queries in app.log, in ms? Print just the number. (awk reads 2300ms as the number 2300.)",
    files: ["app.log"],
    solution: "awk '/Slow query/ {s += $NF} END {print s}' app.log",
    hints: ["Match the slow-query lines with /Slow query/.", "The duration is the last field, $NF.", "awk '/Slow query/ {s += $NF} END {print s}' app.log"],
  })),

  // awk-stats
  t(["awk-stats"], 1, () => ({
    title: "Biggest response",
    description: "What's the largest response size in access.log (bytes, column 6)? Print just the number.",
    files: ["access.log"],
    solution: "awk '$6 > max {max = $6} END {print max}' access.log",
    hints: ["Keep the biggest value seen so far in a variable.", "$6 > max {max = $6}, then print max at the END.", "awk '$6 > max {max = $6} END {print max}' access.log"],
  })),
  t(["awk-stats", "awk-sum"], 2, () => ({
    title: "Average response",
    description: "What's the average response size in bytes (column 6)? Print it the way awk's print shows numbers (like 4153.12).",
    files: ["access.log"],
    solution: "awk '{s += $6} END {print s/NR}' access.log",
    hints: ["Average = total / number of lines.", "NR is the number of lines read so far; at the END, that's all of them.", "awk '{s += $6} END {print s/NR}' access.log"],
  })),
  t(["awk-stats", "awk-filter"], 3, () => ({
    title: "Average slow query",
    description: "What's the average duration of the slow queries in app.log, in ms, with exactly one decimal place (like 1234.5)?",
    files: ["app.log"],
    solution: "awk '/Slow query/ {s += $NF; n++} END {printf \"%.1f\\n\", s/n}' app.log",
    hints: ["Add up $NF and count the slow-query lines: {s += $NF; n++}.", "printf \"%.1f\\n\" prints one decimal place. Divide by n, not NR.", "awk '/Slow query/ {s += $NF; n++} END {printf \"%.1f\\n\", s/n}' app.log"],
  })),

  // awk-group
  t(["awk-group"], 1, () => ({
    title: "Bytes per IP",
    description: "How many bytes went to each IP address? Print each IP and its total, sorted by IP.",
    files: ["access.log"],
    solution: "awk '{b[$2] += $6} END {for (ip in b) print ip, b[ip]}' access.log | sort",
    hints: ["Use an array keyed by the IP: b[$2] += $6.", "At the END, loop with for (ip in b), then pipe into sort.", "awk '{b[$2] += $6} END {for (ip in b) print ip, b[ip]}' access.log | sort"],
  })),
  t(["awk-group", "pipes"], 2, () => ({
    title: "Heaviest paths",
    description: "Total bytes per path, biggest first: print the total, then the path.",
    files: ["access.log"],
    solution: "awk '{b[$4] += $6} END {for (p in b) print b[p], p}' access.log | sort -rn",
    hints: ["Key the array by the path, column 4.", "Print the total first so sort -rn can order by it.", "awk '{b[$4] += $6} END {for (p in b) print b[p], p}' access.log | sort -rn"],
  })),
  t(["awk-group", "awk-stats"], 3, () => ({
    title: "Average size per path",
    description: "What's the average response size for each path? Print each path and its average, sorted by path.",
    files: ["access.log"],
    solution: "awk '{s[$4] += $6; n[$4]++} END {for (p in s) print p, s[p]/n[p]}' access.log | sort",
    hints: ["Keep two arrays keyed by path: a total and a count.", "At the END, print s[p]/n[p] for each path, then sort.", "awk '{s[$4] += $6; n[$4]++} END {for (p in s) print p, s[p]/n[p]}' access.log | sort"],
  })),

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
  // ---------- Second templates for every skill and difficulty ----------

  // grep-basic
  t(["grep-basic"], 1, (r) => {
    const word = r.pick(["Cache", "Database", "User", "Session"]);
    return {
      title: `Lines about ${word}`,
      description: `Show every line of app.log that contains ${word} (with that exact capitalization).`,
      files: ["app.log"],
      solution: `grep ${word} app.log`,
      hints: ["grep PATTERN FILE.", `The pattern is ${word}.`, `grep ${word} app.log`],
    };
  }),
  t(["grep-basic"], 2, (r, logs) => {
    const ip = r.pick(presentIps(logs));
    return {
      title: "One visitor",
      description: `Show every request made by the IP address ${ip}.`,
      files: ["access.log"],
      solution: `grep ${ip} access.log`,
      hints: ["Search access.log for the IP.", `The pattern is ${ip}.`, `grep ${ip} access.log`],
    };
  }),
  t(["grep-basic"], 3, (r) => {
    const phrase = r.pick(["logged in", "logged out", "connection lost"]);
    return {
      title: `"${phrase}"`,
      description: `Show the lines of app.log that contain "${phrase}".`,
      files: ["app.log"],
      solution: `grep '${phrase}' app.log`,
      hints: ["The pattern has a space in it.", "Put it in quotes so it stays one argument.", `grep '${phrase}' app.log`],
    };
  }),

  // grep-i
  t(["grep-i"], 1, () => ({
    title: "Lowercase level",
    description: "A colleague typed the level as warn, in lowercase. Show the WARN lines of app.log anyway, searching for warn.",
    files: ["app.log"],
    solution: "grep -i warn app.log",
    hints: ["warn and WARN differ only in case.", "-i ignores case.", "grep -i warn app.log"],
  })),
  t(["grep-i", "grep-v"], 2, (r, logs) => {
    const words = mixedCaseWords(logs);
    if (!words.length) return null;
    const word = r.pick(words);
    return {
      title: `No ${word} at all`,
      description: `Show the lines of app.log that do NOT mention ${word}, in any case.`,
      files: ["app.log"],
      solution: `grep -iv ${word} app.log`,
      hints: ["Ignore case, and invert the match.", "-i and -v combine as -iv.", `grep -iv ${word} app.log`],
    };
  }),
  t(["grep-i", "grep-or"], 3, (r, logs) => {
    const words = mixedCaseWords(logs);
    if (words.length < 2) return null;
    const [a, b] = r.shuffle(words);
    return {
      title: "Either word, any case",
      description: `Show the lines of app.log that mention ${a} or ${b}, in any case.`,
      files: ["app.log"],
      solution: `grep -iE '${a}|${b}' app.log`,
      hints: ["One grep can match either word.", "Combine -i and -E, and quote the pattern.", `grep -iE '${a}|${b}' app.log`],
    };
  }),

  // grep-v
  t(["grep-v"], 1, () => ({
    title: "Not OK",
    description: "Show every request in access.log that did NOT get status 200.",
    files: ["access.log"],
    solution: "grep -v ' 200 ' access.log",
    hints: ["Invert the match.", "The status has a space on each side: ' 200 '.", "grep -v ' 200 ' access.log"],
  })),
  t(["grep-v"], 2, () => ({
    title: "Everything but GET",
    description: "Show the requests in access.log that are NOT GET requests.",
    files: ["access.log"],
    solution: "grep -v GET access.log",
    hints: ["You want the opposite of a GET search.", "-v inverts the match.", "grep -v GET access.log"],
  })),
  t(["grep-v", "pipes"], 3, () => ({
    title: "Other failures",
    description: "Show the requests that neither succeeded (200) nor were not found (404).",
    files: ["access.log"],
    solution: "grep -v ' 200 ' access.log | grep -v ' 404 '",
    hints: ["Remove the 200s, then the 404s.", "Pipe one grep -v into another.", "grep -v ' 200 ' access.log | grep -v ' 404 '"],
  })),

  // grep-count
  t(["grep-count"], 1, (r) => {
    const method = r.pick(["GET", "POST"]);
    return {
      title: `${method} requests`,
      description: `How many ${method} requests are in access.log? Print just the number.`,
      files: ["access.log"],
      solution: `grep -c ${method} access.log`,
      hints: ["Count the matching lines.", "-c means count.", `grep -c ${method} access.log`],
    };
  }),
  t(["grep-count"], 2, (r, logs) => {
    const ip = r.pick(presentIps(logs));
    return {
      title: "Requests per visitor",
      description: `How many requests did ${ip} make? Print just the number.`,
      files: ["access.log"],
      solution: `grep -c ${ip} access.log`,
      hints: ["Count the lines containing that IP.", "-c counts matching lines.", `grep -c ${ip} access.log`],
    };
  }),
  t(["grep-count"], 3, () => ({
    title: "Login attempts",
    description: "How many login attempts (POST /login) are in access.log? Print just the number.",
    files: ["access.log"],
    solution: "grep -c 'POST /login' access.log",
    hints: ["Search for the method and path together.", "Quote the pattern because of the space; -c counts.", "grep -c 'POST /login' access.log"],
  })),

  // grep-n
  t(["grep-n"], 1, (r, logs) => {
    const users = presentUsers(logs);
    if (!users.length) return null;
    const user = r.pick(users);
    return {
      title: `Where is ${user}?`,
      description: `Show the lines of app.log that mention ${user}, with their line numbers.`,
      files: ["app.log"],
      solution: `grep -n ${user} app.log`,
      hints: ["Search for the name.", "-n adds line numbers.", `grep -n ${user} app.log`],
    };
  }),
  t(["grep-n"], 2, () => ({
    title: "Server errors, by line",
    description: "Show the requests with status 500, with their line numbers.",
    files: ["access.log"],
    solution: "grep -n ' 500 ' access.log",
    hints: ["Search for the status, with a space on each side.", "-n adds line numbers.", "grep -n ' 500 ' access.log"],
  })),
  t(["grep-n", "grep-or"], 3, () => ({
    title: "Problems, by line",
    description: "Show every ERROR or WARN line of app.log, with its line number, using one grep.",
    files: ["app.log"],
    solution: "grep -nE 'ERROR|WARN' app.log",
    hints: ["Match either level with -E.", "Add -n: -nE.", "grep -nE 'ERROR|WARN' app.log"],
  })),

  // grep-or
  t(["grep-or"], 1, (r, logs) => {
    const users = presentUsers(logs);
    if (users.length < 2) return null;
    const [a, b] = r.shuffle(users);
    return {
      title: `${capitalize(a)} or ${b}`,
      description: `Show the lines of app.log that mention ${a} or ${b}.`,
      files: ["app.log"],
      solution: `grep -E '${a}|${b}' app.log`,
      hints: ["Use -E for either/or.", "A|B, in quotes.", `grep -E '${a}|${b}' app.log`],
    };
  }),
  t(["grep-or"], 2, (r, logs) => {
    const [a, b] = r.shuffle(presentPaths(logs));
    if (!b) return null;
    return {
      title: "Two pages",
      description: `Show the requests for ${a} or ${b}.`,
      files: ["access.log"],
      solution: `grep -E '${a}|${b}' access.log`,
      hints: ["One grep can match either path.", "Use -E and A|B, in quotes.", `grep -E '${a}|${b}' access.log`],
    };
  }),
  t(["grep-or", "grep-v"], 3, () => ({
    title: "Only the problems",
    description: "With a single grep, show the lines of app.log that are neither INFO nor DEBUG.",
    files: ["app.log"],
    solution: "grep -vE 'INFO|DEBUG' app.log",
    hints: ["Match INFO or DEBUG, then invert.", "-v and -E combine as -vE.", "grep -vE 'INFO|DEBUG' app.log"],
  })),

  // head-tail
  t(["head-tail"], 1, (r) => {
    const n = r.int(2, 5);
    return {
      title: `The last ${n}`,
      description: `Show only the last ${n} lines of app.log.`,
      files: ["app.log"],
      solution: `tail -n ${n} app.log`,
      hints: ["Use the tail tool.", "-n sets how many lines.", `tail -n ${n} app.log`],
    };
  }),
  t(["head-tail"], 2, () => ({
    title: "First visitor",
    description: "When did the first request arrive? Show just the first line of access.log.",
    files: ["access.log"],
    solution: "head -n 1 access.log",
    hints: ["The oldest entry is at the top.", "head -n 1 keeps one line.", "head -n 1 access.log"],
  })),
  t(["head-tail", "pipes"], 3, (r) => {
    const k = r.int(2, 6);
    return {
      title: `${k} from the end`,
      description: `Show only the line that is ${k}th from the end of app.log.`,
      files: ["app.log"],
      solution: `tail -n ${k} app.log | head -n 1`,
      hints: [`Take the last ${k} lines...`, "...then keep only the first of those.", `tail -n ${k} app.log | head -n 1`],
    };
  }),

  // wc
  t(["wc"], 1, () => ({
    title: "How long is the error log?",
    description: "How many lines are in error.log, stack traces included?",
    files: ["error.log"],
    solution: "wc -l error.log",
    hints: ["wc counts.", "-l counts lines.", "wc -l error.log"],
  })),
  t(["wc", "pipes"], 2, () => ({
    title: "Just the number",
    description: "Count the lines of access.log so that only the number is printed (no file name): pipe cat into wc -l.",
    files: ["access.log"],
    solution: "cat access.log | wc -l",
    hints: ["wc -l FILE prints the name too.", "Fed from a pipe, wc only prints the number.", "cat access.log | wc -l"],
  })),
  t(["wc", "head-tail", "pipes"], 3, (r) => {
    const n = r.int(3, 6);
    return {
      title: "Words up top",
      description: `How many words are in the first ${n} lines of access.log?`,
      files: ["access.log"],
      solution: `head -n ${n} access.log | wc -w`,
      hints: [`Take the first ${n} lines.`, "wc -w counts words.", `head -n ${n} access.log | wc -w`],
    };
  }),

  // pipes
  t(["pipes"], 1, (r, logs) => {
    const ip = r.pick(presentIps(logs));
    return {
      title: "Count with a pipe",
      description: `Count the requests from ${ip} by piping grep into wc -l.`,
      files: ["access.log"],
      solution: `grep ${ip} access.log | wc -l`,
      hints: ["grep the IP first.", "Then | wc -l.", `grep ${ip} access.log | wc -l`],
    };
  }),
  t(["pipes", "head-tail"], 2, (r, logs) => {
    const ip = r.pick(presentIps(logs));
    return {
      title: "Last seen",
      description: `Show only the most recent request from ${ip}.`,
      files: ["access.log"],
      solution: `grep ${ip} access.log | tail -n 1`,
      hints: ["Find that IP's requests.", "The most recent is at the bottom: tail.", `grep ${ip} access.log | tail -n 1`],
    };
  }),
  t(["pipes", "grep-count"], 3, () => ({
    title: "Timeouts among errors",
    description: "How many ERROR lines in app.log mention a timeout (Timeout or timeout)? Print just the number.",
    files: ["app.log"],
    solution: "grep ERROR app.log | grep -ci timeout",
    hints: ["Keep the ERROR lines first.", "Then count, ignoring case: grep -ci.", "grep ERROR app.log | grep -ci timeout"],
  })),

  // columns
  t(["columns"], 1, (r) => {
    const n = r.pick(Object.keys(COLUMNS));
    return {
      title: "Pick a column with cut",
      description: `Print only the ${COLUMNS[n]} of each request, using cut. Columns are separated by single spaces: time ip method path status bytes.`,
      files: ["access.log"],
      solution: `cut -d' ' -f${n} access.log`,
      hints: ["cut -d sets the separator, -f the field number.", `The ${COLUMNS[n]} is field ${n}.`, `cut -d' ' -f${n} access.log`],
    };
  }),
  t(["columns"], 2, () => ({
    title: "Last words",
    description: "Print the last word of every line in app.log.",
    files: ["app.log"],
    solution: "awk '{print $NF}' app.log",
    hints: ["Lines have different numbers of words.", "$NF is always the last field.", "awk '{print $NF}' app.log"],
  })),
  t(["columns", "pipes"], 3, (r, logs) => {
    const status = r.pick(presentStatuses(logs).filter((s) => s !== "200"));
    return {
      title: `Who and what got ${status}`,
      description: `For every request with status ${status}, print the IP and the path, separated by a space. Use cut.`,
      files: ["access.log"],
      solution: `grep ' ${status} ' access.log | cut -d' ' -f2,4`,
      hints: [`Keep the ${status} lines first.`, "cut -f2,4 picks fields 2 and 4.", `grep ' ${status} ' access.log | cut -d' ' -f2,4`],
    };
  }),

  // sort-uniq
  t(["sort-uniq"], 1, () => ({
    title: "Which methods?",
    description: "List each HTTP method used in access.log once, sorted. (Column 3.)",
    files: ["access.log"],
    solution: "awk '{print $3}' access.log | sort -u",
    hints: ["Print column 3.", "sort -u sorts and drops repeats in one go.", "awk '{print $3}' access.log | sort -u"],
  })),
  t(["sort-uniq"], 2, () => ({
    title: "Who was around?",
    description: "List each user who logged in or out, once each, sorted. (In 'User alice logged in', the name is column 5.)",
    files: ["app.log"],
    solution: "awk '/User/ {print $5}' app.log | sort | uniq",
    hints: ["Only the User lines, column 5.", "Then sort | uniq.", "awk '/User/ {print $5}' app.log | sort | uniq"],
  })),
  t(["sort-uniq", "grep-v"], 3, () => ({
    title: "Paths with problems",
    description: "Which paths had at least one request that did NOT get status 200? List each once, sorted.",
    files: ["access.log"],
    solution: "grep -v ' 200 ' access.log | awk '{print $4}' | sort -u",
    hints: ["Drop the 200 lines.", "Print the path, then sort -u.", "grep -v ' 200 ' access.log | awk '{print $4}' | sort -u"],
  })),

  // uniq-count
  t(["uniq-count"], 1, () => ({
    title: "Logins per user",
    description: "How many times did each user log in? (In 'User alice logged in', the name is column 5.)",
    files: ["app.log"],
    solution: "awk '/logged in/ {print $5}' app.log | sort | uniq -c",
    hints: ["Print the name from the 'logged in' lines.", "sort, then uniq -c.", "awk '/logged in/ {print $5}' app.log | sort | uniq -c"],
  })),
  t(["uniq-count", "columns"], 2, () => ({
    title: "Error histogram",
    description: "Count each distinct ERROR message in app.log. (cut -d' ' -f4- keeps everything from the 4th field on.)",
    files: ["app.log"],
    solution: "grep ERROR app.log | cut -d' ' -f4- | sort | uniq -c",
    hints: ["Keep the ERROR lines and cut away the date, time, and level.", "Then sort | uniq -c.", "grep ERROR app.log | cut -d' ' -f4- | sort | uniq -c"],
  })),
  t(["uniq-count", "awk-filter"], 3, () => ({
    title: "Failures by status",
    description: "Count the failed requests (status other than 200) by status code.",
    files: ["access.log"],
    solution: "awk '$5 != 200 {print $5}' access.log | sort | uniq -c",
    hints: ["awk can filter and print the status at once.", "$5 != 200 {print $5}, then sort | uniq -c.", "awk '$5 != 200 {print $5}' access.log | sort | uniq -c"],
  })),

  // awk-filter
  t(["awk-filter"], 1, (r) => {
    const method = r.pick(["GET", "POST"]);
    return {
      title: `${method} with awk`,
      description: `Using awk, show every ${method} request (the method is column 3).`,
      files: ["access.log"],
      solution: `awk '$3 == "${method}"' access.log`,
      hints: ["awk 'CONDITION' prints the matching lines.", `Compare text in quotes: $3 == "${method}".`, `awk '$3 == "${method}"' access.log`],
    };
  }),
  t(["awk-filter", "columns"], 3, () => ({
    title: "When things went wrong",
    description: "Print the time and level of every ERROR or WARN line in app.log (time is column 2, level column 3).",
    files: ["app.log"],
    solution: "awk '$3 == \"ERROR\" || $3 == \"WARN\" {print $2, $3}' app.log",
    hints: ["Combine two conditions with ||.", "Then {print $2, $3}.", "awk '$3 == \"ERROR\" || $3 == \"WARN\" {print $2, $3}' app.log"],
  })),

  // top-n
  t(["top-n"], 1, (r, logs, run) => {
    const report = "awk '{print $5}' access.log | sort | uniq -c | sort -rn";
    if (!clearTop(run(report), 1)) return null;
    return {
      title: "Most common status",
      description: "Which status code is the most common? Show its count and the code.",
      files: ["access.log"],
      solution: `${report} | head -n 1`,
      hints: ["Count each status (column 5) with uniq -c.", "sort -rn, then head -n 1.", `${report} | head -n 1`],
    };
  }),
  t(["top-n"], 2, (r, logs, run) => {
    const k = r.int(2, 3);
    const report = "awk '{print $2}' access.log | sort | uniq -c | sort -rn";
    if (!clearTop(run(report), k)) return null;
    return {
      title: `Top ${k} visitors`,
      description: `Show the ${k} IPs with the most requests, with their counts, busiest first.`,
      files: ["access.log"],
      solution: `${report} | head -n ${k}`,
      hints: ["Count requests per IP (column 2).", `sort -rn, then head -n ${k}.`, `${report} | head -n ${k}`],
    };
  }),

  // awk-sum
  t(["awk-sum"], 1, () => ({
    title: "Count with awk",
    description: "Count the lines of access.log with awk: add 1 on every line, and print the count at the END.",
    files: ["access.log"],
    solution: "awk '{n++} END {print n}' access.log",
    hints: ["n++ adds 1 to n.", "Print n once, in an END block.", "awk '{n++} END {print n}' access.log"],
  })),
  t(["awk-sum", "awk-filter"], 2, (r, logs) => {
    const ip = r.pick(presentIps(logs));
    return {
      title: "One visitor's traffic",
      description: `How many bytes (column 6) did ${ip} receive in total? Print just the number.`,
      files: ["access.log"],
      solution: `awk '$2 == "${ip}" {s += $6} END {print s}' access.log`,
      hints: ["Only add up that IP's lines.", `$2 == "${ip}" {s += $6}, then print s at the END.`, `awk '$2 == "${ip}" {s += $6} END {print s}' access.log`],
    };
  }),
  t(["awk-sum", "awk-filter"], 3, () => ({
    title: "Bytes of failures",
    description: "How many bytes did the failed responses (status 400 and up) add up to? Print just the number.",
    files: ["access.log"],
    solution: "awk '$5 >= 400 {s += $6} END {print s}' access.log",
    hints: ["awk compares numbers: $5 >= 400.", "Add up $6 for those lines; print at the END.", "awk '$5 >= 400 {s += $6} END {print s}' access.log"],
  })),

  // awk-stats
  t(["awk-stats"], 1, () => ({
    title: "Smallest response",
    description: "What's the smallest response size in access.log (bytes, column 6)? Print just the number.",
    files: ["access.log"],
    solution: "awk 'NR == 1 || $6 < min {min = $6} END {print min}' access.log",
    hints: ["Keep the smallest value seen so far.", "Start from the first line: NR == 1 || $6 < min {min = $6}.", "awk 'NR == 1 || $6 < min {min = $6} END {print min}' access.log"],
  })),
  t(["awk-stats", "awk-filter"], 2, () => ({
    title: "Average success",
    description: "What's the average size of the successful (status 200) responses? Print it the way awk's print shows numbers.",
    files: ["access.log"],
    solution: "awk '$5 == 200 {s += $6; n++} END {print s/n}' access.log",
    hints: ["Add up and count only the 200 lines.", "Divide by n, not NR.", "awk '$5 == 200 {s += $6; n++} END {print s/n}' access.log"],
  })),
  t(["awk-stats", "awk-filter"], 3, (r, logs) => {
    const ip = r.pick(presentIps(logs));
    return {
      title: "Average per visit",
      description: `What's the average response size for ${ip}, with exactly one decimal place?`,
      files: ["access.log"],
      solution: `awk '$2 == "${ip}" {s += $6; n++} END {printf "%.1f\\n", s/n}' access.log`,
      hints: ["Add up and count that IP's lines.", 'printf "%.1f\\n" prints one decimal place.', `awk '$2 == "${ip}" {s += $6; n++} END {printf "%.1f\\n", s/n}' access.log`],
    };
  }),

  // awk-group
  t(["awk-group"], 1, () => ({
    title: "Status counts, awk style",
    description: "Count the requests per status code with an awk array. Print each code and its count, sorted.",
    files: ["access.log"],
    solution: "awk '{n[$5]++} END {for (s in n) print s, n[s]}' access.log | sort",
    hints: ["n[$5]++ counts per status.", "Print each key and count at the END, then sort.", "awk '{n[$5]++} END {for (s in n) print s, n[s]}' access.log | sort"],
  })),
  t(["awk-group", "pipes"], 2, () => ({
    title: "Bytes per method",
    description: "Total bytes per HTTP method, biggest first: print the total, then the method.",
    files: ["access.log"],
    solution: "awk '{b[$3] += $6} END {for (m in b) print b[m], m}' access.log | sort -rn",
    hints: ["Key the array by the method, column 3.", "Print the total first, then sort -rn.", "awk '{b[$3] += $6} END {for (m in b) print b[m], m}' access.log | sort -rn"],
  })),
  t(["awk-group", "top-n"], 3, (r, logs, run) => {
    const report = "awk '$5 != 200 {n[$2]++} END {for (ip in n) print n[ip], ip}' access.log | sort -rn";
    if (!clearTop(run(report), 1)) return null;
    return {
      title: "Most failures",
      description: "Which IP had the most failed requests (status other than 200)? Show the count and the IP, using an awk array.",
      files: ["access.log"],
      solution: `${report} | head -n 1`,
      hints: ["$5 != 200 {n[$2]++} counts failures per IP.", "Print count and IP, then sort -rn | head -n 1.", `${report} | head -n 1`],
    };
  }),

  // regex-anchors
  t(["regex-anchors"], 1, () => ({
    title: "Stack traces only",
    description: "Show only the stack-trace lines of error.log. They start with a space.",
    files: ["error.log"],
    solution: "grep '^ ' error.log",
    hints: ["^ matches the start of a line.", "'^ ' is a line that starts with a space.", "grep '^ ' error.log"],
  })),
  t(["regex-anchors", "grep-count"], 2, () => ({
    title: "How many entries?",
    description: "How many error entries does error.log have? Each one is a line that starts with the date (20...). Print just the number.",
    files: ["error.log"],
    solution: "grep -c '^20' error.log",
    hints: ["Anchor the pattern to the start of the line.", "'^20' plus -c.", "grep -c '^20' error.log"],
  })),
  t(["regex-anchors", "regex-classes"], 3, (r, logs) => {
    if (!presentIps(logs).some((ip) => ip.startsWith("10."))) return null;
    return {
      title: "The 10.x network",
      description: "Show the requests from IPs that start with 10. The IP comes right after the time, so anchor the pattern at the start of the line.",
      files: ["access.log"],
      solution: "grep '^[0-9:]* 10\\.' access.log",
      hints: ["^[0-9:]* matches the time at the start of the line.", "Then a space and 10\\. (a literal dot).", "grep '^[0-9:]* 10\\.' access.log"],
    };
  }),

  // regex-classes
  t(["regex-classes"], 1, (r, logs, run) => {
    if (!run("grep 'report-' app.log").length) return null;
    return {
      title: "Early reports",
      description: "Show the job lines for reports 1 to 5 (Job report-1 ... Job report-5).",
      files: ["app.log"],
      solution: "grep 'report-[1-5]' app.log",
      hints: ["[1-5] matches one digit from 1 to 5.", "Put it right after report-.", "grep 'report-[1-5]' app.log"],
    };
  }),
  t(["regex-classes"], 2, () => ({
    title: "Two-digit line numbers",
    description: "Show the stack-trace lines whose line number has exactly two digits (like PaymentClient.java:88).",
    files: ["error.log"],
    solution: "grep 'java:[1-9][0-9])' error.log",
    hints: ["Two digits, then the closing parenthesis.", "[1-9][0-9] is 10 to 99.", "grep 'java:[1-9][0-9])' error.log"],
  })),
  t(["regex-classes", "grep-count"], 3, () => ({
    title: "Not alice",
    description: "How many 'User ...' lines are about someone whose name does NOT start with a? Print just the number.",
    files: ["app.log"],
    solution: "grep -c 'User [^a]' app.log",
    hints: ["[^a] matches any character except a.", "Count with -c.", "grep -c 'User [^a]' app.log"],
  })),

  // grep-w
  t(["grep-w"], 1, (r, logs, run) => {
    if (run("grep at error.log").length === run("grep -w at error.log").length) return null;
    return {
      title: "The word at",
      description: "Show the lines of error.log that contain the word at on its own (not inside Database or Notification).",
      files: ["error.log"],
      solution: "grep -w at error.log",
      hints: ["grep at also matches inside longer words.", "-w matches whole words only.", "grep -w at error.log"],
    };
  }),
  t(["grep-w", "grep-count"], 2, (r, logs, run) => {
    if (run("grep -c in app.log")[0] === run("grep -wc in app.log")[0]) return null;
    return {
      title: "Count the word in",
      description: "How many lines of app.log contain the word in on its own? Print just the number.",
      files: ["app.log"],
      solution: "grep -wc in app.log",
      hints: ["Whole words only, and count.", "-w and -c combine as -wc.", "grep -wc in app.log"],
    };
  }),
  t(["grep-w", "pipes"], 3, (r, logs, run) => {
    if (run("grep -w in app.log").length === run("grep in app.log").length) return null;
    return {
      title: "Logins via the word in",
      description: "Using the whole word in, show the lines where a user logged in, and only the ones about users (lines that also contain User).",
      files: ["app.log"],
      solution: "grep -w in app.log | grep User",
      hints: ["First the lines with the word in.", "Then keep the ones with User.", "grep -w in app.log | grep User"],
    };
  }),

  // regex-repeat
  t(["regex-repeat", "regex-anchors"], 1, () => ({
    title: "Indented at",
    description: "Show the stack-trace lines: one or more spaces at the start of the line, then at.",
    files: ["error.log"],
    solution: "grep -E '^ +at' error.log",
    hints: ["With -E, + means one or more.", "^ + is one or more spaces at the start.", "grep -E '^ +at' error.log"],
  })),
  t(["regex-repeat", "grep-count"], 2, () => ({
    title: "Two-digit frames",
    description: "How many stack frames point at a two-digit line number (like :88)? Print just the number.",
    files: ["error.log"],
    solution: "grep -cE 'java:[0-9]{2}\\)' error.log",
    hints: ["{2} means exactly two.", "End with \\) so three-digit numbers don't match.", "grep -cE 'java:[0-9]{2}\\)' error.log"],
  })),
  t(["regex-repeat", "regex-classes"], 3, () => ({
    title: "Under a second",
    description: "Show the slow queries that took less than 1000ms: exactly three digits after took.",
    files: ["app.log"],
    solution: "grep -E 'took [0-9]{3}ms' app.log",
    hints: ["[0-9]{3} is exactly three digits.", "Put took before it and ms after.", "grep -E 'took [0-9]{3}ms' app.log"],
  })),

  // grep-o
  t(["grep-o"], 1, (r, logs, run) => {
    if (!run("grep '%' app.log").length) return null;
    return {
      title: "Just the percentages",
      description: "Print just the memory usage percentages from app.log (like 91%), one per line.",
      files: ["app.log"],
      solution: "grep -oE '[0-9]+%' app.log",
      hints: ["-o prints only the matching part.", "[0-9]+ then %.", "grep -oE '[0-9]+%' app.log"],
    };
  }),
  t(["grep-o"], 2, () => ({
    title: "Just the users",
    description: "Print just 'User name' (like User alice) from every line of app.log that has one.",
    files: ["app.log"],
    solution: "grep -oE 'User [a-z]+' app.log",
    hints: ["-o prints only the match.", "User, a space, then [a-z]+.", "grep -oE 'User [a-z]+' app.log"],
  })),
  t(["grep-o", "top-n"], 3, () => ({
    title: "The slowest query",
    description: "What was the slowest query in app.log? Print just its duration (like 2300ms).",
    files: ["app.log"],
    solution: "grep -oE '[0-9]+ms' app.log | sort -n | tail -n 1",
    hints: ["Extract the durations with grep -o.", "sort -n, then the last one.", "grep -oE '[0-9]+ms' app.log | sort -n | tail -n 1"],
  })),
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
  t(["awk-group", "awk-sum"], 3, () => ({
    title: "Traffic per IP",
    description: "How many bytes went to each IP address? Print each IP and its total, sorted by IP.",
    files: ["access.log"],
    solution: "awk '{b[$2] += $6} END {for (ip in b) print ip, b[ip]}' access.log | sort",
  })),
  t(["grep-o", "regex-repeat", "regex-classes"], 3, () => ({
    title: "Just the numbers",
    description: "Print just the duration of each slow query in app.log (like 2300ms), one per line.",
    files: ["app.log"],
    solution: "grep -oE '[0-9]+ms' app.log",
  })),
];

// ---------- Building challenges ----------

// Each template's id is its index, so the engine can avoid repeating one.
TEMPLATES.forEach((template, id) => {
  template.id = id;
});

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
      template: template.id,
      expected,
      seed,
      ...extra,
    };
  }
  throw new Error(`Could not generate a challenge for ${templates[0].skills[0]} (seed ${seed})`);
}

/**
 * A practice challenge for `skill` at `difficulty` (1-3). Same seed, same
 * challenge. `avoid` is a template id not to use (the previous challenge's),
 * unless it's the only one.
 */
function generateChallenge(skill, difficulty, seed, avoid = null) {
  const templates = templatesFor(skill, difficulty);
  const fresh = templates.filter((template) => template.id !== avoid);
  return build(fresh.length ? fresh : templates, seed, { skill });
}

/** A challenge from one specific template (for tests). */
function generateFromTemplate(id, seed) {
  return build([TEMPLATES[id]], seed, { skill: TEMPLATES[id].skills[0] });
}

/** Placement question number `step` (0-based). */
function generatePlacement(step, seed) {
  return build([PLACEMENT[step]], seed, { skill: PLACEMENT[step].skills[0], hints: [] });
}

const PLACEMENT_STEPS = PLACEMENT.length;

export { generateChallenge, generateFromTemplate, generatePlacement, generateLogs, makeRng, PLACEMENT_STEPS, TEMPLATES };

// Building blocks for the incident scenarios (incidents.js).
export { pad, clock, bytesFor, clearTop, IPS, APP_MESSAGES, TRACES };
