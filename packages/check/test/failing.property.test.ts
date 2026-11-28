// Properties of `failing` (k.a11y-static Judged, Combinations, Overlays): the need per combination and the composite. Seed 1337.
import { contrast } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Combo } from "../src/internal/contrast/Combo.ts";
import { failing } from "../src/internal/contrast/failing.ts";

const SEED = 1337;
const grey = fc.integer({ min: 0, max: 255 }).map((n) => `#${n.toString(16).padStart(2, "0").repeat(3)}`);
const combo = (name: string, tokens: unknown, hc: boolean): Combo => ({
  name,
  tokens,
  contrast: hc,
  printing: false,
  scheme: "light",
  layers: [],
});

describe("failing", () => {
  it("fails exactly below 4.5:1, and below 7:1 with the contrast theme on", () => {
    fc.assert(
      fc.property(grey, (g) => {
        const tokens = { color: { fg: g, bg: "#ffffff" } };
        const r = contrast(g, "#ffffff");
        expect(failing(tokens, [combo("light", tokens, false)], "fg", "bg", undefined, undefined) !== undefined).toBe(
          r < 4.5,
        );
        const hc = failing(tokens, [combo("light+hc", tokens, true)], "fg", "bg", undefined, undefined);
        expect(hc !== undefined).toBe(r < 7);
        if (hc !== undefined) expect(hc.need).toBe("7");
      }),
      { seed: SEED, numRuns: 80 },
    );
  });

  it("a bg overlay with no backdrop found is judged over each of its over, the first failing named", () => {
    const tokens = {
      color: { on: "#ffffff", a: "#000000", b: "#ffffff" },
      overlay: { scrim: { value: "rgb(0 0 0 / 0.5)", over: ["a", "b"] } },
    };
    const bad = failing(tokens, [combo("light", tokens, false)], "on", "scrim", undefined, undefined);
    expect(bad?.over).toBe("b");
    expect(failing(tokens, [combo("light", tokens, false)], "on", "scrim", undefined, undefined, "a")).toBeUndefined();
  });
});
