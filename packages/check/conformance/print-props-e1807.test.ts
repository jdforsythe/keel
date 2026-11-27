// Spec: k.aria, clause "With `brandTokens`, `<Box p={{ base: '3', print: '0' }} direction=\"column\">` puts a rule declaring `padding:var(--k-space-0)` in an `@media print` block after the `@media (min-width: 1024px)` block; a `breakpoint` token `print` is one E1807; `<Box media=\"screen\">` has class `k-media-screen` and `keel.base` holds `@media print{.k-media-screen{display:none!important}}`, and with no `media` written the CSS holds no `k-media-`; `breakInside=\"avoid\"` compiles to `break-inside:avoid`, and `breakInside=\"page\"` is a type error."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// The `check()` half of k.aria Print (k.a11y-static Token names: "each key of a responsive object but `base` and `print`"): `print` is a responsive key beside the breakpoints, so it is no `breakpoint "print"` E1801 while `xl` still is, and the keyword props `breakBefore`, `breakAfter`, `breakInside` and `media` are judged by their types, not as tokens. The `breakpoint` token `print` as E1807 is `keel check`'s (the project's `tokens.ts` evaluated): packages/cli/conformance/print-props-e1807-cli.test.ts. The compiled rules and the type error are packages/ui/conformance/print-props.test.ts and print-props-types.test-d.ts.
// ASSUMPTIONS: as token-names-e1801.test.ts: `check()` over source text, `brandTokens` as the tokens artifact, a diagnostic's `message` as the spec prints it.
import { check } from "@keel/check";
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { SEED, one } from "./support.ts";

const e1801 = (jsx: string): string[] =>
  check(one(`import { Box, Text } from '@keel/ui'\nexport default function C() { return ${jsx} }\n`), {
    artifacts: { tokens: brandTokens },
    types: false,
  })
    .diagnostics.filter((d) => d.code === "E1801")
    .map((d) => d.message);

describe("k.aria: Print, as check reads it", () => {
  test(
    "a responsive style prop takes the key `print` beside `base`: `<Box p={{ base: '3', print: '0' }} direction=\"column\">` is no E1801, and `xl` beside it is one",
    () => {
      expect(e1801(`<Box p={{ base: '3', print: '0' }} direction="column">x</Box>`)).toEqual([]);
      expect(e1801(`<Box p={{ base: '3', print: '0', xl: '2' }}>x</Box>`)).toEqual([
        'breakpoint "xl" is not a breakpoint token',
      ]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "the value of a `print` key is judged as the prop's tokens are: `print: 'nope'` on `p` is `p=\"nope\" is not a space token`",
    () => {
      expect(e1801(`<Box p={{ base: '3', print: 'nope' }}>x</Box>`)).toEqual(['p="nope" is not a space token']);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the style prop, a `print` key is no breakpoint key and `media`, `breakBefore`, `breakAfter` and `breakInside` are no token names",
    () => {
      fc.assert(
        fc.property(fc.constantFrom("p", "px", "m", "gap"), fc.constantFrom("0", "1", "2", "3"), (prop, v) => {
          expect(e1801(`<Box ${prop}={{ base: '2', print: '${v}' }}>x</Box>`)).toEqual([]);
        }),
        { seed: SEED, numRuns: 12 },
      );
      expect(e1801(`<Box media="screen" breakBefore="page" breakAfter="avoid" breakInside="avoid">x</Box>`)).toEqual(
        [],
      );
      expect(e1801(`<Text media="print" fg="text">x</Text>`)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );
});
