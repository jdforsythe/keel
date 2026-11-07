// Spec: std.money, clause "`Money.parse` rejects a non-integer amount (rule `int`), an amount beyond the bounds (rule `min` or `max`), a currency outside the four (rule `enum`) and an undeclared key (rule `unknown-key`), each at that key's path."
// Seed 1337
import { Money } from "@keel/std-money";
import fc from "fast-check";
import { expect, test } from "vitest";

const MAX = 1e15;
const CURRENCIES = ["EUR", "GBP", "JPY", "USD"] as const;
const known: readonly string[] = CURRENCIES;
const currency = fc.constantFrom(...CURRENCIES);

function issues(input: unknown): readonly { path: readonly (string | number)[]; rule: string }[] {
  const r = Money.parse(input);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.error.data.issues;
}

test("`Money.parse` rejects a non-integer amount (rule `int`), an amount beyond the bounds (rule `min` or `max`), a currency outside the four (rule `enum`) and an undeclared key (rule `unknown-key`), each at that key's path.", () => {
  fc.assert(
    fc.property(
      currency,
      fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e9, max: 1e9 }).filter((x) => !Number.isInteger(x)),
      fc.integer({ min: 1, max: 1_000_000 }),
      fc.stringMatching(/^[a-z]{1,8}$/),
      fc.stringMatching(/^[A-Z]{3}$/).filter((c) => !known.includes(c)),
      (cur, frac, over, extra, badCur) => {
        expect(issues({ amount: frac, currency: cur })).toContainEqual({ path: ["amount"], rule: "int" });
        const hi = issues({ amount: MAX + over, currency: cur });
        expect(hi.some((i) => i.path.join(".") === "amount" && (i.rule === "max" || i.rule === "int"))).toBe(true);
        const lo = issues({ amount: -MAX - over, currency: cur });
        expect(lo.some((i) => i.path.join(".") === "amount" && (i.rule === "min" || i.rule === "int"))).toBe(true);
        expect(issues({ amount: 1, currency: badCur })).toContainEqual({ path: ["currency"], rule: "enum" });
        expect(issues({ amount: 1, currency: cur, [extra]: 1 })).toContainEqual({ path: [extra], rule: "unknown-key" });
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
  // exactly one past the bounds is a plain integer, so the rule is min or max
  expect(issues({ amount: MAX + 1, currency: "USD" }).map((i) => i.rule)).toContain("max");
  expect(issues({ amount: -MAX - 1, currency: "USD" }).map((i) => i.rule)).toContain("min");
});
