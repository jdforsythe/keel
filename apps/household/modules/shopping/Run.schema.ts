import { s } from "@keel/schema";
import { Instant } from "@keel/std-temporal";

/** One weekly run as a member sees it: who started it and when, where it is, and how many staples it put back. */
export const Run = s.object({
  by: s.enum(["schedule", "member"]),
  at: Instant,
  state: s.enum(["running", "done", "failed"]),
  putBack: s.int({ min: 0, max: 50 }),
  handled: s.int({ min: 0, max: 50 }),
  total: s.int({ min: 0, max: 50 }),
  code: s.string({ max: 80 }),
});
