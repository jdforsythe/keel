// A generated `s.id` has the shape `ctx.random.id` mints: a v4 uuid. fast-check seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gen } from "../src/gen.ts";
import { s } from "../src/index.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("gen of s.id", () => {
  it("draws only v4 uuids that the id parses", () => {
    const Item = s.id("Item");
    fc.assert(
      fc.property(gen(Item), (id) => {
        expect(id).toMatch(V4);
        expect(Item.parse(id).ok).toBe(true);
      }),
    );
  });
  it("draws the same shape under an object", () => {
    const Row = s.object({ id: s.id("Row"), parent: s.id("Row").optional() });
    fc.assert(
      fc.property(gen(Row), (row) => {
        expect(row.id).toMatch(V4);
        if (row.parent !== undefined) expect(row.parent).toMatch(V4);
      }),
    );
  });
});
