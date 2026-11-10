// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { compareText } from "../src/compareText.ts";
import { graphemes } from "../src/graphemes.ts";
import { textCheck } from "../src/textCheck.ts";
import { truncate } from "../src/truncate.ts";

const SEED = 1337;
const LOCALES = ["de-DE", "en-GB", "en-US", "es-ES", "fr-FR", "it-IT", "ja-JP", "ko-KR", "nl-NL", "pt-BR", "zh-CN"];
const word = fc.fullUnicodeString({ maxLength: 8 });

test("compareText is transitive on generated triples for every locale", () => {
  fc.assert(
    fc.property(word, word, word, fc.constantFrom(...LOCALES), (a, b, c, l) => {
      const [x, y, z] = [a, b, c].sort((p, q) => compareText(p, q, l));
      if (x === undefined || y === undefined || z === undefined) throw new Error("three sorted values");
      expect(compareText(x, y, l)).toBeLessThanOrEqual(0);
      expect(compareText(y, z, l)).toBeLessThanOrEqual(0);
      expect(compareText(x, z, l)).toBeLessThanOrEqual(0);
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("compareText is reflexive: every string equals itself in every locale", () => {
  fc.assert(
    fc.property(word, fc.constantFrom(...LOCALES), (a, l) => {
      expect(compareText(a, a, l)).toBe(0);
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("truncate never exceeds max graphemes and is the identity at or under the bound", () => {
  fc.assert(
    fc.property(fc.fullUnicodeString({ maxLength: 60 }), fc.integer({ min: 1, max: 30 }), (v, max) => {
      const out = truncate(v, max);
      expect(graphemes(out)).toBeLessThanOrEqual(max);
      expect(out === v).toBe(graphemes(v) <= max);
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("truncate is idempotent", () => {
  fc.assert(
    fc.property(fc.fullUnicodeString({ maxLength: 60 }), fc.integer({ min: 1, max: 30 }), (v, max) => {
      expect(truncate(truncate(v, max), max)).toBe(truncate(v, max));
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("the para check accepts a superset of the line check for equal bounds", () => {
  const line = textCheck(0, 10, false);
  const para = textCheck(0, 10, true);
  fc.assert(
    fc.property(fc.fullUnicodeString({ maxLength: 12 }), (v) => {
      if (line(v)) expect(para(v)).toBe(true);
    }),
    { seed: SEED, numRuns: 100 },
  );
});
