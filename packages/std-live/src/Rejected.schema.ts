import { s } from "@keel/schema";

/** A wait or a read failed without a result: a cancelled timer, or a `read` that threw. Nothing is kept of it. */
export const Rejected = s.error("live.rejected", s.object({}));
