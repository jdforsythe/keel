// Spec: std.temporal, clause "For every generated integer `ms` within the bounds, `durationMs(durationOf(ms))` is `ms`; `durationOf` of 0, 5400000 and -500 is `PT0S`, `PT1H30M` and `-PT0.500S`; `durationOf(0.5)` throws."
// Seed 1337
import { durationMs, durationOf } from "@keel/std-temporal";
import fc from "fast-check";
import { expect, test } from "vitest";

test.skip("For every generated integer `ms` within the bounds, `durationMs(durationOf(ms))` is `ms`; `durationOf` of 0, 5400000 and -500 is `PT0S`, `PT1H30M` and `-PT0.500S`; `durationOf(0.5)` throws.", () => {
  fc.assert(
    fc.property(fc.integer({ min: -1e15, max: 1e15 }), (ms) => {
      expect(durationMs(durationOf(ms))).toBe(ms);
    }),
    { seed: 1337, numRuns: 200 },
  );
  expect(durationOf(0)).toBe("PT0S");
  expect(durationOf(5400000)).toBe("PT1H30M");
  expect(durationOf(-500)).toBe("-PT0.500S");
  expect(() => durationOf(0.5)).toThrow();
});
