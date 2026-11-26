// Spec: std.i18n, clause "For every generated `a`, `b` and `Locale` `l`, `collate(a, b, l)` equals `new Intl.Collator(l).compare(a, b)`; for every generated finite `n`, the values of `numberParts(n, l)` joined equal `formatNumber(n, l)`."
// Seed 1337
import { collate, formatNumber, numberParts } from "@keel/std-i18n";
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

test("For every generated `a`, `b` and `Locale` `l`, `collate(a, b, l)` equals `new Intl.Collator(l).compare(a, b)`", () => {
  fc.assert(
    fc.property(fc.string(), fc.string(), fc.constantFrom(...LOCALES), (a, b, l) => {
      expect(collate(a, b, l)).toBe(new Intl.Collator(l).compare(a, b));
    }),
    { seed: 1337, numRuns: 200 },
  );
});

test("`collate` held across calls gives equal results for equal arguments", () => {
  fc.assert(
    fc.property(fc.string(), fc.string(), fc.constantFrom(...LOCALES), (a, b, l) => {
      expect(collate(a, b, l)).toBe(collate(a, b, l));
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("For every generated finite `n`, the values of `numberParts(n, l)` joined equal `formatNumber(n, l)`", () => {
  fc.assert(
    fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.constantFrom(...LOCALES), (n, l) => {
      expect(
        numberParts(n, l)
          .map((p) => p.value)
          .join(""),
      ).toBe(formatNumber(n, l));
    }),
    { seed: 1337, numRuns: 200 },
  );
});
