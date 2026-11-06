// Properties for the sim clock. fast-check seed: 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { simClock } from "../src/internal/simClock.ts";

const FC = { seed: 1337 };

describe("simClock", () => {
  test("property: now() equals the sum of advances and never decreases", () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 1e6, noNaN: true })), (steps) => {
        const c = simClock();
        let sum = 0;
        for (const s of steps) {
          const before = c.now();
          c.advance(s);
          sum += s;
          expect(c.now()).toBeGreaterThanOrEqual(before);
          expect(c.now()).toBe(sum);
        }
      }),
      FC,
    );
  });

  test("property: negative or non-finite advance throws RangeError and leaves now() unchanged", () => {
    const bad = fc.oneof(
      fc.double({ max: -Number.MIN_VALUE, noNaN: true }),
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
    );
    fc.assert(
      fc.property(fc.nat(10_000), bad, (start, ms) => {
        const c = simClock();
        c.advance(start);
        expect(() => c.advance(ms)).toThrow(RangeError);
        expect(c.now()).toBe(start);
      }),
      FC,
    );
  });

  test("property: clocks are independent", () => {
    fc.assert(
      fc.property(fc.nat(10_000), (ms) => {
        const a = simClock();
        const b = simClock();
        a.advance(ms);
        expect(b.now()).toBe(0);
      }),
      FC,
    );
  });
});
