// Spec: k.store API + Conformance "store.schema parses every state the store accepts and transaction.schema parses every payload tx accepts". Seed 1337.
import { tx } from "@keel/store";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Item, itemArb, makeCart, opts } from "./fixtures.ts";

describe("k.store: schema, id and store are exposed", () => {
  it("store.schema parses every state the store reaches and carries the id", () => {
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 6 }), (items: Item[]) => {
        const k = makeCart();
        for (const item of items) expect(tx(k.add, { item }).ok).toBe(true);
        const parsed = k.cart.schema.parse(k.cart.snapshot().state);
        expect(parsed.ok).toBe(true);
        expect(typeof k.cart.id).toBe("string");
      }),
      opts,
    );
  });

  it("transaction.schema parses every payload tx accepts, and rejects what tx rejects", () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const k = makeCart();
        const accepted = tx(k.add, raw).ok;
        expect(k.add.schema.parse(raw).ok).toBe(accepted);
      }),
      opts,
    );
  });

  it("transaction.store is the store it was declared on", () => {
    const k = makeCart();
    expect(k.add.store).toBe(k.cart);
    expect(k.clear.store).toBe(k.cart);
  });
});
