// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { tallyOf } from "../src/tallyOf.ts";

const SEED = 1337;

test("tallyOf does not depend on the order of its keys", () => {
  const keys = fc.array(fc.constantFrom("a", "b", "c", "", "dd"), { maxLength: 30 });
  fc.assert(
    fc.property(keys, fc.integer(), (ks, salt) => {
      const shuffled = [...ks].sort((x, y) => ((x.length * 31 + salt) % 7) - ((y.length * 31 + salt) % 7));
      expect(tallyOf("t", shuffled)).toEqual(tallyOf("t", ks));
    }),
    { seed: SEED, numRuns: 100 },
  );
});
