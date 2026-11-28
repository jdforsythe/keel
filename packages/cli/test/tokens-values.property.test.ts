// DTCG values as Keel values, and the JSON reader that keeps offsets (`keel tokens import`). Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { JsonNode } from "../src/internal/tokens/JsonNode.ts";
import { dtcgColor } from "../src/internal/tokens/dtcgColor.ts";
import { jsonTree } from "../src/internal/tokens/jsonTree.ts";
import { lineCol } from "../src/internal/tokens/lineCol.ts";
import { toOklch } from "../src/internal/tokens/toOklch.ts";

const SEED = 1337;
const color = (space: string, components: number[], extra = ""): JsonNode => {
  const node = jsonTree(`{"colorSpace":"${space}","components":${JSON.stringify(components)}${extra}}`);
  if (node === undefined) throw new Error("fixture");
  return node;
};
const plain = (n: JsonNode): unknown => {
  if (n.kind === "object") return Object.fromEntries(n.members.map((m) => [m.key, plain(m.value)]));
  if (n.kind === "array") return n.items.map(plain);
  return n.value;
};
const json: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: "small", maxDepth: 3 },
    fc.string({ maxLength: 6 }),
    fc.integer({ min: -1000, max: 1000 }),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie("value"), { maxLength: 3 }),
    fc.dictionary(fc.string({ maxLength: 4 }), tie("value"), { maxKeys: 3 }),
  ),
})).value;

describe("jsonTree", () => {
  it("reads what JSON.parse reads, with the offset of each member's key at its opening quote", () => {
    fc.assert(
      fc.property(json, fc.constantFrom(0, 2), (value, indent) => {
        const text = JSON.stringify(value, null, indent);
        const tree = jsonTree(text);
        expect(tree).toBeDefined();
        if (tree === undefined) return;
        expect(plain(tree)).toEqual(JSON.parse(text));
        if (tree.kind === "object") for (const m of tree.members) expect(text[m.keyAt]).toBe('"');
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("refuses text that is not JSON", () => {
    for (const bad of ["", "not json", "{", '{"a":1,}', "[1 2]", '{"a":1} x', "{a:1}"])
      expect(jsonTree(bad), bad).toBeUndefined();
  });

  it("lineCol is the 1-based line and column of an offset", () => {
    expect(lineCol("ab\ncd", 0)).toEqual({ line: 1, col: 1 });
    expect(lineCol("ab\ncd", 4)).toEqual({ line: 2, col: 2 });
  });
});

describe("dtcgColor", () => {
  it("an sRGB color is the #rrggbb of its components, or its hex as written", () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 })),
        (rgb) => {
          const hex = `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
          expect(
            dtcgColor(
              color(
                "srgb",
                rgb.map((c) => c / 255),
              ),
            )?.text,
          ).toBe(hex);
          expect(dtcgColor(color("srgb", [0, 0, 0], `,"hex":"${hex.toUpperCase()}"`))?.text).toBe(hex.toUpperCase());
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("oklch, oklab, hsl and display-p3 keep their own forms", () => {
    expect(dtcgColor(color("oklch", [0.72, 0.14, 45]))?.text).toBe("oklch(0.72 0.14 45)");
    expect(dtcgColor(color("oklab", [0.5, -0.1, 0.1]))?.text).toBe("oklab(0.5 -0.1 0.1)");
    expect(dtcgColor(color("hsl", [19, 87, 39]))?.text).toBe("hsl(19 87% 39%)");
    expect(dtcgColor(color("display-p3", [0.67, 0.29, 0.1]))?.text).toBe("color(display-p3 0.67 0.29 0.1)");
  });

  it("any other known space is oklch() at 4 decimals and names the space; an unknown one is none", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("lab", "lch", "srgb-linear", "a98-rgb", "rec2020", "prophoto-rgb", "xyz-d65", "xyz-d50", "hwb"),
        fc.tuple(
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 100, noNaN: true }),
        ),
        (space, c) => {
          const out = dtcgColor(color(space, c));
          expect(out?.space).toBe(space);
          expect(out?.text).toMatch(/^oklch\(\d+(\.\d{1,4})? \d+(\.\d{1,4})? \d+(\.\d{1,4})?\)$/);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
    expect(dtcgColor(color("klein-blue", [0, 0, 0]))).toBeUndefined();
  });

  it("white is lightness 1 and chroma 0 in every space that has one", () => {
    const [l, c] = toOklch("srgb", [1, 1, 1]) ?? [0, 1, 0];
    expect(l).toBeCloseTo(1, 3);
    expect(c).toBeLessThan(0.001);
    expect(toOklch("lab", [100, 0, 0])?.[0]).toBeCloseTo(1, 2);
    expect(toOklch("xyz-d65", [0.9505, 1, 1.089])?.[0]).toBeCloseTo(1, 2);
    expect(toOklch("rec2020", [1, 1, 1])?.[0]).toBeCloseTo(1, 2);
  });

  it("a color with alpha is flagged, and written with its alpha", () => {
    expect(dtcgColor(color("srgb", [0, 0, 0], `,"alpha":0.5`))).toEqual({ text: "#00000080", alpha: true });
    expect(dtcgColor(color("oklch", [0.5, 0.1, 10], `,"alpha":0.25`))).toEqual({
      text: "oklch(0.5 0.1 10 / 0.25)",
      alpha: true,
    });
    expect(dtcgColor(color("srgb", [0, 0, 0], `,"alpha":1`))?.alpha).toBeUndefined();
  });
});
