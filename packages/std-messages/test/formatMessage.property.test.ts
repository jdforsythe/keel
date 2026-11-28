import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import { type Locale, formatNumber, plural } from "@keel/std-i18n";
import { formatMessage, messages } from "@keel/std-messages";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const AppLocale = s.enum(["en-US", "de-DE", "ja-JP"]);
const load = (locale: string) => import(`./fixtures/${locale}.ts`);
const Demo = messages(
  AppLocale,
  { a: {}, b: { n: s.int(), who: s.string() }, c: { k: s.enum(["x", "y", "z"]), m: s.number() } },
  load,
);
const word = fc.stringMatching(/^[A-Za-z ]{0,12}$/);

test("formatMessage is total over generated entries and params, and fills every placeholder", () => {
  fc.assert(
    fc.property(
      gen(Demo),
      fc.integer({ min: -1e6, max: 1e6 }),
      word,
      fc.constantFrom("x", "y", "z"),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.constantFrom<Locale>("en-US", "de-DE", "ja-JP"),
      (entry, n, who, k, m, locale) => {
        expect(Demo.parse(entry).ok).toBe(true);
        for (const out of [formatMessage(entry.b, { n, who }, locale), formatMessage(entry.c, { k, m }, locale)]) {
          expect(typeof out).toBe("string");
          expect(out).not.toMatch(/[{}]/);
        }
      },
    ),
    { seed: SEED, numRuns: 300 },
  );
});

test("a {name} placeholder renders its string param as written and a number through formatNumber", () => {
  fc.assert(
    fc.property(
      word,
      fc.integer({ min: 0, max: 1e7 }),
      fc.constantFrom<Locale>("en-US", "de-DE", "ja-JP"),
      (who, n, l) => {
        const out = formatMessage({ text: "{who}: {n}" }, { who, n }, l);
        expect(out).toBe(`${who}: ${formatNumber(n, l)}`);
      },
    ),
    { seed: SEED, numRuns: 200 },
  );
});

test("a plural renders the form Intl.PluralRules selects, with # and {n} filled", () => {
  const msg = { plural: "n", zero: "none", one: "# one {n}", other: "# many" };
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1e5 }), fc.constantFrom<Locale>("en-US", "de-DE", "ja-JP"), (n, l) => {
      // The category `Intl.PluralRules` selects: `plural` over forms named by their category (std.i18n).
      const form = plural(n, l, { zero: "zero", one: "one", two: "two", few: "few", many: "many", other: "other" });
      const num = formatNumber(n, l);
      const want = form === "zero" ? "none" : form === "one" ? `${num} one ${num}` : `${num} many`;
      expect(formatMessage(msg, { n }, l)).toBe(want);
    }),
    { seed: SEED, numRuns: 200 },
  );
});
