// Spec: std.jobs, clause "`job` with `attempts: 0` or `timeoutMs: 1.5` throws E2505." (rfc:0092 A10)
// Spec: std.jobs, rule E2505: `attempts` or `timeoutMs` not a positive integer (`job` throws it).
// Seed 1337
import { ok, s } from "@keel/schema";
import { job } from "@keel/std-jobs";
import fc from "fast-check";
import { expect, test } from "vitest";

const fn = async () => ok(null);
const input = s.object({});
const notPositiveInt = fc.oneof(
  fc.integer({ max: 0 }),
  fc.double({ noNaN: false }).filter((n) => !Number.isSafeInteger(n) || n <= 0),
  fc.constantFrom(1.5, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 2 ** 60),
);

test("`job` with `attempts: 0` or `timeoutMs: 1.5` throws E2505.", () => {
  expect(() => job({ input, attempts: 0 }, fn)).toThrow(/E2505/);
  expect(() => job({ input, timeoutMs: 1.5 }, fn)).toThrow(/E2505/);
});

test("E2505 is thrown by `job` for any `attempts` that is not a positive integer, and for none that is.", () => {
  fc.assert(
    fc.property(notPositiveInt, fc.integer({ min: 1, max: 1000 }), (bad, good) => {
      expect(() => job({ input, attempts: bad }, fn)).toThrow(/E2505/);
      expect(() => job({ input, attempts: good }, fn)).not.toThrow();
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("E2505 is thrown by `job` for any `timeoutMs` that is not a positive integer, and for none that is.", () => {
  fc.assert(
    fc.property(notPositiveInt, fc.integer({ min: 1, max: 1_000_000 }), (bad, good) => {
      expect(() => job({ input, timeoutMs: bad }, fn)).toThrow(/E2505/);
      expect(() => job({ input, timeoutMs: good }, fn)).not.toThrow();
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("`job` with neither option (defaults 3 and 60000) does not throw E2505.", () => {
  expect(() => job({ input }, fn)).not.toThrow();
});
