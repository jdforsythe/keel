// k.host, Zone and locale "E1758 (k.check) reports, in app code, by lexical scope and through `globalThis`/`window` and same-file aliases as for E1601:"
// Spec: k.host, clause "Each one E1758: `d.getHours()` and `String(d)` with `d: Date` a parameter, `f().getDay()` with `f(): Date`, `` `${d}` ``, `x.toLocaleUpperCase()`, `x.toLocaleString(undefined)`, `x.toLocaleString(void 0)`, `Intl.Collator([])`, `Number.prototype.toLocaleString.call(n)`, `new Date(2026, 0, 1)`, `new Date('2026-01-01T10:00')`, `Date.parse('Jan 1 2026')`, `new Intl.DateTimeFormat('de-DE', {})`."
// Spec: k.host, clause "None: `d.getUTCHours()`, `d.toISOString()`, `new Date(0)`, `new Date('2026-01-01')`, `new Date('2026-01-01T10:00Z')`, `Date.parse('2026-01-01T10:00+02:00')`, `x.toLocaleString('de-DE')`, `new Intl.DateTimeFormat('de-DE', { ...o })`, `v.getHours()` with `v: any`, a local `getHours(d)` function, a `` tag`${d}` ``, and each reporting case in a test file."
// Seed 1337 (the properties below). The type pass is on unless a test says `types: false`.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

type Options = NonNullable<Parameters<typeof check>[1]>;
const NO_TYPES: Options = { types: false };

const HEAD = "declare function mk(): Date\ndeclare function lib(): string\n";
const PARAMS =
  "n: number, a: string, b: string, x: string, d: Date, o: { at: Date; n: number }, v: any, s: string, opts: Intl.DateTimeFormatOptions, k: string";
const body = (expr: string): string => `${HEAD}export function f(${PARAMS}) {\n  return ${expr}\n}\n`;
const file = (source: string, path = "src/app.ts"): Files => [{ path, source }];
const e1758 = (files: Files, opts: Options = {}): number =>
  check(files, opts).diagnostics.filter((d) => d.code === "E1758").length;
const count = (expr: string, opts: Options = {}, path = "src/app.ts"): number => e1758(file(body(expr), path), opts);

const LOCAL_GETTERS = [
  "getHours",
  "getMinutes",
  "getSeconds",
  "getMilliseconds",
  "getDate",
  "getDay",
  "getMonth",
  "getFullYear",
  "getYear",
  "getTimezoneOffset",
];
const LOCAL_STRINGS = ["toString", "toDateString", "toTimeString"];

