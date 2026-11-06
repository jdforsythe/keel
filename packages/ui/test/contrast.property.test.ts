// Properties of contrast: WCAG 2 ratio, symmetric, bounded, known pairs. Seed 1337.
import { contrast } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const hex6 = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);

describe("contrast properties", () => {
  it("is symmetric and within [1, 21]", () => {
    fc.assert(
      fc.property(hex6, hex6, (a, b) => {
        const r = contrast(a, b);
        expect(r).toBe(contrast(b, a));
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(21);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("a color against itself is 1; #rgb equals its #rrggbb expansion", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(..."0123456789abcdefABCDEF"), { minLength: 3, maxLength: 3 }), (cs) => {
        const short = `#${cs.join("")}`;
        const long = `#${cs.map((c) => c + c).join("")}`;
        expect(contrast(short, short)).toBe(1);
        expect(contrast(short, "#ffffff")).toBe(contrast(long, "#ffffff"));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("matches known WCAG pairs", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 6);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrast("#0000ff", "#ffffff")).toBeCloseTo(8.59, 2);
    expect(contrast("#ff0000", "#ffffff")).toBeCloseTo(4.0, 2);
  });

  it("rejects non-hex colors", () => {
    expect(() => contrast("red", "#fff")).toThrow(RangeError);
    expect(() => contrast("#ff", "#fff")).toThrow(RangeError);
  });
});
