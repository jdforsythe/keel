// Spec: k.testing, Rules "E1706 ledger rung lower than committed, or unsafe count higher"
// Seed: 1337.
import { ledgerDiff } from "@keel/testing";
import { describe, expect, it } from "vitest";

describe("k.testing: E1706 ledger rung lower than committed", () => {
  it("E1706 is reported with the item and both rungs", () => {
    const rec = (rung: string) => ({ kind: "ledger", item: "a.ts#f", rung, evidence: "x" });
    const [d] = ledgerDiff([rec("exhaustive")], [rec("example")]);
    expect(d).toMatchObject({ code: "E1706" });
    const text = JSON.stringify(d);
    expect(text).toContain("a.ts#f");
    expect(text).toContain("exhaustive");
    expect(text).toContain("example");
  });
});
