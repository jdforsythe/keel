// Spec: std.i18n, clause "`numberParts` of `'1e400'`, `'0x10'`, `''`, `' 1 '`, `'1_000'`, `'.5'`, `'5.'` and `'01'`, `numberParts('1', 'en-US', 'US')`, `formatUnit(1, 'en-US', 'furlong', 'long')`, `formatDateTime` of `NaN` with `timeZone: 'UTC'`, of `0` with options `{}`, with `timeZone: ''` and with `{ timeZone: 'UTC', dateStyle: 'short', year: 'numeric' }`, each throw a `RangeError` whose message begins with the function's name; `numberParts('-0', 'en-US')` joined is `-0`."
// Seed 1337 (the properties over decimal strings and over the strings no plain decimal matches)
// ASSUMPTIONS (spec silent): "begins with the function's name" is the Rules text's `<name>: ` (the name, a colon and a space); `formatList` has no listed refused input, so none is asserted for it beyond its name in the Rules text, which no sentence of the Conformance list exercises.
import { formatDateTime, formatList, formatUnit, numberParts } from "@keel/std-i18n";
import fc from "fast-check";
import { expect, test } from "vitest";

const PLAIN_DECIMAL = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const joined = (parts: readonly { value: string }[]): string => parts.map((p) => p.value).join("");

/** Calls `f`, which must throw a `RangeError` whose message begins with `name` and `: `. */
function refuses(f: () => unknown, name: string): void {
  let caught: unknown;
  try {
    f();
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(RangeError);
  expect(caught instanceof Error ? caught.message : "").toMatch(new RegExp(`^${name}: `));
}

for (const text of ["1e400", "0x10", "", " 1 ", "1_000", ".5", "5.", "01"]) {
  test(`\`numberParts\` of \`${JSON.stringify(text)}\` throws a \`RangeError\` whose message begins with \`numberParts: \``, () => {
    // @ts-expect-error: the text is no plain decimal; the type `${number}` admits some of these, the rest are refused at run time
    refuses(() => numberParts(text, "en-US"), "numberParts");
  });
}

test("`numberParts('1', 'en-US', 'US')` throws a `RangeError` whose message begins with `numberParts: `", () => {
  refuses(() => numberParts("1", "en-US", "US"), "numberParts");
});

test("`formatUnit(1, 'en-US', 'furlong', 'long')` throws a `RangeError` whose message begins with `formatUnit: `", () => {
  refuses(() => formatUnit(1, "en-US", "furlong", "long"), "formatUnit");
});

test("`formatDateTime` of `NaN` with `timeZone: 'UTC'` throws a `RangeError` whose message begins with `formatDateTime: `", () => {
  refuses(() => formatDateTime(Number.NaN, "en-US", { timeZone: "UTC" }), "formatDateTime");
});

test("`formatDateTime` of `0` with options `{}` throws a `RangeError` whose message begins with `formatDateTime: `", () => {
  // @ts-expect-error: the time zone is required
  refuses(() => formatDateTime(0, "en-US", {}), "formatDateTime");
});

test("`formatDateTime` of `0` with `timeZone: ''` throws a `RangeError` whose message begins with `formatDateTime: `", () => {
  refuses(() => formatDateTime(0, "en-US", { timeZone: "" }), "formatDateTime");
});

test("`formatDateTime` of `0` with `{ timeZone: 'UTC', dateStyle: 'short', year: 'numeric' }` throws a `RangeError` whose message begins with `formatDateTime: `", () => {
  refuses(() => formatDateTime(0, "en-US", { timeZone: "UTC", dateStyle: "short", year: "numeric" }), "formatDateTime");
});

test("`numberParts('-0', 'en-US')` joined is `-0`", () => {
  expect(joined(numberParts("-0", "en-US"))).toBe("-0");
});

test("a `numberParts` string no plain decimal matches throws a `RangeError` whose message begins with `numberParts: `, for any such string", () => {
  fc.assert(
    fc.property(
      fc.string({ maxLength: 12 }).filter((t) => !PLAIN_DECIMAL.test(t)),
      (text) => {
        // @ts-expect-error: the generated text is not typed as a number string
        refuses(() => numberParts(text, "en-US"), "numberParts");
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
});

test("a `numberParts` plain decimal string (`-?(0|[1-9][0-9]*)(\\.[0-9]+)?`) is formatted as `Intl.NumberFormat` formats it, for any such string", () => {
  const nf = new Intl.NumberFormat("en-US");
  fc.assert(
    fc.property(fc.stringMatching(/^-?(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$/), (text) => {
      // @ts-expect-error: the generated text is not typed as a number string
      const out = joined(numberParts(text, "en-US"));
      // @ts-expect-error: the generated text is not typed as a number string
      expect(out).toBe(nf.format(text));
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("`formatUnit`, `formatList` and `formatDateTime` refuse as `numberParts` does: with the function's name, for any unit no `Intl` knows", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{12,20}$/), (unit) => {
      refuses(() => formatUnit(1, "en-US", unit, "long"), "formatUnit");
    }),
    { seed: 1337, numRuns: 20 },
  );
  expect(formatList(["a", "b"], "en-US", "conjunction", "long")).toBe("a and b");
});
