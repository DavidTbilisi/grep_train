// Shell - a tiny, pure simulator of grep and common log analysis tools.
// No DOM access, so it can be unit-tested in Node (see tests/shell.test.mjs).
//
// Supported: grep, cat, head, tail, wc, sort, uniq, cut, awk, ls
// joined with pipes (|), with single/double quotes and * globs.

const TOOLS = {
  grep: { flags: ["-A", "-B", "-C", "-c", "-E", "-H", "-h", "-i", "-l", "-n", "-o", "-v", "-w"], run: grep },
  cat: { flags: ["-n"], run: cat },
  head: { flags: ["-n"], run: head },
  tail: { flags: ["-n"], run: tail },
  wc: { flags: ["-c", "-l", "-w"], run: wc },
  sort: { flags: ["-k", "-n", "-r", "-t", "-u"], run: sort },
  uniq: { flags: ["-c", "-d", "-u"], run: uniq },
  cut: { flags: ["-c", "-d", "-f"], run: cut },
  awk: { flags: ["-F"], run: awk },
  ls: { flags: [], run: ls },
};

class ShellError extends Error {}

// ---------- Parsing ----------

// Split a command line into pipeline stages of words, honoring quotes.
function parseCommandLine(line) {
  const stages = [[]];
  let word = null; // { text, quoted }
  const push = () => {
    if (word) stages[stages.length - 1].push(word);
    word = null;
  };

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (/\s/.test(ch)) {
      push();
    } else if (ch === "|") {
      push();
      stages.push([]);
    } else if (ch === "'" || ch === '"') {
      word = word || { text: "", quoted: false };
      word.quoted = true;
      const end = line.indexOf(ch, i + 1);
      if (end === -1) throw new ShellError(`unexpected end of input: missing closing ${ch}`);
      let part = line.slice(i + 1, end);
      if (ch === '"') part = part.replace(/\\(["\\$`])/g, "$1");
      word.text += part;
      i = end;
    } else if (ch === "\\" && i + 1 < line.length) {
      word = word || { text: "", quoted: false };
      word.quoted = true;
      word.text += line[++i];
    } else {
      word = word || { text: "", quoted: false };
      word.text += ch;
    }
  }
  push();

  if (stages.some((s) => s.length === 0)) {
    throw new ShellError("syntax error near unexpected token `|'");
  }
  return stages;
}

function expandGlobs(words, files) {
  const names = Object.keys(files);
  return words.flatMap(({ text, quoted }) => {
    if (quoted || !/[*?]/.test(text)) return [text];
    const re = new RegExp(
      "^" + text.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    const matches = names.filter((n) => re.test(n));
    return matches.length ? matches : [text];
  });
}

// Generic option parser. `spec` maps single-letter flags to true (boolean)
// or "value" (takes an argument, either attached like -n5 or separate).
function parseOptions(cmd, args, spec) {
  const opts = {};
  const operands = [];
  let i = 0;
  for (; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      i++;
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      if (spec.stopAtOperand) break;
      operands.push(arg);
      continue;
    }
    // head -5 / tail -5 shorthand
    if (spec.n === "value" && /^-\d+$/.test(arg)) {
      opts.n = arg.slice(1);
      continue;
    }
    for (let j = 1; j < arg.length; j++) {
      const flag = arg[j];
      if (!(flag in spec)) throw new ShellError(`${cmd}: invalid option -- '${flag}'`);
      if (spec[flag] === "value") {
        let value = arg.slice(j + 1);
        if (!value) {
          if (i + 1 >= args.length) throw new ShellError(`${cmd}: option requires an argument -- '${flag}'`);
          value = args[++i];
        }
        opts[flag] = value;
        break;
      }
      opts[flag] = true;
    }
  }
  operands.push(...args.slice(i));
  return { opts, operands };
}

// ---------- Helpers ----------

function toLines(text) {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// Resolve inputs: named files, or piped stdin. Returns [{ name, lines }].
function readInputs(cmd, names, ctx) {
  if (names.length === 0) {
    if (ctx.stdin === null) {
      throw new ShellError(`${cmd}: missing file name (try: ${cmd} ... ${Object.keys(ctx.files)[0] || "file"})`);
    }
    return [{ name: "(standard input)", lines: ctx.stdin }];
  }
  return names.map((name) => {
    if (!(name in ctx.files)) throw new ShellError(`${cmd}: ${name}: No such file or directory`);
    return { name, lines: toLines(ctx.files[name]) };
  });
}

function toInt(cmd, value, what) {
  if (!/^\d+$/.test(String(value))) throw new ShellError(`${cmd}: invalid ${what}: '${value}'`);
  return parseInt(value, 10);
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Convert a POSIX basic/extended regex into a JavaScript RegExp source.
function posixToJs(pattern, extended) {
  const CLASSES = {
    alpha: "a-zA-Z", digit: "0-9", alnum: "a-zA-Z0-9", upper: "A-Z", lower: "a-z",
    space: " \\t\\r\\n\\v\\f", blank: " \\t", punct: "!-\\/:-@\\[-`{-~", xdigit: "0-9A-Fa-f",
  };
  // In BRE these characters are literal unless backslash-escaped; in ERE the reverse.
  const SPECIAL = "(){}|+?";
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "[") {
      let j = i + 1;
      let cls = "[";
      if (pattern[j] === "^") {
        cls += "^";
        j++;
      }
      if (pattern[j] === "]") {
        cls += "\\]";
        j++;
      }
      while (j < pattern.length && pattern[j] !== "]") {
        const named = pattern.slice(j).match(/^\[:(\w+):\]/);
        if (named && CLASSES[named[1]]) {
          cls += CLASSES[named[1]];
          j += named[0].length;
        } else {
          cls += pattern[j] === "\\" || pattern[j] === "[" ? "\\" + pattern[j] : pattern[j];
          j++;
        }
      }
      if (j >= pattern.length) throw new ShellError("grep: Unmatched [, [^, [:, [., or [=");
      out += cls + "]";
      i = j;
    } else if (ch === "\\" && i + 1 < pattern.length) {
      const next = pattern[++i];
      if (next === "<" || next === ">") out += "\\b";
      else if (!extended && SPECIAL.includes(next)) out += next;
      else out += "\\" + next;
    } else if (!extended && SPECIAL.includes(ch)) {
      out += "\\" + ch;
    } else {
      out += ch;
    }
  }
  return out;
}

function compileRegex(cmd, pattern, { extended, ignoreCase, wholeWord, global }) {
  let source = posixToJs(pattern, extended);
  if (wholeWord) source = `(?<!\\w)(?:${source})(?!\\w)`;
  try {
    return new RegExp(source, (ignoreCase ? "i" : "") + (global ? "g" : ""));
  } catch {
    throw new ShellError(`${cmd}: invalid regular expression: ${pattern}`);
  }
}

// ---------- Tools ----------

function grep(args, ctx) {
  const { opts, operands } = parseOptions("grep", args, {
    A: "value", B: "value", C: "value", c: true, E: true, H: true, h: true,
    i: true, l: true, n: true, o: true, v: true, w: true,
  });
  if (operands.length === 0) throw new ShellError("grep: missing search pattern (usage: grep [OPTION]... PATTERN [FILE]...)");
  const [pattern, ...names] = operands;
  const inputs = readInputs("grep", names, ctx);

  const regex = compileRegex("grep", pattern, {
    extended: opts.E, ignoreCase: opts.i, wholeWord: opts.w, global: opts.o,
  });
  const before = toInt("grep", opts.B ?? opts.C ?? 0, "context length");
  const after = toInt("grep", opts.A ?? opts.C ?? 0, "context length");
  const showName = !opts.h && (opts.H || inputs.length > 1);

  const out = [];
  let lastPrinted = null; // { input, index } for "--" group separators

  for (const input of inputs) {
    const matched = input.lines.map((line) => {
      regex.lastIndex = 0;
      return regex.test(line) !== Boolean(opts.v);
    });
    const count = matched.filter(Boolean).length;

    if (opts.l) {
      if (count) out.push(input.name);
      continue;
    }
    if (opts.c) {
      out.push(showName ? `${input.name}:${count}` : String(count));
      continue;
    }

    const prefix = (index, sep) =>
      (showName ? input.name + sep : "") + (opts.n ? index + 1 + sep : "");

    if (opts.o) {
      if (opts.v) continue; // GNU grep prints nothing for -o -v
      input.lines.forEach((line, index) => {
        if (!matched[index]) return;
        regex.lastIndex = 0;
        for (const m of line.matchAll(regex)) {
          if (m[0]) out.push(prefix(index, ":") + m[0]);
        }
      });
      continue;
    }

    const show = new Set();
    matched.forEach((isMatch, index) => {
      if (!isMatch) return;
      for (let k = Math.max(0, index - before); k <= Math.min(input.lines.length - 1, index + after); k++) {
        show.add(k);
      }
    });
    [...show].sort((a, b) => a - b).forEach((index) => {
      const hasContext = before || after;
      if (hasContext && lastPrinted && (lastPrinted.input !== input || index > lastPrinted.index + 1)) {
        out.push("--");
      }
      out.push(prefix(index, matched[index] ? ":" : "-") + input.lines[index]);
      lastPrinted = { input, index };
    });
  }
  return out;
}

function cat(args, ctx) {
  const { opts, operands } = parseOptions("cat", args, { n: true });
  const lines = readInputs("cat", operands, ctx).flatMap((input) => input.lines);
  return opts.n ? lines.map((line, i) => `${String(i + 1).padStart(6)}\t${line}`) : lines;
}

function headOrTail(cmd, args, ctx, take) {
  const { opts, operands } = parseOptions(cmd, args, { n: "value" });
  const n = toInt(cmd, opts.n ?? 10, "number of lines");
  const inputs = readInputs(cmd, operands, ctx);
  return inputs.flatMap((input, i) => {
    const lines = take(input.lines, n);
    if (inputs.length === 1) return lines;
    return [...(i > 0 ? [""] : []), `==> ${input.name} <==`, ...lines];
  });
}

function head(args, ctx) {
  return headOrTail("head", args, ctx, (lines, n) => lines.slice(0, n));
}

function tail(args, ctx) {
  return headOrTail("tail", args, ctx, (lines, n) => (n === 0 ? [] : lines.slice(-n)));
}

function wc(args, ctx) {
  const { opts, operands } = parseOptions("wc", args, { l: true, w: true, c: true });
  const fields = opts.l || opts.w || opts.c ? ["l", "w", "c"].filter((f) => opts[f]) : ["l", "w", "c"];
  const inputs = readInputs("wc", operands, ctx);

  const rows = inputs.map((input) => ({
    name: operands.length ? input.name : "",
    l: input.lines.length,
    w: input.lines.reduce((sum, line) => sum + line.split(/\s+/).filter(Boolean).length, 0),
    c: input.lines.reduce((sum, line) => sum + new TextEncoder().encode(line).length + 1, 0),
  }));
  if (rows.length > 1) {
    rows.push(rows.reduce((t, r) => ({ name: "total", l: t.l + r.l, w: t.w + r.w, c: t.c + r.c }),
      { name: "total", l: 0, w: 0, c: 0 }));
  }
  const single = rows.length === 1 && fields.length === 1;
  const width = single ? 0 : Math.max(...rows.flatMap((r) => fields.map((f) => String(r[f]).length)));
  return rows.map((r) =>
    [...fields.map((f) => String(r[f]).padStart(width)), r.name].filter((s) => s !== "").join(" ")
  );
}

function sort(args, ctx) {
  const { opts, operands } = parseOptions("sort", args, { k: "value", n: true, r: true, t: "value", u: true });
  const lines = readInputs("sort", operands, ctx).flatMap((input) => input.lines);

  let keyOf = (line) => line;
  if (opts.k) {
    const m = String(opts.k).match(/^(\d+)(?:,(\d+))?$/);
    if (!m) throw new ShellError(`sort: invalid key: '${opts.k}'`);
    const start = parseInt(m[1], 10) - 1;
    const end = m[2] ? parseInt(m[2], 10) : undefined;
    keyOf = (line) => {
      const parts = opts.t ? line.split(opts.t) : line.trim().split(/\s+/);
      return parts.slice(start, end).join(opts.t || " ");
    };
  }
  const num = (s) => parseFloat(s.trim().match(/^-?\d*\.?\d*/)[0]) || 0;
  const byteCmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const keyCmp = (a, b) => (opts.n ? num(a) - num(b) : byteCmp(a, b));

  // Like GNU sort: compare keys, then fall back to the whole line.
  const sorted = [...lines].sort((a, b) => {
    const result = keyCmp(keyOf(a), keyOf(b)) || byteCmp(a, b);
    return opts.r ? -result : result;
  });
  if (!opts.u) return sorted;
  return sorted.filter((line, i) => i === 0 || keyCmp(keyOf(line), keyOf(sorted[i - 1])) !== 0);
}

function uniq(args, ctx) {
  const { opts, operands } = parseOptions("uniq", args, { c: true, d: true, u: true });
  const lines = readInputs("uniq", operands, ctx).flatMap((input) => input.lines);
  const groups = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.line === line) last.count++;
    else groups.push({ line, count: 1 });
  }
  return groups
    .filter((g) => (!opts.d || g.count > 1) && (!opts.u || g.count === 1))
    .map((g) => (opts.c ? `${String(g.count).padStart(7)} ${g.line}` : g.line));
}

