// Awk - a small interpreter for the awk programs used in log analysis.
// Pure (no DOM). Supports:
//   BEGIN / END, patterns (/re/, comparisons, ~ !~, && || !), variables,
//   associative arrays, + - * / %, string concatenation, ?:, ++ --,
//   = += -= *= /= %=, print, printf, if / else, for (key in array), next,
//   $N, $NF, NR, NF, FS, OFS, and length, substr, index, tolower, toupper,
//   int, sprintf.
//
// Numbers print the way awk prints them (integers as integers, others with
// %.6g), with C's round-half-to-even on exact ties so output matches gawk.
// `for (k in a)` visits keys in insertion order; real awk's order is
// unspecified, so pipe such output into sort, as real scripts do.

export class AwkError extends Error {}

const NEXT = Symbol("next");

// ---------- Values ----------
// A value is undefined (uninitialized), a number, or a string. Strings that
// look like numbers (fields such as "404") compare numerically.

const NUMERIC = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\s*$/;
const NUMERIC_PREFIX = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/;

function toNum(v) {
  if (typeof v === "number") return v;
  if (v === undefined) return 0;
  const m = String(v).match(NUMERIC_PREFIX);
  return m ? parseFloat(m[0]) : 0;
}

const looksNumeric = (v) => v === undefined || typeof v === "number" || NUMERIC.test(v);

function toStr(v) {
  if (v === undefined) return "";
  return typeof v === "number" ? formatNumber(v) : v;
}

function truthy(v) {
  if (v === undefined) return false;
  if (typeof v === "number") return v !== 0;
  return NUMERIC.test(v) ? toNum(v) !== 0 : v !== "";
}

// ---------- Number formatting (C printf semantics) ----------

// Exact decimal expansion of a non-negative double: its digits, and how many
// of them come before the decimal point.
function exactDecimal(x) {
  const s = x < 1e21 ? x.toFixed(100) : BigInt(x).toString();
  const [int, frac = ""] = s.split(".");
  return { digits: int + frac, point: int.length };
}

// Round a digit string to `keep` digits, half to even on exact ties.
function roundDigits(digits, keep) {
  const head = digits.slice(0, keep).padEnd(keep, "0");
  const rest = digits.slice(keep);
  const first = rest[0] || "0";
  const lastHeadOdd = Number(head[head.length - 1] || "0") % 2 === 1;
  const up = first > "5" || (first === "5" && (/[1-9]/.test(rest.slice(1)) || lastHeadOdd));
  if (!up) return { digits: head, carry: false };
  const out = head.split("");
  let i = out.length - 1;
  for (; i >= 0; i--) {
    if (out[i] === "9") out[i] = "0";
    else {
      out[i] = String(Number(out[i]) + 1);
      break;
    }
  }
  return i < 0 ? { digits: "1" + out.join(""), carry: true } : { digits: out.join(""), carry: false };
}

// %.Nf
function formatFixed(x, decimals) {
  const { digits, point } = exactDecimal(Math.abs(x));
  const rounded = roundDigits(digits, point + decimals).digits;
  const int = rounded.slice(0, rounded.length - decimals).replace(/^0+(?=\d)/, "") || "0";
  const frac = rounded.slice(rounded.length - decimals);
  return (x < 0 ? "-" : "") + int + (decimals ? "." + frac : "");
}

