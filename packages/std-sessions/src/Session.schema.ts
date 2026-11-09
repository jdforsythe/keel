import { s } from "@keel/schema";
import { SessionEvent } from "./SessionEvent.ts";

/**
 * A recorded session (std.sessions), registered as `sessions.Session`: format `v`, `id`, the ctx `seed` (absent for a real or shell ctx, whose
 * random is not seeded: then `deterministic` is false and a replay may draw other ids), the base
 * (`at`, `route`, `state`), the `events` after it, the first `error` and its `fingerprint`.
 */
export const Session = s.object(
  {
    v: s.literal(1),
    id: s.id("Session"),
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
