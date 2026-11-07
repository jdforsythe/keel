// Seed 1337
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Money } from "../src/Money.ts";
import { addMoney } from "../src/addMoney.ts";
import { formatMoney } from "../src/formatMoney.ts";

const SEED = 1337;

test("addMoney is associative for one currency when every partial sum is in bounds", () => {
  const amount = fc.integer({ min: -1e12, max: 1e12 });
  fc.assert(
    fc.property(
      amount,
      amount,
      amount,
      fc.constantFrom(...(["EUR", "GBP", "JPY", "USD"] as const)),
      (x, y, z, currency) => {
        const m = (amount: number) => ({ amount, currency });
        const ab = addMoney(m(x), m(y));
        const bc = addMoney(m(y), m(z));
        if (!ab.ok || !bc.ok) throw new Error("in-bounds sums are ok");
        expect(addMoney(ab.value, m(z))).toEqual(addMoney(m(x), bc.value));
      },
    ),
    { seed: SEED, numRuns: 100 },
  );
});

test("formatMoney is injective per currency: distinct amounts format differently", () => {
  fc.assert(
    fc.property(gen(Money), gen(Money), (a, b) => {
      if (a.currency === b.currency && a.amount !== b.amount) expect(formatMoney(a)).not.toBe(formatMoney(b));
    }),
    { seed: SEED, numRuns: 100 },
  );
});
