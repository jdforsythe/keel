// Spec: k.errors, clause "In `modules/m/a.ts`, `try { f() } finally { g() }` is no E1452 and `try { f() } catch { g() } finally { h() }` is one; `defect('x')` (imported from `@keel/schema`) is no E1451 and `throw new Error('x')` is one, message `throw in app code; return err(...) when expected, defect(...) when a bug`."
// Spec: k.errors, clause "In `modules/m/a.ts`, `defect('x', 'E28')`, `defect('x', code)` with `const code = 'E2801'` above it, and `k.defect('x', 'e2801')` under `import * as k from '@keel/schema'` are one E1455 each at the second argument, with no fix; `defect('x')`, `defect('x', 'E2801')` and `` defect(`x ${n}`, 'E2801') `` are none."
// k.errors, Rules "E1451 `throw`, or a call of `Promise.reject`, in app code, message `throw in app code; return err(...) when expected, defect(...) when a bug` (fix: `return err(...)`)"
// k.errors, Rules "E1455 a call of `defect` (`@keel/schema`) whose second argument is not a string literal of `E` and four digits, at that argument, message `defect code is not a literal E and four digits` (no fix)"
// k.errors, Rules "An `unsafe(` range lifts neither E1451 nor E1452 (k.check App code); each finds its callee as k.unsafe One path says."
// Seed 1337. Fixtures are source text over in-memory file maps, `{ types: false }`; the `unsafe` call is built from a
// constant so this file's own source holds no literal call, only fixture text does.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";
import { SEED } from "./support.ts";

const U = "unsafe";
const PATH = "modules/m/a.ts";
const MANIFEST = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const SCHEMA = "import { defect } from '@keel/schema'\n";
const DECLS =
  "declare const e: unknown\ndeclare const n: number\ndeclare const p: Promise<number>\ndeclare function f(): void\ndeclare function g(): void\ndeclare function h(): void\n";
const HELPER = `function ${U}<T>(reason: string, fn: () => T): T { return fn() }\n`;
const MESSAGE = "throw in app code; return err(...) when expected, defect(...) when a bug";
const E1455_MESSAGE = "defect code is not a literal E and four digits";

const run = (source: string, path = PATH) => check([MANIFEST, { path, source }], { types: false }).diagnostics;
const of = (ds: ReturnType<typeof run>, code: string) => ds.filter((d) => d.code === code);

// ---- try/finally and E1452 ----

test("In `modules/m/a.ts`, `try { f() } finally { g() }` is no E1452", () => {
  expect(of(run(`${DECLS}export function a() { try { f() } finally { g() } }\n`), "E1452")).toEqual([]);
});

test("In `modules/m/a.ts`, `try { f() } catch { g() } finally { h() }` is one E1452", () => {
  expect(of(run(`${DECLS}export function a() { try { f() } catch { g() } finally { h() } }\n`), "E1452")).toHaveLength(
    1,
  );
});

