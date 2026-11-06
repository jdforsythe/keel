// Spec: k.store Conformance, "snapshot round-trips through JSON". Seed 1337.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { applyOp, makeCart, opArb, opts } from "./fixtures";

describe("k.store: snapshot", () => {
  it("Snapshot round-trips through JSON: restore(JSON.parse(JSON.stringify(snapshot()))) yields equal state and log", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 20 }), (ops) => {
        const src = makeCart();
        for (const op of ops) applyOp(src, op);
        const wire = JSON.parse(JSON.stringify(src.cart.snapshot()));
        const dst = makeCart();
        dst.cart.restore(wire);
        expect(dst.cart.snapshot().state).toEqual(src.cart.snapshot().state);
        expect(dst.cart.log()).toEqual(src.cart.log());
        expect(dst.cart.snapshot()).toEqual(src.cart.snapshot());
      }),
      opts,
    );
  });

  it("Snapshot round-trips through JSON: a restored store continues to accept transactions", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 10 }), opArb, (ops, next) => {
        const src = makeCart();
        for (const op of ops) applyOp(src, op);
        const dst = makeCart();
        dst.cart.restore(JSON.parse(JSON.stringify(src.cart.snapshot())));
        applyOp(src, next);
        applyOp(dst, next);
        expect(dst.cart.snapshot().state).toEqual(src.cart.snapshot().state);
      }),
      opts,
    );
  });
});
