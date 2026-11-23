import { s } from "@keel/schema";
import { Write } from "@keel/std-offline";

/** Body of `POST /api/items/:id/bought`: where the item goes, and the write's `key`, `base` (the item's `rev` the member's page showed) and `owner`. */
export const MarkBought = s.object({ bought: s.boolean(), write: Write });
