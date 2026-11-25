// Spec: k.store, clause "`restore` replaces the base `undo` replays from with the snapshot's `initial`."
// k.store Seed 1337.
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  applyOp,
  Cart,
  inScope,
  type CartKit,
  type Item,
  Item as ItemSchema,
  itemArb,
  makeCart,
  opArb,
  opts,
} from "./fixtures";

function makeCartFrom(initial: { items: Item[] }): CartKit {
  return inScope(() => {
    const cart = store(Cart, initial);
    const add = transaction(cart, "cart.addItem", s.object({ item: ItemSchema }), (state, { item }) => ({
      ...state,
      items: [...state.items, item],
    }));
    const pop = transaction(cart, "cart.pop", s.object({}), (state) => ({ ...state, items: state.items.slice(0, -1) }));
    const clear = transaction(cart, "cart.clear", s.object({}), (state) => ({ ...state, items: [] }));
    return { cart, add, pop, clear };
  });
}

describe("k.store: restore replaces the undo base with the snapshot's initial", () => {
  it("undo after restore replays from the source's non-empty initial, not the destination's", () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { minLength: 1, maxLength: 5 }),
        fc.array(opArb, { maxLength: 10 }),
        (items, ops) => {
          const initial = { items };
          const src = makeCartFrom(initial);
          for (const op of ops) applyOp(src, op);
          const dst = makeCart();
          dst.cart.restore(JSON.parse(JSON.stringify(src.cart.snapshot())));
          expect(dst.cart.snapshot().initial).toEqual(initial);
          const logged = src.cart.log().length;
          // prefixStates[k] = state after replaying the first k logged ops on the source initial (twin store)
          const twin = makeCartFrom(initial);
          const applied = ops.filter((op) => {
            const before = twin.cart.log().length;
            applyOp(twin, op);
            return twin.cart.log().length > before;
          });
          expect(applied.length).toBe(logged);
          const replay = makeCartFrom(initial);
          const prefixStates: unknown[] = [replay.cart.snapshot().state];
          for (const op of applied) {
            applyOp(replay, op);
            prefixStates.push(replay.cart.snapshot().state);
          }
          for (let k = logged - 1; k >= 0; k--) {
            expect(dst.cart.undo()).toBe(true);
            expect(dst.cart.snapshot().state).toEqual(prefixStates[k]);
          }
          expect(dst.cart.undo()).toBe(false);
          expect(dst.cart.snapshot().state).toEqual(initial);
        },
      ),
      opts,
    );
  });
});
