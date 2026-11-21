import { transaction } from "@keel/store";
import { ItemRef } from "./ItemRef.schema.ts";
import { items } from "./items.store.ts";

/** Moves an item between the list and the bought tab; a return to the list merges into an open item of the same name. */
export const toggle = transaction(items, "shopping.items.toggle", ItemRef, (state, p) => {
  const item = state.items.find((i) => i.id === p.id);
  if (item === undefined) return state;
  const open = state.items.find((i) => !i.bought && i.name === item.name && i.id !== item.id);
  if (item.bought && open !== undefined)
    return {
      ...state,
      items: state.items
        .filter((i) => i.id !== item.id)
        .map((i) => (i.id === open.id ? { ...i, qty: Math.min(99, i.qty + item.qty) } : i)),
    };
  return { ...state, items: state.items.map((i) => (i.id === item.id ? { ...i, bought: !i.bought } : i)) };
});
