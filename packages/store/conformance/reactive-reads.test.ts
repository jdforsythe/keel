import { computed, effect, scope } from "@keel/reactive";
import fc from "fast-check";
// k.store API, "Reads: cart.get('items'), cart.select(fn) as computeds". Seed 1337.
import { describe, expect, it } from "vitest";
import { applyOp, inScope, makeCart, opArb, opts } from "./fixtures";

describe("k.store: reactive reads", () => {
  it("An effect reading get('items') re-runs exactly once per committed tx", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 15 }), (ops) => {
        const k = makeCart();
        let runs = 0;
        const seen: unknown[] = [];
        scope(() => {
          effect(() => {
            seen.push(k.cart.get("items"));
            runs++;
          });
        });
        expect(runs).toBe(1);
        for (const [i, op] of ops.entries()) {
          applyOp(k, op);
          expect(runs).toBe(i + 2);
        }
        expect(seen[seen.length - 1]).toEqual(k.cart.get("items"));
      }),
      opts,
    );
  });

  it("select(fn) yields a computed that tracks committed state", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 15 }), (ops) => {
        const k = makeCart();
        const count = inScope(() => k.cart.select((st) => st.items.length));
        for (const op of ops) {
          applyOp(k, op);
          expect(count.get()).toBe(k.cart.get("items").length);
        }
      }),
      opts,
    );
  });

  it("A computed over get('items') recomputes after a committed tx", () => {
    const k = makeCart();
    const n = inScope(() => computed(() => k.cart.get("items").length));
    expect(n.get()).toBe(0);
    applyOp(k, { kind: "add", item: { sku: "a", qty: 1 } });
    expect(n.get()).toBe(1);
  });
});
