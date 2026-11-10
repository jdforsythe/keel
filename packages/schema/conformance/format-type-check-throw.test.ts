// Spec: k.schema, clause "`s.format(name, base, { check, gen: { from, map } })` narrows `base` by a pure `check(v): boolean` (a throw is false)" (rfc:0079)
// Seed 1337.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

describe("k.schema format types: check", () => {
  test.skip("a `check` that throws is false: parse fails with rule `format` and never throws", () => {
    const Boom = s.format("boom", s.string(), {
      check: () => {
        throw new Error("check blew up");
      },
      gen: { from: s.string(), map: (x) => x },
    });
    fc.assert(
      fc.property(fc.string(), (v) => {
        let r: ReturnType<typeof Boom.parse> | undefined;
        expect(() => {
          r = Boom.parse(v);
        }).not.toThrow();
        expect(r?.ok).toBe(false);
        if (r !== undefined && !r.ok) expect(r.error.data.issues).toEqual([{ path: [], rule: "format" }]);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  test.skip("`check` narrows `base`: a value is accepted exactly when `base` accepts it and `check` returns true", () => {
    const Short = s.format("short", s.string({ min: 1 }), {
      check: (v) => v.length <= 3,
      gen: { from: s.string({ min: 1, max: 3 }), map: (x) => x },
    });
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.constant(null)), (v) => {
        const expected = typeof v === "string" && v.length >= 1 && v.length <= 3;
        expect(Short.parse(v).ok).toBe(expected);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
