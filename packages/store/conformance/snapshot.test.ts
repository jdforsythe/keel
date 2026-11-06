import fc from "fast-check";
// Spec: k.store Conformance, "snapshot round-trips through JSON". Seed 1337.
import { describe, expect, it } from "vitest";
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

describe("k.store: snapshot carries initial", () => {
  it("undo after restore from a store with a different initial is the exact inverse against the restored base", () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 10 }), (ops) => {
        const src = makeCart();
        for (const op of ops) applyOp(src, op);
        const dst = makeCart();
        dst.cart.restore(JSON.parse(JSON.stringify(src.cart.snapshot())));
        const expected = makeCart();
        for (const op of ops.slice(0, -1)) applyOp(expected, op);
        const logged = src.cart.log().length;
        expect(dst.cart.undo()).toBe(logged > 0);
        if (logged === ops.length) expect(dst.cart.snapshot().state).toEqual(expected.cart.snapshot().state);
      }),
      opts,
    );
  });

  it("snapshot() exposes the initial state", () => {
    const k = makeCart();
    expect(k.cart.snapshot().initial).toEqual({ items: [] });
  });
});