test("try/finally with no catch is no E1452 whatever the bodies, and with a catch is one", () => {
  const stmt = fc.constantFrom("f()", "g()", "h(); f()", "const v = n + 1; void v");
  fc.assert(
    fc.property(stmt, stmt, stmt, (a, b, c) => {
      const plain = `${DECLS}export function a() { try { ${a} } finally { ${b} } }\n`;
      const caught = `${DECLS}export function a() { try { ${a} } catch { ${b} } finally { ${c} } }\n`;
      expect(of(run(plain), "E1452")).toEqual([]);
      expect(of(run(caught), "E1452")).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

// ---- defect and E1451 ----

test("`defect('x')` (imported from `@keel/schema`) is no E1451", () => {
  expect(of(run(`${SCHEMA}export function a(): never { return defect('x') }\n`), "E1451")).toEqual([]);
  expect(of(run(`${SCHEMA}export const a = (n: number) => n > 0 ? n : defect('x')\n`), "E1451")).toEqual([]);
});

test("`throw new Error('x')` is one E1451, message `throw in app code; return err(...) when expected, defect(...) when a bug`", () => {
  const ds = of(run("export function a(): never { throw new Error('x') }\n"), "E1451");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(MESSAGE);
  expect(ds[0]?.message.length).toBeLessThan(90);
});

test("the message of E1451 names `defect` for every thrown expression", () => {
  const thrownExpr = fc.constantFrom("new Error('x')", "e", "new RangeError('y')", "'text'");
  fc.assert(
    fc.property(thrownExpr, (x) => {
      const ds = of(run(`${DECLS}export function a(): never { throw ${x} }\n`), "E1451");
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toContain("defect(...)");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

// ---- E1451 and E1452 beyond `throw` and `try`/`catch` ----

test("E1451 is a call of `Promise.reject` as it is a `throw`, with the same message", () => {
  const ds = of(run(`${DECLS}export function a() { return Promise.reject(e) }\n`), "E1451");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(MESSAGE);
});

test("E1452 is a `.then()` given a second argument, `Promise.allSettled` and `Promise.any`, and not a `.then()` given one", () => {
  const body = (expr: string) => `${DECLS}export function a() { return ${expr} }\n`;
  for (const expr of ["p.then(f, g)", "Promise.allSettled([p])", "Promise.any([p])"]) {
    expect(of(run(body(expr)), "E1452"), expr).toHaveLength(1);
  }
  expect(of(run(body("p.then(f)")), "E1452")).toEqual([]);
});

// ---- E1455 ----

/** The 1-based line and column of `needle` in `source`, searching after `after`. */
const at = (source: string, needle: string, after = ""): { line: number; col: number } => {
  const i = source.indexOf(needle, after === "" ? 0 : source.indexOf(after));
  const before = source.slice(0, i).split("\n");
  return { line: before.length, col: (before[before.length - 1]?.length ?? 0) + 1 };
};

test("In `modules/m/a.ts`, `defect('x', 'E28')` is one E1455 at the second argument, with no fix", () => {
  const src = `${SCHEMA}export function a(): never { return defect('x', 'E28') }\n`;
  const ds = of(run(src), "E1455");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
  expect(ds[0]?.message).toBe(E1455_MESSAGE);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "'E28'"));
});

test("`defect('x', code)` with `const code = 'E2801'` above it is one E1455 at the second argument, with no fix", () => {
  const src = `${SCHEMA}const code = 'E2801'\nexport function a(): never { return defect('x', code) }\n`;
  const ds = of(run(src), "E1455");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "code)", "return defect"));
});

test("`k.defect('x', 'e2801')` under `import * as k from '@keel/schema'` is one E1455 at the second argument, with no fix", () => {
  const src = `import * as k from '@keel/schema'\nexport function a(): never { return k.defect('x', 'e2801') }\n`;
  const ds = of(run(src), "E1455");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "'e2801'"));
});

test("a `defect` imported under another name is one E1455 for a code that is not a literal `E` and four digits", () => {
  const src = `import { defect as fail } from '@keel/schema'\nexport function a(): never { return fail('x', 'E28') }\n`;
  expect(of(run(src), "E1455")).toHaveLength(1);
});

test("`defect('x')`, `defect('x', 'E2801')` and a template message with a literal code are no E1455", () => {
  for (const call of ["defect('x')", "defect('x', 'E2801')", "defect(`x ${n}`, 'E2801')"]) {
    const src = `${SCHEMA}declare const n: number\nexport function a(): never { return ${call} }\n`;
    expect(of(run(src), "E1455")).toEqual([]);
  }
});

test("property: a second argument that is a string literal of `E` and four digits is no E1455, any other literal is one", () => {
  const good = fc.integer({ min: 0, max: 9999 }).map((v) => `E${String(v).padStart(4, "0")}`);
  const bad = fc.oneof(
    fc.integer({ min: 0, max: 999 }).map((v) => `E${v}`),
    fc.integer({ min: 10000, max: 999999 }).map((v) => `E${v}`),
    fc.integer({ min: 1000, max: 9999 }).map((v) => `e${v}`),
    fc.integer({ min: 1000, max: 9999 }).map((v) => `X${v}`),
    fc.constant(""),
    fc.constant("E1.5"),
    fc.constant("E28a1"),
  );
  fc.assert(
    fc.property(good, bad, (g, b) => {
      expect(of(run(`${SCHEMA}export function a(): never { return defect('x', '${g}') }\n`), "E1455")).toEqual([]);
      const ds = of(run(`${SCHEMA}export function a(): never { return defect('x', '${b}') }\n`), "E1455");
      expect(ds).toHaveLength(1);
      expect(ds[0]?.fix).toBeUndefined();
    }),
    { seed: SEED, numRuns: 60 },
  );
});

// ---- an `unsafe(` range lifts neither E1451 nor E1452 ----

const STMTS: readonly (readonly [string, string])[] = [
  ["E1451", "throw e"],
  ["E1451", "Promise.reject(e)"],
  ["E1452", "try { f() } catch { g() }"],
  ["E1452", "p.catch(() => 0)"],
  ["E1452", "p.then(f, g)"],
  ["E1452", "Promise.allSettled([p])"],
  ["E1452", "Promise.any([p])"],
  ["E1452", "for (;;) { try { f() } finally { break } }"],
];
const insideSrc = (stmt: string) => `${DECLS}${HELPER}export const a = ${U}('r', () => { ${stmt} })\n`;
const outsideSrc = (stmt: string) => `${DECLS}export function a() { ${stmt} }\n`;
const UNSAFE_PATH = "modules/m/unsafe/a.ts";

test("An `unsafe(` range lifts neither E1451 nor E1452: each is one diagnostic inside the arrow function given to `unsafe('r', () => ...)` and one outside it", () => {
  for (const [code, stmt] of STMTS) {
    expect(of(run(insideSrc(stmt), UNSAFE_PATH), code), `${stmt} inside`).toHaveLength(1);
    expect(of(run(outsideSrc(stmt), UNSAFE_PATH), code), `${stmt} outside`).toHaveLength(1);
  }
});

test("property: E1451 and E1452 read a statement inside a lifted range exactly as they read it in an ordinary file", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...STMTS),
      fc.constantFrom(UNSAFE_PATH, "modules/m/unsafe/b.ts"),
      ([code, stmt], path) => {
        const inside = of(run(insideSrc(stmt), path), code).length;
        const plain = of(run(outsideSrc(stmt), PATH), code).length;
        expect(inside).toBe(plain);
        expect(inside).toBe(1);
      },
    ),
    { seed: SEED, numRuns: 30 },
  );
});

test("a bare `throw` is E1451 in a library's `unsafe(` range, as in an app's", () => {
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
    { path: `${ROOT}/unsafe/a.ts`, source: insideSrc("throw e") },
    { path: `${ROOT}/unsafe/b.ts`, source: insideSrc("try { f() } catch { g() }") },
  ];
  const ds = check(files, { types: false }).diagnostics;
  expect(ds.filter((d) => d.code === "E1451" && d.path === `${ROOT}/unsafe/a.ts`)).toHaveLength(1);
  expect(ds.filter((d) => d.code === "E1452" && d.path === `${ROOT}/unsafe/b.ts`)).toHaveLength(1);
});
