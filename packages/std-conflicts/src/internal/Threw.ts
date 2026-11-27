import { s } from "@keel/schema";

/** A transaction of a replayed log threw: the entry does not apply. Nothing is kept of the throw. */
export const Threw = s.error("conflicts.threw", s.object({}));
