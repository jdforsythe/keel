import { s } from "@keel/schema";
import { OutboxEntry } from "../OutboxEntry.schema.ts";

/** An outbox store's state, and what `ctx.storage` holds under `keel.outbox.<id>`. */
export const OutboxState = s.object({ entries: s.array(OutboxEntry) });
