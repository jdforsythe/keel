import { transaction } from "@keel/store";
import { AddPayload } from "./AddPayload.schema.ts";
import { items } from "./items.store.ts";

/** Adds one of `name` to the open items: a second add of a name still to buy raises its quantity, up to 99. */
export const add = transaction(items, "shopping.items.add", AddPayload, (state, p) => {
  const open = state.items.find((i) => !i.bought && i.name === p.name);
  if (open !== undefined)
    return {
      ...state,
      items: state.items.map((i) => (i.id === open.id ? { ...i, qty: Math.min(99, i.qty + 1) } : i)),
    };
  if (state.items.length >= 50 || state.items.some((i) => i.id === p.id)) return state;
  return { ...state, items: [...state.items, { id: p.id, name: p.name, qty: 1, bought: false }] };
});
