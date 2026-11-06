// @vitest-environment happy-dom
// Spec: k.testing, clause "`render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering." Seed: 1337.
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Counted, SEED, bodyRuns, codeOf, simCtx, thrown } from "./fixtures.ts";

describe("k.testing: render with props that fail the Props schema rejects with schema.invalid before rendering", () => {
  it("render rejects with schema.invalid for any non-integer n, and the component body never runs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.string(), fc.double({ noInteger: true, noNaN: true }), fc.boolean()),
        async (bad) => {
          bodyRuns.n = 0;
          const e = await thrown(() => render(Counted, { props: { n: bad }, ctx: simCtx() }));
          expect(codeOf(e)).toBe("schema.invalid");
          expect(bodyRuns.n).toBe(0);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("render with valid props runs the component body exactly once", async () => {
    bodyRuns.n = 0;
    const t = render(Counted, { props: { n: 1 }, ctx: simCtx() });
    expect(bodyRuns.n).toBe(1);
    t.dispose();
  });
});
