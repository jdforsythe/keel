import { s } from "@keel/schema";
import { Item } from "./Item.schema.ts";

export const ItemsState = s.object({ items: s.array(Item), show: s.enum(["toBuy", "bought"]) });
