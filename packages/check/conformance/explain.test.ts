// Seed 1337
// Codes hardcoded from the kernel sections' Rules lines (k.compiler, k.cli, k.ctx, k.module, k.forms, k.errors, k.reactive,
// k.scaffold, k.runtime, k.router, k.schema, k.services, k.server, k.testing, k.ui, k.check).
import { explain } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { approxTokens, SEED } from "./support.ts";

const range = (p: string, a: number, b: number): string[] =>
  Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`);

export const SPEC_CODES: string[] = [
  ...range("E", 1001, 1005),
  ...range("E", 1051, 1054),
  ...range("E", 1101, 1104),
  ...range("E", 1151, 1157),
  ...range("E", 1201, 1205),
  ...range("E", 1251, 1254),
  ...range("E", 1351, 1354),
  ...range("E", 1401, 1404),
  ...range("E", 1451, 1454),
  ...range("E", 1501, 1506),
  ...range("E", 1551, 1554),
  "E1601",
  ...range("E", 1651, 1653),
  ...range("E", 1701, 1706),
  ...range("E", 1751, 1756),
  ...range("E", 1801, 1807),
  ...range("E", 1901, 1904),
];

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
