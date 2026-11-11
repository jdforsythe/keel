import { s } from "@keel/schema";

/**
 * A module's queue as stored under `ctx.storage` `std.jobs.<module>` (std.jobs): the jobs (`n` runs counted, `l`
 * leased), the keys and ids of the last 1,000 finished jobs, and the newest 100 failures. Inputs are encoded by their
 * job's schema.
 */
export const State = s.object({
  q: s.array(
    s.object({
      id: s.id("Job"),
      job: s.string(),
      input: s.json(),
      at: s.number(),
      n: s.int({ min: 0 }),
      l: s.boolean(),
      key: s.string().optional(),
    }),
  ),
  done: s.array(s.object({ k: s.string(), id: s.id("Job") })),
  failed: s.array(s.object({ id: s.id("Job"), job: s.string(), code: s.string(), at: s.number() })),
});
export type State = s.infer<typeof State>;
