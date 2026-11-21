import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { cart } from "./cart.ts";

/** Add one item. */
export const add = transaction(cart, "cart.add", s.object({ sku: s.string() }), (st, p) => ({
  ...st,
  items: [...st.items, p.sku],
}));
