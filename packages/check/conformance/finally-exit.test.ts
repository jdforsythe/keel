// Spec: k.errors, clause "In `modules/m/a.ts`, `function f() { try { return defect('bug') } finally { return 7 } }`, `for (;;) { try { g() } finally { break } }` and `for (const x of xs) { try { g(x) } finally { continue } }` are one E1452 each, message `control leaves finally and drops its throw`, at the `return`, `break` or `continue`; `try { g() } finally { for (;;) { break } }` and `try { g() } finally { h() }` are none."
// k.errors, Rules "A `return`, `break` or `continue` whose target lies outside the `finally` block holding it, at the statement: `control leaves finally and drops its throw`."
// Seed 1337. Fixtures are source text over in-memory file maps, `{ types: false }`; the structure-lint half is in packages/cli/conformance/structure-lint-finally-exit.test.ts.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";
import { SEED } from "./support.ts";

const PATH = "modules/m/a.ts";
const MANIFEST = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const MESSAGE = "control leaves finally and drops its throw";
const HEAD =
  "import { defect } from '@keel/schema'\ndeclare const xs: number[]\ndeclare function g(x?: number): void\ndeclare function h(): void\n";

const run = (body: string, path = PATH) =>
  check([MANIFEST, { path, source: `${HEAD}${body}\n` }] satisfies Files, { types: false }).diagnostics.filter(
    (d) => d.code === "E1452",
  );
/** The 1-based line and column of the first `needle` in the fixture `HEAD` + `body`. */
const at = (body: string, needle: string): { line: number; col: number } => {
  const source = `${HEAD}${body}\n`;
  const before = source.slice(0, source.indexOf(needle)).split("\n");
  return { line: before.length, col: (before[before.length - 1]?.length ?? 0) + 1 };
};

const RETURN = "export function f() { try { return defect('bug') } finally { return 7 } }";
const BREAK = "export function f() { for (;;) { try { g() } finally { break } } }";
const CONTINUE = "export function f() { for (const x of xs) { try { g(x) } finally { continue } } }";

test("`function f() { try { return defect('bug') } finally { return 7 } }` is one E1452, message `control leaves finally and drops its throw`, at the `return`", () => {
  const ds = run(RETURN);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(MESSAGE);
  expect(ds[0]?.fix).toBeUndefined();
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(RETURN, "return 7"));
});

test("`for (;;) { try { g() } finally { break } }` is one E1452, message `control leaves finally and drops its throw`, at the `break`", () => {
  const ds = run(BREAK);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(MESSAGE);
  expect(ds[0]?.fix).toBeUndefined();
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(BREAK, "break"));
});

test("`for (const x of xs) { try { g(x) } finally { continue } }` is one E1452, message `control leaves finally and drops its throw`, at the `continue`", () => {
  const ds = run(CONTINUE);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(MESSAGE);
  expect(ds[0]?.fix).toBeUndefined();
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(CONTINUE, "continue"));
});

test("`try { g() } finally { for (;;) { break } }` and `try { g() } finally { h() }` are no E1452", () => {
  expect(run("export function f() { try { g() } finally { for (;;) { break } } }")).toEqual([]);
  expect(run("export function f() { try { g() } finally { h() } }")).toEqual([]);
});

// A `return`, `break` or `continue` is E1452 exactly when its target lies outside the `finally` block holding it.
const LEAVING: readonly string[] = [
  "return 7",
  "return",
  "break",
  "continue",
  "break outer",
  "continue outer",
  "return defect('other')",
];
const STAYING: readonly string[] = [
  "for (;;) { break }",
  "for (const y of xs) { if (y > 1) continue; g(y) }",
  "const k = () => { return 1 }; k()",
  "function inner() { return 1 }; inner()",
  "switch (xs.length) { case 1: g(); break; default: h() }",
  "inner: for (;;) { break inner }",
];

test("property: a `return`, `break` or `continue` leaving a `finally` is one E1452, and one whose target lies inside it is none, in any enclosing function, loop or label", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...LEAVING),
      fc.constantFrom(...STAYING),
      fc.constantFrom("function", "arrow", "method"),
      (leaving, staying, shape) => {
        const loopBody = (inner: string) => `outer: for (;;) { try { g() } finally { ${inner} } }`;
        const wrap = (inner: string) =>
          shape === "function"
            ? `export function f() { ${loopBody(inner)} }`
            : shape === "arrow"
              ? `export const f = () => { ${loopBody(inner)} }`
              : `export const o = { f() { ${loopBody(inner)} } }`;
        expect(run(wrap(leaving)), `${shape}: ${leaving}`).toHaveLength(1);
        expect(run(wrap(staying)), `${shape}: ${staying}`).toEqual([]);
      },
    ),
    { seed: SEED, numRuns: 80 },
  );
});

test("a control exit from a `finally` is one E1452 also when the `try` has a `catch` (which is its own E1452), and inside an `unsafe(` range", () => {
  const caught = run("export function f() { try { g() } catch { h() } finally { return 7 } }");
  expect(caught.filter((d) => d.message === MESSAGE)).toHaveLength(1);
  const U = "unsafe";
  const inRange = `function ${U}<T>(reason: string, fn: () => T): T { return fn() }\nexport const a = ${U}('one two three four five six seven eight', () => { for (;;) { try { g() } finally { break } } })`;
  const ds = run(inRange, "modules/m/unsafe/a.ts");
  expect(ds.filter((d) => d.message === MESSAGE)).toHaveLength(1);
});

test("the exit is reported once per statement however many `finally` blocks nest around it", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 4 }), (depth) => {
      let body = "return 7";
      for (let i = 0; i < depth; i++) body = `try { g() } finally { ${body} }`;
      const ds = run(`export function f() { ${body} }`);
      expect(ds.filter((d) => d.message === MESSAGE)).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
