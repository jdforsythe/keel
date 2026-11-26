// Spec: k.escapes, clause "R1015 is one finding for `function isT(x: unknown): x is T { return true }` in `modules/m/a.ts` and none for the same inside an `unsafe(` call's function in `modules/m/unsafe/a.ts`."
// k.escapes, Codes "R1015 | low | a function whose return type is a type predicate or assertion (k.unsafe Type predicates) outside an `unsafe(` call"
// Seed 1337 (the property); the forms are source text. The property writes all its files into one repository and reads one review.
// Fixture text builds the `unsafe` call from a constant so this file's own source holds no literal call.
import fc from "fast-check";
import { expect, test } from "vitest";
import { PROJECT, SEED, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

const U = "unsafe";
const REASON = "one two three four five six seven eight";
const HEAD = "type T = { id: string };\n";
const PRED = "function isT(x: unknown): x is T { return true }";

const hitsIn = (tree: Record<string, string>, path: string) =>
  withRepo([PROJECT, tree], (repo) => ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1015")).filter(
    (h) => h.path === path,
  );

test("R1015 is one finding for `function isT(x: unknown): x is T { return true }` in `modules/m/a.ts`", () => {
  const source = `${HEAD}export ${PRED}\n`;
  const hits = hitsIn({ "modules/m/a.ts": source }, "modules/m/a.ts");
  expect(hits).toHaveLength(1);
  expect(hits[0]?.line).toBe(lineOf(source, "function isT"));
  expect(hits[0]?.danger).toBe("low");
}, 120_000);

test("R1015 is none for the same inside an `unsafe(` call's function in `modules/m/unsafe/a.ts`", () => {
  const source = `${HEAD}export const a = ${U}("${REASON}", () => { ${PRED}; return isT })\n`;
  expect(hitsIn({ "modules/m/unsafe/a.ts": source }, "modules/m/unsafe/a.ts")).toEqual([]);
}, 120_000);

// Each way a function can have a type predicate or assertion for its return type.
const FORMS: readonly string[] = [
  "export function isT(x: unknown): x is T { return true }",
  "export const isT = (x: unknown): x is T => true",
  "export const isT = function (x: unknown): x is T { return true }",
  "export function assertT(x: unknown): asserts x is T {}",
  "export function assertOk(x: unknown): asserts x {}",
  "export const o = { isT(x: unknown): x is T { return true } }",
  "export class C { isT(x: unknown): x is T { return true } }",
];
const PLAIN: readonly string[] = [
  "export function f(x: unknown): boolean { return x === 1 }",
  "export const f = (x: unknown): T | undefined => undefined",
];

test("property: a function of any form whose return type is a type predicate or assertion is one finding outside an `unsafe(` call, and one returning a plain type is none", () => {
  const cases = fc.sample(fc.record({ yes: fc.constantFrom(...FORMS), no: fc.constantFrom(...PLAIN) }), {
    seed: SEED,
    numRuns: 10,
  });
  const tree: Record<string, string> = {};
  cases.forEach((c, i) => {
    tree[`modules/m/p${i}.ts`] = `${HEAD}${c.yes}\n`;
    tree[`modules/m/n${i}.ts`] = `${HEAD}${c.no}\n`;
  });
  const hits = withRepo([PROJECT, tree], (repo) => ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1015"));
  cases.forEach((c, i) => {
    expect(
      hits.filter((h) => h.path === `modules/m/p${i}.ts`),
      c.yes,
    ).toHaveLength(1);
    expect(
      hits.filter((h) => h.path === `modules/m/n${i}.ts`),
      c.no,
    ).toEqual([]);
  });
}, 240_000);
