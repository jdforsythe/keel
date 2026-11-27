// Spec: k.values, clause "With color tokens `a` `color(display-p3 0 0.54 0.24)` and `b` `#FFFFFF`, `<Text fg=\"a\" bg=\"b\">x</Text>` reports one E1804 whose message holds `4.36:1`, the clipped ratio, below the 4.51:1 mapped and the 4.59:1 as given; `contrast('color(display-p3 0 0.54 0.24)', '#FFFFFF')` from `@keel/ui/css` rounds to 4.36; and the CSS compiled from those tokens declares `--k-color-a` once, as `color(display-p3 0 0.54 0.24)`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// The `contrast` and CSS half of the clause; its E1804 half is packages/check/conformance/color-clipped-e1804.test.ts.
// The as-given and the clipped ratios are recomputed here from the formulas k.values Contrast states (fixtures.ts `colorLinear`), the clipped one with each linear channel clamped to 0 to 1; the mapped 4.51 needs CSS Color 4's chroma search and is asserted only as the bound the lowest ratio stands under.
import { contrast } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { compileWith } from "./base-support.ts";
import { SEED, colorLinear, colorRatio, norm } from "./fixtures.ts";

const P3 = "color(display-p3 0 0.54 0.24)";
const WHITE = "#FFFFFF";
const clippedRatio = (color: string, backdrop: string): number => {
  const [r, g, b] = colorLinear(color).map((c) => Math.min(1, Math.max(0, c)));
  const lum = 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  const [br, bg, bb] = colorLinear(backdrop);
  const back = 0.2126 * (br ?? 0) + 0.7152 * (bg ?? 0) + 0.0722 * (bb ?? 0);
  return (Math.max(lum, back) + 0.05) / (Math.min(lum, back) + 0.05);
};
const round2 = (x: number): number => Math.round(x * 100) / 100;

describe("k.values: a color outside sRGB is judged at its lowest ratio", () => {
  test("the three forms of `color(display-p3 0 0.54 0.24)` on `#FFFFFF` are 4.59:1 as given and 4.36:1 clipped", () => {
    expect(round2(colorRatio(P3, WHITE))).toBe(4.59);
    expect(round2(clippedRatio(P3, WHITE))).toBe(4.36);
  });

  test("`contrast('color(display-p3 0 0.54 0.24)', '#FFFFFF')` from `@keel/ui/css` rounds to 4.36", () => {
    expect(round2(contrast(P3, WHITE))).toBe(4.36);
  });

  test("the lowest ratio stands: `contrast` is below the 4.51:1 mapped and the 4.59:1 as given, so the pair fails 4.5:1", () => {
    const c = contrast(P3, WHITE);
    expect(c).toBeLessThan(4.5);
    expect(c).toBeLessThan(4.51);
    expect(c).toBeLessThan(colorRatio(P3, WHITE));
  });

  test("a pair that passes in all three forms, `color(display-p3 0 0.2 0.1)` on `#FFFFFF`, has `contrast` of 4.5 or more and each form at 4.5 or more", () => {
    const dark = "color(display-p3 0 0.2 0.1)";
    expect(colorRatio(dark, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(clippedRatio(dark, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  test("whatever the display-p3 color, `contrast` on `#FFFFFF` is no more than the ratio as given and no more than the clipped one", () => {
    const u = fc.integer({ min: 0, max: 100 });
    fc.assert(
      fc.property(u, u, u, (r, g, b) => {
        const color = `color(display-p3 ${r / 100} ${g / 100} ${b / 100})`;
        expect(contrast(color, WHITE)).toBeLessThanOrEqual(colorRatio(color, WHITE) + 0.005);
        expect(contrast(color, WHITE)).toBeLessThanOrEqual(clippedRatio(color, WHITE) + 0.005);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("the CSS compiled from color tokens `a` `color(display-p3 0 0.54 0.24)` and `b` `#FFFFFF` declares `--k-color-a` once, as `color(display-p3 0 0.54 0.24)`", () => {
    const css = norm(compileWith({ color: { a: P3, b: WHITE } }, []).css);
    expect(css.split("--k-color-a:").length - 1).toBe(1);
    expect(css).toContain("--k-color-a:color(display-p3 0 0.54 0.24)");
  });

  test("whatever the display-p3 color, the CSS declares it once as written, with no fallback declaration", () => {
    const u = fc.integer({ min: 0, max: 100 });
    fc.assert(
      fc.property(u, u, u, (r, g, b) => {
        const color = `color(display-p3 ${r / 100} ${g / 100} ${b / 100})`;
        const css = norm(compileWith({ color: { a: color, b: WHITE } }, []).css);
        expect(css.split("--k-color-a:").length - 1).toBe(1);
        expect(css).toContain(`--k-color-a:${norm(color)}`);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
