// std.messages, clause "**Plurals.** A plural message holds category forms, `other` and any of `zero`, `one`, `two`, `few` and `many`, and exact forms. An exact form's key is `=` and a non-negative safe integer in decimal digits, with no sign, point, exponent or leading zero (`'=0'`, `'=1'`, `'=12'`); any other key starting with `=` fails with rule `format`. An exact form applies when `params[p]` is its number; otherwise the category `Intl.PluralRules` selects for the locale, else `other`. A category form applies only where the locale's rules select that category: no supported locale selects `zero`, `two` or `few`, and `ja-JP`, `ko-KR` and `zh-CN` select `other` alone, so "none yet" is `'=0'`."
// Spec: std.messages, clause "In that fixture, `count` with `'=0'` or `'=12'` beside `other` parses; with `'=01'`, `'=-1'`, `'=1.5'`, `'=1e3'`, `'= 1'` or `'=x'` it fails with rule `format` at the key's path."
// Spec: std.messages, clause "`formatMessage({ plural: 'n', '=0': 'No receipts yet', one: '# receipt', other: '# receipts' }, { n }, l)` is `No receipts yet` for `n` 0 and `1 receipt` for 1 in `en-US`, and `No receipts yet` for 0 and `5 receipts` for 5 in `de-DE` and `ja-JP`; `{ plural: 'n', zero: 'none', other: '# receipts' }` with `n` 0 is `0 receipts` in `en-US`; `'=1': 'One receipt'` beside `one` gives `One receipt` for 1; `'=3': '# of 3'` gives `3 of 3` for 3."
// Seed 1337
import { gen } from "@keel/schema/gen";
import { formatMessage } from "@keel/std-messages";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
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
const base = {
  title: "Recipes",
  count: { plural: "n", one: "# recipe", other: "# recipes" },
  kind: { select: "k", cases: { a: "A", b: "B" } },
};
const issues = async (count: object) => {
  const { Demo } = await import("./fixtures/Demo.schema.ts");
  const r = Demo.parse({ ...base, count });
  return r.ok ? [] : r.error.data.issues;
};
const text = fc.stringMatching(/^[a-z# ]{1,10}$/);

test("**Plurals.** A plural message holds category forms, `other` and any of `zero`, `one`, `two`, `few` and `many`, and exact forms. An exact form's key is `=` and a non-negative safe integer in decimal digits, with no sign, point, exponent or leading zero (`'=0'`, `'=1'`, `'=12'`); any other key starting with `=` fails with rule `format`. An exact form applies when `params[p]` is its number; otherwise the category `Intl.PluralRules` selects for the locale, else `other`. A category form applies only where the locale's rules select that category: no supported locale selects `zero`, `two` or `few`, and `ja-JP`, `ko-KR` and `zh-CN` select `other` alone, so \"none yet\" is `'=0'`.", async () => {
  // keys: `=` and a non-negative safe integer in canonical decimal
  for (const k of ["=0", "=1", "=12", `=${Number.MAX_SAFE_INTEGER}`]) {
    expect(await issues({ plural: "n", [k]: "x", other: "# y" })).toEqual([]);
  }
  // any other key starting with `=` fails with rule `format`
  for (const k of [
    "=00",
    "=007",
    "=-0",
    "=+1",
    "=1.",
    "=0.0",
    "=1E3",
    "=0x1",
    "=",
    "=٣",
    `=${Number.MAX_SAFE_INTEGER + 2}`,
  ]) {
    expect(await issues({ plural: "n", [k]: "x", other: "# y" })).toEqual([{ path: ["count"], rule: "format" }]);
  }
  await fc.assert(
    fc.asyncProperty(
      fc.string({ maxLength: 8 }).filter((t) => !/^(0|[1-9][0-9]{0,14})$/.test(t)),
      async (t) => {
        expect(await issues({ plural: "n", [`=${t}`]: "x", other: "# y" })).toEqual([
          { path: ["count"], rule: "format" },
        ]);
      },
    ),
    { seed: SEED, numRuns: 100 },
  );
  // an exact form applies when `params[p]` is its number; otherwise the category, else `other`
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 15 }),
      fc.constantFrom(...LOCALES),
      fc.uniqueArray(fc.integer({ min: 0, max: 15 }), { maxLength: 5 }),
      text,
      text,
      text,
      (n, l, keys, one, other, ex) => {
        const msg: { plural: string; one: string; other: string; [k: `=${number}`]: string } = {
          plural: "n",
          one,
          other,
        };
        for (const k of keys) msg[`=${k}`] = `${ex}${k}`;
        const cat = new Intl.PluralRules(l).select(n) === "one" ? one : other;
        const chosen = keys.includes(n) ? `${ex}${n}` : cat;
        expect(formatMessage(msg, { n }, l)).toBe(chosen.split("#").join(new Intl.NumberFormat(l).format(n)));
      },
    ),
    { seed: SEED, numRuns: 300 },
  );
  // a category form applies only where the locale's rules select it
  for (const l of LOCALES) {
    const cats = new Intl.PluralRules(l).resolvedOptions().pluralCategories;
    for (const never of ["zero", "two", "few"] as const) expect(cats).not.toContain(never);
  }
  for (const l of ["ja-JP", "ko-KR", "zh-CN"] as const) {
    expect(new Intl.PluralRules(l).resolvedOptions().pluralCategories).toEqual(["other"]);
    expect(formatMessage({ plural: "n", one: "ONE", other: "# x" }, { n: 1 }, l)).toBe("1 x");
  }
  expect(formatMessage({ plural: "n", "=0": "none yet", other: "# x" }, { n: 0 }, "ja-JP")).toBe("none yet");
});

