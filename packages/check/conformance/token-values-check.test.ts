// Spec: k.values, clause "With `space: { a: 'auto' }`, `<Box p=\"a\" />` is one E1801 at the literal and `<Box mx=\"a\" />` is none."
// Spec: k.values, clause "With `fontSize: { big: 'clamp(24px, 3vw, 40px)' }` and color tokens `low` `#787878` and `bg` `#ffffff`, `<Box bg=\"bg\" fontSize=\"big\"><Text fg=\"low\">x</Text></Box>` reports no E1804, and with `fontSize: { big: 'min(24px, 3vw)' }` it reports one."
// Spec: k.values, clause "**What check judges.** Contrast (k.a11y) takes a `fontSize` at its smallest: a `<length>` in `px`, `pt`, `rem` or `em` (16px to the `rem` and `em`) as written, a `clamp()` at its first argument when that is such a length, and any other value as normal text. Contrast and `base.focus` judge `<color>` and `<ref>` values; a `currentColor` border or shadow is not judged."
// Spec: k.values, clause "**Characters.** Outside a quoted string a value holds only the ASCII characters its form names: letters, digits, `_`, `.`, `%`, `#`, `-`, `+`, `*`, `/`, `,`, `(`, `)` and single spaces between tokens, with none leading or trailing. A quoted string (`font` only) opens and closes with the same `\"` or `'` and holds any code point but that quote, a backslash, a control character (U+0000 to U+001F, U+007F to U+009F) and a lone surrogate. So no value holds an escape, a newline, a form feed, a null or a comment opener."
// Seed: 1337 (fc.assert below).
// The library `check()` over source text with `artifacts: { tokens }`, as token-names-e1801.test.ts does. A diagnostic's `line` and `col` are 1-based and the E1801 for a literal is at its opening quote (k.a11y-static Token names).
// Not asserted: the E1801 message for an `auto` space token (the spec gives none beyond "E1801 at the use").
import { check } from "@keel/check";
import { defineTokens } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { SEED, one } from "./support.ts";

const HEAD = "import { Box, Text } from '@keel/ui'\n";
const page = (jsx: string): string => `${HEAD}export default function C() { return ${jsx} }\n`;
type Opts = Parameters<typeof check>[1];
const codes = (source: string, opts: Opts, code: string) =>
  check(one(source), opts).diagnostics.filter((d) => d.code === code);
const where = (source: string, needle: string): { line: number; col: number } => {
  const i = source.indexOf(needle);
  expect(i, needle).toBeGreaterThanOrEqual(0);
  const before = source.slice(0, i);
  return { line: before.split("\n").length, col: i - before.lastIndexOf("\n") };
};

describe("k.values: a `space` token holding `auto`", () => {
  const tokens = defineTokens({ space: { a: "auto", b: "8px" } });
  const opts: Opts = { types: false, artifacts: { tokens } };

  test(
    '`<Box p="a" />` is one E1801 at the literal and `<Box mx="a" />` is none, with `space: { a: \'auto\' }`',
    () => {
      const src = page('<Box p="a" />');
      const d = codes(src, opts, "E1801");
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({ code: "E1801", path: "C.tsx", ...where(src, '"a"') });
      expect(d[0]?.fix).toBeUndefined();
      expect(codes(page('<Box mx="a" />'), opts, "E1801")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "an `auto` space token is E1801 on each of `p`, `px`, `py` and `gap`, and none on `m`, `mx`, `my`, `w` and `h`; a numeric space token is none on all of them",
    () => {
      for (const prop of ["p", "px", "py", "gap"]) {
        const jsx = `<Box ${prop}="a"${prop === "gap" ? ' direction="column"' : ""} />`;
        const d = codes(page(jsx), opts, "E1801");
        expect(d, prop).toHaveLength(1);
        expect(codes(page(jsx.replace('"a"', '"b"')), opts, "E1801"), `${prop} b`).toEqual([]);
      }
      for (const prop of ["m", "mx", "my", "w", "h"]) {
        expect(codes(page(`<Box ${prop}="a" />`), opts, "E1801"), prop).toEqual([]);
      }
    },
    CHECK_CASE_BOUND,
  );

  test(
    "an `auto` space token in a responsive object or under `states` on `p` is E1801 at the literal, and on `mx` none",
    () => {
      const bad = page("<Box p={{ base: 'b', md: 'a' }} />");
      const wide: Opts = {
        types: false,
        artifacts: { tokens: defineTokens({ space: { a: "auto", b: "8px" }, breakpoint: { md: "48em" } }) },
      };
      const d = codes(bad, wide, "E1801");
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject(where(bad, "'a'"));
      expect(codes(page("<Box mx={{ base: 'b', md: 'a' }} />"), wide, "E1801")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.values: What check judges, contrast reads a `clamp()` font size at its first argument", () => {
  const withSize = (big: string): Opts => ({
    types: false,
    artifacts: {
      tokens: defineTokens({ color: { low: "#787878", bg: "#ffffff" }, fontSize: { big } }),
    },
  });
  const JSX = '<Box bg="bg" fontSize="big"><Text fg="low">x</Text></Box>';

  test(
    "with `fontSize: { big: 'clamp(24px, 3vw, 40px)' }` and color tokens `low` `#787878` and `bg` `#ffffff`, the box reports no E1804, and with `min(24px, 3vw)` it reports one",
    () => {
      expect(codes(page(JSX), withSize("clamp(24px, 3vw, 40px)"), "E1804")).toEqual([]);
      expect(codes(page(JSX), withSize("min(24px, 3vw)"), "E1804")).toHaveLength(1);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a `clamp()` whose first argument is a length in `px`, `pt`, `rem` or `em` is judged at that size (24px or more is large text, under it normal), whatever the other arguments",
    () => {
      const sizes: [string, boolean][] = [
        ["24px", true],
        ["18pt", true],
        ["1.5rem", true],
        ["1.5em", true],
        ["30px", true],
        ["23px", false],
        ["17pt", false],
        ["1rem", false],
        ["1.4em", false],
      ];
      fc.assert(
        fc.property(
          fc.constantFrom(...sizes),
          fc.constantFrom("3vw, 40px", "2vw + 4px, 5rem", "5vw, 60px"),
          ([first, large], rest) => {
            const n = codes(page(JSX), withSize(`clamp(${first}, ${rest})`), "E1804").length;
            expect(n, `clamp(${first}, ${rest})`).toBe(large ? 0 : 1);
          },
        ),
        { seed: SEED, numRuns: 12 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a `clamp()` whose first argument is no such length (`vw`, `%`, a `calc`) and any other value are judged as normal text",
    () => {
      for (const v of [
        "clamp(3vw, 4vw, 40px)",
        "clamp(50%, 3vw, 40px)",
        "clamp(calc(30px + 1px), 3vw, 40px)",
        "max(24px, 3vw)",
        "100%",
      ]) {
        expect(codes(page(JSX), withSize(v), "E1804"), v).toHaveLength(1);
      }
    },
    CHECK_CASE_BOUND,
  );
});
