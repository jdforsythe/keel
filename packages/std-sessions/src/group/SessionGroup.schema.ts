import { s } from "@keel/schema";
import { Session } from "../Session.schema.ts";

/**
 * A session group (std.multi), registered as `sessions.SessionGroup`: the sessions of several users of one server,
 * recorded under simulation on one timeline. `seed` is the server's sim seed, `at` the time the group opened,
 * `origin` the server's origin, `server` each server store as stored under `keel.store.<id>` when the group opened,
 * and `users` one session per user, in user index order.
 */
const SessionGroupShape = s.object(
  {
    v: s.literal(1),
    seed: s.number(),
    at: s.number(),
    origin: s.string(),
    server: s.record(s.json()),
    users: s.array(Session),
  },
  { closed: true },
);
export const SessionGroup: typeof SessionGroupShape = SessionGroupShape;
export type SessionGroup = s.infer<typeof SessionGroupShape>;
s.register("sessions.SessionGroup", SessionGroup);
