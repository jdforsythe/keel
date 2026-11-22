import { contract } from "@keel/router/contract";
import { ItemRef } from "./ItemRef.schema.ts";
import { Items } from "./Items.schema.ts";
import { NewItem } from "./NewItem.schema.ts";

export const shopping = contract("shopping", {
  "shopping.shell": { layout: true },
  "shopping.list": { path: "/list" },
  "shopping.items": { method: "GET", path: "/api/items", output: Items },
  "shopping.add": { method: "POST", path: "/api/items", body: NewItem, output: Items },
  "shopping.toggle": { method: "POST", path: "/api/items/:id/toggle", params: ItemRef, output: Items },
  "shopping.remove": { method: "DELETE", path: "/api/items/:id", params: ItemRef, output: Items },
});
