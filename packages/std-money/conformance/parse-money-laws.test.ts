// Spec: std.money, clause "For every generated `Money` `m` and `Locale` `l`, `parseMoney(formatMoney(m, l), m.currency, l)` is `ok` with a value equal to `m`; for every second `Locale` `l2`, `parseMoney(formatMoney(m, l), m.currency, l2)` is `ok` with a value equal to `m` or an `err`, never `ok` with another amount."
// Seed 1337
import { gen } from "@keel/schema/gen";
import { Money, formatMoney, parseMoney } from "@keel/std-money";
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
const locale = fc.constantFrom(...LOCALES);

test("For every generated `Money` `m` and `Locale` `l`, `parseMoney(formatMoney(m, l), m.currency, l)` is `ok` with a value equal to `m`; for every second `Locale` `l2`, `parseMoney(formatMoney(m, l), m.currency, l2)` is `ok` with a value equal to `m` or an `err`, never `ok` with another amount.", () => {
  fc.assert(
    fc.property(gen(Money), locale, locale, (m, l, l2) => {
      // same locale: the text `formatMoney` writes reads back as the same Money
      const same = parseMoney(formatMoney(m, l), m.currency, l);
      expect(same).toEqual({ ok: true, value: m });
      // another locale: the same Money or an `err`, never another amount
      const other = parseMoney(formatMoney(m, l), m.currency, l2);
      if (other.ok) expect(other.value).toEqual(m);
    }),
    { seed: 1337, numRuns: 1000 },
  );
  // the laws hold at the edges of the amount bounds and at zero, in every locale pair
  const edges = [0, 1, -1, 5, -5, 99, 100, 1e15, -1e15, 123456789].flatMap((amount) =>
    (["EUR", "GBP", "JPY", "USD"] as const).map((currency) => ({ amount, currency })),
  );
  for (const m of edges) {
    for (const l of LOCALES) {
      expect(parseMoney(formatMoney(m, l), m.currency, l)).toEqual({ ok: true, value: m });
      for (const l2 of LOCALES) {
        const r = parseMoney(formatMoney(m, l), m.currency, l2);
        if (r.ok) expect(r.value).toEqual(m);
      }
    }
  }
});