// %.Ne
function formatExp(x, decimals, upper = false) {
  if (x === 0) return (0).toFixed(decimals) + (upper ? "E+00" : "e+00");
  const { digits, point } = exactDecimal(Math.abs(x));
  const lead = digits.search(/[1-9]/);
  let exp = point - lead - 1;
  let { digits: sig, carry } = roundDigits(digits.slice(lead), decimals + 1);
  if (carry) {
    exp++;
    sig = sig.slice(0, decimals + 1);
  }
  const mantissa = sig[0] + (decimals ? "." + sig.slice(1) : "");
  const e = `${upper ? "E" : "e"}${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  return (x < 0 ? "-" : "") + mantissa + e;
}

// %.Pg
function formatGeneral(x, precision, upper = false) {
  if (x === 0) return "0";
  const P = Math.max(1, precision);
  const { digits, point } = exactDecimal(Math.abs(x));
  const lead = digits.search(/[1-9]/);
  let exp = point - lead - 1;
  const { carry } = roundDigits(digits.slice(lead), P);
  if (carry) exp++;
  const strip = (s) => (s.includes(".") ? s.replace(/\.?0+$/, "") : s);
  if (exp < -4 || exp >= P) {
    const [mantissa, e] = formatExp(x, P - 1, upper).split(upper ? "E" : "e");
    return strip(mantissa) + (upper ? "E" : "e") + e;
  }
  return strip(formatFixed(x, P - 1 - exp));
}

// How print shows a number (awk's OFMT/CONVFMT, "%.6g").
function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  if (!Number.isFinite(n)) return n > 0 ? "inf" : n < 0 ? "-inf" : "nan";
  return formatGeneral(n, 6);
}

function sprintf(format, args) {
  let next = 0;
  return format.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([a-zA-Z%])/g, (spec, flags, width, prec, conv) => {
    if (conv === "%") return "%";
    const value = args[next++];
    const p = prec === undefined ? undefined : Number(prec);
    let s;
    switch (conv) {
      case "d":
      case "i": {
        const n = Math.trunc(toNum(value));
        s = String(Math.abs(n));
        if (p !== undefined) s = s.padStart(p, "0");
        s = (n < 0 ? "-" : flags.includes("+") ? "+" : flags.includes(" ") ? " " : "") + s;
        break;
      }
      case "f":
      case "F":
        s = formatFixed(toNum(value), p ?? 6);
        if (flags.includes("+") && toNum(value) >= 0) s = "+" + s;
        break;
      case "e":
      case "E":
        s = formatExp(toNum(value), p ?? 6, conv === "E");
        break;
      case "g":
      case "G":
        s = formatGeneral(toNum(value), p ?? 6, conv === "G");
        break;
      case "s":
        s = toStr(value);
        if (p !== undefined) s = s.slice(0, p);
        break;
      case "c":
        s = typeof value === "number" ? String.fromCharCode(value) : toStr(value).charAt(0);
        break;
      case "x":
      case "X":
      case "o":
        s = Math.trunc(toNum(value)).toString(conv === "o" ? 8 : 16);
        if (conv === "X") s = s.toUpperCase();
        break;
      default:
        throw new AwkError(`printf: unsupported format ${spec}`);
    }
    const w = width === undefined ? 0 : Number(width);
    if (s.length < w) {
      if (flags.includes("-")) s = s.padEnd(w);
      else if (flags.includes("0") && /[dieEfFgGxXo]/.test(conv)) {
        const sign = /^[-+ ]/.test(s) ? s[0] : "";
        s = sign + s.slice(sign.length).padStart(w - sign.length, "0");
      } else s = s.padStart(w);
    }
    return s;
  });
}

// ---------- Tokenizer ----------

const KEYWORDS = new Set(["BEGIN", "END", "print", "printf", "if", "else", "for", "in", "next"]);
const OPERATORS = [
  "+=", "-=", "*=", "/=", "%=", "++", "--", "==", "!=", "<=", ">=", "&&", "||", "!~",
  "{", "}", "(", ")", "[", "]", ";", ",", "+", "-", "*", "/", "%", "=", "<", ">", "!", "~", "$", "?", ":",
];
const ESCAPES = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "/": "/" };

function tokenize(src) {
  const tokens = [];
  // After a value, / means division; anywhere else it starts a /regex/.
  const afterValue = () => {
    const last = tokens[tokens.length - 1];
    return last && (["num", "str", "name"].includes(last.type) || [")", "]"].includes(last.value));
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\n") {
      tokens.push({ type: "nl", value: "\n", raw: "newline" });
      i++;
    } else if (/\s/.test(ch)) {
      i++;
    } else if (ch === "#") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (ch === "\\" && src[i + 1] === "\n") {
      i += 2;
    } else if (/[0-9.]/.test(ch) && /^(?:\d+\.?\d*|\.\d+)/.test(src.slice(i))) {
      const m = src.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/)[0];
      tokens.push({ type: "num", value: parseFloat(m), raw: m });
      i += m.length;
    } else if (/[A-Za-z_]/.test(ch)) {
      const m = src.slice(i).match(/^[A-Za-z_]\w*/)[0];
      tokens.push({ type: KEYWORDS.has(m) ? "kw" : "name", value: m, raw: m });
      i += m.length;
    } else if (ch === '"') {
      let value = "";
      let j = i + 1;
      for (; j < src.length && src[j] !== '"'; j++) {
        if (src[j] === "\\" && j + 1 < src.length) value += ESCAPES[src[++j]] ?? "\\" + src[j];
        else value += src[j];
      }
      if (j >= src.length) throw new AwkError("unterminated string");
      tokens.push({ type: "str", value, raw: src.slice(i, j + 1) });
      i = j + 1;
    } else if (ch === "/" && !afterValue()) {
      let value = "";
      let j = i + 1;
      for (; j < src.length && src[j] !== "/"; j++) {
        if (src[j] === "\\" && src[j + 1] === "/") value += src[++j];
        else if (src[j] === "\\" && j + 1 < src.length) value += src[j] + src[++j];
        else value += src[j];
      }
      if (j >= src.length) throw new AwkError("unterminated regular expression");
      tokens.push({ type: "regex", value, raw: src.slice(i, j + 1) });
      i = j + 1;
    } else {
      const op = OPERATORS.find((o) => src.startsWith(o, i));
      if (!op) throw new AwkError(`unexpected character '${ch}'`);
      tokens.push({ type: "op", value: op, raw: op });
      i += op.length;
    }
  }
  return tokens;
}

// ---------- Parser ----------
// Expressions compile to { eval(env), ref?, regex? } where ref = { get, set }
// for things that can be assigned to.

const ASSIGN = {
  "=": (a, b) => b,
  "+=": (a, b) => toNum(a) + toNum(b),
  "-=": (a, b) => toNum(a) - toNum(b),
  "*=": (a, b) => toNum(a) * toNum(b),
  "/=": (a, b) => divide(toNum(a), toNum(b)),
  "%=": (a, b) => modulo(toNum(a), toNum(b)),
};

function divide(a, b) {
  if (b === 0) throw new AwkError("division by zero");
  return a / b;
}

function modulo(a, b) {
  if (b === 0) throw new AwkError("division by zero in %");
  return a % b;
}

function compare(a, b, op) {
  let x;
  let y;
  if (looksNumeric(a) && looksNumeric(b)) {
    x = toNum(a);
    y = toNum(b);
  } else {
    x = toStr(a);
    y = toStr(b);
  }
  switch (op) {
    case "<": return x < y;
    case "<=": return x <= y;
    case ">": return x > y;
    case ">=": return x >= y;
    case "==": return x === y;
    default: return x !== y;
  }
}

const value = (v) => ({ eval: () => v });

class Parser {
  constructor(tokens, compileRegex) {
    this.tokens = tokens;
    this.i = 0;
    this.compileRegex = compileRegex;
    this.inPrint = false; // in print arguments, a bare > would be output redirection
  }

  peek(offset = 0) {
    return this.tokens[this.i + offset];
  }

  is(v) {
    const tok = this.peek();
    return Boolean(tok) && (tok.type === "op" || tok.type === "kw") && tok.value === v;
  }

  eat(v) {
    if (!this.is(v)) this.fail(`expected '${v}'`);
    return this.tokens[this.i++];
  }

  fail(detail) {
    const tok = this.peek();
    throw new AwkError(`syntax error ${tok ? `at '${tok.raw}'` : "at end of program"}${detail ? `: ${detail}` : ""}`);
  }

  skipNewlines() {
    while (this.peek()?.type === "nl") this.i++;
  }

  skipTerminators() {
    while (this.is(";") || this.peek()?.type === "nl") this.i++;
  }

  atStatementEnd() {
    return !this.peek() || this.is(";") || this.is("}") || this.peek().type === "nl";
  }

  program() {
    const rules = { begin: [], main: [], end: [] };
    this.skipTerminators();
    while (this.peek()) {
      if (this.is("BEGIN")) {
        this.i++;
        rules.begin.push(this.block());
      } else if (this.is("END")) {
        this.i++;
        rules.end.push(this.block());
      } else {
        const pattern = this.is("{") ? null : this.expr();
        const action = this.is("{") ? this.block() : null;
        rules.main.push({ pattern, action });
      }
      this.skipTerminators();
    }
    return rules;
  }

  block() {
    this.eat("{");
    const body = this.statements();
    this.eat("}");
    return body;
  }

  statements() {
    const list = [];
    this.skipTerminators();
    while (this.peek() && !this.is("}")) {
      list.push(this.statement());
      this.skipTerminators();
    }
    return (env) => {
      for (const statement of list) statement(env);
    };
  }

  statement() {
    if (this.is("{")) return this.block();
    if (this.is("print") || this.is("printf")) return this.print();
    if (this.is("next")) {
      this.i++;
      return () => {
        throw NEXT;
      };
    }
    if (this.is("if")) return this.ifStatement();
    if (this.is("for")) return this.forIn();
    const e = this.expr();
    return (env) => {
      e.eval(env);
    };
  }

  ifStatement() {
    this.eat("if");
    this.eat("(");
    const condition = this.expr();
    this.eat(")");
    this.skipNewlines();
    const then = this.statement();
    const save = this.i;
    this.skipTerminators();
    let otherwise = null;
    if (this.is("else")) {
      this.i++;
      this.skipNewlines();
      otherwise = this.statement();
    } else {
      this.i = save;
    }
    return (env) => {
      if (truthy(condition.eval(env))) then(env);
      else if (otherwise) otherwise(env);
    };
  }

  forIn() {
    this.eat("for");
    this.eat("(");
    const key = this.peek();
    if (key?.type !== "name" || !(this.peek(1)?.type === "kw" && this.peek(1).value === "in") || this.peek(2)?.type !== "name") {
      this.fail("only for (key in array) loops are supported");
    }
    this.i += 3;
    const arrayName = this.tokens[this.i - 1].value;
    this.eat(")");
    this.skipNewlines();
    const body = this.statement();
    return (env) => {
      const array = env.arrays.get(arrayName);
      if (!array) return;
      for (const k of [...array.keys()]) {
        env.setVar(key.value, k);
        body(env);
      }
    };
  }

  print() {
    const keyword = this.tokens[this.i++].value;
    const args = [];
    if (!this.atStatementEnd()) {
      this.inPrint = true;
      args.push(this.expr());
      while (this.is(",")) {
        this.i++;
        this.skipNewlines();
        args.push(this.expr());
      }
      this.inPrint = false;
    }
    if (!this.atStatementEnd()) this.fail("output redirection and pipes aren't supported");
    if (keyword === "print") {
      return (env) => {
        const items = args.length ? args.map((a) => toStr(a.eval(env))) : [env.record];
        env.out += items.join(toStr(env.getVar("OFS"))) + "\n";
      };
    }
    if (!args.length) this.fail("printf needs a format");
    return (env) => {
      env.out += sprintf(toStr(args[0].eval(env)), args.slice(1).map((a) => a.eval(env)));
    };
  }

  // ----- Expressions, lowest precedence first -----

  expr() {
    const left = this.ternary();
    const op = this.peek();
    if (op?.type === "op" && op.value in ASSIGN) {
      if (!left.ref) this.fail("can't assign to this");
      this.i++;
      this.skipNewlines();
      const right = this.expr();
      const { ref } = left;
      const apply = ASSIGN[op.value];
      return {
        eval: (env) => {
          const v = op.value === "=" ? right.eval(env) : apply(ref.get(env), right.eval(env));
          ref.set(env, v);
          return v;
        },
      };
    }
    return left;
  }

  ternary() {
    const condition = this.or();
    if (!this.is("?")) return condition;
    this.i++;
    const a = this.ternary();
    this.eat(":");
    const b = this.ternary();
    return { eval: (env) => (truthy(condition.eval(env)) ? a.eval(env) : b.eval(env)) };
  }

  or() {
    let left = this.and();
    while (this.is("||")) {
      this.i++;
      this.skipNewlines();
      const l = left;
      const r = this.and();
      left = { eval: (env) => (truthy(l.eval(env)) || truthy(r.eval(env)) ? 1 : 0) };
    }
    return left;
  }

  and() {
    let left = this.match();
    while (this.is("&&")) {
      this.i++;
      this.skipNewlines();
      const l = left;
      const r = this.match();
      left = { eval: (env) => (truthy(l.eval(env)) && truthy(r.eval(env)) ? 1 : 0) };
    }
    return left;
  }

  match() {
    let left = this.comparison();
    while (this.is("~") || this.is("!~")) {
      const negate = this.tokens[this.i++].value === "!~";
      const l = left;
      const r = this.comparison();
      const toRegex = r.regex ? () => r.regex : (env) => this.compileRegex(toStr(r.eval(env)));
      left = { eval: (env) => (toRegex(env).test(toStr(l.eval(env))) !== negate ? 1 : 0) };
    }
    return left;
  }

  comparison() {
    const left = this.concat();
    const tok = this.peek();
    if (tok?.type === "op" && ["<", "<=", ">", ">=", "==", "!="].includes(tok.value)) {
      if (this.inPrint && tok.value === ">") this.fail("output redirection isn't supported (put comparisons in parentheses)");
      this.i++;
      const right = this.concat();
      return { eval: (env) => (compare(left.eval(env), right.eval(env), tok.value) ? 1 : 0) };
    }
    return left;
  }

  // Juxtaposition joins strings: print NR ": " $2
  concat() {
    let left = this.additive();
    for (;;) {
      const tok = this.peek();
      const startsValue = tok && (["num", "str", "name"].includes(tok.type) || (tok.type === "op" && ["$", "("].includes(tok.value)));
      if (!startsValue) return left;
      const l = left;
      const r = this.additive();
      left = { eval: (env) => toStr(l.eval(env)) + toStr(r.eval(env)) };
    }
  }

  additive() {
    let left = this.multiplicative();
    while (this.is("+") || this.is("-")) {
      const op = this.tokens[this.i++].value;
      const l = left;
      const r = this.multiplicative();
      left = { eval: (env) => (op === "+" ? toNum(l.eval(env)) + toNum(r.eval(env)) : toNum(l.eval(env)) - toNum(r.eval(env))) };
    }
    return left;
  }

  multiplicative() {
    let left = this.unary();
    while (this.is("*") || this.is("/") || this.is("%")) {
      const op = this.tokens[this.i++].value;
      const l = left;
      const r = this.unary();
      left = {
        eval: (env) => {
          const a = toNum(l.eval(env));
          const b = toNum(r.eval(env));
          return op === "*" ? a * b : op === "/" ? divide(a, b) : modulo(a, b);
        },
      };
    }
    return left;
  }

  unary() {
    if (this.is("!")) {
      this.i++;
      const e = this.unary();
      return { eval: (env) => (truthy(e.eval(env)) ? 0 : 1) };
    }
    if (this.is("-") || this.is("+")) {
      const negate = this.tokens[this.i++].value === "-";
      const e = this.unary();
      return { eval: (env) => (negate ? -toNum(e.eval(env)) : toNum(e.eval(env))) };
    }
    if (this.is("++") || this.is("--")) {
      const delta = this.tokens[this.i++].value === "++" ? 1 : -1;
      const target = this.postfix();
      if (!target.ref) this.fail("can't increment this");
      return {
        eval: (env) => {
          const v = toNum(target.ref.get(env)) + delta;
          target.ref.set(env, v);
          return v;
        },
      };
    }
    return this.postfix();
  }

  postfix() {
    const e = this.primary();
    if (e.ref && (this.is("++") || this.is("--"))) {
      const delta = this.tokens[this.i++].value === "++" ? 1 : -1;
      return {
        eval: (env) => {
          const old = toNum(e.ref.get(env));
          e.ref.set(env, old + delta);
          return old;
        },
      };
    }
    return e;
  }

  primary() {
    const tok = this.peek();
    if (!tok) this.fail("expected a value");
    if (tok.type === "num") {
      this.i++;
      return value(tok.value);
    }
    if (tok.type === "str") {
      this.i++;
      return value(tok.value);
    }
    if (tok.type === "regex") {
      this.i++;
      const regex = this.compileRegex(tok.value);
      return { regex, eval: (env) => (regex.test(env.record) ? 1 : 0) };
    }
    if (this.is("$")) {
      this.i++;
      const index = this.primary();
      return {
        eval: (env) => env.field(toNum(index.eval(env))),
        ref: {
          get: (env) => env.field(toNum(index.eval(env))),
          set: () => {
            throw new AwkError("assigning to fields isn't supported");
          },
        },
      };
    }
    if (this.is("(")) {
      this.i++;
      const inPrint = this.inPrint;
      this.inPrint = false;
      const e = this.expr();
      this.inPrint = inPrint;
      this.eat(")");
      return e;
    }
    if (tok.type === "name") return this.name();
    this.fail();
  }

  name() {
    const { value: name } = this.tokens[this.i++];
    if (this.is("[")) {
      this.i++;
      const parts = [this.expr()];
      while (this.is(",")) {
        this.i++;
        parts.push(this.expr());
      }
      this.eat("]");
      const key = (env) => parts.map((p) => toStr(p.eval(env))).join("\x1c");
      // Like awk, reading a[k] creates the element.
      const get = (env) => {
        const array = env.array(name);
        const k = key(env);
        if (!array.has(k)) array.set(k, undefined);
        return array.get(k);
      };
      return { eval: get, ref: { get, set: (env, v) => env.array(name).set(key(env), v) } };
    }
    if (name in FUNCTIONS) {
      const args = [];
      if (this.is("(")) {
        this.i++;
        if (!this.is(")")) {
          args.push(this.expr());
          while (this.is(",")) {
            this.i++;
            args.push(this.expr());
          }
        }
        this.eat(")");
      } else if (name !== "length") {
        this.fail(`${name} needs parentheses`);
      }
      const fn = FUNCTIONS[name];
      return { eval: (env) => fn(env, args.map((a) => a.eval(env))) };
    }
    if (this.is("(")) this.fail(`function ${name} isn't supported`);
    return {
      eval: (env) => env.getVar(name),
      ref: { get: (env) => env.getVar(name), set: (env, v) => env.setVar(name, v) },
    };
  }
}

