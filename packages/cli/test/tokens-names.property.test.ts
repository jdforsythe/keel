// The pure helpers of `keel tokens import` and `keel tokens set`: token names, token paths, number text, edits. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applySourceEdits } from "../src/internal/tokens/applySourceEdits.ts";
import { fmtNumber } from "../src/internal/tokens/fmtNumber.ts";
import { lowerCamel } from "../src/internal/tokens/lowerCamel.ts";
import { parseTokenPath } from "../src/internal/tokens/parseTokenPath.ts";
import { themeWhen } from "../src/internal/tokens/themeWhen.ts";
import { tokenName } from "../src/internal/tokens/tokenName.ts";
import { weightNumber } from "../src/internal/tokens/weightNumber.ts";

const SEED = 1337;
const segment = fc.stringMatching(/^[A-Za-z0-9_-]{1,8}$/);

describe("token names", () => {
  it("are lowerCamel: letters and digits only, the first letter lowercase", () => {
    fc.assert(
      fc.property(fc.array(segment, { minLength: 1, maxLength: 4 }), (path) => {
        const name = tokenName(path);
        expect(name).toMatch(/^[A-Za-z0-9]*$/);
        expect(name).not.toMatch(/^[A-Z]/);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("leave out a first segment that names the group, unless it is the only one", () => {
    fc.assert(
      fc.property(fc.constantFrom("color", "colors", "type", "typography", "spacing"), segment, (group, rest) => {
        expect(tokenName([group, rest])).toBe(lowerCamel([rest]));
        expect(tokenName([group])).toBe(lowerCamel([group]));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("join words of a path in lowerCamel, `palette.ink` as paletteInk", () => {
    expect(tokenName(["palette", "ink"])).toBe("paletteInk");
    expect(tokenName(["spacing", "1"])).toBe("1");
    expect(tokenName(["type", "semi-bold body"])).toBe("semiBoldBody");
    expect(lowerCamel(["highContrast"])).toBe("highContrast");
  });
});

describe("token paths", () => {
  it("parse back to the parts they were written from", () => {
    fc.assert(
      fc.property(
        fc.option(fc.stringMatching(/^[a-z]{1,6}$/), { nil: undefined }),
        fc.stringMatching(/^[a-z]{1,6}$/),
        fc.stringMatching(/^[a-z0-9]{1,6}$/),
        fc.option(fc.constantFrom("light", "dark"), { nil: undefined }),
        (theme, group, name, scheme) => {
          const path = [
            ...(theme === undefined ? [] : ["themes", theme]),
            group,
            name,
            ...(scheme === undefined ? [] : [scheme]),
          ].join("/");
          expect(parseTokenPath(path)).toEqual({
            ...(theme === undefined ? {} : { theme }),
            group,
            name,
            ...(scheme === undefined ? {} : { scheme }),
          });
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("refuse an empty segment, one segment, five, and a scheme that is neither light nor dark", () => {
    for (const bad of ["", "color", "/color/a", "color//a", "color/a/", "a/b/c/d/e", "color/a/medium", "themes/a/b"])
      expect(parseTokenPath(bad), bad).toBeUndefined();
  });
});

describe("numbers, weights and modes", () => {
  it("fmtNumber writes a plain decimal that reads back within its places", () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), fc.integer({ min: 0, max: 6 }), (n, places) => {
        const text = fmtNumber(n, places);
        expect(text).toMatch(/^-?\d+(\.\d+)?$/);
        expect(text).not.toBe("-0");
        expect(Math.abs(Number(text) - n)).toBeLessThanOrEqual(0.5 * 10 ** -places + 1e-9);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("weights: numbers 1 to 1000 as they are, the format's names by its table, nothing else", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (n) => {
        expect(weightNumber(n)).toBe(n);
      }),
      { seed: SEED, numRuns: 50 },
    );
    expect(weightNumber("semi-bold")).toBe(600);
    expect(weightNumber("Extra Light")).toBe(200);
    expect(weightNumber("heavy")).toBe(900);
    expect(weightNumber(0)).toBeUndefined();
    expect(weightNumber("wobbly")).toBeUndefined();
  });

  it("a mode name gives `when`: print, contrast and highContrast, else none", () => {
    expect(themeWhen("print")).toBe("print");
    expect(themeWhen("contrast")).toBe("contrast");
    expect(themeWhen("High-Contrast")).toBe("contrast");
    expect(themeWhen("slate")).toBeUndefined();
  });
});

describe("source edits", () => {
  it("applied left to right, insertions at one offset in the order given", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }),
        fc.array(fc.string({ maxLength: 3 }), { maxLength: 4 }),
        (text, inserts) => {
          const at = Math.floor(text.length / 2);
          const out = applySourceEdits(
            text,
            inserts.map((t) => ({ start: at, end: at, text: t })),
          );
          expect(out).toBe(text.slice(0, at) + inserts.join("") + text.slice(at));
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
    expect(
      applySourceEdits("abcdef", [
        { start: 1, end: 3, text: "X" },
        { start: 4, end: 4, text: "Y" },
      ]),
    ).toBe("aXdYef");
  });
});
