// @vitest-environment happy-dom
// Spec: k.testing, clause "`fire` resolves only once every effect and resource it triggered has settled."
// Seed: 1337.
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CartView, SEED, cart, simCtx } from "./fixtures.ts";

describe("k.testing: fire resolves only after every effect and resource it triggered has settled", () => {
  it("after awaiting fire, the multi-tick effect work triggered by the click is visible", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (clicks) => {
        const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx() });
        for (let i = 1; i <= clicks; i++) {
          await t.fire("cart.add", { type: "click" });
          expect(t.find("cart.total").text).toBe(String(i));
          expect(t.find("settled").text).toBe(String(i));
        }
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("fire returns a promise", () => {
    const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx() });
    const p = t.fire("cart.add", { type: "click" });
    expect(p).toBeInstanceOf(Promise);
    return p.then(() => t.dispose());
  });
});
