import { contract } from "@keel/router/contract";
import { ItemRef } from "./ItemRef.schema.ts";
import { Items } from "./Items.schema.ts";
import { ListParams } from "./ListParams.schema.ts";
import { NewItem } from "./NewItem.schema.ts";
import { Runs } from "./Runs.schema.ts";
import { listChannel } from "./listChannel.schema.ts";
import { runsChannel } from "./runsChannel.schema.ts";

export const shopping = contract("shopping", {
  "shopping.list": { path: "/list" },
  "shopping.events": {
    method: "GET",
    path: "/api/items/events",
    query: ListParams,
    events: true,
    output: listChannel.events,
  },
  "shopping.items": { method: "GET", path: "/api/items", output: Items },
  "shopping.add": { method: "POST", path: "/api/items", body: NewItem, output: Items },
  "shopping.toggle": { method: "POST", path: "/api/items/:id/toggle", params: ItemRef, output: Items },
  "shopping.remove": { method: "DELETE", path: "/api/items/:id", params: ItemRef, output: Items },
  "shopping.runEvents": {
    method: "GET",
    path: "/api/restock/events",
    query: ListParams,
    events: true,
    output: runsChannel.events,
  },
  "shopping.runs": { method: "GET", path: "/api/restock", output: Runs },
  "shopping.run": { method: "POST", path: "/api/restock", output: Runs },
});
