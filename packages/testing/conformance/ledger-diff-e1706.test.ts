// Spec: k.ledger, clause "Lowering an item's rung below the committed ledger makes `keel ledger --diff` report E1706."
// Seed: 1337.
import { ledgerDiff } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf } from "./fixtures.ts";
import { RUNGS } from "./ledger-fixtures.ts";

const rec = (item: string, rung: string) => ({ kind: "ledger", item, rung, evidence: rung === "none" ? "none" : "x" });
const rungArb = fc.constantFrom(...RUNGS);

describe("k.ledger: lowering an item's rung below the committed ledger makes ledger --diff report E1706", () => {
  it("probabilistic -> example reports exactly one E1706 for that item", () => {
    const out = ledgerDiff([rec("a.ts#f", "probabilistic")], [rec("a.ts#f", "example")]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ code: "E1706" });
    expect(JSON.stringify(out[0])).toContain("a.ts#f");
  });

  it("for any pair of rungs, E1706 is reported iff after is strictly lower than before", () => {
    fc.assert(
      fc.property(rungArb, rungArb, (before, after) => {
        const out = ledgerDiff([rec("a.ts#f", before)], [rec("a.ts#f", after)]);
        const lowered = RUNGS.indexOf(after) < RUNGS.indexOf(before);
        expect(out.filter((d) => d.code === "E1706")).toHaveLength(lowered ? 1 : 0);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("identical ledgers report nothing; ledgerDiff is pure (same inputs, equal outputs)", () => {
    fc.assert(
      fc.property(fc.array(rungArb, { maxLength: 6 }), (rungs) => {
        const l = rungs.map((r, i) => rec(`f${i}.ts#x`, r));
        expect(ledgerDiff(l, l)).toEqual([]);
        const after = rungs.map((_, i) => rec(`f${i}.ts#x`, "none"));
        expect(ledgerDiff(l, after)).toEqual(ledgerDiff(l, after));
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("items new in after, or raised, are not reported", () => {
    expect(ledgerDiff([rec("a.ts#f", "example")], [rec("a.ts#f", "probabilistic"), rec("b.ts#g", "none")])).toEqual([]);
  });

  it("each entry carries code E1706", () => {
    const out = ledgerDiff(
      [rec("a.ts#f", "proven"), rec("b.ts#g", "example")],
      [rec("a.ts#f", "none"), rec("b.ts#g", "none")],
    );
    expect(out).toHaveLength(2);
    for (const d of out) expect(codeOf(d) ?? d.code).toBe("E1706");
  });
});
