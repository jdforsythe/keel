import { transaction } from "@keel/store";
import { ShowPayload } from "./ShowPayload.schema.ts";
import { view } from "./view.store.ts";

export const show = transaction(view, "shopping.view.show", ShowPayload, (_state, p) => ({ show: p.show }));