const FUNCTIONS = {
  length: (env, [s]) => toStr(s === undefined ? env.record : s).length,
  substr: (env, [s, m, n]) => {
    const str = toStr(s);
    const start = Math.round(toNum(m));
    const end = n === undefined ? Infinity : start + Math.round(toNum(n));
    return str.slice(Math.max(start, 1) - 1, Math.max(end, 1) - 1);
  },
  index: (env, [s, t]) => toStr(s).indexOf(toStr(t)) + 1,
  tolower: (env, [s]) => toStr(s).toLowerCase(),
  toupper: (env, [s]) => toStr(s).toUpperCase(),
  int: (env, [x]) => Math.trunc(toNum(x)),
  sprintf: (env, [format, ...args]) => sprintf(toStr(format), args),
};

// ---------- Running ----------

function splitFields(line, fs, compileRegex) {
  if (line === "") return [];
  if (fs === " ") return line.split(/[ \t\n]+/).filter(Boolean);
  if (fs.length === 1) return line.split(fs);
  return line.split(compileRegex(fs));
}

/**
 * Compile an awk program. Returns run(lines, { fs }) -> output lines, with
 * run.readsInput false for BEGIN-only programs.
 * @param {string} source
 * @param {(pattern: string) => RegExp} compileRegex  POSIX ERE -> RegExp
 */
