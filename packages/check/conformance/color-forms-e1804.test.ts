// Spec: k.values, clause "With color tokens `a` `oklch(0.72 0.14 45)` and `b` `#141317`, `<Text fg=\"a\" bg=\"b\">x</Text>` reports no E1804, and with `a` `color(display-p3 0 0 1)` and `b` `#000000` it reports one whose message holds `2.44:1`, the ratio after mapping to sRGB, which is below the 2.59:1 of the color as given."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// Ratios are recomputed in the test from the formulas k.values Contrast states (support.ts `linearOf`, `lumOf`, `ratioOf`), never written as numbers; the clause's own `2.44` and `2.59` are the one stated pair. The reference matrices agree with CSS Color 4's path through XYZ to about 1e-5, so a ratio's two decimals can differ in the last place in the rare case a value sits on a rounding edge: the property compares within 0.01.
// ASSUMPTIONS: tokens reach `check()` as `artifacts: { tokens }` (a11y-contrast-inherited.test.ts, schemes-contrast.test.ts), a `<Text fg bg>` in a component's outermost element is judged (k.a11y-static Values: the chain ends there and `bg` is the token written); the mapped ratio of a color outside sRGB is the clause's 2.44, not recomputed (the OKLCH chroma search is not restated in the test).
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { SEED, insideSrgb, looseTokens, lumOf, one, ratioOf } from "./support.ts";

const text = one(
  `import { Text } from '@keel/ui'\nexport default function C() { return <Text fg="a" bg="b">x</Text> }\n`,
);
const e1804 = (a: string, b: string) =>
  check(text, { artifacts: { tokens: looseTokens({ color: { a, b } }) }, types: false }).diagnostics.filter(
    (d) => d.code === "E1804",
  );
const FORMS = [
  "rgb(184 66 13)",
  "hsl(19deg 87% 39%)",
  "oklab(0.54 0.12 0.1)",
  "oklch(54% 0.16 40)",
  "color(display-p3 0.67 0.29 0.1)",
];
const ratioIn = (message: string | undefined): number =>
  Number.parseFloat(/is (\d+\.\d\d):1/.exec(message ?? "")?.[1] ?? "NaN");

describe("k.values: the contrast of every form is exact", () => {
  test(
    'With color tokens `a` `oklch(0.72 0.14 45)` and `b` `#141317`, `<Text fg="a" bg="b">x</Text>` reports no E1804',
    () => {
      expect(insideSrgb("oklch(0.72 0.14 45)")).toBe(true);
      expect(Number.parseFloat(ratioOf("oklch(0.72 0.14 45)", "#141317"))).toBeGreaterThanOrEqual(4.5);
      expect(e1804("oklch(0.72 0.14 45)", "#141317")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "with `a` `color(display-p3 0 0 1)` and `b` `#000000` it reports one whose message holds `2.44:1`, the ratio after mapping to sRGB, which is below the 2.59:1 of the color as given",
    () => {
      expect(insideSrgb("color(display-p3 0 0 1)")).toBe(false);
      expect(ratioOf("color(display-p3 0 0 1)", "#000000")).toBe("2.59");
      const d = e1804("color(display-p3 0 0 1)", "#000000");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toContain("2.44:1");
      expect(d[0]?.message).toBe('fg "a" on bg "b" is 2.44:1 in light, needs 4.5:1');
    },
    CHECK_CASE_BOUND,
  );

  test(
    "each of the five function forms is judged at the ratio its formula gives, on a white `bg`",
    () => {
      for (const form of FORMS) {
        expect(insideSrgb(form), form).toBe(true);
        const want = Number.parseFloat(ratioOf(form, "#ffffff"));
        const d = e1804(form, "#ffffff");
        if (want >= 4.5) expect(d, form).toEqual([]);
        else expect(Math.abs(ratioIn(d[0]?.message) - want), form).toBeLessThanOrEqual(0.01);
      }
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the color in sRGB, E1804 fires exactly when its formula ratio is below 4.5 and prints that ratio",
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom("rgb", "hsl", "oklab", "oklch", "p3"),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 40 }),
          fc.integer({ min: 0, max: 360 }),
          (kind, l, c, h) => {
            const forms: Record<string, string> = {
              rgb: `rgb(${Math.round(l * 2.55)} ${Math.round(c * 6)} ${Math.round(h * 0.7)})`,
              hsl: `hsl(${h} ${l}% ${Math.round(c * 2.5)}%)`,
              oklab: `oklab(${l / 100} ${(c - 20) / 100} ${(h - 180) / 400})`,
              oklch: `oklch(${l / 100} ${c / 100} ${h})`,
              p3: `color(display-p3 ${l / 100} ${c / 40} ${h / 360})`,
            };
            const form = forms[kind] ?? "";
            fc.pre(insideSrgb(form));
            const want = Number.parseFloat(ratioOf(form, "#ffffff"));
            fc.pre(Math.abs(want - 4.5) > 0.02);
            const d = e1804(form, "#ffffff");
            expect(d.length, `${form} ${want}`).toBe(want < 4.5 ? 1 : 0);
            if (d[0] !== undefined) expect(Math.abs(ratioIn(d[0].message) - want)).toBeLessThanOrEqual(0.01);
          },
        ),
        { seed: SEED, numRuns: 30 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a color outside sRGB is judged at the lower of its own ratio and its mapped one, never above its own",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (r, g, b) => {
            const form = `color(display-p3 ${r / 100} ${g / 100} ${b / 100})`;
            fc.pre(!insideSrgb(form));
            const own = Number.parseFloat(ratioOf(form, "#000000"));
            fc.pre(own < 4.5);
            const d = e1804(form, "#000000");
            expect(d).toHaveLength(1);
            expect(ratioIn(d[0]?.message)).toBeLessThanOrEqual(own + 0.01);
            expect(lumOf(form)).toBeGreaterThanOrEqual(0);
          },
        ),
        { seed: SEED, numRuns: 25 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
