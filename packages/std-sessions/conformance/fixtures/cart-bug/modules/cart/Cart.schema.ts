import { s } from "@keel/schema";

/** The cart: items, the card number typed so far, a free-text note, and whether a pin was typed. */
export const Cart = s.object({ items: s.array(s.string()), card: s.string(), note: s.string(), pinSet: s.boolean() });
export type Cart = s.infer<typeof Cart>;
