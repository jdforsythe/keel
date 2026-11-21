// k.privacy Personal data: "JSON Schema adds `x-keel-pii`". Seed 1337.
import { type Schema, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toJsonSchema } from "../src/internal/toJsonSchema.ts";

const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;
const bases: readonly Schema<unknown>[] = [
  s.string(),
  s.int({ min: 0, max: 5 }),
  s.enum(["a", "b"]),
  s.object({ x: s.string() }),
  s.array(s.string()),
];

describe("toJsonSchema of a .pii() node", () => {
  it("is the unmarked JSON Schema plus `x-keel-pii: class`", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CLASSES), fc.constantFrom(...bases), (cls, base) => {
        expect(toJsonSchema(base.pii(cls).node)).toEqual({ ...toJsonSchema(base.node), "x-keel-pii": cls });
      }),
      { numRuns: 100, seed: 1337 },
    );
  });

  it("marks the node it is on, and an unmarked node carries no `x-keel-pii`", () => {
    const j = toJsonSchema(s.object({ email: s.string().pii("contact"), age: s.int() }).node);
    expect(j).toMatchObject({ properties: { email: { "x-keel-pii": "contact" } } });
    expect(JSON.stringify(j).match(/x-keel-pii/g)).toHaveLength(1);
  });
});
