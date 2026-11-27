// Spec: k.unsafe, clause "In `modules/m/a.ts`, `function isT(x: unknown): x is { run(n: number): string } { return typeof x === 'object' && x !== null && typeof Reflect.get(x, 'run') === 'function' }`, the same with `asserts x is { run(n: number): string }`, `const isL = (x: unknown): x is { a: { b: () => number } } => true` and `function isE<E>(x: unknown): x is Box<E> { return true }` are one E1762 each at the return type; `(x: unknown): x is { id: string; tags: string[] }`, `(x: unknown): x is () => void`, and a key guard `const seen = new WeakSet<object>()` with `(x: unknown): x is Store => typeof x === 'object' && x !== null && seen.has(x)` are none."
// Spec: k.unsafe, clause "In `modules/m/unsafe/a.ts`, that `isT` declared inside the arrow function given to `unsafe('one two three four five six seven eight', () => ...)` is no E1762."
// k.unsafe, Rules "E1762 a type predicate or assertion function, its declaration or arrow function, whose claimed type Type predicates says no body can prove, at the return type, message `type predicate claims <what> no check proves; move it into unsafe()` (`<what>` `a call signature` or `a type parameter`), in app code and a library's files outside lifted ranges and, in this repository, in every package's `src/` (`tooling/structure-lint.mjs` S0019, same position and message), no fix"
// Seed 1337. Fixtures are source text over in-memory file maps with the type pass on (E1762 reads the claimed type); the `unsafe` call is built from a constant so this file's own source holds no literal call, only fixture text does.
// Assumption: "at the return type" is the first character of the predicate (`x is ...`, or `asserts ...`) after the `:` and one space.
// Assumption: a fixture's other diagnostics (E1752 for a second export, a TS error for an unused name) are not counted: only E1762 is read.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";
import { SEED } from "./support.ts";

const U = "unsafe";
const PATH = "modules/m/a.ts";
const MANIFEST = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD = "interface Box<T> { v: T }\ninterface Store { get(): number; id: string }\n";
const HELPER = `function ${U}<T>(reason: string, fn: () => T): T { return fn() }\n`;
const REASON = "'one two three four five six seven eight'";

const e1762 = (source: string, path = PATH, extra: Files = []) =>
  check([MANIFEST, ...extra, { path, source }]).diagnostics.filter((d) => d.code === "E1762");
/** The 1-based line and column of the first `needle` in `source`. */
const at = (source: string, needle: string): { line: number; col: number } => {
  const before = source.slice(0, source.indexOf(needle)).split("\n");
  return { line: before.length, col: (before[before.length - 1]?.length ?? 0) + 1 };
};

const IS_T =
  "function isT(x: unknown): x is { run(n: number): string } { return typeof x === 'object' && x !== null && typeof Reflect.get(x, 'run') === 'function' }";
const ASSERTS_T =
  "function isT(x: unknown): asserts x is { run(n: number): string } { if (typeof x !== 'object') throw new Error('x') }";
const IS_L = "const isL = (x: unknown): x is { a: { b: () => number } } => true";
const IS_E = "function isE<E>(x: unknown): x is Box<E> { return true }";

test("`function isT(x: unknown): x is { run(n: number): string } { ... }` is one E1762 at the return type, message `type predicate claims a call signature no check proves; move it into unsafe()`, no fix", () => {
  const src = `${HEAD}${IS_T}\n`;
  const ds = e1762(src);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe("type predicate claims a call signature no check proves; move it into unsafe()");
  expect(ds[0]?.fix).toBeUndefined();
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "x is { run"));
});

test("the same with `asserts x is { run(n: number): string }` is one E1762 at the return type", () => {
  const src = `${HEAD}${ASSERTS_T}\n`;
  const ds = e1762(src);
  expect(ds).toHaveLength(1);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "asserts x is"));
});

test("`const isL = (x: unknown): x is { a: { b: () => number } } => true` is one E1762 at the return type", () => {
  const src = `${HEAD}${IS_L}\n`;
  const ds = e1762(src);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe("type predicate claims a call signature no check proves; move it into unsafe()");
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "x is { a"));
});

