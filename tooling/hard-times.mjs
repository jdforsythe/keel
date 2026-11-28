// S0016: a hard-coded time bound in test code. `KEEL_TEST_TIME_SCALE` (test-time.ts) scales every bound a test sets
// through `testTime`, so a slow machine's run can be rehearsed here, and never a time set through `fixedTime`. A bound
// written as a bare number leaves the choice unstated (test-times.ts scales a bound a vitest call states as numbers
// only, and nothing else), so in a test or support file, a smoke or a conformance file, a number written outside a
// `testTime(...)` (a bound, scaled) or `fixedTime(...)` (the machine's own work or an input to the code under test,
// not scaled) call is refused at
//  - a vitest call's bound (the argument after the name or the callback of `it`, `test`, `describe` and `suite`, after
//    a hook's callback, or an options object's `timeout`) that is numbers only, or holds a number of 100 ms or more;
//  - a `timeout`, `testTimeout` or `hookTimeout` property of 100 ms or more (10^9 and over is an instant, not a time);
//  - `AbortSignal.timeout(...)`;
//  - the initializer of a variable or a parameter's default whose name says it holds a time (`ms`, `…Ms`, `…_MS`,
//    `…Timeout`, `TIMEOUT…`) or that a vitest call's bound reads;
//  - a deadline `Date.now() + …` or `performance.now() + …`.
import { Visitor, parseSync } from "oxc-parser";

const TIMED = new Set(["testTime", "fixedTime"]);
const TIMEOUT_KEYS = new Set(["timeout", "testTimeout", "hookTimeout"]);
const TIME_NAME = /^ms$|Ms$|_MS$|^[A-Z_]*_MS_|[tT]imeout$|^TIMEOUT/;
const TESTS = new Set(["it", "test", "describe", "suite"]);
const HOOKS = new Set(["beforeAll", "afterAll", "beforeEach", "afterEach"]);
/** Smaller numbers are counts and factors (`2 * T`), not times; larger ones are instants (epoch milliseconds). */
const LEAST_MS = 100;
const MOST_MS = 1e9;

const nameOf = (n) => (n?.type === "Identifier" ? n.name : undefined);
const keyOf = (p) =>
  p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? String(p.key.value) : undefined;

