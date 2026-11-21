import { transaction } from "@keel/store";
import { ShowPayload } from "./ShowPayload.schema.ts";
import { items } from "./items.store.ts";

export const show = transaction(items, "shopping.items.show", ShowPayload, (state, p) => ({ ...state, show: p.show }));
