// Spec: std.i18n, clause "`PluralForms` is `` { other: string; zero?: string; one?: string; two?: string; few?: string; many?: string; readonly [exact: `=${number}`]: string } ``. An exact form's key is `=` and a non-negative safe integer in decimal digits, with no sign, point, exponent or leading zero (`'=0'`, `'=12'`); another `=` key is never selected. `plural(n: number, locale: Locale, forms: PluralForms): string` takes the exact form whose number is `n`, else the form `new Intl.PluralRules(locale).select(n)` names, else `other`, and replaces each `#` in it with `formatNumber(n, locale)`. It is the one plural path; std.messages uses it."
// Spec: std.i18n, clause "`plural(n, l, { '=0': 'none', '=2': '# exactly', one: '# recipe', other: '# recipes' })` is `none` for 0 and `2 exactly` for 2 in every `Locale` `l`, and `1 recipe` for 1 in `en-US`; `{ '=01': 'x', '=1.0': 'y', other: '#' }` gives `1` for 1. For every generated `n`, `l` and forms with exact keys, the result is the exact form for `n` when there is one, else the result without the exact forms."
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
const category = fc.record(
  { other: text, zero: text, one: text, two: text, few: text, many: text },
  { requiredKeys: ["other"] },
);
const exactKeys = fc.uniqueArray(fc.integer({ min: 0, max: 20 }), { maxLength: 6 });
const malformed = ["=01", "=1.0", "=-1", "=+1", "=1e3", "= 1", "=x", "=", "=00", "=1.", "=.5"];

test("`PluralForms` is `` { other: string; zero?: string; one?: string; two?: string; few?: string; many?: string; readonly [exact: `=${number}`]: string } ``. An exact form's key is `=` and a non-negative safe integer in decimal digits, with no sign, point, exponent or leading zero (`'=0'`, `'=12'`); another `=` key is never selected. `plural(n: number, locale: Locale, forms: PluralForms): string` takes the exact form whose number is `n`, else the form `new Intl.PluralRules(locale).select(n)` names, else `other`, and replaces each `#` in it with `formatNumber(n, locale)`. It is the one plural path; std.messages uses it.", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 20 }), fc.constantFrom(...LOCALES), category, text, (n, l, fs, exact) => {
      const withExact = { ...fs, [`=${n}`]: exact };
      const expected = exact.split("#").join(new Intl.NumberFormat(l).format(n));
      expect(plural(n, l, withExact)).toBe(expected);
    }),
    { seed: 1337, numRuns: 200 },
  );
  expect(plural(12, "en-US", { "=12": "a dozen #", other: "#" })).toBe("a dozen 12");
  expect(plural(1234, "de-DE", { "=1234": "# genau", other: "#" })).toBe("1.234 genau");
  // A safe integer well beyond the small range still matches its own key.
  expect(plural(Number.MAX_SAFE_INTEGER, "en-US", { [`=${Number.MAX_SAFE_INTEGER}`]: "max", other: "#" })).toBe("max");
  // Every other `=` key is never selected, whatever the number.
  fc.assert(
    fc.property(
      fc.integer({ min: -5, max: 20 }),
      fc.constantFrom(...LOCALES),
      category,
      fc.constantFrom(...malformed),
      text,
      (n, l, fs, key, x) => {
        expect(plural(n, l, { ...fs, [key]: `${x}!` })).toBe(plural(n, l, fs));
      },
    ),
    { seed: 1337, numRuns: 200 },
  );
});

test("`plural(n, l, { '=0': 'none', '=2': '# exactly', one: '# recipe', other: '# recipes' })` is `none` for 0 and `2 exactly` for 2 in every `Locale` `l`, and `1 recipe` for 1 in `en-US`; `{ '=01': 'x', '=1.0': 'y', other: '#' }` gives `1` for 1. For every generated `n`, `l` and forms with exact keys, the result is the exact form for `n` when there is one, else the result without the exact forms.", () => {
  const f = { "=0": "none", "=2": "# exactly", one: "# recipe", other: "# recipes" };
  for (const l of LOCALES) {
    expect(plural(0, l, f)).toBe("none");
    expect(plural(2, l, f)).toBe("2 exactly");
  }
  expect(plural(1, "en-US", f)).toBe("1 recipe");
  expect(plural(1, "en-US", { "=01": "x", "=1.0": "y", other: "#" })).toBe("1");
  fc.assert(
    fc.property(
      fc.integer({ min: -3, max: 25 }),
      fc.constantFrom(...LOCALES),
      category,
      exactKeys,
      text,
      (n, l, fs, keys, x) => {
        const exact: Record<`=${number}`, string> = {};
        for (const k of keys) exact[`=${k}`] = `${x}|${k}|#`;
        const got = plural(n, l, { ...fs, ...exact });
        const own = keys.includes(n)
          ? `${x}|${n}|#`.split("#").join(new Intl.NumberFormat(l).format(n))
          : plural(n, l, fs);
        expect(got).toBe(own);
      },
    ),
    { seed: 1337, numRuns: 300 },
  );
});
