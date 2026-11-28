import fc from "fast-check";
import { expect, it } from "vitest";
import splitByParts from "../modules/trip/splitByParts.ts";

const parts = fc
  .array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 12 })
  .filter((ns) => ns.some((n) => n > 0));

it("10.00 split three ways loses no cent: the first person owes the extra one", () => {
  expect(splitByParts(1000, [1, 1, 1])).toEqual([334, 333, 333]);
});

it("an uneven split sums to the cost, owes nothing to a person with no parts, and is within one unit of exact", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 1_000_000_000 }), parts, (amount, ps) => {
      const shares = splitByParts(amount, ps);
      const total = ps.reduce((sum, n) => sum + n, 0);
      expect(shares.reduce((sum, n) => sum + n, 0)).toBe(amount);
      shares.forEach((share, i) => {
        const p = ps[i] ?? 0;
        expect(share).toBeGreaterThanOrEqual(0);
        if (p === 0) expect(share).toBe(0);
        expect(Math.abs(share * total - amount * p)).toBeLessThan(total);
      });
    }),
    { numRuns: 500, seed: 31 },
  );
});
