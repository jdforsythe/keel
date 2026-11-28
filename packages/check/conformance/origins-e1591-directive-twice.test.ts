// rfc:0160 conformance: `img` written twice in one `origins` is one E1591 at the second.
// k.origins, Rules "E1591 one origin twice in one directive (fix: delete the second entry). So is a directive twice; the first is read."
// Seed 1337 (fc.assert below).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, single, withCode } from "./origins-support.ts";

const TWICE = (a: string, b: string, key = "img") =>
  `{\n    ${key}: { '${a}': 'r' },\n    ${key}: { '${b}': 'r' },\n  }`;
// topology.ts: line 1 import, 2 `export default topology({`, 3 `  web: { ... origins: {`, 4 first key, 5 second key.
const SECOND_LINE = 5;

describe("rfc:0160 conformance: a directive twice", () => {
  test("rfc:0160 conformance: `img` written twice in one `origins` is one E1591 at the second", () => {
    const found = withCode(single(TWICE("https://a.example", "https://b.example")), "E1591");
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(SECOND_LINE);
  });
  test("rfc:0160 conformance: any directive written twice is one E1591 at the second, and no E1590 for it", () => {
    fc.assert(
      fc.property(fc.constantFrom("img", "media", "font", "connect", "frame"), (k) => {
        const files = single(TWICE("https://a.example", "https://b.example", k));
        const found = withCode(files, "E1591");
        expect(found).toHaveLength(1);
        expect(found[0]?.line).toBe(SECOND_LINE);
        expect(withCode(files, "E1590")).toEqual([]);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