/** Whether `n` holds a number of LEAST_MS or more that no `testTime` or `fixedTime` call wraps. */
function bare(n) {
  if (n === null || typeof n !== "object") return false;
  if (n.type === "CallExpression" && TIMED.has(nameOf(n.callee) ?? "")) return false;
  if (n.type === "Literal") return typeof n.value === "number" && n.value >= LEAST_MS && n.value < MOST_MS;
  // A function's body is not the value's own time.
  if (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression") return false;
  for (const [k, v] of Object.entries(n)) {
    if (k === "parent" || k === "start" || k === "end") continue;
    if (Array.isArray(v) ? v.some(bare) : bare(v)) return true;
  }
  return false;
}

const isClock = (n) =>
  n?.type === "CallExpression" &&
  n.callee?.type === "MemberExpression" &&
  ((nameOf(n.callee.object) === "Date" && nameOf(n.callee.property) === "now") ||
    (nameOf(n.callee.object) === "performance" && nameOf(n.callee.property) === "now"));

/** The vitest names the file's imports bind, by local name. */
function vitestNames(program) {
  const names = new Map();
  for (const s of program.body)
    if (s.type === "ImportDeclaration" && s.source.value === "vitest")
      for (const sp of s.specifiers)
        if (sp.type === "ImportSpecifier") names.set(sp.local.name, nameOf(sp.imported) ?? sp.imported.value);
  return names;
}

function baseOf(callee) {
  for (let c = callee; c; ) {
    if (c.type === "Identifier") return c.name;
    if (c.type === "MemberExpression") c = c.object;
    else if (c.type === "CallExpression") c = c.callee;
    else return undefined;
  }
  return undefined;
}

/** Whether `n` is a number or arithmetic over numbers only. */
function numbersOnly(n) {
  if (n === null || typeof n !== "object") return false;
  if (n.type === "Literal") return typeof n.value === "number";
  if (n.type === "ParenthesizedExpression") return numbersOnly(n.expression);
  if (n.type === "UnaryExpression") return numbersOnly(n.argument);
  if (n.type === "BinaryExpression") return numbersOnly(n.left) && numbersOnly(n.right);
  return false;
}

/** Add the names `n` reads as a time to `into`: the bound itself, or a term of a sum (a factor of a product is a count). */
function terms(n, into) {
  if (n === null || typeof n !== "object") return;
  if (n.type === "Identifier") into.add(n.name);
  else if (n.type === "ParenthesizedExpression") terms(n.expression, into);
  else if (n.type === "BinaryExpression" && (n.operator === "+" || n.operator === "-")) {
    terms(n.left, into);
    terms(n.right, into);
  } else if (n.type === "ObjectExpression") for (const p of n.properties) terms(p.value, into);
}

/**
 * The bounds the vitest calls of `program` state: each bound argument (an options object's `timeout` value in its
 * place), and the names those read (a `const` bound declared once and passed to vitest).
 */
function vitestBounds(program) {
  const vitest = vitestNames(program);
  const bounds = [];
  const names = new Set();
  if (vitest.size === 0) return { bounds, names };
  new Visitor({
    CallExpression(n) {
      const imported = vitest.get(baseOf(n.callee) ?? "");
      if (imported === undefined) return;
      const at = TESTS.has(imported) ? [1, 2] : HOOKS.has(imported) ? [1] : [];
      for (const i of at) {
        const a = n.arguments[i];
        if (a === undefined || a.type === "ArrowFunctionExpression" || a.type === "FunctionExpression") continue;
        if (a.type === "SpreadElement") continue;
        if (a.type === "ObjectExpression") {
          const t = a.properties.find((p) => p.type === "Property" && keyOf(p) === "timeout");
          if (t !== undefined) bounds.push(t.value);
        } else bounds.push(a);
        terms(a.type === "ObjectExpression" ? a.properties.find((p) => keyOf(p) === "timeout")?.value : a, names);
      }
    },
  }).visit(program);
  return { bounds, names };
}

/**
 * Each hard-coded time in `source` (a file at `filename`, which picks the parser's language), as
 * `{ line, col, text, message }` with the 1-based line and column of the time and its source text.
 */
export function hardTimes(source, filename) {
  const program = parseSync(filename, source).program;
  const { bounds, names } = vitestBounds(program);
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
  const where = (offset) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - lineStarts[lo] + 1 };
  };
  const out = [];
  const seen = new Set();
  const add = (n, what) => {
    if (seen.has(n.start)) return;
    seen.add(n.start);
    const text = source.slice(n.start, n.end).replace(/\s+/g, " ");
    out.push({
      ...where(n.start),
      text,
      message: `${what} ${text} is a hard-coded time: a bound goes through testTime(), an input through fixedTime()`,
    });
  };
  for (const b of bounds) if (numbersOnly(b) || bare(b)) add(b, "a vitest bound");
  new Visitor({
    Property(p) {
      if (!TIMEOUT_KEYS.has(keyOf(p) ?? "")) return;
      if (bare(p.value)) add(p.value, keyOf(p));
    },
    CallExpression(n) {
      const c = n.callee;
      if (c.type === "MemberExpression" && nameOf(c.object) === "AbortSignal" && nameOf(c.property) === "timeout")
        if (bare(n.arguments[0])) add(n.arguments[0], "AbortSignal.timeout");
    },
    VariableDeclarator(d) {
      const name = nameOf(d.id);
      if (name === undefined || !(TIME_NAME.test(name) || names.has(name))) return;
      if (d.init && bare(d.init)) add(d.init, name);
    },
    AssignmentPattern(a) {
      const name = nameOf(a.left);
      if (name !== undefined && TIME_NAME.test(name) && bare(a.right)) add(a.right, name);
    },
    BinaryExpression(b) {
      if (b.operator !== "+") return;
      if (isClock(b.left) && bare(b.right)) add(b.right, "deadline");
      else if (isClock(b.right) && bare(b.left)) add(b.left, "deadline");
    },
  }).visit(program);
  return out.sort((a, b) => a.line - b.line || a.col - b.col);
}
