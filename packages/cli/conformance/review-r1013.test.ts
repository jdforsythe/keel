// Spec: k.escapes, clause "R1013 is one finding each for `if (!r.ok) return defect('x')`, `if (r.ok) use(r.value); else defect('x')`, `const v = r.ok ? r.value : defect('x')`, `if (r.ok) return r.value; return defect('x')`, `r.ok || defect('x')`, `!r.ok && defect('x')`, `if (r.ok !== true) defect('x')` and `if (!g().ok) defect('x')` in `modules/m/a.ts`; `return rows[0] ?? defect('x')`, `if (r.ok) defect('x')` and `r.ok && defect('x')` are none."
// k.escapes, Codes "R1013 | medium | a `defect` call (k.errors) reachable only when a `Result` is not ok: read as TypeScript narrows `ok`, without types, on any name, member or call whose `.ok` is tested (`!`, `===` or `!==` against a boolean, `&&`, `||`, `?:`, `if`/`else`, and the statements after `if (x.ok)` whose branch always returns)"
// Seed 1337 (the property); the forms are source text. The property writes all its files into one repository and reads one review.
import fc from "fast-check";
import { expect, test } from "vitest";
import { PROJECT, SEED, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

const HEAD =
  'import { defect } from "@keel/schema";\ndeclare const r: { ok: boolean; value: number };\ndeclare function g(): { ok: boolean; value: number };\ndeclare function use(v: number): void;\n';
const file = (body: string): string => `${HEAD}${body}\n`;

const hitsFor = (body: string, list = false) =>
  withRepo([PROJECT, { "modules/m/a.ts": file(body) }], (repo) => ({
    hits: ofCode(review(repo, [range(repo, 0, 1), ...(list ? ["--list"] : [])]), "R1013"),
  })).hits;

const REPORTED = [
  "export function a(): number | undefined { if (!r.ok) return defect('x'); return r.value }",
  "export function a(): void { if (r.ok) use(r.value); else defect('x') }",
  "export const v = r.ok ? r.value : defect('x')",
  "export function a(): number { if (r.ok) return r.value; return defect('x') }",
  "export function a(): void { r.ok || defect('x') }",
  "export function a(): void { !r.ok && defect('x') }",
  "export function a(): void { if (r.ok !== true) defect('x') }",
  "export function a(): void { if (!g().ok) defect('x') }",
];
const CLEAN = [
  "declare const rows: number[];\nexport function a(): number { return rows[0] ?? defect('x') }",
  "export function a(): void { if (r.ok) defect('x') }",
  "export function a(): void { r.ok && defect('x') }",
];

test("R1013 is one finding each for `if (!r.ok) return defect('x')`, `if (r.ok) use(r.value); else defect('x')`, `const v = r.ok ? r.value : defect('x')`, `if (r.ok) return r.value; return defect('x')`, `r.ok || defect('x')`, `!r.ok && defect('x')`, `if (r.ok !== true) defect('x')` and `if (!g().ok) defect('x')` in `modules/m/a.ts`", () => {
  for (const body of REPORTED) {
    const hits = hitsFor(body, true);
    expect(hits, body).toHaveLength(1);
    expect(hits[0]?.path).toBe("modules/m/a.ts");
    expect(hits[0]?.line).toBe(lineOf(file(body), "defect('x')"));
  }
}, 240_000);

test("`return rows[0] ?? defect('x')`, `if (r.ok) defect('x')` and `r.ok && defect('x')` are none", () => {
  for (const body of CLEAN) expect(hitsFor(body, true), body).toEqual([]);
}, 120_000);

// The flow is read over any name, member or call: each expression `E` with `E.ok` tested, in each way the row lists.
const SUBJECTS = ["r", "res", "o.res", "a.b.c", "g()"];
const SUBJECT_DECLS =
  "declare const res: { ok: boolean; value: number };\ndeclare const o: { res: { ok: boolean; value: number } };\ndeclare const a: { b: { c: { ok: boolean; value: number } } };\n";
const ERR_FORMS: readonly ((e: string) => string)[] = [
  (e) => `export function f(): number | undefined { if (!${e}.ok) return defect('x'); return 1 }`,
  (e) => `export function f(): void { if (${e}.ok) use(1); else defect('x') }`,
  (e) => `export const v = ${e}.ok ? 1 : defect('x')`,
  (e) => `export function f(): number { if (${e}.ok) return 1; return defect('x') }`,
  (e) => `export function f(): void { ${e}.ok || defect('x') }`,
  (e) => `export function f(): void { !${e}.ok && defect('x') }`,
  (e) => `export function f(): void { if (${e}.ok !== true) defect('x') }`,
  (e) => `export function f(): void { if (${e}.ok === false) defect('x') }`,
];
const OK_FORMS: readonly ((e: string) => string)[] = [
  (e) => `export function f(): void { if (${e}.ok) defect('x') }`,
  (e) => `export function f(): void { ${e}.ok && defect('x') }`,
  (e) => `export function f(): void { if (!${e}.ok) use(1); else defect('x') }`,
  (e) => `export function f(): void { !${e}.ok || defect('x') }`,
  (e) => `export const v = !${e}.ok ? 1 : defect('x')`,
  (e) => `export function f(): void { if (${e}.ok === true) defect('x') }`,
];

test("property: for any name, member or call whose `.ok` is tested, a `defect` reachable only when it is not ok is one finding, and one reachable only when it is ok is none", () => {
  const pick = fc.record({
    subject: fc.constantFrom(...SUBJECTS),
    err: fc.constantFrom(...ERR_FORMS),
    ok: fc.constantFrom(...OK_FORMS),
  });
  const cases = fc.sample(pick, { seed: SEED, numRuns: 12 });
  const tree: Record<string, string> = {};
  cases.forEach((c, i) => {
    tree[`modules/m/e${i}.ts`] = `${HEAD}${SUBJECT_DECLS}${c.err(c.subject)}\n`;
    tree[`modules/m/k${i}.ts`] = `${HEAD}${SUBJECT_DECLS}${c.ok(c.subject)}\n`;
  });
  const hits = withRepo([PROJECT, tree], (repo) => ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1013"));
  cases.forEach((c, i) => {
    expect(
      hits.filter((h) => h.path === `modules/m/e${i}.ts`),
      c.err(c.subject),
    ).toHaveLength(1);
    expect(
      hits.filter((h) => h.path === `modules/m/k${i}.ts`),
      c.ok(c.subject),
    ).toEqual([]);
  });
}, 240_000);

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