export function compileAwk(source, compileRegex) {
  const rules = new Parser(tokenize(source), compileRegex).program();

  const run = (lines, { fs = " " } = {}) => {
    const vars = new Map([["FS", fs], ["OFS", " "]]);
    const env = {
      arrays: new Map(),
      record: "",
      fields: [],
      NR: 0,
      out: "",
      field(i) {
        if (i < 0) throw new AwkError(`attempt to access field ${i}`);
        const n = Math.trunc(i);
        return n === 0 ? this.record : this.fields[n - 1] ?? "";
      },
      getVar(name) {
        if (name === "NR") return this.NR;
        if (name === "NF") return this.fields.length;
        if (this.arrays.has(name)) throw new AwkError(`can't use array ${name} as a plain value`);
        return vars.get(name);
      },
      setVar(name, v) {
        if (name === "NR") this.NR = toNum(v);
        else if (name === "NF") throw new AwkError("assigning to NF isn't supported");
        else if (this.arrays.has(name)) throw new AwkError(`can't assign to array ${name}`);
        else vars.set(name, v);
      },
      array(name) {
        if (vars.has(name) && !["FS", "OFS"].includes(name)) throw new AwkError(`can't use ${name} as an array`);
        let array = this.arrays.get(name);
        if (!array) {
          array = new Map();
          this.arrays.set(name, array);
        }
        return array;
      },
    };

    const runBlock = (block) => {
      try {
        block(env);
      } catch (e) {
        if (e === NEXT) throw new AwkError("next can't be used in BEGIN or END");
        throw e;
      }
    };

    rules.begin.forEach(runBlock);
    for (const line of lines) {
      env.NR++;
      env.record = line;
      env.fields = splitFields(line, toStr(vars.get("FS")), compileRegex);
      try {
        for (const { pattern, action } of rules.main) {
          if (pattern && !truthy(pattern.eval(env))) continue;
          if (action) action(env);
          else env.out += env.record + "\n";
        }
      } catch (e) {
        if (e !== NEXT) throw e;
      }
    }
    rules.end.forEach(runBlock);

    if (env.out === "") return [];
    const out = env.out.split("\n");
    if (out[out.length - 1] === "") out.pop();
    return out;
  };
  // Like awk, a program with only BEGIN blocks doesn't read any input.
  run.readsInput = rules.main.length > 0 || rules.end.length > 0;
  return run;
}

export { formatNumber, sprintf };
