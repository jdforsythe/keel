import { s } from "@keel/schema";
import { ItemRef } from "./ItemRef.schema.ts";

/** The call an outbox entry of `shopping.mark` holds: the item and where it goes. */
export const QueuedMark = s.object({ params: ItemRef, body: s.object({ bought: s.boolean() }) });
