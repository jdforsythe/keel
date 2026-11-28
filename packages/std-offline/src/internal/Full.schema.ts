import { s } from "@keel/schema";

/** An outbox that would pass its `limit` entries or its `maxBytes`: `send` adds nothing. */
export const Full = s.error("offline.full", s.object({ limit: s.int(), maxBytes: s.int() }));
