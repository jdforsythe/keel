// Spec: k.escapes, clause "R1013 is one finding each for `if (!r.ok) return defect('x')`, `if (r.ok) use(r.value); else defect('x')` and `const v = r.ok ? r.value : defect('x')` in `modules/m/a.ts`; `return rows[0] ?? defect('x')` and `if (r.ok) defect('x')` are none."
// Seed: n/a (five forms; fixtures are source text).
import { expect, test } from "vitest";
import { PROJECT, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

const HEAD =
  'import { defect } from "@keel/schema";\ndeclare const r: { ok: boolean; value: number };\ndeclare function use(v: number): void;\n';
const file = (body: string): string => `${HEAD}${body}\n`;

const hitsFor = (body: string, list = false) =>
  withRepo([PROJECT, { "modules/m/a.ts": file(body) }], (repo) => ({
    hits: ofCode(review(repo, [range(repo, 0, 1), ...(list ? ["--list"] : [])]), "R1013"),
  })).hits;

test("R1013 is one finding each for `if (!r.ok) return defect('x')`, `if (r.ok) use(r.value); else defect('x')` and `const v = r.ok ? r.value : defect('x')` in `modules/m/a.ts`; `return rows[0] ?? defect('x')` and `if (r.ok) defect('x')` are none.", () => {
  const forms = [
    "export function a(): number | undefined { if (!r.ok) return defect('x'); return r.value }",
    "export function a(): void { if (r.ok) use(r.value); else defect('x') }",
    "export const v = r.ok ? r.value : defect('x')",
  ];
  for (const body of forms) {
    const hits = hitsFor(body, true);
    expect(hits, body).toHaveLength(1);
    expect(hits[0]?.path).toBe("modules/m/a.ts");
    expect(hits[0]?.line).toBe(lineOf(file(body), "defect('x')"));
  }
  const none = [
    "declare const rows: number[];\nexport function a(): number { return rows[0] ?? defect('x') }",
    "export function a(): void { if (r.ok) defect('x') }",
  ];
  for (const body of none) expect(hitsFor(body, true), body).toEqual([]);
});

test("R1013 is one finding for `if (!r.ok)`, `r.ok === false`, a member `x.ok` and the else of `if (x.ok)`, none for the ok branch", () => {
  const forms = [
    "export function a(): void { if (r.ok === false) defect('x') }",
    "declare const o: { res: { ok: boolean } };\nexport function a(): void { if (!o.res.ok) defect('x') }",
    "export function a(): void { if (r.ok) { use(r.value) } else { defect('x') } }",
  ];
  for (const body of forms) expect(hitsFor(body, true), body).toHaveLength(1);
});

test("R1013 has the medium danger of its row", () => {
  const hits = hitsFor("export const v = r.ok ? r.value : defect('x')", true);
  expect(hits).toHaveLength(1);
  expect(hits[0]?.danger).toBe("medium");
});
