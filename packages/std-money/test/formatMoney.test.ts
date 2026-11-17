// Seed 1337 (no random inputs)
import { expect, test } from "vitest";
import { formatMoney } from "../src/formatMoney.ts";

test("formatMoney writes the exact decimal at the currency's exponent, in the given locale", () => {
  expect(formatMoney({ amount: -5, currency: "USD" }, "en-US")).toBe("-$0.05");
  expect(formatMoney({ amount: 1e15, currency: "EUR" }, "en-US")).toBe("€10,000,000,000,000.00");
  expect(formatMoney({ amount: 999999999999999, currency: "GBP" }, "en-GB")).toBe("£9,999,999,999,999.99");
  expect(formatMoney({ amount: 0, currency: "JPY" }, "ja-JP")).toBe("￥0");
});

test("an amount that is not a safe integer within the Money bound throws in every currency", () => {
  for (const currency of ["JPY", "USD", "EUR", "GBP"] as const) {
    for (const amount of [1.5, 2 ** 53 + 2, 1e15 + 1, -1e15 - 1, Number.POSITIVE_INFINITY]) {
      expect(() => formatMoney({ amount, currency }, "en-US")).toThrow(/no decimal form/);
    }
  }
});

test("an amount outside the Money type (non-integer, NaN) throws instead of formatting a float", () => {
  expect(() => formatMoney({ amount: 1.5, currency: "USD" }, "en-US")).toThrow(/no decimal form/);
  expect(() => formatMoney({ amount: Number.NaN, currency: "EUR" }, "de-DE")).toThrow(/no decimal form/);
});
