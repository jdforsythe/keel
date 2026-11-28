import { gen } from "@keel/schema/gen";
import fc from "fast-check";
// k.schema round-trip over the shared fixture types (json and member unions are covered in their own files): parse(encode(v)) round-trips. Seed 1337, 100 runs.
import { describe, expect, it } from "vitest";
import { RUNS, SEED, allTypes, norm } from "./fixtures";

describe("k.schema round-trip", () => {
  for (const [name, schema] of Object.entries(allTypes)) {
    it(`parse(encode(v)) equals v for generated ${name}`, () => {
      fc.assert(
        fc.property(gen(schema), (v) => {
          const r = schema.parse(schema.encode(v));
          expect(r.ok).toBe(true);
          if (r.ok) expect(norm(r.value)).toEqual(norm(v));
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });
    it(`encode(${name}) survives a real JSON string trip`, () => {
      fc.assert(
        fc.property(gen(schema), (v) => {
          const wire = JSON.parse(JSON.stringify(schema.encode(v)));
          const r = schema.parse(wire);
          expect(r.ok).toBe(true);
          if (r.ok) expect(norm(r.value)).toEqual(norm(v));
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });
  }
});
