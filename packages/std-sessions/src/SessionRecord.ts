import { formatter } from "@keel/cli";
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

const compact = (r: SessionRecord): string =>
  `${r.fingerprint} ${r.route} ${r.events} events ${r.error ?? "ok"}${r.file === null ? "" : ` -> ${r.file}`}`;
const pretty = (r: SessionRecord): string =>
  `session ${r.fingerprint} ${r.route}: ${r.events} events, ${r.inputs} inputs, ${r.error ?? "ok"}${
    r.file === null ? "" : `\n  file: ${r.file}`
  }`;

formatter("session", { schema: SessionRecord, compact, pretty });
