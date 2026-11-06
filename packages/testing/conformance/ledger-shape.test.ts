// Spec: k.testing, "keel ledger emits one record { item, rung, evidence } per public export and per spec clause." Seed: 1337.
import { ledger } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures.ts";
import { type Ev, exampleEv, propEv } from "./ledger-fixtures.ts";

const evArb: fc.Arbitrary<Ev> = fc.oneof(
  fc.constant<Ev>({ kind: "example", passed: true }),
  fc.constant<Ev>({ kind: "example", passed: false }),
  fc.record({
    kind: fc.constant("property" as const),
    passed: fc.boolean(),
    runs: fc.integer({ min: 1, max: 500 }),
    seed: fc.integer(),
  }),
);

describe("k.testing: ledger(items) output has the shape { item, rung, evidence }", () => {
  it("one output record per input item, in order, each with item, rung, and evidence", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{1,8}\.ts#[a-z]{1,8}$/), { maxLength: 8 }),
        fc.array(fc.array(evArb, { maxLength: 3 }), { minLength: 8, maxLength: 8 }),
        (names, evs) => {
          const out = ledger(names.map((item, i) => ({ item, evidence: evs[i] ?? [] })));
          expect(out.map((r) => r.item)).toEqual(names);
          for (const r of out) {
            expect(r).toHaveProperty("rung");
            expect(r).toHaveProperty("evidence");
          }
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("an item with no evidence has evidence none", () => {
    const [r] = ledger([{ item: "a.ts#f", evidence: [] }]);
    expect(r).toMatchObject({ item: "a.ts#f", rung: "none", evidence: "none" });
  });

  it("an item with a passing example has rung example and non-empty evidence", () => {
    const [r] = ledger([{ item: "a.ts#f", evidence: [exampleEv] }]);
    expect(r?.rung).toBe("example");
    expect(r?.evidence).not.toBe("none");
  });

  it("a failing test never raises the rung", () => {
    const [r] = ledger([
      {
        item: "a.ts#f",
        evidence: [
          { kind: "example", passed: false },
          { ...propEv, passed: false },
        ],
      },
    ]);
    expect(r?.rung).toBe("none");
  });
});
