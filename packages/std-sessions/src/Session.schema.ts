import { type Id, type Schema, s } from "@keel/schema";
import { SessionEvent } from "./SessionEvent.ts";

const ID = s.id("Session");
/** A session id: a short token, `^[A-Za-z0-9_-]{1,64}$` (a `random.id` UUID is one); every `Session` that parses meets it. */
const SessionId: Schema<Id<"Session">> = s.format("sessions.SessionId", ID, {
  check: (id) => /^[A-Za-z0-9_-]{1,64}$/.test(id),
  gen: {
    from: ID,
    map: (v) => {
      const clean = ID.parse(v.replace(/[^A-Za-z0-9_-]/g, "x").slice(0, 64));
      return clean.ok ? clean.value : v;
    },
  },
});

/**
 * A recorded session (std.sessions), registered as `sessions.Session`: format `v`, `id`, the ctx `seed` (absent for a real or shell ctx, whose
 * random is not seeded: then `deterministic` is false and a replay may draw other ids), the base
 * (`at`, `route`, `state`), the `events` after it, the first `error` and its `fingerprint`.
 */
export const Session = s.object(
  {
    v: s.literal(1),
    id: SessionId,
    seed: s.number().optional(),
    deterministic: s.boolean(),
    at: s.number(),
    route: s.object({ id: s.string(), params: s.record(s.json()), search: s.record(s.json()) }, { closed: true }),
    state: s.record(s.json()),
    events: s.array(SessionEvent),
    error: s.object({ code: s.string(), message: s.string(), data: s.json() }, { closed: true }).nullable(),
    fingerprint: s.string(),
  },
  { closed: true },
);
export type Session = s.infer<typeof Session>;
s.register("sessions.Session", Session);
