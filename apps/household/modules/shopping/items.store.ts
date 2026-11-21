import { invariant, store } from "@keel/store";
import { ItemsState } from "./ItemsState.schema.ts";

export const items = store(ItemsState, { items: [], show: "toBuy" }, { id: "shopping.items" });

invariant(items, (v) => v.items.length <= 50);
invariant(items, (v) => new Set(v.items.map((i) => i.id)).size === v.items.length);
invariant(
  items,
  (v) => new Set(v.items.filter((i) => !i.bought).map((i) => i.name)).size === v.items.filter((i) => !i.bought).length,
);
