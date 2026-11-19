import { s } from "@keel/schema";
import { Session } from "./Session.schema.ts";

/**
 * The ingest archive (std.sessions Ingest), keyed by fingerprint: how many sessions arrived (`count`), the ingest
 * clock at the first and the last, and the newest 5 sessions in arrival order, each with its encoded JSON `bytes`
 * (measured once, when it is filed). At most 64 fingerprints.
 */
export const Archive = s.record(
  s.object(
    {
      count: s.int({ min: 1 }),
      first: s.number(),
      last: s.number(),
      sessions: s.array(s.object({ bytes: s.int({ min: 0 }), session: Session }, { closed: true })),
    },
    { closed: true },
  ),
);
export type Archive = s.infer<typeof Archive>;
