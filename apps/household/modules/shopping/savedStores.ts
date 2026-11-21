import { invariant, store, transaction } from "@keel/store";
import { AddPayload } from "./AddPayload.schema.ts";
import { ItemRef } from "./ItemRef.schema.ts";
import { Items } from "./Items.schema.ts";
import { addTo } from "./addTo.ts";
import { toggleIn } from "./toggleIn.ts";

/** The household's list on the server, restored from `ctx.storage` per request. */
export const savedStores = () => {
  const saved = store(Items, { items: [] }, { id: "shopping.saved" });
  invariant(saved, (v) => v.items.length <= 50);
  invariant(saved, (v) => new Set(v.items.map((i) => i.id)).size === v.items.length);
  invariant(saved, (v) => {
    const open = v.items.filter((i) => !i.bought).map((i) => i.name);
    return new Set(open).size === open.length;
  });
  const add = transaction(saved, "shopping.saved.add", AddPayload, (state, p) => ({ items: addTo(state.items, p) }));
  const toggle = transaction(saved, "shopping.saved.toggle", ItemRef, (state, p) => ({
    items: toggleIn(state.items, p.id),
  }));
  const remove = transaction(saved, "shopping.saved.remove", ItemRef, (state, p) => ({
    items: state.items.filter((i) => i.id !== p.id),
  }));
  return { saved, add, toggle, remove };
};
