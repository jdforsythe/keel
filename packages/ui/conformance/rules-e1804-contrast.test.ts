// Spec: k.ui Conformance 6 and Rule E1804. Property seed: 1337.
// Expected ratios are computed in the test from the WCAG formula.
import { contrast } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, ratio, tokens } from "./fixtures.ts";

const SPEC = {
  light: { fg: "#111", bg: "#fff" },
  dark: { fg: "#eee", bg: "#111" },
} as const;

describe("k.ui: fg='fg' bg='bg' with the tokens above passes E1804 in both schemes; a pair at 3:1 fails it", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`fg="fg" bg="bg" with the tokens above passes E1804 in the ${scheme} scheme`, () => {
      const { fg, bg } = SPEC[scheme];
      const expected = ratio(fg, bg);
      expect(expected).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, bg)).toBeCloseTo(expected, 4);
      expect(tokens.color.fg[scheme]).toBe(fg);
      expect(tokens.color.bg[scheme]).toBe(bg);
    });
  }

  it("a pair at 3:1 fails E1804 (below 4.5:1 at fontSize under 24px)", () => {
    // #949494 on #fff is ~3.03:1
    const expected = ratio("#949494", "#ffffff");
    expect(expected).toBeGreaterThanOrEqual(3);
    expect(expected).toBeLessThan(3.1);
    const got = contrast("#949494", "#ffffff");
    expect(got).toBeCloseTo(expected, 4);
    expect(got).toBeLessThan(4.5);
  });

  it("contrast equals the WCAG ratio for any pair of grays and is symmetric", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), (a, b) => {
        const h = (n: number): string => `#${n.toString(16).padStart(2, "0").repeat(3)}`;
        expect(contrast(h(a), h(b))).toBeCloseTo(ratio(h(a), h(b)), 4);
        expect(contrast(h(a), h(b))).toBeCloseTo(contrast(h(b), h(a)), 6);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
