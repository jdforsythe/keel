import { s } from "@keel/schema";

/** Search of `cart.show`: an optional filter text and an optional secret coupon. */
export const CartSearch = s.object({ q: s.string().optional(), coupon: s.secret(s.string()).optional() });
export type CartSearch = s.infer<typeof CartSearch>;
