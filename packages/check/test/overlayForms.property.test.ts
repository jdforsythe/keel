// Properties of `failing` on an overlay outside sRGB (k.gamut Judging): the overlay is composited within each form it
// ships in, sRGB and P3, the lower ratio standing (sRGB's on a tie), a printing combination in sRGB forms only. Seed 1337.
import { type GamutForm, composite, contrast, formsOf } from "@keel/ui/css";
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
const single = (top: string, back: string, text: string, form: GamutForm, fgSide: boolean): number => {
  if (fgSide) return contrast(composite(top, back, form), back, form);
  return contrast(text, composite(top, back, form), form);
};

describe("failing on an overlay in each gamut form", () => {
  it("fails exactly when the lower form's ratio is under the need, at that ratio, printing in sRGB alone", () => {
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
        const srgb = single(top, card, text, "sRGB", fgSide);
        const wide = single(top, card, text, "P3", fgSide);
        const both = !printing && formsOf(top, card).length > 1;
        const low = both ? Math.min(srgb, wide) : srgb;
        expect(found !== undefined).toBe(low < 7);
        if (found === undefined) return;
        expect(found.scheme).toBe(c.name);
        expect(found.ratio).toBe(low.toFixed(2));
        expect(found.form).toBe(formsOf(top, card).length > 1 ? (both && wide < srgb ? "P3" : "sRGB") : undefined);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("fails large text on an oklch scrim over #FFFFFF at the P3 composite, below the sRGB one", () => {
    const tokens = {
      color: { card: "#FFFFFF", on: "#FFFFFF" },
      overlay: { scrim: { value: "oklch(60% 0.3 150 / 0.8)", over: ["card"] } },
    };
    const c: Combo = { ...combo("light", tokens, false), contrast: false };
    const bad = failing(tokens, [c], "on", "scrim", null, null);
    expect(bad?.ratio).toBe("2.74");
    expect(bad?.form).toBe("P3");
    expect(bad?.need).toBe("3");
    expect(bad?.over).toBe("card");
  });

  it("names no form when every color judged is inside sRGB", () => {
    const tokens = {
      color: { card: "#FFFFFF", on: "#FFFFFF" },
      overlay: { scrim: { value: "rgb(26 25 30 / 0.4)", over: ["card"] } },
    };
    const bad = failing(
      tokens,
      [{ ...combo("light", tokens, false), contrast: false }],
      "on",
      "scrim",
      undefined,
      undefined,
    );
    expect(bad).toBeDefined();
    expect(bad?.form).toBeUndefined();
  });
});
