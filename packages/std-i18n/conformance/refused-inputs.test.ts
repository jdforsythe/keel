// Spec: std.i18n, clause "`numberParts` of `'1e400'`, `'0x10'`, `''`, `' 1 '`, `'1_000'`, `'.5'`, `'5.'` and `'01'`, `numberParts('1', 'en-US', 'US')`, `formatUnit(1, 'en-US', 'furlong', 'long')`, `formatDateTime` of `NaN` with `timeZone: 'UTC'`, of `0` with options `{}`, with `timeZone: ''` and with `{ timeZone: 'UTC', dateStyle: 'short', year: 'numeric' }`, each raise a defect whose message begins with the function's name; `numberParts('-0', 'en-US')` joined is `-0`."
// Also the Rules paragraph of std.i18n beginning "`numberParts`, `formatUnit` and `formatDateTime` raise a defect (k.defects) whose message begins with the function's name and `: `" (not a Conformance bullet, so no clause). A defect is asserted as k.defects Tests says: `isDefect(caught)` (`@keel/schema`) and its `message`, never its `name`.
// Seed 1337 (the properties over decimal strings and over the strings no plain decimal matches)
// ASSUMPTIONS (spec silent): "begins with the function's name and `: `" is read literally: the name, a colon and a space. The refused numberParts strings and the option object without a time zone reach the function through type guards (a string is `${number}` for the type, an object has a `timeZone` for the type) whose run-time check is only `typeof`, so no cast or suppression is needed.
import { isDefect } from "@keel/schema";
import { formatDateTime, formatUnit, numberParts } from "@keel/std-i18n";
import fc from "fast-check";
import { expect, test } from "vitest";

type Zoned = Parameters<typeof formatDateTime>[2];
/** Type guard standing for text the type calls a number string; the run-time test is `typeof` only. */
const asNumberText = (v: unknown): v is `${number}` => typeof v === "string";
/** Type guard standing for options the type calls zoned; the run-time test is `typeof` only. */
const asZoned = (v: unknown): v is Zoned => typeof v === "object" && v !== null;
/** Text built at run time, typed as the guard needs it. */
function numberText(text: string): `${number}` {
  const v: unknown = JSON.parse(JSON.stringify(text));
  if (!asNumberText(v)) throw new Error("not text");
  return v;
}

const PLAIN_DECIMAL = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const joined = (parts: readonly { value: string }[]): string => parts.map((p) => p.value).join("");

/** Calls `f`, which must raise a defect (k.defects) whose message begins with `name` and `: `. */
function refuses(f: () => unknown, name: string): void {
  let caught: unknown;
  try {
    f();
  } catch (e) {
    caught = e;
  }
  expect(isDefect(caught)).toBe(true);
  expect(caught instanceof Error ? caught.message : "").toMatch(new RegExp(`^${name}: `));
}

for (const text of ["1e400", "0x10", "", " 1 ", "1_000", ".5", "5.", "01"]) {
  test(`\`numberParts\` of \`${JSON.stringify(text)}\` raises a defect whose message begins with \`numberParts: \``, () => {
    refuses(() => numberParts(numberText(text), "en-US"), "numberParts");
  });
}

test("`numberParts('1', 'en-US', 'US')` raises a defect whose message begins with `numberParts: `", () => {
  refuses(() => numberParts("1", "en-US", "US"), "numberParts");
});

test("`formatUnit(1, 'en-US', 'furlong', 'long')` raises a defect whose message begins with `formatUnit: `", () => {
  refuses(() => formatUnit(1, "en-US", "furlong", "long"), "formatUnit");
});

test("`formatDateTime` of `NaN` with `timeZone: 'UTC'` raises a defect whose message begins with `formatDateTime: `", () => {
  refuses(() => formatDateTime(Number.NaN, "en-US", { timeZone: "UTC" }), "formatDateTime");
});

test("`formatDateTime` of `0` with options `{}` raises a defect whose message begins with `formatDateTime: `", () => {
  const opts: unknown = JSON.parse("{}");
  if (!asZoned(opts)) throw new Error("not an object");
  refuses(() => formatDateTime(0, "en-US", opts), "formatDateTime");
});

test("`formatDateTime` of `0` with `timeZone: ''` raises a defect whose message begins with `formatDateTime: `", () => {
  refuses(() => formatDateTime(0, "en-US", { timeZone: "" }), "formatDateTime");
});

test("`formatDateTime` of `0` with `{ timeZone: 'UTC', dateStyle: 'short', year: 'numeric' }` raises a defect whose message begins with `formatDateTime: `", () => {
  refuses(() => formatDateTime(0, "en-US", { timeZone: "UTC", dateStyle: "short", year: "numeric" }), "formatDateTime");
});

test("`numberParts('-0', 'en-US')` joined is `-0`", () => {
  expect(joined(numberParts("-0", "en-US"))).toBe("-0");
});

test("a `numberParts` string no plain decimal matches raises a defect whose message begins with `numberParts: `, for any such string", () => {
  fc.assert(
    fc.property(
      fc.string({ maxLength: 12 }).filter((t) => !PLAIN_DECIMAL.test(t)),
      (text) => {
        refuses(() => numberParts(numberText(text), "en-US"), "numberParts");
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
});

test("a `numberParts` plain decimal string (`-?(0|[1-9][0-9]*)(\\.[0-9]+)?`) is formatted as `Intl.NumberFormat` formats it, for any such string", () => {
  const nf = new Intl.NumberFormat("en-US");
  fc.assert(
    fc.property(fc.stringMatching(/^-?(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$/), (text) => {
      const out = joined(numberParts(numberText(text), "en-US"));
      const expected: string = Reflect.apply(nf.format, nf, [text]);
      expect(out).toBe(expected);
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("`formatUnit` refuses as `numberParts` does: with the function's name, for any unit no `Intl` knows", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{12,20}$/), (unit) => {
      refuses(() => formatUnit(1, "en-US", unit, "long"), "formatUnit");
    }),
    { seed: 1337, numRuns: 20 },
  );
});
