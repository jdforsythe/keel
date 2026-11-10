// Spec: std.text, clause "`line({ max: 0 })`, `line({ min: 2, max: 1 })` and `line({ max: 1.5 })` throw."
// Seed 1337
import { line, para } from "@keel/std-text";
import fc from "fast-check";
import { expect, test } from "vitest";

test.skip("`line({ max: 0 })`, `line({ min: 2, max: 1 })` and `line({ max: 1.5 })` throw.", () => {
  expect(() => line({ max: 0 })).toThrow();
  expect(() => line({ min: 2, max: 1 })).toThrow();
  expect(() => line({ max: 1.5 })).toThrow();
  fc.assert(
    fc.property(fc.integer({ min: 10001, max: 1_000_000 }), fc.integer({ min: -1000, max: -1 }), (big, neg) => {
      expect(() => line({ max: big })).toThrow();
      expect(() => line({ min: neg, max: 5 })).toThrow();
      expect(() => para({ max: big })).toThrow();
    }),
    { seed: 1337, numRuns: 100 },
  );
  expect(() => line({ max: 10000 })).not.toThrow();
  expect(() => line({ min: 0, max: 1 })).not.toThrow();
});
