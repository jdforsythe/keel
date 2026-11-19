import { store } from "@keel/store";
import { Cart } from "./Cart.schema.ts";

/** The cart store `cart.cart`. */
export const cart = store(Cart, { items: [], card: "", note: "", pinSet: false }, { id: "cart.cart" });
