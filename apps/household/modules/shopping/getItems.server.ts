import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { savedStores } from "./savedStores.ts";
import { shopping } from "./shopping.contract.ts";

export const getItems = loader(shopping, "shopping.items", { stores: savedStores }, async ({ stores }) =>
  ok({ items: stores.saved.get("items") }),
);
