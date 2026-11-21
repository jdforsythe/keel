import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { cart } from "./cart.ts";

/** Set the note. */
export const setNote = transaction(cart, "cart.setNote", s.object({ note: s.string() }), (st, p) => ({
  ...st,
  note: p.note,
}));
