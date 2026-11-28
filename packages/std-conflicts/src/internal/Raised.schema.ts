import { s } from "@keel/schema";

/**
 * A transaction of a replayed log threw an `Error` that is no TypeError, RangeError or defect: a dependency's failure.
 * The entry being judged is `unchecked` `threw`. Nothing is kept of the thrown value.
 */
export const Raised = s.error("conflicts.raised", s.object({}));
