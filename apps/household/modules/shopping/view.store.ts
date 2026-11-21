import { store } from "@keel/store";
import { ViewState } from "./ViewState.schema.ts";

export const view = store(ViewState, { show: "toBuy" }, { id: "shopping.view" });
