import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { cart } from "./cart.ts";

/** Mark whether a pin is typed (the pin itself stays in the password input). */
export const setPin = transaction(cart, "cart.setPin", s.object({ set: s.boolean() }), (st, p) => ({
  ...st,
  pinSet: p.set,
}));
