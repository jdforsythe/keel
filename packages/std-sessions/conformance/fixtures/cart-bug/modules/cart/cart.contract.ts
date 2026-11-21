import { contract } from "@keel/router/contract";
import { CartSearch } from "./CartSearch.schema.ts";

/** The cart module's contract: one page. */
export const cart = contract("cart", {
  "cart.show": { path: "/cart", search: CartSearch },
});
