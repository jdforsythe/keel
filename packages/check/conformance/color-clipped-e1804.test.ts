// Spec: k.values, clause "With color tokens `a` `color(display-p3 0 0.54 0.24)` and `b` `#FFFFFF`, `<Text fg=\"a\" bg=\"b\">x</Text>` reports one E1804 whose message holds `4.36:1`, the clipped ratio, below the 4.51:1 mapped and the 4.59:1 as given; `contrast('color(display-p3 0 0.54 0.24)', '#FFFFFF')` from `@keel/ui/css` rounds to 4.36; and the CSS compiled from those tokens declares `--k-color-a` once, as `color(display-p3 0 0.54 0.24)`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// The E1804 half of the clause; its `contrast` and CSS half is packages/ui/conformance/color-clipped.test.ts.
// ASSUMPTIONS: as color-forms-e1804.test.ts (tokens reach `check()` as `artifacts: { tokens }`; a `<Text fg bg>` in a component's outermost element is judged). The lowest of the three forms stands, so the message holds the clipped ratio, which is recomputed here with each linear channel clamped to 0 to 1 (support.ts `linearOf`).
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { SEED, linearOf, looseTokens, one, ratioOf } from "./support.ts";

const text = one(
  `import { Text } from '@keel/ui'\nexport default function C() { return <Text fg="a" bg="b">x</Text> }\n`,
);
const e1804 = (a: string, b: string) =>
  check(text, { artifacts: { tokens: looseTokens({ color: { a, b } }) }, types: false }).diagnostics.filter(
    (d) => d.code === "E1804",
  );
const P3 = "color(display-p3 0 0.54 0.24)";
const clipped = (color: string, backdrop: string): number => {
  const lum = (c: [number, number, number]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const [r, g, b] = linearOf(color).map((c) => Math.min(1, Math.max(0, c)));
  const a = lum([r ?? 0, g ?? 0, b ?? 0]);
  const z = lum(linearOf(backdrop));
  return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05);
};

describe("k.values: the lowest of the three forms stands", () => {
  test(
    'With color tokens `a` `color(display-p3 0 0.54 0.24)` and `b` `#FFFFFF`, `<Text fg="a" bg="b">x</Text>` reports one E1804 whose message holds `4.36:1`, the clipped ratio',
    () => {
      const d = e1804(P3, "#FFFFFF");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toContain("4.36:1");
      expect(clipped(P3, "#FFFFFF").toFixed(2)).toBe("4.36");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "the message holds neither the 4.51:1 mapped nor the 4.59:1 as given, both above 4.36:1",
    () => {
      const d = e1804(P3, "#FFFFFF");
      expect(d).toHaveLength(1);
      const message = d[0]?.message ?? "";
      expect(message).not.toContain("4.51:1");
      expect(message).not.toContain("4.59:1");
      expect(ratioOf(P3, "#FFFFFF")).toBe("4.59");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a color outside sRGB that passes 4.5:1 in all three forms, `color(display-p3 0 0.2 0.1)` on `#FFFFFF`, reports no E1804",
    () => {
      const dark = "color(display-p3 0 0.2 0.1)";
      expect(Number.parseFloat(ratioOf(dark, "#FFFFFF"))).toBeGreaterThanOrEqual(4.5);
      expect(clipped(dark, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(e1804(dark, "#FFFFFF")).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the display-p3 color on `#FFFFFF`, a clipped ratio under 4.5:1 is one E1804, however the other forms stand",
    () => {
      const u = fc.integer({ min: 0, max: 100 });
      fc.assert(
        fc.property(u, u, u, (r, g, b) => {
          const color = `color(display-p3 ${r / 100} ${g / 100} ${b / 100})`;
          fc.pre(clipped(color, "#FFFFFF") < 4.5 - 0.05);
          expect(e1804(color, "#FFFFFF")).toHaveLength(1);
        }),
        { seed: SEED, numRuns: 25 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
