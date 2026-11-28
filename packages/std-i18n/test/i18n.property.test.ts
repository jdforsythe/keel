// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { Locale } from "../src/Locale.schema.ts";
import { formatNumber } from "../src/formatNumber.ts";
import { localeName } from "../src/localeName.ts";
import { plural } from "../src/plural.ts";

const SEED = 1337;
const TAGS = [
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
const locale = fc.constantFrom(...TAGS);
const finite = fc.double({ noNaN: true, noDefaultInfinity: true });

test("formatNumber agrees with Intl.NumberFormat for every finite number and Locale", () => {
  fc.assert(
    fc.property(finite, locale, (n, l) => {
      expect(formatNumber(n, l)).toBe(new Intl.NumberFormat(l).format(n));
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("plural with only `other` is `other` with each # replaced, for every n and Locale", () => {
  fc.assert(
    fc.property(finite, locale, fc.stringMatching(/^[a-z# ]{0,12}$/), (n, l, other) => {
      expect(plural(n, l, { other })).toBe(other.split("#").join(formatNumber(n, l)));
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("plural picks the form named by Intl.PluralRules when every form is given", () => {
  const forms = { zero: "zero", one: "one", two: "two", few: "few", many: "many", other: "other" };
  fc.assert(
    fc.property(fc.integer({ min: -1e6, max: 1e6 }), locale, (n, l) => {
      expect(plural(n, l, forms)).toBe(new Intl.PluralRules(l).select(n));
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("localeName is non-empty for every Locale, and every tag parses", () => {
  for (const l of TAGS) {
    expect(Locale.parse(l).ok).toBe(true);
    expect(localeName(l).length).toBeGreaterThan(0);
  }
});

test("plural takes the exact form for a non-negative safe integer, else the result without exact forms", () => {
  const exact = fc.dictionary(
    fc.integer({ min: 0, max: 20 }).map((n) => `=${n}` as const),
    fc.string({ maxLength: 8 }),
  );
  fc.assert(
    fc.property(fc.integer({ min: -3, max: 25 }), locale, exact, (n, l, forms) => {
      const withExact = { other: "# o", one: "# one", ...forms };
      const picked = Number.isInteger(n) && n >= 0 ? forms[`=${n}`] : undefined;
      const base = plural(n, l, { other: "# o", one: "# one" });
      expect(plural(n, l, withExact)).toBe(picked === undefined ? base : picked.split("#").join(formatNumber(n, l)));
    }),
    { seed: SEED },
  );
});

test("plural never selects a malformed = key", () => {
  expect(plural(1, "en-US", { "=01": "x", "=1.0": "y", "=-1": "z", other: "#" })).toBe("1");
  expect(plural(-1, "en-US", { "=-1": "z", other: "#" })).toBe("-1");
  expect(plural(1.5, "en-US", { "=1.5": "z", other: "#" })).toBe("1.5");
});