test("`function isE<E>(x: unknown): x is Box<E> { return true }` is one E1762 at the return type, message naming a type parameter", () => {
  const src = `${HEAD}${IS_E}\n`;
  const ds = e1762(src);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe("type predicate claims a type parameter no check proves; move it into unsafe()");
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "x is Box"));
});

test("`(x: unknown): x is { id: string; tags: string[] }` and `(x: unknown): x is () => void` are no E1762", () => {
  expect(e1762(`${HEAD}const isR = (x: unknown): x is { id: string; tags: string[] } => true\n`)).toEqual([]);
  expect(e1762(`${HEAD}const isF = (x: unknown): x is () => void => typeof x === 'function'\n`)).toEqual([]);
});

test("a key guard `const seen = new WeakSet<object>()` with `(x: unknown): x is Store => typeof x === 'object' && x !== null && seen.has(x)` is no E1762", () => {
  const src = `${HEAD}const seen = new WeakSet<object>()\nconst isStore = (x: unknown): x is Store => typeof x === 'object' && x !== null && seen.has(x)\nvoid isStore\n`;
  expect(e1762(src)).toEqual([]);
});

test("a key guard on an own `Symbol.for` key, `Object.hasOwn(x, K)` alone or ending a `&&` chain, is no E1762", () => {
  const bodies = [
    "Object.hasOwn(x, Symbol.for('keel.s'))",
    "typeof x === 'object' && x !== null && Object.hasOwn(x, Symbol.for('keel.s'))",
    "typeof x === 'object' && x !== null && Object.hasOwn(x, K)",
  ];
  for (const body of bodies) {
    const src = `${HEAD}const K = Symbol.for('keel.s')\nconst isStore = (x: object): x is Store => ${body}\nvoid isStore\n`;
    expect(e1762(src), body).toEqual([]);
  }
});

test("a predicate that only looks like a key guard is E1762: an exported set, a set made inside a function, a `Set`, another value than the parameter, a chain not ending in `has`", () => {
  const cases = [
    "export const seen = new WeakSet<object>()\nconst isStore = (x: object): x is Store => seen.has(x)",
    "const isStore = (x: object): x is Store => { const seen = new WeakSet<object>(); return seen.has(x) }",
    "const seen = new Set<object>()\nconst isStore = (x: object): x is Store => seen.has(x)",
    "const seen = new WeakSet<object>()\nconst other: object = {}\nconst isStore = (x: object): x is Store => seen.has(other)",
    "const seen = new WeakSet<object>()\nconst isStore = (x: object): x is Store => seen.has(x) && typeof Reflect.get(x, 'get') === 'function'",
    "const isStore = (x: object): x is Store => Object.hasOwn(x, 'id')",
  ];
  for (const body of cases) expect(e1762(`${HEAD}${body}\nvoid isStore\n`), body).toHaveLength(1);
});

// Function and construct types are parenthesised so that `${t}[]` and a union member read as the type meant, not as a function returning an array.
// A call or construct signature with a parameter, or with a return type other than void, unknown or any, read through
// properties, array elements and union members to any depth.
const SIGNATURES = [
  "((n: number) => void)",
  "(() => number)",
  "(() => string)",
  "((n: number) => string)",
  "{ run(n: number): string }",
  "(new () => Box<number>)",
  "(new (n: number) => void)",
];
const WRAPS: readonly ((t: string) => string)[] = [
  (t) => t,
  (t) => `{ a: ${t} }`,
  (t) => `${t}[]`,
  (t) => `Array<${t}>`,
  (t) => `{ k: 'a' } | ${t}`,
  (t) => `{ a: { b: { c: ${t}[] } } }`,
];
const HARMLESS = [
  "(() => void)",
  "(() => unknown)",
  "(() => any)",
  "{ id: string }",
  "string[]",
  "{ a: { b: number } }",
];

