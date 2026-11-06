// Shared fixtures for k.store conformance. Seed 1337 (recorded here, used by every suite).
import fc from "fast-check";
import { s } from "@keel/schema";
import { scope } from "@keel/reactive";
import { store, transaction, tx } from "@keel/store";

export const SEED = 1337;
export const RUNS = 100;
export const opts = { seed: SEED, numRuns: RUNS };

export const Item = s.object({ sku: s.string(), qty: s.int() });
export const Cart = s.object({ items: s.array(Item) });

export interface Item {
  sku: string;
  qty: number;
}

export const itemArb: fc.Arbitrary<Item> = fc.record({
  sku: fc.string({ maxLength: 8 }),
  qty: fc.integer({ min: -1000, max: 1000 }),
});

export type Op = { kind: "add"; item: Item } | { kind: "pop" } | { kind: "clear" };

export const opArb: fc.Arbitrary<Op> = fc.oneof(
  itemArb.map((item): Op => ({ kind: "add", item })),
  fc.constant<Op>({ kind: "pop" }),
  fc.constant<Op>({ kind: "clear" }),
);

/** Run `fn` inside a scope and return its result (no casts, no non-null assertions). */
export function inScope<T>(fn: () => T): T {
  const box: { v: { value: T } | undefined } = { v: undefined };
  const sc = scope(() => {
    box.v = { value: fn() };
  });
  if (box.v === undefined) throw new Error("scope body did not run");
  const out = box.v.value;
  // Scope intentionally left open: callers inspect live stores after return.
  void sc;
  return out;
}

export function makeCart(options?: { id?: string; clock?: () => number }) {
  return inScope(() => {
    const cart = store(Cart, { items: [] }, options);
    const add = transaction(cart, "cart.addItem", s.object({ item: Item }), (state, { item }) => ({
      ...state,
      items: [...state.items, item],
    }));
    const pop = transaction(cart, "cart.pop", s.object({}), (state) => ({
      ...state,
      items: state.items.slice(0, -1),
    }));
    const clear = transaction(cart, "cart.clear", s.object({}), (state) => ({ ...state, items: [] }));
    return { cart, add, pop, clear };
  });
}

export type CartKit = ReturnType<typeof makeCart>;

export function applyOp(k: CartKit, op: Op) {
  switch (op.kind) {
    case "add":
      return tx(k.add, { item: op.item });
    case "pop":
      return tx(k.pop, {});
    case "clear":
      return tx(k.clear, {});
  }
}
