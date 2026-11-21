import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { savedStores } from "./savedStores.ts";
import { shopping } from "./shopping.contract.ts";

export const toggleItem = action(
  shopping,
  "shopping.toggle",
  { stores: savedStores },
  (_body, { params, caller, stores }) => {
    const r = tx(stores.toggle, { id: params.id }, { meta: { caller } });
    return r.ok ? ok({ items: stores.saved.get("items") }) : err(r.error);
  },
);
