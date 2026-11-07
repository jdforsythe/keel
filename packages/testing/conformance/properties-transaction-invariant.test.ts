// @vitest-environment happy-dom
// Spec: k.testing, clause "A transaction breaking a declared invariant fails `properties()` with E1704."
// Seed: 1337.
import { properties } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { SEED, addAny, addClamped, addItem, codeOf, messageOf, thrown } from "./fixtures.ts";

describe("k.testing: a transaction breaking a declared invariant fails properties() with E1704", () => {
  it("properties(addAny) fails with E1704 naming the transaction's violated invariant", async () => {
    const e = await thrown(() => properties(addAny, { runs: 100, seed: SEED }));
    expect(codeOf(e)).toBe("E1704");
    expect(messageOf(e)).toContain("invariant");
  });

  it("the first violating payload is reported, and it has a negative qty", async () => {
    const msg = messageOf(await thrown(() => properties(addAny, { runs: 100, seed: SEED })));
    const line = msg.split("\n").find((l) => l.trim().startsWith("payload:"));
    expect(line).toBeDefined();
    expect(line).toMatch(/"qty":-\d+/);
  });

  it("a transaction that respects its invariant passes properties()", async () => {
    expect(await properties(addClamped, { runs: 100, seed: SEED })).toMatchObject({ runs: 100 });
  });

  it("a store with no declared invariant imposes none: properties(addItem) does not fail on invariants", async () => {
    expect(await properties(addItem, { runs: 100, seed: SEED })).toMatchObject({ runs: 100 });
  });
});
