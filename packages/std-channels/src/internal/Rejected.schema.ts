import { s } from "@keel/schema";

/** A wait or a call an app function made failed: a cancelled timer, or a callback that threw. Nothing is kept of it. */
export const Rejected = s.error("channels.rejected", s.object({}));
