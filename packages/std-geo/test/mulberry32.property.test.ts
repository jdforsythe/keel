// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { mulberry32 } from "../src/internal/mulberry32.ts";

const SEED = 1337;

test("mulberry32 is deterministic by seed and stays in [0, 1)", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
      const a = mulberry32(seed);
      const b = mulberry32(seed);
      for (let i = 0; i < 8; i++) {
        const x = a();
        expect(x).toBe(b());
        expect(x >= 0 && x < 1).toBe(true);
      }
    }),
    { seed: SEED, numRuns: 100 },
  );
});
