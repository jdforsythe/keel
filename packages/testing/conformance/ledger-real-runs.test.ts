// @vitest-environment happy-dom
// Spec: k.testing, clause "An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`."
// Seed: 1337.
// Evidence comes from real runs: an example is a test body that actually executed its assertion; the property is the
// harness's own `properties()` run, whose `{ seed, runs }` result feeds the ledger. No hand-written evidence.
import { type Evidence, ledger, properties } from "@keel/testing";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Button, SEED, addClamped, addItem } from "./fixtures.ts";
import { simCtx } from "./fixtures.ts";

/** Runs `body`; a body that returns is a passing example, a body that throws a failing one. */
const example = (body: () => void): Evidence => {
  try {
    body();
    return { kind: "example", passed: true };
  } catch {
    return { kind: "example", passed: false };
  }
};

/** A real property run of `fn`: `runs` cases with the given seed; passes when no case throws. */
const property = (runs: number, seed: number, fn: (n: number) => void): Evidence => {
  const out = fc.check(
    fc.property(fc.integer(), (n) => {
      fn(n);
    }),
    { numRuns: runs, seed },
  );
  return { kind: "property", passed: !out.failed, runs: out.numRuns, seed };
};

describe("k.testing: rung promotion from real test runs", () => {
  it("an export whose only passing run is an example is example", () => {
    const run = example(() => {
      const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
      expect(t.find("save").name).toBe("Save");
      t.dispose();
    });
    expect(run).toEqual({ kind: "example", passed: true });
    expect(ledger([{ item: "Button.ts#Button", evidence: [run] }])[0]?.rung).toBe("example");
  });

  it("a real failing example earns nothing: the item stays none", () => {
    const run = example(() => expect(1).toBe(2));
    expect(ledger([{ item: "Button.ts#Button", evidence: [run] }])[0]).toMatchObject({
      rung: "none",
      evidence: "none",
    });
  });

  it("adding a passing 100-run harness property raises the rung to probabilistic, and evidence lists runs and seed", async () => {
    const ex = example(() => expect(addItem.name).toBeDefined());
    const before = ledger([{ item: "cart.ts#addClamped", evidence: [ex] }])[0];
    expect(before?.rung).toBe("example");
    const result = await properties(addClamped, { runs: 100, seed: SEED });
    expect(result).toEqual({ seed: SEED, runs: 100 });
    const ev: Evidence = { kind: "property", passed: true, ...result };
    const after = ledger([{ item: "cart.ts#addClamped", evidence: [ex, ev] }])[0];
    expect(after?.rung).toBe("probabilistic");
    expect(after?.evidence).toContainEqual({ kind: "property", passed: true, runs: 100, seed: SEED });
  });

  it("the promotion threshold is the run count of the real run: 99 runs stay example, 100 promote", () => {
    const ex = example(() => undefined);
    const rung = (runs: number) =>
      ledger([{ item: "a.ts#f", evidence: [ex, property(runs, SEED, () => undefined)] }])[0]?.rung;
    expect(rung(99)).toBe("example");
    expect(rung(100)).toBe("probabilistic");
    expect(rung(250)).toBe("probabilistic");
  });

  it("a real property that fails does not promote", () => {
    const ex = example(() => undefined);
    const bad = property(100, SEED, (n) => expect(n).toBe(0));
    expect(bad.passed).toBe(false);
    expect(ledger([{ item: "a.ts#f", evidence: [ex, bad] }])[0]?.rung).toBe("example");
  });
});
