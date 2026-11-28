import type { Id } from "@keel/schema";
import type { Session } from "../Session.schema.ts";
import { fingerprint } from "./fingerprint.ts";

/** A session with no base: no route was seen (or none can be, without a `document`). */
export function emptySession(id: Id<"Session">, seed: number | undefined, at: number): Session {
  return {
    v: 1,
    id,
    ...(seed === undefined ? {} : { seed }),
    deterministic: seed !== undefined,
    at,
    route: { id: "", params: {}, search: {} },
    state: {},
    events: [],
    error: null,
    fingerprint: fingerprint(null, ""),
  };
}
