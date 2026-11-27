import { s } from "@keel/schema";

/** A wait ended because its signal aborted. */
export const Cancelled = s.error("schedules.cancelled", s.object({}));
