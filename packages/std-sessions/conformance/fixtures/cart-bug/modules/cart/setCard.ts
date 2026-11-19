import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { cart } from "./cart.ts";

/** Set the card number typed so far. */
export const setCard = transaction(cart, "cart.setCard", s.object({ number: s.string() }), (st, p) => ({
  ...st,
  card: p.number,
}));
