import { s } from "@keel/schema";

/** The words of the weekly staples panel. */
export const RestockText = s.object({
  heading: s.string({ min: 1 }),
  intro: s.string({ min: 1 }),
  runNow: s.string({ min: 1 }),
  never: s.string({ min: 1 }),
  of: s.string({ min: 1 }),
  handled: s.string({ min: 1 }),
  putBack: s.string({ min: 1 }),
  states: s.object({ running: s.string({ min: 1 }), done: s.string({ min: 1 }), failed: s.string({ min: 1 }) }),
  by: s.object({ schedule: s.string({ min: 1 }), member: s.string({ min: 1 }) }),
  failedWith: s.string({ min: 1 }),
  refused: s.string({ min: 1 }),
  live: s.object({
    live: s.string({ min: 1 }),
    connecting: s.string({ min: 1 }),
    offline: s.string({ min: 1 }),
    denied: s.string({ min: 1 }),
  }),
});
