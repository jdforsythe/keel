// Spec: k.unsafe, clause "In `modules/m/a.ts`, `function isT(x: unknown): x is { run(n: number): string } { return typeof x === 'object' && x !== null && typeof Reflect.get(x, 'run') === 'function' }`, the same with `asserts x is { run(n: number): string }`, `const isL = (x: unknown): x is { a: { b: () => number } } => true` and `function isE<E>(x: unknown): x is Box<E> { return true }` are one E1762 each at the return type, the first message `type predicate claims a call signature it does not prove: check it, or use unsafe()`; `(x: unknown): x is () => void => typeof x === 'function'` and `(x: unknown): x is Store<unknown> => isStore(x)` are none."
// Spec: k.unsafe, clause "In `modules/m/unsafe/a.ts`, that `isT` declared inside the arrow function given to `unsafe('one two three four five six seven eight', () => ...)` is no E1762."
// Spec: k.identity, clause "In `modules/m/a.ts`, each of these is one E1762 at the return type: `(x: unknown): x is { admin: boolean } => typeof x === 'object' && x !== null` (`property admin`); `function a(x: unknown): asserts x is { admin: true } {}` (`its whole type`); `(x: unknown): x is Promise<number> => x instanceof Promise` (`a type argument`); `(x: unknown): x is Map<string, () => number> => x instanceof Map` (`a type argument`); `(x: unknown): x is { run(n: number): string } => typeof x === 'object' && x !== null && typeof Reflect.get(x, 'run') === 'function'` (`a call signature`); `function isE<E>(x: unknown): x is Box<E> { return true }` (`a type parameter`); and a predicate claiming `Store<unknown>` by `Object.hasOwn(x, Symbol.for('keel.store'))` (`a call signature`)."
// Spec: k.identity, clause "In `modules/m/a.ts`, each of these is no E1762: `(x: unknown): x is { id: string; tags: string[] } => typeof x === 'object' && x !== null && typeof Reflect.get(x, 'id') === 'string' && Array.isArray(Reflect.get(x, 'tags')) && Reflect.get(x, 'tags').every(isString)` with `isString` proven by `typeof`; `(x: unknown): x is User => User.parse(x).ok`; `(x: unknown): x is Store<unknown> => isStore(x)`; `(x: unknown): x is Map<unknown, unknown> => x instanceof Map`; `(x: unknown): x is Job => x instanceof Job` with `class Job` in the file; `(x: unknown): x is () => void => typeof x === 'function'`; `function isOf<T>(S: Schema<T>, x: unknown): x is T { return S.parse(x).ok }`; and `function a(x: unknown): asserts x is string { if (!(typeof x === 'string')) defect('no string') }`."
// Spec: k.identity, clause "With `const made = new WeakSet<object>()` at module level and `function make(): Job { const j = build(); made.add(j); return j }`, `(x: unknown): x is Job => typeof x === 'object' && x !== null && made.has(x)` is no E1762; with `export const made`, with `register(made)` anywhere in the file, or with a second `made.add(v)` whose `v` is typed `object`, it is one."
// k.unsafe, Rules "E1762 a type predicate or assertion whose body does not prove its type (k.identity)"
// Seed 1337. Fixtures are source text over in-memory file maps with the type pass on (E1762 reads the claimed type); the `unsafe` call is built from a constant so this file's own source holds no literal call, only fixture text does.
// Assumption: "at the return type" is the first character of the predicate (`x is ...`, or `asserts ...`) after the `:` and one space.
// Assumption: a fixture's other diagnostics (E1752 for a second export, a TS error for an unused name) are not counted: only E1762 is read.
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";

const U = "unsafe";
const PATH = "modules/m/a.ts";
const MANIFEST = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD =
  "import { defect, ok } from '@keel/schema'\nimport type { Schema } from '@keel/schema'\nimport { isStore } from '@keel/store'\nimport type { Store } from '@keel/store'\ninterface Box<T> { v: T }\ndeclare const User: Schema<{ id: string }>\nexport interface Job { id: string }\ndeclare function build(): Job\ndeclare function register(x: unknown): void\n";
const HELPER = `function ${U}<T>(reason: string, fn: () => T): T { return fn() }\n`;
const REASON = "'one two three four five six seven eight'";
const PREFIX = "type predicate claims ";
const SUFFIX = " it does not prove: check it, or use unsafe()";

const e1762 = (source: string, path = PATH, extra: Files = []) =>
  check([MANIFEST, ...extra, { path, source }]).diagnostics.filter((d) => d.code === "E1762");
const at = (source: string, needle: string): { line: number; col: number } => {
  const before = source.slice(0, source.indexOf(needle)).split("\n");
  return { line: before.length, col: (before[before.length - 1]?.length ?? 0) + 1 };
};
const wrap = (decl: string): string => `${HEAD}${decl}\n`;

