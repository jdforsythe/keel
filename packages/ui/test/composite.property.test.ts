// Properties of composite (k.gamut Judging): an `<alpha>` over a backdrop within each form it ships in. Seed 1337.
import { composite, contrast, formsOf } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const unit = fc.integer({ min: 0, max: 100 }).map((n) => n / 100);
const hex6 = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);
const alpha = fc.integer({ min: 1, max: 99 }).map((n) => n / 100);

const channelsOf = (hex: string): readonly number[] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

describe("composite", () => {
  it("blends a display-p3 overlay as `a × c + (1 - a) × b`, rounded, on each encoded display-p3 channel in P3", () => {
    fc.assert(
      fc.property(unit, unit, unit, alpha, (r, g, b, a) => {
        const want = [r, g, b].map((c) => Math.round((a * c + (1 - a)) * 255) / 255);
        expect(composite(`color(display-p3 ${r} ${g} ${b} / ${a})`, "#FFFFFF", "P3")).toBe(
          `color(display-p3 ${want.join(" ")})`,
        );
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("blends in sRGB the overlay's sRGB form, `rgb()` channels over a hex backdrop", () => {
    fc.assert(
      fc.property(hex6, alpha, hex6, (c, a, back) => {
        const top = channelsOf(c);
        const under = channelsOf(back);
        const want = top.map((x, i) => Math.round((a * (x / 255) + (1 - a) * ((under[i] ?? 0) / 255)) * 255));
        expect(composite(`rgb(${top.join(" ")} / ${a})`, back, "sRGB")).toBe(`rgb(${want.join(" ")})`);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("a color inside sRGB ships in one form", () => {
    fc.assert(
      fc.property(hex6, alpha, hex6, (c, a, back) => {
        const top = `${c}${Math.round(a * 255)
          .toString(16)
          .padStart(2, "0")}`;
        expect(formsOf(top, back)).toEqual(["sRGB"]);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("composites an overlay outside sRGB over #FFFFFF in each form", () => {
    const o = "color(display-p3 0 0.66 0 / 0.95)";
    expect(formsOf(o, "#FFFFFF")).toEqual(["sRGB", "P3"]);
    expect(composite(o, "#FFFFFF", "sRGB")).toBe("rgb(13 171 17)");
    expect(composite(o, "#FFFFFF", "P3")).toBe(`color(display-p3 ${[13, 173, 13].map((v) => v / 255).join(" ")})`);
    expect(contrast("#FFFFFF", composite(o, "#FFFFFF", "sRGB"), "sRGB")).toBeCloseTo(3.07, 2);
    expect(contrast("#FFFFFF", composite(o, "#FFFFFF", "P3"), "P3")).toBeCloseTo(3.09, 2);
  });
});
