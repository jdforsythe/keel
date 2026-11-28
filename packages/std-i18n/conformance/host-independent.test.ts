// Spec: std.i18n, clause "With `process.env.TZ` and `process.env.LANG` changed, every export returns equal results for equal arguments."
// Seed 1337
import {
  collate,
  formatDateTime,
  formatList,
  formatNumber,
  formatUnit,
  localeName,
  numberParts,
  plural,
  pluralCategories,
} from "@keel/std-i18n";
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

function underEnv<T>(tz: string, lang: string, run: () => T): T {
  const prev = { TZ: process.env.TZ, LANG: process.env.LANG };
  process.env.TZ = tz;
  process.env.LANG = lang;
  try {
    return run();
  } finally {
    if (prev.TZ === undefined) Reflect.deleteProperty(process.env, "TZ");
    else process.env.TZ = prev.TZ;
    if (prev.LANG === undefined) Reflect.deleteProperty(process.env, "LANG");
    else process.env.LANG = prev.LANG;
  }
}

test("With `process.env.TZ` and `process.env.LANG` changed, every export returns equal results for equal arguments.", () => {
  fc.assert(
    fc.property(
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.constantFrom(...LOCALES),
      fc.constantFrom("UTC", "Asia/Tokyo", "America/Los_Angeles"),
      fc.constantFrom("C", "de_DE.UTF-8", "ja_JP.UTF-8"),
      (n, l, tz, lang) => {
        const forms = { one: "# a", other: "# b" };
        const run = () => [
          formatNumber(n, l),
          plural(n, l, forms),
          localeName(l),
          collate("a", "B", l),
          numberParts(n, l),
          numberParts("-0.05", l, "EUR"),
          formatUnit(n, l, "minute", "long"),
          formatList(["a", "b", "c"], l, "conjunction", "long"),
          formatDateTime(0, l, { timeZone: "UTC", month: "2-digit", day: "2-digit", hour: "2-digit" }),
          pluralCategories(l),
        ];
        const base = underEnv("UTC", "en_US.UTF-8", run);
        expect(underEnv(tz, lang, run)).toEqual(base);
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
});
