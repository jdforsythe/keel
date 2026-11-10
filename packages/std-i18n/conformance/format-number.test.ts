// Spec: std.i18n, clause "For every generated finite `n` and every `Locale` `l`, `formatNumber(n, l)` equals `new Intl.NumberFormat(l).format(n)`; `formatNumber(1234.5, l)` is `1,234.5` for `en-US`, `1.234,5` for `de-DE` and `1,234.5` for `ja-JP`."
// Seed 1337
import { formatNumber } from "@keel/std-i18n";
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

test.skip("For every generated finite `n` and every `Locale` `l`, `formatNumber(n, l)` equals `new Intl.NumberFormat(l).format(n)`; `formatNumber(1234.5, l)` is `1,234.5` for `en-US`, `1.234,5` for `de-DE` and `1,234.5` for `ja-JP`.", () => {
  fc.assert(
    fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.constantFrom(...LOCALES), (n, l) => {
      expect(formatNumber(n, l)).toBe(new Intl.NumberFormat(l).format(n));
    }),
    { seed: 1337, numRuns: 200 },
  );
  expect(formatNumber(1234.5, "en-US")).toBe("1,234.5");
  expect(formatNumber(1234.5, "de-DE")).toBe("1.234,5");
  expect(formatNumber(1234.5, "ja-JP")).toBe("1,234.5");
});
