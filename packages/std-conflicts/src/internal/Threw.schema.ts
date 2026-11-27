import { s } from "@keel/schema";

/** A transaction of a replayed log raised a TypeError or RangeError: the entry does not apply. Nothing is kept of it. */
export const Threw = s.error("conflicts.threw", s.object({}));
