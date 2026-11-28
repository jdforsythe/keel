import { s } from "@keel/schema";

/** One fetch's step in a schedule (k.sim): how long it waits on the sim clock, then which fault it meets. */
export const NetStep = s.object({
  delay: s.int({ min: 0, max: 60000 }),
  fault: s.enum(["none", "drop", "lost", "unavailable"]),
});
export type NetStep = s.infer<typeof NetStep>;
