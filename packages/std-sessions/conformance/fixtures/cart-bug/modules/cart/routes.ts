import { manifest } from "@keel/router";
import { CartPage } from "./CartPage.ts";
import { CartSearch } from "./CartSearch.schema.ts";

/** The cart module's routes. */
export const routes = manifest({ "cart.show": { path: "/cart", search: CartSearch, component: CartPage } });
