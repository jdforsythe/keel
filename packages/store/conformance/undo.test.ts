import fc from "fast-check";
// Spec: k.store Conformance, "undo is exact inverse". Seed 1337.
import { describe, expect, it } from "vitest";
import { applyOp, makeCart, opArb, opts } from "./fixtures";

describe("k.store: undo", () => {
  it("Undo is exact inverse: apply N then undo once equals the state after N-1", () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 20 }), (ops) => {
        const k = makeCart();
        let beforeLast = k.cart.snapshot().state;
        for (const op of ops) {
          beforeLast = k.cart.snapshot().state;
          applyOp(k, op);
        }
        expect(k.cart.undo()).toBe(true);
        expect(k.cart.snapshot().state).toEqual(beforeLast);
        expect(k.cart.get("items")).toEqual(beforeLast.items);
      }),
      opts,
    );
  });

  it("Undo is exact inverse: undoing repeatedly returns to the initial state, then undo returns false", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 20 }), (ops) => {
        const k = makeCart();
        const initial = k.cart.snapshot().state;
        for (const op of ops) applyOp(k, op);
        const applied = k.cart.log().length;
        for (let i = 0; i < applied; i++) expect(k.cart.undo()).toBe(true);
        expect(k.cart.snapshot().state).toEqual(initial);
        expect(k.cart.undo()).toBe(false);
        expect(k.cart.snapshot().state).toEqual(initial);
      }),
      opts,
    );
  });

  it("Undo on a fresh store returns false and changes nothing", () => {
    const k = makeCart();
    const before = k.cart.snapshot();
    expect(k.cart.undo()).toBe(false);
    expect(k.cart.snapshot()).toEqual(before);
  });
});
