// Every timeout a test file passes to vitest scales with `KEEL_TEST_TIME_SCALE` (test-time.ts). keelConfig adds this
// transform for test files when the scale is not 1: in a call of `it`, `test`, `describe` or `suite` imported from
// `vitest` (modifiers and `.each(...)`, `.for(...)`, `.skipIf(...)` chains too), the argument after the name that is
// not a function (an options object) and the one after the callback (a number or an options object), and the
// argument after a hook's callback (`beforeAll`, `afterAll`, `beforeEach`, `afterEach`), are wrapped in a call that
// multiplies a number, or an object's numeric `timeout`, by the scale. Whatever form the bound takes (a literal, a
// const, an expression), it scales, so a test file cannot set a vitest bound that does not; but for one that calls
// `testTime` or `fixedTime` itself, which scales its own parts (a protocol's fixed wait plus the work around it).
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

/** Whether `n` calls `testTime` or `fixedTime` itself: a bound that holds a fixed part (`fixedTime(10_000) + testTime(20_000)`) scales its own parts. */
function timedByHand(n: Node): boolean {
  let found = false;
  walk(n, (c) => {
    if (c.type === "CallExpression" && (name(c.callee) === "testTime" || name(c.callee) === "fixedTime")) found = true;
  });
  return found;
}

const isFunction = (n: unknown): boolean =>
  isNode(n) && (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression");

/** An expression that scales a number, or an options object's numeric `timeout`, by `scale`. */
export function scaler(scale: number): string {
  const by = (x: string): string => `Math.max(1, Math.round(${x} * ${scale}))`;
  return `((t) => typeof t === "number" ? ${by("t")} : t !== null && typeof t === "object" && typeof t.timeout === "number" ? { ...t, timeout: ${by("t.timeout")} } : t)`;
}

/** The bound arguments of the vitest calls in `program`: each a `[start, end]` source range. */
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
      if (!isNode(a) || isFunction(a) || a.type === "SpreadElement" || timedByHand(a)) continue;
      if (typeof a.start === "number" && typeof a.end === "number") ranges.push([a.start, a.end]);
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
