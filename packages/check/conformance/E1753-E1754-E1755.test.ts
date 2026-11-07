// Seed 1337 (fast-check seed, recorded in each fc.assert below)
// Spec: k.check, Rules, E1753 (stdlib rule outside E2xxx/W2xxx), E1754 (`unsafe` without a justification string), E1755 (budget exceeded).
// Duplicate-code E1753 is covered in define-rule.test.ts.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { one, SEED } from "./support.ts";

const UNSAFE = "unsafe"; // built so this file's own source holds no literal call; fixture text does
const NO_TYPES = { types: false } as const;
const UNITS = ["tokens", "bytes"] as const;
const codesOf = (source: string, path = "src/x.ts") =>
  check(one(source, path), NO_TYPES).diagnostics.map((d) => d.code);
const rule = (code: string) => `defineRule({ code: '${code}', message: 'm', explain: 'e', check: () => [] })\n`;

test("E1753: a defineRule with a code outside E2xxx/W2xxx in checked project source is reported", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1000, max: 1999 }), (n) => {
      expect(codesOf(rule(`E${n}`), "src/rule.ts")).toContain("E1753");
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1753: a defineRule with an E2xxx or W2xxx code is clean", () => {
  fc.assert(
    fc.property(fc.constantFrom("E", "W"), fc.integer({ min: 2000, max: 2999 }), (p, n) => {
      expect(codesOf(rule(`${p}${n}`), "src/rule.ts")).not.toContain("E1753");
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1754: unsafe called without a justification string is reported", () => {
  expect(codesOf(`export const x = ${UNSAFE}(() => 1)\n`)).toContain("E1754");
});

test("E1754: unsafe called with a justification string is clean", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z ]{5,30}$/), (why) => {
      expect(codesOf(`export const x = ${UNSAFE}('${why}', () => 1)\n`)).not.toContain("E1754");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1755: a budget whose actual exceeds its limit is reported", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 5000 }),
      fc.integer({ min: 1, max: 5000 }),
      fc.constantFrom(...UNITS),
      (limit, over, unit) => {
        const d = check([], {
          budgets: [{ id: "b.one", limit, actual: limit + over, unit }],
        }).diagnostics;
        expect(d.map((x) => x.code)).toContain("E1755");
      },
    ),
    { seed: SEED, numRuns: 30 },
  );
});

test("E1755: a budget whose actual is at or below its limit is not reported", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 5000 }),
      fc.integer({ min: 0, max: 5000 }),
      fc.constantFrom(...UNITS),
      (limit, under, unit) => {
        const actual = Math.max(0, limit - under);
        const d = check([], {
          budgets: [{ id: "b.one", limit, actual, unit }],
        }).diagnostics;
        expect(d.map((x) => x.code)).not.toContain("E1755");
        expect(check([], { budgets: [{ id: "b.two", limit, actual: limit, unit }] }).diagnostics).toEqual([]);
      },
    ),
    { seed: SEED, numRuns: 30 },
  );
});
