import { s } from "@keel/schema";
import { Session } from "../../Session.schema.ts";
import { SessionEvent } from "../../SessionEvent.ts";

const keelError = s.object({ code: s.string(), message: s.string(), data: s.json() }, { closed: true });
/** Header pairs, `[name, value]`. */
const headers = s.array(s.array(s.string()));

/**
 * The messages between a group and its user workers (std.multi), parsed on receipt: every value that crosses the
 * thread boundary is checked here, so neither side trusts a structured clone's shape.
 */
export const wire = {
  /** A worker's answer to call `id`: its value, or the error it threw. */
  ret: s.object({
    t: s.literal("ret"),
    id: s.number(),
    ok: s.boolean(),
    value: s.json(),
    code: s.string().optional(),
    message: s.string().optional(),
  }),
  /** A request a user's sim net sent to the server's origin; the body travels beside it as bytes. */
  req: s.object({ t: s.literal("req"), rid: s.number(), method: s.string(), url: s.string(), headers }),
  /** A call from the group to a worker. */
  call: s.object({ t: s.literal("call"), id: s.number(), op: s.string(), arg: s.json() }),
  /** The status and headers of a server response to request `rid`. */
  head: s.object({ t: s.literal("head"), rid: s.number(), status: s.number(), statusText: s.string(), headers }),
  /** The user cancelled response `rid`'s body: the group cancels the server's. */
  cancel: s.object({ t: s.literal("cancel"), rid: s.number() }),
  /** The end of response `rid`'s body, or the error that ended it. */
  end: s.object({ t: s.literal("end"), rid: s.number(), error: s.string().optional() }),
  /** What `find` answers. */
  found: s.object({
    id: s.string(),
    role: s.string(),
    name: s.string(),
    text: s.string(),
    state: s.object({
      checked: s.boolean().optional(),
      disabled: s.boolean().optional(),
      expanded: s.boolean().optional(),
      selected: s.boolean().optional(),
      invalid: s.boolean().optional(),
      focused: s.boolean().optional(),
    }),
  }),
  /** What `state` answers: every store's value as JSON. */
  state: s.record(s.json()),
  session: Session,
  /** A user's replay result (std.sessions `ReplayResult`). */
  replay: s.object({
    observed: s.array(SessionEvent),
    state: s.record(s.json()),
    error: keelError.nullable(),
    reproduced: s.boolean(),
    unapplied: s.number().nullable(),
  }),
  /** A server store as stored under `keel.store.<id>`. */
  snapshot: s.object({
    state: s.json(),
    log: s.array(
      s.object({
        id: s.number(),
        name: s.string(),
        payload: s.json(),
        at: s.number(),
        meta: s.record(s.json()).optional(),
        base: s.number().optional(),
        key: s.string().optional(),
      }),
    ),
    initial: s.json(),
    head: s.number(),
    keys: s.array(s.object({ name: s.string(), key: s.string() })).optional(),
  }),
};
