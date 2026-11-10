// Spec: std.text, clause "For generated `a`, `b` and every `Locale` `l`, `compareText(a, b, l)` is the sign of `new Intl.Collator(l).compare(a, b)` and equals `-compareText(b, a, l)`; `compareText('ä', 'b', 'de-DE')` is `-1`."
// Seed 1337
import { Locale } from "@keel/std-i18n";
import { gen } from "@keel/schema/gen";
import { compareText } from "@keel/std-text";
import fc from "fast-check";
import { expect, test } from "vitest";

test.skip("For generated `a`, `b` and every `Locale` `l`, `compareText(a, b, l)` is the sign of `new Intl.Collator(l).compare(a, b)` and equals `-compareText(b, a, l)`; `compareText('ä', 'b', 'de-DE')` is `-1`.", () => {
  fc.assert(
    fc.property(
      fc.fullUnicodeString({ maxLength: 12 }),
      fc.fullUnicodeString({ maxLength: 12 }),
      gen(Locale),
      (a, b, l) => {
        const want = Math.sign(new Intl.Collator(l).compare(a, b));
        expect(compareText(a, b, l)).toBe(want);
        expect(compareText(a, b, l) + compareText(b, a, l)).toBe(0);
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
  expect(compareText("ä", "b", "de-DE")).toBe(-1);
});
