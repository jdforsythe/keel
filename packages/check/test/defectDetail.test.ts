// E1455 over the one form `defect(message, detail?)` (k.defects): the code is the detail's `code`, read in both
// passes, and the failed-Result fix adds `cause` to a detail it can read.
import { expect, test } from "vitest";
import { MANIFEST, PATH, applyFix, at, checked, codesOf, of, run } from "../conformance/rules-support.ts";

const HEAD =
  "import { defect } from '@keel/schema'\nimport * as k from '@keel/schema'\nimport type { Result } from '@keel/schema'\ndeclare const detail: { data: {} }\ndeclare const e: unknown\n";
const RES = "declare const r: Result<number, { code: 'm.x'; message: string; data: null }>\n";
const CODE_MSG = "defect code is not a literal E and four digits";
const DETAIL_MSG = "defect detail is not an object literal";
const body = (stmt: string, pre = "") => `${HEAD}${pre}export function a(): void { ${stmt} }\n`;
const files = (stmt: string, pre = "") => [MANIFEST, { path: PATH, source: body(stmt, pre) }];

for (const types of [false, true]) {
  const E1455 = (stmt: string, pre = "") =>
    of(types ? checked(files(stmt, pre)) : run(body(stmt, pre)), "E1455").map((d) => d.message);

  test(`types ${types}: a code that is no literal E and four digits is one E1455 at the code value`, () => {
    const src = body("defect('x', { code: 'E28' })");
    const ds = of(types ? checked([MANIFEST, { path: PATH, source: src }]) : run(src), "E1455");
    expect(ds.map((d) => d.message)).toEqual([CODE_MSG]);
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(at(src, "'E28'"));
    expect(E1455("defect('x', { code })", "const code = 'E2801'\n")).toEqual([CODE_MSG]);
    expect(E1455("k.defect('x', { code: 'e2801' })")).toEqual([CODE_MSG]);
  });

  test(`types ${types}: a detail that is no object literal without a spread, or a third argument, is one E1455`, () => {
    for (const stmt of ["defect('x', detail)", "defect('x', { ...detail })"]) expect(E1455(stmt)).toEqual([DETAIL_MSG]);
  });

  test(`types ${types}: the one form is no E1455`, () => {
    for (const stmt of [
      "defect('x')",
      "defect('x', { code: 'E2801' })",
      "defect('x', { code: 'E2801', data: { n: 1 }, cause: e })",
      "defect('x', { data: { n: 1 } })",
    ])
      expect(E1455(stmt)).toEqual([]);
  });
}

test("a string code where the detail stands, and a third argument, are E1455 detail findings without the type pass", () => {
  expect(of(run(body("defect('x', 'E2801')")), "E1455").map((d) => d.message)).toEqual([DETAIL_MSG]);
  expect(of(run(body("defect('x', {}, {})")), "E1455").map((d) => d.message)).toEqual([DETAIL_MSG]);
});

for (const [stmt, fixed] of [
  ["if (!r.ok) defect('x', { code: 'E2801' })", "defect('x', { code: 'E2801', cause: r.error })"],
  ["if (!r.ok) defect('x', {})", "defect('x', { cause: r.error })"],
  ["if (!r.ok) defect('x')", "defect('x', { cause: r.error })"],
] as const)
  test(`the fix for \`${stmt}\` gives \`${fixed}\`, and the fixed project passes check`, () => {
    const fs = files(stmt, RES);
    const fix = of(checked(fs), "E1455")[0]?.fix;
    expect(typeof fix).toBe("string");
    if (fix === undefined) return;
    const patched = applyFix(fs, fix);
    expect(patched.find((f) => f.path === PATH)?.source).toContain(fixed);
    expect(codesOf(checked(patched))).toEqual([]);
  });
