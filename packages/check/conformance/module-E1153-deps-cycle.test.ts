// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { codesOf, has, lowerId, manifestFile, SEED } from "./module-support.ts";

const ids2 = fc.tuple(lowerId, lowerId).filter(([a, b]) => a !== b);
const ids3 = fc.tuple(lowerId, lowerId, lowerId).filter(([a, b, c]) => a !== b && b !== c && a !== c);

test("modules a and b that list each other in deps produce one E1153 naming both", () => {
  fc.assert(
    fc.property(ids2, ([a, b]) => {
      const d = codesOf([manifestFile({ id: a, deps: [b] }), manifestFile({ id: b, deps: [a] })], "E1153");
      expect(d.length).toBe(1);
      expect(d[0]?.message).toContain(a);
      expect(d[0]?.message).toContain(b);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1153: a three-module cycle produces one E1153 whose message lists the cycle", () => {
  fc.assert(
    fc.property(ids3, ([a, b, c]) => {
      const d = codesOf(
        [manifestFile({ id: a, deps: [b] }), manifestFile({ id: b, deps: [c] }), manifestFile({ id: c, deps: [a] })],
        "E1153",
      );
      expect(d.length).toBe(1);
      for (const id of [a, b, c]) expect(d[0]?.message).toContain(id);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1153: an acyclic deps chain reports nothing", () => {
  fc.assert(
    fc.property(ids3, ([a, b, c]) => {
      const files = [
        manifestFile({ id: a, deps: [b, c] }),
        manifestFile({ id: b, deps: [c] }),
        manifestFile({ id: c }),
      ];
      expect(has(files, "E1153")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
