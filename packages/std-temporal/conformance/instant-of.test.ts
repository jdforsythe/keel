// Spec: std.temporal, clause "For every generated in-range integer `ms`, `epochMs` of `instantOf(ms)`'s value is `ms` and `instantOf(ms + 0.5)` gives the same instant; `instantOf(253402300800000)` is `err` `temporal.outOfRange`."
// Seed 1337
import { epochMs, instantOf } from "@keel/std-temporal";
import fc from "fast-check";
import { expect, test } from "vitest";

const MIN_MS = -62135596800000; // 0001-01-01T00:00:00.000Z
const MAX_MS = 253402300799999; // 9999-12-31T23:59:59.999Z

test("For every generated in-range integer `ms`, `epochMs` of `instantOf(ms)`'s value is `ms` and `instantOf(ms + 0.5)` gives the same instant; `instantOf(253402300800000)` is `err` `temporal.outOfRange`.", () => {
  fc.assert(
    fc.property(fc.integer({ min: MIN_MS, max: MAX_MS }), (ms) => {
      const a = instantOf(ms);
      expect(a.ok).toBe(true);
      if (!a.ok) return;
      expect(epochMs(a.value)).toBe(ms);
      expect(a.value).toBe(new Date(ms).toISOString());
      const b = instantOf(ms + 0.5);
      expect(b.ok).toBe(true);
      if (b.ok) expect(b.value).toBe(a.value);
    }),
    { seed: 1337, numRuns: 200 },
  );
  const over = instantOf(253402300800000);
  expect(over.ok).toBe(false);
  if (!over.ok) {
    expect(over.error.code).toBe("temporal.outOfRange");
    expect(over.error.data.value).toBe(253402300800000);
  }
});
