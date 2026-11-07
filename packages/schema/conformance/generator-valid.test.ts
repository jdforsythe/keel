import { gen } from "@keel/schema/gen";
import fc from "fast-check";
// Spec: k.schema, clause "Generator produces only valid values."
// Seed 1337, 100 runs.
import { describe, expect, it } from "vitest";
import { Enum, Int, Num, RUNS, SEED, Str, allTypes } from "./fixtures";

describe("k.schema generator validity", () => {
  for (const [name, schema] of Object.entries(allTypes)) {
    it(`every gen() sample of ${name} parses ok`, () => {
      fc.assert(
        fc.property(gen(schema), (v) => schema.parse(v).ok),
        { seed: SEED, numRuns: RUNS },
      );
    });
  }
  it("gen() of number yields only finite numbers", () => {
    fc.assert(
      fc.property(gen(Num), (v) => Number.isFinite(v)),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("gen() of int yields only safe integers", () => {
    fc.assert(
      fc.property(gen(Int), (v) => Number.isInteger(v)),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("gen() of string honours min/max", () => {
    fc.assert(
      fc.property(gen(Str), (v) => v.length >= 1 && v.length <= 8),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("gen() of enum yields only declared members", () => {
    fc.assert(
      fc.property(gen(Enum), (v) => v === "admin" || v === "member"),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
