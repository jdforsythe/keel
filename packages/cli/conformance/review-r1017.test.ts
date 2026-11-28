// Spec: k.escapes, clause "R1017 is one finding each for `attempt(f, (x) => (x instanceof Error ? T : undefined))` and `attempt(f, (x) => (x ? T : undefined))` in `modules/m/a.ts`, and none for `attempt(f, (x) => (x instanceof RangeError ? T : undefined))` or `attempt(f, (x) => (x instanceof Error && x.name === 'CardError' ? T : undefined))`."
// Spec: k.escapes, clause "R1017 is one finding each for `attempt(f, (x) => (x instanceof Object ? T : undefined))`, `attempt(f, (x) => (typeof x !== 'bigint' ? T : undefined))`, `attempt(f, (x) => (x !== 1 ? T : undefined))`, `attempt(f, (x) => (x instanceof RangeError ? undefined : T))` and `attempt(f, (x) => (any(x) ? T : undefined))` with `const any = (x: unknown) => true` in the file, in `modules/m/a.ts`; none for `attempt(f, (x) => (isUnique(x) ? T : undefined))` with `const isUnique = (x: unknown) => typeof x === 'object' && x !== null && Reflect.get(x, 'code') === '23505'` in the file."
// k.escapes, Codes "R1017 | medium | an `attempt` whose `expect` returns an error for a value tested only by `instanceof Error`, or by no class or property of it (k.attempt)"
// Seed 1337 (the property); the forms are source text. The property writes all its files into one repository and reads one review.
import { testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { expect, test } from "vitest";
import { PROJECT, SEED, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

const HEAD =
  "import { attempt } from '@keel/schema';\ndeclare const f: () => number;\ndeclare const T: { code: 'm.t'; message: string; data: null };\n";
const file = (body: string): string => `${HEAD}${body}\n`;
const hitsFor = (body: string) =>
  withRepo([PROJECT, { "modules/m/a.ts": file(body) }], (repo) =>
    ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1017"),
  );

test(
  "R1017 is one finding for `attempt(f, (x) => (x instanceof Error ? T : undefined))` in `modules/m/a.ts`",
  () => {
    const body = "export const r = attempt(f, (x) => (x instanceof Error ? T : undefined))";
    const hits = hitsFor(body);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe("modules/m/a.ts");
    expect(hits[0]?.line).toBe(lineOf(file(body), "attempt(f"));
    expect(hits[0]?.danger).toBe("medium");
  },
  testTime(120_000),
);

test(
  "R1017 is one finding for `attempt(f, (x) => (x ? T : undefined))` in `modules/m/a.ts`",
  () => {
    expect(hitsFor("export const r = attempt(f, (x) => (x ? T : undefined))")).toHaveLength(1);
  },
  testTime(120_000),
);

test(
  "R1017 is none for `attempt(f, (x) => (x instanceof RangeError ? T : undefined))`",
  () => {
    expect(hitsFor("export const r = attempt(f, (x) => (x instanceof RangeError ? T : undefined))")).toEqual([]);
  },
  testTime(120_000),
);

test(
  "R1017 is none for `attempt(f, (x) => (x instanceof Error && x.name === 'CardError' ? T : undefined))`",
  () => {
    expect(
      hitsFor("export const r = attempt(f, (x) => (x instanceof Error && x.name === 'CardError' ? T : undefined))"),
    ).toEqual([]);
  },
  testTime(120_000),
);

const CLASSES = ["RangeError", "TypeError", "SyntaxError", "CardError", "NetworkError"];
const PROPS = ["name", "code", "status"];
const LITS = ["'CardError'", "'E1'", "402"];
test(
  "property: an `expect` testing a class other than `Error`, or a property of an `Error`, is none; `instanceof Error` alone or no test is one",
  () => {
    const cases = fc.sample(
      fc.record({
        cls: fc.constantFrom(...CLASSES),
        prop: fc.constantFrom(...PROPS),
        lit: fc.constantFrom(...LITS),
        reported: fc.constantFrom(
          "(x) => (x instanceof Error ? T : undefined)",
          "(x) => (x ? T : undefined)",
          "(x) => (x !== undefined ? T : undefined)",
        ),
      }),
      { seed: SEED, numRuns: 8 },
    );
    const tree: Record<string, string> = {};
    cases.forEach((c, i) => {
      tree[`modules/m/e${i}.ts`] = file(`export const r = attempt(f, ${c.reported})`);
      tree[`modules/m/k${i}.ts`] = file(
        `export const a = attempt(f, (x) => (x instanceof ${c.cls} ? T : undefined))\nexport const b = attempt(f, (x) => (x instanceof Error && x.${c.prop} === ${c.lit} ? T : undefined))`,
      );
    });
    const hits = withRepo([PROJECT, tree], (repo) => ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1017"));
    cases.forEach((c, i) => {
      expect(
        hits.filter((h) => h.path === `modules/m/e${i}.ts`),
        c.reported,
      ).toHaveLength(1);
      expect(hits.filter((h) => h.path === `modules/m/k${i}.ts`)).toEqual([]);
    });
  },
  testTime(240_000),
);

const WIDE: readonly (readonly [string, string])[] = [
  ["attempt(f, (x) => (x instanceof Object ? T : undefined))", ""],
  ["attempt(f, (x) => (typeof x !== 'bigint' ? T : undefined))", ""],
  ["attempt(f, (x) => (x !== 1 ? T : undefined))", ""],
  ["attempt(f, (x) => (x instanceof RangeError ? undefined : T))", ""],
  ["attempt(f, (x) => (any(x) ? T : undefined))", "const any = (x: unknown) => true;\n"],
];
for (const [form, decl] of WIDE) {
  test(
    `R1017 is one finding for \`${form}\` in \`modules/m/a.ts\``,
    () => {
      const hits = hitsFor(`${decl}export const r = ${form}`);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.path).toBe("modules/m/a.ts");
    },
    testTime(120_000),
  );
}

test(
  "R1017 is none for `attempt(f, (x) => (isUnique(x) ? T : undefined))` with `const isUnique = (x: unknown) => typeof x === 'object' && x !== null && Reflect.get(x, 'code') === '23505'` in the file",
  () => {
    expect(
      hitsFor(
        "const isUnique = (x: unknown) => typeof x === 'object' && x !== null && Reflect.get(x, 'code') === '23505';\nexport const r = attempt(f, (x) => (isUnique(x) ? T : undefined))",
      ),
    ).toEqual([]);
  },
  testTime(120_000),
);
