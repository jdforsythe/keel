import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import type { Locale } from "@keel/std-i18n";
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
        expect(out).toBe(`${who}: ${new Intl.NumberFormat(l).format(n)}`);
      },
    ),
    { seed: SEED, numRuns: 200 },
  );
});

test("a plural renders the form Intl.PluralRules selects, with # and {n} filled", () => {
  const msg = { plural: "n", zero: "none", one: "# one {n}", other: "# many" };
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1e5 }), fc.constantFrom<Locale>("en-US", "de-DE", "ja-JP"), (n, l) => {
      const form = new Intl.PluralRules(l).select(n);
      const num = new Intl.NumberFormat(l).format(n);
      const want = form === "zero" ? "none" : form === "one" ? `${num} one ${num}` : `${num} many`;
      expect(formatMessage(msg, { n }, l)).toBe(want);
    }),
    { seed: SEED, numRuns: 200 },
  );
});