const REFUSED: readonly (readonly [string, string, string])[] = [
  [
    "const p = (x: unknown): x is { admin: boolean } => typeof x === 'object' && x !== null",
    "x is { admin",
    "property admin",
  ],
  ["function a(x: unknown): asserts x is { admin: true } {}", "asserts x is", "its whole type"],
  ["const p = (x: unknown): x is Promise<number> => x instanceof Promise", "x is Promise", "a type argument"],
  ["const p = (x: unknown): x is Map<string, () => number> => x instanceof Map", "x is Map", "a type argument"],
  [
    "const p = (x: unknown): x is { run(n: number): string } => typeof x === 'object' && x !== null && typeof Reflect.get(x, 'run') === 'function'",
    "x is { run",
    "a call signature",
  ],
  ["function isE<E>(x: unknown): x is Box<E> { return true }", "x is Box", "a type parameter"],
  [
    "const p = (x: unknown): x is Store<unknown> => typeof x === 'object' && x !== null && Object.hasOwn(x, Symbol.for('keel.store'))",
    "x is Store",
    "a call signature",
  ],
  [
    "function isT(x: unknown): x is { run(n: number): string } { return typeof x === 'object' && x !== null && typeof Reflect.get(x, 'run') === 'function' }",
    "x is { run",
    "a call signature",
  ],
  ["function isT(x: unknown): asserts x is { run(n: number): string } {}", "asserts x is", "its whole type"],
  ["const isL = (x: unknown): x is { a: { b: () => number } } => true", "x is { a", "a call signature"],
];
for (const [decl, needle, what] of REFUSED) {
  test(`${decl} is one E1762 at the return type, message names ${what}`, () => {
    const src = wrap(decl);
    const ds = e1762(src);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(`${PREFIX}${what}${SUFFIX}`);
    expect(ds[0]?.fix).toBeUndefined();
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, needle));
  });
}

const ACCEPTED: readonly string[] = [
  "const isString = (x: unknown): x is string => typeof x === 'string'\nconst p = (x: unknown): x is { id: string; tags: string[] } => typeof x === 'object' && x !== null && typeof Reflect.get(x, 'id') === 'string' && Array.isArray(Reflect.get(x, 'tags')) && Reflect.get(x, 'tags').every(isString)",
  "const p = (x: unknown): x is { id: string } => User.parse(x).ok",
  "const p = (x: unknown): x is Store<unknown> => isStore(x)",
  "const p = (x: unknown): x is Map<unknown, unknown> => x instanceof Map",
  "class Klass { id = '' }\nconst p = (x: unknown): x is Klass => x instanceof Klass",
  "const p = (x: unknown): x is () => void => typeof x === 'function'",
  "function isOf<T>(S: Schema<T>, x: unknown): x is T { return S.parse(x).ok }",
  "function a(x: unknown): asserts x is string { if (!(typeof x === 'string')) defect('no string') }",
];
for (const decl of ACCEPTED) {
  test(`${decl.split("\n").pop()} is no E1762`, () => {
    expect(e1762(wrap(decl))).toEqual([]);
  });
}

const MADE = "const made = new WeakSet<object>()\nfunction make(): Job { const j = build(); made.add(j); return j }\n";
const PRED = "const p = (x: unknown): x is Job => typeof x === 'object' && x !== null && made.has(x)";
test("the module's own WeakSet, every add of a Job, proves Job: no E1762", () => {
  expect(e1762(wrap(`${MADE}${PRED}`))).toEqual([]);
});
test("with `export const made` the same predicate is one E1762", () => {
  expect(e1762(wrap(`export ${MADE}${PRED}`))).toHaveLength(1);
});
test("with `register(made)` anywhere in the file the same predicate is one E1762", () => {
  expect(e1762(wrap(`${MADE}register(made)\n${PRED}`))).toHaveLength(1);
});
test("with a second `made.add(v)` whose `v` is typed `object` the same predicate is one E1762", () => {
  expect(e1762(wrap(`${MADE}function other(v: object) { made.add(v) }\n${PRED}`))).toHaveLength(1);
});

const [FIRST] = REFUSED;
test("`isT` declared inside the arrow function given to `unsafe('one two three four five six seven eight', () => ...)` is no E1762 in modules/m/unsafe/a.ts", () => {
  const decl = FIRST?.[0] ?? "";
  const lifted = `${HEAD}${HELPER}export const a = ${U}(${REASON}, () => { ${decl}; return p })\n`;
  expect(e1762(lifted, "modules/m/unsafe/a.ts")).toEqual([]);
  expect(e1762(wrap(decl))).toHaveLength(1);
});

test("E1762 is reported in a library's files outside a lifted range", () => {
  const ROOT = "node_modules/@acme/charts";
  const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
  const files: Files = [
    manifestFile({ id: "shop", deps: ["@acme/charts"] }),
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library" }),
    },
    manifestFile({ id: "charts", deps: [], capabilities: [], exports: [] }, ROOT),
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
    { path: `${ROOT}/src/a.ts`, source: wrap(FIRST?.[0] ?? "") },
  ];
  const ds = check(files).diagnostics.filter((d) => d.code === "E1762" && d.path === `${ROOT}/src/a.ts`);
  expect(ds).toHaveLength(1);
});
