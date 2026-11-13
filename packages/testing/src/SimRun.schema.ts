import { Schedule } from "@keel/ctx";
import { s } from "@keel/schema";

/** One `simulate` run (k.sim): the sim ctx's seed and the schedule it ran under. JSON; `replay` takes one. */
export const SimRun = s.object({ seed: s.int({ min: 0, max: 2 ** 32 - 1 }), schedule: Schedule });
export type SimRun = s.infer<typeof SimRun>;
