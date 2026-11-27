// Properties of `failing` on an overlay outside the sRGB gamut (k.values Contrast): the overlay is composited once with
// both colors mapped and once with both clipped, the lower ratio standing, in every combination. Seed 1337.
import { composite, contrast } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Combo } from "../src/internal/contrast/Combo.ts";
import { failing } from "../src/internal/contrast/failing.ts";

const SEED = 1337;
const unit = fc.integer({ min: 0, max: 100 }).map((n) => n / 100);
const alpha = fc.integer({ min: 1, max: 99 }).map((n) => n / 100);
const hex6 = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);
const p3 = fc.tuple(unit, unit, unit, alpha).map(([r, g, b, a]) => `color(display-p3 ${r} ${g} ${b} / ${a})`);

const combo = (name: string, tokens: unknown, printing: boolean): Combo => ({
  name,
  tokens,
  contrast: true,
  printing,
  scheme: "light",
  layers: [],
});

/** The ratio judged in one form alone: the overlay composited over its backdrop in that form, text on the result. */
const single = (top: string, back: string, text: string, form: "mapped" | "clipped", fgSide: boolean): number => {
  if (fgSide) return contrast(composite(top, back, form), back);
  return contrast(text, composite(top, back, form));
};

describe("failing on an overlay in each gamut form", () => {
  it("reports at most each single-form ratio, and fails exactly when the lower one is under the need", () => {
    fc.assert(
      fc.property(p3, hex6, hex6, fc.boolean(), fc.boolean(), (top, card, text, fgSide, printing) => {
        const tokens = {
          color: { card, text },
          overlay: { scrim: { value: top, over: ["card"] } },
        };
        const c = combo(printing ? "print" : "light+hc", tokens, printing);
        const found = fgSide
          ? failing(tokens, [c], "scrim", "card", undefined, undefined)
          : failing(tokens, [c], "text", "scrim", undefined, undefined);
        const mapped = single(top, card, text, "mapped", fgSide);
        const clipped = single(top, card, text, "clipped", fgSide);
        const low = Math.min(mapped, clipped);
        expect(found !== undefined).toBe(low < 7);
        if (found === undefined) return;
        const reported = Number(found.ratio);
        expect(found.scheme).toBe(c.name);
        expect(reported).toBeLessThanOrEqual(Number(mapped.toFixed(2)));
        expect(reported).toBeLessThanOrEqual(Number(clipped.toFixed(2)));
        expect(found.ratio).toBe(low.toFixed(2));
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("fails large text on a display-p3 scrim over #FFFFFF at the clipped composite, which mapping alone passes", () => {
    const tokens = {
      color: { card: "#FFFFFF", on: "#FFFFFF" },
      overlay: { scrim: { value: "color(display-p3 0 0.66 0 / 0.95)", over: ["card"] } },
    };
    const c: Combo = { ...combo("light", tokens, false), contrast: false };
    const bad = failing(tokens, [c], "on", "scrim", null, null);
    expect(bad?.ratio).toBe("2.90");
    expect(bad?.need).toBe("3");
    expect(bad?.over).toBe("card");
  });
});
