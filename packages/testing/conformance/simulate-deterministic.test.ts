// @vitest-environment happy-dom
// Spec: k.sim, clause "Two `simulate` runs with one seed pass the same `SimRun`s to the scenario in the same order."
// Seed: 1337.
import { simulate } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures.ts";

async function collect(seed: number, runs: number) {
  const seen: { seed: number; schedule: unknown }[] = [];
  await simulate(
    async ({ seed: runSeed, schedule, run }) => {
      seen.push({ seed: runSeed, schedule });
      await run();
    },
    { runs, seed, law: false },
  );
  return seen;
}

describe("k.sim: simulate is deterministic by seed", () => {
  it("two `simulate` runs with one seed pass the same `SimRun`s to the scenario in the same order", async () => {
    const a = await collect(SEED, 30);
    const b = await collect(SEED, 30);
    expect(a).toHaveLength(30);
    expect(b).toEqual(a);
  });

  it("property: for any seed and run count, two `simulate` runs pass equal `SimRun` sequences", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 100000 }), fc.integer({ min: 1, max: 15 }), async (seed, runs) => {
        expect(await collect(seed, runs)).toEqual(await collect(seed, runs));
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("different seeds pass different `SimRun` sequences", async () => {
    expect(await collect(1, 30)).not.toEqual(await collect(2, 30));
  });

  it("the `SimRun` passed to the scenario round-trips through JSON", async () => {
    const seen = await collect(SEED, 10);
    expect(JSON.parse(JSON.stringify(seen))).toEqual(seen);
  });
});
