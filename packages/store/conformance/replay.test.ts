import { tx } from "@keel/store";
import fc from "fast-check";
// Spec: k.store Conformance, "log replay reproduces state". Seed 1337.
import { describe, expect, it } from "vitest";
import { applyOp, makeCart, opArb, opts } from "./fixtures";

describe("k.store: log replay", () => {
  it("Log replay reproduces state: replaying the log into a fresh store yields deep-equal state", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 25 }), (ops) => {
        const src = makeCart();
        for (const op of ops) applyOp(src, op);
        const fresh = makeCart();
        const byName = { [fresh.add.name]: fresh.add, [fresh.pop.name]: fresh.pop, [fresh.clear.name]: fresh.clear };
        for (const entry of src.cart.log()) {
          const t = byName[entry.name];
          if (t === undefined) throw new Error(`unknown transaction ${entry.name}`);
          const r = tx(t, entry.payload);
          expect(r.ok).toBe(true);
        }
        expect(fresh.cart.snapshot().state).toEqual(src.cart.snapshot().state);
        expect(fresh.cart.log().map((e) => [e.name, e.payload])).toEqual(
          src.cart.log().map((e) => [e.name, e.payload]),
        );
      }),
      opts,
    );
  });
});
