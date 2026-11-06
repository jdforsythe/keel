// @vitest-environment happy-dom
// Spec: k.testing, "Tests address elements by id only." and rule E1701. Seed: 1337.
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CartView, SEED, cart, codeOf, simCtx, thrown } from "./fixtures.ts";

const mountCart = () => render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx() });

describe("k.testing: fire(id, event) dispatches by element id only and a selector string is rejected with E1701", () => {
  it("fire by id dispatches the handler registered under that id", async () => {
    const t = mountCart();
    await t.fire("cart.add", { type: "click" });
    expect(t.state(cart).items).toHaveLength(1);
    t.dispose();
  });

  it("fire with #x, .y, or div rejects with E1701 and dispatches nothing", async () => {
    for (const sel of ["#cart.add", "#x", ".y", "div"]) {
      const t = mountCart();
      expect(codeOf(await thrown(() => t.fire(sel, { type: "click" })))).toBe("E1701");
      expect(t.state(cart).items).toHaveLength(0);
      t.dispose();
    }
  });

  it("any selector-shaped string (leading #, ., [, > or whitespace) rejects with E1701", async () => {
    const selector = fc
      .tuple(fc.constantFrom("#", ".", "[", "> ", "div ", "a>"), fc.stringMatching(/^[a-z]{1,6}$/))
      .map(([p, r]) => p + r);
    const t = mountCart();
    await fc.assert(
      fc.asyncProperty(selector, async (sel) => {
        expect(codeOf(await thrown(() => t.fire(sel, { type: "click" })))).toBe("E1701");
      }),
      { seed: SEED, numRuns: 50 },
    );
    t.dispose();
  });
});