test("property: a claimed type holding a call or construct signature with a parameter or a return other than `void`, `unknown` or `any`, at any depth through properties, array elements and union members, is one E1762", () => {
  fc.assert(
    fc.property(fc.constantFrom(...SIGNATURES), fc.constantFrom(...WRAPS), fc.constantFrom(...WRAPS), (sig, w1, w2) => {
      const claimed = w1(w2(sig));
      const src = `${HEAD}const p = (x: unknown): x is ${claimed} => true\nvoid p\n`;
      expect(e1762(src), claimed).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 120 },
  );
});

test("property: a claimed type holding only plain data, or signatures with no parameter and a `void`, `unknown` or `any` return, is no E1762, at any depth", () => {
  fc.assert(
    fc.property(fc.constantFrom(...HARMLESS), fc.constantFrom(...WRAPS), fc.constantFrom(...WRAPS), (t, w1, w2) => {
      const claimed = w1(w2(t));
      const src = `${HEAD}const p = (x: unknown): x is ${claimed} => true\nvoid p\n`;
      expect(e1762(src), claimed).toEqual([]);
    }),
    { seed: SEED, numRuns: 120 },
  );
});

test("property: a type parameter of the predicate itself, anywhere in the claimed type, is one E1762, for a declaration and for an arrow function", () => {
  fc.assert(
    fc.property(fc.constantFrom(...WRAPS), fc.constantFrom("function", "arrow"), (wrap, form) => {
      const claimed = wrap("T");
      const src =
        form === "function"
          ? `${HEAD}function p<T>(x: unknown): x is ${claimed} { return true }\n`
          : `${HEAD}const p = <T,>(x: unknown): x is ${claimed} => true\nvoid p\n`;
      const ds = e1762(src);
      expect(ds, claimed).toHaveLength(1);
      expect(ds[0]?.message).toContain("a type parameter");
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("`isT` declared inside the arrow function given to `unsafe('one two three four five six seven eight', () => ...)` in `modules/m/unsafe/a.ts` is no E1762", () => {
  const src = `${HEAD}${HELPER}export const a = ${U}(${REASON}, () => { ${IS_T}; return isT })\n`;
  expect(e1762(src, "modules/m/unsafe/a.ts")).toEqual([]);
});

test("every claim E1762 refuses is lifted inside the arrow function given to `unsafe(...)`, and reported in a function declared at the top level of the same file", () => {
  for (const decl of [IS_T, IS_L, IS_E]) {
    const name = decl.includes("isL") ? "isL" : decl.includes("isE") ? "isE" : "isT";
    const inside = `${HEAD}${HELPER}export const a = ${U}(${REASON}, () => { ${decl}; return ${name} })\n`;
    expect(e1762(inside, "modules/m/unsafe/a.ts"), `${name} inside`).toEqual([]);
    const outside = `${HEAD}${HELPER}${decl}\nexport const a = ${U}(${REASON}, () => 1)\n`;
    expect(e1762(outside, "modules/m/unsafe/a.ts"), `${name} outside`).toHaveLength(1);
  }
});

test("E1762 is reported in a library's files outside a lifted range", () => {
  const ROOT = "node_modules/@acme/charts";
  const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
  const project: Files = [
    manifestFile({ id: "shop", deps: ["@acme/charts"] }),
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library" }),
    },
    manifestFile({ id: "charts", deps: [], capabilities: [], exports: [] }, ROOT),
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
    {
      path: `${ROOT}/unsafe/lifted.ts`,
      source: `${HEAD}${HELPER}export const a = ${U}(${REASON}, () => { ${IS_T}; return isT })\n`,
    },
  ];
  const ds = check([...project, { path: `${ROOT}/src/plain.ts`, source: `${HEAD}${IS_T}\n` }]).diagnostics.filter(
    (d) => d.code === "E1762",
  );
  expect(ds.filter((d) => d.path === `${ROOT}/src/plain.ts`)).toHaveLength(1);
  expect(ds.filter((d) => d.path === `${ROOT}/unsafe/lifted.ts`)).toEqual([]);
});
