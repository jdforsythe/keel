// Spec: std.money, clause "For generated same-currency pairs whose sum is in bounds, `addMoney(a, b)` is `ok` with `amount` `a.amount + b.amount` and equals `addMoney(b, a)`."
// Spec: std.money, clause "Different currencies give `err` `money.currencyMismatch` with `data` `{ left: a.currency, right: b.currency }`; an out-of-bounds sum gives `err` `money.overflow`."
// Seed 1337
import { addMoney } from "@keel/std-money";
import fc from "fast-check";
import { expect, test } from "vitest";

const MAX = 1e15;
const currency = fc.constantFrom<"EUR" | "GBP" | "JPY" | "USD">("EUR", "GBP", "JPY", "USD");
const amount = fc.integer({ min: -MAX, max: MAX });
const run = { seed: 1337, numRuns: 100 };

test("For generated same-currency pairs whose sum is in bounds, `addMoney(a, b)` is `ok` with `amount` `a.amount + b.amount` and equals `addMoney(b, a)`.", () => {
  fc.assert(
    fc.property(currency, amount, amount, (c, x, y) => {
      fc.pre(Math.abs(x + y) <= MAX);
      const a = { amount: x, currency: c };
      const b = { amount: y, currency: c };
      const r = addMoney(a, b);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual({ amount: x + y, currency: c });
      expect(r).toEqual(addMoney(b, a));
    }),
    run,
  );
});

test("Different currencies give `err` `money.currencyMismatch` with `data` `{ left: a.currency, right: b.currency }`; an out-of-bounds sum gives `err` `money.overflow`.", () => {
  fc.assert(
    fc.property(currency, currency, amount, amount, (c1, c2, x, y) => {
      fc.pre(c1 !== c2);
      const r = addMoney({ amount: x, currency: c1 }, { amount: y, currency: c2 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("money.currencyMismatch");
        expect(r.error.data).toEqual({ left: c1, right: c2 });
      }
    }),
    run,
  );
  fc.assert(
    fc.property(currency, fc.integer({ min: 1, max: MAX }), fc.boolean(), (c, x, neg) => {
      // x + y is MAX + 1 (or its negation): outside the bounds, exactly representable
      const y = MAX - x + 1;
      const a = { amount: neg ? -x : x, currency: c };
      const b = { amount: neg ? -y : y, currency: c };
      const r = addMoney(a, b);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("money.overflow");
        expect(r.error.data).toEqual({ amount: a.amount + b.amount });
      }
    }),
    run,
  );
});
