import { s } from "@keel/schema";

/**
 * Output record kind `session` (std.sessions, docs/OUTPUT.md) that `keel session` emits: the base `route` id, `events`
 * and `inputs` counts, the first error's `code` (null: none), and the `file` read or written.
 */
export const SessionRecord = s.object(
  {
    kind: s.literal("session"),
    id: s.string(),
    fingerprint: s.string(),
    route: s.string(),
    events: s.int(),
    inputs: s.int(),
    error: s.string().nullable(),
    file: s.string().nullable(),
  },
  { closed: true },
);
export type SessionRecord = s.infer<typeof SessionRecord>;
