// Spec: std.text, clause "With `process.env.TZ` and `process.env.LANG` changed, every export returns equal results for equal arguments."
// Seed 1337
import { gen } from "@keel/schema/gen";
import { Locale } from "@keel/std-i18n";
import { Email, Slug, compareText, graphemes, line, para, truncate } from "@keel/std-text";
import fc from "fast-check";
import { expect, test } from "vitest";

function snapshot(v: string, w: string, l: Locale, max: number): unknown {
  return [
    graphemes(v),
    truncate(v, max),
    compareText(v, w, l),
    line({ max: 20 }).parse(v).ok,
    para({ max: 20 }).parse(v).ok,
    Email.parse(v).ok,
    Slug.parse(v).ok,
    line({ max: 20 }).doc(),
  ];
}

test("With `process.env.TZ` and `process.env.LANG` changed, every export returns equal results for equal arguments.", () => {
  const tz = process.env.TZ;
  const lang = process.env.LANG;
  try {
    fc.assert(
      fc.property(
        fc.fullUnicodeString({ maxLength: 20 }),
        fc.fullUnicodeString({ maxLength: 20 }),
        gen(Locale),
        fc.integer({ min: 1, max: 20 }),
        (v, w, l, max) => {
          process.env.TZ = "UTC";
          process.env.LANG = "en_US.UTF-8";
          const a = snapshot(v, w, l, max);
          process.env.TZ = "Asia/Tokyo";
          process.env.LANG = "de_DE.UTF-8";
          const b = snapshot(v, w, l, max);
          expect(b).toEqual(a);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  } finally {
    if (tz === undefined) Reflect.deleteProperty(process.env, "TZ");
    else process.env.TZ = tz;
    if (lang === undefined) Reflect.deleteProperty(process.env, "LANG");
    else process.env.LANG = lang;
  }
});
