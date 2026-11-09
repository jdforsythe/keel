import { s } from "@keel/schema";
import { SessionEvent } from "./SessionEvent.ts";

/**
 * A recorded session (std.sessions), registered as `sessions.Session`: format `v`, `id`, the ctx `seed` (absent for a real or shell ctx, whose
 * random is not seeded: then `deterministic` is false and a replay may draw other ids), the base
 * (`at`, `route`, `state`), the `events` after it, the first `error` and its `fingerprint`.
 */
const SessionShape = s.object(
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
/** A client-chosen id becomes a file name nowhere, but stays a short token: `^[A-Za-z0-9_-]{1,64}$`. */
const SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const Session: typeof SessionShape = {
  ...SessionShape,
  // A bad id parses as the empty id: the same issue path (`id`), no second error shape.
  parse: (x) => SessionShape.parse(SESSION_ID.test(String(Object(x).id)) ? x : { ...Object(x), id: "" }),
};
export type Session = s.infer<typeof SessionShape>;
s.register("sessions.Session", Session);
