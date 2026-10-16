// Incidents - multi-step investigations of a generated outage. Pure (no DOM).
//
// Each scenario builds its logs from a seed (normal traffic with an incident
// injected) and knows the facts behind it: the attacker's IP, when the
// slowdown began, and so on. Each step is an ordinary write challenge whose
// expected output is computed by running its solution, so any command that
// prints the same thing passes. Later steps build on what earlier steps found.

import { runCommandLine } from "./shell.js";
import { SKILL_BY_ID } from "./skills.js";
import { makeRng, pad, clock, bytesFor, clearTop, IPS, APP_MESSAGES, TRACES } from "./generator.js";

// ---------- Log building blocks ----------

// Everyday traffic: no admin pages, no checkouts, nothing failing badly.
const CALM_ROUTES = [
  ["GET", "/index.html", 5120, 4],
  ["GET", "/products", 8800, 3],
  ["GET", "/cart", 3100, 2],
  ["GET", "/dashboard", 6400, 2],
  ["GET", "/login", 1840, 2],
  ["GET", "/api/orders", 2700, 2],
].flatMap(([method, path, base, weight]) => Array(weight).fill({ method, path, base }));

const startTime = (r) => r.int(8, 15) * 3600 + r.int(0, 59) * 60;
const someDate = (r) => `2024-${pad(r.int(1, 12))}-${pad(r.int(1, 28))}`;

function calmTraffic(r, ips, count, time) {
  const events = [];
  for (let i = 0; i < count; i++) {
    time += r.int(1, 6);
    const route = r.pick(CALM_ROUTES);
    events.push({ time, ip: r.pick(ips), method: route.method, path: route.path, status: 200, bytes: bytesFor(r, route.base) });
  }
  return events;
}

// Sort by time (stable, so same-second events keep their order) and print.
function accessLog(events) {
  return (
    [...events]
      .sort((a, b) => a.time - b.time)
      .map((e) => `${clock(e.time)} ${e.ip} ${e.method} ${e.path} ${e.status} ${e.bytes}`)
      .join("\n") + "\n"
  );
}

function appLog(date, entries) {
  return (
    [...entries]
      .sort((a, b) => a.time - b.time)
      .map((e) => `${date} ${clock(e.time)} ${e.level} ${e.message}`)
      .join("\n") + "\n"
  );
}

const calmMessage = (r) => {
  const level = r.pick(["INFO", "INFO", "INFO", "DEBUG"]);
  return { level, message: r.pick(APP_MESSAGES[level])(r) };
};

const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0]);

// ---------- Scenarios ----------

const step = (skills, title, make) => ({ skills, title, make });

