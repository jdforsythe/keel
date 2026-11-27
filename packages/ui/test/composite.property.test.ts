// Properties of composite (k.values Contrast): an `<alpha>` over a backdrop in each gamut form. Seed 1337.
import { composite, contrast, gamutForms } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const unit = fc.integer({ min: 0, max: 100 }).map((n) => n / 100);
const hex6 = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);
const alpha = fc.integer({ min: 1, max: 99 }).map((n) => n / 100);

/** CSS Color 4's sRGB transfer function and its inverse, sign kept. */
const toLinear = (c: number): number => {
  const a = Math.abs(c);
  return Math.sign(c) * (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4);
};
const toEncoded = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (v: number): number => Math.min(1, Math.max(0, v));

/** A display-p3 color's encoded sRGB channels from 0 to 255 with each linear channel clipped, written here alone. */
function clippedP3(r: number, g: number, b: number): readonly [number, number, number] {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const x = 0.4865709486482162 * lr + 0.26566769316909306 * lg + 0.1982172852343625 * lb;
  const y = 0.2289745640697488 * lr + 0.6917385218365064 * lg + 0.079286914093745 * lb;
  const z = 0.04511338185890264 * lg + 1.043944368900976 * lb;
  const s = [
    3.2409699419045226 * x - 1.537383177570094 * y - 0.4986107602930034 * z,
    -0.9692436362808796 * x + 1.8759675015077202 * y + 0.04155505740717559 * z,
    0.05563007969699366 * x - 0.20397695888897652 * y + 1.0569715142428786 * z,
  ].map((v) => toEncoded(clamp(v)) * 255);
  return [s[0] ?? 0, s[1] ?? 0, s[2] ?? 0];
}

const channelsOf = (hex: string): readonly number[] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

describe("composite", () => {
  it("blends a clipped display-p3 overlay as `a × c + (1 - a) × b`, rounded, on each encoded channel", () => {
    fc.assert(
      fc.property(unit, unit, unit, alpha, hex6, (r, g, b, a, back) => {
        const top = clippedP3(r, g, b);
        const under = channelsOf(back);
        const want = top.map((c, i) => Math.round(a * c + (1 - a) * (under[i] ?? 0)));
        expect(composite(`color(display-p3 ${r} ${g} ${b} / ${a})`, back, "clipped")).toBe(`rgb(${want.join(" ")})`);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("gives one composite in both forms for a color inside the sRGB gamut", () => {
    fc.assert(
      fc.property(hex6, alpha, hex6, (c, a, back) => {
        const top = `${c}${Math.round(a * 255)
          .toString(16)
          .padStart(2, "0")}`;
        expect(composite(top, back, "clipped")).toBe(composite(top, back, "mapped"));
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("composites an out-of-gamut overlay over #FFFFFF differently in each form", () => {
    const o = "color(display-p3 0 0.66 0 / 0.95)";
    expect(composite(o, "#FFFFFF", "mapped")).toBe("rgb(13 171 16)");
    expect(composite(o, "#FFFFFF", "clipped")).toBe("rgb(13 176 13)");
    expect(contrast("#FFFFFF", composite(o, "#FFFFFF", "mapped"))).toBeCloseTo(3.07, 2);
    expect(contrast("#FFFFFF", composite(o, "#FFFFFF", "clipped"))).toBeCloseTo(2.9, 2);
  });

  it("names both forms", () => {
    expect([...gamutForms]).toEqual(["mapped", "clipped"]);
  });
});
