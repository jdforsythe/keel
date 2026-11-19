// Seed 1337
import { explain } from "@keel/check/explain";
import fc from "fast-check";
import { expect, test } from "vitest";
import { specCodes } from "./spec-codes.ts";
import { SEED, approxTokens } from "./support.ts";

const SPEC_CODES: string[] = specCodes();

// The code list is read from the Rules paragraphs of spec/kernel/*.md at test time (RFC 0020).
test("explain(code) returns a non-empty string for every E code named in the kernel Rules", () => {
  for (const code of SPEC_CODES) {
    const text = explain(code);
    expect(typeof text, code).toBe("string");
    expect(text.trim().length, code).toBeGreaterThan(0);
  }
});

test("explain(code) prints at most 120 tokens (chars/4) for every kernel E code", () => {
  fc.assert(
    fc.property(fc.constantFrom(...SPEC_CODES), (code) => {
      expect(approxTokens(explain(code)), code).toBeLessThanOrEqual(120);
    }),
    { seed: SEED, numRuns: SPEC_CODES.length * 2 },
  );
});

test("explain(code) names the code it explains", () => {
  fc.assert(
    fc.property(fc.constantFrom(...SPEC_CODES), (code) => {
      expect(explain(code)).toContain(code);
    }),
    { seed: SEED, numRuns: 60 },
  );
});
