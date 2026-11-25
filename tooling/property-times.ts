// A property or simulation case's time scales with its runs, and a rendered page's run costs tens of milliseconds on
// a slow machine, so vitest's flat default timeout cannot hold one. keelConfig adds this transform for test files: a
// test (`it` or `test`, `.only` and `.concurrent` too) that declares no options and whose callback calls `properties`
// or `simulate` imported from `@keel/testing`, or fast-check's `assert` (`fc.assert` through its default or namespace
// import, or `assert` imported by name), is given `{ timeout }` of PER_RUN_MS for each run its calls name (a call's
// literal `runs`, or `numRuns` for `assert`, else the default 100), never under the configured test timeout. A call inside a helper the
// test calls is not seen; such a test declares its own time. The watchdog reads each test's timeout, so a hang is
// still bounded from it.
import type { Plugin } from "vite";

/** The time one generated run may take: 100 runs are 30 s. */
export const PER_RUN_MS = 300;
/** Runs `properties`, `simulate` and fast-check's `assert` make when the call names none (k.testing Properties, k.sim). */
const DEFAULT_RUNS = 100;
const TIMED = new Set(["properties", "simulate"]);
const TEST_NAMES = new Set(["it", "test"]);
const TEST_MODIFIERS = new Set(["only", "concurrent", "sequential", "fails"]);

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

function offsets(n: Node): { start: number; end: number } | undefined {
  return typeof n.start === "number" && typeof n.end === "number" ? { start: n.start, end: n.end } : undefined;
}

/** The local names `properties` and `simulate` have in the file, from its `@keel/testing` imports. */
function timedNames(program: Node): Set<string> {
  const names = new Set<string>();
  for (const s of children(program)) {
    if (s.type !== "ImportDeclaration" || !isNode(s.source) || s.source.value !== "@keel/testing") continue;
    if (!Array.isArray(s.specifiers)) continue;
    for (const sp of s.specifiers) {
      if (!isNode(sp) || sp.type !== "ImportSpecifier") continue;
      const imported = name(sp.imported);
      const local = name(sp.local);
      if (imported !== undefined && TIMED.has(imported) && local !== undefined) names.add(local);
    }
  }
  return names;
}

function isTestCallee(callee: unknown): boolean {
  if (name(callee) !== undefined) return TEST_NAMES.has(name(callee) ?? "");
  if (!isNode(callee) || callee.type !== "MemberExpression" || callee.computed === true) return false;
  return TEST_NAMES.has(name(callee.object) ?? "") && TEST_MODIFIERS.has(name(callee.property) ?? "");
}

/** fast-check's names in the file: the objects its default or namespace import binds, and `assert` imported by name. */
function fastCheckNames(program: Node): { objects: Set<string>; asserts: Set<string> } {
  const objects = new Set<string>();
  const asserts = new Set<string>();
  for (const s of children(program)) {
    if (s.type !== "ImportDeclaration" || !isNode(s.source) || s.source.value !== "fast-check") continue;
    if (!Array.isArray(s.specifiers)) continue;
    for (const sp of s.specifiers) {
      if (!isNode(sp)) continue;
      const local = name(sp.local);
      if (local === undefined) continue;
      if (sp.type === "ImportDefaultSpecifier" || sp.type === "ImportNamespaceSpecifier") objects.add(local);
      if (sp.type === "ImportSpecifier" && name(sp.imported) === "assert") asserts.add(local);
    }
  }
  return { objects, asserts };
}

/** Whether a callee is fast-check's `assert`: `fc.assert` on a fast-check object, or a by-name import of it. */
function isFastCheckAssert(callee: unknown, fc: { objects: Set<string>; asserts: Set<string> }): boolean {
  const own = name(callee);
  if (own !== undefined) return fc.asserts.has(own);
  if (!isNode(callee) || callee.type !== "MemberExpression" || callee.computed === true) return false;
  return fc.objects.has(name(callee.object) ?? "") && name(callee.property) === "assert";
}

/** A call's literal `key` option (`runs`, or fast-check's `numRuns`), else the default. */
function runsOf(call: Node, key = "runs"): number {
  const args = Array.isArray(call.arguments) ? call.arguments : [];
  const options: unknown = args[1];
  if (!isNode(options) || options.type !== "ObjectExpression" || !Array.isArray(options.properties))
    return DEFAULT_RUNS;
  for (const p of options.properties) {
    if (!isNode(p) || p.type !== "Property" || name(p.key) !== key || !isNode(p.value)) continue;
    const v = p.value.value;
    return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : DEFAULT_RUNS;
  }
  return DEFAULT_RUNS;
}

/**
 * `code` with `{ timeout }` declared on each test that runs `properties`, `simulate` or fast-check's `assert` and
 * declares no options, or
 * undefined when no test needs one. `parse` gives an ESTree program with UTF-16 `start` and `end` offsets.
 */
export function propertyTimes(code: string, parse: (code: string) => unknown, testTimeout: number): string | undefined {
  if (!code.includes("@keel/testing") && !code.includes("fast-check")) return undefined;
  const program = parse(code);
  if (!isNode(program)) return undefined;
  const timed = timedNames(program);
  const fc = fastCheckNames(program);
  if (timed.size === 0 && fc.objects.size === 0 && fc.asserts.size === 0) return undefined;
  const inserts: { at: number; text: string }[] = [];
  walk(program, (n) => {
    if (n.type !== "CallExpression" || !isTestCallee(n.callee) || !Array.isArray(n.arguments)) return;
    if (n.arguments.length !== 2) return;
    const fn: unknown = n.arguments[1];
    if (!isNode(fn) || (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression")) return;
    const at = offsets(fn);
    if (at === undefined) return;
    let runs = 0;
    walk(fn, (c) => {
      if (c.type !== "CallExpression") return;
      if (timed.has(name(c.callee) ?? "")) runs += runsOf(c);
      else if (isFastCheckAssert(c.callee, fc)) runs += runsOf(c, "numRuns");
    });
    if (runs === 0) return;
    inserts.push({ at: at.start, text: `{ timeout: ${Math.max(testTimeout, runs * PER_RUN_MS)} }, ` });
  });
  if (inserts.length === 0) return undefined;
  let out = code;
  for (const i of inserts.sort((a, b) => b.at - a.at)) out = out.slice(0, i.at) + i.text + out.slice(i.at);
  return out;
}

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/** The transform as a vite plugin, after every other transform so it reads plain JavaScript. */
export function propertyTimesPlugin(testTimeout: number): Plugin {
  return {
    name: "keel:property-times",
    enforce: "post",
    transform(code, id) {
      const file = id.split("?")[0] ?? id;
      if (!TEST_FILE.test(file) || file.includes("/node_modules/")) return null;
      const out = propertyTimes(code, (c) => this.parse(c), testTimeout);
      // Each insertion sits on the test's first line ahead of its callback, so no line moves.
      return out === undefined ? null : { code: out, map: null };
    },
  };
}
