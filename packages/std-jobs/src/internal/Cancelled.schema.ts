import { s } from "@keel/schema";

/** A timer was cancelled before it fired. */
export const Cancelled = s.error("jobs.cancelled", s.object({}));
