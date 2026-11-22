import { s } from "@keel/schema";

/** How many of an item are on the shelf. */
export const Stock = s.object({ item: s.string(), count: s.number() });
