// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { formatMoney } from "../src/formatMoney.ts";
import { EXPONENT } from "../src/internal/EXPONENT.ts";
import { parseMoney } from "../src/parseMoney.ts";

const SEED = 1337;
const LOCALES = [
  "de-DE",
  "en-GB",
  "en-US",
  "es-ES",
  "fr-FR",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "nl-NL",
  "pt-BR",
  "zh-CN",
] as const;
const CURRENCIES = ["EUR", "GBP", "JPY", "USD"] as const;
const locale = fc.constantFrom(...LOCALES);
const currency = fc.constantFrom(...CURRENCIES);
const typed = fc.stringMatching(/^[-−+()$€£¥.,'   A-Za-z0-9]{0,70}$/);

test("parseMoney never throws and answers ok or one of the four codes, whatever is typed", () => {
  fc.assert(
    fc.property(fc.oneof(typed, fc.string({ maxLength: 80 })), currency, locale, (text, c, l) => {
      const r = parseMoney(text, c, l);
      if (r.ok) {
        expect(r.value.currency).toBe(c);
        expect(Number.isSafeInteger(r.value.amount)).toBe(true);
        expect(Object.is(r.value.amount, -0)).toBe(false);
      } else {
        expect(["money.unreadable", "money.currencyMismatch", "money.tooManyDecimals", "money.overflow"]).toContain(
          r.error.code,
        );
        if (text.length >= 3) expect(r.error.message).not.toContain(text);
      }
    }),
    { seed: SEED, numRuns: 500 },
  );
});

test("a plain amount with the currency's exponent reads as its minor units in every locale's own separators", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1e12 }), currency, locale, (amount, c, l) => {
      const text = formatMoney({ amount, currency: c }, l).replace(/[^\d.,\s]/g, "");
      expect(parseMoney(text, c, l)).toEqual({ ok: true, value: { amount, currency: c } });
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("more fraction digits than the exponent are an error and never rounded", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 999 }), fc.integer({ min: 1, max: 3 }), currency, (whole, extra, c) => {
      const text = `${whole}.${"1".repeat(EXPONENT[c] + extra)}`;
      const r = parseMoney(text, c, "en-US");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("money.tooManyDecimals");
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("the 64-character limit counts the raw text, before trimming", () => {
  expect(parseMoney(`${" ".repeat(59)}12.50`, "USD", "en-US").ok).toBe(true);
  expect(parseMoney(`${" ".repeat(60)}12.50`, "USD", "en-US").ok).toBe(false);
  expect(parseMoney(`${" ".repeat(58)}12.50 `, "USD", "en-US").ok).toBe(true);
});
