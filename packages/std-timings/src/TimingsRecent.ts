import { s } from "@keel/schema";
import { Timings } from "./Timings.ts";

/**
 * The `timings.recent` inspect section (std.timings, rfc:0059): the ctx's `timingsOf` and `dropped`, the names it
 * evicted at the 256-name cap.
 */
export const TimingsRecent = s.object({ timings: Timings, dropped: s.int({ min: 0 }) }, { closed: true });
export type TimingsRecent = s.infer<typeof TimingsRecent>;
