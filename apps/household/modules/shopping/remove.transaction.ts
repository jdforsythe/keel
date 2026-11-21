import { transaction } from "@keel/store";
import { ItemRef } from "./ItemRef.schema.ts";
import { items } from "./items.store.ts";

export const remove = transaction(items, "shopping.items.remove", ItemRef, (state, p) => ({
  ...state,
  items: state.items.filter((i) => i.id !== p.id),
}));
