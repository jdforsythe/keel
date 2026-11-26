// Seed 1337. std.i18n: collate, numberParts, formatUnit, formatList, formatDateTime and pluralCategories, each the
// `Intl` call its API line names; the stdlib formatters reach `Intl` through them.
import fc from "fast-check";
import { expect, test } from "vitest";
import type { Locale } from "../src/Locale.schema.ts";
import { collate } from "../src/collate.ts";
import { formatDateTime } from "../src/formatDateTime.ts";
import { formatList } from "../src/formatList.ts";
import { formatNumber } from "../src/formatNumber.ts";
import { formatUnit } from "../src/formatUnit.ts";
import { numberParts } from "../src/numberParts.ts";
import { pluralCategories } from "../src/pluralCategories.ts";

const SEED = 1337;
const TAGS: readonly Locale[] = [
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
];
const locale = fc.constantFrom(...TAGS);
const joined = (parts: readonly Intl.NumberFormatPart[]): string => parts.map((p) => p.value).join("");

test("collate is Intl.Collator's compare, held per locale", () => {
  fc.assert(
    fc.property(fc.string(), fc.string(), locale, (a, b, l) => {
      expect(collate(a, b, l)).toBe(new Intl.Collator(l).compare(a, b));
      expect(collate(a, b, l)).toBe(collate(a, b, l));
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("numberParts joined is formatNumber's text, and currency style takes the code and display", () => {
  fc.assert(
    fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), locale, (n, l) => {
      expect(joined(numberParts(n, l))).toBe(formatNumber(n, l));
    }),
    { seed: SEED, numRuns: 200 },
  );
  expect(joined(numberParts(1234567.5, "de-DE"))).toBe("1.234.567,5");
  expect(joined(numberParts("-0.05", "en-US", "EUR"))).toBe("-€0.05");
  expect(numberParts(1, "en-US", "USD", "narrowSymbol")).toContainEqual({ type: "currency", value: "$" });
});

test("a decimal string is formatted exactly, past a float's digits", () => {
  expect(joined(numberParts("12345678901234.56", "en-US", "USD"))).toBe("$12,345,678,901,234.56");
});

test("formatUnit, formatList, formatDateTime and pluralCategories are the Intl calls they name", () => {
  expect(formatUnit(90, "en-US", "minute", "long")).toBe("90 minutes");
  expect(formatList(["1 hr", "5 min"], "en-US", "unit", "short")).toBe("1 hr, 5 min");
  const md: { readonly month: "2-digit"; readonly day: "2-digit" } = { month: "2-digit", day: "2-digit" };
  expect(formatDateTime(0, "en-US", { ...md, timeZone: "UTC" })).toBe("01/01");
  expect(formatDateTime(0, "en-US", { ...md, timeZone: "America/New_York" })).toBe("12/31");
  expect(pluralCategories("en-US")).toEqual(["one", "other"]);
  expect(pluralCategories("ja-JP")).toEqual(["other"]);
});

test("numberParts takes every plain decimal string and refuses one with anything appended or prepended", () => {
  const decimal = fc.stringMatching(/^-?(?:0|[1-9][0-9]{0,30})(?:\.[0-9]{1,20})?$/);
  const junk = fc.constantFrom("e", "e5", " ", "_", "x", "+", ".", "0x");
  fc.assert(
    fc.property(decimal, junk, fc.boolean(), (d, j, before) => {
      expect(
        numberParts(d, "en-US")
          .map((p) => p.value)
          .join(""),
      ).not.toBe("NaN");
      const bad = before ? `${j}${d}` : `${d}${j}`;
      expect(() => Reflect.apply(numberParts, undefined, [bad, "en-US"])).toThrow(RangeError);
    }),
    { seed: 1337, numRuns: 200 },
  );
});
