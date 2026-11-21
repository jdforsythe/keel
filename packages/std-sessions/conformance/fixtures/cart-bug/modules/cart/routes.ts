import { manifest } from "@keel/router";
import { CartPage } from "./CartPage.ts";
import { cart } from "./cart.contract.ts";

/** The cart module's routes. */
export const routes = manifest(cart, {
  "cart.show": { component: CartPage },
});