function parseRanges(cmd, list) {
  return String(list).split(",").map((part) => {
    const m = part.match(/^(\d*)(-?)(\d*)$/);
    if (!m || (!m[1] && !m[3])) throw new ShellError(`${cmd}: invalid field or character list: '${list}'`);
    const from = m[1] ? parseInt(m[1], 10) : 1;
    const to = m[2] ? (m[3] ? parseInt(m[3], 10) : Infinity) : from;
    return [from, to];
  });
}

function cut(args, ctx) {
  const { opts, operands } = parseOptions("cut", args, { c: "value", d: "value", f: "value" });
  if (!opts.f && !opts.c) throw new ShellError("cut: you must specify a list of fields (-f) or characters (-c)");
  const delim = opts.d ?? "\t";
  if (delim.length !== 1) throw new ShellError("cut: the delimiter must be a single character");
  const ranges = parseRanges("cut", opts.f ?? opts.c);
  const pick = (items) => items.filter((_, i) => ranges.some(([from, to]) => i + 1 >= from && i + 1 <= to));

  const lines = readInputs("cut", operands, ctx).flatMap((input) => input.lines);
  if (opts.c) return lines.map((line) => pick([...line]).join(""));
  return lines.map((line) => (line.includes(delim) ? pick(line.split(delim)).join(delim) : line));
}

