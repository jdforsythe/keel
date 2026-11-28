// Spec: k.themes, clause "With color tokens `ink` `#ffffff`, `bg` `#1a191e`, `gray` `#BBBBBB` and `dark` `#000000` and `themes: { paper: { when: 'print', color: { bg: '#ffffff' } } }`, `<Text fg={{ base: 'ink', print: 'gray' }} bg=\"bg\">x</Text>` is one E1804 whose message ends `in print, needs 4.5:1`, and with `print: 'dark'` none; without `paper`, `print: 'gray'` is none."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// ASSUMPTIONS: tokens are written through `looseTokens` (support.ts) and reach `check()` as `artifacts: { tokens }`; a `<Text>` in a component's outermost element is judged against the `bg` it writes, as combinations.test.ts.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { SEED, looseTokens, one, ratioOf } from "./support.ts";

const COLORS = { ink: "#ffffff", bg: "#1a191e", gray: "#BBBBBB", dark: "#000000" };
const PAPER = { paper: { when: "print", color: { bg: "#ffffff" } } };
const e1804 = (print: string, themes?: unknown, color: Record<string, string> = COLORS) =>
  check(
    one(
      `import { Text } from '@keel/ui'\nexport default function C() { return <Text fg={{ base: 'ink', print: '${print}' }} bg="bg">x</Text> }\n`,
    ),
    {
      artifacts: { tokens: looseTokens({ color, ...(themes === undefined ? {} : { themes }) }) },
      types: false,
    },
  ).diagnostics.filter((d) => d.code === "E1804");

describe("k.themes: a responsive `fg`'s `print` key is judged in print", () => {
  test(
    "`<Text fg={{ base: 'ink', print: 'gray' }} bg=\"bg\">x</Text>` with a `paper` print theme is one E1804 whose message ends `in print, needs 4.5:1`",
    () => {
      const d = e1804("gray", PAPER);
      expect(d).toHaveLength(1);
      expect(d[0]?.message.endsWith("in print, needs 4.5:1")).toBe(true);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "and with `print: 'dark'` none",
    () => {
      expect(e1804("dark", PAPER)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "without `paper`, `print: 'gray'` is none",
    () => {
      expect(e1804("gray")).toEqual([]);
      expect(e1804("gray", {})).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the color of the `print` key, with `paper` it is judged against the print theme's `bg` `#ffffff` and without `paper` it is not judged",
    () => {
      const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);
      fc.assert(
        fc.property(hex, (c) => {
          const ratio = Number.parseFloat(ratioOf(c, "#ffffff"));
          fc.pre(Math.abs(ratio - 4.5) > 0.03);
          const color = { ...COLORS, pk: c };
          const withPaper = check(
            one(
              `import { Text } from '@keel/ui'\nexport default function C() { return <Text fg={{ base: 'ink', print: 'pk' }} bg="bg">x</Text> }\n`,
            ),
            { artifacts: { tokens: looseTokens({ color, themes: PAPER }) }, types: false },
          ).diagnostics.filter((d) => d.code === "E1804");
          expect(withPaper.length).toBe(ratio < 4.5 ? 1 : 0);
          const without = check(
            one(
              `import { Text } from '@keel/ui'\nexport default function C() { return <Text fg={{ base: 'ink', print: 'pk' }} bg="bg">x</Text> }\n`,
            ),
            { artifacts: { tokens: looseTokens({ color }) }, types: false },
          ).diagnostics.filter((d) => d.code === "E1804");
          expect(without).toEqual([]);
        }),
        { seed: SEED, numRuns: 25 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
