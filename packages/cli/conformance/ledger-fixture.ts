// Fixture sources for the `keel ledger` conformance tests: one package `m` with one export, `clamp`. Not a test file.
// Item key (k.ledger Ledger `<file>#<name>`): `packages/m/src/clamp.ts#clamp`. Property seed: 1337.

export const ITEM = "packages/m/src/clamp.ts#clamp";
export const SOURCE = "packages/m/src/clamp.ts";
export const EXAMPLE = "packages/m/test/clamp.test.ts";
export const PROPERTY = "packages/m/test/clamp-property.test.ts";
export const UNSAFE = "packages/m/unsafe/raw.ts";

export const source = `export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
`;

export const exampleTest = `import { expect, it } from "vitest";
import { clamp } from "../src/clamp.ts";

it("clamps a value above the range to its top", () => {
  expect(clamp(9, 0, 5)).toBe(5);
});
`;

/** A property over \`clamp\`; \`options\` is the fast-check parameters object as written in the test. */
export const propertyTest = (options: string): string => `import fc from "fast-check";
import { expect, it } from "vitest";
import { clamp } from "../src/clamp.ts";

it("clamp stays inside [lo, hi]", () => {
  fc.assert(
    fc.property(fc.integer(), fc.integer({ min: -50, max: 0 }), fc.integer({ min: 0, max: 50 }), (n, lo, hi) => {
      const v = clamp(n, lo, hi);
      expect(v >= lo && v <= hi).toBe(true);
    }),
    ${options},
  );
});
`;

export const SEEDED_100 = "{ numRuns: 100, seed: 1337 }";

/** One counted \`unsafe\` use; \`typed\` writes the explicit type-argument form \`unsafe<number>(...)\`. */
export const unsafeSource = (typed: boolean): string => `declare function unsafe<T>(why: string, fn: () => T): T;
export const raw = unsafe${typed ? "<number>" : ""}("fixture: one counted unsafe call", () => 1);
`;