const SCENARIOS = [
  {
    id: "break-in",
    title: "Break-in attempt",
    teaser: "A burst of failed logins. Did someone get in?",
    intro: "09:00, Monday. Customers say they can't log in, and the security dashboard shows a burst of failed logins. You have the web server's access.log. Find out what happened.",
    build(r) {
      const [attacker, ...others] = r.shuffle(IPS);
      const regulars = others.slice(0, 3);
      const events = calmTraffic(r, regulars, r.int(18, 24), startTime(r));
      // A few honest typos.
      for (let i = 0, n = r.int(1, 3); i < n; i++) {
        events.push({ time: r.pick(events).time, ip: r.pick(regulars), method: "POST", path: "/login", status: 401, bytes: bytesFor(r, 230) });
      }
      let time = events[r.int(3, 8)].time + 1;
      const start = time;
      const tries = r.int(6, 9);
      for (let i = 0; i < tries; i++) {
        events.push({ time, ip: attacker, method: "POST", path: "/login", status: 401, bytes: bytesFor(r, 230) });
        time += r.int(1, 3);
      }
      const breakIn = time;
      events.push({ time, ip: attacker, method: "POST", path: "/login", status: 200, bytes: bytesFor(r, 950) });
      const loot = r.shuffle(["/admin", "/admin/users", "/admin/export"]).slice(0, r.int(2, 3));
      for (const path of loot) {
        time += r.int(2, 5);
        events.push({ time, ip: attacker, method: "GET", path, status: 200, bytes: bytesFor(r, 6000) });
      }
      return {
        files: { "access.log": accessLog(events) },
        facts: { attacker, tries, start: clock(start), breakIn: clock(breakIn), loot: loot.sort() },
      };
    },
    check: (facts, run) => clearTop(run("awk '$5 == 401 {print $2}' access.log | sort | uniq -c | sort -rn"), 1),
    steps: [
      step(["grep-count"], "Failed logins", () => ({
        question: "How many login attempts failed (status 401)? Print just the number.",
        solution: "grep -c ' 401 ' access.log",
        hints: ["Count the lines with status 401.", "grep -c counts matching lines.", "grep -c ' 401 ' access.log"],
        note: (out) => `${out[0]} failed logins in total.`,
      })),
      step(["awk-filter", "top-n"], "Who's behind it?", () => ({
        question: "Which IP has the most failed logins? Show the count and the IP.",
        solution: "awk '$5 == 401 {print $2}' access.log | sort | uniq -c | sort -rn | head -n 1",
        hints: ["Print the IP of every 401 line.", "Then sort | uniq -c | sort -rn | head -n 1.", "awk '$5 == 401 {print $2}' access.log | sort | uniq -c | sort -rn | head -n 1"],
        note: (out) => {
          const [count, ip] = out[0].trim().split(/\s+/);
          return `Most failures come from ${ip} (${count}).`;
        },
      })),
      step(["pipes", "head-tail"], "When did it start?", (f) => ({
        question: `Show the very first request ${f.attacker} made.`,
        solution: `grep ${f.attacker} access.log | head -n 1`,
        hints: ["Find that IP's lines first.", "Keep only the first one with head.", `grep ${f.attacker} access.log | head -n 1`],
        note: () => `The attack started at ${f.start}.`,
      })),
      step(["pipes"], "Did they get in?", (f) => ({
        question: `Show the requests from ${f.attacker} that succeeded (status 200).`,
        solution: `grep ${f.attacker} access.log | grep ' 200 '`,
        hints: ["Start from that IP's lines.", "Pipe them into a second grep for ' 200 '.", `grep ${f.attacker} access.log | grep ' 200 '`],
        note: () => `They got in: a successful login at ${f.breakIn}.`,
      })),
      step(["columns", "sort-uniq"], "What did they open?", (f) => ({
        question: `Which paths did ${f.attacker} open successfully? List each path once, sorted.`,
        solution: `grep ${f.attacker} access.log | grep ' 200 ' | awk '{print $4}' | sort -u`,
        hints: ["Take the previous step's lines.", "Print the path (column 4), then sort -u.", `grep ${f.attacker} access.log | grep ' 200 ' | awk '{print $4}' | sort -u`],
        note: () => `Once in, they opened ${list(f.loot)}.`,
      })),
    ],
    outro: (f) =>
      `${f.attacker} tried ${f.tries} passwords from ${f.start}, got in at ${f.breakIn}, and opened ${list(f.loot)}. Next: block the IP, reset the account's password, and find out what those admin pages exposed.`,
  },

  {
    id: "slow-checkout",
    title: "The slow checkout",
    teaser: "Checkout keeps failing. Is the database to blame?",
    intro: "14:00. Sales dropped off a cliff: the checkout page keeps failing. You have the application's app.log and the web server's access.log. Find out why.",
    build(r) {
      const date = someDate(r);
      let time = startTime(r);
      const entries = [];
      const calm = (n) => {
        for (let i = 0; i < n; i++) {
          time += r.int(2, 9);
          entries.push({ time, ...calmMessage(r) });
        }
      };
      calm(r.int(5, 8));
      const start = time + 1;
      const durations = r.shuffle([r.int(900, 1900), r.int(2000, 2900), r.int(3000, 3900), r.int(4000, 4900), r.int(5000, 6400), r.int(1000, 3000), r.int(1000, 3000)]).slice(0, r.int(5, 7));
      for (const ms of durations) {
        time += r.int(1, 6);
        entries.push({ time, level: "WARN", message: `Slow query took ${ms}ms` });
        if (r.next() < 0.4) entries.push({ time: time + 1, level: "ERROR", message: "Timeout calling payment service" });
      }
      const end = time;
      entries.push({ time: time + 3, level: "INFO", message: "Database connection established" });
      time += 3;
      calm(r.int(3, 5));

      // Checkouts succeed before and after the slowdown, and fail during it.
      const regulars = r.shuffle(IPS).slice(0, 4);
      const events = calmTraffic(r, regulars, r.int(14, 18), start - 40);
      const failed = r.int(3, 5);
      for (let i = 0; i < failed; i++) {
        events.push({ time: r.int(start, end), ip: r.pick(regulars), method: "POST", path: "/checkout", status: 500, bytes: bytesFor(r, 120) });
      }
      for (let i = 0, n = r.int(2, 3); i < n; i++) {
        const when = r.next() < 0.5 ? r.int(start - 40, start - 1) : r.int(end + 1, end + 40);
        events.push({ time: when, ip: r.pick(regulars), method: "POST", path: "/checkout", status: 200, bytes: bytesFor(r, 760) });
      }
      const sorted = [...durations].sort((a, b) => b - a);
      if (sorted[0] === sorted[1]) return {};
      const average = durations.reduce((a, b) => a + b, 0) / durations.length;
      return {
        files: { "app.log": appLog(date, entries), "access.log": accessLog(events) },
        facts: { start: clock(start), count: durations.length, slowest: `${sorted[0]}ms`, average, failed },
      };
    },
    steps: [
      step(["grep-count"], "How bad is it?", () => ({
        question: "How many slow queries are logged in app.log? Print just the number.",
        solution: "grep -c 'Slow query' app.log",
        hints: ["Each slow query has its own line.", "Count lines containing 'Slow query'.", "grep -c 'Slow query' app.log"],
        note: (out) => `${out[0]} slow queries.`,
      })),
      step(["awk-filter", "top-n"], "The worst one", () => ({
        question: "What was the slowest query? Print just its duration (like 2300ms).",
        solution: "awk '/Slow query/ {print $NF}' app.log | sort -n | tail -n 1",
        hints: ["The duration is the last field ($NF) of each slow-query line.", "sort -n, then keep the last line.", "awk '/Slow query/ {print $NF}' app.log | sort -n | tail -n 1"],
        note: (out) => `The slowest took ${out[0]}.`,
      })),
      step(["pipes", "head-tail"], "When did it begin?", () => ({
        question: "When did the slowdown start? Show the first slow-query line.",
        solution: "grep 'Slow query' app.log | head -n 1",
        hints: ["Find the slow-query lines.", "The first one is at the top: head.", "grep 'Slow query' app.log | head -n 1"],
        note: (out) => `It began at ${out[0].split(" ")[1]}.`,
      })),
      step(["grep-count"], "The cost", () => ({
        question: "How many checkouts (POST /checkout) failed with status 500 in access.log? Print just the number.",
        solution: "grep -c 'POST /checkout 500' access.log",
        hints: ["Each failed checkout is a line in access.log.", "Search for the method, path, and status together, in quotes.", "grep -c 'POST /checkout 500' access.log"],
        note: (out) => `${out[0]} checkouts failed.`,
      })),
      step(["awk-stats"], "For the report", () => ({
        question: "What was the average slow-query time, in ms, with exactly one decimal place (like 1234.5)?",
        solution: "awk '/Slow query/ {s += $NF; n++} END {printf \"%.1f\\n\", s/n}' app.log",
        hints: ["Add up $NF and count the slow-query lines.", "printf \"%.1f\\n\" prints one decimal place. Divide by n, not NR.", "awk '/Slow query/ {s += $NF; n++} END {printf \"%.1f\\n\", s/n}' app.log"],
        note: (out) => `Average slow query: ${out[0]}ms.`,
      })),
    ],
    outro: (f) =>
      `From ${f.start} the database slowed down: ${f.count} slow queries, the worst taking ${f.slowest}. ${f.failed} checkouts failed while it lasted. Next: look at what the database was doing then.`,
  },

  {
    id: "crash-flood",
    title: "Crash flood",
    teaser: "error.log is filling up. What's breaking?",
    intro: "03:00. The on-call phone won't stop buzzing: error.log is filling up. Find the main problem, when it started, and what else is going wrong.",
    build(r) {
      const date = someDate(r);
      const [main, ...rest] = r.shuffle(TRACES);
      const mainMessage = main.message(r);
      const total = r.int(7, 10);
      const mainCount = Math.floor(total / 2) + 1;
      const kinds = r.shuffle([...Array(mainCount).fill(main), ...Array.from({ length: total - mainCount }, () => r.pick(rest.slice(0, 2)))]);
      let time = startTime(r);
      const out = [];
      const messages = [];
      for (const trace of kinds) {
        time += r.int(5, 60);
        const message = trace === main ? mainMessage : trace.message(r);
        messages.push(message);
        out.push(`${date} ${clock(time)} ERROR ${message}`);
        for (const frame of trace.frames.slice(0, r.int(2, trace.frames.length))) {
          out.push(`    at ${frame}(${frame.split(".")[0]}.java:${r.int(12, 260)})`);
        }
      }
      const others = [...new Set(messages.filter((m) => m !== mainMessage))].sort();
      if (!others.length) return {};
      return {
        files: { "error.log": out.join("\n") + "\n" },
        facts: { total, main: mainMessage, mainCount, first: out.find((line) => line.endsWith(mainMessage)).split(" ")[1], others },
      };
    },
    steps: [
      step(["grep-count"], "How many?", () => ({
        question: "How many errors are in error.log? Print just the number. (Count the ERROR lines, not the stack-trace lines.)",
        solution: "grep -c ERROR error.log",
        hints: ["Each error starts with a line containing ERROR.", "grep -c counts them.", "grep -c ERROR error.log"],
        note: (out) => `${out[0]} errors.`,
      })),
      step(["columns", "top-n"], "The main problem", () => ({
        question: "Which error message is the most common? Show its count and the message.",
        solution: "grep ERROR error.log | cut -d' ' -f4- | sort | uniq -c | sort -rn | head -n 1",
        hints: ["Keep the ERROR lines, then cut away the date, time, and level: cut -d' ' -f4-.", "Then sort | uniq -c | sort -rn | head -n 1.", "grep ERROR error.log | cut -d' ' -f4- | sort | uniq -c | sort -rn | head -n 1"],
        note: (out) => `Most common: "${out[0].trim().replace(/^\d+ /, "")}".`,
      })),
      step(["pipes", "head-tail"], "Since when?", (f) => ({
        question: `When did "${f.main}" first happen? Show the first line with that message.`,
        solution: `grep '${f.main}' error.log | head -n 1`,
        hints: ["Search for the message, in quotes.", "The first match is the earliest.", `grep '${f.main}' error.log | head -n 1`],
        note: () => `It first happened at ${f.first}.`,
      })),
      step(["regex-anchors", "grep-count"], "How deep?", () => ({
        question: "How many stack-trace lines are there in total? They're the lines that start with a space.",
        solution: "grep -c '^ ' error.log",
        hints: ["^ matches the start of a line.", "'^ ' is a line that starts with a space; -c counts.", "grep -c '^ ' error.log"],
        note: (out) => `${out[0]} stack-trace lines.`,
      })),
      step(["grep-v", "sort-uniq"], "What else?", (f) => ({
        question: `What else went wrong? List every error message other than "${f.main}", once each, sorted.`,
        solution: `grep ERROR error.log | grep -v '${f.main}' | cut -d' ' -f4- | sort -u`,
        hints: ["Start from the ERROR lines and drop the main message with grep -v.", "cut -d' ' -f4- keeps just the message; sort -u lists each once.", `grep ERROR error.log | grep -v '${f.main}' | cut -d' ' -f4- | sort -u`],
        note: (out) => `Also: ${list(out)}.`,
      })),
    ],
    outro: (f) =>
      `${f.mainCount} of the ${f.total} errors are "${f.main}", starting at ${f.first}. Fix that first; then look at ${list(f.others)}.`,
  },

  {
    id: "bandwidth-hog",
    title: "Bandwidth hog",
    teaser: "The bandwidth bill tripled. Who's downloading?",
    intro: "Month end. The hosting bill shows three times the usual bandwidth. You have access.log. Find out where the bytes went.",
    build(r) {
      const [hog, ...others] = r.shuffle(IPS);
      const regulars = others.slice(0, 3);
      const start = startTime(r);
      const events = calmTraffic(r, regulars, r.int(16, 22), start);
      const downloads = r.int(4, 6);
      for (let i = 0; i < downloads; i++) {
        events.push({ time: start + r.int(5, 90), ip: hog, method: "GET", path: "/export.csv", status: 200, bytes: bytesFor(r, 250000) });
      }
      for (let i = 0, n = r.int(1, 3); i < n; i++) {
        const route = r.pick(CALM_ROUTES);
        events.push({ time: start + r.int(5, 90), ip: hog, method: route.method, path: route.path, status: 200, bytes: bytesFor(r, route.base) });
      }
      return { files: { "access.log": accessLog(events) }, facts: { hog, downloads } };
    },
    steps: [
      step(["wc"], "How busy?", () => ({
        question: "How many requests are in access.log?",
        solution: "wc -l access.log",
        hints: ["One request per line.", "wc -l counts lines.", "wc -l access.log"],
        note: (out) => `${out[0].trim().split(/\s+/)[0]} requests.`,
      })),
      step(["awk-sum"], "How much?", () => ({
        question: "How many bytes were sent in total (column 6)? Print just the number.",
        solution: "awk '{s += $6} END {print s}' access.log",
        hints: ["Add up column 6 on every line.", "Print the total once, at the END.", "awk '{s += $6} END {print s}' access.log"],
        note: (out) => `${out[0]} bytes in total.`,
      })),
      step(["awk-group", "top-n"], "Who?", () => ({
        question: "Which IP downloaded the most bytes? Show its total, then the IP.",
        solution: "awk '{b[$2] += $6} END {for (ip in b) print b[ip], ip}' access.log | sort -rn | head -n 1",
        hints: ["Total the bytes per IP with an array: b[$2] += $6.", "Print total and IP at the END, then sort -rn | head -n 1.", "awk '{b[$2] += $6} END {for (ip in b) print b[ip], ip}' access.log | sort -rn | head -n 1"],
        note: (out) => {
          const [bytes, ip] = out[0].split(" ");
          return `${ip} downloaded ${bytes} bytes.`;
        },
      })),
      step(["uniq-count", "pipes"], "What?", (f) => ({
        question: `What did ${f.hog} request? Count each path, most frequent first.`,
        solution: `grep ${f.hog} access.log | awk '{print $4}' | sort | uniq -c | sort -rn`,
        hints: ["Start from that IP's lines and print the path.", "Then sort | uniq -c | sort -rn.", `grep ${f.hog} access.log | awk '{print $4}' | sort | uniq -c | sort -rn`],
        note: () => `${f.hog} fetched /export.csv ${f.downloads} times.`,
      })),
      step(["awk-sum", "awk-filter"], "The culprit", () => ({
        question: "How many bytes did /export.csv send in total? Print just the number.",
        solution: "awk '$4 == \"/export.csv\" {s += $6} END {print s}' access.log",
        hints: ["Only add up the /export.csv lines.", "Compare text in quotes: $4 == \"/export.csv\".", "awk '$4 == \"/export.csv\" {s += $6} END {print s}' access.log"],
        note: (out) => `/export.csv alone sent ${out[0]} bytes.`,
      })),
    ],
    outro: (f) =>
      `${f.hog} downloaded /export.csv ${f.downloads} times, and that one file is most of the bandwidth. Next: rate-limit or cache the export, and ask who needs it that often.`,
  },
];

