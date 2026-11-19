// Seed 1337. Every value of `Digested`'s generator parses, is the sim form, and reads as such.
import { gen } from "@keel/schema/gen";
import { Digested } from "@keel/std-tokens";
import fc from "fast-check";
import { expect, test } from "vitest";
import { readDigested } from "../src/server/internal/readDigested.ts";

const SEED = 1337;

test("every generated Digested parses and reads as a sim form", () => {
  fc.assert(
    fc.property(gen(Digested), (v) => {
      expect(Digested.parse(v).ok).toBe(true);
      expect(v).toMatch(/^\$sha256-sim\$[A-Za-z0-9+/]{43}$/);
      const parts = readDigested(v);
      expect(typeof parts === "object" && parts.sim).toBe(true);
    }),
    { seed: SEED, numRuns: 300 },
  );
});
