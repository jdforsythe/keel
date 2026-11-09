import { s } from "@keel/schema";
import { Session } from "../Session.schema.ts";

/**
 * What `sessions.list` returns (std.sessions Ingest): per fingerprint `count`, `first`, `last` and the kept sessions
 * in arrival order. The archive's callers and byte counts stay on the server.
 */
export const Listing = s.record(
  s.object(
    { count: s.int({ min: 1 }), first: s.number(), last: s.number(), sessions: s.array(Session) },
    { closed: true },
  ),
);
export type Listing = s.infer<typeof Listing>;