test("In that fixture, `count` with `'=0'` or `'=12'` beside `other` parses; with `'=01'`, `'=-1'`, `'=1.5'`, `'=1e3'`, `'= 1'` or `'=x'` it fails with rule `format` at the key's path.", async () => {
  for (const k of ["=0", "=12"]) {
    expect(await issues({ plural: "n", [k]: "x", other: "# y" })).toEqual([]);
  }
  for (const k of ["=01", "=-1", "=1.5", "=1e3", "= 1", "=x"]) {
    expect(await issues({ plural: "n", [k]: "x", other: "# y" })).toEqual([{ path: ["count"], rule: "format" }]);
  }
  // entries generated for the set parse and round-trip with exact forms present
  const { Demo } = await import("./fixtures/Demo.schema.ts");
  const withExact = { ...base, count: { plural: "n", "=0": "none", "=12": "# dozen", other: "# recipes" } };
  const r = Demo.parse(withExact);
  expect(r.ok).toBe(true);
  expect(Demo.parse(Demo.encode(withExact))).toEqual({ ok: true, value: withExact });
  fc.assert(
    fc.property(gen(Demo), (entry) => {
      expect(Demo.parse(Demo.encode(entry))).toEqual({ ok: true, value: entry });
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("`formatMessage({ plural: 'n', '=0': 'No receipts yet', one: '# receipt', other: '# receipts' }, { n }, l)` is `No receipts yet` for `n` 0 and `1 receipt` for 1 in `en-US`, and `No receipts yet` for 0 and `5 receipts` for 5 in `de-DE` and `ja-JP`; `{ plural: 'n', zero: 'none', other: '# receipts' }` with `n` 0 is `0 receipts` in `en-US`; `'=1': 'One receipt'` beside `one` gives `One receipt` for 1; `'=3': '# of 3'` gives `3 of 3` for 3.", () => {
  const f = { plural: "n", "=0": "No receipts yet", one: "# receipt", other: "# receipts" };
  expect(formatMessage(f, { n: 0 }, "en-US")).toBe("No receipts yet");
  expect(formatMessage(f, { n: 1 }, "en-US")).toBe("1 receipt");
  for (const l of ["de-DE", "ja-JP"] as const) {
    expect(formatMessage(f, { n: 0 }, l)).toBe("No receipts yet");
    expect(formatMessage(f, { n: 5 }, l)).toBe("5 receipts");
  }
  expect(formatMessage({ plural: "n", zero: "none", other: "# receipts" }, { n: 0 }, "en-US")).toBe("0 receipts");
  expect(
    formatMessage({ plural: "n", "=1": "One receipt", one: "# receipt", other: "# receipts" }, { n: 1 }, "en-US"),
  ).toBe("One receipt");
  expect(formatMessage({ plural: "n", "=3": "# of 3", other: "# receipts" }, { n: 3 }, "en-US")).toBe("3 of 3");
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.constantFrom(...LOCALES), (n, l) => {
      expect(formatMessage(f, { n }, l)).toBe(
        n === 0 ? "No receipts yet" : formatMessage({ ...f, "=0": "x" }, { n }, l),
      );
    }),
    { seed: SEED, numRuns: 200 },
  );
});
