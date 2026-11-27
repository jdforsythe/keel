// Properties of the color forms (k.values Colors, Contrast), compositing, gamut mapping and combinations. Seed 1337.
import { combinations, composite, contrast, gamutForms } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gamutMap } from "../src/css/gamutMap.ts";
import { colorSyntax } from "../src/internal/colorSyntax.ts";

const SEED = 1337;
const byte = fc.integer({ min: 0, max: 255 });
const unit = fc.integer({ min: 0, max: 1000 }).map((n) => n / 1000);
const hex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

describe("color forms", () => {
  it("rgb() and hex of the same channels read the same and judge the same", () => {
    fc.assert(
      fc.property(byte, byte, byte, (r, g, b) => {
        expect(colorSyntax(`rgb(${r} ${g} ${b})`)?.channels).toEqual(colorSyntax(hex(r, g, b))?.channels);
        expect(contrast(`rgb(${r} ${g} ${b})`, "#ffffff")).toBeCloseTo(contrast(hex(r, g, b), "#ffffff"), 9);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a channel past its range, a comma or a named color is no form", () => {
    fc.assert(
      fc.property(fc.integer({ min: 256, max: 999 }), (n) => {
        expect(colorSyntax(`rgb(${n} 0 0)`)).toBeNull();
        expect(colorSyntax(`rgb(${n % 256}, 0, 0)`)).toBeNull();
      }),
      { seed: SEED, numRuns: 50 },
    );
    for (const v of ["white", "oklch(none 0 0)", "rgb(from #000 r g b)", "oklch(0.5 0.6 10)", "#12345"])
      expect(colorSyntax(v)).toBeNull();
  });

  it("alpha comes from ` / <a>` or 4 and 8 hex digits, and only then", () => {
    fc.assert(
      fc.property(unit, (a) => {
        expect(colorSyntax(`oklch(0.5 0.1 30 / ${a})`)?.alpha).toBeCloseTo(a, 9);
        expect(colorSyntax("oklch(0.5 0.1 30)")?.alpha).toBeNull();
      }),
      { seed: SEED, numRuns: 50 },
    );
    expect(colorSyntax("#0008")?.alpha).toBeCloseTo(0x88 / 255, 9);
  });

  it("gamut mapping returns an in-gamut color, and leaves one in the gamut as it is", () => {
    fc.assert(
      fc.property(unit, unit, unit, (r, g, b) => {
        expect(gamutMap([r, g, b])).toEqual([r, g, b]);
        const p3 = colorSyntax(`color(display-p3 ${r} ${g} ${b})`);
        expect(p3).not.toBeNull();
        const out = gamutMap([r * 1.3 - 0.1, g, b * 1.2]);
        for (const c of out) {
          expect(c).toBeGreaterThanOrEqual(-0.000001);
          expect(c).toBeLessThanOrEqual(1.000001);
        }
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  it("a pair is never judged above its ratio as given", () => {
    fc.assert(
      fc.property(unit, unit, unit, byte, (r, g, b, k) => {
        const judged = contrast(`color(display-p3 ${r} ${g} ${b})`, hex(k, k, k));
        expect(judged).toBeGreaterThanOrEqual(1);
        expect(judged).toBeLessThanOrEqual(21);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});

describe("composite", () => {
  it("alpha 1 is the overlay, alpha 0 the backdrop, and the result lies between them", () => {
    fc.assert(
      fc.property(byte, byte, byte, byte, unit, fc.constantFrom(...gamutForms), (r, g, b, k, a, form) => {
        const back = hex(k, k, k);
        expect(contrast(composite(`rgb(${r} ${g} ${b} / 1)`, back, form), hex(r, g, b))).toBeCloseTo(1, 6);
        expect(contrast(composite(`rgb(${r} ${g} ${b} / 0)`, back, form), back)).toBeCloseTo(1, 6);
        const mix = colorSyntax(composite(`rgb(${r} ${g} ${b} / ${a})`, back, form));
        mix?.channels.forEach((c, i) => {
          const top = [r, g, b][i] ?? 0;
          expect(c).toBeGreaterThanOrEqual(Math.min(top, k) - 0.000001);
          expect(c).toBeLessThanOrEqual(Math.max(top, k) + 0.000001);
        });
      }),
      { seed: SEED, numRuns: 80 },
    );
  });
});

describe("combinations", () => {
  it("without themes, the combinations are the schemes", () => {
    fc.assert(
      fc.property(fc.boolean(), (pair) => {
        const color = { x: pair ? { light: "#111111", dark: "#eeeeee" } : "#111111" };
        expect(combinations({ color }).map((c) => c.name)).toEqual(pair ? ["light", "dark"] : ["light"]);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("a later layer wins: print over contrast over choice over the top level", () => {
    const tokens = {
      color: { x: "#111111" },
      themes: {
        slate: { color: { x: "#222222" } },
        hc: { when: "contrast" as const, color: { x: "#333333" } },
        paper: { when: "print" as const, color: { x: "#444444" } },
      },
    };
    const x = (name: string): string | undefined => {
      const v = combinations(tokens).find((c) => c.name === name)?.tokens.color?.x;
      return typeof v === "string" ? v : undefined;
    };
    expect([x("light"), x("light+slate"), x("light+slate+hc"), x("print+slate+hc")]).toEqual([
      "#111111",
      "#222222",
      "#333333",
      "#444444",
    ]);
  });
});
