// Spec: std.money, clause "For every generated `Money` and `Locale` `l`, `formatMoney(m, l)` equals the `Intl` expression above, and the digits of its `integer` and `fraction` parts (`formatToParts`), read as one integer, give back the absolute `amount`; `{ amount: 1800, currency: 'JPY' }` is `¥1,800` in `en-US`, `1.800 ¥` (U+00A0) in `de-DE` and `￥1,800` in `ja-JP`."
// Spec: std.money API, clause 7 `formatMoney(m, locale)`, rfc:0079. `{ amount: 1250, currency: 'EUR' }` is `€12.50` in `en-US` and `12,50 €` in `de-DE` (U+00A0).
// Seed 1337
import { gen } from "@keel/schema/gen";
import { Money, formatMoney } from "@keel/std-money";
import fc from "fast-check";
import { expect, test } from "vitest";

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

// Exact decimal string of `amount` at the currency's exponent; no float.
function decimal(amount: number, currency: string): string {
  const e = currency === "JPY" ? 0 : 2;
  const digits = String(Math.abs(amount)).padStart(e + 1, "0");
  const body = e === 0 ? digits : `${digits.slice(0, -e)}.${digits.slice(-e)}`;
  return amount < 0 ? `-${body}` : body;
}

test("For every generated `Money` and `Locale` `l`, `formatMoney(m, l)` equals the `Intl` expression above, and the digits of its `integer` and `fraction` parts (`formatToParts`), read as one integer, give back the absolute `amount`; `{ amount: 1800, currency: 'JPY' }` is `¥1,800` in `en-US`, `1.800 ¥` (U+00A0) in `de-DE` and `￥1,800` in `ja-JP`.", () => {
  fc.assert(
    fc.property(gen(Money), fc.constantFrom(...LOCALES), (m, l) => {
      const nf = new Intl.NumberFormat(l, { style: "currency", currency: m.currency });
      const d = decimal(m.amount, m.currency);
      expect(formatMoney(m, l)).toBe(nf.format(d));
      const digits = nf
        .formatToParts(d)
        .filter((p) => p.type === "integer" || p.type === "fraction")
        .map((p) => p.value)
        .join("");
      expect(BigInt(digits)).toBe(BigInt(Math.abs(m.amount)));
    }),
    { seed: 1337, numRuns: 200 },
  );
  expect(formatMoney({ amount: 1250, currency: "EUR" }, "en-US")).toBe("€12.50");
  expect(formatMoney({ amount: 1250, currency: "EUR" }, "de-DE")).toBe("12,50 €");
  expect(formatMoney({ amount: 1800, currency: "JPY" }, "en-US")).toBe("¥1,800");
  expect(formatMoney({ amount: 1800, currency: "JPY" }, "de-DE")).toBe("1.800 ¥");
  expect(formatMoney({ amount: 1800, currency: "JPY" }, "ja-JP")).toBe("￥1,800");
  expect(formatMoney({ amount: -5, currency: "USD" }, "en-US")).toBe(
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format("-0.05"),
  );
});
