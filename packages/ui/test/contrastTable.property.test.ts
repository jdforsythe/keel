// Properties of contrastTable: symmetric in ratio, 21 on black and white, skips colors it cannot measure. Seed 1337.
import { contrastTable, defineTokens } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const hex6 = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);
const color = fc.oneof(hex6, fc.record({ light: hex6, dark: hex6 }));

describe("contrastTable properties", () => {
  it("is symmetric in ratio: (fg, bg) and (bg, fg) of one scheme have one ratio", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.stringMatching(/^[a-z]{1,6}$/), color, { maxKeys: 5 }), (c) => {
        const rows = contrastTable(defineTokens({ color: c }));
        const at = new Map(rows.map((r) => [`${r.scheme}:${r.fg}:${r.bg}`, r.ratio]));
        for (const r of rows) {
          expect(at.get(`${r.scheme}:${r.bg}:${r.fg}`)).toBe(r.ratio);
          expect(r.ratio).toBeGreaterThanOrEqual(1);
          expect(r.ratio).toBeLessThanOrEqual(21);
        }
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("is 21 on black and white in each declared scheme, either order and spelling", () => {
    fc.assert(
      fc.property(fc.constantFrom("#000", "#000000"), fc.constantFrom("#fff", "#FFFFFF"), (k, w) => {
        expect(contrastTable(defineTokens({ color: { k, w } }))).toHaveLength(2);
        const rows = contrastTable(defineTokens({ color: { k, w }, schemes: ["light", "dark"] }));
        expect(rows).toHaveLength(4);
        for (const r of rows) expect(r.ratio).toBe(21);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("judges only the schemes the app has: one scheme gives no rows of the other", () => {
    fc.assert(
      fc.property(fc.constantFrom<readonly ("light" | "dark")[]>(["light"], ["dark"], ["light", "dark"]), (schemes) => {
        const rows = contrastTable(defineTokens({ color: { a: { light: "#000", dark: "#fff" }, b: "#777" }, schemes }));
        expect(new Set(rows.map((r) => r.scheme))).toEqual(new Set(schemes));
      }),
      { seed: SEED, numRuns: 6 },
    );
  });

  it("leaves out a pair whose color in that scheme is not a hex color", () => {
    // Tokens `TokenSchema` refuses (k.values): `contrastTable` still reads what it is given.
    const rows = contrastTable({ color: { a: "#000", b: "#fff", c: { light: "#777", dark: "transparent" } } });
    // `c` is the app's own pair, so the app has both schemes (k.schemes).
    expect(rows.filter((r) => r.scheme === "light")).toHaveLength(6);
    expect(rows.filter((r) => r.scheme === "dark")).toHaveLength(2);
  });
});
