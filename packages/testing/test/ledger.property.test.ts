// Spec: k.testing Ledger and docs/TESTING.md rungs. Property seed: 1337.
import { type Evidence, ledger, ledgerDiff } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const ORDER = ["none", "monitored", "example", "probabilistic", "exhaustive", "proven"];
const rank = (r: string): number => ORDER.indexOf(r);
const rungOf = (evidence: readonly Evidence[]): string => ledger([{ item: "a.ts#f", evidence }])[0]?.rung ?? "?";

const ev: fc.Arbitrary<Evidence> = fc.oneof(
  fc.record({ kind: fc.constant("example" as const), passed: fc.boolean() }),
  fc.record({
    kind: fc.constant("property" as const),
    passed: fc.boolean(),
    runs: fc.integer({ min: 1, max: 300 }),
    seed: fc.integer(),
  }),
  fc.record({ kind: fc.constantFrom("exhaustive" as const, "proven" as const), passed: fc.boolean() }),
);

describe("ledger rungs are monotone in evidence", () => {
  it("adding evidence never lowers the rung; adding failing evidence never changes it", () => {
    fc.assert(
      fc.property(fc.array(ev, { maxLength: 6 }), ev, (base, extra) => {
        const before = rungOf(base);
        const after = rungOf([...base, extra]);
        expect(rank(after)).toBeGreaterThanOrEqual(rank(before));
        if (!extra.passed) expect(after).toBe(before);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("the rung is independent of evidence order", () => {
    fc.assert(
      fc.property(fc.array(ev, { maxLength: 6 }), (list) => {
        expect(rungOf([...list].reverse())).toBe(rungOf(list));
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("evidence lists exactly the passing entries, or none", () => {
    fc.assert(
      fc.property(fc.array(ev, { maxLength: 6 }), (list) => {
        const [r] = ledger([{ item: "a.ts#f", evidence: list }]);
        const passing = list.filter((e) => e.passed);
        expect(r?.evidence).toEqual(passing.length === 0 ? "none" : passing);
        expect(r?.rung === "none").toBe(passing.length === 0);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("ledgerDiff of a ledger against itself after adding evidence is empty", () => {
    fc.assert(
      fc.property(fc.array(fc.array(ev, { maxLength: 4 }), { maxLength: 5 }), ev, (lists, extra) => {
        const items = lists.map((evidence, i) => ({ item: `f${i}.ts#x`, evidence }));
        const raised = items.map((x) => ({ ...x, evidence: [...x.evidence, extra] }));
        expect(ledgerDiff(ledger(items), ledger(raised))).toEqual([]);
        expect(ledgerDiff(ledger(raised), ledger(items)).every((d) => d.code === "E1706")).toBe(true);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
