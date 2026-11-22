// k.guards Carried params: `paramFits` is sound over the scalar leaves a path param uses. Whenever a page's node fits
// its redirect route's, every value the page's node accepts parses under the target's; and a node always fits itself.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { paramFits } from "../src/internal/paramFits.ts";

const SEED = 1337;
const word = fc.constantFrom("a", "b", "c", "dd", "eee");
const bound = fc.option(fc.integer({ min: -5, max: 12 }), { nil: undefined });
const len = fc.option(fc.integer({ min: 0, max: 6 }), { nil: undefined });
// Bounds with min <= max when both are present, as k.schema requires.
const bounds = (a: number | undefined, b: number | undefined) => {
  const [min, max] = a !== undefined && b !== undefined && a > b ? [b, a] : [a, b];
  return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
};

const scalar = fc.oneof(
  fc.tuple(len, len).map(([a, b]) => s.string(bounds(a, b))),
  fc.tuple(bound, bound).map(([a, b]) => s.int(bounds(a, b))),
  fc.tuple(bound, bound).map(([a, b]) => s.number(bounds(a, b))),
  fc.tuple(word, fc.uniqueArray(word, { maxLength: 3 })).map(([w, v]) => s.enum([w, ...v.filter((x) => x !== w)])),
  word.map((v) => s.literal(v)),
  fc.constantFrom("User", "Recipe").map((b) => s.id(b)),
);
const value = fc.oneof(word, fc.integer({ min: -8, max: 15 }), fc.double({ min: -8, max: 15, noNaN: true }));

describe("paramFits", () => {
  it("a node fits itself and a copy written twice", () => {
    fc.assert(
      fc.property(scalar, (n) => {
        expect(paramFits(n.node, n.node)).toBe(true);
        expect(paramFits(n.node, JSON.parse(JSON.stringify(n.node)))).toBe(true);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("a fitting page node's values all parse under the target", () => {
    fc.assert(
      fc.property(scalar, scalar, fc.array(value, { maxLength: 12 }), (page, target, xs) => {
        fc.pre(paramFits(page.node, target.node));
        for (const x of xs) if (page.parse(x).ok) expect(target.parse(x).ok, JSON.stringify(x)).toBe(true);
      }),
      { seed: SEED, numRuns: 400 },
    );
  });

  it("an int fits a number target whose bounds hold its own; a number never fits an int target", () => {
    expect(paramFits(s.int({ min: 1, max: 5 }).node, s.number({ min: 0 }).node)).toBe(true);
    expect(paramFits(s.int().node, s.number().node)).toBe(true);
    expect(paramFits(s.int().node, s.number({ max: 3 }).node)).toBe(false);
    expect(paramFits(s.number({ min: 1, max: 2 }).node, s.int().node)).toBe(false);
  });

  it("ids of different brands, formats and unions do not fit", () => {
    expect(paramFits(s.id("User").node, s.id("Recipe").node)).toBe(false);
    expect(paramFits(s.id("User").node, s.string().node)).toBe(false);
    expect(paramFits(s.boolean().node, s.boolean().node)).toBe(true);
    expect(paramFits(s.boolean().node, s.string().node)).toBe(false);
  });
});
