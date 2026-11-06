// Spec: k.store Conformance, "Transactions are deterministic for equal inputs". Seed 1337.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { applyOp, makeCart, opArb, opts } from "./fixtures";

// E1302 (transaction purity: no ctx/global access) is a static checker rule; untestable at runtime here.

describe("k.store: determinism", () => {
  it("Transactions are deterministic for equal inputs: same state and payload give deep-equal results across stores", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 15 }), opArb, (prefix, op) => {
        const a = makeCart();
        const b = makeCart();
        for (const p of prefix) {
          applyOp(a, p);
          applyOp(b, p);
        }
        expect(a.cart.snapshot().state).toEqual(b.cart.snapshot().state);
        const ra = applyOp(a, op);
        const rb = applyOp(b, op);
        expect(ra.ok).toBe(rb.ok);
        expect(a.cart.snapshot().state).toEqual(b.cart.snapshot().state);
      }),
      opts,
    );
  });

  it("Transactions are deterministic for equal inputs: repeating from a restored state repeats the result", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 15 }), opArb, (prefix, op) => {
        const k = makeCart();
        for (const p of prefix) applyOp(k, p);
        const before = JSON.parse(JSON.stringify(k.cart.snapshot()));
        applyOp(k, op);
        const first = k.cart.snapshot().state;
        k.cart.restore(before);
        applyOp(k, op);
        expect(k.cart.snapshot().state).toEqual(first);
      }),
      opts,
    );
  });
});
