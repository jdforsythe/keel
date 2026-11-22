import { store } from "@keel/store";
import { Copy } from "./Copy.schema.ts";

export const copy = store(Copy, { items: [], read: false }, { id: "shopping.copy" });
