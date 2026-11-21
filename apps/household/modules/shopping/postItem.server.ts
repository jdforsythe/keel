import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { savedStores } from "./savedStores.ts";
import { shopping } from "./shopping.contract.ts";

export const postItem = action(shopping, "shopping.add", { stores: savedStores }, (body, { caller, stores }, ctx) => {
  const r = tx(stores.add, { id: ctx.random.id("Item"), name: body.name }, { meta: { caller } });
  return r.ok ? ok({ items: stores.saved.get("items") }) : err(r.error);
});
