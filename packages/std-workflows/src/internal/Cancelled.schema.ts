import { s } from "@keel/schema";

/** A wait ended because its signal aborted. */
export const Cancelled = s.error("workflows.cancelled", s.object({}));
