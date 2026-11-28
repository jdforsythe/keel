// k.formats, clause "`parse` runs `base`, then `check`; false fails with rule `format` at that path." (rfc:0079)
// Seed 1337.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

describe("k.schema format types: parse order", () => {
  test("`parse` runs `base` first: a value `base` refuses fails with base's rule and `check` is not called", () => {
    let calls = 0;
    const Small = s.format("small", s.int({ min: 0, max: 9 }), {
      check: () => {
        calls += 1;
        return true;
      },
      gen: { from: s.int({ min: 0, max: 9 }), map: (x) => x },
    });
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 1000 }), (n) => {
        calls = 0;
        const r = Small.parse(n);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.data.issues).toEqual([{ path: [], rule: "max" }]);
        expect(calls).toBe(0);
        const wrongType = Small.parse(String(n));
        expect(wrongType.ok).toBe(false);
        if (!wrongType.ok) expect(wrongType.error.data.issues.map((i) => i.rule)).toEqual(["type"]);
        expect(calls).toBe(0);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  test("`check` runs on a value `base` accepts, and a refusal is the single issue `format`", () => {
    const Even = s.format("even", s.int(), {
      check: (v) => v % 2 === 0,
      gen: { from: s.int({ min: -50, max: 50 }), map: (n) => n * 2 },
    });
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (n) => {
        const r = Even.parse(n);
        expect(r.ok).toBe(n % 2 === 0);
        if (!r.ok) expect(r.error.data.issues).toEqual([{ path: [], rule: "format" }]);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
