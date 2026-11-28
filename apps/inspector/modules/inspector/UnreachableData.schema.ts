import { s } from "@keel/schema";

/**
 * What `inspector.unreachable` holds: the origin asked (empty when `?url=` names no origin on this machine) and which
 * of the two answers it is: `origin`, `?url=` refused, or `document`, any failure of the fetch, which says nothing of
 * what listens there.
 */
export const UnreachableData = s.object({
  url: s.string(),
  why: s.enum(["origin", "document"]),
});