describe("k.host Zone and locale: each reporting case is one E1758", () => {
  test("`d.getHours()` with `d: Date` a parameter is one E1758", () => {
    expect(count("d.getHours()")).toBe(1);
  });

  test("`String(d)` with `d: Date` a parameter is one E1758", () => {
    expect(count("String(d)")).toBe(1);
  });

  test("`d.toString()` with `d: Date` a parameter is one E1758", () => {
    expect(count("d.toString()")).toBe(1);
  });

  test("`o.at.getMonth()` with `at: Date` a member is one E1758", () => {
    expect(count("o.at.getMonth()")).toBe(1);
  });

  test("`f().getDay()` with `f(): Date` is one E1758", () => {
    expect(count("mk().getDay()")).toBe(1);
  });

  test("a `Date` imported from a project file is a date: `stamp.getHours()` is one E1758", () => {
    const files: Files = [
      {
        path: "src/clock.ts",
        source: "export const stamp: Date = new Date(0)\nexport const later = (): Date => new Date(1)\n",
      },
      {
        path: "src/app.ts",
        source:
          "import { later, stamp } from './clock.ts'\nexport const a = stamp.getHours()\nexport const b = later().getMinutes()\n",
      },
    ];
    expect(e1758(files)).toBe(2);
  });

  test("a `Date` bound by `const d = new Date(x)` is one E1758 per use, with the type pass on", () => {
    expect(e1758(file("export function f(s: string) {\n  const d = new Date(s)\n  return d.getHours()\n}\n"))).toBe(1);
  });

  test("a date in an untagged template, `` `${d}` ``, is one E1758", () => {
    expect(count("`${d}`")).toBe(1);
    expect(count("`at ${d} sharp`")).toBe(1);
  });

  test("`x.toLocaleUpperCase()` and `x.toLocaleLowerCase()` are each one E1758", () => {
    expect(count("x.toLocaleUpperCase()")).toBe(1);
    expect(count("x.toLocaleLowerCase()")).toBe(1);
    expect(count("x.toLocaleUpperCase('de-DE')")).toBe(0);
    expect(count("x.toLocaleLowerCase('tr')")).toBe(0);
  });

  test("`x.toLocaleString(undefined)` is one E1758", () => {
    expect(count("x.toLocaleString(undefined)")).toBe(1);
  });

  test("`x.toLocaleString(void 0)` is one E1758", () => {
    expect(count("x.toLocaleString(void 0)")).toBe(1);
  });

  test("`x.toLocaleString([])` is one E1758: `[]` is no locale", () => {
    expect(count("n.toLocaleString([])")).toBe(1);
  });

  test("`Intl.Collator([])` is one E1758", () => {
    expect(count("Intl.Collator([])")).toBe(1);
  });

  test("`Number.prototype.toLocaleString.call(n)` is one E1758", () => {
    expect(count("Number.prototype.toLocaleString.call(n)")).toBe(1);
    expect(count("Number.prototype.toLocaleString.call(n, 'de-DE')")).toBe(0);
  });

  test("`String.prototype.localeCompare.call(a, b)` is one E1758", () => {
    expect(count("String.prototype.localeCompare.call(a, b)")).toBe(1);
    expect(count("String.prototype.localeCompare.call(a, b, 'de-DE')")).toBe(0);
  });

  test("`new Date(2026, 0, 1)` is one E1758", () => {
    expect(count("new Date(2026, 0, 1)")).toBe(1);
    expect(count("new Date(2026, 0)")).toBe(1);
  });

  test("`new Date('2026-01-01T10:00')` is one E1758", () => {
    expect(count("new Date('2026-01-01T10:00')")).toBe(1);
    expect(count("new Date('2026-01-01 10:00')")).toBe(1);
  });

  test("`Date.parse('Jan 1 2026')` is one E1758", () => {
    expect(count("Date.parse('Jan 1 2026')")).toBe(1);
    expect(count("Date.parse('2026-01-01T10:00')")).toBe(1);
  });

  test("`new Intl.DateTimeFormat('de-DE', {})` is one E1758", () => {
    expect(count("new Intl.DateTimeFormat('de-DE', {})")).toBe(1);
    expect(count("new Intl.DateTimeFormat('de-DE')")).toBe(1);
  });

  test("`d.toLocaleTimeString('de-DE')` is one E1758: no `timeZone`", () => {
    expect(count("d.toLocaleTimeString('de-DE')")).toBe(1);
    expect(count("d.toLocaleDateString('de-DE', { dateStyle: 'short' })")).toBe(1);
  });

  test("`x.toLocaleString(undefined)`, `(void 0)` and `([])` are each one E1758 on a number and a date", () => {
    for (const recv of ["n", "d", "x"]) {
      for (const arg of ["undefined", "void 0", "[]"]) expect(count(`${recv}.toLocaleString(${arg})`)).toBe(1);
    }
  });

  test("every `Intl` constructor of the list without a locale is one E1758, with a locale none (`DateTimeFormat` wants `timeZone` too)", () => {
    const ctors = [
      "NumberFormat",
      "PluralRules",
      "Collator",
      "ListFormat",
      "RelativeTimeFormat",
      "DisplayNames",
      "Segmenter",
    ];
    fc.assert(
      fc.property(fc.constantFrom(...ctors), fc.constantFrom("", "undefined", "void 0", "[]"), (c, arg) => {
        const rest = c === "DisplayNames" ? ", { type: 'region' }" : "";
        const first = arg === "" && rest !== "" ? "undefined" : arg;
        expect(count(`new Intl.${c}(${first}${rest})`)).toBe(1);
        expect(count(`new Intl.${c}('de-DE'${rest})`)).toBe(0);
      }),
      { seed: SEED, numRuns: 40 },
    );
    expect(count("new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC' })")).toBe(0);
    expect(count("new Intl.DateTimeFormat(undefined, { timeZone: 'UTC' })")).toBe(1);
  });

  test("a local-time getter or string conversion on a `Date` typed value is one E1758, whatever the getter", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LOCAL_GETTERS, ...LOCAL_STRINGS),
        fc.constantFrom("d", "o.at", "mk()"),
        (m, recv) => {
          expect(count(`${recv}.${m}()`)).toBe(1);
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("a date's `getUTC*` getters, `toISOString`, `toUTCString` and `toJSON` are none", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "getUTCHours",
          "getUTCMinutes",
          "getUTCSeconds",
          "getUTCMilliseconds",
          "getUTCDate",
          "getUTCDay",
          "getUTCMonth",
          "getUTCFullYear",
          "toISOString",
          "toUTCString",
          "toJSON",
          "getTime",
          "valueOf",
        ),
        fc.constantFrom("d", "o.at", "mk()"),
        (m, recv) => {
          expect(count(`${recv}.${m}()`)).toBe(0);
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("`navigator.language`, `navigator.languages` and the same through `globalThis` are each one E1758", () => {
    expect(count("navigator.language")).toBe(1);
    expect(count("navigator.languages")).toBe(1);
    expect(count("globalThis.navigator.language")).toBe(1);
    expect(count("new globalThis.Intl.NumberFormat()")).toBe(1);
  });

  test("a local named `navigator` or `Intl` is not the host's: names resolve by lexical scope", () => {
    expect(e1758(file("export function f(navigator: { language: string }) {\n  return navigator.language\n}\n"))).toBe(
      0,
    );
    expect(
      e1758(
        file("export function f(Intl: { NumberFormat: new () => object }) {\n  return new Intl.NumberFormat()\n}\n"),
      ),
    ).toBe(0);
    expect(e1758(file("const navigator = { language: 'en' }\nexport const l = navigator.language\n"))).toBe(0);
  });
});

describe("k.host Zone and locale: the shapes it leaves", () => {
  test("`d.getUTCHours()` is none", () => {
    expect(count("d.getUTCHours()")).toBe(0);
  });

  test("`d.toISOString()` is none", () => {
    expect(count("d.toISOString()")).toBe(0);
  });

  test("`d.toUTCString()` and `Date.UTC(2026, 0, 1)` are none", () => {
    expect(count("d.toUTCString()")).toBe(0);
    expect(count("Date.UTC(2026, 0, 1)")).toBe(0);
  });

  test("`new Date(0)` is none", () => {
    expect(count("new Date(0)")).toBe(0);
    expect(count("new Date(n)")).toBe(0);
    expect(count("new Date(d)")).toBe(0);
  });

  test("`new Date('2026-01-01')` is none: a date-only ISO date is UTC", () => {
    expect(count("new Date('2026-01-01')")).toBe(0);
    expect(count("Date.parse('2026-01-01')")).toBe(0);
  });

  test("`new Date('2026-01-01T10:00Z')` is none", () => {
    expect(count("new Date('2026-01-01T10:00Z')")).toBe(0);
    expect(count("new Date('2026-01-01T10:00:00.000Z')")).toBe(0);
  });

  test("`Date.parse('2026-01-01T10:00+02:00')` is none", () => {
    expect(count("Date.parse('2026-01-01T10:00+02:00')")).toBe(0);
    expect(count("new Date('2026-01-01T10:00:00-05:00')")).toBe(0);
  });

  test("a constant string ending in `GMT` or `UTC` is none", () => {
    expect(count("new Date('Thu, 01 Jan 2026 10:00:00 GMT')")).toBe(0);
    expect(count("new Date('Jan 1 2026 10:00 UTC')")).toBe(0);
    expect(count("Date.parse('Jan 1 2026 10:00 GMT')")).toBe(0);
  });

  test("`new Date(s)` and `Date.parse(s)` of a string that is not constant are none", () => {
    expect(count("new Date(s)")).toBe(0);
    expect(count("Date.parse(s)")).toBe(0);
    expect(count("new Date(`2026-01-01T${s}`)")).toBe(0);
    expect(count("new Date('2026-01-01T' + s)")).toBe(0);
  });

  test("`x.toLocaleString('de-DE')` is none", () => {
    expect(count("x.toLocaleString('de-DE')")).toBe(0);
    expect(count("n.toLocaleString('de-DE', { style: 'percent' })")).toBe(0);
    expect(count("n.toLocaleString(lib())")).toBe(0);
  });

  test("`new Intl.DateTimeFormat('de-DE', { ...o })` is none: a spread counts as giving `timeZone`", () => {
    expect(count("new Intl.DateTimeFormat('de-DE', { ...o })")).toBe(0);
  });

  test("an options argument that is not an object literal, or has a computed key, counts as giving `timeZone`", () => {
    expect(count("new Intl.DateTimeFormat('de-DE', opts)")).toBe(0);
    expect(count("new Intl.DateTimeFormat('de-DE', { [k]: 'UTC' })")).toBe(0);
    expect(count("d.toLocaleDateString('de-DE', opts)")).toBe(0);
    expect(count("d.toLocaleTimeString('de-DE', { ...opts })")).toBe(0);
  });

  test("`v.getHours()` with `v: any` is none", () => {
    expect(count("v.getHours()")).toBe(0);
    expect(count("v.toString()")).toBe(0);
    expect(count("String(v)")).toBe(0);
    expect(count("`${v}`")).toBe(0);
  });

  test("a value of unknown type is not a date: its getter call is none", () => {
    const src = "export function f(u: unknown) {\n  return u.getHours()\n}\n";
    expect(e1758(file(src))).toBe(0);
  });

  test("`toString` and `String(...)` of a number, a string and an object are none", () => {
    for (const e of [
      "n.toString()",
      "x.toString()",
      "o.toString()",
      "String(n)",
      "String(x)",
      "`${n}`",
      "`${x}`",
      "o.n.toString()",
    ]) {
      expect(count(e)).toBe(0);
    }
  });

  test("a method named like a getter on a value that is not a `Date` is none", () => {
    const src =
      "class Clock { getHours() { return 1 } getDate() { return 2 } toString() { return 'c' } }\nexport function f(c: Clock) {\n  return [c.getHours(), c.getDate(), c.toString(), String(c), `${c}`]\n}\n";
    expect(e1758(file(src))).toBe(0);
  });

  test("a local `function getHours(d)` called as `getHours(d)` is none", () => {
    const src =
      "function getHours(t: Date) { return t.getUTCHours() }\nexport function f(d: Date) {\n  return getHours(d)\n}\n";
    expect(e1758(file(src))).toBe(0);
  });

  test("a tagged template, `` tag`${d}` ``, is none", () => {
    const src =
      "declare function tag(s: TemplateStringsArray, ...v: unknown[]): string\nexport function f(d: Date) {\n  return tag`${d}`\n}\n";
    expect(e1758(file(src))).toBe(0);
  });

  test("`d.getHours.apply(d)` and `d.getHours.bind(d)` are none", () => {
    expect(count("d.getHours.apply(d)")).toBe(0);
    expect(count("d.getHours.bind(d)")).toBe(0);
  });

  test("`Date.now()` and `Date()` are E1601, not E1758", () => {
    expect(count("Date.now()")).toBe(0);
    expect(count("Date()")).toBe(0);
  });

  test("the locale shapes with a locale given as a constant or a parameter are none", () => {
    for (const e of [
      "a.localeCompare(b, 'de-DE')",
      "a.localeCompare(b, k)",
      "new Intl.NumberFormat('de-DE').format(n)",
      "new Intl.PluralRules(k).select(n)",
      "d.toLocaleDateString('de-DE', { timeZone: 'UTC' })",
      "d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })",
    ]) {
      expect(count(e)).toBe(0);
    }
  });
});

describe("k.host Zone and locale: each reporting case in a test file is none", () => {
  const REPORTING = [
    "d.getHours()",
    "String(d)",
    "mk().getDay()",
    "`${d}`",
    "x.toLocaleUpperCase()",
    "x.toLocaleString(undefined)",
    "x.toLocaleString(void 0)",
    "Intl.Collator([])",
    "Number.prototype.toLocaleString.call(n)",
    "new Date(2026, 0, 1)",
    "new Date('2026-01-01T10:00')",
    "Date.parse('Jan 1 2026')",
    "new Intl.DateTimeFormat('de-DE', {})",
    "navigator.language",
  ];
  for (const e of REPORTING) {
    test(`\`${e}\` in \`src/app.test.ts\` and in \`src/app.test.tsx\` is none, and is one in \`src/app.ts\``, () => {
      expect(count(e, {}, "src/app.ts")).toBeGreaterThanOrEqual(1);
      expect(count(e, {}, "src/app.test.ts")).toBe(0);
      expect(count(e, {}, "src/app.test.tsx")).toBe(0);
    });
  }
});

describe("k.host Zone and locale: a date with the type pass off (`check(files, { types: false })`)", () => {
  test("`d.getHours()` with `d` a parameter is none", () => {
    expect(count("d.getHours()", NO_TYPES)).toBe(0);
    expect(count("d.toString()", NO_TYPES)).toBe(0);
    expect(count("String(d)", NO_TYPES)).toBe(0);
  });

  test("`const d = new Date(x)` then `d.getHours()` is one E1758", () => {
    const src = "export function f(s: string) {\n  const d = new Date(s)\n  return d.getHours()\n}\n";
    expect(e1758(file(src), NO_TYPES)).toBe(1);
  });

  test("a `new Date(...)` expression's getter is one E1758", () => {
    expect(count("new Date(0).getHours()", NO_TYPES)).toBe(1);
    expect(count("new Date(n).toString()", NO_TYPES)).toBe(1);
    expect(count("String(new Date(n))", NO_TYPES)).toBe(1);
    expect(count("`${new Date(n)}`", NO_TYPES)).toBe(1);
  });

  test("the locale and constructor shapes are the same with the type pass off", () => {
    expect(count("x.toLocaleUpperCase()", NO_TYPES)).toBe(1);
    expect(count("n.toLocaleString(undefined)", NO_TYPES)).toBe(1);
    expect(count("Intl.Collator([])", NO_TYPES)).toBe(1);
    expect(count("new Date(2026, 0, 1)", NO_TYPES)).toBe(1);
    expect(count("Date.parse('Jan 1 2026')", NO_TYPES)).toBe(1);
    expect(count("x.toLocaleString('de-DE')", NO_TYPES)).toBe(0);
  });
});

describe("k.host: a reported location carries no fix and is reported once", () => {
  test("`d.getHours()` is one E1758 with no `fix`, with the type pass on and off alike", () => {
    for (const opts of [{}, NO_TYPES]) {
      const src = "export function f(s: string) {\n  const d = new Date(s)\n  return d.getHours()\n}\n";
      const found = check(file(src), opts).diagnostics.filter((d) => d.code === "E1758");
      expect(found.length).toBe(1);
      expect(found[0]?.fix).toBeUndefined();
      expect(found[0]?.line).toBe(3);
    }
  });
});
