import { s } from "@keel/schema";

/** The words of the weekly staples panel. */
export const RestockText = s.object({
  heading: s.string(),
  intro: s.string(),
  runNow: s.string(),
  never: s.string(),
  of: s.string(),
  handled: s.string(),
  putBack: s.string(),
  states: s.object({ running: s.string(), done: s.string(), failed: s.string() }),
  by: s.object({ schedule: s.string(), member: s.string() }),
  failedWith: s.string(),
  refused: s.string(),
});
