// Spec: k.ledger, clause "An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`."
// Seed: 1337.
import { ledger } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures.ts";
import { exampleEv, propEv } from "./ledger-fixtures.ts";

describe("k.ledger: an export tested only by examples is example; adding a passing 100-run property makes it probabilistic", () => {
  it("examples only gives rung example, for any number of examples", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        const [r] = ledger([{ item: "a.ts#f", evidence: Array.from({ length: n }, () => exampleEv) }]);
        expect(r?.rung).toBe("example");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("adding a passing 100-run property raises the rung to probabilistic, and evidence lists runs and seed", () => {
    const [r] = ledger([{ item: "a.ts#f", evidence: [exampleEv, propEv] }]);
    expect(r?.rung).toBe("probabilistic");
    const ev = JSON.stringify(r?.evidence);
    expect(ev).toContain("100");
    expect(ev).toContain("1337");
  });

  it("a passing property with fewer than 100 runs does not make the item probabilistic", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99 }), (runs) => {
        const [r] = ledger([
          { item: "a.ts#f", evidence: [exampleEv, { kind: "property", passed: true, runs, seed: 1 }] },
        ]);
        expect(r?.rung).toBe("example");
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("a property with 100 or more runs is probabilistic", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 5000 }), (runs) => {
        const [r] = ledger([{ item: "a.ts#f", evidence: [{ kind: "property", passed: true, runs, seed: 1 }] }]);
        expect(r?.rung).toBe("probabilistic");
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("only proof evidence may claim proven: no example or property evidence yields it", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (runs) => {
        const [r] = ledger([
          { item: "a.ts#f", evidence: [exampleEv, { kind: "property", passed: true, runs, seed: 1 }] },
        ]);
        expect(r?.rung).not.toBe("proven");
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
