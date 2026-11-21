import { s } from "@keel/schema";
import { Item } from "./Item.schema.ts";

export const Items = s.object({ items: s.array(Item) });
