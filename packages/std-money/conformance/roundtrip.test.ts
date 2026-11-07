// Spec: std.money, clause "For every value `gen(Money)` produces, `Money.parse` accepts it and `Money.parse(Money.encode(v))` returns an equal value."
// Seed 1337
import { Money } from "@keel/std-money";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, test } from "vitest";

test("For every value `gen(Money)` produces, `Money.parse` accepts it and `Money.parse(Money.encode(v))` returns an equal value.", () => {
  fc.assert(
    fc.property(gen(Money), (v) => {
      expect(Money.parse(v).ok).toBe(true);
      const back = Money.parse(Money.encode(v));
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.value).toEqual(v);
    }),
    { seed: 1337, numRuns: 100 },
  );
});
