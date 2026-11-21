// Spec: k.parity, clause "for a fixture format with `gen: { from: s.int(), map: (n) => n * 2 }` and an even `check`, `sampleFormat(node, () => 3)` is 6; with a `check` refusing every value, and for a non-format node, it is undefined."
// Seed: 1337.
import { s, sampleFormat } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

describe("rfc:0169 conformance: sampleFormat", () => {
  test("rfc:0169 conformance: a format with `gen: { from: s.int(), map: (n) => n * 2 }` and an even `check` gives 6 for `() => 3`", () => {
    const even = s.format("even", s.int(), {
      check: (v) => v % 2 === 0,
      gen: { from: s.int(), map: (n) => n * 2 },
    });
    expect(sampleFormat(even.node, () => 3)).toBe(6);
  });

  test("rfc:0169 conformance: for any sampled integer the result is double it (property)", () => {
    const even = s.format("even", s.int(), {
      check: (v) => v % 2 === 0,
      gen: { from: s.int(), map: (n) => n * 2 },
    });
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (n) => {
        expect(sampleFormat(even.node, () => n)).toBe(n * 2);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  test("rfc:0169 conformance: with a `check` refusing every value the result is undefined", () => {
    const never = s.format("never", s.int(), {
      check: () => false,
      gen: { from: s.int(), map: (n) => n * 2 },
    });
    expect(sampleFormat(never.node, () => 3)).toBeUndefined();
  });

  test("rfc:0169 conformance: for a non-format node the result is undefined", () => {
    expect(sampleFormat(s.int().node, () => 3)).toBeUndefined();
    expect(sampleFormat(s.string().node, () => "x")).toBeUndefined();
  });
});
