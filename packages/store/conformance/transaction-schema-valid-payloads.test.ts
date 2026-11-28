// Spec: k.store, clause "`store.schema` parses every state the store accepts and `transaction.schema` parses every payload `tx` accepts."
import { gen } from "@keel/schema/gen";
import { tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { makeCart, opts } from "./fixtures";

describe("k.store: transaction.schema on valid payloads", () => {
  it("every generated valid add payload is accepted by tx and parsed by add.schema", () => {
    const k0 = makeCart();
    fc.assert(
      fc.property(gen(k0.add.schema), (p) => {
        const k = makeCart();
        expect(k.add.schema.parse(p).ok).toBe(true);
        expect(tx(k.add, p).ok).toBe(true);
      }),
      opts,
    );
  });

  it("the empty-object payload of clear and pop is accepted by tx and parsed by schema", () => {
    const k = makeCart();
    expect(k.clear.schema.parse({}).ok).toBe(true);
    expect(tx(k.clear, {}).ok).toBe(true);
    expect(k.pop.schema.parse({}).ok).toBe(true);
    expect(tx(k.pop, {}).ok).toBe(true);
    fc.assert(
      fc.property(gen(k.clear.schema), (p) => {
        expect(k.clear.schema.parse(p).ok).toBe(true);
        expect(tx(makeCart().clear, p).ok).toBe(true);
      }),
      opts,
    );
  });
});
