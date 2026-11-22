import { s } from "@keel/schema";
import { Item } from "./Item.schema.ts";

/** This page's copy of the list; `read` is false until the first read since the page opened commits. */
export const Copy = s.object({ items: s.array(Item), read: s.boolean() });
