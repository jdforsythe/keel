// @vitest-environment happy-dom
// k.testing, Properties "Every run records its seed; `KEEL_SEED=<n>` replays it."
// Seed: 1337.
import { properties } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CartView, SEED, addClamped } from "./fixtures.ts";

describe("k.testing: property runs record the seed", () => {
  it("the result of properties has seed and runs; an explicit seed is echoed back", async () => {
    const r = await properties(addClamped, { runs: 100, seed: SEED });
    expect(r).toMatchObject({ seed: SEED, runs: 100 });
  });

  it("for any seed and run count the result records exactly those", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 100000 }), fc.integer({ min: 1, max: 20 }), async (seed, runs) => {
        expect(await properties(addClamped, { runs, seed })).toMatchObject({ seed, runs });
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("without a seed option, a seed is still recorded as a number; runs defaults to 100", async () => {
    const r = await properties(addClamped);
    expect(typeof r.seed).toBe("number");
    expect(r.runs).toBe(100);
  });

  it("KEEL_SEED=<n> sets the recorded seed", async () => {
    const prev = process.env.KEEL_SEED;
    process.env.KEEL_SEED = "4021";
    try {
      expect(await properties(addClamped, { runs: 5 })).toMatchObject({ seed: 4021 });
    } finally {
      if (prev === undefined) Reflect.deleteProperty(process.env, "KEEL_SEED");
      else process.env.KEEL_SEED = prev;
    }
  });

  it("the same component properties record their seed too", async () => {
    expect(await properties(CartView, { runs: 10, seed: SEED })).toMatchObject({ seed: SEED, runs: 10 });
  });
});
