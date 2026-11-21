// k.schema Format types: "JSON Schema is `base`'s (JSON Schema adds `format: name`)". Seed 1337.
import { type Schema, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toJsonSchema } from "../src/internal/toJsonSchema.ts";

const name = fc.stringMatching(/^[a-z][a-z0-9.-]{0,11}$/);
const bases: readonly Schema<unknown>[] = [
  s.string({ min: 1, max: 9 }),
  s.int({ min: 0, max: 5 }),
  s.enum(["a", "b"]),
  s.object({ x: s.boolean() }),
];

describe("toJsonSchema of a format type", () => {
  it("is its base's JSON Schema plus `format: name`", () => {
    fc.assert(
      fc.property(name, fc.constantFrom(...bases), (n, base) => {
        const F = s.format(n, base, { check: () => true, gen: { from: base, map: (x) => x } });
        expect(toJsonSchema(F.node)).toEqual({ ...toJsonSchema(base.node), format: n });
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("keeps the name through optional and nested positions", () => {
    const Even = s.format("even", s.int(), { check: (v) => v % 2 === 0, gen: { from: s.int(), map: (v) => v * 2 } });
    const O = s.object({ n: Even.optional(), list: s.array(Even) });
    expect(toJsonSchema(O.node)).toMatchObject({
      properties: { n: { type: "integer", format: "even" }, list: { items: { type: "integer", format: "even" } } },
      required: ["list"],
    });
  });
});