// awk subset:  [-F sep] '[condition] [{ print item, item ... }]'
//   condition: /regex/  !/regex/  or  <value> <op> <value>  with ops == != < > <= >= ~ !~
//   values:    $0..$N  $NF  NF  NR  numbers  "strings"
function awk(args, ctx) {
  const { opts, operands } = parseOptions("awk", args, { F: "value", stopAtOperand: true });
  if (operands.length === 0) throw new ShellError("awk: missing program (try: awk '{print $1}' file)");
  const [program, ...names] = operands;
  const parsed = parseAwkProgram(program.trim());
  const split = (line) =>
    !opts.F || opts.F === " " ? line.trim().split(/\s+/).filter(Boolean) : line.split(opts.F);

  const out = [];
  let nr = 0;
  for (const input of readInputs("awk", names, ctx)) {
    for (const line of input.lines) {
      nr++;
      const record = { line, fields: split(line), nr };
      if (parsed.condition && !parsed.condition(record)) continue;
      out.push(parsed.print ? parsed.print(record) : line);
    }
  }
  return out;
}

function parseAwkProgram(program) {
  const m = program.match(/^([^{]*?)\s*(?:\{\s*(.*?)\s*;?\s*\})?$/s);
  if (!m) throw new ShellError(`awk: syntax error in program: ${program}`);
  const [, conditionSrc, actionSrc] = m;
  const result = {};

  if (conditionSrc) result.condition = parseAwkCondition(conditionSrc.trim());
  if (actionSrc !== undefined) {
    const pm = actionSrc.match(/^print\b\s*(.*)$/s);
    if (!pm) throw new ShellError(`awk: only 'print' is supported here, got: ${actionSrc || "{}"}`);
    const items = pm[1].trim() ? splitTopLevel(pm[1], ",").map((item) => parseAwkConcat(item.trim())) : [];
    result.print = items.length
      ? (rec) => items.map((item) => item(rec)).join(" ")
      : (rec) => rec.line;
  }
  return result;
}

function parseAwkCondition(src) {
  if (src.includes("||")) {
    const any = src.split("||").map((part) => parseAwkCondition(part.trim()));
    return (rec) => any.some((cond) => cond(rec));
  }
  if (src.includes("&&")) {
    const all = src.split("&&").map((part) => parseAwkCondition(part.trim()));
    return (rec) => all.every((cond) => cond(rec));
  }
  const regexOnly = src.match(/^(!?)\s*\/(.*)\/$/s);
  if (regexOnly) {
    const re = compileRegex("awk", regexOnly[2], { extended: true });
    return (rec) => re.test(rec.line) !== (regexOnly[1] === "!");
  }
  const m = src.match(/^(.+?)\s*(==|!=|<=|>=|<|>|!~|~)\s*(.+)$/s);
  if (!m) throw new ShellError(`awk: unsupported condition: ${src}`);
  const left = parseAwkValue(m[1].trim());
  const op = m[2];
  const rightSrc = m[3].trim();

  if (op === "~" || op === "!~") {
    const rm = rightSrc.match(/^\/(.*)\/$/s) || rightSrc.match(/^"(.*)"$/s);
    if (!rm) throw new ShellError(`awk: expected /regex/ after ${op}`);
    const re = compileRegex("awk", rm[1], { extended: true });
    return (rec) => re.test(String(left(rec))) !== (op === "!~");
  }
  const right = parseAwkValue(rightSrc);
  const isNum = (v) => v !== "" && !isNaN(Number(v));
  return (rec) => {
    let a = left(rec);
    let b = right(rec);
    if (isNum(a) && isNum(b)) {
      a = Number(a);
      b = Number(b);
    } else {
      a = String(a);
      b = String(b);
    }
    switch (op) {
      case "==": return a === b;
      case "!=": return a !== b;
      case "<": return a < b;
      case ">": return a > b;
      case "<=": return a <= b;
      default: return a >= b;
    }
  };
}

// An awk print item may be several values concatenated: $1 ":" $2
function parseAwkConcat(src) {
  const token = /"(?:[^"\\]|\\.)*"|\$\w+|\w+/g;
  const parts = src.match(token);
  if (!parts || src.replace(token, "").trim() !== "") {
    throw new ShellError(`awk: cannot print: ${src}`);
  }
  const values = parts.map(parseAwkValue);
  return (rec) => values.map((v) => v(rec)).join("");
}

