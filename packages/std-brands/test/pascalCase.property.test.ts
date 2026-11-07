// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { pascalCase } from "../src/internal/pascalCase.ts";

const SEED = 1337;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;

test("pascalCase gives PascalCase for every letter-led word list joined by any separator", () => {
  const word = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);
  fc.assert(
    fc.property(fc.array(word, { minLength: 1, maxLength: 4 }), fc.constantFrom("_", "-", " ", "."), (words, sep) => {
      expect(pascalCase(words.join(sep))).toMatch(PASCAL);
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("pascalCase is the identity on PascalCase input without an uppercase run", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^(?:[A-Z][a-z0-9]{1,5}){1,4}$/), (b) => {
      expect(pascalCase(b)).toBe(b);
    }),
    { seed: SEED, numRuns: 100 },
  );
});
