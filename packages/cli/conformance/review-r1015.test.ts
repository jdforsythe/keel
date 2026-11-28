// Spec: k.escapes, clause "R1015 is one finding for `(x: unknown): x is { id: string } => typeof x === 'object' && x !== null && typeof Reflect.get(x, 'id') === 'string'` in `modules/m/a.ts` and none for `(x: unknown): x is Store<unknown> => isStore(x)` there."
// Spec: k.identity, clause "`keel review` reports one R1015 for a predicate proven by structure or by the module's own set, and none for one proven by a kernel guard, a class or a schema."
// k.escapes, Codes "R1015 | low | a type predicate or assertion proven by structure or by its module's own set (k.identity)"
// Seed 1337 (the property); the forms are source text. The property writes all its files into one repository and reads one review.
import { testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { expect, test } from "vitest";
import { PROJECT, SEED, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

const STRUCTURE =
  "export const isT = (x: unknown): x is { id: string } => typeof x === 'object' && x !== null && typeof Reflect.get(x, 'id') === 'string'";
const GUARD =
  "import { isStore } from '@keel/store';\nimport type { Store } from '@keel/store';\nexport const isS = (x: unknown): x is Store<unknown> => isStore(x)";

const hitsIn = (tree: Record<string, string>, path = "modules/m/a.ts") =>
  withRepo([PROJECT, tree], (repo) => ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1015")).filter(
    (h) => h.path === path,
  );

test(
  "R1015 is one finding for `(x: unknown): x is { id: string } => typeof x === 'object' && x !== null && typeof Reflect.get(x, 'id') === 'string'` in `modules/m/a.ts`",
  () => {
    const source = `${STRUCTURE}\n`;
    const hits = hitsIn({ "modules/m/a.ts": source });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.line).toBe(lineOf(source, "export const isT"));
    expect(hits[0]?.danger).toBe("low");
  },
  testTime(120_000),
);

test(
  "R1015 is none for `(x: unknown): x is Store<unknown> => isStore(x)` in `modules/m/a.ts`",
  () => {
    expect(hitsIn({ "modules/m/a.ts": `${GUARD}\n` })).toEqual([]);
  },
  testTime(120_000),
);

// One form per proof of k.identity's list: 1 a kernel guard, 2 a class, 3 the module's own set, 4 a schema, 5 structure.
const REPORTED: Readonly<Record<string, string>> = {
  "structure: an object with a property": STRUCTURE,
  "structure: a primitive": "export const isS = (x: unknown): x is string => typeof x === 'string'",
  "structure: an array of a proven element":
    "export const isN = (x: unknown): x is number[] => Array.isArray(x) && x.every((q) => typeof q === 'number')",
  "the module's own set": [
    "class Job {}",
    "const made = new WeakSet<object>();",
    "export function make(): Job { const j = new Job(); made.add(j); return j }",
    "export const isJob = (x: unknown): x is Job => typeof x === 'object' && x !== null && made.has(x)",
  ].join("\n"),
};
const CLEAN: Readonly<Record<string, string>> = {
  "a kernel guard": GUARD,
  "a class": "export class Job {}\nexport const isJob = (x: unknown): x is Job => x instanceof Job",
  "a schema":
    "import { s } from '@keel/schema';\nconst User = s.object({ id: s.string() });\ntype User = { id: string };\nexport const isUser = (x: unknown): x is User => User.parse(x).ok",
  "a schema, in an assertion function":
    "import { defect, s } from '@keel/schema';\nconst User = s.object({ id: s.string() });\ntype User = { id: string };\nexport function assertUser(x: unknown): asserts x is User { if (!(User.parse(x).ok)) defect('no user') }",
};

test(
  "`keel review` reports one R1015 for a predicate proven by structure or by the module's own set",
  () => {
    for (const [how, body] of Object.entries(REPORTED)) {
      const hits = hitsIn({ "modules/m/a.ts": `${body}\n` });
      expect(hits, how).toHaveLength(1);
      expect(hits[0]?.danger, how).toBe("low");
    }
  },
  testTime(240_000),
);

test(
  "`keel review` reports no R1015 for a predicate proven by a kernel guard, a class or a schema",
  () => {
    for (const [how, body] of Object.entries(CLEAN)) expect(hitsIn({ "modules/m/a.ts": `${body}\n` }), how).toEqual([]);
  },
  testTime(240_000),
);

test(
  "property: one predicate of any proof is one finding when proven by structure or the module's own set, and none otherwise, each in its own file",
  () => {
    const cases = fc.sample(
      fc.record({ yes: fc.constantFrom(...Object.values(REPORTED)), no: fc.constantFrom(...Object.values(CLEAN)) }),
      { seed: SEED, numRuns: 10 },
    );
    const tree: Record<string, string> = {};
    cases.forEach((c, i) => {
      tree[`modules/m/p${i}.ts`] = `${c.yes}\n`;
      tree[`modules/m/n${i}.ts`] = `${c.no}\n`;
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
  },
  testTime(240_000),
);
