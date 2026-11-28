// Spec: std.i18n, clause "`plural(n, 'en-US', { one: '# recipe', other: '# recipes' })` is `1 recipe` for 1 and `2 recipes` for 2; with the same forms, `ja-JP` gives `1 recipes` for 1 and `de-DE` gives `1.234 recipes` for 1234. For every generated `n` and `Locale` `l`, the result is the form `Intl.PluralRules` selects, else `other`, with `#` replaced."
// Seed 1337
import { plural } from "@keel/std-i18n";
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
const text = fc.stringMatching(/^[a-z# ]{0,10}$/);
const forms = fc.record(
  { other: text, zero: text, one: text, two: text, few: text, many: text },
  { requiredKeys: ["other"] },
);

test("`plural(n, 'en-US', { one: '# recipe', other: '# recipes' })` is `1 recipe` for 1 and `2 recipes` for 2; with the same forms, `ja-JP` gives `1 recipes` for 1 and `de-DE` gives `1.234 recipes` for 1234. For every generated `n` and `Locale` `l`, the result is the form `Intl.PluralRules` selects, else `other`, with `#` replaced.", () => {
  const f = { one: "# recipe", other: "# recipes" };
  expect(plural(1, "en-US", f)).toBe("1 recipe");
  expect(plural(2, "en-US", f)).toBe("2 recipes");
  expect(plural(1, "ja-JP", f)).toBe("1 recipes");
  expect(plural(1234, "de-DE", f)).toBe("1.234 recipes");
  fc.assert(
    fc.property(
      fc.oneof(fc.integer({ min: -1000, max: 1000 }), fc.double({ noNaN: true, noDefaultInfinity: true })),
      fc.constantFrom(...LOCALES),
      forms,
      (n, l, fs) => {
        const cat = new Intl.PluralRules(l).select(n);
        const byCategory: Record<Intl.LDMLPluralRule, string | undefined> = {
          zero: fs.zero,
          one: fs.one,
          two: fs.two,
          few: fs.few,
          many: fs.many,
          other: fs.other,
        };
        const chosen = byCategory[cat] ?? fs.other;
        const expected = chosen.split("#").join(new Intl.NumberFormat(l).format(n));
        expect(plural(n, l, fs)).toBe(expected);
      },
    ),
    { seed: 1337, numRuns: 300 },
  );
});
