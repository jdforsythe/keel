// A bound a test file passes to vitest scales with `KEEL_TEST_TIME_SCALE` (test-time.ts) when its text states the time
// as a number. keelConfig adds this transform for test files when the scale is not 1: in a call of `it`, `test`,
// `describe` or `suite` imported from `vitest` (modifiers and `.each(...)`, `.for(...)`, `.skipIf(...)` chains too), the
// argument after the name that is not a function (an options object) and the one after the callback (a number or an
// options object), and the argument after a hook's callback (`beforeAll`, `afterAll`, `beforeEach`, `afterEach`), are
// read. A bound written only from numbers (`60_000`, `2 * 30_000`, an options object's `timeout: 9_000`) is a bare
// number: the wait the test chose, so it is wrapped in a call that multiplies it by the scale. A bound that names
// anything (a const, an import, a call, an expression over `testTime(...)` or `fixedTime(...)`) is not rewritten: the
// helper that produced its value already says whether it scales (`testTime` does, `fixedTime` never does), wherever
// the value is computed. Structure-lint S0016 refuses a bare number in a bound outside a conformance file listed in
// `hard-times-conformance.json`, so the choice is always stated.
import type { Plugin } from "vite";

const TESTS = new Set(["it", "test", "describe", "suite"]);
const HOOKS = new Set(["beforeAll", "afterAll", "beforeEach", "afterEach"]);

type Node = { readonly [key: string]: unknown };

function isNode(x: unknown): x is Node {
  return typeof x === "object" && x !== null && !Array.isArray(x) && typeof Reflect.get(x, "type") === "string";
}

function children(n: Node): Node[] {
  const out: Node[] = [];
  for (const [k, v] of Object.entries(n)) {
    if (k === "parent") continue;
    if (Array.isArray(v)) for (const c of v) if (isNode(c)) out.push(c);
    if (isNode(v)) out.push(v);
  }
  return out;
}

function walk(n: Node, visit: (n: Node) => void): void {
  visit(n);
  for (const c of children(n)) walk(c, visit);
}

function name(n: unknown): string | undefined {
  return isNode(n) && n.type === "Identifier" && typeof n.name === "string" ? n.name : undefined;
}

/** The names `vitest` exports that the file's imports bind, by local name. */
function vitestNames(program: Node): Map<string, string> {
  const names = new Map<string, string>();
  for (const s of children(program)) {
    if (s.type !== "ImportDeclaration" || !isNode(s.source) || s.source.value !== "vitest") continue;
    if (!Array.isArray(s.specifiers)) continue;
    for (const sp of s.specifiers) {
      if (!isNode(sp) || sp.type !== "ImportSpecifier") continue;
      const imported = name(sp.imported);
      const local = name(sp.local);
      if (imported !== undefined && local !== undefined) names.set(local, imported);
    }
  }
  return names;
}

/** The identifier a callee chain starts from: `it` for `it.only`, `it.each(t)` and `it.skipIf(c).concurrent`. */
function baseOf(callee: unknown): string | undefined {
  for (let c: unknown = callee; isNode(c); ) {
    if (c.type === "Identifier") return name(c);
    if (c.type === "MemberExpression") c = c.object;
    else if (c.type === "CallExpression") c = c.callee;
    else return undefined;
  }
  return undefined;
}

/** Whether `n` is a number or arithmetic over numbers only: `60_000`, `-1`, `2 * (30 * 1000)`. */
function numbersOnly(n: unknown): boolean {
  if (!isNode(n)) return false;
  if (n.type === "Literal") return typeof n.value === "number";
  if (n.type === "ParenthesizedExpression") return numbersOnly(n.expression);
  if (n.type === "UnaryExpression") return numbersOnly(n.argument);
  if (n.type === "BinaryExpression") return numbersOnly(n.left) && numbersOnly(n.right);
  return false;
}

/** The `timeout` property's value of an options object literal, when the object states one. */
function timeoutOf(n: Node): unknown {
  if (n.type !== "ObjectExpression" || !Array.isArray(n.properties)) return undefined;
  for (const p of n.properties) {
    if (!isNode(p) || p.type !== "Property" || p.computed === true) continue;
    const k = p.key;
    if (name(k) === "timeout" || (isNode(k) && k.type === "Literal" && k.value === "timeout")) return p.value;
  }
  return undefined;
}

const isFunction = (n: unknown): boolean =>
  isNode(n) && (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression");

/** An expression that scales a number, or an options object's numeric `timeout`, by `scale`. */
export function scaler(scale: number): string {
  const by = (x: string): string => `Math.max(1, Math.round(${x} * ${scale}))`;
  return `((t) => typeof t === "number" ? ${by("t")} : t !== null && typeof t === "object" && typeof t.timeout === "number" ? { ...t, timeout: ${by("t.timeout")} } : t)`;
}

/** The bare numbers a vitest call's bound states (a bound or an options object's `timeout`): each a `[start, end]` source range. */
export function boundRanges(program: Node): [number, number][] {
  const vitest = vitestNames(program);
  if (vitest.size === 0) return [];
  const ranges: [number, number][] = [];
  walk(program, (n) => {
    if (n.type !== "CallExpression" || !Array.isArray(n.arguments)) return;
    const imported = vitest.get(baseOf(n.callee) ?? "");
    if (imported === undefined) return;
    const args: unknown[] = n.arguments;
    const at: number[] = TESTS.has(imported) ? [1, 2] : HOOKS.has(imported) ? [1] : [];
    for (const i of at) {
      const a = args[i];
      if (!isNode(a) || isFunction(a) || a.type === "SpreadElement") continue;
      const bound = numbersOnly(a) ? a : timeoutOf(a);
      if (isNode(bound) && numbersOnly(bound) && typeof bound.start === "number" && typeof bound.end === "number")
        ranges.push([bound.start, bound.end]);
    }
  });
  return ranges;
}

/**
 * `code` with every vitest bound scaled by `scale`, or undefined when the scale is 1 or no call has one. `parse` gives
 * an ESTree program with UTF-16 `start` and `end` offsets. The wrapping sits around each argument, so no line moves.
 */
export function testTimes(code: string, parse: (code: string) => unknown, scale: number): string | undefined {
  if (scale === 1 || !code.includes("vitest")) return undefined;
  const program = parse(code);
  if (!isNode(program)) return undefined;
  const ranges = boundRanges(program);
  if (ranges.length === 0) return undefined;
  const wrap = scaler(scale);
  let out = code;
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0]))
    out = `${out.slice(0, start)}${wrap}(${out.slice(start, end)})${out.slice(end)}`;
  return out;
}

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/** The transform as a vite plugin, after every other transform so it reads plain JavaScript. */
export function testTimesPlugin(scale: number): Plugin {
  return {
    name: "keel:test-times",
    enforce: "post",
    transform(code, id) {
      const file = id.split("?")[0] ?? id;
      if (!TEST_FILE.test(file) || file.includes("/node_modules/")) return null;
      const out = testTimes(code, (c) => this.parse(c), scale);
      return out === undefined ? null : { code: out, map: null };
    },
  };
}