const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

/** Every skill a scenario's steps practise. */
function scenarioSkills(id) {
  return [...new Set(SCENARIO_BY_ID[id].steps.flatMap((s) => s.skills))];
}

/**
 * Generate a playable incident: its files, its steps as challenges, and the
 * closing summary. Same seed, same incident.
 */
function buildIncident(id, seed) {
  const scenario = SCENARIO_BY_ID[id];
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = makeRng((seed + attempt * 7919) >>> 0);
    const { files, facts } = scenario.build(r);
    if (!facts) continue;
    const run = (cmd) => {
      const result = runCommandLine(cmd, files);
      if (result.error) throw new Error(`Incident ${id} solution failed: ${cmd}: ${result.error}`);
      return result.output;
    };
    if (scenario.check && !scenario.check(facts, run)) continue;

    const steps = scenario.steps.map(({ skills, title, make }) => {
      const made = make(facts);
      const expected = run(made.solution);
      return {
        title,
        description: made.question,
        learn: SKILL_BY_ID[skills[0]].learn,
        files,
        solution: made.solution,
        hints: made.hints,
        expected,
        skills,
        skill: skills[0],
        kind: "write",
        note: expected.length ? made.note(expected) : "",
      };
    });
    if (steps.some((s) => !s.expected.length || (s.expected.length === 1 && s.expected[0] === "0") || s.expected.length > 25)) continue;
    return { id, title: scenario.title, intro: scenario.intro, files, steps, outro: scenario.outro(facts), seed };
  }
  throw new Error(`Could not build incident ${id} (seed ${seed})`);
}

export { SCENARIOS, SCENARIO_BY_ID, scenarioSkills, buildIncident };
