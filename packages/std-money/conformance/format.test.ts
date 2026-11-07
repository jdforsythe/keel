// Spec: std.money, clause "For every generated `Money`, `formatMoney` matches `^-?\d+(\.\d{e})? [A-Z]{3}$` with `e` the currency's exponent (no fraction when 0), and parsing its number times `10^e` gives back `amount`."
// Seed 1337
import { Money, formatMoney } from "@keel/std-money";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, test } from "vitest";

test("For every generated `Money`, `formatMoney` matches `^-?\\d+(\\.\\d{e})? [A-Z]{3}$` with `e` the currency's exponent (no fraction when 0), and parsing its number times `10^e` gives back `amount`.", () => {
  fc.assert(
    fc.property(gen(Money), (m) => {
      const e = m.currency === "JPY" ? 0 : 2;
      const out = formatMoney(m);
      const re = e === 0 ? /^-?\d+ [A-Z]{3}$/ : /^-?\d+\.\d{2} [A-Z]{3}$/;
      expect(out).toMatch(re);
      const [num = "", code] = out.split(" ");
      expect(code).toBe(m.currency);
      const neg = num.startsWith("-");
      const digits = num.replace("-", "").replace(".", "");
      const minor = BigInt(digits) * (neg ? -1n : 1n);
      expect(minor).toBe(BigInt(m.amount));
    }),
    { seed: 1337, numRuns: 100 },
  );
  expect(formatMoney({ amount: -5, currency: "USD" })).toBe("-0.05 USD");
  expect(formatMoney({ amount: 1234, currency: "JPY" })).toBe("1234 JPY");
});
