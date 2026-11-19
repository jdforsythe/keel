// Seed 1337. `CredentialsConfig` accepts `ln` as an integer 17 to 20 or no `ln`, and refuses every other value and key.
import { CredentialsConfig } from "@keel/std-credentials";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;

test("ln parses exactly when it is an integer from 17 to 20", () => {
  fc.assert(
    fc.property(fc.oneof(fc.integer({ min: -5, max: 40 }), fc.double({ noNaN: true, min: 10, max: 30 })), (ln) => {
      expect(CredentialsConfig.parse({ ln }).ok).toBe(Number.isInteger(ln) && ln >= 17 && ln <= 20);
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("no ln parses, and any other key is refused", () => {
  expect(CredentialsConfig.parse({}).ok).toBe(true);
  fc.assert(
    fc.property(fc.stringMatching(/^[a-km-z][a-z]{0,7}$/), (key) => {
      expect(CredentialsConfig.parse({ ln: 17, [key]: 8 }).ok).toBe(false);
    }),
    { seed: SEED, numRuns: 50 },
  );
});
