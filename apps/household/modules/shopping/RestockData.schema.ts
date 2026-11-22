import { s } from "@keel/schema";

/**
 * One weekly run's own values: the staples it puts back, the index of the next one, how many it put back, who started
 * it and when (epoch milliseconds), and the code it failed with (`''` while it has not failed).
 */
export const RestockData = s.object({
  staples: s.array(s.string({ min: 1, max: 60 })),
  next: s.int({ min: 0, max: 50 }),
  putBack: s.int({ min: 0, max: 50 }),
  by: s.enum(["schedule", "member"]),
  at: s.int({ min: 0 }),
  code: s.string({ max: 80 }),
});
