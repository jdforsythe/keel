import { invariant } from "@keel/store";
import fc from "fast-check";
// k.store (ADR-0003 named transactions) invariant(store, fn): checked after every tx; violation -> err store.invariant + rollback. Seed 1337.
import { describe, expect, it } from "vitest";
import { applyOp, inScope, makeCart, opArb, opts } from "./fixtures";

describe("k.store: invariants", () => {
  it("A violated invariant returns err store.invariant and rolls back state and log", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 20 }), (ops) => {
        const k = makeCart();
        inScope(() => invariant(k.cart, (st) => st.items.length <= 3));
        for (const op of ops) {
          const before = JSON.stringify([k.cart.snapshot(), k.cart.log()]);
          const r = applyOp(k, op);
          if (!r.ok) {
            expect(r.error.code).toBe("store.invariant");
            expect(JSON.stringify([k.cart.snapshot(), k.cart.log()])).toBe(before);
          }
          expect(k.cart.get("items").length).toBeLessThanOrEqual(3);
        }
      }),
      opts,
    );
  });

  it("An invariant is checked after every tx: satisfying transactions commit", () => {
    const k = makeCart();
    inScope(() => invariant(k.cart, (st) => st.items.length <= 1));
    expect(applyOp(k, { kind: "add", item: { sku: "a", qty: 1 } }).ok).toBe(true);
    const r = applyOp(k, { kind: "add", item: { sku: "b", qty: 1 } });
    expect(r.ok).toBe(false);
    expect(k.cart.log().length).toBe(1);
  });
});
