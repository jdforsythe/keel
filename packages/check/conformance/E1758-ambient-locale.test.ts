// Spec: k.check Rules, "E1758 ambient locale or time zone in app code: `navigator.language` or `languages`; an `Intl` constructor, `toLocale*String` or `localeCompare` without a locale; an `Intl.DateTimeFormat` or a date's `toLocale*String` without `timeZone`; a local-time getter (`getHours`, ...) on a `new Date(...)` expression. Names resolve as for E1601; no fix." (rfc:0079)
// Spec: k.check Conformance, "`n.toLocaleString()`, `new Intl.DateTimeFormat('de-DE').format(d)`, `navigator.language` and `new Date(0).getHours()` are each one E1758; `a.localeCompare(b, 'de-DE')` and `new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC' })` none."
// Seed 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, one } from "./support.ts";

const body = (expr: string): string =>
  `export function f(n: number, a: string, b: string, d: Date) {\n  return ${expr}\n}\n`;
const e1758 = (src: string): number =>
  check(one(src, "src/app.ts"), { types: false }).diagnostics.filter((d) => d.code === "E1758").length;
const codes = (src: string): string[] => check(one(src, "src/app.ts"), { types: false }).diagnostics.map((d) => d.code);

test("E1758: `n.toLocaleString()`, `new Intl.DateTimeFormat('de-DE').format(d)`, `navigator.language` and `new Date(0).getHours()` are each one E1758", () => {
  for (const expr of [
    "n.toLocaleString()",
    "new Intl.DateTimeFormat('de-DE').format(d)",
    "navigator.language",
    "new Date(0).getHours()",
  ]) {
    expect(e1758(body(expr))).toBe(1);
  }
});

test("E1758: `a.localeCompare(b, 'de-DE')` and `new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC' })` none", () => {
  expect(e1758(body("a.localeCompare(b, 'de-DE')"))).toBe(0);
  expect(e1758(body("new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC' })"))).toBe(0);
});

test("E1758: `navigator.language` or `languages` is reported", () => {
  expect(e1758(body("navigator.languages"))).toBe(1);
  expect(e1758(body("navigator['languages']"))).toBe(1);
  expect(e1758(body("navigator.language"))).toBe(1);
});

test("E1758: an `Intl` constructor without a locale is reported", () => {
  for (const ctor of [
    "NumberFormat",
    "DateTimeFormat",
    "PluralRules",
    "Collator",
    "ListFormat",
    "RelativeTimeFormat",
  ]) {
    expect(e1758(body(`new Intl.${ctor}()`))).toBe(1);
  }
  expect(e1758(body("new Intl.NumberFormat('de-DE')"))).toBe(0);
});

test("E1758: `toLocale*String` or `localeCompare` without a locale is reported, with a locale it is not", () => {
  fc.assert(
    fc.property(fc.constantFrom("toLocaleString", "toLocaleDateString", "toLocaleTimeString"), (m) => {
      expect(e1758(body(`d.${m}()`))).toBeGreaterThanOrEqual(1);
    }),
    { seed: SEED, numRuns: 10 },
  );
  expect(e1758(body("a.localeCompare(b)"))).toBe(1);
  expect(e1758(body("n.toLocaleString('de-DE')"))).toBe(0);
});

test("E1758: an `Intl.DateTimeFormat` or a date's `toLocale*String` with a locale but without `timeZone` is reported", () => {
  expect(e1758(body("new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' }).format(d)"))).toBe(1);
  expect(e1758(body("d.toLocaleDateString('de-DE')"))).toBe(1);
  expect(e1758(body("d.toLocaleDateString('de-DE', { timeZone: 'UTC' })"))).toBe(0);
});

test("E1758: a local-time getter on a `new Date(...)` expression is reported", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("getHours", "getMinutes", "getDate", "getDay", "getMonth", "getFullYear"),
      fc.integer({ min: 0, max: 1_000_000 }),
      (m, ms) => {
        expect(e1758(body(`new Date(${ms}).${m}()`))).toBe(1);
        expect(e1758(body(`new Date(${ms}).${m.replace("get", "getUTC")}()`))).toBe(0);
      },
    ),
    { seed: SEED, numRuns: 30 },
  );
});

test("E1758: names resolve as for E1601 (a same-file alias and a literal computed key are reported)", () => {
  expect(e1758(`const nav = navigator\nexport const x = nav.language\n`)).toBe(1);
  expect(e1758(`const I = Intl\nexport const x = new I.NumberFormat()\n`)).toBe(1);
  expect(e1758(`export const x = navigator['language']\n`)).toBe(1);
  expect(e1758(`const navigator = { language: 'de-DE' }\nexport const x = navigator.language\n`)).toBe(0);
});

test("E1758: carries no fix", () => {
  const ds = check(one(body("n.toLocaleString()"), "src/app.ts"), { types: false }).diagnostics.filter(
    (d) => d.code === "E1758",
  );
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
});

test("E1758: a source with no ambient locale or time zone read reports none", () => {
  expect(codes(body("a.localeCompare(b, 'de-DE') + n.toFixed(2) + new Date(0).getUTCHours()"))).not.toContain("E1758");
});