function parseAwkValue(src) {
  if (src === "$0") return (rec) => rec.line;
  if (src === "$NF") return (rec) => rec.fields[rec.fields.length - 1] ?? "";
  if (src === "NF") return (rec) => rec.fields.length;
  if (src === "NR") return (rec) => rec.nr;
  const field = src.match(/^\$(\d+)$/);
  if (field) return (rec) => rec.fields[parseInt(field[1], 10) - 1] ?? "";
  if (/^-?\d+(\.\d+)?$/.test(src)) return () => src;
  const str = src.match(/^"(.*)"$/s);
  if (str) {
    const text = str[1].replace(/\\t/g, "\t").replace(/\\(.)/g, "$1");
    return () => text;
  }
  throw new ShellError(`awk: unknown value: ${src}`);
}

function splitTopLevel(src, sep) {
  const parts = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' && src[i - 1] !== "\\") inString = !inString;
    if (ch === sep && !inString) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function ls(args, ctx) {
  return Object.keys(ctx.files);
}

// ---------- Public API ----------

/**
 * Run a command line such as `grep ERROR app.log | wc -l`.
 * @param {string} line
 * @param {Record<string, string>} files  virtual file system: name -> content
 * @returns {{ output: string[] } | { error: string }}
 */
function runCommandLine(line, files) {
  try {
    const stages = parseCommandLine(line.trim());
    let stdin = null;
    for (const words of stages) {
      const [name, ...args] = expandGlobs(words, files);
      const tool = TOOLS[name];
      if (!tool) {
        throw new ShellError(`${name}: command not found (available: ${Object.keys(TOOLS).join(", ")})`);
      }
      stdin = tool.run(args, { files, stdin });
    }
    return { output: stdin };
  } catch (e) {
    if (e instanceof ShellError) return { error: e.message };
    throw e;
  }
}

export { runCommandLine, TOOLS };
