import { tx } from "@keel/store";
import fc from "fast-check";
// Spec: k.store API (typed transactions) + k.schema Result: invalid payload -> err schema.invalid. Seed 1337.
import { describe, expect, it } from "vitest";
import { makeCart, opts } from "./fixtures";

describe("k.store: payload validation", () => {
  it("tx with an invalid payload returns err schema.invalid and leaves state and log unchanged", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.record({ item: fc.string() })), (bad) => {
        const k = makeCart();
        const before = JSON.stringify([k.cart.snapshot(), k.cart.log()]);
        const r = tx(k.add, bad);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe("schema.invalid");
        expect(JSON.stringify([k.cart.snapshot(), k.cart.log()])).toBe(before);
      }),
      opts,
    );
  });
});
