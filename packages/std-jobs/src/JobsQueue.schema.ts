import { s } from "@keel/schema";

/**
 * The `jobs.queue` inspect section (std.jobs): per module, the pending and running counts and the newest failures with
 * their error code. Never an input.
 */
export const JobsQueue = s.record(
  s.object({
    pending: s.int({ min: 0 }),
    running: s.int({ min: 0 }),
    failed: s.array(s.object({ id: s.string(), job: s.string(), code: s.string(), at: s.number() })),
  }),
);
export type JobsQueue = s.infer<typeof JobsQueue>;
