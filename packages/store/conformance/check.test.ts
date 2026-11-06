// Spec: k.store Conformance "`check(state)` returns ok iff every invariant holds and never changes state or log" (rfc:0011). Seed 1337.
import { invariant, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Item, inScope, itemArb, makeCart, opts } from "./fixtures";

describe("k.store: check(state)", () => {
  it("returns ok iff every declared invariant holds for the candidate", () => {
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 6 }), fc.integer({ min: 0, max: 4 }), (items: Item[], limit) => {
        const k = makeCart();
        inScope(() => {
          invariant(k.cart, (st) => st.items.length <= limit);
          invariant(k.cart, (st) => st.items.every((i) => i.qty >= -500));
        });
        const holds = items.length <= limit && items.every((i) => i.qty >= -500);
        const r = k.cart.check({ items });
        expect(r.ok).toBe(holds);
        if (!r.ok) expect(r.error.code).toBe("store.invariant");
      }),
      opts,
    );
  });

  it("is ok for every schema-valid state when no invariant is declared", () => {
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 6 }), (items: Item[]) => {
        expect(makeCart().cart.check({ items }).ok).toBe(true);
      }),
      opts,
    );
  });

  it("returns store.invariant for a candidate the schema rejects", () => {
    const k = makeCart();
    const r = k.cart.check({ items: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("store.invariant");
  });

  it("never changes state or log, and never runs a transaction", () => {
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 4 }), fc.array(itemArb, { maxLength: 6 }), (seed, candidate) => {
        const k = makeCart();
        inScope(() => invariant(k.cart, (st) => st.items.length <= 3));
        for (const item of seed.slice(0, 3)) tx(k.add, { item });
        const before = JSON.stringify([k.cart.snapshot(), k.cart.log()]);
        k.cart.check({ items: candidate });
        expect(JSON.stringify([k.cart.snapshot(), k.cart.log()])).toBe(before);
      }),
      opts,
    );
  });

  it("is deterministic for equal candidates", () => {
    const k = makeCart();
    inScope(() => invariant(k.cart, (st) => st.items.length <= 1));
    const two = {
      items: [
        { sku: "a", qty: 1 },
        { sku: "b", qty: 2 },
      ],
    };
    expect(k.cart.check(two).ok).toBe(false);
    expect(k.cart.check(two).ok).toBe(false);
    expect(k.cart.check({ items: [] }).ok).toBe(true);
  });
});
