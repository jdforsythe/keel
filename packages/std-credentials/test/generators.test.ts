// Seed 1337. Every value of `Hashed`'s and `Digested`'s generators parses, is the sim form, and reads as such.
import { gen } from "@keel/schema/gen";
import { Digested, Hashed } from "@keel/std-credentials";
import fc from "fast-check";
import { expect, test } from "vitest";
import { readDigested } from "../src/server/internal/readDigested.ts";
import { readHashed } from "../src/server/internal/readHashed.ts";

const SEED = 1337;

test("every generated Hashed parses and reads as a sim form", () => {
  fc.assert(
    fc.property(gen(Hashed), (v) => {
      expect(Hashed.parse(v).ok).toBe(true);
      expect(v).toMatch(/^\$scrypt-sim\$ln=17,r=8,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
      const parts = readHashed(v);
      expect(typeof parts === "object" && parts.id === "scrypt-sim" && parts.exact).toBe(true);
    }),
    { seed: SEED, numRuns: 300 },
  );
});

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
