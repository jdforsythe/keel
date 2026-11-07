// @vitest-environment happy-dom
// Spec: k.testing, Harness "`state(store)` is that store's value; `state()` is every store keyed by store id."
// Seed: 1337.
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CartView, SEED, cart, simCtx } from "./fixtures.ts";

describe("k.testing: state() returns stores keyed by store id and state(store) one store's value", () => {
  it("state(store) is the store's value, parsed from the initial [store, value] pair", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ id: fc.string(), qty: fc.integer() }), { maxLength: 5 }), (items) => {
        const t = render(CartView, { props: { compact: false }, state: [[cart, { items }]], ctx: simCtx() });
        expect(t.state(cart)).toEqual({ items });
        t.dispose();
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("state() is keyed by store id and each entry equals state(store)", () => {
    const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx() });
    expect(Object.keys(t.state())).toContain("cart.cart");
    expect(t.state()).toMatchObject({ "cart.cart": t.state(cart) });
    t.dispose();
  });

  it("state(store) follows transactions fired through the harness", async () => {
    const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx() });
    await t.fire("cart.add", { type: "click" });
    expect(t.state(cart).items).toHaveLength(1);
    t.dispose();
  });

  it("an initial state value failing the store schema rejects with schema.invalid", () => {
    const attempt = () =>
      render(CartView, { props: { compact: false }, state: [[cart, { items: [{ id: 1, qty: "x" }] }]], ctx: simCtx() });
    expect(attempt).toThrow(/schema\.invalid/);
  });
});
