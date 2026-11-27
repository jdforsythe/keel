// Spec: k.defects, clause "In `modules/m/a.ts`, `` defect(`no row ${n}`) ``, `defect(text)` with `const text = 'x'` above it and `defect('a' + b)` are one E1455 each at the first argument, message `defect message is not a literal: pass values as data, defect('text', { data })`, with no fix; `defect('x')`, `` defect(`x`) ``, `defect('x', { data: { n } })` and `defect('x', 'E2801', { cause: e })` are none."
// Spec: k.defects, clause "In `modules/m/a.ts`, `defect('x', 'E28')`, `defect('x', code)` with `const code = 'E2801'` above it, and `k.defect('x', 'e2801')` under `import * as k from '@keel/schema'` are one E1455 each at the second argument, message `defect code is not a literal E and four digits`; `defect('x', 'E2801', detail)` with `detail` a name is one at `detail`, message `defect detail is not an object literal`."
// Spec: k.defects, clause "In `modules/m/a.ts`, `try { f() } finally { defect('x') }` is one E1452 at the call, message `defect in finally drops the throw in flight`; `try { f() } finally { g(() => defect('x')) }` is none."
// Spec: k.defects, clause "In `modules/m/a.ts`, `if (!r.ok) defect('x')` with `r` a `Result` is one E1455 at the call, message `defect on a failed Result: pass { cause: r.error }`, with a fix that adds `{ cause: r.error }` as the detail; `if (!r.ok) defect('x', { cause: r.error })` is none."
// Spec: k.errors, clause "In `modules/m/a.ts`, `try { f() } finally { g() }` is no E1452 and `try { f() } catch { g() } finally { h() }` is one, message `catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)`."
// Seed 1337. Fixtures are source text over in-memory file maps; the type pass is off except where a fix is applied.
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";
import { MANIFEST, PATH, applyFix, at, checked, codesOf, of, run } from "./rules-support.ts";

const HEAD =
  "import { defect } from '@keel/schema'\nimport type { Result } from '@keel/schema'\ndeclare const n: number\ndeclare const b: string\ndeclare const e: unknown\ndeclare function f(): void\ndeclare function g(fn?: () => void): void\ndeclare function h(): void\n";
const MSG = "defect message is not a literal: pass values as data, defect('text', { data })";
const CODE_MSG = "defect code is not a literal E and four digits";
const DETAIL_MSG = "defect detail is not an object literal";
const FAILED = "defect on a failed Result: pass { cause: r.error }";
const body = (stmt: string, pre = "") => `${HEAD}${pre}export function a(): void { ${stmt} }\n`;
const E1455 = (stmt: string, pre = "") => of(run(body(stmt, pre)), "E1455");

test("`defect(`no row ${n}`)` is one E1455 at the first argument, message `defect message is not a literal`, with no fix", () => {
  const src = body("defect(`no row ${n}`)");
  const ds = of(run(src), "E1455");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(MSG);
  expect(ds[0]?.fix).toBeUndefined();
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "`no row"));
});

test("`defect(text)` with `const text = 'x'` above it is one E1455 at the first argument, with no fix", () => {
  const ds = E1455("defect(text)", "const text = 'x'\n");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(MSG);
  expect(ds[0]?.fix).toBeUndefined();
});

test("`defect('a' + b)` is one E1455 at the first argument, with no fix", () => {
  const ds = E1455("defect('a' + b)");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(MSG);
  expect(ds[0]?.fix).toBeUndefined();
});

test("`defect('x')`, `defect(`x`)`, `defect('x', { data: { n } })` and `defect('x', 'E2801', { cause: e })` are no E1455", () => {
  for (const call of [
    "defect('x')",
    "defect(`x`)",
    "defect('x', { data: { n } })",
    "defect('x', 'E2801', { cause: e })",
  ]) {
    expect(E1455(call), call).toEqual([]);
  }
});

test("property: a message with any interpolation or concatenation is one E1455; any plain literal is none", () => {
  const word = fc.stringMatching(/^[a-z ]{1,12}$/);
  fc.assert(
    fc.property(word, fc.constantFrom("${n}", "${b}", "${String(n)}"), (w, sub) => {
      expect(E1455(`defect(\`${w} ${sub}\`)`)).toHaveLength(1);
      expect(E1455(`defect('${w}' + b)`)).toHaveLength(1);
      expect(E1455(`defect('${w}')`)).toEqual([]);
      expect(E1455(`defect(\`${w}\`)`)).toEqual([]);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test("`defect('x', 'E28')` is one E1455 at the second argument, message `defect code is not a literal E and four digits`", () => {
  const ds = E1455("defect('x', 'E28')");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(CODE_MSG);
});

test("`defect('x', code)` with `const code = 'E2801'` above it is one E1455 at the second argument", () => {
  const ds = E1455("defect('x', code)", "const code = 'E2801'\n");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(CODE_MSG);
});

test("`k.defect('x', 'e2801')` under `import * as k from '@keel/schema'` is one E1455 at the second argument", () => {
  const src = "import * as k from '@keel/schema'\nexport function a(): void { k.defect('x', 'e2801') }\n";
  const ds = of(run(src), "E1455");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(CODE_MSG);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "'e2801'"));
});

test("`defect('x', 'E2801', detail)` with `detail` a name is one E1455 at `detail`, message `defect detail is not an object literal`", () => {
  const src = body("defect('x', 'E2801', detail)", "const detail = { data: {} }\n");
  const ds = of(run(src), "E1455");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(DETAIL_MSG);
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "detail)", "defect('x'"));
});

test("`try { f() } finally { defect('x') }` is one E1452 at the call, message `defect in finally drops the throw in flight`", () => {
  const src = body("try { f() } finally { defect('x') }");
  const ds = of(run(src), "E1452");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe("defect in finally drops the throw in flight");
  expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "defect('x') }"));
});

test("`try { f() } finally { g(() => defect('x')) }` is no E1452", () => {
  expect(of(run(body("try { f() } finally { g(() => defect('x')) }")), "E1452")).toEqual([]);
});

const RES = "declare const r: Result<number, { code: 'm.x'; message: string; data: null }>\n";

test("`if (!r.ok) defect('x')` with `r` a Result is one E1455 at the call, message `defect on a failed Result: pass { cause: r.error }`", () => {
  const ds = E1455("if (!r.ok) defect('x')", RES);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(FAILED);
  expect(typeof ds[0]?.fix).toBe("string");
});

test("the fix for `if (!r.ok) defect('x')` adds `{ cause: r.error }` as the detail, and the fixed project passes check and type-checks", () => {
  const files = [MANIFEST, { path: PATH, source: body("if (!r.ok) defect('x')", RES) }];
  const fix = of(checked(files), "E1455")[0]?.fix;
  expect(typeof fix).toBe("string");
  if (fix === undefined) return;
  const patched = applyFix(files, fix);
  expect(patched.find((f) => f.path === PATH)?.source).toContain("defect('x', { cause: r.error })");
  expect(codesOf(checked(patched))).toEqual([]);
});

test("`if (!r.ok) defect('x', { cause: r.error })` is no E1455", () => {
  expect(E1455("if (!r.ok) defect('x', { cause: r.error })", RES)).toEqual([]);
});

test("`try { f() } finally { g() }` is no E1452 and `try { f() } catch { g() } finally { h() }` is one, message `catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)`", () => {
  expect(of(run(body("try { f() } finally { g() }")), "E1452")).toEqual([]);
  const ds = of(run(body("try { f() } catch { g() } finally { h() }")), "E1452");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toBe(
    "catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)",
  );
});
