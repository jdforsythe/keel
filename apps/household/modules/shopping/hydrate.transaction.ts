import { transaction } from "@keel/store";
import { Items } from "./Items.schema.ts";
import { copy } from "./copy.store.ts";

/** Replaces the page's copy with the list the server answered. */
export const hydrate = transaction(copy, "shopping.copy.hydrate", Items, (_state, p) => ({
  items: p.items,
  read: true,
}));
