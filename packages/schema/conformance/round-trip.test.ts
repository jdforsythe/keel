// Clause: round-trip for every type. Seed 1337, 100 runs.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { allTypes, norm, RUNS, SEED } from "./fixtures";

describe("k.schema round-trip", () => {
  for (const [name, schema] of Object.entries(allTypes)) {
    it(`decode(encode(v)) equals v for generated ${name}`, () => {
      fc.assert(
        fc.property(schema.gen(), (v) => {
          const r = schema.decode(schema.encode(v));
          expect(r.ok).toBe(true);
          if (r.ok) expect(norm(r.value)).toEqual(norm(v));
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });
    it(`encode(${name}) survives a real JSON string trip`, () => {
      fc.assert(
        fc.property(schema.gen(), (v) => {
          const wire = JSON.parse(JSON.stringify(schema.encode(v)));
          const r = schema.decode(wire);
          expect(r.ok).toBe(true);
          if (r.ok) expect(norm(r.value)).toEqual(norm(v));
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });
  }
});
